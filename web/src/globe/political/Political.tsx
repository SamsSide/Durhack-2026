// The political map layers drawn over the provinces: borders, capitals, stale beliefs, then names and flags.
import { Borders } from './Borders';
import { BeliefBorders } from './BeliefBorders';
import { Capitals } from './Capitals';
import { NationLabels } from './NationLabels';

export function Political() {
  return (
    <>
      <Borders />
      <BeliefBorders />
      <Capitals />
      <NationLabels />
    </>
  );
}
