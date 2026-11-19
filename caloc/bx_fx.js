// bx_fx.js — "Bánh xèo miền Tây" effects. LOCAL in / LOCAL out. Deterministic from t / seed, no per-frame filters.
// THIS HEADER IS THE SOURCE OF TRUTH for the API.  const BX = require('./bxprops');
// =====================================================================================================================
//  sizzleWord(ctx,x,y,s,{t, k 0..1 (pop-in; >1 holds), vi='XÈÈO!', en='SIZZLE!', shake 0..1, rot=-0.08, out 0..1 (fade out)})
//        → {box:[x0,y0,x1,y1]}   comic burst: jagged red→yellow starburst ~620×330 at s=1, big VI word (BodySansBold 130,
//        cream-yellow fill, thick dark stroke) + EN line (56, white) under it. outBack pop from k, jitter from shake.
//        Long words auto-shrink to fit the burst (e.g. 'XÈÈÈÈO!!!' / 'SIZZZZLE!!!').
//  crunchWord(ctx,x,y,s,{t,k,vi='RỘP!',en='CRUNCH!',shake,rot,out}) same style, brown/orange burst.
//  quack(ctx,x,y,s,{k, t, vi='QUẠC!', en='QUACK!', flip, out}) → {tail}  white speech bubble ~300×170, tail at the origin
//        (put the origin at the duck's beak), bubble up-right (flip: up-left).
//  steamEruption(ctx,t,x,y,s,k,{seed, sun=false, mushroom=false, alpha=1}) origin = base (pan). k 0..1 eruption progress
//        (0 nothing, .2 burst, 1 fully risen + drifting). Normal: ~500 wide × 700 tall puffy cloud fan. mushroom:
//        stem column + rolling cap ~900 wide at y−900 (sun = warm sunset rim light on the top-left of the puffs).
//  oilSparkle(ctx,t,x,y,s,{n=14, seed, w=360, h=60, alpha=1}) hot-oil droplets jumping out of a pan (area w×h centred at
//        x,y) with star glints. Loops forever with t.
//  crumbBurst(ctx,t,t0,x,y,s,{n=26, seed, spread=1, g=1500}) golden crispy shards flying from (x,y) at t0, gravity, fade by 1.3s.
//  flyingCrepe(ctx,x,y,s,{t, spin (rad, frisbee spin), rot (screen tilt), tilt=0.35 (ryr of the disc), trail 0..1, fold=1,
//        vx=1, vy=0 (motion direction for speed lines/ghosts)}) → {center}   bánh xèo as a spinning frisbee.
//  smokeWisp(ctx,t,x,y,s,{seed, alpha=1, h=260}) thin grey-blue smoke curling up from (x,y) (charred edge / stove).
//  sparkles(ctx,t,x,y,s,{n=6, seed, r=120, alpha=1}) twinkling star cluster (appetising "ting!" around the hero).
//  heartPop(ctx,x,y,s,{k, t}) pink cartoon heart popping (outBack) with a little wobble.
// =====================================================================================================================
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const FOOD = require('./bx_food');
const { createCanvas } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease } = L;
const PI = Math.PI;
const { lgr, rgr, ell, outFill } = NP;

// ------------------------------------------------------------------ puff sprites (cached)
const SPR = {};
function puffSprite(kind) {
  if (SPR[kind]) return SPR[kind];
  const N = 128, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2;
  if (kind === 'soft') { x.fillStyle = rgr(x, h, h, 0, h, h, h, [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, N, N); }
  else if (kind === 'toon' || kind === 'sun') {
    // cartoon puff: solid body + shade + rim
    x.fillStyle = rgr(x, h, h, 0, h, h, h, [[0, 'rgba(255,255,255,1)'], [0.78, 'rgba(250,248,245,1)'], [0.86, 'rgba(240,236,232,0.6)'], [1, 'rgba(240,236,232,0)']]); x.fillRect(0, 0, N, N);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = rgr(x, h + 18, h + 22, 4, h + 10, h + 14, h, [[0, 'rgba(190,190,210,0)'], [0.6, 'rgba(180,182,205,0.25)'], [1, 'rgba(160,160,190,0.55)']]); x.fillRect(0, 0, N, N);
    if (kind === 'sun') { x.fillStyle = rgr(x, h - 26, h - 26, 2, h - 10, h - 10, h * 0.95, [[0, 'rgba(255,205,150,0)'], [0.55, 'rgba(255,205,150,0)'], [0.85, 'rgba(255,196,140,0.32)'], [1, 'rgba(255,180,120,0.5)']]); x.fillRect(0, 0, N, N); }
  } else if (kind === 'smoke') { x.fillStyle = rgr(x, h, h, 0, h, h, h, [[0, 'rgba(120,125,140,0.6)'], [0.6, 'rgba(120,125,140,0.25)'], [1, 'rgba(120,125,140,0)']]); x.fillRect(0, 0, N, N); }
  return (SPR[kind] = c);
}
function puff(ctx, kind, x, y, r, a) { if (a <= 0.003 || r <= 0.5) return; const c = puffSprite(kind); const ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a); ctx.drawImage(c, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = ga; }

// ------------------------------------------------------------------ comic words
const BURST = {};
function burstPath(ctx, w, h, n, seed) {
  const r = rng(seed); ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU - PI / 2, o = i % 2 === 0 ? 1 + r() * 0.12 : 0.66 + r() * 0.1; const px = Math.cos(a) * w / 2 * o, py = Math.sin(a) * h / 2 * o; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
}
function burstSprite(pal) {
  if (BURST[pal]) return BURST[pal];
  const W2 = 660, H2 = 380, RES = 1, c = createCanvas(W2 * RES, H2 * RES), x = c.getContext('2d');
  x.translate(W2 / 2, H2 / 2); x.lineJoin = 'round';
  const P = pal === 'crunch' ? [['#ffd25a', '#f08a1e', '#a8461a'], '#5a2a0a'] : pal === 'quack' ? null : [['#fff27a', '#ff9a1e', '#e8321e'], '#4a1208'];
  burstPath(x, 640, 350, 14, pal === 'crunch' ? 5 : 3); x.fillStyle = 'rgba(30,8,0,0.45)'; x.save(); x.translate(8, 10); x.fill(); x.restore();
  burstPath(x, 640, 350, 14, pal === 'crunch' ? 5 : 3); x.lineWidth = 9; x.strokeStyle = P[1]; x.stroke();
  x.fillStyle = rgr(x, 0, 0, 10, 0, 0, 320, [[0, P[0][0]], [0.55, P[0][1]], [1, P[0][2]]]); x.fill();
  burstPath(x, 470, 250, 14, pal === 'crunch' ? 6 : 4); x.fillStyle = 'rgba(255,250,200,0.45)'; x.fill();
  // halftone dots
  x.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = -6; i <= 6; i++) for (let j = -3; j <= 3; j++) { const px = i * 44 + (j % 2) * 22, py = j * 40; if ((px / 300) ** 2 + (py / 160) ** 2 < 0.9) { ell(x, px, py, 5, 5); x.fill(); } }
  return (BURST[pal] = c);
}
function fitFont(ctx, txt, family, size, maxW) { ctx.font = `${size}px ${family}`; const w = ctx.measureText(txt).width; if (w > maxW) { size = size * maxW / w; ctx.font = `${size}px ${family}`; } return size; }
function comicWord(ctx, x, y, s, o, pal, defVi, defEn) {
  const k = o.k ?? 1, t = o.t || 0, out = clamp(o.out || 0); if (k <= 0 || out >= 1) return { box: [x, y, x, y] };
  const pop = k < 1 ? ease.outBack(clamp(k)) : 1 + 0.03 * Math.sin(t * 9);
  const sh = (o.shake ?? 0.4) * 9, jx = Math.sin(t * 61) * sh, jy = Math.cos(t * 53) * sh;
  const vi = o.vi ?? defVi, en = o.en ?? defEn;
  ctx.save(); ctx.translate(x + jx * s, y + jy * s); ctx.rotate((o.rot ?? -0.08) + Math.sin(t * 7) * 0.02); ctx.scale(s * pop * (1 + out * 0.3), s * pop * (1 + out * 0.3)); ctx.globalAlpha *= 1 - out;
  const B = burstSprite(pal); ctx.drawImage(B, -330, -190);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const fs = fitFont(ctx, vi, 'BodySansBold', 130, 520);
  ctx.lineWidth = fs * 0.2; ctx.strokeStyle = pal === 'crunch' ? '#3a1806' : '#3a0c04'; ctx.strokeText(vi, 0, -26);
  ctx.fillStyle = lgr(ctx, 0, -26 - fs * 0.45, 0, -26 + fs * 0.45, [[0, '#ffffff'], [0.45, '#fff6c8'], [1, '#ffd23a']]); ctx.fillText(vi, 0, -26);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  const fe = fitFont(ctx, en, 'BodySansBold', 56, 440);
  ctx.lineWidth = fe * 0.24; ctx.strokeStyle = '#3a0c04'; ctx.strokeText(en, 0, 68); ctx.fillStyle = '#ffffff'; ctx.fillText(en, 0, 68);
  ctx.restore();
  const hw = 330 * s * pop, hh = 190 * s * pop;
  return { box: [x - hw, y - hh, x + hw, y + hh] };
}
function sizzleWord(ctx, x, y, s = 1, o = {}) { return comicWord(ctx, x, y, s, o, 'sizzle', 'XÈÈO!', 'SIZZLE!'); }
function crunchWord(ctx, x, y, s = 1, o = {}) { return comicWord(ctx, x, y, s, Object.assign({ rot: 0.07 }, o), 'crunch', 'RỘP!', 'CRUNCH!'); }
function quack(ctx, x, y, s = 1, o = {}) {
  const k = o.k ?? 1, t = o.t || 0, out = clamp(o.out || 0); if (k <= 0 || out >= 1) return { tail: [x, y] };
  const pop = k < 1 ? ease.outBack(clamp(k)) : 1, fx = o.flip ? -1 : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * pop, s * pop); ctx.globalAlpha *= 1 - out; ctx.rotate(Math.sin(t * 12) * 0.03);
  const bx = 150 * fx, by = -130;
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(bx, by, 150, 82, 0, 0, TAU); ctx.moveTo(bx - 70 * fx, by + 50); ctx.lineTo(0, 0); ctx.lineTo(bx - 20 * fx, by + 70);
  ctx.fillStyle = 'rgba(30,10,0,0.3)'; ctx.save(); ctx.translate(6, 8); ctx.fill(); ctx.restore();
  ctx.lineWidth = 7; ctx.strokeStyle = '#3a1a0a'; ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.fillStyle = '#fff6c0'; ell(ctx, bx, by + 30, 120, 40); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const vi = o.vi ?? 'QUẠC!', en = o.en ?? 'QUACK!';
  const fs = fitFont(ctx, vi, 'BodySansBold', 74, 250); ctx.lineWidth = 8; ctx.strokeStyle = '#3a1a0a'; ctx.strokeText(vi, bx, by - 18); ctx.fillStyle = '#ffb21e'; ctx.fillText(vi, bx, by - 18);
  fitFont(ctx, en, 'BodySansBold', 36, 230); ctx.lineWidth = 6; ctx.strokeText(en, bx, by + 36); ctx.fillStyle = '#ffffff'; ctx.fillText(en, bx, by + 36);
  ctx.restore();
  return { tail: [x, y] };
}

// ------------------------------------------------------------------ steam
const ERUPT = (() => { const r = rng(91), a = []; for (let i = 0; i < 46; i++) a.push({ ang: (r() - 0.5) * 1.3, sp: 0.55 + r() * 0.6, sz: 0.6 + r() * 0.7, d: r(), ph: r() * TAU, cap: r() }); return a; })();
function steamEruption(ctx, t, x, y, s = 1, k = 1, o = {}) {
  if (k <= 0) return;
  const r = rng(o.seed ?? 7), A = (o.alpha ?? 1), kind = o.sun ? 'sun' : 'toon';
  ctx.save();
  if (!o.mushroom) {
    const e = ease.out(clamp(k));
    // core blast at the base (behind the puffs)
    if (k < 0.6) puff(ctx, 'soft', x, y - 40 * s, 170 * s * ease.outBack(clamp(k / 0.3)), (1 - k / 0.6) * 0.8 * A);
    const items = ERUPT.slice(0, 34);
    for (const p of items) {
      const u = clamp(e * p.sp * 1.4 - p.d * 0.25), rise = u * 700 * s, spread = Math.sin(p.ang) * (80 + 300 * u) * s;
      const px = x + spread + Math.sin(t * 1.3 + p.ph) * 16 * s * u, py = y - rise, rr = (30 + 110 * u) * p.sz * s;
      const fade = clamp(1.25 - u) * A * (k > 1 ? clamp(2 - k) : 1);
      puff(ctx, u < 0.6 ? kind : 'soft', px, py, rr, fade);
    }
  } else {
    const e = clamp(k), stemH = 900 * s * ease.out(clamp(e / 0.55)), capK = ease.out(clamp((e - 0.3) / 0.7));
    // stem
    for (let i = 0; i < 16; i++) { const u = i / 15, py = y - u * stemH, j = r(), w = lerp(150, 95, u) * s * (0.8 + 0.4 * j) * (1 + 0.1 * Math.sin(t * 3 + i)); puff(ctx, i % 3 === 2 ? 'soft' : kind, x + (Math.sin(t * 2 + i * 1.3) * 18 + (r() - 0.5) * 30) * s, py, w * (i % 3 === 2 ? 1.15 : 1), A * clamp(e * 3)); }
    // base skirt
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * PI * 0.9, d = 160 * s * ease.out(clamp(e * 2)); puff(ctx, kind, x + Math.sin(a) * d * 1.6, y - 20 * s - Math.abs(Math.cos(a)) * 30 * s, 110 * s, A * clamp(1.3 - e)); }
    // rolling cap (torus)
    if (capK > 0) {
      const cy = y - stemH - 40 * s, CW = 460 * s * capK, CH = 160 * s * capK;
      const ring = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + t * 0.8; ring.push([Math.cos(a), Math.sin(a), 0.8 + r() * 0.45, i]); }
      ring.sort((p, q) => p[1] - q[1]);
      puff(ctx, 'soft', x, cy - 40 * s * capK, 300 * s * capK, A * 0.5);
      for (const [cx, sy, jz, ii] of ring) puff(ctx, ii % 4 === 3 ? 'soft' : kind, x + cx * CW, cy + sy * CH * 0.55 - (1 - Math.abs(cx)) * 50 * s, (140 + 45 * (sy + 1)) * jz * s * capK * (ii % 4 === 3 ? 1.3 : 1), A);
      for (let i = 0; i < 5; i++) { const jz = 0.8 + r() * 0.5; puff(ctx, kind, x + ((i - 2) * 120 + (r() - 0.5) * 40) * s * capK, cy - (130 + (r() - 0.5) * 50) * s * capK + Math.abs(i - 2) * 30 * s, 165 * jz * s * capK, A); }
    }
    if (o.sun) L.glow(ctx, x, y - stemH, 500 * s, 'rgba(255,170,80,1)', 0.18 * A, 'screen');
  }
  ctx.restore();
}

// ------------------------------------------------------------------ oil sparkle
function oilSparkle(ctx, t, x, y, s = 1, o = {}) {
  const n = o.n ?? 14, r = rng(o.seed ?? 3), w = (o.w ?? 360) * s, h = (o.h ?? 60) * s, A = o.alpha ?? 1;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const per = 0.35 + r() * 0.45, ph = (t / per + r()) % 1, px0 = x + (r() - 0.5) * w, py0 = y + (r() - 0.5) * h, vx = (r() - 0.5) * 140 * s, vy = (220 + r() * 260) * s;
    const tt = ph * per, px = px0 + vx * tt, py = py0 - vy * tt + 0.5 * 1800 * s * tt * tt, z = (2 + r() * 3.5) * s;
    const a = A * (1 - ph);
    ctx.globalAlpha = a; ctx.fillStyle = '#fff2b0'; ell(ctx, px, py, z, z * 1.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,80,0.5)'; ell(ctx, px - vx * 0.01, py + 6 * s, z * 0.8, z * 2.2); ctx.fill();
    if (r() < 0.45) L.sparkle(ctx, px, py, (10 + 10 * (1 - ph)) * s, a);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ crumbs
function crumbBurst(ctx, t, t0, x, y, s = 1, o = {}) {
  const age = t - t0; if (age < 0 || age > 1.4) return;
  const n = o.n ?? 26, r = rng(o.seed ?? 11), g = (o.g ?? 1500) * s, sp = o.spread ?? 1;
  ctx.save(); ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.6 * sp, v = (300 + r() * 650) * s, px = x + Math.cos(a) * v * age, py = y + Math.sin(a) * v * age + 0.5 * g * age * age;
    const z = (5 + r() * 11) * s, sp2 = (r() - 0.5) * 18, col = ['#f2b42e', '#e08a22', '#b85e16', '#ffd65a'][(r() * 4) | 0];
    ctx.globalAlpha = clamp((1.4 - age) / 0.4);
    ctx.save(); ctx.translate(px, py); ctx.rotate(sp2 * age + i);
    ctx.beginPath(); ctx.moveTo(-z, -z * 0.3); ctx.lineTo(-z * 0.2, -z * 0.7); ctx.lineTo(z, -z * 0.2); ctx.lineTo(z * 0.4, z * 0.6); ctx.lineTo(-z * 0.6, z * 0.5); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(90,40,10,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  // flash ring
  if (age < 0.25) { ctx.globalAlpha = 1 - age / 0.25; ctx.strokeStyle = '#fff4c0'; ctx.lineWidth = 6 * s; ell(ctx, x, y, (40 + age * 600) * s, (25 + age * 360) * s); ctx.stroke(); }
  ctx.restore();
}

// ------------------------------------------------------------------ flying crêpe
function flyingCrepe(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, spin = o.spin ?? t * 9, rot = o.rot ?? -0.15, tilt = o.tilt ?? 0.35, trail = clamp(o.trail ?? 0.6), vx = o.vx ?? 1, vy = o.vy ?? 0;
  const vl = Math.hypot(vx, vy) || 1, dx = vx / vl, dy = vy / vl;
  ctx.save();
  if (trail > 0) {
    // speed lines behind
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { const off = (i - 4) * 26 * s, Lx = (180 + (i * 53) % 120) * s * trail, b = ((t * 3 + i * 0.37) % 1);
      const px = x - dx * (230 * s + b * 60 * s) - dy * off, py = y - dy * (230 * s + b * 60 * s) + dx * off * tilt * 1.6;
      ctx.strokeStyle = `rgba(255,248,220,${0.65 * trail * (1 - b)})`; ctx.lineWidth = (5 - Math.abs(i - 4) * 0.7) * s; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - dx * Lx, py - dy * Lx); ctx.stroke(); }
    // ghosts
    for (let g = 3; g >= 1; g--) { ctx.save(); ctx.globalAlpha = 0.16 * trail * (4 - g) / 3; ctx.translate(x - dx * g * 60 * s, y - dy * g * 60 * s); ctx.rotate(rot); ctx.scale(1, tilt); ctx.rotate(spin - g * 0.35); ctx.fillStyle = '#f0a83a'; ctx.beginPath(); if ((o.fold ?? 1) > 0.5) { ctx.arc(0, 0, 200 * s, 0, PI); ctx.closePath(); } else ctx.arc(0, 0, 200 * s, 0, TAU); ctx.fill(); ctx.restore(); }
  }
  ctx.translate(x, y); ctx.rotate(rot);
  // spin blur ring
  ctx.lineCap = 'round'; for (let j = 0; j < 2; j++) { const a0 = spin * 1.0 + j * PI; ctx.strokeStyle = `rgba(255,236,180,${0.5 * trail})`; ctx.lineWidth = (6 - j * 2) * s; ctx.beginPath(); ctx.ellipse(0, 0, 228 * s, 228 * s * tilt, 0, a0, a0 + 1.1); ctx.stroke(); }
  FOOD.banhXeo(ctx, 0, 0, s, { ryr: tilt, rot: spin, fold: o.fold ?? 1, centerFold: false, t });
  ctx.restore();
  return { center: [x, y] };
}

// ------------------------------------------------------------------ smoke / sparkles / heart
function smokeWisp(ctx, t, x, y, s = 1, o = {}) {
  const r = rng(o.seed ?? 5), A = o.alpha ?? 1, H2 = (o.h ?? 260) * s;
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const per = 2.2 + r() * 0.8, ph = (t / per + i / 12) % 1, py = y - ph * H2, px = x + Math.sin(ph * 6 + t * 1.5 + i) * 22 * s * ph;
    puff(ctx, 'smoke', px, py, (14 + 50 * ph) * s, A * Math.sin(ph * PI) * 0.9);
  }
  ctx.restore();
}
function sparkles(ctx, t, x, y, s = 1, o = {}) {
  const n = o.n ?? 6, r = rng(o.seed ?? 2), R = (o.r ?? 120) * s, A = o.alpha ?? 1;
  ctx.save();
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = R * (0.4 + r() * 0.6), per = 0.6 + r() * 0.6, ph = (t / per + r()) % 1, tw = Math.sin(ph * PI); L.sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, (14 + r() * 18) * s * tw, A * tw); }
  ctx.restore();
}
function heartPop(ctx, x, y, s = 1, o = {}) {
  const k = o.k ?? 1, t = o.t || 0; if (k <= 0) return;
  const p = (k < 1 ? ease.outBack(clamp(k)) : 1) * (1 + 0.05 * Math.sin(t * 8));
  ctx.save(); ctx.translate(x, y); ctx.scale(s * p, s * p); ctx.rotate(Math.sin(t * 5) * 0.08); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 40); ctx.bezierCurveTo(-70, -5, -55, -60, -25, -60); ctx.bezierCurveTo(-8, -60, 0, -45, 0, -35); ctx.bezierCurveTo(0, -45, 8, -60, 25, -60); ctx.bezierCurveTo(55, -60, 70, -5, 0, 40); ctx.closePath();
  outFill(ctx, lgr(ctx, 0, -60, 0, 40, [[0, '#ff7a9a'], [1, '#e8204a']]), 5, '#5a0a1a');
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ell(ctx, -26, -38, 12, 7, -0.5); ctx.fill();
  ctx.restore();
}

module.exports = { sizzleWord, crunchWord, quack, steamEruption, oilSparkle, crumbBurst, flyingCrepe, smokeWisp, sparkles, heartPop, puffSprite };
