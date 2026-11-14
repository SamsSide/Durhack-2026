// The news picture-in-picture: what the broadcast window asks the globe to film. Plain state, no React,
// so the DOM side (web/src/ui/news) and the canvas side (NewsPip.tsx) can both reach it.

/** The picture, in the broadcast window's own units (web/src/ui/news/studio.ts W x H). */
export const PIP_W = 360;
export const PIP_H = 220;
/** Device pixels per unit, at most: the box is small, so 1.5 is as crisp as the main view. */
export const PIP_MAX_SCALE = 1.5;

export interface PipShot {
  /** The tile to film. */
  tile: number;
  /** When the shot goes on air, in performance.now() ms. The camera is ready a little before. */
  t0: number;
  /** Seconds on air: the push-in and the orbit last this long. */
  duration: number;
  /** Reduced motion: a still camera. */
  still: boolean;
}

export const pipFeed = {
  shot: null as PipShot | null,
  /** The latest frame of the shot; the broadcast window draws it. Made on first use. */
  canvas: null as HTMLCanvasElement | null,
  /** Frames drawn for the current shot: 0 until the first is ready. */
  frames: 0,
  /** Dev only: smoothed cost of the PiP pass on the main thread, ms. */
  ms: 0,
  /** Dev only: the part of it spent copying the picture out, ms. */
  blitMs: 0,
};

/** Film this shot (replacing any other), or stop with null. */
export function setPipShot(shot: PipShot | null): void {
  if (shot?.tile !== pipFeed.shot?.tile || shot?.t0 !== pipFeed.shot?.t0) pipFeed.frames = 0;
  pipFeed.shot = shot;
}
