import { useEffect, useRef, useState } from 'react';
import { audio } from '../../audio';
import { useAudio } from '../../audio/useAudio';
import { createLipSync } from './lipsync';
import { H, REST, W, drawFootage, drawIdent, drawStudio, lookFor, paintSet, readTokens, type Pose } from './studio';
import type { Bulletin } from './useBroadcast';
import { beatsFor, type Beat } from './focus';
import { pipFeed, setPipShot } from '../../globe/pip/shot';
import { WarReport } from './WarReport';
import { yearShort } from '@terra/shared';

/** The ident stays up this long after the bulletin starts (the voice opens with "Terra Nova News."). */
const IDENT_HOLD_S = 1.5;
/** And never less than this from the moment the window appears, so its animation finishes. */
const IDENT_MIN_S = 1.9;
const WIPE_S = 0.45;
/** Cuts to the field footage, in seconds after the anchor first appears: [from, to]. */
const CUTAWAYS: Array<[number, number]> = [[8.5, 12.5], [21, 24.5]];
const FADE_S = 0.2;
/** The live picture-in-picture: the camera is asked for this long before a beat, so its first frame is ready. */
const PIP_READY_S = 1.2;
/** The wipe to the live picture and back, and how early the strap leaves before the wipe back. */
const PIP_WIPE_S = 0.42;
const PIP_STRAP_OUT_S = 0.3;

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

interface Props {
  bulletin: Bulletin | null;
  /** The globe capture the bulletin was written from (a data URL), for the cutaways. */
  footage: string | null;
}

/**
 * The broadcast window: the "Terra Nova News" ident, then the studio with the anchor reading the
 * bulletin, lip-synced to its sound, with short cuts to the globe capture. One canvas.
 */
export function AnchorWindow({ bulletin, footage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ bulletin, footage });
  live.current = { bulletin, footage };
  const speaking = useAudio().state === 'broadcast';
  // The live shot on air (for the strap and the LIVE bug over the canvas); `out` while it leaves.
  const [liveShot, setShot] = useState<{ beat: Beat; out: boolean } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * scale;
    canvas.height = H * scale;
    const T = readTokens();
    const set = paintSet(T, scale);
    const lip = createLipSync();
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The field footage, scaled once to the window.
    let shotSrc: string | null = null;
    let shot: HTMLCanvasElement | null = null;
    const loadShot = (src: string | null) => {
      shotSrc = src;
      shot = null;
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        if (shotSrc !== src) return;
        const c = document.createElement('canvas');
        c.width = W * scale;
        c.height = H * scale;
        const k = Math.max(c.width / img.width, c.height / img.height);
        c.getContext('2d')?.drawImage(img, (c.width - img.width * k) / 2, (c.height - img.height * k) / 2, img.width * k, img.height * k);
        shot = c;
      };
      img.src = src;
    };

    const pose: Pose = { ...REST };
    const start = performance.now() / 1000;
    let last = start;
    let airId: string | null = null;
    let airAt = 0;            // when the anchor takes over from the ident
    let audioAt = -1;         // when the voice started: focus beats count from here
    let beats: Beat[] = [];
    let armed = -1;           // the beat the PiP camera is filming, -1 none
    let shown = -1;           // the beat whose strap is up, -1 none
    let shownOut = false;
    let look = lookFor(undefined);
    let nextBlink = start + rand(1.5, 3.5);
    let blinkAt = -1;
    let nextGlance = start + rand(6, 9);
    let glanceAt = -1;
    let nextTurn = start + rand(2, 4);
    let yawTo = 0;
    let nod = 0;
    let lastNod = 0;
    let raf = 0;

    const frame = (nowMs: number) => {
      const now = nowMs / 1000;
      const dt = Math.min(0.05, Math.max(0.001, now - last));
      last = now;
      const { bulletin: b, footage: f } = live.current;
      if (f !== shotSrc) loadShot(f);
      if (b && b.id !== airId) {
        airId = b.id;
        look = lookFor(b.anchor);
        airAt = still ? now : Math.max(now + IDENT_HOLD_S, start + IDENT_MIN_S);
        audioAt = -1;
        beats = beatsFor(b);
      }
      const talking = audio.getState().state === 'broadcast';
      const mouth = lip.sample(audio.broadcastAnalyser(), talking, now, dt);
      if (b && talking && audioAt < 0) audioAt = now;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const onAir = b ? now - airAt : -1;
      // --- the live picture-in-picture: which beat, and the camera asked for it ahead of time ---
      // Beats count from the start of the voice; a silent bulletin counts from the anchor's first frame.
      const told = !b ? -1 : audioAt >= 0 ? now - audioAt : onAir > 2 ? onAir : -1;
      let beatIx = -1;
      if (told >= 0) beatIx = beats.findIndex((x) => told > x.atSecond - (x.cutIn ? 0 : PIP_READY_S) && told < x.atSecond + x.duration);
      if (beatIx !== armed) {
        armed = beatIx;
        const x = beats[beatIx];
        setPipShot(x ? { tile: x.tile, t0: performance.now() + (x.atSecond - told) * 1000, duration: x.duration, still } : null);
      }
      const beat = beats[beatIx];
      const beatT = beat ? told - beat.atSecond : -1;
      // on air only once the anchor is, and once the camera has a frame
      const onLive = !!beat && beatT >= 0 && onAir >= WIPE_S && (pipFeed.frames > 0 || beat.cutIn) && !!pipFeed.canvas; // a straight cut holds the last frame until the new one is in
      const strapIx = onLive ? beatIx : -1;
      const strapOut = onLive && !still && !beat!.cutOut && beat!.duration - beatT < PIP_WIPE_S + PIP_STRAP_OUT_S;
      if (strapIx !== shown || strapOut !== shownOut) {
        shown = strapIx;
        shownOut = strapOut;
        setShot(strapIx >= 0 ? { beat: beat!, out: strapOut } : null);
      }

      if (!b || onAir < 0) {
        drawIdent(ctx, T, now - start, !b, still);
        return;
      }

      // --- the anchor's body language ---
      if (still) {
        Object.assign(pose, REST);
      } else {
        pose.breath = Math.sin(now * 1.5);
        if (now > nextTurn) { yawTo = rand(-0.7, 0.7) * (talking ? 1 : 0.4); nextTurn = now + rand(2.2, 5); }
        pose.yaw += (yawTo - pose.yaw) * ease(dt, 0.45);
        // a stressed word: a nod and a lift of the brows
        if (mouth.emphasis && now - lastNod > 1.1) { lastNod = now; nod = 1; pose.brow = 1; }
        nod += (0 - nod) * ease(dt, 0.22);
        pose.brow += (0 - pose.brow) * ease(dt, 0.35);
        // a look down at the script
        if (glanceAt < 0 && now > nextGlance) { glanceAt = now; nextGlance = now + rand(6, 11); }
        let glanceTo = 0;
        if (glanceAt >= 0) { if (now - glanceAt < 0.9) glanceTo = 1; else glanceAt = -1; }
        pose.glance += (glanceTo - pose.glance) * ease(dt, 0.09);
        pose.pitch = Math.min(1, nod * 0.8 + pose.glance * 0.55);
        pose.roll = pose.yaw * 0.035 + Math.sin(now * 0.7) * 0.008;
        // blinks, now and then a double
        if (blinkAt < 0 && now > nextBlink) { blinkAt = now; nextBlink = now + (Math.random() < 0.18 ? 0.28 : rand(2.2, 5.5)); }
        if (blinkAt >= 0) {
          const k = (now - blinkAt) / 0.15;
          pose.blink = k >= 1 ? 0 : Math.sin(k * Math.PI);
          if (k >= 1) blinkAt = -1;
        }
        pose.open = mouth.open;
        pose.wide = mouth.wide;
      }

      // --- which picture is on screen ---
      let cut = 0;      // 0 studio .. 1 footage
      let cutT = 0;
      if (shot && !still && beats.length === 0) {  // the still capture only when there are no live beats
        for (const [from, to] of CUTAWAYS) {
          if (onAir > from && onAir < to) {
            cut = Math.min(1, (onAir - from) / FADE_S, (to - onAir) / FADE_S);
            cutT = onAir - from;
          }
        }
      }
      // The live shot wipes in behind a gilt bar and the anchor wipes back the same way (reduced motion: cuts).
      let pipFrom = 0, pipTo = 0;   // the live picture covers x from..to, in window units
      if (onLive && pipFeed.canvas) {
        const e = (k: number) => { const c = Math.min(1, Math.max(0, k)); return c * c * (3 - 2 * c); };
        pipTo = still || beat!.cutIn ? W : W * e(beatT / PIP_WIPE_S);
        pipFrom = still || beat!.cutOut ? 0 : W * (1 - e((beat!.duration - beatT) / PIP_WIPE_S));
      }
      const pipFull = pipTo >= W && pipFrom <= 0;
      if (cut < 1 && !pipFull) drawStudio(ctx, T, set, look, pose, now - start);
      if (pipTo > pipFrom && pipFeed.canvas) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(pipFrom, 0, pipTo - pipFrom, H);
        ctx.clip();
        ctx.drawImage(pipFeed.canvas, 0, 0, W, H);
        ctx.restore();
        ctx.fillStyle = T.gilt;
        if (pipTo < W) ctx.fillRect(pipTo - 3, 0, 3, H);
        if (pipFrom > 0) ctx.fillRect(pipFrom - 3, 0, 3, H);
      }
      if (cut > 0 && shot) {
        ctx.globalAlpha = cut;
        drawFootage(ctx, T, shot, cutT, `THE WORLD  ·  ${yearShort(b.year)}`, still);
        ctx.globalAlpha = 1;
      }
      // the ident wipes away behind a gilt bar
      if (onAir < WIPE_S && !still) {
        const k = onAir / WIPE_S;
        const x = W * (k * k * (3 - 2 * k));
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, 0, W - x, H);
        ctx.clip();
        drawIdent(ctx, T, now - start, false, false);
        ctx.restore();
        ctx.fillStyle = T.gilt;
        ctx.fillRect(x - 3, 0, 3, H);
      }
    };

    if (still) {
      // Reduced motion: no animation loop. A still picture, refreshed twice a second so it follows the bulletin.
      const draw = () => frame(performance.now());
      draw();
      const timer = setInterval(draw, 500);
      return () => { clearInterval(timer); setPipShot(null); };
    }
    let cost = 0;
    const loop = (nowMs: number) => {
      const t0 = performance.now();
      frame(nowMs);
      if (import.meta.env.DEV) {
        cost += (performance.now() - t0 - cost) * 0.05;
        // Dev only: the frame cost and the mouth, for tuning from the console.
        Object.assign(window, { __tnAnchorMs: cost, __tnAnchorMouth: [pose.open, pose.wide] });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); setPipShot(null); };
  }, []);

  return (
    <div className="tn-anchorwin tn-lacquer tn-frame" aria-hidden="true">
      <span className="tn-cartouche">{bulletin?.anchor ?? 'Terra Nova News'}</span>
      <canvas ref={canvasRef} className="tn-anchorwin-pic" />
      {liveShot && (
        <div className={`tn-pip ${liveShot.out ? 'tn-pip-out' : ''}`}>
          <span className="tn-pip-glass" />
          <span className="tn-pip-live"><span className="tn-pip-live-dot" />Live</span>
          {liveShot.beat.battle && <WarReport battle={liveShot.beat.battle} />}
          <div className="tn-pip-strap">
            <span className="tn-pip-place">{liveShot.beat.place}</span>
            {liveShot.beat.caption && <span className="tn-pip-caption">{liveShot.beat.caption}</span>}
          </div>
        </div>
      )}
      {speaking && <span className="tn-anchorwin-speaking"><span className="tn-anchorwin-speaking-dot" />Speaking</span>}
    </div>
  );
}
