import { useEffect, useRef, useState } from 'react';
import { audio } from '../../audio';
import { useAudio } from '../../audio/useAudio';
import { useWorld } from '../../state/world';
import { captureGlobe } from './captureStub';

export interface Bulletin {
  id: string;
  headline: string;
  script: string;
  year: number;
  audio: string;
}

const EVERY_MS = 120_000;
const RETRY_MS = 20_000;
const HIDE_AFTER_MS = 1_500;
const MAX_PLAY_MS = 90_000;

const EVENT = 'terra:news-broadcast';

/** Run one broadcast cycle now (for lane b's top-bar button). Does nothing if one is already running. */
export function requestBroadcastNow(): void {
  window.dispatchEvent(new CustomEvent(EVENT));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Follow the audio store until its state leaves 'broadcast'. */
function waitForBroadcastEnd(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { unsub(); clearTimeout(timer); resolve(); };
    const unsub = audio.subscribe(() => { if ((audio.getState().state as string) !== 'broadcast') done(); });
    const timer = setTimeout(done, MAX_PLAY_MS);
    if ((audio.getState().state as string) !== 'broadcast') done();
  });
}

export function useBroadcast(): { bulletin: Bulletin | null; visible: boolean; duration: number } {
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [visible, setVisible] = useState(false);
  const [duration, setDuration] = useState(25);
  const running = useRef(false);
  const alive = useRef(true);
  const local = useRef<HTMLAudioElement | null>(null);
  useAudio(); // keeps the hook subscribed to the audio store

  useEffect(() => {
    alive.current = true;

    const playLocal = (url: string) => new Promise<void>((resolve) => {
      const a = new Audio(url);
      local.current = a;
      a.muted = audio.getState().muted;
      const end = () => { a.onended = null; a.onerror = null; resolve(); };
      a.onended = end;
      a.onerror = end;
      a.onloadedmetadata = () => { if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration); };
      a.play().catch(end);
    });

    const play = async (url: string) => {
      const a = audio as unknown as { playBroadcast?: (u: string) => Promise<void> };
      if ('playBroadcast' in audio && typeof a.playBroadcast === 'function') {
        await a.playBroadcast(url).catch(() => undefined);
        await waitForBroadcastEnd();
      } else {
        await playLocal(url);
      }
    };

    const cycle = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const shot = await captureGlobe();
        const res = await fetch('/api/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shot),
        });
        if (!res.ok) { console.warn(`news broadcast unavailable (${res.status})`); return; }
        const b = (await res.json()) as Bulletin;
        if (!alive.current || !b || !b.headline) return;
        setDuration(25);
        setBulletin(b);
        setVisible(true);
        await play(b.audio);
        await sleep(HIDE_AFTER_MS);
      } catch (err) {
        console.warn('news broadcast failed', err);
      } finally {
        local.current = null;
        running.current = false;
        if (alive.current) setVisible(false);
      }
    };

    let retry: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const w = useWorld.getState().world;
      if (!w || w.paused) return;
      if (running.current) return;
      if ((audio.getState().state as string) !== 'idle') {
        clearTimeout(retry);
        retry = setTimeout(tick, RETRY_MS);
        return;
      }
      void cycle();
    };

    const onRequest = () => { void cycle(); };
    window.addEventListener(EVENT, onRequest);
    const timer = setInterval(tick, EVERY_MS);
    return () => {
      alive.current = false;
      window.removeEventListener(EVENT, onRequest);
      clearInterval(timer);
      clearTimeout(retry);
      if (local.current) { local.current.pause(); local.current = null; }
    };
  }, []);

  return { bulletin, visible, duration };
}
