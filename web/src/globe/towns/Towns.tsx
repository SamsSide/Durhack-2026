// Lane b: close-up towns (street grid, houses, walls, a river through river cities). Mount inside ProvinceMeshContext.
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { TileGeos } from '../structures/placement';
import { TownLayer } from './TownLayer';
import { lodCamera, pipDetail } from '../pip/pipLod';
import { WORLD_SYNC_S } from '../constants';
import { onOccupancy } from '../structures/occupancy';
import type { TechAge } from '@terra/shared';

export function Towns() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const worldKey = world ? `${world.id}:${world.seed}:${world.tiles.length}` : null;
  const layer = useRef<TownLayer | null>(null);
  const stale = useRef(false);
  const syncedAt = useRef(-1e9);
  const initial = useRef(true);
  const [group, setGroup] = useState<TownLayer['group'] | null>(null);

  // Tiles never change for a world: one layer per world, synced on every version bump.
  useEffect(() => {
    const w = useWorld.getState().world;
    if (!mesh || !w || !worldKey) return;
    const l = new TownLayer(new TileGeos(w, mesh.heights));
    layer.current = l;
    initial.current = true;
    stale.current = true;
    syncedAt.current = -1e9;
    setGroup(l.group);
    const unsub = useWorld.subscribe((s, prev) => { if (s.version !== prev.version || s.world !== prev.world) stale.current = true; });
    const offPip = pipDetail(l.group); // the news PiP may show the towns while the main view is in orbit
    const offOcc = onOccupancy(() => { stale.current = true; }); // a landmark moved in or out: clear its squares
    return () => { offOcc(); offPip(); unsub(); l.dispose(); layer.current = null; setGroup(null); };
  }, [mesh, worldKey]);

  // Dev only: window.__townAge(countryId, age) sets a nation's tech age locally, to watch its towns modernise.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __townAge?: (id: number, age: TechAge) => string | null };
    w.__townAge = (id, age) => {
      const s = useWorld.getState();
      const c = s.world?.countries[Number(id)];
      if (!c) return null;
      c.techAge = age;
      useWorld.setState({ version: s.version + 1 });
      return `${c.name}: ${age}`;
    };
    return () => { delete w.__townAge; };
  }, []);

  useFrame(({ camera, clock }, dt) => {
    const l = layer.current;
    if (!l) return;
    const now = clock.elapsedTime;
    if (stale.current && now - syncedAt.current >= WORLD_SYNC_S) {
      stale.current = false;
      syncedAt.current = now;
      const w = useWorld.getState().world;
      if (w) { l.sync(w, now, initial.current); initial.current = false; }
    }
    l.update(now, Math.min(dt, 0.1), lodCamera(camera).position.length());
  });

  return group ? <primitive object={group} /> : null;
}
