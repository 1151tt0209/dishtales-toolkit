'use strict';
// Hủ tiếu chợ nổi Cái Răng – shots 16..22 (T 45.0 → 70.0): "Hold my backpack!", the giant SLURP, the market freezes,
// the whole market slurps on the beat, flavour burst, drone end card, LIKE + FOLLOW CTA. 96 BPM: beat 0.625 s.
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, inv, ease, glow, flare, dust, sparkle, createCanvas } = L;
const PE = require('./people');
const HP = require('./hprops');
const NP = HP.NP;
const X = require('./text');
const CAP_Y = X.CAP_Y;
const BEAT = 0.625;
const beat = T => ((T / BEAT) % 1 + 1) % 1;            // 0 on the beat
const hit = (T, sharp = 6) => Math.exp(-beat(T) * sharp); // 1 on the beat, decays

// =====================================================================================
// text / CTA helpers (ported from nemnuong/shotsC.js; fitted to the safe zone x 70..930)
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
// like button: pops in at t0, tap lands on tTap, then the heart thumps on every beat (0.625 s)
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
function ctaHand(ctx, T, tp, x, y) {
  const k = T - (tp - 0.55); if (k < 0 || T > tp + 0.9) return;
  const appr = ease.out(clamp(k / 0.45)), back = ease.in(clamp((T - tp - 0.35) / 0.5));
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
// bilingual dialogue line (same look as X.line) with fitted fonts
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
// end card: X.endCard look, centred on x=500 and fitted into x 70..930
function endCardFit(ctx, T, t0, o = {}) {
  const k = T - t0;
  if (k < 0) return;
  const a = clamp(k / 0.5), MW = 800;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, 0, 0, 1050); g.addColorStop(0, 'rgba(10,5,2,0.72)'); g.addColorStop(0.75, 'rgba(10,5,2,0.5)'); g.addColorStop(1, 'rgba(10,5,2,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 1050);
  const sc = lerp(1.08, 1, ease.out(clamp(k / 1.2)));
  ctx.translate(500, 470); ctx.scale(sc, sc);
  const tg = ctx.createLinearGradient(0, -120, 0, 120);
  tg.addColorStop(0, '#fff4cf'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#b8762a');
  ctx.shadowColor = 'rgba(255,150,40,0.5)'; ctx.shadowBlur = 36; ctx.fillStyle = tg;
  ctx.letterSpacing = '6px'; fitFont(ctx, o.l1, o.s1 || 104, 'TitleSerif', MW); ctx.fillText(o.l1, 0, -70);
  ctx.letterSpacing = '16px'; fitFont(ctx, o.l2, o.s2 || 80, 'TitleSerif', MW); ctx.fillText(o.l2, 0, 30);
  ctx.shadowBlur = 0;
  const a2 = clamp((k - 0.5) / 0.5);
  ctx.globalAlpha = a * a2;
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; fitFont(ctx, o.vi, 54, 'BodySansBold', MW); ctx.fillText(o.vi, 0, 140);
  ctx.letterSpacing = '2px'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; fitFont(ctx, o.en, 38, 'BodySans', MW); ctx.fillText(o.en, 0, 200);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(-90, 250, 180, 3);
  ctx.font = '34px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,236,200,0.9)'; ctx.fillText('DISH TALES', 0, 296);
  ctx.restore();
}
// one flavour word (VN big cream, EN small white) in a dark pill outlined with the flavour colour
function flavorLabel(ctx, x, y, vi, en, col, a, pop) {
  if (a <= 0) return;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '62px BodySansBold'; ctx.letterSpacing = '2px'; const vw = ctx.measureText(vi).width;
  ctx.font = '36px BodySans'; const ew = ctx.measureText(en).width;
  const w = Math.max(vw, ew) + 56, h = 138;
  x = clamp(x, 70 + w / 2, 930 - w / 2); y = clamp(y, 140, 1480);
  ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(pop, pop);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2 + 4, w, h, 34); ctx.fillStyle = 'rgba(16,8,6,0.72)'; ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 6; ctx.strokeStyle = col; ctx.stroke();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.font = '62px BodySansBold'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText(vi, 0, -18);
  ctx.font = '36px BodySans'; ctx.letterSpacing = '1px'; ctx.fillStyle = '#ffffff'; ctx.fillText(en, 0, 36);
  ctx.restore();
}
// big bilingual comic word (outlined), optional jitter
function popWord(ctx, T, t0, t1, x, y, vi, en, o = {}) {
  const a = X.fadeIO(T, t0, t1, 0.08, 0.2);
  if (a <= 0) return;
  const sc = (o.sc0 ?? 0.4) + (1 - (o.sc0 ?? 0.4)) * ease.outBack(inv(t0, t0 + 0.25, T));
  const vs = o.vsize || 120, mw = o.maxW || 820;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.letterSpacing = '2px';
  const fv = fitFont(ctx, vi, vs, 'BodySansBold', mw);
  ctx.lineWidth = Math.max(8, fv * 0.12); ctx.strokeStyle = o.stroke || 'rgba(40,16,6,0.9)'; ctx.strokeText(vi, 0, 0);
  ctx.fillStyle = o.vcol || '#ffe6b0'; ctx.fillText(vi, 0, 0);
  fitFont(ctx, en, o.esize || 50, 'BodySansBold', mw);
  ctx.lineWidth = 9; ctx.strokeText(en, 0, fv * 0.74);
  ctx.fillStyle = '#ffffff'; ctx.fillText(en, 0, fv * 0.74);
  ctx.restore();
}

// =====================================================================================
// scene helpers
// =====================================================================================
function unmap(ctx) {
  const m = ctx.getTransform(), det = m.a * m.d - m.b * m.c;
  return (q) => { const x = q[0] - m.e, y = q[1] - m.f; return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det]; };
}
function U(ctx, r) {
  if (!r) return r;
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
const BGC = {};
function xPlate(key, blur, drawFn) {
  if (!BGC[key]) {
    const a = createCanvas(W, H), ax = a.getContext('2d');
    ax.fillStyle = '#000'; ax.fillRect(0, 0, W, H); drawFn(ax);
    const b = createCanvas(W, H), bx = b.getContext('2d');
    bx.drawImage(a, 0, 0);
    bx.filter = `blur(${blur}px)`; bx.drawImage(a, 0, 0); bx.filter = 'none';
    BGC[key] = b;
  }
  return BGC[key];
}
function plate(ctx, img, cx, cy, z, rot = 0) { cam(ctx, cx, cy, z, rot, () => ctx.drawImage(img, 0, 0)); }
// sunny river behind close-ups: blue sky, palms, glittering water (blurred = shallow depth of field)
const riverPlate = () => xPlate('sunRiver', 9, ax => {
  HP.riverSideDay(ax, 2, 0, { horizon: 1060, sunX: 250, sunY: 330, farBoats: true });
  // a couple of colourful out-of-focus ghe behind him
  NP.ghe(ax, 170, 1230, 0.32, { seed: 33, t: 2, people: true, pole: true });
  NP.ghe(ax, 930, 1250, 0.3, { seed: 36, t: 2, flip: true, people: true, pole: true });
});
const marketPlate = () => xPlate('sunMarket', 14, ax => HP.floatingMarketDay(ax, 2, { zoom: 0.45 }));
const toWorld = (bx, by, s, flip, sway, xn, yn) => {
  const k = s * NP.BK, x0 = (flip ? -xn : xn) * k, y0 = yn * k, c = Math.cos(sway || 0), sn = Math.sin(sway || 0);
  return [bx + x0 * c - y0 * sn, by + x0 * sn + y0 * c];
};

// orange backpack (≈ 200×260 at s=1, origin = top handle)
function backpack(ctx, x, y, s, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#3a2214'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 8, 22, Math.PI, 0); ctx.stroke(); // handle loop
  const g = ctx.createLinearGradient(-100, 0, 100, 0); g.addColorStop(0, '#e48a45'); g.addColorStop(0.55, '#c46a2b'); g.addColorStop(1, '#8a4418');
  ctx.beginPath(); ctx.roundRect(-96, 10, 192, 250, 50); ctx.fillStyle = g; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-96, 70); ctx.quadraticCurveTo(0, 40, 96, 70); ctx.lineTo(96, 110); ctx.quadraticCurveTo(0, 86, -96, 110); ctx.closePath();
  ctx.fillStyle = '#a4521f'; ctx.fill(); ctx.stroke(); // flap
  ctx.beginPath(); ctx.roundRect(-62, 150, 124, 86, 22); ctx.fillStyle = '#b55c24'; ctx.fill(); ctx.stroke(); // pocket
  ctx.fillStyle = '#e8d8b0'; ctx.fillRect(-8, 96, 16, 22); ctx.fillRect(-30, 158, 60, 6);
  ctx.strokeStyle = 'rgba(255,220,170,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-84, 50); ctx.quadraticCurveTo(-92, 140, -84, 230); ctx.stroke();
  ctx.restore();
}
// "!" stare mark (white comic bubble, red !)
function bang(ctx, x, y, s, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(a); ctx.translate(x, y); const sc = s * (0.6 + 0.4 * ease.outBack(clamp(a))); ctx.scale(sc, sc);
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 44, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#2a1408'; ctx.stroke();
  ctx.fillStyle = '#e02a1a'; ctx.beginPath(); ctx.moveTo(-9, -30); ctx.lineTo(9, -30); ctx.lineTo(5, 12); ctx.lineTo(-5, 12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 26, 8, 0, TAU); ctx.fill();
  ctx.restore();
}

// =====================================================================================
// the shared market stage (s17 / s18 / s19): one geography so the comedy reads
//   back row of ghe (vendors) · tourist's xuồng (right, boatman at the stern) · Dì Bảy's noodle boat (front-left)
// =====================================================================================
const MK = { hor: 1000, rowY: 1210, rowS: 0.34, rowX: [150, 560, 975], xx: 790, xy: 1600, xs: 0.6, dx: 300, dy: 1810, ds: 0.46 };
const MOUTH = [730, 1396], FACE = [730, 1378], DB_HEAD = [284, 1565], SL0 = 47.5;
// boats rock as the slurp shock ring passes them (decaying wobble)
function rockSway(T, x, y) {
  const d = Math.hypot(x - MOUTH[0], (y - MK.xy) / 0.26), tA = SL0 + 0.15 + d / 1500;
  const u = T - tA; if (u < 0) return 0;
  return 0.075 * Math.exp(-u * 1.5) * Math.sin(u * 10);
}
function vendorHead(i, sway = 0) {
  const x = MK.rowX[i], y = MK.rowY + (i % 2) * 14, fl = i % 2 === 1;
  return toWorld(x, y, MK.rowS, fl, sway, -40, -55 - 278 / NP.BK / 1);
}
const HERONS = [[110, 985, -40, 0.0], [255, 975, 55, 0.12], [905, 990, 70, 0.24]];
function herons(ctx, tH) {
  HERONS.forEach(([x0, y0, vx, d], i) => {
    const u = tH - (SL0 + 0.3 + d);
    if (u <= 0) { HP.heron(ctx, x0, y0, 0.3, { t: tH, pose: 'stand', flip: i === 0, ph: i }); return; }
    const x = x0 + vx * u * 1.6, y = y0 - 560 * (1 - Math.exp(-0.9 * u)) - 45 * u;
    HP.heron(ctx, x, y, 0.3 + 0.04 * u, { t: tH, pose: 'fly', flip: vx < 0, rot: -0.25 * Math.exp(-u), ph: i * 0.7 });
  });
}
function hatPos(tH) {
  const u = tH - (SL0 + 0.35); if (u < 0) return null;
  return [DB_HEAD[0] + 40 + 150 * u, DB_HEAD[1] - 60 - 720 * (1 - Math.exp(-1.25 * u)) + 10 * u * u, u * 7.5];
}
// o: tF (people/boat clock, frozen when constant), tH (herons + hat clock), tour{}, db{}, man{}, slV(i), bowls, bangs (time of stare)
function marketScene(ctx, T, o = {}) {
  const tF = o.tF ?? T, tH = o.tH ?? T, ret = {};
  HP.riverSideDay(ctx, T, 0, { horizon: MK.hor, sunX: 250, sunY: 300, rays: 0.35 });
  herons(ctx, tH);
  // back row of ghe
  ret.heads = [];
  MK.rowX.forEach((x, i) => {
    const y = MK.rowY + (i % 2) * 14, sd = 31 + i * 5, sway = rockSway(tF, x, y), sl = o.slV ? o.slV(i) : 0;
    NP.ghe(ctx, x, y, MK.rowS, { seed: sd, t: tF, flip: i % 2 === 1, sway, people: true, pole: true, cargo: true,
      vendorFn: (c, vx, vy, vs) => HP.vendorH(c, vx, vy, vs, { seed: sd, t: tF, item: o.bowls ? 'bowl' : undefined, slurp: sl, sit: false }) });
    ret.heads.push(vendorHead(i, sway));
  });
  NP.ripples(ctx, 0, MK.hor + 300, W, H - MK.hor - 300, T, { seed: 171, n: 22, alpha: 0.25 });
  // tourist's xuồng
  const xsw = rockSway(tF, MK.xx, MK.xy) * 0.8, xs = MK.xs;
  const xb = U(ctx, NP.xuongBaLa(ctx, MK.xx, MK.xy, xs, { t: tF, flip: true, people: false, sway: xsw, part: 'back' }));
  const bp = toWorld(MK.xx, MK.xy, xs, true, xsw, -150, -22);
  const man = U(ctx, NP.boatman(ctx, bp[0], bp[1], xs, Object.assign({ t: tF, flip: true, pose: 'stand' }, o.man || {})));
  ret.man = man;
  if (o.pack !== false) {
    const hd = man.handL[0] > man.handR[0] ? man.handL : man.handR;
    if (o.pack === 'deck') backpack(ctx, bp[0] - 70, bp[1] - 66, 0.3, -0.1);
    else backpack(ctx, hd[0] - 4, hd[1] - 6, 0.3, 0.06 + Math.sin(tF * 3) * 0.05 + xsw);
  }
  ret.tour = HP.tourist(ctx, xb.seat[0], xb.seat[1], xs, Object.assign({ t: tF, sweat: 0.35 }, o.tour || {}));
  NP.xuongBaLa(ctx, MK.xx, MK.xy, xs, { t: tF, flip: true, people: false, sway: xsw, part: 'front' });
  // Dì Bảy's noodle boat (front-left)
  const hb = HP.hutieuBoat(ctx, MK.dx, MK.dy, MK.ds, { part: 'back', t: tF, steam: o.steam ?? 0.6 });
  const hatGone = tH > SL0 + 0.35;
  ret.db = HP.diBay(ctx, hb.seat[0], hb.seat[1], MK.ds, Object.assign({ t: tF, potAt: hb.potRim, hat: hatGone ? false : undefined }, o.db || {}));
  HP.hutieuBoat(ctx, MK.dx, MK.dy, MK.ds, { part: 'front', t: tF, steam: o.steam ?? 0.6 });
  // flying nón lá
  const hp = hatPos(tH);
  if (hp) HP.flyingHat(ctx, hp[0], hp[1], 0.5, hp[2] * 0.15, { spin: hp[2] });
  // stare marks
  if (o.bangs != null) {
    const a = (d) => ease.outBack(inv(o.bangs + d, o.bangs + d + 0.18, T));
    ret.heads.forEach((h, i) => bang(ctx, h[0] + 10, h[1] - 70, 0.75, a(0.05 * i)));
    bang(ctx, ret.db.head[0] + 30, ret.db.head[1] - 120, 1.0, a(0.18));
    bang(ctx, man.head[0] - 20, man.head[1] - 90, 1.0, a(0.24));
  }
  ret.hb = hb;
  return ret;
}

// warm-up: build the plates + sprites at load so the first frame of each shot stays fast
(function warm() {
  const c = createCanvas(64, 64), x = c.getContext('2d');
  try { riverPlate(); marketPlate(); HP.riverSideDay(x, 0, 0, {}); } catch (e) { /* optional */ }
})();

// =====================================================================================
// s16 45.0–47.5: close-up. Glasses down (determined), backpack handed to the boatman, HUGE inhale.
//   "Giữ ba lô giùm!" / "Hold my backpack!"
// =====================================================================================
function torso(ctx, x, y, s, chest, strapA) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(0, 270); ctx.scale(chest, chest); ctx.translate(0, -270);
  ctx.beginPath(); ctx.moveTo(-360, 900); ctx.lineTo(-340, 620); ctx.quadraticCurveTo(-310, 300, -120, 270); ctx.lineTo(120, 270); ctx.quadraticCurveTo(310, 300, 340, 620); ctx.lineTo(360, 900); ctx.closePath();
  const sg = ctx.createLinearGradient(-330, 0, 330, 0); sg.addColorStop(0, '#46b8ae'); sg.addColorStop(0.6, PE.SHIRT); sg.addColorStop(1, '#1f6764');
  ctx.fillStyle = sg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,215,160,0.6)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-340, 620); ctx.quadraticCurveTo(-310, 300, -120, 270); ctx.stroke();
  // collar
  ctx.strokeStyle = '#1f6764'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-80, 278); ctx.quadraticCurveTo(0, 330, 80, 278); ctx.stroke();
  if (strapA > 0) {
    ctx.globalAlpha = strapA;
    ctx.fillStyle = '#5a4630'; ctx.beginPath(); ctx.roundRect(-230, 270, 46, 560, 14); ctx.fill(); ctx.beginPath(); ctx.roundRect(190, 270, 46, 560, 14); ctx.fill();
    ctx.fillStyle = '#3b2e20'; ctx.fillRect(-232, 400, 50, 16); ctx.fillRect(188, 400, 50, 16);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function s16(ctx, lt, p, T) {
  const z = lerp(1.0, 1.16, ease.inOut(p));
  plate(ctx, riverPlate(), 540, 1000, 1.18 + 0.05 * p);
  const inh = ease.inOut(inv(46.25, 47.35, T));          // inhale 0..1
  const gk = ease.inOut(inv(45.3, 45.7, T));             // glasses pulled down
  const pk = inv(45.9, 46.6, T);                         // backpack handover
  cam(ctx, 540, 1000, z, 0, () => {
    const fx = 540, fy = 930 - inh * 30, fs = 1.5, tilt = -0.09 * inh;
    torso(ctx, fx, fy + inh * 30, fs, 1 + 0.1 * inh, 1 - inv(46.05, 46.35, T));
    // the backpack (behind his right shoulder → yanked away by the boatman's hand)
    const pull = ease.inOut(clamp((pk - 0.25) / 0.75));
    const grab = [lerp(900, 1240, pull), lerp(1250, 980, pull)];
    if (pk < 1) backpack(ctx, grab[0] - 10 + (pk < 0.25 ? 0 : 0), grab[1] - 30, 1.25, 0.15 + pull * 0.4);
    const expr = T < 45.7 ? 'neutral' : 'determined';
    const face = { glassesY: lerp(-178, 0, gk), hairLift: 0.7 * inh, tilt };
    if (inh > 0.02) Object.assign(face, { mouth: 'o', mOpen: 0.25 + 0.5 * inh });
    HP.touristFace(ctx, fx, fy, fs, { expr, t: T, sweat: 0.4, tilt, face });
    // his hand pinches the glasses' bridge and slides them down
    const ha = inv(45.15, 45.3, T) * (1 - inv(45.75, 45.95, T));
    if (ha > 0) {
      const gy = fy + lerp(-178, 0, gk) * fs - 6, hx = fx + 20, hy = gy + 40 + (1 - ha) * 500;
      NP.capFS(ctx, hx + 240, hy + 520, hx + 40, hy + 80, 90, 64, PE.SKIN[1], 3);
      NP.capFS(ctx, hx + 340, hy + 900, hx + 240, hy + 520, 110, 92, PE.SKIN[1], 3);
      NP.cHand(ctx, hx, hy, 2.0, -1.9, { kind: 'pinch', skin: PE.SKIN });
    }
    // the boatman's grey-sleeved arm reaching in from the right
    const ma = ease.out(inv(45.85, 46.15, T)) * (1 - ease.in(inv(46.5, 46.85, T)));
    if (ma > 0) {
      const h = [lerp(1300, grab[0] - 30, ma), lerp(900, grab[1] - 60, ma)];
      NP.capFS(ctx, h[0] + 420, h[1] - 140, h[0] + 60, h[1] - 10, 70, 58, NP.COL.skinB ? NP.COL.skinB[1] : '#b8794e', 3);
      NP.capFS(ctx, h[0] + 700, h[1] - 230, h[0] + 380, h[1] - 130, 96, 88, '#a9abae', 3);
      NP.cHand(ctx, h[0], h[1], 1.8, Math.PI + 0.3, { kind: 'grip', skin: NP.COL.skinB, flip: true });
    }
    // glint when the shades drop
    if (T > 45.68 && T < 46.05) sparkle(ctx, fx + 110, fy - 10, 70, 1 - inv(45.68, 46.05, T));
    // air streaks being sucked into his mouth
    if (inh > 0) {
      const m = [fx, fy + 140 * fs], r = rng(1616);
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const a = r() * TAU, ph = (T * 1.8 + r()) % 1, d0 = 700 * (1 - ph) + 120, d1 = d0 - 160 - 120 * inh;
        if (d1 < 90) continue;
        ctx.strokeStyle = `rgba(255,255,255,${(0.25 + 0.5 * inh) * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 5 + 4 * r();
        ctx.beginPath(); ctx.moveTo(m[0] + Math.cos(a) * d0, m[1] + Math.sin(a) * d0 * 0.8); ctx.lineTo(m[0] + Math.cos(a) * d1, m[1] + Math.sin(a) * d1 * 0.8); ctx.stroke();
      }
      ctx.restore();
    }
  });
  lineFit(ctx, T, 45.85, 47.35, 'Giữ ba lô giùm!', 'Hold my backpack!', { y: 330 });
}

// =====================================================================================
// s17 47.5–50.0: SLUUURP! close on his face (shake) → pull out wide: noodles zip, bowl drains, rings cross the river,
//   boats rock, Dì Bảy's nón lá flies off, herons take off.
// =====================================================================================
function s17(ctx, lt, p, T) {
  const sh = Math.exp(-(T - SL0) * 1.6), out = ease.inOut(inv(48.15, 48.95, T));
  const z = lerp(3.3, 1.0, out);
  const jx = (Math.sin(T * 61) + Math.sin(T * 37)) * 16 * sh, jy = (Math.cos(T * 53) + Math.sin(T * 29)) * 14 * sh;
  const k = inv(SL0, 48.75, T);
  cam(ctx, lerp(FACE[0], 598, out) + jx / z, lerp(FACE[1] + 10, 1100, out) + jy / z, z * lerp(1, 1.12, out), Math.sin(T * 47) * 0.01 * sh, () => {
    const r = marketScene(ctx, T, {
      tour: { pose: 'slurp', k, zipK: k, broth: 1 - k, noodles: k < 0.98 ? 1 : 0, lines: true, sweat: 0.5 },
      db: { pose: 'stand', expr: T < 48.0 ? 'calm' : 'laugh', look: [0.8, -0.2] },
      man: { expr: 'laugh' },
    });
    // bigger noodle rope on top of the pose's own zip (close-up reads)
    if (k < 0.95 && r.tour.bowl) HP.noodleZip(ctx, r.tour.bowl.center[0], r.tour.bowl.center[1] + 2, MOUTH[0], MOUTH[1], k, { n: 3, w: 2.2, t: T, whip: 1.2, bend: -0.2, lines: true, drops: true });
    // shock rings: small round ones at the mouth, wide flat ones across the water
    HP.slurpRings(ctx, MOUTH[0], MOUTH[1], 0.5, inv(SL0, 48.4, T), { n: 3, maxR: 260, ryr: 1 });
    HP.slurpRings(ctx, MOUTH[0], MK.xy + 6, 1, inv(SL0 + 0.1, 49.9, T), { n: 5, maxR: 1300, ryr: 0.26 });
  });
  // the big comic word, shaking, inside the safe zone
  const jit = 0.4 + 0.6 * sh;
  popWord(ctx, T, SL0 + 0.04, 49.9, 500 + Math.sin(T * 53) * 12 * jit, 420 + Math.cos(T * 41) * 10 * jit, 'SỤUUUP!', 'SLUUURP!',
    { vsize: 160, esize: 64, rot: Math.sin(T * 31) * 0.05 * jit, sc0: 0.2, vcol: '#ffe08a', maxW: 800 });
}

// =====================================================================================
// s18 50.0–52.5: the market freezes and stares. Close: the last noodle slaps his sunglasses (51.25).
//   51.875–52.5: total freeze (silence) — only the water keeps moving.
// =====================================================================================
const FZ = 50.0, FZ2 = 51.875;
function s18(ctx, lt, p, T) {
  if (T >= 50.9375 && T < FZ2) {
    // close-up: noodle whips up and slaps the glasses
    plate(ctx, riverPlate(), 600, 980, 1.22);
    const fx = 540, fy = 860, fs = 1.45, slap = T >= 51.25;
    const recoil = slap ? Math.exp(-(T - 51.25) * 7) : 0;
    const expr = slap ? 'noodleSlap' : 'slurp';
    torso(ctx, fx, fy, fs, 1, 0);
    HP.touristFace(ctx, fx + recoil * 18, fy - recoil * 10, fs, { expr, t: slap ? 51.3 : T, sweat: 0.4, tilt: -0.06 * recoil });
    // bowl at the bottom, held up to the chin
    const bx = 560, by = 1560;
    HP.huTieuBowl(ctx, bx, by, 1.5, { view: '3q', rot: -0.25, layers: 0, broth: 0.05, t: T, shadow: false });
    NP.cHand(ctx, bx - 230, by + 60, 2.2, -0.5, { kind: 'flat', skin: PE.SKIN });
    NP.cHand(ctx, bx + 230, by + 70, 2.2, Math.PI + 0.5, { kind: 'flat', skin: PE.SKIN, flip: true });
    // the last strand: whips up from the bowl towards the glasses
    if (!slap) {
      const u = ease.in(inv(50.95, 51.25, T)), tip = [lerp(bx - 20, fx + 70, u), lerp(by - 20, fy - 10, u)];
      const c1 = [bx + 160 * Math.sin(T * 20), lerp(by - 40, by - 380, u)];
      ctx.save(); ctx.lineCap = 'round';
      for (const [w, col] of [[22, 'rgba(120,100,70,0.5)'], [16, '#f4f0e0']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(bx - 10, by - 10); ctx.quadraticCurveTo(c1[0], c1[1], tip[0], tip[1]); ctx.stroke();
      }
      ctx.restore();
    } else {
      const sk = inv(51.25, 51.5, T);
      if (sk < 1) { glow(ctx, fx + 60, fy - 10, 260, 'rgba(255,255,255,0.9)', 0.6 * (1 - sk)); }
      // droplets flung off on impact
      const r = rng(1825), u = T - 51.25;
      ctx.save(); ctx.fillStyle = 'rgba(255,236,190,0.9)';
      for (let i = 0; i < 16; i++) { const a = r() * TAU, v = 300 + r() * 500; const x = fx + 60 + Math.cos(a) * v * u, y = fy + Math.sin(a) * v * u + 900 * u * u; if (u < 0.6) { ctx.beginPath(); ctx.arc(x, y, 7 + r() * 6, 0, TAU); ctx.fill(); } }
      ctx.restore();
      popWord(ctx, T, 51.25, 51.85, 300, 420, 'BẸP!', 'SLAP!', { vsize: 120, esize: 54, rot: -0.12, sc0: 0.3 });
    }
    return;
  }
  // wide, everything frozen (stare); herons + hat keep flying until the total freeze
  const tH = Math.min(T, FZ2);
  const fr = T >= FZ2, slapped = T >= 51.25;
  cam(ctx, 598, 1100, 1.12 + 0.03 * inv(50, 50.9, T), 0, () => {
    marketScene(ctx, T, {
      tF: FZ, tH,
      tour: { pose: 'slurp', k: 1, zipK: 1, broth: 0, noodles: 0, sweat: 0.5, expr: slapped ? 'noodleSlap' : 'slurp' },
      db: { pose: 'stand', expr: 'calm', look: [0.9, -0.3] },
      man: { expr: 'calm' },
      bangs: FZ + 0.05,
    });
  });
  if (fr) {
    // dead-silent pause: a faint cool "paused" cast, nothing moves but the water
    ctx.save(); ctx.fillStyle = 'rgba(30,50,80,0.12)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

// =====================================================================================
// s19 52.5–55.0: Dì Bảy grins and raises her bowl → the whole market slurps on 4 beats. "Cả chợ cùng húp!"
// =====================================================================================
const GB = [52.5, 53.125, 53.75, 54.375];
function s19(ctx, lt, p, T) {
  const out = ease.outExpo(inv(52.5, 53.2, T));
  const z = lerp(1.9, 1.0, out);
  const sl = T < 52.5 ? 0 : 0.25 + 0.75 * hit(T, 4.5);   // group slurp on the beat
  const hb = hit(T, 7);
  cam(ctx, lerp(DB_HEAD[0] + 40, 598, out), lerp(DB_HEAD[1] - 40, 1100, out) - 6 * hb, z * lerp(1, 1.12, out) * (1 + 0.012 * hb), 0, () => {
    const dbPose = T < 53.0 ? { pose: 'handBowl', to: [DB_HEAD[0] + 70, DB_HEAD[1] - 150], k: ease.outBack(inv(52.5, 52.85, T)), expr: 'laugh', layers: 7 }
      : { pose: 'slurp', slurpK: beat(T), expr: 'slurp', layers: 6 };
    const r = marketScene(ctx, T, {
      tH: 60, bowls: true, slV: () => sl, pack: 'deck',
      tour: { pose: 'slurp', k: 0.35 + 0.3 * sl, zipK: beat(T) * 0.9, broth: 0.6, sweat: 0.2 },
      db: dbPose,
      man: { pose: 'cheer', expr: 'laugh' },
    });
    // a ring from every boat on each beat
    const bk = beat(T);
    if (T >= 52.5) {
      HP.slurpRings(ctx, MOUTH[0], MK.xy + 6, 0.6, bk, { n: 2, maxR: 520, ryr: 0.26 });
      HP.slurpRings(ctx, DB_HEAD[0], MK.dy - 30, 0.6, bk, { n: 2, maxR: 520, ryr: 0.26 });
    }
  });
  // "SỤP!" pops on each beat, one per position
  const PP = [[300, 640, -0.1], [760, 560, 0.08], [220, 900, 0.1], [740, 860, -0.08]];
  GB.forEach((t0, i) => popWord(ctx, T, t0, t0 + 0.55, PP[i][0], PP[i][1], 'SỤP!', 'SLURP!', { vsize: 96, esize: 44, rot: PP[i][2], sc0: 0.3 }));
  lineFit(ctx, T, 52.65, 54.9, 'Cả chợ cùng húp!', 'The whole market slurps!', { y: 300, thump: 1 });
}

// =====================================================================================
// s20 55.0–58.75: bliss close-up; flavours one per beat; "Thêm tô nữa!" with the empty bowl; Dì Bảy: 2 fingers
// =====================================================================================
const FL_T = [55.625, 56.25, 56.875, 57.5];
const FL = [['Ngọt xương!', 'Rich!', '#e8c48a'], ['Dai!', 'Chewy!', '#f4f0e0'], ['Thơm tỏi!', 'Garlicky!', '#e5a03a'], ['Cay!', 'Spicy!', '#e0402a']];
function vSign(ctx, x, y, s, rot) {      // Dì Bảy's two raised fingers
  const SK = NP.COL.skinB || ['#d9a37a', '#b8794e', '#8a5634'];
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#3a2214'; ctx.lineWidth = 3;
  ctx.fillStyle = '#2f56b0'; ctx.beginPath(); ctx.roundRect(-34, 60, 68, 160, 20); ctx.fill(); ctx.stroke(); // sleeve
  ctx.fillStyle = SK[1];
  for (const [fx, a] of [[-14, -0.18], [12, 0.16]]) { ctx.save(); ctx.translate(fx, -10); ctx.rotate(a); ctx.beginPath(); ctx.roundRect(-10, -86, 20, 92, 10); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.beginPath(); ctx.roundRect(-32, -18, 64, 80, 24); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(24, 14, 13, 26, -0.6, 0, TAU); ctx.fill(); ctx.stroke(); // folded thumb
  ctx.restore();
}
function s20(ctx, lt, p, T) {
  const z = lerp(1.25, 1.32, ease.inOut(p)) * (1 + 0.012 * hit(T, 7));
  plate(ctx, riverPlate(), 600, 980, z);
  glow(ctx, 540, 900, 700, 'rgba(255,230,170,0.5)', 0.7);
  const raise = ease.outBack(inv(57.5, 57.95, T));
  const fx = 540, fy = 820 + raise * 20, fs = 1.32, mx = fx, my = fy + 140 * fs;
  torso(ctx, fx, fy, fs, 1, 0);
  HP.touristFace(ctx, fx, fy, fs, { expr: T < 57.55 ? 'bliss' : 'smile', t: T, tilt: Math.sin(T * 2) * 0.04 - 0.03, face: T < 57.55 ? {} : { mouth: 'grin', mOpen: 0.5, blush: 0.8 } });
  // flavour bursts (one quadrant per beat) + bilingual pills
  const LP = [[230, 330], [820, 330], [820, 1290], [230, 1290]];
  const QX = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const fade = 1 - inv(57.6, 57.85, T);
  FL_T.forEach((t0, i) => {
    const pi = ease.out(inv(t0, t0 + 0.5, T));
    if (pi <= 0 || fade <= 0) return;
    ctx.save(); ctx.globalAlpha = fade; ctx.beginPath();
    ctx.rect(QX[i][0] < 0 ? mx - 1000 : mx, QX[i][1] < 0 ? my - 1000 : my, 1000, 1000); ctx.clip();
    HP.flavorBurst(ctx, mx, my, 1.1, i * 0.08 + 0.5 * pi, { labels: false });
    ctx.restore();
    const pop = ease.outBack(inv(t0 + 0.05, t0 + 0.3, T));
    flavorLabel(ctx, LP[i][0], LP[i][1] + Math.sin(T * 3 + i) * 6, FL[i][0], FL[i][1], FL[i][2], clamp((T - t0) / 0.15) * fade, 0.6 + 0.4 * pop);
  });
  // he raises the empty bowl: "One more!"
  if (T > 57.5) {
    const bx = lerp(980, 800, raise), by = lerp(1500, 560, raise);
    NP.capFS(ctx, 1150, 1500, bx + 40, by + 120, 130, 96, PE.SHIRT, 3);
    HP.huTieuBowl(ctx, bx, by, 0.9, { view: 'side', rot: 0.15 * Math.sin(T * 9), layers: 0, broth: 0, t: T, shadow: false });
    NP.cHand(ctx, bx + 30, by + 120, 1.6, -1.7, { kind: 'grip', skin: PE.SKIN });
    if (T > 57.6 && T < 58.2) sparkle(ctx, bx - 60, by - 30, 70, 1 - inv(57.6, 58.2, T));
  }
  // Dì Bảy peeks in bottom-left and shows two fingers
  const cu = ease.outBack(inv(57.7, 58.1, T));
  if (cu > 0) {
    HP.diBayFace(ctx, 210 - (1 - cu) * 450, 1700, 0.6, { expr: 'laugh', t: T, turn: 0.35, look: [0.6, -0.3] });
    vSign(ctx, 400 - (1 - cu) * 450, 1520 + Math.sin(T * 6) * 6, 1.5, 0.15);
  }
  lineFit(ctx, T, 57.6, 58.65, 'Thêm tô nữa!', 'One more bowl!', { y: CAP_Y - 10, thump: 1 });
}

// =====================================================================================
// s21 58.75–65.0: drone pull-up over the sunny market; steam column from Dì Bảy's boat; end card at 60.0
// =====================================================================================
function s21(ctx, lt, p, T) {
  const k = ease.inOut(p);
  const zoom = lerp(0.55, 0.05, k);
  const fm = HP.floatingMarketDay(ctx, T, { zoom, rays: 0.5 });
  // hero pair rides low in frame while the drone climbs: Dì Bảy's noodle boat + the tourist's xuồng alongside
  const pr = fm.project(-14, 78), px = fm.project(24, 92);
  if (px) {
    const xs = px[2] * 0.026, sw = Math.sin(T * 1.6) * 0.012;
    const xb = U(ctx, NP.xuongBaLa(ctx, px[0], px[1], xs, { t: T, flip: true, people: false, sway: sw, part: 'back' }));
    HP.tourist(ctx, xb.seat[0], xb.seat[1], xs, { t: T, pose: 'cheer', k: 0.5 + 0.5 * Math.sin(T * 5) });
    NP.xuongBaLa(ctx, px[0], px[1], xs, { t: T, flip: true, people: false, sway: sw, part: 'front' });
  }
  if (pr) {
    const bs = pr[2] * 0.032;
    const hb = HP.hutieuBoat(ctx, pr[0], pr[1], bs, { part: 'back', t: T, steam: 0 });
    HP.diBay(ctx, hb.seat[0], hb.seat[1], bs, { t: T, pose: 'wave', expr: 'laugh', potAt: hb.potRim });
    HP.hutieuBoat(ctx, pr[0], pr[1], bs, { part: 'front', t: T, steam: 0 });
    HP.steamBurst(ctx, T, hb.potRim[0], hb.potRim[1], bs * 1.6, 1, { n: 14, sun: true, alpha: 0.85, w: 160 });
  }
  if (fm.sun) flare(ctx, fm.sun[0], fm.sun[1], 0.8, 0.3 * (1 - inv(60.0, 60.6, T) * 0.5));
  dust(ctx, T, 271, 30, 0, 300, W, 1300, '255,240,200', 2.4, 0.45);
  endCardFit(ctx, T, 60.0, { l1: 'HỦ TIẾU', l2: 'CHỢ NỔI', vi: 'Nóng hổi. Ngọt xương. Húp thật to!', en: 'Hot. Rich. Slurp loud!' });
}

// =====================================================================================
// s22 65.0–70.0: CTA over the blurred sunny market – LIKE (65.0), FOLLOW (press 66.25), question, wink 66.875, fade
// =====================================================================================
function s22(ctx, lt, p, T) {
  const dk = inv(65, 65.6, T);
  plate(ctx, marketPlate(), 560, 1000, lerp(1.25, 1.35, p));
  ctx.fillStyle = `rgba(8,4,2,${0.2 + 0.35 * dk})`; ctx.fillRect(0, 0, W, H);
  // tourist pops up from the bottom: grin, thumbs-up + wink on 66.875
  const rise = ease.outBack(inv(65.0, 65.6, T));
  const wink = T > 66.875 && T < 67.35 ? 0.05 : 1;
  const fy = 1570 + (1 - rise) * 500 + Math.sin(T * TAU / 1.25) * 4;
  PE.face(ctx, 650, fy, 0.62, { turn: 0.05, open: 1, openR: wink, mouth: 'smile', mOpen: 0.4, brow: wink < 1 ? 0.4 : 0, blush: 0.5, t: T, glassesY: -178 });
  const th = ease.outBack(inv(66.875, 67.2, T));
  if (T > 66.875) PE.thumbsUp(ctx, 905, fy - 60 + (1 - th) * 500, 0.8, -0.15 + Math.sin(T * 5) * 0.04);
  // Dì Bảy peeks in from the left (laughing)
  const cu = ease.outBack(inv(65.9, 66.4, T));
  if (cu > 0) HP.diBayFace(ctx, 250 - (1 - cu) * 450, 1700, 0.5, { expr: 'laugh', t: T, turn: 0.35, look: [0.6, -0.3] });
  ctaLike(ctx, T, 65.0, 65.0, 330, 760);
  ctaFollow(ctx, T, 65.625, 66.25, 700, 760);
  ctaHand(ctx, T, 66.25, 700, 760);
  biText(ctx, X.fadeIO(T, 65.625, 69.375, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  const ca = X.fadeIO(T, 66.875, 69.375, 0.4, 0.4);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    const g = ctx.createLinearGradient(0, 960, 0, 1170); g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.5, 'rgba(8,4,2,0.6)'); g.addColorStop(1, 'rgba(8,4,2,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 960, W, 210); ctx.restore();
    biText(ctx, ca, 1035, 'Bạn húp to hay ăn nhỏ nhẹ? Comment nhé!', 'Loud slurper or quiet sipper? Tell us!', { vsize: 52, esize: 38, bd: false });
  }
  logo(ctx, X.fadeIO(T, 66.6, 69.375, 0.5, 0.4), 1210);
  const fb = inv(69.375, 70, T); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s16, s17, s18, s19, s20, s21, s22 };
