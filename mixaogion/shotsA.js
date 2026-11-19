// Shots 1–10: Cholon night, the shop, the fire, noodles, frying, meats.
const L = require('./lib');
const P = require('./props');
const C = require('./cholon');
const F = require('./food');
const PE = require('./people');
const X = require('./text');
const CM = require('./common');
const { W, H, TAU, rng, clamp, lerp, inv, ease, cam, at, glow, flare, dust, steam, flakes } = L;
const { ell, layer } = P;
const { bump, lanternBokeh, streetWorld, shopStation, wokFill, darkBg } = CM;

// ---------- S1 0–3.5 flycam crane down over roofs & lanterns ----------
function s1(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const cy = lerp(-420, 760, e), z = lerp(1.0, 0.82, e);
  cam(ctx, 540, cy, z, lerp(-0.03, 0, e), () => {
    CM.sky(ctx, T);
    C.drawStreet(ctx);
    C.lanternString(ctx, -320, 360, 1400, 400, 40, 9, 0.62, T, 1, { haloA: 0.6 });
    C.lanternString(ctx, -320, 140, 1400, 120, 30, 7, 0.5, T, 4, { haloA: 0.5 });
    glow(ctx, 540, 960, 520, 'rgba(255,130,50,0.55)', 0.8);
    shopStation(ctx, T, {});
  });
  // foreground lanterns (parallax, out of focus) sweep up past the lens
  layer(ctx, 10, (ctx) => {
    const fy = lerp(1500, -700, e);
    C.lantern(ctx, 110, fy, 2.6, Math.sin(T * 1.3) * 0.08, 1, { haloA: 0.9 });
    C.lantern(ctx, 990, fy + 520, 2.2, Math.sin(T * 1.1 + 1) * 0.08, 1, { haloA: 0.9 });
  });
  dust(ctx, T, 11, 40, 0, 0, W, H, '255,200,140', 2.5, 0.5);
  X.label(ctx, T, 0.5, 3.3, 'CHỢ LỚN · 7:00 TỐI', 'Cholon, Saigon · 7:00 PM', 300);
}

// ---------- S2 3.5–6.5 wide shop front, burner flame lights the facade ----------
function s2(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const pulse = bump(lt, 1.2, 0.9);
  const z = lerp(0.74, 0.86, e);
  cam(ctx, lerp(560, 540, e), lerp(860, 900, e), z, 0, () => {
    streetWorld(ctx, T, { fire: 1 + pulse * 1.4, chef: { toss: pulse * 0.6 } });
    glow(ctx, 540, 820, 900, 'rgba(255,120,40,0.6)', 0.25 + pulse * 0.5);
  });
  if (pulse > 0.2) flare(ctx, 540, 960, 1 + pulse, pulse * 0.7);
  dust(ctx, T, 21, 30, 0, 400, W, 1200, '255,190,120', 2.5, 0.5);
}

// ---------- S3 6.5–9.5 tourist walks past; flame reflected in sunglasses ----------
function s3(ctx, lt, p, T) {
  if (lt < 1.4) {
    const k = lt / 1.4;
    const tx = lerp(1150, 760, k);
    cam(ctx, tx - 60, 1180, 1.25, 0, () => {
      streetWorld(ctx, T, { fire: 1.2 });
      PE.tourist(ctx, tx, 1460, 1.9, { walk: T * 7, look: -0.05 });
    });
    if (k > 0.85) { ctx.fillStyle = `rgba(30,12,6,${(k - 0.85) / 0.15 * 0.6})`; ctx.fillRect(0, 0, W, H); }
    return;
  }
  const k = (lt - 1.4) / 1.6;
  lanternBokeh(ctx, T, 31, 0.55, -k * 60, 0);
  glow(ctx, 260, 1100, 700, 'rgba(255,110,30,0.6)', 0.6 + 0.2 * Math.sin(T * 9));
  const fk = 0.7 + 0.3 * Math.sin(T * 11) * Math.sin(T * 7);
  const glassesFn = (c, lx, ly) => {
    C.fire(c, lx - 10, ly + 26, 70, 60 * fk, T, 1, 5);
  };
  const z = lerp(1.18, 1.3, ease.out(k));
  PE.face(ctx, 560, 900, z, { turn: lerp(-0.25, -0.45, k), lookX: -0.6, lookY: 0.1, mouth: 'o', mOpen: 0.35 + 0.2 * k, brow: 0.6, t: T, glassesFn });
  glow(ctx, 120, 900, 520, 'rgba(255,120,40,0.7)', 0.35 * fk, 'screen');
  flare(ctx, 220, 760, 0.9, 0.35 * fk);
}

// ---------- S4 9.5–12 close: A Phát swirls the wok (low angle arc) ----------
function s4(ctx, lt, p, T) {
  const e = ease.inOut(p);
  cam(ctx, lerp(500, 580, e), lerp(930, 900, e), lerp(2.15, 2.35, e), lerp(-0.07, 0.05, e), () => {
    streetWorld(ctx, T, { fire: 1.5, chef: { mood: 'focus', swirl: 1.4 }, wok: { sea: 1, meat: 1, veg: 1, sauce: 0.6, t: T, swirl: 2.2 } });
  });
  steam(ctx, T, 41, 520, 900, 600, 700, 10, 0.25);
  C.embers(ctx, T, 42, 40, 540, 1300, 900, 1200, 1);
  flare(ctx, 300, 1180, 1.2, 0.35 + 0.15 * Math.sin(T * 8));
}

// ---------- S5 12–15 ECU flame burst (flash 12.0) + title ----------
function s5(ctx, lt, p, T) {
  darkBg(ctx, '#1a0603', '#050202');
  const burst = Math.max(ease.out(clamp(lt / 0.25)) * (1 - inv(0.6, 2.6, lt) * 0.55), 0.35);
  const sh = (1 - clamp(lt / 0.6)) * 14;
  ctx.save(); ctx.translate(Math.sin(T * 63) * sh, Math.cos(T * 51) * sh);
  const z = lerp(1.0, 1.12, p);
  at(ctx, 540, 1700, 0, z, z, () => {
    C.fire(ctx, 0, 0, 1200, 1600 * burst, T, 1, 51);
    C.fire(ctx, -80, 20, 800, 1100 * burst, T + 2, 0.9, 52);
    F.bigWok(ctx, 0, 40, 2.2, -0.05, { k: 0.18, handle: true, hot: 1.4 });
    C.fire(ctx, 40, 10, 900, 500 * burst, T + 5, 0.8, 53);
  });
  ctx.restore();
  C.embers(ctx, T, 55, 90, 540, 1500, 1100, 1700, 1);
  C.smoke(ctx, T, 56, 540, 700, 900, 900, 8, 0.15);
  flare(ctx, 560, 1000, 2.2, 0.55 * burst);
  X.title(ctx, T, 12.25, 14.8, 470);
}

// ---------- S6 15–18 egg-noodle bundle macro ----------
function s6(ctx, lt, p, T) {
  lanternBokeh(ctx, T, 61, 0.45, p * 40, 0);
  ctx.save(); const g = ctx.createLinearGradient(0, 1020, 0, H); g.addColorStop(0, '#5a3418'); g.addColorStop(1, '#24120a'); ctx.fillStyle = g; ctx.fillRect(0, 1020, W, H - 1020);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(0, 1060 + i * 90); ctx.bezierCurveTo(300, 1040 + i * 92, 700, 1080 + i * 88, W, 1060 + i * 90); ctx.stroke(); }
  ctx.restore();
  glow(ctx, 540, 1000, 600, 'rgba(255,170,90,0.6)', 0.45);
  const z = lerp(2.3, 2.75, ease.inOut(p));
  ctx.save(); ctx.filter = 'blur(16px)'; ell(ctx, 540, 1085, 300 * z / 2.3, 60); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.restore();
  F.noodleBundle(ctx, 540, 960, z, T, 0.15 + 0.1 * Math.sin(T), 5);
  glow(ctx, 760, 860, 260, 'rgba(255,200,120,0.6)', 0.4);
  dust(ctx, T, 62, 70, 160, 500, 760, 800, '255,248,230', 3, 0.7);
  X.caption(ctx, T, 15.3, 17.8, 'Mì trứng', 'Egg noodles', { n: 1 });
}

// ---------- S7 18–21 slow-mo deep-fry puff ----------
function s7(ctx, lt, p, T) {
  darkBg(ctx, '#1e0a05', '#060303');
  glow(ctx, 540, 1250, 800, 'rgba(255,120,40,0.6)', 0.6);
  const e = ease.inOut(p);
  const fry = ease.inOut(clamp(lt / 2.6)), puff = lerp(26, 90, fry);
  cam(ctx, lerp(500, 580, e), 1080, lerp(1.0, 1.08, e), 0, () => {
    C.fire(ctx, 540, 1380, 700, 260, T, 1, 71);
    F.bigWok(ctx, 540, 1150, 1.65, 0, { k: 0.2, handle: false, fill: wokFill({ oil: 1, t: T }) });
    F.nest(ctx, 540, 1158, 1.1, 0.2, fry, { h: puff });
    F.oilBubbles(ctx, T * 0.5, 72, 540, 1150, 360, 60, 60, 1);
    C.fire(ctx, 540, 1390, 760, 120, T + 4, 0.7, 73);
  });
  flakes(ctx, T, 18.2, 74, 26, 540, 1100, { colors: ['#ffe9a0', '#ffd060', '#fff6d0'], size: 4, speed: 500, g: 500, life: 2.4, slow: 0.35, stagger: 2.2 });
  steam(ctx, T, 75, 540, 1050, 600, 700, 10, 0.25);
  X.caption(ctx, T, 18.3, 20.8, 'Chiên giòn', 'Deep-fry', { n: 2 });
}

// spider strainer (wire mesh basket + bamboo handle), origin = basket centre
function spider(ctx, x, y, s, rot, k = 0.3) {
  at(ctx, x, y, rot, s, s, () => {
    const hg = ctx.createLinearGradient(0, -10, 0, 10); hg.addColorStop(0, '#d2a868'); hg.addColorStop(1, '#7a5228');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(150, -12, 560, 24, 12); ctx.fill();
    ctx.strokeStyle = '#a8a49c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(205, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,196,188,0.85)'; ctx.lineWidth = 2;
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * 24, -150 * k); ctx.quadraticCurveTo(i * 24, 60 * k + 30, i * 24, 150 * k); ctx.stroke(); }
    ctx.lineWidth = 5; ctx.strokeStyle = '#c8c4bc'; ell(ctx, 0, 0, 155, 155 * k); ctx.stroke();
  });
}

// ---------- S8 21–24 lift the nest onto the plate ----------
function s8(ctx, lt, p, T) {
  lanternBokeh(ctx, T, 81, 0.4, 0, -p * 80);
  const land = 1.6;
  const m = ease.inOut(clamp(lt / land));
  const cy = lerp(780, 980, ease.inOut(p));
  cam(ctx, 540, cy, 1.0, 0, () => {
    F.plate(ctx, 540, 1260, 1.25, 0.38);
    const nx = lerp(620, 540, m), ny = lerp(520, 1240, m) - Math.sin(m * Math.PI) * 60;
    const squash = lt > land ? 1 - 0.08 * Math.sin((lt - land) * 18) * Math.exp(-(lt - land) * 5) : 1;
    at(ctx, nx, ny, 0, 1, squash, () => F.nest(ctx, 0, 0, 1.05, 0.36, 1, { h: 90 }));
    if (lt < land + 0.15) spider(ctx, nx, ny + 12, 1.15, -0.25 + m * 0.1, 0.33);
    else spider(ctx, nx + (lt - land) * 900, ny + 40 - (lt - land) * 400, 1.15, -0.2, 0.33);
    if (lt < land) for (let i = 0; i < 6; i++) { const ph = (T * 2 + i * 0.37) % 1; ctx.fillStyle = `rgba(255,210,110,${1 - ph})`; ell(ctx, nx - 150 + i * 60, ny + 70 + ph * 260, 4, 8); ctx.fill(); }
    F.crumbs(ctx, T, 21 + land, 82, 40, 540, 1200, { speed: 500, g: 1300, spread: 2.6 });
  });
  steam(ctx, T, 83, 540, 1000, 500, 600, 8, 0.22);
  glow(ctx, 900, 400, 400, 'rgba(255,170,90,0.6)', 0.35);
  X.caption(ctx, T, 21.3, 23.8, 'Tổ mì giòn', 'The crispy nest', { n: 3 });
}

// ---------- S9 24–27 top-down: shrimp & squid hit the wok ----------
function s9(ctx, lt, p, T) {
  darkBg(ctx, '#140806', '#0a0404');
  const rot = lerp(-0.25, 0.2, p);
  cam(ctx, 540, 880, lerp(1.05, 1.15, p), rot, () => {
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU + T * 0.4, fl = 0.6 + 0.4 * Math.sin(T * 13 + i * 2.1);
      glow(ctx, 540 + Math.cos(a) * 470, 880 + Math.sin(a) * 470, 160 * fl, 'rgba(255,110,30,0.9)', 0.7);
    }
    const sea = clamp(lt / 2.4);
    F.bigWok(ctx, 540, 880, 1.45, 0, { k: 1, handle: false, fill: wokFill({ sea, t: T, swirl: 0.6, s: 1.2, oil: 0.4 }) });
    const r = rng(91);
    for (let i = 0; i < 9; i++) {
      const t0 = 0.1 + i * 0.25, k = (lt - t0) / 0.5;
      const kd = i % 3 === 2 ? 'squid' : 'shrimp', px = 540 + (r() - 0.5) * 500, py = 880 + (r() - 0.5) * 420, rr = r() * TAU;
      if (k < 0 || k > 1) continue;
      const sc = lerp(3.2, 1.2, ease.in(k));
      ctx.save(); ctx.globalAlpha = clamp(k * 4); F.topping(ctx, kd, lerp(px * 1.3 - 160, px, k), lerp(py * 1.3 - 260, py, k), sc, rr + k * 2); ctx.restore();
      if (k > 0.92) glow(ctx, px, py, 120, 'rgba(255,240,200,0.8)', 0.6);
    }
  });
  steam(ctx, T, 92, 540, 1100, 800, 900, 12, 0.22);
  X.caption(ctx, T, 24.3, 26.8, 'Tôm, mực', 'Shrimp & squid', { n: 4 });
}

// ---------- S10 27–30 low angle: pork, liver, gizzard slide in ----------
function s10(ctx, lt, p, T) {
  lanternBokeh(ctx, T, 101, 0.45, -p * 120, 0);
  const e = ease.inOut(p);
  cam(ctx, lerp(620, 470, e), 1060, 1.05, 0, () => {
    glow(ctx, 540, 1250, 700, 'rgba(255,110,30,0.7)', 0.7);
    C.fire(ctx, 540, 1400, 760, 260, T, 1.1, 101);
    const meat = clamp((lt - 0.4) / 2.0);
    F.bigWok(ctx, 540, 1200, 1.35, 0.04, { k: 0.3, handle: true, fill: wokFill({ sea: 1, meat, t: T, swirl: 0.8, s: 1.1 }) });
    const tip = ease.inOut(clamp(lt / 0.8));
    at(ctx, 900, 700, lerp(0, 0.55, tip), 1, 1, () => {
      F.plate(ctx, 0, 0, 0.55, 0.42);
      if (lt < 1.4) for (let i = 0; i < 8; i++) F.topping(ctx, ['pork', 'liver', 'gizzard'][i % 3], -110 + (i % 4) * 70, -30 + Math.floor(i / 4) * 40, 1.2, i);
    });
    const r = rng(104);
    for (let i = 0; i < 12; i++) {
      const t0 = 0.5 + i * 0.12, k = (lt - t0) / 0.7;
      const tx = 400 + r() * 300, ty = 1180 + r() * 50;
      if (k < 0 || k > 1) continue;
      const ke = ease.in(k);
      const px = lerp(840, tx, ke), py = lerp(700, ty, ke) - Math.sin(k * Math.PI) * 120;
      F.topping(ctx, ['pork', 'liver', 'gizzard'][i % 3], px, py, 1.4, k * 4 + i);
    }
    C.fire(ctx, 540, 1410, 800, 110, T + 3, 0.8, 102);
  });
  C.embers(ctx, T, 103, 30, 540, 1500, 900, 900, 1);
  C.smoke(ctx, T, 105, 540, 1000, 800, 800, 8, 0.18, '200,190,180');
  X.caption(ctx, T, 27.3, 29.8, 'Thịt, gan', 'Pork & liver', { n: 5 });
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, spider };
