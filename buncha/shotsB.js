// Bún chả Hà Nội – shots 11–20: charcoal grilling, the dipping sauce, and serving the tray.
const L = require('./lib');
const P = require('./props');
const R = require('./river');
const F = require('./food');
const Tx = require('./text');
const B = require('./bprops');
const A = require('./shotsA');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, dust, bokeh, steam } = L;
const { ell } = P;
const { bump, darkBg, warmBokeh, emberBg, topBand, chaSet, woodTop, LAN_SKIN } = A;

const SAUCE_DROPS = ['#f6c272', '#e8a040', '#ffe2a0', '#c97a20'];
// glowing coal bed seen from the side (for macros)
function coalBed(ctx, T, y, heat = 1, seed = 3) {
  const r = rng(seed);
  glow(ctx, 540, y, 900, 'rgba(255,100,20,0.9)', 0.55 * heat);
  for (let i = 0; i < 26; i++) {
    const x = -60 + r() * 1200, yy = y + r() * 220, rx = 60 + r() * 70, ry = 34 + r() * 30;
    const fl = 0.6 + 0.4 * Math.sin(T * (2 + r() * 3) + i);
    ell(ctx, x, yy, rx, ry);
    const g = ctx.createRadialGradient(x - rx * 0.2, yy - ry * 0.3, 4, x, yy, rx);
    g.addColorStop(0, `rgba(255,${Math.round(150 + 80 * fl)},80,1)`); g.addColorStop(0.55, '#c8400e'); g.addColorStop(1, '#2a0e04');
    ctx.fillStyle = g; ctx.fill();
  }
}
// round aluminium serving tray (top-down, centred at origin). show[i] = 0..1 pop-in per item
function tray(ctx, show = [1, 1, 1, 1, 1], T = 0) {
  const Rr = 470;
  ctx.save(); ctx.filter = 'blur(22px)'; ell(ctx, 24, 34, Rr, Rr); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
  ell(ctx, 0, 0, Rr, Rr); const g = ctx.createRadialGradient(-160, -180, 30, 0, 0, Rr); g.addColorStop(0, '#f2f0ea'); g.addColorStop(0.7, '#b9b6ae'); g.addColorStop(1, '#8a8780'); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 14; ctx.strokeStyle = '#d8d5ce'; ell(ctx, 0, 0, Rr - 10, Rr - 10); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(80,78,72,0.4)'; ell(ctx, 0, 0, Rr - 26, Rr - 26); ctx.stroke();
  const pop = (k, x, y, fn) => { if (k <= 0) return; const sc = lerp(1.7, 1, ease.outBack(clamp(k))); ctx.save(); ctx.globalAlpha = clamp(k * 3); at(ctx, x, y, 0, sc, sc, fn); ctx.restore(); };
  pop(show[1], -150, -150, () => B.bunPlate(ctx, 0, 0, 175, 1));
  pop(show[0], 165, -100, () => B.bowlTop(ctx, 0, 0, 150, (c, iR) => B.sauceTop(c, iR, { patties: 3, mieng: 2, papaya: 5, carrot: 3, seed: 8 })));
  pop(show[2], -120, 190, () => R.basket(ctx, 0, 0, 1, 155, (c) => { for (let i = 0; i < 26; i++) { const a = i * 2.4, d = Math.sqrt((i + 0.5) / 26) * 125; F.herbLeaf(c, Math.cos(a) * d, Math.sin(a) * d, 1.15, i * 0.9, ['xalach', 'kinhgioi', 'tiato'][i % 3]); } }));
  pop(show[3], 185, 175, () => B.bowlTop(ctx, 0, 0, 78, (c, iR) => { ell(c, 0, 0, iR * 0.95, iR * 0.95); c.fillStyle = '#e8d8b0'; c.fill(); const r = rng(21); for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * iR * 0.8; if (i % 2) B.chiliRing(c, Math.cos(a) * d, Math.sin(a) * d, 0.75); else B.garlic(c, Math.cos(a) * d, Math.sin(a) * d, 1.1); } }));
  pop(show[4], -40, 380, () => F.chopsticks(ctx, -200, 0, 1, -0.12, 0.03));
}
function streetGrill(ctx, x, y, s, char, k) { A.streetGrill(ctx, x, y, s, char, k); }

// ============ S11 30–33.5 Orbit: grill set on the charcoal, white smoke bursts, fan ============
function s11(ctx, lt, p, T) {
  const orb = ease.inOut(p);
  emberBg(ctx, T, lerp(160, -160, orb), 111);
  const land = ease.in(clamp(lt / 0.55)), burst = bump(lt, 0.5, 2.2);
  const k = lerp(0.25, 0.45, orb);
  cam(ctx, lerp(470, 610, orb), 1180, lerp(1.08, 1.18, orb), lerp(-0.08, 0.08, orb), () => {
    glow(ctx, 540, 1250, 800, 'rgba(255,110,30,0.9)', 0.4 + 0.3 * burst);
    B.brazier(ctx, 540, 1500, 1.4, T, { heat: 1 + 0.5 * burst, k, seed: 11 });
    const by = 1500 - 205 * 1.4;
    streetGrill(ctx, 540, lerp(by - 420, by, land), 1.33, 0.25 + 0.15 * p, k);
    B.embers(ctx, T, 112, 50, 540, by - 40, 760, 900, 1, 1.5);
    if (lt > 0.5) L.flakes(ctx, lt, 0.55, 113, 30, 540, by, { g: 400, speed: 900, life: 1.4, size: 5, colors: ['#ffe2a0', '#ffb040', '#ff7a20'] });
    B.smoke(ctx, T, 114, 540, by - 60, 300, 1400, 12, 0.45 + 0.3 * burst, 220, '150,140,135', 1.3);
    B.smoke(ctx, T, 115, 540, by - 60, 380, 1350, 22, 0.55 + 0.4 * burst, 200, '248,246,242', 1.4);
  });
  // foreground fan, out of focus, sliding the other way (parallax sells the orbit)
  const sw = Math.sin(lt * 12.566);
  P.layer(ctx, 9, (c) => {
    c.clearRect(0, 0, W, H);
    B.fan(c, lerp(40, 160, orb), 1260, 1.35, 1.0 + sw * 0.5, 0.85 + 0.15 * sw);
    P.hand(c, lerp(20, 140, orb), 1310, 1.5, -1.1 + sw * 0.4, 'fist', LAN_SKIN, true);
    P.forearm(c, lerp(-200, -80, orb), 1620, lerp(10, 130, orb), 1330, LAN_SKIN[0], B.LAN_SHIRT, 74);
  });
  bokeh(ctx, T * 0.5, 116, 7, ['rgba(255,170,80,0.5)', 'rgba(255,220,150,0.4)'], 0.3, 40, 110);
  flare(ctx, lerp(820, 300, orb), 640, 1.0, 0.35);
  Tx.caption(ctx, T, 30.15, 33.3, 'Nướng than hoa', 'Grill over charcoal', { n: 6 });
}

// ============ S12 33.5–36.5 Macro slow-mo: caramel edges, a fat drop falls, flames leap ============
function s12(ctx, lt, p, T) {
  darkBg(ctx, '#1e0c04', '#080302');
  const fall = clamp((lt - 1.0) / 1.0), hit = lt - 2.0;
  const camY = lerp(900, 1180, ease.inOut(clamp((lt - 0.9) / 1.3)));
  cam(ctx, 540, camY, 1.0, 0.02, () => {
    glow(ctx, 760, 520, 700, 'rgba(255,190,110,0.8)', 0.55); // backlight
    B.smoke(ctx, T * 0.5, 121, 540, 900, 900, 1100, 10, 0.35, 90, '255,215,160', 1.6);
    coalBed(ctx, T, 1660, 1 + (hit > 0 ? Math.max(0, 1 - hit) * 0.8 : 0), 122);
    for (const y of [790, 1010]) P.seg(ctx, -100, y, 1180, y + 10, 26, 26, '#4a2c12');
    at(ctx, 540, 900, -0.04, 1, 1, () => {
      at(ctx, 0, 30, 0, 1.15, 2.0, () => B.pattySide(ctx, 0, 0, 6.2, 0, 0.95, 'mieng'));
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const r = rng(123);
      for (let i = 0; i < 18; i++) { const x = -330 + r() * 660, ph = (T * 0.9 + r()) % 1; ell(ctx, x, -60 + r() * 50, 8 + 12 * Math.sin(ph * Math.PI), 5 + 8 * Math.sin(ph * Math.PI)); ctx.fillStyle = `rgba(255,225,160,${0.55 * Math.sin(ph * Math.PI)})`; ctx.fill(); }
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,190,90,0.55)'; ctx.beginPath(); ctx.moveTo(-360, -48); ctx.quadraticCurveTo(0, -112, 360, -40); ctx.stroke();
      ctx.restore();
    });
    P.seg(ctx, -100, 910, 1180, 924, 28, 28, '#2e1a0a');
    // fat drop: forms (0.2–1.0), falls in slow-mo (1.0–2.0)
    const form = clamp((lt - 0.2) / 0.8);
    const dx = 600, dy0 = 975;
    if (lt < 2.0) {
      const dy = dy0 + form * 14 + 660 * fall * fall;
      at(ctx, dx, dy, 0, 1, 1 + fall * 0.4, () => {
        const sz = 10 + 16 * form, tip = sz * (fall > 0 ? 1.2 : 0.6);
        ctx.beginPath(); ctx.moveTo(0, -tip); ctx.quadraticCurveTo(sz, sz * 0.4, 0, sz); ctx.quadraticCurveTo(-sz, sz * 0.4, 0, -tip);
        const g = ctx.createLinearGradient(-sz, 0, sz, 0); g.addColorStop(0, '#ffe1a0'); g.addColorStop(1, '#c97a20'); ctx.fillStyle = g; ctx.fill();
        ell(ctx, -sz * 0.3, 0, sz * 0.2, sz * 0.35); ctx.fillStyle = '#fff8e0'; ctx.fill();
      });
      glow(ctx, dx, dy, 90, 'rgba(255,220,140,0.9)', 0.35 * form);
    }
    if (hit > 0) {
      const k = clamp(hit / 1.0);
      B.flames(ctx, T * 0.4, 124, dx, 1660, 520, 820 * ease.outExpo(clamp(hit / 0.25)) * (1 - 0.5 * k) + 100, 1);
      L.flakes(ctx, hit, 0, 125, 30, dx, 1640, { g: 500, speed: 900, life: 1.0, size: 7, slow: 0.6, colors: ['#ffe2a0', '#ffb040', '#ff7a20'] });
    }
    B.embers(ctx, T * 0.5, 126, 40, 540, 1450, 1100, 1100, 1, 2.0);
  });
  if (hit > 0) flare(ctx, 600, 1300, 1.3, 0.7 * Math.max(0, 1 - hit / 0.9));
  flare(ctx, 820, 420, 0.9, 0.3);
  topBand(ctx, 0.4, 500);
  Tx.caption(ctx, T, 33.65, 36.3, 'Cháy cạnh', 'Caramelized edges', { n: 7, y: 330 });
}

// ============ S13 36.5–39.5 Medium: the grill lifts and flips (scaleX = cos), darker gold side ============
function s13(ctx, lt, p, T) {
  warmBokeh(ctx, T, -lt * 40, 131, '#3a2210', '#0e0703');
  const u = ease.inOut(clamp((lt - 0.55) / 1.0));
  const lift = Math.sin(Math.PI * clamp((lt - 0.4) / 1.4)) * 230;
  const landed = lt - 1.8, thud = bump(lt, 1.78, 0.2);
  const k = 0.4, gs = 1.25;
  cam(ctx, 540, 1250 + thud * 10, lerp(1.0, 1.12, ease.inOut(p)), lerp(0.03, -0.02, p), () => {
    glow(ctx, 540, 1450, 760, 'rgba(255,110,30,0.9)', 0.45 + 0.25 * thud);
    B.brazier(ctx, 540, 1700, 1.3, T, { heat: 1.1 + 0.6 * thud, k: 0.36, seed: 13 });
    const gy = 1700 - 205 * 1.3 - lift, c = Math.cos(Math.PI * u);
    at(ctx, 540, gy, 0, Math.abs(c) < 0.04 ? 0.04 : c, 1, () => {
      B.grill(ctx, 0, 0, gs, 0, {
        fold: 1, k, shadow: false, char: c < 0 ? 0.9 : 0.55, back: c < 0 ? 0.6 : 0,
        items: (cc) => { const ch = c < 0 ? 0.95 : 0.6; for (let i = 0; i < 4; i++) B.patty(cc, -95 + i * 64, -40, 1, i, ch, 'vien', i + (c < 0 ? 21 : 1)); for (let i = 0; i < 2; i++) B.patty(cc, -60 + i * 120, 50, 1, 0.1, ch, 'mieng', i + 5); },
      });
    });
    const hy = gy + (B.GH / 2 + 250) * gs * k;
    P.forearm(ctx, 900, 1900, 600, hy + 30, LAN_SKIN[0], B.LAN_SHIRT, 78);
    P.hand(ctx, 560, hy, 1.4, -1.6 + u * 0.5, 'fist', LAN_SKIN);
    if (landed > 0) {
      B.smoke(ctx, landed, 132, 540, gy - 40, 520, 900 * clamp(landed / 1.2), 14, 0.7 * Math.max(0, 1 - landed / 1.8), 160, '248,246,242', 1.3);
      L.flakes(ctx, landed, 0, 133, 40, 540, gy, { g: 600, speed: 1000, life: 1.2, size: 6, colors: ['#ffe2a0', '#ffb040', '#ff7a20'] });
    }
    B.embers(ctx, T, 134, 40, 540, 1300, 900, 800, 1, 1.5);
    B.smoke(ctx, T, 135, 540, 1300, 500, 1000, 10, 0.35, 120, '240,236,230', 1.3);
  });
  flare(ctx, 860, 520, 1.0, 0.35 + 0.4 * thud);
}

// ============ S14 39.5–42.5 Close, backlit: warm pot of dipping sauce, ladle, lit steam ============
function s14(ctx, lt, p, T) {
  darkBg(ctx, '#2a160a', '#0a0503');
  const dol = ease.inOut(p);
  cam(ctx, lerp(420, 660, dol), 1080, 1.12, 0, () => {
    glow(ctx, 760, 700, 900, 'rgba(255,190,110,0.9)', 0.7);
    bokeh(ctx, T * 0.4, 141, 9, ['rgba(255,190,110,0.6)', 'rgba(255,230,170,0.45)'], 0.35, 30, 100);
    ell(ctx, 540, 1470, 380, 70); ctx.fillStyle = '#141210'; ctx.fill();
    glow(ctx, 540, 1470, 360, 'rgba(80,140,255,0.8)', 0.25);
    const ang = lt * 3.2;
    R.pot(ctx, 540, 1460, 1.55, {
      k: 0.36, broth: B.SAUCE, boil: T * 0.6,
      items: (c, ly, Rr, k) => {
        const r = rng(142);
        for (let i = 0; i < 9; i++) { const a = r() * TAU + lt * 0.8, d = r() * Rr * 0.75; B.papaya(c, Math.cos(a) * d, ly + Math.sin(a) * d * k, 1.1, r() * 3); }
        c.strokeStyle = 'rgba(255,236,190,0.45)'; c.lineWidth = 3;
        for (let j = 0; j < 3; j++) { const rr = ((lt * 60 + j * 30) % 90) + 30; ell(c, Math.cos(ang) * 80, ly + Math.sin(ang) * 80 * k, rr, rr * k); c.stroke(); }
      },
    });
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,200,120,0.6)';
    ctx.beginPath(); ctx.ellipse(540, 1460 - 230 * 1.55, 200 * 1.55, 200 * 1.55 * 0.36, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.restore();
    const lx = 540 + Math.cos(ang) * 80 * 1.55, ly = 1460 - 212 * 1.55 + Math.sin(ang) * 80 * 1.55 * 0.36;
    P.seg(ctx, lx, ly - 10, lx + 330, ly - 520, 18, 14, '#6a4424');
    ell(ctx, lx, ly, 46, 16); ctx.fillStyle = '#8a8680'; ctx.fill();
    steam(ctx, T, 143, 540, 1040, 560, 900, 14, 0.5);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; steam(ctx, T + 1.3, 144, 600, 1000, 420, 800, 8, 0.35); ctx.restore();
  });
  flare(ctx, 820, 560, 1.1, 0.45);
  dust(ctx, T, 145, 30, 0, 0, W, H, '255,225,170', 2.5, 0.5);
  topBand(ctx, 0.45, 480);
  Tx.caption(ctx, T, 39.65, 42.3, 'Nước chấm ấm', 'Warm dipping sauce', { n: 8 });
}

// ============ S15 42.5–45.5 Top-down: pickled papaya & carrot drop into the sauce bowl on the beat ============
const S15_SEQ = ['p', 'c', 'p', 'p', 'c', 'p', 'c', 'p', 'p', 'c'];
function s15(ctx, lt, p, T) {
  darkBg(ctx, '#3a2614', '#140a04');
  const rot = lt * 0.12;
  const Rb = 380, iR = Rb * 0.84, sR = iR * 0.97;
  const pos = (i, ring) => { const a = i * 2.39996 + ring, d = Math.sqrt((i + 0.5) / 30) * sR * 0.82; return [Math.cos(a) * d, Math.sin(a) * d]; };
  let np = 0, nc = 0; const ripples = [], falling = [];
  S15_SEQ.forEach((kind, j) => {
    const t0 = 0.25 + j * 0.25, idx = kind === 'p' ? np : nc;
    const [x, y] = kind === 'p' ? pos(idx, 0) : pos(idx + 13, 1.0);
    if (lt >= t0) { if (kind === 'p') np++; else nc++; ripples.push([x, y, lt - t0]); }
    else { if (kind === 'p') np++; else nc++; if (lt > t0 - 0.3) falling.push([kind, x, y, (lt - (t0 - 0.3)) / 0.3, j]); }
  });
  // count only the landed pieces for the bowl
  let lp = 0, lc = 0; S15_SEQ.forEach((kind, j) => { if (lt >= 0.25 + j * 0.25) { if (kind === 'p') lp++; else lc++; } });
  cam(ctx, 540, 940, lerp(1.0, 1.14, ease.inOut(p)), -rot * 0.5, () => {
    woodTop(ctx, '#5a3a1e');
    B.bowlTop(ctx, 540, 940, Rb, (c, ir) => B.sauceTop(c, ir, { papaya: lp, carrot: lc, ripples, seed: 15 }), rot);
    at(ctx, 540, 940, rot, 1, 1, () => {
      for (const [kind, x, y, u, j] of falling) {
        const sc = lerp(3.4, 1, ease.in(u)) * (kind === 'p' ? 1.6 : 1.4) * (sR / 260);
        ctx.save(); ctx.globalAlpha = clamp(u * 2);
        ctx.save(); ctx.globalAlpha *= 0.3; ctx.filter = 'blur(8px)'; ell(ctx, x + 20 * (1 - u), y + 30 * (1 - u), 20 * sc, 14 * sc); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
        if (kind === 'p') B.papaya(ctx, x, y, sc, j * 1.7 + (1 - u) * 2); else B.carrot(ctx, x, y, sc, j + (1 - u) * 2);
        ctx.restore();
      }
    });
    for (const [x, y, age] of ripples) if (age < 0.25) L.sparkle(ctx, 540 + x * Math.cos(rot) - y * Math.sin(rot), 940 + x * Math.sin(rot) + y * Math.cos(rot), 50, 1 - age / 0.25);
  });
  steam(ctx, T, 151, 540, 760, 500, 700, 8, 0.25);
  glow(ctx, 860, 300, 800, 'rgba(255,220,160,0.55)', 0.4);
  Tx.caption(ctx, T, 42.65, 45.3, 'Đu đủ ngâm', 'Pickled papaya', { n: 9 });
}

// ============ S16 45.5–48 Extreme close: garlic & chili fall in slow motion ============
function s16(ctx, lt, p, T) {
  warmBokeh(ctx, T, lt * 30, 161, '#4a2c14', '#120804');
  const r = rng(162), drops = [];
  for (let i = 0; i < 16; i++) drops.push({ kind: i % 2 ? 'g' : 'c', x: 540 + (r() - 0.5) * 680, y: 1150 + (r() - 0.5) * 150, t0: 0.15 + i * 0.12 + r() * 0.06, rot: r() * TAU, spin: (r() - 0.5) * 4 });
  cam(ctx, 540, lerp(1060, 1120, ease.inOut(p)), lerp(1.04, 1.1, p), 0, () => {
    glow(ctx, 780, 600, 700, 'rgba(255,200,130,0.8)', 0.5);
    B.sauceBowl(ctx, 540, 1500, 3.0, { k: 0.3, papaya: 4, carrot: 3, seed: 16 });
    for (const d of drops) {
      const tl = lt - d.t0, fallT = 0.9;
      if (tl < -fallT) continue;
      if (tl < 0) {
        const u = 1 + tl / fallT, yy = lerp(-200, d.y, u * u);
        at(ctx, d.x, yy, d.rot + d.spin * tl, 1, 1, () => { if (d.kind === 'g') B.garlic(ctx, 0, 0, 3.2 * 1.6); else B.chiliRing(ctx, 0, 0, 3.2); });
      } else {
        const bob = Math.sin(T * 3 + d.rot) * 3;
        if (d.kind === 'g') B.garlic(ctx, d.x, d.y + bob, 4.4); else at(ctx, d.x, d.y + bob, 0, 1, 0.45, () => B.chiliRing(ctx, 0, 0, 3.0));
        if (tl < 0.8) { ctx.strokeStyle = `rgba(255,236,190,${0.6 * (1 - tl / 0.8)})`; ctx.lineWidth = 3; ell(ctx, d.x, d.y, 20 + tl * 120, (20 + tl * 120) * 0.3); ctx.stroke(); }
        if (tl < 0.5) L.flakes(ctx, tl, 0, 163 + Math.round(d.t0 * 100), 8, d.x, d.y, { g: 1400, speed: 380, life: 0.5, size: 6, slow: 0.7, colors: SAUCE_DROPS });
      }
    }
  });
  for (let i = 0; i < 5; i++) { const ph = (T * 0.7 + i / 5) % 1; L.sparkle(ctx, 200 + i * 170, 1140 + Math.sin(i * 2) * 60, 50, Math.sin(ph * Math.PI) * 0.8); }
  flare(ctx, 820, 520, 1.0, 0.35);
  topBand(ctx, 0.4, 500);
  Tx.caption(ctx, T, 45.65, 47.85, 'Tỏi ớt', 'Garlic & chili', { n: 10 });
}

// ============ S17 48–51 Close slow-mo: chopsticks drop grilled pork into the sauce, droplets fly ============
function s17(ctx, lt, p, T) {
  warmBokeh(ctx, T, -lt * 25, 171, '#3a2412', '#0e0703');
  const bx = 540, by = 1560, bs = 2.4, rx = 178;
  const rel = [0.55, 1.35, 2.15];
  const n = rel.filter(t => lt > t + 0.45).length;
  cam(ctx, 540, lerp(1240, 1300, ease.inOut(p)), lerp(1.0, 1.08, p), -0.02, () => {
    glow(ctx, 780, 700, 700, 'rgba(255,200,130,0.85)', 0.5);
    B.sauceBowl(ctx, bx, by, bs, { k: 0.36, patties: n, papaya: 4, carrot: 3, chili: 4, seed: 17 });
    rel.forEach((t0, i) => {
      const tx = bx + (-rx * 0.55 + i * rx * 0.5) * bs, ty = by + (-118 + (i % 2) * 10) * bs;
      const kind = i % 2 ? 'mieng' : 'vien';
      const come = clamp((lt - (t0 - 0.55)) / 0.5), drop = clamp((lt - t0) / 0.45), age = lt - t0 - 0.45;
      if (lt > t0 - 0.55 && lt < t0 + 0.6) {
        const leave = clamp((lt - t0 - 0.1) / 0.5);
        const tipX = lerp(1000, tx + 20, ease.out(come)) + leave * 260, tipY = lerp(700, ty - 150, ease.out(come)) - leave * 300;
        const rot = 2.45, spread = lt > t0 ? 0.08 : 0.025;
        F.chopsticks(ctx, tipX - Math.cos(rot) * 420 * 1.6, tipY - Math.sin(rot) * 420 * 1.6, 1.6, rot, spread);
        if (lt < t0) B.pattySide(ctx, tipX, tipY + 18, bs * 0.95, -0.2, 0.9, kind);
      }
      if (drop > 0 && drop < 1) B.pattySide(ctx, tx, lerp(ty - 132, ty, drop * drop), bs * 0.95, lerp(-0.2, (i - 1) * 0.15, drop), 0.9, kind);
      if (age > 0 && age < 1.5) {
        L.flakes(ctx, age, 0, 172 + i, 26, tx, ty - 10, { g: 1500, speed: 900, life: 1.4, size: 9, slow: 0.45, spread: 2.0, colors: SAUCE_DROPS });
        ctx.strokeStyle = `rgba(255,236,190,${0.7 * (1 - age / 1.5)})`; ctx.lineWidth = 4; ell(ctx, tx, ty, 40 + age * 200, (40 + age * 200) * 0.36); ctx.stroke();
      }
    });
    steam(ctx, T, 173, 540, 1100, 500, 700, 8, 0.25);
  });
  flare(ctx, 800, 560, 1.0, 0.35);
  topBand(ctx, 0.4, 480);
  Tx.caption(ctx, T, 48.15, 50.85, 'Thả chả vào bát', 'Pork into the sauce', { n: 11 });
}

// ============ S18 51–54 Medium: hands set down a plate of rice vermicelli – thump, steam ============
function s18(ctx, lt, p, T) {
  const down = ease.in(clamp(lt / 0.6)), thud = bump(lt, 0.58, 0.22), away = ease.inOut(clamp((lt - 1.0) / 0.6));
  const shake = thud * 8 * Math.sin(lt * 90);
  P.layer(ctx, 14, (x) => cam(x, 640, 1050, 1.5, 0, () => chaSet(x, T, { smokeA: 0.6 })));
  cam(ctx, 540, 1180 + shake, lerp(1.0, 1.1, ease.inOut(p)), 0, () => {
    ctx.save(); ctx.beginPath(); ctx.rect(-400, 1000, 1900, 1400); ctx.clip();
    at(ctx, 0, 1000, 0, 1, 0.45, () => woodTop(ctx, '#7a5030'));
    const sh = ctx.createLinearGradient(0, 1000, 0, 1080); sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.fillRect(-400, 1000, 1900, 80);
    ctx.restore();
    const py = lerp(860, 1260, down);
    B.bunPlate(ctx, 540, py, 330, 0.4);
    if (lt > 0.6) steam(ctx, T, 181, 540, py - 80, 520, 800, 12, 0.45 * clamp((lt - 0.6) / 0.5));
    for (const sd of [-1, 1]) {
      const hx = 540 + sd * (330 + away * 220), hy = py + 10 + away * 260;
      P.forearm(ctx, 540 + sd * 760, 1700 + away * 200, hx + sd * 40, hy + 30, LAN_SKIN[0], B.LAN_SHIRT, 70);
      P.hand(ctx, hx, hy, 1.3, sd < 0 ? 0 : Math.PI, 'flat', LAN_SKIN, sd > 0);
    }
    if (thud > 0.05) { ctx.save(); ctx.strokeStyle = `rgba(255,240,210,${0.6 * thud})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(540 + sd * (360 + i * 30), 1290 - i * 25); ctx.lineTo(540 + sd * (420 + i * 40), 1270 - i * 40); ctx.stroke(); } ctx.restore(); }
  });
  glow(ctx, 880, 380, 800, 'rgba(255,225,170,0.6)', 0.45);
  dust(ctx, T, 182, 30, 0, 0, W, H, '255,235,190', 2.5, 0.45);
  topBand(ctx, 0.4, 480);
  Tx.caption(ctx, T, 51.15, 53.85, 'Bún rối', 'Rice vermicelli', { n: 12 });
}

// ============ S19 54–57 High angle: a rain of herbs into the basket ============
const HERB_KINDS = ['xalach', 'kinhgioi', 'tiato', 'kinhgioi'];
function s19(ctx, lt, p, T) {
  darkBg(ctx, '#2e2a18', '#0c0a05');
  const r = rng(191), leaves = [];
  for (let i = 0; i < 44; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 300; leaves.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, t0: 0.25 + i * 0.05 + r() * 0.1, rot: r() * TAU, kind: HERB_KINDS[i % 4], sx: (r() - 0.5) * 700, spin: (r() - 0.5) * 6 }); }
  const bx = 540, by = 1180, sq = 0.62;
  cam(ctx, 540, lerp(900, 1080, ease.inOut(p)), lerp(1.0, 1.12, ease.inOut(p)), 0.04, () => {
    woodTop(ctx, '#4a3a22');
    glow(ctx, 760, 500, 800, 'rgba(255,230,170,0.8)', 0.45);
    at(ctx, bx, by, 0, 1, sq, () => R.basket(ctx, 0, 0, 1, 380, (c) => {
      for (const lf of leaves) if (lt > lf.t0) F.herbLeaf(c, lf.x, lf.y, 2.4, lf.rot, lf.kind);
    }));
    for (const lf of leaves) {
      const tl = lt - lf.t0, ft = 0.8;
      if (tl >= 0 || tl < -ft) continue;
      const u = 1 + tl / ft;
      const x = bx + lerp(lf.sx, lf.x, ease.out(u)), y = lerp(-150, by + lf.y * sq, u * u);
      at(ctx, x, y, lf.rot + lf.spin * tl, 1, Math.cos(tl * 8 + lf.rot), () => F.herbLeaf(ctx, 0, 0, 2.8, 0, lf.kind));
    }
    for (let i = 0; i < 8; i++) { const ph = (T * 0.8 + i / 8) % 1; L.sparkle(ctx, bx + Math.cos(i * 2.3) * 260, by + Math.sin(i * 1.7) * 150, 40, Math.sin(ph * Math.PI) * clamp((lt - 0.8) / 0.5)); }
  });
  dust(ctx, T, 192, 26, 0, 0, W, H, '255,240,200', 2.5, 0.45);
  topBand(ctx, 0.4, 480);
  Tx.caption(ctx, T, 54.15, 56.85, 'Rau sống', 'Fresh herbs', { n: 13 });
}

// ============ S20 57–60.5 Top-down: the tray is set on the beat, zoom out with a turn ============
function s20(ctx, lt, p, T) {
  darkBg(ctx, '#3a2614', '#140a04');
  const beats = [0.25, 0.75, 1.25, 1.75, 2.25];
  const show = beats.map(t0 => clamp((lt - t0) / 0.3));
  const out = ease.inOut(clamp(lt / 3.2));
  const z = lerp(1.3, 0.98, out), rr = lerp(0.25, 0, out);
  cam(ctx, 540, 900, z, rr, () => {
    woodTop(ctx, '#5a3a1e');
    at(ctx, 540, 900, 0, 1, 1, () => tray(ctx, show, T));
  });
  const pts = [[165, -100], [-150, -150], [-120, 190], [185, 175], [-40, 380]];
  beats.forEach((t0, i) => { if (lt > t0 && lt < t0 + 0.35) { const [x, y] = pts[i], c = Math.cos(rr), s = Math.sin(rr); L.sparkle(ctx, 540 + (x * c - y * s) * z, 960 + (x * s + y * c) * z, 90, 1 - (lt - t0) / 0.35); } });
  steam(ctx, T, 201, 540, 700, 600, 700, 8, 0.25 * show[0]);
  glow(ctx, 860, 260, 800, 'rgba(255,220,160,0.55)', 0.45);
  Tx.caption(ctx, T, 57.15, 60.3, 'Dọn mâm', 'Serve it up', { n: 14 });
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, tray };
