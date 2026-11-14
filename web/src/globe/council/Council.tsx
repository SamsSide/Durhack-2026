// The council on the globe: mourning banner, succession seal, coup flash and ruler/general pips by the capital.
// Types come from @terra/shared (row A29). Mount inside the ProvinceMeshContext provider.
import { memo, useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { onWorldReset, useWorld } from '../../state/world';
import { useProvinceMesh } from '../mesh/context';
import { Anchor } from '../status/Anchor';
import { capitalPoint } from '../status/geo';
import { STACK, cityKey } from '../status/cityStack';
import { useEventStream } from '../status/useEventStream';
import { useHover } from '../camera/usePicking';
import { bannerIcon, crackedCrownIcon, pipIcon, sealIcon } from './icons';
import type { CouncilChanged, CouncilRole, CouncilState, CouncilStatus } from './types';
import '../hover/hover.css';
import './council.css';

interface Vis {
  ruler: CouncilState; general: CouncilState;
  mourn: 'off' | 'on' | 'lowering';
  pulse: number; seal: number; coup: number; // timestamps that retrigger the CSS animations
  sealRole: CouncilRole; sealCause: 'succession' | 'restored'; coupRole: CouncilRole;
  mournCause: string; // what the mourning tooltip says: how the last member left
}
type Action =
  | { k: 'event'; e: CouncilChanged | CouncilStatus }
  | { k: 'sync'; id: number; ruler: CouncilState; general: CouncilState }
  | { k: 'off'; id: number; stamp: number }
  | { k: 'reset' };
type Table = Record<number, Vis>;

const blank = (): Vis => ({ ruler: 'active', general: 'active', mourn: 'off', pulse: 0, seal: 0, coup: 0, sealRole: 'ruler', sealCause: 'succession', coupRole: 'ruler', mournCause: 'In mourning' });
const BLANK = blank(); // for a mark with no entry yet: one object, so a memoised Marker sees the same props
const troubled = (v: Vis) => v.ruler === 'vacant' || v.ruler === 'covering' || v.general === 'vacant' || v.general === 'covering';

function reduce(t: Table, a: Action): Table {
  if (a.k === 'reset') return {};
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
      case 'death': case 'assassination': case 'old_age':
        v[e.role] = 'vacant'; v.mourn = 'on'; v.pulse = now; v.mournCause = DEATH_TEXT[e.cause]; break;
      case 'disconnect': v[e.role] = 'cut'; break;
      case 'succession': case 'restored':
        v[e.role] = 'active'; v.seal = now; v.sealRole = e.role; v.sealCause = e.cause;
        if (!troubled(v) && v.mourn === 'on') v.mourn = 'lowering';
        break;
      case 'coup': v[e.role] = 'active'; v.coup = now; v.coupRole = e.role; break;
      default: v[e.role] = 'active';
    }
  }
  return { ...t, [e.countryId]: v };
}

const isCouncilEvent = (e: { type: string }): boolean => e.type === 'council_changed' || e.type === 'council_status';

let demoDispatch: ((a: Action) => void) | null = null;

/** What a hovered council mark says: a small caption and a line, in the province tooltip style. */
export interface Tip { cap: string; text: string; sub: string; x: number; y: number; id: number }

const ROLE: Record<CouncilRole, string> = { ruler: 'Ruler', general: 'General' };

const DEATH_TEXT: Record<'death' | 'assassination' | 'old_age', string> = {
  death: 'Died in office', assassination: 'Assassinated', old_age: 'Died of old age',
};

function memberName(id: number, role: CouncilRole): string | null {
  return useWorld.getState().world?.countries[id]?.council?.[role]?.name ?? null;
}

function pipText(id: number, role: CouncilRole, state: CouncilState): string {
  const name = memberName(id, role);
  if (state === 'vacant' || !name) return role === 'ruler' ? 'The throne is empty' : 'No one commands the armies';
  if (state === 'covering') return `${name}, standing in`;
  if (state === 'cut') return `${name}, out of contact`;
  const born = useWorld.getState().world?.countries[id]?.council?.[role]?.born;
  const year = useWorld.getState().world?.year;
  return born !== undefined && year !== undefined ? `${name}, ${Math.max(0, year - born)}` : name;
}

const SCALE = 1.6;      // council marks are drawn at 1.6x their CSS size (council.css .cn-slot)
const FRESH_MS = 3500; // how long a ring, a coup mark or a seal stays up

// B8: memoised, so a council event re-renders the one mark it is about, not every mark on the globe (each
// one is a drei Html with its own React root). The marks that expire take themselves down with a timer.
const Marker = memo(function Marker({ id, vis, pips, onTip }: { id: number; vis: Vis; pips: boolean; onTip: (t: Tip | null) => void }) {
  const mesh = useProvinceMesh();
  const pos = useMemo(() => {
    const w = useWorld.getState().world;
    return mesh && w ? capitalPoint(mesh, w, id, 0.01) : null;
  }, [mesh, id]);
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const now = Date.now();
    const ends = [vis.pulse, vis.coup, vis.seal].filter((t) => t > 0 && t + FRESH_MS > now).map((t) => t + FRESH_MS);
    if (ends.length === 0) return;
    const timer = window.setTimeout(bump, Math.min(...ends) - now + 30);
    return () => window.clearTimeout(timer);
  }, [vis.pulse, vis.coup, vis.seal, tick]);
  if (!pos) return null;
  const fresh = (t: number) => t > 0 && Date.now() - t < FRESH_MS;
  const nation = useWorld.getState().world?.countries[id]?.name ?? '';
  // Hover shows a tooltip, a click selects the nation, the same as clicking its land.
  const hover = (cap: string, text: () => string) => ({
    onPointerEnter: (e: ReactPointerEvent) => onTip({ cap, text: text(), sub: nation, x: e.clientX, y: e.clientY, id }),
    onPointerMove: (e: ReactPointerEvent) => onTip({ cap, text: text(), sub: nation, x: e.clientX, y: e.clientY, id }),
    onPointerLeave: () => onTip(null),
    onClick: (e: ReactMouseEvent) => {
      e.stopPropagation();
      const w = useWorld.getState().world;
      useWorld.getState().select(id, w?.countries[id]?.capitalTile ?? null);
    },
  });
  const sealText = vis.sealCause === 'restored'
    ? `${ROLE[vis.sealRole]} back in contact`
    : vis.sealRole === 'ruler' ? 'New ruler crowned' : 'New general takes command';
  const coupName = memberName(id, vis.coupRole);
  // #332: one transient badge per city, the newest of coup mark, succession seal and mourning banner
  const badges: Array<[string, number]> = [];
  if (fresh(vis.coup)) badges.push(['coup', vis.coup]);
  if (fresh(vis.seal)) badges.push(['seal', vis.seal]);
  if (vis.mourn !== 'off') badges.push(['mourn', vis.pulse]);
  const badge = badges.reduce<[string, number] | null>((a, b) => (a == null || b[1] > a[1] ? b : a), null)?.[0];
  const tile = cityKey(useWorld.getState().world, id);
  return (
    <>
      {(fresh(vis.pulse) || fresh(vis.coup)) && (
        <Anchor pos={pos}>
          <div className="cn-root">
            {fresh(vis.pulse) && <div key={`p${vis.pulse}`} className="cn-ring" />}
            {fresh(vis.coup) && <div key={`c${vis.coup}`} className="cn-flash" />}
          </div>
        </Anchor>
      )}
      {badge && (
        <Anchor pos={pos} stack={{ tile, priority: STACK.council, scale: SCALE }}>
          <div className="cn-slot">
            {badge === 'coup' && <img key={`c${vis.coup}`} className="cn-coup cn-hit" src={crackedCrownIcon()} alt="Coup" {...hover('Coup', () => (coupName ? `${coupName} seizes power` : 'Coup'))} />}
            {badge === 'seal' && <div key={`s${vis.seal}`} className="cn-sealbox"><img className="cn-seal cn-hit" src={sealIcon()} alt={sealText} {...hover('Succession', () => sealText)} /><div className="cn-burst" /></div>}
            {badge === 'mourn' && <img className={`cn-banner cn-hit${vis.mourn === 'lowering' ? ' lower' : ''}`} src={bannerIcon()} alt="In mourning" {...hover('Council', () => vis.mournCause)} />}
          </div>
        </Anchor>
      )}
      {pips && (
        <Anchor pos={pos} stack={{ tile, priority: STACK.pips, scale: SCALE }}>
          <div className="cn-slot">
            <div className="cn-pips cn-hit" {...hover('Council', () => `Council of ${nation}`)}>
              {(['ruler', 'general'] as CouncilRole[]).map((r) => (
                <img key={r} className="cn-pip" src={pipIcon(r, vis[r])} alt={`${ROLE[r]}: ${pipText(id, r, vis[r])}`} {...hover(ROLE[r], () => pipText(id, r, vis[r]))} />
              ))}
            </div>
          </div>
        </Anchor>
      )}
    </>
  );
});

const TIP_OFFSET = 16;

/**
 * The tooltip, a plain DOM node on the body: this component renders inside the three.js canvas,
 * where React DOM portals do not work. Reuses the province tooltip classes (hover.css).
 */
function useCouncilTip(tip: Tip | null): void {
  const el = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const d = document.createElement('div');
    d.className = 'hover-tip cn-tip';
    d.setAttribute('role', 'tooltip');
    const cap = document.createElement('div'); cap.className = 'ht-cap';
    const title = document.createElement('div'); title.className = 'ht-title';
    const sub = document.createElement('div'); sub.className = 'ht-sub';
    d.append(cap, title, sub);
    return d;
  }, []);
  useEffect(() => {
    if (!el) return;
    document.body.appendChild(el);
    return () => el.remove();
  }, [el]);
  useEffect(() => {
    if (!el) return;
    el.classList.toggle('on', !!tip);
    if (!tip) return;
    const [cap, title, sub] = el.children as unknown as HTMLElement[];
    cap!.textContent = tip.cap;
    title!.textContent = tip.text;
    sub!.textContent = tip.sub;
    const w = el.offsetWidth, h = el.offsetHeight;
    const left = tip.x + TIP_OFFSET + w > window.innerWidth - 8 ? tip.x - TIP_OFFSET - w : tip.x + TIP_OFFSET;
    const top = tip.y + TIP_OFFSET + h > window.innerHeight - 8 ? tip.y - TIP_OFFSET - h : tip.y + TIP_OFFSET;
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }, [el, tip]);
}

export function Council() {
  const [table, dispatch] = useReducer(reduce, {} as Table);
  const [tip, setTip] = useState<Tip | null>(null);
  useCouncilTip(tip);
  const onTip = useCallback((t: Tip | null) => {
    setTip(t);
    // the province tooltip steps aside while a council mark has its own
    if (t) useHover.setState({ tile: -1 });
  }, []);
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
      for (const c of Object.values(w.countries)) {
        const cn = c?.council;
        if (!cn?.state) continue;
        items.push([c.id, cn.state.ruler ?? 'active', cn.state.general ?? 'active']);
        s += `${c.id}${cn.state.ruler}${cn.state.general};`;
      }
      if (s === sig) return;
      sig = s;
      for (const [id, r, g] of items) dispatch({ k: 'sync', id, ruler: r, general: g });
    };
    const offReset = onWorldReset(() => { sig = ''; dispatch({ k: 'reset' }); setTip(null); });
    run();
    const off = useWorld.subscribe(run);
    return () => { off(); offReset(); };
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
  if (tip) ids.add(tip.id); // keep the hovered mark up while its tooltip shows
  return (
    <>
      {[...ids].map((id) => (
        <Marker key={id} id={id} vis={table[id] ?? BLANK} pips={id === selected || id === hovered || id === tip?.id} onTip={onTip} />
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
