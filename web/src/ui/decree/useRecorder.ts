import { useCallback, useEffect, useRef, useState } from 'react';

export interface Recording { blob: Blob; mimeType: string; durationMs: number }

interface Options { maxMs: number; onDone: (rec: Recording) => void }

/** Hold-to-record microphone. start() on press, stop() on release; stops itself at maxMs. */
export function useRecorder({ maxMs, onDone }: Options) {
  const [supported, setSupported] = useState(
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined',
  );
  const [recording, setRecording] = useState(false);
  const [remainingMs, setRemainingMs] = useState(maxMs);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const pending = useRef(false);   // getUserMedia in flight
  const wantStop = useRef(false);  // released before the mic was ready
  const alive = useRef(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const release = useCallback(() => {
    if (ticker.current) { clearInterval(ticker.current); ticker.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (pending.current) { wantStop.current = true; return; }
    const rec = recRef.current;
    if (rec && rec.state === 'recording') rec.stop();
  }, []);

  const start = useCallback(async () => {
    if (!supported || pending.current || recRef.current?.state === 'recording') return;
    pending.current = true;
    wantStop.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      pending.current = false;
      if (alive.current) setSupported(false);
      return;
    }
    pending.current = false;
    if (!alive.current || wantStop.current) { stream.getTracks().forEach((t) => t.stop()); return; }
    streamRef.current = stream;
    const type = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : '';
    let rec: MediaRecorder;
    try { rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream); }
    catch { release(); setSupported(false); return; }
    recRef.current = rec;
    chunks.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      const durationMs = Date.now() - startedAt.current;
      const mimeType = (rec.mimeType || type || 'audio/webm').split(';')[0];
      const blob = new Blob(chunks.current, { type: rec.mimeType || type || 'audio/webm' });
      release();
      recRef.current = null;
      if (!alive.current) return;
      setRecording(false);
      setRemainingMs(maxMs);
      onDoneRef.current({ blob, mimeType, durationMs });
    };
    startedAt.current = Date.now();
    rec.start();
    setRecording(true);
    setRemainingMs(maxMs);
    ticker.current = setInterval(() => {
      const left = maxMs - (Date.now() - startedAt.current);
      if (left <= 0) { setRemainingMs(0); stop(); } else setRemainingMs(left);
    }, 100);
    if (wantStop.current) stop();
  }, [supported, maxMs, release, stop]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const rec = recRef.current;
      if (rec && rec.state === 'recording') { rec.onstop = null; try { rec.stop(); } catch { /* ignore */ } }
      release();
    };
  }, [release]);

  return { supported, recording, remainingMs, start, stop };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? '');
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
