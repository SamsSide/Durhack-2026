// #311: one troop tile of the army and battle cards: a small drawn vignette of the role in its age
// (original ink art, no game assets), the age's troop name and the head count.
import type { ReactNode } from 'react';
import type { TechAge } from '@terra/shared';
import type { TroopGroup } from '../../state/armyInfo';

type Era = 'old' | 'powder' | 'machine';
const ERA: Record<TechAge, Era> = {
  ancient: 'old', medieval: 'old', gunpowder: 'powder', industrial: 'powder',
  modern: 'machine', future: 'machine', stellar: 'machine',
};

const ROLE_LABEL: Record<TroopGroup['role'], string> = { front: 'Front', flank: 'Flank', back: 'Back' };

const ink = 'var(--color-ink)';

/** The role's figure for its age, on a 24x24 box. `color` is the nation's colour (shields, hulls). */
export function RoleIcon({ role, age, color, size = 24 }: { role: TroopGroup['role']; age: TechAge; color: string; size?: number }) {
  const era = ERA[age];
  let body: ReactNode;
  if (role === 'front' && era === 'old') {
    // spear and heater shield
    body = (
      <>
        <path d="M4.5 21.5 L18.5 4" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M18.5 4 L20.8 1.6 L20.2 5.1 Z" fill={ink} />
        <path d="M7.5 8 H17 V13.5 C17 17.5 12.25 20 12.25 20 C12.25 20 7.5 17.5 7.5 13.5 Z" fill={color} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M12.25 8.5 V19.2 M7.9 12 H16.6" stroke={ink} strokeWidth="0.8" opacity=".55" />
      </>
    );
  } else if (role === 'front' && era === 'powder') {
    // musket with bayonet, and a cartridge box in the nation's colour
    body = (
      <>
        <path d="M3.5 20.5 L6.8 17.2 L8.4 18.8 L5.1 22.1 Z" fill={ink} />
        <path d="M6.5 17.6 L19 5.1" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        <path d="M19 5.1 L22 2" stroke={ink} strokeWidth="0.9" strokeLinecap="round" />
        <rect x="12.5" y="14" width="7" height="5.5" rx="0.8" fill={color} stroke={ink} strokeWidth="1.2" />
        <path d="M12.5 15.8 H19.5" stroke={ink} strokeWidth="0.8" opacity=".6" />
      </>
    );
  } else if (role === 'front') {
    // a helmet with a visor band
    body = (
      <>
        <path d="M4.5 15.5 C4.5 8.5 8 5 12 5 C16 5 19.5 8.5 19.5 15.5 Z" fill={color} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M2.5 15.5 H21.5" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 11 H17" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 5 V9" stroke={ink} strokeWidth="0.8" opacity=".55" />
        <path d="M8 18.5 L10 15.5 M16 18.5 L14 15.5" stroke={ink} strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  } else if (role === 'flank' && era !== 'machine') {
    // a horse's head, a saddle cloth in the nation's colour
    body = (
      <>
        <path d="M6 21.5 L7.6 13.5 C7.8 8.5 10.8 5.2 14.6 4.3 L15.6 1.8 L16.9 4.5 C19.3 5.6 21 8.2 21.2 10.6 L19.3 12 L16.2 10.5 C15.2 13.6 15.3 17.4 16.5 21.5 Z" fill={ink} />
        <circle cx="16.4" cy="7.4" r="0.9" fill="var(--color-parchment-light)" />
        <path d="M8.2 12 C9.5 9 11.5 7 14 6" stroke="var(--color-parchment-light)" strokeWidth="0.8" fill="none" opacity=".5" />
        <path d="M6.3 21.5 L7.2 17 H15.8 L16.4 21.5 Z" fill={color} stroke={ink} strokeWidth="1" />
      </>
    );
  } else if (role === 'flank') {
    // a tank: hull, turret, gun and tracks
    body = (
      <>
        <path d="M8 9.5 H15.5 L16.5 13.5 H7 Z" fill={color} stroke={ink} strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M15.8 11 L22.5 8.6" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M2.5 13.5 H21.5 L19.5 18.5 H4.5 Z" fill={color} stroke={ink} strokeWidth="1.3" strokeLinejoin="round" />
        <rect x="3.5" y="17.5" width="17" height="4" rx="2" fill={ink} />
        <circle cx="6.5" cy="19.5" r="0.9" fill="var(--color-parchment-light)" /><circle cx="10.2" cy="19.5" r="0.9" fill="var(--color-parchment-light)" />
        <circle cx="13.8" cy="19.5" r="0.9" fill="var(--color-parchment-light)" /><circle cx="17.5" cy="19.5" r="0.9" fill="var(--color-parchment-light)" />
      </>
    );
  } else if (role === 'back' && era === 'old') {
    // a drawn bow with a nocked arrow
    body = (
      <>
        <path d="M8 2.5 Q22 12 8 21.5" stroke={ink} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M8 2.5 L5 12 L8 21.5" stroke={ink} strokeWidth="0.8" fill="none" />
        <path d="M5 12 H21" stroke={ink} strokeWidth="1.2" />
        <path d="M21 12 L18.3 10.4 L18.3 13.6 Z" fill={ink} />
        <path d="M5 12 L2.6 10.2 M5 12 L2.6 13.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </>
    );
  } else if (role === 'back' && (era === 'powder' || age === 'modern')) {
    // a field gun: barrel, carriage and a spoked wheel
    body = (
      <>
        <path d="M3 14.5 L19.5 7 L21 10.2 L4.6 17.6 Z" fill={ink} />
        <path d="M5 17 L14 20.5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        <circle cx="9.5" cy="16.5" r="4.6" fill={color} stroke={ink} strokeWidth="1.4" />
        <path d="M9.5 12 V21 M5 16.5 H14 M6.3 13.3 L12.7 19.7 M12.7 13.3 L6.3 19.7" stroke={ink} strokeWidth="0.8" />
        <circle cx="9.5" cy="16.5" r="1.2" fill={ink} />
      </>
    );
  } else {
    // a drone: body, four arms and rotors
    body = (
      <>
        <path d="M6 6 L18 18 M18 6 L6 18" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        {[[6, 6], [18, 6], [6, 18], [18, 18]].map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="4" ry="1.3" fill="none" stroke={ink} strokeWidth="1" />
        ))}
        <circle cx="12" cy="12" r="3.6" fill={color} stroke={ink} strokeWidth="1.3" />
        <circle cx="12" cy="12" r="1.1" fill={ink} />
      </>
    );
  }
  return (
    <svg className="tn-role-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{body}</svg>
  );
}

/** One troop tile: the vignette, the role, the troop name and how many are left (of how many, on a battle side). */
export function TroopTile({ group, age, color, of, compact = false }: { group: TroopGroup; age: TechAge; color: string; of?: number; compact?: boolean }) {
  const gone = group.soldiers <= 0;
  return (
    <div className={`tn-troop${compact ? ' tn-troop--sm' : ''}${gone ? ' tn-troop--gone' : ''}`}
      title={`${ROLE_LABEL[group.role]}: ${group.name}, ${group.soldiers.toLocaleString('en-GB')}${of != null ? ` of ${of.toLocaleString('en-GB')}` : ''}`}>
      <div className="tn-troop-pic">
        <span className="tn-troop-role">{ROLE_LABEL[group.role]}</span>
        <RoleIcon role={group.role} age={age} color={color} size={compact ? 28 : 40} />
      </div>
      <div className="tn-troop-name">{group.name}</div>
      <div className="tn-troop-n">{group.soldiers.toLocaleString('en-GB')}</div>
    </div>
  );
}
