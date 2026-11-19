// Shots 11–20: eggs, flip, scallions, pickles, sauce, plating, drizzle, table, chewy macro.
const L = require('./lib');
const P = require('./props');
const F = require('./food');
const K = require('./kitchen');
const Wd = require('./world');
const Tx = require('./text');
const A = require('./shotsA');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, steam, flakes, sparkle } = L;
const { ell } = P;
const { darkBg, wood, bump, shake } = A;

// a cooked cake (egg sheet + cubes) in plane coords, used by S11–S14
const CAKE = K.cubeLayout(131, 12, 200);
function cakeTop(c, pt, o = {}) {
  K.eggSheet(c, pt, 0, 0, 240, 77, o.spread === undefined ? 1 : o.spread, o.cook === undefined ? 0.6 : o.cook, o.k || 1);
}
function cakeCubes(c, pt, o = {}) {
  for (const cb of CAKE) { const [px, py] = pt(cb.u, cb.v); K.cube(c, px, py - (o.lift || 0), o.s || 0.85, cb.rot, { gold: cb.g, egg: o.egg === undefined ? 0.7 : o.egg, seed: cb.i + 5 }); }
}

// ============ S11 30.5–33.5 (6) one-hand egg crack, slow-mo yolk ============
function s11(ctx, lt, p, T) {
  darkBg(ctx, T, 111, { n: 14, a: 0.3, top: '#1c0f08' });
  glow(ctx, 200, 300, 700, 'rgba(255,180,90,0.9)', 0.45);
  const crack = clamp((lt - 0.45) / 0.45);
  // slow-mo fall: drifts slowly, then lands at ~2.75
  const fall = lt < 0.9 ? 0 : Math.min(1, (lt - 0.9) * 0.28 + ease.in(clamp((lt - 2.4) / 0.35)) * 0.8);
  const yy = lerp(760, 1640, fall);
  cam(ctx, 540, lerp(940, 1010, ease.inOut(p)), lerp(1.0, 1.12, ease.inOut(p)), lerp(0.03, -0.02, p), () => {
    K.flame(ctx, 540, 1860, 520, 80, T, 1.0);
    K.pan(ctx, 540, 1720, 2.0, 0.3, {
      oil: 0.8, t: T,
      over: (c, pt) => {
        cakeCubes(c, pt, { egg: 0, s: 0.8 });
        if (fall >= 1) { const age = lt - 2.75; const [px, py] = pt(0, 0); ell(c, px, py - 10, 60 + age * 300, (60 + age * 300) * 0.3); c.fillStyle = 'rgba(255,245,215,0.85)'; c.fill(); K.yolk(c, px, py - 30, 1.2, 0.8); }
      },
    });
    const ex = 520, ey = 640;
    P.forearm(ctx, ex + 560, ey - 330, ex + 100, ey - 20, K.SAU[0], '#e9e4da', 110);
    K.egg(ctx, ex, ey, 2.8, -0.15, crack);
    P.hand(ctx, ex + 60, ey - 30, 1.5, Math.PI * 0.85, 'fist', [K.SAU[0], K.SAU[1]]);
    if (crack > 0.3 && fall < 1) {
      const st = lerp(1.0, 1.7, clamp((lt - 0.9) / 0.6));
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 26; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex, ey + 20); ctx.quadraticCurveTo(ex + 10, (ey + yy) / 2, ex, yy - 40); ctx.stroke(); ctx.restore();
      K.yolk(ctx, ex, yy, 2.6, st);
      sparkle(ctx, ex - 28, yy - 6, 50, 0.6);
    }
    if (crack > 0 && crack < 0.4) flakes(ctx, lt, 0.45, 112, 10, ex, ey, { g: 900, speed: 300, life: 0.8, colors: ['#e9c39a', '#fff1de'], spread: 2.4, size: 5 });
  });
  dust(ctx, T, 113, 22, 0, 0, W, H, '255,210,150', 2.5, 0.3);
  Tx.caption(ctx, T, 30.7, 33.3, 'Đập trứng', 'Crack the eggs', { n: 6 });
}

// ============ S12 33.5–36.5 (7) top-down: egg spreads, spatula evens it ============
function s12(ctx, lt, p, T) {
  ctx.fillStyle = '#150b06'; ctx.fillRect(0, 0, W, H);
  const spread = ease.out(clamp(lt / 1.6)), cook = clamp(lt / 3) * 0.6;
  cam(ctx, 540, 960, lerp(1.04, 1.16, p), lerp(0.35, -0.05, ease.inOut(p)), () => {
    glow(ctx, 540, 960, 760, 'rgba(60,110,255,0.9)', 0.35);
    K.pan(ctx, 540, 960, 1.45, 1, {
      oil: 0.6, t: T,
      fill: (c, pt) => {
        cakeTop(c, pt, { spread, cook });
        cakeCubes(c, pt, { egg: 0.15 + 0.6 * spread, s: 0.85 });
        const r = rng(121);
        for (let i = 0; i < 40; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * 230 * spread, sp = 1 + r(), ph0 = r(); const ph = (T * sp + ph0) % 1; const [px, py] = pt(Math.cos(a) * rr, Math.sin(a) * rr); ell(c, px, py, 3 + ph * 7, 3 + ph * 7); c.strokeStyle = `rgba(255,250,225,${0.7 * (1 - ph)})`; c.lineWidth = 2; c.stroke(); }
      },
      over: (c, pt) => {
        if (lt > 1.2) { const k = (lt - 1.2) / 1.8; const [px, py] = pt(lerp(-180, 200, ease.inOut(k)), Math.sin(k * 7) * 90); K.spatula(c, px, py, 1.0, 0.6 + Math.sin(k * 7) * 0.2, 1); }
      },
    });
  });
  steam(ctx, T, 122, 540, 900, 900, 900, 12, 0.18);
  Tx.caption(ctx, T, 33.7, 36.3, 'Phủ trứng', 'Egg over the top', { n: 7 });
}

// ============ S13 36.5–39.5 (8) Sau tosses the whole cake – speed ramp ============
function cakeFlying(ctx, x, y, s, phi, rot) {
  const c = Math.cos(phi);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s * Math.max(0.06, Math.abs(c)) * 0.42);
  const pt = (u, v) => [u, v];
  if (c >= 0) { cakeTop(ctx, pt, { cook: 0.6 }); cakeCubes(ctx, pt, { egg: 0.7, s: 0.85 }); }
  else { cakeTop(ctx, pt, { cook: 0.95 }); }
  ctx.restore();
}
function s13(ctx, lt, p, T) {
  const up = ease.out(clamp((lt - 0.35) / 0.3)), down = ease.in(clamp((lt - 2.0) / 0.25));
  const hang = clamp((lt - 0.65) / 1.35);
  const h = lt < 0.65 ? up * 640 : lt < 2.0 ? 640 + Math.sin(hang * Math.PI) * 60 : 640 * (1 - down);
  const phi = lt < 0.35 ? 0 : lt < 2.25 ? Math.PI * clamp((lt - 0.35) / 1.9) : Math.PI;
  const landed = lt >= 2.25, hitA = bump(lt, 2.25, 0.25);
  const [sx0, sy0] = shake(T, 14 * hitA);
  const panY = 1300 - bump(lt, 0.25, 0.4) * 70;
  P.layer(ctx, 12, (x) => cam(x, 520, 900, 1.6, 0, () => { Wd.drawStreetNight(x); }));
  ctx.fillStyle = 'rgba(15,8,20,0.45)'; ctx.fillRect(0, 0, W, H);
  glow(ctx, 860, 300, 600, 'rgba(255,180,90,0.9)', 0.45);
  cam(ctx, 540 + sx0, lerp(1150, 980, Math.min(1, h / 640)) + sy0, 1.0 + hitA * 0.04, 0, () => {
    const amazed = lt > 0.6 && lt < 2.2;
    K.sau(ctx, 540, 2050, 1.3, { handR: [-178, -580 + (panY - 1300) / 1.3], handL: [178, -580 + (panY - 1300) / 1.3], head: { eyes: amazed ? 'wide' : 'laugh', mouth: amazed ? 'o' : 'laugh', mOpen: 0.7, look: 0, rim: 1 } });
    K.pan(ctx, 540, panY, 0.75, 0.35, {
      oil: 0.6, t: T,
      over: (c, pt) => {
        if (lt < 0.35) { const pt2 = (u, v) => pt(u * 0.95, v * 0.95); cakeTop(c, pt2, { cook: 0.6, k: 0.35 }); cakeCubes(c, pt2, { egg: 0.7, s: 0.8 }); }
        if (landed) { cakeTop(c, pt, { cook: 0.95, k: 0.35 }); }
      },
    });
    if (lt >= 0.35 && !landed) {
      cakeFlying(ctx, 540, panY - 20 - h * 1.15, 0.75, phi, Math.sin(phi) * 0.25);
      const fast = (lt < 0.7) || (lt > 1.95);
      if (fast) { ctx.save(); ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 4; const r = rng(131); for (let i = 0; i < 14; i++) { const x = 330 + r() * 420, y0 = panY - 200 - h - r() * 300; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 160 + r() * 200); ctx.stroke(); } ctx.restore(); }
      if (lt > 0.65 && lt < 2.0) flakes(ctx, lt, 0.6, 133, 18, 540, panY - 20 - h * 1.15, { g: 160, speed: 120, life: 1.4, colors: ['#ffd27a', '#fff0c0'], spread: TAU, size: 5 });
    }
    if (landed) {
      flakes(ctx, lt, 2.25, 134, 40, 540, panY - 10, { g: 1600, speed: 900, life: 0.8, colors: ['#ffd27a', '#ffb84a', '#fff0c0'], spread: 2.4, size: 6 });
      steam(ctx, T, 135, 540, panY - 120, 600, 500, 10, 0.35 * (1 - clamp((lt - 2.25) / 0.7)));
    }
  });
  flare(ctx, 860, 300, 0.8, 0.45);
  Tx.caption(ctx, T, 36.7, 39.3, 'Lật bánh', 'Flip!', { n: 8, y: 1430 });
}

// ============ S14 39.5–42.5 (9) scallion rain from above, crane down ============
const RAIN = (() => { const r = rng(141), a = []; for (let i = 0; i < 70; i++) a.push({ x: 160 + r() * 760, d: r() * 1.8, sp: 0.55 + r() * 0.4, rot: r() * TAU, z: r() < 0.18 ? 2.6 + r() : 1 + r() * 0.6 }); return a; })();
function s14(ctx, lt, p, T) {
  ctx.fillStyle = '#120a06'; ctx.fillRect(0, 0, W, H);
  cam(ctx, 540, 1000, lerp(0.92, 1.22, ease.inOut(p)), 0.12, () => {
    glow(ctx, 540, 1000, 760, 'rgba(255,170,80,0.9)', 0.3);
    K.pan(ctx, 540, 1000, 1.45, 0.85, {
      oil: 0.5, t: T,
      fill: (c, pt) => { cakeTop(c, pt, { cook: 0.7, k: 0.85 }); },
      over: (c, pt) => { cakeCubes(c, pt, { egg: 0.7, s: 0.82 }); K.scallionScatter(c, (u, v) => { const q = pt(u, v); return [q[0], q[1] - 30]; }, 141, 70, 220, clamp(lt / 2.4)); },
    });
  });
  for (const f of RAIN) {
    const k = (lt - f.d) * f.sp * 1.6; if (k < 0 || k > 1) continue;
    const y = lerp(-80, 1150, k), s = f.z * 1.4;
    if (f.z > 2) { ctx.save(); ctx.filter = 'blur(6px)'; K.scallion(ctx, f.x, y * 1.4 - 300, s * 1.6, f.rot + lt * 3, 0); ctx.restore(); }
    else K.scallion(ctx, f.x, y, s, f.rot + lt * 4, f.z > 1.3 ? 1 : 0);
  }
  steam(ctx, T, 142, 540, 950, 800, 800, 10, 0.2);
  Tx.caption(ctx, T, 39.7, 42.3, 'Hành lá', 'Scallions', { n: 9 });
}

// ============ S15 42.5–45.5 (10) pickled papaya & carrot jar ============
function s15(ctx, lt, p, T) {
  darkBg(ctx, T, 151, { n: 18, a: 0.38, cols: ['rgba(255,170,80,1)', 'rgba(255,215,140,1)', 'rgba(110,200,170,1)'] });
  const lift = ease.inOut(clamp((lt - 0.9) / 1.2));
  cam(ctx, lerp(440, 640, ease.inOut(p)), 1050, 1.0, -0.02, () => {
    wood(ctx, 1450, H + 400, 151);
    glow(ctx, 560, 1100, 520, 'rgba(255,190,90,1)', 0.55);
    K.jar(ctx, 540, 1520, 2.0, T);
    const tipX = 580, tipY = lerp(820, 500, lift);
    if (lt > 0.9) K.pickleClump(ctx, tipX, tipY, 1.5, T, 4, lift > 0.6 ? 1 : 0);
    F.chopsticks(ctx, tipX, tipY, 1.6, -2.15, 0.035);
  });
  godRays(ctx, 900, 200, 2.0, 0.8, 1400, 8, 'rgba(255,210,140,0.5)', 0.3, T);
  Tx.caption(ctx, T, 42.7, 45.3, 'Đồ chua', 'Pickled papaya', { n: 10, y: 1440 });
}

// ============ S16 45.5–48.5 (11) soy, vinegar, chili into the dipping bowl ============
function s16(ctx, lt, p, T) {
  darkBg(ctx, T, 161, { n: 12, a: 0.3 });
  const pours = [['soy', 0.0, 0.95], ['vinegar', 0.95, 1.9], ['chili', 1.9, 2.9]];
  const level = 0.15 + 0.75 * clamp(lt / 2.7);
  const red = clamp((lt - 2.0) / 0.8);
  cam(ctx, 540, 1100, lerp(1.12, 1.0, ease.out(p)), lerp(-0.05, 0.03, p), () => {
    wood(ctx, 1300, H + 400, 162);
    glow(ctx, 540, 1250, 420, 'rgba(255,180,90,1)', 0.35);
    K.bowl(ctx, 540, 1330, 2.4, {
      k: 0.4, level, col: F.mix('#4a200c', '#9a2412', red),
      fill: (c, rr, k) => { const sp = lt * 3; for (let i = 0; i < 4; i++) { ell(c, Math.cos(sp + i) * rr * 0.3, Math.sin(sp + i) * rr * 0.3 * k, rr * 0.35, rr * 0.35 * k); c.strokeStyle = 'rgba(255,200,150,0.18)'; c.lineWidth = 4; c.stroke(); } if (red > 0) { const r = rng(5); c.fillStyle = 'rgba(230,40,20,0.8)'; for (let i = 0; i < 14 * red; i++) { ell(c, (r() - 0.5) * rr * 1.4, (r() - 0.5) * rr * k * 1.4, 6, 4); c.fill(); } } },
    });
    glow(ctx, 760, 560, 380, 'rgba(255,190,110,1)', 0.4);
    for (const [kind, t0, t1] of pours) {
      const a = clamp((lt - t0) / 0.2) * clamp((t1 - lt) / 0.2); if (a <= 0) continue;
      const tilt = lerp(-1.2, -2.25, ease.out(clamp((lt - t0) / 0.25)));
      const bx = 800, by = 700, s = 1.25, hh = (kind === 'chili' ? 300 : 340) * s;
      const nx = bx + Math.sin(tilt) * hh, ny = by - Math.cos(tilt) * hh;
      ctx.save(); ctx.globalAlpha = a;
      const pouring = lt > t0 + 0.2 && lt < t1 - 0.15;
      if (pouring) {
        ctx.strokeStyle = kind === 'soy' ? 'rgba(60,24,8,0.95)' : kind === 'vinegar' ? 'rgba(235,240,225,0.6)' : 'rgba(210,30,20,0.95)';
        ctx.lineWidth = kind === 'chili' ? 18 : 12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx - 10, (ny + 1320) / 2, 540 + Math.sin(T * 25) * 4, 1320 - level * 10); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
        flakes(ctx, lt, t0 + 0.2, 160 + t0 * 10, 14, 540, 1310, { g: 1400, speed: 300, life: 0.4, colors: [kind === 'chili' ? '#d82a1a' : '#6a3010'], spread: 2, size: 4, stagger: 0.7 });
      }
      K.bottle(ctx, bx, by, s, kind, tilt, { squeeze: kind === 'chili' && pouring ? 0.5 + 0.5 * Math.sin(T * 12) : 0 });
      ctx.restore();
    }
  });
  glow(ctx, 200, 260, 380, 'rgba(255,200,120,0.9)', 0.35);
  Tx.caption(ctx, T, 45.7, 48.3, 'Nước tương', 'Soy-vinegar sauce', { n: 11, y: 1440 });
}

// ============ S17 48.5–51.5 (12) plate it, backlit under the bulb ============
function s17(ctx, lt, p, T) {
  darkBg(ctx, T, 171, { n: 14, a: 0.3, top: '#0f0a10' });
  const slide = ease.out(clamp((lt - 0.2) / 1.1));
  cam(ctx, 540, lerp(980, 1150, ease.inOut(p)), lerp(1.0, 1.08, p), 0, () => {
    godRays(ctx, 540, 320, Math.PI / 2, 0.75, 1500, 11, 'rgba(255,205,130,0.55)', 0.45, T);
    wood(ctx, 980, H + 400, 172);
    K.plate(ctx, 540, 1160, 1.7, 0.42, (c) => {
      K.dish(c, lerp(560, 0, slide), -10, 0.8, { k: 0.42, t: T });
    });
    if (lt < 1.9) { const sx = lerp(1260, 760, slide) + (lt > 1.3 ? (lt - 1.3) * 900 : 0); K.spatula(ctx, sx + 120, 1175, 1.6, 0.05, 0.42); }
    steam(ctx, T, 173, 540, 1000, 600, 800, 14, 0.45 * slide);
  });
  glow(ctx, 540, 300, 260, 'rgba(255,220,150,1)', 0.8);
  ctx.fillStyle = '#2a2420'; ctx.fillRect(536, 0, 8, 262); ctx.fillRect(522, 248, 36, 22);
  ctx.fillStyle = '#fff6dc'; ell(ctx, 540, 300, 34, 42); ctx.fill();
  flare(ctx, 540, 300, 0.9, 0.5);
  Tx.caption(ctx, T, 48.7, 51.3, 'Ra đĩa', 'Plate it', { n: 12, y: 1500 });
}

// ============ S18 51.5–54.5 (13) drizzle the sauce, glossy sparkles ============
function s18(ctx, lt, p, T) {
  darkBg(ctx, T, 181, { n: 16, a: 0.32 });
  const sauce = clamp((lt - 0.3) / 2.1);
  cam(ctx, lerp(500, 580, p), 1200, lerp(1.0, 1.12, ease.inOut(p)), lerp(0.05, -0.05, ease.inOut(p)), () => {
    wood(ctx, 1000, H + 400, 182);
    glow(ctx, 860, 500, 520, 'rgba(255,190,100,1)', 0.35);
    K.plate(ctx, 540, 1300, 2.2, 0.55, (c) => K.dish(c, 0, -10, 0.85, { k: 0.55, sauce, t: T }));
    if (lt > 0.2 && lt < 2.6) {
      const k = (lt - 0.2) / 2.4, sx = 540 + Math.sin(k * 9) * 260, sy = 1290 + lerp(-110, 110, k);
      ctx.save(); ctx.strokeStyle = 'rgba(110,40,12,0.95)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx + 30, 420); ctx.quadraticCurveTo(sx + 10, 800, sx, sy - 60); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,150,0.5)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      P.spoon(ctx, sx + 40, 400, 1.3, 2.4, 0, '#6a2a0e');
    }
  });
  Tx.caption(ctx, T, 51.7, 54.3, 'Rưới sốt', 'Drizzle', { n: 13, y: 1460 });
}

// ============ S19 54.5–57.5 (14) top-down table, pop-ins on the beat ============
function iceTea(ctx, x, y, s, t) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.save(); ctx.filter = 'blur(10px)'; ell(ctx, 16, 18, 100, 100); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 0, 100, 100); ctx.fillStyle = 'rgba(220,235,240,0.35)'; ctx.fill();
    ell(ctx, 0, 0, 86, 86); const g = ctx.createRadialGradient(-20, -20, 5, 0, 0, 90); g.addColorStop(0, '#e8b860'); g.addColorStop(1, '#9a5a1a'); ctx.fillStyle = g; ctx.fill();
    const r = rng(19);
    for (let i = 0; i < 6; i++) { const a = r() * TAU, rr = r() * 45; at(ctx, Math.cos(a) * rr, Math.sin(a) * rr, r() * TAU + t * 0.2, 1, 1, () => { ctx.fillStyle = 'rgba(245,250,255,0.75)'; ctx.beginPath(); ctx.roundRect(-20, -20, 40, 40, 8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-14, -14, 10, 4); }); }
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ell(ctx, 0, 0, 100, 100); ctx.stroke();
  });
}
function s19(ctx, lt, p, T) {
  const beats = [0.15, 0.6, 1.05, 1.5, 1.95];
  const pop = (i) => ease.outBack(clamp((lt - beats[i]) / 0.3));
  cam(ctx, 540, 960, lerp(1.16, 1.0, ease.out(p)), lerp(-0.12, 0.04, ease.inOut(p)), () => {
    wood(ctx, -600, H + 600, 191);
    ctx.fillStyle = 'rgba(255,200,120,0.08)'; ctx.fillRect(-600, -600, W + 1200, H + 1200);
    const items = [
      [0, 540, 880, (s) => K.plate(ctx, 0, 0, s, 1, (c) => K.dish(c, 0, 10, 0.85, { k: 1, sauce: 1, t: T }))],
      [1, 250, 1360, (s) => K.bowl(ctx, 0, 0, s, { k: 1, level: 0.8, col: '#e9b26a', fill: (c, rr) => { c.lineCap = 'round'; const r = rng(4); for (let i = 0; i < 30; i++) { const kk = r(); c.strokeStyle = kk < 0.35 ? '#ee7a22' : '#f4ecc8'; c.lineWidth = 6; const x0 = (r() - 0.5) * rr * 1.5, y0 = (r() - 0.5) * rr * 1.5, a = r() * TAU; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + Math.cos(a) * 60, y0 + Math.sin(a) * 60); c.stroke(); } } })],
      [2, 830, 1360, (s) => iceTea(ctx, 0, 0, s, T)],
      [3, 790, 380, (s) => K.bottle(ctx, 0, 140, s, 'chili', 0)],
      [4, 300, 400, (s) => F.chopsticks(ctx, 0, 0, s, 1.25, 0.02)],
    ];
    const sizes = [1.0, 1.05, 1.1, 0.85, 1.1];
    for (const [i, x, y, fn] of items) {
      const k = pop(i); if (k <= 0) continue;
      at(ctx, x, y, (1 - k) * 0.3, k, k, () => fn(sizes[i]));
      const fl = bump(lt, beats[i], 0.2);
      if (fl > 0) glow(ctx, x, y, 260, 'rgba(255,240,200,1)', 0.35 * fl);
    }
  });
  steam(ctx, T, 192, 540, 820, 500, 600, 8, 0.2);
  Tx.caption(ctx, T, 54.7, 57.3, 'Xong!', 'Done!', { n: 14, y: 1500 });
}

// ============ S20 57.5–60.5 macro: break a piece – crispy outside, chewy inside ============
function half(ctx, x, y, s, side, rot) {
  at(ctx, x, y, rot, s, s, () => {
    const w = 150, h = 170;
    ctx.save(); ctx.scale(side, 1);
    ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(w - 26, -h / 2); ctx.quadraticCurveTo(w, -h / 2, w, -h / 2 + 26); ctx.lineTo(w, h / 2 - 26); ctx.quadraticCurveTo(w, h / 2, w - 26, h / 2); ctx.lineTo(0, h / 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, -h / 2, w, h / 2); g.addColorStop(0, '#f0b44a'); g.addColorStop(0.6, '#d4801e'); g.addColorStop(1, '#8a4a12');
    ctx.fillStyle = g; ctx.fill();
    const r = rng(side > 0 ? 201 : 202);
    ctx.fillStyle = 'rgba(255,240,180,0.6)'; for (let i = 0; i < 40; i++) { ell(ctx, 10 + r() * (w - 20), -h / 2 + 10 + r() * (h - 20), 2 + r() * 4, 1.5 + r() * 3); ctx.fill(); }
    ctx.fillStyle = 'rgba(120,50,8,0.5)'; for (let i = 0; i < 26; i++) { ell(ctx, 10 + r() * (w - 20), -h / 2 + 10 + r() * (h - 20), 2 + r() * 2, 2); ctx.fill(); }
    ctx.fillStyle = '#ffd23a'; ell(ctx, w * 0.5, -h / 2 + 14, 50, 18); ctx.fill();
    ctx.beginPath(); ctx.moveTo(6, -h / 2 + 8);
    for (let i = 0; i <= 10; i++) ctx.lineTo(i % 2 ? -14 : 4, -h / 2 + 8 + i * (h - 16) / 10);
    ctx.lineTo(30, h / 2 - 8); ctx.lineTo(30, -h / 2 + 8); ctx.closePath();
    const cg = ctx.createLinearGradient(-14, 0, 30, 0); cg.addColorStop(0, '#fffaf0'); cg.addColorStop(1, '#efe4c8');
    ctx.fillStyle = cg; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, 4, -30, 6, 20); ctx.fill();
    ctx.restore();
  });
}
function s20(ctx, lt, p, T) {
  darkBg(ctx, T, 203, { n: 20, a: 0.4, top: '#1e1009' });
  glow(ctx, 760, 520, 700, 'rgba(255,180,90,1)', 0.45);
  const sep = ease.inOut(clamp((lt - 0.35) / 2.0)) * 260;
  const snap = lt > 2.15;
  cam(ctx, 540, 960, lerp(1.0, 1.2, ease.inOut(p)), lerp(0.04, -0.03, p), () => {
    const cy = 1000, s = 2.1, lx = 540 - sep / 2, rx = 540 + sep / 2;
    if (sep > 1 && !snap) {
      const thin = 1 - sep / 300;
      ctx.save(); ctx.globalAlpha = 0.3 + 0.6 * Math.max(0, thin); { const mg = ctx.createLinearGradient(0, cy - 140, 0, cy + 160); mg.addColorStop(0, '#fbf3df'); mg.addColorStop(0.5, '#efe1c0'); mg.addColorStop(1, '#d9c69c'); ctx.fillStyle = mg; }
      ctx.beginPath(); ctx.moveTo(lx - 10, cy - 140); ctx.quadraticCurveTo(540, cy - 120 + sep * 0.2, rx + 10, cy - 140); ctx.lineTo(rx + 10, cy + 140); ctx.quadraticCurveTo(540, cy + 60 + sep * 0.2, lx - 10, cy + 140); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.save(); ctx.lineCap = 'round';
      const r = rng(204);
      for (let i = 0; i < 13; i++) {
        const yy = cy - 130 + r() * 260, sag = 20 + sep * 0.22 + r() * 40;
        ctx.strokeStyle = 'rgba(200,170,120,0.35)'; ctx.lineWidth = Math.max(6, (22 + r() * 26) * Math.sqrt(Math.max(0, thin))) + 6;
        ctx.beginPath(); ctx.moveTo(lx - 10, yy + 4); ctx.quadraticCurveTo(540, yy + sag + 6, rx + 10, yy + 4); ctx.stroke();
        ctx.strokeStyle = i % 3 ? 'rgba(252,246,230,0.97)' : 'rgba(236,224,196,0.97)'; ctx.lineWidth -= 6;
        ctx.beginPath(); ctx.moveTo(lx - 10, yy); ctx.quadraticCurveTo(540, yy + sag, rx + 10, yy); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, 4 * thin); ctx.stroke();
      }
      ctx.restore();
    }
    if (snap) {
      const k = clamp((lt - 2.15) / 0.3);
      ctx.save(); ctx.strokeStyle = 'rgba(250,244,228,0.95)'; ctx.lineCap = 'round'; ctx.lineWidth = 8;
      for (let i = 0; i < 4; i++) { const yy = cy - 90 + i * 60; ctx.beginPath(); ctx.moveTo(lx - 10, yy); ctx.quadraticCurveTo(lx + 40 * (1 - k), yy + 30, lx + 60 * (1 - k) + 10, yy + 50 * (1 - k)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(rx + 10, yy); ctx.quadraticCurveTo(rx - 40 * (1 - k), yy + 30, rx - 60 * (1 - k) - 10, yy + 50 * (1 - k)); ctx.stroke(); }
      ctx.restore();
    }
    half(ctx, lx, cy, s, -1, -0.06 - sep * 0.0004);
    half(ctx, rx, cy, s, 1, 0.06 + sep * 0.0004);
    F.chopsticks(ctx, lx - 120, cy - 120, 1.6, -1.95, 0.05);
    F.chopsticks(ctx, rx + 120, cy - 120, 1.6, -1.2, 0.05);
    flakes(ctx, lt, 0.35, 205, 26, 540, cy - 140, { g: 1300, speed: 420, life: 1.0, colors: ['#f0b44a', '#d4801e', '#ffe2a0'], spread: 2.4, size: 6 });
    steam(ctx, T, 206, 540, cy - 120, 220 + sep, 700, 10, 0.5 * clamp(sep / 120));
  });
  Tx.line(ctx, T, 58.0, 60.4, 'Giòn ngoài, dẻo trong', 'Crispy outside, chewy inside', { y: 1460, vsize: 58 });
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, cakeTop, cakeCubes, iceTea };
