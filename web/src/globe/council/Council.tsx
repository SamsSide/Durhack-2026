// The council on the globe: mourning banner, succession seal, coup flash and ruler/general pips by the capital.
// Reads events by type string; types are local until row A29 lands. Mount inside the ProvinceMeshContext provider.
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { Anchor } from '../status/Anchor';
import { capitalPoint } from '../status/geo';
import { useEventStream } from '../status/useEventStream';
import { useHover } from '../camera/usePicking';
import { bannerIcon, crackedCrownIcon, pipIcon, sealIcon } from './icons';
import type { CouncilChanged, CouncilData, CouncilRole, CouncilState, CouncilStatus } from './types';
import './council.css';

interface Vis {
  ruler: CouncilState; general: CouncilState;
  mourn: 'off' | 'on' | 'lowering';
  pulse: number; seal: number; coup: number; // timestamps that retrigger the CSS animations
}
type Action =
  | { k: 'event'; e: CouncilChanged | CouncilStatus }
  | { k: 'sync'; id: number; ruler: CouncilState; general: CouncilState }
  | { k: 'off'; id: number; stamp: number };
type Table = Record<number, Vis>;

const blank = (): Vis => ({ ruler: 'active', general: 'active', mourn: 'off', pulse: 0, seal: 0, coup: 0 });
const troubled = (v: Vis) => v.ruler === 'vacant' || v.ruler === 'covering' || v.general === 'vacant' || v.general === 'covering';

function reduce(t: Table, a: Action): Table {
  if (a.k === 'off') {
    const v = t[a.id];
    if (!v || v.mourn !== 'lowering' || v.seal !== a.stamp) return t;
    return { ...t, [a.id]: { ...v, mourn: 'off' } };
  }
  if (a.k === 'sync') {
    const v = t[a.id] ?? blank();
    if (v.ruler === a.ruler && v.general === a.general) return t;
    const n = { ...v, ruler: a.ruler, general: a.general };
    if (troubled(n)) n.mourn = 'on';
    return { ...t, [a.id]: n };
  }
  const e = a.e;
  const v = { ...(t[e.countryId] ?? blank()) };
  const now = Date.now();
  if (e.type === 'council_status') {
    v[e.role] = e.state;
    if (troubled(v)) v.mourn = 'on';
  } else {
    switch (e.cause) {
      case 'death': case 'assassination':
        v[e.role] = 'vacant'; v.mourn = 'on'; v.pulse = now; break;
      case 'disconnect': v[e.role] = 'cut'; break;
      case 'succession': case 'restored':
        v[e.role] = 'active'; v.seal = now;
        if (!troubled(v) && v.mourn === 'on') v.mourn = 'lowering';
        break;
      case 'coup': v[e.role] = 'active'; v.coup = now; break;
      default: v[e.role] = 'active';
    }
  }
  return { ...t, [e.countryId]: v };
}

type AnyCountry = { council?: Partial<CouncilData> };
const councilOf = (c: unknown): Partial<CouncilData> | undefined => (c as AnyCountry | undefined)?.council;
const isCouncilEvent = (e: { type: string }): boolean => e.type === 'council_changed' || e.type === 'council_status';

let demoDispatch: ((a: Action) => void) | null = null;

function Marker({ id, vis, pips }: { id: number; vis: Vis; pips: boolean }) {
  const mesh = useProvinceMesh();
  const pos = useMemo(() => {
    const w = useWorld.getState().world;
    return mesh && w ? capitalPoint(mesh, w, id, 0.01) : null;
  }, [mesh, id]);
  if (!pos) return null;
  const fresh = (t: number) => t > 0 && Date.now() - t < 3500;
  return (
    <Anchor pos={pos}>
      <div className="cn-root">
        {fresh(vis.pulse) && <div key={`p${vis.pulse}`} className="cn-ring" />}
        {fresh(vis.coup) && <div key={`c${vis.coup}`}><div className="cn-flash" /><img className="cn-coup" src={crackedCrownIcon()} alt="" /></div>}
        {fresh(vis.seal) && <div key={`s${vis.seal}`}><img className="cn-seal" src={sealIcon()} alt="" /><div className="cn-burst" /></div>}
        {vis.mourn !== 'off' && <img className={`cn-banner${vis.mourn === 'lowering' ? ' lower' : ''}`} src={bannerIcon()} alt="" />}
        {pips && (
          <div className="cn-pips">
            {(['ruler', 'general'] as CouncilRole[]).map((r) => <img key={r} className="cn-pip" src={pipIcon(r, vis[r])} alt={`${r} ${vis[r]}`} />)}
          </div>
        )}
      </div>
    </Anchor>
  );
}

export function Council() {
  const [table, dispatch] = useReducer(reduce, {} as Table);
  const selected = useWorld((s) => s.selectedCountryId);
  const hovered = useHover((s) => useWorld.getState().world?.owner[s.tile] ?? -1);

  useEventStream(useCallback((events) => {
    for (const e of events) if (isCouncilEvent(e)) dispatch({ k: 'event', e: e as unknown as CouncilChanged | CouncilStatus });
  }, []));

  // Pick up the state the world already carries (late join, reload, old replays have none).
  useEffect(() => {
    let sig = '';
    const run = () => {
      const w = useWorld.getState().world;
      if (!w) return;
      let s = '';
      const items: Array<[number, CouncilState, CouncilState]> = [];
      for (const c of Object.values(w.countries) as Array<{ id: number }>) {
        const cn = councilOf(c);
        if (!cn?.state) continue;
        items.push([c.id, cn.state.ruler ?? 'active', cn.state.general ?? 'active']);
        s += `${c.id}${cn.state.ruler}${cn.state.general};`;
      }
      if (s === sig) return;
      sig = s;
      for (const [id, r, g] of items) dispatch({ k: 'sync', id, ruler: r, general: g });
    };
    run();
    return useWorld.subscribe(run);
  }, []);

  useEffect(() => { demoDispatch = dispatch; return () => { if (demoDispatch === dispatch) demoDispatch = null; }; }, []);

  // Lower the banner after the seal has landed.
  useEffect(() => {
    const timers: number[] = [];
    for (const [k, v] of Object.entries(table)) {
      if (v.mourn === 'lowering') timers.push(window.setTimeout(() => dispatch({ k: 'off', id: Number(k), stamp: v.seal }), 1300));
    }
    return () => timers.forEach(clearTimeout);
  }, [table]);

  const ids = new Set<number>();
  for (const [k, v] of Object.entries(table)) if (v.mourn !== 'off' || v.pulse || v.seal || v.coup) ids.add(Number(k));
  if (selected != null) ids.add(selected);
  if (hovered >= 0) ids.add(hovered);
  return (
    <>
      {[...ids].map((id) => (
        <Marker key={id} id={id} vis={table[id] ?? blank()} pips={id === selected || id === hovered} />
      ))}
    </>
  );
}

// Dev only: window.__councilDemo(countryId) plays a fake ruler death -> general covers -> succession in local state.
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  (window as unknown as { __councilDemo?: (id: number) => void }).__councilDemo = (id: number) => {
    const d = demoDispatch;
    if (!d) return;
    const member = { name: 'Demo Heir', portraitSeed: 7, since: 0, memory: '' };
    const ev = (e: CouncilChanged | CouncilStatus) => d({ k: 'event', e });
    ev({ type: 'council_changed', countryId: id, role: 'ruler', member: null, cause: 'death' });
    setTimeout(() => ev({ type: 'council_status', countryId: id, role: 'general', state: 'covering' }), 1500);
    setTimeout(() => ev({ type: 'council_changed', countryId: id, role: 'general', member: null, cause: 'disconnect' }), 5000);
    setTimeout(() => ev({ type: 'council_changed', countryId: id, role: 'general', member, cause: 'restored' }), 8000);
    setTimeout(() => ev({ type: 'council_changed', countryId: id, role: 'ruler', member, cause: 'succession' }), 11000);
    setTimeout(() => ev({ type: 'council_changed', countryId: id, role: 'ruler', member, cause: 'coup' }), 16000);
  };
}
