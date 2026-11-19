// Bún đậu mắm tôm – shots 11–20: shrimp paste, the tray, and the purple-panic-to-love arc.
const L = require('./lib');
const P = require('./props');
const R = require('./river');
const Pp = require('./people');
const F = require('./food');
const Tx = require('./text');
const A = require('./shotsA');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, motionBlurX } = L;
const { ell } = P;
const { topBand, bump, darkBg, warmBokeh, bangLeaves, streetSet, trayFull, tinyStoolTourist, noonSky, TOUR_SKIN, HANG_SKIN, HANG_SHIRT } = A;
const LINE_Y = 330;

function desat(ctx, a) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function tears(ctx, x, y, s, k, T) {
  if (k <= 0) return;
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
    const ph = (T * 1.4 + i * 0.5 + (sx > 0 ? 0.25 : 0)) % 1;
    at(ctx, x + sx * 100 * s, y + (40 + ph * 120) * s, 0, s * k, s * k, () => { ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(10, 4, 0, 10); ctx.quadraticCurveTo(-10, 4, 0, -14); ctx.fillStyle = 'rgba(170,220,255,0.9)'; ctx.fill(); ctx.globalAlpha = 1; });
  }
}
// blurred Hanoi street behind close-ups
function streetBlur(ctx, T, blur = 14, o = {}) {
  P.layer(ctx, blur, (x) => cam(x, o.cx || 560, o.cy || 1100, o.z || 1.6, 0, () => streetSet(x, T, o)));
}
// tofu held by chopsticks, dipped (purple tip)
function tofuOnSticks(ctx, x, y, s, rot, dipped) {
  F.chopsticks(ctx, x + 20 * s, y - 10 * s, s, rot, 0.04);
  F.tofu(ctx, x, y, s * 0.8, rot, { gold: 1 });
  if (dipped) { ctx.save(); ctx.globalAlpha = 0.9; ell(ctx, x - 14 * s, y + 18 * s, 26 * s, 14 * s); ctx.fillStyle = F.PASTE[1]; ctx.fill(); ell(ctx, x - 20 * s, y + 14 * s, 8 * s, 4 * s); ctx.fillStyle = F.PASTE[0]; ctx.fill(); ctx.restore(); }
}

// ============ S11 28–31 Shrimp paste, lime, sugar, chili ============
function s11(ctx, lt, p, T) {
  warmBokeh(ctx, T, -lt * 30, 81);
  glow(ctx, 760, 420, 700, 'rgba(255,215,150,0.7)', 0.7);
  const fill = ease.out(clamp((lt - 0.3) / 0.8));
  const chili = lt > 2.5 ? Math.min(6, Math.floor((lt - 2.5) / 0.05) + 1) : 0;
  cam(ctx, 540, 1150, lerp(1.0, 1.08, p), 0, () => {
    const g = ctx.createLinearGradient(0, 1250, 0, 1920); g.addColorStop(0, '#6a4424'); g.addColorStop(1, '#2a180a'); ctx.fillStyle = g; ctx.fillRect(-200, 1300, 1480, 900);
    const topY = 1500 - 70 * 3.2;
    F.mamBowl(ctx, 540, 1500, 3.2, { fill, foam: 0, chili, lime: lt > 1.9, k: 0.45 });
    // gloopy purple pour from a jar
    const pourOn = clamp((lt - 0.3) / 0.1) * clamp((1.0 - lt) / 0.15);
    if (pourOn > 0) {
      at(ctx, 430, 520, -1.1 * pourOn, 1.3, 1.3, () => { ctx.fillStyle = 'rgba(230,235,240,0.85)'; ctx.beginPath(); ctx.roundRect(-70, -200, 140, 200, 20); ctx.fill(); ctx.fillStyle = F.PASTE[1]; ctx.fillRect(-62, -110, 124, 102); ctx.fillStyle = '#c0392b'; ctx.fillRect(-74, -220, 148, 30); });
      ctx.save(); ctx.globalAlpha = pourOn; ctx.lineCap = 'round'; ctx.strokeStyle = F.PASTE[1]; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.moveTo(500, 560); ctx.bezierCurveTo(560, 700, 520 + Math.sin(T * 9) * 10, 1000, 540, topY + 30); ctx.stroke();
      ctx.strokeStyle = F.PASTE[0]; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(494, 570); ctx.bezierCurveTo(552, 700, 512, 1000, 532, topY + 30); ctx.stroke(); ctx.restore();
    }
    // lime squeeze
    if (lt > 1.35 && lt < 2.0) {
      const sq = bump(lt, 1.45, 0.4);
      at(ctx, 660, 820, 0.3, 1.8, 1.8 * (1 - sq * 0.3), () => { ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#5aa02c'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#d6ec8a'; ctx.fill(); });
      P.hand(ctx, 700, 760, 1.5, 0.4, 'fist', HANG_SKIN);
      if (sq > 0.2) for (let i = 0; i < 8; i++) { const k = ((T * 3 + i / 8) % 1); ell(ctx, 650 + (i - 4) * 8, 880 + k * (topY - 860), 4, 7); ctx.fillStyle = 'rgba(230,250,190,0.9)'; ctx.fill(); }
    }
    // sugar sprinkle
    if (lt > 2.0 && lt < 2.5) { const r = rng(((T * 20) | 0)); for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(500 + (r() - 0.5) * 120, 700 + r() * (topY - 700), 4, 4); } L.sparkle(ctx, 540, topY, 70, bump(lt, 2.05, 0.4)); }
    if (lt > 2.4 && lt < 2.8) for (let i = 0; i < 4; i++) { const k = (lt - 2.4 - i * 0.05) / 0.25; if (k > 0 && k < 1) R.chiliSlice(ctx, 470 + i * 45, lerp(650, topY + 20, k * k), 2.4); }
  });
  Tx.caption(ctx, T, 28.15, 30.9, 'Mắm tôm', 'Shrimp paste', { n: 7 });
}

// ============ S12 31–34 Whip till foamy ============
function s12(ctx, lt, p, T) {
  warmBokeh(ctx, T, 0, 83);
  glow(ctx, 300, 400, 800, 'rgba(255,215,150,0.6)', 0.6);
  const speed = 6 + lt * lt * 6, ang = T * speed + lt * lt * lt * 4;
  const foam = ease.inOut(clamp(lt / 2.6));
  const shake = lt > 2.0 ? Math.sin(T * 80) * (lt - 2.0) * 6 : 0;
  cam(ctx, 540 + shake, 1150, lerp(1.05, 1.18, ease.inOut(p)), 0, () => {
    const g = ctx.createLinearGradient(0, 1250, 0, 1920); g.addColorStop(0, '#6a4424'); g.addColorStop(1, '#2a180a'); ctx.fillStyle = g; ctx.fillRect(-200, 1300, 1480, 900);
    const topY = 1500 - 70 * 3.2;
    F.mamBowl(ctx, 540, 1500, 3.2, { fill: 1 + foam * 0.15, foam, chili: 6, k: 0.45 });
    // chopsticks whisk in a circle
    const cx = 540 + Math.cos(ang) * 120, cy = topY + Math.sin(ang) * 40;
    for (let i = 3; i >= 0; i--) { ctx.save(); ctx.globalAlpha = i === 0 ? 1 : 0.18; const a2 = ang - i * 0.25; F.chopsticks(ctx, 540 + Math.cos(a2) * 120, topY + Math.sin(a2) * 40 - 10, 1.4, -1.25 + Math.cos(a2) * 0.12, 0.04); ctx.restore(); }
    P.hand(ctx, cx + 230, cy - 520, 1.5, -1.2, 'fist', HANG_SKIN);
    // foam bubbles popping up
    const r = rng(((T * 12) | 0));
    for (let i = 0; i < 20 * foam; i++) { ell(ctx, 540 + (r() - 0.5) * 520, topY - r() * 60 * foam, 4 + r() * 6, 4 + r() * 6); ctx.strokeStyle = 'rgba(240,220,245,0.8)'; ctx.lineWidth = 2; ctx.stroke(); }
    // speed lines
    if (lt > 1.2) { ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.4 * clamp(lt - 1.2)})`; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 6; i++) { const a = ang + i; ctx.beginPath(); ctx.ellipse(540, topY, 330 + i * 18, 110 + i * 8, 0, a, a + 0.6); ctx.stroke(); } ctx.restore(); }
  });
  Tx.caption(ctx, T, 31.15, 33.9, 'Đánh bông', 'Whip till foamy', { n: 8 });
}

// ============ S13 34–38 Arrange the tray (top-down, on beats) ============
function s13(ctx, lt, p, T) {
  darkBg(ctx, '#5a3a20', '#1c1008');
  glow(ctx, 820, 240, 900, 'rgba(255,230,170,0.7)', 0.6);
  const beats = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
  const k = (i) => ease.outBack(clamp((lt - beats[i]) / 0.25));
  const fall = (i) => clamp((lt - (beats[i] - 0.25)) / 0.25);
  cam(ctx, 540, 960, lerp(1.0, 1.1, ease.inOut(p)), lerp(-0.04, 0.04, p), () => {
    F.me(ctx, 540, 960, 1.15, 420, (c) => {
      F.bananaLeaf(c, 0, 0, 1, 0.3, 1);
      const items = [
        (s) => { for (let i = 0; i < 4; i++) F.bunLa(c, -200 + (i % 2) * 95, -150 + Math.floor(i / 2) * 95, s, 0.05 * i); },
        (s) => { for (let i = 0; i < 5; i++) F.tofu(c, 40 + (i % 3) * 85, -190 + Math.floor(i / 3) * 90, 0.9 * s, 0.1 * i); },
        (s) => { for (let i = 0; i < 3; i++) F.chaCom(c, -230 + i * 75, 110 + (i % 2) * 34, 1.1 * s, 0.3 * i); },
        (s) => { for (let i = 0; i < 5; i++) F.porkSlice(c, 20 + i * 26, 70 + i * 20, 1.2 * s, -0.4); },
        (s) => { for (let i = 0; i < 8; i++) F.herbLeaf(c, -330 + (i % 3) * 34, -60 + i * 28, 1.3 * s, i, i % 2 ? 'tiato' : 'kinhgioi'); },
        (s) => { for (let i = 0; i < 3; i++) F.cucumber(c, 300, -110 + i * 52, 1.1 * s); },
        (s) => { at(c, 230, 230, 0, s, s, () => { ell(c, 0, 0, 92, 92); c.fillStyle = '#f4f1ea'; c.fill(); c.lineWidth = 4; c.strokeStyle = '#2f5a9a'; c.stroke(); ell(c, 0, 0, 76, 76); const g = c.createRadialGradient(-20, -20, 4, 0, 0, 80); g.addColorStop(0, F.PASTE[0]); g.addColorStop(1, F.PASTE[1]); c.fillStyle = g; c.fill(); const r = rng(5); for (let i = 0; i < 40; i++) { ell(c, (r() - 0.5) * 120, (r() - 0.5) * 120, 4, 3); c.fillStyle = 'rgba(235,215,240,0.9)'; c.fill(); } for (let i = 0; i < 5; i++) { ell(c, (r() - 0.5) * 100, (r() - 0.5) * 100, 7, 7); c.fillStyle = '#d42a1e'; c.fill(); } }); },
      ];
      items.forEach((fn, i) => { const kk = k(i); if (kk > 0) fn(kk); });
    });
    beats.forEach((t0, i) => { if (lt > t0 && lt < t0 + 0.3) L.sparkle(ctx, 540 + Math.cos(i * 2.1) * 260, 960 + Math.sin(i * 2.1) * 260, 80, 1 - (lt - t0) / 0.3); });
  });
  steam(ctx, T, 71, 600, 800, 400, 600, 8, 0.25);
  dust(ctx, T, 13, 30, 0, 0, W, H, '255,225,180', 2.5, 0.4);
  Tx.caption(ctx, T, 34.15, 37.9, 'Bày mẹt', 'Arrange the tray', { n: 9 });
}

// ============ shared close-up: tourist face + tray in front ============
function faceTray(ctx, T, o) {
  streetBlur(ctx, T, 16, { tray: false, cx: 600, cy: 1000, z: 1.4 });
  Pp.face(ctx, 540 + (o.dx || 0), o.fy || 820, o.fs || 1.15, o.face);
  if (o.tears) tears(ctx, 540, o.fy || 820, o.fs || 1.15, o.tears, T);
  F.me(ctx, o.trayX === undefined ? 540 : o.trayX, 1700, 1.0, 420, trayFull, 0.42);
}

// ============ S14 38–40.5 Tray slides in: wow ============
function s14(ctx, lt, p, T) {
  const sl = ease.out(clamp(lt / 0.6));
  const wow = ease.outBack(clamp((lt - 0.5) / 0.3));
  faceTray(ctx, T, { trayX: lerp(-500, 540, sl), face: { t: T, mouth: 'o', mOpen: 0.3 + 0.5 * wow, open: 1 + 0.15 * wow, brow: wow * 0.8, pupil: 1 + wow * 0.3, blush: 0.3 } });
  if (lt > 0.6 && lt < 1.6) for (let i = 0; i < 5; i++) L.sparkle(ctx, 540 + Math.cos(i * 1.3) * 300, 1650 + Math.sin(i * 2) * 80, 80, bump(lt, 0.6 + i * 0.08, 0.6));
  flare(ctx, 820, 1600, 1.0, 0.6 * bump(lt, 0.6, 1.0));
  dust(ctx, T, 14, 30, 0, 0, W, H, '255,235,190', 3, 0.5);
}

// ============ S15 40.5–43.5 Why is it PURPLE?! ============
function s15(ctx, lt, p, T) {
  const wave = clamp((lt - 0.3) / 1.0), shock = ease.outBack(clamp((lt - 0.5) / 0.4));
  const shake = lt > 0.5 && lt < 1.5 ? Math.sin(T * 70) * 6 : 0;
  cam(ctx, 540, 960, lerp(1.0, 1.12, ease.out(clamp(lt / 1.5))), 0, () => {
    faceTray(ctx, T, { dx: shake, fy: 820 - shock * 20, tears: clamp((lt - 1.0) / 0.3), face: { t: T, open: lerp(1.1, 0.4, shock), brow: lerp(0.8, 1.3, shock), mouth: 'o', mOpen: lerp(0.4, 0.9, shock), hairLift: shock, tilt: -shock * 0.08 } });
  });
  R.smellWave(ctx, 780, 1700, 560, 960, T, wave);
  if (lt > 0.5 && lt < 1.2) { ctx.fillStyle = `rgba(180,120,200,${0.25 * (1 - (lt - 0.5) / 0.7)})`; ctx.fillRect(0, 0, W, H); }
  topBand(ctx, 0.4);
  Tx.line(ctx, T, 40.8, 43.4, 'Sao nó TÍM vậy?!', 'Why is it PURPLE?!', { y: LINE_Y, vsize: 70 });
}

// ============ S16 43.5–46.5 "Whip it up!" → splat ============
const SPLATS = [[-70, -40, 1.3], [90, -10, 1.0], [10, 70, 1.5], [-120, 90, 0.8], [130, 110, 0.9], [-30, -150, 0.7], [60, 170, 1.1]];
function s16(ctx, lt, p, T) {
  if (lt < 2.0) {
    const gest = bump(lt, 0.1, 0.8), whisk = clamp((lt - 1.1) / 0.9);
    cam(ctx, 560, 1180, 1.75, 0, () => {
      streetSet(ctx, T, { tray: true, handA: [lerp(110, 150, gest), lerp(-60, -150, gest)], laugh: gest * 0.5 });
      tinyStoolTourist(ctx, 760, T, { look: -0.1, glassHand: [-150 + Math.cos(T * 40) * 20 * whisk, -150 + Math.sin(T * 40) * 10 * whisk], glassHandK: whisk > 0 ? 1 : 0 });
      // small bowl on the table edge + whisking chopsticks
      F.mamBowl(ctx, 640, 1262, 0.45, { foam: 1, chili: 4 });
      if (whisk > 0) {
        const a = T * (20 + whisk * 30);
        F.chopsticks(ctx, 640 + Math.cos(a) * 14, 1225 + Math.sin(a) * 4, 0.35, -1.0, 0.04);
        const r = rng(((T * 15) | 0)); for (let i = 0; i < 10 * whisk; i++) F.splat(ctx, 640 + (r() - 0.5) * 120, 1200 - r() * 120 * whisk, 0.25, i + ((T * 15) | 0), 0.9);
      }
    });
    topBand(ctx);
    Tx.line(ctx, T, 43.7, 45.4, '“Đánh lên cho bông!”', '“Whip it up!”', { y: LINE_Y, vsize: 68 });
  } else {
    const l2 = lt - 2.0, hit = ease.outBack(clamp(l2 / 0.15));
    const shake = l2 < 0.4 ? Math.sin(T * 90) * (0.4 - l2) * 30 : 0;
    streetBlur(ctx, T, 16, { tray: false, cx: 600, cy: 1000, z: 1.4 });
    Pp.face(ctx, 540 + shake, 900, 1.3, { t: T, open: l2 < 0.4 ? 0 : 0.8, openR: l2 < 0.4 ? 0 : 0.35, brow: 0.9, mouth: 'o', mOpen: 0.5, blush: 0.2 });
    SPLATS.forEach(([x, y, s], i) => { F.splat(ctx, 540 + x * 1.3 + shake, 900 + y * 1.3, s * 1.6 * hit, 40 + i); });
    // drips
    for (const [t0, x] of [[0.5, -70], [0.7, 10]]) { const k = clamp((l2 - t0) / 0.5); if (k > 0) { ell(ctx, 540 + x * 1.3, 900 + 100 + k * 160, 8, 12); ctx.fillStyle = F.PASTE[1]; ctx.fill(); } }
    // splash particles
    if (l2 < 0.5) { const r = rng(3); for (let i = 0; i < 30; i++) { const a = r() * TAU, d = 200 + l2 * 1600 * r(); F.splat(ctx, 540 + Math.cos(a) * d, 900 + Math.sin(a) * d, 0.5, i, 1 - l2 * 2); } }
  }
}

// ============ S17 46.5–48.5 Wipe, dip, brave bite (silence) ============
function s17(ctx, lt, p, T) {
  streetBlur(ctx, T, 18, { tray: false, cx: 600, cy: 1000, z: 1.4 });
  const wipe = clamp((lt - 0.1) / 0.4);
  Pp.face(ctx, 540, 900, lerp(1.3, 1.42, ease.inOut(p)), { t: T, open: lt > 0.5 ? 0 : 0.7, brow: 0.6, mouth: lt > 0.8 ? 'o' : 'neutral', mOpen: lerp(0.2, 0.7, clamp((lt - 0.8) / 0.6)), blush: 0.2 });
  const clothX = lerp(1000, 80, wipe);
  SPLATS.forEach(([x, y, s], i) => { if (540 + x * 1.3 < clothX - 60) F.splat(ctx, 540 + x * 1.3, 900 + y * 1.3, s * 1.6, 40 + i, 1); });
  if (lt < 0.6) { const cx = lerp(1000, 80, wipe); ctx.fillStyle = '#e8e2d4'; ctx.beginPath(); ctx.roundRect(cx - 120, 780, 240, 260, 40); ctx.fill(); P.hand(ctx, cx, 900, 1.6, 0, 'fist', TOUR_SKIN); }
  // tofu dipped, coming to the mouth
  const come = ease.inOut(clamp((lt - 0.7) / 0.9));
  if (lt > 0.6) tofuOnSticks(ctx, lerp(820, 600, come), lerp(1560, 1110, come), 1.6, -0.3, true);
  desat(ctx, clamp((lt - 0.5) / 0.4) * 0.85);
  ctx.fillStyle = `rgba(0,0,0,${clamp((lt - 0.5) / 0.5) * 0.22})`; ctx.fillRect(0, 0, W, H);
}

// ============ S18 48.5–52 RỘP! crunch → euphoria ============
function s18(ctx, lt, p, T) {
  if (lt < 0.8) {
    // macro: the golden cube cracks open
    darkBg(ctx, '#2a1406', '#0a0502');
    const k = ease.outExpo(clamp(lt / 0.2));
    glow(ctx, 540, 960, 900 * k, 'rgba(255,200,100,0.9)', 0.7 * k);
    F.tofu(ctx, 540 - k * 120, 960, 6, -k * 0.25, { gold: 1, cut: true });
    F.tofu(ctx, 540 + k * 170, 960, 6, k * 0.2, { gold: 1 });
    L.flakes(ctx, lt, 0, 91, 60, 540, 960, { g: 900, speed: 1400, life: 1.0, size: 12, colors: ['#f7c46a', '#e8a040', '#fff0c0', '#c96a20'] });
    steam(ctx, T, 93, 540, 900, 400, 700, 10, 0.4 * k);
    return;
  }
  const l2 = lt - 0.8;
  cam(ctx, 560, 1080, lerp(1.6, 1.25, ease.out(clamp(l2 / 1.2))), 0, () => streetSet(ctx, T, { tray: false, laugh: 1 }));
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,190,80,0.45)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  bangLeaves(ctx, T, 18, 26, 1, 1.8);
  Pp.face(ctx, 540, 1000 + Math.sin(T * 6) * 8, 1.25, { t: T, mouth: 'grin', mOpen: 0.8, happyClosed: true, open: 0.2, brow: 0.8, blush: 1, hairLift: 0.5 * bump(l2, 0, 0.6), tilt: Math.sin(T * 3) * 0.06 });
  F.splat(ctx, 540 - 110, 1000 + 120, 0.5, 7); // a leftover dot on the cheek
  for (let i = 0; i < 6; i++) { const ph = (T * 0.8 + i / 6) % 1; L.sparkle(ctx, 540 + Math.cos(i * 1.7) * 330, 960 + Math.sin(i * 2.3) * 300, 60, Math.sin(ph * Math.PI)); }
  dust(ctx, T, 18, 60, 0, 0, W, H, '255,230,170', 3.5, 0.7);
  topBand(ctx);
  Tx.line(ctx, T, 49.0, 51.9, 'Giòn tan! Ngon hết nấc!', 'So crunchy! Next-level good!', { y: LINE_Y, vsize: 66 });
}

// ============ S19 52–56 Eating happily; cô Hằng laughs ============
function s19(ctx, lt, p, T) {
  P.layer(ctx, 12, (x) => cam(x, 420, 1120, 1.6, 0, () => streetSet(x, T, { tray: false, laugh: clamp((lt - 2.8) / 0.2) })));
  const bites = [0.5, 1.0, 1.5, 2.0];
  const bite = bites.reduce((m, t0) => Math.max(m, bump(lt, t0 - 0.15, 0.3)), 0);
  const fx = 620, fy = 880, fs = 1.15;
  Pp.face(ctx, fx, fy + bite * 8, fs, { t: T, mouth: bite > 0.3 ? 'o' : 'grin', mOpen: bite > 0.3 ? 0.7 : 0.5, happyClosed: true, open: 0.2, blush: 0.9, tilt: Math.sin(T * 4) * 0.05 });
  F.splat(ctx, fx - 70, fy + 175, 0.35, 9); F.splat(ctx, fx + 60, fy + 165, 0.25, 12);
  // tofu going in on each beat
  const cyc = bites.find(t0 => lt < t0 + 0.25);
  const k = cyc !== undefined ? clamp((lt - (cyc - 0.35)) / 0.35) : 0;
  tofuOnSticks(ctx, lerp(900, fx + 20, ease.in(k)), lerp(1500, fy + 150, ease.in(k)), 1.3, -0.3, true);
  for (const t0 of bites) if (lt > t0 && lt < t0 + 0.6) L.flakes(ctx, lt, t0, 60 + t0 * 10, 18, fx, fy + 160, { g: 1300, speed: 500, life: 0.6, size: 6, colors: ['#f7c46a', '#e8a040', '#fff0c0'] });
  F.me(ctx, 560, 1760, 1.0, 420, trayFull, 0.42);
  bangLeaves(ctx, T, 19, 8, 0.9, 1.2);
  topBand(ctx);
  Tx.line(ctx, T, 52.4, 55.8, 'Mê mắm tôm rồi!', 'Hooked on shrimp paste!', { y: LINE_Y, vsize: 72 });
}

// ============ S20 56–60 Crane up, another tray, end card ============
function s20(ctx, lt, p, T) {
  const up = ease.inOut(clamp(lt / 3.2));
  cam(ctx, 560, lerp(1200, 520, up), lerp(1.6, 0.9, up), 0, () => {
    streetSet(ctx, T, { tray: true, laugh: 1 });
    tinyStoolTourist(ctx, 760, T, { look: -0.15, raise: ease.outBack(clamp((lt - 0.1) / 0.4)), smile: true });
  });
  bangLeaves(ctx, T, 20, 14, 1, 1.3);
  flare(ctx, 880, 220, 1.1, 0.5);
  dust(ctx, T, 20, 40, 0, 0, W, H, '255,235,190', 3, 0.5);
  Tx.line(ctx, T, 56.1, 57.2, 'Thêm mẹt nữa!', 'Another tray!', { y: LINE_Y, vsize: 78 });
  Tx.endCard(ctx, T, 57.0, { l1: 'BÚN ĐẬU', l2: 'MẮM TÔM', vi: 'Giòn. Thơm. Đậm vị Hà Nội.', en: 'Crispy. Funky. Pure Hanoi.' });
  if (T > 59.4) { ctx.fillStyle = `rgba(0,0,0,${clamp((T - 59.4) / 0.6)})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20 };
