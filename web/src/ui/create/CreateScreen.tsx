// C1: the Create panel. App.tsx (lane b) mounts it over a scrim and closes it when world.id changes.
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent, FormEvent, KeyboardEvent } from 'react';
import { useWorld } from '../../state/world';
import { pickImage } from './imagePick';
import { expectPreparedWorld } from '../prepare/state';
import '../prepare/prepare.css';
import type { PickedImage } from './imagePick';
import './create.css';

interface Replay { id: string; name: string; events: number }

const ERAS = ['Stone age', 'Bronze age', 'Classical', 'Medieval', 'Age of sail', 'Industrial', 'Clockwork age', 'Ice age', 'Post-apocalyptic', 'Far future'];
const MIN_NATIONS = 3;
const MAX_NATIONS = 10;

const PRESETS: { label: string; era: string; prompt: string }[] = [
  { label: 'Post-apocalyptic', era: 'Post-apocalyptic', prompt: 'A drowned world where salt kingdoms trade over the old coastlines' },
  { label: 'Bronze age', era: 'Bronze age', prompt: 'River valleys of walled cities, bronze-armed kings and rival temple priesthoods' },
  { label: 'Floating archipelago', era: 'Far future', prompt: 'Sky islands tethered by rope bridges, each ruled by a guild of cloud-sailors' },
  { label: 'Ice world', era: 'Ice age', prompt: 'A frozen planet where fur clans and ice-engineers fight over the last warm springs' },
  { label: 'Desert empires', era: 'Classical', prompt: 'Sunbaked empires of caravan lords who war over wells, salt roads and old ruins' },
  { label: 'Clockwork age', era: 'Industrial', prompt: 'Brass-and-steam republics whose automaton armies answer to rival inventor-queens' },
  { label: 'Jungle city-states', era: 'Medieval', prompt: 'Vine-choked city-states of stepped pyramids, river traders and feuding sun cults' },
];
const WAIT_MS = 30000;
const STEP_MS = 1200;
const SPEED_UP_MS = 350;   // the first two steps tick at once, so a mock world still shows progress

function foundingSteps(n: number): string[] {
  return ['Raising the continents', `Drawing ${n} borders`, 'Naming the nations and their rulers', 'Writing their founding myths', `Raising ${n} flags`];
}

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
  const mode = useWorld((s) => s.budget?.mode);
  const [prompt, setPrompt] = useState('');
  const [preset, setPreset] = useState<string | null>(null);
  const [nations, setNations] = useState(6);
  const [era, setEra] = useState('');
  const [seaLevel, setSeaLevel] = useState(0.55);
  const [aggression, setAggression] = useState(0.5);
  const [prepare, setPrepare] = useState(false);   // X3 `prepare: true`: the world is created paused and pre-made for a demo
  const [busy, setBusy] = useState(false);
  const [founding, setFounding] = useState(false);
  const [stage, setStage] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [picture, setPicture] = useState<(PickedImage & { name: string }) | null>(null);
  const [pictureError, setPictureError] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // The founding steps run on a timer, not real progress: the last one waits for the snapshot.
  useEffect(() => {
    if (!founding) return;
    setStage(2);
    let current = 2;
    let id = window.setTimeout(function tick() {
      current += 1;
      setStage(current);
      if (current < 4) id = window.setTimeout(tick, STEP_MS);
    }, SPEED_UP_MS);
    return () => window.clearTimeout(id);
  }, [founding]);

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

  const run = async (request: () => Promise<{ ok: boolean; error?: string }>, scroll = false) => {
    setBusy(true);
    setFounding(scroll);
    setError(null);
    window.clearTimeout(timer.current);
    const result = await request();
    if (!result.ok) {
      setBusy(false);
      setFounding(false);
      setError(result.error ?? 'Could not reach the server');
      return;
    }
    // Stay busy until the snapshot arrives (this panel then unmounts).
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setFounding(false);
      setError('The world is taking a while. Try again.');
    }, WAIT_MS);
  };

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = await pickImage(file);
      setPicture({ ...img, name: file.name });
      setPictureError(false);
    } catch {
      setPictureError(true);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void takeFile(e.dataTransfer.files[0]);
  };
  const onZoneKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); }
  };
  const removePicture = () => { setPicture(null); setPictureError(false); };

  const submit = () => {
    if (busy || !prompt.trim()) return;
    const body: Record<string, unknown> = { prompt: prompt.trim(), nations, seaLevel, aggression };
    if (picture) body.imageBase64 = picture.base64;
    if (era) body.era = era.toLowerCase();
    if (prepare) { body.prepare = true; expectPreparedWorld(); }
    void run(() => postJson('/api/world', body), true);
  };

  const pick = (p: (typeof PRESETS)[number]) => {
    setPreset(p.label);
    setPrompt(p.prompt);
    setEra(p.era);
  };
  const step = (d: number) => setNations((n) => Math.min(MAX_NATIONS, Math.max(MIN_NATIONS, n + d)));

  const onSubmit = (e: FormEvent) => { e.preventDefault(); submit(); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const fill = (v: number, min: number, max: number) => ({ '--tn-fill': `${((v - min) / (max - min)) * 100}%` }) as CSSProperties;
  const modeNote = mode === 'mock' ? 'Mock mode \u00b7 no tokens will be spent' : mode === 'live' ? 'Live \u00b7 Gemini' : '';

  if (founding) {
    const steps = foundingSteps(nations);
    return (
      <section className="panel tn-founding" aria-live="polite" aria-busy="true">
        <span className="tn-cap tn-create-kicker">Founding</span>
        <h2>The scribes are writing your world</h2>
        <p className="tn-fo-prompt">&ldquo;{prompt.trim()}&rdquo;</p>
        <ol className="tn-fo-steps">
          {steps.map((label, i) => {
            const state = i < stage ? 'done' : i === stage ? 'doing' : '';
            return (
              <li key={label} className={`tn-fo-step${state ? ` ${state}` : ''}`}>
                <i aria-hidden="true">
                  {state === 'done' && <svg width="12" height="10" viewBox="0 0 12 10"><path d="M1 5L4.5 8.5L11 1" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>}
                </i>
                {label}
                {state === 'doing' && <span className="tn-fo-pen" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </section>
    );
  }

  return (
    <form className="panel tn-create" onSubmit={onSubmit} aria-busy={busy}>
      <header className="tn-create-head">
        <span className="tn-cap tn-create-kicker">A new world</span>
        <h2 className="tn-create-title">Found a World</h2>
        <p className="tn-create-sub">Describe it in a line. The nations will write the rest.</p>
      </header>

      <fieldset className="tn-create-set" disabled={busy}>
        <div className="tn-create-field">
          <label className="tn-cap" htmlFor="tn-create-prompt">Your world</label>
          <textarea
            id="tn-create-prompt"
            className="tn-create-prompt"
            rows={3}
            autoFocus
            value={prompt}
            placeholder="A drowned post-apocalyptic world"
            onChange={(e) => { setPrompt(e.target.value); setPreset(null); }}
            onKeyDown={onKey}
          />
        </div>

        <div className="tn-create-field">
          <span className="tn-cap">Picture (optional)</span>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => { void takeFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {picture ? (
            <div className="tn-create-picked">
              <img className="tn-create-thumb" src={picture.previewUrl} alt="" />
              <span className="tn-create-pname">{picture.name}</span>
              <button type="button" className="tn-create-remove" onClick={removePicture}>Remove</button>
            </div>
          ) : (
            <div
              className={`tn-create-drop${dragging ? ' over' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fileInput.current?.click()}
              onKeyDown={onZoneKey}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >Drop a picture to set the mood, or choose one</div>
          )}
          {pictureError && <span className="tn-create-picerr" role="alert">That picture could not be read.</span>}
        </div>

        <div className="tn-create-field">
          <span className="tn-cap">Or start from</span>
          <div className="tn-create-chips">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={`chip tn-create-chip${preset === p.label ? ' active' : ''}`}
                aria-pressed={preset === p.label}
                onClick={() => pick(p)}
              >{p.label}</button>
            ))}
          </div>
        </div>

        <div className="tn-create-grid">
          <div className="tn-create-field">
            <span className="tn-cap">Nations</span>
            <div className="tn-create-stepper">
              <button type="button" className="tn-create-stbtn" aria-label="Fewer nations" disabled={nations <= MIN_NATIONS} onClick={() => step(-1)}>-</button>
              <span className="tn-create-stval" aria-live="polite">{nations}</span>
              <button type="button" className="tn-create-stbtn" aria-label="More nations" disabled={nations >= MAX_NATIONS} onClick={() => step(1)}>+</button>
              <span className="tn-create-pips" aria-hidden="true">
                {Array.from({ length: MAX_NATIONS - 2 }, (_, i) => (
                  <i key={i} className={i < nations - 2 ? 'on' : ''} />
                ))}
              </span>
            </div>
            <span className="tn-create-hint">{MIN_NATIONS} to {MAX_NATIONS}</span>
          </div>
          <div className="tn-create-field">
            <label className="tn-cap" htmlFor="tn-create-era">Era</label>
            <select id="tn-create-era" className="tn-create-select" value={era} onChange={(e) => setEra(e.target.value)}>
              <option value="">Let the world decide</option>
              {ERAS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <span className="tn-create-hint">Sets the starting technology and names.</span>
          </div>
          <div className="tn-create-field">
            <label className="tn-cap" htmlFor="tn-create-sea">Sea level <b>{pct(seaLevel)}</b></label>
            <input id="tn-create-sea" className="tn-create-range" style={fill(seaLevel, 0.3, 0.8)} type="range" min={0.3} max={0.8} step={0.05} value={seaLevel} onChange={(e) => setSeaLevel(Number(e.target.value))} />
            <span className="tn-create-ends"><span>Dry continents</span><span>Drowned</span></span>
          </div>
          <div className="tn-create-field">
            <label className="tn-cap" htmlFor="tn-create-agg">Aggression <b>{pct(aggression)}</b></label>
            <input id="tn-create-agg" className="tn-create-range" style={fill(aggression, 0, 1)} type="range" min={0} max={1} step={0.05} value={aggression} onChange={(e) => setAggression(Number(e.target.value))} />
            <span className="tn-create-ends"><span>Peaceful</span><span>Warlike</span></span>
          </div>
        </div>

        <button type="button" role="switch" aria-checked={prepare} className={`tn-create-prep${prepare ? ' on' : ''}`} onClick={() => setPrepare((v) => !v)}>
          <span>
            <span className="tn-create-prep-title">Prepare for a demo</span>
            <span className="tn-create-prep-sub">The world waits paused while lore, voices, chants and anthems are made, about a minute.</span>
          </span>
          <span className="tn-create-prep-toggle" aria-hidden="true"><i /></span>
        </button>
      </fieldset>

      {!busy && error && <p className="tn-create-error" role="alert">{error}</p>}
      {!connected && !busy && !error && <p className="tn-create-quiet">Connecting to the server...</p>}

      <div className="tn-create-foot">
        <span className="tn-create-mode">{modeNote}</span>
        <button type="submit" className="btn primary tn-create-go" disabled={busy || !prompt.trim()}>
          Create world
        </button>
      </div>

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
