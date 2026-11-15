// Lane b: harbours on the globe (piers, quays, cranes, boats by era). Mount inside ProvinceMeshContext.
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../../state/world';
import { useProvinceMesh } from '../../mesh/context';
import { TileGeos } from '../placement';
import { PortLayer } from './PortLayer';
import { lodCamera, pipDetail } from '../../pip/pipLod';
import { WORLD_SYNC_S } from '../../constants';
import { onOccupancy } from '../occupancy';

export function Ports() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const worldKey = world ? `${world.id}:${world.seed}:${world.tiles.length}` : null;
  const layer = useRef<PortLayer | null>(null);
  const stale = useRef(false);
  const syncedAt = useRef(-1e9);
  const [group, setGroup] = useState<PortLayer['group'] | null>(null);

  useEffect(() => {
    const w = useWorld.getState().world;
    if (!mesh || !w || !worldKey) return;
    const l = new PortLayer(new TileGeos(w, mesh.heights));
    layer.current = l;
    stale.current = true;
    syncedAt.current = -1e9;
    setGroup(l.group);
    const unsub = useWorld.subscribe((s, prev) => { if (s.version !== prev.version || s.world !== prev.world) stale.current = true; });
    const offPip = pipDetail(l.group);
    const offOcc = onOccupancy(() => { stale.current = true; });
    return () => { offOcc(); offPip(); unsub(); l.dispose(); layer.current = null; setGroup(null); };
  }, [mesh, worldKey]);

  useFrame(({ camera, clock }) => {
    const l = layer.current;
    if (!l) return;
    const now = clock.elapsedTime;
    const dist = lodCamera(camera).position.length();
    // Out of sight nothing is read or packed; the harbours catch up when the close-up comes back.
    if (stale.current && dist < 2.2 && now - syncedAt.current >= WORLD_SYNC_S) {
      stale.current = false;
      syncedAt.current = now;
      const w = useWorld.getState().world;
      if (w) l.sync(w);
    }
    l.update(dist);
  });

  return group ? <primitive object={group} /> : null;
}
