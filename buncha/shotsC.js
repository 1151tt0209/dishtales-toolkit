// Bún chả Hà Nội – shots 21–28: the tray arrives, the "do I drink it?!" gag, the first bite, end card, CTA.
const L = require('./lib');
const P = require('./props');
const Pp = require('./people');
const F = require('./food');
const Tx = require('./text');
const B = require('./bprops');
const A = require('./shotsA');
const SB = require('./shotsB');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, dust, bokeh, steam } = L;
const { ell } = P;
const { bump, darkBg, warmBokeh, bangLeaves, topBand, chaSet, coLan, tableFood, LAN_SKIN } = A;

const SAUCE_DROPS = ['#f6c272', '#e8a040', '#ffe2a0', '#c97a20'];
function desat(ctx, a) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
function shade(ctx, a) { if (a <= 0) return; ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
function softGold(ctx, a) { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = a; ctx.fillStyle = '#ffb040'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
// a pinch of bún strands hanging from (x,y), length len, swinging
function strands(ctx, x, y, len, sw = 0, n = 7, w = 5) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ox = (i - (n - 1) / 2) * w * 1.6, l = len * (0.75 + 0.25 * Math.sin(i * 2.3));
    ctx.strokeStyle = i % 2 ? '#f4f1e8' : '#e6e1d4'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x + ox * 0.4, y);
    ctx.bezierCurveTo(x + ox + sw * 20, y + l * 0.35, x + ox * 1.5 - sw * 25, y + l * 0.7, x + ox * 1.2 + sw * 30, y + l); ctx.stroke();
  }
  ctx.restore();
}
// a chopstick pinch carrying bún (+ optional patty and herb) whose tip is at (tx,ty)
function pinch(ctx, tx, ty, s, rot, o = {}) {
  F.chopsticks(ctx, tx - Math.cos(rot) * 420 * s, ty - Math.sin(rot) * 420 * s, s, rot, 0.02);
  strands(ctx, tx, ty, (o.len || 150) * s, o.sw || 0, 8, 5.5 * s);
  if (o.patty) B.pattySide(ctx, tx + 6 * s, ty + 34 * s, s * 1.0, 0.2, 0.9, 'mieng');
  if (o.herb) F.herbLeaf(ctx, tx - 26 * s, ty + 12 * s, s * 1.3, 0.9, 'kinhgioi');
  if (o.drip) for (let i = 0; i < 3; i++) {
    const ph = (o.drip * 1.6 + i / 3) % 1;
    ell(ctx, tx + (i - 1) * 14 * s, ty + (o.len || 150) * s * 0.9 + ph * 120 * s, 5 * s, 8 * s); ctx.fillStyle = `rgba(230,150,50,${1 - ph})`; ctx.fill();
  }
}

// ============ S21 60.5–63.5 Close: the tourist's wow face, the tray slides in from the bottom ============
function s21(ctx, lt, p, T) {
  P.layer(ctx, 13, (x) => cam(x, 760, 1100, 1.45, 0, () => chaSet(x, T, { table: tableFood })));
  const inK = ease.outBack(clamp((lt - 0.15) / 0.8)), zoom = lerp(1.0, 1.08, ease.inOut(p));
  cam(ctx, 540, 960, zoom, 0, () => {
    const wow = clamp((lt - 0.6) / 0.25);
    Pp.face(ctx, 540, 840 - wow * 14, 1.15, { t: T, open: 0.75 + 0.35 * wow, pupil: 1 + 0.5 * wow, brow: 0.4 + 0.6 * wow, mouth: wow > 0 ? 'o' : 'smile', mOpen: 0.25 + 0.5 * wow, blush: 0.25 + 0.4 * wow, hairLift: 0.5 * bump(lt, 0.6, 0.5), lookY: 0.6 });
    glow(ctx, 540, 1500, 700, 'rgba(255,220,150,0.9)', 0.35 * inK);
    at(ctx, 540, lerp(2400, 1560, inK), 0, 1.0, 0.5, () => SB.tray(ctx, [1, 1, 1, 1, 1], T));
    steam(ctx, T, 211, 540, 1350, 600, 700, 10, 0.3 * clamp(inK));
  });
  for (let i = 0; i < 6; i++) { const k = lt - (0.7 + i * 0.12); if (k > 0 && k < 0.5) L.sparkle(ctx, 300 + i * 95, 1450 + Math.sin(i * 1.9) * 90, 70, 1 - k / 0.5); }
  flare(ctx, 860, 420, 1.1, 0.45);
  dust(ctx, T, 212, 26, 0, 0, W, H, '255,235,190', 2.5, 0.45);
}

// ============ S22 63.5–67 Gag: the tourist lifts the sauce bowl to drink it – whip pan – cô Lan's shock ============
function s22(ctx, lt, p, T) {
  const TX = 900;
  const scene = (c, camX, zoom) => cam(c, camX, 1130, zoom, 0, () => {
    const u = ease.inOut(clamp((lt - 0.25) / 0.9)), tip = ease.inOut(clamp((lt - 1.05) / 0.6));
    const bx = lerp(735, 832, u), by = lerp(1268, 1186, u);
    const shock = lt > 2.15;
    chaSet(c, T, {
      table: (cc) => tableFood(cc, { noBowl: true }), fan: shock ? 0 : 1,
      noFan: shock, handA: shock ? [30, -150] : undefined, laugh: 0,
      tourist: { x: TX, st: { glassHand: [bx - (TX + 10) + 4, by - 1397 - 26], glassHandK: clamp(lt / 0.3), look: -0.15 * u - 0.15 * tip, smile: true } },
    });
    at(c, bx, by, -tip * 0.55, 1, 1, () => B.sauceBowl(c, 0, 0, 0.3, { patties: 3, papaya: 3, carrot: 2, k: 0.36 }));
    if (shock) {
      const k = lt - 2.15;
      for (let i = 0; i < 3; i++) {
        const pop = ease.outBack(clamp((k - i * 0.08) / 0.3));
        if (pop <= 0) continue;
        at(c, 170 + i * 42, 1010 - (i === 1 ? 26 : 0) + Math.sin(T * 20 + i) * 3, (i - 1) * 0.25, pop, pop, () => {
          c.font = '64px BodySansBold'; c.textAlign = 'center'; c.lineWidth = 7; c.strokeStyle = '#3a1a10'; c.strokeText('!', 0, 0); c.fillStyle = '#ffd84a'; c.fillText('!', 0, 0);
        });
      }
      // shock lines around the head
      c.save(); c.strokeStyle = `rgba(255,255,255,${0.7 * clamp(1 - k / 1.2)})`; c.lineWidth = 4; c.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const a = -Math.PI + i * 0.45 - 0.3, r0 = 80 + k * 30; c.beginPath(); c.moveTo(214 + Math.cos(a) * r0, 1150 + Math.sin(a) * r0); c.lineTo(214 + Math.cos(a) * (r0 + 34), 1150 + Math.sin(a) * (r0 + 34)); c.stroke(); }
      c.restore();
    }
  });
  if (lt < 1.9) scene(ctx, lerp(790, 810, lt / 1.9), lerp(1.75, 1.85, lt / 1.9));
  else if (lt < 2.15) {
    const w = ease.inOut((lt - 1.9) / 0.25);
    L.motionBlurX(ctx, 260 * Math.sin(Math.PI * w), 10, (x) => scene(x, lerp(810, 300, w), 1.8));
  } else {
    const k = lt - 2.15, kick = bump(lt, 2.15, 0.25);
    scene(ctx, 300 + kick * 14 * Math.sin(lt * 80), lerp(1.8, 2.0, ease.out(clamp(k / 0.5))));
  }
  topBand(ctx, 0.5, 520);
  Tx.line(ctx, T, 64.0, 66.9, 'Uống luôn hả?!', 'Do I drink it?!', { y: 330, vsize: 64 });
}

// ============ S23 67–70.5 Medium: cô Lan laughs, waves "no", shows how – dip the noodles ============
function s23(ctx, lt, p, T) {
  P.layer(ctx, 12, (x) => cam(x, 820, 1100, 1.6, 0, () => chaSet(x, T, { table: (c) => tableFood(c, { noBowl: true }), tourist: { x: 900, st: { look: 0.1, smile: false } } })));
  const wave = lt < 1.4, show = clamp((lt - 1.4) / 0.4);
  const dip = lt > 1.8 ? Math.max(0, Math.sin((lt - 1.8) * Math.PI / 0.9)) : 0;
  cam(ctx, 540, 1180, lerp(1.0, 1.06, ease.inOut(p)), 0, () => {
    const hA = wave ? [118 + Math.sin(lt * 15) * 26, -158] : [lerp(118, 132, show), lerp(-158, -96, show)];
    coLan(ctx, 300, 1420, 2.0, { t: T, laugh: wave ? 1 : 0.6, noFan: true, handA: hA, nod: wave ? Math.sin(lt * 9) * 0.3 : 0 });
    // foreground bowl + the demo dip
    B.sauceBowl(ctx, 770, 1700, 1.05, { k: 0.36, patties: 3, papaya: 3, carrot: 2, chili: 3, seed: 23 });
    if (!wave) {
      const hx = 300 + hA[0] * 2, hy = 1420 + hA[1] * 2;
      const tx = lerp(hx + 120, 760, show), ty = lerp(hy + 60, 1530 + dip * 40, show);
      const rot = Math.atan2(ty - hy + 40, tx - hx + 10);
      pinch(ctx, tx, ty, 0.9, rot, { len: 120 * (1 - 0.6 * dip), sw: Math.sin(lt * 4) * 0.4 });
      if (dip > 0.6) { ctx.strokeStyle = 'rgba(255,236,190,0.6)'; ctx.lineWidth = 3; ell(ctx, 760, 1590, 80 * dip, 24 * dip); ctx.stroke(); }
    }
  });
  bokeh(ctx, T * 0.4, 231, 6, ['rgba(255,220,150,0.45)'], 0.3, 40, 90);
  flare(ctx, 900, 420, 1.0, 0.35);
  topBand(ctx, 0.5, 520);
  Tx.line(ctx, T, 67.4, 70.3, '“Nhúng bún vào!”', '“Dip the noodles!”', { y: 330, vsize: 64 });
}

// ============ S24 70.5–73.5 Macro dip, then the first bite – eyes close, the world goes quiet ============
function s24(ctx, lt, p, T) {
  if (lt < 1.2) {
    warmBokeh(ctx, T, lt * 30, 241, '#4a2c14', '#120804');
    const d = Math.sin(Math.PI * clamp(lt / 1.1));
    cam(ctx, 540, 1250, lerp(1.0, 1.1, lt / 1.2), 0.03, () => {
      glow(ctx, 780, 700, 700, 'rgba(255,200,130,0.85)', 0.5);
      B.sauceBowl(ctx, 540, 1720, 2.6, { k: 0.34, patties: 3, papaya: 4, carrot: 3, chili: 4, seed: 24 });
      const tx = 560, ty = lerp(820, 1290, d);
      pinch(ctx, tx, ty, 2.0, 2.1, { len: 120 * (1 - 0.5 * d), patty: true, herb: true, drip: lt > 0.6 ? lt : 0, sw: Math.sin(lt * 3) * 0.3 });
      if (d > 0.7) { const k = (d - 0.7) / 0.3; ctx.strokeStyle = `rgba(255,236,190,${0.6 * k})`; ctx.lineWidth = 4; ell(ctx, 560, 1420, 160 * k + 40, (160 * k + 40) * 0.34); ctx.stroke(); }
      if (lt > 0.55) L.flakes(ctx, lt, 0.55, 242, 18, 560, 1380, { g: 1400, speed: 700, life: 0.8, size: 8, slow: 0.5, colors: SAUCE_DROPS });
    });
    topBand(ctx, 0.4, 480);
    return;
  }
  const k = lt - 1.2;
  warmBokeh(ctx, T, -k * 20, 243, '#5a3a1e', '#1a0e06');
  const rise = ease.inOut(clamp(k / 0.9)), bite = clamp((k - 0.9) / 0.2);
  const fy = 860, fs = 1.2;
  cam(ctx, 540, 960, lerp(1.0, 1.14, ease.inOut(clamp(k / 1.8))), 0, () => {
    Pp.face(ctx, 540, fy + bite * 6, fs, { t: T, open: 0.05, happyClosed: k > 0.9, brow: 0.7, mouth: bite > 0 ? 'sip' : 'o', mOpen: bite > 0 ? 0.3 : 0.55, blush: 0.4 + 0.5 * bite, tilt: 0.04 * Math.sin(T * 2) });
    if (bite < 1) {
      const ty = lerp(1900, fy + 140 * fs + 10, rise);
      pinch(ctx, 560, ty, 1.5, -1.35, { len: 110, patty: true, herb: true });
    }
    if (k > 1.0) steam(ctx, T, 244, 540, fy + 120, 400, 500, 8, 0.25);
  });
  glow(ctx, 540, 700, 800, 'rgba(255,220,160,0.7)', 0.4);
  // the world goes quiet: desaturate and dim before the burst
  const q = clamp((lt - 2.5) / 0.5);
  desat(ctx, q * 0.85); shade(ctx, q * 0.45);
}

// ============ S25 73.5–77 Burst of flavour: golden flash, then wide on the whole happy alley ============
function s25(ctx, lt, p, T) {
  const z = lerp(1.6, 1.15, ease.out(clamp(lt / 2.8)));
  cam(ctx, 650, 1130, z, lerp(-0.04, 0, ease.out(clamp(lt / 1.5))), () => {
    chaSet(ctx, T, { laugh: 1, smokeGold: true, table: tableFood, tourist: { x: 900, st: { raise: 1, smile: true, look: -0.1 } } });
    bangLeaves(ctx, T, 251, 10, 0.9, 1.1);
  });
  softGold(ctx, 0.45);
  if (lt < 0.9) {
    const k = clamp(lt / 0.9);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(560, 1000, 0, 560, 1000, 200 + 1400 * ease.out(k));
    g.addColorStop(0, `rgba(255,240,190,${0.95 * (1 - k)})`); g.addColorStop(0.5, `rgba(255,190,90,${0.6 * (1 - k)})`); g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  L.flakes(ctx, lt, 0.05, 252, 50, 560, 1000, { g: 300, speed: 1100, life: 1.8, size: 9, spread: TAU, colors: ['#ffe2a0', '#ffd84a', '#ffb040', '#fff4d0'] });
  for (let i = 0; i < 7; i++) { const ph = (T * 0.9 + i / 7) % 1; L.sparkle(ctx, 120 + i * 140, 700 + Math.sin(i * 2.7) * 300, 60, Math.sin(ph * Math.PI) * 0.8); }
  flare(ctx, 900, 300, 1.2, 0.5);
  topBand(ctx, 0.45, 520);
  Tx.line(ctx, T, 74.0, 76.8, 'Ngon hết nấc!', 'Next-level good!', { y: 360, vsize: 72, serif: true });
}

// ============ S26 77–81 Close: the tourist slurps, bowls pile up on the beat ============
function s26(ctx, lt, p, T) {
  P.layer(ctx, 12, (x) => cam(x, 300, 1100, 1.6, 0, () => chaSet(x, T, { laugh: 1, table: tableFood })));
  const n = 1 + [78, 79, 80].filter(t => T >= t).length, last = [77, 78, 79, 80][n - 1];
  const pop = n === 1 ? 1 : ease.outBack(clamp((T - last) / 0.3));
  cam(ctx, 560, 1000, lerp(1.04, 1.0, ease.inOut(p)), lerp(0.02, -0.02, p), () => {
    const cyc = (lt % 1.0), suck = cyc < 0.6 ? cyc / 0.6 : 1;
    const fx = 640, fy = 860, fs = 1.15, mx = fx - 10, my = fy + 140 * fs;
    Pp.face(ctx, fx, fy, fs, { t: T, open: 0.2, happyClosed: true, brow: 0.6, mouth: 'sip', mOpen: 0.5, blush: 0.9, tilt: -0.05 + Math.sin(T * 5) * 0.03, hairLift: 0.2 * Math.sin(T * 8) });
    // noodle strands being sucked up into the mouth
    if (cyc < 0.7) {
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const len = (1 - ease.in(suck)) * 620 + 30, ox = (i - 2.5) * 10, wig = Math.sin(lt * 30 + i) * 22 * (1 - suck);
        ctx.strokeStyle = i % 2 ? '#f4f1e8' : '#e3ddcf'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(mx + ox * 0.4, my); ctx.bezierCurveTo(mx + ox + wig, my + len * 0.4, mx + ox * 2 - wig, my + len * 0.7, mx + ox * 2.5 + wig, my + len); ctx.stroke();
      }
      ctx.restore();
      if (suck > 0.9) for (let i = 0; i < 3; i++) { ell(ctx, mx + (i - 1) * 40, my - 20 - (suck - 0.9) * 300, 5, 7); ctx.fillStyle = 'rgba(240,170,70,0.8)'; ctx.fill(); }
    }
    B.bowlStack(ctx, 230, 1720, 1.0, n, pop);
    if (n > 1 && T - last < 0.3) L.sparkle(ctx, 230, 1720 - (n - 1) * 46 - 60, 90, 1 - (T - last) / 0.3);
  });
  flare(ctx, 880, 420, 1.0, 0.35);
  topBand(ctx, 0.5, 520);
  Tx.line(ctx, T, 78.6, 80.9, 'Thêm bát nữa!', 'One more bowl!', { y: 330, vsize: 66 });
}

// ============ S27 81–84.5 Crane up over the smoky alley, end card ============
function s27(ctx, lt, p, T) {
  const up = ease.inOut(clamp(lt / 3.2));
  cam(ctx, 560, lerp(1200, 560, up), lerp(1.6, 0.92, up), 0, () => {
    chaSet(ctx, T, {
      laugh: 0.7, smokeGold: true,
      table: (c) => { tableFood(c); B.bowlStack(c, 760, 1262, 0.16, 3, 1); },
      tourist: { x: 900, st: { smile: true, raise: 0.4 } },
    });
    bangLeaves(ctx, T, 271, 12, 0.85, 1.0);
  });
  softGold(ctx, 0.3);
  flare(ctx, 900, 260, 1.2, 0.5);
  Tx.endCard(ctx, T, 82.0, { l1: 'BÚN CHẢ', l2: 'HÀ NỘI', vi: 'Khói. Thơm. Đậm vị Hà Nội.', en: 'Smoky. Sweet. Pure Hanoi.' });
}

// ============ S28 84.5–90 CTA: LIKE heart + FOLLOW pill pressed, tourist grins & winks ============
const SK = ['#f7d2b5', '#e3a07e', '#c97c5e'];
function heartPath(ctx, r) {
  ctx.beginPath(); ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.25, r * 0.1, -r * 1.05, -r * 0.95, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 1.05, -r * 0.95, r * 1.25, r * 0.1, 0, r * 0.95); ctx.closePath();
}
function cta(ctx, T) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hk = T - 84.7;
  if (hk > 0) {
    const pop = ease.outBack(clamp(hk / 0.45)), ph = ((T - 85.2) % 0.5 + 0.5) % 0.5;
    const pulse = T > 85.2 ? 1 + 0.09 * Math.sin(Math.PI * clamp(ph / 0.22)) : 1;
    ctx.save(); ctx.translate(330, 760); ctx.scale(pop * pulse, pop * pulse);
    ctx.shadowColor = 'rgba(254,44,85,0.75)'; ctx.shadowBlur = 50;
    heartPath(ctx, 110); const hg = ctx.createLinearGradient(0, -110, 0, 110); hg.addColorStop(0, '#ff6a86'); hg.addColorStop(1, '#e0143f');
    ctx.fillStyle = hg; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-48, -38, 22, 13, -0.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    ctx.restore();
    const la = clamp((hk - 0.25) / 0.3);
    ctx.globalAlpha = la; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12;
    ctx.font = '46px BodySansBold'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THÍCH', 330, 912);
    ctx.font = '32px BodySans'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('LIKE', 330, 960);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const k = T - (84.95 + i * 0.5); if (k < 0 || k > 0.9) continue;
      ctx.globalAlpha = 1 - k / 0.9; ctx.font = `${54 - k * 10}px BodySansBold`; ctx.fillStyle = '#ff4f73';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8;
      ctx.fillText('+1', 330 + 60 + Math.sin(i * 2.1) * 30, 640 - ease.out(k / 0.9) * 170);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  }
  const fk = T - 85.2;
  if (fk > 0) {
    const pressed = T >= 86.0, press = T > 85.92 && T < 86.18 ? 0.9 : 1;
    const sx = lerp(600, 0, ease.outBack(clamp(fk / 0.5)));
    ctx.save(); ctx.translate(700 + sx, 760); ctx.scale(press, press);
    const w = 360, h = 124;
    ctx.shadowColor = pressed ? 'rgba(0,0,0,0.5)' : 'rgba(254,44,85,0.7)'; ctx.shadowBlur = 36;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = pressed ? '#3a3a3c' : '#fe2c55'; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    if (!pressed) {
      ctx.font = '46px BodySansBold'; ctx.fillText('THEO DÕI', 0, -14);
      ctx.font = '28px BodySans'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('FOLLOW', 0, 30);
    } else {
      ctx.strokeStyle = '#7dffa0'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-150, -16); ctx.lineTo(-134, 0); ctx.lineTo(-108, -32); ctx.stroke();
      ctx.font = '38px BodySansBold'; ctx.fillText('ĐÃ THEO DÕI', 18, -14);
      ctx.font = '26px BodySans'; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillText('FOLLOWING', 18, 28);
    }
    ctx.restore();
    const ck = T - 86.0;
    if (ck > 0 && ck < 1.4) {
      glow(ctx, 700, 760, 320, 'rgba(255,240,220,1)', 0.6 * Math.max(0, 1 - ck / 0.35));
      const r = rng(77), cols = ['#fe2c55', '#ffd84a', '#25f4ee', '#ffffff', '#7dffa0'];
      for (let i = 0; i < 46; i++) {
        const a = r() * TAU, v = 380 + r() * 520, x = 700 + Math.cos(a) * v * ck, y = 760 + Math.sin(a) * v * ck * 0.8 + 600 * ck * ck;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - ck / 1.4); ctx.translate(x, y); ctx.rotate(r() * 6 + ck * (6 + r() * 8));
        ctx.fillStyle = cols[i % 5]; ctx.fillRect(-9, -5, 18, 10); ctx.restore();
      }
    }
  }
  const hk2 = T - 85.55;
  if (hk2 > 0 && hk2 < 1.4) {
    const inK = ease.out(clamp(hk2 / 0.45)), outK = ease.in(clamp((hk2 - 0.85) / 0.5));
    const tx = 735, ty = 790 + (1 - inK) * 700 + outK * 900;
    const th = -1.85, s = 1.25, c = Math.cos(th), sn = Math.sin(th);
    const ox = tx - s * (90 * c + 22 * sn), oy = ty - s * (90 * sn - 22 * c), wx = ox - s * 55 * c, wy = oy - s * 55 * sn;
    P.forearm(ctx, wx - c * 900, wy - sn * 900, wx, wy, SK[1], '#2f8f8a', 78 * s);
    P.hand(ctx, ox, oy, s, th, 'point', SK);
  }
  ctx.restore();
  Tx.line(ctx, T, 85.0, 89.4, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { y: 500, vsize: 60 });
  Tx.line(ctx, T, 86.5, 89.4, 'Món tiếp theo là gì? Comment nhé!', 'Which dish next? Tell us in the comments!', { y: 1390, vsize: 56, esize: 38 });
  const la = Tx.fadeIO(T, 85.4, 89.4, 0.5, 0.3);
  if (la > 0) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = la; ctx.shadowColor = 'rgba(255,150,40,0.6)'; ctx.shadowBlur = 24;
    ctx.font = '58px TitleSerif'; ctx.letterSpacing = '10px'; ctx.fillStyle = '#f2c25a'; ctx.fillText('DISH TALES', W / 2, 1515);
    ctx.shadowBlur = 0; ctx.letterSpacing = '0px'; ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(W / 2 - 230, 1513, 40, 3); ctx.fillRect(W / 2 + 190, 1513, 40, 3);
    ctx.restore();
  }
}
function s28(ctx, lt, p, T) {
  P.layer(ctx, 14, (x) => cam(x, 640, 1100, lerp(1.3, 1.4, p), 0, () => chaSet(x, T, { laugh: 0.6, smokeGold: true, table: tableFood })));
  shade(ctx, lerp(0.35, 0.55, clamp(lt / 1.5)));
  const wink = T > 86.5 && T < 86.9;
  const bob = Math.sin(T * 6.283) * 6;
  Pp.face(ctx, 540, 1150 + bob, 0.75, { t: T, mouth: 'grin', mOpen: 0.6, open: 0.9, openR: wink ? 0 : undefined, brow: wink ? 0.8 : 0.5, blush: 0.6, tilt: wink ? -0.08 : Math.sin(T * 3) * 0.04, lookX: -0.2 });
  const tk = ease.outBack(clamp((T - 85.0) / 0.4));
  if (tk > 0) Pp.thumbsUp(ctx, 830, 1240 + (1 - tk) * 400, 0.9 * tk, -0.15 + Math.sin(T * 6.283) * 0.05);
  cta(ctx, T);
  const fb = clamp((T - 89.4) / 0.6);
  if (fb > 0) shade(ctx, fb);
}

module.exports = { s21, s22, s23, s24, s25, s26, s27, s28 };
