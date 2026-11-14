// Lip-sync for the news anchor: mouth shape from the bulletin's own sound.
// Openness follows the loudness (RMS of the wave); the shape follows where the energy sits:
// hiss (s, sh, ee) spreads the lips and shows teeth, a low hum (oo, oh, m) rounds them.

export interface Mouth {
  /** 0 closed .. 1 wide open. */
  open: number;
  /** -1 rounded .. 0 neutral .. 1 spread. */
  wide: number;
  /** True on the frame a stressed syllable starts (drives nods and brows). */
  emphasis: boolean;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Frame-rate independent smoothing factor for a time constant in seconds. */
const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

export interface LipSync {
  /** One frame. `analyser` null while `speaking` means no sound to read: the anchor mimes. */
  sample(analyser: AnalyserNode | null, speaking: boolean, t: number, dt: number): Mouth;
}

export function createLipSync(): LipSync {
  const wave = new Uint8Array(512);
  const bins = new Uint8Array(256);
  const out: Mouth = { open: 0, wide: 0, emphasis: false };
  let peak = 0.05;      // loudest recent RMS: the level is measured against it
  let slow = 0;         // slow average of the level, for spotting stress
  let wasLoud = false;

  const settle = (openTo: number, wideTo: number, dt: number) => {
    // The jaw opens faster than it closes.
    out.open += (openTo - out.open) * ease(dt, openTo > out.open ? 0.035 : 0.065);
    out.wide += (wideTo - out.wide) * ease(dt, 0.07);
    if (out.open < 0.02 && openTo === 0) out.open = 0;
  };

  return {
    sample(analyser, speaking, t, dt) {
      out.emphasis = false;
      if (!speaking) { settle(0, 0, dt); wasLoud = false; return out; }

      if (!analyser) {
        // No analyser (muted, or Web Audio blocked): plausible syllables at about four a second,
        // with a breath every few seconds.
        const phrase = Math.sin(t * 0.9) > -0.82 ? 1 : 0;
        const syl = Math.max(0, Math.sin(t * 27 + Math.sin(t * 3.1) * 1.4));
        const openTo = phrase * syl * (0.5 + 0.35 * Math.sin(t * 1.7 + 1));
        const loud = openTo > 0.7;
        out.emphasis = loud && !wasLoud && Math.sin(t * 0.37) > 0.2;
        wasLoud = loud;
        settle(openTo, Math.sin(t * 5.3) * 0.6, dt);
        return out;
      }

      analyser.getByteTimeDomainData(wave);
      let sum = 0;
      for (let i = 0; i < wave.length; i++) { const v = (wave[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / wave.length);
      peak = Math.max(peak * Math.exp(-dt / 8), rms, 0.03);
      const level = rms < 0.006 ? 0 : clamp((rms / peak - 0.07) / 0.55, 0, 1);

      analyser.getByteFrequencyData(bins);
      const hz = analyser.context.sampleRate / analyser.fftSize;
      const band = (from: number, to: number) => {
        const a = Math.max(1, Math.round(from / hz));
        const b = Math.min(bins.length - 1, Math.round(to / hz));
        let s = 0;
        for (let i = a; i <= b; i++) s += bins[i];
        return s / (b - a + 1);
      };
      const low = band(150, 700);      // voiced hum, rounded vowels
      const mid = band(700, 2600);     // open vowels
      const high = band(3200, 8000);   // hiss
      const total = low + mid + high + 1;
      const hiss = clamp((high / total - 0.2) * 5, 0, 1);
      const hum = clamp((low / total - 0.56) * 3.5, 0, 1) * (1 - hiss);

      let openTo = Math.pow(level, 0.7);
      if (hiss > 0.5) openTo = Math.min(openTo, 0.32);   // teeth together on s and sh
      settle(openTo, hiss - hum, dt);

      slow += (level - slow) * ease(dt, 1.5);
      const loud = level > 0.72 && level > slow * 1.45;
      out.emphasis = loud && !wasLoud;
      wasLoud = loud;
      return out;
    },
  };
}
