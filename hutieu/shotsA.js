'use strict';
// shotsA.js — "Hủ tiếu chợ nổi Cái Răng" shots 1..8 (0 – 22.5 s). 96 BPM grid: beat 0.625 s, bar 2.5 s.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes (8.75) and grain.
// Look: Cái Răng at 8:00 AM, hard sunshine — deep blue sky, cumulus, high white-gold sun, dense glitter, no mist.
const HP = require('./hprops');
const X = require('./text');
const L = require('./lib');
const NP = HP.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- beat helpers
const BEAT = 0.625;
const bphase = T => ((T / BEAT) % 1 + 1) % 1;
const seg01 = (v, a, b) => clamp((v - a) / (b - a));
// decaying hit after the beat at time tb (0 before it)
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cap = (ctx, T, s0, s1, vi, en, n) => X.caption(ctx, T, s0 + 0.15, s1 - 0.1, vi, en, { n, y: 360 });

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

// camera that never shows outside the 1080x1920 canvas (clamps the look-at point for the zoom + roll)
function cam(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  L.cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}

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
const BOKEH_D = ['rgba(255,252,230,1)', 'rgba(255,236,170,1)', 'rgba(190,230,255,1)'];

// out-of-focus sunny market backdrop for macro shots (sky + boats + glittering water, heavily blurred)
function macroBg() {
  return blurred('macroBg', W, H, 22, (x) => {
    HP.riverSideDay(x, 1.0, 0, { horizon: 1130, sunX: 330, sunY: 300, sun: false, rays: 0, flare: 0, fgY: 2400,
      mid: (c) => {
        NP.ghe(c, 820, 1210, 0.55, { t: 1, seed: 3, flip: true });
        NP.ghe(c, 120, 1260, 0.5, { t: 1, seed: 6 });
      } });
  });
}
// dark wooden deck seen from above (s5 backdrop)
function deckTop() {
  return cached('deckTop', W, H, (x) => {
    const r = rng(52);
    for (let i = 0; i < 9; i++) {
      const y0 = i * 220 - 40, g = x.createLinearGradient(0, y0, 0, y0 + 220);
      const v = 0.85 + r() * 0.3;
      g.addColorStop(0, `rgb(${(122 * v) | 0},${(78 * v) | 0},${(44 * v) | 0})`); g.addColorStop(1, `rgb(${(92 * v) | 0},${(56 * v) | 0},${(30 * v) | 0})`);
      x.fillStyle = g; x.fillRect(0, y0, W, 220);
      x.strokeStyle = 'rgba(40,22,10,0.45)'; x.lineWidth = 2;
      for (let k = 0; k < 7; k++) { const yy = y0 + 20 + r() * 180; x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(300, yy + (r() - 0.5) * 30, 700, yy + (r() - 0.5) * 30, W, yy + (r() - 0.5) * 20); x.stroke(); }
      x.fillStyle = 'rgba(25,12,6,0.85)'; x.fillRect(0, y0 + 216, W, 6);
      x.fillStyle = 'rgba(255,220,160,0.12)'; x.fillRect(0, y0 + 2, W, 5);
    }
  });
}

// a clean, readable blue-sky backdrop (used behind the s4 pour, sharp sun on top)
function skyOnly(ctx, T, sun) {
  HP.daySky(ctx, 0, H, { t: T, sun, sunS: 1.3, flare: false, clouds: 5, seed: 31 });
}

// warm-up: build caches at load so the first rendered frame stays under budget
(function warm() {
  try { macroBg(); deckTop(); } catch (e) { /* drawn lazily if this fails */ }
})();

// small helpers ----------------------------------------------------------------
function herons(ctx, T, x0, y0, s, n) {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((T * 70 + i * 160) % 1500) - 200, y = y0 + i * 46 + Math.sin(T * 1.3 + i) * 10;
    HP.heron(ctx, x, y, s * (1 - i * 0.12), { t: T + i * 0.37 });
  }
}
// arm + gripping hand reaching in from outside the frame (Dì Bảy's cobalt sleeve)
function reachArm(ctx, sx, sy, hx, hy, s, kind = 'grip', rot) {
  const a = rot ?? Math.atan2(hy - sy, hx - sx);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = '#d9a27a'; ctx.lineWidth = 46 * s; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx - Math.cos(a) * 20 * s, hy - Math.sin(a) * 20 * s); ctx.stroke();
  const ex = lerp(sx, hx, 0.62), ey = lerp(sy, hy, 0.62);
  ctx.strokeStyle = HP.DIBAY.aoba; ctx.lineWidth = 70 * s; ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * 60, sy - Math.sin(a) * 60); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,0.45)'; ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.moveTo(sx, sy - 26 * s); ctx.lineTo(ex, ey - 26 * s); ctx.stroke();
  ctx.restore();
  NP.cHand(ctx, hx - Math.cos(a) * 30 * s, hy - Math.sin(a) * 30 * s, s * 1.0, a, { kind });
}
// scent wisp: wavy translucent ribbon from (x0,y0) to (x1,y1), revealed by k
function scentWisp(ctx, x0, y0, x1, y1, t, k, a = 0.6) {
  if (k <= 0) return;
  ctx.save(); ctx.lineCap = 'round';
  for (let j = 0; j < 3; j++) {
    ctx.beginPath();
    const n = 40;
    for (let i = 0; i <= n * k; i++) {
      const u = i / n, x = lerp(x0, x1, u), y = lerp(y0, y1, u) - Math.sin(u * PI) * 160 + Math.sin(u * 9 + t * 4 + j * 2) * 22;
      i ? ctx.lineTo(x, y + j * 14) : ctx.moveTo(x, y + j * 14);
    }
    ctx.strokeStyle = `rgba(255,255,255,${a * (0.5 - j * 0.12)})`; ctx.lineWidth = 16 - j * 4; ctx.stroke();
  }
  ctx.restore();
}

// =================================================================================================== S1 0–3.75
// Very wide drone: glides fast over the market then descends. Motor boat cuts a wake. Place card.
function s1(ctx, lt, p, T) {
  const glide = ease.out(clamp(lt / 2.4)), desc = ease.inOut(seg01(lt, 0.9, 3.75));
  cam(ctx, 540, 960, 1.05, -0.022 + 0.022 * desc, () => {
    const fm = HP.floatingMarketDay(ctx, T, { zoom: 0.02 + 0.5 * desc, panX: -30 + 30 * glide, clouds: 7, rays: 1 });
    // motor boat crossing the open canal, leaving a white V wake
    const wx = -46 + lt * 15, wz = 230;
    const pr = fm.project(wx, wz);
    if (pr) {
      const s = pr[2] * 16 / 760 * 1.2;
      NP.boatWake(ctx, pr[0] - 800 * s, pr[1], s, T, { dir: 1, len: 900, strength: 1 });
      NP.motorBoat(ctx, pr[0], pr[1], s, { t: T, speed: 1 });
    }
    herons(ctx, T, -80, fm.horizon - 330, 0.32, 3);
    L.flare(ctx, fm.sun[0], fm.sun[1], 0.7, 0.35);
  });
  // drone bursting out of a cloud (white haze clearing)
  const fog = 1 - ease.out(clamp(lt / 1.0));
  if (fog > 0) {
    ctx.save(); ctx.globalAlpha = fog * 0.85;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(225,240,255,0.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  X.label(ctx, T, 0.4, 3.55, 'CHỢ NỔI CÁI RĂNG · 8:00 SÁNG', 'Cai Rang Floating Market · 8:00 AM', 300);
}

// =================================================================================================== S2 3.75–6.25
// Medium, camera drifts with the xuồng between big ghe. Tourist sweating, fans himself with a nón lá, squints.
function s2(ctx, lt, p, T) {
  const pan = lt * 60;
  cam(ctx, 540, 1130, 1.04 + 0.04 * ease.inOut(p), 0.004 * Math.sin(T * 0.9), () => {
    HP.riverSideDay(ctx, T, pan, {
      horizon: 930, sunX: 780, sunY: 250, sunS: 1.1, rays: 0.8, fgY: 1740,
      mid: (c, ox) => {
        NP.ghe(c, ox * 0.55 + 170, 1110, 0.27, { t: T, seed: 2 });
        NP.ghe(c, ox * 0.6 + 800, 1080, 0.21, { t: T, seed: 5, flip: true });
        const bx = 440 + lt * 26, by = 1610, s = 0.8;
        NP.ripples(c, bx - 520, by - 20, 1040, 90, T, { alpha: 0.55, seed: 4 });
        NP.boatWake(c, bx - 540 * s, by, s, T, { dir: 1, len: 700, strength: 0.8 });
        const rx = U(c, NP.xuongBaLa(c, bx, by, s, { t: T, part: 'back' }));
        NP.boatman(c, bx - 375 * s, rx.deck[1], s, { pose: 'row', phase: T / (BEAT * 4), t: T });
        HP.tourist(c, rx.seat[0], rx.seat[1], s, { pose: 'fanHat', t: T, sweat: 1, fanHz: 1.6 });
        NP.xuongBaLa(c, bx, by, s, { t: T, part: 'front' });
        // near ghe hull slice (foreground, parallax 1.25)
        NP.ghe(c, ox * 1.25 + 1840, 1690, 0.86, { t: T, seed: 3, pole: false });
      },
    });
  });
  // harsh sun glare in the top right
  L.glow(ctx, 790, 250, 420, 'rgba(255,250,220,1)', 0.22);
  L.bokeh(ctx, T, 21, 6, BOKEH_D, 0.16, 30, 80);
}

// =================================================================================================== S3 6.25–8.75
// Close, backlit: Dì Bảy lifts the aluminium lid, a white steam column rises into the sun. Pan right: the tourist
// sniffs, then whips around.
const S3 = { s: 1.9, bx: 120, by: 1930 };
function s3(ctx, lt, p, T) {
  const panK = ease.inOut(seg01(lt, 1.05, 1.65));
  const PX = 1250 * panK;
  const lidK = ease.inOut(seg01(lt, 0.15, 0.95));
  const steamK = seg01(lt, 0.25, 2.5);
  const whip = lt > 1.95, whipT = lt - 1.95;
  let sunP = [500, 330];
  cam(ctx, 540, 960, 1.02, 0, () => {
    const r = HP.riverSideDay(ctx, T, PX, {
      horizon: 1230, sunX: 470, sunY: 330, sunS: 1.5, rays: 1, flare: 0.6, farBoats: true, fgY: 2400,
      mid: (c, ox) => {
        NP.ghe(c, ox * 0.6 + 1500, 1225, 0.24, { t: T, seed: 5, flip: true });
        // Dì Bảy's boat: pot on the clay stove (left of frame at the start)
        const s = S3.s, bx = ox + S3.bx, by = S3.by;
        const b = HP.hutieuBoat(c, bx, by, s, { part: 'back', t: T, lid: lidK, boil: 1, steam: 0, tarp: false, sign: false, bowls: false });
        HP.hutieuBoat(c, bx, by, s, { part: 'front', t: T, tarp: false, sign: false, bowls: false });
        // her arm comes in from the left (she sits behind the pot) and lifts the lid by the knob
        const ps = b.potScale, base = [bx + 180 * s, by - 177 * s];
        const knob = [base[0] + lerp(0, 150, lidK) * ps, base[1] + (-250 - 4 - lidK * 230 - 40 * 1.85) * ps];
        const sh = [bx - 330 * s, knob[1] + 330 - lidK * 120];
        reachArm(c, sh[0], sh[1], knob[0] + 4, knob[1] + 10, 1.0, 'grip');
        // steam column into the sun
        HP.steamBurst(c, T, b.potRim[0], b.potRim[1] - 10, 1.2, steamK, { n: 18, sun: [-0.25, -0.95], seed: 5, alpha: 1, rays: 1, w: 220 });
        // tourist's xuồng in the foreground right, waiting in the sun
        const xs = 1.15, xbx = ox + 1800, xby = 1870;
        NP.ripples(c, xbx - 700, xby - 30, 1400, 100, T, { alpha: 0.5, seed: 9 });
        const xr = U(c, NP.xuongBaLa(c, xbx, xby, xs, { t: T, part: 'back' }));
        let pose = 'sit', look = 0.5, expr = 'squint', flip = false;
        if (lt > 1.35 && !whip) { pose = 'sniff'; look = 0.2; expr = 'sniff'; }
        if (whip) { pose = 'sniff'; look = -0.3; expr = 'wow'; flip = true; }
        HP.tourist(c, xr.seat[0], xr.seat[1], xs, { pose, t: T, look, expr, flip, sweat: whip ? 0.4 : 1 });
        NP.xuongBaLa(c, xbx, xby, xs, { t: T, part: 'front' });
        scentWisp(c, b.potRim[0] + 100, b.potRim[1] - 300, xr.seat[0] - 40, xr.seat[1] - 290 * xs, T, ease.out(seg01(lt, 0.7, 1.7)), 0.6);
        if (whip && whipT < 0.5) { // whoosh lines around the head
          const hx = xr.seat[0], hy = xr.seat[1] - 280 * xs, a = 1 - whipT / 0.5;
          c.save(); c.strokeStyle = `rgba(255,255,255,${0.9 * a})`; c.lineWidth = 8; c.lineCap = 'round';
          for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(hx, hy, 170 + i * 28, -PI * 0.2 - i * 0.1, PI * 0.3 - i * 0.1); c.stroke(); }
          c.restore();
        }
      },
    });
    sunP = r.sun;
  });
  L.flare(ctx, sunP[0], sunP[1], 0.9, 0.5 * (1 - panK * 0.6));
  L.bokeh(ctx, T, 33, 6, BOKEH_D, 0.18, 30, 90);
}

// =================================================================================================== S4 8.75–11.25
// Macro slow motion: golden broth pours from the ladle into a bowl, sparkling splashes, lens flare. Title.
function s4(ctx, lt, p, T) {
  const ts = 8.75 + lt * 0.35, e = ease.inOut(p);
  const sun = [830, 780];
  cam(ctx, 540, 1000, 1.06 - 0.05 * e, 0.012 - 0.02 * e, () => {
    ctx.drawImage(macroBg(), 0, 0);
    HP.sunDay(ctx, sun[0], sun[1], 1.7, { rays: 1, t: ts });
    // bowl (3/4) at the bottom, filling up
    const bw = HP.huTieuBowl(ctx, 550, 1500, 2.35, { view: '3q', layers: 0, broth: 0.25 + 0.4 * p, slosh: 1, t: ts, steam: 0.6 });
    // ladle tilted, pouring
    const lr = HP.ladle(ctx, 530, 1130, 1.45, -0.25 + 0.05 * Math.sin(lt * 1.4), { fill: 1 - 0.3 * p });
    const lip = lr.lip, tgt = [bw.center[0] - 40, bw.center[1] + 10];
    HP.brothStream(ctx, lip[0], lip[1], tgt[0], tgt[1], ts, { w: 30, k: 1, seed: 4, drops: true, splash: true, bend: 0.12 });
    // sparkles on splash + stream (hard sun)
    const rr = rng(7 + Math.floor(ts * 12));
    for (let i = 0; i < 9; i++) {
      const u = rr(), x = lerp(lip[0], tgt[0], u) + (rr() - 0.5) * 60, y = lerp(lip[1], tgt[1], u * u) + (rr() - 0.5) * 30;
      L.sparkle(ctx, x, y, 14 + rr() * 22, 0.6 + rr() * 0.4);
    }
    for (let i = 0; i < 6; i++) {
      const a = PI + rr() * PI, d = 60 + rr() * 140;
      L.sparkle(ctx, tgt[0] + Math.cos(a) * d, tgt[1] + Math.sin(a) * d * 0.5, 12 + rr() * 18, 0.8);
    }
  });
  L.flare(ctx, sun[0], sun[1], 1.0, 0.6);
  L.bokeh(ctx, T, 44, 7, BOKEH_D, 0.22, 40, 110);
  { const g = ctx.createLinearGradient(0, 120, 0, 800); g.addColorStop(0, "rgba(8,28,60,0)"); g.addColorStop(0.45, "rgba(8,28,60,0.42)"); g.addColorStop(1, "rgba(8,28,60,0)"); ctx.fillStyle = g; ctx.fillRect(0, 120, W, 680); }
  X.title(ctx, T, 8.75, 11.2, 430, 'Floating Market Noodle Soup', 'HỦ TIẾU', 'CHỢ NỔI', 118, 92);
}

// =================================================================================================== S5 11.25–13.75
// Close, camera tilts down into the pot: simmering bones, daikon, charred onion, heat shimmer. Clock 3:00 → 8:00. ①
function s5(ctx, lt, p, T) {
  const e = ease.inOut(p);
  cam(ctx, 540, 1000, 1.0 + 0.1 * e, 0.03 - 0.03 * e, () => {
    ctx.drawImage(deckTop(), 0, 0);
    // stove ring glow under the pot
    L.glow(ctx, 580, 960, 640, 'rgba(255,120,40,1)', 0.35);
    HP.brothPot(ctx, 560, 960, 2.25, { view: 'top', t: T, boil: 1, steam: 0, seed: 41 });
  });
  HP.heatShimmer(ctx, 120, 520, 840, 960, T, { amp: 5, strip: 8 });
  // steam drifting up through the frame
  NP.steam(ctx, T, 9, 200, 1500, 700, 1000, { n: 10, alpha: 0.45, w: 120 });
  // clock in the corner (inside the safe zone)
  const ck = ease.inOut(seg01(lt, 0.35, 2.1));
  HP.clockFace(ctx, 200, 1430, 0.95, ck, { from: 3, to: 8, label: true });
  cap(ctx, T, 11.25, 13.75, 'Ninh xương từ 3 giờ sáng', 'Bone broth simmering since 3 AM', 1);
}

// =================================================================================================== S6 13.75–17.5
// Medium, two boats: Dì Bảy's boat pulls alongside, hooks the xuồng with a bamboo pole. "Hủ tiếu hông con?"
// The tourist fumbles, then raises the selfie-stick sign "1 TÔ / 1 BOWL". She laughs.
let XB = null; // flipped xuồng bow offset at s=1 (probed once)
function xuongBow() {
  if (!XB) { const c = createCanvas(8, 8).getContext('2d'); const r = NP.xuongBaLa(c, 0, 0, 1, { part: 'back', flip: true, t: 0 }); XB = r.bow; }
  return XB;
}
function s6(ctx, lt, p, T) {
  const arrive = ease.out(seg01(lt, 0, 1.25));
  const reachK = ease.inOut(seg01(lt, 0.7, 1.45));
  const bumpT = lt - 1.5, bump = bumpT > 0 ? Math.exp(-bumpT * 5) * Math.sin(bumpT * 26) : 0;
  const shake = bumpT > 0 ? Math.exp(-bumpT * 6) : 0;
  const signK = ease.outBack(seg01(lt, 2.35, 2.75));
  cam(ctx, 560 + Math.sin(T * 60) * 6 * shake, 1240 + Math.cos(T * 53) * 6 * shake, 1.38 + 0.05 * ease.inOut(p), 0, () => {
    HP.riverSideDay(ctx, T, lt * 8, {
      horizon: 900, sunX: 300, sunY: 240, sunS: 1.1, rays: 0.7, fgY: 1600,
      mid: (c, ox) => {
        NP.ghe(c, ox * 0.5 + 900, 1000, 0.2, { t: T, seed: 4, flip: true });
        NP.ghe(c, ox * 0.5 + 180, 990, 0.17, { t: T, seed: 7 });
        // Dì Bảy's noodle boat (farther, left), slides in from the left
        const s = 0.5, bx = lerp(-300, 290, arrive) + bump * 6, by = 1290;
        NP.boatWake(c, bx - 800 * s, by, s, T, { dir: 1, len: 600, strength: 0.8 * (1 - arrive) + 0.1 });
        const b = HP.hutieuBoat(c, bx, by, s, { part: 'back', t: T, steam: 1 });
        // tourist's xuồng (nearer, right, bow toward her)
        const xs = 0.62, xbx = 860 - bump * 10, xby = 1440;
        const XBo = xuongBow(), bowP = [xbx + XBo[0] * xs, xby + XBo[1] * xs];
        const base = [b.seat[0] + 24 * 1.26 * s, b.seat[1] - 34 * 1.26 * s];
        const dxp = bowP[0] - base[0], dyp = bowP[1] - base[1];
        const want = Math.hypot(dxp, dyp) / s, ang = Math.atan2(dxp, -dyp);
        const poleLen = lerp(420, want, reachK), poleAng = lerp(0.5, ang, reachK);
        const expr = lt > 2.75 ? 'laugh' : (lt > 0.75 && lt < 2.2 ? 'talk' : 'smile');
        HP.diBay(c, b.seat[0], b.seat[1], s, { pose: 'pole', poleAngle: poleAng, poleLen, t: T, expr, look: [bowP[0], bowP[1] - 200] });
        HP.hutieuBoat(c, bx, by, s, { part: 'front', t: T });
        const xr = U(c, NP.xuongBaLa(c, xbx, xby, xs, { t: T, part: 'back', flip: true, sway: -bump * 0.02 }));
        NP.boatman(c, xbx + 375 * xs, xr.deck[1], xs, { pose: lt > 1.6 ? 'nod' : 'row', phase: T / (BEAT * 4), t: T, flip: true });
        if (lt < 2.35) {
          const fumble = lt > 1.55;
          HP.tourist(c, xr.seat[0], xr.seat[1], xs, { pose: fumble ? 'point' : 'sit', t: T, flip: true, look: fumble ? Math.sin(T * 14) * 0.6 : -0.4, expr: fumble ? 'panic' : 'smile', sweat: fumble ? 1 : 0.5 });
        } else {
          HP.tourist(c, xr.seat[0], xr.seat[1], xs, { pose: 'sign', t: T, flip: true, len: lerp(40, 300, signK), signS: 0.68, signRot: -0.28 + Math.sin(T * 3) * 0.04, sweat: 0.3 });
        }
        NP.xuongBaLa(c, xbx, xby, xs, { t: T, part: 'front', flip: true, sway: -bump * 0.02 });
        if (bumpT > 0 && bumpT < 0.6) NP.splash(c, (b.bow[0] + bowP[0]) / 2, xby - 10, 0.5, bumpT / 0.6, { seed: 3 });
        NP.ghe(c, ox * 1.3 - 120, 2060, 0.95, { t: T, seed: 9, pole: false });
      },
    });
  });
  if (bumpT > 0 && bumpT < 0.3) L.glow(ctx, 600, 1180, 200, 'rgba(255,250,230,1)', (1 - bumpT / 0.3) * 0.35);
  L.bokeh(ctx, T, 93, 5, BOKEH_D, 0.16, 30, 90);
  X.line(ctx, T, 14.5, 16.4, '"Hủ tiếu hông con?"', '"Noodle soup?"', { y: 380 });
}

// =================================================================================================== S7 17.5–20.0
// Macro: a dry noodle bundle drops into the wire basket, the basket dips into the boiling pot, 3 shakes ON the beat.
const S7_BEATS = [18.125, 18.75, 19.375];
function potMacro(ctx, T, cx, s, surfY) {
  // giant pot, side view; rim at surfY
  return HP.brothPot(ctx, cx, surfY + 250 * s, s, { view: 'side', t: T, boil: 1, steam: 0, seed: 41 });
}
function s7(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const PS = 3.6, surfY = 1440;
  const dropK = ease.in(seg01(lt, 0.0, 0.5));           // dry bundle falls into basket
  const dipK = ease.inOut(seg01(lt, 0.5, 0.95));         // basket goes into the water
  let hit = 0; for (const tb of S7_BEATS) hit = Math.max(hit, hitAt(T, tb, 0.32));
  const shakeY = -65 * Math.pow(hit, 1.5);
  const bxs = 2.5, bx = 470 + Math.sin(hit * PI * 3) * 18 * hit, by = lerp(surfY - 330, surfY - 30, dipK) + shakeY;
  cam(ctx, 540, 1100, 1.04 + 0.04 * e, -0.01 + 0.015 * e, () => {
    ctx.drawImage(macroBg(), 0, 0);
    L.glow(ctx, 330, 300, 500, 'rgba(255,250,225,1)', 0.35);
    const pot = potMacro(ctx, T, 540, PS, surfY);
    const sRx = 176 * PS - 10 * PS, sRy = 40 * PS - 8 * PS, sy = pot.surface[1];
    // basket: hidden below the water surface outside the pot mouth
    ctx.save();
    ctx.beginPath(); ctx.rect(-200, -400, W + 400, sy + 400); ctx.ellipse(540, sy, sRx, sRy, 0, 0, TAU);
    ctx.clip();
    const fill = dropK >= 1 ? 1 : 0;
    const br = HP.noodleBasket(ctx, bx, by, bxs, -0.08, { t: T, fill, dip: clamp((by + 72 * bxs - sy) / (112 * bxs)), shake: hit, drip: 0, seed: 3 });
    // dry bundle falling in
    if (dropK < 1) HP.noodles(ctx, br.mouth[0], lerp(-200, br.mouth[1] + 40, dropK), 1.5, { dry: true, w: 120, seed: 2, rot: 0.2 * (1 - dropK) });
    ctx.restore();
    // broth film over the submerged part (inside the pot mouth, below the surface line)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(540, sy, sRx, sRy, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(196,128,44,0.55)'; ctx.fillRect(bx - 200 * bxs / 2.5, sy - 4, 400 * bxs / 2.5, 300);
    NP.ripples(ctx, bx - 260, sy - 40, 520, 90, T, { alpha: 0.7, seed: 7 });
    ctx.restore();
    // splash when the basket enters / on every shake
    const enter = lt - 0.82;
    if (enter > 0 && enter < 0.55) NP.splash(ctx, bx, sy + 6, 0.9, enter / 0.55, { seed: 5 });
    for (const tb of S7_BEATS) { const u = T - tb - 0.12; if (u > 0 && u < 0.45) NP.splash(ctx, bx + 20, sy + 6, 0.7, u / 0.45, { seed: 11 + tb * 10 | 0 }); }
    // steam over the pot, white against blue
    NP.steam(ctx, T, 13, 140, sy, 800, 900, { n: 12, alpha: 0.5, w: 150 });
  });
  L.bokeh(ctx, T, 57, 5, BOKEH_D, 0.18, 30, 90);
  cap(ctx, T, 17.5, 20.0, 'Trụng hủ tiếu', 'Blanch the noodles', 2);
}

// =================================================================================================== S8 20.0–22.5
// Macro slow motion, backlit: the basket lifts out, water drips in sparkling drops, noodles tip into the bowl. ③
function s8Basket(lt) {
  const lift = ease.out(seg01(lt, 0.0, 1.2)), tip = ease.inOut(seg01(lt, 1.25, 1.9));
  return { x: lerp(560, 640, tip), y: lerp(1520, 900, lift) + lerp(0, 40, tip), rot: lerp(-0.06, -1.95, tip), lift, tip };
}
function s8(ctx, lt, p, T) {
  const ts = 20 + lt * 0.4, e = ease.inOut(p);
  const sun = [360, 520];
  const bs = 2.4, B = s8Basket(lt);
  cam(ctx, 540, 1040, 1.03 + 0.05 * e, 0.01 - 0.015 * e, () => {
    ctx.drawImage(macroBg(), 0, 0);
    HP.sunDay(ctx, sun[0], sun[1], 1.8, { rays: 1, t: ts });
    L.godRays(ctx, sun[0], sun[1], PI / 2, 1.6, 1500, 9, 'rgba(255,248,220,0.6)', 0.14, ts);
    // bowl waiting on the deck (lower left)
    const bw = HP.huTieuBowl(ctx, 330, 1540, 1.55, { view: '3q', layers: 0, broth: 0, t: ts, steam: 0 });
    // basket
    const br = HP.noodleBasket(ctx, B.x, B.y, bs, B.rot, { t: ts, fill: 1 - 0.8 * B.tip, drip: (1 - B.tip) * B.lift, seed: 8 });
    // noodles sliding out of the tipped basket into the bowl
    if (B.tip > 0.55) {
      const fall = seg01(lt, 1.6, 2.4);
      const top = br.mouth, bot = [bw.center[0] + 10, bw.center[1]];
      const lh = Math.max(40, (bot[1] - top[1] - 40) / 1.3);
      HP.noodles(ctx, lerp(top[0], bot[0], 0.65), bot[1], 1.5, { w: 190, lift: 1 - fall * 0.9, liftH: lh, t: ts, seed: 6, wet: true });
    }
    // sparkling drips falling from the basket bottom (slow motion)
    const rr = rng(19);
    for (let i = 0; i < 40; i++) {
      const t0 = i * 0.045 + rr() * 0.03, age = (lt - t0) * 0.55;
      if (age < 0 || t0 > 1.5) continue;
      const P0 = s8Basket(t0), bot = [P0.x + Math.sin(-P0.rot) * 72 * bs + (rr() - 0.5) * 90, P0.y + 72 * bs * Math.cos(P0.rot)];
      const y = bot[1] + 1400 * age * age, x = bot[0];
      if (y > 1500) continue;
      ctx.fillStyle = 'rgba(255,236,190,0.9)'; ctx.beginPath(); ctx.ellipse(x, y, 6, 9 + age * 30, 0, 0, TAU); ctx.fill();
      if (i % 3 === 0) L.sparkle(ctx, x, y, 18, 0.8);
    }
  });
  L.flare(ctx, sun[0], sun[1], 0.9, 0.55);
  L.bokeh(ctx, T, 66, 7, BOKEH_D, 0.2, 40, 110);
  cap(ctx, T, 20.0, 22.5, 'Ráo nước, vào tô', 'Drain & into the bowl', 3);
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8 };
