'use strict';
// shotsA.js — "Bánh xèo miền Tây" 40 s cut · shots s1..s9 (0 – 17.5 s) = scene 1 hook, scene 2 ingredients, scene 3 pour/fold.
// Grid 72 BPM (beat 0.8333 s). Each shot sN(ctx, lt, p, T) paints the full opaque frame; render.js adds grade, vignette,
// flashes and grain, overlay.js adds every caption (NO text here).
// Look: dark riverside kitchen, red-orange wood-fire glow, golden sunset beams through bamboo slats cutting steam.
// Calm premium food-ad camera: slow dollies, macro, shallow depth of field (blurred layers), rack focus by animating blur.
// Match cut contract: the LAST frame of s9 shows the round pan seen from straight above, pan centre (540, 1060),
// pan inner radius 330 px (BX.pan s = 1.486, top view), folded half-moon crêpe centred in it (straight fold edge on top).
const BX = require('./bxprops');
const L = require('./lib');
const NP = BX.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- small helpers
const seg = (v, a, b) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const lgr = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const rgr = (ctx, x0, y0, r0, x1, y1, r1, st) => { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => { const A = hx(a), B = hx(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };
const flick = (T, s = 0) => 0.82 + 0.18 * Math.sin(T * 19 + s) * Math.sin(T * 5.3 + s * 2);
const SKIN_A = ['#ecbb92', '#d9a27a', '#b27a58'], SKIN = '#d9a27a';
const SLEEVE = (BX.MATU && BX.MATU.aoba) || '#7a2430', SLEEVE_D = (BX.MATU && BX.MATU.aobaD) || '#4e1520';
const WARM = ['rgba(255,190,110,1)', 'rgba(255,140,60,1)', 'rgba(255,225,170,1)'];

const CACHE = {};
function cached(name, w, h, fn) {
  if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; }
  return CACHE[name];
}
const BUFS = {};
function buf(name, w = W, h = H) {
  if (!BUFS[name]) BUFS[name] = createCanvas(w, h);
  const c = BUFS[name], x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  x.clearRect(0, 0, w, h);
  return [c, x];
}
// draw a full-frame layer with a lens blur (rack focus = animate b)
function blurDraw(ctx, src, b, a = 1) {
  ctx.save(); ctx.globalAlpha = a;
  if (b > 0.35) ctx.filter = `blur(${b.toFixed(2)}px)`;
  ctx.drawImage(src, 0, 0); ctx.restore();
}
// depth of field: blurred everywhere, sharp inside a soft vertical band (y0→y1 ramp in, y2→y3 ramp out)
function focusBand(ctx, src, b, y0, y1, y2 = H + 10, y3 = H + 20) {
  blurDraw(ctx, src, b);
  const [m, mx] = buf('fband');
  mx.drawImage(src, 0, 0);
  mx.globalCompositeOperation = 'destination-in';
  mx.fillStyle = lgr(mx, 0, y0, 0, y3, [[0, 'rgba(0,0,0,0)'], [(y1 - y0) / (y3 - y0), 'rgba(0,0,0,1)'], [(y2 - y0) / (y3 - y0), 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  mx.fillRect(0, 0, W, H);
  ctx.drawImage(m, 0, 0);
}
// camera as an object (so points can be mapped to the screen): world (x,y) at screen centre, scaled by z
const camPt = (c, p) => [(p[0] - c.x) * c.z + W / 2, (p[1] - c.y) * c.z + H / 2];
const withCam = (ctx, c, fn) => L.cam(ctx, c.x, c.y, c.z, c.r || 0, fn);

// ---------------------------------------------------------------- shared kitchen pieces
function kitchenBlur() {
  return cached('kblur', W, H, (x) => {
    const tmp = createCanvas(W, H), tx = tmp.getContext('2d');
    BX.kitchenInterior(tx, 0.3, { view: 'wide', dusk: 0.12, fire: 1, beams: true, smoke: 0.6 });
    tx.fillStyle = 'rgba(14,6,8,0.42)'; tx.fillRect(0, 0, W, H);
    x.filter = 'blur(22px)'; x.drawImage(tmp, -40, -40, W + 80, H + 80); x.filter = 'none';
    L.bokeh(x, 0, 71, 16, WARM, 0.22, 24, 80);
  });
}
// clay stove slab in the foreground of 3q close-ups (fire licks around the pan)
function stoveSlab(ctx, T, y0, px, py, prx) {
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y0 + 900, [[0, '#4e2a1c'], [0.25, '#321a12'], [1, '#100706']]);
  ctx.fillRect(-600, y0, W + 1200, 1800);
  ctx.strokeStyle = 'rgba(255,170,100,0.3)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-600, y0); ctx.lineTo(W + 600, y0); ctx.stroke();
  const fl = flick(T);
  L.glow(ctx, px, py + 30, prx * 1.5, 'rgba(255,100,30,1)', 0.5 * fl);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 11; i++) {
    const a = PI * (0.02 + i * 0.096), fx = px + Math.cos(a) * prx * 1.02, fy = py + Math.sin(a) * prx * 0.42 + 6;
    const hh = (34 + 26 * Math.sin(T * 13 + i * 2.1) * Math.sin(T * 5 + i)) * (prx / 300);
    ctx.fillStyle = lgr(ctx, fx, fy, fx, fy - hh, [[0, 'rgba(255,200,100,0.85)'], [0.5, 'rgba(255,120,40,0.5)'], [1, 'rgba(255,60,20,0)']]);
    ell(ctx, fx, fy - hh / 2, 13 * (prx / 300), hh / 2); ctx.fill();
  }
  ctx.restore();
}
// Má Tư's arm entering from off-frame: maroon sleeve (always leaves the frame), skin forearm, cartoon hand.
// (hx,hy) = wrist point, ang = direction shoulder → hand.
function armIn(ctx, hx, hy, ang, s, kind = 'grip', flip = false, len = 1800) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,6,6,0.25)'; ctx.lineWidth = 74 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * len + 24 * s, hy - sn * len + 34 * s); ctx.lineTo(hx + 24 * s, hy + 34 * s); ctx.stroke();
  ctx.strokeStyle = SKIN; ctx.lineWidth = 44 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 220 * s, hy - sn * 220 * s); ctx.lineTo(hx - c * 10 * s, hy - sn * 10 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,180,0.5)'; ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 200 * s + sn * 14 * s, hy - sn * 200 * s - c * 14 * s); ctx.lineTo(hx - c * 30 * s + sn * 14 * s, hy - sn * 30 * s - c * 14 * s); ctx.stroke();
  ctx.strokeStyle = SLEEVE_D; ctx.lineWidth = 84 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * len, hy - sn * len); ctx.lineTo(hx - c * 168 * s, hy - sn * 168 * s); ctx.stroke();
  ctx.strokeStyle = SLEEVE; ctx.lineWidth = 74 * s; ctx.stroke();
  // fabric folds + cuff + warm rim light
  ctx.strokeStyle = 'rgba(30,6,10,0.35)'; ctx.lineWidth = 4 * s;
  for (const d of [260, 360, 470]) { ctx.beginPath(); ctx.moveTo(hx - c * d * s - sn * 30 * s, hy - sn * d * s + c * 30 * s); ctx.quadraticCurveTo(hx - c * (d + 20) * s, hy - sn * (d + 20) * s, hx - c * d * s + sn * 26 * s, hy - sn * d * s - c * 26 * s); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(40,8,14,0.6)'; ctx.lineWidth = 6 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 172 * s - sn * 37 * s, hy - sn * 172 * s + c * 37 * s); ctx.lineTo(hx - c * 172 * s + sn * 37 * s, hy - sn * 172 * s - c * 37 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,110,0.42)'; ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * len + sn * 30 * s, hy - sn * len - c * 30 * s); ctx.lineTo(hx - c * 180 * s + sn * 30 * s, hy - sn * 180 * s - c * 30 * s); ctx.stroke();
  ctx.restore();
  NP.cHand(ctx, hx - c * 20 * s, hy - sn * 20 * s, s, ang, { kind, skin: SKIN_A, flip });
}

// ---------------------------------------------------------------- custom food drawers
// whole river prawn lying on its side (curled), ~200 px incl. antennae at s=1. cook 0 grey-blue raw → 1 orange-red.
function prawn(ctx, x, y, s = 1, rot = 0, o = {}) {
  const k = clamp(o.cook ?? 0), fl = o.flip ? -1 : 1;
  const base = mix('#8ea2a4', '#f06a34', k), dark = mix('#3d5056', '#a82c16', k), lite = mix('#dde9e4', '#ffd2aa', k), belly = mix('#c9d6d0', '#ffb07a', k);
  const headB = mix('#b08070', '#ec5a28', k), claw = mix('#4f6a86', '#c8401c', k);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * fl, s * (o.sq ?? 1));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const C = [8, 30], R = 38, A0 = -PI / 2, A1 = PI * 0.5;
  const P = (u) => { const a = lerp(A0, A1, u); return [C[0] + Math.cos(a) * R, C[1] + Math.sin(a) * R, a]; };
  const wOf = (u) => lerp(20, 8, Math.pow(u, 1.1));
  // antennae + claws (behind)
  ctx.strokeStyle = mix('#6e6a64', '#cf4e28', k); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-70, -10); ctx.bezierCurveTo(-120, -50, -170, -40, -220, -86); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-68, -6); ctx.bezierCurveTo(-130, -18, -185, 6, -235, -12); ctx.stroke();
  ctx.strokeStyle = claw; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(-46, 20); ctx.quadraticCurveTo(-90, 44, -132, 40); ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-132, 40); ctx.lineTo(-158, 37); ctx.stroke();
  ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-156, 35); ctx.lineTo(-174, 29); ctx.moveTo(-156, 39); ctx.lineTo(-172, 43); ctx.stroke();
  // walking legs + swimmerets
  ctx.strokeStyle = mix('#b8b4aa', '#ff9a66', k); ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 10, 22); ctx.quadraticCurveTo(-58 + i * 10, 34, -62 + i * 11, 44 + i); ctx.stroke(); }
  for (let i = 0; i < 5; i++) { const u = 0.18 + i * 0.13, [px, py, a] = P(u), w = wOf(u); const nx = -Math.cos(a), ny = -Math.sin(a); ctx.beginPath(); ctx.moveTo(px + nx * w * 0.7, py + ny * w * 0.7); ctx.lineTo(px + nx * (w + 9) + Math.sin(a) * 4, py + ny * (w + 9) - Math.cos(a) * 4); ctx.stroke(); }
  // tail fan
  { const [tx, ty, ta] = P(1), d = Math.atan2(Math.cos(ta), -Math.sin(ta));
    for (const off of [-0.55, 0, 0.55]) { ctx.save(); ctx.translate(tx, ty); ctx.rotate(d + off); ell(ctx, 15, 0, 17, 6.5); ctx.fillStyle = lgr(ctx, 0, 0, 32, 0, [[0, base], [1, dark]]); ctx.fill(); ctx.strokeStyle = 'rgba(50,24,14,0.4)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); } }
  // abdomen: one continuous tapered shell
  const N = 26, out = [], inn = [];
  for (let i = 0; i <= N; i++) { const u = i / N, [px, py, a] = P(u), w = wOf(u); out.push([px + Math.cos(a) * w, py + Math.sin(a) * w]); inn.push([px - Math.cos(a) * w * 0.9, py - Math.sin(a) * w * 0.9]); }
  const body = () => { ctx.beginPath(); ctx.moveTo(out[0][0], out[0][1]); for (const q of out) ctx.lineTo(q[0], q[1]); for (let i = N; i >= 0; i--) ctx.lineTo(inn[i][0], inn[i][1]); ctx.closePath(); };
  body(); ctx.fillStyle = rgr(ctx, C[0], C[1], R * 0.4, C[0], C[1], R + 20, [[0, belly], [0.55, base], [0.85, base], [1, dark]]); ctx.fill();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = lgr(ctx, 0, -30, 0, 70, [[0, 'rgba(255,255,255,0.18)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.25)']]); ctx.fillRect(-20, -40, 120, 120);
  for (let j = 1; j <= 6; j++) {
    const u = j / 7, [px, py, a] = P(u), w = wOf(u), tx = -Math.sin(a), ty = Math.cos(a);
    ctx.strokeStyle = 'rgba(40,18,10,0.38)'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * w, py - Math.sin(a) * w); ctx.quadraticCurveTo(px + tx * 5, py + ty * 5, px + Math.cos(a) * (w + 2), py + Math.sin(a) * (w + 2)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * w + tx * 3, py - Math.sin(a) * w + ty * 3); ctx.quadraticCurveTo(px + tx * 8, py + ty * 8, px + Math.cos(a) * w + tx * 3, py + Math.sin(a) * w + ty * 3); ctx.stroke();
  }
  ctx.restore();
  body(); ctx.strokeStyle = 'rgba(50,22,14,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  // glossy ridge highlight along the back
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let i = 1; i <= 17; i++) { const u = i / N, [px, py, a] = P(u), w = wOf(u) * 0.55; if (i === 1) ctx.moveTo(px + Math.cos(a) * w, py + Math.sin(a) * w); else ctx.lineTo(px + Math.cos(a) * w, py + Math.sin(a) * w); }
  ctx.stroke();
  // head / carapace with rostrum
  const head = () => { ctx.beginPath(); ctx.moveTo(14, -24); ctx.bezierCurveTo(-20, -28, -50, -24, -70, -12); ctx.lineTo(-112, -16); ctx.lineTo(-74, -2); ctx.bezierCurveTo(-72, 12, -54, 24, -30, 26); ctx.bezierCurveTo(-10, 27, 6, 20, 14, 12); ctx.closePath(); };
  head(); ctx.fillStyle = lgr(ctx, 0, -26, 0, 28, [[0, lite], [0.35, headB], [1, dark]]); ctx.fill();
  ctx.save(); head(); ctx.clip();
  ell(ctx, -26, 6, 22, 12, 0.1); ctx.fillStyle = k > 0.5 ? 'rgba(160,40,10,0.32)' : 'rgba(120,70,50,0.32)'; ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,10,0.3)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-60, -6); ctx.quadraticCurveTo(-30, 2, 8, -4); ctx.stroke();
  ctx.restore();
  head(); ctx.strokeStyle = 'rgba(50,22,14,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = '#120e0e'; ell(ctx, -62, -6, 4.6, 4.6); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(ctx, -63.5, -7.5, 1.5, 1.5); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-58, -17); ctx.quadraticCurveTo(-26, -24, 6, -20); ctx.stroke();
  ctx.restore();
}
// glazed stoneware plate (đĩa sành): cream crackle well, brown glazed rim. origin centre, R radius, ryr squash.
function stonePlate(ctx, x, y, R, ryr = 1) {
  const cc = Math.sqrt(Math.max(0, 1 - ryr * ryr)), T = R * 0.06 * cc;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(12,5,2,0.4)'; ell(ctx, R * 0.05, T + R * 0.06 * ryr + 6, R * 1.02, R * ryr * 1.02 + 4); ctx.fill();
  if (ryr < 0.98) { ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(-R * 0.9, T); ctx.ellipse(0, T, R * 0.9, R * ryr * 0.9, 0, PI, 0, true); ctx.lineTo(R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.closePath(); ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#4a2810'], [0.3, '#8a5a32'], [1, '#2a1408']]); ctx.fill(); }
  ell(ctx, 0, 0, R, R * ryr); ctx.fillStyle = lgr(ctx, -R, -R * ryr, R, R * ryr, [[0, '#9a6236'], [0.45, '#6e3e1c'], [1, '#3e200c']]); ctx.fill();
  const Rw = R * 0.78;
  ell(ctx, 0, 0, Rw, Rw * ryr); ctx.fillStyle = rgr(ctx, -Rw * 0.3, -Rw * 0.3 * ryr, 0, 0, 0, Rw, [[0, '#f4ead4'], [0.7, '#e2d2b0'], [1, '#c4ad84']]); ctx.fill();
  ctx.save(); ell(ctx, 0, 0, Rw, Rw * ryr); ctx.clip(); ctx.scale(1, ryr);
  const r = rng(Math.round(R)); ctx.strokeStyle = 'rgba(120,96,60,0.22)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) { let px = (r() - 0.5) * Rw * 2, py = (r() - 0.5) * Rw * 2; ctx.beginPath(); ctx.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (r() - 0.5) * Rw * 0.25; py += (r() - 0.5) * Rw * 0.25; ctx.lineTo(px, py); } ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(70,36,14,0.6)'; ctx.lineWidth = Math.max(2, R * 0.012); ell(ctx, 0, 0, Rw, Rw * ryr); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,215,0.85)'; ctx.lineWidth = Math.max(2, R * 0.014); ctx.beginPath(); ctx.ellipse(0, 0, R * 0.95, R * ryr * 0.95, 0, PI * 1.08, PI * 1.55); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,215,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, Rw * 0.9, Rw * ryr * 0.9, 0, PI * 0.15, PI * 0.4); ctx.stroke();
  ctx.restore();
}
// thin pork-belly slice seen flat (cut face up): skin / fat / lean layers. ~150×36 at s=1.
const PORK_L = [['#c08452', '#8a4a1e', 4], ['#fbf0e4', '#f4d698', 9], ['#e8908a', '#b8662c', 8], ['#fff3ea', '#f6dca0', 5], ['#de7d78', '#a8582a', 10]];
function porkStrip(ctx, x, y, s = 1, rot = 0, o = {}) {
  const k = clamp(o.sear ?? 0), len = o.len ?? 150, hw = 18;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const path = () => { ctx.beginPath(); ctx.moveTo(-len / 2, -hw); ctx.bezierCurveTo(-len / 6, -hw - 4, len / 6, -hw + 3, len / 2, -hw + 1); ctx.quadraticCurveTo(len / 2 + 5, 0, len / 2 - 1, hw); ctx.bezierCurveTo(len / 6, hw + 2, -len / 6, hw - 3, -len / 2, hw); ctx.quadraticCurveTo(-len / 2 - 4, 0, -len / 2, -hw); ctx.closePath(); };
  ctx.fillStyle = 'rgba(30,10,4,0.28)'; ctx.save(); ctx.translate(5, 7); path(); ctx.fill(); ctx.restore();
  path(); ctx.save(); ctx.clip();
  let yy = -hw - 3;
  for (const [a, b, h] of PORK_L) { ctx.fillStyle = mix(a, b, k); ctx.beginPath(); ctx.moveTo(-len, yy); for (let xx = -len; xx <= len; xx += 25) ctx.lineTo(xx, yy + Math.sin(xx * 0.05 + yy) * 1.6); ctx.lineTo(len, yy + h + 2); ctx.lineTo(-len, yy + h + 2); ctx.closePath(); ctx.fill(); yy += h; }
  ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fillRect(-len / 2, -hw + 5, len, 3);
  ctx.fillStyle = lgr(ctx, -len / 2, 0, len / 2, 0, [[0, 'rgba(0,0,0,0.12)'], [0.4, 'rgba(255,255,255,0.08)'], [1, 'rgba(0,0,0,0.15)']]); ctx.fillRect(-len, -hw - 5, len * 2, hw * 2 + 10);
  ctx.restore();
  path(); ctx.strokeStyle = 'rgba(90,30,20,0.45)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}
// julienned coconut heart (củ hủ dừa): ivory strip
function coconutStrand(ctx, x, y, s = 1, rot = 0, len = 100, o = {}) {
  const bend = o.bend ?? 6, w = o.w ?? 6.5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.lineCap = 'butt';
  const path = () => { ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.quadraticCurveTo(0, bend, len / 2, 0); };
  path(); ctx.strokeStyle = 'rgba(140,118,80,0.55)'; ctx.lineWidth = w + 2; ctx.stroke();
  path(); ctx.strokeStyle = o.col || '#f3ecd6'; ctx.lineWidth = w; ctx.stroke();
  ctx.translate(0, -w * 0.22); path(); ctx.strokeStyle = 'rgba(255,255,250,0.95)'; ctx.lineWidth = w * 0.32; ctx.stroke();
  ctx.restore();
}
function waterDrop(ctx, x, y, r, a = 1) {
  ctx.save(); ctx.globalAlpha = a;
  ell(ctx, x + r * 0.25, y + r * 0.35, r, r * 0.9); ctx.fillStyle = 'rgba(10,30,10,0.22)'; ctx.fill();
  ell(ctx, x, y, r, r * 0.9); ctx.fillStyle = rgr(ctx, x - r * 0.3, y - r * 0.3, 0, x, y, r, [[0, 'rgba(255,255,255,0.35)'], [0.7, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0.28)']]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.2, -0.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.6)'; ell(ctx, x + r * 0.3, y + r * 0.45, r * 0.3, r * 0.12); ctx.fill();
  ctx.restore();
}
// woven bamboo texture (cached per size): square weave of strips
function weaveTex(name, size, strip = 16, c0 = '#b88a50', c1 = '#8e6234') {
  return cached(name, size, size, (x) => {
    x.fillStyle = c1; x.fillRect(0, 0, size, size);
    const r = rng(size + strip);
    for (let i = 0; i * strip < size; i++) for (let j = 0; j * strip < size; j++) {
      const hor = (i + j) % 2 === 0, v = 0.85 + r() * 0.3;
      const px = i * strip, py = j * strip;
      x.fillStyle = lgr(x, px, py, hor ? px : px + strip, hor ? py + strip : py, [[0, mix(c1, c0, 0.4 * v)], [0.5, mix(c1, c0, Math.min(1, v))], [1, mix(c1, '#3a2410', 0.4)]]);
      x.fillRect(px + 1, py + 1, strip - 2, strip - 2);
    }
  });
}
// round bamboo basket seen from above (rổ / nia), origin centre, R radius
function basketTop(ctx, x, y, R, o = {}) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(15,6,2,0.4)'; ell(ctx, 18, 26, R * 1.04, R * 1.04); ctx.fill();
  ell(ctx, 0, 0, R, R); ctx.save(); ctx.clip();
  const tex = weaveTex('weave' + (o.strip || 16), 1024, o.strip || 16);
  ctx.rotate(0.6); ctx.drawImage(tex, -512, -512); ctx.rotate(-0.6);
  ctx.fillStyle = rgr(ctx, -R * 0.3, -R * 0.3, 0, 0, 0, R, [[0, 'rgba(255,200,130,0.12)'], [0.75, 'rgba(0,0,0,0.05)'], [1, 'rgba(20,8,2,0.55)']]); ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  ctx.lineWidth = R * 0.075; ctx.strokeStyle = lgr(ctx, -R, -R, R, R, [[0, '#e0b070'], [0.5, '#a87440'], [1, '#6a4420']]); ell(ctx, 0, 0, R * 0.98, R * 0.98); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,34,12,0.6)'; ctx.lineWidth = 2;
  for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94); ctx.lineTo(Math.cos(a + 0.05) * R * 1.02, Math.sin(a + 0.05) * R * 1.02); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,220,160,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R * 1.0, PI * 1.05, PI * 1.55); ctx.stroke();
  ctx.restore();
}
function bananaLeaf(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(10,20,4,0.35)'; ctx.beginPath(); ctx.ellipse(14, 18, 280, 130, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-290, 10); ctx.bezierCurveTo(-200, -140, 160, -150, 290, -20); ctx.bezierCurveTo(200, 130, -150, 150, -290, 10); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, -140, 0, 140, [[0, '#5a9a3a'], [0.5, '#3f7d2a'], [1, '#2a5a1c']]); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(200,240,150,0.18)'; ctx.lineWidth = 2;
  for (let i = -16; i <= 16; i++) { ctx.beginPath(); ctx.moveTo(i * 18, -6); ctx.quadraticCurveTo(i * 18 + 30, -80, i * 18 + 60, -160); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 18, 6); ctx.quadraticCurveTo(i * 18 + 30, 80, i * 18 + 60, 160); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,220,0.1)'; ctx.fillRect(-300, -150, 600, 60);
  ctx.restore();
  ctx.strokeStyle = '#b8d890'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-290, 10); ctx.bezierCurveTo(-100, -4, 100, -6, 290, -20); ctx.stroke();
  ctx.restore();
}
// small porcelain bowl (3q), tilt rotates it (tipping toward −x)
function smallBowl(ctx, x, y, s, tilt = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-100, 0); ctx.bezierCurveTo(-96, 70, -50, 96, 0, 96); ctx.bezierCurveTo(50, 96, 96, 70, 100, 0); ctx.closePath();
  ctx.fillStyle = lgr(ctx, -100, 0, 100, 0, [[0, '#9aa6b4'], [0.3, '#ffffff'], [1, '#7c8898']]); ctx.fill(); ctx.strokeStyle = 'rgba(40,30,40,0.5)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#2a5fb5'; for (let i = 0; i < 7; i++) { ell(ctx, -70 + i * 23, 46 + Math.sin(i / 6 * PI) * 12, 5, 5); ctx.fill(); }
  ell(ctx, 0, 0, 100, 30); ctx.fillStyle = '#e8eef4'; ctx.fill(); ctx.strokeStyle = '#1f4fa3'; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- particles
// slow-motion oil spits from a hit point (golden droplets with glints)
function oilSpits(ctx, T, t0, x, y, s, o = {}) {
  const age = (T - t0) * (o.slow ?? 1); if (age < 0) return;
  const n = o.n ?? 30, r = rng(o.seed ?? 5), g = (o.g ?? 900) * s, life = o.life ?? 1.2;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.4, v = (220 + r() * 520) * s, z = (2 + r() * 4.5) * s, de = r() * 0.15, l = life * (0.6 + r() * 0.4);
    const u = age - de; if (u < 0 || u > l) continue;
    const vx = Math.cos(a) * v * (o.flat ?? 1), vy = Math.sin(a) * v * (o.ryr ?? 0.8);
    const px = x + vx * u, py = y + vy * u + 0.5 * g * u * u, svx = vx, svy = vy + g * u;
    const sp = Math.hypot(svx, svy) || 1, tl = Math.min(z * 3.2, sp * 0.018 / (o.slow ?? 1));
    ctx.globalAlpha = (1 - u / l) * (o.alpha ?? 1);
    ctx.strokeStyle = 'rgba(255,196,80,0.9)'; ctx.lineWidth = z; ctx.beginPath(); ctx.moveTo(px - svx / sp * tl, py - svy / sp * tl); ctx.lineTo(px, py); ctx.stroke();
    ctx.fillStyle = 'rgba(255,252,225,1)'; ell(ctx, px - z * 0.2, py - z * 0.2, z * 0.35, z * 0.35); ctx.fill();
    if (i % 4 === 0) L.sparkle(ctx, px, py, z * 3.2, 0.7 * (1 - u / l));
  }
  ctx.restore();
}
// batter bubbles popping in the plane of the crêpe (ryr squash), radius rad
function batterBubbles(ctx, T, cx, cy, rad, ryr, n, seed, s = 1, a = 1) {
  if (rad <= 2 || a <= 0) return;
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ang = r() * TAU, d = Math.sqrt(r()) * rad, per = 0.5 + r() * 0.9, ph = (T / per + r()) % 1, z = (1.5 + r() * 3.5) * s * Math.sin(ph * PI);
    const px = cx + Math.cos(ang) * d, py = cy + Math.sin(ang) * d * ryr;
    if (z < 0.4) continue;
    ctx.globalAlpha = a * (ph < 0.85 ? 1 : (1 - ph) / 0.15);
    ell(ctx, px, py, z, z * Math.max(0.5, ryr)); ctx.strokeStyle = 'rgba(190,120,20,0.7)'; ctx.lineWidth = 1.1 * s; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,235,0.9)'; ell(ctx, px - z * 0.3, py - z * 0.3 * ryr, z * 0.35, z * 0.25); ctx.fill();
  }
  ctx.restore();
}
function embers(ctx, T, x, y, w, h, n, seed, a = 1) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const per = 1.2 + r() * 1.6, ph = (T / per + r()) % 1, bx = x + (r() - 0.5) * w, px = bx + Math.sin(T * 2 + i) * 18 * ph, py = y - ph * h, z = 1.5 + r() * 2.5;
    ctx.globalAlpha = a * Math.sin(ph * PI);
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,170,60,1)' : 'rgba(255,220,120,1)'; ell(ctx, px, py, z, z); ctx.fill();
  }
  ctx.restore();
}
// warm sunset beam through the bamboo slats (screen-space parallel stripes)
function slatBeams(ctx, T, x0, y0, ang, n, a = 0.16, w = 70, gap = 120) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(x0, y0); ctx.rotate(ang);
  for (let i = 0; i < n; i++) {
    const tw = 0.75 + 0.25 * Math.sin(T * 0.8 + i * 1.7);
    ctx.globalAlpha = a * tw;
    ctx.fillStyle = lgr(ctx, 0, 0, 2600, 0, [[0, 'rgba(255,190,110,1)'], [0.6, 'rgba(255,150,70,0.5)'], [1, 'rgba(255,120,50,0)']]);
    ctx.fillRect(0, (i - n / 2) * gap, 2600, w * (0.7 + 0.5 * ((i * 37) % 10) / 10));
  }
  ctx.restore();
}

// =================================================================================================== S1 0.000–5.000 · HOOK
// Extreme close-up on the hot cast-iron pan; batter ribbon hits at 0.3, oil spits, slow-mo spread into a circle with
// tiny bubbles, the edge turns honey-gold; fast dolly-in to the far edge, then rack focus to Má Tư's hands behind.
const S1 = { px: 540, py: 1180, ps: 2.8, ryr: 0.5, hit: 0.3 };
function s1Deep() {
  return cached('s1deep', W, H, (x) => {
    x.drawImage(kitchenBlur(), 0, 0);
    const tmp = createCanvas(W, H), t = tmp.getContext('2d');
    // Má Tư's torso behind the stove (maroon áo bà ba, khăn rằn at the neck), well out of focus
    t.fillStyle = SLEEVE;
    t.beginPath(); t.moveTo(250, 1250); t.bezierCurveTo(240, 700, 300, 470, 400, 430); t.quadraticCurveTo(540, 390, 680, 430); t.bezierCurveTo(780, 470, 840, 700, 830, 1250); t.closePath(); t.fill();
    t.fillStyle = 'rgba(30,6,10,0.45)'; t.fillRect(520, 470, 40, 800);
    t.fillStyle = '#e9e2d4'; for (let i = 0; i < 5; i++) { ell(t, 540, 560 + i * 110, 9, 9); t.fill(); }
    for (let i = 0; i < 14; i++) { t.fillStyle = i % 2 ? '#1a1414' : '#ece6da'; t.fillRect(430 + i * 16, 400 + (i % 3) * 8, 16, 46); }
    t.fillStyle = SKIN; ell(t, 540, 360, 70, 60); t.fill();
    const rl = t.createLinearGradient(250, 0, 830, 0); rl.addColorStop(0, 'rgba(255,150,80,0.35)'); rl.addColorStop(0.3, 'rgba(0,0,0,0)'); rl.addColorStop(1, 'rgba(0,0,0,0.25)');
    t.fillStyle = rl; t.fillRect(240, 380, 600, 900);
    x.filter = 'blur(16px)'; x.drawImage(tmp, 0, 0); x.filter = 'none';
    x.fillStyle = 'rgba(10,4,4,0.25)'; x.fillRect(0, 0, W, H);
  });
}
function s1Cam(lt) {
  const d = ease.inOut(seg(lt, 2.35, 3.25)), r = ease.inOut(seg(lt, 3.4, 4.7));
  const z0 = lerp(1.12, 1.24, seg(lt, 0, 2.35));
  return {
    x: lerp(lerp(540, 552, seg(lt, 0, 2.35)), 600, d) - 14 * r,
    y: lerp(lerp(1030, 1040, seg(lt, 0, 2.35)), 1010, d) - 80 * r,
    z: lerp(z0, 2.05, d) + 0.08 * r,
  };
}
function s1(ctx, lt, p, T) {
  const c = s1Cam(lt), cb = { x: c.x, y: lerp(c.y, 900, 0.25), z: 1 + (c.z - 1) * 0.6 };
  const rk = ease.inOut(seg(lt, 3.5, 4.45));
  // deep layer: kitchen + Má Tư's torso
  withCam(ctx, { x: c.x, y: lerp(c.y, 900, 0.4), z: 1 + (c.z - 1) * 0.35 }, () => ctx.drawImage(s1Deep(), 0, 0));
  // ladle path: tips & pours (0..1.5), untips, returns to the batter bowl (1.8..3.0)
  const tip = ease.out(seg(lt, 0, 0.22)) * (1 - ease.inOut(seg(lt, 1.45, 1.8))), back = ease.inOut(seg(lt, 1.8, 3.0));
  const cup = [lerp(640, 600, back), lerp(770, 712, back) - 30 * Math.sin(back * PI)];
  // mid layer: bowl of batter + hands + ladle (rack focus target)
  const [mc, mx] = buf('s1mid');
  let lip = null;
  withCam(mx, cb, () => {
    const bw = BX.batterBowl(mx, 560, 730, 0.78, { view: '3q', fill: 0.85, mix: 1, t: T });
    const ld = BX.ladle(mx, cup[0], cup[1], 1.15, -0.6 * tip + 0.15 * back, { fill: back > 0.8 ? 1 : 1 - seg(lt, 0.3, 1.45) });
    lip = ld.lip;
    if (lt > 1.4 && lt < 2.6) { // drip from the ladle lip
      const u = ((lt - 1.4) * 1.6) % 1; mx.fillStyle = '#f2c84a'; ell(mx, ld.lip[0], ld.lip[1] + u * 60, 4, 6); mx.fill();
    }
    armIn(mx, ld.grip[0] + 14, ld.grip[1] + 6, Math.atan2(ld.grip[1] - 360, ld.grip[0] - 820), 0.9, 'grip', true);
    armIn(mx, (bw.rim ? bw.rim[0] : 560) - 160, 745, 1.75, 0.9, 'grip');
  });
  blurDraw(ctx, mc, lerp(13, 0, rk));
  // foreground layer: stove, pan, batter, spits, bubbles, flames
  const [fc, fx] = buf('s1fg');
  const b = ease.out(seg(lt, S1.hit, 3.6)), cook = lerp(0, 0.42, seg(lt, 1.4, 5));
  let land = null;
  withCam(fx, c, () => {
    const { px, py, ps, ryr } = S1;
    stoveSlab(fx, T, py - 140, px, py + 40, 245 * ps);
    const pr = BX.pan(fx, px, py, ps, { ryr, handle: -0.75, oil: 1, t: T, batter: b, cook, pourAt: [0, -10] });
    land = [pr.floor[0], pr.floor[1] - 10 * ryr * ps];
    // bubbles over the spreading batter
    batterBubbles(fx, T, land[0], land[1], b * 500, ryr, 80, 4, 1.7, seg(lt, 0.6, 1.2));
    if (lt < 1.2) { BX.smokeWisp(fx, T, px - 260, py - 10, 1.6, { seed: 3, alpha: 0.4, h: 500 }); BX.smokeWisp(fx, T + 0.8, px + 300, py + 20, 1.5, { seed: 8, alpha: 0.35, h: 460 }); }
    // honey-gold edge glow ring as it starts to set
    if (cook > 0.05) { fx.save(); fx.globalCompositeOperation = 'screen'; fx.globalAlpha = cook * 1.2; fx.strokeStyle = 'rgba(255,180,60,0.5)'; fx.lineWidth = 22; ell(fx, land[0], land[1], 555, 555 * ryr); fx.stroke(); fx.restore(); }
    // slow-motion oil spits from the impact, plus constant tiny pops
    oilSpits(fx, T, S1.hit, land[0], land[1], 1.6, { n: 42, slow: 0.45, g: 700, life: 1.6, ryr: 1.1, seed: 9 });
    oilSpits(fx, T, S1.hit + 0.02, land[0], land[1], 1.1, { n: 24, slow: 0.45, g: 900, life: 1.2, flat: 1.6, ryr: 0.6, seed: 13 });
    BX.oilSparkle(fx, T * 0.6, px, py - 20, 2.2, { n: 14, w: 420, h: 70, alpha: 0.7 });
    if (lt > 0.4) L.steam(fx, T * 0.7, 21, px, py - 60, 700, 520, 9, 0.22 * seg(lt, 0.4, 1.2));
  });
  // batter ribbon: from the ladle lip (mid layer) to the landing point (fg); head reaches the pan at 0.3
  if (lip && land && lt < 1.75) {
    const a = camPt(cb, lip), z = camPt(c, land);
    BX.pourStream(fx, a[0], a[1], z[0], z[1], T, { col: 'batter', w: 24 * c.z, k: seg(lt, 0.08, S1.hit), tail: seg(lt, 1.3, 1.72), seed: 3, drops: 10 });
  }
  if (lt >= S1.hit && lt < S1.hit + 0.5) { // splash crown at the hit
    const z = camPt(c, land), u = (lt - S1.hit) / 0.5;
    fx.save(); fx.globalAlpha = 1 - u; fx.strokeStyle = 'rgba(255,230,140,0.9)'; fx.lineWidth = 6 * (1 - u) + 1; ell(fx, z[0], z[1], 40 + 260 * ease.out(u), (40 + 260 * ease.out(u)) * S1.ryr); fx.stroke(); fx.restore();
  }
  blurDraw(ctx, fc, lerp(0, 12, rk));
  // light: sunset beam through the slats cuts across the steam, fire glow from below
  slatBeams(ctx, T, 1150, -80, 2.3, 5, 0.12, 60, 150);
  L.glow(ctx, 540, 1900, 900, 'rgba(255,90,30,1)', 0.22 * flick(T));
  embers(ctx, T, 540, 1700, 1000, 900, 18, 4, 0.6);
  L.dust(ctx, T, 3, 24, 0, 300, W, 900, '255,220,170', 2.5, 0.35);
}

// =================================================================================================== S2 5.000–6.667 · INGREDIENTS TABLE
// Whip pan in from the right, then a slow top-down glide over the wooden table (left → right).
// Hero items sit in world y 950..1750 (screen ≥ 600) so the caption band stays on plain wood.
const TB = { ox: 1000, oy: 40, w: 3000, h: 2000 };
const S2P = { coco: [430, 1130], herbs: [300, 1560], plate: [790, 1400], pork: [1160, 1110], basket: [1270, 1580] };
function tableWorld() {
  return cached('s2world', TB.w, TB.h, (x) => {
    x.translate(TB.ox, TB.oy);
    const r = rng(77);
    // dark teak planks running left–right
    for (let i = 0; i < 14; i++) {
      const y0 = -40 + i * 150, v = 0.75 + r() * 0.3;
      x.fillStyle = lgr(x, 0, y0, 0, y0 + 150, [[0, `rgb(${(112 * v) | 0},${(64 * v) | 0},${(35 * v) | 0})`], [1, `rgb(${(82 * v) | 0},${(45 * v) | 0},${(24 * v) | 0})`]]);
      x.fillRect(-TB.ox, y0, TB.w, 150);
      x.strokeStyle = 'rgba(40,18,8,0.28)'; x.lineWidth = 2;
      for (let k = 0; k < 7; k++) { const gy = y0 + 10 + r() * 130; x.beginPath(); x.moveTo(-TB.ox, gy); for (let xx = -TB.ox; xx <= TB.w; xx += 140) x.lineTo(xx, gy + Math.sin(xx * 0.003 + k) * 8); x.stroke(); }
      x.fillStyle = 'rgba(20,8,4,0.7)'; x.fillRect(-TB.ox, y0 + 146, TB.w, 5);
      x.fillStyle = 'rgba(255,200,140,0.1)'; x.fillRect(-TB.ox, y0, TB.w, 3);
    }
    const shadow = (cx, cy, rx) => { x.fillStyle = rgr(x, cx + 24, cy + 30, rx * 0.6, cx + 24, cy + 30, rx * 1.15, [[0, 'rgba(10,4,2,0.5)'], [1, 'rgba(10,4,2,0)']]); x.fillRect(cx - rx * 1.4, cy - rx * 1.4, rx * 2.9, rx * 2.9); };
    // herbs on a flat bamboo tray, wet with droplets
    { const [hx0, hy0] = S2P.herbs; shadow(hx0, hy0, 250); basketTop(x, hx0, hy0, 235, { strip: 14 });
      const kinds = [['mustard', 1.0], ['lettuce', 0.95], ['mustard', 0.9], ['diepca', 1.3], ['diepca', 1.2], ['lacach', 1.4], ['lacach', 1.3], ['hung', 1.4], ['hung', 1.3], ['lacach', 1.2], ['hung', 1.2], ['diepca', 1.1], ['lacach', 1.3], ['hung', 1.2]];
      kinds.forEach(([kd, sc]) => { const a = r() * TAU, d = Math.sqrt(r()) * (kd === 'mustard' || kd === 'lettuce' ? 70 : 150); BX.herbLeaf(x, hx0 + Math.cos(a) * d, hy0 + 20 + Math.sin(a) * d, sc, r() * TAU, kd); });
      for (let i = 0; i < 40; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 190; waterDrop(x, hx0 + Math.cos(a) * d, hy0 + Math.sin(a) * d, 3 + r() * 7); } }
    // coconut heart: julienne on a banana leaf + an uncut piece
    { const [cx0, cy0] = S2P.coco; bananaLeaf(x, cx0, cy0, 0.85, -0.12);
      for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()); coconutStrand(x, cx0 - 30 + Math.cos(a) * d * 130, cy0 + 10 + Math.sin(a) * d * 62, 1.1, -0.15 + (r() - 0.5) * 0.6, 80 + r() * 50, { bend: (r() - 0.5) * 12, w: 7 }); }
      x.save(); x.translate(cx0 + 150, cy0 - 40); x.rotate(-0.35);
      x.fillStyle = 'rgba(10,4,2,0.35)'; ell(x, 10, 18, 110, 40); x.fill();
      x.fillStyle = lgr(x, 0, -38, 0, 38, [[0, '#fbf6e6'], [0.5, '#efe6cc'], [1, '#cdbf98']]); x.fillRect(-100, -38, 180, 76);
      x.strokeStyle = 'rgba(180,160,110,0.5)'; x.lineWidth = 1.5; for (let k = -30; k <= 30; k += 8) { x.beginPath(); x.moveTo(-98, k); x.lineTo(80, k + 2); x.stroke(); }
      ell(x, 80, 0, 22, 38); x.fillStyle = rgr(x, 80, 0, 2, 80, 0, 38, [[0, '#fffdf2'], [0.6, '#f2ead2'], [1, '#d8c99e']]); x.fill();
      x.strokeStyle = 'rgba(190,170,120,0.6)'; for (const rr of [12, 22, 31]) { ell(x, 80, 0, rr * 0.58, rr); x.stroke(); }
      x.restore(); }
    // stoneware plate of river prawns, laid in two neat rows
    { const [px0, py0] = S2P.plate; shadow(px0, py0, 270); stonePlate(x, px0, py0, 270, 1);
      const pos = [[-95, -95, 0.15], [55, -105, 0.1], [-105, 25, 0.1], [45, 15, 0.05], [-50, 125, 0.12], [95, 120, 0.08]];
      for (const [dx, dy, rr] of pos) prawn(x, px0 + dx, py0 + dy, 0.82, rr, { cook: 0.18 });
      for (let i = 0; i < 12; i++) waterDrop(x, px0 - 150 + r() * 300, py0 - 150 + r() * 300, 2.5 + r() * 4); }
    // pork belly: thin slices fanned on a wooden board
    { const [bx0, by0] = S2P.pork; x.save(); x.translate(bx0, by0); x.rotate(0.06);
      x.fillStyle = 'rgba(10,4,2,0.45)'; x.fillRect(-250, -140, 520, 320);
      x.fillStyle = lgr(x, 0, -160, 0, 160, [[0, '#c48a52'], [0.5, '#a8703e'], [1, '#86542a']]); x.beginPath(); x.roundRect(-270, -160, 520, 310, 24); x.fill();
      x.strokeStyle = 'rgba(80,40,14,0.35)'; x.lineWidth = 2; for (let k = 0; k < 8; k++) { x.beginPath(); x.moveTo(-262, -140 + k * 38); x.bezierCurveTo(-90, -130 + k * 38, 90, -150 + k * 38, 240, -138 + k * 38); x.stroke(); }
      x.strokeStyle = 'rgba(255,220,170,0.45)'; x.lineWidth = 3; x.beginPath(); x.roundRect(-268, -158, 516, 306, 23); x.stroke();
      for (let i = 0; i < 7; i++) porkStrip(x, -170 + i * 48, -5 + Math.sin(i) * 8, 1.3, 1.3 + i * 0.04, { sear: 0 });
      x.restore(); }
    BX.knife(x, S2P.pork[0] + 40, S2P.pork[1] - 250, 0.95, -0.1);
    // bamboo basket of bean sprouts
    { const [sx0, sy0] = S2P.basket; shadow(sx0, sy0, 230); basketTop(x, sx0, sy0, 215, { strip: 12 });
      for (let i = 0; i < 210; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 180; BX.sprout(x, sx0 + Math.cos(a) * d, sy0 + Math.sin(a) * d, 1.2, r() * TAU); }
      x.fillStyle = rgr(x, sx0 - 20, sy0 - 20, 20, sx0, sy0, 210, [[0, 'rgba(255,250,230,0.15)'], [1, 'rgba(40,20,0,0.25)']]); ell(x, sx0, sy0, 195, 195); x.fill(); }
    // loose bits on the wood
    for (let i = 0; i < 12; i++) BX.sprout(x, 1000 + r() * 160, 1700 + r() * 140, 1.15, r() * TAU);
    for (let i = 0; i < 9; i++) coconutStrand(x, 560 + r() * 140, 1260 + r() * 70, 1.1, r() * TAU, 70 + r() * 40, { w: 7 });
    for (let i = 0; i < 4; i++) BX.herbLeaf(x, 520 + r() * 120, 1720 + r() * 140, 1.2, r() * TAU, i % 2 ? 'hung' : 'lacach');
    // sunset beams through the slats + falloff to dark
    x.save(); x.globalCompositeOperation = 'screen'; x.rotate(0.5);
    for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(255,170,90,${0.06 + r() * 0.05})`; x.fillRect(-400 + i * 280, -1600, 80 + r() * 70, 4800); }
    x.restore();
    x.fillStyle = lgr(x, 0, 600, 0, 1960, [[0, 'rgba(12,5,3,0.35)'], [0.25, 'rgba(0,0,0,0)'], [0.85, 'rgba(0,0,0,0)'], [1, 'rgba(12,5,3,0.6)']]); x.fillRect(-TB.ox, -TB.oy, TB.w, TB.h);
  });
}
const S2_GLINTS = Array.from({ length: 18 }, (_, i) => { const r = rng(500 + i), pick = [S2P.herbs, S2P.plate, S2P.pork, S2P.coco][i % 4]; return [pick[0] + (r() - 0.5) * 300, pick[1] + (r() - 0.5) * 260]; });
function s2Cam(lt) { return 500 + 600 * ease.inOut(seg(lt, 0.15, 1.667)) - 1000 * (1 - ease.outExpo(seg(lt, 0, 0.45))); }
function s2(ctx, lt, p, T) {
  const z = lerp(1.5, 1.6, p), cx = s2Cam(lt), cy = lerp(1330, 1300, p), rot = lerp(0.025, -0.005, p);
  const dx = (s2Cam(lt) - s2Cam(Math.max(0, lt - 1 / 30))) * z;
  const scene = (x) => {
    x.fillStyle = '#120806'; x.fillRect(0, 0, W, H);
    L.cam(x, cx, cy, z, rot, () => {
      x.drawImage(tableWorld(), -TB.ox, -TB.oy);
      for (let i = 0; i < S2_GLINTS.length; i++) { const [gx, gy] = S2_GLINTS[i], tw = Math.max(0, Math.sin(T * 2.6 + i * 1.9)); if (tw > 0.2) L.sparkle(x, gx, gy, 14 * tw, 0.8 * tw); }
    });
  };
  if (lt < 0.42 && Math.abs(dx) > 12) L.motionBlurX(ctx, -Math.min(460, Math.abs(dx) * 2.4), 9, scene); else scene(ctx);
  L.dust(ctx, T, 8, 26, 0, 500, W, 1300, '255,225,170', 2.5, 0.4);
  L.glow(ctx, 160, 280, 700, 'rgba(255,170,90,1)', 0.14);
}

// =================================================================================================== S3 6.667–7.500 · PRAWN SET ON THE PLATE (6.9 clink)
const S3_LAND = 6.9;
function s3(ctx, lt, p, T) {
  const z = lerp(1.0, 1.06, ease.inOut(p));
  // backdrop: the same table, far out of focus
  ctx.fillStyle = '#120806'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.filter = 'blur(20px)';
  L.cam(ctx, S2P.plate[0] - 150, S2P.plate[1] - 250, 2.2, 0.15, () => ctx.drawImage(tableWorld(), -TB.ox, -TB.oy));
  ctx.restore();
  const [bc, bx] = buf('s3');
  const u = seg(T, S3_LAND - 0.23, S3_LAND), land = hitAt(T, S3_LAND, 0.22);
  withCam(bx, { x: 560 - 30 * p, y: 1190, z }, () => {
    stonePlate(bx, 520, 1420, 1050, 0.5);
    const sq = 0.6;
    prawn(bx, 330, 1330, 2.6, 0.12, { cook: 0.18, sq });
    prawn(bx, 860, 1560, 2.6, -0.12, { cook: 0.18, sq, flip: true });
    prawn(bx, 360, 1640, 2.7, 0.05, { cook: 0.18, sq });
    for (let i = 0; i < 12; i++) { const r = rng(40 + i); waterDrop(bx, 160 + r() * 760, 1250 + r() * 500, 4 + r() * 7); }
    // the prawn coming down, held by the fingertips
    const py = lerp(820, 1240, ease.in2(u)) + land * 7, px = lerp(700, 640, u), rot = lerp(-0.3, 0.06, u);
    bx.fillStyle = `rgba(30,14,4,${0.32 * u})`; ell(bx, 650, 1300, 230 * (0.6 + 0.4 * u), 60 * (0.6 + 0.4 * u)); bx.fill();
    prawn(bx, px, py, 2.8, rot, { cook: 0.18, sq: lerp(0.85, 0.6, u) });
    const rel = ease.inOut(seg(T, S3_LAND + 0.05, 7.45));
    armIn(bx, px + 110 + 40 * rel, py - 70 - 380 * rel, 1.95, 1.2, 'pinch', true);
    // glint sweeping across the glossy shell on the touch
    const gl = seg(T, S3_LAND - 0.02, S3_LAND + 0.42);
    if (gl > 0 && gl < 1) { const gx = px - 60 + 150 * gl, gy = py - 40; L.glow(bx, gx, gy, 120, 'rgba(255,240,210,1)', 0.45 * Math.sin(gl * PI)); L.sparkle(bx, gx, gy - 10, 70 * Math.sin(gl * PI), Math.sin(gl * PI)); }
    if (land > 0) { for (let i = 0; i < 10; i++) { const r = rng(60 + i), a = PI + r() * PI, d = (1 - land) * (60 + r() * 110); waterDrop(bx, 650 + Math.cos(a) * d * 2.2, 1290 + Math.sin(a) * d * 0.8 - Math.sin((1 - land) * PI) * 40, 3 + r() * 4, land); } }
  });
  focusBand(ctx, bc, 9, 900, 1080, 1600, 1860);
  slatBeams(ctx, T, 1150, -60, 2.2, 4, 0.1, 70, 170);
  L.bokeh(ctx, T, 33, 6, WARM, 0.18, 30, 90);
}

// =================================================================================================== S4 7.500–8.333 · KNIFE SLICES PORK BELLY (cuts 7.5 & 7.92)
// Camera faces the slab's cut end; slices fall toward the lens showing their layers.
const S4 = { cx: 540, by: 1330, ryr: 0.64, hc: 0.77, hw: 210, len: 460, th: 30, layers: [['#c9615c', 38], ['#fbeee2', 18], ['#d4706a', 30], ['#fff4ea', 22], ['#dc7f78', 20], ['#fff6ee', 12], ['#d3a07a', 10]] };
const S4_CUTS = [7.5, 7.917];
function s4Pt(x, y, z) { const k = 1 - z * 0.00045; return [S4.cx + x * k, S4.by - z * S4.ryr - y * S4.hc * k]; }
function s4Face(ctx, z, th, alpha = 1) { // layered cut face at depth z, tipped forward by angle th about its bottom edge
  const { hw } = S4; ctx.save(); ctx.globalAlpha = alpha;
  let y = 0; const tot = S4.layers.reduce((a, l) => a + l[1], 0);
  const P = (x, yy) => { const zz = z - yy * Math.sin(th), hh = yy * Math.cos(th); return s4Pt(x, hh, zz); };
  for (const [col, h] of S4.layers) {
    ctx.beginPath();
    for (let x = -hw; x <= hw; x += 30) { const [a, b] = P(x, y + Math.sin(x * 0.03 + y) * 2); x === -hw ? ctx.moveTo(a, b) : ctx.lineTo(a, b); }
    for (let x = hw; x >= -hw; x -= 30) { const [a, b] = P(x, y + h + Math.sin(x * 0.03 + y + h) * 2.5); ctx.lineTo(a, b); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); y += h;
  }
  // moist sheen + outline
  const [a0, b0] = P(-hw, 0), [a1, b1] = P(-hw, tot);
  ctx.fillStyle = lgr(ctx, a0, b0, a1, b1, [[0, 'rgba(0,0,0,0.08)'], [0.6, 'rgba(255,255,255,0.12)'], [1, 'rgba(0,0,0,0.05)']]);
  ctx.beginPath(); { const q = [P(-hw, 0), P(hw, 0), P(hw, tot), P(-hw, tot)]; ctx.moveTo(...q[0]); for (const v of q.slice(1)) ctx.lineTo(...v); ctx.closePath(); }
  ctx.fill(); ctx.strokeStyle = 'rgba(90,30,20,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  return tot;
}
function s4Top(ctx, z0, z1) { // skin-side top surface of the slab from depth z0 to z1
  const tot = S4.layers.reduce((a, l) => a + l[1], 0), hw = S4.hw;
  const q = [s4Pt(-hw, tot, z0), s4Pt(hw, tot, z0), s4Pt(hw, tot, z1), s4Pt(-hw, tot, z1)];
  ctx.beginPath(); ctx.moveTo(...q[0]); for (const v of q.slice(1)) ctx.lineTo(...v); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, q[0][1], 0, q[2][1], [[0, '#e8b892'], [0.5, '#c88c66'], [1, '#7a4a30']]); ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,230,190,0.35)'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(q[0][0] + 40 + i * 60, q[0][1] - 4); ctx.lineTo(q[3][0] + 60 + i * 50, q[3][1]); ctx.stroke(); }
  ctx.restore();
}
function s4(ctx, lt, p, T) {
  const z = lerp(1.5, 1.58, ease.inOut(p)), cx = lerp(560, 530, p);
  ctx.drawImage(kitchenBlur(), 0, 0);
  const [bc, bx] = buf('s4');
  const nCut = S4_CUTS.filter(t => T >= t).length; // 1 or 2
  const lastCut = S4_CUTS[nCut - 1], age = T - lastCut, th = S4.th;
  withCam(bx, { x: cx, y: 1190, z }, () => {
    // board
    BX.cuttingBoard(bx, 540, 1420, 3.0, { ryr: 0.42 });
    // already-cut slices lying shingled in front (toward the lens)
    const lying = 3 + nCut - 1;
    for (let i = 0; i < lying; i++) { bx.save(); bx.translate(-90 + i * 52, 120 + i * 30 - lying * 30); bx.translate(540, 1300); bx.rotate(-0.08 + i * 0.05); bx.translate(-540, -1300); s4Face(bx, -10 - i * 6, PI / 2 - 0.12); bx.restore(); }
    // slab body behind the knife plane
    const zf = nCut * th;
    s4Top(bx, zf + th, S4.len);
    s4Face(bx, zf + th, 0);
    // the knife: down on the cut, lifts between cuts
    let lift;
    if (nCut === 1 && T < S4_CUTS[1]) { const v = (T - S4_CUTS[0]) / (S4_CUTS[1] - S4_CUTS[0]); lift = v < 0.55 ? ease.out(seg(v, 0.04, 0.55)) : 1 - ease.in2(seg(v, 0.6, 1)); }
    else lift = 0.35 * ease.out(seg(T, S4_CUTS[1] + 0.12, 8.33));
    const kz = zf + th, [kx, ky] = s4Pt(70, lift * 240, kz);
    const kr = BX.knife(bx, kx, ky + 2, 1.2, 0, { lift: 0 });
    // the slice in front of the blade
    const fall = ease.in2(seg(age, 0.02, 0.3)), bounce = hitAt(age, 0.3, 0.16);
    bx.save(); bx.translate(0, -bounce * 8);
    s4Face(bx, kz - th, 0); // back face of the falling slice (hidden behind the front when upright)
    s4Top(bx, kz - th, kz);
    bx.restore();
    bx.save(); bx.translate(0, -bounce * 8 + fall * 6);
    s4Face(bx, zf, fall * (PI / 2 - 0.12));
    bx.restore();
    // knife hand from the right, the other hand's fingertips hold the slab further back
    armIn(bx, kr.grip[0] + 20, kr.grip[1] + 4, -2.8, 0.95, 'grip', true);
    const lh = s4Pt(-150, 150, 190); armIn(bx, lh[0] - 30, lh[1] + 14, 0.25, 0.8, 'grip');
    // cut impact: tiny sparkle on the edge
    const h = hitAt(T, lastCut, 0.18);
    if (h > 0) L.sparkle(bx, kr.tip[0] + 60, kr.edge[1] - 8, 40 * h, h);
  });
  focusBand(ctx, bc, 8, 480, 720, 1650, 1880);
  slatBeams(ctx, T, 1100, -100, 2.25, 4, 0.11, 70, 170);
  L.dust(ctx, T, 12, 20, 0, 500, W, 900, '255,225,170', 2.5, 0.35);
}

// =================================================================================================== S5 8.333–9.167 · COCONUT HEART + SPROUTS FALL INTO THE BASKET (slow-mo)
const S5 = { cx: 540, cy: 1330, rx: 520, ry: 210 };
function s5Basket() {
  return cached('s5basket', W, H, (x) => {
    const { cx, cy, rx, ry } = S5, r = rng(91);
    // basket inner surface (weave) seen at 3q
    x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
    ell(x, 0, 0, rx, rx); x.save(); x.clip();
    x.drawImage(weaveTex('weave22', 1024, 22), -rx, -rx, rx * 2, rx * 2);
    x.fillStyle = rgr(x, 0, -rx * 0.3, rx * 0.2, 0, 0, rx, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(20,8,2,0.6)']]); x.fillRect(-rx, -rx, rx * 2, rx * 2);
    x.restore(); x.restore();
    // the pile (sprouts + coconut heart), back to front
    const items = [];
    for (let i = 0; i < 150; i++) { const a = r() * TAU, d = Math.sqrt(r()); items.push({ x: cx + Math.cos(a) * d * rx * 0.78, y: cy + Math.sin(a) * d * ry * 0.75 - (1 - d) * 70, k: r() < 0.45 ? 'c' : 's', rot: r() * TAU, l: 150 + r() * 120, b: (r() - 0.5) * 30 }); }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) { if (it.k === 'c') coconutStrand(x, it.x, it.y, 2.2, it.rot * 0.25 - 0.1, it.l / 2.2, { bend: it.b / 2.2, w: 9 }); else BX.sprout(x, it.x, it.y, 2.6, it.rot); }
    // front wall + rim of the basket
    x.save(); x.translate(cx, cy);
    x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, PI); x.lineTo(-rx * 0.94, ry + 130); x.ellipse(0, 130, rx * 0.94, ry * 0.94, 0, PI, 0, true); x.closePath();
    x.save(); x.clip(); x.drawImage(weaveTex('weave22', 1024, 22), -rx, -40, rx * 2, 600);
    x.fillStyle = lgr(x, 0, 0, 0, ry + 140, [[0, 'rgba(255,190,120,0.15)'], [1, 'rgba(10,4,2,0.75)']]); x.fillRect(-rx, 0, rx * 2, ry + 200); x.restore();
    x.lineWidth = 30; x.strokeStyle = lgr(x, -rx, 0, rx, 0, [[0, '#7a5028'], [0.3, '#d8a868'], [0.7, '#a87440'], [1, '#5a3818']]); ell(x, 0, 0, rx, ry); x.stroke();
    x.strokeStyle = 'rgba(50,28,10,0.55)'; x.lineWidth = 3; for (let i = 0; i < 80; i++) { const a = i / 80 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * (rx - 14), Math.sin(a) * (ry - 6)); x.lineTo(Math.cos(a + 0.03) * (rx + 14), Math.sin(a + 0.03) * (ry + 6)); x.stroke(); }
    x.strokeStyle = 'rgba(255,225,170,0.7)'; x.lineWidth = 4; x.beginPath(); x.ellipse(0, -4, rx, ry, 0, PI * 1.1, PI * 1.7); x.stroke();
    x.restore();
  });
}
const S5_FALL = Array.from({ length: 26 }, (_, i) => { const r = rng(700 + i); return { k: i % 5 < 3 ? 'c' : 's', x: 300 + r() * 480, y0: -260 + r() * 900, v: 230 + r() * 120, rot: r() * TAU, w: (r() - 0.5) * 1.4, l: 60 + r() * 60, land: 1180 + r() * 170, sc: 2.1 + r() * 0.5 }; });
function s5(ctx, lt, p, T) {
  const z = lerp(1.0, 1.07, ease.inOut(p)), cy = lerp(1080, 1120, p);
  ctx.save(); L.cam(ctx, 540, 960, 1 + (z - 1) * 0.4, 0, () => ctx.drawImage(kitchenBlur(), 0, 0)); ctx.restore();
  L.glow(ctx, 900, 300, 900, 'rgba(255,170,90,1)', 0.28);
  const [bc, bx] = buf('s5');
  withCam(bx, { x: 540, y: cy, z }, () => {
    bx.drawImage(s5Basket(), 0, 0);
    for (const f of S5_FALL) {
      const t = lt + 0.9, yy = f.y0 + f.v * t + 60 * t * t; const landed = yy >= f.land; const y = landed ? f.land : yy, rot = f.rot + (landed ? f.w * (f.land - f.y0) / f.v : f.w * t);
      const sq = landed ? 0.55 : 1;
      if (f.k === 'c') coconutStrand(bx, f.x, y, f.sc, rot, f.l, { bend: 5, w: 9.5 }); else { bx.save(); bx.translate(f.x, y); bx.scale(1, sq); BX.sprout(bx, 0, 0, f.sc * 1.15, rot); bx.restore(); }
    }
  });
  focusBand(ctx, bc, 7, 250, 650, 1650, 1900);
  // backlight beam through the falling strands, motes
  slatBeams(ctx, T, 1200, -150, 2.05, 5, 0.14, 80, 150);
  L.dust(ctx, T, 21, 40, 0, 200, W, 1300, '255,230,180', 3, 0.5);
  L.bokeh(ctx, T, 44, 6, WARM, 0.16, 40, 110);
}

// =================================================================================================== S6 9.167–10.833 · PRAWNS + PORK INTO THE PAN, rack focus down to the flames
const S6_DROPS = Array.from({ length: 12 }, (_, i) => { const r = rng(900 + i); return { tl: 9.24 + i * 0.045 + r() * 0.03, kind: i % 2 ? 'pork' : 'shrimp', dx: (r() - 0.5) * 300, dy: (r() - 0.5) * 70, rot: r() * TAU }; });
function s6Cam(T) {
  const e = ease.inOut(seg(T, 9.167, 10.0)), d = ease.inOut(seg(T, 9.95, 10.75));
  return { x: lerp(lerp(360, 300, e), 288, d), y: lerp(lerp(1090, 1110, e), 1610, d), z: lerp(lerp(1.95, 2.05, e), 2.6, d) };
}
function s6(ctx, lt, p, T) {
  const c = s6Cam(T);
  const [bc, bx] = buf('s6');
  withCam(bx, c, () => {
    const K = BX.kitchenInterior(bx, T, { view: 'stove', dusk: 0.15, fire: 1 + 0.6 * seg(T, 9.95, 10.3), beams: true, smoke: 0.6 });
    const P = K.pans[0], ryr = P.ry / P.rx, pcx = P.x, pcy = P.y + 3;
    const landed = S6_DROPS.filter(d => T >= d.tl).length;
    const meat = landed / S6_DROPS.length, searing = ease.inOut(seg(T, 9.4, 10.7));
    BX.crepeStage(bx, pcx, pcy, 1.0, { ryr, t: T, seed: 9, oil: 1, meat, searing });
    // falling pieces from the tipped bowl
    const tilt = lerp(-0.2, -0.95, ease.out(seg(T, 9.1, 9.5))) * (1 - ease.inOut(seg(T, 9.8, 10.2)));
    const bxp = lerp(440, 480, seg(T, 9.1, 9.7)) + 120 * ease.in2(seg(T, 9.75, 10.3)), byp = 900 - 160 * ease.in2(seg(T, 9.75, 10.3));
    for (const d of S6_DROPS) {
      const u = seg(T, d.tl - 0.26, d.tl); if (u <= 0 || u >= 1) continue;
      const x = lerp(bxp - 70, pcx + d.dx, u), y = lerp(byp + 10, pcy + d.dy * ryr, u * u), rr = d.rot + u * 2;
      if (d.kind === 'shrimp') BX.shrimp(bx, x, y, 1.0, rr, { sear: 0 }); else BX.porkSlice(bx, x, y, 1.0, rr, { sear: 0 });
    }
    smallBowl(bx, bxp, byp, 0.55, tilt);
    armIn(bx, bxp + 60, byp + 10, -2.5, 0.55, 'grip', true);
    // sizzle: spits on every landing, steam rising through the beam
    for (const d of S6_DROPS) if (T >= d.tl && T < d.tl + 0.6) oilSpits(bx, T, d.tl, pcx + d.dx, pcy + d.dy * ryr, 0.45, { n: 6, seed: Math.round(d.tl * 1000), slow: 0.8, life: 0.6, ryr: 0.9 });
    BX.oilSparkle(bx, T, pcx, pcy - 6, 0.6, { n: 12, w: 380, h: 50, alpha: 0.85 });
    L.steam(bx, T, 31, pcx, pcy - 30, 300, 380, 7, 0.28 * seg(T, 9.3, 9.8));
    if (searing > 0.2) BX.smokeWisp(bx, T, pcx - 60, pcy - 20, 0.6, { seed: 7, alpha: 0.4 * searing, h: 320 });
    // flare-up licking the pan bottom when the fire roars (10.0)
    const fl = seg(T, 9.95, 10.25);
    if (fl > 0) { bx.save(); bx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const fx = pcx - 200 + i * 50, hh = (40 + 30 * Math.sin(T * 17 + i * 2)) * fl; bx.fillStyle = lgr(bx, fx, pcy + 60, fx, pcy + 60 - hh, [[0, 'rgba(255,170,60,0.55)'], [1, 'rgba(255,80,20,0)']]); ell(bx, fx, pcy + 60 - hh / 2, 16, hh / 2); bx.fill(); } bx.restore(); }
  });
  // rack focus: the pan goes soft, the fire mouth below sharpens
  const rk = ease.inOut(seg(T, 9.98, 10.6));
  blurDraw(ctx, bc, 14 * rk);
  if (rk > 0) {
    ctx.save();
    withCam(ctx, c, () => { ctx.beginPath(); ctx.moveTo(130, 1818); ctx.lineTo(130, 1640); ctx.arc(286, 1640, 156, PI, 0); ctx.lineTo(442, 1818); ctx.closePath(); });
    ctx.clip(); ctx.globalAlpha = rk; ctx.drawImage(bc, 0, 0);
    ctx.restore();
    // roaring flames + embers in the fire mouth
    withCam(ctx, c, () => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) { const fx = 170 + i * 33, hh = (110 + 60 * Math.sin(T * 13 + i * 1.7) * Math.sin(T * 4.1 + i)) * (0.6 + 0.4 * rk); ctx.globalAlpha = 0.45 * rk; ctx.fillStyle = lgr(ctx, fx, 1790, fx, 1790 - hh, [[0, 'rgba(255,220,120,1)'], [0.5, 'rgba(255,130,40,0.7)'], [1, 'rgba(255,60,20,0)']]); ell(ctx, fx, 1790 - hh / 2, 20, hh / 2); ctx.fill(); }
      ctx.restore();
      embers(ctx, T, 286, 1760, 260, 420, 22, 8, rk);
    });
  }
  slatBeams(ctx, T, 1150, -100, 2.25, 4, 0.08, 70, 170);
  L.glow(ctx, 540, 1900, 1000, 'rgba(255,90,30,1)', 0.2 * flick(T) + 0.15 * rk);
}

// =================================================================================================== S7 10.833–13.333 · SWIRL (eye level with the pan rim)
function s7(ctx, lt, p, T) {
  const e = ease.inOut(p), orb = lerp(-1, 1, e);
  // background kitchen with parallax for the orbit
  withCam(ctx, { x: 540 - orb * 70, y: 900, z: 1.22 }, () => ctx.drawImage(kitchenBlur(), 0, 0));
  L.glow(ctx, 880 - orb * 120, 300, 700, 'rgba(255,170,90,1)', 0.25);
  const c = { x: 540 + orb * 45, y: lerp(1030, 1060, e), z: lerp(1.55, 1.66, e), r: lerp(0.03, -0.025, e) };
  const b = lerp(0.4, 1, ease.out(seg(T, 10.833, 12.6))), a = (T - 10.833) * TAU * 0.75, sw = 1 - seg(T, 12.7, 13.3) * 0.7;
  let panS = null;
  const [bc, bx] = buf('s7');
  withCam(bx, c, () => {
    const s = 2.5, mx = 540 - orb * 30, my = 1580;
    BX.maTu(bx, mx, my, s, {
      pose: 'swirl', t: T * sw, panAt: [mx, my - 330], panRx: 300, expr: 'calm', look: [0.2, 1], stool: false,
      hold: (cx, P) => {
        BX.pan(cx, P.x, P.y + 30, 1.36, { ryr: lerp(0.3, 0.36, e), rot: P.rot, handle: -PI / 2 + orb * 0.25, oil: 1, t: T, meat: 1, searing: 1, batter: b, cook: 0.05 * b, pourAt: [Math.cos(a) * 60 * sw, Math.sin(a) * 60 * sw], contentRot: 0.4 + e * 0.5 });
        BX.oilSparkle(cx, T, P.x, P.y + 20, 1.1, { n: 10, w: 420, h: 60, alpha: 0.8 });
        panS = [P.x, P.y];
      },
    });
    // the clay stove in front hides her lap; fire glow under the lifted pan
    stoveSlab(bx, T, 1400, mx, 1330, 330);
    L.glow(bx, mx, 1720, 520, 'rgba(255,120,40,1)', 0.45 * flick(T, 2));
  });
  // shallow depth of field: pan + hands crisp, her face soft behind the rising steam
  focusBand(ctx, bc, 5, 420, 760, 1700, 1920);
  // steam rising through the sunset beam
  if (panS) { const q = camPt(c, panS); L.steam(ctx, T, 51, q[0], q[1] - 40, 700, 900, 10, 0.3 * seg(T, 11.0, 11.6)); }
  slatBeams(ctx, T, 1200 - orb * 60, -120, 2.15, 6, 0.15, 80, 140);
  L.dust(ctx, T, 31, 30, 0, 300, W, 1100, '255,225,170', 2.5, 0.4);
  embers(ctx, T, 540, 1800, 900, 600, 16, 5, 0.6);
}

// =================================================================================================== stove top (s8, s9): top-down clay stove texture around the pan hole
const ST = { R: 364 };   // pan outer radius at the match-cut scale (s 1.486)
function stoveTopTex() {
  return cached('stoveTop', 2600, 2600, (x) => {
    const r = rng(17), C = 1300;
    x.fillStyle = rgr(x, C, C, 300, C, C, 1500, [[0, '#7a4228'], [0.45, '#5a2e1c'], [1, '#1c0c08']]); x.fillRect(0, 0, 2600, 2600);
    for (let i = 0; i < 900; i++) { const xx = r() * 2600, yy = r() * 2600, rr = 4 + r() * 34; x.fillStyle = r() < 0.55 ? `rgba(30,12,6,${0.05 + r() * 0.12})` : `rgba(255,190,140,${0.025 + r() * 0.05})`; ell(x, xx, yy, rr, rr * (0.5 + r() * 0.5), r() * PI); x.fill(); }
    x.strokeStyle = 'rgba(30,10,4,0.4)'; x.lineWidth = 3;
    for (let i = 0; i < 26; i++) { let xx = r() * 2600, yy = r() * 2600; x.beginPath(); x.moveTo(xx, yy); for (let k = 0; k < 5; k++) { xx += (r() - 0.5) * 120; yy += (r() - 0.5) * 120; x.lineTo(xx, yy); } x.stroke(); }
    const R = ST.R;
    x.fillStyle = rgr(x, C, C, R * 0.9, C, C, R * 1.55, [[0, 'rgba(8,3,2,1)'], [0.25, 'rgba(36,10,4,0.95)'], [0.6, 'rgba(70,26,10,0.45)'], [1, 'rgba(70,26,10,0)']]); x.fillRect(C - R * 1.6, C - R * 1.6, R * 3.2, R * 3.2);
  });
}
// stove + flame ring for a pan at (x,y), scale s (BX.pan s), plane squash ryr
function stoveAround(ctx, T, x, y, s, ryr) {
  const k = s / 1.486;
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k * ryr); ctx.drawImage(stoveTopTex(), -1300, -1300); ctx.restore();
  const R = 245 * s, fl = flick(T);
  L.glow(ctx, x, y, R * 1.45, 'rgba(255,100,30,1)', 0.45 * fl);
  // fire light leaking from under the pan: a soft ring + a few lazy tongues (no comic spikes)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, ryr);
  ctx.globalAlpha = fl;
  ctx.fillStyle = rgr(ctx, 0, 0, R * 0.96, 0, 0, R * 1.32, [[0, 'rgba(255,150,50,0.5)'], [0.35, 'rgba(255,90,20,0.22)'], [1, 'rgba(120,20,0,0)']]);
  ctx.beginPath(); ctx.arc(0, 0, R * 1.32, 0, TAU); ctx.arc(0, 0, R * 0.96, 0, TAU, true); ctx.fill('evenodd');
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU + 0.35 * Math.sin(i * 3.1), f = 0.5 + 0.5 * Math.sin(T * 7 + i * 2.3) * Math.sin(T * 4.3 + i);
    if (f < 0.3) continue;
    const r0 = R * 0.99, len = R * (0.08 + 0.12 * f);
    ctx.save(); ctx.rotate(a); ctx.globalAlpha = (f - 0.3) * 1.2;
    ctx.fillStyle = lgr(ctx, r0, 0, r0 + len, 0, [[0, 'rgba(255,215,120,0.55)'], [0.5, 'rgba(255,120,40,0.3)'], [1, 'rgba(255,60,20,0)']]);
    ell(ctx, r0 + len * 0.45, Math.sin(T * 3 + i) * R * 0.01, len * 0.6, R * 0.03); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
// pan + crêpe drawn separately so the crêpe can slide inside the pan (shiftY in crêpe plane units)
function panCrepe(ctx, x, y, s, ryr, o, shiftY = 0) {
  const pr = BX.pan(ctx, x, y, s, { ryr, handle: o.handle ?? 0.35, oil: 0.4, t: o.t, batter: 0, meat: 0 });
  const cc = Math.sqrt(Math.max(0, 1 - ryr * ryr)), RI = 222 * s;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, RI - 2, RI * ryr - 1, 0, 0, TAU); ctx.rect(x - RI * 2, y - RI * 4, RI * 4, RI * 4); ctx.clip('nonzero');
  const cs = s * 205 / 200 * 0.985, fx = x, fy = y + 34 * cc * s + shiftY * cs * ryr;
  BX.crepeStage(ctx, fx, fy, cs, Object.assign({}, o, { ryr }));
  ctx.restore();
  return { pr, fx, fy, cs };
}

// =================================================================================================== S8 13.333–15.833 · CRÊPE SURFACE DRYING, LACY EDGE; sprouts + coconut heart sprinkled (~14.6)
const S8_STR = Array.from({ length: 30 }, (_, i) => { const r = rng(1100 + i); return { x: (r() - 0.5) * 290, y: 40 + r() * 120, rot: (r() - 0.5) * 1.6, l: 40 + r() * 34, tl: 14.45 + r() * 0.35, h: 200 + r() * 220 }; });
const S8_SPR = Array.from({ length: 16 }, (_, i) => { const r = rng(1200 + i); return { x: (r() - 0.5) * 300, y: 30 + r() * 140, rot: r() * TAU, tl: 14.4 + r() * 0.35, h: 200 + r() * 220 }; });
function s8(ctx, lt, p, T) {
  const ps = 2.55, ryr = 0.74, px = 560, py = 1190;
  const e = ease.inOut(p);
  const c = { x: lerp(330, 520, e), y: lerp(1100, 1090, e), z: lerp(1.75, 1.08, ease.inOut(seg(T, 13.333, 14.6))), r: lerp(-0.04, 0.0, e) };
  const cook = lerp(0.2, 0.95, ease.inOut(p));
  let geo = null;
  withCam(ctx, c, () => {
    stoveAround(ctx, T, px, py, ps, ryr);
    geo = panCrepe(ctx, px, py, ps, ryr, { t: T, seed: 9, meat: 1, searing: 1, batter: 1, cook, sprouts: ease.out(seg(T, 14.5, 14.9)), handle: 0.25 });
    const { fx, fy, cs } = geo, Pp = (u, v) => [fx + u * cs, fy + v * cs * ryr];
    // landed coconut heart strands on the bottom half
    for (const q of S8_STR) if (T >= q.tl) { const [a, b] = Pp(q.x, q.y); coconutStrand(ctx, a, b, cs * 0.55, q.rot, q.l * 1.6, { bend: 3, w: 5 }); }
    batterBubbles(ctx, T, fx, fy, 170 * cs, ryr, 60, 8, 1.4 * cs / 2, 1 - cook * 0.8);
    BX.oilSparkle(ctx, T, fx, fy, 1.5, { n: 12, w: 560, h: 380, alpha: 0.55 });
    BX.smokeWisp(ctx, T, fx - 180, fy - 40, 1.4, { seed: 2, alpha: 0.35, h: 500 });
    BX.smokeWisp(ctx, T + 1.1, fx + 220, fy + 10, 1.3, { seed: 5, alpha: 0.3, h: 460 });
    // the handful falling (slow), then the hand withdraws
    for (const q of S8_STR) { const u = seg(T, q.tl - 0.32, q.tl); if (u <= 0 || u >= 1) continue; const [a, b] = Pp(q.x, q.y); coconutStrand(ctx, a + (1 - u) * 120, b - (1 - u) * q.h, cs * 0.6, q.rot + (1 - u) * 2, q.l * 1.6, { bend: 3, w: 5 }); }
    for (const q of S8_SPR) { const u = seg(T, q.tl - 0.32, q.tl); if (u <= 0 || u >= 1) continue; const [a, b] = Pp(q.x, q.y); BX.sprout(ctx, a + (1 - u) * 120, b - (1 - u) * q.h, cs * 0.75, q.rot + (1 - u) * 3); }
    const hu = seg(T, 13.95, 14.35), ho = ease.in2(seg(T, 14.75, 15.3));
    if (hu > 0 && ho < 1) { const [a, b] = Pp(40, 60); armIn(ctx, a + 150 + 300 * (1 - ease.out(hu)) + 400 * ho, b - 330 - 200 * (1 - ease.out(hu)) - 300 * ho, 2.1, 1.35, T > 14.45 ? 'open' : 'pinch', true); }
  });
  slatBeams(ctx, T, 1150, -100, 2.3, 5, 0.12, 70, 150);
  L.glow(ctx, 540, 1950, 900, 'rgba(255,90,30,1)', 0.15 * flick(T));
}

// =================================================================================================== S9 15.833–17.500 · FOLD; edges meet at 16.667; match-cut framing at 17.5
const FOLD_T = 16.667, END = { x: 540, y: 1060, s: 222 / 222 * 330 / 222, ryr: 1 };
function s9(ctx, lt, p, T) {
  const cr = ease.inOut(seg(T, 16.8, 17.38));
  const hold = seg(T, 15.833, 16.8);
  const x = lerp(lerp(575, 560, hold), END.x, cr), y = lerp(lerp(1150, 1120, hold), END.y, cr), s = lerp(lerp(2.45, 2.6, hold), END.s, cr), ryr = lerp(lerp(0.62, 0.66, hold), END.ryr, cr);
  const fold = ease.inOut(seg(T, 15.98, FOLD_T)), land = hitAt(T, FOLD_T, 0.3);
  const shift = -0.42 * 200 * ease.inOut(seg(T, 16.95, 17.4));
  ctx.fillStyle = '#100604'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(0, -land * 6);
  stoveAround(ctx, T, x, y, s, ryr);
  const g = panCrepe(ctx, x, y, s, ryr, { t: T, seed: 9, meat: 1, searing: 1, batter: 1, cook: 1, sprouts: 1, fold, handle: 0.35 }, shift);
  const { fx, fy, cs } = g, cc = Math.sqrt(Math.max(0, 1 - ryr * ryr)), RR = 200 * cs;
  // coconut strands on the filling until the flap covers them
  const sa = 1 - seg(fold, 0.4, 0.7);
  if (sa > 0) { ctx.save(); ctx.globalAlpha = sa; for (const q of S8_STR) coconutStrand(ctx, fx + q.x * cs, fy + q.y * cs * ryr, cs * 0.55, q.rot, q.l * 1.6, { bend: 3, w: 5 }); ctx.restore(); }
  BX.oilSparkle(ctx, T, fx, fy, s * 0.7, { n: 10, w: 520, h: 300, alpha: 0.5 });
  // spatula follows the lifting edge, then leaves to the upper right
  const su = seg(T, 15.833, 15.98), out = ease.in2(seg(T, 16.72, 17.2));
  if (out < 1) {
    const th = fold * PI, ez = RR * Math.sin(th), ey = -RR * Math.cos(th);
    const ex = fx + 40 * cs, eyS = fy + ey * ryr - ez * cc;
    const appr = 1 - ease.out(su);
    const rot = lerp(-0.45, -0.85, fold);
    const sp = BX.spatula(ctx, ex + 300 * appr + 520 * out, eyS - 120 * appr - 420 * out, s * 0.62, rot);
    armIn(ctx, sp.grip[0] + 10, sp.grip[1], PI + rot, s * 0.5, 'grip', true);
  }
  // edges meet: crispy crumbs + a puff of steam from the seam
  if (T >= FOLD_T - 0.02) {
    const sx = fx, sy = fy + RR * ryr * 0.98;
    BX.crumbBurst(ctx, T, FOLD_T, sx, sy, s * 0.55, { n: 30, seed: 4, spread: 1.4 });
    BX.crumbBurst(ctx, T, FOLD_T + 0.02, sx - 120 * cs, sy - 20, s * 0.45, { n: 14, seed: 6 });
    const k = seg(T, FOLD_T, FOLD_T + 0.83);
    if (k > 0 && k < 1) { L.steam(ctx, T * 0.5 + 3, 66, fx, fy + RR * ryr * 0.6 - 60 * ease.out(k), RR * 1.4, 300 + 300 * k, 8, 0.4 * Math.sin(k * PI)); L.glow(ctx, fx, fy + RR * ryr * 0.8, RR * 0.8, 'rgba(255,240,220,1)', 0.18 * (1 - k)); }
  }
  L.steam(ctx, T, 61, fx, fy - 20, 380 * s / 1.5, 520, 6, 0.18);
  ctx.restore();
  slatBeams(ctx, T, 1150, -100, 2.3, 5, 0.1, 70, 150);
  L.glow(ctx, 540, 1950, 900, 'rgba(255,90,30,1)', 0.12 * flick(T));
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8, s9 };
