'use strict';
// shotsB.js — "Hủ tiếu chợ nổi Cái Răng" shots 9..15 (22.5 – 45.0 s). 96 BPM grid: beat 0.625 s, bar 2.5 s.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes (30.0, 40.0) and grain.
// Look: Cái Răng at 8:00 AM, hard sunshine — deep blue sky, cumulus, white-gold sun, dense glitter, saturated boats.
const HP = require('./hprops');
const X = require('./text');
const L = require('./lib');
const NP = HP.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- beat helpers
const BEAT = 0.625;
const beat = T => ((T / BEAT) % 1 + 1) % 1;
const hitK = T => Math.pow(1 - beat(T), 3);
const iv = (a, b, v) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cap = (ctx, T, t0, t1, vi, en, n) => X.caption(ctx, T, t0, t1, vi, en, { n, y: 360 });
const lgr = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };

// NP drawers return DEVICE coords. Under a camera transform convert them back to the current user space.
function unmap(ctx) {
  const m = ctx.getTransform(), det = m.a * m.d - m.b * m.c;
  return (q) => { const x = q[0] - m.e, y = q[1] - m.f; return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det]; };
}
function U(ctx, r) {
  const u = unmap(ctx), o = {};
  for (const k in r) o[k] = Array.isArray(r[k]) && r[k].length === 2 && typeof r[k][0] === 'number' ? u(r[k]) : r[k];
  return o;
}
// camera that never shows outside the 1080x1920 canvas
function cam(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  L.cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}

// ---------------------------------------------------------------- one-time caches
const CACHE = {};
function cached(name, w, h, fn) {
  if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; }
  return CACHE[name];
}
const BOKEH_D = ['rgba(255,252,230,1)', 'rgba(255,236,170,1)', 'rgba(190,230,255,1)'];

// sunny top-down deck of Dì Bảy's boat (s9, s10, s12). Canvas is (W+300)x(H+300), drawn at (-150,-150).
const DPAD = 150;
function deckTop() {
  return cached('deckTopB', W + 2 * DPAD, H + 2 * DPAD, (x) => {
    const w = W + 2 * DPAD, h = H + 2 * DPAD, r = rng(91);
    x.translate(DPAD, DPAD); // world coords from here
    // planks run vertically (along the boat)
    const pw = 138;
    for (let i = -2; i * pw < W + DPAD; i++) {
      const x0 = 120 + i * pw, v = 0.88 + r() * 0.24;
      x.fillStyle = lgr(x, x0, 0, x0 + pw, 0, [[0, `rgb(${(214 * v) | 0},${(160 * v) | 0},${(102 * v) | 0})`], [0.5, `rgb(${(232 * v) | 0},${(178 * v) | 0},${(116 * v) | 0})`], [1, `rgb(${(196 * v) | 0},${(142 * v) | 0},${(88 * v) | 0})`]]);
      x.fillRect(x0, -DPAD, pw, h);
      x.strokeStyle = 'rgba(110,62,26,0.35)'; x.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const xx = x0 + 14 + r() * (pw - 28); x.beginPath(); x.moveTo(xx, -DPAD);
        x.bezierCurveTo(xx + (r() - 0.5) * 30, 500, xx + (r() - 0.5) * 30, 1300, xx + (r() - 0.5) * 20, H + DPAD); x.stroke();
      }
      // knots
      for (let k = 0; k < 2; k++) { ell(x, x0 + 30 + r() * (pw - 60), r() * H, 9, 16); x.fillStyle = 'rgba(100,55,22,0.5)'; x.fill(); }
      x.fillStyle = 'rgba(60,30,12,0.75)'; x.fillRect(x0 + pw - 5, -DPAD, 5, h);
      x.fillStyle = 'rgba(255,236,190,0.25)'; x.fillRect(x0 + 2, -DPAD, 4, h);
      // nail heads
      for (let yy = 80; yy < H + DPAD; yy += 420) { x.fillStyle = '#4a3020'; ell(x, x0 + 18, yy, 4, 4); x.fill(); ell(x, x0 + pw - 20, yy, 4, 4); x.fill(); }
    }
    // left: river water strip + painted gunwale
    x.fillStyle = lgr(x, -DPAD, 0, 70, 0, [[0, '#1f6d78'], [1, '#3a8a86']]); x.fillRect(-DPAD, -DPAD, DPAD + 70, h);
    for (let i = 0; i < 90; i++) {
      const yy = r() * (H + DPAD) - 40, xx = -DPAD + r() * (DPAD + 60);
      x.fillStyle = `rgba(255,255,240,${0.4 + r() * 0.5})`; ell(x, xx, yy, 2 + r() * 10, 1.2 + r() * 2); x.fill();
    }
    x.fillStyle = 'rgba(10,30,40,0.35)'; x.fillRect(70, -DPAD, 26, h); // rail shadow on water
    x.fillStyle = lgr(x, 60, 0, 124, 0, [[0, '#1e6b3a'], [0.45, '#38a35a'], [1, '#1a5a30']]); x.fillRect(56, -DPAD, 68, h);
    x.fillStyle = '#c8322a'; x.fillRect(118, -DPAD, 14, h);
    x.fillStyle = 'rgba(255,255,230,0.55)'; x.fillRect(64, -DPAD, 6, h);
    x.fillStyle = 'rgba(30,15,5,0.4)'; x.fillRect(132, -DPAD, 14, h);
    // props (hard shadows down-right)
    HP.garnishPlate(x, 880, 1660, 0.82, { ryr: 1 });
    // chili dish
    x.fillStyle = 'rgba(30,18,8,0.3)'; ell(x, 252, 1712, 92, 92); x.fill();
    ell(x, 240, 1700, 88, 88); x.fillStyle = '#f4f6f8'; x.fill(); x.strokeStyle = '#2f5fa8'; x.lineWidth = 4; ell(x, 240, 1700, 76, 76); x.stroke();
    HP.chiliSlices(x, 240, 1700, 1.2, { n: 9, seed: 4, spread: 44 });
    // lime wedges on the plank
    HP.limeWedge(x, 900, 520, 1.0, 0.5); HP.limeWedge(x, 960, 600, 0.95, -0.8);
    // chopsticks + spoon
    HP.chopsticks(x, 260, 640, 0.9, -1.25, { open: 0.05 });
    HP.spoon(x, 860, 340, 0.9, 2.3, {});
    // tarp shadow band (diagonal, top-left) — leaves the bowl in hard sun
    x.fillStyle = 'rgba(20,30,60,0.30)';
    x.beginPath(); x.moveTo(-DPAD, -DPAD); x.lineTo(W + DPAD, -DPAD); x.lineTo(W + DPAD, 40); x.lineTo(-DPAD, 360); x.closePath(); x.fill();
    x.fillStyle = 'rgba(20,30,60,0.12)';
    x.beginPath(); x.moveTo(-DPAD, 360); x.lineTo(W + DPAD, 40); x.lineTo(W + DPAD, 80); x.lineTo(-DPAD, 410); x.closePath(); x.fill();
    void w;
  });
}
function drawDeck(ctx) { ctx.drawImage(deckTop(), -DPAD, -DPAD); }

// blurred sunny market backdrop for the orbit (s13), wider than the frame for parallax
function orbitBg() {
  return cached('orbitBgB', W, H, (x) => {
    const tmp = createCanvas(W, H), c = tmp.getContext('2d');
    HP.riverSideDay(c, 1.0, 0, { horizon: 1060, sunX: 300, sunY: 520, sun: false, rays: 0, flare: 0, fgY: 2400, glitter: 320, clouds: 6, cloudSeed: 44,
      mid: (cc) => {
        NP.ghe(cc, 860, 1150, 0.55, { t: 1, seed: 3, flip: true });
        NP.ghe(cc, 150, 1180, 0.5, { t: 1, seed: 6 });
      } });
    x.filter = 'blur(18px)'; x.drawImage(tmp, 0, 0); x.filter = 'none';
  });
}
(function warm() { try { deckTop(); orbitBg(); } catch (e) { /* lazily */ } })();

// ---------------------------------------------------------------- small helpers
// arm + hand reaching in from outside the frame (Dì Bảy's cobalt sleeve), for top-down shots
function armIn(ctx, sx, sy, hx, hy, s, kind = 'grip', rot) {
  const a = rot ?? Math.atan2(hy - sy, hx - sx);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,30,50,0.25)'; ctx.lineWidth = 60 * s; ctx.beginPath(); ctx.moveTo(sx + 30, sy + 40); ctx.lineTo(hx + 30, hy + 40); ctx.stroke();
  ctx.strokeStyle = '#d9a27a'; ctx.lineWidth = 46 * s; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx - Math.cos(a) * 20 * s, hy - Math.sin(a) * 20 * s); ctx.stroke();
  const ex = lerp(sx, hx, 0.72), ey = lerp(sy, hy, 0.72);
  ctx.strokeStyle = HP.DIBAY.aoba; ctx.lineWidth = 72 * s; ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * 80, sy - Math.sin(a) * 80); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,0.45)'; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.moveTo(sx, sy - 26 * s); ctx.lineTo(ex, ey - 26 * s); ctx.stroke();
  ctx.restore();
  NP.cHand(ctx, hx - Math.cos(a) * 30 * s, hy - Math.sin(a) * 30 * s, s, a, { kind });
}
// a drawFn "falling from the camera" onto the bowl: big + soft → lands at scale 1 on tLand (+ small squash bounce)
function dropIn(ctx, T, tLand, dur, x, y, cx, cy, drawFn) {
  const u = clamp((T - (tLand - dur)) / dur);
  if (u <= 0) return false;
  const e = ease.in2(u), sc = u < 1 ? lerp(3.0, 1, e) : 1 + 0.08 * hitAt(T, tLand, 0.25);
  const px = u < 1 ? lerp(x + (x - cx) * 1.4, x, e) : x, py = u < 1 ? lerp(y + (y - cy) * 1.4, y, e) : y;
  ctx.save(); ctx.globalAlpha = u < 1 ? clamp(u * 2.2) * lerp(0.75, 1, e) : 1;
  ctx.translate(px, py); ctx.scale(sc, sc); drawFn(ctx); ctx.restore();
  return u >= 1;
}
// expanding ring on the broth (top-down)
function ripple(ctx, T, t0, x, y, r0, a0 = 0.6) {
  const u = (T - t0) / 0.9;
  if (u < 0 || u > 1) return;
  ctx.save(); ctx.strokeStyle = `rgba(255,248,220,${a0 * (1 - u)})`; ctx.lineWidth = 5 * (1 - u) + 1;
  ell(ctx, x, y, r0 + u * 120, r0 + u * 120); ctx.stroke(); ctx.restore();
}
// small fried garlic bit (golden irregular flake)
function garlicBit(ctx, x, y, s, rot, shade) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-7, -4); ctx.lineTo(3, -7); ctx.lineTo(8, -1); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fillStyle = shade > 0.5 ? '#e8a838' : '#c9822a'; ctx.fill();
  ctx.strokeStyle = 'rgba(110,55,10,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = 'rgba(255,236,170,0.85)'; ctx.fillRect(-3, -3, 5, 2);
  ctx.restore();
}

// =================================================================================================== S9 22.5–26.25
// Top-down: toppings land one per beat. ④ Thịt, tôm → ⑤ Gan, trứng cút, hẹ
const S9_LAND = [23.125, 23.75, 24.375, 25.0, 25.625];
const S9_ANG = [-2.3, -0.5, 1.1, 2.5, 0.3];
function s9(ctx, lt, p, T) {
  const e = ease.inOut(p);
  let hit = 0; for (const tl of S9_LAND) hit = Math.max(hit, hitAt(T, tl, 0.3));
  const bx = 540, by = 1060, bs = 2.3, R = 150 * bs;
  cam(ctx, 540, 1010, 1.05 + 0.07 * e + 0.018 * hit, -0.012 + 0.02 * e, () => {
    drawDeck(ctx);
    let layers = 1;
    for (const tl of S9_LAND) layers += clamp((T - (tl - 0.32)) / 0.32);
    HP.huTieuBowl(ctx, bx, by, bs, { view: 'top', layers, broth: 0, t: T, seed: 3 });
    // landing puffs + glints
    S9_LAND.forEach((tl, i) => {
      const k = hitAt(T, tl, 0.45);
      if (k <= 0) return;
      const px = bx + Math.cos(S9_ANG[i]) * R * 0.4, py = by + Math.sin(S9_ANG[i]) * R * 0.4;
      ctx.save(); ctx.strokeStyle = `rgba(255,250,225,${0.7 * k})`; ctx.lineWidth = 6 * k;
      ell(ctx, px, py, 60 + (1 - k) * 110, 60 + (1 - k) * 110); ctx.stroke(); ctx.restore();
      const r = rng(30 + i);
      for (let j = 0; j < 6; j++) {
        const a = r() * TAU, d = 40 + (1 - k) * (90 + r() * 90);
        L.sparkle(ctx, px + Math.cos(a) * d, py + Math.sin(a) * d, 16 + r() * 16, k);
      }
    });
    // gentle steam from the noodles + sun dust
    L.steam(ctx, T, 9, bx, by + 60, 380, 520, 6, 0.16);
    L.dust(ctx, T, 12, 26, 80, 300, 920, 1500, '255,240,200', 3, 0.5);
  });
  L.glow(ctx, 160, 140, 520, 'rgba(255,240,200,0.5)', 0.35);
  cap(ctx, T, 22.65, 24.35, 'Thịt, tôm', 'Pork & shrimp', 4);
  cap(ctx, T, 24.4, 26.15, 'Gan, trứng cút, hẹ', 'Liver, quail eggs, chives', 5);
}

// =================================================================================================== S10 26.25–28.75
// Macro: fried garlic rains in, pulsing on each beat, glittering like tinsel. ⑥ Tỏi phi
const S10_BEATS = [26.25, 26.875, 27.5, 28.125];
function s10(ctx, lt, p, T) {
  const e = ease.inOut(p), bx = 540, by = 1060, bs = 2.3, R = 150 * bs;
  const hit = hitK(T) * (T < 28.6 ? 1 : 0);
  const cx = 560, cy = 1040;
  cam(ctx, cx, cy, 1.55 + 0.3 * e + 0.03 * hit, 0.02 - 0.03 * e, () => {
    drawDeck(ctx);
    HP.huTieuBowl(ctx, bx, by, bs, { view: 'top', layers: 6, broth: 0, t: T, seed: 3 });
    // garlic bits: each beat drops a handful from the camera
    S10_BEATS.forEach((tb, bi) => {
      const r = rng(200 + bi);
      for (let j = 0; j < 22; j++) {
        const a = r() * TAU, d = Math.sqrt(r()) * R * 0.74, lx = bx + Math.cos(a) * d, ly = by + Math.sin(a) * d;
        const delay = r() * 0.12, rot0 = r() * TAU, sh = r(), sz = 0.8 + r() * 0.6;
        const tl = tb + 0.18 + delay, dur = 0.34;
        const u = clamp((T - (tl - dur)) / dur);
        if (u <= 0) continue;
        const ee = ease.in2(u), sc = u < 1 ? lerp(2.6, 1, ee) : 1;
        const px = u < 1 ? lerp(lx + (lx - cx) * 0.5, lx, ee) : lx, py = u < 1 ? lerp(ly + (ly - cy) * 0.5 - 60, ly, ee) : ly;
        ctx.save(); ctx.globalAlpha = u < 1 ? clamp(u * 3) * lerp(0.7, 1, ee) : 1;
        garlicBit(ctx, px, py, sz * sc, rot0 + (1 - u) * 3, sh);
        ctx.restore();
        // tinsel glitter: landed bits flash on the beats
        if (u >= 1 && (j % 3 === 0)) {
          const tw = 0.5 + 0.5 * Math.sin(T * 11 + j * 1.7 + bi);
          L.sparkle(ctx, lx - 3, ly - 3, 10 + 18 * hit * tw + 6 * tw, 0.35 + 0.65 * Math.max(hit, tw * 0.5));
        }
      }
    });
    // warm oil sheen glints
    const r2 = rng(77);
    for (let j = 0; j < 10; j++) {
      const a = r2() * TAU, d = r2() * R * 0.8;
      L.sparkle(ctx, bx + Math.cos(a) * d, by + Math.sin(a) * d, 14 + 10 * Math.sin(T * 7 + j), 0.4 + 0.5 * hit);
    }
    L.steam(ctx, T, 10, bx, by + 40, 300, 380, 5, 0.14);
  });
  L.glow(ctx, 540, 1000, 700, 'rgba(255,210,120,0.6)', 0.12 + 0.18 * hit);
  L.bokeh(ctx, T, 17, 6, BOKEH_D, 0.18, 50, 120);
  cap(ctx, T, 26.4, 28.65, 'Tỏi phi', 'Fried garlic', 6);
}

// =================================================================================================== S11 28.75–32.5
// Low angle, slow motion: Dì Bảy pours a big ladle of broth; a steam column erupts against the sun. Flash 30.0 (render).
function gunwaleLedge(ctx, y) {
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, y - 24, 0, y + 22, [[0, '#f1cf96'], [0.5, '#d6a66a'], [1, '#9a6a3a']]);
  ctx.fillRect(-200, y - 24, W + 400, 46);
  ctx.fillStyle = 'rgba(255,250,220,0.8)'; ctx.fillRect(-200, y - 24, W + 400, 4);
  ctx.fillStyle = lgr(ctx, 0, y + 22, 0, H + 200, [[0, '#2f9a52'], [0.35, '#1f7040'], [1, '#0c2c1a']]);
  ctx.fillRect(-200, y + 22, W + 400, H + 400);
  ctx.fillStyle = '#c8322a'; ctx.fillRect(-200, y + 44, W + 400, 22);
  ctx.fillStyle = 'rgba(255,200,170,0.5)'; ctx.fillRect(-200, y + 44, W + 400, 4);
  ctx.fillStyle = '#f2c84a'; ctx.fillRect(-200, y + 76, W + 400, 8);
  // painted eye-ish motif dots + plank seams
  ctx.strokeStyle = 'rgba(0,20,10,0.35)'; ctx.lineWidth = 3;
  for (let x = -100; x < W + 200; x += 260) { ctx.beginPath(); ctx.moveTo(x, y + 90); ctx.lineTo(x + 20, H + 200); ctx.stroke(); }
  ctx.restore();
}
function s11(ctx, lt, p, T) {
  const ts = 28.75 + lt * 0.45;           // slow-motion clock for fx
  const e = ease.inOut(p);
  const sun = [745, 470];
  const ledgeY = 1530, bs = 1.6, bx = 650, brim = ledgeY - 80 * bs - 2;
  const pourK = lerp(0.6, 1.0, ease.inOut(clamp(lt / 2.9)));
  const level = 0.12 + 0.85 * ease.out(iv(29.9, 31.9, T));
  const burst = iv(29.8, 32.2, T);
  cam(ctx, 560, 1080, 1.03 + 0.06 * e, 0.01 - 0.02 * e, () => {
    HP.riverSideDay(ctx, ts, lt * 6, { horizon: 1250, sunX: sun[0], sunY: sun[1], sunS: 1.5, rays: 0.7, flare: 0, glitter: 300, fgY: 2400, clouds: 5, cloudSeed: 8,
      mid: (c, ox) => { NP.ghe(c, 120 + ox * 0.3, 1300, 0.3, { t: ts, seed: 2 }); NP.ghe(c, 1020 + ox * 0.3, 1290, 0.26, { t: ts, seed: 5, flip: true }); } });
    L.godRays(ctx, sun[0], sun[1], PI / 2 + 0.25, 1.4, 1500, 11, 'rgba(255,248,220,0.7)', 0.10 + 0.14 * burst, ts);
    // Dì Bảy behind the ledge (her deck is hidden below it)
    const dS = 2.2, dX = 300, dY = 1660;
    HP.diBay(ctx, dX, dY, dS, { pose: 'ladle', k: pourK, t: ts, potAt: [bx + 330, brim - 40], bowlAt: [bx, brim + 6], ladleS: 0.3, streamW: 13, expr: 'smile', look: [0.7, 0.6] });
    gunwaleLedge(ctx, ledgeY);
    // hero bowl on the ledge, broth rising
    HP.huTieuBowl(ctx, bx, brim, bs, { view: '3q', layers: 7, broth: level, t: ts * 2, slosh: 0.8 * (1 - iv(30.5, 32.4, T)), seed: 3 });
    // broth stream on top of the bowl rim (re-drawn so it reads in front of the far rim)
    // steam column erupting into the sun
    if (burst > 0) HP.steamBurst(ctx, ts, bx, brim - 10, 1.05, burst, { n: 16, sun: [0.1, -0.99], seed: 4, alpha: 1, rays: true, w: 200 });
    // golden splash droplets (slow)
    const r = rng(41);
    for (let i = 0; i < 26; i++) {
      const t0 = 29.9 + r() * 1.6, age = (T - t0) * 0.5, a = -PI / 2 + (r() - 0.5) * 2.2, v = 260 + r() * 300;
      if (age < 0 || age > 0.7) { r(); continue; }
      const x = bx - 60 + Math.cos(a) * v * age + (r() - 0.5) * 60, y = brim - 6 + Math.sin(a) * v * age + 900 * age * age;
      ctx.fillStyle = 'rgba(255,214,120,0.9)'; ell(ctx, x, y, 6, 8); ctx.fill();
      if (i % 3 === 0) L.sparkle(ctx, x, y, 22, 0.8 * (1 - age / 0.7));
    }
    L.dust(ctx, ts, 31, 30, 100, 300, 900, 1300, '255,245,215', 3.5, 0.6);
  });
  L.flare(ctx, sun[0], sun[1], 1.1, 0.45 + 0.35 * burst);
  L.bokeh(ctx, T, 23, 6, BOKEH_D, 0.16, 50, 130);
  cap(ctx, T, 28.9, 32.4, 'Chan nước lèo', 'Ladle the broth', 7);
}

// =================================================================================================== S12 32.5–35.0
// Macro top-down: sprouts + chili drop in, a hand squeezes lime → sparkling spray. ⑧ Giá, chanh, ớt
function s12(ctx, lt, p, T) {
  const e = ease.inOut(p), bx = 540, by = 1060, bs = 2.3, R = 150 * bs, cx = 540, cy = 1040;
  let hit = 0; for (const tl of [33.125, 33.75, 34.375]) hit = Math.max(hit, hitAt(T, tl, 0.3));
  cam(ctx, cx, cy, 1.22 + 0.1 * e + 0.02 * hit, 0.015 - 0.03 * e, () => {
    drawDeck(ctx);
    HP.huTieuBowl(ctx, bx, by, bs, { view: 'top', layers: 7, broth: 1, t: T, seed: 3, slosh: 0.6 * hit });
    // ripples where things land
    ripple(ctx, T, 33.125, bx - 120, by - 70, 50); ripple(ctx, T, 33.125, bx + 60, by + 130, 40);
    ripple(ctx, T, 33.75, bx + 110, by - 40, 40);
    ripple(ctx, T, 34.375, bx + 40, by + 20, 60, 0.8);
    // sprouts (two bunches) — land on 33.125
    dropIn(ctx, T, 33.125, 0.5, bx - 120, by - 70, cx, cy, (c) => HP.beanSprouts(c, 0, 0, 2.5, { n: 16, seed: 5, spread: 80 }));
    dropIn(ctx, T, 33.125, 0.45, bx + 60, by + 130, cx, cy, (c) => HP.beanSprouts(c, 0, 0, 2.3, { n: 12, seed: 9, spread: 70 }));
    // chili slices — land on 33.75
    dropIn(ctx, T, 33.75, 0.45, bx + 110, by - 40, cx, cy, (c) => HP.chiliSlices(c, 0, 0, 1.9, { n: 7, seed: 12, spread: 70 }));
    dropIn(ctx, T, 33.75, 0.4, bx - 40, by + 60, cx, cy, (c) => HP.chiliSlices(c, 0, 0, 1.7, { n: 4, seed: 15, spread: 40 }));
    // lime: arm slides in from the upper right, squeezes on 34.375
    const inK = ease.out(iv(33.55, 34.05, T)), sq = hitAt(T, 34.375, 0.5);
    if (inK > 0) {
      const hx = lerp(1250, 760, inK), hy = lerp(420, 760, inK);
      const squash = T >= 34.375 ? 1 - 0.35 * ease.out(iv(34.375, 34.5, T)) : 1;
      armIn(ctx, 1320, 300, hx, hy, 1.7, 'grip', 2.45);
      L.at(ctx, hx - 62, hy + 46, -0.7, 3.0 * squash, 3.0 / Math.sqrt(squash), () => HP.limeWedge(ctx, 0, 0, 1, 0));
      NP.cHand(ctx, hx - 30, hy + 22, 1.5, 2.45, { kind: 'grip' });
      // spray
      if (T >= 34.3) {
        const r = rng(61);
        for (let i = 0; i < 46; i++) {
          const delay = r() * 0.25, age = T - 34.33 - delay, a = PI * 0.62 + (r() - 0.5) * 1.1, v = 380 + r() * 520;
          if (age < 0 || age > 0.65) { r(); continue; }
          const ox = hx - 120, oy = hy + 60, x = ox + Math.cos(a) * v * age, y = oy + Math.sin(a) * v * age;
          const fade = 1 - age / 0.65;
          ctx.fillStyle = `rgba(235,255,200,${0.85 * fade})`; ell(ctx, x, y, 4 + r() * 5, 4 + r() * 5); ctx.fill();
          if (i % 4 === 0) L.sparkle(ctx, x, y, 26 * fade + 8, fade);
        }
        L.glow(ctx, hx - 160, hy + 120, 260, 'rgba(230,255,200,0.7)', 0.4 * sq);
      }
    }
    L.steam(ctx, T, 12, bx, by + 60, 360, 460, 6, 0.18);
  });
  L.bokeh(ctx, T, 29, 6, BOKEH_D, 0.16, 50, 120);
  cap(ctx, T, 32.65, 34.9, 'Giá, chanh, ớt', 'Sprouts, lime & chili', 8);
}

// =================================================================================================== S13 35.0–37.5
// Orbit around the finished hero bowl: steam, glittering fat, backlight + flare. No text.
function plankTable(ctx, yTop, vpx, vpy) {
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, yTop, 0, H, [[0, '#a87446'], [0.4, '#c88a52'], [1, '#7a4a26']]);
  ctx.fillRect(-100, yTop, W + 200, H - yTop + 100);
  ctx.strokeStyle = 'rgba(70,35,12,0.55)'; ctx.lineWidth = 4;
  for (let i = -12; i <= 12; i++) {
    const xb = 540 + i * 190, k = (yTop - H) / (vpy - H);
    ctx.beginPath(); ctx.moveTo(xb, H + 50); ctx.lineTo(lerp(xb, vpx, k), yTop); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,200,0.55)'; ctx.fillRect(-100, yTop, W + 200, 5);
  // front edge darkening
  ctx.fillStyle = lgr(ctx, 0, H - 260, 0, H, [[0, 'rgba(40,20,10,0)'], [1, 'rgba(40,20,10,0.45)']]); ctx.fillRect(-100, H - 260, W + 200, 300);
  ctx.restore();
}
function s13(ctx, lt, p, T) {
  const e = ease.inOut(p), yaw = lerp(-0.7, 0.7, e);
  const sun = [lerp(250, 520, e), 600];
  // background with parallax
  ctx.save(); ctx.translate(540 - yaw * 160, 960); ctx.scale(1.3, 1.3); ctx.drawImage(orbitBg(), -540, -960); ctx.restore();
  HP.sunDay(ctx, sun[0], sun[1], 1.3, { rays: 0.6, t: T });
  L.godRays(ctx, sun[0], sun[1], PI / 2 + 0.1, 1.5, 1400, 9, 'rgba(255,248,220,0.6)', 0.12, T);
  cam(ctx, 540, 1080, 1.05 + 0.05 * Math.sin(p * PI), yaw * 0.025, () => {
    const vpx = 540 - yaw * 900;
    plankTable(ctx, 1120, vpx, 760);
    const bx = 540, by = 1110, bs = 2.75, ryr = 0.45, R = 150;
    HP.huTieuBowl(ctx, bx, by, bs, { view: '3q', layers: 0, broth: 1, t: T, seed: 3 });
    // toppings rotated with the orbit: top-view bowl contents squashed into the 3q broth ellipse
    ctx.save();
    ctx.translate(bx, by + 4.95 * bs); ctx.scale(bs, bs * ryr);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.clip();
    ctx.rotate(yaw * 1.4);
    HP.huTieuBowl(ctx, 0, 0, 1, { view: 'top', layers: 7, broth: 1, t: T, seed: 3, shadow: false });
    ctx.restore();
    // glittering fat droplets (rotate with yaw)
    const r = rng(88);
    for (let i = 0; i < 16; i++) {
      const a = r() * TAU + yaw * 1.4, d = Math.sqrt(r()) * R * 0.85 * bs;
      const x = bx + Math.cos(a) * d, y = by + 4.95 * bs + Math.sin(a) * d * ryr;
      const tw = 0.5 + 0.5 * Math.sin(T * 6 + i * 2.1);
      L.sparkle(ctx, x, y, 10 + 22 * tw, 0.3 + 0.6 * tw);
    }
    // warm rim light on the far rim (backlit)
    ctx.save(); ctx.strokeStyle = 'rgba(255,236,180,0.85)'; ctx.lineWidth = 6; ctx.globalCompositeOperation = 'screen';
    ell(ctx, bx, by, R * bs * 0.995, R * bs * ryr * 0.99); ctx.beginPath(); ctx.ellipse(bx, by, R * bs, R * bs * ryr, 0, PI * 1.05, PI * 1.95); ctx.stroke(); ctx.restore();
    // steam rising, backlit
    HP.steamBurst(ctx, T, bx, by - 10, 0.85, 0.35 + 0.4 * p, { n: 12, sun: [-0.4, -0.9], seed: 7, alpha: 0.7, rays: false, w: 210 });
    L.steam(ctx, T, 13, bx, by - 60, 520, 700, 8, 0.24);
  });
  L.flare(ctx, sun[0], sun[1], 1.0, 0.55);
  L.bokeh(ctx, T, 31, 8, BOKEH_D, 0.22, 40, 120);
  L.dust(ctx, T, 33, 24, 0, 300, W, 1300, '255,245,215', 3, 0.5);
}

// =================================================================================================== S14 / S15 shared scene
// Front: Dì Bảy's noodle boat (flipped, pot at left). Behind: the tourist's xuồng, boatman at the stern.
const HB = { x: 210, y: 1690, s: 1.15 };       // hutieuBoat waterline origin
const XB = { x: 530, y: 1335, s: 1.0 };        // xuồng waterline origin
const T_UT = NP.UT;
let PROBE = null; function probeCtx() { if (!PROBE) PROBE = createCanvas(8, 8).getContext('2d'); PROBE.setTransform(1, 0, 0, 1, 0, 0); PROBE.globalAlpha = 1; return PROBE; }
// o: { her(T, seat) → diBay opts, his(T, seat, herRet) → tourist opts, camX, camY, camZ, rot, boatmanPose }
function twoBoats(ctx, T, o) {
  const bob = Math.sin(T * 1.4) * 4, bob2 = Math.sin(T * 1.7 + 1) * 3;
  // pre-compute Dì Bảy (geometry only) so the tourist can reach for her bowl
  const pc = probeCtx();
  const hbP = HP.hutieuBoat(pc, HB.x, HB.y + bob, HB.s, { part: 'back', t: T, flip: true, tarp: false, sign: false });
  const herO = o.her(T, hbP.seat);
  const herP = HP.diBay(pc, hbP.seat[0], hbP.seat[1], HB.s, herO);
  cam(ctx, o.camX, o.camY, o.camZ, o.rot || 0, () => {
    HP.riverSideDay(ctx, T, 0, { horizon: 860, sunX: 860, sunY: 240, rays: 0.4, flare: 0, glitter: 240, fgY: 2400, clouds: 6, cloudSeed: 17,
      mid: (c) => {
        NP.ghe(c, 160, 925, 0.24, { t: T, seed: 7 });
        NP.ghe(c, 900, 935, 0.22, { t: T, seed: 9, flip: true });
      } });
    // far: xuồng + boatman + tourist
    const xr = U(ctx, NP.xuongBaLa(ctx, XB.x, XB.y + bob2, XB.s, { t: T, part: 'back', flip: true }));
    NP.boatman(ctx, XB.x + 375 * XB.s, xr.deck[1], XB.s, { pose: o.boatmanPose || 'nod', phase: T / (BEAT * 4), t: T, flip: true });
    const seat = xr.seat;
    const hisO = o.his(T, seat, herP);
    HP.tourist(ctx, seat[0], seat[1], XB.s, hisO);
    NP.xuongBaLa(ctx, XB.x, XB.y + bob2, XB.s, { t: T, part: 'front', flip: true });
    // water between the hulls: ripples + glitter in the gap
    ctx.save();
    const r = rng(5);
    for (let i = 0; i < 22; i++) {
      const x = r() * W, y = XB.y + 8 + r() * 80, w = 20 + r() * 60;
      ctx.fillStyle = `rgba(255,255,235,${0.35 + 0.4 * (0.5 + 0.5 * Math.sin(T * 4 + i))})`; ell(ctx, x + Math.sin(T + i) * 10, y, w, 2.5); ctx.fill();
    }
    ctx.restore();
    // near: Dì Bảy's boat
    const hb = HP.hutieuBoat(ctx, HB.x, HB.y + bob, HB.s, { part: 'back', t: T, flip: true, tarp: false, steam: 0.8, sign: false });
    const her = HP.diBay(ctx, hb.seat[0], hb.seat[1], HB.s, herO);
    HP.hutieuBoat(ctx, HB.x, HB.y + bob, HB.s, { part: 'front', t: T, flip: true, tarp: false, sign: false });
    boatSign(ctx, HB.x + 261 * HB.s, HB.y + bob - 139 * HB.s, HB.s);
    if (o.after) o.after(ctx, her, seat);
  });
}
// the boat's 'HỦ TIẾU' board, drawn un-mirrored (the flipped boat would mirror its own sign)
function boatSign(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(20,10,5,0.35)'; ctx.fillRect(-140, -26, 290, 66);
  ctx.fillStyle = '#fbf3dc'; ctx.strokeStyle = '#c8322a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.rect(-150, -34, 300, 64); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b8302a'; ctx.font = 'bold 44px BodySansBold'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('HỦ TIẾU', 0, 0);
  ctx.restore();
}
// tourist body-unit converter for a LOCAL point (tourist not flipped)
const toTB = (seat, q, s) => [(q[0] - seat[0]) / (s * T_UT), (q[1] - seat[1]) / (s * T_UT)];

// =================================================================================================== S14 37.5–40.0
// Boat-to-boat delivery: Dì Bảy lifts the bowl across the water gap, the tourist takes it with both hands. ⑨
const S14_HAND = 38.75;       // handover on the beat
function s14(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const kHer = ease.inOut(iv(37.6, S14_HAND, T));
  const handed = T >= S14_HAND;
  const toCh = ease.inOut(iv(S14_HAND + 0.1, 39.6, T));          // tourist pulls the bowl to his chest
  const slosh = handed ? 2.4 * Math.exp(-(T - S14_HAND) * 2.2) : 0.4 * kHer;
  twoBoats(ctx, T, {
    camX: 520, camY: 1110 - 10 * e, camZ: 1.2 + 0.04 * e,
    her: (TT) => handed
      ? { pose: TT > 39.15 ? 'thumbs' : 'wave', t: TT, expr: 'laugh', look: [0.5, -0.6], turn: 0.4 }
      : { pose: 'handBowl', k: kHer, to: [400, 1040], t: TT, layers: 7, broth: 1, steam: 0.7, expr: 'smile', look: [0.5, -0.7], turn: 0.4 },
    his: (TT, seat, herP) => {
      const hs = XB.s;
      const rest = [[-44, -52 + 0], [44, -52]];
      return {
        pose: 'sit', t: TT, sweat: 0.5,
        expr: handed ? (TT < 39.25 ? 'wow' : 'smile') : (kHer > 0.4 ? 'wow' : 'smile'),
        poseFn: (P) => {
          const LIM = 1.25 * (P.hipY - P.SY);
          const reachC = (h, sx, L = LIM) => { const sh = [sx * 40, P.SY]; const dx = h[0] - sh[0], dy = h[1] - sh[1], d = Math.hypot(dx, dy); return d > L ? [sh[0] + dx * L / d, sh[1] + dy * L / d] : h; };
          if (!handed) {
            const bc = herP.bowl ? toTB(seat, herP.bowl.center, hs) : [0, P.SY + 120];
            const reach = ease.inOut(iv(38.2, S14_HAND, TT));
            const hipY = P.hipY;
            const rL = [-44, hipY - 52], rR = [44, hipY - 52];
            const tL = [bc[0] - 42, bc[1] + 10], tR = [bc[0] + 42, bc[1] + 10];
            return { hL: reachC([lerp(rL[0], tL[0], reach), lerp(rL[1], tL[1], reach)], -1), hR: reachC([lerp(rR[0], tR[0], reach), lerp(rR[1], tR[1], reach)], 1),
              kL: 'flat', kR: 'flat', rL: reach > 0.5 ? -0.5 : undefined, rR: reach > 0.5 ? PI + 0.5 : undefined, flipL: false, flipR: true };
          }
          // holding the bowl: from the handover point to his chest
          const h0 = reachC(toTB(seat, HANDOVER.c, hs), 0, LIM * 0.92), h1 = [0, P.SY + 76];
          const bc = [lerp(h0[0], h1[0], toCh), lerp(h0[1], h1[1], toCh)];
          const bs = lerp(HANDOVER.s / (hs * T_UT), 0.25, toCh);
          return {
            hL: reachC([bc[0] - 150 * bs, bc[1] + 50 * bs], -1), hR: reachC([bc[0] + 150 * bs, bc[1] + 50 * bs], 1), kL: 'flat', kR: 'flat', rL: -0.5, rR: PI + 0.5, flipL: false, flipR: true,
            mid: () => HP.huTieuBowl(P.ctx, bc[0], bc[1], bs, { view: '3q', layers: 7, broth: 1, t: TT, slosh, steam: 0.5 }),
          };
        },
      };
    },
    after: (c, her) => {
      if (!handed && her.bowl) { HANDOVER.c = her.bowl.center.slice(); HANDOVER.s = 0.24 * HB.s * NP.U_CO; }
      // "no spill!" — broth wave glints over the bowl while it sloshes
      void c;
    },
  });
  cap(ctx, T, 37.65, 39.9, 'Trao tô qua ghe', 'Boat-to-boat delivery', 9);
}
// handover point remembered from the last pre-handover frame (fallback computed once below)
const HANDOVER = { c: null, s: 0.24 * 1.15 * NP.U_CO };
(function initHandover() {
  try {
    const pc = probeCtx();
    const hb = HP.hutieuBoat(pc, HB.x, HB.y + Math.sin(S14_HAND * 1.4) * 4, HB.s, { part: 'back', t: S14_HAND, flip: true, tarp: false });
    const r = HP.diBay(pc, hb.seat[0], hb.seat[1], HB.s, { pose: 'handBowl', k: 1, to: [400, 1040], t: S14_HAND, layers: 7, broth: 1 });
    HANDOVER.c = r.bowl.center.slice();
  } catch (e) { HANDOVER.c = [440, 1120]; }
})();

// =================================================================================================== S15 40.0–45.0
// The tourist sips tiny spoonfuls, pinky up. Dì Bảy shakes her head — "Phải húp mới ngon!" — then slurps neatly: "Sụp!"
function s15(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const sipK = 0.5 - 0.5 * Math.cos(TAU * (T - 40.0) / 1.25);
  const shake = T > 41.0 && T < 43.0 ? Math.sin((T - 41.0) * TAU * 2.4) * 0.55 * Math.sin(PI * iv(41.0, 43.0, T)) : 0;
  const slurpT = T >= 43.15;
  const slurpK = iv(43.35, 44.25, T);
  const amazed = T > 43.6;
  twoBoats(ctx, T, {
    camX: 440, camY: 1170 - 20 * e, camZ: 1.36 + 0.1 * e,
    boatmanPose: amazed ? 'cheer' : 'nod',
    her: (TT) => slurpT
      ? { pose: 'slurp', t: TT, slurpK, layers: 7, broth: 0.9, look: [0.1, 0.9] }
      : { pose: 'handBowl', k: 0, t: TT, layers: 7, broth: 1, steam: 0.5, turn: T > 41.0 ? shake : 0.35, expr: T > 41.0 ? 'talk' : 'calm', look: [0.5, -0.6] },
    his: (TT) => amazed
      ? { pose: 'sip', k: 0.15, t: TT, expr: 'wow', sweat: 0.6, layers: 7, broth: 0.9, pinkySpark: false }
      : { pose: 'sip', k: sipK, t: TT, sweat: 0.4, layers: 7, broth: 0.95 },
    after: (c, her) => {
      if (slurpT && her.bowl) {
        const k = iv(43.4, 44.6, T);
        if (k > 0 && k < 1) HP.slurpRings(c, her.bowl.center[0], her.bowl.center[1], 0.3, k, { n: 3, maxR: 260, seed: 3 });
      }
    },
  });
  X.line(ctx, T, 41.0, 43.1, 'Phải húp mới ngon!', 'You gotta SLURP it!', { y: 380 });
  X.line(ctx, T, 43.4, 44.9, 'Sụp!', 'Slurp!', { y: 380, vsize: 92 });
}

module.exports = { s9, s10, s11, s12, s13, s14, s15 };
