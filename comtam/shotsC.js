'use strict';
// shotsC.js — "Cơm tấm Sài Gòn" shots 16..23 (39.467 – 68.267 s). 112.5 BPM grid: beat 8/15 s.
// Act III: the tourist "helps" fan the grill → POOF → sooty reveal + cough → Cô Năm takes over, wipes his face
// (raccoon stripe) → first bite "Ngon bá cháy!" → end card → LIKE / FOLLOW CTA.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes and grain.
// Custom alley camera views are registered at load time in CT.CT_ENV.VIEWS (ct_env caches layers per view name,
// so each view gets crisp native-resolution caches; the zoom of a view is fixed, small pushes are done with ctx).
const CT = require('./ctprops');
const X = require('./text');
const L = require('./lib');
const PE = require('./people');
const { W, H, TAU, rng, clamp, lerp, inv, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- views (base 1080x1920 alley coords)
const VW = CT.CT_ENV.VIEWS;
Object.assign(VW, {
  cFan: { z: 2.25, cx: 392, cy: 975 },   // s16 grill + Cô Năm + tourist two-shot
  cFan2: { z: 2.45, cx: 372, cy: 975 },   // s17/s18 tighter on the frantic fanning
  cStiff: { z: 3.4, cx: 478, cy: 930 },   // s19 sooty reveal (cowboy shot)
  cSit: { z: 2.0, cx: 715, cy: 1150 },    // s20 Cô Năm steers him to the stool
  cEat: { z: 2.7, cx: 805, cy: 1150 },    // s21 first bite
});

// ---------------------------------------------------------------- helpers
const BEAT = 8 / 15;
const seg = (T, a, b) => clamp((T - a) / (b - a));
const kick = (T, t0, dec = 7) => (T >= t0 ? Math.exp(-(T - t0) * dec) : 0);
function shake(T, t0, amp, dec = 3) {
  const k = T - t0; if (k < 0) return [0, 0];
  const e = amp * Math.exp(-k * dec);
  return [Math.sin(k * 71) * e, Math.cos(k * 53) * e * 0.8];
}
// push-in about (cx,cy) by z >= 1 with an optional shake offset; never reveals the canvas edge.
function push(ctx, cx, cy, z, sh, fn) {
  const sx = sh ? sh[0] : 0, sy = sh ? sh[1] : 0;
  const zz = Math.max(z, 1 + 2.2 * Math.max(Math.abs(sx) / W, Math.abs(sy) / H) + 0.002);
  ctx.save();
  ctx.translate(cx + sx, cy + sy); ctx.scale(zz, zz); ctx.translate(-cx, -cy);
  // clamp: with zz>=1 scaling about any interior point keeps the frame covered; the shake margin is in zz
  fn();
  ctx.restore();
}
const dawnAt = (T) => lerp(0.86, 1, ease.sine(seg(T, 39.467, 57.6)));
const neonAt = (T) => lerp(0.5, 0.3, seg(T, 39.467, 57.6));
const pt = (q) => (Array.isArray(q) ? { x: q[0], y: q[1] } : q);

// draws the alley in layers with callbacks for characters between them
function alleyScene(ctx, T, view, o, behind, mid, seated) {
  const base = { view, dawn: o.dawn, neon: o.neon, smoke: o.smoke, heat: o.heat, steam: o.steam };
  const a = CT.alley(ctx, T, { ...base, layer: 'back' });
  if (behind) behind(a);
  CT.alley(ctx, T, { ...base, layer: 'cart' });
  if (mid) mid(a);
  CT.alley(ctx, T, { ...base, layer: 'stools' });
  if (seated) seated(a);
  if (o.front !== false) CT.alley(ctx, T, { ...base, layer: 'front' });
  return a;
}
// character lighting for the alley at dawn
function lit(a, T, d, nn, ember = 0.45, er = 420) {
  return {
    dawn: d,
    light: { x: a.grill.x, y: a.grill.y, k: ember, r: er * a.zoom / 2 },
    neon: { col: 'pink', k: nn * 0.7, x: a.neon.x, y: a.neon.y },
  };
}
// Cô Năm behind the grill: lifted so her chest and arms clear the backsplash (feet hidden by the cart body)
const VEND = { X: -1.32, Y: 0.5, Z: 7.9 };
const TOUR = { X: -0.2, Z: 6.6 };
// cached full-frame plate (+ blurred copy) for static backgrounds
const BGC = {};
function xPlate(key, blur, drawFn) {
  if (!BGC[key]) {
    const a = createCanvas(W, H), ax = a.getContext('2d');
    ax.fillStyle = '#000'; ax.fillRect(0, 0, W, H); drawFn(ax);
    const b = createCanvas(W, H), bx = b.getContext('2d');
    bx.drawImage(a, 0, 0);
    if (blur > 0) { bx.filter = `blur(${blur}px)`; bx.drawImage(a, 0, 0); bx.filter = 'none'; }
    BGC[key] = b;
  }
  return BGC[key];
}

// ================================================================================== s16
// 39.467 – 42.667  "Để tôi quạt cho!"  he lunges in and grabs the fan (grip on the 40.533 beat), steps back holding
// it up; Cô Năm crosses her arms and raises an eyebrow on the 41.067 beat.
function s16(ctx, lt, p, T) {
  const d = dawnAt(T), nn = neonAt(T);
  const lunge = T < 40.533 ? ease.out(seg(T, 40.0, 40.533)) : 1 - ease.inOut(seg(T, 40.533, 41.0));
  const tx = TOUR.X - 0.2 * lunge;
  push(ctx, 420, 1000, lerp(1, 1.06, ease.inOut(p)), null, () => {
    alleyScene(ctx, T, 'cFan', { dawn: d, neon: nn, smoke: 0.7, heat: 1.1 },
      (a) => {
        const v = a.proj(VEND.X, VEND.Y, VEND.Z), s = a.sAt(VEND.Z);
        const L0 = lit(a, T, d, nn, 0.5);
        if (T < 40.533) CT.coNam(ctx, v[0], v[1], s, { ...L0, pose: 'fan', k: 0.65, t: T, expr: T < 40.2 ? 'focus' : 'o', shadow: false });
        else if (T < 41.067) CT.coNam(ctx, v[0], v[1], s, { ...L0, pose: 'stand', t: T, expr: 'o', lookX: 0.8, shadow: false });
        else CT.coNam(ctx, v[0], v[1], s, { ...L0, pose: 'eyebrow', t: T, expr: 'skeptic', lookX: 0.9, tilt: -0.06 * ease.outBack(seg(T, 41.067, 41.35)), shadow: false });
      },
      (a) => {
        const f = a.proj(tx, 0, TOUR.Z), s = a.sAt(TOUR.Z);
        const hopY = -12 * a.zoom * Math.sin(seg(T, 40.533, 41.0) * PI);
        const L0 = lit(a, T, d, nn, 0.45);
        if (T < 40.0) CT.tourist(ctx, f[0], f[1], s, { ...L0, pose: 'stand', flip: true, t: T, expr: 'grin', lookX: 0.6 });
        else CT.tourist(ctx, f[0], f[1] + hopY, s, { ...L0, pose: 'grabFan', k: ease.out(seg(T, 40.0, 40.76)), flip: true, t: T, expr: T < 40.533 ? 'o' : 'grin', lookX: T > 41.2 ? -0.3 : 0.6 });
      });
  });
  X.line(ctx, T, 39.617, 42.567, 'Để tôi quạt cho!', 'Let me help!');
}

// ================================================================================== s17
// 42.667 – 44.8  frantic fanning: ghost arms, speed lines, embers brighter, smoke builds into a cloud
function fanScene(ctx, T, ramp, opt = {}) {
  const d = dawnAt(T), nn = neonAt(T);
  let A = null;
  const a = alleyScene(ctx, T, 'cFan2', { dawn: d, neon: nn, smoke: 0.8 + 1.0 * ramp, heat: 1.2 + 1.0 * ramp },
    (a) => {
      const v = a.proj(VEND.X, VEND.Y, VEND.Z), s = a.sAt(VEND.Z);
      const L0 = lit(a, T, d, nn, 0.5 + 0.2 * ramp);
      if (opt.vendor) opt.vendor(a, v, s, L0);
      else CT.coNam(ctx, v[0], v[1], s, { ...L0, pose: 'eyebrow', t: T, expr: ramp > 0.55 ? 'o' : 'skeptic', lookX: 0.9, lean: -0.05 * ramp, shadow: false });
    },
    (a) => {
      const g = a.grill, z = a.zoom;
      CT.embersGlow(ctx, T, g.x, g.y + 6 * z, 120 * z, 26 * z, { k: 1 + ramp });
      const f = a.proj(TOUR.X, 0, TOUR.Z), s = a.sAt(TOUR.Z);
      if (opt.tourist) A = opt.tourist(a, f, s);
      else A = CT.tourist(ctx, f[0], f[1], s, { ...lit(a, T, d, nn, 0.45 + 0.25 * ramp), pose: 'fanFrantic', rate: 6.5, flip: true, t: T, expr: 'strain' });
    });
  return { a, A };
}
// thick grey smoke mass rising from the grill and swirling round the fanner
function smokeMass(ctx, T, a, k, seed = 4) {
  const g = a.grill, z = a.zoom;
  CT.charcoalSmoke(ctx, T, { x: g.x + 50 * z, y: g.y - 10 * z, w: 170 * z, h: 520 * z, density: 0.5 + 0.5 * k, tint: 'grey', drift: 160 * z, alpha: 0.35 + 0.55 * k, s: z / 1.6, seed });
}
function s17(ctx, lt, p, T) {
  const ramp = ease.in2(p);
  push(ctx, 420, 980, lerp(1, 1.07, p), shake(T, 42.667, 3, 0.1), () => {
    const R = fanScene(ctx, T, ramp);
    const a = R.a, g = a.grill, z = a.zoom;
    CT.sparks(ctx, T, { x: g.x, y: g.y, w: 110 * z, h: 360 * z, n: 30 + 60 * ramp, k: 0.6 + 0.6 * ramp, s: z / 2, wind: -40, seed: 17 });
    if (R.A && R.A.fan) CT.fanWhoosh(ctx, T, R.A.fan.grip[0], R.A.fan.grip[1], 0.7 + 0.3 * ramp, { s: z / 2.2, a0: -2.6, a1: -1.2, seed: 62 });
    smokeMass(ctx, T, a, ramp);
  });
}

// ================================================================================== s18
// 44.8 – 46.933  coals flare (45.067, 45.6) → POOF at 45.867 swallows him completely
const POOF = 45.867, POOF_LIFE = 3.8;
const poofK = (T) => (T - POOF) / POOF_LIFE;
const poofC = (a) => a.proj(TOUR.X - 0.04, 0.85, TOUR.Z);
function s18(ctx, lt, p, T) {
  const k = poofK(T), hidden = k > 0.06;
  push(ctx, 420, 980, lerp(1.07, 1.1, p), shake(T, POOF, 30, 4.5), () => {
    const R = fanScene(ctx, T, 1, {
      vendor: T < POOF ? null : (a, v, s, L0) => CT.coNam(ctx, v[0], v[1], s, { ...L0, pose: 'stand', t: T, expr: 'o', lookX: 1, lean: -0.08, shadow: false }),
      tourist: !hidden ? null : (a, f, s) => CT.tourist(ctx, f[0], f[1], s, { ...lit(a, T, dawnAt(T), neonAt(T), 0.3), pose: 'stiff', flip: true, t: T, soot: 1, hairUp: 1, smokeWisps: 1 }),
    });
    const a = R.a, g = a.grill, z = a.zoom;
    if (T < POOF) {
      CT.sparks(ctx, T, { x: g.x, y: g.y, w: 110 * z, h: 380 * z, n: 90, k: 1.1, s: z / 2, wind: -40, seed: 18 });
      if (R.A && R.A.fan) CT.fanWhoosh(ctx, T, R.A.fan.grip[0], R.A.fan.grip[1], 1, { s: z / 2.2, a0: -2.6, a1: -1.2, seed: 62 });
      smokeMass(ctx, T, a, 1);
      for (const tf of [45.067, 45.6]) { const u = seg(T, tf, tf + 0.6); if (u > 0 && u < 1) CT.flareUp(ctx, T, g.x, g.y, u, { s: z / 2 * (tf > 45.5 ? 1.3 : 0.9), seed: tf * 10 | 0 }); }
    } else {
      const u = seg(T, POOF - 0.05, POOF + 0.7);
      if (u < 1) CT.flareUp(ctx, T, g.x, g.y, u, { s: z / 2 * 1.8, seed: 9 });
      CT.sparks(ctx, T, { x: g.x, y: g.y, w: 160 * z, h: 520 * z, n: 110, k: 1, s: z / 2, seed: 19, t0: POOF });
      const c = poofC(a);
      CT.poofCloud(ctx, T, c[0], c[1], 1.28 * z / 2.45, k, { seed: 5 });
    }
  });
  if (T >= POOF) CT.ctWord(ctx, T, 'PHU', 540, 300, { t0: POOF, size: 170 });
}

// ================================================================================== s19
// 46.933 – 50.133  cloud thins (silence 47.467–48.533: only the cloud moves) → stiff sooty reveal, blinks,
// cough + smoke ring on 49.067 "KHỤ!"
function s19(ctx, lt, p, T) {
  const d = dawnAt(T), nn = neonAt(T), k = poofK(T);
  const tf = T < 48.533 ? 47.2 : T;                               // character motion frozen during the silence
  const cough = T >= 49.067 && T < 49.55;
  let blink = 0;
  for (const [b0, b1] of [[48.6, 48.76], [48.82, 48.98], [49.8, 49.95]]) { const u = seg(T, b0, b1); if (u > 0 && u < 1) blink = Math.sin(u * PI); }
  push(ctx, 540, 760, 1 + 0.035 * kick(T, 49.067, 5) + 0.012 * seg(T, 48.533, 50.133), shake(T, 49.067, 9, 7), () => {
    let A = null;
    const a = alleyScene(ctx, T, 'cStiff', { dawn: d, neon: nn, smoke: 0.5, heat: 1 }, null,
      (a) => {
        const f = a.proj(TOUR.X, 0, TOUR.Z), s = a.sAt(TOUR.Z);
        A = CT.tourist(ctx, f[0], f[1], s, {
          ...lit(a, T, d, nn, 0.3), pose: 'stiff', k: 0.12, flip: true, t: tf, soot: 1, hairUp: 1,
          smokeWisps: 1, blink, expr: cough ? 'cough' : 'stiff',
        });
      });
    const z = a.zoom, c = poofC(a);
    const kk = Math.max(0, k - 0.07) / 0.93;                    // stays opaque a beat longer: reveal during the silence
    if (kk < 1.02) CT.poofCloud(ctx, T, c[0], c[1], 1.28 * z / 2.45, kk, { seed: 5, debris: false });
    if (A && T >= 49.067) CT.coughSmoke(ctx, T, A.mouth[0], A.mouth[1], seg(T, 49.067, 49.97), { s: 3.3, dir: [-0.9, -0.4] });
  });
  if (T >= 49.067) CT.ctWord(ctx, T, 'KHU', 300, 250, { t0: 49.067, size: 140 });
}

// ================================================================================== s20
// 50.133 – 53.333  Cô Năm laughs, snatches the fan back (50.8), steers him onto the red stool (sits 51.467),
// wipes his face (51.75–52.55) → raccoon stripe.  "Ngồi đi, để cô!"
const S20 = { snatch: 50.8, sit: 51.467, w0: 51.75, w1: 52.55 };
function s20(ctx, lt, p, T) {
  const d = dawnAt(T), nn = neonAt(T);
  const raccoon = ease.out(seg(T, 51.95, 52.4));
  push(ctx, 620, 1050, lerp(1, 1.05, ease.inOut(p)), null, () => {
    alleyScene(ctx, T, 'cSit', { dawn: d, neon: nn, smoke: 0.55, heat: 1 }, null, null,
      (a) => {
        const z = a.zoom, sT = a.sAt(4.9), st = a.stool;
        const L0 = lit(a, T, d, nn, 0.25, 900);
        let A;
        // --- tourist: stands stiff, gets pushed over to the stool (51.0–51.467), plops down
        const p0 = a.proj(0.45, 0, 4.95);
        if (T < S20.sit) {
          const u = ease.inOut(seg(T, 51.0, S20.sit));
          const x = lerp(p0[0], st.x, u), y = lerp(p0[1], a.floorAt(4.9), u) - Math.sin(u * PI) * 26 * z;
          A = CT.tourist(ctx, x, y, sT, { ...L0, pose: 'stiff', k: 0.1 * (1 - u), flip: true, t: T, soot: 1, hairUp: 1, smokeWisps: 0.6, expr: u > 0 ? 'o' : 'stiff', tilt: -0.12 * Math.sin(u * PI) });
          if (T < S20.snatch) CT.quatNan(ctx, A.handR[0], A.handR[1], sT * 0.9, 2.8);
        } else {
          const sq = kick(T, S20.sit, 9);
          ctx.save(); ctx.translate(st.x, st.y); ctx.scale(1 + 0.05 * sq, 1 - 0.07 * sq); ctx.translate(-st.x, -st.y);
          const wiping = T >= S20.w0 && T < S20.w1;
          A = CT.tourist(ctx, st.x, st.y, sT, {
            ...L0, pose: 'sit', flip: true, t: T, soot: 1, hairUp: lerp(1, 0.75, raccoon), smokeWisps: 0.5 * (1 - raccoon), raccoon,
            expr: wiping ? 'stiff' : (T > S20.w1 ? 'grin' : 'o'), blink: T > 52.85 && T < 52.98 ? 1 : 0, lookX: -0.4,
          });
          ctx.restore();
          if (sq > 0.15) CT.sootPuff(ctx, T, st.x, st.y - 20 * z, sq, { s: z / 2, n: 6, h: 90, seed: 8 });
        }
        // --- Cô Năm (nearer the camera than the stool)
        const v = a.proj(0.02, 0, 4.7), sV = a.sAt(4.7);
        const face = { x: A.face.x, y: A.face.y };
        const sh = { x: A.head[0] + 20 * z, y: A.head[1] + 70 * z };
        let C;
        if (T < S20.snatch) C = CT.coNam(ctx, v[0], v[1], sV, { ...L0, pose: 'laugh', t: T, expr: 'laugh' });
        else if (T < S20.sit + 0.1) C = CT.coNam(ctx, v[0], v[1], sV, { ...L0, pose: 'steer', at: sh, k: ease.inOut(seg(T, 50.95, S20.sit)), t: T, expr: 'talk' });
        else if (T < S20.w0) C = CT.coNam(ctx, v[0], v[1], sV, { ...L0, pose: 'stand', t: T, expr: 'smile', lookX: 0.6 });
        else if (T < S20.w1) C = CT.coNam(ctx, v[0], v[1], sV, { ...L0, pose: 'wipe', at: face, t: T, expr: 'grin' });
        else C = CT.coNam(ctx, v[0], v[1], sV, { ...L0, pose: 'stand', t: T, expr: 'proud', lookX: 0.6 });
        // the fan: snatched (hops to her), then tucked into her apron
        if (T >= S20.snatch) {
          const hp = C.hip;
          const u = seg(T, S20.snatch, S20.snatch + 0.25);
          if (u < 1) CT.quatNan(ctx, lerp(A.handR[0], hp[0] - 50 * sV, u), lerp(A.handR[1], hp[1], u) - Math.sin(u * PI) * 80 * sV, sV * 0.8, lerp(2.8, -0.5, u));
          else CT.quatNan(ctx, hp[0] - 50 * sV, hp[1] + 10 * sV, sV * 0.8, -0.5);
        }
      });
  });
  X.line(ctx, T, 50.283, 53.233, 'Ngồi đi, để cô!', 'Sit down, leave it to me!');
}

// ================================================================================== s21
// 53.333 – 57.6  first bite (lands 54.4) → bliss → close-up: eyes pop open, sparkle, thumbs up. "Ngon bá cháy!"
const S21 = { bite: 54.4, cut: 55.467, open: 55.85, thumb: 56.133 };
const SOOT = { soot: 1, raccoon: 1, hairUp: 0.7 };
function s21(ctx, lt, p, T) {
  const d = 1, nn = 0.3;
  if (T < S21.cut) {
    const u = seg(T, 53.333, S21.cut);
    push(ctx, 800, 1150, lerp(1, 1.05, u) + 0.025 * kick(T, S21.bite, 6), shake(T, S21.bite, 5, 8), () => {
      const a = alleyScene(ctx, T, 'cEat', { dawn: d, neon: nn, smoke: 0.5, heat: 0.9, steam: 1 }, null, null,
        (a) => {
          const st = a.stool, sT = a.sAt(4.9);
          const k = T < S21.bite ? ease.inOut(seg(T, 53.6, S21.bite)) : 1 - 0.65 * ease.inOut(seg(T, 54.6, 55.1));
          CT.tourist(ctx, st.x, st.y, sT, {
            ...lit(a, T, d, nn, 0.2, 900), pose: 'eat', k, t: T, ...SOOT, smokeWisps: 0.2,
            expr: T < S21.bite ? 'o' : 'chew', blink: T > S21.bite + 0.05 ? 1 : 0,
          });
        });
      // plate on the table
      const tb = a.table;
      CT.comTamPlate(ctx, tb.x - 30 * a.zoom, tb.y, 0.15 * a.zoom, { sq: 0.45, t: T, steam: 0.6, glaze: 0.6, mam: 0.5, seed: 21 });
      CT.sunShafts(ctx, T, { x: 1250, y: -150, angle: 2.15, spread: 0.5, n: 7, k: 0.65, seed: 21 });
      if (T > S21.bite) CT.ctWord(ctx, T, 'NGON', 330, 380, { t0: S21.bite + 0.1, size: 140 });
    });
  } else {
    // close-up over a soft-focus alley
    const bg = xPlate('ctEatBg', 14, (ax) => CT.alley(ax, 55.5, { view: 'cEat', dawn: 1, neon: 0.3, smoke: 0.5, heat: 0.9, layer: 'all' }));
    const u = seg(T, S21.cut, 57.6);
    push(ctx, 540, 900, lerp(1.08, 1.14, u), null, () => ctx.drawImage(bg, 0, 0));
    CT.sunShafts(ctx, T, { x: 1250, y: -150, angle: 2.2, spread: 0.55, n: 8, k: 0.85, seed: 22 });
    const open = T >= S21.open;
    const pop = kick(T, S21.open, 8);
    const hx = 520, hy = 880 - 30 * pop;
    const F = CT.touristFace(ctx, hx, hy, 1.22 * (1 + 0.04 * pop), {
      dawn: 1, light: { x: 1100, y: 100, k: 0.35, r: 1200 }, t: T, turn: 0.15, ...SOOT, smokeWisps: 0.3,
      expr: open ? 'delight' : 'chew', k: open ? 0 : 0.6 + 0.4 * Math.sin(T * 14), blink: open ? 0 : 1, tilt: open ? 0 : 0.08 * Math.sin(T * 3),
    });
    if (open) {
      const e = ease.outBack(seg(T, S21.open, S21.open + 0.35));
      const eyes = F.eyes, sep = 95 * 1.22;
      for (const sx of [-1, 1]) CT.CTFXU.star4(ctx, eyes[0] + sx * sep * 0.5 + 18, eyes[1] - 14, 60 * e * (1 + 0.15 * Math.sin(T * 9 + sx)), 0.95);
      CT.glazeSparkle(ctx, T, eyes[0], eyes[1], 260, 0.8 * e, { n: 8, seed: 23, size: 1.4 });
    }
    if (T >= S21.thumb) {
      const th = ease.outBack(seg(T, S21.thumb, S21.thumb + 0.4));
      PE.thumbsUp(ctx, 800, 1330 + (1 - th) * 800, 2.3, -0.15 + Math.sin(T * 5) * 0.04);
    }
  }
  X.line(ctx, T, 53.483, 57.5, 'Ngon bá cháy!', 'Absolutely FIRE!', { y: 1530 });
}

// ================================================================================== s22
// 57.6 – 62.933  end card over the hero plate in sunrise light
function heroPlate(ctx, T) {
  CT.counterTop(ctx, T, { dawn: 1, neon: 0.25, surface: 'steel', edge: 1000 });
  const A = CT.comTamPlate(ctx, 540, 1320, 0.95, { sq: 0.5, t: T, glaze: 1, mam: 0.6, steam: 0.8, seed: 22 });
  return A;
}
function s22(ctx, lt, p, T) {
  push(ctx, 540, 1320, lerp(1, 1.08, ease.inOut(p)), null, () => {
    const A = heroPlate(ctx, T);
    if (A && A.chop) CT.glazeSparkle(ctx, T, A.chop[0], A.chop[1], 170, 1, { n: 7, seed: 24 });
  });
  CT.sunShafts(ctx, T, { x: 1250, y: -120, angle: 2.1, spread: 0.6, n: 9, k: 0.8, seed: 25 });
  X.endCard(ctx, T, 57.6, { l1: 'CƠM TẤM', l2: 'SÀI GÒN', vi: 'Than hồng. Sườn nướng. Chan mắm!', en: 'Charcoal. Pork chop. Fish sauce!' });
}

// ================================================================================== s23
// 62.933 – 68.267  CTA: LIKE (63.5) → FOLLOW pressed 64.533 → wave, tourist winks 65.067 → question → fade out
function backdrop(ctx, a, y) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y - 170, 0, y + 190);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(10,6,4,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 170, W, 360);
  ctx.restore();
}
function fitFont(ctx, txt, size, fam, maxW) {
  let fs = size; ctx.font = `${fs}px ${fam}`;
  while (ctx.measureText(txt).width > maxW && fs > 20) { fs -= 2; ctx.font = `${fs}px ${fam}`; }
  return fs;
}
function logo(ctx, a, y) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(500 - 80, y - 40, 160, 3);
  ctx.font = '44px TitleSerif'; ctx.letterSpacing = '10px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12;
  ctx.fillText('DISH TALES', 500, y);
  ctx.restore();
}
function biText(ctx, a, y, vi, en, o = {}) {
  if (a <= 0) return;
  if (o.bd !== false) backdrop(ctx, a * 0.85, y + 20);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.letterSpacing = '1px';
  ctx.fillStyle = o.vcol || '#ffe6b0'; fitFont(ctx, vi, o.vsize || 62, 'BodySansBold', 840); ctx.fillText(vi, 500, y);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; fitFont(ctx, en, o.esize || 40, 'BodySans', 840); ctx.fillText(en, 500, y + (o.gap || 66));
  ctx.restore();
}
function s23(ctx, lt, p, T) {
  const bg = xPlate('ctHeroBg', 10, (ax) => heroPlate(ax, 62.9));
  push(ctx, 540, 1320, lerp(1.1, 1.16, p), null, () => ctx.drawImage(bg, 0, 0));
  CT.sunShafts(ctx, T, { x: 1250, y: -120, angle: 2.1, spread: 0.6, n: 7, k: 0.5, seed: 25 });
  ctx.fillStyle = 'rgba(14,8,6,0.42)'; ctx.fillRect(0, 0, W, H);
  // both characters pop up from the bottom and wave; the tourist winks on 65.067
  const rise = ease.outBack(seg(T, 63.0, 63.6)), rise2 = ease.outBack(seg(T, 63.15, 63.75));
  const bob = Math.sin(T * TAU / (BEAT * 2)) * 6;
  CT.coNam(ctx, 280, 2230 + (1 - rise) * 900 + bob, 1.45, { dawn: 1, pose: 'wave', t: T, expr: 'laugh', turn: 0.4, shadow: false });
  const wink = T >= 65.067 && T < 65.75;
  CT.tourist(ctx, 790, 2380 + (1 - rise2) * 900 - bob, 1.3, {
    dawn: 1, pose: wink ? 'wink' : 'wave', flip: true, t: T, expr: wink ? 'wink' : 'grin', turn: 0.3,
    soot: 0.8, raccoon: 1, hairUp: 0.6, shadow: false,
  });
  CT.heartPop(ctx, T, 330, 760, 1, { t0: 63.1, tap: 63.5 });
  CT.followButton(ctx, T, 700, 760, { t0: 63.9, tap: 64.533 });
  biText(ctx, X.fadeIO(T, 63.2, 68.1, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  const ca = X.fadeIO(T, 65.067, 68.1, 0.4, 0.4);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    const g = ctx.createLinearGradient(0, 960, 0, 1170); g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(0.5, 'rgba(10,6,4,0.6)'); g.addColorStop(1, 'rgba(10,6,4,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 960, W, 210); ctx.restore();
    biText(ctx, ca, 1035, 'Bạn thích sườn, bì hay chả?', 'Team pork chop, skin or egg cake?', { vsize: 54, esize: 38, bd: false });
  }
  logo(ctx, X.fadeIO(T, 64.6, 68.1, 0.5, 0.4), 1210);
  const fb = seg(T, 67.6, 68.267); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s16, s17, s18, s19, s20, s21, s22, s23 };

