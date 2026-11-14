// Which unit icon an era's armies get, from keywords in the world's era text. Lane b (B5).
import type { UnitKind } from '@terra/shared';
import type { IconKind } from './draw';

const RULES: Array<[RegExp, IconKind]> = [
  [/post-?apocalyp|drowned|wasteland|ruined|fallout/i, 'buggy'],
  [/future|sci-?fi|space|cyber|star|galactic|orbital|android|robot/i, 'drone'],
  [/industrial|modern|world war|19\d\d|20\d\d|steam|diesel|atomic|cold war/i, 'tank'],
  [/gunpowder|colonial|renaissance|17\d\d|18\d\d|musket|napoleon|age of sail|enlighten/i, 'musket'],
  [/medieval|feudal|fantasy|knight|castle|viking|crusade|dark age/i, 'sword'],
  [/ancient|bronze|classical|iron age|stone|antiquity|roman|greek|myth/i, 'spear'],
];

export function eraIcon(era: string): IconKind {
  for (const [re, icon] of RULES) if (re.test(era)) return icon;
  return 'sword';
}

export function unitIcon(kind: UnitKind, era: string): IconKind {
  if (kind === 'fleet') return 'ship';
  if (kind === 'settler') return 'wagon';
  return eraIcon(era);
}
