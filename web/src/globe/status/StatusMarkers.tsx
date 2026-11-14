// "Signal lost" tags at cut capitals and a small A at autopilot ones. Lane b (B7).
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useWorld } from '../../state/world';
import { LetterPile } from '../show/LetterPile';
import { useProvinceMesh } from '../mesh/context';
import { Anchor } from './Anchor';
import { capitalPoint } from './geo';
import { STACK, cityKey } from './cityStack';

const FAR = 2.5;       // camera distance past which a cut tag shrinks to its letter pile
const LIMB = 0.3;      // cut tags hide well before the horizon (a blackout cuts every nation)

// One marker per cut nation (B14): the sealed-letter pile and "SIGNAL LOST / silent 42 yrs · 49 queued".
function SignalLost({ countryId, pos }: { countryId: number; pos: [number, number, number] }) {
  const [years, queued] = useWorld((s) => {
    const a = s.agents.find((x) => x.countryId === countryId);
    return `${s.world && a ? Math.max(0, s.world.tick - a.lastHeardTick) : 0}:${a?.pendingEvents ?? 0}`;
  }).split(':').map(Number) as [number, number];
  const ref = useRef<HTMLDivElement>(null);
  useFrame(({ camera }) => { ref.current?.classList.toggle('far', camera.position.length() > FAR); });
  return (
    <Anchor pos={pos} dy={34} limb={LIMB}>
      <div ref={ref} className="gs-cut">
        <LetterPile count={queued} />
        <div className="tn-plate gs-tag cut">
          <span className="cap">Signal lost</span>
          <span className="yrs">silent {years} {years === 1 ? 'yr' : 'yrs'}{queued > 0 ? ` · ${queued} queued` : ''}</span>
        </div>
      </div>
    </Anchor>
  );
}

export function StatusMarkers() {
  const mesh = useProvinceMesh();
  const world = useWorld((s) => s.world);
  const live = useWorld((s) => s.budget?.mode === 'live');
  // A string signature keeps the 1 s agents heartbeat from re-rendering anything.
  const sig = useWorld((s) => s.agents.map((a) => `${a.countryId}:${a.deleted ? 'd' : a.link}:${a.ruler}`).join('|'));

  const items = useMemo(() => {
    if (!mesh || !world || !sig) return [];
    const rows = sig.split('|').map((r) => { const [id, st, ruler] = r.split(':'); return { id: Number(id), st: st!, ruler: ruler! }; });
    const living = rows.filter((r) => r.st !== 'd');
    const auto = living.filter((r) => r.ruler === 'autopilot').length;
    // Autopilot is the default in the mock, so it only shows in live mode or when it is the odd one out.
    const showAuto = live || auto * 2 < living.length;
    const out: { key: string; id: number; kind: 'cut' | 'auto'; tile: number; pos: [number, number, number] }[] = [];
    for (const r of living) {
      const pos = capitalPoint(mesh, world, r.id);
      if (!pos) continue;
      if (r.st === 'cut') out.push({ key: `c${r.id}`, id: r.id, kind: 'cut', tile: cityKey(world, r.id), pos });
      else if (r.ruler === 'autopilot' && showAuto) out.push({ key: `a${r.id}`, id: r.id, kind: 'auto', tile: cityKey(world, r.id), pos });
    }
    return out;
  }, [mesh, world, sig, live]);

  return (
    <>
      {items.map((it) => it.kind === 'cut'
        ? <SignalLost key={it.key} countryId={it.id} pos={it.pos} />
        : <Anchor key={it.key} pos={it.pos} stack={{ tile: it.tile, priority: STACK.auto }}><div className="gs-auto" title="On autopilot">A</div></Anchor>)}
    </>
  );
}
