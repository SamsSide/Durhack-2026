// #311: the army card in the left dock, an atlas sheet like the nation card. Lane b's ArmyBattleDock
// (web/src/hud/) mounts it when an army is picked on the globe; the data is useArmyInfo (X5).
import { flagSvg } from '@terra/shared';
import type { FlagSpec } from '@terra/shared';
import { formatSoldiers, useArmyInfo } from '../../state/armyInfo';
import type { ArmyInfo } from '../../state/armyInfo';
import { useBattleInfo } from '../../state/battleInfo';
import { useWorld } from '../../state/world';
import { Portrait } from '../card/Portrait';
import { CloseIcon, Meter, nameClass } from '../card/shared';
import '../card/card.css';
import { TroopTile } from './TroopTile';
import { MOCK_BATTLE_TILE, MOCK_UNIT_ID, mockArmyInfo } from './mock';
import './army.css';
import { Roll } from '../motion/Roll';

export const AGE_LABEL: Record<ArmyInfo['techAge'], string> = {
  ancient: 'Ancient', medieval: 'Medieval', gunpowder: 'Gunpowder', industrial: 'Industrial',
  modern: 'Modern', future: 'Future', stellar: 'Stellar',
};

/** The fill colour of the war-readiness trough (the same scale as the nation card). */
const readinessFill = (r: number) => (r < 25 ? 'var(--color-ok)' : r < 50 ? 'var(--gilt)' : r < 75 ? 'var(--stance-hostile)' : 'var(--stance-war)');

export function FlagPlate({ flag, w = 64, h = 44, className = '' }: { flag: FlagSpec; w?: number; h?: number; className?: string }) {
  return (
    <div className={`tn-flag-plate tn-army-flag ${className}`} style={{ width: w, height: h }}
      dangerouslySetInnerHTML={{ __html: flagSvg(flag, w, h) }} />
  );
}

/** The general's line: a portrait in a gilt roundel, the title and the name. */
export function GeneralLine({ general, color, size = 42, label = 'General' }: { general: ArmyInfo['general']; color: string; size?: number; label?: string }) {
  return (
    <div className="tn-gen">
      <Portrait seed={general ? general.portraitSeed : null} role="general" color={color} size={size} bezel />
      <div className="tn-gen-text">
        <span className="tn-cap">{label}</span>
        <span className="tn-gen-name">{general ? general.name : 'No general'}</span>
      </div>
    </div>
  );
}

export function ArmyCard({ unitId }: { unitId: string }) {
  const mock = unitId === MOCK_UNIT_ID;
  const live = useArmyInfo(mock ? null : unitId);
  const info = mock ? mockArmyInfo() : live;
  const statusTile = info?.status.kind === 'fighting' ? info.status.tile : null;
  const battle = useBattleInfo(mock ? null : statusTile);
  const hasBattle = mock ? statusTile === MOCK_BATTLE_TILE : battle != null;
  const close = () => useWorld.getState().selectUnit(null);

  if (!info) {
    return (
      <div className="tn-sheet tn-frame tn-frame--corners tn-card tn-army">
        <span className="tn-cartouche">Army</span>
        <div className="tn-card-body">
          <header className="tn-head">
            <div className="tn-head-text"><h2 className="tn-name tn-engraved">Army disbanded</h2></div>
            <button type="button" className="tn-close tn-button tn-button--lacquer tn-button--round" aria-label="Close" onClick={close}><CloseIcon /></button>
          </header>
          <p className="tn-army-empty">This army has left the field: it was destroyed, disbanded or merged into another.</p>
        </div>
      </div>
    );
  }

  const title = `Army of ${info.nation}`;
  return (
    <div className="tn-sheet tn-frame tn-frame--corners tn-card tn-army">
      <span className="tn-cartouche">{AGE_LABEL[info.techAge]} army</span>
      <div className="tn-card-body">
        <header className="tn-head">
          <FlagPlate flag={info.flag} />
          <div className="tn-head-text">
            <h2 className={nameClass(title)}>{title}</h2>
            <div className={`tn-army-status tn-army-status--${info.status.kind}`}>
              <i aria-hidden="true" />{info.status.text}
            </div>
          </div>
          <button type="button" className="tn-close tn-button tn-button--lacquer tn-button--round" aria-label="Close" onClick={close}><CloseIcon /></button>
        </header>

        <GeneralLine general={info.general} color={info.color} />

        <div className="tn-grid tn-army-grid">
          <div className="tn-stat" title={`Strength ${info.strength}, about ${info.soldiers.toLocaleString('en-GB')} soldiers`}>
            <span className="tn-stat__label">Soldiers</span>
            <span className="tn-stat__value"><Roll value={info.soldiers} /></span>
          </div>
          <div className="tn-stat" title="The unit strength the counter on the globe shows">
            <span className="tn-stat__label">Strength</span>
            <span className="tn-stat__value">{info.strength}</span>
          </div>
        </div>
        <div className="tn-meters">
          <Meter label="Readiness" value={String(Math.round(info.readiness))} pct={info.readiness} fill={readinessFill(info.readiness)} seg
            title={`War readiness of ${info.nation}: ${Math.round(info.readiness)} of 100`} />
          <div className="tn-army-band"><span className={`tn-chip tn-chip--caps tn-chip--sm${info.readinessBand === 'Total war' ? ' tn-chip--war' : info.readinessBand === 'Mobilised' ? ' tn-chip--hostile' : ''}`}>{info.readinessBand}</span></div>
        </div>

        <h3 className="tn-header-bar">Troops</h3>
        <div className="tn-troops">
          {info.composition.map((g) => <TroopTile key={g.role} group={g} age={info.techAge} color={info.color} />)}
        </div>
        <p className="tn-army-total">{formatSoldiers(info.soldiers)} in the field, in {AGE_LABEL[info.techAge].toLowerCase()} order of battle</p>

        {hasBattle && statusTile != null && (
          <button type="button" className="tn-button tn-army-go" onClick={() => useWorld.getState().selectBattle(statusTile)}>
            View the battle of {info.status.province}
          </button>
        )}
      </div>
    </div>
  );
}
