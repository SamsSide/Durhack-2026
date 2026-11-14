import { useWorld } from '../state/world';
import './hud.css';

export function BeliefBanner() {
  const world = useWorld((s) => s.world);
  const beliefOf = useWorld((s) => s.beliefOf);
  const showBelief = useWorld((s) => s.showBelief);
  if (!world || beliefOf == null) return null;
  const name = world.countries.find((c) => c.id === beliefOf)?.name ?? 'a nation';
  return (
    <div className="belief-banner">
      <span className="cap">Beliefs</span>
      <span>Showing what <b>{name}</b> believes</span>
      <button className="btn" onClick={() => showBelief(null)}>Show the truth</button>
    </div>
  );
}
