'use strict';
// shotsB.js — "Bánh xèo miền Tây" shots 9..15 (23.04 – 44.16 s). 125 BPM swing grid: beat 0.48 s, bar 1.92 s.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes (28.8, 40.32) and grain.
// Look: Act II kitchen (dark, red fire glow) → golden sunset on the deck table → Act III sunset on the stilt-house deck.
const BX = require('./bxprops');
const X = require('./text');
const L = require('./lib');
const NP = BX.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- helpers
const BEAT = 0.48;
const beat = T => ((T / BEAT) % 1 + 1) % 1;
const iv = (a, b, v) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cap = (ctx, T, t0, t1, vi, en, n) => X.caption(ctx, T, t0, t1, vi, en, { n, y: 360 });
const lgr = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const SKIN_A = ['#ecbb92', '#d9a27a', '#b27a58'];
const SKIN = '#d9a27a', SLEEVE = (BX.MATU && BX.MATU.aoba) || '#7a2430';
const BOKEH_W = ['rgba(255,214,150,1)', 'rgba(255,170,110,1)', 'rgba(255,236,190,1)'];

// camera that never shows outside the 1080x1920 canvas
function cam(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  L.cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}
const CACHE = {};
function cached(name, w, h, fn) {
  if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; }
  return CACHE[name];
}
// Má Tư's arm entering from off-frame: maroon sleeve (long, always leaves the frame), skin forearm, cartoon hand.
// (hx,hy) = wrist-ish point, ang = direction shoulder → hand.
function armIn(ctx, hx, hy, ang, s, kind = 'grip', flip = false) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(30,10,10,0.28)'; ctx.lineWidth = 70 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 1800 + 26, hy - sn * 1800 + 36); ctx.lineTo(hx + 26, hy + 36); ctx.stroke();
  ctx.strokeStyle = SKIN; ctx.lineWidth = 44 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 220 * s, hy - sn * 220 * s); ctx.lineTo(hx - c * 10 * s, hy - sn * 10 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,180,0.5)'; ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 200 * s - sn * 14 * s, hy - sn * 200 * s + c * -14 * s); ctx.lineTo(hx - c * 30 * s - sn * 14 * s, hy - sn * 30 * s - c * 14 * s); ctx.stroke();
  ctx.strokeStyle = SLEEVE; ctx.lineWidth = 76 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 1800, hy - sn * 1800); ctx.lineTo(hx - c * 170 * s, hy - sn * 170 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,8,14,0.55)'; ctx.lineWidth = 6 * s; // cuff seam
  ctx.beginPath(); ctx.moveTo(hx - c * 172 * s - sn * 36 * s, hy - sn * 172 * s + c * 36 * s); ctx.lineTo(hx - c * 172 * s + sn * 36 * s, hy - sn * 172 * s - c * 36 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,190,150,0.35)'; ctx.lineWidth = 8 * s; // rim light
  ctx.beginPath(); ctx.moveTo(hx - c * 1800 - sn * 30 * s, hy - sn * 1800 + c * 30 * s * -1); ctx.lineTo(hx - c * 180 * s - sn * 30 * s, hy - sn * 180 * s - c * 30 * s); ctx.stroke();
  ctx.restore();
  NP.cHand(ctx, hx - c * 20 * s, hy - sn * 20 * s, s, ang, { kind, skin: SKIN_A, flip });
}
// a drawFn "falling from the camera" (top-down): big + soft → lands at scale 1 on tLand (+ small squash bounce)
function dropIn(ctx, T, tLand, dur, x, y, cx, cy, drawFn) {
  const u = clamp((T - (tLand - dur)) / dur);
  if (u <= 0) return false;
  const e = ease.in2(u), sc = u < 1 ? lerp(3.0, 1, e) : 1 + 0.08 * hitAt(T, tLand, 0.25);
  const px = u < 1 ? lerp(x + (x - cx) * 1.4, x, e) : x, py = u < 1 ? lerp(y + (y - cy) * 1.4, y, e) : y;
  ctx.save(); ctx.globalAlpha = u < 1 ? clamp(u * 2.2) * lerp(0.75, 1, e) : 1;
  ctx.translate(px, py); ctx.scale(sc, sc); drawFn(ctx); ctx.restore();
  return u >= 1;
}
function garlicBit(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(4, -7); ctx.lineTo(8, 0); ctx.lineTo(5, 6); ctx.lineTo(-6, 5); ctx.closePath();
  ctx.fillStyle = '#f6eed6'; ctx.fill(); ctx.strokeStyle = 'rgba(120,96,60,0.7)'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-4, -4, 5, 2);
  ctx.restore();
}
function chiliRing(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ell(ctx, 0, 0, 10, 8); ctx.fillStyle = '#d42a1c'; ctx.fill();
  ctx.strokeStyle = 'rgba(80,10,6,0.7)'; ctx.lineWidth = 1.3; ctx.stroke();
  ell(ctx, 0, 0, 5.5, 4.2); ctx.fillStyle = '#f2c060'; ctx.fill();
  ctx.fillStyle = '#fff3c8'; ell(ctx, -1.5, -1, 1.4, 1); ctx.fill(); ell(ctx, 1.8, 1, 1.4, 1); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,200,0.8)'; ell(ctx, -4, -4, 3, 1.4, -0.6); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- cached backgrounds
// top-down clay stove top (s9): canvas (W+200)x(H+200), drawn at (-100,-100)
const PAN9 = [540, 1010], PAN9S = 1.8;
function stoveTop() {
  return cached('bxStoveTop', W + 200, H + 200, (x) => {
    const r = rng(17); x.translate(100, 100);
    x.fillStyle = lgr(x, 0, -100, 0, H + 100, [[0, '#6e3a24'], [0.45, '#8e4e2e'], [1, '#5a2c1a']]); x.fillRect(-100, -100, W + 200, H + 200);
    for (let i = 0; i < 520; i++) {
      const xx = -100 + r() * (W + 200), yy = -100 + r() * (H + 200), rr = 4 + r() * 30;
      x.fillStyle = r() < 0.5 ? `rgba(40,16,8,${0.05 + r() * 0.12})` : `rgba(255,190,140,${0.03 + r() * 0.07})`;
      ell(x, xx, yy, rr, rr * (0.5 + r() * 0.5), r() * PI); x.fill();
    }
    x.strokeStyle = 'rgba(40,14,6,0.45)'; x.lineWidth = 2.5;
    for (let i = 0; i < 16; i++) {
      let xx = r() * W, yy = r() * H; x.beginPath(); x.moveTo(xx, yy);
      for (let k = 0; k < 5; k++) { xx += (r() - 0.5) * 90; yy += (r() - 0.3) * 70; x.lineTo(xx, yy); } x.stroke();
    }
    // fire mouth around the pan: charred dark ring with ember glow
    const [px, py] = PAN9, R = 245 * PAN9S;
    let g = x.createRadialGradient(px, py, R * 0.9, px, py, R * 1.45);
    g.addColorStop(0, 'rgba(10,4,2,1)'); g.addColorStop(0.25, 'rgba(40,12,4,0.95)'); g.addColorStop(0.6, 'rgba(60,24,10,0.5)'); g.addColorStop(1, 'rgba(60,24,10,0)');
    x.fillStyle = g; x.fillRect(px - R * 1.5, py - R * 1.5, R * 3, R * 3);
    // little props on the stove top: bowl of sprouts (bottom-left), garlic + chilies (bottom-right)
    const bx = 150, by = 1700;
    x.fillStyle = 'rgba(20,8,4,0.4)'; ell(x, bx + 14, by + 18, 150, 150); x.fill();
    x.fillStyle = lgr(x, bx - 140, by - 140, bx + 140, by + 140, [[0, '#ffffff'], [1, '#cfd6dc']]); ell(x, bx, by, 140, 140); x.fill();
    x.strokeStyle = '#3b6fb0'; x.lineWidth = 7; ell(x, bx, by, 128, 128); x.stroke();
    for (let i = 0; i < 46; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 110; BX.sprout(x, bx + Math.cos(a) * d, by + Math.sin(a) * d, 0.55, r() * TAU, {}); }
    for (let i = 0; i < 9; i++) garlicBit(x, 930 + r() * 120, 1720 + r() * 120, 2.4, r() * TAU);
    for (let i = 0; i < 7; i++) chiliRing(x, 960 + r() * 110, 1600 + r() * 90, 2.2, r() * TAU);
  });
}
// deck-table background (s11, s13, s14): soft-focus sunset river behind, warm wooden table top from y≈1000.
const TABLE_Y = 1000, SUN_T = [560, 830];
function deckTable() {
  return cached('bxDeckTable', W, H, (x) => {
    const src = createCanvas(W, H), sx = src.getContext('2d');
    BX.riversideScene(sx, 3, { horizon: 930, dusk: 0.36, sun: SUN_T, sunS: 1.4, flare: 0, house: null, garden: false });
    const m1 = createCanvas(360, 640), m2 = createCanvas(180, 320);
    m1.getContext('2d').drawImage(src, 0, 0, 360, 640); m2.getContext('2d').drawImage(m1, 0, 0, 180, 320);
    m1.getContext('2d').drawImage(m2, 0, 0, 360, 640);
    x.imageSmoothingQuality = 'high'; x.drawImage(m1, 0, 0, W, H);
    // table top: planks running left–right, in perspective
    const r = rng(23), n = 9, ty = TABLE_Y;
    for (let k = 0; k < n; k++) {
      const y0 = ty + (H - ty) * Math.pow(k / n, 1.5), y1 = ty + (H - ty) * Math.pow((k + 1) / n, 1.5), v = 0.86 + r() * 0.22;
      x.fillStyle = lgr(x, 0, y0, 0, y1, [[0, `rgb(${(176 * v) | 0},${(98 * v) | 0},${(58 * v) | 0})`], [1, `rgb(${(132 * v) | 0},${(70 * v) | 0},${(40 * v) | 0})`]]);
      x.fillRect(0, y0, W, y1 - y0 + 1);
      x.strokeStyle = 'rgba(70,30,14,0.35)'; x.lineWidth = 1 + (y1 - y0) / 60;
      for (let q = 0; q < 4; q++) {
        const yy = lerp(y0, y1, 0.15 + r() * 0.7); x.beginPath(); x.moveTo(0, yy);
        x.bezierCurveTo(300, yy + (r() - 0.5) * 12, 700, yy + (r() - 0.5) * 12, W, yy + (r() - 0.5) * 8); x.stroke();
      }
      x.fillStyle = 'rgba(40,14,6,0.7)'; x.fillRect(0, y1 - 2 - (y1 - y0) * 0.03, W, 2 + (y1 - y0) * 0.03);
      x.fillStyle = 'rgba(255,214,160,0.18)'; x.fillRect(0, y0, W, 2 + (y1 - y0) * 0.02);
    }
    // far edge highlight + warm sunset sheen on the varnish
    x.fillStyle = 'rgba(255,210,150,0.75)'; x.fillRect(0, ty - 2, W, 5);
    const g = x.createRadialGradient(SUN_T[0], ty + 40, 10, SUN_T[0], ty + 40, 700);
    g.addColorStop(0, 'rgba(255,190,120,0.55)'); g.addColorStop(1, 'rgba(255,190,120,0)');
    x.save(); x.globalCompositeOperation = 'screen'; x.translate(0, 0); x.scale(1, 0.6); x.fillStyle = g;
    x.fillRect(0, (ty - 700) / 0.6, W, 1400 / 0.6); x.restore();
    x.fillStyle = lgr(x, 0, ty, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,8,10,0.45)']]); x.fillRect(0, ty, W, H - ty);
  });
}

// =================================================================================================== S9 23.04–25.92
// ⑤ top-down pan: bean sprouts + mung beans land on the bottom half; the lid drops on at 25.44 (clank).
const S9_SPR = Array.from({ length: 9 }, (_, i) => { const r = rng(300 + i); return { tl: 23.3 + i * 0.07 + r() * 0.05, a: r() * TAU, dx: (r() - 0.5) * 300, dy: 40 + r() * 180, rot: r() * TAU }; });
const S9_BEAN = Array.from({ length: 4 }, (_, i) => { const r = rng(400 + i); return { tl: 24.0 + i * 0.12, dx: (r() - 0.5) * 260, dy: 60 + r() * 150, seed: 40 + i }; });
const LID9 = 25.44;
function s9(ctx, lt, p, T) {
  const e = ease.inOut(p), clank = hitAt(T, LID9, 0.35);
  const sh = clank * 14 * Math.sin(T * 90);
  const [px, py] = PAN9, s = PAN9S, R = 245 * s;
  cam(ctx, 540, 1000, 1.05 + 0.07 * e + 0.02 * clank, -0.01 + 0.015 * e, () => {
    ctx.save(); ctx.translate(sh, sh * 0.6);
    ctx.drawImage(stoveTop(), -100, -100);
    // flames licking around the pan rim
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 34; i++) {
      const a = i / 34 * TAU + Math.sin(T * 2 + i) * 0.05, fl = 0.55 + 0.45 * Math.sin(T * 11 + i * 2.7) * Math.sin(T * 7.3 + i);
      const r0 = R * 0.98, r1 = R * (1.1 + 0.12 * fl);
      const x0 = px + Math.cos(a) * r0, y0 = py + Math.sin(a) * r0, x1 = px + Math.cos(a) * r1, y1 = py + Math.sin(a) * r1;
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(255,200,80,0.55)'); g.addColorStop(0.5, 'rgba(255,110,30,0.35)'); g.addColorStop(1, 'rgba(200,40,10,0)');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(px + Math.cos(a - 0.09) * r0, py + Math.sin(a - 0.09) * r0); ctx.quadraticCurveTo(x1 + Math.cos(a + 1.5) * 10, y1 + Math.sin(a + 1.5) * 10, x1, y1);
      ctx.lineTo(px + Math.cos(a + 0.09) * r0, py + Math.sin(a + 0.09) * r0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const cook = lerp(0.5, 0.72, p);
    const pr = BX.pan(ctx, px, py, s, { view: 'top', handle: 0.55, oil: 0.4, t: T, meat: 1, searing: 1, cook, sprouts: iv(23.35, 24.0, T), mungBeans: iv(24.05, 24.55, T), seed: 9 });
    const cc = pr.crepeCenter || [px, py];
    if (T < LID9) BX.oilSparkle(ctx, T, cc[0], cc[1], 1.1, { n: 10, seed: 3, w: 560, h: 520, alpha: 0.55 });
    // falling toppings (from the camera)
    for (const q of S9_SPR) if (T < q.tl + 0.05) dropIn(ctx, T, q.tl, 0.4, cc[0] + q.dx, cc[1] + q.dy, 540, 900, (c) => { for (let k = 0; k < 4; k++) BX.sprout(c, k * 9 - 14, k * 6 - 8, 1.1, q.rot + k * 0.4, {}); });
    for (const q of S9_BEAN) if (T < q.tl + 0.05) dropIn(ctx, T, q.tl, 0.4, cc[0] + q.dx, cc[1] + q.dy, 540, 900, (c) => BX.mungBeans(c, 0, 0, 1.2, { n: 7, seed: q.seed, spread: 30 }));
    // the lid: comes down from above (big → rest size), shadow grows on the crêpe
    const lu = iv(LID9 - 0.62, LID9, T);
    if (lu > 0) {
      const le = ease.in2(lu), ls = lerp(1.75, 1, le) * 245 * s / 240;
      ctx.save(); ctx.globalAlpha = 0.35 * le; ctx.fillStyle = '#1a0a04';
      ell(ctx, px + lerp(160, 10, le), py + lerp(220, 14, le), R * lerp(1.15, 1.0, le), R * lerp(1.15, 1.0, le)); ctx.fill(); ctx.restore();
      const lx = lerp(px + 330, px, le), ly = lerp(py - 520, py, le);
      BX.lid(ctx, lx, ly, ls, { view: 'top', rot: lerp(0.5, 0, le) + clank * 0.04 * Math.sin(T * 60) });
      if (lu >= 1) {
        // steam escaping under the rim
        L.steam(ctx, T, 31, px - R * 0.75, py - R * 0.2, 120, 260, 4, 0.35);
        L.steam(ctx, T + 0.4, 32, px + R * 0.8, py + R * 0.1, 120, 260, 4, 0.32);
        if (clank > 0) { ctx.save(); ctx.globalAlpha = clank; ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 5; ell(ctx, px, py, R * (1.02 + 0.25 * (1 - clank)), R * (1.02 + 0.25 * (1 - clank))); ctx.stroke(); ctx.restore(); }
      }
    }
    ctx.restore();
    L.glow(ctx, px - 300, py - 520, 520, 'rgba(255,170,90,0.9)', 0.22);
  });
  cap(ctx, T, 23.19, 25.82, 'Giá, đậu xanh, đậy nắp', 'Bean sprouts, mung beans, lid on', 5);
}

// =================================================================================================== S10 25.92–28.8
// ⑥ kitchen stove: lid off (steam puff), golden lacy edges, the spatula folds the crêpe in half.
function s10(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const zoom = lerp(1.8, 1.98, e), ccx = lerp(330, 300, e), ccy = lerp(1060, 1100, e);
  cam(ctx, ccx, ccy, zoom, 0, () => {
    const K = BX.kitchenInterior(ctx, T, { view: 'stove', dusk: 0.2, fire: 1, beams: true, smoke: 0.6 });
    const P = K.pans[0], ryr = P.ry / P.rx, cx = P.x, cy = P.y + 3, cs = 1.0, RR = 200 * cs;
    const fold = ease.inOut(iv(27.0, 27.95, T));
    BX.crepeStage(ctx, cx, cy, cs, { ryr, t: T, seed: 9, meat: 1, searing: 1, cook: 1, sprouts: 1, mungBeans: 1, fold });
    BX.oilSparkle(ctx, T, cx, cy - 10, 0.7, { n: 8, seed: 5, w: 420, h: 60, alpha: 0.6 });
    // lid lifting off (hand on the knob) + steam puff
    const lu = ease.inOut(iv(25.98, 26.55, T));
    BX.steamEruption(ctx, T, cx, cy - 10, 0.42, iv(26.02, 27.7, T), { seed: 4, sun: true, alpha: 0.5 }); L.steam(ctx, T, 21, cx, cy - 30, 300, 420, 7, 0.3 * iv(25.98, 26.3, T));
    if (lu < 1) {
      const lx = cx + 330 * lu, ly = cy - 4 - 520 * lu;
      const lr = BX.lid(ctx, lx, ly, 0.97, { ryr: lerp(ryr, 0.6, lu), rot: 0.35 * lu });
      const kn = (lr && lr.knob) || [lx, ly - 60];
      armIn(ctx, kn[0] + 20, kn[1] - 6, 2.35, 0.75, 'grip');
    }
    // spatula: slides under the far edge, then follows it over
    const su = iv(26.55, 27.0, T), out = ease.in2(iv(28.15, 28.6, T));
    if (su > 0 && out < 1) {
      const th = fold * PI, z = RR * Math.sin(th), yp = -RR * Math.cos(th) * 0.92;
      const ex = cx + 30 + 40 * fold, ey = cy + yp * ryr - z * Math.sqrt(1 - ryr * ryr) * 0.45;
      const appr = 1 - ease.out(su);
      const tx = ex + 260 * appr + 380 * out, ty = ey - 160 * appr - 260 * out;
      const rot = lerp(-0.25, -0.75, fold);
      const sp = BX.spatula(ctx, tx, ty, 0.82, rot, {});
      const gp = (sp && sp.grip) || [tx + 260 * Math.cos(rot), ty + 260 * Math.sin(rot)];
      armIn(ctx, gp[0], gp[1], 2.5 + rot * 0.4, 0.72, 'grip');
    }
    if (fold > 0.98) BX.sparkles(ctx, T, cx, cy - 20, 0.8, { n: 6, seed: 8, r: 200, alpha: iv(27.95, 28.2, T) });
  });
  cap(ctx, T, 26.07, 28.7, 'Vàng giòn, gấp đôi', 'Golden & crispy, fold', 6);
}

// =================================================================================================== S11 28.8–31.68
// hero: the bánh xèo slides onto the plate, low angle against the sunset; backlit steam, sun rays, sparkles; spatula knock.
const KNOCK = 30.72;
function s11(ctx, lt, p, T) {
  const e = ease.inOut(p), knock = hitAt(T, KNOCK, 0.3);
  const ryr = 0.3, plX = 540, plY = 1300;
  cam(ctx, 540, 1180, 1.0 + 0.1 * e + 0.012 * knock, 0.006 - 0.012 * e, () => {
    ctx.drawImage(deckTable(), 0, 0);
    L.glow(ctx, SUN_T[0], SUN_T[1], 460, 'rgba(255,190,110,1)', 0.45);
    L.godRays(ctx, SUN_T[0], SUN_T[1], PI / 2, 1.4, 1250, 11, 'rgba(255,214,150,0.9)', 0.16, T);
    L.bokeh(ctx, T, 61, 9, BOKEH_W, 0.22, 30, 80);
    // a basket of greens + a bowl of fish sauce at the back (depth)
    BX.herbBasket(ctx, 150, 1110, 0.62, { view: '3q', fill: 1, seed: 2 });
    BX.fishSauceBowl(ctx, 935, 1125, 0.8, { ryr: 0.35, fill: 0.9, chili: 1, garlic: 1, t: T, seed: 5 });
    BX.plate(ctx, plX, plY, 1.32, { ryr, shadow: true });
    // slide: from the right on the spatula, slow-mo ease out
    const su = ease.outExpo ? ease.outExpo(iv(28.8, 30.0, T)) : ease.out(iv(28.8, 30.0, T));
    const bx = lerp(1180, plX, su), by = plY - 18 - 30 * (1 - su) - 10 * knock;
    const tipX = lerp(1310, 860, ease.out(iv(28.8, 29.5, T))) + 700 * ease.in2(iv(29.85, 30.35, T));
    if (T < 30.4) {
      const sp = BX.spatula(ctx, tipX - 120, plY - 30, 1.2, -0.1, {});
      if (sp && sp.grip) armIn(ctx, sp.grip[0], sp.grip[1], 2.9, 1.0, 'grip');
    }
    BX.banhXeo(ctx, bx, by - 6, 1.55, { ryr, fold: 1, crisp: 1, steam: 0.7, t: T, seed: 4, shadow: true });
    // knock: spatula taps the crispy edge
    const ku = iv(KNOCK - 0.35, KNOCK + 0.5, T);
    if (ku > 0 && ku < 1) {
      const down = T < KNOCK ? ease.in2(iv(KNOCK - 0.35, KNOCK, T)) : 1 - ease.out(iv(KNOCK + 0.05, KNOCK + 0.5, T));
      const kx = plX + 215, ky = by - 40 - 170 * (1 - down);
      const sp = BX.spatula(ctx, kx, ky, 1.15, -0.55 - 0.25 * (1 - down), {});
      if (sp && sp.grip) armIn(ctx, sp.grip[0], sp.grip[1], 2.6, 0.95, 'grip');
    }
    BX.crumbBurst(ctx, T, KNOCK, plX + 210, by - 30, 1.0, { n: 22, seed: 7, spread: 1.1 });
    // backlit steam + sparkles
    L.steam(ctx, T, 11, bx, by - 60, 300, 620, 10, 0.32 * su);
    BX.sparkles(ctx, T, plX, by - 90, 1.3, { n: 8, seed: 12, r: 280, alpha: iv(30.0, 30.4, T) });
    L.dust(ctx, T, 5, 28, 0, 500, W, 800, '255,220,160', 2.6, 0.6);
  });
  L.flare(ctx, SUN_T[0] + 10, SUN_T[1] - 20, 0.9, 0.55);
}

// =================================================================================================== S12 31.68–34.56
// ⑦ herb garden on the bank at sunset: Má Tư's hand picks lá cách, cải xanh, húng into the bamboo basket.
const S12_PICK = [['lacach', 32.16], ['caibe', 33.12], ['hung', 34.08]];
const S12_KIND = { lacach: 'lacach', caibe: 'mustard', hung: 'hung', lettuce: 'lettuce', diepca: 'diepca' };
const BASKET12 = [560, 1830];
function s12(ctx, lt, p, T) {
  const e = ease.inOut(p);
  cam(ctx, 560, 1120, 1.02 + 0.08 * e, 0.004 - 0.008 * e, () => {
    const G = BX.herbGarden(ctx, T, { dusk: 0.34, sun: [820, 330], sway: 1 });
    // hand path: basket → plant (pinch at tb) → basket (drop at tb+0.48) → next plant
    const pts = S12_PICK.map(([k, tb]) => ({ k, tb, at: G[k] || [540, 1000] }));
    const bk = [BASKET12[0] + 60, BASKET12[1] - 210];
    let hx, hy, carry = null, kind = 'open';
    const t0 = 31.68;
    let prevPos = [bk[0] + 300, bk[1] + 250], prevT = t0;
    let done = false;
    for (let i = 0; i < pts.length && !done; i++) {
      const q = pts[i];
      if (T < q.tb) { // travelling to the plant
        const u = ease.inOut(iv(prevT, q.tb, T));
        hx = lerp(prevPos[0], q.at[0] + 10, u); hy = lerp(prevPos[1], q.at[1] + 30, u) - Math.sin(u * PI) * 80;
        kind = u > 0.7 ? 'pinch' : 'open'; done = true;
      } else if (T < q.tb + 0.48) { // pulling the leaf to the basket
        const u = ease.inOut(iv(q.tb + 0.06, q.tb + 0.48, T));
        hx = lerp(q.at[0] + 10, bk[0], u); hy = lerp(q.at[1] + 30, bk[1], u) - Math.sin(u * PI) * 120;
        carry = q.k; kind = 'pinch'; done = true;
      }
      prevPos = bk; prevT = q.tb + 0.48;
    }
    if (!done) { const u = ease.inOut(iv(prevT, prevT + 0.5, T)); hx = lerp(bk[0], bk[0] + 260, u); hy = lerp(bk[1], bk[1] + 400, u); kind = 'open'; }
    // pick "snap" glints
    for (const q of pts) { const h = hitAt(T, q.tb, 0.35); if (h > 0) { L.sparkle(ctx, q.at[0], q.at[1] + 10, 40 * h + 10, h); } }
    // basket fill grows with each drop
    let fill = 0.5; for (const q of pts) fill += 0.16 * iv(q.tb + 0.4, q.tb + 0.5, T);
    BX.herbBasket(ctx, BASKET12[0], BASKET12[1], 1.0, { view: '3q', fill, seed: 6 });
    if (carry) BX.herbLeaf(ctx, hx - 6, hy + 10, carry === 'caibe' ? 0.75 : 1.6, -0.5 + Math.sin(T * 9) * 0.1, S12_KIND[carry], {});
    const ang = Math.atan2(hy - 2300, hx - 1250) + PI; // shoulder low-right off frame
    armIn(ctx, hx, hy, Math.atan2(hy - 2250, hx - 1300) + 0 * ang, 1.05, kind);
    L.dust(ctx, T, 9, 26, 0, 300, W, 1100, '255,220,170', 2.4, 0.5);
  });
  cap(ctx, T, 31.83, 34.46, 'Rau vườn: lá cách, cải xanh, húng', 'Garden greens: Indian beech, mustard leaf, herbs', 7);
}

// =================================================================================================== S13 34.56–37.44
// ⑧ close-up: fish sauce poured into the bowl; garlic 35.04, chili 35.52, both 36.0 drop in on the beat.
const DROPS13 = [
  { tl: 35.04, kind: 'g', n: 4 }, { tl: 35.52, kind: 'c', n: 3 }, { tl: 36.0, kind: 'gc', n: 5 },
];
function s13(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const bX = 540, bY = 1260, bS = 2.6, ryr = 0.42, surfY = bY + 18;
  let hit = 0; for (const d of DROPS13) hit = Math.max(hit, hitAt(T, d.tl, 0.25));
  cam(ctx, 540, 1150, 1.04 + 0.1 * e + 0.01 * hit, 0, () => {
    ctx.drawImage(deckTable(), 0, 0);
    L.glow(ctx, SUN_T[0], SUN_T[1], 420, 'rgba(255,190,110,1)', 0.4);
    L.bokeh(ctx, T, 71, 10, BOKEH_W, 0.25, 30, 90);
    const garlic = 0.4 * (T >= 35.04) + 0.5 * (T >= 36.0), chili = 0.5 * (T >= 35.52) + 0.5 * (T >= 36.0);
    const fill = lerp(0.5, 0.92, ease.out(iv(34.56, 35.0, T)));
    BX.fishSauceBowl(ctx, bX, bY, bS, { ryr, fill, chili, garlic, t: T, seed: 11 });
    // pour from a bottle (upper right) at the start
    const bo = ease.in2(iv(34.92, 35.25, T));
    if (bo < 1) {
      const mx = 690 + 260 * bo, my = 760 - 700 * bo;
      ctx.save(); ctx.translate(mx, my); ctx.rotate(-2.35);
      ctx.fillStyle = lgr(ctx, 0, -40, 0, 40, [[0, 'rgba(120,60,20,0.85)'], [0.5, 'rgba(220,140,60,0.75)'], [1, 'rgba(90,40,14,0.9)']]);
      ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(-10, 22); ctx.lineTo(-170, 30); ctx.lineTo(-240, 80); ctx.lineTo(-700, 80); ctx.lineTo(-700, -80); ctx.lineTo(-240, -80); ctx.lineTo(-170, -30); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,190,0.6)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, -18); ctx.lineTo(-170, -26); ctx.lineTo(-240, -70); ctx.lineTo(-690, -70); ctx.stroke();
      ctx.fillStyle = '#e8d8b0'; ctx.fillRect(-14, -26, 18, 52);
      ctx.fillStyle = 'rgba(240,226,190,0.9)'; ctx.fillRect(-520, -60, 200, 120); ctx.fillStyle = '#b8282a'; ctx.fillRect(-500, -30, 160, 60);
      ctx.restore();
      const k = iv(34.56, 34.68, T), tail = iv(34.82, 34.98, T);
      if (tail < 1) BX.pourStream(ctx, mx - 6, my + 8, bX - 20, surfY - 6, T, { col: 'sauce', w: 15, k, tail, splash: true });
    }
    // the pinching hand above, dropping garlic/chili on the beats
    const hu = ease.out(iv(34.7, 35.0, T)), hout = ease.in2(iv(36.2, 36.6, T));
    if (hout < 1) {
      let hx = 470 + 40 * Math.sin(T * 2), hy = lerp(300, 720, hu) - 520 * hout;
      let kind = 'pinch';
      for (const d of DROPS13) { const u = T - (d.tl - 0.34); if (u >= 0 && u < 0.2) kind = 'open'; }
      armIn(ctx, hx, hy, 1.15, 1.15, kind);
    }
    for (let di = 0; di < DROPS13.length; di++) {
      const d = DROPS13[di], t0 = d.tl - 0.34, u = (T - t0) / 0.34;
      if (u < 0 || u > 1) continue;
      const r = rng(500 + di);
      for (let i = 0; i < d.n; i++) {
        const sx = 520 + (r() - 0.5) * 70, ex = bX + (r() - 0.5) * 170, ey = surfY + (r() - 0.5) * 40;
        const x = lerp(sx, ex, u), y = lerp(760, ey, u * u), rot = r() * TAU + u * 4;
        const isG = d.kind === 'g' || (d.kind === 'gc' && i % 2 === 0);
        if (isG) garlicBit(ctx, x, y, 2.6, rot); else chiliRing(ctx, x, y, 2.6, rot);
      }
    }
    // landing ripples + splash droplets
    for (let di = 0; di < DROPS13.length; di++) {
      const d = DROPS13[di], u = (T - d.tl) / 0.8;
      if (u < 0 || u > 1) continue;
      ctx.save(); ctx.strokeStyle = `rgba(255,236,190,${0.75 * (1 - u)})`; ctx.lineWidth = 4 * (1 - u) + 1;
      ell(ctx, bX, surfY, 40 + u * 190, (40 + u * 190) * ryr); ctx.stroke();
      if (u < 0.45) {
        const r = rng(600 + di);
        for (let i = 0; i < 10; i++) {
          const a = -PI * (0.1 + r() * 0.8), v = 300 + r() * 300, tt = u * 0.8;
          const x = bX + Math.cos(a) * v * tt * 0.8, y = surfY + Math.sin(a) * v * tt + 900 * tt * tt;
          ctx.fillStyle = `rgba(214,130,40,${0.9 * (1 - u / 0.45)})`; ell(ctx, x, y, 5, 6); ctx.fill();
        }
      }
      ctx.restore();
    }
    BX.sparkles(ctx, T, bX, bY - 40, 1.2, { n: 6, seed: 14, r: 240, alpha: iv(36.3, 36.7, T) });
  });
  cap(ctx, T, 34.71, 37.34, 'Nước mắm chua ngọt', 'Sweet & sour fish sauce', 8);
}

// =================================================================================================== S14 37.44–40.32
// ⑨ hands tear a piece, lay it on a mustard leaf with herbs, roll it, dip it in the fish sauce.
function s14(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const plX = 320, plY = 1060, bwX = 820, bwY = 1500, bwS = 1.3, wcX = 500, wcY = 1330, wS = 1.5;
  cam(ctx, 560, 1240, 1.04 + 0.06 * e, 0, () => {
    ctx.drawImage(deckTable(), 0, 0);
    L.glow(ctx, SUN_T[0], SUN_T[1], 380, 'rgba(255,190,110,1)', 0.35);
    L.bokeh(ctx, T, 81, 8, BOKEH_W, 0.2, 30, 80);
    BX.plate(ctx, plX, plY, 0.85, { view: '3q', shadow: true });
    const bite = 0.4 * ease.inOut(iv(37.72, 37.95, T));
    BX.banhXeo(ctx, plX, plY - 10, 0.8, { view: '3q', fold: 1, crisp: 1, steam: 0.4, t: T, seed: 4, bite, biteA: 0.3 });
    const dip = iv(39.78, 39.98, T);
    BX.fishSauceBowl(ctx, bwX, bwY, bwS, { view: '3q', fill: 0.9, chili: 1, garlic: 1, t: T, seed: 11 });
    // wrap: k timeline
    const k = T < 38.3 ? lerp(0.12, 0.38, iv(37.44, 38.3, T)) : T < 38.62 ? lerp(0.38, 0.55, iv(38.3, 38.62, T)) : lerp(0.55, 1, ease.inOut(iv(38.62, 39.28, T)));
    const mv = ease.inOut(iv(39.3, 39.78, T)), dunk = Math.sin(iv(39.78, 40.15, T) * PI);
    const rot = lerp(0, 2.45, mv);
    const td = [Math.sin(rot), -Math.cos(rot)];
    const tgt = [bwX - td[0] * 200, bwY + 8 - td[1] * 200 - 40];
    const wx = lerp(wcX, tgt[0], mv) + td[0] * 40 * dunk, wy = lerp(wcY, tgt[1], mv) + td[1] * 40 * dunk;
    const wr = BX.leafWrap(ctx, wx, wy, wS, { k, rot, dip, seed: 3 });
    // tearing hand (right) → carries the piece to the leaf
    if (T < 38.7) {
      const tu = ease.inOut(iv(37.95, 38.42, T));
      const gx0 = plX + 150, gy0 = plY - 30, hx = lerp(gx0, wcX + 20, tu), hy = lerp(gy0, wcY - 10, tu) - Math.sin(tu * PI) * 120;
      const app = ease.out(iv(37.44, 37.72, T)), outk = ease.in2(iv(38.42, 38.7, T));
      const ax = hx + 400 * (1 - app) + 500 * outk, ay = hy - 300 * (1 - app) - 300 * outk;
      if (T > 37.9 && T < 38.45) BX.banhXeo(ctx, ax - 10, ay + 20, 0.28, { view: '3q', fold: 1, crisp: 1, rot: 0.6, seed: 8, centerFold: true });
      if (T > 37.72 && T < 37.98) BX.crumbBurst(ctx, T, 37.75, gx0, gy0, 0.6, { n: 10, seed: 4 });
      armIn(ctx, ax, ay, 2.5, 0.95, T < 38.42 ? 'pinch' : 'open');
    }
    // rolling: two hands at the wrap sides
    const ru = iv(38.55, 38.7, T) * (1 - iv(39.25, 39.4, T));
    if (ru > 0) {
      const rl = Math.sin(T * 14) * 6;
      armIn(ctx, wcX - 150 * wS * 0.6 - 120 * (1 - ru), wcY + 30 + rl, 0.25, 0.95, 'flat');
      armIn(ctx, wcX + 150 * wS * 0.6 + 120 * (1 - ru), wcY + 30 - rl, PI - 0.25, 0.95, 'flat', true);
    }
    // dipping hand holds the end
    if (T > 39.25) {
      const en = (wr && wr.end) || [wx - td[0] * 200, wy - td[1] * 200];
      const app = ease.out(iv(39.25, 39.4, T));
      armIn(ctx, en[0] - 60 * (1 - app), en[1] - 120 * (1 - app), 1.0, 0.95, 'grip');
    }
    if (dip > 0) {
      const u = (T - 39.85) / 0.8;
      if (u > 0 && u < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,236,190,${0.7 * (1 - u)})`; ctx.lineWidth = 3; ell(ctx, bwX, bwY + 8, 30 + u * 110, (30 + u * 110) * 0.42); ctx.stroke(); ctx.restore(); }
    }
  });
  cap(ctx, T, 37.59, 40.22, 'Cuốn lá cải, chấm mắm', 'Wrap in mustard leaf, dip', 9);
}

// =================================================================================================== S15 40.32–44.16
// deck table at sunset: the tourist eats with knife & fork (pinky up), points at the stove: "Let me try!";
// Má Tư raises an eyebrow, then hands him the spatula + tiny apron.
const H15 = { x: 600, y: 1170, s: 0.9 };
function s15(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const z = lerp(2.85, 3.05, e), cx = lerp(522, 528, e), cy = lerp(968, 975, e);
  const hs = H15.s, deckY = H15.y - 140 * hs, ps = 0.3 * hs;
  const stool0 = [H15.x - 215 * hs, deckY];
  const winW = [H15.x + 212 * hs, H15.y - 246 * hs];
  const point = T >= 41.25;
  const R = BX.riversideScene(ctx, T, {
    horizon: 1000, dusk: 0.48, sunS: 1.3, flare: 0.35, house: H15, cam: { zoom: z, cx, cy },
    mid: (c) => {
      // Má Tư standing on the deck, right of the table
      const mPose = T < 41.9 ? 'stand' : T < 42.9 ? 'eyebrow' : 'offer';
      BX.maTu(c, H15.x + 40 * hs, deckY, ps * 1.02, { pose: mPose, t: T, k: iv(42.9, 43.35, T), expr: mPose === 'offer' ? 'smile' : 'calm', look: [stool0[0], deckY - 80] });
      // tourist seated on the stool (house draws the stool), knife & fork, then pointing at the kitchen
      if (!point) BX.tourist(c, stool0[0], stool0[1], ps, { pose: 'knifeFork', k: 0.5 + 0.5 * Math.sin(T * 13), t: T, expr: 'smile', vest: false, stool: false });
      else BX.tourist(c, stool0[0], stool0[1], ps, { pose: 'pointTry', pointAt: winW, t: T, k: iv(41.25, 41.5, T), expr: T < 43.0 ? 'wow' : 'smile', vest: false, stool: false });
    },
  });
  // plate of bánh xèo + fish sauce on the table (table drawn by the house front part)
  if (R.house && R.house.table) {
    const [tx, ty] = R.house.table, sc = z * 0.9 * 0.11;
    BX.plate(ctx, tx - 10, ty - 4, sc, { ryr: 0.38, shadow: false });
    BX.banhXeo(ctx, tx - 10, ty - 12, sc * 0.95, { ryr: 0.38, fold: 1, crisp: 1, steam: 0.4, t: T, seed: 4, bite: 0.35 });
    BX.fishSauceBowl(ctx, tx + 95 * z * 0.3, ty - 2, sc * 1.2, { ryr: 0.4, fill: 0.9, chili: 1, garlic: 1, t: T, seed: 2 });
  }
  // a little "!" glint on the offered apron
  if (T > 43.1) BX.sparkles(ctx, T, 760, 1050, 0.6, { n: 4, seed: 21, r: 70, alpha: iv(43.1, 43.4, T) });
  X.line(ctx, T, 41.35, 44.06, 'Cho tôi thử đổ!', 'Let me try!', {});
}

// warm caches once at load (backgrounds, herb basket sprite per view/fill)
(function warm() {
  try {
    stoveTop(); deckTable();
    const c = createCanvas(8, 8), x = c.getContext('2d');
    BX.herbBasket(x, 0, 0, 1, { view: '3q', fill: 1, seed: 6 });
  } catch (err) { /* built lazily on first use instead */ }
})();

module.exports = { s9, s10, s11, s12, s13, s14, s15 };
