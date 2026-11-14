import { useWorld } from '../state/world';

export function NetworkPanel() {
  const world = useWorld((s) => s.world);
  const agents = useWorld((s) => s.agents);
  const beliefOf = useWorld((s) => s.beliefOf);
  const send = useWorld((s) => s.send);
  const showBelief = useWorld((s) => s.showBelief);
  const selected = useWorld((s) => s.selectedCountryId);
  const select = useWorld((s) => s.select);
  if (!world) return null;

  const control = (action: string, countryId: number) => send({ type: 'control', action, countryId });
  return (
    <div className="panel" style={{ width: 300, maxHeight: '100%', overflowY: 'auto' }}>
      <h3>Network</h3>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button className="btn danger" onClick={() => send({ type: 'control', action: 'blackout', value: true })}>Blackout</button>
        <button className="btn" onClick={() => send({ type: 'control', action: 'blackout', value: false })}>Restore all</button>
        <button className={`btn ${beliefOf != null ? 'active' : ''}`} onClick={() => showBelief(beliefOf != null ? null : selected)} disabled={beliefOf == null && selected == null}>
          Show beliefs
        </button>
      </div>
      {world.countries.map((c) => {
        const a = agents.find((x) => x.countryId === c.id);
        if (!a) return null;
        return (
          <div key={c.id} style={{ borderTop: '1px solid var(--color-ink-muted)', padding: 'var(--space-2) 0', opacity: a.deleted ? 0.5 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }} onClick={() => select(c.id)}>
              <span style={{ width: 12, height: 12, background: c.color, border: '1px solid var(--color-ink)', display: 'inline-block' }} />
              <b style={{ flex: 1, fontWeight: c.id === selected ? 700 : 500 }}>{c.name}</b>
              <span className="muted" style={{ fontSize: 12 }}>
                {a.deleted ? 'deleted' : `${a.link} / ${a.ruler}`}
              </span>
            </div>
            {!a.deleted && (
              <div style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)', flexWrap: 'wrap' }}>
                <button className="btn" onClick={() => control(a.link === 'up' ? 'cut' : 'restore', c.id)}>{a.link === 'up' ? 'Cut' : 'Restore'}</button>
                <button className="btn" onClick={() => control(a.ruler === 'llm' ? 'silence' : 'wake', c.id)}>{a.ruler === 'llm' ? 'Silence' : 'Wake'}</button>
                <button className="btn danger" onClick={() => control('delete', c.id)}>Delete</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
