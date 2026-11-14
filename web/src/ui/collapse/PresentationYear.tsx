import { useWorld } from '../../state/world';
import { clockNow, monthDay, yearFraction } from '../../state/calendar';
import { usePresentation } from './presentation';
import { useEffect, useState } from 'react';
import { Roll } from '../motion/Roll';

const plainYear = (n: number) => String(n);

/** The year plate for presentation mode: top centre, lacquer with gilt text. Only visible while it is on. */
export function PresentationYear() {
  const on = usePresentation((s) => s.on);
  const year = useWorld((s) => s.world?.year);
  const [month, setMonth] = useState('');
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      // The month shows below two years a second, as in the top bar; faster is a blur.
      setMonth(clockNow().speed < 1.01 ? monthDay(yearFraction()).name : '');
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  if (!on || year == null) return null;
  return (
    <div className="tn-present-year tn-lacquer tn-frame tn-frame--slim tn-m-from-above tn-m-in" title="Press P or Esc to leave" role="status">
      <span className="tn-present-year__cap tn-engraved--dark">Year</span>
      <Roll className="tn-present-year__num tn-gilt-text" value={year} format={plainYear} ms={220} />
      {month && <span className="tn-present-year__month tn-gilt-text">{month}</span>}
    </div>
  );
}
