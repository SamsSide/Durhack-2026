// Agent status on the globe (B7): cut, autopilot, deleted, disputes, returns, belief refresh. Lane b.
import './status.css';
import { StatusRings } from './StatusRings';
import { StatusMarkers } from './StatusMarkers';
import { StatusEffects } from './StatusEffects';
import { useBeliefRefresh } from './useBeliefRefresh';

export function Status() {
  useBeliefRefresh();
  return (
    <>
      <StatusRings />
      <StatusMarkers />
      <StatusEffects />
    </>
  );
}
