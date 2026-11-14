import { useState } from 'react';

export function CreateScreen() {
  const [prompt, setPrompt] = useState('A drowned world where salt kingdoms trade over the old coastlines');
  const [nations, setNations] = useState(6);
  const [era, setEra] = useState('post-apocalyptic');
  const [seaLevel, setSeaLevel] = useState(0.55);
  const [aggression, setAggression] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/world', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, nations, era, seaLevel, aggression }),
      });
      if (!res.ok) throw new Error(`server said ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const row = { display: 'grid', gridTemplateColumns: '110px 1fr', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' } as const;
  return (
    <div className="panel" style={{ width: 460 }}>
      <h2>Found a world</h2>
      <p className="muted" style={{ marginTop: 0 }}>Describe it, and the nations will write the rest.</p>
      <textarea rows={4} style={{ width: '100%', marginBottom: 'var(--space-3)' }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <label style={row}>Nations
        <input type="number" min={2} max={12} value={nations} onChange={(e) => setNations(Number(e.target.value))} />
      </label>
      <label style={row}>Era
        <select value={era} onChange={(e) => setEra(e.target.value)}>
          {['ancient', 'medieval', 'industrial', 'modern', 'post-apocalyptic', 'far future'].map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label style={row}>Sea level {seaLevel.toFixed(2)}
        <input type="range" min={0.3} max={0.8} step={0.01} value={seaLevel} onChange={(e) => setSeaLevel(Number(e.target.value))} />
      </label>
      <label style={row}>Aggression {aggression.toFixed(2)}
        <input type="range" min={0} max={1} step={0.01} value={aggression} onChange={(e) => setAggression(Number(e.target.value))} />
      </label>
      {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
      <button className="btn" disabled={busy || !prompt.trim()} onClick={submit}>{busy ? 'Founding...' : 'Create world'}</button>
    </div>
  );
}
