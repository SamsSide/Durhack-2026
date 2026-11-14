// Owner #317: the war report on a news war beat: both flags, the two armies and what each side has
// lost, over the live picture of the battle. Numbers come from lane b's battle store (X5,
// state/battleInfo.ts) when this browser saw the battle, else from the server's beat (NewsBattle).
import { useMemo } from 'react';
import { flagSvg } from '@terra/shared';
import type { FlagSpec, NewsBattle } from '@terra/shared';
import { useWorld } from '../../state/world';
import { useBattleInfo } from '../../state/battleInfo';
import { SOLDIERS_PER_STRENGTH, formatSoldiers } from '../../state/armyInfo';

function Flag({ spec, name }: { spec: FlagSpec; name: string }) {
  const html = useMemo(() => flagSvg(spec, 30, 20), [spec]);
  return <span className="tn-flag-plate tn-warrep-flag" title={name} dangerouslySetInnerHTML={{ __html: html }} />;
}

interface Side { id: number; name: string; flag: FlagSpec; soldiers: number | null; lost: number | null }

export function WarReport({ battle }: { battle: NewsBattle }) {
  const world = useWorld((s) => s.world);
  useWorld((s) => s.version);
  const info = useBattleInfo(battle.tile);
  if (!world) return null;
  const a = world.countries[battle.attackerId], d = world.countries[battle.defenderId];
  if (!a || !d) return null;
  // the browser's own record of this battle, if it is the same two nations
  const same = info && ((info.attacker.countryId === a.id && info.defender.countryId === d.id) || (info.attacker.countryId === d.id && info.defender.countryId === a.id));
  const soldiersOf = (n: number | undefined) => (n == null ? null : n * SOLDIERS_PER_STRENGTH);
  const sides: [Side, Side] = same
    ? [info!.attacker, info!.defender].map((x) => ({ id: x.countryId, name: x.nation, flag: x.flag, soldiers: x.soldiers, lost: x.lostSoldiers })) as [Side, Side]
    : [
      { id: a.id, name: a.name, flag: a.flag, soldiers: soldiersOf(battle.strength?.attacker), lost: soldiersOf(battle.losses?.attacker) },
      { id: d.id, name: d.name, flag: d.flag, soldiers: soldiersOf(battle.strength?.defender), lost: soldiersOf(battle.losses?.defender) },
    ];
  const [l, r] = sides;
  const num = (n: number | null) => (n == null ? '?' : formatSoldiers(n));
  return (
    <div className="tn-warrep" role="group" aria-label={`War report: ${l.name} against ${r.name}`}>
      <span className="tn-warrep-title">{same && !/^province \d+$/.test(info!.province) ? `Battle of ${info!.province}` : 'War report'}</span>
      <div className="tn-warrep-row">
        <Flag spec={l.flag} name={l.name} />
        <span className="tn-warrep-num">{num(l.soldiers)}</span>
        <span className="tn-warrep-vs">vs</span>
        <span className="tn-warrep-num">{num(r.soldiers)}</span>
        <Flag spec={r.flag} name={r.name} />
      </div>
      {(l.lost != null || r.lost != null) && (
        <div className="tn-warrep-row tn-warrep-loss">
          <span className="tn-warrep-lost">{l.lost == null ? '' : `-${formatSoldiers(l.lost)}`}</span>
          <span className="tn-warrep-label">lost</span>
          <span className="tn-warrep-lost">{r.lost == null ? '' : `-${formatSoldiers(r.lost)}`}</span>
        </div>
      )}
    </div>
  );
}
