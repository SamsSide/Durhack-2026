import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChronicleEntry } from '@terra/shared';
import { useWorld } from '../../state/world';
import { blobToBase64, useRecorder, type Recording } from './useRecorder';
import './decree.css';

const MAX_MS = 15000;
const MIN_MS = 500;

type Note = { kind: 'hint' | 'listen' | 'result' | 'fail'; transcript?: string; decree?: string };

/** Lane a adds `decree` to the decree chronicle entries and the voice response; until then the `-b` line stands in. */
type DecreeInfo = { effect?: string; severity?: number; target?: { countryId: number | null; tiles: number[] }; result?: string };
const decreeOf = (e: ChronicleEntry): DecreeInfo | undefined => (e as ChronicleEntry & { decree?: DecreeInfo }).decree;

const RESULT_WAIT_MS = 10_000;   // give up on a result after this long
const RESULT_SHOW_MS = 6000;     // how long the result line stays

/** The line shown when the voice route refuses a recording (for 'fail', carried in `transcript`). */
function failText(status: number, error: string): string {
  if (/no speech/i.test(error)) return 'The herald heard no words. Speak up, and try again.';
  if (/unsupported audio/i.test(error)) return 'The herald cannot read this recording.';
  if (status === 503) return 'The herald is away. Type your decree instead.';
  return 'The herald could not hear you.';
}

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `0:${String(s).padStart(2, '0')}`;
}

export function DecreeBox() {
  const world = useWorld((s) => s.world);
  const connected = useWorld((s) => s.connected);
  const send = useWorld((s) => s.send);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [outcome, setOutcome] = useState<{ effect: string; line: string } | null>(null);
  const events = useWorld((s) => s.recentEvents);
  const pending = useRef<{ at: number; seen: Set<string> } | null>(null);
  const outcomeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      if (outcomeTimer.current) clearTimeout(outcomeTimer.current);
    };
  }, []);

  // After a typed decree, the next decree entry that carries a result replaces "Proclaimed." for a few seconds.
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    if (Date.now() - p.at > RESULT_WAIT_MS) { pending.current = null; return; }
    for (const e of events) {
      if (e.type !== 'chronicle' || e.entry.kind !== 'decree' || p.seen.has(e.id)) continue;
      const info = decreeOf(e.entry);
      const line = info?.result || (/-b$/.test(e.entry.id) ? e.entry.text : '');
      if (!line) continue;
      pending.current = null;
      if (timer.current) clearTimeout(timer.current);
      setDone(false);
      setOutcome({ effect: info?.effect && info.effect !== 'none' ? info.effect : '', line });
      if (outcomeTimer.current) clearTimeout(outcomeTimer.current);
      outcomeTimer.current = setTimeout(() => setOutcome(null), RESULT_SHOW_MS);
      return;
    }
  }, [events]);

  const showNote = useCallback((n: Note | null, ms = 4000) => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNote(n);
    if (n && n.kind !== 'listen') noteTimer.current = setTimeout(() => setNote(null), ms);
  }, []);

  const onDone = useCallback(async (rec: Recording) => {
    if (rec.durationMs < MIN_MS) { showNote({ kind: 'hint' }); return; }
    showNote({ kind: 'listen' });
    try {
      const audioBase64 = await blobToBase64(rec.blob);
      const res = await fetch('/api/decree/voice', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType: rec.mimeType }),
      });
      if (!res.ok) {
        // A20 errors: 400 "no speech heard" / "unsupported audio", 503 "voice unavailable".
        const err = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? '';
        if (alive.current) showNote({ kind: 'fail', transcript: failText(res.status, err) });
        return;
      }
      const data = (await res.json()) as { transcript?: string; decree?: { text?: string } & DecreeInfo };
      if (!alive.current) return;
      showNote({ kind: 'result', transcript: data.transcript ?? '', decree: data.decree?.result || data.decree?.text || '' }, data.decree?.result ? 7000 : 4000);
    } catch {
      if (alive.current) showNote({ kind: 'fail' });
    }
  }, [showNote]);

  const { supported, recording, remainingMs, start, stop } = useRecorder({ maxMs: MAX_MS, onDone });

  if (!world) return null;

  const proclaim = () => {
    const t = text.trim();
    if (!t || !connected) return;
    send({ type: 'control', action: 'decree', text: t });
    setText('');
    setDone(true);
    setOutcome(null);
    pending.current = { at: Date.now(), seen: new Set(useWorld.getState().recentEvents.map((e) => e.id)) };
    if (timer.current) clearTimeout(timer.current);
    // "Proclaimed." stays until the result arrives; with none within the wait it clears quietly.
    timer.current = setTimeout(() => { setDone(false); pending.current = null; }, RESULT_WAIT_MS);
  };

  const isPressKey = (k: string) => k === ' ' || k === 'Enter';

  return (
    <div className="tn-decree tn-sheet tn-frame tn-frame--slim">
      {note?.kind === 'hint' && <span className="tn-decree-done" role="status">Hold the button while you speak.</span>}
      {note?.kind === 'listen' && <span className="tn-decree-done" role="status">The herald listens...</span>}
      {note?.kind === 'fail' && <span className="tn-decree-done" role="status">{note.transcript || 'The herald could not hear you.'}</span>}
      {note?.kind === 'result' && (
        <span className="tn-decree-done" role="status">
          {note.transcript ? <>&ldquo;{note.transcript}&rdquo;</> : null}
          {note.transcript && note.decree ? ' ' : null}
          {note.decree ? <span className="tn-decree-proclaimed">Proclaimed: {note.decree}</span> : null}
        </span>
      )}
      {!note && outcome && (
        <span className="tn-decree-done" role="status">
          {outcome.effect && <span className="tn-decree-effect">{outcome.effect}</span>}
          {outcome.line}
        </span>
      )}
      {!note && !outcome && done && <span className="tn-decree-done" role="status">Proclaimed.</span>}
      <span className="tn-decree-label">Decree</span>
      {recording ? (
        <span className="tn-decree-count" role="timer" aria-live="off">{clock(remainingMs)}</span>
      ) : (
        <input
          className="tn-decree-input tn-input"
          value={text}
          maxLength={140}
          placeholder="A plague, a meteor, a prophet..."
          disabled={!connected}
          aria-label="Decree"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') proclaim(); }}
        />
      )}
      {supported && (
        <button
          type="button"
          className={`tn-button tn-button--round tn-decree-mic${recording ? ' recording' : ''}`}
          aria-label="Hold to speak a decree"
          title="Hold to speak a decree"
          aria-pressed={recording}
          disabled={!connected}
          onPointerDown={(e) => { e.preventDefault(); void start(); }}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => { if (isPressKey(e.key)) { e.preventDefault(); if (!e.repeat) void start(); } }}
          onKeyUp={(e) => { if (isPressKey(e.key)) { e.preventDefault(); stop(); } }}
          onBlur={stop}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        </button>
      )}
      <button className="tn-button tn-button--gilt tn-decree-go" disabled={!connected || !text.trim()} onClick={proclaim}>Proclaim</button>
    </div>
  );
}
