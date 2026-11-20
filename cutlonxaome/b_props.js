'use strict';
// b_props.js — writer B props for "Cút lộn xào me" s6–s9 (no black outlines, soft gradient shading).
//   hand(ctx,x,y,s,{rot,kind,skin,sleeve,arm,flip,k})  wrist at (x,y), fingers toward +x (rot rotates)
//        kind 'open' | 'grip' | 'pinch' | 'thumb' | 'point' | 'squeeze'.  -> {tip:[x,y] (pinch/point tip), grip:[x,y]}
//   wokB(ctx,x,y,R,{tilt,heat,inner(ctx,rx,ry),handle})  carbon-steel wok, (x,y) = rim centre, 3/4 top view
//   fireB(ctx,t,x,y,w,k,{seed,h})  layered gas-wok flames (lighter), k 0..1.2; blue ring visible as k→0
//   sauceBowl(ctx,x,y,s,tilt) -> lip [x,y];  streamB(ctx,t,x0,y0,x1,y1,w,k,{seed}) glossy tamarind stream
//   ladleB(ctx,x,y,s,rot,fill) steel ladle (bowl centre at origin, handle +x up);  chopB(ctx,x,y,s,rot,spread)
//   catB(ctx,x,y,s,{pose:'sit'|'crouch'|'leap'|'munch',t,look,mouth,cheek,flip,k}) -> {mouth:[x,y]}
//   saltDish(ctx,x,y,s), limeB(ctx,x,y,s,rot,sq), stool(ctx,x,y,s), table(ctx,x0,y0,x1,y1)
//   nightBg(name) cached blurred alley plates ('cart' | 'close' | 'wide')
const L = require('./lib');
const CT = require('./ctprops');
const { W, H, TAU, rng, clamp, lerp, createCanvas } = L;
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const lgr = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const rgr = (ctx, x0, y0, r0, x1, y1, r1, st) => { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const CACHE = {};
function cached(key, w, h, fn) { if (!CACHE[key]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[key] = c; } return CACHE[key]; }
function blurOf(src, px) { const c = createCanvas(src.width, src.height), x = c.getContext('2d'); x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; return c; }

const SK_CN = ['#f2c69c', '#dca077', '#b8744d'];
const SK_TR = ['#f7d2b5', '#e3a07e', '#c97c5e'];
const LILAC = ['#c9b2e6', '#a98bd0', '#7d62a8'];
const TEAL = ['#46b8ae', '#2f8f8a', '#1f6764'];

// ------------------------------------------------------------------ HAND
function finger(ctx, x0, y0, x1, y1, w, sk, nail = true) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = sk[2]; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = sk[1]; ctx.lineWidth = w * 0.86; ctx.beginPath(); ctx.moveTo(x0, y0 - w * 0.06); ctx.lineTo(x1, y1 - w * 0.06); ctx.stroke();
  ctx.strokeStyle = sk[0]; ctx.lineWidth = w * 0.34; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(x0, y0 - w * 0.22); ctx.lineTo(lerp(x0, x1, 0.92), lerp(y0, y1, 0.92) - w * 0.22); ctx.stroke(); ctx.globalAlpha = 1;
  if (nail) { const a = Math.atan2(y1 - y0, x1 - x0); ell(ctx, x1 - Math.cos(a) * w * 0.12, y1 - Math.sin(a) * w * 0.12 - w * 0.12, w * 0.3, w * 0.22, a); ctx.fillStyle = 'rgba(255,226,214,0.85)'; ctx.fill(); }
}
function knuckle(ctx, x, y, r, sk) { ell(ctx, x, y, r, r * 0.86); ctx.fillStyle = rgr(ctx, x - r * 0.3, y - r * 0.4, 1, x, y, r * 1.1, [[0, sk[0]], [0.6, sk[1]], [1, sk[2]]]); ctx.fill(); }
function hand(ctx, x, y, s = 1, o = {}) {
  const sk = o.skin || SK_CN, kind = o.kind || 'open', arm = o.arm == null ? 220 : o.arm, sq = clamp(o.k || 0), fl = o.flip ? -1 : 1;
  const out = {};
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s * fl);
  // forearm
  if (arm > 0) {
    ctx.beginPath(); ctx.moveTo(-arm, -30); ctx.quadraticCurveTo(-arm * 0.5, -32, 4, -24); ctx.lineTo(4, 24); ctx.quadraticCurveTo(-arm * 0.5, 32, -arm, 32); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -32, 0, 32, [[0, sk[0]], [0.45, sk[1]], [1, sk[2]]]); ctx.fill();
    if (o.sleeve) {
      const sl = o.sleeve;
      ctx.beginPath(); ctx.roundRect(-arm - 60, -44, arm * 0.62 + 60, 88, 30);
      ctx.fillStyle = lgr(ctx, 0, -44, 0, 44, [[0, sl[0]], [0.5, sl[1]], [1, sl[2]]]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-arm * 0.38 - 18, -42, 14, 84);
    }
  }
  // palm / back of hand
  ell(ctx, 34, 2, 44, 34); ctx.fillStyle = rgr(ctx, 24, -14, 4, 34, 2, 52, [[0, sk[0]], [0.65, sk[1]], [1, sk[2]]]); ctx.fill();
  if (kind === 'open') {
    for (let i = 0; i < 4; i++) { const yy = -20 + i * 14; finger(ctx, 66, yy, 118 - Math.abs(i - 1.2) * 8, yy + (i - 1.5) * 6, 17 - i * 1.2, sk); }
    finger(ctx, 30, -26, 64, -52, 19, sk); out.tip = [x, y];
  } else if (kind === 'grip' || kind === 'squeeze') {
    const t = kind === 'squeeze' ? 1 - sq * 0.25 : 1;
    for (let i = 0; i < 4; i++) knuckle(ctx, 68 * t + 4, -21 + i * 14.5, 12.5 - i * 0.6, sk);
    finger(ctx, 26, -26, 70 * t, -32, 20, sk);
    out.grip = [70, 0];
  } else if (kind === 'pinch') {
    for (let i = 1; i < 4; i++) knuckle(ctx, 66, -10 + i * 13, 12 - i * 0.6, sk);
    const cl = sq * 6;
    finger(ctx, 60, -12, 106, -14 + cl * 0.5, 15, sk);
    finger(ctx, 24, -28, 102, -22 - cl * 0.5, 18, sk);
    out.tip = [106, -18];
  } else if (kind === 'point') {
    for (let i = 1; i < 4; i++) knuckle(ctx, 64, -8 + i * 13, 12 - i * 0.6, sk);
    finger(ctx, 60, -14, 130, -18, 16, sk); finger(ctx, 26, -26, 66, -30, 19, sk);
    out.tip = [130, -18];
  } else if (kind === 'thumb') { // fist, thumb along -y (up when rot = 0)
    for (let i = 0; i < 4; i++) knuckle(ctx, 66, -18 + i * 14, 13 - i * 0.5, sk);
    finger(ctx, 40, -22, 44, -78, 22, sk);
  }
  ctx.restore();
  const tr = (p) => { if (!p) return null; const c = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0), px = p[0] * s, py = p[1] * s * fl; return [x + px * c - py * sn, y + px * sn + py * c]; };
  return { tip: tr(out.tip), grip: tr(out.grip) };
}

// ------------------------------------------------------------------ WOK
function wokB(ctx, x, y, R, o = {}) {
  const ry = R * 0.38, depth = R * 0.6, heat = o.heat == null ? 1 : o.heat;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0);
  // long wooden handle (right) + steel neck
  if (o.handle !== false) {
    ctx.save(); ctx.translate(R * 0.9, -ry * 0.15); ctx.rotate(-0.2);
    ctx.fillStyle = lgr(ctx, 0, -16, 0, 16, [[0, '#9aa0a8'], [1, '#4a4e56']]); ctx.beginPath(); ctx.roundRect(0, -13, R * 0.32, 26, 10); ctx.fill();
    ctx.fillStyle = lgr(ctx, 0, -24, 0, 24, [[0, '#b0773c'], [0.5, '#7a4a20'], [1, '#4a2a10']]); ctx.beginPath(); ctx.roundRect(R * 0.3, -22, R * 0.9, 44, 20); ctx.fill();
    ctx.restore();
    // side loop handle (left)
    ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = R * 0.035; ctx.beginPath(); ctx.ellipse(-R * 1.02, -ry * 0.05, R * 0.09, R * 0.06, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  }
  // outer bowl
  ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R * 0.9, depth * 1.2, R * 0.9, depth * 1.2, R, 0); ctx.ellipse(0, 0, R, ry, 0, 0, Math.PI, true); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, -ry, 0, depth, [[0, '#4a4b52'], [0.5, '#24252b'], [1, '#0e0e12']]); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rgr(ctx, 0, depth * 1.05, 10, 0, depth * 0.8, R * 0.95, [[0, `rgba(255,140,50,${0.75 * heat})`], [0.5, `rgba(200,70,20,${0.35 * heat})`], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(-R, -ry, 2 * R, depth + ry);
  ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, 'rgba(0,0,0,0)'], [0.14, 'rgba(120,180,230,0.28)'], [0.22, 'rgba(0,0,0,0)'], [0.82, 'rgba(0,0,0,0)'], [0.9, 'rgba(255,120,190,0.22)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(-R, -ry, 2 * R, depth + ry);
  ctx.restore();
  // inside surface
  const irx = R * 0.955, iry = ry * 0.93;
  ell(ctx, 0, 2, irx, iry); ctx.fillStyle = rgr(ctx, 0, iry * 0.25, 10, 0, 0, irx, [[0, '#2c2420'], [0.6, '#3a332f'], [1, '#5b5550']]); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ell(ctx, -irx * 0.25, -iry * 0.35, irx * 0.5, iry * 0.25); ctx.fillStyle = 'rgba(160,190,220,0.12)'; ctx.fill(); ctx.restore();
  if (o.inner) {
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 2, irx, iry, 0, 0, Math.PI); ctx.lineTo(-irx, -R * 3); ctx.lineTo(irx, -R * 3); ctx.closePath(); ctx.clip();
    o.inner(ctx, irx, iry); ctx.restore();
  }
  // rim: front lip light, back lip darker
  ctx.lineWidth = R * 0.022;
  ctx.strokeStyle = '#6e7078'; ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, Math.PI, TAU); ctx.stroke();
  ctx.strokeStyle = lgr(ctx, -R, 0, R, 0, [[0, '#8a8d96'], [0.3, '#d4d8de'], [0.5, '#9a9da6'], [0.8, '#ffc58a'], [1, '#6e7078']]); ctx.beginPath(); ctx.ellipse(0, 0, R, ry, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ FLAMES
function tongue(ctx, x, y, w, h, lean) {
  ctx.beginPath(); ctx.moveTo(x - w, y);
  ctx.bezierCurveTo(x - w * 0.9, y - h * 0.45, x + lean * 0.5 - w * 0.3, y - h * 0.7, x + lean, y - h);
  ctx.bezierCurveTo(x + lean * 0.5 + w * 0.4, y - h * 0.65, x + w * 0.95, y - h * 0.4, x + w, y); ctx.closePath();
}
function fireB(ctx, t, x, y, w, k, o = {}) {
  const r = rng(o.seed || 7), n = o.n || 11, hh = (o.h || 260) * k;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // blue gas crown (always while on)
  if (o.blue !== 0) {
    const bk = o.blue == null ? clamp(0.4 + 0.6 * (1 - k)) : o.blue;
    for (let i = 0; i < 16; i++) {
      const fx = x + (i / 15 - 0.5) * w * 0.8, bh = (36 + 14 * Math.sin(t * 23 + i * 2.1)) * (o.bs || 1);
      tongue(ctx, fx, y, 16 * (o.bs || 1), bh, Math.sin(t * 9 + i) * 6);
      ctx.fillStyle = lgr(ctx, 0, y - bh, 0, y, [[0, 'rgba(80,140,255,0)'], [0.6, `rgba(70,120,255,${0.5 * bk})`], [1, `rgba(150,220,255,${0.8 * bk})`]]); ctx.fill();
    }
  }
  if (k > 0.02) {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n - 0.5, ph = r() * TAU, sp = 7 + r() * 6;
      const fx = x + u * w + Math.sin(t * 3 + ph) * 10;
      const h = hh * (0.55 + 0.45 * r()) * (1 - Math.abs(u) * 0.8) * (0.8 + 0.25 * Math.sin(t * sp + ph));
      const fw = w / n * (0.9 + r() * 0.5), lean = Math.sin(t * 5 + ph) * 24 + u * 60;
      tongue(ctx, fx, y, fw, h, lean);
      ctx.fillStyle = lgr(ctx, 0, y - h, 0, y, [[0, 'rgba(255,60,10,0)'], [0.35, `rgba(255,110,20,${0.55})`], [0.75, `rgba(255,190,60,0.8)`], [1, 'rgba(255,240,180,0.9)']]); ctx.fill();
      tongue(ctx, fx, y, fw * 0.45, h * 0.6, lean * 0.6);
      ctx.fillStyle = lgr(ctx, 0, y - h * 0.6, 0, y, [[0, 'rgba(255,230,150,0)'], [1, 'rgba(255,250,220,0.85)']]); ctx.fill();
    }
  }
  ctx.restore();
  if (k > 0.02) L.glow(ctx, x, y - hh * 0.3, w * 0.7 + hh, `rgba(255,140,50,${clamp(0.5 * k)})`, 1, 'screen');
}

// ------------------------------------------------------------------ SAUCE
const SAUCE = ['#5a2410', '#8a3a14', '#a8501c', '#d07a3a'];
function sauceBowl(ctx, x, y, s, tilt = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-90, 0); ctx.bezierCurveTo(-86, 70, 86, 70, 90, 0); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, 0, 0, 64, [[0, '#f4f1ea'], [1, '#a9b4c2']]); ctx.fill();
  ctx.strokeStyle = '#3f7fc4'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-86, 16); ctx.bezierCurveTo(-60, 34, 60, 34, 86, 16); ctx.stroke();
  ell(ctx, 0, 0, 90, 22); ctx.fillStyle = '#e8e4dc'; ctx.fill();
  ell(ctx, 0, 2, 80, 17); ctx.fillStyle = rgr(ctx, -20, -4, 2, 0, 0, 80, [[0, SAUCE[3]], [0.5, SAUCE[2]], [1, SAUCE[0]]]); ctx.fill();
  ell(ctx, -26, -4, 22, 5); ctx.fillStyle = 'rgba(255,240,220,0.6)'; ctx.fill();
  ctx.restore();
  const c = Math.cos(tilt), sn = Math.sin(tilt);
  return [x + (-88 * c) * s, y + (-88 * sn) * s];
}
function streamB(ctx, t, x0, y0, x1, y1, w, k, o = {}) {
  if (k <= 0) return;
  const k0 = clamp(o.k0 || 0), kk = clamp(k);
  const P = (u) => { const sag = Math.sin(u * Math.PI) * (o.sag || 30); return [lerp(x0, x1, u) + Math.sin(t * 9 + u * 7) * 4 * u - sag * 0.3, lerp(y0, y1, u * u * 0.4 + u * 0.6)]; };
  const N = 18, pts = []; for (let i = 0; i <= N; i++) { const u = lerp(k0, kk, i / N); pts.push([P(u), lerp(w, w * 0.62, u)]); }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [col, f, dx] of [[SAUCE[0], 1, 0], [SAUCE[1], 0.78, -0.08], [SAUCE[2], 0.42, -0.2], ['rgba(255,236,210,0.75)', 0.12, -0.26]]) {
    ctx.strokeStyle = col;
    for (let i = 1; i < pts.length; i++) { const [a, wa] = pts[i - 1], [b] = pts[i]; ctx.lineWidth = wa * f; ctx.beginPath(); ctx.moveTo(a[0] + wa * dx, a[1]); ctx.lineTo(b[0] + wa * dx, b[1]); ctx.stroke(); }
  }
  ctx.restore();
  return pts[pts.length - 1][0];
}

// ------------------------------------------------------------------ LADLE / CHOPSTICKS / LIME / SALT
function ladleB(ctx, x, y, s, rot, fill) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = lgr(ctx, 0, -10, 0, 10, [[0, '#e6e9ee'], [1, '#6c7178']]);
  ctx.beginPath(); ctx.moveTo(70, -12); ctx.quadraticCurveTo(200, -60, 420, -70); ctx.lineTo(420, -54); ctx.quadraticCurveTo(200, -42, 72, 8); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-90, 0); ctx.bezierCurveTo(-88, 80, 88, 80, 90, 0); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, 0, 0, 70, [[0, '#c7ccd3'], [0.5, '#7e848c'], [1, '#3e434a']]); ctx.fill();
  ell(ctx, 0, 0, 90, 26); ctx.fillStyle = rgr(ctx, 0, 8, 2, 0, 0, 90, [[0, '#40444a'], [1, '#9aa0a8']]); ctx.fill();
  if (fill) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 86, 24, 0, 0, Math.PI); ctx.lineTo(-86, -300); ctx.lineTo(86, -300); ctx.closePath(); ctx.clip(); fill(ctx); ctx.restore(); }
  ctx.strokeStyle = '#e8ecf0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, 0, 90, 26, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
}
function chopB(ctx, x, y, s, rot = 0, spread = 0.05) { // tips at origin, handles toward +x
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  for (const d of [-spread, spread]) {
    ctx.save(); ctx.rotate(d);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(430, -8); ctx.lineTo(430, 8); ctx.lineTo(0, 3); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -8, 0, 8, [[0, '#f0d6a2'], [0.5, '#c99a5a'], [1, '#8a5e2c']]); ctx.fill();
    ctx.fillStyle = '#b8402e'; ctx.fillRect(330, -7.5, 100, 15);
    ctx.restore();
  }
  ctx.restore();
}
function chop2(ctx, hx, hy, tx, ty, gap, s = 1) { // pair of chopsticks: handle end near (hx,hy), tips apart by gap at (tx,ty)
  const dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, px = -uy, py = ux;
  for (const sg of [-1, 1]) {
    const bx = hx - ux * 70 * s + px * sg * 7 * s + (sg > 0 ? ux * 20 * s : 0), by = hy - uy * 70 * s + py * sg * 7 * s + (sg > 0 ? uy * 20 * s : 0);
    const ex = tx + px * sg * gap / 2, ey = ty + py * sg * gap / 2;
    const a = Math.atan2(ey - by, ex - bx), L2 = Math.hypot(ex - bx, ey - by);
    ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, -8 * s); ctx.lineTo(L2, -2.6 * s); ctx.lineTo(L2, 2.6 * s); ctx.lineTo(0, 8 * s); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -8 * s, 0, 8 * s, [[0, '#f3dcaa'], [0.5, '#c99a5a'], [1, '#86592a']]); ctx.fill();
    ctx.fillStyle = '#c0412f'; ctx.fillRect(0, -8 * s, 70 * s, 16 * s);
    ctx.restore();
  }
}
function limeB(ctx, x, y, s, rot = 0, sq = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * (1 + sq * 0.12), s * (1 - sq * 0.3));
  ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI); ctx.closePath(); ctx.fillStyle = lgr(ctx, 0, 0, 0, 40, [[0, '#7cc23e'], [1, '#3e7a1c']]); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#e4f29a'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,240,0.8)'; ctx.lineWidth = 2.5;
  for (let i = 1; i < 6; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(Math.cos(a) * 31, Math.sin(a) * 31); ctx.stroke(); }
  ell(ctx, 0, 0, 40, 6); ctx.fillStyle = '#f2f8c8'; ctx.fill();
  ctx.restore();
}
function saltDish(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ell(ctx, 0, 14, 110, 34); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  ell(ctx, 0, 0, 100, 34); ctx.fillStyle = lgr(ctx, 0, -34, 0, 34, [[0, '#ffffff'], [1, '#b8c2cf']]); ctx.fill();
  ell(ctx, 0, -2, 78, 24); ctx.fillStyle = '#d5dce5'; ctx.fill();
  const r = rng(55);
  ell(ctx, -6, -8, 52, 16); ctx.fillStyle = '#e9e6df'; ctx.fill();
  for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()); ctx.fillStyle = r() < 0.45 ? '#2a2622' : r() < 0.5 ? '#8a847c' : '#ffffff'; ctx.fillRect(-6 + Math.cos(a) * 50 * d, -8 + Math.sin(a) * 15 * d - 3, 2.6, 2.6); }
  ctx.restore();
}
function stool(ctx, x, y, s, col = ['#e8473c', '#b8281f', '#7a1610']) { // red plastic stool, (x,y) = seat top centre
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ell(ctx, 0, 250, 150, 26); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-110, 10); ctx.lineTo(-138, 250); ctx.lineTo(138, 250); ctx.lineTo(110, 10); ctx.closePath();
  ctx.fillStyle = lgr(ctx, -140, 0, 140, 0, [[0, col[2]], [0.35, col[1]], [0.7, col[0]], [1, col[1]]]); ctx.fill();
  ctx.fillStyle = 'rgba(20,6,10,0.45)'; ctx.beginPath(); ctx.moveTo(-70, 70); ctx.quadraticCurveTo(0, 30, 70, 70); ctx.lineTo(80, 250); ctx.lineTo(-80, 250); ctx.closePath(); ctx.fill();
  ell(ctx, 0, 0, 120, 34); ctx.fillStyle = lgr(ctx, 0, -34, 0, 34, [[0, '#ff7a6a'], [1, col[1]]]); ctx.fill();
  ell(ctx, 0, 0, 92, 24); ctx.fillStyle = 'rgba(120,20,16,0.35)'; ctx.fill();
  ctx.restore();
}
function table(ctx, x0, y0, x1, y1, o = {}) { // blue plastic table top seen 3/4: back edge y0, runs past y1
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 26);
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y1, [[0, '#2f6fb8'], [0.4, '#2560a4'], [1, '#14386a']]); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y0 + 60, [[0, 'rgba(160,210,255,0.5)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x0, y0, x1 - x0, 60);
  if (o.warm !== 0) { ctx.fillStyle = rgr(ctx, o.wx || (x0 + x1) / 2, o.wy || y0 + 200, 10, o.wx || (x0 + x1) / 2, o.wy || y0 + 200, 520, [[0, 'rgba(255,160,70,0.35)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
  ctx.fillStyle = rgr(ctx, x0 + 120, y0 + 140, 10, x0 + 120, y0 + 140, 300, [[0, 'rgba(255,80,170,0.25)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(10,30,70,0.35)'; ctx.lineWidth = 3;
  for (let i = 1; i < 9; i++) { const yy = y0 + (y1 - y0) * Math.pow(i / 9, 1.3); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
  ctx.restore(); ctx.restore();
}

// ------------------------------------------------------------------ CAT (orange tabby, active poses)
const CATP = ['#f6b96a', '#e0913e', '#b5651f', '#8a4a16'];
function catHead(ctx, hx, hy, o) {
  const p = CATP, mouth = o.mouth || 0, ch = o.cheek || 0, closed = o.closed;
  for (const [ex0, rot] of [[-30, -0.3], [30, 0.3]]) {
    ctx.save(); ctx.translate(hx + ex0, hy - 34); ctx.rotate(rot + (o.earFlick || 0) * (ex0 > 0 ? 1 : 0));
    ctx.beginPath(); ctx.moveTo(-19, 10); ctx.quadraticCurveTo(-4, -34, 2, -40); ctx.quadraticCurveTo(10, -30, 19, 10); ctx.closePath(); ctx.fillStyle = lgr(ctx, 0, -40, 0, 10, [[0, p[2]], [1, p[1]]]); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(0, -26); ctx.lineTo(10, 6); ctx.closePath(); ctx.fillStyle = '#f2a2a0'; ctx.fill();
    ctx.restore();
  }
  ell(ctx, hx, hy, 52 + ch * 8, 44 + ch * 3); ctx.fillStyle = rgr(ctx, hx - 14, hy - 18, 4, hx, hy, 60, [[0, p[0]], [0.7, p[1]], [1, p[2]]]); ctx.fill();
  if (ch > 0) for (const sx of [-1, 1]) { ell(ctx, hx + sx * 34, hy + 16, 22 * ch + 4, 18 * ch + 4); ctx.fillStyle = rgr(ctx, hx + sx * 30, hy + 10, 2, hx + sx * 34, hy + 16, 30, [[0, '#ffe2bf'], [1, p[1]]]); ctx.fill(); }
  ctx.strokeStyle = 'rgba(138,74,22,0.65)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hx + i * 11, hy - 42); ctx.lineTo(hx + i * 9, hy - 26); ctx.stroke(); }
  ell(ctx, hx, hy + 18, 26, 17); ctx.fillStyle = 'rgba(255,242,226,0.9)'; ctx.fill();
  // eyes
  const lx = (o.look || 0) * 4, ly = (o.lookY || 0) * 4, op = o.open == null ? 1 : o.open;
  for (const sx of [-1, 1]) {
    const ex = hx + sx * 21, ey = hy - 6;
    if (closed) { ctx.strokeStyle = '#4a2410'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(ex - 11, ey + 3); ctx.quadraticCurveTo(ex, ey - 9, ex + 11, ey + 3); ctx.stroke(); continue; }
    ell(ctx, ex, ey, 14, 16 * op); ctx.fillStyle = rgr(ctx, ex, ey - 4, 2, ex, ey, 16, [[0, '#f4ff9a'], [0.7, '#b8d84a'], [1, '#6f8a22']]); ctx.fill();
    ell(ctx, ex + lx, ey + ly, 5 + (o.pupil || 0) * 5, 12 * op); ctx.fillStyle = '#1a120c'; ctx.fill();
    ell(ctx, ex + lx - 4, ey + ly - 6 * op, 4, 4 * op); ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  // nose + mouth
  ctx.fillStyle = '#e07a80'; ctx.beginPath(); ctx.moveTo(hx, hy + 12); ctx.lineTo(hx - 6, hy + 5); ctx.lineTo(hx + 6, hy + 5); ctx.closePath(); ctx.fill();
  if (mouth > 0.05) { ell(ctx, hx, hy + 24 + mouth * 6, 10 + mouth * 6, 4 + mouth * 14); ctx.fillStyle = '#7a2a2a'; ctx.fill(); ell(ctx, hx, hy + 30 + mouth * 12, 6 + mouth * 3, 3 + mouth * 4); ctx.fillStyle = '#e88a90'; ctx.fill(); }
  else { ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hx - 9, hy + 18); ctx.quadraticCurveTo(hx - 4, hy + 22, hx, hy + 13); ctx.quadraticCurveTo(hx + 4, hy + 22, hx + 9, hy + 18); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.6;
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(hx + sx * 22, hy + 14 + i * 4); ctx.lineTo(hx + sx * 62, hy + 6 + i * 9); ctx.stroke(); }
}
function catB(ctx, x, y, s = 1, o = {}) {
  const p = CATP, pose = o.pose || 'sit', t = o.t || 0, fl = o.flip ? -1 : 1, k = clamp(o.k == null ? 1 : o.k);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * fl, s); ctx.lineCap = 'round';
  let mouth = [0, 0];
  const tailStroke = (path, w) => { ctx.strokeStyle = p[2]; ctx.lineWidth = w; ctx.stroke(path); ctx.strokeStyle = p[1]; ctx.lineWidth = w * 0.75; ctx.stroke(path); ctx.strokeStyle = p[3]; ctx.setLineDash([7, 14]); ctx.stroke(path); ctx.setLineDash([]); };
  if (pose === 'leap') {
    // body stretched up toward +x; k 0..1 stretch
    const { Path2D } = require('@napi-rs/canvas');
    const tp = new Path2D(); tp.moveTo(-70, -40); tp.bezierCurveTo(-130, -10, -150, 40, -190 + Math.sin(t * 9) * 10, 30);
    tailStroke(tp, 20);
    ctx.save(); ctx.translate(-10, -70); ctx.rotate(-0.55 * k);
    // hind legs trailing
    for (const dy of [8, -6]) { ctx.strokeStyle = dy > 0 ? p[2] : p[1]; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(-50, dy + 10); ctx.lineTo(-110, dy + 42); ctx.stroke(); }
    ell(ctx, 0, 0, 86 + 14 * k, 38); ctx.fillStyle = rgr(ctx, -10, -20, 4, 0, 0, 100, [[0, p[0]], [0.7, p[1]], [1, p[2]]]); ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 86 + 14 * k, 38); ctx.clip(); ctx.strokeStyle = 'rgba(138,74,22,0.55)'; ctx.lineWidth = 8;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 22, -40); ctx.quadraticCurveTo(i * 22 + 8, -18, i * 22, -4); ctx.stroke(); }
    ell(ctx, 10, 26, 70, 12); ctx.fillStyle = 'rgba(255,240,220,0.55)'; ctx.fill(); ctx.restore();
    // front legs reaching
    for (const dy of [-10, 8]) { ctx.strokeStyle = dy > 0 ? p[1] : p[2]; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(60, dy); ctx.lineTo(118, dy - 26); ctx.stroke(); ell(ctx, 124, dy - 28, 14, 11); ctx.fillStyle = p[0]; ctx.fill(); }
    ctx.restore();
    const hx = 66, hy = -150;
    catHead(ctx, hx, hy, { ...o, mouth: o.mouth == null ? 1 : o.mouth });
    mouth = [hx, hy + 30];
  } else {
    const crouch = pose === 'crouch' ? k : 0, br = 1 + 0.03 * Math.sin(t * 2.4);
    const { Path2D } = require('@napi-rs/canvas');
    const tp = new Path2D(); const tw = Math.sin(t * 2.2) * 14 + (pose === 'crouch' ? Math.sin(t * 14) * 16 : 0);
    tp.moveTo(-40, -20); tp.bezierCurveTo(-110, -10, -110, 10, -60, 6); tp.quadraticCurveTo(10, 4, 60 + tw, -10 - Math.abs(tw) * 0.3);
    tailStroke(tp, 20);
    // haunch + body
    ell(ctx, -18, -40 + crouch * 10, 56, 42 - crouch * 6); ctx.fillStyle = rgr(ctx, -30, -60, 4, -18, -40, 64, [[0, p[0]], [0.7, p[1]], [1, p[2]]]); ctx.fill();
    ctx.save(); ctx.translate(6, -84 + crouch * 30); ctx.rotate(-0.12 + crouch * 0.5); ctx.scale(1, br);
    ell(ctx, 0, 0, 44, 62 - crouch * 14); ctx.fillStyle = rgr(ctx, -10, -20, 4, 0, 0, 70, [[0, p[0]], [0.7, p[1]], [1, p[2]]]); ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 44, 62 - crouch * 14); ctx.clip(); ctx.strokeStyle = 'rgba(138,74,22,0.5)'; ctx.lineWidth = 8;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-46, i * 22); ctx.quadraticCurveTo(-26, i * 22 + 8, -12, i * 22); ctx.stroke(); }
    ell(ctx, 20, 10, 22, 46); ctx.fillStyle = 'rgba(255,242,226,0.85)'; ctx.fill(); ctx.restore();
    ctx.restore();
    // front legs
    for (const dx of [8, 34]) { ctx.strokeStyle = dx > 20 ? p[1] : p[2]; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(dx, -70 + crouch * 20); ctx.lineTo(dx + 4 + crouch * 14, -8); ctx.stroke(); ell(ctx, dx + 6 + crouch * 14, -6, 15, 9); ctx.fillStyle = p[0]; ctx.fill(); }
    // head
    const chew = pose === 'munch' ? Math.sin(t * 18) : 0;
    const hx = 16 + crouch * 30, hy = -158 + crouch * 56 + chew * 3;
    catHead(ctx, hx, hy, { ...o, closed: pose === 'munch' ? o.closed !== false : o.closed, mouth: pose === 'munch' ? 0.08 + Math.max(0, chew) * 0.25 : o.mouth });
    mouth = [hx, hy + 26];
  }
  ctx.restore();
  return { mouth: [x + mouth[0] * s * fl, y + mouth[1] * s] };
}

// ------------------------------------------------------------------ BACKGROUNDS (cached, blurred)
function nightBg(name) {
  return cached('bg_' + name, W, H, (x) => {
    const t = createCanvas(W, H), tx = t.getContext('2d');
    tx.fillStyle = '#0f1c2e'; tx.fillRect(0, 0, W, H);
    tx.save();
    if (name === 'close') { tx.translate(W / 2, H / 2); tx.scale(1.7, 1.7); tx.translate(-W / 2 - 120, -H / 2 + 260); }
    else if (name === 'wide') { tx.translate(W / 2, H / 2); tx.scale(1.25, 1.25); tx.translate(-W / 2 + 60, -H / 2 + 120); }
    CT.alley(tx, 1.3, { view: 'cart', dawn: 0, neon: 1 });
    tx.restore();
    const px = name === 'close' ? 26 : 20;
    x.drawImage(blurOf(t, px), 0, 0);
    // cool ambient + darken lower part, warm pool centre
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = lgr(x, 0, 0, 0, H, [[0, 'rgb(170,190,230)'], [0.55, 'rgb(150,170,210)'], [1, 'rgb(80,100,140)']]); x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'screen';
    x.fillStyle = rgr(x, W * 0.5, H * 0.62, 20, W * 0.5, H * 0.62, 760, [[0, 'rgba(255,150,60,0.28)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, W, H);
    // neon bokeh discs
    const r = rng(name.length * 31 + 7);
    for (let i = 0; i < 26; i++) {
      const bx = r() * W, by = r() * H * 0.62, rr = 18 + r() * 60, col = r() < 0.4 ? '255,70,170' : r() < 0.6 ? '60,220,255' : '255,190,110';
      x.fillStyle = rgr(x, bx, by, rr * 0.2, bx, by, rr, [[0, `rgba(${col},0.32)`], [0.8, `rgba(${col},0.22)`], [1, 'rgba(0,0,0,0)']]);
      x.beginPath(); x.arc(bx, by, rr, 0, TAU); x.fill();
    }
    x.globalCompositeOperation = 'source-over';
  });
}

// place a hand so that its local anchor point (e.g. grip [70,0], pinch tip [106,-18]) lands on (px,py); fingers along ang
function handAt(ctx, px, py, anchor, ang, hs, o = {}) {
  const fl = o.flip ? -1 : 1, ax = anchor[0] * hs, ay = anchor[1] * hs * fl, c = Math.cos(ang), sn = Math.sin(ang);
  return hand(ctx, px - (ax * c - ay * sn), py - (ax * sn + ay * c), hs, Object.assign({}, o, { rot: ang }));
}
module.exports = { handAt, chop2, hand, wokB, fireB, sauceBowl, streamB, ladleB, chopB, limeB, saltDish, stool, table, catB, nightBg, SK_CN, SK_TR, LILAC, TEAL, SAUCE, ell, lgr, rgr, cached, blurOf };
