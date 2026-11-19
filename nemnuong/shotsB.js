'use strict';
// Nem nướng Cái Răng — shots s11..s20 (30.6s → 63.0s): building the roll, the orange sauce, the cut, the dip, the giant roll.
const L = require('./lib'), X = require('./text'), NP = require('./nprops');
const { W, H, TAU, clamp, lerp, ease, cam, at, glow, godRays, dust, bokeh, rng, createCanvas } = L;
const { COL, ell, lgr, rgr, capFS } = NP;

const beat = T => ((T / 0.6) % 1 + 1) % 1;
const hitK = T => Math.pow(1 - beat(T), 3);
const iv = (a, b, v) => clamp((v - a) / (b - a));
function cap(ctx, T, lt, dur, vi, en, n) { const s0 = T - lt; X.caption(ctx, T, s0 + 0.15, s0 + dur - 0.1, vi, en, { n }); }
const SKIN_C = COL.skin, SKIN_T = COL.skinT;
// NP drawers return DEVICE coords (they bake in getTransform); under cam() convert them back to user space.
function unmap(ctx) {
  const m = ctx.getTransform(), det = m.a * m.d - m.b * m.c;
  return (q) => { const x = q[0] - m.e, y = q[1] - m.f; return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det]; };
}
function U(ctx, r) {
  const u = unmap(ctx), o = {};
  for (const k in r) o[k] = Array.isArray(r[k]) && r[k].length === 2 && typeof r[k][0] === 'number' ? u(r[k]) : r[k];
  return o;
}
// camera that never shows outside the canvas (used where the backdrop is canvas-sized)
function camSafe(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}

// ================================================================== cached backdrops
// top-down wooden boat deck with banana leaf (2000×2400, centre maps to world (540,860))
let _deck = null;
const DK = { w: 2000, h: 2400, cx: 540, cy: 860 };
function deckBG() {
  if (_deck) return _deck;
  const c = createCanvas(DK.w, DK.h), x = c.getContext('2d'), r = rng(311);
  // planks
  const pw = 230;
  for (let i = 0; i * pw < DK.w + pw; i++) {
    const x0 = i * pw - 40, base = ['#5a3420', '#64391f', '#553019', '#6b4127'][i % 4];
    x.fillStyle = lgr(x, x0, 0, x0 + pw, 0, [[0, NP.mixc(base, '#000000', 0.25)], [0.15, base], [0.8, NP.mixc(base, '#ffffff', 0.06)], [1, NP.mixc(base, '#000000', 0.3)]]);
    x.fillRect(x0, 0, pw, DK.h);
    x.strokeStyle = 'rgba(25,12,6,0.7)'; x.lineWidth = 6; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, DK.h); x.stroke();
    for (let k = 0; k < 26; k++) {
      const gx = x0 + 12 + r() * (pw - 24), amp = 3 + r() * 10, ph = r() * 9;
      x.strokeStyle = r() < 0.5 ? 'rgba(30,14,6,0.35)' : 'rgba(150,95,55,0.22)'; x.lineWidth = 1 + r() * 2.5;
      x.beginPath(); for (let yy = 0; yy <= DK.h; yy += 60) { const xx = gx + Math.sin(yy / 230 + ph) * amp; yy ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke();
    }
    for (let k = 0; k < 2; k++) { x.fillStyle = 'rgba(25,12,6,0.6)'; ell(x, x0 + pw / 2 + (r() - 0.5) * 120, r() * DK.h, 4, 4); x.fill(); }
  }
  // banana leaf under the paper
  x.save(); x.translate(DK.w / 2 + 20, DK.h / 2 + 10); x.rotate(-0.42);
  x.fillStyle = 'rgba(10,20,8,0.45)'; ell(x, 18, 26, 900, 420); x.fill();
  x.beginPath(); x.moveTo(-920, 0); x.bezierCurveTo(-600, -470, 600, -470, 920, -30); x.bezierCurveTo(600, 430, -600, 450, -920, 0); x.closePath();
  x.fillStyle = lgr(x, 0, -420, 0, 420, [[0, '#6fae45'], [0.5, '#3f8a34'], [1, '#2a6428']]); x.fill();
  x.save(); x.clip();
  for (let i = -60; i <= 60; i++) { x.strokeStyle = i % 3 ? 'rgba(20,60,20,0.18)' : 'rgba(190,240,150,0.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(i * 15, 0); x.quadraticCurveTo(i * 15 + 40, -220, i * 15 + 90, -460); x.stroke(); x.beginPath(); x.moveTo(i * 15, 0); x.quadraticCurveTo(i * 15 + 40, 220, i * 15 + 90, 460); x.stroke(); }
  for (let k = 0; k < 5; k++) { x.strokeStyle = 'rgba(30,50,15,0.55)'; x.lineWidth = 3; const sx = -700 + k * 330 + r() * 80; x.beginPath(); x.moveTo(sx, -400); x.lineTo(sx + 60, -40); x.stroke(); }
  x.restore();
  x.strokeStyle = '#c9dc8a'; x.lineWidth = 14; x.beginPath(); x.moveTo(-930, 0); x.quadraticCurveTo(0, -20, 930, -30); x.stroke();
  x.restore();
  // stack of dry rice papers bottom-left, water basin rim top-right, herb basket bottom-right
  x.save(); x.translate(250, DK.h - 520);
  for (let k = 0; k < 4; k++) { NP.ricePaper(x, k * 4, -k * 6, 1.5, { wet: 0 }); }
  x.restore();
  x.save(); x.translate(DK.w - 260, 620);
  x.fillStyle = 'rgba(10,6,4,0.5)'; ell(x, 16, 20, 380, 380); x.fill();
  ell(x, 0, 0, 380, 380); x.fillStyle = lgr(x, -380, -380, 380, 380, [[0, '#d8dde2'], [0.5, '#8d959c'], [1, '#4a5056']]); x.fill();
  ell(x, 0, 0, 340, 340); x.fillStyle = rgr(x, -60, -80, 20, 0, 0, 340, [[0, '#f0b48a'], [0.6, '#9a6f78'], [1, '#3e4a62']]); x.fill();
  x.globalCompositeOperation = 'screen'; x.strokeStyle = 'rgba(255,230,200,0.35)'; x.lineWidth = 3; for (let k = 1; k < 4; k++) { ell(x, -40, -30, k * 70, k * 70); x.stroke(); }
  x.restore();
  NP.herbBasket(x, DK.w - 330, DK.h - 500, 2.1, { ry: 1, seed: 5 });
  // loose herbs + scattered water drops
  NP.herb(x, 'basil', 360, 560, 2.0, 0.6); NP.herb(x, 'tiato', 470, 760, 1.8, -0.4); NP.herb(x, 'lettuce', 300, 1400, 1.6, 1.4);
  NP.herb(x, 'starfruit', 1620, 1320, 1.6, 0.3); NP.herb(x, 'starfruit', 1700, 1420, 1.6, 0.8);
  for (let k = 0; k < 40; k++) { const dx = r() * DK.w, dy = r() * DK.h, rr = 4 + r() * 9; x.fillStyle = 'rgba(255,230,200,0.12)'; ell(x, dx, dy, rr, rr * 0.8); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; ell(x, dx - rr * 0.3, dy - rr * 0.3, rr * 0.25, rr * 0.2); x.fill(); }
  // warm sunrise light across the deck from the top-right, teal shade bottom-left
  x.globalCompositeOperation = 'soft-light';
  x.fillStyle = lgr(x, DK.w, 0, 0, DK.h, [[0, 'rgba(255,170,90,0.9)'], [0.5, 'rgba(255,140,90,0.2)'], [1, 'rgba(20,60,80,0.9)']]); x.fillRect(0, 0, DK.w, DK.h);
  x.globalCompositeOperation = 'source-over';
  _deck = c; return c;
}
function drawDeck(ctx) { ctx.drawImage(deckBG(), DK.cx - DK.w / 2, DK.cy - DK.h / 2); }

// out-of-focus sunrise river behind macro shots (screen space). horizon ~ 1000
let _riv = null;
function riverBokeh() {
  if (_riv) return _riv;
  const c = createCanvas(W + 200, H), x = c.getContext('2d'), r = rng(77), WW = W + 200, HZ = 1000;
  x.fillStyle = lgr(x, 0, 0, 0, HZ, [[0, '#4a3a6a'], [0.35, '#b8607a'], [0.7, '#f08a5e'], [1, '#ffc489']]); x.fillRect(0, 0, WW, HZ);
  x.fillStyle = lgr(x, 0, HZ, 0, H, [[0, '#c9805a'], [0.25, '#7a4a3a'], [1, '#22343a']]); x.fillRect(0, HZ, WW, H - HZ);
  // soft far tree line + stilt houses (blurred blobs)
  for (let i = 0; i < 70; i++) { const bx = r() * WW, rr = 40 + r() * 70; x.fillStyle = rgr(x, bx, HZ - 10, 0, bx, HZ - 10, rr, [[0, 'rgba(60,40,60,0.55)'], [1, 'rgba(60,40,60,0)']]); x.fillRect(bx - rr, HZ - 10 - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 6; i++) { const bx = 80 + i * 210 + r() * 60, bw = 90 + r() * 60; x.fillStyle = 'rgba(70,45,60,0.35)'; x.fillRect(bx, HZ - 70 - r() * 30, bw, 70); }
  // soft sun reflection column + glitter
  x.globalCompositeOperation = 'screen';
  for (let i = 0; i < 90; i++) { const yy = HZ + 10 + Math.pow(r(), 1.6) * 700, sp = 30 + (yy - HZ) * 0.5, bx = 720 + (r() - 0.5) * sp, rw = 20 + r() * 60; x.fillStyle = rgr(x, bx, yy, 0, bx, yy, rw, [[0, 'rgba(255,190,120,0.35)'], [1, 'rgba(255,190,120,0)']]); x.save(); x.translate(bx, yy); x.scale(1, 0.25); x.translate(-bx, -yy); x.fillRect(bx - rw, yy - rw, rw * 2, rw * 2); x.restore(); }
  // bokeh discs
  const cols = [[255, 200, 140], [255, 160, 120], [255, 230, 190], [250, 140, 150]];
  for (let i = 0; i < 46; i++) {
    const bx = r() * WW, by = 200 + r() * 1100, rr = 20 + r() * 80, cc = cols[(r() * 4) | 0], a = 0.08 + r() * 0.22;
    const g = x.createRadialGradient(bx, by, rr * 0.6, bx, by, rr); g.addColorStop(0, `rgba(${cc},${a})`); g.addColorStop(0.9, `rgba(${cc},${a * 1.3})`); g.addColorStop(1, `rgba(${cc},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, rr, 0, TAU); x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  // blurred boat silhouettes on the water
  for (const [bx, by, s] of [[220, 1080, 1], [980, 1050, 0.7]]) for (let k = 0; k < 14; k++) { const rr = 50 * s; x.fillStyle = rgr(x, bx + (k - 7) * 22 * s, by, 0, bx + (k - 7) * 22 * s, by, rr, [[0, 'rgba(40,26,30,0.25)'], [1, 'rgba(40,26,30,0)']]); x.fillRect(bx + (k - 7) * 22 * s - rr, by - rr, rr * 2, rr * 2); }
  _riv = c; return c;
}
// wooden plank table (front of the boat) for macros. top edge at y0
let _tab = null;
function tableTex() {
  if (_tab) return _tab;
  const c = createCanvas(W + 400, 1000), x = c.getContext('2d'), r = rng(19);
  x.fillStyle = lgr(x, 0, 0, 0, 1000, [[0, '#8a5634'], [0.15, '#6b4127'], [1, '#24130b']]); x.fillRect(0, 0, W + 400, 1000);
  for (let k = 0; k < 7; k++) { const yy = k * k * 22 + k * 40; x.strokeStyle = 'rgba(20,10,5,0.7)'; x.lineWidth = 3 + k; x.beginPath(); x.moveTo(0, yy); x.lineTo(W + 400, yy); x.stroke(); }
  for (let k = 0; k < 120; k++) { const yy = Math.pow(r(), 1.4) * 1000, x0 = r() * (W + 400); x.strokeStyle = r() < 0.5 ? 'rgba(30,14,6,0.3)' : 'rgba(190,120,70,0.18)'; x.lineWidth = 1 + yy / 300; x.beginPath(); x.moveTo(x0, yy); x.quadraticCurveTo(x0 + 200, yy + (r() - 0.5) * 10, x0 + 400 + r() * 300, yy + (r() - 0.5) * 8); x.stroke(); }
  // warm sheen along the top edge (sun grazing)
  x.globalCompositeOperation = 'screen'; x.fillStyle = lgr(x, 0, 0, 0, 160, [[0, 'rgba(255,170,110,0.55)'], [1, 'rgba(255,170,110,0)']]); x.fillRect(0, 0, W + 400, 160);
  _tab = c; return c;
}
function macroBack(ctx, T, o = {}) {
  const px = o.pan || 0;
  ctx.drawImage(riverBokeh(), -100 + px, o.dy || 0);
  const sx = o.sunX ?? 720, sy = o.sunY ?? 880;
  glow(ctx, sx, sy, 700, 'rgba(255,140,90,0.55)', 1);
  glow(ctx, sx, sy, 260, 'rgba(255,200,140,0.8)', 1);
  if (o.sunDisc !== false) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, sx, sy, 0, sx, sy, 90, [[0, 'rgba(255,250,225,1)'], [0.6, 'rgba(255,220,160,0.9)'], [1, 'rgba(255,160,90,0)']]); ctx.beginPath(); ctx.arc(sx, sy, 90, 0, TAU); ctx.fill(); ctx.restore(); }
  bokeh(ctx, T, o.seed ?? 5, 10, ['rgba(255,190,130,0.9)', 'rgba(255,150,140,0.8)', 'rgba(255,230,190,0.8)'], 0.22, 30, 90);
  if (o.table !== undefined) ctx.drawImage(tableTex(), -200 + px * 1.6, o.table);
}
function grainLight(ctx, T, x, y) { // shared warm top light + motes
  dust(ctx, T, 41, 26, 0, 200, W, 1300, '255,214,160', 3, 0.5);
}

// ================================================================== top-down assembly (s11–s15)
const PX = 540, PY = 820, PS = 2.3, BY = 52;
// [landTime, kind, x, y, scale, rot]  — same coordinates / order as NP.rollAssembly layers 1..4
const ITEMS = [
  [31.2, 'lettuce', -40, BY, 1.0, 0.05], [31.8, 'lettuce', 40, BY + 4, 0.95, -0.08],
  [32.4, 'basil', -60, BY - 8, 0.8, 0.1], [33.0, 'diepca', 0, BY - 12, 0.9, -0.1], [33.6, 'tiato', 60, BY - 6, 0.8, 0.15],
  [34.8, 'starfruit', -80, BY + 10, 0.5, 0], [34.95, 'starfruit', -50, BY + 10, 0.5, 1], [35.1, 'starfruit', -20, BY + 10, 0.5, 2],
  [35.4, 'banana', 20, BY + 14, 0.55, 0], [35.55, 'banana', 50, BY + 14, 0.55, 0], [36.0, 'cucumber', 80, BY + 10, 0.55, 0],
  [37.8, 'carrot', -50, BY - 2, 0.8, 0.05], [38.4, 'daikon', 50, BY, 0.8, -0.05], [39.0, 'ram', 0, BY + 18, 0.9, 0.03],
];
const NEM_LAND = 42.0;
function drawItem(ctx, kind, x, y, s, rot) {
  if (kind === 'ram') NP.ramRoll(ctx, x, y, s, rot, { seed: 3 });
  else NP.herb(ctx, kind, x, y, s, rot);
}
// item in flight / landed. mode 'hand' (carried by a pinch hand) or 'drop' (falls toward camera-down)
function placeItem(ctx, T, it, idx, mode, skin) {
  const [tl, kind, x, y, s, rot] = it;
  const u = (T - (tl - 0.5)) / 0.5;
  if (u <= 0) return;
  const land = T - tl, sq = land > 0 ? Math.exp(-land * 14) * Math.sin(land * 40) * 0.06 : 0;
  if (u < 1) {
    const e = ease.out(u);
    if (mode === 'drop') {
      const sc = 1 + (1 - e) * 0.9;
      ctx.save(); ctx.fillStyle = `rgba(20,10,5,${0.25 * e})`; ell(ctx, x + 8, y + 12, 60 * s * (1.4 - e * 0.4), 30 * s); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(u * 3); ctx.translate(x, y - (1 - e) * 120); ctx.scale(sc, sc); ctx.translate(-x, -y); drawItem(ctx, kind, x, y, s, rot + (1 - e) * 0.8); ctx.restore();
    } else {
      const side = idx % 2 ? -1 : 1, ox = side * 330 * (1 - e), oy = -430 * (1 - e);
      ctx.save(); ctx.fillStyle = `rgba(20,10,5,${0.2 * e})`; ell(ctx, x + 10, y + 14, 70 * s, 26 * s); ctx.fill(); ctx.restore();
      drawItem(ctx, kind, x + ox, y + oy, s * (1 + (1 - e) * 0.25), rot + (1 - e) * 0.4 * side);
      handAt(ctx, x + ox, y + oy, side, 1 + (1 - e) * 0.25, skin);
    }
    return;
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + sq, 1 - sq); ctx.translate(-x, -y); drawItem(ctx, kind, x, y, s, rot); ctx.restore();
  if (mode === 'hand' && land < 0.4) { const k = ease.in(land / 0.4), side = idx % 2 ? -1 : 1; handAt(ctx, x + side * 360 * k, y - 470 * k, side, 1 + k * 0.3, skin); }
}
// pinch hand + forearm in paper-local space; fingertip at (tx,ty). side 1 = from top-right, -1 = top-left
function handAt(ctx, tx, ty, side, sc, skin) {
  const sk = skin || SKIN_C, a = side > 0 ? 2.25 : PI_ - 2.25, hs = 1.25 * sc;
  const ca = Math.cos(a), sa = Math.sin(a);
  // pinch fingertip is at hand-local (76,-30): put wrist so that tip lands on (tx,ty)
  const fl = side < 0, lx = 76 * hs, ly = (fl ? 30 : -30) * hs;
  const wx = tx - (ca * lx - sa * ly), wy = ty - (sa * lx + ca * ly);
  const ex = wx - ca * 520, ey = wy - sa * 520;
  ctx.save(); ctx.fillStyle = 'rgba(15,8,4,0.25)'; ctx.beginPath(); NP.capPath(ctx, wx + 30, wy + 40, ex + 60, ey + 80, 40 * sc, 56 * sc); ctx.fill(); ctx.restore();
  capFS(ctx, wx, wy, ex, ey, 34 * sc, 46 * sc, lgr(ctx, wx, wy - 30, wx, wy + 30, [[0, sk[0]], [1, sk[1]]]), 2.4);
  if (skin === SKIN_T) capFS(ctx, lerp(wx, ex, 0.55), lerp(wy, ey, 0.55), ex, ey, 56 * sc, 64 * sc, '#2fa79c', 2.4);
  else capFS(ctx, lerp(wx, ex, 0.4), lerp(wy, ey, 0.4), ex, ey, 54 * sc, 62 * sc, lgr(ctx, wx, wy, ex, ey, [[0, COL.aobaL], [1, COL.aobaD]]), 2.4);
  NP.cHand(ctx, wx, wy, hs, a, { kind: 'pinch', skin: sk, flip: fl });
}
const PI_ = Math.PI;
function paperScene(ctx, T, o = {}) {
  drawDeck(ctx);
  at(ctx, PX, PY, 0, PS, PS, () => {
    NP.ricePaper(ctx, 0, 0, 1, { wet: 1 });
    for (let i = 0; i < ITEMS.length; i++) { if (ITEMS[i][0] - 0.5 > T) break; placeItem(ctx, T, ITEMS[i], i, o.mode && o.mode(ITEMS[i]) || 'hand'); }
    if (o.after) o.after(ctx);
  });
}
// warm light pass for the top-down set
function topLight(ctx, T, k = 1) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rgr(ctx, 1000, 120, 0, 1000, 120, 1100, [[0, `rgba(255,170,100,${0.38 * k})`], [1, 'rgba(255,170,100,0)']]); ctx.fillRect(0, 0, W, H);
  ctx.restore();
  godRays(ctx, 1150, -150, 2.3, 0.7, 2000, 7, 'rgba(255,200,140,0.5)', 0.1 * k, T);
  // out-of-focus foreground herbs at corners for depth
  ctx.save();
  for (const [x, y, rr, c] of [[-40, 1700, 260, '40,90,30'], [1110, 1850, 230, '60,120,40'], [-60, 120, 200, '70,40,60']]) {
    ctx.fillStyle = rgr(ctx, x, y, rr * 0.3, x, y, rr, [[0, `rgba(${c},0.85)`], [1, `rgba(${c},0)`]]); ctx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  ctx.restore();
  dust(ctx, T, 12, 20, 0, 0, W, 1400, '255,220,170', 2.5, 0.45);
}

// ---------------------------------------------------------------- s11 rau vườn (30.6–34.2) top-down, herbs on the beat
function s11(ctx, lt, p, T) {
  const z = lerp(1.0, 1.12, ease.inOut(p)), rot = lerp(-0.04, 0.02, p);
  cam(ctx, 540, lerp(860, 900, p), z, rot, () => {
    paperScene(ctx, T);
    // little water splash on each landing
    for (let i = 0; i < 5; i++) { const d = T - ITEMS[i][0]; if (d > 0 && d < 0.4) splashRing(ctx, PX + ITEMS[i][2] * PS, PY + ITEMS[i][3] * PS, d, 1); }
  });
  topLight(ctx, T);
  cap(ctx, T, lt, 3.6, 'Rau vườn', 'Garden herbs', 5);
}
function splashRing(ctx, x, y, d, s) {
  const k = d / 0.4;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = `rgba(255,240,220,${0.5 * (1 - k)})`; ctx.lineWidth = 4 * s * (1 - k) + 1;
  ell(ctx, x, y, (60 + k * 220) * s, (34 + k * 120) * s); ctx.stroke();
  const r = rng(Math.floor(x + y));
  for (let i = 0; i < 10; i++) { const a = r() * TAU, v = (140 + r() * 260) * s; ctx.fillStyle = `rgba(255,248,235,${0.8 * (1 - k)})`; ell(ctx, x + Math.cos(a) * v * k, y + Math.sin(a) * v * k * 0.7 - 80 * s * Math.sin(k * PI_), 4 * s, 4 * s); ctx.fill(); }
  ctx.restore();
}

// ---------------------------------------------------------------- s12 khế, chuối chát (34.2–37.2) macro on the slices
function s12(ctx, lt, p, T) {
  const z = lerp(2.05, 2.3, ease.inOut(p));
  const fx = PX + lerp(-70, 60, ease.inOut(p)) * PS, fy = PY + (BY + 8) * PS;
  cam(ctx, fx, fy, z, -0.06, () => {
    paperScene(ctx, T, { mode: it => (it[0] > 34.5 ? 'drop' : 'hand') });
  });
  // juicy sparkles on the slices when they land
  for (let i = 5; i < 11; i++) {
    const d = T - ITEMS[i][0];
    const sx = (PX + ITEMS[i][2] * PS - fx) * z + 540, sy = (PY + ITEMS[i][3] * PS - fy) * z + 960;
    if (d > 0 && d < 0.6) { L.sparkle(ctx, sx - 30, sy - 40, 0.8 + (1 - d) * 0.6, (1 - d / 0.6) * 0.9); splashRing(ctx, sx, sy + 20, d * 0.66, 1.4); }
    if (d > 0.6) L.sparkle(ctx, sx - 28, sy - 36, 0.5, 0.35 + 0.25 * Math.sin(T * 5 + i));
  }
  // shallow depth of field: soften top/bottom
  dofBands(ctx, 520, 1380);
  topLight(ctx, T, 0.8);
  cap(ctx, T, lt, 3.0, 'Khế, chuối chát', 'Star fruit & green banana', 6);
}
// fake depth of field: hazy gradient bands outside the focus strip
function dofBands(ctx, y0, y1) {
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, 0, 0, y0, [[0, 'rgba(40,22,18,0.55)'], [1, 'rgba(40,22,18,0)']]); ctx.fillRect(0, 0, W, y0);
  ctx.fillStyle = lgr(ctx, 0, y1, 0, H, [[0, 'rgba(40,22,18,0)'], [1, 'rgba(30,16,14,0.6)']]); ctx.fillRect(0, y1, W, H - y1);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lgr(ctx, 0, 0, 0, y0, [[0, 'rgba(255,170,120,0.22)'], [1, 'rgba(255,170,120,0)']]); ctx.fillRect(0, 0, W, y0);
  ctx.restore();
}

// ---------------------------------------------------------------- s13 đồ chua + ram giòn (37.2–40.8) close-up, ram snap
function s13(ctx, lt, p, T) {
  const z = lerp(1.45, 1.6, ease.inOut(p)), snapT = 39.6, kick = T > snapT ? Math.exp(-(T - snapT) * 10) * 10 : 0;
  cam(ctx, PX + Math.sin(T * 60) * kick * 0.4, PY + 80 + Math.cos(T * 70) * kick * 0.3, z, 0.03, () => {
    paperScene(ctx, T);
    // pickles falling in: a few loose sticks bounce
    // second ram snapped above the paper by two hands
    if (T > 39.1) snapRam(ctx, T, snapT);
  });
  // crumbs burst in screen space
  if (T > snapT) crumbs(ctx, T - snapT, 540, 800, 1.6);
  if (T > snapT && T < snapT + 0.25) glow(ctx, 540, 820, 380, 'rgba(255,220,150,1)', 0.5 * (1 - (T - snapT) / 0.25));
  topLight(ctx, T, 0.9);
  cap(ctx, T, lt, 3.6, 'Đồ chua + ram giòn', 'Pickles & crispy roll', 7);
}
function snapRam(ctx, T, snapT) {
  const inK = ease.out(iv(39.1, 39.5, T)), out = ease.in(iv(40.1, 40.6, T));
  const snap = ease.outExpo(iv(snapT, snapT + 0.18, T));
  const cx = PX, cy = PY - 40 - (1 - inK) * 800 - out * 1000, s = PS * 1.25;
  at(ctx, cx, cy, -0.05, 1, 1, () => {
    ctx.fillStyle = 'rgba(15,8,4,0.12)'; ell(ctx, 30, 150, 220, 26); ctx.fill();
    const ang = snap * 0.32, sep = snap * 26;
    for (const sd of [-1, 1]) {
      at(ctx, sd * sep, 0, sd * ang, 1, 1, () => {
        at(ctx, 0, 0, 0, s, s, () => {
          ctx.save(); ctx.beginPath(); ctx.rect(sd < 0 ? -90 : 0, -40, 90, 80); ctx.clip();
          NP.ramRoll(ctx, 0, 0, 1, 0, { seed: 8 }); ctx.restore();
          if (snap > 0) { ctx.fillStyle = '#f3d79a'; ctx.beginPath(); ctx.moveTo(0, -15); for (let k = 0; k <= 6; k++) ctx.lineTo(sd * (k % 2 ? 5 : 1), -15 + k * 5); ctx.lineTo(0, 15); ctx.closePath(); ctx.fill(); }
        });
        // hand gripping this end; mirror for the left side so the forearm leaves the frame sideways
        ctx.save(); ctx.scale(-sd, 1);
        const gx = -70 * s;               // end of the ram (local, mirrored)
        capFS(ctx, gx - 10, 20, gx - 700, 260, 64, 84, lgr(ctx, 0, -40, 0, 60, [[0, SKIN_C[0]], [1, SKIN_C[1]]]), 2.4);
        capFS(ctx, gx - 380, 140, gx - 760, 290, 100, 112, lgr(ctx, 0, 60, 0, 300, [[0, COL.aobaL], [1, COL.aobaD]]), 2.4);
        NP.cHand(ctx, gx - 30, 18, 2.6, -0.25, { kind: 'grip', skin: SKIN_C });
        ctx.restore();
      });
    }
  });
}

function crumbs(ctx, d, x, y, s) {
  const r = rng(55); ctx.save();
  for (let i = 0; i < 46; i++) {
    const a = -PI_ / 2 + (r() - 0.5) * 2.6, v = (300 + r() * 700) * s, rr = (3 + r() * 7) * s, sp = (r() - 0.5) * 20;
    const px = x + Math.cos(a) * v * d, py = y + Math.sin(a) * v * d + 0.5 * 2600 * d * d;
    if (py > 1300) continue;
    ctx.fillStyle = r() < 0.6 ? '#f1c871' : '#c27a2e';
    at(ctx, px, py, sp * d, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-rr, -rr * 0.5); ctx.lineTo(rr * 0.8, -rr * 0.7); ctx.lineTo(rr, rr * 0.6); ctx.lineTo(-rr * 0.6, rr * 0.7); ctx.closePath(); ctx.fill(); });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- s14 nem nóng (40.8–43.8) close-up slow-mo: nem slides off the skewer
function nemOnPaper(ctx, T, slow) { // paper-local; the nem lands at NEM_LAND then the stick is pulled out
  const mx = 0, my = BY - 4;
  const u = iv(40.8, NEM_LAND, T), e = ease.inOut(u);
  const pull = ease.inOut(iv(42.35, 43.5, T));
  const land = T - NEM_LAND, bounce = land > 0 ? Math.exp(-land * 8) * Math.sin(land * 22) * 0.05 : 0;
  const yy = my - (1 - e) * 340, sc = 0.9 * (1 + (1 - e) * 0.35);
  ctx.fillStyle = `rgba(20,10,5,${0.3 * e})`; ell(ctx, mx + 10, my + 18, 85, 22); ctx.fill();
  ctx.save(); ctx.translate(mx, yy); ctx.scale(1 + bounce, 1 - bounce); ctx.translate(-mx, -yy);
  NP.nemSkewer(ctx, mx, yy, sc, { cook: 0.9, stick: 0.01, t: slow, seed: 21, drip: false });
  const sx2 = lerp(0, 380, pull);
  if (pull < 1) capFS(ctx, -160 * sc + sx2, yy, 160 * sc + sx2, yy, 6 * sc, 5 * sc, COL.bamboo, 1.2);
  ctx.restore();
  return { x: mx + 160 * sc + sx2, y: yy, pull, sc };
}
function s14(ctx, lt, p, T) {
  const slow = 41 + lt * 0.35; // slow-mo time for steam / shimmer
  const z = lerp(2.0, 2.25, ease.inOut(p)), fx = PX, fy = PY + (BY - 4) * PS - lerp(40, 0, p);
  cam(ctx, fx, fy, z, 0.04, () => {
    paperScene(ctx, T, { after: (c) => {
      const n = nemOnPaper(c, T, slow);
      // hand pulling the stick from the right
      if (n.pull > 0 || T > NEM_LAND - 0.3) {
        const hx = n.x + 6, hy = n.y;
        const out = ease.in(iv(43.45, 43.8, T));
        at(c, hx + out * 200, hy, 0, 1, 1, () => {
          capFS(c, 40, 20, 520, 260, 34, 46, lgr(c, 0, 0, 0, 60, [[0, SKIN_C[0]], [1, SKIN_C[1]]]), 2.4);
          capFS(c, 230, 120, 560, 290, 54, 62, lgr(c, 0, 100, 0, 300, [[0, COL.aobaL], [1, COL.aobaD]]), 2.4);
          NP.cHand(c, 64, 26, 1.25, PI_ + 0.45, { kind: 'pinch', skin: SKIN_C });
        });
      }
      // heat: slow steam + shimmer glow
      NP.steamWisps(c, slow, 9, -70, BY - 20, 140, 260, { n: 6, alpha: 0.6, w: 9 });
    } });
  });
  // glow + embers drifting slowly (slow-mo)
  glow(ctx, 540, 900, 420, 'rgba(255,150,70,1)', 0.22 + 0.06 * Math.sin(T * 4));
  NP.embers(ctx, slow, 4, 16, 300, 860, 480, 120, { alpha: 0.7, speed: 0.6, size: 1.6, rise: 420 });
  if (T > NEM_LAND && T < NEM_LAND + 0.3) glow(ctx, 540, 930, 300, 'rgba(255,220,160,1)', 0.45 * (1 - (T - NEM_LAND) / 0.3));
  dofBands(ctx, 560, 1300);
  topLight(ctx, T, 0.8);
  cap(ctx, T, lt, 3.0, 'Nem nóng', 'Hot off the grill', 8);
}

// flat hand from the bottom of frame (vendor side), paper-local. fingertips at (tx,ty), fingers rotated by ang from straight up
function flatHand(ctx, tx, ty, sd, ang, sc = 1) {
  const a = -PI_ / 2 + ang, hs = 1.05 * sc, ca = Math.cos(a), sa = Math.sin(a);
  const wx = tx - ca * 52 * hs, wy = ty - sa * 52 * hs;
  const ex = wx - ca * 330 + sd * 70, ey = wy - sa * 330;
  ctx.save(); ctx.fillStyle = 'rgba(15,8,4,0.2)'; ctx.beginPath(); NP.capPath(ctx, wx + 14, wy + 22, ex + 24, ey + 30, 30, 40); ctx.fill(); ell(ctx, tx + 10, ty + 40, 40, 50); ctx.fill(); ctx.restore();
  capFS(ctx, wx, wy, ex, ey, 30, 40, lgr(ctx, wx - 30, 0, wx + 30, 0, [[0, SKIN_C[1]], [0.5, SKIN_C[0]], [1, SKIN_C[1]]]), 2.4);
  capFS(ctx, lerp(wx, ex, 0.45), lerp(wy, ey, 0.45), ex + sd * 20, ey + 120, 48, 56, lgr(ctx, wx - 50, 0, wx + 50, 0, [[0, COL.aobaD], [0.5, COL.aobaL], [1, COL.aobaD]]), 2.4);
  NP.cHand(ctx, wx, wy, hs, a, { kind: 'flat', skin: SKIN_C, flip: sd < 0 });
}
// ---------------------------------------------------------------- s15 cuốn chặt (43.8–47.4) rotating close-up, pats on the beat
function s15(ctx, lt, p, T) {
  // fold bottom 43.9–44.85 (0→.35), sides 44.85–45.2 (.35→.55), roll tight 45.2–45.8 (.55→1); hands ride the paper the whole time
  let roll;
  if (T < 44.85) roll = 0.35 * ease.inOut(iv(43.9, 44.85, T));
  else if (T < 45.2) roll = lerp(0.35, 0.55, ease.inOut(iv(44.85, 45.2, T)));
  else roll = lerp(0.55, 1, ease.inOut(iv(45.2, 45.8, T)));
  const done = roll >= 1;
  const reveal = ease.outBack(iv(45.8, 46.2, T));
  const z = lerp(1.3, 1.6, ease.inOut(iv(43.8, 45.8, T))) + reveal * 0.25, rot = lerp(-0.05, 0.3, ease.inOut(p));
  const f3 = clamp((roll - 0.55) / 0.45), rollY = lerp(BY + 40, -40, ease.inOut(f3));
  const fy = PY + lerp(BY, -40, ease.inOut(iv(44.6, 46.0, T))) * PS;
  const patOn = T > 46.15, pk = patOn ? hitK(T) : 0;
  cam(ctx, PX, fy, z, rot, () => {
    drawDeck(ctx);
    at(ctx, PX, PY, 0, PS, PS, () => {
      if (!done) {
        NP.rollAssembly(ctx, 0, 0, 1, { layers: 5, roll, t: 41 + lt * 0.4, wet: 1 });
      } else {
        ctx.save(); ctx.translate(0, -40); ctx.scale(1 + pk * 0.05, 1 - pk * 0.08); ctx.translate(0, 40);
        NP.nemRoll(ctx, 0, -40, 0.85, 0, { seed: 9 });
        ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,240,220,0.6)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-95, -70); ctx.quadraticCurveTo(0, -78, 95, -70); ctx.stroke();
        ctx.restore();
      }
      const show = 1 - ease.in(iv(46.9, 47.35, T));
      if (show > 0) for (const sd of [-1, 1]) {
        let tx, ty, ang;
        if (roll < 0.35) { tx = sd * 75; ty = 100 + 70 * Math.cos(Math.PI * roll / 0.35) + 14; ang = -sd * 0.12; }          // push the bottom edge up
        else if (roll < 0.55) { const k = (roll - 0.35) / 0.2; tx = sd * lerp(172, 118, k); ty = lerp(70, 50, k); ang = -sd * lerp(0.4, 0.9, k); } // tuck the sides
        else if (!done) { tx = sd * 62; ty = rollY + 34; ang = -sd * 0.1; }                                   // roll it forward
        else { tx = sd * 62; ty = -40 + 36 - (patOn ? (1 - pk) * 30 : 0); ang = -sd * 0.08; }                // pat
        flatHand(ctx, tx, ty + (1 - show) * 420, sd, ang, 1);
      }
    });
    if (patOn) { const d = beat(T) * 0.6; if (d < 0.3) splashRing(ctx, PX, PY - 40 * PS, d, 0.8); }
  });
  if (T > 45.8 && T < 46.2) glow(ctx, 540, 900, 500, 'rgba(255,225,170,1)', 0.35 * (1 - iv(45.8, 46.2, T)));
  topLight(ctx, T, 0.85);
  cap(ctx, T, lt, 3.6, 'Cuốn chặt', 'Roll it tight', 9);
}


// ---------------------------------------------------------------- macro sauce set (s16, s17, s19)
const BX = 540, BYY = 1000;
function surf(fill, S, by = BYY) { const R = 110; return { y: by + ((1 - fill) * 26 + 4) * S, r: (R - 10) * (0.7 + 0.3 * fill) * S, ry: 0.42 }; }
function gao(ctx, x, y, s, tilt) { // coconut-shell ladle with bamboo handle
  at(ctx, x, y, tilt, s, s, () => {
    capFS(ctx, 60, -10, 420, -60, 22, 18, lgr(ctx, 0, -20, 0, 10, [[0, COL.bambooL], [1, COL.bambooD]]), 2);
    ctx.beginPath(); ctx.ellipse(0, 0, 95, 80, 0, -0.1, PI_ + 0.1); ctx.closePath();
    ctx.fillStyle = rgr(ctx, -30, 10, 5, 0, 10, 110, [[0, '#9a6036'], [0.6, '#5e3518'], [1, '#2e170a']]); ctx.fill();
    ctx.strokeStyle = 'rgba(30,14,6,0.7)'; ctx.lineWidth = 3; ctx.stroke();
    ell(ctx, 0, 0, 95, 22); ctx.fillStyle = COL.sauce; ctx.fill(); ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 6; ctx.stroke();
    NP.rimLine(ctx, () => ctx.ellipse(0, 0, 95, 80, 0, 0.1, 1.3), 'rgba(255,200,140,0.8)', 4);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,220,170,0.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(0, 0, 40 + k * 9, 0.4 + k * 0.1, 1.2 + k * 0.1); ctx.stroke(); } ctx.restore();
  });
}
function droplets(ctx, d, x, y, s, seed, col) {
  if (d <= 0 || d > 0.7) return;
  const r = rng(seed); ctx.save();
  for (let i = 0; i < 12; i++) {
    const a = -PI_ / 2 + (r() - 0.5) * 2.2, v = (200 + r() * 360) * s, rr = (5 + r() * 8) * s;
    const px = x + Math.cos(a) * v * d, py = y + Math.sin(a) * v * d * 0.9 + 0.5 * 1800 * s * d * d;
    if (py > y + 10) continue;
    ctx.fillStyle = col || COL.sauce; ell(ctx, px, py, rr, rr * 1.15); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,0.75)'; ell(ctx, px - rr * 0.35, py - rr * 0.35, rr * 0.3, rr * 0.25); ctx.fill();
  }
  ctx.restore();
}
function rings(ctx, T, x, y, rmax, ry, k) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { const ph = (T * 0.9 + i / 3) % 1, rr = 20 + ph * rmax; ctx.strokeStyle = `rgba(255,215,160,${0.45 * (1 - ph) * k})`; ell(ctx, x, y, rr, rr * ry); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- s16 nước chấm Cái Răng (47.4–50.4) macro slow-mo pour
function s16(ctx, lt, p, T) {
  const slow = 48 + lt * 0.4;
  const S = lerp(3.15, 3.4, ease.inOut(p));
  const fill = lerp(0.12, 0.88, ease.inOut(iv(0.2, 2.8, lt)));
  const sf = surf(fill, S);
  macroBack(ctx, T, { pan: -p * 40, table: 1150, sunX: 780, sunY: 820 });
  NP.sauceBowl(ctx, BX, BYY, S, { fill, slosh: 1, t: slow, seed: 3 });
  // stream from the ladle
  const tilt = lerp(-0.25, 0.42, ease.out(iv(0, 0.5, lt))) - ease.in(iv(2.4, 3.0, lt)) * 0.45;
  const gx = 700, gy = 260 + Math.sin(slow * 2) * 6;
  const lipX = gx - Math.cos(tilt) * 95 * 1.3, lipY = gy - Math.sin(tilt) * 95 * 1.3 + 10;
  const flow = clamp(iv(0.25, 0.6, lt)) * (1 - iv(2.45, 2.85, lt));
  const reach = ease.in(iv(0.25, 0.75, lt));
  if (flow > 0.02) {
    glow(ctx, sf.r * 0 + BX, (lipY + sf.y) / 2, 260, 'rgba(255,140,60,1)', 0.15);
    NP.sauceStream(ctx, lipX, lipY, BX + 10, sf.y, slow, { w: 40 * flow + 6, k: reach });
    if (reach >= 1) rings(ctx, slow * 2, BX + 10, sf.y, sf.r * 0.9, 0.42, flow);
  }
  if (lt > 0.7 && lt < 2.6) droplets(ctx, ((lt - 0.7) % 0.6) / 0.6 * 0.6, BX + 10, sf.y, 1.4, 3 + Math.floor((lt - 0.7) / 0.6), COL.sauce);
  gao(ctx, gx, gy, 1.3, PI_ + tilt);
  // slow steam off the warm sauce
  NP.steamWisps(ctx, slow, 17, BX - 160, sf.y - 10, 320, 380, { n: 5, alpha: 0.35, w: 14 });
  L.flare(ctx, 780, 820, 0.8, 0.35);
  dust(ctx, slow, 23, 22, 0, 200, W, 1100, '255,214,160', 3, 0.55);
  cap(ctx, T, lt, 3.0, 'Nước chấm Cái Răng', 'The famous orange sauce', 10);
}

// ---------------------------------------------------------------- s17 đậu phộng, tỏi ớt (50.4–54.0) macro, toppings on the beat
function spoon(ctx, x, y, s, tilt, col) {
  at(ctx, x, y, tilt, s, s, () => {
    capFS(ctx, 50, -4, 330, -40, 16, 12, lgr(ctx, 0, -20, 0, 10, [[0, '#f4f6f8'], [1, '#8f9aa6']]), 2);
    ell(ctx, 0, 0, 62, 34); ctx.fillStyle = lgr(ctx, 0, -34, 0, 34, [[0, '#ffffff'], [1, '#9aa6b2']]); ctx.fill(); ctx.strokeStyle = 'rgba(60,70,90,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ell(ctx, -4, -4, 48, 22); ctx.fillStyle = col; ctx.fill();
    NP.rimLine(ctx, () => ctx.ellipse(0, 0, 62, 34, 0, PI_, PI_ * 1.6), 'rgba(255,230,190,0.9)', 3);
  });
}
const TOPS = [[51.0, 'peanut', '#d9b77a', 'peanuts'], [52.2, 'scallion', '#4a9a3a', 'scallionOil'], [53.4, 'chili', '#c9301e', 'chiliGarlic']];
function s17(ctx, lt, p, T) {
  const S = lerp(3.4, 3.75, ease.inOut(p)), fill = 0.88, sf = surf(fill, S, BYY + 20);
  const amt = {}; for (const [tl, , , key] of TOPS) amt[key] = ease.out(iv(tl, tl + 0.55, T));
  macroBack(ctx, T, { pan: -40 - p * 40, table: 1170, sunX: 760, sunY: 830, seed: 6 });
  NP.sauceBowl(ctx, BX, BYY + 20, S, { fill, slosh: 0.3 + hitK(T) * 0.6, t: T, seed: 3, peanuts: amt.peanuts, scallionOil: amt.scallionOil, chiliGarlic: amt.chiliGarlic });
  const fallT = 0.62, g = 2 * (sf.y - 470) / (fallT * fallT);
  TOPS.forEach(([tl, kind, col], i) => {
    const t0 = tl - fallT;
    // spoon tips in from the top
    const vis = iv(t0 - 0.3, t0 - 0.05, T) * (1 - iv(tl - 0.3, tl + 0.1, T));
    if (vis > 0) spoon(ctx, 560 + (1 - vis) * 520, 400 - (1 - vis) * 120, 1.4, lerp(-0.1, 0.55, iv(t0 - 0.15, t0 + 0.1, T)) + PI_ * 0, col);
    if (T > t0 && T < tl + 0.6) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, sf.y + 2); ctx.clip();
      NP.toppingFall(ctx, T, t0, 90 + i, kind === 'scallion' ? 30 : 40, 520, 450, { kind, w: 150, g, floor: sf.y + 30, spread: 0.35, size: 2.6 });
      ctx.restore();
    }
    droplets(ctx, T - tl, BX - 10, sf.y, 1.2, 40 + i, COL.sauce);
    if (T > tl && T < tl + 0.2) glow(ctx, BX, sf.y, 300, 'rgba(255,210,150,1)', 0.35 * (1 - (T - tl) / 0.2));
  });
  NP.steamWisps(ctx, T * 0.6, 27, BX - 170, sf.y - 10, 340, 360, { n: 4, alpha: 0.3, w: 14 });
  L.flare(ctx, 760, 830, 0.7, 0.3);
  dust(ctx, T, 29, 20, 0, 200, W, 1100, '255,214,160', 3, 0.5);
  cap(ctx, T, lt, 3.6, 'Đậu phộng, tỏi ớt', 'Peanuts & chili garlic', 11);
}

// richer cross-section painted over NP.nemRollCut's face (screen-space centre x,y, outer radius R)
function cutFace(ctx, x, y, R, seed, bl) {
  const r = rng(seed);
  at(ctx, x, y, 0, R / 100, R / 100, () => {
    ell(ctx, 0, 0, 100, 100); ctx.fillStyle = 'rgba(246,238,222,0.97)'; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 100, 100); ctx.clip();
    // lettuce band (frilly)
    ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, rr = 88 + Math.sin(i * 2.3) * 3 + (i % 2) * 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
    ctx.fillStyle = rgr(ctx, 0, 0, 40, 0, 0, 92, [[0, '#d6ef9a'], [0.7, '#a8d860'], [1, '#6fae3c']]); ctx.fill();
    // herb leaves (basil dark green, tia to purple) as folded wedges
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, d = 50 + r() * 22, c = ['#2f7a2c', '#3e8f35', '#6b2f6a', '#4f9a3a'][i % 4];
      at(ctx, Math.cos(a) * d, Math.sin(a) * d, a + PI_ / 2, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -12, 22, 0); ctx.quadraticCurveTo(0, 6, -22, 0); ctx.fillStyle = c; ctx.fill(); });
    }
    ell(ctx, 0, 4, 64, 60); ctx.fillStyle = '#e9e2c8'; ctx.fill();
    // nem slice: charred edge, pink-brown meat with fat specks
    at(ctx, -14, -16, -0.2, 1, 1, () => {
      ell(ctx, 0, 0, 40, 30); ctx.fillStyle = '#5a2412'; ctx.fill();
      ell(ctx, 0, 0, 35, 25); ctx.fillStyle = rgr(ctx, -8, -8, 2, 0, 0, 36, [[0, '#f0a184'], [0.6, '#c8674a'], [1, '#8f3b22']]); ctx.fill();
      for (let k = 0; k < 18; k++) { ctx.fillStyle = k % 3 ? 'rgba(255,225,205,0.8)' : 'rgba(120,40,20,0.6)'; ell(ctx, (r() - 0.5) * 54, (r() - 0.5) * 36, 1.6 + r() * 2, 1.3 + r() * 1.5); ctx.fill(); }
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,230,200,0.55)'; ell(ctx, -12, -12, 12, 5, -0.3); ctx.fill(); ctx.restore();
    });
    // ram slice: golden ring with lattice
    at(ctx, 26, 28, 0, 1, 1, () => {
      ell(ctx, 0, 0, 26, 26); ctx.fillStyle = '#c98a2e'; ctx.fill();
      ell(ctx, 0, 0, 22, 22); ctx.fillStyle = '#f2c56a'; ctx.fill();
      ctx.strokeStyle = 'rgba(150,85,20,0.8)'; ctx.lineWidth = 2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 0, 6 + k * 5, k, k + 4.6); ctx.stroke(); }
      for (let k = 0; k < 8; k++) { ctx.fillStyle = 'rgba(255,240,200,0.9)'; ell(ctx, (r() - 0.5) * 34, (r() - 0.5) * 34, 2, 1.6); ctx.fill(); }
    });
    // carrot / daikon ends, starfruit, cucumber, green banana
    for (let k = 0; k < 10; k++) { const a = r() * TAU, d = 18 + r() * 40; ctx.fillStyle = k % 2 ? '#f08a2c' : '#fbf6ea'; at(ctx, Math.cos(a) * d, Math.sin(a) * d, r() * 3, 1, 1, () => ctx.fillRect(-4, -3, 8, 6)); }
    at(ctx, -40, 30, 0.4, 1, 1, () => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? 7 : 16; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = '#f2e27a'; ctx.fill(); ctx.strokeStyle = '#c9b24a'; ctx.lineWidth = 1.5; ctx.stroke(); });
    ell(ctx, 44, -10, 12, 12); ctx.fillStyle = '#5c9e3c'; ctx.fill(); ell(ctx, 44, -10, 9, 9); ctx.fillStyle = '#cfe8a4'; ctx.fill();
    ell(ctx, 2, 40, 10, 10); ctx.fillStyle = '#e8e3b8'; ctx.fill(); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#6b5a3a'; ell(ctx, 2 + Math.cos(k * 1.6) * 4, 40 + Math.sin(k * 1.6) * 4, 1.2, 1.2); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,252,240,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 97, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,205,180,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 92, 0.3, 5.5); ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < 6; k++) { ctx.fillStyle = 'rgba(255,255,245,0.7)'; ell(ctx, (r() - 0.5) * 120, (r() - 0.5) * 120, 3, 2); ctx.fill(); }
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 100, PI_ * 1.05, PI_ * 1.9);
    for (const [lw, al] of [[22, 0.18], [12, 0.3], [5, 0.6]]) { ctx.strokeStyle = `rgba(255,214,150,${al * bl})`; ctx.lineWidth = lw; ctx.stroke(); }
    ctx.restore();
  });
}
// ---------------------------------------------------------------- s18 cross-section, backlit sunrise (54.0–57.0), no text
function s18(ctx, lt, p, T) {
  const slow = 54 + lt * 0.35;
  const sx = 610, sy = 640 - p * 20;
  macroBack(ctx, T, { pan: -80 + p * 60, table: 1130, sunX: sx, sunY: sy, seed: 7 });
  NP.sun(ctx, sx, sy, 1.2, { rays: 1, t: slow });
  const sep = ease.out(iv(0.1, 1.8, lt));
  const z = lerp(1.3, 1.42, ease.inOut(p)), rot = lerp(-0.02, 0.02, p);
  cam(ctx, 515, 840, z * 1.08, rot, () => {
    at(ctx, 560, 1150, -0.04, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-660, 10); ctx.quadraticCurveTo(0, -60, 660, -20); ctx.lineTo(660, 90); ctx.quadraticCurveTo(0, 50, -660, 110); ctx.closePath(); ctx.fillStyle = lgr(ctx, 0, -40, 0, 100, [[0, '#7cbb4e'], [1, '#2a5a24']]); ctx.fill(); ctx.strokeStyle = 'rgba(220,240,170,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-660, 50); ctx.quadraticCurveTo(0, 0, 660, 30); ctx.stroke(); });
    // back piece (behind, hazed by the sun)
    const bx = 700 + sep * 30, byy = 860 - sep * 6, bs = 2.05;
    ctx.fillStyle = 'rgba(30,14,8,0.35)'; ell(ctx, bx + 200, byy + 100 * bs * 0.5 + 6, 300, 18); ctx.fill();
    NP.nemRollCut(ctx, bx, byy, bs, { len: 150, backlight: 1, rot: 0, seed: 15 });
    cutFace(ctx, bx, byy, 52 * bs, 7, 1);
    glow(ctx, bx, byy - 40, 260, 'rgba(255,190,140,1)', 0.28);
    // front hero piece
    const fx = 320 - sep * 40, fyy = 1010, fs = 3.0;
    ctx.fillStyle = 'rgba(30,14,8,0.45)'; ell(ctx, fx + 260, fyy + 150, 420, 24); ctx.fill();
    NP.nemRollCut(ctx, fx, fyy, fs, { len: 170, backlight: 1, rot: 0, seed: 14 });
    cutFace(ctx, fx, fyy, 52 * fs, 3, 1);
  });
  const kv = iv(0, 0.6, lt);
  if (kv < 1) knife(ctx, 470 + kv * 30, 1000 - ease.in(kv) * 1400, kv);
  NP.steamWisps(ctx, slow, 33, 220, 900, 240, 460, { n: 5, alpha: 0.45, w: 12 });
  L.flare(ctx, sx, sy, 1.1, 0.5 + 0.1 * Math.sin(slow * 3));
  dust(ctx, slow, 61, 40, 0, 300, W, 1100, '255,220,170', 3.5, 0.7);
}
function knife(ctx, x, y, k) {
  at(ctx, x, y, 0.06, 1, 1, () => {
    capFS(ctx, 20, -640, 20, -900, 34, 30, lgr(ctx, -20, 0, 60, 0, [[0, '#3e2414'], [0.5, '#7a4a2a'], [1, '#3e2414']]), 2);
    ctx.beginPath(); ctx.moveTo(-50, -640); ctx.lineTo(80, -640); ctx.lineTo(80, -40); ctx.quadraticCurveTo(70, 40, -50, 70); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -50, 0, 80, 0, [[0, '#4a525c'], [0.45, '#a9b4bf'], [0.6, '#e6edf2'], [1, '#7d8893']]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,190,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-50, -640); ctx.lineTo(-50, 70); ctx.stroke();
    glow(ctx, -50, 20, 140, 'rgba(255,230,190,1)', 0.7 * (1 - k));
  });
  L.sparkle(ctx, x - 40, y - 60, 1.2, 0.9 * (1 - k));
}


// ---------------------------------------------------------------- s19 chấm đẫm (57.0–60.0) dip deep, slow lift with a drip
function s19(ctx, lt, p, T) {
  const slow = 57 + lt * 0.5;
  const S = 3.0, by = 1040, fill = 0.88, sf = surf(fill, S, by);
  macroBack(ctx, T, { pan: -20 - p * 30, table: 1180, sunX: 640, sunY: 700, seed: 8 });
  godRays(ctx, 640, 700, PI_ / 2, 2.4, 1700, 10, 'rgba(255,200,140,0.5)', 0.12, slow);
  NP.sauceBowl(ctx, BX, by, S, { fill, slosh: 0.2, t: slow, seed: 3, peanuts: 1, scallionOil: 1, chiliGarlic: 1 });
  // roll motion: down 0–1.0, swirl 1.0–1.3, slow lift 1.3–3.0
  const rr = 1.15, rs = 1.75, half = 135 * rs, ca = Math.cos(rr), sa = Math.sin(rr);
  const down = ease.inOut(iv(0, 1.0, lt)), up = ease.inOut(iv(1.3, 3.0, lt));
  const depth = lerp(-300, 70, down) - up * 420;      // tip y relative to surface
  const tipX = BX + 30 + Math.sin(iv(1.0, 1.3, lt) * PI_) * 14, tipY = sf.y + depth;
  const cx = tipX - ca * half, cy = tipY - sa * half;
  const coat = clamp(Math.min(70, (lt < 1.3 ? depth : 70)) + 40, 0, 110) / rs * (lt > 0.5 ? 1 : clamp((depth + 40) / 110));
  // roll (hidden below the surface line while dipped)
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(BX - sf.r, sf.y, sf.r * 2, 400); ctx.clip('evenodd');
  at(ctx, cx, cy, rr, rs, rs, () => {
    NP.nemRoll(ctx, 0, 0, 1, 0, { seed: 9 });
    if (coat > 0) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(-135, -43, 270, 86, 43); ctx.clip();
      const x0 = 135 - coat;
      ctx.beginPath(); ctx.moveTo(x0, -50); for (let k = 0; k <= 8; k++) ctx.lineTo(x0 + Math.sin(k * 1.7 + 2) * 6 - 4, -50 + k * 12.5); ctx.lineTo(150, 50); ctx.lineTo(150, -50); ctx.closePath();
      ctx.fillStyle = lgr(ctx, 0, -43, 0, 43, [[0, COL.sauceL], [0.5, COL.sauce], [1, COL.sauceD]]); ctx.fill();
      const r = rng(5); for (let k = 0; k < 16; k++) { ctx.fillStyle = ['#e9cf9a', '#c9301e', '#4a9a3a'][k % 3]; ell(ctx, x0 + 8 + r() * (coat - 10), (r() - 0.5) * 70, 3.2, 2.2, r() * 3); ctx.fill(); }
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,235,200,0.6)'; ell(ctx, x0 + coat * 0.5, -26, coat * 0.4, 5); ctx.fill();
      ctx.restore();
    }
  });
  ctx.restore();
  // fingers gripping the top end
  const gx = cx - ca * half * 0.82, gy = cy - sa * half * 0.82;
  capFS(ctx, gx - 30, gy - 40, gx - 360, gy - 620, 70, 90, lgr(ctx, gx, gy - 300, gx + 80, gy - 300, [[0, SKIN_C[1]], [1, SKIN_C[0]]]), 2.4);
  capFS(ctx, gx - 170, gy - 300, gx - 420, gy - 720, 106, 118, lgr(ctx, gx, 0, gx + 100, 0, [[0, COL.aobaD], [1, COL.aobaL]]), 2.4);
  NP.cHand(ctx, gx - 40, gy - 60, 2.5, rr - 0.3, { kind: 'grip', skin: SKIN_C });
  // entry meniscus + rings while dipped
  if (depth > -10) {
    const k = clamp((depth + 10) / 40);
    ctx.fillStyle = COL.sauce; ell(ctx, tipX - ca * Math.max(0, depth) / sa * 0.4, sf.y, 60 * k + 10, 16 * k + 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,180,0.6)'; ell(ctx, tipX - 20, sf.y - 5, 30 * k, 4); ctx.fill();
    rings(ctx, slow * 1.5, tipX, sf.y, sf.r * 0.8, 0.42, k);
  }
  // drip from the tip while lifting
  if (lt > 1.35 && depth < -10) {
    const age = lt - 1.35, cyc = age % 0.9, len = Math.min(-depth - 6, 40 + cyc * 260);
    const w0 = 22;
    ctx.save();
    ctx.fillStyle = lgr(ctx, tipX - 20, 0, tipX + 20, 0, [[0, COL.sauceD], [0.4, COL.sauce], [1, COL.sauceD]]);
    ctx.beginPath(); ctx.moveTo(tipX - w0, tipY - 10); ctx.quadraticCurveTo(tipX - 4, tipY + len * 0.4, tipX - 3, tipY + len); ctx.lineTo(tipX + 3, tipY + len); ctx.quadraticCurveTo(tipX + 4, tipY + len * 0.4, tipX + w0, tipY - 10); ctx.closePath(); ctx.fill();
    ell(ctx, tipX, tipY + len + 10, 14, 18); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,200,0.75)'; ell(ctx, tipX - 5, tipY + len + 4, 4, 6); ctx.fill();
    // detached drop falling
    if (age > 0.9) { const fy = tipY + len + 30 + cyc * cyc * 1600; if (fy < sf.y) { ctx.fillStyle = COL.sauce; ell(ctx, tipX, fy, 13, 17); ctx.fill(); } else droplets(ctx, (fy - sf.y) / 1600, tipX, sf.y, 0.8, 70 + Math.floor(age / 0.9), COL.sauce); }
    ctx.restore();
  }
  NP.steamWisps(ctx, slow, 44, BX - 140, sf.y - 10, 280, 360, { n: 4, alpha: 0.3, w: 14 });
  L.flare(ctx, 640, 700, 0.9, 0.45);
  dust(ctx, slow, 81, 26, 0, 200, W, 1100, '255,214,160', 3, 0.6);
  cap(ctx, T, lt, 3.0, 'Chấm đẫm!', 'Dip it deep!', 12);
}

// ---------------------------------------------------------------- s20 cuốn kiểu Mỹ (60.0–63.0): burrito build insert → tourist with the giant roll
const GIANT = [
  [60.0, (c) => { NP.herb(c, 'lettuce', -60, 40, 1.6, 0.1); NP.herb(c, 'lettuce', 60, 50, 1.6, -0.1); NP.herb(c, 'lettuce', 0, 20, 1.7, 0.05); }],
  [60.3, (c) => { NP.herb(c, 'basil', -70, 20, 1.3, 0.2); NP.herb(c, 'tiato', 50, 10, 1.3, -0.2); NP.herb(c, 'diepca', 0, 0, 1.3, 0); NP.herb(c, 'basil', 80, 40, 1.2, -0.5); }],
  [60.6, (c) => { for (let k = 0; k < 3; k++) NP.nemSkewer(c, 0, 10 + k * 26 - 26, 1.05, { cook: 0.9, stick: 0.01, seed: 40 + k, drip: false, rot: (k - 1) * 0.05 }); }],
  [60.9, (c) => { NP.ramRoll(c, -10, 50, 1.4, 0.05, { seed: 3 }); for (let k = 0; k < 4; k++) NP.herb(c, 'starfruit', -90 + k * 60, -30, 0.7, k); NP.herb(c, 'carrot', -60, 60, 1.2, 0.1); NP.herb(c, 'daikon', 70, 64, 1.2, -0.1); }],
];
function s20(ctx, lt, p, T) {
  if (T < 61.2) {
    // insert: top-down, the tourist piles everything on two overlapping rice papers (comically huge)
    const z = 1.05 + hitK(T) * 0.03;
    cam(ctx, 540, 900, z, 0.05, () => {
      drawDeck(ctx);
      at(ctx, 540, 860, 0, 1.5, 1.5, () => {
        NP.ricePaper(ctx, -120, 10, 1.5, { wet: 1 }); NP.ricePaper(ctx, 120, -10, 1.5, { wet: 1, rot: 1 });
        GIANT.forEach(([tl, fn], i) => {
          const u = iv(tl - 0.22, tl, T); if (u <= 0) return;
          const e = ease.out(u), sc = 1.4 * (1 + (1 - e) * 0.6), land = T - tl, sq = land > 0 ? Math.exp(-land * 14) * Math.sin(land * 40) * 0.08 : 0;
          ctx.save(); ctx.globalAlpha = clamp(u * 3); ctx.translate(0, -(1 - e) * 200); ctx.scale(sc * (1 + sq), sc * (1 - sq)); fn(ctx); ctx.restore();
          if (land > 0 && land < 0.3) { ctx.save(); ctx.scale(1 / 1.5, 1 / 1.5); splashRing(ctx, 0, 40, land, 1.2); ctx.restore(); }
        });
      });
      // tourist hands (teal sleeves) pushing the pile together from the bottom
      for (const sd of [-1, 1]) {
        const push = hitK(T) * 30;
        const wx = 540 + sd * (330 - push), wy = 1260 - push * 0.5;
        capFS(ctx, wx, wy, wx + sd * 260, wy + 640, 74, 96, lgr(ctx, wx, wy, wx + 60, wy, [[0, SKIN_T[0]], [1, SKIN_T[1]]]), 2.4);
        capFS(ctx, wx + sd * 150, wy + 360, wx + sd * 300, wy + 700, 120, 130, '#2fa79c', 2.4);
        NP.cHand(ctx, wx, wy, 2.6, -PI_ / 2 - sd * 0.45, { kind: 'open', skin: SKIN_T, flip: sd > 0 });
      }
    });
    topLight(ctx, T, 0.8);
  } else {
    // medium shot: tourist in the xuồng holds up the burrito-size roll, sunrise behind
    const k = lt - 1.2, bob = Math.sin(T * TAU / 2.4) * 6 + (1 - beat(T + 0.3)) * 2;
    const z = lerp(1.42, 1.5, ease.out(clamp(k / 1.8)));
    camSafe(ctx, 600, 1230 - bob * 0.3, z, Math.sin(T * 0.9) * 0.01, () => {
      NP.riverSide(ctx, T, 40 + k * 18, { horizon: 980, sunX: 760, sunY: 760, rays: 1, mist: 0.6, fgY: 9999 });
      const xb = 520, yb = 1660 + bob, sb = 1.05;
      const rx = U(ctx, NP.xuongBaLa(ctx, xb, yb, sb, { t: T, part: 'back' }));
      const lift = ease.outBack(clamp(k / 0.6));
      NP.tourist(ctx, xb + 90 * sb, rx.deck[1], 1.45, { pose: 'rollBig', t: T, rollS: 0.5 + 0.02 * lift, expr: k > 0.9 ? 'bliss' : 'wow',
        rollFn: (c, x, y) => { c.save(); c.translate(0, -lift * 30); NP.giantRoll(c, x, y, 0.5, -0.04 + Math.sin(T * 3) * 0.02, { t: T, tie: true }); c.restore(); } });
      NP.xuongBaLa(ctx, xb, yb, sb, { t: T, part: 'front' });
    });
    if (k < 0.25) glow(ctx, 540, 960, 900, 'rgba(255,230,190,1)', 0.5 * (1 - k / 0.25));
    L.sparkle(ctx, 380, 1170, 1.1, 0.5 + 0.4 * Math.sin(T * 6));
    L.sparkle(ctx, 720, 1120, 0.8, 0.5 + 0.4 * Math.cos(T * 5));
  }
  X.line(ctx, T, 60.25, 62.9, 'Cuốn kiểu Mỹ!', 'American size!', { y: 380 });
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20 };
