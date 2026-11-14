// Builds docs/design/reference.html, the Terra Nova screens in plain HTML and CSS (the Figma file was imported from it).
// Run from the repo root: node docs/design/build-reference.mjs web/src/theme/tokens.css docs/design/reference.html preview
// Without "preview" it inlines every var() and drops the font @import, which is what the Figma importer needs.
// PNGs: node docs/design/export-png.mjs (screenshots every .screen of reference.html into docs/design/<data-file>.png).

import { readFileSync, writeFileSync } from 'node:fs';
const [, , tokensPath, outPath, mode] = process.argv; // mode: 'preview' keeps the font @import
let tokens = readFileSync(tokensPath, 'utf8');
if (mode !== 'preview') tokens = tokens.replace(/@import[^;]+;/, '');

// ---------- seeded random ----------
let s = 7;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const seed = (v) => { s = v; };
let uid = 0; // unique ids for svg gradients

// ---------- data (the mock world of packages/shared/src/mock.ts) ----------
const N = [
  { id: 0, name: 'The Ashen Concord', color: '#c8553d', leader: 'Speaker Maren Voss', flag: ['h3', ['#c8553d', '#2b2b2b', '#e8d9b5'], '#e8d9b5'],
    gov: 'Merchant republic', prov: '41', pop: '1.28M', gold: '9,420', ideology: 'Prosperity is the only law that outlasts a fire.',
    summary: 'A guild-republic built on the ashes of its own capital. Its merchants hold the salt roads of the southern shelf, and its ledgers are older than its laws.',
    tags: ['ledger-keepers', 'ash-marked contracts', 'smoked fish feasts', 'distrust of kings'],
    culture: "Every contract is sealed with a thumb of ash from the old capital's hearths." },
  { id: 1, name: 'The Verdane Kingdom', color: '#4f9d5b', leader: 'Queen Illaria the Green', flag: ['v2', ['#4f9d5b', '#e9e2c8'], '#1e4d2b'] },
  { id: 2, name: "The Tidewrights' League", color: '#3d7fc8', leader: 'Admiral Osric Kell', flag: ['h2', ['#3d7fc8', '#16324f'], '#f1ead2'] },
  { id: 3, name: 'The Sunspire Dominion', color: '#d9a42f', leader: 'High Solarch Teodar', flag: ['cross', ['#d9a42f', '#fff1c4'], '#7a4a00'] },
  { id: 4, name: 'The Hollow Court', color: '#8a5cc2', leader: 'The Veiled Regent', flag: ['diag', ['#8a5cc2', '#1d1230'], '#f0e0ff'],
    gov: 'Regency of masks', prov: '33', pop: '0.94M', gold: '6,110', ideology: 'Every bargain has a second page.',
    summary: 'A court without a monarch, ruled in the name of an heir no one has seen. It trades in secrets and holds its borders by treaty, not by wall.',
    tags: ['masked councils', 'debt-oaths', 'night markets', 'silver ink'],
    culture: 'Petitions are answered in silver ink that fades in a year, so every promise must be renewed.' },
  { id: 5, name: 'The Free Saltmarches', color: '#2fa596', leader: 'Warden Isolde Marr', flag: ['h2', ['#2fa596', '#0f3b36'], '#ecdfc0'] },
];
const STANCE_TO_ASHEN = { 1: 'neutral', 2: 'trade', 3: 'war', 4: 'hostile', 5: 'alliance' };
const STANCE_COL = { war: '#b3261e', hostile: '#d0782a', neutral: '#9a9484', trade: '#2f7a9a', alliance: '#3f7d3d' };

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
// The painted globe, a flat stand-in for lane b's planet. mode: political | diplomacy | forming.
// cut: a nation whose link is cut (dashed cyan ring). gone: a deleted nation (ruin grey). settled: a dispute just settled (gilt).
const LAND = [
  // [nation id or -1 unclaimed, fx, fy, fr]
  [-1, 0.52, 0.52, 0.22], [-1, 0.2, 0.3, 0.06], [-1, 0.86, 0.36, 0.05], [-1, 0.3, 0.82, 0.05],
  [1, 0.36, 0.42, 0.155], [4, 0.58, 0.29, 0.13], [3, 0.7, 0.5, 0.14], [0, 0.53, 0.63, 0.15],
  [2, 0.37, 0.71, 0.11], [2, 0.22, 0.6, 0.06], [5, 0.77, 0.72, 0.08],
];
const CAP = { 0: [0.53, 0.63], 1: [0.35, 0.41], 2: [0.37, 0.71], 3: [0.7, 0.49], 4: [0.58, 0.29], 5: [0.76, 0.71] };
function globe({ x, y, size, mode = 'political', selected = 0, armies = true, dim = 1, beliefs = false, names = true, cut = null, gone = null, settled = false }) {
  const R = size / 2; const u = ++uid;
  seed(42);
  let land = '', rings = '', text = '';
  const named = new Set();
  const fs = Math.max(9, Math.min(19, size * 0.0135));
  for (const [id, fx, fy, fr] of LAND) {
    const d = blob(fx * size, fy * size, fr * size, 11, 0.38);
    let fill = '#b9a57a';
    if (id >= 0 && mode === 'political') fill = N[id].color;
    if (id >= 0 && mode === 'diplomacy') fill = id === selected ? '#c9a24b' : STANCE_COL[STANCE_TO_ASHEN[id]];
    if (mode === 'forming') fill = id >= 0 ? '#a99668' : '#b9a57a';
    let op = id >= 0 ? 0.88 : 0.95;
    if (id === gone) { fill = '#6f675c'; op = 0.75; }
    const sel = id === selected && mode !== 'forming';
    const dash = mode === 'forming' && id >= 0 ? ' stroke-dasharray="7 5"' : id === gone ? ' stroke-dasharray="3 4"' : '';
    land += `<path d="${d}" fill="${fill}" fill-opacity="${op}" stroke="${sel ? '#7fe6d8' : '#2a1f14'}" stroke-opacity="${sel ? 1 : 0.7}" stroke-width="${sel ? 3 : 1.2}"${dash}/>`;
    if (id === cut) rings += `<path d="${d}" fill="#0d1620" fill-opacity="0.28" stroke="#7fe6d8" stroke-width="2" stroke-dasharray="2 6" stroke-linecap="round"/>`;
    if (names && id >= 0 && mode !== 'forming' && !named.has(id) && fr * size > 55) {
      named.add(id);
      const label = N[id].name.replace('The ', '').toUpperCase();
      text += `<text x="${(fx * size).toFixed(0)}" y="${(fy * size - fr * size * 0.42).toFixed(0)}" text-anchor="middle" font-family="Cinzel, serif" font-weight="700" font-size="${fs.toFixed(1)}" letter-spacing="${(fs * 0.16).toFixed(1)}" fill="#2a1f14" fill-opacity="${id === gone ? 0.4 : 0.8}"${id === gone ? ' text-decoration="line-through"' : ''}>${label}</text>`;
    }
  }
  if (beliefs) {
    // stale belief: the Hollow Court still thinks it holds a strip of Sunspire land
    seed(9);
    land += `<path d="${blob(0.64 * size, 0.4 * size, 0.06 * size, 9, 0.3)}" fill="#8a5cc2" fill-opacity="0.55" stroke="#7fe6d8" stroke-width="2" stroke-dasharray="5 4"/>`;
  }
  if (settled) {
    // the same strip at the moment the link is restored: outlined in gilt as it is awarded
    seed(9);
    land += `<path d="${blob(0.64 * size, 0.4 * size, 0.06 * size, 9, 0.3)}" fill="#d9a42f" fill-opacity="0.9" stroke="#f3d27a" stroke-width="3.5"/>`;
  }
  let grat = '';
  for (const k of [0.25, 0.5, 0.75]) grat += `<ellipse cx="${R}" cy="${R}" rx="${R * Math.sin(k * Math.PI) * 0.999}" ry="${R}" fill="none" stroke="#ecdfc0" stroke-opacity="0.14" stroke-width="0.8"/>`;
  for (const lat of [-0.6, -0.3, 0, 0.3, 0.6]) {
    const cy = R + Math.sin(lat) * R; const rx = Math.cos(lat) * R;
    grat += `<ellipse cx="${R}" cy="${cy}" rx="${rx}" ry="${rx * 0.12}" fill="none" stroke="#ecdfc0" stroke-opacity="0.14" stroke-width="0.8"/>`;
  }
  let marks = '';
  if (mode !== 'forming') for (const id of Object.keys(CAP)) {
    if (Number(id) === gone) continue;
    const [cx, cy] = CAP[id];
    marks += `<circle cx="${cx * size}" cy="${cy * size}" r="4.5" fill="#ecdfc0" stroke="#2a1f14" stroke-width="1.5"/><circle cx="${cx * size}" cy="${cy * size}" r="1.6" fill="#2a1f14"/>`;
  }
  const armyTags = armies && mode !== 'forming' ? [[0.6, 0.57, 14, 0], [0.66, 0.55, 11, 3], [0.42, 0.47, 8, 1], [0.3, 0.66, 6, 2]].map(([fx, fy, n, id]) =>
    `<div class="army" style="left:${x + fx * size - 14}px;top:${y + fy * size - 10}px;border-color:${N[id].color}">${n}</div>`).join('') : '';
  const battle = armies && mode !== 'forming' ? `<div class="battle" style="left:${x + 0.635 * size - 9}px;top:${y + 0.6 * size - 9}px"></div>` : '';
  return `<svg class="globe" style="left:${x}px;top:${y}px;opacity:${dim}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="ocean${u}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#2f6476"/><stop offset="0.7" stop-color="#173a4c"/><stop offset="1" stop-color="#0b1a26"/></radialGradient>
      <radialGradient id="shade${u}" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="#fff6dc" stop-opacity="0.16"/><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.62"/></radialGradient>
      <clipPath id="clip${u}"><circle cx="${R}" cy="${R}" r="${R}"/></clipPath>
    </defs>
    <circle cx="${R}" cy="${R}" r="${R + 10}" fill="#7fe6d8" fill-opacity="0.05"/>
    <circle cx="${R}" cy="${R}" r="${R + 4}" fill="#7fe6d8" fill-opacity="0.08"/>
    <g clip-path="url(#clip${u})">
      <circle cx="${R}" cy="${R}" r="${R}" fill="url(#ocean${u})"/>
      ${land}${rings}${grat}${text}${marks}
      <circle cx="${R}" cy="${R}" r="${R}" fill="url(#shade${u})"/>
    </g>
    <circle cx="${R}" cy="${R}" r="${R - 0.5}" fill="none" stroke="#7fe6d8" stroke-opacity="0.35" stroke-width="1"/>
  </svg>${armyTags}${battle}`;
}
function scanlines(w, h) {
  let r = '';
  for (let yy = 0; yy < h; yy += 3) r += `<rect y="${yy}" width="${w}" height="1"/>`;
  return `<svg class="scan" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="#7fe6d8" fill-opacity="0.10">${r}</svg>`;
}
// The beam: stretches from the card's bottom edge down to the capital. apex is 0..1 across the card's width.
function beam({ warm = false, cut = false, apex = 0.5, w = 380 }) {
  const c = warm ? '#ffcf7a' : '#7fe6d8'; const u = ++uid; const ax = apex * w;
  let body;
  if (cut) {
    body = '';
    for (let yy = 0; yy < 100; yy += 5) {
      const t0 = yy / 100, t1 = (yy + 2.2) / 100;
      const xl = (t) => (ax - 5) * t, xr = (t) => w + (ax + 5 - w) * t;
      body += `<polygon points="${xl(t0).toFixed(1)},${yy} ${xr(t0).toFixed(1)},${yy} ${xr(t1).toFixed(1)},${yy + 2.2} ${xl(t1).toFixed(1)},${yy + 2.2}" fill="${c}" fill-opacity="${(0.1 + 0.16 * Math.abs(Math.sin(yy * 1.7))).toFixed(2)}"/>`;
    }
  } else {
    body = `<defs><linearGradient id="beam${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="0.5"/><stop offset="0.5" stop-color="${c}" stop-opacity="0.14"/><stop offset="1" stop-color="${c}" stop-opacity="0.6"/></linearGradient></defs>
    <polygon points="0,0 ${w},0 ${ax + 5},100 ${ax - 5},100" fill="url(#beam${u})"/>
    <polygon points="${w * 0.28},0 ${w * 0.72},0 ${ax + 2},100 ${ax - 2},100" fill="${c}" fill-opacity="0.16"/>`;
  }
  return `<svg class="beam" width="${w}" height="100" viewBox="0 0 ${w} 100" preserveAspectRatio="none">${body}</svg>
  <svg class="beam-foot" style="left:${ax - 50}px" width="100" height="32" viewBox="0 0 100 32">
    <ellipse cx="50" cy="16" rx="46" ry="13" fill="none" stroke="${c}" stroke-opacity="${cut ? 0.3 : 0.5}" stroke-width="1.2"${cut ? ' stroke-dasharray="3 5"' : ''}/>
    <ellipse cx="50" cy="16" rx="26" ry="8" fill="${c}" fill-opacity="${cut ? 0.14 : 0.38}"/>
    ${cut ? '' : '<ellipse cx="50" cy="16" rx="10" ry="3.2" fill="#ffffff" fill-opacity="0.92"/>'}
  </svg>`;
}
const ico = {
  play: (c = 'currentColor') => `<svg class="ico" width="10" height="10" viewBox="0 0 10 10"><polygon points="1,0 10,5 1,10" fill="${c}"/></svg>`,
  stop: (c = 'currentColor') => `<svg class="ico" width="9" height="9" viewBox="0 0 9 9"><rect width="9" height="9" fill="${c}"/></svg>`,
  pause: (c = 'currentColor') => `<svg class="ico" width="10" height="11" viewBox="0 0 10 11"><rect width="3.5" height="11" fill="${c}"/><rect x="6.5" width="3.5" height="11" fill="${c}"/></svg>`,
  close: (c = '#2a1f14') => `<svg class="ico" width="12" height="12" viewBox="0 0 12 12"><path d="M1 1L11 11M11 1L1 11" stroke="${c}" stroke-width="1.6"/></svg>`,
  chevron: (c = '#2a1f14') => `<svg class="ico" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1L5 5L9 1" stroke="${c}" stroke-width="1.5" fill="none"/></svg>`,
  chevronR: (c = '#2a1f14') => `<svg class="ico" width="6" height="10" viewBox="0 0 6 10"><path d="M1 1L5 5L1 9" stroke="${c}" stroke-width="1.5" fill="none"/></svg>`,
  // every kind diamond carries a thin ink edge, so the pale ones (silence, founding) still read on parchment
  diamond: (c, sz = 10) => `<svg class="ico" width="${sz}" height="${sz}" viewBox="0 0 10 10"><polygon points="5,0.6 9.4,5 5,9.4 0.6,5" fill="${c}" stroke="#2a1f14" stroke-opacity="0.6" stroke-width="0.8"/></svg>`,
  check: (c = '#2a1f14') => `<svg class="ico" width="12" height="10" viewBox="0 0 12 10"><path d="M1 5L4.5 8.5L11 1" stroke="${c}" stroke-width="1.8" fill="none"/></svg>`,
  eq: (c = '#f6eedb') => `<svg class="ico" width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="5" width="3" height="7" fill="${c}"/><rect x="4.5" y="1" width="3" height="11" fill="${c}"/><rect x="9" y="3" width="3" height="9" fill="${c}"/><rect x="13" y="6" width="3" height="6" fill="${c}"/></svg>`,
};
const KIND = { founding: '#c9a24b', proclamation: '#8a7a5c', growth: '#6f8f4e', war: '#b3261e', battle: '#d0782a', peace: '#4d8a4a', alliance: '#3f8fb0', betrayal: '#7d3c8f', fall: '#3b3129', secession: '#2fa596', silence: '#7fe6d8', return: '#4fb7c9', dispute: '#c7802a', decree: '#9c2f22' };

// ---------- components ----------
function topbar({ conn = 'live', speed = 2, paused = false, map = 'political', meter = 'live', compact = false } = {}) {
  const modes = ['Political', 'Terrain', 'Diplomacy', 'Strength'].map((m) => `<span class="seg ${m.toLowerCase() === map ? 'on' : ''}">${m}</span>`).join('');
  const speeds = [1, 2, 4, 8].map((v) => `<span class="seg mono ${!paused && v === speed ? 'on' : ''}">${v}x</span>`).join('');
  const connTxt = { live: 'Live', reconnecting: 'Reconnecting', offline: 'Offline' }[conn];
  return `<div class="topbar ${compact ? 'compact' : ''}">
    <div class="tb-group">
      <span class="wordmark">Terra Nova</span><span class="vsep"></span>
      <div class="tb-world"><div class="tb-name">The Salt Age</div><div class="tb-era">a drowned, post-apocalyptic world</div></div>
      <div class="tb-year"><span class="cap">Year</span><span class="num">214</span></div>
      <span class="conn conn-${conn}"><i></i><span class="conn-word">${connTxt}</span></span>
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
  return `<div class="meter meter-${m}"><span class="calls"><span class="num">${d[0]}</span> calls<span class="dot">·</span></span><span class="num">${d[1]}</span> tokens<span class="mode">${d[2]}</span></div>`;
}
function ticker(x, y, w) {
  const items = [
    [214, 'battle', 'Ashen pikemen hold the ford at Cinder Bend against the Sunspire host.'],
    [213, 'proclamation', 'The Veiled Regent: "Every bargain has a second page."'],
    [212, 'war', 'The Sunspire Dominion declares holy war on the Ashen Concord.'],
    [210, 'growth', 'Saltgate becomes a city.'],
  ].map(([yr, k, t], i) => `<span class="t-item ${i === 0 ? 'new' : ''}">${ico.diamond(KIND[k])}<span class="yr">Y${yr}</span><span class="t-txt">${t}</span></span>`).join('<span class="t-sep"></span>');
  return `<div class="ticker" style="left:${x}px;top:${y}px;width:${w}px"><span class="t-label">Chronicle</span><div class="t-track">${items}</div><span class="btn small">Timeline ${ico.chevron('#2a1f14')}</span></div>`;
}
function decree(x, y, typed = false) {
  return `<div class="decree" style="left:${x}px;top:${y}px">
    <span class="cap rub">Decree</span>
    <div class="d-input ${typed ? 'typed' : ''}">${typed ? 'A comet splits the sky over Sunspire' : 'A plague, a meteor, a prophet...'}</div>
    <span class="btn primary small">Proclaim</span>
  </div>`;
}
// The nation card. state: idle | narration | anthem. cut: the nation's link is cut (the Silence).
function card({ id = 0, state = 'idle', docked = false, loading = false, tab = 'culture', cut = false, short = false } = {}) {
  const n = N[id];
  const narr = state === 'narration', anth = state === 'anthem', speaking = narr || anth;
  const rel = N.filter((o) => o.id !== id).slice(0, 5).map((o) => {
    const st = STANCE_TO_ASHEN[o.id] ?? 'hostile';
    return `<div class="rel"><span class="sw" style="background:${o.color}"></span><span class="rel-name">${o.name}</span><span class="stance stance-${st}">${st}</span></div>`;
  }).join('');
  const body = loading ? `
    <div class="sec"><div class="loading-lines"><div></div><div></div><div style="width:70%"></div></div><div class="muted small">Consulting the archives...</div></div>`
    : `
    <div class="sec c-sum"><p class="c-summary">${n.summary}</p></div>
    <div class="tabs">${['Culture', 'Politics', 'History', 'Relations'].map((t) => `<span class="tab ${t.toLowerCase() === tab ? 'on' : ''}">${t}</span>`).join('')}</div>
    <div class="sec tab-body">${tab === 'relations' ? rel : `
      <div class="chips">${n.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>
      <p class="small">${n.culture}</p>`}
    </div>`;
  const narrBtn = narr
    ? `<span class="btn primary play">${ico.stop('#f6eedb')} Stop ${ico.eq()}</span>`
    : `<span class="btn play">${ico.play('#2a1f14')} Narrate</span>`;
  const anthBtn = anth
    ? `<span class="btn primary play">${ico.stop('#f6eedb')} Stop anthem ${ico.eq()}</span>`
    : `<span class="btn play">${ico.play('#2a1f14')} Anthem</span>`;
  const progress = speaking ? `<div class="progress"><div style="width:38%"></div></div><div class="now-playing mono">${anth ? 'Anthem of the Concord · 0:41 / 1:48' : 'Narration · 0:22 / 0:58'}</div>` : '';
  const voice = cut
    ? `<div class="c-silence"><div class="cs-top"><span class="cap">Link cut</span><span class="mono">silent 12 yrs</span></div><div class="cs-txt">It rules on from the world as it knew it in Y202.<span class="cs-more"> Its map no longer matches the truth.</span></div></div>`
    : `<div class="ideology">"${n.ideology}"</div>`;
  const brackets = docked ? '' : '<i class="hb hb-tl"></i><i class="hb hb-tr"></i><i class="hb hb-bl"></i><i class="hb hb-br"></i>';
  return `<div class="card ${docked ? 'docked panel-look' : 'holo-look'} ${speaking ? 'warm' : ''} ${cut ? 'silenced' : ''} ${short ? 'short' : ''}">
    ${docked ? '' : scanlines(380, 640)}${brackets}
    <div class="card-in">
      <div class="c-head">${flag(n)}<div class="c-title"><div class="c-gov">${n.gov}</div><div class="c-name">${n.name}</div><div class="c-leader">Led by ${n.leader}</div></div><span class="c-close">${ico.close()}</span></div>
      ${voice}
      <div class="facts">
        <div><span class="cap">Provinces</span><span class="v mono">${n.prov}</span></div>
        <div><span class="cap">Population</span><span class="v mono">${n.pop}</span></div>
        <div><span class="cap">Treasury</span><span class="v mono">${n.gold}</span></div>
      </div>
      ${body}
      <div class="c-foot">${narrBtn}${anthBtn}</div>
      ${progress}
    </div>
  </div>`;
}
// A card standing in its beam: the stack runs from `top` down to the capital at `apexY`; the beam takes what the card leaves.
function holo({ left, top, apexY, apex = 0.5, ...opts }) {
  const warm = opts.state === 'narration' || opts.state === 'anthem';
  return `<div class="holo-stack" style="left:${left}px;top:${top}px;height:${apexY - top}px">${card(opts)}${beam({ warm, cut: opts.cut, apex })}</div>`;
}
function netRows({ blackout = false, compact = false } = {}) {
  return [
    { id: 0, link: 'up', ruler: 'llm', sel: true },
    { id: 1, link: 'up', ruler: 'autopilot' },
    { id: 2, link: 'up', ruler: 'llm' },
    { id: 3, link: 'up', ruler: 'llm' },
    { id: 4, link: 'cut', ruler: 'llm', queued: 7, silent: 12 },
    { id: 5, deleted: true },
  ].slice(0, compact ? 2 : 6).map((r) => {
    const n = N[r.id];
    if (blackout) { r = { ...r, link: 'cut', queued: 3, silent: 2 }; }
    if (r.deleted && !blackout) return `<div class="nrow deleted"><div class="nr-top"><span class="sw" style="background:${n.color}"></span><span class="nr-name">${n.name}</span><span class="state del">Deleted Y209</span></div><div class="nr-sub">Its neighbours are carving up its lands.</div></div>`;
    const link = r.link === 'up' ? '<span class="state up"><i></i>Link up</span>' : '<span class="state cut"><i></i>Cut</span>';
    const ruler = r.ruler === 'llm' ? '<span class="state llm">LLM ruler</span>' : '<span class="state auto">Autopilot</span>';
    const sub = r.link === 'cut' ? `<div class="nr-sub mono">silent ${r.silent} yrs · ${r.queued} events queued</div>` : '';
    return `<div class="nrow ${r.sel ? 'sel' : ''} ${r.link === 'cut' ? 'is-cut' : ''}">
      <div class="nr-top"><span class="sw" style="background:${n.color}"></span><span class="nr-name">${n.name}</span>${link}</div>${sub}
      <div class="nr-line"><div class="nr-states">${ruler}</div><div class="nr-btns"><span class="btn xs ${r.link === 'up' ? '' : 'restore'}">${r.link === 'up' ? 'Cut' : 'Restore'}</span><span class="btn xs">${r.ruler === 'llm' ? 'Silence' : 'Wake'}</span><span class="btn xs danger">Delete</span></div></div>
    </div>`;
  }).join('');
}
function netPanel({ blackout = false, beliefs = false, compact = false } = {}) {
  return `<div class="net panel-look">
    <div class="net-head"><h2>The Network</h2><span class="net-fold">${ico.chevron()}</span></div>
    <div class="muted small net-sub">Each nation thinks for itself. Cut one off and watch.</div>
    <div class="switch-row blackout ${blackout ? 'on' : ''}"><div><div class="sw-title">Blackout</div><div class="small muted">${blackout ? 'Every link is cut' : 'Cut every link at once'}</div></div><span class="toggle danger ${blackout ? 'on' : ''}"><i></i></span></div>
    <div class="switch-row ${beliefs ? 'on' : ''}"><div><div class="sw-title">Show beliefs</div><div class="small muted">${beliefs ? 'What the Hollow Court thinks is true' : "The selected nation's map, not the truth"}</div></div><span class="toggle ${beliefs ? 'on' : ''}"><i></i></span></div>
    <div class="rows">${netRows({ blackout, compact })}</div>
  </div>`;
}
// The panel folded away: the default, so the globe has the screen until the demo reaches the network.
function netTab(cutCount = 1) {
  return `<div class="net-tab"><span class="nt-title">The Network</span><span class="state up"><i></i>4 up</span>${cutCount ? `<span class="state cut"><i></i>${cutCount} cut</span>` : ''}${ico.chevronR('#2a1f14')}</div>`;
}
// A dispatch: one at a time, top right under the top bar, about six seconds.
function herald(kind) {
  if (kind === 'war') return `<div class="herald war">
    <div class="h-band"><span>War declared</span><span class="mono">Y212</span></div>
    <div class="h-body">
      <div class="h-vs">${flag(N[3], 54, 36)}<span class="h-x">against</span>${flag(N[0], 54, 36)}</div>
      <div class="h-title">The Sunspire Dominion marches on the Ashen Concord</div>
      <div class="h-quote">"The ash-men tithe to no sun."<span>High Solarch Teodar</span></div>
    </div></div>`;
  if (kind === 'return') return `<div class="herald return">
    <div class="h-band"><span>The Silence ends</span><span class="mono">Y214</span></div>
    <div class="h-body">
      <div class="h-vs">${flag(N[4], 54, 36)}</div>
      <div class="h-title">The Hollow Court returns</div>
      <div class="h-stats"><div><b class="mono">12</b><span>years silent</span></div><div><b class="mono">7</b><span>events merged</span></div><div><b class="mono">2</b><span>disputes settled</span></div></div>
      <div class="h-quote">Where both claimed the same land, whoever holds it on the ground keeps it.</div>
    </div></div>`;
  return `<div class="herald fall">
    <div class="h-band"><span>A nation falls</span><span class="mono">Y209</span></div>
    <div class="h-body">
      <div class="h-vs gone">${flag(N[5], 54, 36)}</div>
      <div class="h-title">The Free Saltmarches are no more</div>
      <div class="h-quote">Deleted from the world. Its neighbours are carving up its lands.</div>
    </div></div>`;
}
function screen(file, name, inner, { starCount = 110, w = 1440, h = 900 } = {}) {
  return `<section class="screen" data-file="${file}" data-name="${name}" style="width:${w}px;height:${h}px">${stars(starCount, w, h, name.length * 7)}${inner}</section>`;
}
const label = (x, y, t) => `<div class="spec-label" style="left:${x}px;top:${y}px">${t}</div>`;
const note = (x, y, w, title, t) => `<div class="spec-note" style="left:${x}px;top:${y}px;width:${w}px"><div class="cap">${title}</div>${t}</div>`;

// ---------- screens ----------
// 1. The running world. The camera has flown to the selected nation: the globe fills the frame, the network is folded away.
const overview = screen('overview', 'Overview · the running world', `
  ${globe({ x: -35, y: -175, size: 1500, cut: 4 })}
  ${holo({ left: 646, top: 64, apexY: 770, apex: 0.3 })}
  ${topbar({})}
  <div class="abs" style="left:16px;top:64px">${netTab(1)}</div>
  <div class="abs" style="right:16px;top:64px">${herald('war')}</div>
  ${decree(1044, 784)}
  ${ticker(16, 844, 1408)}
`);

const createForm = `
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
    <div class="cr-foot"><span class="mono small muted-ink">Mock mode · no tokens will be spent</span><span class="btn primary big">Create world</span></div>`;
const create = screen('create', 'Create screen', `
  ${globe({ x: 270, y: 60, size: 900, mode: 'forming', dim: 0.85 })}
  <div class="veil"></div>
  <div class="brand"><span class="wordmark">Terra Nova</span><span class="brand-sub">a living world, ruled by independent AIs</span></div>
  <div class="create panel-look" style="left:400px;top:76px">${createForm}</div>
  ${note(1080, 500, 320, 'States', 'Create: disabled until the prompt has text.<br/>Pressed: this panel is replaced by the founding scroll (next frame).<br/>Error: one italic line in rubric red above the footer.')}
`);

// 2b. The five seconds after Create: the globe comes forward and a small scroll says what is being written.
const founding = screen('founding', 'Create · founding the world', `
  ${globe({ x: 400, y: 24, size: 640, mode: 'forming' })}
  <div class="brand"><span class="wordmark">Terra Nova</span><span class="brand-sub">a living world, ruled by independent AIs</span></div>
  <div class="founding panel-look" style="left:430px;top:560px">
    <div class="cap rub">Founding</div>
    <h2>The scribes are writing your world</h2>
    <div class="fo-prompt">"A drowned world where salt kingdoms trade over the old coastlines"</div>
    <div class="fo-steps">
      <div class="fo-step done"><i>${ico.check()}</i>Raising the continents</div>
      <div class="fo-step done"><i>${ico.check()}</i>Drawing six borders</div>
      <div class="fo-step doing"><i></i>Naming the nations and their rulers<span class="fo-pen"></span></div>
      <div class="fo-step"><i></i>Writing their founding myths</div>
      <div class="fo-step"><i></i>Raising six flags</div>
    </div>
  </div>
  ${note(1040, 600, 360, 'Founding state', 'Replaces the Create panel the moment Create is pressed (about 5 s live, under 1 s in mock). The veil lifts, the globe turns and its borders are drawn dashed. Steps tick on a timer, not on real progress: two done at once, then one about every 1.2 s; the last waits for the snapshot. The line being written shimmers (keyframes "scribe").')}
`);

const cardScreen = screen('card', 'Hologram nation card', `
  ${globe({ x: -380, y: 700, size: 2200, armies: false, names: false, dim: 0.9 })}
  ${label(40, 22, 'In the beam · idle · culture tab')}
  ${holo({ left: 40, top: 52, apexY: 836 })}
  ${label(530, 22, 'Speaking · anthem playing · warm beam · relations tab')}
  ${holo({ left: 530, top: 52, apexY: 836, state: 'anthem', tab: 'relations' })}
  ${label(1020, 22, 'The Silence · this nation is cut off · broken beam')}
  ${holo({ left: 1020, top: 52, apexY: 836, id: 4, cut: true })}
`, { starCount: 90 });

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
  const marks = ev.map(([l, yr, k]) => `<div class="ev" style="left:${X(yr) - 7}px;top:${l * 34 + 10}px">${ico.diamond(KIND[k], 14)}</div>`).join('');
  const wars = [[0, 3, 212, 214], [1, 4, 152, 161]].map(([a, b, s, e]) => `<div class="warband" style="left:${X(s)}px;width:${X(e) - X(s) + 4}px;top:${a * 34 + 6}px;height:22px"></div><div class="warband" style="left:${X(s)}px;width:${X(e) - X(s) + 4}px;top:${b * 34 + 6}px;height:22px"></div>`).join('');
  const silence = `<div class="silence" style="left:${X(196)}px;width:${X(203) - X(196)}px;top:${4 * 34}px;height:34px"><span>Silence</span></div>`;
  const tip = `<div class="tip" style="left:${X(186) - 292}px;top:${5 * 34 - 96}px"><div class="tip-k mono">${ico.diamond(KIND.secession)} Y186 · Secession</div>The salt-flat towns of Varrow break from the Tidewrights and crown no one: the Free Saltmarches are born.</div>`;
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
const chronicle = screen('chronicle', 'Chronicle · ticker and timeline', `
  ${globe({ x: 470, y: 60, size: 500, armies: false, dim: 0.75, names: false })}
  ${topbar({})}
  ${label(16, 72, 'Ticker · collapsed (always visible at the bottom) · the newest entry arrives on a gilt wash')}
  ${ticker(16, 96, 1408)}
  ${label(16, 330, 'Timeline · expanded (press Timeline)')}
  <div class="abs" style="left:16px;top:354px">${timeline()}</div>
`, { starCount: 90 });

const beliefBanner = `<div class="belief-banner"><span class="cap">Beliefs</span>Showing what <b>The Hollow Court</b> believes · <span class="mono">12 years</span> out of date<span class="btn xs">Show the truth</span></div>`;
const network = screen('network', 'Network panel · diplomacy map mode', `
  ${globe({ x: 400, y: 130, size: 720, mode: 'diplomacy', beliefs: true, cut: 4, gone: 5 })}
  ${topbar({ map: 'diplomacy' })}
  <div class="abs" style="left:16px;top:64px">${netPanel({ beliefs: true })}</div>
  ${beliefBanner}
  <div class="legend-box panel-look" style="left:1204px;top:640px"><div class="cap rub">Diplomacy</div><div class="small muted" style="margin-bottom:6px">Towards the Ashen Concord</div>
    ${['war', 'hostile', 'neutral', 'trade', 'alliance'].map((st) => `<div class="lg-row"><span class="sw" style="background:${STANCE_COL[st]}"></span>${st[0].toUpperCase() + st.slice(1)}</div>`).join('')}
  </div>
  ${label(1104, 76, 'Blackout · on')}
  <div class="abs" style="left:1104px;top:100px">${netPanel({ blackout: true, compact: true })}</div>
  ${label(1104, 500, 'Folded (the default)')}
  <div class="abs" style="left:1104px;top:524px">${netTab(1)}</div>
  ${ticker(16, 844, 1408)}
`);

const topScreen = screen('topbar', 'Top bar · states', `
  ${topbar({})}
  ${label(16, 80, 'Connection')}
  <div class="row-specs" style="top:104px"><span class="conn conn-live"><i></i>Live</span><span class="conn conn-reconnecting"><i></i>Reconnecting</span><span class="conn conn-offline"><i></i>Offline</span></div>
  ${label(16, 160, 'Speed and pause')}
  <div class="row-specs" style="top:184px"><div class="segs"><span class="seg icon">${ico.pause()}</span><span class="seg mono">1x</span><span class="seg mono on">2x</span><span class="seg mono">4x</span><span class="seg mono">8x</span></div><div class="segs"><span class="seg icon on">${ico.pause('#2a1f14')}</span><span class="seg mono">1x</span><span class="seg mono">2x</span><span class="seg mono">4x</span><span class="seg mono">8x</span></div><span class="spec-inline">Paused: the pause key is lit, no speed is, and the year stops.</span></div>
  ${label(16, 240, 'Map modes')}
  <div class="row-specs" style="top:264px">${['terrain', 'diplomacy'].map((m) => `<div class="segs">${['Political', 'Terrain', 'Diplomacy', 'Strength'].map((x) => `<span class="seg ${x.toLowerCase() === m ? 'on' : ''}">${x}</span>`).join('')}</div>`).join('')}</div>
  ${label(16, 320, 'Token meter · calls · tokens · mode (click it for the closing card)')}
  <div class="row-specs" style="top:344px">${meterHtml('mock')}${meterHtml('live')}${meterHtml('capped')}</div>
  <div class="row-specs" style="top:380px"><span class="spec-inline">Capped: every ruler is on autopilot until the next world.</span></div>
  ${label(16, 430, 'Decree input · idle and typed (bottom right, above the ticker)')}
  <div class="row-specs" style="top:454px; position:absolute; height:60px">${decree(0, 0)}${decree(420, 0, true)}</div>
  ${label(16, 540, 'Top bar · paused, reconnecting, capped, terrain mode')}
  <div class="abs" style="left:0;top:564px;width:1440px">${topbar({ conn: 'reconnecting', paused: true, map: 'terrain', meter: 'capped' })}</div>
  ${label(16, 644, 'Top bar at 1280 px wide (class "compact": no era line, no call count, the Live word drops to its dot)')}
  <div class="abs" style="left:0;top:668px;width:1280px">${topbar({ compact: true })}</div>
  ${label(16, 748, 'Buttons on the dark surface and on parchment')}
  <div class="row-specs" style="top:776px"><span class="btn">Default</span><span class="btn active">Active</span><span class="btn danger">Danger</span><span class="btn primary-dark">New world</span></div>
  <div class="abs panel-look" style="left:470px;top:764px;padding:14px 18px;display:flex;gap:10px;align-items:center"><span class="btn">Default</span><span class="btn primary">Primary</span><span class="btn danger">Delete</span><span class="chip">Chip</span><span class="chip active">Chip on</span></div>
  ${label(1020, 80, 'Card docked · narrow screens · lore loading')}
  <div class="abs" style="left:1020px;top:104px">${card({ docked: true, loading: true })}</div>
`, { starCount: 70 });

// 7. The dispatches and the map at the instant a link is restored.
const moments = screen('moments', 'Demo moments · dispatches and the restore', `
  ${topbar({})}
  ${label(40, 76, 'War declared · rubric band')}
  <div class="abs" style="left:40px;top:100px">${herald('war')}</div>
  ${label(400, 76, 'Link restored · night band')}
  <div class="abs" style="left:400px;top:100px">${herald('return')}</div>
  ${label(760, 76, 'Nation deleted · ink band')}
  <div class="abs" style="left:760px;top:100px">${herald('fall')}</div>
  ${note(40, 420, 660, 'Dispatches', 'One component, three bands. A dispatch drops in at the top right under the top bar (keyframes "herald-in", 600 ms), stays about 6 s, and leaves upward. Only one shows at a time; a newer one replaces it. Triggers, from recentEvents: a war declared, a link restored (the count of merged events and settled disputes comes from the same batch), a nation deleted or fallen. Everything else stays in the ticker.')}
  ${globe({ x: 760, y: 392, size: 640, settled: true, gone: 5, selected: 4, armies: false })}
  <div class="map-tag" style="left:${760 + 0.64 * 640 + 34}px;top:${392 + 0.4 * 640 - 44}px"><span class="cap">Settled</span>Awarded to the Sunspire Dominion</div>
  ${note(40, 600, 660, 'The restore, on the map', 'While a nation is cut its border is a dotted cyan ring and its land is dimmed. On Restore the ring closes, each disputed province flashes gilt for about 1.5 s (keyframes "settle-flash") and takes its true colour, and a small parchment tag names who it went to. A deleted nation turns ruin grey with a dotted edge and its name is struck through until the neighbours have taken it.')}
  ${ticker(16, 844, 1408)}
`, { starCount: 80 });

// 8. The last picture of the demo.
const closing = screen('closing', 'Closing card · what the world cost', `
  ${globe({ x: 320, y: 50, size: 800, armies: false, dim: 0.8 })}
  <div class="veil"></div>
  ${topbar({ paused: true })}
  <div class="closing panel-look" style="left:340px;top:176px">
    <div class="cap rub">The Salt Age · years 120 to 214</div>
    <h1>This whole world cost</h1>
    <div class="cl-hero"><span class="cl-num mono">186,412</span><span class="cl-unit">tokens</span></div>
    <div class="cl-stats">
      <div><b class="mono">6</b><span>nations, each ruled by its own AI</span></div>
      <div><b class="mono">94</b><span>years of history</span></div>
      <div><b class="mono">412</b><span>decisions made by the rulers</span></div>
      <div><b class="mono">3</b><span>wars, and one Silence</span></div>
    </div>
    <div class="cl-foot"><span class="muted">Every decision is in the event log, so this world replays exactly, offline.</span><span class="btn">Back to the world</span></div>
  </div>
  ${note(1100, 620, 300, 'Closing card', 'Opens when the token meter is clicked (and on the End key). Pauses the world. The number counts up from 0 over about 1.2 s. Numbers come from budget and the chronicle.')}
`);

// 9. The projector: 1280 x 720, at the moment of the demo. Network open, the cut nation selected.
const projector = screen('projector-720', 'Projector · 1280 x 720 · the moment', `
  ${globe({ x: 152, y: 322, size: 1000, selected: 4, cut: 4, gone: 5 })}
  ${holo({ left: 542, top: 64, apexY: 612, id: 4, cut: true, short: true })}
  ${topbar({ compact: true })}
  <div class="abs" style="left:16px;top:64px">${netPanel({})}</div>
  ${decree(884, 604)}
  ${ticker(16, 664, 1248)}
`, { w: 1280, h: 720, starCount: 80 });

const css = `
${tokens}
html,body{overflow:visible;height:auto;background:#05060a}
div,span,section,i,b,p,h1,h2,h3{box-sizing:border-box}
body{padding:40px;display:flex;flex-direction:column;gap:60px}
.screen{position:relative;width:1440px;height:900px;overflow:hidden;background:radial-gradient(ellipse at 55% 60%, #121a2a 0%, #090b12 60%, #05060a 100%);flex:none}
.star{position:absolute;background:#f6eedb;border-radius:50%}
.abs{position:absolute}
.globe{position:absolute}
.scan{position:absolute;left:0;top:0;pointer-events:none}
.mono{font-family:var(--font-mono)}
.cap{font-family:var(--font-display);font-size:var(--text-cap);font-weight:600;letter-spacing:0.12em;text-transform:uppercase}
.cap.dim{color:var(--color-text-muted)}
.rub{color:var(--color-rubric)}
.small{font-size:var(--text-sm)}
.spec-label{position:absolute;font-family:var(--font-display);font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-accent);white-space:nowrap}
.spec-note{position:absolute;width:300px;color:var(--color-text-muted);font-size:14px;line-height:1.5;font-style:italic;border-left:1px solid var(--color-accent);padding-left:14px}
.spec-note .cap{color:var(--color-accent);font-style:normal;margin-bottom:6px}
.spec-inline{color:var(--color-text-muted);font-style:italic;font-size:14px}
.row-specs{position:absolute;left:16px;right:16px;display:flex;gap:18px;align-items:center}
.ico{display:inline-block;flex:none}

/* parchment surfaces */
.panel-look{background:var(--parchment-fill);color:var(--color-ink);border:1.5px solid var(--color-ink);border-radius:var(--radius-2);box-shadow:var(--rule-double),var(--shadow-1);position:absolute}
.panel-look h2,.panel-look h1{font-family:var(--font-display);font-weight:700;letter-spacing:0.06em;margin:0;color:var(--color-ink)}
.panel-look h2{font-size:20px}
.panel-look h3{font-family:var(--font-display);font-size:var(--text-cap);font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-rubric);margin:0 0 6px}
.panel-look .muted,.card .muted{color:var(--color-ink-muted);font-style:italic}
.muted-ink{color:var(--color-ink-muted)}
.sw{display:inline-block;width:12px;height:12px;border:1px solid var(--color-ink);flex:none}

/* buttons: 12px caps by default (tokens.css), 11px small, 10px xs */
.btn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.btn.small{font-size:11px;padding:2px 10px}
.btn.xs{font-size:10px;padding:0 7px;line-height:20px}
.btn.big{font-size:15px;padding:10px 26px;letter-spacing:0.12em}
.btn.primary-dark{background:transparent;color:var(--color-text);border-color:var(--color-text-muted);padding:4px 10px}
.panel-look .btn,.card .btn,.ticker .btn,.decree .btn{background:transparent;color:var(--color-ink);border-color:var(--color-ink)}
.panel-look .btn.primary,.card .btn.primary,.decree .btn.primary{background:var(--color-ink);color:var(--color-parchment-light)}
.panel-look .btn.danger{color:var(--color-danger);border-color:var(--color-danger)}
.chip{white-space:nowrap}

/* top bar */
.topbar{position:absolute;left:0;right:0;top:0;height:var(--topbar-height);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;background:linear-gradient(180deg,#191e2b 0%,#10131c 100%);border-bottom:1px solid rgba(201,162,75,0.45);box-shadow:0 1px 0 rgba(0,0,0,0.6),0 6px 20px rgba(0,0,0,0.45)}
.tb-group{display:flex;align-items:center;gap:10px;flex:none}
.tb-world{max-width:138px;overflow:hidden}
.tb-name,.tb-era,.wordmark,.conn{white-space:nowrap}
.tb-era{overflow:hidden;text-overflow:ellipsis}
.wordmark{font-family:var(--font-display);font-weight:700;font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:var(--color-accent)}
.vsep{width:1px;height:26px;background:var(--color-border)}
.tb-name{font-family:var(--font-display);font-size:17px;font-weight:600;letter-spacing:0.04em;color:var(--color-text);line-height:20px}
.tb-era{font-size:13px;font-style:italic;color:var(--color-text-muted);line-height:15px}
.tb-year{display:flex;align-items:baseline;gap:7px;padding:2px 10px;border:1px solid rgba(201,162,75,0.55);border-radius:2px}
.tb-year .cap{color:var(--color-text-muted)}
.tb-year .num{font-family:var(--font-mono);font-size:20px;font-weight:600;color:var(--color-accent);line-height:28px}
.conn{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--color-text-muted)}
.conn i{width:8px;height:8px;border-radius:50%;display:inline-block}
.conn-live i{background:var(--color-ok-bright);box-shadow:0 0 6px var(--color-ok-bright)}
.conn-live{color:var(--color-text)}
.conn-reconnecting i{background:var(--color-warn);box-shadow:0 0 6px var(--color-warn)}
.conn-reconnecting,.conn-offline{color:var(--color-text)}
.conn-offline i{background:var(--color-danger)}
.segs{display:flex;border:1px solid var(--color-border);border-radius:2px;background:var(--color-surface)}
.seg{font-family:var(--font-display);font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-text-muted);padding:0 10px;line-height:28px;border-left:1px solid var(--color-border);display:flex;align-items:center}
.seg:first-child{border-left:none}
.seg.mono{font-family:var(--font-mono);letter-spacing:0;font-size:13px;padding:0 8px}
.seg.icon{padding:0 10px;color:var(--color-text-muted)}
.seg.on{background:var(--color-parchment);color:var(--color-ink)}
.meter{display:flex;align-items:center;gap:5px;font-size:13px;color:var(--color-text-muted);padding:0 6px 0 10px;line-height:28px;border:1px solid var(--color-border);border-radius:2px;background:#0d1018;white-space:nowrap}
.meter .calls{display:inline-flex;align-items:center;gap:5px}
.meter .num{font-family:var(--font-mono);color:var(--color-text);font-size:13px}
.meter .dot{color:var(--color-border);margin:0 2px}
.meter .mode{font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;padding:0 6px;line-height:18px;border-radius:2px;margin-left:5px}
.meter-mock .mode{color:var(--color-text-muted);border:1px solid var(--color-border)}
.meter-live .mode{color:var(--color-ink);background:var(--color-accent)}
.meter-capped{border-color:rgba(179,38,30,0.7)}
.meter-capped .mode{color:#fff;background:var(--color-danger)}
/* 1280 px and narrower */
.topbar.compact .tb-era,.topbar.compact .meter .calls,.topbar.compact .conn-live .conn-word{display:none}
.topbar.compact .tb-name{line-height:28px}
.topbar.compact .seg{padding:0 9px}
.topbar.compact .tb-world{max-width:170px}
.topbar.compact .seg.mono{padding:0 8px}
.topbar.compact .tb-group{gap:10px}

/* ticker */
.ticker{position:absolute;height:var(--ticker-height);display:flex;align-items:center;gap:14px;padding:0 10px 0 0;background:var(--parchment-fill);border:1.5px solid var(--color-ink);border-radius:2px;box-shadow:var(--shadow-1);color:var(--color-ink);overflow:hidden}
.t-label{align-self:stretch;display:flex;align-items:center;padding:0 14px;background:var(--color-ink);color:var(--color-parchment);font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase}
.t-track{flex:1;display:flex;align-items:center;gap:14px;overflow:hidden;white-space:nowrap;font-size:16px}
.t-item{display:inline-flex;align-items:center;gap:7px;padding:3px 8px;margin:0 -8px;border-radius:2px}
.t-item.new{background:rgba(201,162,75,0.38);font-weight:500}
.yr{font-family:var(--font-mono);font-size:13px;color:var(--color-rubric);font-weight:600}
.t-sep{width:4px;height:4px;transform:rotate(45deg);background:var(--color-ink-muted);flex:none}

/* decree */
.decree{position:absolute;width:380px;height:48px;display:flex;align-items:center;gap:10px;padding:0 8px 0 12px;background:var(--parchment-fill);border:1.5px solid var(--color-ink);border-radius:2px;box-shadow:var(--shadow-1);color:var(--color-ink)}
.d-input{flex:1;font-size:15px;font-style:italic;color:var(--color-ink-muted);border-bottom:1px solid var(--color-ink-muted);line-height:24px;white-space:nowrap;overflow:hidden}
.d-input.typed{font-style:normal;color:var(--color-ink)}

/* hologram card */
.holo-stack{position:absolute;width:var(--card-width);display:flex;flex-direction:column}
.holo-stack .card{flex:none}
.beam{flex:1;min-height:0;width:var(--card-width);display:block}
.beam-foot{position:absolute;bottom:-16px}
.card{width:var(--card-width);position:relative;color:var(--color-ink);border-radius:var(--radius-2);overflow:hidden}
.holo-look{background:var(--parchment-fill);opacity:var(--holo-opacity);border:1px solid rgba(42,31,20,0.6);box-shadow:var(--holo-glow)}
.holo-look.warm{box-shadow:var(--holo-glow-warm)}
.holo-look.silenced{box-shadow:var(--holo-glow-cut)}
.holo-look::before{content:none}
.holo-look .card-in{border-bottom:3px solid var(--holo-tint);background:var(--holo-spill)}
.holo-look.warm .card-in{border-bottom-color:var(--holo-warm);background:var(--holo-spill-warm)}
.holo-look.silenced .card-in{border-bottom:3px dotted var(--holo-tint);background:none}
/* registration marks: the page is projected, not pinned */
.hb{position:absolute;width:11px;height:11px;border:0 solid var(--holo-tint);z-index:2;display:block}
.hb-tl{left:5px;top:5px;border-top-width:2px;border-left-width:2px}
.hb-tr{right:5px;top:5px;border-top-width:2px;border-right-width:2px}
.hb-bl{left:5px;bottom:7px;border-bottom-width:2px;border-left-width:2px}
.hb-br{right:5px;bottom:7px;border-bottom-width:2px;border-right-width:2px}
.warm .hb{border-color:var(--holo-warm)}
.silenced .hb{opacity:0.45}
.docked{position:relative;box-shadow:var(--rule-double),var(--shadow-2);border:1.5px solid var(--color-ink)}
.card-in{position:relative;padding:18px 20px 16px}
.c-head{display:flex;gap:14px;align-items:center}
.flag{flex:none;box-shadow:0 1px 3px rgba(0,0,0,0.35)}
.c-title{flex:1}
.c-gov{font-family:var(--font-display);font-size:var(--text-cap);font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-rubric);line-height:14px;margin-bottom:2px}
.c-name{font-family:var(--font-display);font-size:22px;font-weight:700;line-height:25px;letter-spacing:0.03em}
.c-leader{font-style:italic;color:var(--color-ink-muted);font-size:16px;line-height:20px}
.c-close{align-self:flex-start;padding:2px}
.ideology{margin:12px 0 10px;padding:8px 12px;border-left:2px solid var(--color-rubric);font-style:italic;font-size:16px;line-height:21px;background:rgba(214,195,153,0.45)}
.c-silence{margin:12px 0 10px;padding:9px 12px 10px;background:var(--color-night-inset);color:var(--color-text);border-left:2px solid var(--holo-tint);border-radius:1px}
.cs-top{display:flex;justify-content:space-between;align-items:baseline}
.cs-top .cap{color:var(--holo-tint);letter-spacing:0.18em;font-weight:700}
.cs-top .mono{font-size:13px;color:var(--holo-tint)}
.cs-txt{font-style:italic;font-size:15px;line-height:19px;margin-top:4px}
.facts{display:grid;grid-template-columns:0.8fr 1fr 1fr;gap:6px 16px;padding:8px 0 9px;border-top:1px solid var(--color-ink-faint);border-bottom:1px solid var(--color-ink-faint)}
.facts div{display:flex;flex-direction:column}
.facts .cap{color:var(--color-ink-muted);font-size:10px}
.facts .v{font-size:16px;line-height:21px}
.facts .v.mono{font-size:16px;font-weight:600}
.sec{margin-top:10px}
.card h3{font-family:var(--font-display);font-size:var(--text-cap);font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-rubric);margin:0 0 5px}
.tab-body{min-height:92px}
.sec p{margin:0;font-size:16px;line-height:21px}
.sec p.c-summary{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
/* short viewports (under 800 px tall): the summary and the second sentence of the Silence strip go, so the beam still has room */
.card.short .c-sum,.card.short .cs-more{display:none}
.card.short .tab-body{min-height:0}
.sec p.small{margin-top:8px;font-size:14.5px;line-height:19px;color:var(--color-ink-muted)}
.tabs{display:flex;margin-top:12px;border-bottom:1px solid var(--color-ink-faint)}
.tab{font-family:var(--font-display);font-size:var(--text-cap);font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px 5px;color:var(--color-ink-muted)}
.tab.on{color:var(--color-ink);border-bottom:2px solid var(--color-rubric)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.card .chip{font-size:13.5px;padding:0 9px;line-height:21px}
.rel{display:flex;align-items:center;gap:8px;padding:2px 0;font-size:15px;line-height:20px;border-bottom:1px dotted var(--color-ink-faint)}
.rel-name{flex:1}
.stance{font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:0 8px;line-height:17px;border-radius:999px;color:#fff}
.stance-war{background:var(--stance-war)}
.stance-hostile{background:var(--stance-hostile);color:var(--color-ink)}
.stance-neutral{background:transparent;color:var(--color-ink-muted);border:1px solid var(--color-ink-muted);line-height:15px}
.stance-trade{background:var(--stance-trade)}
.stance-alliance{background:var(--stance-alliance)}
.c-foot{display:flex;gap:8px;margin-top:12px}
.c-foot .btn{flex:1;justify-content:center;font-size:12px;line-height:26px}
.progress{height:2px;background:var(--color-ink-faint);margin-top:10px}
.progress div{height:2px;background:var(--color-rubric)}
.now-playing{font-size:12px;color:var(--color-ink-muted);margin-top:5px}
.loading-lines div{height:9px;margin:7px 0;border-radius:2px;background:linear-gradient(90deg,rgba(42,31,20,0.10),rgba(42,31,20,0.20),rgba(42,31,20,0.10))}

/* network */
.net{position:relative;width:var(--net-width);padding:14px 16px 10px}
.net-head{display:flex;align-items:center;gap:10px}
.net-head h2{flex:1;white-space:nowrap}
.net-count{font-size:12px;color:var(--color-ink-muted)}
.net-fold{display:flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid var(--color-ink-muted);border-radius:2px;transform:rotate(90deg)}
.net-sub{margin-top:2px;line-height:18px}
.net-head .small{margin-top:2px;line-height:17px}
.switch-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;padding:6px 10px;border:1px solid var(--color-ink-faint);border-radius:2px;background:rgba(246,238,219,0.5)}
.switch-row .small{line-height:16px;font-size:13.5px}
.sw-title{font-family:var(--font-display);font-size:var(--text-cap);font-weight:700;letter-spacing:0.12em;text-transform:uppercase;line-height:15px}
.switch-row.on{border-color:var(--color-ink-muted)}
.switch-row.blackout.on{background:var(--color-danger);border-color:var(--color-danger);color:#fff}
.switch-row.blackout.on .muted{color:#fff}
.toggle{width:34px;height:18px;border-radius:999px;background:rgba(42,31,20,0.3);position:relative;flex:none;display:block}
.toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--color-parchment-light);box-shadow:0 1px 2px rgba(0,0,0,0.4)}
.toggle.on{background:var(--color-ink)}
.toggle.on i{left:18px}
.toggle.danger.on{background:rgba(0,0,0,0.45)}
.rows{margin-top:8px}
.nrow{padding:7px 8px 8px 7px;border-top:1px solid var(--color-ink-faint);border-left:3px solid transparent}
.nrow.sel{background:rgba(201,162,75,0.22);border-left-color:var(--color-accent)}
/* a cut nation's row goes dark: a hole in the page */
.nrow.is-cut{background:var(--color-night-inset);color:var(--color-text);border-left-color:var(--holo-tint);border-top-color:var(--color-night-inset)}
.nrow.is-cut.sel{border-left-color:var(--color-accent)}
.nr-top{display:flex;align-items:center;gap:8px}
.nr-name{flex:1;font-size:16px;font-weight:600;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nr-line{display:flex;align-items:center;justify-content:space-between;margin-top:5px}
.nr-states{display:flex;gap:6px;margin:0}
/* the ruler is a quiet word, not a box: the row's only boxes are its buttons and the red Cut */
.state{display:inline-flex;align-items:center;gap:5px;font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0 7px;line-height:18px;border-radius:2px;border:1px solid;white-space:nowrap;flex:none}
.state i{width:6px;height:6px;border-radius:50%;display:inline-block}
.state.up{color:var(--link-up);border-color:transparent;padding:0}
.state.up i{background:var(--link-up)}
.state.cut{color:#fff;background:var(--link-cut);border-color:var(--link-cut)}
.state.cut i{background:#fff}
.state.llm{color:#6b4e12;border-color:var(--ruler-llm);background:rgba(201,162,75,0.18)}
.nr-states .state.llm,.nr-states .state.auto{border-color:transparent;background:none;padding:0}
.state.auto{color:#3f4b56;border-color:var(--ruler-autopilot)}
.nrow.is-cut .state.llm{color:var(--color-accent);background:transparent}
.nrow.is-cut .state.auto{color:#aab6c2}
.state.del{color:var(--color-rubric);border:1.5px solid var(--color-rubric);transform:rotate(-3deg);letter-spacing:0.14em}
.nr-sub{margin:3px 0 0 20px;font-size:12px;color:var(--color-ink-muted)}
.nrow.is-cut .nr-sub{color:var(--holo-tint)}
.nr-btns{display:flex;gap:5px;margin:0}
.nr-btns .btn.danger{border-color:transparent;padding:0 3px}
.nrow.is-cut .btn{color:var(--color-text);border-color:rgba(239,230,208,0.45)}
.nrow.is-cut .btn.restore{background:var(--holo-tint);color:#06231f;border-color:var(--holo-tint)}
.nrow.is-cut .btn.danger{color:#ee8a7a;border-color:transparent}
.nrow.deleted .nr-name{text-decoration:line-through;color:var(--color-ink-muted);font-weight:400}
.nrow.deleted .sw{opacity:0.4}
.nrow.deleted .nr-sub{font-family:var(--font-serif);font-style:italic;font-size:14px}
.net-tab{display:flex;align-items:center;gap:10px;height:40px;padding:0 12px 0 14px;background:var(--parchment-fill);color:var(--color-ink);border:1.5px solid var(--color-ink);border-radius:2px;box-shadow:var(--shadow-1)}
.nt-title{font-family:var(--font-display);font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-right:4px}

/* army tags on the map */
.army{position:absolute;font-family:var(--font-mono);font-size:12px;font-weight:600;line-height:17px;padding:0 5px;background:var(--color-parchment-light);color:var(--color-ink);border:1px solid;border-left-width:4px;border-radius:1px;box-shadow:0 1px 3px rgba(0,0,0,0.5)}
.battle{position:absolute;width:18px;height:18px;border-radius:50%;border:2px solid var(--color-danger);box-shadow:0 0 10px var(--color-danger)}
.map-tag{position:absolute;padding:5px 10px 6px;background:var(--color-parchment-light);color:var(--color-ink);border:1px solid var(--color-ink);border-left:4px solid var(--color-accent);border-radius:1px;box-shadow:0 2px 8px rgba(0,0,0,0.5);font-size:14px;line-height:18px;white-space:nowrap}
.map-tag .cap{display:block;color:#6b4e12;font-size:10px;line-height:13px}

/* dispatches */
.herald{width:var(--herald-width);background:var(--parchment-fill);color:var(--color-ink);border:1.5px solid var(--color-ink);border-radius:2px;box-shadow:var(--shadow-2);overflow:hidden}
.h-band{display:flex;align-items:center;justify-content:space-between;padding:0 12px;line-height:28px;font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#fff;background:var(--color-ink)}
.h-band .mono{font-size:13px;letter-spacing:0;font-weight:600}
.herald.war .h-band{background:var(--color-danger)}
.herald.return .h-band{background:var(--color-night-inset);color:var(--holo-tint)}
.h-body{padding:12px 14px 13px;text-align:center}
.h-vs{display:flex;align-items:center;justify-content:center;gap:12px}
.h-vs.gone{opacity:0.45;filter:grayscale(1)}
.h-x{font-style:italic;font-size:15px;color:var(--color-ink-muted)}
.h-title{font-family:var(--font-display);font-size:18px;font-weight:700;line-height:23px;letter-spacing:0.03em;margin-top:9px}
.h-quote{font-style:italic;font-size:15px;line-height:19px;color:var(--color-ink-muted);margin-top:6px}
.h-quote span{display:block;font-style:normal;font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;margin-top:3px}
.h-stats{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:10px;border-top:1px solid var(--color-ink-faint);border-bottom:1px solid var(--color-ink-faint)}
.h-stats div{display:flex;flex-direction:column;padding:6px 0 7px;border-left:1px solid var(--color-ink-faint)}
.h-stats div:first-child{border-left:none}
.h-stats b{font-size:24px;line-height:28px;font-weight:600;color:var(--silence-ink)}
.h-stats span{font-family:var(--font-display);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-ink-muted)}

/* create */
.veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%, rgba(5,6,10,0.15) 0%, rgba(5,6,10,0.65) 100%)}
.brand{position:absolute;left:24px;top:22px;display:flex;align-items:baseline;gap:14px}
.brand-sub{font-style:italic;color:var(--color-text-muted);font-size:15px}
.create{width:640px;padding:26px 34px 22px}
.cr-head h1{font-size:var(--text-2xl);line-height:44px;margin:2px 0 2px}
.cr-head .muted{font-size:17px}
.field{margin-top:16px;display:flex;flex-direction:column;gap:7px}
.field .cap{color:var(--color-ink)}
.field .cap b{color:var(--color-rubric);font-size:13px;margin-left:6px;letter-spacing:0}
.prompt{min-height:76px;padding:10px 12px;background:var(--color-parchment-light);border:1.5px solid var(--color-ink);border-radius:2px;font-size:20px;line-height:27px;box-shadow:inset 0 1px 3px rgba(42,31,20,0.2)}
.caret{display:inline-block;width:1.5px;height:20px;background:var(--color-ink);margin-left:2px;vertical-align:-3px}
.create .chip{font-size:15px;line-height:26px;padding:0 12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.stepper{display:flex;align-items:center;gap:0}
.st-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--color-ink);font-size:18px;font-weight:600}
.st-val{width:44px;height:32px;display:flex;align-items:center;justify-content:center;border-top:1.5px solid var(--color-ink);border-bottom:1.5px solid var(--color-ink);font-size:17px;font-weight:600;background:var(--color-parchment-light)}
.pips{display:flex;gap:4px;margin-left:12px}
.pips i{width:8px;height:8px;transform:rotate(45deg);border:1px solid var(--color-ink);display:block}
.pips i.on{background:var(--color-ink)}
.hint{font-size:14px;font-style:italic;color:var(--color-ink-muted)}
.select{display:flex;align-items:center;justify-content:space-between;height:32px;padding:0 10px;border:1.5px solid var(--color-ink);border-radius:2px;background:var(--color-parchment-light);font-size:17px}
.slider{position:relative;height:6px;margin:8px 0 4px;background:rgba(42,31,20,0.18);border-radius:3px}
.slider .fill{position:absolute;left:0;top:0;height:6px;background:var(--color-ink);border-radius:3px}
.slider .knob{position:absolute;top:-6px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:var(--color-parchment-light);border:2px solid var(--color-ink);box-shadow:0 1px 3px rgba(0,0,0,0.35)}
.ends{display:flex;justify-content:space-between;font-size:14px;font-style:italic;color:var(--color-ink-muted)}
.cr-foot{display:flex;align-items:center;justify-content:space-between;margin-top:20px;padding-top:16px;border-top:1px solid var(--color-ink-faint)}

/* founding scroll */
.founding{width:580px;padding:20px 28px 20px}
.founding h2{font-size:22px;line-height:28px;margin-top:2px}
.fo-prompt{font-style:italic;font-size:16px;line-height:21px;color:var(--color-ink-muted);margin-top:4px}
.fo-steps{margin-top:12px;border-top:1px solid var(--color-ink-faint);padding-top:8px}
.fo-step{display:flex;align-items:center;gap:10px;font-size:17px;line-height:30px;color:var(--color-ink-muted)}
.fo-step i{width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--color-ink-muted);transform:rotate(45deg);flex:none}
.fo-step i svg{transform:rotate(-45deg)}
.fo-step.done{color:var(--color-ink)}
.fo-step.done i{border-color:transparent}
.fo-step.doing{color:var(--color-ink);font-weight:600}
.fo-step.doing i{background:var(--color-rubric);border-color:var(--color-rubric)}
.fo-pen{flex:1;height:2px;margin-left:4px;background:linear-gradient(90deg,var(--color-rubric) 0%,rgba(156,47,34,0) 100%)}

/* closing card */
.closing{width:760px;padding:30px 40px 24px;text-align:center}
.closing h1{font-size:26px;line-height:34px;margin-top:6px}
.cl-hero{display:flex;align-items:baseline;justify-content:center;gap:16px;margin-top:2px}
.cl-num{font-size:var(--text-hero);line-height:104px;font-weight:600;letter-spacing:-0.06em}
.cl-unit{font-family:var(--font-display);font-size:22px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--color-rubric)}
.cl-stats{display:grid;grid-template-columns:repeat(4,1fr);margin-top:8px;border-top:1px solid var(--color-ink);border-bottom:1px solid var(--color-ink)}
.cl-stats div{display:flex;flex-direction:column;align-items:center;padding:12px 10px 13px;border-left:1px solid var(--color-ink-faint)}
.cl-stats div:first-child{border-left:none}
.cl-stats b{font-size:30px;line-height:34px;font-weight:600}
.cl-stats span{font-size:15px;line-height:19px;font-style:italic;color:var(--color-ink-muted);margin-top:2px}
.cl-foot{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:16px;text-align:left}
.cl-foot .muted{font-size:15px}

/* timeline */
.timeline{position:relative;width:1408px;padding:16px 20px 14px}
.tl-head{display:flex;align-items:center;gap:24px}
.tl-head .muted{font-size:15px}
.legend{flex:1;display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:flex-end;font-size:14px}
.lg{display:inline-flex;align-items:center;gap:5px}
.tl-body{margin-top:14px;padding-left:200px;position:relative}
.axis{position:relative;height:22px;border-bottom:1px solid var(--color-ink)}
.tick{position:absolute;top:0;height:22px;border-left:1px solid var(--color-ink-muted);padding-left:4px;font-size:12px;color:var(--color-ink-muted)}
.now{position:absolute;top:-4px;height:234px;border-left:2px solid var(--color-accent);z-index:2}
.now span{position:absolute;left:-50px;top:-17px;font-size:12px;font-weight:600;color:#6b4e12;white-space:nowrap}
.lanes{position:relative;height:204px}
.lane{position:absolute;left:-200px;width:1320px;height:34px;border-bottom:1px dotted var(--color-ink-faint)}
.lane-name{width:190px;height:34px;display:flex;align-items:center;gap:8px;font-size:16px;font-weight:500}
.track{position:absolute;left:0;top:0;width:1120px;height:204px}
.ev{position:absolute;width:14px;height:14px;line-height:0}
.warband{position:absolute;background:rgba(179,38,30,0.18);border:1px solid rgba(179,38,30,0.55);border-radius:2px}
/* the Silence sits on the silent nation's own lane, as dark as its row in the network panel */
.silence{position:absolute;background:var(--color-night-inset);border-radius:1px;display:flex;align-items:center;justify-content:center}
.silence span{font-family:var(--font-display);font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--holo-tint);white-space:nowrap}
.tip{position:absolute;width:270px;padding:8px 10px;background:var(--color-parchment-light);border:1px solid var(--color-ink);border-radius:2px;box-shadow:0 3px 10px rgba(42,31,20,0.35);font-size:14px;line-height:18px;z-index:3}
.tip-k{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--color-rubric);margin-bottom:3px}
.tl-list{margin-top:12px;border-top:1px solid var(--color-ink-faint);padding-top:6px}
.tl-entry{display:flex;align-items:center;gap:10px;font-size:16px;line-height:25px}
.tl-entry .k{width:84px;color:var(--color-ink-muted);font-size:10px}

/* network screen extras */
.belief-banner{position:absolute;left:50%;top:64px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:6px 8px 6px 14px;background:rgba(13,30,34,0.94);border:1px solid var(--holo-tint);border-radius:2px;color:var(--color-text);font-size:15px;white-space:nowrap;box-shadow:0 0 18px rgba(127,230,216,0.3)}
.belief-banner .cap{color:var(--holo-tint)}
.belief-banner .btn{background:transparent;color:var(--holo-tint);border-color:var(--holo-tint)}
.legend-box{width:220px;padding:12px 16px}
.lg-row{display:flex;align-items:center;gap:8px;font-size:15px;line-height:23px}
`;

// Figma's importer reads stylesheet rules, not computed styles: inline every var() for it.
let cssOut = css;
if (mode !== 'preview') {
  const vars = {};
  for (const m of tokens.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  for (let i = 0; i < 6; i++) cssOut = cssOut.replace(/var\((--[\w-]+)\)/g, (_, n) => vars[n] ?? '');
  cssOut = cssOut.replace(/:root\s*\{[\s\S]*?\n\}/, '');
  cssOut = cssOut.replace(/@keyframes[\s\S]*?\n\}\n/g, '').replace(/animation:[^;}]+;?/g, ''); // a still picture: no motion
}
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Terra Nova - interface</title><style>${cssOut}</style></head><body>
${overview}${create}${founding}${cardScreen}${chronicle}${network}${topScreen}${moments}${closing}${projector}
</body></html>`;
writeFileSync(outPath, html);
console.log('wrote', outPath, html.length);
