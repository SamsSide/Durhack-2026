import { useEffect, useRef, useState } from 'react';
import { flagSvg } from '@terra/shared';
import type { AgentStatus, Country, CouncilRole } from '@terra/shared';
import { useWorld } from '../../state/world';
import { AutoIcon } from './NetworkGraph';

/** A button that needs a second click within three seconds (Delete, Kill). */
function TwoClick({ label, tip, onConfirm }: { label: string; tip: string; onConfirm(): void }) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const click = () => {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    onConfirm();
  };
  const t = confirming ? `Click again to ${label.toLowerCase()}` : tip;
  return <button type="button" className="btn xs danger" title={t} aria-label={t} onClick={click}>{confirming ? 'Confirm' : label}</button>;
}

const ROLES: { role: CouncilRole; label: string }[] = [{ role: 'ruler', label: 'Ruler' }, { role: 'general', label: 'General' }];

interface Props {
  country: Country;
  agent: AgentStatus | undefined;
  tick: number;
  year: number;
  onControl(action: string, id: number): void;
  onOpenCard(id: number): void;
}

/** Everything you can do to the nation picked on the graph: its link, its AI ruler, its council. */
export function NodeTray({ country, agent, tick, year, onControl, onOpenCard }: Props) {
  const send = useWorld((s) => s.send);
  const deleted = !!agent?.deleted;
  const fallen = !country.alive && !deleted;
  const gone = deleted || fallen;
  const cut = !gone && agent?.link === 'cut';
  const auto = !gone && agent?.ruler === 'autopilot';
  const years = agent ? Math.max(0, tick - agent.lastHeardTick) : 0;
  // #108: a deleted agent stops its heartbeat, so its last-heard tick is when it was deleted (one tick is one year).
  const deletedYear = year - years;
  const silentTip = agent ? `No word for ${years} ${years === 1 ? 'year' : 'years'}; ${agent.pendingEvents} of its moves wait to be merged` : '';
  const cutTip = 'Cut its link: it keeps playing on what it last knew';
  const restoreTip = 'Reconnect: its queued moves merge back into history';
  const silenceTip = 'Switch its AI ruler off; autopilot rules meanwhile';
  const wakeTip = 'Switch its AI ruler back on';
  const council = country.council;
  const member = (role: CouncilRole, action: 'kill' | 'cut_member' | 'restore_member') =>
    send({ type: 'control', action, countryId: country.id, role });

  return (
    <div className={`tn-tray${cut ? ' tn-is-cut' : ''}${gone ? ' tn-gone' : ''}`} style={{ ['--tn-nation' as string]: country.color }}>
      <div className="tn-tray-top">
        <span className="tn-tray-flag" dangerouslySetInnerHTML={{ __html: flagSvg(country.flag, 30, 20) }} />
        <button type="button" className="tn-tray-name" title="Open its card (this folds the Network)" onClick={() => onOpenCard(country.id)}>{country.name}</button>
        {gone && <span className="tn-state del">{deleted ? `Deleted Y${deletedYear}` : 'Fallen'}</span>}
      </div>
      {gone && <div className="tn-tray-sub ruin">{deleted ? 'Its neighbours are carving up its lands.' : 'Its lands lie in ruin.'}</div>}
      {agent && !gone && (
        <>
          <div className="tn-tray-states">
            {cut
              ? <span className="tn-state cut" title="Nothing gets in or out" aria-label="Cut: nothing gets in or out"><i className="tn-pulse" />Cut</span>
              : <span className="tn-state up" title="Its messages reach the others" aria-label="Link up: its messages reach the others"><i />Link up</span>}
            {auto
              ? <span className="tn-state auto" title="Rules decide its moves" aria-label="Autopilot: rules decide its moves"><AutoIcon />Autopilot</span>
              : <span className="tn-state llm" title="Gemini decides its moves" aria-label="LLM ruler: Gemini decides its moves">LLM ruler</span>}
            {cut && (
              <span className="tn-tray-sub mono" title={silentTip} aria-label={silentTip}>
                silent {years} {years === 1 ? 'yr' : 'yrs'} · {agent.pendingEvents} queued
              </span>
            )}
          </div>
          <div className="tn-tray-btns">
            <button type="button" className={`btn xs ${cut ? 'restore' : ''}`} title={cut ? restoreTip : cutTip} aria-label={cut ? restoreTip : cutTip} onClick={() => onControl(cut ? 'restore' : 'cut', country.id)}>{cut ? 'Restore' : 'Cut'}</button>
            <button type="button" className="btn xs" title={auto ? wakeTip : silenceTip} aria-label={auto ? wakeTip : silenceTip} onClick={() => onControl(auto ? 'wake' : 'silence', country.id)}>{auto ? 'Wake' : 'Silence'}</button>
            <TwoClick label="Delete" tip="Remove it: its neighbours carve up its land" onConfirm={() => onControl('delete', country.id)} />
          </div>
          {council && (
            <div className="tn-tray-council">
              {ROLES.map(({ role, label }) => {
                const m = council[role];
                const st = council.state[role];
                return (
                  <div key={role} className="tn-tray-cm">
                    <span className="tn-tray-role">{label}</span>
                    <span className="tn-tray-who" title={m ? `${m.name} (${st})` : 'Vacant'}>{m ? m.name : 'Vacant'}</span>
                    {m && st !== 'cut' && <button type="button" className="btn xs" title={`Cut the ${role} off from the council`} onClick={() => member(role, 'cut_member')}>Cut</button>}
                    {st === 'cut' && <button type="button" className="btn xs restore" title={`Reconnect the ${role}`} onClick={() => member(role, 'restore_member')}>Restore</button>}
                    {m && <TwoClick label="Kill" tip={`Kill the ${role}: a successor takes over`} onConfirm={() => member(role, 'kill')} />}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
