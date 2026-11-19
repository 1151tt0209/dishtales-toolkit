// shotsB.js — "Cơm tấm Sài Gòn" shots 9–15 (Act II second half: chả trứng → mỡ hành → ốp la → đồ chua/nước mắm →
// top-down plating → hero orbit → nước mắm pour). Contract: sN(ctx, lt, p, T) paints the full frame.
'use strict';
const L = require('./lib');
const X = require('./text');
const E = require('./ct_env');
const F = require('./ct_food');
const FX = require('./ct_fx');
const { W, H, TAU, rng, clamp, lerp, ease } = L;
const PI = Math.PI;

// ------------------------------------------------------------------ helpers
const iv = (x, a, b) => clamp((x - a) / (b - a));
const sm = (a, b, x) => { const u = iv(x, a, b); return u * u * (3 - 2 * u); };
const SH = { 9: [22.4, 24.533], 10: [24.533, 26.667], 11: [26.667, 28.8], 12: [28.8, 30.933], 13: [30.933, 35.2], 14: [35.2, 37.333], 15: [37.333, 39.467] };
function cap(ctx, T, shot, n, vi, en) { const [a, b] = SH[shot]; X.caption(ctx, T, a + 0.15, b - 0.1, vi, en, { n, y: 360 }); }
const SKIN = ['#f2c69c', '#dca077', '#b8744d'], AO = ['#d9c4ef', '#b898dc', '#8d6cb8'], CUFF = '#e6d8f5', OUT = 'rgba(40,20,42,0.66)';

// background counter (bokeh above `edge`) with a gentle parallax camera; always covers the frame (zoom ≥ 1.03)
function bg(ctx, t, o, zoom = 1, dx = 0, dy = 0, rot = 0) {
  const z = Math.max(1.03, zoom), mx = 540 - 540 / z, my = 960 - 960 / z;
  L.cam(ctx, 540 + clamp(dx, -mx, mx), 960 + clamp(dy, -my, my), z, rot, () => E.counterTop(ctx, t, o));
}
// out-of-focus foreground discs (neon / dawn) hugging the frame edges → shallow depth of field
function fgBokeh(ctx, t, seed, k = 1, cols = ['255,80,180', '80,220,255', '255,190,120'], o = {}) {
  if (k <= 0) return;
  const r = rng(seed), n = o.n ?? 7;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const side = i % 2, x = (side ? W - r() * 200 : r() * 200) + Math.sin(t * 0.35 + i * 1.7) * 18 + (o.dx || 0) * (0.5 + r());
    const y = (o.y0 ?? 520) + r() * (o.yh ?? 1300) + Math.cos(t * 0.3 + i) * 14;
    const rad = (o.rmin ?? 60) + r() * ((o.rmax ?? 150) - (o.rmin ?? 60)), col = cols[i % cols.length], a = k * (0.07 + 0.1 * r());
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${col},${a * 0.7})`); g.addColorStop(0.82, `rgba(${col},${a})`); g.addColorStop(0.92, `rgba(${col},${a * 1.25})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// soft lens blur band at the bottom (near counter out of focus)
function nearBlur(ctx, k = 1, y0 = 1560) {
  const g = ctx.createLinearGradient(0, y0, 0, H); g.addColorStop(0, 'rgba(10,8,18,0)'); g.addColorStop(1, `rgba(10,8,18,${0.45 * k})`);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
}
function cap2(ctx, x0, y0, x1, y1, w0, w1, fill, lw = 2.4) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.arc(x0, y0, w0 / 2, a + PI / 2, a - PI / 2); ctx.arc(x1, y1, w1 / 2, a - PI / 2, a + PI / 2); ctx.closePath();
  if (lw) { ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
// Cô Năm's forearm from the wrist (wx,wy) toward direction ang (off-frame), lavender sleeve after `bare` px
function forearm(ctx, wx, wy, ang, len, s, bare = 0.45) {
  const ex = wx + Math.cos(ang) * len, ey = wy + Math.sin(ang) * len, w0 = 50 * s, w1 = 66 * s;
  const g = ctx.createLinearGradient(wx - Math.sin(ang) * w1, wy + Math.cos(ang) * w1, wx + Math.sin(ang) * w1, wy - Math.cos(ang) * w1);
  g.addColorStop(0, SKIN[2]); g.addColorStop(0.45, SKIN[1]); g.addColorStop(0.75, SKIN[0]); g.addColorStop(1, SKIN[1]);
  cap2(ctx, wx, wy, ex, ey, w0, w1, g);
  const bx = lerp(wx, ex, bare), by = lerp(wy, ey, bare);
  const g2 = ctx.createLinearGradient(bx - Math.sin(ang) * w1, by + Math.cos(ang) * w1, bx + Math.sin(ang) * w1, by - Math.cos(ang) * w1);
  g2.addColorStop(0, AO[2]); g2.addColorStop(0.5, AO[1]); g2.addColorStop(0.8, AO[0]); g2.addColorStop(1, AO[1]);
  cap2(ctx, bx, by, ex + Math.cos(ang) * 40 * s, ey + Math.sin(ang) * 40 * s, w1 * 1.25, w1 * 1.4, g2);
  ctx.strokeStyle = CUFF; ctx.lineWidth = 9 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx - Math.sin(ang) * w1 * 0.6, by + Math.cos(ang) * w1 * 0.6); ctx.lineTo(bx + Math.sin(ang) * w1 * 0.6, by - Math.cos(ang) * w1 * 0.6); ctx.stroke();
}
// knife (tip at x,y) held in a fist on the handle; forearm leaves toward armAng (knife-local); sy<0 flips it flat-under
function heldKnife(ctx, x, y, s, rot, o = {}) {
  const sy = o.sy ?? 1, armAng = o.armAng ?? -0.35;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, sy);
  F.knife(ctx, 0, 0, s, { rot: 0 });
  ctx.scale(s, s);
  forearm(ctx, 420, -30, armAng, 900, 1, 0.42);
  // fist around the handle: 4 finger rolls + thumb on the spine side
  const g = ctx.createLinearGradient(0, -78, 0, 18); g.addColorStop(0, SKIN[0]); g.addColorStop(0.6, SKIN[1]); g.addColorStop(1, SKIN[2]);
  ctx.beginPath(); ctx.roundRect(318, -74, 108, 88, 30); ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(300 + i * 25, -40 + (i === 0 ? 4 : 0), 30, 58 - (i === 0 ? 6 : 0), 13); ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.stroke(); ctx.fillStyle = g; ctx.fill(); }
  ctx.strokeStyle = 'rgba(110,50,35,0.35)'; ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(306 + i * 25, 6); ctx.lineTo(322 + i * 25, 6); ctx.stroke(); }
  cap2(ctx, 400, -66, 318, -60, 30, 24, g, 2.2);
  ctx.fillStyle = 'rgba(255,236,222,0.6)'; ctx.beginPath(); ctx.ellipse(322, -62, 6, 4, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function crumbs(ctx, x, y, k, s, seed, col = '#c08a4a') {
  if (k <= 0 || k >= 1) return;
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.4, v = (120 + r() * 260) * s, px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 700 * s * k * k;
    ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 4 === 0 ? '#ffb21e' : col; ctx.beginPath(); ctx.arc(px, py, (2 + r() * 4) * s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function ring(ctx, x, y, r, sq, a, col = '255,240,210', lw = 2) {
  if (a <= 0) return; ctx.save(); ctx.strokeStyle = `rgba(${col},${a})`; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(x, y, r, r * sq, 0, 0, TAU); ctx.stroke(); ctx.restore();
}
const decay = (lt, t0, k = 9) => (lt < t0 ? 0 : Math.exp(-(lt - t0) * k));

// ================================================================== s9 — chả trứng: lid off, knife cut on the beat
function s9(ctx, lt, p, T) {
  const t = T, HIT = 1.067, s = 1.5, x = 540, y = 1200, sq = 0.55;
  const shake = decay(lt, HIT, 14) * 9 * Math.sin(lt * 90);
  const z = lerp(1.0, 1.5, ease.inOut(iv(lt, 0.3, 2.13)));
  const cx = lerp(540, 600, iv(lt, 0.3, 2.0)), cy = lerp(1060, 1140, ease.inOut(iv(lt, 0.3, 2.13)));
  bg(ctx, t, { dawn: 0.4, neon: 0.9, edge: 880 }, 1 + (z - 1) * 0.35, (cx - 540) * 0.3, (cy - 1060) * 0.2);
  const side = 150 * s, h = side / 2, cxs = x + 40 * s, cys = y + 10 * s;
  const C = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([u, v]) => [cxs + u, cys + v * sq]);
  const cut = 0.8 * ease.inOut(iv(lt, HIT, 1.5)), lift = ease.inOut(iv(lt, 1.66, 2.05)), liftH = 95;
  L.cam(ctx, cx, cy + shake * 0.3, z, 0, () => {
    ctx.save(); ctx.translate(0, shake);
    // warm under-glow from the steamer
    L.glow(ctx, x, y + 120, 620, 'rgba(255,170,80,0.5)', 0.35);
    const A = F.chaTrung(ctx, x, y, s, { mode: 'tray', lid: ease.inOut(iv(lt, 0.0, 0.8)), cut: lt < HIT ? 0 : Math.max(0.001, cut), lift, liftH, knife: false, t, steam: 1, sq });
    // big steam burst when the lid comes off
    FX.steam(ctx, t, { x, y: y - 20, w: 520, h: 640, n: 10, k: sm(0.05, 0.4, lt) * (1 - sm(0.9, 1.8, lt) * 0.6), s: 1.6, seed: 91, warm: 0.35 });
    // knife
    let kx, ky, kr = -1.15, ksy = 1;
    if (lt < HIT) {
      const e = lt < 0.85 ? ease.out(iv(lt, 0.25, 0.85)) : 1, drop = ease.in(iv(lt, 0.85, HIT));
      kx = C[0][0] + lerp(420, 40, e) * (1 - drop) - 0; ky = C[0][1] - lerp(520, 300, e) * (1 - drop);
    } else if (lt < 1.5) {
      const seg = Math.min(3, Math.floor(cut / 0.2)), f = clamp((cut - seg * 0.2) / 0.2), a = C[seg], b = C[(seg + 1) % 4];
      kx = lerp(a[0], b[0], f); ky = lerp(a[1], b[1], f) + 4 * s; kr += Math.sin(t * 14) * 0.03;
    } else {
      const m = ease.inOut(iv(lt, 1.5, 1.68));
      const fx0 = C[0][0], fy0 = C[0][1] + 4 * s;
      const by = cys + h * sq + 52 * s - lift * liftH * s; // bottom front edge of the lifted block
      kx = lerp(fx0, cxs - side * 0.95, m); ky = lerp(fy0, by, m); kr = lerp(-1.15, -0.03, m); ksy = lerp(1, 0.42, m);
    }
    const appear = sm(0.4, 0.62, lt);
    if (appear > 0) { ctx.save(); ctx.globalAlpha = appear; heldKnife(ctx, kx, ky, s * 0.9, kr, { sy: ksy, armAng: lt > 1.5 ? 0.2 : -0.25 }); ctx.restore(); }
    if (lift > 0) { // crisp edge + rim light on the lifted slice so it separates from the tray
      const oy = -lift * liftH * s; ctx.save(); ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(120,58,8,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); C.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1] + oy) : ctx.moveTo(q[0], q[1] + oy))); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(C[3][0] + 3, C[3][1] + oy - 3); ctx.lineTo(C[2][0] - 3, C[2][1] + oy - 3); ctx.stroke(); ctx.restore();
    }
    // impact accents
    const hk = iv(lt, HIT, HIT + 0.45);
    if (lt >= HIT && hk < 1) {
      L.glow(ctx, C[0][0], C[0][1], 160 * (1 + hk), 'rgba(255,230,160,0.9)', 0.6 * (1 - hk));
      ring(ctx, C[0][0], C[0][1], 40 + hk * 220, sq, 0.6 * (1 - hk), '255,236,190', 3);
      crumbs(ctx, C[0][0], C[0][1], hk, s * 0.8, 17);
    }
    FX.steam(ctx, t, { x: A.slice[0], y: A.slice[1], w: 120, h: 420, n: 5, k: sm(HIT, 1.4, lt), s: 1.1, seed: 12, warm: 0.3 });
    // gloss on the yolk top + lifted slice
    FX.glazeSparkle(ctx, t, x - 60, y - 10, 230, 0.7 * sm(0.4, 0.9, lt), { ryr: sq, n: 6, seed: 9, size: 1.1 });
    if (lift > 0.3) FX.glazeSparkle(ctx, t, A.slice[0], A.slice[1], 80, lift, { ryr: sq, n: 3, seed: 4, size: 1 });
    ctx.restore();
  });
  fgBokeh(ctx, t, 9, 1, ['255,80,180', '80,220,255', '255,190,120'], { dx: -(cx - 540) });
  nearBlur(ctx, 1);
  cap(ctx, T, 9, 5, 'Chả trứng hấp vàng ươm', 'Steamed egg meatloaf');
}

// ================================================================== s10 — mỡ hành: hot oil hits the scallions
function ladle(ctx, x, y, s, tilt, oilK) { // small steel saucepan, (x,y) = pouring lip, body to the right
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.roundRect(150, -62, 330, 22, 10); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(160, -60, 300, 5);
  const g = ctx.createLinearGradient(0, -90, 0, 10); g.addColorStop(0, '#f2f5f8'); g.addColorStop(0.5, '#a8b0b8'); g.addColorStop(1, '#5c646c');
  ctx.beginPath(); ctx.moveTo(-6, -84); ctx.lineTo(158, -84); ctx.lineTo(146, -6); ctx.quadraticCurveTo(140, 8, 120, 8); ctx.lineTo(24, 8); ctx.quadraticCurveTo(6, 8, 4, -6); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(30,34,40,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  // rim ellipse with hot oil inside
  ctx.beginPath(); ctx.ellipse(76, -84, 82, 16, 0, 0, TAU); ctx.fillStyle = '#7c848c'; ctx.fill();
  if (oilK > 0) { ctx.save(); ctx.beginPath(); ctx.ellipse(76, -84, 78, 14, 0, 0, TAU); ctx.clip(); ctx.fillStyle = 'rgba(255,196,70,0.95)'; ctx.beginPath(); ctx.ellipse(76 - 20 * (1 - oilK), -82, 76 * oilK + 6, 13, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,250,210,0.8)'; ctx.beginPath(); ctx.ellipse(56, -86, 26 * oilK, 3, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.strokeStyle = '#e8ecf0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(76, -84, 82, 16, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(30, -70, 10, 60);
  ctx.restore();
}
function s10(ctx, lt, p, T) {
  const t = T, s = 1.6, x = 540, y = 1420, sq = 0.55, HIT = 0.13;
  const z = lerp(1.18, 1.5, ease.inOut(iv(lt, 0.5, 2.13))), cx = 540, cy = lerp(1240, 1390, ease.inOut(iv(lt, 0.5, 2.13)));
  bg(ctx, t, { dawn: 0.45, neon: 0.85, edge: 820 }, 1 + (z - 1) * 0.3, 0, (cy - 1240) * 0.15);
  const pour = lt < HIT ? 0 : lt < 1.5 ? lerp(0.05, 0.71, ease.inOut(iv(lt, HIT, 1.5))) : lerp(0.73, 1, ease.out(iv(lt, 1.5, 2.1)));
  const oil = [x + 30 * s, y - 520 * s], hd = [x + 10 * s, y];
  L.cam(ctx, cx, cy, z, 0, () => {
    L.glow(ctx, x, y + 40, 520, 'rgba(255,150,60,0.6)', 0.3 + 0.4 * decay(lt, HIT, 2.5));
    const A = F.moHanh(ctx, x, y, s, { pour, t, sq });
    // falling oil head before contact
    if (lt < HIT && lt > 0) {
      const f = ease.in(iv(lt, 0, HIT)), q = [lerp(oil[0], hd[0], f), lerp(oil[1], hd[1], f * f * 0.3 + f * 0.7)];
      ctx.save(); ctx.lineCap = 'round';
      for (const [c, w] of [['rgba(255,190,60,0.55)', 16], ['rgba(255,236,160,0.85)', 6], ['rgba(255,255,240,0.9)', 2]]) { ctx.strokeStyle = c; ctx.lineWidth = w * s; ctx.beginPath(); ctx.moveTo(oil[0], oil[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      ctx.restore();
    }
    // ladle tilting above
    const tilt = lt < 1.5 ? lerp(-0.25, -0.72, ease.out(iv(lt, 0, 0.3))) : lerp(-0.72, -0.15, ease.inOut(iv(lt, 1.45, 1.9)));
    const away = ease.in(iv(lt, 1.5, 2.1));
    ladle(ctx, oil[0] - 4 + away * 260, oil[1] - 6 - away * 380, s, tilt, 1 - iv(lt, 0, 1.6) * 0.85);
    // impact flash, spits, gloss
    const hk = iv(lt, HIT, HIT + 0.5);
    if (lt >= HIT && hk < 1) { L.glow(ctx, hd[0], hd[1], 260, 'rgba(255,220,130,0.9)', 0.7 * (1 - hk)); ring(ctx, hd[0], hd[1], 30 + hk * 240, sq, 0.7 * (1 - hk), '255,240,190', 3); }
    if (lt >= HIT) FX.sizzle(ctx, t, x, y, 0.9 * decay(lt, HIT, 1.2), { r: 150 * s, ryr: sq, n: 60, spat: 40, s: s, seed: 61, col: '255,236,170' });
    FX.glazeSparkle(ctx, t, x, y, 120 * s, sm(0.6, 1.4, lt), { ryr: sq, n: 7, seed: 13, size: 1.1 });
    FX.steam(ctx, t, { x, y: y - 10, w: 300, h: 620, n: 8, k: sm(HIT, 0.6, lt), s: 1.4, seed: 44, warm: 0.4 });
  });
  fgBokeh(ctx, t, 10, 1, ['80,220,255', '255,80,180', '255,190,120']);
  nearBlur(ctx, 1);
  cap(ctx, T, 10, 6, 'Mỡ hành xanh mướt', 'Sizzling scallion oil');
}

// ================================================================== s11 — ốp la: slow-mo crack into the pan
function eggHand(ctx, x, y, s, a = 1) { // (x,y) = egg/shell-half centre; hand grips it from the top-right, fingers over the top-front, thumb down the right side
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  forearm(ctx, x + 78 * s, y - 92 * s, -0.95, 760 * s, s * 1.05, 0.38);
  const g = ctx.createLinearGradient(x - 50 * s, y - 110 * s, x + 70 * s, y + 10 * s); g.addColorStop(0, SKIN[0]); g.addColorStop(0.55, SKIN[1]); g.addColorStop(1, SKIN[2]);
  // back of the hand
  ctx.beginPath(); ctx.ellipse(x + 52 * s, y - 80 * s, 50 * s, 38 * s, -0.55, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
  // thumb down the right side of the egg
  cap2(ctx, x + 62 * s, y - 50 * s, x + 50 * s, y + 6 * s, 27 * s, 22 * s, g, 2.2);
  // three fingers curling over the top-front of the shell, tips pointing down-left
  const F3 = [[x + 40 * s, y - 92 * s, x - 22 * s, y - 62 * s], [x + 30 * s, y - 72 * s, x - 32 * s, y - 36 * s], [x + 26 * s, y - 50 * s, x - 22 * s, y - 14 * s]];
  for (const [x0, y0, x1, y1] of F3) cap2(ctx, x0, y0, x1, y1, 26 * s, 21 * s, g, 2.2);
  ctx.fillStyle = 'rgba(255,236,222,0.65)';
  for (const [, , x1, y1] of F3) { ctx.beginPath(); ctx.ellipse(x1 + 4 * s, y1 - 3 * s, 4.5 * s, 3 * s, -0.6, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(110,50,35,0.35)'; ctx.lineWidth = 1.6;
  for (const [x0, y0, x1, y1] of F3) { const mx = lerp(x0, x1, 0.5), my = lerp(y0, y1, 0.5); ctx.beginPath(); ctx.moveTo(mx - 4 * s, my - 8 * s); ctx.lineTo(mx + 4 * s, my + 8 * s); ctx.stroke(); }
  ctx.restore();
}
function s11(ctx, lt, p, T) {
  const t = T, s = 1.75, x = 540, y = 1320, sq = 0.72;
  // cracking timeline: tap/crack on 27.2 (lt .533), slow-mo fall, lands ~lt .85, slow spread & lace
  const ck = lt < 0.45 ? lerp(0, 0.08, iv(lt, 0, 0.45)) : lt < 0.6 ? lerp(0.08, 0.25, iv(lt, 0.45, 0.6)) : lt < 0.85 ? lerp(0.25, 0.4, ease.in(iv(lt, 0.6, 0.85))) : lerp(0.4, 0.97, ease.out(iv(lt, 0.85, 2.13)));
  const fallK = ease.inOut(iv(lt, 0.45, 1.0));
  const z = lerp(1.38, 1.12, fallK) + 0.12 * ease.inOut(iv(lt, 1.1, 2.13));
  const shellP = [x + 30 * s, y - 300 * s];
  const cx = lerp(shellP[0] - 20, x, fallK), cy = lerp(shellP[1] + 210, y - 30, fallK);
  bg(ctx, t, { dawn: 0.5, neon: 0.85, edge: 820 }, 1 + (z - 1) * 0.3, (cx - 540) * 0.2, (cy - 1000) * 0.15);
  L.cam(ctx, cx, cy, z, 0, () => {
    // burner glow under the pan
    L.glow(ctx, x, y + 230, 700, 'rgba(255,120,40,0.75)', 0.55);
    L.glow(ctx, x - 300, y + 120, 260, 'rgba(80,140,255,0.6)', 0.35);
    const A = F.friedEgg(ctx, x, y, s, { t, sq, cracking: ck, seed: 2 });
    // hand that holds the egg: follows the right shell half and leaves
    const k2 = clamp((ck - 0.25) / 0.35), sp2 = k2 > 0 ? ease.out(k2) : 0;
    const hx = shellP[0] + sp2 * 120 * s + 4 * Math.sin(t * 3), hy = shellP[1] - sp2 * 60 * s - lerp(140, 0, ease.out(iv(lt, 0, 0.35))) - ease.in(iv(lt, 0.95, 1.6)) * 700;
    eggHand(ctx, hx, hy, s, 1);
    // landing splash
    const hk = iv(lt, 0.85, 1.3);
    if (lt >= 0.85 && hk < 1) { ring(ctx, x, y, 60 + hk * 260, sq, 0.7 * (1 - hk), '255,250,230', 3); L.glow(ctx, x, y, 240, 'rgba(255,240,200,0.8)', 0.5 * (1 - hk)); }
    if (lt >= 0.85) FX.sizzle(ctx, t, x, y, 0.6 * decay(lt, 0.85, 1.4), { r: 200 * s, ryr: sq, n: 30, spat: 22, s: s, seed: 71 });
    FX.steam(ctx, t, { x, y: y - 20, w: 320, h: 560, n: 7, k: sm(0.9, 1.5, lt), s: 1.4, seed: 72, warm: 0.4 });
    if (lt > 1.2) FX.glazeSparkle(ctx, t, A.yolk[0], A.yolk[1] - 10, 40 * s, sm(1.2, 1.6, lt), { n: 3, seed: 5, size: 1.2 });
  });
  fgBokeh(ctx, t, 11, 1, ['255,190,120', '80,220,255', '255,80,180']);
  nearBlur(ctx, 1);
  cap(ctx, T, 11, 7, 'Trứng ốp la lòng đào', 'Sunny-side-up egg');
}

// ================================================================== s12 — đồ chua jar + nước mắm bowl
function cruet(ctx, x, y, s, rot) { // small glass sauce bottle, (x,y) = spout, body toward +x
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(210,230,236,0.35)'; ctx.beginPath(); ctx.roundRect(0, -15, 70, 30, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(66, -15); ctx.quadraticCurveTo(100, -20, 110, -58); ctx.lineTo(300, -58); ctx.quadraticCurveTo(320, -58, 320, -38); ctx.lineTo(320, 38); ctx.quadraticCurveTo(320, 58, 300, 58); ctx.lineTo(110, 58); ctx.quadraticCurveTo(100, 20, 66, 15); ctx.closePath();
  ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.stroke();
  // amber sauce pooled toward the spout (bottle tipped)
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(214,120,34,0.85)'; ctx.fillRect(60, -60, 170, 120); ctx.restore();
  ctx.fillStyle = 'rgba(214,120,34,0.85)'; ctx.fillRect(4, -10, 64, 20);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(130, -44); ctx.lineTo(290, -44); ctx.stroke();
  ctx.fillStyle = '#c8302a'; ctx.beginPath(); ctx.roundRect(150, -30, 110, 60, 6); ctx.fill(); // label
  ctx.fillStyle = '#ffe6a0'; ctx.fillRect(160, -6, 90, 6);
  ctx.restore();
}
function s12(ctx, lt, p, T) {
  const t = T, jx = 320, jy = 1010, js = 1.35, bx = 690, by = 1490, bs = 1.8, bsq = 0.55;
  const dol = ease.inOut(iv(lt, 0.45, 1.25));
  const z = lerp(1.14, 1.2, dol) + 0.08 * ease.inOut(iv(lt, 1.3, 2.13));
  const cx = lerp(480, 590, dol) + 30 * iv(lt, 1.3, 2.13), cy = lerp(1170, 1290, dol) + 40 * iv(lt, 1.3, 2.13);
  bg(ctx, t, { dawn: 0.55, neon: 0.8, edge: 860 }, 1 + (z - 1) * 0.3, (cx - 540) * 0.35, 0);
  const R = 115 * bs, surf = [bx - 10, by + 8];
  const spout = [bx + 70, by - 420], streamK = ease.out(iv(lt, 0.32, 0.6)), streamW = 1 - sm(1.85, 2.06, lt);
  L.cam(ctx, cx, cy, z, 0, () => {
    L.glow(ctx, jx, jy + 200, 420, 'rgba(255,170,90,0.5)', 0.35);
    const twist = lt < 0.05 ? 0 : Math.sin(iv(lt, 0, 0.12) * PI) * 0.0;
    F.doChua(ctx, jx, jy, js, { mode: 'jar', sq: 0.55, lid: ease.out(iv(lt, 0.0, 0.42)) + twist, t });
    // pickle sparkle + a cool rim glint on the glass
    FX.glazeSparkle(ctx, t, jx, jy + 200, 120, 0.8, { n: 4, seed: 21, size: 0.9 });
    const B = F.nuocMamBowl(ctx, bx, by, bs, { pour: 0, sq: bsq, t });
    // stream from the cruet into the bowl
    const sp = [spout[0] + Math.sin(t * 2) * 3, spout[1]];
    if (streamK > 0 && streamW > 0.02) F.mamStream(ctx, sp, surf, streamK, { s: bs * 0.8 * streamW, t, w: 9 * streamW });
    // ripples where it lands + garlic & chili dropped in on the beats
    if (streamK >= 1 && streamW > 0) for (let i = 0; i < 3; i++) { const ph = (t * 1.6 + i / 3) % 1; ring(ctx, surf[0], surf[1], 10 + ph * 90, bsq, 0.5 * (1 - ph) * streamW, '255,226,170', 2); }
    for (const [tb, seed, dx] of [[1.067, 3, -60], [1.6, 7, 40]]) {
      if (lt < tb - 0.35) continue;
      const f = iv(lt, tb - 0.35, tb), after = iv(lt, tb, tb + 0.6);
      const r = rng(seed);
      for (let i = 0; i < 4; i++) {
        const ox = (r() - 0.5) * 80 + dx, oy0 = -520 - r() * 120, rot = r() * PI;
        if (f < 1) { const px = bx + ox, py = by + oy0 * (1 - f * f); ctx.save(); ctx.translate(px, py); ctx.rotate(rot + f * 3); ctx.scale(1.6, 1.6); if (i % 2 === 0) { ctx.strokeStyle = '#e0180e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, 15, 15 * 0.8, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(-3, 0, 2.5, 0, TAU); ctx.arc(4, 2, 2.5, 0, TAU); ctx.fill(); } else { ctx.fillStyle = '#fbf4e0'; ctx.fillRect(-5, -4, 10, 8); } ctx.restore(); }
        else if (after < 1 && i === 0) { ring(ctx, bx + ox, by + 4, 12 + after * 110, bsq, 0.7 * (1 - after), '255,236,190', 2.5); }
      }
      if (lt >= tb && after < 1) {
        const r2 = rng(seed + 50); ctx.save(); ctx.fillStyle = 'rgba(230,150,60,0.9)';
        for (let j = 0; j < 8; j++) { const a = -PI / 2 + (r2() - 0.5) * 2, v = 60 + r2() * 120; ctx.globalAlpha = 1 - after; ctx.beginPath(); ctx.arc(bx + dx + Math.cos(a) * v * after, by + Math.sin(a) * v * after + 260 * after * after, 3.5, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    }
    // extra floating chili rings that accumulate on the surface
    const nr = (lt > 1.067 ? 2 : 0) + (lt > 1.6 ? 2 : 0), rr = rng(77);
    for (let i = 0; i < nr; i++) { const a = rr() * TAU + t * 0.25, d = 30 + rr() * 90, px = bx + Math.cos(a) * d, py = by + 8 + Math.sin(a) * d * bsq; ctx.strokeStyle = '#d4140c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(px, py, 14, 14 * bsq, 0, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,220,120,0.95)'; ctx.beginPath(); ctx.arc(px - 3, py, 2.5, 0, TAU); ctx.fill(); }
    FX.glazeSparkle(ctx, t, bx, by + 6, R * 0.8, 0.9, { ryr: bsq, n: 5, seed: 31, size: 1 });
    cruet(ctx, sp[0] - 4, sp[1] + 2, 0.95, -0.95 + 0.05 * Math.sin(t * 1.5) - 0.35 * (1 - ease.out(iv(lt, 0.2, 0.4))));
  });
  fgBokeh(ctx, t, 12, 1, ['255,80,180', '255,190,120', '80,220,255']);
  nearBlur(ctx, 1);
  cap(ctx, T, 12, 8, 'Đồ chua & nước mắm chua ngọt', 'Pickles & sweet fish sauce');
}

// ================================================================== s13 — top-down plating on the beats
const PLATE_BEATS = { rice: 0, chop: 1.067, bi: 1.6, cha: 2.133, egg: 2.667, moHanh: 3.2, pickles: 3.733 };
function dropK(lt, tb, fall = 0.28, settle = 0.4) {
  if (tb <= 0) return lt <= 0 ? 0.55 : Math.min(1, 0.55 + 0.45 * lt / settle);
  if (lt < tb - fall) return 0;
  if (lt < tb) return 0.02 + 0.53 * (1 - (tb - lt) / fall);
  return Math.min(1, 0.55 + 0.45 * (lt - tb) / settle);
}
function s13(ctx, lt, p, T) {
  const t = T, x = 540, y = 1050, s = 1.12;
  let pulse = 0; for (const k in PLATE_BEATS) pulse += decay(lt, PLATE_BEATS[k], 10) * 0.018;
  const z = lerp(1.0, 1.1, ease.inOut(p)) + pulse, rot = lerp(-0.05, 0.04, ease.inOut(p));
  ctx.fillStyle = '#20181c'; ctx.fillRect(0, 0, W, H);
  L.cam(ctx, 540, 960, Math.max(1.08, z * 1.05), rot * 0.6, () => E.counterTop(ctx, t, { topDown: true, dawn: 0.6, neon: 0.8 }));
  const items = {}; for (const k in PLATE_BEATS) items[k] = dropK(lt, PLATE_BEATS[k]);
  let A;
  L.cam(ctx, x, y - 40, z, rot, () => {
    A = F.comTamPlate(ctx, x, y, s, { topDown: true, rim: 'blue', items, t, steam: 0.8, glaze: sm(1.2, 1.8, lt) });
    // landing accents
    const spot = { rice: A.ricePeak || A.rice, chop: A.chop, bi: A.bi, cha: A.cha, egg: A.yolk || A.egg, moHanh: A.moHanh, pickles: A.pickles };
    for (const k in PLATE_BEATS) {
      const tb = PLATE_BEATS[k], hk = iv(lt, tb, tb + 0.45), q = spot[k];
      if (!q || lt < tb || hk >= 1) continue;
      ring(ctx, q[0], q[1], 50 + hk * 200, 1, 0.55 * (1 - hk), '255,244,220', 3);
      L.sparkle(ctx, q[0] + 50, q[1] - 40, 60 * (1 - hk * 0.5), 0.9 * (1 - hk));
      if (k === 'pickles') { ring(ctx, A.cucumber[0], A.cucumber[1], 40 + hk * 160, 1, 0.5 * (1 - hk), '220,255,220', 3); ring(ctx, A.tomato[0], A.tomato[1], 40 + hk * 160, 1, 0.5 * (1 - hk), '255,200,190', 3); }
    }
    FX.steam(ctx, t, { x: A.rice[0], y: A.rice[1], w: 300, h: 600, n: 7, k: 0.8, s: 1.3, seed: 131, warm: 0.5 });
    if (lt > 1.3) FX.glazeSparkle(ctx, t, A.chop[0], A.chop[1], 130, sm(1.3, 1.8, lt), { n: 6, seed: 33, size: 1.2 });
  });
  fgBokeh(ctx, t, 13, 0.7, ['255,190,120', '255,80,180', '80,220,255'], { n: 5 });
  cap(ctx, T, 13, 9, 'Bày đĩa', 'Plate it up');
}

// ================================================================== s14 — hero orbit, peach sunrise backlight
function s14(ctx, lt, p, T) {
  const t = T, dawn = lerp(0.74, 0.84, p), e = ease.inOut(p);
  const ang = lerp(-0.55, 0.35, e), z = lerp(1.0, 1.1, e), x = 540, y = 1300, s = 1.38, sq = lerp(0.46, 0.53, e);
  bg(ctx, t, { dawn, neon: 0.55, edge: 900 }, 1.06 + (z - 1) * 0.3, ang * 220, 0, lerp(0.015, -0.015, e));
  // peach backlight behind the plate
  L.glow(ctx, 760 - ang * 160, 880, 900, 'rgba(255,190,130,0.9)', 0.55);
  L.glow(ctx, 700 - ang * 160, 900, 360, 'rgba(255,236,200,0.9)', 0.35);
  E.sunShafts(ctx, t, { x: 1150 - ang * 120, y: 420, angle: 2.25, spread: 0.6, len: 2200, n: 8, k: 0.55, col: '255,196,140', motes: true });
  let A;
  L.cam(ctx, x, 1150, z, lerp(0.02, -0.02, e), () => {
    A = F.comTamPlate(ctx, x, y, s, { sq, angle: ang, rim: 'blue', glaze: 1, steam: 1, t, mam: 0 });
    // rim light on the far edge of the plate (backlit)
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,150,0.55)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(x, y, A.plate.rx * 0.995, A.plate.ry * 0.995, 0, PI * 1.1, PI * 1.95); ctx.stroke(); ctx.restore();
    FX.steam(ctx, t, { x: A.rice[0], y: A.ricePeak ? A.ricePeak[1] : A.rice[1] - 80, w: 260, h: 640, n: 8, k: 1, s: 1.3, seed: 141, warm: 0.85 });
    FX.glazeSparkle(ctx, t, A.chop[0], A.chop[1], 140, 1, { ryr: sq, n: 7, seed: 41, size: 1.2 });
    FX.glazeSparkle(ctx, t, A.yolk[0], A.yolk[1], 40, 1, { ryr: sq, n: 2, seed: 42, size: 1 });
    // chime sparkles at 35.22 / 36.0 / 36.8
    for (const [tc, q] of [[0.02, A.chop], [0.8, A.yolk], [1.6, A.cha]]) { const k = iv(lt, tc, tc + 0.5); if (lt >= tc && k < 1) L.sparkle(ctx, q[0] + 20, q[1] - 30, 90 * Math.sin(k * PI), 1); }
  });
  E.dawnTint(ctx, dawn, 0.25);
  fgBokeh(ctx, t, 14, 1.1, ['255,190,120', '255,214,160', '255,80,180'], { dx: -ang * 260 });
  nearBlur(ctx, 1.1);
}

// ================================================================== s15 — chan nước mắm
function s15(ctx, lt, p, T) {
  const t = T, x = 590, y = 1340, s = 1.42, sq = 0.5;
  const z = lerp(1.0, 1.16, ease.inOut(p)), cx = lerp(540, 600, ease.inOut(p)), cy = lerp(1080, 1230, ease.inOut(p));
  bg(ctx, t, { dawn: 0.82, neon: 0.5, edge: 760 }, 1.04 + (z - 1) * 0.3, (cx - 540) * 0.3, 0);
  L.glow(ctx, 820, 640, 800, 'rgba(255,190,130,0.85)', 0.45);
  E.sunShafts(ctx, t, { x: 1150, y: 300, angle: 2.2, spread: 0.5, len: 2000, n: 7, k: 0.4, col: '255,196,140', motes: true });
  const mam = sm(0.5, 1.9, lt);
  L.cam(ctx, cx, cy, z, 0, () => {
    const A = F.comTamPlate(ctx, x, y, s, { sq, angle: -0.2, rim: 'blue', glaze: 1, steam: 0.8, mam, t });
    const to = [lerp(A.rice[0], A.chop[0], 0.55), lerp(A.rice[1], A.chop[1], 0.55) - 30];
    const pour = lt < 1.667 ? (lt < 0.22 ? lerp(0, 0.3, ease.inOut(iv(lt, 0, 0.22))) : lerp(0.3, 0.85, ease.out(iv(lt, 0.22, 1.667)))) : lerp(0.22, 0, ease.inOut(iv(lt, 1.667, 2.0)));
    const bs = 1.25, Rb = 115 * bs, away = ease.inOut(iv(lt, 1.7, 2.13));
    const bx = to[0] - Rb - 150 - away * 260, by = to[1] - 470 - away * 260;
    const B = F.nuocMamBowl(ctx, bx, by, bs, { pour, to, sq: 0.55, t });
    { // Cô Năm's hand cradling the bowl from the left: fingers under the belly, thumb over the rim
      const tilt = ease.inOut(clamp(pour / 0.3)) * 0.75, R = Rb;
      ctx.save(); ctx.translate(bx + R, by); ctx.rotate(tilt); ctx.translate(-R, 0);
      const g = ctx.createLinearGradient(-R, -20, -R * 0.3, R); g.addColorStop(0, SKIN[0]); g.addColorStop(0.6, SKIN[1]); g.addColorStop(1, SKIN[2]);
      forearm(ctx, -R * 1.05, R * 0.55, PI * 0.82 - tilt, 800, bs * 1.05, 0.4);
      ctx.beginPath(); ctx.ellipse(-R * 0.9, R * 0.5, 46 * bs, 34 * bs, -0.5, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke(); ctx.fillStyle = g; ctx.fill();
      for (let i = 0; i < 3; i++) cap2(ctx, -R * 0.85 + i * 6 * bs, R * (0.5 + i * 0.08), -R * (0.35 - i * 0.08), R * (0.68 + i * 0.03), 22 * bs, 18 * bs, g, 2);
      cap2(ctx, -R * 1.02, R * 0.25, -R * 0.78, -R * 0.06, 25 * bs, 19 * bs, g, 2.2);
      ctx.fillStyle = 'rgba(255,236,222,0.6)'; ctx.beginPath(); ctx.ellipse(-R * 0.8, -R * 0.04, 5 * bs, 3.5 * bs, -0.9, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // trailing tail + slow drips after the pour stops
    if (lt >= 1.667) {
      const k = iv(lt, 1.667, 1.85);
      const lip = [bx + Rb + 3 * bs, by + 4 * bs];
      if (k < 1) { const a = k, b = Math.min(1, k + 0.5); const P = (u) => [lerp(lip[0], to[0], u), lip[1] + (to[1] - lip[1]) * u * u]; const p0 = P(a), p1 = P(b); ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(226,140,50,0.9)'; ctx.lineWidth = 8 * bs * (1 - k * 0.6); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.restore(); }
    }
    // slow glossy drips swelling and falling off the chop's front edge onto the rice
    for (const [d0, dx] of [[1.0, -40], [1.55, 30], [1.85, -5]]) {
      const f = iv(lt, d0, d0 + 0.5); if (lt < d0 || f >= 1) continue;
      const ex = A.chop[0] + dx * s, ey = A.chop[1] + 34 * s, grow = sm(0, 0.55, f), fall = ease.in(iv(f, 0.55, 1));
      const py = ey + 6 + grow * 8 + fall * 90 * s, r = 4 + grow * 4;
      ctx.save(); ctx.fillStyle = 'rgba(214,122,36,0.95)';
      ctx.beginPath(); ctx.moveTo(ex - r * 0.6, ey); ctx.quadraticCurveTo(ex, py - r * 2, ex - r, py); ctx.arc(ex, py, r, PI, 0, true); ctx.quadraticCurveTo(ex, py - r * 2, ex + r * 0.6, ey); ctx.closePath(); ctx.globalAlpha = 1 - iv(f, 0.85, 1); ctx.fill();
      ctx.fillStyle = 'rgba(255,244,210,0.95)'; ctx.beginPath(); ctx.arc(ex - r * 0.35, py - r * 0.3, r * 0.3, 0, TAU); ctx.fill(); ctx.restore();
    }
    // splash + gloss on the wet rice / chop
    if (pour > 0.55 && lt < 1.8) { const ph = (t * 2.2) % 1; ring(ctx, to[0], to[1] + 10, 20 + ph * 110, sq, 0.6 * (1 - ph), '255,214,150', 3); }
    FX.glazeSparkle(ctx, t, to[0], to[1] + 20, 170, 0.4 + mam * 0.8, { ryr: sq, n: 8, seed: 151, size: 1.2 });
    FX.steam(ctx, t, { x: A.rice[0], y: A.rice[1] - 60, w: 260, h: 600, n: 7, k: 0.8, s: 1.4, seed: 152, warm: 0.85 });
  });
  E.dawnTint(ctx, 0.82, 0.2);
  fgBokeh(ctx, t, 15, 1, ['255,190,120', '255,214,160', '80,220,255']);
  nearBlur(ctx, 1);
  cap(ctx, T, 15, 10, 'Chan nước mắm', 'Pour the fish sauce');
}

module.exports = { s9, s10, s11, s12, s13, s14, s15 };
