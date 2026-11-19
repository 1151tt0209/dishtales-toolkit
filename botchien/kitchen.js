// Bột chiên props: gas flame, cast-iron pan, cubes, egg sheet, steamer, basin, spatula, egg, scallions,
// pickle jar, bottles, bowl, plate, finished dish, glass street cart, chú Sáu (full figure + close head).
const L = require('./lib');
const P = require('./props');
const F = require('./food');
const { TAU, rng, clamp, lerp, ease, at, glow } = L;
const { ell, seg, ik } = P;

const SAU = ['#d29a6a', '#a8693e', '#7a4526'];
const GOLD = '#e8a53a';

// ---------- blue gas flame ring (ellipse rx,ry) ----------
function flame(ctx, x, y, rx, ry, t, k = 1) {
  glow(ctx, x, y - 6, rx * 1.5, 'rgba(60,120,255,0.8)', 0.55 * k);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const n = 26, sc = rx / 120;
  const tongue = (a, i) => {
    const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
    const h = (30 + 16 * Math.sin(t * 23 + i * 2.7) + 6 * Math.sin(t * 41 + i)) * k * sc, w = 8 * sc;
    const g = ctx.createLinearGradient(px, py, px, py - h);
    g.addColorStop(0, 'rgba(40,90,255,0.95)'); g.addColorStop(0.45, 'rgba(110,180,255,0.7)'); g.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(px - w, py);
    ctx.quadraticCurveTo(px - w * 0.6, py - h * 0.6, px + Math.sin(t * 17 + i) * w * 0.7, py - h);
    ctx.quadraticCurveTo(px + w * 0.6, py - h * 0.6, px + w, py); ctx.closePath(); ctx.fill();
  };
  for (let i = 0; i < n; i++) tongue(Math.PI + (i / n) * Math.PI, i);
  for (let i = 0; i < n; i++) tongue((i / n) * Math.PI, i + n);
  ctx.restore();
}

// ---------- cast-iron pan. origin = rim centre; R=300; k = ellipse ratio (1 = top-down).
// o.fill(ctx, pt) drawn clipped to the cooking surface; pt(u,v) maps plane coords → local screen coords.
function pan(ctx, x, y, s, k, o = {}) {
  const R = 300, d = 62 * Math.sqrt(Math.max(0, 1 - k * k)), Ri = R - 24;
  at(ctx, x, y, o.rot || 0, s, s, () => {
    // handles
    for (const sx of [-1, 1]) {
      ctx.save(); ctx.translate(sx * (R + 6), d * 0.3); ctx.scale(sx, 1);
      ctx.lineWidth = 22; ctx.strokeStyle = '#141211';
      ctx.beginPath(); ctx.moveTo(-8, -14); ctx.bezierCurveTo(60, -30 * k - 10, 70, 30 * k + 10, -8, 18); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,190,120,0.35)'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.bezierCurveTo(50, -30 * k - 12, 58, 0, 52, 6); ctx.stroke();
      ctx.restore();
    }
    // body side
    const bg = ctx.createLinearGradient(-R, 0, R, 0);
    bg.addColorStop(0, '#0c0b0a'); bg.addColorStop(0.25, '#3a3632'); bg.addColorStop(0.4, '#1a1816'); bg.addColorStop(0.85, '#0a0909'); bg.addColorStop(1, '#2a2622');
    P.cylBody(ctx, d, R * 0.94, R, d, k, bg);
    // rim
    ell(ctx, 0, 0, R, R * k); ctx.fillStyle = '#2e2b28'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,200,140,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 0, R - 2, (R - 2) * k, 0, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    // cooking surface
    const sy = 5 * Math.sqrt(1 - k * k);
    ell(ctx, 0, sy, Ri, Ri * k);
    const sg = ctx.createRadialGradient(-Ri * 0.3, sy - Ri * k * 0.4, 10, 0, sy, Ri * 1.1);
    sg.addColorStop(0, '#3b3530'); sg.addColorStop(0.5, '#1c1916'); sg.addColorStop(1, '#0b0a09');
    ctx.fillStyle = sg; ctx.fill();
    ctx.save(); ell(ctx, 0, sy, Ri, Ri * k); ctx.clip();
    // seasoning texture
    const r = rng(91); ctx.fillStyle = 'rgba(255,220,180,0.05)';
    for (let i = 0; i < 60; i++) { ell(ctx, (r() - 0.5) * 2 * Ri, sy + (r() - 0.5) * 2 * Ri * k, 4 + r() * 10, (3 + r() * 6) * k); ctx.fill(); }
    if (o.oil) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = o.oil;
      const og = ctx.createRadialGradient(-Ri * 0.25, sy - Ri * k * 0.25, 5, -Ri * 0.2, sy, Ri);
      og.addColorStop(0, 'rgba(255,214,140,0.55)'); og.addColorStop(0.5, 'rgba(200,130,60,0.18)'); og.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = og; ctx.fillRect(-Ri, sy - Ri, Ri * 2, Ri * 2);
      const t = o.t || 0, r2 = rng(5);
      for (let i = 0; i < 40; i++) {
        const u = (r2() - 0.5) * 1.8 * Ri, v = (r2() - 0.5) * 1.8 * Ri, ph = r2() * TAU;
        const a = Math.max(0, Math.sin(t * 5 + ph)) ** 6;
        if (a > 0.05 && u * u + v * v < Ri * Ri * 0.8) L.sparkle(ctx, u, sy + v * k, 10 + 8 * r2(), a);
      }
      ctx.restore();
    }
    const pt = (u, v) => [u, sy + v * k];
    if (o.fill) o.fill(ctx, pt, k, Ri);
    ctx.restore();
    // inner wall lip (front) to give depth
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.ellipse(0, sy, Ri + 4, (Ri + 4) * k, 0, 0.1, Math.PI - 0.1); ctx.stroke();
    if (o.over) o.over(ctx, pt, k, Ri);
  });
}

// ---------- bột chiên cube (¾ view): gold 0..1, egg 0..1 patches ----------
function cube(ctx, x, y, s, rot = 0, o = {}) {
  F.tofu(ctx, x, y, s, rot, { gold: o.gold === undefined ? 1 : o.gold, cut: o.cut });
  if (o.egg) at(ctx, x, y, rot, s, s, () => {
    const r = rng(o.seed || 3);
    ctx.globalAlpha = o.egg;
    for (let i = 0; i < 3; i++) { ell(ctx, -30 + r() * 60, -40 + r() * 50, 16 + r() * 14, 10 + r() * 8); ctx.fillStyle = i % 2 ? '#ffd23a' : '#fff1b8'; ctx.fill(); }
    ctx.globalAlpha = 1;
  });
  if (o.red) at(ctx, x, y, rot, s, s, () => {
    ctx.globalAlpha = o.red; ell(ctx, 4, -34, 44, 18); ctx.fillStyle = '#c8180e'; ctx.fill();
    ell(ctx, -6, -40, 14, 5); ctx.fillStyle = 'rgba(255,170,150,0.8)'; ctx.fill(); ctx.globalAlpha = 1;
  });
  if (o.glint) L.sparkle(ctx, x - 20 * s, y - 34 * s, 22 * s, o.glint);
}

// ---------- egg sheet blob (plane coords via pt), cook 0..1, spread 0..1 ----------
function eggSheet(ctx, pt, cx, cy, R, seed, spread = 1, cook = 1, k = 1) {
  if (spread <= 0) return;
  const r = rng(seed), n = 22, rad = [];
  for (let i = 0; i < n; i++) rad.push(R * (0.78 + r() * 0.3) * spread);
  const path = (sc) => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i % n) / n * TAU, rr = rad[i % n] * sc;
      const [px, py] = pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  path(1.04); ctx.fillStyle = mixc('#d9a040', '#8a4a14', cook); ctx.fill();
  path(1); ctx.fillStyle = mixc('#fff3c2', '#f2c44a', cook); ctx.fill();
  // yolky patches & white patches
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU, rr = r() * R * 0.7 * spread, [px, py] = pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    ell(ctx, px, py, (18 + r() * 30) * spread, (12 + r() * 20) * spread * Math.max(0.4, k));
    ctx.fillStyle = i % 3 ? `rgba(255,200,40,${0.55 + 0.3 * cook})` : 'rgba(255,252,240,0.7)'; ctx.fill();
  }
  // crispy brown speckles
  ctx.fillStyle = `rgba(150,70,15,${0.5 * cook})`;
  for (let i = 0; i < 40; i++) { const a = r() * TAU, rr = r() * R * spread, [px, py] = pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); ell(ctx, px, py, 3 + r() * 4, 2 + r() * 3); ctx.fill(); }
}
function mixc(a, b, t) { return F.mix(a, b, t); }

// deterministic cube layout in plane coords (radius ~215)
function cubeLayout(seed, n, R = 215) {
  const r = rng(seed), out = [];
  let tries = 0;
  while (out.length < n && tries < 2000) {
    tries++;
    const a = r() * TAU, rr = Math.sqrt(r()) * R, u = Math.cos(a) * rr, v = Math.sin(a) * rr;
    if (out.some(c => Math.hypot(c.u - u, c.v - v) < 78)) continue;
    out.push({ u, v, rot: (r() - 0.5) * 0.7, g: 0.75 + r() * 0.25, i: out.length });
  }
  return out.sort((a, b) => a.v - b.v);
}

// ---------- scallion ring ----------
function scallion(ctx, x, y, s, rot = 0, shade = 0) {
  at(ctx, x, y, rot, s, s * 0.8, () => {
    ell(ctx, 0, 0, 11, 11); ctx.fillStyle = shade ? '#2f7d2a' : '#4cae3a'; ctx.fill();
    ell(ctx, 0, 0, 6, 6); ctx.fillStyle = '#c9ef9a'; ctx.fill();
    ell(ctx, -3, -4, 3, 2); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  });
}
function scallionScatter(ctx, pt, seed, n, R, amount = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * R, rot = r() * TAU, sh = r() < 0.3;
    if (i / n > amount) continue;
    const [px, py] = pt(Math.cos(a) * rr, Math.sin(a) * rr);
    scallion(ctx, px, py, 1.1, rot, sh);
  }
}

// ---------- spatula: origin = blade centre, blade toward -x, handle toward +x ----------
function spatula(ctx, x, y, s, rot = 0, sy = 0.6) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.save(); ctx.scale(1, sy);
    const g = ctx.createLinearGradient(-90, -60, 60, 60); g.addColorStop(0, '#f4f2ee'); g.addColorStop(0.4, '#9a9ea2'); g.addColorStop(1, '#55595d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-95, -62); ctx.lineTo(55, -48); ctx.lineTo(55, 48); ctx.lineTo(-95, 62); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-95, -60); ctx.lineTo(-95, 60); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#6a6e72'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(50, 0); ctx.lineTo(170, -26); ctx.stroke();
    const hg = ctx.createLinearGradient(0, -20, 0, 20); hg.addColorStop(0, '#9a6236'); hg.addColorStop(1, '#4a2a14');
    ctx.save(); ctx.translate(170, -26); ctx.rotate(-0.2); ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(0, -14, 230, 28, 13); ctx.fill(); ctx.restore();
  });
}

// ---------- egg: crack 0..1 opens shell (halves part vertically) ----------
function egg(ctx, x, y, s, rot = 0, crack = 0) {
  at(ctx, x, y, rot, s, s, () => {
    const gap = crack * 70, tilt = crack * 0.7;
    const shell = (top) => {
      ctx.save();
      ctx.translate(0, top ? -gap / 2 : gap / 2); ctx.rotate(top ? -tilt : tilt);
      ctx.beginPath();
      if (top) { ctx.moveTo(-46, 0); ctx.bezierCurveTo(-46, -50, -26, -72, 0, -72); ctx.bezierCurveTo(26, -72, 46, -50, 46, 0); }
      else { ctx.moveTo(-46, 0); ctx.bezierCurveTo(-46, 40, -24, 56, 0, 56); ctx.bezierCurveTo(24, 56, 46, 40, 46, 0); }
      for (let i = 0; i <= 8; i++) ctx.lineTo(46 - i * 11.5, (i % 2 ? 7 : -7) * (top ? 1 : -1) * (crack > 0 ? 1 : 0));
      ctx.closePath();
      const g = ctx.createRadialGradient(-16, -30, 4, 0, 0, 80); g.addColorStop(0, '#fff1de'); g.addColorStop(0.6, '#e9c39a'); g.addColorStop(1, '#b8875a');
      ctx.fillStyle = g; ctx.fill();
      if (crack > 0.05) { ctx.save(); ctx.clip(); ell(ctx, 0, top ? 6 : -6, 40, 14); ctx.fillStyle = 'rgba(255,250,240,0.9)'; ctx.fill(); ctx.restore(); }
      ctx.restore();
    };
    shell(true); shell(false);
    if (crack > 0 && crack < 0.25) { ctx.strokeStyle = '#7a5434'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-46, 0); for (let i = 1; i <= 8; i++) ctx.lineTo(-46 + i * 11.5, i % 2 ? 7 : -7); ctx.stroke(); }
  });
}
// falling yolk + white (stretch = vertical elongation)
function yolk(ctx, x, y, s, stretch = 1) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.save(); ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(0, -60 * stretch); ctx.bezierCurveTo(46, -20 * stretch, 52, 40, 0, 52); ctx.bezierCurveTo(-52, 40, -46, -20 * stretch, 0, -60 * stretch);
    ctx.fillStyle = 'rgba(250,250,235,0.9)'; ctx.fill(); ctx.restore();
    const g = ctx.createRadialGradient(-10, 0, 3, 0, 12, 40); g.addColorStop(0, '#ffe58a'); g.addColorStop(0.6, '#ffb21a'); g.addColorStop(1, '#e07b06');
    ell(ctx, 0, 14, 34, 34 * (0.9 + (stretch - 1) * 0.4)); ctx.fillStyle = g; ctx.fill();
    ell(ctx, -12, 0, 10, 7); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  });
}

// ---------- aluminium steamer pot; lid 0..1 ----------
function steamer(ctx, x, y, s, lid = 0, t = 0) {
  at(ctx, x, y, 0, s, s, () => {
    const R = 260, k = 0.3, h = 300;
    P.cylBody(ctx, 0, R * 0.97, R, h, k, P.metalGrad(ctx, -R, R, 1));
    // band
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(-R, -h * 0.55, R * 2, 10);
    // side handles
    for (const sx of [-1, 1]) { ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.roundRect(sx * (R + 8) - 22, -h + 40, 44, 22, 8); ctx.fill(); }
    // rim + inside
    ell(ctx, 0, -h, R, R * k); ctx.fillStyle = '#d8d6d0'; ctx.fill();
    ell(ctx, 0, -h + 4, R - 14, (R - 14) * k); ctx.fillStyle = '#6a6a68'; ctx.fill();
    // cake tray: white steamed block
    ell(ctx, 0, -h + 16, R - 30, (R - 30) * k);
    const cg = ctx.createRadialGradient(-60, -h, 10, 0, -h + 16, R); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#e4ddcc');
    ctx.fillStyle = cg; ctx.fill();
    ctx.strokeStyle = 'rgba(180,170,150,0.5)'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 60, -h - 40 * k * 2); ctx.lineTo(i * 60, -h + 60 * k * 2); ctx.stroke(); }
    // lid
    const lift = ease.out(lid) * 330, tl = lid * 0.55;
    at(ctx, R * 0.9, -h - lift * 0.35, tl, 1, 1, () => {
      ctx.translate(-R * 0.9, -lift * 0.65);
      ctx.beginPath(); ctx.moveTo(-R - 6, 0); ctx.bezierCurveTo(-R, -150, R, -150, R + 6, 0); ctx.ellipse(0, 0, R + 6, (R + 6) * k, 0, 0, Math.PI, false); ctx.closePath();
      ctx.fillStyle = P.metalGrad(ctx, -R, R, 1); ctx.fill();
      ctx.fillStyle = '#1e1e1e'; ctx.beginPath(); ctx.roundRect(-40, -150, 80, 28, 12); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, R, R * k, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    });
  });
}

// ---------- top-down basin of batter ----------
function basin(ctx, x, y, s, t, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const R = 400;
    ctx.save(); ctx.filter = 'blur(20px)'; ell(ctx, 20, 30, R, R); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 0, R, R);
    const mg = ctx.createRadialGradient(-120, -140, 20, 0, 0, R); mg.addColorStop(0, '#f2f2ee'); mg.addColorStop(0.6, '#a8aaac'); mg.addColorStop(1, '#6a6c6e');
    ctx.fillStyle = mg; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ell(ctx, 0, 0, R - 8, R - 8); ctx.stroke();
    ell(ctx, 0, 0, R - 40, R - 40); ctx.fillStyle = '#8a8c8e'; ctx.fill();
    const lv = o.level === undefined ? 1 : o.level;
    if (lv > 0) {
      const br = (R - 50) * Math.sqrt(lv);
      ctx.save(); ell(ctx, 0, 0, br, br); ctx.clip();
      const bg = ctx.createRadialGradient(-80, -80, 10, 0, 0, br); bg.addColorStop(0, '#fffdf5'); bg.addColorStop(1, '#e6dcc4');
      ctx.fillStyle = bg; ctx.fillRect(-R, -R, 2 * R, 2 * R);
      // swirl
      const sp = o.spin || 0;
      ctx.strokeStyle = 'rgba(190,175,140,0.55)'; ctx.lineWidth = 6;
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let a = 0; a < 11; a += 0.12) { const rr = a * br / 11, ang = a * 0.9 + sp + arm * TAU / 3; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let a = 1; a < 10; a += 0.12) { const rr = a * br / 11 - 6, ang = a * 0.9 + sp + arm * TAU / 3 + 0.15; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
        ctx.stroke();
      }
      // dry flour mound (dissolves)
      if (o.mound) { ctx.save(); ctx.globalAlpha = o.mound; ctx.filter = 'blur(6px)'; ell(ctx, 30, -20, 170 * o.mound + 40, 150 * o.mound + 40); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore(); }
      ctx.restore();
    }
    if (o.paddle !== undefined) {
      const a = o.paddle, px = Math.cos(a) * 150, py = Math.sin(a) * 150;
      // ripple ring around paddle
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4; ell(ctx, px, py, 40, 40); ctx.stroke();
      seg(ctx, px, py, 760, -900, 30, 38, '#b07a42');
      seg(ctx, px, py, px + (760 - px) * 0.25, py + (-900 - py) * 0.25, 52, 34, '#c8925a');
    }
  });
}

// ---------- pickle jar (side view). origin bottom centre ----------
function jar(ctx, x, y, s, t = 0, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const w = 300, h = 420, r = rng(31);
    ctx.save(); ctx.filter = 'blur(12px)'; ell(ctx, 0, 0, w * 0.6, 30); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.roundRect(-w / 2, -h, w, h, 40); ctx.fillStyle = 'rgba(200,225,230,0.16)'; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h * 0.86, w - 20, h * 0.86 - 10, 30); ctx.clip();
    const bg = ctx.createLinearGradient(0, -h, 0, 0); bg.addColorStop(0, 'rgba(255,230,160,0.55)'); bg.addColorStop(1, 'rgba(230,170,80,0.7)');
    ctx.fillStyle = bg; ctx.fillRect(-w, -h, 2 * w, h);
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x0 = (r() - 0.5) * w, y0 = -r() * h * 0.85, len = 80 + r() * 140, a = r() * TAU, kind = r();
      ctx.strokeStyle = kind < 0.28 ? '#ee7a22' : kind < 0.6 ? '#f4ecc8' : '#d9e8a8';
      ctx.lineWidth = 6 + r() * 4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + Math.cos(a) * len * 0.5 + 20, y0 + Math.sin(a) * len * 0.5, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); ctx.stroke();
    }
    // bubbles
    for (let i = 0; i < 14; i++) { const bx = (r() - 0.5) * w * 0.8, by = -((t * (30 + r() * 40) + r() * h) % (h * 0.8)); ell(ctx, bx, by, 4, 4); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
    // brine surface
    ell(ctx, 0, -h * 0.86, w / 2 - 10, 18); ctx.fillStyle = 'rgba(255,240,190,0.5)'; ctx.fill();
    // glass highlights
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 22, -h + 30, 22, h - 70, 11); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.roundRect(w / 2 - 50, -h + 50, 12, h - 120, 6); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(230,245,250,0.5)'; ctx.beginPath(); ctx.roundRect(-w / 2, -h, w, h, 40); ctx.stroke();
    ell(ctx, 0, -h, w / 2, 20); ctx.strokeStyle = 'rgba(240,250,255,0.7)'; ctx.lineWidth = 8; ctx.stroke();
  });
}
// clump of pickle strips hanging (from chopstick tips at origin)
function pickleClump(ctx, x, y, s, t, seed = 4, drip = 1) {
  at(ctx, x, y, 0, s, s, () => {
    const r = rng(seed); ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const dx = (r() - 0.5) * 40, len = 90 + r() * 120, sw = Math.sin(t * 3 + i) * 10, kind = r();
      ctx.strokeStyle = kind < 0.3 ? '#ee7a22' : kind < 0.65 ? '#f4ecc8' : '#d9e8a8'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(dx * 0.3, 0); ctx.quadraticCurveTo(dx + sw, len * 0.5, dx * 1.4 + sw * 1.5, len); ctx.stroke();
    }
    if (drip) for (let i = 0; i < 4; i++) { const ph = (t * 1.3 + i * 0.27) % 1, dx = (i - 1.5) * 22; ell(ctx, dx, 200 + ph * 260, 5, 8); ctx.fillStyle = `rgba(255,235,180,${0.8 * (1 - ph)})`; ctx.fill(); }
  });
}

// ---------- bottles. kind: 'chili' | 'soy' | 'vinegar'. origin = bottom centre (upright), rot about origin ----------
function bottle(ctx, x, y, s, kind, rot = 0, o = {}) {
  at(ctx, x, y, rot, s * (1 - (o.squeeze || 0) * 0.12), s, () => {
    const isChili = kind === 'chili';
    const body = isChili ? '#d0201a' : kind === 'soy' ? '#2a1408' : 'rgba(225,240,235,0.45)';
    const w = isChili ? 130 : 110, h = isChili ? 300 : 340;
    ctx.save(); ctx.filter = 'blur(8px)'; ell(ctx, 0, 0, w * 0.6, 14); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.restore();
    ctx.beginPath();
    if (isChili) { ctx.roundRect(-w / 2, -h, w, h, 30); }
    else { ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -h * 0.62); ctx.quadraticCurveTo(-w / 2, -h * 0.78, -22, -h * 0.84); ctx.lineTo(-22, -h); ctx.lineTo(22, -h); ctx.lineTo(22, -h * 0.84); ctx.quadraticCurveTo(w / 2, -h * 0.78, w / 2, -h * 0.62); ctx.lineTo(w / 2, 0); ctx.closePath(); }
    ctx.fillStyle = body; ctx.fill();
    if (!isChili) { ctx.lineWidth = 5; ctx.strokeStyle = kind === 'soy' ? 'rgba(255,190,120,0.55)' : 'rgba(255,255,255,0.6)'; ctx.stroke(); }
    if (kind === 'vinegar') { ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(250,250,230,0.35)'; ctx.fillRect(-w, -h * 0.6, 2 * w, h); ctx.restore(); }
    // cap / nozzle
    if (isChili) {
      ctx.fillStyle = '#1f8a3a'; ctx.beginPath(); ctx.roundRect(-34, -h - 40, 68, 44, 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, -h - 40); ctx.lineTo(-5, -h - 90); ctx.lineTo(5, -h - 90); ctx.lineTo(12, -h - 40); ctx.closePath(); ctx.fill();
    } else { ctx.fillStyle = kind === 'soy' ? '#c8261c' : '#e8e2d0'; ctx.beginPath(); ctx.roundRect(-26, -h - 30, 52, 34, 8); ctx.fill(); }
    // label
    const ly = isChili ? -h * 0.62 : -h * 0.42, lh = isChili ? 110 : 96;
    ctx.fillStyle = isChili ? '#ffe7a0' : kind === 'soy' ? '#f3e2b8' : '#ffffff';
    ctx.fillRect(-w / 2, ly, w, lh);
    ctx.fillStyle = isChili ? '#c8180e' : '#2a1608'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${isChili ? 30 : 24}px BodySansBold`;
    const t1 = isChili ? 'TƯƠNG' : kind === 'soy' ? 'NƯỚC' : 'GIẤM', t2 = isChili ? 'ỚT' : kind === 'soy' ? 'TƯƠNG' : 'GẠO';
    ctx.fillText(t1, 0, ly + lh * 0.32); ctx.fillText(t2, 0, ly + lh * 0.7);
    if (isChili) { ctx.fillStyle = '#c8180e'; ell(ctx, 0, ly + lh + 30, 18, 10); ctx.fill(); }
    // highlight
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.roundRect(-w / 2 + 12, -h * 0.95 + (isChili ? 20 : h * 0.3), 14, h * 0.6, 7); ctx.fill(); ctx.restore();
  });
}

// ---------- small dipping bowl (¾). origin = rim centre ----------
function bowl(ctx, x, y, s, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const R = 120, k = o.k || 0.35;
    ctx.save(); ctx.filter = 'blur(10px)'; ell(ctx, 0, 92, R * 0.8, 20); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R, 70, -60, 92, 0, 92); ctx.bezierCurveTo(60, 92, R, 70, R, 0); ctx.closePath();
    const g = ctx.createLinearGradient(-R, 0, R, 0); g.addColorStop(0, '#d8d4cc'); g.addColorStop(0.3, '#ffffff'); g.addColorStop(1, '#a8a49c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2f5fae'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-R + 6, 24); ctx.bezierCurveTo(-R + 20, 60, R - 20, 60, R - 6, 24); ctx.stroke();
    ell(ctx, 0, 0, R, R * k); ctx.fillStyle = '#f4f2ec'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#2f5fae'; ell(ctx, 0, 0, R - 4, (R - 4) * k); ctx.stroke();
    const lv = o.level || 0;
    if (lv > 0) {
      const rr = (R - 14) * (0.7 + 0.3 * lv);
      ell(ctx, 0, 14 * (1 - lv), rr, rr * k); ctx.fillStyle = o.col || '#5a2a10'; ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ell(ctx, -rr * 0.35, 14 * (1 - lv) - rr * k * 0.3, rr * 0.3, rr * k * 0.2); ctx.fillStyle = 'rgba(255,220,170,0.4)'; ctx.fill(); ctx.restore();
      if (o.fill) { ctx.save(); ell(ctx, 0, 14 * (1 - lv), rr, rr * k); ctx.clip(); o.fill(ctx, rr, k); ctx.restore(); }
    }
  });
}

// ---------- plate (¾ view or top-down). origin = centre. fillFn(ctx) after leaf ----------
function plate(ctx, x, y, s, k, fillFn, o = {}) {
  at(ctx, x, y, o.rot || 0, s, s, () => {
    const R = 330;
    ctx.save(); ctx.filter = 'blur(16px)'; ell(ctx, 14, 26 + 20 * (1 - k), R * 1.02, R * k * 1.05); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
    if (k < 0.95) { ell(ctx, 0, 18 * (1 - k), R * 0.96, R * k * 0.96); ctx.fillStyle = '#b8b4ac'; ctx.fill(); }
    ell(ctx, 0, 0, R, R * k); ctx.fillStyle = '#f7f5ef'; ctx.fill();
    ctx.lineWidth = 9; ctx.strokeStyle = '#2f5fae'; ell(ctx, 0, 0, R - 16, (R - 16) * k); ctx.stroke();
    ctx.lineWidth = 3; ell(ctx, 0, 0, R - 30, (R - 30) * k); ctx.stroke();
    ell(ctx, 0, 0, R - 70, (R - 70) * k); ctx.fillStyle = '#e8e4da'; ctx.fill();
    if (o.leaf !== false) {
      at(ctx, 0, 0, 0.25, 1, k, () => F.bananaLeaf(ctx, 0, 0, 0.62, 0, 1));
    }
    if (fillFn) fillFn(ctx);
  });
}

// ---------- finished bột chiên heap (¾ or top-down). origin = centre. o: {k, chili, sauce, scallion, t, bite} ----------
const DISH = cubeLayout(123, 15, 175);
function dish(ctx, x, y, s, o = {}) {
  const k = o.k === undefined ? 0.5 : o.k;
  at(ctx, x, y, 0, s, s, () => {
    const pt = (u, v) => [u, v * k];
    eggSheet(ctx, pt, 0, 0, 215, 55, 1, 1, k);
    for (const c of DISH) {
      if (o.missing && o.missing.includes(c.i)) continue;
      const [px, py] = pt(c.u, c.v);
      cube(ctx, px, py - 10, 0.85, c.rot, { gold: c.g, egg: 0.7, seed: c.i + 9, red: o.chili ? clamp(o.chili * 1.6 - (c.i % 5) * 0.12) : 0 });
    }
    if (o.chili) {
      ctx.save(); ctx.globalAlpha = clamp(o.chili);
      const r = rng(66); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#c8180e'; ctx.lineWidth = 16;
      const lines = Math.ceil(9 * clamp(o.chili));
      for (let i = 0; i < lines; i++) {
        const v = -150 + i * 36; ctx.beginPath();
        for (let u = -190; u <= 190; u += 20) { const [px, py] = pt(u, v + Math.sin(u * 0.05 + i) * 18); ctx.lineTo(px, py - 30); }
        ctx.stroke();
      }
      if (o.chili > 0.8) { for (let i = 0; i < 8; i++) { const [px, py] = pt((r() - 0.5) * 300, (r() - 0.5) * 250); ell(ctx, px, py - 26, 40 + r() * 40, 18 + r() * 14); ctx.fillStyle = '#b8140c'; ctx.fill(); } }
      ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,170,150,0.6)'; ctx.lineWidth = 4;
      for (let i = 0; i < lines; i++) { const v = -150 + i * 36; ctx.beginPath(); for (let u = -180; u <= 180; u += 20) { const [px, py] = pt(u, v + Math.sin(u * 0.05 + i) * 18); ctx.lineTo(px - 3, py - 35); } ctx.stroke(); }
      ctx.restore();
    }
    if (o.sauce) {
      ctx.save(); ctx.globalAlpha = o.sauce * 0.85; ctx.strokeStyle = '#7a2e0e'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); for (let u = -170; u <= 170; u += 15) { const [px, py] = pt(u, -110 + i * 55 + Math.sin(u * 0.04 + i * 2) * 30); ctx.lineTo(px, py - 34); } ctx.stroke(); }
      ctx.restore();
      const r = rng(8), t = o.t || 0;
      for (let i = 0; i < 12; i++) { const [px, py] = pt((r() - 0.5) * 320, (r() - 0.5) * 260); const a = Math.max(0, Math.sin(t * 4 + i * 1.9)) ** 4 * o.sauce; if (a > 0.05) L.sparkle(ctx, px, py - 40, 24, a); }
    }
    if (o.scallion !== false) scallionScatter(ctx, (u, v) => [u, v * k - 40], 17, 34, 190, o.scallion === undefined ? 1 : o.scallion);
  });
}

// ---------- palm facing viewer (stop!). origin = palm centre ----------
function palm(ctx, x, y, s, rot, skin = SAU) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(0, -120, 0, 80); g.addColorStop(0, skin[0]); g.addColorStop(1, skin[1]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(-30, 40, 60, 130, 24); ctx.fill(); // wrist
    ctx.beginPath(); ctx.roundRect(-58, -50, 116, 110, 40); ctx.fill();
    const fl = [92, 108, 102, 82];
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(-56 + i * 29, -50 - fl[i] + 20, 26, fl[i], 13); ctx.fill(); }
    ctx.save(); ctx.translate(-56, 10); ctx.rotate(-0.7); ctx.beginPath(); ctx.roundRect(-14, -70, 28, 80, 14); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(110,60,30,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(0, 20, 40, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 30); ctx.quadraticCurveTo(-10, 0, 10, -30); ctx.stroke();
  });
}

// ---------- chú Sáu head (front). origin = head centre; radius ~100 units ----------
// o: {eyes:'normal'|'wide'|'laugh', mouth:'smile'|'o'|'laugh'|'talk', mOpen, brow, look, rim, t, sweat}
function sauHead(ctx, x, y, s, o = {}) {
  at(ctx, x, y, o.tilt || 0, s, s, () => {
    const lx = (o.look || 0) * 8;
    // ears
    for (const sx of [-1, 1]) { ell(ctx, sx * 96, 12, 18, 30); ctx.fillStyle = SAU[1]; ctx.fill(); ell(ctx, sx * 98, 12, 9, 18); ctx.fillStyle = SAU[2]; ctx.fill(); }
    // head
    ctx.beginPath(); ctx.moveTo(0, 118);
    ctx.bezierCurveTo(60, 118, 92, 80, 96, 20); ctx.bezierCurveTo(100, -70, 70, -112, 0, -114);
    ctx.bezierCurveTo(-70, -112, -100, -70, -96, 20); ctx.bezierCurveTo(-92, 80, -60, 118, 0, 118); ctx.closePath();
    const hg = ctx.createRadialGradient(-30, -30, 10, 0, 10, 130); hg.addColorStop(0, SAU[0]); hg.addColorStop(0.7, SAU[1]); hg.addColorStop(1, SAU[2]);
    ctx.fillStyle = hg; ctx.fill();
    ctx.save(); ctx.clip();
    // cheeks
    for (const sx of [-1, 1]) { ctx.save(); ctx.filter = 'blur(8px)'; ell(ctx, sx * 55, 42, 26, 16); ctx.fillStyle = 'rgba(220,90,70,0.28)'; ctx.fill(); ctx.restore(); }
    // stubble
    const r = rng(41); ctx.fillStyle = 'rgba(70,50,40,0.35)';
    for (let i = 0; i < 160; i++) { const a = r() * Math.PI, rr = 50 + r() * 60; const px = Math.cos(a) * rr * 0.9, py = 60 + Math.sin(a) * rr * 0.5; if (py > 66) ctx.fillRect(px, py, 1.6, 1.6); }
    // warm rim from bulb (top right)
    const rl = ctx.createLinearGradient(100, -60, 50, 0); rl.addColorStop(0, `rgba(255,200,110,${0.6 * (o.rim === undefined ? 1 : o.rim)})`); rl.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = rl; ctx.fillRect(0, -130, 120, 260);
    ctx.restore();
    // hair (short grey crew, receding)
    ctx.beginPath(); ctx.moveTo(-98, 0); ctx.bezierCurveTo(-104, -80, -60, -128, 0, -128); ctx.bezierCurveTo(60, -128, 104, -80, 98, 0);
    ctx.lineTo(90, -10); ctx.quadraticCurveTo(80, -70, 40, -82); ctx.quadraticCurveTo(0, -70, -40, -84); ctx.quadraticCurveTo(-80, -70, -90, -10); ctx.closePath();
    const hairG = ctx.createLinearGradient(0, -130, 0, 0); hairG.addColorStop(0, '#c9c7c2'); hairG.addColorStop(1, '#7a7874');
    ctx.fillStyle = hairG; ctx.fill();
    ctx.strokeStyle = 'rgba(60,58,55,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) { const bx = -84 + i * 11; ctx.beginPath(); ctx.moveTo(bx, -70 - Math.sin(i / 15 * Math.PI) * 40); ctx.lineTo(bx + 3, -86 - Math.sin(i / 15 * Math.PI) * 38); ctx.stroke(); }
    // forehead wrinkles
    const br = o.brow || 0;
    ctx.strokeStyle = 'rgba(110,60,30,0.45)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-42, -56 - i * 9 - br * 6); ctx.quadraticCurveTo(0, -62 - i * 9 - br * 8, 42, -56 - i * 9 - br * 6); ctx.stroke(); }
    // brows
    ctx.strokeStyle = '#d8d6d0'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 18, -34 - br * 14); ctx.quadraticCurveTo(sx * 40, -46 - br * 20, sx * 64, -36 - br * 12); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(80,78,74,0.7)'; ctx.lineWidth = 3;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 20, -32 - br * 14); ctx.quadraticCurveTo(sx * 40, -43 - br * 20, sx * 62, -34 - br * 12); ctx.stroke(); }
    // eyes
    const ey = -12, eyes = o.eyes || 'normal';
    for (const sx of [-1, 1]) {
      const ex = sx * 40;
      if (eyes === 'laugh') {
        ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ex - 16, ey + 4); ctx.quadraticCurveTo(ex, ey - 12, ex + 16, ey + 4); ctx.stroke();
        ctx.strokeStyle = 'rgba(110,60,30,0.5)'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ex + sx * 20, ey + i * 7 - 4); ctx.lineTo(ex + sx * 32, ey + i * 9 - 8); ctx.stroke(); }
      } else if (eyes === 'wide') {
        ell(ctx, ex, ey, 22, 24); ctx.fillStyle = '#fbf6ee'; ctx.fill(); ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 3.5; ctx.stroke();
        ell(ctx, ex + lx, ey + 2, 9, 9); ctx.fillStyle = '#1a0e08'; ctx.fill();
        ell(ctx, ex + lx - 3, ey - 2, 3, 3); ctx.fillStyle = '#fff'; ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(ex - 17, ey); ctx.quadraticCurveTo(ex, ey - 13, ex + 17, ey); ctx.quadraticCurveTo(ex, ey + 8, ex - 17, ey); ctx.fillStyle = '#f4ece0'; ctx.fill();
        ell(ctx, ex + lx, ey - 1, 7, 7.5); ctx.fillStyle = '#1a0e08'; ctx.fill();
        ell(ctx, ex + lx - 2, ey - 3.5, 2.2, 2.2); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ex - 18, ey + 1); ctx.quadraticCurveTo(ex, ey - 14, ex + 18, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(110,60,30,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 14, ey + 10); ctx.quadraticCurveTo(ex, ey + 15, ex + 14, ey + 10); ctx.stroke();
      }
    }
    // nose
    ctx.fillStyle = 'rgba(130,70,40,0.35)'; ell(ctx, 0, 34, 22, 15); ctx.fill();
    ctx.strokeStyle = 'rgba(110,55,30,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -2); ctx.quadraticCurveTo(16, 24, 12, 36); ctx.stroke();
    ctx.fillStyle = 'rgba(80,35,20,0.7)'; ell(ctx, -10, 40, 5, 3); ctx.fill(); ell(ctx, 10, 40, 5, 3); ctx.fill();
    ell(ctx, -4, 26, 6, 4); ctx.fillStyle = 'rgba(255,230,200,0.55)'; ctx.fill();
    // mouth
    const m = o.mouth || 'smile', mo = o.mOpen || 0, my = 74;
    ctx.lineCap = 'round';
    if (m === 'o' || m === 'talk') {
      const h = m === 'o' ? 16 + mo * 10 : 6 + mo * 16;
      ell(ctx, 0, my + 2, m === 'o' ? 14 + mo * 4 : 22, h); ctx.fillStyle = '#3a0e0a'; ctx.fill(); ctx.strokeStyle = '#8a3a2a'; ctx.lineWidth = 4; ctx.stroke();
    } else if (m === 'laugh') {
      ctx.beginPath(); ctx.moveTo(-40, my - 8); ctx.quadraticCurveTo(0, my - 2, 40, my - 8); ctx.quadraticCurveTo(30, my + 34 + mo * 10, 0, my + 38 + mo * 10); ctx.quadraticCurveTo(-30, my + 34 + mo * 10, -40, my - 8); ctx.closePath();
      ctx.fillStyle = '#3a0e0a'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = '#f6f0e4'; ctx.fillRect(-40, my - 10, 80, 12); ell(ctx, 0, my + 38 + mo * 10, 24, 14); ctx.fillStyle = '#c8564a'; ctx.fill(); ctx.restore();
    } else {
      ctx.strokeStyle = '#8a3a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, my - 4); ctx.quadraticCurveTo(0, my + 14, 30, my - 4); ctx.stroke();
    }
    // mustache (salt & pepper)
    ctx.fillStyle = '#5a5652';
    ctx.beginPath(); ctx.moveTo(0, 50); ctx.bezierCurveTo(-18, 46, -44, 52, -52, 70); ctx.bezierCurveTo(-34, 62, -14, 62, 0, 58);
    ctx.bezierCurveTo(14, 62, 34, 62, 52, 70); ctx.bezierCurveTo(44, 52, 18, 46, 0, 50); ctx.fill();
    ctx.strokeStyle = 'rgba(220,218,210,0.6)'; ctx.lineWidth = 1.5;
    for (let i = -5; i <= 5; i++) { if (!i) continue; ctx.beginPath(); ctx.moveTo(i * 8, 52); ctx.lineTo(i * 9.5, 62); ctx.stroke(); }
    // nasolabial folds
    ctx.strokeStyle = 'rgba(110,55,30,0.4)'; ctx.lineWidth = 3;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 24, 36); ctx.quadraticCurveTo(sx * 46, 60, sx * 44, 86); ctx.stroke(); }
  });
}

// ---------- chú Sáu full figure (front). origin = ground centre. height ~ 700 at s=1 ----------
// o: {handR:[x,y], handL:[x,y], spatula:rot|null, stop:0..1, bounce, head:{...}}
function sau(ctx, x, y, s, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const b = o.bounce || 0;
    const shY = -560 + b, hip = -330;
    // legs + shorts
    ctx.fillStyle = SAU[1]; ctx.fillRect(-70, -180, 50, 180); ctx.fillRect(20, -180, 50, 180);
    ctx.fillStyle = '#26324a'; ctx.beginPath(); ctx.roundRect(-92, hip - 10, 184, 170, 18); ctx.fill();
    ctx.fillStyle = '#1a2236'; ctx.fillRect(-4, hip + 40, 8, 120);
    // torso (tank top)
    ctx.beginPath(); ctx.moveTo(-110, shY + 20); ctx.quadraticCurveTo(-120, hip + 40, -96, hip + 10); ctx.lineTo(96, hip + 10); ctx.quadraticCurveTo(120, hip + 40, 110, shY + 20); ctx.closePath();
    ctx.fillStyle = SAU[1]; ctx.fill(); // shoulders skin
    ctx.beginPath(); ctx.moveTo(-70, shY + 4); ctx.lineTo(-56, shY + 4); ctx.quadraticCurveTo(0, shY + 90, 56, shY + 4); ctx.lineTo(70, shY + 4);
    ctx.quadraticCurveTo(110, shY + 120, 104, hip + 20); ctx.lineTo(-104, hip + 20); ctx.quadraticCurveTo(-110, shY + 120, -70, shY + 4); ctx.closePath();
    const tg = ctx.createLinearGradient(-110, 0, 110, 0); tg.addColorStop(0, '#d8d4ca'); tg.addColorStop(0.4, '#f6f3ec'); tg.addColorStop(1, '#bdb8ac');
    ctx.fillStyle = tg; ctx.fill();
    // belly curve
    ctx.strokeStyle = 'rgba(150,140,120,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-80, hip - 40); ctx.quadraticCurveTo(0, hip - 10, 80, hip - 40); ctx.stroke();
    // neck
    ctx.fillStyle = SAU[1]; ctx.beginPath(); ctx.roundRect(-30, shY - 50, 60, 70, 20); ctx.fill();
    // towel over left shoulder (viewer right)
    ctx.save(); ctx.translate(70, shY + 6); ctx.rotate(0.12);
    ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(30, -10); ctx.lineTo(36, 210); ctx.lineTo(-18, 220); ctx.closePath(); ctx.fillStyle = '#f2f2ee'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#3a6fc0'; for (let i = 0; i < 8; i++) ctx.fillRect(-40, i * 30 + 4, 100, 9); ctx.restore();
    ctx.restore();
    // arms
    const arm = (sx, hd) => {
      const sxp = sx * 100, syp = shY + 24;
      const el = ik(sxp, syp, hd[0], hd[1], 150, 140, sx > 0 ? -1 : 1);
      seg(ctx, sxp, syp, el[0], el[1], 52, 44, SAU[1]);
      seg(ctx, el[0], el[1], hd[0], hd[1], 44, 36, SAU[1]);
      ell(ctx, hd[0], hd[1], 26, 24); ctx.fillStyle = SAU[1]; ctx.fill();
    };
    const hR = o.handR || [-150, hip - 20], hL = o.handL || [150, hip - 20];
    arm(-1, hR);
    if (o.spatula !== undefined && o.spatula !== null) spatula(ctx, hR[0] - 20, hR[1] + 10, 0.8, o.spatula + Math.PI, 0.5);
    if (o.stop) { arm(1, hL); palm(ctx, hL[0], hL[1] - 60, 0.9, 0.1); }
    else arm(1, hL);
    sauHead(ctx, 0, shY - 110, 0.82, o.head || {});
  });
}

// ---------- glass street cart "BỘT CHIÊN". origin = ground centre, ~620 wide ----------
function cartBC(ctx, x, y, s, t, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const W2 = 330, top = -360;
    // wheels
    for (const wx of [-230, 230]) {
      ell(ctx, wx, -50, 50, 50); ctx.fillStyle = '#181818'; ctx.fill();
      ell(ctx, wx, -50, 22, 22); ctx.fillStyle = '#8a8a8a'; ctx.fill();
    }
    // cabinet
    const cg = ctx.createLinearGradient(-W2, 0, W2, 0); cg.addColorStop(0, '#8a8c8e'); cg.addColorStop(0.3, '#e6e8ea'); cg.addColorStop(0.6, '#a8aaac'); cg.addColorStop(1, '#6a6c6e');
    ctx.fillStyle = cg; ctx.fillRect(-W2, top, W2 * 2, 270);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-W2, top + 120, W2 * 2, 6);
    // blue panel with name
    ctx.fillStyle = '#1f5fae'; ctx.fillRect(-W2 + 20, top + 140, W2 * 2 - 40, 100);
    ctx.fillStyle = '#ffe7a0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '44px BodySansBold';
    ctx.fillText('BỘT CHIÊN · TRỨNG', 0, top + 192);
    // counter top
    ctx.fillStyle = '#c9cbcd'; ctx.fillRect(-W2 - 20, top - 16, W2 * 2 + 40, 20);
    // glass case (left)
    ctx.fillStyle = 'rgba(200,230,240,0.18)'; ctx.fillRect(-W2 + 10, top - 230, 300, 214);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = '#f7f2e4'; ctx.fillRect(-W2 + 30 + i * 90, top - 70 - j * 60, 78, 46); ctx.fillStyle = 'rgba(200,190,160,0.6)'; ctx.fillRect(-W2 + 30 + i * 90, top - 30 - j * 60, 78, 6); }
    // egg tray
    for (let i = 0; i < 5; i++) { ell(ctx, -W2 + 50 + i * 54, top - 186, 20, 24); ctx.fillStyle = '#e9c39a'; ctx.fill(); }
    ctx.strokeStyle = 'rgba(230,245,250,0.6)'; ctx.lineWidth = 6; ctx.strokeRect(-W2 + 10, top - 230, 300, 214);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(-W2 + 30, top - 225); ctx.lineTo(-W2 + 80, top - 225); ctx.lineTo(-W2 + 20, top - 60); ctx.closePath(); ctx.fill();
    // burner + pan (right)
    flame(ctx, 170, top - 40, 70, 16, t, 0.8);
    pan(ctx, 170, top - 60, 0.42, 0.3, { oil: 0.6, t, fill: (c, pt) => { for (const cb of cubeLayout(9, 8, 200)) { const [px, py] = pt(cb.u, cb.v); cube(c, px, py, 0.9, cb.rot, { gold: 0.9, egg: 0.6, seed: cb.i }); } } });
    // poles + roof + sign
    ctx.fillStyle = '#9a9c9e'; ctx.fillRect(-W2 + 4, top - 520, 12, 520); ctx.fillRect(W2 - 16, top - 520, 12, 520);
    ctx.fillStyle = '#d8b020'; ctx.beginPath(); ctx.roundRect(-W2 - 30, top - 640, W2 * 2 + 60, 130, 10); ctx.fill();
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.roundRect(-W2 - 20, top - 630, W2 * 2 + 40, 110, 8); ctx.fill();
    ctx.fillStyle = '#d0201a'; ctx.font = '84px TitleSerif'; ctx.fillText('BỘT CHIÊN', 0, top - 572);
    // hanging bulb
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-150, top - 510); ctx.lineTo(-150, top - 420); ctx.stroke();
    ell(ctx, -150, top - 404, 18, 22); ctx.fillStyle = '#fff6c8'; ctx.fill();
    if (o.bulb !== false) {
      glow(ctx, -150, top - 404, 380, 'rgba(255,190,90,0.85)', 0.75);
      glow(ctx, -150, top - 404, 70, 'rgba(255,250,220,1)', 0.95);
    }
  });
}

module.exports = { SAU, flame, pan, cube, eggSheet, cubeLayout, scallion, scallionScatter, spatula, egg, yolk, steamer, basin, jar, pickleClump, bottle, bowl, plate, dish, palm, sauHead, sau, cartBC };
