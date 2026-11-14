import { useEffect, useRef, useState } from 'react';
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

  const deleted = !!agent?.deleted;
  const fallen = !country.alive && !deleted;
  const gone = deleted || fallen;
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

  const years = agent ? Math.max(0, tick - agent.lastHeardTick) : 0;
  const cls = ['tn-nrow', selected ? 'tn-sel' : '', cut ? 'tn-cut' : '', gone ? 'tn-gone' : ''].filter(Boolean).join(' ');
  return (
    <li className={cls} style={{ ['--tn-nation' as string]: country.color }}>
      <div className="tn-nr-top">
        <span className="tn-sw" />
        <button className="tn-nr-name" onClick={() => onSelect(country.id)}>{country.name}</button>
        {deleted && <span className="tn-state del">Deleted</span>}
        {fallen && <span className="tn-state del">Fallen</span>}
      </div>
      {deleted && <div className="tn-nr-sub ruin">Its lands lie in ruin; neighbours are carving them up.</div>}
      {agent && !gone && (
        <>
          <div className="tn-nr-states">
            {cut ? <span className="tn-state cut"><i />Cut</span> : <span className="tn-state up"><i />Link up</span>}
            {auto ? <span className="tn-state auto">Autopilot</span> : <span className="tn-state llm">LLM ruler</span>}
          </div>
          {cut && (
            <div className="tn-nr-sub mono">
              {agent.pendingEvents} events queued · silent {years} {years === 1 ? 'yr' : 'yrs'}
            </div>
          )}
          <div className="tn-nr-btns">
            <button className="btn xs" onClick={() => onControl(cut ? 'restore' : 'cut', country.id)}>{cut ? 'Restore' : 'Cut'}</button>
            <button className="btn xs" onClick={() => onControl(auto ? 'wake' : 'silence', country.id)}>{auto ? 'Wake' : 'Silence'}</button>
            <button className="btn xs danger" onClick={del}>{confirming ? 'Confirm delete' : 'Delete'}</button>
          </div>
        </>
      )}
    </li>
  );
}
