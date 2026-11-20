// c_scene.js — writer C helpers for s10..s14 (night Saigon close-ups).
// Cached blurred street plates, lit tourist face, stainless spoon + hand, text-free wok cart,
// wok, plate stack, stool/table. Deterministic, no per-frame blur.
const L = require('./lib');
const CT = require('./ctprops');
const CL = require('./cl_food');
const P = require('./people');
const KT = require('./kitchen');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const SKIN = P.SKIN;

const CACHE = new Map();
function cached(key, w, h, fn) {
  let c = CACHE.get(key);
  if (!c) { c = createCanvas(w, h); fn(c.getContext('2d'), w, h); CACHE.set(key, c); }
  return c;
}
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
function rg(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function lg(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
// decaying pulse after t0
const hitAt = (T, t0, d = 0.3) => { const k = T - t0; return k < 0 || k > d ? 0 : Math.pow(1 - k / d, 2); };
const env = (T, a, b, fi = 0.15, fo = 0.15) => clamp((T - a) / fi) * clamp((b - T) / fo);

// ------------------------------------------------------------------ backgrounds
function softBokeh(x, r, n, pal, w, h, rmin, rmax, alpha, yMin = 0, yMax = 1) {
  x.save(); x.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const px = r() * w, py = (yMin + r() * (yMax - yMin)) * h, rr = rmin + r() * (rmax - rmin), c = pal[i % pal.length], a = alpha * (0.4 + r() * 0.6);
    x.fillStyle = rg(x, px, py, 0, rr, [[0, `rgba(${c},${a})`], [0.7, `rgba(${c},${a * 0.75})`], [1, `rgba(${c},0)`]]);
    x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  x.restore();
}
// street plate: CT.alley rendered once, heavily blurred (text unreadable), tinted to the night palette, bokeh on top.
function streetPlate(view = 'cart', blur = 26, key = '') {
  return cached('street_' + view + blur + key, W, H, (x) => {
    const src = createCanvas(W, H), sx = src.getContext('2d');
    sx.fillStyle = '#0f1c2e'; sx.fillRect(0, 0, W, H);
    try { CT.alley(sx, 0, { view, layer: key === 'back' ? 'back' : 'all', dawn: 0, neon: 1, smoke: 0.3, steam: 0 }); } catch (e) { /* fallback: gradient only */ }
    x.fillStyle = '#132438'; x.fillRect(0, 0, W, H);
    x.filter = `blur(${blur}px)`; x.drawImage(src, -60, -80, W + 120, H + 160); x.filter = 'none';
    // night grade
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, '#55688a'], [0.55, '#7d8fb0'], [1, '#6f8296']]); x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = lg(x, 0, 0, 0, H, [[0, 'rgba(15,28,46,0.45)'], [0.5, 'rgba(15,28,46,0.1)'], [1, 'rgba(29,58,74,0.35)']]); x.fillRect(0, 0, W, H);
    const r = rng(77 + blur);
    softBokeh(x, r, 26, ['255,179,71', '255,90,170', '80,220,255', '255,220,150'], W, H, 26, 90, 0.32, 0.05, 0.75);
    softBokeh(x, r, 10, ['255,150,60', '255,80,160'], W, H, 90, 200, 0.12, 0.2, 0.9);
    // string lights across the top
    x.save(); x.globalCompositeOperation = 'screen';
    for (let i = 0; i < 14; i++) {
      const u = i / 13, px = lerp(-40, W + 40, u), py = 300 + Math.sin(u * Math.PI) * 120 + (r() - 0.5) * 30, c = i % 3 === 0 ? '255,110,190' : i % 3 === 1 ? '255,200,110' : '120,230,255';
      x.fillStyle = rg(x, px, py, 0, 46, [[0, `rgba(${c},0.75)`], [0.35, `rgba(${c},0.35)`], [1, `rgba(${c},0)`]]); x.fillRect(px - 46, py - 46, 92, 92);
    }
    x.restore();
  });
}
// draw a plate with parallax zoom about (fx,fy) (frame coords), always covering the frame
function drawPlate(ctx, img, z = 1, fx = W / 2, fy = H / 2, dx = 0, dy = 0) {
  const s = Math.max(1, z) * 1.04;
  const ox = clamp(fx - (fx - 0) * s + dx, W - W * s, 0), oy = clamp(fy - (fy - 0) * s + dy, H - H * s, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(img, ox, oy, W * s, H * s); ctx.restore();
}

// ------------------------------------------------------------------ lit face
// Draws people.face into a reused buffer, then night lighting (warm firelight low-left, cool blue top-right,
// cyan + pink neon rims) clipped to the face pixels via source-atop. o.pre(bx) draws extras before lighting
// (in face-local coords, origin between the eyes, unit = face unit), o.post(bx) after lighting.
function litFace(ctx, x, y, s, fo, lo = {}) {
  const [bc, bx] = L.buffer('c_face');
  const m = ctx.getTransform();
  bx.setTransform(m);
  P.face(bx, x, y, s, fo);
  bx.save(); bx.translate(x, y); bx.rotate(fo.tilt || 0); bx.scale(s, s);
  if (lo.pre) lo.pre(bx);
  bx.globalCompositeOperation = 'source-atop';
  const wk = lo.warm ?? 1, ck = lo.cool ?? 1;
  bx.fillStyle = rg(bx, -380, 520, 40, 760, [[0, `rgba(255,170,70,${0.42 * wk})`], [0.5, `rgba(255,150,60,${0.18 * wk})`], [1, 'rgba(255,150,60,0)']]); bx.fillRect(-900, -900, 1800, 1800);
  bx.fillStyle = rg(bx, 420, -420, 40, 720, [[0, `rgba(50,95,180,${0.36 * ck})`], [1, 'rgba(50,95,180,0)']]); bx.fillRect(-900, -900, 1800, 1800);
  bx.fillStyle = lg(bx, 95, 0, 175, 0, [[0, 'rgba(110,230,255,0)'], [1, `rgba(110,230,255,${0.55 * ck})`]]); bx.fillRect(95, -320, 400, 640);
  bx.fillStyle = lg(bx, -100, 0, -175, 0, [[0, 'rgba(255,90,170,0)'], [1, `rgba(255,90,170,${0.4 * ck})`]]); bx.fillRect(-500, -320, 400, 640);
  bx.fillStyle = lg(bx, 0, 250, 0, 600, [[0, 'rgba(10,20,40,0)'], [1, 'rgba(10,20,40,0.45)']]); bx.fillRect(-500, 250, 1000, 400);
  bx.globalCompositeOperation = 'source-over';
  if (lo.post) lo.post(bx);
  bx.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bc, 0, 0); ctx.restore();
}
// face geometry helpers (face-local units)
const eyeX = (sx, turn) => sx * 64 + turn * 70 * (sx === 1 ? 1.15 : 0.85);
const mouthX = (turn) => turn * 70 * 1.05;
// extra eye catchlights (warm firelight + neon pink) — call in post
function catchlights(bx, fo, k = 1) {
  const op = fo.open === undefined ? 1 : fo.open; if (op < 0.1) return;
  for (const sx of [-1, 1]) {
    const ex = eyeX(sx, fo.turn || 0), w = 48 * (1 + sx * (fo.turn || 0) * 0.5), ix = ex + ((fo.lookX || 0) - (fo.cross || 0) * sx) * w * 0.45, iy = (fo.lookY || 0) * 10 - 2;
    bx.fillStyle = `rgba(255,190,110,${0.9 * k})`; ell(bx, ix + 8, iy + 7, 3.6, 3); bx.fill();
    bx.fillStyle = `rgba(255,120,200,${0.75 * k})`; ell(bx, ix - 10, iy + 4, 2.4, 2.4); bx.fill();
  }
}
// glossy lips highlight — call in post
function lipGloss(bx, fo, k = 1) {
  const mx = mouthX(fo.turn || 0), my = 140, type = fo.mouth || 'neutral', op = fo.mOpen || 0;
  bx.save(); bx.globalCompositeOperation = 'screen'; bx.lineCap = 'round';
  bx.strokeStyle = `rgba(255,235,225,${0.55 * k})`; bx.lineWidth = 4;
  bx.beginPath();
  if (type === 'o') { bx.arc(mx, my + 6, 24 + op * 8, 0.35 * Math.PI, 0.65 * Math.PI); }
  else if (type === 'grin') { bx.moveTo(mx - 22, my + 58 + op * 20); bx.quadraticCurveTo(mx, my + 62 + op * 20, mx + 22, my + 57 + op * 20); }
  else if (type === 'smile') { bx.moveTo(mx - 18, my + 18); bx.quadraticCurveTo(mx, my + 24, mx + 18, my + 17); }
  else { bx.moveTo(mx - 14, my + 9); bx.quadraticCurveTo(mx, my + 12, mx + 14, my + 8); }
  bx.stroke(); bx.restore();
}
// sweat drop at temple; k 0..1 slide progress
function sweat(bx, k, a = 1, side = 1) {
  if (a <= 0) return;
  const x0 = side * 138, y0 = lerp(-110, 40, ease.in2 ? ease.in2(k) : k * k), r = 13;
  bx.save(); bx.globalAlpha = a;
  bx.fillStyle = lg(bx, x0 - r, y0 - 30, x0 + r, y0 + r, [[0, 'rgba(210,240,255,0.95)'], [1, 'rgba(110,170,220,0.85)']]);
  bx.beginPath(); bx.moveTo(x0, y0 - 2.4 * r); bx.quadraticCurveTo(x0 + r * 1.1, y0 - r * 0.4, x0 + r, y0 + r * 0.2); bx.arc(x0, y0 + r * 0.2, r, 0, Math.PI); bx.quadraticCurveTo(x0 - r * 1.1, y0 - r * 0.4, x0, y0 - 2.4 * r); bx.fill();
  bx.fillStyle = 'rgba(255,255,255,0.95)'; ell(bx, x0 - r * 0.35, y0 - r * 0.2, r * 0.28, r * 0.42, -0.3); bx.fill();
  if (k > 0.05) { bx.strokeStyle = 'rgba(200,235,255,0.35)'; bx.lineWidth = 4; bx.beginPath(); bx.moveTo(x0, -110); bx.lineTo(x0, y0 - 2.4 * r); bx.stroke(); }
  bx.restore();
}
// cheek bulges (chewing) — call in pre
function cheeks(bx, k, turn = 0) {
  if (k <= 0) return;
  // bulge filled with the face's own skin gradient so it merges with the head silhouette
  const tx = turn * 70;
  const skin = () => rg(bx, -50 + tx, -50, 20, 230, [[0, SKIN[0]], [0.7, SKIN[1]], [1, SKIN[2]]]);
  for (const sx of [-1, 1]) {
    const cx = sx * (108 + 12 * k) + tx * 0.6, cy = 134, rx = 30 + 10 * k, ry = 36 + 8 * k;
    bx.fillStyle = skin(); ell(bx, cx, cy, rx, ry); bx.fill();
    bx.fillStyle = rg(bx, cx + sx * rx * 0.5, cy + ry * 0.4, 2, rx * 1.1, [[0, `rgba(160,80,60,${0.22 * k})`], [1, 'rgba(160,80,60,0)']]); ell(bx, cx, cy, rx, ry); bx.fill();
    bx.fillStyle = rg(bx, cx - sx * 6, cy - 14, 2, rx * 0.8, [[0, `rgba(240,105,100,${0.35 * k})`], [1, 'rgba(240,105,100,0)']]); ell(bx, cx, cy, rx, ry); bx.fill();
    bx.fillStyle = `rgba(255,240,225,${0.35 * k})`; ell(bx, cx - sx * 8, cy - ry * 0.45, rx * 0.35, ry * 0.18, -sx * 0.4); bx.fill();
  }
}
// throat bob (gulp) — call in pre; k 0..1 travel
function gulp(bx, k, a) {
  if (a <= 0) return;
  const y = lerp(200, 262, k);
  bx.save(); bx.globalAlpha = a;
  bx.fillStyle = 'rgba(160,80,60,0.35)'; ell(bx, 10, y + 10, 26, 13); bx.fill();
  bx.fillStyle = 'rgba(255,225,200,0.45)'; ell(bx, 4, y, 22, 10); bx.fill();
  bx.restore();
}

// wide-open mouth for the bite (face-local), k 0..1 — call in pre (covers the face's own mouth)
function bigMouth(bx, k, turn = 0) {
  if (k <= 0.03) return;
  const mx = turn * 70 * 1.05, my = 150, rx = 34 + 24 * k, ry = 8 + 50 * k;
  bx.fillStyle = lg(bx, 0, my - ry - 14, 0, my + ry + 14, [[0, '#d27a6a'], [0.5, '#c25e52'], [1, '#d98474']]);
  ell(bx, mx, my, rx + 13, ry + 13); bx.fill();
  bx.fillStyle = rg(bx, mx, my + ry * 0.2, 2, rx + ry, [[0, '#6a1e1a'], [0.6, '#41120f'], [1, '#230807']]);
  ell(bx, mx, my, rx, ry); bx.fill();
  bx.save(); ell(bx, mx, my, rx, ry); bx.clip();
  bx.fillStyle = '#fbf6ee'; bx.beginPath(); bx.roundRect(mx - rx * 0.8, my - ry - 4, rx * 1.6, Math.max(6, ry * 0.32), 6); bx.fill();
  bx.fillStyle = rg(bx, mx, my + ry * 0.8, 2, rx * 0.8, [[0, '#e67b72'], [1, '#b8473f']]); ell(bx, mx, my + ry * 0.85, rx * 0.7, ry * 0.5); bx.fill();
  bx.restore();
  bx.save(); bx.globalCompositeOperation = 'screen'; bx.lineCap = 'round';
  bx.strokeStyle = 'rgba(255,235,228,0.7)'; bx.lineWidth = 5; bx.beginPath(); bx.ellipse(mx, my, rx + 6, ry + 7, 0, Math.PI * 0.3, Math.PI * 0.62); bx.stroke();
  bx.strokeStyle = 'rgba(255,225,215,0.45)'; bx.lineWidth = 3; bx.beginPath(); bx.ellipse(mx, my, rx + 6, ry + 7, 0, Math.PI * 1.3, Math.PI * 1.5); bx.stroke();
  bx.restore();
}
// torso continuation below the face's shirt (face-local), call in pre — fills to the bottom of the frame
function torso(bx) {
  bx.save(); bx.globalCompositeOperation = 'destination-over';
  bx.beginPath(); bx.moveTo(-332, 585); bx.lineTo(-380, 1500); bx.lineTo(380, 1500); bx.lineTo(332, 585); bx.closePath();
  bx.fillStyle = lg(bx, -360, 0, 360, 0, [[0, '#46b8ae'], [0.6, '#2f8f8a'], [1, '#1f6764']]); bx.fill();
  bx.restore();
  bx.fillStyle = '#5a4630'; bx.fillRect(-230, 600, 46, 900); bx.fillRect(190, 600, 46, 900);
}

// ------------------------------------------------------------------ spoon + hand
// spoonRig: (bx,by) = spoon bowl centre; ang = direction from bowl to handle end; arm comes from the grip
// along armAng (off-screen). Egg sits upright in the bowl (rotated by eggRot).
function spoonRig(ctx, bx, by, s, ang, o = {}) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const gx = bx + c * 245 * s, gy = by + sn * 245 * s;
  const armAng = o.armAng ?? ang + 0.5, armLen = (o.armLen ?? 900) * s;
  // forearm + sleeve
  if (o.arm !== false) {
    const ax = gx + Math.cos(armAng) * armLen, ay = gy + Math.sin(armAng) * armLen, nx = -Math.sin(armAng), ny = Math.cos(armAng);
    const w0 = 44 * s, w1 = 70 * s;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(gx + nx * w0, gy + ny * w0); ctx.lineTo(ax + nx * w1, ay + ny * w1); ctx.lineTo(ax - nx * w1, ay - ny * w1); ctx.lineTo(gx - nx * w0, gy - ny * w0); ctx.closePath();
    ctx.fillStyle = lg(ctx, gx + nx * w0, gy + ny * w0, gx - nx * w0, gy - ny * w0, [[0, SKIN[0]], [0.6, SKIN[1]], [1, SKIN[2]]]); ctx.fill();
    // warm rim on the arm
    ctx.strokeStyle = 'rgba(255,190,110,0.35)'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(gx + nx * w0 * 0.85, gy + ny * w0 * 0.85); ctx.lineTo(ax + nx * w1 * 0.85, ay + ny * w1 * 0.85); ctx.stroke();
    const sl = 0.55, sx0 = gx + Math.cos(armAng) * armLen * sl, sy0 = gy + Math.sin(armAng) * armLen * sl, sw = lerp(w0, w1, sl) * 1.25;
    ctx.beginPath(); ctx.moveTo(sx0 + nx * sw, sy0 + ny * sw); ctx.lineTo(ax + nx * w1 * 1.4, ay + ny * w1 * 1.4); ctx.lineTo(ax - nx * w1 * 1.4, ay - ny * w1 * 1.4); ctx.lineTo(sx0 - nx * sw, sy0 - ny * sw); ctx.closePath();
    ctx.fillStyle = lg(ctx, sx0 + nx * sw, sy0 + ny * sw, sx0 - nx * sw, sy0 - ny * sw, [[0, '#4cc0b5'], [0.6, '#2f8f8a'], [1, '#1f6461']]); ctx.fill();
    ctx.restore();
  }
  // handle
  L.at(ctx, bx, by, ang, s, s, () => {
    ctx.beginPath(); ctx.moveTo(52, -11); ctx.quadraticCurveTo(190, -13, 330, -9); ctx.arc(330, 4, 13, -Math.PI / 2, Math.PI / 2); ctx.quadraticCurveTo(190, 9, 52, 11); ctx.closePath();
    ctx.fillStyle = lg(ctx, 0, -13, 0, 17, [[0, '#f6f9fc'], [0.45, '#aab6c4'], [0.75, '#6d7a8a'], [1, '#c9d3de']]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(70, -7, 230, 3);
    ctx.fillStyle = 'rgba(255,180,90,0.5)'; ctx.fillRect(90, 5, 200, 2.5);
  });
  // bowl (kept level-ish: tilt only a little with ang)
  L.at(ctx, bx, by, (o.bowlRot ?? 0), s, s, () => {
    ell(ctx, 0, 6, 86, 58); ctx.fillStyle = rg(ctx, -24, -14, 6, 96, [[0, '#f4f8fc'], [0.5, '#a3afbd'], [1, '#56626f']]); ctx.fill();
    ell(ctx, 0, -2, 74, 44); ctx.fillStyle = lg(ctx, 0, -46, 0, 42, [[0, '#4d5867'], [0.5, '#8c98a6'], [1, '#d7dee6']]); ctx.fill();
    if (o.sauce !== false) { ell(ctx, 2, 6, 58, 30); ctx.fillStyle = rg(ctx, -10, 0, 4, 64, [[0, '#a8501c'], [0.6, '#7a3412'], [1, '#5a2410']]); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,0.75)'; ell(ctx, -22, 0, 14, 4, -0.2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -2, 74, 44, 0, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,80,0.55)'; ctx.beginPath(); ctx.ellipse(0, -2, 74, 44, 0, Math.PI * 0.15, Math.PI * 0.6); ctx.stroke();
  });
  if (o.egg !== false) {
    const es = (o.eggS ?? 0.95) * s;
    CL.cutLon(ctx, bx + 2 * s, by - 18 * s, es, { state: 'fried', glaze: 1, herb: o.herb ?? 0.7, seed: o.seed ?? 4, shadow: false, t: o.t || 0, rot: o.eggRot || 0 });
    if (o.leaf !== false) CL.ramLeaf(ctx, bx + 30 * s, by - 2 * s, 0.9 * s, { rot: -0.5, seed: 3 });
    // glaze glint
    const gk = 0.5 + 0.5 * Math.sin((o.t || 0) * 5.3);
    L.sparkle(ctx, bx - 18 * s, by - 52 * s, 22 * s * (0.6 + gk * 0.6), 0.75);
  }
  // fist around the handle
  if (o.hand !== false) {
    L.at(ctx, gx, gy, ang, s, s, () => {
      const g = lg(ctx, 0, -46, 0, 58, [[0, SKIN[0]], [0.55, SKIN[1]], [1, SKIN[2]]]);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(-46, -30, 104, 82, 34); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(-44 + i * 24, 18, 26, 40, 12); ctx.fill(); }
      ctx.strokeStyle = 'rgba(150,80,60,0.35)'; ctx.lineWidth = 2.5;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-44 + i * 24, 24); ctx.lineTo(-44 + i * 24, 50); ctx.stroke(); }
      // thumb along the top of the handle
      ctx.fillStyle = lg(ctx, -60, -30, 20, -10, [[0, SKIN[0]], [1, SKIN[1]]]);
      ctx.beginPath(); ctx.roundRect(-74, -36, 92, 30, 15); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,222,0.75)'; ell(ctx, -60, -27, 9, 5); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,110,0.3)'; ell(ctx, -10, -26, 40, 7); ctx.fill();
    });
  }
  return { grip: [gx, gy], bowl: [bx, by], egg: [bx + 2 * s, by - 18 * s] };
}

// ------------------------------------------------------------------ street props (text-free)
function stool(ctx, x, y, s, col = '#d8423a') { // (x,y) = seat top centre, ~120 px wide at s=1
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const dark = col === '#2f6fd0' ? '#1e4890' : '#962a24';
  ctx.fillStyle = 'rgba(5,8,20,0.35)'; ell(ctx, 0, 132, 80, 12); ctx.fill();
  ctx.fillStyle = dark;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 46, 8); ctx.lineTo(sx * 62, 130); ctx.lineTo(sx * 46, 130); ctx.lineTo(sx * 34, 8); ctx.fill(); }
  ctx.fillStyle = lg(ctx, -60, 0, 60, 0, [[0, col], [1, dark]]); ctx.beginPath(); ctx.roundRect(-40, 10, 80, 80, 10); ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
  ell(ctx, 0, 6, 62, 15); ctx.fillStyle = lg(ctx, -60, 0, 60, 0, [[0, '#ff7a6a'], [0.5, col], [1, dark]]); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,180,0.35)'; ell(ctx, -18, 2, 26, 5); ctx.fill();
  ctx.restore();
}
function lowTable(ctx, x, y, s) { // (x,y) = table top centre; blue plastic table
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(5,8,20,0.35)'; ell(ctx, 0, 200, 150, 18); ctx.fill();
  ctx.fillStyle = '#1d4a8a';
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 96, 10); ctx.lineTo(sx * 118, 198); ctx.lineTo(sx * 100, 198); ctx.lineTo(sx * 82, 10); ctx.fill(); }
  ctx.fillStyle = lg(ctx, 0, -10, 0, 30, [[0, '#4f8fe0'], [1, '#2a5fa8']]);
  ctx.beginPath(); ctx.roundRect(-132, -18, 264, 34, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,120,0.25)'; ctx.fillRect(-128, -16, 200, 4);
  ctx.restore();
}
// stack of empty plates (white/blue rim), n plates, k per-plate drop progress fn(i)->0..1
function plateStack(ctx, x, y, s, n, kf, T) {
  for (let i = 0; i < n; i++) {
    const k = kf(i); if (k <= 0) continue;
    const dy = (1 - ease.outBack(clamp(k))) * -160 * s, py = y - i * 13 * s + dy;
    ctx.save(); ctx.globalAlpha = clamp(k * 4);
    ell(ctx, x, py + 6 * s, 96 * s, 26 * s); ctx.fillStyle = '#b8c4d4'; ctx.fill();
    ell(ctx, x, py, 98 * s, 26 * s); ctx.fillStyle = rg(ctx, x - 20 * s, py - 6 * s, 4, 100 * s, [[0, '#ffffff'], [0.8, '#e4ebf3'], [1, '#c3cfdd']]); ctx.fill();
    ctx.strokeStyle = '#3d6fb8'; ctx.lineWidth = 3 * s; ell(ctx, x, py, 86 * s, 21 * s); ctx.stroke();
    ell(ctx, x, py + 2 * s, 56 * s, 13 * s); ctx.fillStyle = 'rgba(122,52,18,0.35)'; ctx.fill(); // leftover glaze smear
    ctx.fillStyle = 'rgba(255,190,110,0.35)'; ell(ctx, x - 40 * s, py - 10 * s, 26 * s, 4 * s); ctx.fill();
    ctx.restore();
  }
}
// wok (iron), (x,y) = rim centre. eggsUp: 0..1 toss phase (eggs in the air), handle toward angle hAng
function wok(ctx, x, y, s, rot, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  // handle
  const ha = o.hAng ?? Math.PI;
  ctx.save(); ctx.rotate(ha - Math.PI); ctx.fillStyle = lg(ctx, 0, -8, 0, 10, [[0, '#6b5a4a'], [1, '#2b211a']]);
  ctx.beginPath(); ctx.roundRect(-250, -9, 130, 18, 9); ctx.fill(); ctx.fillStyle = '#3a3a40'; ctx.fillRect(-130, -6, 20, 12); ctx.restore();
  // body
  ctx.beginPath(); ctx.ellipse(0, 0, 130, 34, 0, 0, Math.PI); ctx.quadraticCurveTo(-120, 90, 0, 92); ctx.quadraticCurveTo(120, 90, 130, 0); ctx.closePath();
  ctx.fillStyle = lg(ctx, -130, 0, 130, 0, [[0, '#2b2b33'], [0.4, '#4a4a55'], [0.7, '#1c1c22'], [1, '#121216']]); ctx.fill();
  ctx.fillStyle = 'rgba(255,160,70,0.25)'; ctx.beginPath(); ctx.ellipse(0, 40, 110, 46, 0, 0.1, Math.PI - 0.1); ctx.fill();
  // inside
  ell(ctx, 0, 0, 130, 34); ctx.fillStyle = '#1a1a20'; ctx.fill();
  ell(ctx, 0, 6, 110, 24); ctx.fillStyle = rg(ctx, 0, 6, 4, 110, [[0, '#a8501c'], [0.7, '#6a2c10'], [1, '#2a1208']]); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 128, 33, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.restore();
}
// text-free street wok cart. (x,y) = front edge of counter top (centre). returns {burner:[x,y], top}
function wokCart(ctx, x, y, s, t, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const w = 300;
  // shadow
  ctx.fillStyle = 'rgba(5,8,20,0.45)'; ell(ctx, 0, 330, w * 1.1, 26); ctx.fill();
  // body
  ctx.fillStyle = lg(ctx, -w, 0, w, 0, [[0, '#6f7c8a'], [0.2, '#c9d3de'], [0.45, '#8c99a8'], [0.7, '#dbe3ec'], [1, '#5c6876']]);
  ctx.beginPath(); ctx.roundRect(-w, 10, w * 2, 290, 10); ctx.fill();
  // panels
  ctx.strokeStyle = 'rgba(40,50,64,0.35)'; ctx.lineWidth = 3;
  for (const px of [-w / 3, w / 3]) { ctx.beginPath(); ctx.moveTo(px, 26); ctx.lineTo(px, 290); ctx.stroke(); }
  // warm reflection from the flame + neon pink reflection
  ctx.fillStyle = rg(ctx, 40, 20, 10, 260, [[0, 'rgba(255,170,70,0.5)'], [1, 'rgba(255,170,70,0)']]); ctx.fillRect(-w, 10, w * 2, 290);
  ctx.fillStyle = lg(ctx, -w, 0, -w + 120, 0, [[0, 'rgba(255,80,170,0.4)'], [1, 'rgba(255,80,170,0)']]); ctx.fillRect(-w, 10, 120, 290);
  ctx.fillStyle = lg(ctx, w - 120, 0, w, 0, [[0, 'rgba(90,220,255,0)'], [1, 'rgba(90,220,255,0.4)']]); ctx.fillRect(w - 120, 10, 120, 290);
  // lower shelf shadow
  ctx.fillStyle = lg(ctx, 0, 200, 0, 300, [[0, 'rgba(10,15,30,0)'], [1, 'rgba(10,15,30,0.45)']]); ctx.fillRect(-w, 200, w * 2, 100);
  // wheels
  for (const sx of [-1, 1]) { ell(ctx, sx * (w - 60), 300, 34, 34); ctx.fillStyle = '#1a1a22'; ctx.fill(); ell(ctx, sx * (w - 60), 300, 12, 12); ctx.fillStyle = '#8a96a6'; ctx.fill(); }
  // counter top slab
  ctx.fillStyle = lg(ctx, 0, -26, 0, 14, [[0, '#eef3f8'], [0.6, '#aeb9c6'], [1, '#6f7c8a']]);
  ctx.beginPath(); ctx.roundRect(-w - 16, -22, (w + 16) * 2, 34, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(-w - 8, -20, (w + 8) * 2, 3);
  // props on the counter: egg basket (left), tamarind jar, sauce bottle
  ctx.fillStyle = lg(ctx, -260, -60, -150, -10, [[0, '#c8954a'], [1, '#7a5428']]); ctx.beginPath(); ctx.roundRect(-270, -64, 120, 46, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(80,50,20,0.5)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-264 + i * 24, -60); ctx.lineTo(-256 + i * 24, -22); ctx.stroke(); }
  const r = rng(31); for (let i = 0; i < 6; i++) { const ex = -255 + i * 18 + r() * 4, ey = -70 - (i % 2) * 6; ell(ctx, ex, ey, 10, 12); ctx.fillStyle = '#efe2c8'; ctx.fill(); ctx.fillStyle = 'rgba(120,80,40,0.5)'; ell(ctx, ex + 3, ey - 2, 2, 2); ctx.fill(); }
  ctx.fillStyle = lg(ctx, -130, -90, -80, -20, [[0, '#d9c6a0'], [1, '#8a6a40']]); ctx.beginPath(); ctx.roundRect(-128, -92, 50, 72, 10); ctx.fill(); // jar
  ctx.fillStyle = '#5a2410'; ctx.beginPath(); ctx.roundRect(-124, -60, 42, 36, 6); ctx.fill();
  ctx.fillStyle = '#c2462e'; ctx.beginPath(); ctx.roundRect(232, -112, 30, 92, 8); ctx.fill(); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(238, -128, 18, 20); // bottle
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(238, -104, 5, 70);
  // gas burner
  const bxp = o.burnerX ?? 70;
  ctx.fillStyle = '#25252c'; ell(ctx, bxp, -24, 96, 16); ctx.fill();
  ctx.restore();
  const bx = x + bxp * s, by = y - 24 * s;
  KT.flame(ctx, bx, by, 70 * s, 14 * s, t, o.flame ?? 1);
  return { burner: [bx, by] };
}
// wet asphalt ground strip with neon reflections (cached), drawn from y0 to H
function groundPlate() {
  return cached('ground', W, 900, (x, w, h) => {
    x.fillStyle = lg(x, 0, 0, 0, h, [[0, '#1d2c40'], [0.4, '#16233a'], [1, '#0d1626']]); x.fillRect(0, 0, w, h);
    const r = rng(12);
    x.filter = 'blur(10px)';
    for (let i = 0; i < 9; i++) { const px = r() * w, c = ['255,90,170', '90,220,255', '255,179,71'][i % 3]; x.fillStyle = lg(x, 0, 0, 0, h, [[0, `rgba(${c},0.35)`], [1, `rgba(${c},0)`]]); x.fillRect(px - 14, 0, 28 + r() * 30, h * (0.4 + r() * 0.5)); }
    x.filter = 'none';
    x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 160; i++) x.fillRect(r() * w, r() * h, 2 + r() * 6, 1.5);
    x.fillStyle = lg(x, 0, 0, 0, 60, [[0, 'rgba(15,28,46,1)'], [1, 'rgba(15,28,46,0)']]); x.fillRect(0, 0, w, 60);
  });
}

module.exports = { cached, ell, rg, lg, hitAt, env, streetPlate, drawPlate, litFace, catchlights, lipGloss, sweat, cheeks, gulp, eyeX, mouthX, bigMouth, torso,
  spoonRig, stool, lowTable, plateStack, wok, wokCart, groundPlate };
