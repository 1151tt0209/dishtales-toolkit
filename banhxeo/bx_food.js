// bx_food.js — "Bánh xèo miền Tây" food + kitchen tools. LOCAL in / LOCAL out (same convention as hp_food.js).
// THIS HEADER IS THE SOURCE OF TRUTH for the API.  const BX = require('./bxprops');  (re-exports everything below)
// =====================================================================================================================
// CONVENTIONS
//  • view: 'top' | '3q' | 'side' → ryr (vertical squash of the horizontal plane) 1 | 0.45 | 0.14. Any drawer that takes
//    view also accepts o.ryr to override. Objects are modelled lying in a horizontal plane, squashed by ryr; heights
//    (pan walls, lid dome, rising fold) go up the screen by z·sqrt(1-ryr²).
//  • rot (radians, +clockwise): for plane objects (pan contents, banhXeo) it is the rotation INSIDE the plane (before
//    the squash), so a folded crêpe keeps its perspective. For tools (knife, spatula, whisk, ladle) it is screen rot.
//  • Each drawer save()/restore()s; deterministic from o.t / o.seed; crêpe textures + herb basket are cached offscreen.
//  • Light: warm (fire / sunset) rim from the upper left, cartoon outline OUT = rgba(48,24,30,.6).
//  • Sizes below are at s = 1.
//
// ---------------------------------------------------------------- BATTER
//  batterBowl(ctx,x,y,s,{view='3q', fill=1, mix=1, turmeric (0..1 unmixed yellow powder on top; default 1-mix if mix<1
//        else 0), scallions=0, t, seed}) → {rim, center, surface, rx, ry, R}
//        stainless mixing bowl, origin = rim centre, R 200. mix 0 = white rice flour + coconut milk, 0..1 a golden turmeric
//        swirl turns (rotates with t), 1 = smooth golden batter. scallions 0..1 = green rings floating.
//  whisk(ctx,x,y,s,rot,{t, spin}) → {tip, grip, end}   balloon whisk, origin = bottom of the wire loops, handle up (−y),
//        length ≈330. spin (rad) rotates the loops (drawn squashed), t adds a little wobble.
//  ladle(ctx,x,y,s,rot,{flip, fill 0..1, col:'batter'|'broth'|'oil'}) → {cup, lip, grip, end}   same geometry as HP.ladle
//        (cup(0,0) r46, lip(-46,2), grip(250,-170), end(300,-205)) with a pale-turmeric batter fill.
//  pourStream(ctx,x0,y0,x1,y1,t,{col:'milk'|'batter'|'oil'|'sauce'|'flour', w=14, k=1 head, tail=0, splash=true, bend, seed, drops})
//        generic pour arc from (x0,y0) (spout) to (x1,y1) (landing point). k grows the head, tail cuts the start (ending pour).
//  turmericSprinkle(ctx,t,t0,x,y,{n=70, dur=1.1, w=70, g=900, floor, seed, s=1})   yellow powder falling from a pinch at
//        (x,y) during [t0, t0+dur]; stops at y = floor with a little dust puff.
//
// ---------------------------------------------------------------- SCALLIONS / BOARD / KNIFE
//  cuttingBoard(ctx,x,y,s,{view='3q'}) → {center, rx, ry, top}   round tamarind-wood board (thớt), R 260, 46 thick.
//  scallionBunch(ctx,x,y,s,{cut 0..1, rot, sq=1, seed}) → {cutX, pile, bulb, tip}   5 scallions lying along x (white bulbs
//        at x−190, green tips at x+190). cut: the knife line moves from x+190 to x−150; everything right of it becomes
//        a pile of rings. For on-beat chops use a stepped cut (e.g. cut = floor(beats)/4) and put the knife at ret.cutX.
//  scallionRings(ctx,x,y,s,{n=20, seed, spread=60, sq=1})   loose rings (to drop into batter / a handful).
//  knife(ctx,x,y,s,rot,{lift 0..1, flip}) ≡ cleaver(...) → {edge, tip, grip, end}  Vietnamese dao phay, origin = middle of
//        the blade edge, blade 260×110 above it (−y), handle toward +x. lift raises it 90px and tilts back.
//
// ---------------------------------------------------------------- PAN + CRÊPE (the hero)
//  pan(ctx,x,y,s,{view='3q', rot, handle=0.5 (rad, direction of the handle in the plane: 0 = right, π/2 = toward camera),
//        oil 0..1 (shimmer), t, + every crepeStage option below for the contents, contentRot}) →
//        {rim, center, floor, rx, ry, R, grip, handleEnd, crepeR, crepeCenter}
//        small cast-iron skillet with a wooden grip; origin = rim centre; rim R 245, inner 222, floor 205 (crêpe 200).
//        ret.rx/ry = inner rim ellipse (LOCAL). ret.floor = centre of the cooking floor (where crêpe/pour land).
//  crepeStage(ctx,x,y,s,{ryr|view, rot, t, seed, oil,
//        meat 0..1 (shrimp+pork pieces shown, default 1 if searing given), searing 0..1 (grey-pink → orange / browned),
//        batter 0..1 (film spreading from pourAt; default 1 if cook>0), pourAt [x,y] plane units (default [-60,-50]),
//        cook 0..1 (pale yellow → golden with brown LACY crispy edge + holes), sprouts 0..1, mungBeans 0..1,
//        fold 0..1 (top half lifts, stands up, lands on the bottom half: 3D-ish half-moon)})
//        the contents only (what pan() draws inside), origin = crêpe centre on the floor. Fillings sit on the bottom
//        half (y>0) so they end up inside the fold; a few sprouts / shrimp tails peek out of the curved edge.
//  banhXeo(ctx,x,y,s,{view='3q', rot, fold=1, crisp=1, steam 0..1, t, bite 0..1, biteA=1.15 (angle of the bite in the plane),
//        seed, centerFold=true, sprouts=1, mungBeans=1, meat=1, shadow=false}) → {center, edge, tip, R}
//        standalone crêpe (plate / flying / catching). R 200. With centerFold the folded half-moon (fold 1) is centred
//        on the origin: straight fold edge at the top, curved crispy edge toward the camera (rot = 0). fold 0 = open disc.
//  porkSlice(ctx,x,y,s,rot,{sear 0..1, sq}) ~90×36 pork-belly slice · shrimp(ctx,x,y,s,rot,{sear 0..1, sq}) ~70 shrimp
//  mungBeans(ctx,x,y,s,{n=14, seed, spread=50, sq})   split yellow mung beans · sprout(ctx,x,y,s,rot,{sq}) single bean sprout
//
// ---------------------------------------------------------------- TOOLS / TABLEWARE
//  lid(ctx,x,y,s,{view='3q', rot}) → {rim, knob, rx, ry}   domed aluminium lid, origin = rim centre, R 240, dome 80.
//  plate(ctx,x,y,s,{view='3q', shadow=true}) → {center, rx, ry, R}   white plate with blue rim (Vietnamese), R 300.
//  spatula(ctx,x,y,s,rot,{flip}) → {tip, blade, grip, end}   wooden turner, origin = blade front edge centre, handle +x,
//        blade 70 wide, total 390.
//  forkKnife(ctx,x,y,s,{rot, gap=70, kind:'both'|'fork'|'knife'}) → {forkTip, knifeTip, forkGrip, knifeGrip}
//        western cutlery standing up (tines/blade toward −y), origin = between the handles' bottoms, length 250.
//
// ---------------------------------------------------------------- HERBS / SAUCE / WRAP
//  herbLeaf(ctx,x,y,s,rot,kind,{sq=1, tint}) → {tip}   kind: 'mustard' (cải bẹ xanh, 240×170 crinkly), 'lettuce' (200×190 frilly),
//        'lacach' (lá cách, 60×48 glossy round), 'hung' (húng, 70×36 serrated), 'diepca' (diếp cá, 60×58 heart).
//        origin = stem base, leaf points toward −y (rotate with rot).
//  herbBasket(ctx,x,y,s,{view='3q', fill=1, seed}) → {rim, center, rx, ry}   round bamboo rổ, origin = rim centre, R 260,
//        overflowing with mustard leaves, lettuce, lá cách, húng, diếp cá (cached per view × fill/10).
//  fishSauceBowl(ctx,x,y,s,{view='3q', fill=1, chili 0..1, garlic 0..1, t, seed}) → {rim, surface, rx, ry, R}
//        small porcelain bowl (R 100) of amber nước mắm chua ngọt; chili rings + raw garlic bits float (counts ∝ k).
//  leafWrap(ctx,x,y,s,{k 0..1, rot, dip 0..1, seed}) → {tip, center, end}
//        k 0–.25 open mustard leaf · .15–.4 herbs laid in · .35–.55 a crêpe piece laid in · .55–1 rolled into a tight wrap
//        (cigar along y, tip toward −y). dip = amber sauce-wet tip. origin = centre of the leaf / wrap.
// =====================================================================================================================
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const HPF = require('./hp_food');
const { createCanvas } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease, at } = L;
const PI = Math.PI;
const { lgr, rgr, ell, rrect, outFill, rimLine, OUT } = NP;
const { LP } = HPF;

const RYR = { top: 1, '3q': 0.45, side: 0.14 };
const ryrOf = (o) => o.ryr ?? RYR[o.view || '3q'] ?? 0.45;
const cOf = (r) => Math.sqrt(Math.max(0, 1 - r * r));
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixCol(a, b, t, al) { const A = hex(a), B = hex(b), k = clamp(t); const v = A.map((q, i) => Math.round(lerp(q, B[i], k))); return al == null ? `rgb(${v})` : `rgba(${v},${al})`; }
// plane mapper: plane point (px,py) at height z → LOCAL
function PM(x, y, s, ryr, rot = 0) { const c = Math.cos(rot), n = Math.sin(rot), cc = cOf(ryr); return (px, py, z = 0) => [x + s * (c * px - n * py), y + s * (ryr * (n * px + c * py) - z * cc)]; }
function plane(ctx, ryr, rot) { ctx.scale(1, ryr); if (rot) ctx.rotate(rot); }

// ===================================================================================================== single fillings
const SHR_RAW = ['#f0dcd3', '#c9aeaa', '#9a8890'], SHR_CK = ['#ffb487', '#f0703e', '#c8442a'];
function shrimp(ctx, x, y, s = 1, rot = 0, o = {}) {
  const k = clamp(o.sear ?? 1), c0 = mixCol(SHR_RAW[0], SHR_CK[0], k), c1 = mixCol(SHR_RAW[1], SHR_CK[1], k), c2 = mixCol(SHR_RAW[2], SHR_CK[2], k);
  at(ctx, x, y, rot, s * 0.75, s * 0.75 * (o.sq ?? 1), () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const segs = 6;
    for (let i = segs - 1; i >= 0; i--) {
      const a = -PI * 0.15 + i / segs * PI * 1.15, rr = 18, w = lerp(15, 8, i / segs);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      ell(ctx, px, py, w, w * 0.85, a); ctx.fillStyle = lgr(ctx, px - w, py - w, px + w, py + w, [[0, c0], [0.5, c1], [1, c2]]); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,225,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, py, w * 0.8, a - PI * 0.9, a - PI * 0.4); ctx.stroke();
    }
    const ta = PI, tx = Math.cos(ta) * 18, ty = Math.sin(ta) * 18;
    ctx.fillStyle = mixCol('#b89a98', '#d8462c', k); ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 15, ty - 13); ctx.lineTo(tx - 5, ty - 2); ctx.lineTo(tx - 17, ty + 5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,25,15,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 27, -PI * 0.15, PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, 6, -16, 5, 2, 0.3); ctx.fill();
  });
}
function porkSlice(ctx, x, y, s = 1, rot = 0, o = {}) {
  const k = clamp(o.sear ?? 1);
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-44, -12); ctx.bezierCurveTo(-20, -20, 20, -19, 45, -13); ctx.bezierCurveTo(48, 0, 46, 10, 42, 16); ctx.bezierCurveTo(10, 21, -20, 20, -43, 15); ctx.bezierCurveTo(-47, 4, -47, -4, -44, -12); ctx.closePath();
    outFill(ctx, mixCol('#f2a7a0', '#d08a52', k), 1.8);
    ctx.save(); ctx.clip();
    ctx.fillStyle = mixCol('#fff3ee', '#f6dca0', k); ctx.fillRect(-50, -20, 100, 9); ctx.fillRect(-50, 1, 100, 6);   // fat layers
    ctx.fillStyle = mixCol('#e38a86', '#b8682e', k); ctx.fillRect(-50, -11, 100, 3);
    ctx.fillStyle = mixCol('#f0c8b8', '#9a4f1c', k); ctx.fillRect(-50, -22, 100, 3);                                // skin
    if (k > 0.3) { ctx.strokeStyle = `rgba(110,50,15,${0.55 * k})`; ctx.lineWidth = 6; ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.2 * k})`; ell(ctx, -16, -15, 14, 2.2, -0.05); ctx.fill();
  });
}
function mungBeans(ctx, x, y, s = 1, o = {}) {
  const n = o.n ?? 14, r = rng(o.seed ?? 5), sp = o.spread ?? 50;
  at(ctx, x, y, 0, s, s * (o.sq ?? 1), () => {
    for (let i = 0; i < n; i++) {
      const px = n > 1 ? (r() - 0.5) * sp : 0, py = n > 1 ? (r() - 0.5) * sp * 0.7 : 0, a = r() * PI, z = 4.6 + r() * 1.6;
      ell(ctx, px, py, z, z * 0.72, a); ctx.fillStyle = r() < 0.5 ? '#f6cf3a' : '#eab52a'; ctx.fill(); ctx.strokeStyle = 'rgba(150,95,20,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,250,210,0.85)'; ell(ctx, px - z * 0.3, py - z * 0.25, z * 0.35, z * 0.18, a); ctx.fill();
    }
  });
}
function sprout(ctx, x, y, s = 1, rot = 0, o = {}) { HPF.beanSprouts(ctx, x, y, s, rot, { n: 1, sq: o.sq }); }

// ===================================================================================================== crêpe textures
const CR = 200, TRES = 2.4, TPAD = 1.2, TS = Math.ceil(2 * CR * TPAD * TRES);
const rw = (a, ph = 0) => 1 + 0.022 * Math.sin(3 * a + 1 + ph) + 0.018 * Math.sin(7 * a + 2 + ph) + 0.01 * Math.sin(13 * a + ph);
function discPath(x, rr, ph = 0) { x.beginPath(); for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU, q = rr * rw(a, ph); i ? x.lineTo(Math.cos(a) * q, Math.sin(a) * q) : x.moveTo(Math.cos(a) * q, Math.sin(a) * q); } x.closePath(); }
function texCanvas() { const c = createCanvas(TS, TS), x = c.getContext('2d'); x.translate(TS / 2, TS / 2); x.scale(TRES, TRES); x.lineCap = 'round'; x.lineJoin = 'round'; return [c, x]; }
function scallionFlecks(x, r, n, rmax, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * rmax, px = Math.cos(a) * d, py = Math.sin(a) * d, z = 3 + r() * 3;
    x.globalAlpha = alpha;
    if (r() < 0.6) { x.strokeStyle = '#2f7a2a'; x.lineWidth = 2.6; ell(x, px, py, z, z * 0.7, r() * PI); x.stroke(); x.fillStyle = 'rgba(150,210,90,0.8)'; x.fill(); }
    else { x.strokeStyle = '#3f9a36'; x.lineWidth = 3; const b = r() * PI; x.beginPath(); x.moveTo(px - Math.cos(b) * z, py - Math.sin(b) * z); x.lineTo(px + Math.cos(b) * z, py + Math.sin(b) * z); x.stroke(); }
  }
  x.globalAlpha = 1;
}
function laceRing(x, r, dark) {
  // net of crispy strands + blobs in the annulus 0.8R..1.12R, then holes punched through
  // golden crispy band of small fused blobs (0.84R..1.04R), a few short thick strands, then sparse lace holes
  const cin = dark ? ['#eaa636', '#d07e24', '#a85c18'] : ['#f0a830', '#d9852a', '#b8661c'];
  x.strokeStyle = dark ? 'rgba(200,120,36,0.9)' : 'rgba(222,140,44,0.9)'; x.lineWidth = CR * 0.11; discPath(x, CR * 0.93, 0.7); x.stroke();
  for (let i = 0; i < 900; i++) {
    const a = r() * TAU, u = r(), d = CR * (0.84 + u * 0.2), px = Math.cos(a) * d, py = Math.sin(a) * d;
    const z = lerp(7.5, 3, u) * (0.6 + r() * 0.6), col = cin[Math.min(2, (u * 2.2 + r() * 0.9) | 0)];
    x.fillStyle = col; ell(x, px, py, z, z * (0.6 + r() * 0.35), r() * PI); x.fill();
  }
  x.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const a = r() * TAU, d = CR * (0.96 + r() * 0.04), b = a + (r() - 0.5) * 1.1, L2 = Math.min(4 + r() * 9, CR * 1.07 - d);
    x.strokeStyle = cin[1 + ((r() * 2) | 0)]; x.lineWidth = 3 + r() * 1.8;
    x.beginPath(); x.moveTo(Math.cos(a) * d, Math.sin(a) * d); x.lineTo(Math.cos(a) * d + Math.cos(b) * L2, Math.sin(a) * d + Math.sin(b) * L2); x.stroke();
  }
  // highlights on the crisp (warm glints)
  x.fillStyle = dark ? 'rgba(255,214,130,0.55)' : 'rgba(255,236,160,0.65)';
  for (let i = 0; i < 170; i++) { const a = r() * TAU, d = CR * (0.85 + r() * 0.16), z = 1.2 + r() * 2.2; ell(x, Math.cos(a) * d - z * 0.4, Math.sin(a) * d - z * 0.4, z, z * 0.6, r() * PI); x.fill(); }
  // punch holes (lace)
  x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
  for (let i = 0; i < 180; i++) { const a = r() * TAU, u = r(), d = CR * (0.88 + u * 0.15), z = lerp(1.5, 4.6, u) * (0.6 + r() * 0.6); ell(x, Math.cos(a) * d, Math.sin(a) * d, z, z * (0.6 + r() * 0.4), r() * PI); x.fill(); }
  x.restore();
  // soft seam where the crisp band meets the pale centre
  x.strokeStyle = dark ? 'rgba(160,80,20,0.35)' : 'rgba(170,90,24,0.3)'; x.lineWidth = 2.2; discPath(x, CR * 0.84, 1.3); x.stroke();
}
let TEX = null;
function crepeTex() {
  if (TEX) return TEX;
  TEX = {};
  // ---- raw batter film (cook 0)
  { const [c, x] = texCanvas(), r = rng(71);
    discPath(x, CR * 0.99); x.fillStyle = rgr(x, -30, -30, 0, 0, 0, CR, [[0, '#fff3b8'], [0.55, '#f9e07a'], [0.9, '#f3cf5a'], [1, '#eec04c']]); x.fill();
    x.strokeStyle = 'rgba(240,190,60,0.5)'; x.lineWidth = 7;
    for (let i = 0; i < 9; i++) { const a = r() * TAU, d = CR * (0.2 + r() * 0.6); x.beginPath(); x.arc(0, 0, d, a, a + 0.6 + r()); x.stroke(); }
    scallionFlecks(x, r, 46, CR * 0.92, 0.85);
    x.fillStyle = 'rgba(255,255,255,0.32)'; for (let i = 0; i < 7; i++) { ell(x, -60 + r() * 60 - 30, -70 + r() * 90, 24 + r() * 30, 5 + r() * 4, -0.5 + r() * 0.3); x.fill(); }
    x.strokeStyle = 'rgba(255,248,210,0.6)'; x.lineWidth = 5; discPath(x, CR * 0.965); x.stroke();
    TEX.raw = c; }
  // ---- cooked top side (seen in the pan)
  { const [c, x] = texCanvas(), r = rng(72);
    discPath(x, CR * 0.955); x.fillStyle = rgr(x, -20, -20, 0, 0, 0, CR * 0.97, [[0, '#ffe066'], [0.45, '#ffd040'], [0.75, '#f5b42e'], [0.92, '#e48f22'], [1, '#c76d18']]); x.fill();
    // toasty mottling toward the edge
    for (let i = 0; i < 70; i++) { const a = r() * TAU, d = CR * (0.45 + r() * 0.45), px = Math.cos(a) * d, py = Math.sin(a) * d, z = 6 + r() * 16;
      x.fillStyle = rgr(x, px, py, 0, px, py, z, [[0, 'rgba(190,100,20,0.35)'], [1, 'rgba(190,100,20,0)']]); x.fillRect(px - z, py - z, z * 2, z * 2); }
    // little bubble pockmarks
    for (let i = 0; i < 140; i++) { const a = r() * TAU, d = Math.sqrt(r()) * CR * 0.82, z = 1.2 + r() * 3; x.strokeStyle = 'rgba(200,120,20,0.55)'; x.lineWidth = 1.1; ell(x, Math.cos(a) * d, Math.sin(a) * d, z, z * 0.8); x.stroke(); x.fillStyle = 'rgba(255,240,170,0.5)'; x.fill(); }
    scallionFlecks(x, r, 52, CR * 0.85);
    laceRing(x, r, false);
    x.strokeStyle = 'rgba(150,70,15,0.35)'; x.lineWidth = 3; discPath(x, CR * 0.86, 1); x.stroke();
    x.fillStyle = 'rgba(255,250,220,0.35)'; for (let i = 0; i < 6; i++) { ell(x, -80 + r() * 70, -80 + r() * 80, 20 + r() * 26, 4 + r() * 3, -0.55); x.fill(); }
    TEX.cooked = c; }
  // ---- crispy underside (shows on top of a folded crêpe)
  { const [c, x] = texCanvas(), r = rng(73);
    discPath(x, CR * 0.955, 2); x.fillStyle = rgr(x, 0, 0, 0, 0, 0, CR * 0.95, [[0, '#ffd04a'], [0.5, '#f8b836'], [0.8, '#eb9828'], [1, '#c26a1a']]); x.fill();
    for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()) * CR * 0.9, px = Math.cos(a) * d, py = Math.sin(a) * d, z = 8 + r() * 22;
      x.fillStyle = rgr(x, px, py, 0, px, py, z, [[0, r() < 0.7 ? 'rgba(170,80,15,0.4)' : 'rgba(255,230,120,0.5)'], [1, 'rgba(170,80,15,0)']]); x.fillRect(px - z, py - z, z * 2, z * 2); }
    // shrimp pressed into the batter (show through on the crisp side) — in the top half (y<0), which is the half that folds
    for (const [px, py, a] of [[-70, -95, 0.4], [55, -120, -0.6], [10, -55, 2.4]]) { x.globalAlpha = 0.6; shrimp(x, px, py, 1.1, a, { sear: 1 }); x.globalAlpha = 0.25; x.fillStyle = '#f4b03a'; ell(x, px, py, 22, 18); x.fill(); }
    x.globalAlpha = 1;
    scallionFlecks(x, r, 30, CR * 0.85, 0.55);
    for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()) * CR * 0.85, z = 1.4 + r() * 2.6; x.fillStyle = 'rgba(150,70,15,0.45)'; ell(x, Math.cos(a) * d, Math.sin(a) * d, z, z * 0.8); x.fill(); }
    laceRing(x, r, true);
    TEX.under = c; }
  return TEX;
}
function drawTex(ctx, c, alpha = 1) { if (alpha <= 0) return; const h = TS / TRES / 2; if (alpha < 1) { ctx.save(); ctx.globalAlpha *= alpha; ctx.drawImage(c, -h, -h, h * 2, h * 2); ctx.restore(); } else ctx.drawImage(c, -h, -h, h * 2, h * 2); }

// filling layout on the bottom half (plane units, crêpe centre origin)
const FILL = (() => {
  const r = rng(404), sp = [], mb = [], meat = [];
  for (let i = 0; i < 22; i++) { let px, py; do { px = (r() - 0.5) * 300; py = 20 + r() * 140; } while (Math.hypot(px, py) > 150); sp.push([px, py, r() * TAU]); }
  for (let i = 0; i < 9; i++) { const a = 0.25 + (i / 8) * (PI - 0.5) + (r() - 0.5) * 0.15, d = 168 + r() * 16; sp.push([Math.cos(a) * d, Math.sin(a) * d, a + (r() - 0.5) * 0.5]); }   // edge sprouts: tips peek out
  for (let i = 0; i < 16; i++) { let px, py; do { px = (r() - 0.5) * 300; py = 25 + r() * 130; } while (Math.hypot(px, py) > 150); mb.push([px, py, (r() * 1e4) | 0]); }
  const M = [['s', -95, 55, 0.3], ['p', -15, -105, -0.15], ['s', 75, 70, 2.6], ['p', 30, 115, 0.4], ['s', -90, -75, -0.9], ['p', -115, 15, 0.9], ['s', 120, -35, 2.0], ['s', 10, -15, 1.3], ['p', 85, -110, -0.6], ['s', -40, 125, -2.2]];
  return { sp, mb, meat: M };
})();

function batterBlobPath(ctx, cx, cy, rr, ph) {
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, q = rr * (1 + 0.035 * Math.sin(5 * a + ph) + 0.02 * Math.sin(9 * a + 2 * ph) + 0.01 * Math.sin(17 * a)); i ? ctx.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q) : ctx.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  ctx.closePath();
}

// core: draws the crêpe (any stage) with the current transform = translate(centre)·scale(s) (screen-aligned)
function crepeCore(ctx, o) {
  const ryr = o.ryr, cc = cOf(ryr), rot = o.rot || 0, t = o.t || 0, T = crepeTex();
  const cook = clamp(o.cook ?? 1), fold = clamp(o.fold || 0), th = ease.inOut(fold) * PI;
  const batter = o.batter == null ? 1 : clamp(o.batter);
  const meat = clamp(o.meat ?? 0), sear = clamp(o.searing ?? 1), spK = clamp(o.sprouts || 0), mbK = clamp(o.mungBeans || 0);
  const thick = fold > 0.8 ? ease.out(clamp((fold - 0.8) / 0.2)) : 0, HZ = 22 * thick * cc;   // screen lift of the landed top half
  const base = ctx.getTransform();
  const bite = clamp(o.bite || 0), ba = o.biteA ?? 1.15, br = CR * 0.15 * (0.6 + 0.7 * bite), bc = CR * (1.02 - 0.1 * bite);
  const BC = [-0.22, 0, 0.22].map((da) => [Math.cos(ba + da) * bc, Math.sin(ba + da) * bc, br * (da ? 0.85 : 1)]);
  const cutCircle = (bx, by, rr) => { ctx.beginPath(); ctx.rect(-CR * 3, -CR * 3, CR * 6, CR * 6); ctx.moveTo(bx + rr, by); ctx.arc(bx, by, rr, 0, TAU, true); ctx.clip('evenodd'); };
  ctx.save();
  // ---- bite: clip out 3 overlapping circles (one clip each, so overlaps stay removed)
  if (bite > 0) { for (const dz of (HZ > 0.5 ? [0, HZ * 0.5, HZ] : [0])) { ctx.setTransform(base); ctx.translate(0, -dz); plane(ctx, ryr, rot); for (const q of BC) cutCircle(q[0], q[1], q[2]); } ctx.setTransform(base); }
  // ---- static (bottom) half / full disc
  ctx.save(); plane(ctx, ryr, rot);
  if (fold > 0) { ctx.beginPath(); ctx.rect(-CR * 1.4, 0, CR * 2.8, CR * 1.4); ctx.clip(); }
  if (meat > 0 && batter < 1) drawMeat(ctx, meat, sear, t, true);
  if (batter > 0) {
    ctx.save();
    if (batter < 1) { const e = ease.out(batter), pa = o.pourAt || [-60, -50]; batterBlobPath(ctx, pa[0] * (1 - e), pa[1] * (1 - e), CR * lerp(0.12, 1.2, e), t * 3); ctx.clip(); }
    drawTex(ctx, T.raw, 1 - clamp((cook - 0.75) / 0.25));
    drawTex(ctx, T.cooked, ease.inOut(clamp(cook)));
    ctx.restore();
    if (batter < 1) foamEdge(ctx, batter, o.pourAt || [-60, -50], t);
    if (cook < 0.75) batterBubbles(ctx, t, batter, cook, o.pourAt || [-60, -50]);
    if (meat > 0) drawMeat(ctx, meat, sear, t, false);
  }
  if (spK > 0) { const n = FILL.sp.length, m = spK * n; for (let i = 0; i < n && i < m; i++) { const [px, py, a] = FILL.sp[(i * 7) % n], f = clamp(m - i); HPF.beanSprouts(ctx, px, py - (1 - f) * 30, 0.9 * (1 + (1 - f) * 0.3), a, { n: 1 }); } }
  if (mbK > 0) { const n = FILL.mb.length, m = mbK * n; for (let i = 0; i < n && i < m; i++) { const [px, py, sd] = FILL.mb[i]; mungBeans(ctx, px, py, 0.9, { n: 5, seed: sd, spread: 30 }); } }
  ctx.restore();
  // ---- folding half (3D: rotates about the x axis of the crêpe, lands on the bottom half)
  if (fold > 0) {
    const c = Math.cos(rot), n = Math.sin(rot), ct = Math.cos(th), st = Math.sin(th);
    const det = ryr * ct + c * cc * st;
    // soft shadow of the lifting half on the bottom half
    if (fold < 0.98) { ctx.save(); plane(ctx, ryr, rot); ctx.fillStyle = `rgba(40,15,5,${0.28 * st})`; ell(ctx, 0, CR * 0.45 * (1 - ct) * 0.5 + 10, CR * 0.95, CR * 0.35 * (1 - ct) * 0.5 + 6); ctx.fill(); ctx.restore(); }
    // thickness: crispy side wall between the bottom layer (z 0) and the landed top layer (z HZ)
    if (thick > 0.01) {
      const NS = 7;
      for (let i = 0; i < NS; i++) { const u = i / (NS - 1); ctx.save(); ctx.translate(0, -HZ * u); plane(ctx, ryr, rot); ctx.beginPath(); ctx.arc(0, 0, CR * 0.975, 0, PI); ctx.closePath(); ctx.fillStyle = mixCol('#7a3a10', '#e9a03a', u * u * 0.4 + u * 0.6); ctx.fill(); ctx.restore(); }
      ctx.save(); plane(ctx, ryr, rot); ctx.strokeStyle = 'rgba(70,30,8,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, CR * 0.975, 0.05, PI - 0.05); ctx.stroke(); ctx.restore();
      if (spK > 0) { ctx.save(); ctx.translate(0, -HZ * 0.55); plane(ctx, ryr, rot); for (let i = 22; i < FILL.sp.length; i++) { const [px, py, a] = FILL.sp[i]; HPF.beanSprouts(ctx, px, py, 0.9, a, { n: 1 }); } ctx.restore(); }
      if (meat > 0) { ctx.save(); ctx.translate(0, -HZ * 0.45); plane(ctx, ryr, rot); shrimp(ctx, -128, 128, 1.1, 2.3, { sear }); shrimp(ctx, 150, 112, 1.0, 0.9, { sear }); ctx.restore(); }
    }
    ctx.save();
    ctx.translate(0, -HZ);
    ctx.transform(c, ryr * n, -n * ct, ryr * c * ct + cc * st, 0, 0);
    ctx.beginPath(); ctx.rect(-CR * 1.4, -CR * 1.4, CR * 2.8, CR * 1.4); ctx.clip();
    if (det >= 0) { drawTex(ctx, T.cooked, 1); if (meat > 0) drawMeat(ctx, meat, sear, t, false, -1); } else drawTex(ctx, T.under, 1);
    const edgeOn = 1 - clamp(Math.abs(det) / Math.max(0.3, ryr));
    if (edgeOn > 0.02) { ctx.fillStyle = `rgba(90,40,10,${0.45 * edgeOn})`; discPath(ctx, CR * 1.05); ctx.fill(); }
    ctx.strokeStyle = 'rgba(120,55,12,0.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, CR * 0.95, PI, TAU); ctx.stroke();
    ctx.restore();
    if (fold > 0.9) { // gloss + warm rim on the folded top (screen-space light from upper left)
      ctx.save(); ctx.translate(0, -HZ); plane(ctx, ryr, rot); ctx.beginPath(); ctx.rect(-CR * 1.4, 0, CR * 2.8, CR * 1.4); ctx.clip();
      ctx.globalAlpha = clamp((fold - 0.9) / 0.1);
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = 'rgba(255,230,160,0.28)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, CR * 0.86, PI * 0.6, PI * 0.92); ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,210,0.35)'; ell(ctx, -60, 70, 46, 9, 0.35); ctx.fill(); ell(ctx, 30, 120, 30, 6, -0.2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,240,190,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-CR * 0.92, 2); ctx.lineTo(CR * 0.92, 2); ctx.stroke(); // fold crease light
      ctx.restore();
    }
  }
  // bite rim: a single scalloped crispy line (each arc clipped outside the other two circles)
  if (bite > 0) {
    ctx.setTransform(base); ctx.save(); ctx.translate(0, -HZ); plane(ctx, ryr, rot); ctx.lineCap = 'round';
    BC.forEach(([bx, by, rr], i) => {
      ctx.save(); BC.forEach((q, j) => { if (j !== i) cutCircle(q[0], q[1], q[2]); });
      const a = Math.atan2(by, bx);
      ctx.strokeStyle = '#8f4a12'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by, rr + 1, a + PI * 0.5, a + PI * 1.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,236,170,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, rr + 4, a + PI * 0.6, a + PI * 1.4); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }
  ctx.restore();
}
function drawMeat(ctx, meat, sear, t, sizzle, half = 0) {
  const M = FILL.meat, m = meat * M.length;
  for (let i = 0; i < M.length && i < m; i++) {
    const [k, px, py, a] = M[i], f = clamp(m - i), dz = (1 - f) * 40;
    if (half < 0 && py > 40) continue; if (half > 0 && py < -40) continue;
    if (sizzle && sear < 1) { ctx.strokeStyle = 'rgba(255,250,230,0.6)'; ctx.lineWidth = 2; for (let j = 0; j < 5; j++) { const b = j / 5 * TAU + t * 2 + i, d = 34 + 4 * Math.sin(t * 20 + j * 3 + i); ell(ctx, px + Math.cos(b) * d, py + Math.sin(b) * d * 0.7, 3, 3); ctx.stroke(); } }
    if (k === 's') shrimp(ctx, px, py - dz, 1.3, a, { sear }); else porkSlice(ctx, px, py - dz, 1.0, a, { sear });
  }
}
function foamEdge(ctx, batter, pa, t) {
  const e = ease.out(batter), cx = pa[0] * (1 - e), cy = pa[1] * (1 - e), rr = CR * lerp(0.12, 1.2, e), A = 0.8 * (1 - batter);
  ctx.save(); ctx.fillStyle = `rgba(255,252,225,${A})`; ctx.strokeStyle = `rgba(200,150,40,${A * 0.6})`; ctx.lineWidth = 1;
  for (let i = 0; i < 70; i++) { const a = i / 70 * TAU + Math.sin(i * 7.3) * 0.05, q = rr * (1 + 0.035 * Math.sin(5 * a + t * 3) + 0.02 * Math.sin(9 * a + 6 * t) + 0.01 * Math.sin(17 * a)) - 3, z = 2 + 2.5 * Math.abs(Math.sin(i * 3.7 + t * 9));
    const px = cx + Math.cos(a) * q, py = cy + Math.sin(a) * q; if (Math.hypot(px, py) > CR * 1.06) continue; ell(ctx, px, py, z, z); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function batterBubbles(ctx, t, batter, cook, pa) {
  const r = rng(808), e = ease.out(batter), cx = pa[0] * (1 - e), cy = pa[1] * (1 - e), rr = CR * lerp(0.12, 1.2, e) * 0.9;
  const A = clamp(batter * 2) * (1 - cook / 0.75);
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * Math.min(rr, CR * 0.92), per = 0.5 + r() * 0.7, ph = (t / per + r()) % 1, z = (1.5 + r() * 4) * Math.sin(ph * PI);
    const px = cx * 0 + Math.cos(a) * d, py = Math.sin(a) * d; if (Math.hypot(px - cx, py - cy) > rr) continue;
    ctx.globalAlpha = A * (ph < 0.85 ? 1 : (1 - ph) / 0.15);
    ctx.strokeStyle = 'rgba(200,140,30,0.8)'; ctx.lineWidth = 1.2; ell(ctx, px, py, z, z); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,235,0.9)'; ell(ctx, px - z * 0.3, py - z * 0.3, z * 0.35, z * 0.3); ctx.fill();
  }
  ctx.restore();
}

function crepeStage(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o);
  const oo = Object.assign({}, o, { ryr, meat: o.meat ?? (o.searing != null ? 1 : 0), batter: o.batter ?? (o.cook > 0 ? 1 : 0) });
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (oo.oil > 0 && oo.batter < 1) oilSheen(ctx, ryr, oo.oil, o.t || 0);
  if (oo.batter > 0 || oo.meat > 0 || oo.sprouts > 0 || oo.mungBeans > 0) crepeCore(ctx, Object.assign(oo, { cook: oo.batter > 0 ? (o.cook ?? 0) : 0, batter: oo.batter }));
  ctx.restore();
  const mp = PM(x, y, s, ryr, o.rot || 0);
  return { center: [x, y], edge: mp(0, CR), R: CR * s };
}
function oilSheen(ctx, ryr, oil, t) {
  ctx.save(); ctx.scale(1, ryr); ctx.globalCompositeOperation = 'screen';
  const ox = Math.sin(t * 1.3) * 30, oy = Math.cos(t * 0.9) * 20;
  ctx.globalAlpha = 0.5 * oil; ctx.fillStyle = rgr(ctx, -60 + ox, -70 + oy, 0, -60 + ox, -70 + oy, 170, [[0, 'rgba(255,215,140,0.55)'], [1, 'rgba(255,215,140,0)']]); ctx.fillRect(-220, -220, 440, 440);
  ctx.strokeStyle = 'rgba(255,230,170,0.5)'; ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + t * 0.6, d = 60 + i * 18 + Math.sin(t * 2 + i) * 8; ctx.beginPath(); ctx.arc(ox * 0.5, oy * 0.5, d, a, a + 0.5 + 0.2 * Math.sin(t * 3 + i)); ctx.stroke(); }
  for (let i = 0; i < 9; i++) { const a = i * 2.39, d = 40 + (i * 37) % 150, tw = 0.5 + 0.5 * Math.sin(t * 7 + i * 1.7); ctx.globalAlpha = oil * tw; L.sparkle(ctx, Math.cos(a) * d, Math.sin(a) * d, 10, 0.8); }
  ctx.restore();
}

// ===================================================================================================== pan
const PAN = { RO: 245, RI: 222, RF: 205, D: 34, DO: 46, RB: 228 };
function pan(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), cc = cOf(ryr), t = o.t || 0, ha = o.handle ?? 0.5, { RO, RI, RF, D, DO, RB } = PAN;
  const mp = PM(x, y, s, ryr, 0);
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const handle = () => {
    const ca = Math.cos(ha), sa = Math.sin(ha), P = (d, w) => [ca * d - sa * w, ryr * (sa * d + ca * w)];
    // iron neck
    ctx.beginPath(); const a1 = P(RO - 10, -20), a2 = P(RO + 70, -13), a3 = P(RO + 70, 13), a4 = P(RO - 10, 20);
    ctx.moveTo(...a1); ctx.lineTo(...a2); ctx.lineTo(...a3); ctx.lineTo(...a4); ctx.closePath(); outFill(ctx, '#2c2728', 2.4);
    // wooden grip
    ctx.beginPath(); const b = [P(RO + 62, -17), P(RO + 215, -19), P(RO + 228, 0), P(RO + 215, 19), P(RO + 62, 17)];
    ctx.moveTo(...b[0]); ctx.lineTo(...b[1]); ctx.quadraticCurveTo(...P(RO + 234, -16), ...b[2]); ctx.quadraticCurveTo(...P(RO + 234, 16), ...b[3]); ctx.lineTo(...b[4]); ctx.closePath();
    outFill(ctx, lgr(ctx, ...P(0, -18), ...P(0, 18), [[0, '#c98a4a'], [0.45, '#9a5a2a'], [1, '#5e3216']]), 2.4);
    ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = 2; for (const d of [RO + 80, RO + 92]) { ctx.beginPath(); ctx.moveTo(...P(d, -17)); ctx.lineTo(...P(d, 17)); ctx.stroke(); }
    rimLine(ctx, () => { ctx.moveTo(...P(RO + 100, -15)); ctx.lineTo(...P(RO + 210, -16)); }, 'rgba(255,210,150,0.7)', 3);
  };
  const handleBehind = Math.sin(ha) < -0.15;
  if (handleBehind) handle();
  // outer wall
  if (ryr < 0.98) {
    ctx.beginPath(); ctx.moveTo(-RO, 0); ctx.lineTo(-RB, DO * cc); ctx.ellipse(0, DO * cc, RB, RB * ryr, 0, PI, 0, true); ctx.lineTo(RO, 0); ctx.ellipse(0, 0, RO, RO * ryr, 0, 0, PI, false); ctx.closePath();
    outFill(ctx, lgr(ctx, -RO, 0, RO, 0, [[0, '#6a5550'], [0.18, '#4a3e3c'], [0.6, '#2a2324'], [1, '#141011']]), 2.6);
    rimLine(ctx, () => { ctx.moveTo(-RO + 6, 6); ctx.lineTo(-RB + 4, DO * cc - 4); }, 'rgba(255,170,90,0.55)', 4);
    ctx.strokeStyle = 'rgba(255,140,60,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, DO * cc, RB - 4, RB * ryr - 3, 0, PI * 0.15, PI * 0.85); ctx.stroke();  // fire glow on the base
  }
  // rim ring
  ell(ctx, 0, 0, RO, RO * ryr); outFill(ctx, lgr(ctx, 0, -RO * ryr, 0, RO * ryr, [[0, '#5d4f4c'], [0.5, '#3a3233'], [1, '#2a2324']]), 2.6);
  // inside (inner wall dark, floor slightly lighter)
  ell(ctx, 0, 0, RI, RI * ryr); ctx.fillStyle = lgr(ctx, 0, -RI * ryr, 0, RI * ryr, [[0, '#0f0c0c'], [1, '#2a2223']]); ctx.fill();
  ctx.save(); ell(ctx, 0, 0, RI, RI * ryr); ctx.clip();
  ell(ctx, 0, D * cc, RF, RF * ryr); ctx.fillStyle = rgr(ctx, -40, D * cc - 40 * ryr, 0, 0, D * cc, RF, [[0, '#3c3334'], [0.7, '#262021'], [1, '#191415']]); ctx.fill();
  ctx.restore();
  rimLine(ctx, () => ctx.ellipse(0, 0, RO - 3, RO * ryr - 2, 0, PI * 1.05, PI * 1.6), 'rgba(255,200,140,0.7)', 3.5);
  rimLine(ctx, () => ctx.ellipse(0, 0, RI + 2, RI * ryr + 1, 0, PI * 0.15, PI * 0.6), 'rgba(255,160,90,0.35)', 2.5);
  // contents: clip = inner rim + everything above the rim centre line (so a lifting fold can rise out)
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, RI - 2, RI * ryr - 1, 0, 0, TAU); ctx.rect(-RO * 1.6, -RO * 3, RO * 3.2, RO * 3); ctx.clip('nonzero');
  ctx.translate(0, D * cc);
  const crs = RF / CR * 0.985;
  ctx.save(); ctx.scale(crs, crs);
  const oo = Object.assign({}, o, { ryr, rot: o.contentRot || 0, view: undefined });
  oo.meat = o.meat ?? (o.searing != null ? 1 : 0); oo.batter = o.batter ?? (o.cook > 0 ? 1 : 0);
  if ((o.oil || 0) > 0 && oo.batter < 1) oilSheen(ctx, ryr, o.oil, t);
  if (oo.batter > 0 || oo.meat > 0) crepeCore(ctx, Object.assign(oo, { cook: oo.batter > 0 ? (o.cook ?? 0) : 0 }));
  ctx.restore();
  ctx.restore();
  // front lip over the contents (near side of the rim)
  if (ryr < 0.98) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, RO, RO * ryr, 0, 0, PI); ctx.ellipse(0, 0, RI, RI * ryr, 0, PI, 0, true); ctx.closePath(); ctx.fillStyle = lgr(ctx, 0, 0, 0, RO * ryr, [[0, '#3a3233'], [1, '#231d1e']]); ctx.fill(); ctx.restore(); rimLine(ctx, () => ctx.ellipse(0, 0, RI + 1, RI * ryr, 0, PI * 0.2, PI * 0.8), 'rgba(255,190,120,0.45)', 2.5); }
  if (!handleBehind) handle();
  ctx.restore();
  const ca = Math.cos(ha), sa = Math.sin(ha);
  const rp = (px, py) => { const c = Math.cos(o.rot || 0), n = Math.sin(o.rot || 0); return [x + s * (c * px - n * py), y + s * (n * px + c * py)]; };
  return { rim: [x, y], center: [x, y], floor: rp(0, D * cc), crepeCenter: rp(0, D * cc), rx: RI * s, ry: RI * ryr * s, R: RO * s, grip: rp(ca * (RO + 150), ryr * sa * (RO + 150)), handleEnd: rp(ca * (RO + 228), ryr * sa * (RO + 228)), crepeR: RF * 0.985 * s };
}

// ===================================================================================================== banhXeo standalone
function banhXeo(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), fold = clamp(o.fold ?? 1), rot = o.rot || 0, t = o.t || 0;
  const shift = (o.centerFold ?? true) ? -CR * 0.42 * ease.inOut(fold) : 0;     // plane units: centre the half-moon
  const mp = PM(x, y, s, ryr, rot);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // move the crêpe centre so the half-moon sits on the origin
  const c = Math.cos(rot), n = Math.sin(rot); ctx.translate(-n * shift, ryr * c * shift);
  if (o.shadow) { ctx.save(); plane(ctx, ryr, rot); ctx.fillStyle = 'rgba(30,10,5,0.25)'; ell(ctx, 10, fold > 0.5 ? CR * 0.5 : 0, CR * 1.02, fold > 0.5 ? CR * 0.55 : CR * 1.02); ctx.fill(); ctx.restore(); }
  crepeCore(ctx, { ryr, rot, t, cook: clamp(o.crisp ?? 1), fold, batter: 1, meat: o.meat ?? 1, searing: 1, sprouts: o.sprouts ?? 1, mungBeans: o.mungBeans ?? 1, bite: o.bite || 0, biteA: o.biteA });
  ctx.restore();
  if (o.steam > 0) NP.steamWisps(ctx, t, (o.seed ?? 3) + 11, x - 120 * s, y - 20 * s, 240 * s, 420 * s, { n: 5, alpha: 0.5 * o.steam, w: 18 * s });
  const ct = (px, py) => mp(px, py - shift);
  return { center: [x, y], edge: ct(0, CR * 0.95), tip: ct(-CR * 0.9, 10), R: CR * s };
}

// ===================================================================================================== batter bowl / whisk / pour
function steelBowl(ctx, R, ryr, cc, depth) {
  const bh = depth * cc + R * ryr * 0.2;
  ctx.fillStyle = 'rgba(10,5,0,0.3)'; ell(ctx, 10, bh + 6, R * 0.6, R * ryr * 0.4 + 6); ctx.fill();
  if (ryr < 0.98) {
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R, bh * 0.75, -R * 0.6, bh, -R * 0.35, bh); ctx.lineTo(R * 0.35, bh); ctx.bezierCurveTo(R * 0.6, bh, R, bh * 0.75, R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.closePath();
    outFill(ctx, lgr(ctx, -R, 0, R, 0, [[0, '#8a8f96'], [0.15, '#f4f6f8'], [0.3, '#b9c0c8'], [0.55, '#e4e8ec'], [0.8, '#7a828c'], [1, '#4c535c']]), 2.6);
    rimLine(ctx, () => { ctx.moveTo(-R * 0.95, 6); ctx.bezierCurveTo(-R * 0.93, bh * 0.6, -R * 0.65, bh * 0.92, -R * 0.4, bh * 0.97); }, 'rgba(255,220,170,0.8)', 4);
  }
  ell(ctx, 0, 0, R, R * ryr); outFill(ctx, '#eef1f4', 2.6);
  ell(ctx, 0, 0, R * 0.95, R * ryr * 0.94); ctx.fillStyle = lgr(ctx, 0, -R * ryr, 0, R * ryr, [[0, '#7c848d'], [0.5, '#c8ced5'], [1, '#f2f4f6']]); ctx.fill();
  return bh;
}
function batterBowl(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), cc = cOf(ryr), R = 200, t = o.t || 0, fill = clamp(o.fill ?? 1), mix = clamp(o.mix ?? 1);
  const tur = clamp(o.turmeric ?? (mix < 1 ? 1 - mix : 0)), sc = clamp(o.scallions || 0), r = rng(o.seed ?? 9);
  const sr = R * lerp(0.62, 0.93, fill), sdy = (1 - fill) * 60 * cc;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  steelBowl(ctx, R, ryr, cc, 120);
  if (fill > 0.01) {
    ctx.save(); ell(ctx, 0, 0, R * 0.95, R * ryr * 0.94); ctx.clip();
    ctx.translate(0, sdy); ctx.scale(1, ryr);
    ell(ctx, 0, 0, sr, sr); ctx.fillStyle = rgr(ctx, -sr * 0.3, -sr * 0.3, 0, 0, 0, sr, [[0, mixCol('#fffdf6', '#ffe070', ease.inOut(mix))], [0.7, mixCol('#f8f2e2', '#f6c83a', ease.inOut(mix))], [1, mixCol('#e6dcc6', '#e0a62a', ease.inOut(mix))]]); ctx.fill();
    ctx.save(); ell(ctx, 0, 0, sr, sr); ctx.clip();
    // turmeric swirl
    const sw = Math.sin(clamp(mix) * PI), rotA = t * 4 + mix * 6;
    if (sw > 0.02) {
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) { const u = i / 40, a = rotA + arm * TAU / 3 + u * 5.5, d = u * sr * 0.95; i ? ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d) : ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); }
        ctx.strokeStyle = `rgba(240,170,20,${0.75 * sw})`; ctx.lineWidth = 16; ctx.stroke();
        ctx.strokeStyle = `rgba(255,220,90,${0.8 * sw})`; ctx.lineWidth = 6; ctx.stroke();
      }
    }
    // unmixed turmeric powder patch
    if (tur > 0.02) { const rr = rng(33); for (let i = 0; i < 70; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * sr * 0.45 * (0.5 + tur * 0.5), z = 3 + rr() * 7; ctx.fillStyle = `rgba(${rr() < 0.5 ? '238,160,20' : '250,200,40'},${0.85 * tur})`; ell(ctx, 20 + Math.cos(a) * d, -10 + Math.sin(a) * d, z, z * 0.8); ctx.fill(); } }
    // scallions
    if (sc > 0) { const rr = rng(44), n = Math.round(26 * sc); for (let i = 0; i < n; i++) { const a = rr() * TAU + (mix < 1 ? 0 : t * 0.6 * (1 - i / 40)), d = Math.sqrt(rr()) * sr * 0.85, z = 5 + rr() * 3; ctx.strokeStyle = '#2f8a2a'; ctx.lineWidth = 3.4; ell(ctx, Math.cos(a) * d, Math.sin(a) * d, z, z * 0.75, rr() * PI); ctx.stroke(); ctx.fillStyle = 'rgba(170,225,110,0.85)'; ctx.fill(); } }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -sr * 0.35, -sr * 0.45, sr * 0.3, sr * 0.06, -0.3); ctx.fill();
    ctx.restore();
  }
  rimLine(ctx, () => ctx.ellipse(0, 0, R - 2, R * ryr - 1, 0, PI * 1.05, PI * 1.7), 'rgba(255,255,255,0.95)', 4);
  ctx.restore();
  return { rim: [x, y], center: [x, y], surface: [x, y + sdy * s], rx: R * s, ry: R * ryr * s, R: R * s };
}
function whisk(ctx, x, y, s = 1, rot = 0, o = {}) {
  const mp = LP(x, y, rot, s), sp = o.spin ?? (o.t || 0) * 12;
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round';
    // wire loops (balloon), drawn as ellipses squashed by cos of spin
    for (let i = 0; i < 6; i++) {
      const a = sp + i * PI / 6, w = Math.cos(a) * 46, front = Math.sin(a) > 0;
      ctx.strokeStyle = front ? '#e8ecf0' : '#8c949c'; ctx.lineWidth = front ? 3.4 : 2.6;
      ctx.beginPath(); ctx.moveTo(0, -150); ctx.bezierCurveTo(w * 0.6, -120, w * 1.15, -40, w * 0.55, -6); ctx.quadraticCurveTo(0, 6, -w * 0.55, -6); ctx.bezierCurveTo(-w * 1.15, -40, -w * 0.6, -120, 0, -150); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-20, -100); ctx.quadraticCurveTo(-40, -50, -24, -14); ctx.stroke();
    // handle
    rrect(ctx, -11, -330, 22, 180, 11); outFill(ctx, lgr(ctx, -11, 0, 11, 0, [[0, '#b0b8c0'], [0.35, '#f4f6f8'], [1, '#5e6670']]), 2.2);
    ctx.fillStyle = '#5e6670'; rrect(ctx, -13, -160, 26, 14, 4); ctx.fill();
    ctx.fillStyle = '#5e6670'; ell(ctx, 0, -322, 6, 4); ctx.fill();
  });
  return { tip: mp(0, 0), grip: mp(0, -250), end: mp(0, -330) };
}
const LADLE_FILL = { batter: ['#fff0a0', '#efc040'], broth: ['#ffe39a', '#d39236'], oil: ['#fff4c0', '#e6be4a'] };
function ladle(ctx, x, y, s = 1, rot = 0, o = {}) {
  const ret = HPF.ladle(ctx, x, y, s, rot, Object.assign({}, o, { fill: 0 }));
  const fill = clamp(o.fill ?? 0); if (fill <= 0) return ret;
  const col = LADLE_FILL[o.col || 'batter'] || LADLE_FILL.batter, fx = o.flip ? -1 : 1;
  at(ctx, x, y, rot, s * fx, s, () => {
    ell(ctx, 0, 1 + (1 - fill) * 6, 42 * lerp(0.7, 1, fill), 15 * lerp(0.7, 1, fill)); ctx.fillStyle = rgr(ctx, -10, -4, 2, 0, 0, 44, [[0, col[0]], [1, col[1]]]); ctx.fill();
    if ((o.col || 'batter') === 'batter') { ctx.strokeStyle = '#2f8a2a'; ctx.lineWidth = 2; for (const [px, py] of [[-14, 2], [8, -3], [20, 5]]) { ell(ctx, px, py, 3.5, 2.2); ctx.stroke(); } }
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, -14, -3, 10, 2.5); ctx.fill();
  });
  return ret;
}
const POUR = {
  milk: ['rgba(200,190,170,0.6)', '#fbf7ee', '#ffffff', 'rgba(255,255,250,0.95)'],
  batter: ['rgba(200,140,30,0.6)', '#f7d24e', '#fff0a0', 'rgba(255,252,220,0.9)'],
  oil: ['rgba(190,140,30,0.35)', 'rgba(245,205,90,0.7)', 'rgba(255,240,170,0.85)', 'rgba(255,255,240,0.9)'],
  sauce: ['rgba(120,50,10,0.6)', '#d27a26', '#ffb860', 'rgba(255,230,180,0.85)'],
  flour: ['rgba(200,195,185,0.4)', 'rgba(250,248,240,0.85)', '#ffffff', 'rgba(255,255,255,0.9)'],
};
function pourStream(ctx, x0, y0, x1, y1, t, o = {}) {
  const P5 = POUR[o.col || 'batter'] || POUR.batter, w = o.w ?? 14, k = clamp(o.k ?? 1), tail = clamp(o.tail ?? 0), r = rng(o.seed ?? 9);
  if (k <= tail) return;
  const cx = lerp(x0, x1, 0.45) + (o.bend ?? 0), cy = y0 - Math.abs(x1 - x0) * 0.05;
  const P = (u) => { const a = 1 - u; return [a * a * x0 + 2 * a * u * cx + u * u * x1, a * a * y0 + 2 * a * u * cy + u * u * y1]; };
  const N = 20, pts = [];
  for (let i = 0; i <= N; i++) { const u = lerp(tail, k, i / N), [px, py] = P(u); pts.push([px + Math.sin(t * 18 + u * 12) * w * 0.12 * u, py]); }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  // tapered: draw as thick→thin by two passes (thicker near the spout)
  path(); ctx.strokeStyle = P5[0]; ctx.lineWidth = w * 1.2; ctx.stroke();
  path(); ctx.strokeStyle = P5[1]; ctx.lineWidth = w; ctx.stroke();
  path(); ctx.strokeStyle = P5[2]; ctx.lineWidth = w * 0.45; ctx.stroke();
  ctx.translate(-w * 0.22, 0); path(); ctx.strokeStyle = P5[3]; ctx.lineWidth = Math.max(1, w * 0.12); ctx.stroke(); ctx.translate(w * 0.22, 0);
  for (let i = 0; i < (o.drops ?? 8); i++) { const u = lerp(tail, k, (r() + t * (0.8 + r())) % 1), [px, py] = P(u), off = (r() - 0.5) * w * 2.2, z = w * (0.1 + r() * 0.15); ctx.fillStyle = P5[1]; ell(ctx, px + off, py, z, z); ctx.fill(); }
  if (o.splash !== false && k > 0.97) {
    ctx.strokeStyle = P5[2]; ctx.lineWidth = Math.max(1.5, w * 0.2);
    const rr = w * (1.8 + 0.6 * Math.sin(t * 14)); ell(ctx, x1, y1, rr * 1.7, rr * 0.5); ctx.stroke();
    for (let i = 0; i < 7; i++) { const a = PI + (i + 0.5) / 7 * PI, ph = (t * 3 + i * 0.37) % 1, d = w * (1.2 + ph * 3); ctx.globalAlpha = 1 - ph; ctx.fillStyle = P5[1]; ell(ctx, x1 + Math.cos(a) * d * 1.4, y1 + Math.sin(a) * d - ph * w * 2, w * 0.2, w * 0.24); ctx.fill(); }
  }
  ctx.restore();
}
function turmericSprinkle(ctx, t, t0, x, y, o = {}) {
  const age = t - t0; if (age < 0) return;
  const n = o.n ?? 70, dur = o.dur ?? 1.1, w = o.w ?? 70, g = o.g ?? 900, floor = o.floor ?? Infinity, r = rng(o.seed ?? 17), s = o.s ?? 1;
  ctx.save();
  let landed = 0;
  for (let i = 0; i < n; i++) {
    const te = r() * dur, vx = (r() - 0.5) * w * 1.5, ox = (r() - 0.5) * 16 * s, z = (1.6 + r() * 3) * s, cv = r(), a = age - te;
    if (a < 0) continue;
    let px = x + ox + vx * a * s, py = y + 0.5 * g * a * a * s;
    if (py > floor) { landed++; continue; }
    ctx.globalAlpha = 0.9; ctx.fillStyle = cv < 0.5 ? '#f2a51a' : '#ffc93a'; ctx.fillRect(px - z / 2, py - z / 2, z, z);
  }
  if (landed > 0 && floor < Infinity) { const A = Math.min(0.5, landed / n) * clamp(1 - (age - dur) / 0.8); if (A > 0) L.glow(ctx, x, floor, 60 * s, 'rgba(255,200,60,0.8)', A, 'source-over'); }
  ctx.restore();
}

// ===================================================================================================== scallions / board / knife
function cuttingBoard(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), cc = cOf(ryr), R = 260, T = 46 * cc;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(10,5,0,0.3)'; ell(ctx, 14, T + 10, R * 1.02, R * ryr + 10); ctx.fill();
  if (ryr < 0.98) { ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(-R, T); ctx.ellipse(0, T, R, R * ryr, 0, PI, 0, true); ctx.lineTo(R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.closePath(); outFill(ctx, lgr(ctx, -R, 0, R, 0, [[0, '#a8652e'], [0.3, '#8a4e22'], [1, '#4e2a12']]), 2.6);
    ctx.strokeStyle = 'rgba(60,30,10,0.3)'; ctx.lineWidth = 1.5; for (let i = 0; i < 9; i++) { const px = -R + 30 + i * 55; ctx.beginPath(); ctx.moveTo(px, Math.sqrt(Math.max(0, 1 - (px / R) ** 2)) * R * ryr + 3); ctx.lineTo(px + 4, Math.sqrt(Math.max(0, 1 - (px / R) ** 2)) * R * ryr + T - 3); ctx.stroke(); } }
  ell(ctx, 0, 0, R, R * ryr); outFill(ctx, rgr(ctx, -40, -40 * ryr, 0, 0, 0, R, [[0, '#f0c48a'], [0.6, '#dca468'], [1, '#b87a42']]), 2.6);
  ctx.save(); ctx.scale(1, ryr);
  ctx.strokeStyle = 'rgba(140,80,35,0.35)'; ctx.lineWidth = 2; for (let i = 1; i < 10; i++) { ctx.beginPath(); for (let j = 0; j <= 40; j++) { const a = j / 40 * TAU, q = i * 24 * (1 + 0.04 * Math.sin(a * 3 + i)); j ? ctx.lineTo(Math.cos(a) * q + 10, Math.sin(a) * q) : ctx.moveTo(Math.cos(a) * q + 10, Math.sin(a) * q); } ctx.stroke(); }
  ctx.strokeStyle = 'rgba(90,45,15,0.4)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(R * 0.95, -20); ctx.lineTo(R * 0.6, -10); ctx.lineTo(R * 0.45, 5); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,70,30,0.25)'; ctx.lineWidth = 1.2; const r = rng(5); for (let i = 0; i < 26; i++) { const a = r() * TAU, d = r() * R * 0.8, b = r() * PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); ctx.lineTo(Math.cos(a) * d + Math.cos(b) * 40, Math.sin(a) * d + Math.sin(b) * 40); ctx.stroke(); } // knife marks
  ctx.restore();
  rimLine(ctx, () => ctx.ellipse(0, 0, R - 3, R * ryr - 2, 0, PI * 1.05, PI * 1.65), 'rgba(255,225,170,0.8)', 4);
  ctx.restore();
  return { center: [x, y], rx: R * s, ry: R * ryr * s, top: [x, y] };
}
const SC_STALKS = [[-10, -0.03, 1], [0, 0.01, 0.95], [10, 0.04, 1.02], [-4, -0.07, 0.9], [6, 0.08, 0.96]];
function scallionBunch(ctx, x, y, s = 1, o = {}) {
  const cut = clamp(o.cut || 0), xc = lerp(190, -150, cut), r = rng(o.seed ?? 12), mp = LP(x, y, o.rot || 0, s);
  at(ctx, x, y, o.rot || 0, s, s * (o.sq ?? 1), () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // whole part (clipped left of the cut)
    ctx.save(); ctx.beginPath(); ctx.rect(-260, -120, xc + 260, 240); ctx.clip();
    for (const [dy, a, ln] of SC_STALKS) {
      at(ctx, -150, dy, a, 1, 1, () => {
        const L2 = 340 * ln;
        // roots
        ctx.strokeStyle = 'rgba(230,220,190,0.9)'; ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-55, (i - 3) * 4, -68 + (i % 2) * 4, (i - 3) * 6); ctx.stroke(); }
        // white bulb → pale green → green
        ctx.beginPath(); ctx.moveTo(-42, -7); ctx.quadraticCurveTo(-30, -11, 30, -7); ctx.lineTo(L2 - 40, -5); ctx.quadraticCurveTo(L2, -3, L2 + 6, 0); ctx.quadraticCurveTo(L2, 3, L2 - 40, 5); ctx.lineTo(30, 7); ctx.quadraticCurveTo(-30, 11, -42, 7); ctx.closePath();
        outFill(ctx, lgr(ctx, -42, 0, L2, 0, [[0, '#fbfbf0'], [0.18, '#eef4d0'], [0.3, '#9ad860'], [0.55, '#4caa3a'], [1, '#2f8a2a']]), 1.8);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-30, -4); ctx.lineTo(L2 - 30, -2.5); ctx.stroke();
      });
    }
    ctx.restore();
    // cut face
    if (cut > 0) { for (const [dy] of SC_STALKS) { ell(ctx, xc, dy + (xc + 150) * 0.02 * Math.sign(dy), 3, 6); ctx.fillStyle = '#d8f0b0'; ctx.fill(); } }
    // rings pile right of the cut
    if (cut > 0) {
      const n = Math.floor((190 - xc) / 9);
      for (let i = 0; i < n * SC_STALKS.length; i++) {
        const k = i % SC_STALKS.length, j = (i / SC_STALKS.length) | 0, px0 = xc + 6 + j * 9, u = clamp((px0 + 150) / 340);
        const px = px0 + 8 + r() * 14 + (j * 0.6), py = SC_STALKS[k][0] * 2.2 + (r() - 0.5) * 34, z = 6.2 + r() * 1.6;
        const col = u < 0.2 ? '#cfe8a0' : u < 0.35 ? '#8ccf55' : '#3f9a36';
        ctx.strokeStyle = col; ctx.lineWidth = 3.4; ell(ctx, px, py, z, z * (0.55 + r() * 0.35), r() * PI); ctx.stroke();
        ctx.fillStyle = u < 0.3 ? 'rgba(240,250,220,0.9)' : 'rgba(190,235,140,0.8)'; ctx.fill();
        ctx.strokeStyle = 'rgba(30,80,20,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  });
  return { cutX: mp(xc, 0), pile: mp((xc + 230) / 2, 0), bulb: mp(-180, 0), tip: mp(190, 0) };
}
function scallionRings(ctx, x, y, s = 1, o = {}) {
  const n = o.n ?? 20, r = rng(o.seed ?? 21), sp = o.spread ?? 60;
  at(ctx, x, y, 0, s, s * (o.sq ?? 1), () => {
    for (let i = 0; i < n; i++) { const px = (r() - 0.5) * sp, py = (r() - 0.5) * sp * 0.7, z = 6 + r() * 2, u = r(); ctx.strokeStyle = u < 0.25 ? '#cfe8a0' : '#3f9a36'; ctx.lineWidth = 3.4; ell(ctx, px, py, z, z * (0.55 + r() * 0.35), r() * PI); ctx.stroke(); ctx.fillStyle = 'rgba(200,240,150,0.8)'; ctx.fill(); }
  });
}
function knife(ctx, x, y, s = 1, rot = 0, o = {}) {
  const lift = clamp(o.lift || 0), fx = o.flip ? -1 : 1, dy = -lift * 90, rr = -lift * 0.14 * fx;
  const mp0 = LP(x, y, rot, s, fx);
  const mp = (px, py) => { const c = Math.cos(rr * fx), n = Math.sin(rr * fx); return mp0(c * px - n * py, n * px + c * py + dy); };
  at(ctx, x, y, rot, s * fx, s, () => {
    ctx.translate(0, dy); ctx.rotate(rr * fx);
    ctx.lineJoin = 'round';
    // handle
    rrect(ctx, 128, -92, 170, 40, 16); outFill(ctx, lgr(ctx, 0, -92, 0, -52, [[0, '#a8683a'], [0.5, '#7a4420'], [1, '#4a2410']]), 2.4);
    ctx.fillStyle = '#d8dde2'; for (const px of [175, 240]) { ell(ctx, px, -72, 5, 5); ctx.fill(); }
    ctx.fillStyle = '#8c949c'; ctx.fillRect(118, -96, 16, 48);
    // blade
    ctx.beginPath(); ctx.moveTo(-130, -110); ctx.lineTo(124, -110); ctx.lineTo(124, -6); ctx.quadraticCurveTo(0, 4, -134, 0); ctx.quadraticCurveTo(-140, -60, -130, -110); ctx.closePath();
    outFill(ctx, lgr(ctx, 0, -110, 0, 0, [[0, '#5a626c'], [0.15, '#aab2ba'], [0.7, '#d8dee4'], [0.86, '#f6f8fa'], [1, '#9aa3ac']]), 2.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-128, -4); ctx.quadraticCurveTo(0, 0, 120, -9); ctx.stroke();
    ctx.fillStyle = 'rgba(40,45,55,0.5)'; ell(ctx, 96, -88, 9, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-110, -100); ctx.lineTo(-40, -100); ctx.lineTo(-90, -30); ctx.lineTo(-118, -30); ctx.closePath(); ctx.fill();
  });
  return { edge: mp(0, 0), tip: mp(-134, 0), grip: mp(215, -72), end: mp(298, -72) };
}

// ===================================================================================================== lid / plate / spatula / cutlery
function lid(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), cc = cOf(ryr), RL = 240, HL = 80 * cc;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale(s, s); ctx.lineJoin = 'round';
  if (ryr > 0.97) {
    ell(ctx, 0, 0, RL, RL); outFill(ctx, rgr(ctx, -60, -60, 10, 0, 0, RL, [[0, '#ffffff'], [0.4, '#d8dee4'], [0.85, '#9aa3ac'], [1, '#6c757e']]), 2.6);
    ctx.strokeStyle = 'rgba(80,90,100,0.4)'; ctx.lineWidth = 3; ell(ctx, 0, 0, RL * 0.8, RL * 0.8); ctx.stroke(); ell(ctx, 0, 0, RL * 0.97, RL * 0.97); ctx.stroke();
    ell(ctx, 0, 0, 30, 30); outFill(ctx, rgr(ctx, -8, -8, 2, 0, 0, 30, [[0, '#6a4a3a'], [1, '#2a1a12']]), 2.4);
    rimLine(ctx, () => ctx.arc(0, 0, RL * 0.9, PI * 1.05, PI * 1.5), 'rgba(255,240,210,0.9)', 6);
  } else {
    const dy = RL * ryr + HL;
    ctx.beginPath(); ctx.ellipse(0, 0, RL, dy, 0, PI, TAU); ctx.ellipse(0, 0, RL, RL * ryr, 0, 0, PI); ctx.closePath();
    outFill(ctx, lgr(ctx, -RL, 0, RL, 0, [[0, '#8a939c'], [0.2, '#f6f8fa'], [0.45, '#c8d0d8'], [0.75, '#9aa3ac'], [1, '#5a636c']]), 2.6);
    ctx.strokeStyle = 'rgba(80,90,100,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, RL * 0.97, RL * ryr * 0.97, 0, 0, PI); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -HL * 0.45, RL * 0.78, dy * 0.6, 0, PI * 1.08, PI * 1.92); ctx.stroke();
    rimLine(ctx, () => ctx.ellipse(0, 0, RL * 0.9, dy * 0.92, 0, PI * 1.12, PI * 1.45), 'rgba(255,240,210,0.9)', 7);
    // knob
    const ky = -HL - RL * ryr * 0.05;
    ctx.beginPath(); ctx.moveTo(-14, ky + 4); ctx.lineTo(-22, ky - 22); ctx.ellipse(0, ky - 22, 22, 9, 0, PI, 0); ctx.lineTo(14, ky + 4); ctx.closePath(); outFill(ctx, lgr(ctx, -22, 0, 22, 0, [[0, '#6a4a3a'], [0.4, '#8a6048'], [1, '#2a1a12']]), 2.2);
    ell(ctx, 0, ky - 22, 22, 9); outFill(ctx, '#7a5440', 2);
  }
  ctx.restore();
  const cc2 = cOf(ryr);
  return { rim: [x, y], knob: [x, y - (ryr > 0.97 ? 0 : (80 * cc2 + 22 + 240 * ryr * 0.05) * s)], rx: RL * s, ry: RL * ryr * s };
}
function plate(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), cc = cOf(ryr), R = 300, RW = 205, T = 18 * cc;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(20,8,0,0.3)'; ell(ctx, 14, T + 12, R * 0.98, R * ryr * 0.98 + 6); ctx.fill(); }
  if (ryr < 0.98) { ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(-R * 0.92, T); ctx.ellipse(0, T, R * 0.92, R * ryr * 0.92, 0, PI, 0, true); ctx.lineTo(R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.closePath(); outFill(ctx, lgr(ctx, -R, 0, R, 0, [[0, '#cfd8e2'], [0.25, '#ffffff'], [1, '#9aaabb']]), 2.4); }
  ell(ctx, 0, 0, R, R * ryr); outFill(ctx, lgr(ctx, 0, -R * ryr, 0, R * ryr, [[0, '#e6ecf2'], [0.5, '#ffffff'], [1, '#dfe6ee']]), 2.4);
  ctx.strokeStyle = '#1f4fa3'; ctx.lineWidth = 7; ell(ctx, 0, 0, R * 0.95, R * ryr * 0.95); ctx.stroke();
  ctx.lineWidth = 2.2; ell(ctx, 0, 0, R * 0.86, R * ryr * 0.86); ctx.stroke();
  ctx.fillStyle = '#2a5fb5'; for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, px = Math.cos(a) * R * 0.905, py = Math.sin(a) * R * ryr * 0.905; ctx.beginPath(); ctx.ellipse(px, py, 7, 7 * Math.max(ryr, 0.35), a, 0, TAU); ctx.fill(); }
  ell(ctx, 0, 0, RW, RW * ryr); ctx.fillStyle = rgr(ctx, 0, -RW * ryr * 0.5, 0, 0, 0, RW, [[0, '#ffffff'], [1, '#e2e9f0']]); ctx.fill();
  ctx.strokeStyle = 'rgba(120,140,170,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, RW, RW * ryr, 0, PI * 1.05, PI * 1.95); ctx.stroke();
  rimLine(ctx, () => ctx.ellipse(0, 0, R - 3, R * ryr - 2, 0, PI * 1.08, PI * 1.6), 'rgba(255,250,235,0.95)', 4);
  ctx.restore();
  return { center: [x, y], rx: R * s, ry: R * ryr * s, R: R * s };
}
function spatula(ctx, x, y, s = 1, rot = 0, o = {}) {
  const fx = o.flip ? -1 : 1, mp = LP(x, y, rot, s, fx);
  at(ctx, x, y, rot, s * fx, s, () => {
    ctx.lineJoin = 'round';
    const wood = (a, b) => lgr(ctx, 0, a, 0, b, [[0, '#e8b878'], [0.5, '#c88a48'], [1, '#8a5424']]);
    ctx.beginPath(); ctx.moveTo(0, -35); ctx.quadraticCurveTo(-4, 0, 0, 35); ctx.lineTo(96, 24); ctx.quadraticCurveTo(120, 16, 130, 12); ctx.lineTo(380, 13); ctx.quadraticCurveTo(392, 0, 380, -13); ctx.lineTo(130, -12); ctx.quadraticCurveTo(120, -16, 96, -24); ctx.closePath();
    outFill(ctx, wood(-35, 35), 2.4);
    ctx.strokeStyle = 'rgba(110,60,20,0.35)'; ctx.lineWidth = 1.5; for (const py of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(8, py); ctx.quadraticCurveTo(60, py * 0.8, 100, py * 0.5); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(150, -4); ctx.lineTo(360, -5); ctx.stroke();
    ctx.fillStyle = '#5a3216'; ell(ctx, 362, 0, 5, 5); ctx.fill();
    ctx.fillStyle = 'rgba(70,35,10,0.35)'; ctx.beginPath(); ctx.moveTo(0, -35); ctx.quadraticCurveTo(-4, 0, 0, 35); ctx.lineTo(10, 34); ctx.quadraticCurveTo(6, 0, 10, -34); ctx.closePath(); ctx.fill();  // scorched edge
    rimLine(ctx, () => { ctx.moveTo(12, -30); ctx.lineTo(94, -21); ctx.moveTo(140, -10); ctx.lineTo(370, -11); }, 'rgba(255,230,180,0.85)', 3);
  });
  return { tip: mp(0, 0), blade: mp(50, 0), grip: mp(300, 0), end: mp(385, 0) };
}
function forkKnife(ctx, x, y, s = 1, o = {}) {
  const gap = o.gap ?? 70, kind = o.kind || 'both', mp = LP(x, y, o.rot || 0, s);
  const metal = (x0, x1) => lgr(ctx, x0, 0, x1, 0, [[0, '#8c959e'], [0.4, '#f4f6f8'], [1, '#6a737c']]);
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (kind !== 'knife') at(ctx, -gap / 2, 0, 0, 1, 1, () => {
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-7, -130); ctx.quadraticCurveTo(-4, -150, -16, -170); ctx.lineTo(-18, -250); ctx.lineTo(-12, -250); ctx.lineTo(-10, -178); ctx.lineTo(-5, -178); ctx.lineTo(-5, -250); ctx.lineTo(1, -250); ctx.lineTo(1, -178); ctx.lineTo(6, -178); ctx.lineTo(6, -250); ctx.lineTo(12, -250); ctx.lineTo(12, -178); ctx.lineTo(16, -178); ctx.lineTo(19, -250); ctx.lineTo(24, -250); ctx.lineTo(23, -170); ctx.quadraticCurveTo(10, -150, 13, -130); ctx.lineTo(11, 0); ctx.quadraticCurveTo(1, 8, -9, 0); ctx.closePath();
      outFill(ctx, metal(-10, 20), 2);
    });
    if (kind !== 'fork') at(ctx, gap / 2, 0, 0, 1, 1, () => {
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-8, -120); ctx.lineTo(-10, -125); ctx.lineTo(-10, -240); ctx.quadraticCurveTo(10, -258, 14, -230); ctx.lineTo(12, -125); ctx.lineTo(10, -120); ctx.lineTo(11, 0); ctx.quadraticCurveTo(1, 8, -9, 0); ctx.closePath();
      outFill(ctx, metal(-10, 14), 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -130); ctx.lineTo(-6, -235); ctx.stroke();
    });
  });
  return { forkTip: mp(-gap / 2 + 3, -250), knifeTip: mp(gap / 2 + 2, -248), forkGrip: mp(-gap / 2, -50), knifeGrip: mp(gap / 2, -50) };
}

// ===================================================================================================== herbs
const LEAF = {
  mustard: { L: 240, W: 170, frill: 0.07, fq: 34, exp: 0.8, c: ['#d8eea8', '#86c64e', '#4a9632'], rib: 12, veins: 6, crinkle: 1 },
  lettuce: { L: 200, W: 190, frill: 0.12, fq: 58, exp: 0.6, c: ['#eef8b0', '#b4e060', '#78bc3a'], rib: 7, veins: 5, crinkle: 1 },
  lacach: { L: 60, W: 48, frill: 0, fq: 0, exp: 0.9, c: ['#4fa848', '#2f7d32', '#1c5222'], rib: 2.2, veins: 0, gloss: 1 },
  hung: { L: 70, W: 36, frill: 0.05, fq: 26, exp: 0.7, c: ['#78c45a', '#45a038', '#2a7022'], rib: 2, veins: 3 },
  diepca: { L: 60, W: 58, heart: 1, c: ['#7cbc58', '#4e9a3a', '#7a5a3a'], rib: 2, veins: 2 },
};
function leafOutline(ctx, P, ph) {
  ctx.beginPath(); const N = 40;
  if (P.heart) { const L2 = P.L, W2 = P.W / 2; ctx.moveTo(0, -4); ctx.bezierCurveTo(-W2 * 0.5, 6, -W2 * 1.25, -L2 * 0.1, -W2 * 0.9, -L2 * 0.55); ctx.quadraticCurveTo(-W2 * 0.4, -L2 * 0.92, 0, -L2); ctx.quadraticCurveTo(W2 * 0.4, -L2 * 0.92, W2 * 0.9, -L2 * 0.55); ctx.bezierCurveTo(W2 * 1.25, -L2 * 0.1, W2 * 0.5, 6, 0, -4); ctx.closePath(); return; }
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i <= N; i++) {
      const u = side < 0 ? i / N : 1 - i / N, w = P.W / 2 * Math.pow(Math.sin(PI * Math.pow(u, P.exp)), 0.85) * (1 + P.frill * Math.sin(u * P.fq + ph + (side > 0 ? 1.3 : 0)));
      const px = side * w, py = -u * P.L; (i === 0 && side < 0) ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}
function herbLeaf(ctx, x, y, s = 1, rot = 0, kind = 'lacach', o = {}) {
  const P = LEAF[kind] || LEAF.lacach, mp = LP(x, y, rot, s), ph = o.ph ?? (x * 0.37 + y * 0.11);
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    leafOutline(ctx, P, ph);
    outFill(ctx, lgr(ctx, -P.W / 2, 0, P.W / 2, -P.L, [[0, P.c[2]], [0.45, P.c[1]], [1, P.c[0]]]), kind === 'lacach' || kind === 'hung' || kind === 'diepca' ? 1.6 : 2);
    if (kind === 'diepca') { ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(150,70,60,0.5)'; ctx.lineWidth = 5; leafOutline(ctx, P, ph); ctx.stroke(); ctx.restore(); }
    // midrib
    ctx.strokeStyle = kind === 'mustard' || kind === 'lettuce' ? 'rgba(240,250,215,0.95)' : 'rgba(200,240,170,0.7)'; ctx.lineWidth = P.rib;
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(2, -P.L * 0.5, 0, -P.L * 0.92); ctx.stroke();
    if (kind === 'hung') { ctx.strokeStyle = '#7a3a6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, 0); ctx.stroke(); }
    if (P.veins) {
      ctx.strokeStyle = kind === 'mustard' || kind === 'lettuce' ? 'rgba(235,250,205,0.75)' : 'rgba(200,240,170,0.5)'; ctx.lineWidth = Math.max(1, P.rib * 0.3);
      for (let i = 1; i <= P.veins; i++) { const u = i / (P.veins + 1), py = -u * P.L, w = P.W * 0.42 * Math.sin(PI * Math.pow(u, P.exp || 0.8)); for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, py); ctx.quadraticCurveTo(sd * w * 0.5, py - P.L * 0.03, sd * w, py - P.L * 0.1); ctx.stroke(); } }
    }
    if (P.crinkle) { ctx.strokeStyle = 'rgba(40,90,20,0.22)'; ctx.lineWidth = 2; const r = rng(((ph * 100) | 0) + 3); for (let i = 0; i < 9; i++) { const u = 0.15 + r() * 0.75, sd = r() < 0.5 ? -1 : 1, w = P.W * 0.3 * Math.sin(PI * u); ctx.beginPath(); ctx.arc(sd * w, -u * P.L, 8 + r() * 10, r() * TAU, r() * TAU + 1.6); ctx.stroke(); } }
    if (P.gloss) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(ctx, -P.W * 0.18, -P.L * 0.6, P.W * 0.14, P.L * 0.18, 0.25); ctx.fill(); }
    rimLine(ctx, () => { ctx.moveTo(-P.W * 0.1, -P.L * 0.1); ctx.quadraticCurveTo(-P.W * 0.5, -P.L * 0.45, -P.W * 0.1, -P.L * 0.9); }, 'rgba(255,240,190,0.35)', Math.max(1.5, P.W * 0.03));
  });
  return { tip: mp(0, -P.L) };
}
function basketRaw(ctx, ryr, fill, seed) {
  const cc = cOf(ryr), R = 260, D = 95 * cc, r = rng(seed);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(10,5,0,0.3)'; ell(ctx, 12, D + 10, R * 0.85, R * ryr * 0.8 + 8); ctx.fill();
  const tan = (a, b) => lgr(ctx, a, 0, b, 0, [[0, '#a87a3e'], [0.25, '#e8c483'], [0.6, '#c99b58'], [1, '#7a5426']]);
  if (ryr < 0.98) {
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R, D * 0.8, -R * 0.7, D, -R * 0.55, D); ctx.lineTo(R * 0.55, D); ctx.bezierCurveTo(R * 0.7, D, R, D * 0.8, R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.closePath();
    outFill(ctx, tan(-R, R), 2.4);
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(110,70,25,0.5)'; ctx.lineWidth = 2;
    for (let row = 0; row < 8; row++) { const yy = R * ryr * 0.5 + row * 13; for (let i = -22; i < 22; i++) { const px = i * 24 + (row % 2) * 12; ctx.beginPath(); ctx.moveTo(px - 10, yy + Math.abs(px) * 0.02 * ryr * 10); ctx.quadraticCurveTo(px, yy + 6, px + 10, yy + Math.abs(px) * 0.02 * ryr * 10); ctx.stroke(); } }
    ctx.restore();
  }
  ell(ctx, 0, 0, R, R * ryr); ctx.fillStyle = '#6a4620'; ctx.fill();
  // inner weave
  ctx.save(); ell(ctx, 0, 0, R * 0.95, R * ryr * 0.95); ctx.clip(); ctx.scale(1, ryr);
  ctx.strokeStyle = 'rgba(230,190,120,0.55)'; ctx.lineWidth = 6; for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(i * 22, -R); ctx.lineTo(i * 22, R); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(180,130,60,0.55)'; for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(-R, i * 22); ctx.lineTo(R, i * 22); ctx.stroke(); }
  ctx.restore();
  // full bamboo rim behind the herbs
  ctx.lineWidth = 16; ctx.strokeStyle = '#7a5426'; ell(ctx, 0, 0, R, R * ryr); ctx.stroke(); ctx.lineWidth = 11; ctx.strokeStyle = '#d4a868'; ell(ctx, 0, 0, R, R * ryr); ctx.stroke();
  // herbs (pile): big leaves first, small on top
  const items = [];
  for (let i = 0; i < 7; i++) items.push(['mustard', 0.95]); for (let i = 0; i < 5; i++) items.push(['lettuce', 0.9]);
  for (let i = 0; i < 16; i++) items.push(['lacach', 1.4]); for (let i = 0; i < 12; i++) items.push(['hung', 1.4]); for (let i = 0; i < 10; i++) items.push(['diepca', 1.4]);
  const n = Math.round(items.length * fill), sqL = lerp(ryr, 1, 0.55);
  const order = items.map((it, i) => [it, i]); // big first already
  for (let i = 0; i < n; i++) {
    const [kind, sc] = order[i][0], big = kind === 'mustard' || kind === 'lettuce';
    const a = r() * TAU, d = Math.sqrt(r()) * R * (big ? lerp(0.4, 0.55, cc) : lerp(0.62, 0.75, cc)), px = Math.cos(a) * d, py = Math.sin(a) * d * ryr - (big ? 10 : 30) * cc * (0.5 + fill * 0.5);
    const lr = big ? Math.atan2(px, -(py - R * ryr * 0.2)) * 0.9 + (r() - 0.5) * 0.6 : r() * TAU;
    herbLeaf(ctx, px, py + (big ? R * ryr * 0.15 * cc : 0), sc * (big ? lerp(0.78, 1, cc) + r() * 0.2 : 1), lr, kind, { sq: sqL, ph: i * 1.7 });
  }
  // rim (bamboo ring with binding)
  ctx.lineWidth = 16; ctx.strokeStyle = '#7a5426'; ell(ctx, 0, 0, R, R * ryr); ctx.save(); ctx.beginPath(); ctx.rect(-R * 1.2, 0, R * 2.4, R); ctx.clip(); if (ryr < 0.98) { ell(ctx, 0, 0, R, R * ryr); ctx.stroke(); } ctx.lineWidth = 11; ctx.strokeStyle = '#d4a868'; if (ryr < 0.98) { ell(ctx, 0, 0, R, R * ryr); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(110,70,25,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 30; i++) { const a = i / 30 * PI; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - 7), Math.sin(a) * (R - 7) * ryr - 3); ctx.lineTo(Math.cos(a) * (R + 7), Math.sin(a) * (R + 7) * ryr + 3); ctx.stroke(); }
  ctx.restore();
  rimLine(ctx, () => ctx.ellipse(0, 0, R + 4, R * ryr + 3, 0, PI * 0.1, PI * 0.5), 'rgba(255,225,160,0.7)', 3);
}
const BASKET_CACHE = new Map(), BRES = 1.5;
function herbBasket(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), q = Math.round(clamp(o.fill ?? 1) * 10), seed = o.seed ?? 61, key = `${ryr.toFixed(2)}|${q}|${seed}`;
  const R = 260, w = R * 2.7, top = R * ryr + 200, bot = R * ryr + 130;
  let c = BASKET_CACHE.get(key);
  if (!c) { c = createCanvas(Math.ceil(w * BRES), Math.ceil((top + bot) * BRES)); const x2 = c.getContext('2d'); x2.scale(BRES, BRES); x2.translate(w / 2, top); basketRaw(x2, ryr, q / 10, seed); BASKET_CACHE.set(key, c); }
  ctx.drawImage(c, x - w / 2 * s, y - top * s, w * s, (top + bot) * s);
  return { rim: [x, y], center: [x, y], rx: R * s, ry: R * ryr * s };
}

// ===================================================================================================== fish sauce
function fishSauceBowl(ctx, x, y, s = 1, o = {}) {
  const ryr = ryrOf(o), cc = cOf(ryr), R = 100, fill = clamp(o.fill ?? 1), t = o.t || 0, bh = 64 * cc + R * ryr * 0.25;
  const sr = R * 0.92 * lerp(0.7, 1, fill), sdy = (1 - fill) * 30 * cc;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(10,5,0,0.3)'; ell(ctx, 8, bh + 4, R * 0.6, R * ryr * 0.4 + 5); ctx.fill();
  if (ryr < 0.98) {
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R, bh * 0.7, -R * 0.6, bh, -R * 0.4, bh); ctx.lineTo(R * 0.4, bh); ctx.bezierCurveTo(R * 0.6, bh, R, bh * 0.7, R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.closePath();
    outFill(ctx, lgr(ctx, -R, 0, R, 0, [[0, '#dfe6ee'], [0.25, '#ffffff'], [0.6, '#eef2f6'], [1, '#aab8c8']]), 2.4);
    ctx.strokeStyle = '#1f4fa3'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(0, 6, R * 0.98, R * ryr, 0, 0.05, PI - 0.05); ctx.stroke();
    ctx.fillStyle = '#2a5fb5'; for (let i = 0; i < 9; i++) { const a = (i + 0.5) / 9 * PI; ell(ctx, Math.cos(a) * R * 0.95, 16 + Math.sin(a) * R * ryr, 4 * (0.4 + Math.sin(a) * 0.6), 3.5); ctx.fill(); }
    rimLine(ctx, () => { ctx.moveTo(-R * 0.96, 8); ctx.bezierCurveTo(-R * 0.94, bh * 0.6, -R * 0.65, bh * 0.9, -R * 0.45, bh * 0.96); }, 'rgba(255,255,255,0.9)', 3);
  }
  ell(ctx, 0, 0, R, R * ryr); outFill(ctx, '#ffffff', 2.4);
  ell(ctx, 0, 0, R * 0.93, R * ryr * 0.9); ctx.fillStyle = lgr(ctx, 0, -R * ryr, 0, R * ryr, [[0, '#c8d3df'], [1, '#ffffff']]); ctx.fill();
  ctx.strokeStyle = '#4a78c6'; ctx.lineWidth = 2; ell(ctx, 0, 0, R * 0.955, R * ryr * 0.94); ctx.stroke();
  if (fill > 0.01) {
    ctx.save(); ell(ctx, 0, 0, R * 0.93, R * ryr * 0.9); ctx.clip(); ctx.translate(0, sdy); ctx.scale(1, ryr);
    ell(ctx, 0, 0, sr, sr); ctx.fillStyle = rgr(ctx, -sr * 0.3, -sr * 0.3, 0, 0, 0, sr, [[0, '#f6b25a'], [0.6, '#d9832e'], [1, '#a8561a']]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ctx.lineWidth = 2; const rp = (t * 0.8) % 1; ell(ctx, 10, -5, sr * 0.25 + rp * sr * 0.6, sr * 0.25 + rp * sr * 0.6); ctx.globalAlpha = 1 - rp; ctx.stroke(); ctx.globalAlpha = 1;
    const ch = clamp(o.chili || 0), ga = clamp(o.garlic || 0);
    if (ga > 0) { const r = rng((o.seed ?? 3) + 1), n = Math.round(22 * ga); for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * sr * 0.8, z = 2.5 + r() * 2.5, px = Math.cos(a) * d + Math.sin(t * 0.7 + i) * 2, py = Math.sin(a) * d; ctx.fillStyle = r() < 0.6 ? '#fbf3dc' : '#efe0b8'; ctx.beginPath(); ctx.moveTo(px - z, py); ctx.lineTo(px, py - z * 0.8); ctx.lineTo(px + z, py - z * 0.1); ctx.lineTo(px + z * 0.2, py + z * 0.8); ctx.closePath(); ctx.fill(); } }
    if (ch > 0) { const r = rng((o.seed ?? 3) + 2), n = Math.round(9 * ch); for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * sr * 0.75; HPF.chiliSlices(ctx, Math.cos(a) * d + Math.sin(t + i) * 2, Math.sin(a) * d, 1.2, { n: 1, seed: i + 7 }); } }
    ctx.fillStyle = 'rgba(255,240,210,0.55)'; ell(ctx, -sr * 0.35, -sr * 0.45, sr * 0.3, sr * 0.07, -0.3); ctx.fill();
    ctx.restore();
  }
  rimLine(ctx, () => ctx.ellipse(0, 0, R - 2, R * ryr - 1, 0, PI * 1.05, PI * 1.7), 'rgba(255,255,255,0.95)', 3);
  ctx.restore();
  return { rim: [x, y], surface: [x, y + sdy * s], rx: R * s, ry: R * ryr * s, R: R * s };
}

// ===================================================================================================== mustard-leaf wrap
function leafWrap(ctx, x, y, s = 1, o = {}) {
  const k = clamp(o.k || 0), dip = clamp(o.dip || 0), rot = o.rot || 0, mp = LP(x, y, rot, s), T = crepeTex();
  const u = ease.inOut(clamp((k - 0.55) / 0.45));             // roll progress
  const LH = 300, LW = 240;                                      // open leaf (along y)
  const xr = lerp(-LW / 2, 0, u), rr = lerp(14, 46, Math.sqrt(u)), xL = xr - rr * 0.7, REdge = lerp(LW / 2, xr + rr, u), sxL = Math.max(0.02, (REdge - xL) / LW);  // rolled cylinder at xr
  const herbsK = clamp((k - 0.15) / 0.25), crepeK = clamp((k - 0.35) / 0.2);
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // flat part of the leaf (right of the roll), shrinking as it rolls
    if (u < 0.999) {
      ctx.save(); ctx.translate(xL, 0); ctx.scale(sxL, 1); ctx.translate(LW / 2, 0);
      ctx.rotate(PI); herbLeaf(ctx, 0, -LH / 2, LW / 170 * 0.98, PI, 'mustard', { ph: 2.2 }); ctx.restore();
      // fillings on the leaf
      ctx.save(); ctx.beginPath(); ctx.rect(xr, -LH, LW, LH * 2); ctx.clip();
      const sx = sxL;
      if (herbsK > 0) { const items = [['lacach', -40, -60, 0.3], ['hung', 30, -90, -0.4], ['diepca', -10, 30, 0.8], ['lacach', 40, 10, -1], ['hung', -50, 60, 0.6], ['lettuce', 0, -10, 0.1]]; items.forEach(([kd, px, py, a], i) => { if (i / items.length < herbsK) herbLeaf(ctx, xL + (px + LW / 2) * sx * 0.9, py - (1 - clamp(herbsK * items.length - i)) * 60, kd === 'lettuce' ? 0.55 : 1.2, a, kd, { ph: i }); }); }
      if (crepeK > 0) { ctx.save(); ctx.translate(xL + (LW / 2) * sx * 0.95, -20 - (1 - crepeK) * 80); ctx.rotate(0.2); ctx.scale(0.42 * Math.max(0.3, sx * 2), 0.42); ctx.beginPath(); ctx.moveTo(-CR * 0.6, -CR * 0.2); ctx.lineTo(CR * 0.7, -CR * 0.35); ctx.lineTo(CR * 0.5, CR * 0.5); ctx.lineTo(-CR * 0.55, CR * 0.4); ctx.closePath(); ctx.clip(); ctx.translate(0, -CR * 0.55); drawTex(ctx, T.under); ctx.restore(); HPF.beanSprouts(ctx, xL + (LW / 2) * sx, 30, 0.8, 0.3, { n: 3, seed: 4, spread: 50 }); }
      ctx.restore();
    }
    // the rolled cylinder
    if (u > 0.001) {
      const cx = xr, top = -LH * 0.5, bot = LH * 0.45;
      // stuff sticking out of the top end
      if (u > 0.4) { herbLeaf(ctx, cx - 10, top + 20, 1.1, -0.4, 'hung', { ph: 1 }); herbLeaf(ctx, cx + 12, top + 24, 1.0, 0.5, 'lacach', { ph: 2 }); ctx.fillStyle = '#f2b030'; ell(ctx, cx, top + 6, rr * 0.7, rr * 0.3); ctx.fill(); ctx.strokeStyle = '#a85a16'; ctx.lineWidth = 3; ctx.stroke(); }
      rrect(ctx, cx - rr, top, rr * 2, bot - top, rr * 0.9);
      outFill(ctx, lgr(ctx, cx - rr, 0, cx + rr, 0, [[0, '#4a9632'], [0.35, '#a6d870'], [0.6, '#86c64e'], [1, '#3a7a26']]), 2.2);
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(235,250,205,0.7)'; ctx.lineWidth = 3; for (let i = 0; i < 5; i++) { const py = top + 30 + i * 55; ctx.beginPath(); ctx.moveTo(cx - rr, py + 18); ctx.quadraticCurveTo(cx, py - 6, cx + rr, py + 4); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(30,80,20,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + rr * 0.45, top); ctx.quadraticCurveTo(cx + rr * 0.2, 0, cx + rr * 0.5, bot); ctx.stroke();
      if (dip > 0) { ctx.fillStyle = lgr(ctx, 0, top, 0, top + 120 * dip, [[0, 'rgba(200,110,30,0.75)'], [1, 'rgba(200,110,30,0)']]); ctx.fillRect(cx - rr, top, rr * 2, 130 * dip); ctx.fillStyle = 'rgba(255,240,200,0.8)'; ell(ctx, cx - rr * 0.4, top + 40 * dip, 4, 10); ctx.fill(); }
      ctx.restore();
      rimLine(ctx, () => { ctx.moveTo(cx - rr * 0.7, top + 14); ctx.lineTo(cx - rr * 0.7, bot - 14); }, 'rgba(255,245,200,0.6)', 4);
      if (dip > 0.3) { const ph = ((o.t || 0) * 1.5) % 1; ctx.fillStyle = `rgba(210,120,40,${0.9 * (1 - ph)})`; ell(ctx, cx + rr * 0.3, top - 6 - ph * -30, 3, 5); ctx.fill(); }
    }
  });
  return { tip: mp(lerp(0, xr, u), -LH * 0.5), center: mp(lerp(0, xr, u), 0), end: mp(lerp(0, xr, u), LH * 0.45) };
}

module.exports = {
  RYR, CR, mixCol, crepeTex,
  shrimp, porkSlice, mungBeans, sprout,
  batterBowl, whisk, ladle, pourStream, turmericSprinkle,
  cuttingBoard, scallionBunch, scallionRings, knife, cleaver: knife,
  pan, crepeStage, banhXeo, lid, plate, spatula, forkKnife,
  herbLeaf, herbBasket, fishSauceBowl, leafWrap,
};
