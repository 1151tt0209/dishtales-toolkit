// Shots 11–20: veggies, the toss, the sauce, the pour, the orbit, garnish, serve, macro.
const L = require('./lib');
const P = require('./props');
const C = require('./cholon');
const F = require('./food');
const X = require('./text');
const CM = require('./common');
const { W, H, TAU, rng, clamp, lerp, inv, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, flakes } = L;
const { ell, layer } = P;
const { bump, lanternBokeh, wokFill, darkBg, ITEMS, LCOLS } = CM;

// ---------- S11 30–33 veggies rain into the wok (slow-mo, tilt down) ----------
function s11(ctx, lt, p, T) {
  lanternBokeh(ctx, T, 111, 0.4, 0, -p * 160);
  const cy = lerp(820, 1010, ease.inOut(p));
  const veg = clamp((lt - 0.5) / 2.2);
  const kinds = ['bok', 'carrot', 'mush'];
  const r = rng(112);
  const falling = [];
  for (let i = 0; i < 26; i++) {
    const t0 = r() * 2.2, x = 220 + r() * 640, depth = r(), rot0 = r() * TAU, spin = (r() - 0.5) * 3;
    const k = (lt - t0) / 1.6; // slow-mo fall
    if (k < 0 || k > 1) continue;
    falling.push({ kd: kinds[i % 3], x: x + Math.sin(k * 3 + i) * 30, y: lerp(-200, 1380, k * k * 0.6 + k * 0.4), depth, rot: rot0 + spin * k });
  }
  cam(ctx, 540, cy, 1.0, 0, () => {
    glow(ctx, 540, 1500, 700, 'rgba(255,110,30,0.7)', 0.7);
    C.fire(ctx, 540, 1640, 820, 240, T, 1, 111);
    F.bigWok(ctx, 540, 1430, 1.45, 0, { k: 0.32, handle: false, fill: wokFill({ sea: 1, meat: 1, veg, t: T, swirl: 0.7, s: 1.15 }) });
    C.fire(ctx, 540, 1650, 860, 100, T + 3, 0.7, 113);
    for (const f of falling.filter(f => f.depth < 0.75)) F.topping(ctx, f.kd, f.x, f.y + cy - 820, 1.3 + f.depth, f.rot);
  });
  // a few close foreground pieces, out of focus
  layer(ctx, 12, (ctx) => { for (const f of falling.filter(f => f.depth >= 0.75)) F.topping(ctx, f.kd, f.x * 1.2 - 100, f.y * 1.1, 3.2, f.rot); });
  // water droplets glint
  flakes(ctx, T, 30.2, 114, 30, 540, 300, { colors: ['rgba(220,240,255,0.9)', 'rgba(255,255,255,0.8)'], size: 4, speed: 300, g: 600, life: 3, slow: 0.4, angle: Math.PI / 2, spread: 2, stagger: 1.5 });
  steam(ctx, T, 115, 540, 1300, 800, 900, 10, 0.2);
  X.caption(ctx, T, 30.3, 32.8, 'Rau củ', 'Greens & veggies', { n: 6 });
}

// ---------- S12 33–36.5 the toss: speed ramp + wok hei ----------
const ramp = lt => (lt < 0.5 ? lt : lt < 2.0 ? 0.5 + (lt - 0.5) * 0.3 : 0.95 + (lt - 2.0));
function s12(ctx, lt, p, T) {
  const u = ramp(lt);
  darkBg(ctx, '#1c0806', '#050202');
  bokeh(ctx, u * 3, 121, 22, LCOLS, 0.35, 30, 110);
  const slow = lt > 0.5 && lt < 2.0 ? 1 : 0;
  const z = 1 + 0.18 * ease.inOut(clamp((lt - 0.4) / 0.4)) * (1 - ease.inOut(clamp((lt - 1.9) / 0.4)));
  // toss phases (in ramped time): launch 0.42, land 1.05; second toss 1.55 -> 1.95
  const toss = (u0, d) => { const k = (u - u0) / d; return k < 0 || k > 1 ? null : k; };
  const k1 = toss(0.42, 0.63), k2 = toss(1.55, 0.42);
  const lift = Math.max(bump(u, 0.3, 0.3), bump(u, 1.45, 0.26)) ;
  const wx = 470, wy = 1260 - lift * 70, wr = -lift * 0.22;
  const fireK = Math.max(bump(u, 0.45, 0.7), bump(u, 1.6, 0.45) * 0.8);
  cam(ctx, 540, 1080, z, lerp(0.03, -0.03, p), () => {
    glow(ctx, 540, 1400, 760, 'rgba(255,110,30,0.75)', 0.7 + fireK * 0.3);
    C.fire(ctx, 520, 1460, 820, 260, u, 1, 121);
    const flying = k1 !== null || k2 !== null;
    F.bigWok(ctx, wx, wy, 1.3, wr, { k: 0.28, handle: true, fill: wokFill({ sea: flying ? 0.35 : 1, meat: flying ? 0.35 : 1, veg: flying ? 0.35 : 1, t: u, swirl: 0.6 }) });
    // wok hei: ignited vapour over the rim
    if (fireK > 0) {
      C.fire(ctx, wx + 30, wy + 10, 700, 950 * fireK, u * 1.5, fireK, 122);
      C.fire(ctx, wx - 60, wy, 420, 600 * fireK, u * 1.5 + 2, fireK, 123);
    }
    // flying contents
    const kk = k1 !== null ? k1 : k2;
    if (kk !== null) {
      const amp = k1 !== null ? 620 : 420;
      ITEMS.forEach((it, i) => {
        const vx = Math.cos(it.a) * 260 + 60, h = amp * (0.6 + it.d * 0.6);
        const px = wx + Math.cos(it.a) * it.d * 240 + vx * kk * 0.5 - 120 * kk;
        const py = wy - 4 * h * kk * (1 - kk);
        F.topping(ctx, it.kd, px, py, 1.25, it.rot + kk * (3 + i % 4));
      });
    }
    C.fire(ctx, 520, 1470, 860, 110, u + 3, 0.8, 124);
  });
  C.embers(ctx, u, 125, 70, 540, 1500, 1000, 1500, 1);
  C.smoke(ctx, u, 126, 540, 900, 900, 900, 8, 0.2, '200,190,180');
  if (fireK > 0.2) flare(ctx, 560, 900, 1.6, fireK * 0.6);
  if (slow) { // subtle slow-mo streak overlay
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.12; ctx.fillStyle = 'rgba(255,200,120,1)';
    for (let i = 0; i < 14; i++) ctx.fillRect(0, (i * 151 + u * 400) % H, W, 2); ctx.restore();
  }
  X.caption(ctx, T, 33.3, 36.2, 'Tung chảo', 'Toss the wok', { n: 7 });
}

// sauce bottle (origin = mouth), tilted by rot
function bottle(ctx, x, y, s, rot, col = '#3a1a0c', lab = '#c8302a') {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(-50, 0, 50, 0); g.addColorStop(0, col); g.addColorStop(0.35, '#7a4a28'); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(14, 60); ctx.quadraticCurveTo(52, 90, 52, 140); ctx.lineTo(52, 330); ctx.quadraticCurveTo(52, 345, 36, 345); ctx.lineTo(-36, 345); ctx.quadraticCurveTo(-52, 345, -52, 330); ctx.lineTo(-52, 140); ctx.quadraticCurveTo(-52, 90, -14, 60); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lab; ctx.fillRect(-52, 180, 104, 100); ctx.fillStyle = 'rgba(255,230,160,0.8)'; ctx.fillRect(-40, 200, 80, 8); ctx.fillRect(-30, 250, 60, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-36, 120, 10, 200);
  });
}

// ---------- S13 36.5–39.5 broth, oyster, soy: three pours, sizzle ----------
function s13(ctx, lt, p, T) {
  lanternBokeh(ctx, T, 131, 0.35, p * 80, 0);
  const pours = [[0.15, 0.95, 'rgba(230,170,80,0.85)', 'ladle'], [1.05, 1.85, 'rgba(80,40,18,0.95)', 'oyster'], [1.95, 2.8, 'rgba(40,18,8,0.95)', 'soy']];
  const sauce = clamp(lt / 2.8);
  const e = ease.inOut(p);
  cam(ctx, lerp(560, 520, e), 1000, lerp(1.08, 1.16, e), 0, () => {
    glow(ctx, 540, 1350, 700, 'rgba(255,110,30,0.7)', 0.6);
    C.fire(ctx, 540, 1460, 800, 200, T, 0.9, 131);
    const wy = 1180;
    F.bigWok(ctx, 540, wy, 1.4, 0, { k: 0.52, handle: false, fill: wokFill({ sea: 1, meat: 1, veg: 1, sauce: 0.3 + sauce * 0.6, t: T, swirl: 0.9, s: 1.1 }) });
    for (const [a, b, col, kind] of pours) {
      const k = (lt - a) / (b - a);
      if (k < -0.1 || k > 1.1) continue;
      const tilt = ease.inOut(clamp(k * 4)) * (1 - ease.inOut(clamp((k - 0.85) * 4)));
      const sx = kind === 'ladle' ? 420 : kind === 'oyster' ? 700 : 600, sy = 640;
      if (kind === 'ladle') CM.ladleL(ctx, sx, sy - (1 - tilt) * 120, 1.1, -0.2 - tilt * 0.9, col);
      else bottle(ctx, sx, sy - (1 - tilt) * 160, 1.0, Math.PI * (0.6 + 0.2 * tilt) * (kind === 'soy' ? -1 : 1), kind === 'soy' ? '#1a0a04' : '#3a1a0c', kind === 'soy' ? '#d8a030' : '#c8302a');
      if (k > 0.12 && k < 0.92) {
        F.pourStream(ctx, sx + (kind === 'ladle' ? -30 : 0), sy + 30, 540 + (sx - 540) * 0.3, wy, kind === 'ladle' ? 26 : 16, col, T, 1);
        steam(ctx, T, 132 + Math.round(a * 10), 540, wy, 300, 500, 6, 0.4);
        flakes(ctx, T, 36.5 + a + 0.15, 133, 16, 540 + (sx - 540) * 0.3, wy, { colors: ['#fff2d0', '#ffd890'], size: 3.5, speed: 380, g: 900, life: 0.7, spread: 2.2 });
      }
    }
    C.fire(ctx, 540, 1470, 840, 90, T + 3, 0.7, 134);
  });
  steam(ctx, T, 135, 540, 1100, 700, 800, 10, 0.25);
  X.caption(ctx, T, 36.8, 39.2, 'Nêm sốt', 'Season the sauce', { n: 8 });
}

// ---------- S14 39.5–42.5 starch slurry, glossy macro ----------
function s14(ctx, lt, p, T) {
  darkBg(ctx, '#1a0905', '#070303');
  const gloss = ease.inOut(clamp((lt - 0.9) / 1.8));
  const z = lerp(2.0, 2.25, ease.inOut(p));
  cam(ctx, lerp(520, 560, p), 1040, z, lerp(0.05, -0.02, p), () => {
    F.bigWok(ctx, 540, 1060, 1.3, 0, { k: 0.7, handle: false, fill: wokFill({ sea: 1, meat: 1, veg: 1, sauce: 0.9, gloss, t: T, swirl: 0.5, s: 1.0 }) });
    // slurry bowl tilting in from the top-right
    const k = clamp(lt / 1.4), tilt = ease.inOut(clamp(k * 2.5)) * (1 - ease.inOut(clamp((lt - 1.5) / 0.4)));
    at(ctx, 690, 860 - (1 - tilt) * 80, 0.9 * tilt, 0.5, 0.5, () => {
      ell(ctx, 0, 0, 120, 40); ctx.fillStyle = '#f2eee6'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-120, 0); ctx.bezierCurveTo(-110, 110, 110, 110, 120, 0); ctx.fillStyle = '#dcd6cc'; ctx.fill();
      ell(ctx, 0, 0, 104, 30); ctx.fillStyle = 'rgba(245,240,228,0.95)'; ctx.fill();
      ctx.strokeStyle = '#3a5fa8'; ctx.lineWidth = 6; ell(ctx, 0, 0, 120, 40); ctx.stroke();
    });
    if (tilt > 0.4 && lt < 1.8) F.pourStream(ctx, 640, 880, 590, 1050, 9, 'rgba(250,248,240,0.9)', T, 1);
    // thickening bubbles
    F.oilBubbles(ctx, T * 0.6, 141, 540, 1060, 280, 180, 26, 0.5 + 0.4 * gloss);
  });
  // glossy highlight sweep
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.25 * gloss;
  const sx = lerp(-300, 1400, clamp((lt - 1.5) / 1.3));
  const g = ctx.createLinearGradient(sx - 200, 0, sx + 200, 0); g.addColorStop(0, 'rgba(255,230,180,0)'); g.addColorStop(0.5, 'rgba(255,230,180,1)'); g.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 700, W, 800); ctx.restore();
  steam(ctx, T, 142, 540, 1000, 700, 700, 10, 0.28);
  X.caption(ctx, T, 39.8, 42.2, 'Sệt sốt', 'Thicken it', { n: 9 });
}

// ---------- S15 42.5–46 backlit pour over the nest ----------
function s15(ctx, lt, p, T) {
  darkBg(ctx, '#2a0e06', '#060303');
  // strong backlight from the stove behind
  glow(ctx, 540, 640, 900, 'rgba(255,150,60,0.9)', 0.75);
  godRays(ctx, 540, 520, Math.PI / 2, 1.3, 1500, 14, 'rgba(255,190,110,0.5)', 0.3, T);
  bokeh(ctx, T, 151, 18, LCOLS, 0.4, 30, 110);
  const gv = ease.inOut(clamp((lt - 0.4) / 2.4));
  const z = lerp(1.0, 1.12, ease.inOut(p));
  cam(ctx, 540, 1080, z, 0, () => {
    F.dish(ctx, 540, 1220, 1.35, { k: 0.34, gravy: gv, tops: gv, garnish: 0, t: T });
    // rim light on the nest
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.55;
    ctx.strokeStyle = 'rgba(255,200,120,1)'; ctx.lineWidth = 8; ctx.filter = 'blur(6px)';
    ctx.beginPath(); ctx.ellipse(540, 1150, 290, 90, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke(); ctx.restore();
    const tilt = ease.inOut(clamp(lt / 0.5)) * (1 - ease.inOut(clamp((lt - 3.0) / 0.4)));
    CM.ladleL(ctx, 400, 760 - (1 - tilt) * 150, 1.3, -0.3 - tilt * 0.9, 'rgba(150,70,20,0.95)');
    if (tilt > 0.6) {
      F.pourStream(ctx, 370, 790, 540, 1120, 30, 'rgba(160,80,24,0.95)', T, 1);
      // tumbling toppings in the stream
      for (let i = 0; i < 6; i++) { const ph = (T * 1.2 + i / 6) % 1; F.topping(ctx, ['shrimp', 'bok', 'carrot', 'squid', 'pork', 'mush'][i], lerp(380, 540, ph), lerp(800, 1110, ph * ph), 1.1, ph * 5 + i); }
    }
  });
  // glowing backlit steam
  steam(ctx, T, 152, 540, 1100, 600, 900, 14, 0.42);
  flare(ctx, 540, 600, 1.6, 0.45);
  X.caption(ctx, T, 42.8, 45.7, 'Rưới lên mì', 'Pour over the nest', { n: 10 });
}

// ---------- S16 46–49 180° orbit around the dish (no text) ----------
function s16(ctx, lt, p, T) {
  const e = ease.inOut(p);
  darkBg(ctx, '#1e0a07', '#060303');
  ctx.save(); ctx.translate(lerp(380, -380, e), 0);
  bokeh(ctx, T, 161, 30, LCOLS, 0.5, 40, 150); ctx.restore();
  ctx.save(); ctx.translate(lerp(-200, 200, e), 0); bokeh(ctx, T, 162, 16, LCOLS, 0.3, 20, 60); ctx.restore();
  // table surface
  ctx.save(); const g = ctx.createLinearGradient(0, 1050, 0, H); g.addColorStop(0, '#6a6e72'); g.addColorStop(0.2, '#9a9ea2'); g.addColorStop(1, '#2a2c30');
  ctx.fillStyle = g; ctx.fillRect(0, 1050, W, H - 1050);
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.4; const hx = lerp(900, 180, e);
  const hg = ctx.createRadialGradient(hx, 1250, 10, hx, 1250, 500); hg.addColorStop(0, 'rgba(255,190,120,1)'); hg.addColorStop(1, 'rgba(255,190,120,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 1050, W, H - 1050);
  ctx.restore();
  const k = 0.42 + 0.06 * Math.sin(e * Math.PI);
  F.dish(ctx, 540, 1200, 1.55, { k, gravy: 1, tops: 1, garnish: 0, t: T, rot: e * Math.PI });
  steam(ctx, T, 163, 540, 1050, 600, 800, 12, 0.3);
  flare(ctx, lerp(950, 130, e), 520, 1.4, 0.5);
  dust(ctx, T, 164, 30, 0, 300, W, 1000, '255,200,140', 2.5, 0.5);
}

// ---------- S17 49–52 top-down garnish: pepper, cilantro, chili ----------
function s17(ctx, lt, p, T) {
  // dark wood table top
  ctx.fillStyle = '#2a170d'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 4; for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.moveTo(0, i * 90 + 20); ctx.bezierCurveTo(400, i * 90, 700, i * 90 + 40, W, i * 90 + 18); ctx.stroke(); }
  glow(ctx, 300, 300, 700, 'rgba(255,160,80,0.6)', 0.4);
  const rot = lerp(0.15, -0.1, p), z = lerp(1.0, 1.1, ease.inOut(p));
  const gn = ease.inOut(clamp((lt - 0.3) / 2.3));
  cam(ctx, 540, 900, z, rot, () => {
    F.dish(ctx, 540, 900, 1.45, { k: 1, gravy: 1, tops: 1, garnish: gn, t: T });
    // falling garnish (big & blurred → small as it lands)
    const r = rng(171);
    for (let i = 0; i < 18; i++) {
      const t0 = 0.2 + r() * 2.2, k = (lt - t0) / 0.6, px = 540 + (r() - 0.5) * 420, py = 900 + (r() - 0.5) * 420, rr = r() * TAU;
      if (k < 0 || k > 1) continue;
      const sc = lerp(4, 1.3, ease.in(k));
      ctx.save(); ctx.globalAlpha = clamp(k * 3);
      if (i % 3 === 0) F.chiliRing(ctx, px, py, sc, rr + k * 3); else F.cilantro(ctx, px, py, sc, rr + k * 2);
      ctx.restore();
    }
  });
  // pepper grains from the top
  flakes(ctx, T, 49.4, 172, 60, 540, -40, { colors: ['#1a1210', '#2a1e18', '#0e0a08'], size: 3, speed: 160, g: 900, life: 2.2, angle: Math.PI / 2, spread: 1.2, stagger: 1.4 });
  steam(ctx, T, 173, 540, 1100, 600, 800, 10, 0.25);
  X.caption(ctx, T, 49.3, 51.8, 'Tiêu, ngò', 'Pepper & cilantro', { n: 11 });
}

// ---------- S18 52–55 chili soy + pickles, rack focus ----------
function s18(ctx, lt, p, T) {
  lanternBokeh(ctx, T, 181, 0.45, -p * 60, 0);
  ctx.fillStyle = '#5a5e62'; ctx.fillRect(0, 1180, W, H - 1180);
  const rf = ease.inOut(clamp((lt - 1.6) / 0.7)); // 0 = focus on soy (front), 1 = on pickles (back)
  layer(ctx, 2 + (1 - rf) * 14, (ctx) => {
    F.pickles(ctx, 780, 1100, 2.0, 0.42);
    F.teaCup(ctx, 990, 1150, 1.2, T, 0.4);
  });
  layer(ctx, rf * 12, (ctx) => {
    F.soyDish(ctx, 380, 1460, 3.1, 0.42, 1, { seed: 21 });
    // chili ring dropping + splash at lt 0.7
    const k = clamp((lt - 0.2) / 0.5);
    if (k < 1) F.chiliRing(ctx, 380, lerp(600, 1430, k * k), 3.2, k * 4);
    F.crumbs(ctx, T, 52.7, 183, 26, 380, 1430, { colors: ['#4a1a08', '#6a2c10', '#2a0e04'], size: 7, speed: 500, g: 1500, life: 0.9, spread: 1.8 });
    if (lt > 0.7 && lt < 1.4) { const q = (lt - 0.7) / 0.7; ctx.save(); ctx.strokeStyle = `rgba(255,220,180,${0.6 * (1 - q)})`; ctx.lineWidth = 4; ell(ctx, 380, 1440, 50 + q * 200, (50 + q * 200) * 0.42); ctx.stroke(); ctx.restore(); }
  });
  X.caption(ctx, T, 52.3, 54.8, 'Xì dầu ớt', 'Chili soy sauce', { n: 12, y: 360 });
}

// ---------- S19 55–58 top-down steel table, items slide in ----------
function s19(ctx, lt, p, T) {
  // brushed steel table
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#9aa0a6'); g.addColorStop(0.5, '#cfd2d4'); g.addColorStop(1, '#7a8086');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rng(191); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 160; i++) { const y = r() * H; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + (r() - 0.5) * 6); ctx.stroke(); }
  glow(ctx, 760, 400, 700, 'rgba(255,170,90,0.7)', 0.45, 'soft-light');
  const z = lerp(1.12, 1.0, ease.out(p));
  cam(ctx, 540, 900, z, lerp(-0.06, 0, ease.out(p)), () => {
    const slide = (t0, fx, fy, tx, ty, fn) => { const k = ease.outBack(clamp((lt - t0) / 0.55)); if (k <= 0) return; fn(lerp(fx, tx, k), lerp(fy, ty, k)); };
    slide(0.0, 540, -500, 540, 900, (x, y) => F.dish(ctx, x, y, 1.1, { k: 1, gravy: 1, tops: 1, garnish: 1, t: T }));
    slide(0.5, -300, 380, 220, 420, (x, y) => F.soyDish(ctx, x, y, 1.0, 1, 1));
    slide(0.8, 1400, 380, 860, 400, (x, y) => F.pickles(ctx, x, y, 1.0, 1));
    slide(1.1, 1400, 1450, 860, 1420, (x, y) => F.teaCup(ctx, x, y, 1.1, T, 1));
    slide(1.35, -500, 1500, 120, 1460, (x, y) => F.chopsticks(ctx, x, y, 1.1, -0.35, 0.03));
  });
  steam(ctx, T, 192, 540, 1000, 500, 600, 10, 0.28);
  X.caption(ctx, T, 55.4, 57.8, 'Lên bàn', 'Serve', { n: 13, y: 1290 });
}

// ---------- S20 58–60.5 macro: gravy seeps into the crispy gaps ----------
function s20(ctx, lt, p, T) {
  darkBg(ctx, '#1a0905', '#070303');
  const z = lerp(1.0, 1.15, ease.inOut(p));
  cam(ctx, 540, 960, z, lerp(0, 0.06, p), () => {
    F.nest(ctx, 540, 1180, 3.1, 0.62, 1, { h: 80 });
    const gr = ease.out(clamp(lt / 2.2));
    F.gravyBlob(ctx, 560, 1000, 120 + gr * 520, (120 + gr * 520) * 0.6, T, 0.95, 13);
    // glossy rivulets creeping into gaps
    const r = rng(201);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 40; i++) { const a = r() * TAU, d = r() * (140 + gr * 520); ctx.globalAlpha = 0.5 * Math.abs(Math.sin(T * 3 + i)); ctx.fillStyle = 'rgba(255,220,160,1)'; ell(ctx, 560 + Math.cos(a) * d, 1000 + Math.sin(a) * d * 0.6, 10 + r() * 14, 3); ctx.fill(); }
    ctx.restore();
  });
  // shallow depth of field: soft top & bottom
  steam(ctx, T, 202, 540, 1000, 800, 900, 14, 0.3);
  dust(ctx, T, 203, 30, 0, 300, W, 1200, '255,220,170', 2.5, 0.5);
  X.caption(ctx, T, 58.2, 60.3, 'Giòn rụm dưới lớp sốt', 'Crunch under the gravy');
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, bottle };
