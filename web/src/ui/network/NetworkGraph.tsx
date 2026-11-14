import { flagSvg } from '@terra/shared';
import type { AgentStatus, Country } from '@terra/shared';

const W = 306;

/** The autopilot mark: a small cog, our own glyph. */
export function AutoIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="2.4" />
      <path d="M7 1.2v2M7 10.8v2M1.2 7h2M10.8 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4" />
    </svg>
  );
}

interface Props {
  countries: Country[];
  agents: AgentStatus[];
  picked: number | null;
  compact?: boolean;   // a 720 px projector: a shorter graph, so the whole panel fits without scrolling
  onPick(id: number): void;
}

/**
 * The network as a picture (#245): every nation is a node in its own colour with its flag, the
 * links between live nations are lines (a cut nation's links are dashed red), a cut node carries
 * the count of its queued events and an autopilot node carries a cog.
 */
export function NetworkGraph({ countries, agents, picked, compact, onPick }: Props) {
  const H = compact ? 168 : 204;
  const n = countries.length;
  const r = n <= 6 ? 21 : n <= 9 ? 18 : n <= 14 ? 14 : 11;
  const rx = W / 2 - r - 14, ry = H / 2 - r - 12;
  const nodes = countries.map((c, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, n);
    const agent = agents.find((x) => x.countryId === c.id);
    const deleted = !!agent?.deleted;
    const gone = deleted || !c.alive;
    return {
      c, agent, deleted, gone,
      cut: !gone && agent?.link === 'cut',
      auto: !gone && agent?.ruler === 'autopilot',
      x: n === 1 ? W / 2 : W / 2 + rx * Math.cos(a),
      y: n === 1 ? H / 2 : H / 2 + ry * Math.sin(a),
    };
  });
  const live = nodes.filter((d) => !d.gone);
  // A full mesh reads well up to eight nations; past that every nation links to a hub.
  const mesh = live.length <= 8;
  const links: { key: string; x1: number; y1: number; x2: number; y2: number; cut: boolean }[] = [];
  if (mesh) {
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!, b = live[j]!;
      links.push({ key: `${a.c.id}-${b.c.id}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, cut: a.cut || b.cut });
    }
  } else {
    for (const a of live) links.push({ key: `${a.c.id}`, x1: a.x, y1: a.y, x2: W / 2, y2: H / 2, cut: a.cut });
  }
  const fw = Math.round(r * 1.2), fh = Math.round(r * 0.8);
  return (
    <div className="tn-graph" style={{ width: W, height: H }}>
      <svg className="tn-graph-links" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {links.filter((l) => !l.cut).map((l) => <line key={l.key} className="tn-gl up" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
        {links.filter((l) => l.cut).map((l) => <line key={l.key} className="tn-gl cut" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
        {!mesh && <circle className="tn-graph-hub" cx={W / 2} cy={H / 2} r="5" />}
      </svg>
      {nodes.map((d) => {
        const state = d.deleted ? 'deleted' : d.gone ? 'fallen' : d.cut ? `link cut, ${d.agent!.pendingEvents} events queued` : 'link up';
        const tip = `${d.c.name}: ${state}${d.auto ? ', on autopilot' : ''}`;
        const cls = ['tn-node', picked === d.c.id ? 'tn-picked' : '', d.cut ? 'tn-cut' : '', d.gone ? 'tn-gone' : ''].filter(Boolean).join(' ');
        return (
          <button
            key={d.c.id} type="button" className={cls} title={tip} aria-label={tip} aria-pressed={picked === d.c.id}
            style={{ left: d.x - r, top: d.y - r, width: r * 2, height: r * 2, ['--tn-nation' as string]: d.c.color }}
            onClick={() => onPick(d.c.id)}
          >
            <span className="tn-node-flag" dangerouslySetInnerHTML={{ __html: flagSvg(d.c.flag, fw, fh) }} />
            {d.cut && <span className="tn-node-count">{d.agent!.pendingEvents > 99 ? '99+' : d.agent!.pendingEvents}</span>}
            {d.auto && <span className="tn-node-auto"><AutoIcon size={r > 15 ? 12 : 10} /></span>}
            {d.gone && (
              <svg className="tn-node-x" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" /></svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
