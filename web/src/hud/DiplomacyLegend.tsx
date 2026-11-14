import { useWorld } from '../state/world';
import './hud.css';

const STANCES: [string, string][] = [
  ['War', 'var(--stance-war)'],
  ['Hostile', 'var(--stance-hostile)'],
  ['Neutral', 'var(--stance-neutral)'],
  ['Trade', 'var(--stance-trade)'],
  ['Alliance', 'var(--stance-alliance)'],
];

export function DiplomacyLegend({ hidden = false }: { hidden?: boolean }) {
  const world = useWorld((s) => s.world);
  const selected = useWorld((s) => s.selectedCountryId);
  const mapMode = useWorld((s) => s.mapMode);
  if (hidden || !world || mapMode !== 'diplomacy') return null;
  const country = selected != null ? world.countries.find((c) => c.id === selected) : undefined;
  return (
    <div className="hud legend-box tn-lacquer tn-frame">
      <div className="cap tn-cartouche">Diplomacy</div>
      <div className="muted">{country ? `Towards ${country.name}` : 'Select a nation to see its friends and enemies'}</div>
      {country && (
        <div className="lg-row"><span className="lg-sw" style={{ background: 'var(--color-accent)' }} />{country.name}</div>
      )}
      {STANCES.map(([label, colour]) => (
        <div className="lg-row" key={label}><span className="lg-sw" style={{ background: colour }} />{label}</div>
      ))}
    </div>
  );
}
