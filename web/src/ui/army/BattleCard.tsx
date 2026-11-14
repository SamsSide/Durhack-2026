// #311: the battle card in the left dock. Attackers on top, the battle grid in the middle, defenders
// below; each side shows its flag, general, strength at the start and now, losses and troops. Lane b's
// ArmyBattleDock (web/src/hud/) mounts it when a battle badge is picked; the data is useBattleInfo (X5).
import { formatSoldiers } from '../../state/armyInfo';
import { useBattleInfo } from '../../state/battleInfo';
import type { BattleInfo, BattleSide } from '../../state/battleInfo';
import { useWorld } from '../../state/world';
import { CloseIcon } from '../card/shared';
import '../card/card.css';
import { Portrait } from '../card/Portrait';
import { FlagPlate } from './ArmyCard';
import { BattleGrid } from './BattleGrid';
import { TroopTile } from './TroopTile';
import { MOCK_BATTLE_TILE, useMockBattle } from './mock';
import './army.css';
import { Roll } from '../motion/Roll';

function Side({ side, label, leading }: { side: BattleSide; label: 'Attackers' | 'Defenders'; leading: boolean }) {
  const kept = side.startSoldiers > 0 ? side.soldiers / side.startSoldiers : 0;
  return (
    <section className={`tn-bside${leading ? ' tn-bside--leading' : ''}`} aria-label={`${label}: ${side.nation}`}>
      <div className="tn-bside-head">
        <FlagPlate flag={side.flag} w={48} h={32} />
        <div className="tn-bside-who">
          <span className="tn-cap">{label}{leading ? ' · winning' : ''}</span>
          <span className="tn-bside-nation">{side.nation}</span>
          <span className="tn-bside-gen">{side.general ? <>General <b>{side.general.name}</b></> : 'No general'}</span>
        </div>
        <Portrait seed={side.general ? side.general.portraitSeed : null} role="general" color={side.color} size={40} bezel />
      </div>
      <div className="tn-bside-stats">
        <div className="tn-stat" title={`${side.startSoldiers.toLocaleString('en-GB')} when the battle began`}>
          <span className="tn-stat__label">At start</span><span className="tn-stat__value">{formatSoldiers(side.startSoldiers)}</span>
        </div>
        <div className="tn-stat" title={`${side.soldiers.toLocaleString('en-GB')} still fighting`}>
          <span className="tn-stat__label">Now</span><span className="tn-stat__value"><Roll value={side.soldiers} format={formatSoldiers} fractional /></span>
        </div>
        <div className="tn-stat tn-bside-lost" title={`${side.lostSoldiers.toLocaleString('en-GB')} fallen`}>
          <span className="tn-stat__label">Lost</span><span className="tn-stat__value"><Roll value={side.lostSoldiers} format={formatSoldiers} fractional /></span>
        </div>
      </div>
      <span className="tn-trough tn-bside-trough" role="img" aria-label={`${Math.round(kept * 100)}% still standing`}>
        <i className="tn-trough__fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, kept))})`, ['--fill' as string]: side.color }} />
      </span>
      <div className="tn-troops tn-troops--sm">
        {side.troops.map((g) => <TroopTile key={g.role} group={g} age={side.techAge} color={side.color} compact />)}
      </div>
    </section>
  );
}

export function BattleCard({ tile }: { tile: number }) {
  const mock = tile === MOCK_BATTLE_TILE;
  const live = useBattleInfo(mock ? null : tile);
  const mocked = useMockBattle(mock);
  const b: BattleInfo | null = mock ? mocked : live;
  const close = () => useWorld.getState().selectBattle(null);

  if (!b) {
    return (
      <div className="tn-sheet tn-frame tn-frame--corners tn-card tn-battle">
        <span className="tn-cartouche">Battle</span>
        <div className="tn-card-body">
          <header className="tn-head">
            <div className="tn-head-text"><h2 className="tn-name tn-engraved">No battle here</h2></div>
            <button type="button" className="tn-close tn-button tn-button--lacquer tn-button--round" aria-label="Close" onClick={close}><CloseIcon /></button>
          </header>
          <p className="tn-army-empty">No clash has been seen on this field since the page loaded. Battles show here from their first clash.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tn-sheet tn-frame tn-frame--corners tn-card tn-battle">
      <span className="tn-cartouche">{b.active ? 'Battle raging' : 'Battle over'}</span>
      <div className="tn-card-body">
        <header className="tn-head tn-battle-head">
          <div className="tn-head-text">
            <h2 className="tn-name tn-engraved">Battle of {b.province}</h2>
            <div className="tn-battle-when">
              <span className="tn-battle-dur">{b.durationText}</span>
              <span className="tn-battle-since">since Y{b.startYear}</span>
            </div>
          </div>
          <button type="button" className="tn-close tn-button tn-button--lacquer tn-button--round" aria-label="Close" onClick={close}><CloseIcon /></button>
        </header>

        <Side side={b.attacker} label="Attackers" leading={b.leader === 'attacker'} />
        <BattleGrid line={b.line} attackerColor={b.attacker.color} defenderColor={b.defender.color} active={b.active} />
        <Side side={b.defender} label="Defenders" leading={b.leader === 'defender'} />
      </div>
    </div>
  );
}
