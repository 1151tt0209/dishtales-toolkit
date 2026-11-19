'use strict';
// shotsA.js — "Cá lóc nướng trui" shots 1..8 (0 – 25.333 s). 90 BPM grid: beat 2/3 s.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes (9.333, 22.667) and grain.
// Look: 9 PM, Mekong flood season. Moonlit indigo/teal field, head-torch whites, then orange straw fire on the dike.
const CL = require('./clprops');
const X = require('./text');
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- beat helpers
const BEAT = 2 / 3;
const seg01 = (v, a, b) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cap = (ctx, T, s0, s1, vi, en, n) => X.caption(ctx, T, s0 + 0.15, s1 - 0.1, vi, en, { n, y: 360 });
const shake = (T, t0, amp, dur = 0.9) => {
  const u = T - t0; if (u < 0 || u > dur) return [0, 0, 0];
  const d = Math.pow(1 - u / dur, 2) * amp;
  return [Math.sin(u * 71) * d, Math.cos(u * 57 + 1) * d * 0.8, Math.sin(u * 43) * d * 0.0009];
};

// camera that never reveals the black canvas edge: clamps the look-at point for the zoom.
// Rotation and shake (sx, sy in screen px) get a little extra zoom margin.
function cam(ctx, cx, cy, z, rot, fn, sx = 0, sy = 0) {
  const zz = Math.max(1, z) * (1 + Math.abs(rot || 0) * 1.6) + (Math.abs(sx) + Math.abs(sy)) / 700;
  const hw = W / 2 / zz, hh = H / 2 / zz;
  cx = clamp(cx, hw, W - hw); cy = clamp(cy, hh, H - hh);
  L.cam(ctx, cx - sx / zz, cy - sy / zz, zz, rot, fn);
}

// ---------------------------------------------------------------- one-time caches (blur allowed only here)
const CACHE = {};
function cached(name, w, h, fn) {
  if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; }
  return CACHE[name];
}
function blurred(name, w, h, blur, fn) {
  return cached(name, w, h, (x) => {
    const tmp = createCanvas(w, h); fn(tmp.getContext('2d'));
    x.filter = `blur(${blur}px)`; x.drawImage(tmp, 0, 0); x.filter = 'none';
  });
}
// out-of-focus dike at night, no fire yet (s5, s6 backdrop)
function dikeBlur() {
  return blurred('dikeBlurNoFire', W, H, 14, (x) => {
    x.fillStyle = '#0b1020'; x.fillRect(0, 0, W, H);
    x.save(); x.translate(W / 2, H / 2); x.scale(1.06, 1.06); x.translate(-W / 2, -H / 2);
    CL.dikeScene(x, 0.5, { view: 'close', fire: 0, fireflies: 0, front: false, hut: { X: -900, Z: 5200, lamp: 0.8 } });
    x.restore();
    x.fillStyle = 'rgba(8,10,22,0.28)'; x.fillRect(0, 0, W, H);
  });
}

// glowing, bumpy mound of burning straw drawn over the flame base: hides strawFire's flat bed line
function emberMound(ctx, x, y, w, h, t, seed = 1, k = 1) {
  const r = rng(seed), n = 14, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, ex = Math.sin(PI * u);
    pts.push([x - w + 2 * w * u, y - h * (0.35 + 0.65 * ex) * (0.75 + r() * 0.5) - Math.sin(t * 6 + i) * 2]);
  }
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x - w * 1.04, y + h * 0.18);
  for (const [px, py] of pts) ctx.lineTo(px, py);
  ctx.lineTo(x + w * 1.04, y + h * 0.18);
  ctx.ellipse(x, y + h * 0.18, w * 1.04, h * 0.32, 0, 0, PI);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y - h, 0, y + h * 0.4);
  g.addColorStop(0, 'rgba(255,170,70,' + 0.95 * k + ')'); g.addColorStop(0.35, 'rgba(220,90,30,' + 0.95 * k + ')');
  g.addColorStop(0.75, 'rgba(90,32,18,0.97)'); g.addColorStop(1, 'rgba(40,18,14,0.95)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 38; i++) { // glowing straw stalks on the mound
    const px = x + (r() * 2 - 1) * w * 0.95, ex = Math.sqrt(Math.max(0, 1 - Math.pow((px - x) / w, 2)));
    const py = y - h * ex * (0.2 + r() * 0.7), a = (r() - 0.5) * 1.2, len = 10 + r() * 22;
    const fl = 0.55 + 0.45 * Math.sin(t * (5 + r() * 6) + i);
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,' + ((170 + 70 * fl) | 0) + ',90,' + 0.85 * k + ')' : 'rgba(70,30,20,0.9)';
    ctx.lineWidth = 2 + r() * 2;
    ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * len, py - Math.sin(a) * len); ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); ctx.stroke();
  }
  ctx.restore();
}

// small flying straw bits (s7 armful landing)
function strawBurst(ctx, x, y, s, k, seed) {
  if (k <= 0 || k >= 1) return;
  const r = rng(seed);
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.6, v = (220 + r() * 380) * s, len = (16 + r() * 22) * s, sp = (r() - 0.5) * 14;
    const px = x + Math.cos(a) * v * k, py = y + Math.sin(a) * v * k + 520 * s * k * k;
    const ang = sp * k + r() * 3;
    ctx.globalAlpha = (1 - k) * 0.95;
    ctx.strokeStyle = i % 3 ? '#d8b56a' : '#f2d690'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(px - Math.cos(ang) * len, py - Math.sin(ang) * len); ctx.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); ctx.stroke();
  }
  ctx.restore();
}

// =================================================================== s1  0 – 4.0  drone over the moonlit flood
function s1(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const high = lerp(1, 0.22, e), camZ = lerp(0, 650, ease.out(p));
  const tzW = 2350, tX = lerp(520, 150, p); // a boatman's torch gliding across the field
  cam(ctx, 540, 960, 1.05, -0.018 * (1 - e) + Math.sin(lt * 0.9) * 0.004, () => {
    CL.floodField(ctx, lt, {
      high, camZ, hut: { X: -320, Z: 3000, lamp: 0.85 }, fireflies: 44, moonS: 1.1,
      midZ: tzW - camZ,
      mid: (c, R) => {
        const g = R.ground(tX, tzW), bs = Math.max(0.16, g.s * 0.55);
        CL.xuongMoored(c, g.x, g.y, bs, { t: lt, pole: false, seed: 3 });
        CL.distantTorch(c, g.x - 300 * bs, g.y - 260 * bs, Math.max(0.9, g.s * 2.2), lt, { waterY: g.y + 6 });
      },
    });
  });
  X.label(ctx, T, 0.35, 3.75, 'MÙA NƯỚC NỔI · 9 GIỜ TỐI', 'Mekong flood season · 9 PM', 470);
}

// =================================================================== s2  4.0 – 6.667  Chú Ba wades, tourist in the xuồng
function s2(ctx, lt, p, T) {
  const t = T, z = lerp(1.0, 1.07, ease.inOut(p));
  cam(ctx, 560, 1040, z, 0, () => {
    const sb = 0.62, bx = 800;
    const r = CL.fieldWaterClose(ctx, t, {
      hut: { X: -900, Z: 3200, lamp: 0.7 }, midZ: 1000 / sb, fireflies: 22,
      mid: (c, R) => {
        const wy = R.wl(sb);
        const b = CL.xuongMoored(c, bx, wy, sb, { t, flip: true, part: 'back' });
        CL.touristNight(c, b.seat[0], b.seat[1] + 8 * sb, sb * 0.95, { pose: 'phoneLight', stand: false, t, lightAt: [bx - 330, wy + 150], expr: 'smile' });
        CL.xuongMoored(c, bx, wy, sb, { t, flip: true, part: 'front', pole: false });
      },
    });
    const s = 1.65, wl = r.wl(s), cx = lerp(260, 320, p);
    CL.chuBa(ctx, cx, wl + 130 * s, s, { pose: 'wade', trap: true, t, speed: 0.55, torch: true, torchAt: [cx + 430, wl + 250], waterline: wl, basket: true });
    CL.ripplesNight(ctx, cx + 10, wl + 6, 1.4, { t, n: 3, r: 120, period: 1.4, alpha: 0.6 });
  });
}

// =================================================================== s3  6.667 – 9.333  the nơm slams down: TÕM!
const SLAM = 7.333;
function s3(ctx, lt, p, T) {
  const tt = T < SLAM ? T : SLAM + (T - SLAM) * 0.35; // slow motion after the slam
  const kTrap = ease.in(seg01(T, 7.02, SLAM));
  const trapSub = 0.5 * seg01(T, SLAM, SLAM + 0.08);
  const sh = shake(T, SLAM, 14, 0.5);
  const z = lerp(1.0, 1.05, ease.out(p)) + 0.03 * hitAt(T, SLAM, 0.4);
  const s = 2.4, hz = 900, wl = hz + 70 * s, cx = 250, y = wl + 130 * s;
  const trapX = cx + 150 * s * 1.0 + 0, trapBase = y + 43 * s, trapWl = wl; void trapBase;
  cam(ctx, 560, 1050, z, sh[2], () => {
    const sb = 0.5, bx = 930;
    CL.fieldWaterClose(ctx, T, {
      horizon: hz, hut: { X: -1200, Z: 3600, lamp: 0.6 }, midZ: 1000 / sb, fireflies: 14, frontStalks: false,
      mid: (c, R) => {
        const wy = R.wl(sb);
        const b = CL.xuongMoored(c, bx, wy, sb, { t: T, flip: true, part: 'back' });
        const wow = T > SLAM + 0.15;
        CL.touristNight(c, b.seat[0], b.seat[1] + 8 * sb, sb * 0.95, { pose: wow ? 'point' : 'phoneLight', stand: false, t: T, lightAt: [trapX, trapWl], expr: wow ? 'wow' : 'neutral', lean: wow ? -0.12 : 0 });
        CL.xuongMoored(c, bx, wy, sb, { t: T, flip: true, part: 'front', pole: false });
      },
    });
    // the fish under the beam before the slam: swirl + ripples
    if (T < SLAM + 0.05) {
      CL.ripplesNight(ctx, trapX, trapWl + 20, 1.6, { t: T, n: 3, r: 150, period: 0.9, alpha: 0.8 });
      ctx.save(); ctx.globalAlpha = 0.45; CL.snakehead(ctx, trapX - 30, trapWl + 45, 0.55, { wiggle: 0.4, t: T, rot: 0.15, rim: 0.3 }); ctx.restore();
    }
    CL.chuBa(ctx, cx, y, s, {
      pose: 'trapDown', k: kTrap, trapSub, t: T, torch: true, torchAt: [trapX + 20, trapWl + 40], beamLen: 700, waterline: wl, expr: T > SLAM ? 'grin' : 'focus',
      inside: (c) => {
        if (T < SLAM) return;
        const jump = Math.abs(Math.sin((tt - SLAM) * 5.5)) * 90;
        CL.snakehead(c, 0, -300 - jump, 0.5, { wiggle: 1, t: tt, rot: Math.sin(tt * 7) * 0.3, bend: Math.sin(tt * 6) * 0.45, mouth: 0.7, eye: 'angry', rim: 1 });
      },
    });
    if (T >= SLAM) {
      const kS = clamp((T - SLAM) / 2.4);
      CL.splashCrown(ctx, trapX, trapWl, 0.95, kS, { t: tt, warm: 0.35, seed: 5 });
      CL.dropletsSlowmo(ctx, trapX, trapWl - 160, 1.1, { t: tt, k: clamp((T - SLAM) / 1.4), n: 46, warm: 0.6, seed: 8 });
    }
  }, sh[0], sh[1]);
  if (T >= SLAM) CL.clWord(ctx, 'TOM', 700, 620, 150, { t: T, k: (T - SLAM) / 0.3, out: seg01(T, 9.0, 9.3) });
}

// =================================================================== s4  9.333 – 13.333  TITLE over the bonfire
function bonfire(ctx, t, gx, gy, ps, fk, o = {}) {
  // fire rises out of a low smouldering mound that hides the flat flame base
  CL.strawFire(ctx, gx, gy - 30 * ps, ps * 1.15, { t, k: fk, seed: o.seed ?? 4, wind: o.wind ?? 0.12, w: 230 });
  CL.emberGlow(ctx, gx, gy + 6 * ps, ps, { t, k: 0.9, w: 360, seed: 5 });
  emberMound(ctx, gx, gy - 6 * ps, 160 * ps * 1.15 * 1.0 + 40 * ps, 70 * ps, t, 21);
}
function s4(ctx, lt, p, T) {
  const t = T, z = lerp(1.0, 1.07, ease.inOut(p));
  let F;
  cam(ctx, 540, 1150, z, 0, () => {
    const r = CL.dikeScene(ctx, t, {
      view: 'wide', fire: 1, moon: [830, 250], moonS: 1.1, fireflies: 16,
      mid: (c, R) => {
        const [fx, fy] = R.fire, fs = R.fireS, cs = fs * 0.62;
        F = { fx, fy, fs };
        const fl = { x: fx, y: fy - 200 * fs, k: 1 };
        CL.chuBa(c, R.sit[0][0], R.sit[0][1], cs, { pose: 'sit', t, fireLight: fl, expr: 'smile', night: 0.35 });
        CL.touristNight(c, R.sit[1][0], R.sit[1][1], cs * 1.0, { pose: 'sitFire', stand: false, flip: true, t, fireLight: fl, expr: 'smile' });
        const ps = fs * 0.5;
        // the snakehead standing in the flames
        CL.snakehead(c, fx, fy - 300 * ps, ps, { rot: PI / 2, state: 'charred', skewerA: 140, skewerB: 160, t });
        bonfire(c, t, fx, fy, ps, 0.72 + 0.06 * Math.sin(t * 3.1));
      },
    });
    void r;
    CL.fireSmoke(ctx, F.fx + 20, F.fy - 700 * F.fs * 0.55, F.fs * 0.8, { t, k: 0.8, drift: 0.3, alpha: 0.45, h: 900 });
    CL.sparks(ctx, F.fx, F.fy - 260 * F.fs * 0.5, F.fs * 0.9, { t, n: 120, rise: 1300, spiral: 90, w: 200, wind: 0.35, seed: 4 });
    CL.fireLight(ctx, F.fx, F.fy - 150, 760, 0.85, { t });
  });
  X.title(ctx, T, 9.333, 13.233, 420, 'Mekong Straw-Fire Snakehead', 'CÁ LÓC', 'NƯỚNG TRUI', 112, 86);
}

// =================================================================== s5  13.333 – 16.0  ① fresh snakehead in the basket
function s5(ctx, lt, p, T) {
  const t = T, z = lerp(1.0, 1.06, ease.inOut(p));
  ctx.drawImage(dikeBlur(), 0, 0);
  CL.fireflies(ctx, t, { n: 14, x0: 0, y0: 500, w: W, h: 900, seed: 77, near: 0.8, size: 2.2 });
  cam(ctx, 540, 1100, z, 0, () => {
    // torch beam from the upper left (Chú Ba's head torch, off frame)
    CL.torchBeam(ctx, -60, 520, 0.62, 900, { spread: 0.24, k: 0.85, t, n: 30, hit: false, seed: 3 });
    const bx = 540, by = 1700, bs = 2.3;
    const wig = 0.55 + 0.45 * Math.max(0, Math.sin(t * 2.6));
    CL.snakehead(ctx, 530, 1045, 1.25, { rot: -1.2 + Math.sin(t * 3.3) * 0.07, wiggle: wig, t, mouth: 0.4 + 0.3 * Math.sin(t * 5), wet: 1, rim: 1, eye: 'normal' });
    CL.fishBasket(ctx, bx, by, bs, { t, fish: 1 });
    CL.dropletsSlowmo(ctx, 600, 820, 1.0, { t, k: 0.7, n: 28, warm: 0.3, seed: 12 });
    // cool head-torch pool on the fish
    CL.fireLight(ctx, 560, 900, 560, 0.55, { t, col: [200, 225, 255], flicker: 0.2 });
  });
  cap(ctx, T, 13.333, 16.0, 'Cá lóc đồng tươi rói', 'Fresh wild snakehead', 1);
}

// =================================================================== s6  16.0 – 18.667  ② bamboo skewer, mouth to tail
function s6(ctx, lt, p, T) {
  const t = T;
  let k;
  if (T < 16.25) k = 0;
  else if (T < 16.667) k = 0.45 * seg01(T, 16.25, 16.667);
  else if (T < 17.0) k = lerp(0.45, 0.55, seg01(T, 16.667, 17.0));
  else k = lerp(0.55, 1, seg01(T, 17.0, 17.333));
  const z = lerp(1.42, 1.52, ease.inOut(p)) + 0.035 * (hitAt(T, 16.667, 0.3) + hitAt(T, 17.333, 0.3));
  ctx.drawImage(dikeBlur(), 0, 0);
  CL.fireflies(ctx, t, { n: 12, x0: 0, y0: 400, w: W, h: 1000, seed: 78, near: 0.9, size: 2.4 });
  cam(ctx, 410, 1260, z, -0.02, () => {
    const s = 2.0, x = 560, y = 1900;
    const fishC = [x - 112 * s, y - 300 * s];
    CL.chuBa(ctx, x, y, s, { pose: 'skewer', k, t, torch: true, torchAt: [fishC[0] + 40, fishC[1] + 10], beamLen: 300, beamW: 150, night: 0.3 });
  });
  cap(ctx, T, 16.0, 18.667, 'Xiên que tre, từ miệng tới đuôi', 'Bamboo skewer, mouth to tail', 2);
}

// =================================================================== s7 / s8 shared dike layout
const PILE = { x: 580, y: 1440, s: 0.62 };
const CB = { x: 215, y: 1452, s: 1.3 };
const LF = [150, -110]; // lighter, local to Chú Ba (s8)
const TR = { x: 900, y: 1420, s: 0.98 };
function pileTop(k) { return PILE.y - 760 * PILE.s * Math.max(0.15, k); }

// =================================================================== s7  18.667 – 21.333  ③ stand it up, cover in straw
function s7(ctx, lt, p, T) {
  const t = T;
  const k = 0.55 * ease.out(seg01(T, 19.25, 19.42)) + 0.45 * ease.out(seg01(T, 19.92, 20.09));
  const z = 1.04 + 0.04 * ease.inOut(p) + 0.015 * (hitAt(T, 19.333, 0.3) + hitAt(T, 20.0, 0.3));
  cam(ctx, 560, 1080, z, 0, () => {
    CL.dikeScene(ctx, t, {
      view: 'close', fire: 0, fireflies: 18, hut: { X: -900, Z: 5200, lamp: 0.8 },
      mid: (c) => {
        // fish planted upright, head down, skewer in the mud
        const ps = PILE.s;
        CL.snakehead(c, PILE.x, PILE.y - 300 * ps, ps, { rot: PI / 2, state: 'skewered', skewerA: 140, skewerB: 230, t, rim: 1 });
        if (k > 0.01) CL.strawPile(c, PILE.x, PILE.y, ps, { t, k: Math.min(1, k), seed: 31 });
        CL.strawScraps(c, PILE.x - 330, PILE.y - 20, 660, 60, 9, { alpha: 0.8 });
        // Chú Ba with armfuls: throws on 19.333 and 20.0
        let pose = 'carryStraw', lean = 0, walk = false, cx = CB.x;
        if (T < 19.0) { walk = true; cx = lerp(CB.x - 90, CB.x, seg01(T, 18.667, 19.0)); }
        lean = 0.28 * Math.sin(PI * seg01(T, 19.1, 19.42)) + 0.28 * Math.sin(PI * seg01(T, 19.77, 20.09));
        if (T > 20.15) { pose = T > 20.5 ? 'thumbs' : 'stand'; lean = 0; }
        CL.chuBa(c, cx, CB.y, CB.s, { pose, t, walk, lean, torch: true, beam: false, expr: T > 20.5 ? 'grin' : 'smile' });
        // the thrown armfuls
        for (const [t0, t1, seed] of [[19.12, 19.34, 3], [19.79, 20.01, 5]]) {
          const u = seg01(T, t0, t1);
          if (u > 0 && u < 1) {
            const sx = cx + 60 * CB.s, sy = CB.y - 300 * CB.s, ex = PILE.x, ey = pileTop(T < 19.5 ? 0.5 : 0.95);
            const ax = lerp(sx, ex, u), ay = lerp(sy, ey, u) - Math.sin(PI * u) * 120;
            CL.strawArmful(c, ax, ay, 0.55 * lerp(1, 0.8, u), { t, seed, rot: lerp(0.05, 0.5, u) });
          }
          strawBurst(c, PILE.x, pileTop(t1 < 19.5 ? 0.55 : 1) + 40, 0.9, seg01(T, t1, t1 + 0.55), seed + 20);
        }
        // tourist filming from the right, seated on the dike
        CL.touristNight(c, TR.x, TR.y, TR.s, { pose: 'photo', stand: false, flip: true, t, expr: 'smile' });
      },
    });
  });
  cap(ctx, T, 18.667, 21.333, 'Cắm đứng, phủ rơm khô', 'Stand it up, cover in dry straw', 3);
}

// =================================================================== s8  21.333 – 25.333  ④ light it… WHOOSH!
const IGN = 22.667;
function s8(ctx, lt, p, T) {
  const t = T;
  const flame = ease.out(seg01(T, 21.9, 22.05));
  const fk = T < IGN ? 0 : (T < IGN + 0.4 ? ease.out(seg01(T, IGN, IGN + 0.4)) : T < 24.0 ? lerp(1, 0.9, seg01(T, IGN + 0.4, 24.0)) : lerp(0.9, 0.5, seg01(T, 24.0, 25.3)));
  const burn = T < IGN ? 0 : lerp(0.1, 0.35, seg01(T, IGN, IGN + 0.6)) + 0.15 * seg01(T, IGN + 0.6, 25.3);
  const CBX = 232, lit = [CBX + (LF[0] - 14) * CB.s, CB.y + (LF[1] - 22) * CB.s];
  // camera: push in on the lighter, then blown back by the whoosh + shake
  let cx, cy, z;
  if (T < IGN) { const u = ease.inOut(seg01(T, 21.333, IGN)); cx = lerp(560, 420, u); cy = lerp(1080, 1250, u); z = lerp(1.04, 1.42, u); }
  else { const u = ease.outExpo(seg01(T, IGN, IGN + 0.45)); cx = lerp(420, 560, u); cy = lerp(1250, 1000, u) - 30 * seg01(T, IGN + 0.45, 25.333); z = lerp(1.42, 0.98, u) + 0.02 * seg01(T, IGN + 0.45, 25.333); }
  const sh = shake(T, IGN, 26, 1.1);
  const fl = { x: PILE.x, y: PILE.y - 250, k: fk };
  cam(ctx, cx, cy, z, sh[2], () => {
    CL.dikeScene(ctx, t, {
      view: 'close', fire: fk, fireflies: T < IGN ? 18 : 6, hut: { X: -900, Z: 5200, lamp: 0.8 },
      mid: (c) => {
        const ps = PILE.s;
        CL.snakehead(c, PILE.x, PILE.y - 300 * ps, ps, { rot: PI / 2, state: 'skewered', skewerA: 140, skewerB: 230, t, rim: 1 });
        CL.strawPile(c, PILE.x, PILE.y, ps, { t, k: 1, burn, seed: 31, live: burn > 0 });
        CL.strawScraps(c, PILE.x - 330, PILE.y - 20, 660, 60, 9, { alpha: 0.8 });
        // pre-ignition: the lighter catches the straw edge
        if (T > 22.15 && T < IGN + 0.2) CL.strawFire(c, lit[0] + 22, lit[1] + 10, 0.22, { t, k: 0.25 * seg01(T, 22.15, IGN), seed: 9, glow: true, embers: false });
        if (fk > 0) {
          CL.emberGlow(c, PILE.x, PILE.y + 8, ps * 1.1, { t, k: 0.9, w: 330, seed: 5 });
          CL.strawFire(c, PILE.x, PILE.y - 30, ps * 1.45, { t, k: fk, seed: 4, wind: 0.1, w: 250 });
          emberMound(c, PILE.x, PILE.y - 4, 215, 62 * (1 - 0.3 * seg01(T, 24, 25.3)), t, 23, Math.min(1, fk * 1.3));
        }
        if (T >= IGN && T < IGN + 0.7) CL.whoosh(c, PILE.x, PILE.y - 30, 0.8, (T - IGN) / 0.6, { seed: 2 });
        // Chú Ba
        if (T < IGN) CL.chuBa(c, CBX, CB.y, CB.s, { pose: 'light', t, lightAt: LF, lightFig: true, flame, torch: true, beam: false, expr: 'smile' });
        else if (T < IGN + 0.5) CL.chuBa(c, CB.x - 30 * ease.out(seg01(T, IGN, IGN + 0.3)), CB.y, CB.s, { pose: 'squat', t, lean: -0.45, expr: 'o', torch: true, beam: false, fireLight: fl, brow: 1 });
        else CL.chuBa(c, CB.x - 30, CB.y, CB.s, { pose: 'laugh', t, torch: true, beam: false, fireLight: fl });
        // tourist: films, then jaw drop and pointing
        if (T < IGN) CL.touristNight(c, TR.x, TR.y, TR.s, { pose: 'photo', stand: false, flip: true, t, expr: 'smile' });
        else CL.touristNight(c, TR.x, TR.y, TR.s, { pose: 'point', stand: false, flip: true, t, expr: 'wow', lean: -0.15 * (1 - seg01(T, IGN + 0.8, IGN + 1.6)), fireLight: fl });
      },
    });
    if (fk > 0) {
      const ft = PILE.y - 1100 * ps8() * fk;
      CL.fireSmoke(ctx, PILE.x + 20, ft, 0.9, { t, k: fk, drift: 0.35, alpha: 0.4, h: 900 });
      CL.sparks(ctx, PILE.x, PILE.y - 300, 1.0, { t, n: Math.round(lerp(150, 90, seg01(T, IGN, 24.5))), rise: 1500, spiral: 130, w: 240, wind: 0.35, seed: 7 });
      CL.fireLight(ctx, PILE.x, PILE.y - 260, 1000, 0.9 * fk, { t });
    }
  }, sh[0], sh[1]);
  cap(ctx, T, 21.333, 25.333, 'Châm lửa… phừng!', 'Light it… WHOOSH!', 4);
  if (T >= IGN) CL.clWord(ctx, 'PHUNG', 540, 640, 170, { t: T, k: (T - IGN) / 0.3, out: seg01(T, 24.7, 25.1) });
}
const ps8 = () => PILE.s * 1.45;

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8 };
