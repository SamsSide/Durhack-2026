// Lane b, row B4: instanced structures and trees on the globe. Mount inside ProvinceMeshContext.
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { loadModels } from './models';
import type { ModelSet } from './models';
import { TileGeos } from './placement';
import { StructureField } from './StructureField';

export function Structures() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const [models, setModels] = useState<ModelSet | null>(null);
  const field = useRef<StructureField | null>(null);
  const stale = useRef(true);
  const [group, setGroup] = useState<StructureField['group'] | null>(null);

  useEffect(() => {
    let live = true;
    loadModels().then((m) => { if (live) setModels(m); }, (err) => console.warn('structures: model load failed', err));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!mesh || !world || !models) return;
    const f = new StructureField(world, new TileGeos(world, mesh.heights), models);
    field.current = f;
    stale.current = true;
    setGroup(f.group);
    const unsub = useWorld.subscribe((s, prev) => { if (s.version !== prev.version) stale.current = true; });
    return () => { unsub(); f.dispose(); field.current = null; setGroup(null); };
  }, [mesh, world, models]);

  useFrame(({ camera, clock }, dt) => {
    const f = field.current;
    if (!f) return;
    const now = clock.elapsedTime;
    if (stale.current) { stale.current = false; f.sync(now); }
    f.update(now, Math.min(dt, 0.1), camera.position.length());
  });

  return group ? <primitive object={group} /> : null;
}
