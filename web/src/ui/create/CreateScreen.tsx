// C1: the Create panel. App.tsx (lane b) mounts it over a scrim and closes it when world.id changes.
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useWorld } from '../../state/world';
import './create.css';

interface Replay { id: string; name: string; events: number }

const ERAS = ['Stone age', 'Bronze age', 'Classical', 'Medieval', 'Age of sail', 'Industrial', 'Post-apocalyptic', 'Far future'];
const WAIT_MS = 30000;

async function postJson(url: string, body?: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return { ok: true };
    let error = '';
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') error = data.error;
    } catch { /* not json */ }
    return { ok: false, error: error || 'Could not reach the server' };
  } catch {
    return { ok: false, error: 'Could not reach the server' };
  }
}

export function CreateScreen() {
  const connected = useWorld((s) => s.connected);
  const [prompt, setPrompt] = useState('');
  const [nations, setNations] = useState(6);
  const [era, setEra] = useState('');
  const [seaLevel, setSeaLevel] = useState(0.55);
  const [aggression, setAggression] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replays, setReplays] = useState<Replay[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/replays', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) {
          setReplays(data.filter((x) => x && typeof x.id === 'string' && typeof x.name === 'string')
            .map((x) => ({ id: x.id, name: x.name, events: Number(x.events) || 0 })));
        }
      })
      .catch(() => { /* hidden when failing */ });
    return () => ctrl.abort();
  }, []);

  const run = async (request: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    window.clearTimeout(timer.current);
    const result = await request();
    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? 'Could not reach the server');
      return;
    }
    // Stay busy until the snapshot arrives (this panel then unmounts).
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setError('The world is taking a while. Try again.');
    }, WAIT_MS);
  };

  const submit = () => {
    if (busy || !prompt.trim()) return;
    const body: Record<string, unknown> = { prompt: prompt.trim(), nations, seaLevel, aggression };
    if (era) body.era = era.toLowerCase();
    void run(() => postJson('/api/world', body));
  };

  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit(); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };

  return (
    <form className="panel tn-create" onSubmit={onSubmit} aria-busy={busy}>
      <h2 className="tn-create-title">Terra Nova</h2>
      <p className="tn-create-sub">Describe a world. Its nations will do the rest.</p>

      <fieldset className="tn-create-set" disabled={busy}>
        <textarea
          className="tn-create-prompt"
          rows={3}
          autoFocus
          value={prompt}
          placeholder="a drowned post-apocalyptic world"
          aria-label="Describe your world"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKey}
        />

        <details className="tn-create-more">
          <summary>More options</summary>
          <div className="tn-create-opts">
            <label className="tn-create-row">
              <span className="tn-create-label">Nations <b>{nations}</b></span>
              <input type="range" min={3} max={10} step={1} value={nations} onChange={(e) => setNations(Number(e.target.value))} />
            </label>
            <label className="tn-create-row">
              <span className="tn-create-label">Era</span>
              <select value={era} onChange={(e) => setEra(e.target.value)}>
                <option value="">Let the world decide</option>
                {ERAS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <label className="tn-create-row">
              <span className="tn-create-label">Sea level <b>{seaLevel.toFixed(2)}</b></span>
              <input type="range" min={0.3} max={0.8} step={0.05} value={seaLevel} onChange={(e) => setSeaLevel(Number(e.target.value))} />
              <span className="tn-create-ends"><span>Dry</span><span>Drowned</span></span>
            </label>
            <label className="tn-create-row">
              <span className="tn-create-label">Aggression <b>{aggression.toFixed(2)}</b></span>
              <input type="range" min={0} max={1} step={0.05} value={aggression} onChange={(e) => setAggression(Number(e.target.value))} />
              <span className="tn-create-ends"><span>Peaceful</span><span>Warlike</span></span>
            </label>
          </div>
        </details>

        <button type="submit" className="btn tn-create-go" disabled={busy || !prompt.trim()}>Create</button>
      </fieldset>

      {busy && (
        <div className="tn-create-wait" role="status">
          <span>Composing your world…</span>
          <span className="tn-create-pulse" />
        </div>
      )}
      {!busy && error && <p className="tn-create-error" role="alert">{error}</p>}
      {!connected && !busy && <p className="tn-create-quiet">Connecting to the server…</p>}

      {replays.length > 0 && (
        <section className="tn-create-saved">
          <h3>Saved worlds</h3>
          <ul>
            {replays.map((r) => (
              <li key={r.id}>
                <span className="tn-create-rname">{r.name}</span>
                <span className="tn-create-rev">{r.events.toLocaleString('en-GB')} events</span>
                <button type="button" className="btn" disabled={busy} onClick={() => void run(() => postJson(`/api/replays/${encodeURIComponent(r.id)}/play`))}>Replay</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
