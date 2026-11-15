// Lane b: every harbour on the globe in three draw calls (boxes, cylinders, cones). A harbour is built once per
// structure and rebuilt only when what it looks like changes: its nation's era, the ocean side it faces, or the
// space other structures leave on its tile. Packed into the instance buffers only when a harbour changed.
import * as THREE from 'three';
import type { World } from '@terra/shared';
import type { TileGeos } from '../placement';
import { setFeet } from '../occupancy';
import { isRuinedTile } from '../../war/ruins';
import { buildPort, oceanNeighbour, spaceSig } from './buildPort';
import type { PortParts } from './buildPort';
import { PORT_FADE_FAR, portEra } from './portStyle';
import type { PartBuf } from '../../towns/buildTown';

const SETTLEMENTS = new Set<string>(['village', 'town', 'city', 'capital']);
const KINDS = ['boxes', 'cyls', 'cones'] as const;
type Kind = typeof KINDS[number];

interface Harbour { key: string; tile: number; parts: PortParts }

export class PortLayer {
  readonly group = new THREE.Group();
  private harbours = new Map<string, Harbour>();
  private meshes = {} as Record<Kind, THREE.InstancedMesh>;
  private dirty = true;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(private tileGeos: TileGeos) {
    this.group.name = 'ports';
    const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.85, metalness: 0 });
    const geos: Record<Kind, THREE.BufferGeometry> = {
      boxes: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      cyls: new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0),
      cones: new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0),
    };
    for (const k of KINDS) {
      const mesh = new THREE.InstancedMesh(geos[k], mat, 64);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.setColorAt(0, this.c.set(1, 1, 1));
      this.meshes[k] = mesh;
      this.group.add(mesh);
    }
    this.group.visible = false;
  }

  /** Add, rebuild or retire harbours to match the world. Cheap when nothing changed. */
  sync(world: World): void {
    const seen = new Set<string>();
    // One harbour per tile: a port wins over a town on the same tile.
    const byTile = new Map<number, { id: string; kind: string; owner: number }>();
    for (const s of world.structures) {
      if (s.kind !== 'port' && !SETTLEMENTS.has(s.kind)) continue;
      if (!world.tiles[s.tile] || isRuinedTile(s.tile)) continue;
      const have = byTile.get(s.tile);
      if (!have || (s.kind === 'port' && have.kind !== 'port')) byTile.set(s.tile, { id: s.id, kind: s.kind, owner: s.owner });
    }
    for (const [tile, s] of byTile) {
      const ocean = oceanNeighbour(world, tile, s.id);
      if (ocean < 0) continue;
      const fid = `harbour:${s.id}`;
      const era = portEra(world.countries[s.owner]?.techAge);
      const small = s.kind !== 'port';
      const key = `${s.kind}|${era}|${ocean}|${spaceSig(tile, fid)}`;
      seen.add(s.id);
      const had = this.harbours.get(s.id);
      if (had?.key === key) { if (had.parts.foot) setFeet(tile, fid, [had.parts.foot]); continue; } // re-assert after a world clear
      const st = world.structures.find((x) => x.id === s.id)!;
      const parts = buildPort(world, st, this.tileGeos.get(tile), ocean, era, small, fid);
      this.harbours.set(s.id, { key, tile, parts });
      setFeet(tile, fid, parts.foot ? [parts.foot] : null);
      this.dirty = true;
    }
    for (const [id, h] of this.harbours) {
      if (seen.has(id)) continue;
      setFeet(h.tile, `harbour:${id}`, null);
      this.harbours.delete(id);
      this.dirty = true;
    }
  }

  /** Shown only in the close-up, with the towns. Packs the buffers once the harbours changed and are in view. */
  update(camDist: number): void {
    this.group.visible = camDist < PORT_FADE_FAR && this.harbours.size > 0;
    if (this.group.visible && this.dirty) this.write();
  }

  private write(): void {
    this.dirty = false;
    for (const k of KINDS) {
      let need = 0;
      for (const h of this.harbours.values()) need += h.parts[k].count;
      let mesh = this.meshes[k];
      if (need > mesh.instanceMatrix.count) {
        let cap = mesh.instanceMatrix.count;
        while (cap < need) cap *= 2;
        const old = mesh;
        mesh = new THREE.InstancedMesh(old.geometry, old.material, cap);
        mesh.frustumCulled = false;
        mesh.setColorAt(0, this.c.set(1, 1, 1));
        this.group.remove(old); old.dispose();
        this.group.add(mesh);
        this.meshes[k] = mesh;
      }
      let i = 0;
      for (const h of this.harbours.values()) i = this.pack(mesh, h.parts[k], i);
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private pack(mesh: THREE.InstancedMesh, buf: PartBuf, start: number): number {
    const n = buf.count;
    for (let j = 0; j < n; j++) {
      const t = buf.tr, o = j * 10;
      this.p.set(t[o]!, t[o + 1]!, t[o + 2]!);
      this.q.set(t[o + 3]!, t[o + 4]!, t[o + 5]!, t[o + 6]!);
      this.s.set(t[o + 7]!, t[o + 8]!, t[o + 9]!);
      mesh.setMatrixAt(start + j, this.m.compose(this.p, this.q, this.s));
      mesh.setColorAt(start + j, this.c.setRGB(buf.col[j * 3]!, buf.col[j * 3 + 1]!, buf.col[j * 3 + 2]!));
    }
    return start + n;
  }

  dispose(): void {
    for (const [id, h] of this.harbours) setFeet(h.tile, `harbour:${id}`, null);
    this.harbours.clear();
    for (const k of KINDS) { this.meshes[k].geometry.dispose(); }
    (this.meshes.boxes.material as THREE.Material).dispose();
    for (const k of KINDS) this.meshes[k].dispose();
  }
}
