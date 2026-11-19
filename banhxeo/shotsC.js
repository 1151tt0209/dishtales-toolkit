// shotsC.js – Bánh xèo miền Tây, shots 16..22 (44.16–69.6 s). 125 BPM swing grid: beat 0.48 s, bar 1.92 s.
// s16 eruption · s17 chef flip out of the window · s18 frisbee over the river + freeze · s19 perfect landing on Má Tư's plate
// s20 wrap / dip / CRUNCH · s21 dusk wide + end card · s22 LIKE & FOLLOW CTA.
'use strict';
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, inv, ease, glow, flare, dust, sparkle, createCanvas, godRays } = L;
const PE = require('./people');
const BX = require('./bxprops');
const X = require('./text');
const CAP_Y = X.CAP_Y;
const BEAT = 0.48;
const beat = T => ((T / BEAT) % 1 + 1) % 1;
const hit = (T, sharp = 6) => Math.exp(-beat(T) * sharp);

// =====================================================================================
// text / CTA helpers (ported from hutieu/shotsC.js, retimed to the 0.48 s grid)
// =====================================================================================
function backdrop(ctx, a, y = CAP_Y) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y - 170, 0, y + 190);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(8,4,2,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 170, W, 360);
  ctx.restore();
}
function fitFont(ctx, txt, size, fam, maxW) {
  let fs = size; ctx.font = `${fs}px ${fam}`;
  while (ctx.measureText(txt).width > maxW && fs > 20) { fs -= 2; ctx.font = `${fs}px ${fam}`; }
  return fs;
}
function heart(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-10, 20, -60, -5, -60, -35); ctx.bezierCurveTo(-60, -65, -20, -75, 0, -45);
  ctx.bezierCurveTo(20, -75, 60, -65, 60, -35); ctx.bezierCurveTo(60, -5, 10, 20, 0, 30); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-30, -42, 12, 7, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function checkMark(ctx, x, y, s, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 7 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.lineTo(x - 3 * s, y + 11 * s); ctx.lineTo(x + 16 * s, y - 12 * s); ctx.stroke(); ctx.restore();
}
function ctaLike(ctx, T, t0, tTap, x = 330, y = 760) {
  const k = T - t0; if (k < 0) return;
  const pop = ease.outBack(clamp(k / 0.4));
  const tapped = T >= tTap;
  const pulse = tapped ? 1 + 0.14 * hit(T, 7) : 1;
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15);
  ctx.beginPath(); ctx.arc(x, y, 105 * pop, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,10,8,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.stroke();
  heart(ctx, x, y + 12, 1.15 * pop * pulse, tapped ? '#fe2c55' : 'rgba(255,255,255,0.9)');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '38px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.fillText('THÍCH', x, y + 150); ctx.font = '30px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('LIKE', x, y + 192);
  const f = clamp((T - tTap) / 1.2);
  if (f > 0 && f < 1) { ctx.globalAlpha = Math.sin(f * Math.PI); ctx.font = '60px BodySansBold'; ctx.fillStyle = '#ff5c7a'; ctx.fillText('+1', x + 110, y - 90 - f * 120); }
  ctx.restore();
  const tk = T - tTap; if (tk >= 0 && tk < 0.35) glow(ctx, x, y, 220, 'rgba(255,120,150,0.9)', 1 - tk / 0.35);
}
function ctaConfetti(ctx, T, t0, x, y) {
  const k = T - t0; if (k < 0 || k > 2.2) return;
  const r = rng(515), cols = ['#fe2c55', '#25f4ee', '#ffd76a', '#ffffff', '#7cf07a'];
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.8, v = 500 + r() * 700, sz = 8 + r() * 10, spin = (r() - 0.5) * 16, c = cols[i % cols.length];
    const px = x + Math.cos(a) * v * k * 0.7, py = y + Math.sin(a) * v * k * 0.7 + 700 * k * k;
    ctx.globalAlpha = clamp(1 - k / 2.2); ctx.fillStyle = c;
    ctx.save(); ctx.translate(px, py); ctx.rotate(spin * k); ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
  }
  ctx.restore();
}
function ctaFollow(ctx, T, t0, tp, x = 700, y = 760) {
  const k = T - t0; if (k < 0) return;
  const sl = ease.outBack(clamp(k / 0.5));
  const pressed = T >= tp, pk = T - tp;
  const press = pk >= 0 && pk < 0.25 ? 1 - Math.sin(pk / 0.25 * Math.PI) * 0.12 : 1;
  const w = 330, h = 120;
  ctx.save(); ctx.translate(x + (1 - sl) * 500, y); ctx.scale(press, press);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = pressed ? '#5a5a60' : '#fe2c55'; ctx.fill();
  ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!pressed) {
    ctx.font = '46px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOW', 0, -14);
    ctx.font = '28px BodySansBold'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THEO DÕI', 0, 30);
  } else {
    checkMark(ctx, -118, -12, 1.4, '#fff');
    ctx.letterSpacing = '1px'; ctx.fillStyle = '#ffe6b0'; fitFont(ctx, 'ĐÃ THEO DÕI', 40, 'BodySansBold', 210); ctx.fillText('ĐÃ THEO DÕI', 24, -14);
    ctx.font = '28px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOWING', 24, 30);
  }
  ctx.restore();
  if (pk >= 0 && pk < 0.4) glow(ctx, x, y, 260, 'rgba(255,240,220,0.9)', 1 - pk / 0.4);
  if (pk >= 0) ctaConfetti(ctx, T, tp, x, y);
}
function ctaHand(ctx, T, tp, x, y) {
  const k = T - (tp - 0.48); if (k < 0 || T > tp + 0.9) return;
  const appr = ease.out(clamp(k / 0.4)), back = ease.in(clamp((T - tp - 0.3) / 0.5));
  const off = (1 - appr) * 420 + back * 420;
  ctx.save(); ctx.translate(x + 30 + off * 0.6, y + 30 + off); ctx.rotate(-0.5);
  ctx.globalAlpha = 1 - back;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-16, -10, 32, 90, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-40, 50, 90, 110, 34); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-56, 64, 34, 60, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-30, 150, 70, 60, 10); ctx.fillStyle = '#fe2c55'; ctx.fill(); ctx.stroke();
  ctx.restore();
}
function logo(ctx, a, y = 1500) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(500 - 80, y - 40, 160, 3);
  ctx.font = '44px TitleSerif'; ctx.letterSpacing = '10px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12;
  ctx.fillText('DISH TALES', 500, y);
  ctx.restore();
}
function biText(ctx, a, y, vi, en, o = {}) {
  if (a <= 0) return;
  if (o.bd !== false) backdrop(ctx, a * 0.85, y + 20);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.letterSpacing = '1px';
  ctx.fillStyle = o.vcol || '#ffe6b0'; fitFont(ctx, vi, o.vsize || 62, o.serif ? 'TitleSerif' : 'BodySansBold', 840); ctx.fillText(vi, 500, y);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; fitFont(ctx, en, o.esize || 40, 'BodySans', 840); ctx.fillText(en, 500, y + (o.gap || 66));
  ctx.restore();
}
function lineFit(ctx, T, t0, t1, vi, en, o = {}) {
  const a = X.fadeIO(T, t0, t1, 0.2, 0.3);
  if (a <= 0) return;
  const y = o.y || CAP_Y, sc = (0.9 + 0.1 * ease.outBack(clamp((T - t0) / 0.35))) * (1 + (o.thump || 0) * 0.04 * hit(T, 8));
  backdrop(ctx, a * 0.85, y);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(500, y); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 16;
  fitFont(ctx, vi, o.vsize || 66, o.serif ? 'TitleSerif' : 'BodySansBold', 820); ctx.fillStyle = o.vcol || '#fff2cf';
  ctx.fillText(vi, 0, 0);
  if (en) { fitFont(ctx, en, o.esize || 42, 'BodySans', 820); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(en, 0, 68); }
  ctx.restore();
}

// =====================================================================================
// scene helpers
// =====================================================================================
// camera that never shows outside the 1080x1920 canvas
function cam(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  L.cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}
// maps points from the CURRENT ctx space to the space whose transform was B0 (taken earlier, e.g. outside a cam)
function mapper(ctx, B0) {
  const M = ctx.getTransform();
  const det = B0.a * B0.d - B0.b * B0.c;
  return (p) => {
    const dx = M.a * p[0] + M.c * p[1] + M.e - B0.e, dy = M.b * p[0] + M.d * p[1] + M.f - B0.f;
    return [(B0.d * dx - B0.c * dy) / det, (-B0.b * dx + B0.a * dy) / det];
  };
}
const BGC = {};
function xPlate(key, blur, drawFn) {
  if (!BGC[key]) {
    const a = createCanvas(W, H), ax = a.getContext('2d');
    ax.fillStyle = '#000'; ax.fillRect(0, 0, W, H); drawFn(ax);
    const b = createCanvas(W, H), bx = b.getContext('2d');
    bx.drawImage(a, 0, 0);
    if (blur > 0) { bx.filter = `blur(${blur}px)`; bx.drawImage(a, 0, 0); bx.filter = 'none'; }
    BGC[key] = b;
  }
  return BGC[key];
}
function plateBg(ctx, img, cx, cy, z, rot = 0) { cam(ctx, cx, cy, z, rot, () => ctx.drawImage(img, 0, 0)); }
const sunsetPlate = () => xPlate('sunsetRiver', 9, ax => BX.riversideScene(ax, 50, { dusk: 0.5, sun: [300, 930], house: { x: 760, y: 1180, s: 0.85 } }));
const duskPlate = () => xPlate('duskRiver', 10, ax => BX.riversideScene(ax, 64, { dusk: 0.95, sun: [300, 990], house: { x: 600, y: 1170, s: 0.9 } }));
function shake(T, t0, amp, dec = 3) {
  const k = T - t0; if (k < 0) return [0, 0];
  const e = amp * Math.exp(-k * dec);
  return [Math.sin(k * 71) * e, Math.cos(k * 53) * e * 0.8];
}
function ripples(ctx, T, x, y, s, n = 3, seed = 1) {
  ctx.save(); ctx.lineWidth = 2.5 * s;
  for (let i = 0; i < n; i++) {
    const f = ((T * 0.55 + i / n + seed * 0.13) % 1);
    ctx.strokeStyle = `rgba(255,214,170,${0.45 * (1 - f)})`;
    ctx.beginPath(); ctx.ellipse(x, y, (60 + f * 160) * s, (10 + f * 26) * s, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
const KITCHEN_DUSK = 0.5;
// stove front + top (wide view): redrawn over a cook standing behind the stove
function stoveClip(ctx) {
  ctx.beginPath(); ctx.moveTo(190, 936); ctx.lineTo(890, 936); ctx.lineTo(944, 1068); ctx.lineTo(944, 1432); ctx.lineTo(136, 1432); ctx.lineTo(136, 1068); ctx.closePath();
}
function kitchenWithCook(ctx, T, drawCook, o = {}) {
  const k = BX.kitchenInterior(ctx, T, { view: 'wide', dusk: KITCHEN_DUSK, fire: o.fire ?? 1, smoke: 1 });
  drawCook(k);
  ctx.save(); stoveClip(ctx); ctx.clip();
  BX.kitchenInterior(ctx, T, { view: 'wide', dusk: KITCHEN_DUSK, fire: o.fire ?? 1, smoke: 0, beams: false });
  ctx.restore();
  return k;
}

// =====================================================================================
// s16 44.16–47.04: the tourist dumps the whole bowl → XÈÈÈÈO!!! mushroom of steam, hair blown, foggy glasses
// =====================================================================================
const PAN_R = [705, 1003];
function s16(ctx, lt, p, T) {
  const B0 = ctx.getTransform();
  const [sx, sy] = shake(T, 44.16, 22, 2.2), [sx2, sy2] = shake(T, 45.12, 8, 4);
  const z = lerp(1.1, 1.24, ease.inOut(p));
  let fogK = 0;
  cam(ctx, 600 + sx + sx2, 880 + sy + sy2, z, 0.004 * Math.sin(lt * 9) * Math.exp(-lt * 1.5), () => {
    kitchenWithCook(ctx, T, () => {
      const hb = ease.out(inv(44.16, 44.45, T)) * (0.75 + 0.25 * Math.sin(T * 23));
      const tip = lerp(0.85, 1, ease.out(inv(44.16, 44.5, T)));
      fogK = inv(44.4, 44.6, T);
      BX.tourist(ctx, 545, 1255, 1.28, {
        t: T, stand: true, pose: 'dumpBowl', k: tip, apron: true, vest: false, fill: 0,
        expr: fogK > 0 ? 'foggy' : 'wow', hairBlown: hb,
      });
    });
    // batter already in the pan, edges frying instantly
    BX.crepeStage(ctx, PAN_R[0], PAN_R[1] + 4, 0.68, { ryr: 0.31, batter: 1, cook: 0.1 + 0.3 * inv(44.2, 47, T), meat: 1, searing: 1, t: T, seed: 7 });
    // last of the batter sliding out of the bowl
    const tail = inv(44.2, 44.75, T);
    if (tail < 1) BX.pourStream(ctx, 660, 860, PAN_R[0] - 20, PAN_R[1], T, { col: 'batter', w: 26, k: 1, tail, splash: true, seed: 3 });
    BX.oilSparkle(ctx, T, PAN_R[0], PAN_R[1] - 20, 1.1, { n: 22, w: 320, h: 70, seed: 9 });
    glow(ctx, PAN_R[0], PAN_R[1] - 40, 380, 'rgba(255,170,80,0.9)', 0.35 + 0.25 * Math.exp(-lt * 2));
    const ek = ease.out(inv(44.16, 45.3, T));
    BX.steamEruption(ctx, T, PAN_R[0], PAN_R[1], 0.78, ek, { mushroom: true, sun: true, seed: 4 });
    BX.steamEruption(ctx, T + 0.4, PAN_R[0] - 60, PAN_R[1] - 10, 0.5, ease.out(inv(44.2, 45.6, T)), { seed: 11, alpha: 0.7 });
  });
  // shock rings
  const rk = T - 44.16;
  if (rk < 0.5) { ctx.save(); ctx.strokeStyle = `rgba(255,236,190,${0.7 * (1 - rk / 0.5)})`; ctx.lineWidth = 14 * (1 - rk / 0.5); ctx.beginPath(); ctx.ellipse(700, 960, 120 + rk * 1400, 40 + rk * 420, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  const wk = inv(44.16, 44.42, T);
  BX.sizzleWord(ctx, 500, 330, 1.18, { t: T, k: wk + inv(44.42, 47, T) * 0.3, vi: 'XÈÈÈÈO!!!', en: 'SIZZZZLE!!!', shake: 1 - 0.7 * inv(44.6, 46.5, T), rot: -0.06, out: inv(46.6, 47.0, T) });
}

// =====================================================================================
// s17 47.04–49.92: CHEF FLIP – the crêpe sails out of the kitchen window, slow motion against the sunset
// =====================================================================================
const FLIP0 = 47.04, FLIP1 = 47.46, LAUNCH_K = 0.6, OUT_T = 47.86;
function panC(k, SY) {
  const e = ease.inOut(k), a = lerp(0.45, -0.55, e), g = [lerp(60, 96, e), lerp(SY + 96, SY + 10, e)];
  return { a, c: [g[0] + Math.cos(a) * 92, g[1] + Math.sin(a) * 92] };
}
function s17(ctx, lt, p, T) {
  const B0 = ctx.getTransform();
  if (T < OUT_T) {
    const k = ease.out(inv(FLIP0, FLIP1, T));
    let P0 = null, Wn = null;
    const [sx, sy] = shake(T, FLIP0 + 0.25, 10, 5);
    cam(ctx, 640 + sx, 820 + sy, lerp(1.18, 1.1, inv(FLIP0, OUT_T, T)), 0, () => {
      kitchenWithCook(ctx, T, (kit) => {
        BX.tourist(ctx, 545, 1255, 1.28, {
          t: T, stand: true, pose: 'flip', k, apron: true, vest: false, hairBlown: 0.35,
          poseFn: (P) => ({
            front: () => {
              const pc = panC(k, P.SY), pl = panC(LAUNCH_K, P.SY);
              BX.miniPan(ctx, pc.c, pc.a, 46, k < LAUNCH_K);
              P0 = mapper(ctx, B0)(pl.c);
              if (k > 0.5) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(pc.c[0] - 40, pc.c[1] + 30, 90 + i * 18, -1.4 - i * 0.05, -0.4); ctx.stroke(); } }
            },
          }),
        });
        Wn = mapper(ctx, B0)([kit.window.x + (kit.window.w || 0) * 0, kit.window.y]);
      });
      BX.oilSparkle(ctx, T, 380, 990, 0.9, { n: 10, w: 280, h: 50, seed: 2 });
      BX.smokeWisp(ctx, T, 705, 990, 1, { seed: 5, alpha: 0.6 });
    });
    // the flying crêpe (screen space): launch → out through the window
    const tl = FLIP0 + LAUNCH_K * (FLIP1 - FLIP0);
    if (T >= tl && P0) {
      const u = ease.inOut(inv(tl, OUT_T, T));
      const W1 = Wn || [820, 500];
      const C = [lerp(P0[0], W1[0], 0.3), Math.min(P0[1], W1[1]) - 260];
      const x = (1 - u) * (1 - u) * P0[0] + 2 * u * (1 - u) * C[0] + u * u * W1[0];
      const y = (1 - u) * (1 - u) * P0[1] + 2 * u * (1 - u) * C[1] + u * u * W1[1];
      BX.flyingCrepe(ctx, x, y, lerp(0.42, 0.16, u), { t: T, spin: (T - tl) * 22, trail: 0.8, vx: W1[0] - P0[0], vy: -0.6, tilt: 0.45 });
    }
    lineFit(ctx, T, 47.2, OUT_T + 0.1, 'Hấp!', 'HUP!', { y: 1500, vsize: 70 });
    return;
  }
  // ---- outside: slow motion against the sunset ----
  const lk = inv(OUT_T, 49.92, T);
  cam(ctx, 540, 960 + lk * 40, lerp(1.08, 1.0, lk), 0, () => {
    BX.riversideScene(ctx, T, { dusk: 0.5, horizon: 1300, sun: [560, 1150], sunS: 1.6, flare: 0.8, house: null, garden: false });
  });
  godRays(ctx, 560, 1180, -Math.PI / 2, 1.6, 1300, 9, 'rgba(255,200,120,0.8)', 0.14, T);
  const x = lerp(330, 660, ease.out(lk)), y = lerp(900, 700, ease.out(lk)) + Math.sin(lk * 3) * 20;
  glow(ctx, x, y, 420, 'rgba(255,190,90,0.8)', 0.45);
  BX.flyingCrepe(ctx, x, y, lerp(1.25, 1.45, lk), { t: T * 0.25, spin: 1.2 + lk * 1.6, trail: 0.25, tilt: 0.42, rot: -0.12, vx: 1, vy: -0.4 });
  // little bits floating around it (slow-mo)
  const r = rng(77);
  ctx.save();
  for (let i = 0; i < 18; i++) {
    const a = r() * TAU, d = 260 + r() * 260, sp = (r() - 0.5) * 0.4;
    const px = x + Math.cos(a + lk * sp) * d, py = y + Math.sin(a + lk * sp) * d * 0.7 + lk * 30 * (r() - 0.3);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(120,200,90,0.9)' : 'rgba(255,214,120,0.95)';
    ctx.save(); ctx.translate(px, py); ctx.rotate(a + lk * 2 * sp); ctx.fillRect(-7, -3, 14, 6); ctx.restore();
  }
  ctx.restore();
  BX.sparkles(ctx, T, x, y, 1.6, { n: 7, seed: 3, r: 300, alpha: 0.9 });
  dust(ctx, T * 0.3, 171, 26, 0, 200, W, 1300, '255,230,180', 2.6, 0.5);
  lineFit(ctx, T, 48.3, 49.85, 'Bay luôn rồi!', 'It… FLEW away!', { y: 1520 });
}

// =====================================================================================
// s18 49.92–52.8: wide river – crêpe frisbee, boatman ducks, duck line follows; silent freeze 51.84 (everyone looks up)
// =====================================================================================
const FZ = 51.84;
function crepePath18(u) {
  const P0 = [-220, 620], C = [460, 1560], P2 = [760, 520];
  return [(1 - u) * (1 - u) * P0[0] + 2 * u * (1 - u) * C[0] + u * u * P2[0], (1 - u) * (1 - u) * P0[1] + 2 * u * (1 - u) * C[1] + u * u * P2[1]];
}
function s18(ctx, lt, p, T) {
  const Tf = Math.min(T, FZ), frozen = T >= FZ;
  const u = ease.inOut(inv(49.92, FZ, Tf));
  BX.riversideScene(ctx, Tf, { dusk: 0.56, sun: [250, 960], sunS: 1.2, flare: 0.5, house: { x: 820, y: 1130, s: 0.62 } });
  // the boatman in his xuồng (ducks as the crêpe skims over)
  const bx = 420, by = 1360;
  ripples(ctx, T, bx, by + 8, 1.2, 3, 1);
  const dk = ease.inOut(inv(50.55, 50.78, Tf)) * (1 - ease.inOut(inv(51.25, 51.6, Tf)));
  BX.boatmanRow(ctx, bx, by, 0.42, { t: Tf, phase: 0.2, duck: dk, boat: true, flip: false });
  // duck line paddling after the crêpe
  const lead = lerp(80, 560, ease.inOut(inv(49.92, FZ, Tf)));
  for (let i = 0; i < 4; i++) ripples(ctx, T, lead - i * 105, 1612, 0.45, 2, i + 3);
  BX.duckLine(ctx, Tf, lead, 1610, 0.95, 4, { spacing: 105, pose: 'swim', follow: 1 });
  if (frozen) {
    // everyone looks up: little "!" over the ducks and the boatman
    for (let i = 0; i < 4; i++) bang(ctx, lead - i * 105 + 10, 1500, 0.7, 1);
    bang(ctx, bx + 40, 1080, 0.9, 1);
  }
  const cp = crepePath18(u);
  const cp2 = crepePath18(Math.min(1, u + 0.02));
  BX.flyingCrepe(ctx, cp[0], cp[1], lerp(0.5, 0.62, u), { t: Tf, spin: Tf * 10, trail: frozen ? 0.2 : 0.9, tilt: 0.4, vx: cp2[0] - cp[0] + 0.001, vy: cp2[1] - cp[1] });
  if (frozen) {
    BX.sparkles(ctx, T, cp[0], cp[1], 1, { n: 6, seed: 8, r: 160, alpha: 0.9 });
    // freeze-frame hint: soft dark vignette ring
    ctx.save(); ctx.globalAlpha = 0.18 * inv(FZ, FZ + 0.2, T); ctx.fillStyle = '#100818'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}
function bang(ctx, x, y, s, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s, s);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '90px BodySansBold';
  ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(40,16,6,0.9)'; ctx.strokeText('!', 0, 0); ctx.fillStyle = '#ffe6b0'; ctx.fillText('!', 0, 0);
  ctx.restore();
}

// =====================================================================================
// s19 52.8–56.64: perfect landing (folded!) on Má Tư's plate; three quacks; the tourist applauds then bows
// =====================================================================================
const QK = [53.28, 53.76, 54.24];
function deckBg(ctx, T) {
  BX.sunsetSky(ctx, 0, 1040, { t: T, sun: [880, 990], sunS: 1.3, flare: 0.5, dusk: 0.52, clouds: 6, seed: 9 });
  BX.sunsetWater(ctx, 1040, 1560, T, { sunX: 880, dusk: 0.52 });
  // far bank silhouette
  ctx.save(); ctx.fillStyle = 'rgba(52,26,52,0.9)';
  ctx.beginPath(); ctx.moveTo(0, 1046);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 1040 - 14 - Math.abs(Math.sin(x * 0.013)) * 22 - (x % 160 < 40 ? 10 : 0));
  ctx.lineTo(W, 1046); ctx.closePath(); ctx.fill(); ctx.restore();
  // deck planks
  const g = ctx.createLinearGradient(0, 1540, 0, H); g.addColorStop(0, '#7a4a2c'); g.addColorStop(1, '#3e2214');
  ctx.fillStyle = g; ctx.fillRect(0, 1540, W, H - 1540);
  ctx.strokeStyle = 'rgba(30,14,8,0.55)'; ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) { const y = 1540 + Math.pow(i / 8, 1.6) * 380; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,180,110,0.35)'; ctx.fillRect(0, 1540, W, 4);
  // rail posts
  ctx.fillStyle = '#4a2a18';
  for (let x = 30; x < W; x += 250) ctx.fillRect(x, 1400, 22, 145);
  ctx.fillRect(0, 1400, W, 14);
  ctx.fillStyle = 'rgba(255,190,120,0.45)'; ctx.fillRect(0, 1400, W, 3);
}
function s19(ctx, lt, p, T) {
  const [sx, sy] = shake(T, 52.8, 14, 6);
  cam(ctx, 540 + sx, 960 + sy, lerp(1.04, 1.1, ease.inOut(p)), 0, () => {
    deckBg(ctx, T);
    // ducks in the water behind the rail, quacking on the beats
    const dx = [110, 215, 320];
    const dr = [];
    for (let i = 0; i < 3; i++) {
      const q = T >= QK[i] && T < QK[i] + 0.36;
      ripples(ctx, T, dx[i], 1300, 0.4, 2, i);
      dr.push(BX.duck(ctx, dx[i], 1300 + Math.sin(T * 3 + i) * 3, 0.85, { t: T, pose: q ? 'quack' : 'swim', ph: i * 0.7 }));
    }
    // Má Tư with the plate
    const land = clamp(lt / 0.32);
    const bounce = Math.sin(land * Math.PI) * (1 - land) * 1.0;
    BX.maTu(ctx, 430, 1880, 1.38, {
      t: T, pose: 'plate', expr: lt < 0.6 ? 'calm' : T < 54.6 ? 'laugh' : 'talk', plateAt: [430, 1880 - 1.38 * 300],
      hold: (c, pp) => {
        BX.plate(c, pp.x, pp.y, 0.5, { view: '3q', shadow: false });
        BX.banhXeo(c, pp.x, pp.y - 14 - bounce * 30, 0.5 * (1 + bounce * 0.25), { view: '3q', fold: 1, crisp: 1, steam: 1, t: T, rot: 0.05 });
      },
    });
    // the tourist: applauds, then bows
    const bowK = ease.inOut(inv(54.7, 55.2, T));
    BX.tourist(ctx, 800, 1890, 1.22, {
      t: T, stand: true, flip: true, vest: false,
      pose: T < 54.7 ? 'applaud' : 'bow', k: T < 54.7 ? (T * 2.08) % 1 : bowK, expr: T < 54.7 ? 'wow' : undefined,
    });
    for (let i = 0; i < 3; i++) {
      const k = inv(QK[i], QK[i] + 0.14, T), out = inv(QK[i] + 0.9, QK[i] + 1.2, T);
      if (k > 0 && out < 1 && dr[i] && dr[i].beak) BX.quack(ctx, dr[i].beak[0], dr[i].beak[1] - 10, 0.62 + i * 0.06, { k, t: T, out });
    }
  });
  // landing impact
  const lk = T - 52.8;
  if (lk < 0.6) {
    BX.sparkles(ctx, T, 430, 1440, 1.2, { n: 8, seed: 12, r: 220, alpha: 1 - lk / 0.6 });
    ctx.save(); ctx.strokeStyle = `rgba(255,240,200,${0.8 * (1 - lk / 0.6)})`; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.ellipse(430, 1460, 140 + lk * 500, 40 + lk * 140, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  lineFit(ctx, T, 54.5, 56.55, 'Bánh xèo phải gấp vầy nè!', 'THIS is how you fold it!', { y: 340 });
}

// =====================================================================================
// s20 56.64–60.48: wrap in a mustard leaf, dip, CRUNCH (58.0), eye macro sparkle, thumbs up
// =====================================================================================
const TBL1 = 57.6, CR = 58.0, EYE0 = 58.38, EYE1 = 59.22;
function tableTop(ctx, T) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6a3e22'); g.addColorStop(1, '#3a2010');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(24,10,4,0.4)'; ctx.lineWidth = 4;
  for (let x = -40; x < W; x += 180) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60, H); ctx.stroke(); }
  glow(ctx, 260, 300, 900, 'rgba(255,170,90,0.7)', 0.35);
}
function s20(ctx, lt, p, T) {
  if (T < TBL1) {
    // top-down table insert: the crêpe on its plate, herbs, nước mắm – the wrap rolls up then dips
    const z = lerp(1.05, 1.15, inv(56.64, TBL1, T));
    cam(ctx, 540, 960, z, 0, () => {
      tableTop(ctx, T);
      BX.herbBasket(ctx, 860, 420, 0.95, { view: 'top', fill: 1, seed: 2 });
      BX.plate(ctx, 330, 560, 0.9, { view: 'top' });
      BX.banhXeo(ctx, 330, 560, 0.85, { view: 'top', fold: 1, crisp: 1, bite: 0.35, steam: 0.6, t: T, rot: -0.3 });
      const sb = BX.fishSauceBowl(ctx, 780, 1480, 1.25, { view: 'top', fill: 1, chili: 1, garlic: 1, t: T });
      const wk = ease.inOut(inv(56.64, 57.2, T));
      const mv = ease.inOut(inv(57.15, 57.45, T)), dip = inv(57.35, 57.5, T);
      const wx = lerp(470, 760, mv), wy = lerp(1080, 1440, mv) - Math.sin(mv * Math.PI) * 120 + dip * 30;
      BX.leafWrap(ctx, wx, wy, 1.25, { k: wk, rot: lerp(0, 0.7, mv), dip: dip, seed: 4 });
      BX.sparkles(ctx, T, 330, 560, 1, { n: 5, seed: 6, r: 200, alpha: 0.7 });
    });
    lineFit(ctx, T, 56.7, TBL1, 'Cuốn lá cải, chấm nước mắm', 'Wrap in mustard leaf, dip', { y: 1250, vsize: 58 });
    return;
  }
  if (T >= EYE0 && T < EYE1) {
    // eye macro: pupils dilate, the crêpe sparkles in the iris
    const k = inv(EYE0, EYE1, T);
    PE.eyeMacro(ctx, 540, 900, lerp(1.05, 1.15, k), { pupil: lerp(0.3, 0.6, ease.out(clamp(k * 3))), open: 1, t: T, brow: 0.6,
      reflect: (c) => BX.banhXeo(c, 30, 30, 0.5, { view: 'side', fold: 1, crisp: 1, t: T }) });
    BX.sparkles(ctx, T, 620, 820, 1.6, { n: 8, seed: 21, r: 260, alpha: 1 });
    sparkle(ctx, 640, 800, 2.2, 0.9 * (0.6 + 0.4 * Math.sin(T * 20)));
    lineFit(ctx, T, 58.45, 60.4, 'Giòn quá trời!', 'So CRUNCHY!', { y: 1420, thump: 1 });
    return;
  }
  const afterEye = T >= EYE1;
  const [sx, sy] = shake(T, CR, 24, 4);
  plateBg(ctx, sunsetPlate(), 560, 1000, 1.3);
  let wrapAt = null;
  const B0 = ctx.getTransform();
  cam(ctx, 540 + sx, 960 + sy, afterEye ? lerp(1.0, 1.06, inv(EYE1, 60.48, T)) : lerp(1.12, 1.2, inv(TBL1, EYE0, T)), 0, () => {
    if (!afterEye) {
      const k = T < CR ? lerp(0.35, 1, ease.in(inv(TBL1, CR, T))) : 1;
      const r = BX.tourist(ctx, 540, 1780, 2.45, { t: T, pose: 'wrapBite', k, vest: false, stool: true, expr: T >= CR ? 'crunch' : undefined });
      if (r && r.wrap) wrapAt = mapper(ctx, B0)(r.wrap);
    } else {
      BX.tourist(ctx, 540, 1800, 2.25, { t: T, pose: 'thumbs', vest: false, stool: true, k: 0.5 });
    }
  });
  if (!afterEye) {
    const m = wrapAt || [600, 1000];
    if (T >= CR) {
      BX.crumbBurst(ctx, T, CR, m[0], m[1], 1.4, { n: 34, seed: 5, spread: 1.3 });
      BX.crunchWord(ctx, 500, 430, 1.15, { t: T, k: inv(CR, CR + 0.2, T) + 0.2 * inv(CR + 0.2, EYE0, T), shake: 1, rot: 0.06 });
    }
  } else {
    BX.sparkles(ctx, T, 540, 900, 1.4, { n: 7, seed: 31, r: 380, alpha: 0.8 });
    lineFit(ctx, T, 58.45, 60.4, 'Giòn quá trời!', 'So CRUNCHY!', { y: 330, thump: 1 });
  }
}

// =====================================================================================
// s21 60.48–64.8: dusk wide – lanterns on, both eating on the deck, ducks gliding home; end card
// =====================================================================================
function s21(ctx, lt, p, T) {
  const k = ease.inOut(p);
  const z = lerp(1.35, 1.0, k);
  const sc = BX.riversideScene(ctx, T, {
    dusk: lerp(0.82, 1, k), sun: [260, 1010], sunS: 1.1, flare: 0.25, lights: true,
    house: { x: 600, y: 1170, s: 0.9 }, cam: { zoom: z, cx: lerp(560, 540, k), cy: lerp(1060, 960, k) },
    mid: (c) => drawDeckPeople(c, T, { x: 600, y: 1170, s: 0.9 }),
  });
  // ducks gliding home in front
  const dx = lerp(-60, 420, k);
  for (let i = 0; i < 4; i++) ripples(ctx, T, dx - i * 95, 1712, 0.42, 2, i + 7);
  BX.duckLine(ctx, T, dx, 1710, 0.85, 4, { spacing: 95, pose: 'swim', follow: 1 });
  dust(ctx, T, 281, 28, 0, 900, W, 900, '255,220,160', 2.2, 0.5);
  X.endCard(ctx, T, 60.48, { l1: 'BÁNH XÈO', l2: 'MIỀN TÂY', vi: 'Đổ xèo. Gấp giòn. Cuốn lá cải!', en: 'Pour. Sizzle. Wrap & crunch!' });
}
// people on the deck, drawn from riversideScene's mid() (world coords: stool feet = house origin + HA.stools*s)
function drawDeckPeople(c, T, h) {
  const s = 0.3 * h.s, dy = h.y - 140 * h.s;
  const a = [h.x - 215 * h.s, dy], b = [h.x - 5 * h.s, dy];
  BX.maTu(c, a[0], a[1], s, { t: T, pose: 'laugh', sit: true, stool: false, expr: 'laugh' });
  BX.tourist(c, b[0], b[1], s, { t: T, pose: 'wrapBite', k: 0.5 + 0.5 * Math.sin(T * 4), vest: false, stool: false, flip: true });
}

// =====================================================================================
// s22 64.8–69.6: CTA over the blurred dusk riverside – LIKE (64.8), FOLLOW (press 65.76), wink 66.24, question, fade
// =====================================================================================
function s22(ctx, lt, p, T) {
  const dk = inv(64.8, 65.4, T);
  plateBg(ctx, duskPlate(), 560, 1050, lerp(1.25, 1.35, p));
  ctx.fillStyle = `rgba(8,4,12,${0.2 + 0.35 * dk})`; ctx.fillRect(0, 0, W, H);
  // tourist pops up from the bottom: grin, thumbs-up + wink on 66.24
  const rise = ease.outBack(inv(64.8, 65.4, T));
  const wink = T > 66.24 && T < 66.72 ? 0.05 : 1;
  const fy = 1570 + (1 - rise) * 500 + Math.sin(T * TAU / 0.96) * 4;
  PE.face(ctx, 650, fy, 0.62, { turn: 0.05, open: 1, openR: wink, mouth: 'smile', mOpen: 0.4, brow: wink < 1 ? 0.4 : 0, blush: 0.5, t: T, glassesY: -178 });
  const th = ease.outBack(inv(66.24, 66.56, T));
  if (T > 66.24) PE.thumbsUp(ctx, 905, fy - 60 + (1 - th) * 500, 0.8, -0.15 + Math.sin(T * 5) * 0.04);
  // Má Tư peeks in from the left (laughing)
  const cu = ease.outBack(inv(65.3, 65.8, T));
  if (cu > 0) BX.maTuFace(ctx, 250 - (1 - cu) * 450, 1700, 0.5, { expr: 'laugh', t: T, turn: 0.35, look: [0.6, -0.3] });
  ctaLike(ctx, T, 64.8, 64.8, 330, 760);
  ctaFollow(ctx, T, 65.28, 65.76, 700, 760);
  ctaHand(ctx, T, 65.76, 700, 760);
  biText(ctx, X.fadeIO(T, 65.28, 69.12, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  const ca = X.fadeIO(T, 66.24, 69.12, 0.4, 0.4);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    const g = ctx.createLinearGradient(0, 960, 0, 1170); g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.5, 'rgba(8,4,2,0.6)'); g.addColorStop(1, 'rgba(8,4,2,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 960, W, 210); ctx.restore();
    biText(ctx, ca, 1035, 'Bạn ăn bánh xèo bằng tay hay dĩa?', 'Hands or fork? Tell us below!', { vsize: 52, esize: 38, bd: false });
  }
  logo(ctx, X.fadeIO(T, 66.0, 69.12, 0.5, 0.4), 1210);
  const fb = inv(69.12, 69.6, T); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s16, s17, s18, s19, s20, s21, s22 };
