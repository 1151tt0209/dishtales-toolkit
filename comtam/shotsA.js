'use strict';
// shotsA.js — "Cơm tấm Sài Gòn" shots 1..8 (0 – 22.4 s). 112.5 BPM grid: beat 8/15 s.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes
// (8.533, 17.067, ...) and grain — no flashes / grading here.
// Look: 5 AM blue hour, pink + cyan neon, charcoal-ember orange from below; dawn creeps up through Act II.
const CT = require('./ctprops');
const X = require('./text');
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- beat helpers
const BEAT = 8 / 15;
const seg01 = (v, a, b) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cap = (ctx, T, s0, s1, vi, en, n, o = {}) => X.caption(ctx, T, s0 + 0.15, s1 - 0.1, vi, en, Object.assign({ n, y: 360 }, o));
// last beat time <= T from a list (or -1)
const lastHit = (T, list) => { let r = -1; for (const b of list) if (T >= b) r = b; return r; };

// camera that never reveals the canvas edge: clamps the look-at point for the zoom (+ margin for rotation).
function cam(ctx, cx, cy, z, rot, fn) {
  const zz = Math.max(1, z) * (1 + Math.abs(rot || 0) * 1.6);
  const hw = W / 2 / zz, hh = H / 2 / zz;
  cx = clamp(cx, hw, W - hw); cy = clamp(cy, hh, H - hh);
  L.cam(ctx, cx, cy, zz, rot, fn);
}

// ---------------------------------------------------------------- cached sprites
const CACHE = {};
function cached(name, w, h, fn) {
  if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; }
  return CACHE[name];
}
// soft round puff (white -> transparent), tinted copies per colour
function puff(col) {
  return cached('puff' + col, 256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, `rgba(${col},1)`); g.addColorStop(0.45, `rgba(${col},0.55)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  });
}
// drifting soft haze puffs (foreground depth). vy < 0 rises.
function haze(ctx, t, seed, n, col, alpha, x0, y0, w, h, rmin, rmax, vx = 0, vy = -40) {
  const r = rng(seed), img = puff(col);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const R = rmin + r() * (rmax - rmin), ph = r();
    let x = x0 + r() * w + vx * t + Math.sin(t * 0.4 + i) * 30;
    let y = y0 + ((r() * h + vy * t) % h + h) % h;
    x = x0 + (((x - x0) % w) + w) % w;
    const fade = Math.sin(clamp((y - y0) / h) * PI);
    ctx.globalAlpha = alpha * (0.5 + 0.5 * ph) * fade;
    ctx.drawImage(img, x - R, y - R * 0.7, R * 2, R * 1.4);
  }
  ctx.restore();
}

// simple Cô Năm forearm + hand reaching in from the right edge to a wrist point (for close-ups)
function forearm(ctx, x0, y0, wx, wy, s, ember = 1) {
  ctx.save(); ctx.lineCap = 'round';
  const mx = lerp(x0, wx, 0.55), my = lerp(y0, wy, 0.55);
  // sleeve (lilac áo bà ba, rolled)
  ctx.strokeStyle = '#7d6aa6'; ctx.lineWidth = 100 * s;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(mx, my); ctx.stroke();
  ctx.strokeStyle = '#9c86c4'; ctx.lineWidth = 70 * s;
  ctx.beginPath(); ctx.moveTo(x0, y0 - 12 * s); ctx.lineTo(mx, my - 12 * s); ctx.stroke();
  // skin
  ctx.strokeStyle = '#c98a62'; ctx.lineWidth = 58 * s;
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(wx, wy); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,170,90,' + (0.55 * ember) + ')'; ctx.lineWidth = 18 * s; // ember rim underneath
  ctx.beginPath(); ctx.moveTo(mx, my + 20 * s); ctx.lineTo(wx, wy + 18 * s); ctx.stroke();
  // rolled cuff
  ctx.strokeStyle = '#b9a6dc'; ctx.lineWidth = 26 * s;
  const ang = Math.atan2(wy - y0, wx - x0), nx = -Math.sin(ang), ny = Math.cos(ang);
  ctx.beginPath(); ctx.moveTo(mx + nx * 52 * s, my + ny * 52 * s); ctx.lineTo(mx - nx * 52 * s, my - ny * 52 * s); ctx.stroke();
  // fist
  ctx.fillStyle = '#d59870';
  ctx.beginPath(); ctx.ellipse(wx, wy, 40 * s, 34 * s, ang, 0, TAU); ctx.fill();
  ctx.restore();
}

// dark motorbike silhouette with headlight, motion-blurred (foreground pass)
function motoPass(ctx, x, y, s, dir, t) {
  const [c, b] = L.buffer('motoA');
  b.save();
  CT.SG.motorbike(b, x, y, s, dir < 0, t, {});
  b.globalCompositeOperation = 'source-atop';
  b.fillStyle = '#07071a'; b.fillRect(0, 0, W, H);
  b.restore();
  ctx.save();
  for (let i = 7; i >= 0; i--) { ctx.globalAlpha = i === 0 ? 0.95 : 0.13; ctx.drawImage(c, -dir * i * 34, 0); }
  ctx.restore();
}

// =================================================================== s1  0 – 4.267  drone descends over blue-hour Saigon
function s1(ctx, lt, p, T) {
  const e = ease.inOut(p), d = 0.86 * (0.55 * p + 0.45 * e);
  ctx.fillStyle = '#050a26'; ctx.fillRect(0, 0, W, H);
  let A;
  cam(ctx, 540, 960, 1.0 + 0.04 * e, -0.022 * (1 - e) + Math.sin(lt * 0.8) * 0.003, () => {
    A = CT.aerial(ctx, lt, { dawn: 0.03, descend: d, smoke: 1, drift: 14 });
  });
  // hero smoke column from Cô Năm's alley: ember-lit base, neon blush, drifting with the breeze
  if (A && A.smoke) {
    const sx = A.smoke.x, sy = A.smoke.y, zs = A.zoom || 1;
    CT.neonLight(ctx, sx, sy - 10, 130 * zs, 0.9, '255,140,60');
    CT.charcoalSmoke(ctx, lt * 0.8, { x: sx, y: sy, w: 70 * zs, h: 760 * zs, density: 1, tint: 'neon', drift: 170 * zs, alpha: 1, s: 0.75 * zs, seed: 3, neonX: sx + 20, light: { x: sx, y: sy - 40 * zs, r: 170 * zs, col: [255, 150, 70], k: 1 } });
    CT.neonLight(ctx, sx + 30, sy - 140 * zs, 220 * zs, 0.4, '255,70,170');
    L.dust(ctx, lt, 5, 18, sx - 60 * zs, sy - 260 * zs, 120 * zs, 260 * zs, '255,170,80', 2.2, 0.8);
  }
  // low cloud / haze sliding up past the lens while descending (depth)
  haze(ctx, lt, 11, 7, '120,140,210', 0.22, -200, 0, W + 400, H, 260, 520, 12, -260 - 200 * e);
  // calm band behind the place card
  const la = clamp(Math.min((T - 0.35) / 0.5, (4.0 - T) / 0.4));
  if (la > 0) {
    const g = ctx.createLinearGradient(0, 350, 0, 610);
    g.addColorStop(0, 'rgba(5,8,30,0)'); g.addColorStop(0.5, 'rgba(5,8,30,0.5)'); g.addColorStop(1, 'rgba(5,8,30,0)');
    ctx.save(); ctx.globalAlpha = la; ctx.fillStyle = g; ctx.fillRect(0, 350, W, 260); ctx.restore();
  }
  X.label(ctx, T, 0.35, 4.0, 'SÀI GÒN · 5 GIỜ SÁNG', 'Saigon · 5 AM', 470);
}

// =================================================================== s2  4.267 – 6.4  alley: neon flickers on, tourist sniffs
function s2(ctx, lt, p, T) {
  const neon = CT.neonFlicker(T, 4.8, 0.533, 7);
  const dawn = 0.04;
  const z = lerp(1.3, 1.42, ease.inOut(p));
  const o = { view: 'wide', dawn, neon, smoke: 0.7, heat: 1 };
  ctx.fillStyle = '#0a0d24'; ctx.fillRect(0, 0, W, H);
  cam(ctx, lerp(575, 560, p), lerp(905, 935, p), z, 0, () => {
    const a = CT.alley(ctx, T, Object.assign({ layer: 'back' }, o));
    const nPos = { x: a.neon.x, y: a.neon.y };
    CT.coNam(ctx, a.vendor.x, a.vendor.y, a.vendor.s, { pose: 'fan', k: 0.6, t: T, dawn, light: { x: a.grill.x, y: a.grill.y, k: 0.9 }, neon: { col: 'pink', k: neon, x: nPos.x, y: nPos.y } });
    CT.alley(ctx, T, Object.assign({ layer: 'cart' }, o));
    CT.cat(ctx, a.stool2.x, a.stool2.y, a.stool2.s, { t: T, wake: seg01(T, 5.6, 6.1) });
    // tourist walks in from the right, stops, sniffs (floats toward the grill)
    const Z = 5.7, walkK = ease.out(seg01(lt, 0.0, 1.15));
    const sniffK = ease.inOut(seg01(lt, 1.1, 2.05));
    const Xm = lerp(2.2, 0.25, walkK) - 0.1 * sniffK;
    const [tx, ty] = a.proj(Xm, 0, Z), ts = a.sAt(Z) * 0.86;
    const tl = { dawn, light: { x: a.grill.x, y: a.grill.y, k: 0.55 }, neon: { col: 'cyan', k: 0.25 + 0.75 * neon, x: nPos.x, y: nPos.y } };
    CT.alley(ctx, T, Object.assign({ layer: 'stools' }, o));
    let ta;
    if (lt < 1.1) ta = CT.tourist(ctx, tx, ty, ts, Object.assign({ pose: 'walk', t: T, speed: 0.95, flip: true, expr: 'smile' }, tl));
    else ta = CT.tourist(ctx, tx, ty, ts, Object.assign({ pose: 'sniff', k: sniffK, t: T, flip: true, expr: 'sniff' }, tl));
    CT.alley(ctx, T, Object.assign({ layer: 'front' }, o));
    // grill smoke drifting through the sign light
    CT.charcoalSmoke(ctx, T * 0.8, { x: a.grill.x, y: a.grill.y - 10, w: 110, h: 640, density: 0.55, tint: 'neon', drift: 190, alpha: 0.75, s: 0.55, seed: 4, neonX: nPos.x, light: { x: nPos.x, y: nPos.y, r: 260, col: [255, 90, 190], k: neon } });
    // aroma ribbons from the grill to his nose
    const nose = ta && ta.nose ? ta.nose : [tx - 40 * ts, ty - 540 * ts];
    const nArr = Array.isArray(nose) ? nose : [nose.x, nose.y];
    CT.smellLines(ctx, T, [a.grill.x + 30, a.grill.y - 70], nArr, ease.out(seg01(lt, 0.9, 1.7)), { n: 3, s: 0.7, gap: 20 });
    // low floor haze
    haze(ctx, T, 21, 6, '170,150,220', 0.18, 100, 1180, 900, 380, 120, 260, 18, -10);
  });
  // foreground motorbike whips past (left -> right) as the shot opens
  const mk = seg01(lt, 0.0, 0.5);
  if (mk > 0 && mk < 1) {
    const mx = lerp(-700, 1750, mk);
    motoPass(ctx, mx, 2100, 2.1, 1, T);
    L.glow(ctx, mx + 420, 1840, 320, 'rgba(255,240,200,0.9)', 0.7);
    L.glow(ctx, mx + 420, 1840, 80, 'rgba(255,255,240,1)', 0.9);
  }
}

// =================================================================== s3  6.4 – 8.533  grill close-up, fan on the beats
const S3_BEATS = [6.4, 6.933, 7.467, 8.0];
function s3(ctx, lt, p, T) {
  const dawn = 0.03;
  const tb = lastHit(T, S3_BEATS), u = tb < 0 ? 9 : T - tb;
  // fan stroke: fast down-swing (0..0.18 s), slow recovery
  const sw = u < 0.18 ? ease.out(u / 0.18) : 1 - ease.inOut(clamp((u - 0.18) / 0.34));
  const fanHit = hitAt(T, tb, 0.5);
  const heat = 1, fanK = 0.35 + 0.65 * fanHit;
  const z = lerp(1.22, 1.34, ease.inOut(p)) + 0.018 * fanHit, tSlow = 6.4 + lt * 0.55;
  ctx.fillStyle = '#100a14'; ctx.fillRect(0, 0, W, H);
  cam(ctx, lerp(530, 550, p), lerp(840, 810, p), z, lerp(-0.012, 0.01, p), () => {
    const g = CT.grillClose(ctx, T, { heat, fan: fanK, dawn, neon: 0.9, smoke: 0.4 });
    const CH = [[0.32, 0.3, 0.12, 0.7], [0.67, 0.4, -0.1, 0.85], [0.46, 0.7, 0.05, 0.6]];
    CH.forEach(([u0, v0, rot, cook], i) => {
      const q = g.rackPt(u0, v0), s = q.s * 1.35;
      CT.porkChop(ctx, q.x, q.y, s, { cook, t: T, seed: i + 1, rot, sparkle: false });
      CT.sizzle(ctx, T, q.x, q.y + 6 * s, 0.75 + 0.5 * fanHit, { r: 150 * s, ryr: 0.42, s, seed: 30 + i, n: 30, spat: 12 });
      CT.glazeSparkle(ctx, T, q.x, q.y - 10 * s, 120 * s, 0.45, { n: 2, ryr: 0.4, seed: 40 + i, size: 0.8 });
    });
    // fat drips -> flare-ups (off the beat)
    [[6.62, 0.55, 0.5], [7.18, 0.2, 0.55], [7.72, 0.82, 0.6], [8.25, 0.4, 0.45]].forEach(([tf, uu, vv], i) => {
      const k = seg01(T, tf, tf + 0.7);
      if (k > 0 && k < 1) { const q = g.rackPt(uu, vv); CT.flareUp(ctx, T, q.x, q.y + 40, k, { s: 1.1 * q.s, seed: 50 + i }); }
    });
    CT.sparks(ctx, T, { x: 540, y: 1150, w: 760, h: 900, n: 30, k: 0.8, seed: 3 });
    if (tb >= 0) CT.sparks(ctx, T, { x: 470, y: 1080, w: 700, h: 1000, n: 90, k: 1.2, s: 1.2, wind: -60, seed: 9 + S3_BEATS.indexOf(tb), t0: tb + 0.06 });
    CT.charcoalSmoke(ctx, tSlow, { x: 540, y: 1060, w: 760, h: 1000, density: 0.85, tint: 'neon', drift: -140, alpha: 0.9, s: 1.2, seed: 6, neonX: 560, light: { x: 540, y: 1200, r: 600, col: [255, 140, 60], k: 0.8 } });
  });
  // fan from the right edge (Cô Năm's hand), swinging down on every beat
  const wx = 990, wy = 560 + 60 * sw;
  const rot = lerp(-1.15, -2.05, sw);
  if (fanHit > 0.05) CT.fanWhoosh(ctx, T, wx, wy, fanHit, { r: 360, a0: -2.75, a1: -3.65, s: 1.2, seed: 2 });
  CT.quatNan(ctx, wx, wy, 2.0, rot, { blur: clamp(fanHit * 1.2) });
  forearm(ctx, 1180, 420, wx + 18, wy + 4, 1.0, 1);
  // XÈO XÈO!
  CT.ctWord(ctx, T, 'XEO', 470, 330, { t0: 6.55, size: 130, out: seg01(T, 8.25, 8.5) });
}

// =================================================================== s4  8.533 – 12.8  title over the cart in neon smoke
function s4(ctx, lt, p, T) {
  const dawn = lerp(0.04, 0.16, p);
  const o = { view: 'cart', dawn, neon: 1, smoke: 0.9, heat: 1 };
  const z = lerp(1.18, 1.08, ease.out(p));
  ctx.fillStyle = '#0a0d24'; ctx.fillRect(0, 0, W, H);
  cam(ctx, lerp(470, 455, p), lerp(990, 950, p), z, lerp(0.012, -0.004, ease.inOut(p)), () => {
    const a = CT.alley(ctx, T, Object.assign({ layer: 'back' }, o));
    const vx = a.vendor.x - 175;
    CT.coNam(ctx, vx, a.vendor.y, a.vendor.s, { pose: 'fan', k: 0.75, t: T, flip: false, expr: 'smile', dawn, light: { x: a.grill.x, y: a.grill.y, k: 1, r: 520 }, neon: { col: 'pink', k: 0.9, x: a.neon.x, y: a.neon.y } });
    CT.alley(ctx, T, Object.assign({ layer: 'cart' }, o));
    CT.alley(ctx, T, Object.assign({ layer: 'stools' }, o));
    CT.alley(ctx, T, Object.assign({ layer: 'front' }, o));
    // the smoke halo: big neon-lit column rising from the grill into the title area
    CT.charcoalSmoke(ctx, T * 0.7, { x: a.grill.x + 20, y: a.grill.y - 20, w: 220, h: 1050, density: 0.8, tint: 'neon', drift: 260, alpha: 0.85, s: 1.25, seed: 12, neonX: a.neon.x, light: { x: a.neon.x, y: a.neon.y + 80, r: 520, col: [255, 80, 180], k: 0.9 } });
    CT.sparks(ctx, T, { x: a.grill.x, y: a.grill.y, w: 200, h: 700, n: 40, k: 1, seed: 5 });
    CT.embersGlow(ctx, T, a.grill.x, a.grill.y + 6, 220, 40, { k: 1.2, seed: 2 });
  });
  // sign spill from just above the frame + soft depth haze
  CT.neonLight(ctx, 520, -40, 700, 0.55, '255,70,170');
  CT.neonLight(ctx, 760, 0, 420, 0.3, '80,220,255');
  haze(ctx, T, 41, 6, '200,120,210', 0.16, -100, 1300, W + 200, 620, 160, 320, 22, -18);
  X.title(ctx, T, 8.533, 12.7, 420, 'Saigon Broken Rice', 'CƠM TẤM', 'SÀI GÒN', 112, 86);
}

// =================================================================== s5  12.8 – 14.933  ① rice pot, lid off, paddle scoop
function s5(ctx, lt, p, T) {
  const dawn = 0.22;
  const lid = ease.out(seg01(T, 12.8, 13.2));
  const burst = hitAt(T, 12.85, 1.1);
  // paddle: dips in 13.45..13.85, rises with a heap 13.85..14.5, camera pushes onto it (macro)
  const dip = ease.inOut(seg01(T, 13.45, 13.88)), rise = ease.inOut(seg01(T, 13.92, 14.55));
  const push = ease.inOut(seg01(T, 13.7, 14.9));
  ctx.fillStyle = '#0c1028'; ctx.fillRect(0, 0, W, H);
  cam(ctx, lerp(540, 600, push), lerp(1000, 900, push), lerp(1.0, 1.55, push) + 0.03 * ease.out(p), 0, () => {
    CT.counterTop(ctx, T, { surface: 'steel', dawn, neon: 0.8, edge: 1180 });
    // lid lifts (ricePot) then is carried off up-right: split-draw the pot body and the lid
    const off = ease.in(seg01(T, 13.12, 13.5));
    if (off <= 0) CT.ricePot(ctx, 540, 1180, 1.12, { lid, t: T, steam: 0.6 + 0.4 * burst, seed: 2 });
    else {
      ctx.save(); ctx.beginPath(); ctx.rect(-500, 1024, W + 1000, H); ctx.clip();
      CT.ricePot(ctx, 540, 1180, 1.12, { lid: 1, t: T, steam: 1, seed: 2 }); ctx.restore();
      if (off < 1) {
        ctx.save(); ctx.translate(760 * off, -620 * off); ctx.beginPath(); ctx.rect(-500, -500, W + 1000, 1524); ctx.clip();
        CT.ricePot(ctx, 540, 1180, 1.12, { lid: 1, t: T, steam: 0, seed: 2 }); ctx.restore();
      }
    }
    CT.steam(ctx, T, { x: 540, y: 1170, w: 520, h: 900, n: 14, k: 0.5 + 1.2 * burst, s: 1.6, seed: 8, warm: 0.15 });
    L.glow(ctx, 540, 1150, 420, 'rgba(255,236,200,0.7)', 0.25 + 0.4 * burst);
    if (dip > 0) {
      const px = lerp(820, 600, dip), py = lerp(600, 1150, dip) - lerp(0, 330, rise);
      const sc = CT.paddleScoop(ctx, px, py, 1.15, { rot: -0.6 - 0.25 * rise, k: rise, t: T, steam: rise });
      if (rise > 0.6) {
        CT.glazeSparkle(ctx, T, px, py - 40, 120, (rise - 0.6) / 0.4, { n: 5, seed: 7, size: 0.8 });
        CT.steam(ctx, T, { x: px, y: py - 40, w: 180, h: 420, n: 8, k: 0.9, s: 0.9, seed: 12 });
      }
    }
  });
  // warm lamp key from the top-left + pink neon rim right
  CT.neonLight(ctx, 1100, 700, 600, 0.35, '255,70,170');
  CT.neonLight(ctx, -40, 620, 520, 0.28, '80,220,255');
  haze(ctx, T, 51, 5, '235,225,255', 0.12, -100, 1250, W + 200, 700, 160, 300, 10, -40);
  cap(ctx, T, 12.8, 14.933, 'Gạo tấm hấp thơm', 'Fluffy steamed broken rice', 1);
}

// =================================================================== s6  14.933 – 17.067  ② marinade bowl top-down, drops on beats
function s6(ctx, lt, p, T) {
  const dawn = 0.27;
  const b0 = 14.933, b1 = 15.467, b2 = 16.0, b3 = 16.533;
  const add = [
    { item: 'lemongrass', k: ease.out(seg01(T, b0, b0 + 0.38)) },
    { item: 'garlic', k: ease.out(seg01(T, b0 + 0.08, b0 + 0.46)) },
    { item: 'shallot', k: ease.out(seg01(T, b1, b1 + 0.4)) },
    { item: 'honey', k: seg01(T, b2, b2 + 0.5) },
    { item: 'fishsauce', k: seg01(T, b3, b3 + 0.4) },
    { item: 'milk', k: seg01(T, b3 + 0.08, b3 + 0.45) },
  ];
  const toss = ease.inOut(seg01(T, 16.75, 17.06));
  const punch = 0.025 * (hitAt(T, b0, 0.25) + hitAt(T, b1, 0.25) + hitAt(T, b2, 0.25) + hitAt(T, b3, 0.25));
  ctx.fillStyle = '#e8d6cc'; ctx.fillRect(0, 0, W, H);
  const nudge = ease.out(seg01(T, b3 - 0.1, b3 + 0.15)) * (1 - ease.inOut(seg01(T, b3 + 0.3, b3 + 0.7)));
  cam(ctx, 540, 1060, lerp(1.06, 1.16, ease.inOut(p)) + punch, lerp(-0.07, 0.05, ease.inOut(p)), () => {
    CT.counterTop(ctx, T, { topDown: true, surface: 'tile', dawn, neon: 0.6 });
    // soft contact shadows
    L.glow(ctx, 560, 1090, 540, 'rgba(40,20,40,0.55)', 0.6, 'multiply');
    L.glow(ctx, 790, 1640, 190, 'rgba(40,20,40,0.5)', 0.6, 'multiply');
    // knife + loose lemongrass on the board corner (foreground)
    CT.knife(ctx, 70, 1520, 1.1, { rot: 0.42 });
    CT.marinadeBowl(ctx, T, { x: 540, y: 1060, s: 1.18, add, toss, seed: 3 });
    // nước mắm saucer nudged in on the fish-sauce beat
    CT.nuocMamBowl(ctx, 790 - 30 * nudge, 1625 - 40 * nudge, 1.0, { pour: 0, sq: 0.95, t: T });
  });
  // calm band behind the caption
  const cg = ctx.createLinearGradient(0, 250, 0, 480);
  cg.addColorStop(0, 'rgba(30,18,40,0)'); cg.addColorStop(0.5, 'rgba(30,18,40,0.45)'); cg.addColorStop(1, 'rgba(30,18,40,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 250, W, 230);
  // warm key + neon kiss from the edges
  CT.neonLight(ctx, 1120, 1500, 560, 0.3, '255,70,170');
  CT.neonLight(ctx, -60, 500, 520, 0.25, '80,220,255');
  cap(ctx, T, 14.933, 17.067, 'Ướp sả, tỏi, mật ong, nước mắm', 'Lemongrass, garlic, honey, fish sauce', 2, { vsize: 50 });
}

// =================================================================== s7  17.067 – 20.267  ③ hero grill, flips on beats 32/34/36
const S7_FLIPS = [17.067, 18.133, 19.2];
function s7(ctx, lt, p, T) {
  const dawn = 0.3, DUR = 0.62;
  const tSlow = 17.067 + lt * 0.45;
  ctx.fillStyle = '#100a14'; ctx.fillRect(0, 0, W, H);
  const fl = hitAt(T, lastHit(T, S7_FLIPS) + DUR * 0.75, 0.3);
  const z = lerp(1.24, 1.38, ease.inOut(p)) + 0.02 * fl;
  cam(ctx, lerp(530, 550, p), lerp(850, 800, p), z, lerp(0.02, -0.015, ease.inOut(p)), () => {
    const g = CT.grillClose(ctx, T, { heat: 1, fan: 0.4, dawn, neon: 1, smoke: 0.45 });
    const CH = [[0.33, 0.3, 0.1], [0.67, 0.42, -0.12], [0.47, 0.72, 0.04]];
    const tongsAt = [];
    CH.forEach(([u0, v0, rot], i) => {
      const tf = S7_FLIPS[i];
      const f = ease.inOut(seg01(T, tf, tf + DUR));
      const q = g.rackPt(u0, v0), s = q.s * 1.38;
      const landed = hitAt(T, tf + DUR * 0.8, 0.6);
      const an = CT.porkChop(ctx, q.x, q.y, s, { cook: 0.62, cookB: 1, flip: f, t: T, seed: i + 1, rot, sparkle: false });
      if (f > 0 && f < 1) tongsAt.push([an.grab || an.center, s, f]);
      CT.sizzle(ctx, T, q.x, q.y + 6 * s, 0.7 + 1.2 * landed, { r: 150 * s, ryr: 0.42, s, seed: 30 + i, n: 30, spat: 10 + 30 * landed });
      if (f >= 1) CT.glazeSparkle(ctx, T, q.x, q.y - 12 * s, 130 * s, 0.5 * (1 - seg01(T, tf + 1.2, tf + 2)), { n: 3, ryr: 0.4, seed: 60 + i, size: 0.9 });
      // each flip: flare-up + spark burst + smoke puff
      const fk = seg01(T, tf + DUR * 0.7, tf + DUR * 0.7 + 0.8);
      if (fk > 0 && fk < 1) CT.flareUp(ctx, T, q.x - 30 * s, q.y + 50, fk, { s: 1.3 * q.s, seed: 70 + i });
      if (T >= tf) CT.sparks(ctx, T, { x: q.x, y: q.y, w: 300, h: 900, n: 80, k: 1.2, s: 1.15, wind: 40, seed: 80 + i, t0: tf + DUR * 0.7 });
      const pk = seg01(T, tf + DUR * 0.6, tf + DUR * 0.6 + 1.6);
      if (pk > 0 && pk < 1) CT.charcoalSmoke(ctx, 17.067 + (T - tf) * 0.5, { x: q.x, y: q.y, w: 220, h: 700 * pk + 200, density: 0.8 * (1 - pk), tint: 'neon', drift: 80, alpha: 0.8 * Math.sin(pk * PI), s: 0.9, seed: 90 + i, neonX: q.x });
    });
    CT.sparks(ctx, T, { x: 540, y: 1150, w: 760, h: 900, n: 28, k: 0.8, seed: 4 });
    CT.charcoalSmoke(ctx, tSlow, { x: 540, y: 1060, w: 780, h: 1050, density: 0.85, tint: 'neon', drift: 140, alpha: 0.9, s: 1.2, seed: 16, neonX: 540, light: { x: 540, y: 1200, r: 600, col: [255, 140, 60], k: 0.8 } });
    // tongs in the hand from upper right while flipping
    for (const [gp, s, f] of tongsAt) {
      const gx = Array.isArray(gp) ? gp[0] : gp.x, gy = Array.isArray(gp) ? gp[1] : gp.y;
      const inK = ease.out(clamp(f * 4)) * ease.out(clamp((1 - f) * 4));
      CT.tongs(ctx, gx + (1 - inK) * 260, gy - (1 - inK) * 200 - 60 * Math.sin(f * PI), 1.25 * s, { rot: 2.3 - 0.4 * Math.sin(f * PI), open: f < 0.12 || f > 0.9 ? 0.45 : 0.08, len: 520 });
    }
  });
  // neon backlight rim on the smoke (top)
  CT.neonLight(ctx, 300, 200, 560, 0.35, '255,70,170');
  CT.neonLight(ctx, 860, 260, 480, 0.3, '80,220,255');
  haze(ctx, T, 71, 5, '255,170,120', 0.12, -100, 1450, W + 200, 520, 140, 280, -14, -30);
  cap(ctx, T, 17.067, 20.267, 'Nướng than hoa, trở đều tay', 'Charcoal grilled, flip, flip, flip', 3);
}

// =================================================================== s8  20.267 – 22.4  ④ bì tossed with thính, powder puffs
const S8_BEATS = [20.267, 20.8, 21.333, 21.867];
function s8(ctx, lt, p, T) {
  const dawn = 0.35;
  const tb = lastHit(T, S8_BEATS), u = tb < 0 ? 9 : T - tb;
  const toss = u < 0.5 ? u / 0.5 : 0;
  const thinh = lerp(0.45, 1, ease.out(seg01(T, 20.267, 21.9)));
  ctx.fillStyle = '#0c1028'; ctx.fillRect(0, 0, W, H);
  cam(ctx, 540, lerp(1000, 975, p), lerp(1.08, 1.17, ease.inOut(p)) + 0.02 * hitAt(T, tb, 0.25), lerp(-0.015, 0.01, p), () => {
    CT.counterTop(ctx, T, { surface: 'steel', dawn, neon: 0.6, edge: 880 });
    const bt = CT.biTray(ctx, T, { x: 540, y: 1300, s: 1.45, toss, thinh, seed: 4 });
    const top = bt.top || [540, 1060];
    const tx = Array.isArray(top) ? top[0] : top.x, ty = Array.isArray(top) ? top[1] : top.y;
    // golden thính dust: big puff on the downbeat, smaller on each toss
    S8_BEATS.forEach((b, i) => {
      const k = seg01(T, b + 0.05, b + (i === 0 ? 1.8 : 1.1));
      if (k > 0 && k < 1) CT.powderPuff(ctx, T, tx + (i % 2 ? 60 : -50), ty - 40, k, { s: i === 0 ? 1.7 : 1.05, seed: 20 + i });
    });
    L.dust(ctx, T, 9, 40, 200, 560, 680, 760, '255,214,150', 3, 0.5);
  });
  // first warm dawn light sneaking in through the smoke
  CT.sunShafts(ctx, T, { k: 0.45, n: 7, motes: true });
  CT.neonLight(ctx, -60, 520, 520, 0.22, '255,70,170');
  haze(ctx, T, 81, 5, '255,200,150', 0.14, -100, 1500, W + 200, 520, 160, 300, 16, -24);
  cap(ctx, T, 20.267, 22.4, 'Bì trộn thính', 'Shredded pork skin + rice powder', 4);
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8 };
