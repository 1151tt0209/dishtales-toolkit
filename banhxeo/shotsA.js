'use strict';
// shotsA.js — "Bánh xèo miền Tây" shots 1..8 (0 – 23.04 s). 125 BPM swing grid: beat 0.48 s, bar 1.92 s.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes (8.64) and grain.
// Look: 5 PM golden hour on a Mekong canal (dusk ≈ 0.05–0.15); the kitchen is dark, lit red by the fire, sunset beams through slats.
const BX = require('./bxprops');
const X = require('./text');
const L = require('./lib');
const NP = BX.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- beat helpers
const BEAT = 0.48;
const beat = T => ((T / BEAT) % 1 + 1) % 1;
const seg01 = (v, a, b) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cap = (ctx, T, s0, s1, vi, en, n) => X.caption(ctx, T, s0 + 0.15, s1 - 0.1, vi, en, { n, y: 360 });

// ---------------------------------------------------------------- one-time caches (blur allowed only here)
const CACHE = {};
function cached(name, w, h, fn) {
  if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; }
  return CACHE[name];
}
function blurred(name, w, h, blur, fn) {
  return cached(name, w, h, (x) => {
    const tmp = createCanvas(w, h); fn(tmp.getContext('2d'));
    x.filter = `blur(${blur}px)`; x.drawImage(tmp, 0, 0); x.filter = 'none';
  });
}

// out-of-focus dark kitchen (s3, s7, s8 backdrop)
function kitchenBlur() {
  return blurred('kblur', W, H, 16, (x) => {
    BX.kitchenInterior(x, 0.3, { view: 'wide', dusk: 0.12, fire: 1, beams: true, smoke: 0.6 });
    x.fillStyle = 'rgba(14,6,8,0.35)'; x.fillRect(0, 0, W, H);
  });
}
// clay stove top seen from above (s4 backdrop): dark terracotta + soot, the pan hole glows
function stoveTop() {
  return cached('stoveTop', W, H, (x) => {
    const g = x.createRadialGradient(540, 1150, 200, 540, 1150, 1200);
    g.addColorStop(0, '#6a3a26'); g.addColorStop(0.5, '#3e2218'); g.addColorStop(1, '#170c0a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r = rng(41);
    for (let i = 0; i < 260; i++) {
      const px = r() * W, py = r() * H, rr = 4 + r() * 26;
      x.fillStyle = r() < 0.5 ? `rgba(20,10,8,${0.08 + r() * 0.15})` : `rgba(150,90,60,${0.04 + r() * 0.08})`;
      x.beginPath(); x.ellipse(px, py, rr * 1.6, rr, r() * PI, 0, TAU); x.fill();
    }
    // cracks
    x.strokeStyle = 'rgba(15,6,4,0.45)'; x.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      let px = r() * W, py = r() * H; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 90; py += (r() - 0.5) * 90; x.lineTo(px, py); }
      x.stroke();
    }
    // bamboo slat shadows (sunset beams cut by the wall)
    x.save(); x.globalCompositeOperation = 'screen'; x.rotate(-0.5);
    for (let i = 0; i < 7; i++) { x.fillStyle = `rgba(255,150,70,${0.05 + r() * 0.04})`; x.fillRect(-600 + i * 260, -200, 60 + r() * 50, 3000); }
    x.restore();
  });
}
// warm wooden prep table from above (s5, s6)
function tableTop() {
  return cached('tableTop', W, H, (x) => {
    const r = rng(77);
    for (let i = 0; i < 8; i++) {
      const x0 = i * 140 - 20, v = 0.82 + r() * 0.3, g = x.createLinearGradient(x0, 0, x0 + 140, 0);
      g.addColorStop(0, `rgb(${(128 * v) | 0},${(80 * v) | 0},${(46 * v) | 0})`);
      g.addColorStop(1, `rgb(${(100 * v) | 0},${(60 * v) | 0},${(34 * v) | 0})`);
      x.fillStyle = g; x.fillRect(x0, 0, 140, H);
      x.strokeStyle = 'rgba(40,20,10,0.55)'; x.lineWidth = 4; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, H); x.stroke();
      x.strokeStyle = `rgba(60,32,16,0.22)`; x.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const gx = x0 + 15 + r() * 110; x.beginPath(); x.moveTo(gx, 0);
        for (let yy = 0; yy <= H; yy += 120) x.lineTo(gx + Math.sin(yy * 0.004 + k) * 10, yy);
        x.stroke();
      }
    }
    // sunset beam through the slats (diagonal warm stripes) + darker corners
    x.save(); x.globalCompositeOperation = 'screen'; x.rotate(0.55);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(255,170,90,${0.07 + r() * 0.05})`; x.fillRect(200 + i * 230, -900, 70 + r() * 60, 3400); }
    x.restore();
    const v = x.createRadialGradient(540, 1100, 300, 540, 1100, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(18,8,6,0.7)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
  });
}

// draw a full-frame cached canvas with a gentle push (zoom around cx,cy)
function drawPush(ctx, img, z, cx = W / 2, cy = H / 2) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy); ctx.drawImage(img, 0, 0); ctx.restore();
}
// foreground clay stove slab (3q close-ups): top surface from y0, fire glow licking around the pan
function stoveSlab(ctx, T, y0, px, py, prx) {
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 900);
  g.addColorStop(0, '#5a3020'); g.addColorStop(0.25, '#3a1e14'); g.addColorStop(1, '#120806');
  ctx.fillStyle = g; ctx.fillRect(-300, y0, W + 600, 1400);
  ctx.strokeStyle = 'rgba(255,170,100,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
  const fl = 0.85 + 0.15 * Math.sin(T * 23) * Math.sin(T * 7.3);
  L.glow(ctx, px, py + 30, prx * 1.5, 'rgba(255,100,30,1)', 0.55 * fl);
  // flame tongues peeking around the pan rim
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 9; i++) {
    const a = PI * (0.05 + i * 0.1125), fx = px + Math.cos(a) * prx * 1.02, fy = py + Math.sin(a) * prx * 0.42 + 6;
    const hh = (30 + 22 * Math.sin(T * 17 + i * 2.1)) * (prx / 300);
    const fg = ctx.createLinearGradient(fx, fy, fx, fy - hh);
    fg.addColorStop(0, 'rgba(255,190,90,0.9)'); fg.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(fx, fy - hh / 2, 12 * (prx / 300), hh / 2, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// Má Tư's arm from (fx,fy) (off-frame) to a hand gripping at (gx,gy): maroon sleeve + cartoon hand along the arm
function armHand(ctx, fx, fy, gx, gy, s = 1, kind = 'grip', w = 60) {
  const dx = gx - fx, dy = gy - fy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const wx = gx - ux * 55 * s, wy = gy - uy * 55 * s, rot = Math.atan2(uy, ux);
  sleeve(ctx, fx, fy, wx - ux * 8, wy - uy * 8, w * s);
  NP.cHand(ctx, wx, wy, s, rot, { kind, flip: ux < 0 });
}
function fireLight(ctx, T, a = 1) {
  const fl = 0.85 + 0.15 * Math.sin(T * 19) * Math.sin(T * 5.1);
  L.glow(ctx, 540, 1700, 1000, 'rgba(255,80,30,1)', 0.28 * fl * a);
}
function sleeve(ctx, x0, y0, x1, y1, w = 52) {
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = BX.MATU.aobaD; ctx.lineWidth = w + 6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = BX.MATU.aoba; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,150,80,0.45)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0 - 10, y0 - 18); ctx.lineTo(x1 - 10, y1 - 18); ctx.stroke();
  ctx.restore();
}

// ================================================================ s1 · drone glide down the canal (0 – 3.84)
function s1(ctx, lt, p, T) {
  // drone: glides along the canal (panX), tilts down from the sun to the house and pushes in
  const e = ease.inOut(p), zoom = lerp(1.0, 1.22, e);
  const r = BX.riversideScene(ctx, T, {
    dusk: 0.05 + 0.04 * p, sunS: 1.35, flare: 0.75, panX: lerp(-220, 0, ease.out(p)),
    cam: { zoom, cx: lerp(540, 600, e), cy: lerp(820, 1060, e) },
  });
  // a little line of ducks paddling in front of the house
  if (r.camXY) { const q = r.camXY([300 + lt * 22, 1420]); BX.duckLine(ctx, T, q[0], q[1], 0.42 * zoom, 4, { pose: 'swim' }); }
  L.dust(ctx, T, 11, 26, 0, 500, W, 900, '255,220,160', 3, 0.5);
  X.label(ctx, T, 0.35, 3.7, 'NHÀ VEN SÔNG · 5 GIỜ CHIỀU', 'Mekong riverside home · 5 PM', 300);
}

// ================================================================ s2 · arrival in the xuồng, the house goes XÈÈO! (3.84 – 6.72)
function s2(ctx, lt, p, T) {
  const z = lerp(1.0, 1.06, ease.inOut(p));
  let win = null;
  L.cam(ctx, lerp(520, 580, p), 960, z, 0, () => {
    const r = BX.riversideScene(ctx, T, { dusk: 0.1, sunS: 1.2, flare: 0.55, house: { x: 810, y: 1150, s: 0.66 } });
    win = r.house && r.house.window;
    BX.duckLine(ctx, T, 640 + lt * 26, 1820, 0.62, 3, { pose: 'swim' });
    // the boat glides in toward the ladder
    const bx = lerp(230, 400, ease.out(p));
    const sniff = seg01(T, 4.75, 5.15) * (1 - seg01(T, 5.75, 5.95));
    const perk = seg01(T, 5.8, 6.0);
    BX.touristInXuong(ctx, bx, 1600, 0.78, { t: T, sniff, perk, vest: false, pack: true });
    // sunglasses bounce on perk (little sparkle above his head)
    if (perk > 0) BX.sparkles(ctx, T, bx + 60, 1170, 0.7, { n: 4, r: 70, alpha: perk * (1 - seg01(T, 6.4, 6.7)) });
  });
  // comic word from the kitchen window
  if (T > 4.6) {
    const wx = win ? clamp(540 + (win[0] - 540) * z, 330, 700) : 640;
    const wy = win ? Math.min(win[1] * z - 200, 700) : 640;
    BX.sizzleWord(ctx, wx, wy, 0.5, { t: T, k: seg01(T, 4.6, 4.95), shake: 0.5 * (1 - seg01(T, 5.0, 6.0)), rot: 0.06, vi: 'XÈÈO!', en: 'SIZZLE!', out: seg01(T, 6.35, 6.65) });
  }
}

// ================================================================ s3 · Má Tư pours the first ladle in the dark kitchen (6.72 – 8.64)
function s3(ctx, lt, p, T) {
  drawPush(ctx, kitchenBlur(), lerp(1.12, 1.2, p), 540, 900);
  // Má Tư behind the stove, lit by fire from below
  BX.maTuFace(ctx, 810, 640, 1.0, { expr: 'calm', t: T, turn: -0.25, look: [-0.5, 0.6] });
  { const g = ctx.createLinearGradient(0, 200, 0, 1450); g.addColorStop(0, 'rgba(12,4,8,0.45)'); g.addColorStop(0.6, 'rgba(12,4,8,0.15)'); g.addColorStop(1, 'rgba(12,4,8,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 1450); }
  fireLight(ctx, T, 1.3);
  // pan on the fire
  const px = 470, py = 1470, ps = 1.38;
  stoveSlab(ctx, T, 1215, px, py, 245 * ps);
  const k = seg01(lt, 0.05, 0.45), b = ease.out(seg01(lt, 0.35, 1.7));
  const pr = BX.pan(ctx, px, py, ps, { ryr: 0.4, handle: PI, oil: 1, t: T, batter: b, pourAt: [-30, -20] });
  // ladle tipping over the pan, Má Tư's arm comes from the upper right
  const cx = 590, cy = 1250 - 30 * k;
  const ld = BX.ladle(ctx, cx, cy, 1.25, -0.35 * k, { fill: 1 - seg01(lt, 0.4, 1.6) });
  sleeve(ctx, 1120, 1080, ld.grip[0] + 30, ld.grip[1] + 10, 70);
  NP.cHand(ctx, ld.grip[0] + 18, ld.grip[1] + 4, 0.95, PI + 0.4, { kind: 'grip' });
  if (lt > 0.35 && lt < 1.75) {
    const fl = pr.floor || [px, py];
    BX.pourStream(ctx, ld.lip[0], ld.lip[1], fl[0] - 30, fl[1] - 10, T, { col: 'batter', w: 18, k: seg01(lt, 0.35, 0.55), tail: seg01(lt, 1.45, 1.75) });
  }
  // steam explodes up through the sunset beam
  const sk = seg01(lt, 0.55, 1.92);
  L.godRays(ctx, 1080, 140, 2.25, 0.22, 1700, 5, 'rgba(255,170,90,1)', 0.35, T);
  if (sk > 0) BX.steamEruption(ctx, T, px, py - 40, 1.1, ease.out(sk), { seed: 3, sun: true, alpha: 0.85 });
  BX.oilSparkle(ctx, T, px, py - 30, 1.2, { n: 12, w: 420, h: 70, alpha: 0.9 });
}

// ================================================================ s4 · TITLE over the sizzling pan from above (8.64 – 11.52)
function s4(ctx, lt, p, T) {
  const z = lerp(1.0, 1.16, ease.inOut(p));
  ctx.drawImage(stoveTop(), 0, 0);
  L.cam(ctx, 540, lerp(960, 1010, p), z, lerp(0, 0.03, p), () => {
    drawPush(ctx, stoveTop(), 1.12, 540, 1150);
    const fl = 0.85 + 0.15 * Math.sin(T * 21) * Math.sin(T * 6.7);
    L.glow(ctx, 540, 1200, 500, 'rgba(255,90,30,1)', 0.7 * fl);
    BX.pan(ctx, 540, 1200, 1.45, { view: 'top', handle: 0.35, oil: 1, t: T, batter: 1, cook: lerp(0.12, 0.7, p), rot: T * 0.05 });
    BX.oilSparkle(ctx, T, 540, 1200, 1.4, { n: 16, w: 560, h: 480, alpha: 0.85 });
    BX.smokeWisp(ctx, T, 400, 1100, 1.3, { seed: 2, alpha: 0.5, h: 420 });
    BX.smokeWisp(ctx, T + 1.3, 690, 1170, 1.2, { seed: 5, alpha: 0.45, h: 380 });
  });
  // soft dark band behind the title so it reads over the warm stove
  const a = clamp((T - 8.7) / 0.3) * (1 - seg01(T, 11.0, 11.5));
  const g = ctx.createLinearGradient(0, 150, 0, 690);
  g.addColorStop(0, 'rgba(10,4,4,0)'); g.addColorStop(0.5, `rgba(10,4,4,${0.45 * a})`); g.addColorStop(1, 'rgba(10,4,4,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 150, W, 540);
  X.title(ctx, T, 8.74, 11.42, 400, 'Mekong Sizzling Crêpe', 'BÁNH XÈO', 'MIỀN TÂY');
}

// ================================================================ s5 · ① batter: rice flour, coconut milk, turmeric (11.52 – 14.4)
function coconutHalf(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#4a2c18'; ctx.beginPath(); ctx.arc(0, 0, 100, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f6f1e6'; ctx.beginPath(); ctx.arc(0, 0, 84, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(200,190,170,0.6)'; ctx.beginPath(); ctx.arc(8, 8, 60, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(30,16,8,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 100, 0, TAU); ctx.stroke();
  ctx.restore();
}
function turmericRoot(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = '#b8783a'; ctx.strokeStyle = 'rgba(50,24,10,0.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 60, 18, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(30, -22, 28, 12, -0.8, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9a1a'; ctx.beginPath(); ctx.ellipse(-60, 0, 8, 16, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function s5(ctx, lt, p, T) {
  const z = lerp(1.0, 1.06, p);
  const bx = 540, by = 1150, bs = 1.55;
  L.cam(ctx, 540, 960, z, 0, () => {
    ctx.drawImage(tableTop(), 0, 0);
    coconutHalf(ctx, 170, 1640, 1.1);
    turmericRoot(ctx, 900, 1660, 1.2, 0.4); turmericRoot(ctx, 960, 1560, 0.9, -0.6);
    const mix = ease.inOut(seg01(lt, 1.55, 2.75));
    const fill = 0.45 + 0.55 * ease.out(seg01(lt, 0.2, 1.3));
    const tur = seg01(lt, 0.95, 1.55) * (1 - mix);
    BX.batterBowl(ctx, bx, by, bs, { view: 'top', fill, mix, turmeric: tur, t: T });
    // rice flour first, then coconut milk, from top left
    if (lt < 0.8) BX.pourStream(ctx, 180, 640, bx - 60, by - 40, T, { col: 'flour', w: 26, k: seg01(lt, 0.0, 0.2), tail: seg01(lt, 0.55, 0.8) });
    if (lt > 0.55 && lt < 1.4) BX.pourStream(ctx, 900, 620, bx + 60, by - 20, T, { col: 'milk', w: 22, k: seg01(lt, 0.55, 0.75), tail: seg01(lt, 1.15, 1.4) });
    BX.turmericSprinkle(ctx, T, 11.52 + 0.95, bx + 10, 780, { n: 70, dur: 0.7, w: 80, floor: by });
    if (lt > 0.95 && lt < 1.7) armHand(ctx, -120, 520, bx - 10, 780, 1.0, 'pinch');
    // whisk: loops in the bowl circling, handle up-right toward the camera
    if (lt > 1.45) {
      const a = (lt - 1.45) * TAU * 2.1, wx = bx + Math.cos(a) * 90, wy = by + Math.sin(a) * 80;
      const wr = BX.whisk(ctx, wx, wy, 1.5, 0.55 + Math.sin(a) * 0.08, { t: T, spin: a });
      armHand(ctx, 1200, 560 + Math.sin(a) * 40, wr.grip[0], wr.grip[1], 1.0, 'grip');
    }
  });
  cap(ctx, T, 11.52, 14.4, 'Bột gạo, nước cốt dừa, nghệ', 'Rice flour, coconut milk, turmeric', 1);
}

// ================================================================ s6 · ② chop the scallions on the beat (14.4 – 17.28)
function s6(ctx, lt, p, T) {
  ctx.drawImage(tableTop(), 0, 0);
  // batter bowl waiting at the top right
  const bwX = 760, bwY = 820;
  const landed = seg01(T, 16.75, 16.95);
  BX.batterBowl(ctx, bwX, bwY, 0.95, { view: '3q', fill: 1, mix: 1, scallions: landed, t: T });
  const bdX = 470, bdY = 1330;
  BX.cuttingBoard(ctx, bdX, bdY, 1.5, { view: '3q' });
  // 4 chops land on the beats 14.4 / 14.88 / 15.36 / 15.84
  const nb = Math.floor((T - 14.4) / BEAT + 1e-6) + 1, chops = clamp(nb, 0, 4);
  const cut = chops / 4;
  const sc = BX.scallionBunch(ctx, bdX - 20, bdY - 30, 1.35, { cut, sq: 0.45 });
  let lift;
  if (T < 15.84) lift = Math.sin(PI * beat(T)) * 0.9;
  else lift = ease.out(seg01(T, 15.84, 16.2));
  const kx = sc.cutX[0], ky = sc.cutX[1] + 6;
  if (T < 16.3) {
    const kr = BX.knife(ctx, kx, ky, 1.25, -0.05, { lift });
    armHand(ctx, 1200, kr.grip[1] + 160, kr.grip[0] + 40, kr.grip[1], 1.0, 'grip');
    // chop impact
    for (const tb of [14.4, 14.88, 15.36, 15.84]) {
      const h = hitAt(T, tb, 0.18);
      if (h > 0) BX.sparkles(ctx, T, kx, ky, 0.5 * h + 0.3, { n: 5, r: 60, alpha: h });
    }
  }
  // a handful of rings tossed into the batter
  if (T > 16.25 && T < 16.95) {
    const u = seg01(T, 16.25, 16.9), ex = lerp(bdX + 60, bwX, u), ey = lerp(bdY - 60, bwY, u) - Math.sin(PI * u) * 260;
    BX.scallionRings(ctx, ex, ey, 1.1, { n: 18, spread: 40 + 30 * u, seed: 4 });
    armHand(ctx, 1200, 1700, ex + 40, ey + 50, 1.1, 'open');
  }
  if (landed > 0 && landed < 1) BX.sparkles(ctx, T, bwX, bwY - 30, 0.8, { n: 6, r: 90, alpha: 1 - landed });
  cap(ctx, T, 14.4, 17.28, 'Thêm hành lá', 'Add scallions', 2);
}

// ================================================================ s7 · ③ sear shrimp & pork, spatula on the beat (17.28 – 20.16)
function s7(ctx, lt, p, T) {
  drawPush(ctx, kitchenBlur(), lerp(1.25, 1.3, p), 540, 1000);
  fireLight(ctx, T, 1.1);
  const px = 540, py = 1260, ps = 1.6;
  // toss bumps on 18.72 / 19.2 / 19.68
  let bump = 0; for (const tb of [18.72, 19.2, 19.68]) bump = Math.max(bump, hitAt(T, tb, 0.3));
  ctx.save(); ctx.translate(0, -bump * 10);
  stoveSlab(ctx, T, 1180, px, py + bump * 10, 245 * ps);
  const meat = T < 17.9 ? 0 : T < 18.38 ? 0.5 : 1;
  const searing = ease.inOut(seg01(T, 18.3, 20.0));
  BX.pan(ctx, px, py, ps, { ryr: 0.42, handle: PI * 0.92, oil: 1, t: T, meat, searing, contentRot: bump * 0.25 + p * 0.4 });
  ctx.restore();
  // pieces dropping in: shrimp land on 17.76, pork on 18.24
  const drops = [
    { tb: 17.76, kind: 'shrimp', x: 470, y: 1250, r: 0.4 }, { tb: 17.76, kind: 'shrimp', x: 610, y: 1290, r: -0.8 },
    { tb: 18.24, kind: 'pork', x: 560, y: 1225, r: 0.2 }, { tb: 18.24, kind: 'pork', x: 440, y: 1300, r: -0.4 },
  ];
  for (const d of drops) {
    const u = seg01(T, d.tb - 0.32, d.tb);
    if (u <= 0 || u >= 1) continue;
    const y = lerp(560, d.y, u * u), rr = d.r + (1 - u) * 2;
    if (d.kind === 'shrimp') BX.shrimp(ctx, d.x, y, 1.5, rr, { sear: 0 }); else BX.porkSlice(ctx, d.x, y, 1.5, rr, { sear: 0 });
  }
  // tossed pieces in the air on the spatula beats
  for (const tb of [18.72, 19.2, 19.68]) {
    const u = (T - tb) / 0.42; if (u < 0 || u > 1) continue;
    const r = rng(Math.round(tb * 100));
    for (let i = 0; i < 4; i++) {
      const x0 = px - 120 + r() * 240, hgt = 120 + r() * 120, dx = (r() - 0.5) * 120;
      const x = x0 + dx * u, y = py - 10 - Math.sin(PI * u) * hgt, rot = u * 5 * (r() - 0.5);
      if (i % 2) BX.shrimp(ctx, x, y, 1.4, rot, { sear: searing }); else BX.porkSlice(ctx, x, y, 1.4, rot, { sear: searing });
    }
  }
  // spatula: rests then flicks on the beats
  if (T > 18.3) {
    const ph = beat(T), fl = T > 18.6 ? Math.sin(PI * ph) : 0;
    const sx = px + 40 + Math.cos(T * 4) * 60, sy = py + 20 - fl * 70;
    const sp = BX.spatula(ctx, sx, sy, 1.5, -0.35 - fl * 0.35);
    armHand(ctx, 1220, 900, sp.grip[0] + 40, sp.grip[1], 1.05, 'grip');
  }
  BX.oilSparkle(ctx, T, px, py - 30, 1.4, { n: 14 + Math.round(bump * 10), w: 520, h: 90, alpha: 0.95 });
  if (searing > 0.2) BX.smokeWisp(ctx, T, px - 80, py - 60, 1.2, { seed: 7, alpha: 0.5 * searing, h: 360 });
  if (searing > 0.2) BX.smokeWisp(ctx, T + 0.7, px + 110, py - 50, 1.1, { seed: 9, alpha: 0.4 * searing, h: 320 });
  cap(ctx, T, 17.28, 20.16, 'Tôm, thịt xào thơm', 'Sear shrimp & pork', 3);
}

// ================================================================ s8 · ④ HERO: pour… XÈO! slow-motion steam (20.16 – 23.04)
function s8(ctx, lt, p, T) {
  const hit = 21.12, sh = hitAt(T, hit, 0.7) * 10;
  const z = lerp(1.0, 1.1, ease.inOut(p));
  const r = rng(Math.floor(T * 30));
  L.cam(ctx, 540 + (r() - 0.5) * sh, 1060 + (r() - 0.5) * sh, z, 0, () => {
    drawPush(ctx, kitchenBlur(), 1.35, 540, 900);
    fireLight(ctx, T, 1.2);
    const sw = seg01(T, 20.9, 22.6), a = (T - 20.9) * 3.2;
    const px = 540 + Math.cos(a) * 14 * sw, py = 1300 + Math.sin(a) * 6 * sw, ps = 1.75;
    stoveSlab(ctx, T, 1200, px, py, 245 * ps);
    const b = ease.out(seg01(T, 20.55, 22.2));
    const pr = BX.pan(ctx, px, py, ps, { ryr: 0.4, handle: PI * 0.95, oil: 1, t: T, meat: 1, searing: 1, batter: b, cook: 0.12 * seg01(T, 22.0, 23.0), pourAt: [-40 + Math.cos(a) * 30 * sw, -30 + Math.sin(a) * 30 * sw], contentRot: 0.4 });
    // Má Tư's left hand on the handle swirls the pan
    if (pr.grip) { sleeve(ctx, -60, 1560, pr.grip[0] - 30, pr.grip[1] + 20, 76); NP.cHand(ctx, pr.grip[0] - 30, pr.grip[1] + 10, 1.2, 0.1, { kind: 'grip' }); }
    // ladle pours from the upper right
    const k = seg01(T, 20.2, 20.55), out = seg01(T, 21.5, 22.0);
    const cx = 640 + out * 300, cy = 1050 - 40 * k - out * 200;
    const ld = BX.ladle(ctx, cx, cy, 1.35, -0.6 * k - out * 0.3, { fill: 1 - seg01(T, 20.5, 21.6) });
    sleeve(ctx, 1160, 980 - out * 200, ld.grip[0] + 30, ld.grip[1] + 10, 72);
    NP.cHand(ctx, ld.grip[0] + 18, ld.grip[1] + 4, 1.0, PI + 0.4, { kind: 'grip' });
    if (T > 20.45 && T < 21.75) BX.pourStream(ctx, ld.lip[0], ld.lip[1], px - 50, py - 20, T, { col: 'batter', w: 22, k: seg01(T, 20.45, 20.6), tail: seg01(T, 21.45, 21.75) });
    // slow-motion steam burst through the beam
    L.godRays(ctx, 1080, 220, 2.3, 0.2, 1800, 6, 'rgba(255,170,90,1)', 0.38, T);
    const sk = seg01(T, hit - 0.1, 23.04);
    if (sk > 0) BX.steamEruption(ctx, T * 0.4, px, py - 50, 1.35, ease.out(sk) * 0.85, { seed: 8, sun: true, alpha: 0.9 });
    BX.oilSparkle(ctx, T * 0.35, px, py - 40, 1.6, { n: 22, w: 640, h: 120, alpha: 1 });
  });
  if (T > hit - 0.02) {
    const k = seg01(T, hit - 0.02, hit + 0.3);
    BX.sizzleWord(ctx, 500, 820, 0.95, { t: T, k, shake: 0.8 * (1 - seg01(T, hit, hit + 1.4)) + 0.15, vi: 'XÈÈÈO!', en: 'SIZZLE!', rot: -0.07, out: seg01(T, 22.75, 23.0) });
  }
  cap(ctx, T, 20.16, 23.04, 'Đổ bột, nghe XÈO!', 'Pour… hear it SIZZLE!', 4);
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8 };
