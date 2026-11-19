'use strict';
// shotsB.js — Bánh xèo miền Tây 40 s: shots s10..s16 (17.5–40.0 s) = scenes 4–6.
// s10 hero plate (match cut pan → plate, widen, push-in + 180° orbit) · s11 break in half (crack 22.5, slow-mo macro)
// s12 POV mustard-leaf wrap · s13 macro dip (29.0) · s14 tourist bite (30.833) · s15 wide canal table · s16 sunset + CTA.
// Each sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes, grain; overlay.js adds all text.
const BX = require('./bxprops');
const L = require('./lib');
const PE = require('./people');
const NP = BX.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;
const BEAT = 60 / 72;
const CR = 200;                       // crêpe radius (crêpe units)
const iv = (a, b, v) => clamp((v - a) / (b - a));
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const lgr = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const rgr = (ctx, x0, y0, r0, x1, y1, r1, st) => { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const SKIN = PE.SKIN;                 // the tourist's skin (diner hands, POV)
const TEE = '#2f8f8a';

// ================================================================================== caches
const CACHE = {};
function cached(key, w, h, fn) {
  if (!CACHE[key]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[key] = c; }
  return CACHE[key];
}
function blurOf(src, px, keepBase = true) {
  const c = createCanvas(src.width, src.height), x = c.getContext('2d');
  if (keepBase) x.drawImage(src, 0, 0); x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); x.filter = 'none';
  return c;
}
// sprite with a pre-blurred twin (DOF without per-frame filters)
const SPR = {};
function sprite(key, w, h, ox, oy, fn, blurPx) {
  if (!SPR[key]) { const c = createCanvas(w, h); fn(c.getContext('2d')); SPR[key] = { c, soft: blurOf(c, blurPx, false), ox, oy, w, h }; }
  return SPR[key];
}
function drawSprite(ctx, sp, x, y, s, soft = 0, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  const sa = clamp(1 - soft * 2.2);
  if (soft > 0.02) { ctx.globalAlpha = alpha * Math.min(1, soft * 2.2); ctx.drawImage(sp.soft, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s); }
  if (sa > 0.02) { ctx.globalAlpha = alpha * sa; ctx.drawImage(sp.c, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s); }
  if (false) { ctx.drawImage(sp.soft, x - sp.ox * s, y - sp.oy * s, sp.w * s, sp.h * s); }
  ctx.restore();
}
const puffSpr = (key, rgb) => cached(key, 128, 128, (x) => {
  x.fillStyle = rgr(x, 64, 64, 0, 64, 64, 64, [[0, `rgba(${rgb},0.85)`], [0.4, `rgba(${rgb},0.42)`], [0.75, `rgba(${rgb},0.12)`], [1, `rgba(${rgb},0)`]]); x.fillRect(0, 0, 128, 128);
});
const PUFF = () => puffSpr('puffW', '255,244,228');
const SMOKE = () => puffSpr('puffS', '200,170,170');

// ================================================================================== light tones
const GOLD = { haze: [255, 196, 122], shadow: 'rgba(36,12,2,0.55)', rim: [255, 214, 140], sun: [255, 206, 130], bokeh: ['rgba(255,214,150,1)', 'rgba(255,180,110,1)', 'rgba(255,236,190,1)'] };
const SUNSET = { haze: [255, 150, 92], shadow: 'rgba(30,8,10,0.6)', rim: [255, 168, 96], sun: [255, 150, 80], bokeh: ['rgba(255,160,110,1)', 'rgba(255,120,90,1)', 'rgba(255,210,150,1)'] };
const AFTER = { haze: [255, 214, 150], shadow: 'rgba(30,14,4,0.45)', rim: [255, 226, 160], sun: [255, 226, 160], bokeh: ['rgba(255,236,180,1)', 'rgba(220,240,180,1)', 'rgba(255,214,150,1)'] };
const rgbA = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ================================================================================== backgrounds (blurred river plates)
function bgPlate(name) {
  return cached('bg_' + name, W, H, (x, c) => {
    const src = createCanvas(W, H), sx = src.getContext('2d');
    if (name === 'gold') BX.riversideScene(sx, 12, { dusk: 0.04, horizon: 1000, sun: [640, 780], sunS: 1.35, flare: 0, house: { x: 240, y: 1160, s: 0.75 }, garden: false });
    else if (name === 'sunset') BX.riversideScene(sx, 30, { dusk: 0.55, horizon: 1000, sun: [540, 930], sunS: 1.5, flare: 0, house: { x: 900, y: 1170, s: 0.7 }, garden: false });
    else BX.riversideScene(sx, 20, { dusk: 0.0, horizon: 1040, sun: [860, 640], sunS: 1.1, flare: 0, house: { x: 260, y: 1200, s: 0.8 }, garden: false });
    x.drawImage(blurOf(src, name === 'sunset' ? 7 : 16), 0, 0);
    if (name !== 'sunset') { // push the late-afternoon plates toward warm gold (less magenta)
      x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,176,70,0.85)'; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = lgr(x, 0, 0, 0, H, [[0, 'rgba(255,214,170,1)'], [0.5, 'rgba(255,236,200,1)'], [1, 'rgba(255,255,255,1)']]); x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'source-over';
    }
  });
}
const BG_SUN = { gold: [640, 780], sunset: [540, 930], after: [860, 640] };
// draw a bg plate so that plate point (ax,ay) lands on screen (px,py) at zoom z (always covers the frame)
function drawBg(ctx, name, ax, ay, z, px, py) {
  const img = bgPlate(name);
  let x0 = px - ax * z, y0 = py - ay * z;
  x0 = clamp(x0, W - W * z, 0); y0 = clamp(y0, H - H * z, 0);
  ctx.drawImage(img, x0, y0, W * z, H * z);
  return [x0 + BG_SUN[name][0] * z, y0 + BG_SUN[name][1] * z];
}

// ================================================================================== wooden table (plane texture)
const WOOD_U = 4800;
function woodTex() {
  return cached('wood', 2048, 2048, (x) => {
    const r = rng(31), pw = 128;
    for (let i = 0; i < 16; i++) {
      const y0 = i * pw, v = 0.8 + r() * 0.3, hu = r();
      const c0 = [Math.round((150 + hu * 20) * v), Math.round((84 + hu * 10) * v), Math.round(44 * v)];
      x.fillStyle = lgr(x, 0, y0, 0, y0 + pw, [[0, `rgb(${c0.map(q => q * 0.86 | 0)})`], [0.5, `rgb(${c0})`], [1, `rgb(${c0.map(q => q * 0.8 | 0)})`]]);
      x.fillRect(0, y0, 2048, pw);
      for (let q = 0; q < 34; q++) {
        const yy = y0 + r() * pw, a = 0.05 + r() * 0.16, dark = r() < 0.7, amp = 1 + r() * 4, f = 0.002 + r() * 0.01, ph = r() * 9;
        x.strokeStyle = dark ? `rgba(60,24,8,${a})` : `rgba(255,200,140,${a * 0.6})`; x.lineWidth = 0.6 + r() * 1.6;
        x.beginPath(); for (let xx = 0; xx <= 2048; xx += 32) { const yv = yy + Math.sin(xx * f + ph) * amp + Math.sin(xx * f * 3.1 + ph) * amp * 0.4; xx ? x.lineTo(xx, yv) : x.moveTo(xx, yv); } x.stroke();
      }
      if (r() < 0.6) { // knot
        const kx = r() * 2048, ky = y0 + pw * (0.3 + r() * 0.4);
        for (let q = 0; q < 6; q++) { x.strokeStyle = `rgba(70,28,8,${0.25 - q * 0.03})`; x.lineWidth = 1.4; ell(x, kx, ky, 6 + q * 9, 3 + q * 4); x.stroke(); }
        x.fillStyle = 'rgba(50,20,6,0.5)'; ell(x, kx, ky, 5, 3); x.fill();
      }
      x.fillStyle = 'rgba(30,10,2,0.75)'; x.fillRect(0, y0, 2048, 3);
      x.fillStyle = 'rgba(255,214,160,0.16)'; x.fillRect(0, y0 + 3, 2048, 2);
      const jx = r() * 2048; x.fillStyle = 'rgba(30,10,2,0.6)'; x.fillRect(jx, y0, 3, pw);
    }
    for (let i = 0; i < 140; i++) { x.strokeStyle = `rgba(255,220,170,${0.04 + r() * 0.06})`; x.lineWidth = 1; const sx = r() * 2048, sy = r() * 2048, a = (r() - 0.5) * 0.6, l = 20 + r() * 90; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke(); }
  });
}
// table plane: world (X,Z) → screen. Z toward the camera. phi = orbit angle.
function plane(cx, cy, S, ryr, phi) {
  const c = Math.cos(phi), n = Math.sin(phi);
  return {
    cx, cy, S, ryr, phi,
    p: (X, Z, h = 0) => [cx + S * (c * X - n * Z), cy + S * (ryr * (n * X + c * Z) - h * Math.sqrt(1 - ryr * ryr))],
    depth: (X, Z) => n * X + c * Z,
  };
}
function woodPlane(ctx, P) { // tiled 3×3 so low camera angles never run out of table
  ctx.save(); ctx.translate(P.cx, P.cy); ctx.scale(P.S, P.S * P.ryr); ctx.rotate(P.phi);
  const tex = woodTex();
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) ctx.drawImage(tex, -WOOD_U / 2 + i * WOOD_U, -WOOD_U / 2 + j * WOOD_U, WOOD_U, WOOD_U);
  ctx.restore();
}
function drawTable(ctx, P, hz, tone, sun) {
  ctx.save(); ctx.beginPath(); ctx.rect(0, hz, W, H - hz); ctx.clip();
  woodPlane(ctx, P);
  // varnish sheen toward the sun (long streak) + darker foreground
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.translate(sun[0], hz + 40); ctx.scale(1, 0.32);
  ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, 900, [[0, rgbA(tone.sun, 0.55)], [0.4, rgbA(tone.sun, 0.18)], [1, rgbA(tone.sun, 0)]]); ctx.fillRect(-1000, -1000, 2000, 2000);
  ctx.restore();
  ctx.fillStyle = lgr(ctx, 0, hz, 0, H, [[0, rgbA(tone.haze, 0.95)], [0.07, rgbA(tone.haze, 0.45)], [0.22, rgbA(tone.haze, 0)], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(18,6,2,0.72)']]);
  ctx.fillRect(0, hz, W, H - hz);
  ctx.restore();
  // soft out-of-focus horizon band (hides the hard table edge)
  ctx.fillStyle = lgr(ctx, 0, hz - 160, 0, hz + 220, [[0, rgbA(tone.haze, 0)], [0.42, rgbA(tone.haze, 0.7)], [0.5, rgbA(tone.haze, 0.62)], [1, rgbA(tone.haze, 0)]]);
  ctx.fillRect(0, hz - 160, W, 380);
}

// ================================================================================== rustic ceramic plate (đĩa sành)
const PL_R = 330;
function plateTex() {
  return cached('plateTex', 1000, 1000, (x) => {
    const r = rng(77), k = 500 / 345; x.translate(500, 500); x.scale(k, k);
    ell(x, 0, 0, PL_R, PL_R);
    x.fillStyle = rgr(x, 0, 0, 200, 0, 0, PL_R, [[0, '#3a1c0c'], [0.25, '#5c2e14'], [0.6, '#7e4220'], [0.86, '#5a2a12'], [0.95, '#8a5430'], [1, '#c4935e']]); x.fill();
    // rim speckles + glaze pooling
    for (let i = 0; i < 420; i++) { const a = r() * TAU, d = 228 + r() * 98, z = 0.6 + r() * 2.2; x.fillStyle = r() < 0.5 ? `rgba(20,8,2,${0.3 + r() * 0.4})` : `rgba(230,170,110,${0.15 + r() * 0.25})`; ell(x, Math.cos(a) * d, Math.sin(a) * d, z, z * 0.8); x.fill(); }
    for (let i = 0; i < 40; i++) { const a = r() * TAU, d = 250 + r() * 60; x.fillStyle = 'rgba(40,16,6,0.25)'; ell(x, Math.cos(a) * d, Math.sin(a) * d, 14 + r() * 20, 5 + r() * 6, a + PI / 2); x.fill(); }
    // cream glaze well with an irregular run edge + drips into the brown band
    const drips = Array.from({ length: 7 }, () => [r() * TAU, 0.14 + r() * 0.1, 6 + r() * 12]);
    x.beginPath();
    for (let i = 0; i <= 240; i++) {
      const a = i / 240 * TAU; let rr = 222 + 5 * Math.sin(7 * a) + 3 * Math.sin(13 * a + 1) + 2 * Math.sin(29 * a);
      for (const [da, w, l] of drips) { const dd = Math.abs(((a - da + PI) % TAU + TAU) % TAU - PI); if (dd < w) rr += l * Math.cos(dd / w * PI / 2) ** 2; }
      i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x.closePath();
    x.fillStyle = rgr(x, -40, -40, 0, 0, 0, 240, [[0, '#f4e9d2'], [0.6, '#eadbb9'], [0.88, '#d9c398'], [1, '#b8955e']]); x.fill();
    x.save(); x.clip();
    for (let i = 0; i < 520; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 240, z = 0.5 + r() * 1.6; x.fillStyle = `rgba(${r() < 0.7 ? '90,50,20' : '160,110,60'},${0.25 + r() * 0.5})`; ell(x, Math.cos(a) * d, Math.sin(a) * d, z, z); x.fill(); }
    for (let i = 0; i < 9; i++) { x.strokeStyle = `rgba(150,110,60,${0.05 + r() * 0.06})`; x.lineWidth = 1.2; ell(x, 0, 0, 40 + i * 21 + r() * 6, 40 + i * 21 + r() * 6); x.stroke(); } // throwing rings
    x.strokeStyle = 'rgba(120,90,60,0.12)'; x.lineWidth = 0.8; // crazing
    for (let i = 0; i < 26; i++) { let px = (r() - 0.5) * 400, py = (r() - 0.5) * 400; x.beginPath(); x.moveTo(px, py); for (let q = 0; q < 4; q++) { px += (r() - 0.5) * 60; py += (r() - 0.5) * 60; x.lineTo(px, py); } x.stroke(); }
    x.strokeStyle = 'rgba(110,70,30,0.35)'; x.lineWidth = 10; ell(x, 0, 0, 226, 226); x.stroke(); // well edge dip shade
    x.restore();
    x.strokeStyle = 'rgba(40,16,4,0.6)'; x.lineWidth = 2; ell(x, 0, 0, PL_R - 1, PL_R - 1); x.stroke();
  });
}
function rusticPlate(ctx, x, y, S, ryr, phi, tone) {
  const R = PL_R, cc = Math.sqrt(1 - ryr * ryr), T = 26 * cc;
  ctx.save(); ctx.translate(x, y); ctx.scale(S, S);
  // contact shadow thrown toward the camera (backlight)
  ctx.save(); ctx.translate(0, T + 40 * ryr); ctx.scale(1, ryr);
  ctx.fillStyle = rgr(ctx, 0, 30, R * 0.6, 0, 30, R * 1.25, [[0, tone.shadow], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8); ctx.restore();
  // body wall + unglazed foot
  ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R, T * 0.6, -R * 0.9, T, -R * 0.82, T); ctx.ellipse(0, T, R * 0.82, R * 0.82 * ryr, 0, PI, 0, true); ctx.bezierCurveTo(R * 0.9, T, R, T * 0.6, R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.closePath();
  ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#2a1206'], [0.3, '#5e3016'], [0.55, '#7a4220'], [1, '#1e0c04']]); ctx.fill();
  ctx.strokeStyle = 'rgba(190,140,90,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, T, R * 0.82, R * 0.82 * ryr, 0, PI * 0.12, PI * 0.88); ctx.stroke();
  // glazed top (rotates with the orbit)
  ctx.save(); ctx.scale(1, ryr); ctx.rotate(phi); ctx.drawImage(plateTex(), -345, -345, 690, 690); ctx.restore();
  // speculars: screen-fixed backlight on the far rim, soft sheen in the well, thin lip line toward the camera
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
  ctx.strokeStyle = rgbA(tone.rim, 0.55); ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.95, R * 0.95 * ryr, 0, PI * 1.12, PI * 1.88); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,235,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.965, R * 0.965 * ryr, 0, PI * 1.33, PI * 1.47); ctx.stroke();
  ctx.save(); ctx.scale(1, ryr); ctx.fillStyle = rgr(ctx, -40, -150, 0, -40, -150, 200, [[0, rgbA(tone.rim, 0.28)], [1, rgbA(tone.rim, 0)]]); ctx.fillRect(-260, -360, 520, 420); ctx.restore();
  ctx.strokeStyle = rgbA(tone.rim, 0.22); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, R - 2, R * ryr - 1, 0, PI * 0.1, PI * 0.9); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ================================================================================== the hero crêpe (banhXeo + gloss, rim light, peeking filling)
// crêpe coords (px,py) of the FOLDED crêpe (top layer covers py ∈ [0, CR]) → screen, lifted by z (crêpe units)
function crepeMap(x, y, s, ryr, rot) {
  const c = Math.cos(rot), n = Math.sin(rot), cc = Math.sqrt(1 - ryr * ryr), sh = -CR * 0.42;
  return (px, py, z = 0) => { const Y0 = py + sh; return [x + s * (c * px - n * Y0), y + s * (ryr * (n * px + c * Y0) - z * cc)]; };
}
function topPath(ctx, m, rr = 1, z = 22) {
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) { const a = i / 48 * PI, q = m(Math.cos(a) * CR * rr, Math.sin(a) * CR * rr, z); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
  ctx.closePath();
}
const PEEK = [['s', -150, 150, 2.2, 1.15], ['p', 60, 182, 0.25, 0.85], ['s', 170, 118, 0.9, 1.05], ['p', -60, 186, -0.2, 0.8], ['s', -40, 190, 1.6, 1.0], ['sp', 110, 170, 1.2], ['sp', -110, 172, 1.9], ['sp', 0, 196, 1.5]];
const GLINT = (() => { const r = rng(91), a = []; for (let i = 0; i < 46; i++) { let px, py; do { px = (r() - 0.5) * 2 * CR * 0.92; py = r() * CR * 0.92; } while (px * px + py * py > (CR * 0.9) ** 2); a.push([px, py, r() * TAU, 0.5 + r() * 0.5, 1 + r() * 2.2]); } return a; })();
function heroCrepe(ctx, x, y, s, ryr, rot, t, tone, o = {}) {
  const m = crepeMap(x, y, s, ryr, rot);
  // soft contact shadow on the plate
  ctx.save(); ctx.translate(x, y + 10 * s); ctx.scale(1, ryr); ctx.rotate(rot);
  ctx.fillStyle = rgr(ctx, 0, 0, CR * s * 0.4, 0, 0, CR * s * 1.15, [[0, 'rgba(40,14,2,0.5)'], [1, 'rgba(40,14,2,0)']]); ctx.fillRect(-CR * s * 1.3, -CR * s * 1.3, CR * s * 2.6, CR * s * 2.6); ctx.restore();
  BX.banhXeo(ctx, x, y, s, { ryr, rot, fold: 1, crisp: 1, t, steam: 0, seed: 4, bite: o.bite || 0, biteA: o.biteA });
  // filling peeking out of the curved edge (only outside the top layer)
  ctx.save(); ctx.beginPath(); ctx.rect(-W, -H, W * 3, H * 3); topPath(ctx, m, 0.985, 22); ctx.clip('evenodd');
  for (const [k, px, py, a, sc] of PEEK) {
    const q = m(px, py, 9);
    ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(s, s * Math.max(ryr, 0.55)); ctx.rotate(rot + a);
    if (k === 's') BX.shrimp(ctx, 0, 0, 1.25 * sc, 0, { sear: 1 }); else if (k === 'p') BX.porkSlice(ctx, 0, 0, sc, 0, { sear: 1 }); else BX.sprout(ctx, 0, 0, 1.0, 0, {});
    ctx.restore();
  }
  ctx.restore();
  // gloss on the top layer: a screen-fixed sheen (light from the back-left) the crêpe turns under + oil glints
  const la = o.lightA ?? -2.2; // light direction (screen angle the glints face)
  ctx.save(); topPath(ctx, m, 0.97, 22); ctx.clip();
  const ctr = m(0, CR * 0.45, 22);
  ctx.globalCompositeOperation = 'screen';
  ctx.save(); ctx.translate(ctr[0] - CR * s * 0.28, ctr[1] - CR * s * ryr * 0.35); ctx.scale(1, Math.max(0.3, ryr));
  ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, CR * s * 0.7, [[0, rgbA(tone.rim, 0.55)], [0.45, rgbA(tone.rim, 0.18)], [1, rgbA(tone.rim, 0)]]); ctx.fillRect(-CR * s, -CR * s, CR * s * 2, CR * s * 2); ctx.restore();
  for (const [px, py, g, a0, sz] of GLINT) {
    const b = Math.pow(Math.max(0, Math.cos(g + rot - la)), 10) * a0;
    if (b < 0.05) continue;
    const q = m(px, py, 22);
    ctx.globalAlpha = b; ctx.fillStyle = 'rgba(255,250,225,1)'; ell(ctx, q[0], q[1], sz * s * 2.2, sz * s * 1.1, -0.3); ctx.fill();
    if (b > 0.9 && sz > 2.4) L.sparkle(ctx, q[0], q[1], 9 * s * sz, (b - 0.9) * 5);
  }
  ctx.restore();
  // rim light: bright where the edge faces away from the camera (backlight)
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
  const rimA = o.rim ?? 1, N = 40;
  for (let i = 0; i < N; i++) {
    const a0 = i / N * PI, a1 = (i + 1) / N * PI, p0 = m(Math.cos(a0) * CR * 1.0, Math.sin(a0) * CR * 1.0, 22), p1 = m(Math.cos(a1) * CR * 1.0, Math.sin(a1) * CR * 1.0, 22);
    const nx = p1[1] - p0[1], ny = -(p1[0] - p0[0]), nl = Math.hypot(nx, ny) || 1, up = -ny / nl; // outward normal (path is ccw on screen?) → use |.|
    const k = Math.max(0, Math.abs(up)) * (ny / nl < 0 ? 1 : 0.15);
    if (k < 0.05) continue;
    ctx.lineCap = 'butt'; ctx.strokeStyle = rgbA(tone.rim, 0.5 * k * rimA); ctx.lineWidth = 9 * s; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    ctx.strokeStyle = `rgba(255,248,220,${0.6 * k * rimA})`; ctx.lineWidth = 3 * s; ctx.stroke();
  }
  // broad backlit sheen inside the fold edge (the dome's far side) when the fold faces away from the camera
  const fk = Math.max(0, Math.cos(rot)) * rimA;
  if (fk > 0.02) {
    ctx.save(); topPath(ctx, m, 0.97, 22); ctx.clip();
    const g0 = m(0, 0, 22), g1 = m(0, CR * 0.42, 22);
    ctx.fillStyle = lgr(ctx, g0[0], g0[1], g1[0], g1[1], [[0, rgbA(tone.rim, 0.55 * fk)], [0.35, rgbA(tone.rim, 0.22 * fk)], [1, rgbA(tone.rim, 0)]]);
    ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // fold line catch light
  const f0 = m(-CR * 0.95, 2, 22), f1 = m(CR * 0.95, 2, 22);
  ctx.strokeStyle = rgbA(tone.rim, 0.35 * rimA); ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(f0[0], f0[1]); ctx.lineTo(f1[0], f1[1]); ctx.stroke();
  ctx.restore();
  return m;
}

// ================================================================================== steam / smoke / particles
function steamRise(ctx, t, x, y, o = {}) {
  const n = o.n ?? 18, w = o.w ?? 300, h = o.h ?? 700, r0 = o.r ?? 60, a = o.alpha ?? 0.5, sp = o.speed ?? 0.3, r = rng(o.seed ?? 1), spr = o.spr || PUFF();
  ctx.save(); ctx.globalCompositeOperation = o.mode || 'source-over';
  for (let i = 0; i < n; i++) {
    const ph = r(), s = sp * (0.7 + r() * 0.6), bx = (r() - 0.5) * w, sw = 20 + r() * 50, rr = r0 * (0.6 + r() * 0.8), fq = 0.5 + r() * 0.9;
    const life = ((t * s + ph) % 1 + 1) % 1;
    const yy = y - life * h, xx = x + bx * (1 + life * 0.6) + Math.sin(t * fq + i * 1.7) * sw * life + (o.drift || 0) * life;
    const R = rr * (0.6 + life * 1.3);
    ctx.globalAlpha = Math.min(1, 1.9 * a * clamp(life * 6) * Math.pow(1 - life, 1.4));
    ctx.drawImage(spr, xx - R * 0.75, yy - R * 1.35, 1.5 * R, 2.7 * R);
  }
  ctx.restore();
}
// soft curling steam tendrils (chains of small puffs, no hard lines)
function steamStrands(ctx, t, x, y, o = {}) {
  const n = o.n ?? 6, w = o.w ?? 260, h = o.h ?? 520, r = rng(o.seed ?? 3), a = o.alpha ?? 0.4, lw = o.lw ?? 10, spr = PUFF();
  ctx.save(); ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.2 + r() * 0.12, bx = (r() - 0.5) * w, f = 1 + r() * 1.5;
    const life = ((t * sp + ph) % 1 + 1) % 1, y0 = y - life * h * 0.45, len = h * 0.6;
    for (let k = 0; k <= 30; k++) {
      const u = k / 30, yy = y0 - u * len, xx = x + bx + Math.sin(u * 4.5 * f + t * 1.2 + i) * 30 * (0.3 + u) + Math.sin(u * 10 + t * 1.8 + i * 3) * 8;
      const R = lw * (1.7 + u * 2.8);
      ctx.globalAlpha = Math.min(1, 0.6 * a * clamp(life * 5) * (1 - life) * Math.sin(Math.min(1, u * 1.15) * PI));
      ctx.drawImage(spr, xx - R, yy - R, 2 * R, 2 * R);
    }
  }
  ctx.restore();
}
// crisp golden shard sprites (sharp + soft)
function shardSprites() {
  if (SPR.shards) return SPR.shards;
  const out = [];
  for (let i = 0; i < 6; i++) {
    out.push(sprite('shard' + i, 96, 96, 48, 48, (x) => {
      const r = rng(700 + i); x.translate(48, 48);
      x.beginPath(); const k = 5 + (i % 3);
      for (let j = 0; j < k; j++) { const a = j / k * TAU + r() * 0.5, d = 22 + r() * 18; j ? x.lineTo(Math.cos(a) * d, Math.sin(a) * d * 0.7) : x.moveTo(Math.cos(a) * d, Math.sin(a) * d * 0.7); }
      x.closePath(); x.fillStyle = lgr(x, -30, -30, 30, 30, [[0, '#ffe28a'], [0.45, '#f0a838'], [1, '#a85a18']]); x.fill();
      x.strokeStyle = 'rgba(120,56,12,0.7)'; x.lineWidth = 2; x.stroke();
      x.save(); x.clip(); x.globalCompositeOperation = 'destination-out'; for (let j = 0; j < 4; j++) { ell(x, (r() - 0.5) * 30, (r() - 0.5) * 20, 2 + r() * 4, 1.5 + r() * 3); x.fill(); } x.restore();
      x.fillStyle = 'rgba(255,250,220,0.85)'; ell(x, -8, -9, 9, 3, -0.4); x.fill();
    }, 4));
  }
  SPR.shards = out; return out;
}
// slow-motion shards from (x,y) starting at t0 (screen px, s = size scale)
function shardBurst(ctx, t, t0, x, y, o = {}) {
  const age = t - t0; if (age < 0) return;
  const r = rng(o.seed ?? 5), n = o.n ?? 40, v0 = o.v ?? 160, g = o.g ?? 120, S = shardSprites(), life = o.life ?? 4;
  for (let i = 0; i < n; i++) {
    const a = (o.angle ?? -PI / 2) + (r() - 0.5) * (o.spread ?? 2.6), v = v0 * (0.3 + r()), sz = (o.size ?? 0.5) * (0.4 + r() * 0.9), sp = (r() - 0.5) * (o.spin ?? 2), sh = S[i % S.length], soft = r() < (o.softK ?? 0.25) ? 1 : 0, ph = r() * TAU;
    const tt = Math.max(0, age - r() * (o.stagger ?? 0.1));
    const px = x + (r() - 0.5) * (o.w ?? 60) + Math.cos(a) * v * tt, py = y + Math.sin(a) * v * tt + 0.5 * g * tt * tt;
    const al = 1 - clamp((tt - life * 0.7) / (life * 0.3));
    if (al <= 0) continue;
    const zs = soft ? sz * 2.2 : sz;
    ctx.save(); ctx.globalAlpha = al * (soft ? 0.75 : 1); ctx.translate(px, py); ctx.rotate(ph + sp * tt);
    ctx.drawImage(soft ? sh.soft : sh.c, -48 * zs, -48 * zs, 96 * zs, 96 * zs); ctx.restore();
  }
}
function bokehField(ctx, t, seed, n, cols, alpha, rmin, rmax, dx = 0, dy = 0, y0 = 0, y1 = H) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const x = ((r() * (W + 400) + dx + Math.sin(t * 0.3 + i) * 20) % (W + 400) + W + 400) % (W + 400) - 200, y = y0 + r() * (y1 - y0) + dy + Math.cos(t * 0.25 + i) * 14;
    const rad = rmin + r() * (rmax - rmin), col = cols[Math.floor(r() * cols.length)];
    ctx.globalAlpha = alpha * (0.35 + 0.65 * r()) * (0.85 + 0.15 * Math.sin(t * 1.3 + i));
    ctx.fillStyle = rgr(ctx, x, y, rad * 0.55, x, y, rad, [[0, col], [0.85, col.replace(',1)', ',0.8)')], [1, 'rgba(0,0,0,0)']]);
    ell(ctx, x, y, rad, rad); ctx.fill();
  }
  ctx.restore();
}

// ================================================================================== arms + hands (diner: bare forearm, light skin)
function arm(ctx, hx, hy, ang, s, kind, o = {}) {
  const c = Math.cos(ang), n = Math.sin(ang), px = -n, py = c, sk = o.skin || SKIN, LEN = 2400;
  const P = (d, w) => [hx - c * d * s + px * w * s, hy - n * d * s + py * w * s];
  ctx.save(); ctx.lineJoin = 'round';
  if (o.shadow !== false) { ctx.globalAlpha = 0.22; ctx.strokeStyle = '#1a0804'; ctx.lineCap = 'round'; ctx.lineWidth = 70 * s; ctx.beginPath(); ctx.moveTo(hx - c * LEN + 30 * s, hy - n * LEN + 40 * s); ctx.lineTo(hx + 30 * s, hy + 40 * s); ctx.stroke(); ctx.globalAlpha = 1; }
  const D = LEN / s, side = [[0, 23], [120, 28], [300, 36], [D, 42]];
  ctx.beginPath(); side.forEach(([d, w], i) => { const q = P(d, w); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
  for (let i = side.length - 1; i >= 0; i--) { const q = P(side[i][0], -side[i][1]); ctx.lineTo(q[0], q[1]); }
  ctx.closePath();
  const g0 = P(150, 60), g1 = P(150, -60);
  ctx.fillStyle = lgr(ctx, g0[0], g0[1], g1[0], g1[1], [[0, sk[2]], [0.35, sk[1]], [0.7, sk[0]], [1, sk[1]]]); ctx.fill();
  ctx.strokeStyle = 'rgba(90,40,30,0.35)'; ctx.lineWidth = 2.2 * s; ctx.stroke();
  // rim light along the upper edge
  ctx.strokeStyle = 'rgba(255,220,170,0.55)'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round';
  ctx.beginPath(); let q = P(30, -20); ctx.moveTo(q[0], q[1]); q = P(300, -32); ctx.lineTo(q[0], q[1]); q = P(D, -38); ctx.lineTo(q[0], q[1]); ctx.stroke();
  if (o.sleeve) { // short tee sleeve far up the arm
    const a0 = P(o.sleeveAt || 560, 72), a1 = P(o.sleeveAt || 560, -72), b0 = P(D, 80), b1 = P(D, -80);
    ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(a1[0], a1[1]); ctx.closePath(); ctx.fillStyle = o.sleeve; ctx.fill();
  }
  ctx.restore();
  NP.cHand(ctx, hx, hy, s, ang, { kind, skin: sk, flip: o.flip });
}

// ================================================================================== props drawn in the table plane
function chopsticks(ctx, P, X, Z, a, len = 560) {
  for (let i = 0; i < 2; i++) {
    const ox = i * 22, p0 = P.p(X + ox * Math.sin(a), Z - ox * Math.cos(a), 6), p1 = P.p(X + ox * Math.sin(a) + Math.cos(a) * len, Z - ox * Math.cos(a) + Math.sin(a) * len, 6);
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(30,10,2,0.35)'; ctx.lineWidth = 12 * P.S; ctx.beginPath(); ctx.moveTo(p0[0] + 6 * P.S, p0[1] + 8 * P.S); ctx.lineTo(p1[0] + 6 * P.S, p1[1] + 8 * P.S); ctx.stroke();
    ctx.strokeStyle = '#a77a3e'; ctx.lineWidth = 10 * P.S; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,170,0.6)'; ctx.lineWidth = 3 * P.S; ctx.stroke();
    ctx.restore();
  }
}
function looseHerb(ctx, P, X, Z, a, kind, sc) {
  const q = P.p(X, Z, 2);
  ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(P.S, P.S * P.ryr); ctx.rotate(P.phi + a);
  BX.herbLeaf(ctx, 0, 0, sc, 0, kind, { ph: X * 0.01 + Z });
  ctx.restore();
}
function chiliSaucer(ctx, P, X, Z, sc) { // tiny saucer of sliced red chili + lime wedge
  const q = P.p(X, Z, 0), s = P.S * sc, ry = P.ryr;
  ctx.save(); ctx.translate(q[0], q[1]);
  ctx.fillStyle = 'rgba(30,10,2,0.35)'; ell(ctx, 6 * s, 14 * s, 96 * s, 96 * s * ry + 6 * s); ctx.fill();
  ell(ctx, 0, 0, 92 * s, 92 * s * ry); ctx.fillStyle = '#4a2a14'; ctx.fill();
  ell(ctx, 0, -3 * s, 84 * s, 84 * s * ry); ctx.fillStyle = rgr(ctx, -20 * s, -20 * s, 0, 0, 0, 84 * s, [[0, '#efe2c4'], [1, '#c9ae80']]); ctx.fill();
  const r = rng(44);
  ctx.save(); ctx.scale(1, ry); ctx.rotate(P.phi);
  for (let i = 0; i < 12; i++) { const a = r() * TAU, d = r() * 50 * s; ctx.save(); ctx.translate(Math.cos(a) * d - 10 * s, Math.sin(a) * d); ctx.rotate(r() * TAU);
    ell(ctx, 0, 0, 11 * s, 9 * s); ctx.fillStyle = '#c8241a'; ctx.fill(); ell(ctx, 0, 0, 6 * s, 5 * s); ctx.fillStyle = '#f0c060'; ctx.fill(); ctx.restore(); }
  // lime wedge
  ctx.translate(36 * s, 10 * s); ctx.rotate(0.6);
  ctx.beginPath(); ctx.arc(0, 0, 34 * s, PI, TAU); ctx.closePath(); ctx.fillStyle = '#5aa030'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 28 * s, PI, TAU); ctx.closePath(); ctx.fillStyle = '#d8ec90'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,230,0.8)'; ctx.lineWidth = 2 * s; for (let i = 1; i < 6; i++) { const a = PI + i / 6 * PI; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 26 * s, Math.sin(a) * 26 * s); ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
const basketSpr = () => sprite('basket', 760, 640, 380, 345, (x) => BX.herbBasket(x, 380, 345, 1, { ryr: 0.45, fill: 1, seed: 2 }), 7);
const bowlSpr = () => sprite('bowl', 320, 240, 160, 110, (x) => BX.fishSauceBowl(x, 160, 110, 1, { ryr: 0.45, fill: 0.9, chili: 1, garlic: 1, t: 0.4, seed: 5 }), 5);
const fgLeafSpr = () => sprite('fgleaf', 700, 500, 350, 380, (x) => {
  BX.herbLeaf(x, 300, 420, 1.5, -0.5, 'mustard', { ph: 1 }); BX.herbLeaf(x, 420, 440, 1.3, 0.35, 'lettuce', { ph: 2 }); BX.herbLeaf(x, 360, 450, 2.4, -0.1, 'hung', { ph: 3 });
}, 14);

// The golden table set (shared by s10–s13, s16): world objects around the plate at (0,0).
const SET = [
  { k: 'basket', X: -610, Z: -400, s: 1.0 },
  { k: 'bowl', X: 560, Z: 110, s: 1.25 },
  { k: 'saucer', X: 330, Z: -470, s: 0.9 },
  { k: 'sticks', X: -560, Z: 200, a: -0.35 },
  { k: 'herb', X: 250, Z: -260, a: 0.4, kind: 'lacach', sc: 1.6 }, { k: 'herb', X: 300, Z: -230, a: -0.9, kind: 'hung', sc: 1.6 },
  { k: 'herb', X: -380, Z: 330, a: 2.2, kind: 'diepca', sc: 1.6 }, { k: 'herb', X: -300, Z: -300, a: 1.2, kind: 'lacach', sc: 1.4 },
];
// draws flat objects first, then upright ones sorted by depth; mid(...) = the plate+crêpe (depth 0)
function drawSet(ctx, P, t, focusDepth, mid, o = {}) {
  for (const it of SET) {
    if (it.k === 'sticks') chopsticks(ctx, P, it.X, it.Z, it.a + 0 * P.phi);
    else if (it.k === 'herb') looseHerb(ctx, P, it.X, it.Z, it.a, it.kind, it.sc);
  }
  const ups = SET.filter(it => it.k === 'basket' || it.k === 'bowl' || it.k === 'saucer').map(it => ({ it, d: P.depth(it.X, it.Z) }));
  ups.push({ it: null, d: 0 });
  ups.sort((a, b) => a.d - b.d);
  for (const { it, d } of ups) {
    if (!it) { mid(); continue; }
    if (o.skip && o.skip(it)) continue;
    const q = P.p(it.X, it.Z), pf = 1 + d * 0.00035, soft = clamp(Math.abs(d - focusDepth) / 520) * (o.dof ?? 1);
    if (it.k === 'basket') drawSprite(ctx, basketSpr(), q[0], q[1], P.S * it.s * pf, soft);
    else if (it.k === 'bowl') drawSprite(ctx, bowlSpr(), q[0], q[1], P.S * it.s * pf, soft);
    else chiliSaucer(ctx, P, it.X, it.Z, it.s * pf);
  }
}

// =================================================================================================== S10 17.5–21.667
// Hero: match cut pan → plate (centre 540,1060, R 330) · widen to the golden table · push in + 180° orbit.
function s10(ctx, lt, p, T) {
  const tone = GOLD;
  const wide = ease.inOut(iv(0.25, 1.55, lt)), orb = ease.inOut(iv(0.3, 4.167, lt)), push = ease.inOut(iv(1.4, 4.167, lt));
  const S = lerp(lerp(1.0, 0.74, wide), 1.6, push);
  const ryr = lerp(lerp(0.93, 0.5, wide), 0.37, push);
  const phi = -1.9 + orb * PI;
  const ox = lerp(lerp(540, 560, wide), 540, push), oy = lerp(lerp(1060, 1220, wide), 1250, push);
  const hz = lerp(lerp(-120, 640, ease.out(wide)), 820, push);
  const P = plane(ox, oy, S, ryr, phi);
  // background: golden riverside bokeh, parallax with the orbit
  const sun = drawBg(ctx, 'gold', 640 + phi * 70, 820, lerp(1.25, 1.55, push), lerp(560, 600, wide) - phi * 40, hz - 150);
  L.glow(ctx, sun[0], sun[1], 520, 'rgba(255,200,120,1)', 0.45);
  bokehField(ctx, T, 61, 14, tone.bokeh, 0.3, 30, 95, -phi * 260, 0, 0, hz);
  drawTable(ctx, P, hz, tone, sun);
  const drop = (1 - ease.out(iv(0, 0.22, lt))) * 30 + Math.sin(iv(0.22, 0.42, lt) * PI) * 4;
  const cs = S * 1.45, cp = P.p(0, 0);
  drawSet(ctx, P, T, 0, () => {
    rusticPlate(ctx, cp[0], cp[1], S, ryr, phi + 0.6, tone);
    heroCrepe(ctx, cp[0], cp[1] - 8 * S - drop * S, cs, ryr, phi, T, tone, { lightA: -2.0 });
  });
  // heavy steam backlit by the sun (stronger right after the plate lands)
  const top = [cp[0], cp[1] - 60 * S];
  const burst = 1 + 0.8 * (1 - iv(0, 1.2, lt));
  steamRise(ctx, T, top[0], top[1], { n: 30, w: 240 * cs, h: 560 * cs, r: 90 * cs, alpha: 0.42 * burst, speed: 0.26, seed: 7 });
  steamStrands(ctx, T, top[0], top[1], { n: 9, w: 280 * cs, h: 640 * cs, alpha: 1.0, lw: 10 * cs, seed: 9 });
  L.godRays(ctx, sun[0], sun[1], PI / 2 - 0.15, 1.1, 1500, 9, 'rgba(255,214,150,0.9)', 0.1, T);
  L.dust(ctx, T, 5, 26, 0, 300, W, 1100, '255,226,170', 2.4, 0.55);
  // out-of-focus foreground herbs sweeping by during the orbit
  // final glint on the shell
  if (lt > 3.4) L.sparkle(ctx, cp[0] - 120 * cs, cp[1] - 70 * cs, 70, 0.8 * Math.sin(iv(3.4, 4.1, lt) * PI));
}

// =================================================================================================== S11 21.667–25.0
// Two hands break the crêpe; the crust cracks at 22.5 → extreme slow-motion macro on the prawn + pork belly.
const CRACK = 22.5;
const JAG = (() => { const r = rng(55), a = []; for (let i = 0; i <= 12; i++) a.push([Math.sin(i * 1.9) * 9 + (r() - 0.5) * 10, -0.15 * CR + i / 12 * 1.27 * CR]); return a; })();
function s11(ctx, lt, p, T) {
  const tone = GOLD;
  if (T < CRACK) {
    // ---- medium close: hands take hold of both tips, tension builds
    const u = iv(21.667, CRACK, T), e = ease.inOut(u);
    const S = lerp(1.2, 1.36, e), ryr = 0.38, phi = 0.12;
    const P = plane(540, 1190, S, ryr, phi), cp = P.p(0, 0), cs = S * 1.45;
    const sun = drawBg(ctx, 'gold', 700, 820, 1.6, 520, 520);
    L.glow(ctx, sun[0], sun[1], 520, 'rgba(255,200,120,1)', 0.4);
    bokehField(ctx, T, 71, 12, tone.bokeh, 0.3, 40, 110, 0, 0, 0, 760);
    drawTable(ctx, P, 700, tone, sun);
    const pull = ease.in2(iv(0.55, 1, u));
    drawSet(ctx, P, T, 0, () => {
      rusticPlate(ctx, cp[0], cp[1], S, ryr, phi + 0.6, tone);
      heroCrepe(ctx, cp[0], cp[1] - 8 * S - pull * 10, cs, ryr, phi, T, tone);
    }, { dof: 1.4 });
    const m = crepeMap(cp[0], cp[1] - 8 * S - pull * 10, cs, ryr, phi);
    steamRise(ctx, T, cp[0], cp[1] - 60 * S, { n: 24, w: 240 * cs, h: 560 * cs, r: 85 * cs, alpha: 0.4, seed: 12 });
    // hairline crack right before the break
    if (u > 0.8) {
      ctx.save(); ctx.strokeStyle = `rgba(90,40,8,${iv(0.8, 1, u)})`; ctx.lineWidth = 3; ctx.beginPath();
      JAG.forEach(([jx, jy], i) => { if (jy < 0) return; const q = m(jx * 0.5, jy, 22); ctx.lineTo(q[0], q[1]); }); ctx.stroke(); ctx.restore();
    }
    // hands: approach from the lower corners, grip both tips, pull outward
    const app = ease.out(iv(0, 0.5, u));
    const tl = m(-CR * 0.9, CR * 0.35, 22), tr = m(CR * 0.9, CR * 0.35, 22);
    arm(ctx, tl[0] - 70 - 380 * (1 - app) - pull * 14, tl[1] + 30 + 420 * (1 - app), -0.55, 1.45, app > 0.85 ? 'grip' : 'open', { flip: true });
    arm(ctx, tr[0] + 70 + 380 * (1 - app) + pull * 14, tr[1] + 30 + 420 * (1 - app), PI + 0.55, 1.45, app > 0.85 ? 'grip' : 'open', {});
    L.dust(ctx, T, 15, 22, 0, 300, W, 1000, '255,226,170', 2.4, 0.5);
    return;
  }
  // ---- macro, slow motion: halves drift apart, shards float, steam blooms, filling revealed
  const k = T - CRACK, u = iv(CRACK, 25.0, T);
  const sep = ease.outExpo(clamp(k / 2.4)) * 0.8 + 0.2 * ease.inOut(u);
  const S = lerp(1.55, 2.05, ease.inOut(u)), ryr = 0.56, phi = 0;
  const cs = S * 1.45, m0 = crepeMap(0, 0, cs, ryr, phi), f0 = m0(lerp(0, 40, ease.inOut(u)), CR * 0.5, 11);
  const cx = 540 - f0[0], cy = 1180 - f0[1];
  const P = plane(cx, cy + 8 * S, S, ryr, phi);
  const sun = drawBg(ctx, 'gold', 640, 780, 2.0, 600 - u * 30, 300);
  L.glow(ctx, sun[0], sun[1], 700, 'rgba(255,196,110,1)', 0.45);
  bokehField(ctx, T, 81, 10, tone.bokeh, 0.35, 70, 170, -u * 60, 0, 0, 560);
  drawTable(ctx, P, 520, tone, sun);
  rusticPlate(ctx, P.cx, P.cy, S, ryr, 0.6, tone);
  const m = crepeMap(cx, cy, cs, ryr, phi);
  const gap = sep * 62 * cs, lift = sep * 22 * cs, tilt = sep * 0.07;
  // mung beans + a few sprouts spilled on the plate in the gap
  const g0 = m(0, CR * 0.55, 0);
  BX.mungBeans(ctx, g0[0], g0[1] + 20, cs * 0.9, { n: Math.round(4 + 10 * sep), seed: 12, spread: 40, sq: ryr });
  const jagPts = JAG.map(([jx, jy]) => m(jx, jy, 11));
  const halfClip = (side) => { ctx.beginPath(); ctx.moveTo(jagPts[0][0], -400); for (const q of jagPts) ctx.lineTo(q[0], q[1]); ctx.lineTo(jagPts[jagPts.length - 1][0], H + 400); ctx.lineTo(side < 0 ? -W : W * 2, H + 400); ctx.lineTo(side < 0 ? -W : W * 2, -400); ctx.closePath(); };
  const pivot = m(0, CR * 0.2, 11);
  const inHalf = (side, fn) => { ctx.save(); ctx.translate(pivot[0] + side * gap, pivot[1] - lift); ctx.rotate(side * tilt); ctx.translate(-pivot[0], -pivot[1]); fn(); ctx.restore(); };
  const sect = JAG.filter(([jx, jy]) => jy >= 0 && jy <= CR * 0.99);
  const half = (side) => inHalf(side, () => {
    ctx.save(); halfClip(side); ctx.clip();
    heroCrepe(ctx, cx, cy, cs, ryr, phi, T, tone, { lightA: -1.6 });
    ctx.restore();
    // broken cross-section along the jag: bottom crisp layer, filling band, top crisp layer
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const a = sect.map(([jx, jy]) => m(jx, jy, 0)), b = sect.map(([jx, jy]) => m(jx, jy, 24));
    ctx.beginPath(); a.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(b[i][0], b[i][1]); ctx.closePath();
    ctx.save(); ctx.clip(); ctx.fillStyle = lgr(ctx, 0, b[0][1], 0, a[0][1], [[0, '#c27428'], [0.3, '#f0dcb0'], [0.7, '#e8cf98'], [1, '#a85c1c']]); ctx.fillRect(0, 0, W, H);
    const r = rng(side > 0 ? 3 : 4);
    for (let i = 0; i < 26; i++) { const j = Math.floor(r() * (a.length - 1)), f = r(), z = 0.3 + r() * 0.4; const px = lerp(lerp(a[j][0], a[j + 1][0], f), lerp(b[j][0], b[j + 1][0], f), z), py = lerp(lerp(a[j][1], a[j + 1][1], f), lerp(b[j][1], b[j + 1][1], f), z); ctx.fillStyle = ['#fbf6e4', '#f6cf3a', '#f6efd8', '#e8a060'][i % 4]; ell(ctx, px, py, 3 + r() * 6, 2 + r() * 3, r() * PI); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = '#e09a34'; ctx.lineWidth = 8; ctx.beginPath(); b.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,170,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = '#b8661c'; ctx.lineWidth = 6; ctx.beginPath(); a.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
    // crumb nubs on the broken top edge
    const rr = rng(side + 9); ctx.fillStyle = '#e9a23a'; for (let i = 0; i < 16; i++) { const j = Math.floor(rr() * (b.length - 1)), f = rr(); ell(ctx, lerp(b[j][0], b[j + 1][0], f) + (rr() - 0.5) * 10, lerp(b[j][1], b[j + 1][1], f) - rr() * 6, 3 + rr() * 5, 2 + rr() * 3, rr() * PI); ctx.fill(); }
    ctx.restore();
  });
  // filling sticking out of each cut face into the gap (clipped to the gap side, so it emerges from between the layers)
  const emerge = (side, fn) => inHalf(side, () => { ctx.save(); halfClip(-side); ctx.clip(); fn(); ctx.restore(); });
  const sprout = (side, jy, a0, sc) => emerge(side, () => { const q = m(JAG[Math.round((jy / CR + 0.15) / 1.27 * 12)][0] - side * 6, jy, 12); ctx.save(); ctx.translate(q[0], q[1]); ctx.scale(cs, cs * 0.8); BX.sprout(ctx, 0, 0, sc, a0, {}); ctx.restore(); });
  half(-1);
  sprout(-1, CR * 0.78, 1.2, 1.4); sprout(-1, CR * 0.6, 1.9, 1.3);
  emerge(-1, () => { const q = m(JAG[6][0] + 16, CR * 0.5, 12); ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(0.55); ctx.scale(cs, cs * 0.8); BX.porkSlice(ctx, 0, 0, 1.0, 0, { sear: 1 }); ctx.restore(); });
  half(1);
  sprout(1, CR * 0.86, -1.3, 1.4); sprout(1, CR * 0.3, -1.9, 1.2);
  emerge(1, () => { const q = m(JAG[8][0] - 22, CR * 0.6, 12); ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(0.1); ctx.scale(cs, cs * 0.85); BX.shrimp(ctx, 0, 0, 2.1, -0.25, { sear: 1 }); ctx.restore(); });
  // a few mung beans + crumbs dropped into the gap
  const gb = m(0, CR * 0.7, 0); BX.mungBeans(ctx, gb[0], gb[1] + 10, cs * 0.8, { n: Math.round(3 + 6 * sep), seed: 5, spread: 30, sq: 0.6 });
  // sharp-focus glints on the prawn shell + pork fat
  const pr = m(JAG[8][0] - 40, CR * 0.5, 30);
  L.sparkle(ctx, pr[0] - gap * 0.2, pr[1] - lift - 10, 54, 0.5 + 0.3 * Math.sin(T * 2.4));
  // steam blooming slowly out of the gap, backlit
  const sk = ease.out(clamp(k / 1.2)), mid = m(0, CR * 0.45, 20);
  steamRise(ctx, T * 0.5, mid[0], mid[1] - lift, { n: 40, w: 140 + gap * 1.4, h: 1000, r: 80, alpha: 0.75 * sk, speed: 0.32, seed: 21 });
  steamStrands(ctx, T * 0.5, mid[0], mid[1] - lift, { n: 7, w: 140 + gap, h: 1000, alpha: 1.0 * sk, lw: 22, seed: 23 });
  // crisp shards in extreme slow motion (a few big + soft in front of the lens)
  const cr = m(0, CR * 0.95, 22);
  shardBurst(ctx, T, CRACK, cr[0], cr[1] - lift, { n: 44, v: 170, g: 90, size: 0.34, spread: 2.4, w: 80, softK: 0.12, seed: 7, life: 6, spin: 1.2 });
  shardBurst(ctx, T, CRACK, mid[0], mid[1] - lift, { n: 26, v: 130, g: 60, size: 0.26, spread: 2.8, w: 60, softK: 0, seed: 8, life: 6, spin: 1.5 });
  L.dust(ctx, T * 0.4, 25, 26, 0, 400, W, 1100, '255,226,170', 2.6, 0.5);
}

// =================================================================================================== S12 25.0–28.333
// POV: herbs → crêpe piece → cucumber on a mustard leaf, then both hands roll it up.
const S12 = { x: 520, y: 1180, s: 2.05, rot: -0.12 };
function cucumberStick(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-70, -13, 140, 26, 8); ctx.fillStyle = lgr(ctx, 0, -13, 0, 13, [[0, '#1f5a18'], [0.28, '#4a8a2a'], [0.34, '#e6f4bc'], [0.8, '#cfe6a0'], [1, '#a8cc78']]); ctx.fill();
  ctx.fillStyle = 'rgba(230,240,190,0.9)'; for (let i = 0; i < 6; i++) { ell(ctx, -50 + i * 20, 4, 4, 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(30,60,20,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-60, -7, 110, 2.5);
  ctx.restore();
}
function s12(ctx, lt, p, T) {
  const tone = GOLD, e = ease.inOut(p);
  const S = lerp(1.0, 1.1, e), ryr = 0.74, phi = 0.12 - 0.05 * e;
  const P = plane(540 - 20 * e, 1180 + 10 * e, S, ryr, phi);
  // table only (overhead): no horizon in frame
  woodPlane(ctx, P);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, 760, 300, 0, 760, 300, 1300, [[0, 'rgba(255,190,110,0.45)'], [1, 'rgba(255,190,110,0)']]); ctx.fillRect(0, 0, W, H); ctx.restore();
  // dappled palm-leaf shade drifting slowly over the table
  ctx.save(); const dr = rng(19);
  for (let i = 0; i < 9; i++) { const dx = dr() * W, dy = dr() * H, rx = 120 + dr() * 220, ry = 40 + dr() * 70, a = dr() * PI, sw = Math.sin(T * 0.6 + i) * 18;
    ctx.save(); ctx.translate(dx + sw, dy); ctx.rotate(a); ctx.scale(1, ry / rx); ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, rx, [[0, 'rgba(30,10,0,0.28)'], [1, 'rgba(30,10,0,0)']]); ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx); ctx.restore(); }
  ctx.fillStyle = lgr(ctx, 0, 0, 0, H, [[0, 'rgba(0,0,0,0)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(20,6,0,0.45)']]); ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // plate with the broken crêpe (top right), basket (top left), sauce bowl (bottom right)
  const pq = P.p(-230, -720);
  rusticPlate(ctx, pq[0], pq[1], S * 0.85, ryr, 0.6, tone);
  heroCrepe(ctx, pq[0] - 30, pq[1] - 10, S * 0.85 * 1.45, ryr, phi + 0.5, T, tone, { bite: 0.75, biteA: 2.4 });
  const bq = P.p(560, -260); BX.herbBasket(ctx, bq[0], bq[1], S * 1.0, { ryr: 0.72, fill: 0.85, seed: 6 });
  const wq = P.p(-440, 470); BX.fishSauceBowl(ctx, wq[0], wq[1], S * 1.3, { ryr: 0.72, fill: 0.9, chili: 1, garlic: 1, t: T, seed: 11 });
  steamRise(ctx, T, pq[0] - 30, pq[1] - 40, { n: 16, w: 220, h: 420, r: 46, alpha: 0.45, seed: 31 });
  // ---- the wrap
  const { x, y, s, rot } = S12;
  let k;
  if (lt < 0.9) k = lerp(0.12, 0.35, ease.inOut(iv(0.1, 0.9, lt)));
  else if (lt < 1.6) k = lerp(0.35, 0.55, ease.inOut(iv(1.2, 1.55, lt)));
  else k = lerp(0.55, 1, ease.inOut(iv(2.1, 3.2, lt)));
  const LW = 240, LH = 300, uR = ease.inOut(clamp((k - 0.55) / 0.45)), xr = lerp(-LW / 2, 0, uR), rr = lerp(14, 46, Math.sqrt(uR));
  const cr = Math.cos(rot), sr = Math.sin(rot), LP = (lx, ly) => [x + s * (cr * lx - sr * ly), y + s * (sr * lx + cr * ly)];
  ctx.save(); ctx.fillStyle = 'rgba(30,10,2,0.3)'; ctx.translate(x + 14, y + 22); ctx.rotate(rot); ell(ctx, 0, 0, s * lerp(130, 60, uR), s * 160); ctx.fill(); ctx.restore();
  // cucumber sticks lie on the leaf before the roll swallows them (clip to the still-flat part)
  const cucK = ease.out(iv(1.75, 2.05, lt));
  const drawCuc = () => {
    if (cucK <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.beginPath(); ctx.rect(xr + rr * 0.6, -LH, LW * 2, LH * 2); ctx.clip();
    const sxL = Math.max(0.02, (lerp(LW / 2, xr + rr, uR) - (xr - rr * 0.7)) / LW), xL = xr - rr * 0.7;
    cucumberStick(ctx, xL + LW * 0.62 * sxL, 10 - (1 - cucK) * 60, 0.9, 1.45);
    cucumberStick(ctx, xL + LW * 0.5 * sxL, 20 - (1 - cucK) * 80, 0.85, 1.62);
    ctx.restore();
  };
  if (uR < 0.02) { BX.leafWrap(ctx, x, y, s, { k, rot, seed: 3 }); drawCuc(); }
  else { drawCuc(); BX.leafWrap(ctx, x, y, s, { k, rot, seed: 3 }); }
  // water droplets on the leaf (fresh herbs)
  if (uR < 0.5) { const r = rng(8); ctx.save(); for (let i = 0; i < 9; i++) { const q = LP((r() - 0.3) * LW * 0.8 * (1 - uR), (r() - 0.5) * LH * 0.8); ell(ctx, q[0], q[1], 5 + r() * 4, 4 + r() * 3); ctx.fillStyle = 'rgba(220,250,210,0.35)'; ctx.fill(); ell(ctx, q[0] - 2, q[1] - 2, 1.8, 1.4); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); } ctx.restore(); }
  // ---- hands (POV: forearms enter from the bottom). Positions are FINGERTIPS; wrist = tip - dir·88·hs
  const HS = 2.0, hand = (fx, fy, ang, kind, o2) => arm(ctx, fx - Math.cos(ang) * 88 * HS, fy - Math.sin(ang) * 88 * HS, ang, HS, kind, o2 || {});
  const leafCorner = LP(-LW * 0.3, LH * 0.36);
  const holdOut = ease.in2(iv(2.0, 2.25, lt));
  if (lt < 2.25) hand(leafCorner[0] - 300 * holdOut, leafCorner[1] + 500 * holdOut, -1.15, 'flat', { flip: true });
  if (lt < 2.1) {
    let fx, fy, kind = 'pinch', carry = null, ang = -2.0;
    if (lt < 0.9) { // two pinches of herbs from the basket (right)
      const i = lt < 0.45 ? 0 : 1, u = iv(i * 0.45, i * 0.45 + 0.45, lt), e2 = ease.inOut(u), from = [bq[0] - 40, bq[1] + 10], to = LP(-30 + i * 70, -50 + i * 80);
      fx = lerp(from[0], to[0], e2); fy = lerp(from[1], to[1], e2) - Math.sin(u * PI) * 70; carry = u < 0.85 ? 'herb' : null; kind = u < 0.85 ? 'pinch' : 'open';
    } else if (lt < 1.6) { // a crêpe piece from the plate (top)
      const u = iv(0.9, 1.4, lt), e2 = ease.inOut(u), from = [pq[0] + 40, pq[1] + 60], to = LP(0, -40);
      fx = lerp(from[0], to[0], e2); fy = lerp(from[1], to[1], e2) - Math.sin(u * PI) * 90; carry = lt < 1.35 ? 'crepe' : null; kind = carry ? 'pinch' : 'open'; ang = -1.85;
    } else { // cucumber sticks
      const u = iv(1.5, 1.85, lt), e2 = ease.inOut(u), from = [980, 1750], to = LP(40, 10);
      fx = lerp(from[0], to[0], e2); fy = lerp(from[1], to[1], e2); carry = lt < 1.78 ? 'cuc' : null; kind = carry ? 'pinch' : 'open';
      const out = ease.in2(iv(1.85, 2.1, lt)); fx += out * 400; fy += out * 600;
    }
    if (carry === 'herb') { BX.herbLeaf(ctx, fx + 6, fy + 10, 1.9, -0.6 + Math.sin(T * 5) * 0.08, 'lacach', { ph: 2 }); BX.herbLeaf(ctx, fx + 4, fy + 14, 1.8, 0.3, 'hung', { ph: 3 }); }
    if (carry === 'crepe') BX.banhXeo(ctx, fx + 10, fy + 40, 0.42, { ryr: 0.62, rot: 0.4, fold: 1, crisp: 1, seed: 8, sprouts: 0.6 });
    if (carry === 'cuc') { cucumberStick(ctx, fx, fy + 4, 2.2, 1.35); cucumberStick(ctx, fx + 14, fy + 10, 2.1, 1.55); }
    hand(fx, fy, ang, kind, {});
  }
  if (lt > 1.95) { // rolling: left fingers push the roll, right hand pins the far edge of the leaf
    const ru = ease.out(iv(1.95, 2.3, lt)) * (1 - ease.in2(iv(3.1, 3.33, lt)));
    const c0 = LP(xr - rr * 0.9, LH * 0.05), wob = Math.sin(T * 9) * 4;
    hand(c0[0] - 400 * (1 - ru), c0[1] + 500 * (1 - ru) + wob, -0.75, 'flat', { flip: true });
    const edge = LP(lerp(LW * 0.42, xr + rr + 20, uR), -LH * 0.05);
    hand(edge[0] + 400 * (1 - ru), edge[1] + 600 * (1 - ru), -2.25, 'flat', {});
  }
  L.dust(ctx, T, 33, 20, 0, 600, W, 1200, '255,226,170', 2.2, 0.45);
}

// =================================================================================================== S13 28.333–30.0
// Macro dip into the garlic-chili fish sauce at 29.0; a glossy drip falls back from the tip.
const DIP = 29.0;
function macroBg() {
  return cached('macroBg', W, H, (x) => {
    const src = createCanvas(W, H), sx = src.getContext('2d');
    const P = plane(560, 1260, 1.25, 0.42, 0.9);
    drawBg(sx, 'gold', 640, 820, 1.5, 520, 380);
    drawTable(sx, P, 560, GOLD, [520, 380]);
    drawSet(sx, P, 0, 0, () => { const q = P.p(0, 0); rusticPlate(sx, q[0], q[1], 1.25, 0.42, 0.6, GOLD); heroCrepe(sx, q[0], q[1] - 10, 1.8, 0.42, 1.4, 0, GOLD, { bite: 0.7 }); }, { skip: (it) => it.k === 'bowl' });
    x.drawImage(blurOf(src, 22), 0, 0);
  });
}
function s13(ctx, lt, p, T) {
  const tone = GOLD;
  const z = lerp(1.0, 1.12, ease.inOut(p));
  const bX = 540, bY = 1300, bS = 4.0, ryr = 0.4;
  const bz = lerp(1.08, 1.16, p); ctx.drawImage(macroBg(), (W - W * bz) / 2 - 20 * p, (H - H * bz) / 2, W * bz, H * bz);
  bokehField(ctx, T, 91, 12, tone.bokeh, 0.35, 50, 140, -p * 40, 0, 0, 1000);
  L.cam(ctx, 540, 1150, z, 0, () => {
    const bw = BX.fishSauceBowl(ctx, bX, bY, bS, { ryr, fill: 0.92, chili: 1, garlic: 1, t: T, seed: 11 });
    const E = [bX + 30, bw.surface[1] + 6];
    // wrap path: down the axis into the sauce, dunk, lift
    const a = 2.0, dir = [Math.cos(a), Math.sin(a)], rot = a + PI / 2, ws = 2.3, half = 150 * ws;
    let d;
    if (T < DIP) d = lerp(-560, 0, ease.out(iv(28.333, DIP, T)));
    else if (T < 29.3) d = lerp(0, 70, ease.out(iv(DIP, 29.3, T)));
    else d = lerp(70, -330, ease.inOut(iv(29.3, 29.95, T)));
    const tip = [E[0] + dir[0] * d, E[1] + dir[1] * d], ctr = [tip[0] - dir[0] * half, tip[1] - dir[1] * half];
    const dip = iv(DIP, DIP + 0.1, T), perp = [-dir[1], dir[0]];
    // submerged part: faint through the amber sauce; the rest normal
    const halfPlane = (sign) => { ctx.beginPath(); const A = [E[0] + perp[0] * 3000, E[1] + perp[1] * 3000], B = [E[0] - perp[0] * 3000, E[1] - perp[1] * 3000]; ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(B[0] + sign * dir[0] * 4000, B[1] + sign * dir[1] * 4000); ctx.lineTo(A[0] + sign * dir[0] * 4000, A[1] + sign * dir[1] * 4000); ctx.closePath(); };
    if (d > 0) { ctx.save(); halfPlane(1); ctx.clip(); ctx.globalAlpha = 0.3; BX.leafWrap(ctx, ctr[0], ctr[1], ws, { k: 1, rot, dip: 1, t: T, seed: 3 }); ctx.restore(); }
    ctx.save(); if (d > 0) { halfPlane(-1); ctx.clip(); }
    BX.leafWrap(ctx, ctr[0], ctr[1], ws, { k: 1, rot, dip, t: T, seed: 3 });
    ctx.restore();
    // glossy sauce coat on the tip after the dip
    if (dip > 0 && d < 60) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,240,200,0.8)'; ell(ctx, tip[0] - perp[0] * 22 * ws - dir[0] * 30, tip[1] - perp[1] * 22 * ws - dir[1] * 30, 5 * ws, 16 * ws, a); ctx.fill(); ctx.restore();
      // chili + garlic bits clinging
      const r = rng(9); for (let i = 0; i < 5; i++) { const o2 = (r() - 0.5) * 70 * ws, b = -10 - r() * 50 * ws; const q = [tip[0] + perp[0] * o2 - dir[0] * -b * 0 + dir[0] * b * 0.3, tip[1] + perp[1] * o2 + dir[1] * b * 0.3]; ctx.fillStyle = i % 2 ? '#d42a1c' : '#f6eed6'; ell(ctx, q[0], q[1], 7, 5, r() * 3); ctx.fill(); }
    }
    // meniscus + ripples
    if (T >= DIP - 0.02) {
      for (let i = 0; i < 3; i++) {
        const u = (T - DIP - i * 0.18) / 0.9; if (u < 0 || u > 1) continue;
        ctx.save(); ctx.strokeStyle = `rgba(255,232,180,${0.7 * (1 - u)})`; ctx.lineWidth = 4 * (1 - u) + 1.5;
        ell(ctx, E[0], E[1], 50 + u * 230, (50 + u * 230) * ryr); ctx.stroke(); ctx.restore();
      }
      if (d > 0) { ctx.save(); ctx.strokeStyle = 'rgba(255,236,190,0.75)'; ctx.lineWidth = 4; ell(ctx, E[0], E[1], 64 * ws * 0.5 + 8, (64 * ws * 0.5 + 8) * ryr * 1.3); ctx.stroke(); ctx.restore(); }
      // splash droplets (the "tõm")
      const su = (T - DIP) / 0.45;
      if (su > 0 && su < 1) { const r = rng(61); for (let i = 0; i < 14; i++) { const an = -PI * (0.15 + r() * 0.7), v = 260 + r() * 380, tt = su * 0.45; const x = E[0] + Math.cos(an) * v * tt, y = E[1] + Math.sin(an) * v * tt + 1400 * tt * tt; ctx.fillStyle = `rgba(214,128,40,${0.95 * (1 - su)})`; ell(ctx, x, y, 7, 9); ctx.fill(); ctx.fillStyle = `rgba(255,240,200,${0.9 * (1 - su)})`; ell(ctx, x - 2, y - 3, 2, 3); ctx.fill(); } }
    }
    // sauce strand while lifting, then a glossy drop forms at the tip, lets go (~29.6) and falls back
    if (T > 29.3 && d < 0) {
      const sk = 1 - iv(29.35, 29.6, T);
      if (sk > 0) { ctx.save(); ctx.strokeStyle = `rgba(214,124,36,${0.85 * sk})`; ctx.lineCap = 'round'; ctx.lineWidth = 9 * sk + 1; ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.quadraticCurveTo(lerp(tip[0], E[0], 0.5) + 6, lerp(tip[1], E[1], 0.5), E[0], E[1]); ctx.stroke(); ctx.restore(); }
    }
    const tDrop = 29.62;
    if (T > 29.35) {
      const grow = iv(29.35, tDrop, T), fall = T > tDrop ? T - tDrop : 0;
      const dx = tip[0] + dir[0] * 6, dy = tip[1] + dir[1] * 6;
      let x = dx, y = dy + 18 * grow + 900 * fall * fall, rx = 8 + 6 * grow, ry = 10 + 16 * grow;
      if (fall > 0) { rx = 12; ry = 18 + Math.min(10, fall * 60); x = dx; }
      if (y < E[1] - 4) {
        ctx.save(); ctx.fillStyle = lgr(ctx, x, y - ry, x, y + ry, [[0, 'rgba(240,160,70,0.95)'], [1, 'rgba(170,80,20,0.95)']]); ell(ctx, x, y, rx, ry); ctx.fill();
        ctx.fillStyle = 'rgba(255,248,225,0.95)'; ell(ctx, x - rx * 0.35, y - ry * 0.35, rx * 0.28, ry * 0.22); ctx.fill();
        L.sparkle(ctx, x - rx * 0.3, y - ry * 0.4, 26, 0.6); ctx.restore();
      } else {
        const u = (T - (tDrop + Math.sqrt((E[1] - dy) / 900))) / 0.6;
        if (u > 0 && u < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,236,190,${0.7 * (1 - u)})`; ctx.lineWidth = 3; ell(ctx, dx, E[1], 20 + u * 110, (20 + u * 110) * ryr); ctx.stroke(); ctx.restore(); }
      }
    }
    L.sparkle(ctx, bX - 160, bY - 60, 40, 0.4 + 0.3 * Math.sin(T * 4));
  });
}

// =================================================================================================== S14 30.0–31.667
// Push-in on the tourist: the wrap goes in, BITE at 30.833 (crumbs fly), eyes close… then pop open with a sparkle.
const BITE = 30.833;
function s14(ctx, lt, p, T) {
  const tone = AFTER;
  const kick = T >= BITE ? Math.exp(-(T - BITE) * 7) : 0;
  const z = lerp(1.0, 1.3, ease.inOut(p)) + 0.03 * kick;
  drawBg(ctx, 'after', 540, 900, 1.3 + 0.1 * p, 540 - p * 40, 900);
  L.glow(ctx, 860, 480, 600, 'rgba(255,230,170,1)', 0.35);
  bokehField(ctx, T, 101, 14, tone.bokeh, 0.35, 40, 120, -p * 60, 0, 0, 1300);
  // wrap travel: chest → mouth (bite) → hold → eased away
  const e = T < BITE ? ease.in2(iv(30.0, BITE, T)) * 0.75 + 0.25 * ease.inOut(iv(30.0, BITE, T)) : T < 31.2 ? 1 : 1 - 0.55 * ease.inOut(iv(31.2, 31.667, T));
  const shut = T >= BITE && T < 31.25, popped = T >= 31.25, bitten = T >= BITE;
  let face;
  if (!bitten) face = { mouth: 'o', mOpen: 0.3 + 0.7 * iv(30.25, 30.75, T), lookY: 0.65, lookX: 0.15, brow: 0.45, open: 0.85, blush: 0.4 };
  else if (shut) face = { open: 0, happyClosed: 1, mouth: 'smile', mOpen: 0, blush: 0.6 + 0.35 * iv(BITE, 31.1, T), brow: 0.35 };
  else face = { open: 1.08, pupil: 1.3, mouth: 'smile', mOpen: 0.2, blush: 0.9, brow: 0.7, lookX: 0.1, lookY: -0.05 };
  let mapF = null, FY = 0;
  L.cam(ctx, 540, 1000, z, 0, () => {
    BX.tourist(ctx, 540, 2540, 5.4, {
      t: T, pose: 'wrapBite', k: 0.5, stool: false, vest: false,
      poseFn: (Pp) => {
        const mouth = [2, Pp.FY + 27], rest = [40, Pp.SY + 40], tip = [lerp(rest[0], mouth[0], e), lerp(rest[1], mouth[1], e)];
        const ang = lerp(-2.0, -2.5, e), d = [Math.cos(ang), Math.sin(ang)], ws = 0.21, Lw = 150 * ws, ctr = [tip[0] - d[0] * Lw, tip[1] - d[1] * Lw];
        const g1 = [ctr[0] - d[0] * 2 + d[1] * 9, ctr[1] - d[1] * 2 - d[0] * 9], g2 = [ctr[0] - d[0] * 16 - d[1] * 8, ctr[1] - d[1] * 16 + d[0] * 8];
        return {
          face,
          hL: [-50, Pp.SY + 150], kL: 'fist', rL: -0.6, flipL: false, hR: [ctr[0] - d[0] * 22 + d[1] * 4, ctr[1] - d[1] * 22 - d[0] * 4], kR: 'grip', rR: ang + PI / 2 + 0.25, flipR: true, lateHands: true,
          front: () => {
            ctx.save(); ctx.translate(ctr[0], ctr[1]); ctx.rotate(ang + PI / 2);
            ctx.save();
            if (bitten) { ctx.beginPath(); ctx.rect(-200, -200, 400, 400); for (const [bx, by, br] of [[-6, -Lw - 1, 7], [1, -Lw - 4, 7.5], [8, -Lw - 1, 7]]) { ctx.moveTo(bx + br, by); ctx.arc(bx, by, br, 0, TAU, true); } ctx.clip('evenodd'); }
            BX.leafWrap(ctx, 0, 0, ws, { k: 1, rot: 0, dip: 1, t: T, seed: 3 });
            ctx.restore();
            if (bitten) { // the bitten face of the wrap: crêpe, prawn, herbs
              ctx.fillStyle = '#f0b438'; ell(ctx, 1, -Lw + 5, 8, 3.2); ctx.fill(); ctx.strokeStyle = '#9a5214'; ctx.lineWidth = 0.8; ctx.stroke();
              ctx.fillStyle = '#ec6a3c'; ell(ctx, -2, -Lw + 4.6, 2.6, 1.6); ctx.fill(); ctx.fillStyle = '#6aae3e'; ell(ctx, 4, -Lw + 5, 2.2, 1.3); ctx.fill(); ctx.fillStyle = '#fbf6e4'; ell(ctx, 1, -Lw + 6.4, 1.6, 1); ctx.fill();
            }
            ctx.restore();
            const M = ctx.getTransform(); FY = Pp.FY;
            mapF = (px, py) => [M.a * px + M.c * py + M.e, M.b * px + M.d * py + M.f];
          },
        };
      },
    });
  });
  if (mapF) {
    const mouth = mapF(4, FY + 27), eyeL = mapF(-12, FY + 1), eyeR = mapF(12, FY + 1);
    if (bitten) {
      shardBurst(ctx, T, BITE, mouth[0], mouth[1], { n: 34, v: 700, g: 1500, size: 0.36, spread: 3.0, w: 60, softK: 0, seed: 15, life: 1.0, spin: 7, angle: -PI / 2 });
      shardBurst(ctx, T, BITE, mouth[0] + 20, mouth[1] + 6, { n: 16, v: 520, g: 1700, size: 0.3, angle: 0.2, spread: 2.0, w: 30, softK: 0, seed: 17, life: 0.9, spin: 8 });
    }
    if (popped) {
      const k = iv(31.25, 31.4, T), tw = 0.75 + 0.25 * Math.sin(T * 14);
      for (const q of [eyeL, eyeR]) L.sparkle(ctx, q[0] - 14, q[1] - 16, 64 * k * tw, 0.95 * k);
      BX.sparkles(ctx, T, (eyeL[0] + eyeR[0]) / 2, eyeL[1] - 10, 1.5, { n: 6, seed: 31, r: 380, alpha: k * 0.75 });
    }
  }
  L.dust(ctx, T, 41, 22, 0, 300, W, 1400, '255,236,190', 2.2, 0.5);
}

// =================================================================================================== S15 31.667–33.333
// Wide: the tourist at a wooden table under coconut palms by a calm canal, late-afternoon gold; slow lateral drift.
function palmFrond(ctx, x, y, len, ang, droop, col, rim, seed) {
  const r = rng(seed), N = 30;
  const pt = (u) => [x + Math.cos(ang) * len * u, y + Math.sin(ang) * len * u + droop * len * 0.35 * u * u];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col; ctx.lineWidth = 9; ctx.beginPath(); for (let i = 0; i <= 20; i++) { const q = pt(i / 20); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
  for (let i = 1; i < N; i++) {
    const u = i / N, q = pt(u), q2 = pt(u + 0.02), ta = Math.atan2(q2[1] - q[1], q2[0] - q[0]), ll = len * 0.36 * Math.sin(PI * (0.12 + u * 0.82)) * (0.8 + r() * 0.4), w = 7 + (1 - u) * 9;
    for (const sd of [-1, 1]) {
      const la = ta + sd * (0.75 + r() * 0.35), ex = q[0] + Math.cos(la) * ll, ey = q[1] + Math.sin(la) * ll + ll * 0.45, mx = q[0] + Math.cos(la) * ll * 0.5, my = q[1] + Math.sin(la) * ll * 0.5 + ll * 0.08;
      const nx = -Math.sin(la) * w, ny = Math.cos(la) * w;
      ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.quadraticCurveTo(mx + nx, my + ny, ex, ey); ctx.quadraticCurveTo(mx - nx * 0.4, my - ny * 0.4, q[0], q[1]); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
  }
  ctx.restore();
}
function woodenTable(ctx, x, y, w, d, tone) { // simple plank table seen from the front-above; (x,y) = centre of the top's front edge
  const h = 180, top = d;
  ctx.save(); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(20,8,2,0.35)'; ell(ctx, x, y + h + 10, w * 0.62, 34); ctx.fill();
  ctx.fillStyle = '#3e2212'; for (const sx of [-1, 1]) { ctx.fillRect(x + sx * w * 0.42 - 12, y + 10, 24, h); }
  ctx.fillStyle = '#2a160a'; for (const sx of [-1, 1]) ctx.fillRect(x + sx * w * 0.34 - 9, y - top + 30, 18, h - 20);
  ctx.beginPath(); ctx.moveTo(x - w * 0.46, y - top); ctx.lineTo(x + w * 0.46, y - top); ctx.lineTo(x + w * 0.5, y); ctx.lineTo(x - w * 0.5, y); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, y - top, 0, y, [[0, '#a8683a'], [1, '#7a4422']]); ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(40,16,6,0.5)'; ctx.lineWidth = 2; for (let i = 1; i < 5; i++) { const yy = y - top + top * i / 5; ctx.beginPath(); ctx.moveTo(x - w * 0.6, yy); ctx.lineTo(x + w * 0.6, yy); ctx.stroke(); }
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgbA(tone.rim, 0.25); ctx.fillRect(x - w * 0.6, y - top, w * 1.2, 10); ctx.restore();
  ctx.fillStyle = '#5a3018'; ctx.fillRect(x - w * 0.5, y, w, 16); ctx.fillStyle = 'rgba(255,214,150,0.35)'; ctx.fillRect(x - w * 0.5, y, w, 3);
  ctx.restore();
}
function s15(ctx, lt, p, T) {
  const tone = AFTER, e = ease.inOut(p);
  const drift = lerp(-40, 40, e);
  BX.riversideScene(ctx, T, { dusk: 0.0, horizon: 1060, sun: [880, 640], sunS: 1.1, flare: 0.35, house: { x: 930, y: 1200, s: 0.55 }, garden: false, cam: { zoom: 1.04, cx: 540 + drift, cy: 960 } });
  ctx.save(); ctx.translate(-drift * 1.4, 0);
  // near bank: grass + earth, gently lit
  ctx.beginPath(); ctx.moveTo(-200, 1420); ctx.bezierCurveTo(200, 1390, 700, 1400, W + 200, 1440); ctx.lineTo(W + 200, H); ctx.lineTo(-200, H); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, 1400, 0, H, [[0, '#6a7a2e'], [0.25, '#4a5a22'], [1, '#2a2a10']]); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,160,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-200, 1420); ctx.bezierCurveTo(200, 1390, 700, 1400, W + 200, 1440); ctx.stroke();
  const r = rng(12); ctx.lineCap = 'round';
  for (let i = 0; i < 160; i++) { const gx = -200 + r() * (W + 400), gy = 1420 + r() * 500, gl = 14 + r() * 26; ctx.strokeStyle = r() < 0.5 ? 'rgba(130,150,60,0.8)' : 'rgba(70,90,30,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + 4, gy - gl * 0.6, gx + 8 + Math.sin(T * 2 + i) * 3, gy - gl); ctx.stroke(); }
  // palm trunk (left foreground) curving up out of frame
  ctx.save(); ctx.beginPath(); ctx.moveTo(40, H + 20); ctx.bezierCurveTo(120, 1500, 70, 900, 210, -40); ctx.lineTo(290, -40); ctx.bezierCurveTo(160, 900, 220, 1500, 170, H + 20); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 60, 0, 280, 0, [[0, '#2a1a10'], [0.6, '#4a3020'], [1, '#7a5a3a']]); ctx.fill();
  ctx.clip(); ctx.strokeStyle = 'rgba(20,10,4,0.4)'; ctx.lineWidth = 3; for (let y = -40; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(160, y + 10, 320, y - 4); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,214,150,0.35)'; ctx.fillRect(240, 0, 60, H);
  ctx.restore();
  ctx.restore();
  // the table + the tourist (seated behind it, enjoying a wrap, looking out to the canal)
  const tx = 600 - drift * 1.15, ty = 1560;
  ctx.save(); ctx.translate(-drift * 0.0, 0);
  BX.tourist(ctx, tx, ty - 6, 1.32, { t: T, pose: 'wrapBite', k: 0.32 + 0.04 * Math.sin(T * 2), stool: true, vest: false,
    poseFn: () => ({ face: { mouth: 'smile', open: 0.85, lookX: 0.5, lookY: -0.1, turn: 0.18, blush: 0.55, brow: 0.3 } }) });
  woodenTable(ctx, tx, ty + 30, 620, 120, tone);
  // the meal on the table
  rusticPlate(ctx, tx - 40, ty - 30, 0.42, 0.3, 0.6, tone);
  heroCrepe(ctx, tx - 50, ty - 34, 0.42 * 1.2, 0.3, 0.4, T, tone, { bite: 0.7, biteA: 2.2, rim: 0.6 });
  drawSprite(ctx, basketSpr(), tx - 230, ty - 40, 0.38, 0);
  drawSprite(ctx, bowlSpr(), tx + 190, ty - 20, 0.6, 0);
  steamRise(ctx, T, tx - 50, ty - 50, { n: 12, w: 70, h: 200, r: 18, alpha: 0.45, seed: 51 });
  ctx.restore();
  // overhanging fronds (foreground, soft), sun flare, light dust
  palmFrond(ctx, 250 - drift * 1.6, -60, 760, 0.25, 0.9, 'rgba(30,40,14,0.92)', 'rgba(255,220,140,0.25)', 3);
  palmFrond(ctx, 250 - drift * 1.6, -60, 620, 1.2, 0.5, 'rgba(30,40,14,0.9)', 'rgba(255,220,140,0.2)', 4);
  palmFrond(ctx, 1180 - drift * 1.8, 120, 520, PI - 0.2, -0.6, 'rgba(26,34,12,0.85)', null, 5);
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,176,70,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  L.flare(ctx, 880 - drift * 1.04, 640, 0.7, 0.35);
  L.dust(ctx, T, 61, 26, 0, 500, W, 1100, '255,236,190', 2.2, 0.5);
}

// =================================================================================================== S16 33.333–40.0
// Sunset table: crane up, then push toward the crêpe. LIKE heart pops 36.667 (pulses each beat), FOLLOW pressed 37.5.
// Everything freezes 39.5–40.0.
const LIKE0 = 36.667, FOLLOW0 = 36.95, PRESS = 37.5, HOLD = 39.5;
function heartPath(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + 30 * s);
  ctx.bezierCurveTo(x - 10 * s, y + 20 * s, x - 60 * s, y - 5 * s, x - 60 * s, y - 35 * s); ctx.bezierCurveTo(x - 60 * s, y - 65 * s, x - 20 * s, y - 75 * s, x, y - 45 * s);
  ctx.bezierCurveTo(x + 20 * s, y - 75 * s, x + 60 * s, y - 65 * s, x + 60 * s, y - 35 * s); ctx.bezierCurveTo(x + 60 * s, y - 5 * s, x + 10 * s, y + 20 * s, x, y + 30 * s); ctx.closePath();
}
function ctaLike(ctx, T, x, y) {
  const k = T - LIKE0; if (k < 0) return;
  const pop = ease.outBack(clamp(k / 0.42));
  const bp = ((T - LIKE0) / BEAT) % 1, pulse = 1 + 0.11 * Math.exp(-bp * 7) * (k > 0.3 ? 1 : 0);
  ctx.save(); ctx.globalAlpha = clamp(k / 0.12);
  // glass disc
  ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 24;
  ell(ctx, 0, 0, 104, 104); ctx.fillStyle = 'rgba(24,10,10,0.55)'; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,230,190,0.85)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.restore();
  const hs = 1.12 * pop * pulse;
  ctx.save(); ctx.shadowColor = 'rgba(255,60,90,0.6)'; ctx.shadowBlur = 30 * pulse;
  heartPath(ctx, x, y + 14, hs); ctx.fillStyle = lgr(ctx, x, y - 60, x, y + 40, [[0, '#ff6a86'], [1, '#e8173f']]); ctx.fill(); ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, x - 30 * hs, y - 28 * hs, 12 * hs, 7 * hs, -0.6); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.font = '36px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THÍCH', x, y + 146);
  ctx.font = '28px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('LIKE', x, y + 186);
  const f = clamp(k / 1.3); if (f > 0 && f < 1) { ctx.globalAlpha = Math.sin(f * PI); ctx.font = '54px BodySansBold'; ctx.fillStyle = '#ff7a94'; ctx.fillText('+1', x + 120, y - 80 - f * 110); }
  ctx.restore();
  if (k < 0.4) L.glow(ctx, x, y, 240, 'rgba(255,120,150,0.9)', 1 - k / 0.4);
  // soft heart particles drifting up on every beat
  ctx.save();
  for (let i = 0; i < 6; i++) { const t0 = LIKE0 + i * BEAT * 0.5, u = (T - t0) / 1.6; if (u < 0 || u > 1) continue; const r = rng(90 + i), hx = x + (r() - 0.5) * 160 + Math.sin(u * 6 + i) * 18, hy = y - 60 - u * 260; ctx.globalAlpha = Math.sin(u * PI) * 0.8; heartPath(ctx, hx, hy, 0.22 + r() * 0.12); ctx.fillStyle = '#ff6a86'; ctx.fill(); }
  ctx.restore();
}
function ctaFollow(ctx, T, x, y) {
  const k = T - FOLLOW0; if (k < 0) return;
  const sl = ease.outBack(clamp(k / 0.45)), pressed = T >= PRESS, pk = T - PRESS;
  const press = pk >= 0 && pk < 0.28 ? 1 - Math.sin(pk / 0.28 * PI) * 0.1 : (pk < 0 && pk > -0.12 ? 1 - (0.12 + pk) / 0.12 * 0.04 : 1);
  const w = 380, h = 124;
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15); ctx.translate(x + (1 - sl) * 420, y); ctx.scale(press, press);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = pressed ? 'rgba(40,26,22,0.78)' : lgr(ctx, 0, -h / 2, 0, h / 2, [[0, '#ff4a6e'], [1, '#e01e48']]); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = pressed ? 'rgba(255,214,150,0.9)' : 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3.5; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!pressed) {
    ctx.font = '46px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#fff'; ctx.fillText('+ FOLLOW', 0, -14);
    ctx.font = '26px BodySansBold'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THEO DÕI', 0, 30);
  } else {
    const ck = ease.outBack(clamp(pk / 0.3));
    ctx.save(); ctx.translate(-136, 0); ctx.scale(ck, ck); ell(ctx, 0, 0, 30, 30); ctx.fillStyle = '#f2c25a'; ctx.fill();
    ctx.strokeStyle = '#2a160a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-3, 11); ctx.lineTo(15, -11); ctx.stroke(); ctx.restore();
    ctx.letterSpacing = '1px'; ctx.font = '34px BodySansBold'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('ĐÃ THEO DÕI', 30, -14);
    ctx.font = '24px BodySans'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOWING', 30, 28);
  }
  ctx.restore();
  // tap ripple + gold sparkles at the press
  if (pk >= 0 && pk < 0.6) {
    const u = pk / 0.6; ctx.save(); ctx.strokeStyle = `rgba(255,240,210,${0.8 * (1 - u)})`; ctx.lineWidth = 6 * (1 - u) + 1; ctx.beginPath(); ctx.roundRect(x - w / 2 - u * 50, y - h / 2 - u * 50, w + u * 100, h + u * 100, h / 2 + u * 50); ctx.stroke(); ctx.restore();
    L.glow(ctx, x, y, 280, 'rgba(255,230,190,0.9)', 0.7 * (1 - u));
  }
  if (pk >= 0) BX.sparkles(ctx, T, x, y, 1.2, { n: 7, seed: 41, r: 260, alpha: 0.9 * (1 - clamp(pk / 1.6)) });
}
function s16(ctx, lt, p, T) {
  const Tf = Math.min(T, HOLD), tone = SUNSET;
  const crane = ease.inOut(iv(33.333, 36.3, Tf)), push = ease.inOut(iv(35.8, HOLD, Tf));
  const S = lerp(lerp(0.78, 0.88, crane), 1.5, push);
  const ryr = lerp(0.27, 0.4, crane);
  const hz = lerp(1010, 830, crane) + push * 40;
  const ox = 540, oy = lerp(lerp(1260, 1250, crane), 1300, push);
  const phi = lerp(-0.25, 0.1, ease.inOut(iv(33.333, HOLD, Tf)));
  const P = plane(ox, oy, S, ryr, phi);
  const sun = drawBg(ctx, 'sunset', 540, 930, lerp(1.2, 1.5, push), 540 + phi * 120, hz - 70);
  L.glow(ctx, sun[0], sun[1], 620, 'rgba(255,170,90,1)', 0.55);
  bokehField(ctx, Tf, 121, 12, tone.bokeh, 0.3, 30, 90, -phi * 200, 0, 0, hz);
  drawTable(ctx, P, hz, tone, sun);
  const cp = P.p(0, 0), cs = S * 1.45;
  drawSet(ctx, P, Tf, 0, () => {
    rusticPlate(ctx, cp[0], cp[1], S, ryr, phi + 0.6, tone);
    heroCrepe(ctx, cp[0], cp[1] - 8 * S, cs, ryr, phi, Tf, tone, { lightA: -1.57, rim: 1.4 });
  }, { dof: 1.6 });
  steamRise(ctx, Tf, cp[0], cp[1] - 50 * S, { n: 26, w: 240 * cs, h: 560 * cs, r: 85 * cs, alpha: 0.4, seed: 77 });
  steamStrands(ctx, Tf, cp[0], cp[1] - 50 * S, { n: 7, w: 260 * cs, h: 640 * cs, alpha: 0.9, lw: 10 * cs, seed: 79 });
  // thin smoke drifting across (left → right), warm-lit
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const r = rng(300 + i), y = hz - 120 + r() * 520, sp = 30 + r() * 30, x = ((r() * 1600 + Tf * sp) % 1600) - 260, R = 160 + r() * 200;
    ctx.globalAlpha = 0.1 + r() * 0.08; ctx.drawImage(SMOKE(), x - R * 1.6, y - R * 0.5, R * 3.2, R);
  }
  ctx.restore();
  L.godRays(ctx, sun[0], sun[1], PI / 2, 1.5, 1600, 11, 'rgba(255,180,110,0.9)', 0.1, Tf);
  // foreground palm fronds framing the top corners (silhouette)
  palmFrond(ctx, -80, 40 - crane * 120, 640, 0.15, 0.9, 'rgba(24,10,14,0.95)', 'rgba(255,150,90,0.35)', 7);
  palmFrond(ctx, W + 80, -20 - crane * 120, 560, PI - 0.1, -0.9, 'rgba(24,10,14,0.95)', 'rgba(255,150,90,0.3)', 8);
  L.dust(ctx, Tf, 71, 22, 0, 500, W, 1000, '255,200,150', 2.2, 0.5);
  // gentle closing glints on the crêpe
  if (Tf > 38.6) L.sparkle(ctx, cp[0] - 140 * cs, cp[1] - 60 * cs, 70, 0.8 * iv(38.6, 39.2, Tf));
  // out-of-focus herbs in the very foreground (depth)
  drawSprite(ctx, fgLeafSpr(), 60 - push * 60, 1900 + push * 120, 1.5 + push * 0.3, 1, 0.8);
  // CTA graphics (overlay.js draws the LIKE & FOLLOW text above y≈480)
  ctaLike(ctx, Tf, 290, 640);
  ctaFollow(ctx, Tf, 690, 640);
}

// warm the caches once at load
(function warm() {
  try { woodTex(); plateTex(); bgPlate('gold'); bgPlate('sunset'); bgPlate('after'); basketSpr(); bowlSpr(); fgLeafSpr(); shardSprites(); }
  catch (err) { /* built lazily */ }
})();

module.exports = { s10, s11, s12, s13, s14, s15, s16 };
