// Minimap, bottom right (Age of History style): the whole world flat, coloured by the current map
// mode, with a frame for what the camera sees. Click or drag on it to turn the globe there. Lane b.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { World } from '@terra/shared';
import { useWorld } from '../state/world';
import { tileColor } from '../globe/mesh/colors';
import { getPalette } from '../globe/palette';
import { globeCamera, lookAtLonLat } from '../globe/hover/cameraBridge';
import { useWonders } from '../globe/wonders/store';
import { MAP_MODE_LABELS, MapModeIcon } from './mapModeIcons';
import { MODES } from './TopBar';
import './hud.css';

const CSS_W = 220, CSS_H = 120;
const SCALE = 2; // canvas pixels per CSS pixel
const W = CSS_W * SCALE, H = CSS_H * SCALE;
const REDRAW_MS = 1000;
const GILT = '#e8c45a';

/** A five-pointed gilt star at each wonder (row A30). */
function drawWonders(ctx: CanvasRenderingContext2D, w: World): void {
  const list = useWonders.getState().list;
  if (!list.length) return;
  ctx.save();
  ctx.fillStyle = GILT;
  ctx.strokeStyle = 'rgba(20, 14, 4, 0.85)';
  ctx.lineWidth = SCALE;
  for (const r of list) {
    const c = w.tiles[r.tile]?.center;
    if (!c) continue;
    const l = Math.hypot(c[0], c[1], c[2]) || 1;
    const lon = Math.atan2(c[0] / l, c[2] / l), lat = Math.asin(Math.max(-1, Math.min(1, c[1] / l)));
    const x = ((lon + Math.PI) / (2 * Math.PI)) * W, y = ((Math.PI / 2 - lat) / Math.PI) * H;
    const R = 5 * SCALE, rIn = R * 0.45;
    ctx.globalAlpha = r.complete ? 1 : 0.6;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? rIn : R;
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
  ctx.restore();
}

/** For every minimap pixel, the tile under it (nearest centre, found by a greedy walk). */
function pixelTiles(world: World): Int32Array {
  const n = world.tiles.length;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = world.tiles[i]!.center;
    const l = Math.hypot(p[0], p[1], p[2]) || 1;
    c[i * 3] = p[0] / l; c[i * 3 + 1] = p[1] / l; c[i * 3 + 2] = p[2] / l;
  }
  const out = new Int32Array(W * H);
  let rowStart = 0;
  for (let y = 0; y < H; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    let cur = rowStart;
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * 2 * Math.PI - Math.PI;
      const px = cl * Math.sin(lon), py = sl, pz = cl * Math.cos(lon);
      let best = c[cur * 3]! * px + c[cur * 3 + 1]! * py + c[cur * 3 + 2]! * pz;
      for (let guard = 0; guard < 4096; guard++) {
        let next = -1;
        for (const nb of world.tiles[cur]!.neighbors) {
          const dd = c[nb * 3]! * px + c[nb * 3 + 1]! * py + c[nb * 3 + 2]! * pz;
          if (dd > best) { best = dd; next = nb; }
        }
        if (next < 0) break;
        cur = next;
      }
      out[y * W + x] = cur;
      if (x === 0) rowStart = cur;
    }
  }
  return out;
}

export function Minimap({ hidden = false }: { hidden?: boolean }) {
  const world = useWorld((s) => s.world);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);

  // The map itself: rebuilt per world, repainted at most once a second.
  useEffect(() => {
    const cv = mapRef.current;
    const ctx = cv?.getContext('2d');
    if (!world || !ctx || hidden) return;
    const lookup = pixelTiles(world);
    const img = ctx.createImageData(W, H);
    const rgb = new Uint8ClampedArray(world.tiles.length * 3);
    const col = new THREE.Color();
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const draw = () => {
      timer = null;
      last = performance.now();
      const s = useWorld.getState();
      const w = s.world;
      if (w !== world) return;
      const pal = getPalette();
      for (let t = 0; t < w.tiles.length; t++) {
        tileColor(w, t, w.owner[t] ?? -1, s.mapMode, s.selectedCountryId, col);
        if (w.tiles[t]!.terrain === 'ocean') col.set(pal.ocean).lerp(new THREE.Color(pal.night), 0.45);
        col.convertLinearToSRGB();
        rgb[t * 3] = col.r * 255; rgb[t * 3 + 1] = col.g * 255; rgb[t * 3 + 2] = col.b * 255;
      }
      const d = img.data;
      for (let i = 0; i < lookup.length; i++) {
        const t = lookup[i]! * 3;
        d[i * 4] = rgb[t]!; d[i * 4 + 1] = rgb[t + 1]!; d[i * 4 + 2] = rgb[t + 2]!; d[i * 4 + 3] = 255;
      }
      // Ink border wherever the owner changes, so nations read at this size.
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W - 1; x++) {
          const i = y * W + x;
          const a = w.owner[lookup[i]!] ?? -1, b = w.owner[lookup[i + 1]!] ?? -1;
          const below = y < H - 1 ? w.owner[lookup[i + W]!] ?? -1 : a;
          if ((a !== b && (a >= 0 || b >= 0)) || (a !== below && (a >= 0 || below >= 0))) {
            d[i * 4] *= 0.55; d[i * 4 + 1] *= 0.55; d[i * 4 + 2] *= 0.55;
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      drawWonders(ctx, w);
    };
    draw();
    const unsub = useWorld.subscribe(() => {
      if (timer) return;
      timer = setTimeout(draw, Math.max(0, REDRAW_MS - (performance.now() - last)));
    });
    const unsubW = useWonders.subscribe(() => {
      if (timer) return;
      timer = setTimeout(draw, Math.max(0, REDRAW_MS - (performance.now() - last)));
    });
    return () => { unsub(); unsubW(); if (timer) clearTimeout(timer); };
  }, [world, hidden]);

  // The view frame: redrawn only when the camera moves.
  useEffect(() => {
    const cv = viewRef.current;
    const ctx = cv?.getContext('2d');
    if (!world || !ctx || hidden) return;
    let raf = 0;
    let key = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const g = globeCamera();
      if (!g) return;
      const cam = g.camera as THREE.PerspectiveCamera;
      const p = cam.position;
      const k = `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)},${cam.aspect?.toFixed(2)}`;
      if (k === key) return;
      key = k;
      const d = p.length() || 1;
      const lon = Math.atan2(p.x, p.z), lat = Math.asin(Math.max(-1, Math.min(1, p.y / d)));
      const half = (fov: number): number => {
        const s = d * Math.sin(fov);
        return s >= 1 ? Math.acos(1 / d) : Math.asin(s) - fov;
      };
      const fovV = ((cam.fov ?? 45) * Math.PI) / 360;
      const fovH = Math.atan(Math.tan(fovV) * (cam.aspect ?? 1.6));
      const hv = half(fovV), hh = Math.min(Math.PI, half(fovH) / Math.max(0.2, Math.cos(lat)));
      const cx = ((lon + Math.PI) / (2 * Math.PI)) * W, cy = ((Math.PI / 2 - lat) / Math.PI) * H;
      const rw = (hh / Math.PI) * W, rh = (hv / Math.PI) * H;
      const pal = getPalette();
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = pal.accent;
      ctx.fillStyle = pal.accent;
      ctx.lineWidth = 2 * SCALE / 2;
      for (const off of [-W, 0, W]) {
        ctx.strokeRect(cx - rw + off, Math.max(1, cy - rh), rw * 2, Math.min(H - 2, cy + rh) - Math.max(1, cy - rh));
        ctx.beginPath();
        ctx.arc(cx + off, cy, 2.5 * SCALE / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, hidden]);

  // Hidden (the Chronicle sheet is open): it stays mounted and fades, so it never pops out or back in.
  if (!world) return null;

  const turnTo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    lookAtLonLat(fx * 2 * Math.PI - Math.PI, Math.PI / 2 - Math.min(1, Math.max(0, fy)) * Math.PI);
  };

  return (
    <>
    <MapModeStrip hidden={hidden} />
    <div className={`hud minimap tn-lacquer tn-frame tn-frame--slim${hidden ? ' mm-hidden' : ''}`} aria-hidden={hidden || undefined} title="Click or drag to turn the globe">
      <canvas ref={mapRef} width={W} height={H} />
      <canvas
        ref={viewRef}
        width={W}
        height={H}
        className="mm-view"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); turnTo(e); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) turnTo(e); }}
      />
    </div>
    </>
  );
}

/** Icon-only map-mode buttons on the top edge of the minimap (#245). Keys 1 to 6 still switch. */
function MapModeStrip({ hidden = false }: { hidden?: boolean }) {
  const mapMode = useWorld((s) => s.mapMode);
  const setMapMode = useWorld((s) => s.setMapMode);
  return (
    <div className={`hud mm-modes tn-lacquer tn-frame tn-frame--slim${hidden ? ' mm-hidden' : ''}`} aria-hidden={hidden || undefined} role="toolbar" aria-label="Map mode">
      {MODES.map((m, i) => {
        const tip = `Map mode: ${MAP_MODE_LABELS[m]}`;
        return (
          <button
            key={m}
            type="button"
            className={`mm-mode tn-seg${mapMode === m ? ' on' : ''}`}
            aria-label={`${tip} (key ${i + 1})`}
            aria-pressed={mapMode === m}
            data-tip={tip}
            onClick={() => setMapMode(m)}
          >
            <MapModeIcon mode={m} />
          </button>
        );
      })}
    </div>
  );
}
