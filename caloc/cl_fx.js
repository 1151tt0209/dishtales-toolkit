// cl_fx.js — "Cá lóc nướng trui" effects (night, straw fire, water, comic words). LOCAL in / LOCAL out.
// THIS HEADER IS THE SOURCE OF TRUTH for the API.   const CL = require('./clprops');  (re-exports everything below)
// =====================================================================================================================
// CONVENTIONS
//  • Every drawer save()/restore()s; deterministic from o.t / o.seed / k (no Math.random, no per-frame ctx.filter).
//  • (x,y) are in the CURRENT ctx space (camera transforms are fine). s = uniform scale; sizes below are at s = 1.
//  • Glows use 'screen' / 'lighter' compositing, so draw fx AFTER the scene they light. Sprites are cached at module load.
//  • Night palette: moon = cool blue-white rim, fire = orange/yellow. render.js adds grade/vignette/grain/flashes.
//  • Timings (this PC, 1080×1920, flushed with getImageData, s=1): strawFire ≈ 10 ms, sparks(120) ≈ 2.5 ms,
//    fireSmoke ≈ 4 ms, strawFire+sparks(60)+smoke ≈ 14 ms, fireLight ≈ 5.5 ms, whoosh ≈ 13.5 ms (only ~0.6 s),
//    splashCrown ≈ 4.4 ms, torchBeam ≈ 2.8 ms, bubbles ≈ 2.4 ms, dropletsSlowmo ≈ 3.4 ms, clWord ≈ 4 ms, steamWisps ≈ 2.3 ms.
//
// ------------------------------------------------------------------------------------------------- FIRE
//  strawFire(ctx,x,y,s,{t, k=0.6 intensity, seed=1, wind=0 (−1..1, + leans right), w (base half-width override),
//        glow=true, embers=true}) → {top:[x,y], h, w}
//        origin = ground centre of the fire. k 0 = ember bed + tiny licks (h≈60) · .5 = strong fire (h≈560, half-width 280)
//        · 1 = tower (h≈1100, half-width 360). 7..18 organic tongues (7+11k) — each lives its own cycle (grows, sways with an
//        S-bend, breaks off a flame fragment that rises and shrinks), drawn as 5 union-filled colour passes
//        (translucent red edge → orange → amber → yellow → white core, so overlaps never stack alpha) + thin bed + bloom. Fits on a strawPile (base half-width ≈300 at s=1).
//        Typical s8: k = 0 before 22.667, then whoosh + k ramps 0→1 in 0.4 s, holds ~0.9, decays to .45 by 25.3.
//  sparks(ctx,x,y,s,{t, n=60 (≤150), rise=800, spiral=60, w=220, seed, wind=0, size=1, alpha=1})
//        rising swirling ember sparks from a base band w wide centred at (x,y). Loops forever with t.
//  fireSmoke(ctx,x,y,s,{t, k=1, drift=0.35 (+ = drifts right as it rises), h=1000, seed, w=160, alpha=1})
//        grey-blue smoke plume rising from (x,y) (put it at the flame top), puffs lit orange near the bottom.
//  whoosh(ctx,x,y,s,k,{seed}) ignition burst, k 0..1 over ~0.6 s (ignite at k=0): white-hot flash (peak k≈.1),
//        ring of flame tongues racing out to r≈600 (ryr .28, back half behind / front half in front), 9 fireball puffs
//        blooming up/out ('lighter'), 16 curved comet-shaped flame streaks shooting up/out (≈450–950 long), thin shock
//        ring, god rays while k<.4. origin = ground centre (same as strawFire).
//  fireLight(ctx,x,y,r,k,{t, mode='screen', col=[255,150,60], flicker=1}) warm flickering light pool (radius r px,
//        NOT scaled by s) painted over a night scene: faces, ground, water near the fire.
//  emberGlow(ctx,x,y,s,{t,k,w=200,seed}) dark charred bed + warm heart + flickering ember dots + soft glow (used by strawFire k≈0, also for the dying fire s21).
//
// ------------------------------------------------------------------------------------------------- LIGHT
//  torchBeam(ctx,x0,y0,angle,len,{spread=0.2 (half-angle rad), k=1, t, dust=true, n=40, hit=true, hitRyr=0.35,
//        col=[255,246,215], seed, src=true}) → {hit:[x,y]}
//        head-torch / phone flashlight cone from (x0,y0) along angle (rad, 0 = +x, π/2 = down). Floating motes, bright
//        hit spot (flattened ellipse) at the end, small lens glow at the source. len in px (not scaled).
//
// ------------------------------------------------------------------------------------------------- WATER
//  splashCrown(ctx,x,y,s,k,{t, seed=3, warm=0 (0 moonlit blue-white … 1 fire-lit orange rim), mist=true})
//        big body-fall splash at waterline (x,y): crown wall (r≈330, ≈420 tall at peak k≈.3), spiky rim with drops,
//        wobbly Worthington jet after k≈.3 (≈430 tall, pinches off a teardrop + 2 satellite drops), 70 ballistic droplets, foam rings. k 0..1 over ~0.8–1.0 s.
//  bubbles(ctx,x,y,s,{t, n=10, w=180, ryr=0.3, rings=3, depth=0 (>0: also bubbles rising underwater from y+depth),
//        seed, alpha=1})   surface bubbles popping + expanding ripple rings around (x,y) (s18 silence).
//  dropletsSlowmo(ctx,x,y,s,{t, k=1 spread (0 = tight cluster → 1 r≈380), n=40, seed, warm=0.5, drift=1})
//        slow-motion glittering water droplets hanging in the air around (x,y) (s3, in the torch beam).
//  ripplesNight(ctx,x,y,s,{t, n=3, r=160, ryr=0.3, period=1.6, alpha=1, seed}) concentric moonlit ripple rings.
//
// ------------------------------------------------------------------------------------------------- COMIC
//  comicWord(ctx, text, x, y, size=150, {t, k=1 pop-in (outBack; ≥1 holds w/ pulse), out 0..1 fade-out, shake=0.4,
//        rot=-0.06, pal:'fire'|'water'|'slap'|'frog'|'gold', fill/stroke/glow (colour overrides), en (small English
//        under-word, size*0.36), burst=true (jagged starburst behind), lines=false (speed lines)}) → {box:[x0,y0,x1,y1]}
//        BodySansBold (Segoe UI Bold) → all Vietnamese diacritics render (Õ, Ừ, Ộ, Ù, É).
//  clWord(ctx, key, x, y, size, o)  preset: key 'TOM' (TÕM!/SPLASH!, water) · 'PHUNG' (PHỪNG!/WHOOSH!, fire) ·
//        'BEP' (BÉP!/SLAP!, slap) · 'UM' (ÙM!/SPLOOSH!, water) · 'OP' (ỘP!/RIBBIT!, frog) · 'WOW' (WOW!/WOW!, gold).
//        CL_WORDS holds the presets.
//  dizzy(ctx,x,y,s,t,{n=5, r=110, ryr=0.32, k=1}) stars + little birds circling a head (centre x,y = top of head).
//  slapMark(ctx,x,y,s,{k=1 (0..1 life: pop + impact lines fade by .5, mark stays), rot=0, t}) red fish-tail print on a
//        cheek (~110 wide) + impact lines + mini stars.
//  steamWisps(ctx,x,y,s,{t, k=1, w=160, h=320, n=5, seed, warm=0 (0 moonlit white-blue, 1 fire-lit), alpha=1})
//        one faint continuous curl per wisp + 4 soft puffs drifting up it (no beading), from a w-wide strip centred at (x,y) (scraped fish flesh, rolls).
//  softPuff(kind) → cached 128px sprite canvas: 'soft' | 'smoke' | 'smokeWarm' | 'steam'.
// =====================================================================================================================
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const { createCanvas } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease } = L;
const PI = Math.PI;
const { lgr, rgr, ell } = NP;

const nz = (t, p = 0) => Math.sin(t * 1.7 + p) * 0.5 + Math.sin(t * 2.9 + p * 1.3 + 1) * 0.3 + Math.sin(t * 5.3 + p * 2.1 + 2) * 0.2;

// ------------------------------------------------------------------ cached puff sprites
const PUFF = {};
function softPuff(kind) {
  if (PUFF[kind]) return PUFF[kind];
  const N = 128, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2;
  let st;
  if (kind === 'smoke') st = [[0, 'rgba(118,128,150,0.62)'], [0.55, 'rgba(110,120,145,0.3)'], [1, 'rgba(100,110,140,0)']];
  else if (kind === 'smokeWarm') st = [[0, 'rgba(210,130,80,0.62)'], [0.55, 'rgba(170,100,70,0.3)'], [1, 'rgba(140,80,60,0)']];
  else if (kind === 'steam') st = [[0, 'rgba(240,246,255,0.75)'], [0.5, 'rgba(235,242,255,0.35)'], [1, 'rgba(235,242,255,0)']];
  else st = [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']];
  x.fillStyle = rgr(x, h, h, 0, h, h, h, st); x.fillRect(0, 0, N, N);
  return (PUFF[kind] = c);
}
function puff(ctx, kind, x, y, r, a) { if (a <= 0.004 || r <= 0.5) return; const ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a); ctx.drawImage(softPuff(kind), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = ga; }

// glow helper (bounded rect)
function glowR(ctx, x, y, r, stops, alpha = 1, mode = 'screen') {
  if (alpha <= 0.003 || r < 1) return;
  ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha = alpha;
  ctx.fillStyle = rgr(ctx, x, y, 0, x, y, r, stops); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

// ================================================================================================= FIRE
// flame passes: outer translucent red edge → orange → amber → yellow → white core (each pass = ONE union fill)
const FLAME_PASSES = [
  { col: '#c22a14', hm: 1.0, wm: 1.0, a: 0.6 },
  { col: '#ef5d1c', hm: 0.84, wm: 0.78, a: 0.82 },
  { col: '#ffa02a', hm: 0.64, wm: 0.56, a: 0.92 },
  { col: '#ffd659', hm: 0.44, wm: 0.38, a: 0.95 },
  { col: '#fff5cf', hm: 0.24, wm: 0.22, a: 0.95, core: true },
];
const FIRE_SPR = {};
function fireSprite() {
  if (FIRE_SPR.c) return FIRE_SPR.c;
  const N = 128, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2;
  x.fillStyle = rgr(x, h, h, 0, h, h, h, [[0, 'rgba(255,248,215,1)'], [0.28, 'rgba(255,196,90,0.85)'], [0.6, 'rgba(240,96,32,0.38)'], [1, 'rgba(170,40,20,0)']]);
  x.fillRect(0, 0, N, N);
  return (FIRE_SPR.c = c);
}
function emberGlow(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), w = (o.w ?? 200) * s;
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= k;
  // dark charred bed with a warm heart (not a lava pool)
  ell(ctx, x, y, w, w * 0.2);
  ctx.fillStyle = rgr(ctx, x, y, 0, x, y, w, [[0, 'rgba(70,26,14,0.85)'], [0.75, 'rgba(40,18,12,0.6)'], [1, 'rgba(25,12,10,0)']]); ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  ell(ctx, x, y - w * 0.02, w * 0.7, w * 0.12);
  ctx.fillStyle = rgr(ctx, x, y, 0, x, y, w * 0.7, [[0, 'rgba(255,140,50,0.55)'], [0.5, 'rgba(200,60,20,0.3)'], [1, 'rgba(120,30,10,0)']]); ctx.fill();
  const r = rng(o.seed ?? 7);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 20; i++) {
    const a = r() * TAU, d = Math.sqrt(r()), px = x + Math.cos(a) * w * 0.8 * d, py = y + Math.sin(a) * w * 0.15 * d;
    const fl = 0.5 + 0.5 * Math.sin(t * (4 + r() * 5) + i * 2.1);
    ctx.fillStyle = `rgba(255,${(120 + 100 * fl) | 0},50,${0.65 * fl})`; ell(ctx, px, py, (2 + r() * 4) * s, (1.4 + r() * 2) * s); ctx.fill();
  }
  ctx.restore();
  glowR(ctx, x, y, w * 1.2, [[0, 'rgba(255,120,40,0.35)'], [1, 'rgba(255,80,20,0)']], k * (0.85 + 0.15 * Math.sin(t * 9)), 'screen');
}
// cached tongue table per seed
const TONGUES = {};
function tongueTable(seed) {
  if (TONGUES[seed]) return TONGUES[seed];
  const r = rng(seed * 31 + 7), arr = [];
  for (let i = 0; i < 18; i++) {
    const sg = r() < 0.5 ? -1 : 1, u = sg * Math.pow(r(), 0.85) * (i < 3 ? 0.35 : 1);
    arr.push({ u, per: 0.5 + r() * 0.45, ph: r(), hb: 0.45 + 0.55 * r(), wb: 0.2 + 0.12 * r(), p1: r() * TAU, p2: r() * TAU, p3: r() * TAU, frag: r() < 0.6 });
  }
  arr.sort((a, b) => Math.abs(b.u) - Math.abs(a.u));
  return (TONGUES[seed] = arr);
}
function strawFire(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 0.6), seed = o.seed ?? 1, wind = o.wind || 0;
  const H = (60 + 1040 * Math.pow(k, 1.05)) * s;
  const B = (o.w ?? (130 + 230 * Math.min(1, k * 1.6))) * s;
  const nT = Math.round(7 + 11 * k), TT = tongueTable(seed);
  ctx.save();
  if (o.glow !== false) glowR(ctx, x + wind * H * 0.15, y - H * 0.4, H * 0.7 + 200 * s, [[0, 'rgba(255,160,70,0.5)'], [0.45, 'rgba(255,100,40,0.2)'], [1, 'rgba(255,60,20,0)']], 0.45 + 0.35 * Math.min(1, k * 2), 'screen');
  if (o.embers !== false) emberGlow(ctx, x, y + 4 * s, s, { t, k: 0.6, w: B * 1.05, seed: seed + 3 });
  // precompute tongues for this frame
  const tg = [];
  for (let i = 0; i < nT; i++) {
    const T = TT[i % TT.length], l = ((t / T.per + T.ph) % 1 + 1) % 1, env = Math.pow(Math.sin(l * PI), 0.7);
    const u = T.u;
    const h = H * T.hb * (0.4 + 0.6 * env) * (1 - 0.6 * u * u) * (i < nT * 0.3 ? 1 : 0.85);
    const w = B * T.wb * (1 - 0.3 * Math.abs(u)) * (0.75 + 0.25 * env);
    const bx = x + u * B * 0.82 + Math.sin(t * 1.3 + T.p1) * B * 0.04;
    const lean = wind * 0.42 + u * 0.12 + Math.sin(t * 3.3 + T.p2) * 0.09;
    const fr = T.frag && T.hb > 0.55 && l > 0.55 ? (l - 0.55) / 0.45 : -1;
    tg.push({ T, l, h, w, bx, lean, fr, core: Math.abs(u) < 0.55 });
  }
  for (const P of FLAME_PASSES) {
    ctx.beginPath();
    for (const g of tg) {
      if (P.core && !g.core) continue;
      const h = g.h * P.hm, w = g.w * P.wm, bx = g.bx, T = g.T;
      if (h < 4 * s) continue;
      const tipx = bx + g.lean * h, tipy = y - h;
      const s1 = Math.sin(t * 7.1 + T.p1) * w * 0.35, s2 = Math.sin(t * 9.3 + T.p2) * w * 0.4, s3 = Math.sin(t * 8.2 + T.p3) * w * 0.35;
      const bend = Math.sin(t * 4.4 + T.p3) * h * 0.08; // S-bend: mid goes opposite to tip
      ctx.moveTo(bx - w, y);
      ctx.bezierCurveTo(bx - w * 1.15 + s1, y - h * 0.32, tipx - w * 0.45 - bend + s2, y - h * 0.68, tipx, tipy);
      ctx.bezierCurveTo(tipx + w * 0.4 - bend + s3, y - h * 0.62, bx + w * 1.12 - s1, y - h * 0.3, bx + w, y);
      ctx.quadraticCurveTo(bx, y + w * 0.55, bx - w, y);
      ctx.closePath();
      // breakaway fragment rising off the tip
      if (g.fr >= 0 && P.hm > 0.3) {
        const fr = g.fr, fh = g.h * 0.22 * (1 - fr) * P.hm, fw = g.w * 0.42 * (1 - fr * 0.6) * P.wm;
        if (fh > 3 * s) {
          const fx = bx + g.lean * g.h * (1 + fr * 0.4) + wind * fr * 60 * s + Math.sin(t * 6 + T.p2) * 10 * s, fy = y - g.h * (0.92 + fr * 0.45) - fh * (1 - P.hm) * 0.5;
          const cb = Math.sin(t * 8 + T.p1) * fw * 0.8;
          ctx.moveTo(fx + cb, fy - fh);
          ctx.bezierCurveTo(fx + fw + cb * 0.3, fy - fh * 0.3, fx + fw * 0.9, fy + fh * 0.35, fx, fy + fh * 0.4);
          ctx.bezierCurveTo(fx - fw * 0.9, fy + fh * 0.35, fx - fw + cb * 0.3, fy - fh * 0.3, fx + cb, fy - fh);
          ctx.closePath();
        }
      }
    }
    // low connected bed (thin, not a blob)
    { const rx = B * P.wm * 0.92, ry = B * 0.1 * P.wm + 2 * s; ctx.moveTo(x + rx, y - 2 * s); ctx.ellipse(x, y - 2 * s, rx, ry, 0, 0, TAU); }
    ctx.globalAlpha = P.a; ctx.fillStyle = P.col; ctx.fill('nonzero');
  }
  ctx.globalAlpha = 1;
  glowR(ctx, x, y - H * 0.2, Math.max(B, H * 0.32), [[0, 'rgba(255,236,180,0.5)'], [1, 'rgba(255,170,60,0)']], 0.32 + 0.12 * Math.sin(t * 11), 'lighter');
  ctx.restore();
  return { top: [x + wind * H * 0.42, y - H], h: H, w: B };
}
function sparks(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, n = Math.min(150, o.n ?? 60), rise = (o.rise ?? 800) * s, sp = (o.spiral ?? 60) * s, w = (o.w ?? 220) * s;
  const r = rng(o.seed ?? 11), wind = o.wind || 0, sz = o.size ?? 1, A = o.alpha ?? 1;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const per = 1.3 + r() * 1.8, ph = r(), bx = (r() - 0.5) * w, rr = 0.55 + r() * 0.45, spin = 1 + r() * 1.6, dir = r() < 0.5 ? -1 : 1, z = (1.4 + r() * 2.6) * s * sz;
    const life = ((t / per + ph) % 1 + 1) % 1;
    const pos = (l) => [x + bx * (1 - l * 0.4) + dir * Math.sin(l * TAU * spin + ph * TAU) * sp * (0.25 + l) + wind * l * rise * 0.35, y - l * rise * rr];
    const [px, py] = pos(life), [qx, qy] = pos(Math.max(0, life - 0.025));
    const a = A * (life < 0.08 ? life / 0.08 : 1) * (1 - Math.pow(life, 1.6)) * (0.6 + 0.4 * Math.sin(t * 20 + i));
    if (a <= 0.01) continue;
    const g = (1 - life);
    ctx.strokeStyle = `rgba(255,${(110 + 140 * g) | 0},${(40 + 120 * g * g) | 0},${a})`;
    ctx.lineWidth = z; ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
    if (i % 4 === 0) { ctx.fillStyle = `rgba(255,240,190,${a * 0.9})`; ell(ctx, px, py, z * 0.7, z * 0.7); ctx.fill(); }
  }
  ctx.restore();
}
function fireSmoke(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), drift = o.drift ?? 0.35, Hs = (o.h ?? 1000) * s, r = rng(o.seed ?? 21), A = (o.alpha ?? 1) * k, w = (o.w ?? 160) * s;
  if (A <= 0) return;
  ctx.save();
  const N = 26;
  for (let i = 0; i < N; i++) {
    const per = 4.5 + r() * 2.5, ph = r(), bx = (r() - 0.5) * w, rs = 0.8 + r() * 0.5, wob = r() * TAU;
    const l = ((t / per + ph) % 1 + 1) % 1;
    const px = x + bx * (1 - l * 0.5) + drift * l * l * Hs * 0.9 + Math.sin(l * 5 + wob + t * 0.6) * 40 * s * l;
    const py = y - l * Hs;
    const rad = (40 + 190 * l) * s * rs;
    const a = A * Math.sin(Math.min(1, l * 1.3) * PI) * 0.75;
    const warm = clamp(1 - l * 2.4);
    puff(ctx, 'smokeWarm', px, py, rad, a * warm);
    puff(ctx, 'smoke', px, py, rad, a * (1 - warm * 0.7));
  }
  ctx.restore();
}
const WHOOSH = {};
function whooshTable(seed) {
  if (WHOOSH[seed]) return WHOOSH[seed];
  const r = rng(seed * 17 + 3), streaks = [], puffs = [], ring = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, a = -PI / 2 + side * (0.08 + Math.pow(r(), 0.8) * 1.35);
    streaks.push({ a, len: 0.55 + r() * 0.6, curl: (r() - 0.3) * side * 0.9, w: 0.6 + r() * 0.7, d: r() * 0.12 });
  }
  for (let i = 0; i < 9; i++) puffs.push({ a: -PI / 2 + (r() - 0.5) * 1.6, d: 0.25 + r() * 0.75, rs: 0.7 + r() * 0.7, d0: r() * 0.1 });
  for (let i = 0; i < 20; i++) ring.push({ a: i / 20 * TAU + r() * 0.25, h: 0.55 + r() * 0.7, w: 0.7 + r() * 0.6 });
  ring.sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
  return (WHOOSH[seed] = { streaks, puffs, ring });
}
function whoosh(ctx, x, y, s = 1, k = 0, o = {}) {
  if (k <= 0 || k >= 1) return;
  const tb = whooshTable(o.seed ?? 5);
  ctx.save();
  // white-hot flash
  const fl = k < 0.08 ? k / 0.08 : Math.pow(1 - (k - 0.08) / 0.92, 1.8);
  glowR(ctx, x, y - 220 * s, 640 * s, [[0, 'rgba(255,250,228,0.92)'], [0.3, 'rgba(255,190,95,0.52)'], [1, 'rgba(255,110,30,0)']], fl, 'screen');
  if (k < 0.4) L.godRays(ctx, x, y - 160 * s, -PI / 2, PI * 1.5, 1100 * s, 10, 'rgba(255,205,130,0.6)', 0.4 * (1 - k / 0.4), k * 4);
  // ground shock ring
  const R = ease.out(clamp(k * 1.25)) * 600 * s;
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255,225,165,${0.55 * (1 - k)})`; ctx.lineWidth = 6 * s * (1 - k) + 1; ell(ctx, x, y, R * 1.12, R * 1.12 * 0.28); ctx.stroke();
  // ring of flame tongues racing outward (back half first, front half after the burst)
  const drawRing = (front) => {
    for (const g of tb.ring) {
      const sn = Math.sin(g.a); if ((sn > 0) !== front) continue;
      const px = x + Math.cos(g.a) * R, py = y + sn * R * 0.28, life = 1 - k;
      const hh = 170 * s * g.h * Math.pow(life, 0.8), ww = 20 * s * g.w * (0.5 + 0.5 * life), lean = Math.cos(g.a) * 0.55;
      if (hh < 3) continue;
      for (const [col, f, a] of [['#e2441a', 1, 0.8], ['#ffb02a', 0.6, 0.9], ['#fff0c0', 0.3, 0.9]]) {
        ctx.globalAlpha = a * Math.min(1, life * 1.6); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(px - ww * f, py);
        ctx.bezierCurveTo(px - ww * f, py - hh * f * 0.4, px + lean * hh * 0.25 - ww * f * 0.3, py - hh * f * 0.75, px + lean * hh * 0.55 * f, py - hh * f);
        ctx.bezierCurveTo(px + lean * hh * 0.2 + ww * f * 0.5, py - hh * f * 0.6, px + ww * f, py - hh * f * 0.3, px + ww * f, py);
        ctx.quadraticCurveTo(px, py + ww * f * 0.5, px - ww * f, py); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };
  drawRing(false);
  // fireball bloom: soft fiery puffs rising and expanding
  ctx.globalCompositeOperation = 'lighter';
  const spr = fireSprite();
  for (const p of tb.puffs) {
    const kk = clamp((k - p.d0) / (1 - p.d0)); if (kk <= 0) continue;
    const d = ease.out(kk) * 620 * s * p.d, px = x + Math.cos(p.a) * d * 0.7, py = y - 60 * s + Math.sin(p.a) * d;
    const rr = (70 + 190 * ease.out(kk)) * s * p.rs, a = Math.pow(1 - kk, 1.4) * 0.85;
    ctx.globalAlpha = a; ctx.drawImage(spr, px - rr, py - rr, rr * 2, rr * 2);
  }
  ctx.globalAlpha = 1;
  // curved flame streaks shooting up/out (tapered polygons: thin tail → fat bright head)
  for (const st of tb.streaks) {
    const kk = clamp((k - st.d) / 0.7); if (kk <= 0 || kk >= 1) continue;
    const Ls = 820 * s * st.len, head = ease.out(kk) * Ls, tail = ease.in(kk) * Ls * 0.85 + head * 0.15;
    const P = (d) => { const v = d / Ls, a = st.a + st.curl * v; return [x + Math.cos(a) * d, y - 30 * s + Math.sin(a) * d]; };
    // comet profile: pointed tail, fat rounded body near the head, pointed tip (no "matchstick" head)
    const n = 10, wmax = 24 * s * st.w * (1 - kk * 0.55), C = [];
    for (let j = 0; j <= n; j++) {
      const v = j / n, d = tail + (head - tail) * v, [px, py] = P(d), [qx, qy] = P(d + 2);
      let nx = -(qy - py), ny = qx - px; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      C.push([px, py, nx, ny, Math.pow(Math.sin(PI * Math.pow(v, 1.8)), 0.75)]);
    }
    ctx.globalAlpha = (1 - kk) * 0.9;
    for (const [col, f] of [['rgba(240,90,28,0.85)', 1], ['rgba(255,190,80,0.9)', 0.55], ['rgba(255,245,205,0.95)', 0.22]]) {
      ctx.beginPath();
      for (let j = 0; j <= n; j++) { const [px, py, nx, ny, w] = C[j], ww = wmax * w * f; j ? ctx.lineTo(px + nx * ww, py + ny * ww) : ctx.moveTo(px + nx * ww, py + ny * ww); }
      for (let j = n; j >= 0; j--) { const [px, py, nx, ny, w] = C[j], ww = wmax * w * f; ctx.lineTo(px - nx * ww, py - ny * ww); }
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawRing(true);
  ctx.restore();
}
function fireLight(ctx, x, y, r, k = 1, o = {}) {
  if (k <= 0) return;
  const t = o.t || 0, f = o.flicker ?? 1, c = o.col || [255, 150, 60];
  const fl = 1 + f * (0.05 * Math.sin(t * 13) + 0.035 * Math.sin(t * 23 + 1) + 0.02 * Math.sin(t * 37 + 2));
  const R = r * fl;
  glowR(ctx, x, y, R, [[0, `rgba(${c[0]},${c[1]},${c[2]},0.4)`], [0.35, `rgba(${c[0]},${(c[1] * 0.8) | 0},${(c[2] * 0.6) | 0},0.18)`], [0.7, `rgba(${c[0]},${(c[1] * 0.6) | 0},${(c[2] * 0.4) | 0},0.05)`], [1, 'rgba(0,0,0,0)']], k * (0.92 + 0.08 * Math.sin(t * 17)), o.mode || 'screen');
}

// ================================================================================================= TORCH BEAM
function torchBeam(ctx, x0, y0, angle, len, o = {}) {
  const k = o.k ?? 1, t = o.t || 0, sp = o.spread ?? 0.2, c = o.col || [255, 246, 215];
  if (k <= 0) return { hit: [x0 + Math.cos(angle) * len, y0 + Math.sin(angle) * len] };
  const tn = Math.tan(sp), half = len * tn, cs = `${c[0]},${c[1]},${c[2]}`;
  ctx.save(); ctx.translate(x0, y0); ctx.rotate(angle); ctx.globalCompositeOperation = 'screen';
  // outer cone
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(len, -half); ctx.quadraticCurveTo(len + half * 0.35, 0, len, half); ctx.lineTo(0, 7); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, 0, len, 0, [[0, `rgba(${cs},${0.5 * k})`], [0.5, `rgba(${cs},${0.2 * k})`], [1, `rgba(${cs},${0.05 * k})`]]); ctx.fill();
  // inner core
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(len * 0.9, -half * 0.45); ctx.lineTo(len * 0.9, half * 0.45); ctx.lineTo(0, 4); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, 0, len * 0.9, 0, [[0, `rgba(${cs},${0.45 * k})`], [1, `rgba(${cs},0)`]]); ctx.fill();
  // motes
  if (o.dust !== false) {
    const r = rng(o.seed ?? 9), n = o.n ?? 40;
    for (let i = 0; i < n; i++) {
      const d0 = r(), spd = 10 + r() * 30, lat0 = r() * 2 - 1, ph = r() * TAU, z = 1 + r() * 2.6;
      const d = ((d0 * len + t * spd) % len), lat = (lat0 * 0.9 + Math.sin(t * 0.8 + ph) * 0.08) * d * tn;
      const a = k * (0.35 + 0.65 * (1 - d / len)) * (0.5 + 0.5 * Math.sin(t * 2.3 + ph)) * (1 - Math.abs(lat0) * 0.5);
      ctx.fillStyle = `rgba(${cs},${a})`; ell(ctx, d, lat, z, z); ctx.fill();
    }
  }
  ctx.restore();
  const hx = x0 + Math.cos(angle) * len, hy = y0 + Math.sin(angle) * len;
  if (o.hit !== false) {
    ctx.save(); ctx.translate(hx, hy); ctx.scale(1, o.hitRyr ?? 0.35); ctx.globalCompositeOperation = 'screen';
    const hr = half * 1.1 + 20;
    ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, hr, [[0, `rgba(${cs},${0.65 * k})`], [0.5, `rgba(${cs},${0.25 * k})`], [1, `rgba(${cs},0)`]]); ctx.fillRect(-hr, -hr, hr * 2, hr * 2);
    ctx.restore();
  }
  if (o.src !== false) { glowR(ctx, x0, y0, 70, [[0, `rgba(255,255,250,${0.95 * k})`], [0.25, `rgba(${cs},${0.5 * k})`], [1, `rgba(${cs},0)`]], 1, 'screen'); }
  return { hit: [hx, hy] };
}

// ================================================================================================= WATER
function splashCrown(ctx, x, y, s = 1, k = 0, o = {}) {
  if (k <= 0 || k >= 1) return;
  const r = rng(o.seed ?? 3), warm = clamp(o.warm || 0), fade = 1 - k;
  const rimC = warm > 0 ? `rgba(255,${(200 - 40 * warm) | 0},${(140 - 60 * warm) | 0},` : 'rgba(200,230,255,';
  const ryr = 0.28;
  const grow = ease.out(clamp(k * 1.8)), ch = Math.sin(Math.min(1, k * 1.7) * PI * 0.5) * (1 - k * 0.6) * 420 * s;
  const cw = (90 + 240 * grow) * s;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // mist
  if (o.mist !== false) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; puff(ctx, 'soft', x + Math.cos(a) * cw * 0.9, y + Math.sin(a) * cw * ryr - 20 * s, (70 + 60 * k) * s, 0.22 * fade); }
  const wall = (th0, th1, alpha) => {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const th = lerp(th0, th1, i / 24); const px = x + Math.cos(th) * cw, py = y + Math.sin(th) * cw * ryr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    for (let i = 24; i >= 0; i--) { const th = lerp(th0, th1, i / 24); const rr = cw * (1.12 + 0.06 * Math.sin(th * 7)); ctx.lineTo(x + Math.cos(th) * rr, y - ch * (0.62 + 0.12 * Math.sin(th * 5 + 1)) + Math.sin(th) * rr * ryr); }
    ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, y - ch * 0.7, 0, y, [[0, `rgba(235,245,255,${0.18 * alpha})`], [1, `rgba(225,240,255,${0.6 * alpha})`]]); ctx.fill();
  };
  const spikes = (front) => {
    const NS = 22;
    for (let i = 0; i < NS; i++) {
      const th = i / NS * TAU + 0.13, isF = Math.sin(th) > 0; if (isF !== front) { r(); r(); r(); continue; }
      const rr = cw * 1.12, bx = x + Math.cos(th) * rr, by = y - ch * 0.6 + Math.sin(th) * rr * ryr;
      const hh = ch * (0.25 + r() * 0.45), lean = Math.cos(th) * 0.5 + (r() - 0.5) * 0.3, bw = (7 + r() * 7) * s * fade + 2;
      const tx = bx + lean * hh, ty = by - hh;
      ctx.fillStyle = `rgba(240,248,255,${0.8 * fade})`;
      ctx.beginPath(); ctx.moveTo(bx - bw, by + 6 * s); ctx.quadraticCurveTo(bx + lean * hh * 0.4, by - hh * 0.5, tx, ty); ctx.quadraticCurveTo(bx + lean * hh * 0.4 + bw * 0.4, by - hh * 0.5, bx + bw, by + 6 * s); ctx.closePath(); ctx.fill();
      const dd = (4 + r() * 5) * s, sep = k * 50 * s;
      ctx.fillStyle = `rgba(255,255,255,${0.95 * fade})`; ell(ctx, tx + lean * sep, ty - sep, dd, dd * 1.25); ctx.fill();
      ctx.strokeStyle = rimC + (0.7 * fade) + ')'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(bx - bw, by + 6 * s); ctx.quadraticCurveTo(bx + lean * hh * 0.4, by - hh * 0.5, tx, ty); ctx.stroke();
    }
  };
  wall(PI, TAU, fade); spikes(false);
  // Worthington column
  const jk = clamp((k - 0.3) / 0.7);
  if (jk > 0) {
    // organic jet: wobbly tapered neck, rounded top, a teardrop pinching off + two satellite drops
    const rise = Math.sin(Math.min(1, jk * 1.6) * PI / 2), fall = jk > 0.62 ? (jk - 0.62) / 0.38 : 0;
    const jh = 430 * s * rise * (1 - 0.75 * fall * fall), jw = (24 + 14 * (1 - jk)) * s, jA = 1 - fall * 0.7;
    const N = 9, Lp = [], Rp = [];
    for (let j = 0; j <= N; j++) {
      const v = j / N, wob = Math.sin(v * 7 + jk * 9) * 4 * s * v, ww = jw * (1.9 * Math.pow(1 - v, 2.2) + 0.42 + 0.15 * Math.sin(v * 11 + jk * 6));
      Lp.push([x - ww + wob, y - v * jh]); Rp.push([x + ww + wob, y - v * jh]);
    }
    ctx.globalAlpha = jA;
    ctx.fillStyle = lgr(ctx, x - jw * 1.5, 0, x + jw * 1.5, 0, [[0, 'rgba(170,205,240,0.45)'], [0.38, 'rgba(245,250,255,0.85)'], [0.55, 'rgba(225,238,252,0.7)'], [1, 'rgba(160,195,235,0.5)']]);
    ctx.beginPath(); ctx.moveTo(Lp[0][0] - jw * 0.6, y);
    for (let j = 1; j <= N; j++) ctx.lineTo(Lp[j][0], Lp[j][1]);
    const tw = Rp[N][0] - Lp[N][0]; ctx.quadraticCurveTo((Lp[N][0] + Rp[N][0]) / 2, Lp[N][1] - tw * 0.9, Rp[N][0], Rp[N][1]);
    for (let j = N - 1; j >= 0; j--) ctx.lineTo(Rp[j][0], Rp[j][1]);
    ctx.lineTo(Rp[0][0] + jw * 0.6, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rimC + '0.7)'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(Lp[1][0], Lp[1][1]); for (let j = 2; j < N; j++) ctx.lineTo(Lp[j][0] + 3 * s, Lp[j][1]); ctx.stroke();
    // pinching teardrop above the jet
    const sep = jk > 0.3 ? (jk - 0.3) * 160 * s : 0, dr = jw * 0.75, dx = x + Math.sin(jk * 9) * 4 * s, dy = y - jh - dr * 1.2 - sep;
    if (jk > 0.3) {
      ctx.fillStyle = 'rgba(240,248,255,0.9)'; ctx.beginPath(); ctx.moveTo(dx, dy + dr * 1.9); ctx.bezierCurveTo(dx + dr * 1.1, dy + dr * 0.6, dx + dr, dy - dr, dx, dy - dr); ctx.bezierCurveTo(dx - dr, dy - dr, dx - dr * 1.1, dy + dr * 0.6, dx, dy + dr * 1.9); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, dx - dr * 0.35, dy - dr * 0.3, dr * 0.22, dr * 0.32); ctx.fill();
      ctx.fillStyle = 'rgba(235,245,255,0.8)'; ell(ctx, dx + 3 * s, dy - dr - sep * 0.55 - 10 * s, dr * 0.42, dr * 0.5); ctx.fill(); ell(ctx, dx - 4 * s, dy - dr - sep * 0.95 - 22 * s, dr * 0.26, dr * 0.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // droplets
  for (let i = 0; i < 70; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.6, v = (300 + r() * 900) * s, tt = k * 1.15 - r() * 0.1;
    if (tt <= 0) continue;
    const px = x + Math.cos(a) * v * tt, py = y - ch * 0.4 + Math.sin(a) * v * tt + 1500 * s * tt * tt;
    if (py > y + 40 * s) continue;
    const rr = (3 + r() * 8) * s;
    ctx.fillStyle = i % 5 ? `rgba(235,245,255,${0.9 * (1 - k * 0.6)})` : rimC + (0.9 * (1 - k * 0.6)) + ')';
    ell(ctx, px, py, rr, rr * 1.35, a + PI / 2); ctx.fill();
  }
  wall(0, PI, fade * 0.75); spikes(true);
  // foam rings
  ctx.strokeStyle = `rgba(245,250,255,${0.7 * fade})`; ctx.lineWidth = 7 * s; ell(ctx, x, y + 4 * s, cw * 1.25, cw * 1.25 * ryr); ctx.stroke();
  ctx.strokeStyle = `rgba(245,250,255,${0.4 * fade})`; ctx.lineWidth = 3 * s; ell(ctx, x, y + 6 * s, cw * (1.5 + k), cw * (1.5 + k) * ryr); ctx.stroke();
  ctx.restore();
}
function ripplesNight(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, n = o.n ?? 3, R = (o.r ?? 160) * s, ryr = o.ryr ?? 0.3, per = o.period ?? 1.6, A = o.alpha ?? 1;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const p = ((t / per + i / n) % 1 + 1) % 1, rr = R * (0.15 + p), a = A * (1 - p) * Math.min(1, p * 6);
    ctx.strokeStyle = `rgba(10,30,50,${0.35 * a})`; ctx.lineWidth = 6 * s; ell(ctx, x, y + 4 * s, rr, rr * ryr); ctx.stroke();
    ctx.strokeStyle = `rgba(210,232,255,${0.7 * a})`; ctx.lineWidth = 3 * s; ell(ctx, x, y, rr, rr * ryr); ctx.stroke();
  }
  ctx.restore();
}
function bubbles(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, n = o.n ?? 10, w = (o.w ?? 180) * s, ryr = o.ryr ?? 0.3, r = rng(o.seed ?? 13), A = o.alpha ?? 1;
  ctx.save();
  if (o.rings !== 0) ripplesNight(ctx, x, y, s, { t, n: o.rings ?? 3, r: (o.w ?? 180) * 1.6, ryr, period: 2.2, alpha: A * 0.8 });
  // underwater rising bubbles
  if (o.depth > 0) {
    const D = o.depth * s;
    for (let i = 0; i < n * 2; i++) {
      const per = 1 + r() * 1.2, ph = r(), bx = (r() - 0.5) * w, z = (4 + r() * 10) * s;
      const l = ((t / per + ph) % 1 + 1) % 1, py = y + D * (1 - l), px = x + bx + Math.sin(l * 9 + i) * 10 * s;
      ctx.strokeStyle = `rgba(200,230,255,${0.7 * A})`; ctx.lineWidth = 2 * s; ell(ctx, px, py, z, z); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.7 * A})`; ell(ctx, px - z * 0.35, py - z * 0.35, z * 0.3, z * 0.25); ctx.fill();
    }
  }
  // surface domes popping
  for (let i = 0; i < n; i++) {
    const per = 0.7 + r() * 0.9, ph = r(), a0 = r() * TAU, d = Math.sqrt(r());
    const px = x + Math.cos(a0) * w * d, py = y + Math.sin(a0) * w * ryr * d, z = (6 + r() * 12) * s;
    const l = ((t / per + ph) % 1 + 1) % 1;
    if (l < 0.7) {
      const g = ease.out(l / 0.7), zz = z * g;
      ctx.fillStyle = `rgba(150,190,230,${0.25 * A})`; ell(ctx, px, py - zz * 0.45, zz, zz * 0.62); ctx.fill();
      ctx.strokeStyle = `rgba(220,240,255,${0.85 * A})`; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.ellipse(px, py, zz, zz * 0.9, 0, PI, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.9 * A})`; ell(ctx, px - zz * 0.35, py - zz * 0.55, zz * 0.25, zz * 0.18); ctx.fill();
    } else {
      const p = (l - 0.7) / 0.3, rr = z * (1 + p * 2.5);
      ctx.strokeStyle = `rgba(220,240,255,${0.8 * (1 - p) * A})`; ctx.lineWidth = 2 * s; ell(ctx, px, py, rr, rr * ryr * 1.2); ctx.stroke();
      for (let q = 0; q < 4; q++) { const aa = q / 4 * TAU + i; ctx.fillStyle = `rgba(255,255,255,${0.8 * (1 - p) * A})`; ell(ctx, px + Math.cos(aa) * rr * 0.8, py - p * 14 * s + Math.sin(aa) * rr * 0.25, 2 * s, 2 * s); ctx.fill(); }
    }
  }
  ctx.restore();
}
function dropletsSlowmo(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), n = o.n ?? 40, r = rng(o.seed ?? 17), warm = o.warm ?? 0.5, drift = o.drift ?? 1;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.pow(r(), 0.7), z = (4 + r() * 14) * s, ph = r() * TAU, el = 1.1 + r() * 0.6;
    const R = (60 + 320 * ease.out(k)) * s * d;
    const px = x + Math.cos(a) * R + Math.sin(t * 0.4 + ph) * 8 * s * drift, py = y + Math.sin(a) * R * 0.8 - (1 - d) * 30 * s + t * 6 * s * drift * Math.sin(ph);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(Math.sin(a), Math.cos(a)) + PI / 2);
    ctx.fillStyle = rgr(ctx, -z * 0.2, -z * 0.3, 0, 0, 0, z * el, [[0, 'rgba(255,255,255,0.65)'], [0.6, 'rgba(180,215,250,0.28)'], [1, 'rgba(160,200,245,0.55)']]);
    ctx.beginPath(); ctx.moveTo(0, -z * el * 1.2); ctx.bezierCurveTo(z, -z * 0.3, z, z, 0, z); ctx.bezierCurveTo(-z, z, -z, -z * 0.3, 0, -z * el * 1.2); ctx.fill();
    ctx.strokeStyle = 'rgba(230,245,255,0.75)'; ctx.lineWidth = 1.3 * s; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, -z * 0.3, -z * 0.15, z * 0.22, z * 0.32, 0.4); ctx.fill();
    if (warm > 0) { ctx.fillStyle = `rgba(255,200,130,${0.7 * warm})`; ell(ctx, z * 0.35, z * 0.45, z * 0.18, z * 0.12); ctx.fill(); }
    ctx.restore();
    const tw = Math.pow(Math.max(0, Math.sin(t * 3 + ph * 3)), 6);
    if (tw > 0.05) L.sparkle(ctx, px - z * 0.3, py - z * 0.2, z * 2.4 * tw, tw);
  }
  ctx.restore();
}

// ================================================================================================= COMIC
const PAL = {
  fire: { fill: [[0, '#ffffff'], [0.4, '#fff3a8'], [1, '#ffb21e']], stroke: '#3a0c06', glow: 'rgba(255,110,25,0.95)', burst: ['#ffcf3a', '#ff6a1a', '#b8221a'], burstOut: '#2a0806' },
  water: { fill: [[0, '#ffffff'], [0.45, '#dff6ff'], [1, '#7fd2ff']], stroke: '#0a1a3a', glow: 'rgba(60,170,255,0.9)', burst: ['#bff0ff', '#3aa8f0', '#1a4aa8'], burstOut: '#06122a' },
  slap: { fill: [[0, '#ffffff'], [0.45, '#ffe0e8'], [1, '#ff6a8a']], stroke: '#3a0614', glow: 'rgba(255,60,110,0.9)', burst: ['#fff07a', '#ff7a5a', '#d8204a'], burstOut: '#2a0410' },
  frog: { fill: [[0, '#ffffff'], [0.45, '#efffc8'], [1, '#8ee04a']], stroke: '#0e2a0a', glow: 'rgba(120,230,60,0.9)', burst: ['#f6ff9a', '#8ad83a', '#2a7a2a'], burstOut: '#0a1e08' },
  gold: { fill: [[0, '#ffffff'], [0.45, '#fff2c0'], [1, '#ffcf3a']], stroke: '#2a1606', glow: 'rgba(255,200,60,0.9)', burst: ['#fff6b0', '#ffc53a', '#e0801a'], burstOut: '#2a1406' },
};
const CL_WORDS = {
  TOM: { vi: 'TÕM!', en: 'SPLASH!', pal: 'water' },
  PHUNG: { vi: 'PHỪNG!', en: 'WHOOSH!', pal: 'fire' },
  BEP: { vi: 'BÉP!', en: 'SLAP!', pal: 'slap' },
  UM: { vi: 'ÙM!', en: 'SPLOOSH!', pal: 'water' },
  OP: { vi: 'ỘP!', en: 'RIBBIT!', pal: 'frog' },
  WOW: { vi: 'WOW!', en: 'WOW!', pal: 'gold' },
};
function burstPathC(ctx, w, h, n, seed) {
  const r = rng(seed); ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU - PI / 2, f = i % 2 === 0 ? 1 + r() * 0.16 : 0.68 + r() * 0.1; const px = Math.cos(a) * w / 2 * f, py = Math.sin(a) * h / 2 * f; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath();
}
function comicWord(ctx, text, x, y, size = 150, o = {}) {
  const k = o.k ?? 1, t = o.t || 0, out = clamp(o.out || 0);
  if (k <= 0 || out >= 1) return { box: [x, y, x, y] };
  const P = PAL[o.pal || 'fire'] || PAL.fire;
  const pop = k < 1 ? Math.max(0.01, ease.outBack(clamp(k))) : 1 + 0.035 * Math.sin(t * 9);
  const sh = (o.shake ?? 0.4) * size * 0.06, jx = Math.sin(t * 61) * sh, jy = Math.cos(t * 53) * sh;
  ctx.save();
  ctx.translate(x + jx, y + jy); ctx.rotate((o.rot ?? -0.06) + Math.sin(t * 7) * 0.02); const sc = pop * (1 + out * 0.3); ctx.scale(sc, sc);
  ctx.globalAlpha *= 1 - out;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.font = `${size}px BodySansBold`;
  const tw = ctx.measureText(text).width, es = size * 0.36;
  const en = o.en;
  let ew = 0; if (en) { ctx.font = `${es}px BodySansBold`; ew = ctx.measureText(en).width; ctx.font = `${size}px BodySansBold`; }
  const bw = Math.max(tw, ew) * 1.45 + size * 0.8, bh = size * (en ? 2.15 : 1.75), cy = en ? -size * 0.18 : 0;
  // speed lines
  if (o.lines) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineCap = 'round';
    const r = rng(19);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + r() * 0.2, r0 = bw * 0.58, r1 = r0 + size * (0.4 + r() * 0.5); ctx.lineWidth = size * 0.035; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * bh / bw); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * bh / bw); ctx.stroke(); }
  }
  if (o.burst !== false) {
    ctx.save(); ctx.translate(size * 0.05, size * 0.07); burstPathC(ctx, bw, bh, 13, 7); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
    burstPathC(ctx, bw, bh, 13, 7); ctx.lineWidth = size * 0.07; ctx.strokeStyle = P.burstOut; ctx.stroke();
    ctx.fillStyle = rgr(ctx, 0, 0, 4, 0, 0, bw * 0.5, [[0, P.burst[0]], [0.55, P.burst[1]], [1, P.burst[2]]]); ctx.fill();
    burstPathC(ctx, bw * 0.72, bh * 0.72, 13, 9); ctx.fillStyle = 'rgba(255,255,230,0.28)'; ctx.fill();
  }
  // word: glow stroke, dark stroke, fill, highlight
  ctx.font = `${size}px BodySansBold`;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText(text, size * 0.05, cy + size * 0.07);
  ctx.lineWidth = size * 0.34; ctx.strokeStyle = o.glow || P.glow; ctx.strokeText(text, 0, cy);
  ctx.lineWidth = size * 0.2; ctx.strokeStyle = o.stroke || P.stroke; ctx.strokeText(text, 0, cy);
  ctx.fillStyle = o.fill || lgr(ctx, 0, cy - size * 0.5, 0, cy + size * 0.45, P.fill); ctx.fillText(text, 0, cy);
  
  ctx.lineWidth = size * 0.025; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeText(text, -size * 0.012, cy - size * 0.015);
  if (en) {
    ctx.font = `${es}px BodySansBold`; const ey = cy + size * 0.78;
    ctx.lineWidth = es * 0.3; ctx.strokeStyle = o.stroke || P.stroke; ctx.strokeText(en, 0, ey);
    ctx.fillStyle = '#ffffff'; ctx.fillText(en, 0, ey);
  }
  ctx.restore();
  const hw = bw * 0.55 * pop, hh = bh * 0.55 * pop;
  return { box: [x - hw, y - hh, x + hw, y + hh] };
}
function clWord(ctx, key, x, y, size = 150, o = {}) { const p = CL_WORDS[key] || { vi: key, pal: 'fire' }; return comicWord(ctx, o.vi || p.vi, x, y, size, Object.assign({ en: p.en, pal: p.pal }, o)); }

function star5(ctx, x, y, r, rot = 0) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = rot - PI / 2 + i * PI / 5, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
function dizzy(ctx, x, y, s = 1, t = 0, o = {}) {
  const n = o.n ?? 5, R = (o.r ?? 110) * s, ryr = o.ryr ?? 0.32, k = o.k ?? 1;
  if (k <= 0) return;
  const items = [];
  for (let i = 0; i < n; i++) { const a = t * 4.2 + i / n * TAU; items.push({ a, d: Math.sin(a), bird: i % 2 === 1, i }); }
  items.sort((p, q) => p.d - q.d);
  ctx.save(); ctx.globalAlpha *= clamp(k); ctx.lineJoin = 'round';
  // orbit trail
  ctx.strokeStyle = 'rgba(255,240,180,0.35)'; ctx.lineWidth = 3 * s; ell(ctx, x, y, R, R * ryr); ctx.stroke();
  for (const it of items) {
    const px = x + Math.cos(it.a) * R, py = y + Math.sin(it.a) * R * ryr, sc = s * (0.8 + 0.25 * it.d);
    if (it.bird) {
      ctx.save(); ctx.translate(px, py); ctx.scale(sc * (Math.cos(it.a + PI / 2) > 0 ? 1 : -1), sc);
      ell(ctx, 0, 0, 17, 14); ctx.fillStyle = '#7ec8ff'; ctx.fill(); ctx.strokeStyle = '#123050'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ffb21e'; ctx.beginPath(); ctx.moveTo(15, -3); ctx.lineTo(27, 1); ctx.lineTo(15, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      const fl = Math.sin(t * 22 + it.i) * 8;
      ctx.fillStyle = '#5aa8e8'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-14, -18 - fl, -2, -16 - fl); ctx.quadraticCurveTo(2, -10, 4, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ell(ctx, 6, -5, 5, 5); ctx.fill(); ctx.fillStyle = '#111'; ell(ctx, 7, -5, 2.4, 2.4); ctx.fill();
      ctx.restore();
    } else {
      star5(ctx, px, py, 20 * sc, t * 3 + it.i); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = '#4a2a06'; ctx.lineWidth = 3 * s; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, px - 5 * sc, py - 6 * sc, 5 * sc, 3 * sc, -0.6); ctx.fill();
    }
  }
  ctx.restore();
}
function slapMark(ctx, x, y, s = 1, o = {}) {
  const k = o.k ?? 1, t = o.t || 0;
  if (k <= 0) return;
  const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s * pop, s * pop); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // fish-tail print: rounded fan + peduncle
  ctx.beginPath(); ctx.moveTo(-14, 30); ctx.lineTo(-10, 6); ctx.quadraticCurveTo(-60, -20, -50, -50); ctx.quadraticCurveTo(0, -70, 50, -50); ctx.quadraticCurveTo(60, -20, 10, 6); ctx.lineTo(14, 30); ctx.closePath();
  ctx.fillStyle = 'rgba(232,60,80,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(200,30,60,0.6)'; ctx.lineWidth = 3;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 2, 4); ctx.lineTo(i * 14, -52 + Math.abs(i) * 3); ctx.stroke(); }
  // impact lines + stars
  const il = clamp(1 - k / 0.5);
  if (il > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${il})`; ctx.lineWidth = 6;
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + 0.2, r0 = 75 + (1 - il) * 30, r1 = r0 + 45 * il; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + t * 3; star5(ctx, Math.cos(a) * 95, Math.sin(a) * 70, 14 * il + 2, t * 4); ctx.fillStyle = `rgba(255,230,80,${il})`; ctx.fill(); }
  }
  ctx.restore();
}
function steamWisps(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), w = (o.w ?? 160) * s, h = (o.h ?? 320) * s, n = o.n ?? 5, r = rng(o.seed ?? 23), warm = clamp(o.warm || 0), A = (o.alpha ?? 1) * k;
  if (A <= 0) return;
  const col = `${(235 + 20 * warm) | 0},${(242 - 30 * warm) | 0},${(255 - 70 * warm) | 0}`;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const bx = x + (n > 1 ? (i / (n - 1) - 0.5) : 0) * w + (r() - 0.5) * w * 0.2, ph = r() * TAU, per = 2.4 + r() * 1.4, hh = h * (0.7 + r() * 0.5), off = r();
    // one continuous faint curl (single stroke → no beading), faded at both ends by a vertical gradient
    const seg = 12, sway = 18 * s;
    ctx.beginPath();
    for (let j = 0; j <= seg; j++) {
      const v = j / seg, px = bx + Math.sin(v * 5.5 - t * 1.6 + ph) * sway * (0.3 + v) + v * v * 26 * s * Math.sin(ph), py = y - v * hh * 0.85;
      j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.strokeStyle = lgr(ctx, 0, y, 0, y - hh * 0.85, [[0, `rgba(${col},0)`], [0.2, `rgba(${col},${0.2 * A})`], [0.55, `rgba(${col},${0.12 * A})`], [1, `rgba(${col},0)`]]);
    ctx.lineWidth = 12 * s; ctx.stroke();
    // soft puffs drifting up along the curl, growing and fading
    for (let q = 0; q < 4; q++) {
      const l = ((t / per + q / 4 + off) % 1 + 1) % 1, py = y - l * hh;
      const px = bx + Math.sin(l * 5.5 - t * 1.6 + ph) * sway * (0.3 + l) + l * l * 26 * s * Math.sin(ph);
      puff(ctx, 'steam', px, py, (16 + 46 * l) * s, A * 0.42 * Math.sin(Math.min(1, l * 1.25) * PI) * (1 - l * 0.4));
    }
  }
  ctx.restore();
}

module.exports = {
  softPuff, emberGlow, strawFire, sparks, fireSmoke, whoosh, fireLight, torchBeam,
  splashCrown, bubbles, dropletsSlowmo, ripplesNight,
  comicWord, clWord, CL_WORDS, CL_PAL: PAL, dizzy, slapMark, steamWisps, star5,
};
