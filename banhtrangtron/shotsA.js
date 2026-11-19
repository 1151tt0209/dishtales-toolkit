// Bánh tráng trộn Sài Gòn — shots 1..10 (0–30.4 s). 150 BPM: beat 0.4 s, bar 1.6 s.
// Each shot paints a full opaque frame. render.js adds the grade, vignette, flashes and grain.
'use strict';
const L = require('./lib');
const X = require('./text');
const TP = require('./tprops');
const PE = require('./people');
const { W, H, TAU, clamp, lerp, ease, rng, at, glow, createCanvas } = L;
const { COL, STREET, SKIN_BA } = TP;

// ---------------------------------------------------------------- beat helpers
const BEAT = 0.4;
const bphase = T => ((T / BEAT) % 1 + 1) % 1;           // 0 at every beat
const bidx = T => Math.floor(T / BEAT + 1e-6);           // beat number
const hitK = (T, d = 0.14) => { const b = bphase(T) * BEAT; return b < d ? 1 - b / d : 0; };
const inv = (a, b, x) => clamp((x - a) / (b - a));
// scissors-style motion: opens during the beat, snaps shut exactly on the beat
const snipOpen = (T) => { const b = bphase(T); return b < 0.78 ? ease.out(b / 0.78) * 0.95 : 0.95 * (1 - ease.in(inv(0.78, 1, b))); };
const camY = (cy, z) => clamp(cy, 960 / z, 1920 - 960 / z);
const cap = (ctx, T, s0, s1, vi, en, n) => X.caption(ctx, T, s0 + 0.15, s1 - 0.1, vi, en, { n });

// ---------------------------------------------------------------- cached backgrounds
let _streetBlur = null, _counterBlur = null;
function streetBlur() {           // golden street, very shallow depth of field (for close shots)
  if (_streetBlur) return _streetBlur;
  const a = createCanvas(W, H), ax = a.getContext('2d');
  TP.schoolStreet(ax, 0, 1000, { cart: false, fg: false, petals: 0, sun: 1 });
  const b = createCanvas(W, H), bx = b.getContext('2d');
  bx.filter = 'blur(26px)'; bx.drawImage(a, -80, -140, W + 160, H + 280); bx.filter = 'none';
  _streetBlur = b; return b;
}
function counterBlur() {          // counter close-up background, even softer (macro shots)
  if (_counterBlur) return _counterBlur;
  const a = createCanvas(W, H), ax = a.getContext('2d');
  TP.counterTop(ax, 0, {});
  const b = createCanvas(W, H), bx = b.getContext('2d');
  bx.filter = 'blur(14px)'; bx.drawImage(a, -60, -100, W + 120, H + 200); bx.filter = 'none';
  _counterBlur = b; return b;
}

// ---------------------------------------------------------------- small drawing helpers
// Cô Ba forearm in purple áo bà ba sleeve + clear-gloved hand. (sx,sy) shoulder side (usually off-frame).
function baArm(ctx, sx, sy, ex, ey, wx, wy, s, rot, kind, o = {}) {
  TP.cArm(ctx, sx, sy, ex, ey, wx, wy, { wu: [40 * s, 34 * s], wf: [32 * s, 27 * s], skin: SKIN_BA, sleeve: COL.aobaba, sleeveTo: o.sleeveTo || 1.72, cuff: COL.aobabaL });
  TP.cHand(ctx, wx, wy, s, rot, { kind, glove: true, flip: o.flip });
}
// one long cut strip of rice paper (vertical at rot 0), centre origin
function longStrip(ctx, x, y, len, w, rot, bend, alpha = 1) {
  at(ctx, x, y, rot, 1, 1, () => {
    ctx.globalAlpha = alpha; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -len / 2); ctx.bezierCurveTo(bend, -len / 6, -bend, len / 6, 0, len / 2);
    ctx.lineWidth = w + 3; ctx.strokeStyle = 'rgba(170,135,85,0.55)'; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = 'rgba(246,236,210,0.97)'; ctx.stroke();
    ctx.save(); ctx.translate(-w * 0.22, 0); ctx.lineWidth = Math.max(2, w * 0.18); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = w; ctx.strokeStyle = 'rgba(255,190,110,0.25)'; ctx.stroke(); ctx.restore();
  });
}
function shake(ctx, k, amp, seed = 0) { if (k > 0) ctx.translate(Math.sin(seed * 13.1 + k * 40) * amp * k, Math.cos(seed * 7.7 + k * 33) * amp * k); }

// =====================================================================================================
// S1 0–3.2  extreme wide drone crane-down over Saigon to the school gate
function s1(ctx, lt, p, T) {
  TP.saigonAerial(ctx, T, ease.inOut(p) * 0.15 + p * 0.85, { kids: inv(0.62, 1, p), rays: 1, flare: 1 });
  X.label(ctx, T, 0.3, 3.05, 'SÀI GÒN · 4 GIỜ CHIỀU', 'Saigon · 4 PM', 300);
}

// =====================================================================================================
// S2 3.2–6.4  drum insert (4 hits on the beat) → wide on the gate: it opens on 4.8 and kids pour out
const KIDS2 = (() => {
  const r = rng(202), out = [];
  for (let i = 0; i < 10; i++) {
    const dir = i % 2 ? 1 : -1;
    out.push({ seed: i % 6, te: 4.95 + i * 0.11 + r() * 0.05, dir, dx0: (r() - 0.5) * 250, vx: 230 + r() * 260, vy: 170 + r() * 170, ph: r() * 3 });
  }
  return out;
})();
function drumInsert(ctx, lt, T) {
  const k = hitK(T, 0.16), b = bphase(T);
  const hit = b < 0.35 ? 1 - ease.out(b / 0.35) : ease.in2(inv(0.35, 1, b));
  const z = 1.06 + lt * 0.05 + k * 0.025;
  ctx.save();
  shake(ctx, k, 12, bidx(T));
  L.cam(ctx, 540, 960, z, -0.02, () => {
    ctx.drawImage(streetBlur(), -60, -40, W + 120, H + 80);
    // dark wooden pavilion pillar + shade behind the drum
    ctx.fillStyle = 'rgba(40,20,14,0.55)'; ctx.fillRect(-100, 0, 150, H);
    const sh = ctx.createLinearGradient(0, 1200, 0, H); sh.addColorStop(0, 'rgba(60,35,25,0)'); sh.addColorStop(1, 'rgba(50,30,22,0.75)');
    ctx.fillStyle = sh; ctx.fillRect(-100, 1200, W + 200, H);
    TP.schoolDrum(ctx, 400, 1470, 1.45, { hit, t: T });
    // sound rings from the drum head
    const hx = 400 + 165 * 1.45, hy = 1470 - 250 * 1.45, u = bphase(T) * BEAT;
    if (u < 0.36) {
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const rr = 90 + u * 1300 + i * 70, a = (1 - u / 0.36) * (0.75 - i * 0.2);
        if (a <= 0) continue;
        ctx.strokeStyle = `rgba(255,236,190,${a})`; ctx.lineWidth = 10 - i * 2.5;
        ctx.beginPath(); ctx.arc(hx, hy, rr, -0.85, 0.85); ctx.stroke();
        ctx.beginPath(); ctx.arc(hx - 40, hy, rr * 0.9, PI_(0.62), PI_(0.9)); ctx.stroke();
      }
      ctx.restore();
    }
    // dust shaken off by the hit
    L.dust(ctx, T, 31 + bidx(T), 26, hx - 260, hy - 260, 520, 520, '255,226,170', 3.2, 0.7 * k);
  });
  ctx.restore();
  // sun leaking in from top-right + god rays
  L.godRays(ctx, 1000, 120, 2.1, 0.9, 2000, 8, 'rgba(255,210,150,0.6)', 0.22, T);
  TP.sunFlare(ctx, 980, 170, 0.75, { alpha: 0.75 });
}
const PI_ = f => Math.PI * f;
function gateShot(ctx, u, T) {
  const z = lerp(1.0, 1.1, ease.inOut(clamp(u / 1.6)));
  const gateOpen = ease.inOut(inv(4.8, 5.45, T));
  L.cam(ctx, 540, Math.min(1150, 1920 - 960 / z), z, 0, () => {
    TP.schoolStreet(ctx, T, 220, {
      gateOpen, petals: 0.7, crowd: 1,
      yard: (c, bo) => {
        const gx = STREET.GATE_X + bo;
        const list = KIDS2.filter(k => T < k.te).map(k => {
          const w = clamp((T - (k.te - 0.9)) / 0.9);
          return { k, y: lerp(1255, 1335, w), s: lerp(0.5, 0.72, w), x: gx + k.dx0 * lerp(0.5, 0.75, w) };
        }).sort((a, b) => a.y - b.y);
        for (const e of list) TP.schoolKid(c, e.x, e.y, e.s, { seed: e.k.seed, pose: gateOpen > 0.25 ? 'run' : 'stand', t: T + e.k.ph, flip: e.k.dir < 0, expr: gateOpen > 0.25 ? undefined : 'smile' });
      },
      mid: (c, ox) => {
        const gx = STREET.GATE_X + ox;
        const list = KIDS2.filter(k => T >= k.te).map(k => {
          const v = T - k.te, y = Math.min(1725, 1338 + k.vy * v);
          return { k, y, s: 0.74 + 0.32 * clamp((y - 1338) / 387), x: gx + k.dx0 * 0.75 + k.dir * k.vx * v };
        }).sort((a, b) => a.y - b.y);
        for (const e of list) TP.schoolKid(c, e.x, e.y, e.s, { seed: e.k.seed, pose: 'run', t: T + e.k.ph, flip: e.k.dir < 0 });
      },
    });
  });
}
function s2(ctx, lt, p, T) {
  if (T < 4.8) drumInsert(ctx, lt, T);
  else gateShot(ctx, T - 4.8, T);
}

// =====================================================================================================
// S3 6.4–9.6  tracking shot: the tourist strolls the sidewalk, kids sprint past him, he follows, curious
const KIDS3 = [
  { t0: 6.75, y: 1590, s: 0.96, seed: 1 }, { t0: 7.25, y: 1712, s: 1.1, seed: 3 }, { t0: 7.75, y: 1575, s: 0.94, seed: 4 },
  { t0: 8.2, y: 1700, s: 1.08, seed: 0 }, { t0: 8.55, y: 1600, s: 0.97, seed: 5 }, { t0: 8.95, y: 1690, s: 1.06, seed: 2 },
];
function s3(ctx, lt, p, T) {
  const panX = lerp(250, 720, ease.inOut(p) * 0.3 + p * 0.7);
  const speedUp = inv(8.8, 9.6, T);
  TP.schoolStreet(ctx, T, panX, {
    gateOpen: 1, petals: 0.5,
    mid: (c) => {
      const items = [];
      // tourist (profile walks left in people.js → mirror to walk right)
      const tx = 300 + lt * 34 + speedUp * speedUp * 90, ty = 1652;
      const walk = (T - 6.4) * Math.PI / BEAT * (1 + speedUp * 0.5);
      items.push({ y: ty, draw: () => at(c, tx, ty, 0, -1.02, 1.02, () => PE.tourist(c, 0, 0, 1, { walk, look: 0.1 * Math.sin(T * 2), smile: T > 8.4 ? 1 : 0, lean: -0.04 * speedUp })) });
      for (const k of KIDS3) {
        const v = T - k.t0; if (v < -0.1) continue;
        const x = -260 + v * 980; if (x > W + 260) continue;
        items.push({ y: k.y, draw: () => {
          TP.whoosh(c, x - 70 * k.s, k.y - 190 * k.s, 0, 300 * k.s, { k: 0.8, col: '#fff3d8', n: 3, w: 7 * k.s, curve: 0 });
          c.save(); c.globalAlpha = 0.25; TP.schoolKid(c, x - 46, k.y, k.s, { seed: k.seed, pose: 'run', t: T - 0.05, lean: 0.18 }); c.restore();
          TP.schoolKid(c, x, k.y, k.s, { seed: k.seed, pose: 'run', t: T, lean: 0.18 });
        } });
      }
      items.sort((a, b) => a.y - b.y).forEach(i => i.draw());
    },
  });
}

// =====================================================================================================
// S4 9.6–12.0  close lateral dolly along the cart's glass case; jars glint; gloved hand snips on the beat
function s4(ctx, lt, p, T) {
  const dolly = ease.inOut(p);
  ctx.drawImage(streetBlur(), -40 - dolly * 80, -60, W + 160, H + 120);
  const cx = lerp(720, 370, dolly);
  const cart = TP.btCart(ctx, cx, 2390, 3.3, { t: T, light: 1 });
  // jars glint one after another on the beat
  const bi = bidx(T), hk = hitK(T, 0.3);
  cart.jars.forEach(([jx, jy], i) => {
    const on = (bi + i * 3) % 8 === 0 ? hk : 0;
    if (on > 0) L.sparkle(ctx, jx + 18, jy - 60, 70 * on, on);
  });
  // moving glass glint
  const gx = lerp(-100, 1180, p);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const gg = ctx.createLinearGradient(gx - 120, 0, gx + 120, 0); gg.addColorStop(0, 'rgba(255,240,210,0)'); gg.addColorStop(0.5, 'rgba(255,240,210,0.35)'); gg.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(gx - 140, 1050); ctx.lineTo(gx + 40, 1050); ctx.lineTo(gx + 140, 1700); ctx.lineTo(gx - 40, 1700); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Cô Ba's gloved hand + scissors, entering from the right, snipping the air on each beat ("xoẹt")
  const enter = ease.out(inv(9.75, 10.35, T));
  const rot = -2.55, s = 1.6, op = T < 10.4 ? 0.85 : snipOpen(T);
  const dx = (1 - enter) * 700, px = 600 + dx, py = 500 + Math.sin(T * 2) * 8;
  const d = [Math.cos(rot), Math.sin(rot)];
  const wx = px - d[0] * 175 * s, wy = py - d[1] * 175 * s;
  TP.scissors(ctx, px, py, s, rot, { open: op });
  baArm(ctx, wx + 520, wy + 520, wx + 250, wy + 260, wx, wy, s * 1.05, rot, 'grip');
  const sk = T >= 10.8 ? hitK(T, 0.2) : 0;
  if (sk > 0) {
    const tipX = px + d[0] * 215 * s, tipY = py + d[1] * 215 * s;
    L.sparkle(ctx, tipX, tipY, 110 * sk, sk);
    TP.whoosh(ctx, tipX - 20, tipY + 10, rot + 0.9, 260, { k: sk, col: '#fff6e0', n: 3, w: 6, curve: 0.5 });
  }
  TP.sunFlare(ctx, 930 - dolly * 120, 260, 0.8, { alpha: 0.8 });
}

// =====================================================================================================
// S5 12.0–14.4  extreme close-up, slow motion: rice paper sheets tossed up, the sun shining through them + TITLE
const SHEETS5 = [
  { x0: 300, y0: 1750, x1: 250, y1: 1120, s: 2.3, r0: -0.4, vr: 0.18, c0: 0.5, ph: 0 },
  { x0: 640, y0: 1900, x1: 720, y1: 1010, s: 1.8, r0: 0.3, vr: -0.14, c0: 0.3, ph: 1.3 },
  { x0: 520, y0: 2100, x1: 470, y1: 1380, s: 2.6, r0: 0.9, vr: 0.1, c0: 0.62, ph: 2.1 },
  { x0: 860, y0: 1800, x1: 900, y1: 1290, s: 1.5, r0: -1.1, vr: 0.22, c0: 0.4, ph: 0.6 },
  { x0: 160, y0: 2050, x1: 120, y1: 1520, s: 1.6, r0: 0.5, vr: -0.2, c0: 0.55, ph: 3.0 },
];
function s5(ctx, lt, p, T) {
  ctx.save();
  L.cam(ctx, 540, 960, 1.18 + lt * 0.03, 0.02 - lt * 0.01, () => ctx.drawImage(streetBlur(), 0, 0));
  ctx.restore();
  const sunX = 600, sunY = 1010;
  glow(ctx, sunX, sunY, 900, 'rgba(255,190,110,0.6)', 1);
  L.godRays(ctx, sunX, sunY, -1.57, TAU, 1500, 14, 'rgba(255,215,150,0.55)', 0.22, T * 0.3);
  const u = ease.out(clamp(lt / 2.4)) * 0.9 + clamp(lt / 2.4) * 0.1;
  for (const sh of SHEETS5) {
    const x = lerp(sh.x0, sh.x1, u) + Math.sin(T * 0.8 + sh.ph) * 14, y = lerp(sh.y0, sh.y1, u);
    const curl = clamp(sh.c0 + Math.sin(T * 1.1 + sh.ph) * 0.12);
    TP.riceSheet(ctx, x, y, sh.s, sh.r0 + sh.vr * lt, { curl, light: 1, alpha: 0.93 });
  }
  // the tossing hand drops out of frame at the start
  const hy = 1700 + ease.in(clamp(lt / 0.7)) * 500;
  if (lt < 0.7) baArm(ctx, 360, hy + 520, 420, hy + 300, 470, hy, 2.6, -1.4, 'open');
  TP.sunFlare(ctx, sunX, sunY, 1.1, { alpha: 0.55 });
  L.dust(ctx, T * 0.35, 55, 70, 0, 700, W, 1100, '255,230,180', 3.4, 0.75);
  X.title(ctx, T, 12.0, 14.35, 470, 'Saigon Rice Paper Salad', 'BÁNH TRÁNG', 'TRỘN', 112, 86);
}

// =====================================================================================================
// S6 14.4–17.6  ① scissors cut strips, one snip per beat; strips drop onto a growing pile
const S6 = { cx: 420, cy: 800, s: 1.42, first: 14.8 };
function s6(ctx, lt, p, T) {
  const nSnip = T >= S6.first ? bidx(T) - bidx(S6.first) + 1 : 0;      // snips done so far
  const R = 200 * S6.s;
  const cutOf = n => 0.04 + Math.min(n, 8) * 0.07;
  const z = 1 + lt * 0.025;
  L.cam(ctx, 540, camY(900, z), z, 0, () => {
    TP.counterTop(ctx, T, {});
    // strip pile on the counter
    TP.riceStrips(ctx, 600, 1250, 1.9, { n: 6 + nSnip * 5, seed: 6, spread: 1.5 });
    // rice sheet held by the left hand
    const cutNow = lerp(cutOf(nSnip - 1 < 0 ? 0 : nSnip - 1), cutOf(nSnip), nSnip > 0 ? clamp(bphase(T) * BEAT / 0.06) : 0);
    const cut = nSnip > 0 ? cutNow : 0.02;
    TP.riceSheet(ctx, S6.cx, S6.cy, S6.s, 0, { cut, light: 0.35 });
    baArm(ctx, -250, 1500, -110, 1080, S6.cx - R - 40, S6.cy + 30, 2.0, -0.15, 'pinch');
    // falling strips (one per snip, each falls ~0.55 s to the pile)
    for (let n = Math.max(1, nSnip - 2); n <= nSnip; n++) {
      const ts = S6.first + (n - 1) * BEAT, v = T - ts; if (v < 0 || v > 0.62) continue;
      const ex = S6.cx + (200 - cutOf(n) * 380) * S6.s, dx = ex - S6.cx + 9;
      const len = 2 * Math.sqrt(Math.max(0, R * R - dx * dx));
      const y = S6.cy + 30 + 0.5 * 2600 * v * v, x = ex + 14 + v * 120;
      longStrip(ctx, x, y, len * (1 - v * 0.4), 20, v * 1.2 * (n % 2 ? 1 : -1), 30 * v + 8, 1 - inv(0.48, 0.62, v));
    }
    // scissors over the cut edge (blades down-left), right hand from the top-right
    const nextEdge = S6.cx + (200 - cutOf(nSnip + 1) * 380) * S6.s;
    const curEdge = S6.cx + (200 - cutOf(nSnip) * 380) * S6.s;
    const ex = nSnip > 0 ? lerp(curEdge, nextEdge, ease.inOut(clamp(bphase(T) / 0.7))) : nextEdge + 60;
    const rot = 1.95, s = 2.15, d = [Math.cos(rot), Math.sin(rot)];
    const mid = [ex, S6.cy - 120], px = mid[0] - d[0] * 140 * s, py = mid[1] - d[1] * 140 * s;
    const op = T < S6.first - 0.35 ? 0.9 : snipOpen(T);
    TP.scissors(ctx, px, py, s, rot, { open: op });
    const wx = px - d[0] * 175 * s, wy = py - d[1] * 175 * s;
    baArm(ctx, wx + 420, wy - 380, wx + 230, wy - 220, wx, wy, s * 1.02, rot, 'grip');
    const k = nSnip > 0 ? hitK(T, 0.16) : 0;
    if (k > 0) L.sparkle(ctx, ex, S6.cy - 40, 90 * k, k);
  });
  cap(ctx, T, 14.4, 17.6, 'Cắt bánh tráng', 'Snip the rice paper', 1);
}

// =====================================================================================================
// S7 17.6–20.8  ② top-down: a handful of strips rains into the open bag (a burst on every beat)
const S7 = { bx: 540, by: 800, s: 2.2 };
function s7(ctx, lt, p, T) {
  L.cam(ctx, 540, 900, 1.15 - lt * 0.012, 0.03 - lt * 0.02, () => {
    TP.counterTop(ctx, T, { top: true });
    // soft drop shadow of the bag ring
    ctx.save(); ctx.filter = 'blur(18px)'; ctx.fillStyle = 'rgba(30,30,40,0.35)'; ctx.beginPath(); ctx.ellipse(S7.bx + 30, S7.by + 40, 470, 470, 0, 0, TAU); ctx.fill(); ctx.restore();
    TP.bagMouthTop(ctx, S7.bx, S7.by, S7.s, { layers: ['strips'], lastK: ease.out(inv(0.25, 2.6, lt)), t: T, spin: lt * 0.06 });
    // strips falling toward the camera-lens → bag (perspective: big & blurry first, shrink as they drop in)
    const r0 = Math.max(0, bidx(T) - bidx(17.6) - 2);
    for (let bn = r0; bn <= bidx(T) - bidx(17.6); bn++) {
      const tb = 17.6 + bn * BEAT;
      const r = rng(700 + bn);
      for (let i = 0; i < 7; i++) {
        const st = tb + r() * 0.12, v = (T - st) / 0.62;
        const a0 = r() * TAU, d0 = 260 + r() * 260, a1 = r() * TAU, d1 = r() * 120;
        const len = 150 + r() * 120, rot0 = r() * TAU, bend = (r() - 0.5) * 60;
        if (v < 0 || v > 1) continue;
        const e = ease.in(v);
        const x = lerp(S7.bx + Math.cos(a0) * d0, S7.bx + Math.cos(a1) * d1, e);
        const y = lerp(S7.by - 380 + Math.sin(a0) * d0 * 0.6, S7.by + Math.sin(a1) * d1, e);
        const sc = lerp(2.4, 0.9, e);
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        longStrip(ctx, 0, 0, len * 0.5, 9, rot0 + v * 2, bend * 0.5, Math.min(1, (1 - v) * 4));
        ctx.restore();
      }
    }
    // Cô Ba's gloved hand above, letting go on every beat
    const k = hitK(T, 0.25);
    baArm(ctx, 1250, -300, 1000, -60, 760, 250 + k * 30, 2.6, 2.4, k > 0.1 ? 'open' : 'grip');
  });
  // golden leaf-dappled light drifting
  glow(ctx, 860 + Math.sin(T * 0.6) * 60, 300, 700, 'rgba(255,200,120,0.4)', 1);
  cap(ctx, T, 17.6, 20.8, 'Vào bịch', 'Into the bag', 2);
}

// =====================================================================================================
// S8 20.8–24.0  ③ green mango julienned; a stroke lands on every beat and shreds burst out
const S8 = { mx: 450, my: 820, s: 2.3, rot: -0.12 };
function s8(ctx, lt, p, T) {
  const nb = bidx(T) - bidx(20.8);                          // beats elapsed
  const b = bphase(T);
  L.cam(ctx, 540, camY(940, 1.02 + lt * 0.02), 1.02 + lt * 0.02, 0, () => {
    TP.counterTop(ctx, T, {});
    TP.mangoShreds(ctx, 620, 1250, 2.2, { n: 10 + nb * 4, seed: 8, spread: 1.6 });
    TP.greenMango(ctx, S8.mx, S8.my, S8.s, S8.rot, { peel: clamp(0.3 + nb * 0.08), grooves: true });
    // left hand grips the stem end
    const ca = Math.cos(S8.rot), sa = Math.sin(S8.rot);
    const lx = S8.mx - ca * 125 * S8.s, ly = S8.my - sa * 125 * S8.s;
    baArm(ctx, -300, 1400, -120, 1060, lx - 40, ly + 30, 2.1, -0.4, 'grip');
    // peeler stroke: fast pull right→left ending ON the beat, slow return
    const stroke = b > 0.72 ? ease.inOut(inv(0.72, 1, b)) : 1 - ease.inOut(clamp(b / 0.72));
    const along = lerp(110, -40, stroke);                     // position along the mango (mango units)
    const hx = S8.mx + ca * along * S8.s + sa * 70 * S8.s * 0.0, hy = S8.my + sa * along * S8.s - 70 * S8.s + (b > 0.72 ? 0 : 26 * Math.sin(Math.PI * b / 0.72));
    const prot = Math.PI + S8.rot + 0.25, ps = 1.55;
    const gx = hx - Math.cos(prot) * 160 * ps, gy = hy - Math.sin(prot) * 160 * ps;
    TP.peeler(ctx, gx, gy, ps, prot);
    baArm(ctx, gx + 650, gy + 420, gx + 320, gy + 230, gx + 40, gy + 6, 1.9, prot, 'grip', { flip: true });
    // shred bursts from the blade on each beat (keep the last 3 alive)
    for (let n = Math.max(0, nb - 2); n <= nb; n++) {
      const tb = 20.8 + n * BEAT, v = T - tb; if (v < 0 || n === 0 && T < 20.8) continue;
      const bx = S8.mx + ca * -40 * S8.s, by = S8.my + sa * -40 * S8.s - 80 * S8.s;
      TP.ingredientBits(ctx, bx, by, 1.0, { t: v * 0.75, n: 11, seed: 40 + n, kinds: ['mango'], burst: 520, gravity: 1700 });
    }
    const k = hitK(T, 0.2);
    if (k > 0) L.sparkle(ctx, S8.mx + ca * -40 * S8.s, S8.my - 70 * S8.s, 80 * k, k);
  });
  cap(ctx, T, 20.8, 24.0, 'Xoài xanh', 'Shredded green mango', 3);
}

// =====================================================================================================
// S9 24.0–27.2  ④ squid shreds + beef jerky rain into the open bag (jerky drops land on the beats)
const S9 = { x: 540, y: 1000, s: 1.95 };
const _fgJ = [];
function fgJerky(j) {             // out-of-focus foreground jerky sprite (600x240, centre at 300,120)
  if (_fgJ[j]) return _fgJ[j];
  const a = createCanvas(600, 240); TP.beefJerky(a.getContext('2d'), 300, 120, 3.4, 0, { seed: 5 + j });
  const b = createCanvas(600, 240), bx = b.getContext('2d'); bx.filter = 'blur(8px)'; bx.drawImage(a, 0, 0); bx.filter = 'none';
  return (_fgJ[j] = b);
}
function s9(ctx, lt, p, T) {
  const nb = bidx(T) - bidx(24.0);
  L.cam(ctx, 540, 960, 1.0 + lt * 0.03, 0, () => {
    TP.counterTop(ctx, T, {});
    const mouthY = S9.y - 128 * S9.s;
    // rain behind/into the bag (clipped at the mouth so it goes INTO it)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, mouthY + 30); ctx.clip();
    TP.driedSquidShreds(ctx, S9.x, mouthY + 40, 2.1, { n: 46, seed: 9, spread: 1.6, fall: true, t: T, h: 1100, speed: 1.5, jerky: 0.5 });
    // whole jerky strips — each pair lands in the bag mouth on a beat
    for (let n = Math.max(0, nb - 2); n <= nb + 2; n++) {
      const land = 24.0 + n * BEAT + 0.4, v = 1 - (land - T) / 0.8;  // 0.8 s fall
      if (v < 0 || v > 1.05) continue;
      for (let j = 0; j < 2; j++) {
        const r = rng(900 + n * 2 + j);
        const x = S9.x + (r() - 0.5) * 260, y = lerp(-180, mouthY + 30, v * v);
        TP.beefJerky(ctx, x, y, 2.1, r() * TAU + v * (r() - 0.5) * 6, { seed: n + j });
      }
    }
    ctx.restore();
    TP.plasticBag(ctx, S9.x, S9.y, S9.s, { open: 1, fill: lerp(0.45, 0.68, p), mix: 0, t: T, shake: hitK(T + 0.0, 0.2) * 0.3 });
    const k = hitK(T, 0.18);
    if (k > 0) L.sparkle(ctx, S9.x + 120, mouthY, 70 * k, k * 0.8);
  });
  // slow-mo foreground jerky drifting past the lens (out of focus)
  // (beefJerky ignores ctx.filter, so the blur is baked into a cached sprite)
  for (let j = 0; j < 2; j++) {
    const r = rng(77 + j), x = j ? 1000 : 80, y = lerp(-300, 2100, (lt / 3.2) * (0.8 + r() * 0.3) + j * 0.15);
    at(ctx, x, y, 0.6 + lt * (j ? 0.5 : -0.4), 1, 1, () => ctx.drawImage(fgJerky(j), -300, -120));
  }
  cap(ctx, T, 24.0, 27.2, 'Khô bò, khô mực', 'Beef jerky & dried squid', 4);
}

// =====================================================================================================
// S10 27.2–30.4  ⑤ extreme close-up: a quail egg is peeled, the white egg pops out and bounces on the beat
function s10(ctx, lt, p, T) {
  L.cam(ctx, 540, 980, 1.25 + lt * 0.04, 0, () => ctx.drawImage(counterBlur(), 0, 0));
  glow(ctx, 860, 320, 700, 'rgba(255,200,120,0.5)', 1);
  const peel = ease.inOut(inv(27.45, 28.75, T));
  const groundY = 1215;
  let ex = 540, ey = 900, sq = 1, rot = 0;
  if (T < 28.8) {
    ey = 860 + Math.sin(T * 3) * 6;
    rot = Math.sin(T * 2.2) * 0.05;
  } else {
    // pop up out of the hands (28.8) then bounce on 29.2, 29.6, 30.0 with decaying height
    const tb = T - 28.8;
    const hops = [[0, 0.4, 520, 860], [0.4, 0.8, 330, groundY - 140], [0.8, 1.2, 190, groundY - 140], [1.2, 1.6, 90, groundY - 140]];
    for (const [a, b, h, y0] of hops) if (tb >= a && tb < b) {
      const u = (tb - a) / (b - a), base = lerp(y0, groundY - 140, u);
      ey = base - h * 4 * u * (1 - u); rot = a === 0 ? TAU * ease.inOut(u) : 0.22 * Math.sin(u * Math.PI) * (a === 0.8 ? -1 : 1);
      const land = tb - b; void land;
    }
    const k = T >= 29.2 ? hitK(T, 0.12) : 0;
    sq = 1 - k * 0.14;
    if (k > 0) { ey = groundY - 140 + 140 * (1 - sq); }
  }
  // shadow on the counter
  const hgt = clamp((groundY - 140 - ey) / 500);
  ctx.save(); ctx.filter = 'blur(10px)'; ctx.fillStyle = `rgba(40,25,15,${0.4 * (1 - hgt * 0.7)})`;
  ctx.beginPath(); ctx.ellipse(ex + 10, groundY, 110 * (1 - hgt * 0.4), 22, 0, 0, TAU); ctx.fill(); ctx.restore();
  // peeling hands (left holds, right thumb peels) while peel < 1
  const handsOut = ease.in(inv(28.75, 29.0, T));
  if (handsOut < 1) {
    const hy = 940 + handsOut * 300;
    baArm(ctx, -300 - handsOut * 700, 1700 + handsOut * 300, -60 - handsOut * 700, 1260 + handsOut * 300, 330 - handsOut * 700, hy, 2.6, -0.5, 'grip');
    baArm(ctx, 1380 + handsOut * 700, 1700 + handsOut * 300, 1140 + handsOut * 700, 1240 + handsOut * 300, 760 + handsOut * 700, hy - 20, 2.6, Math.PI + 0.55, 'pinch', { flip: true });
  }
  at(ctx, ex, ey, 0, 1, sq > 1 ? 1 : 2 - sq, () => {});
  ctx.save(); ctx.translate(ex, ey + 140 * (1 - sq)); ctx.scale(2 - sq, sq); ctx.translate(-ex, -ey - 140 * (1 - sq));
  TP.quailEgg(ctx, ex, ey, 4, { peel: T < 28.8 ? peel : 1, rot });
  ctx.restore();
  // shell fragments flaking off
  if (T > 27.45 && T < 29.3) {
    const r = rng(1010);
    for (let i = 0; i < 16; i++) {
      const st = 27.45 + r() * 1.3, v = T - st, ang = r() * TAU, sz = 6 + r() * 12;
      if (v < 0 || v > 0.9) continue;
      const fx = ex + Math.cos(ang) * 120 + (r() - 0.5) * 80 + Math.cos(ang) * v * 220, fy = ey + 40 + 0.5 * 1800 * v * v - 160 * v;
      at(ctx, fx, fy, v * 8 + i, 1, 1, () => {
        ctx.fillStyle = '#e9dcbc'; ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.4); ctx.lineTo(sz * 0.8, -sz * 0.7); ctx.lineTo(sz, sz * 0.5); ctx.lineTo(-sz * 0.3, sz * 0.7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a4030'; ctx.beginPath(); ctx.arc(0, 0, sz * 0.25, 0, TAU); ctx.fill();
      });
    }
  }
  // glossy pop sparkle when it jumps free + on each bounce
  const pk = T >= 28.8 ? Math.max(clamp(1 - (T - 28.8) / 0.25), T >= 29.2 ? hitK(T, 0.18) : 0) : 0;
  if (pk > 0) L.sparkle(ctx, ex - 40, ey - 70, 140 * pk, pk);
  // two more eggs hop in from the sides on the last beats
  for (const [t0, x0, x1, sc] of [[29.6, -120, 300, 2.6], [30.0, 1200, 790, 2.4]]) {
    const v = (T - t0 + 0.4) / 0.4; if (v < 0) continue;
    const u = clamp(v), x = lerp(x0, x1, u), y = groundY - 70 * sc / 2.6 - 360 * 4 * u * (1 - u);
    TP.quailEgg(ctx, x, y, sc, { peel: 1, rot: (1 - u) * 3 * Math.sign(x1 - x0) });
  }
  cap(ctx, T, 27.2, 30.4, 'Trứng cút', 'Quail eggs', 5);
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8, s9, s10 };
