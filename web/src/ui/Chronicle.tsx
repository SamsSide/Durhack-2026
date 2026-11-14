import { useWorld } from '../state/world';

export function Chronicle() {
  const world = useWorld((s) => s.world);
  useWorld((s) => s.version);
  if (!world) return null;
  const entries = world.chronicle.slice(-30).reverse();
  return (
    <div className="panel" style={{ height: 150, overflowY: 'auto', padding: 'var(--space-2) var(--space-4)' }}>
      <h3>Chronicle</h3>
      {entries.length === 0 && <div className="muted">Nothing has been written yet.</div>}
      {entries.map((e) => (
        <div key={e.id} style={{ fontSize: 14, marginBottom: 2 }}>
          <span className="muted" style={{ fontFamily: 'var(--font-mono)', marginRight: 'var(--space-2)' }}>Y{e.year}</span>
          {e.text}
        </div>
      ))}
    </div>
  );
}
