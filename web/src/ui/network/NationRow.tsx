import { useEffect, useRef, useState } from 'react';
import { flagSvg } from '@terra/shared';
import type { AgentStatus, Country } from '@terra/shared';

interface Props {
  country: Country;
  agent: AgentStatus | undefined;
  tick: number;
  selected: boolean;
  onSelect(id: number): void;
  onControl(action: string, id: number): void;
}

export function NationRow({ country, agent, tick, selected, onSelect, onControl }: Props) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const gone = !country.alive || !!agent?.deleted;
  const cut = !gone && agent?.link === 'cut';
  const auto = !gone && agent?.ruler === 'autopilot';

  const del = () => {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    onControl('delete', country.id);
  };

  let status: string;
  if (gone) status = agent?.deleted ? 'Deleted' : 'Fallen';
  else {
    const parts: string[] = [];
    if (agent) {
      if (cut) {
        const years = Math.max(0, tick - agent.lastHeardTick);
        parts.push(`Cut off, silent ${years} ${years === 1 ? 'year' : 'years'}`);
        if (agent.pendingEvents > 0) parts.push(`${agent.pendingEvents} events queued`);
      } else parts.push('Linked');
      parts.push(auto ? 'Autopilot' : 'AI ruler');
    }
    status = parts.join(' · ');
  }

  const cls = ['tn-net-row', selected ? 'tn-sel' : '', cut ? 'tn-cut' : '', gone ? 'tn-gone' : ''].join(' ');
  return (
    <li className={cls} style={{ ['--tn-nation' as string]: country.color }}>
      <div className="tn-net-line1">
        <span className="tn-net-flag" dangerouslySetInnerHTML={{ __html: flagSvg(country.flag, 24, 16) }} />
        <button className="tn-net-name" onClick={() => { onSelect(country.id); }}>{country.name}</button>
        {auto && <span className="tn-net-tag">autopilot</span>}
      </div>
      <div className="tn-net-status">{status}</div>
      {agent && !gone && (
        <div className="tn-net-switches">
          <button className="tn-net-btn" onClick={() => onControl(cut ? 'restore' : 'cut', country.id)}>{cut ? 'Restore' : 'Cut'}</button>
          <button className="tn-net-btn" onClick={() => onControl(auto ? 'wake' : 'silence', country.id)}>{auto ? 'Wake' : 'Silence'}</button>
          <button className={`tn-net-btn tn-danger ${confirming ? 'tn-armed' : ''}`} onClick={del}>{confirming ? 'Confirm delete' : 'Delete'}</button>
        </div>
      )}
    </li>
  );
}
