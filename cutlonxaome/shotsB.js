'use strict';
// shotsB.js — writer B: s6 toss (16.875–20.625) · s7 plate hero (20.625–26.25) · s8 cat gag (26.25–30.0) · s9 how to eat (30.0–33.75)
// Each sN(ctx, lt, p, T) paints the full opaque 1080x1920 frame (screen-space blurred bg first, then world under a clamped camera).
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const B = require('./b_props'), CF = require('./cl_food'), CT = require('./ctprops'), P = require('./people'), PR = require('./props');

const PI = Math.PI;
const iv = (a, b, v) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const bump = (T, t0, d) => { const u = (T - t0) / d; return u > 0 && u < 1 ? Math.sin(PI * u) : 0; };
const spring = (t, f = 3, d = 5) => (t > 0 ? Math.exp(-d * t) * Math.sin(TAU * f * t) : 0);
// camera with clamped centre (world = W x H) -> never shows outside the painted frame
const cam = (ctx, cx, cy, z, rot, fn) => L.cam(ctx, clamp(cx, 540 / z, W - 540 / z), clamp(cy, 960 / z, H - 960 / z), z, rot, fn);
// camera for a bigger world (2400 x 2400)
const cam2 = (ctx, cx, cy, z, rot, fn) => {
  const ax = 540 / z, bx = 2400 - 540 / z, ay = 960 / z, by = 2400 - 960 / z;
  L.cam(ctx, ax > bx ? 1200 : clamp(cx, ax, bx), ay > by ? 1200 : clamp(cy, ay, by), z, rot, fn);
};
// eased keyframes [[t, [a,b,c]], ...]
function keyed(T, ks) {
  if (T <= ks[0][0]) return ks[0][1].slice();
  for (let i = 1; i < ks.length; i++) if (T <= ks[i][0]) {
    const [t0, a] = ks[i - 1], [t1, b] = ks[i], e = ease.inOut(clamp((T - t0) / (t1 - t0)));
    return a.map((v, j) => lerp(v, b[j], e));
  }
  return ks[ks.length - 1][1].slice();
}
function neonWash(ctx, T, k = 1, y = 820) {
  L.glow(ctx, 30, y, 560, 'rgba(255,60,170,0.55)', k * (0.75 + 0.25 * Math.sin(T * 3.1)), 'screen');
  L.glow(ctx, 1050, y - 60, 560, 'rgba(50,210,255,0.5)', k * (0.75 + 0.25 * Math.sin(T * 2.3 + 1)), 'screen');
}
function flash(ctx, T, t0, a = 0.14, d = 0.16) { const k = hitAt(T, t0, d); if (k > 0) { ctx.fillStyle = `rgba(255,240,215,${a * k})`; ctx.fillRect(0, 0, W, H); } }
const CHILLI = ['#d8261c', '#ff4a2a', '#b01810', '#fff4e0', '#ffffff'];

// ================================================================================================ S6  toss on high flame
const S6F = [18.2, 18.7, 19.2];
const S6E = (() => {
  const r = rng(61), a = []; let id = 0;
  for (const [y, n, w] of [[-6, 4, 330], [30, 5, 450], [66, 3, 250]]) for (let i = 0; i < n; i++) {
    const sp = []; for (let j = 0; j < 5; j++) sp.push([(r() - 0.5) * 50, (r() - 0.6) * 60, r()]);
    a.push({ x: (i / (n - 1) - 0.5) * w + (r() - 0.5) * 30, y: y + (r() - 0.5) * 14, rot: (r() - 0.5) * 1.1, seed: (id++) + 1, sp: (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.7), dr: r() - 0.5, hv: r(), specks: sp });
  }
  return a;
})();
const S6G = (() => { const r = rng(62), a = []; for (let i = 0; i < 60; i++) { const ang = r() * TAU, d = Math.sqrt(r()); a.push([Math.cos(ang) * 320 * d, 40 + Math.sin(ang) * 90 * d, 4 + r() * 6, r() < 0.5 ? '#e8b25a' : r() < 0.5 ? '#c98a3a' : '#7a4a20']); } return a; })();

function s6(ctx, lt, p, T) {
  ctx.drawImage(B.nightBg('close'), 0, 0);
  neonWash(ctx, T, 0.8, 760);
  let sh = 0.6 * hitAt(T, 17.2, 0.3); for (const tb of S6F) sh += hitAt(T, tb, 0.3); sh *= 9;
  const z = lerp(1.3, 1.4, ease.inOut(clamp(lt / 3.75)));
  let fl = 0; for (const tb of S6F) fl += hitAt(T, tb, 0.5);
  const off = iv(20.3, 20.45, T), fk = (1 + 0.35 * fl) * (1 - off);
  const blue = T < 20.4 ? null : Math.max(0.0001, 1 - iv(20.4, 20.6, T));
  let jk = 0.5 * bump(T, 17.1, 0.25); for (const tb of S6F) jk += bump(T, tb - 0.1, 0.25);
  cam(ctx, 540 + Math.sin(T * 90) * sh, 1130 + Math.cos(T * 77) * sh, z, 0, () => {
    // stove body + burner
    ctx.fillStyle = B.lgr(ctx, 0, 1430, 0, 1920, [[0, '#2b3140'], [0.15, '#1a1f2a'], [1, '#090b10']]); ctx.fillRect(-100, 1430, 1280, 600);
    ctx.fillStyle = 'rgba(160,190,230,0.25)'; ctx.fillRect(-100, 1430, 1280, 5);
    B.ell(ctx, 540, 1478, 360, 52); ctx.fillStyle = '#0d0f14'; ctx.fill();
    B.ell(ctx, 540, 1472, 300, 40); ctx.fillStyle = B.rgr(ctx, 540, 1472, 10, 540, 1472, 300, [[0, `rgba(255,150,60,${0.6 * fk})`], [1, 'rgba(40,30,30,0.6)']]); ctx.fill();
    B.fireB(ctx, T, 540, 1470, 900, fk, { h: 360, blue, seed: 7 });
    // wok
    B.wokB(ctx, 540, 1200 - 22 * jk, 420, {
      tilt: -0.05 * jk, heat: 0.4 + 0.6 * fk,
      inner: (c, irx, iry) => {
        const sk = iv(17.7, 18.1, T);
        B.ell(c, 0, 52, 300 + 40 * sk, 82 + 10 * sk);
        c.fillStyle = B.rgr(c, -40, 30, 5, 0, 52, 340, [[0, `rgba(208,122,58,${0.25 + 0.65 * sk})`], [0.5, `rgba(168,80,28,${0.2 + 0.72 * sk})`], [1, 'rgba(90,36,16,0)']]); c.fill();
        for (const g of S6G) { c.fillStyle = g[3]; c.fillRect(g[0], g[1], g[2], g[2] * 0.7); }
        const gl = T < 17.7 ? 0 : iv(17.7, 19.6, T), sp = iv(20.0, 20.25, T);
        for (let i = 0; i < S6E.length; i++) {
          const e = S6E[i];
          let dx = 0, dy = 0, rot = e.rot, sq = 1, air = 0;
          for (const [tb, h, spin] of [[17.2, 110, 0.25], [18.2, 380, 1], [18.7, 420, 1], [19.2, 380, 1]]) {
            const u = (T - tb - (i % 4) * 0.025) / 0.44;
            if (u > 0 && u < 1) { dy -= h * 4 * u * (1 - u) * (0.8 + 0.4 * e.hv); dx += Math.sin(u * PI) * e.dr * 90 * spin; rot += e.sp * u * TAU * 0.5 * spin; air = 1; }
            const v = u - 1; if (v > 0 && v < 0.3) sq = 1 - 0.16 * Math.sin(v / 0.3 * PI);
          }
          CF.cutLon(c, e.x + dx, e.y + dy, 1.15, { state: 'fried', rot, seed: e.seed, glaze: gl, squash: sq, shadow: !air });
          if (sp > 0) {
            c.save(); c.globalAlpha = sp;
            for (const [ox, oy, q] of e.specks) { c.fillStyle = q < 0.7 ? '#d8261c' : '#fff4e0'; c.fillRect(e.x + dx + ox, e.y + dy + oy, 5, 4); }
            c.restore();
          }
        }
      },
    });
    L.glow(ctx, 540, 1440, 560, 'rgba(255,140,50,0.55)', 0.5 * fk, 'screen');
    // sizzle + hiss
    const sz = (T < 17.7 ? 0.35 : 0.35 + 1.2 * (1 - iv(17.7, 18.9, T))) * (1 - 0.8 * iv(20.4, 20.7, T));
    CT.sizzle(ctx, T, 540, 1232, sz, { r: 270, ryr: 0.3, seed: 9 });
    CT.powderPuff(ctx, T, 560, 1150, (T - 17.7) / 1.0, { s: 2.3, col: [228, 232, 240], seed: 3 });
    CT.powderPuff(ctx, T, 480, 1170, (T - 17.8) / 0.9, { s: 1.7, col: [236, 236, 240], seed: 4 });
    // flips: flare-ups + sparks + lens flare
    S6F.forEach((tb, i) => {
      const fx = [310, 780, 330][i];
      CT.flareUp(ctx, T, fx, 1190, (T - tb + 0.05) / 0.6, { s: 1.7, seed: 11 + i });
      CT.sparks(ctx, T, { x: fx, y: 1170, w: 300, n: 34, t0: tb - 0.05, s: 1.3, seed: 21 + i });
      L.flare(ctx, fx, 1080, 1.3, hitAt(T, tb, 0.45) * 0.75);
    });
    CT.sparks(ctx, T, { x: 540, y: 1180, w: 760, h: 700, n: 16, k: 0.7 * (1 - off), s: 1.1, seed: 4 });
    CT.steam(ctx, T, { x: 540, y: 1150, w: 620, h: 760, n: 12, warm: 0.4, alpha: 0.75 + 0.5 * iv(17.7, 18.2, T), seed: 5, s: 1.6 });
    // sauce pour (lilac sleeve, Cô Năm's hand)
    if (T > 16.95 && T < 18.6) {
      const kin = ease.out(iv(17.0, 17.3, T)), kout = ease.in(iv(18.25, 18.55, T));
      const bx = lerp(1220, 730, kin) + kout * 560, by = 830 - kout * 120;
      const tilt = -0.95 * ease.inOut(iv(17.35, 17.6, T)) * (1 - ease.inOut(iv(18.0, 18.25, T)));
      const s = 1.3, lip = B.sauceBowl(ctx, bx, by, s, tilt);
      const c = Math.cos(tilt), sn = Math.sin(tilt), gx = bx + (96 * c - 8 * sn) * s, gy = by + (96 * sn + 8 * c) * s;
      B.handAt(ctx, gx, gy, [70, 0], PI + tilt, 1.25, { kind: 'grip', skin: B.SK_CN, sleeve: B.LILAC, arm: 420, flip: true });
      B.streamB(ctx, T, lip[0], lip[1], 560, 1190, 30, iv(17.55, 17.7, T), { k0: iv(18.0, 18.2, T), sag: 40 });
    }
    // chilli + sugar sprinkle at 19.9
    if (T > 19.5 && T < 20.5) {
      const kin = ease.out(iv(19.55, 19.8, T)), kout = ease.in(iv(20.2, 20.45, T));
      const tx = 430 - (1 - kin) * 420 - kout * 440, ty = 900 - (1 - kin) * 300 - kout * 320;
      const rub = T > 19.85 && T < 20.1 ? 0.5 + 0.5 * Math.sin(T * 60) : 0;
      B.handAt(ctx, tx + rub * 4, ty, [106, -18], 0.9, 1.3, { kind: 'pinch', skin: B.SK_CN, sleeve: B.LILAC, arm: 420, k: rub });
    }
    L.flakes(ctx, T, 19.9, 71, 60, 432, 908, { g: 1500, speed: 140, angle: PI / 2, spread: 0.9, life: 0.7, colors: CHILLI, size: 9, stagger: 0.25 });
    // flame off: little smoke wisp
    if (T > 20.35) CT.steam(ctx, T, { x: 540, y: 1430, w: 400, h: 300, n: 6, alpha: 0.6 * iv(20.35, 20.5, T), seed: 8 });
  });
}

// ================================================================================================ S7  plating hero
const S7P = [21.2, 21.6, 22.0, 22.4], S7X = 540, S7Y = 1240;
const S7T = (() => { const a = []; for (let i = 0; i < 12; i++) { const [dx, dy, rot, li] = CF.eggPos(i, 12, 3); a.push({ x: S7X + dx, y: S7Y + dy, rot: rot * 0.5, s: 1.55 - li * 0.05, seed: i + 1 }); } return a; })();
const S7C = S7P.map((tp, g) => { let x = 0, y = 0; for (let j = 0; j < 3; j++) { x += S7T[3 * g + j].x; y += S7T[3 * g + j].y; } return [clamp(x / 3, 380, 720), y / 3]; });
const HEAP = [[0, -14], [-50, -4], [50, -4], [-24, -60], [26, -60]];
function s7Ladle(T) { // -> {x,y,rot,vis}
  let x, y;
  const g = S7P.findIndex(tp => T < tp - 0.1);
  if (g === 0 || g === -1 && T < 21) { x = S7C[0][0]; y = S7C[0][1] - 270; }
  else if (g === -1) { x = S7C[3][0]; y = S7C[3][1] - 270; }
  else { const a = S7C[g - 1], b = S7C[g], e = ease.inOut(iv(S7P[g] - 0.36, S7P[g] - 0.22, T)); x = lerp(a[0], b[0], e); y = lerp(a[1], b[1], e) - 270; }
  const kin = ease.out(iv(20.65, 20.95, T)), kout = ease.in(iv(22.5, 22.8, T));
  x += (1 - kin) * 620 + kout * 700; y -= (1 - kin) * 300 + kout * 360;
  let rot = -0.12 + 0.03 * Math.sin(T * 5); for (const tp of S7P) rot -= 0.6 * bump(T, tp - 0.3, 0.38);
  const rem = 12 - 3 * S7P.filter(tp => T > tp - 0.2).length;
  return { x, y, rot, vis: rem <= 0 ? 0 : Math.ceil(rem / 2.4) };
}
function s7(ctx, lt, p, T) {
  ctx.drawImage(B.nightBg('wide'), 0, 0);
  neonWash(ctx, T, 0.9, 760);
  const pk = ease.inOut(iv(23.9, 25.2, T)), z = lerp(1.25, 1.45, pk);
  cam(ctx, 540, lerp(1120, 1200, pk), z, 0, () => {
    B.table(ctx, -60, 1050, 1140, 2000, { wx: 540, wy: 1250 });
    // land count
    let landed = 0; for (let i = 0; i < 12; i++) if (T >= S7P[Math.floor(i / 3)] + (i % 3) * 0.03) landed++;
    let hop = 0; for (const tp of S7P) hop += hitAt(T, tp, 0.18);
    const sauce = 0.3 + 0.2 * landed / 12 + 0.5 * iv(23.0, 23.4, T), herb = iv(23.6, 23.9, T);
    const pl = CF.cutLonPlate(ctx, S7X, S7Y - 5 * hop, 1, { k: landed / 12, herb, sauce, t: T, seed: 3 });
    L.glow(ctx, 600, 1120, 520, 'rgba(255,170,80,0.6)', 0.35, 'screen');
    // falling eggs
    const lad = s7Ladle(T);
    for (let i = 0; i < 12; i++) {
      const g = Math.floor(i / 3), j = i % 3, t1 = S7P[g] + j * 0.03, t0 = t1 - 0.2;
      if (T < t0 || T >= t1) continue;
      const u = (T - t0) / 0.2, e = S7T[i];
      const c = Math.cos(lad.rot), sn = Math.sin(lad.rot), lx = (-60 + j * 30) * 1.6, ly = -20 * 1.6;
      const sx = lad.x + lx * c - ly * sn, sy = lad.y + lx * sn + ly * c;
      CF.cutLon(ctx, lerp(sx, e.x, u), lerp(sy, e.y, u * u), e.s, { state: 'fried', rot: e.rot + (1 - u) * 0.8, seed: e.seed, glaze: 1, shadow: false });
    }
    S7P.forEach((tp, g) => L.flakes(ctx, T, tp, 80 + g, 14, S7C[g][0], S7C[g][1] + 10, { angle: -PI / 2, spread: 2.6, speed: 420, g: 1800, life: 0.45, colors: B.SAUCE, size: 6 }));
    // ladle (big steel vá, lilac hand at the far end of the handle)
    if (T < 22.85) {
      const vis = lad.vis;
      B.ladleB(ctx, lad.x, lad.y, 1.6, lad.rot, (c) => {
        const pick = HEAP.slice(0, vis).sort((a, b) => a[1] - b[1]);
        for (const [hx, hy] of pick) CF.cutLon(c, hx, hy, 0.95, { state: 'fried', seed: (hx + 100) % 6 + 1, glaze: 1, shadow: false });
      });
      const c = Math.cos(lad.rot), sn = Math.sin(lad.rot), hx = lad.x + (360 * c + 56 * sn) * 1.6, hy = lad.y + (360 * sn - 56 * c) * 1.6;
      B.handAt(ctx, hx, hy, [70, 0], lad.rot - 0.15 + PI, 1.3, { kind: 'grip', skin: B.SK_CN, sleeve: B.LILAC, arm: 450, flip: true });
    }
    // drizzle of tamarind glaze
    if (T > 22.55 && T < 23.65) {
      const kin = ease.out(iv(22.6, 22.8, T)), kout = ease.in(iv(23.4, 23.6, T));
      const bx = 760 + (1 - kin) * 560 + kout * 600, by = 800 - (1 - kin) * 150 - kout * 200;
      const tilt = -0.9 * ease.inOut(iv(22.75, 22.9, T)) * (1 - ease.inOut(iv(23.25, 23.4, T)));
      const s = 1.2, lip = B.sauceBowl(ctx, bx, by, s, tilt);
      const c = Math.cos(tilt), sn = Math.sin(tilt), gx = bx + (96 * c - 8 * sn) * s, gy = by + (96 * sn + 8 * c) * s;
      B.handAt(ctx, gx, gy, [70, 0], PI + tilt, 1.2, { kind: 'grip', skin: B.SK_CN, sleeve: B.LILAC, arm: 420, flip: true });
      B.streamB(ctx, T, lip[0], lip[1], 560 + Math.sin(T * 6) * 40, 1060, 20, iv(22.85, 23.0, T), { k0: iv(23.25, 23.4, T), sag: 30 });
    }
    // rau răm sprinkle
    if (T > 23.25 && T < 24.05) {
      const kin = ease.out(iv(23.3, 23.5, T)), kout = ease.in(iv(23.75, 24.0, T));
      const tx = 500 - (1 - kin) * 420 - kout * 460, ty = 880 - (1 - kin) * 340 - kout * 360, rub = T > 23.55 && T < 23.75 ? 0.5 + 0.5 * Math.sin(T * 50) : 0;
      B.handAt(ctx, tx, ty, [106, -18], 0.9, 1.25, { kind: 'pinch', skin: B.SK_CN, sleeve: B.LILAC, arm: 420, k: rub });
      if (T < 23.62) for (let i = 0; i < 3; i++) CF.ramLeaf(ctx, tx - 8 + i * 8, ty + 4, 0.9, { rot: i - 1 });
    }
    if (T > 23.6 && T < 23.95) {
      const r = rng(77);
      for (let i = 0; i < 7; i++) {
        const d = r() * 0.08, u = clamp((T - 23.6 - d) / 0.25), txx = 540 + (i - 3) * 55 + (r() - 0.5) * 30, tyy = 1010 + (i % 2) * 40 + r() * 30;
        if (u <= 0) continue;
        ctx.save(); ctx.globalAlpha = 1 - iv(23.82, 23.92, T);
        CF.ramLeaf(ctx, lerp(500, txx, u), lerp(885, tyy, u * u), 1.25, { rot: (r() - 0.5) * 3 + u * 4 * (i % 2 ? 1 : -1) });
        ctx.restore();
      }
    }
    // glaze tings + glints
    CT.glazeSparkle(ctx, T, 540, 1140, 230, 0.4 * iv(23.2, 23.6, T) + 0.6 * iv(24.0, 24.3, T), { n: 8, ryr: 0.55, seed: 52 });
    [24.2, 24.6, 25.0].forEach((ti, k) => {
      const e = pl.eggs[[11, 8, 5][k]]; if (!e) return; const a = bump(T, ti - 0.04, 0.42);
      if (a > 0) { L.sparkle(ctx, e[0] + 14, e[1] - 40, 90 * a, a); L.glow(ctx, e[0] + 14, e[1] - 40, 70, 'rgba(255,240,200,0.8)', a * 0.8, 'screen'); }
    });
    CT.steam(ctx, T, { x: 540, y: 1080, w: 420, h: 800, n: 10, warm: 0.35, alpha: 0.65 * iv(21.2, 21.8, T), seed: 17, s: 1.5 });
    // neon reflections on the rim
    L.glow(ctx, 230, 1250, 260, 'rgba(255,60,170,0.5)', 0.45, 'screen');
    L.glow(ctx, 860, 1220, 260, 'rgba(50,210,255,0.45)', 0.45, 'screen');
  });
}

// ================================================================================================ S8  slippery egg -> cat
const PL8 = [1330, 1520], PS8 = 0.85;
const EG8 = (() => { const [dx, dy, rot, li] = CF.eggPos(11, 12, 3); return { x: PL8[0] + dx * PS8, y: PL8[1] + dy * PS8, rot: rot * 0.5, s: (1.55 - li * 0.05) * PS8 }; })();
const CAT8 = [840, 1470], LEAP8 = [880, 1220], MOUTH8 = [880 + 66 * 1.15, 1220 - 120 * 1.15];
const LIFT8 = [EG8.x + 10, EG8.y - 90];
const qb = (a, c, b, u) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]];
function egg8(T) { // -> {x,y,rot,s,state}
  if (T < 26.9) return null;
  if (T < 27.3) { const k = ease.inOut(iv(26.9, 27.25, T)), tr = Math.sin(T * 70) * 4 * k; return { x: lerp(EG8.x, LIFT8[0], k) + tr, y: lerp(EG8.y, LIFT8[1], k), rot: EG8.rot + Math.sin(T * 50) * 0.06 * k, s: EG8.s, sq: 1 - 0.08 * k }; }
  if (T < 28.1) { const u = iv(27.3, 28.1, T), uu = u * 0.85 + 0.15 * u * u, pp = qb(LIFT8, [1120, 560], MOUTH8, uu); return { x: pp[0], y: pp[1], rot: EG8.rot + uu * 3 * TAU, s: lerp(EG8.s, 1.0, uu), sq: 1, fly: u }; }
  return null;
}
function s8(ctx, lt, p, T) {
  const [z0, cx0, cy0] = keyed(T, [[26.55, [1.706, 1330, 1486]], [26.95, [1.3, 1450, 1300]], [27.3, [1.36, 1420, 1290]], [27.38, [1.36, 1420, 1290]], [28.1, [1.38, 1050, 1290]], [28.6, [1.38, 1050, 1290]], [29.1, [1.12, 1255, 1290]], [30.0, [1.14, 1255, 1295]]]);
  const sh = 10 * hitAt(T, 28.1, 0.3);
  const cx = cx0 + Math.sin(T * 83) * sh, cy = cy0 + Math.cos(T * 71) * sh;
  const bg = B.nightBg('wide'), px = -(cx - 1260) * 0.08 - 40;
  ctx.drawImage(bg, px, -30, W + 80, H + 60);
  neonWash(ctx, T, 0.7, 700);
  const egg = egg8(T);
  cam2(ctx, cx, cy, z0, 0, () => {
    // wet asphalt floor
    ctx.fillStyle = B.lgr(ctx, 0, 1250, 0, 2400, [[0, 'rgba(18,28,44,0)'], [0.12, 'rgba(18,28,44,0.92)'], [0.4, '#121a28'], [1, '#080b12']]); ctx.fillRect(-400, 1250, 3200, 1200);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const [x0, col] of [[300, '255,60,170'], [520, '50,210,255'], [1900, '255,60,170'], [2150, '255,180,90']]) {
      ctx.fillStyle = B.lgr(ctx, 0, 1500, 0, 2400, [[0, `rgba(${col},0.3)`], [1, `rgba(${col},0)`]]); ctx.fillRect(x0 - 40, 1500, 80, 900);
    }
    ctx.restore();
    // Cô Năm behind the table
    let pose = 'stand', expr = 'smile', lookX = 0.6, lookY = 0.3, kk = 0;
    if (T >= 27.4) { lookX = -0.7; lookY = -0.4; }
    if (T >= 28.1) { expr = 'o'; lookX = -0.9; lookY = 0; }
    if (T >= 28.9) { pose = 'laugh'; expr = undefined; }
    if (T >= 29.35) { pose = 'plate'; kk = ease.out(iv(29.35, 29.6, T)); expr = 'grin'; lookX = 0.9; }
    CT.coNam(ctx, 1130, 1640, 1.45, {
      pose, t: T, k: kk, expr, lookX, lookY,
      light: { x: 1330, y: 1300, k: 0.75, r: 900 }, neon: { col: 'pink', k: 0.7, side: -1 },
      plateFn: (c, q) => { spoonEgg(c, q.x + 60 * q.s, q.y - 6 * q.s, 0.9 * q.s, PI + 0.08, {}); },
    });
    // tourist (face rig) at the right side of the table
    let mouth = 'smile', open = 1, pupil = 1, tlx = -0.7, tly = 0.7, hair = 0, blush = 0, mOpen = 0, brow = 0;
    if (T >= 26.9 && T < 27.3) { mouth = 'neutral'; brow = -0.4; tlx = -0.8; tly = 0.5; }
    if (T >= 27.3) { mouth = 'o'; mOpen = 0.9; open = 1.35; pupil = 0.6; brow = 1; hair = Math.abs(spring(T - 27.3, 3, 3)) * 1.2; }
    if (egg && egg.fly != null) { tlx = clamp((egg.x - 1680) / 500, -1, 1); tly = clamp((egg.y - 1060) / 400, -1, 1); }
    if (T >= 28.1) { tlx = -1; tly = 0.2; }
    if (T >= 29.55) { mouth = 'smile'; mOpen = 0; open = 1; pupil = 1; brow = 0.3; blush = 0.7; tlx = -0.8; tly = 0.3; }
    P.face(ctx, 1690, 1110, 0.62, { turn: -0.35, lookX: tlx, lookY: tly, mouth, mOpen, open, pupil, brow, blush, hairLift: hair, t: T });
    // table
    B.table(ctx, 990, 1330, 2600, 1700, { wx: 1330, wy: 1500 });
    ctx.fillStyle = B.lgr(ctx, 0, 1700, 0, 1770, [[0, '#1d4f8f'], [1, '#0f2a50']]); ctx.fillRect(990, 1690, 1610, 70);
    for (const lx of [1040, 1700]) { ctx.fillStyle = B.lgr(ctx, lx, 0, lx + 40, 0, [[0, '#1b4a86'], [1, '#0c2244']]); ctx.fillRect(lx, 1760, 40, 600); }
    // plate (11 eggs once the top one is grabbed)
    CF.cutLonPlate(ctx, PL8[0], PL8[1], PS8, { k: T < 26.9 ? 1 : 11 / 12, t: T, seed: 3 });
    // stool + cat
    B.stool(ctx, CAT8[0], CAT8[1], 0.9);
    let cpos = CAT8, cpose = 'sit', ck = 1, cheek = 0, closed = false, look = 1, clY = 0, cmouth = 0;
    if (egg) { look = clamp((egg.x - 860) / 250, -1, 1); clY = clamp((egg.y - 1290) / 300, -1, 1); }
    if (T >= 27.3) cmouth = 0;
    if (T >= 27.6 && T < 27.85) { cpose = 'crouch'; ck = ease.out(iv(27.6, 27.75, T)); }
    if (T >= 27.85 && T < 28.3) { cpose = 'leap'; ck = ease.out(iv(27.85, 28.0, T)); const k = ease.out(iv(27.85, 28.05, T)), kb = ease.in(iv(28.12, 28.3, T)); cpos = [lerp(lerp(CAT8[0], LEAP8[0], k), CAT8[0], kb), lerp(lerp(CAT8[1], LEAP8[1], k), CAT8[1], kb)]; cmouth = T < 28.1 ? 1 : 0.35; }
    if (T >= 28.3 && T < 28.9) { cpose = 'munch'; cheek = 1; }
    if (T >= 28.9) { cpose = 'sit'; closed = true; cheek = 0.4 * (1 - iv(28.9, 29.4, T)); }
    const cat = B.catB(ctx, cpos[0], cpos[1], 1.15, { pose: cpose, k: ck, t: T, look, lookY: clY, cheek, closed, mouth: cmouth, pupil: T > 27.3 && T < 28.1 ? 0.6 : 0 });
    if (T >= 28.1 && T < 28.32) CF.cutLon(ctx, cat.mouth[0] + 6, cat.mouth[1] + 4, 0.8, { state: 'fried', rot: 0.6, seed: 12, glaze: 1, shadow: false });
    if (T >= 28.35 && T < 29.2) { const a = bump(T, 28.35, 0.85); L.sparkle(ctx, cat.mouth[0] + 70, cat.mouth[1] - 60, 50 * a, a); }
    // chopsticks + tourist hand
    let tip, gap = 140;
    if (T < 26.9) { const k = ease.inOut(iv(26.4, 26.9, T)); tip = [lerp(1700, EG8.x + 6, k), lerp(1380, EG8.y, k)]; gap = lerp(150, 140, k); if (T > 26.8) gap = lerp(140, 92, iv(26.8, 26.9, T)); }
    else if (T < 27.3) { const e = egg8(T); tip = [e.x + 4, e.y]; gap = 92 - 4 * iv(26.9, 27.25, T) + Math.sin(T * 70) * 2; }
    else { const k = iv(27.3, 27.36, T), tr = spring(T - 27.3, 6, 4) * 14; tip = [LIFT8[0] + 4 + tr, LIFT8[1] - 6 * k]; gap = lerp(88, 8, ease.out(k)); const kb = ease.inOut(iv(28.6, 29.2, T)); tip = [lerp(tip[0], 1640, kb), lerp(tip[1], 1420, kb)]; }
    const hp = [tip[0] + 250, tip[1] - 60], ang = Math.atan2(tip[1] - hp[1], tip[0] - hp[0]);
    B.chop2(ctx, hp[0], hp[1], tip[0], tip[1], gap, 1.05);
    // egg in the chopsticks / in flight
    if (egg) {
      if (egg.fly != null) for (let g = 3; g >= 1; g--) {
        const u = iv(27.3, 28.1, T - g * 0.035); if (u <= 0) continue; const uu = u * 0.85 + 0.15 * u * u, q = qb(LIFT8, [1120, 560], MOUTH8, uu);
        ctx.save(); ctx.globalAlpha = 0.18 * (4 - g) / 3; CF.cutLon(ctx, q[0], q[1], lerp(EG8.s, 1.0, uu), { state: 'fried', rot: EG8.rot + uu * 3 * TAU, seed: 12, glaze: 1, shadow: false }); ctx.restore();
      }
      CF.cutLon(ctx, egg.x, egg.y, egg.s, { state: 'fried', rot: egg.rot, seed: 12, glaze: 1, squash: egg.sq, shadow: false });
      if (T >= 27.3 && T < 27.5) { const a = hitAt(T, 27.3, 0.2); L.sparkle(ctx, LIFT8[0], LIFT8[1], 120 * a, a); L.flakes(ctx, T, 27.3, 88, 10, LIFT8[0], LIFT8[1], { angle: -PI / 2, spread: 2.8, speed: 380, g: 1600, life: 0.4, colors: B.SAUCE, size: 6 }); }
    }
    B.handAt(ctx, hp[0], hp[1], [70, 0], ang, 1.0, { kind: 'grip', skin: B.SK_TR, sleeve: B.TEAL, arm: 380, flip: true });
    CT.steam(ctx, T, { x: PL8[0], y: PL8[1] - 120, w: 300, h: 600, n: 8, warm: 0.3, alpha: 0.5, seed: 19, s: 1.3 });
  });
}

// ================================================================================================ S9  how to eat
const BITE_C = createCanvas(360, 420), BITE_X = BITE_C.getContext('2d');
function bittenEgg(ctx, x, y, s, rot) { // egg with a scalloped bite (top-right), drawn via a small reused buffer
  const b = BITE_X; b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, 360, 420);
  CF.cutLon(b, 180, 220, 2, { state: 'fried', seed: 12, glaze: 1, shadow: false });
  const bites = [[214, 128, 36], [246, 152, 34], [256, 190, 30], [186, 116, 30]];
  b.globalCompositeOperation = 'destination-out'; b.fillStyle = '#000';
  for (const [bx, by, r] of bites) { b.beginPath(); b.arc(bx, by, r, 0, TAU); b.fill(); }
  b.globalCompositeOperation = 'source-atop'; b.strokeStyle = '#e9b44a'; b.lineWidth = 16;
  for (const [bx, by, r] of bites) { b.beginPath(); b.arc(bx, by, r + 8, 0, TAU); b.stroke(); }
  b.strokeStyle = '#7a4a26'; b.lineWidth = 10; for (const [bx, by, r] of bites) { b.beginPath(); b.arc(bx + 6, by + 6, r + 20, 0, TAU); b.stroke(); }
  b.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s / 2, s / 2); ctx.drawImage(BITE_C, -180, -220); ctx.restore();
}
function spoonEgg(ctx, bx, by, ss, rot, o = {}) { // spoon bowl at (bx,by); egg sits in it. returns egg top
  PR.spoon(ctx, bx, by, ss, rot, 0);
  const es = ss * 0.53, ey = by - 34 * es;
  if (o.bitten) bittenEgg(ctx, bx, ey, es, -0.1); else if (o.egg !== false) CF.cutLon(ctx, bx, ey, es, { state: 'fried', seed: 12, glaze: 1, rot: -0.1, shadow: false, herb: o.herb || 0 });
  // spoon lip in front of the egg
  ctx.save(); ctx.translate(bx, by); ctx.rotate(rot); ctx.scale(ss, ss);
  ctx.beginPath(); ctx.ellipse(0, 0, 46, 30, 0, 0.15, PI - 0.15); ctx.ellipse(0, -6, 44, 18, 0, PI - 0.15, 0.15, true); ctx.closePath();
  ctx.fillStyle = B.lgr(ctx, 0, 0, 0, 30, [[0, '#e8e6e2'], [1, '#6c6f72']]); ctx.fill();
  ctx.restore();
  return [bx, ey - 49 * es];
}
const S9_SALT = (() => { const r = rng(91), a = []; for (let i = 0; i < 26; i++) a.push([(r() - 0.5) * 90, (r() - 0.3) * 80, r() < 0.55 ? '#2a2622' : r() < 0.5 ? '#8a847c' : '#ffffff', 2 + r() * 3]); return a; })();
function s9(ctx, lt, p, T) {
  if (T < 32.2) {
    // ---- phase 1: spoon scoops, lime, salt-pepper
    const bgc = B.nightBg('close');
    ctx.drawImage(bgc, 0, 0); ctx.fillStyle = 'rgba(6,10,20,0.25)'; ctx.fillRect(0, 0, W, H);
    neonWash(ctx, T, 0.7, 760);
    const z = 1 + 0.06 * ease.inOut(clamp(lt / 2.2));
    cam(ctx, 540, 1080, z, 0, () => {
      B.table(ctx, -80, 1150, 1160, 2100, { wx: 540, wy: 1500 });
      B.saltDish(ctx, 190, 1790, 1.3);
      const scooped = T >= 30.4;
      const pl = CF.cutLonPlate(ctx, 540, 1500, 1.35, { k: scooped ? 11 / 12 : 1, t: T, seed: 3 });
      // spoon path
      let bx, by, rot = 0.45;
      if (T < 30.4) { const k = ease.out(iv(30.0, 30.35, T)); bx = lerp(1150, 585, k); by = lerp(1560, 1312, k); }
      else { const k = ease.inOut(iv(30.4, 30.8, T)); bx = lerp(585, 500, k); by = lerp(1312, 1010, k) + Math.sin(T * 3) * 4 * k; }
      const sq = 1 - 0.06 * bump(T, 31.0, 0.15) - 0.06 * bump(T, 31.3, 0.15);
      const top = spoonEgg(ctx, bx, by, 3.6, rot, { egg: scooped, herb: T >= 31.95 ? 0.4 : 0 });
      if (!scooped) { /* egg still on plate */ }
      if (scooped && T > 31.75) { // salt-pepper specks on the egg
        const a = iv(31.75, 31.95, T); ctx.save(); ctx.globalAlpha = a;
        for (const [ox, oy, c, s] of S9_SALT) { ctx.fillStyle = c; ctx.fillRect(top[0] + ox, top[1] + 60 + oy, s, s); }
        ctx.restore();
      }
      if (scooped && T > 31.08) { // lime juice gloss
        const a = iv(31.08, 31.2, T); L.glow(ctx, top[0] - 10, top[1] + 50, 70, 'rgba(230,255,170,0.6)', a * 0.6, 'screen');
      }
      const gc = Math.cos(rot), gs = Math.sin(rot), gx = bx + 300 * gc, gy = by + 300 * gs;
      B.handAt(ctx, gx, gy, [70, 0], rot + PI, 1.5, { kind: 'grip', skin: B.SK_CN, sleeve: B.LILAC, arm: 520, flip: true });
      if (T >= 30.38 && T < 30.6) { const a = hitAt(T, 30.4, 0.2); L.flakes(ctx, T, 30.4, 93, 10, 560, 1290, { angle: -PI / 2, spread: 2.4, speed: 380, g: 1600, life: 0.4, colors: B.SAUCE, size: 6 }); L.sparkle(ctx, 600, 1260, 80 * a, a); }
      // lime squeeze
      if (T > 30.75 && T < 31.7) {
        const kin = ease.out(iv(30.8, 31.0, T)), kout = ease.in(iv(31.45, 31.65, T));
        const lx = 470, ly = 730 - (1 - kin) * 520 - kout * 560;
        const sqz = bump(T, 30.93, 0.22) + bump(T, 31.23, 0.22);
        B.limeB(ctx, lx, ly, 2.3, PI, sqz);
        B.handAt(ctx, lx + 6, ly - 70 + sqz * 10, [70, 0], PI / 2 + 0.25, 1.35, { kind: 'squeeze', skin: B.SK_CN, sleeve: B.LILAC, arm: 420, k: sqz });
        for (const t0 of [31.0, 31.3]) for (let d = 0; d < 3; d++) {
          const u = (T - t0 - d * 0.03) / 0.15; if (u < 0 || u > 1) continue;
          const dx = lerp(lx + (d - 1) * 14, top[0] - 10 + (d - 1) * 10, u), dy = lerp(ly + 30, top[1] + 30, u * u);
          B.ell(ctx, dx, dy, 7, 11); ctx.fillStyle = 'rgba(230,250,190,0.9)'; ctx.fill(); B.ell(ctx, dx - 2, dy - 4, 2.5, 3.5); ctx.fillStyle = '#fff'; ctx.fill();
        }
      }
      for (const t0 of [31.15, 31.45]) L.flakes(ctx, T, t0, 94 + t0 * 10, 8, top[0] - 10, top[1] + 30, { angle: -PI / 2, spread: 2.6, speed: 260, g: 1500, life: 0.35, colors: ['#eaffc0', '#ffffff', '#c8f080'], size: 4 });
      // salt-pepper pinch
      if (T > 31.45 && T < 32.1) {
        const kin = ease.out(iv(31.5, 31.65, T)), kout = ease.in(iv(31.85, 32.05, T));
        const tx = 560 + (1 - kin) * 480 + kout * 520, ty = 800 - (1 - kin) * 260 - kout * 280, rub = T > 31.68 && T < 31.85 ? 0.5 + 0.5 * Math.sin(T * 60) : 0;
        B.handAt(ctx, tx, ty, [106, -18], PI - 0.9, 1.3, { kind: 'pinch', skin: B.SK_CN, sleeve: B.LILAC, arm: 420, k: rub, flip: true });
      }
      L.flakes(ctx, T, 31.7, 95, 34, 556, 806, { g: 1500, speed: 120, angle: PI / 2, spread: 0.8, life: 0.45, colors: ['#2a2622', '#8a847c', '#ffffff'], size: 7, stagger: 0.15 });
      // herb leaf drop
      if (T > 31.8 && T < 31.97) { const u = iv(31.82, 31.95, T); CF.ramLeaf(ctx, lerp(640, top[0] + 10, u), lerp(760, top[1] + 30, u * u), 1.2, { rot: u * 3 }); }
      CT.steam(ctx, T, { x: bx, y: by - 60, w: 160, h: 500, n: 7, warm: 0.3, alpha: scooped ? 0.6 : 0, seed: 23, s: 1.2 });
      void pl;
    });
    return;
  }
  // ---- phase 2: Cô Năm demonstrates the bite (close-up)
  ctx.drawImage(B.nightBg('close'), 0, 0);
  neonWash(ctx, T, 0.9, 900);
  let expr = 'smile', tilt = 0, by = 0;
  if (T >= 32.35) expr = 'o';
  if (T >= 32.5) { expr = 'talk'; by = Math.sin((T - 32.5) * 22) * 6; }
  if (T >= 32.7) { expr = 'proud'; by = Math.sin((T - 32.7) * 14) * 5 * (1 - iv(33.0, 33.3, T)); tilt = -0.05; }
  if (T >= 33.2) { expr = 'grin'; tilt = 0; }
  const zz = 1 + 0.04 * ease.inOut(iv(32.2, 33.75, T));
  let mouthP = [560, 1140];
  cam(ctx, 540, 960, zz, 0, () => {
    const a = CT.coNamFace(ctx, 540, 960 + by, 1, { expr, t: T, turn: 0.25, tilt, lookX: T < 32.5 ? 0.2 : 0, lookY: T < 32.5 ? 0.5 : 0, light: { x: 760, y: 1500, k: 0.8, r: 900 }, neon: { col: 'pink', k: 0.75, side: -1 } });
    if (a && a.mouth) mouthP = a.mouth;
    // spoon to the mouth -> bite -> retract
    if (T < 32.85) {
      const kin = ease.out(iv(32.2, 32.45, T)), kout = ease.in(iv(32.55, 32.8, T));
      const bx = lerp(980, mouthP[0] + 40, kin) + kout * 520, byy = lerp(1650, mouthP[1] + 80, kin) + kout * 560;
      spoonEgg(ctx, bx, byy, 3.3, 0.5, { bitten: T >= 32.5, herb: 0.4 });
      B.handAt(ctx, bx + 300 * Math.cos(0.5), byy + 300 * Math.sin(0.5), [70, 0], 0.5 + PI, 1.5, { kind: 'grip', skin: B.SK_CN, sleeve: B.LILAC, arm: 520, flip: true });
      if (T >= 32.5 && T < 32.7) { const k = hitAt(T, 32.5, 0.2); L.flakes(ctx, T, 32.5, 96, 8, mouthP[0] + 40, mouthP[1] + 10, { angle: -PI / 2, spread: 2.4, speed: 300, g: 1500, life: 0.35, colors: B.SAUCE, size: 5 }); L.sparkle(ctx, mouthP[0] + 90, mouthP[1] - 30, 80 * k, k); }
    }
    // mmm: warm glow + hearts-ish sparkles
    if (T > 32.7 && T < 33.3) { const k = bump(T, 32.7, 0.6); for (let i = 0; i < 3; i++) L.sparkle(ctx, 300 + i * 220, 700 - i * 40 - k * 30, 50 * k, k); }
    // thumbs-up
    if (T > 32.6 && T < 33.35) {
      const kin = ease.outBack(iv(32.7, 32.95, T)), kout = ease.in(iv(33.15, 33.3, T));
      const hx = 250, hy = lerp(1800, 1420, kin) + kout * 560;
      B.hand(ctx, hx, hy, 2.3, { kind: 'thumb', rot: -0.35 + Math.sin(T * 9) * 0.04, skin: B.SK_CN, sleeve: B.LILAC, arm: 420 });
      if (kin > 0.9 && kout < 0.1) L.sparkle(ctx, hx + 20, hy - 150, 60, 0.8);
    }
  });
  // spoon with a fresh egg offered to the viewer (tourist off-screen)
  if (T >= 33.2) {
    const k = ease.out(iv(33.2, 33.6, T)), ss = lerp(3.0, 6.2, k);
    const bx = lerp(820, 560, k), byy = lerp(1700, 1380, k);
    spoonEgg(ctx, bx, byy, ss, 0.5, { herb: 0.4 });
    B.handAt(ctx, bx + 300 * ss / 3.3 * Math.cos(0.5), byy + 300 * ss / 3.3 * Math.sin(0.5), [70, 0], 0.5 + PI, 1.5 * ss / 3.3, { kind: 'grip', skin: B.SK_CN, sleeve: B.LILAC, arm: 520, flip: true });
    CT.glazeSparkle(ctx, T, bx, byy - 120 * ss / 3.3, 90 * ss / 3.3, k, { n: 4, seed: 61 });
  }
  flash(ctx, T, 32.2, 0.14, 0.15);
}

module.exports = { s6, s7, s8, s9 };
