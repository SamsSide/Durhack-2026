import type { FlagEmblem, FlagSpec } from './types';

// Flag drawn in a 90 x 60 viewBox, scaled to the requested size.
const W = 90;
const H = 60;

function star(cx: number, cy: number, r: number, pts = 5): string {
  const out: string[] = [];
  for (let i = 0; i < pts * 2; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / pts;
    out.push(`${(cx + Math.cos(a) * rad).toFixed(2)},${(cy + Math.sin(a) * rad).toFixed(2)}`);
  }
  return out.join(' ');
}

function emblem(kind: FlagEmblem, c: string, cx = W / 2, cy = H / 2): string {
  const s = 11; // base radius
  switch (kind) {
    case 'none': return '';
    case 'star': return `<polygon points="${star(cx, cy, s)}" fill="${c}"/>`;
    case 'sun': {
      let rays = '';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        rays += `<line x1="${(cx + Math.cos(a) * 8).toFixed(1)}" y1="${(cy + Math.sin(a) * 8).toFixed(1)}" x2="${(cx + Math.cos(a) * 13).toFixed(1)}" y2="${(cy + Math.sin(a) * 13).toFixed(1)}" stroke="${c}" stroke-width="2"/>`;
      }
      return `<circle cx="${cx}" cy="${cy}" r="6" fill="${c}"/>${rays}`;
    }
    case 'moon':
      return `<path d="M ${cx + 3} ${cy - 11} A 11 11 0 1 0 ${cx + 3} ${cy + 11} A 8.5 8.5 0 1 1 ${cx + 3} ${cy - 11} Z" fill="${c}"/>`;
    case 'tree':
      return `<polygon points="${cx},${cy - 12} ${cx - 8},${cy + 1} ${cx + 8},${cy + 1}" fill="${c}"/><polygon points="${cx},${cy - 6} ${cx - 10},${cy + 7} ${cx + 10},${cy + 7}" fill="${c}"/><rect x="${cx - 1.5}" y="${cy + 7}" width="3" height="5" fill="${c}"/>`;
    case 'tower':
      return `<path d="M ${cx - 6} ${cy + 12} V ${cy - 6} H ${cx - 8} V ${cy - 12} H ${cx - 4} V ${cy - 9} H ${cx - 1.5} V ${cy - 12} H ${cx + 1.5} V ${cy - 9} H ${cx + 4} V ${cy - 12} H ${cx + 8} V ${cy - 6} H ${cx + 6} V ${cy + 12} Z" fill="${c}"/>`;
    case 'wave':
      return `<path d="M ${cx - 14} ${cy - 4} q 3.5 -6 7 0 t 7 0 t 7 0 t 7 0 M ${cx - 14} ${cy + 4} q 3.5 -6 7 0 t 7 0 t 7 0 t 7 0" fill="none" stroke="${c}" stroke-width="2.5"/>`;
    case 'mountain':
      return `<polygon points="${cx - 14},${cy + 10} ${cx - 4},${cy - 8} ${cx + 1},${cy + 1} ${cx + 6},${cy - 5} ${cx + 14},${cy + 10}" fill="${c}"/>`;
    case 'sword':
      return `<polygon points="${cx - 1.5},${cy - 13} ${cx + 1.5},${cy - 13} ${cx + 2},${cy + 4} ${cx - 2},${cy + 4}" fill="${c}"/><rect x="${cx - 7}" y="${cy + 4}" width="14" height="3" fill="${c}"/><rect x="${cx - 1.5}" y="${cy + 7}" width="3" height="6" fill="${c}"/>`;
    case 'gear': {
      let teeth = '';
      for (let i = 0; i < 8; i++) {
        teeth += `<rect x="${cx - 2}" y="${cy - 13}" width="4" height="5" fill="${c}" transform="rotate(${i * 45} ${cx} ${cy})"/>`;
      }
      return `${teeth}<circle cx="${cx}" cy="${cy}" r="9" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="3.5" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2"/>`;
    }
    case 'eye':
      return `<path d="M ${cx - 14} ${cy} Q ${cx} ${cy - 13} ${cx + 14} ${cy} Q ${cx} ${cy + 13} ${cx - 14} ${cy} Z" fill="${c}"/><circle cx="${cx}" cy="${cy}" r="4.5" fill="#000" fill-opacity="0.6"/>`;
    case 'crown':
      return `<polygon points="${cx - 12},${cy + 8} ${cx - 12},${cy - 7} ${cx - 6},${cy} ${cx},${cy - 10} ${cx + 6},${cy} ${cx + 12},${cy - 7} ${cx + 12},${cy + 8}" fill="${c}"/>`;
    case 'anchor':
      return `<circle cx="${cx}" cy="${cy - 9}" r="3" fill="none" stroke="${c}" stroke-width="2"/><path d="M ${cx} ${cy - 6} V ${cy + 11} M ${cx - 6} ${cy - 2} H ${cx + 6} M ${cx - 11} ${cy + 3} Q ${cx - 9} ${cy + 11} ${cx} ${cy + 11} Q ${cx + 9} ${cy + 11} ${cx + 11} ${cy + 3}" fill="none" stroke="${c}" stroke-width="2.2"/>`;
    case 'flame':
      return `<path d="M ${cx} ${cy - 13} C ${cx + 3} ${cy - 6} ${cx + 10} ${cy - 3} ${cx + 8} ${cy + 5} C ${cx + 6} ${cy + 12} ${cx - 6} ${cy + 12} ${cx - 8} ${cy + 5} C ${cx - 9} ${cy} ${cx - 3} ${cy - 3} ${cx} ${cy - 13} Z" fill="${c}"/>`;
    case 'wheat': {
      let ears = '';
      for (let i = 0; i < 4; i++) {
        const y = cy - 9 + i * 5;
        ears += `<ellipse cx="${cx - 4}" cy="${y}" rx="4" ry="1.8" fill="${c}" transform="rotate(-30 ${cx - 4} ${y})"/><ellipse cx="${cx + 4}" cy="${y}" rx="4" ry="1.8" fill="${c}" transform="rotate(30 ${cx + 4} ${y})"/>`;
      }
      return `<rect x="${cx - 0.9}" y="${cy - 12}" width="1.8" height="24" fill="${c}"/>${ears}`;
    }
    case 'skull':
      return `<path d="M ${cx - 9} ${cy + 1} A 9 10 0 1 1 ${cx + 9} ${cy + 1} V ${cy + 5} H ${cx + 5} V ${cy + 11} H ${cx - 5} V ${cy + 5} H ${cx - 9} Z" fill="${c}"/><circle cx="${cx - 3.6}" cy="${cy - 1}" r="2.6" fill="#000" fill-opacity="0.65"/><circle cx="${cx + 3.6}" cy="${cy - 1}" r="2.6" fill="#000" fill-opacity="0.65"/>`;
  }
}

function layout(spec: FlagSpec): string {
  const [c0 = '#888', c1 = c0, c2 = c0, c3 = c1] = spec.colors;
  const rect = (x: number, y: number, w: number, h: number, c: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  switch (spec.layout) {
    case 'plain': return rect(0, 0, W, H, c0);
    case 'horizontal2': return rect(0, 0, W, H / 2, c0) + rect(0, H / 2, W, H / 2, c1);
    case 'horizontal3': return rect(0, 0, W, H / 3, c0) + rect(0, H / 3, W, H / 3, c1) + rect(0, (2 * H) / 3, W, H / 3, c2);
    case 'vertical2': return rect(0, 0, W / 2, H, c0) + rect(W / 2, 0, W / 2, H, c1);
    case 'vertical3': return rect(0, 0, W / 3, H, c0) + rect(W / 3, 0, W / 3, H, c1) + rect((2 * W) / 3, 0, W / 3, H, c2);
    case 'cross':
      return rect(0, 0, W, H, c0) + rect(0, H / 2 - 6, W, 12, c1) + rect(W / 2 - 14, 0, 12, H, c1);
    case 'saltire':
      return rect(0, 0, W, H, c0)
        + `<line x1="0" y1="0" x2="${W}" y2="${H}" stroke="${c1}" stroke-width="10"/><line x1="${W}" y1="0" x2="0" y2="${H}" stroke="${c1}" stroke-width="10"/>`;
    case 'canton':
      return rect(0, 0, W, H, c0) + rect(0, 0, W * 0.42, H * 0.5, c1) + (spec.colors.length > 2 ? rect(0, H * 0.5, W, H * 0.12, c2) : '');
    case 'diagonal':
      return rect(0, 0, W, H, c0) + `<polygon points="0,0 ${W},0 0,${H}" fill="${c1}"/>` + (spec.colors.length > 2 ? `<polygon points="${W},${H} ${W},0 0,${H}" fill="${c3}"/>` : '');
    case 'border':
      return rect(0, 0, W, H, c0) + rect(5, 5, W - 10, H - 10, c1);
  }
}

/** A complete <svg> string for the flag. */
export function flagSvg(spec: FlagSpec, width = 90, height = 60): string {
  const em = emblem(spec.emblem, spec.emblemColor, spec.layout === 'canton' ? W * 0.21 : W / 2, spec.layout === 'canton' ? H * 0.25 : H / 2);
  const scaled = spec.layout === 'canton' && spec.emblem !== 'none'
    ? `<g transform="translate(${W * 0.21} ${H * 0.25}) scale(0.7) translate(${-W * 0.21} ${-H * 0.25})">${em}</g>`
    : em;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${layout(spec)}${scaled}</svg>`;
}
