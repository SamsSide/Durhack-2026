// Pointer picking and hover on the province mesh (mesh object must be named "provinces"). Lane b.
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { create } from 'zustand';
import { useWorld } from '../../state/world';
import { CLOSE } from '../constants';
import { useProvinceMesh } from '../mesh/context';
import { armyPicker } from '../units/pick';

/** The tile under the cursor (-1 for none or ocean). Read by HoverHighlight. */
export const useHover = create<{ tile: number }>(() => ({ tile: -1 }));

const DRAG_PX = 5;

export function Picking(): null {
  const mesh = useProvinceMesh();
  const dom = useThree((s) => s.gl.domElement);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    if (!mesh) return;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pickTile = (clientX: number, clientY: number): number => {
      const obj = scene.getObjectByName('provinces');
      if (!obj) return -1;
      const r = dom.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObject(obj, false)[0];
      if (!hit || hit.faceIndex == null) return -1;
      return mesh.triangleToTile[hit.faceIndex] ?? -1;
    };
    (dom as unknown as { __pickTile?: typeof pickTile }).__pickTile = pickTile;

    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button === 0) down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved >= DRAG_PX) return;
      const s = useWorld.getState();
      const w = s.world;
      if (!w) return;
      // #311: an army's counter or formation wins over the province under it
      const r = dom.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const army = armyPicker.current?.(ndc.clone(), camera, r.width, r.height) ?? null;
      if (army) { s.selectUnit(army); return; }
      const tile = pickTile(e.clientX, e.clientY);
      const owner = tile >= 0 ? w.owner[tile] ?? -1 : -1;
      if (tile < 0 || owner < 0) { s.select(null); return; }
      s.select(owner, tile);
      // select() already sets selectedRegionId; only keep it when the camera is close.
      if (camera.position.length() >= CLOSE) useWorld.setState({ selectedRegionId: null });
    };
    const onDouble = (e: MouseEvent) => {
      const w = useWorld.getState().world;
      if (!w) return;
      const tile = pickTile(e.clientX, e.clientY);
      const owner = tile >= 0 ? w.owner[tile] ?? -1 : -1;
      if (owner >= 0) useWorld.getState().flyTo(owner);
    };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('dblclick', onDouble);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('dblclick', onDouble);
      delete (dom as unknown as { __pickTile?: unknown }).__pickTile;
    };
  }, [mesh, dom, scene, camera]);

  // Hover: one raycast per frame at most, only when the pointer moved.
  useEffect(() => {
    let pos: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => { pos = { x: e.clientX, y: e.clientY }; hoverDirty.current = true; };
    const onLeave = () => { pos = null; hoverDirty.current = false; useHover.setState({ tile: -1 }); dom.style.cursor = ''; };
    hoverPos.get = () => pos;
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerleave', onLeave);
    return () => {
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerleave', onLeave);
      useHover.setState({ tile: -1 });
      dom.style.cursor = '';
    };
  }, [dom]);

  useFrame(() => {
    if (!mesh || !hoverDirty.current) return;
    hoverDirty.current = false;
    const pos = hoverPos.get();
    const pick = (dom as unknown as { __pickTile?: (x: number, y: number) => number }).__pickTile;
    const w = useWorld.getState().world;
    if (!pos || !pick || !w) return;
    let tile = pick(pos.x, pos.y);
    if (tile >= 0 && w.tiles[tile]?.terrain === 'ocean') tile = -1;
    if (useHover.getState().tile !== tile) useHover.setState({ tile });
    dom.style.cursor = tile >= 0 && (w.owner[tile] ?? -1) >= 0 ? 'pointer' : '';
  });

  return null;
}

const hoverDirty = { current: false };
const hoverPos: { get: () => { x: number; y: number } | null } = { get: () => null };

/** Alias for callers that prefer a hook-style name. */
export const usePicking = Picking;
