import { useEffect, useRef, useState } from 'react';
import type { Council as CouncilData, CouncilMember, CouncilRole, CouncilState } from '@terra/shared';
import { useWorld } from '../../state/world';
import { Portrait } from './Portrait';

const ROLES: { role: CouncilRole; label: string; other: string }[] = [
  { role: 'ruler', label: 'Ruler', other: 'general' },
  { role: 'general', label: 'General', other: 'ruler' },
];

const CHIP_LABEL: Record<CouncilState, string> = { active: 'Active', covering: 'Covering', vacant: 'Vacant', cut: 'Cut' };

interface Props { countryId: number; council: CouncilData; color: string; tick: number; short: boolean; frozen: boolean }

/** The Council section of the nation card (row A29): ruler and general, with kill, cut and restore. */
export function Council({ countryId, council, color, tick, short, frozen }: Props) {
  useWorld((s) => s.version);
  return (
    <section className="tn-council" aria-label="The Council">
      <h3>The Council</h3>
      {ROLES.map(({ role, label, other }) => (
        <MemberRow key={role} countryId={countryId} role={role} label={label} other={other}
          member={council[role]} state={council.state[role]} color={color} tick={tick} short={short} frozen={frozen} />
      ))}
    </section>
  );
}

function MemberRow({ countryId, role, label, other, member, state, color, tick, short, frozen }: {
  countryId: number; role: CouncilRole; label: string; other: string; member: CouncilMember | null; state: CouncilState;
  color: string; tick: number; short: boolean; frozen: boolean;
}) {
  const [flash, setFlash] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const prev = useRef(`${member?.name ?? ''}|${state}`);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  const key = `${member?.name ?? ''}|${state}`;
  useEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    setFlash(false);
    // restart the animation on the next frame so a second change flashes again
    const raf = requestAnimationFrame(() => {
      setFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(false), 650);
    });
    return () => cancelAnimationFrame(raf);
  }, [key]);

  const send = (action: 'kill' | 'cut_member' | 'restore_member') =>
    useWorld.getState().send({ type: 'control', action, countryId, role });

  const kill = () => {
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(false);
    send('kill');
  };

  const years = member ? Math.max(0, tick - member.since) : 0;
  const memory = member?.memory ? member.memory.split('\n').map((l) => l.trim()).filter(Boolean) : [];
  const title = state === 'covering' ? `Covering for the ${other}` : undefined;
  const canAct = !frozen;

  return (
    <div className={`tn-cm tn-cm-${state}${flash ? ' tn-flash' : ''}`}>
      <Portrait seed={member ? member.portraitSeed : null} role={role} color={color} size={short ? 28 : 36} />
      <div className="tn-cm-info" tabIndex={member ? 0 : -1} aria-label={member ? `${label} ${member.name}` : `${label} vacant`}>
        <div className="tn-cm-role">
          {label}
          <span className={`tn-cm-chip tn-cm-chip-${state}`} title={title}>{CHIP_LABEL[state]}</span>
        </div>
        <div className="tn-cm-name">
          {member ? <span className="tn-cm-n">{member.name}</span> : <span className="tn-cm-vac">Vacant</span>}
          {member && <span className="tn-cm-yrs">{years} {years === 1 ? 'yr' : 'yrs'}</span>}
        </div>
        {member && memory.length > 0 && (
          <div className="tn-cm-tip" role="tooltip">
            <div className="tn-cm-tip-h">Remembers</div>
            {memory.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
      {canAct && (
        <div className="tn-cm-btns">
          {member && state !== 'cut' && <button type="button" className="btn xs" onClick={() => send('cut_member')}>Cut</button>}
          {state === 'cut' && <button type="button" className="btn xs" onClick={() => send('restore_member')}>Restore</button>}
          {member && <button type="button" className="btn xs danger" onClick={kill}>{confirming ? 'Confirm' : 'Kill'}</button>}
        </div>
      )}
    </div>
  );
}
