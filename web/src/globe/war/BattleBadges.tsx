// #311: a small plate over each battle still going: both flags and both strengths, "12.0k (swords) 21.0k"
// (Age of History 3 style). Clicking it selects the battle (selectedBattleTile). Lane b.
import { useMemo } from 'react';
import { flagSvg, garrisonAt } from '@terra/shared';
import type { FlagSpec } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useActiveBattles, battleInfoOf } from '../../state/battleInfo';
import type { BattleRecord } from '../../state/battleInfo';
import { SOLDIERS_PER_STRENGTH, formatSoldiers } from '../../state/armyInfo';
import { useProvinceMesh } from '../mesh/context';
import { Anchor } from '../status/Anchor';
import { liftPoint } from '../status/geo';
import { STACK } from '../status/cityStack';
import type { P3 } from '../status/geo';
import './battleBadge.css';

function Flag({ spec }: { spec: FlagSpec }) {
  const html = useMemo(() => flagSvg(spec, 18, 12), [spec]);
  return <span className="bb-flag" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Two crossed blades, drawn (not a text glyph). */
function Swords() {
  return (
    <svg className="bb-swords" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M2 2 L11 11 M14 2 L5 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.5 12.5 L12.5 9.5 M3.5 9.5 L6.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Badge({ record, pos }: { record: BattleRecord; pos: P3 }) {
  const world = useWorld((s) => s.world);
  useWorld((s) => s.version);   // the strengths change with every batch
  const selected = useWorld((s) => s.selectedBattleTile === record.tile);
  if (!world) return null;
  const info = battleInfoOf(world, record);
  // No defending army on the tile: the fight is against the province's own garrison (militia from
  // its settlement or fort), so the plate says that instead of "vs 0". Once the tile has changed
  // hands the garrison is gone: the plate says the province was taken.
  const noArmy = info.defender.soldiers <= 0;
  const holds = world.owner[record.tile] === record.defender;
  const garrison = noArmy && holds ? garrisonAt(world, record.tile, record.defender).strength * SOLDIERS_PER_STRENGTH : 0;
  const against = !noArmy ? info.defender.nation : holds ? `the garrison of ${info.defender.nation}` : `${info.defender.nation}, who lost the province`;
  return (
    <Anchor pos={pos} limb={0.25} stack={{ tile: record.tile, priority: STACK.battle }}>
      <button
        type="button"
        className={`bb-plate tn-plate${selected ? ' is-active' : ''}`}
        title={`Battle of ${info.province}: ${info.attacker.nation} against ${against}`}
        onClick={(e) => { e.stopPropagation(); useWorld.getState().selectBattle(record.tile); }}
      >
        <Flag spec={info.attacker.flag} />
        <span className="bb-num">{formatSoldiers(info.attacker.soldiers)}</span>
        <Swords />
        {!noArmy ? <span className="bb-num">{formatSoldiers(info.defender.soldiers)}</span>
          : garrison > 0 ? <><span className="bb-num">{formatSoldiers(garrison)}</span><span className="bb-word">garrison</span></>
          : <span className="bb-word">{holds ? 'garrison' : 'taken'}</span>}
        <Flag spec={info.defender.flag} />
      </button>
    </Anchor>
  );
}

export function BattleBadges() {
  const mesh = useProvinceMesh();
  const battles = useActiveBattles();
  if (!mesh) return null;
  return (
    <>
      {battles.map((b) => (
        <Badge key={`${b.tile}-${b.startTick}`} record={b} pos={liftPoint(mesh.centroidOf([b.tile]) as P3, 0.012)} />
      ))}
    </>
  );
}
