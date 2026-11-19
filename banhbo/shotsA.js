'use strict';
// shotsA.js — Bánh bò nướng lá dứa · writer A · s2..s6 (2.308 – 24.231 s), 104 BPM grid.
// s2 pound pandan + squeeze juice · s3 top-down batter mixing · s4 gag 1 (tourist bites the pandan leaf)
// s5 oil the mould + pour · s6 clay-oven bake (cutaway: honeycomb rising, crust browning) → lid lift → steam in his face.
// MATCH CUT CONTRACT (s6 → s7): the last frame of s6 shows the fluted mould with the baked cake at screen (540,1000),
//   P.mould(ctx,540,1000,1,{ryr:0.42,fill:1}) + P.cakeTop(ctx,540,1000,1,{ryr:0.42}) → rim R 300 px, sitting on the brazier.
// Each sN(ctx, lt, p, T) paints the full opaque frame; render.js adds grade/flash/grain, overlay.js adds every caption.
const BX = require('./bxprops');
const L = require('./lib');
const NP = BX.NP;
const P = require('./bb_prep');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

const iv = (a, b, v) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cam = (ctx, cx, cy, z, rot, fn) => L.cam(ctx, clamp(cx, 540 / z, W - 540 / z), clamp(cy, 960 / z, H - 960 / z), z, rot, fn);
function shakeXY(T, hits, amp, d = 0.35) { let a = 0; for (const h of hits) a = Math.max(a, hitAt(T, h, d)); if (!a) return [0, 0]; const r = rng(Math.floor(T * 30) + 7); return [(r() - 0.5) * 2 * amp * a, (r() - 0.5) * 2 * amp * a]; }
const WARM = ['rgba(255,200,130,1)', 'rgba(255,160,80,1)', 'rgba(255,230,180,1)'];
const BUFS = {};
function buf(name) {
  if (!BUFS[name]) BUFS[name] = createCanvas(W, H);
  const c = BUFS[name], x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  return [c, x];
}
// vertical whip between two scene painters (k 0 → 1)
function whip(ctx, k, drawA, drawB) {
  const [a, ax] = buf('wa'), [b, bx] = buf('wb');
  drawA(ax); drawB(bx);
  const e = ease.inOut(k), off = e * H;
  for (const [img, y0] of [[a, -off], [b, H - off]]) {
    ctx.globalAlpha = 1; ctx.drawImage(img, 0, y0);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(255,220,170,${0.25 * Math.sin(k * PI)})`; ctx.fillRect(0, 0, W, H);
}
function crossfade(ctx, k, drawA, drawB) {
  if (k <= 0) return drawA(ctx); if (k >= 1) return drawB(ctx);
  const [a, ax] = buf('xa'); drawA(ax); drawB(ctx);
  ctx.globalAlpha = 1 - ease.inOut(k); ctx.drawImage(a, 0, 0); ctx.globalAlpha = 1;
}
function fgDraw(ctx, img, dx, dy) { ctx.globalAlpha = 0.78; ctx.drawImage(img, dx * 1.6, dy * 1.4 + 120); ctx.globalAlpha = 1; }
function lightPass(ctx, T, o = {}) { // warm rays + dust + bokeh in screen space
  L.godRays(ctx, o.rx ?? -80, o.ry ?? -120, o.ang ?? 1.05, 0.5, 2300, 8, 'rgba(255,190,110,0.9)', o.rays ?? 0.16, T);
  L.dust(ctx, T, o.seed || 3, 26, 0, 300, W, 1500, '255,226,170', 2.2, 0.55);
}

// ============================================================================ s2 · pound the pandan, squeeze the juice
const S2 = { LEAVES: 2.55, HITS: [2.88, 3.17, 3.46, 3.75], WHIP0: 4.02, WHIP1: 4.2, SQ: 4.3, DRIPS: [4.6, 4.9, 5.2], FULL: 5.5 };
function s2Lift(T) {
  const h = S2.HITS;
  if (T < h[0]) return T < 2.62 ? 1 : 1 - ease.in(iv(2.62, h[0], T));
  for (let i = 0; i < h.length - 1; i++) if (T < h[i + 1]) { const u = (T - h[i]) / (h[i + 1] - h[i]); return Math.pow(Math.sin(PI * Math.pow(u, 0.75)), 0.8) * 0.9; }
  return ease.out(iv(h[3], h[3] + 0.3, T));
}
function s2Mortar(ctx, T) {
  const z = lerp(1.0, 1.14, ease.inOut(iv(2.308, 4.0, T)));
  const [sx, sy] = shakeXY(T, S2.HITS, 9, 0.22);
  const mx = 530, my = 1330, ms = 1.75;
  cam(ctx, 540 + sx, 1260 + sy, z, 0, () => {
    ctx.drawImage(P.stallPlate(12), 0, 0);
    ctx.drawImage(P.table3q(900), 0, 0);
    L.glow(ctx, 760, 600, 700, 'rgba(255,190,110,1)', 0.25);
    // set dressing on the table (behind)
    P.pandanBundle(ctx, 180, 1060, 0.75, -0.08);
    P.bowl(ctx, 905, 1090, 0.55, { ryr: 0.42 });
    const mash = S2.HITS.reduce((a, h) => a + 0.25 * ease.out(iv(h, h + 0.07, T)), 0);
    const jolt = S2.HITS.reduce((a, h) => a + hitAt(T, h, 0.12) * 5, 0);
    P.mortar(ctx, mx, my + jolt, ms, {
      t: T, mash, leaves: 1,
      drop: (c) => { const tl = 2.47 + c.d * 0.36; return Math.pow(iv(tl - 0.24, tl, T), 2); },
    });
    // landing puffs of leaf bits when the chips arrive
    if (T > 2.45 && T < 2.9) L.flakes(ctx, T, 2.52, 41, 12, mx, my + 40, { colors: [P.PAN.L, P.PAN.M, P.PAN.D], speed: 320, size: 6, life: 0.4, g: 1400, spread: 2.2 });
    // pestle + hand + arm
    const lift = s2Lift(T), rot = 0.1 + lift * 0.06;
    const tipX = mx + 30 + lift * 26, tipY = my + 46 * ms + jolt - lift * 300 - mash * 10;
    const pg = P.pestle(ctx, tipX, tipY, ms * 0.9, rot, { stain: clamp(mash * 1.4) });
    const f = P.fist(ctx, pg.grip[0], pg.grip[1], ms * 0.62, rot, {});
    // arm drawn under the fist: redraw fist after arm
    P.armIn(ctx, f.wrist[0], f.wrist[1], Math.atan2(f.wrist[1] - 120, f.wrist[0] - 1500), ms * 0.62);
    P.fist(ctx, pg.grip[0], pg.grip[1], ms * 0.62, rot, {});
    // impact: juice splatter + flecks
    S2.HITS.forEach((h, i) => {
      if (T >= h && T < h + 0.6) {
        L.flakes(ctx, T, h, 100 + i, 16, tipX, tipY - 10, { colors: [P.JUICE.L, P.PAN.M, P.PAN.D, '#c9f08a'], speed: 520, size: 5, life: 0.55, g: 1800, spread: 2.6 });
        const k = hitAt(T, h, 0.18); if (k > 0) { L.glow(ctx, tipX, tipY, 160 * k + 40, 'rgba(200,255,150,0.8)', 0.5 * k); L.sparkle(ctx, tipX - 60, tipY - 30, 40 * k, k * 0.8); }
      }
    });
    L.steam(ctx, T, 4, mx, my - 20, 300, 420, 5, 0.08);
  });
  fgDraw(ctx, P.fgLeaves('L', 16), -40, 60);
  lightPass(ctx, T, { rays: 0.15 });
}
function s2Squeeze(ctx, T) {
  const tilt = ease.inOut(iv(5.12, 5.62, T)), ryr = lerp(0.5, 0.93, tilt);
  const z = lerp(1.0, 1.16, ease.inOut(iv(4.1, 5.769, T)));
  const bx = 540, by = 1470, bs = 1.7;
  const [sx, sy] = shakeXY(T, S2.DRIPS, 3, 0.15);
  let surf = null;
  cam(ctx, 540 + sx, lerp(1060, 1200, tilt) + sy, z, 0, () => {
    ctx.drawImage(P.stallPlate(14), 0, 0);
    ctx.drawImage(P.table3q(760), 0, 0);
    L.glow(ctx, 540, 1300, 650, 'rgba(255,190,110,1)', 0.22);
    P.mortar(ctx, 140, 1150, 0.7, { mash: 1, leaves: 1 });
    // fill level: continuous trickle + a bump per drip
    const fill = clamp(0.1 + 0.62 * ease.inOut(iv(4.35, 5.45, T)) + S2.DRIPS.reduce((a, d) => a + 0.08 * ease.out(iv(d, d + 0.12, T)), 0));
    const rip = S2.DRIPS.map((d) => [d, 0.05, -0.1]).concat([[4.42, 0, 0], [S2.FULL, 0.1, -0.2]]);
    const br = P.bowl(ctx, bx, by, bs, { ryr, fill, liq: 'juice', t: T, rip });
    surf = br.surf;
    // cloth bundle + wringing hands, rising out of frame on the tilt-down
    const up = ease.in(iv(5.28, 5.72, T)) * 1100;
    const sq = clamp(ease.inOut(iv(4.3, 4.6, T)) * 0.75 + S2.DRIPS.reduce((a, d) => a + 0.25 * Math.max(0, Math.sin(clamp((T - d + 0.3) / 0.35) * PI)), 0));
    const CS = 1.25, cx = 540, cy = 820 - up, tw = sq * 1.3 + Math.sin(T * 9) * 0.04 * sq;
    if (cy > -500) {
      const cb = P.clothBundle(ctx, cx, cy, CS, { sq, stain: 0.55 + 0.4 * iv(4.3, 5.2, T), t: T, twist: tw });
      // trickle (thin stream) + discrete drops
      const bot = cb.bottom, sy2 = surf ? surf[1] : by;
      const tr = iv(4.38, 4.48, T) * (1 - iv(5.25, 5.35, T));
      if (tr > 0 && bot[1] < sy2) {
        P.ribbon(ctx, [[bot[0], bot[1] - 4], [bot[0] + 2, lerp(bot[1], sy2, 0.5)], [bot[0], sy2 - 4]], 7 * tr, { t: T, col: 'juice', taper: true });
        ctx.fillStyle = 'rgba(200,255,160,0.5)'; NP.ell(ctx, bot[0], sy2 - 2, 26 * tr, 7 * tr * ryr * 2); ctx.fill();
      }
      for (const d of S2.DRIPS) {
        const grow = iv(d - 0.5, d - 0.26, T), fall = iv(d - 0.26, d, T);
        if (T > d - 0.5 && T < d) {
          const yy = fall > 0 ? lerp(bot[1] + 10, sy2 - 6, fall * fall) : bot[1] + 6 + grow * 10, rr = 8 + grow * 7;
          NP.ell(ctx, bot[0] + 4, yy, rr * 0.85, rr * (1 + fall * 0.5));
          ctx.fillStyle = NP.rgr(ctx, bot[0], yy - rr * 0.4, 1, bot[0] + 4, yy, rr * 1.2, [[0, '#e8ffc8'], [0.4, P.JUICE.L], [1, P.JUICE.D]]); ctx.fill();
        }
        const k = hitAt(T, d, 0.3);
        if (k > 0) { NP.splash(ctx, bot[0] + 4, sy2, 0.35, 1 - k, { seed: 5 }); L.sparkle(ctx, bot[0] + 30, sy2 - 20, 30 * k, 0.9 * k); }
      }
      // hands wringing the neck (upper: from the right, lower: from the left)
      const fu = [cx + 4, cy - 330 * CS], fl = [cx - 4, cy - 205 * CS], ru = -0.12 * sq + Math.sin(T * 6) * 0.02, rl = 0.12 * sq;
      let wu = P.fist(ctx, fu[0], fu[1], 1.15 * CS, ru, {}).wrist;
      P.armIn(ctx, wu[0], wu[1], Math.atan2(wu[1] - (cy - 900), wu[0] - 1400), 1.15 * CS);
      P.fist(ctx, fu[0], fu[1], 1.15 * CS, ru, {});
      let wl = P.fist(ctx, fl[0], fl[1], 1.15 * CS, rl, { flip: true }).wrist;
      P.armIn(ctx, wl[0], wl[1], Math.atan2(wl[1] - (cy - 500), wl[0] + 500), 1.15 * CS);
      P.fist(ctx, fl[0], fl[1], 1.15 * CS, rl, { flip: true });
    }
    // bowl full: glint
    const fk = hitAt(T, S2.FULL, 0.5);
    if (fk > 0 && surf) { L.sparkle(ctx, surf[0] - 120, surf[1] - 40 * ryr, 80 * fk, fk); BX.sparkles(ctx, T, surf[0], surf[1], 1.1, { n: 6, seed: 4, r: 200, alpha: fk }); }
  });
  fgDraw(ctx, P.fgLeaves('R', 16), 60, 120);
  lightPass(ctx, T, { rays: 0.14, seed: 5 });
}
function s2(ctx, lt, p, T) {
  if (T < S2.WHIP0) return s2Mortar(ctx, T);
  if (T >= S2.WHIP1) return s2Squeeze(ctx, T);
  whip(ctx, iv(S2.WHIP0, S2.WHIP1, T), (x) => s2Mortar(x, T), (x) => s2Squeeze(x, T));
}

// ============================================================================ s3 · top-down batter mixing
const S3 = { FLOUR: [6.1, 6.6], MILK: [6.9, 7.4], EGGS: [7.6, 8.0], SUGAR: 8.4, JUICE: 8.7, WHISK: [9.0, 10.2] };
const BW = { x: 540, y: 1150, s: 2.1 }; // bowl (top view), R = 420 px
function s3Table() {
  return P.cache('s3tab', 1800, 2700, (x) => {
    x.drawImage(P.tableTopDown(), 0, 0);
    x.translate(360, 390); // world → sprite
    P.pandanBundle(x, 900, 360, 0.95, 0.75);
    // coconut half with white flesh
    const cx = 110, cy = 1830;
    x.fillStyle = 'rgba(20,8,4,0.35)'; NP.ell(x, cx + 18, cy + 22, 170, 160); x.fill();
    NP.ell(x, cx, cy, 165, 158); x.fillStyle = NP.rgr(x, cx - 50, cy - 50, 10, cx, cy, 170, [[0, '#8a5a34'], [1, '#3a2010']]); x.fill();
    NP.ell(x, cx, cy, 142, 136); x.fillStyle = NP.rgr(x, cx - 40, cy - 40, 10, cx, cy, 145, [[0, '#ffffff'], [0.8, '#f1ebdc'], [1, '#d8ccb0']]); x.fill();
    NP.ell(x, cx, cy, 100, 94); x.fillStyle = 'rgba(200,190,170,0.35)'; x.fill();
    // egg basket
    const ex = 990, ey = 1880;
    x.fillStyle = 'rgba(20,8,4,0.35)'; NP.ell(x, ex + 16, ey + 18, 175, 165); x.fill();
    NP.ell(x, ex, ey, 170, 160); x.fillStyle = NP.rgr(x, ex - 40, ey - 40, 10, ex, ey, 170, [[0, '#e0b878'], [1, '#8a6232']]); x.fill();
    x.strokeStyle = 'rgba(90,60,25,0.5)'; x.lineWidth = 3; for (let i = 0; i < 9; i++) { NP.ell(x, ex, ey, 30 + i * 16, 28 + i * 15); x.stroke(); }
    for (const [dx, dy, r] of [[-40, -30, 0.3], [50, 20, -0.4], [-10, 60, 1.2]]) P.egg(x, ex + dx, ey + dy, 1.15, r, {});
    // sugar dish
    const sx = 1060, sy = 1180;
    x.fillStyle = 'rgba(20,8,4,0.3)'; NP.ell(x, sx + 12, sy + 14, 110, 104); x.fill();
    NP.ell(x, sx, sy, 106, 100); x.fillStyle = NP.rgr(x, sx - 30, sy - 30, 4, sx, sy, 110, [[0, '#ffffff'], [1, '#b9c0cc']]); x.fill();
    NP.ell(x, sx, sy, 80, 76); x.fillStyle = '#fbf8f0'; x.fill();
    const r = rng(9); for (let i = 0; i < 160; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * 76; x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,1)' : 'rgba(180,180,190,0.6)'; x.fillRect(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.95, 3, 3); }
  });
}
const SUGAR = (() => { const r = rng(61), a = []; for (let i = 0; i < 70; i++) { const ang = r() * TAU, rr = Math.sqrt(r()) * 0.22; a.push([0.12 + Math.cos(ang) * rr, 0.12 + Math.sin(ang) * rr, r()]); } return a; })();
function s3Contents(T) {
  const flour = ease.out(iv(S3.FLOUR[0] + 0.05, S3.FLOUR[1] + 0.05, T)), milk = ease.out(iv(S3.MILK[0] + 0.05, S3.MILK[1] + 0.3, T));
  const y1 = ease.out(iv(7.7, 7.82, T)), y2 = ease.out(iv(8.1, 8.22, T)), sug = iv(S3.SUGAR, S3.SUGAR + 0.25, T), jui = ease.out(iv(S3.JUICE + 0.04, S3.JUICE + 0.45, T));
  const m = ease.inOut(iv(S3.WHISK[0] + 0.05, S3.WHISK[1] - 0.1, T));
  const spin = Math.max(0, T - S3.WHISK[0]) * 2.6 * TAU;
  return (ctx, cx, cy, rs) => {
    // bowl floor glaze
    ctx.fillStyle = NP.rgr(ctx, cx - rs * 0.3, cy - rs * 0.3, 10, cx, cy, rs, [[0, '#ffffff'], [1, '#d9dce2']]); ctx.fillRect(cx - rs, cy - rs, rs * 2, rs * 2);
    // base liquid: cream milk → pandan batter
    if (milk > 0) {
      const lx = lerp(cx + rs * 0.3, cx, milk), ly = lerp(cy - rs * 0.05, cy, milk), lr = rs * (0.25 + 0.8 * milk);
      const c0 = NP.mixc('#fffaf0', '#d8f0a0', m), c1 = NP.mixc('#f1e8d2', P.BATTER.M, m), c2 = NP.mixc('#cdbf9c', P.BATTER.D, m);
      NP.ell(ctx, lx, ly, lr, lr); ctx.fillStyle = NP.rgr(ctx, lx - lr * 0.3, ly - lr * 0.3, 5, lx, ly, lr, [[0, c0], [0.6, c1], [1, c2]]); ctx.fill();
    }
    ctx.save(); ctx.translate(cx, cy);
    // flour mound (sinks into the milk)
    if (flour > 0) {
      const fr = rs * 0.5 * flour * (1 - 0.35 * milk), fa = 1 - m;
      if (fa > 0) {
        ctx.save(); ctx.globalAlpha = fa; ctx.rotate(spin * 0.9);
        const fx = -rs * 0.12, fy = -rs * 0.1;
        ctx.fillStyle = `rgba(120,100,70,${0.25 * (1 - milk)})`; NP.ell(ctx, fx + fr * 0.15, fy + fr * 0.2, fr * 1.05, fr); ctx.fill();
        if (m > 0.02) { ctx.strokeStyle = 'rgba(255,255,250,0.85)'; ctx.lineWidth = fr * 0.5 * (1 - m); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, Math.hypot(fx, fy), Math.atan2(fy, fx) - m * 3, Math.atan2(fy, fx)); ctx.stroke(); }
        NP.ell(ctx, fx, fy, fr * (1 - m * 0.6), fr * 0.95 * (1 - m * 0.6));
        ctx.fillStyle = NP.rgr(ctx, fx - fr * 0.35, fy - fr * 0.35, 2, fx, fy, fr, [[0, '#ffffff'], [0.6, '#f4f0e8'], [0.9, '#ddd5c6'], [1, 'rgba(220,212,196,0.6)']]); ctx.fill();
        const r = rng(3); for (let i = 0; i < 60; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * fr * 0.9; ctx.fillStyle = r() < 0.5 ? 'rgba(200,190,175,0.5)' : 'rgba(255,255,255,0.9)'; ctx.fillRect(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr, 2.5, 2.5); }
        ctx.restore();
      }
    }
    // green juice pool (swirls in)
    if (jui > 0 && m < 1) {
      ctx.save(); ctx.globalAlpha = 1 - m; ctx.rotate(spin * 0.7);
      const jx = -rs * 0.28, jy = rs * 0.24, jr = rs * 0.32 * jui;
      if (m > 0.02) { ctx.strokeStyle = P.JUICE.M; ctx.lineCap = 'round'; ctx.lineWidth = jr * (1 - m) + 6; ctx.beginPath(); ctx.arc(0, 0, Math.hypot(jx, jy), Math.atan2(jy, jx) - m * 4.5, Math.atan2(jy, jx)); ctx.stroke(); }
      ctx.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, rr = jr * (1 + 0.12 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7)); i ? ctx.lineTo(jx + Math.cos(a) * rr, jy + Math.sin(a) * rr) : ctx.moveTo(jx + Math.cos(a) * rr, jy + Math.sin(a) * rr); } ctx.closePath();
      ctx.fillStyle = NP.rgr(ctx, jx - jr * 0.3, jy - jr * 0.3, 2, jx, jy, jr * 1.1, [[0, P.JUICE.L], [0.5, P.JUICE.M], [1, 'rgba(30,120,40,0.85)']]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.45)'; NP.ell(ctx, jx - jr * 0.35, jy - jr * 0.4, jr * 0.3, jr * 0.08, -0.4); ctx.fill();
      ctx.restore();
    }
    // yolks (with egg white halo)
    for (const [k, ux, uy, sd] of [[y1, 0.22, -0.2, 1], [y2, 0.3, 0.12, 2]]) {
      if (k <= 0 || m >= 1) continue;
      ctx.save(); ctx.globalAlpha = 1 - m; ctx.rotate(spin);
      const ex = ux * rs, ey = uy * rs, yr = 34 * k;
      if (m > 0.02) { ctx.strokeStyle = '#f2a21c'; ctx.lineCap = 'round'; ctx.lineWidth = yr * (1 - m) + 3; ctx.beginPath(); ctx.arc(0, 0, Math.hypot(ex, ey), Math.atan2(ey, ex) - m * 3.5, Math.atan2(ey, ex)); ctx.stroke(); }
      ctx.beginPath(); for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU, rr = yr * 2.1 * (1 + 0.15 * Math.sin(a * 3 + sd)); i ? ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr) : ctx.moveTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); } ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,245,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      NP.ell(ctx, ex, ey, yr, yr); ctx.fillStyle = NP.rgr(ctx, ex - yr * 0.35, ey - yr * 0.35, 1, ex, ey, yr, [[0, '#ffd36a'], [0.55, '#f5a21a'], [1, '#d4740c']]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; NP.ell(ctx, ex - yr * 0.35, ey - yr * 0.38, yr * 0.28, yr * 0.16, -0.6); ctx.fill();
      ctx.restore();
    }
    // sugar crystals
    if (sug > 0 && m < 1) {
      ctx.save(); ctx.globalAlpha = 1 - m; ctx.rotate(spin * 0.8);
      for (const [u, v, k] of SUGAR) { if (k > sug) continue; const px = u * rs, py = v * rs; ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(px - 2, py - 2, 4, 4); ctx.fillStyle = 'rgba(160,160,170,0.5)'; ctx.fillRect(px, py + 1, 3, 2); }
      ctx.restore();
    }
    // whisk streaks + foam when mixing
    if (m > 0) {
      ctx.save(); ctx.rotate(spin * 0.6);
      ctx.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const rr = rs * (0.15 + i * 0.09), a0 = i * 1.7;
        ctx.strokeStyle = i % 2 ? `rgba(240,255,200,${0.35 * Math.sin(m * PI) + 0.12 * m})` : `rgba(70,120,40,${0.25 * Math.sin(m * PI) + 0.1 * m})`;
        ctx.lineWidth = 5 + (i % 3) * 3; ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 2.2 + m * 1.5); ctx.stroke();
      }
      const r = rng(8); for (let i = 0; i < 80; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * rs * 0.9, br = 2 + r() * 5; ctx.globalAlpha = m * (0.4 + r() * 0.5); ctx.fillStyle = 'rgba(245,255,225,1)'; NP.ell(ctx, Math.cos(a) * rr, Math.sin(a) * rr, br, br); ctx.fill(); ctx.fillStyle = 'rgba(80,130,40,0.5)'; NP.ell(ctx, Math.cos(a) * rr + br * 0.3, Math.sin(a) * rr + br * 0.3, br * 0.5, br * 0.5); ctx.fill(); }
      ctx.restore();
    }
    // gloss on the liquid
    if (milk > 0) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5 * milk; ctx.fillStyle = 'rgba(255,255,240,0.7)'; NP.ell(ctx, -rs * 0.38, -rs * 0.42, rs * 0.3, rs * 0.07, -0.6); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  };
}
function s3(ctx, lt, p, T) {
  const z = lerp(1.0, 1.2, ease.inOut(p)), rot = lerp(-0.07, 0.1, ease.inOut(p));
  const [sx, sy] = shakeXY(T, S3.EGGS, 4, 0.2);
  L.cam(ctx, 540 + sx, 1150 + sy, z, rot, () => {
    ctx.drawImage(s3Table(), -360, -390);
    L.glow(ctx, 540, 1150, 900, 'rgba(255,190,110,1)', 0.18);
    const fill = 0.2 + 0.42 * ease.out(iv(S3.MILK[0], S3.MILK[1] + 0.3, T)) + 0.06 * iv(7.7, 8.25, T) + 0.06 * iv(S3.JUICE, S3.JUICE + 0.4, T) + 0.06 * iv(9.0, 10.0, T);
    const br = P.bowl(ctx, BW.x, BW.y, BW.s, { ryr: 1, fill, liq: 'batter', t: T, contents: s3Contents(T) });
    const R = 420, sc = BW.s;
    // --- sieve (flour) from the upper left
    const sIn = ease.out(iv(5.8, 6.08, T)), sOut = ease.in(iv(6.62, 6.9, T));
    if (sIn > 0 && sOut < 1) {
      const tap = T > S3.FLOUR[0] && T < S3.FLOUR[1] ? Math.sin(T * 70) * 7 : 0;
      const sxp = lerp(-300, 380, sIn) - sOut * 700 + tap, syp = lerp(620, 900, sIn) - sOut * 400;
      // falling flour streaks converge toward the mound
      if (T > S3.FLOUR[0] - 0.05 && T < S3.FLOUR[1] + 0.12) {
        const r = rng(Math.floor(T * 30));
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 60; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * 200, px = sxp + Math.cos(a) * rr, py = syp + Math.sin(a) * rr, u = r(); const tx = lerp(px, BW.x - 50, u * 0.6), ty = lerp(py, BW.y - 40, u * 0.6); ctx.fillStyle = `rgba(255,255,250,${0.5 + r() * 0.4})`; ctx.fillRect(tx, ty, 2.5 + r() * 2, 2.5 + r() * 2); }
        L.glow(ctx, BW.x - 60, BW.y - 50, 260, 'rgba(255,255,250,1)', 0.25);
        ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = 0.95; P.sieve(ctx, sxp, syp, 1.08, { flour: 1 - iv(S3.FLOUR[0], S3.FLOUR[1], T) * 0.85, rot: 0.3 }); ctx.restore();
      const w = [sxp - 220, syp - 220]; P.armIn(ctx, w[0], w[1], Math.atan2(w[1] + 400, w[0] + 600), 1.25);
      P.fist(ctx, sxp - 250, syp - 160, 1.25, -2.3, { flip: true });
    }
    // --- coconut-shell cup of coconut milk from the right
    const cIn = ease.out(iv(6.6, 6.88, T)), cOut = ease.in(iv(7.42, 7.7, T));
    if (cIn > 0 && cOut < 1) {
      const tilt = ease.inOut(iv(6.85, 7.0, T)) * (1 - ease.inOut(iv(7.35, 7.5, T)));
      const cx = lerp(1350, 850, cIn) + cOut * 600, cy = 1040 - cOut * 120;
      if (T > S3.MILK[0] - 0.02 && T < S3.MILK[1] + 0.05) {
        const k = iv(S3.MILK[0] - 0.02, S3.MILK[0] + 0.08, T), tail = iv(S3.MILK[1] - 0.05, S3.MILK[1] + 0.05, T);
        const lip = [cx - 125, cy - 4], land = [BW.x + 110, BW.y - 10];
        P.ribbon(ctx, [lip, [lerp(lip[0], land[0], 0.5 * k), lerp(lip[1], land[1], 0.5 * k) + 10], [lerp(lip[0], land[0], k), lerp(lip[1], land[1], k)]], 50 * (1 - tail * 0.8), { t: T, col: 'milk', shadow: [16, 22] });
        L.sparkle(ctx, land[0], land[1], 30 + 10 * Math.sin(T * 30), 0.6 * k * (1 - tail));
      }
      P.coconutCup(ctx, cx, cy, 1.3 + tilt * 0.06, 0.05 - tilt * 0.25, { fill: 1 - iv(S3.MILK[0], S3.MILK[1], T) });
      P.fist(ctx, cx + 400 * 1.3 * 0.9, cy + 10, 1.25, 0.0, {});
    }
    // --- eggs: struck on the rim, opened over the bowl
    S3.EGGS.forEach((tc, i) => {
      const k0 = iv(tc - 0.28, tc, T), op = ease.out(iv(tc + 0.04, tc + 0.16, T)), out = ease.in(iv(tc + 0.2, tc + 0.38, T));
      if (k0 <= 0 || out >= 1) return;
      const rim = [BW.x + (i ? 120 : -60), BW.y - R + 20], over = [BW.x + (i ? 130 : 90), BW.y + (i ? 40 : -90)];
      let ex, ey;
      if (T < tc) { ex = lerp(rim[0] + 40, rim[0], ease.in(k0)); ey = lerp(rim[1] - 500, rim[1] - 30, ease.in(k0)); }
      else { const u = ease.inOut(iv(tc, tc + 0.1, T)); ex = lerp(rim[0], over[0], u); ey = lerp(rim[1] - 30, over[1] - 40, u) - out * 700; }
      const hk = hitAt(T, tc, 0.18);
      if (hk > 0) { L.flakes(ctx, T, tc, 70 + i, 8, rim[0], rim[1] - 10, { colors: ['#f2dcc0', '#fff5e8', '#d9b48a'], speed: 300, size: 5, life: 0.4, g: 600, spread: 3 }); L.sparkle(ctx, rim[0], rim[1] - 20, 50 * hk, hk); }
      P.egg(ctx, ex, ey, 1.5, 0.15, { crack: T >= tc, open: op * 0.6 });
      const fw = P.fist(ctx, ex, ey - 40, 1.15, -PI / 2 - 0.1, {}).wrist; P.armIn(ctx, fw[0], fw[1], PI / 2 - 0.1, 1.15);
      P.fist(ctx, ex, ey - 40, 1.15, -PI / 2 - 0.1, {});
      // falling yolk under the opening shell
      if (op > 0.3 && T < tc + 0.17) { const yy = lerp(ey + 10, over[1], iv(tc + 0.06, tc + 0.16, T)); NP.ell(ctx, ex, yy, 30, 30); ctx.fillStyle = NP.rgr(ctx, ex - 10, yy - 10, 1, ex, yy, 30, [[0, '#ffd36a'], [1, '#e08a10']]); ctx.fill(); }
    });
    // --- sugar spoon from the lower right
    const gIn = ease.out(iv(8.1, 8.33, T)), gOut = ease.in(iv(8.68, 8.92, T));
    if (gIn > 0 && gOut < 1) {
      const tip = ease.inOut(iv(S3.SUGAR - 0.06, S3.SUGAR + 0.08, T));
      const gx = lerp(1400, 790, gIn) + gOut * 700, gy = lerp(1500, 1290, gIn) + gOut * 300;
      if (T > S3.SUGAR - 0.02 && T < S3.SUGAR + 0.3) { const r = rng(Math.floor(T * 30)); ctx.save(); ctx.globalCompositeOperation = 'screen'; for (let i = 0; i < 30; i++) { const u = r(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(lerp(gx - 40, BW.x + 60, u) + (r() - 0.5) * 50, lerp(gy - 10, BW.y + 60, u) + (r() - 0.5) * 50, 3, 3); } ctx.restore(); BX.sparkles(ctx, T, BW.x + 60, BW.y + 60, 0.7, { n: 5, seed: 6, r: 90, alpha: 0.8 }); }
      P.sugarSpoon(ctx, gx, gy, 1.3, 0.6 + tip * 0.5, { fill: 1 - iv(S3.SUGAR, S3.SUGAR + 0.2, T) });
      { const ga = 0.6 + tip * 0.5, hx = gx + Math.cos(ga) * 360 * 1.3, hy = gy + Math.sin(ga) * 360 * 1.3; const fw = P.fist(ctx, hx, hy, 1.2, ga + PI / 2, {}).wrist; P.armIn(ctx, fw[0], fw[1], Math.atan2(fw[1] - 2400, fw[0] - 1500), 1.2); P.fist(ctx, hx, hy, 1.2, ga + PI / 2, {}); }
    }
    // --- pandan juice from the small bowl (upper left)
    const jIn = ease.out(iv(8.42, 8.66, T)), jOut = ease.in(iv(9.0, 9.22, T));
    if (jIn > 0 && jOut < 1) {
      const tl = ease.inOut(iv(8.6, 8.72, T));
      const jx = lerp(-300, 250, jIn) - jOut * 600, jy = lerp(700, 880, jIn) - jOut * 200;
      if (T > S3.JUICE - 0.02 && T < S3.JUICE + 0.35) {
        const k = iv(S3.JUICE - 0.02, S3.JUICE + 0.06, T), tail = iv(S3.JUICE + 0.22, S3.JUICE + 0.35, T), lip = [jx + 150, jy + 70], land = [BW.x - 120, BW.y + 100];
        P.ribbon(ctx, [lip, [lerp(lip[0], land[0], 0.5 * k) + 10, lerp(lip[1], land[1], 0.5 * k)], [lerp(lip[0], land[0], k), lerp(lip[1], land[1], k)]], 38 * (1 - tail * 0.8), { t: T, col: 'juice', shadow: [16, 22] });
      }
      L.at(ctx, jx, jy, 0.6 + tl * 0.35, 1, 1, () => P.bowl(ctx, 0, 0, 0.9, { ryr: lerp(0.95, 0.7, tl), fill: 0.8 * (1 - iv(S3.JUICE, S3.JUICE + 0.3, T)), liq: 'juice', t: T }));
    }
    // --- whisk circling
    const wIn = ease.out(iv(8.85, 9.02, T)), wOut = ease.in(iv(10.2, 10.38, T));
    if (wIn > 0 && wOut < 1) {
      const a = (T - 9.0) * 2.6 * TAU, rr = R * 0.42 * (0.6 + 0.4 * Math.sin(T * 3));
      const tx = BW.x + Math.cos(a) * rr * wIn + (1 - wIn) * 500 + wOut * 500, ty = BW.y + Math.sin(a) * rr * wIn + (1 - wIn) * 500 + wOut * 600;
      const hx = BW.x + 900, hy = BW.y + 1100, ang = Math.atan2(hy - ty, hx - tx);
      // drips flung off the whisk
      P.whiskTop(ctx, tx, ty, 1.25, ang, { spin: a * 0.5 });
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(230,255,190,0.35)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(BW.x, BW.y, rr, a - 0.9, a - 0.05); ctx.stroke(); ctx.restore();
    }
  });
  // screen-space depth: blurred leaf in the corner, warm rays, dust
  fgDraw(ctx, P.fgLeaves('R', 18), 120, 220);
  lightPass(ctx, T, { rays: 0.13, seed: 9 });
}

// ============================================================================ s4 · gag 1: sniff, then bite the pandan leaf
const S4 = { ENTER: 10.6, NOSE: 11.4, SNIFF: 11.7, BITE: 12.6, SLAP: 13.0 };
const FOGFN = (t) => (ctx, cx) => {
  ctx.fillStyle = 'rgba(245,248,250,0.92)'; ctx.fillRect(cx - 60, -40, 120, 80);
  ctx.strokeStyle = 'rgba(200,210,220,0.9)'; ctx.lineWidth = 6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 40 + i * 26, 20); ctx.quadraticCurveTo(cx - 30 + i * 26 + Math.sin(t * 3 + i) * 6, 0, cx - 44 + i * 26, -20); ctx.stroke(); }
};
function s4(ctx, lt, p, T) {
  const z0 = lerp(1.12, 1.08, ease.out(iv(10.385, 10.9, T))), zPush = ease.inOut(iv(11.25, 11.9, T)) * 0.1 - ease.inOut(iv(12.85, 13.3, T)) * 0.04;
  const z = z0 + zPush, wob = [L.wobble(T * 0.9, 1) * 6, L.wobble(T * 0.8, 3) * 5];
  const [sx, sy] = shakeXY(T, [S4.BITE, S4.SLAP], 8, 0.25);
  cam(ctx, lerp(540, 575, zPush * 5) + wob[0] + sx, 1180 + wob[1] + sy, z, L.wobble(T * 0.5, 7) * 0.006, () => {
    ctx.drawImage(P.stallPlate(9), 0, 0);
    L.glow(ctx, 760, 640, 700, 'rgba(255,200,120,1)', 0.3);
    const M0 = ctx.getTransform();
    // ---- tourist (enters from the right)
    const walk = ease.out(iv(10.42, 10.95, T)), tx = lerp(1420, 815, walk), bob = walk < 1 ? -Math.abs(Math.sin(T * 13)) * 14 * (1 - walk) : 0;
    const lean = -0.05 * ease.inOut(iv(11.3, 11.65, T)) - 0.05 * ease.inOut(iv(12.35, 12.58, T)) + 0.07 * ease.inOut(iv(12.62, 12.9, T));
    let tPose = 'sit', tExpr, tFace, tLook = -0.35, pointAt = null;
    if (T < 10.85) { tExpr = 'smile'; }
    else if (T < 11.35) { tPose = 'pointTry'; pointAt = [560, 1600]; }
    else if (T < S4.SNIFF) { tFace = { mouth: 'smile', lookX: -0.7, lookY: 0.4, brow: 0.6 }; }
    else if (T < 12.35) { tPose = 'sniff'; }
    else if (T < S4.BITE) { tFace = { mouth: 'o', mOpen: 1.2, open: 0.5, brow: 0.9, lookX: -0.6, lookY: 0.5 }; }
    else if (T < 13.25) { tExpr = 'crunch'; }
    else { tExpr = 'chew'; }
    let tr = null;
    L.at(ctx, tx, 2000 + bob, lean, 1, 1, () => {
      tr = BX.tourist(ctx, 0, 0, 2.5, { stand: true, pose: tPose, pointAt: pointAt && [pointAt[0] - tx, pointAt[1] - 2000], t: T, expr: tExpr, look: tLook, face: tFace });
    });
    // map tourist anchors (drawn inside at()) to cam-local
    const rotP = (q) => { const c = Math.cos(lean), s = Math.sin(lean); return [tx + q[0] * c - q[1] * s, 2000 + bob + q[0] * s + q[1] * c]; };
    const head = rotP(tr.head), fs = tr.face.s, nose = [head[0] - 25 * fs, head[1] + 55 * fs], mouth = rotP(tr.mouth);
    // ---- Cô Út with the leaf
    const lift = ease.inOut(iv(10.95, S4.NOSE, T)), back = ease.inOut(iv(12.68, 12.95, T));
    const tipTarget = [nose[0] - 6, nose[1] + 10];
    const hand = [lerp(420, tipTarget[0] - 185, lift) - back * 70, lerp(1560, tipTarget[1] + 40, lift) + back * 80];
    const bitten = T >= S4.BITE;
    const slap = ease.in(iv(12.88, S4.SLAP, T)), slapHold = T >= S4.SLAP;
    const cuX = 345, cuY = 2000, cuS = 2.45;
    const leafPts = () => {
      const tip = bitten ? [lerp(tipTarget[0], hand[0] + 150, back), lerp(tipTarget[1], hand[1] - 10, back)] : [lerp(hand[0] + 40, tipTarget[0], lift) + (T < S4.BITE && T > 12.3 ? 6 : 0), lerp(hand[1] - 120, tipTarget[1], lift)];
      return [[hand[0] - 70, hand[1] + 230], [hand[0] - 14, hand[1] + 60], [hand[0] + 4, hand[1] - 6], [lerp(hand[0], tip[0], 0.5), lerp(hand[1], tip[1], 0.5) - 34], tip];
    };
    NP.coUt(ctx, cuX, cuY, cuS, {
      pose: 'stand', palette: P.PURPLE, t: T, expr: slapHold ? 'calm' : T > 11.7 && T < 12.55 ? 'smile' : T > 12.6 ? 'talk' : 'smile',
      tilt: slapHold ? 0.1 + 0.05 * Math.sin(T * 16) * Math.exp(-(T - S4.SLAP) * 3) : 0, turn: 0.4,
      reach: [(hand[0] - cuX) / cuS, (hand[1] - cuY) / cuS],
      poseFn: (Pp) => {
        const r = {
          kR: 'grip', rR: -0.9, flipR: true,
          pre: () => { ctx.save(); ctx.setTransform(M0); P.pandanLeaf(ctx, leafPts(), 36, { bite: bitten ? 0.22 : 0, seed: 2 }); ctx.restore(); },
        };
        if (slap > 0) {
          const fy = -342 + Pp.B, rest = [-60, Pp.SY + 104], tgt = [-30, fy + 16];
          const hL = [lerp(rest[0], tgt[0], slap), lerp(rest[1], tgt[1], slap)], rL = lerp(PI / 2, -1.0, slap);
          r.hL = hL; r.kL = 'flat'; r.rL = rL; r.flipL = false;
          r.front = () => {
            const el = NP.ikPick(Pp.shL[0], Pp.shL[1], hL[0], hL[1], 66, 62, -1);
            NP.cArm(ctx, lerp(Pp.shL[0], el[0], 0.6), lerp(Pp.shL[1], el[1], 0.6), el[0], el[1], hL[0], hL[1], { skin: NP.SKIN_U, wu: [18, 16], wf: [15, 12], sleeve: NP.weave(ctx, 24, P.PURPLE.aoba), sleeveTo: 1.84, cuff: P.PURPLE.aobaD });
            NP.cHand(ctx, hL[0], hL[1], 0.36, rL, { kind: 'flat', skin: NP.SKIN_U, flip: false });
          };
        }
        return r;
      },
    });
    // ---- sniff: scent wisps curling into his nose
    const sn = iv(11.55, 11.8, T) * (1 - iv(12.3, 12.5, T));
    if (sn > 0) {
      const tip = leafPts()[4];
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const ph = (T * 1.4 + i * 0.25) % 1;
        ctx.strokeStyle = `rgba(210,255,170,${0.6 * sn * Math.sin(ph * PI)})`; ctx.lineWidth = 7 - i;
        ctx.beginPath(); for (let k = 0; k <= 14; k++) { const u = k / 14, px = lerp(tip[0] - 60 + i * 12, nose[0], u * ph * 1.6), py = lerp(tip[1] + 30, nose[1], u * ph * 1.6) + Math.sin(u * 9 + T * 7 + i) * 14 * (1 - u); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
      }
      ctx.restore();
      BX.sparkles(ctx, T, nose[0] + 30, nose[1] - 60, 0.7, { n: 4, seed: 3, r: 90, alpha: 0.7 * sn });
    }
    // ---- bite: leaf bits + the stub hanging from his mouth while chewing
    if (bitten) {
      L.flakes(ctx, T, S4.BITE, 77, 16, mouth[0] - 20, mouth[1], { colors: [P.PAN.L, P.PAN.M, P.PAN.D], speed: 420, size: 7, life: 0.7, g: 1500, spread: 2.4 });
      const ch = Math.sin(T * 16) * 4, m0 = [mouth[0] - 8, mouth[1] + 4];
      P.pandanLeaf(ctx, [m0, [m0[0] - 26, m0[1] + 6 + ch], [m0[0] - 56, m0[1] + 22 + ch * 1.5]], 18, { seed: 5 });
      const hk = hitAt(T, S4.BITE, 0.3);
      if (hk > 0) { ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${hk})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = -PI * 0.9 + i * 0.35; ctx.beginPath(); ctx.moveTo(mouth[0] + Math.cos(a) * 70, mouth[1] + Math.sin(a) * 70); ctx.lineTo(mouth[0] + Math.cos(a) * (100 + 30 * (1 - hk)), mouth[1] + Math.sin(a) * (100 + 30 * (1 - hk))); ctx.stroke(); } ctx.restore(); }
    }
    // ---- slap impact on Cô Út's forehead
    const sk = hitAt(T, S4.SLAP, 0.35);
    if (sk > 0) {
      const fh = [cuX + 20, cuY - 455 * cuS / 1.05];
      ctx.save(); ctx.strokeStyle = `rgba(255,250,220,${sk})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) { const a = -PI * 0.95 + i * 0.32; ctx.beginPath(); ctx.moveTo(fh[0] + Math.cos(a) * 80, fh[1] + Math.sin(a) * 80); ctx.lineTo(fh[0] + Math.cos(a) * (110 + 40 * (1 - sk)), fh[1] + Math.sin(a) * (110 + 40 * (1 - sk))); ctx.stroke(); }
      ctx.restore();
    }
    // ---- table in front (covers the legs) with the green batter, mortar, leaves
    ctx.drawImage(P.table3q(1500), 0, 0);
    P.bowl(ctx, 560, 1640, 1.15, { ryr: 0.42, fill: 0.85, liq: 'batter', t: T });
    P.mortar(ctx, 160, 1730, 0.7, { mash: 1, leaves: 1 });
    P.pandanBundle(ctx, 905, 1800, 0.9, -0.12);
  });
  fgDraw(ctx, P.fgLeaves('R', 14), 140, 260);
  lightPass(ctx, T, { rays: 0.12, seed: 11 });
}

// ============================================================================ s5 · oil the mould, pour the batter
const S5 = { BRUSH: [14.0, 14.7], POUR: [14.9, 16.4], TAP: 16.8 };
function s5(ctx, lt, p, T) {
  const MX = 540, MY = 1290, MS = 1.38, ryr = 0.5, c = Math.sqrt(1 - ryr * ryr);
  const land = [MX + 40, MY + 50];
  const macro = ease.inOut(iv(15.35, 16.0, T)) * (1 - ease.inOut(iv(16.3, 16.62, T)));
  const z = lerp(lerp(1.02, 1.08, iv(13.846, 15.3, T)), 1.9, macro);
  const [sx, sy] = shakeXY(T, [S5.TAP], 10, 0.3);
  cam(ctx, lerp(540, land[0], macro) + sx, lerp(1120, land[1], macro) + sy, z, 0, () => {
    ctx.drawImage(P.stallPlate(13), 0, 0);
    ctx.drawImage(P.table3q(820), 0, 0);
    L.glow(ctx, 540, 1200, 700, 'rgba(255,190,110,1)', 0.22);
    // oil dish
    P.bowl(ctx, 905, 960, 0.5, { ryr: 0.42, fill: 0.6, liq: 'oil', t: T });
    P.pandanBundle(ctx, 150, 940, 0.6, 0.05);
    // mould (hops on the tap)
    const hop = Math.sin(clamp((T - 16.6) / 0.2) * PI) * 26 * (T < S5.TAP ? 1 : 0);
    const fill = 0.82 * ease.inOut(iv(S5.POUR[0] + 0.06, S5.POUR[1] + 0.05, T));
    const ripple = [[S5.TAP, 0, 0, 0.8], [S5.TAP + 0.12, 0.1, 0.05, 0.5]];
    const pourOn = T > S5.POUR[0] && T < S5.POUR[1] + 0.1;
    const mr = P.mould(ctx, MX, MY - hop, MS, {
      ryr, oil: ease.inOut(iv(S5.BRUSH[0], S5.BRUSH[1], T)), fill, t: T, ripple,
      surface: (x, cx, cy, rs, ry) => {
        if (!pourOn && T < S5.TAP) return;
        const lx = (land[0] - MX) / MS, ly = cy + 12 + (16.6 > T ? 0 : 0);
        if (pourOn) { // folding ribbon pile at the landing point
          x.save(); x.lineCap = 'round';
          for (let i = 0; i < 5; i++) {
            const a0 = T * 5 + i * 1.3, rr = 30 + i * 22;
            x.strokeStyle = i % 2 ? 'rgba(225,250,170,0.7)' : 'rgba(80,130,40,0.4)'; x.lineWidth = 16 - i * 2;
            x.beginPath(); x.ellipse(lx, ly, rr, rr * ry, 0, a0, a0 + 2.4); x.stroke();
          }
          x.restore();
        }
        // bubbles rising + popping after the tap
        const a = T - S5.TAP;
        if (a > 0 && a < 0.5) { const r = rng(5); for (let i = 0; i < 16; i++) { const px = (r() - 0.5) * rs * 1.6, py = cy + (r() - 0.5) * rs * ry * 1.6, br = (3 + r() * 8) * (1 - a / 0.5); x.strokeStyle = 'rgba(245,255,220,0.8)'; x.lineWidth = 2; NP.ell(x, px, py, br, br * ry); x.stroke(); } }
      },
    });
    // --- banana-leaf brush (dip in oil, sweep inside the mould)
    const bIn = ease.out(iv(13.846, 14.0, T)), bOut = ease.in(iv(14.72, 14.92, T));
    if (bIn > 0 && bOut < 1) {
      let bx, by;
      if (T < S5.BRUSH[0]) { bx = lerp(1000, 900, bIn); by = 960 - 30 * Math.sin(bIn * PI); }
      else {
        const a = PI * 1.05 + ease.inOut(iv(S5.BRUSH[0], S5.BRUSH[1], T)) * TAU * 1.05;
        bx = MX + Math.cos(a) * 300 * 0.82 * MS; by = MY + Math.sin(a) * 300 * 0.82 * ryr * MS + 70 * c * MS;
      }
      bx += bOut * 600; by -= bOut * 500;
      const rot = 0.45 + 0.12 * Math.sin(T * 14);
      const g = P.leafBrush(ctx, bx, by, 1.15, rot, { oil: 1 });
      const f = P.fist(ctx, g.grip[0], g.grip[1], 1.0, rot, {});
      P.armIn(ctx, f.wrist[0], f.wrist[1], Math.atan2(f.wrist[1] - 100, f.wrist[0] - 1500), 1.0);
      P.fist(ctx, g.grip[0], g.grip[1], 1.0, rot, {});
      if (T > S5.BRUSH[0]) BX.oilSparkle(ctx, T * 0.4, bx, by, 0.6, { n: 6, w: 120, h: 40, alpha: 0.8 });
    }
    // --- pour: tilted batter bowl from the upper left, thick glossy ribbon
    const pIn = ease.out(iv(14.62, 14.9, T)), pOut = ease.in(iv(16.38, 16.6, T));
    if (pIn > 0 && pOut < 1) {
      const tl = ease.inOut(iv(14.82, 15.0, T)) * (1 - 0.5 * ease.inOut(iv(16.25, 16.42, T)));
      const bx = lerp(-300, 150, pIn) - pOut * 500, by = lerp(480, 640, pIn) - pOut * 300, rot = 0.25 + tl * 0.55;
      const lipL = [bx + Math.cos(rot) * 200 * 1.25, by + Math.sin(rot) * 200 * 1.25];
      if (pourOn) {
        const k = iv(S5.POUR[0], S5.POUR[0] + 0.15, T), tail = iv(S5.POUR[1] - 0.1, S5.POUR[1] + 0.08, T);
        const wv = Math.sin(T * 7) * 10, end = [lerp(lipL[0], land[0], k), lerp(lipL[1], (mr.surf ? mr.surf[1] : MY + 150 * MS * 0.87) + 12 * MS, k)];
        const top = [lerp(lipL[0], end[0], tail), lerp(lipL[1], end[1], tail)];
        P.ribbon(ctx, [top, [lerp(top[0], end[0], 0.35) + 40 + wv, lerp(top[1], end[1], 0.3)], [lerp(top[0], end[0], 0.7) + 10 - wv * 0.5, lerp(top[1], end[1], 0.7)], end], 54 * (1 - tail * 0.6), { t: T, col: 'batter', taper: true });
        L.sparkle(ctx, end[0] - 10, end[1] - 4, 26 + 8 * Math.sin(T * 25), 0.6 * (1 - tail));
      }
      L.at(ctx, bx, by, rot, 1, 1, () => P.bowl(ctx, 0, 0, 1.25, { ryr: 0.45 + tl * 0.2, fill: 0.85 - 0.6 * iv(S5.POUR[0], S5.POUR[1], T), liq: 'batter', t: T }));
    }
    // --- tap: both hands on the rim, lift + drop
    const hIn = ease.out(iv(16.42, 16.6, T)), hOut = ease.in(iv(16.95, 17.15, T));
    if (hIn > 0 && hOut < 1) {
      for (const sg of [-1, 1]) {
        const gx = MX + sg * (300 * MS + 8) + sg * (1 - hIn + hOut) * 400, gy = MY - hop + 10 + (1 - hIn + hOut) * 200;
        const f = P.fist(ctx, gx, gy, 1.0, sg * 0.15, { flip: sg < 0 });
        P.armIn(ctx, f.wrist[0], f.wrist[1], Math.atan2(f.wrist[1] - 2100, f.wrist[0] - (MX + sg * 900)), 1.0);
        P.fist(ctx, gx, gy, 1.0, sg * 0.15, { flip: sg < 0 });
      }
    }
    const tk = hitAt(T, S5.TAP, 0.4);
    if (tk > 0) { BX.sparkles(ctx, T, MX, MY - 40, 1.0, { n: 6, seed: 8, r: 340, alpha: tk }); L.flakes(ctx, T, S5.TAP, 51, 10, MX, MY + 10, { colors: [P.BATTER.L, P.BATTER.M], speed: 300, size: 5, life: 0.4, g: 1200, spread: 2 }); }
  });
  fgDraw(ctx, P.fgLeaves('L', 18), -60, 160);
  lightPass(ctx, T, { rays: 0.14, seed: 13 });
}

// ============================================================================ s6 · clay oven, cutaway rise, lid lift, steam
const S6 = { LID: 17.6, POPS: [19.0, 19.4, 19.9, 20.3, 20.8, 21.3], DING: 22.0, LIFT: 22.6, FACE: 23.3, CUT0: 18.55, CUT1: 18.8, BACK0: 21.6, BACK1: 21.85 };
const OV = { x: 540, y: 1000, ryr: 0.42 }; // mould rim centre (final frame match point)
function s6Exterior(ctx, T, phase) {
  const late = phase === 'late';
  let z, cx, cy;
  if (!late) { const k = ease.inOut(iv(17.9, 18.8, T)); z = lerp(1.3, 1.22, ease.out(iv(17.31, 17.7, T))) + k * 0.3; cx = 540; cy = lerp(1060, 1120, k); }
  else { const k = 1 - ease.inOut(iv(23.4, 24.15, T)); z = 1 + 0.16 * k; cx = 540 + 30 * k; cy = 960 + 20 * k; }
  const [sx, sy] = shakeXY(T, [S6.LID, S6.LIFT], 9, 0.3);
  const c = Math.sqrt(1 - OV.ryr * OV.ryr);
  cam(ctx, cx + sx, cy + sy, z, 0, () => {
    ctx.drawImage(P.stallPlate(11), 0, 0);
    ctx.drawImage(P.table3q(1180), 0, 0);
    if (late) { ctx.fillStyle = 'rgba(255,140,60,0.12)'; ctx.fillRect(0, 0, W, H); }
    L.glow(ctx, 540, 1250, 800, 'rgba(255,120,40,1)', 0.25);
    // alarm clock beside the oven
    P.pandanBundle(ctx, 880, 1700, 0.85, -0.15);
    // brazier + mould sitting in its mouth
    const bY = OV.y + 95 * c;
    P.brazier(ctx, OV.x, bY, 1.0, { ryr: OV.ryr, t: T });
    ctx.save();
    ctx.beginPath(); ctx.rect(-200, -200, W + 400, bY + 200); ctx.ellipse(OV.x, bY + 4, 236, 236 * OV.ryr, 0, 0, TAU); ctx.clip();
    P.mould(ctx, OV.x, OV.y, 1.0, { ryr: OV.ryr, fill: late ? 1 : 0.8, t: T });
    if (late) P.cakeTop(ctx, OV.x, OV.y, 1.0, { ryr: OV.ryr });
    ctx.restore();
    // heat glow at the base of the mould
    L.glow(ctx, OV.x, bY + 30, 300, 'rgba(255,120,40,1)', 0.3);
    P.alarmClock(ctx, 215, 1640, 1.3, { t: T, ring: late ? clamp(hitAt(T, S6.DING, 0.7) * 1.4) : 0 });
    // lid
    if (!late) {
      const d = ease.in(iv(17.31, S6.LID, T)), b = hitAt(T, S6.LID, 0.25);
      const ly = OV.y - 6 - (1 - d) * 420 - Math.sin(b * PI) * 10;
      const lr = P.ovenLid(ctx, OV.x, ly, 1.0, { ryr: OV.ryr, t: T, coals: 1, tilt: (1 - d) * 0.06 });
      const hOut = ease.in(iv(17.66, 17.95, T));
      if (hOut < 1) { const hx = lr.handle[0] + hOut * 300, hy = lr.handle[1] + 40 - hOut * 500; const f = P.fist(ctx, hx, hy, 1.0, -PI / 2, {}); P.armIn(ctx, f.wrist[0], f.wrist[1], Math.atan2(f.wrist[1] + 500, f.wrist[0] - 1300), 1.0); P.fist(ctx, hx, hy, 1.0, -PI / 2, {}); }
      const k = hitAt(T, S6.LID, 0.6);
      if (k > 0) {
        for (let i = 0; i < 8; i++) { const a = PI * (0.05 + i * 0.13), px = OV.x + Math.cos(a) * 330, py = OV.y + Math.sin(a) * 330 * OV.ryr; L.glow(ctx, px + Math.cos(a) * 80 * (1 - k), py + 10, 70 + 60 * (1 - k), 'rgba(200,190,180,1)', 0.5 * k, 'source-over'); }
        L.flakes(ctx, T, S6.LID, 66, 22, OV.x, OV.y - 60, { colors: ['#ffd36a', '#ff9a34', '#fff0b0'], speed: 600, size: 4, life: 0.8, g: 400, spread: 2.6 });
      }
      NP.embers(ctx, T, 12, 14, OV.x - 220, OV.y - 220, 440, 200, { alpha: 0.9 });
    } else {
      // lid lifted at 22.6 by a hand, pulled up and away
      const g = ease.out(iv(22.3, 22.55, T)), up = ease.out(iv(S6.LIFT, S6.LIFT + 0.42, T));
      // steam burst from the freshly opened cake (behind the departing lid)
      const sk = iv(S6.LIFT + 0.03, S6.LIFT + 1.2, T);
      if (sk > 0) BX.steamEruption(ctx, T, OV.x, OV.y - 20, 0.9, sk, { seed: 7, sun: true, alpha: 0.85 * (1 - 0.55 * iv(23.6, 24.2, T)) });
      L.steam(ctx, T, 17, OV.x, OV.y - 40, 360, 700, 10, 0.3 * iv(S6.LIFT, S6.LIFT + 0.3, T));
      BX.sparkles(ctx, T, OV.x, OV.y - 40, 1.2, { n: 7, seed: 21, r: 260, alpha: iv(23.4, 23.8, T) });
      if (up < 1) {
        const lx = OV.x + up * 520, ly = OV.y - 6 - up * 760;
        const lr = P.ovenLid(ctx, lx, ly, 1.0, { ryr: OV.ryr, t: T, coals: 1, ash: 0.75, tilt: up * 0.35 });
        const hx = lerp(lr.handle[0] + 400, lr.handle[0], g), hy = lerp(lr.handle[1] - 500, lr.handle[1] + 40, g);
        const f = P.fist(ctx, hx, hy, 1.0, -PI / 2, {}); P.armIn(ctx, f.wrist[0], f.wrist[1], Math.atan2(f.wrist[1] + 500, f.wrist[0] - 1300), 1.0); P.fist(ctx, hx, hy, 1.0, -PI / 2, {});
      }
    }
  });
}
function s6Tourist(ctx, T) { // big face leaning in from the right, steam hits at 23.3
  const inK = ease.out(iv(22.82, 23.15, T)), outK = ease.in(iv(23.62, 24.0, T));
  if (inK <= 0 || outK >= 1) return;
  const x = lerp(1400, 880, inK) + outK * 560 + (T > S6.FACE ? Math.sin((T - S6.FACE) * 40) * 8 * Math.exp(-(T - S6.FACE) * 5) : 0);
  const y = 760 + outK * 60, hit = T >= S6.FACE, gd = ease.in(iv(S6.FACE - 0.05, S6.FACE + 0.06, T));
  const f = hit ? { mouth: 'o', mOpen: 0.6, brow: 1.1, glassesY: lerp(-178, 0, gd), glassesFn: gd > 0.9 ? FOGFN(T) : undefined, blush: 0.9, turn: -0.35, tilt: 0.12 }
    : { mouth: 'smile', open: 0.15, happyClosed: 0.6, brow: 0.6, turn: -0.4, lookX: -0.8, lookY: 0.6, tilt: -0.1, hairLift: 0.1 };
  NP.touristFace(ctx, x, y, 0.85, Object.assign({ expr: hit ? 'wow' : 'sniff', t: T }, f));
  if (hit) {
    const k = iv(S6.FACE - 0.1, S6.FACE + 0.6, T);
    for (let i = 0; i < 7; i++) { const u = (k + i * 0.13) % 1; L.glow(ctx, lerp(560, x - 40, u), lerp(860, y - 20, u) + Math.sin(i * 2 + T * 3) * 40, 120 + 80 * u, 'rgba(255,250,240,1)', 0.45 * Math.sin(u * PI) * (1 - outK)); }
  }
}
function s6Cut(ctx, T) {
  const k = ease.inOut(iv(18.7, 21.45, T)), cook = ease.inOut(iv(19.5, 21.55, T)), z = lerp(1.0, 1.08, ease.inOut(iv(18.55, 21.85, T)));
  ctx.fillStyle = NP.rgr(ctx, 540, 1000, 50, 540, 1000, 1300, [[0, '#3a1a10'], [1, '#0c0504']]); ctx.fillRect(0, 0, W, H);
  cam(ctx, 540, 1020, z, 0, () => {
    // time-lapse light sweep on the back wall
    const sw = (T - 18.6) * 0.5;
    L.glow(ctx, lerp(100, 980, sw % 1), 600, 600, 'rgba(255,170,90,1)', 0.12);
    P.cutaway(ctx, 540, 1060, 1.45, { t: T * 1.6, k, cook, T, pops: S6.POPS, ash: iv(19.5, 21.7, T) * 0.7 });
    L.steam(ctx, T, 33, 540, 1000, 600, 300, 7, 0.08 + 0.1 * cook);
  });
  lightPass(ctx, T, { rays: 0.06, seed: 15 });
}
function s6(ctx, lt, p, T) {
  // hard cuts hidden under a warm heat flash (one scene per frame keeps it < 0.3 s/frame)
  const CA = (S6.CUT0 + S6.CUT1) / 2, CB = (S6.BACK0 + S6.BACK1) / 2;
  if (T < CA) s6Exterior(ctx, T, 'early');
  else if (T < CB) s6Cut(ctx, T);
  else { s6Exterior(ctx, T, 'late'); s6Tourist(ctx, T); }
  for (const tc of [CA, CB]) {
    const d = Math.abs(T - tc); if (d > 0.16) continue;
    const a = Math.pow(1 - d / 0.16, 1.5);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = NP.rgr(ctx, 540, 1000, 50, 540, 1000, 1300, [[0, `rgba(255,200,120,${0.85 * a})`], [1, `rgba(255,120,40,${0.5 * a})`]]); ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

module.exports = { s2, s3, s4, s5, s6 };
