// B5: armies and war on the globe. Mount inside the ProvinceMeshContext provider. Lane b.
import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { useEventStream } from '../status/useEventStream';
import { UnitLayer } from './UnitLayer';
import { armyPicker } from './pick';

export function Units() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const [layer, setLayer] = useState<UnitLayer | null>(null);
  const ref = useRef<UnitLayer | null>(null);

  // Events first (this listener subscribes before the version listener below), then the units.
  useEventStream((events) => ref.current?.onEvents(events));

  // The layer is made and disposed inside one effect, so a double-run effect never reuses a dead one.
  useEffect(() => {
    if (!mesh || !world) return;
    const l = new UnitLayer(mesh, world);
    ref.current = l;
    setLayer(l);
    if (import.meta.env.DEV) (window as unknown as { __units?: UnitLayer }).__units = l; // dev only: lets a browser review read the marches
    l.sync();
    armyPicker.current = (ndc, camera, w, h) => l.pickArmy(camera, ndc, w, h);
    let seen = useWorld.getState().version;
    const unsub = useWorld.subscribe((s) => {
      if (s.version === seen) return;
      seen = s.version;
      l.sync();
    });
    return () => {
      unsub();
      armyPicker.current = null;
      if (ref.current === l) ref.current = null;
      setLayer((cur) => (cur === l ? null : cur));
      l.dispose();
    };
  }, [mesh, world]);

  useFrame(({ camera, size }) => ref.current?.update(camera, performance.now(), size.width, size.height));

  return layer ? <primitive object={layer.group} /> : null;
}
