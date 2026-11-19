'use strict';
// Nem nướng Cái Răng – shots 21..28 (Act IV: the wake splits the boats, cây bẹo delivery, the bite + flavour burst,
// reunion, the whole market's "DZÔ!", crane-up end card, LIKE + FOLLOW CTA). 100 BPM: beat 0.6 s.
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, inv, ease, at, glow, flare, godRays, dust, sparkle, createCanvas } = L;
const PE = require('./people');
const NP = require('./nprops');
const X = require('./text');
const CAP_Y = X.CAP_Y;
const BEAT = 0.6;
const beat = T => ((T / BEAT) % 1 + 1) % 1;            // 0 on the beat
const hit = (T, sharp = 6) => Math.exp(-beat(T) * sharp); // 1 on the beat, decays

// =====================================================================================
// text / CTA helpers (ported from banhtrangtron/shotsC.js; fitted to the safe zone x 70..930)
// =====================================================================================
function backdrop(ctx, a, y = CAP_Y) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y - 170, 0, y + 190);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(8,4,2,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
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
// like button: pops in at t0, the tap lands on tTap, then the heart thumps on every beat (0.6 s)
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
  const g = ctx.createLinearGradient(0, 0, 0, 1050); g.addColorStop(0, 'rgba(10,5,2,0.8)'); g.addColorStop(0.75, 'rgba(10,5,2,0.6)'); g.addColorStop(1, 'rgba(10,5,2,0)');
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
  ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; fitFont(ctx, o.vi, 54, 'BodySansBold', MW); ctx.fillText(o.vi, 0, 140);
  ctx.letterSpacing = '2px'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; fitFont(ctx, o.en, 38, 'BodySans', MW); ctx.fillText(o.en, 0, 200);
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
// big bilingual pop word (count-in / DZÔ!)
function popWord(ctx, T, t0, t1, x, y, vi, en, o = {}) {
  const a = X.fadeIO(T, t0, t1, 0.08, 0.2);
  if (a <= 0) return;
  const sc = 0.4 + 0.6 * ease.outBack(inv(t0, t0 + 0.25, T));
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(sc, sc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.letterSpacing = '2px';
  fitFont(ctx, vi, o.vsize || 120, 'BodySansBold', 820);
  ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(40,16,6,0.85)'; ctx.strokeText(vi, 0, 0);
  ctx.fillStyle = o.vcol || '#ffe6b0'; ctx.fillText(vi, 0, 0);
  fitFont(ctx, en, o.esize || 50, 'BodySansBold', 820);
  ctx.lineWidth = 9; ctx.strokeText(en, 0, (o.vsize || 120) * 0.72);
  ctx.fillStyle = '#ffffff'; ctx.fillText(en, 0, (o.vsize || 120) * 0.72);
  ctx.restore();
}

// =====================================================================================
// scene helpers
// =====================================================================================
// NP drawers return DEVICE coords (mapper bakes in getTransform). Under cam() map them back to user space.
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
// camera that never shows outside the 1080x1920 canvas (clamps the look-at point for zoom + roll)
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
    bx.drawImage(a, 0, 0);               // opaque under-layer so blurred edges don't go dark
    bx.filter = `blur(${blur}px)`; bx.drawImage(a, 0, 0); bx.filter = 'none';
    BGC[key] = b;
  }
  return BGC[key];
}
function plate(ctx, img, cx, cy, z, rot = 0) { cam(ctx, cx, cy, z, rot, () => ctx.drawImage(img, 0, 0)); }
const riverPlate = () => xPlate('river', 9, ax => NP.riverSide(ax, 70, 0, { horizon: 980, sunX: 700, sunY: 760, mist: 0.6, farBoats: true, fgY: 2000 }));
const marketPlate = () => xPlate('market', 14, ax => NP.floatingMarket(ax, 84, { zoom: 0.45, sun: 0.6, gold: 0.7 }));

// boat geometry (native units, mirrors nprops) and the VISIBLE cap rail (cubic used by hullPath's drawing)
const BG = {
  coUt: { Lh: 640, gun: 84, st: 112, bw: 146, deck: -42 },
  xuong: { Lh: 440, gun: 54, st: 70, bw: 82, deck: -22 },
};
function railY(b, xn) {
  const c2 = (-b.gun + 0.125 * (b.st + b.bw)) / 0.75, u = clamp(xn / b.Lh + 0.5), a = 1 - u;
  return -(a * a * a * b.st + 3 * a * a * u * c2 + 3 * a * u * u * c2 + u * u * u * b.bw);
}
function toWorld(bx, by, s, flip, sway, xn, yn) {
  const k = s * NP.BK, x0 = (flip ? -xn : xn) * k, y0 = yn * k, c = Math.cos(sway || 0), sn = Math.sin(sway || 0);
  return [bx + x0 * c - y0 * sn, by + x0 * sn + y0 * c];
}
// gentle bob on the beat
const beatBob = (T, s) => -5 * s * hit(T, 4);

// Cô Út's boat (left, bow → right) + the tourist's xuồng (right, flipped, bow → left), tourist straddling the gap.
// o: s, cx (foot midpoint x at rest), y (waterline), gap 0..1, liftL/liftR (px), swayL/swayR, coUt{}, tourist{}, boatman{}
const FOOT_C = 0.3, FOOT_X = 0.3;
function boatsScene(ctx, T, o) {
  const s = o.s, k = s * NP.BK, gap = o.gap || 0;
  const span = o.span ?? s * lerp(230, 470, gap);
  const fLx = o.cx - span / 2, fRx = o.cx + span / 2;
  const bx1 = fLx - FOOT_C * BG.coUt.Lh * k + (o.dxL || 0), bx2 = fRx + FOOT_X * BG.xuong.Lh * k + (o.dxR || 0);
  const by1 = o.y + (o.liftL || 0) + (o.dyL || 0), by2 = o.y + (o.liftR || 0) + (o.dyR || 0);
  const swL = o.swayL || 0, swR = o.swayR || 0;
  const cb = { t: T, bob: 0, rock: 0, sway: swL, embers: o.embers ?? true, cook: 0.9, glow: 0.6 };
  const xb = { t: T, bob: 0, rock: 0, sway: swR, flip: true, people: false };
  const ret = {};
  // far boat first when the xuồng sits behind (o.xuongBack)
  const drawCoUt = () => {
    const r = U(ctx, NP.coUtBoat(ctx, bx1, by1, s, Object.assign({}, cb, { part: 'back' })));
    ret.coBoat = r;
    if (o.coUt !== false) ret.co = U(ctx, NP.coUt(ctx, r.stool[0], r.stool[1], s, Object.assign({ t: T }, o.coUt || {})));
    NP.coUtBoat(ctx, bx1, by1, s, Object.assign({}, cb, { part: 'front' }));
  };
  const drawXuong = () => {
    const r = U(ctx, NP.xuongBaLa(ctx, bx2, by2, s, Object.assign({}, xb, { part: 'back' })));
    ret.xBoat = r;
    if (o.boatman) {
      const p = toWorld(bx2, by2, s, true, swR, -150, BG.xuong.deck);
      ret.man = U(ctx, NP.boatman(ctx, p[0], p[1], s, Object.assign({ t: T, flip: true }, o.boatman)));
    }
    if (o.touristSeat) ret.tour = U(ctx, NP.tourist(ctx, r.seat[0], r.seat[1], s, Object.assign({ t: T }, o.touristSeat)));
    NP.xuongBaLa(ctx, bx2, by2, s, Object.assign({}, xb, { part: 'front' }));
  };
  if (o.xuongBack) { drawXuong(); drawCoUt(); } else { drawCoUt(); drawXuong(); }
  // standing tourist, one foot on each rail
  if (o.tourist) {
    const fL = toWorld(bx1, by1, s, false, swL, FOOT_C * BG.coUt.Lh, railY(BG.coUt, FOOT_C * BG.coUt.Lh) - 3);
    const fR = toWorld(bx2, by2, s, true, swR, FOOT_X * BG.xuong.Lh, railY(BG.xuong, FOOT_X * BG.xuong.Lh) - 3);
    const ox = (fL[0] + fR[0]) / 2, oy = (fL[1] + fR[1]) / 2;
    ret.feet = [fL, fR];
    ret.tour = U(ctx, NP.tourist(ctx, ox, oy, s, Object.assign({ t: T, pose: 'split', footL: [(fL[0] - ox) / s, (fL[1] - oy) / s], footR: [(fR[0] - ox) / s, (fR[1] - oy) / s] }, o.tourist)));
  }
  ret.bx1 = bx1; ret.bx2 = bx2; ret.by1 = by1; ret.by2 = by2;
  return ret;
}
// cây bẹo aimed so its tip lands near 'tip' (base computed off-screen), string + giant roll hung at (rx, ry)
function poleRoll(ctx, tip, rx, ry, rs, rot, o = {}) {
  const ps = o.ps || 1.55, len = o.len || 760, a = o.angle ?? 0.8, Lw = len * ps;
  const bx = tip[0] - Math.sin(a) * Lw, by = tip[1] + Math.cos(a) * Lw;
  const tp = unmap(ctx)(NP.beoPole(ctx, bx, by, ps, { len, angle: a, bend: 0.03, t: o.t || 0, w: 20, seed: 3 }));
  ctx.save(); ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tp[0], tp[1]); ctx.lineTo(rx + Math.sin(rot) * 20, ry - 105 * rs); ctx.stroke(); ctx.restore();
  NP.giantRoll(ctx, rx, ry, rs, rot, { t: o.t || 0, bite: o.bite || 0, tie: true, steam: o.steam ?? 1 });
  return tp;
}
// wave lift for a boat at x given the crest x
const liftAt = (x, cx, amp, w = 380) => -amp * Math.exp(-Math.pow((x - cx) / w, 2));

// warm-up (keeps the first rendered frame of each shot fast)
(function warm() {
  const c = createCanvas(64, 64), x = c.getContext('2d');
  try { NP.coUtBoat(x, 0, 0, 0.1, { t: 0 }); NP.xuongBaLa(x, 0, 0, 0.1, { t: 0 }); } catch (e) { /* optional */ }
})();

// =====================================================================================
// s21 63.0–66.0: a motorboat's wake splits the boats; the tourist ends up in the splits. "Ơ ơ ơ…!"
// =====================================================================================
function s21(ctx, lt, p, T) {
  const sh = T > 63.75 ? 16 * Math.exp(-(T - 63.75) * 2.2) : 0;
  const shx = Math.sin(T * 53) * sh, shy = Math.cos(T * 41) * sh * 0.8, shr = Math.sin(T * 37) * sh * 0.0012;
  const z = lerp(1.34, 1.42, ease.inOut(p));
  cam(ctx, 400 + shx, 1250 + shy, z, shr, () => {
    const HZ = 820;
    NP.riverSide(ctx, T, lt * 30, {
      horizon: HZ, sunX: 640, mist: 0.5, gold: 0.3,
      mid: (c) => {
        // the culprit: a long-tail motorboat roaring right → left in the background
        const mk = inv(63.0, 65.2, T), mx = lerp(1250, -300, mk), my = HZ + 45, ms = 0.17;
        if (mk > 0 && mk < 1) {
          NP.boatWake(c, mx + 320 * ms * NP.BK, my, ms * 2.2, T, { dir: -1, len: 900, strength: 1, seed: 21 });
          NP.motorBoat(c, mx, my, ms, { t: T, flip: true, speed: 1, smoke: 1, bob: 2 });
        }
      },
    });
    // the swell rolls in from the right
    const wk = inv(63.25, 64.9, T), crestX = lerp(1500, -500, wk);
    const s = 0.62, Y0 = 1430 + beatBob(T, s) * (T < 63.6 ? 1 : 0.3);
    const gap = ease.inOut(inv(63.65, 65.0, T)) + Math.sin((T - 65) * 6) * 0.03 * clamp((T - 65) * 4);
    const amp = 70 * Math.sin(Math.PI * clamp(wk));
    const footMid = 610;
    const lR = liftAt(960, crestX, amp), lL = liftAt(220, crestX, amp);
    const slopeR = (liftAt(1020, crestX, amp) - liftAt(900, crestX, amp)) / 120, slopeL = (liftAt(280, crestX, amp) - liftAt(160, crestX, amp)) / 120;
    // swell body behind the hulls
    if (wk > 0 && wk < 1) NP.bigWave(ctx, crestX, Y0 + 30, 0.9, 0.25 + wk * 0.5, { amp: 0.8, w: 1100, dir: -1, breaking: 0.6, t: T, seed: 21 });
    const r = boatsScene(ctx, T, {
      s, cx: footMid, y: Y0, gap, liftL: lL, liftR: lR, swayL: Math.atan(slopeL) * 0.8 - gap * 0.04, swayR: Math.atan(slopeR) * 0.8 + gap * 0.05,
      coUt: { pose: 'fan', expr: T < 64.4 ? 'calm' : 'laugh', turn: 0.4, look: [0.9, -0.2] },
      tourist: T < 63.7 ? { expr: 'wow', look: -0.2 } : { look: 0.1 },
    });
    // spray between the hulls as they part, whoosh lines on the tourist
    const sk = inv(63.85, 64.9, T);
    if (sk > 0 && sk < 1) NP.splash(ctx, footMid, Y0 + 10, 0.9, sk, { seed: 7 });
    const wwk = inv(63.7, 64.6, T);
    if (wwk > 0 && wwk < 1 && r.tour && r.tour.head) NP.waveWhoosh(ctx, r.tour.head[0] + 120, r.tour.head[1] + 40, 0.8, wwk, { dir: -1, seed: 4 });
    // front lip of the swell sliding past the hulls
    if (wk > 0 && wk < 1) NP.bigWave(ctx, crestX + 120, Y0 + 70, 0.7, 0.25 + wk * 0.5, { amp: 0.45, w: 900, dir: -1, breaking: 1, t: T, seed: 22 });
    NP.ripples(ctx, 0, 1500, W, 420, T, { seed: 210, n: 22, alpha: 0.4 });
  });
  lineFit(ctx, T, 63.6, 65.9, 'Ơ ơ ơ…!', 'Whoa whoa whoa…!', { thump: 1 });
}

// =====================================================================================
// s22 66.0–69.0: Cô Út, unbothered, threads the roll on the cây bẹo and swings it across. "Để cô đưa!"
// =====================================================================================
function s22(ctx, lt, p, T) {
  const z = lerp(1.28, 1.34, ease.inOut(p));
  cam(ctx, 530 + lt * 6, 1250, z, 0, () => {
    NP.riverSide(ctx, T, 160 + lt * 20, { horizon: 860, sunX: 760, mist: 0.5, gold: 0.35 });
    const s = 0.7, Y0 = 1490 + beatBob(T, s);
    const ext = ease.inOut(inv(66.5, 68.4, T));
    const r = boatsScene(ctx, T, {
      s, cx: 790, y: Y0, gap: 1, span: s * (465 + Math.sin(T * 3) * 6),
      swayL: Math.sin(T * 1.1) * 0.01, swayR: 0.04 + Math.sin(T * 1.7) * 0.02, dyR: Math.sin(T * 1.7) * 6,
      embers: true,
      coUt: {
        pose: 'pole', poleLen: 800,
        poleAngle: lerp(0.12, 0.93, ext), bend: 0.05 + 0.04 * ext, swing: -0.25 * ext + Math.sin(T * 2.2) * 0.05 * ext,
        expr: T < 67.6 ? 'calm' : 'smile', turn: 0.35, look: [0.7, -0.5 + ext * 0.4],
      },
      tourist: { look: -0.5, expr: T > 68.2 ? 'wow' : undefined },
    });
    // the roll on its string, drawn after the tourist so it hangs in front of his face
    if (r.co && r.co.tool) {
      const tp = r.co.tool, sl = 120 * s, sw = Math.sin(T * 2.3) * 0.12 * (1 - ext) + Math.sin(T * 3.1) * 0.03;
      const ex = tp[0] + Math.sin(sw) * sl, ey = tp[1] + Math.cos(sw) * sl;
      ctx.save(); ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(tp[0], tp[1]); ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore();
      NP.giantRoll(ctx, ex + Math.sin(sw) * 60 * s, ey + 70 * s, 0.3 * s, sw * 0.6, { t: T, tie: true, steam: 1 });
      if (T < 66.8) sparkle(ctx, ex, ey + 40, 60, 1 - inv(66.2, 66.8, T));
    }
    NP.ripples(ctx, 0, 1400, W, 520, T, { seed: 220, n: 22, alpha: 0.4 });
  });
  lineFit(ctx, T, 66.3, 68.9, 'Để cô đưa!', 'I got you!', { thump: 1 });
}

// =====================================================================================
// s23 69.0–72.0: the roll dangles toward his mouth in slow motion; 71.4–72.0 total stillness (only water moves). No text.
// =====================================================================================
function s23(ctx, lt, p, T) {
  const tF = Math.min(T, 71.4);                         // frozen clock for everything but the water
  const tS = 69 + (tF - 69) * 0.45;                      // slow-motion clock
  const z = 1.18 + 0.08 * ease.inOut(inv(69, 71.4, tF));
  plate(ctx, riverPlate(), 560, 940, z);
  NP.ripples(ctx, 0, 1080, W, 840, T, { seed: 230, n: 30, alpha: 0.35 });
  dust(ctx, tS, 231, 30, 0, 200, W, 1300, '255,230,180', 2.4, 0.5);
  glow(ctx, 760, 760, 520, 'rgba(255,190,120,0.5)', 0.8);
  // face: panic → wide-eyed wow, eyes locked on the roll
  const fx = 610, fy = 820, fs = 1.5;
  const lookX = -0.55 + 0.35 * inv(69, 71.4, tF);
  const fr = U(ctx, NP.touristFace(ctx, fx, fy, fs, { expr: tF < 69.9 ? 'panic' : 'wow', t: tS, lookX, lookY: 0.15, turn: -0.08 }) || {});
  const mouth = fr.mouth || [fx, fy + 140 * fs];
  // the cây bẹo glides in from the lower-left; the roll stops ~100 px short of his lips and hangs there
  const ap = ease.out(inv(69.0, 71.4, tF)), rs = 0.45, half = 300 * rs;
  const sw = Math.sin(tS * 2.4) * 0.1 * (1 - ap);
  const rx = lerp(-260, mouth[0] - 100 - half, ap), ry = mouth[1] + 10 + Math.sin(tS * 3) * 8 * (1 - ap);
  poleRoll(ctx, [rx - 40 + sw * 200, ry - 260], rx, ry, rs, sw * 0.5, { t: tS, angle: lerp(0.7, 0.85, ap) });
  // breath-held stillness: soft pull-in during the silence
  const sil = inv(71.4, 71.6, T);
  if (sil > 0) {
    ctx.fillStyle = NP.rgr(ctx, 560, 860, 300, 560, 860, 1300, [[0, 'rgba(0,0,0,0)'], [1, `rgba(10,6,4,${0.35 * sil})`]]);
    ctx.fillRect(0, 0, W, H);
  }
}

// =====================================================================================
// s24 72.0–75.0: CHOMP (flash 72.0) → glow ring → four flavours, one per beat
// =====================================================================================
const FL_T = [72.6, 73.2, 73.8, 74.4];
const FL = [['Thơm!', 'Smoky!', '#8a8fa3'], ['Giòn!', 'Crunchy!', '#e5a03a'], ['Mát!', 'Fresh!', '#5fae4a'], ['Béo!', 'Rich!', '#e0702a']];
function s24(ctx, lt, p, T) {
  const z = lerp(1.3, 1.38, ease.inOut(p)) * (1 + 0.015 * hit(T, 7));
  plate(ctx, riverPlate(), 620, 900, z);
  NP.ripples(ctx, 0, 1080, W, 840, T, { seed: 240, n: 26, alpha: 0.3 });
  glow(ctx, 540, 820, 700, 'rgba(255,190,110,0.55)', 0.9);
  const jit = T < 72.5 ? Math.exp(-(T - 72) * 8) : 0;
  const fx = 540 + Math.sin(T * 47) * 10 * jit, fy = 700 + jit * 10, fs = 1.35;
  const mx = fx, my = fy + 140 * fs;
  const expr = T < 72.12 ? 'wow' : T < 73.7 ? 'chew' : 'bliss';
  NP.touristFace(ctx, fx, fy, fs, { expr, t: T, blush: 0.4 + 0.5 * inv(72.5, 74.5, T), hairLift: 0.6 * jit });
  // the roll: bitten at 72.0 (its end touches his lips), then swings back a little while he chews
  const back = ease.out(inv(72.15, 72.8, T)), rs = 0.45;
  const rx = mx - 300 * rs + 8 - back * 70, ry = my + 6 + back * 24 + Math.sin(T * 2.2) * 6;
  const bite = T < 72.0 ? 0 : 0.35 + 0.1 * Math.min(3, Math.floor((T - 72.0) / 1.2));
  poleRoll(ctx, [rx - 50 - back * 30, ry - 280], rx, ry, rs, 0.04 - back * 0.08, { t: T, angle: 0.85, bite });
  // glow ring burst on the bite
  const gk = inv(72.0, 72.7, T);
  if (gk > 0 && gk < 1) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(255,226,170,${0.9 * (1 - gk)})`; ctx.lineWidth = 26 * (1 - gk) + 4;
    ctx.beginPath(); ctx.arc(mx, my, 80 + 420 * ease.out(gk), 0, TAU); ctx.stroke();
    ctx.restore();
    glow(ctx, mx, my, 360, 'rgba(255,220,160,1)', 0.7 * (1 - gk));
  }
  // flavour icons (one quadrant per beat) + bilingual pills
  const LP = [[220, 380], [820, 380], [820, 1300], [220, 1300]];
  const QX = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  FL_T.forEach((t0, i) => {
    const pi = ease.out(inv(t0, t0 + 0.5, T));
    if (pi <= 0) return;
    ctx.save(); ctx.beginPath();
    ctx.rect(QX[i][0] < 0 ? mx - 1000 : mx, QX[i][1] < 0 ? my - 1000 : my, 1000, 1000); ctx.clip();
    NP.flavorBurst(ctx, mx, my, 1.2, i * 0.08 + 0.5 * pi, { labels: false });
    ctx.restore();
    const pop = ease.outBack(inv(t0 + 0.05, t0 + 0.3, T));
    flavorLabel(ctx, LP[i][0], LP[i][1] + Math.sin(T * 3 + i) * 6, FL[i][0], FL[i][1], FL[i][2], clamp((T - t0) / 0.15), 0.6 + 0.4 * pop);
  });
  if (T > 72.0 && T < 72.4) sparkle(ctx, mx - 120, my - 40, 80, 1 - inv(72.0, 72.4, T));
}

// =====================================================================================
// s25 75.0–78.0: the boatman hooks the boats back together; tourist hugs his belly; Cô Út thumbs up. "Ngon hết sẩy!"
// =====================================================================================
function s25(ctx, lt, p, T) {
  const z = lerp(1.06, 1.0, ease.inOut(p));
  cam(ctx, 540, 960, z, 0, () => {
    NP.riverSide(ctx, T, 300 + lt * 15, { horizon: 900, sunX: 600, mist: 0.45, gold: 0.45 });
    const s = 0.62, Y0 = 1290 + beatBob(T, s);
    const pull = ease.inOut(inv(75.1, 76.6, T));
    const r = boatsScene(ctx, T, {
      s, cx: 560, y: Y0, span: 0, xuongBack: false,
      dxL: -30, dxR: lerp(260, 0, pull), dyR: 90 + Math.sin(T * 1.6) * 4,
      swayL: Math.sin(T * 1.1) * 0.012, swayR: Math.sin(T * 1.6 + 1) * 0.015,
      coUt: { pose: 'thumbs', expr: T < 75.8 ? 'smile' : 'wink', turn: 0.35, look: [0.8, 0] },
      boatman: { pose: 'pull', k: 0.3 + 0.7 * pull },
      touristSeat: { pose: 'hug', expr: 'bliss' },
    });
    // a few hearts float up from the tourist
    if (r.tour && r.tour.head) {
      const hr = rng(25);
      for (let i = 0; i < 4; i++) {
        const k = ((T - 75.4) * 0.5 + i * 0.25) % 1; if (T < 75.4) continue;
        heart(ctx, r.tour.head[0] + (hr() - 0.5) * 140 + Math.sin(T * 3 + i) * 12, r.tour.head[1] - 60 - k * 260, 0.32 + hr() * 0.15, `rgba(254,60,90,${0.85 * Math.sin(k * Math.PI)})`);
      }
    }
    NP.ripples(ctx, 0, 1500, W, 420, T, { seed: 250, n: 24, alpha: 0.4 });
  });
  lineFit(ctx, T, 75.3, 77.9, 'Ngon hết sẩy!', 'Absolutely amazing!', { thump: 1 });
}

// =====================================================================================
// s26 78.0–81.0: the whole market raises its rolls: "Một, hai, ba… DZÔ!" on 78.6 / 79.2 / 79.8 / 80.4
// =====================================================================================
const CNT = [[78.6, 'Một,', 'One,'], [79.2, 'hai,', 'two,'], [79.8, 'ba…', 'three…'], [80.4, 'DZÔ!', 'CHEERS!']];
function s26(ctx, lt, p, T) {
  const step = CNT.reduce((n, c) => (T >= c[0] ? n + 1 : n), 0);
  const dz = T >= 80.4 ? ease.outBack(inv(80.4, 80.6, T)) : 0;
  const z = lerp(1.0, 1.05, ease.inOut(p)) * (1 + 0.02 * (T > 78.6 ? hit(T, 7) : 0));
  cam(ctx, 540, 960, z, 0, () => {
    NP.floatingMarket(ctx, T, { zoom: 0.55, sun: 0.45, gold: 0.5, mist: 0.4 });
    const raise = [0, 0.45, 0.65, 0.82, 1][step] * (0.85 + 0.15 * hit(T, 5));
    NP.crowdBoats(ctx, T, 1150, 0.36, { n: 4, seed: 26, raise, x0: -60, x1: 1140 });
    // foreground: Cô Út (left) and the tourist (right) in their boats, rolls raised
    const s = 0.6, Y0 = 1640 + beatBob(T, s);
    const lift = step >= 1 ? 1 : 0;
    boatsScene(ctx, T, {
      s, cx: 560, y: Y0, span: 0, dxL: -120, dxR: -60, dyR: 40,
      swayL: Math.sin(T * 1.1) * 0.01, swayR: Math.sin(T * 1.4) * 0.012,
      coUt: lift ? { pose: 'cheer', expr: 'laugh', turn: 0.3, look: [0.6, -0.6] } : { pose: 'wave', expr: 'smile', turn: 0.3 },
      touristSeat: lift ? { pose: 'cheer', look: -0.2 } : { pose: 'sit', expr: 'smile', look: -0.3 },
    });
    if (dz > 0) {
      const r = rng(260), k = inv(80.4, 81.0, T);
      for (let i = 0; i < 14; i++) sparkle(ctx, 80 + r() * 920, 820 + r() * 600 - k * 80, 30 + r() * 50, (1 - k) * 0.9);
    }
  });
  if (dz > 0) glow(ctx, 500, 520, 600, 'rgba(255,220,150,1)', 0.45 * (1 - inv(80.4, 80.9, T)));
  // building line at the top, newest word thumps
  const a = X.fadeIO(T, 78.3, 80.95, 0.25, 0.25);
  if (a > 0) {
    const vi = ['', 'Một,', 'Một, hai,', 'Một, hai, ba…', 'Một, hai, ba… DZÔ!'][step], en = ['', 'One,', 'One, two,', 'One, two, three…', 'One, two, three… CHEERS!'][step];
    if (step > 0) biText(ctx, a, 250, vi, en, { vsize: 66, esize: 42 });
  }
  // big pop words
  for (let i = 0; i < 3; i++) popWord(ctx, T, CNT[i][0], CNT[i + 1][0], 500, 560, CNT[i][1].replace(/[,…]/g, '') + '!', CNT[i][2].replace(/[,…]/g, '') + '!', { vsize: 130, esize: 54, rot: [-0.06, 0.05, -0.04][i] });
  popWord(ctx, T, 80.4, 81.2, 500, 580, 'DZÔ!', 'CHEERS!', { vsize: 190, esize: 70, vcol: '#ffd25a', rot: -0.05 });
}

// =====================================================================================
// s27 81.0–84.0: crane up over the market, the sun goes gold over the Cần Thơ river; end card at 82.2
// =====================================================================================
function s27(ctx, lt, p, T) {
  const k = ease.inOut(p);
  NP.floatingMarket(ctx, T, { zoom: lerp(0.5, 0.05, k), sun: lerp(0.4, 0.75, k), gold: lerp(0.4, 1, k), mist: 0.35 });
  const sy = lerp(640, 420, k);
  flare(ctx, 560, sy, 0.8, 0.35 * (1 - inv(82.2, 82.7, T) * 0.6));
  dust(ctx, T, 271, 36, 0, 300, W, 1300, '255,220,160', 2.6, 0.55);
  endCardFit(ctx, T, 82.2, { l1: 'NEM NƯỚNG', l2: 'CÁI RĂNG', vi: 'Nướng thơm. Cuốn chặt. Chấm đẫm!', en: 'Grilled. Rolled. Dipped!' });
}

// =====================================================================================
// s28 84.0–90.0: CTA over the blurred market – LIKE (tap 85.2), FOLLOW (87.0), question, logo, fade to black
// =====================================================================================
function s28(ctx, lt, p, T) {
  const dk = inv(84, 84.8, T);
  plate(ctx, marketPlate(), 560, 1000, lerp(1.25, 1.35, p));
  ctx.fillStyle = `rgba(8,4,2,${0.25 + 0.4 * dk})`; ctx.fillRect(0, 0, W, H);
  // tourist pops up from the bottom: grin, wink, thumbs-up
  const rise = ease.outBack(inv(84.0, 84.6, T));
  const wink = T > 86.6 && T < 87.0 ? 0.05 : 1;
  const fy = 1570 + (1 - rise) * 500 + Math.sin(T * TAU / 1.2) * 4;
  PE.face(ctx, 650, fy, 0.62, { turn: 0.05, open: 1, openR: wink, mouth: 'smile', mOpen: 0.4, brow: wink < 1 ? 0.4 : 0, blush: 0.5, t: T, glassesY: -178 });
  const th = ease.outBack(inv(85.6, 86.0, T));
  if (T > 85.6) PE.thumbsUp(ctx, 905, fy - 60 + (1 - th) * 500, 0.8, -0.15 + Math.sin(T * 5) * 0.04);
  // Cô Út peeks in from the left with a roll
  const cu = ease.outBack(inv(85.0, 85.6, T));
  if (cu > 0) NP.coUtFace(ctx, 250 - (1 - cu) * 450, 1700, 0.5, { expr: 'laugh', t: T, turn: 0.35, look: [0.6, -0.3] });
  ctaLike(ctx, T, 84.0, 85.2, 330, 760);
  ctaFollow(ctx, T, 85.6, 87.0, 700, 760);
  ctaHand(ctx, T, 87.0, 700, 760);
  biText(ctx, X.fadeIO(T, 84.1, 89.4, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  const ca = X.fadeIO(T, 86.0, 89.4, 0.4, 0.4);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    const g = ctx.createLinearGradient(0, 960, 0, 1170); g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.5, 'rgba(8,4,2,0.6)'); g.addColorStop(1, 'rgba(8,4,2,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 960, W, 210); ctx.restore();
    biText(ctx, ca, 1035, 'Bạn cuốn mấy cuốn một lần?', 'How many rolls can you eat?', { vsize: 56, esize: 38, bd: false });
  }
  logo(ctx, X.fadeIO(T, 85.8, 89.4, 0.5, 0.4), 1210);
  const fb = inv(89.4, 90, T); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s21, s22, s23, s24, s25, s26, s27, s28 };
