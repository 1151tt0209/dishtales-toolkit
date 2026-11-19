// Bún đậu mắm tôm – shots 1–10: Hanoi noon + first prep steps.
const L = require('./lib');
const P = require('./props');
const R = require('./river');
const Wd = require('./world');
const Pp = require('./people');
const F = require('./food');
const Tx = require('./text');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, motionBlurX } = L;
const { ell } = P;

const bump = (t, t0, d) => (t < t0 || t > t0 + d ? 0 : Math.sin(Math.PI * (t - t0) / d));
const TOUR_SKIN = ['#f2c3a0', '#c97c5e'];
const HANG_SKIN = ['#d9a07a', '#9a6240'];
const HANG_SHIRT = '#7a5a3a';
function darkBg(ctx, c0, c1) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function warmBokeh(ctx, T, shift = 0, seed = 77) {
  darkBg(ctx, '#5a4026', '#1c1208');
  ctx.save(); ctx.translate(shift, 0);
  bokeh(ctx, T, seed, 22, ['rgba(255,210,130,0.9)', 'rgba(255,235,180,0.8)', 'rgba(220,120,60,0.6)'], 0.32, 30, 120);
  ctx.restore();
}
// falling bàng leaves (red/orange), screen space
function bangLeaves(ctx, T, seed, n, a = 1, size = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sp = 60 + r() * 90, x0 = r() * 1300 - 100, ph = r() * 30, sc = (0.6 + r() * 0.9) * size;
    const y = ((T + ph) * sp) % 2200 - 140, x = x0 + Math.sin((T + ph) * 1.3) * 60;
    at(ctx, x, y, (T + ph) * 2, sc, sc * (0.5 + 0.5 * Math.abs(Math.sin((T + ph) * 3))), () => {
      ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -16, 22, 0); ctx.quadraticCurveTo(0, 16, -22, 0);
      ctx.fillStyle = ['#c0442a', '#d9772e', '#a8341e', '#e0a040'][i % 4]; ctx.fill();
      ctx.strokeStyle = 'rgba(80,20,10,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke(); ctx.globalAlpha = 1;
    });
  }
}
function topBand(ctx, a = 0.55, h = 620) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(10,6,4,${a})`); g.addColorStop(1, 'rgba(10,6,4,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, h); }
function noonSky(ctx, y0, y1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#4f8fc6'); g.addColorStop(1, '#9cc6df'); ctx.fillStyle = g; ctx.fillRect(-600, y0, 2400, y1 - y0); }
// street set: vendor + table + stools. o: {laugh, handA, hangX, mFill(ctx) for tray on table, tray:bool}
function streetSet(ctx, T, o = {}) {
  noonSky(ctx, -1400, 0);
  Wd.drawStreet(ctx);
  godRays(ctx, 1000, -100, 2.2, 0.5, 2100, 8, 'rgba(255,235,170,0.5)', 0.3, T);
  const hx = o.hangX || 300;
  P.stool(ctx, hx - 10, 1345, 0.8, '#2f6fd6', 40);
  R.coUt(ctx, hx, 1318, 1.0, { t: T, shirt: HANG_SHIRT, laugh: o.laugh || 0, handA: o.handA || [110, -60], handB: [80, -40], holdFn: o.holdFn });
  P.lowTable(ctx, 560, 1345, 0.9, 260, 90);
  if (o.tray !== false) F.me(ctx, 560, 1252, 0.3, 420, o.mFill || trayFull, 0.32);
}
function trayFull(c) {
  F.bananaLeaf(c, 0, 0, 1, 0.3, 1);
  for (let i = 0; i < 4; i++) F.bunLa(c, -170 + (i % 2) * 95, -110 + Math.floor(i / 2) * 95, 1, 0.05 * i);
  for (let i = 0; i < 5; i++) F.tofu(c, 60 + (i % 3) * 85, -150 + Math.floor(i / 3) * 90, 0.9, 0.1 * i);
  for (let i = 0; i < 3; i++) F.chaCom(c, -180 + i * 70, 130 + (i % 2) * 30, 1, 0.3 * i);
  for (let i = 0; i < 4; i++) F.porkSlice(c, 60 + i * 24, 120 + i * 18, 1.1, -0.4);
  for (let i = 0; i < 7; i++) F.herbLeaf(c, -300 + (i % 3) * 30, -20 + i * 26, 1.2, i, i % 2 ? 'tiato' : 'kinhgioi');
  for (let i = 0; i < 3; i++) F.cucumber(c, 280, -60 + i * 50, 1);
}
// seated tourist on a tiny stool; returns nothing. x = stool x
function tinyStoolTourist(ctx, x, T, st = {}, squash = 0) {
  at(ctx, x, 1345, 0, 1, 1 - squash * 0.25, () => P.stool(ctx, 0, 0, 0.75, '#d63a2f', 40));
  Pp.tourist(ctx, x + 10, 1345 + 52 + squash * 10, 1, Object.assign({ sit: 1 }, st));
}
function fryPan(ctx, x, y, s, k, oil, fillFn) {
  at(ctx, x, y, 0, s, s, () => {
    const R0 = 300;
    ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.roundRect(R0 - 10, -20, 260, 34, 14); ctx.fill();
    ell(ctx, 0, 30, R0 + 10, (R0 + 10) * k); ctx.fillStyle = '#0a0a0a'; ctx.fill();
    ell(ctx, 0, 0, R0, R0 * k); const g = ctx.createRadialGradient(-80, -40, 10, 0, 0, R0); g.addColorStop(0, '#4a4440'); g.addColorStop(1, '#1a1715'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, R0 - 12, (R0 - 12) * k); ctx.clip();
    if (oil) { ell(ctx, 0, 20, R0 * 0.8, R0 * 0.8 * k); const og = ctx.createRadialGradient(-60, 0, 10, 0, 20, R0 * 0.8); og.addColorStop(0, 'rgba(255,215,110,0.9)'); og.addColorStop(1, 'rgba(200,120,30,0.75)'); ctx.fillStyle = og; ctx.fill(); }
    if (fillFn) fillFn(ctx, R0, k);
    ctx.restore();
    ctx.lineWidth = 8; ctx.strokeStyle = '#5a5552'; ell(ctx, 0, 0, R0, R0 * k); ctx.stroke();
  });
}
function oilBubbles(ctx, T, seed, n, rx, ry, cy = 20) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) , ph = (T * (1.5 + r() * 2) + r()) % 1; ell(ctx, Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 3 + ph * 7, (3 + ph * 7) * 0.6); ctx.strokeStyle = `rgba(255,245,200,${0.8 * (1 - ph)})`; ctx.lineWidth = 2; ctx.stroke(); }
}
function oilSparks(ctx, T, seed, n, x, y, w, h) {
  const r = rng(seed); ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) { const life = (T * (1 + r()) + r()) % 1, px = x + (r() - 0.5) * w, py = y - life * h + life * life * h * 0.8; ctx.globalAlpha = (1 - life) * 0.9; ctx.fillStyle = 'rgba(255,230,150,1)'; ctx.beginPath(); ctx.arc(px, py, 2 + r() * 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ============ S1 0–3 Aerial old quarter ============
function s1(ctx, lt, p, T) {
  const cy = lerp(1250, 1800, ease.inOut(p)), z = lerp(1.0, 1.08, p);
  cam(ctx, 540, cy, z, 0, () => {
    noonSky(ctx, -600, 0);
    Wd.drawAerial(ctx);
    for (let i = 0; i < 6; i++) { const bx = -100 + ((lt * (120 + i * 25) + i * 210) % 1400), by = 1050 + i * 34 + Math.sin(lt * 3 + i) * 10; Wd.sparrow(ctx, bx, by, 0.7, lt * 18 + i, false); }
  });
  glow(ctx, 880, 120, 700, 'rgba(255,240,190,0.8)', 0.6);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; const hz = ctx.createLinearGradient(0, 500, 0, 1400); hz.addColorStop(0, 'rgba(255,235,190,0)'); hz.addColorStop(0.5, 'rgba(255,235,190,0.16)'); hz.addColorStop(1, 'rgba(255,235,190,0)'); ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H); ctx.restore();
  const wy = lerp(1500, 260, ease.inOut(p));
  Wd.wires(ctx, -60, wy, 1140, wy - 140, 6, 31, 120, '#120c08', lt);
  bangLeaves(ctx, T, 3, 10, 0.95, 1.4);
  flare(ctx, 880, 140, 0.9, 0.35 + 0.4 * bump(lt, 1.2, 1.2));
  dust(ctx, lt, 3, 40, 0, 0, W, H, '255,235,190', 2.5, 0.5);
  { const g = ctx.createLinearGradient(0, 1200, 0, 1560); g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(0.5, 'rgba(10,6,4,0.5)'); g.addColorStop(1, 'rgba(10,6,4,0)'); ctx.fillStyle = g; ctx.fillRect(0, 1200, W, 360); }
  Tx.label(ctx, T, 0.7, 2.85, 'HÀ NỘI · 11:30 TRƯA', 'Hanoi · 11:30 AM', 1360);
  if (lt < 0.7) { ctx.fillStyle = `rgba(0,0,0,${1 - ease.out(lt / 0.7)})`; ctx.fillRect(0, 0, W, H); }
}

// ============ S2 3–5.5 The alley: bikes, tourist walks in ============
function bike(ctx, T, tc, y, s, dir, cols) {
  const u = (T - tc) / 0.32;
  if (Math.abs(u) > 2.2) return;
  const x = 540 + dir * 820 * u * Math.abs(u) * 0.55 + dir * 120 * u, v = Math.abs(u) * 1.6 + 0.2;
  ctx.save(); for (let i = 0; i < 7; i++) { ctx.globalAlpha = i === 0 ? 0.95 : 0.22; Wd.motorbike(ctx, x - dir * i * v * 22, y, s, dir < 0, T, cols); } ctx.restore();
}
function s2(ctx, lt, p, T) {
  cam(ctx, 540, lerp(1000, 1050, p), lerp(1.0, 1.06, ease.inOut(p)), 0, () => {
    streetSet(ctx, T, { tray: false });
    P.stool(ctx, 760, 1345, 0.75, '#d63a2f', 40);
    const wt = clamp(lt / 2.5), x = lerp(1200, 820, wt);
    Pp.tourist(ctx, x, 1345, 1, { walk: (1200 - x) / 40, look: -0.05 });
  });
  bike(ctx, T, 3.8, 1900, 1.25, 1, { body: '#c0392b', helm: '#f1c40f', jacket: '#34495e' });
  bike(ctx, T, 4.9, 1700, 0.85, -1, { body: '#2e86de', helm: '#ecf0f1', jacket: '#7d5a3c' });
  bangLeaves(ctx, T, 5, 8, 0.9, 1.1);
  dust(ctx, T, 5, 30, 0, 0, W, H, '255,235,190', 2.5, 0.45);
}

// ============ S3 5.5–8 Sitting on the tiny stool ============
function s3(ctx, lt, p, T) {
  const sit = ease.inOut(clamp((lt - 0.2) / 0.8)), squash = bump(lt, 1.1, 0.35) + 0.4 * bump(lt, 1.9, 0.25);
  cam(ctx, lerp(700, 760, sit), lerp(1150, 1230, sit), lerp(1.5, 1.85, ease.inOut(p)), 0, () => {
    streetSet(ctx, T, { tray: false });
    if (sit < 1) {
      at(ctx, 760, 1345, 0, 1, 1, () => P.stool(ctx, 0, 0, 0.75, '#d63a2f', 40));
      Pp.tourist(ctx, lerp(840, 770, sit), 1345 + 52 * sit, 1, { sit, look: -0.05, lean: sit * 0.1 });
    } else tinyStoolTourist(ctx, 760, T, { look: -0.05 + squash * 0.1, lean: 0.1 - squash * 0.1, raise: squash * 0.3 }, squash);
    // little "creak" strain lines
    if (squash > 0.1) { ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${squash})`; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(760 + sx * 50, 1320); ctx.lineTo(760 + sx * 80, 1300); ctx.moveTo(760 + sx * 52, 1335); ctx.lineTo(760 + sx * 86, 1330); ctx.stroke(); } ctx.restore(); }
  });
  bangLeaves(ctx, T, 6, 6, 0.9, 1.4);
}

// ============ S4 8–10 Empty mẹt → banana leaf slap ============
function s4(ctx, lt, p, T) {
  const draw = (c) => {
    darkBg(c, '#6a4a2a', '#2a1a0c');
    glow(c, 820, 200, 900, 'rgba(255,230,170,0.6)', 0.6);
    const un = ease.outBack(clamp((lt - 0.75) / 0.3));
    cam(c, 540, 960, lerp(1.15, 1.25, p), 0, () => {
      F.me(c, 540, 1000, 1.05, 420, (cc) => F.bananaLeaf(cc, -380 + 380 * clamp(un), 0, 1, 0.3, un));
    });
    if (lt > 1.0 && lt < 1.4) { const k = (lt - 1.0) / 0.4; c.save(); c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; c.lineWidth = 6; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.moveTo(540 + Math.cos(a) * 480 * (0.9 + k * 0.3), 1000 + Math.sin(a) * 480 * (0.9 + k * 0.3)); c.lineTo(540 + Math.cos(a) * 560 * (0.9 + k * 0.3), 1000 + Math.sin(a) * 560 * (0.9 + k * 0.3)); c.stroke(); } c.restore(); }
  };
  const dx = lt > 1.75 ? -ease.in((lt - 1.75) / 0.25) * 900 : 0;
  if (dx) motionBlurX(ctx, dx, 8, draw); else draw(ctx);
}

// ============ S5 10–13 Tofu into hot oil ============
function s5(ctx, lt, p, T) {
  darkBg(ctx, '#1a0e06', '#3a1c0c');
  bokeh(ctx, T, 41, 14, ['rgba(255,150,60,0.9)', 'rgba(255,210,130,0.8)'], 0.3, 30, 110);
  const drops = [0.6, 1.2, 1.8], slots = [[-120, 30], [60, -10], [170, 50]];
  const hit = drops.reduce((m, t0) => Math.max(m, bump(lt, t0, 0.15)), 0);
  cam(ctx, 540 + Math.sin(T * 60) * hit * 6, 1200, lerp(1.0, 1.1, ease.inOut(p)), 0, () => {
    glow(ctx, 540, 1300, 650, 'rgba(255,120,40,0.8)', 0.55);
    glow(ctx, 540, 1560, 420, 'rgba(255,90,20,0.9)', 0.5);
    fryPan(ctx, 540, 1320, 1.25, 0.5, true, (c, R0, k) => {
      oilBubbles(c, T, 9, 40, R0 * 0.75, R0 * 0.75 * k);
      drops.forEach((t0, i) => { if (lt > t0) { F.tofu(c, slots[i][0], slots[i][1] - 20, 1.1, 0.1 * i, { gold: clamp((lt - t0) / 3) * 0.6 }); oilBubbles(c, T + i, 30 + i, 14, 60, 30, slots[i][1] + 10); } });
    });
    drops.forEach((t0, i) => {
      const k = (lt - (t0 - 0.35)) / 0.35;
      if (k > 0 && k < 1) F.tofu(ctx, 540 + slots[i][0] * 1.25, lerp(500, 1320 + slots[i][1] * 0.6, k * k), 1.4, k * 2, { gold: 0 });
      const a = lt - t0; if (a > 0 && a < 0.7) { P.splash(ctx, 540 + slots[i][0] * 1.25, 1320 + slots[i][1] * 0.6, a * 0.3, 11 + i * 7, 'water', 16); oilSparks(ctx, T, 50 + i, 20, 540 + slots[i][0] * 1.25, 1320, 300, 300); }
    });
    oilSparks(ctx, T, 17, 30, 540, 1300, 600, 280);
    steam(ctx, T, 33, 540, 1200, 400, 800, 10, 0.25);
  });
  Tx.title(ctx, T, 10.0, 12.3, 430, 'Tofu & Noodles with Shrimp Paste', 'BÚN ĐẬU', 'MẮM TÔM', 128, 92);
  Tx.caption(ctx, T, 10.6, 12.9, 'Rán đậu', 'Fry the tofu', { n: 1 });
}

// ============ S6 13–16 Golden & crispy: flip, lift, cut ============
function s6(ctx, lt, p, T) {
  if (lt < 1.9) {
    darkBg(ctx, '#1a0e06', '#3a1c0c');
    bokeh(ctx, T, 43, 14, ['rgba(255,150,60,0.9)', 'rgba(255,210,130,0.8)'], 0.3, 30, 110);
    cam(ctx, 540, 1150, lerp(1.35, 1.5, lt / 1.9), 0, () => {
      glow(ctx, 540, 1250, 650, 'rgba(255,120,40,0.8)', 0.55);
      fryPan(ctx, 540, 1320, 1.25, 0.5, true, (c, R0, k) => {
        oilBubbles(c, T, 9, 40, R0 * 0.75, R0 * 0.75 * k);
        F.tofu(c, -120, 10, 1.1, 0, { gold: 1 });
        F.tofu(c, 170, 30, 1.1, 0.2, { gold: 1 });
      });
      // the flipping cube (chopsticks)
      const f1 = clamp((lt - 0.3) / 0.4), f2 = clamp((lt - 1.3) / 0.4);
      const fl = f1 < 1 ? f1 : f2, up = Math.sin(fl * Math.PI) * 140;
      const cx = 540 + 60 * 1.25, cy = 1320 - 25 - up;
      F.tofu(ctx, cx, cy, 1.4, fl * Math.PI, { gold: 0.5 + 0.5 * clamp(lt / 1.3) });
      F.chopsticks(ctx, cx + 30, cy - 10, 1.4, -2.5 + fl * 0.3, 0.05);
      oilSparks(ctx, T, 19, 30, 540, 1300, 600, 260);
    });
  } else {
    const l2 = lt - 1.9;
    darkBg(ctx, '#3a2412', '#120a04');
    glow(ctx, 300, 500, 900, 'rgba(255,200,120,0.6)', 0.7);
    const chop = clamp((l2 - 0.0) / 0.3), sep = ease.out(clamp((l2 - 0.3) / 0.4));
    cam(ctx, 540, 1150, lerp(1.25, 1.35, l2 / 1.1), 0, () => {
      F.board(ctx, 1200);
      F.tofu(ctx, 540 - sep * 70, 1180, 2.2, -sep * 0.2, { gold: 1, cut: sep > 0 });
      if (sep <= 0) F.tofu(ctx, 540, 1180, 2.2, 0, { gold: 1 });
      else F.tofu(ctx, 540 + sep * 110, 1180, 2.2, sep * 0.15, { gold: 1 });
      F.cleaver(ctx, 545, lerp(700, 1270, ease.in(chop)) - sep * 260, 1.2, 0);
      steam(ctx, T, 61, 560, 1120, 220, 500, 8, 0.4 * sep);
      if (l2 > 0.3 && l2 < 1.0) L.flakes(ctx, l2, 0.3, 77, 20, 545, 1150, { g: 1400, speed: 600, life: 0.8, size: 6, colors: ['#f7c46a', '#e8a040', '#fff0c0'] });
    });
  }
  Tx.caption(ctx, T, 13.15, 15.9, 'Vàng giòn', 'Golden & crispy', { n: 2 });
}

// ============ S7 16–19 Chả cốm frying ============
function s7(ctx, lt, p, T) {
  darkBg(ctx, '#1a0e06', '#3a1c0c');
  bokeh(ctx, T, 47, 14, ['rgba(255,150,60,0.9)', 'rgba(200,230,120,0.6)'], 0.3, 30, 110);
  const press = [0.5, 1.5, 2.5].reduce((m, t0) => Math.max(m, bump(lt, t0 - 0.12, 0.3)), 0);
  cam(ctx, 540, 1200, lerp(1.1, 1.2, ease.inOut(p)), 0, () => {
    glow(ctx, 540, 1300, 650, 'rgba(255,120,40,0.8)', 0.5);
    glow(ctx, 540, 1560, 420, 'rgba(255,90,20,0.9)', 0.5);
    fryPan(ctx, 540, 1320, 1.25, 0.5, true, (c, R0, k) => {
      oilBubbles(c, T, 12, 50, R0 * 0.75, R0 * 0.75 * k);
      const pos = [[-150, -20], [0, -40], [150, -10], [-80, 70], [90, 75]];
      pos.forEach(([x, y], i) => at(c, x, y, 0, 1, i === 1 ? 1 - press * 0.25 : 1, () => F.chaCom(c, 0, 0, 1.6, i * 0.5, clamp(lt / 3))));
    });
    // spatula pressing the middle patty
    at(ctx, 540, lerp(1050, 1270, press), -0.15, 1, 1, () => {
      ctx.fillStyle = '#9aa0a4'; ctx.beginPath(); ctx.roundRect(-90, -16, 180, 32, 8); ctx.fill();
      ctx.fillStyle = '#6a4024'; ctx.beginPath(); ctx.roundRect(-14, -420, 28, 410, 10); ctx.fill();
    });
    oilSparks(ctx, T, 21, 34 + press * 30, 540, 1300, 600, 280);
    steam(ctx, T, 35, 540, 1200, 400, 800, 10, 0.3);
  });
  Tx.caption(ctx, T, 16.15, 18.9, 'Chả cốm', 'Green rice patties', { n: 3 });
}

// ============ S8 19–22 Slicing boiled pork ============
function s8(ctx, lt, p, T) {
  darkBg(ctx, '#2a1608', '#120804');
  glow(ctx, 300, 500, 900, 'rgba(255,200,130,0.6)', 0.7);
  const chops = [0.5, 1.0, 1.5, 2.0, 2.5];
  const n = chops.filter(t0 => lt > t0).length;
  const hit = chops.reduce((m, t0) => Math.max(m, bump(lt, t0, 0.12)), 0);
  const S = 2.2, RX = 1000, edge = (k) => RX - (260 - k * 40) * S;
  cam(ctx, 560, 1180 + hit * 6, lerp(1.0, 1.08, p), 0, () => {
    F.board(ctx, 1150);
    const w = 260 - n * 40;
    F.porkSlab(ctx, RX - w * S / 2, 1340, S, w);
    for (let i = 0; i < n; i++) { const k = ease.out(clamp((lt - chops[i]) / 0.35)); F.porkSlice(ctx, lerp(edge(i + 1) - 30, 140 + i * 60, k), lerp(1290, 1430 + i * 34, k), 2.4, lerp(1.57, -0.3, k)); }
    const idx = chops.findIndex(t => lt < t + 0.25), ci = idx < 0 ? 4 : idx, t0 = chops[ci];
    const y = lt < t0 ? lerp(760, 1340, ease.in(clamp((lt - (t0 - 0.28)) / 0.28))) : lerp(1340, 760, ease.out(clamp((lt - t0) / 0.25)));
    F.cleaver(ctx, edge(ci + 1) + 10, y, 1.3, 0);
  });
  Tx.caption(ctx, T, 19.15, 21.9, 'Thịt luộc', 'Boiled pork', { n: 4 });
}

// ============ S9 22–25 Cutting the pressed noodle sheet ============
function s9(ctx, lt, p, T) {
  darkBg(ctx, '#3a2412', '#120a04');
  glow(ctx, 760, 400, 800, 'rgba(255,220,160,0.6)', 0.6);
  const cuts = [0.5, 1.5, 2.5];
  cam(ctx, 540, 1000, lerp(1.0, 1.08, p), 0, () => {
    // board top-down
    ctx.fillStyle = '#9a6a38'; ctx.beginPath(); ctx.roundRect(60, 520, 960, 960, 40); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.25)'; ctx.lineWidth = 2; for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(60, 540 + i * 48); ctx.bezierCurveTo(400, 530 + i * 50, 700, 550 + i * 46, 1020, 540 + i * 48); ctx.stroke(); }
    // sheet split into a 3x3 grid as cuts land
    const n = cuts.filter(t => lt > t).length;
    for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3; gy++) {
      const sepX = n >= 1 ? (gx - 1) * 22 * ease.out(clamp((lt - cuts[0]) / 0.3)) : 0;
      const sepY = n >= 2 ? (gy - 1) * 22 * ease.out(clamp((lt - cuts[1]) / 0.3)) : 0;
      const sp = n >= 3 ? ease.out(clamp((lt - cuts[2]) / 0.4)) : 0;
      F.bunLa(ctx, 540 + (gx - 1) * 200 + sepX + (gx - 1) * 40 * sp, 1000 + (gy - 1) * 200 + sepY + (gy - 1) * 40 * sp, 1, sp * (gx - gy) * 0.08, 202, 202);
    }
    // knife sweeping down for each cut
    const t0 = cuts.find(t => lt < t + 0.3);
    if (t0 !== undefined) {
      const k = clamp((lt - (t0 - 0.3)) / 0.3), i = cuts.indexOf(t0);
      const vertical = i !== 1, off = i === 2 ? 100 : -100;
      at(ctx, vertical ? 540 + off : lerp(200, 880, k), vertical ? lerp(600, 1400, k) : 1000 + off, vertical ? 0 : Math.PI / 2, 1, 1, () => {
        const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#6a6e72'); g.addColorStop(0.5, '#f2f2ee'); g.addColorStop(1, '#5a5e62');
        ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-14, -260, 28, 260, 6); ctx.fill(); ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.roundRect(-18, -440, 36, 180, 12); ctx.fill();
      });
    }
  });
  Tx.caption(ctx, T, 22.15, 24.9, 'Bún lá', 'Pressed rice noodles', { n: 5 });
}

// ============ S10 25–28 Herb basket ============
const HERBS = (() => { const r = rng(41), a = []; for (let i = 0; i < 40; i++) { const ang = r() * TAU, d = Math.sqrt(r()) * 340; a.push([Math.cos(ang) * d, Math.sin(ang) * d, r() * TAU]); } return a; })();
function s10(ctx, lt, p, T) {
  darkBg(ctx, '#5a4028', '#2a1a0c');
  glow(ctx, 860, 260, 900, 'rgba(255,235,170,0.7)', 0.7);
  const pop = (t0) => ease.outBack(clamp((lt - t0) / 0.3));
  cam(ctx, 540, 960, lerp(1.05, 1.15, ease.inOut(p)), 0, () => {
    at(ctx, 540, 920, lt * 0.12, 1, 1, () => R.basket(ctx, 0, 0, 1, 440, (c) => {
      for (const [x, y, rt] of HERBS) F.herbLeaf(c, x, y, 2.0, rt, 'xalach');
      const k1 = pop(0.5), k2 = pop(1.5), k3 = pop(2.5);
      if (k1 > 0) HERBS.slice(0, 16).forEach(([x, y, rt]) => F.herbLeaf(c, x * 0.8, y * 0.8, 1.8 * k1, rt + 1, 'kinhgioi'));
      if (k2 > 0) HERBS.slice(16, 30).forEach(([x, y, rt]) => F.herbLeaf(c, -x * 0.7, y * 0.7, 2.0 * k2, rt + 2, 'tiato'));
      if (k3 > 0) for (let i = 0; i < 9; i++) F.cucumber(c, -100 + (i % 3) * 70, 150 + Math.floor(i / 3) * 55, 1.6 * k3, i);
    }));
    for (const t0 of [0.5, 1.5, 2.5]) if (lt > t0 && lt < t0 + 0.45) L.sparkle(ctx, 540 + Math.cos(t0 * 3) * 200, 920 + Math.sin(t0 * 3) * 200, 90, 1 - (lt - t0) / 0.45);
    const r = rng(8); ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 40; i++) { const x = 540 + (r() - 0.5) * 700, y = 920 + (r() - 0.5) * 700; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 3 + i); ctx.fillStyle = '#fff'; ell(ctx, x, y, 3, 3); ctx.fill(); }
    ctx.restore();
  });
  godRays(ctx, 900, 150, 2.3, 0.8, 1800, 8, 'rgba(255,235,170,0.45)', 0.35, T);
  Tx.caption(ctx, T, 25.15, 27.9, 'Rau thơm', 'Fresh herbs', { n: 6 });
}

module.exports = { topBand, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, bump, darkBg, warmBokeh, bangLeaves, streetSet, trayFull, tinyStoolTourist, noonSky, oilSparks, TOUR_SKIN, HANG_SKIN, HANG_SHIRT };
