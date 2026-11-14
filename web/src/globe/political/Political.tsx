// The political map layers drawn over the provinces: borders, then names and flags.
import { Borders } from './Borders';
import { NationLabels } from './NationLabels';

export function Political() {
  return (
    <>
      <Borders />
      <NationLabels />
    </>
  );
}
