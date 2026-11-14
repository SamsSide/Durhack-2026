// "Signal lost" tags at cut capitals and a small A at autopilot ones. Lane b (B7).
import { useMemo } from 'react';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { Anchor } from './Anchor';
import { capitalPoint } from './geo';

function SignalLost({ countryId, pos }: { countryId: number; pos: [number, number, number] }) {
  const years = useWorld((s) => {
    const a = s.agents.find((x) => x.countryId === countryId);
    return s.world && a ? Math.max(0, s.world.tick - a.lastHeardTick) : 0;
  });
  return (
    <Anchor pos={pos} dy={34}>
      <div className="gs-tag cut">
        <span className="cap">Signal lost</span>
        <span className="yrs">silent {years} {years === 1 ? 'yr' : 'yrs'}</span>
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
    const out: { key: string; id: number; kind: 'cut' | 'auto'; pos: [number, number, number] }[] = [];
    for (const r of living) {
      const pos = capitalPoint(mesh, world, r.id);
      if (!pos) continue;
      if (r.st === 'cut') out.push({ key: `c${r.id}`, id: r.id, kind: 'cut', pos });
      else if (r.ruler === 'autopilot' && showAuto) out.push({ key: `a${r.id}`, id: r.id, kind: 'auto', pos });
    }
    return out;
  }, [mesh, world, sig, live]);

  return (
    <>
      {items.map((it) => it.kind === 'cut'
        ? <SignalLost key={it.key} countryId={it.id} pos={it.pos} />
        : <Anchor key={it.key} pos={it.pos} dx={13} dy={-12}><div className="gs-auto" title="On autopilot">A</div></Anchor>)}
    </>
  );
}
