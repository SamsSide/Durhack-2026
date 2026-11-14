import { useMemo, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { flagSvg } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useStats } from './useStats';
import type { TerritorySeries } from './useStats';
import './stats.css';

// Plot box in px. The network panel is a fixed --net-width, so the chart draws 1:1 (no scaling of type).
const W = 288, H = 150;
const M = { top: 10, right: 12, bottom: 22, left: 30 };
const PW = W - M.left - M.right, PH = H - M.top - M.bottom;
const MAX_SERIES = 10;

/** A round axis top and three grid steps: 0, half, top. */
function niceTop(max: number): number {
  if (max <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 1.2, 1.6, 2, 3, 4, 5, 6, 8, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

/** The nation's holding at a tick: its last point at or before it; null before it existed. */
function valueAt(s: TerritorySeries, tick: number): number | null {
  let v: number | null = null;
  for (const p of s.points) { if (p.tick > tick) break; v = p.tiles; }
  return v;
}

/**
 * Territory over time (row A11): one line per nation from the Tiger Data continuous aggregate,
 * refreshed every 5 s. Renders nothing while the database is not there, so the demo never shows an error.
 */
export function TerritoryChart() {
  const stats = useStats();
  const world = useWorld((s) => s.world);
  const select = useWorld((s) => s.select);
  const flyTo = useWorld((s) => s.flyTo);
  const [hover, setHover] = useState<number | null>(null);   // index into `ticks`
  const [focus, setFocus] = useState<number | null>(null);   // countryId under the pointer in the legend

  const data = stats.data;
  const model = useMemo(() => {
    const all = (data?.series ?? []).filter((s) => s.points.length > 0);
    const peak = (s: TerritorySeries) => s.points.reduce((m, p) => Math.max(m, p.tiles), 0);
    const series = [...all].sort((a, b) => peak(b) - peak(a)).slice(0, MAX_SERIES);
    const yearOf = new Map<number, number>();
    for (const s of series) for (const p of s.points) yearOf.set(p.tick, p.year);
    const ticks = [...yearOf.keys()].sort((a, b) => a - b);
    const top = niceTop(series.reduce((m, s) => Math.max(m, peak(s)), 0));
    return { series, ticks, yearOf, top };
  }, [data]);

  if (stats.status !== 'ok' || !data) {
    if (import.meta.env.DEV && stats.status === 'off') return <p className="tn-st-off">Stats need the database.</p>;
    return null;
  }

  const { series, ticks, yearOf, top } = model;
  const caption = (
    <p className="tn-st-cap">
      <i className="tn-roundel tn-roundel--dot tn-roundel--dot-sm tn-st-live" aria-hidden="true" />
      <span>Powered by <b>Tiger Data</b></span>
      <span className="tn-st-n">{data.events.toLocaleString('en-GB')} events{data.sample ? " · sample" : ""}</span>
    </p>
  );

  if (ticks.length < 2) {
    return (
      <section className="tn-stats">
        <h3 className="tn-header-bar tn-st-title">Territory over time</h3>
        <p className="tn-st-empty">The record begins as the first provinces are claimed. Give it a few years.</p>
        {caption}
      </section>
    );
  }

  const t0 = ticks[0], t1 = ticks[ticks.length - 1];
  const x = (tick: number) => M.left + ((tick - t0) / (t1 - t0)) * PW;
  const y = (v: number) => M.top + PH - (v / top) * PH;
  const at = hover != null ? ticks[Math.min(hover, ticks.length - 1)] : t1;
  const year = yearOf.get(at) ?? 0;
  const midTick = ticks[Math.floor((ticks.length - 1) / 2)];

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const want = t0 + ((e.clientX - box.left) / box.width) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < ticks.length; i++) if (Math.abs(ticks[i] - want) < Math.abs(ticks[best] - want)) best = i;
    setHover(best);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const cur = hover ?? ticks.length - 1;
    setHover(Math.max(0, Math.min(ticks.length - 1, cur + (e.key === 'ArrowLeft' ? -1 : 1))));
  };

  const rows = series
    .map((s) => ({ s, v: valueAt(s, at), country: world?.countries.find((c) => c.id === s.countryId) }))
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));

  return (
    <section className="tn-stats">
      <h3 className="tn-header-bar tn-st-title">Territory over time</h3>
      <header className="tn-st-head">
        <p className="tn-st-sub">Provinces held by each nation</p>
        <p className={`tn-stat tn-st-year${hover != null ? ' tn-on' : ''}`}><span className="tn-stat__label">{hover != null ? 'Year' : 'Now'}</span><span className="tn-stat__value">{year}</span></p>
      </header>

      <div className="tn-st-well">
      <svg
        className="tn-st-plot" viewBox={`0 0 ${W} ${H}`} width={W} height={H} tabIndex={0} role="img"
        aria-label={`Provinces held by each nation from year ${yearOf.get(t0)} to year ${yearOf.get(t1)}. Use the arrow keys to read a year.`}
        onKeyDown={onKey} onBlur={() => setHover(null)}
      >
        {[0, top / 2, top].map((v) => (
          <g key={v}>
            <line className={v === 0 ? 'tn-st-base' : 'tn-st-grid'} x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} />
            <text className="tn-st-tick" x={M.left - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        <text className="tn-st-tick" x={M.left} y={H - 5} textAnchor="start">{yearOf.get(t0)}</text>
        {ticks.length > 4 && <text className="tn-st-tick" x={x(midTick)} y={H - 5} textAnchor="middle">{yearOf.get(midTick)}</text>}
        <text className="tn-st-tick" x={W - M.right} y={H - 5} textAnchor="end">{yearOf.get(t1)}</text>

        {series.map((s) => {
          const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.tick).toFixed(1)} ${y(p.tiles).toFixed(1)}`).join('');
          const dim = focus != null && focus !== s.countryId;
          return (
            <g key={s.countryId} className={dim ? 'tn-st-dim' : focus === s.countryId ? 'tn-st-lift' : undefined}>
              <path className="tn-st-halo" d={d} />
              <path className="tn-st-line" d={d} stroke={s.color} />
            </g>
          );
        })}

        {hover != null && <line className="tn-st-cross" x1={x(at)} x2={x(at)} y1={M.top} y2={M.top + PH} />}
        {rows.map(({ s, v }) => v != null && (hover != null || s.points[s.points.length - 1].tick === t1) && (
          <circle key={s.countryId} className={`tn-st-dot${focus != null && focus !== s.countryId ? ' tn-st-dim' : ''}`} cx={x(at)} cy={y(v)} r={hover != null ? 4 : 3} fill={s.color} />
        ))}
        <rect
          x={M.left} y={0} width={PW} height={H - M.bottom + 4} fill="transparent"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}
        />
      </svg>
      </div>

      <ul className="tn-st-legend">
        {rows.map(({ s, v, country }) => {
          const fallen = country ? !country.alive : false;
          return (
            <li key={s.countryId}>
              <button
                type="button" className={`tn-st-row${fallen ? ' tn-st-fallen' : ''}`}
                onPointerEnter={() => setFocus(s.countryId)} onPointerLeave={() => setFocus(null)}
                onFocus={() => setFocus(s.countryId)} onBlur={() => setFocus(null)}
                onClick={() => { if (country) { select(country.id); flyTo(country.id); } }}
              >
                {country
                  ? <span className="tn-st-flag" dangerouslySetInnerHTML={{ __html: flagSvg(country.flag, 24, 16) }} />
                  : <span className="tn-st-flag tn-st-noflag" />}
                <i className="tn-st-key" style={{ background: s.color }} aria-hidden="true" />
                <span className="tn-st-name">{country?.name ?? s.name}</span>
                <span className="tn-st-val">{v == null ? '·' : v === 0 && fallen ? 'fallen' : v}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {caption}
    </section>
  );
}
