import { useEffect, useRef, useState } from 'react';
import { audio } from '../../audio';
import { useAudio } from '../../audio/useAudio';
import { useWorld } from '../../state/world';
import { captureGlobe } from '../../globe/capture';

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
const NO_SOUND_MS = 25_000;

const EVENT = 'terra:news-broadcast';

/** Run one broadcast cycle now (for lane b's top-bar button). Does nothing if one is already running. */
export function requestBroadcastNow(): void {
  window.dispatchEvent(new CustomEvent(EVENT));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Follow the audio store until its state leaves 'broadcast' (or the safety timeout). */
function waitForBroadcastEnd(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { unsub(); clearTimeout(timer); resolve(); };
    const unsub = audio.subscribe(() => { if (audio.getState().state !== 'broadcast') done(); });
    const timer = setTimeout(done, MAX_PLAY_MS);
    if (audio.getState().state !== 'broadcast') done();
  });
}

/** Play the bulletin through the audio module. Resolves true if sound played, false if audio was unavailable. */
async function playBulletin(url: string): Promise<boolean> {
  try {
    await audio.playBroadcast(url);
  } catch {
    return false;
  }
  // playBroadcast settles once the clip starts (state 'broadcast') or fails (state back to 'idle').
  if (audio.getState().state !== 'broadcast') return false;
  await waitForBroadcastEnd();
  return true;
}

export function useBroadcast(): { bulletin: Bulletin | null; visible: boolean; duration: number; preparing: boolean; noSound: boolean } {
  const [bulletin, setBulletin] = useState<Bulletin | null>(null);
  const [visible, setVisible] = useState(false);
  const [duration, setDuration] = useState(25);
  const running = useRef(false);
  const alive = useRef(true);
  const [preparing, setPreparing] = useState(false);
  const [noSound, setNoSound] = useState(false);
  useAudio(); // keeps the hook subscribed to the audio store

  useEffect(() => {
    alive.current = true;

    const cycle = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const shot = await captureGlobe();
        if (!alive.current) return;
        setNoSound(false);
        setBulletin(null);
        setPreparing(true);
        setVisible(true);
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
        setPreparing(false);
        const sounded = await playBulletin(b.audio);
        if (!sounded && alive.current) {
          // No sound: keep the text up and scroll it over 25 s.
          setNoSound(true);
          await sleep(NO_SOUND_MS);
        }
        await sleep(HIDE_AFTER_MS);
      } catch (err) {
        console.warn('news broadcast failed', err);
      } finally {
        running.current = false;
        if (alive.current) { setVisible(false); setPreparing(false); }
      }
    };

    let retry: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const w = useWorld.getState().world;
      if (!w || w.paused) return;
      if (running.current) return;
      if (audio.getState().state !== 'idle') {
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
    };
  }, []);

  return { bulletin, visible, duration, preparing, noSound };
}
