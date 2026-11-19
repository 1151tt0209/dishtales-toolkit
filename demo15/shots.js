'use strict';
// Bánh xèo miền Tây: 15 s DEMO (written by Sonnet, no Opus agents). 108 BPM grid: beat 0.5556 s, 27 beats = 15.0 s.
// s1 pour (0–2.78) · s2 shrimp/pork/sprouts drop in (–4.44) · s3 crisp + fold (–6.67) · s4 hero plate (–8.33)
// s5 Má Tư wraps + dips (–10.0) · s6 tourist bite (–11.11, bite 10.45) · s7 sunset CTA (–15.0)
// Each sN(ctx, lt, p, T) paints the full opaque frame; render.js adds grade/flash/grain, overlay.js adds all text.
const BX = require('./bxprops');
const L = require('./lib');
const NP = BX.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;
const BEAT = 60 / 108;
const iv = (a, b, v) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const BITE = 10.45;
// camera that never shows the outside of the 1080x1920 plates: the view centre is clamped to the image
const cam = (ctx, cx, cy, z, rot, fn) => L.cam(ctx, clamp(cx, 540 / z, W - 540 / z), clamp(cy, 960 / z, H - 960 / z), z, rot, fn);

// ------------------------------------------------------------------ caches (blur only here, never per frame)
const CACHE = {};
function cached(key, fn) { if (!CACHE[key]) { const c = createCanvas(W, H); fn(c.getContext('2d')); CACHE[key] = c; } return CACHE[key]; }
function blurOf(src, px) { const c = createCanvas(W, H), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; return c; }
const lgr = (x, x0, y0, x1, y1, st) => { const g = x.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };

function kitchenBlur() {
  return cached('kb', (x) => {
    const t = createCanvas(W, H), tx = t.getContext('2d');
    BX.kitchenInterior(tx, 0.3, { view: 'wide', dusk: 0.12, fire: 1, beams: true, smoke: 0.6 });
    tx.fillStyle = 'rgba(14,6,8,0.35)'; tx.fillRect(0, 0, W, H);
    x.drawImage(blurOf(t, 16), 0, 0);
  });
}
function stoveTop() { // clay stove from above
  return cached('st', (x) => {
    const g = x.createRadialGradient(540, 1060, 200, 540, 1060, 1200);
    g.addColorStop(0, '#6a3a26'); g.addColorStop(0.5, '#3e2218'); g.addColorStop(1, '#170c0a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r = rng(41);
    for (let i = 0; i < 240; i++) {
      const px = r() * W, py = r() * H, rr = 4 + r() * 26;
      x.fillStyle = r() < 0.5 ? `rgba(20,10,8,${0.08 + r() * 0.15})` : `rgba(150,90,60,${0.04 + r() * 0.08})`;
      x.beginPath(); x.ellipse(px, py, rr * 1.6, rr, r() * PI, 0, TAU); x.fill();
    }
    x.save(); x.globalCompositeOperation = 'screen'; x.rotate(-0.5);
    for (let i = 0; i < 7; i++) { x.fillStyle = `rgba(255,150,70,${0.05 + r() * 0.04})`; x.fillRect(-600 + i * 260, -200, 60 + r() * 50, 3000); }
    x.restore();
  });
}
function tableTop() { // wooden table from above (s5)
  return cached('tt', (x) => {
    const r = rng(77);
    for (let i = 0; i < 8; i++) {
      const x0 = i * 140 - 20, v = 0.82 + r() * 0.3;
      x.fillStyle = lgr(x, x0, 0, x0 + 140, 0, [[0, `rgb(${(128 * v) | 0},${(80 * v) | 0},${(46 * v) | 0})`], [1, `rgb(${(100 * v) | 0},${(60 * v) | 0},${(34 * v) | 0})`]]);
      x.fillRect(x0, 0, 140, H);
      x.strokeStyle = 'rgba(40,20,10,0.55)'; x.lineWidth = 4; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, H); x.stroke();
      x.strokeStyle = 'rgba(60,32,16,0.22)'; x.lineWidth = 2;
      for (let k = 0; k < 6; k++) { const gx = x0 + 15 + r() * 110; x.beginPath(); x.moveTo(gx, 0); for (let yy = 0; yy <= H; yy += 120) x.lineTo(gx + Math.sin(yy * 0.004 + k) * 10, yy); x.stroke(); }
    }
    x.save(); x.globalCompositeOperation = 'screen'; x.rotate(0.55);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(255,170,90,${0.07 + r() * 0.05})`; x.fillRect(200 + i * 230, -900, 70 + r() * 60, 3400); }
    x.restore();
    const v = x.createRadialGradient(540, 1100, 300, 540, 1100, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(18,8,6,0.7)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
  });
}
const SUN = [640, 760];
function sunsetPlate(dusk) { // blurred riverside plate (hero + CTA backgrounds)
  return cached('sp' + dusk, (x) => {
    const t = createCanvas(W, H), tx = t.getContext('2d');
    BX.riversideScene(tx, 12, { dusk, horizon: 1000, sun: SUN, sunS: 1.4, flare: 0, house: { x: 240, y: 1160, s: 0.75 }, garden: false });
    x.drawImage(blurOf(t, 9), 0, 0);
  });
}
function woodTable(ty) { // planks in perspective from y=ty down (hero + CTA)
  return cached('wt' + ty, (x) => {
    const r = rng(23), n = 9;
    for (let k = 0; k < n; k++) {
      const y0 = ty + (H - ty) * Math.pow(k / n, 1.5), y1 = ty + (H - ty) * Math.pow((k + 1) / n, 1.5), v = 0.86 + r() * 0.22;
      x.fillStyle = lgr(x, 0, y0, 0, y1, [[0, `rgb(${(176 * v) | 0},${(98 * v) | 0},${(58 * v) | 0})`], [1, `rgb(${(132 * v) | 0},${(70 * v) | 0},${(40 * v) | 0})`]]);
      x.fillRect(0, y0, W, y1 - y0 + 1);
      x.strokeStyle = 'rgba(70,30,14,0.35)'; x.lineWidth = 1 + (y1 - y0) / 60;
      for (let q = 0; q < 4; q++) { const yy = lerp(y0, y1, 0.15 + r() * 0.7); x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(300, yy + (r() - 0.5) * 12, 700, yy + (r() - 0.5) * 12, W, yy + (r() - 0.5) * 8); x.stroke(); }
      x.fillStyle = 'rgba(40,14,6,0.7)'; x.fillRect(0, y1 - 2 - (y1 - y0) * 0.03, W, 2 + (y1 - y0) * 0.03);
    }
    x.fillStyle = 'rgba(255,210,150,0.75)'; x.fillRect(0, ty - 2, W, 5);
    x.fillStyle = lgr(x, 0, ty, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,8,10,0.45)']]); x.fillRect(0, ty, W, H - ty);
  });
}

// ------------------------------------------------------------------ cook's arm + hand
function sleeve(ctx, x0, y0, x1, y1, w = 52) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = BX.MATU.aobaD; ctx.lineWidth = w + 6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = BX.MATU.aoba; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,150,80,0.45)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 - 10, y0 - 18); ctx.lineTo(x1 - 10, y1 - 18); ctx.stroke();
  ctx.restore();
}
function armHand(ctx, fx, fy, gx, gy, s = 1, kind = 'grip', w = 60) {
  const dx = gx - fx, dy = gy - fy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const wx = gx - ux * 55 * s, wy = gy - uy * 55 * s;
  sleeve(ctx, fx, fy, wx - ux * 8, wy - uy * 8, w * s);
  NP.cHand(ctx, wx, wy, s, Math.atan2(uy, ux), { kind, flip: ux < 0 });
}
function stoveSlab(ctx, T, y0, px, py, prx) { // clay slab in front + flames around the pan
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 900);
  g.addColorStop(0, '#5a3020'); g.addColorStop(0.25, '#3a1e14'); g.addColorStop(1, '#120806');
  ctx.fillStyle = g; ctx.fillRect(-300, y0, W + 600, 1400);
  ctx.strokeStyle = 'rgba(255,170,100,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
  const fl = 0.85 + 0.15 * Math.sin(T * 23) * Math.sin(T * 7.3);
  L.glow(ctx, px, py + 30, prx * 1.5, 'rgba(255,100,30,1)', 0.55 * fl);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 9; i++) {
    const a = PI * (0.05 + i * 0.1125), fx = px + Math.cos(a) * prx * 1.02, fy = py + Math.sin(a) * prx * 0.42 + 6;
    const hh = (30 + 22 * Math.sin(T * 17 + i * 2.1)) * (prx / 300);
    const fg = ctx.createLinearGradient(fx, fy, fx, fy - hh); fg.addColorStop(0, 'rgba(255,190,90,0.9)'); fg.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(fx, fy - hh / 2, 12 * (prx / 300), hh / 2, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ================================================================ s1 · hook: batter hits the hot pan (0 – 2.78)
function s1(ctx, lt, p, T) {
  const HIT = 0.3, sh = hitAt(T, HIT, 0.5) * 9, r = rng(Math.floor(T * 30));
  cam(ctx, 540 + (r() - 0.5) * sh, 1060 + (r() - 0.5) * sh, lerp(1.04, 1.4, ease.inOut(p)), 0, () => {
    ctx.drawImage(stoveTop(), 0, 0);
    const px = 540, py = 1060, ps = 1.5;
    L.glow(ctx, px, py, 760, 'rgba(255,90,30,1)', 0.35 + 0.05 * Math.sin(T * 21));
    const b = ease.out(iv(HIT, 1.7, T));
    const sw = iv(0.4, 1.8, T), a = (T - HIT) * 3.0;
    const pr = BX.pan(ctx, px, py, ps, { ryr: 1, handle: 0.35, oil: 1, t: T, batter: b, cook: 0.18 * iv(1.4, 2.6, T), meat: 0, pourAt: [-30 + Math.cos(a) * 22 * sw, -20 + Math.sin(a) * 22 * sw], contentRot: 0.3 });
    // ladle swings in from the right, tips over the centre, then leaves
    const k = ease.out(iv(0, 0.28, T)), out = iv(1.0, 1.6, T);
    const lx = lerp(1180, 700, k) + out * 400, ly = 560 - 30 * k - out * 160;
    const ld = BX.ladle(ctx, lx, ly, 1.3, -0.15 - 0.55 * k + out * 0.2, { fill: 1 - iv(0.3, 1.15, T) });
    armHand(ctx, 1260, ly - 120 - out * 100, ld.grip[0] + 10, ld.grip[1] + 4, 1.0, 'grip', 80);
    if (T > 0.27 && T < 1.2) BX.pourStream(ctx, ld.lip[0], ld.lip[1], px - 30, py - 20, T, { col: 'batter', w: 22, k: iv(0.27, 0.4, T), tail: iv(0.95, 1.2, T) });
    BX.oilSparkle(ctx, T * 0.4, px, py - 10, 1.7, { n: 24, w: 640, h: 560, alpha: 1 });
    L.steam(ctx, T, 3, px, py - 60, 420, 800, 9, 0.28 * iv(HIT, 0.9, T));
  });
}

// ================================================================ s2 · shrimp, pork, sprouts drop into the pan (2.78 – 4.44)
const DROPS = [ // kind, landing time, landing offset in the pan, rot
  ['shrimp', 3.05, -120, -40, 0.4], ['pork', 3.28, 60, -80, -0.3], ['shrimp', 3.5, -20, 70, -0.6],
  ['pork', 3.72, 120, 40, 0.5], ['shrimp', 3.94, -150, 50, 0.9], ['sprouts', 4.1, 0, 0, 0],
];
function s2(ctx, lt, p, T) {
  const px = 540, py = 1180, ps = 1.7;
  cam(ctx, 540, 1100, lerp(1.04, 1.14, ease.inOut(p)), lerp(0.0, 0.015, p), () => {
    ctx.drawImage(kitchenBlur(), 0, 0);
    stoveSlab(ctx, T, 1070, px, py, 245 * ps);
    const pr = BX.pan(ctx, px, py, ps, { ryr: 0.45, handle: PI * 0.95, oil: 1, t: T, batter: 1, cook: 0.2, meat: ease.out(iv(3.0, 4.0, T)), searing: iv(3.0, 4.4, T), sprouts: iv(4.05, 4.4, T), pourAt: [0, 0], contentRot: 0.3 });
    if (pr.grip) armHand(ctx, 1210, 1500, pr.grip[0] - 20, pr.grip[1] + 10, 1.2, 'grip', 58);
    // falling pieces (gravity), drawn until they land
    for (const [kind, tl, ox, oy, rot] of DROPS) {
      const t0 = tl - 0.42, u = iv(t0, tl, T);
      if (u <= 0 || T > tl + 0.04) continue;
      const lx = px + ox * ps * 0.8, ly = py - 30 + oy * ps * 0.4, sx = lx + (1 - u) * 90, y = lerp(150, ly, u * u);
      if (kind === 'shrimp') BX.shrimp(ctx, sx, y, 1.5, rot + (1 - u) * 3, { sear: 0.2 });
      else if (kind === 'pork') BX.porkSlice(ctx, sx, y, 1.5, rot + (1 - u) * 2, { sear: 0.2 });
      else for (let i = 0; i < 9; i++) BX.sprout(ctx, lx - 160 + i * 40 + (1 - u) * 40, lerp(60 + (i % 3) * 90, ly, u * u), 1.3, (i * 1.7) % 6, {});
    }
    for (const [, tl, ox, oy] of DROPS) { const h = hitAt(T, tl, 0.28); if (h > 0) L.sparkle(ctx, px + ox * ps * 0.8, py - 40 + oy * ps * 0.4, 36 * h + 10, h * 0.8); }
    BX.oilSparkle(ctx, T * 0.45, px, py - 40, 1.6, { n: 20, w: 620, h: 130, alpha: 1 });
    L.godRays(ctx, 1080, 200, 2.3, 0.2, 1800, 6, 'rgba(255,170,90,1)', 0.3, T);
    L.steam(ctx, T, 5, px, py - 60, 380, 760, 8, 0.3 * iv(3.0, 3.6, T));
  });
}

// ================================================================ s3 · crisp up and fold (4.44 – 6.67)
function s3(ctx, lt, p, T) {
  const px = 540, py = 1180, ps = 1.7, FOLD0 = 5.15, FOLD1 = 6.05, CLOSE = FOLD1 - 0.05;
  const sh = hitAt(T, CLOSE, 0.4) * 7, r = rng(Math.floor(T * 30));
  cam(ctx, 540 + (r() - 0.5) * sh, 1100 + (r() - 0.5) * sh, lerp(1.1, 1.24, ease.inOut(p)), lerp(0.02, -0.015, p), () => {
    ctx.drawImage(kitchenBlur(), 0, 0);
    stoveSlab(ctx, T, 1070, px, py, 245 * ps);
    const fold = ease.inOut(iv(FOLD0, FOLD1, T));
    const pr = BX.pan(ctx, px, py, ps, { ryr: 0.45, handle: PI * 0.95, oil: 1, t: T, batter: 1, meat: 1, searing: 1, sprouts: 1, mungBeans: 1, cook: ease.out(iv(4.44, 5.4, T)), fold, pourAt: [0, 0], contentRot: 0.3 });
    if (pr.grip) armHand(ctx, 1210, 1500, pr.grip[0] - 20, pr.grip[1] + 10, 1.2, 'grip', 58);
    // spatula slides under the far half and lifts it
    const su = iv(4.95, FOLD0, T), sv = iv(FOLD1, FOLD1 + 0.4, T);
    if (su > 0 && sv < 1) {
      const tx = lerp(1000, 640, ease.out(su)) + 520 * sv, ty = py - 120 - 160 * fold;
      const sp = BX.spatula(ctx, tx, ty, 1.3, -0.15 - 0.5 * fold, {});
      if (sp && sp.grip) armHand(ctx, 1300, 800 - 120 * fold, sp.grip[0] + 10, sp.grip[1] + 6, 1.0, 'grip', 72);
    }
    BX.crumbBurst(ctx, T, CLOSE, px + 20, py - 120, 1.2, { n: 24, seed: 3, spread: 1.0 });
    BX.oilSparkle(ctx, T * 0.4, px, py - 40, 1.6, { n: 18, w: 600, h: 120, alpha: 0.9 });
    L.steam(ctx, T, 7, px, py - 60, 380, 760, 8, 0.32);
    L.godRays(ctx, 1080, 200, 2.3, 0.2, 1800, 6, 'rgba(255,170,90,1)', 0.3, T);
  });
}

// ================================================================ s4 · hero: plate, steam, slow orbit (6.67 – 8.33)
function s4(ctx, lt, p, T) {
  const e = ease.inOut(p), ryr = 0.3, plX = 540, plY = 1300, LAND = 6.95;
  cam(ctx, 540, 1150, lerp(1.04, 1.18, e), lerp(0.01, -0.01, e), () => {
    ctx.drawImage(sunsetPlate(0.1), 0, 0);
    ctx.drawImage(woodTable(1010), 0, 0);
    L.glow(ctx, SUN[0], SUN[1], 480, 'rgba(255,190,110,1)', 0.45);
    L.godRays(ctx, SUN[0], SUN[1], PI / 2, 1.4, 1250, 11, 'rgba(255,214,150,0.9)', 0.16, T);
    BX.herbBasket(ctx, 150, 1130, 0.62, { view: '3q', fill: 1, seed: 2 });
    BX.fishSauceBowl(ctx, 935, 1140, 0.8, { ryr: 0.35, fill: 0.9, chili: 1, garlic: 1, t: T, seed: 5 });
    BX.plate(ctx, plX, plY, 1.32, { ryr, shadow: true });
    const land = ease.out(iv(6.67, LAND, T)), by = lerp(560, plY - 24, land);
    BX.banhXeo(ctx, plX, by, 1.55, { ryr, fold: 1, crisp: 1, steam: 0.75, t: T, seed: 4, shadow: true, rot: lerp(-0.35, 0.5, ease.inOut(iv(LAND, 8.3, T))) });
    BX.crumbBurst(ctx, T, LAND, plX + 190, by - 20, 1.0, { n: 20, seed: 7, spread: 1.0 });
    L.steam(ctx, T, 11, plX, by - 60, 300, 640, 10, 0.34 * land);
    BX.sparkles(ctx, T, plX, by - 100, 1.3, { n: 8, seed: 12, r: 280, alpha: iv(7.2, 7.6, T) });
    L.dust(ctx, T, 5, 28, 0, 500, W, 800, '255,220,160', 2.6, 0.6);
  });
  L.flare(ctx, SUN[0] + 10, SUN[1] - 20, 0.9, 0.5);
}

// ================================================================ s5 · Má Tư rolls the leaf and dips it (8.33 – 10.0)
function s5(ctx, lt, p, T) {
  const bx = 540, by = 1420, DIP = 9.35;
  cam(ctx, 540, 1100, lerp(1.0, 1.08, p), 0, () => {
    ctx.drawImage(tableTop(), 0, 0);
    L.godRays(ctx, 1080, 200, 2.3, 0.2, 1800, 6, 'rgba(255,170,90,1)', 0.25, T);
    BX.herbBasket(ctx, 250, 760, 0.62, { view: 'top', fill: 1, seed: 3 });
    const bowl = BX.fishSauceBowl(ctx, bx, by, 2.0, { ryr: 0.5, fill: 0.95, chili: 1, garlic: 1, t: T, seed: 5 });
    const roll = ease.inOut(iv(8.33, 9.15, T)), down = ease.inOut(iv(9.0, DIP, T)), up = ease.inOut(iv(DIP + 0.1, DIP + 0.5, T));
    const wy = lerp(760, by - 90, down) - (by - 90 - 760) * 0 - up * 260 + (1 - roll) * 40;
    const wx = bx + 20 * (1 - roll);
    const wr = BX.leafWrap(ctx, wx, wy, 1.45, { k: roll, rot: lerp(-0.25, 0, roll), dip: iv(DIP - 0.15, DIP + 0.05, T), seed: 3 });
    armHand(ctx, 1240, wy - 240, wx + 24, wy - 10, 1.2, 'pinch', 76);
    if (T > DIP && T < DIP + 0.7) { // sauce ripples
      const u = iv(DIP, DIP + 0.7, T);
      ctx.save(); ctx.strokeStyle = `rgba(255,214,150,${0.8 * (1 - u)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(bx, by - 28, 60 + u * 140, 22 + u * 52, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
    BX.sparkles(ctx, T, bx, by - 80, 1.2, { n: 6, seed: 9, r: 240, alpha: iv(DIP + 0.4, DIP + 0.7, T) });
    L.dust(ctx, T, 8, 22, 0, 300, W, 1300, '255,220,160', 2.2, 0.5);
  });
}

// ================================================================ s6 · the bite (10.0 – 11.11)
function s6(ctx, lt, p, T) {
  const bitten = T >= BITE, z = lerp(1.0, 1.12, ease.inOut(p)) + (bitten ? 0.03 * Math.exp(-(T - BITE) * 7) : 0);
  ctx.drawImage(sunsetPlate(0.1), 0, 0);
  ctx.fillStyle = 'rgba(255,170,80,0.18)'; ctx.fillRect(0, 0, W, H);
  L.glow(ctx, 860, 420, 600, 'rgba(255,230,170,1)', 0.35);
  let ret = null;
  cam(ctx, 540, 1000, z, 0, () => {
    const k = bitten ? 1 : lerp(0.35, 1, ease.in(iv(10.0, BITE, T)));
    ret = BX.tourist(ctx, 540, 2160, 3.4, { t: T, pose: 'wrapBite', k, vest: false, stool: true, expr: bitten ? 'crunch' : undefined });
  });
  if (bitten) {
    const m = (ret && ret.wrap) || [600, 1000];
    BX.crumbBurst(ctx, T, BITE, m[0], m[1], 1.5, { n: 34, seed: 5, spread: 1.3 });
    BX.crunchWord(ctx, 500, 560, 1.1, { t: T, k: iv(BITE, BITE + 0.15, T) + 0.2 * iv(BITE + 0.15, BITE + 0.6, T), shake: 1, rot: 0.06, vi: 'RỘP!', en: 'CRUNCH!' });
    const f = iv(BITE + 0.2, BITE + 0.4, T); if (f > 0) BX.sparkles(ctx, T, 540, 960, 1.4, { n: 7, seed: 31, r: 380, alpha: 0.7 * f });
  }
  L.dust(ctx, T, 41, 20, 0, 300, W, 1400, '255,236,190', 2.2, 0.5);
}

// ================================================================ s7 · sunset CTA (11.11 – 15.0)
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
  const pulse = tapped ? 1 + 0.14 * Math.exp(-((T / BEAT) % 1) * 5) : 1;
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
  if (pk >= 0 && pk < 2.0) { // confetti
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
function s7(ctx, lt, p, T) {
  const HOLD = 14.6, e = ease.inOut(iv(11.11, HOLD, T)), plX = 540, plY = 1330, ryr = 0.28;
  cam(ctx, 540, 1150, lerp(1.0, 1.14, e), 0, () => {
    ctx.drawImage(sunsetPlate(0.55), 0, 0);
    ctx.drawImage(woodTable(1040), 0, 0);
    L.glow(ctx, SUN[0], SUN[1] + 120, 520, 'rgba(255,140,80,1)', 0.55);
    L.godRays(ctx, SUN[0], SUN[1] + 120, PI / 2, 1.4, 1300, 11, 'rgba(255,170,110,0.9)', 0.18, T);
    BX.herbBasket(ctx, 150, 1160, 0.62, { view: '3q', fill: 1, seed: 2 });
    BX.fishSauceBowl(ctx, 935, 1170, 0.8, { ryr: 0.35, fill: 0.9, chili: 1, garlic: 1, t: T, seed: 5 });
    BX.plate(ctx, plX, plY, 1.32, { ryr, shadow: true });
    BX.banhXeo(ctx, plX, plY - 24, 1.55, { ryr, fold: 1, crisp: 1, steam: 0.8, t: T, seed: 4, shadow: true, rot: 0.5 });
    L.steam(ctx, T * (T > HOLD ? 0 : 1) + (T > HOLD ? HOLD : 0), 13, plX, plY - 80, 300, 640, 10, 0.34);
    if (T < HOLD) { BX.sparkles(ctx, T, plX, plY - 130, 1.3, { n: 6, seed: 14, r: 280, alpha: 0.7 }); L.dust(ctx, T, 5, 24, 0, 520, W, 800, '255,200,140', 2.6, 0.6); }
  });
  L.flare(ctx, SUN[0] + 10, SUN[1] + 100, 0.9, 0.5);
  ctaLike(ctx, T, 11.67, 12.22, 300, 640);
  ctaFollow(ctx, T, 12.0, 12.78, 700, 640);
}

const CUTS = [0, 5, 8, 12, 15, 18, 20, 27];
const r3 = x => Math.round(x * 1000) / 1000;
const FN = [s1, s2, s3, s4, s5, s6, s7];
const SHOTS = FN.map((draw, i) => ({ id: i + 1, start: r3(CUTS[i] * BEAT), end: r3(CUTS[i + 1] * BEAT), draw }));
module.exports = { SHOTS, BEAT, DUR: 15.0, BITE, HOLD: 14.6 };
