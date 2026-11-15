import { useEffect, useState } from 'react';
import { useWorld } from '../state/world';
import { clockNow, monthDay, yearFraction } from '../state/calendar';
import { Roll } from '../ui/motion/Roll';
import { yearLabel } from '@terra/shared';

const plainYear = yearLabel;

const MONTH_BELOW = 1.01;   // the month shows up to two years a second; faster than that it is a blur
const DAY_BELOW = 0.13;     // the day shows at one season a second or slower

/** The year plate in the top bar: the year, and between yearly ticks the month (and the day when slow). */
export function Calendar() {
  const year = useWorld((s) => s.world?.year ?? 0);
  const [, redraw] = useState('');

  // Worked out on every render (so a new year never shows last year's December), and a frame loop
  // asks for a render only when the text or the hairline would change.
  const read = () => {
    const { speed } = clockNow();
    if (speed >= MONTH_BELOW) return { date: '', yearPart: 0 };
    const f = yearFraction();
    const d = monthDay(f);
    return { date: speed < DAY_BELOW ? `${d.day} ${d.name}` : d.name, yearPart: Math.round(f * 96) / 96 };
  };
  const { date, yearPart } = read();

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const r = read();
      redraw(`${r.date}|${r.yearPart}`);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const withDay = date.includes(' ');
  return (
    <div className={`tb-year${date ? ' dated' : ''}`} title={date ? `${date}, ${yearLabel(year)}` : `Year ${yearLabel(year)}`}>
      <span className="cap">Year</span>
      <Roll className="num tn-gilt-text" value={year} format={plainYear} ms={220} />
      {date && <span className={`tb-date${withDay ? ' day' : ''}`} aria-label={date}>{date}</span>}
      {date && <i className="tb-yearbar" style={{ width: `${yearPart * 100}%` }} />}
    </div>
  );
}
