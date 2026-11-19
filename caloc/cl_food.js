// cl_food.js — "Cá lóc nướng trui" food & props (snakehead, bamboo skewer, straw, lotus-leaf spread, rolls, basket, trap).
// LOCAL in / LOCAL out: (x,y) are in the CURRENT ctx space; returned anchors are in that same space.
// THIS HEADER IS THE SOURCE OF TRUTH for the API.   const CL = require('./clprops');  (re-exports everything below)
// =====================================================================================================================
// CONVENTIONS
//  • Every drawer save()/restore()s and is deterministic from o.t / o.seed / k.  s = uniform scale; sizes are at s = 1.
//  • Night-friendly: o.rim (moon rim, cool blue-white, default on for the fish) and o.rimFire (orange belly rim) let the
//    shot match the moon/fire lighting; the shot adds fireLight/grade on top.
//  • Big sprites (tray, lotus leaf, bún coil, weave tiles) are cached at module load (lazy, once).
//  • Timings (this PC, flushed, s=1): snakehead alive ≈ 4.2 ms · charred ≈ 5.2 ms · scraped ≈ 5.6 ms · strawPile full
//    unburnt ≈ 0.5 ms (cached sprite) / burning ≈ 15 ms at s1, ≈ 11 ms at s.6 / ash ≈ 2 ms · lotusSpread ≈ 13 ms ·
//    ricePaperRoll ≈ 3.5 ms · fishBasket ≈ 5 ms · nomTrap ≈ 4.3 ms (see _test_cl_foodfx.js).
//
// ------------------------------------------------------------------------------------------------- SNAKEHEAD (cá lóc)
//  snakehead(ctx,x,y,s,o) → anchors {center, mouth, tail, eye, belly, back, skewerA (mouth end), skewerB (tail end), len}
//     origin = body centre; length ≈ 520 px at s=1 (snout → tail tip), body height ≈ 128, head points +x (o.flip → −x).
//     o.rot (rad) rotates the whole fish: rot = π/2 → head DOWN / tail up (upright on the skewer in the straw pile),
//       rot = −π/2 → head up.  o.bend −1..1 curls the body (+ = tail curls toward the belly side… try ±0.4).
//     o.state:
//       'alive'    (default) wet shine. o.wiggle 0..1 = S-curve swim/thrash animated by o.t (1 = violent thrash, s3/s16),
//                  o.mouth 0..1 open, o.eye 'normal'|'sly'|'angry'|'dizzy'.
//       'skewered' straight fish with a bamboo skewer mouth→tail. o.skewer = length past each end (default 130), or
//                  o.skewerA (past the mouth) / o.skewerB (past the tail; negative = tip still inside → for the s6 pushes).
//       'charred'  black crusty skin, flickering ember cracks, cooked eye, smoke wisps (o.smoke 0..1, default 1).
//       'scraped'  o.k 0..1 = how much black skin is scraped off (head→tail), revealing snow-white flaky flesh with a
//                  ragged dark boundary + char flakes; steam (o.steam 0..1, default 1). k≈.15 per scrape stroke.
//       'plated'   fully scraped, lying on the leaf, flesh opened along a seam with loose flakes; steam.
//     The skewer is also drawn for charred/scraped if o.skewer is given (s10/s11 keep it on the stick).
//     o.wet (default 1 when alive), o.rim (0..1, default .9), o.rimFire (0..1), o.seed, o.t.
//     Upright in a straw pile: snakehead(ctx, gx, gy - 300*s, s, {rot: PI/2, state:'skewered', skewerA: 140}) →
//       the mouth-side skewer end sits at the ground point.
//  bambooSkewer(ctx,x0,y0,x1,y1,{w=14, char=0..1, point=true (sharp end at x1,y1), seed}) split bamboo stick with nodes.
//
// ------------------------------------------------------------------------------------------------- STRAW (rơm)
//  strawPile(ctx,x,y,s,{t, k=1 build-up, burn=0, seed=31}) → {top:[x,y], h, r}
//     origin = ground centre. Cone ≈ 760 tall, base half-width ≈ 318 (fits around the upright fish; the SHOT draws the fish
//     BEFORE the pile). k: 0 none → .5 lower half → 1 full cone (strands reveal bottom-up; two armfuls ≈ k .55 then 1).
//     burn: 0 golden → .3 strands igniting (ember strands) → .6 blackened with glowing ember lines → 1 grey ash mound +
//     glowing embers (fish stays standing in the ashes). Pair with CL.strawFire at the same origin.
//     560 strands over a lumpy dark silhouette; partial k gets a wavy dome top. k≥.985 & burn 0 & s≤1.05 draws a cached
//     sprite (static, t ignored). o.live=true forces live drawing.
//  strawArmful(ctx,x,y,s,{t, seed, rot}) → {left,right,center}   horizontal tied bundle ≈ 480×150 (anchors left/right at ±190), origin = centre.
//  strawScraps(ctx,x0,y0,w,h,seed,{alpha}) loose straw scattered on the ground inside a rect.
//
// ------------------------------------------------------------------------------------------------- SPREAD
//  lotusSpread(ctx,x,y,s,{k=1, t, fish:true, steam=1, view:'top'|'angle', ryr (angle squash, default .52), saltK (lime on
//     the salt 0..1)}) → anchors {fish, herbs, flowers, paper, bun, slices, salt} (+ fishA = the fish anchors)
//     woven tray R≈430 + lotus leaf R≈390, origin = tray centre. Items pop in with k in this order (each ≈ .15 of k):
//     fish (drops in) · herbs bundle (xà lách, húng, diếp cá, rau muống) · yellow điên điển flowers · rice-paper stack ·
//     bún coil · cucumber + green star-fruit slices · chili-salt dish.  k 0→1 over 6 beats in s12 = one item per beat.
//  chiliSalt(ctx,x,y,s,{k lime juice 0..1, t, view:'3q'|'top'}) → {center, rim, rx, ry}   dish R=90 (ryr .45 in '3q').
//  lime(ctx,x,y,s,{squeeze 0..1, half=true (cut face down), rot}) → {drip, center}   R≈55.
//  limeDrops(ctx,from,to,k,{n=6, s=1}) juice drops falling from→to ([x,y] points), staggered over k, ring on landing.
//  ricePaperRoll(ctx,x,y,s,{stage:'flat'|'filled'|'rolled'|'bitten', k, rot, dip 0..1, wet=.85, t, seed, steam})
//     → {center, tipA (−x end), tipB (+x end), bite}
//     origin = paper centre (flat R=170). 'filled' k: herbs → fish flakes → bún appear on the lower band (y 35..95).
//     'rolled' k: 0–.3 bottom flap folds up · .3–.5 sides fold in · .5–1 rolls up into a 280×84 translucent capsule
//     ending centred on the origin (horizontal; o.rot to tilt).  'bitten': capsule with a scalloped bite at the +x end,
//     cross-section and a puff of steam.  o.dip coats the +x tip with chili salt.
//
// ------------------------------------------------------------------------------------------------- PROPS
//  fishBasket(ctx,x,y,s,{t, fish:0|1|2 tails poking out (alive, flapping), open=1 (lid off; <1 lid closing), strap})
//     → {mouth, bottom, neck}   woven giỏ, gourd shape, front view. origin = bottom centre, ≈ 276 wide × 252 tall.
//  nomTrap(ctx,x,y,s,{t, k=0 submerged fraction (0 in air … 1 fully under), inside(ctx) callback drawn between the back
//     and front slats (e.g. a thrashing fish), alpha}) → {top, base, waterline, rx}
//     bell-shaped open-weave bamboo cone, hand hole at the top. origin = base centre; 420 tall, base rx 210 (ryr .29).
//  extras: herbsBundle(ctx,x,y,s,rot) · dienDien(ctx,x,y,s,seed) · bunCoil(ctx,x,y,s) · cucumberSlice(ctx,x,y,s,rot) ·
//     starSlice(ctx,x,y,s,rot) · rauMuong(ctx,x,y,s,rot)
// =====================================================================================================================
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const BX = require('./bx_food');
const BFX = require('./bx_fx');
const FX = require('./cl_fx');
const { createCanvas, Path2D } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease } = L;
const PI = Math.PI;
const { lgr, rgr, ell, mixc } = NP;

function mapper(x, y, rot, s, sx = 1) { const c = Math.cos(rot), sn = Math.sin(rot); return (px, py) => { const X = px * s * sx, Y = py * s; return [x + X * c - Y * sn, y + X * sn + Y * c]; }; }
const smooth = (f) => f * f * (3 - 2 * f);

// ================================================================================================= BAMBOO SKEWER
function bambooSkewer(ctx, x0, y0, x1, y1, o = {}) {
  const w = o.w ?? 14, Lk = Math.hypot(x1 - x0, y1 - y0); if (Lk < 2) return;
  const ch = clamp(o.char || 0), pt = o.point !== false, tipL = pt ? Math.min(Lk * 0.4, w * 2.8) : 0;
  const r = rng(o.seed ?? 4);
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0)); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.lineTo(Lk - tipL, -w / 2); if (pt) { ctx.lineTo(Lk, w * 0.18); ctx.lineTo(Lk - tipL * 0.25, w / 2); } else ctx.lineTo(Lk, w / 2); ctx.lineTo(0, w / 2); ctx.closePath(); };
  path();
  ctx.fillStyle = lgr(ctx, 0, -w / 2, 0, w / 2, [[0, mixc('#f2dfa8', '#3a2618', ch)], [0.45, mixc('#d2b06a', '#2a1a10', ch)], [1, mixc('#8a6630', '#160e08', ch)]]); ctx.fill();
  ctx.save(); path(); ctx.clip();
  ctx.fillStyle = mixc('#8fa64c', '#1e160e', ch); ctx.fillRect(0, -w / 2, Lk, w * 0.24);
  ctx.strokeStyle = `rgba(110,80,35,${0.35 * (1 - ch)})`; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) { const yy = -w * 0.15 + i * w * 0.2; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(Lk, yy + (r() - 0.5) * 2); ctx.stroke(); }
  for (let nx = 70 + r() * 60; nx < Lk - tipL - 10; nx += 140 + r() * 30) {
    ctx.fillStyle = mixc('#7a5424', '#0e0805', ch); ctx.fillRect(nx - 2.5, -w / 2, 5, w);
    ctx.fillStyle = `rgba(255,240,200,${0.5 * (1 - ch)})`; ctx.fillRect(nx + 2.5, -w / 2, 2, w);
  }
  if (ch > 0) { for (let i = 0; i < Lk / 25; i++) { ctx.fillStyle = `rgba(10,6,4,${0.6 * ch})`; ell(ctx, r() * Lk, (r() - 0.5) * w, 6 + r() * 14, w * 0.3); ctx.fill(); } }
  ctx.restore();
  path(); ctx.strokeStyle = 'rgba(40,25,10,0.75)'; ctx.lineWidth = 1.8; ctx.stroke();
  ctx.restore();
}

// ================================================================================================= SNAKEHEAD
const FL = 520, SEG = 48;
const WPROF = [[0, 30], [0.04, 48], [0.1, 58], [0.2, 63], [0.35, 64], [0.5, 60], [0.65, 50], [0.78, 36], [0.86, 26], [0.9, 25], [1, 25]];
function wAt(u) {
  if (u <= 0) return 30; if (u >= 1) return 25;
  for (let i = 1; i < WPROF.length; i++) if (u <= WPROF[i][0]) { const [u0, w0] = WPROF[i - 1], [u1, w1] = WPROF[i]; return w0 + (w1 - w0) * smooth((u - u0) / (u1 - u0)); }
  return 25;
}
function fishSpine(o) {
  const t = o.t || 0, wig = o.wiggle || 0, bend = o.bend || 0;
  const ang = (u) => bend * 1.2 * PI * (u - 0.45) + wig * 0.55 * Math.sin(TAU * 1.15 * u - t * 10) * (0.25 + 0.9 * u);
  const a0 = ang(0.45), P = [], D = [], ds = FL / SEG;
  let px = 0, py = 0;
  for (let i = 0; i <= SEG; i++) { const a = ang(i / SEG) - a0, dx = -Math.cos(a), dy = -Math.sin(a); P.push([px, py]); D.push([dx, dy]); px += dx * ds; py += dy * ds; }
  const q0 = 0.46 * SEG, i0 = Math.floor(q0), f0 = q0 - i0, cx = lerp(P[i0][0], P[i0 + 1][0], f0), cy = lerp(P[i0][1], P[i0 + 1][1], f0);
  for (const p of P) { p[0] -= cx; p[1] -= cy; }
  const F = (u, h = 0) => {
    let px, py, dx, dy;
    if (u < 0) { [dx, dy] = D[0]; px = P[0][0] + dx * u * FL; py = P[0][1] + dy * u * FL; }
    else if (u > 1) { [dx, dy] = D[SEG]; px = P[SEG][0] + dx * (u - 1) * FL; py = P[SEG][1] + dy * (u - 1) * FL; }
    else { const q = u * SEG, j = Math.min(SEG - 1, Math.floor(q)), g = q - j; px = lerp(P[j][0], P[j + 1][0], g); py = lerp(P[j][1], P[j + 1][1], g); dx = lerp(D[j][0], D[j + 1][0], g); dy = lerp(D[j][1], D[j + 1][1], g); const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m; }
    return [px - dy * h, py + dx * h];
  };
  return F;
}
function polyU(ctx, F, u0, u1, hf, n = 24, move = true) { for (let i = 0; i <= n; i++) { const u = lerp(u0, u1, i / n), p = F(u, hf(u)); (i === 0 && move) ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); } }
function bodyPath(ctx, F) {
  ctx.beginPath();
  polyU(ctx, F, 0, 0.885, (u) => wAt(u), 40);
  polyU(ctx, F, 0.885, 0, (u) => -wAt(u), 40, false);
  const w0 = wAt(0);
  for (let i = 0; i <= 12; i++) { const th = -PI / 2 + i / 12 * PI, p = F(-(0.72 * w0 / FL) * Math.cos(th), w0 * Math.sin(th)); ctx.lineTo(p[0], p[1]); }
  ctx.closePath();
}
function band(ctx, F, u0, u1, f1, f2) { ctx.beginPath(); polyU(ctx, F, u0, u1, (u) => f1 * wAt(u), 26); polyU(ctx, F, u1, u0, (u) => f2 * wAt(u), 26, false); ctx.closePath(); }

const FPAL = {
  alive: { back: '#2f3a2c', base: '#5d6a52', mid: '#9c9a7e', belly: '#e9e2c6', fin: '#2a3226', finRay: 'rgba(10,16,10,0.45)', blot: 'rgba(18,26,18,0.55)' },
  charred: { back: '#120d0b', base: '#211915', mid: '#2a201b', belly: '#33281f', fin: '#0c0908', finRay: 'rgba(60,40,30,0.4)', blot: 'rgba(0,0,0,0.5)' },
};
function fishTailFin(ctx, F, pal, charred, r) {
  ctx.beginPath();
  const p0 = F(0.86, wAt(0.86) * 0.95); ctx.moveTo(p0[0], p0[1]);
  for (let i = 0; i <= 16; i++) { const th = PI / 2 - i / 16 * PI, jag = charred ? 0.75 + 0.25 * Math.abs(Math.sin(i * 2.7)) : 1; const p = F(0.965 + 0.07 * Math.cos(th) * jag, 64 * Math.sin(th) * jag); ctx.lineTo(p[0], p[1]); }
  const p1 = F(0.86, -wAt(0.86) * 0.95); ctx.lineTo(p1[0], p1[1]); ctx.closePath();
  ctx.fillStyle = pal.fin; ctx.fill(); ctx.strokeStyle = 'rgba(10,14,10,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = pal.finRay; ctx.lineWidth = 1.6;
  for (let i = 1; i < 10; i++) { const th = PI / 2 - i / 10 * PI, a = F(0.89, 8 * Math.sin(th)), b = F(0.965 + 0.065 * Math.cos(th), 58 * Math.sin(th)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  if (!charred) { ctx.strokeStyle = 'rgba(200,120,80,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i <= 16; i++) { const th = PI / 2 - i / 16 * PI, p = F(0.962 + 0.066 * Math.cos(th), 60 * Math.sin(th)); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke(); }
  void r;
}
function fishLongFin(ctx, F, side, u0, u1, hmax, pal, charred) {
  const fh = (u) => { const v = (u - u0) / (u1 - u0); return hmax * Math.min(1, v * 4) * (0.75 + 0.25 * Math.sin(v * PI)) * (charred ? 0.7 + 0.3 * Math.abs(Math.sin(u * 140)) : 1); };
  ctx.beginPath();
  polyU(ctx, F, u0, u1, (u) => side * (wAt(u) * 0.9 + fh(u)), 30);
  polyU(ctx, F, u1, u0, (u) => side * wAt(u) * 0.8, 12, false);
  ctx.closePath(); ctx.fillStyle = pal.fin; ctx.fill(); ctx.strokeStyle = 'rgba(10,14,10,0.7)'; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.strokeStyle = pal.finRay; ctx.lineWidth = 1.3;
  for (let u = u0 + 0.02; u < u1; u += 0.025) { const a = F(u, side * wAt(u) * 0.85), b = F(u + 0.012, side * (wAt(u) * 0.9 + fh(u) * 0.92)); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
}
function fishPectoral(ctx, F, pal, t, wig) {
  const b = F(0.235, -wAt(0.235) * 0.25), fl = Math.sin(t * 9) * 0.25 * (0.3 + wig);
  const tip1 = F(0.33, -wAt(0.33) * (0.05 + fl)), tip2 = F(0.31, -wAt(0.31) * (0.62 + fl));
  ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.quadraticCurveTo(tip1[0], tip1[1], (tip1[0] + tip2[0]) / 2, (tip1[1] + tip2[1]) / 2); ctx.quadraticCurveTo(tip2[0], tip2[1], b[0], b[1]);
  ctx.fillStyle = NP.rgba(pal.fin === '#0c0908' ? '#0c0908' : '#4a5640', 0.92); ctx.fill(); ctx.strokeStyle = 'rgba(10,14,10,0.6)'; ctx.lineWidth = 1.8; ctx.stroke();
  const pb = F(0.37, -wAt(0.37) * 0.92), pt = F(0.43, -wAt(0.43) * 1.18);
  ctx.beginPath(); ctx.moveTo(pb[0], pb[1]); ctx.quadraticCurveTo(pt[0], pt[1] - 4, pt[0], pt[1]); const pc = F(0.44, -wAt(0.44) * 0.95); ctx.quadraticCurveTo(pc[0], pc[1], pb[0], pb[1]); ctx.fillStyle = pal.fin; ctx.fill();
}
function drawEye(ctx, E, R, kind, cooked, fwd) {
  ctx.save(); ctx.lineCap = 'round';
  if (cooked) {
    ell(ctx, E[0], E[1], R * 0.95, R * 0.95); ctx.fillStyle = '#e9e3d6'; ctx.fill(); ctx.strokeStyle = 'rgba(60,50,40,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ell(ctx, E[0] + fwd[0] * 2, E[1] + fwd[1] * 2, R * 0.42, R * 0.42); ctx.fillStyle = 'rgba(150,140,130,0.8)'; ctx.fill();
    ctx.restore(); return;
  }
  ell(ctx, E[0], E[1], R + 3, R + 3); ctx.fillStyle = '#1a1e16'; ctx.fill();
  ell(ctx, E[0], E[1], R, R); ctx.fillStyle = '#fbf6e4'; ctx.fill();
  if (kind === 'dizzy') {
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let i = 0; i <= 30; i++) { const a = i / 30 * TAU * 2.2, rr = i / 30 * R * 0.85; const px = E[0] + Math.cos(a) * rr, py = E[1] + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
    ctx.restore(); return;
  }
  const look = kind === 'sly' ? 0.45 : 0.28, ix = E[0] + fwd[0] * R * look, iy = E[1] + fwd[1] * R * look;
  ell(ctx, ix, iy, R * 0.66, R * 0.66); ctx.fillStyle = rgr(ctx, ix, iy, 0, ix, iy, R * 0.66, [[0, '#f6c040'], [0.7, '#d07818'], [1, '#7a3a08']]); ctx.fill();
  ell(ctx, ix, iy, R * 0.38, R * 0.38); ctx.fillStyle = '#0b0b0b'; ctx.fill();
  ctx.fillStyle = '#fff'; ell(ctx, ix - R * 0.22, iy - R * 0.26, R * 0.2, R * 0.2); ctx.fill();
  if (kind === 'sly') {
    ctx.save(); ell(ctx, E[0], E[1], R + 3, R + 3); ctx.clip();
    ctx.fillStyle = '#3b4634'; ctx.fillRect(E[0] - R - 4, E[1] - R - 4, (R + 4) * 2, R * 1.05 + 4);
    ctx.restore();
    ctx.strokeStyle = '#121510'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(E[0] - R - 2, E[1] - R * 0.05); ctx.lineTo(E[0] + R + 2, E[1] + R * 0.1); ctx.stroke();
  }
  ctx.restore();
}
function snakehead(ctx, x, y, s = 1, o = {}) {
  const state = o.state || 'alive', t = o.t || 0, seed = o.seed ?? 3, r = rng(seed);
  const charredLike = state === 'charred' || state === 'scraped' || state === 'plated';
  const alive = state === 'alive';
  const fo = { t, wiggle: alive ? (o.wiggle || 0) : 0, bend: o.bend || 0 };
  const F = fishSpine(fo), rot = o.rot || 0, sx = o.flip ? -1 : 1;
  const M = mapper(x, y, rot, s, sx);
  const pal = charredLike ? FPAL.charred : FPAL.alive;
  const k = state === 'plated' ? 1 : state === 'scraped' ? clamp(o.k ?? 1) : 0;
  const w0 = wAt(0);
  const skA = o.skewerA ?? o.skewer ?? (state === 'skewered' ? 130 : null), skB = o.skewerB ?? o.skewer ?? (state === 'skewered' ? 130 : null);
  const hasSk = skA != null && state !== 'plated' && state !== 'alive';
  const SA = F(-(skA ?? 130) / FL - 0.01, 0), SB = F(1 + (skB ?? 130) / FL, 0);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * sx, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // ground/contact shadow for plated
  if (state === 'plated') { ctx.fillStyle = 'rgba(10,30,10,0.35)'; ell(ctx, 6, 18, FL * 0.5, 50); ctx.fill(); }
  fishTailFin(ctx, F, pal, charredLike, r);
  if (hasSk) bambooSkewer(ctx, SA[0], SA[1], SB[0], SB[1], { w: 13, char: charredLike ? 0.55 : 0.05, seed: seed + 1 });
  fishLongFin(ctx, F, 1, 0.27, 0.865, 26, pal, charredLike);
  fishLongFin(ctx, F, -1, 0.5, 0.865, 22, pal, charredLike);
  // ---- body
  bodyPath(ctx, F);
  ctx.fillStyle = pal.base; ctx.fill();
  ctx.save(); bodyPath(ctx, F); ctx.clip();
  band(ctx, F, -0.06, 0.95, 0.32, 1.3); ctx.fillStyle = pal.back; ctx.fill();
  band(ctx, F, -0.06, 0.95, 0.12, 0.42); ctx.fillStyle = NP.rgba(pal.back, 0.45); ctx.fill();
  band(ctx, F, -0.06, 0.95, -0.12, -0.5); ctx.fillStyle = pal.mid; ctx.fill();
  band(ctx, F, -0.06, 0.95, -0.36, -1.3); ctx.fillStyle = pal.belly; ctx.fill();
  if (!charredLike) {
    // chevron blotches (pointing toward the head) + speckles
    ctx.fillStyle = pal.blot;
    for (let i = 0; i < 7; i++) {
      const u = 0.27 + i * 0.085 + (r() - 0.5) * 0.015, jw = 0.028 + r() * 0.012;
      const pts = [[u + 0.02, 1.05], [u - 0.018, 0.12], [u + 0.012, -0.42], [u + 0.012 + jw, -0.36], [u - 0.018 + jw, 0.1], [u + 0.02 + jw * 1.4, 1.05]];
      ctx.beginPath(); pts.forEach(([uu, hf], j) => { const p = F(uu, hf * wAt(uu)); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(15,22,15,0.45)';
    for (let i = 0; i < 26; i++) { const u = 0.08 + r() * 0.8, hf = 0.35 + r() * 0.6, p = F(u, hf * wAt(u)); ell(ctx, p[0], p[1], 2 + r() * 4, 2 + r() * 3); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,110,80,0.35)';
    for (let i = 0; i < 18; i++) { const u = 0.15 + r() * 0.65, hf = -0.4 - r() * 0.45, p = F(u, hf * wAt(u)); ell(ctx, p[0], p[1], 1.5 + r() * 2.5, 1.5 + r() * 2); ctx.fill(); }
    // scale hint rows
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) { const u = 0.25 + i * 0.024; for (const hf of [0.6, 0.15, -0.3]) { const p = F(u, hf * wAt(u)); ctx.beginPath(); ctx.arc(p[0], p[1], 6, -0.9, 0.9); ctx.stroke(); } }
    // lateral line
    ctx.strokeStyle = 'rgba(220,210,170,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); polyU(ctx, F, 0.24, 0.86, (u) => wAt(u) * 0.18, 20); ctx.stroke();
  } else {
    // charred crust: patches, ash specks, cracks
    for (let i = 0; i < 34; i++) {
      const u = r() * 0.9 - 0.02, hf = (r() * 2 - 1) * 0.95, p = F(u, hf * wAt(u)), rr = 5 + r() * 14;
      ctx.fillStyle = i % 3 ? 'rgba(58,46,40,0.75)' : 'rgba(8,6,5,0.8)';
      ctx.beginPath(); for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + r() * 0.6, q = rr * (0.6 + r() * 0.5); j ? ctx.lineTo(p[0] + Math.cos(a) * q, p[1] + Math.sin(a) * q * 0.7) : ctx.moveTo(p[0] + Math.cos(a) * q, p[1] + Math.sin(a) * q * 0.7); } ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(150,140,130,0.55)';
    for (let i = 0; i < 40; i++) { const u = r() * 0.88, hf = r() * 2 - 1, p = F(u, hf * wAt(u)); ell(ctx, p[0], p[1], 1 + r() * 2.2, 1 + r() * 1.8); ctx.fill(); }
  }
  ctx.restore();
  // ---- scraped flesh
  let fleshMid = null, fleshW = 0;
  if (k > 0.001) {
    const u0 = 0.235, u1 = lerp(u0, 0.87, k);
    const top = (u) => wAt(u) * 0.8 * (1 + 0.06 * Math.sin(u * 70 + seed));
    const bot = (u) => -wAt(u) * 0.72 * (1 + 0.06 * Math.sin(u * 61 + seed * 2));
    const fp = new Path2D();
    const N = Math.max(4, Math.round((u1 - u0) * 60));
    for (let i = 0; i <= N; i++) { const u = lerp(u0, u1, i / N), p = F(u, top(u)); i ? fp.lineTo(p[0], p[1]) : fp.moveTo(p[0], p[1]); }
    for (let j = 0; j <= 10; j++) { const hh = lerp(top(u1), bot(u1), j / 10), p = F(u1 + 0.012 * Math.sin(j * 2.7 + seed) + 0.006 * Math.sin(j * 5.1), hh); fp.lineTo(p[0], p[1]); }
    for (let i = N; i >= 0; i--) { const u = lerp(u0, u1, i / N), p = F(u, bot(u)); fp.lineTo(p[0], p[1]); }
    for (let j = 10; j >= 0; j--) { const hh = lerp(top(u0), bot(u0), j / 10), p = F(u0 - 0.008 * Math.abs(Math.sin(j * 1.9)), hh); fp.lineTo(p[0], p[1]); }
    fp.closePath();
    ctx.fillStyle = '#fbf6ea'; ctx.fill(fp);
    ctx.save(); ctx.clip(fp);
    ctx.strokeStyle = 'rgba(226,210,182,0.85)'; ctx.lineWidth = 16; ctx.stroke(fp);
    ctx.strokeStyle = 'rgba(205,188,160,0.75)'; ctx.lineWidth = 2;
    for (let u = u0 + 0.03; u < u1; u += 0.043) {
      ctx.beginPath(); [[0.012, 0.75], [-0.012, 0.32], [0.01, -0.02], [-0.012, -0.38], [0.008, -0.7]].forEach(([du, hf], j) => { const p = F(u + du, hf * wAt(u)); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 8; i++) { const u = lerp(u0, u1, r()), p = F(u, (r() * 0.9 - 0.2) * wAt(u)); ell(ctx, p[0], p[1], 6 + r() * 8, 3 + r() * 3, r()); ctx.fill(); }
    ctx.fillStyle = 'rgba(240,200,180,0.35)'; { const p = F((u0 + u1) / 2, 0); ell(ctx, p[0], p[1] + 6, (u1 - u0) * FL * 0.35, 10); ctx.fill(); }
    if (state === 'plated') {
      ctx.strokeStyle = 'rgba(160,138,108,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); polyU(ctx, F, 0.26, 0.84, (u) => wAt(u) * (0.05 + 0.04 * Math.sin(u * 50)), 24); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); polyU(ctx, F, 0.26, 0.84, (u) => wAt(u) * (0.12 + 0.04 * Math.sin(u * 50)), 24); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#24160f'; ctx.lineWidth = 3.5; ctx.stroke(fp);
    // char flakes along the boundary + a few on the flesh
    ctx.fillStyle = '#17100b';
    const nf = Math.round(10 + 40 * k);
    for (let i = 0; i < nf; i++) { const u = lerp(u0, u1, r()), side = r() < 0.5 ? top(u) : bot(u), p = F(u, side * (0.85 + r() * 0.25)), rr = 2 + r() * 5; ctx.beginPath(); ctx.moveTo(p[0] - rr, p[1]); ctx.lineTo(p[0], p[1] - rr * 0.7); ctx.lineTo(p[0] + rr * 0.9, p[1] + rr * 0.3); ctx.lineTo(p[0] - rr * 0.2, p[1] + rr * 0.8); ctx.closePath(); ctx.fill(); }
    for (let i = 0; i < 6 + 6 * k; i++) { const u = lerp(u0, u1, r()), p = F(u, (r() * 1.2 - 0.6) * wAt(u)); ell(ctx, p[0], p[1], 1.5 + r() * 2.5, 1 + r() * 2); ctx.fill(); }
    if (state === 'plated') {
      ctx.fillStyle = '#fbf6ea'; ctx.strokeStyle = 'rgba(190,170,140,0.9)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) { const u = 0.3 + r() * 0.5, p = F(u, (0.08 + (r() - 0.5) * 0.3) * wAt(u)); const qx = p[0] + (r() - 0.5) * 14, qy = p[1] + 10 + r() * 10; ell(ctx, qx, qy, 9 + r() * 7, 5 + r() * 3, r() * PI); ctx.fill(); ctx.stroke(); }
    }
    fleshMid = F((u0 + u1) / 2, 0.15 * wAt((u0 + u1) / 2)); fleshW = (u1 - u0) * FL;
  }
  // ---- ember cracks (charred, and the unscraped part of scraped)
  if (charredLike && state !== 'plated') {
    const uMax = k > 0 ? 0.87 : 0.9, uMin = k > 0 ? lerp(0.235, 0.87, k) : 0.02;
    ctx.save(); bodyPath(ctx, F); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    const rc = rng(seed + 9);
    for (let i = 0; i < 12; i++) {
      const u = rc() * 0.88 + 0.01, hf = rc() * 1.6 - 0.8, len = 0.03 + rc() * 0.05, fl = 0.55 + 0.45 * Math.sin(t * (4 + rc() * 5) + i * 1.7);
      if (u < uMin - 0.01 || u > uMax) { rc(); rc(); continue; }
      const pts = []; for (let j = 0; j <= 4; j++) { const uu = u + len * j / 4, hh = (hf + (rc() - 0.5) * 0.09 + Math.sin(j * 1.3 + i) * 0.05) * wAt(uu); pts.push(F(uu, hh)); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = `rgba(255,90,20,${0.4 * fl})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < 4; j++) ctx.quadraticCurveTo(pts[j][0], pts[j][1], (pts[j][0] + pts[j + 1][0]) / 2, (pts[j][1] + pts[j + 1][1]) / 2); ctx.lineTo(pts[4][0], pts[4][1]); ctx.stroke();
      ctx.strokeStyle = `rgba(255,${(170 + 60 * fl) | 0},90,${0.9 * fl})`; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
  // ---- gill, head details
  {
    const gc = charredLike ? 'rgba(70,55,45,0.7)' : 'rgba(18,24,16,0.6)';
    const a = F(0.19, wAt(0.19) * 0.78), b = F(0.24, wAt(0.24) * 0.05), c = F(0.205, -wAt(0.205) * 0.8);
    if (k < 0.001 || true) { ctx.strokeStyle = gc; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0] + (b[0] - a[0]) * 0.2, b[1], c[0], c[1]); ctx.stroke(); }
    if (!charredLike) {
      ctx.fillStyle = 'rgba(15,20,12,0.5)'; for (let i = 0; i < 5; i++) { const p = F(0.03 + i * 0.025, wAt(0.03 + i * 0.025) * (0.72 - (i % 2) * 0.12)); ell(ctx, p[0], p[1], 2.2, 2.2); ctx.fill(); }
    }
  }
  // ---- mouth
  const m = alive ? clamp(o.mouth || 0) : 0;
  const lipF = F(-0.012, -w0 * 0.12), corner = F(0.118, -wAt(0.118) * 0.3);
  if (m > 0.01) {
    const jawTip = F(-0.004, -w0 * 0.12 - m * 46), chin = F(0.03, -wAt(0.03) - m * 34), jawBase = F(0.13, -wAt(0.13) * 0.95);
    ctx.beginPath(); ctx.moveTo(lipF[0], lipF[1]); ctx.lineTo(corner[0], corner[1]); ctx.lineTo(jawTip[0], jawTip[1]); ctx.closePath(); ctx.fillStyle = '#4a0f18'; ctx.fill();
    const tg = F(0.05, -w0 * 0.12 - m * 26); ell(ctx, tg[0], tg[1], 14 * m + 3, 7 * m + 2); ctx.fillStyle = '#c8485a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(corner[0], corner[1]); ctx.lineTo(jawTip[0], jawTip[1]); ctx.quadraticCurveTo(chin[0], chin[1] + 4, jawBase[0], jawBase[1]); ctx.closePath();
    ctx.fillStyle = pal.belly; ctx.fill(); ctx.strokeStyle = 'rgba(14,18,22,0.75)'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const p = F(0.005 + i * 0.024, -w0 * 0.14 - i * 1.5); ctx.beginPath(); ctx.moveTo(p[0] - 3, p[1]); ctx.lineTo(p[0] + 3, p[1]); ctx.lineTo(p[0], p[1] + 7); ctx.closePath(); ctx.fill(); }
  } else {
    const mid = F(0.06, -w0 * 0.32);
    ctx.strokeStyle = charredLike ? 'rgba(80,60,50,0.8)' : 'rgba(14,18,12,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(lipF[0], lipF[1]); ctx.quadraticCurveTo(mid[0], mid[1], corner[0], corner[1]); ctx.stroke();
    if (!charredLike) { const up = F(0.13, -wAt(0.13) * 0.18); ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(corner[0], corner[1]); ctx.lineTo(up[0], up[1]); ctx.stroke(); }
  }
  // ---- eye
  const E = F(0.072, wAt(0.072) * 0.4), fwd0 = (() => { const a = F(0, 0), b = F(0.05, 0); const dx = a[0] - b[0], dy = a[1] - b[1], mm = Math.hypot(dx, dy) || 1; return [dx / mm, dy / mm]; })();
  drawEye(ctx, E, 13.5, o.eye || 'normal', charredLike, fwd0);
  if (o.eye === 'angry' && !charredLike) {
    const b0 = F(0.035, wAt(0.035) * 0.66), b1 = F(0.11, wAt(0.11) * 0.98);
    ctx.strokeStyle = '#0e120c'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
  }
  // ---- wet shine & rims
  const wet = o.wet ?? (alive ? 1 : 0);
  if (wet > 0 && !charredLike) {
    ctx.strokeStyle = `rgba(255,255,255,${0.32 * wet})`; ctx.lineWidth = 5; ctx.beginPath(); polyU(ctx, F, 0.2, 0.72, (u) => wAt(u) * 0.62, 20); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.18 * wet})`; ctx.lineWidth = 3; ctx.beginPath(); polyU(ctx, F, 0.04, 0.16, (u) => wAt(u) * 0.75, 8); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.7 * wet})`; for (let i = 0; i < 6; i++) { const u = 0.15 + i * 0.11, p = F(u, wAt(u) * (0.5 + (i % 2) * 0.2)); ell(ctx, p[0], p[1], 3.5, 2); ctx.fill(); }
  }
  bodyPath(ctx, F); ctx.strokeStyle = 'rgba(12,16,14,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  const rim = o.rim ?? 0.9;
  if (rim > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = charredLike ? `rgba(150,170,200,${0.45 * rim})` : `rgba(185,220,255,${0.85 * rim})`; ctx.lineWidth = 3.2; ctx.beginPath(); polyU(ctx, F, 0.0, 0.84, (u) => wAt(u) - 1.5, 30); ctx.stroke(); ctx.restore(); }
  const rf = o.rimFire || 0;
  if (rf > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,150,60,${0.9 * rf})`; ctx.lineWidth = 4; ctx.beginPath(); polyU(ctx, F, 0.02, 0.86, (u) => -wAt(u) + 2, 30); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  // ---- world-space smoke / steam (always rises up the screen)
  const L2W = (p) => M(p[0], p[1]);
  if (state === 'charred' || (state === 'scraped' && k < 1)) {
    const sm = (o.smoke ?? 1) * (state === 'scraped' ? 1 - k : 1);
    if (sm > 0.01) for (let i = 0; i < 3; i++) { const p = L2W(F(0.3 + i * 0.22, 0)); BFX.smokeWisp(ctx, t + i * 0.7, p[0], p[1], s, { seed: seed + i, alpha: 0.55 * sm, h: 260 }); }
  }
  if (fleshMid && (o.steam ?? 1) > 0) { const p = L2W(fleshMid); FX.steamWisps(ctx, p[0], p[1], s, { t, k: (o.steam ?? 1) * Math.min(1, k * 2.5), w: fleshW * 0.8, h: 300, n: 4, seed: seed + 5, warm: o.steamWarm ?? 0.2 }); }
  return {
    center: [x, y], mouth: L2W(lipF), tail: L2W(F(1.03, 0)), eye: L2W(E), belly: L2W(F(0.5, -wAt(0.5))), back: L2W(F(0.5, wAt(0.5))),
    skewerA: L2W(SA), skewerB: L2W(SB), len: FL * s,
  };
}

// ================================================================================================= STRAW
const STRAW = new Map();
const STRAW_GOLD = ['#e8c35a', '#d4a640', '#f2d77a', '#b98a2e'];
const CONE_H = 760, CONE_R = 318, SIL = 0.88; // body silhouette is drawn smaller than the strand field → strands fringe the edge
function coneR(v) { return CONE_R * Math.pow(1 - v, 0.9) + 16; }
function strawStrands(seed) {
  if (STRAW.has(seed)) return STRAW.get(seed);
  const r = rng(seed), N = 560, A = [];
  for (let i = 0; i < N; i++) {
    const v = 1 - Math.sqrt(r()) * 0.98, f = r() * 2 - 1, R = coneR(v);
    const x = f * R * 0.97, y = -v * CONE_H + Math.sqrt(Math.max(0, 1 - f * f)) * R * 0.16;
    const ang = Math.atan2(-CONE_H - 30 - y, -x * 0.6 - x * 0.1) + (r() - 0.5) * 0.6;
    const len = 55 + r() * 100, c = (r() - 0.5) * 24, b = (r() * 4) | 0;
    const ti = 0.03 + 0.28 * v + 0.14 * r(), tv = ti + 0.22 + 0.16 * r();
    A.push({ v, x, y, ang, len, c, b, ti, tv, lit: f < -0.55, g: (r() * 3) | 0 });
  }
  A.sort((p, q) => p.v - q.v);
  STRAW.set(seed, A); return A;
}
function strandTo(path, st) {
  const ex = st.x + Math.cos(st.ang) * st.len, ey = st.y + Math.sin(st.ang) * st.len;
  const mx = (st.x + ex) / 2 - Math.sin(st.ang) * st.c, my = (st.y + ey) / 2 + Math.cos(st.ang) * st.c;
  path.moveTo(st.x, st.y); path.quadraticCurveTo(mx, my, ex, ey);
}
// slightly lumpy cone silhouette (scaled by SIL), cached as Path2D
let CONE_P = null;
function conePath2D() {
  if (CONE_P) return CONE_P;
  const p = new Path2D(), r = rng(77), N = 22, R = CONE_R * SIL, Hh = CONE_H * 0.97;
  const edge = (side) => { const pts = []; for (let i = 0; i <= N; i++) { const v = i / N, rr = (R * Math.pow(1 - v, 0.95) + 10) * (1 + (r() - 0.5) * 0.07); pts.push([side * rr, -v * Hh - (i === N ? 12 : 0)]); } return pts; };
  const Lp = edge(-1), Rp = edge(1).reverse();
  p.moveTo(Lp[0][0], 6); for (let i = 1; i < Lp.length; i++) p.lineTo(Lp[i][0], Lp[i][1]);
  for (let i = 1; i < Rp.length; i++) p.lineTo(Rp[i][0], Rp[i][1]);
  p.quadraticCurveTo(0, 56, Lp[0][0], 6); p.closePath();
  return (CONE_P = p);
}
// wavy dome top for a partially built pile (k < 1)
function topClip(ctx, topY, rTop, seed) {
  ctx.beginPath(); ctx.moveTo(-700, 900); ctx.lineTo(-700, topY + 60);
  for (let i = 0; i <= 24; i++) {
    const xx = -rTop * 1.25 + i / 24 * rTop * 2.5, u = xx / Math.max(1, rTop);
    ctx.lineTo(xx, topY + 46 * u * u + Math.sin(i * 1.9 + seed) * 9 + Math.sin(i * 4.3 + seed * 2) * 5);
  }
  ctx.lineTo(700, topY + 60); ctx.lineTo(700, 900); ctx.closePath(); ctx.clip();
}
// the untouched full pile (k=1, burn=0) is static → rendered once per seed into a cached sprite at s=1
const PILE_SPR = new Map();
function pileSprite(seed) {
  if (PILE_SPR.has(seed)) return PILE_SPR.get(seed);
  const ox = 520, oy = 1000, c = createCanvas(1040, 1090);
  strawPile(c.getContext('2d'), ox, oy, 1, { k: 1, burn: 0, seed, live: true });
  const sp = { c, ox, oy }; PILE_SPR.set(seed, sp); return sp;
}
function strawPile(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), burn = clamp(o.burn || 0), seed = o.seed ?? 31;
  if (burn === 0 && k >= 0.985 && s <= 1.05 && !o.live) {
    const sp = pileSprite(seed), S0 = strawStrands(seed), vT = S0[S0.length - 1].v;
    ctx.drawImage(sp.c, x - sp.ox * s, y - sp.oy * s, sp.c.width * s, sp.c.height * s);
    return { top: [x, y - (vT * CONE_H + 40) * s], h: (vT * CONE_H + 40) * s, r: CONE_R * s };
  }
  const S = strawStrands(seed), nVis = Math.floor(S.length * k);
  const vTop = nVis > 0 ? S[nVis - 1].v : 0;
  const topY = -(vTop * CONE_H + 40), partial = k < 0.985;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const silA = 1 - clamp((burn - 0.4) / 0.3);
  const mA = burn > 0.42 ? ease.out(clamp((burn - 0.42) / 0.5)) : 0; // ash mound amount
  if (nVis > 0 && silA > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.35 * silA})`; ell(ctx, 0, 18, CONE_R * 1.1, 52); ctx.fill();
    ctx.save(); if (partial) topClip(ctx, topY, coneR(vTop), seed);
    ctx.globalAlpha = silA;
    const cb = clamp(burn / 0.4);
    ctx.fillStyle = lgr(ctx, -CONE_R, 0, CONE_R, 0, [[0, mixc('#5e4216', '#140e0a', cb)], [0.35, mixc('#86621f', '#1e140e', cb)], [0.7, mixc('#6e4e1a', '#160f0a', cb)], [1, mixc('#3e2a0e', '#0a0605', cb)]]);
    ctx.fill(conePath2D());
    ctx.restore();
  }
  // strands
  const paths = STRAW_GOLD.map(() => new Path2D()), pChar = new Path2D(), pEmb = new Path2D(), pLit = new Path2D(), pDark = new Path2D();
  const pGlow = [new Path2D(), new Path2D(), new Path2D()];
  let nGlow = 0;
  for (let i = 0; i < nVis; i++) {
    const st = S[i];
    if (burn >= st.tv) continue;
    if (burn > 0 && burn >= st.ti + 0.05) { strandTo(pChar, st); if (i % 4 === 0) { strandTo(pGlow[st.g], st); nGlow++; } }
    else { strandTo(paths[st.b], st); if (st.lit) strandTo(pLit, st); if (st.b === 3 && i % 3 === 0) strandTo(pDark, st); }
    if (burn > 0 && burn >= st.ti && burn < st.ti + 0.13) strandTo(pEmb, st);
  }
  ctx.save(); if (partial) topClip(ctx, topY - 70, coneR(vTop) * 1.3, seed);
  ctx.lineCap = 'butt'; ctx.lineWidth = 6.2; ctx.strokeStyle = 'rgba(50,32,8,0.6)'; for (const p of paths) ctx.stroke(p); ctx.lineCap = 'round';
  ctx.lineWidth = 3.6; paths.forEach((p, i) => { ctx.strokeStyle = STRAW_GOLD[i]; ctx.stroke(p); });
  ctx.strokeStyle = 'rgba(90,60,18,0.9)'; ctx.lineWidth = 2.2; ctx.stroke(pDark);
  ctx.strokeStyle = '#21160f'; ctx.lineWidth = 3.8; ctx.stroke(pChar);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(170,205,255,0.5)'; ctx.lineWidth = 2; ctx.stroke(pLit); ctx.restore();
  ctx.restore();
  if (burn > 0) {
    ctx.save();
    const fl = 0.75 + 0.25 * Math.sin(t * 17);
    ctx.strokeStyle = `rgba(255,90,20,${0.6 * fl})`; ctx.lineWidth = 6; ctx.stroke(pEmb);
    ctx.strokeStyle = `rgba(255,205,110,${0.9 * fl})`; ctx.lineWidth = 2.2; ctx.stroke(pEmb);
    // smouldering: a subset of the charred strands glow and flicker in three phase groups
    if (nGlow > 0) {
      for (let g = 0; g < 3; g++) {
        const a = 0.35 + 0.35 * Math.sin(t * (4.5 + g * 1.7) + g * 2.1);
        ctx.strokeStyle = `rgba(255,${(95 + 60 * a) | 0},30,${a})`; ctx.lineWidth = 2; ctx.stroke(pGlow[g]);
      }
    }
    ctx.restore();
  }
  // ash mound (heat glow first, then lumpy grey ash, then a few embers peeking out low down)
  if (mA > 0) {
    const mh = 115 * mA, mw = 265 * (0.72 + 0.28 * mA), ra = rng(seed + 8);
    FX.emberGlow(ctx, 0, 6, 1, { t, k: mA * 0.45, w: mw * 1.05, seed: seed + 2 });
    ctx.beginPath(); ctx.moveTo(-mw, 10);
    for (let i = 1; i < 18; i++) { const u = i / 18 * 2 - 1, hh = mh * Math.pow(1 - u * u, 0.75) * (1 + 0.13 * Math.sin(u * 9 + seed) + 0.07 * Math.sin(u * 23 + seed)); ctx.lineTo(u * mw, 8 - hh); }
    ctx.lineTo(mw, 10); ctx.quadraticCurveTo(0, 38, -mw, 10); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -mh, 0, 30, [[0, '#8d8780'], [0.35, '#66605a'], [0.75, '#403b37'], [1, '#2a2522']]); ctx.fill();
    ctx.strokeStyle = 'rgba(25,20,18,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    // warm underglow along the base of the ash
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ell(ctx, 0, 6, mw * 0.85, 26); ctx.fillStyle = rgr(ctx, 0, 6, 0, 0, 6, mw * 0.85, [[0, `rgba(255,120,40,${0.4 * mA})`], [1, 'rgba(255,80,20,0)']]); ctx.fill();
    ctx.restore();
    // ash flecks (light) on the upper surface
    ctx.fillStyle = 'rgba(205,200,192,0.5)'; for (let i = 0; i < 34; i++) { const u = ra() * 2 - 1, hh = mh * Math.pow(1 - u * u, 0.75) * (0.55 + 0.45 * ra()); ell(ctx, u * mw * 0.88, 10 - hh, 2 + ra() * 4, 1.2 + ra() * 1.8); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const u = ra() * 2 - 1, hh = mh * ra() * 0.3, fl = 0.5 + 0.5 * Math.sin(t * (3 + ra() * 5) + i * 2.3), z = 1.8 + ra() * 3;
      ctx.fillStyle = `rgba(255,${(100 + 110 * fl) | 0},40,${0.8 * fl * mA})`; ell(ctx, u * mw * 0.8, 4 - hh, z * 1.5, z); ctx.fill();
    }
    ctx.restore();
  }
  // moon rim on the cone's left edge
  if (nVis > 0 && silA > 0.05 && burn < 0.5) {
    ctx.save(); if (partial) topClip(ctx, topY, coneR(vTop), seed); ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(170,200,255,${0.35 * silA * (1 - clamp(burn * 2))})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-CONE_R * SIL - 6, 0); ctx.bezierCurveTo(-CONE_R * SIL * 0.9, -CONE_H * 0.35, -CONE_R * SIL * 0.42, -CONE_H * 0.75, -12, -CONE_H - 6); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  return { top: [x, y + topY * s], h: -topY * s, r: CONE_R * s };
}
const ARMFUL = new Map();
function strawArmful(ctx, x, y, s = 1, o = {}) {
  const seed = o.seed ?? 41, t = o.t || 0;
  let A = ARMFUL.get(seed);
  if (!A) {
    const r = rng(seed); A = [];
    for (let i = 0; i < 190; i++) {
      const u = r() * 2 - 1, env = Math.sqrt(Math.max(0, 1 - u * u)) * 44 + 8, dir = r() < 0.5 ? 0 : PI, len = 80 + r() * 60;
      // strands start inside the bundle and point outward along the bundle axis
      A.push({ x: u * 120 - Math.cos(dir) * len * 0.45, y: (r() * 2 - 1) * env, ang: (r() - 0.5) * 0.25 + dir, len, c: (r() - 0.5) * 14, b: (r() * 4) | 0, loose: r() < 0.08, ph: r() * TAU });
    }
    ARMFUL.set(seed, A);
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(0, 0, 150, 44, 0, 0, TAU); ctx.fillStyle = lgr(ctx, 0, -44, 0, 44, [[0, '#a07a30'], [0.6, '#7a5820'], [1, '#4a3212']]); ctx.fill();
  const paths = STRAW_GOLD.map(() => new Path2D()), loose = new Path2D();
  for (const st of A) {
    const sw = st.loose ? Math.sin(t * 3 + st.ph) * 0.25 : 0;
    const q = { x: st.x, y: st.y, ang: st.ang + sw + (st.loose ? 0.4 * Math.sign(Math.cos(st.ang)) : 0), len: st.len, c: st.c };
    strandTo(st.loose ? loose : paths[st.b], q);
  }
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(60,38,10,0.5)'; for (const p of paths) ctx.stroke(p);
  ctx.lineWidth = 3; paths.forEach((p, i) => { ctx.strokeStyle = STRAW_GOLD[i]; ctx.stroke(p); });
  ctx.strokeStyle = '#e0b850'; ctx.lineWidth = 2.4; ctx.stroke(loose);
  // twisted straw tie around the middle
  ctx.strokeStyle = '#8a6424'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, 0, 14, 48, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#d8b050'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-2, 0, 13, 47, 0, PI * 0.6, PI * 1.4); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(170,205,255,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 150, 44, 0, PI * 1.12, PI * 1.88); ctx.stroke(); ctx.restore();
  ctx.restore();
  const M = mapper(x, y, o.rot || 0, s);
  return { left: M(-190, 0), right: M(190, 0), center: [x, y] };
}
function strawScraps(ctx, x0, y0, w, h, seed = 51, o = {}) {
  const r = rng(seed), n = Math.round(Math.min(120, w * h / 900));
  ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha *= o.alpha ?? 1;
  const paths = STRAW_GOLD.map(() => new Path2D());
  for (let i = 0; i < n; i++) { const st = { x: x0 + r() * w, y: y0 + r() * h, ang: r() * TAU, len: 14 + r() * 40, c: (r() - 0.5) * 8 }; strandTo(paths[(r() * 4) | 0], st); }
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(40,25,8,0.4)'; for (const p of paths) ctx.stroke(p);
  ctx.lineWidth = 2; paths.forEach((p, i) => { ctx.strokeStyle = STRAW_GOLD[i]; ctx.stroke(p); });
  ctx.restore();
}

// ================================================================================================= SPREAD PIECES
let TRAY = null, LEAF = null, BUN = null;
function traySprite() {
  if (TRAY) return TRAY;
  const R = 430, N = R * 2 + 20, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2, r = rng(61);
  x.translate(h, h);
  x.fillStyle = 'rgba(0,0,0,0.0)';
  x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fillStyle = '#b88a4c'; x.fill();
  for (let rr = 26; rr < R - 26; rr += 15) {
    const n = Math.floor(TAU * rr / 20);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU + (rr % 2) * 0.02, a1 = a0 + TAU / n * 0.92, over = ((i + (rr / 15 | 0)) % 2) === 0;
      x.strokeStyle = over ? '#e3bf7c' : '#a87a3e'; x.lineWidth = 12; x.beginPath(); x.arc(0, 0, rr, a0, a1); x.stroke();
      x.strokeStyle = over ? 'rgba(255,240,200,0.5)' : 'rgba(80,50,20,0.4)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, rr - 4, a0 + 0.01, a1 - 0.01); x.stroke();
    }
  }
  x.fillStyle = 'rgba(80,50,20,0.15)'; for (let i = 0; i < 60; i++) { const a = r() * TAU, d = r() * R * 0.9; ell(x, Math.cos(a) * d, Math.sin(a) * d, 10 + r() * 30, 6 + r() * 10, a); x.fill(); }
  x.lineWidth = 30; x.strokeStyle = '#8a5f2c'; x.beginPath(); x.arc(0, 0, R - 15, 0, TAU); x.stroke();
  x.strokeStyle = '#c69455'; x.lineWidth = 4;
  for (let i = 0; i < 120; i++) { const a = i / 120 * TAU; x.beginPath(); x.moveTo(Math.cos(a) * (R - 28), Math.sin(a) * (R - 28)); x.lineTo(Math.cos(a + 0.03) * (R - 2), Math.sin(a + 0.03) * (R - 2)); x.stroke(); }
  x.lineWidth = 3; x.strokeStyle = 'rgba(40,24,8,0.8)'; x.beginPath(); x.arc(0, 0, R - 1.5, 0, TAU); x.stroke(); x.beginPath(); x.arc(0, 0, R - 30, 0, TAU); x.stroke();
  x.fillStyle = rgr(x, 0, 0, R * 0.3, 0, 0, R, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,15,0,0.35)']]); x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
  return (TRAY = c);
}
function leafSprite() {
  if (LEAF) return LEAF;
  const R = 390, N = R * 2 + 40, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2, r = rng(71);
  x.translate(h, h); x.lineCap = 'round'; x.lineJoin = 'round';
  const edge = (a) => R * (1 + 0.025 * Math.sin(a * 9 + 1) + 0.014 * Math.sin(a * 23) + 0.01 * Math.sin(a * 41));
  const lp = () => { x.beginPath(); for (let i = 0; i <= 200; i++) { const a = i / 200 * TAU, rr = edge(a); i ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); };
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.save(); x.translate(8, 14); lp(); x.fill(); x.restore();
  lp(); x.fillStyle = rgr(x, -30, -40, 10, 0, 0, R, [[0, '#a8cf62'], [0.35, '#7fb24a'], [0.75, '#5a9438'], [1, '#3d7a2a']]); x.fill();
  x.save(); lp(); x.clip();
  for (let i = 0; i < 22; i++) { const a = i / 22 * TAU; x.fillStyle = i % 2 ? 'rgba(30,70,20,0.10)' : 'rgba(200,240,150,0.06)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R + 10, a, a + TAU / 22); x.closePath(); x.fill(); }
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU + 0.07;
    x.strokeStyle = 'rgba(215,240,170,0.3)'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(Math.cos(a + 0.05) * R * 0.5, Math.sin(a + 0.05) * R * 0.5, Math.cos(a) * R, Math.sin(a) * R); x.stroke();
    x.lineWidth = 2;
    for (const f of [0.45, 0.7]) { const bx = Math.cos(a) * R * f, by = Math.sin(a) * R * f; for (const sd of [-1, 1]) { const aa = a + sd * 0.12; x.beginPath(); x.moveTo(bx, by); x.lineTo(Math.cos(aa) * R * (f + 0.25), Math.sin(aa) * R * (f + 0.25)); x.stroke(); } }
  }
  x.fillStyle = 'rgba(255,255,255,0.12)'; ell(x, -R * 0.35, -R * 0.4, R * 0.35, R * 0.18, -0.6); x.fill();
  for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(255,255,255,0.25)'; const a = r() * TAU, d = r() * R * 0.9; ell(x, Math.cos(a) * d, Math.sin(a) * d, 2 + r() * 3, 2 + r() * 3); x.fill(); }
  x.restore();
  x.fillStyle = '#d8eaa0'; ell(x, 0, 0, 20, 20); x.fill(); x.strokeStyle = 'rgba(60,100,30,0.6)'; x.lineWidth = 2; x.stroke();
  lp(); x.strokeStyle = '#2a5a1c'; x.lineWidth = 4; x.stroke();
  x.strokeStyle = 'rgba(190,230,140,0.55)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R - 8, PI * 1.05, PI * 1.6); x.stroke();
  return (LEAF = c);
}
function bunSprite() {
  if (BUN) return BUN;
  const R = 90, N = R * 2 + 20, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2, r = rng(81);
  x.translate(h, h); x.lineCap = 'round';
  x.fillStyle = 'rgba(0,0,0,0.3)'; ell(x, 6, 8, R, R * 0.92); x.fill();
  x.fillStyle = '#e8e0cc'; ell(x, 0, 0, R * 0.92, R * 0.86); x.fill();
  for (let i = 0; i < 80; i++) {
    const a = r() * TAU, d = r() * R * 0.45, cx = Math.cos(a) * d, cy = Math.sin(a) * d, rx = 22 + r() * 40, ry = rx * (0.5 + r() * 0.4), rt = r() * PI, a0 = r() * TAU;
    x.strokeStyle = 'rgba(150,135,110,0.7)'; x.lineWidth = 5.5; x.beginPath(); x.ellipse(cx, cy, rx, ry, rt, a0, a0 + 2.2); x.stroke();
    x.strokeStyle = i % 4 ? '#fbf8ef' : '#efe8d8'; x.lineWidth = 3.4; x.beginPath(); x.ellipse(cx, cy, rx, ry, rt, a0, a0 + 2.2); x.stroke();
  }
  x.fillStyle = 'rgba(255,255,255,0.35)'; ell(x, -R * 0.3, -R * 0.35, R * 0.3, R * 0.18, -0.5); x.fill();
  return (BUN = c);
}
function bunCoil(ctx, x, y, s = 1) { const c = bunSprite(); ctx.drawImage(c, x - c.width / 2 * s, y - c.height / 2 * s, c.width * s, c.height * s); }
function cucumberSlice(ctx, x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ell(ctx, 0, 0, 34, 32); ctx.fillStyle = '#2f6a2a'; ctx.fill(); ctx.strokeStyle = 'rgba(15,40,15,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ell(ctx, 0, 0, 29.5, 27.5); ctx.fillStyle = '#cfe8a6'; ctx.fill();
  ell(ctx, 0, 0, 16, 14); ctx.fillStyle = '#e8f4c8'; ctx.fill();
  ctx.fillStyle = 'rgba(200,215,150,0.95)'; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.3; ell(ctx, Math.cos(a) * 8, Math.sin(a) * 7, 4, 2.4, a); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -10, -12, 8, 4, -0.6); ctx.fill();
  ctx.restore();
}
function starSlice(ctx, x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.lineJoin = 'round';
  const star = (R, ri) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? ri : R; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); };
  star(40, 22); ctx.fillStyle = '#9cbc38'; ctx.fill(); ctx.strokeStyle = 'rgba(50,70,10,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
  star(35, 19); ctx.fillStyle = rgr(ctx, 0, 0, 2, 0, 0, 36, [[0, '#f4f8b0'], [1, '#d4e470']]); ctx.fill();
  ctx.strokeStyle = 'rgba(150,170,60,0.7)'; ctx.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.stroke(); }
  ctx.fillStyle = '#7a6a2a'; for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; ell(ctx, Math.cos(a) * 11, Math.sin(a) * 11, 2.5, 1.5, a); ctx.fill(); }
  ctx.restore();
}
function rauMuong(ctx, x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // two hollow stems with arrow leaves, stems run toward −y
  for (const [ox, bend, ln] of [[-8, -0.15, 210], [10, 0.12, 190]]) {
    const ex = ox + bend * ln, ey = -ln;
    ctx.strokeStyle = '#4e7e2a'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(ox, 0); ctx.quadraticCurveTo(ox + bend * ln * 0.2, -ln * 0.5, ex, ey); ctx.stroke();
    ctx.strokeStyle = '#8cc456'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = 'rgba(230,250,200,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    for (const f of [0.45, 0.72, 1]) {
      const px = lerp(ox, ex, f), py = lerp(0, ey, f), sd = f === 0.72 ? -1 : 1;
      ctx.save(); ctx.translate(px, py); ctx.rotate(sd * 0.7 + bend - PI / 2 + (f === 1 ? 0.9 - sd * 0.7 : 0));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(20, -18, 70, 0); ctx.quadraticCurveTo(20, 18, 0, 0); ctx.lineTo(-10, 12); ctx.lineTo(4, 0); ctx.lineTo(-10, -12); ctx.closePath();
      ctx.fillStyle = lgr(ctx, 0, -14, 0, 14, [[0, '#7ac04a'], [1, '#3e8a2a']]); ctx.fill(); ctx.strokeStyle = 'rgba(20,50,15,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.strokeStyle = 'rgba(210,245,170,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(60, 0); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}
function herbsBundle(ctx, x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  BX.herbLeaf(ctx, -10, 40, 0.95, -0.55, 'lettuce');
  BX.herbLeaf(ctx, 20, 40, 0.85, 0.35, 'lettuce');
  rauMuong(ctx, 0, 60, 0.8, -0.1);
  for (const [lx, a, kd] of [[-30, -0.9, 'hung'], [-12, -0.4, 'hung'], [8, 0.1, 'diepca'], [26, 0.6, 'hung'], [40, 1.0, 'diepca'], [-40, -1.3, 'diepca'], [0, -0.15, 'hung']]) BX.herbLeaf(ctx, lx * 0.6, 70, 1.25, a, kd);
  ctx.strokeStyle = '#8a3a6a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-12 + i * 8, 92); ctx.lineTo(-8 + i * 5, 60); ctx.stroke(); }
  ctx.restore();
}
function dienDien(ctx, x, y, s = 1, seed = 91) {
  const r = rng(seed);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tips = [];
  ctx.strokeStyle = '#5a8a30'; ctx.lineWidth = 3.5;
  for (let i = 0; i < 6; i++) { const a = -PI / 2 + (i - 2.5) * 0.42 + (r() - 0.5) * 0.2, ln = 70 + r() * 50, ex = Math.cos(a) * ln, ey = 40 + Math.sin(a) * ln; ctx.beginPath(); ctx.moveTo(0, 40); ctx.quadraticCurveTo(ex * 0.3, 40 + (ey - 40) * 0.6, ex, ey); ctx.stroke(); tips.push([ex, ey]); }
  for (const [tx, ty] of tips) {
    for (let j = 0; j < 4; j++) {
      const fx = tx + (r() - 0.5) * 46, fy = ty + (r() - 0.5) * 40, a = r() * TAU;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-18, -8, -14, -24, 0, -20); ctx.bezierCurveTo(14, -24, 18, -8, 0, 0); ctx.fillStyle = '#ffd436'; ctx.fill(); ctx.strokeStyle = 'rgba(150,90,0,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, 10, 0, 14); ctx.quadraticCurveTo(8, 10, 0, 0); ctx.fillStyle = '#f0a01e'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,220,0.7)'; ell(ctx, -4, -13, 4, 2.5, -0.5); ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}
function chiliSalt(ctx, x, y, s = 1, o = {}) {
  const k = clamp(o.k || 0), t = o.t || 0, top = o.view === 'top', ry = top ? 1 : 0.45, R = 90, r = rng(101);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
  if (!top) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ell(ctx, 6, 46, R * 0.85, R * 0.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * ry, 0, 0, PI); ctx.bezierCurveTo(-R * 0.95, 30, -R * 0.65, 42, -R * 0.5, 44); ctx.lineTo(R * 0.5, 44); ctx.bezierCurveTo(R * 0.65, 42, R * 0.95, 30, R, 0); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#9aa6b4'], [0.35, '#f4f6f8'], [0.7, '#d0d8e0'], [1, '#7a8696']]); ctx.fill(); ctx.strokeStyle = 'rgba(30,35,45,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = '#3a68b0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 14, R * 0.93, R * ry * 0.9, 0, 0.15, PI - 0.15); ctx.stroke();
  } else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 6, 8, R, R); ctx.fill(); }
  ell(ctx, 0, 0, R, R * ry); ctx.fillStyle = '#f6f8fa'; ctx.fill(); ctx.strokeStyle = 'rgba(30,35,45,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
  if (top) { ctx.strokeStyle = '#3a68b0'; ctx.lineWidth = 3; ell(ctx, 0, 0, R - 5, R - 5); ctx.stroke(); }
  const ri = R - 12;
  ell(ctx, 0, top ? 0 : 3, ri, ri * ry); ctx.fillStyle = rgr(ctx, 0, 0, 4, 0, 0, ri, [[0, '#f8b896'], [0.7, '#ee8a62'], [1, '#c8603e']]); ctx.fill();
  ctx.save(); ell(ctx, 0, top ? 0 : 3, ri, ri * ry); ctx.clip();
  for (let i = 0; i < 70; i++) { const a = r() * TAU, d = Math.sqrt(r()) * ri, px = Math.cos(a) * d, py = Math.sin(a) * d * ry + (top ? 0 : 3); if (i % 3 === 0) { ctx.fillStyle = '#fff8f0'; ell(ctx, px, py, 2, 2 * Math.max(0.6, ry)); } else { ctx.fillStyle = i % 2 ? '#c41c14' : '#e83a1e'; ell(ctx, px, py, 3 + r() * 3, (2 + r() * 2) * Math.max(0.5, ry), r() * PI); } ctx.fill(); }
  if (k > 0) {
    const wr = 12 + 52 * ease.out(k), wx = -8, wy = (top ? 2 : 4);
    ell(ctx, wx, wy, wr, wr * ry); ctx.fillStyle = `rgba(150,30,20,${0.45 * Math.min(1, k * 3)})`; ctx.fill();
    ell(ctx, wx, wy, wr * 0.8, wr * 0.8 * ry); ctx.fillStyle = `rgba(200,70,40,${0.35 * Math.min(1, k * 3)})`; ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * Math.min(1, k * 3)})`; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(wx, wy, wr * 0.7, wr * 0.7 * ry, 0, PI * 1.1, PI * 1.45); ctx.stroke();
    ctx.fillStyle = `rgba(230,240,170,${0.8 * k})`; for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4, d = wr * 0.5 * (0.4 + (i % 3) * 0.25); ell(ctx, wx + Math.cos(a) * d, wy + Math.sin(a) * d * ry, 3.5, 2.2 * Math.max(0.6, ry), a); ctx.fill(); }
    L.sparkle(ctx, wx - wr * 0.3, wy - wr * 0.3 * ry, 16 * (0.6 + 0.4 * Math.sin(t * 5)), 0.8 * Math.min(1, k * 3));
  }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(0, 0, R - 3, (R - 3) * ry, 0, PI * 1.05, PI * 1.5); ctx.stroke(); ctx.restore();
  ctx.restore();
  return { center: [x, y], rim: [x, y - R * ry * s], rx: R * s, ry: R * ry * s };
}
function lime(ctx, x, y, s = 1, o = {}) {
  const sq = clamp(o.squeeze || 0), half = o.half !== false, rot = o.rot || 0, R = 55;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * (1 + 0.18 * sq), s * (1 - 0.22 * sq)); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let drip;
  if (half) {
    // dome (rind) above, cut face below
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.95, 0, PI, TAU); ctx.ellipse(0, 0, R, R * 0.32, 0, 0, PI); ctx.closePath();
    ctx.fillStyle = rgr(ctx, -R * 0.35, -R * 0.55, 4, 0, -R * 0.2, R * 1.1, [[0, '#b8e060'], [0.5, '#6aaa2a'], [1, '#2f6a16']]); ctx.fill();
    ctx.strokeStyle = 'rgba(20,45,10,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(30,70,15,0.35)'; const r = rng(7); for (let i = 0; i < 26; i++) { const a = PI + r() * PI, d = r() * 0.9; ell(ctx, Math.cos(a) * R * d, Math.sin(a) * R * 0.9 * d, 1.6, 1.6); ctx.fill(); }
    if (sq > 0) { ctx.strokeStyle = `rgba(20,50,10,${0.6 * sq})`; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { const xx = -R * 0.6 + i * R * 0.4; ctx.beginPath(); ctx.moveTo(xx, -R * 0.75); ctx.quadraticCurveTo(xx + 8, -R * 0.4, xx - 4, -R * 0.05); ctx.stroke(); } }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -R * 0.38, -R * 0.6, R * 0.2, R * 0.1, -0.5); ctx.fill();
    // cut face (lower half of the ellipse visible)
    ctx.save(); ctx.beginPath(); ctx.rect(-R - 5, 0, R * 2 + 10, R); ctx.clip();
    ell(ctx, 0, 0, R - 2, R * 0.32 - 1); ctx.fillStyle = '#f2f8dc'; ctx.fill();
    ell(ctx, 0, 0, R - 7, R * 0.32 - 4); ctx.fillStyle = '#d6ea7a'; ctx.fill();
    ctx.strokeStyle = 'rgba(245,250,225,0.9)'; ctx.lineWidth = 1.8; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (R - 8), Math.sin(a) * (R * 0.32 - 4)); ctx.stroke(); }
    ctx.restore();
    drip = [0, R * 0.32];
    if (sq > 0.05) { ctx.fillStyle = 'rgba(220,240,150,0.9)'; ell(ctx, 4, R * 0.32 + 6 * sq, 4 * sq + 1, 6 * sq + 1); ctx.fill(); }
  } else {
    ell(ctx, 0, 0, R, R * 0.85); ctx.fillStyle = rgr(ctx, -R * 0.35, -R * 0.4, 4, 0, 0, R * 1.1, [[0, '#b8e060'], [0.5, '#6aaa2a'], [1, '#2f6a16']]); ctx.fill(); ctx.strokeStyle = 'rgba(20,45,10,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ell(ctx, R - 2, 0, 6, 5); ctx.fillStyle = '#4a7a1e'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -R * 0.35, -R * 0.4, R * 0.22, R * 0.1, -0.5); ctx.fill();
    drip = [0, R * 0.85];
  }
  ctx.restore();
  const M = mapper(x, y, rot, s);
  const d = M(drip[0] * (1 + 0.18 * sq), drip[1] * (1 - 0.22 * sq));
  return { drip: d, center: [x, y] };
}
function limeDrops(ctx, from, to, k, o = {}) {
  const n = o.n ?? 6, s = o.s ?? 1;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const p0 = k * 1.6 - i * 0.11;
    if (p0 <= 0) continue;
    if (p0 < 1) {
      const p = p0, px = lerp(from[0], to[0], p) + Math.sin(i * 2.1) * 6 * s * p, py = lerp(from[1], to[1], p * p), z = (5 + (i % 3) * 1.5) * s;
      ctx.fillStyle = 'rgba(225,245,150,0.9)'; ctx.strokeStyle = 'rgba(110,140,30,0.7)'; ctx.lineWidth = 1.4 * s;
      ctx.beginPath(); ctx.moveTo(px, py - z * 2.2); ctx.bezierCurveTo(px + z, py - z * 0.4, px + z, py + z, px, py + z); ctx.bezierCurveTo(px - z, py + z, px - z, py - z * 0.4, px, py - z * 2.2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(ctx, px - z * 0.35, py - z * 0.1, z * 0.25, z * 0.35); ctx.fill();
    } else if (p0 < 1.4) {
      const q = (p0 - 1) / 0.4, rr = (6 + 24 * q) * s;
      ctx.strokeStyle = `rgba(240,250,200,${0.8 * (1 - q)})`; ctx.lineWidth = 2 * s; ell(ctx, to[0] + (i - n / 2) * 3 * s, to[1], rr, rr * 0.4); ctx.stroke();
    }
  }
  ctx.restore();
}

// ================================================================================================= LOTUS SPREAD
function lotusSpread(ctx, x, y, s = 1, o = {}) {
  const k = o.k ?? 1, t = o.t || 0, view = o.view || 'top', ryr = view === 'angle' ? (o.ryr ?? 0.52) : 1, q = lerp(ryr, 1, 0.35);
  const P = (X, Y) => [x + X * s, y + Y * s * ryr];
  const win = (i) => clamp((k - i * 0.14) / 0.16);
  const out = {};
  ctx.save();
  // tray (with side band in angle view) + leaf
  const tr = traySprite(), lf = leafSprite();
  if (view === 'angle') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ell(ctx, x + 10 * s, y + 46 * s, 440 * s, 440 * s * ryr); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x, y, 430 * s, 430 * s * ryr, 0, 0, PI); ctx.lineTo(x - 430 * s, y + 26 * s); ctx.ellipse(x, y + 26 * s, 430 * s, 430 * s * ryr, 0, PI, 0, true); ctx.closePath();
    ctx.fillStyle = lgr(ctx, x - 430 * s, 0, x + 430 * s, 0, [[0, '#5a3a18'], [0.4, '#a87a3e'], [1, '#4a2e12']]); ctx.fill();
  } else { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ell(ctx, x + 12 * s, y + 18 * s, 440 * s, 440 * s); ctx.fill(); }
  ctx.drawImage(tr, x - tr.width / 2 * s, y - tr.height / 2 * s * ryr, tr.width * s, tr.height * s * ryr);
  ctx.drawImage(lf, x - lf.width / 2 * s, y - lf.height / 2 * s * ryr, lf.width * s, lf.height * s * ryr);
  const item = (i, X, Y, fn, drop) => {
    const w = win(i); const p = P(X, Y); out[i] = p;
    if (w <= 0) return p;
    const e = drop ? ease.out(w) : ease.outBack(w), sc = drop ? 1 : Math.max(0.01, e);
    ctx.save(); ctx.translate(p[0], p[1] - (drop ? (1 - e) * 260 * s : 0)); ctx.scale(s * sc, s * sc * q); ctx.globalAlpha *= Math.min(1, w * 3);
    fn(); ctx.restore(); return p;
  };
  // z-order: paper, bún, slices, fish, herbs, flowers, salt  (pop order: fish0 herbs1 flowers2 paper3 bun4 slices5 salt6)
  const aPaper = item(3, 250, 40, () => { for (let j = 0; j < 3; j++) { ell(ctx, j * 4 - 6, -j * 6, 170 * 0.62 + 1, 170 * 0.62 + 1); ctx.fillStyle = 'rgba(236,226,206,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(170,150,120,0.7)'; ctx.lineWidth = 1.6; ctx.stroke(); } NP.ricePaper(ctx, 6, -18, 0.62, { rot: 0.9 }); });
  const aBun = item(4, -215, 170, () => bunCoil(ctx, 0, 0, 1));
  const aSl = item(5, 30, 250, () => { cucumberSlice(ctx, -70, 0, 1, 0.2); cucumberSlice(ctx, -35, 10, 1, 0.8); cucumberSlice(ctx, 0, 2, 1, 1.4); starSlice(ctx, 40, -6, 1, 0.2); starSlice(ctx, 80, 8, 1, 0.7); starSlice(ctx, 118, -4, 0.95, 0.4); });
  let fishA = null;
  const aFish = item(0, -10, -10, () => { if (o.fish !== false) fishA = snakehead(ctx, 0, 0, 0.95, { state: 'plated', rot: -0.22, t, steam: 0, seed: 5, rim: 0.4 }); }, true);
  const aHerb = item(1, -205, -235, () => herbsBundle(ctx, 0, 0, 1, -0.5));
  const aFlow = item(2, 175, -255, () => dienDien(ctx, 0, 0, 1));
  const aSalt = item(6, 255, 250, () => chiliSalt(ctx, 0, 0, 0.85, { k: o.saltK || 0, t, view: 'top' }));
  ctx.restore();
  // steam over the fish (screen space)
  const st = (o.steam ?? 1) * win(0);
  if (st > 0 && o.fish !== false) FX.steamWisps(ctx, aFish[0], aFish[1] - 10 * s, s, { t, k: st, w: 300, h: 360, n: 5, seed: 7, warm: 0.15 });
  return { fish: aFish, herbs: aHerb, flowers: aFlow, paper: aPaper, bun: aBun, slices: aSl, salt: aSalt, fishA };
}

// ================================================================================================= RICE PAPER ROLL
const ROLLC = new Map();
function rollContentItems(seed) {
  if (ROLLC.has(seed)) return ROLLC.get(seed);
  const r = rng(seed), herbs = [], flakes = [], bun = [];
  for (let i = 0; i < 11; i++) herbs.push({ x: -120 + i * 24 + (r() - 0.5) * 12, y: 58 + (r() - 0.5) * 40, a: (r() - 0.5) * 1.2 + (i % 2 ? PI : 0), len: 54 + r() * 26, kind: i % 3, ph: r() });
  for (let i = 0; i < 13; i++) flakes.push({ x: -112 + i * 18.5 + (r() - 0.5) * 10, y: 66 + (r() - 0.5) * 30, rx: 15 + r() * 9, ry: 9 + r() * 5, a: r() * PI, ph: r() });
  for (let i = 0; i < 12; i++) bun.push({ x: -105 + r() * 210, y: 58 + (r() - 0.5) * 38, w: 70 + r() * 60, c: (r() - 0.5) * 16, ph: r() });
  const o = { herbs, flakes, bun }; ROLLC.set(seed, o); return o;
}
function miniLeaf(ctx, x, y, len, a, kind) {
  const cols = [['#8fd056', '#3e8a2a'], ['#5aa83a', '#22661e'], ['#b4e070', '#6aae36']][kind];
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.quadraticCurveTo(0, -len * 0.38, len / 2, 0); ctx.quadraticCurveTo(0, len * 0.38, -len / 2, 0); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, -len * 0.3, 0, len * 0.3, [[0, cols[0]], [1, cols[1]]]); ctx.fill(); ctx.strokeStyle = 'rgba(20,50,15,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(220,250,190,0.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len * 0.4, 0); ctx.stroke();
  ctx.restore();
}
function rollContents(ctx, C, kH, kF, kB) {
  for (const h of C.herbs) { const w = clamp((kH - h.ph * 0.6) / 0.4); if (w > 0) miniLeaf(ctx, h.x, h.y, h.len * ease.outBack(w), h.a, h.kind); }
  for (const b of C.bun) { const w = clamp((kB - b.ph * 0.6) / 0.4); if (w <= 0) continue; ctx.strokeStyle = 'rgba(150,135,110,0.7)'; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(b.x - b.w / 2 * w, b.y); ctx.quadraticCurveTo(b.x, b.y + b.c, b.x + b.w / 2 * w, b.y); ctx.stroke(); ctx.strokeStyle = '#fbf8ef'; ctx.lineWidth = 3.6; ctx.stroke(); }
  for (const f of C.flakes) { const w = clamp((kF - f.ph * 0.6) / 0.4); if (w <= 0) continue; const e = ease.outBack(w); ell(ctx, f.x, f.y, f.rx * e, f.ry * e, f.a); ctx.fillStyle = '#fbf6ea'; ctx.fill(); ctx.strokeStyle = 'rgba(190,170,140,0.9)'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.fillStyle = 'rgba(30,20,10,0.7)'; ell(ctx, f.x + f.rx * 0.4 * e, f.y - f.ry * 0.3 * e, 2.6, 2); ctx.fill(); }
}
function paperFill(a = 0.6) { return `rgba(244,238,226,${a})`; }
function capsule(ctx, cx, cy, hw, rr, C, o = {}) {
  const path = new Path2D(); path.moveTo(cx - hw, cy - rr); path.lineTo(cx + hw, cy - rr); path.arc(cx + hw, cy, rr, -PI / 2, PI / 2); path.lineTo(cx - hw, cy + rr); path.arc(cx - hw, cy, rr, PI / 2, PI * 1.5); path.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.save(); ctx.translate(6, 10); ctx.fill(path); ctx.restore();
  ctx.save(); ctx.clip(path);
  ctx.fillStyle = '#f2ece0'; ctx.fill(path);
  // contents seen through the paper: herb band, white flakes, bún streaks
  const r = rng(o.seed ?? 3);
  for (let i = 0; i < 9; i++) miniLeaf(ctx, cx - hw + (i + 0.5) * (hw * 2 / 9) + (r() - 0.5) * 8, cy - rr * 0.15 + (r() - 0.5) * rr * 0.5, rr * (1 + r() * 0.4), (r() - 0.5) * 0.7 + (i % 2 ? PI : 0), i % 3);
  for (let i = 0; i < 10; i++) { ell(ctx, cx - hw + r() * hw * 2, cy + rr * 0.3 + (r() - 0.5) * rr * 0.5, 12 + r() * 8, 6 + r() * 3, r()); ctx.fillStyle = '#fbf6ea'; ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,252,245,0.9)'; ctx.lineWidth = 2.5; for (let i = 0; i < 6; i++) { const yy = cy + (r() - 0.3) * rr; ctx.beginPath(); ctx.moveTo(cx - hw - rr, yy); ctx.quadraticCurveTo(cx, yy + (r() - 0.5) * 14, cx + hw + rr, yy + (r() - 0.5) * 8); ctx.stroke(); }
  // translucent paper layer + volume shading
  ctx.fillStyle = paperFill(0.42); ctx.fill(path);
  ctx.fillStyle = lgr(ctx, 0, cy - rr, 0, cy + rr, [[0, 'rgba(255,255,255,0.5)'], [0.35, 'rgba(255,255,255,0.08)'], [0.75, 'rgba(120,100,80,0.12)'], [1, 'rgba(80,60,40,0.35)']]); ctx.fill(path);
  ctx.strokeStyle = 'rgba(190,175,150,0.55)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { const xx = cx - hw + i * hw * 0.4; ctx.beginPath(); ctx.moveTo(xx - 10, cy - rr); ctx.quadraticCurveTo(xx + 14, cy, xx + 4, cy + rr); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - hw * 0.8, cy - rr * 0.55); ctx.lineTo(cx + hw * 0.6, cy - rr * 0.55); ctx.stroke();
  if (o.dip > 0) { ctx.save(); ctx.beginPath(); ctx.rect(cx + hw + rr - (40 + 40 * o.dip), cy - rr - 2, 200, rr * 2 + 4); ctx.clip(); ctx.fillStyle = `rgba(236,118,78,${0.6 * Math.min(1, o.dip * 2)})`; ctx.fill(path); ctx.fillStyle = '#c41c14'; for (let i = 0; i < 14; i++) { ell(ctx, cx + hw + rr - r() * (40 + 40 * o.dip), cy + (r() - 0.5) * rr * 1.7, 2.5, 1.8, r()); ctx.fill(); } ctx.restore(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(150,130,100,0.8)'; ctx.lineWidth = 2; ctx.stroke(path);
  // leaf tips poking from the −x end
  miniLeaf(ctx, cx - hw - rr - 6, cy - rr * 0.2, 30, PI + 0.3, 0); miniLeaf(ctx, cx - hw - rr - 2, cy + rr * 0.25, 24, PI - 0.4, 1);
  return path;
}
function ricePaperRoll(ctx, x, y, s = 1, o = {}) {
  const stage = o.stage || 'flat', k = clamp(o.k ?? 1), t = o.t || 0, seed = o.seed ?? 3, wet = o.wet ?? 0.85, C = rollContentItems(seed);
  const rot = o.rot || 0, M = mapper(x, y, rot, s);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  let anchors = { center: [x, y], tipA: M(-170, 0), tipB: M(170, 0), bite: M(170, 0) };
  if (stage === 'flat' || stage === 'filled') {
    NP.ricePaper(ctx, 0, 0, 1, { wet });
    if (stage === 'filled') rollContents(ctx, C, k * 2.2, k * 2.2 - 0.66, k * 2.2 - 1.32);
  } else if (stage === 'rolled' && k < 0.5) {
    const f1 = ease.inOut(clamp(k / 0.3)), f2 = ease.inOut(clamp((k - 0.3) / 0.2));
    const yCut = 105 + 65 * (1 - f1), xCut = f2 > 0 ? 128 : 172;
    ctx.save(); ctx.beginPath(); ctx.rect(-xCut, -200, xCut * 2, 200 + yCut); ctx.clip(); NP.ricePaper(ctx, 0, 0, 1, { wet }); ctx.restore();
    rollContents(ctx, C, 1, 1, 1);
    // bottom flap folding up
    if (f1 > 0) {
      const ch = Math.sqrt(170 * 170 - 105 * 105), ap = 105 - 65 * f1;
      ctx.beginPath(); ctx.moveTo(-ch, 105); ctx.quadraticCurveTo(0, ap - 65 * f1 * 0.9, ch, 105); ctx.closePath();
      ctx.fillStyle = paperFill(0.55 + 0.2 * f1); ctx.fill(); ctx.strokeStyle = 'rgba(170,150,120,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-ch * 0.7, 100); ctx.lineTo(ch * 0.7, 100); ctx.stroke();
    }
    if (f2 > 0) for (const sd of [-1, 1]) {
      // side flap = the circle segment beyond x=128, hinged on the fold line and swinging over (cos foreshortening)
      const cf = Math.cos(f2 * PI), yT = -Math.sqrt(170 * 170 - 128 * 128), yB = Math.min(105, -yT);
      ctx.beginPath(); ctx.moveTo(sd * 128, yT);
      for (let j = 0; j <= 16; j++) { const yy = yT + (yB - yT) * (j / 16), ex = Math.sqrt(Math.max(0, 170 * 170 - yy * yy)); ctx.lineTo(sd * (128 + cf * (ex - 128)), yy); }
      ctx.lineTo(sd * 128, yB); ctx.closePath();
      ctx.fillStyle = paperFill(f2 > 0.5 ? 0.78 : 0.6); ctx.fill(); ctx.strokeStyle = 'rgba(170,150,120,0.7)'; ctx.lineWidth = 2; ctx.stroke();
      if (f2 > 0.5) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sd * 124, yT + 14); ctx.lineTo(sd * 124, yB - 10); ctx.stroke(); }
    }
  } else if (stage === 'rolled') {
    const f3 = ease.inOut(clamp((k - 0.5) / 0.5)), yc = 70 * (1 - f3), rr = lerp(30, 42, f3), hw = lerp(110, 98, f3), pTop = -170 + 120 * f3;
    const slA = 1 - smooth(clamp((f3 - 0.7) / 0.25));
    if (yc - rr > pTop + 2 && slA > 0.01) {
      ctx.save(); ctx.globalAlpha *= slA; ctx.beginPath(); ctx.rect(-128, pTop - 60, 256, yc - pTop + 60); ctx.clip(); ctx.translate(0, 120 * f3);
      NP.ricePaper(ctx, 0, 0, 1, { wet }); ctx.restore();
      ctx.save(); ctx.globalAlpha *= (1 - f3 * 0.5) * slA; ctx.strokeStyle = 'rgba(170,150,120,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-128, pTop + 40); ctx.lineTo(-128, yc); ctx.moveTo(128, pTop + 40); ctx.lineTo(128, yc); ctx.stroke(); ctx.restore();
    }
    capsule(ctx, 0, yc, hw, rr, C, { seed, dip: 0 });
    anchors = { center: M(0, yc), tipA: M(-hw - rr, yc), tipB: M(hw + rr, yc), bite: M(hw + rr, yc) };
  } else {
    // bitten (also the finished roll when k is unused)
    const hw = 98, rr = 42;
    const bx = hw + rr;
    if (stage === 'bitten') {
      ctx.save(); ctx.beginPath(); ctx.rect(-1000, -1000, 2000, 2000);
      const N = 30; for (let j = 0; j <= N; j++) { const v = j / N, yy = -rr - 6 + v * (rr * 2 + 12), xx = bx - 46 - 13 * Math.abs(Math.sin(v * 3 * PI)); j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.lineTo(bx + 60, rr + 6); ctx.lineTo(bx + 60, -rr - 6); ctx.closePath(); ctx.clip('evenodd');
      const path = capsule(ctx, 0, 0, hw, rr, C, { seed, dip: o.dip || 0 });
      ctx.restore();
      // cross-section along the bite
      ctx.save(); ctx.clip(path);
      ctx.beginPath(); const N2 = 30; for (let j = 0; j <= N2; j++) { const v = j / N2, yy = -rr - 6 + v * (rr * 2 + 12), xx = bx - 46 - 13 * Math.abs(Math.sin(v * 3 * PI)); j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      for (let j = N2; j >= 0; j--) { const v = j / N2, yy = -rr - 6 + v * (rr * 2 + 12), xx = bx - 46 - 13 * Math.abs(Math.sin(v * 3 * PI)) - 12; ctx.lineTo(xx, yy); }
      ctx.closePath(); ctx.fillStyle = '#f6f0e0'; ctx.fill();
      ctx.restore();
      ctx.save(); ctx.beginPath(); const N3 = 30; for (let j = 0; j <= N3; j++) { const v = j / N3, yy = -rr * 0.85 + v * rr * 1.7, xx = bx - 46 - 13 * Math.abs(Math.sin((yy + rr + 6) / (rr * 2 + 12) * 3 * PI)); j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
      ctx.strokeStyle = 'rgba(150,130,100,0.9)'; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#5fae3a'; for (let i = 0; i < 5; i++) { const yy = -rr * 0.6 + i * rr * 0.3; ell(ctx, bx - 52 - 13 * Math.abs(Math.sin((yy + rr + 6) / (rr * 2 + 12) * 3 * PI)), yy, 4, 7); ctx.fill(); }
      anchors = { center: [x, y], tipA: M(-hw - rr, 0), tipB: M(bx - 46, 0), bite: M(bx - 50, 0) };
    } else {
      capsule(ctx, 0, 0, hw, rr, C, { seed, dip: o.dip || 0 });
      anchors = { center: [x, y], tipA: M(-hw - rr, 0), tipB: M(hw + rr, 0), bite: M(hw + rr, 0) };
    }
  }
  ctx.restore();
  if (stage === 'bitten' && (o.steam ?? 1) > 0) FX.steamWisps(ctx, anchors.bite[0], anchors.bite[1] - 20 * s, s, { t, k: o.steam ?? 1, w: 70, h: 220, n: 3, seed: seed + 4, warm: 0.2 });
  return anchors;
}

// ================================================================================================= FISH BASKET (giỏ)
let WEAVE = null;
function weaveTile() {
  if (WEAVE) return WEAVE;
  const N = 48, c = createCanvas(N, N), x = c.getContext('2d');
  x.fillStyle = '#7a5426'; x.fillRect(0, 0, N, N);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const over = (row + col) % 2 === 0, px = col * 12, py = row * 12;
    x.fillStyle = over ? '#d2a764' : '#b48444'; x.fillRect(px + 0.5, py + 1, 11, 10);
    x.fillStyle = over ? 'rgba(255,240,200,0.45)' : 'rgba(255,230,180,0.2)'; x.fillRect(px + 1, py + 1.5, 10, 2.5);
    x.fillStyle = 'rgba(60,35,10,0.45)'; x.fillRect(px + 0.5, py + 9, 11, 2);
  }
  return (WEAVE = c);
}
function basketPath(ctx) {
  ctx.beginPath(); ctx.moveTo(-95, 0);
  ctx.quadraticCurveTo(-140, -8, -138, -90); ctx.bezierCurveTo(-136, -160, -70, -185, -58, -215); ctx.quadraticCurveTo(-56, -236, -82, -252);
  ctx.lineTo(82, -252); ctx.quadraticCurveTo(56, -236, 58, -215); ctx.bezierCurveTo(70, -185, 136, -160, 138, -90); ctx.quadraticCurveTo(140, -8, 95, 0);
  ctx.quadraticCurveTo(0, 14, -95, 0); ctx.closePath();
}
function fishBasket(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, nf = o.fish ?? 1, open = clamp(o.open ?? 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ell(ctx, 8, 6, 130, 22); ctx.fill();
  // mouth interior (back)
  ell(ctx, 0, -252, 80, 19); ctx.fillStyle = '#1c1108'; ctx.fill();
  // fish tails poking out
  if (nf > 0 && open > 0.3) {
    ctx.save(); ctx.beginPath(); ctx.rect(-400, -900, 800, 648); ctx.ellipse(0, -252, 80, 19, 0, 0, PI); ctx.clip();
    const cfg = [[-14, 0.12, 0], [28, -0.28, 1.7]];
    for (let i = 0; i < Math.min(2, nf); i++) { const [fx, tilt, ph] = nf === 1 ? [6, 0.05, 0] : cfg[i]; snakehead(ctx, fx, -218, 0.45, { rot: PI / 2 + tilt, state: 'alive', wiggle: 0.45, t: t + ph, rim: 0.7, seed: 11 + i }); }
    ctx.restore();
  }
  // body with weave
  basketPath(ctx); ctx.fillStyle = ctx.createPattern(weaveTile(), 'repeat'); ctx.fill();
  ctx.save(); basketPath(ctx); ctx.clip();
  ctx.fillStyle = lgr(ctx, -140, 0, 140, 0, [[0, 'rgba(20,10,0,0.6)'], [0.3, 'rgba(0,0,0,0)'], [0.55, 'rgba(255,230,180,0.1)'], [1, 'rgba(20,10,0,0.65)']]); ctx.fillRect(-150, -260, 300, 280);
  ctx.fillStyle = lgr(ctx, 0, -260, 0, 10, [[0, 'rgba(0,0,0,0)'], [0.8, 'rgba(0,0,0,0)'], [1, 'rgba(20,10,0,0.45)']]); ctx.fillRect(-150, -260, 300, 280);
  for (const yy of [-30, -150]) { ctx.strokeStyle = '#5a3a16'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, yy, 160, 18, 0, 0.1, PI - 0.1); ctx.stroke(); ctx.strokeStyle = 'rgba(230,190,120,0.6)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, yy - 3, 160, 18, 0, 0.2, PI - 0.2); ctx.stroke(); }
  ctx.restore();
  basketPath(ctx); ctx.strokeStyle = 'rgba(40,22,6,0.85)'; ctx.lineWidth = 3; ctx.stroke();
  // neck binding + rim
  ctx.strokeStyle = '#5a3a16'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, -215, 60, 12, 0, 0, PI); ctx.stroke();
  ctx.strokeStyle = '#6a4418'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, -252, 82, 19, 0, 0, PI); ctx.stroke();
  ctx.strokeStyle = '#d2a764'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -254, 82, 19, 0, 0.1, PI - 0.1); ctx.stroke();
  ctx.strokeStyle = '#6a4418'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, -252, 82, 19, 0, PI, TAU); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(170,205,255,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-136, -60); ctx.bezierCurveTo(-138, -150, -80, -180, -60, -212); ctx.stroke(); ctx.restore();
  if (o.strap) { ctx.strokeStyle = '#4a3418'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-58, -215); ctx.bezierCurveTo(-120, -300, -200, -360, -230, -440); ctx.stroke(); ctx.strokeStyle = 'rgba(200,170,110,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
  // lid
  if (open < 1) {
    const a = open * 1.3;
    ctx.save(); ctx.translate(82, -256); ctx.rotate(-a); ctx.translate(-82, 0);
    ctx.beginPath(); ctx.moveTo(-88, 0); ctx.quadraticCurveTo(-60, -60, 0, -70); ctx.quadraticCurveTo(60, -60, 88, 0); ctx.ellipse(0, 0, 88, 18, 0, 0, PI); ctx.closePath();
    ctx.fillStyle = ctx.createPattern(weaveTile(), 'repeat'); ctx.fill(); ctx.fillStyle = 'rgba(30,15,0,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(40,22,6,0.85)'; ctx.lineWidth = 3; ctx.stroke();
    ell(ctx, 0, -70, 10, 6); ctx.fillStyle = '#5a3a16'; ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  return { mouth: [x, y - 252 * s], bottom: [x, y], neck: [x, y - 215 * s] };
}

// ================================================================================================= NƠM (bamboo fish trap)
function nomTrap(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, k = clamp(o.k || 0), NS = 22, Ht = 420, ryr = 0.29;
  const rAt = (v) => 40 + 170 * Math.pow(v, 1.4), yAt = (v) => -Ht * (1 - v);
  const wl = -Ht * k;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha *= o.alpha ?? 1;
  const pass = (front) => {
    for (let i = 0; i < NS; i++) {
      const th = i / NS * TAU + 0.07, sn = Math.sin(th); if ((sn > 0) !== front) continue;
      ctx.beginPath(); for (let j = 0; j <= 10; j++) { const v = j / 10, R = rAt(v), px = R * Math.cos(th), py = yAt(v) + R * ryr * sn; j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.strokeStyle = front ? 'rgba(40,24,8,0.8)' : 'rgba(30,18,6,0.7)'; ctx.lineWidth = front ? 9 : 7; ctx.stroke();
      ctx.strokeStyle = front ? mixc('#c99b58', '#e8c483', (Math.cos(th) + 1) / 2 * 0.6) : '#6a4a22'; ctx.lineWidth = front ? 6 : 4.5; ctx.stroke();
      if (front) { ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.lineWidth = 1.6; ctx.stroke(); }
    }
    for (const v of [0.2, 0.45, 0.72, 1]) {
      const R = rAt(v), yy = yAt(v);
      ctx.beginPath(); ctx.ellipse(0, yy, R, R * ryr, 0, front ? 0 : PI, front ? PI : TAU);
      ctx.strokeStyle = front ? 'rgba(40,24,8,0.85)' : 'rgba(30,18,6,0.7)'; ctx.lineWidth = v === 1 ? 12 : 9; ctx.stroke();
      ctx.strokeStyle = front ? '#a87a3e' : '#5a3c1a'; ctx.lineWidth = v === 1 ? 8 : 5.5; ctx.stroke();
      if (front) { ctx.strokeStyle = 'rgba(30,18,6,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < NS; i++) { const th = i / NS * TAU + 0.07; if (Math.sin(th) <= 0) continue; const px = R * Math.cos(th), py = yy + R * ryr * Math.sin(th); ctx.beginPath(); ctx.moveTo(px - 4, py - 4); ctx.lineTo(px + 4, py + 4); ctx.stroke(); } }
    }
  };
  const whole = () => {
    pass(false);
    if (o.inside) { ctx.save(); o.inside(ctx); ctx.restore(); }
    pass(true);
    // top hand-hole ring with rattan binding
    ctx.strokeStyle = 'rgba(30,18,6,0.85)'; ctx.lineWidth = 16; ell(ctx, 0, -Ht, 42, 13); ctx.stroke();
    ctx.strokeStyle = '#8a6230'; ctx.lineWidth = 11; ell(ctx, 0, -Ht, 42, 13); ctx.stroke();
    ctx.strokeStyle = '#d8b070'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -Ht - 2, 42, 13, 0, PI * 1.05, PI * 1.95); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,24,8,0.7)'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, px = Math.cos(a) * 42, py = -Ht + Math.sin(a) * 13; ctx.beginPath(); ctx.moveTo(px - 3, py - 6); ctx.lineTo(px + 3, py + 6); ctx.stroke(); }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(170,205,255,0.45)'; ctx.lineWidth = 4; ctx.beginPath(); for (let j = 0; j <= 10; j++) { const v = j / 10, R = rAt(v); const px = -R * 0.98, py = yAt(v); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); ctx.restore();
  };
  if (k <= 0) whole();
  else {
    ctx.save(); ctx.beginPath(); ctx.rect(-400, -Ht - 100, 800, Ht + 100 + wl); ctx.clip(); whole(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(-400, wl, 800, Ht + 200); ctx.clip(); ctx.globalAlpha *= 0.4; whole(); ctx.restore();
    const vw = 1 - k, R = rAt(vw) * 1.06;
    ctx.strokeStyle = 'rgba(220,240,255,0.7)'; ctx.lineWidth = 3; ell(ctx, 0, wl, R, R * ryr); ctx.stroke();
    const p = (t * 0.8) % 1; ctx.strokeStyle = `rgba(220,240,255,${0.5 * (1 - p)})`; ctx.lineWidth = 2.5; ell(ctx, 0, wl, R * (1.1 + p * 0.6), R * ryr * (1.1 + p * 0.6)); ctx.stroke();
  }
  ctx.restore();
  return { top: [x, y - Ht * s], base: [x, y], waterline: [x, y + wl * s], rx: 210 * s };
}

module.exports = {
  snakehead, bambooSkewer, strawPile, strawArmful, strawScraps, lotusSpread, chiliSalt, lime, limeDrops, ricePaperRoll,
  fishBasket, nomTrap, herbsBundle, dienDien, bunCoil, cucumberSlice, starSlice, rauMuong, FISH_LEN: FL,
};
