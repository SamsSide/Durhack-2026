// A `belief` reply is one-shot, so while a nation's own view is on screen ask again every 2 s. Lane b (B7).
import { useEffect } from 'react';
import { useWorld } from '../../state/world';

export function useBeliefRefresh(): void {
  const beliefOf = useWorld((s) => s.beliefOf);
  useEffect(() => {
    if (beliefOf == null) return;
    const id = setInterval(() => useWorld.getState().send({ type: 'belief', countryId: beliefOf }), 2000);
    return () => clearInterval(id);
  }, [beliefOf]);
}
