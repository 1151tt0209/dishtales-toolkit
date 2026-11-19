// ct_fx.js — "Cơm tấm Sài Gòn" effects: charcoal smoke, sizzle, flare-ups, sparks, steam, powder, glaze glints, aroma
// lines, fan whoosh, the big POOF cloud, soot/cough puffs, dizzy stars, bilingual comic words, LIKE / FOLLOW CTA.
// LOCAL in / LOCAL out: (x,y) are in the CURRENT ctx space (camera transforms are fine); returned anchors are in that space.
// THIS HEADER IS THE SOURCE OF TRUTH for the API.   const CT = require('./ctprops');  (re-exports everything below)
// =====================================================================================================================
// CONVENTIONS
//  • Every drawer save()/restore()s and is deterministic from t / k / o.seed (seeded L.rng, no Math.random, no ctx.filter).
//  • s = uniform scale (sizes below are at s = 1). k = intensity (0..1, some accept >1) or, where noted, LIFE 0..1 of a
//    one-shot effect (drive it with inv(t0, t1, T)).
//  • Glows use 'screen' / 'lighter', so draw fx AFTER the scene they light. Puff sprites are cached (module-level, lazy).
//  • Timings (this PC, 1080×1920, flushed): see _test_ct_foodfx.js output; most fx ≈ 2–4 ms at typical sizes;
//    dense charcoalSmoke ≈ 11 ms, poofCloud ≈ 9 ms at full cover and ≈ 11–15 ms while thinning (k .4–.95).
//
// ------------------------------------------------------------------------------------------------- SMOKE / STEAM
//  charcoalSmoke(ctx,t,{x,y (source centre), w=260 (source width), h=1000 (rise), n (default 14+22·density ≤ 40),
//        density=.6 (0 wispy … 1 thick), tint='warm'|'neon'|'cool'|'grey'|'dawn' or {top:[r,g,b], bot:[r,g,b]},
//        drift=140 (px sideways at the top, + = right), alpha=1, s=1 (puff size), seed=1,
//        light:{x,y,r,col:[r,g,b],k} (puffs drifting through a lamp/neon pool get lit), neonX (x splitting pink|cyan
//        rim in 'neon', default x)})   textured 2-tone puffs (lit top, ember-warm or neon underside), slow curls.
//  steam(ctx,t,{x,y,w=160,h=360,n=9,k=1,s=1,seed=3,warm=0 (0 white … 1 sun-peach),alpha=1})
//        translucent rising food steam (stretched curling wisps). Put (x,y) on the food surface.
//  sootPuff(ctx,t,x,y,k,{s=1,n=7,h=160,seed}) little dark smoke wisps rising from a smouldering head/hair (k = amount).
//  coughSmoke(ctx,t,x,y,k,{s=1,dir:[.75,-.55] (unit-ish), seed}) LIFE k 0..1 (~0.9 s): a grey smoke RING pops out of the
//        mouth at (x,y), travels ~170 px along dir, widens and fades; 3 small trailing puffs.
//  poofCloud(ctx,t,x,y,s,k,{seed=5, tint (underside colour [r,g,b], default warm ember), light=[r,g,b] (top),
//        debris=true}) → {r (current half-width), alpha}
//        LIFE k 0..1 (plan ≈ 3.5–4 s from the POOF): k 0–.07 explodes out from (x,y) (shock ring, debris, streaks) ·
//        .07–.32 FULL COVER: 34 cel-shaded billows (rendered at half res, one blit), opaque core ellipse ≈ 760 wide × 1040 tall at s=1 centred on
//        (x,y) (put (x,y) at the person's chest; covers a 900-px-tall person at s≈1) · .32–1 slowly thins: billows
//        swell, rise ~180 px, turn into soft translucent smoke and fade (≈ 50 % at k .6, gone at 1).
//
// ------------------------------------------------------------------------------------------------- FIRE / COOKING
//  sizzle(ctx,t,x,y,k,{r=110, ryr=.5, n=36 (bubbles), spat=18 (spatter drops), s=1, seed, col='255,226,150'})
//        tiny popping oil bubbles inside an ellipse r×r·ryr + ballistic hot-oil spatters (screen). k 0..1+.
//  flareUp(ctx,t,x,y,k,{s=1, seed}) LIFE k 0..1 (~0.5–0.8 s): fat-drip flame burst from the coals at (x,y):
//        peak at k≈.15 (≈ 190 px tall), yellow-white core, orange tongues, glow; dies down by k=1.
//  sparks(ctx,t,{x,y,w=240,h=520,n=40 (≤140),k=1,s=1,wind=0,seed, t0 (optional: one-shot BURST at t0, ballistic,
//        lasts 1.1 s, e.g. each fan stroke / flip)})   rising ember streaks (lighter).
//  embersGlow(ctx,t,x,y,w,h,{k=1 (fanning: up to 2), seed}) pulsing orange heat over a coal bed + flickering hot dots.
//  powderPuff(ctx,t,x,y,k,{s=1,seed,col=[214,160,92]}) LIFE k 0..1: golden thính dust cloud puffs up and drifts/settles.
//  glazeSparkle(ctx,t,x,y,r,k,{n=6, ryr=1, seed, size=1}) 4-point star glints twinkling inside an ellipse.
//
// ------------------------------------------------------------------------------------------------- CARTOON
//  smellLines(ctx,t,from,to,k,{n=3, gap=26, s=1, col=[255,236,200], amp=16, waves=3}) wavy cartoon aroma ribbons
//        travelling from→to ([x,y]); k 0..1 = how far the heads have reached (they keep undulating).
//  fanWhoosh(ctx,t,x,y,k,{r=190, a0=-2.3, a1=-0.5 (swing arc, rad), s=1, seed}) motion-blur smears of a fan swinging
//        about the pivot (x,y) (wrist) + white speed lines + air puffs. k 0..1+ intensity (frantic = 1).
//  dizzyStars(ctx,t,x,y,s,{n=5, r=110, ryr=.32, k=1}) yellow stars orbiting a head (x,y = top of head).
//  comicWord(ctx,t,x,y,vi,en,{size=150, k (pop-in 0..1; default from t0), t0, out 0..1 (fade/grow out), rot=-.07,
//        shake=.35, pal='sizzle'|'poof'|'cough'|'yum'|'gold', burst=false|'star'|'cloud', lines=false, safe=true})
//        → {box:[x0,y0,x1,y1], x, y}
//        Vietnamese word big, cream-yellow gradient, thick dark outline + palette glow; English smaller, white.
//        outBack pop, small jitter. safe=true shifts/shrinks so the box stays inside x 70–930, y 60–1560 (assumes
//        identity transform). Presets: CT_WORDS.XEO ('XÈO XÈO!'/'SIZZLE!'), PHU ('PHÙ!'/'POOF!'), KHU ('KHỤ!'/'COUGH!'),
//        NGON ('NGON!'/'YUM!'), WOW → ctWord(ctx,t,key,x,y,o).
//  heartPop(ctx,T,x,y,s,{t0, tap=t0}) LIKE badge (port of caloc s22 ctaLike): dark disc pops in at t0, heart turns red
//        and pulses at tap + glow + "+1"; labels THÍCH / LIKE under it.  T = absolute time.
//  followButton(ctx,T,x,y,{t0, tap, hand=true, confetti=true}) pill button slides in at t0, pressed at tap (plan:
//        64.533) → grey "ĐÃ THEO DÕI / FOLLOWING" + check, glow, confetti; cartoon hand taps it.
//
// ------------------------------------------------------------------------------------------------- UTIL (CTFXU)
//  CTFXU = {ell, lgr, rgr, mixc, rgba, puffSprite(kind,variant), tintPuff(variant, top, bot), puff(ctx,img,x,y,r,a,rot,
//        sx,sy), star4(ctx,x,y,r,a), nz(t,p)}  used by ct_food.js.
// =====================================================================================================================
'use strict';
const L = require('./lib');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease } = L;
const PI = Math.PI;
try { GlobalFonts.registerFromPath('C:/Windows/Fonts/seguibl.ttf', 'CTBlack'); } catch (e) { /* falls back */ }

// ------------------------------------------------------------------ small helpers
function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
function lgr(ctx, x0, y0, x1, y1, st) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of st) g.addColorStop(clamp(o), c); return g; }
function rgr(ctx, x0, y0, r0, x1, y1, r1, st) { const g = ctx.createRadialGradient(x0, y0, Math.max(0, r0), x1, y1, Math.max(0.01, r1)); for (const [o, c] of st) g.addColorStop(clamp(o), c); return g; }
function hexA(c) { if (Array.isArray(c)) return c; const h = c.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mixc(a, b, t) { const A = hexA(a), B = hexA(b), k = clamp(t); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`; }
function rgba(c, a) { const A = hexA(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
const nz = (t, p = 0) => Math.sin(t * 1.7 + p) * 0.5 + Math.sin(t * 2.9 + p * 1.3 + 1) * 0.3 + Math.sin(t * 5.3 + p * 2.1 + 2) * 0.2;
const smooth = (a, b, x) => { const f = clamp((x - a) / (b - a)); return f * f * (3 - 2 * f); };

// ------------------------------------------------------------------ cached puff sprites
const SPR = {};
// kind 'soft' plain radial; 'tex' lumpy cloudy alpha mask (variant 0..3); 'wisp' elongated streaky
function puffSprite(kind, v = 0) {
  const key = kind + v; if (SPR[key]) return SPR[key];
  const N = 192, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2;
  if (kind === 'soft') {
    x.fillStyle = rgr(x, h, h, 0, h, h, h, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, N, N);
  } else if (kind === 'tex') {
    const r = rng(101 + v * 17);
    for (let i = 0; i < 22; i++) {
      const a = r() * TAU, d = r() * N * 0.26, rr = N * (0.1 + r() * 0.2), px = h + Math.cos(a) * d, py = h + Math.sin(a) * d;
      x.fillStyle = rgr(x, px, py, 0, px, py, rr, [[0, `rgba(255,255,255,${0.32 + r() * 0.3})`], [1, 'rgba(255,255,255,0)']]);
      x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    // a few darker holes for structure
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 3; i++) { const px = h + (r() - 0.5) * N * 0.5, py = h + (r() - 0.5) * N * 0.5, rr = N * (0.12 + r() * 0.1); x.fillStyle = rgr(x, px, py, 0, px, py, rr, [[0, 'rgba(0,0,0,0.16)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = rgr(x, h, h, 0, h, h, h, [[0, 'rgba(0,0,0,1)'], [0.55, 'rgba(0,0,0,0.85)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, N, N);
  } else if (kind === 'wisp') {
    const r = rng(303 + v * 11);
    for (let i = 0; i < 14; i++) {
      const px = h + (r() - 0.5) * N * 0.3, py = h + (r() - 0.5) * N * 0.7, rx = N * (0.04 + r() * 0.06), ry = N * (0.15 + r() * 0.2);
      x.save(); x.translate(px, py); x.rotate((r() - 0.5) * 0.6); x.scale(rx / 10, ry / 10);
      x.fillStyle = rgr(x, 0, 0, 0, 0, 0, 10, [[0, `rgba(255,255,255,${0.25 + r() * 0.25})`], [1, 'rgba(255,255,255,0)']]); x.fillRect(-10, -10, 20, 20); x.restore();
    }
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = rgr(x, h, h, 0, h, h, h, [[0, 'rgba(0,0,0,1)'], [0.6, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, N, N);
  }
  return (SPR[key] = c);
}
// two-tone tinted copy of a sprite (top colour → bottom colour), cached (colours quantised)
const TINT = {};
function tintPuff(kind, v, top, bot) {
  const q = (c) => hexA(c).map(n => Math.round(n / 6) * 6);
  const T = q(top), B = q(bot || top), key = kind + v + T.join() + '|' + B.join();
  if (TINT[key]) return TINT[key];
  const base = puffSprite(kind, v), N = base.width, c = createCanvas(N, N), x = c.getContext('2d');
  x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-in';
  x.fillStyle = lgr(x, 0, N * 0.2, 0, N * 0.85, [[0, `rgb(${T})`], [1, `rgb(${B})`]]); x.fillRect(0, 0, N, N);
  const keys = Object.keys(TINT); if (keys.length > 160) delete TINT[keys[0]];
  return (TINT[key] = c);
}
function puff(ctx, img, x, y, r, a, rot = 0, sx = 1, sy = 1) {
  if (a <= 0.004 || r <= 0.5) return;
  const ga = ctx.globalAlpha; ctx.globalAlpha = ga * Math.min(1, a);
  if (rot || sx !== 1 || sy !== 1) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy); ctx.drawImage(img, -r, -r, r * 2, r * 2); ctx.restore(); }
  else ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = ga;
}
function glowR(ctx, x, y, r, col, a = 1, mode = 'screen') {
  if (a <= 0.004 || r < 1) return;
  ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha *= Math.min(1, a);
  ctx.fillStyle = rgr(ctx, x, y, 0, x, y, r, [[0, col], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function star4(ctx, x, y, r, a) {
  if (a <= 0.01 || r < 0.5) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, a); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,250,235,1)';
  ctx.beginPath(); ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.09, -r * 0.09, r, 0); ctx.quadraticCurveTo(r * 0.09, r * 0.09, 0, r); ctx.quadraticCurveTo(-r * 0.09, r * 0.09, -r, 0); ctx.quadraticCurveTo(-r * 0.09, -r * 0.09, 0, -r); ctx.fill();
  ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, r * 0.55, [[0, 'rgba(255,240,200,0.9)'], [1, 'rgba(255,200,120,0)']]); ctx.fillRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1);
  ctx.restore();
}

// ================================================================================================= CHARCOAL SMOKE
const SMOKE_TINTS = {
  warm: { top: [150, 150, 160], bot: [205, 120, 70] },
  cool: { top: [150, 165, 190], bot: [80, 92, 120] },
  grey: { top: [175, 175, 178], bot: [95, 95, 100] },
  neon: { top: [120, 128, 168], bot: [70, 62, 110] },
  dawn: { top: [255, 214, 190], bot: [170, 140, 150] },
};
function charcoalSmoke(ctx, t, o = {}) {
  const x = o.x ?? 540, y = o.y ?? 1400, w = o.w ?? 260, h = o.h ?? 1000, den = clamp(o.density ?? 0.6), A = o.alpha ?? 1;
  const n = Math.min(40, o.n ?? Math.round(14 + 22 * den)), drift = o.drift ?? 140, s = o.s ?? 1, r = rng(o.seed ?? 1);
  const tint = typeof o.tint === 'object' ? o.tint : SMOKE_TINTS[o.tint || 'warm'] || SMOKE_TINTS.warm;
  const neon = o.tint === 'neon', nx = o.neonX ?? x, Lt = o.light;
  const wispy = den < 0.35;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const v = i % 4, ph = r(), sp = (0.055 + r() * 0.05) * (1000 / Math.max(300, h)) ** 0.3, bx = (r() - 0.5) * w, r0 = (55 + r() * 60) * s, rs = (r() - 0.5) * 0.6, p2 = r() * 9;
    const life = (t * sp + ph) % 1;
    const rise = 1 - Math.pow(1 - life, 1.35);
    const py = y - rise * h;
    const px = x + bx * (1 + life * 0.9) + drift * Math.pow(life, 1.5) + nz(t * 0.35, p2) * 70 * life * s;
    const rad = r0 * (0.45 + life * 1.9) * (0.75 + den * 0.45);
    const env = smooth(0, 0.12, life) * (1 - smooth(0.55, 1, life));
    let a = A * env * (wispy ? 0.32 : 0.28 + den * 0.42);
    if (a < 0.01) continue;
    const rot = p2 + t * rs, sx = wispy ? 0.55 : 1, sy = wispy ? 1.5 : 1;
    puff(ctx, tintPuff(wispy ? 'wisp' : 'tex', v, tint.top, tint.bot), px, py, rad, a, wispy ? Math.sin(t * 0.5 + p2) * 0.4 : rot, sx, sy);
    if (neon || Lt) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      if (neon) {
        const side = clamp((px - nx) / (w + 200) * 1.4 + 0.5);
        puff(ctx, tintPuff('tex', v, [255, 70, 190], [200, 40, 160]), px - rad * 0.12, py, rad, a * 0.7 * (1 - side), rot, sx, sy);
        puff(ctx, tintPuff('tex', v, [60, 230, 255], [30, 150, 220]), px + rad * 0.12, py, rad, a * 0.7 * side, rot, sx, sy);
      }
      if (Lt) {
        const d = Math.hypot(px - Lt.x, py - Lt.y), lk = (Lt.k ?? 1) * clamp(1 - d / (Lt.r ?? 400));
        if (lk > 0.01) puff(ctx, tintPuff('tex', v, Lt.col || [255, 190, 120], Lt.col || [255, 150, 80]), px, py, rad, a * lk * 1.2, rot, sx, sy);
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

// ================================================================================================= STEAM
function steam(ctx, t, o = {}) {
  const x = o.x ?? 540, y = o.y ?? 960, w = o.w ?? 160, h = o.h ?? 360, n = Math.min(40, o.n ?? 9), k = o.k ?? 1, s = o.s ?? 1, A = (o.alpha ?? 1) * k;
  if (A <= 0) return;
  const r = rng(o.seed ?? 3), warm = clamp(o.warm || 0);
  const top = [lerp(250, 255, warm), lerp(252, 226, warm), lerp(255, 205, warm)], bot = [lerp(235, 255, warm), lerp(240, 210, warm), lerp(250, 190, warm)];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.32 + r() * 0.25, bx = (r() - 0.5) * w, p2 = r() * 9, rr = (26 + r() * 30) * s, v = i % 4;
    for (let j = 0; j < 2; j++) {
      const life = (t * sp + ph + j * 0.5) % 1;
      const py = y - life * h * (0.8 + 0.2 * ph);
      const px = x + bx + Math.sin(life * 5 + p2 + t * 1.2) * 26 * s * life + nz(t * 0.6, p2) * 10 * s;
      const env = smooth(0, 0.18, life) * (1 - smooth(0.45, 1, life));
      puff(ctx, tintPuff('wisp', v, top, bot), px, py, rr * (0.7 + life * 1.6), A * env * 0.55, Math.sin(t + p2) * 0.5 * life, 0.75, 1.35);
    }
  }
  ctx.restore();
}

// ================================================================================================= SIZZLE
function sizzle(ctx, t, x, y, k = 1, o = {}) {
  if (k <= 0) return;
  const R = o.r ?? 110, ryr = o.ryr ?? 0.5, s = o.s ?? 1, nb = Math.min(120, Math.round((o.n ?? 36) * Math.min(1.5, k))), ns = Math.min(80, Math.round((o.spat ?? 18) * Math.min(1.5, k)));
  const col = o.col || '255,226,150', r = rng(o.seed ?? 7);
  ctx.save();
  ctx.lineWidth = 1.3 * s;
  for (let i = 0; i < nb; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R, per = 0.22 + r() * 0.4, ph = r(), br = (2 + r() * 5) * s;
    const life = (t / per + ph) % 1, bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d * ryr;
    const rr = br * (0.3 + life * 0.9);
    if (life < 0.85) {
      ctx.globalAlpha = Math.min(1, k) * 0.85;
      ctx.fillStyle = `rgba(${col},0.18)`; ell(ctx, bx, by, rr, rr * 0.9); ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.75)`; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,245,0.95)'; ell(ctx, bx - rr * 0.35, by - rr * 0.35, rr * 0.28, rr * 0.25); ctx.fill();
    } else { // pop ring
      const pk = (life - 0.85) / 0.15; ctx.globalAlpha = Math.min(1, k) * (1 - pk) * 0.7;
      ctx.strokeStyle = `rgba(${col},0.9)`; ell(ctx, bx, by, rr * (1 + pk * 1.4), rr * (1 + pk * 1.4) * 0.8); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < ns; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R * 0.9, per = 0.35 + r() * 0.45, ph = r(), ang = -PI / 2 + (r() - 0.5) * 2.2, v = (160 + r() * 260) * s;
    const life = (t / per + ph) % 1, tt = life * per;
    const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d * ryr;
    const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v, g = 1400 * s;
    const px = bx + vx * tt, py = by + vy * tt + 0.5 * g * tt * tt;
    const qx = bx + vx * (tt - 0.03), qy = by + vy * (tt - 0.03) + 0.5 * g * (tt - 0.03) ** 2;
    ctx.globalAlpha = Math.min(1, k) * (1 - life) * 0.9;
    ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = (1.6 + r() * 1.6) * s;
    ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
  }
  ctx.restore();
}

// ================================================================================================= FLARE-UP
function tongue(ctx, x, y, w, h, sway) {
  ctx.beginPath(); ctx.moveTo(x - w, y);
  ctx.bezierCurveTo(x - w * 0.95, y - h * 0.45, x + sway - w * 0.35, y - h * 0.7, x + sway * 1.5, y - h);
  ctx.bezierCurveTo(x + sway + w * 0.35, y - h * 0.68, x + w * 0.95, y - h * 0.42, x + w, y);
  ctx.closePath();
}
function flareUp(ctx, t, x, y, k, o = {}) {
  if (k <= 0 || k >= 1) return;
  const s = o.s ?? 1, r = rng(o.seed ?? 11);
  const env = k < 0.15 ? ease.out(k / 0.15) : Math.pow(1 - (k - 0.15) / 0.85, 1.6);
  const H0 = 190 * s * env;
  glowR(ctx, x, y - H0 * 0.3, 260 * s * (0.5 + env), 'rgba(255,140,40,0.85)', env);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const ox = (r() - 0.5) * 70 * s, hh = H0 * (0.45 + r() * 0.55) * (0.8 + 0.2 * Math.sin(t * 23 + i * 2)), ww = (16 + r() * 22) * s * (0.6 + env * 0.6), sw = Math.sin(t * 13 + i * 1.9) * 18 * s;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = lgr(ctx, 0, y, 0, y - hh, [[0, 'rgba(255,245,200,0.95)'], [0.25, 'rgba(255,196,70,0.85)'], [0.65, 'rgba(240,90,20,0.55)'], [1, 'rgba(150,20,5,0)']]);
    tongue(ctx, x + ox, y, ww, hh, sw); ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = lgr(ctx, 0, y, 0, y - H0 * 0.45, [[0, 'rgba(255,255,240,1)'], [1, 'rgba(255,220,120,0)']]);
  tongue(ctx, x, y, 22 * s * env + 4, H0 * 0.45, Math.sin(t * 17) * 6 * s); ctx.fill();
  ctx.restore();
}

// ================================================================================================= SPARKS / EMBERS
function sparks(ctx, t, o = {}) {
  const x = o.x ?? 540, y = o.y ?? 1300, w = o.w ?? 240, h = o.h ?? 520, s = o.s ?? 1, k = o.k ?? 1, wind = o.wind || 0;
  const burst = o.t0 !== undefined, age = burst ? t - o.t0 : 0;
  if (k <= 0 || (burst && (age < 0 || age > 1.1))) return;
  const n = Math.min(140, o.n ?? 40), r = rng(o.seed ?? 21);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const bx = (r() - 0.5) * w, sp = 0.45 + r() * 0.8, ph = r(), p2 = r() * 9, sz = (1.3 + r() * 2.2) * s, ang = -PI / 2 + (r() - 0.5) * 1.6 + wind * 0.4, v = (350 + r() * 650) * s;
    let px, py, qx, qy, life;
    if (burst) {
      const tt = age * (0.8 + r() * 0.4); life = tt / 1.1; if (life >= 1) continue;
      const vx = Math.cos(ang) * v, vy = Math.sin(ang) * v, drag = Math.exp(-tt * 1.8);
      const f = (1 - drag) / 1.8;
      px = x + bx * 0.4 + vx * f + Math.sin(tt * 9 + p2) * 12 * s; py = y + vy * f + 160 * s * tt * tt;
      const f2 = (1 - Math.exp(-(tt - 0.035) * 1.8)) / 1.8;
      qx = x + bx * 0.4 + vx * f2; qy = y + vy * f2 + 160 * s * (tt - 0.035) ** 2;
    } else {
      life = (t * sp * 0.6 + ph) % 1;
      const yy = life * h, sw = Math.sin(t * 2.6 + p2 + life * 5) * 30 * s * life + wind * 160 * life * life;
      px = x + bx * (1 - life * 0.3) + sw; py = y - yy;
      const l2 = life - 0.03; qx = x + bx * (1 - l2 * 0.3) + Math.sin(t * 2.6 + p2 + l2 * 5) * 30 * s * l2 + wind * 160 * l2 * l2; qy = y - l2 * h - 10 * s;
    }
    const fl = 0.65 + 0.35 * Math.sin(t * 31 + i * 3.1), a = k * (1 - life) * fl;
    const col = life < 0.25 ? '255,244,200' : life < 0.6 ? '255,178,70' : '240,90,30';
    ctx.globalAlpha = Math.min(1, a) * 0.35; ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = sz * 3.2;
    ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
    ctx.globalAlpha = Math.min(1, a); ctx.lineWidth = sz; ctx.stroke();
  }
  ctx.restore();
}
function embersGlow(ctx, t, x, y, w, h, o = {}) {
  const k = o.k ?? 1; if (k <= 0) return;
  const r = rng(o.seed ?? 31);
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const gx = x + nz(t * 0.7, i * 3) * w * 0.3, gy = y + nz(t * 0.5, i * 5 + 1) * h * 0.25, pulse = 0.7 + 0.3 * Math.sin(t * (3 + i) + i);
    ctx.save(); ctx.translate(gx, gy); ctx.scale(1, h / w);
    glowR(ctx, 0, 0, w * 0.55, i % 2 ? 'rgba(255,120,30,0.7)' : 'rgba(255,170,60,0.6)', Math.min(1.2, k * pulse * 0.6));
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  const n = Math.min(80, Math.round(30 * Math.min(2, k)));
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * w, py = y + (r() - 0.5) * h, ph = r() * TAU, f = r() * 4 + 3, sz = 1.5 + r() * 3.5;
    const fl = Math.max(0, Math.sin(t * f + ph)); if (fl < 0.2) continue;
    ctx.globalAlpha = Math.min(1, fl * k * 0.8);
    ctx.fillStyle = fl > 0.8 ? '#fff0b0' : '#ff9a3a'; ell(ctx, px, py, sz, sz * 0.7); ctx.fill();
  }
  ctx.restore();
}

// ================================================================================================= POWDER / GLINTS
function powderPuff(ctx, t, x, y, k, o = {}) {
  if (k <= 0 || k >= 1) return;
  const s = o.s ?? 1, r = rng(o.seed ?? 41), col = o.col || [214, 160, 92];
  const e = ease.out(clamp(k / 0.35)), fade = 1 - smooth(0.25, 1, k);
  ctx.save();
  for (let i = 0; i < 12; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.6, d = (60 + r() * 150) * s, rr = (40 + r() * 50) * s, v = i % 4;
    const px = x + Math.cos(a) * d * e + nz(t * 0.5, i) * 15 * s, py = y + Math.sin(a) * d * e - k * 60 * s;
    puff(ctx, tintPuff('tex', v, [col[0] + 30, col[1] + 30, col[2] + 25], col), px, py, rr * (0.5 + e * 0.9 + k * 0.5), 0.55 * fade, r() * TAU);
  }
  // fine dust particles
  for (let i = 0; i < 90; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.8, v = (120 + r() * 380) * s, tt = k * 1.4, drag = (1 - Math.exp(-tt * 3)) / 3;
    const px = x + Math.cos(a) * v * drag + Math.sin(t * 2 + i) * 8 * s, py = y + Math.sin(a) * v * drag + 50 * s * tt * tt;
    const sz = (1 + r() * 2.2) * s;
    ctx.globalAlpha = fade * (0.5 + r() * 0.5);
    ctx.fillStyle = r() < 0.5 ? `rgb(${col})` : `rgb(${col[0] - 50},${col[1] - 55},${col[2] - 45})`; ctx.fillRect(px, py, sz, sz);
  }
  ctx.restore();
}
function glazeSparkle(ctx, t, x, y, R, k = 1, o = {}) {
  if (k <= 0) return;
  const n = o.n ?? 6, ryr = o.ryr ?? 1, r = rng(o.seed ?? 51), sz = o.size ?? 1;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R, per = 0.7 + r() * 0.9, ph = r(), base = (14 + r() * 16) * sz;
    const life = (t / per + ph) % 1, tw = Math.pow(Math.sin(life * PI), 3);
    star4(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * ryr, base * (0.3 + tw), k * tw);
  }
  ctx.restore();
}

// ================================================================================================= AROMA / FAN
function smellLines(ctx, t, from, to, k = 1, o = {}) {
  if (k <= 0) return;
  const n = o.n ?? 3, s = o.s ?? 1, gap = (o.gap ?? 26) * s, col = o.col || [255, 236, 200], amp = (o.amp ?? 16) * s, waves = o.waves ?? 3;
  const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const head = clamp(k), SEG = 36;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * gap, ph = i * 1.7, lag = i * 0.06;
    const hk = clamp(head * (1 + lag * 2) - lag);
    if (hk <= 0) continue;
    const pts = [];
    for (let j = 0; j <= SEG; j++) {
      const u = j / SEG * hk, wv = Math.sin(u * waves * TAU - t * 5 + ph) * amp * (0.3 + u * 0.9) * (1 + 0.3 * Math.sin(t * 2 + i));
      const bend = Math.sin(u * PI) * off * 0.6;
      pts.push([from[0] + dx * u + px * (off * (0.4 + u * 0.6) + wv + bend * 0), from[1] + dy * u + py * (off * (0.4 + u * 0.6) + wv)]);
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 1; j < pts.length; j++) {
        const u = j / SEG, taper = Math.sin(clamp(u / Math.max(0.05, hk)) * PI * 0.92 + 0.08) * (u < 0.15 ? u / 0.15 : 1);
        ctx.globalAlpha = (pass ? 0.9 : 0.22) * taper;
        ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = (pass ? 6 : 16) * s * (0.5 + 0.5 * taper);
        ctx.beginPath(); ctx.moveTo(pts[j - 1][0], pts[j - 1][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
      }
    }
    // curl at the head
    const hp = pts[pts.length - 1];
    ctx.globalAlpha = 0.85 * smooth(0.1, 0.3, hk); ctx.lineWidth = 5 * s; ctx.strokeStyle = rgba(col, 1);
    ctx.beginPath(); ctx.arc(hp[0] + px * 8 * s, hp[1] + py * 8 * s, 9 * s, Math.atan2(uy, ux) - PI * 0.2 + t * 2, Math.atan2(uy, ux) + PI * 1.2 + t * 2); ctx.stroke();
  }
  ctx.restore();
}
function fanWhoosh(ctx, t, x, y, k = 1, o = {}) {
  if (k <= 0) return;
  const s = o.s ?? 1, R = (o.r ?? 190) * s, a0 = o.a0 ?? -2.3, a1 = o.a1 ?? -0.5, r = rng(o.seed ?? 61);
  const sw = 0.5 + 0.5 * Math.sin(t * 22), cur = lerp(a0, a1, sw), dir = Math.cos(t * 22) >= 0 ? 1 : -1;
  ctx.save(); ctx.lineCap = 'round';
  // smear crescent behind the current fan angle
  for (let i = 0; i < 6; i++) {
    const back = cur - dir * (i + 1) * 0.12, aa = Math.min(1, k) * (0.22 - i * 0.03);
    if (aa <= 0) break;
    ctx.globalAlpha = aa; ctx.fillStyle = 'rgba(235,215,160,1)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, R, Math.min(back, cur), Math.max(back, cur)); ctx.closePath(); ctx.fill();
  }
  // white arc strokes across the whole swing
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  for (let i = 0; i < 4; i++) {
    const rr = R * (0.55 + i * 0.17), ph = (t * 3 + i * 0.27) % 1;
    ctx.globalAlpha = Math.min(1, k) * 0.7 * Math.sin(ph * PI); ctx.lineWidth = (7 - i) * s;
    const aa0 = lerp(a0, a1, ph * 0.5), aa1 = lerp(a0, a1, 0.5 + ph * 0.5);
    ctx.beginPath(); ctx.arc(x, y, rr * 1.08, aa0, aa1); ctx.stroke();
  }
  // straight speed lines out of the swing end
  for (let i = 0; i < 10; i++) {
    const a = lerp(a0, a1, r()) + (r() - 0.5) * 0.2, d0 = R * (1.1 + r() * 0.25), ln = (50 + r() * 90) * s, ph = (t * (2 + r() * 2) + r()) % 1;
    const d = d0 + ph * 60 * s;
    ctx.globalAlpha = Math.min(1, k) * 0.8 * Math.sin(ph * PI); ctx.lineWidth = (2 + r() * 3) * s;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.lineTo(x + Math.cos(a) * (d + ln), y + Math.sin(a) * (d + ln)); ctx.stroke();
  }
  // little air puffs
  for (let i = 0; i < 4; i++) {
    const a = lerp(a0, a1, (i + 0.5) / 4), ph = (t * 2.4 + i * 0.25) % 1, d = R * (1 + ph * 0.6);
    puff(ctx, puffSprite('soft'), x + Math.cos(a) * d, y + Math.sin(a) * d, (12 + ph * 30) * s, Math.min(1, k) * 0.35 * (1 - ph));
  }
  ctx.restore();
}

// ================================================================================================= POOF / SOOT / COUGH
const BILL = {};
function billowSprite(light, mid, dark) {
  const key = [light, mid, dark].join('|'); if (BILL[key]) return BILL[key];
  const N = 200, c = createCanvas(N, N), x = c.getContext('2d'), h = N / 2, R = h * 0.95;
  // cel-shaded cartoon billow: flat light body, soft mid crescent lower-right, darker underside, thin soft outline
  x.save(); x.beginPath(); x.arc(h, h, R, 0, TAU); x.clip();
  x.fillStyle = `rgb(${light})`; x.fillRect(0, 0, N, N);
  x.fillStyle = rgr(x, h - R * 0.28, h - R * 0.34, R * 0.55, h - R * 0.28, h - R * 0.34, R * 1.45, [[0, `rgba(${mid},0)`], [0.35, `rgba(${mid},0.85)`], [1, `rgba(${mid},1)`]]);
  x.fillRect(0, 0, N, N);
  x.fillStyle = rgr(x, h - R * 0.2, h - R * 0.45, R * 1.05, h - R * 0.2, h - R * 0.45, R * 1.75, [[0, `rgba(${dark},0)`], [0.5, `rgba(${dark},0.7)`], [1, `rgba(${dark},0.9)`]]);
  x.fillRect(0, 0, N, N);
  // a couple of soft inner lumps on the lit side
  const r = rng(77);
  for (let i = 0; i < 4; i++) { const px = h - R * (0.1 + r() * 0.4), py = h - R * (0.15 + r() * 0.4), rr = R * (0.18 + r() * 0.16); x.fillStyle = rgr(x, px, py, 0, px, py, rr, [[0, `rgba(255,255,255,0.22)`], [1, 'rgba(255,255,255,0)']]); x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  x.restore();
  x.strokeStyle = `rgba(${dark},0.55)`; x.lineWidth = N * 0.022; x.beginPath(); x.arc(h, h, R - N * 0.011, 0, TAU); x.stroke();
  return (BILL[key] = c);
}
// half-resolution scratch buffer for the big poof (fill-rate bound); allocated once, reused every frame
const PBUF = [];
// buffer i (0/1) at half the target's size; draws at scale f (≤ .5) into its top-left corner
function halfBuf(ctx, i, f) {
  const cw = ctx.canvas.width, chh = ctx.canvas.height, w = Math.ceil(cw / 2), h = Math.ceil(chh / 2);
  let B = PBUF[i]; if (!B || B.c.width !== w || B.c.height !== h) { const c = createCanvas(w, h); B = PBUF[i] = { c, x: c.getContext('2d') }; }
  const X = B.x; X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.clearRect(0, 0, Math.ceil(cw * f) + 2, Math.ceil(chh * f) + 2);
  const m = ctx.getTransform(); X.setTransform(m.a * f, m.b * f, m.c * f, m.d * f, m.e * f, m.f * f);
  return X;
}
function poofCloud(ctx, t, x, y, s = 1, k = 0, o = {}) {
  if (k <= 0 || k >= 1) return { r: 0, alpha: 0 };
  const r = rng(o.seed ?? 5), under = o.tint || [150, 105, 85], top = o.light || [226, 222, 220];
  const mid = [Math.round(top[0] * 0.55 + under[0] * 0.45), Math.round(top[1] * 0.55 + under[1] * 0.45), Math.round(top[2] * 0.55 + under[2] * 0.45)];
  const dark = [Math.round(under[0] * 0.62), Math.round(under[1] * 0.6), Math.round(under[2] * 0.62)];
  const spr = billowSprite(top, mid, dark);
  const ex = ease.outExpo(clamp(k / 0.07)), thin = smooth(0.32, 1, k), solid = 1 - smooth(0.3, 0.62, k);
  const rise = thin * 180 * s, swell = 1 + thin * 0.55;
  ctx.save();
  // shock ring at the explosion
  if (k < 0.16) {
    const rk = k / 0.16;
    ctx.save(); ctx.globalAlpha *= (1 - rk) * 0.8; ctx.strokeStyle = 'rgba(255,240,220,1)'; ctx.lineWidth = 26 * s * (1 - rk);
    ell(ctx, x, y + 300 * s, 700 * s * ease.out(rk), 190 * s * ease.out(rk)); ctx.stroke(); ctx.restore();
  }
  // billows (drawn into a half-res buffer, then one blit)
  const B = [];
  for (let i = 0; i < 34; i++) {
    const u = r(), v = r(), a = u * TAU, rr0 = Math.sqrt(v);
    let hx = Math.cos(a) * rr0 * 290, hy = Math.sin(a) * rr0 * 420 - 70;
    if (i < 5) { hx = (i - 2) * 140; hy = 400 + r() * 40; } // wide base row
    else if (i < 9) { hx = (i - 6.5) * 130; hy = -470 + r() * 40; } // crown so the head is always buried
    const rad = 150 + r() * 110 - rr0 * 40;
    B.push({ hx, hy, rad, ph: r() * TAU, dr: (r() - 0.5) * 0.6, out: r() });
  }
  B.sort((p, q) => p.hy - q.hy + (p.out - q.out) * 120); // upper billows behind, lower ones in front
  // solid billows are drawn OPAQUE (into their own buffer while cross-fading, so they fade as one group, not as see-through bubbles);
  // the soft smoke they turn into goes underneath. Smoke-only phase renders at 1/3 res.
  const useBuf = !!(ctx.canvas && ctx.getTransform), f = solid > 0.01 ? 0.5 : 0.34;
  const g = useBuf ? halfBuf(ctx, 0, f) : ctx;
  const smokeK = (1 - solid) * (1 - thin) * 1.25, sep = useBuf && solid > 0.01 && solid < 0.99;
  const gs = sep ? halfBuf(ctx, 1, f) : g;
  const pos = B.map((b) => {
    const boil = 1 + 0.05 * Math.sin(t * 3 + b.ph);
    return [x + b.hx * s * ex * swell + b.dr * thin * 160 * s, y + b.hy * s * ex * (1 + thin * 0.2) - rise * (1 - b.hy / 900), b.rad * s * (0.35 + 0.65 * ex) * boil * swell];
  });
  if (smokeK > 0.01) B.forEach((b, i) => { if (k < 0.62 ? i % 2 === 0 : i % 3 !== 2) puff(g, tintPuff('tex', (b.ph * 3 | 0) % 4, top, under), pos[i][0], pos[i][1], pos[i][2] * 1.35, smokeK * 0.85, b.ph); });
  if (solid > 0.01) B.forEach((b, i) => puff(gs, spr, pos[i][0], pos[i][1], pos[i][2], sep ? 1 : solid));
  // rim light on the crown at peak (only on cloud pixels)
  if (solid > 0.05) glowR(gs, x - 120 * s, y - 420 * s * ex - rise, 420 * s * ex, 'rgba(255,244,230,0.45)', sep ? 1 : solid, 'source-atop');
  if (sep) { const G = PBUF[0].x; G.save(); G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = solid; const c1 = PBUF[1].c; G.drawImage(c1, 0, 0, c1.width, c1.height); G.restore(); }
  if (useBuf) {
    const cw = ctx.canvas.width, chh = ctx.canvas.height;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(PBUF[0].c, 0, 0, cw * f, chh * f, 0, 0, cw, chh); ctx.restore();
  }
  // debris (charcoal bits + sparks) & speed streaks early on (full res)
  if (o.debris !== false && k < 0.3) {
    const dk = k / 0.3, ga = ctx.globalAlpha;
    ctx.lineCap = 'round';
    for (let i = 0; i < 28; i++) {
      const a = r() * TAU, v = (700 + r() * 900) * s, tt = dk * 0.9, f = (1 - Math.exp(-tt * 3)) / 3;
      const px = x + Math.cos(a) * v * f, py = y + Math.sin(a) * v * f * 0.8 + 600 * s * tt * tt;
      ctx.globalAlpha = ga * (1 - dk);
      if (i % 3 === 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb04a'; ell(ctx, px, py, 4 * s, 4 * s); ctx.fill(); ctx.restore(); }
      else { ctx.fillStyle = '#1c1612'; ctx.save(); ctx.translate(px, py); ctx.rotate(i + t * 9); ctx.fillRect(-6 * s, -4 * s, 12 * s, 8 * s); ctx.restore(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + r() * 0.2, d0 = 420 * s * ease.out(dk) + 200 * s, ln = 120 * s * (1 - dk);
      ctx.globalAlpha = ga * (1 - dk) * 0.8; ctx.lineWidth = 6 * s * (1 - dk) + 1;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0 * 1.2); ctx.lineTo(x + Math.cos(a) * (d0 + ln), y + Math.sin(a) * (d0 + ln) * 1.2); ctx.stroke();
    }
  }
  ctx.restore();
  return { r: 380 * s * ex * swell, alpha: Math.max(solid, (1 - thin)) };
}
function sootPuff(ctx, t, x, y, k = 1, o = {}) {
  if (k <= 0) return;
  const s = o.s ?? 1, n = o.n ?? 7, H2 = (o.h ?? 160) * s, r = rng(o.seed ?? 71);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const per = 1.4 + r() * 0.9, ph = (t / per + r()) % 1, bx = (r() - 0.5) * 60 * s, v = i % 4;
    const px = x + bx + Math.sin(ph * 6 + t * 1.5 + i) * 16 * s * ph, py = y - ph * H2;
    puff(ctx, tintPuff('tex', v, [110, 108, 108], [45, 42, 42]), px, py, (10 + 34 * ph) * s, k * Math.sin(ph * PI) * 0.7, i + t * 0.5);
  }
  ctx.restore();
}
function coughSmoke(ctx, t, x, y, k, o = {}) {
  if (k <= 0 || k >= 1) return;
  const s = o.s ?? 1, d = o.dir || [0.75, -0.55], dl = Math.hypot(d[0], d[1]) || 1, ux = d[0] / dl, uy = d[1] / dl, r = rng(o.seed ?? 81);
  const e = ease.out(k), dist = 170 * s * e, cx = x + ux * dist, cy = y + uy * dist, R = (14 + 50 * e) * s, fade = 1 - smooth(0.45, 1, k);
  const ang = Math.atan2(uy, ux);
  ctx.save();
  // trailing puffs
  for (let i = 0; i < 3; i++) { const f = (i + 1) / 4; puff(ctx, tintPuff('tex', i, [190, 190, 192], [110, 110, 115]), x + ux * dist * f * 0.8, y + uy * dist * f * 0.8, (10 + 18 * e) * s * (1 - f * 0.4), fade * 0.55 * (1 - f * 0.5), i); }
  // ring: puffs around a tilted ellipse (perpendicular to travel)
  const N2 = 14;
  for (let i = 0; i < N2; i++) {
    const a = i / N2 * TAU + k * 2, ex = Math.cos(a) * R * 0.38, ey = Math.sin(a) * R;
    const px = cx + ex * Math.cos(ang) - ey * Math.sin(ang), py = cy + ex * Math.sin(ang) + ey * Math.cos(ang);
    const front = Math.cos(a) > 0;
    puff(ctx, tintPuff('tex', i % 4, front ? [215, 215, 218] : [160, 160, 165], [100, 100, 106]), px, py, (9 + 12 * e) * s * (0.9 + r() * 0.3), fade * 0.8, a);
  }
  ctx.restore();
}

// ================================================================================================= DIZZY STARS
function starPath(ctx, x, y, R, rot = 0) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = rot - PI / 2 + i * PI / 5, rr = i % 2 ? R * 0.46 : R; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
function dizzyStars(ctx, t, x, y, s = 1, o = {}) {
  const n = o.n ?? 5, R = (o.r ?? 110) * s, ryr = o.ryr ?? 0.32, k = o.k ?? 1; if (k <= 0) return;
  const items = []; for (let i = 0; i < n; i++) { const a = t * 4.2 + i / n * TAU; items.push({ a, d: Math.sin(a), i }); }
  items.sort((p, q) => p.d - q.d);
  ctx.save(); ctx.globalAlpha *= clamp(k); ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,240,180,0.35)'; ctx.lineWidth = 3 * s; ell(ctx, x, y, R, R * ryr); ctx.stroke();
  for (const it of items) {
    const px = x + Math.cos(it.a) * R, py = y + Math.sin(it.a) * R * ryr, sc = s * (0.8 + 0.25 * it.d);
    starPath(ctx, px, py, 22 * sc, t * 3 + it.i);
    ctx.fillStyle = lgr(ctx, 0, py - 22 * sc, 0, py + 22 * sc, [[0, '#fff6a0'], [1, '#ffb81c']]); ctx.fill();
    ctx.strokeStyle = '#3a2208'; ctx.lineWidth = 3.5 * sc; ctx.stroke();
  }
  ctx.restore();
}

// ================================================================================================= COMIC WORD
const PAL = {
  sizzle: { glow: 'rgba(255,120,30,0.95)', burst: ['#ffe27a', '#ff8a2a', '#c8301a'] },
  poof: { glow: 'rgba(150,150,165,0.95)', burst: ['#f4f4f6', '#b8b8c2', '#6a6a78'] },
  cough: { glow: 'rgba(120,130,110,0.9)', burst: ['#e8ecd8', '#a8b098', '#5a6250'] },
  yum: { glow: 'rgba(255,60,110,0.9)', burst: ['#fff07a', '#ff7a5a', '#d8204a'] },
  gold: { glow: 'rgba(255,200,60,0.9)', burst: ['#fff6b0', '#ffc53a', '#e0801a'] },
};
const CT_WORDS = {
  XEO: { vi: 'XÈO XÈO!', en: 'SIZZLE!', pal: 'sizzle' },
  PHU: { vi: 'PHÙ!', en: 'POOF!', pal: 'poof', burst: 'cloud' },
  KHU: { vi: 'KHỤ!', en: 'COUGH!', pal: 'cough' },
  NGON: { vi: 'NGON!', en: 'YUM!', pal: 'yum' },
  WOW: { vi: 'WOW!', en: 'WOW!', pal: 'gold' },
};
function burstStar(ctx, w, h, n, seed) { const r = rng(seed); ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU - PI / 2, f = i % 2 === 0 ? 1 + r() * 0.14 : 0.7 + r() * 0.08; const px = Math.cos(a) * w / 2 * f, py = Math.sin(a) * h / 2 * f; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); }
function burstCloud(ctx, w, h, n, seed) {
  const r = rng(seed); ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2, f = 1.08 + r() * 0.1;
    const p0 = [Math.cos(a0) * w / 2, Math.sin(a0) * h / 2], p1 = [Math.cos(a1) * w / 2, Math.sin(a1) * h / 2], c = [Math.cos(am) * w / 2 * f * 1.12, Math.sin(am) * h / 2 * f * 1.12];
    if (i === 0) ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(c[0], c[1], p1[0], p1[1]);
  }
  ctx.closePath();
}
function comicWord(ctx, t, x, y, vi, en, o = {}) {
  let k = o.k; if (k === undefined) k = o.t0 !== undefined ? clamp((t - o.t0) / 0.35) : 1;
  const out = clamp(o.out || 0);
  if (k <= 0 || out >= 1) return { box: [x, y, x, y], x, y };
  const P = PAL[o.pal || 'sizzle'] || PAL.sizzle, FONT = 'CTBlack';
  let size = o.size ?? 150;
  ctx.save();
  ctx.font = `${size}px ${FONT}`; let tw = ctx.measureText(vi).width;
  let es = size * 0.4; ctx.font = `${es}px ${FONT}`; let ew = en ? ctx.measureText(en).width : 0;
  const pad = size * 0.22;
  let bw = Math.max(tw, ew) + pad * 2, bh = size * (en ? 1.55 : 1.15) + pad;
  if (o.burst) { bw *= 1.3; bh *= 1.35; }
  const safe = o.safe !== false;
  if (safe && bw * 1.06 > 860) { const f = 860 / (bw * 1.06); size *= f; es *= f; tw *= f; ew *= f; bw *= f; bh *= f; }
  if (safe) { const hw = bw * 0.53, hh = bh * 0.53; x = clamp(x, 70 + hw, 930 - hw); y = clamp(y, 60 + hh, 1560 - hh); }
  const pop = k < 1 ? Math.max(0.01, ease.outBack(clamp(k))) : 1 + 0.03 * Math.sin(t * 9);
  const sh = (o.shake ?? 0.35) * size * 0.05, jx = Math.sin(t * 61) * sh, jy = Math.cos(t * 53) * sh;
  ctx.translate(x + jx, y + jy); ctx.rotate((o.rot ?? -0.07) + Math.sin(t * 6) * 0.015); const sc = pop * (1 + out * 0.25); ctx.scale(sc, sc);
  ctx.globalAlpha *= 1 - out; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const cy = en ? -size * 0.2 : 0, ey = cy + size * 0.74;
  if (o.lines) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; const r = rng(19);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + r() * 0.2, r0 = 0.62, r1 = r0 + 0.2 + r() * 0.25; ctx.lineWidth = size * 0.035; ctx.beginPath(); ctx.moveTo(Math.cos(a) * bw * r0, Math.sin(a) * bh * r0); ctx.lineTo(Math.cos(a) * bw * r1, Math.sin(a) * bh * r1); ctx.stroke(); }
  }
  if (o.burst) {
    const path = () => (o.burst === 'cloud' ? burstCloud(ctx, bw, bh, 11, 5) : burstStar(ctx, bw, bh, 12, 7));
    ctx.save(); ctx.translate(size * 0.05, size * 0.08); path(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
    path(); ctx.lineWidth = size * 0.07; ctx.strokeStyle = '#24140a'; ctx.stroke();
    ctx.fillStyle = rgr(ctx, 0, -bh * 0.1, 4, 0, 0, bw * 0.55, [[0, P.burst[0]], [0.6, P.burst[1]], [1, P.burst[2]]]); ctx.fill();
  }
  // Vietnamese: drop shadow, palette glow, thick dark outline, cream-yellow fill, top highlight
  ctx.font = `${size}px ${FONT}`;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(vi, size * 0.04, cy + size * 0.08);
  ctx.lineWidth = size * 0.3; ctx.strokeStyle = P.glow; ctx.globalAlpha *= 0.85; ctx.strokeText(vi, 0, cy); ctx.globalAlpha /= 0.85;
  ctx.lineWidth = size * 0.17; ctx.strokeStyle = '#26130a'; ctx.strokeText(vi, 0, cy);
  ctx.fillStyle = lgr(ctx, 0, cy - size * 0.45, 0, cy + size * 0.4, [[0, '#fffbe6'], [0.45, '#fff0b0'], [1, '#ffcf55']]); ctx.fillText(vi, 0, cy);
  ctx.save(); ctx.beginPath(); ctx.rect(-bw, cy - size, bw * 2, size * 0.86); ctx.clip();
  ctx.lineWidth = size * 0.022; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeText(vi, -size * 0.01, cy - size * 0.012); ctx.restore();
  if (en) {
    ctx.font = `${es}px ${FONT}`; ctx.letterSpacing = `${Math.round(es * 0.06)}px`;
    ctx.lineWidth = es * 0.32; ctx.strokeStyle = '#26130a'; ctx.strokeText(en, 0, ey);
    ctx.fillStyle = '#ffffff'; ctx.fillText(en, 0, ey);
  }
  ctx.restore();
  const hw = bw * 0.53 * pop, hh = bh * 0.53 * pop;
  return { box: [x - hw, y - hh, x + hw, y + hh], x, y };
}
function ctWord(ctx, t, key, x, y, o = {}) { const p = CT_WORDS[key] || { vi: key, en: '' }; return comicWord(ctx, t, x, y, o.vi || p.vi, o.en ?? p.en, Object.assign({ pal: p.pal, burst: p.burst }, o)); }

// ================================================================================================= CTA (port of caloc s22)
function heartShape(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-10, 20, -60, -5, -60, -35); ctx.bezierCurveTo(-60, -65, -20, -75, 0, -45);
  ctx.bezierCurveTo(20, -75, 60, -65, 60, -35); ctx.bezierCurveTo(60, -5, 10, 20, 0, 30); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -30, -42, 12, 7, -0.6); ctx.fill();
  ctx.restore();
}
function checkMark(ctx, x, y, s, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 7 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.lineTo(x - 3 * s, y + 11 * s); ctx.lineTo(x + 16 * s, y - 12 * s); ctx.stroke(); ctx.restore();
}
function fitFont(ctx, txt, size, fam, maxW) { let fs = size; ctx.font = `${fs}px ${fam}`; while (ctx.measureText(txt).width > maxW && fs > 20) { fs -= 2; ctx.font = `${fs}px ${fam}`; } return fs; }
const BEAT = 8 / 15;
const hitT = (T, t0, sharp = 6) => { const b = (((T - t0) / BEAT) % 1 + 1) % 1; return Math.exp(-b * sharp); };
function heartPop(ctx, T, x, y, s = 1, o = {}) {
  const t0 = o.t0 ?? 0, tap = o.tap ?? t0, k = T - t0; if (k < 0) return;
  const pop = ease.outBack(clamp(k / 0.4)), tapped = T >= tap, pulse = tapped ? 1 + 0.14 * hitT(T, tap, 7) : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= clamp(k / 0.15);
  ctx.beginPath(); ctx.arc(0, 0, 105 * pop, 0, TAU); ctx.fillStyle = 'rgba(10,8,30,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.stroke();
  heartShape(ctx, 0, 12, 1.15 * pop * pulse, tapped ? '#fe2c55' : 'rgba(255,255,255,0.9)');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '38px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.fillText('THÍCH', 0, 150); ctx.font = '30px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('LIKE', 0, 192);
  const f = clamp((T - tap) / 1.2);
  if (f > 0 && f < 1) { ctx.globalAlpha = Math.sin(f * PI); ctx.font = '60px BodySansBold'; ctx.fillStyle = '#ff5c7a'; ctx.fillText('+1', 110, -90 - f * 120); }
  ctx.restore();
  const tk = T - tap; if (tk >= 0 && tk < 0.35) glowR(ctx, x, y, 220 * s, 'rgba(255,120,150,0.9)', 1 - tk / 0.35);
}
function ctaConfetti(ctx, T, t0, x, y) {
  const k = T - t0; if (k < 0 || k > 2.2) return;
  const r = rng(515), cols = ['#fe2c55', '#25f4ee', '#ffd76a', '#ffffff', '#ff9ad6'];
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.8, v = 500 + r() * 700, sz = 8 + r() * 10, spin = (r() - 0.5) * 16, c = cols[i % cols.length];
    const px = x + Math.cos(a) * v * k * 0.7, py = y + Math.sin(a) * v * k * 0.7 + 700 * k * k;
    ctx.globalAlpha = clamp(1 - k / 2.2); ctx.fillStyle = c;
    ctx.save(); ctx.translate(px, py); ctx.rotate(spin * k); ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
  }
  ctx.restore();
}
function ctaHand(ctx, T, tp, x, y) {
  const k = T - (tp - 2 / 3); if (k < 0 || T > tp + 0.9) return;
  const appr = ease.out(clamp(k / 0.5)), back = ease.in(clamp((T - tp - 0.3) / 0.5)), off = (1 - appr) * 420 + back * 420;
  ctx.save(); ctx.translate(x + 30 + off * 0.6, y + 30 + off); ctx.rotate(-0.5); ctx.globalAlpha *= 1 - back;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-16, -10, 32, 90, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-40, 50, 90, 110, 34); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-56, 64, 34, 60, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-30, 150, 70, 60, 10); ctx.fillStyle = '#fe2c55'; ctx.fill(); ctx.stroke();
  ctx.restore();
}
function followButton(ctx, T, x, y, o = {}) {
  const t0 = o.t0 ?? 0, tp = o.tap ?? t0 + 0.67, k = T - t0; if (k < 0) return;
  const sl = ease.outBack(clamp(k / 0.5)), pressed = T >= tp, pk = T - tp;
  const press = pk >= 0 && pk < 0.25 ? 1 - Math.sin(pk / 0.25 * PI) * 0.12 : 1, w = 330, h = 120;
  ctx.save(); ctx.translate(x + (1 - sl) * 500, y); ctx.scale(press, press);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = pressed ? '#5a5a60' : '#fe2c55'; ctx.fill();
  ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!pressed) {
    ctx.font = '46px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOW', 0, -14);
    ctx.font = '28px BodySansBold'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THEO DÕI', 0, 30);
  } else {
    checkMark(ctx, -118, -12, 1.4, '#fff');
    ctx.letterSpacing = '1px'; ctx.fillStyle = '#ffe6b0'; fitFont(ctx, 'ĐÃ THEO DÕI', 40, 'BodySansBold', 210); ctx.fillText('ĐÃ THEO DÕI', 24, -14);
    ctx.font = '28px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOWING', 24, 30);
  }
  ctx.restore();
  if (pk >= 0 && pk < 0.4) glowR(ctx, x, y, 260, 'rgba(255,240,220,0.9)', 1 - pk / 0.4);
  if (pk >= 0 && o.confetti !== false) ctaConfetti(ctx, T, tp, x, y);
  if (o.hand !== false) ctaHand(ctx, T, tp, x, y);
}

const CTFXU = { ell, lgr, rgr, mixc, rgba, hexA, puffSprite, tintPuff, puff, star4, nz, glowR, smooth, tongue };
module.exports = {
  charcoalSmoke, steam, sizzle, flareUp, sparks, embersGlow, powderPuff, glazeSparkle, smellLines, fanWhoosh,
  poofCloud, sootPuff, coughSmoke, dizzyStars, comicWord, ctWord, CT_WORDS, heartPop, followButton, CTFXU,
};
