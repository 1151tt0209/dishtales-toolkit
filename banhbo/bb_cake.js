'use strict';
// bb_cake.js — Bánh bò nướng lá dứa: THE CAKE (writer B). Same look in every shot.
// =====================================================================================================================
// API (all LOCAL coords, every drawer save()/restore()s, deterministic from o.t / seed; heavy parts cached offscreen)
//   CAKE {R:280, H:190}            cake radius / dome height in cake UNITS (1 unit = 1 px at s = 1). Diameter 560 at s=1.
//   hOf(r)                          dome profile height at radius r (units).
//   dome(ctx,x,y,s,{ryr=.42, sx=1, sy=1, shear=0, shadow=true, glow=1})  whole golden-brown dome, origin = base centre
//        (on the plate). ryr = view squash of the horizontal plane (sin of the elevation). sx/sy/shear = jiggle.
//        → {top:[x,y] crown, R (screen px), ry}
//   wedgeCake(ctx,x,y,s,{ryr, a0=.6, a1=1.66, lift (wedge piece lifted, px), liftRot, cut (draw only the cut slit 0..1 along a0),
//        piece=true}) dome with the wedge θ∈[a0,a1] removed: two honeycomb cut faces. → {face0:M, face1:M}
//   face(ctx,M,{r0=-R,r1=R,torn,seed,light=1,crust=true})   honeycomb cross-section in the plane mapped by
//        M = {o:[x,y], u:[x,y] (screen per unit along r), v:[x,y] (screen per unit along z)}.
//   half(ctx,x,y,s,{side -1|1, ryr, phi (yaw: torn face turns toward camera), dx, dy, roll, seed}) → anchor(r,z) → [x,y]
//   tear(ctx,x,y,s,{t, state(t)→{sep (units), phi, roll, dy, lift}, ryr, n=26, seed, glow, hero (index of the strand that
//        survives longest), heroSnap (time), heroOnly}) two halves pulled apart with a web of sticky strands that thin,
//        sag and snap one by one (dangling tails recoil). → {L:anchorFn, R:anchorFn, hero:{a,b,alive,mid}}
//   strand(ctx,a,b,{w0 (end width px), w (middle width px), sag (px), t, wob, alpha=1, glow=1})  one sticky translucent
//        thread a→b with catenary sag, thin middle, wide "tented" ends, highlight + beads.
//   tail(ctx,a,dir,len,{w0,t,droop,alpha})  a snapped strand hanging from a (dir = initial direction, radians)
//   piece(ctx,x,y,s,rot,{bite 0..1, seed, strands=1, t})  hand-sized torn chunk (~220×170 at s=1): golden crust top,
//        torn honeycomb side facing the camera, sticky threads. → {mouth:[x,y]} (point of the bite edge)
//   slice(ctx,x,y,s,rot,{t}) wedge slice lying on its side: big honeycomb face toward camera (origin = tip/centre of face base)
//   mould(ctx,x,y,s,{ryr (+ shows the cake top inside, − shows the pan bottom), depth=1, cake=true}) round fluted metal pan
//   leafPlate(ctx,x,y,s,{ryr=.42}) woven bamboo tray (mẹt) lined with a glossy banana leaf, R 400 at s=1.
//   cakeSteam(ctx,t,x,y,{w=300,h=600,n=14,alpha=.4,seed,r=60,drift}) soft rising steam puffs (cached sprite).
//   softHand(ctx,x,y,s,rot,{flip, curl:[i,m,r,p] 0..1 or n, thumb (rad), thumbLen, spread, skin, sleeve, arm=260, nails=true})
//        realistic-ish shaded hand (no outline). origin = back-of-hand centre, fingers toward +x. → {tip:[x,y] index tip, thumb}
// =====================================================================================================================
const L = require('./lib');
const { createCanvas, Path2D } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease } = L;
const PI = Math.PI;

const CAKE = { R: 280, H: 175 };
const { R, H } = CAKE;
const PP = 2.7, QQ = 0.38;
const hOf = (r) => { const a = Math.min(1, Math.abs(r) / R); return H * Math.pow(Math.max(0, 1 - Math.pow(a, PP)), QQ); };
const rOf = (z) => R * Math.pow(Math.max(0, 1 - Math.pow(clamp(z / H), 1 / QQ)), 1 / PP);
const dhdr = (r) => (hOf(Math.min(R, r + 0.5)) - hOf(Math.max(0, r - 0.5))) / 1;

const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
const lgr = (ctx, x0, y0, x1, y1, st) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
const rgr = (ctx, x0, y0, r0, x1, y1, r1, st) => { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of st) g.addColorStop(o, c); return g; };
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) { const A = typeof a === 'string' ? hex(a) : a, B = typeof b === 'string' ? hex(b) : b; return A.map((q, i) => Math.round(lerp(q, B[i], clamp(t)))); }
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const CACHE = {};
function cv(w, h) { const c = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); return [c, c.getContext('2d')]; }

// ===================================================================================================== dome sprite
const SS = 2.2; // sprite px per unit
function domeSprite(ryr) {
  const key = 'dome' + ryr.toFixed(2);
  if (CACHE[key]) return CACHE[key];
  const c = Math.sqrt(1 - ryr * ryr), N = 190;
  // silhouette envelope
  const slices = [];
  for (let i = 0; i <= N; i++) { const z = (i / N) * H; slices.push([z, rOf(z)]); }
  let minY = 0;
  for (const [z, r] of slices) minY = Math.min(minY, -z * c - r * ryr);
  const pad = 30, Wd = 2 * R * SS + 2 * pad, Hd = (-minY + R * ryr) * SS + 2 * pad;
  const ox = Wd / 2, oy = -minY * SS + pad;
  const [cnv, x] = cv(Wd, Hd);
  x.translate(ox, oy); x.scale(SS, SS);
  const env = [];
  for (let i = 0; i <= 120; i++) {
    const xx = -R + (2 * R * i) / 120; let y = R * ryr * Math.sqrt(Math.max(0, 1 - (xx / R) ** 2));
    let top = Infinity;
    for (const [z, r] of slices) if (r >= Math.abs(xx)) top = Math.min(top, -z * c - ryr * Math.sqrt(r * r - xx * xx));
    env.push([xx, top, y]);
  }
  const sil = new Path2D();
  env.forEach(([xx, t], i) => i ? sil.lineTo(xx, t) : sil.moveTo(xx, t));
  for (let i = env.length - 1; i >= 0; i--) sil.lineTo(env[i][0], env[i][2]);
  sil.closePath();
  // colours
  const TOP = hex('#dc9636'), TOP2 = hex('#bf6c24'), SIDE = hex('#98481a'), FOOT = hex('#5a260c');
  for (let i = 0; i <= N; i++) {
    const [z, r] = slices[i]; if (r < 0.5) continue;
    const sl = Math.abs(dhdr(Math.min(R - 0.6, r))), up = 1 / Math.sqrt(1 + sl * sl), tz = z / H;
    let col = mix(mix(FOOT, SIDE, clamp(tz * 3)), mix(TOP2, TOP, clamp((tz - 0.6) / 0.4)), Math.pow(up, 0.8));
    const g = x.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, rgb(mix(col, [255, 210, 130], 0.22))); g.addColorStop(0.3, rgb(mix(col, [255, 196, 110], 0.08)));
    g.addColorStop(0.62, rgb(col)); g.addColorStop(1, rgb(mix(col, [40, 14, 4], 0.42)));
    x.fillStyle = g; ell(x, 0, -z * c, r, r * ryr); x.fill();
  }
  x.save(); x.clip(sil);
  const r = rng(77);
  // surface sampler
  const L3 = [-0.55, -0.35, 0.76], V = [0, c, ryr];
  const Hh = (() => { const h = [L3[0] + V[0], L3[1] + V[1], L3[2] + V[2]], n = Math.hypot(...h); return h.map(q => q / n); })();
  const surf = (rr, th) => {
    const z = hOf(rr), d = -dhdr(Math.min(R - 0.6, rr)), nn = Math.hypot(d, 1), n = [d * Math.cos(th) / nn, d * Math.sin(th) / nn, 1 / nn];
    const nv = n[1] * V[1] + n[2] * V[2];
    return { sx: rr * Math.cos(th), sy: rr * Math.sin(th) * ryr - z * c, nv, n, spec: Math.max(0, n[0] * Hh[0] + n[1] * Hh[1] + n[2] * Hh[2]), z };
  };
  const samp = () => { const rr = R * Math.sqrt(r()) * 0.995, th = r() * TAU; return [rr, th, surf(rr, th)]; };
  // ambient occlusion at the foot
  // mottled bake (breaks the airbrushed look)
  for (let i = 0; i < 520; i++) { const [, , p] = samp(); if (p.nv < 0.05) continue; const sz = 7 + r() * 20, dk = r() < 0.55; x.save(); x.translate(p.sx, p.sy); x.scale(1, 0.3 + 0.7 * p.nv); x.fillStyle = rgr(x, 0, 0, 0, 0, 0, sz, [[0, dk ? `rgba(120,50,12,${0.06 + r() * 0.07})` : `rgba(250,190,90,${0.05 + r() * 0.06})`], [1, 'rgba(0,0,0,0)']]); x.fillRect(-sz, -sz, sz * 2, sz * 2); x.restore(); }
  // caramel blisters
  for (let i = 0; i < 160; i++) {
    const [, , p] = samp(); if (p.nv < 0.05) continue;
    const sz = 4 + r() * 11;
    x.save(); x.translate(p.sx, p.sy); x.scale(1, 0.3 + 0.7 * p.nv);
    x.fillStyle = rgr(x, 0, 0, 0, 0, 0, sz, [[0, `rgba(105,42,10,${0.1 + r() * 0.16})`], [1, 'rgba(105,42,10,0)']]); x.fillRect(-sz, -sz, sz * 2, sz * 2);
    x.restore();
  }
  for (let i = 0; i < 60; i++) {
    const [, , p] = samp(); if (p.nv < 0.05) continue;
    const sz = 4 + r() * 10;
    x.save(); x.translate(p.sx, p.sy); x.scale(1, 0.3 + 0.7 * p.nv);
    x.fillStyle = rgr(x, 0, 0, 0, 0, 0, sz, [[0, `rgba(240,190,100,${0.08 + r() * 0.1})`], [1, 'rgba(240,190,100,0)']]); x.fillRect(-sz, -sz, sz * 2, sz * 2);
    x.restore();
  }
  // pores + speckle
  for (let i = 0; i < 1500; i++) {
    const [, , p] = samp(); if (p.nv < 0.04) continue;
    const sz = 0.45 + r() * 1.3;
    if (r() < 0.65) { x.fillStyle = `rgba(70,28,6,${0.25 + r() * 0.35})`; ell(x, p.sx, p.sy, sz, sz * (0.35 + 0.65 * p.nv)); x.fill(); x.fillStyle = 'rgba(255,215,150,0.35)'; ell(x, p.sx, p.sy + sz * 0.7, sz * 0.8, sz * 0.3); x.fill(); }
    else { x.fillStyle = `rgba(255,220,160,${0.15 + r() * 0.25})`; ell(x, p.sx, p.sy, sz * 0.8, sz * 0.5); x.fill(); }
  }
  // soft sheen following the shape (sticky gloss)
  x.globalCompositeOperation = 'screen';
  for (let i = 0; i < 2600; i++) {
    const [, , p] = samp(); if (p.nv < 0.05) continue;
    const sp = Math.pow(p.spec, 8); if (sp < 0.03) continue;
    const sz = 18 + r() * 16;
    x.fillStyle = rgr(x, p.sx, p.sy, 0, p.sx, p.sy, sz, [[0, `rgba(255,236,190,${0.045 * sp})`], [1, 'rgba(255,236,190,0)']]); x.fillRect(p.sx - sz, p.sy - sz, sz * 2, sz * 2);
  }
  for (let i = 0; i < 260; i++) {
    const [, , p] = samp(); if (p.nv < 0.05) continue;
    const sp = Math.pow(p.spec, 26); if (sp < 0.05) continue;
    x.fillStyle = `rgba(255,250,230,${Math.min(0.9, sp * (0.4 + r() * 0.6))})`; ell(x, p.sx, p.sy, 0.8 + r() * 1.8, 0.5 + r() * 0.9, -0.3); x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  // crack ring on the crown (split crust showing the pale crumb)
  const rc = 0.4 * R, ring = (k, j) => { const pts = []; for (let i = 0; i <= 96; i++) { const th = (i / 96) * TAU, gw = clamp(3.2 + 3.4 * Math.sin(th * 3 + 1) + 2.2 * Math.sin(th * 7 + 2.3), 0.4, 9), rr = rc + k * gw / 2 + Math.sin(th * 5) * 4 + Math.sin(th * 11 + 1) * 2; pts.push([rr * Math.cos(th), rr * Math.sin(th) * ryr - (hOf(rr) + 1.5) * c]); } return pts; };
  const outer = ring(1, 0.5), inner = ring(-1, 2.1);
  const rp = new Path2D(); outer.forEach(([a, b], i) => i ? rp.lineTo(a, b) : rp.moveTo(a, b)); rp.closePath();
  inner.slice().reverse().forEach(([a, b], i) => i ? rp.lineTo(a, b) : rp.moveTo(a, b)); rp.closePath();
  x.fillStyle = lgr(x, 0, -H * c - rc * ryr, 0, -H * c + rc * ryr, [[0, '#6f8a2e'], [0.4, '#a9bf55'], [1, '#c9cf72']]); x.fill(rp, 'evenodd');
  x.save(); x.clip(rp, 'evenodd');
  for (let i = 0; i < 160; i++) { const th = r() * TAU, rr = rc + (r() - 0.5) * 16; x.fillStyle = `rgba(70,100,25,${0.3 + r() * 0.4})`; ell(x, rr * Math.cos(th), rr * Math.sin(th) * ryr - hOf(rr) * c, 0.6 + r() * 1.6, 0.4 + r() * 0.8); x.fill(); }
  x.restore();
  x.lineJoin = 'round';
  x.strokeStyle = 'rgba(70,26,6,0.55)'; x.lineWidth = 1.6; x.beginPath(); outer.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke();
  x.strokeStyle = 'rgba(255,214,140,0.7)'; x.lineWidth = 1.4; x.beginPath(); inner.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke();
  // crown cap highlight
  x.globalCompositeOperation = 'screen';
  x.fillStyle = rgr(x, -rc * 0.35, -H * c - rc * ryr * 0.3, 0, -rc * 0.35, -H * c - rc * ryr * 0.3, rc * 0.9, [[0, 'rgba(255,230,170,0.35)'], [1, 'rgba(255,230,170,0)']]); x.fillRect(-R, -H * 1.3, 2 * R, H);
  // backlit rim along the top silhouette
  const rimG = x.createLinearGradient(-R, 0, R, 0); rimG.addColorStop(0, 'rgba(255,220,150,0.95)'); rimG.addColorStop(0.55, 'rgba(255,200,120,0.55)'); rimG.addColorStop(1, 'rgba(255,170,90,0.12)');
  x.strokeStyle = rimG; x.lineCap = 'round';
  for (const [lw, a] of [[9, 0.25], [4, 0.6], [1.6, 1]]) { x.globalAlpha = a; x.lineWidth = lw; x.beginPath(); env.forEach(([xx, t], i) => i ? x.lineTo(xx, t + lw * 0.3) : x.moveTo(xx, t + lw * 0.3)); x.stroke(); }
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  x.restore();
  CACHE[key] = { c: cnv, ox, oy, ryr, sil, env };
  return CACHE[key];
}
const ryrKey = (ryr) => Math.round(clamp(ryr, 0.1, 0.9) * 50) / 50;

function contactShadow(ctx, s, ryr, a = 0.55, k = 1.12) {
  ctx.save(); ctx.scale(1, ryr);
  ctx.fillStyle = rgr(ctx, 0, 0, R * s * 0.6, 0, 0, R * s * k, [[0, `rgba(30,12,4,${a})`], [1, 'rgba(30,12,4,0)']]);
  ctx.fillRect(-R * s * 1.3, -R * s * 1.3, R * s * 2.6, R * s * 2.6); ctx.restore();
}
function domeRaw(ctx, s, ryr) { const sp = domeSprite(ryrKey(ryr)); ctx.drawImage(sp.c, -sp.ox * s / SS, -sp.oy * s / SS, sp.c.width * s / SS, sp.c.height * s / SS); }
function dome(ctx, x, y, s = 1, o = {}) {
  const ryr = o.ryr ?? 0.42, c = Math.sqrt(1 - ryr * ryr);
  ctx.save(); ctx.translate(x, y);
  if (o.shadow !== false) contactShadow(ctx, s, ryr, 0.55 * (o.shadowA ?? 1));
  ctx.transform(o.sx ?? 1, 0, o.shear ?? 0, o.sy ?? 1, 0, 0);
  domeRaw(ctx, s, ryr);
  ctx.restore();
  return { top: [x, y - H * c * s * (o.sy ?? 1)], R: R * s, ry: R * s * ryr };
}

// ===================================================================================================== honeycomb texture
const KT = 6, PADR = 10, PADZ = 10;
const TW = (2 * R + 2 * PADR) * KT, TH = (H + 2 * PADZ) * KT;
const t2px = (r, z) => [(r + R + PADR) * KT, (H + PADZ - z) * KT];
function honeyTex(torn) {
  const key = torn ? 'honeyT' : 'honey';
  if (CACHE[key]) return CACHE[key];
  const [c, x] = cv(TW, TH), r = rng(torn ? 913 : 311);
  x.fillStyle = lgr(x, 0, 0, 0, TH, [[0, '#d6e47c'], [0.12, '#c6e06e'], [0.5, '#b4d860'], [1, '#a2cc56']]); x.fillRect(0, 0, TW, TH);
  // subsurface glow
  const [gx, gy] = t2px(0, H * 0.42);
  x.save(); x.translate(gx, gy); x.scale(1.9, 1);
  x.fillStyle = rgr(x, 0, 0, 0, 0, 0, H * KT * 0.75, [[0, 'rgba(236,252,170,0.55)'], [0.6, 'rgba(220,245,150,0.18)'], [1, 'rgba(220,245,150,0)']]); x.fillRect(-TW, -TH, TW * 2, TH * 2);
  x.restore();
  // crumb noise
  for (let i = 0; i < 14000; i++) { x.fillStyle = r() < 0.5 ? `rgba(90,140,40,${0.08 + r() * 0.12})` : `rgba(240,255,200,${0.06 + r() * 0.12})`; x.fillRect(r() * TW, r() * TH, 1 + r() * 2.5, 1 + r() * 2.5); }
  // tiny pores
  for (let i = 0; i < 3800; i++) {
    const px = r() * TW, py = r() * TH, rr = (0.5 + r() * 1.3) * KT * 0.6;
    x.fillStyle = `rgba(62,108,24,${0.4 + r() * 0.35})`; ell(x, px, py, rr, rr * (1 + r() * 0.8)); x.fill();
    x.fillStyle = 'rgba(230,250,180,0.45)'; ell(x, px, py + rr * 0.9, rr * 0.8, rr * 0.3); x.fill();
  }
  // tunnels (non-overlapping capsules, tall, longer toward the top)
  const cell = 24, grid = new Map(), tun = [];
  const near = (cx, cz, fn) => { const gx0 = Math.floor(cx / cell), gz0 = Math.floor(cz / cell); for (let a = -2; a <= 2; a++) for (let b = -3; b <= 3; b++) { const l = grid.get((gx0 + a) + ',' + (gz0 + b)); if (l) for (const q of l) if (fn(q)) return true; } return false; };
  const segD = (A, B) => { // min distance between two vertical-ish segments (approx by sampling)
    let m = Infinity;
    for (let i = 0; i <= 4; i++) { const ta = i / 4, ax = lerp(A.x0, A.x1, ta), az = lerp(A.z0, A.z1, ta); for (let j = 0; j <= 4; j++) { const tb = j / 4, bx = lerp(B.x0, B.x1, tb), bz = lerp(B.z0, B.z1, tb); m = Math.min(m, Math.hypot(ax - bx, az - bz)); } }
    return m;
  };
  const passes = [[5000, 9, 16], [9000, 5, 10], [16000, 2.2, 6]];
  for (const [nIt, wMin, wMax] of passes) for (let it = 0; it < nIt; it++) {
    const rc = (r() * 2 - 1) * (R + 4), hz = hOf(rc), zc = r() * (H + 4);
    const dTop = hz - zc; if (dTop < 4 || zc < 3) continue;
    const tz = clamp(zc / H), edge = clamp(dTop / 30);
    const w = lerp(wMin, wMax, Math.pow(r(), 1.3)) * (0.75 + 0.4 * tz) * (0.4 + 0.6 * edge);
    if (w < 1.8) continue;
    let len = w * (1.8 + 2.6 * r()) * (0.6 + 1.15 * tz); len = Math.min(len, 80, dTop * 1.5 + 4, zc * 1.6 + 6);
    if (len < w * 1.05) len = w * 1.05;
    const tilt = (r() - 0.5) * 0.26 + (rc / R) * 0.2;
    const T = { x0: rc - Math.sin(tilt) * len / 2, z0: zc - Math.cos(tilt) * len / 2, x1: rc + Math.sin(tilt) * len / 2, z1: zc + Math.cos(tilt) * len / 2, w, len, tilt, rc, zc, ph: r() * TAU, ph2: r() * TAU };
    if (near(rc, zc, (q) => segD(T, q) < (q.w + w) / 2 + 1.0)) continue;
    tun.push(T); const k = Math.floor(rc / cell) + ',' + Math.floor(zc / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(T);
  }
  // stretched crumb fibres between the cells
  x.lineCap = 'round';
  for (let i = 0; i < 1400; i++) { const rc = (r() * 2 - 1) * R, zc = r() * hOf(rc), [px, py] = t2px(rc, zc), l = (6 + r() * 30) * KT; x.strokeStyle = r() < 0.6 ? 'rgba(110,160,50,' + (0.12 + r() * 0.12) + ')' : 'rgba(240,255,200,' + (0.12 + r() * 0.14) + ')'; x.lineWidth = (0.3 + r() * 0.6) * KT; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 2 * KT + (rc / R) * l * 0.15, py - l); x.stroke(); }
  const cellPath = (w, l, ph, ph2) => { x.beginPath(); for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU, j = 1 + 0.07 * Math.sin(3 * a + ph) + 0.05 * Math.sin(5 * a + ph2); const px = (w / 2) * Math.sin(a) * (1 - 0.22 * Math.cos(a)) * j, py = -(l / 2) * Math.cos(a) * (1 + 0.03 * Math.sin(2 * a + ph)); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); };
  for (const T of tun) {
    const [px, py] = t2px(T.rc, T.zc), w = T.w * KT, l = T.len * KT;
    x.save(); x.translate(px, py); x.rotate(T.tilt);
    // raised glossy wall lip below, shadowed overhang above
    x.save(); x.translate(0, 1.3 * KT); x.scale((w / 2 + 1.4 * KT) / (w / 2), (l / 2 + 1.2 * KT) / (l / 2)); cellPath(w, l, T.ph, T.ph2); x.fillStyle = 'rgba(236,250,180,0.42)'; x.fill(); x.restore();
    x.save(); x.translate(0, -1.3 * KT); x.scale((w / 2 + 0.9 * KT) / (w / 2), (l / 2 + 0.8 * KT) / (l / 2)); cellPath(w, l, T.ph, T.ph2); x.fillStyle = 'rgba(60,100,20,0.35)'; x.fill(); x.restore();
    cellPath(w, l, T.ph, T.ph2);
    x.fillStyle = lgr(x, 0, -l / 2, 0, l / 2, [[0, '#1d3d0a'], [0.3, '#2f5c14'], [0.68, '#4f8a24'], [0.9, '#7fb444'], [1, '#a2cc5c']]); x.fill();
    x.save(); x.clip();
    x.fillStyle = 'rgba(14,34,4,0.5)'; ell(x, -w * 0.14, -l * 0.1, w * 0.3, l * 0.4); x.fill();
    x.fillStyle = 'rgba(206,236,140,0.55)'; ell(x, w * 0.06, l / 2 - Math.min(w, l) * 0.16, w * 0.4, Math.min(w, l) * 0.15); x.fill();
    x.strokeStyle = 'rgba(150,200,80,0.35)'; x.lineWidth = Math.max(1, w * 0.06); x.beginPath(); x.moveTo(w * 0.28, -l * 0.3); x.quadraticCurveTo(w * 0.36, 0, w * 0.22, l * 0.36); x.stroke();
    x.restore();
    if (w > 4 * KT) { x.fillStyle = 'rgba(255,255,235,0.6)'; ell(x, -w * 0.2, l * 0.3, w * 0.07, Math.min(l * 0.07, w * 0.22)); x.fill(); }
    x.restore();
  }
  if (torn) { // lumpy torn surface: bumps with top highlight / lower shadow + stretched fibres
    for (let i = 0; i < 520; i++) {
      const rc = (r() * 2 - 1) * R, zc = r() * hOf(rc), [px, py] = t2px(rc, zc), sz = (4 + r() * 13) * KT;
      x.fillStyle = rgr(x, px, py + sz * 0.35, 0, px, py + sz * 0.35, sz, [[0, 'rgba(40,70,12,0.22)'], [1, 'rgba(40,70,12,0)']]); x.fillRect(px - sz, py - sz, sz * 2, sz * 2.4);
      x.fillStyle = rgr(x, px - sz * 0.15, py - sz * 0.3, 0, px - sz * 0.15, py - sz * 0.3, sz * 0.75, [[0, 'rgba(236,252,186,0.35)'], [1, 'rgba(236,252,186,0)']]); x.fillRect(px - sz, py - sz * 1.2, sz * 2, sz * 2);
    }
    x.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const rc = (r() * 2 - 1) * R, zc = r() * hOf(rc), [px, py] = t2px(rc, zc), l = (4 + r() * 16) * KT, a = -PI / 2 + (r() - 0.5) * 0.8;
      x.strokeStyle = `rgba(226,246,170,${0.08 + r() * 0.14})`; x.lineWidth = (0.4 + r() * 0.8) * KT;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (r() - 0.5) * 8, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
  }
  // moist gloss specks
  x.globalCompositeOperation = 'screen';
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(255,255,230,${0.12 + r() * 0.5})`; const s2 = 0.6 + r() * 2.2; ell(x, r() * TW, r() * TH, s2, s2 * 0.6, r() * PI); x.fill(); }
  x.globalCompositeOperation = 'source-over';
  CACHE[key] = c;
  return c;
}

// ===================================================================================================== cross-section face
// M: {o, u, v}: P(r,z) = o + r*u + z*v (screen)
const MP = (M, r, z) => [M.o[0] + r * M.u[0] + z * M.v[0], M.o[1] + r * M.u[1] + z * M.v[1]];
function jag(seed, r) { return Math.sin(r * 0.11 + seed) * 3.2 + Math.sin(r * 0.29 + seed * 2.3) * 2.2 + Math.sin(r * 0.73 + seed * 1.7) * 1.2; }
function faceTop(o, rr) { return Math.max(0, hOf(rr) + (o.torn ? jag(o.seed || 1, rr) - 2.5 : 0)); }
function facePath(M, o) {
  const r0 = o.r0 ?? -R, r1 = o.r1 ?? R, n = 64, p = new Path2D();
  const b0 = MP(M, r0, o.torn ? -3 : 0); p.moveTo(b0[0], b0[1]);
  for (let i = 0; i <= n; i++) { const rr = lerp(r0, r1, i / n), q = MP(M, rr, faceTop(o, rr)); p.lineTo(q[0], q[1]); }
  const b1 = MP(M, r1, o.torn ? -3 : 0); p.lineTo(b1[0], b1[1]);
  if (o.torn) for (let i = n; i >= 0; i--) { const rr = lerp(r0, r1, i / n), q = MP(M, rr, -1 + Math.sin(rr * 0.2 + (o.seed || 1)) * 1.5); p.lineTo(q[0], q[1]); }
  p.closePath(); return p;
}
function face(ctx, M, o = {}) {
  const r0 = o.r0 ?? -R, r1 = o.r1 ?? R, p = facePath(M, o), tex = honeyTex(!!o.torn), su = Math.hypot(M.u[0], M.u[1]), sv = Math.hypot(M.v[0], M.v[1]);
  if (su < 0.004) return p;
  ctx.save(); ctx.clip(p);
  ctx.save();
  const e = MP(M, -R - PADR, H + PADZ);
  ctx.transform(M.u[0] / KT, M.u[1] / KT, -M.v[0] / KT, -M.v[1] / KT, e[0], e[1]);
  ctx.drawImage(tex, 0, 0);
  ctx.restore();
  const light = o.light ?? 1;
  if (light < 1) { ctx.fillStyle = `rgba(30,40,8,${(1 - light) * 0.8})`; ctx.fill(p); }
  // edge darkening + soft subsurface centre
  const cA = MP(M, (r0 + r1) / 2, H * 0.45), rad = Math.max(su * Math.abs(r1 - r0), sv * H) * 0.62;
  ctx.fillStyle = rgr(ctx, cA[0], cA[1], rad * 0.35, cA[0], cA[1], rad * 1.15, [[0, 'rgba(40,60,10,0)'], [1, 'rgba(40,60,10,0.38)']]); ctx.fill(p);
  ctx.globalCompositeOperation = 'screen';
  const hA = MP(M, lerp(r0, r1, 0.35), H * 0.62);
  ctx.fillStyle = rgr(ctx, hA[0], hA[1], 0, hA[0], hA[1], rad * 0.8, [[0, `rgba(255,250,200,${0.16 * light})`], [1, 'rgba(255,250,200,0)']]); ctx.fill(p);
  ctx.globalCompositeOperation = 'source-over';
  // crust band along the top curve (golden → brown edge) and darker bottom crust
  if (o.crust !== false) {
    const n = 64, top = new Path2D();
    for (let i = 0; i <= n; i++) { const rr = lerp(r0, r1, i / n), q = MP(M, rr, faceTop(o, rr)); i ? top.lineTo(q[0], q[1]) : top.moveTo(q[0], q[1]); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const [d, col] of [[11, 'rgba(226,214,118,0.8)'], [7.5, '#c98a3c'], [4.2, '#a2602a'], [1.8, '#6e3414']]) { ctx.lineWidth = 2 * d * sv; ctx.strokeStyle = col; ctx.stroke(top); }
    const bot = new Path2D(), a = MP(M, r0, 0), b = MP(M, r1, 0); bot.moveTo(a[0], a[1]); bot.lineTo(b[0], b[1]);
    for (const [d, col] of [[6, 'rgba(176,140,60,0.6)'], [3.5, '#8a4a1c'], [1.5, '#5a2a0e']]) { ctx.lineWidth = 2 * d * sv; ctx.strokeStyle = col; ctx.stroke(bot); }
    ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = 1.6 * sv; ctx.strokeStyle = 'rgba(255,220,150,0.55)'; ctx.stroke(top); ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  return p;
}

// ===================================================================================================== wedge-cut cake
function wedgeCake(ctx, x, y, s = 1, o = {}) {
  const ryr = o.ryr ?? 0.42, c = Math.sqrt(1 - ryr * ryr), a0 = o.a0 ?? 0.6, a1 = o.a1 ?? 1.66;
  const P = (rr, th, z) => [rr * Math.cos(th) * s, (rr * Math.sin(th) * ryr - z * c) * s];
  const Mf = (th) => ({ o: [0, 0], u: [Math.cos(th) * s, Math.sin(th) * ryr * s], v: [0, -c * s] });
  const foot = new Path2D(), n = 40;
  for (let i = 0; i <= n; i++) { const rr = (i / n) * R, q = P(rr, a0, hOf(rr)); i ? foot.lineTo(q[0], q[1]) : foot.moveTo(q[0], q[1]); }
  for (let i = 0; i <= 20; i++) { const q = P(R, lerp(a0, a1, i / 20), 0); foot.lineTo(q[0], q[1]); }
  for (let i = n; i >= 0; i--) { const rr = (i / n) * R, q = P(rr, a1, hOf(rr)); foot.lineTo(q[0], q[1]); }
  foot.closePath();
  const lift = o.lift || 0, removed = lift > 0.001 || o.removed;
  ctx.save(); ctx.translate(x, y);
  if (o.shadow !== false) contactShadow(ctx, s, ryr);
  if (removed) {
    ctx.save(); const cl = new Path2D(); cl.rect(-4000, -4000, 8000, 8000); cl.addPath(foot); ctx.clip(cl, 'evenodd'); domeRaw(ctx, s, ryr); ctx.restore();
    // floor sector shadow (plate under the missing wedge)
    face(ctx, Mf(a1), { r0: 0, r1: R, light: 0.86 });
    face(ctx, Mf(a0), { r0: 0, r1: R, light: 1.04 });
  } else {
    domeRaw(ctx, s, ryr);
    const k = o.cut || 0; // slit along a0 (knife has gone through the crust)
    if (k > 0) {
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(60,24,6,0.85)'; ctx.lineWidth = 2.6 * s; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const rr = (i / n) * R * k, q = P(rr, o.cutA ?? a0, hOf(rr)); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke(); ctx.strokeStyle = 'rgba(200,220,110,0.6)'; ctx.lineWidth = 1 * s; ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();
  if (removed && o.piece !== false && lift < 2000) { // the lifted wedge = the dome clipped to the footprint
    const lx = o.liftX || 0;
    ctx.save(); ctx.translate(x + lx, y - lift); ctx.rotate(o.liftRot || 0);
    ctx.save(); ctx.clip(foot); domeRaw(ctx, s, ryr); ctx.restore();
    ctx.restore();
  }
  return { face0: Mf(a0), face1: Mf(a1), foot, P: (rr, th, z) => { const q = P(rr, th, z); return [q[0] + x, q[1] + y]; } };
}

// ===================================================================================================== halves (tear)
function halfXform(x, y, s, o) {
  const side = o.side, piv = [side * R * s * 0.95, 0], ang = side * (o.roll || 0), ca = Math.cos(ang), sa = Math.sin(ang);
  const ph = o.phi || 0, ryr = o.ryr ?? 0.42, tx = x + (o.dx || 0) + side * R * Math.sin(ph) * s, ty = y + (o.dy || 0) - R * (1 - Math.cos(ph)) * ryr * s;
  const fn = (p) => { const px = p[0] - piv[0], py = p[1]; return [tx + piv[0] + px * ca - py * sa, ty + px * sa + py * ca]; };
  return { tx, ty, piv, ang, fn };
}
function halfM(s, o) {
  const ryr = o.ryr ?? 0.42, c = Math.sqrt(1 - ryr * ryr), phi = o.phi || 0;
  return { o: [0, 0], u: [o.side * Math.sin(phi) * s, Math.cos(phi) * ryr * s], v: [0, -c * s] };
}
function half(ctx, x, y, s, o) {
  const side = o.side, ryr = o.ryr ?? 0.42, X = halfXform(x, y, s, o), M = halfM(s, o);
  ctx.save(); ctx.translate(X.tx, X.ty); ctx.translate(X.piv[0], 0); ctx.rotate(X.ang); ctx.translate(-X.piv[0], 0);
  if (o.shadow !== false) { ctx.save(); ctx.translate(side * R * s * 0.45, 0); ctx.scale(0.62, 1); contactShadow(ctx, s, ryr, 0.5 * (o.shadowA ?? 1)); ctx.restore(); }
  // crust: dome clipped to the outer side of the torn face's top curve
  const B = 6000, cp = new Path2D(), far = MP(M, -R, 0), nr = MP(M, R, 0);
  cp.moveTo(side * B, -B); cp.lineTo(far[0], -B); cp.lineTo(far[0], far[1]);
  for (let i = 0; i <= 64; i++) { const rr = lerp(-R, R, i / 64), q = MP(M, rr, faceTop({ torn: 1, seed: o.seed || 1 }, rr)); cp.lineTo(q[0], q[1]); }
  cp.lineTo(nr[0], nr[1]); cp.lineTo(nr[0], B); cp.lineTo(side * B, B); cp.closePath();
  ctx.save(); ctx.clip(cp); ctx.transform(o.sx ?? 1, 0, 0, o.sy ?? 1, 0, 0); domeRaw(ctx, s, ryr); ctx.restore();
  if ((o.phi || 0) > 0.015) face(ctx, M, { torn: 1, seed: o.seed || 1, light: 0.82 + 0.25 * clamp(o.phi / 0.9) });
  ctx.restore();
  return (rr, z) => X.fn(MP(M, rr, z));
}

// ===================================================================================================== strands
function strandPts(a, b, sag, n, wob, t, seed) {
  const pts = [], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (let i = 0; i <= n; i++) {
    const u = i / n, bu = 4 * u * (1 - u);
    const w = wob ? Math.sin(u * PI) * wob * Math.sin(t * 11 + seed * 3 + u * 5) : 0;
    pts.push([a[0] + dx * u + nx * w, a[1] + dy * u + ny * w + sag * bu * (1 - 0.12 * Math.sin(u * PI * 2))]);
  }
  return pts;
}
function ribbon(ctx, pts, wf) {
  const n = pts.length - 1, Lp = [], Rp = [];
  for (let i = 0; i <= n; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n, i + 1)], dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy) || 1, w = wf(i / n) / 2;
    Lp.push([pts[i][0] - dy / d * w, pts[i][1] + dx / d * w]); Rp.push([pts[i][0] + dy / d * w, pts[i][1] - dx / d * w]);
  }
  ctx.beginPath(); Lp.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); for (let i = n; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]); ctx.closePath();
  return { Lp, Rp };
}
function strand(ctx, a, b, o = {}) {
  const w0 = o.w0 ?? 10, wm = Math.max(0.6, o.w ?? 3), sag = o.sag ?? 20, al = o.alpha ?? 1, n = o.n ?? 26, t = o.t || 0, seed = o.seed || 0;
  const pts = strandPts(a, b, sag, n, o.wob || 0, t, seed);
  const wf = (u) => { const e = Math.pow(Math.abs(2 * u - 1), 6); return lerp(wm, w0, e) * (1 + 0.18 * Math.sin(u * 23 + seed)); };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // glow
  if ((o.glow ?? 1) > 0) {
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = al * 0.35 * (o.glow ?? 1);
    ctx.strokeStyle = 'rgba(210,245,150,0.5)'; ctx.lineWidth = wm * 3 + 4; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = al;
  const { Lp } = ribbon(ctx, pts, wf);
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  ctx.fillStyle = lgr(ctx, a[0] - dy / d * wm, a[1] + dx / d * wm, a[0] + dy / d * wm, a[1] - dx / d * wm, [[0, 'rgba(120,170,50,0.92)'], [0.5, 'rgba(184,224,104,0.86)'], [1, 'rgba(226,246,160,0.92)']]);
  ctx.fill();
  // highlight along the upper side
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = `rgba(255,255,225,${0.75})`; ctx.lineWidth = Math.max(0.6, wm * 0.32);
  ctx.beginPath(); for (let i = 1; i < n; i++) { const u = i / n, q = pts[i], k = wf(u) * 0.22; const ny = -1; i === 1 ? ctx.moveTo(q[0], q[1] + ny * k) : ctx.lineTo(q[0], q[1] + ny * k); } ctx.stroke();
  // beads (Plateau-Rayleigh droplets on thin threads)
  if (wm < 4 && (o.beads ?? 1) > 0) {
    const r = rng(seed * 31 + 7), nb = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nb; i++) {
      const u = 0.2 + r() * 0.6, q = pts[Math.round(u * n)], br = wm * (1.1 + r() * 0.8);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(190,230,110,0.85)'; ell(ctx, q[0], q[1], br, br * 1.15); ctx.fill();
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,255,230,0.9)'; ell(ctx, q[0] - br * 0.3, q[1] - br * 0.35, br * 0.35, br * 0.3); ctx.fill();
    }
  }
  ctx.restore();
  return pts;
}
// snapped strand hanging from a, curling down; len in px
function tail(ctx, a, dir, len, o = {}) {
  if (len < 1) return;
  const t = o.t || 0, seed = o.seed || 0, w0 = o.w0 ?? 8, droop = o.droop ?? 1, al = o.alpha ?? 1, n = 14, pts = [];
  let x = a[0], y = a[1], ang = dir;
  for (let i = 0; i <= n; i++) {
    pts.push([x, y]);
    const tgt = PI / 2; ang += (tgt - ang) * 0.16 * droop + Math.sin(t * 7 + seed + i * 0.6) * 0.05;
    x += Math.cos(ang) * len / n; y += Math.sin(ang) * len / n;
  }
  const wf = (u) => lerp(w0, Math.max(0.8, w0 * 0.2), Math.pow(u, 0.6)) * (u > 0.85 ? 1 + (u - 0.85) * 4 : 1);
  ctx.save(); ctx.globalAlpha = al;
  ribbon(ctx, pts, wf); ctx.fillStyle = 'rgba(176,218,98,0.88)'; ctx.fill();
  const e = pts[n]; ctx.fillStyle = 'rgba(190,230,110,0.9)'; ell(ctx, e[0], e[1], wf(1) * 0.7, wf(1) * 0.85); ctx.fill();
  ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,255,225,0.7)'; ctx.lineWidth = Math.max(0.6, w0 * 0.18); ctx.lineCap = 'round';
  ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0] - 1, q[1] - 1) : ctx.moveTo(q[0] - 1, q[1] - 1)); ctx.stroke();
  ctx.restore();
}

// web of strands between two halves. o.state(t) → {sep, phi, roll, dy, lift}
const STRANDS = {};
function strandSet(seed, n) {
  const key = seed + ':' + n; if (STRANDS[key]) return STRANDS[key];
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const rr = (r() * 2 - 1) * R * 0.86, hz = hOf(rr), z = (0.12 + r() * 0.72) * hz;
    out.push({ rL: rr, zL: z, rR: clamp(rr + (r() - 0.5) * 40, -R * 0.9, R * 0.9), zR: z + (r() - 0.5) * 22, w0: 5 + r() * 13, max: 45 + Math.pow(r(), 0.9) * 420, seed: r() * 100, sag: 0.4 + r() * 0.8 });
  }
  out.sort((a, b) => a.max - b.max);
  STRANDS[key] = out; return out;
}
function tear(ctx, x, y, s, o = {}) {
  const t = o.t || 0, ryr = o.ryr ?? 0.42, st = o.state, S = st(t), n = o.n ?? 26, set = strandSet(o.seed ?? 5, n);
  const hero = o.hero ?? (n - 1);
  if (o.hero !== undefined) set[hero].max = 1e9;
  const mk = (S2) => ({
    L: (rr, z) => halfXform(x, y, s, { side: -1, ryr, phi: S2.phi, dx: -S2.sep * s / 2, dy: S2.dy || 0, roll: S2.roll || 0 }).fn(MP(halfM(s, { side: -1, ryr, phi: S2.phi }), rr, z)),
    R: (rr, z) => halfXform(x, y, s, { side: 1, ryr, phi: S2.phi, dx: S2.sep * s / 2, dy: S2.dyR ?? S2.dy ?? 0, roll: S2.roll || 0 }).fn(MP(halfM(s, { side: 1, ryr, phi: S2.phi }), rr, z)),
  });
  const behind = o.behind; // optional fn drawn between halves and strands (e.g. hands)
  const AL = half(ctx, x, y, s, { side: -1, ryr, phi: S.phi, dx: -S.sep * s / 2, dy: S.dy || 0, roll: S.roll || 0, seed: 3, shadowA: o.shadowA });
  const AR = half(ctx, x, y, s, { side: 1, ryr, phi: S.phi, dx: S.sep * s / 2, dy: S.dyR ?? S.dy ?? 0, roll: S.roll || 0, seed: 7, shadowA: o.shadowA });
  if (behind) behind(AL, AR);
  const ret = { L: AL, R: AR, hero: null };
  // snap detection by looking back in time
  const lenAt = (q, tt) => { const S2 = st(tt), m = mk(S2), a = m.L(q.rL, q.zL), b = m.R(q.rR, q.zR); return Math.hypot(b[0] - a[0], b[1] - a[1]) / s; };
  ctx.save();
  for (let i = 0; i < n; i++) {
    const q = set[i]; if (o.heroOnly && i !== hero) continue;
    if (S.sep < 1.5) continue;
    const a = AL(q.rL, q.zL), b = AR(q.rR, q.zR), len = Math.hypot(b[0] - a[0], b[1] - a[1]) / s;
    let snapT = null;
    if (i === hero && o.heroSnap !== undefined && t >= o.heroSnap) snapT = o.heroSnap;
    else if (len > q.max) { // find when it crossed (scan back up to 3 s)
      let lo = t - 3, hi = t; if (lenAt(q, lo) > q.max) snapT = lo; else { for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (lenAt(q, m) > q.max) hi = m; else lo = m; } snapT = hi; }
    }
    const thin = Math.sqrt(10 / Math.max(10, len)), wm = Math.max(0.7, q.w0 * thin * 0.55 * (o.thick ?? 1)) * s, w0 = q.w0 * s * 0.9 * (o.thick ?? 1);
    if (snapT === null) {
      const sag = (8 + len * 0.16 * q.sag) * s * (o.sagK ?? 1);
      strand(ctx, a, b, { w0, w: wm, sag, t, seed: q.seed, wob: (o.wob ?? 1) * clamp(len / 300) * 2.5 * s, glow: o.glow ?? 1, alpha: o.alpha ?? 1 });
      if (i === hero) ret.hero = { a, b, alive: true, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag], len };
    } else {
      const age = t - snapT, Ls = q.max * s, rec = Math.exp(-age * 3.2), dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const tl = Math.min(Ls * 0.32 * rec, (o.tailMax ?? 60) * s) + 7 * s;
      if (i === hero && o.heroNoTail) { ret.hero = { a, b, alive: false, age }; continue; }
      tail(ctx, a, dir + Math.sin(age * 14) * 0.5 * rec, tl, { w0: w0 * 0.8, t, seed: q.seed, droop: 0.6 + 0.4 * (1 - rec), alpha: 0.55 + 0.45 * rec });
      tail(ctx, b, dir + PI - Math.sin(age * 14) * 0.5 * rec, tl * 0.9, { w0: w0 * 0.8, t, seed: q.seed + 5, droop: 0.6 + 0.4 * (1 - rec), alpha: 0.55 + 0.45 * rec });
      if (i === hero) ret.hero = { a, b, alive: false, age };
    }
  }
  ctx.restore();
  return ret;
}

// ===================================================================================================== torn piece (hand-sized)
function piecePath(seed) {
  const r = rng(seed), pts = [];
  for (let i = 0; i <= 14; i++) { const a = PI + (i / 14) * PI; pts.push([Math.cos(a) * 112 * (1 + (r() - 0.5) * 0.03), Math.sin(a) * 88 * (1 + (r() - 0.5) * 0.04) + 6]); }
  for (let i = 1; i < 16; i++) { const a = (i / 16) * PI, j = 1 + (r() - 0.5) * 0.22; pts.push([Math.cos(a) * 112 * j, Math.sin(a) * 62 * j + 6 + (r() - 0.5) * 8]); }
  return pts;
}
function piece(ctx, x, y, s = 1, rot = 0, o = {}) {
  const seed = o.seed ?? 4, pts = piecePath(seed), bite = clamp(o.bite || 0), t = o.t || 0;
  const r = rng(seed + 1), bx = 120, by = -26, br = 74 * bite;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const path = new Path2D(); pts.forEach((q, i) => i ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1])); path.closePath();
  const biteP = new Path2D(); for (let i = 0; i <= 72; i++) { const a = (i / 72) * TAU, rr = br * (1 + 0.05 * Math.abs(Math.sin(a * 7))); i ? biteP.lineTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr) : biteP.moveTo(bx + Math.cos(a) * rr, by + Math.sin(a) * rr); } biteP.closePath();
  ctx.save();
  if (bite > 0) { const sh = new Path2D(); sh.rect(-500, -500, 1000, 1000); sh.addPath(biteP); ctx.clip(sh, 'evenodd'); }
  // soft drop shadow of the chunk on itself is skipped; body
  ctx.save(); ctx.clip(path);
  const tex = honeyTex(true), u0 = -60, z0 = H * 0.18, uw = 125, zh = 105;
  const [sx0, sy0] = t2px(u0, z0 + zh);
  ctx.drawImage(tex, sx0, sy0, uw * KT, zh * KT, -118, -86, 236, 186);
  ctx.fillStyle = rgr(ctx, -10, -5, 30, 0, 0, 135, [[0, 'rgba(40,60,10,0)'], [1, 'rgba(40,60,10,0.5)']]); ctx.fillRect(-140, -120, 280, 240);
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, -40, -20, 0, -40, -20, 110, [[0, 'rgba(255,250,200,0.2)'], [1, 'rgba(255,250,200,0)']]); ctx.fillRect(-140, -120, 280, 240); ctx.globalCompositeOperation = 'source-over';
  // crust band along the top edge
  const topP = new Path2D(); for (let i = 0; i <= 14; i++) i ? topP.lineTo(pts[i][0], pts[i][1]) : topP.moveTo(pts[i][0], pts[i][1]);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [w, c] of [[46, 'rgba(214,214,110,0.6)'], [40, 'rgba(222,190,90,0.9)'], [34, '#d29a44'], [28, '#c4802f'], [21, '#ae6426'], [13, '#8c4a1a'], [6, '#5e2a0c']]) { ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(topP); }
  for (let i = 0; i < 50; i++) { const k = Math.floor(r() * 14), q = pts[k]; ctx.fillStyle = 'rgba(80,30,8,' + (0.3 + r() * 0.3) + ')'; ell(ctx, q[0] * 0.95, q[1] * 0.93 + 4, 1 + r() * 2, 0.8 + r()); ctx.fill(); }
  ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,225,160,0.6)'; ctx.stroke(topP); ctx.globalCompositeOperation = 'source-over';
  if (bite > 0) { ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(226,246,166,0.55)'; ctx.stroke(biteP); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(90,130,40,0.5)'; ctx.stroke(biteP); }
  ctx.restore();
  ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,214,150,0.4)'; ctx.lineWidth = 3; ctx.stroke(path); ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  if ((o.strands ?? 1) > 0) for (let i = 0; i < 4; i++) { const q = pts[17 + i * 3]; tail(ctx, [q[0] * 0.92, q[1] * 0.92], PI / 2 + (r() - 0.5) * 0.6, (16 + r() * 28) * (o.strands ?? 1), { w0: 5, t, seed: i + seed, droop: 1 }); }
  ctx.restore();
  const c = Math.cos(rot), n = Math.sin(rot);
  const mx = bite > 0 ? bx - br * 0.95 : bx, my = bite > 0 ? by + br * 0.12 : by;
  return { mouth: [x + (mx * c - my * n) * s, y + (mx * n + my * c) * s] };
}

// ===================================================================================================== slice on its side
function slice(ctx, x, y, s = 1, rot = 0, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const M = { o: [0, 0], u: [s, 0], v: [0, -s] };
  ctx.fillStyle = 'rgba(30,12,4,0.35)'; ell(ctx, R * s * 0.5, 6 * s, R * s * 0.6, 14 * s); ctx.fill();
  face(ctx, M, { r0: 0, r1: R, light: 1.05 });
  ctx.restore();
}

// ===================================================================================================== mould (khuôn) + plate
function mould(ctx, x, y, s = 1, o = {}) {
  const ryr = o.ryr ?? 0.45, ar = Math.abs(ryr), up = ryr >= 0, c = Math.sqrt(1 - Math.min(0.999, ar * ar)), Rr = 300, Rb = 262, D = 170 * (o.depth ?? 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const flute = (rad, k) => { const p = new Path2D(); for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU, rr = rad * (1 + k * Math.cos(a * 16)); i ? p.lineTo(rr * Math.cos(a), rr * Math.sin(a) * ar) : p.moveTo(rr * Math.cos(a), rr * Math.sin(a) * ar); } p.closePath(); return p; };
  const metal = (x0, x1) => lgr(ctx, x0, 0, x1, 0, [[0, '#7a6a5c'], [0.18, '#f2e6d6'], [0.34, '#b0a294'], [0.55, '#dccdbc'], [0.8, '#86786a'], [1, '#4f453d']]);
  if (up) { // rim at y=0, bottom (hidden) at depth below; we see the outer wall going down
    ctx.fillStyle = metal(-Rr, Rr);
    ctx.beginPath(); ctx.moveTo(-Rr, 0); ctx.lineTo(-Rb, D * c); ctx.ellipse(0, D * c, Rb, Rb * ar, 0, PI, 0, true); ctx.lineTo(Rr, 0); ctx.ellipse(0, 0, Rr, Rr * ar, 0, 0, PI); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 32; i++) { const a0 = PI * i / 32, a1 = PI * (i + 1) / 32, ca = Math.cos(a0), cb = Math.cos(a1), sa = Math.sin(a0), sb = Math.sin(a1); ctx.beginPath(); ctx.moveTo(Rr * ca, sa * Rr * ar); ctx.lineTo(Rr * cb, sb * Rr * ar); ctx.lineTo(Rb * cb, D * c + sb * Rb * ar); ctx.lineTo(Rb * ca, D * c + sa * Rb * ar); ctx.closePath(); ctx.fillStyle = i % 2 ? 'rgba(255,250,240,0.16)' : 'rgba(40,30,25,0.16)'; ctx.fill(); }
    ctx.fillStyle = metal(-Rr, Rr); ctx.fill(flute(Rr + 14, 0.012));
    ctx.fillStyle = '#5a554f'; ctx.fill(flute(Rr - 2, 0.012));
    if (o.cake !== false) { // golden cake top inside
      const cr = Rr - 14;
      ctx.save(); ctx.clip(flute(cr, 0.01));
      ctx.fillStyle = rgr(ctx, -cr * 0.3, -cr * ar * 0.4, 10, 0, 0, cr, [[0, '#e3a650'], [0.55, '#c47c33'], [1, '#7c4018']]); ctx.fillRect(-cr, -cr, cr * 2, cr * 2);
      const r = rng(55);
      for (let i = 0; i < 400; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * cr; ctx.fillStyle = `rgba(80,30,8,${0.2 + r() * 0.3})`; ell(ctx, rr * Math.cos(a), rr * Math.sin(a) * ar, 1 + r() * 2.2, (1 + r() * 1.5) * ar); ctx.fill(); }
      for (let i = 0; i < 18; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * cr * 0.9, sz = 12 + r() * 30; ctx.fillStyle = rgr(ctx, rr * Math.cos(a), rr * Math.sin(a) * ar, 0, rr * Math.cos(a), rr * Math.sin(a) * ar, sz, [[0, 'rgba(110,45,12,0.3)'], [1, 'rgba(110,45,12,0)']]); ctx.fillRect(rr * Math.cos(a) - sz, rr * Math.sin(a) * ar - sz, sz * 2, sz * 2); }
      // crack ring
      ctx.strokeStyle = '#cfd06a'; ctx.lineWidth = 9; ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * TAU, rr = cr * 0.42 + Math.sin(a * 5) * 5; i ? ctx.lineTo(rr * Math.cos(a), rr * Math.sin(a) * ar) : ctx.moveTo(rr * Math.cos(a), rr * Math.sin(a) * ar); } ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,26,6,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, -cr * 0.35, -cr * ar * 0.35, 0, -cr * 0.35, -cr * ar * 0.35, cr * 0.6, [[0, 'rgba(255,230,170,0.3)'], [1, 'rgba(255,230,170,0)']]); ctx.fillRect(-cr, -cr, cr * 2, cr * 2);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(30,14,6,0.5)'; ctx.lineWidth = 8; ctx.stroke(flute(cr, 0.01)); ctx.restore();
    }
  } else { // upside down: the pan bottom on top (flat disc), wall widening down to the rim on the plate
    const top = -D * c;
    ctx.fillStyle = metal(-Rr, Rr);
    ctx.beginPath(); ctx.moveTo(-Rb, top); ctx.lineTo(-Rr, 0); ctx.ellipse(0, 0, Rr, Rr * ar, 0, PI, 0, true); ctx.lineTo(Rb, top); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 32; i++) { const a0 = PI * i / 32, a1 = PI * (i + 1) / 32, ca = Math.cos(a0), cb = Math.cos(a1), sa = Math.sin(a0), sb = Math.sin(a1); ctx.beginPath(); ctx.moveTo(Rb * ca, top + sa * Rb * ar); ctx.lineTo(Rb * cb, top + sb * Rb * ar); ctx.lineTo(Rr * cb, sb * Rr * ar); ctx.lineTo(Rr * ca, sa * Rr * ar); ctx.closePath(); ctx.fillStyle = i % 2 ? 'rgba(255,250,240,0.16)' : 'rgba(40,30,25,0.16)'; ctx.fill(); }
    ctx.fillStyle = metal(-Rr, Rr); ctx.fill(flute(Rr + 10, 0.012));
    ctx.save(); ctx.translate(0, top);
    ell(ctx, 0, 0, Rb, Rb * ar); ctx.fillStyle = lgr(ctx, -Rb, -Rb * ar, Rb, Rb * ar, [[0, '#f2eee8'], [0.4, '#b9b4ad'], [0.7, '#8f8a84'], [1, '#5e5955']]); ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,45,0.35)'; ctx.lineWidth = 3; for (const k of [0.35, 0.62, 0.86]) { ell(ctx, 0, 0, Rb * k, Rb * k * ar); ctx.stroke(); }
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, -Rb * 0.4, -Rb * ar * 0.3, 0, -Rb * 0.4, -Rb * ar * 0.3, Rb * 0.7, [[0, 'rgba(255,240,220,0.55)'], [1, 'rgba(255,240,220,0)']]); ell(ctx, 0, 0, Rb, Rb * ar); ctx.fill();
    ctx.restore();
  }
  // warm reflections on metal
  ctx.restore();
}
function leafTex() {
  if (CACHE.leaf) return CACHE.leaf;
  const S = 900, [c, x] = cv(S, S), r = rng(19);
  x.translate(S / 2, S / 2);
  // woven bamboo tray (mẹt)
  ell(x, 0, 0, 440, 440); x.fillStyle = '#b68a4a'; x.fill();
  x.save(); x.clip();
  for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) { const v = 0.82 + r() * 0.3, odd = (i + j) & 1; x.fillStyle = `rgb(${(196 * v) | 0},${(150 * v) | 0},${(84 * v) | 0})`; x.fillRect(i * 16 + (odd ? 0 : 1), j * 16, odd ? 15 : 14, odd ? 7 : 15); }
  x.fillStyle = 'rgba(60,30,10,0.25)'; x.fillRect(-450, -450, 900, 900);
  x.restore();
  x.lineWidth = 22; x.strokeStyle = '#8c6430'; ell(x, 0, 0, 430, 430); x.stroke(); x.lineWidth = 6; x.strokeStyle = '#d6aa62'; ell(x, 0, 0, 438, 438); x.stroke();
  // banana leaf (circle with ragged edge, glossy)
  const lp = new Path2D(); for (let i = 0; i <= 120; i++) { const a = (i / 120) * TAU, rr = 372 + Math.sin(a * 9) * 6 + (r() - 0.5) * 8; i ? lp.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : lp.moveTo(rr * Math.cos(a), rr * Math.sin(a)); } lp.closePath();
  x.fillStyle = rgr(x, -80, -120, 30, 0, 0, 380, [[0, '#6fb64a'], [0.6, '#3f8f34'], [1, '#2a6a26']]); x.fill(lp);
  x.save(); x.clip(lp);
  x.strokeStyle = 'rgba(200,240,150,0.22)'; x.lineWidth = 2; for (let i = -40; i <= 40; i++) { x.beginPath(); x.moveTo(-400, i * 10); x.lineTo(400, i * 10 - 60); x.stroke(); }
  x.strokeStyle = 'rgba(20,60,15,0.25)'; x.lineWidth = 1.5; for (let i = -40; i <= 40; i++) { x.beginPath(); x.moveTo(-400, i * 10 + 5); x.lineTo(400, i * 10 - 55); x.stroke(); }
  x.strokeStyle = 'rgba(220,250,170,0.5)'; x.lineWidth = 10; x.beginPath(); x.moveTo(-400, 60); x.lineTo(400, 0); x.stroke();
  x.globalCompositeOperation = 'screen'; x.fillStyle = rgr(x, -150, -170, 0, -150, -170, 260, [[0, 'rgba(255,250,210,0.35)'], [1, 'rgba(255,250,210,0)']]); x.fillRect(-450, -450, 900, 900);
  x.restore();
  CACHE.leaf = c; return c;
}
function leafPlate(ctx, x, y, s = 1, o = {}) {
  const ryr = o.ryr ?? 0.42;
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.scale(1, ryr); ctx.fillStyle = rgr(ctx, 0, 30 * s, 300 * s, 0, 30 * s, 470 * s, [[0, 'rgba(20,8,2,0.5)'], [1, 'rgba(20,8,2,0)']]); ctx.fillRect(-500 * s, -470 * s, 1000 * s, 1000 * s); ctx.restore();
  // tray rim thickness
  ctx.fillStyle = '#6e4a20'; ell(ctx, 0, 10 * s, 440 * s, 440 * s * ryr); ctx.fill();
  ctx.scale(s, s * ryr); ctx.drawImage(leafTex(), -450, -450);
  ctx.restore();
}

// ===================================================================================================== steam
function puffSprite() {
  if (CACHE.puff) return CACHE.puff;
  const [c, x] = cv(128, 128); x.fillStyle = rgr(x, 64, 64, 0, 64, 64, 64, [[0, 'rgba(255,246,232,0.85)'], [0.4, 'rgba(255,246,232,0.42)'], [0.75, 'rgba(255,246,232,0.12)'], [1, 'rgba(255,246,232,0)']]); x.fillRect(0, 0, 128, 128);
  CACHE.puff = c; return c;
}
function cakeSteam(ctx, t, x, y, o = {}) {
  const n = o.n ?? 14, w = o.w ?? 300, h = o.h ?? 600, r0 = o.r ?? 60, a = o.alpha ?? 0.4, sp = o.speed ?? 0.3, r = rng(o.seed ?? 1), spr = puffSprite();
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = r(), s = sp * (0.7 + r() * 0.6), bx = (r() - 0.5) * w, sw = 20 + r() * 50, rr = r0 * (0.6 + r() * 0.8), fq = 0.5 + r() * 0.9;
    const life = ((t * s + ph) % 1 + 1) % 1;
    const yy = y - life * h, xx = x + bx * (1 + life * 0.6) + Math.sin(t * fq + i * 1.7) * sw * life + (o.drift || 0) * life;
    const Rr = rr * (0.6 + life * 1.3);
    ctx.globalAlpha = Math.min(1, 1.9 * a * clamp(life * 6) * Math.pow(1 - life, 1.4));
    ctx.drawImage(spr, xx - Rr * 0.75, yy - Rr * 1.35, 1.5 * Rr, 2.7 * Rr);
  }
  ctx.restore();
}

// ===================================================================================================== soft hand
const SKIN_T = ['#f7d2b5', '#e3a07e', '#c97c5e'];
function capsule(ctx, x0, y0, x1, y1, w0, w1) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + PI / 2, a - PI / 2, true); ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - PI / 2, a + PI / 2, true); ctx.closePath();
}
function shadedCap(ctx, x0, y0, x1, y1, w0, w1, sk, k = 1) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, w = Math.max(w0, w1) / 2;
  capsule(ctx, x0, y0, x1, y1, w0 + 2.2, w1 + 2.2); ctx.fillStyle = 'rgba(120,55,40,0.35)'; ctx.fill();
  capsule(ctx, x0, y0, x1, y1, w0, w1);
  ctx.fillStyle = lgr(ctx, mx - nx * w, my - ny * w, mx + nx * w, my + ny * w, [[0, sk[0]], [0.42, sk[1]], [1, sk[2]]]); ctx.fill();
}
function softHand(ctx, x, y, s = 1, rot = 0, o = {}) {
  const sk = o.skin || SKIN_T, fl = o.flip ? -1 : 1;
  const curl = Array.isArray(o.curl) ? o.curl : [o.curl ?? 0.3, o.curl ?? 0.3, o.curl ?? 0.3, o.curl ?? 0.3];
  const spread = o.spread ?? 0.12, ret = {};
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s * fl);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const armL = o.arm ?? 260;
  // forearm (+ sleeve)
  if (armL > 0 && o.upper) { // [banhbo] bent elbow: upper arm leaves the elbow at local angle o.upper.ang
    const U = o.upper, ex = -armL, ey = 4, ux = ex + Math.cos(U.ang) * U.len, uy = ey + Math.sin(U.ang) * U.len, uw = U.w ?? 92;
    shadedCap(ctx, ux, uy, ex, ey, uw, 80, sk);
    if (U.sleeve) { capsule(ctx, ux, uy, lerp(ux, ex, U.sleeveK ?? 0.4), lerp(uy, ey, U.sleeveK ?? 0.4), uw + 26, uw + 20); ctx.fillStyle = lgr(ctx, ux, uy - 60, ux, uy + 60, [[0, U.sleeve[0]], [0.5, U.sleeve[1]], [1, U.sleeve[2] || U.sleeve[1]]]); ctx.fill(); }
    ctx.fillStyle = rgr(ctx, ex - 6, ey - 10, 0, ex, ey, 46, [[0, 'rgba(255,225,200,0.35)'], [1, 'rgba(255,225,200,0)']]); ell(ctx, ex, ey, 44, 40); ctx.fill();
  }
  if (armL > 0) {
    shadedCap(ctx, -armL, 4, -30, 0, 74, 64, sk);
    if (o.sleeve) { capsule(ctx, -armL - 40, 4, -armL + (o.sleeveLen ?? 120), 4, 104, 98); ctx.fillStyle = lgr(ctx, 0, -52, 0, 52, [[0, o.sleeve[0]], [0.5, o.sleeve[1]], [1, o.sleeve[2] || o.sleeve[1]]]); ctx.fill(); }
  }
  // fingers: index (y-24), middle, ring, pinky (y+30); joints bend toward +y (curling under)
  const F = [[-27, 1.0, 17.5], [-9, 1.1, 18], [9, 1.02, 17], [26, 0.82, 15]];
  const tips = [];
  const drawFinger = (i) => {
    const [fy, ln, fw] = F[i], ang0 = (i - 1.5) * spread * 0.9, cu = curl[i];
    let px = 58, py = fy * 0.9, a = ang0;
    const segs = [40 * ln, 28 * ln, 22 * ln], ws = [fw, fw * 0.9, fw * 0.8];
    for (let k = 0; k < 3; k++) {
      a += cu * [0.55, 0.85, 0.65][k];
      const nx2 = px + Math.cos(a) * segs[k], ny2 = py + Math.sin(a) * segs[k];
      shadedCap(ctx, px, py, nx2, ny2, ws[k], ws[k] * 0.94, sk);
      // knuckle crease
      if (k < 2) { ctx.strokeStyle = 'rgba(140,70,50,0.35)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(nx2, ny2, ws[k] * 0.32, a - PI / 2 - 0.6, a - PI / 2 + 0.6); ctx.stroke(); }
      if (k === 2 && o.nails !== false) { // nail
        const nxm = lerp(px, nx2, 0.62), nym = lerp(py, ny2, 0.62);
        ctx.save(); ctx.translate(nxm, nym); ctx.rotate(a);
        ctx.beginPath(); ctx.roundRect(-segs[k] * 0.32, -ws[k] * 0.32, segs[k] * 0.62, ws[k] * 0.64, ws[k] * 0.3); ctx.fillStyle = 'rgba(248,206,190,0.7)'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-segs[k] * 0.2, -ws[k] * 0.2, segs[k] * 0.3, ws[k] * 0.12);
        ctx.restore();
      }
      px = nx2; py = ny2;
    }
    tips[i] = [px, py];
  };
  // palm / back of hand
  const thumbAng = o.thumb ?? -0.9, tl = o.thumbLen ?? 1;
  const drawThumb = () => {
    let px = 6, py = -24, a = thumbAng; const segs = [44 * tl, 32 * tl], ws = [26, 21];
    // thenar bulge joining the thumb to the hand
    ctx.beginPath(); ctx.moveTo(-30, -26); ctx.quadraticCurveTo(px + Math.cos(a) * 30 - 10, py + Math.sin(a) * 30, px + Math.cos(a) * 34 + Math.cos(a + PI / 2) * 11, py + Math.sin(a) * 34 + Math.sin(a + PI / 2) * 11); ctx.lineTo(40, -20); ctx.closePath(); ctx.fillStyle = sk[1]; ctx.fill();
    for (let k = 0; k < 2; k++) { const nx2 = px + Math.cos(a) * segs[k], ny2 = py + Math.sin(a) * segs[k]; shadedCap(ctx, px, py, nx2, ny2, ws[k], ws[k] * 0.9, sk); px = nx2; py = ny2; a += (o.thumbCurl ?? 0.25); }
    if (o.nails !== false) { ctx.save(); ctx.translate(px - Math.cos(a) * 8, py - Math.sin(a) * 8); ctx.rotate(a); ctx.beginPath(); ctx.roundRect(-9, -7, 15, 14, 6); ctx.fillStyle = 'rgba(248,206,190,0.75)'; ctx.fill(); ctx.restore(); }
    ret.thumb = [px, py];
  };
  if (o.thumbBehind) drawThumb();
  for (let i = 3; i >= 0; i--) drawFinger(i);
  // back of hand plate (over finger roots)
  ctx.beginPath(); ctx.moveTo(-34, -32); ctx.bezierCurveTo(10, -40, 50, -40, 66, -30); ctx.quadraticCurveTo(74, 0, 64, 34); ctx.bezierCurveTo(40, 40, 0, 40, -34, 30); ctx.quadraticCurveTo(-44, 0, -34, -32); ctx.closePath();
  ctx.save(); ctx.fillStyle = 'rgba(120,55,40,0.3)'; ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(120,55,40,0.3)'; ctx.stroke(); ctx.restore();
  ctx.fillStyle = lgr(ctx, 0, -40, 0, 40, [[0, sk[0]], [0.45, sk[1]], [1, sk[2]]]); ctx.fill();
  // knuckle bumps + tendons
  for (let i = 0; i < 4; i++) { const ky = F[i][0] * 0.9; ctx.fillStyle = rgr(ctx, 56, ky - 4, 0, 56, ky - 4, 12, [[0, 'rgba(255,232,214,0.35)'], [1, 'rgba(255,232,214,0)']]); ctx.fillRect(40, ky - 18, 32, 28); }
  if (!o.thumbBehind) drawThumb();
  // rim light (back light)
  ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,140,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-armL * 0.8, -30); ctx.lineTo(-34, -33); ctx.bezierCurveTo(10, -41, 50, -41, 66, -31); ctx.stroke();
  ctx.restore();
  const mapP = (p) => { const c = Math.cos(rot), n = Math.sin(rot), px = p[0] * s, py = p[1] * s * fl; return [x + px * c - py * n, y + px * n + py * c]; };
  ret.tip = mapP(tips[0]); ret.tips = tips.map(mapP); if (ret.thumb) ret.thumb = mapP(ret.thumb);
  return ret;
}

module.exports = { CAKE, hOf, rOf, dome, domeSprite, wedgeCake, face, half, tear, strand, tail, piece, slice, mould, leafPlate, cakeSteam, softHand, honeyTex, puffSprite, contactShadow, MP };
