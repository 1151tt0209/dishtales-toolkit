// Bánh tráng trộn Sài Gòn: shots 11–20 (rest of Act II + opening of Act III). 150 BPM grid: beat = 0.4 s.
'use strict';
const L = require('./lib');
const X = require('./text');
const TP = require('./tprops');
const P = require('./people');
const { W, H, TAU, clamp, lerp, ease, cam, at, glow, godRays, dust, bokeh, sparkle, rng, createCanvas } = L;
const C = TP.COL;

// ---------------------------------------------------------------- helpers
const beat = T => ((T / 0.4) % 1 + 1) % 1;          // 0 on the beat
const hitK = T => Math.pow(1 - beat(T), 3);          // decaying hit
const iv = (a, b, v) => clamp((v - a) / (b - a));
function cap(ctx, T, lt, dur, vi, en, n) { const s0 = T - lt; X.caption(ctx, T, s0 + 0.15, s0 + dur - 0.1, vi, en, { n }); }

// warm dark studio backdrop with amber backlight and bokeh (slow-mo macro shots)
function warmBack(ctx, t, seed, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, o.top || '#5a321a'); g.addColorStop(0.5, o.mid || '#2c1a12'); g.addColorStop(1, o.bot || '#0d2228');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  glow(ctx, o.gx ?? 800, o.gy ?? 380, o.gr ?? 950, 'rgba(255,170,80,0.6)', o.ga ?? 1);
  glow(ctx, 160, 1500, 700, 'rgba(40,140,150,0.35)', 1);
  bokeh(ctx, t, seed, 24, ['rgba(255,190,110,0.85)', 'rgba(255,140,70,0.7)', 'rgba(90,180,190,0.55)', 'rgba(255,230,170,0.8)'], 0.32, 30, 120);
}
// áo bà ba arm + gloved hand holding a spoon. Bowl centre at (x,y), S scale, mir=-1: arm comes from the right.
// Returns the screen point of the pouring lip.
function spoonRig(ctx, x, y, S, rot, mir, fill, tip) {
  at(ctx, x, y, 0, S * mir, S, () => {
    ctx.rotate(rot);
    const wx = -192, wy = -8;
    TP.cArm(ctx, -700, -60, -440, 46, wx, wy, { wu: [74, 62], wf: [56, 40], skin: TP.SKIN_BA, sleeve: TP.floral(ctx, 46), sleeveTo: 1.7, cuff: C.aobabaD });
    TP.spoon(ctx, 0, 0, 1, 0, { fill, tip });
    TP.cHand(ctx, wx, wy, 1.05, 0, { kind: 'grip', glove: true });
  });
  const [lx, ly] = TP.rot2(rot, 36, 4);
  return [x + lx * S * mir, y + ly * S];
}
// big slow-mo droplet (calamansi juice / oil)
function bigDrop(ctx, x, y, r, rot, col0, col1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(0, -r * 1.75);
  ctx.bezierCurveTo(r * 0.85, -r * 0.6, r * 1.02, r * 0.1, r, r * 0.35);
  ctx.arc(0, r * 0.35, r, 0, Math.PI);
  ctx.bezierCurveTo(-r * 1.02, r * 0.1, -r * 0.85, -r * 0.6, 0, -r * 1.75); ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.3, 0, r * 0.1, 0, r * 0.2, r * 1.4);
  g.addColorStop(0, col0); g.addColorStop(1, col1);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,225,0.85)'; ctx.lineWidth = Math.max(1.5, r * 0.06); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 0.05, r * 0.16, r * 0.34, 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(r * 0.4, r * 0.75, r * 0.22, r * 0.08, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
}
// small steel bowl seen from above, holding an ingredient
function topBowl(ctx, x, y, r, kind) {
  ctx.save();
  ctx.fillStyle = 'rgba(25,30,40,0.35)'; ctx.beginPath(); ctx.ellipse(x + 14, y + 18, r * 1.04, r * 1.04, 0, 0, TAU); ctx.fill();
  let g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.7, '#b9c0c6'); g.addColorStop(1, '#6f777e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  g = ctx.createRadialGradient(x + r * 0.2, y + r * 0.2, r * 0.1, x, y, r * 0.84);
  g.addColorStop(0, '#d8dde1'); g.addColorStop(1, '#7c858c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.84, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, TAU); ctx.clip();
  const s = r / 95;
  if (kind === 'herbs') TP.rauRam(ctx, x, y + 20 * s, s * 1.1, 0, { chopped: true, n: 26, seed: 3, spread: 1.1 });
  else if (kind === 'peanuts') TP.peanuts(ctx, x, y + 14 * s, s * 1.2, { n: 40, seed: 5, spread: 1.25 });
  else TP.friedShallots(ctx, x, y + 14 * s, s * 1.2, { n: 46, seed: 6, spread: 1.25 });
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 0.92, -2.6, -1.2); ctx.stroke();
  ctx.restore();
}
function sunRays(ctx, x, y, ang, t, a = 1) {
  godRays(ctx, x, y, ang, 0.75, 1800, 7, 'rgba(255,205,130,0.55)', 0.32 * a, t);
}
const ALL_LAYERS = ['strips', 'mango', 'jerky', 'squid', 'eggs', 'sate', 'salt', 'tac', 'scallion', 'herbs', 'peanuts', 'shallots'];

// ---------------------------------------------------------------- 11. Sa tế (macro, slow-mo)
function s11(ctx, lt, p, T) {
  const z = lerp(1.04, 1.15, ease.inOut(p));
  const pourK = iv(0.3, 1.1, lt), tip = iv(0.5, 3.0, lt);
  const rot = lerp(0.12, 0.72, ease.inOut(pourK)) + tip * 0.2 + Math.sin(lt * 1.7) * 0.02;
  const bx = 520 + Math.sin(lt * 0.9) * 6, by = lerp(600, 620, p);
  const mouth = [575, 1215 - 128 * 2.15];
  cam(ctx, 560, lerp(960, 920, p), z, lerp(-0.012, 0.01, p), () => {
    TP.counterTop(ctx, T);
    TP.chiliOilJar(ctx, 170, 1350, 1.2, {});
    glow(ctx, mouth[0], mouth[1], 230, 'rgba(255,110,50,0.75)', 0.25 + 0.35 * hitK(T));
    TP.plasticBag(ctx, 570, 1215, 2.15, { open: 1, fill: 0.86, mix: 0, t: lt * 0.3 });
    const lip = spoonRig(ctx, bx, by, 2.3, rot, 1, 'sate', tip);
    if (pourK > 0.55 && tip < 0.995) {
      ctx.save(); ctx.globalAlpha = iv(0.55, 0.8, pourK) * (1 - iv(0.9, 1, tip));
      TP.pourStream(ctx, lip[0], lip[1], mouth[0] + 6, mouth[1] + 8, 16, lt * 0.35, C.sateOil, { drops: 7 });
      ctx.restore();
      // glints sliding down the stream on the beat
      const h = hitK(T);
      for (let i = 0; i < 3; i++) { const u = (i * 0.33 + beat(T) * 0.4) % 1; sparkle(ctx, lerp(lip[0], mouth[0], u) - 4, lerp(lip[1], mouth[1], u * u * 0.4 + u * 0.6), 0.5 + h * 0.6, 0.5 + 0.5 * h); }
    }
    // slow red droplets flicking off the bowl
    if (lt > 0.9) TP.juiceDrops(ctx, lip[0] + 20, lip[1] + 10, 1.4, { t: lt * 0.4, n: 5, seed: 11, h: 210, slow: 1, col: 'rgba(225,60,25,0.92)' });
  });
  sunRays(ctx, 940, 260, 2.25, T);
  TP.sunFlare(ctx, 940, 260, 0.75, { alpha: 0.6 });
  dust(ctx, T, 111, 28, 0, 200, W, 1100, '255,215,160', 3, 0.55);
  bokeh(ctx, T, 112, 5, ['rgba(255,170,90,0.7)', 'rgba(255,220,160,0.6)'], 0.22, 90, 170);
  cap(ctx, T, lt, 3.2, 'Sa tế', 'Chili oil', 6);
}

// ---------------------------------------------------------------- 12. Muối tôm (backlit salt cloud)
function s12(ctx, lt, p, T) {
  const h = hitK(T);
  const rot = 0.5 + 0.14 * h + Math.sin(lt * 1.3) * 0.03;
  const bx = 560 + Math.sin(lt * 0.8) * 8, by = 520 - 14 * h;
  const mouth = [520, 1200 - 128 * 2.2];
  cam(ctx, 540, lerp(900, 940, p), lerp(1.15, 1.04, ease.inOut(p)), lerp(-0.02, 0.005, p), () => {
    TP.counterTop(ctx, T);
    TP.shrimpSaltJar(ctx, 900, 1360, 1.15, { open: true });
    TP.plasticBag(ctx, 520, 1200, 2.2, { open: 1, fill: 0.87, mix: 0, t: lt * 0.3 });
    glow(ctx, mouth[0], mouth[1] - 40, 260, 'rgba(255,150,90,0.6)', 0.3 + 0.3 * h);
    const lip = spoonRig(ctx, bx, by, 2.1, rot, -1, 'salt', iv(0, 3.2, lt) * 0.9);
    // wide faint haze + main cloud tapped out on the beat
    TP.saltCloud(ctx, lip[0] - 10, lip[1], 1.6, { t: lt * 0.35, k: 0.3, seed: 2, n: 200, light: 0 });
    TP.saltCloud(ctx, lip[0] - 4, lip[1], 0.95, { t: lt * 0.5, k: 0.55 + 0.45 * h, seed: 1, n: 260, light: 1 });
  });
  glow(ctx, 720, 400, 520, 'rgba(255,190,110,0.55)', 0.8);
  sunRays(ctx, 720, 330, Math.PI / 2 + 0.25, T, 1.2);
  TP.sunFlare(ctx, 720, 330, 0.65, { alpha: 0.55 + 0.2 * h });
  dust(ctx, T, 121, 50, 120, 380, 860, 760, '255,190,140', 3.2, 0.7);
  cap(ctx, T, lt, 3.2, 'Muối tôm', 'Shrimp salt', 7);
}

// ---------------------------------------------------------------- 13. Vắt tắc (macro, slow-mo)
const S13_DROPS = [[470, 0.0, 34, 0.6], [585, 0.38, 42, -0.5], [640, 0.7, 28, 0.9]];
function s13(ctx, lt, p, T) {
  const h = hitK(T);
  warmBack(ctx, T, 131, { gx: 560, gy: 520, gr: 900 });
  cam(ctx, 540, lerp(920, 880, p), lerp(1.02, 1.12, ease.inOut(p)), lerp(-0.03, 0.03, p), () => {
    glow(ctx, 540, 600, 420, 'rgba(255,200,90,0.75)', 0.8);
    TP.plasticBag(ctx, 540, 1505, 2.4, { open: 1, fill: 0.9, mix: 0, t: lt * 0.3 });
    // juice streaming + slow drops
    TP.juiceDrops(ctx, 540, 700, 1.7, { t: lt * 0.6, n: 12, seed: 4, h: 300, slow: 1 });
    const sq = 0.18 + 0.32 * h;
    TP.calamansi(ctx, 540, 610, 4.2, 0.15, { half: true, squeeze: sq });
    // gloved hand squeezing from the right + forearm out of frame
    const hx = 760 - 26 * h, hy = 560;
    TP.cArm(ctx, 1240, 180, 1060, 420, hx, hy, { wu: [130, 110], wf: [100, 80], skin: TP.SKIN_BA, sleeve: TP.floral(ctx, 70), sleeveTo: 1.6, cuff: C.aobabaD });
    TP.cHand(ctx, hx, hy, 2.3, Math.PI + 0.15, { kind: 'grip', glove: true, flip: true });
    // mist burst on each squeeze
    const r = rng(77);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 60; i++) {
      const a = Math.PI * (0.15 + r() * 0.7), d = 150 + (1 - h) * 260 * (0.4 + r());
      ctx.globalAlpha = 0.7 * h * r(); ctx.fillStyle = 'rgba(255,230,140,1)';
      ctx.beginPath(); ctx.arc(540 + Math.cos(a) * d * 1.3, 640 + Math.sin(a) * d * 0.7, 2 + r() * 4, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // hero drops tumbling in slow motion
    for (const [x0, ph, r0, sp] of S13_DROPS) {
      const u = (lt * 0.2 + ph) % 1, y = 790 + u * 420;
      ctx.globalAlpha = Math.min(1, u * 6, (1 - u) * 5);
      bigDrop(ctx, x0 + Math.sin(lt * 0.8 + ph * 9) * 12, y, r0, sp * lt * 0.6, 'rgba(255,238,160,0.92)', 'rgba(255,165,30,0.82)');
      ctx.globalAlpha = 1;
      sparkle(ctx, x0 - r0 * 0.3, y - r0 * 0.2, 0.4 + 0.7 * h, 0.4 + 0.6 * h);
    }
  });
  TP.sunFlare(ctx, 850, 260, 0.6, { alpha: 0.5 });
  dust(ctx, T, 132, 30, 0, 200, W, 1200, '255,225,150', 3, 0.5);
  cap(ctx, T, lt, 3.2, 'Vắt tắc', 'Calamansi squeeze', 8);
}

// ---------------------------------------------------------------- 14. Mỡ hành (mirror of 11, lateral dolly)
function s14(ctx, lt, p, T) {
  const pourK = iv(0.2, 1.0, lt), tip = iv(0.4, 3.0, lt);
  const rot = lerp(0.12, 0.7, ease.inOut(pourK)) + tip * 0.2 + Math.sin(lt * 1.9) * 0.02;
  const bx = 600 + Math.sin(lt * 0.9) * 6, by = lerp(610, 590, p);
  const mouth = [495, 1215 - 128 * 2.15];
  cam(ctx, lerp(590, 495, ease.inOut(p)), 930, 1.18, lerp(0.02, 0.008, p), () => {
    TP.counterTop(ctx, T);
    TP.plasticBag(ctx, 490, 1215, 2.15, { open: 1, fill: 0.88, mix: 0, t: lt * 0.3 });
    glow(ctx, mouth[0], mouth[1], 220, 'rgba(210,220,90,0.6)', 0.2 + 0.35 * hitK(T));
    const lip = spoonRig(ctx, bx, by, 2.3, rot, -1, 'scallion', tip);
    if (pourK > 0.55 && tip < 0.995) {
      ctx.save(); ctx.globalAlpha = iv(0.55, 0.8, pourK) * (1 - iv(0.9, 1, tip));
      TP.pourStream(ctx, lip[0], lip[1], mouth[0] - 4, mouth[1] + 8, 15, lt * 0.35, '#c2c043', { drops: 6, scallion: true });
      ctx.restore();
    }
    L.steam(ctx, T, 141, mouth[0], mouth[1] - 40, 260, 380, 7, 0.22);
  });
  sunRays(ctx, 960, 300, 2.3, T, 0.9);
  TP.sunFlare(ctx, 960, 300, 0.7, { alpha: 0.5 + 0.2 * hitK(T) });
  dust(ctx, T, 142, 26, 0, 200, W, 1100, '230,255,170', 3, 0.5);
  bokeh(ctx, T, 143, 5, ['rgba(200,230,120,0.6)', 'rgba(255,210,150,0.6)'], 0.2, 90, 170);
  cap(ctx, T, lt, 3.2, 'Mỡ hành', 'Scallion oil', 9);
}

// ---------------------------------------------------------------- 15. top-down: herbs, peanuts, shallots on the beat
const S15 = [
  { k: 'herbs', tk: 0.8, bx: 210 },
  { k: 'peanuts', tk: 1.6, bx: 540 },
  { k: 'shallots', tk: 2.4, bx: 870 },
];
function s15(ctx, lt, p, T) {
  const h = hitK(T), cx = 540, cy = 820;
  cam(ctx, 540, 900, 1.07 + 0.025 * h, lerp(-0.015, 0.015, p), () => {
    TP.counterTop(ctx, T, { top: true });
    for (const it of S15) topBowl(ctx, it.bx, 220, 120, it.k);
    TP.calamansi(ctx, 150, 1620, 1.6, 0.4, { half: true });
    TP.calamansi(ctx, 250, 1700, 1.5, -0.3);
    const layers = ['strips', 'mango', 'jerky', 'squid', 'eggs', 'sate', 'salt', 'tac', 'scallion'];
    let lastK = 1;
    for (const it of S15) if (lt >= it.tk) { layers.push(it.k); lastK = iv(it.tk, it.tk + 0.2, lt); }
    TP.bagMouthTop(ctx, cx, cy, 1.9, { layers, lastK, mix: 0, t: T, spin: lt * 0.05 });
    // pinch of each ingredient dropping toward the lens-side surface
    for (const it of S15) {
      const u = iv(it.tk - 0.4, it.tk, lt);
      if (u <= 0 || u >= 1) continue;
      const sc = lerp(2.7, 1.1, ease.in(u)), a = clamp(u * 4);
      ctx.save(); ctx.globalAlpha = a;
      const ox = lerp(it.bx - cx, 0, ease.out(u)) * 0.35;
      if (it.k === 'herbs') TP.rauRam(ctx, cx + ox, cy, 1.4 * sc, 0, { chopped: true, n: 16, seed: 9, spread: 1.2 });
      else if (it.k === 'peanuts') TP.peanuts(ctx, cx + ox, cy, 1.4 * sc, { n: 22, seed: 8, spread: 1.4 });
      else TP.friedShallots(ctx, cx + ox, cy, 1.4 * sc, { n: 26, seed: 7, spread: 1.4 });
      ctx.restore();
    }
    // gloved pinching hand travelling bowl -> bag on each step
    let hx = 540, hy = -200, show = false;
    for (const it of S15) {
      const a = iv(it.tk - 0.8, it.tk - 0.45, lt), b = iv(it.tk - 0.1, it.tk + 0.3, lt);
      if (lt < it.tk - 0.8 || lt > it.tk + 0.3) continue;
      show = true;
      hx = lerp(it.bx, cx + 40, ease.inOut(a)); hy = lerp(260, 520, ease.inOut(a));
      hy = lerp(hy, -60, ease.in(b)); hx = lerp(hx, cx + 200, b);
    }
    if (show) {
      TP.cArm(ctx, hx + 140, hy - 420, hx + 90, hy - 220, hx, hy - 30, { wu: [70, 60], wf: [56, 44], skin: TP.SKIN_BA, sleeve: TP.floral(ctx, 40), sleeveTo: 1.65, cuff: C.aobabaD });
      TP.cHand(ctx, hx, hy - 30, 1.6, Math.PI / 2 + 0.1, { kind: 'pinch', glove: true });
    }
  });
  glow(ctx, 860, 260, 600, 'rgba(255,190,110,0.45)', 0.6);
  dust(ctx, T, 151, 18, 0, 300, W, 1000, '255,230,180', 2.5, 0.4);
  cap(ctx, T, lt, 3.2, 'Rau răm, đậu phộng', 'Herbs, peanuts, shallots', 10);
}

// ---------------------------------------------------------------- 16. Lắc bịch! (Cô Ba shakes; flash 48.0 → inside-bag swirl)
function s16(ctx, lt, p, T) {
  const h = hitK(T);
  if (lt < 1.6) {
    const sg = Math.floor(T / 0.4) % 2 ? 1 : -1;
    const dx = Math.sin(T * 61) * 16 * h, dy = Math.cos(T * 47) * 10 * h;
    let bag = null;
    cam(ctx, 540 + dx, 930 + dy, lerp(1.04, 1.1, lt / 1.6) + 0.025 * h, 0.014 * h * sg, () => {
      TP.counterTop(ctx, T);
      const r = TP.coBa(ctx, 320, 1560, 2.9, { pose: 'shake', k: 1, t: T, gloves: true });
      bag = r.bag;
      // counter in front of her
      ctx.save(); ctx.beginPath(); ctx.rect(-200, 1180, W + 400, H); ctx.clip(); TP.counterTop(ctx, T); ctx.restore();
    });
    if (bag) {
      TP.shakeLines(ctx, bag[0], bag[1], 1.0, { t: T, k: 0.5 + 0.5 * h, dir: 'both', col: 'rgba(255,240,200,0.9)' });
      TP.whoosh(ctx, bag[0] + 60, bag[1] + 40, -0.4 + Math.sin(T * TAU * 2.5) * 0.6, 220, { k: 0.6, col: 'rgba(255,230,180,0.6)' });
    }
    TP.sunFlare(ctx, 930, 300, 0.6, { alpha: 0.45 });
  } else {
    const u = lt - 1.6, k = u / 2.4;
    warmBack(ctx, T, 161, { gx: 760, gy: 380, gr: 1000, top: '#62361a' });
    cam(ctx, 540, 820, lerp(1.0, 1.12, ease.inOut(k)), Math.sin(u * 0.9) * 0.05, () => {
      TP.confetti(ctx, 540, 820, 0.75, { t: 48 + u * 0.3, loop: true, n: 34, seed: 16, kinds: ['strip', 'mango', 'jerky', 'peanut', 'herb', 'chili'] });
      TP.plasticBag(ctx, 540, 840, 3.0, { tied: true, fill: 0.8, swirl: 1, shake: 0.55 + 0.25 * h, t: 48 + u * 0.3, mix: ease.inOut(clamp(k * 1.1)) });
    });
    TP.sunFlare(ctx, 790, 300, 0.85, { alpha: 0.6 + 0.2 * h });
    dust(ctx, T, 162, 30, 0, 200, W, 1200, '255,220,160', 3, 0.6);
  }
  cap(ctx, T, lt, 4.0, 'Lắc bịch!', 'Shake the bag!', 11);
}

// ---------------------------------------------------------------- 17. the reveal: bag opens, glossy red-orange mix, flare (no text)
function s17(ctx, lt, p, T) {
  const h = hitK(T), op = ease.out(iv(0, 0.5, lt));
  warmBack(ctx, T, 171, { gx: 800, gy: 480, gr: 1100, ga: 1.2, top: '#6a3a1c' });
  godRays(ctx, 800, 470, 2.0, 1.4, 1900, 9, 'rgba(255,200,120,0.6)', 0.35, T);
  cam(ctx, 540, lerp(760, 720, p), lerp(1.0, 1.12, ease.inOut(p)), 0, () => {
    const bx = 540, by = 1000, s = 3.0, my = by - 128 * s;
    TP.plasticBag(ctx, bx, by, s, { open: 1, fill: 0.95, mix: 1, t: lt * 0.3, glow: 1.3 });
    // tossed mix seen through the mouth
    at(ctx, bx, my + 6, 0, 1, 0.26, () => TP.bagMouthTop(ctx, 0, 0, 1.42, { layers: ALL_LAYERS, mix: 1, t: T }));
    // gloved hands pinching the rim open
    const spread = lerp(0.85, 1, op);
    for (const sd of [-1, 1]) {
      const hx = bx + sd * 300 * spread, hy = my + 4;
      TP.cArm(ctx, bx + sd * 860, my + 380, bx + sd * 560, my + 150, hx + sd * 40, hy + 40, { wu: [110, 90], wf: [84, 64], skin: TP.SKIN_BA, sleeve: TP.floral(ctx, 60), sleeveTo: 1.6, cuff: C.aobabaD });
      TP.cHand(ctx, hx + sd * 40, hy + 40, 1.9, sd > 0 ? Math.PI + 0.8 : -0.8, { kind: 'pinch', glove: true, flip: sd > 0 });
    }
    // glints on the oily surface on the beat
    const r = rng(170 + Math.floor(T / 0.4));
    for (let i = 0; i < 5; i++) sparkle(ctx, bx + (r() - 0.5) * 420, my + (r() - 0.5) * 70, 0.6 + h, 0.3 + 0.7 * h);
    L.steam(ctx, T, 172, bx, my - 60, 360, 420, 6, 0.18);
  });
  TP.sunFlare(ctx, 800, 470, 1.1, { alpha: 0.75 + 0.2 * h });
  dust(ctx, T, 173, 40, 0, 150, W, 1300, '255,215,150', 3.2, 0.65);
}

// ---------------------------------------------------------------- 18. top-down toppings + 2 skewers
function s18(ctx, lt, p, T) {
  const h = hitK(T), cx = 540, cy = 860;
  cam(ctx, 540, 920, lerp(1.13, 1.07, ease.out(p)) + 0.02 * h, lerp(0.02, -0.01, p), () => {
    TP.counterTop(ctx, T, { top: true });
    TP.traTac(ctx, 890, 400, 0.85, { level: 0.85 });
    TP.calamansi(ctx, 160, 1650, 1.6, 0.3, { half: true });
    TP.bagMouthTop(ctx, cx, cy, 1.9, { layers: lt >= 0.4 ? ALL_LAYERS.concat(['toppings']) : ALL_LAYERS, lastK: iv(0.4, 0.65, lt), mix: 1, t: T, spin: lt * 0.04 });
    // extra eggs and jerky dropping on beats
    const drops = [
      [0.8, -70, -30, 'egg', 0.4], [1.2, 80, 40, 'egg', -0.6], [1.6, -10, 90, 'jerky', 0.9], [1.6, 30, -100, 'jerky', -0.5],
    ];
    for (const [tk, ox, oy, kind, rr] of drops) {
      const u = iv(tk - 0.3, tk, lt); if (u <= 0) continue;
      const sc = lerp(2.4, 1, ease.in(u)), a = clamp(u * 4);
      const bounce = lt > tk ? Math.exp(-(lt - tk) * 8) * Math.sin((lt - tk) * 30) * 0.08 : 0;
      ctx.save(); ctx.globalAlpha = a;
      if (kind === 'egg') TP.quailEgg(ctx, cx + ox, cy + oy, 1.4 * (sc + bounce), { peel: 1, half: true, rot: rr });
      else TP.beefJerky(ctx, cx + ox, cy + oy, 1.2 * (sc + bounce), rr, { seed: 3 });
      ctx.restore();
    }
    // two skewers slide in
    const sk = [[2.0, [-120, 1560], [300, 1120], -0.95, 'egg'], [2.4, [1200, 1580], [780, 1130], -2.2, 'jerky']];
    for (const [tk, from, to, rot, food] of sk) {
      const u = iv(tk - 0.3, tk + 0.05, lt); if (u <= 0) continue;
      const e = ease.outBack(u), x = lerp(from[0], to[0], e), y = lerp(from[1], to[1], e);
      ctx.save(); ctx.globalAlpha = 0.3; ctx.filter = 'blur(6px)';
      at(ctx, x + 18, y + 22, rot, 1.6, 1.6, () => { ctx.fillStyle = '#000'; ctx.fillRect(-140, -6, 400, 12); });
      ctx.restore();
      TP.skewer(ctx, x, y, 1.6, rot, { food });
    }
  });
  glow(ctx, 860, 260, 640, 'rgba(255,190,110,0.5)', 0.6);
  dust(ctx, T, 181, 18, 0, 300, W, 1000, '255,230,180', 2.5, 0.4);
  cap(ctx, T, lt, 3.2, 'Thêm topping', 'Top it off', 12);
}

// ---------------------------------------------------------------- 19. bag + trà tắc land on the glass top, kids' hands shoot up
const KIDS19 = [[85, 1.6, 0], [190, 2.0, 1], [890, 2.4, 2], [995, 2.8, 3]];
function kidArm(ctx, x, k, t, i) {
  const sk = TP.KID_SKINS[i % TP.KID_SKINS.length];
  const top = lerp(2150, 1470 + (i % 2) * 50, ease.outBack(k)), sway = Math.sin(t * 7 + i * 2) * 24;
  const bx = x + (i < 2 ? -40 : 40), by = 1930;
  TP.cArm(ctx, bx, by + 60, lerp(bx, x + sway, 0.5) + (i < 2 ? -20 : 20), lerp(by, top, 0.5), x + sway, top, { wu: [92, 82], wf: [74, 60], skin: sk, sleeve: '#f6f5f0', sleeveTo: 0.7 });
  TP.cHand(ctx, x + sway, top, 1.75, -Math.PI / 2 + sway * 0.004, { kind: 'wave', skin: sk, flip: i % 2 === 1 });
}
function s19(ctx, lt, p, T) {
  const h = hitK(T);
  cam(ctx, lerp(470, 490, p), 1180, lerp(1.22, 1.28, p), 0, () => {
    TP.schoolStreet(ctx, T, lerp(1150, 1180, p), { cart: false, petals: 1, crowd: 0.6, fg: false });
    TP.coBa(ctx, 700, 1640, 1.45, { pose: lt > 1.4 ? 'thumbs' : 'stand', t: T, gloves: true });
    const cr = TP.btCart(ctx, 390, 1640, 1.45, { t: T, light: 1, umbrella: true });
    const topY = cr.counter ? cr.counter[1] + 6 : 1321;
    // bag lands at 0.4, tea at 1.2 (squash + bounce)
    const land = (tk, x, draw) => {
      const u = iv(tk - 0.4, tk, lt); if (u <= 0) return;
      const yo = -520 * (1 - ease.in(u)), d = lt - tk, sq = d > 0 ? 1 - 0.16 * Math.exp(-d * 7) * Math.cos(d * 22) : 1;
      ctx.fillStyle = `rgba(20,15,10,${0.35 * u})`; ctx.beginPath(); ctx.ellipse(x, topY + 2, 52, 9, 0, 0, TAU); ctx.fill();
      at(ctx, x, topY + yo, 0, 1 / Math.sqrt(sq), sq, draw);
    };
    land(0.4, 300, () => TP.plasticBag(ctx, 0, -140 * 0.44, 0.44, { tied: true, fill: 0.8, mix: 1, t: T }));
    land(1.2, 450, () => TP.traTac(ctx, 0, 0, 0.56, { level: 0.85, t: T }));
  });
    TP.fallingPetals(ctx, T, 191, 10, 0, 0, W, 1300);
  // kids pushing in from the bottom
  for (const [x, tk, i] of KIDS19) {
    const k = iv(tk, tk + 0.3, lt); if (k <= 0) continue;
    kidArm(ctx, x, k, T, i);
  }
  for (const [x, tk, i] of KIDS19) {
    const k = iv(tk - 0.2, tk + 0.1, lt); if (k <= 0) continue;
    const look = TP.KID_LOOKS[i % TP.KID_LOOKS.length], y = lerp(2150, 1960, ease.out(k));
    ctx.fillStyle = look.hc; ctx.beginPath(); ctx.arc(x + (i < 2 ? -60 : 60), y, 170, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,120,0.55)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x + (i < 2 ? -60 : 60), y, 165, -2.6, -1.0); ctx.stroke();
  }
  TP.sunFlare(ctx, 940, 240, 0.6, { alpha: 0.4 + 0.15 * h });
  cap(ctx, T, lt, 3.2, 'Kèm trà tắc', 'With iced calamansi tea', 13);
}

// ---------------------------------------------------------------- 20. unshaken bag for the tourist → bland bite
let BLUR20 = null;
function blurStreet() {
  if (BLUR20) return BLUR20;
  const src = createCanvas(W, H), sc = src.getContext('2d');
  TP.schoolStreet(sc, 60, 1250, { cart: true, petals: 0, fg: false });
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.filter = 'blur(26px)'; x.drawImage(src, 0, 0); x.filter = 'none';
  BLUR20 = c; return c;
}
function s20(ctx, lt, p, T) {
  if (lt < 1.6) {
    const k = ease.inOut(iv(0, 0.7, lt)), took = lt > 0.85;
    cam(ctx, lerp(510, 530, lt / 1.6), 1330, lerp(1.72, 1.8, lt / 1.6), 0, () => {
      TP.schoolStreet(ctx, T, 1320, { cart: true, petals: 0.6, fg: false, crowd: 0.5 });
      TP.coBa(ctx, 360, 1650, 1.05, { pose: took ? 'thumbs' : 'hand', k, t: T, gloves: true, items: !took, bag: { mix: 0, fill: 0.7 } });
      TP.touristShake(ctx, 680, 1660, 1.05, { pose: took ? 'hold' : 'stand', t: T, flip: true, bag: { mix: 0, fill: 0.7, tied: true }, face: { mouth: 'grin', lookX: -0.4 } });
    });
    TP.sunFlare(ctx, 960, 220, 0.6, { alpha: 0.45 });
    TP.fallingPetals(ctx, T, 201, 8, 0, 0, W, 1300);
  } else {
    const u = lt - 1.6;
    // blurred street close-up background
    ctx.drawImage(blurStreet(), -300, -900, W * 1.6, H * 1.6);
    glow(ctx, 900, 260, 700, 'rgba(255,180,100,0.55)', 0.8);
    const forkIn = ease.out(iv(0, 0.3, u)), chew = u > 0.3 && u < 0.65, real = iv(0.6, 0.8, u);
    const mouth = chew ? 'neutral' : real > 0 ? 'woozy' : 'o';
    const tilt = real * 0.07 + (chew ? Math.sin(u * 40) * 0.01 : 0);
    const fs = 2.0, fx = 520, fy = 700 + (chew ? Math.abs(Math.sin(u * 30)) * 6 : 0);
    cam(ctx, 540, 960, lerp(1.0, 1.06, u / 1.6), 0, () => {
      P.face(ctx, fx, fy, fs, { tilt, brow: lerp(0.2, 1, real), mouth, mOpen: mouth === 'o' ? 1 : 0, lookX: real > 0 ? lerp(0, 0.6, real) : 0, lookY: real > 0 ? 0 : 0.7, t: T });
      // fork + plain bite (no sauce: white strips only)
      const back = iv(0.3, 0.6, u);
      const gx = lerp(1040, 830, forkIn) + back * 120, gy = lerp(1420, 1140, forkIn) + back * 160, fr = Math.PI + 0.42;
      const handX = gx + Math.cos(fr) * -40, handY = gy + Math.sin(fr) * -40;
      TP.cArm(ctx, 1400, 1950, 1160, 1650, handX + 60, handY + 30, { wu: [150, 130], wf: [110, 86], skin: P.SKIN });
      TP.plasticFork(ctx, gx, gy, 2.4, fr, {});
      if (back < 0.5) at(ctx, gx, gy, fr, 2.4, 2.4, () => {
        const r = rng(20);
        for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(92 + (r() - 0.5) * 30, (r() - 0.5) * 22); ctx.rotate(r() * TAU); TP.ribbon(ctx, 30 + r() * 16, 6.5, (r() - 0.5) * 14, i % 4 === 3 ? '#cfe08a' : '#f5efe0', 'rgba(140,130,110,0.5)'); ctx.restore(); }
      });
      TP.cHand(ctx, handX, handY, 2.2, fr + Math.PI, { kind: 'grip', skin: P.SKIN, flip: true });
    });
    // little question marks pop up (comedy beat)
    if (real > 0) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '110px TitleSerif';
      [[860, 330, 0.62, 0.2], [930, 230, 0.78, -0.15]].forEach(([x, y, t0, r]) => {
        const k = ease.outBack(iv(t0, t0 + 0.25, u)); if (k <= 0) return;
        ctx.save(); ctx.translate(x, y + Math.sin(T * 4 + x) * 6); ctx.rotate(r); ctx.scale(k, k);
        ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(40,20,10,0.8)'; ctx.strokeText('?', 0, 0); ctx.fillStyle = '#ffe6b0'; ctx.fillText('?', 0, 0); ctx.restore();
      });
      ctx.restore();
    }
    X.line(ctx, T, 61.9, 63.15, 'Ủa… sao nhạt?', 'Wait… it\'s bland?');
  }
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20 };
