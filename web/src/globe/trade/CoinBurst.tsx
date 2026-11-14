// B12: coin bursts. When a ledger row for a plunder or a seizure first appears (any status), a
// spray of small gold coins springs from the payer's capital (seizure) or from the payer's tile
// nearest the payee's capital (plunder, the sacked city), arcs up and falls over 1.2 s, then
// vanishes. A pool of 3 bursts. Reduced motion: a single gold flash instead. Lane b.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../../state/world';
import type { LedgerRow } from '../../state/world';
import { tileHeight } from '../mesh/buildProvinceMesh';

const BURSTS = 3, COINS = 20, MIN_COINS = 12;
const LIFE_S = 1.2, FLASH_S = 0.6;
const COIN_R = 0.0055, COIN_H = 0.0013;
const GOLD = '#ffc940';

interface Coin { side: THREE.Vector3; speed: number; up: number; g: number; axis: THREE.Vector3; spin: number }
interface Burst { active: boolean; start: number; origin: THREE.Vector3; normal: THREE.Vector3; count: number; coins: Coin[]; flash: THREE.Sprite }

function tilePoint(world: World, tileId: number): THREE.Vector3 | null {
  const t = world.tiles[tileId];
  if (!t) return null;
  return new THREE.Vector3(t.center[0], t.center[1], t.center[2]).normalize().multiplyScalar(tileHeight(t));
}

/** Where the coins spring from: the payer's capital for a seizure, the payer's tile nearest the
 * payee's capital for a plunder. Falls back to whichever capital still exists. */
function burstOrigin(world: World, row: LedgerRow): THREE.Vector3 | null {
  const payer = world.countries[row.from], payee = world.countries[row.to];
  if (row.reason === 'plunder' && payer && payee) {
    const target = world.tiles[payee.capitalTile];
    if (target) {
      const [tx, ty, tz] = target.center;
      let best = -1, bestD = Infinity;
      for (let i = 0; i < world.owner.length; i++) {
        if (world.owner[i] !== row.from) continue;
        const c = world.tiles[i]!.center;
        const d = (c[0] - tx) ** 2 + (c[1] - ty) ** 2 + (c[2] - tz) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) return tilePoint(world, best);
    }
  }
  if (payer) { const p = tilePoint(world, payer.capitalTile); if (p) return p; }
  return payee ? tilePoint(world, payee.capitalTile) : null;
}

function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,244,196,1)');
  grad.addColorStop(0.35, 'rgba(255,201,64,0.7)');
  grad.addColorStop(1, 'rgba(255,201,64,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function CoinBurst() {
  const world = useWorld((s) => s.world);
  const still = useMemo(reducedMotion, []);
  const pool = useMemo(() => {
    const group = new THREE.Group();
    group.renderOrder = 22;
    const geo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 14);
    const mat = new THREE.MeshStandardMaterial({ color: GOLD, emissive: '#8a5c00', emissiveIntensity: 0.9, metalness: 0.55, roughness: 0.3 });
    const coins = new THREE.InstancedMesh(geo, mat, BURSTS * COINS);
    coins.frustumCulled = false;
    coins.count = BURSTS * COINS;
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < BURSTS * COINS; i++) coins.setMatrixAt(i, zero);
    coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(coins);
    const tex = glowTexture();
    const bursts: Burst[] = [];
    for (let b = 0; b < BURSTS; b++) {
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: GOLD, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      flash.visible = false;
      group.add(flash);
      const list: Coin[] = [];
      for (let i = 0; i < COINS; i++) list.push({ side: new THREE.Vector3(), speed: 0, up: 0, g: 0, axis: new THREE.Vector3(), spin: 0 });
      bursts.push({ active: false, start: 0, origin: new THREE.Vector3(), normal: new THREE.Vector3(), count: 0, coins: list, flash });
    }
    return { group, coins, bursts, tex, zero };
  }, []);

  useEffect(() => () => {
    pool.coins.geometry.dispose();
    (pool.coins.material as THREE.Material).dispose();
    for (const b of pool.bursts) (b.flash.material as THREE.Material).dispose();
    pool.tex.dispose();
  }, [pool]);

  useEffect(() => {
    const seen = new Set<string>();
    const spawn = (row: LedgerRow) => {
      const w = useWorld.getState().world;
      if (!w) return;
      const origin = burstOrigin(w, row);
      if (!origin) return;
      let b = pool.bursts.find((x) => !x.active);
      if (!b) b = pool.bursts.reduce((o, x) => (x.start < o.start ? x : o));
      b.active = true;
      b.start = performance.now() / 1000;
      b.origin.copy(origin);
      b.normal.copy(origin).normalize();
      // more coins for a bigger haul
      b.count = Math.round(MIN_COINS + (COINS - MIN_COINS) * Math.min(1, Math.log10(1 + Math.max(0, row.amount)) / 3));
      // coins lean towards whoever takes the money
      const payee = w.countries[row.to];
      const toward = new THREE.Vector3();
      const dest = payee ? tilePoint(w, payee.capitalTile) : null;
      if (dest) toward.copy(dest).sub(origin).projectOnPlane(b.normal).normalize();
      const t1 = new THREE.Vector3().crossVectors(b.normal, Math.abs(b.normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const t2 = new THREE.Vector3().crossVectors(b.normal, t1);
      for (let i = 0; i < b.coins.length; i++) {
        const c = b.coins[i]!;
        const a = Math.random() * Math.PI * 2;
        c.side.copy(t1).multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a)).addScaledVector(toward, 0.6).normalize();
        c.speed = 0.018 + Math.random() * 0.03;
        const peak = 0.03 + Math.random() * 0.03;
        const land = LIFE_S * (0.75 + Math.random() * 0.2);
        // peak = up^2 / 2g and the coin lands at 2 up / g = land
        c.g = (8 * peak) / (land * land);
        c.up = (c.g * land) / 2;
        c.axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        c.spin = 8 + Math.random() * 10;
      }
      b.flash.position.copy(origin).addScaledVector(b.normal, 0.004);
      b.flash.visible = true;
    };
    const take = (rows: LedgerRow[]) => {
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        if (r.reason === 'plunder' || r.reason === 'seizure') spawn(r);
      }
    };
    // rows already in the store when we mount are history: remember them, do not burst
    for (const r of useWorld.getState().ledger) seen.add(r.id);
    let last = useWorld.getState().ledger;
    return useWorld.subscribe((s) => {
      if (s.ledger === last) return;
      last = s.ledger;
      take(s.ledger.slice(-12));
    });
  }, [pool, world?.id]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const up = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const yAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  useFrame(() => {
    const now = performance.now() / 1000;
    let dirty = false;
    pool.bursts.forEach((b, bi) => {
      if (!b.active) return;
      const age = now - b.start;
      const life = still ? FLASH_S : LIFE_S;
      if (age >= life) {
        b.active = false;
        b.flash.visible = false;
        for (let i = 0; i < COINS; i++) pool.coins.setMatrixAt(bi * COINS + i, pool.zero);
        dirty = true;
        return;
      }
      // the flash: a quick gold pop at the source (the whole effect under reduced motion)
      const fa = still ? Math.sin(Math.PI * (age / FLASH_S)) : Math.max(0, 1 - age / 0.45);
      (b.flash.material as THREE.SpriteMaterial).opacity = 0.9 * fa;
      b.flash.scale.setScalar(still ? 0.06 : 0.035 + 0.05 * Math.min(1, age / 0.3));
      if (still) return;
      up.setFromUnitVectors(yAxis, b.normal);
      for (let i = 0; i < COINS; i++) {
        const c = b.coins[i]!;
        if (i >= b.count) { pool.coins.setMatrixAt(bi * COINS + i, pool.zero); continue; }
        const h = Math.max(0, c.up * age - 0.5 * c.g * age * age);
        p.copy(b.origin).addScaledVector(c.side, c.speed * age).addScaledVector(b.normal, h + COIN_R * 0.6);
        q.setFromAxisAngle(c.axis, c.spin * age).premultiply(up);
        const shrink = Math.min(1, (LIFE_S - age) / 0.25);
        m.compose(p, q, sc.setScalar(Math.max(0.001, shrink)));
        pool.coins.setMatrixAt(bi * COINS + i, m);
      }
      dirty = true;
    });
    if (dirty) pool.coins.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={pool.group} />;
}
