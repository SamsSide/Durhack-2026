// The living world: ambient life on the globe (boats, carts, herds, smoke, birds, surf, lit windows).
// Mount inside the ProvinceMeshContext provider. Lane a in lane b's globe (owner decision, 14 Nov).
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../state/world';
import { clockNow } from '../../state/calendar';
import { useProvinceMesh } from '../mesh/context';
import { LivingLayer } from './LivingLayer';
import { lodCamera, pipDetail } from '../pip/pipLod';

export function Living() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const worldKey = world ? `${world.id}:${world.seed}:${world.tiles.length}` : null;
  const ref = useRef<LivingLayer | null>(null);
  const stale = useRef(false);
  const [layer, setLayer] = useState<LivingLayer | null>(null);

  useEffect(() => {
    const w = useWorld.getState().world;
    if (!mesh || !w || !worldKey) return;
    const l = new LivingLayer(w, mesh);
    ref.current = l;
    setLayer(l);
    if (import.meta.env.DEV) (window as unknown as { __terraLiving?: LivingLayer }).__terraLiving = l; // dev only: stats, enabled
    const unsub = useWorld.subscribe((s, prev) => { if (s.version !== prev.version || s.world !== prev.world) stale.current = true; });
    const offPip = pipDetail(l.group); // the news PiP may show the living world while the main view is in orbit
    return () => {
      offPip();
      unsub();
      if (ref.current === l) ref.current = null;
      setLayer((cur) => (cur === l ? null : cur));
      l.dispose();
    };
  }, [mesh, worldKey]);

  const lastSync = useRef(0);
  useFrame(({ camera, size }, dt) => {
    const l = ref.current;
    if (!l) return;
    const now = performance.now();
    // the world changes many times a second at high speed: look again at most every 700 ms
    if (stale.current && now - lastSync.current > 700) {
      stale.current = false;
      lastSync.current = now;
      const w = useWorld.getState().world;
      if (w) l.rebuild(w);
    }
    l.update(lodCamera(camera), Math.min(dt, 0.1), clockNow().paused, size.height);
  });

  return layer ? <primitive object={layer.group} /> : null;
}
