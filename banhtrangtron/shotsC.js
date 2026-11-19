// Bánh tráng trộn Sài Gòn – shots 21..28 (Act III: the shake gag, the flavour burst, the whole-school jam, end card, CTA)
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, inv, ease, cam, at, glow, flare, godRays, dust, sparkle, createCanvas } = L;
const PE = require('./people');
const TP = require('./tprops');
const X = require('./text');
const CAP_Y = X.CAP_Y;
const BEAT = 0.4;
const beat = T => ((T / BEAT) % 1 + 1) % 1;            // 0 on the beat
const hit = (T, sharp = 6) => Math.exp(-beat(T) * sharp); // 1 on the beat, decays
// schoolKid/coBa add seed*0.37 to t; subtract it so every shake/clap lands on the global beat
const kt = (T, seed) => T - (seed || 0) * 0.37;

// =====================================================================================
// text / CTA helpers (ported from pho/shotsC.js; fitted to the safe zone x 70..930)
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
// like button: pops in at t0, the "tap" (coin) lands on tTap, then the heart thumps on every beat
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

// =====================================================================================
// scene helpers
// =====================================================================================
// cached, pre-blurred school-street plates for close shots (the street is static enough when out of focus)
const BGC = {};
function streetPlate(key, panX, blur, o = {}) {
  if (!BGC[key]) {
    const a = createCanvas(W, H), ax = a.getContext('2d');
    ax.fillStyle = '#000'; ax.fillRect(0, 0, W, H);
    TP.schoolStreet(ax, o.t || 64, panX, Object.assign({ petals: 0 }, o));
    const b = createCanvas(W, H), bx = b.getContext('2d');
    bx.drawImage(a, 0, 0);               // opaque under-layer so blurred edges don't go dark
    bx.filter = `blur(${blur}px)`; bx.drawImage(a, 0, 0); bx.filter = 'none';
    BGC[key] = b;
  }
  return BGC[key];
}
function plate(ctx, img, cx, cy, z, rot = 0) { cam(ctx, cx, cy, z, rot, () => ctx.drawImage(img, 0, 0)); }
function warmAir(ctx, T, seed, a = 1) {
  dust(ctx, T, seed, 40, 0, 200, W, 1500, '255,225,170', 2.6, 0.5 * a);
}
// a yellow school wall seen from below: quad [bl, br, tr, tl] with converging shutter windows
function wallFromBelow(x, q, c0, c1) {
  const [bl, br, tr, tl] = q;
  const P = (u, v) => { const lx = lerp(bl[0], tl[0], v), ly = lerp(bl[1], tl[1], v), rx = lerp(br[0], tr[0], v), ry = lerp(br[1], tr[1], v); return [lerp(lx, rx, u), lerp(ly, ry, u)]; };
  const poly = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); };
  x.fillStyle = TP.lgr(x, 0, 400, 0, 1920, [[0, c0], [1, c1]]); poly(q); x.fill();
  for (const v of [0.08, 0.3, 0.5, 0.68, 0.83]) {
    const dv = 0.11 * (1 - v * 0.55);
    for (const u of [0.18, 0.58]) {
      x.fillStyle = 'rgba(70,40,10,0.35)'; poly([P(u - 0.03, v - 0.015), P(u + 0.3, v - 0.015), P(u + 0.3, v + dv + 0.01), P(u - 0.03, v + dv + 0.01)]); x.fill();
      x.fillStyle = '#2f7f78'; poly([P(u, v), P(u + 0.26, v), P(u + 0.26, v + dv), P(u, v + dv)]); x.fill();
      x.strokeStyle = 'rgba(15,50,45,0.6)'; x.lineWidth = 2; for (let j = 1; j < 5; j++) { const a = P(u, v + dv * j / 5), b = P(u + 0.26, v + dv * j / 5); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
    }
    x.fillStyle = 'rgba(255,240,205,0.55)'; poly([P(0, v + dv + 0.03), P(1, v + dv + 0.03), P(1, v + dv + 0.04), P(0, v + dv + 0.04)]); x.fill();
  }
  // sunlit top edge (cornice)
  x.fillStyle = '#f6e3b0'; poly([P(0, 0.97), P(1, 0.97), P(1, 1.0), P(0, 1.0)]); x.fill();
}
// low-angle sky with phượng canopies (s23), cached
let SKY = null;
function skyPlate() {
  if (SKY) return SKY;
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = TP.lgr(x, 0, 0, 0, H, [[0, '#3d6f96'], [0.35, '#79a6bb'], [0.7, '#d9c39a'], [1, TP.COL.sky2]]); x.fillRect(0, 0, W, H);
  // warm bloom around the sun position (centre-top)
  x.fillStyle = TP.rgr(x, 560, 620, 0, 560, 620, 900, [[0, 'rgba(255,226,170,0.85)'], [0.4, 'rgba(255,200,130,0.35)'], [1, 'rgba(255,190,120,0)']]); x.fillRect(0, 0, W, H);
  // school wall corner seen from below (yellow), bottom-left and right, converging upward
  wallFromBelow(x, [[-20, 1920], [330, 1920], [215, 560], [-20, 470]], '#e2ab3c', '#a7722a');
  wallFromBelow(x, [[1100, 1920], [760, 1920], [870, 520], [1100, 420]], '#d99c32', '#94621f');
  // canopies (undersides: darker, flowers backlit)
  const cols = ['#24402a', '#3b6136', '#5f8a45'];
  TP.canopy(x, -40, 160, 470, { seed: 3, flowers: 1.2, sunlit: 0.4, col: cols, squash: 0.62, leaf: 9 });
  TP.canopy(x, 1130, 260, 500, { seed: 5, flowers: 1.2, sunlit: 0.4, col: cols, squash: 0.62, leaf: 9 });
  TP.canopy(x, 540, -150, 330, { seed: 8, flowers: 1.0, sunlit: 0.4, col: cols, squash: 0.5, leaf: 8 });
  SKY = c; return c;
}

// =====================================================================================
// s21 63.2–66.4: kids crack up, then demo the shake on the beat. "Phải LẮC chú ơi!"
// =====================================================================================
function s21(ctx, lt, p, T) {
  const z = lerp(1.18, 1.3, ease.inOut(p)) * (1 + 0.012 * hit(T));
  plate(ctx, streetPlate('cart', 1100, 10), 560, 1050, z);
  warmAir(ctx, T, 21);
  glow(ctx, 900, 260, 520, 'rgba(255,200,120,0.6)', 0.9);
  const demo = T >= 64.8;
  // tourist on the left, puzzled, still holding his limp un-shaken bag; tries a timid shake on the last bar
  const tPose = T >= 65.6 ? 'shake' : 'hold';
  TP.touristShake(ctx, 170, 2150, 3.4, {
    pose: tPose, t: T * (tPose === 'shake' ? 0.5 : 1), flip: false,
    face: tPose === 'shake' ? { mouth: 'o', mOpen: 0.4, brow: 0.6, lookX: 0.6, turn: 0.35 } : { mouth: 'o', mOpen: 0.3, brow: 0.9, lookX: 0.7, lookY: 0, turn: 0.4, tilt: 0.08 },
    bag: { mix: 0.2 },
  });
  // three kids, right side, back to front
  const kids = [[640, 2110, 3.0, 3, true], [935, 2170, 3.3, 1, true], [420, 2230, 3.2, 4, false]];
  for (const [x, y, s, seed, fl] of kids) {
    let pose = demo ? 'shake' : (seed === 1 ? 'point' : 'laugh');
    const o = { seed, pose, t: kt(T, seed), flip: fl, expr: demo ? 'laugh' : (seed === 1 ? 'laugh' : 'laugh') };
    const r = TP.schoolKid(ctx, x, y, s, o);
    if (demo && r && r.bag) TP.shakeLines(ctx, r.bag[0], r.bag[1], 0.42 * s / 2, { t: T, k: 0.4 + 0.6 * hit(T), dir: 'h', n: 3 });
  }
  if (T >= 65.6) TP.shakeLines(ctx, 170 + 184 * 3.4, 2150 - 292 * 3.4 + 90, 0.45, { t: T, k: 0.35, dir: 'h', n: 2 });
  // foreground bokeh
  L.bokeh(ctx, T, 21, 8, ['rgba(255,210,150,0.8)', 'rgba(255,170,110,0.8)'], 0.25, 30, 80);
  lineFit(ctx, T, 63.4, 66.2, 'Phải LẮC chú ơi!', 'You gotta SHAKE it!', { thump: 1 });
}

// =====================================================================================
// s22 66.4–69.6: shades down, bartender routine on the beat; the kids "ồ" from the bottom of frame
// =====================================================================================
const S22 = [[66.4, 'hold'], [66.8, 'shake'], [67.6, 'overShoulder'], [68.4, 'behindBack'], [69.2, 'shake']];
function s22(ctx, lt, p, T) {
  let pose = 'hold', t0 = 66.4;
  for (const [ts, ps] of S22) if (T >= ts) { pose = ps; t0 = ts; }
  const since = T - t0;
  const z = lerp(1.12, 1.24, ease.inOut(p)) * (1 + 0.015 * hit(T)), rot = Math.sin(T * 1.3) * 0.012;
  plate(ctx, streetPlate('gate', 380, 9), 520, 1020, z, rot);
  // backlight: low sun behind his shoulder
  const sx = 820, sy = 360;
  glow(ctx, sx, sy, 640, 'rgba(255,190,110,0.75)', 1);
  godRays(ctx, sx, sy, 2.1, 1.1, 2200, 9, 'rgba(255,210,150,0.6)', 0.22, T);
  warmAir(ctx, T, 22);
  const tx = 470, ty = 2030, s = 3.1;
  const gk = ease.out(inv(66.45, 66.75, T));
  const face = pose === 'hold' ? { lookY: 0, mouth: 'smile', mOpen: 0.1, brow: -0.2, turn: 0.1 } : pose === 'shake' && T > 69.2 ? { mouth: 'grin', mOpen: 0.6 } : {};
  const r = TP.touristShake(ctx, tx, ty, s, { pose, t: T, glassK: gk, face });
  // rim light on the tourist
  glow(ctx, tx + 60, ty - 385 * s - 40, 260, 'rgba(255,220,160,0.55)', 0.6);
  // glint on the shades as they land
  if (T > 66.7 && T < 67.1) sparkle(ctx, r.head[0] + 60, r.head[1] - 10, 70, 1 - (T - 66.7) / 0.4);
  // swooshes on each move
  const wk = 1 - clamp(since / 0.35);
  if (r.bag && wk > 0 && pose !== 'hold') {
    const [bx, by] = r.bag;
    if (pose === 'shake') TP.whoosh(ctx, bx, by, -0.6 + Math.sin(T * 15) * 0.3, 260, { k: wk, w: 9 });
    if (pose === 'overShoulder') TP.whoosh(ctx, bx, by, -1.9, 360, { k: wk, w: 10, curve: 0.5 });
    if (pose === 'behindBack') TP.whoosh(ctx, bx - 40, by + 30, 2.6, 340, { k: wk, w: 10, curve: -0.4 });
  }
  if (r.bag && pose !== 'hold') TP.shakeLines(ctx, r.bag[0], r.bag[1], 0.5, { t: T, k: 0.6 * hit(T), dir: 'h', n: 2 });
  // kids pop up from the bottom on the trick beats, "ồ" faces
  const pops = [[66.8, 120, 1, 0], [67.6, 960, 2, 1], [68.4, 150, 4, 0], [69.2, 940, 3, 1]];
  for (const [tp, x, seed, side] of pops) {
    if (T < tp - 0.05) continue;
    const up = ease.outBack(clamp((T - tp) / 0.25));
    const y = lerp(2150, 1720, up) + Math.sin(T * 7 + seed) * 6;
    TP.kidFace(ctx, x, y, 0.95, { seed, expr: 'wow', t: T, turn: side ? -0.35 : 0.35, look: [side ? -0.8 : 0.8, -0.6] });
  }
  sparkle(ctx, 830, 330, 60 + 20 * hit(T), 0.5);
}

// =====================================================================================
// s23 69.6–72.8: the big toss. Medium (2 beats) then low angle into the sky. Silence 72.0–72.8: the bag hangs.
// =====================================================================================
function s23(ctx, lt, p, T) {
  if (T < 70.4) {
    const k = inv(69.6, 70.4, T);
    const cy = lerp(1060, 845, ease.in(k));
    plate(ctx, streetPlate('gate', 380, 9), 520, cy, 1.15);
    glow(ctx, 820, 360 + (1060 - cy) * 0.6, 640, 'rgba(255,190,110,0.75)', 1);
    cam(ctx, 540, cy - 60, 1.0, 0, () => {
      const r = TP.touristShake(ctx, 520, 2180, 3.0, { pose: 'toss', k: 0.1 + 0.9 * ease.in(k), t: T, glassK: 1, tossH: 430 });
      if (r.bag) TP.whoosh(ctx, r.bag[0], r.bag[1] + 40, -Math.PI / 2, 420, { k: clamp(k * 3) * (1 - clamp((k - 0.8) * 5)), w: 11, curve: 0.05 });
    });
    warmAir(ctx, T, 23);
    return;
  }
  // low angle
  const sil = inv(72.0, 72.15, T);                 // freeze into slow-mo for the silence
  const te = T < 72 ? T : 72 + (T - 72) * 0.12;   // slowed world time
  const z = 1 + 0.06 * ease.inOut(inv(71.4, 72.8, T));
  cam(ctx, 540, 960, z, 0, () => {
    ctx.drawImage(skyPlate(), 0, 0);
    const sunX = 560, sunY = 610;
    glow(ctx, sunX, sunY, 380, 'rgba(255,236,190,0.9)', 1);
    godRays(ctx, sunX, sunY, Math.PI / 2, 2.6, 1800, 12, 'rgba(255,215,160,0.6)', 0.25, te);
    TP.fallingPetals(ctx, te, 23, 22, 0, -100, W, 1700);
    // bag: rises fast, decelerates to an apex right in front of the sun, then hangs
    const rise = ease.out(inv(70.4, 72.0, T));
    let by = lerp(1950, 660, rise), bx = lerp(600, 560, rise);
    const hang = inv(72.0, 72.8, T);
    by += Math.sin(hang * Math.PI) * -18 + ease.in(clamp((hang - 0.75) / 0.25)) * 40;
    const rot = 5.2 * (1 - Math.exp(-(T - 70.4) * 1.6)) + hang * 0.25;
    const bs = lerp(1.25, 1.05, rise);
    if (rise < 0.9) TP.whoosh(ctx, bx, by + 170 * bs, Math.PI / 2, 380 * (1 - rise), { k: 1 - rise, w: 10, curve: 0.04 });
    at(ctx, bx, by, rot, 1, 1, () => TP.plasticBag(ctx, 0, 0, bs, { tied: true, fill: 0.75, mix: 1, t: te, glow: 0.6 }));
    // backlit rim/halo once it covers the sun
    const ecl = clamp(1 - Math.hypot(bx - sunX, by - sunY) / 260);
    if (ecl > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; glow(ctx, sunX, sunY, 300, 'rgba(255,240,200,1)', 0.55 * ecl); ctx.restore(); TP.sunFlare(ctx, sunX + 140, sunY - 120, 0.6, { alpha: 0.6 * ecl, streak: true }); }
    // the whole gate looking up, heads along the bottom (backlit)
    const heads = [
      ['k', 90, 1780, 0.82, 2, 0.35], ['b', 330, 1700, 0.62, 0, 0.15], ['tour', 545, 1660, 0.9, 0, 0], ['k', 770, 1730, 0.78, 3, -0.2], ['k', 990, 1800, 0.84, 5, -0.4],
      ['k', 230, 1900, 0.9, 1, 0.25], ['k', 860, 1920, 0.92, 4, -0.3],
    ];
    for (const [kind, x, y0, s, seed, turn] of heads) {
      const y = y0 + (T < 72 ? Math.sin(te * 3 + x) * 4 : 0);
      if (kind === 'k') TP.kidFace(ctx, x, y, s, { seed, expr: 'wow', t: te, turn, look: [-turn * 0.6, -1], blink: 0 });
      else if (kind === 'b') TP.coBaFace(ctx, x, y, s, { expr: 'talk', t: te, turn: 0.2, look: [0.3, -1], tilt: 0.12 });
      else PE.face(ctx, x, y, s * 0.95, { lookY: -1, mouth: 'o', mOpen: 0.7, glassesY: 0, tilt: -0.05, t: te, blush: 0.3 });
    }
    // dusk-teal shade over the heads so the sky reads brightest
    ctx.fillStyle = TP.lgr(ctx, 0, 1450, 0, 1920, [[0, 'rgba(20,45,55,0)'], [1, 'rgba(20,45,55,0.45)']]); ctx.fillRect(0, 1450, W, 470);
    dust(ctx, te, 231, 40, 0, 200, W, 1300, '255,230,180', 2.4, 0.6);
  });
  // a hint of breath-held stillness: very soft vignette pull-in during the silence
  if (sil > 0) { ctx.fillStyle = TP.rgr(ctx, 540, 820, 300, 540, 820, 1300, [[0, 'rgba(0,0,0,0)'], [1, `rgba(10,6,4,${0.35 * sil})`]]); ctx.fillRect(0, 0, W, H); }
}

// =====================================================================================
// s24 72.8–76.0: catch (flash) → bite → four flavour ribbons, one per beat, with bilingual labels
// =====================================================================================
const FL_T = [72.8, 73.2, 73.6, 74.0];
function s24(ctx, lt, p, T) {
  const z = lerp(1.32, 1.42, ease.inOut(p)) * (1 + 0.02 * (T > 72.8 && T < 74.4 ? hit(T, 7) : 0));
  plate(ctx, streetPlate('cart', 1100, 14), 600, 900, z);
  glow(ctx, 860, 300, 700, 'rgba(255,190,110,0.7)', 0.9);
  const jit = T < 74.4 ? hit(T, 9) : 0;
  const fx = 540 + Math.sin(T * 47) * 6 * jit, fy = 640 + jit * 8, fs = 1.5;
  const mx = fx, my = fy + 140 * fs;
  // face state
  const bite = inv(72.95, 73.1, T), chewing = T > 73.15;
  const chew = chewing ? 0.25 + 0.35 * Math.abs(Math.sin((T - 73.15) * TAU * 1.25)) : 0;
  const glUp = ease.outBack(inv(73.2, 73.45, T));
  const face = {
    turn: 0.02, t: T, blush: 0.3 + 0.6 * inv(73.2, 74.4, T),
    mouth: T < 72.95 ? 'smile' : T < 73.15 ? 'o' : 'grin', mOpen: T < 72.95 ? 0.2 : T < 73.15 ? 0.6 + bite * 0.4 : chew,
    glassesY: lerp(0, -178, glUp), hairLift: 0.5 * jit + (T > 73.2 ? 0.2 : 0),
    open: T > 73.5 ? 0.02 : 1, happyClosed: 1, brow: T > 73.5 ? -0.3 : 0.3, tilt: Math.sin(T * 2.5) * 0.03,
  };
  // shoulders + face
  PE.face(ctx, fx, fy, fs, face);
  // bag in his left hand at lower-left, caught at 72.8
  const land = ease.outBack(inv(72.8, 72.95, T));
  const bagX = 250, bagY = lerp(1150, 1400, land), sq = T < 73.05 ? 1 + 0.12 * Math.sin(inv(72.95, 73.05, T) * Math.PI) : 1;
  ctx.save(); ctx.translate(bagX, bagY); ctx.scale(1 / sq, sq);
  TP.plasticBag(ctx, 0, 0, 1.05, { open: T > 73.0 ? 1 : 0, tied: T <= 73.0, fill: 0.72, mix: 1, t: T, glow: 0.4 });
  ctx.restore();
  TP.cHand(ctx, bagX - 30, bagY + 120, 1.5, -0.4, { kind: 'grip', flip: true });
  if (T > 73.0 && T < 73.3) sparkle(ctx, bagX, bagY - 150, 70, 1 - inv(73.0, 73.3, T));
  // fork: from the bag up to the mouth, then back down a little while chewing
  const up = ease.inOut(inv(72.95, 73.12, T)), dn = ease.inOut(inv(73.3, 73.8, T));
  const k = up * (1 - dn * 0.55);
  const fkX = lerp(bagX + 80, mx + 70, k), fkY = lerp(bagY - 120, my + 70, k);
  TP.cHand(ctx, fkX + 40, fkY + 120, 1.45, -1.9, { kind: 'pinch' });
  TP.plasticFork(ctx, fkX, fkY, 1.5, lerp(-0.6, -2.4, k), { food: T < 73.12 ? 'mix' : undefined });
  // flavour ribbons + labels, one per beat
  const spin = -T * 0.6 + 0.15 + lt * 0.12;
  FL_T.forEach((t0, i) => {
    const kk = ease.out(inv(t0, t0 + 0.32, T));
    if (kk <= 0) return;
    const an = TP.flavorBurst(ctx, mx, my, 1.0, { t: T, k: kk, only: i, spin });
    const A = an[i], pop = ease.outBack(inv(t0 + 0.05, t0 + 0.3, T));
    const f = TP.FLAVORS[i];
    const vi = ['Chua!', 'Cay!', 'Mặn!', 'Ngọt!'][i], en = ['Sour!', 'Spicy!', 'Salty!', 'Sweet!'][i];
    const LP = [[760, 1150], [185, 760], [500, 195], [850, 760]][i];
    flavorLabel(ctx, LP[0], LP[1] + Math.sin(T * 3 + i) * 6, vi, en, f.col, clamp((T - t0) / 0.15), 0.6 + 0.4 * pop);
  });
  // ingredient confetti out of the mouth
  if (T > 72.95) TP.ingredientBits(ctx, mx, my, 0.9, { t: (T - 72.95) * 0.8, n: 50, seed: 24, gravity: 700, burst: 900 });
}

// =====================================================================================
// s25 76.0–79.2: bliss close-up (1 bar), then the kids clap and Cô Ba gives a thumbs-up (1 bar). "Ghiền luôn!"
// =====================================================================================
function s25(ctx, lt, p, T) {
  if (T < 77.6) {
    const k = inv(76.0, 77.6, T);
    plate(ctx, streetPlate('cart', 1100, 14), 600, 900, lerp(1.35, 1.42, k));
    glow(ctx, 880, 280, 700, 'rgba(255,190,110,0.75)', 1);
    const fy = 720 + Math.sin(T * 2.5) * 6;
    PE.face(ctx, 540, fy, lerp(1.62, 1.72, ease.inOut(k)), {
      turn: Math.sin(T * 1.25) * 0.08, tilt: Math.sin(T * TAU / 1.6) * 0.07, t: T, mouth: 'smile', mOpen: 0.25, open: 0.02, happyClosed: 1,
      blush: 1, glassesY: -178, brow: -0.4, hairLift: 0.1,
    });
    // floating hearts + sparkles
    const r = rng(25);
    for (let i = 0; i < 9; i++) {
      const sp = 0.35 + r() * 0.3, ph = r(), x0 = 120 + r() * 840, life = ((T - 76) * sp + ph) % 1;
      const y = 1250 - life * 1000, x = x0 + Math.sin(T * 2 + i) * 30;
      ctx.save(); ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9;
      heart(ctx, x, y, 0.45 + r() * 0.35, i % 3 ? '#ff6f91' : '#ffb3c6'); ctx.restore();
    }
    for (let i = 0; i < 6; i++) sparkle(ctx, 200 + i * 140, 300 + (i % 2) * 140, 30 + 20 * hit(T + i * 0.1), 0.6);
    warmAir(ctx, T, 25);
  } else {
    const k = inv(77.6, 79.2, T);
    plate(ctx, streetPlate('cart', 1100, 9), 560, 1060, lerp(1.12, 1.18, k) * (1 + 0.01 * hit(T)));
    glow(ctx, 900, 260, 560, 'rgba(255,200,120,0.6)', 0.9);
    // Cô Ba behind, thumbs-up + wink
    TP.coBa(ctx, 680, 2080, 2.75, { pose: 'thumbs', t: kt(T, 0), k: ease.outBack(inv(77.6, 77.9, T)) });
    // clapping kids in front
    TP.schoolKid(ctx, 215, 2230, 3.3, { seed: 2, pose: 'clap', t: kt(T, 2), expr: 'laugh' });
    TP.schoolKid(ctx, 930, 2260, 3.4, { seed: 5, pose: 'clap', t: kt(T, 5), expr: 'laugh', flip: true });
    // clap sparks on the beats
    const hk = hit(T, 10);
    if (hk > 0.2) { sparkle(ctx, 215, 2230 - 224 * 3.3, 80 * hk, hk); sparkle(ctx, 930, 2260 - 224 * 3.4, 80 * hk, hk); }
    warmAir(ctx, T, 26);
  }
  lineFit(ctx, T, 76.2, 79.0, 'Ghiền luôn!', 'Totally hooked!', { thump: 1, vsize: 76 });
}

// =====================================================================================
// s26 79.2–81.6: the whole school gate shakes bags like maracas; the tourist conducts in the middle
// =====================================================================================
const CROWD = (() => {
  // [streetX, feetY, scale, seed, flip, pose]
  const r = rng(260), out = [];
  for (let i = 0; i < 7; i++) out.push([380 + i * 120 + (r() - 0.5) * 40, 1520 + r() * 20, 0.82, i % 6, r() < 0.5, 'shake']);
  for (let i = 0; i < 6; i++) out.push([330 + i * 175 + (r() - 0.5) * 50, 1600 + r() * 30, 0.98, (i + 2) % 6, r() < 0.5, i % 3 === 1 ? 'cheer' : 'shake']);
  for (let i = 0; i < 4; i++) out.push([[300, 480, 1050, 1230][i], 1700 + r() * 30, 1.18, (i + 4) % 6, i >= 2, 'shake']);
  return out.sort((a, b) => a[1] - b[1]);
})();
function s26(ctx, lt, p, T) {
  const z = lerp(1.14, 1.02, ease.inOut(p)) * (1 + 0.018 * hit(T)), cy = 1918 - 960 / z;
  cam(ctx, 540, cy, z, Math.sin(T * TAU / 1.6) * 0.006, () => {
    TP.schoolStreet(ctx, T, 220, {
      gateOpen: 1, petals: 0.8, crowd: 1,
      yard: (c, ox) => {
        for (let i = 0; i < 6; i++) TP.schoolKid(c, 640 + i * 52 + ox, 1440, 0.55, { seed: i, pose: i % 2 ? 'shake' : 'cheer', t: kt(T, i), flip: i % 2 === 0 });
      },
      mid: (c, ox) => {
        let drewT = false;
        for (const [x, y, s, seed, fl, pose] of CROWD) {
          if (!drewT && y > 1640) { tourist(c, ox); drewT = true; }
          const r = TP.schoolKid(c, x + ox, y, s, { seed, pose, t: kt(T, seed), flip: fl });
          if (pose === 'shake' && r && r.bag && s > 0.9) TP.shakeLines(c, r.bag[0], r.bag[1], 0.22 * s, { t: T, k: 0.7 * hit(T), dir: 'h', n: 2 });
        }
        if (!drewT) tourist(c, ox);
      },
    });
  });
  function tourist(c, ox) {
    const r = TP.touristShake(c, 760 + ox, 1650, 1.25, { pose: 'shake', t: T, glassK: 1, face: { mouth: 'grin', mOpen: 0.7 } });
    if (r && r.bag) TP.shakeLines(c, r.bag[0], r.bag[1], 0.3, { t: T, k: hit(T), dir: 'h', n: 3 });
    if (r && r.handL) sparkle(c, r.handL[0], r.handL[1] - 20, 40 * hit(T), 0.9);
  }
  TP.ingredientBits(ctx, 540, 820, 1.25, { t: T, n: 36, seed: 26, loop: true, kinds: ['strip', 'mango', 'peanut', 'chili', 'herb', 'shallot'] });
  lineFit(ctx, T, 79.35, 81.45, 'Lắc cả cổng trường!', 'The whole school shakes!', { y: 330, thump: 1 });
}

// =====================================================================================
// s27 81.6–84.4: crane up and away over a deeper orange-pink Saigon dusk; end card at 82.4
// =====================================================================================
function s27(ctx, lt, p, T) {
  const camY = lerp(1, 0.2, ease.inOut(p));
  const r = TP.saigonAerial(ctx, T, camY, { kids: 1, rays: 0.8, flare: 0.8 });
  // dusk: pink-orange wash over the sky, deeper teal-violet low
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = TP.lgr(ctx, 0, 0, 0, H, [[0, 'rgba(255,90,120,0.75)'], [0.45, 'rgba(255,130,70,0.7)'], [1, 'rgba(70,40,110,0.6)']]); ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(255,170,150,0.35)'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (r && r.sun && r.horizon > -200) {
    glow(ctx, r.sun[0], r.sun[1] + 40, 620, 'rgba(255,120,80,0.6)', 0.8);
    glow(ctx, r.sun[0], r.sun[1] + 40, 140, 'rgba(255,225,190,1)', 0.8);
  }
  endCardFit(ctx, T, 82.4, { l1: 'BÁNH TRÁNG', l2: 'TRỘN', vi: 'Chua. Cay. Giòn. Ghiền!', en: 'Sour. Spicy. Crunchy. Addictive!', s1: 104, s2: 80 });
}

// =====================================================================================
// s28 84.4–90: CTA – like (heart thumps every beat) + follow, comment question, logo, fade
// =====================================================================================
function s28(ctx, lt, p, T) {
  const dk = inv(84.4, 85.2, T);
  plate(ctx, streetPlate('cartSoft', 1100, 16), 560, 1060, lerp(1.25, 1.35, p));
  ctx.fillStyle = `rgba(8,4,2,${0.25 + 0.4 * dk})`; ctx.fillRect(0, 0, W, H);
  // tourist pops up from the bottom: grin, wink on 86.0, thumbs-up
  const rise = ease.outBack(inv(84.4, 85.0, T));
  const wink = T > 86.0 && T < 86.4 ? 0.05 : 1;
  const fy = 1570 + (1 - rise) * 500 + Math.sin(T * TAU * 1.25) * 4;
  PE.face(ctx, 540, fy, 0.62, { turn: 0.05, open: 1, openR: wink, mouth: 'smile', mOpen: 0.4, brow: wink < 1 ? 0.4 : 0, blush: 0.5, t: T, glassesY: -178 });
  const th = ease.outBack(inv(85.6, 86.0, T));
  if (T > 85.6) PE.thumbsUp(ctx, 840, fy - 60 + (1 - th) * 500, 0.8, -0.15 + Math.sin(T * 5) * 0.04);
  ctaLike(ctx, T, 84.4, 84.8, 330, 760);
  ctaFollow(ctx, T, 84.8, 85.6, 700, 760);
  ctaHand(ctx, T, 85.6, 700, 760);
  biText(ctx, X.fadeIO(T, 84.5, 89.4, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  const ca = X.fadeIO(T, 86.0, 89.4, 0.4, 0.4);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    const g = ctx.createLinearGradient(0, 960, 0, 1170); g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.5, 'rgba(8,4,2,0.6)'); g.addColorStop(1, 'rgba(8,4,2,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 960, W, 210); ctx.restore();
    biText(ctx, ca, 1035, 'Bạn thêm mấy muỗng sa tế?', 'How many spoons of chili oil?', { vsize: 56, esize: 38, bd: false });
  }
  logo(ctx, X.fadeIO(T, 85.6, 89.4, 0.5, 0.4), 1210);
  const fb = inv(89.4, 90, T); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s21, s22, s23, s24, s25, s26, s27, s28 };
