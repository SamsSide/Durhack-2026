// Lane b, row B4: instanced structures and trees on the globe. Mount inside ProvinceMeshContext.
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { ensureStyles, loadModels, stylesInUse } from './models';
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
    let live = true;
    let f: StructureField | null = null;
    let unsub: (() => void) | null = null;
    // Fetch only the styles this world's living nations use (cached after the first time), then build.
    const { styles, nomadic } = stylesInUse(world.countries);
    void ensureStyles(models, styles, nomadic).then(() => {
      if (!live) return;
      f = new StructureField(world, new TileGeos(world, mesh.heights), models);
      field.current = f;
      stale.current = true;
      setGroup(f.group);
      // A nation founded mid-run can bring a style that is not loaded yet: on a version bump, if the set of
      // styles in use grew, fetch the new ones and re-pool every structure.
      let sig = [...styles].sort().join(',') + (nomadic ? '+n' : '');
      unsub = useWorld.subscribe((s, prev) => {
        if (s.version === prev.version) return;
        stale.current = true;
        if (!s.world) return;
        const now = stylesInUse(s.world.countries);
        const next = [...now.styles].sort().join(',') + (now.nomadic ? '+n' : '');
        if (next === sig) return;
        sig = next;
        void ensureStyles(models, now.styles, now.nomadic).then(() => { if (live) { f?.refreshModels(); stale.current = true; } });
      });
    });
    return () => { live = false; unsub?.(); f?.dispose(); field.current = null; setGroup(null); };
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
