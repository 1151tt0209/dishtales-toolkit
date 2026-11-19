'use strict';
// shotsB.js — Bánh bò nướng lá dứa (writer B): s1 hook, s7 unmould, s8 cut, s9 gag 2, s10 THE TEAR, s11 lift, s12 bite,
// s13 farewell, s14 CTA. Each sN(ctx, lt, p, T) paints the full opaque 1080×1920 frame; render.js adds grade/flash/grain,
// overlay.js adds all text. The cake (dome, honeycomb, strands, pieces, hands) lives in bb_cake.js.
const BX = require('./bxprops');
const NP = BX.NP;
const L = require('./lib');
const PE = require('./people');
const C = require('./bb_cake');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const { Path2D } = require('@napi-rs/canvas');
const PI = Math.PI;
const BEAT = 60 / 104;
const iv = (a, b, v) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const spring = (t, f = 3, d = 5) => (t > 0 ? Math.exp(-d * t) * Math.sin(TAU * f * t) : 0);
const cam = (ctx, cx, cy, z, rot, fn) => L.cam(ctx, clamp(cx, 540 / z, W - 540 / z), clamp(cy, 960 / z, H - 960 / z), z, rot, fn);
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const lgr = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const rgr = (ctx, x0, y0, r0, x1, y1, r1, st) => { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const P = require('./bb_prep');
const CO_PAL = P.PURPLE; // Cô Út's purple áo bà ba, same as writer A's shots
const CO_SKIN = NP.COL ? NP.COL.skin : ['#f3c7a2', '#d99a74', '#b27255'];
const TSKIN = PE.SKIN;

// ============================================================================================ caches
const CACHE = {};
function cached(key, w, h, fn) { if (!CACHE[key]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[key] = c; } return CACHE[key]; }
function blurOf(src, px) { const c = createCanvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; return c; }
const SUNP = { gold: [700, 760], sunset: [560, 900], dusk: [560, 930] };
function plate(name) { // blurred riverside plate behind the stall
  return cached('pl_' + name, W, H, (x) => {
    const t = createCanvas(W, H), tx = t.getContext('2d');
    if (name === 'gold') BX.riversideScene(tx, 12, { dusk: 0.05, horizon: 1000, sun: SUNP.gold, sunS: 1.3, flare: 0, house: { x: 160, y: 1170, s: 0.72 }, garden: false });
    else BX.riversideScene(tx, 30, { dusk: name === 'dusk' ? 0.62 : 0.42, horizon: 1000, sun: SUNP[name], sunS: 1.5, flare: 0, house: { x: 900, y: 1170, s: 0.7 }, garden: false });
    x.drawImage(blurOf(t, name === 'gold' ? 14 : 9), 0, 0);
    if (name === 'gold') {
      x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,176,70,0.8)'; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = lgr(x, 0, 0, 0, H, [[0, 'rgba(255,214,170,1)'], [0.5, 'rgba(255,236,200,1)'], [1, 'rgba(255,255,255,1)']]); x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'source-over';
    }
  });
}
function stallBg() { // gold plate + out-of-focus thatch eave + bamboo posts + hanging pandan bundle (all pre-blurred)
  return cached('stallBg', W, H, (x) => {
    const t = createCanvas(W, H), tx = t.getContext('2d');
    tx.drawImage(plate('gold'), 0, 0);
    // posts
    for (const [px, w] of [[70, 46], [1010, 52]]) { tx.fillStyle = lgr(tx, px - w / 2, 0, px + w / 2, 0, [[0, '#4a3016'], [0.4, '#9a7038'], [1, '#3a240f']]); tx.fillRect(px - w / 2, 0, w, H); tx.fillStyle = 'rgba(40,24,8,0.6)'; for (let y = 120; y < H; y += 260) tx.fillRect(px - w / 2, y, w, 10); }
    // thatch eave
    tx.fillStyle = lgr(tx, 0, 0, 0, 330, [[0, '#2a1a0c'], [0.75, '#5a3c1c'], [1, '#8a6232']]);
    tx.beginPath(); tx.moveTo(0, 0); tx.lineTo(W, 0); tx.lineTo(W, 300); for (let i = 40; i >= 0; i--) tx.lineTo(i * 27, 300 + Math.sin(i * 2.7) * 14 + (i % 3) * 6); tx.closePath(); tx.fill();
    const r = rng(8); tx.strokeStyle = 'rgba(200,160,90,0.4)'; tx.lineWidth = 3; for (let i = 0; i < 160; i++) { const sx = r() * W; tx.beginPath(); tx.moveTo(sx, 200 + r() * 60); tx.lineTo(sx + (r() - 0.5) * 20, 300 + r() * 30); tx.stroke(); }
    // pandan bundle hanging
    for (let i = 0; i < 9; i++) { tx.strokeStyle = i % 2 ? '#3f8f3a' : '#6fb04a'; tx.lineWidth = 16; tx.lineCap = 'round'; tx.beginPath(); tx.moveTo(900, 300); tx.quadraticCurveTo(900 + (i - 4) * 20, 480, 880 + (i - 4) * 34, 620 + (i % 3) * 30); tx.stroke(); }
    x.drawImage(blurOf(t, 10), 0, 0);
  });
}
function woodTable(ty, tone = 1) { // planks in perspective from y=ty down
  return cached('wt' + ty + '_' + tone, W, H, (x) => {
    const r = rng(23), n = 9;
    for (let k = 0; k < n; k++) {
      const y0 = ty + (H - ty) * Math.pow(k / n, 1.5), y1 = ty + (H - ty) * Math.pow((k + 1) / n, 1.5), v = (0.86 + r() * 0.22) * tone;
      x.fillStyle = lgr(x, 0, y0, 0, y1, [[0, `rgb(${(170 * v) | 0},${(104 * v) | 0},${(60 * v) | 0})`], [1, `rgb(${(128 * v) | 0},${(74 * v) | 0},${(40 * v) | 0})`]]);
      x.fillRect(0, y0, W, y1 - y0 + 1);
      x.strokeStyle = 'rgba(70,30,14,0.3)'; x.lineWidth = 1 + (y1 - y0) / 60;
      for (let q = 0; q < 5; q++) { const yy = lerp(y0, y1, 0.15 + r() * 0.7); x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(300, yy + (r() - 0.5) * 12, 700, yy + (r() - 0.5) * 12, W, yy + (r() - 0.5) * 8); x.stroke(); }
      x.fillStyle = 'rgba(40,14,6,0.65)'; x.fillRect(0, y1 - 2 - (y1 - y0) * 0.03, W, 2 + (y1 - y0) * 0.03);
    }
    x.fillStyle = 'rgba(255,210,150,0.7)'; x.fillRect(0, ty - 2, W, 4);
    x.save(); x.globalCompositeOperation = 'screen'; x.fillStyle = rgr(x, 640, ty, 0, 640, ty, 700, [[0, 'rgba(255,190,110,0.35)'], [1, 'rgba(255,190,110,0)']]); x.fillRect(0, ty, W, H - ty); x.restore();
    x.fillStyle = lgr(x, 0, ty, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,8,10,0.5)']]); x.fillRect(0, ty, W, H - ty);
  });
}
function darkWarm() { // deep warm backdrop for macros (hook, tear macro)
  return cached('dw', W, H, (x) => {
    x.drawImage(stallBg(), 0, 0);
    x.fillStyle = 'rgba(26,10,4,0.55)'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'screen';
    x.fillStyle = rgr(x, 560, 900, 0, 560, 900, 900, [[0, 'rgba(255,190,100,0.55)'], [0.5, 'rgba(200,110,40,0.2)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
  });
}
function darkTable() { // blurred dark wooden table top from y≈1380 (macro floor)
  return cached('dtab', W, H, (x) => { const t = createCanvas(W, H), tx = t.getContext('2d'); tx.drawImage(woodTable(1400, 0.6), 0, 0); x.drawImage(blurOf(t, 5), 0, 0); x.globalCompositeOperation = 'destination-in'; x.fillStyle = lgr(x, 0, 1380, 0, 1440, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; });
}
const BOK = ['rgba(255,214,150,1)', 'rgba(255,180,110,1)', 'rgba(255,236,190,1)', 'rgba(200,240,150,1)'];
function bokehField(ctx, t, seed, n, alpha, rmin, rmax, dx = 0, y0 = 0, y1 = H) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const x = ((r() * (W + 400) + dx + Math.sin(t * 0.3 + i) * 20) % (W + 400) + W + 400) % (W + 400) - 200, y = y0 + r() * (y1 - y0) + Math.cos(t * 0.25 + i) * 14;
    const rad = rmin + r() * (rmax - rmin), col = BOK[Math.floor(r() * BOK.length)];
    ctx.globalAlpha = alpha * (0.35 + 0.65 * r());
    ctx.fillStyle = rgr(ctx, x, y, rad * 0.55, x, y, rad, [[0, col], [0.85, col.replace(',1)', ',0.8)')], [1, 'rgba(0,0,0,0)']]);
    ell(ctx, x, y, rad, rad); ctx.fill();
  }
  ctx.restore();
}
// blurred foreground pandan leaves (depth)
function fgLeaves() {
  return cached('fgl', 1400, 700, (x, c) => {
    const t = createCanvas(1400, 700), tx = t.getContext('2d');
    for (let i = 0; i < 7; i++) {
      const bx = 60 + i * 190, a = -1.2 + i * 0.35;
      tx.save(); tx.translate(bx, 720); tx.rotate(a * 0.4);
      tx.beginPath(); tx.moveTo(-22, 0); tx.quadraticCurveTo(-40, -300, 30 + i * 4, -560 - (i % 3) * 60); tx.quadraticCurveTo(10, -300, 22, 0); tx.closePath();
      tx.fillStyle = lgr(tx, -30, 0, 30, 0, [[0, '#2f6e28'], [0.5, '#5fae42'], [1, '#2a5a20']]); tx.fill();
      tx.restore();
    }
    x.drawImage(blurOf(t, 22), 0, 0);
  });
}
function vignetteDark(ctx, a) { ctx.save(); ctx.fillStyle = rgr(ctx, 540, 1000, 300, 540, 1000, 1300, [[0, 'rgba(0,0,0,0)'], [1, `rgba(10,4,2,${a})`]]); ctx.fillRect(0, 0, W, H); ctx.restore(); }

// Cô Út arm: purple sleeve from (fx,fy) to the hand at (gx,gy) (cartoon hand, medium shots)
function coArm(ctx, fx, fy, gx, gy, s, kind = 'grip', w = 64) {
  const dx = gx - fx, dy = gy - fy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, wx = gx - ux * 55 * s, wy = gy - uy * 55 * s;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = CO_PAL.aobaD; ctx.lineWidth = w * s + 6; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(wx - ux * 6, wy - uy * 6); ctx.stroke();
  ctx.strokeStyle = CO_PAL.aoba; ctx.lineWidth = w * s; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,110,0.4)'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(fx - uy * w * s * 0.3, fy + ux * w * s * 0.3 - 10); ctx.lineTo(wx - uy * w * s * 0.3, wy + ux * w * s * 0.3 - 10); ctx.stroke();
  ctx.restore();
  NP.cHand(ctx, wx, wy, s * 1.0, Math.atan2(uy, ux), { kind, flip: ux < 0, skin: CO_SKIN });
}

// ============================================================================================ s1 · HOOK (0 – 2.308)
const S1 = { x: 540, y: 1480, s: 1.36, ryr: 0.3 };
const s1State = (t) => { const k = iv(0.3, 0.42, t), p = ease.inOut(iv(0.5, 2.3, t)), q = ease.out(iv(0.4, 1.4, t)); return { sep: 3 * k + 150 * p, phi: 0.05 * k + 0.3 * q, roll: 0.02 * k + 0.05 * p, dy: -30 * p }; };
function tearHands(ctx, ret, s, st, o = {}) {
  // hands over the top of each half: back of hand toward camera, fingers down the front crust, thumbs on the torn edge
  const Rr = C.CAKE.R, L0 = ret.L(0, 0), Lt = ret.L(0, C.hOf(0)), R0 = ret.R(0, 0), Rt = ret.R(0, C.hOf(0));
  const hs = s * (o.hs ?? 1.17), sq = o.squeeze || 0, roll = st.roll || 0;
  const cu = [0.32 + sq * 0.12, 0.3 + sq * 0.12, 0.34 + sq * 0.1, 0.4 + sq * 0.1];
  const ho = { curl: cu, thumb: -1.05 - sq * 0.1, thumbLen: 1.15, thumbCurl: 0.1, arm: o.upper ? (o.upper.fore ?? 270) : 460, spread: 0.08, skin: o.skin || TSKIN, sleeve: o.upper ? null : o.sleeve, upper: o.upper };
  C.softHand(ctx, L0[0] - 0.42 * Rr * s, Lt[1] + 40 * s / 1.62, hs, PI / 2 - 0.45 - roll, ho);
  C.softHand(ctx, R0[0] + 0.42 * Rr * s, Rt[1] + 40 * s / 1.62, hs, PI / 2 + 0.45 + roll, Object.assign({ flip: true }, ho));
}
// a hand holding a torn piece from below-right (fingers in front, thumb on top)
function holdPiece(ctx, x, y, ps, rot, po, ho = {}) {
  const pr = C.piece(ctx, x, y, ps, rot, po);
  const hs = ps * (ho.hs ?? 0.55), a = ho.ang ?? -PI * 0.72;
  C.softHand(ctx, x + (ho.dx ?? 70) * ps, y + (ho.dy ?? 95) * ps, hs, a, { curl: [0.75, 0.8, 0.85, 0.9], thumb: -0.9, thumbLen: 1.1, thumbCurl: 0.2, arm: 520, spread: 0.06, skin: ho.skin || TSKIN, flip: ho.flip });
  return pr;
}
function s1Scene(ctx, T) {
  const z = lerp(1.0, 1.14, ease.inOut(iv(0, 2.3, T))), cy = 1250;
  cam(ctx, 540, cy, z, 0, () => {
    ctx.drawImage(darkWarm(), 0, 0);
    bokehField(ctx, T, 3, 16, 0.45, 30, 90, T * 12, 300, 1300);
    L.glow(ctx, 540, 1380, 560, 'rgba(255,200,120,1)', 0.6);
    L.godRays(ctx, 560, 900, PI / 2, 1.1, 1100, 9, 'rgba(255,214,150,0.9)', 0.12, T);
    const st = s1State(T);
    L.glow(ctx, 540, 1180, 420, 'rgba(255,215,150,1)', 0.38 + 0.08 * Math.sin(T * 3)); // warm backlight in the middle
    ctx.drawImage(darkTable(), 0, 0);
    const ret = C.tear(ctx, S1.x, S1.y, S1.s, { t: T, state: s1State, ryr: S1.ryr, n: 46, seed: 11, sagK: 1 + 0.9 * iv(1.4, 2.2, T), wob: 0.6 });
    tearHands(ctx, ret, S1.s, st, { squeeze: iv(0, 0.3, T), upper: { ang: 1.95, len: 440, fore: 215, sleeveK: 0.6, sleeve: ["#5fd0c4", "#2aa79c", "#1f6764"] } });
    // crust crack crumbs
    L.flakes(ctx, T, 0.3, 4, 22, S1.x, S1.y - 230, { speed: 420, g: 900, size: 7, spread: 2.2, colors: ['#8a4a1c', '#c98a3c', '#6e3414', '#e0b060'], life: 1.2, slow: 0.45 });
    const h = hitAt(T, 0.3, 0.35); if (h > 0) L.sparkle(ctx, S1.x, S1.y - 235, 60 * h + 20, h);
    C.cakeSteam(ctx, T, S1.x, S1.y - 150, { w: 300, h: 1000, n: 18, alpha: 0.42 * iv(0.3, 1.0, T), seed: 4, r: 80 });
    BX.sparkles(ctx, T, 540, 1130, 1.2, { n: 7, seed: 21, r: 230, alpha: 0.55 * iv(0.4, 0.9, T) });
    C.cakeSteam(ctx, T, 540, 1260, { w: 240, h: 700, n: 9, alpha: 0.22 * iv(0.5, 1.1, T), seed: 31, r: 60 });
    L.dust(ctx, T, 7, 26, 0, 500, W, 1100, '255,226,170', 2.4, 0.55);
  });
  // blurred foreground leaves bottom corners (depth)
  ctx.save(); ctx.globalAlpha = 0.85; ctx.drawImage(fgLeaves(), -300 - T * 20, 1520, 1400, 700); ctx.restore();
}
function s1(ctx, lt, p, T) {
  const wh = iv(2.12, 2.308, T);
  if (wh > 0) L.motionBlurX(ctx, -260 * wh * wh, 6, (x) => { x.save(); x.translate(-200 * wh * wh, 0); s1Scene(x, T); x.restore(); });
  else s1Scene(ctx, T);
  const k = 1 - iv(0, 0.3, T); if (k > 0) { ctx.fillStyle = `rgba(0,0,0,${k})`; ctx.fillRect(0, 0, W, H); }
}

// ============================================================================================ s7 · UNMOULD + HERO (24.231 – 28.846)
// Cô Út stands behind the table (x 540) holding the mould in front of her: match cut on the mould at screen (540,1000) r≈300,
// flip onto the leaf plate (24.5), knock (24.9), lift (25.3), the dome drops out (25.5, thud) → tings 26.0/26.4/26.8, proud.
const S7 = { px: 540, py: 1380, ps: 0.74, cs: 0.8, ryr: 0.42, my0: 1160, FLIP0: 24.3, FLIP: 24.5, KNOCK: 24.9, LIFT: 25.3, THUD: 25.5, TABLE: 1200 };
const CO7 = { x: 540, s: 1.7, U: 1.26, sh0: 960 };
function s7Cam(T) {
  const k1 = ease.inOut(iv(24.3, 24.6, T)), k2 = ease.inOut(iv(26.9, 28.2, T));
  const z = lerp(lerp(1.25, 1.33, ease.inOut(iv(24.6, 26.9, T))), 1.17, k2);
  const cy = lerp(lerp(1128, 1180, k1), 1110, k2);
  return { z, cy };
}
function s7Mould(T) {
  const D = 170 * 0.72 * S7.cs, f = ease.inOut(iv(S7.FLIP0, S7.FLIP, T)), ang = f * PI;
  const ryr = T < S7.FLIP0 ? 0.45 : 0.45 * Math.cos(ang), up = ryr >= 0, c = Math.sqrt(1 - Math.min(0.99, ryr * ryr));
  const knock = hitAt(T, S7.KNOCK, 0.22), liftK = ease.inOut(iv(S7.LIFT, S7.LIFT + 0.55, T)), away = ease.in(iv(S7.LIFT + 0.2, S7.LIFT + 0.65, T));
  const axis0 = S7.my0 + D * 0.45 / 2, axis1 = S7.py - D * 0.9 / 2;
  let ax = 540, ay = T < S7.FLIP ? lerp(axis0, axis1, ease.in(f)) - Math.sin(ang) * 70 : axis1 + knock * 5;
  ay -= liftK * 560; ax += away * 650;
  const oy = up ? ay - D * c / 2 : ay + D * c / 2;
  return { ax, ay, ox: ax, oy, ryr, up, D, c, knock, liftK, away, rim: (300 + 262) / 2 * S7.cs + 10 };
}
function s7(ctx, lt, p, T) {
  const c = s7Cam(T), M = s7Mould(T), holding = T < S7.LIFT + 0.38;
  const lean = T < S7.FLIP0 ? 0 : T < S7.LIFT ? ease.inOut(iv(S7.FLIP0, S7.FLIP, T)) : 1 - ease.inOut(iv(S7.LIFT, S7.LIFT + 0.5, T));
  const knockHand = iv(S7.KNOCK - 0.25, S7.KNOCK, T) * (1 - iv(S7.KNOCK + 0.06, S7.KNOCK + 0.3, T));
  const release = iv(S7.LIFT + 0.38, S7.LIFT + 0.8, T);
  cam(ctx, 540 + Math.sin(T * 0.6) * 5, c.cy, c.z, 0, () => {
    ctx.drawImage(stallBg(), 0, 0);
    L.glow(ctx, SUNP.gold[0], SUNP.gold[1], 520, 'rgba(255,200,120,1)', 0.45);
    bokehField(ctx, T, 9, 10, 0.35, 30, 80, 0, 300, 1100);
    ctx.drawImage(woodTable(S7.TABLE), 0, 0);
    C.leafPlate(ctx, S7.px, S7.py, S7.ps, { ryr: S7.ryr });
    // ---- Cô Út (body clipped by the table edge, arms reach over it)
    const s = CO7.s, U = CO7.U, sh = CO7.sh0 + lean * 140, oy = sh + 353 * s;
    const hold = (side) => [M.ax + side * M.rim, M.ay];
    let hL = hold(-1), hR = hold(1);
    if (knockHand > 0) { const top = [M.ax + 30, M.oy - (M.up ? -M.D * M.c : M.D * M.c) - 40]; hR = [lerp(hR[0], top[0], ease.inOut(knockHand)), lerp(hR[1], top[1], ease.inOut(knockHand)) + 30 * M.knock]; }
    const restL = [S7.px - 250, S7.py - 130], restR = [S7.px + 250, S7.py - 130];
    if (!holding || release > 0) { const k = ease.inOut(release); hL = [lerp(hL[0], restL[0], k), lerp(hL[1], restL[1], k)]; hR = [lerp(Math.min(hR[0], 900), restR[0], k), lerp(hR[1], restR[1], k)]; }
    const toB = (q) => [(q[0] - CO7.x) / (s * U), (q[1] - oy) / (s * U)];
    const proud = iv(26.3, 26.8, T);
    ctx.save();
    const clip = new Path2D(); clip.rect(-400, -400, W + 800, S7.TABLE + 400);
    for (const [sx, h] of [[-1, hL], [1, hR]]) { const s0 = [CO7.x + sx * 50 * s * U, sh + 10], d = Math.hypot(h[0] - s0[0], h[1] - s0[1]) || 1, nx = -(h[1] - s0[1]) / d * 90, ny = (h[0] - s0[0]) / d * 90; const q = [[s0[0] + nx, s0[1] + ny], [h[0] + nx, h[1] + ny], [h[0] - nx, h[1] - ny], [s0[0] - nx, s0[1] - ny]]; let ar = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; ar += a[0] * b[1] - b[0] * a[1]; } if (ar < 0) q.reverse(); q.forEach((v, i) => i ? clip.lineTo(v[0], v[1]) : clip.moveTo(v[0], v[1])); clip.closePath(); }
    ctx.clip(clip);
    const kL = release > 0.5 || !holding ? 'open' : 'grip', kR = knockHand > 0.3 ? 'fist' : kL;
    const rL = release > 0.5 ? 0.35 : 0.3, rR = knockHand > 0.3 ? PI / 2 : release > 0.5 ? PI - 0.35 : PI - 0.3;
    const co = NP.coUt(ctx, CO7.x, oy, s, { pose: 'stand', sit: 0, t: T, palette: CO_PAL, expr: T < S7.THUD ? 'calm' : 'smile', turn: 0.1, look: proud > 0 ? [0, 0] : [0, 0.9], tilt: proud * Math.sin(T * 2) * 0.03,
      poseFn: () => ({ hL: toB(hL), hR: toB(hR), kL, kR, rL, rR, flipL: false, flipR: true }) });
    ctx.restore();
    // ---- cake revealed
    if (T >= S7.LIFT) {
      const stuck = T < S7.THUD - 0.06 ? ease.out(iv(S7.LIFT, S7.LIFT + 0.12, T)) * 40 : 0;
      const drop = T >= S7.THUD - 0.06 && T < S7.THUD ? 40 * (1 - ease.in(iv(S7.THUD - 0.06, S7.THUD, T))) : 0;
      const sq = spring(T - S7.THUD, 2.6, 5.5), cy = S7.py - stuck - drop;
      C.dome(ctx, S7.px, cy, S7.cs, { ryr: S7.ryr, sy: 1 - sq * 0.13, sx: 1 + sq * 0.07, shadowA: 0.6 });
      C.cakeSteam(ctx, T, S7.px, cy - 120, { w: 300, h: 760, n: 16, alpha: 0.42 * iv(S7.LIFT, S7.LIFT + 0.4, T), seed: 7, r: 80 });
      BX.steamEruption(ctx, T, S7.px, cy - 80, 0.8, iv(S7.THUD - 0.1, S7.THUD + 1.6, T), { seed: 3, alpha: 0.4 * (1 - iv(S7.THUD + 0.5, S7.THUD + 1.2, T)) });
      [[26.0, -120, -150], [26.4, 125, -110], [26.8, -15, -195]].forEach(([tt, dx, dy]) => { const h = hitAt(T, tt, 0.45); if (h > 0) { L.sparkle(ctx, S7.px + dx, cy + dy, 80 * h + 16, h); L.glow(ctx, S7.px + dx, cy + dy, 110, 'rgba(255,240,200,0.9)', 0.6 * h); } });
      if (T > 26) BX.sparkles(ctx, T, S7.px, cy - 150, 1.1, { n: 6, seed: 4, r: 260, alpha: 0.45 * iv(26.0, 26.5, T) });
    }
    // ---- mould + hands holding it
    if (M.ay > -600 && M.ax < 1700) {
      if (M.up && M.ryr > 0.2) { P.mould(ctx, M.ox, M.oy, S7.cs, { ryr: M.ryr, fill: 1, t: T }); P.cakeTop(ctx, M.ox, M.oy, S7.cs, { ryr: M.ryr }); } // writer A's mould + cake top = same look as the end of s6
      else C.mould(ctx, M.ox, M.oy, S7.cs, { ryr: Math.abs(M.ryr) < 0.03 ? 0.03 * (M.up ? 1 : -1) : M.ryr, depth: 0.72 });
      if (M.knock > 0) { ctx.save(); ctx.strokeStyle = `rgba(255,240,210,${M.knock})`; ctx.lineWidth = 5; const kx = M.ax + 30, ky = M.oy - M.D * M.c - 30; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(kx, ky, 40 + i * 26 + (1 - M.knock) * 30, -2.7, -0.45); ctx.stroke(); } ctx.restore(); }
    }
    if (co && release < 0.5) {
      const hs = 0.36 * s * U;
      if (holding) NP.cHand(ctx, hL[0], hL[1], hs, rL, { kind: kL, skin: CO_SKIN, flip: false });
      if (knockHand > 0.05) coArm(ctx, CO7.x + 110, sh + 40, hR[0] + 10, hR[1] + 10, 0.8, 'fist', 56);
      else if (holding) NP.cHand(ctx, hR[0], hR[1], hs, rR, { kind: kR, skin: CO_SKIN, flip: true });
    }
    L.godRays(ctx, SUNP.gold[0], SUNP.gold[1] - 100, PI / 2 + 0.2, 1.2, 1300, 10, 'rgba(255,214,150,0.9)', 0.13, T);
    L.dust(ctx, T, 5, 26, 0, 500, W, 900, '255,220,160', 2.4, 0.55);
  });
  L.flare(ctx, 760, 520, 0.7, 0.3 + 0.1 * Math.sin(T));
}

// ============================================================================================ s8 · CUT + HONEYCOMB MACRO (28.846 – 32.308)
const S8 = { x: 540, y: 1330, s: 1.28, ryr: 0.38, a0: 0.62, a1: 1.64, TOUCH: 29.2, S0: 29.4, S1: 30.0, LIFT: 30.5, REVEAL: 31.0 };
function knifeInPlane(ctx, M, zEdge, r0, len, o = {}) { // blade in the cut plane, clipped where it is inside the cake
  const P = (r, z) => C.MP(M, r, z), hb = 54;
  ctx.save();
  const cp = new Path2D(); const a = P(r0 - 20, 2000); cp.moveTo(a[0], a[1]);
  for (let i = 0; i <= 40; i++) { const r = lerp(r0 - 20, C.CAKE.R, i / 40), q = P(r, Math.abs(r) <= C.CAKE.R ? C.hOf(r) + 1 : 0); cp.lineTo(q[0], q[1]); }
  const b = P(C.CAKE.R + 900, 0), c2 = P(C.CAKE.R + 900, 2000); cp.lineTo(b[0], b[1]); cp.lineTo(c2[0], c2[1]); cp.closePath();
  if (!o.noClip) ctx.clip(cp);
  const e0 = P(r0, zEdge), e1 = P(r0 + len, zEdge), t1 = P(r0 + len, zEdge + hb), t0 = P(r0 + 30, zEdge + hb * 0.95), tip = P(r0 - 14, zEdge + hb * 0.5);
  ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t0[0], t0[1]); ctx.closePath();
  ctx.fillStyle = lgr(ctx, e0[0], e0[1], t0[0], t0[1], [[0, '#f4f6f8'], [0.12, '#c9ced4'], [0.55, '#9aa0a8'], [1, '#d8dde2']]); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke();
  // handle
  const h0 = P(r0 + len, zEdge + 6), h1 = P(r0 + len + 150, zEdge + 10), h2 = P(r0 + len + 150, zEdge + hb - 6), h3 = P(r0 + len, zEdge + hb - 4);
  ctx.beginPath(); ctx.moveTo(h0[0], h0[1]); ctx.lineTo(h1[0], h1[1]); ctx.lineTo(h2[0], h2[1]); ctx.lineTo(h3[0], h3[1]); ctx.closePath();
  ctx.fillStyle = lgr(ctx, h0[0], h0[1], h3[0], h3[1], [[0, '#3a2210'], [0.5, '#7a4a24'], [1, '#4a2a12']]); ctx.fill();
  for (const k of [0.3, 0.7]) { const q = P(r0 + len + 150 * k, zEdge + hb / 2); ctx.fillStyle = '#d8d0c0'; ell(ctx, q[0], q[1], 4, 4); ctx.fill(); }
  ctx.restore();
  return { handle: P(r0 + len + 120, zEdge + hb / 2) };
}
function s8(ctx, lt, p, T) {
  if (T >= S8.REVEAL) return s8Macro(ctx, T);
  const z = lerp(1.14, 1.24, ease.inOut(iv(28.846, S8.REVEAL, T)));
  cam(ctx, 540 + Math.sin(T * 0.5) * 8, 1250, z, 0, () => {
    ctx.drawImage(stallBg(), 0, 0);
    ctx.drawImage(woodTable(1000), 0, 0);
    L.glow(ctx, SUNP.gold[0], SUNP.gold[1], 520, 'rgba(255,200,120,1)', 0.4);
    bokehField(ctx, T, 12, 10, 0.35, 30, 80, 0, 300, 1000);
    C.leafPlate(ctx, S8.x, S8.y, S8.s * 1.0, { ryr: S8.ryr });
    const ry = S8.ryr, cc = Math.sqrt(1 - ry * ry);
    const lift = ease.inOut(iv(S8.LIFT, S8.LIFT + 0.5, T)), removed = T >= S8.LIFT;
    const cut1 = iv(S8.S0, S8.S0 + 0.38, T), cut2 = iv(S8.S0 + 0.42, S8.S1, T);
    const R = C.CAKE.R, Hc = C.CAKE.H;
    const wc = C.wedgeCake(ctx, S8.x, S8.y, S8.s, { ryr: ry, a0: S8.a0, a1: S8.a1, removed, lift: lift * 700, liftX: lift * 260, liftRot: lift * 0.25, cut: removed ? 0 : (cut2 > 0 ? 1 : (T >= S8.TOUCH ? Math.max(0.15, cut1) : 0)), cutA: S8.a0 });
    if (cut2 > 0 && !removed) { // second slit along a1
      ctx.save(); ctx.translate(S8.x, S8.y); ctx.strokeStyle = 'rgba(60,24,6,0.85)'; ctx.lineWidth = 2.6 * S8.s; ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const rr = (i / 30) * R * cut2; const q = [rr * Math.cos(S8.a1) * S8.s, (rr * Math.sin(S8.a1) * ry - C.hOf(rr) * cc) * S8.s]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke(); ctx.restore();
    }
    // strands between the lifting wedge and the cut faces
    if (removed && lift < 1) {
      for (let i = 0; i < 6; i++) {
        const rr = R * (0.2 + i * 0.13), zz = C.hOf(rr) * 0.5, th = i % 2 ? S8.a0 : S8.a1;
        const fb = wc.P(rr, th, zz), fa = [fb[0] + lift * 260 * 0.5, fb[1] - lift * 700 * 0.35 - 20];
        const len = Math.hypot(fa[0] - fb[0], fa[1] - fb[1]);
        if (len < 120 + i * 40) C.strand(ctx, fb, fa, { w0: 10, w: Math.max(1.2, 6 - len / 40), sag: 10 + len * 0.15, t: T, seed: i * 3 });
        else C.tail(ctx, fb, -PI / 2, 30 + i * 4, { w0: 7, t: T, seed: i });
      }
    }
    // knife
    if (T < S8.LIFT + 0.6) {
      const Rr = C.CAKE.R;
      let M, zE, r0 = -40;
      if (T < S8.S0 + 0.4) { // first cut along a0
        M = { o: [S8.x, S8.y], u: [Math.cos(S8.a0) * S8.s, Math.sin(S8.a0) * ry * S8.s], v: [0, -cc * S8.s] };
        const come = ease.out(iv(28.846, S8.TOUCH, T)), dn = ease.inOut(iv(S8.S0, S8.S0 + 0.38, T));
        zE = lerp(Hc + 330, Hc + 2, come) - (T >= S8.TOUCH ? 6 * iv(S8.TOUCH, S8.S0, T) : 0);
        zE = lerp(zE, -4, dn) + Math.sin(T * 30) * 3 * dn * (1 - dn);
        r0 = -40 + Math.sin(T * 18) * 14 * dn;
      } else if (T < S8.S1) { // second cut along a1 (fast)
        M = { o: [S8.x, S8.y], u: [Math.cos(S8.a1) * S8.s, Math.sin(S8.a1) * ry * S8.s], v: [0, -cc * S8.s] };
        zE = lerp(Hc + 60, -4, ease.inOut(cut2));
      } else { // slides under the wedge and lifts it, then leaves
        M = { o: [S8.x, S8.y], u: [Math.cos(1.13) * S8.s, Math.sin(1.13) * ry * S8.s], v: [0, -cc * S8.s] };
        zE = -2 + lift * 300 / S8.s; r0 = lerp(160, -10, ease.out(iv(S8.S1, S8.LIFT, T)));
      }
      const kr = knifeInPlane(ctx, { o: [M.o[0] + (T >= S8.S1 ? lift * 260 : 0), M.o[1]], u: M.u, v: M.v }, zE, r0, Rr + 60, { noClip: T >= S8.S1 });
      coArm(ctx, 1260, kr.handle[1] + 260, kr.handle[0] + 20, kr.handle[1] + 6, 1.5, 'grip', 62);
    }
    if (T > S8.LIFT) { BX.sparkles(ctx, T, S8.x + 100, S8.y - 160, 1.0, { n: 5, seed: 8, r: 160, alpha: iv(S8.LIFT + 0.2, S8.REVEAL, T) }); }
    C.cakeSteam(ctx, T, S8.x + 80, S8.y - 180, { w: 220, h: 640, n: 10, alpha: 0.25 + 0.25 * iv(S8.LIFT, S8.REVEAL, T), seed: 9, r: 60 });
    L.dust(ctx, T, 15, 24, 0, 400, W, 1000, '255,220,160', 2.4, 0.5);
  });
}
function s8Macro(ctx, T) { // honeycomb cross-section, face-on, dolly
  const k = iv(S8.REVEAL, 32.308, T), e = ease.inOut(k);
  ctx.drawImage(darkWarm(), 0, 0);
  bokehField(ctx, T, 21, 14, 0.5, 40, 110, -T * 30, 200, 900);
  const s = lerp(6.4, 7.0, e), ox = lerp(540 - 20 * s, 540 - 85 * s, e), oy = 1980 + 30 * e;
  const M = { o: [ox, oy], u: [s, 0], v: [0, -s] };
  C.face(ctx, M, { r0: -260, r1: 260, light: 1.05 });
  // backlight rim on the crust edge + steam out of the tunnels
  L.glow(ctx, 540, oy - C.CAKE.H * s * 0.95, 520, 'rgba(255,200,120,1)', 0.35);
  C.cakeSteam(ctx, T, 540, oy - C.CAKE.H * s * 0.92, { w: 900, h: 700, n: 14, alpha: 0.3, seed: 31, r: 90 });
  L.dust(ctx, T, 19, 20, 0, 600, W, 1300, '230,255,190', 2.0, 0.4);
  // slow specular glint travelling across the moist surface
  ctx.save(); ctx.globalCompositeOperation = 'screen'; const gx = lerp(-200, 1300, k);
  ctx.fillStyle = lgr(ctx, gx - 220, 0, gx + 220, 0, [[0, 'rgba(255,255,220,0)'], [0.5, 'rgba(255,255,220,0.12)'], [1, 'rgba(255,255,220,0)']]); ctx.fillRect(0, 0, W, H); ctx.restore();
}

// ============================================================================================ s9 · GAG 2: knife & fork (32.308 – 36.923)
// Layered two-shot: tourist seated behind the table (right), cake centre-low, Cô Út in the foreground (left, cropped).
const S9 = { cx: 545, cy: 1430, cs: 0.64, ryr: 0.36, TABLE: 1190, POKE: 33.4, BOING: 33.6, KNIFE: 34.2, JIG: 34.6, LAUGH: 35.2, TEAR: 35.9 };
const T9 = { x: 790, y: 1470, s: 2.3 };   // tourist (seated) origin
const C9 = { x: 215, y: 2010, s: 2.6 };  // Cô Út (standing, foreground)
// utensil gripped at (hx,hy); rot = direction of the business end (0 = up); returns the tip
function utensil(ctx, kind, hx, hy, rot, s = 1) {
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(rot); ctx.scale(s, s); ctx.lineCap = 'round';
  const steel = lgr(ctx, -8, 0, 8, 0, [[0, '#7c8288'], [0.45, '#f4f6f8'], [1, '#6c7278']]);
  ctx.fillStyle = steel; ctx.beginPath(); ctx.roundRect(-6.5, -34, 13, 92, 6); ctx.fill();
  if (kind === 'fork') {
    ctx.beginPath(); ctx.moveTo(-15, -34); ctx.quadraticCurveTo(0, -24, 15, -34); ctx.lineTo(15, -50); ctx.lineTo(-15, -50); ctx.closePath(); ctx.fill();
    for (const xx of [-12.5, -4.2, 4.2, 12.5]) { ctx.beginPath(); ctx.roundRect(xx - 2.3, -112, 4.6, 66, 2.3); ctx.fill(); }
  } else {
    ctx.beginPath(); ctx.moveTo(-7, -34); ctx.lineTo(-8, -128); ctx.quadraticCurveTo(0, -146, 9, -122); ctx.lineTo(7, -34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, -38); ctx.lineTo(-7.5, -124); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, 50); ctx.lineTo(-3, -30); ctx.stroke();
  ctx.restore();
  const L0 = (kind === 'fork' ? 112 : 140) * s;
  return [hx + Math.sin(rot) * L0, hy - Math.cos(rot) * L0];
}
function boingLines(ctx, x, y, k, s = 1) {
  if (k <= 0) return; ctx.save(); ctx.strokeStyle = `rgba(255,250,230,${k})`; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const r = (30 + i * 22 + (1 - k) * 40) * s; ctx.beginPath(); ctx.arc(x, y, r, -PI * 0.85, -PI * 0.15); ctx.stroke(); }
  ctx.restore();
}
function clipArms(ctx, yEdge, arms) { // body above the table edge + capsules around the arms
  const clip = new Path2D(); clip.rect(-600, -600, W + 1200, yEdge + 600);
  for (const [s0, h, wd] of arms) {
    const d = Math.hypot(h[0] - s0[0], h[1] - s0[1]) || 1, nx = -(h[1] - s0[1]) / d * wd, ny = (h[0] - s0[0]) / d * wd;
    const q = [[s0[0] + nx, s0[1] + ny], [h[0] + nx, h[1] + ny], [h[0] - nx, h[1] - ny], [s0[0] - nx, s0[1] - ny]];
    let ar = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; ar += a[0] * b[1] - b[0] * a[1]; }
    if (ar < 0) q.reverse(); q.forEach((v, i) => i ? clip.lineTo(v[0], v[1]) : clip.moveTo(v[0], v[1])); clip.closePath();
  }
  ctx.clip(clip);
}
function s9(ctx, lt, p, T) {
  const z = lerp(1.2, 1.28, ease.inOut(p)), sh = hitAt(T, S9.BOING, 0.3) * 7 + hitAt(T, S9.KNIFE, 0.3) * 7, r = rng(Math.floor(T * 30));
  cam(ctx, 570 + (r() - 0.5) * sh, 1180 + (r() - 0.5) * sh, z, 0, () => {
    ctx.drawImage(stallBg(), 0, 0);
    L.glow(ctx, SUNP.gold[0], SUNP.gold[1], 480, 'rgba(255,200,120,1)', 0.4);
    bokehField(ctx, T, 14, 10, 0.32, 30, 80, 0, 300, 1000);
    ctx.drawImage(woodTable(S9.TABLE), 0, 0);
    // ---- tourist: hands + utensils kinematics (screen px)
    const fw = spring(T - S9.BOING, 4.5, 4.5), kw = spring(T - S9.KNIFE, 4.5, 4.5);
    const top = [S9.cx + 30, S9.cy - C.CAKE.H * 0.94 * S9.cs - 8];
    const pokeIn = ease.inOut(iv(S9.POKE - 0.5, S9.POKE, T)), pokeOut = ease.out(iv(S9.BOING, S9.BOING + 0.14, T)), press = iv(S9.POKE, S9.BOING, T) * (1 - pokeOut);
    const knIn = ease.inOut(iv(S9.KNIFE - 0.45, S9.KNIFE - 0.08, T)), knOut = ease.out(iv(S9.KNIFE, S9.KNIFE + 0.14, T)), kpress = iv(S9.KNIFE - 0.08, S9.KNIFE, T) * (1 - knOut);
    const restF = [690, 1150], restK = [900, 1160];
    // fork: rest (tines up, prim) → down onto the dome (tip at top) → flung back up, vibrating
    const fPoke = [top[0] + 20, top[1] - 112 + press * 14], fFly = [restF[0] - 30, restF[1] - 90];
    const fk = pokeOut > 0 ? 1 - pokeOut : pokeIn;
    let fH = [lerp(restF[0], fPoke[0], fk), lerp(restF[1], fPoke[1], fk)];
    if (T >= S9.BOING) fH = [lerp(fPoke[0], fFly[0], pokeOut) + fw * 24, lerp(fPoke[1], fFly[1], pokeOut) + Math.abs(fw) * 10];
    const fRot = (T < S9.BOING ? lerp(-0.15, PI - 0.25, fk) : lerp(PI - 0.25, -0.5, pokeOut)) + fw * 0.7;
    const kPoke = [top[0] + 95, top[1] - 120 + kpress * 18], kFly = [restK[0] + 20, restK[1] - 110];
    let kH = [lerp(restK[0], kPoke[0], knIn), lerp(restK[1], kPoke[1], knIn)];
    if (T >= S9.KNIFE) kH = [lerp(kPoke[0], kFly[0], knOut) + kw * 26, lerp(kPoke[1], kFly[1], knOut) + Math.abs(kw) * 10];
    const kRot = (T < S9.KNIFE ? lerp(0.15, PI + 0.35, knIn) : lerp(PI + 0.35, 0.5, knOut)) + kw * 0.7;
    const shL = [T9.x - 52 * 1.2 * T9.s, T9.y + (-326 + 160) * 1.2 * T9.s], shR = [T9.x + 52 * 1.2 * T9.s, shL[1]];
    const panic = T > S9.BOING && T < S9.TEAR + 0.2, gaze = T > S9.LAUGH ? [-0.9, 0.3] : [-0.4, 0.8];
    ctx.save(); clipArms(ctx, S9.TABLE, [[shL, fH, 70], [shR, kH, 70]]);
    BX.tourist(ctx, T9.x, T9.y, T9.s, { pose: 'sit', t: T, look: -0.25,
      poseFn: () => {
        const toB = (q) => [(q[0] - T9.x) / (T9.s * 1.2), (q[1] - T9.y) / (T9.s * 1.2)];
        return { hL: toB(fH), hR: toB(kH), kL: 'grip', kR: 'grip', rL: fRot - PI / 2, rR: kRot - PI / 2, flipL: true, flipR: false,
          face: panic ? { mouth: 'o', mOpen: 0.75, brow: 1.15, pupil: 0.8, lookX: gaze[0], lookY: gaze[1], open: 1.2 } : { mouth: 'smile', brow: 0.55, lookX: -0.4, lookY: 0.85, open: 0.75 } };
      } });
    ctx.restore();
    // ---- cake: wobble (springy) with dents under the fork / knife
    const jig = spring(T - S9.BOING, 3.4, 4) * 0.07 + spring(T - S9.KNIFE, 3.4, 4) * 0.07 + spring(T - S9.JIG, 2.4, 2.0) * 0.15;
    const csy = 1 - press * 0.08 - kpress * 0.1 + jig, csx = 1 + press * 0.04 + kpress * 0.05 - jig * 0.5, shear = spring(T - S9.JIG, 2.4, 2.0) * 0.14 + spring(T - S9.BOING, 3.4, 4) * 0.04;
    C.leafPlate(ctx, S9.cx, S9.cy, S9.cs * 1.05, { ryr: S9.ryr });
    C.contactShadow(ctx, S9.cs, S9.ryr);
    ctx.save(); ctx.translate(S9.cx, S9.cy); ctx.transform(csx, 0, shear, csy, 0, 0); ctx.translate(-S9.cx, -S9.cy);
    C.wedgeCake(ctx, S9.cx, S9.cy, S9.cs, { ryr: S9.ryr, a0: 1.0, a1: 2.02, removed: true, lift: 3000, piece: false, shadow: true });
    const tearAt = [S9.cx - 120, S9.cy - 96];
    if (T >= S9.TEAR) { // torn notch on the upper-left shoulder
      ctx.save(); ctx.beginPath(); for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU, rr = 30 + 6 * Math.sin(a * 5); i ? ctx.lineTo(tearAt[0] + Math.cos(a) * rr, tearAt[1] + 8 + Math.sin(a) * rr * 0.6) : ctx.moveTo(tearAt[0] + Math.cos(a) * rr, tearAt[1] + 8 + Math.sin(a) * rr * 0.6); } ctx.closePath();
      ctx.fillStyle = lgr(ctx, 0, tearAt[1] - 20, 0, tearAt[1] + 30, [[0, '#d9e07c'], [0.5, '#a9cf5a'], [1, '#6f9f34']]); ctx.fill(); ctx.strokeStyle = 'rgba(90,40,10,0.6)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    // ---- utensils + hands over the cake
    const fTip = utensil(ctx, 'fork', fH[0], fH[1], fRot, 1.0), kTip = utensil(ctx, 'knife', kH[0], kH[1], kRot, 1.0);
    NP.cHand(ctx, fH[0], fH[1], 0.4 * 1.2 * T9.s, fRot - PI / 2, { kind: 'grip', skin: TSKIN, flip: true });
    NP.cHand(ctx, kH[0], kH[1], 0.4 * 1.2 * T9.s, kRot - PI / 2, { kind: 'grip', skin: TSKIN, flip: false });
    if (T < S9.POKE - 0.1) { // pinky up (prim)
      ctx.save(); ctx.strokeStyle = '#c97c5e'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(kH[0] + 26, kH[1] + 14); ctx.quadraticCurveTo(kH[0] + 52, kH[1] + 6, kH[0] + 58, kH[1] - 22); ctx.stroke(); ctx.strokeStyle = TSKIN[1]; ctx.lineWidth = 10; ctx.stroke(); ctx.restore();
      L.sparkle(ctx, kH[0] + 60, kH[1] - 34, 22, 0.6 + 0.4 * Math.sin(T * 8));
    }
    boingLines(ctx, fTip[0], fTip[1] + 30, hitAt(T, S9.BOING, 0.5), 1.4);
    boingLines(ctx, kTip[0], kTip[1] + 30, hitAt(T, S9.KNIFE, 0.5), 1.4);
    if (hitAt(T, S9.JIG, 0.6) > 0) { const h = hitAt(T, S9.JIG, 0.6); ctx.save(); ctx.strokeStyle = `rgba(255,250,230,${h})`; ctx.lineWidth = 6; for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(S9.cx + sx * (C.CAKE.R * S9.cs + 30 + i * 22), S9.cy - 60, 40, sx > 0 ? -0.8 : PI - 0.8 + 1.6, sx > 0 ? 0.8 : PI + 0.8); ctx.stroke(); } ctx.restore(); }
    // ---- Cô Út in the foreground (left): laughs, then tears a piece with her fingers
    const reach = ease.inOut(iv(S9.TEAR - 0.45, S9.TEAR - 0.05, T)), pull = ease.out(iv(S9.TEAR, S9.TEAR + 0.55, T));
    const laugh = T >= S9.LAUGH - 0.05 && T < S9.TEAR - 0.45;
    const U = 1.26, cs = C9.s, toB = (q) => [(q[0] - C9.x) / (cs * U), (q[1] - C9.y) / (cs * U)];
    const pieceAt = [lerp(lerp(330, tearAt[0] + 10, reach), 300, pull), lerp(lerp(1160, tearAt[1] - 4, reach), 1060, pull)];
    NP.coUt(ctx, C9.x, C9.y, cs, { pose: 'stand', sit: 0, t: T, palette: CO_PAL, expr: laugh ? 'laugh' : 'smile', turn: 0.45, look: laugh ? [0.3, -0.2] : [0.8, 0.5],
      tilt: laugh ? -0.14 + Math.sin(T * 17) * 0.035 : 0,
      poseFn: (P) => {
        if (T < S9.LAUGH - 0.05) return { hL: [-20, P.SY + 100], kL: 'flat', rL: 0.2, hR: [30, P.SY + 96], kR: 'flat', rR: PI - 0.2 };
        if (laugh) return { hL: [-10, P.SY + 96], kL: 'flat', rL: 0.1, hR: [64, P.SY - 6 + Math.sin(T * 17) * 4], kR: 'open', rR: -0.6 };
        return { hL: [-10, P.SY + 96], kL: 'flat', rL: 0.1, hR: toB(pieceAt), kR: 'pinch', rR: -0.35 };
      } });
    if (T >= S9.TEAR - 0.02) {
      const pa = pieceAt, len = Math.hypot(pa[0] - tearAt[0], pa[1] - tearAt[1]);
      if (len < 200) C.strand(ctx, [tearAt[0] + 6, tearAt[1] + 10], [pa[0] + 16, pa[1] + 24], { w0: 14, w: Math.max(1.4, 7 - len / 28), sag: 14 + len * 0.1, t: T, seed: 2 });
      else C.tail(ctx, [tearAt[0] + 6, tearAt[1] + 10], -PI / 2, 26, { w0: 9, t: T, seed: 2 });
      C.piece(ctx, pa[0] + 18, pa[1] + 34, 0.5, -0.4, { t: T, seed: 6, strands: 0.7 });
      const h = hitAt(T, S9.TEAR, 0.35); if (h > 0) L.sparkle(ctx, tearAt[0], tearAt[1], 60 * h + 14, h);
    }
    C.cakeSteam(ctx, T, S9.cx, S9.cy - 110, { w: 200, h: 520, n: 8, alpha: 0.22, seed: 12, r: 50 });
    L.dust(ctx, T, 25, 20, 0, 400, W, 1000, '255,220,160', 2.2, 0.5);
  });
}

// ============================================================================================ s10 · THE TEAR (36.923 – 43.846)
const S10 = { GRAB: 37.4, STR: 38.0, BACK: 40.0, MAX: 40.8, SNAP: 41.2, SPLAT: 41.5, W0: 42.0, W1: 43.0 };
// shared strand-on-glasses (dried in s13): drawn in people.face units relative to the glasses centre
function glassStrand(ctx, fx, fy, fs, t, wob, o = {}) {
  const gx = fx + 70 * fs, gy = fy + (o.gy ?? -178) * fs + 18 * fs;
  const sw = Math.sin(t * 9) * wob * 0.5, len = (o.len ?? 300) * fs;
  ctx.save();
  // blob on the lens
  const bk = o.blob ?? 1; ctx.fillStyle = 'rgba(170,215,95,0.85)'; ell(ctx, gx, gy - 6 * fs, 34 * fs * bk, 22 * fs * bk, 0.2); ctx.fill();
  if (bk > 1) { ctx.fillStyle = 'rgba(150,200,80,0.8)'; for (let i = 0; i < 3; i++) { ell(ctx, gx + (i - 1) * 22 * fs, gy + (14 + 6 * (i % 2)) * fs * bk, 7 * fs, (12 + 6 * i) * fs, 0); ctx.fill(); } C.strand(ctx, [gx - 20 * fs, gy - 12 * fs], [gx - 150 * fs, gy - 4 * fs], { w0: 10 * fs, w: 4 * fs, sag: 34 * fs + sw * 8, t, seed: 9 }); }
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,255,220,0.7)'; ell(ctx, gx - 12 * fs, gy - 14 * fs, 10 * fs, 5 * fs, -0.3); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  C.tail(ctx, [gx - 6 * fs, gy + 8 * fs], PI / 2 + 0.35 + sw, len, { w0: 13 * fs, t, seed: 3, droop: 0.6, alpha: o.alpha ?? 1 });
  ctx.restore();
}
function s10(ctx, lt, p, T) {
  if (T < S10.STR) return s10A(ctx, T);
  if (T < S10.BACK) return s10B(ctx, T);
  if (T < S10.SPLAT) return s10C(ctx, T);
  return s10D(ctx, T);
}
function s10A(ctx, T) { // medium close: he grabs the cake in both hands (37.4 squeeze), first crack, pulls
  const z = lerp(1.0, 1.1, ease.inOut(iv(36.923, 38.0, T)));
  cam(ctx, 540 + Math.sin(T * 0.7) * 6, 960, z, 0, () => {
    ctx.drawImage(stallBg(), 0, 0);
    L.glow(ctx, SUNP.gold[0], SUNP.gold[1], 520, 'rgba(255,200,120,1)', 0.5);
    bokehField(ctx, T, 31, 12, 0.4, 30, 90, 0, 200, 1300);
    const base = ctx.getTransform();
    const tx = 540, ty = 2200, ts = 3.0, cx = 540, cy = 1640, cs = 0.86, TB = 1530;
    const grab = ease.out(iv(36.95, S10.GRAB - 0.05, T)), sq = hitAt(T, S10.GRAB, 0.35);
    const pull = ease.in(iv(37.55, 38.0, T));
    const st = (t) => ({ sep: 14 * ease.in(iv(37.55, 38.0, t)) + 3 * iv(37.45, 37.6, t), phi: 0.08 * ease.in(iv(37.55, 38.0, t)), roll: 0.04 * ease.in(iv(37.55, 38.0, t)), dy: 0 });
    BX.tourist(ctx, tx, ty, ts, { pose: 'sit', stand: true, t: T, pack: false,
      poseFn: (P) => {
        const U = 1.2, toB = (q) => [(q[0] - tx) / (ts * U), (q[1] - ty) / (ts * U)];
        const hw = C.CAKE.R * cs * 0.9 + pull * 18 - sq * 8;
        return {
          hL: toB([lerp(cx - hw - 170, cx - hw, grab), lerp(TB + 40, cy - 60, grab)]), kL: 'grip', rL: 0.2 - sq * 0.12, flipL: false,
          hR: toB([lerp(cx + hw + 170, cx + hw, grab), lerp(TB + 40, cy - 60, grab)]), kR: 'grip', rR: PI - 0.2 + sq * 0.12, flipR: true, lateHands: true,
          face: T < S10.GRAB ? { mouth: 'smile', brow: 0.4, lookY: 1, lookX: 0, open: 0.9 } : { mouth: 'grin', mOpen: 0.25 + 0.2 * pull, brow: -0.4 + pull, lookY: 0.9, open: 0.75 + 0.3 * pull },
          front: () => {
            ctx.save(); ctx.setTransform(base);
            ctx.drawImage(woodTable(TB), 0, 0); C.leafPlate(ctx, cx, cy + 20, 0.66, { ryr: 0.3 });
            if (T < 37.47) C.dome(ctx, cx, cy, cs, { ryr: 0.3, sx: 1 - sq * 0.05, sy: 1 + sq * 0.04, shadowA: 0.7 });
            else C.tear(ctx, cx, cy, cs, { t: T, state: st, ryr: 0.3, n: 18, seed: 41 });
            const h = hitAt(T, 37.5, 0.3); if (h > 0) L.sparkle(ctx, cx, cy - C.CAKE.H * cs * 0.9, 70 * h + 14, h);
            ctx.restore();
          },
        };
      } });
    C.cakeSteam(ctx, T, cx, cy - 130, { w: 240, h: 700, n: 10, alpha: 0.32, seed: 2, r: 60 });
    L.dust(ctx, T, 33, 22, 0, 400, W, 1100, '255,220,160', 2.4, 0.5);
  });
  ctx.save(); ctx.globalAlpha = 0.75; ctx.drawImage(fgLeaves(), -260 + T * 12, 1620, 1500, 760); ctx.restore();
}
const S10B = { x: 540, y: 1330, s: 1.5, ryr: 0.3 };
const s10BState = (t) => { const k = iv(37.9, 40.0, t), e = ease.inOut(k); return { sep: lerp(10, 250, e), phi: lerp(0.08, 0.5, ease.out(k)), roll: 0.03 + 0.12 * e, dy: -20 * e }; };
function s10B(ctx, T) { // slow-motion macro of the stretch
  const k = iv(S10.STR, S10.BACK, T), z = lerp(1.12, 1.0, ease.inOut(k));
  cam(ctx, 540 + Math.sin(T * 0.8) * 10, 1150, z, lerp(-0.02, 0.02, k), () => {
    ctx.drawImage(darkWarm(), 0, 0);
    bokehField(ctx, T, 37, 16, 0.5, 30, 100, T * 20, 300, 1300);
    L.glow(ctx, 540, 1120, 600, 'rgba(255,205,130,1)', 0.6);
    L.godRays(ctx, 560, 650, PI / 2, 1.0, 1200, 9, 'rgba(255,214,150,0.9)', 0.12, T);
    const st = s10BState(T);
    const ret = C.tear(ctx, S10B.x, S10B.y, S10B.s, { t: T, state: s10BState, ryr: S10B.ryr, n: 36, seed: 17, sagK: 1.1, wob: 0.8, thick: 1.15 });
    tearHands(ctx, ret, S10B.s, st, { hs: 0.66 });
    C.cakeSteam(ctx, T, 540, 1150, { w: 360, h: 760, n: 12, alpha: 0.28, seed: 15, r: 80 });
    L.dust(ctx, T, 39, 28, 0, 400, W, 1200, '235,255,190', 2.4, 0.55);
  });
  ctx.save(); ctx.globalAlpha = 0.8; ctx.drawImage(fgLeaves(), -200 + T * 10, 1560, 1400, 700); ctx.restore();
}
function s10C(ctx, T) { // he steps back, arms up wide: one strand spans the frame, trembles, SNAPS, whips to his sunglasses
  const back = ease.inOut(iv(S10.BACK, S10.BACK + 0.45, T)), mx = ease.inOut(iv(S10.BACK + 0.15, S10.MAX, T));
  const ts = lerp(4.15, 3.9, back), tx = 540, ty = lerp(2760, 2690, back); // thighs-up framing
  const z = 1.0 + 0.04 * hitAt(T, S10.SNAP, 0.3);
  cam(ctx, 540, 960, z, 0, () => {
    ctx.drawImage(stallBg(), 0, 0);
    L.glow(ctx, SUNP.gold[0], SUNP.gold[1], 560, 'rgba(255,200,120,1)', 0.5);
    bokehField(ctx, T, 43, 12, 0.4, 30, 90, 0, 200, 1200);
    const base = ctx.getTransform();
    const trem = Math.sin(T * 40) * 3 * iv(S10.MAX - 0.2, S10.SNAP, T), recoil = T > S10.SNAP ? hitAt(T, S10.SNAP, 0.4) : 0;
    const handY = lerp(780, 650, mx) + trem;
    const hL = [lerp(225, 120, mx) - recoil * 30, handY + 20 - recoil * 20], hR = [lerp(855, 960, mx) + recoil * 30, handY - recoil * 20];
    const hs = 0.58, ryr = 0.36, phi = 0.6, roll = 0.3;
    let aL = null, aR = null;
    const ret = BX.tourist(ctx, tx, ty, ts, { pose: 'sit', stand: true, t: T, pack: false,
      poseFn: (P) => {
        const U = 1.2, toB = (q) => [(q[0] - tx) / (ts * U), (q[1] - ty) / (ts * U)];
        return { hL: toB(hL), kL: 'grip', rL: -1.9, flipL: true, hR: toB(hR), kR: 'grip', rR: -1.25, flipR: false, lateHands: true,
          face: T < S10.SNAP ? { mouth: 'grin', mOpen: 0.35 + 0.2 * mx, brow: 0.9, pupil: 1.2, lookX: 0, lookY: -0.6, open: 1.15 } : { mouth: 'o', mOpen: 0.9, brow: 1.2, pupil: 0.7, lookX: 0.4, lookY: -0.8, open: 1.25 },
          front: () => {
            ctx.save(); ctx.setTransform(base);
            aL = C.half(ctx, hL[0] + 0.55 * C.CAKE.R * hs, hL[1] + 60, hs, { side: -1, ryr, phi, roll, seed: 3, shadow: false });
            aR = C.half(ctx, hR[0] - 0.55 * C.CAKE.R * hs, hR[1] + 60, hs, { side: 1, ryr, phi, roll, seed: 7, shadow: false });
            for (let i = 0; i < 5; i++) { const zz = C.hOf(80) * (0.3 + i * 0.12); C.tail(ctx, aL(40 + i * 35, zz), 0.5, 30 + i * 10, { w0: 7, t: T, seed: i }); C.tail(ctx, aR(40 + i * 35, zz), PI - 0.5, 28 + i * 9, { w0: 7, t: T, seed: i + 9 }); }
            ctx.restore();
          } };
      } });
    const a = aL(110, 60), b = aR(110, 60);
    if (T < S10.SNAP) {
      const tens = mx;
      C.strand(ctx, a, b, { w0: 22, w: lerp(7, 2.6, tens), sag: lerp(330, 90, tens), t: T, seed: 5, wob: 5 * iv(S10.MAX, S10.SNAP, T) + 2, n: 48, glow: 1 });
      C.strand(ctx, aL(70, 90), aR(70, 90), { w0: 12, w: lerp(4, 1.6, tens), sag: lerp(250, 60, tens), t: T, seed: 8, wob: 3, n: 40, alpha: 0.75 * (1 - iv(40.5, 40.9, T)) });
      if (T > S10.MAX - 0.2) { const g = 0.5 + 0.5 * Math.sin(T * 20); L.sparkle(ctx, lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5) + 90 * (1 - tens) + 50, 34 * g + 10, 0.8 * g); }
    } else { // snapped at u=.6: left part falls, right part whips to his sunglasses
      const u = 0.6, sp = [lerp(a[0], b[0], u), lerp(a[1], b[1], u) + 90], age = T - S10.SNAP;
      C.tail(ctx, a, 0.25, 420 * Math.exp(-age * 2) + 70, { w0: 18, t: T, seed: 4, droop: 0.4 + age * 2 });
      const head = ret && ret.head ? ret.head : [540, 920];
      const gl = [head[0] + 30, head[1] - 0.18 * 178 * ts * 1.2 + 20], k = ease.in(iv(S10.SNAP, S10.SPLAT, T));
      const end = [lerp(sp[0], gl[0], k), lerp(sp[1], gl[1], k) - Math.sin(k * PI) * 200];
      C.strand(ctx, b, end, { w0: 18, w: 4, sag: 50 * (1 - k), t: T, seed: 6, wob: 6 });
      ctx.fillStyle = 'rgba(180,225,100,0.95)'; ell(ctx, end[0], end[1], 16, 12); ctx.fill();
      ctx.save(); ctx.strokeStyle = `rgba(255,255,230,${0.8 * (1 - k)})`; ctx.lineWidth = 5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(end[0] + 26 + i * 20, end[1] + 30 - i * 16); ctx.lineTo(end[0] + 86 + i * 20, end[1] + 54 - i * 16); ctx.stroke(); } ctx.restore();
      const h = hitAt(T, S10.SNAP, 0.25); if (h > 0) { L.sparkle(ctx, sp[0], sp[1], 110 * h + 20, h); L.glow(ctx, sp[0], sp[1], 200, 'rgba(240,255,200,1)', 0.5 * h); }
    }
    L.dust(ctx, T, 45, 24, 0, 400, W, 1300, '255,220,160', 2.4, 0.5);
  });
}
function s10D(ctx, T) { // face close-up: splat on the sunglasses, cross-eyed at the dangling strand
  const age = T - S10.SPLAT, hit = hitAt(T, S10.SPLAT, 0.35), z = 1.0 + 0.06 * hit, r = rng(Math.floor(T * 30));
  const wob = Math.exp(-Math.max(0, T - S10.W0) * 1.8) * (T > S10.W0 ? 1 : 0.6) + 0.15;
  cam(ctx, 540 + (r() - 0.5) * hit * 14, 960 + (r() - 0.5) * hit * 14, z, 0, () => {
    ctx.drawImage(stallBg(), 0, 0);
    L.glow(ctx, 760, 600, 600, 'rgba(255,200,120,1)', 0.45);
    bokehField(ctx, T, 47, 12, 0.4, 40, 110, 0, 0, 1900);
    const fx = 540, fy = 1080, fs = 1.32, cross = ease.out(iv(41.75, 42.05, T));
    PE.face(ctx, fx, fy, fs, { t: T, mouth: age < 0.4 ? 'o' : 'woozy', mOpen: 0.7, brow: age < 0.4 ? 1.2 : 0.9, open: age < 0.15 ? 0.2 : 1.1, cross, lookY: -0.5 * cross, blush: 0.6, tilt: Math.sin(T * 3) * 0.02 - 0.03 * hit });
    glassStrand(ctx, fx, fy, fs, T, Math.sin((T - S10.W0) * 12) * wob * 1.2, { blob: 1.5, len: 360 });
    // splat droplets
    if (age < 0.8) { const rr = rng(66); for (let i = 0; i < 14; i++) { const a = rr() * TAU, v = 300 + rr() * 500, px = fx + 92 * fs + Math.cos(a) * v * age, py = fy - 160 * fs + Math.sin(a) * v * age + 900 * age * age; ctx.fillStyle = `rgba(185,225,105,${1 - age / 0.8})`; ell(ctx, px, py, 7 + rr() * 6, 6 + rr() * 5); ctx.fill(); } }
    if (hit > 0) L.glow(ctx, fx + 92 * fs, fy - 160 * fs, 260, 'rgba(230,255,180,1)', 0.5 * hit);
  });
}

// ============================================================================================ s11 · lift to the mouth, eye macro, silence (43.846 – 46.731)
const S11 = { EYE: 45.0, SIL: 46.154 };
function s11(ctx, lt, p, T) {
  if (T < S11.EYE) {
    const k = iv(43.846, S11.EYE, T), z = lerp(1.0, 1.1, ease.inOut(k));
    cam(ctx, 540, 1000, z, 0, () => {
      ctx.drawImage(stallBg(), 0, 0);
      L.glow(ctx, 760, 600, 600, 'rgba(255,200,120,1)', 0.45);
      bokehField(ctx, T, 51, 12, 0.4, 40, 110, 0, 0, 1900);
      const fx = 540, fy = 1000, fs = 1.12;
      PE.face(ctx, fx, fy, fs, { t: T, mouth: k > 0.6 ? 'o' : 'smile', mOpen: 0.4 + 0.4 * k, brow: 0.6, open: 1.05, lookY: 0.9, lookX: 0.15, blush: 0.6 });
      glassStrand(ctx, fx, fy, fs, T, 0.2);
      const py = lerp(1900, 1420, ease.out(iv(43.85, 44.6, T))) - 40 * k;
      holdPiece(ctx, 600, py, 1.25, -0.12, { t: T, seed: 4 });
      C.cakeSteam(ctx, T, 600, py - 60, { w: 160, h: 500, n: 8, alpha: 0.3, seed: 5, r: 50 });
    });
    return;
  }
  if (T < S11.SIL) { // eye macro with the golden piece in the cornea
    const k = iv(S11.EYE, S11.SIL, T);
    cam(ctx, 540, 960, lerp(1.0, 1.12, ease.inOut(k)), 0, () => {
      PE.eyeMacro(ctx, 540, 980, 1.18, { pupil: lerp(0.3, 0.62, ease.inOut(k)), open: 1, t: T, brow: 0.4,
        reflect: (x, IR) => { x.save(); x.fillStyle = 'rgba(255,170,80,0.35)'; x.fillRect(-IR * 1.3, -IR * 1.3, IR * 2.6, IR * 2.6); C.piece(x, IR * 0.15, IR * 0.25, 0.9 + 0.25 * k, -0.15, { t: T, seed: 4, strands: 0.5 }); x.restore(); } });
      L.glow(ctx, 540, 980, 300, 'rgba(255,200,120,1)', 0.15);
    });
    return;
  }
  // SILENCE: hard cut, extreme slow motion: piece glides toward the open mouth, the world goes dim
  const k = iv(S11.SIL, 46.731, T);
  ctx.drawImage(mouthBlur(), 0, 0);
  ctx.fillStyle = 'rgba(8,4,2,0.35)'; ctx.fillRect(0, 0, W, H);
  const px = lerp(620, 560, k), py = lerp(1300, 1180, k);
  L.glow(ctx, px, py - 40, 520, 'rgba(255,190,110,1)', 0.35);
  C.piece(ctx, px, py, 2.5, -0.1 + 0.03 * k, { t: S11.SIL + k * 0.15, seed: 4 });
  vignetteDark(ctx, 0.75);
}
function mouthBlur() {
  return cached('mouthBlur', W, H, (x) => {
    const t = createCanvas(W, H), tx = t.getContext('2d');
    tx.drawImage(stallBg(), 0, 0);
    PE.face(tx, 540, 760, 2.6, { t: 1, mouth: 'o', mOpen: 1.2, brow: 0.7, open: 0.5, blush: 0.6 });
    x.drawImage(blurOf(t, 18), 0, 0);
  });
}

// ============================================================================================ s12 · THE BITE (46.731 – 51.923)
const S12 = { BITE: 46.731, CHEWS: [47.3, 47.6, 47.9, 48.2, 48.5], WIDE: 48.8, THUMB: 49.5, LAUGH: 50.5 };
function s12(ctx, lt, p, T) {
  const b = T - S12.BITE, slow = b < 0.45 ? b * 0.35 : 0.1575 + (b - 0.45);
  const chew = S12.CHEWS.reduce((a, t0) => a + hitAt(T, t0, 0.26), 0);
  const z = lerp(1.08, 1.0, ease.out(iv(S12.BITE, S12.BITE + 0.6, T))) + (T > S12.THUMB ? -0.06 * ease.inOut(iv(S12.THUMB - 0.3, S12.THUMB + 0.2, T)) : 0);
  cam(ctx, 540, 1000, Math.max(1, z + 0.06), 0, () => {
    ctx.drawImage(stallBg(), 0, 0);
    L.glow(ctx, 760, 600, 600, 'rgba(255,200,120,1)', 0.45);
    bokehField(ctx, T, 55, 12, 0.4, 40, 110, 0, 0, 1900);
    const fx = 540, fy = 980 - chew * 6, fs = 1.18;
    const wide = iv(S12.WIDE, S12.WIDE + 0.15, T) * (1 - iv(S12.THUMB + 0.3, S12.THUMB + 0.6, T)), laugh = iv(S12.LAUGH - 0.1, S12.LAUGH + 0.1, T);
    let fo;
    if (laugh > 0) fo = { mouth: 'grin', mOpen: 0.7 + 0.2 * Math.abs(Math.sin(T * 14)), open: 0, happyClosed: 1, blush: 1, brow: 0.6, tilt: -0.08 + Math.sin(T * 14) * 0.025 };
    else if (wide > 0) fo = { mouth: 'o', mOpen: 0.6, open: 1.35, pupil: 1.3, brow: 1.2, blush: 0.9 };
    else if (b < 0.5) fo = { mouth: 'neutral', open: 0.05, happyClosed: 0, brow: 0.8, blush: 0.7 };
    else fo = { mouth: chew > 0.3 ? 'sip' : 'smile', open: 0, happyClosed: 1, blush: 0.8 + chew * 0.2, brow: 0.5 };
    ctx.save(); ctx.translate(fx, fy + 140 * fs); ctx.scale(1 + chew * 0.03, 1 - chew * 0.025); ctx.translate(-fx, -(fy + 140 * fs));
    PE.face(ctx, fx, fy, fs, Object.assign({ t: T }, fo));
    ctx.restore();
    // cheeks bulge while chewing
    if (b > 0.5 && laugh <= 0) for (const sx of [-1, 1]) { ctx.fillStyle = `rgba(240,120,110,${0.12 + chew * 0.2})`; ell(ctx, fx + sx * 108 * fs, fy + 110 * fs, 36 * fs * (1 + chew * 0.25), 26 * fs); ctx.fill(); }
    glassStrand(ctx, fx, fy, fs, T, 0.15 + chew * 0.3);
    // the bitten piece moves away from the mouth, a sticky thread between teeth and piece
    const away = ease.out(iv(S12.BITE + 0.05, S12.BITE + 0.9, T)), mouth = [fx, fy + 150 * fs];
    const pp = [lerp(fx + 40, fx + 230, away), lerp(fy + 250, fy + 520, away)];
    if (T < S12.THUMB + 0.2) {
      const pr = holdPiece(ctx, pp[0], pp[1], 1.15, -0.5, { t: T, seed: 4, bite: 1 }, { dx: 40, dy: 110, ang: -PI * 0.62 });
      const d = Math.hypot(pr.mouth[0] - mouth[0], pr.mouth[1] - mouth[1]);
      if (slow < 0.35) C.strand(ctx, [mouth[0] + 10, mouth[1] + 4], pr.mouth, { w0: 10, w: Math.max(1.2, 5 - d / 60), sag: 20 + d * 0.12, t: T, seed: 8 });
    }
    // crumbs + steam burst (slow-mo first .45 s)
    if (b >= 0) {
      const rr = rng(77);
      for (let i = 0; i < 26; i++) {
        const a = -PI / 2 + (rr() - 0.5) * 2.6, v = 260 + rr() * 520, sz = 4 + rr() * 9, tt = slow;
        const px = mouth[0] + 60 + Math.cos(a) * v * tt, py = mouth[1] + 20 + Math.sin(a) * v * tt + 700 * tt * tt;
        if (tt > 1.4) continue;
        ctx.globalAlpha = clamp(1 - tt / 1.4); ctx.fillStyle = i % 3 ? '#b6d867' : '#d3953e'; ell(ctx, px, py, sz, sz * 0.8, a); ctx.fill(); ctx.globalAlpha = 1;
      }
      BX.steamEruption(ctx, T, mouth[0] + 170, mouth[1] + 120, 0.55, iv(S12.BITE, S12.BITE + 1.4, T), { seed: 9, alpha: 0.28 * (1 - iv(S12.BITE + 0.8, S12.BITE + 1.5, T)) });
      const hb = hitAt(T, S12.BITE, 0.25); if (hb > 0) L.glow(ctx, mouth[0], mouth[1], 400, 'rgba(255,240,200,1)', 0.5 * hb);
    }
    // thumbs-up
    const th = T - S12.THUMB;
    if (th > -0.15) {
      const k = ease.outBack(clamp((th + 0.15) / 0.35)), y = lerp(2050, 1480, k);
      PE.thumbsUp(ctx, 830, y, 1.45, 0.12 + Math.sin(T * 6) * 0.04);
      const h = hitAt(T, S12.THUMB, 0.5); if (h > 0) { L.sparkle(ctx, 838, y - 160, 90 * h + 20, h); BX.sparkles(ctx, T, 830, y - 120, 1.0, { n: 6, seed: 3, r: 160, alpha: h }); }
    }
  });
}

// ============================================================================================ s13 · FAREWELL, golden hour (51.923 – 57.115)
const S13 = { WAVE: 54.0, TING: 54.6, WHOOSH: 56.9 };
function stallWide() { // golden-hour riverbank + thatched stall (cached, sharp)
  return cached('stallWide', W, H, (x) => {
    BX.riversideScene(x, 30, { dusk: 0.3, horizon: 1010, sun: [330, 860], sunS: 1.4, flare: 0, house: { x: 160, y: 1150, s: 0.55 }, garden: false });
    // bank / path
    x.fillStyle = lgr(x, 0, 1330, 0, H, [[0, '#7a5232'], [0.3, '#5e3c22'], [1, '#2e1c10']]);
    x.beginPath(); x.moveTo(0, 1360); x.bezierCurveTo(300, 1330, 700, 1350, W, 1320); x.lineTo(W, H); x.lineTo(0, H); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(255,190,120,0.45)'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 1360); x.bezierCurveTo(300, 1330, 700, 1350, W, 1320); x.stroke();
    const r = rng(4); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '40,24,12' : '160,110,70'},${0.2 + r() * 0.3})`; ell(x, r() * W, 1360 + r() * 560, 3 + r() * 8, 1.5 + r() * 3); x.fill(); }
    // grass tufts
    for (let i = 0; i < 70; i++) { const gx = r() * W, gy = 1350 + r() * 80; x.strokeStyle = r() < 0.5 ? '#3f6a2a' : '#6a8a3a'; x.lineWidth = 3; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + (k - 1.5) * 6, gy - 20, gx + (k - 1.5) * 12, gy - 34 - r() * 20); x.stroke(); } }
    // stall: posts, thatched roof, table
    const sx = 760;
    for (const px of [560, 980]) { x.fillStyle = lgr(x, px - 14, 0, px + 14, 0, [[0, '#5a3a18'], [0.4, '#b08a4a'], [1, '#4a2e12']]); x.fillRect(px - 14, 860, 28, 560); }
    x.beginPath(); x.moveTo(500, 880); x.lineTo(sx - 40, 700); x.lineTo(sx + 40, 700); x.lineTo(1080, 880); x.lineTo(1080, 930); x.lineTo(500, 930); x.closePath();
    x.fillStyle = lgr(x, 0, 700, 0, 930, [[0, '#c9a060'], [0.6, '#9a7038'], [1, '#6a4a22']]); x.fill();
    x.strokeStyle = 'rgba(80,50,20,0.5)'; x.lineWidth = 2; for (let i = 0; i < 90; i++) { const px = 510 + r() * 560; x.beginPath(); x.moveTo(px, 760 + r() * 60); x.lineTo(px + (r() - 0.5) * 10, 930 + r() * 12); x.stroke(); }
    x.strokeStyle = 'rgba(255,220,150,0.6)'; x.lineWidth = 4; x.beginPath(); x.moveTo(500, 880); x.lineTo(sx - 40, 700); x.lineTo(sx + 40, 700); x.stroke();
    // table
    x.fillStyle = '#6a4024'; x.fillRect(560, 1180, 420, 24); x.fillStyle = '#8a5a34'; x.fillRect(560, 1170, 420, 14);
    for (const px of [580, 960]) { x.fillStyle = '#4a2c16'; x.fillRect(px - 8, 1200, 16, 200); }
    // clay oven on the table end + leaf bundles
    NP.charcoalStove(x, 640, 1172, 0.52, { glow: 0.8, t: 1, embers: false });
    x.fillStyle = '#5a3020'; ell(x, 640, 1062, 64, 16); x.fill(); x.fillStyle = '#2a1a14'; ell(x, 640, 1056, 50, 12); x.fill();
    x.fillStyle = 'rgba(255,120,40,0.85)'; for (let i = 0; i < 9; i++) { ell(x, 610 + i * 7, 1054 + (i % 2) * 3, 4, 3); x.fill(); }
    for (let i = 0; i < 6; i++) { x.strokeStyle = i % 2 ? '#3f8f3a' : '#7fbf4a'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(900, 1166); x.quadraticCurveTo(930 + i * 6, 1110, 960 + i * 4, 1060 - i * 6); x.stroke(); }
  });
}
// people.js tourist head position (replicates its internal maths) for the strand + bag
function touristHead(x, y, s, st) {
  const walk = st.walk, bob = walk !== null && walk !== undefined ? Math.abs(Math.sin(walk)) * -6 : 0, lean = -0.06 + (st.lean || 0);
  const rot = (px, py) => [px * Math.cos(lean) - py * Math.sin(lean), px * Math.sin(lean) + py * Math.cos(lean)];
  const hip = [0, -205 + bob], sh = [hip[0] + rot(0, -150)[0], hip[1] + rot(0, -150)[1]], head = [sh[0] + rot(-6, -52)[0], sh[1] + rot(-6, -52)[1]];
  const sw = walk !== null && walk !== undefined ? Math.sin(walk + Math.PI) : 0, hA = [sh[0] + sw * 40, sh[1] + 140];
  return { head: [x + head[0] * s, y + head[1] * s], hand: [x + hA[0] * s, y + hA[1] * s], glasses: [x + (head[0] - 14) * s, y + (head[1] - 38) * s] };
}
function s13Scene(ctx, T) {
  const k = iv(51.923, 56.9, T), z = lerp(1.45, 1.3, ease.inOut(k)), cx = lerp(600, 470, ease.inOut(k));
  cam(ctx, cx, 1180, z, 0, () => {
    ctx.drawImage(stallWide(), 0, 0);
    L.glow(ctx, 330, 860, 700, 'rgba(255,180,100,1)', 0.45);
    L.godRays(ctx, 330, 860, 0.2, 1.4, 1300, 12, 'rgba(255,200,130,0.9)', 0.12, T);
    // Cô Út behind the table, waving from 54.0
    const wv = T >= S13.WAVE;
    NP.coUt(ctx, 800, 1330, 0.62, { pose: wv ? 'wave' : 'stand', sit: 0, t: T, palette: CO_PAL, expr: 'smile', look: [-0.8, 0], turn: -0.4 });
    ctx.fillStyle = '#6a4024'; ctx.fillRect(560, 1180, 420, 24); ctx.fillStyle = '#8a5a34'; ctx.fillRect(560, 1170, 420, 14);
    C.dome(ctx, 790, 1172, 0.16, { ryr: 0.3, shadowA: 0.4 });
    // tourist walks off to the left with a bag of cakes; dried strand still on his sunglasses
    const wx = lerp(560, 150, iv(51.923, 57.1, T)), wy = 1520, ws = 1.05, walk = T * 7.2;
    const th = touristHead(wx, wy, ws, { walk });
    PE.tourist(ctx, wx, wy, ws, { walk });
    // bag (woven leaf bundle) in the near hand
    ctx.save(); ctx.translate(th.hand[0], th.hand[1]); ctx.rotate(Math.sin(walk) * 0.15);
    ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(0, 20, 10, 0); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-30, 14, 60, 54, 10); ctx.fillStyle = lgr(ctx, -30, 0, 30, 0, [[0, '#4f9a35'], [0.5, '#7fbf4a'], [1, '#2f6e28']]); ctx.fill();
    ctx.strokeStyle = 'rgba(30,70,20,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-26, 26 + i * 14); ctx.lineTo(26, 26 + i * 14); ctx.stroke(); }
    ctx.restore();
    const g = th.glasses, sw = Math.sin(walk) * 0.25;
    C.tail(ctx, [g[0] - 8, g[1] + 4], PI / 2 + 0.6 + sw, 70, { w0: 7, t: T, seed: 3, droop: 0.7 });
    const tg = hitAt(T, S13.TING, 0.5); if (tg > 0) { L.sparkle(ctx, g[0] - 14, g[1] + 30, 40 * tg + 10, tg); }
    L.dust(ctx, T, 61, 30, 0, 500, W, 900, '255,214,150', 2.2, 0.6);
  });
  L.flare(ctx, 330 + (640 - cx) * 0.4, 860, 0.8, 0.35);
}
function s13(ctx, lt, p, T) {
  const wh = iv(S13.WHOOSH, 57.115, T);
  if (wh > 0) L.motionBlurX(ctx, 300 * wh, 6, (x) => { x.save(); x.translate(260 * wh * wh, 0); s13Scene(x, T); x.restore(); });
  else s13Scene(ctx, T);
}

// ============================================================================================ s14 · CTA (57.115 – 62.308)
function heart(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-10, 20, -60, -5, -60, -35); ctx.bezierCurveTo(-60, -65, -20, -75, 0, -45);
  ctx.bezierCurveTo(20, -75, 60, -65, 60, -35); ctx.bezierCurveTo(60, -5, 10, 20, 0, 30); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-30, -42, 12, 7, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}
function ctaLike(ctx, T, t0, tTap, x, y) {
  const k = T - t0; if (k < 0) return;
  const pop = ease.outBack(clamp(k / 0.4)), tapped = T >= tTap;
  const pulse = tapped ? 1 + 0.14 * Math.exp(-(((T - tTap) / BEAT) % 1) * 5) : 1;
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15);
  ctx.beginPath(); ctx.arc(x, y, 105 * pop, 0, TAU); ctx.fillStyle = 'rgba(20,10,8,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.stroke();
  heart(ctx, x, y + 12, 1.15 * pop * pulse, tapped ? '#fe2c55' : 'rgba(255,255,255,0.9)');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '38px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.fillText('THÍCH', x, y + 150); ctx.font = '30px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('LIKE', x, y + 192);
  const f = clamp((T - tTap) / 1.2);
  if (f > 0 && f < 1) { ctx.globalAlpha = Math.sin(f * PI); ctx.font = '60px BodySansBold'; ctx.fillStyle = '#ff5c7a'; ctx.fillText('+1', x + 110, y - 90 - f * 120); }
  ctx.restore();
  const tk = T - tTap; if (tk >= 0 && tk < 0.35) L.glow(ctx, x, y, 220, 'rgba(255,120,150,0.9)', 1 - tk / 0.35);
}
function ctaFollow(ctx, T, t0, tp, x, y) {
  const k = T - t0; if (k < 0) return;
  const sl = ease.outBack(clamp(k / 0.5)), pressed = T >= tp, pk = T - tp;
  const press = pk >= 0 && pk < 0.25 ? 1 - Math.sin(pk / 0.25 * PI) * 0.12 : 1, w = 330, h = 120;
  ctx.save(); ctx.translate(x + (1 - sl) * 500, y); ctx.scale(press, press);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = pressed ? '#5a5a60' : '#fe2c55'; ctx.fill();
  ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!pressed) {
    ctx.font = '46px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOW', 0, -14);
    ctx.font = '28px BodySansBold'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THEO DÕI', 0, 30);
  } else {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-134, -12); ctx.lineTo(-118, 4); ctx.lineTo(-92, -26); ctx.stroke();
    ctx.letterSpacing = '1px'; ctx.fillStyle = '#ffe6b0'; ctx.font = '38px BodySansBold'; ctx.fillText('ĐÃ THEO DÕI', 24, -14);
    ctx.font = '28px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOWING', 24, 30);
  }
  ctx.restore();
  if (pk >= 0 && pk < 0.4) L.glow(ctx, x, y, 260, 'rgba(255,240,220,0.9)', 1 - pk / 0.4);
  if (pk >= 0 && pk < 2.0) {
    const r = rng(515), cols = ['#fe2c55', '#25f4ee', '#ffd76a', '#ffffff', '#7cf07a'];
    ctx.save();
    for (let i = 0; i < 40; i++) {
      const a = -PI / 2 + (r() - 0.5) * 2.8, v = 500 + r() * 700, sz = 8 + r() * 10, spin = (r() - 0.5) * 16;
      ctx.globalAlpha = clamp(1 - pk / 2.0); ctx.fillStyle = cols[i % 5];
      ctx.save(); ctx.translate(x + Math.cos(a) * v * pk * 0.7, y + Math.sin(a) * v * pk * 0.7 + 700 * pk * pk); ctx.rotate(spin * pk); ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
    }
    ctx.restore();
  }
}
const S14 = { HEART0: 57.2, HEART: 57.4, FOL0: 57.6, FOL: 58.3, HOLD: 61.8 };
function s14(ctx, lt, p, T) {
  const Tf = Math.min(T, S14.HOLD), e = ease.inOut(iv(57.115, S14.HOLD, Tf));
  cam(ctx, 540, 1130, lerp(1.0, 1.1, e), 0, () => {
    ctx.drawImage(plate('sunset'), 0, 0);
    ctx.drawImage(woodTable(1060, 0.85), 0, 0);
    L.glow(ctx, SUNP.sunset[0], SUNP.sunset[1], 560, 'rgba(255,150,80,1)', 0.55);
    L.godRays(ctx, SUNP.sunset[0], SUNP.sunset[1], PI / 2, 1.4, 1300, 11, 'rgba(255,170,110,0.9)', 0.16, Tf);
    C.leafPlate(ctx, 540, 1530, 0.92, { ryr: 0.36 });
    C.wedgeCake(ctx, 540, 1515, 1.1, { ryr: 0.36, a0: 0.62, a1: 1.64, removed: true, lift: 3000, piece: false });
    C.piece(ctx, 870, 1660, 0.78, 0.25, { t: Tf, seed: 9, strands: 0.6 });
    C.cakeSteam(ctx, Tf, 540, 1360, { w: 260, h: 640, n: 12, alpha: 0.34, seed: 13, r: 70 });
    if (T < S14.HOLD) { BX.sparkles(ctx, Tf, 540, 1330, 1.3, { n: 6, seed: 14, r: 260, alpha: 0.6 }); }
    L.dust(ctx, Tf, 5, 24, 0, 520, W, 800, '255,200,140', 2.6, 0.6);
  });
  L.flare(ctx, SUNP.sunset[0] + 10, SUNP.sunset[1] - 60, 0.9, 0.45);
  ctaLike(ctx, Tf, S14.HEART0, S14.HEART, 300, 680);
  ctaFollow(ctx, Tf, S14.FOL0, S14.FOL, 700, 680);
}

module.exports = { s1, s7, s8, s9, s10, s11, s12, s13, s14 };
