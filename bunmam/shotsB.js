// Bún mắm – shots 11–20: greens, noodles, the bowl, and the tourist's smell-to-love arc.
const L = require('./lib');
const P = require('./props');
const R = require('./river');
const Pp = require('./people');
const Tx = require('./text');
const A = require('./shotsA');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, motionBlurX } = L;
const { ell } = P;
const { bump, darkBg, warmBokeh, pour, river, TOUR_SKIN } = A;
const LINE_Y = 330;

function perchBird(ctx, x, y, s, t, fly) {
  at(ctx, x, y, fly ? -0.3 : 0, s, s, () => {
    ell(ctx, 0, 0, 26, 18); ctx.fillStyle = '#6a4a30'; ctx.fill();
    ell(ctx, 6, 6, 16, 10); ctx.fillStyle = '#d8c0a0'; ctx.fill();
    ell(ctx, -22, -14, 13, 12); ctx.fillStyle = '#5a3a24'; ctx.fill();
    ctx.fillStyle = '#111'; ell(ctx, -26, -16, 2.5, 2.5); ctx.fill();
    ctx.fillStyle = '#e0a030'; ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(-44, -11); ctx.lineTo(-34, -9); ctx.fill();
    ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.moveTo(22, -2); ctx.lineTo(44, -10); ctx.lineTo(42, 4); ctx.fill();
    const a = fly ? Math.sin(t * 45) * 1.1 : 0.2;
    ctx.fillStyle = '#7a5434'; ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(16, -8 - 40 * Math.cos(a)); ctx.lineTo(20, -4); ctx.fill();
  });
}
function jumpFish(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, '#5a6a72'); g.addColorStop(0.5, '#e8f0f2'); g.addColorStop(1, '#a8b8c0');
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(0, -26, 44, 0); ctx.quadraticCurveTo(0, 22, -50, 0); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(-72, -18); ctx.lineTo(-68, 18); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; ell(ctx, 30, -4, 3, 3); ctx.fill();
  });
}
function tears(ctx, x, y, s, k, T) {
  if (k <= 0) return;
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    const ph = (T * 1.4 + i * 0.5 + (sx > 0 ? 0.25 : 0)) % 1;
    at(ctx, x + sx * 100 * s, y + (40 + ph * 120) * s, 0, s * k, s * k, () => {
      ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(10, 4, 0, 10); ctx.quadraticCurveTo(-10, 4, 0, -14);
      ctx.fillStyle = 'rgba(170,220,255,0.9)'; ctx.fill(); ctx.globalAlpha = 1;
    });
  }
}
function desat(ctx, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore();
}
const FULL = (o = {}) => R.bowlContents(Object.assign({ noodles: true, toppings: 8, chili: 7, herbs: true }, o));

// ============ S11 27.5–31 Mekong greens basket (top-down, rotating) ============
const GREENS = (() => { const r = rng(31), a = []; for (let i = 0; i < 70; i++) { const ang = r() * TAU, d = Math.sqrt(r()) * 360; a.push([Math.cos(ang) * d, Math.sin(ang) * d, r() * TAU, r() < 0.5 ? '#3f8f3a' : '#6fb44f']); } return a; })();
function popK(lt, t0) { return ease.outBack(clamp((lt - t0) / 0.3)); }
function s11(ctx, lt, p, T) {
  darkBg(ctx, '#5a4028', '#2a1a0c');
  glow(ctx, 200, 300, 900, 'rgba(255,215,150,0.7)', 0.7);
  cam(ctx, 540, 960, lerp(1.05, 1.15, ease.inOut(p)), 0, () => {
    at(ctx, 540, 900, lt * 0.12, 1, 1, () => R.basket(ctx, 0, 0, 1, 440, (c) => {
      for (const [x, y, rt, col] of GREENS) R.leafSmall(c, x, y, 2.2, rt, col);
      const k1 = popK(lt, 1.0), k2 = popK(lt, 2.0), k3 = popK(lt, 3.0);
      if (k1 > 0) for (let i = 0; i < 7; i++) at(c, -60 + i * 22, -120 + i * 36, 0.5, k1, k1, () => R.lilyStem(c, 0, 0, 1.15, 0));
      if (k2 > 0) for (let i = 0; i < 9; i++) { const a = i * 0.7; R.dienDien(c, Math.cos(a) * (150 + i * 14), Math.sin(a) * (150 + i * 14), 1.5 * k2, T, 1); }
      if (k3 > 0) {
        for (let i = 0; i < 26; i++) R.sprout(c, 120 + (i % 6) * 16 - 160, 180 + Math.floor(i / 6) * 22, 1.5 * k3, i * 0.9);
        c.strokeStyle = '#d9a0c0'; c.lineWidth = 4 * k3; c.lineCap = 'round';
        for (let i = 0; i < 26; i++) { const x = -260 + (i % 7) * 18, y = -40 + Math.floor(i / 7) * 24; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 20, y - 18 * k3, x + 36, y + 4); c.stroke(); }
      }
    }));
    for (const t0 of [1.0, 2.0, 3.0]) if (lt > t0 && lt < t0 + 0.45) L.sparkle(ctx, 540 + Math.cos(t0 * 3) * 200, 900 + Math.sin(t0 * 3) * 200, 90, 1 - (lt - t0) / 0.45);
    // water droplets on greens
    const r = rng(8); ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 40; i++) { const x = 540 + (r() - 0.5) * 700, y = 900 + (r() - 0.5) * 700; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(T * 3 + i); ctx.fillStyle = '#fff'; ell(ctx, x, y, 3, 3); ctx.fill(); }
    ctx.restore();
  });
  godRays(ctx, 150, 200, 0.9, 0.8, 1800, 8, 'rgba(255,220,160,0.45)', 0.35, T);
  Tx.caption(ctx, T, 27.6, 30.9, 'Rau sông nước', 'Mekong greens & flowers', { n: 7 });
}

// ============ S12 31–33.5 Blanch noodles in a bamboo strainer ============
function strainer(ctx, x, y, s, rot, T) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.strokeStyle = '#8a6030'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(120, -30); ctx.lineTo(620, -560); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(124, -36); ctx.lineTo(616, -566); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.moveTo(-150, -30); ctx.quadraticCurveTo(-140, 110, 0, 120); ctx.quadraticCurveTo(140, 110, 150, -30); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#b88a4e'; ctx.fillRect(-160, -40, 320, 170);
    ctx.strokeStyle = 'rgba(80,50,20,0.55)'; ctx.lineWidth = 3;
    for (let i = -200; i < 200; i += 14) { ctx.beginPath(); ctx.moveTo(i, -40); ctx.lineTo(i + 120, 130); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, 130); ctx.lineTo(i + 120, -40); ctx.stroke(); }
    ctx.restore();
    R.noodles(ctx, 0, -34, 1, 270, 50, 9);
    ctx.strokeStyle = '#7a5226'; ctx.lineWidth = 10; ell(ctx, 0, -30, 150, 30); ctx.stroke();
  });
}
function s12(ctx, lt, p, T) {
  darkBg(ctx, '#3a2412', '#120a04');
  bokeh(ctx, T, 61, 16, ['rgba(255,190,110,0.85)', 'rgba(255,230,170,0.7)'], 0.3, 30, 110);
  glow(ctx, 760, 380, 700, 'rgba(255,200,130,0.7)', 0.7);
  cam(ctx, 540, 1060, lerp(1.0, 1.08, p), 0, () => {
    R.pot(ctx, 540, 2000, 1.9, { k: 0.4, boil: T * 1.5, broth: ['#eef4f2', '#8aa0a6'] });
    const dip = clamp(lt / 0.3), lift = ease.inOut(clamp((lt - 0.45) / 0.6));
    const y = lerp(lerp(1000, 1560, ease.in(dip)), 900, lift) + Math.sin(T * 9) * 6 * lift;
    strainer(ctx, 540, y, 1.6, Math.sin(T * 9) * 0.03 * lift, T);
    if (lt > 0.3 && lt < 0.9) P.splash(ctx, 540, 1560, (lt - 0.3) * 0.35, 77, 'water', 20);
    // drips
    if (lift > 0.5) {
      const r = rng(4);
      for (let i = 0; i < 14; i++) {
        const ph = (T * (0.9 + r() * 0.6) + r()) % 1, x = 540 + (r() - 0.5) * 360;
        ctx.save(); ctx.globalAlpha = 0.8; ell(ctx, x, y + 150 + ph * ph * 700, 5, 9); ctx.fillStyle = 'rgba(220,240,250,0.85)'; ctx.fill(); ctx.restore();
      }
    }
    steam(ctx, T, 63, 540, y + 40, 520, 700, 14, 0.55);
    steam(ctx, T, 64, 540, 1560, 600, 900, 12, 0.45);
  });
  Tx.caption(ctx, T, 31.1, 33.4, 'Trụng bún', 'Blanch the noodles', { n: 8 });
}

// ============ S13 33.5–36.5 Build the bowl (orbit) ============
function s13(ctx, lt, p, T) {
  warmBokeh(ctx, T, lerp(120, -120, p), 91);
  glow(ctx, 540, 600, 700, 'rgba(255,210,150,0.6)', 0.6);
  const placeT = [1.0, 1.5, 2.0, 2.5]; // T 34.5..36
  const tp = placeT.filter(t0 => lt > t0).length * 2;
  const k = lerp(0.36, 0.5, ease.inOut(p));
  cam(ctx, 540, 1200, lerp(1.0, 1.12, ease.inOut(p)), Math.sin(p * Math.PI) * 0.05, () => {
    // wooden boat plank surface
    const g = ctx.createLinearGradient(0, 1100, 0, 1920); g.addColorStop(0, '#6a4424'); g.addColorStop(1, '#2a180a');
    ctx.fillStyle = g; ctx.fillRect(-200, 1180, 1480, 1000);
    R.bowl(ctx, 540, 1450, 2.3, { k, fill: R.bowlContents({ broth: 0, noodles: lt > 0.5, toppings: tp }) });
    // falling item per placement
    placeT.forEach((t0, i) => {
      const kk = (lt - (t0 - 0.25)) / 0.25;
      if (kk > 0 && kk < 1) {
        const y = lerp(500, 1150, kk * kk), x = 540 + (i % 2 ? 90 : -90);
        if (i === 0) R.porkBlock(ctx, x, y, 1.3, kk, 110); else if (i === 1) R.shrimp(ctx, x, y, 1.6, kk * 3); else if (i === 2) R.squid(ctx, x, y, 1.8, 0); else R.fishFlake(ctx, x, y, 2, kk);
      }
      if (lt > t0 && lt < t0 + 0.3) L.sparkle(ctx, 540 + (i % 2 ? 90 : -90), 1170, 80, 1 - (lt - t0) / 0.3);
    });
    if (lt > 0.35 && lt < 0.6) { const kk = (lt - 0.35) / 0.25; R.noodles(ctx, 540, lerp(600, 1150, kk * kk), 2, 200, 80, 3); }
  });
  dust(ctx, T, 13, 30, 0, 0, W, H, '255,220,170', 2.5, 0.4);
  Tx.caption(ctx, T, 33.6, 36.4, 'Xếp tô', 'Build the bowl', { n: 9 });
}

// ============ S14 36.5–40 Hero broth pour ============
function s14(ctx, lt, p, T) {
  darkBg(ctx, '#3a2410', '#0e0804');
  bokeh(ctx, T, 71, 18, ['rgba(255,190,110,0.9)', 'rgba(255,235,180,0.8)', 'rgba(150,210,200,0.5)'], 0.3, 30, 120);
  godRays(ctx, 180, 120, 1.0, 0.9, 2000, 10, 'rgba(255,215,150,0.6)', 0.45, T);
  const slide = ease.inOut(clamp((lt - 2.9) / 0.6));
  const bx = lerp(540, 330, slide);
  const pourOn = clamp((lt - 0.3) / 0.15) * clamp((1.9 - lt) / 0.2);
  const level = ease.out(clamp((lt - 0.4) / 1.5));
  const chili = lt > 2.1 ? Math.min(7, Math.floor((lt - 2.1) / 0.05) + 1) : 0;
  cam(ctx, 540, 1180, lerp(1.0, 1.1, ease.inOut(clamp(lt / 2.5))), 0, () => {
    const g = ctx.createLinearGradient(0, 1300, 0, 1920); g.addColorStop(0, '#6a4424'); g.addColorStop(1, '#2a180a');
    ctx.fillStyle = g; ctx.fillRect(-200, 1380, 1480, 800);
    const topY = 1560 - 120 * 2.2;
    R.bowl(ctx, bx, 1560, 2.2, { k: 0.42, fill: FULL({ broth: level, chili }) });
    if (lt > 2.6) at(ctx, bx + 330, topY - 10, 0.5, 1.6, 1.6, () => R.lime(ctx, 0, lerp(-200, 0, ease.outBack(clamp((lt - 2.6) / 0.3))), 1, 0));
    // ladle + pour
    if (pourOn > 0) {
      at(ctx, 470, 300, -0.9 * pourOn, 1.4, 1.4, () => {
        ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#b8b4ac'; ctx.fill();
        ctx.strokeStyle = '#d8d4cc'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-330, -150); ctx.stroke();
      });
      pour(ctx, 540, 360, 560, topY + 20, 26, 'broth', T, pourOn);
      P.splash(ctx, 560, topY + 30, (T % 0.4) * 0.3, (T * 5) | 0, 'water', 10);
    }
    if (lt > 2.1 && lt < 2.45) { for (let i = 0; i < 4; i++) { const kk = (lt - 2.1 - i * 0.05) / 0.25; if (kk > 0 && kk < 1) R.chiliSlice(ctx, bx - 60 + i * 40, lerp(600, topY + 20, kk * kk), 2); } }
    steam(ctx, T, 81, bx, topY - 40, 600, 1100, 18, 0.35 + 0.35 * level);
    glow(ctx, bx - 80, topY - 60, 380, 'rgba(255,220,160,0.6)', 0.4 * level);
  });
  flare(ctx, 260, 260, 1.0, 0.4 + 0.5 * bump(lt, 0.8, 1.4));
  dust(ctx, T, 14, 40, 0, 0, W, H, '255,225,180', 3, 0.5);
  Tx.caption(ctx, T, 36.6, 39.4, 'Chan nước lèo', 'Pour the hot broth', { n: 10 });
}

// ============ S15 40–43 The smell hits ============
function s15(ctx, lt, p, T) {
  P.layer(ctx, 14, (x) => cam(x, 540, 900, 1.5, 0, () => river(x, T, { hy: 760, boats: false })));
  const wave = clamp((lt - 0.3) / 1.0), shock = ease.outBack(clamp((lt - 0.6) / 0.4));
  const shake = lt > 0.6 && lt < 1.6 ? Math.sin(T * 70) * 6 : 0;
  Pp.face(ctx, 540 + shake, 860 - shock * 20, 1.25, {
    t: T, open: lerp(1, 0.35, shock), brow: lerp(0, 1.2, shock), mouth: 'o', mOpen: lerp(0.1, 0.8, shock),
    hairLift: shock, lookY: -0.1, tilt: -shock * 0.08,
  });
  tears(ctx, 540, 860, 1.25, clamp((lt - 1.1) / 0.3), T);
  R.bowl(ctx, 540, 1960, 1.9, { k: 0.4, fill: FULL() });
  steam(ctx, T, 91, 540, 1700, 500, 800, 10, 0.4);
  R.smellWave(ctx, 540, 1700, 540, 990, T, wave);
  if (lt > 0.6 && lt < 1.3) { ctx.fillStyle = `rgba(200,230,110,${0.25 * (1 - (lt - 0.6) / 0.7)})`; ctx.fillRect(0, 0, W, H); }
  Tx.line(ctx, T, 40.6, 42.9, 'Mùi gì dữ vậy?!', 'What IS that smell?!', { y: LINE_Y, vsize: 70 });
}

// ============ S16 43–45.5 Pinches nose; cô Út: "Just try it!" ============
function s16(ctx, lt, p, T) {
  cam(ctx, 540, 1060, lerp(1.08, 1.14, p), 0, () => {
    river(ctx, T, { hy: 640, sunX: 300, boats: false });
    const laugh = clamp((lt - 1.2) / 0.2), offer = ease.inOut(clamp((lt - 1.9) / 0.4));
    R.xuong(ctx, 330, 1330, 1.25, T, {
      ph: 3,
      inside: (c) => {
        P.stove(c, -170, -150, 0.25, T); R.pot(c, -170, -140, 0.4, { boil: T });
        R.coUt(c, -30, -40, 1.15, {
          t: T, laugh, handA: [lerp(110, 190, offer), lerp(-70, -120, offer)], handB: [80, -40],
          holdFn: (cc, h) => P.spoon(cc, h[0] + 10, h[1] - 6, 0.6, -0.15, 1, '#c98a3a'),
        });
      },
    });
    steam(ctx, T, 95, 120, 1100, 120, 400, 6, 0.4);
    R.xuong(ctx, 790, 1470, 1.4, T, {
      ph: 1,
      inside: (c) => Pp.tourist(c, 40, -34, 1.05, { sit: 1, lean: 0.06, glassHand: [-58, -268], glassHandK: ease.out(clamp(lt / 0.3)) }),
    });
    // bird on the bow flees
    const fly = lt > 0.4, fk = clamp((lt - 0.4) / 1.2);
    perchBird(ctx, lerp(1050, 1400, fk * fk), lerp(1410, 700, fk), 1.3, T, fly);
    if (lt > 0.4 && lt < 0.8) for (let i = 0; i < 4; i++) { ctx.fillStyle = '#6a4a30'; ell(ctx, 1050 + i * 20, 1380 - (lt - 0.4) * 200 * (1 + i * 0.3), 6, 3); ctx.fill(); }
    R.wake(ctx, 790, 1490, 300, T);
  });
  // stink lines above tourist
  ctx.save(); ctx.strokeStyle = 'rgba(190,220,110,0.7)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); for (let u = 0; u <= 1; u += 0.1) { const x = 720 + i * 50 + Math.sin(u * 8 + T * 6 + i) * 12, y = 960 - u * 160; u ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
  ctx.restore();
  Tx.line(ctx, T, 43.9, 45.4, '“Ăn thử đi con!”', '“Just try it!”', { y: LINE_Y, vsize: 70 });
}

// ============ S17 45.5–47.5 Brave sip, silence ============
function s17(ctx, lt, p, T) {
  P.layer(ctx, 18, (x) => cam(x, 540, 900, 1.5, 0, () => river(x, T, { hy: 760, boats: false })));
  const sip = ease.inOut(clamp(lt / 0.5));
  Pp.face(ctx, 540, 900, lerp(1.3, 1.45, ease.inOut(p)), { t: T, open: 0, brow: 0.6, mouth: 'sip', mOpen: 0.3, blush: 0.2 });
  const s = lerp(1.3, 1.45, ease.inOut(p));
  const sx = 600, sy = lerp(1500, 900 + 150 * s, sip);
  P.hand(ctx, sx + 150, sy + 120, 1.4, -0.4, 'fist', TOUR_SKIN);
  P.spoon(ctx, sx, sy, 1.6, -0.5, 1, '#c98a3a');
  desat(ctx, clamp((lt - 0.5) / 0.4) * 0.85);
  ctx.fillStyle = `rgba(0,0,0,${clamp((lt - 0.5) / 0.5) * 0.25})`; ctx.fillRect(0, 0, W, H);
}

// ============ S18 47.5–51.5 BOOM – euphoria ============
function s18(ctx, lt, p, T) {
  if (lt < 0.9) {
    const k = ease.outExpo(clamp(lt / 0.3));
    Pp.eyeMacro(ctx, 540, 960, 1.15, { pupil: lerp(0.24, 0.62, k), open: lerp(0.85, 1.12, k), brow: k * 0.6, reflect: (c, IR) => { glow(c, -IR * 0.3, -IR * 0.2, IR * 0.9, 'rgba(255,200,110,0.9)', 0.8); R.bowl(c, -IR * 0.2, IR * 0.25, IR / 1100, { k: 0.35, fill: FULL() }); } });
    ctx.save(); ctx.globalCompositeOperation = 'screen'; glow(ctx, 540, 960, 600 * k, 'rgba(255,210,120,0.9)', 0.5 * k); ctx.restore();
    return;
  }
  const l2 = lt - 0.9;
  cam(ctx, 540, 960, lerp(1.15, 1.0, ease.out(clamp(l2 / 1.2))), 0, () => {
    river(ctx, T, { hy: 900, sunX: 540 });
    // jumping fish
    for (const [t0, x] of [[1.1 - 0.9 + 0.9, 220], [2.7, 860]]) {
      const k = (lt - t0 + 0.3) / 1.0;
      if (k > 0 && k < 1) { jumpFish(ctx, x + k * 160, 1250 - Math.sin(k * Math.PI) * 420, 1.6, -0.9 + k * 1.8); if (k < 0.15 || k > 0.85) P.splash(ctx, x + (k < 0.5 ? 0 : 160), 1260, (k < 0.5 ? k : k - 0.85) * 0.5, 30 + x, 'water', 14); }
    }
  });
  // blooming điên điển frame
  const bl = ease.outBack(clamp(l2 / 0.6));
  const r = rng(44);
  for (let i = 0; i < 18; i++) { const a = r() * TAU, d = 560 + r() * 260; R.dienDien(ctx, 540 + Math.cos(a) * d * 0.75, 1000 + Math.sin(a) * d, 2.2, T, bl * (0.6 + 0.4 * Math.sin(T * 3 + i))); }
  Pp.face(ctx, 540, 1000 + Math.sin(T * 6) * 8, 1.25, { t: T, mouth: 'grin', mOpen: 0.8, happyClosed: true, open: 0.2, brow: 0.8, blush: 1, hairLift: 0.4 * bump(l2, 0, 0.6), tilt: Math.sin(T * 3) * 0.06 });
  for (let i = 0; i < 6; i++) { const ph = (T * 0.8 + i / 6) % 1; L.sparkle(ctx, 540 + Math.cos(i * 1.7) * 330, 960 + Math.sin(i * 2.3) * 300, 60, Math.sin(ph * Math.PI)); }
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,190,80,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  dust(ctx, T, 18, 60, 0, 0, W, H, '255,230,170', 3.5, 0.7);
  Tx.line(ctx, T, 48.5, 51.3, 'Ngon dữ thần!', 'Insanely good!', { y: LINE_Y, vsize: 80 });
}

// ============ S19 51.5–56 Slurping, sniffing the spoon like a connoisseur ============
function s19(ctx, lt, p, T) {
  P.layer(ctx, 12, (x) => cam(x, 540, 960, 1.15, 0, () => {
    river(x, T, { hy: 700, sunX: 760, boats: false });
    R.xuong(x, 230, 1400, 1.5, T, { ph: 3, inside: (c) => R.coUt(c, -20, -40, 1.15, { t: T, laugh: clamp((lt - 3.3) / 0.2), handA: [100, -90], handB: [70, -50] }) });
  }));
  const slurp = [0.5, 1.0, 1.5, 2.0].reduce((m, t0) => Math.max(m, bump(lt, t0 - 0.1, 0.3)), 0);
  const down = ease.inOut(clamp((lt - 2.3) / 0.4));
  const sniff = ease.out(clamp((lt - 2.7) / 0.3));
  const fs = 1.15, fx = 600, fy = 900;
  Pp.face(ctx, fx, fy + slurp * 10, fs, {
    t: T, mouth: down > 0.5 ? 'smile' : 'o', mOpen: 0.4, open: down > 0.5 ? 0 : 0.5, happyClosed: down > 0.5, blush: 0.8,
    tilt: down > 0.5 ? Math.sin(T * 5) * 0.06 : -slurp * 0.05,
  });
  if (down > 0.5) {
    // broth dots at the mouth corners
    ctx.fillStyle = 'rgba(210,140,50,0.85)'; ell(ctx, fx - 70, fy + 165, 7, 5); ctx.fill(); ell(ctx, fx + 64, fy + 160, 5, 4); ctx.fill();
  }
  // bowl up to the mouth, then lowered
  R.bowl(ctx, fx, lerp(1330, 1960, down) - slurp * 20, 1.55, { rot: lerp(-0.22 - slurp * 0.08, 0, down), k: 0.35, fill: FULL({ broth: lerp(0.9, 0.4, clamp(lt / 2.3)), toppings: 5, chili: 3 }) });
  steam(ctx, T, 97, fx, lerp(1130, 1700, down), 400, 600, 8, 0.35);
  if (slurp > 0.6) for (let i = 0; i < 6; i++) { const r = rng(i + ((T * 4) | 0)); ell(ctx, fx + (r() - 0.5) * 260, fy + 120 - r() * 100, 6, 6); ctx.fillStyle = 'rgba(240,190,110,0.8)'; ctx.fill(); }
  if (sniff > 0) {
    const sx = fx + 40, sy = lerp(1500, fy + 110, sniff);
    P.hand(ctx, sx + 130, sy + 110, 1.3, -0.5, 'fist', TOUR_SKIN);
    P.spoon(ctx, sx, sy, 1.4, -0.6, 0.6, '#c98a3a');
    if (lt > 2.8) { ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,0.75)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(fx, fy + 90, 140 + i * 24 + (T * 60 % 24), -2.1, -1.5); ctx.stroke(); } ctx.restore(); }
  }
  Tx.line(ctx, T, 52.2, 55.8, 'Ghiền mắm rồi!', 'Hooked on mắm!', { y: LINE_Y, vsize: 76 });
}

// ============ S20 56–60 Crane up, one more bowl, end card ============
function s20(ctx, lt, p, T) {
  const up = ease.inOut(clamp(lt / 3.2));
  cam(ctx, 540, lerp(1250, 980, up), lerp(1.2, 0.95, up), 0, () => {
    river(ctx, T, { hy: 760, sunX: 540 });
    const raise = ease.outBack(clamp((lt - 0.1) / 0.4));
    R.xuong(ctx, 360, 1330, 1.2, T, { ph: 3, inside: (c) => { P.stove(c, -170, -150, 0.25, T); R.pot(c, -170, -140, 0.4, { boil: T }); R.coUt(c, -30, -40, 1.15, { t: T, laugh: 1, handA: [120, -80], handB: [80, -40] }); } });
    R.xuong(ctx, 760, 1400, 1.25, T, {
      ph: 1,
      inside: (c) => {
        Pp.tourist(c, 40, -34, 1.05, { sit: 1, raise, smile: true });
        R.bowl(c, 40 - 84 * 1.05, -34 - 300 * 1.05 - 30 * raise, 0.32, { rot: -0.3, k: 0.35, fill: R.bowlContents({ broth: 0 }) });
      },
    });
    R.wake(ctx, 560, 1440, 500, T);
    steam(ctx, T, 99, 160, 1150, 120, 400, 6, 0.35);
  });
  flare(ctx, 540, 600, 1.1, 0.5);
  dust(ctx, T, 20, 40, 0, 0, W, H, '255,225,180', 3, 0.5);
  Tx.line(ctx, T, 56.1, 57.2, 'Thêm tô nữa!', 'One more bowl!', { y: LINE_Y, vsize: 78 });
  Tx.endCard(ctx, T, 57.0, { l1: 'BÚN MẮM', l2: 'MIỀN TÂY', vi: 'Đậm đà. Mặn mà. Miền Tây.', en: 'Bold. Funky. Unforgettable.' });
  if (T > 59.4) { ctx.fillStyle = `rgba(0,0,0,${clamp((T - 59.4) / 0.6)})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20 };
