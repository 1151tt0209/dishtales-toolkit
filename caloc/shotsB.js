// Cá lóc nướng trui – shots 9..15 (25.333–45.333 s). 90 BPM grid, BEAT = 2/3 s. Shots paint a full opaque frame;
// render.js adds grade / vignette / grain and the white flashes (30.667, 42.0).
'use strict';
const X = require('./text');
const L = require('./lib');
const CL = require('./clprops');
const NP = CL.NP;
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;

const iv = (a, b, v) => clamp((v - a) / (b - a));
const hitAt = (T, tb, d = 0.3) => { const u = T - tb; return u >= 0 && u < d ? 1 - u / d : 0; };
const cap = (ctx, T, t0, t1, vi, en, n) => X.caption(ctx, T, t0, t1, vi, en, { n, y: 360 });
function cam(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  L.cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}
const CACHE = {};
function cached(name, w, h, fn) { if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; } return CACHE[name]; }

// Chú Ba's forearm (black áo bà ba sleeve) reaching in from off-frame; ang = direction shoulder → hand.
const SKIN_A = ['#cf9a6e', '#b07a52', '#7e5234'];
const SKIN = '#b07a52', SLEEVE = '#1b1c24';
function armIn(ctx, hx, hy, ang, s, kind = 'grip', flip = false, warm = 0.5) {
  const c = Math.cos(ang), sn = Math.sin(ang), nx = -sn, ny = c;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,8,0.3)'; ctx.lineWidth = 74 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 1800 + 22, hy - sn * 1800 + 30); ctx.lineTo(hx + 22, hy + 30); ctx.stroke();
  ctx.strokeStyle = SKIN; ctx.lineWidth = 44 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 230 * s, hy - sn * 230 * s); ctx.lineTo(hx - c * 10 * s, hy - sn * 10 * s); ctx.stroke();
  ctx.strokeStyle = `rgba(255,190,130,${0.45 * warm + 0.1})`; ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 200 * s + nx * 15 * s, hy - sn * 200 * s + ny * 15 * s); ctx.lineTo(hx - c * 30 * s + nx * 15 * s, hy - sn * 30 * s + ny * 15 * s); ctx.stroke();
  ctx.strokeStyle = SLEEVE; ctx.lineWidth = 82 * s;
  ctx.beginPath(); ctx.moveTo(hx - c * 1800, hy - sn * 1800); ctx.lineTo(hx - c * 175 * s, hy - sn * 175 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,74,96,0.8)'; ctx.lineWidth = 5 * s; // cuff fold
  ctx.beginPath(); ctx.moveTo(hx - c * 178 * s - nx * 40 * s, hy - sn * 178 * s - ny * 40 * s); ctx.lineTo(hx - c * 178 * s + nx * 40 * s, hy - sn * 178 * s + ny * 40 * s); ctx.stroke();
  ctx.strokeStyle = `rgba(255,160,90,${0.4 * warm})`; ctx.lineWidth = 8 * s; // warm fire rim
  ctx.beginPath(); ctx.moveTo(hx - c * 1800 + nx * 36 * s, hy - sn * 1800 + ny * 36 * s); ctx.lineTo(hx - c * 185 * s + nx * 36 * s, hy - sn * 185 * s + ny * 36 * s); ctx.stroke();
  ctx.strokeStyle = 'rgba(166,200,255,0.35)'; ctx.lineWidth = 6 * s; // moon rim
  ctx.beginPath(); ctx.moveTo(hx - c * 1800 - nx * 37 * s, hy - sn * 1800 - ny * 37 * s); ctx.lineTo(hx - c * 185 * s - nx * 37 * s, hy - sn * 185 * s - ny * 37 * s); ctx.stroke();
  ctx.restore();
  NP.cHand(ctx, hx - c * 20 * s, hy - sn * 20 * s, s, ang, { kind, skin: SKIN_A, flip });
}
// a small kitchen knife: blade centred on (bx,by) lying along angle a, handle running to the hand (hx,hy)
function knife(ctx, bx, by, a, s, hx, hy) {
  ctx.save(); ctx.lineCap = 'round';
  const c = Math.cos(a), sn = Math.sin(a);
  const ex = bx - c * 70 * s, ey = by - sn * 70 * s; // blade heel
  ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 22 * s; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.strokeStyle = '#6a442a'; ctx.lineWidth = 15 * s; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
  L.at(ctx, bx, by, a, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-74, -9); ctx.lineTo(62, -10); ctx.quadraticCurveTo(84, -3, 70, 8); ctx.lineTo(-74, 9); ctx.closePath();
    const g = ctx.createLinearGradient(0, -10, 0, 9); g.addColorStop(0, '#f2f5fa'); g.addColorStop(0.5, '#a9b1bd'); g.addColorStop(1, '#5d6470');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-66, -7, 120, 2.5);
    ctx.fillStyle = 'rgba(255,170,90,0.5)'; ctx.fillRect(-60, 4, 110, 2);
  });
  ctx.restore();
}
// local fish point → screen (fish origin fx,fy, rotation a)
const fishPt = (fx, fy, a, lx, ly) => [fx + lx * Math.cos(a) - ly * Math.sin(a), fy + lx * Math.sin(a) + ly * Math.cos(a)];

// ============================================================================================ s9 ⑤ second round of straw
function s9(ctx, lt, p, T) {
  const t0 = 25.333, tThrow = 26.0, tLand = 26.22;
  const fk = T < tLand ? lerp(0.3, 0.05, ease.out(iv(t0, 25.95, T))) : lerp(0.08, 0.74, ease.out(iv(tLand, tLand + 0.75, T)));
  const z = lerp(1.36, 1.44, ease.inOut(p));
  cam(ctx, 560, 1235, z, 0, () => {
    CL.dikeScene(ctx, T, {
      view: 'wide', fire: fk * 0.9 + 0.12, moon: [770, 905], moonS: 0.85, fireflies: 14,
      mid: (c, r) => {
        const gx = r.fire[0], gy = r.fire[1], ps = 0.5 * (r.fireS || 1.11) / 1.11;
        const fresh = T >= tLand;
        // fire first: the fish and the straw hide its flat base
        CL.strawFire(c, gx, gy - (fresh ? 90 : 60) * ps, ps * 1.12, { t: T, k: fk, seed: 3, wind: 0.25, embers: false });
        CL.snakehead(c, gx, gy - 300 * ps, ps, { rot: PI / 2, state: 'charred', skewer: 140, skewerA: 140, t: T, rimFire: 0.9, smoke: 0.6 });
        CL.strawPile(c, gx, gy, ps, { t: T, k: 1, burn: lerp(0.78, 0.95, iv(t0, tThrow, T)), seed: 31 });
        if (fresh) { // fresh straw on top of the ashes
          const nb = lerp(0.02, 0.3, ease.out(iv(tLand, 28.0, T)));
          const kk = lerp(0.45, 0.62, ease.outBack(iv(tLand, tLand + 0.25, T)));
          CL.strawPile(c, gx, gy, ps * 1.03, { t: T, k: kk, burn: nb, seed: 57, live: true });
          CL.strawFire(c, gx, gy + 6 * ps, ps * 0.95, { t: T + 3.1, k: fk * 0.62, seed: 9, wind: 0.3, embers: true, w: 230 });
        }
        // Chú Ba walks in from the right carrying the armful, throws it on the beat
        const cs = 0.86, cy = gy + 18;
        const cx = T < tThrow ? lerp(gx + 600, gx + 300, ease.out(iv(t0, tThrow - 0.05, T))) : gx + 300 - 14 * ease.out(iv(tThrow, tThrow + 0.3, T));
        const fl = { x: gx, y: gy - 160, k: 0.4 + fk * 0.8, r: 760 };
        if (T < tThrow) CL.chuBa(c, cx, cy, cs, { pose: 'carryStraw', walk: true, flip: true, t: T, fireLight: fl, expr: 'smile' });
        else CL.chuBa(c, cx, cy, cs, { pose: T < 26.6 ? 'stand' : 'stand', flip: true, t: T, fireLight: fl, expr: T < 26.5 ? 'focus' : 'grin', lookX: 1 });
        if (T >= tThrow && T < tLand + 0.02) { // armful in flight
          const u = iv(tThrow, tLand, T), sx = cx - 44 * cs, sy = cy - 300 * cs, ex = gx + 10, ey = gy - 330 * ps;
          CL.strawArmful(c, lerp(sx, ex, u), lerp(sy, ey, u) - Math.sin(u * PI) * 110, 0.55 * cs, { t: T, seed: 7, rot: 0.04 - u * 0.5 });
        }
        if (T >= tLand) CL.whoosh(c, gx, gy - 60, ps * 1.6, iv(tLand, tLand + 0.6, T));
        CL.fireSmoke(c, gx, gy - 200 * ps, 0.9, { t: T, k: 0.55 + 0.4 * (T < tLand ? 1 - fk : fk), drift: 0.75, h: 1250, seed: 4, w: 150, alpha: 0.75 });
        CL.sparks(c, gx, gy - 120 * ps, 0.9, { t: T, n: Math.round(20 + fk * 70), rise: 760, w: 200, seed: 12, wind: 0.35 });
        if (T >= tLand) CL.sparks(c, gx, gy - 160 * ps, 1, { t: T - tLand, n: Math.round(70 * hitAt(T, tLand, 1.0)), rise: 900, spiral: 90, w: 240, seed: 19, size: 1.2 });
      },
    });
  });
  cap(ctx, T, t0 + 0.15, 28.0 - 0.1, 'Rơm tàn, thêm rơm lần hai', 'Burns down, second round of straw', 5);
}

// ============================================================================================ s10 ⑥ scrape the char
function nightBokehBg() {
  return cached('s10bg', W, H, (g) => {
    const lg = g.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, '#0d1430'); lg.addColorStop(0.45, '#1a1f3c'); lg.addColorStop(0.8, '#3a2526'); lg.addColorStop(1, '#5a2c1c');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const r = rng(77);
    g.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) { // blurred embers / moon-lit discs
      const warm = r() < 0.7, x = r() * W, y = warm ? 1250 + r() * 700 : 150 + r() * 700, rad = 30 + r() * 90;
      const gg = g.createRadialGradient(x, y, rad * 0.55, x, y, rad);
      gg.addColorStop(0, warm ? `rgba(255,${120 + r() * 60 | 0},50,${0.18 + r() * 0.2})` : `rgba(160,190,255,${0.08 + r() * 0.1})`);
      gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    const mg = g.createRadialGradient(880, 260, 10, 880, 260, 520); mg.addColorStop(0, 'rgba(220,225,255,0.35)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mg; g.fillRect(0, 0, W, H);
  });
}
function s10(ctx, lt, p, T) {
  const t0 = 28.0, BEATS = [28.0, 28.667, 29.333, 30.0], KS = [0.1, 0.33, 0.56, 0.78, 1.0], SD = 0.42;
  let i = 0; for (let j = 0; j < 4; j++) if (T >= BEATS[j]) i = j;
  const u = ease.inOut(iv(BEATS[i], BEATS[i] + SD, T));
  const sk = lerp(KS[i], KS[i + 1], u);
  const lift = T >= BEATS[i] + SD ? ease.out(iv(BEATS[i] + SD, BEATS[i] + SD + 0.16, T)) : 0;
  const z = lerp(1.04, 1.1, ease.inOut(p));
  cam(ctx, 540, 980, z, lerp(0.01, -0.005, p), () => {
    ctx.drawImage(nightBokehBg(), 0, 0);
    CL.emberGlow(ctx, 540, 1840, 2.4, { t: T, k: 0.9, w: 320, seed: 5 });
    CL.sparks(ctx, 540, 1800, 1.3, { t: T, n: 40, rise: 1300, w: 420, seed: 8, wind: 0.15, alpha: 0.8 });
    // the fish on its skewer, head up-right
    const s = 1.4, fx = 610, fy = 990, a = -0.3, FL = 520 * s;
    const bob = Math.sin(T * 2.1) * 4 + 6 * hitAt(T, BEATS[i], 0.2);
    CL.snakehead(ctx, fx, fy + bob, s, { rot: a, state: 'scraped', k: sk, skewer: 150, skewerA: 110, skewerB: 240, t: T, steam: 1, rim: 0.7, rimFire: 0.8, seed: 3 });
    // left hand holds the skewer just past the tail (sleeve exits bottom-left)
    const hp = fishPt(fx, fy + bob, a, -FL / 2 - 70, 0);
    armIn(ctx, hp[0], hp[1], -0.95, 1.2, 'grip', false, 0.7);
    // knife strokes head → tail along the back
    const lx = clamp(FL / 2 - sk * FL * 0.92, -FL * 0.42, FL * 0.42);
    const ly = -56 * s * (1 - 0.55 * Math.pow(lx / (FL / 2), 2)) - lift * 46;
    const bp = fishPt(fx, fy + bob, a, lx, ly);
    const nrm = [Math.sin(a), -Math.cos(a)]; // up from the fish's back
    const hk = [bp[0] + nrm[0] * 70 + Math.cos(a) * 55, bp[1] + nrm[1] * 70 + Math.sin(a) * 55];
    knife(ctx, bp[0], bp[1], a + 0.06, 1.15, hk[0], hk[1]);
    armIn(ctx, hk[0], hk[1], 2.25, 1.15, 'grip', true, 0.6);
    // char flakes fly off each stroke
    for (let j = 0; j <= i; j++) {
      const mid = fishPt(fx, fy, a, clamp(FL / 2 - lerp(KS[j], KS[j + 1], 0.6) * FL * 0.92, -FL * 0.42, FL * 0.42), -50 * s);
      L.flakes(ctx, T, BEATS[j] + 0.12, 40 + j, 16, mid[0], mid[1], { angle: a + PI * 0.9, spread: 1.6, speed: 520, g: 1400, size: 7, life: 1.0, colors: ['#15100c', '#2a1d14', '#3b2a1c', '#0c0a08'] });
    }
    // moon-lit steam off the white flesh
    const sp = fishPt(fx, fy, a, FL / 2 - sk * FL * 0.5, -70 * s);
    CL.steamWisps(ctx, sp[0], sp[1], 1.15, { t: T, k: 0.4 + sk * 0.6, w: 120 + sk * 200, h: 520, n: 6, seed: 6, warm: 0.25 });
    for (let j = 0; j < 4; j++) if (T >= BEATS[j]) { const q = fishPt(fx, fy, a, FL / 2 - KS[j + 1] * FL * 0.8, -20 * s + j * 6); L.sparkle(ctx, q[0], q[1], 26, 0.9 * hitAt(T, BEATS[j] + 0.32, 0.4)); }
  });
  cap(ctx, T, t0 + 0.15, 30.667 - 0.1, 'Cạo da cháy, thịt trắng ngần', 'Scrape off the char, snow-white inside', 6);
}

// ============================================================================================ s11 hero: low angle, moonlit steam
function s11(ctx, lt, p, T) {
  const z = lerp(1.04, 1.13, ease.inOut(p));
  cam(ctx, 520, lerp(1020, 990, p), z, lerp(-0.006, 0.004, p), () => {
    CL.dikeScene(ctx, T, {
      view: 'ground', fire: 0.5, fireAt: [540, 1600], fireflies: 22, moon: [700, 600], moonS: 1.55,
      mid: (c) => {
        CL.emberGlow(c, 540, 1610, 1.7, { t: T, k: 0.75, w: 250, seed: 7 });
        CL.sparks(c, 540, 1580, 0.9, { t: T, n: 36, rise: 900, w: 220, seed: 21, wind: 0.2, alpha: 0.85 });
        const s = 1.3, fx = 530, gY = 1640, skB = 150, cy = gY - (260 + skB) * s;
        CL.snakehead(c, fx, cy, s, { rot: -PI / 2, state: 'scraped', k: 1, skewer: 60, skewerA: 60, skewerB: skB, t: T, steam: 1, rim: 1, rimFire: 0.8, seed: 3 });
        // dirt where the stick is planted
        c.save(); c.fillStyle = '#1d1a24'; c.beginPath(); c.ellipse(fx, gY + 4, 46, 13, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,150,80,0.25)'; c.beginPath(); c.ellipse(fx + 16, gY, 28, 6, 0, 0, TAU); c.fill(); c.restore();
        CL.steamWisps(c, fx, cy - 120, 1.3, { t: T, k: 1, w: 200, h: 640, n: 7, seed: 11, warm: 0.15 });
        L.steam(c, T, 31, fx, cy - 80, 220, 600, 6, 0.16);
        const SP = [[-30, -180, 0], [26, -60, 0.8], [-18, 60, 1.6], [30, 150, 2.4], [-10, -250, 3.1]];
        for (const [dx, dy, ph] of SP) { const tw = Math.pow(Math.max(0, Math.sin(T * 2.4 + ph * 1.9)), 6); L.sparkle(c, fx + dx * s, cy + dy * s, 30, tw * 0.9); }
      },
    });
  });
}

// ============================================================================================ s12 ⑦ the lotus-leaf spread (top-down)
function topGroundBg() {
  return cached('s12bg', 1400, 2300, (g) => {
    g.fillStyle = '#25212a'; g.fillRect(0, 0, 1400, 2300);
    const r = rng(12);
    for (let i = 0; i < 220; i++) { // packed earth mottling
      const x = r() * 1400, y = r() * 2300, rad = 20 + r() * 90;
      g.fillStyle = r() < 0.5 ? `rgba(60,52,58,${0.15 + r() * 0.2})` : `rgba(14,12,20,${0.15 + r() * 0.2})`;
      g.beginPath(); g.ellipse(x, y, rad, rad * (0.5 + r() * 0.5), r() * PI, 0, TAU); g.fill();
    }
    CL.strawScraps(g, 0, 0, 1400, 2300, 5, { alpha: 0.5 });
    for (let i = 0; i < 40; i++) { // grass tufts at the dike edges
      const x = r() < 0.5 ? r() * 160 : 1240 + r() * 160, y = r() * 2300;
      g.strokeStyle = `rgba(${40 + r() * 30 | 0},${70 + r() * 40 | 0},${50 + r() * 20 | 0},0.8)`; g.lineWidth = 3;
      for (let j = 0; j < 7; j++) { const a = r() * TAU, l = 20 + r() * 40; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    }
  });
}
function s12(ctx, lt, p, T) {
  const t0 = 34.0, B = [34.0, 34.667, 35.333, 36.0], DK = [0.14, 0.28, 0.28, 0.16];
  let k = 0.16; for (let j = 0; j < 4; j++) k += DK[j] * ease.inOut(iv(B[j] - 0.12, B[j] + 0.26, T));
  const z = lerp(1.08, 1.0, ease.out(p)), rot = lerp(0.045, -0.012, ease.inOut(p));
  let A = null;
  cam(ctx, 540, 990, z, rot, () => {
    ctx.drawImage(topGroundBg(), -160, -190);
    // shadow under the tray
    ctx.save(); ctx.fillStyle = 'rgba(0,0,6,0.45)'; ctx.beginPath(); ctx.ellipse(560, 1010, 470, 470, 0, 0, TAU); ctx.fill(); ctx.restore();
    A = CL.lotusSpread(ctx, 540, 980, 1, { k, t: T, view: 'top', steam: 1 });
    const keys = [['herbs'], ['flowers', 'paper'], ['bun', 'slices'], ['salt']];
    for (let j = 0; j < 4; j++) for (const kk of keys[j]) { const q = A && A[kk]; if (q) L.sparkle(ctx, q[0] + 30, q[1] - 30, 40, hitAt(T, B[j] + 0.18, 0.4)); }
  });
  // firelight from the lower left, moon from the upper right
  L.glow(ctx, 60, 1800, 900, 'rgba(255,140,60,0.5)', 0.55);
  L.glow(ctx, 1000, 150, 800, 'rgba(150,180,255,0.35)', 0.5);
  CL.fireflies(ctx, T, { n: 10, x0: 0, y0: 400, w: W, h: 1300, seed: 33, near: 0.5 });
  cap(ctx, T, t0 + 0.15, 36.667 - 0.1, 'Lá sen, rau, bún, bánh tráng', 'Lotus leaf, herbs, noodles, rice paper', 7);
}

// ============================================================================================ s13 ⑧ chili salt + lime
function leafBg() {
  return cached('leafbg', 1300, 2200, (g) => {
    const cx = 650, cy = 2600;
    const rg = g.createRadialGradient(cx, cy, 200, cx, cy, 2700);
    rg.addColorStop(0, '#2f5a33'); rg.addColorStop(0.5, '#244a2c'); rg.addColorStop(1, '#13281a');
    g.fillStyle = rg; g.fillRect(0, 0, 1300, 2200);
    g.lineCap = 'round';
    for (let i = -14; i <= 14; i++) { // radiating veins
      const a = -PI / 2 + i * 0.075;
      g.strokeStyle = 'rgba(150,200,140,0.22)'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 3000, cy + Math.sin(a) * 3000); g.stroke();
      g.strokeStyle = 'rgba(8,20,10,0.25)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx + 5, cy); g.lineTo(cx + Math.cos(a) * 3000 + 5, cy + Math.sin(a) * 3000); g.stroke();
    }
    const r = rng(9);
    for (let i = 0; i < 26; i++) { // dew beads
      const x = r() * 1300, y = r() * 2200, rad = 5 + r() * 12;
      g.fillStyle = 'rgba(200,235,255,0.18)'; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - rad * 0.35, y - rad * 0.35, rad * 0.25, 0, TAU); g.fill();
    }
  });
}
function s13(ctx, lt, p, T) {
  const t0 = 36.667, SQ = [37.333, 38.0];
  const pulse = (tb) => T < tb - 0.14 ? 0 : T < tb ? ease.out(iv(tb - 0.14, tb, T)) : 1 - ease.inOut(iv(tb + 0.12, tb + 0.5, T));
  const sq = Math.max(pulse(SQ[0]), pulse(SQ[1]) * 1.05);
  const juice = clamp(0.5 * ease.out(iv(37.45, 37.9, T)) + 0.5 * ease.out(iv(38.12, 38.6, T)));
  const z = lerp(1.03, 1.1, ease.inOut(p));
  cam(ctx, 540, 1000, z, lerp(-0.01, 0.006, p), () => {
    ctx.drawImage(leafBg(), -110, -140);
    L.glow(ctx, 1000, 220, 700, 'rgba(160,190,255,0.35)', 0.5);
    L.glow(ctx, 80, 1700, 800, 'rgba(255,140,60,0.5)', 0.5);
    const dx = 540, dy = 1180, ds = 3.0;
    ctx.save(); ctx.fillStyle = 'rgba(0,8,0,0.45)'; ctx.beginPath(); ctx.ellipse(dx + 30, dy + 70, 300, 120, 0, 0, TAU); ctx.fill(); ctx.restore();
    const D = CL.chiliSalt(ctx, dx, dy, ds, { k: juice, t: T, view: '3q' });
    // the lime, squeezed by a hand coming in from the upper right
    const lx = 590, ly = 690 + 18 * sq, ls = 2.3;
    const Lm = CL.lime(ctx, lx, ly, ls, { squeeze: sq, half: true, rot: 0.12 });
    armIn(ctx, lx + 60, ly - 70, 2.25, 1.25, 'grip', true, 0.45);
    const drip = (Lm && Lm.drip) || [lx, ly + 60], to = (D && D.center) || [dx, dy];
    for (let j = 0; j < 2; j++) {
      const kk = iv(SQ[j] - 0.02, SQ[j] + 0.6, T);
      if (kk > 0 && kk < 1) CL.limeDrops(ctx, drip, [to[0] + (j ? 30 : -25), to[1]], kk, { n: 6, s: 1.8 });
      if (kk > 0) {
        CL.dropletsSlowmo(ctx, drip[0], drip[1], 1.2, { t: T, k: iv(SQ[j], SQ[j] + 0.8, T), n: 22, seed: 50 + j, warm: 0.2, drift: 0.6 });
        L.sparkle(ctx, drip[0] + 6, drip[1] + 30, 44, 0.95 * hitAt(T, SQ[j] + 0.05, 0.45));
        L.sparkle(ctx, to[0] + (j ? 40 : -30), to[1] - 10, 36, 0.9 * hitAt(T, SQ[j] + 0.38, 0.45));
      }
    }
  });
  CL.fireflies(ctx, T, { n: 8, x0: 0, y0: 450, w: W, h: 1200, seed: 44, near: 0.6 });
  cap(ctx, T, t0 + 0.15, 39.333 - 0.1, 'Muối ớt, vắt chanh', 'Chili salt, squeeze of lime', 8);
}

// ============================================================================================ s14 ⑨ roll it, dip it
function s14(ctx, lt, p, T) {
  const t0 = 39.333;
  const z = lerp(1.06, 1.02, ease.inOut(p));
  cam(ctx, 540, 1040, z, lerp(0.012, -0.004, p), () => {
    ctx.save(); ctx.translate(1080, 1900); ctx.rotate(PI); ctx.drawImage(leafBg(), -110, -140); ctx.restore();
    L.glow(ctx, 1000, 200, 700, 'rgba(160,190,255,0.3)', 0.5);
    L.glow(ctx, 60, 1750, 800, 'rgba(255,140,60,0.5)', 0.55);
    const dX = 800, dY = 1440, dS = 1.6;
    ctx.save(); ctx.fillStyle = 'rgba(0,8,0,0.4)'; ctx.beginPath(); ctx.ellipse(dX + 20, dY + 40, 170, 66, 0, 0, TAU); ctx.fill(); ctx.restore();
    CL.chiliSalt(ctx, dX, dY, dS, { k: 1, t: T, view: '3q' });
    const s = 1.6, cx0 = 520, cy0 = 980;
    if (T < 40.0) { // filling: herbs → fish flakes → bún
      const kf = ease.out(iv(t0 - 0.05, 39.95, T));
      ctx.save(); ctx.fillStyle = 'rgba(0,8,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx0 + 16, cy0 + 22, 282, 278, 0, 0, TAU); ctx.fill(); ctx.restore();
      CL.ricePaperRoll(ctx, cx0, cy0, s, { stage: 'filled', k: kf, t: T, steam: 1 });
      // a hand tucks the fish flakes in
      const hx = lerp(760, 600, ease.out(iv(t0, 39.75, T))), hy = lerp(1350, 1120, ease.out(iv(t0, 39.75, T)));
      armIn(ctx, hx, hy, -2.2, 1.15, 'pinch', true, 0.5);
    } else if (T < 41.0) { // rolling
      const kr = ease.inOut(iv(40.0, 40.95, T));
      ctx.save(); ctx.fillStyle = 'rgba(0,8,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx0 + 16, cy0 + 22 + kr * 40, lerp(282, 240, kr), lerp(278, 80, kr), 0, 0, TAU); ctx.fill(); ctx.restore();
      CL.ricePaperRoll(ctx, cx0, cy0, s, { stage: 'rolled', k: kr, t: T, steam: 1 });
      const yb = cy0 + lerp(170 * s, 40, ease.inOut(iv(40.0, 40.95, T)));
      const spread = kr < 0.5 ? 120 * s : lerp(120 * s, 150 * s, iv(0.5, 1, kr));
      armIn(ctx, cx0 - spread, yb + 30, -PI / 2 + 0.22, 1.1, 'flat', false, 0.5);
      armIn(ctx, cx0 + spread, yb + 30, -PI / 2 - 0.22, 1.1, 'flat', true, 0.5);
    } else { // lift → dip on the beat (41.333) → lift out
      const uIn = ease.inOut(iv(41.0, 41.333, T)), uOut = ease.inOut(iv(41.6, 41.95, T));
      const half = 140 * s, rotIn = 0.55;
      const dipC = [dX - Math.cos(rotIn) * half * 0.86, dY - 14 - Math.sin(rotIn) * half * 0.86];
      const rr = lerp(lerp(0, rotIn, uIn), 0.3, uOut);
      const cx = lerp(lerp(cx0, dipC[0], uIn), 560, uOut), cy = lerp(lerp(cy0, dipC[1], uIn), 1150, uOut) + 8 * hitAt(T, 41.333, 0.25);
      const dip = ease.out(iv(41.3, 41.55, T));
      CL.ricePaperRoll(ctx, cx, cy, s, { stage: 'rolled', k: 1, rot: rr, dip, t: T, steam: 1 });
      if (T > 41.3) L.flakes(ctx, T, 41.34, 71, 14, dX, dY - 20, { angle: -PI / 2, spread: 2.2, speed: 380, g: 1300, size: 5, life: 0.8, colors: ['#e0503a', '#f2d7b0', '#c23a28', '#fff1d8'] });
      const c = Math.cos(rr), sn = Math.sin(rr);
      armIn(ctx, cx - c * half * 0.72 + sn * 30, cy - sn * half * 0.72 + c * 30 - 10, -PI / 2 + 0.55, 1.1, 'pinch', false, 0.5);
      armIn(ctx, cx - c * 10 + sn * 52, cy - sn * 10 + c * 52, -PI / 2 - 0.2, 1.05, 'flat', true, 0.5);
    }
  });
  cap(ctx, T, t0 + 0.15, 42.0 - 0.1, 'Cuốn bánh tráng, chấm muối ớt', 'Wrap in rice paper, dip', 9);
}

// ============================================================================================ s15 the tourist wants his turn
function bank(ctx, t) { // earth dike edge on the right (Chú Ba stands on it)
  ctx.save();
  ctx.beginPath(); ctx.moveTo(1090, 1150); ctx.lineTo(860, 1172); ctx.quadraticCurveTo(780, 1182, 748, 1206);
  ctx.quadraticCurveTo(706, 1250, 690, 1300); ctx.lineTo(1090, 1300); ctx.closePath();
  const g = ctx.createLinearGradient(0, 1150, 0, 1300); g.addColorStop(0, '#4b4a63'); g.addColorStop(0.25, '#33324a'); g.addColorStop(1, '#1d1c2c');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(166,200,255,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(1090, 1150); ctx.lineTo(860, 1172); ctx.quadraticCurveTo(780, 1182, 748, 1206); ctx.stroke();
  // reflection
  ctx.globalAlpha = 0.35; ctx.fillStyle = '#141428';
  ctx.beginPath(); ctx.moveTo(690, 1300); ctx.lineTo(1090, 1300); ctx.lineTo(1090, 1390); ctx.quadraticCurveTo(820, 1380, 690, 1300); ctx.fill();
  ctx.globalAlpha = 1;
  const r = rng(4); ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) { // grass on the lip
    const x = 760 + r() * 330, y = 1150 + (1090 - x) / 230 * -22 + 26 + r() * 10, l = 16 + r() * 34, a = -PI / 2 + (r() - 0.5) * 0.9 + Math.sin(t * 1.3 + i) * 0.05;
    ctx.strokeStyle = r() < 0.5 ? '#2c4a3a' : '#3d5e45'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  ctx.restore();
}
function s15(ctx, lt, p, T) {
  const t0 = 42.0;
  const z = lerp(1.03, 1.07, ease.inOut(p));
  cam(ctx, 540, 960, z, 0, () => {
    CL.fieldWaterClose(ctx, T, {
      horizon: 820, camH: 480, moon: [300, 430], moonS: 1.0, rice: 0.7, zNear: 700, frontStalks: false, fireflies: 16,
      midZ: 1000,
      mid: (c) => {
        bank(c, T);
        // Chú Ba on the dike: grin → shrug
        CL.chuBa(c, 930, 1180, 0.8, { pose: T < 43.7 ? 'stand' : 'shrug', flip: true, t: T, expr: 'grin', lookX: 1 });
        // tourist knee-deep, left-centre
        const S = 1.0, tx = 400, ty = 1420, wl = ty - 118 * S;
        const pose = T < 43.05 ? 'rollShorts' : T < 43.75 ? 'stand' : 'rubHands';
        const expr = pose === 'stand' ? 'wow' : undefined;
        CL.touristNight(c, tx, ty, S, { pose, k: ease.inOut(iv(42.05, 43.0, T)), t: T, waterline: wl, reflect: 0.5, expr, lean: pose === 'stand' ? 0.12 : 0 });
        // the cá lóc lurking near his feet: back breaking the surface
        const hop = Math.sin(PI * iv(42.85, 43.35, T)), fxp = lerp(660, 590, ease.inOut(iv(42.0, 45.3, T))), fyp = wl + 30 - 56 * hop;
        c.save(); c.beginPath(); c.rect(0, wl + 4, W, 400); c.clip(); c.globalAlpha = 0.72;
        CL.snakehead(c, fxp, fyp, 0.6, { rot: 0.06 - 0.25 * hop, state: 'alive', wiggle: 0.35, eye: 'sly', t: T, flip: true, wet: 1 });
        c.restore();
        c.save(); c.beginPath(); c.rect(0, 0, W, wl + 4); c.clip();
        CL.snakehead(c, fxp, fyp, 0.6, { rot: 0.06 - 0.25 * hop, state: 'alive', wiggle: 0.35, eye: 'sly', t: T, flip: true, wet: 1 });
        c.restore();
        c.save(); c.fillStyle = 'rgba(40,70,110,0.22)'; c.fillRect(fxp - 180, wl + 4, 360, 70); c.restore();
        CL.ripplesNight(c, fxp, wl + 6, 1.1, { t: T, n: 3, r: 150, ryr: 0.25, period: 1.4, alpha: 0.8 });
        CL.bubbles(c, fxp - 70, wl + 6, 0.4, { t: T, n: 6, seed: 3, rings: 0 });
        // "!" pop when he spots it
        const ex = hitAt(T, 43.05, 0.7);
        if (T >= 43.05 && T < 43.8) {
          c.save(); c.translate(tx + 40, ty - 600); c.scale(0.7 + 0.3 * ease.outBack(iv(43.05, 43.25, T)), 0.7 + 0.3 * ease.outBack(iv(43.05, 43.25, T)));
          c.globalAlpha = Math.min(1, 1.5 - (T - 43.05) * 1.5 + 0.5);
          c.font = '110px BodySansBold'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.lineWidth = 10; c.strokeStyle = '#1a1020'; c.strokeText('!', 0, 0); c.fillStyle = '#ffd34d'; c.fillText('!', 0, 0);
          c.restore();
          L.sparkle(c, fxp, wl, 40, ex);
        }
      },
    });
  });
  X.line(ctx, T, 42.55, 45.25, 'Để tôi bắt một con!', "My turn! I'll catch one!", { y: 1475 });
}

module.exports = { s9, s10, s11, s12, s13, s14, s15 };
