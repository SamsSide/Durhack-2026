import { mockWorld } from '@terra/shared';
import { buildProvinceMesh } from '../src/globe/mesh/buildProvinceMesh';

const world = mockWorld();
const m = buildProvinceMesh(world);
const n = world.tiles.length;
const verts = m.geometry.getAttribute('position').count;
let ok = m.triangleToTile.length === verts / 3;
for (const t of m.triangleToTile) if (t < 0 || t >= n) ok = false;
for (let i = 0; i < n; i++) if (m.tileVertexCount[i]! <= 0) ok = false;
console.log(`tiles ${n} vertices ${verts} triangles ${verts / 3} edges ${m.edges.length} picks-ok ${ok}`);
