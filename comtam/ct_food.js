// ct_food.js — "Cơm tấm Sài Gòn" food props: broken rice (mound / pot / paddle), grilled pork chop (cook stages, flip,
// grill with coals), marinade bowl, bì, chả trứng (steamer tray / cut / slice), mỡ hành, ốp la (crack sequence),
// đồ chua (jar / pile), cucumber & tomato slices, nước mắm bowl + pour stream, the HERO plate, spoon bite, tongs, knife.
// LOCAL in / LOCAL out: (x,y) are in the CURRENT ctx space; returned anchors are in the same space.
// THIS HEADER IS THE SOURCE OF TRUTH for the API.   const CT = require('./ctprops');  (re-exports everything below)
// =====================================================================================================================
// CONVENTIONS
//  • s = uniform scale (sizes quoted at s = 1). k / lid / cut / pour / toss / cracking = progress 0..1 (drive with
//    inv(t0,t1,T) + an ease). t = seconds (only animates steam / wobble / gloss). Deterministic (o.seed), no Math.random.
//  • 3/4 ("3q") views are a squash of the table plane: sq = ry/rx of a circle on the table (default ≈ .5–.6);
//    topDown = sq 1. Every drawer save()/restore()s.
//  • Static textures (rice grains, chop faces, egg lace, bì strands, pickles, slices, coals …) are rendered ONCE into
//    module-level offscreen canvases keyed by (size bucket, state bucket) and blitted → per-frame cost is small.
//    First use of a new size/state costs 10–150 ms (cache fill); preview timings below are warm.
//  • Warm timings on this PC (flushed): see _test_ct_foodfx.js — all drawers ≤ ~16 ms (chopsOnGrill ≈ 15, marinadeBowl ≈ 14); hero plate ≈ 8–10 ms.
//
// ------------------------------------------------------------------------------------------------- RICE
//  brokenRice(ctx,x,y,s,{R=210 (base radius), view='3q'|'top', sq=.55 (3q squash), hk=1 (mound height factor),
//        k=1 (grow-in 0..1), seed=1, t, steam=0 (0..1), shadow=true, sparkle=.6})
//        → {center:[x,y] (base centre = (x,y)), top:[x,y] (mound peak), rx, ry, h (screen height of the dome)}
//        thousands of short broken grains (one flat broken end), lit from upper-left, gap shadows, sheen glints.
//  ricePot(ctx,x,y,s,{lid=0 (0 on … 1 lifted off to the upper-right), t, steam=1, seed}) aluminium pot, (x,y) = rim centre,
//        rim rx 300·s, ry 135·s, body 330·s tall; rice surface inside; lid lifts + tilts, steam bursts out.
//        → {rim:{x,y,rx,ry}, riceTop:[x,y], lid:[x,y], body:[x,y]}
//  paddleScoop(ctx,x,y,s,{rot=-0.5 (handle direction, rad), k=1 (rice heap 0..1), t, steam}) wooden rice paddle,
//        (x,y) = blade centre.  → {blade:[x,y], heapTop:[x,y], handle:[x,y]}
//
// ------------------------------------------------------------------------------------------------- PORK CHOP (sườn)
//  porkChop(ctx,x,y,s,{cook=1 (0 raw pink → .35 marinated → 1 charred glossy), cookB (back face, default cook),
//        flip=0 (0..1 tongs flip: rotates about the LONG axis, lifts liftH=140, shows thickness, back face after .5),
//        rot=0 (in-plane), topDown=false (else 3q with sq=.55), thick=16, seed=1, t, shadow=true, sparkle=false})
//        ~372 × 210 px at s=1 (bone stub on the LEFT, bone along the top edge, fat rim bottom/right).
//        → {center, tip (right end), bone (stub end), grab (tongs grip spot), top, bottom}
//  chopsOnGrill(ctx,t,{x=540,y=1150 (rack centre), w=820, s=1, n=3, cook (number|array), cookB, flipIdx=-1,
//        flipK=0, heat=1 (0..2 coal glow, fanning = 2), smoke=true, smokeDensity=.55, smokeTint='warm',
//        drips=true (fat drips → flare-ups), sizzle=true, sparks=true, tongs=true (auto tongs during a flip), seed})
//        charcoal trough in perspective, glowing coal bed (cached) + ember glow, chrome wire rack, chops, drips,
//        flare-ups, sizzle, sparks, smoke.  → {chops:[porkChop anchors], rack:{x,y,w,ry}, coal:[x,y]}
//
// ------------------------------------------------------------------------------------------------- PREP
//  marinadeBowl(ctx,t,{x=540,y=980,s=1,R=330, add=[{item:'lemongrass'|'garlic'|'shallot'|'honey'|'fishsauce'|'milk',
//        k:0..1}], toss=0, seed}) TOP-DOWN ceramic bowl with 3 raw chops. Dry items fall in as a handful and scatter;
//        honey / milk drizzle in ribbons (progressive), fish sauce = amber swirl; each liquid has a stream from
//        upper-left while 0<k<1. toss 0..1 jostles everything; ribbons fade into a glossy brown coat, chops turn
//        marinated.  → {center:[x,y], r, land:{item:[x,y]}} (land = where each item hits)
//  biTray(ctx,t,{x=540,y=1100,s=1,toss=0,thinh=1 (powder coat 0..1),sq=.55,seed}) enamel tray, pile of shredded pork
//        skin strands; toss hops the pile, strands fly, powder puff.  → {center, top}
//  biPile(ctx,x,y,s,{thinh=1,sq=.55}) small pile (for the plate).  → {center, top}
//  chaTrung(ctx,x,y,s,{mode='tray'|'slice', lid=0 (tray: 0 on … 1 off), cut=0 (tray: knife cuts a square, slice
//        lifts after .85), t, steam=1, sq=.55, rot=0 (slice: in-plane), size=150 (slice side)})
//        optional: knife=false (tray: hide the built-in knife), lift 0..1 / liftH=90 (tray: override slice lift),
//        depth=.55 (slice: thickness / side). Slice & cut faces show a thin yolk band over porous meat.
//        → tray: {center, slice:[x,y] (cut square centre), knife:[x,y]} · slice: {center, top}
//  moHanh(ctx,x,y,s,{pour=0 (0..1: hot-oil stream 0–.7, sizzle, dull → glossy bright green), t, sq=.55, bowl=true})
//        → {surface:[x,y], r, oil:[x,y] (stream top)}
//  friedEgg(ctx,x,y,s,{t, pan=true, sq=.72, cracking (undefined = finished egg; 0..1 crack → drop → spread → lace),
//        crisp=1, rot=0, seed}) lacy brown edges, wobbling domed yolk; small black pan with handle (pan rim rx 175·s).
//        → {center, yolk:[x,y], pan:{x,y,rx,ry}, shell:[x,y] (crack point)}
//  doChua(ctx,x,y,s,{mode='jar'|'pile', sq=.55, lid=0 (jar: 0 closed … 1 off), t}) carrot + daikon matchsticks.
//        → jar: {center, mouth:[x,y]} · pile: {center, top}
//  cucumberSlices(ctx,x,y,s,{n=4, rot=0 (fan direction), sq=.55, gap=34}) · tomatoSlices(ctx,x,y,s,{n=3,...})
//        → {center, first, last}
//  nuocMamBowl(ctx,x,y,s,{pour=0 (tilt 0..1, stream after .25), to:[x,y] (stream target), sq=.55, t})
//        amber sauce, red chili rings, minced garlic.  → {center, lip:[x,y], surface:[x,y]}
//  mamStream(ctx, from, to, k, {s=1, t, w=9, splash=true}) amber stream; head travels from→to as k 0..1 (ballistic
//        curve), splash at the target once arrived.
//
// ------------------------------------------------------------------------------------------------- HERO PLATE
//  comTamPlate(ctx,x,y,s,{topDown=false, sq=.5 (3q), angle=0 (orbit, rad), rim='blue'|'white', R=420 (plate radius),
//        items:{rice,chop,bi,cha,egg,moHanh,pickles} each 0..1 (drop-in with bounce; default all 1; cucumber & tomato
//        come with pickles), glaze=0 (chop sparkles 0..1), mam=0 (nước mắm soak, glossy wet), steam=0, t, seed})
//        → {plate:{x,y,rx,ry}, center, rice, ricePeak, chop, bi, cha, egg, yolk, moHanh, pickles, cucumber, tomato}
//          (screen points [x,y] at each item's resting spot — use for cutaways, sparkles, arrows, spoon targets)
//
// ------------------------------------------------------------------------------------------------- UTENSILS
//  spoonBite(ctx,x,y,s,{rot=0.5 (handle direction), k=1 (filling), t, steam=0}) steel spoon with rice + chop piece
//        + egg/yolk.  (x,y) = bowl centre.  → {bowl, tip, handle}
//  tongs(ctx,x,y,s,{rot=-2.4 (direction handle→tip), open=0.3 (0..1), len=420}) steel tongs, (x,y) = jaw tips.
//        → {tip, handle, grip}
//  knife(ctx,x,y,s,{rot=0}) chef knife, (x,y) = blade tip, blade runs to +x then handle.  → {tip, handle}
// =====================================================================================================================
'use strict';
const L = require('./lib');
const FX = require('./ct_fx');
const { createCanvas, Path2D } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease } = L;
const U = FX.CTFXU;
const { ell, lgr, rgr, smooth } = U;
const PI = Math.PI;

// ------------------------------------------------------------------ helpers
const rgb = (a, al) => (al === undefined ? `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})` : `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${al})`);
const mixA = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, f) => [Math.min(255, a[0] * f), Math.min(255, a[1] * f), Math.min(255, a[2] * f)];
const col3 = (c, a, b, d) => (c < 0.35 ? mixA(a, b, c / 0.35) : mixA(b, d, (c - 0.35) / 0.65));
const bk = (s) => Math.min(3, Math.max(0.25, Math.ceil(s * 4 - 0.01) / 4)); // sprite size bucket
const CACHE = new Map();
function cached(key, w, h, draw) {
  let c = CACHE.get(key);
  if (c) { CACHE.delete(key); CACHE.set(key, c); return c; }
  c = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  draw(c.getContext('2d'), c);
  CACHE.set(key, c);
  if (CACHE.size > 110) CACHE.delete(CACHE.keys().next().value);
  return c;
}
function crPath(ctx, P, closed = true) {
  const n = P.length, g = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}
function shadowEll(ctx, x, y, rx, ry, a = 0.35, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, ry / Math.max(1, rx));
  ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, rx, [[0, `rgba(20,10,6,${a})`], [0.6, `rgba(20,10,6,${a * 0.6})`], [1, 'rgba(20,10,6,0)']]);
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
}
function blit(ctx, img, x, y, s, sc, ox, oy, a = 1) { // draw sprite whose origin is (ox,oy) sprite px at scale sc
  if (a <= 0) return;
  const f = s / sc, ga = ctx.globalAlpha; if (a < 1) ctx.globalAlpha = ga * a;
  ctx.drawImage(img, x - ox * f, y - oy * f, img.width * f, img.height * f);
  ctx.globalAlpha = ga;
}
function polyLen(P) { let L2 = 0; const c = [0]; for (let i = 1; i < P.length; i++) { L2 += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); c.push(L2); } return c; }
function partial(P, k) {
  const c = polyLen(P), tot = c[c.length - 1], want = tot * clamp(k), out = [P[0]];
  for (let i = 1; i < P.length; i++) {
    if (c[i] <= want) out.push(P[i]);
    else { const f = (want - c[i - 1]) / Math.max(1e-6, c[i] - c[i - 1]); out.push([lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]); break; }
  }
  return out;
}
function strokePts(ctx, P) { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]); ctx.stroke(); }
function dropOff(k, H) { // drop-in with bounce → {dy, sy, a}
  if (k >= 1) return { dy: 0, sy: 1, sc: 1, a: 1 };
  if (k < 0.55) { const f = k / 0.55; return { dy: -(1 - f * f) * H, sy: 1 + 0.06 * f, sc: 1 + (1 - f) * 0.15, a: smooth(0, 0.15, k) }; }
  const f = (k - 0.55) / 0.45; return { dy: -Math.sin(f * PI) * H * 0.07 * (1 - f), sy: 1 - 0.13 * Math.sin(Math.min(1, f * 3) * PI) * (1 - f), sc: 1, a: 1 };
}

// ================================================================================================= BROKEN RICE
function riceSprite(R, sa, hk, seed) {
  const Rq = Math.max(20, Math.round(R / 8) * 8), sq = Math.round(sa * 20) / 20, hq = Math.round(hk * 10) / 10;
  const ca = Math.sqrt(Math.max(0, 1 - sq * sq)), Hm = Rq * 0.5 * hq, pad = Rq * 0.1 + 8;
  const W = 2 * Rq + pad * 2, Hh = 2 * Rq * sq + Hm * ca + pad * 2, cx = W / 2, cy = pad + Hm * ca + Rq * sq;
  const c = cached(`rice|${Rq}|${sq}|${hq}|${seed}`, W, Hh, (x) => {
    const r = rng(900 + seed), s1 = r() * 9, s2 = r() * 9;
    const hgt = (u, v) => { const q = 1 - (u * u + v * v); return q <= 0 ? 0 : Hm * Math.pow(q, 0.7) * (1 + 0.08 * Math.sin(u * 9 + s1) * Math.sin(v * 8 + s2)); };
    // base silhouette (gap colour)
    x.fillStyle = 'rgb(196,188,174)';
    for (let i = 0; i <= 8; i++) { const f = i / 8, zz = Hm * f * 0.98, rr = Math.sqrt(Math.max(0, 1 - Math.pow(f * 0.98, 1 / 0.7))); ell(x, cx, cy - zz * ca, Rq * rr * 0.98, Rq * rr * sq * 0.98); x.fill(); }
    const gl = Math.max(5.5, Rq * 0.047), gw = gl * 0.5;
    const N = Math.min(9000, Math.round(2.4 * PI * Rq * Rq * (1 + (Hm / Rq) * 0.5) / (gl * gw * 0.8)));
    const Lx = -0.42, Ly = -0.5, Lz = 0.76, G = [];
    for (let i = 0; i < N; i++) {
      const rr = Math.sqrt(r()) * 1.01, th = r() * TAU, u = Math.cos(th) * rr, v = Math.sin(th) * rr, e = 0.02;
      const z = hgt(u, v) + (r() - 0.5) * gl * 0.4;
      const dzx = (hgt(u + e, v) - hgt(u - e, v)) / (2 * e * Rq), dzy = (hgt(u, v + e) - hgt(u, v - e)) / (2 * e * Rq);
      const nl = Math.hypot(dzx, dzy, 1), d = (-dzx * Lx - dzy * Ly + Lz) / nl;
      G.push({ u, v, z, d, depth: v * Rq * ca + z * sq, a: r() * PI, l: gl * (0.65 + r() * 0.6), w: gw * (0.85 + r() * 0.35), br: r() < 0.55, tw: r(), hi: r() });
    }
    G.sort((p, q) => p.depth - q.depth);
    const gsy = 0.55 + 0.45 * sq;
    for (const g of G) {
      const X = cx + g.u * Rq, Y = cy + g.v * Rq * sq - g.z * ca;
      const ao = 0.78 + 0.22 * Math.min(1, (Hm > 1 ? g.z / Hm : 1) * 1.3 + 0.25);
      const b = clamp(0.6 + 0.42 * g.d, 0.35, 1.08) * ao;
      const cs = Math.cos(g.a), sn = Math.sin(g.a), l = g.l / 2, w = g.w / 2;
      const path = () => {
        x.beginPath();
        if (g.br) { x.moveTo(-l, -w * 0.9); x.lineTo(l - w, -w); x.arc(l - w, 0, w, -PI / 2, PI / 2); x.lineTo(-l, w * 0.9); x.lineTo(-l - w * 0.18, w * 0.1); x.closePath(); }
        else x.ellipse(0, 0, l, w, 0, 0, TAU);
      };
      x.setTransform(cs, gsy * sn, -sn, gsy * cs, X + gw * 0.18, Y + gw * 0.42); path();
      x.fillStyle = `rgba(${(110 * b) | 0},${(102 * b) | 0},${(92 * b) | 0},0.55)`; x.fill();
      x.setTransform(cs, gsy * sn, -sn, gsy * cs, X, Y); path();
      const warm = g.tw * 10;
      x.fillStyle = `rgb(${Math.min(255, (247 + warm * 0.4) * b) | 0},${Math.min(255, (244 - warm * 0.3) * b) | 0},${Math.min(255, (234 - warm) * b) | 0})`; x.fill();
      if (g.hi > 0.35 && b > 0.75) {
        x.fillStyle = `rgba(255,255,255,${Math.min(0.9, (b - 0.7) * 2.2)})`;
        x.beginPath(); x.ellipse(-l * 0.25, -w * 0.32, l * 0.42, w * 0.3, 0, 0, TAU); x.fill();
      }
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    // volume: darken lower-right / back rim, warm bounce at the base
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = lgr(x, cx - Rq, cy - Rq * sq - Hm * ca, cx + Rq, cy + Rq * sq, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0)'], [1, 'rgba(90,80,70,0.22)']]);
    x.fillRect(0, 0, W, Hh);
    x.globalCompositeOperation = 'source-over';
  });
  c.cx = cx; c.cy = cy; c.Hm = Hm; c.ca = ca; c.sq = sq; c.Rq = Rq;
  return c;
}
function brokenRice(ctx, x, y, s = 1, o = {}) {
  const R = (o.R ?? 210), view = o.view || '3q', sa = view === 'top' ? 1 : (o.sq ?? 0.55), k = o.k ?? 1, seed = o.seed ?? 1;
  const sc = bk(s), spr = riceSprite(R * sc, sa, o.hk ?? 1, seed), f = s / sc;
  const rx = R * s, ry = R * s * sa, hh = spr.Hm * spr.ca * f;
  if (k > 0) {
    ctx.save();
    if (o.shadow !== false) shadowEll(ctx, x + 8 * s, y + 10 * s * sa, rx * 1.12, Math.max(ry * 1.12, 12 * s), 0.32);
    ctx.translate(x, y); if (k < 1) { const e = ease.outBack(clamp(k)); ctx.scale(Math.max(0.01, e), Math.max(0.01, e * (0.6 + 0.4 * k))); }
    ctx.drawImage(spr, -spr.cx * f, -spr.cy * f, spr.width * f, spr.height * f);
    ctx.restore();
    if (o.t !== undefined && (o.sparkle ?? 0.6) > 0) FX.glazeSparkle(ctx, o.t, x - rx * 0.15, y - hh * 0.6, rx * 0.55, (o.sparkle ?? 0.6) * k, { n: 4, ryr: 0.5, size: 0.45 * s, seed: seed + 3 });
    if (o.steam && o.t !== undefined) FX.steam(ctx, o.t, { x, y: y - hh * 0.8, w: rx * 0.9, h: 380 * s, n: 7, k: o.steam, s, seed: seed + 9 });
  }
  return { center: [x, y], top: [x, y - hh], rx, ry, h: hh };
}

// ricePot ---------------------------------------------------------------------------------------------------------
function ricePot(ctx, x, y, s = 1, o = {}) {
  const lid = clamp(o.lid ?? 0), t = o.t ?? 0, rx = 300 * s, ry = 135 * s, Hb = 330 * s;
  ctx.save();
  shadowEll(ctx, x, y + Hb + 10 * s, rx * 1.15, ry * 0.9, 0.5);
  // body
  ctx.fillStyle = lgr(ctx, x - rx, 0, x + rx, 0, [[0, '#4c5258'], [0.12, '#9aa1a8'], [0.3, '#e6eaee'], [0.42, '#b9c0c6'], [0.7, '#7d848c'], [0.92, '#a8aeb4'], [1, '#50565c']]);
  ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.lineTo(x - rx * 0.97, y + Hb); ctx.ellipse(x, y + Hb, rx * 0.97, ry * 0.97, 0, PI, 0, true); ctx.lineTo(x + rx, y); ctx.closePath(); ctx.fill();
  // body bands, scratches
  ctx.strokeStyle = 'rgba(40,44,50,0.35)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.ellipse(x, y + Hb * 0.12, rx * 0.998, ry, 0, 0, PI); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(x, y + Hb * 0.12 + 4 * s, rx * 0.995, ry, 0, 0.2, PI - 0.2); ctx.stroke();
  const r = rng(441); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const px = x + (r() - 0.5) * rx * 1.7, py = y + Hb * (0.25 + r() * 0.65); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (r() - 0.5) * 50 * s, py + (r() - 0.5) * 6 * s); ctx.stroke(); }
  // handles
  for (const sd of [-1, 1]) {
    ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.roundRect(x + sd * rx - (sd > 0 ? 0 : 56 * s), y + 40 * s, 56 * s, 26 * s, 10 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + sd * rx - (sd > 0 ? -6 * s : 50 * s), y + 44 * s, 44 * s, 4 * s);
  }
  // rim + interior
  ctx.fillStyle = '#5c636a'; ell(ctx, x, y, rx, ry); ctx.fill();
  ctx.fillStyle = lgr(ctx, 0, y - ry, 0, y + ry, [[0, '#3c4248'], [1, '#8a9198']]); ell(ctx, x, y + 3 * s, rx * 0.95, ry * 0.93); ctx.fill();
  ctx.save(); ell(ctx, x, y + 3 * s, rx * 0.95, ry * 0.93); ctx.clip();
  const rt = brokenRice(ctx, x, y + 55 * s, s, { R: 300, sq: 0.45, hk: 0.22, shadow: false, seed: 7, t, sparkle: 0.8 });
  // inner wall shading over the rice (back wall occludes slightly)
  ctx.fillStyle = lgr(ctx, 0, y - ry, 0, y + 10 * s, [[0, 'rgba(40,46,52,0.75)'], [1, 'rgba(40,46,52,0)']]); ctx.fillRect(x - rx, y - ry, rx * 2, ry + 10 * s);
  ctx.restore();
  ctx.strokeStyle = lgr(ctx, x - rx, 0, x + rx, 0, [[0, '#8e959c'], [0.3, '#f4f6f8'], [0.6, '#a2a9b0'], [1, '#e0e4e8']]); ctx.lineWidth = 9 * s; ell(ctx, x, y, rx, ry); ctx.stroke();
  // steam
  const sk = (o.steam ?? 1);
  if (sk > 0) FX.steam(ctx, t, { x, y: y + 20 * s, w: rx * 1.3, h: 520 * s + lid * 300 * s, n: Math.round(6 + lid * 8), k: sk * (0.25 + lid * 0.9), s: s * (1 + lid * 0.6), seed: 17 });
  // lid
  const lx = x + lid * 210 * s, ly = y - 8 * s - ease.out(lid) * 330 * s, lr = -lid * 0.55;
  ctx.save(); ctx.translate(lx, ly); ctx.rotate(lr);
  if (lid > 0.02) { // underside with condensation
    ctx.fillStyle = '#6d747b'; ell(ctx, 0, 6 * s, rx * 1.01, ry * (0.5 + lid * 0.5)); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 24; i++) { const a = r() * TAU, d = Math.sqrt(r()); ell(ctx, Math.cos(a) * d * rx * 0.85, 6 * s + Math.sin(a) * d * ry * (0.5 + lid * 0.4), 3 * s, 2.5 * s); ctx.fill(); }
  }
  ctx.fillStyle = lgr(ctx, -rx, 0, rx, 0, [[0, '#5d646b'], [0.25, '#d6dbe0'], [0.38, '#ffffff'], [0.5, '#c2c8ce'], [1, '#666d74']]);
  ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.02, ry * 1.02, 0, 0, PI); ctx.ellipse(0, -ry * 0.25, rx * 0.98, ry * 1.25 + 40 * s, 0, PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(50,55,60,0.6)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.02, ry * 1.02, 0, 0, PI); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -rx * 0.35, -ry * 0.75, rx * 0.25, ry * 0.18, -0.2); ctx.fill();
  ctx.fillStyle = '#1e1e22'; ctx.beginPath(); ctx.roundRect(-36 * s, -ry * 1.25 - 66 * s, 72 * s, 34 * s, 14 * s); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-26 * s, -ry * 1.25 - 60 * s, 40 * s, 5 * s);
  ctx.restore();
  ctx.restore();
  return { rim: { x, y, rx, ry }, riceTop: rt.top, lid: [lx, ly], body: [x, y + Hb * 0.5] };
}
function paddleScoop(ctx, x, y, s = 1, o = {}) {
  const rot = o.rot ?? -0.5, k = clamp(o.k ?? 1);
  const hx = x + Math.cos(rot) * 330 * s, hy = y + Math.sin(rot) * 330 * s;
  ctx.save();
  // handle
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = lgr(ctx, 0, -18 * s, 0, 18 * s, [[0, '#e9c98e'], [0.4, '#d4a964'], [1, '#9c7038']]);
  ctx.beginPath(); ctx.moveTo(80 * s, -16 * s); ctx.lineTo(340 * s, -13 * s); ctx.quadraticCurveTo(356 * s, 0, 340 * s, 13 * s); ctx.lineTo(80 * s, 16 * s); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(110,70,30,0.35)'; ctx.lineWidth = 1.5 * s; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(90 * s, (-8 + i * 7) * s); ctx.lineTo(335 * s, (-7 + i * 6) * s); ctx.stroke(); }
  // blade (seen 3q, flat oval)
  ctx.fillStyle = lgr(ctx, -110 * s, 0, 100 * s, 0, [[0, '#f0d7a4'], [0.5, '#e0bb7a'], [1, '#c3954e']]);
  ctx.beginPath(); ctx.ellipse(0, 0, 112 * s, 70 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,35,0.6)'; ctx.lineWidth = 3 * s; ctx.stroke();
  ctx.restore();
  let top = [x, y];
  if (k > 0) top = brokenRice(ctx, x - 6 * s, y + 8 * s, s, { R: 92, sq: 0.6, hk: 1.1, k, shadow: false, seed: 4, t: o.t, steam: o.steam }).top;
  ctx.restore();
  return { blade: [x, y], heapTop: top, handle: [hx, hy] };
}

// ================================================================================================= PORK CHOP
// irregular pounded chop: narrow bone end on the left, wide lobe on the right, fat cap only along the TOP edge
const CHOP_OUT = [[-188, -56], [-150, -84], [-90, -90], [-20, -102], [60, -104], [138, -88], [188, -50], [204, 4], [186, 54], [140, 86], [70, 98], [10, 90], [-50, 100], [-112, 92], [-160, 66], [-196, 20], [-204, -24]];
const CHOP_IN = CHOP_OUT.map(([px, py]) => { const f = clamp((-py - 30) / 60); return [px * (0.965 - f * 0.02), py * 0.96 + f * 26]; });
const BONE_EDGE = [[-174, -76], [-160, -36], [-156, 8], [-162, 50], [-174, 72]];
const CHOP_PATH = new Path2D(); (() => { const p = CHOP_PATH; crPath(p, CHOP_OUT); p.moveTo(-164, -86); p.arc(-178, -86, 14, 0, TAU); })();
const CHOP_OX = 250, CHOP_OY = 124, CHOP_W = 460, CHOP_H = 252;
function chopSprite(c, sc, seed, back) {
  return cached(`chop|${c}|${sc}|${seed}|${back ? 1 : 0}`, CHOP_W * sc, CHOP_H * sc, (x) => {
    const r = rng(seed * 31 + (back ? 7 : 0));
    x.scale(sc, sc); x.translate(CHOP_OX, CHOP_OY);
    const mar = smooth(0.12, 0.4, c), grill = smooth(0.55, 0.92, c), ch = smooth(0.6, 1, c), gl = smooth(0.3, 1, c), raw = 1 - smooth(0.05, 0.35, c);
    const meatC = col3(c, [236, 160, 156], [184, 108, 58], [150, 62, 24]), meatE = col3(c, [214, 120, 124], [150, 82, 40], [96, 34, 10]);
    const fatC = col3(c, [250, 240, 226], [234, 198, 142], [224, 156, 76]), fatE = col3(c, [236, 220, 204], [212, 166, 106], [170, 90, 30]);
    const boneC = col3(c, [242, 232, 214], [224, 196, 152], [196, 140, 82]);
    // fat body
    x.beginPath(); crPath(x, CHOP_OUT); x.fillStyle = rgr(x, 0, -20, 20, 0, 0, 200, [[0, rgb(fatC)], [1, rgb(fatE)]]); x.fill();
    x.save(); x.beginPath(); crPath(x, CHOP_OUT); x.clip();
    // meat
    x.beginPath(); crPath(x, CHOP_IN); x.fillStyle = rgr(x, -10, -16, 10, 0, 0, 175, [[0, rgb(mul(meatC, 1.06))], [0.6, rgb(meatC)], [1, rgb(meatE)]]); x.fill();
    // soft fat/meat transition
    x.strokeStyle = rgb(mixA(fatC, meatE, 0.5), 0.6); x.lineWidth = 5; x.beginPath(); crPath(x, CHOP_IN); x.stroke();
    // fat seam
    x.strokeStyle = rgb(mixA(fatC, meatC, 0.4), 0.45 - grill * 0.25); x.lineWidth = 5; x.beginPath(); crPath(x, [[64, -80], [90, -30], [98, 20], [84, 66]], false); x.stroke();
    // fibres
    x.lineWidth = 1.4; x.strokeStyle = rgb(mul(meatE, 0.8), 0.18);
    for (let i = 0; i < 46; i++) { const px = -170 + r() * 330, py = -80 + r() * 160, ln = 30 + r() * 60; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + ln * 0.5, py - 6 + r() * 12, px + ln, py + (r() - 0.5) * 14); x.stroke(); }
    // raw marbling
    if (raw > 0.01) { x.strokeStyle = `rgba(255,236,236,${0.55 * raw})`; for (let i = 0; i < 9; i++) { x.lineWidth = 1.5 + r() * 2.5; const px = -150 + r() * 270, py = -60 + r() * 120; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 20, py - 10, px + 30, py + 14, px + 55 + r() * 20, py + (r() - 0.5) * 20); x.stroke(); } }
    // marinade flecks (lemongrass / garlic / shallot / pepper), toasted when grilled
    if (mar > 0.01) {
      const tone = (cc) => mixA(cc, [70, 30, 10], grill * 0.55);
      const cols = [[218, 214, 120], [246, 234, 200], [176, 84, 114], [40, 28, 18]];
      for (let i = 0; i < 110; i++) {
        const px = -170 + r() * 345, py = -82 + r() * 180, ci = i % 4, sz = ci === 3 ? 1.6 : 2 + r() * 3.2;
        x.fillStyle = rgb(tone(cols[ci]), mar * (ci === 3 ? 0.8 : 0.85)); x.save(); x.translate(px, py); x.rotate(r() * PI); x.fillRect(-sz, -sz * 0.5, sz * 2, sz); x.restore();
      }
      // marinade wash (amber, darker in the recesses)
      x.fillStyle = `rgba(150,82,30,${0.18 * mar * (1 - grill)})`; x.fill(CHOP_PATH);
    }
    // caramel pools
    if (gl > 0.01) {
      for (let i = 0; i < 24; i++) {
        const px = -150 + r() * 300, py = -70 + r() * 150, rx = 6 + r() * 16, ry = 3 + r() * 7, a = r() * PI;
        x.fillStyle = rgb(col3(c, [240, 180, 170], [214, 140, 70], [214, 120, 42]), 0.45 * gl); ell(x, px, py, rx, ry, a); x.fill();
      }
    }
    // grill marks
    if (grill > 0.01) {
      const ang = back ? 0.62 : -0.62, ca = Math.cos(ang), sa = Math.sin(ang);
      x.lineCap = 'round';
      for (let j = -5; j <= 5; j++) {
        const off = j * 46 + (back ? 18 : 0);
        for (let seg = 0; seg < 4; seg++) {
          const t0 = -230 + seg * 120 + r() * 20, t1 = t0 + 90 + r() * 25;
          const P0 = [off * -sa + t0 * ca, off * ca + t0 * sa], P1 = [off * -sa + t1 * ca, off * ca + t1 * sa];
          const wv = 13 + r() * 6;
          x.strokeStyle = `rgba(92,40,12,${0.4 * grill})`; x.lineWidth = wv * 2.1; x.beginPath(); x.moveTo(P0[0], P0[1]); x.lineTo(P1[0], P1[1]); x.stroke();
          x.strokeStyle = `rgba(30,12,4,${0.88 * grill})`; x.lineWidth = wv; x.stroke();
          x.strokeStyle = `rgba(10,4,2,${0.6 * grill})`; x.lineWidth = wv * 0.4; x.stroke();
        }
      }
    }
    // char on the edges + blotches
    if (ch > 0.01) {
      x.strokeStyle = `rgba(34,12,4,${0.6 * ch})`; x.lineWidth = 34; x.beginPath(); crPath(x, CHOP_OUT); x.stroke();
      x.strokeStyle = `rgba(20,8,2,${0.6 * ch})`; x.lineWidth = 12; x.stroke();
      for (let i = 0; i < 40; i++) {
        const p = CHOP_OUT[i % CHOP_OUT.length], q = CHOP_OUT[(i + 1) % CHOP_OUT.length], f = r();
        const px = lerp(p[0], q[0], f) * (0.82 + r() * 0.12), py = lerp(p[1], q[1], f) * (0.82 + r() * 0.12);
        x.fillStyle = `rgba(28,10,3,${(0.3 + r() * 0.4) * ch})`; ell(x, px, py, 5 + r() * 12, 3 + r() * 7, r() * PI); x.fill();
      }
    }
    // lacquer: darker recess + glossy highlights
    if (gl > 0.01) {
      x.fillStyle = rgr(x, -60, -50, 10, 0, 0, 220, [[0, `rgba(255,190,110,${0.22 * gl})`], [0.5, 'rgba(255,170,80,0)'], [1, `rgba(40,10,0,${0.25 * gl})`]]); x.fill(CHOP_PATH);
      x.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const px = -140 + r() * 260, py = -60 + r() * 110, ln = 14 + r() * 40, a = -0.3 + r() * 0.6;
        x.strokeStyle = `rgba(255,236,200,${(0.3 + r() * 0.35) * gl})`; x.lineWidth = 2 + r() * 3.5;
        x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + ln * 0.5 * Math.cos(a), py + ln * 0.5 * Math.sin(a) - 4, px + ln * Math.cos(a), py + ln * Math.sin(a)); x.stroke();
      }
      for (let i = 0; i < 18; i++) { const px = -150 + r() * 300, py = -70 + r() * 150; x.fillStyle = `rgba(255,248,230,${0.55 * gl})`; ell(x, px, py, 1.5 + r() * 2.5, 1 + r() * 1.5); x.fill(); }
    } else if (raw > 0.01) {
      x.strokeStyle = `rgba(255,250,250,${0.35 * raw})`; x.lineCap = 'round';
      for (let i = 0; i < 6; i++) { x.lineWidth = 2 + r() * 3; const px = -130 + r() * 230, py = -55 + r() * 90; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 18 + r() * 30, py - 3 + r() * 6); x.stroke(); }
    }
    x.restore(); // unclip
    // rib bone: a curved bar along the narrow left end, poking out at the top as a rounded knob
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = rgb(mixA(meatE, [30, 10, 2], 0.3), 0.55); x.lineWidth = 30; x.beginPath(); crPath(x, BONE_EDGE, false); x.stroke();
    x.strokeStyle = rgb(mul(boneC, 0.74)); x.lineWidth = 22; x.stroke();
    x.strokeStyle = rgb(boneC); x.lineWidth = 15; x.stroke();
    x.strokeStyle = `rgba(255,255,255,${0.5 - ch * 0.25})`; x.lineWidth = 4; x.beginPath(); crPath(x, BONE_EDGE.map(p => [p[0] - 4, p[1]]), false); x.stroke();
    x.fillStyle = rgr(x, -182, -90, 2, -178, -86, 15, [[0, rgb(mul(boneC, 1.08))], [1, rgb(mul(boneC, 0.76))]]); ell(x, -178, -86, 15, 13); x.fill();
    x.strokeStyle = rgb(mul(boneC, 0.6)); x.lineWidth = 2.5; x.stroke();
    x.fillStyle = rgb(mixA([200, 130, 120], [90, 40, 20], c), 0.9); ell(x, -180, -88, 5, 4); x.fill();
    if (ch > 0.01) { x.fillStyle = `rgba(40,16,4,${0.55 * ch})`; for (let i = 0; i < 7; i++) { const p = BONE_EDGE[i % 5]; ell(x, p[0] + (r() - 0.5) * 10, p[1] + (r() - 0.5) * 16, 3 + r() * 5, 2 + r() * 3); x.fill(); } ell(x, -186, -92, 6, 4); x.fill(); }
    // outline
    x.strokeStyle = rgb(mul(meatE, 0.55), 0.55); x.lineWidth = 2; x.beginPath(); crPath(x, CHOP_OUT); x.stroke();
  });
}
function chopSide(c, sc) {
  return cached(`chopS|${c}|${sc}`, CHOP_W * sc, CHOP_H * sc, (x) => {
    x.scale(sc, sc); x.translate(CHOP_OX, CHOP_OY);
    const sideC = col3(c, [196, 116, 116], [130, 70, 34], [70, 24, 6]);
    x.fillStyle = rgb(sideC); x.fill(CHOP_PATH);
  });
}
function porkChop(ctx, x, y, s = 1, o = {}) {
  const cook = clamp(o.cook ?? 1), flip = clamp(o.flip || 0), th = flip * PI, cs = Math.cos(th), sn = Math.sin(th);
  const topDown = !!o.topDown, sq = topDown ? 1 : (o.sq ?? 0.55), rot = o.rot || 0, seed = o.seed ?? 1, t = o.t ?? 0;
  const lift = Math.sin(flip * PI) * (o.liftH ?? 140) * s, back = cs < 0;
  const cF = back ? clamp(o.cookB ?? cook) : cook, cq = Math.round(cF * 16) / 16, sc = bk(s);
  const spr = chopSprite(cq, sc, seed, back), side = chopSide(cq, sc), thick = (o.thick ?? 16) * s * (topDown ? 0.4 : 1);
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const P = (px, py) => { const X = px * s, Y = py * s * cs; return [x + X * cr - Y * sr, y - lift + (X * sr + Y * cr) * sq]; };
  ctx.save();
  if (o.shadow !== false) shadowEll(ctx, x + 10 * s, y + 14 * s, 200 * s * (1 - flip * 0.15), 100 * s * sq * (0.8 + 0.2 * Math.abs(cs)), 0.4 * (1 - Math.sin(flip * PI) * 0.4), rot * sq);
  ctx.translate(x, y - lift);
  const face = (img, dy, dyL) => {
    ctx.save(); ctx.translate(0, dy); ctx.scale(1, sq); ctx.rotate(rot); ctx.translate(0, dyL); ctx.scale(s, s * cs);
    ctx.drawImage(img, -CHOP_OX, -CHOP_OY, CHOP_W, CHOP_H); ctx.restore();
  };
  // thickness: resting thickness (screen-down) + flip edge (perpendicular to the long axis)
  const fe = 22 * s * Math.abs(sn), sgn = back ? -1 : 1, NL = 5;
  for (let j = NL; j >= 1; j--) face(side, thick * j / NL, fe > 1 ? sgn * fe * j / NL / Math.max(0.3, sq) : 0);
  if (Math.abs(cs) < 0.3) { // edge-on during a flip: show the slab's cut edge so it never vanishes
    const e = 1 - Math.abs(cs) / 0.3, sideC = col3(cq, [196, 116, 116], [130, 70, 34], [70, 24, 6]);
    ctx.save(); ctx.scale(1, sq); ctx.rotate(rot); ctx.globalAlpha = e;
    ctx.fillStyle = lgr(ctx, 0, -14 * s, 0, 14 * s, [[0, rgb(mul(sideC, 1.25))], [0.5, rgb(sideC)], [1, rgb(mul(sideC, 0.6))]]);
    ctx.beginPath(); ctx.roundRect(-204 * s, -11 * s / Math.max(0.3, sq), 408 * s, 22 * s / Math.max(0.3, sq), 11 * s); ctx.fill();
    ctx.restore();
  }
  face(spr, 0, 0);
  // live gloss sweep
  const gl = smooth(0.3, 1, cF);
  if (gl > 0.02) {
    ctx.save(); ctx.scale(1, sq); ctx.rotate(rot); ctx.scale(s, s * cs); ctx.clip(CHOP_PATH);
    const gx = ((t * 70) % 520) - 260;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = lgr(ctx, gx - 60, -100, gx + 60, 100, [[0, 'rgba(255,200,140,0)'], [0.5, `rgba(255,214,160,${0.22 * gl * Math.abs(cs)})`], [1, 'rgba(255,200,140,0)']]);
    ctx.fillRect(-240, -120, 440, 240);
    ctx.restore();
  }
  ctx.restore();
  if (o.sparkle && cF > 0.5) FX.glazeSparkle(ctx, t, x, y - lift, 140 * s, typeof o.sparkle === 'number' ? o.sparkle : 1, { n: 6, ryr: sq * Math.max(0.2, Math.abs(cs)) * 0.55, size: s * 0.9, seed: seed + 5 });
  return { center: P(0, 0), tip: P(204, 4), bone: P(-178, -86), grab: P(-150, -20), top: P(0, -100), bottom: P(0, 98) };
}

// ------------------------------------------------------------------ tongs / knife (used by grill & chả)
function tongs(ctx, x, y, s = 1, o = {}) {
  const rot = o.rot ?? -2.4, open = clamp(o.open ?? 0.3), Ln = (o.len ?? 420) * s, gap = (6 + open * 46) * s;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const arm = (sd) => {
    const g0 = sd * 7 * s, g1 = sd * gap;
    ctx.fillStyle = lgr(ctx, 0, g1 - 12 * s, 0, g1 + 12 * s, [[0, '#6c737a'], [0.35, '#f2f5f7'], [0.6, '#b4bbc2'], [1, '#585f66']]);
    ctx.beginPath(); ctx.moveTo(-Ln, g0 - 7 * s); ctx.lineTo(-30 * s, g1 - 10 * s);
    for (let i = 0; i < 4; i++) ctx.arc(-30 * s + i * 9 * s + 4.5 * s, g1 - 10 * s, 4.5 * s, PI, 0, false); // scalloped tip
    ctx.lineTo(6 * s, g1 + 9 * s); ctx.lineTo(-Ln, g0 + 7 * s); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,34,38,0.6)'; ctx.lineWidth = 1.5 * s; ctx.stroke();
    // silicone grip
    ctx.fillStyle = '#1d1d21'; ctx.beginPath(); ctx.moveTo(-Ln + 20 * s, g0 - 9 * s); ctx.lineTo(-Ln + 170 * s, lerp(g0, g1, 0.38) - 10 * s); ctx.lineTo(-Ln + 170 * s, lerp(g0, g1, 0.38) + 10 * s); ctx.lineTo(-Ln + 20 * s, g0 + 9 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-Ln + 30 * s, g0 - 6 * s + sd * 0, 130 * s, 3 * s);
  };
  arm(-1); arm(1);
  ctx.strokeStyle = '#c8cdd2'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.arc(-Ln - 10 * s, 0, 14 * s, 0, TAU); ctx.stroke();
  ctx.restore();
  const P = (d) => [x + Math.cos(rot) * d, y + Math.sin(rot) * d];
  return { tip: [x, y], handle: P(-Ln), grip: P(-Ln + 100 * s) };
}
function knife(ctx, x, y, s = 1, o = {}) {
  const rot = o.rot ?? 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = lgr(ctx, 0, -60, 0, 4, [[0, '#7a838c'], [0.25, '#dfe5ea'], [0.6, '#f7f9fb'], [0.85, '#aab2ba'], [1, '#ffffff']]);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(120, 4, 270, 2); ctx.lineTo(270, -58); ctx.lineTo(60, -40); ctx.quadraticCurveTo(20, -22, 0, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,46,52,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, -2); ctx.quadraticCurveTo(120, 2, 268, 0); ctx.stroke();
  ctx.fillStyle = '#2a2a2e'; ctx.beginPath(); ctx.roundRect(268, -50, 170, 40, 14); ctx.fill();
  ctx.fillStyle = '#d8dde2'; for (const px of [300, 350, 400]) { ell(ctx, px, -30, 5, 5); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(278, -46, 150, 6);
  ctx.restore();
  return { tip: [x, y], handle: [x + Math.cos(rot) * 420 * s, y + Math.sin(rot) * 420 * s] };
}

// ------------------------------------------------------------------ grill
function coalSprite(Wp, Hp) {
  const Wq = Math.round(Wp / 20) * 20, Hq = Math.round(Hp / 10) * 10;
  return cached(`coal|${Wq}|${Hq}`, Wq, Hq, (x) => {
    const r = rng(77);
    x.fillStyle = rgr(x, Wq / 2, Hq / 2, 4, Wq / 2, Hq / 2, Wq * 0.55, [[0, '#ff8a2a'], [0.45, '#d8461a'], [0.8, '#5a1608'], [1, '#2a0a04']]); x.fillRect(0, 0, Wq, Hq);
    const n = Math.round(Wq * Hq / 900);
    const lumps = []; for (let i = 0; i < n; i++) lumps.push({ x: r() * Wq, y: r() * Hq, r: 14 + r() * 26, s: r() });
    lumps.sort((a, b) => a.y - b.y);
    for (const l of lumps) {
      const k = 6 + (l.s * 4 | 0), pts = [];
      for (let i = 0; i < k; i++) { const a = i / k * TAU, rr = l.r * (0.7 + r() * 0.45); pts.push([l.x + Math.cos(a) * rr, l.y + Math.sin(a) * rr * 0.7]); }
      x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath();
      const hot = 1 - Math.abs(l.y / Hq - 0.5) * 1.4, ashy = r();
      x.fillStyle = lgr(x, l.x, l.y - l.r, l.x, l.y + l.r, [[0, ashy > 0.6 ? '#8a8480' : '#3a3230'], [0.5, '#1c1614'], [1, '#0c0908']]); x.fill();
      // glowing cracks / rim
      x.save(); x.clip(); x.globalCompositeOperation = 'lighter';
      x.strokeStyle = `rgba(255,${100 + hot * 80 | 0},30,${0.35 + hot * 0.4})`; x.lineWidth = 2.5;
      for (let j = 0; j < 3; j++) { const a = r() * TAU; x.beginPath(); x.moveTo(l.x + Math.cos(a) * l.r, l.y + Math.sin(a) * l.r * 0.7); x.lineTo(l.x + (r() - 0.5) * l.r * 0.6, l.y + (r() - 0.5) * l.r * 0.4); x.lineTo(l.x + Math.cos(a + 2) * l.r, l.y + Math.sin(a + 2) * l.r * 0.7); x.stroke(); }
      x.fillStyle = rgr(x, l.x, l.y + l.r * 0.6, 0, l.x, l.y + l.r * 0.6, l.r, [[0, `rgba(255,120,30,${0.5 * hot + 0.15})`], [1, 'rgba(255,80,10,0)']]); x.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      x.restore();
      if (ashy > 0.6) { x.fillStyle = 'rgba(210,205,200,0.35)'; for (let j = 0; j < 4; j++) { ell(x, l.x + (r() - 0.5) * l.r, l.y - l.r * 0.3 + (r() - 0.5) * l.r * 0.4, 2 + r() * 4, 1.5 + r() * 2); x.fill(); } }
    }
  });
}
function chopsOnGrill(ctx, t, o = {}) {
  const x = o.x ?? 540, y = o.y ?? 1150, s = o.s ?? 1, w = (o.w ?? 820) * s, n = o.n ?? 3, heat = o.heat ?? 1, seed = o.seed ?? 3;
  const ry = w * 0.27, nearF = 1.06, farF = 0.82;
  const proj = (u, v) => { const f = lerp(farF, nearF, (v + 1) / 2); return [x + u * w / 2 * f, y + v * ry]; };
  const coalY = y + 70 * s;
  ctx.save();
  // trough interior back
  const bl = proj(-1.06, -1), br = proj(1.06, -1), fl = proj(-1.06, 1), fr = proj(1.06, 1);
  shadowEll(ctx, x, fr[1] + 120 * s, w * 0.62, 70 * s, 0.6);
  ctx.fillStyle = '#121014'; ctx.beginPath(); ctx.moveTo(bl[0], bl[1] - 10 * s); ctx.lineTo(br[0], br[1] - 10 * s); ctx.lineTo(fr[0], fr[1] + 100 * s); ctx.lineTo(fl[0], fl[1] + 100 * s); ctx.closePath(); ctx.fill();
  // coals
  const cw = w * 0.98, ch = ry * 2 * 0.95, coal = coalSprite(cw / s * 0.5, ch / s * 0.5);
  ctx.save(); ctx.beginPath(); ctx.moveTo(bl[0] + 6 * s, bl[1] + 60 * s); ctx.lineTo(br[0] - 6 * s, br[1] + 60 * s); ctx.lineTo(fr[0] - 8 * s, fr[1] + 70 * s); ctx.lineTo(fl[0] + 8 * s, fl[1] + 70 * s); ctx.closePath(); ctx.clip();
  ctx.drawImage(coal, x - cw / 2, coalY - ch / 2 + 6 * s, cw, ch);
  FX.embersGlow(ctx, t, x, coalY + 10 * s, cw * 0.9, ch * 0.8, { k: heat, seed });
  ctx.restore();
  // flare-ups from fat drips (behind chops)
  const r = rng(seed * 13), CH = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : lerp(-0.62, 0.62, i / (n - 1)), v = (i % 2 ? 0.18 : -0.12);
    CH.push({ u, v, rot: (r() - 0.5) * 0.3 + (i % 2 ? PI * 0.04 : -PI * 0.03), per: 1.1 + r() * 0.9, ph: r() });
  }
  if (o.drips !== false) for (const c of CH) {
    const [px, py] = proj(c.u + 0.1, c.v + 0.2), cyc = (t / c.per + c.ph) % 1, tt = cyc * c.per;
    if (tt < 0.22) { const dy = 0.5 * 2600 * s * tt * tt; ctx.fillStyle = 'rgba(255,200,90,0.9)'; ell(ctx, px, py + 10 * s + dy, 3.5 * s, 6 * s); ctx.fill(); }
    else if (tt < 0.22 + 0.7) FX.flareUp(ctx, t, px, coalY + 30 * s + (c.v + 0.2) * ry * 0.6, (tt - 0.22) / 0.7, { s: s * 0.85 * Math.min(1.4, 0.6 + heat * 0.4), seed: (c.ph * 99) | 0 });
  }
  // rack: wires parallel to u plus two cross bars
  ctx.lineCap = 'round';
  for (let j = 0; j <= 14; j++) {
    const v = -1 + j / 7, a = proj(-1, v), b = proj(1, v);
    ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(a[0], a[1] + 2 * s); ctx.lineTo(b[0], b[1] + 2 * s); ctx.stroke();
    ctx.strokeStyle = lgr(ctx, a[0], 0, b[0], 0, [[0, '#7c8288'], [0.4, '#e8ecf0'], [0.7, '#9aa0a6'], [1, '#c8cdd2']]); ctx.lineWidth = 3.5 * s; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  for (const u of [-1, -0.33, 0.33, 1]) { const a = proj(u, -1), b = proj(u, 1); ctx.strokeStyle = '#a8aeb4'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  // front lip of the trough
  ctx.fillStyle = lgr(ctx, 0, fl[1] + 6 * s, 0, fl[1] + 110 * s, [[0, '#4a4a50'], [0.15, '#22222a'], [1, '#0c0c10']]);
  ctx.beginPath(); ctx.moveTo(fl[0] - 8 * s, fl[1] + 8 * s); ctx.lineTo(fr[0] + 8 * s, fr[1] + 8 * s); ctx.lineTo(fr[0], fr[1] + 110 * s); ctx.lineTo(fl[0], fl[1] + 110 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,140,60,0.35)'; ctx.fillRect(fl[0], fl[1] + 8 * s, fr[0] - fl[0], 3 * s);
  // chops
  const out = [];
  const order = CH.map((c, i) => i).sort((a, b) => CH[a].v - CH[b].v);
  const cooks = Array.isArray(o.cook) ? o.cook : null;
  for (const i of order) {
    const c = CH[i], [px, py] = proj(c.u, c.v), f = lerp(farF, nearF, (c.v + 1) / 2);
    const cook = cooks ? cooks[i] ?? 1 : (o.cook ?? 1), fk = i === o.flipIdx ? clamp(o.flipK || 0) : 0;
    const cookB = Array.isArray(o.cookB) ? o.cookB[i] : (o.cookB ?? Math.min(1, cook + 0.25));
    const A = porkChop(ctx, px, py - 6 * s, s * 0.82 * f, { cook, cookB, flip: fk, rot: c.rot, sq: 0.5, seed: seed + i, t, shadow: false });
    out[i] = A;
    if (o.sizzle !== false) FX.sizzle(ctx, t, px, py - 8 * s, Math.min(1.3, 0.35 + 0.5 * heat) * (fk > 0 && fk < 1 ? 0.3 : 1), { r: 130 * s * f, ryr: 0.42, n: 26, spat: 8, s: s * f, seed: seed * 5 + i });
    if (fk > 0 && fk < 1 && o.tongs !== false) tongs(ctx, A.grab[0], A.grab[1], s * 0.95, { rot: -2.45 + Math.sin(fk * PI) * 0.25, open: 0.1 });
  }
  if (o.sparks !== false) FX.sparks(ctx, t, { x, y: coalY, w: w * 0.8, h: 600 * s, n: Math.round(18 * heat + 6), s, seed: seed + 41, wind: o.wind || 0 });
  if (o.smoke !== false) FX.charcoalSmoke(ctx, t, { x, y: y - 20 * s, w: w * 0.7, h: 1100 * s, density: o.smokeDensity ?? 0.55, tint: o.smokeTint || 'warm', drift: o.drift ?? 120, s, seed: seed + 2, light: o.light, neonX: o.neonX });
  ctx.restore();
  return { chops: out, rack: { x, y, w, ry }, coal: [x, coalY] };
}

// ================================================================================================= MARINADE BOWL
const MAR_COL = { lemongrass: [[226, 222, 140], [200, 210, 110]], garlic: [[250, 242, 214], [232, 222, 186]], shallot: [[190, 92, 130], [232, 170, 190]] };
const LIQ = { honey: { col: [230, 150, 30], hi: [255, 220, 120], w: 13, a: 0.85 }, milk: { col: [248, 240, 220], hi: [255, 255, 255], w: 15, a: 0.95 }, fishsauce: { col: [176, 92, 24], hi: [255, 190, 110], w: 26, a: 0.55 } };
function marinadeBowl(ctx, t, o = {}) {
  const x = o.x ?? 540, y = o.y ?? 980, s = o.s ?? 1, R = (o.R ?? 330) * s, toss = clamp(o.toss || 0), add = o.add || [], seed = o.seed ?? 5;
  const tk = Math.sin(toss * PI), tossPh = toss * PI * 3;
  ctx.save();
  shadowEll(ctx, x + 18 * s, y + 26 * s, R * 1.18, R * 1.1, 0.55);
  // bowl rim
  ctx.fillStyle = rgr(ctx, x - R * 0.3, y - R * 0.4, R * 0.2, x, y, R * 1.08, [[0, '#ffffff'], [0.85, '#e6e6ea'], [1, '#b0b4bc']]); ell(ctx, x, y, R * 1.08, R * 1.08); ctx.fill();
  ctx.strokeStyle = '#2c5aa8'; ctx.lineWidth = 7 * s; ell(ctx, x, y, R * 1.035, R * 1.035); ctx.stroke();
  // interior
  ctx.fillStyle = rgr(ctx, x + R * 0.25, y + R * 0.3, R * 0.1, x, y, R, [[0, '#fafafa'], [0.7, '#e8e8ec'], [1, '#c4c6cc']]); ell(ctx, x, y, R, R); ctx.fill();
  ctx.save(); ell(ctx, x, y, R * 0.985, R * 0.985); ctx.clip();
  // marinade pool forming as it's tossed
  const liqSum = add.filter(a => LIQ[a.item]).reduce((p, a) => p + clamp(a.k), 0);
  const pool = clamp(liqSum * 0.12 + toss * 0.8);
  if (pool > 0.01) { ctx.fillStyle = rgr(ctx, x, y, R * 0.2, x, y, R, [[0, `rgba(150,78,24,${0.55 * pool})`], [1, `rgba(120,60,16,${0.35 * pool})`]]); ell(ctx, x, y, R * 0.95, R * 0.95); ctx.fill(); }
  // chops
  const CP = [[-70, -95, 0.35], [80, 25, -0.45], [-45, 120, 0.12]];
  const cook = Math.min(0.36, 0.02 + toss * 0.36 + liqSum * 0.02);
  CP.forEach((p, i) => {
    const jx = Math.sin(tossPh + i * 2) * 40 * s * tk, jy = Math.cos(tossPh * 1.3 + i) * 30 * s * tk, jr = Math.sin(tossPh + i) * 0.5 * tk;
    porkChop(ctx, x + p[0] * s * R / (330 * s) + jx, y + p[1] * s * R / (330 * s) + jy, s * 0.6 * R / (330 * s), { cook, topDown: true, rot: p[2] + jr + toss * (i - 1) * 0.8, seed: seed + i, shadow: true });
  });
  // items
  const r = rng(seed * 7), land = {}, LANDS = { lemongrass: [-130, -30], garlic: [100, -110], shallot: [40, 150], honey: [0, 0], milk: [0, 0], fishsauce: [20, 20] };
  for (const a of add) {
    const k = clamp(a.k ?? 0); const L0 = LANDS[a.item] || [0, 0], lx = x + L0[0] * R / 330, ly = y + L0[1] * R / 330; land[a.item] = [lx, ly];
    if (k <= 0) continue;
    if (MAR_COL[a.item]) {
      const fall = ease.in2(clamp(k / 0.45)), landed = k >= 0.45, spread = ease.out(clamp((k - 0.45) / 0.55));
      const rr = rng(seed * 100 + a.item.length * 13), cc = MAR_COL[a.item];
      for (let i = 0; i < 46; i++) {
        const ang = rr() * TAU, d0 = Math.sqrt(rr()) * 34 * s, d1 = Math.sqrt(rr()) * 120 * s, ang2 = rr() * TAU, d2 = Math.sqrt(rr()) * R * 0.85;
        let px = lx + Math.cos(ang) * lerp(d0, d1, landed ? spread : 0), py = ly + Math.sin(ang) * lerp(d0, d1, landed ? spread : 0);
        let sc2 = 1;
        if (!landed) { py -= (1 - fall) * 620 * s; px -= (1 - fall) * 160 * s; sc2 = 1 + (1 - fall) * 1.2; }
        if (toss > 0) { const m = smooth(0, 0.9, toss); px = lerp(px, x + Math.cos(ang2) * d2, m) + Math.sin(tossPh + i) * 20 * s * tk; py = lerp(py, y + Math.sin(ang2) * d2, m) - tk * 30 * s * rr(); sc2 *= 1 + tk * 0.3 * rr(); }
        const sz = (a.item === 'lemongrass' ? 7 : 5) * s * sc2 * (0.7 + rr() * 0.6);
        ctx.save(); ctx.translate(px, py); ctx.rotate(rr() * PI);
        ctx.fillStyle = rgb(mul(cc[i % 2], 0.7), 0.5); ctx.fillRect(-sz + 1.5 * s, -sz * 0.45 + 1.5 * s, sz * 2, sz * 0.9 + (a.item === 'lemongrass' ? sz * 0.4 : 0));
        ctx.fillStyle = rgb(mixA(cc[i % 2], [120, 70, 30], toss * 0.5)); ctx.fillRect(-sz, -sz * 0.45, sz * 2, sz * 0.9 + (a.item === 'lemongrass' ? sz * 0.4 : 0));
        if (a.item === 'lemongrass') { ctx.strokeStyle = 'rgba(150,170,70,0.8)'; ctx.lineWidth = 1.2 * s; ctx.strokeRect(-sz * 0.6, -sz * 0.25, sz * 1.2, sz * 0.9); }
        ctx.restore();
      }
    } else if (LIQ[a.item]) {
      const Lq = LIQ[a.item], fade = 1 - smooth(0.15, 0.75, toss);
      let P;
      if (a.item === 'fishsauce') { P = []; for (let i = 0; i <= 80; i++) { const th = i / 80 * PI * 4.2, rr = (8 + th * 15) * s * R / (330 * s); P.push([lx + Math.cos(th) * rr, ly + Math.sin(th) * rr * 0.95]); } }
      else {
        const base = a.item === 'honey' ? [[-200, -170], [-60, -200], [60, -120], [-80, -40], [80, 30], [-60, 90], [120, 150], [10, 210]] : [[180, -180], [40, -150], [-80, -80], [60, -20], [-120, 50], [40, 110], [-60, 190]];
        P = []; const B = base.map(p => [x + p[0] * R / 330, y + p[1] * R / 330]);
        for (let i = 0; i < B.length - 1; i++) for (let j = 0; j < 10; j++) { const f = j / 10, p0 = B[Math.max(0, i - 1)], p1 = B[i], p2 = B[i + 1], p3 = B[Math.min(B.length - 1, i + 2)]; const f2 = f * f, f3 = f2 * f; P.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * f + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * f2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * f3))); }
        P.push(B[B.length - 1]);
      }
      const Pp = partial(P, ease.inOut(clamp(k / 0.9)));
      if (fade > 0.01 && Pp.length > 1) {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha *= fade;
        ctx.strokeStyle = rgb(mul(Lq.col, 0.6), 0.35 * Lq.a); ctx.lineWidth = Lq.w * s * 1.5; ctx.translate(2 * s, 4 * s); strokePts(ctx, Pp); ctx.translate(-2 * s, -4 * s);
        ctx.strokeStyle = rgb(Lq.col, Lq.a); ctx.lineWidth = Lq.w * s; strokePts(ctx, Pp);
        ctx.strokeStyle = rgb(Lq.hi, 0.75); ctx.lineWidth = Lq.w * s * 0.25; ctx.translate(-Lq.w * 0.2 * s, -Lq.w * 0.2 * s); strokePts(ctx, Pp);
        ctx.restore();
      }
      // falling stream from the upper-left while pouring
      if (k > 0 && k < 0.92) {
        const hd = Pp[Pp.length - 1], top = [hd[0] - 260 * s, hd[1] - 760 * s];
        ctx.save(); ctx.restore();
        ctx.save(); ctx.restore();
        land[a.item + 'Stream'] = top;
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = rgb(Lq.col, Math.min(1, Lq.a + 0.1)); ctx.lineWidth = Lq.w * 0.55 * s;
        ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(hd[0] - 60 * s, hd[1] - 300 * s, hd[0], hd[1]); ctx.stroke();
        ctx.strokeStyle = rgb(Lq.hi, 0.7); ctx.lineWidth = Lq.w * 0.15 * s; ctx.stroke();
        ctx.fillStyle = rgb(Lq.col, Lq.a); ell(ctx, hd[0], hd[1], Lq.w * 0.9 * s, Lq.w * 0.8 * s); ctx.fill();
        ctx.restore();
      }
    }
  }
  // glossy coat after tossing
  if (toss > 0.2) {
    const gk = smooth(0.2, 1, toss);
    ctx.globalCompositeOperation = 'screen';
    FX.glazeSparkle(ctx, t, x, y, R * 0.7, gk * 0.8, { n: 7, seed: seed + 2, size: s });
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  // inner rim shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 10 * s; ell(ctx, x + 3 * s, y + 5 * s, R * 0.97, R * 0.97); ctx.stroke();
  ctx.restore();
  return { center: [x, y], r: R, land };
}

// ================================================================================================= BÌ
function biSprite(Rp, thq, seed) {
  const Rq = Math.max(30, Math.round(Rp / 10) * 10), W = Rq * 2.5, Hh = Rq * 2.1;
  return cached(`bi|${Rq}|${thq}|${seed}`, W, Hh, (x) => {
    const r = rng(500 + seed), cx = W / 2, cy = Hh * 0.56, f = Rq / 100;
    const S = [];
    for (let i = 0; i < Math.round(330 * Math.min(1.6, f + 0.2)); i++) {
      const rr = Math.pow(r(), 0.7), a = r() * TAU, px = cx + Math.cos(a) * rr * Rq * 1.05, py = cy + Math.sin(a) * rr * Rq * 0.62, hgt = (1 - rr * rr) * Rq * 0.45;
      S.push({ px, py: py - hgt, y: py, a: r() * PI, l: (30 + r() * 50) * f, b: (r() - 0.5) * 40 * f, c: r(), lw: (2 + r() * 1.4) * Math.max(0.6, f) });
    }
    S.sort((a, b) => a.y - b.y);
    x.lineCap = 'round';
    for (const q of S) {
      const dx = Math.cos(q.a) * q.l / 2, dy = Math.sin(q.a) * q.l / 2 * 0.6, nx = -Math.sin(q.a) * q.b, ny = Math.cos(q.a) * q.b * 0.6;
      const path = (ox, oy) => { x.beginPath(); x.moveTo(q.px - dx + ox, q.py - dy + oy); x.quadraticCurveTo(q.px + nx + ox, q.py + ny + oy, q.px + dx + ox, q.py + dy + oy); };
      const base = mixA([242, 228, 198], [222, 196, 152], q.c * 0.6 + thq * 0.35);
      path(0.8 * f, 1.4 * f); x.strokeStyle = rgb(mul(base, 0.55), 0.55); x.lineWidth = q.lw * 1.2; x.stroke();
      path(0, 0); x.strokeStyle = rgb(base); x.lineWidth = q.lw; x.stroke();
      x.strokeStyle = 'rgba(255,255,248,0.55)'; x.lineWidth = q.lw * 0.3; path(-0.3 * f, -0.5 * f); x.stroke();
    }
    // thính (toasted rice powder)
    if (thq > 0) {
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = `rgba(200,140,64,${0.22 * thq})`; x.fillRect(0, 0, W, Hh);
      for (let i = 0; i < 900 * thq * Math.min(1.5, f); i++) { const a = r() * TAU, rr = Math.sqrt(r()) * Rq * 1.1; const px = cx + Math.cos(a) * rr, py = cy - Rq * 0.25 + Math.sin(a) * rr * 0.7; x.fillStyle = r() < 0.5 ? 'rgba(196,136,64,0.9)' : 'rgba(150,96,40,0.85)'; const z = (0.8 + r() * 1.6) * Math.max(0.7, f); x.fillRect(px, py, z, z); }
      x.globalCompositeOperation = 'source-over';
    }
  });
}
function biPile(ctx, x, y, s = 1, o = {}) {
  const R = (o.R ?? 95), sc = bk(s), thq = Math.round(clamp(o.thinh ?? 1) * 4) / 4, spr = biSprite(R * sc, thq, o.seed ?? 1), f = s / sc, sq = o.sq ?? 0.55;
  const Rq = Math.max(30, Math.round(R * sc / 10) * 10), sy = 0.6 + sq * 0.55;
  ctx.save();
  if (o.shadow !== false) shadowEll(ctx, x + 6 * s, y + 6 * s, R * s * 1.1, R * s * 0.62 * sy * 1.1, 0.3);
  ctx.translate(x, y); ctx.scale(1, sy); ctx.drawImage(spr, -spr.width / 2 * f, -spr.height * 0.56 * f, spr.width * f, spr.height * f);
  ctx.restore();
  return { center: [x, y], top: [x, y - Rq / sc * s * 0.45 * sy] };
}
function biTray(ctx, t, o = {}) {
  const x = o.x ?? 540, y = o.y ?? 1100, s = o.s ?? 1, toss = clamp(o.toss || 0), sq = o.sq ?? 0.55, thinh = clamp(o.thinh ?? 1);
  const R = 330 * s, hop = toss > 0 && toss < 0.6 ? Math.sin(toss / 0.6 * PI) : 0;
  ctx.save();
  shadowEll(ctx, x + 10 * s, y + 30 * s, R * 1.15, R * sq * 1.2, 0.45);
  // enamel tray (white, red-brown rim)
  ctx.fillStyle = '#7a2a1e'; ell(ctx, x, y + 14 * s, R * 1.04, R * sq * 1.04); ctx.fill();
  ctx.fillStyle = '#f4f0e8'; ell(ctx, x, y, R * 1.02, R * sq * 1.02); ctx.fill();
  ctx.strokeStyle = '#8a3020'; ctx.lineWidth = 9 * s; ell(ctx, x, y, R * 1.02, R * sq * 1.02); ctx.stroke();
  ctx.fillStyle = rgr(ctx, x, y + R * sq * 0.3, R * 0.1, x, y, R, [[0, '#ffffff'], [1, '#d8d2c8']]); ell(ctx, x, y + 4 * s, R * 0.92, R * sq * 0.9); ctx.fill();
  const pile = biPile(ctx, x, y - hop * 120 * s, s * 2.6, { thinh, sq, shadow: false, seed: 3 });
  ctx.restore();
  // airborne strands
  if (hop > 0.02) {
    const r = rng(611); ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      const a = r() * TAU, d = r() * 240 * s, up = (120 + r() * 260) * s * hop, px = x + Math.cos(a) * d * (0.6 + hop * 0.6), py = y - 40 * s + Math.sin(a) * d * sq - up, ang = r() * PI + t * (r() - 0.5) * 6, l = (26 + r() * 30) * s;
      const base = mixA([242, 228, 198], [214, 170, 110], thinh * 0.5);
      ctx.strokeStyle = rgb(base); ctx.lineWidth = 4.5 * s;
      ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * l, py - Math.sin(ang) * l); ctx.quadraticCurveTo(px + 8 * s, py - 10 * s, px + Math.cos(ang) * l, py + Math.sin(ang) * l); ctx.stroke();
    }
    ctx.restore();
  }
  if (toss > 0.15) FX.powderPuff(ctx, t, x, y - 160 * s - hop * 60 * s, clamp((toss - 0.15) / 0.85), { s: s * 1.4, seed: 4 });
  return { center: [x, y], top: pile.top };
}

// ================================================================================================= CHẢ TRỨNG
function chaTex(kind, sc) { // 'top' (glossy yolk layer) | 'side' (cross-section: thin yolk band over porous meat body)
  const N = Math.round(200 * sc);
  return cached(`cha2|${kind}|${sc}`, N, kind === 'side' ? N * 0.5 : N, (x) => {
    const r = rng(kind === 'top' ? 61 : 62), H2 = kind === 'side' ? N * 0.5 : N;
    if (kind === 'top') {
      // steamed yolk glaze: deep orange-gold, mottled, tiny steam pits, wrinkly sheen
      x.fillStyle = lgr(x, 0, 0, N, N, [[0, '#ffc93a'], [0.45, '#f5a91c'], [1, '#de8a0c']]); x.fillRect(0, 0, N, N);
      for (let i = 0; i < 26; i++) { const px = r() * N, py = r() * N, rr = (10 + r() * 26) * sc; x.fillStyle = r() < 0.55 ? 'rgba(196,96,4,0.13)' : 'rgba(255,226,120,0.18)'; ell(x, px, py, rr, rr * (0.5 + r() * 0.5), r() * PI); x.fill(); }
      for (let i = 0; i < 10; i++) { const px = r() * N, py = r() * N, rr = (5 + r() * 9) * sc; x.fillStyle = 'rgba(150,64,0,0.28)'; ell(x, px, py, rr, rr * 0.7, r() * PI); x.fill(); }
      for (let i = 0; i < 140; i++) { const px = r() * N, py = r() * N, rr = (0.6 + r() * 1.6) * sc; x.fillStyle = 'rgba(140,60,0,0.5)'; ell(x, px, py, rr, rr * 0.8); x.fill(); x.fillStyle = 'rgba(255,240,180,0.6)'; ell(x, px - rr * 0.5, py - rr * 0.5, rr * 0.45, rr * 0.4); x.fill(); }
      x.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const px = r() * N, py = r() * N, l = (14 + r() * 30) * sc; x.strokeStyle = `rgba(255,248,210,${0.25 + r() * 0.3})`; x.lineWidth = (1 + r() * 1.6) * sc; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l * 0.5, py - 6 * sc, px + l, py + (r() - 0.5) * 8 * sc); x.stroke(); }
      x.fillStyle = 'rgba(255,255,235,0.3)'; ell(x, N * 0.34, N * 0.28, N * 0.26, N * 0.1, -0.5); x.fill();
      x.fillStyle = 'rgba(255,255,245,0.55)'; ell(x, N * 0.3, N * 0.25, N * 0.1, N * 0.03, -0.5); x.fill();
    } else {
      // thin wavy yolk band (~16%) over a thick pale-brown porous meat body
      const yb = H2 * 0.16, wav = (u) => yb + Math.sin(u / N * 9.4 + 0.7) * 1.4 * sc + Math.sin(u / N * 23) * 0.9 * sc;
      x.fillStyle = lgr(x, 0, H2 * 0.1, 0, H2, [[0, '#dcb48a'], [0.4, '#cfa47a'], [1, '#b8885c']]); x.fillRect(0, 0, N, H2);
      x.fillStyle = lgr(x, 0, 0, 0, yb + 2 * sc, [[0, '#ff9e1a'], [0.35, '#ffc23a'], [1, '#f4b02a']]);
      x.beginPath(); x.moveTo(0, 0); x.lineTo(N, 0); for (let u = N; u >= 0; u -= 4 * sc) x.lineTo(u, wav(u)); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(232,150,40,0.55)'; x.lineWidth = 2.2 * sc; x.beginPath(); for (let u = 0; u <= N; u += 4 * sc) u ? x.lineTo(u, wav(u) + 1 * sc) : x.moveTo(u, wav(u) + 1 * sc); x.stroke();
      x.fillStyle = 'rgba(255,240,190,0.55)'; x.fillRect(0, 0, N, 1.6 * sc);
      // mottling in the meat
      for (let i = 0; i < 40; i++) { const px = r() * N, py = yb + 3 * sc + r() * (H2 - yb - 3 * sc), rr = (4 + r() * 9) * sc; x.fillStyle = r() < 0.5 ? 'rgba(170,120,80,0.22)' : 'rgba(246,222,190,0.3)'; ell(x, px, py, rr, rr * 0.6, r() * PI); x.fill(); }
      // pores: dark pit + light lower rim
      for (let i = 0; i < 150; i++) { const px = r() * N, py = yb + 4 * sc + r() * (H2 - yb - 6 * sc), rr = (0.7 + r() * r() * 3.2) * sc, ry2 = rr * (0.5 + r() * 0.4);
        x.fillStyle = 'rgba(255,238,212,0.55)'; ell(x, px + 0.4 * sc, py + 0.7 * sc, rr * 1.05, ry2 * 1.05); x.fill();
        x.fillStyle = r() < 0.7 ? 'rgba(112,72,40,0.75)' : 'rgba(84,52,28,0.85)'; ell(x, px, py, rr, ry2); x.fill(); }
      // translucent glass-noodle bits
      x.lineCap = 'round';
      for (let i = 0; i < 14; i++) { const px = r() * N, py = yb + 7 * sc + r() * (H2 - yb - 12 * sc), l = (8 + r() * 12) * sc, bb = (r() - 0.5) * 8 * sc;
        x.strokeStyle = 'rgba(150,110,70,0.35)'; x.lineWidth = 2.4 * sc; x.beginPath(); x.moveTo(px, py + 0.8 * sc); x.quadraticCurveTo(px + l / 2, py + bb + 0.8 * sc, px + l, py + 0.8 * sc); x.stroke();
        x.strokeStyle = 'rgba(250,240,222,0.8)'; x.lineWidth = 1.5 * sc; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py + bb, px + l, py); x.stroke(); }
      // wood-ear mushroom specks (black, irregular)
      for (let i = 0; i < 18; i++) { const px = r() * N, py = yb + 6 * sc + r() * (H2 - yb - 10 * sc), a = (1.6 + r() * 3.2) * sc, b = (0.8 + r() * 1.4) * sc, rot = r() * PI;
        x.fillStyle = '#20140c'; x.beginPath(); x.ellipse(px, py, a, b, rot, 0, TAU); x.fill(); x.beginPath(); x.ellipse(px + a * 0.6 * Math.cos(rot + 1), py + a * 0.6 * Math.sin(rot + 1), a * 0.6, b * 0.8, rot + 0.8, 0, TAU); x.fill();
        x.fillStyle = 'rgba(160,140,120,0.5)'; ell(x, px - a * 0.3, py - b * 0.4, a * 0.35, b * 0.25, rot); x.fill(); }
      // moist bottom edge
      x.fillStyle = lgr(x, 0, H2 * 0.85, 0, H2, [[0, 'rgba(120,80,40,0)'], [1, 'rgba(120,80,40,0.35)']]); x.fillRect(0, H2 * 0.85, N, H2 * 0.15);
    }
  });
}
function texQuad(ctx, img, p0, p1, p3) { // map img (0,0)->p0, (w,0)->p1, (0,h)->p3
  ctx.save(); ctx.transform((p1[0] - p0[0]) / img.width, (p1[1] - p0[1]) / img.width, (p3[0] - p0[0]) / img.height, (p3[1] - p0[1]) / img.height, p0[0], p0[1]);
  ctx.drawImage(img, 0, 0); ctx.restore();
}
function chaBlock(ctx, x, y, side, depth, sq, rot, sc) {
  const ca = Math.sqrt(Math.max(0, 1 - sq * sq)), dz = depth * Math.max(0.15, ca), h = side / 2;
  const C = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([u, v]) => { const X = u * Math.cos(rot) - v * Math.sin(rot), Y = u * Math.sin(rot) + v * Math.cos(rot); return [x + X, y + Y * sq]; });
  const D = C.map(p => [p[0], p[1] + dz]);
  const sideT = chaTex('side', sc), topT = chaTex('top', sc);
  for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4]; const ny = (b[0] - a[0]); if (ny > 0.5 || (ny > -0.5 && b[1] + a[1] > 2 * y)) { /* front-facing if edge runs left→right (bottom side) */ } }
  // visible faces: edges whose outward normal points toward the viewer (screen +y)
  const faces = [];
  for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4]; const nx = b[1] - a[1], ny = -(b[0] - a[0]); if (ny > 0.01) faces.push([b, a, i]); /* outward normal faces the viewer */ }
  for (const [a, b, i] of faces) {
    texQuad(ctx, sideT, a, b, [a[0], a[1] + dz]);
    ctx.fillStyle = `rgba(80,40,10,${(i % 2) * 0.12})`; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0], b[1] + dz); ctx.lineTo(a[0], a[1] + dz); ctx.closePath(); ctx.fill();
  }
  ctx.save(); ctx.beginPath(); C.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.clip();
  texQuad(ctx, topT, C[0], C[1], C[3]); ctx.fillStyle = 'rgba(255,250,220,0.18)'; ctx.fill(); ctx.restore();
  ctx.strokeStyle = 'rgba(255,214,120,0.75)'; ctx.lineWidth = 1.5; ctx.beginPath(); C.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.stroke();
  return { C, D, dz };
}
function chaTrung(ctx, x, y, s = 1, o = {}) {
  const mode = o.mode || 'tray', sq = o.sq ?? 0.55, t = o.t ?? 0, sc = bk(s);
  if (mode === 'slice') {
    const side = (o.size ?? 150) * s;
    ctx.save(); shadowEll(ctx, x + 8 * s, y + side * 0.35 * sq + 18 * s, side * 0.8, side * 0.55 * sq + 10 * s, 0.35);
    const B = chaBlock(ctx, x, y, side, side * (o.depth ?? 0.55), sq, o.rot || 0, sc);
    ctx.restore();
    return { center: [x, y + B.dz * 0.5], top: [x, y] };
  }
  // tray
  const lid = clamp(o.lid ?? 0), cut = clamp(o.cut || 0), rx = 270 * s, ry = rx * sq;
  ctx.save();
  shadowEll(ctx, x + 10 * s, y + 40 * s, rx * 1.15, ry * 1.2, 0.5);
  // pan wall
  ctx.fillStyle = lgr(ctx, x - rx, 0, x + rx, 0, [[0, '#6a7178'], [0.3, '#e8ecef'], [0.5, '#b8bec4'], [1, '#5e656c']]);
  ctx.beginPath(); ctx.ellipse(x, y + 46 * s, rx * 0.98, ry * 0.98, 0, 0, PI); ctx.lineTo(x - rx, y); ctx.ellipse(x, y, rx, ry, 0, PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8a9198'; ell(ctx, x, y, rx, ry); ctx.fill();
  // loaf surface (yolk layer)
  const topT = chaTex('top', sc);
  ctx.save(); ell(ctx, x, y + 6 * s, rx * 0.95, ry * 0.93); ctx.clip();
  ctx.save(); ctx.translate(x, y + 6 * s); ctx.scale(1, sq); ctx.drawImage(topT, -rx, -rx, rx * 2, rx * 2); ctx.restore();
  ctx.fillStyle = rgr(ctx, x - rx * 0.3, y - ry * 0.4, 10, x, y, rx, [[0, 'rgba(255,255,220,0.35)'], [0.6, 'rgba(255,240,180,0)'], [1, 'rgba(150,90,10,0.35)']]); ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
  // cut square
  const side = 150 * s, h = side / 2, cxs = x + 40 * s, cys = y + 10 * s;
  const C = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([u, v]) => [cxs + u, cys + v * sq]);
  const lift = o.lift !== undefined ? clamp(o.lift) : smooth(0.85, 1, cut), liftH = (o.liftH ?? 90) * s;
  if (cut > 0) {
    ctx.strokeStyle = 'rgba(110,60,10,0.85)'; ctx.lineWidth = 3.5 * s; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const f = clamp((cut * 0.85 / 0.85 - i * 0.2) / 0.2); if (f <= 0) continue; const a = C[i], b = C[(i + 1) % 4]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], b[0], f), lerp(a[1], b[1], f)); ctx.stroke(); }
    if (lift > 0) { ctx.save(); ctx.fillStyle = '#6a4626'; ctx.beginPath(); C.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.clip(); texQuad(ctx, chaTex('side', sc), C[0], C[1], [C[0][0], C[0][1] + 70 * s * Math.sqrt(Math.max(0, 1 - sq * sq))]); ctx.fillStyle = 'rgba(60,30,10,0.25)'; ctx.fillRect(C[0][0], C[0][1], side, side); ctx.restore(); }
  }
  ctx.restore();
  ctx.strokeStyle = lgr(ctx, x - rx, 0, x + rx, 0, [[0, '#9aa1a8'], [0.35, '#ffffff'], [1, '#b0b6bc']]); ctx.lineWidth = 7 * s; ell(ctx, x, y, rx, ry); ctx.stroke();
  let sliceP = [cxs, cys], kn = [cxs, cys];
  if (lift > 0) { const B = chaBlock(ctx, cxs, cys - lift * liftH, side, 60 * s, sq, 0, sc); sliceP = [cxs, cys - lift * liftH]; }
  // knife
  if (o.knife !== false && cut > 0 && cut < 0.9) {
    const seg = Math.min(3, Math.floor(cut / 0.2)), f = clamp((cut - seg * 0.2) / 0.2), a = C[seg], b = C[(seg + 1) % 4];
    kn = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
    knife(ctx, kn[0], kn[1] + 4 * s, s * 0.9, { rot: -1.15 + Math.sin(t * 14) * 0.03 });
  }
  // steam + lid
  if ((o.steam ?? 1) > 0) FX.steam(ctx, t, { x, y, w: rx * 1.2, h: 460 * s, n: 5 + Math.round(lid * 7), k: (o.steam ?? 1) * (0.3 + lid * 0.9), s: s * (1 + lid * 0.4), seed: 23 });
  if (lid < 1) {
    const ly = y - ease.out(lid) * 320 * s, lx = x + lid * 260 * s, a = 1 - smooth(0.7, 1, lid);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(lx, ly); ctx.rotate(lid * 0.5);
    ctx.fillStyle = lgr(ctx, -rx, 0, rx, 0, [[0, '#6d747b'], [0.3, '#f0f3f5'], [0.45, '#ffffff'], [0.6, '#c2c8ce'], [1, '#62696f']]);
    ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.04, ry * 1.04, 0, 0, PI); ctx.ellipse(0, -ry * 0.2, rx, ry * 1.2 + 60 * s, 0, PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,64,70,0.6)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.04, ry * 1.04, 0, 0, PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(ctx, -rx * 0.35, -ry * 0.9, rx * 0.22, ry * 0.2, -0.3); ctx.fill();
    ctx.fillStyle = '#2a2a2e'; ell(ctx, 0, -ry * 1.4 - 64 * s, 30 * s, 16 * s); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  return { center: [x, y], slice: sliceP, knife: kn };
}

// ================================================================================================= MỠ HÀNH
function scallionSprite(Rp, bright) {
  const Rq = Math.max(30, Math.round(Rp / 10) * 10);
  return cached(`mh|${Rq}|${bright}`, Rq * 2.2, Rq * 2.2, (x) => {
    const r = rng(71), cx = Rq * 1.1, cy = Rq * 1.1, f = Rq / 100;
    const dark = bright ? [30, 150, 40] : [88, 130, 60], mid = bright ? [70, 205, 70] : [130, 170, 96], pale = bright ? [190, 240, 150] : [200, 214, 170];
    const n = Math.round(260 * Math.min(2, f));
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * Rq, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d, rr = (6 + r() * 4) * Math.max(0.6, f), sq2 = 0.45 + r() * 0.55, rot = r() * PI;
      const white = r() < 0.18;
      x.save(); x.translate(px, py); x.rotate(rot);
      x.strokeStyle = rgb(mul(white ? pale : dark, 0.6), 0.6); x.lineWidth = rr * 0.55; ell(x, 1, 1.5, rr, rr * sq2); x.stroke();
      x.strokeStyle = rgb(white ? pale : (r() < 0.5 ? dark : mid)); x.lineWidth = rr * 0.42; ell(x, 0, 0, rr, rr * sq2); x.stroke();
      x.fillStyle = rgb(white ? [240, 250, 220] : pale, 0.5); ell(x, 0, 0, rr * 0.6, rr * sq2 * 0.6); x.fill();
      if (bright) { x.strokeStyle = 'rgba(255,255,230,0.75)'; x.lineWidth = rr * 0.12; x.beginPath(); x.ellipse(0, 0, rr * 0.95, rr * sq2 * 0.95, 0, PI * 1.1, PI * 1.6); x.stroke(); }
      x.restore();
    }
  });
}
function moHanh(ctx, x, y, s = 1, o = {}) {
  const pour = clamp(o.pour || 0), t = o.t ?? 0, sq = o.sq ?? 0.55, R = 150 * s, sc = bk(s);
  const br = smooth(0.12, 0.75, pour);
  ctx.save();
  if (o.bowl !== false) {
    shadowEll(ctx, x + 8 * s, y + 70 * s, R * 1.2, R * sq * 1.1, 0.45);
    ctx.fillStyle = lgr(ctx, x - R, 0, x + R, 0, [[0, '#b8bcc4'], [0.3, '#ffffff'], [0.7, '#e6e8ec'], [1, '#a0a4ac']]);
    ctx.beginPath(); ctx.moveTo(x - R, y); ctx.bezierCurveTo(x - R, y + R * 0.75, x - R * 0.45, y + R * 0.9, x, y + R * 0.9); ctx.bezierCurveTo(x + R * 0.45, y + R * 0.9, x + R, y + R * 0.75, x + R, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2c5aa8'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.ellipse(x, y + R * 0.18, R * 0.985, R * sq * 0.9, 0, 0.15, PI - 0.15); ctx.stroke();
    ctx.fillStyle = '#d8dade'; ell(ctx, x, y, R, R * sq); ctx.fill();
  }
  ctx.save(); ell(ctx, x, y + 3 * s, R * 0.93, R * sq * 0.9); ctx.clip();
  ctx.fillStyle = br > 0.5 ? '#2c7a28' : '#58783c'; ell(ctx, x, y + 3 * s, R, R * sq); ctx.fill();
  const dull = scallionSprite(R * 1.05 * sc / s * s, 0), bri = scallionSprite(R * 1.05 * sc / s * s, 1);
  ctx.save(); ctx.translate(x, y + 4 * s); ctx.scale(1, sq);
  const fw = dull.width * (s / sc) * (R / (150 * s)) * (150 / (Math.max(30, Math.round(R * 1.05 * sc / s * s / 10) * 10) / 1.05)) * (1 / 1);
  const dw = R * 2.2 * 1.05;
  if (br < 1) ctx.drawImage(dull, -dw / 2, -dw / 2, dw, dw);
  if (br > 0) { ctx.globalAlpha = br; ctx.drawImage(bri, -dw / 2, -dw / 2, dw, dw); ctx.globalAlpha = 1; }
  ctx.restore();
  // oil gloss
  if (pour > 0.05) {
    ctx.fillStyle = rgr(ctx, x - R * 0.3, y - R * sq * 0.3, 5, x, y, R, [[0, `rgba(255,240,150,${0.35 * br})`], [0.5, `rgba(255,220,100,${0.12 * br})`], [1, 'rgba(255,220,100,0)']]); ctx.fillRect(x - R, y - R, R * 2, R * 2);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 5 * s; ell(ctx, x, y, R, R * sq); ctx.stroke();
  // hot-oil stream
  const oil = [x + 30 * s, y - 520 * s];
  const sk = pour > 0.04 && pour < 0.72 ? 1 : 0;
  if (sk) {
    const hd = [x + 10 * s, y], wv = Math.sin(t * 20) * 3 * s;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,190,60,0.55)'; ctx.lineWidth = 16 * s; ctx.beginPath(); ctx.moveTo(oil[0], oil[1]); ctx.quadraticCurveTo(hd[0] + 20 * s + wv, (oil[1] + hd[1]) / 2, hd[0], hd[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,160,0.85)'; ctx.lineWidth = 6 * s; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,240,0.9)'; ctx.lineWidth = 2 * s; ctx.stroke();
    ctx.restore();
    U.glowR(ctx, hd[0], hd[1], 120 * s, 'rgba(255,200,90,0.6)', 0.8);
  }
  const sz = pour > 0.04 ? Math.max(0, 1 - smooth(0.6, 1, pour)) * 1.2 : 0;
  if (sz > 0) FX.sizzle(ctx, t, x, y, sz, { r: R * 0.9, ryr: sq, n: 50, spat: 22, s, seed: 33, col: '255,240,170' });
  if (pour > 0.05) FX.steam(ctx, t, { x, y, w: R * 1.3, h: 420 * s, n: 8, k: smooth(0.05, 0.3, pour) * (1 - smooth(0.85, 1, pour) * 0.5), s, seed: 31 });
  ctx.restore();
  return { surface: [x, y], r: R, oil };
}

// ================================================================================================= FRIED EGG
function eggRad(a, seed) { const p = seed * 1.7; return 1 + 0.11 * Math.sin(3 * a + p) + 0.07 * Math.sin(5 * a + p * 2.3) + 0.04 * Math.sin(9 * a + p * 0.7); }
function eggPath(ctx, x, y, R, seed, sq = 1, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) { const a = i / 64 * TAU, rr = R * eggRad(a, seed), px = Math.cos(a + rot) * rr, py = Math.sin(a + rot) * rr * sq; i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py); }
  ctx.closePath();
}
function eggSprite(Rp, lace, seed) {
  const Rq = Math.max(30, Math.round(Rp / 8) * 8), N = Rq * 2.6;
  return cached(`egg|${Rq}|${lace}|${seed}`, N, N, (x) => {
    const r = rng(seed * 3 + 1), c = N / 2;
    if (lace) {
      eggPath(x, c, c, Rq * 1.02, seed);
      x.fillStyle = rgr(x, c, c, Rq * 0.6, c, c, Rq * 1.2, [[0, '#f0c070'], [0.75, '#c87830'], [1, '#7a3a10']]); x.fill();
      // lace holes and crispy dots
      for (let i = 0; i < 260; i++) {
        const a = r() * TAU, d = Rq * eggRad(a, seed) * (0.8 + r() * 0.24), px = c + Math.cos(a) * d, py = c + Math.sin(a) * d, rr = (1.5 + r() * 4.5) * Rq / 120;
        if (r() < 0.45) { x.globalCompositeOperation = 'destination-out'; x.fillStyle = 'rgba(0,0,0,0.85)'; ell(x, px, py, rr, rr * 0.8, r() * PI); x.fill(); x.globalCompositeOperation = 'source-over'; }
        else { x.fillStyle = r() < 0.5 ? 'rgba(110,50,14,0.8)' : 'rgba(230,160,80,0.8)'; ell(x, px, py, rr, rr * 0.7, r() * PI); x.fill(); }
      }
    }
    // white body
    eggPath(x, c, c, Rq * (lace ? 0.86 : 1), seed);
    x.fillStyle = rgr(x, c - Rq * 0.1, c - Rq * 0.1, Rq * 0.1, c, c, Rq * 1.05, lace ? [[0, '#ffffff'], [0.7, '#fbf8f0'], [0.92, '#f0e2c4'], [1, '#e2b878']] : [[0, '#ffffff'], [0.8, '#f8f6f0'], [1, 'rgba(240,238,230,0.7)']]);
    x.fill();
    // bubbles / blisters
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, d = Rq * (0.35 + r() * 0.5), px = c + Math.cos(a) * d, py = c + Math.sin(a) * d, rr = (3 + r() * 8) * Rq / 120;
      x.fillStyle = 'rgba(200,190,170,0.35)'; ell(x, px + rr * 0.3, py + rr * 0.4, rr, rr * 0.8); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.95)'; ell(x, px, py, rr, rr * 0.8); x.fill();
      x.fillStyle = 'rgba(255,255,255,1)'; ell(x, px - rr * 0.35, py - rr * 0.35, rr * 0.3, rr * 0.25); x.fill();
    }
    if (lace) { x.strokeStyle = 'rgba(200,140,60,0.35)'; x.lineWidth = 5 * Rq / 120; eggPath(x, c, c, Rq * 0.83, seed); x.stroke(); }
  });
}
function yolk(ctx, x, y, R, sq, wob) {
  const sx = 1 + wob, sy = 1 - wob * 0.8;
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy * (0.55 + 0.45 * sq));
  ctx.fillStyle = 'rgba(255,255,240,0.55)'; ell(ctx, 0, 2, R * 1.22, R * 1.18); ctx.fill();
  ctx.fillStyle = rgr(ctx, -R * 0.3, -R * 0.35, R * 0.1, 0, 0, R, [[0, '#ffd860'], [0.55, '#ffb320'], [1, '#e88200']]); ell(ctx, 0, 0, R, R); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(ctx, -R * 0.35, -R * 0.4, R * 0.3, R * 0.18, -0.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, R * 0.35, R * 0.35, R * 0.12, R * 0.06, -0.5); ctx.fill();
  ctx.restore();
}
function eggPan(ctx, x, y, s, sq) {
  const R = 175 * s;
  // handle
  ctx.save(); ctx.translate(x + R * 0.9, y + R * sq * 0.5); ctx.rotate(0.35);
  ctx.fillStyle = lgr(ctx, 0, -14 * s, 0, 14 * s, [[0, '#3a3a40'], [0.4, '#1a1a1e'], [1, '#0a0a0c']]); ctx.beginPath(); ctx.roundRect(0, -14 * s, 260 * s, 28 * s, 12 * s); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(10 * s, -10 * s, 230 * s, 4 * s); ctx.restore();
  ctx.fillStyle = '#0c0c10'; ell(ctx, x, y + 26 * s, R * 1.02, R * sq * 1.02); ctx.fill();
  ctx.fillStyle = lgr(ctx, 0, y - R * sq, 0, y + R * sq, [[0, '#4a4c54'], [0.5, '#1c1c22'], [1, '#2a2a30']]); ell(ctx, x, y, R, R * sq); ctx.fill();
  ctx.fillStyle = rgr(ctx, x - R * 0.2, y - R * sq * 0.2, 4, x, y + 10 * s, R * 0.9, [[0, '#26262c'], [1, '#121216']]); ell(ctx, x, y + 10 * s, R * 0.86, R * sq * 0.84); ctx.fill();
  ctx.strokeStyle = 'rgba(160,170,190,0.35)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.ellipse(x, y, R * 0.99, R * sq * 0.99, 0, PI * 1.05, PI * 1.6); ctx.stroke();
  // oil sheen
  ctx.fillStyle = 'rgba(255,200,120,0.08)'; ell(ctx, x - R * 0.2, y + 4 * s, R * 0.7, R * sq * 0.6); ctx.fill();
  return { x, y, rx: R, ry: R * sq };
}
function friedEgg(ctx, x, y, s = 1, o = {}) {
  const t = o.t ?? 0, sq = o.sq ?? 0.72, seed = o.seed ?? 2, rot = o.rot || 0, sc = bk(s), Re = 112 * s;
  ctx.save();
  let pan = null;
  if (o.pan !== false) pan = eggPan(ctx, x, y, s, sq);
  else if (o.shadow !== false) shadowEll(ctx, x + 5 * s, y + 8 * s, Re * 1.1, Re * sq * 1.1, 0.3);
  const yx = x - 14 * s, yy = y - 10 * s * sq, yR = 38 * s, shellP = [x + 30 * s, y - 300 * s];
  const drawWhite = (scale, opa, lace) => {
    const sp = eggSprite(Re * sc / s * (1 / 1), 0, seed), lp = eggSprite(Re * sc / s, 1, seed), RqS = Math.max(30, Math.round(Re * sc / s / 8) * 8);
    const D = sp.width * (Re / (RqS)) * scale;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, sq); ctx.rotate(rot);
    if (opa < 1) { ctx.fillStyle = 'rgba(245,245,236,0.28)'; eggPath(ctx, 0, 0, Re * scale, seed); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2 * s; ctx.stroke(); }
    if (opa > 0) { ctx.globalAlpha = opa * (1 - lace); ctx.drawImage(sp, -D / 2, -D / 2, D, D); }
    if (lace > 0) { ctx.globalAlpha = opa * lace; ctx.drawImage(lp, -D / 2, -D / 2, D, D); }
    ctx.restore();
  };
  const ck = o.cracking;
  if (ck === undefined || ck >= 1) {
    drawWhite(1, 1, clamp(o.crisp ?? 1));
    yolk(ctx, yx, yy, yR, sq, 0.025 * Math.sin(t * 9) + 0.015 * Math.sin(t * 23));
    if (o.pan !== false && o.sizzle !== false) FX.sizzle(ctx, t, x, y, 0.35, { r: Re * 1.05, ryr: sq, n: 22, spat: 4, s, seed: 8 });
  } else {
    const k = clamp(ck);
    // shell
    const shell = (half, k2) => {
      const sp2 = k2 > 0 ? ease.out(k2) : 0, sx2 = shellP[0] + half * sp2 * 120 * s, sy2 = shellP[1] - sp2 * 60 * s + (k2 > 0.4 ? (k2 - 0.4) * 300 * s : 0), rr2 = half * sp2 * 0.9;
      ctx.save(); ctx.translate(sx2, sy2); ctx.rotate(rr2 + (k < 0.25 ? Math.sin(k * 80) * 0.04 * (k > 0.1 ? 1 : 0) : 0)); ctx.globalAlpha *= 1 - smooth(0.6, 0.9, k2);
      ctx.beginPath();
      if (half) { ctx.rect(half < 0 ? -80 * s : 0, -90 * s, 80 * s, 180 * s); ctx.clip(); ctx.beginPath(); }
      ctx.ellipse(0, 0, 50 * s, 64 * s, 0, 0, TAU);
      ctx.fillStyle = rgr(ctx, -16 * s, -22 * s, 4 * s, 0, 0, 66 * s, [[0, '#fff3e0'], [0.6, '#efd6b0'], [1, '#c8a070']]); ctx.fill();
      if (half && k2 > 0.05) { ctx.fillStyle = '#fbf6ee'; ctx.beginPath(); ctx.ellipse(0, 0, 8 * s, 58 * s, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    };
    if (k < 0.25) {
      shell(0, 0);
      const cr = clamp((k - 0.08) / 0.12);
      if (cr > 0) { ctx.save(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 2.5 * s; ctx.lineJoin = 'miter'; ctx.beginPath(); const pts = [[0, -60], [6, -38], [-5, -18], [7, 2], [-6, 22], [5, 42], [0, 62]]; const m = Math.max(2, Math.round(cr * pts.length)); for (let i = 0; i < m; i++) { const p = pts[i]; i ? ctx.lineTo(shellP[0] + p[0] * s, shellP[1] + p[1] * s) : ctx.moveTo(shellP[0] + p[0] * s, shellP[1] + p[1] * s); } ctx.stroke(); ctx.restore(); }
    } else {
      const k2 = clamp((k - 0.25) / 0.35);
      if (k < 0.4) { // falling contents
        const f = (k - 0.25) / 0.15, fy = lerp(shellP[1], y, f * f), fx = lerp(shellP[0], x, f);
        ctx.save(); ctx.fillStyle = 'rgba(245,245,232,0.5)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2 * s;
        // gooey teardrop: round bulb below, thin tail stretching back up toward the shell
        const br = 38 * s * (1 - f * 0.15), by = fy + 14 * s, tl = (60 + 90 * f) * s;
        ctx.beginPath(); ctx.moveTo(fx + 2 * s, by - br - tl);
        ctx.bezierCurveTo(fx + 8 * s, by - br - tl * 0.4, fx + br, by - br * 0.9, fx + br, by);
        ctx.arc(fx, by, br, 0, PI, false);
        ctx.bezierCurveTo(fx - br, by - br * 0.9, fx - 6 * s, by - br - tl * 0.4, fx + 2 * s, by - br - tl);
        ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.6 * s; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, fx - br * 0.45, by - br * 0.2, br * 0.12, br * 0.3, 0.3); ctx.fill(); ctx.restore();
        yolk(ctx, fx - 4 * s, fy + 10 * s, yR * 0.9, 1, 0);
      } else {
        const tc = (k - 0.4) / 0.6, rs = 0.35 + 0.65 * ease.out(clamp(tc / 0.5)), opa = smooth(0.08, 0.6, tc), lace = smooth(0.6, 1, tc);
        drawWhite(rs, opa, lace);
        const wob = 0.14 * Math.exp(-tc * 6) * Math.sin(tc * 45) + 0.02 * Math.sin(t * 9);
        yolk(ctx, lerp(x, yx, clamp(tc * 2)), lerp(y, yy, clamp(tc * 2)), yR, sq, wob);
        if (o.pan !== false) FX.sizzle(ctx, t, x, y, 0.4 + 0.8 * smooth(0.0, 0.3, tc), { r: Re * rs * 1.05, ryr: sq, n: 40, spat: 14, s, seed: 9 });
      }
      shell(-1, k2); shell(1, k2);
    }
  }
  ctx.restore();
  return { center: [x, y], yolk: [yx, yy], pan, shell: shellP };
}

// ================================================================================================= ĐỒ CHUA / SLICES
function stickPile(Rp, seed) {
  const Rq = Math.max(30, Math.round(Rp / 10) * 10), W = Rq * 2.6, Hh = Rq * 1.9;
  return cached(`pk|${Rq}|${seed}`, W, Hh, (x) => {
    const r = rng(seed * 9 + 2), cx = W / 2, cy = Hh * 0.62, f = Rq / 100, S = [];
    for (let i = 0; i < Math.round(170 * Math.min(1.7, f + 0.3)); i++) {
      const rr = Math.pow(r(), 0.75), a = r() * TAU, px = cx + Math.cos(a) * rr * Rq * 1.05, py = cy + Math.sin(a) * rr * Rq * 0.6 - (1 - rr * rr) * Rq * 0.4;
      S.push({ px, py, z: py + rr * 10, a: r() * PI, l: (34 + r() * 26) * f, w: (5 + r() * 2) * f, carrot: r() < 0.55, c: r() });
    }
    S.sort((a, b) => a.z - b.z);
    for (const q of S) {
      x.save(); x.translate(q.px, q.py); x.rotate(q.a); x.scale(1, 0.75);
      const base = q.carrot ? mixA([250, 140, 40], [232, 104, 18], q.c) : mixA([250, 247, 236], [232, 228, 212], q.c);
      x.fillStyle = rgb(mul(base, 0.55), 0.5); x.fillRect(-q.l / 2 + 1.5 * f, -q.w / 2 + 2 * f, q.l, q.w);
      x.fillStyle = rgb(base); x.fillRect(-q.l / 2, -q.w / 2, q.l, q.w);
      x.fillStyle = q.carrot ? 'rgba(255,200,130,0.8)' : 'rgba(255,255,255,0.9)'; x.fillRect(-q.l / 2, -q.w / 2, q.l, q.w * 0.3);
      x.fillStyle = q.carrot ? 'rgba(180,60,0,0.4)' : 'rgba(180,176,160,0.4)'; x.fillRect(q.l / 2 - 2 * f, -q.w / 2, 2 * f, q.w);
      x.restore();
    }
    // brine gloss
    x.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 20; i++) { x.fillStyle = 'rgba(255,255,255,0.4)'; ell(x, cx + (r() - 0.5) * Rq * 1.6, cy - Rq * 0.3 + (r() - 0.5) * Rq * 0.8, 3 * f, 1.5 * f); x.fill(); }
    x.globalCompositeOperation = 'source-over';
  });
}
function doChua(ctx, x, y, s = 1, o = {}) {
  const mode = o.mode || 'pile', sq = o.sq ?? 0.55, sc = bk(s);
  if (mode === 'pile') {
    const R = (o.R ?? 85), spr = stickPile(R * sc, o.seed ?? 1), f = s / sc, sy = 0.65 + sq * 0.5;
    ctx.save(); if (o.shadow !== false) shadowEll(ctx, x + 6 * s, y + 8 * s, R * s * 1.1, R * s * 0.6 * sy, 0.3);
    ctx.translate(x, y); ctx.scale(1, sy); ctx.drawImage(spr, -spr.width / 2 * f, -spr.height * 0.62 * f, spr.width * f, spr.height * f); ctx.restore();
    return { center: [x, y], top: [x, y - R * s * 0.4 * sy] };
  }
  // jar: (x,y) = mouth centre
  const lid = clamp(o.lid || 0), rx = 120 * s, ry = rx * sq * 0.6, Hj = 320 * s, t = o.t ?? 0;
  ctx.save();
  shadowEll(ctx, x + 10 * s, y + Hj + 10 * s, rx * 1.3, ry * 1.4, 0.5);
  // back glass + brine + sticks
  ctx.fillStyle = 'rgba(200,220,230,0.18)'; ctx.beginPath(); ctx.moveTo(x - rx, y + 10 * s); ctx.lineTo(x - rx, y + Hj); ctx.ellipse(x, y + Hj, rx, ry, 0, PI, 0, true); ctx.lineTo(x + rx, y + 10 * s); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(x - rx * 0.96, y + 40 * s); ctx.lineTo(x - rx * 0.96, y + Hj); ctx.ellipse(x, y + Hj, rx * 0.96, ry * 0.96, 0, PI, 0, true); ctx.lineTo(x + rx * 0.96, y + 40 * s); ctx.closePath(); ctx.clip();
  ctx.fillStyle = 'rgba(248,226,170,0.45)'; ctx.fillRect(x - rx, y + 40 * s, rx * 2, Hj + ry);
  const r = rng(91); ctx.lineCap = 'butt';
  for (let i = 0; i < 70; i++) {
    const px = x + (r() - 0.5) * rx * 1.9, py = y + 70 * s + r() * (Hj - 40 * s), a = PI / 2 + (r() - 0.5) * 0.9, l = (60 + r() * 50) * s, carrot = r() < 0.5;
    ctx.strokeStyle = carrot ? `rgb(${240 + r() * 15 | 0},${110 + r() * 40 | 0},${20 + r() * 20 | 0})` : `rgb(${236 + r() * 15 | 0},${232 + r() * 15 | 0},${214 + r() * 15 | 0})`; ctx.lineWidth = (7 + r() * 3) * s;
    ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * l / 2, py - Math.sin(a) * l / 2); ctx.lineTo(px + Math.cos(a) * l / 2, py + Math.sin(a) * l / 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(248,226,170,0.25)'; ctx.fillRect(x - rx, y + 40 * s, rx * 2, Hj + ry);
  ctx.fillStyle = 'rgba(255,250,230,0.35)'; ell(ctx, x, y + 42 * s, rx * 0.96, ry * 0.9); ctx.fill();
  ctx.restore();
  // front glass highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 8 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - rx * 0.7, y + 50 * s); ctx.lineTo(x - rx * 0.7, y + Hj - 30 * s); ctx.stroke();
  ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - rx * 0.5, y + 60 * s); ctx.lineTo(x - rx * 0.5, y + Hj * 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - rx, y + 10 * s); ctx.lineTo(x - rx, y + Hj); ctx.ellipse(x, y + Hj, rx, ry, 0, PI, 0, true); ctx.lineTo(x + rx, y + 10 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 6 * s; ell(ctx, x, y + 10 * s, rx * 0.92, ry * 0.9); ctx.stroke();
  // lid
  const lx = x + lid * 220 * s, ly = y - ease.out(lid) * 160 * s;
  ctx.save(); ctx.translate(lx, ly); ctx.rotate(lid * 0.6); ctx.globalAlpha *= 1 - smooth(0.8, 1, lid);
  ctx.fillStyle = lgr(ctx, -rx, 0, rx, 0, [[0, '#7a1a12'], [0.35, '#e0503a'], [0.5, '#ff8a6a'], [1, '#801c14']]);
  ctx.beginPath(); ctx.ellipse(0, 18 * s, rx * 0.96, ry, 0, 0, PI); ctx.lineTo(-rx * 0.96, -10 * s); ctx.ellipse(0, -10 * s, rx * 0.96, ry, 0, PI, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c83a28'; ell(ctx, 0, -10 * s, rx * 0.96, ry); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ell(ctx, -rx * 0.3, -14 * s, rx * 0.35, ry * 0.3); ctx.fill();
  ctx.restore();
  ctx.restore();
  return { center: [x, y + Hj / 2], mouth: [x, y] };
}
function sliceSprite(kind, Rp) {
  const Rq = Math.max(16, Math.round(Rp / 4) * 4), N = Rq * 2 + 8;
  return cached(`sl|${kind}|${Rq}`, N, N, (x) => {
    const c = N / 2, r = rng(kind === 'cu' ? 5 : 6);
    if (kind === 'cu') {
      x.fillStyle = '#2a5a1a'; ell(x, c, c, Rq, Rq); x.fill();
      x.fillStyle = '#5a9a3a'; ell(x, c, c, Rq * 0.92, Rq * 0.92); x.fill();
      x.fillStyle = rgr(x, c, c, 2, c, c, Rq * 0.88, [[0, '#e8f4c8'], [0.6, '#cfe6a0'], [1, '#a8d07a']]); ell(x, c, c, Rq * 0.88, Rq * 0.88); x.fill();
      x.fillStyle = 'rgba(240,250,220,0.8)'; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.3; ell(x, c + Math.cos(a) * Rq * 0.3, c + Math.sin(a) * Rq * 0.3, Rq * 0.26, Rq * 0.16, a); x.fill(); }
      x.fillStyle = 'rgba(250,250,235,0.95)'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, d = Rq * (0.28 + (i % 2) * 0.08); ell(x, c + Math.cos(a) * d, c + Math.sin(a) * d, Rq * 0.06, Rq * 0.035, a); x.fill(); }
    } else {
      x.fillStyle = '#c41e12'; ell(x, c, c, Rq, Rq); x.fill();
      x.fillStyle = '#ec4a2c'; ell(x, c, c, Rq * 0.9, Rq * 0.9); x.fill();
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * TAU + 0.4; x.fillStyle = 'rgba(255,140,90,0.9)'; ell(x, c + Math.cos(a) * Rq * 0.48, c + Math.sin(a) * Rq * 0.48, Rq * 0.3, Rq * 0.2, a); x.fill();
        x.fillStyle = 'rgba(255,214,120,0.95)'; for (let j = 0; j < 4; j++) { ell(x, c + Math.cos(a) * Rq * (0.38 + j * 0.06), c + Math.sin(a) * Rq * (0.38 + j * 0.06) + (j % 2 ? 2 : -2), Rq * 0.05, Rq * 0.035); x.fill(); }
      }
      x.fillStyle = '#f8a080'; ell(x, c, c, Rq * 0.16, Rq * 0.16); x.fill();
    }
    x.fillStyle = 'rgba(255,255,255,0.45)'; ell(x, c - Rq * 0.35, c - Rq * 0.4, Rq * 0.25, Rq * 0.09, -0.6); x.fill();
  });
}
function slices(kind, ctx, x, y, s, o) {
  const n = o.n ?? (kind === 'cu' ? 4 : 3), rot = o.rot || 0, sq = o.sq ?? 0.55, gap = (o.gap ?? 34) * s, Rr = (kind === 'cu' ? 36 : 44) * s;
  const spr = sliceSprite(kind, Rr * bk(s) / s), sy = 0.25 + sq * 0.75, out = [];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const d = (i - (n - 1) / 2) * gap, px = x + Math.cos(rot) * d, py = y + Math.sin(rot) * d * sq;
    shadowEll(ctx, px + 4 * s, py + 5 * s, Rr * 1.05, Rr * sy, 0.25);
    ctx.fillStyle = kind === 'cu' ? '#cfe2b0' : '#d8402a'; ell(ctx, px, py + 4 * s * (1 - sq * 0.6), Rr, Rr * sy); ctx.fill();
    ctx.save(); ctx.translate(px, py); ctx.scale(1, sy); ctx.drawImage(spr, -Rr - 4 * s, -Rr - 4 * s, Rr * 2 + 8 * s, Rr * 2 + 8 * s); ctx.restore();
    out.push([px, py]);
  }
  ctx.restore();
  return { center: [x, y], first: out[0], last: out[out.length - 1] };
}
const cucumberSlices = (ctx, x, y, s = 1, o = {}) => slices('cu', ctx, x, y, s, o);
const tomatoSlices = (ctx, x, y, s = 1, o = {}) => slices('to', ctx, x, y, s, o);

// ================================================================================================= NƯỚC MẮM
function nuocMamBowl(ctx, x, y, s = 1, o = {}) {
  const pour = clamp(o.pour || 0), sq = o.sq ?? 0.55, t = o.t ?? 0, R = 115 * s, tilt = ease.inOut(clamp(pour / 0.3)) * 0.75;
  const lip = [x + R + 3 * s, y + 4 * s]; // pivot = right rim, the low point while tilting
  ctx.save();
  shadowEll(ctx, x + 6 * s, y + 70 * s, R * 1.15, R * sq * 0.9, 0.4 * (1 - tilt * 0.4));
  ctx.translate(x + R, y); ctx.rotate(tilt); ctx.translate(-R, 0);
  // body
  ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#b8bcc4'], [0.3, '#ffffff'], [0.7, '#e8eaee'], [1, '#a4a8b0']]);
  ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R, R * 0.6, -R * 0.4, R * 0.72, 0, R * 0.72); ctx.bezierCurveTo(R * 0.4, R * 0.72, R, R * 0.6, R, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2c5aa8'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.ellipse(0, R * 0.14, R * 0.99, R * sq * 0.9, 0, 0.15, PI - 0.15); ctx.stroke();
  ctx.fillStyle = '#e4e6ea'; ell(ctx, 0, 0, R, R * sq); ctx.fill();
  // sauce
  const lvl = 1 - smooth(0.3, 1, pour) * 0.6;
  ctx.save(); ell(ctx, 0, 4 * s, R * 0.92, R * sq * 0.88); ctx.clip();
  ctx.rotate(-tilt); // keep surface roughly level
  ctx.fillStyle = rgr(ctx, -R * 0.3, -R * sq * 0.2, 4, 0, 0, R, [[0, '#f0a44a'], [0.6, '#d07a26'], [1, '#9a5414']]); ell(ctx, R * (1 - lvl) * 0.5, 6 * s + (1 - lvl) * 30 * s, R * 0.95 * lvl + R * 0.3, R * sq * 0.9 * lvl + 4 * s); ctx.fill();
  const r = rng(321);
  for (let i = 0; i < 16; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.7 * lvl; ctx.fillStyle = 'rgba(250,240,210,0.95)'; ell(ctx, Math.cos(a) * d, 6 * s + Math.sin(a) * d * sq, 2.5 * s, 1.8 * s, r() * PI); ctx.fill(); }
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU + t * 0.2, d = Math.sqrt(r()) * R * 0.6 * lvl, px = Math.cos(a) * d, py = 6 * s + Math.sin(a) * d * sq;
    ctx.strokeStyle = '#d4140c'; ctx.lineWidth = 4 * s; ell(ctx, px, py, 9 * s, 9 * s * sq); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,120,0.95)'; ell(ctx, px - 2 * s, py, 1.8 * s, 1.2 * s); ctx.fill(); ell(ctx, px + 2 * s, py + 1 * s, 1.8 * s, 1.2 * s); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -R * 0.35, -R * sq * 0.25, R * 0.3, R * sq * 0.1, -0.1); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4 * s; ell(ctx, 0, 0, R, R * sq); ctx.stroke();
  ctx.restore();
  const to = o.to || [x + R + 220 * s, y + 380 * s];
  if (pour > 0.25) mamStream(ctx, lip, to, clamp((pour - 0.25) / 0.35), { s, t });
  return { center: [x, y], lip, surface: [x, y] };
}
function mamStream(ctx, from, to, k, o = {}) {
  if (k <= 0) return;
  const s = o.s ?? 1, t = o.t ?? 0, w = (o.w ?? 9) * s;
  const c = [from[0] + (to[0] - from[0]) * 0.75, from[1] - 10 * s];
  const B = (u) => [(1 - u) * (1 - u) * from[0] + 2 * (1 - u) * u * c[0] + u * u * to[0], (1 - u) * (1 - u) * from[1] + 2 * (1 - u) * u * c[1] + u * u * to[1]];
  const P = []; const N = 28, hk = clamp(k);
  for (let i = 0; i <= N; i++) { const u = i / N * hk, p = B(u); p[0] += Math.sin(u * 12 - t * 18) * 2 * s * u; P.push(p); }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(176,96,24,0.55)'; ctx.lineWidth = w * 1.5; strokePts(ctx, P);
  ctx.strokeStyle = 'rgba(226,140,50,0.9)'; ctx.lineWidth = w; strokePts(ctx, P);
  ctx.strokeStyle = 'rgba(255,230,170,0.85)'; ctx.lineWidth = w * 0.25; ctx.translate(-w * 0.2, -w * 0.15); strokePts(ctx, P); ctx.translate(w * 0.2, w * 0.15);
  const hd = P[P.length - 1];
  ctx.fillStyle = 'rgba(226,140,50,0.9)'; ell(ctx, hd[0], hd[1], w * 0.7, w * 0.9); ctx.fill();
  if (k >= 1 && o.splash !== false) {
    const r = rng(17);
    for (let i = 0; i < 9; i++) { const ph = (t * 3 + r()) % 1, a = -PI / 2 + (r() - 0.5) * 2.4, d = ph * (24 + r() * 30) * s; ctx.fillStyle = `rgba(230,150,60,${0.9 * (1 - ph)})`; ell(ctx, to[0] + Math.cos(a) * d, to[1] + Math.sin(a) * d * 0.7 + ph * ph * 30 * s, 3 * s, 3 * s); ctx.fill(); }
    ctx.fillStyle = 'rgba(200,110,30,0.5)'; ell(ctx, to[0], to[1] + 4 * s, 26 * s, 9 * s); ctx.fill();
  }
  ctx.restore();
}

// ================================================================================================= HERO PLATE
function drizzleSprite(sc) {
  return cached(`dz|${sc}`, 340 * sc, 200 * sc, (x) => {
    const r = rng(812); x.scale(sc, sc);
    for (let i = 0; i < 70; i++) {
      const u = r(), px = 30 + u * 280, py = 100 + Math.sin(u * 6) * 26 + (r() - 0.5) * 70 * (0.5 + Math.sin(u * PI) * 0.6), rr = 5 + r() * 3.5, sq2 = 0.45 + r() * 0.5, rot = r() * PI, white = r() < 0.15;
      x.save(); x.translate(px, py); x.rotate(rot);
      x.strokeStyle = 'rgba(10,50,10,0.45)'; x.lineWidth = rr * 0.5; ell(x, 0.8, 1.4, rr, rr * sq2); x.stroke();
      x.strokeStyle = white ? '#d8f0b0' : (r() < 0.5 ? '#2fa832' : '#52c84a'); x.lineWidth = rr * 0.42; ell(x, 0, 0, rr, rr * sq2); x.stroke();
      x.strokeStyle = 'rgba(255,255,230,0.8)'; x.lineWidth = rr * 0.13; x.beginPath(); x.ellipse(0, 0, rr * 0.95, rr * sq2 * 0.95, 0, PI * 1.1, PI * 1.6); x.stroke();
      x.restore();
    }
    // oil sheen drops
    for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(255,224,120,0.35)'; ell(x, 30 + r() * 280, 70 + r() * 70, 6 + r() * 10, 3 + r() * 5, r()); x.fill(); }
  });
}
const PLATE_ITEMS = { // plate coords (px from centre, R = 420), base rotation
  rice: [-40, 25], chop: [-25, -70, -0.32], bi: [-238, 150], pickles: [30, 300], cucumber: [262, -10, 1.35], tomato: [238, 130, 1.2], cha: [205, -215, 0.25], egg: [118, 150], moHanh: [-30, -90],
};
function comTamPlate(ctx, x, y, s = 1, o = {}) {
  const top = !!o.topDown, sq = top ? 1 : (o.sq ?? 0.5), ang = o.angle || 0, R = (o.R ?? 420) * s, t = o.t ?? 0, ps = (o.R ?? 420) / 420; // ps = item size factor (items drawn at s*ps)
  const it = Object.assign({ rice: 1, chop: 1, bi: 1, cha: 1, egg: 1, moHanh: 1, pickles: 1 }, o.items || {});
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (px, py) => { const X = (px * ca - py * sa) * ps * s, Y = (px * sa + py * ca) * ps * s; return [x + X, y + Y * sq]; };
  const A = { plate: { x, y, rx: R, ry: R * sq }, center: [x, y] };
  ctx.save();
  // plate
  const thick = 26 * s * Math.sqrt(1 - sq * sq);
  shadowEll(ctx, x + 14 * s, y + thick + 20 * s, R * 1.08, R * sq * 1.08 + 10 * s, 0.55);
  if (thick > 0.5) { ctx.fillStyle = lgr(ctx, x - R, 0, x + R, 0, [[0, '#9aa0aa'], [0.35, '#e8ebf0'], [1, '#8a909a']]); ell(ctx, x, y + thick, R * 0.99, R * sq * 0.99); ctx.fill(); ctx.fillRect(x - R * 0.99, y, R * 1.98, thick); }
  ctx.fillStyle = rgr(ctx, x - R * 0.3, y - R * sq * 0.4, R * 0.1, x, y, R, [[0, '#ffffff'], [0.8, '#f2f4f8'], [1, '#cfd4dc']]); ell(ctx, x, y, R, R * sq); ctx.fill();
  if ((o.rim || 'blue') === 'blue') { ctx.strokeStyle = '#2350a8'; ctx.lineWidth = 9 * s; ell(ctx, x, y, R * 0.955, R * sq * 0.955); ctx.stroke(); ctx.strokeStyle = 'rgba(35,80,168,0.6)'; ctx.lineWidth = 2.5 * s; ell(ctx, x, y, R * 0.9, R * sq * 0.9); ctx.stroke(); }
  ctx.fillStyle = 'rgba(160,170,190,0.18)'; ell(ctx, x + R * 0.04, y + R * sq * 0.05, R * 0.78, R * sq * 0.78); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(x, y, R * 0.985, R * sq * 0.985, 0, PI * 1.08, PI * 1.45); ctx.ellipse(x, y, R * 0.94, R * sq * 0.94, 0, PI * 1.45, PI * 1.08, true); ctx.closePath(); ctx.fill();
  // items
  const H = 340 * s, riceR = 205, riceP = P(...PLATE_ITEMS.rice);
  const riceH = (pt) => { // lift of a point sitting on the rice mound (screen px)
    const d = Math.hypot(pt[0] - PLATE_ITEMS.rice[0], pt[1] - PLATE_ITEMS.rice[1]) / riceR; return it.rice * Math.max(0, 1 - d * d) * riceR * 0.5 * ps * s * Math.sqrt(1 - sq * sq) * 0.85 + (top ? 0 : 0);
  };
  const draws = [];
  const add = (name, z, fn) => draws.push({ name, z, fn });
  const ground = (name) => { const p = PLATE_ITEMS[name], q = P(p[0], p[1]); return { q, z: q[1] }; };
  for (const name of ['bi', 'pickles', 'cucumber', 'tomato', 'cha']) {
    const g = ground(name), key = (name === 'cucumber' || name === 'tomato') ? 'pickles' : name, k = clamp(it[key] ?? 1); A[name] = g.q;
    if (k <= 0) continue;
    add(name, g.z, () => {
      const d = dropOff(k, H); ctx.save(); ctx.globalAlpha *= d.a; ctx.translate(g.q[0], g.q[1] + d.dy); ctx.scale(d.sc, d.sc * d.sy);
      const p = PLATE_ITEMS[name];
      if (name === 'bi') biPile(ctx, 0, 0, s * ps, { sq, seed: 2 });
      else if (name === 'pickles') doChua(ctx, 0, 0, s * ps, { mode: 'pile', sq, R: 82 });
      else if (name === 'cucumber') cucumberSlices(ctx, 0, 0, s * ps, { n: 4, rot: p[2] + ang, sq });
      else if (name === 'tomato') tomatoSlices(ctx, 0, 0, s * ps, { n: 3, rot: p[2] + ang, sq, gap: 40 });
      else if (name === 'cha') chaTrung(ctx, 0, 0, s * ps, { mode: 'slice', size: 128, sq: top ? 0.74 : sq, depth: top ? 0.5 : 0.62, rot: p[2] + ang });
      ctx.restore();
    });
  }
  // rice + toppings that sit on it
  A.rice = riceP;
  if (it.rice > 0) add('rice', riceP[1], () => {
    const d = dropOff(it.rice, H); ctx.save(); ctx.globalAlpha *= d.a; ctx.translate(riceP[0], riceP[1] + d.dy); ctx.scale(d.sc, d.sc * d.sy);
    const r2 = brokenRice(ctx, 0, 0, s * ps, { R: riceR, view: top ? 'top' : '3q', sq, seed: 3, t, sparkle: 0.5 });
    A.ricePeak = [riceP[0], riceP[1] + r2.top[1]];
    ctx.restore();
  });
  A.ricePeak = A.ricePeak || [riceP[0], riceP[1] - riceR * 0.5 * ps * s * Math.sqrt(1 - sq * sq)];
  const onRice = (name, fn) => {
    const p = PLATE_ITEMS[name], q = P(p[0], p[1]), lift = riceH(p); const pos = [q[0], q[1] - lift]; A[name] = pos;
    const key = name; const k = clamp(it[key] ?? 1); if (k <= 0) return;
    add(name, riceP[1] + 1 + (name === 'egg' ? 2 : name === 'moHanh' ? 3 : 1), () => { const d = dropOff(k, H); ctx.save(); ctx.globalAlpha *= d.a; ctx.translate(pos[0], pos[1] + d.dy); ctx.scale(d.sc, d.sc * d.sy); fn(k); ctx.restore(); });
  };
  onRice('chop', () => { const a = porkChop(ctx, 0, 0, s * ps * 0.92, { cook: 1, rot: PLATE_ITEMS.chop[2] + ang, sq, topDown: top, seed: 4, t, shadow: true, thick: 14 }); });
  onRice('egg', () => { friedEgg(ctx, 0, 0, s * ps * 0.78, { pan: false, sq, t, rot: ang, seed: 2 }); });
  A.yolk = [A.egg[0] - 14 * s * ps * 0.78, A.egg[1] - 10 * s * ps * 0.78 * sq];
  onRice('moHanh', (k) => {
    const sc = bk(s * ps), spr = drizzleSprite(sc), f = s * ps / sc;
    ctx.save(); ctx.scale(1, sq); ctx.rotate(PLATE_ITEMS.chop[2] + ang); ctx.translate(0, -18 * s * ps);
    const wv = spr.width * f * clamp(k * 1.4); if (wv > 1) ctx.drawImage(spr, 0, 0, spr.width * clamp(k * 1.4), spr.height, -spr.width * f / 2, -spr.height * f / 2, wv, spr.height * f);
    ctx.restore();
  });
  // sort: ground items by depth; rice-toppings after rice
  draws.sort((a, b) => a.z - b.z);
  for (const d of draws) d.fn();
  // nước mắm soak: amber wet pool on rice + gloss + chili bits
  const mam = clamp(o.mam || 0);
  if (mam > 0) {
    const r = rng(733), pr = 190 * ps * s * ease.out(mam);
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = rgr(ctx, riceP[0] + 30 * s, riceP[1] + 20 * s, 0, riceP[0] + 30 * s, riceP[1] + 20 * s, pr, [[0, `rgba(214,140,60,${0.75 * mam})`], [0.7, `rgba(226,170,90,${0.5 * mam})`], [1, 'rgba(255,255,255,0)']]);
    ctx.save(); ctx.translate(0, riceP[1] * (1 - sq)); ctx.scale(1, sq); ctx.translate(0, -riceP[1] * (1 - sq) / sq + riceP[1] * (1 / sq - 1)); ctx.restore();
    ell(ctx, riceP[0] + 30 * s, riceP[1] + 20 * s, pr, pr * sq * 0.9); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * pr; const px = riceP[0] + 30 * s + Math.cos(a) * d, py = riceP[1] + 20 * s + Math.sin(a) * d * sq * 0.9; ctx.fillStyle = `rgba(255,236,200,${0.6 * mam})`; ell(ctx, px, py, (3 + r() * 6) * s, (1.5 + r() * 2) * s, r() * PI); ctx.fill(); }
    ctx.restore();
    for (let i = 0; i < 7; i++) { const a = r() * TAU, d = Math.sqrt(r()) * pr * 0.8, px = riceP[0] + 30 * s + Math.cos(a) * d, py = riceP[1] + 20 * s + Math.sin(a) * d * sq * 0.9; ctx.globalAlpha = smooth(0.3, 0.7, mam); ctx.strokeStyle = '#d4140c'; ctx.lineWidth = 3.5 * s; ell(ctx, px, py, 7 * s, 7 * s * Math.max(0.5, sq)); ctx.stroke(); ctx.globalAlpha = 1; }
    FX.glazeSparkle(ctx, t, riceP[0], riceP[1], pr * 0.9, mam, { n: 6, ryr: sq, size: s * 0.7, seed: 71 });
  }
  if ((o.glaze || 0) > 0 && it.chop > 0.9) FX.glazeSparkle(ctx, t, A.chop[0], A.chop[1], 150 * s * ps, o.glaze, { n: 7, ryr: sq * 0.6, size: s * ps, seed: 72 });
  if ((o.steam || 0) > 0) FX.steam(ctx, t, { x: A.ricePeak[0], y: A.ricePeak[1], w: 260 * s * ps, h: 520 * s, n: 9, k: o.steam, s: s * ps, seed: 74 });
  ctx.restore();
  return A;
}

// ================================================================================================= SPOON BITE
function spoonBite(ctx, x, y, s = 1, o = {}) {
  const rot = o.rot ?? 0.5, k = clamp(o.k ?? 1), t = o.t ?? 0;
  const hx = x + Math.cos(rot) * 300 * s, hy = y + Math.sin(rot) * 300 * s;
  ctx.save();
  // handle
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = lgr(ctx, 0, -14 * s, 0, 14 * s, [[0, '#7c848c'], [0.4, '#f4f6f8'], [1, '#6a7078']]);
  ctx.beginPath(); ctx.moveTo(70 * s, -9 * s); ctx.quadraticCurveTo(200 * s, -12 * s, 320 * s, -18 * s); ctx.quadraticCurveTo(338 * s, 0, 320 * s, 18 * s); ctx.quadraticCurveTo(200 * s, 12 * s, 70 * s, 9 * s); ctx.closePath(); ctx.fill();
  ctx.restore();
  // bowl
  ctx.fillStyle = lgr(ctx, x - 90 * s, y - 60 * s, x + 90 * s, y + 60 * s, [[0, '#ffffff'], [0.4, '#b8c0c8'], [0.8, '#e4e8ec'], [1, '#7a828a']]);
  ell(ctx, x, y, 92 * s, 62 * s, rot * 0.3); ctx.fill();
  ctx.strokeStyle = 'rgba(60,66,72,0.5)'; ctx.lineWidth = 2 * s; ctx.stroke();
  if (k > 0) {
    brokenRice(ctx, x - 4 * s, y + 8 * s, s, { R: 78, sq: 0.62, hk: 0.9, k, shadow: false, seed: 8, t, sparkle: 0.8 });
    ctx.save(); ctx.globalAlpha *= smooth(0.3, 0.7, k);
    // chop piece (cropped chunk of the chop sprite)
    const sc = bk(s), spr = chopSprite(1, sc, 4, false);
    ctx.save(); ctx.translate(x + 14 * s, y - 34 * s); ctx.rotate(-0.25); ctx.scale(1, 0.75);
    ctx.beginPath(); ctx.moveTo(-58 * s, -20 * s); ctx.lineTo(50 * s, -34 * s); ctx.lineTo(62 * s, 22 * s); ctx.lineTo(-48 * s, 30 * s); ctx.closePath();
    ctx.fillStyle = '#4a1a06'; ctx.save(); ctx.translate(0, 9 * s); ctx.fill(); ctx.restore(); ctx.clip();
    ctx.drawImage(spr, (CHOP_OX - 60) * sc, (CHOP_OY - 40) * sc, 130 * sc, 80 * sc, -65 * s, -40 * s, 130 * s, 80 * s);
    ctx.restore();
    // egg white + yolk drip
    ctx.fillStyle = '#fbf8ef'; ctx.beginPath(); ctx.ellipse(x - 46 * s, y - 14 * s, 34 * s, 18 * s, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(214,150,70,0.7)'; ctx.beginPath(); ctx.ellipse(x - 70 * s, y - 6 * s, 10 * s, 6 * s, 0.3, 0, TAU); ctx.fill();
    yolk(ctx, x - 40 * s, y - 20 * s, 15 * s, 0.7, 0.02 * Math.sin(t * 9));
    ctx.fillStyle = '#ffb320'; ctx.beginPath(); ctx.moveTo(x - 32 * s, y - 10 * s); ctx.quadraticCurveTo(x - 26 * s, y + 10 * s, x - 30 * s, y + 24 * s); ctx.arc(x - 30 * s, y + 24 * s, 4 * s, 0, PI); ctx.quadraticCurveTo(x - 36 * s, y + 6 * s, x - 42 * s, y - 8 * s); ctx.fill();
    // scallion bits
    const r = rng(5); for (let i = 0; i < 6; i++) { ctx.strokeStyle = '#3cb83a'; ctx.lineWidth = 3 * s; ell(ctx, x + (r() - 0.4) * 80 * s, y - 30 * s + (r() - 0.5) * 30 * s, 5 * s, 3 * s, r()); ctx.stroke(); }
    ctx.restore();
    if (o.steam) FX.steam(ctx, t, { x, y: y - 40 * s, w: 100 * s, h: 260 * s, n: 5, k: o.steam, s: s * 0.7, seed: 12 });
  }
  ctx.restore();
  return { bowl: [x, y], tip: [x - Math.cos(rot) * 92 * s, y - Math.sin(rot) * 62 * s], handle: [hx, hy] };
}

module.exports = {
  brokenRice, ricePot, paddleScoop, porkChop, chopsOnGrill, marinadeBowl, biTray, biPile, chaTrung, moHanh, friedEgg,
  doChua, cucumberSlices, tomatoSlices, nuocMamBowl, mamStream, comTamPlate, spoonBite, tongs, knife,
};
