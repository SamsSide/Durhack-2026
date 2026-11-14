// Lane b, row A30 on the globe: wonders. A big model on the wonder's tile (2 tiles wide, still bigger than a
// capital from orbit), scaffolding and dust while it is built, a gilt beam, ring and sparks when it is done, and
// the Great Wall drawn along the nation's borders. Mount inside ProvinceMeshContext.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import type { ProvinceMesh } from '../mesh/buildProvinceMesh';
import { CLOSE } from '../constants';
import { TileGeos, hash01, smoothstep, clamp01 } from '../structures/placement';
import type { TileGeo } from '../structures/placement';
import { useEventStream } from '../status/useEventStream';
import { BUILD_TICKS, demoWonder, syncWonders, useWonders, wonderEvents } from './store';
import type { WonderRec } from './store';
import { fallbackModel, wonderModel } from './models';
import type { WonderModel } from './models';
import { partsHeight, scaffoldGeometry } from './fallback';
import { buildWall } from './greatWall';
import { isWonderKind } from './types';

const SIZE_TILES = 2;      // a wonder is about 2 tiles wide (a capital fills about 1)
const MAX_SIZE = 0.14;     // absolute cap, times the surface radius (2x the structures cap)
const ORBIT_BOOST = 1.3;   // capitals get 1.15 from orbit; this keeps a wonder about 2.3x a capital there
const STEPS = 8;           // the build rises in this many courses
const REVEAL_S = 3.2;
const GILT = '#e8c45a';
const SPARKS = 90;

/** Build progress 0..1 for a wonder, before stepping. */
function progress(r: WonderRec, nowMs: number, tick: number | undefined): number {
  if (r.complete) return 1;
  if (r.demo && r.demoMs) return clamp01((nowMs - r.startMs) / r.demoMs);
  if (r.startTick != null && typeof tick === 'number') return Math.min(0.96, clamp01((tick - r.startTick) / BUILD_TICKS));
  const t = (nowMs - r.startMs) / 1000; // no duration known: a gentle loop
  return 0.2 + 0.6 * (0.5 - 0.5 * Math.cos(t * 0.35));
}
function stepped(p: number): number {
  if (p >= 1) return 1;
  const q = p * STEPS, k = Math.floor(q);
  return Math.max(0.03, (k + smoothstep(0.55, 1, q - k)) / STEPS);
}

export function Wonders() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const list = useWonders((s) => s.list);
  const gl = useThree((s) => s.gl);

  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  // Keep the store in step with the world and the event stream.
  useEffect(() => {
    syncWonders(useWorld.getState().world);
    return useWorld.subscribe((s, prev) => { if (s.version !== prev.version || s.world !== prev.world) syncWonders(s.world); });
  }, []);
  useEventStream((events) => wonderEvents(useWorld.getState().world, events));

  // Dev helper: window.__wonderDemo(countryId, kind, ms?) plays a fake start then build, locally only.
  useEffect(() => {
    const w = window as unknown as { __wonderDemo?: (c: number, k?: string, ms?: number) => string | null };
    w.__wonderDemo = (countryId, kind = 'pyramid', ms = 12000) => {
      if (!isWonderKind(kind)) { console.warn('__wonderDemo: kind is one of great_wall, mausoleum, pyramid, colossus, cathedral, palace_of_soviets, skyscraper, space_elevator'); return null; }
      return demoWonder(useWorld.getState().world, Number(countryId), kind, ms);
    };
    return () => { delete w.__wonderDemo; };
  }, []);

  const geos = useMemo(() => (world && mesh ? new TileGeos(world, mesh.heights) : null), [world, mesh]);
  if (!world || !mesh || !geos) return null;
  return (
    <group name="wonders">
      {list.map((r) => (r.tile >= 0 && r.tile < world.tiles.length
        ? <Wonder key={r.id} rec={r} geo={geos.get(r.tile)} mesh={mesh} />
        : null))}
    </group>
  );
}

function Wonder({ rec, geo, mesh }: { rec: WonderRec; geo: TileGeo; mesh: ProvinceMesh }) {
  const [model, setModel] = useState<WonderModel>(() => fallbackModel(rec.kind));
  useEffect(() => {
    let live = true;
    void wonderModel(rec.kind).then((m) => { if (live) setModel(m); });
    return () => { live = false; };
  }, [rec.kind]);
  const team = useWorld((s) => s.world?.countries[rec.owner]?.color ?? '#c9a24b');

  // The scene graph: anchor on the tile, a scaled model inside, then scaffold, dust and reveal effects.
  const built = useMemo(() => {
    const anchor = new THREE.Group();
    anchor.position.copy(geo.n).multiplyScalar(geo.h);
    anchor.quaternion.copy(geo.align).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(rec.id, 5) * Math.PI * 2));
    const body = new THREE.Group();
    anchor.add(body);
    const plane = new THREE.Plane();
    const height = partsHeight(model.parts);
    const mats: THREE.Material[] = [];
    for (const p of model.parts) {
      const m = p.material.clone();
      if (p.team && 'color' in m) (m as THREE.MeshStandardMaterial).color.set(team);
      m.clippingPlanes = [plane];
      mats.push(m);
      const mm = new THREE.Mesh(p.geometry, m);
      mm.castShadow = false;
      body.add(mm);
    }
    // Scaffolding, clipped a little above the courses already laid.
    const scafPlane = new THREE.Plane();
    const scafMat = new THREE.LineBasicMaterial({ color: '#8a6a45', transparent: true, opacity: 0.9, clippingPlanes: [scafPlane] });
    const scafGeo = scaffoldGeometry(height);
    const scaffold = new THREE.LineSegments(scafGeo, scafMat);
    body.add(scaffold);
    // Dust puffs round the base.
    const dustGeo = new THREE.IcosahedronGeometry(0.09, 0);
    const dust: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: '#cdbb9b', transparent: true, opacity: 0, depthWrite: false }));
      body.add(d);
      dust.push(d);
    }
    // Reveal: beam, ring and sparks.
    const beamGeo = new THREE.CylinderGeometry(0.16, 0.34, 1, 20, 1, true).translate(0, 0.5, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: GILT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    const ringGeo = new THREE.RingGeometry(0.88, 1, 56).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: GILT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.04;
    const sparkPos = new Float32Array(SPARKS * 3), sparkCol = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3);
    const colours = [GILT, '#fff4d2', team, '#e0533d', '#5fc8d8', GILT].map((c) => new THREE.Color(c));
    for (let i = 0; i < SPARKS; i++) {
      const a = hash01(rec.id, 100 + i) * Math.PI * 2, r = 0.6 + 1.6 * hash01(rec.id, 300 + i);
      sparkVel[i * 3] = Math.cos(a) * r; sparkVel[i * 3 + 1] = 1.6 + 2.4 * hash01(rec.id, 500 + i); sparkVel[i * 3 + 2] = Math.sin(a) * r;
      const c = colours[i % colours.length]!;
      sparkCol[i * 3] = c.r; sparkCol[i * 3 + 1] = c.g; sparkCol[i * 3 + 2] = c.b;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    const sparkMat = new THREE.PointsMaterial({ size: 1, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    sparks.frustumCulled = false;
    const fx = new THREE.Group();
    fx.add(beam, ring, sparks);
    fx.visible = false;
    body.add(fx);
    const dispose = () => {
      for (const m of mats) m.dispose();
      scafMat.dispose(); scafGeo.dispose(); dustGeo.dispose();
      for (const d of dust) (d.material as THREE.Material).dispose();
      beamGeo.dispose(); beamMat.dispose(); ringGeo.dispose(); ringMat.dispose(); sparkGeo.dispose(); sparkMat.dispose();
    };
    return { anchor, body, plane, scafPlane, height, scaffold, dust, fx, beam, beamMat, ring, ringMat, sparks, sparkMat, sparkPos, sparkVel, dispose };
  }, [model, geo, rec.id, team]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => built.dispose(), [built]);

  const f = useRef(0);
  const v = useMemo(() => ({ up: new THREE.Vector3(), pt: new THREE.Vector3() }), []);
  useFrame(({ camera }, dt) => {
    const b = built;
    const nowMs = performance.now();
    const target = smoothstep(CLOSE + 0.2, CLOSE - 0.2, camera.position.length());
    f.current += (target - f.current) * Math.min(1, Math.min(dt, 0.1) * 7);
    const base = Math.min(SIZE_TILES * geo.width, MAX_SIZE * geo.h);
    const s = base * (1 + (ORBIT_BOOST - 1) * (1 - f.current));
    b.body.scale.setScalar(s);
    b.anchor.updateMatrixWorld(true);

    const p = stepped(progress(rec, nowMs, useWorld.getState().world?.tick));
    const building = p < 1;
    // Clip planes in world space: keep what is below the current course.
    v.up.set(0, 1, 0).transformDirection(b.body.matrixWorld);
    v.pt.set(0, p * b.height + (building ? 0 : 50), 0).applyMatrix4(b.body.matrixWorld);
    b.plane.setFromNormalAndCoplanarPoint(v.up.clone().negate(), v.pt);
    v.pt.set(0, Math.min(p * b.height + 0.12, 1.4), 0).applyMatrix4(b.body.matrixWorld);
    b.scafPlane.setFromNormalAndCoplanarPoint(v.up.clone().negate(), v.pt);
    b.scaffold.visible = building;

    // Dust: puffs rise and fade round the base while it is built.
    const t = nowMs / 1000;
    b.dust.forEach((d, i) => {
      d.visible = building;
      if (!building) return;
      const ph = (t * 0.6 + i / b.dust.length) % 1;
      const a = hash01(rec.id, 20 + i) * Math.PI * 2 + Math.floor(t * 0.6 + i / b.dust.length) * 1.7;
      const r = 0.45 + 0.2 * hash01(rec.id, 30 + i);
      d.position.set(Math.cos(a) * r, 0.04 + ph * 0.3, Math.sin(a) * r);
      d.scale.setScalar(0.6 + ph * 1.4);
      (d.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.sin(ph * Math.PI);
    });

    // Reveal: beam up, ring out, sparks thrown and falling.
    const since = rec.builtMs != null ? (nowMs - rec.builtMs) / 1000 : Infinity;
    const on = since >= 0 && since < REVEAL_S;
    b.fx.visible = on;
    if (on) {
      const fade = 1 - smoothstep(REVEAL_S - 1.2, REVEAL_S, since);
      b.beamMat.opacity = 0.75 * smoothstep(0, 0.25, since) * fade;
      b.beam.scale.set(1 + 0.15 * Math.sin(since * 12), 14 * smoothstep(0, 0.5, since), 1 + 0.15 * Math.sin(since * 12));
      const rt = clamp01(since / 1.6);
      b.ring.scale.setScalar(0.4 + 3.6 * (1 - (1 - rt) * (1 - rt)));
      b.ringMat.opacity = 0.9 * (1 - rt);
      const st = Math.max(0, since - 0.15);
      for (let i = 0; i < SPARKS; i++) {
        const vx = b.sparkVel[i * 3]!, vy = b.sparkVel[i * 3 + 1]!, vz = b.sparkVel[i * 3 + 2]!;
        b.sparkPos[i * 3] = vx * st * 0.6;
        b.sparkPos[i * 3 + 1] = Math.max(0.02, 0.5 + vy * st - 1.8 * st * st);
        b.sparkPos[i * 3 + 2] = vz * st * 0.6;
      }
      (b.sparks.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      b.sparkMat.size = s * 0.09;
      b.sparkMat.opacity = since < 0.15 ? 0 : fade;
    }
  });

  return (
    <>
      <primitive object={built.anchor} />
      {rec.kind === 'great_wall' && <GreatWall rec={rec} geo={geo} mesh={mesh} team={team} />}
    </>
  );
}

/** The wall along the owner's land borders, growing outward from the wonder while it is built. */
function GreatWall({ rec, geo, mesh, team }: { rec: WonderRec; geo: TileGeo; mesh: ProvinceMesh; team: string }) {
  // Rebuild when the borders move, at most every couple of seconds.
  const version = useWorld((s) => s.version);
  const [ver, setVer] = useState(version);
  useEffect(() => {
    const id = window.setTimeout(() => setVer(version), 2000);
    return () => window.clearTimeout(id);
  }, [version]);
  const wall = useMemo(() => {
    const w = useWorld.getState().world;
    if (!w) return null;
    const { geometry, ends } = buildWall(w, mesh, rec.owner, rec.tile, geo.width, team);
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, side: THREE.DoubleSide });
    const obj = new THREE.Mesh(geometry, material);
    obj.frustumCulled = false;
    return { obj, ends, geometry, material };
  }, [mesh, rec.owner, rec.tile, geo.width, team, ver]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { wall?.geometry.dispose(); wall?.material.dispose(); }, [wall]);

  useFrame(() => {
    if (!wall || !wall.ends.length) return;
    const p = progress(rec, performance.now(), useWorld.getState().world?.tick);
    const n = Math.max(1, Math.ceil(wall.ends.length * p));
    wall.geometry.setDrawRange(0, wall.ends[Math.min(n, wall.ends.length) - 1]!);
  });

  return wall ? <primitive object={wall.obj} /> : null;
}
