// Act II (30.75 - 60s): seasoning, beef, noodles, assembly, the pour, the steam, herbs, lime & chili, served.
const L = require('./lib'); const P = require('./props'); const PP = require('./pprops'); const X = require('./text');
const { createCanvas } = require('@napi-rs/canvas');
const { W, H, TAU, rng, clamp, lerp, inv, ease, cam, at, glow, flare, godRays, dust, bokeh, flakes, sparkle } = L;
const { ell, layer } = P;
const { COL, mixc, rgba } = PP;

// ---------------------------------------------------------------- helpers
function fillGrad(ctx, stops, x0 = 0, y0 = 0, x1 = 0, y1 = H) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
}
// dark stall backdrop with soft lamp bokeh
function stallBack(ctx, t, seed = 3, warm = 1) {
  fillGrad(ctx, ['#14121c', '#2a1f1c', '#1a1414']);
  glow(ctx, 860, 360, 700, 'rgba(255,170,90,0.5)', 0.55 * warm);
  glow(ctx, 160, 700, 520, 'rgba(120,130,200,0.35)', 0.5);
  bokeh(ctx, t, seed, 16, ['rgba(255,200,120,0.9)', 'rgba(255,170,90,0.8)', 'rgba(170,180,255,0.6)'], 0.32, 30, 110);
}
// wooden table seen from above (planks run vertically)
function woodTop(ctx, seed = 11, dark = 0) {
  const r = rng(seed);
  ctx.fillStyle = mixc('#6e4426', '#3a2416', dark); ctx.fillRect(-200, -200, W + 400, H + 400);
  const pw = 200;
  for (let i = -2; i < 8; i++) {
    const x0 = i * pw - 60, tone = r();
    ctx.fillStyle = mixc(mixc('#8a5a34', '#5e3a20', tone), '#2e1c10', dark); ctx.fillRect(x0, -200, pw - 6, H + 400);
    ctx.strokeStyle = rgba(mixc('#4a2c16', '#24160c', dark), 0.45); ctx.lineWidth = 2;
    for (let q = 0; q < 9; q++) {
      const gx = x0 + 10 + r() * (pw - 26), ph = r() * 6;
      ctx.beginPath(); ctx.moveTo(gx, -200);
      for (let y = -200; y <= H + 200; y += 120) ctx.lineTo(gx + Math.sin(y * 0.004 + ph) * 10, y);
      ctx.stroke();
    }
    if (r() < 0.6) { const kx = x0 + 40 + r() * 110, ky = r() * H; ctx.strokeStyle = 'rgba(40,22,10,0.4)'; for (let k = 1; k < 4; k++) { ell(ctx, kx, ky, 8 * k, 20 * k); ctx.stroke(); } }
    ctx.fillStyle = 'rgba(20,10,4,0.55)'; ctx.fillRect(x0 + pw - 6, -200, 6, H + 400);
    ctx.fillStyle = 'rgba(255,220,170,0.06)'; ctx.fillRect(x0, -200, 4, H + 400);
  }
}
// warm vignette light pool from a lamp (for top-down shots)
function lampPool(ctx, x, y, r, a = 0.5) {
  glow(ctx, x, y, r, 'rgba(255,190,110,0.8)', a);
}
// knife in profile: origin = heel of the edge, blade toward +x (tip), handle toward -x, edge along y = 0
function knife(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    const blade = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(300, 0); ctx.quadraticCurveTo(350, -6, 372, -40); ctx.quadraticCurveTo(250, -72, 0, -78); ctx.closePath(); };
    blade(); const g = ctx.createLinearGradient(0, -80, 0, 0); g.addColorStop(0, '#5e6268'); g.addColorStop(0.25, '#e8ecf0'); g.addColorStop(0.7, '#a6abb2'); g.addColorStop(1, '#f6f8fa');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(300, -4); ctx.quadraticCurveTo(340, -8, 360, -30); ctx.lineTo(352, -26); ctx.quadraticCurveTo(330, -10, 300, -11); ctx.lineTo(0, -11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,44,50,0.6)'; ctx.lineWidth = 2; blade(); ctx.stroke();
    // bolster + handle
    ctx.fillStyle = '#8a8e94'; ctx.fillRect(-14, -74, 16, 66);
    const hg = ctx.createLinearGradient(0, -66, 0, -14); hg.addColorStop(0, '#5a3418'); hg.addColorStop(0.4, '#8a5428'); hg.addColorStop(1, '#3a200c');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(-190, -66, 178, 52, 22); ctx.fill();
    ctx.fillStyle = '#d8dce0'; for (const rx of [-150, -95, -45]) { ell(ctx, rx, -40, 6, 6); ctx.fill(); }
  });
}
// thin pour stream sampled along a gravity curve between u0..u1 (0 = mouth, 1 = impact)
function pourStream(ctx, x0, y0, x1, y1, w, u0, u1, cols, t) {
  if (u1 <= u0) return;
  const cx = lerp(x0, x1, 0.75), cy = y0 + (y1 - y0) * 0.12;
  const pt = (u) => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = (dx, wob) => { ctx.beginPath(); for (let i = 0; i <= 24; i++) { const u = lerp(u0, u1, i / 24), p = pt(u); const ox = Math.sin(u * 18 - t * 30) * wob * u; i ? ctx.lineTo(p[0] + dx + ox, p[1]) : ctx.moveTo(p[0] + dx + ox, p[1]); } };
  ctx.strokeStyle = cols[0]; ctx.lineWidth = w; path(0, 2); ctx.stroke();
  ctx.strokeStyle = cols[1]; ctx.lineWidth = w * 0.55; path(-w * 0.1, 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,215,0.85)'; ctx.lineWidth = Math.max(1.5, w * 0.14); path(-w * 0.25, 2); ctx.stroke();
  ctx.restore();
  return pt;
}
// expanding ripple rings
function ripples(ctx, x, y, age, rx, ry, n = 3, col = 'rgba(255,236,190,', a = 0.7, sp = 1) {
  if (age < 0) return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = age * sp - i * 0.18; if (ph <= 0 || ph > 1.2) continue;
    ctx.strokeStyle = col + (a * Math.max(0, 1 - ph / 1.2)) + ')'; ctx.lineWidth = 3 + 3 * (1 - ph);
    ell(ctx, x, y, rx * (0.2 + ph), ry * (0.2 + ph)); ctx.stroke();
  }
  ctx.restore();
}
// glossy droplets (slow-motion): returns nothing, draws n drops from (x,y)
function drops(ctx, age, seed, n, x, y, o = {}) {
  if (age < 0) return;
  const r = rng(seed), g = o.g || 1400, sp = o.speed || 500, life = o.life || 1, col = o.col || [255, 214, 140];
  for (let i = 0; i < n; i++) {
    const a = (o.angle === undefined ? -Math.PI / 2 : o.angle) + (r() - 0.5) * (o.spread || 2.2), v = sp * (0.35 + r() * 0.75), sz = (o.size || 8) * (0.5 + r() * 0.8), dl = r() * (o.stagger || 0);
    const tt = (age - dl) * (o.slow || 1); if (tt < 0 || tt > life) continue;
    const px = x + Math.cos(a) * v * tt, py = y + Math.sin(a) * v * tt + 0.5 * g * tt * tt;
    const vy = Math.sin(a) * v + g * tt, vx = Math.cos(a) * v, stretch = 1 + Math.min(1.2, Math.hypot(vx, vy) / 1400);
    const al = 1 - Math.pow(tt / life, 3);
    at(ctx, px, py, Math.atan2(vy, vx) - Math.PI / 2, 1, 1, () => {
      ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.85 * al})`; ell(ctx, 0, 0, sz, sz * stretch); ctx.fill();
      ctx.fillStyle = `rgba(255,255,250,${0.9 * al})`; ell(ctx, -sz * 0.3, -sz * 0.3 * stretch, sz * 0.32, sz * 0.32 * stretch); ctx.fill();
    });
  }
}
// fall-then-settle helper: k in 0..1 for the drop, plus squash bounce after landing
function landing(lt, tLand, dur = 0.3) {
  const k = clamp(1 - (tLand - lt) / dur);          // 0 at start of fall, 1 at landing
  const after = lt - tLand;
  const sq = after > 0 ? Math.exp(-after * 9) * Math.sin(after * 30) * 0.12 : 0;
  return { k, after, sq, landed: after >= 0 };
}
function scallionRings(ctx, R, n, seed, k = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = R * Math.sqrt(r()) * 0.8, px = Math.cos(a) * d, py = Math.sin(a) * d, rr = R * (0.022 + r() * 0.016);
    const white = r() < 0.18, c0 = white ? '#f4f8e4' : (r() < 0.5 ? '#3f9a26' : '#5cc036');
    if (r() > k) continue;
    ctx.fillStyle = 'rgba(40,30,8,0.4)'; ell(ctx, px + rr * 0.3, py + rr * 0.35, rr * 1.08, rr * 0.92); ctx.fill();
    ctx.fillStyle = white ? '#9fb878' : '#24601a'; ell(ctx, px, py, rr * 1.12, rr * 0.96); ctx.fill();
    ctx.fillStyle = c0; ell(ctx, px, py, rr, rr * 0.85); ctx.fill();
    ctx.fillStyle = white ? '#d6e6b0' : '#d2f0a0'; ell(ctx, px, py, rr * 0.5, rr * 0.42); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, px - rr * 0.4, py - rr * 0.4, rr * 0.22, rr * 0.16); ctx.fill();
  }
}
function onionRings(ctx, R, n, seed, sc = 1) {
  const r = rng(seed);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = (r() - 0.5) * R * 1.3, py = (r() - 0.5) * R * 1.3, rr = R * (0.08 + r() * 0.07) * sc, a0 = r() * TAU, a1 = a0 + 2.2 + r() * 1.2;
    ctx.strokeStyle = 'rgba(70,36,40,0.5)'; ctx.lineWidth = R * 0.036 * sc; ctx.beginPath(); ctx.arc(px + 3, py + 5, rr, a0, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,90,150,0.85)'; ctx.lineWidth = R * 0.03 * sc; ctx.beginPath(); ctx.arc(px, py, rr, a0, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,252,246,1)'; ctx.lineWidth = R * 0.018 * sc; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = R * 0.006 * sc; ctx.beginPath(); ctx.arc(px, py, rr - R * 0.004, a0 + 0.2, a0 + 1.2); ctx.stroke();
  }
}
// thin, translucent pink-brown beef slices fanned (shingled) over the noodles. Origin = bowl centre, R = contents radius.
function fanBeef(ctx, R, o = {}) {
  const r = rng(o.seed || 91), n = o.n || 7, fx = (o.fx || 0) * R, fy = (o.fy || 0) * R;
  const a0 = o.a0 === undefined ? -2.4 : o.a0, step = o.step || 0.3, len = R * (o.len || 0.4), wid = len * 0.42;
  for (let i = 0; i < n; i++) {
    const ang = a0 + i * step + (r() - 0.5) * 0.08, d = R * (o.d || 0.2) + (r() - 0.5) * R * 0.03;
    const cx = fx + Math.cos(ang) * d, cy = fy + Math.sin(ang) * d, cook = (o.cook || 0.55) + (r() - 0.5) * 0.35;
    const L = len * (0.85 + r() * 0.3), Wd = wid * (0.8 + r() * 0.35);
    const pts = [];
    for (let q = 0; q < 12; q++) { const a = q / 12 * TAU, rr = 1 + (r() - 0.5) * 0.16; pts.push([Math.cos(a) * L * 0.5 * rr, Math.sin(a) * Wd * 0.5 * rr * (Math.cos(a) > 0 ? 0.85 : 1.1)]); }
    const path = (s = 1) => { ctx.beginPath(); for (let q = 0; q <= 12; q++) { const p = pts[q % 12], nn = pts[(q + 1) % 12]; const mx = (p[0] + nn[0]) / 2 * s, my = (p[1] + nn[1]) / 2 * s; q ? ctx.quadraticCurveTo(p[0] * s, p[1] * s, mx, my) : ctx.moveTo(mx, my); } ctx.closePath(); };
    at(ctx, cx + L * 0.5 * Math.cos(ang), cy + L * 0.5 * Math.sin(ang), ang + (r() - 0.5) * 0.15, 1, 1, () => {
      // soft shadow on the noodles
      ctx.save(); ctx.translate(R * 0.012, R * 0.02); path(1.02); ctx.fillStyle = 'rgba(90,45,10,0.28)'; ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha *= 0.86;
      path(); const g = ctx.createLinearGradient(0, -Wd * 0.5, 0, Wd * 0.5);
      g.addColorStop(0, mixc('#f2a2a8', '#c8a294', cook)); g.addColorStop(0.55, mixc('#de7484', '#a8806e', cook)); g.addColorStop(1, mixc('#b84a5a', '#7e5a4a', cook));
      ctx.fillStyle = g; ctx.fill();
      // pink, translucent rare heart
      ctx.globalAlpha *= 0.7 * (1 - 0.6 * clamp(cook)); path(0.7 - cook * 0.35); ctx.fillStyle = 'rgba(238,128,140,0.75)'; ctx.fill();
      ctx.restore();
      ctx.save(); path(); ctx.clip();
      // marbling + grain
      ctx.strokeStyle = 'rgba(255,240,232,0.55)'; ctx.lineCap = 'round';
      for (let m = 0; m < 5; m++) { const sx = (r() - 0.5) * L * 0.8, sy = (r() - 0.5) * Wd * 0.7; ctx.lineWidth = R * (0.003 + r() * 0.004); ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + L * 0.08, sy + (r() - 0.5) * Wd * 0.3, sx + L * (0.12 + r() * 0.15), sy + (r() - 0.5) * Wd * 0.2); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(120,50,50,0.18)'; ctx.lineWidth = R * 0.002;
      for (let m = -3; m <= 3; m++) { ctx.beginPath(); ctx.moveTo(-L * 0.5, m * Wd * 0.12); ctx.quadraticCurveTo(0, m * Wd * 0.12 + Wd * 0.06, L * 0.5, m * Wd * 0.1); ctx.stroke(); }
      // glossy highlight
      ctx.fillStyle = 'rgba(255,248,240,0.38)'; ctx.beginPath(); ctx.ellipse(-L * 0.08, -Wd * 0.22, L * 0.3, Wd * 0.07, -0.05, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-L * 0.15, -Wd * 0.24, L * 0.1, Wd * 0.025, -0.05, 0, TAU); ctx.fill();
      ctx.restore();
      path(); ctx.strokeStyle = rgba(mixc('#f8c0c4', '#c8a898', cook), 0.8); ctx.lineWidth = R * 0.004; ctx.stroke();
    });
  }
}

// shared bowl framing for s14 / s15
const BX = 540, BY = 900, BR = 440;

// ================================================================ s11  fish sauce & rock sugar
function s11(ctx, lt, p, T) {
  const t0 = 30.75, t1 = 33.75;
  ctx.fillStyle = '#1a120c'; ctx.fillRect(0, 0, W, H);
  const z = lerp(1.0, 1.12, ease.inOut(p));
  const amber = ease.inOut(inv(1.55, 2.9, lt));
  const pourOn = inv(0.0, 0.35, lt) * (1 - inv(1.25, 1.55, lt));
  const brot = lerp(-1.35, -2.3, ease.out(pourOn));
  const bs = 1.8, bx = 990 + 60 * (1 - pourOn), by = 240 - 90 * (1 - pourOn);
  const mouth = [bx + 272 * bs * Math.sin(brot), by - 272 * bs * Math.cos(brot)];
  const IMP = [600, 980];
  cam(ctx, 560, 980, z, 0, () => {
    PP.potTop(ctx, 520, 1060, 1350, { clarity: lerp(0.62, 1, amber), t: lt + 20, simmer: 0.55, fat: 0.7 + 0.3 * amber, bones: false, onion: false, anise: false, seed: 9 });
    [[170, 640, 0.3], [900, 1330, 1.7], [330, 1660, 2.6], [960, 520, 4.1]].forEach(([x, y, r], i) => PP.starAnise(ctx, x + Math.sin(lt * 0.7 + i) * 8, y, 2.3, r + lt * 0.05, { toast: 0.4 }));
    PP.cinnamonStick(ctx, 230 + lt * 6, 1330, 2.2, 0.35 + lt * 0.02);
    // fish sauce cloud spreading from the impact point
    const cloud = inv(0.45, 2.2, lt);
    if (cloud > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      const cg = ctx.createRadialGradient(IMP[0], IMP[1], 0, IMP[0], IMP[1], 120 + 360 * cloud);
      cg.addColorStop(0, `rgba(150,70,20,${0.55 * (1 - 0.6 * cloud)})`); cg.addColorStop(1, 'rgba(150,70,20,0)');
      ctx.fillStyle = cg; ctx.fillRect(IMP[0] - 600, IMP[1] - 600, 1200, 1200); ctx.restore();
    }
    // the broth warming to amber
    glow(ctx, 520, 1000, 900, 'rgba(255,165,55,0.7)', 0.45 * amber);
    glow(ctx, 420, 1150, 360, 'rgba(255,215,130,0.9)', 0.5 * amber * (1 - inv(2.4, 3, lt) * 0.5));
    // fish-sauce stream
    const u1 = ease.in(inv(0.3, 0.46, lt)), u0 = ease.in(inv(1.3, 1.48, lt));
    if (u1 > u0) {
      pourStream(ctx, mouth[0], mouth[1], IMP[0], IMP[1], 19, u0, u1, ['rgba(110,40,8,0.95)', 'rgba(200,100,30,0.95)'], lt);
      if (u1 >= 1 && u0 < 1) {
        ripples(ctx, IMP[0], IMP[1], (lt * 3) % 1, 110, 45, 2, 'rgba(255,220,160,', 0.6, 1);
        drops(ctx, (lt * 2.5) % 1, 21 + Math.floor(lt * 2.5), 6, IMP[0], IMP[1] - 6, { speed: 360, g: 1600, life: 0.5, size: 5, col: [150, 60, 18] });
      }
    }
    if (lt > 1.48) ripples(ctx, IMP[0], IMP[1], lt - 1.48, 140, 60, 2, 'rgba(255,220,160,', 0.5, 0.9);
    // rock sugar: drop and plop on the beat (T = 32.25)
    const SUG = [400, 1170];
    const L1 = landing(lt, 1.5, 0.32);
    if (!L1.landed && L1.k > 0) {
      const sy = lerp(-250, SUG[1], ease.in2 ? ease.in2(L1.k) : L1.k * L1.k), sc = lerp(3.4, 2.2, L1.k);
      for (let g = 3; g >= 1; g--) { ctx.globalAlpha = 0.18; PP.rockSugar(ctx, SUG[0], sy - g * 60, sc, 0.6 + L1.k * 2 - g * 0.1, { seed: 5 }); }
      ctx.globalAlpha = 1; PP.rockSugar(ctx, SUG[0], sy, sc, 0.6 + L1.k * 2, { seed: 5 });
    }
    if (L1.landed) {
      const sk = inv(0.15, 1.4, L1.after);
      ctx.globalAlpha = (1 - sk) * 0.9; PP.rockSugar(ctx, SUG[0], SUG[1] + sk * 20, 2.2 * (1 - 0.35 * sk), 2.6, { seed: 5 }); ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(160,90,20,${0.35 * sk})`; ell(ctx, SUG[0], SUG[1], 70 * (1 - 0.3 * sk), 50); ctx.fill();
      ripples(ctx, SUG[0], SUG[1], L1.after, 230, 120, 3, 'rgba(255,240,200,', 0.85, 0.9);
      drops(ctx, L1.after, 77, 22, SUG[0], SUG[1] - 10, { speed: 760, g: 2200, life: 0.75, size: 9, spread: 1.6, col: [255, 196, 110] });
      glow(ctx, SUG[0], SUG[1], 260, 'rgba(255,230,170,0.8)', 0.6 * Math.exp(-L1.after * 3));
      sparkle(ctx, SUG[0] + 30, SUG[1] - 30, 60, 0.9 * Math.exp(-L1.after * 4));
    }
    PP.richSteam(ctx, lt + 3, 41, 540, 1500, 900, 1500, 0.38, { n: 12 });
  });
  // bottle (in front, slightly soft-focus)
  layer(ctx, 3, (x) => {
    x.clearRect(0, 0, W, H);
    cam(x, 560, 980, z, 0, () => PP.fishSauceBottle(x, bx, by, bs, brot, { level: lerp(0.7, 0.45, inv(0.3, 1.4, lt)) }));
  });
  glow(ctx, 1000, 120, 520, 'rgba(255,190,110,0.6)', 0.45);
  X.caption(ctx, T, t0 + 0.25, t1 - 0.2, 'Nước mắm, đường phèn', 'Fish sauce & rock sugar', { n: 6 });
}

// ================================================================ s12  paper-thin rare beef
function beefFace(ctx, x, y, s, o = {}) {
  // the cut face of a beef eye-round looking at camera: marbled red oval with a fat cap
  const r = rng(o.seed || 12), sh = o.alpha === undefined ? 1 : o.alpha;
  at(ctx, x, y, 0, s, s, () => {
    ctx.globalAlpha *= sh;
    const shape = () => { ctx.beginPath(); ctx.moveTo(-170, 0); ctx.bezierCurveTo(-190, -120, -110, -175, 0, -178); ctx.bezierCurveTo(120, -176, 196, -110, 176, 0); ctx.closePath(); };
    shape(); const g = ctx.createRadialGradient(-40, -120, 10, 0, -80, 220); g.addColorStop(0, o.light ? '#f08a96' : '#e05a68'); g.addColorStop(0.6, o.light ? '#d65264' : '#b8303f'); g.addColorStop(1, '#801a28'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    ctx.fillStyle = '#f6e8da'; ctx.beginPath(); ctx.moveTo(-200, -150); ctx.bezierCurveTo(-80, -160, 80, -170, 200, -146); ctx.lineTo(200, -200); ctx.lineTo(-200, -200); ctx.fill();
    // silverskin seam + marbling
    ctx.strokeStyle = 'rgba(255,240,236,0.75)'; ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const sx = (r() - 0.5) * 320, sy = -20 - r() * 130, len = 18 + r() * 46, a = (r() - 0.5) * 2;
      ctx.lineWidth = 1.5 + r() * 2.6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + Math.cos(a) * len * 0.5 + (r() - 0.5) * 16, sy + Math.sin(a) * len * 0.5, sx + Math.cos(a) * len, sy + Math.sin(a) * len); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-60, -110, 70, 18, -0.2, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(90,10,20,0.5)'; ctx.lineWidth = 3; shape(); ctx.stroke();
  });
}
function s12(ctx, lt, p, T) {
  const t0 = 33.75, t1 = 36.75;
  const mix = ease.inOut(inv(1.75, 2.05, lt));
  if (mix < 1) {
    // ---- part 1: the knife glides down the face of the beef, slices peel toward camera
    stallBack(ctx, lt, 5);
    const z = lerp(1.0, 1.22, ease.inOut(inv(0, 2, lt)));
    cam(ctx, 540, 1080, z, 0, () => {
      // second beef block resting behind the board (fills the depth)
      ctx.save(); ctx.globalAlpha *= 0.9; PP.beefBlock(ctx, 850, 1235, 0.95, -0.04); ctx.restore();
      ctx.translate(540, 1470); ctx.scale(1.2, 1.2); ctx.translate(-540, -1200);
      // board (round tree-slice) in perspective
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ell(ctx, 540, 1250, 520, 120); ctx.fill();
      ctx.fillStyle = '#6a4224'; ell(ctx, 540, 1215, 500, 110); ctx.fill(); ctx.fillRect(40, 1215, 1000, 34); ell(ctx, 540, 1249, 500, 110); ctx.fill();
      const bg = ctx.createRadialGradient(480, 1190, 20, 540, 1200, 500); bg.addColorStop(0, '#d8a46a'); bg.addColorStop(1, '#a0683a');
      ctx.fillStyle = bg; ell(ctx, 540, 1200, 500, 110); ctx.fill();
      ctx.strokeStyle = 'rgba(110,64,30,0.35)'; ctx.lineWidth = 2; for (let k = 1; k < 7; k++) { ell(ctx, 540, 1200, 70 * k, 15.4 * k); ctx.stroke(); }
      // stack of cut slices in front (foreground, shingled)
      const nCut = (lt > 0.55 ? 1 : 0) + (lt > 1.3 ? 1 : 0) + (lt > 2.05 ? 1 : 0);
      const strokes = [0.15, 0.9, 1.65];
      const beefY = 1180;
      beefFace(ctx, 520, beefY, 1.25, { seed: 12 });
      strokes.forEach((ts, i) => {
        const k = inv(ts, ts + 0.45, lt), fall = inv(ts + 0.38, ts + 0.62, lt);
        if (k <= 0) return;
        // knife: from above the meat down to the board with a back-and-forth glide
        if (k < 1 || fall < 0.25) {
          const ky = lerp(beefY - 250, beefY + 4, ease.inOut(k)), kx = 300 + Math.sin(k * Math.PI) * 90 - 40 * k;
          if (i === strokes.findIndex((s0) => lt < s0 + 0.62) || (k < 1)) knife(ctx, kx, ky, 1.25, -0.04);
        }
        // the slice tips forward and drops onto the pile
        if (fall > 0 && fall < 1) {
          at(ctx, 520, beefY, 0, 1, 1 - 1.15 * ease.in(fall), () => { ctx.globalAlpha = 0.97; beefFace(ctx, 0, 0, 1.25, { seed: 12 + i, light: true }); ctx.globalAlpha = 1; });
        }
      });
      // landed slices: fanned, flat, foreground
      for (let i = 0; i < nCut; i++) {
        const ts = strokes[i] + 0.62, sq = Math.exp(-(lt - ts) * 10) * 0.1;
        at(ctx, 600 + i * 70, 1305 + i * 8, -0.15 + i * 0.12, 1, 0.42 * (1 - sq), () => PP.beefSlice(ctx, 0, 0, 1.9, 0, { seed: i + 2 }));
      }
      // active knife on top while gliding
      const act = strokes.find((ts) => lt >= ts && lt < ts + 0.75);
      if (act !== undefined) {
        const k = inv(act, act + 0.45, lt), up = inv(act + 0.5, act + 0.75, lt);
        const ky = lerp(lerp(beefY - 250, beefY + 4, ease.inOut(k)), beefY - 250, ease.inOut(up)), kx = 300 + Math.sin(k * Math.PI) * 90 - 40 * k + 40 * up;
        knife(ctx, kx, ky, 1.25, -0.04);
        if (k > 0.1 && k < 1) sparkle(ctx, kx + 420, ky - 30, 50, 0.7 * Math.sin(k * Math.PI));
      }
    });
    glow(ctx, 900, 280, 400, 'rgba(255,200,130,0.6)', 0.35);
    // out-of-focus foreground bokeh along the bottom
    { const r = rng(121); for (let i = 0; i < 7; i++) { const bx = r() * W, by = 1640 + r() * 300, br = 70 + r() * 90; glow(ctx, bx + Math.sin(lt * 0.6 + i) * 12, by, br, r() < 0.6 ? 'rgba(255,180,100,0.9)' : 'rgba(160,170,255,0.7)', 0.22); } }
  }
  if (mix > 0) {
    // ---- part 2: one slice held up against the lamp, glowing translucent
    ctx.save(); ctx.globalAlpha = mix;
    const lt2 = lt - 1.75, z2 = lerp(1.0, 1.1, inv(0, 1.25, lt2));
    fillGrad(ctx, ['#0e0c14', '#1e1418', '#120e10']);
    cam(ctx, 540, 900, z2, 0, () => {
      const LX = 600, LY = 800;
      glow(ctx, LX, LY, 900, 'rgba(255,160,70,0.65)', 0.75);
      glow(ctx, LX, LY, 380, 'rgba(255,215,150,0.95)', 0.9);
      godRays(ctx, LX, LY, Math.PI * 0.55, 1.6, 1500, 9, 'rgba(255,200,130,0.35)', 0.5, lt);
      // bulb
      ctx.fillStyle = '#fff6dc'; ell(ctx, LX, LY, 46, 58); ctx.fill(); glow(ctx, LX, LY, 120, 'rgba(255,250,230,1)', 1);
      // slice hanging from chopsticks, the lamp right behind it so it glows through
      const sw = Math.sin(lt2 * 2.2) * 0.05, SX = 560, SY = 560;
      at(ctx, SX, SY, sw, 1, 1, () => {
        glow(ctx, 30, 260, 360, 'rgba(255,110,100,0.8)', 0.5);
        ctx.save(); ctx.globalAlpha *= 0.52; PP.beefSlice(ctx, 0, 250, 3.3, Math.PI / 2 + 0.06, { seed: 4, curl: 0.08 }); ctx.restore();
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= 0.5; PP.beefSlice(ctx, 0, 250, 3.3, Math.PI / 2 + 0.06, { seed: 4, curl: 0.08 }); ctx.restore();
        glow(ctx, 40, 230, 230, 'rgba(255,200,170,0.95)', 0.5);
        PP.chopsticksPair(ctx, -6, 18, 2.4, -2.2, 0.06);
      });
      flare(ctx, LX, LY, 1.1, 0.7);
      dust(ctx, lt2, 9, 40, 100, 300, 900, 1200, '255,220,170', 2.5, 0.6);
    });
    ctx.restore();
  }
  X.caption(ctx, T, t0 + 0.25, t1 - 0.2, 'Thái bò tái', 'Paper-thin rare beef', { n: 7 });
}

// ================================================================ s13  blanch the noodles
function s13(ctx, lt, p, T) {
  const t0 = 36.75, t1 = 39.75;
  stallBack(ctx, lt + 4, 8);
  const PX = 580, RY = 1120, RX = 480, RK = 0.24;
  // strainer motion
  const dip = ease.inOut(inv(0.0, 0.45, lt)), lift = ease.inOut(inv(1.45, 1.95, lt));
  const shake = lt > 1.95 ? Math.exp(-(lt - 1.95) * 1.6) : 0;
  const swirl = lt > 0.45 && lt < 1.5 ? Math.sin((lt - 0.45) * 9) : 0;
  const sx = PX + 40 + swirl * 30 + Math.sin(lt * 26) * 16 * shake;
  const sy = lerp(lerp(RY - 330, RY + 60, dip), RY - 300, lift) + Math.abs(Math.sin(lt * 26)) * -30 * shake;
  const srot = -0.08 + swirl * 0.05 + Math.sin(lt * 26) * 0.1 * shake + lift * 0.06;
  const cs = 1.9;
  const z = lerp(1.04, 1.0, p);
  cam(ctx, 560, 1100, z, 0, () => {
    // pot back wall + water
    ctx.fillStyle = '#4c4e52'; ell(ctx, PX, RY, RX + 18, (RX + 18) * RK); ctx.fill();
    const ig = ctx.createLinearGradient(0, RY - RX * RK, 0, RY + RX * RK); ig.addColorStop(0, '#2c2e33'); ig.addColorStop(1, '#8a8e94');
    ctx.fillStyle = ig; ell(ctx, PX, RY, RX, RX * RK); ctx.fill();
    ctx.save(); ell(ctx, PX, RY + 14, RX - 8, (RX - 8) * RK); ctx.clip();
    const wg = ctx.createRadialGradient(PX - 100, RY - 10, 20, PX, RY + 14, RX); wg.addColorStop(0, '#f2f4ee'); wg.addColorStop(0.5, '#b8c4c4'); wg.addColorStop(1, '#5a6668');
    ctx.fillStyle = wg; ctx.fillRect(PX - RX, RY - RX * RK, 2 * RX, 2 * RX * RK + 30);
    // rolling boil
    const br = rng(13);
    for (let i = 0; i < 46; i++) {
      const ph = (lt * (1.2 + br()) + br()) % 1, bx = PX + (br() - 0.5) * RX * 1.8, by = RY + 14 + (br() - 0.5) * RX * RK * 1.6, rr = 8 + br() * 18;
      ctx.fillStyle = `rgba(255,255,255,${0.5 * Math.sin(ph * Math.PI)})`; ell(ctx, bx, by, rr * ph, rr * ph * 0.5); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * Math.sin(ph * Math.PI)})`; ctx.lineWidth = 2; ell(ctx, bx, by - 2, rr * ph, rr * ph * 0.5); ctx.stroke();
    }
    ctx.restore();
    // strainer (basket hides behind the front wall when dipped)
    PP.bambooStrainer(ctx, sx, sy, cs, srot, { t: lt, wet: lt > 1.6 ? 1 : 0, noodles: 1 });
    // where the handle meets the water
    if (dip > 0.6 && lift < 0.5) { ripples(ctx, sx, RY + 10, (lt * 2) % 1, 160, 40, 2, 'rgba(255,255,255,', 0.6, 1); }
    // front wall
    ctx.beginPath(); ctx.moveTo(PX - RX - 18, RY); ctx.ellipse(PX, RY, RX + 18, (RX + 18) * RK, 0, Math.PI, 0, true); ctx.lineTo(PX + RX + 30, H + 100); ctx.lineTo(PX - RX - 30, H + 100); ctx.closePath();
    ctx.fillStyle = P.metalGrad(ctx, PX - RX - 30, PX + RX + 30, 1); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(PX - RX - 40, RY + 200, 2 * RX + 80, 900);
    ctx.strokeStyle = '#e8e6e2'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(PX, RY, RX + 16, (RX + 16) * RK, 0, 0, Math.PI); ctx.stroke();
    // splash + streaming water as it lifts out
    if (lt > 1.6 && lt < 2.6) {
      const a = 1 - inv(2.1, 2.6, lt);
      ctx.save(); ctx.globalAlpha = a;
      for (let i = 0; i < 5; i++) { const xx = sx - 60 + i * 30 + Math.sin(i * 3 + lt * 20) * 4; const len = 140 + 120 * Math.sin(i * 1.7 + 0.5); ctx.strokeStyle = 'rgba(235,245,255,0.75)'; ctx.lineWidth = 6 - i % 2 * 2; ctx.beginPath(); ctx.moveTo(xx, sy + 150 * cs * 0.6); ctx.lineTo(xx + 4, sy + 150 * cs * 0.6 + len); ctx.stroke(); }
      ctx.restore();
    }
    if (lt > 1.95) drops(ctx, lt - 1.95, 31, 26, sx, sy + 120, { speed: 520, g: 1700, life: 0.9, size: 7, spread: 3, stagger: 0.5, col: [225, 238, 255] });
    // hand on the handle end
    const he = [sx + (-470 * Math.cos(srot) - (-6) * Math.sin(srot)) * cs, sy + (-470 * Math.sin(srot) + (-6) * Math.cos(srot)) * cs];
    P.forearm(ctx, he[0] - 300, he[1] + 380, he[0] - 10, he[1] + 30, COL.skinTu[1], '#7a5236', 74);
    P.hand(ctx, he[0], he[1], 1.0, srot - 0.15, 'fist', [COL.skinTu[0], COL.skinTu[2]]);
    PP.richSteam(ctx, lt, 23, PX, RY - 20, 760, 1200, 0.55, { n: 14 });
  });
  glow(ctx, 900, 300, 520, 'rgba(255,190,110,0.6)', 0.3);
  X.caption(ctx, T, t0 + 0.25, t1 - 0.2, 'Chần bánh phở', 'Blanch the rice noodles', { n: 8 });
}

// ================================================================ s14  noodles into the bowl (top-down)
function s14(ctx, lt, p, T) {
  const t0 = 39.75, t1 = 42;
  woodTop(ctx, 11);
  lampPool(ctx, 620, 760, 900, 0.35);
  const L1 = landing(lt, 0.75, 0.42);
  const nood = L1.landed ? ease.outBack(clamp(L1.after / 0.3)) : 0;
  const z = lerp(1.0, 1.08, ease.inOut(p)), rot = lerp(-0.03, 0.03, p);
  cam(ctx, BX, BY, z, rot, () => {
    PP.phoBowlTop(ctx, BX, BY, BR, { fill: 0, noodles: clamp(nood), beef: 0, scallion: 0, onion: 0, seed: 77 });
    if (!L1.landed && L1.k > 0) {
      const k = ease.in(L1.k), sc = lerp(3.4, 1.9, k), yy = lerp(BY - 900, BY, k);
      layer(ctx, 14 * (1 - k), (x) => { x.clearRect(0, 0, W, H); x.save(); x.setTransform(ctx.getTransform()); PP.noodleBundle(x, BX - 10, yy, sc, 0.3 - k * 0.3, { seed: 9 }); x.restore(); });
    }
    if (L1.landed) {
      ripples(ctx, BX, BY, L1.after * 1.6, BR * 0.7, BR * 0.7, 2, 'rgba(255,255,255,', 0.5, 1);
      drops(ctx, L1.after, 88, 18, BX, BY, { speed: 900, g: 2400, life: 0.5, size: 7, spread: TAU, angle: 0, col: [240, 244, 248] });
      PP.richSteam(ctx, lt, 37, BX, BY + 100, BR * 1.1, 1100, 0.45 * inv(0, 0.6, L1.after), { n: 10 });
    }
  });
  X.caption(ctx, T, t0 + 0.2, t1 - 0.15, 'Phở vào bát', 'Noodles in the bowl', { n: 9 });
}

// ================================================================ s15  toppings on the beat (top-down)
const COOKED = [[-0.42, -0.08, 0.5], [-0.3, 0.2, 2.2], [-0.48, 0.28, 1.4], [-0.18, -0.3, 0.2]];
const RARE = [[0.3, -0.25, 2.6], [0.42, 0.05, 1.7], [0.22, 0.28, 0.9], [0.05, -0.02, 2.0], [0.1, 0.45, 1.2]];
function s15(ctx, lt, p, T) {
  const t0 = 42, t1 = 45;
  woodTop(ctx, 11);
  lampPool(ctx, 620, 760, 900, 0.35);
  const beats = [0.75, 1.5, 2.25];
  const z = lerp(0.95, 1.02, ease.inOut(p)), rot = lerp(0.02, 0.05, p);
  cam(ctx, BX, BY, z, rot, () => {
    PP.phoBowlTop(ctx, BX, BY, BR, { fill: 0, noodles: 1, beef: 0, scallion: 0, onion: 0, seed: 77 });
    const rs = BR * 0.66;
    ctx.save(); ctx.translate(BX, BY); ell(ctx, 0, 0, rs, rs); ctx.clip();
    const drop = (tl, i, fn) => {
      const L1 = landing(lt, tl + i * 0.05, 0.28);
      if (L1.k <= 0) return;
      const k = ease.in(L1.k), sc = L1.landed ? 1 + L1.sq : lerp(1.9, 1, k), al = L1.landed ? 1 : 0.4 + 0.6 * k;
      ctx.save(); ctx.globalAlpha = al; ctx.scale(sc, sc); fn(); ctx.restore();
    };
    COOKED.forEach(([u, v, r], i) => drop(beats[0], i, () => PP.beefSlice(ctx, u * BR, v * BR, BR / 330, r, { cook: 1, seed: i + 11, curl: 0.15 })));
    RARE.forEach(([u, v, r], i) => drop(beats[1], i, () => PP.beefSlice(ctx, u * BR, v * BR, BR / 330, r, { cook: 0, seed: i + 3, curl: 0.15 })));
    drop(beats[2], 0, () => { onionRings(ctx, rs, 14, 5, 1.15); scallionRings(ctx, rs, 64, 6); });
    ctx.restore();
    // beat accents: glint + puff
    beats.forEach((b, i) => { const a = lt - b; if (a > 0 && a < 0.5) { sparkle(ctx, BX + [-120, 130, 40][i], BY + [-60, -100, 60][i], 90, (1 - a * 2) * 0.9); ripples(ctx, BX, BY, a * 2, BR * 0.5, BR * 0.5, 1, 'rgba(255,250,230,', 0.4, 1); } });
    // falling sprinkle before the third beat
    if (lt > 1.85 && lt < 2.35) {
      const r = rng(55);
      for (let i = 0; i < 26; i++) { const tl = 1.85 + r() * 0.25, k = inv(tl, tl + 0.2, lt), px = BX + (r() - 0.5) * rs * 1.4, py = BY + (r() - 0.5) * rs * 1.4; if (k <= 0 || k >= 1) continue; const sc = lerp(3, 1, k); ctx.fillStyle = r() < 0.7 ? '#5fae3e' : '#f4f2ea'; ell(ctx, px, py - (1 - k) * 200, 9 * sc, 8 * sc); ctx.fill(); }
    }
    PP.richSteam(ctx, lt + 2, 37, BX, BY + 100, BR * 1.1, 1100, 0.4, { n: 10 });
  });
  X.caption(ctx, T, t0 + 0.25, t1 - 0.2, 'Bò & hành', 'Beef, scallion, onion', { n: 10 });
}

// low-angle wooden table top (back edge at y0), planks converging to a vanishing point, with a warm lamp sheen
function tableLow(ctx, y0, seed = 4) {
  const r = rng(seed), VX = 540, VY = y0 - 900, y1 = H + 300;
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#2a1a10'); g.addColorStop(0.25, '#5a3820'); g.addColorStop(1, '#2c1a0e');
  ctx.fillStyle = g; ctx.fillRect(-300, y0, W + 600, y1 - y0);
  for (let i = -9; i <= 9; i++) {
    const xb = VX + i * 210, xt = VX + (xb - VX) * (y0 - VY) / (y1 - VY);
    ctx.strokeStyle = 'rgba(15,8,4,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xt, y0); ctx.lineTo(xb, y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,150,0.07)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xt + 4, y0); ctx.lineTo(xb + 8, y1); ctx.stroke();
    for (let q = 0; q < 3; q++) { const u = r(), xb2 = xb + 30 + u * 150, xt2 = VX + (xb2 - VX) * (y0 - VY) / (y1 - VY); ctx.strokeStyle = 'rgba(30,16,6,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xt2, y0); ctx.lineTo(xb2, y1); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,200,130,0.25)'; ctx.fillRect(-300, y0, W + 600, 3);
  glow(ctx, 600, y0 + 260, 700, 'rgba(255,180,100,0.7)', 0.35);
}

// ================================================================ s16  the boiling broth pour (slow-mo)
function s16(ctx, lt, p, T) {
  const t0 = 45, t1 = 48.75;
  stallBack(ctx, lt + 9, 14, 1.2);
  const fill = lerp(0.15, 1, ease.inOut(inv(0.05, 2.8, lt)));
  const cook = ease.inOut(inv(0.5, 3.4, lt));
  const pourK = 1 - inv(2.8, 3.2, lt);
  const z = lerp(1.0, 1.1, ease.out(p));
  const BXs = 540, BYs = 1330, bs = 2.05, k = 0.5;
  const rimY = BYs - 150 * bs;
  const tip = lerp(0.95, 0.15, inv(2.8, 3.3, lt));
  const LX = 330 + 30 * p, LY = rimY - 470 - 40 * (1 - pourK);
  const sp = PP.ladlePour(LX, LY, 1.5, { tip });
  const IMP = [BXs - 60, rimY + 30 + (1 - fill) * 80];
  cam(ctx, 540, 1150, z, 0, () => {
    tableLow(ctx, BYs - 230, 4);
    // soft reflection of the bowl in the varnished table + contact shadow
    ctx.save(); ctx.beginPath(); ctx.rect(-300, BYs - 4, W + 600, 900); ctx.clip();
    ctx.globalAlpha = 0.13; ctx.translate(0, 2 * BYs); ctx.scale(1, -1);
    PP.phoBowl(ctx, BXs, BYs, bs, { k, fill: 0, noodles: 0, beef: 0, scallion: 0, onion: 0, seed: 77 });
    ctx.restore();
    const rg = ctx.createLinearGradient(0, BYs, 0, BYs + 320); rg.addColorStop(0, 'rgba(44,26,14,0)'); rg.addColorStop(0.7, 'rgba(44,26,14,0.8)'); rg.addColorStop(1, 'rgba(44,26,14,0.9)'); ctx.fillStyle = rg; ctx.fillRect(-300, BYs, W + 600, 320);
    { const r2 = ctx.createLinearGradient(0, BYs + 320, 0, BYs + 800); r2.addColorStop(0, 'rgba(44,26,14,0.9)'); r2.addColorStop(1, 'rgba(44,26,14,0.35)'); ctx.fillStyle = r2; ctx.fillRect(-300, BYs + 320, W + 600, 480); }
    glow(ctx, BXs, BYs + 380, 520, 'rgba(255,170,90,0.6)', 0.22);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ell(ctx, BXs, BYs + 4, 170 * bs, 26 * bs); ctx.fill();
    PP.phoBowl(ctx, BXs, BYs, bs, { k, fill, cook, noodles: 1, beef: 0, scallion: 1, onion: 1, t: lt, seed: 77 });
    { const d = 8 + (1 - fill) * 92, rsb = 200 * (0.95 - (1 - fill) * 0.3);
      ctx.save(); ctx.translate(BXs, BYs); ctx.scale(bs, bs); ell(ctx, 0, -150, 193, 193 * k); ctx.clip();
      ctx.translate(0, -150 + d); ctx.scale(1, k); ctx.beginPath(); ctx.arc(0, 0, rsb, 0, TAU); ctx.clip();
      fanBeef(ctx, rsb, { n: 7, fx: 0.08, fy: 0.05, a0: -2.9, step: 0.36, d: 0.16, len: 0.46, cook: lerp(0.02, 0.8, cook), seed: 93 });
      ctx.restore(); }
    // ladle + stream
    PP.ladle(ctx, LX, LY, 1.5, -0.55, { tip, fill: 0.7 * pourK });
    if (pourK > 0.02) {
      const u0 = ease.in(inv(2.8, 3.05, lt));
      pourStream(ctx, sp[0], sp[1], IMP[0], IMP[1], 40, u0, 1, ['rgba(160,80,20,0.6)', 'rgba(255,200,110,0.92)'], lt * 0.35);
      // slow-mo splash crown
      if (u0 < 1) {
        ripples(ctx, IMP[0], IMP[1], (lt * 0.9) % 1, 200, 200 * k * 0.6, 3, 'rgba(255,236,180,', 0.7, 1);
        drops(ctx, (lt * 0.6) % 1, 3 + Math.floor(lt * 0.6), 20, IMP[0], IMP[1] - 8, { speed: 620, g: 1300, life: 1, size: 9, slow: 1, spread: 1.9, col: [255, 206, 120] });
        drops(ctx, ((lt + 0.5) * 0.6) % 1, 9 + Math.floor((lt + 0.5) * 0.6), 14, IMP[0] + 10, IMP[1] - 8, { speed: 520, g: 1300, life: 1, size: 7, spread: 2.2, col: [255, 226, 160] });
        glow(ctx, IMP[0], IMP[1], 240, 'rgba(255,220,150,0.9)', 0.45);
      }
    }
    PP.richSteam(ctx, lt * 0.6, 51, BXs, rimY + 20, 700, 1300, 0.55 + 0.35 * cook, { n: 18 });
  });
  glow(ctx, 880, 300, 600, 'rgba(255,180,100,0.6)', 0.35);
  X.caption(ctx, T, t0 + 0.3, t1 - 0.2, 'Chan nước sôi', 'Pour the boiling broth', { n: 11 });
}

// ================================================================ s17  steam in the lamp light (no caption)
function wisp(ctx, t, seed, x, y, h, w, col, a) {
  // a soft ribbon of steam: one continuous stroke whose alpha fades in at the surface and out at the top
  const r = rng(seed), ph = r() * TAU, sp = 0.5 + r() * 0.5, lean = (r() - 0.5) * 240, N = 46;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const g = ctx.createLinearGradient(0, y, 0, y - h);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.1, rgba(col, 1)); g.addColorStop(0.45, rgba(col, 0.55)); g.addColorStop(1, rgba(col, 0));
  ctx.strokeStyle = g;
  for (let pass = 0; pass < 3; pass++) {
    ctx.globalAlpha = a * [0.16, 0.3, 0.6][pass]; ctx.lineWidth = w * [5, 2.4, 0.9][pass];
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N, amp = 14 + 190 * Math.pow(u, 1.4);
      const xx = x + lean * u * u + Math.sin(u * 6.2 - t * 1.6 * sp + ph) * amp + Math.sin(u * 15 - t * 2.3 + ph * 2) * amp * 0.18;
      i ? ctx.lineTo(xx, y - u * h) : ctx.moveTo(xx, y - u * h);
    }
    ctx.stroke();
  }
  ctx.restore();
}
const S17 = {};
function s17(ctx, lt, p, T) {
  const LX = 790, LY = 330;
  fillGrad(ctx, ['#07060c', '#120d14', '#1c120e']);
  const cy = lerp(1010, 930, ease.inOut(p));
  cam(ctx, 540, cy, lerp(1.06, 1.0, p), 0, () => {
    // warm street lamp behind, slightly out of focus
    glow(ctx, LX, LY, 1300, 'rgba(255,150,60,0.55)', 0.85);
    glow(ctx, LX, LY, 520, 'rgba(255,200,120,0.9)', 0.8);
    godRays(ctx, LX, LY, Math.PI * 0.62, 1.3, 2000, 12, 'rgba(255,200,130,0.4)', 0.55, lt * 0.6);
    ctx.fillStyle = '#fff4d6'; ell(ctx, LX, LY, 34, 40); ctx.fill(); glow(ctx, LX, LY, 110, 'rgba(255,252,236,1)', 1);
    bokeh(ctx, lt, 71, 14, ['rgba(255,190,110,0.9)', 'rgba(255,150,80,0.8)', 'rgba(140,150,255,0.5)'], 0.35, 40, 120);
    // bowl rim in the foreground, dark, rim-lit (pre-rendered once, half-res + blurred = cheap DOF)
    if (!S17.bowl) {
      const a = createCanvas(750, 475), ax = a.getContext('2d');
      ax.scale(0.5, 0.5); ax.translate(200, -1450);
      PP.phoBowl(ax, 520, 2180, 3.2, { k: 0.3, fill: 1, cook: 1, t: 0, seed: 77 });
      ax.setTransform(1, 0, 0, 1, 0, 0); ax.globalCompositeOperation = 'source-atop'; ax.fillStyle = 'rgba(12,8,10,0.72)'; ax.fillRect(0, 0, 750, 475);
      const b = createCanvas(750, 475), bx = b.getContext('2d'); bx.filter = 'blur(3px)'; bx.drawImage(a, 0, 0);
      S17.bowl = b;
    }
    ctx.drawImage(S17.bowl, -200, 1450, 1500, 950);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,130,0.85)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(520, 2180 - 150 * 3.2, 200 * 3.2 - 6, (200 * 3.2 - 6) * 0.3, 0, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke(); ctx.restore();
    glow(ctx, 520, 1700, 600, 'rgba(255,170,80,0.6)', 0.35);
    // steam: lit wisps + soft volume
    PP.richSteam(ctx, lt * 0.7 + 5, 61, 520, 1750, 900, 1700, 0.55, { n: 18, col: '#ffe4b8' });
    // lit wisps drawn at half resolution, softened, then scaled up (cheap blur)
    if (!S17.w) { S17.w = createCanvas(540, 960); S17.w2 = createCanvas(540, 960); }
    const wx = S17.w.getContext('2d'), wx2 = S17.w2.getContext('2d');
    wx.setTransform(1, 0, 0, 1, 0, 0); wx.clearRect(0, 0, 540, 960);
    const m = ctx.getTransform(); wx.setTransform(m.a * 0.5, m.b * 0.5, m.c * 0.5, m.d * 0.5, m.e * 0.5, m.f * 0.5);
    for (let i = 0; i < 9; i++) wisp(wx, lt + i * 0.7, 300 + i, 260 + i * 62, 1690 + (i % 3) * 20, 1050 + (i % 4) * 140, 9, i % 2 ? '#ffd9a0' : '#fff0d8', 0.9);
    wx2.clearRect(0, 0, 540, 960); wx2.filter = 'blur(3px)'; wx2.drawImage(S17.w, 0, 0); wx2.filter = 'none';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(S17.w2, 0, 0, W, H); ctx.restore();
    PP.richSteam(ctx, lt * 0.7 + 1, 62, 600, 1500, 700, 1300, 0.35, { n: 10, col: '#fff2dc', drift: 0.08 });
    dust(ctx, lt, 17, 70, 0, 200, W, 1500, '255,225,170', 2.6, 0.7);
  });
  const zf = lerp(1.06, 1.0, p); flare(ctx, 540 + (LX - 540) * zf, 960 + (LY - cy) * zf, 1.3, 0.85 + 0.15 * Math.sin(lt * 3));
}

// ================================================================ s18  herbs land on the plate (top-down)
function s18(ctx, lt, p, T) {
  const t0 = 51.75, t1 = 54.75;
  woodTop(ctx, 23, 0.15);
  lampPool(ctx, 600, 800, 900, 0.32);
  const HX = 540, HY = 880, hs = 1.62;
  const items = [
    { t: 0.75, kind: 'basil', n: 5 }, { t: 1.12, kind: 'saw', n: 4 }, { t: 1.5, kind: 'sprout', n: 9 }, { t: 2.25, kind: 'lime', n: 2 }, { t: 2.55, kind: 'chili', n: 6 },
  ];
  const prog = (tl, d = 0.3) => clamp((lt - tl) / d);
  const z = lerp(1.0, 1.08, ease.inOut(p));
  cam(ctx, HX, HY, z, lerp(-0.04, 0.02, p), () => {
    PP.herbPlate(ctx, HX, HY, hs, {
      basil: prog(0.75, 0.15) >= 1 ? 1 : prog(0.75, 0.15) > 0 ? 0.34 : 0,
      sawtooth: prog(1.12, 0.3), sprouts: ease.out(prog(1.4, 0.45)), lime: lt >= 2.25 ? 1 : 0, chili: lt >= 2.55 ? 1 : 0, seed: 21,
    });
    // falling pieces (big & blurred near the lens, settling onto the plate)
    const r = rng(99);
    items.forEach((it) => {
      for (let i = 0; i < it.n; i++) {
        const tl = it.t - 0.06 * (it.n - 1 - i) * 0.6, dur = 0.32, k = clamp(1 - (tl - lt) / dur);
        const tx = HX + (r() - 0.5) * 300, ty = HY + (r() - 0.5) * 260, rr = r() * TAU, spin = (r() - 0.5) * 6;
        if (k <= 0 || lt > tl + 0.05) continue;
        const kk = ease.in(k), sc = lerp(3.2, hs, kk), yy = lerp(ty - 1100, ty, kk), xx = lerp(tx + (r() - 0.5) * 300, tx, kk), ro = rr + spin * (1 - kk);
        ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * kk;
        if (it.kind === 'basil') PP.basilLeaf(ctx, xx, yy, sc, ro);
        else if (it.kind === 'saw') PP.sawtooth(ctx, xx, yy, sc * 0.9, ro);
        else if (it.kind === 'sprout') PP.beanSprout(ctx, xx, yy, sc, ro);
        else if (it.kind === 'lime') PP.limeWedge(ctx, HX + [120, 150][i] * hs + (1 - kk) * 200, HY + [-70, -10][i] * hs - (1 - kk) * 1000, sc * 0.9, [-0.5, 0.3][i] + spin * (1 - kk));
        else if (it.kind === 'chili') PP.chiliSlice(ctx, HX + 110 * hs + (r() - 0.5) * 60, HY + 110 * hs + (r() - 0.5) * 60 - (1 - kk) * 900, sc * 1.1);
        ctx.restore();
      }
    });
    // landing accents
    items.forEach((it) => { const a = lt - it.t; if (a > 0 && a < 0.4) { drops(ctx, a, 7 + it.t * 10, 10, HX + (it.kind === 'lime' ? 200 : it.kind === 'chili' ? 180 : 0), HY + (it.kind === 'chili' ? 180 : -20), { speed: 500, g: 1600, life: 0.4, size: 5, spread: TAU, col: [230, 250, 220] }); } });
  });
  X.caption(ctx, T, t0 + 0.25, t1 - 0.2, 'Rau thơm', 'Herbs, bean sprouts, lime', { n: 12 });
}

// ================================================================ s19  lime squeeze & chili (macro)
function s19(ctx, lt, p, T) {
  const t0 = 54.75, t1 = 57.75;
  stallBack(ctx, lt + 2, 19);
  const SURF = 1240;
  const pan = ease.inOut(inv(1.6, 2.2, lt));
  const cy = lerp(880, 1050, pan);
  cam(ctx, 540, cy, lerp(1.0, 1.08, p), 0, () => {
    // broth surface in strong perspective
    ctx.save(); ctx.translate(540, SURF + 520); ctx.scale(1, 0.42);
    ctx.fillStyle = '#e9ebef'; ell(ctx, 0, 0, 1180, 1180); ctx.fill();
    ctx.strokeStyle = COL.cobalt; ctx.lineWidth = 10; ell(ctx, 0, 0, 1130, 1130); ctx.stroke();
    ell(ctx, 0, 0, 1080, 1080); ctx.clip();
    PP.bowlContents(ctx, 1080, { fill: 1, noodles: 0.6, beef: 0, cook: 1, scallion: 0, onion: 0, herbs: 0.6, t: lt, seed: 77 });
    fanBeef(ctx, 1080, { n: 8, fx: 0.0, fy: -0.12, a0: -2.75, step: 0.3, d: 0.16, len: 0.36, cook: 0.62, seed: 95 });
    onionRings(ctx, 1080, 10, 41, 0.6); scallionRings(ctx, 1080, 60, 42);
    ctx.restore();
    // lime juice droplets (slow-mo) & chili slices
    const sq = ease.inOut(inv(0.2, 1.0, lt)) * (1 - inv(1.4, 1.7, lt));
    const lift = ease.in(inv(1.5, 1.95, lt)) * 1000, pulse = Math.sin(lt * 9) * 0.04 * sq;
    const WX = 520, WY = 700 - lift, LS = 4.2;
    // juice: slow-motion glistening drops from the flesh side
    if (lt > 0.3) drops(ctx, lt - 0.3, 5, 40, WX, 706, { speed: 140, g: 820, life: 1.5, size: 10, spread: 1.0, angle: Math.PI / 2, stagger: 1.0, slow: 0.6, col: [226, 246, 170] });
    if (sq > 0.3 && lift < 200) { ctx.strokeStyle = `rgba(230,248,190,${0.6 * sq})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(WX - 10, WY + 4); ctx.quadraticCurveTo(WX - 14, WY + 120, WX - 8, WY + 210); ctx.stroke(); }
    for (let i = 0; i < 6; i++) { const ti = 0.8 + i * 0.2; if (lt > ti) ripples(ctx, WX - 70 + i * 28, SURF + 40 + (i % 2) * 24, (lt - ti) * 0.9, 100, 32, 2, 'rgba(255,250,210,', 0.6, 1); }
    // chili slices drop in after the lime leaves (land around T = 56.9 / 57.2)
    const chis = [[380, 0.0], [520, 0.06], [650, 0.03], [450, 0.3], [590, 0.34], [720, 0.28]];
    chis.forEach(([cx, d], i) => {
      const tl = 2.1 + d, k = inv(tl - 0.4, tl, lt), af = lt - tl;
      if (k <= 0) return;
      const yy = af < 0 ? lerp(SURF - 1150, SURF + 60 + (i % 3) * 30, ease.in(k)) : SURF + 60 + (i % 3) * 30 + Math.sin(af * 5 + i) * 4;
      if (af > 0) { ctx.fillStyle = `rgba(230,60,30,${0.2 * clamp(af)})`; ell(ctx, cx, yy, 70, 20); ctx.fill(); }
      at(ctx, cx, yy, af < 0 ? (1 - k) * 3 : 0, 1, af < 0 ? 1 : 0.5, () => PP.chiliSlice(ctx, 0, 0, 2.8));
      if (af > 0) { ripples(ctx, cx, yy, af * 1.1, 130, 42, 2, 'rgba(255,240,200,', 0.7, 1); if (af < 0.6) drops(ctx, af, 40 + i, 10, cx, yy - 4, { speed: 540, g: 1800, life: 0.5, size: 6, spread: 1.6, col: [255, 196, 110] }); }
    });
    // the hand squeezing the lime (flesh down, rind up)
    if (WY > -400) {
      PP.limeWedge(ctx, WX, WY, LS * (1 + pulse), Math.PI + 0.04, { squeeze: sq * 0.75, t: lt });
      const hx = WX + 30, hy = WY - 45 * LS * (1 - 0.3 * sq) - 20;
      P.forearm(ctx, hx + 330, hy - 820, hx + 30, hy - 60, COL.skinTu[1], '#2aa8a0', 92);
      P.hand(ctx, hx, hy, 1.9 * (1 + pulse), Math.PI / 2 + 0.12, 'fist', [COL.skinTu[0], COL.skinTu[2]]);
    }
    PP.richSteam(ctx, lt, 44, 540, SURF + 400, 900, 1300, 0.35, { n: 12 });
  });
  X.caption(ctx, T, t0 + 0.25, t1 - 0.2, 'Chanh, ớt', 'Lime & chili', { n: 13 });
}

// ================================================================ s20  breakfast is served (top-down table)
function teaTop(ctx, x, y, s, t) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 10, 14, 92, 92); ctx.fill();
    ctx.fillStyle = 'rgba(230,240,240,0.35)'; ell(ctx, 0, 0, 90, 90); ctx.fill();
    const g = ctx.createRadialGradient(-20, -20, 10, 0, 0, 80); g.addColorStop(0, '#e8bc64'); g.addColorStop(1, '#9a6a1e');
    ctx.fillStyle = g; ell(ctx, 0, 0, 78, 78); ctx.fill();
    const r = rng(5);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + r(), d = 20 + r() * 30; at(ctx, Math.cos(a) * d + Math.sin(t + i) * 2, Math.sin(a) * d, r() * 3, 1, 1, () => { ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.roundRect(-18, -16, 36, 32, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.stroke(); }); }
    ctx.strokeStyle = 'rgba(240,250,250,0.85)'; ctx.lineWidth = 6; ell(ctx, 0, 0, 88, 88); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 80, 3.6, 4.6); ctx.stroke();
  });
}
function jarTop(ctx, x, y, s) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 8, 12, 72, 72); ctx.fill();
    ctx.fillStyle = 'rgba(220,235,230,0.4)'; ell(ctx, 0, 0, 70, 70); ctx.fill();
    ctx.fillStyle = 'rgba(236,214,140,0.85)'; ell(ctx, 0, 0, 60, 60); ctx.fill();
    const r = rng(33);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(250,246,230,0.95)'; ctx.beginPath(); ctx.ellipse((r() - 0.5) * 80, (r() - 0.5) * 80, 9, 6, r() * 3, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 7; i++) PP.chiliSlice(ctx, (r() - 0.5) * 80, (r() - 0.5) * 80, 0.7);
    ctx.strokeStyle = 'rgba(235,245,245,0.85)'; ctx.lineWidth = 6; ell(ctx, 0, 0, 68, 68); ctx.stroke();
    PP.teaspoon(ctx, 0, 10, 1.1, -0.6);
  });
}
function s20(ctx, lt, p, T) {
  const t0 = 57.75, t1 = 60;
  woodTop(ctx, 31, 0.05);
  lampPool(ctx, 620, 700, 1000, 0.4);
  const z = lerp(1.14, 1.0, ease.out(p)), rot = lerp(0.05, 0, ease.out(p));
  cam(ctx, 540, 900, z, rot, () => {
    // napkin / tray under the bowl
    PP.quay(ctx, 525, 300, 0.92, 0.06); PP.quay(ctx, 560, 372, 0.92, -0.04);
    PP.herbPlate(ctx, 815, 1150, 0.68, { seed: 21 });
    teaTop(ctx, 860, 400, 1.1, lt);
    jarTop(ctx, 190, 470, 1.15);
    PP.porcelainSpoon(ctx, 300, 960, 1.15, -2.3);
    PP.phoBowlTop(ctx, 540, 800, 330, { fill: 1, cook: 1, noodles: 1, beef: 0, scallion: 0, onion: 0, herbs: 0.6, t: lt, seed: 77 });
    ctx.save(); ctx.translate(540, 800); ell(ctx, 0, 0, 270, 270); ctx.clip();
    fanBeef(ctx, 270, { n: 7, fx: -0.02, fy: 0.02, a0: -2.7, step: 0.4, d: 0.12, len: 0.5, cook: 0.6, seed: 97 });
    onionRings(ctx, 270, 9, 43); scallionRings(ctx, 270, 46, 44);
    ctx.restore();
    PP.chopsticksPair(ctx, 610, 1065, 1.05, -0.32, 0.05);
    PP.richSteam(ctx, lt, 66, 540, 900, 420, 900, 0.5, { n: 12 });
  });
  dust(ctx, lt, 5, 30, 0, 200, W, 1300, '255,225,170', 2.2, 0.45);
  X.caption(ctx, T, t0 + 0.2, t1 - 0.12, 'Dọn ra bàn', 'Breakfast is served', { n: 14 });
}

module.exports = { s11, s12, s13, s14, s15, s16, s17, s18, s19, s20 };
