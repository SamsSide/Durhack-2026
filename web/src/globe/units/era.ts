// Which unit icon a counter gets: from the owner's technology age (X1 TechAge), else from keywords
// in the world's era text. Lane b (B5).
import type { TechAge, UnitKind } from '@terra/shared';
import type { IconKind } from './draw';

const RULES: Array<[RegExp, IconKind]> = [
  [/post-?apocalyp|drowned|wasteland|ruined|fallout/i, 'buggy'],
  [/future|sci-?fi|space|cyber|star|galactic|orbital|android|robot/i, 'drone'],
  [/industrial|modern|world war|19\d\d|20\d\d|steam|diesel|atomic|cold war/i, 'tank'],
  [/gunpowder|colonial|renaissance|17\d\d|18\d\d|musket|napoleon|age of sail|enlighten/i, 'musket'],
  [/medieval|feudal|fantasy|knight|castle|viking|crusade|dark age/i, 'sword'],
  [/ancient|bronze|classical|iron age|stone|antiquity|roman|greek|myth/i, 'spear'],
];

const AGE_ICON: Record<TechAge, IconKind> = {
  ancient: 'spear', medieval: 'sword', gunpowder: 'musket', industrial: 'rifle', modern: 'tank',
};

export function eraIcon(era: string): IconKind {
  for (const [re, icon] of RULES) if (re.test(era)) return icon;
  return 'sword';
}

/** The nation's age decides the army icon; with no age, the world's era text does. */
export function unitIcon(kind: UnitKind, era: string, age?: TechAge): IconKind {
  if (kind === 'fleet' || kind === 'trader') return 'ship';
  if (kind === 'settler') return 'wagon';
  return (age && AGE_ICON[age]) || eraIcon(era);
}
