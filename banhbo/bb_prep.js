'use strict';
// bb_prep.js — "Bánh bò nướng lá dứa" process props (writer A: shots s2..s6). LOCAL in / LOCAL out, deterministic.
// =====================================================================================================================
// API HEADER (source of truth). Light = warm from the upper left; no black outlines; soft gradient shading.
//  PURPLE                      Cô Út's áo bà ba palette {aoba, aobaD, khan, khanW} → NP.coUt(..., {palette: PURPLE})
//  COLS                        {PAN leaf, JUICE, BATTER, CRUST} colour sets used everywhere (keep the cake consistent)
//  tube(ctx,x0,y0,x1,y1,w0,w1,stops)          tapered capsule shaded across its width (lit side = upper-left)
//  armIn(ctx,wx,wy,ang,s,{len,cuff})          Cô Út forearm + purple sleeve coming from off-frame; (wx,wy) = wrist,
//                                              ang = direction shoulder→wrist. Draw BEFORE the hand.
//  fist(ctx,x,y,s,rot,{flip}) → {wrist}       soft-shaded fist gripping a stick that runs along local y through the
//                                              origin; back of hand to camera, wrist toward local +x (flip: −x). ~100×75.
//  pestle(ctx,x,y,s,rot,{stain}) → {grip}     wooden pestle, origin = striking tip, 460 long toward −y.
//  mortar(ctx,x,y,s,{ryr=.42,t,leaves 0..1,mash 0..1,drop(T) …}) → {rim,surf}   granite mortar, origin rim centre, R 200.
//  leafChip(ctx,x,y,s,rot,{mash})             cut pandan segment (~46×17, keeled V, pale cut ends)
//  pandanLeaf(ctx,pts,w,{bite,seed})          long pandan leaf along a polyline pts (base → tip), keeled two-tone blade.
//  pandanBundle(ctx,x,y,s,rot)                tied bundle of pandan leaves lying on a table (3/4), origin = tie.
//  clothBundle(ctx,x,y,s,{sq,stain,t}) → {bottom}   muslin bundle of pulp, origin ball centre, twisted neck up to −430.
//  bowl(ctx,x,y,s,{ryr,fill,liq,t,rip,contents}) → {surf:[x,y],rs,ryr}   white/blue porcelain bowl, origin rim centre,
//                                              R 200, depth 110. liq 'juice'|'batter'|'milk'|null. rip = [[t0,u,v],..]
//                                              ripple rings (u,v = −1..1 on the surface). contents(ctx,cx,cy,rs,ryr) clip-
//                                              drawn on the liquid instead of the plain liquid.
//  mould(ctx,x,y,s,{ryr=.5,oil 0..1,fill 0..1,batter,t,ripple,bubbles}) → {rim,surf,R}  fluted aluminium mould (khuôn),
//                                              origin = rim centre, R 300 (incl. flutes), depth 150, floor .74R.
//  cakeTop(ctx,x,y,s,{ryr,cook=1,steamy}) golden domed top of the baked cake sitting in the mould (draw after mould with
//                                              fill 1). Crust #a8642a→#c98a3c, crack ring, blisters, gloss.
//  brazier(ctx,x,y,s,{ryr,t,glow}) → {top}   clay charcoal oven (lò than) seen 3/4, origin = top rim centre (mould sits
//                                              there), rim R 270, body 430 tall, glowing fire mouth.
//  ovenLid(ctx,x,y,s,{ryr,t,coals 0..1,ash 0..1,tilt}) flat tin lid R 330 with a heap of glowing coals, origin = rim centre.
//  coal(ctx,x,y,s,rot,{seed,heat,ash})        single charcoal lump with ember cracks.
//  cutaway(ctx,x,y,s,{t,k rise 0..1,cook 0..1,pops:[times],T,ash}) cross-section of oven + mould + rising batter; origin =
//                                              mould rim centre, mould R 300.
//  leafBrush(ctx,x,y,s,rot,{oil}) → {grip}   banana-leaf oil brush, origin = bristle tip, handle toward −y (230).
//  ribbon(ctx,pts,w,{t,col}) thick glossy batter / juice pour along a polyline (head→landing).
//  alarmClock(ctx,x,y,s,{t,ring 0..1})        twin-bell brass alarm clock, origin = feet.
//  coconutCup / egg / sieve / sugarSpoon / whiskTop — small s3 tools (see each fn).
//  tableTopDown() · table3q(ty) · stallPlate() — cached full-frame backgrounds (W×H, or 1800×2700 for tableTopDown).
// =====================================================================================================================
const L = require('./lib');
const NP = require('./nprops');
const BX = require('./bxprops');
const { W, H, TAU, rng, clamp, lerp, ease, at, createCanvas } = L;
const PI = Math.PI;
const { lgr, rgr, ell, mixc } = NP;

const PURPLE = { aoba: '#8a5a9e', aobaD: '#55306a', khan: '#141214', khanW: '#ece6dc' };
const SKIN = NP.COL.skin;
const PAN = { L: '#b8e27c', M: '#5fae3e', D: '#2f6f2a', DD: '#1b4a1c', cut: '#e2f2a8' };
const JUICE = { L: '#8ee05a', M: '#2f9a34', D: '#135a1d' };
const BATTER = { L: '#cfeb8e', M: '#9ccf5a', D: '#6fa63a', DD: '#4c7f28' };
const CRUST = { L: '#f2b552', M: '#cf8634', D: '#a8642a', DD: '#5e2c0c' };
const COLS = { PAN, JUICE, BATTER, CRUST };

const CACHE = {};
function sprite(w, h, fn) { const c = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); fn(c.getContext('2d'), c); return c; }
function cache(key, w, h, fn) { return CACHE[key] || (CACHE[key] = sprite(w, h, fn)); }
function blurCopy(src, px) { return sprite(src.width, src.height, (x) => { x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; }); }

// ------------------------------------------------------------------ generic shading helpers
function tube(ctx, x0, y0, x1, y1, w0, w1, stops) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + PI / 2, a - PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - PI / 2, a + PI / 2, true);
  ctx.closePath();
  const lit = (nx * -0.6 + ny * -0.8) > 0 ? 1 : -1, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, wm = Math.max(w0, w1) / 2;
  ctx.fillStyle = lgr(ctx, mx + nx * wm * lit, my + ny * wm * lit, mx - nx * wm * lit, my - ny * wm * lit, stops);
  ctx.fill();
}
const skinStops = (sk = SKIN) => [[0, sk[0]], [0.5, sk[1]], [1, sk[2]]];

// ------------------------------------------------------------------ arm + hands (Cô Út)
function armIn(ctx, wx, wy, ang, s, o = {}) {
  const c = Math.cos(ang), n = Math.sin(ang), len = (o.len || 1700) * s, cuff = (o.cuff ?? 150) * s;
  const nx = -n, ny = c;
  ctx.save();
  // soft cast shadow
  ctx.globalAlpha = 0.18; ctx.strokeStyle = '#1a0a08'; ctx.lineCap = 'round'; ctx.lineWidth = 80 * s;
  ctx.beginPath(); ctx.moveTo(wx - c * len + 20 * s, wy - n * len + 40 * s); ctx.lineTo(wx + 16 * s, wy + 34 * s); ctx.stroke();
  ctx.globalAlpha = 1;
  // forearm
  tube(ctx, wx - c * (cuff + 40 * s), wy - n * (cuff + 40 * s), wx, wy, 54 * s, 42 * s, skinStops());
  // occlusion near the cuff
  ctx.globalAlpha = 0.35;
  tube(ctx, wx - c * (cuff + 20 * s), wy - n * (cuff + 20 * s), wx - c * (cuff - 26 * s), wy - n * (cuff - 26 * s), 54 * s, 50 * s, [[0, 'rgba(60,20,30,0.9)'], [1, 'rgba(60,20,30,0.2)']]);
  ctx.globalAlpha = 1;
  // sleeve
  const sx = wx - c * cuff, sy = wy - n * cuff;
  tube(ctx, wx - c * len, wy - n * len, sx, sy, 104 * s, 90 * s, [[0, '#b58ac6'], [0.35, PURPLE.aoba], [1, PURPLE.aobaD]]);
  // weave texture
  ctx.save(); ctx.globalAlpha = 0.25;
  tube(ctx, wx - c * len, wy - n * len, sx, sy, 104 * s, 90 * s, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillStyle = NP.weave(ctx, 18 * s, PURPLE.aoba); ctx.fill(); ctx.restore();
  // cuff hem + folds
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(40,14,50,0.55)'; ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(sx + nx * 44 * s - c * 14 * s, sy + ny * 44 * s - n * 14 * s); ctx.lineTo(sx - nx * 44 * s - c * 14 * s, sy - ny * 44 * s - n * 14 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(40,14,50,0.28)'; ctx.lineWidth = 4 * s;
  for (const d of [90, 190, 300, 430]) {
    const px = sx - c * d * s, py = sy - n * d * s, w = 40 * s;
    ctx.beginPath(); ctx.moveTo(px + nx * w, py + ny * w); ctx.quadraticCurveTo(px - c * 26 * s, py - n * 26 * s, px - nx * w * 0.6, py - ny * w * 0.6); ctx.stroke();
  }
  // warm rim light on the lit side
  const lit = (nx * -0.6 + ny * -0.8) > 0 ? 1 : -1;
  ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,190,130,0.45)'; ctx.lineWidth = 6 * s;
  ctx.beginPath(); ctx.moveTo(wx - c * len + nx * 46 * s * lit, wy - n * len + ny * 46 * s * lit); ctx.lineTo(sx + nx * 42 * s * lit, sy + ny * 42 * s * lit); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,180,0.4)'; ctx.lineWidth = 4 * s;
  ctx.beginPath(); ctx.moveTo(sx - c * 10 * s + nx * 22 * s * lit, sy - n * 10 * s + ny * 22 * s * lit); ctx.lineTo(wx + nx * 17 * s * lit, wy + ny * 17 * s * lit); ctx.stroke();
  ctx.restore();
}

function fist(ctx, x, y, s, rot = 0, o = {}) {
  const sk = o.skin || SKIN, fl = o.flip ? -1 : 1;
  at(ctx, x, y, rot, s * fl, s, () => {
    ctx.lineCap = 'round';
    // contact shadow on the stick
    ctx.fillStyle = 'rgba(30,10,5,0.25)'; ell(ctx, -6, 42, 34, 9); ctx.fill();
    // back of the hand + wrist
    ctx.beginPath();
    ctx.moveTo(8, -38); ctx.bezierCurveTo(40, -44, 74, -32, 100, -22); ctx.lineTo(102, 22);
    ctx.bezierCurveTo(72, 32, 40, 42, 8, 38); ctx.quadraticCurveTo(-4, 0, 8, -38); ctx.closePath();
    ctx.fillStyle = rgr(ctx, 30, -26, 6, 50, 6, 80, [[0, sk[0]], [0.6, sk[1]], [1, sk[2]]]); ctx.fill();
    // tendons / veins (very soft)
    ctx.strokeStyle = 'rgba(150,80,55,0.16)'; ctx.lineWidth = 3;
    for (const yy of [-20, -6, 8, 22]) { ctx.beginPath(); ctx.moveTo(84, yy * 0.6); ctx.quadraticCurveTo(50, yy * 0.9, 20, yy); ctx.stroke(); }
    // four curled fingers (stacked along the stick)
    for (let i = 3; i >= 0; i--) {
      const y0 = -34 + i * 17.5, h = 18.5, x0 = -28 + i * 2.2, w = 52 - i * 3.5;
      ctx.beginPath(); ctx.roundRect(x0, y0, w, h, h / 2);
      ctx.fillStyle = lgr(ctx, 0, y0, 0, y0 + h, [[0, sk[0]], [0.55, sk[1]], [1, sk[2]]]); ctx.fill();
      // knuckle bump + crease
      ctx.fillStyle = 'rgba(255,236,215,0.5)'; ell(ctx, x0 + w - 12, y0 + 6, 7, 3.5); ctx.fill();
      ctx.strokeStyle = 'rgba(120,55,35,0.28)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x0 + 16, y0 + 3); ctx.quadraticCurveTo(x0 + 14, y0 + h / 2, x0 + 16, y0 + h - 3); ctx.stroke();
    }
    // thumb wrapping over the index finger
    tube(ctx, 64, -30, 4, -40, 24, 18, skinStops(sk));
    ctx.fillStyle = 'rgba(255,228,214,0.85)'; ell(ctx, 6, -41, 7, 5, -0.15); ctx.fill();
    ctx.strokeStyle = 'rgba(150,80,60,0.35)'; ctx.lineWidth = 1.2; ell(ctx, 6, -41, 7, 5, -0.15); ctx.stroke();
    // warm rim on the top edge
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,140,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(14, -48); ctx.quadraticCurveTo(50, -50, 96, -26); ctx.stroke(); ctx.restore();
  });
  return { wrist: [x + Math.cos(rot) * 100 * s * fl, y + Math.sin(rot) * 100 * s * fl] };
}

// ------------------------------------------------------------------ pandan
function leafChip(ctx, x, y, s, rot, o = {}) {
  const m = clamp(o.mash || 0), sq = 1 - m * 0.45;
  at(ctx, x, y, rot, s * 0.72, s * sq * 1.25, () => {
    const top = mixc(PAN.L, PAN.D, m * 0.6), mid = mixc(PAN.M, PAN.DD, m * 0.5), bot = mixc(PAN.D, PAN.DD, m * 0.6);
    ctx.beginPath(); ctx.moveTo(-23, -8); ctx.quadraticCurveTo(0, -11, 23, -7); ctx.lineTo(23, 0); ctx.quadraticCurveTo(0, -2, -23, 0); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -10, 0, 0, [[0, top], [1, mid]]); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-23, 0); ctx.quadraticCurveTo(0, -2, 23, 0); ctx.lineTo(22, 8); ctx.quadraticCurveTo(0, 6, -22, 9); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, 0, 0, 9, [[0, mid], [1, bot]]); ctx.fill();
    ctx.strokeStyle = 'rgba(230,255,190,0.55)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-22, -0.5); ctx.quadraticCurveTo(0, -2.5, 22, -0.5); ctx.stroke();
    ctx.fillStyle = mixc(PAN.cut, PAN.M, m); ctx.fillRect(-24, -8, 2.6, 17); ctx.fillRect(21.6, -7, 2.6, 15);
    if (m < 0.6) { ctx.fillStyle = `rgba(255,255,240,${0.45 * (1 - m)})`; ell(ctx, -6, -6.5, 9, 1.4, -0.03); ctx.fill(); }
  });
}
function pandanLeaf(ctx, pts, w, o = {}) {
  // long strap leaf as a softly TWISTING ribbon (width narrows where it turns edge-on, top face glossy dark green with a
  // keel crease, underside paler), so it never reads as a tube.
  const n = pts.length; if (n < 2) return;
  const P = []; for (let i = 0; i < n - 1; i++) { const a = pts[i], b = pts[i + 1]; for (let k = 0; k < 8; k++) { const u = k / 8; P.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]); } } P.push(pts[n - 1]);
  for (let it = 0; it < 3; it++) for (let i = 1; i < P.length - 1; i++) P[i] = [(P[i - 1][0] + P[i][0] * 2 + P[i + 1][0]) / 4, (P[i - 1][1] + P[i][1] * 2 + P[i + 1][1]) / 4];
  const m = P.length, bite = o.bite || 0, cut = Math.max(1, Math.floor((m - 1) * (1 - bite)));
  const Q = P.slice(0, cut + 1), N = Q.length, sd = o.seed || 0;
  const NR = Q.map((p, i) => { const a = Q[Math.max(0, i - 1)], b = Q[Math.min(N - 1, i + 1)]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); return [-Math.sin(ang), Math.cos(ang)]; });
  const tw = o.twist ?? (0.55 + ((sd * 0.618) % 1) * 0.6);
  const phi = (i) => (i / (m - 1)) * tw * PI + (o.phase ?? 0.25);
  const prof = (i) => { const u = i / (m - 1); return u < 0.06 ? lerp(0.75, 1, u / 0.06) : u > 0.72 ? Math.pow((1 - u) / 0.28, 0.75) : 1; };
  const half = (i) => w / 2 * prof(i) * (0.16 + 0.84 * Math.abs(Math.cos(phi(i))));
  const face = (i) => Math.cos(phi(i)) >= 0;
  const E1 = Q.map((p, i) => [p[0] + NR[i][0] * half(i), p[1] + NR[i][1] * half(i)]);
  const E2 = Q.map((p, i) => [p[0] - NR[i][0] * half(i), p[1] - NR[i][1] * half(i)]);
  const K = Q.map((p, i) => { const k = Math.sin(phi(i)) * half(i) * 0.35; return [p[0] + NR[i][0] * k, p[1] + NR[i][1] * k]; });
  const upIs1 = NR[Math.floor(N / 2)][1] < 0;
  ctx.save(); ctx.lineJoin = 'round';
  // runs of the same visible face
  let i0 = 0;
  while (i0 < N - 1) {
    let i1 = i0 + 1; while (i1 < N - 1 && face(i1) === face(i0)) i1++;
    const top = face(i0), a = Q[i0], b = Q[i1];
    for (const [E, lit] of [[E1, upIs1], [E2, !upIs1]]) {
      ctx.beginPath(); for (let i = i0; i <= i1; i++) i === i0 ? ctx.moveTo(K[i][0], K[i][1]) : ctx.lineTo(K[i][0], K[i][1]);
      if (bite > 0 && i1 === N - 1) { const e = K[i1], sE = E[i1]; for (let j = 1; j <= 3; j++) { const u = j / 4; ctx.lineTo(lerp(e[0], sE[0], u) + (j % 2 ? 4 : -3), lerp(e[1], sE[1], u) + (j % 2 ? -3 : 3)); } }
      for (let i = i1; i >= i0; i--) ctx.lineTo(E[i][0], E[i][1]); ctx.closePath();
      const c0 = top ? (lit ? PAN.M : PAN.D) : (lit ? '#a8d672' : '#7fb04e'), c1 = top ? (lit ? PAN.L : PAN.M) : (lit ? '#c4e692' : '#93c25e');
      ctx.fillStyle = lgr(ctx, a[0], a[1], b[0], b[1], [[0, c0], [1, c1]]); ctx.fill();
      ctx.strokeStyle = c0; ctx.lineWidth = 0.8; ctx.stroke();
    }
    i0 = i1;
  }
  // keel crease + gloss on the top face
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,60,20,0.35)'; ctx.lineWidth = Math.max(1, w * 0.05);
  ctx.beginPath(); K.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(235,255,200,0.45)'; ctx.lineWidth = Math.max(1, w * 0.06);
  ctx.beginPath(); K.forEach((p, i) => { const q = [p[0] - NR[i][0] * 1.5, p[1] - NR[i][1] * 1.5]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
  const E = upIs1 ? E1 : E2; ctx.strokeStyle = 'rgba(255,255,235,0.4)'; ctx.lineWidth = Math.max(1, w * 0.1);
  let open = false; ctx.beginPath();
  for (let i = 1; i < N - 1; i++) { if (!face(i) || Math.abs(Math.cos(phi(i))) < 0.55) { open = false; continue; } const q = [lerp(K[i][0], E[i][0], 0.55), lerp(K[i][1], E[i][1], 0.55)]; if (!open) { ctx.moveTo(q[0], q[1]); open = true; } else ctx.lineTo(q[0], q[1]); }
  ctx.stroke();
  ctx.restore();
  return { tip: Q[N - 1] };
}
function pandanBundle(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = 'rgba(30,15,5,0.28)'; ell(ctx, 30, 26, 300, 34); ctx.fill();
    const r = rng(17);
    for (let i = 0; i < 11; i++) {
      const a0 = (r() - 0.5) * 0.5, len = 260 + r() * 130, yy = (r() - 0.5) * 30;
      const pts = [[-170 - r() * 30, yy + 4], [0, yy], [len * 0.5, yy + Math.sin(a0) * 60 - 6], [len, yy + Math.sin(a0) * 120 - 20 + r() * 20]];
      pandanLeaf(ctx, pts, 26 + r() * 8, { seed: i * 1.3 });
    }
    // raffia tie
    ctx.fillStyle = lgr(ctx, 0, -20, 0, 22, [[0, '#e8c98a'], [1, '#9a7442']]); ctx.beginPath(); ctx.roundRect(-14, -24, 26, 48, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 1.5; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-14, -16 + k * 11); ctx.lineTo(12, -18 + k * 11); ctx.stroke(); }
  });
}

// ------------------------------------------------------------------ pestle & mortar
function pestle(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-32, -34); ctx.bezierCurveTo(-30, -150, -22, -300, -21, -440); ctx.quadraticCurveTo(0, -466, 21, -440);
    ctx.bezierCurveTo(22, -300, 30, -150, 32, -34); ctx.bezierCurveTo(32, 8, -32, 8, -32, -34); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -32, 0, 32, 0, [[0, '#e2ad72'], [0.35, '#b97c45'], [0.75, '#80502a'], [1, '#4e2f17']]); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(70,35,15,0.25)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 7; i++) { const xx = -22 + i * 7; ctx.beginPath(); ctx.moveTo(xx, 0); ctx.bezierCurveTo(xx + 3, -150, xx - 3, -300, xx * 0.7, -460); ctx.stroke(); }
    if (o.stain) { ctx.fillStyle = lgr(ctx, 0, 6, 0, -120, [[0, `rgba(40,110,30,${0.85 * o.stain})`], [0.5, `rgba(60,130,40,${0.35 * o.stain})`], [1, 'rgba(60,130,40,0)']]); ctx.fillRect(-40, -130, 80, 140); }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,225,180,0.45)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-20, -30); ctx.bezierCurveTo(-19, -150, -14, -300, -13, -430); ctx.stroke(); ctx.restore();
  });
  const c = Math.cos(rot), n = Math.sin(rot);
  return { grip: [x + 360 * s * n, y - 360 * s * c] };
}
function mortarBody() {
  return cache('mortar', 520, 420, (x) => {
    x.translate(260, 100); // rim centre
    const ry = 84;
    x.fillStyle = 'rgba(25,12,6,0.45)'; ell(x, 20, 236, 230, 60); x.fill();
    x.beginPath(); x.moveTo(-200, 0); x.bezierCurveTo(-216, 80, -200, 170, -150, 228); x.ellipse(0, 228, 150, 52, 0, PI, 0, true);
    x.bezierCurveTo(200, 170, 216, 80, 200, 0); x.ellipse(0, 0, 200, ry, 0, 0, PI, false); x.closePath();
    x.fillStyle = lgr(x, -216, 0, 216, 0, [[0, '#b9b4ab'], [0.3, '#8f8a82'], [0.7, '#5f5b56'], [1, '#34312e']]); x.fill();
    x.save(); x.clip();
    const r = rng(5);
    for (let i = 0; i < 1300; i++) { const px = -220 + r() * 440, py = -10 + r() * 300, rr = 0.6 + r() * 2.2; x.fillStyle = r() < 0.5 ? `rgba(25,22,20,${0.25 + r() * 0.3})` : `rgba(235,230,220,${0.15 + r() * 0.25})`; x.beginPath(); x.arc(px, py, rr, 0, TAU); x.fill(); }
    x.fillStyle = lgr(x, 0, 60, 0, 280, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(10,6,4,0.45)']]); x.fillRect(-230, 0, 460, 300);
    x.restore();
    // rim top ring
    ell(x, 0, 0, 200, ry); x.fillStyle = lgr(x, -200, -ry, 200, ry, [[0, '#d9d4ca'], [0.5, '#a7a299'], [1, '#6e6a63']]); x.fill();
    x.save(); ell(x, 0, 0, 200, ry); x.clip(); const r2 = rng(9);
    for (let i = 0; i < 420; i++) { const a = r2() * TAU, rr = 150 + r2() * 50; x.fillStyle = r2() < 0.5 ? 'rgba(30,26,24,0.35)' : 'rgba(250,245,235,0.3)'; x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.42, 0.7 + r2() * 1.6, 0, TAU); x.fill(); }
    x.restore();
    // cavity
    ell(x, 0, 6, 152, 62); x.fillStyle = rgr(x, -40, 40, 10, 0, 10, 170, [[0, '#7c7770'], [0.6, '#4a4642'], [1, '#2a2725']]); x.fill();
    x.strokeStyle = 'rgba(255,245,225,0.35)'; x.lineWidth = 2.5; x.beginPath(); x.ellipse(0, 6, 153, 63, 0, 0.1, PI - 0.1); x.stroke();
    x.save(); x.globalCompositeOperation = 'screen'; x.strokeStyle = 'rgba(255,210,150,0.5)'; x.lineWidth = 4;
    x.beginPath(); x.ellipse(0, 0, 199, 83, 0, PI + 0.3, TAU - 0.9); x.stroke(); x.restore();
  });
}
const CHIPS = (() => { const r = rng(33), a = []; for (let i = 0; i < 30; i++) { const ang = r() * TAU, rr = Math.sqrt(r()) * 0.9; a.push({ u: Math.cos(ang) * rr, v: Math.sin(ang) * rr, rot: r() * PI, z: r(), d: r() * 0.22, sc: 0.85 + r() * 0.35 }); } return a.sort((p, q) => p.v - q.v); })();
function mortar(ctx, x, y, s, o = {}) {
  const leaves = o.leaves ?? 1, mash = clamp(o.mash || 0), t = o.t || 0;
  at(ctx, x, y, 0, s, s, () => {
    ctx.drawImage(mortarBody(), -260, -100);
    // contents (clipped to the cavity)
    ctx.save(); ell(ctx, 0, 6, 150, 61); ctx.clip();
    if (mash > 0) {
      ctx.globalAlpha = clamp(mash * 1.6);
      ell(ctx, 0, 34, 132, 44); ctx.fillStyle = rgr(ctx, -30, 24, 4, 0, 34, 140, [[0, '#4f9a32'], [0.6, '#2c6a22'], [1, '#163f14']]); ctx.fill();
      const r = rng(71); ctx.lineCap = 'round';
      for (let i = 0; i < 70; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * 120, px = Math.cos(a) * rr, py = 34 + Math.sin(a) * rr * 0.34; ctx.strokeStyle = r() < 0.4 ? 'rgba(170,225,110,0.55)' : 'rgba(20,60,18,0.6)'; ctx.lineWidth = 1 + r() * 2.2; const aa = r() * PI; ctx.beginPath(); ctx.moveTo(px - Math.cos(aa) * 9, py - Math.sin(aa) * 3); ctx.lineTo(px + Math.cos(aa) * 9, py + Math.sin(aa) * 3); ctx.stroke(); }
      // juice gloss
      ctx.globalAlpha = clamp(mash * 1.2) * 0.8; ell(ctx, -28, 30, 60, 10, -0.08); ctx.fillStyle = 'rgba(200,255,170,0.35)'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const c of CHIPS) {
      const land = o.drop ? o.drop(c) : leaves; if (land <= 0) continue;
      const fallY = (1 - land) * -520;
      const px = c.u * 112, py = 28 + c.v * 40 - c.z * 16 + fallY + (mash * 10);
      if (fallY < -1) continue;
      leafChip(ctx, px, py, c.sc * (1 - mash * 0.35), c.rot + mash * 0.4, { mash });
    }
    ctx.restore();
    // falling chips (outside the clip)
    if (o.drop) for (const c of CHIPS) { const land = o.drop(c); if (land <= 0 || land >= 0.999) continue; const px = c.u * 112, py = 28 + c.v * 40 + (1 - land) * -520; leafChip(ctx, px, py, c.sc, c.rot + (1 - land) * 4, {}); }
  });
  return { rim: [x, y], surf: [x, y + (34 - (o.leaves ? 6 : 0)) * s] };
}

// ------------------------------------------------------------------ cloth bundle (squeezing)
function clothBundle(ctx, x, y, s, o = {}) {
  const sq = clamp(o.sq || 0), st = clamp(o.stain ?? 0.5), t = o.t || 0, tw = o.twist || 0;
  const rx = 128 * (1 - 0.2 * sq), ry = 132 * (1 - 0.08 * sq) + 6 * sq;
  at(ctx, x, y, 0, s, s, () => {
    // twisted neck
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-34, -96); ctx.bezierCurveTo(-22, -180, -18, -330, -22, -760); ctx.lineTo(22, -760); ctx.bezierCurveTo(18, -330, 22, -180, 34, -96); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -30, 0, 30, 0, [[0, '#fbf6e6'], [0.45, '#e2d8bc'], [1, '#a99c7c']]); ctx.fill(); ctx.clip();
    // twist grooves (soft diagonal)
    for (let i = -2; i < 30; i++) {
      const yy = -100 - i * 24 + ((tw * 60) % 24);
      ctx.strokeStyle = 'rgba(110,95,60,0.22)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-34, yy + 14); ctx.quadraticCurveTo(0, yy, 34, yy - 18); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,252,238,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, yy + 6); ctx.quadraticCurveTo(0, yy - 8, 34, yy - 26); ctx.stroke();
    }
    ctx.fillStyle = lgr(ctx, 0, -100, 0, -200, [[0, `rgba(70,140,40,${0.45 * st})`], [1, 'rgba(70,140,40,0)']]); ctx.fillRect(-40, -200, 80, 110);
    ctx.restore();
    // ball (teardrop, pinched into the neck)
    ctx.beginPath(); ctx.moveTo(-26, -ry * 0.8);
    ctx.bezierCurveTo(-rx * 0.55, -ry * 0.62, -rx * 1.06, -ry * 0.05, -rx * 0.95, ry * 0.45);
    ctx.bezierCurveTo(-rx * 0.8, ry * 1.0, rx * 0.8, ry * 1.0, rx * 0.95, ry * 0.45);
    ctx.bezierCurveTo(rx * 1.06, -ry * 0.05, rx * 0.55, -ry * 0.62, 26, -ry * 0.8); ctx.closePath();
    ctx.fillStyle = rgr(ctx, -rx * 0.35, -ry * 0.2, 10, 0, ry * 0.1, rx * 1.3, [[0, '#fffaf0'], [0.55, '#e4dac0'], [1, '#9f9274']]); ctx.fill();
    ctx.save(); ctx.clip();
    // green pulp pressing through the wet cloth (mottled)
    ctx.fillStyle = lgr(ctx, 0, -ry, 0, ry, [[0, `rgba(80,150,50,${0.1 * st})`], [0.55, `rgba(60,140,40,${0.45 * st})`], [1, `rgba(30,100,30,${0.85 * st})`]]); ctx.fillRect(-rx * 1.2, -ry, rx * 2.4, ry * 2.2);
    const rb = rng(21);
    for (let i = 0; i < 26; i++) { const px = (rb() - 0.5) * rx * 1.8, py = (rb() - 0.2) * ry * 1.2, rr = 14 + rb() * 26; ctx.fillStyle = rgr(ctx, px, py, 0, px, py, rr, [[0, `rgba(40,115,30,${0.35 * st * (0.4 + (py + ry) / (2 * ry))})`], [1, 'rgba(40,115,30,0)']]); ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill(); }
    // fine weave
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; for (let i = -rx * 1.2; i < rx * 1.2; i += 6) { ctx.beginPath(); ctx.moveTo(i, -ry); ctx.lineTo(i + 10, ry); ctx.stroke(); }
    // a few soft gathered wrinkles running from the pinch
    const rf = rng(9);
    for (let i = 0; i < 6; i++) {
      const sx = (rf() - 0.5) * 30, a = (rf() - 0.5) * 2.2, ex = Math.sin(a) * rx * 0.9, ey = -ry * 0.1 + Math.cos(a) * ry * 0.45 * rf();
      const mx = ex * 0.4 + (rf() - 0.5) * 30, my = -ry * 0.5;
      ctx.strokeStyle = 'rgba(80,65,40,0.16)'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, -ry * 0.78); ctx.quadraticCurveTo(mx + Math.sin(t * 2 + i) * 2, my, ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,252,240,0.3)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx - 7, -ry * 0.78); ctx.quadraticCurveTo(mx - 8, my, ex - 8, ey - 3); ctx.stroke();
    }
    // bottom wet darkening
    ctx.fillStyle = lgr(ctx, 0, ry * 0.3, 0, ry, [[0, 'rgba(20,60,20,0)'], [1, `rgba(20,60,20,${0.35 * st})`]]); ctx.fillRect(-rx * 1.2, 0, rx * 2.4, ry * 1.2);
    ctx.restore();
    // juice beads on the wet bottom
    const r = rng(12);
    for (let i = 0; i < 14; i++) {
      const a = PI * (0.18 + r() * 0.64), px = Math.cos(a) * rx * 0.8, py = Math.sin(a) * ry * 0.9, rr = (3 + r() * 5) * (0.4 + st);
      ell(ctx, px, py, rr * 0.8, rr); ctx.fillStyle = rgr(ctx, px - rr * 0.3, py - rr * 0.3, 0, px, py, rr, [[0, '#d8ffb0'], [0.4, JUICE.L], [1, JUICE.D]]); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,255,240,0.35)'; ell(ctx, -rx * 0.45, -ry * 0.25, rx * 0.22, ry * 0.12, -0.6); ctx.fill(); ctx.restore();
  });
  return { bottom: [x, y + ry * 0.98 * s] };
}

// ------------------------------------------------------------------ porcelain bowl
function liquidFill(ctx, cx, cy, rx, ry, liq, t) {
  const col = liq === 'juice' ? [JUICE.L, JUICE.M, JUICE.D] : liq === 'oil' ? ['#fff0b0', '#e8b83a', '#a8741a'] : liq === 'milk' ? ['#fffdf6', '#f1ead8', '#cfc4aa'] : [BATTER.L, BATTER.M, BATTER.D];
  ell(ctx, cx, cy, rx, ry);
  ctx.fillStyle = rgr(ctx, cx - rx * 0.25, cy - ry * 0.2, rx * 0.05, cx, cy, rx * 1.05, [[0, col[0]], [0.55, col[1]], [1, col[2]]]); ctx.fill();
}
function bowl(ctx, x, y, s, o = {}) {
  const ryr = o.ryr ?? 0.45, c = Math.sqrt(Math.max(0, 1 - ryr * ryr)), R = 200, D = 110, f = clamp(o.fill ?? 0), t = o.t || 0;
  const ret = {};
  at(ctx, x, y, 0, s, s, () => {
    const by = D * c, fr = 84;
    // table shadow
    ctx.fillStyle = 'rgba(30,12,4,0.32)'; ell(ctx, 18, by + 8, R * 0.95, R * ryr * 0.75 + 12); ctx.fill();
    // outer body (front)
    if (c > 0.05) {
      ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R * 0.98, by * 0.7, -fr * 1.3, by * 0.98, -fr, by);
      ctx.ellipse(0, by, fr, fr * ryr, 0, PI, 0, true);
      ctx.bezierCurveTo(fr * 1.3, by * 0.98, R * 0.98, by * 0.7, R, 0); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI, false); ctx.closePath();
      ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#ffffff'], [0.4, '#eef0f2'], [0.8, '#c3c8d2'], [1, '#8f96a6']]); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(40,80,170,0.85)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(0, 16 * c, R * 0.985, R * ryr, 0, 0.05, PI - 0.05); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 28 * c, R * 0.95, R * ryr * 0.97, 0, 0.1, PI - 0.1); ctx.stroke();
      // brush-painted bamboo leaves
      ctx.strokeStyle = 'rgba(40,80,170,0.6)'; ctx.lineCap = 'round';
      for (const [px, a] of [[-120, -0.5], [-95, -0.9], [70, 0.4], [100, 0.9], [-10, -0.2]]) { ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(px, 50 * c + R * ryr * 0.5); ctx.quadraticCurveTo(px + Math.cos(a) * 20, 50 * c + R * ryr * 0.5 + 10, px + Math.cos(a) * 34, 50 * c + R * ryr * 0.5 + 24 * Math.sin(a + 1.2)); ctx.stroke(); }
      ctx.fillStyle = lgr(ctx, 0, by * 0.4, 0, by, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(40,30,30,0.25)']]); ctx.fillRect(-R, 0, R * 2, by + 60);
      ctx.restore();
    }
    // interior
    ell(ctx, 0, 0, R, R * ryr); ctx.fillStyle = rgr(ctx, -R * 0.3, -R * ryr * 0.4, 10, 0, 0, R * 1.1, [[0, '#ffffff'], [0.7, '#e6e8ec'], [1, '#b9bec9']]); ctx.fill();
    ctx.save(); ell(ctx, 0, 0, R - 5, (R - 5) * ryr); ctx.clip();
    // inner wall shading (back wall lit, front wall darker toward the floor)
    ctx.fillStyle = rgr(ctx, 0, D * c * 0.6, R * 0.2, 0, D * c * 0.6, R * 1.05, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(60,70,90,0.22)']]); ctx.fillRect(-R, -R, R * 2, R * 2);
    if (f > 0 && o.liq) {
      const rs = R * lerp(0.42, 0.93, f), cy = (1 - f) * D * c * 0.95, rys = rs * ryr;
      ret.surf = [x + 0, y + cy * s]; ret.rs = rs * s; ret.ryr = ryr;
      if (o.contents) {
        ctx.save(); ell(ctx, 0, cy, rs, rys); ctx.clip(); o.contents(ctx, 0, cy, rs, ryr);
        // depth: soft inner shadow at the liquid edge + the rim's shadow falling on the upper-left
        ctx.fillStyle = rgr(ctx, 0, cy, rs * 0.72, 0, cy, rs, [[0, 'rgba(50,35,20,0)'], [1, 'rgba(50,35,20,0.28)']]); ctx.fillRect(-rs, cy - rs, rs * 2, rs * 2);
        ctx.beginPath(); ctx.ellipse(0, cy, rs + 2, rys + 2, 0, 0, TAU); ctx.ellipse(rs * 0.06, cy + rys * 0.06, rs * 0.97, rys * 0.97, 0, 0, TAU, true);
        ctx.fillStyle = 'rgba(50,35,20,0.18)'; ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(255,255,240,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, cy, rs - 3, rys - 3, 0, 0.2, PI - 0.2); ctx.stroke();
        ctx.restore();
      }
      else {
        liquidFill(ctx, 0, cy, rs, rys, o.liq, t);
        // meniscus + reflection
        ctx.strokeStyle = 'rgba(255,255,240,0.35)'; ctx.lineWidth = 3; ell(ctx, 0, cy, rs - 2, rys - 2); ctx.stroke();
        ctx.save(); ell(ctx, 0, cy, rs, rys); ctx.clip();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(255,255,235,0.4)'; ell(ctx, -rs * 0.3, cy - rys * 0.42, rs * 0.42, rys * 0.13, -0.12); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,200,0.18)'; ell(ctx, rs * 0.2, cy + rys * 0.3, rs * 0.5, rys * 0.3); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        for (const [t0, u, v] of (o.rip || [])) {
          const a = t - t0; if (a < 0 || a > 1.2) continue;
          for (let k = 0; k < 3; k++) { const aa = a - k * 0.12; if (aa <= 0) continue; const rr = aa * 220; ctx.strokeStyle = `rgba(230,255,200,${0.32 * (1 - a / 1.2)})`; ctx.lineWidth = 3; ell(ctx, u * rs * 0.6, cy + v * rys * 0.6, rr, rr * ryr); ctx.stroke(); }
        }
        ctx.restore();
      }
    }
    ctx.restore();
    // rim lip
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 7; ell(ctx, 0, 0, R - 2, (R - 2) * ryr); ctx.stroke();
    ctx.strokeStyle = 'rgba(40,80,170,0.8)'; ctx.lineWidth = 2.5; ell(ctx, 0, 0, R + 1.5, (R + 1.5) * ryr); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,130,150,0.35)'; ctx.lineWidth = 2; ell(ctx, 0, 0, R - 9, (R - 9) * ryr); ctx.stroke();
  });
  return ret;
}

// ------------------------------------------------------------------ mould (khuôn bánh bò, fluted aluminium)
const NF = 16;
const mR = (th) => 1 - 0.035 * (1 - Math.cos(NF * th));
function mouldPath(ctx, R, ryr, z, rf, c, th0 = 0, th1 = TAU, move = true) {
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const th = lerp(th0, th1, i / n), r = R * rf * mR(th);
    const px = Math.cos(th) * r, py = Math.sin(th) * r * ryr - z * c;
    if (i === 0 && move) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
}
function mould(ctx, x, y, s, o = {}) {
  const ryr = o.ryr ?? 0.5, c = Math.sqrt(Math.max(0, 1 - ryr * ryr)), R = 300, D = 150, FR = 0.74, t = o.t || 0;
  const f = clamp(o.fill || 0), oil = clamp(o.oil || 0), ret = { R: R * s };
  at(ctx, x, y, 0, s, s, () => {
    // shadow
    ctx.fillStyle = 'rgba(25,10,4,0.4)'; ell(ctx, 16, D * c + 10, R * 0.95, R * ryr * 0.8 + 14); ctx.fill();
    // outside wall (front half) with flutes
    ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 1, c, 0, PI); mouldPath(ctx, R, ryr, -D, FR, c, PI, 0, false); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#f2f4f6'], [0.25, '#c9ced3'], [0.6, '#8b9299'], [1, '#4d535a']]); ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < NF; i++) {
      const a0 = i / NF * TAU, a1 = (i + 0.5) / NF * TAU; if (Math.sin((a0 + a1) / 2) < -0.1) continue;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * R, Math.sin(a0) * R * ryr); ctx.lineTo(Math.cos(a1) * R * 0.965, Math.sin(a1) * R * ryr * 0.965);
      ctx.lineTo(Math.cos(a1) * R * FR * 0.965, Math.sin(a1) * R * FR * ryr + D * c); ctx.lineTo(Math.cos(a0) * R * FR, Math.sin(a0) * R * FR * ryr + D * c); ctx.closePath();
      ctx.fillStyle = Math.cos(a0) < 0.2 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)'; ctx.fill();
    }
    ctx.fillStyle = lgr(ctx, 0, R * ryr * 0.3, 0, R * ryr + D * c, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(20,14,10,0.35)']]); ctx.fillRect(-R, 0, R * 2, R + D);
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,170,90,0.18)'; ctx.fillRect(-R, 0, R * 0.6, R + D);
    ctx.restore();
    // interior
    ctx.save(); ctx.beginPath(); mouldPath(ctx, R * 0.985, ryr, 0, 1, c); ctx.closePath(); ctx.clip();
    ctx.fillStyle = lgr(ctx, 0, -R * ryr, 0, R * ryr + D * c, [[0, '#7d848c'], [0.5, '#a9b0b7'], [1, '#d8dce0']]); ctx.fillRect(-R, -R, R * 2, R * 2 + D);
    // back inner wall flutes
    for (let i = 0; i < NF; i++) {
      const a0 = i / NF * TAU, a1 = (i + 0.5) / NF * TAU; if (Math.sin((a0 + a1) / 2) > 0.15) continue;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a0) * R, Math.sin(a0) * R * ryr); ctx.lineTo(Math.cos(a1) * R * 0.965, Math.sin(a1) * R * ryr * 0.965);
      ctx.lineTo(Math.cos(a1) * R * FR * 0.965, Math.sin(a1) * R * FR * ryr + D * c); ctx.lineTo(Math.cos(a0) * R * FR, Math.sin(a0) * R * FR * ryr + D * c); ctx.closePath();
      ctx.fillStyle = Math.cos(a0) < 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'; ctx.fill();
    }
    // floor
    ctx.beginPath(); mouldPath(ctx, R, ryr, -D, FR, c); ctx.closePath();
    ctx.fillStyle = rgr(ctx, -R * 0.2, D * c - R * ryr * 0.2, 4, 0, D * c, R * FR * 1.1, [[0, '#eef0f2'], [0.7, '#bcc2c8'], [1, '#8d949b']]); ctx.fill();
    // oil sheen (swept angle)
    if (oil > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const a1 = PI + oil * TAU * 1.05;
      for (let i = 0; i < 40; i++) {
        const th = PI + i / 40 * TAU; if (th > a1) break;
        const g = 0.25 + 0.2 * Math.sin(i * 2.7);
        ctx.strokeStyle = `rgba(255,205,110,${g})`; ctx.lineWidth = 5;
        const r0 = R * mR(th), r1 = R * FR * mR(th);
        ctx.beginPath(); ctx.moveTo(Math.cos(th) * r0 * 0.95, Math.sin(th) * r0 * ryr * 0.95); ctx.lineTo(Math.cos(th) * r1, Math.sin(th) * r1 * ryr + D * c); ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,200,110,${0.22 * clamp(oil * 1.4 - 0.4)})`; ctx.beginPath(); mouldPath(ctx, R, ryr, -D, FR * 0.95, c); ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,250,220,${0.5 * clamp(oil * 1.4 - 0.4)})`; ell(ctx, -R * 0.25, D * c - R * ryr * 0.25, R * 0.18, R * ryr * 0.05, -0.1); ctx.fill();
      ctx.restore();
    }
    // batter
    if (f > 0) {
      const z = -D * (1 - f), rf = lerp(FR, 0.97, f), cy = -z * c;
      ret.surf = [x, y + cy * s]; ret.rs = R * rf * s;
      ctx.beginPath(); mouldPath(ctx, R, ryr, z, rf, c); ctx.closePath();
      ctx.fillStyle = rgr(ctx, -R * 0.3, cy - R * ryr * 0.3, 8, 0, cy, R * rf * 1.05, [[0, '#d9f29e'], [0.5, BATTER.M], [1, BATTER.DD]]); ctx.fill();
      ctx.save(); ctx.clip();
      if (o.surface) o.surface(ctx, 0, cy, R * rf, ryr);
      // micro bubbles
      const r = rng(4);
      for (let i = 0; i < 70; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * R * rf * 0.95, bx = Math.cos(a) * rr, by = cy + Math.sin(a) * rr * ryr, br = 1 + r() * 3.5; ctx.fillStyle = 'rgba(240,255,210,0.5)'; ell(ctx, bx, by, br, br * Math.max(0.5, ryr)); ctx.fill(); ctx.fillStyle = 'rgba(60,100,30,0.3)'; ell(ctx, bx + br * 0.3, by + br * 0.3, br * 0.6, br * 0.6 * ryr); ctx.fill(); }
      for (const [t0, u, v, amp] of (o.ripple || [])) { const a = t - t0; if (a < 0 || a > 1) continue; for (let k = 0; k < 3; k++) { const aa = a - k * 0.1; if (aa <= 0) continue; const rr = aa * 380; ctx.strokeStyle = `rgba(240,255,200,${(amp || 0.5) * (1 - a)})`; ctx.lineWidth = 3; ell(ctx, u * R, cy + v * R * ryr, rr, rr * ryr); ctx.stroke(); } }
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,255,230,0.45)'; ell(ctx, -R * rf * 0.35, cy - R * rf * ryr * 0.4, R * rf * 0.38, R * rf * ryr * 0.09, -0.1); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,150,0.16)'; ell(ctx, R * 0.2, cy + R * ryr * 0.25, R * 0.45, R * ryr * 0.3); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(60,95,30,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); mouldPath(ctx, R, ryr, z, rf, c); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    // rim lip
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#6a7179'; ctx.lineWidth = 10; ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 1, c); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = '#e9edf0'; ctx.lineWidth = 5; ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 1, c, PI * 0.95, PI * 1.95); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 1.005, c, 0.1, PI * 0.8); ctx.stroke();
  });
  ret.rim = [x, y];
  return ret;
}

// golden domed cake top inside the mould (mould drawn first)
const BLIST = (() => { const r = rng(91), a = []; for (let i = 0; i < 34; i++) { const ang = r() * TAU, rr = Math.sqrt(r()); a.push([Math.cos(ang) * rr, Math.sin(ang) * rr, 0.5 + r(), r()]); } return a; })();
function cakeTop(ctx, x, y, s, o = {}) {
  const ryr = o.ryr ?? 0.5, c = Math.sqrt(Math.max(0, 1 - ryr * ryr)), R = 300, cook = clamp(o.cook ?? 1), hd = (o.dome ?? 1) * 84;
  at(ctx, x, y, 0, s, s, () => {
    const top = mixc(mixc(BATTER.M, CRUST.L, clamp(cook * 2)), mixc(CRUST.L, CRUST.M, 0.45), clamp(cook * 2 - 1));
    const mid = mixc(mixc(BATTER.D, CRUST.M, clamp(cook * 2)), CRUST.D, clamp(cook * 2 - 1));
    const dark = mixc(mixc(BATTER.DD, CRUST.D, clamp(cook * 2)), CRUST.DD, clamp(cook * 2 - 1));
    const cy = -hd * c; // dome apex centre (lifted)
    // body: rim ellipse front arc + lifted back arc
    ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 0.975, c, 0, PI); mouldPath(ctx, R, ryr, hd * 0.55, 0.9, c, PI, TAU, false); ctx.closePath();
    ctx.fillStyle = rgr(ctx, -R * 0.25, cy - R * ryr * 0.3, 10, 0, cy * 0.4, R * 1.02, [[0, mixc(top, '#fff2c8', 0.4 * cook)], [0.4, top], [0.78, mid], [1, dark]]); ctx.fill();
    ctx.save(); ctx.clip();
    // caramelised patches (soft) + tiny pores
    for (const [u, v, sz, k] of BLIST) {
      const px = u * R * 0.85, py = cy * (1 - (u * u + v * v) * 0.6) + v * R * ryr * 0.85, rr = 22 * sz;
      ctx.fillStyle = rgr(ctx, px, py, 0, px, py, rr, [[0, `rgba(120,56,12,${(0.1 + k * 0.16) * cook})`], [1, 'rgba(120,56,12,0)']]); ell(ctx, px, py, rr, rr * Math.max(0.5, ryr)); ctx.fill();
      ctx.fillStyle = `rgba(90,40,10,${0.35 * cook})`; ell(ctx, px + 6, py + 2, 2.2, 1.6); ctx.fill();
    }
    // crack ring: a few lens-shaped splits showing the paler crumb
    const cr = R * 0.5, r = rng(7);
    const CP = []; for (let i = 0; i <= 120; i++) { const th = i / 120 * TAU, rr = cr * (1 + (r() - 0.5) * 0.03 + 0.035 * Math.sin(th * 5 + 1)); CP.push([Math.cos(th) * rr, cy * 0.92 + Math.sin(th) * rr * ryr, th]); }
    for (const [a0, a1, wd] of [[0.15, 1.75, 9], [2.25, 3.4, 6], [3.75, 5.85, 11]]) {
      const seg = CP.filter((p) => p[2] >= a0 && p[2] <= a1); if (seg.length < 3) continue;
      const lens = (wm, dy) => { ctx.beginPath(); seg.forEach((p, i) => { const w = Math.sin(i / (seg.length - 1) * PI) * wm; i ? ctx.lineTo(p[0], p[1] - w + dy) : ctx.moveTo(p[0], p[1] - w + dy); }); for (let i = seg.length - 1; i >= 0; i--) { const p = seg[i], w = Math.sin(i / (seg.length - 1) * PI) * wm * 0.7; ctx.lineTo(p[0], p[1] + w + dy); } ctx.closePath(); };
      lens(wd * 1.25, 2); ctx.fillStyle = `rgba(70,30,6,${0.45 * cook})`; ctx.fill();
      lens(wd * 0.8, 1); ctx.fillStyle = mixc(BATTER.M, '#cdb866', cook * 0.75); ctx.fill();
      lens(wd * 0.35, 3); ctx.fillStyle = mixc(BATTER.D, '#a89040', cook * 0.6); ctx.fill();
      ctx.strokeStyle = `rgba(255,226,160,${0.6 * cook})`; ctx.lineWidth = 2.5; ctx.beginPath(); seg.forEach((p, i) => { const w = Math.sin(i / (seg.length - 1) * PI) * wd * 1.25; i ? ctx.lineTo(p[0], p[1] - w - 1) : ctx.moveTo(p[0], p[1] - w - 1); }); ctx.stroke();
    }
    // darker caramel toward the fluted edge
    ctx.fillStyle = rgr(ctx, 0, cy * 0.6, R * 0.55, 0, cy * 0.6, R, [[0, 'rgba(0,0,0,0)'], [1, `rgba(80,32,6,${0.4 * cook})`]]); ctx.fillRect(-R, -R, R * 2, R * 2);
    // gloss: broad sheen + specular streak + glints
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgr(ctx, -R * 0.3, cy - R * ryr * 0.3, 0, -R * 0.3, cy - R * ryr * 0.3, R * 0.45, [[0, 'rgba(255,230,170,0.4)'], [1, 'rgba(255,230,170,0)']]); ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.fillStyle = 'rgba(255,250,225,0.6)'; ell(ctx, -R * 0.36, cy - R * ryr * 0.38, R * 0.14, R * ryr * 0.035, -0.12); ctx.fill();
    for (let i = 0; i < 12; i++) { const a = r() * TAU, rr = r() * R * 0.8; ctx.fillStyle = 'rgba(255,250,230,0.55)'; ell(ctx, Math.cos(a) * rr, cy * 0.7 + Math.sin(a) * rr * ryr, 2.5, 1.6); ctx.fill(); }
    ctx.restore();
    // mould rim lip back over the cake's front edge
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(60,28,8,0.5)'; ctx.lineWidth = 8; ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 0.965, c, 0.02, PI - 0.02); ctx.stroke();
    ctx.strokeStyle = '#6a7179'; ctx.lineWidth = 10; ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 1, c, -0.05, PI + 0.05); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); mouldPath(ctx, R, ryr, 0, 1.005, c, 0.1, PI * 0.8); ctx.stroke();
  });
}

// ------------------------------------------------------------------ coals, brazier, lid
function coalSprite(seed) {
  return cache('coal' + seed, 100, 80, (x) => {
    const r = rng(seed); x.translate(50, 40);
    x.beginPath(); const n = 9; for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = (0.75 + r() * 0.35); const px = Math.cos(a) * 42 * rr, py = Math.sin(a) * 30 * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath();
    x.fillStyle = rgr(x, -12, -12, 2, 0, 0, 50, [[0, '#4a3a34'], [0.6, '#241a17'], [1, '#100a08']]); x.fill();
    x.save(); x.clip(); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 1.5; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(-40 + r() * 80, -30); x.lineTo(-40 + r() * 80, 30); x.stroke(); } x.restore();
  });
}
function coalHotSprite(seed) {
  return cache('coalH' + seed, 100, 80, (x) => {
    const r = rng(seed); x.translate(50, 40);
    x.beginPath(); const n = 9; for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = (0.75 + r() * 0.35); const px = Math.cos(a) * 42 * rr, py = Math.sin(a) * 30 * rr; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath();
    x.save(); x.clip();
    x.fillStyle = rgr(x, -10, -14, 2, 0, 0, 50, [[0, '#4a3e3a'], [0.6, '#221816'], [1, '#120b09']]); x.fillRect(-50, -40, 100, 80);
    x.fillStyle = rgr(x, 0, 34, 4, 0, 30, 46, [[0, 'rgba(255,214,110,1)'], [0.4, 'rgba(255,120,30,0.9)'], [1, 'rgba(200,40,10,0)']]); x.fillRect(-50, -40, 100, 80);
    for (let i = 0; i < 3; i++) { const px = -26 + r() * 52, py = -8 + r() * 20; x.fillStyle = rgr(x, px, py, 0, px, py, 9, [[0, 'rgba(255,190,80,0.95)'], [1, 'rgba(255,90,20,0)']]); x.beginPath(); x.arc(px, py, 9, 0, TAU); x.fill(); }
    x.restore();
  });
}
function coal(ctx, x, y, s, rot, o = {}) {
  const seed = (o.seed || 1) % 6, heat = clamp(o.heat ?? 0.8), ash = clamp(o.ash || 0);
  at(ctx, x, y, rot, s, s, () => {
    ctx.drawImage(coalSprite(seed + 1), -50, -40);
    if (heat > 0) { ctx.globalAlpha = heat; ctx.drawImage(coalHotSprite(seed + 1), -50, -40); ctx.globalAlpha = 1; }
    if (ash > 0) { ctx.globalAlpha = ash * 0.85; ctx.fillStyle = '#b8b0a8'; ell(ctx, -6, -12, 30, 12); ctx.fill(); ctx.globalAlpha = 1; }
  });
}
function brazierBody(ryr) {
  return cache('braz' + ryr, 900, 760, (x) => {
    x.translate(450, 160);
    const c = Math.sqrt(1 - ryr * ryr), R = 270, Hh = 430;
    x.fillStyle = 'rgba(20,8,4,0.5)'; ell(x, 30, Hh * c + 20, 380, 90); x.fill();
    x.beginPath(); x.moveTo(-R, 0); x.bezierCurveTo(-R - 90, Hh * c * 0.35, -R - 60, Hh * c * 0.8, -230, Hh * c);
    x.ellipse(0, Hh * c, 230, 230 * ryr, 0, PI, 0, true);
    x.bezierCurveTo(R + 60, Hh * c * 0.8, R + 90, Hh * c * 0.35, R, 0); x.ellipse(0, 0, R, R * ryr, 0, 0, PI, false); x.closePath();
    x.fillStyle = lgr(x, -R - 90, 0, R + 90, 0, [[0, '#e0956a'], [0.3, '#b8643c'], [0.7, '#86422a'], [1, '#4a2216']]); x.fill();
    x.save(); x.clip();
    const r = rng(15);
    // soot near the rim, cracks, texture
    x.fillStyle = lgr(x, 0, 0, 0, 140, [[0, 'rgba(30,14,8,0.7)'], [1, 'rgba(30,14,8,0)']]); x.fillRect(-500, -10, 1000, 150);
    for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? `rgba(60,25,12,${0.1 + r() * 0.2})` : `rgba(255,200,150,${0.06 + r() * 0.1})`; x.beginPath(); x.arc(-380 + r() * 760, r() * 480, 0.8 + r() * 2.5, 0, TAU); x.fill(); }
    x.strokeStyle = 'rgba(50,20,10,0.5)'; x.lineWidth = 2;
    for (let i = 0; i < 6; i++) { let px = -300 + r() * 600, py = 60 + r() * 200; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (r() - 0.5) * 40; py += 14 + r() * 16; x.lineTo(px, py); } x.stroke(); }
    // band rings
    x.strokeStyle = 'rgba(70,30,15,0.45)'; x.lineWidth = 5; for (const yy of [70, 300]) { x.beginPath(); x.ellipse(0, yy * c, R + 60 * Math.sin(yy / Hh * PI) + 30, (R + 60) * ryr, 0, 0.05, PI - 0.05); x.stroke(); }
    // fire mouth (arched opening, front)
    x.beginPath(); x.moveTo(-115, Hh * c - 20); x.lineTo(-115, Hh * c * 0.62); x.quadraticCurveTo(-110, Hh * c * 0.35, 0, Hh * c * 0.33); x.quadraticCurveTo(110, Hh * c * 0.35, 115, Hh * c * 0.62); x.lineTo(115, Hh * c - 20); x.closePath();
    x.fillStyle = '#140604'; x.fill();
    x.restore();
    // rim top (thick clay lip)
    ell(x, 0, 0, R, R * ryr); x.fillStyle = lgr(x, 0, -R * ryr, 0, R * ryr, [[0, '#7a3a22'], [1, '#c9784a']]); x.fill();
    ell(x, 0, 4, R - 34, (R - 34) * ryr); x.fillStyle = '#1a0806'; x.fill();
  });
}
function brazier(ctx, x, y, s, o = {}) {
  const ryr = o.ryr ?? 0.42, c = Math.sqrt(1 - ryr * ryr), Hh = 430, t = o.t || 0, g = o.glow ?? 1;
  const fl = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 5.3);
  at(ctx, x, y, 0, s, s, () => {
    ctx.drawImage(brazierBody(ryr), -450, -160);
    // glowing coals in the mouth
    ctx.save(); ctx.beginPath(); ctx.moveTo(-115, Hh * c - 20); ctx.lineTo(-115, Hh * c * 0.62); ctx.quadraticCurveTo(-110, Hh * c * 0.35, 0, Hh * c * 0.33); ctx.quadraticCurveTo(110, Hh * c * 0.35, 115, Hh * c * 0.62); ctx.lineTo(115, Hh * c - 20); ctx.closePath(); ctx.clip();
    ctx.fillStyle = rgr(ctx, 0, Hh * c - 40, 10, 0, Hh * c - 40, 200, [[0, `rgba(255,200,90,${g})`], [0.5, `rgba(230,80,20,${0.8 * g})`], [1, 'rgba(60,10,5,0)']]); ctx.fillRect(-130, 0, 260, Hh * c);
    for (let i = 0; i < 9; i++) coal(ctx, -95 + i * 24 + (i % 2) * 6, Hh * c - 30 - (i % 3) * 16, 0.55, i * 0.7, { seed: i, heat: g * (0.6 + 0.4 * Math.sin(t * 3 + i * 1.7)) });
    ctx.restore();
    L.glow(ctx, 0, Hh * c * 0.7, 260, 'rgba(255,110,30,1)', 0.5 * g * fl);
    L.glow(ctx, 0, Hh * c + 30, 340, 'rgba(255,90,20,1)', 0.25 * g * fl);
    NP.embers(ctx, t, 31, 10, -100, Hh * c * 0.4, 200, 200, { alpha: 0.8 * g });
  });
  return { top: [x, y] };
}
const LIDCOALS = (() => { const r = rng(44), a = []; for (let i = 0; i < 42; i++) { const ang = r() * TAU, rr = Math.sqrt(r()) * 0.82; a.push([Math.cos(ang) * rr, Math.sin(ang) * rr, r() * TAU, i % 6, 0.8 + r() * 0.5, r()]); } return a.sort((p, q) => p[1] - q[1]); })();
function ovenLid(ctx, x, y, s, o = {}) {
  const ryr = o.ryr ?? 0.42, c = Math.sqrt(1 - ryr * ryr), R = 330, t = o.t || 0, nc = clamp(o.coals ?? 1), ash = clamp(o.ash || 0);
  at(ctx, x, y, o.tilt || 0, s, s, () => {
    // lid rim/side
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.lineTo(-R, -14 * c); ctx.ellipse(0, -14 * c, R, R * ryr, 0, PI, 0, true); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#8a8580'], [0.4, '#4e4a46'], [1, '#22201e']]); ctx.fill();
    // domed top
    ell(ctx, 0, -14 * c, R, R * ryr); ctx.fillStyle = rgr(ctx, -R * 0.3, -14 * c - R * ryr * 0.4, 10, 0, -14 * c, R * 1.05, [[0, '#7a746e'], [0.6, '#45403c'], [1, '#2a2624']]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,150,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -14 * c, R - 2, R * ryr - 2, 0, PI * 1.05, PI * 1.7); ctx.stroke();
    // ash bed
    ell(ctx, 0, -18 * c, R * 0.86, R * ryr * 0.86); ctx.fillStyle = `rgba(120,110,104,${0.5 * nc})`; ctx.fill();
    // coals heap
    const n = Math.round(LIDCOALS.length * nc);
    for (let i = 0; i < LIDCOALS.length; i++) {
      const [u, v, rot, sd, sc, ph] = LIDCOALS[i]; if (i >= n) continue;
      const hgt = (1 - (u * u + v * v)) * 70 * (0.6 + 0.4 * ph);
      coal(ctx, u * R * 0.8, -18 * c + v * R * ryr * 0.8 - hgt * c, 0.7 * sc, rot, { seed: sd, heat: (1 - ash * 0.7) * (0.55 + 0.45 * Math.sin(t * 2.6 + ph * 9)), ash: ash * (0.4 + ph * 0.6) });
    }
    if (nc > 0) { L.glow(ctx, 0, -40 * c, R * 0.9, 'rgba(255,110,30,1)', 0.35 * nc * (1 - ash * 0.6)); NP.embers(ctx, t, 77, Math.round(12 * nc), -R * 0.6, -60 * c - 40, R * 1.2, 120, { alpha: 0.9 * (1 - ash * 0.6) }); }
    // hoop handle
    ctx.strokeStyle = '#2c2826'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, -14 * c - 70 * c, 46, 60, 0, PI, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,150,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -14 * c - 70 * c, 46, 60, 0, PI * 1.05, PI * 1.5); ctx.stroke();
  });
  return { handle: [x, y + (-14 - 130) * c * s] };
}

// ------------------------------------------------------------------ cutaway (s6)
const BUB = (() => { const r = rng(55), a = []; for (let i = 0; i < 50; i++) a.push({ u: (r() * 2 - 1) * 0.94, v: r(), w: 7 + r() * 15, len: r(), g: 0.75 + r() * 0.6, ph: r() * TAU, d: r() }); return a.sort((p, q) => q.w - p.w); })();
const MICRO = (() => { const r = rng(56), a = []; for (let i = 0; i < 60; i++) a.push([r() * 2 - 1, r(), 1.5 + r() * 3.5]); return a; })();
function cutStatic() {
  return cache('cutS2', 1400, 1100, (x) => {
    x.translate(700, 420); // mould rim centre
    // brazier interior under the mould
    x.beginPath(); x.moveTo(-268, 95); x.bezierCurveTo(-350, 200, -400, 380, -400, 680); x.lineTo(400, 680); x.bezierCurveTo(400, 380, 350, 200, 268, 95); x.closePath();
    x.fillStyle = rgr(x, 0, 380, 30, 0, 330, 460, [[0, '#6a2e18'], [0.55, '#3a1a10'], [1, '#160805']]); x.fill();
    // coal bed (dark base; the glow is animated on top)
    const r = rng(8);
    for (let i = 0; i < 34; i++) { const px = -300 + r() * 600, py = 330 + r() * 80 + Math.abs(px) * 0.12; x.save(); x.translate(px, py); x.rotate(r() * TAU); x.scale(0.95, 0.95); x.drawImage(coalSprite(1 + (i % 6)), -50, -40); x.restore(); }
    // cut clay walls
    for (const sg of [-1, 1]) {
      x.beginPath(); x.moveTo(sg * 268, 95); x.bezierCurveTo(sg * 350, 200, sg * 400, 380, sg * 400, 680); x.lineTo(sg * 480, 680); x.bezierCurveTo(sg * 480, 380, sg * 430, 190, sg * 340, 88); x.quadraticCurveTo(sg * 305, 78, sg * 268, 95); x.closePath();
      x.fillStyle = lgr(x, sg * 268, 0, sg * 480, 0, [[0, '#e8a982'], [0.5, '#cf8458'], [1, '#a65a36']]); x.fill();
      x.save(); x.clip(); const q = rng(sg > 0 ? 3 : 4);
      for (let i = 0; i < 420; i++) { x.fillStyle = q() < 0.5 ? 'rgba(100,45,22,0.28)' : 'rgba(255,225,190,0.22)'; x.beginPath(); x.arc(sg * (270 + q() * 210), 85 + q() * 600, 1 + q() * 2.6, 0, TAU); x.fill(); }
      x.fillStyle = lgr(x, sg * 268, 0, sg * 300, 0, [[0, 'rgba(30,10,5,0.55)'], [1, 'rgba(30,10,5,0)']]); x.fillRect(sg > 0 ? 260 : -300, 80, 40, 620);
      x.restore();
      x.strokeStyle = 'rgba(255,235,205,0.7)'; x.lineWidth = 3; x.beginPath(); x.moveTo(sg * 268, 95); x.quadraticCurveTo(sg * 305, 78, sg * 340, 88); x.stroke();
    }
  });
}
function cutaway(ctx, x, y, s, o = {}) {
  const t = o.t || 0, k = clamp(o.k || 0), cook = clamp(o.cook || 0), T = o.T || 0, ash = clamp(o.ash || 0);
  const R = 300, D = 150, FR = 0.74;
  const fl = 0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 4.1);
  at(ctx, x, y, 0, s, s, () => {
    ctx.drawImage(cutStatic(), -700, -420);
    // glowing coal bed (animated)
    const r = rng(8);
    for (let i = 0; i < 34; i++) { const px = -300 + r() * 600, py = 330 + r() * 80 + Math.abs(px) * 0.12, rr = r() * TAU; ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 3 + i); ctx.save(); ctx.translate(px, py); ctx.rotate(rr); ctx.scale(0.95, 0.95); ctx.drawImage(coalHotSprite(1 + (i % 6)), -50, -40); ctx.restore(); }
    ctx.globalAlpha = 1;
    L.glow(ctx, 0, 380, 420, 'rgba(255,110,30,1)', 0.6 * fl);
    L.glow(ctx, 0, 170, 300, 'rgba(255,140,50,1)', 0.25 * fl);
    NP.embers(ctx, t, 21, 12, -260, 200, 520, 160, { alpha: 0.8 });
    // heat shimmer rising to the mould floor, and falling from the lid
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const px = -240 + i * 60, ph = (t * 0.9 + i * 0.37) % 1;
      ctx.strokeStyle = `rgba(255,170,90,${0.4 * Math.sin(ph * PI)})`; ctx.lineWidth = 5;
      ctx.beginPath(); for (let k2 = 0; k2 < 8; k2++) { const yy = 320 - ph * 140 - k2 * 10; const xx = px + Math.sin(yy * 0.08 + t * 6) * 7; k2 ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
    }
    ctx.restore();
    // mould back inner wall (visible above the batter)
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(-R * FR, D); ctx.lineTo(R * FR, D); ctx.lineTo(R, 0); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#d5d9dd'], [0.5, '#9aa1a8'], [1, '#6d747b']]); ctx.fill();
    ctx.save(); ctx.clip(); for (let i = 0; i < 16; i++) { const px = -R + i * 40; ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; ctx.fillRect(px, 0, 20, D); } ctx.fillStyle = lgr(ctx, 0, 0, 0, D, [[0, 'rgba(255,150,70,0.25)'], [1, 'rgba(40,20,10,0.3)']]); ctx.fillRect(-R, 0, R * 2, D); ctx.restore();
    // batter cross-section
    const level = lerp(0.5, 1, ease.out(clamp(k * 1.4))), dome = clamp(k * 1.25 - 0.25) * 95;
    const topY = D - level * D, wAt = (yy) => lerp(R * FR, R, clamp((D - yy) / D));
    const yTop = (u) => topY - dome * (1 - u * u) * (1 - 0.06 * Math.sin(u * 6 + 1));
    const W0 = wAt(topY);
    const outline = () => { ctx.beginPath(); ctx.moveTo(-R * FR, D); ctx.lineTo(-W0, topY); for (let i = 0; i <= 48; i++) { const u = i / 48 * 2 - 1; ctx.lineTo(u * W0, yTop(u)); } ctx.lineTo(R * FR, D); ctx.closePath(); };
    ctx.save();
    outline();
    ctx.fillStyle = lgr(ctx, 0, topY - dome, 0, D, [[0, '#d6f09a'], [0.45, BATTER.M], [1, mixc(BATTER.M, BATTER.D, 0.35)]]); ctx.fill();
    ctx.clip();
    L.glow(ctx, -70, (topY + D) / 2 - 10, 300, 'rgba(230,255,170,0.7)', 0.35); // subsurface glow
    // honeycomb: bubbles stretch into tall tunnels
    for (const b of BUB) {
      const g = clamp(k * 1.35 * b.g - b.d * 0.15);
      if (g <= 0.02) continue;
      const xx = b.u * W0 * 0.96, yt = yTop(b.u), bottom = D - 6;
      const y0 = lerp(bottom, yt + 20, b.v * 0.55), maxL = (y0 - yt - 8) * (0.35 + 0.65 * b.len);
      const len = Math.max(b.w * 0.8, maxL * clamp(g * 1.2 - 0.15)), w = b.w * (0.45 + 0.55 * g);
      const y1 = y0 - len, N = 10, wob = (yy) => Math.sin(yy * 0.07 + b.ph) * 2.5 * g;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) { const yy = lerp(y0, y1, i / N), ww = w / 2 * (0.75 + 0.25 * Math.sin(i * 1.7 + b.ph)); i ? ctx.lineTo(xx - ww + wob(yy), yy) : ctx.moveTo(xx - ww + wob(yy), yy); }
      ctx.quadraticCurveTo(xx + wob(y1), y1 - w * 0.7, xx + w / 2 + wob(y1), y1);
      for (let i = N; i >= 0; i--) { const yy = lerp(y0, y1, i / N), ww = w / 2 * (0.75 + 0.25 * Math.cos(i * 1.3 + b.ph)); ctx.lineTo(xx + ww + wob(yy), yy); }
      ctx.quadraticCurveTo(xx + wob(y0), y0 + w * 0.7, xx - w / 2 * 0.75 + wob(y0), y0);
      ctx.closePath();
      ctx.fillStyle = lgr(ctx, xx - w / 2, 0, xx + w / 2, 0, [[0, '#3e6e20'], [0.5, BATTER.DD], [1, mixc(BATTER.D, BATTER.M, 0.3)]]); ctx.fill();
      ctx.strokeStyle = 'rgba(30,60,15,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(235,255,190,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(xx + w * 0.42 + wob(y0), y0 - 2); ctx.lineTo(xx + w * 0.42 + wob(y1), y1 + 3); ctx.stroke();
    }
    for (const [u, v, rr] of MICRO) { const xx = u * W0 * 0.95, yy = lerp(D - 4, yTop(u) + 6, v); ctx.fillStyle = 'rgba(70,115,35,0.6)'; ell(ctx, xx, yy, rr * (0.6 + k * 0.4), rr * (0.6 + k * 0.4)); ctx.fill(); ctx.fillStyle = 'rgba(240,255,210,0.6)'; ell(ctx, xx - rr * 0.3, yy - rr * 0.3, rr * 0.3, rr * 0.3); ctx.fill(); }
    // crust forming along the walls / floor / top
    const cw = cook * 14;
    if (cw > 0.5) { ctx.globalAlpha = clamp(cook * 2); ctx.lineJoin = 'round'; outline(); ctx.strokeStyle = mixc(BATTER.D, CRUST.D, cook); ctx.lineWidth = cw * 2; ctx.stroke(); outline(); ctx.strokeStyle = mixc(BATTER.D, CRUST.M, cook); ctx.lineWidth = cw; ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.restore();
    // top surface colour: green → gold → brown, with a glossy highlight
    const topC = mixc(mixc(BATTER.L, CRUST.L, clamp(cook * 1.8)), CRUST.D, clamp(cook * 1.8 - 0.8));
    ctx.strokeStyle = topC; ctx.lineWidth = 8 + cook * 10; ctx.lineCap = 'round';
    ctx.beginPath(); for (let i = 0; i <= 48; i++) { const u = i / 48 * 2 - 1; const q = [u * W0 * 0.985, yTop(u) + 3 + cook * 3]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,240,190,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); for (let i = 6; i <= 22; i++) { const u = i / 48 * 2 - 1; const q = [u * W0 * 0.97, yTop(u) - 2]; i > 6 ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); ctx.restore();
    // bubble pops on the surface
    for (const [i, tp] of (o.pops || []).entries()) {
      const a = T - tp; if (a < -0.25 || a > 0.6) continue;
      const u = [-0.55, 0.3, -0.15, 0.6, 0.05, -0.4][i % 6], xx = u * W0 * 0.9, yy = yTop(u);
      if (a < 0) { const rr = 8 + (a + 0.25) * 70; ell(ctx, xx, yy - rr * 0.5, rr, rr * 0.75); ctx.fillStyle = mixc(BATTER.L, topC, 0.5); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,230,0.75)'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, xx - rr * 0.35, yy - rr * 0.85, rr * 0.25, rr * 0.15); ctx.fill(); }
      else {
        const e = a / 0.6; ctx.strokeStyle = `rgba(255,250,220,${0.85 * (1 - e)})`; ctx.lineWidth = 3; ell(ctx, xx, yy - 4, 14 + e * 60, 5 + e * 14); ctx.stroke();
        L.flakes(ctx, T, tp, 300 + i, 9, xx, yy - 6, { colors: [BATTER.L, '#e8f5b0', topC], speed: 300, size: 4.5, life: 0.5, g: 900, spread: 1.6 });
        ctx.fillStyle = `rgba(70,110,30,${0.6 * (1 - e)})`; ell(ctx, xx, yy, 12, 5); ctx.fill();
      }
    }
    // mould profile (cut aluminium)
    ctx.strokeStyle = '#5c636a'; ctx.lineWidth = 10; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-R - 10, -5); ctx.lineTo(-R, 0); ctx.lineTo(-R * FR, D); ctx.lineTo(R * FR, D); ctx.lineTo(R, 0); ctx.lineTo(R + 10, -5); ctx.stroke();
    ctx.strokeStyle = '#eef1f3'; ctx.lineWidth = 3.5; ctx.stroke();
    // domed lid section resting on the mould rim, coals heaped on it
    const lidY = (u) => -8 - 150 * (1 - u * u);
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40 * 2 - 1; i ? ctx.lineTo(u * 330, lidY(u)) : ctx.moveTo(u * 330, lidY(u)); }
    for (let i = 40; i >= 0; i--) { const u = i / 40 * 2 - 1; ctx.lineTo(u * 330, lidY(u) + 13); } ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -160, 0, 0, [[0, '#7a746e'], [1, '#2a2624']]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,170,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40 * 2 - 1; i ? ctx.lineTo(u * 330, lidY(u)) : ctx.moveTo(u * 330, lidY(u)); } ctx.stroke();
    L.glow(ctx, 0, -190, 420, 'rgba(255,110,30,1)', 0.5 * fl * (1 - ash * 0.5));
    const rc = rng(13);
    for (let i = 0; i < 30; i++) { const u = (rc() * 2 - 1) * 0.86, layer = rc(); const py = lidY(u) - 18 - layer * 46 * (1 - u * u); coal(ctx, u * 330, py, 0.62 + rc() * 0.2, rc() * TAU, { seed: i, heat: (1 - ash * 0.7) * (0.55 + 0.45 * Math.sin(t * 2.5 + i * 2.1)), ash: ash * rc() }); }
    NP.embers(ctx, t, 91, 16, -260, -330, 520, 120, { alpha: 0.9 });
    // the warm air pocket under the lid
    L.glow(ctx, 0, -60, 280, 'rgba(255,190,110,1)', 0.12 * fl);
  });
}
// ------------------------------------------------------------------ banana-leaf brush, pour ribbon, misc tools
function leafBrush(ctx, x, y, s, rot = 0, o = {}) {
  const oil = clamp(o.oil ?? 1);
  at(ctx, x, y, rot, s, s, () => {
    // shredded strip tips (fan)
    for (let i = 0; i < 9; i++) {
      const a = lerp(-0.42, 0.42, i / 8), len = 70 + (i % 3) * 8;
      const x0 = lerp(-16, 16, i / 8), y0 = -70, x1 = x0 + Math.sin(a) * len, y1 = y0 + Math.cos(a) * len;
      ctx.strokeStyle = i % 2 ? '#6aa43e' : '#4f8a32'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 3, (y0 + y1) / 2, x1, y1); ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,120,${0.45 * oil})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0 - 2, y0 + 10); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2, x1 - 2, y1 - 3); ctx.stroke();
    }
    // folded handle
    ctx.beginPath(); ctx.moveTo(-24, -60); ctx.lineTo(-17, -240); ctx.quadraticCurveTo(0, -252, 17, -240); ctx.lineTo(24, -60); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -24, 0, 24, 0, [[0, '#a9cf6c'], [0.4, '#6fa646'], [1, '#2f6624']]); ctx.fill();
    ctx.strokeStyle = 'rgba(30,70,20,0.45)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-16 + i * 9, -64); ctx.lineTo(-12 + i * 7, -236); ctx.stroke(); }
    // string ties
    for (const yy of [-90, -200]) { ctx.fillStyle = '#d8c08a'; ctx.beginPath(); ctx.roundRect(-25, yy - 6, 50, 12, 4); ctx.fill(); ctx.strokeStyle = 'rgba(100,70,30,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-25, yy); ctx.lineTo(25, yy - 2); ctx.stroke(); }
  });
  const c = Math.cos(rot), n = Math.sin(rot);
  return { grip: [x + 160 * s * n, y - 160 * s * c] };
}
function ribbon(ctx, pts, w, o = {}) {
  const t = o.t || 0, col = o.col || 'batter';
  const C = col === 'juice' ? [JUICE.L, JUICE.M, JUICE.D] : col === 'milk' ? ['#ffffff', '#f3ecdc', '#cfc3a8'] : [BATTER.L, BATTER.M, BATTER.DD];
  const n = pts.length; if (n < 2) return;
  const S = []; for (let i = 0; i < n - 1; i++) for (let k = 0; k < 8; k++) { const u = k / 8; S.push([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]); } S.push(pts[n - 1]);
  for (let it = 0; it < 4; it++) for (let i = 1; i < S.length - 1; i++) S[i] = [(S[i - 1][0] + S[i][0] * 2 + S[i + 1][0]) / 4, (S[i - 1][1] + S[i][1] * 2 + S[i + 1][1]) / 4];
  const m = S.length, NR = S.map((p, i) => { const a = S[Math.max(0, i - 1)], b = S[Math.min(m - 1, i + 1)]; const an = Math.atan2(b[1] - a[1], b[0] - a[0]); return [-Math.sin(an), Math.cos(an)]; });
  const wid = (i) => { const u = i / (m - 1); return w * (o.taper ? lerp(1, 0.55, u) : lerp(1, 0.7, Math.sin(u * PI))) * (1 + 0.06 * Math.sin(u * 20 - t * 18)); };
  ctx.save();
  const path = (dx = 0, dy = 0) => {
    ctx.beginPath(); S.forEach((p, i) => { const q = [p[0] + NR[i][0] * wid(i) / 2 + dx, p[1] + NR[i][1] * wid(i) / 2 + dy]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
    for (let i = m - 1; i >= 0; i--) { const p = S[i]; ctx.lineTo(p[0] - NR[i][0] * wid(i) / 2 + dx, p[1] - NR[i][1] * wid(i) / 2 + dy); }
    ctx.closePath();
  };
  if (o.shadow) { path(o.shadow[0], o.shadow[1]); ctx.fillStyle = 'rgba(40,24,10,0.28)'; ctx.fill(); }
  path();
  const mid = S[Math.floor(m / 2)], nn = NR[Math.floor(m / 2)], ww = w / 2;
  ctx.fillStyle = lgr(ctx, mid[0] - nn[0] * ww, mid[1] - nn[1] * ww, mid[0] + nn[0] * ww, mid[1] + nn[1] * ww, [[0, C[0]], [0.45, C[1]], [1, C[2]]]); ctx.fill();
  ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,255,235,0.6)'; ctx.lineWidth = Math.max(1.5, w * 0.12); ctx.lineCap = 'round';
  ctx.beginPath(); S.forEach((p, i) => { const q = [p[0] - NR[i][0] * wid(i) * 0.22, p[1] - NR[i][1] * wid(i) * 0.22]; i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
  ctx.restore();
}
function alarmClock(ctx, x, y, s, o = {}) {
  const ring = clamp(o.ring || 0), t = o.t || 0, sh = ring * Math.sin(t * 90) * 0.08;
  at(ctx, x, y, sh, s, s, () => {
    ctx.fillStyle = 'rgba(20,8,4,0.35)'; ell(ctx, 6, 2, 80, 12); ctx.fill();
    ctx.strokeStyle = '#6a4a20'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-40, -30); ctx.lineTo(-58, 0); ctx.moveTo(40, -30); ctx.lineTo(58, 0); ctx.stroke();
    for (const sg of [-1, 1]) { const hx = sg * 46 + (sg * ring * Math.sin(t * 80) * 3); ell(ctx, hx, -150, 34, 30, sg * 0.5); ctx.fillStyle = rgr(ctx, hx - 10, -162, 2, hx, -150, 38, [[0, '#fff2b8'], [0.5, '#e0a63a'], [1, '#8a5a14']]); ctx.fill(); }
    ctx.strokeStyle = '#8a5a14'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -128); ctx.lineTo(Math.sin(t * 70) * 26 * ring, -168); ctx.stroke();
    ell(ctx, 0, -78, 72, 72); ctx.fillStyle = rgr(ctx, -24, -100, 4, 0, -78, 80, [[0, '#ffe39a'], [0.55, '#d0962e'], [1, '#7a4a10']]); ctx.fill();
    ell(ctx, 0, -78, 58, 58); ctx.fillStyle = rgr(ctx, -16, -96, 4, 0, -78, 62, [[0, '#ffffff'], [1, '#e8e0cc']]); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ell(ctx, Math.cos(a) * 48, -78 + Math.sin(a) * 48, 3, 3); ctx.fill(); }
    ctx.strokeStyle = '#2a1a10'; ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(0, -116); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(26, -70); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -24, -104, 16, 7, -0.6); ctx.fill();
    if (ring > 0) { ctx.strokeStyle = `rgba(255,236,170,${ring})`; ctx.lineWidth = 6; for (let i = 0; i < 3; i++) { const rr = 110 + i * 34 + ((t * 120) % 34); for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(0, -120, rr, sg > 0 ? -0.9 : PI - 0.3, sg > 0 ? -0.3 : PI + 0.3 - 0.6 + 0.6); ctx.stroke(); } } }
  });
}
// coconut-shell cup (gáo dừa) seen from above-ish, origin = cup centre, R 110, tilt 0..1 (pouring toward −x)
function coconutCup(ctx, x, y, s, rot, o = {}) {
  const fill = clamp(o.fill ?? 1);
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = 'rgba(20,8,4,0.25)'; ell(ctx, 14, 16, 112, 100); ctx.fill();
    // wooden handle
    tube(ctx, 90, 0, 330, 10, 26, 22, [[0, '#d39c62'], [0.5, '#9a6436'], [1, '#5a3418']]);
    ell(ctx, 0, 0, 110, 104); ctx.fillStyle = rgr(ctx, -30, -30, 6, 0, 0, 120, [[0, '#8a5a34'], [0.7, '#5a3418'], [1, '#2e1a0c']]); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,0.45)'; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 96, Math.sin(a) * 90); ctx.lineTo(Math.cos(a + 0.2) * 108, Math.sin(a + 0.2) * 100); ctx.stroke(); }
    ell(ctx, 0, 0, 92, 86); ctx.fillStyle = '#efe6d4'; ctx.fill();
    if (fill > 0.02) { ell(ctx, -10 * (1 - fill), 0, 88 * Math.sqrt(fill), 82 * Math.sqrt(fill)); ctx.fillStyle = rgr(ctx, -20, -20, 4, 0, 0, 90, [[0, '#ffffff'], [0.6, '#f6f0e2'], [1, '#d8ccb0']]); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, -30, -34, 26, 8, -0.5); ctx.fill(); }
  });
}
function egg(ctx, x, y, s, rot, o = {}) { // top view, origin centre, 60×78; o.open 0..1 splits into two shell halves
  const op = clamp(o.open || 0);
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = 'rgba(20,8,4,0.25)'; ell(ctx, 8, 10, 36, 44); ctx.fill();
    if (op <= 0) {
      ell(ctx, 0, 0, 34, 43); ctx.fillStyle = rgr(ctx, -12, -16, 3, 0, 0, 48, [[0, '#fff2e0'], [0.6, '#ecc9a0'], [1, '#b98a5c']]); ctx.fill();
      if (o.crack) { ctx.strokeStyle = 'rgba(90,55,30,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-34, 2); ctx.lineTo(-20, -4); ctx.lineTo(-8, 6); ctx.lineTo(6, -3); ctx.lineTo(20, 5); ctx.lineTo(34, 0); ctx.stroke(); }
    } else {
      for (const sg of [-1, 1]) {
        const dy = sg * op * 56;
        ctx.beginPath(); ctx.ellipse(0, dy, 34, 43, 0, sg < 0 ? PI : 0, sg < 0 ? TAU : PI); ctx.closePath();
        ctx.fillStyle = rgr(ctx, -10, dy - sg * 10, 3, 0, dy, 46, [[0, '#fff2e0'], [0.6, '#ecc9a0'], [1, '#b98a5c']]); ctx.fill();
        ell(ctx, 0, dy, 30, 8 + op * 6); ctx.fillStyle = '#fbf6ee'; ctx.fill();
      }
    }
  });
}
function sieve(ctx, x, y, s, o = {}) { // bamboo-rimmed mesh sieve, top view, R 260
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ell(ctx, 0, 0, 262, 262); ctx.fillStyle = lgr(ctx, -260, -260, 260, 260, [[0, '#e8c78a'], [1, '#8a6434']]); ctx.fill();
    ell(ctx, 0, 0, 236, 236); ctx.fillStyle = 'rgba(70,60,50,0.55)'; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 236, 236); ctx.clip();
    ctx.strokeStyle = 'rgba(210,205,195,0.45)'; ctx.lineWidth = 1.2; for (let i = -240; i < 240; i += 8) { ctx.beginPath(); ctx.moveTo(i, -240); ctx.lineTo(i, 240); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-240, i); ctx.lineTo(240, i); ctx.stroke(); }
    const f = clamp(o.flour ?? 1); if (f > 0) { ell(ctx, -20, 10, 170 * f, 150 * f); ctx.fillStyle = rgr(ctx, -60, -30, 10, -20, 10, 180 * f, [[0, 'rgba(255,255,252,1)'], [0.7, 'rgba(240,236,228,0.95)'], [1, 'rgba(230,225,215,0)']]); ctx.fill(); }
    ctx.restore();
  });
}
function whiskTop(ctx, x, y, s, rot, o = {}) { // top-down balloon whisk lying at an angle, origin = loop tip, handle toward +x
  const sp = o.spin || 0;
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = sp + i / 7 * PI, wv = Math.sin(a) * 46;
      ctx.strokeStyle = Math.cos(a) > 0 ? 'rgba(235,240,245,0.95)' : 'rgba(150,158,168,0.9)'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(250, 0); ctx.bezierCurveTo(150, wv * 0.6, 20, wv * 1.25, 0, wv * 0.2); ctx.bezierCurveTo(-10, -wv * 0.3, 20, -wv * 0.2, 60, -wv * 0.05); ctx.stroke();
    }
    tube(ctx, 240, 0, 560, 0, 30, 34, [[0, '#f4f6f8'], [0.5, '#a9b0b8'], [1, '#5c636b']]);
  });
}
function sugarSpoon(ctx, x, y, s, rot, o = {}) { // tilted metal spoon heaped with sugar, origin bowl centre
  at(ctx, x, y, rot, s, s, () => {
    tube(ctx, 50, 0, 380, 0, 22, 18, [[0, '#f4f6f8'], [0.5, '#a9b0b8'], [1, '#5c636b']]);
    ell(ctx, 0, 0, 70, 50); ctx.fillStyle = rgr(ctx, -20, -16, 3, 0, 0, 74, [[0, '#ffffff'], [0.6, '#b9c0c8'], [1, '#6c737b']]); ctx.fill();
    const f = clamp(o.fill ?? 1);
    if (f > 0) { ell(ctx, 0, 0, 58 * f, 40 * f); ctx.fillStyle = '#fbf8f0'; ctx.fill(); const r = rng(3); for (let i = 0; i < 40 * f; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.95)' : 'rgba(190,190,200,0.6)'; ctx.fillRect(-50 * f + r() * 100 * f, -34 * f + r() * 68 * f, 3, 3); } }
  });
}

// ------------------------------------------------------------------ cached backgrounds
const lg = (x, x0, y0, x1, y1, st) => lgr(x, x0, y0, x1, y1, st);
function tableTopDown() { // 1800×2700 planks seen from above (for rotating cameras); draw at (−360,−390)
  return cache('ttd', 1800, 2700, (x) => {
    const r = rng(77), pw = 170;
    for (let i = 0; i < 12; i++) {
      const x0 = i * pw - 10, v = 0.8 + r() * 0.3;
      x.fillStyle = lg(x, x0, 0, x0 + pw, 0, [[0, `rgb(${(150 * v) | 0},${(94 * v) | 0},${(56 * v) | 0})`], [1, `rgb(${(116 * v) | 0},${(70 * v) | 0},${(40 * v) | 0})`]]);
      x.fillRect(x0, 0, pw, 2700);
      x.strokeStyle = 'rgba(40,20,10,0.6)'; x.lineWidth = 5; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0, 2700); x.stroke();
      x.strokeStyle = 'rgba(60,32,16,0.22)'; x.lineWidth = 2;
      for (let k = 0; k < 7; k++) { const gx = x0 + 15 + r() * (pw - 30); x.beginPath(); x.moveTo(gx, 0); for (let yy = 0; yy <= 2700; yy += 100) x.lineTo(gx + Math.sin(yy * 0.004 + k + i) * 12, yy); x.stroke(); }
      for (let k = 0; k < 2; k++) { const kx = x0 + 30 + r() * (pw - 60), ky = r() * 2700; x.fillStyle = 'rgba(50,25,12,0.35)'; ell(x, kx, ky, 12, 26); x.fill(); x.strokeStyle = 'rgba(60,30,14,0.25)'; x.lineWidth = 1.5; ell(x, kx, ky, 22, 44); x.stroke(); }
    }
    x.save(); x.globalCompositeOperation = 'screen'; x.translate(900, 1350); x.rotate(0.5);
    for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(255,175,95,${0.06 + r() * 0.05})`; x.fillRect(-1500 + i * 330, -2000, 90 + r() * 80, 4000); }
    x.restore();
    const v = x.createRadialGradient(900, 1350, 300, 900, 1350, 1500); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,8,6,0.6)'); x.fillStyle = v; x.fillRect(0, 0, 1800, 2700);
  });
}
function table3q(ty) { // perspective planks from y = ty to the bottom of the frame
  return cache('t3q' + ty, W, H, (x) => {
    const r = rng(23), n = 9;
    for (let k = 0; k < n; k++) {
      const y0 = ty + (H - ty) * Math.pow(k / n, 1.5), y1 = ty + (H - ty) * Math.pow((k + 1) / n, 1.5), v = 0.86 + r() * 0.22;
      x.fillStyle = lg(x, 0, y0, 0, y1, [[0, `rgb(${(176 * v) | 0},${(104 * v) | 0},${(60 * v) | 0})`], [1, `rgb(${(132 * v) | 0},${(74 * v) | 0},${(42 * v) | 0})`]]);
      x.fillRect(0, y0, W, y1 - y0 + 1);
      x.strokeStyle = 'rgba(70,30,14,0.3)'; x.lineWidth = 1 + (y1 - y0) / 60;
      for (let q = 0; q < 4; q++) { const yy = lerp(y0, y1, 0.15 + r() * 0.7); x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(300, yy + (r() - 0.5) * 12, 700, yy + (r() - 0.5) * 12, W, yy + (r() - 0.5) * 8); x.stroke(); }
      x.fillStyle = 'rgba(40,14,6,0.6)'; x.fillRect(0, y1 - 2 - (y1 - y0) * 0.03, W, 2 + (y1 - y0) * 0.03);
    }
    x.fillStyle = 'rgba(255,210,150,0.7)'; x.fillRect(0, ty - 2, W, 4);
    x.fillStyle = lg(x, 0, ty, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,8,10,0.4)']]); x.fillRect(0, ty, W, H - ty);
    x.save(); x.globalCompositeOperation = 'screen'; x.translate(0, ty); x.rotate(0.35);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(255,180,100,${0.05 + r() * 0.05})`; x.fillRect(i * 260 - 200, -200, 80 + r() * 60, 2400); }
    x.restore();
  });
}
// riverside stall plate behind the table (sharp + blurred versions), golden afternoon
function stallSharp() {
  return cache('stallS', W, H, (x) => {
    BX.riversideScene(x, 12, { dusk: 0.0, horizon: 1020, sun: [760, 640], sunS: 1.2, flare: 0, house: { x: 140, y: 1180, s: 0.7 }, garden: false });
    // thatched eave across the top + bamboo posts
    const r = rng(61);
    x.fillStyle = lg(x, 0, 0, 0, 300, [[0, '#4a2e14'], [1, '#7a5428']]); x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, 210); for (let i = 40; i >= 0; i--) x.lineTo(i / 40 * W, 230 + Math.sin(i * 1.7) * 14 + r() * 26); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(240,200,120,0.5)'; x.lineWidth = 2;
    for (let i = 0; i < 260; i++) { const px = r() * W, py = 120 + r() * 120; x.beginPath(); x.moveTo(px, py - 70); x.lineTo(px + (r() - 0.5) * 16, py + 20); x.stroke(); }
    for (const px of [70, 1010]) {
      x.fillStyle = lg(x, px - 26, 0, px + 26, 0, [[0, '#e8c27a'], [0.5, '#a87a3a'], [1, '#5a3c18']]); x.fillRect(px - 26, 0, 52, H);
      x.strokeStyle = 'rgba(70,45,20,0.6)'; x.lineWidth = 4; for (let yy = 140; yy < H; yy += 260) { x.beginPath(); x.moveTo(px - 26, yy); x.lineTo(px + 26, yy); x.stroke(); }
    }
  });
}
function stallPlate(blur = 10) {
  return cache('stallB' + blur, W, H, (x) => {
    x.drawImage(blurCopy(stallSharp(), blur), 0, 0);
    x.fillStyle = lgr(x, 0, 0, 0, H, [[0, 'rgba(255,170,80,0.32)'], [0.5, 'rgba(255,150,70,0.18)'], [1, 'rgba(120,60,30,0.2)']]); x.fillRect(0, 0, W, H);
    L.bokeh(x, 0, 19, 18, ['rgba(255,210,140,1)', 'rgba(255,170,90,1)', 'rgba(200,240,150,1)'], 0.22, 20, 70);
  });
}
// big blurred foreground pandan leaves (depth layer), drawn at (0,0) full frame; side 'L'|'R'
function fgLeaves(side = 'L', blur = 14) {
  return cache('fgl' + side + blur, W, H, (x) => {
    const tmp = sprite(W, H, (tx) => {
      const r = rng(side === 'L' ? 5 : 6), sg = side === 'L' ? 1 : -1, bx = side === 'L' ? -60 : W + 60;
      for (let i = 0; i < 6; i++) { const y0 = H + 40, a = -PI / 2 + sg * (0.25 + r() * 0.5); const len = 500 + r() * 400; pandanLeaf(tx, [[bx + sg * i * 30, y0], [bx + sg * (i * 30 + Math.cos(a + PI / 2) * 0), y0 - len * 0.5], [bx + sg * (i * 30 + len * 0.45), y0 - len * (0.75 + r() * 0.2)]], 70 + r() * 30, { seed: i }); }
    });
    x.drawImage(blurCopy(tmp, blur), 0, 0);
  });
}

module.exports = {
  PURPLE, SKIN, COLS, PAN, JUICE, BATTER, CRUST,
  tube, armIn, fist, leafChip, pandanLeaf, pandanBundle, pestle, mortar, clothBundle, bowl, liquidFill,
  mould, mouldPath, cakeTop, brazier, ovenLid, coal, cutaway, leafBrush, ribbon, alarmClock,
  coconutCup, egg, sieve, whiskTop, sugarSpoon,
  tableTopDown, table3q, stallSharp, stallPlate, fgLeaves, blurCopy, sprite, cache,
};
