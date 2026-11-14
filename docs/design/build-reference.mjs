// Builds docs/design/reference.html, the Terra Nova screens in plain HTML and CSS (the Figma file was imported from it).
// Run from the repo root: node docs/design/build-reference.mjs web/src/theme/tokens.css docs/design/reference.html preview
// Without "preview" it inlines every var() and drops the font @import, which is what the Figma importer needs.

import { readFileSync, writeFileSync } from 'node:fs';
const [, , tokensPath, outPath, mode] = process.argv; // mode: 'preview' keeps the font @import
let tokens = readFileSync(tokensPath, 'utf8');
if (mode !== 'preview') tokens = tokens.replace(/@import[^;]+;/, '');

// ---------- seeded random ----------
let s = 7;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const seed = (v) => { s = v; };

// ---------- data ----------
const N = [
  { id: 0, name: 'The Ashen Concord', color: '#c8553d', leader: 'Speaker Maren Voss', flag: ['h3', ['#c8553d', '#2b2b2b', '#e8d9b5'], '#e8d9b5'] },
  { id: 1, name: 'The Verdane Kingdom', color: '#4f9d5b', leader: 'Queen Illaria the Green', flag: ['v2', ['#4f9d5b', '#e9e2c8'], '#1e4d2b'] },
  { id: 2, name: "The Tidewrights' League", color: '#3d7fc8', leader: 'Admiral Osric Kell', flag: ['h2', ['#3d7fc8', '#16324f'], '#f1ead2'] },
  { id: 3, name: 'The Sunspire Dominion', color: '#d9a42f', leader: 'High Solarch Teodar', flag: ['cross', ['#d9a42f', '#fff1c4'], '#7a4a00'] },
  { id: 4, name: 'The Hollow Court', color: '#8a5cc2', leader: 'The Veiled Regent', flag: ['diag', ['#8a5cc2', '#1d1230'], '#f0e0ff'] },
  { id: 5, name: 'The Free Saltmarches', color: '#2fa596', leader: 'Warden Isolde Marr', flag: ['h2', ['#2fa596', '#0f3b36'], '#ecdfc0'] },
];
const STANCE_TO_ASHEN = { 1: 'neutral', 2: 'trade', 3: 'war', 4: 'hostile', 5: 'alliance' };
const STANCE_COL = { war: '#b3261e', hostile: '#d0782a', neutral: '#9a9484', trade: '#3f8fb0', alliance: '#4d8a4a' };

// ---------- primitives ----------
function flag(n, w = 66, h = 44) {
  const [l, c, e] = n.flag;
  let bands = '';
  if (l === 'h3') bands = `<rect width="${w}" height="${h / 3}" fill="${c[0]}"/><rect y="${h / 3}" width="${w}" height="${h / 3}" fill="${c[1]}"/><rect y="${(2 * h) / 3}" width="${w}" height="${h / 3}" fill="${c[2]}"/>`;
  if (l === 'h2') bands = `<rect width="${w}" height="${h / 2}" fill="${c[0]}"/><rect y="${h / 2}" width="${w}" height="${h / 2}" fill="${c[1]}"/>`;
  if (l === 'v2') bands = `<rect width="${w / 2}" height="${h}" fill="${c[0]}"/><rect x="${w / 2}" width="${w / 2}" height="${h}" fill="${c[1]}"/>`;
  if (l === 'cross') bands = `<rect width="${w}" height="${h}" fill="${c[0]}"/><rect x="${w * 0.3}" width="${w * 0.14}" height="${h}" fill="${c[1]}"/><rect y="${h * 0.43}" width="${w}" height="${h * 0.14}" fill="${c[1]}"/>`;
  if (l === 'diag') bands = `<rect width="${w}" height="${h}" fill="${c[1]}"/><polygon points="0,0 ${w},0 0,${h}" fill="${c[0]}"/>`;
  return `<svg class="flag" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${bands}<circle cx="${w / 2}" cy="${h / 2}" r="${h * 0.17}" fill="${e}"/><rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="#2a1f14" stroke-width="1"/></svg>`;
}
function blob(cx, cy, r, n = 10, jit = 0.32) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - jit / 2 + rnd() * jit);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}
function stars(count, w = 1440, h = 900, sd = 3) {
  seed(sd);
  let o = '';
  for (let i = 0; i < count; i++) {
    const big = rnd() > 0.85;
    const sz = big ? 2 : 1;
    const op = (0.25 + rnd() * 0.65).toFixed(2);
    o += `<div class="star" style="left:${Math.floor(rnd() * w)}px;top:${Math.floor(rnd() * h)}px;width:${sz}px;height:${sz}px;opacity:${op}"></div>`;
  }
  return o;
}
// The painted globe. mode: political | diplomacy | forming. Returns html positioned at (x,y).
const LAND = [
  // [nation id or -1 unclaimed, fx, fy, fr]
  [-1, 0.52, 0.52, 0.22], [-1, 0.2, 0.3, 0.06], [-1, 0.86, 0.36, 0.05], [-1, 0.3, 0.82, 0.05],
  [1, 0.36, 0.42, 0.155], [4, 0.58, 0.29, 0.13], [3, 0.7, 0.5, 0.14], [0, 0.53, 0.63, 0.15],
  [2, 0.37, 0.71, 0.11], [2, 0.22, 0.6, 0.06], [5, 0.77, 0.72, 0.08],
];
const CAP = { 0: [0.53, 0.63], 1: [0.35, 0.41], 2: [0.37, 0.71], 3: [0.7, 0.49], 4: [0.58, 0.29], 5: [0.76, 0.71] };
function globe({ x, y, size, mode = 'political', selected = 0, armies = true, dim = 1, beliefs = false }) {
  const R = size / 2;
  seed(42);
  let land = '';
  for (const [id, fx, fy, fr] of LAND) {
    const d = blob(fx * size, fy * size, fr * size, 11, 0.38);
    let fill = '#b9a57a';
    if (id >= 0 && mode === 'political') fill = N[id].color;
    if (id >= 0 && mode === 'diplomacy') fill = id === selected ? '#c9a24b' : STANCE_COL[STANCE_TO_ASHEN[id]];
    if (mode === 'forming') fill = id >= 0 ? '#a99668' : '#b9a57a';
    const op = id >= 0 ? 0.88 : 0.95;
    const sel = id === selected && mode !== 'forming';
    land += `<path d="${d}" fill="${fill}" fill-opacity="${op}" stroke="${sel ? '#7fe6d8' : '#2a1f14'}" stroke-opacity="${sel ? 1 : 0.7}" stroke-width="${sel ? 2.5 : 1.2}"/>`;
  }
  if (beliefs) {
    // stale belief: the Hollow Court still thinks it holds a strip of Sunspire land
    seed(9);
    land += `<path d="${blob(0.64 * size, 0.4 * size, 0.06 * size, 9, 0.3)}" fill="#8a5cc2" fill-opacity="0.55" stroke="#7fe6d8" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  }
  let grat = '';
  for (const k of [0.25, 0.5, 0.75]) grat += `<ellipse cx="${R}" cy="${R}" rx="${R * Math.sin(k * Math.PI) * 0.999}" ry="${R}" fill="none" stroke="#ecdfc0" stroke-opacity="0.16" stroke-width="0.8"/>`;
  for (const lat of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const cy = R + Math.sin(lat) * R; const rx = Math.cos(lat) * R;
    grat += `<ellipse cx="${R}" cy="${cy}" rx="${rx}" ry="${rx * 0.12}" fill="none" stroke="#ecdfc0" stroke-opacity="0.16" stroke-width="0.8"/>`;
  }
  let marks = '';
  if (mode !== 'forming') for (const id of Object.keys(CAP)) {
    const [cx, cy] = CAP[id];
    marks += `<circle cx="${cx * size}" cy="${cy * size}" r="4.5" fill="#ecdfc0" stroke="#2a1f14" stroke-width="1.5"/><circle cx="${cx * size}" cy="${cy * size}" r="1.6" fill="#2a1f14"/>`;
  }
  const armyTags = armies && mode !== 'forming' ? [[0.6, 0.57, 14, 0], [0.66, 0.55, 11, 3], [0.42, 0.47, 8, 1], [0.3, 0.66, 6, 2]].map(([fx, fy, n, id]) =>
    `<div class="army" style="left:${x + fx * size - 14}px;top:${y + fy * size - 10}px;border-color:${N[id].color}">${n}</div>`).join('') : '';
  const battle = armies && mode !== 'forming' ? `<div class="battle" style="left:${x + 0.635 * size - 9}px;top:${y + 0.6 * size - 9}px"></div>` : '';
  return `<svg class="globe" style="left:${x}px;top:${y}px;opacity:${dim}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="ocean${size}${mode}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#2f6476"/><stop offset="0.7" stop-color="#173a4c"/><stop offset="1" stop-color="#0b1a26"/></radialGradient>
      <radialGradient id="shade${size}${mode}" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="#fff6dc" stop-opacity="0.16"/><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.62"/></radialGradient>
      <clipPath id="clip${size}${mode}"><circle cx="${R}" cy="${R}" r="${R}"/></clipPath>
    </defs>
    <circle cx="${R}" cy="${R}" r="${R + 10}" fill="#7fe6d8" fill-opacity="0.05"/>
    <circle cx="${R}" cy="${R}" r="${R + 4}" fill="#7fe6d8" fill-opacity="0.08"/>
    <g clip-path="url(#clip${size}${mode})">
      <circle cx="${R}" cy="${R}" r="${R}" fill="url(#ocean${size}${mode})"/>
      ${land}${grat}${marks}
      <circle cx="${R}" cy="${R}" r="${R}" fill="url(#shade${size}${mode})"/>
    </g>
    <circle cx="${R}" cy="${R}" r="${R - 0.5}" fill="none" stroke="#7fe6d8" stroke-opacity="0.35" stroke-width="1"/>
  </svg>${armyTags}${battle}`;
}
function scanlines(w, h) {
  let r = '';
  for (let yy = 0; yy < h; yy += 3) r += `<rect y="${yy}" width="${w}" height="1"/>`;
  return `<svg class="scan" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="#7fe6d8" fill-opacity="0.12">${r}</svg>`;
}
function beam({ x, top, bottom, warm = false, topW = 360 }) {
  const h = bottom - top; const c = warm ? '#ffcf7a' : '#7fe6d8';
  const id = `beam${x}${top}${warm ? 'w' : 'c'}`;
  return `<svg class="beam" style="left:${x - topW / 2}px;top:${top}px" width="${topW}" height="${h + 18}" viewBox="0 0 ${topW} ${h + 18}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0.42"/><stop offset="0.55" stop-color="${c}" stop-opacity="0.12"/><stop offset="1" stop-color="${c}" stop-opacity="0.5"/></linearGradient></defs>
    <polygon points="0,0 ${topW},0 ${topW / 2 + 6},${h} ${topW / 2 - 6},${h}" fill="url(#${id})"/>
    <polygon points="${topW * 0.3},0 ${topW * 0.7},0 ${topW / 2 + 2},${h} ${topW / 2 - 2},${h}" fill="${c}" fill-opacity="0.12"/>
    <ellipse cx="${topW / 2}" cy="${h}" rx="22" ry="7" fill="${c}" fill-opacity="0.35"/>
    <ellipse cx="${topW / 2}" cy="${h}" rx="9" ry="3" fill="#ffffff" fill-opacity="0.85"/>
  </svg>`;
}
const ico = {
  play: (c = 'currentColor') => `<svg class="ico" width="10" height="10" viewBox="0 0 10 10"><polygon points="1,0 10,5 1,10" fill="${c}"/></svg>`,
  stop: (c = 'currentColor') => `<svg class="ico" width="9" height="9" viewBox="0 0 9 9"><rect width="9" height="9" fill="${c}"/></svg>`,
  pause: (c = 'currentColor') => `<svg class="ico" width="10" height="11" viewBox="0 0 10 11"><rect width="3.5" height="11" fill="${c}"/><rect x="6.5" width="3.5" height="11" fill="${c}"/></svg>`,
  close: (c = '#2a1f14') => `<svg class="ico" width="12" height="12" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="${c}" stroke-width="1.6"/></svg>`,
  chevron: (c = '#2a1f14') => `<svg class="ico" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1L5 5L9 1" stroke="${c}" stroke-width="1.5" fill="none"/></svg>`,
  diamond: (c) => `<svg class="ico" width="9" height="9" viewBox="0 0 9 9"><polygon points="4.5,0 9,4.5 4.5,9 0,4.5" fill="${c}"/></svg>`,
  eq: (c = '#f6eedb') => `<svg class="ico" width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="5" width="3" height="7" fill="${c}"/><rect x="4.5" y="1" width="3" height="11" fill="${c}"/><rect x="9" y="3" width="3" height="9" fill="${c}"/><rect x="13" y="6" width="3" height="6" fill="${c}"/></svg>`,
};
const KIND = { founding: '#c9a24b', proclamation: '#8a7a5c', growth: '#6f8f4e', war: '#b3261e', battle: '#d0782a', peace: '#4d8a4a', alliance: '#3f8fb0', betrayal: '#7d3c8f', fall: '#3b3129', secession: '#2fa596', silence: '#7fe6d8', return: '#4fb7c9', dispute: '#c7802a', decree: '#9c2f22' };

// ---------- components ----------
function topbar({ conn = 'live', speed = 2, paused = false, map = 'political', meter = 'live' } = {}) {
  const modes = ['Political', 'Terrain', 'Diplomacy', 'Strength'].map((m) => `<span class="seg ${m.toLowerCase() === map ? 'on' : ''}">${m}</span>`).join('');
  const speeds = [1, 2, 4, 8].map((v) => `<span class="seg mono ${!paused && v === speed ? 'on' : ''}">${v}x</span>`).join('');
  const connTxt = { live: 'Live', reconnecting: 'Reconnecting', offline: 'Offline' }[conn];
  return `<div class="topbar">
    <div class="tb-group">
      <span class="wordmark">Terra Nova</span><span class="vsep"></span>
      <div class="tb-world"><div class="tb-name">The Salt Age</div><div class="tb-era">a drowned, post-apocalyptic world</div></div>
      <div class="tb-year"><span class="cap">Year</span><span class="num">214</span></div>
      <span class="conn conn-${conn}"><i></i>${connTxt}</span>
    </div>
    <div class="tb-group"><div class="segs">${modes}</div></div>
    <div class="tb-group">
      <div class="segs"><span class="seg icon ${paused ? 'on' : ''}">${ico.pause()}</span>${speeds}</div>
      ${meterHtml(meter)}
      <span class="btn primary-dark">New world</span>
    </div>
  </div>`;
}
function meterHtml(m) {
  const d = { mock: ['0', '0', 'Mock'], live: ['412', '186.4k', 'Live'], capped: ['1,200', '600.0k', 'Capped'] }[m];
  return `<div class="meter meter-${m}"><span class="num">${d[0]}</span> calls<span class="dot">·</span><span class="num">${d[1]}</span> tokens<span class="dot">·</span><span class="mode">${d[2]}</span></div>`;
}
function ticker(x, y, w) {
  const items = [
    [214, 'battle', 'Ashen pikemen hold the ford at Cinder Bend against the Sunspire host.'],
    [213, 'proclamation', 'The Veiled Regent: "Every bargain has a second page."'],
    [212, 'war', 'The Sunspire Dominion declares holy war on the Ashen Concord.'],
    [210, 'growth', 'Saltgate becomes a city.'],
  ].map(([yr, k, t]) => `<span class="t-item">${ico.diamond(KIND[k])}<span class="yr">Y${yr}</span><span class="t-txt">${t}</span></span>`).join('<span class="t-sep"></span>');
  return `<div class="ticker" style="left:${x}px;top:${y}px;width:${w}px"><span class="t-label">Chronicle</span><div class="t-track">${items}</div><span class="btn small">Timeline ${ico.chevron('#2a1f14')}</span></div>`;
}
function decree(x, y, typed = false) {
  return `<div class="decree" style="left:${x}px;top:${y}px">
    <span class="cap rub">Decree</span>
    <div class="d-input ${typed ? 'typed' : ''}">${typed ? 'A comet splits the sky over Sunspire' : 'A plague, a meteor, a prophet...'}</div>
    <span class="btn primary small">Proclaim</span>
  </div>`;
}
function card({ state = 'idle', docked = false, loading = false, tab = 'culture' } = {}) {
  const n = N[0];
  const narr = state === 'narration', anth = state === 'anthem', speaking = narr || anth;
  const rel = [3, 4, 2, 5, 1].map((id) => {
    const st = STANCE_TO_ASHEN[id];
    return `<div class="rel"><span class="sw" style="background:${N[id].color}"></span><span class="rel-name">${N[id].name}</span><span class="stance stance-${st}">${st}</span></div>`;
  }).join('');
  const body = loading ? `
    <div class="sec"><h3>Summary</h3><div class="loading-lines"><div></div><div></div><div style="width:70%"></div></div><div class="muted small">Consulting the archives...</div></div>`
    : `
    <div class="sec"><h3>Summary</h3><p>A guild-republic built on the ashes of its own capital. Its merchants hold the salt roads of the southern shelf, and its ledgers are older than its laws.</p></div>
    <div class="tabs">${['Culture', 'Politics', 'History', 'Relations'].map((t) => `<span class="tab ${t.toLowerCase() === tab ? 'on' : ''}">${t}</span>`).join('')}</div>
    <div class="sec tab-body">${tab === 'relations' ? rel : `
      <div class="chips"><span class="chip">ledger-keepers</span><span class="chip">ash-marked contracts</span><span class="chip">smoked fish feasts</span><span class="chip">distrust of kings</span></div>
      <p class="small">Every contract is sealed with a thumb of ash from the old capital's hearths, and no guild may sit at the Concord's table alone.</p>`}
    </div>`;
  const narrBtn = narr
    ? `<span class="btn primary play">${ico.stop('#f6eedb')} Stop ${ico.eq()}</span>`
    : `<span class="btn play">${ico.play('#2a1f14')} Narrate</span>`;
  const anthBtn = anth
    ? `<span class="btn primary play">${ico.stop('#f6eedb')} Stop anthem ${ico.eq()}</span>`
    : `<span class="btn play">${ico.play('#2a1f14')} Anthem</span>`;
  const progress = speaking ? `<div class="progress"><div style="width:38%"></div></div><div class="now-playing mono">${anth ? 'Anthem of the Concord · 0:41 / 1:48' : 'Narration · 0:22 / 0:58'}</div>` : '';
  return `<div class="card ${docked ? 'docked panel-look' : 'holo-look'} ${speaking ? 'warm' : ''}">
    ${docked ? '' : scanlines(380, 600)}
    <div class="card-in">
      <div class="c-head">${flag(n)}<div class="c-title"><div class="c-name">${n.name}</div><div class="c-leader">Led by ${n.leader}</div></div><span class="c-close">${ico.close()}</span></div>
      <div class="ideology">"Prosperity is the only law that outlasts a fire."</div>
      <div class="facts">
        <div><span class="cap">Government</span><span class="v">Merchant republic</span></div>
        <div><span class="cap">Provinces</span><span class="v mono">41</span></div>
        <div><span class="cap">Population</span><span class="v mono">1,284,000</span></div>
        <div><span class="cap">Treasury</span><span class="v mono">9,420 crowns</span></div>
      </div>
      ${body}
      <div class="c-foot">${narrBtn}${anthBtn}</div>
      ${progress}
    </div>
  </div>`;
}
function netPanel({ blackout = false, beliefs = false, compact = false } = {}) {
  const rows = [
    { id: 0, link: 'up', ruler: 'llm', sel: true },
    { id: 1, link: 'up', ruler: 'autopilot' },
    { id: 2, link: 'up', ruler: 'llm' },
    { id: 3, link: 'up', ruler: 'llm' },
    { id: 4, link: 'cut', ruler: 'llm', queued: 7, silent: 12 },
    { id: 5, deleted: true },
  ].slice(0, compact ? 3 : 6).map((r) => {
    const n = N[r.id];
    if (blackout) { r = { ...r, link: 'cut', queued: 3, silent: 2 }; }
    if (r.deleted && !blackout) return `<div class="nrow deleted"><div class="nr-top"><span class="sw" style="background:${n.color}"></span><span class="nr-name">${n.name}</span><span class="state del">Deleted</span></div><div class="nr-sub">Its lands lie in ruin; neighbours are carving them up.</div></div>`;
    const link = r.link === 'up' ? '<span class="state up"><i></i>Link up</span>' : '<span class="state cut"><i></i>Cut</span>';
    const ruler = r.ruler === 'llm' ? '<span class="state llm">LLM ruler</span>' : '<span class="state auto">Autopilot</span>';
    const sub = r.link === 'cut' ? `<div class="nr-sub mono">${r.queued} events queued · silent ${r.silent} yrs</div>` : '';
    return `<div class="nrow ${r.sel ? 'sel' : ''} ${r.link === 'cut' ? 'is-cut' : ''}">
      <div class="nr-top"><span class="sw" style="background:${n.color}"></span><span class="nr-name">${n.name}</span></div>
      <div class="nr-states">${link}${ruler}</div>${sub}
      <div class="nr-btns"><span class="btn xs">${r.link === 'up' ? 'Cut' : 'Restore'}</span><span class="btn xs">${r.ruler === 'llm' ? 'Silence' : 'Wake'}</span><span class="btn xs danger">Delete</span></div>
    </div>`;
  }).join('');
  return `<div class="net panel-look">
    <div class="net-head"><h2>The Network</h2><div class="muted small">Each nation thinks for itself. Cut its link, silence its ruler, or delete it.</div></div>
    <div class="switch-row ${blackout ? 'on' : ''}"><div><div class="sw-title">Blackout</div><div class="small muted">Cut every link at once</div></div><span class="toggle danger ${blackout ? 'on' : ''}"><i></i></span></div>
    <div class="switch-row ${beliefs ? 'on' : ''}"><div><div class="sw-title">Show beliefs</div><div class="small muted">${beliefs ? 'What the Hollow Court thinks is true' : 'Draw the selected nation\'s map, not the truth'}</div></div><span class="toggle ${beliefs ? 'on' : ''}"><i></i></span></div>
    <div class="rows">${rows}</div>
  </div>`;
}
function screen(name, inner, starCount = 110) {
  return `<section class="screen" data-name="${name}">${stars(starCount, 1440, 900, name.length * 7)}${inner}</section>`;
}
const label = (x, y, t) => `<div class="spec-label" style="left:${x}px;top:${y}px">${t}</div>`;

// ---------- screens ----------
const overview = screen('Overview · the running world', `
  ${globe({ x: 470, y: 300, size: 760 })}
  ${beam({ x: 873, top: 640, bottom: 779 })}
  <div class="abs" style="left:683px;top:72px">${card({})}</div>
  ${topbar({})}
  <div class="abs" style="left:16px;top:68px">${netPanel({})}</div>
  ${decree(1044, 784)}
  ${ticker(16, 844, 1408)}
`);

const create = screen('Create screen', `
  ${globe({ x: 270, y: 60, size: 900, mode: 'forming', dim: 0.85 })}
  <div class="veil"></div>
  <div class="brand"><span class="wordmark">Terra Nova</span><span class="brand-sub">a living world, ruled by independent AIs</span></div>
  <div class="create panel-look" style="left:400px;top:92px">
    <div class="cr-head"><div class="cap rub">A new world</div><h1>Found a World</h1><div class="muted">Describe it in a line. The nations will write the rest.</div></div>
    <div class="field"><span class="cap">Your world</span><div class="prompt">A drowned world where salt kingdoms trade over the old coastlines<span class="caret"></span></div></div>
    <div class="field"><span class="cap">Or start from</span><div class="chips">
      <span class="chip active">Post-apocalyptic</span><span class="chip">Bronze age</span><span class="chip">Floating archipelago</span><span class="chip">Ice world</span><span class="chip">Desert empires</span><span class="chip">Clockwork age</span><span class="chip">Jungle city-states</span>
    </div></div>
    <div class="grid2">
      <div class="field"><span class="cap">Nations</span><div class="stepper"><span class="st-btn">-</span><span class="st-val mono">6</span><span class="st-btn">+</span><div class="pips">${[3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<i class="${v <= 6 ? 'on' : ''}"></i>`).join('')}</div></div><div class="hint">3 to 10</div></div>
      <div class="field"><span class="cap">Era</span><div class="select">Post-apocalyptic ${ico.chevron()}</div><div class="hint">Sets the starting technology and names</div></div>
    </div>
    <div class="grid2">
      <div class="field"><span class="cap">Sea level <b class="mono">55%</b></span><div class="slider"><div class="fill" style="width:55%"></div><div class="knob" style="left:55%"></div></div><div class="ends"><span>Dry continents</span><span>Drowned</span></div></div>
      <div class="field"><span class="cap">Aggression <b class="mono">50%</b></span><div class="slider"><div class="fill" style="width:50%"></div><div class="knob" style="left:50%"></div></div><div class="ends"><span>Peaceful</span><span>Warlike</span></div></div>
    </div>
    <div class="cr-foot"><span class="mono small muted-ink">Mock mode · no tokens will be spent</span><span class="btn primary big">Create world</span></div>
  </div>
  <div class="spec-note" style="left:1080px;top:520px"><div class="cap">States</div>Create: disabled until the prompt has text.<br/>While founding: the button reads "Founding the world..." and the globe behind forms.<br/>Error: one italic line in rubric red above the footer.</div>
`);

const cardScreen = screen('Hologram nation card', `
  ${globe({ x: 60, y: 600, size: 1300, armies: false, dim: 0.9 })}
  ${label(40, 22, 'Hologram · idle · cyan beam · culture tab')}
  ${beam({ x: 230, top: 602, bottom: 880 })}
  <div class="abs" style="left:40px;top:52px">${card({})}</div>
  ${label(530, 22, 'Hologram · anthem playing · warm beam · relations tab')}
  ${beam({ x: 720, top: 646, bottom: 880, warm: true })}
  <div class="abs" style="left:530px;top:52px">${card({ state: 'anthem', tab: 'relations' })}</div>
  ${label(1044, 22, 'Docked · narrow screens · lore loading')}
  <div class="abs" style="left:1044px;top:52px">${card({ docked: true, loading: true })}</div>
  <div class="spec-note" style="left:1044px;top:520px;width:370px"><div class="cap">Docked</div>Below 1100 px wide the card leaves the beam and docks to the right edge under the top bar: solid parchment, the double ink rule, no glow and no scan lines. Same component, same props.</div>
`, 90);

const chronEntries = [
  [214, 'battle', [0, 3], 'Ashen pikemen hold the ford at Cinder Bend against the Sunspire host.'],
  [203, 'return', [4], 'The Hollow Court returns from the Silence; two border claims are disputed and settled.'],
  [196, 'silence', [4], 'The Silence: no word comes out of the Hollow Court.'],
];
function timeline() {
  const y0 = 120, y1 = 214, W = 1120;
  const X = (yr) => ((yr - y0) / (y1 - y0)) * W;
  let axis = '';
  for (let yr = 120; yr <= 210; yr += 10) axis += `<div class="tick" style="left:${X(yr)}px"><span class="mono">${yr}</span></div>`;
  const ev = [
    [0, 122, 'founding'], [1, 124, 'founding'], [2, 125, 'founding'], [3, 127, 'founding'], [4, 129, 'founding'],
    [0, 140, 'growth'], [2, 146, 'alliance'], [3, 150, 'proclamation'], [1, 158, 'decree'], [4, 163, 'betrayal'],
    [2, 168, 'growth'], [0, 171, 'proclamation'], [1, 176, 'peace'], [3, 182, 'dispute'], [5, 186, 'secession'],
    [4, 196, 'silence'], [4, 203, 'return'], [3, 203, 'dispute'], [5, 190, 'alliance'], [3, 212, 'war'], [0, 212, 'war'], [0, 214, 'battle'], [3, 214, 'battle'], [2, 198, 'fall'],
  ];
  const lanes = N.map((n, i) => `<div class="lane" style="top:${i * 34}px"><div class="lane-name"><span class="sw" style="background:${n.color}"></span>${n.name.replace('The ', '')}</div></div>`).join('');
  const marks = ev.map(([l, yr, k]) => `<div class="ev" style="left:${X(yr) - 6}px;top:${l * 34 + 11}px">${ico.diamond(KIND[k]).replace('width="9" height="9"', 'width="13" height="13"')}</div>`).join('');
  const wars = [[0, 3, 212, 214], [1, 4, 152, 161]].map(([a, b, s, e]) => `<div class="warband" style="left:${X(s)}px;width:${X(e) - X(s) + 4}px;top:${a * 34 + 6}px;height:22px"></div><div class="warband" style="left:${X(s)}px;width:${X(e) - X(s) + 4}px;top:${b * 34 + 6}px;height:22px"></div>`).join('');
  const silence = `<div class="silence" style="left:${X(196)}px;width:${X(203) - X(196)}px"><span>The Silence</span></div>`;
  const tip = `<div class="tip" style="left:${X(186) - 120}px;top:${5 * 34 - 96}px"><div class="tip-k mono">${ico.diamond(KIND.secession)} Y186 · Secession</div>The salt-flat towns of Varrow break from the Tidewrights and crown no one: the Free Saltmarches are born.</div>`;
  const legend = Object.entries({ war: 'War', battle: 'Battle', peace: 'Peace', alliance: 'Alliance', betrayal: 'Betrayal', fall: 'Fall', secession: 'Secession', dispute: 'Dispute', silence: 'Silence', decree: 'Decree', founding: 'Founding' })
    .map(([k, t]) => `<span class="lg">${ico.diamond(KIND[k])}${t}</span>`).join('');
  return `<div class="timeline panel-look">
    <div class="tl-head"><div><h2>The Chronicle</h2><div class="muted">of the Salt Age, years 120 to 214</div></div><div class="legend">${legend}</div><span class="btn small">Collapse ${ico.chevron()}</span></div>
    <div class="tl-body">
      <div class="axis">${axis}<div class="now" style="left:${X(214)}px"><span class="mono">Now · 214</span></div></div>
      <div class="lanes">${lanes}<div class="track">${silence}${wars}${marks}${tip}</div></div>
    </div>
    <div class="tl-list">${chronEntries.map(([yr, k, , t]) => `<div class="tl-entry">${ico.diamond(KIND[k])}<span class="yr mono">Y${yr}</span><span class="k cap">${k}</span><span>${t}</span></div>`).join('')}</div>
  </div>`;
}
const chronicle = screen('Chronicle · ticker and timeline', `
  ${globe({ x: 470, y: 60, size: 500, armies: false, dim: 0.75 })}
  ${topbar({})}
  ${label(16, 72, 'Ticker · collapsed (always visible at the bottom)')}
  ${ticker(16, 96, 1408)}
  ${label(16, 330, 'Timeline · expanded (press Timeline)')}
  <div class="abs" style="left:16px;top:354px">${timeline()}</div>
`, 90);

const network = screen('Network panel · diplomacy map mode', `
  ${globe({ x: 430, y: 150, size: 700, mode: 'diplomacy', beliefs: true })}
  ${topbar({ map: 'diplomacy' })}
  <div class="abs" style="left:16px;top:68px">${netPanel({ beliefs: true })}</div>
  <div class="belief-banner"><span class="cap">Beliefs</span>Showing what <b>The Hollow Court</b> believes · <span class="mono">12 years</span> out of date<span class="btn xs">Show the truth</span></div>
  <div class="legend-box panel-look" style="left:1196px;top:660px"><div class="cap rub">Diplomacy</div><div class="small muted" style="margin-bottom:6px">Towards the Ashen Concord</div>
    ${['war', 'hostile', 'neutral', 'trade', 'alliance'].map((st) => `<div class="lg-row"><span class="sw" style="background:${STANCE_COL[st]}"></span>${st[0].toUpperCase() + st.slice(1)}</div>`).join('')}
  </div>
  ${label(1136, 76, 'Blackout · on')}
  <div class="abs" style="left:1136px;top:100px;transform-origin:0 0">${netPanel({ blackout: true, compact: true })}</div>
  ${ticker(16, 844, 1408)}
`);

const topScreen = screen('Top bar · states', `
  ${topbar({})}
  ${label(16, 80, 'Connection')}
  <div class="row-specs" style="top:104px"><span class="conn conn-live"><i></i>Live</span><span class="conn conn-reconnecting"><i></i>Reconnecting</span><span class="conn conn-offline"><i></i>Offline</span></div>
  ${label(16, 160, 'Speed and pause')}
  <div class="row-specs" style="top:184px"><div class="segs"><span class="seg icon">${ico.pause()}</span><span class="seg mono">1x</span><span class="seg mono on">2x</span><span class="seg mono">4x</span><span class="seg mono">8x</span></div><div class="segs"><span class="seg icon on">${ico.pause('#2a1f14')}</span><span class="seg mono">1x</span><span class="seg mono">2x</span><span class="seg mono">4x</span><span class="seg mono">8x</span></div><span class="spec-inline">Paused: the pause key turns gilt, no speed is lit, and the year stops.</span></div>
  ${label(16, 240, 'Map modes')}
  <div class="row-specs" style="top:264px">${['terrain', 'diplomacy', 'strength'].map((m) => `<div class="segs">${['Political', 'Terrain', 'Diplomacy', 'Strength'].map((x) => `<span class="seg ${x.toLowerCase() === m ? 'on' : ''}">${x}</span>`).join('')}</div>`).join('')}</div>
  ${label(16, 320, 'Token meter · calls · tokens · mode')}
  <div class="row-specs" style="top:344px">${meterHtml('mock')}${meterHtml('live')}${meterHtml('capped')}<span class="spec-inline">Capped: every ruler is on autopilot until the next world.</span></div>
  ${label(16, 400, 'Decree input · idle and typed (bottom right, above the ticker)')}
  <div class="row-specs" style="top:424px; position:absolute; height:60px">${decree(0, 0)}${decree(560, 0, true)}</div>
  ${label(16, 520, 'Top bar · paused, reconnecting, capped, terrain mode')}
  <div class="abs" style="left:0;top:544px;width:1440px">${topbar({ conn: 'reconnecting', paused: true, map: 'terrain', meter: 'capped' })}</div>
  ${label(16, 636, 'Buttons on the dark surface and on parchment')}
  <div class="row-specs" style="top:660px"><span class="btn">Default</span><span class="btn active">Active</span><span class="btn danger">Danger</span><span class="btn primary-dark">New world</span></div>
  <div class="abs panel-look" style="left:520px;top:650px;padding:14px 18px;display:flex;gap:10px"><span class="btn">Default</span><span class="btn primary">Primary</span><span class="btn danger">Delete</span><span class="chip">Chip</span><span class="chip active">Chip on</span></div>
`, 70);

const css = `
${tokens}
html,body{overflow:visible;height:auto;background:#05060a}
div,span,section,i,b,p,h1,h2,h3{box-sizing:border-box}
body{padding:40px;display:flex;flex-direction:column;gap:60px}
.screen{position:relative;width:1440px;height:900px;overflow:hidden;background:radial-gradient(ellipse at 55% 60%, #121a2a 0%, #090b12 60%, #05060a 100%);flex:none}
.star{position:absolute;background:#f6eedb;border-radius:50%}
.abs{position:absolute}
.globe{position:absolute}
.beam{position:absolute}
.scan{position:absolute;left:0;top:0;pointer-events:none}
.mono{font-family:var(--font-mono)}
.cap{font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase}
.cap.dim{color:var(--color-text-muted)}
.rub{color:var(--color-rubric)}
.small{font-size:var(--text-sm)}
.spec-label{position:absolute;font-family:var(--font-display);font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-accent)}
.spec-note{position:absolute;width:300px;color:var(--color-text-muted);font-size:14px;line-height:1.5;font-style:italic;border-left:1px solid var(--color-accent);padding-left:14px}
.spec-note .cap{color:var(--color-accent);font-style:normal;margin-bottom:6px}
.spec-inline{color:var(--color-text-muted);font-style:italic;font-size:14px}
.row-specs{position:absolute;left:16px;right:16px;display:flex;gap:18px;align-items:center}
.ico{display:inline-block;flex:none}

/* parchment surfaces */
.panel-look{background:var(--parchment-fill);color:var(--color-ink);border:1.5px solid var(--color-ink);border-radius:var(--radius-2);box-shadow:var(--rule-double),var(--shadow-1);position:absolute}
.panel-look h2,.panel-look h1{font-family:var(--font-display);font-weight:700;letter-spacing:0.06em;margin:0;color:var(--color-ink)}
.panel-look h2{font-size:20px}
.panel-look h3{font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-rubric);margin:0 0 6px}
.panel-look .muted,.card .muted{color:var(--color-ink-muted);font-style:italic}
.muted-ink{color:var(--color-ink-muted)}
.sw{display:inline-block;width:12px;height:12px;border:1px solid var(--color-ink);flex:none}

/* buttons */
.btn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.btn.small{font-size:10px;padding:2px 10px}
.btn.xs{font-size:9px;padding:0 8px;line-height:20px}
.btn.big{font-size:14px;padding:10px 26px;letter-spacing:0.12em}
.btn.primary-dark{background:var(--color-parchment);color:var(--color-ink);border-color:var(--color-parchment)}
.panel-look .btn,.card .btn,.ticker .btn,.decree .btn{background:transparent;color:var(--color-ink);border-color:var(--color-ink)}
.panel-look .btn.primary,.card .btn.primary,.decree .btn.primary{background:var(--color-ink);color:var(--color-parchment-light)}
.panel-look .btn.danger{color:var(--color-danger);border-color:var(--color-danger)}
.chip{white-space:nowrap}

/* top bar */
.topbar{position:absolute;left:0;top:0;width:1440px;height:var(--topbar-height);display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:linear-gradient(180deg,#191e2b 0%,#10131c 100%);border-bottom:1px solid rgba(201,162,75,0.45);box-shadow:0 1px 0 rgba(0,0,0,0.6),0 6px 20px rgba(0,0,0,0.45)}
.tb-group{display:flex;align-items:center;gap:12px;flex:none}
.tb-world{max-width:170px;overflow:hidden}
.tb-name,.tb-era,.wordmark,.conn{white-space:nowrap}
.tb-era{overflow:hidden;text-overflow:ellipsis}
.wordmark{font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:var(--color-accent)}
.vsep{width:1px;height:26px;background:var(--color-border)}
.tb-name{font-family:var(--font-display);font-size:17px;font-weight:600;letter-spacing:0.04em;color:var(--color-text);line-height:20px}
.tb-era{font-size:12px;font-style:italic;color:var(--color-text-muted);line-height:14px}
.tb-year{display:flex;align-items:baseline;gap:6px;padding:3px 10px;border:1px solid rgba(201,162,75,0.4);border-radius:2px}
.tb-year .cap{color:var(--color-text-muted)}
.tb-year .num{font-family:var(--font-mono);font-size:16px;font-weight:600;color:var(--color-accent)}
.conn{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--color-text-muted)}
.conn i{width:8px;height:8px;border-radius:50%;display:inline-block}
.conn-live i{background:#6fbf5a;box-shadow:0 0 6px #6fbf5a}
.conn-live{color:var(--color-text)}
.conn-reconnecting i{background:var(--color-warn);box-shadow:0 0 6px var(--color-warn)}
.conn-offline i{background:var(--color-danger)}
.segs{display:flex;border:1px solid var(--color-border);border-radius:2px;background:var(--color-surface)}
.seg{font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);padding:0 11px;line-height:26px;border-left:1px solid var(--color-border);display:flex;align-items:center}
.seg:first-child{border-left:none}
.seg.mono{font-family:var(--font-mono);letter-spacing:0;font-size:12px;padding:0 9px}
.seg.icon{padding:0 10px;color:var(--color-text-muted)}
.seg.on{background:var(--color-parchment);color:var(--color-ink)}
.meter{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--color-text-muted);padding:0 10px;line-height:26px;border:1px solid var(--color-border);border-radius:2px;background:#0d1018}
.meter .num{font-family:var(--font-mono);color:var(--color-text);font-size:12px}
.meter .dot{color:var(--color-border);margin:0 2px}
.meter .mode{font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:0 6px;line-height:16px;border-radius:2px}
.meter-mock .mode{color:var(--color-text-muted);border:1px solid var(--color-border)}
.meter-live .mode{color:var(--color-ink);background:var(--color-accent)}
.meter-capped{border-color:rgba(179,38,30,0.7)}
.meter-capped .mode{color:#fff;background:var(--color-danger)}

/* ticker */
.ticker{position:absolute;height:var(--ticker-height);display:flex;align-items:center;gap:14px;padding:0 10px 0 0;background:var(--parchment-fill);border:1.5px solid var(--color-ink);border-radius:2px;box-shadow:var(--shadow-1);color:var(--color-ink);overflow:hidden}
.t-label{align-self:stretch;display:flex;align-items:center;padding:0 14px;background:var(--color-ink);color:var(--color-parchment);font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase}
.t-track{flex:1;display:flex;align-items:center;gap:14px;overflow:hidden;white-space:nowrap;font-size:15px}
.t-item{display:inline-flex;align-items:center;gap:7px}
.yr{font-family:var(--font-mono);font-size:12px;color:var(--color-rubric);font-weight:600}
.t-sep{width:4px;height:4px;transform:rotate(45deg);background:var(--color-ink-muted);flex:none}

/* decree */
.decree{position:absolute;width:380px;height:48px;display:flex;align-items:center;gap:10px;padding:0 8px 0 12px;background:var(--parchment-fill);border:1.5px solid var(--color-ink);border-radius:2px;box-shadow:var(--shadow-1);color:var(--color-ink)}
.d-input{flex:1;font-size:13px;font-style:italic;color:var(--color-ink-muted);border-bottom:1px solid var(--color-ink-muted);line-height:22px;white-space:nowrap;overflow:hidden}
.d-input.typed{font-style:normal;color:var(--color-ink)}

/* hologram card */
.card{width:380px;position:relative;color:var(--color-ink);border-radius:var(--radius-2);overflow:hidden}
.holo-look{background:var(--parchment-fill);opacity:var(--holo-opacity);border:1px solid rgba(42,31,20,0.6);box-shadow:var(--holo-glow)}
.holo-look.warm{box-shadow:var(--holo-glow-warm)}
.holo-look::before{content:none}
.holo-look .card-in{border-bottom:2px solid var(--holo-tint)}
.holo-look.warm .card-in{border-bottom-color:var(--holo-warm)}
.docked{position:relative;box-shadow:var(--rule-double),var(--shadow-2);border:1.5px solid var(--color-ink)}
.card-in{position:relative;padding:18px 20px 16px}
.c-head{display:flex;gap:14px;align-items:center}
.flag{flex:none;box-shadow:0 1px 3px rgba(0,0,0,0.35)}
.c-title{flex:1}
.c-name{font-family:var(--font-display);font-size:21px;font-weight:700;line-height:25px;letter-spacing:0.03em}
.c-leader{font-style:italic;color:var(--color-ink-muted);font-size:15px}
.c-close{align-self:flex-start;padding:2px}
.ideology{margin:12px 0 10px;padding:8px 12px;border-left:2px solid var(--color-rubric);font-style:italic;font-size:15px;line-height:20px;background:rgba(214,195,153,0.45)}
.facts{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;padding:8px 0 10px;border-top:1px solid var(--color-ink-faint);border-bottom:1px solid var(--color-ink-faint)}
.facts div{display:flex;flex-direction:column}
.facts .cap{color:var(--color-ink-muted);font-size:9px}
.facts .v{font-size:15px;line-height:19px}
.facts .v.mono{font-size:13px}
.sec{margin-top:10px}
.card h3{font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-rubric);margin:0 0 5px}
.tab-body{min-height:112px}
.sec p{margin:0;font-size:14.5px;line-height:19px}
.sec p.small{margin-top:8px;font-size:13.5px;line-height:18px;color:var(--color-ink-muted)}
.tabs{display:flex;margin-top:12px;border-bottom:1px solid var(--color-ink-faint)}
.tab{font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;padding:4px 12px 5px;color:var(--color-ink-muted)}
.tab.on{color:var(--color-ink);border-bottom:2px solid var(--color-rubric)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.card .chip{font-size:12.5px;padding:0 9px;line-height:20px}
.rel{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:14px;border-bottom:1px dotted var(--color-ink-faint)}
.rel-name{flex:1}
.stance{font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:0 7px;line-height:17px;border-radius:999px;color:#fff}
.stance-war{background:var(--stance-war)}
.stance-hostile{background:var(--stance-hostile)}
.stance-neutral{background:transparent;color:var(--color-ink-muted);border:1px solid var(--stance-neutral);line-height:15px}
.stance-trade{background:var(--stance-trade)}
.stance-alliance{background:var(--stance-alliance)}
.c-foot{display:flex;gap:8px;margin-top:14px}
.c-foot .btn{flex:1;justify-content:center;font-size:11px;line-height:28px}
.progress{height:2px;background:var(--color-ink-faint);margin-top:10px}
.progress div{height:2px;background:var(--color-rubric)}
.now-playing{font-size:11px;color:var(--color-ink-muted);margin-top:5px}
.loading-lines div{height:9px;margin:7px 0;border-radius:2px;background:linear-gradient(90deg,rgba(42,31,20,0.10),rgba(42,31,20,0.20),rgba(42,31,20,0.10))}

/* network */
.net{position:relative;width:300px;padding:14px 16px 10px}
.net-head .small{margin-top:2px;line-height:17px}
.switch-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;padding:7px 10px;border:1px solid var(--color-ink-faint);border-radius:2px;background:rgba(246,238,219,0.5)}
.switch-row .small{line-height:15px;font-size:12.5px}
.sw-title{font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase}
.switch-row.on{border-color:var(--color-ink-muted)}
.toggle{width:34px;height:18px;border-radius:999px;background:rgba(42,31,20,0.25);position:relative;flex:none;display:block}
.toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--color-parchment-light);box-shadow:0 1px 2px rgba(0,0,0,0.4)}
.toggle.on{background:var(--color-ink)}
.toggle.on i{left:18px}
.toggle.danger.on{background:var(--color-danger)}
.rows{margin-top:8px}
.nrow{padding:8px 6px 8px 8px;border-top:1px solid var(--color-ink-faint)}
.nrow.sel{background:rgba(201,162,75,0.22);border-left:3px solid var(--color-accent);padding-left:5px}
.nrow.is-cut{background:rgba(127,230,216,0.10)}
.nr-top{display:flex;align-items:center;gap:8px}
.nr-name{flex:1;font-size:15.5px;font-weight:600}
.nr-states{display:flex;gap:6px;margin:4px 0 0 20px}
.state{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0 7px;line-height:17px;border-radius:2px;border:1px solid}
.state i{width:6px;height:6px;border-radius:50%;display:inline-block}
.state.up{color:var(--link-up);border-color:var(--link-up)}
.state.up i{background:var(--link-up)}
.state.cut{color:#fff;background:var(--link-cut);border-color:var(--link-cut)}
.state.cut i{background:#fff}
.state.llm{color:#7a5a18;border-color:var(--ruler-llm);background:rgba(201,162,75,0.18)}
.state.auto{color:#4a5763;border-color:var(--ruler-autopilot)}
.state.del{color:var(--color-ink-muted);border-color:var(--color-ink-muted)}
.nr-sub{margin:4px 0 0 20px;font-size:11px;color:var(--color-ink-muted)}
.nr-btns{display:flex;gap:5px;margin:6px 0 0 20px}
.nrow.deleted .nr-name{text-decoration:line-through;color:var(--color-ink-muted);font-weight:400}
.nrow.deleted .sw{opacity:0.4}
.nrow.deleted .nr-sub{font-family:var(--font-serif);font-style:italic;font-size:13px}

/* army tags on the map */
.army{position:absolute;font-family:var(--font-mono);font-size:11px;font-weight:600;line-height:16px;padding:0 5px;background:var(--color-parchment-light);color:var(--color-ink);border:1px solid;border-left-width:4px;border-radius:1px;box-shadow:0 1px 3px rgba(0,0,0,0.5)}
.battle{position:absolute;width:18px;height:18px;border-radius:50%;border:2px solid var(--color-danger);box-shadow:0 0 10px var(--color-danger)}

/* create */
.veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%, rgba(5,6,10,0.15) 0%, rgba(5,6,10,0.65) 100%)}
.brand{position:absolute;left:24px;top:22px;display:flex;align-items:baseline;gap:14px}
.brand-sub{font-style:italic;color:var(--color-text-muted);font-size:14px}
.create{width:640px;padding:26px 34px 22px}
.cr-head h1{font-size:34px;line-height:42px;margin:2px 0 2px}
.cr-head .muted{font-size:16px}
.field{margin-top:16px;display:flex;flex-direction:column;gap:7px}
.field .cap{color:var(--color-ink);font-size:10px}
.field .cap b{color:var(--color-rubric);font-size:12px;margin-left:6px;letter-spacing:0}
.prompt{min-height:76px;padding:10px 12px;background:var(--color-parchment-light);border:1.5px solid var(--color-ink);border-radius:2px;font-size:19px;line-height:26px;box-shadow:inset 0 1px 3px rgba(42,31,20,0.2)}
.caret{display:inline-block;width:1.5px;height:20px;background:var(--color-ink);margin-left:2px;vertical-align:-3px}
.create .chip{font-size:14px;line-height:24px;padding:0 12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.stepper{display:flex;align-items:center;gap:0}
.st-btn{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--color-ink);font-size:18px;font-weight:600}
.st-val{width:44px;height:30px;display:flex;align-items:center;justify-content:center;border-top:1.5px solid var(--color-ink);border-bottom:1.5px solid var(--color-ink);font-size:16px;font-weight:600;background:var(--color-parchment-light)}
.pips{display:flex;gap:4px;margin-left:12px}
.pips i{width:8px;height:8px;transform:rotate(45deg);border:1px solid var(--color-ink);display:block}
.pips i.on{background:var(--color-ink)}
.hint{font-size:12.5px;font-style:italic;color:var(--color-ink-muted)}
.select{display:flex;align-items:center;justify-content:space-between;height:30px;padding:0 10px;border:1.5px solid var(--color-ink);border-radius:2px;background:var(--color-parchment-light);font-size:16px}
.slider{position:relative;height:6px;margin:8px 0 4px;background:rgba(42,31,20,0.18);border-radius:3px}
.slider .fill{position:absolute;left:0;top:0;height:6px;background:var(--color-ink);border-radius:3px}
.slider .knob{position:absolute;top:-6px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:var(--color-parchment-light);border:2px solid var(--color-ink);box-shadow:0 1px 3px rgba(0,0,0,0.35)}
.ends{display:flex;justify-content:space-between;font-size:12.5px;font-style:italic;color:var(--color-ink-muted)}
.cr-foot{display:flex;align-items:center;justify-content:space-between;margin-top:22px;padding-top:16px;border-top:1px solid var(--color-ink-faint)}

/* timeline */
.timeline{position:relative;width:1408px;padding:16px 20px 14px}
.tl-head{display:flex;align-items:center;gap:24px}
.tl-head .muted{font-size:14px}
.legend{flex:1;display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:flex-end;font-size:13px}
.lg{display:inline-flex;align-items:center;gap:5px}
.tl-body{margin-top:14px;padding-left:200px;position:relative}
.axis{position:relative;height:22px;border-bottom:1px solid var(--color-ink)}
.tick{position:absolute;top:0;height:22px;border-left:1px solid var(--color-ink-muted);padding-left:4px;font-size:11px;color:var(--color-ink-muted)}
.now{position:absolute;top:-4px;height:234px;border-left:2px solid var(--color-accent);z-index:2}
.now span{position:absolute;left:-46px;top:-16px;font-size:11px;font-weight:600;color:#7a5a18;white-space:nowrap}
.lanes{position:relative;height:204px}
.lane{position:absolute;left:-200px;width:1320px;height:34px;border-bottom:1px dotted var(--color-ink-faint)}
.lane-name{width:190px;height:34px;display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:500}
.track{position:absolute;left:0;top:0;width:1120px;height:204px}
.ev{position:absolute;width:13px;height:13px;line-height:0}
.warband{position:absolute;background:rgba(179,38,30,0.18);border:1px solid rgba(179,38,30,0.55);border-radius:2px}
.silence{position:absolute;top:0;height:204px;background:rgba(127,230,216,0.16);border-left:1px dashed #2a8a80;border-right:1px dashed #2a8a80}
.silence span{position:absolute;top:2px;left:4px;font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1e6b63;white-space:nowrap}
.tip{position:absolute;width:250px;padding:8px 10px;background:var(--color-parchment-light);border:1px solid var(--color-ink);border-radius:2px;box-shadow:0 3px 10px rgba(42,31,20,0.35);font-size:13px;line-height:17px;z-index:3}
.tip-k{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--color-rubric);margin-bottom:3px}
.tl-list{margin-top:12px;border-top:1px solid var(--color-ink-faint);padding-top:6px}
.tl-entry{display:flex;align-items:center;gap:10px;font-size:14.5px;line-height:24px}
.tl-entry .k{width:76px;color:var(--color-ink-muted);font-size:9px}

/* network screen extras */
.belief-banner{position:absolute;left:50%;top:68px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:6px 8px 6px 14px;background:rgba(13,30,34,0.92);border:1px solid var(--holo-tint);border-radius:2px;color:var(--color-text);font-size:14px;box-shadow:0 0 18px rgba(127,230,216,0.3)}
.belief-banner .cap{color:var(--holo-tint)}
.belief-banner .btn{background:transparent;color:var(--holo-tint);border-color:var(--holo-tint)}
.legend-box{width:220px;padding:12px 16px}
.lg-row{display:flex;align-items:center;gap:8px;font-size:14px;line-height:22px}
`;

// Figma's importer reads stylesheet rules, not computed styles: inline every var() for it.
let cssOut = css;
if (mode !== 'preview') {
  const vars = {};
  for (const m of tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  for (let i = 0; i < 6; i++) cssOut = cssOut.replace(/var\((--[\w-]+)\)/g, (_, n) => vars[n] ?? '');
  cssOut = cssOut.replace(/:root\s*\{[\s\S]*?\n\}/, '');
}
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Terra Nova - interface</title><style>${cssOut}</style></head><body>
${overview}${create}${cardScreen}${chronicle}${network}${topScreen}
</body></html>`;
writeFileSync(outPath, html);
console.log('wrote', outPath, html.length);
