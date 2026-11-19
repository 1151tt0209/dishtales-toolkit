// Phở Hà Nội – shots 21..28 (Act III comedy + climax 60–84s, CTA 84–90s). 80 BPM grid (beat 0.75s).
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, inv, ease, cam, at, glow, flare, godRays, dust, sparkle } = L;
const P = require('./props');
const PP = require('./pprops');
const PE = require('./people');
const X = require('./text');
const { SKIN } = PE;
const CAP_Y = X.CAP_Y;
const BEAT = 0.75;

// =====================================================================================
// local text / CTA helpers (copied from mixaogion/text.js; pho text.js does not export them)
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
function ctaLike(ctx, T, t0, x = 330, y = 760) {
  const k = T - t0; if (k < 0) return;
  const pop = ease.outBack(clamp(k / 0.45));
  const pulse = k > 0.45 ? 1 + 0.08 * Math.max(0, Math.sin(((k - 0.45) / BEAT) * Math.PI * 2)) : 1;
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15);
  ctx.beginPath(); ctx.arc(x, y, 105 * pop, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,10,8,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.stroke();
  heart(ctx, x, y + 12, 1.15 * pop * pulse, '#fe2c55');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '38px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.fillText('THÍCH', x, y + 150); ctx.font = '30px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('LIKE', x, y + 192);
  const f = clamp((k - 0.2) / 1.2);
  if (f > 0 && f < 1) { ctx.globalAlpha = Math.sin(f * Math.PI); ctx.font = '60px BodySansBold'; ctx.fillStyle = '#ff5c7a'; ctx.fillText('+1', x + 110, y - 90 - f * 120); }
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
  if (pk >= 0) confetti(ctx, T, tp, x, y);
}
function confetti(ctx, T, t0, x, y) {
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
// bilingual line (same look as X.line) but with fitFont so long lines stay inside x 70..930
function lineFit(ctx, T, t0, t1, vi, en, o = {}) {
  const a = X.fadeIO(T, t0, t1, 0.2, 0.3);
  if (a <= 0) return;
  const y = o.y || CAP_Y, sc = 0.9 + 0.1 * ease.outBack(clamp((T - t0) / 0.35));
  backdrop(ctx, a * 0.85, y);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(500, y); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 16;
  fitFont(ctx, vi, o.vsize || 62, o.serif ? 'TitleSerif' : 'BodySansBold', 820); ctx.fillStyle = o.vcol || '#fff2cf';
  ctx.fillText(vi, 0, 0);
  if (en) { fitFont(ctx, en, o.esize || 42, 'BodySans', 820); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(en, 0, 68); }
  ctx.restore();
}
// end card: same look as X.endCard, but centred on x=500 and every line fitted into the safe zone (x 70..930)
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
  ctx.letterSpacing = '6px'; fitFont(ctx, o.l1, o.s1 || 120, 'TitleSerif', MW); ctx.fillText(o.l1, 0, -78);
  ctx.letterSpacing = '16px'; fitFont(ctx, o.l2, o.s2 || 84, 'TitleSerif', MW); ctx.fillText(o.l2, 0, 30);
  ctx.shadowBlur = 0;
  const a2 = clamp((k - 0.5) / 0.5);
  ctx.globalAlpha = a * a2;
  ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; fitFont(ctx, o.vi, 54, 'BodySansBold', MW); ctx.fillText(o.vi, 0, 140);
  ctx.letterSpacing = '2px'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; fitFont(ctx, o.en, 38, 'BodySans', MW); ctx.fillText(o.en, 0, 200);
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(-90, 250, 180, 3);
  ctx.font = '34px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,236,200,0.9)'; ctx.fillText('DISH TALES', 0, 296);
  ctx.restore();
}

// =====================================================================================
// scene helpers
// =====================================================================================
const SKN = SKIN || ['#f2c6a8', '#e0a585', '#c98466'];
const SHIRT = PE.SHIRT || '#2fa39a';
// blurred warm stall background (dawnStreet with the stall centred, zoomed + depth of field)
function stallBg(ctx, T, o = {}) {
  const z = o.zoom || 2.0, blur = o.blur === undefined ? 8 : o.blur;
  P.layer(ctx, blur, (c) => {
    c.fillStyle = '#2a1a12'; c.fillRect(0, 0, W, H);
    cam(c, o.cx || 540, o.cy || 1180, z, 0, () => PP.dawnStreet(c, T, o.panX === undefined ? 960 : o.panX, { k: o.k === undefined ? 0.55 : o.k, steam: o.steam === undefined ? 0.8 : o.steam, fogA: o.fogA }));
  });
  if (o.warm !== false) { glow(ctx, o.gx || 540, o.gy || 900, 900, 'rgba(255,150,70,0.5)', o.warmA || 0.35); }
}
// wooden table surface seen from slightly above (fills y0..H)
function tableTop(ctx, y0, o = {}) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#7a4a2a'); g.addColorStop(0.15, '#9a6238'); g.addColorStop(1, '#4a2a16');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  ctx.strokeStyle = 'rgba(40,20,8,0.35)'; ctx.lineWidth = 3;
  const r = rng(o.seed || 88);
  for (let i = 0; i < 9; i++) { const yy = y0 + 20 + Math.pow(i / 9, 1.4) * (H - y0); ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(300, yy + (r() - 0.5) * 16, 700, yy + (r() - 0.5) * 16, W, yy + (r() - 0.5) * 10); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,220,170,0.35)'; ctx.fillRect(0, y0, W, 4);
  ctx.restore();
}
// teal sleeve + forearm from (x0,y0) to wrist (x1,y1)  (kept for far shots)
function arm(ctx, x0, y0, x1, y1, w = 1) {
  const mx = lerp(x0, x1, 0.45), my = lerp(y0, y1, 0.45);
  P.seg(ctx, x0, y0, mx, my, 120 * w, 96 * w, SHIRT);
  P.seg(ctx, mx, my, x1, y1, 84 * w, 66 * w, SKN[1]);
}
// 2-bone IK: elbow position for shoulder a, wrist b, bone lengths l1,l2; side = +1/-1 picks the bend
function ikPt(a, b, l1, l2, side = 1) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 1));
  const k = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - k * k));
  const ux = dx / Math.hypot(dx, dy || 1e-6), uy = dy / Math.hypot(dx, dy || 1e-6);
  return [a[0] + ux * k - uy * h * side, a[1] + uy * k + ux * h * side];
}
// elbow solution that points most along pref [px,py]
function ikPick(a, b, l1, l2, pref) {
  const e1 = ikPt(a, b, l1, l2, 1), e2 = ikPt(a, b, l1, l2, -1);
  const d1 = (e1[0] - a[0]) * pref[0] + (e1[1] - a[1]) * pref[1], d2 = (e2[0] - a[0]) * pref[0] + (e2[1] - a[1]) * pref[1];
  return d1 >= d2 ? e1 : e2;
}
// shaded skin limb segment (gradient across the limb)
function limb(ctx, a, b, w0, w1) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang), hw = Math.max(w0, w1) / 2;
  const g = ctx.createLinearGradient(a[0] + nx * hw, a[1] + ny * hw, a[0] - nx * hw, a[1] - ny * hw);
  g.addColorStop(0, SKN[2]); g.addColorStop(0.3, SKN[1]); g.addColorStop(0.65, SKN[0]); g.addColorStop(1, SKN[1]);
  P.seg(ctx, a[0], a[1], b[0], b[1], w0, w1, g);
}
// close-up arm: shoulder -> elbow -> wrist, shaded skin, teal short sleeve with hem
function armCU(ctx, sh, el, wr, s = 1) {
  ctx.save();
  ctx.shadowColor = 'rgba(50,20,8,0.45)'; ctx.shadowBlur = 18 * s; ctx.shadowOffsetX = -6 * s; ctx.shadowOffsetY = 8 * s;
  limb(ctx, el, wr, 96 * s, 72 * s);
  limb(ctx, sh, el, 122 * s, 100 * s);
  ctx.restore();
  // elbow crease + forearm muscle highlight
  ctx.save(); ctx.strokeStyle = 'rgba(140,70,45,0.45)'; ctx.lineWidth = 5 * s; ctx.lineCap = 'round';
  const ea = Math.atan2(wr[1] - el[1], wr[0] - el[0]);
  ctx.beginPath(); ctx.arc(el[0], el[1], 26 * s, ea + 2.2, ea + 3.2); ctx.stroke(); ctx.restore();
  // sleeve
  const sl = [lerp(sh[0], el[0], 0.36), lerp(sh[1], el[1], 0.36)], hm = [lerp(sh[0], el[0], 0.42), lerp(sh[1], el[1], 0.42)];
  const ang = Math.atan2(el[1] - sh[1], el[0] - sh[0]), nx = -Math.sin(ang), ny = Math.cos(ang);
  P.seg(ctx, sh[0], sh[1], hm[0], hm[1], 150 * s, 140 * s, '#1f6764');
  const g = ctx.createLinearGradient(sh[0] + nx * 90 * s, sh[1] + ny * 90 * s, sh[0] - nx * 90 * s, sh[1] - ny * 90 * s);
  g.addColorStop(0, '#1f6764'); g.addColorStop(0.45, SHIRT); g.addColorStop(0.8, '#46b8ae'); g.addColorStop(1, SHIRT);
  P.seg(ctx, sh[0] - Math.cos(ang) * 40 * s, sh[1] - Math.sin(ang) * 40 * s, sl[0], sl[1], 158 * s, 144 * s, g);
  // sleeve folds
  ctx.save(); ctx.strokeStyle = 'rgba(15,60,58,0.55)'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  for (const f of [0.12, 0.24]) { const px = lerp(sh[0], el[0], f), py = lerp(sh[1], el[1], f); ctx.beginPath(); ctx.moveTo(px + nx * 50 * s, py + ny * 50 * s); ctx.quadraticCurveTo(px + Math.cos(ang) * 14 * s, py + Math.sin(ang) * 14 * s, px - nx * 30 * s, py - ny * 30 * s); ctx.stroke(); }
  ctx.restore();
}
// crumpled paper napkin held at (x,y); hand wraps it from the lower right (wrist at local (90,80))
function napkin(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    // palm behind
    const pg = ctx.createLinearGradient(0, 0, 90, 90); pg.addColorStop(0, SKN[0]); pg.addColorStop(1, SKN[2]);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(46, 40, 62, 50, 0.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f7f3ea'; ctx.beginPath();
    ctx.moveTo(-70, -40); ctx.lineTo(-20, -58); ctx.lineTo(40, -48); ctx.lineTo(78, -18); ctx.lineTo(70, 30); ctx.lineTo(20, 52); ctx.lineTo(-40, 46); ctx.lineTo(-78, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(150,140,120,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-50, -20); ctx.lineTo(10, 0); ctx.lineTo(50, -24); ctx.moveTo(-30, 30); ctx.lineTo(0, 4); ctx.moveTo(20, 30); ctx.lineTo(10, 4); ctx.stroke();
    // four fingers curled over the front of the napkin
    for (let i = 0; i < 4; i++) {
      const bx = 60 - i * 4, by = -30 + i * 24, tx = bx - 46 + i * 4, ty = by + 6;
      P.seg(ctx, bx + 20, by + 4, tx, ty, 26 - i * 2, 22 - i * 2, i % 2 ? SKN[1] : SKN[0]);
      ctx.strokeStyle = 'rgba(130,60,40,0.4)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx - 6, by - 8); ctx.lineTo(bx - 4, by + 12); ctx.stroke();
      ctx.fillStyle = 'rgba(255,225,205,0.9)'; P.ell(ctx, tx + 2, ty - 1, 6, 5); ctx.fill();
    }
    // thumb along the bottom
    P.seg(ctx, 70, 64, 10, 58, 30, 24, SKN[1]);
    ctx.fillStyle = 'rgba(255,225,205,0.9)'; P.ell(ctx, 14, 56, 8, 6); ctx.fill();
  });
}
// fist gripping a stick that runs along local y; fingers wrap toward +x, thumb on top; origin = fist centre
function fist(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.save(); ctx.shadowColor = 'rgba(50,20,8,0.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = -4; ctx.shadowOffsetY = 6;
    const g = ctx.createLinearGradient(-50, 0, 50, 0); g.addColorStop(0, SKN[2]); g.addColorStop(0.5, SKN[1]); g.addColorStop(1, SKN[0]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-52, -50, 86, 100, 30); ctx.fill();
    ctx.restore();
    // curled fingers (four rolls stacked along the stick)
    for (let i = 0; i < 4; i++) {
      const fy = -38 + i * 25, fg = ctx.createLinearGradient(0, fy - 12, 0, fy + 12);
      fg.addColorStop(0, SKN[0]); fg.addColorStop(1, SKN[2]);
      ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(4, fy - 12, 44 - i * 3, 24, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(120,55,35,0.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(24, fy - 10); ctx.lineTo(24, fy + 10); ctx.stroke();
      ctx.fillStyle = 'rgba(255,230,210,0.85)'; P.ell(ctx, 40 - i * 3, fy - 4, 5, 4); ctx.fill();
    }
    // thumb pressing over the stick
    P.seg(ctx, -36, 34, -4, -40, 30, 24, SKN[1]);
    ctx.fillStyle = 'rgba(255,225,205,0.9)'; P.ell(ctx, -4, -40, 8, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(120,55,35,0.4)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-26, 10); ctx.lineTo(-14, 14); ctx.stroke();
  });
}
// big mirrored fancy pinky hand (wrist at x,y) with the long-sleeve cuff painted over as bare wrist
function pinkyHandCU(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
  ctx.shadowColor = 'rgba(50,20,8,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 7;
  PP.fancyPinkyHand(ctx, 0, 0, s, rot);
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.rotate(rot); ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, SKN[0]); g.addColorStop(1, SKN[2]);
  P.seg(ctx, -60, 0, 4, 0, 60, 54, g);
  ctx.restore();
}
// screen position of a local point of a mirrored fancyPinkyHand at (x,y,s,rot)
function pinkyPt(x, y, s, rot, lx, ly) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  return [x - (lx * c - ly * sn) * s, y + (lx * sn + ly * c) * s];
}
// noodle strands hanging from (x,y) down to yEnd
function noodleStrands(ctx, x, y, yEnd, s, t, o = {}) {
  ctx.save(); ctx.lineCap = 'round';
  const n = o.n || 7, sway = o.sway === undefined ? 1 : o.sway;
  for (let i = 0; i < n; i++) {
    const ox = (i - n / 2) * 7 * s, ph = i * 1.7;
    const bx = x + ox + Math.sin(t * 2 + ph) * 18 * s * sway, mid = (y + yEnd) / 2;
    ctx.strokeStyle = '#f6ecd4'; ctx.lineWidth = 9 * s;
    ctx.beginPath(); ctx.moveTo(x + ox * 0.3, y); ctx.bezierCurveTo(bx + 20 * s, mid - 60 * s, bx - 16 * s, mid + 60 * s, x + ox * 1.6 + Math.sin(ph) * 30 * s, yEnd); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.moveTo(x + ox * 0.3 - 2, y); ctx.bezierCurveTo(bx + 18 * s, mid - 60 * s, bx - 18 * s, mid + 60 * s, x + ox * 1.6 + Math.sin(ph) * 30 * s - 2, yEnd); ctx.stroke();
  }
  ctx.restore();
}
// little music-box notes floating up
function notes(ctx, T, x, y, a) {
  if (a <= 0) return;
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const u = ((T * 0.45 + i * 0.25) % 1), px = x + Math.sin(u * 5 + i) * 40 + i * 18, py = y - u * 260;
    ctx.globalAlpha = a * Math.sin(u * Math.PI); ctx.fillStyle = '#ffe6a0'; ctx.strokeStyle = '#ffe6a0'; ctx.lineWidth = 4;
    P.ell(ctx, px, py, 12, 9); ctx.fill(); ctx.beginPath(); ctx.moveTo(px + 11, py); ctx.lineTo(px + 11, py - 44); ctx.lineTo(px + 26, py - 34); ctx.stroke();
  }
  ctx.restore();
}
// bàng leaf (red/orange)
function leaf(ctx, x, y, s, rot, col) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -26); ctx.quadraticCurveTo(22, -8, 0, 26); ctx.quadraticCurveTo(-22, -8, 0, -26); ctx.fill();
    ctx.strokeStyle = 'rgba(80,20,10,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 24); ctx.stroke();
  });
}
const LEAF_C = ['#c8402a', '#e0702e', '#b8321f', '#e8a040', '#9c2a1a'];
function darken(ctx, a, col = '8,4,2') { if (a <= 0) return; ctx.fillStyle = `rgba(${col},${a})`; ctx.fillRect(0, 0, W, H); }
function beatPulse(T, sharp = 6) { const ph = ((T / BEAT) % 1 + 1) % 1; return Math.exp(-ph * sharp); }

// =====================================================================================
// s21 60–63: bowl slides in, steam fogs the sunglasses, wipe, "wow"
// =====================================================================================
function s21(ctx, lt, p, T) {
  const z = 1 + 0.05 * ease.inOut(p);
  stallBg(ctx, T, { zoom: 2.3, blur: 12, cx: 520, cy: 1150, k: 0.5 });
  const fx = 540, fy = 800;
  cam(ctx, 540, 1100, z, 0, () => {
    // glasses: on head -> slip onto eyes in the steam -> wiped -> pushed back up
    const down = ease.inOut(inv(60.45, 60.8, T)), up = ease.inOut(inv(62.25, 62.55, T));
    const gY = lerp(-178, 0, down * (1 - up));
    const fogA = inv(60.75, 61.3, T) * (1 - inv(61.6, 62.15, T));
    const wow = inv(62.4, 62.6, T);
    const blind = fogA > 0.6 && T < 62.2;
    PE.face(ctx, fx, fy, 1.0, {
      turn: blind ? Math.sin(T * 3) * 0.15 : 0, glassesY: gY, glassesFn: fogA > 0.01 ? PP.fogGlassesFn(fogA, T) : null,
      open: wow > 0 ? 1 + 0.25 * wow : 1, mouth: wow > 0 ? 'o' : (blind ? 'neutral' : 'smile'), mOpen: wow > 0 ? 0.6 + 0.4 * wow : 0.3,
      brow: wow > 0 ? 0.8 * wow : (blind ? 0.4 : 0), blush: 0.25 + 0.3 * wow, hairLift: 0.2 * wow, t: T,
    });
    PP.faceScarf(ctx, fx, fy, 1.0, '#c8423a', { turn: blind ? Math.sin(T * 3) * 0.15 : 0 });
    if (wow > 0) {
      for (let i = 0; i < 5; i++) { const a = -2.6 + i * 0.55, rr = 260 + 40 * Math.sin(T * 6 + i); sparkle(ctx, fx + Math.cos(a) * rr, fy - 40 + Math.sin(a) * rr * 0.9, 30 + 10 * Math.sin(T * 8 + i), wow * 0.9); }
    }
  });
  // table + bowl slide-in
  tableTop(ctx, 1420);
  const sl = ease.outBack(inv(60.0, 60.55, T)), bx = lerp(1550, 540, sl);
  if (T < 60.6) { ctx.save(); ctx.globalAlpha = 0.3 * (1 - inv(60.3, 60.6, T)); for (let i = 1; i < 4; i++) PP.phoBowl(ctx, bx + i * 70, 1830, 1.7, { fill: 0.95, steam: 0, t: T }); ctx.restore(); }
  PP.phoBowl(ctx, bx, 1830, 1.7, { fill: 0.95, noodles: 1, beef: 1, cook: 0.45, scallion: 1, onion: 1, herbs: 0.5, steam: 0.7, t: T, seed: 21 });
  PP.richSteam(ctx, T, 21, bx, 1560, 260, 620, 0.42 * inv(60.2, 60.7, T), { n: 14 });
  glow(ctx, bx, 1600, 380, 'rgba(255,200,130,0.6)', 0.3);
  // wiping hand with napkin (over the table: elbow rests in front of him)
  const wk = inv(61.35, 61.6, T) * (1 - inv(62.15, 62.4, T));
  if (wk > 0) cam(ctx, 540, 1100, z, 0, () => {
    const sw = Math.sin((T - 61.6) / 0.55 * TAU) * 110;
    const nx = fx + sw, ny = fy + 10 + (1 - wk) * 700, nr = Math.sin(T * 9) * 0.15;
    const wr = [nx + 1.25 * (90 * Math.cos(nr) - 80 * Math.sin(nr)), ny + 1.25 * (90 * Math.sin(nr) + 80 * Math.cos(nr))];
    const sh = [fx + 250, fy + 360], el = ikPick(sh, wr, 340, 330, [-0.2, 1]);
    armCU(ctx, sh, el, wr, 1.0);
    napkin(ctx, nx, ny, 1.25, nr);
  });
}

// =====================================================================================
// s22 63–66.75: fancy eating (teaspoon, pinky up), locals glance at each other
// =====================================================================================
function s22(ctx, lt, p, T) {
  if (T < 64.9) {
    // close-up: dainty teaspoon from huge bowl to pursed lips
    const u = inv(63, 64.9, T);
    stallBg(ctx, T, { zoom: 2.7, blur: 16, cx: 600, cy: 1120, k: 0.5, warmA: 0.3 });
    cam(ctx, 540, 905, 1.04 + 0.04 * u, 0, () => {
      const fx = 520, fy = 620, fs = 0.95;
      const lift = ease.inOut(inv(63.55, 64.15, T)), sip = inv(64.15, 64.3, T) * (1 - inv(64.75, 64.9, T));
      const dip = Math.max(0, Math.sin((T - 63) / 0.25 * Math.PI)) * (1 - inv(63.3, 63.55, T));
      const tilt = -0.06 + 0.05 * lift;
      PE.face(ctx, fx, fy, fs, { turn: -0.08, tilt, open: sip > 0.5 ? 0.12 : 0.5, mouth: sip > 0.3 ? 'sip' : 'neutral', mOpen: 0.2, brow: 0.35, blush: 0.2, t: T });
      PP.faceScarf(ctx, fx, fy, fs, '#c8423a', { turn: -0.08, tilt });
      tableTop(ctx, 1460);
      PP.phoBowl(ctx, 560, 1900, 2.0, { fill: 0.95, noodles: 1, beef: 0.9, cook: 0.6, scallion: 1, onion: 1, herbs: 0.6, steam: 0.3, t: T, seed: 22 });
      PP.richSteam(ctx, T, 22, 560, 1600, 240, 520, 0.3, { n: 10 });
      // hand path: bowl -> mouth (pinch point steered to the lips)
      const hs = 2.6, hr = lerp(-0.35, -0.95, lift);
      const tgt = [lerp(640, 625, lift), lerp(1480 + dip * 30, fy + 105, lift)];
      const pp = pinkyPt(0, 0, hs, hr, 128, -14), wr = [tgt[0] - pp[0], tgt[1] - pp[1]];
      const sh = [fx + 250 * fs, fy + 360 * fs], el = ikPick(sh, wr, 330, 330, [1, 0.6]);
      armCU(ctx, sh, el, wr, 0.95);
      pinkyHandCU(ctx, wr[0], wr[1], hs, hr);
      notes(ctx, T, 860, 860, 0.8);
    });
  } else {
    // wide: tourist sipping politely; the locals at the next stools turn back, then look at each other
    stallBg(ctx, T, { zoom: 1.35, blur: 5, cx: 560, cy: 1180, k: 0.5, warmA: 0.25 });
    const u = inv(64.9, 66.75, T);
    cam(ctx, 545, 1360, 1.45 + 0.05 * u, 0, () => {
      // locals (background, facing right = away from him)
      const glB = ease.inOut(inv(65.15, 65.4, T)), glA = ease.inOut(inv(65.3, 65.55, T)) * (1 - ease.inOut(inv(65.95, 66.2, T)));
      const eatK = (T < 65.1) ? 0.5 + 0.5 * Math.sin(T * 5) : 0;
      PP.localEater(ctx, 625, 1540, 1.3, { seed: 0, k: eatK * 0.6, t: T, glance: glA });
      PP.localEater(ctx, 800, 1550, 1.3, { seed: 1, k: eatK * 0.5, t: T + 1, glance: glB });
      // tourist foreground
      const tx = 400, ty = 1760, ts = 1.75;
      P.stool(ctx, tx + 10, ty, 1.5, '#e04a3a', 62);
      PP.stallTable(ctx, 120, ty + 30, 1.25, { w: 300 });
      const cyc = ((T - 64.9) / 1.85), lift = ease.inOut(clamp(Math.sin(cyc * Math.PI) * 1.4));
      const handL = [lerp(-150, -64, lift), lerp(-92, -238, lift)];
      PE.tourist(ctx, tx, ty, ts, { sit: 1, glassHand: handL, glassHandK: 1, smile: 0.4, t: T });
      PP.touristScarf(ctx, tx, ty, ts, { sit: 1 }, '#c8423a');
      PP.phoBowl(ctx, 150, ty + 30 - 98 * 1.25, 0.5, { fill: 0.9, noodles: 1, beef: 0.9, cook: 0.6, steam: 0.6, t: T, seed: 23 });
      const hw = [tx + handL[0] * ts, ty + handL[1] * ts];
      ctx.save(); ctx.translate(hw[0], hw[1]); ctx.scale(-1, 1); PP.fancyPinkyHand(ctx, 0, 0, 0.7, -0.2 + 0.25 * lift); ctx.restore();
      notes(ctx, T, tx + 30, ty - 560, 0.7);
    });
  }
  { const sa = X.fadeIO(T, 63.3, 66.6, 0.2, 0.3); if (sa > 0) { ctx.save(); ctx.globalAlpha = sa; const g = ctx.createLinearGradient(0, 120, 0, 380); g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.5, 'rgba(8,4,2,0.55)'); g.addColorStop(1, 'rgba(8,4,2,0)'); ctx.fillStyle = g; ctx.fillRect(0, 120, W, 260); ctx.restore(); } }
  lineFit(ctx, T, 63.3, 66.6, 'Ăn phở kiểu... quý tộc?', 'Fancy pho?', { y: 225 });
}

// =====================================================================================
// s23 66.75–70.5: Ông Tư laughs, demonstrates a huge SLURP (68.0–69.3), leaves shake
// =====================================================================================
function s23(ctx, lt, p, T) {
  if (T < 67.95) {
    const u = inv(66.75, 67.95, T);
    stallBg(ctx, T, { zoom: 2.4, blur: 12, cx: 470, cy: 1150, k: 0.5 });
    cam(ctx, 540, 1000, 1.0 + 0.04 * u, 0, () => {
      PP.ongTuFace(ctx, 540, 820, 1.12, { expr: 'laugh', k: 0.8, t: T, turn: Math.sin((T - 66.75) * 10) * 0.35, tilt: -0.05, shake: 0.4 });
      tableTop(ctx, 1470, { seed: 5 });
      PP.giantPot(ctx, 980, 1900, 0.9, { lid: 'off', simmer: 1, t: T, steam: 0.6 });
    });
  } else if (T < 69.45) {
    const sk = inv(67.95, 68.15, T), on = T >= 68.0 && T < 69.3;
    const shk = on ? 1 : 0.3;
    stallBg(ctx, T, { zoom: 2.2, blur: 14, cx: 600, cy: 1150, k: 0.5 });
    const jx = Math.sin(T * 47) * 7 * shk, jy = Math.sin(T * 53 + 1) * 5 * shk;
    cam(ctx, 540 + jx, 1000 + jy, 1.02 + 0.05 * inv(67.95, 69.45, T), 0, () => {
      const fy = 860, fs = 1.08;
      // rings behind the head
      for (let i = 0; i < 3; i++) { const rk = ((T - 68.0) / 0.55 + i / 3) % 1; if (on || rk < 0.9) PP.soundRings(ctx, 540, fy + 150 * fs, T > 68.0 ? rk : 0, { n: 2, R: 900, col: '255,236,190' }); }
      PP.ongTuFace(ctx, 540, fy, fs, { expr: 'slurp', k: sk, t: T, tilt: 0.06, noodles: true });
      tableTop(ctx, 1490, { seed: 6 });
      // bowl held up to the chin
      PP.phoBowl(ctx, 540, fy + 820, 1.35, { fill: 0.6, noodles: 0.7, beef: 0.5, cook: 0.6, steam: 0.2, t: T, seed: 31, k: 0.3 });
      PP.richSteam(ctx, T, 31, 540, fy + 640, 220, 260, 0.22, { n: 8 });
    });
  } else {
    // the bàng tree trembles, leaves rain down
    const u = inv(69.45, 70.5, T), d = 1 - u * 0.7;
    const jx = Math.sin(T * 61) * 10 * d, jy = Math.sin(T * 49 + 2) * 6 * d;
    ctx.fillStyle = '#1a1424'; ctx.fillRect(0, 0, W, H);
    cam(ctx, 470 + jx, 760 + jy, 1.65 + 0.06 * u, 0, () => {
      PP.dawnStreet(ctx, T, 0, { k: 0.45, steam: 0.4 });
      // extra trembling leaf clusters over the crown
      const r = rng(2323);
      for (let i = 0; i < 60; i++) {
        const lx = 300 + r() * 300, ly = 520 + r() * 270, rot = r() * TAU, c = LEAF_C[i % 5], sc = 0.6 + r() * 0.5;
        leaf(ctx, lx + Math.sin(T * 40 + i) * 6 * d, ly + Math.sin(T * 33 + i * 2) * 4 * d, sc, rot + Math.sin(T * 30 + i) * 0.4 * d, c);
      }
      // falling leaves
      for (let i = 0; i < 26; i++) {
        const lx0 = 300 + r() * 320, ly0 = 560 + r() * 200, del = r() * 0.4, sp = 160 + r() * 200, c = LEAF_C[(i + 2) % 5];
        const tt = Math.max(0, T - 69.45 - del); if (tt <= 0) continue;
        leaf(ctx, lx0 + Math.sin(tt * 3 + i) * 50 + tt * 30, ly0 + tt * sp, 0.7, tt * 4 + i, c);
      }
    });
    // sound rings sweep in from bottom right
    for (let i = 0; i < 2; i++) PP.soundRings(ctx, 1100, 1900, clamp(u * 1.2 - i * 0.15 + 0.2), { n: 3, R: 1700, col: '255,236,190' });
  }
  lineFit(ctx, T, 67.0, 70.3, '"Húp to mới ngon!"', '"Slurp it loud!"', { y: 290 });
}

// =====================================================================================
// s24 70.5–73.5: noodles up, deep breath, eyes closed... SILENCE 72.75–73.5 (frozen)
// =====================================================================================
function s24(ctx, lt, p, T) {
  const Tf = Math.min(T, 72.75), still = inv(72.75, 73.2, T);
  stallBg(ctx, Tf, { zoom: 2.5, blur: 16, cx: 520, cy: 1130, k: 0.55, warmA: 0.3 });
  const z = 1.0 + 0.16 * ease.inOut(inv(70.5, 73.5, T));
  cam(ctx, 540, 900, z, 0, () => {
    const br = ease.inOut(inv(71.55, 72.55, Tf)); // inhale
    const fx = 540, fy = 760 - 16 * br, fs = 1.03 + 0.02 * br;
    const close = ease.inOut(inv(71.6, 71.95, Tf));
    PE.face(ctx, fx, fy, fs, { turn: 0, open: lerp(1, 0.04, close), mouth: br > 0.3 ? 'o' : 'neutral', mOpen: 0.25 * br, brow: 0.3 * br, blush: 0.2 + 0.2 * br, t: Tf });
    PP.faceScarf(ctx, fx, fy, fs, '#c8423a', {});
    tableTop(ctx, 1370, { seed: 7 });
    // bowl rim at the bottom
    PP.phoBowl(ctx, 540, 2080, 1.9, { fill: 0.85, noodles: 0.8, beef: 0.7, cook: 0.6, steam: 0.25, t: Tf, seed: 24 });
    // chopsticks lift noodles to just below the mouth
    const lift = ease.out(inv(70.5, 71.45, Tf));
    const tipX = 560, tipY = lerp(1700, 1080, lift) - 6 * br;
    noodleStrands(ctx, tipX, tipY, 2000, 1.0, Tf, { n: 8, sway: 1 - still });
    PP.richSteam(ctx, Tf, 24, tipX, tipY + 260, 110, 300, 0.25, { n: 7 });
    const rot = -0.68;
    PP.chopsticksPair(ctx, tipX - 6, tipY - 4, 1.25, rot, 0.05);
    const hx = tipX + Math.cos(rot) * 330, hy = tipY - Math.sin(rot) * -330;
    const sh = [fx + 250 * fs, fy + 360 * fs], wr = [hx + 34, hy + 44], el = ikPick(sh, wr, 320, 300, [1, 0.5]);
    armCU(ctx, sh, el, wr, 0.9);
    fist(ctx, hx, hy, 1.45, rot + Math.PI / 2);
    // a broth drop, falling... then frozen mid-air
    const dt = inv(72.1, 72.9, Tf);
    if (dt > 0) { const dy = tipY + 260 + 500 * dt * dt; ctx.fillStyle = 'rgba(255,214,140,0.95)'; ctx.beginPath(); ctx.ellipse(tipX + 30, dy, 9, 13, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; P.ell(ctx, tipX + 27, dy - 4, 3, 4); ctx.fill(); }
  });
  dust(ctx, Tf, 2424, 26, 0, 300, W, 1400, '255,230,180', 3, 0.55);
  // tension: edges close in during the silence
  if (still > 0) {
    ctx.save(); const g = ctx.createRadialGradient(540, 900, 260, 540, 900, 1100);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.6 * still})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.35 * still; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

// =====================================================================================
// s25 73.5–77.25: THE SLURP – noodle tornado, steam burst, sunglasses fly; bliss
// =====================================================================================
function s25(ctx, lt, p, T) {
  const sh = 1 - inv(73.5, 74.4, T), jx = Math.sin(T * 57) * 22 * sh, jy = Math.sin(T * 43 + 1) * 16 * sh;
  stallBg(ctx, T, { zoom: 2.3, blur: 20, cx: 540, cy: 1130, k: 0.75, warmA: 0.5 });
  const fx = 540, fy = 700, fs = 1.0, mY = fy + 140 * fs;
  const vk = ease.out(inv(73.5, 73.75, T)) * (1 - ease.inOut(inv(75.0, 75.5, T)));
  const bliss = ease.inOut(inv(75.25, 75.7, T));
  godRays(ctx, fx, mY, -Math.PI / 2, 3.2, 1500, 14, 'rgba(255,220,150,0.9)', 0.3 * (0.25 + 0.75 * vk) * (1 - 0.5 * bliss), T);
  glow(ctx, fx, mY + 420, 800, 'rgba(255,190,110,0.7)', 0.22 * (0.3 + vk));
  cam(ctx, 540 + jx, 960 + jy, 1.0 + 0.06 * ease.out(inv(73.5, 77.25, T)), Math.sin(T * 31) * 0.01 * sh, () => {
    // sunglasses flight: launched off the head, spin up, land back on the head at 75.58
    const ft = T - 73.5, FL = 2.08, flying = ft < FL;
    const land = flying ? 0 : T - 73.5 - FL;
    const gBounce = flying ? -178 : -178 + 26 * Math.exp(-land * 7) * Math.sin(land * 30);
    PE.face(ctx, fx, fy, fs, {
      open: 0.04, happyClosed: bliss > 0.5, mouth: bliss > 0.5 ? 'grin' : 'o', mOpen: bliss > 0.5 ? 0.55 : 0.75 + 0.25 * vk,
      hairLift: 0.8 * vk + 0.2, blush: 0.5 + 0.5 * bliss, brow: 0.6 * vk, tilt: bliss * Math.sin(T * 2.4) * 0.06,
      glasses: !flying, glassesY: gBounce, t: T,
    });
    PP.faceScarf(ctx, fx, fy, fs, '#c8423a', { tilt: bliss * Math.sin(T * 2.4) * 0.06 });
    tableTop(ctx, 1290, { seed: 8 });
    // bowl
    PP.phoBowl(ctx, fx, 1840, 1.65, { fill: 0.75 - 0.35 * inv(73.5, 75.3, T), noodles: 1 - inv(73.5, 75.2, T), beef: 0.6, cook: 0.6, steam: 0.25, t: T, seed: 25 });
    // the tornado
    PP.slurpVortex(ctx, T, fx, mY + 10, 1.0, vk);
    // steam explosion
    const ek = inv(73.5, 74.6, T);
    if (ek < 1) { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = 80 + 620 * ease.out(ek); glow(ctx, fx + Math.cos(a) * rr, 1320 + Math.sin(a) * rr * 0.55, 220, 'rgba(255,250,240,0.9)', 0.4 * (1 - ek) * (1 - ek)); } }
    PP.richSteam(ctx, T, 25, fx, 1640, 400, 560, (0.3 + 0.35 * (1 - ek)) * (1 - 0.4 * bliss), { n: 16 });
    if (flying) {
      const u = ft, gx = fx + Math.sin(u * 3) * 70, gy = fy - 178 * fs - 1300 * u + 0.5 * 1250 * u * u;
      PP.sunglasses(ctx, gx, gy, fs, TAU * 3 * (u / FL));
      if (u < 0.3) glow(ctx, gx, gy, 200, 'rgba(255,240,210,0.8)', 1 - u / 0.3);
    } else if (land < 0.25) {
      for (let i = 0; i < 6; i++) sparkle(ctx, fx - 140 + i * 56, fy - 190 - 20 * Math.sin(i), 30, 1 - land / 0.25);
    }
    if (bliss > 0) {
      for (let i = 0; i < 6; i++) { const a = -2.9 + i * 0.5, rr = 300 + 30 * Math.sin(T * 5 + i); sparkle(ctx, fx + Math.cos(a) * rr, fy + Math.sin(a) * rr * 0.85, 26 + 10 * Math.sin(T * 7 + i), bliss * 0.85); }
      for (let i = 0; i < 3; i++) { const u = ((T - 75.3) * 0.6 + i / 3) % 1; heart(ctx, fx + 280 - i * 70, fy - 100 - u * 320, 0.4 + 0.15 * i, `rgba(255,92,122,${(1 - u) * bliss})`); }
    }
  });
  lineFit(ctx, T, 75.0, 77.1, 'Ngon tới tận xương!', 'Soul-warming good!', { y: CAP_Y + 20 });
}

// =====================================================================================
// s26 77.25–81: the whole row slurps on the beat; tourist conducts; Ông Tư drums the pot
// =====================================================================================
function s26(ctx, lt, p, T) {
  const ph = ((T / BEAT) % 1 + 1) % 1, onBeat = 0.5 + 0.5 * Math.cos(ph * TAU), hit = beatPulse(T, 7);
  const z = 1.0 + 0.04 * ease.inOut(p) + 0.012 * hit;
  ctx.fillStyle = '#1a1424'; ctx.fillRect(0, 0, W, H);
  P.layer(ctx, 2.5, (c) => {
    c.fillStyle = '#1a1424'; c.fillRect(0, 0, W, H);
    cam(c, 540, 1100, 1.25, 0, () => PP.dawnStreet(c, T, 800, { k: 0.6, steam: 0.7 }));
  });
  cam(ctx, 540, 960, z, 0, () => {
    // Ông Tư + pot: big, on the left, drumming the rim on every beat
    const tx = 210, ty = 1440, ts = 1.1;
    PP.giantPot(ctx, tx + 270 * ts, ty, ts, { lid: 'off', simmer: 1, t: T, steam: 0.5 });
    const o = PP.ongTu(ctx, tx, ty, ts, { pose: 'drum', k: hit, t: T });
    if (o && o.hit && hit > 0.35) {
      glow(ctx, o.hit[0], o.hit[1], 130, 'rgba(255,240,200,0.9)', (hit - 0.35) * 1.4);
      PP.soundRings(ctx, o.hit[0], o.hit[1], 1 - hit, { n: 2, R: 260, col: '255,236,190' });
      for (let i = 0; i < 5; i++) { const aa = -2.6 + i * 0.4, rr = 60 + 90 * (1 - hit); sparkle(ctx, o.hit[0] + Math.cos(aa) * rr, o.hit[1] + Math.sin(aa) * rr, 22, (hit - 0.35) * 1.4); }
    }
    // row of locals in front, all slurping on the beat
    const row = [[110, 1800, 0], [330, 1815, 1], [550, 1800, 2]];
    row.forEach(([x, y, sd], i) => PP.localEater(ctx, x, y, 1.55, { seed: sd, k: onBeat, t: T + i * 0.7 }));
    // the maestro (foreground right, facing left), chopsticks raised high in open air
    const px = 935, py = 1930, ps = 1.75;
    P.stool(ctx, px + 10, py, 1.5, '#e04a3a', 62);
    const wave = Math.sin(ph * TAU);
    const hand = [-55 + 35 * wave, -385 - 25 * onBeat];
    PE.tourist(ctx, px, py, ps, { sit: 1, glassHand: hand, glassHandK: 1, smile: 1, lean: 0.05, t: T });
    PP.touristScarf(ctx, px, py, ps, { sit: 1, lean: 0.05 }, '#c8423a');
    const hw = [px + hand[0] * ps, py + hand[1] * ps];
    const th = -1.6 + 0.4 * wave, len = 380 * 0.95;
    const tips = [hw[0] + Math.cos(th) * len, hw[1] + Math.sin(th) * len];
    PP.chopsticksPair(ctx, tips[0], tips[1], 0.95, th + Math.PI, 0.02);
    fist(ctx, hw[0], hw[1], 0.66, th - Math.PI / 2);
    if (hit > 0.5) sparkle(ctx, tips[0], tips[1], 44, (hit - 0.5) * 2);
  });
  lineFit(ctx, T, 77.5, 80.8, 'Húp cả phố!', 'The whole street slurps!', { y: 330 });
}

// =====================================================================================
// s27 81–84: crane up over the street, sunrise, steam into the mist, end card 81.75
// =====================================================================================
function s27(ctx, lt, p, T) {
  const u = ease.inOut(p), k = lerp(0.55, 1, u);
  const r = PP.dawnAerial(ctx, T, k, lerp(0.85, 0, u));
  const oy = -lerp(0.85, 0, u) * (2600 - H);
  flare(ctx, 734, oy + 700, 1.0, 0.25 + 0.45 * u);
  glow(ctx, 734, oy + 720, 700, 'rgba(255,170,90,0.7)', 0.3 + 0.4 * u);
  if (r && r.stallX !== undefined) PP.richSteam(ctx, T, 27, r.stallX, r.stallY, 120, 900, 0.5, { n: 14, drift: 0.1 });
  endCardFit(ctx, T, 81.75, { l1: 'PHỞ', l2: 'HÀ NỘI', vi: 'Trong. Thơm. Ấm cả buổi sáng.', en: 'Clear. Fragrant. Pure Hanoi morning.' });
  // the sun breaks the horizon (drawn over the card's dark gradient, soft enough to keep the text readable)
  const su = inv(81.6, 84, T);
  if (su > 0) { glow(ctx, 820, oy + 735, 560, 'rgba(255,160,80,0.8)', 0.35 * su); glow(ctx, 820, oy + 735, 120, 'rgba(255,236,200,1)', 0.5 * su); }
}

// =====================================================================================
// s28 84–90: CTA (like + follow), comment question, logo, fade
// =====================================================================================
function s28(ctx, lt, p, T) {
  const dk = inv(84.5, 85.5, T);
  stallBg(ctx, T, { zoom: 2.0, blur: 8 + 10 * dk, cx: 540, cy: 1150, k: 0.7, warmA: 0.35 });
  ctx.fillStyle = `rgba(8,4,2,${0.25 + 0.4 * dk})`; ctx.fillRect(0, 0, W, H);
  const rise = ease.outBack(inv(84.3, 85.0, T));
  const wink = T > 86.0 && T < 86.45 ? 0.05 : 1;
  const fy = 1420 + (1 - rise) * 500;
  PE.face(ctx, 540, fy, 0.5, { turn: 0.05, open: 1, openR: wink, mouth: 'smile', mOpen: 0.4, brow: wink < 1 ? 0.4 : 0, blush: 0.5, t: T });
  PP.faceScarf(ctx, 540, fy, 0.5, '#c8423a', { turn: 0.05 });
  const th = ease.outBack(inv(85.4, 85.9, T));
  if (T > 85.4) PE.thumbsUp(ctx, 830, fy - 20 + (1 - th) * 500, 0.8, -0.15 + Math.sin(T * 5) * 0.04);
  ctaLike(ctx, T, 84.2, 330, 760); ctaFollow(ctx, T, 84.7, 85.5, 700, 760); ctaHand(ctx, T, 85.5, 700, 760);
  biText(ctx, X.fadeIO(T, 84.5, 89.4, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  const ca = X.fadeIO(T, 86.0, 89.4, 0.4, 0.4);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    const g = ctx.createLinearGradient(0, 960, 0, 1170); g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.5, 'rgba(8,4,2,0.6)'); g.addColorStop(1, 'rgba(8,4,2,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 960, W, 210); ctx.restore();
    biText(ctx, ca, 1035, 'Bạn ăn phở tái hay chín?', 'Rare or well-done beef: which team?', { vsize: 56, esize: 38, bd: false });
  }
  logo(ctx, X.fadeIO(T, 85.5, 89.4, 0.5, 0.4), 1210);
  const fb = inv(89.4, 90, T); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s21, s22, s23, s24, s25, s26, s27, s28 };
