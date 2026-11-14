import { useEffect, useRef, useState } from 'react';
import type { AgentStatus, Country } from '@terra/shared';

interface Props {
  country: Country;
  agent: AgentStatus | undefined;
  tick: number;
  year: number;
  selected: boolean;
  onSelect(id: number): void;
  onControl(action: string, id: number): void;
}

export function NationRow({ country, agent, tick, year, selected, onSelect, onControl }: Props) {
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
  // #108: a deleted agent stops its heartbeat, so its last-heard tick is when it was deleted (one tick is one year).
  const deletedYear = year - years;
  const silentTip = agent ? `No word for ${years} ${years === 1 ? 'year' : 'years'}; ${agent.pendingEvents} of its moves wait to be merged` : '';
  const cutTip = 'Cut its link: it keeps playing on what it last knew';
  const restoreTip = 'Reconnect: its queued moves merge back into history';
  const silenceTip = 'Switch its AI ruler off; autopilot rules meanwhile';
  const wakeTip = 'Switch its AI ruler back on';
  const delTip = confirming ? 'Click again to delete' : 'Remove it: its neighbours carve up its land';
  const cls = ['tn-nrow', selected ? 'tn-sel' : '', cut ? 'tn-is-cut' : '', gone ? 'tn-gone' : ''].filter(Boolean).join(' ');
  return (
    <li className={cls} style={{ ['--tn-nation' as string]: country.color }}>
      <div className="tn-nr-top">
        <span className="tn-sw" />
        <button className="tn-nr-name" onClick={() => onSelect(country.id)}>{country.name}</button>
        {agent && !gone && (cut
          ? <span className="tn-state cut" title="Nothing gets in or out" aria-label="Cut: nothing gets in or out"><i className="tn-pulse" />Cut</span>
          : <span className="tn-state up" title="Its messages reach the others" aria-label="Link up: its messages reach the others"><i />Link up</span>)}
        {gone && <span className="tn-state del">{deleted ? `Deleted Y${deletedYear}` : 'Fallen'}</span>}
      </div>
      {gone && (
        <div className="tn-nr-sub ruin">
          {deleted ? 'Its neighbours are carving up its lands.' : 'Its lands lie in ruin.'}
        </div>
      )}
      {agent && !gone && (
        <>
          {cut && (
            <div className="tn-nr-sub mono" title={silentTip} aria-label={silentTip}>
              silent {years} {years === 1 ? 'yr' : 'yrs'} · {agent.pendingEvents} {agent.pendingEvents === 1 ? 'event' : 'events'} queued
            </div>
          )}
          <div className="tn-nr-line">
            {auto ? <span className="tn-state auto" title="Rules decide its moves" aria-label="Autopilot: rules decide its moves">Autopilot</span> : <span className="tn-state llm" title="Gemini decides its moves" aria-label="LLM ruler: Gemini decides its moves">LLM ruler</span>}
            <div className="tn-nr-btns">
              <button className={`btn xs ${cut ? 'restore' : ''}`} title={cut ? restoreTip : cutTip} aria-label={cut ? restoreTip : cutTip} onClick={() => onControl(cut ? 'restore' : 'cut', country.id)}>{cut ? 'Restore' : 'Cut'}</button>
              <button className="btn xs" title={auto ? wakeTip : silenceTip} aria-label={auto ? wakeTip : silenceTip} onClick={() => onControl(auto ? 'wake' : 'silence', country.id)}>{auto ? 'Wake' : 'Silence'}</button>
              <button className="btn xs danger" title={delTip} aria-label={delTip} onClick={del}>{confirming ? 'Confirm' : 'Delete'}</button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}
