// Food props for MÌ XÀO GIÒN: noodles, crispy nest, seafood, pork/liver, veggies, gravy, plate, wok, condiments.
const L = require('./lib');
const P = require('./props');
const { TAU, lerp, clamp, rng, at, glow, createCanvas } = L;
const { ell, shade } = P;

// ---------------- noodle nest (cached raw / fried textures, top-down 640x640, radius 290) ----------------
const NEST = {};
function nestCanvas(kind) {
  if (NEST[kind]) return NEST[kind];
  const c = createCanvas(640, 640), x = c.getContext('2d'), r = rng(kind === 'raw' ? 11 : 12);
  const cols = kind === 'raw' ? ['#d9b850', '#ecd27a', '#f6e39a', '#c9a23e'] : kind === 'oil' ? ['#d99a3a', '#f0c060', '#ffdc8a', '#b8701e'] : ['#b8661a', '#e09a32', '#f6c25a', '#8a4410', '#ffd77a'];
  x.translate(320, 320);
  // base shadow disc
  const bg = x.createRadialGradient(0, 0, 20, 0, 0, 300);
  bg.addColorStop(0, kind === 'raw' ? 'rgba(160,120,40,0.9)' : 'rgba(120,55,10,0.95)'); bg.addColorStop(0.85, kind === 'raw' ? 'rgba(150,110,40,0.7)' : 'rgba(100,45,8,0.7)'); bg.addColorStop(1, 'rgba(80,40,10,0)');
  x.fillStyle = bg; x.beginPath(); x.arc(0, 0, 300, 0, TAU); x.fill();
  x.lineCap = 'round';
  const passes = kind === 'raw' ? 3 : 4;
  for (let pass = 0; pass < passes; pass++) {
    const n = 70;
    for (let i = 0; i < n; i++) {
      let a = r() * TAU, rr = Math.sqrt(r()) * 250;
      let px = Math.cos(a) * rr, py = Math.sin(a) * rr, dir = r() * TAU;
      x.strokeStyle = cols[(r() * cols.length) | 0];
      if (pass < passes - 1) x.strokeStyle = shade(x.strokeStyle, -0.25 * (passes - 1 - pass));
      x.lineWidth = kind === 'raw' ? 5 : 6;
      x.beginPath(); x.moveTo(px, py);
      const segs = 14 + (r() * 10) | 0;
      for (let k = 0; k < segs; k++) {
        dir += (r() - 0.5) * 1.6;
        // pull back inside radius
        const d = Math.hypot(px, py); if (d > 270) dir = Math.atan2(-py, -px) + (r() - 0.5);
        const nx = px + Math.cos(dir) * 26, ny = py + Math.sin(dir) * 26;
        x.quadraticCurveTo(px + Math.cos(dir + 0.8) * 14, py + Math.sin(dir + 0.8) * 14, nx, ny);
        px = nx; py = ny;
      }
      x.stroke();
      if (pass === passes - 1 && kind !== 'raw') { x.strokeStyle = 'rgba(255,240,190,0.45)'; x.lineWidth = 2; x.stroke(); }
    }
  }
  // rim darker for fried
  if (kind !== 'raw') {
    const rg = x.createRadialGradient(0, 0, 180, 0, 0, 300); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(70,25,5,0.5)');
    x.globalCompositeOperation = 'source-atop'; x.fillStyle = rg; x.fillRect(-320, -320, 640, 640);
  }
  NEST[kind] = c;
  const d = createCanvas(640, 640), dx = d.getContext('2d');
  dx.drawImage(c, 0, 0); dx.globalCompositeOperation = 'source-atop'; dx.fillStyle = '#3a1a06'; dx.fillRect(0, 0, 640, 640);
  NEST[kind + 'D'] = d;
  return c;
}
// draw the nest; fry 0 raw → 1 golden; k = view ratio (1 top-down, 0.3 side); s scale (s=1 → radius 290); h = dome height
function nest(ctx, x, y, s, k = 0.4, fry = 1, o = {}) {
  const raw = nestCanvas('raw'), gold = nestCanvas('gold');
  const h = (o.h === undefined ? 70 : o.h) * (1 - k * 0.7);
  const layers = Math.max(1, Math.round(h / 10));
  at(ctx, x, y, o.rot || 0, s, s, () => {
    for (let i = 0; i <= layers; i++) {
      const u = i / layers, yy = -h * u, sc = 1 - (u * u) * 0.38;
      ctx.save(); ctx.translate(0, yy); ctx.scale(sc, sc * k);
      const dark = 1 - u;
      if (fry < 1) { ctx.globalAlpha = 1; ctx.drawImage(raw, -320, -320); }
      if (fry > 0) { ctx.globalAlpha = fry; ctx.drawImage(gold, -320, -320); }
      if (dark > 0.05 && i < layers) { ctx.globalAlpha = dark * 0.5; ctx.drawImage(NEST[(fry > 0.5 ? 'gold' : 'raw') + 'D'], -320, -320); }
      ctx.restore();
    }
  });
}

// ---------------- loose noodle strands (for bundle / dropping / macro) ----------------
function strands(ctx, x, y, w, len, t, seed, n, o = {}) {
  const r = rng(seed), cols = o.cols || ['#e8cd70', '#f6e39a', '#d4b04a'];
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * w, ph = r() * TAU, amp = 10 + r() * 22, l = len * (0.6 + r() * 0.5), freq = 0.03 + r() * 0.03;
    ctx.strokeStyle = cols[i % cols.length]; ctx.lineWidth = o.lw || 5;
    ctx.beginPath(); ctx.moveTo(bx, y);
    for (let k = 1; k <= 18; k++) {
      const u = k / 18, yy = y + u * l * (o.dir || 1);
      const xx = bx + Math.sin(yy * freq + ph + t * (o.sway || 3)) * amp * (0.3 + u) + (o.spread || 0) * (bx - x) * u;
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
// raw egg-noodle bundle (curly block), origin centre; loose 0..1 shakes it apart
function noodleBundle(ctx, x, y, s, t, loose = 0, seed = 5) {
  at(ctx, x, y, Math.sin(t * 9) * 0.05 * loose, s, s, () => {
    const r = rng(seed);
    ctx.lineCap = 'round';
    for (let i = 0; i < 120; i++) {
      const cx = (r() - 0.5) * 220 * (1 + loose * 0.5), cy = (r() - 0.5) * 120 * (1 + loose * 0.8), rad = 14 + r() * 18;
      const col = ['#e2c45e', '#f3dc8a', '#cfa844', '#f8e8a8'][(r() * 4) | 0];
      const a0 = r() * TAU;
      ctx.strokeStyle = col; ctx.lineWidth = 4.5;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const u = k / 24, a = a0 + u * TAU * 1.6, rr = rad * (1 + loose * u * 1.5);
        const px = cx + Math.cos(a) * rr + u * 20 * loose * Math.sin(t * 7 + i), py = cy + Math.sin(a) * rr * 0.6 + u * u * 70 * loose;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    // flour dust
    ctx.fillStyle = 'rgba(255,250,235,0.35)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((r() - 0.5) * 220, (r() - 0.5) * 120, 1.5 + r() * 2, 0, TAU); ctx.fill(); }
  });
}

// ---------------- plate ----------------
// oval white plate with blue rim band. k = view ratio, s=1 → rx 340
function plate(ctx, x, y, s, k = 0.4, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const rx = 340, ry = 340 * k, d = 26 * (1 - k * 0.8);
    // drop shadow
    ctx.save(); ctx.filter = 'blur(14px)'; ell(ctx, 10, d + 16, rx * 1.02, ry * 1.04); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    // side
    ell(ctx, 0, d, rx * 0.96, ry * 0.96); ctx.fillStyle = '#b9b4ac'; ctx.fill();
    ell(ctx, 0, 0, rx, ry);
    const g = ctx.createLinearGradient(-rx, -ry, rx, ry); g.addColorStop(0, '#fffdf8'); g.addColorStop(1, '#d9d4cc');
    ctx.fillStyle = g; ctx.fill();
    // blue band
    ctx.strokeStyle = o.band || '#3a5fa8'; ctx.lineWidth = 9; ell(ctx, 0, 0, rx * 0.9, ry * 0.9); ctx.stroke();
    ctx.lineWidth = 3; ell(ctx, 0, 0, rx * 0.84, ry * 0.84); ctx.stroke();
    // little dashes pattern on band
    ctx.lineWidth = 4;
    for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * rx * 0.94, Math.sin(a) * ry * 0.94); ctx.lineTo(Math.cos(a) * rx * 0.97, Math.sin(a) * ry * 0.97); ctx.stroke(); }
    // well
    ell(ctx, 0, ry * 0.04, rx * 0.74, ry * 0.74); const wg = ctx.createRadialGradient(0, 0, 10, 0, 0, rx * 0.74); wg.addColorStop(0, '#f6f2ea'); wg.addColorStop(1, '#d6d0c6'); ctx.fillStyle = wg; ctx.fill();
    // rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.99, ry * 0.99, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  });
}

// ---------------- toppings (origin centre; s=1 natural size) ----------------
function shrimp(ctx, x, y, s, rot = 0, cooked = 1) {
  at(ctx, x, y, rot, s, s, () => {
    const c0 = cooked > 0.5 ? '#ff8a5a' : '#c9b4a4', c1 = cooked > 0.5 ? '#e0502a' : '#9a8478', c2 = cooked > 0.5 ? '#fff0e0' : '#e8ded6';
    // curled body as thick arc segments
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.9 - i * 0.32, rr = 34, w = 30 - i * 3.6;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      ell(ctx, px, py, w * 0.62, w * 0.5); ctx.fillStyle = i % 2 ? c0 : shade(c0, -0.05); ctx.fill();
      ctx.strokeStyle = c1; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, w * 0.55, a - 1.4, a + 0.3); ctx.stroke();
    }
    // inner white stripe
    ctx.strokeStyle = c2; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 24, Math.PI * 0.95, Math.PI * -0.65, true); ctx.stroke();
    // tail fan
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.moveTo(Math.cos(-0.75) * 34, Math.sin(-0.75) * 34); ctx.lineTo(36, -52); ctx.lineTo(50, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(c1, -0.2); ctx.beginPath(); ctx.moveTo(Math.cos(-0.75) * 34, Math.sin(-0.75) * 34); ctx.lineTo(48, -46); ctx.lineTo(54, -22); ctx.closePath(); ctx.fill();
    // gloss
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -20, 6, 6, 3); ctx.fill();
  });
}
function squid(ctx, x, y, s, rot = 0, curl = 1) {
  at(ctx, x, y, rot, s, s, () => {
    const w = 80, h = 50;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + curl * 10); ctx.quadraticCurveTo(0, -h / 2 - curl * 16, w / 2, -h / 2 + curl * 10);
    ctx.lineTo(w / 2 - 6, h / 2); ctx.quadraticCurveTo(0, h / 2 - curl * 20, -w / 2 + 6, h / 2); ctx.closePath();
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e8d6c0');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(200,120,90,0.55)'; ctx.lineWidth = 2.5;
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * 12 - 30, -40); ctx.lineTo(i * 12 + 30, 40); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 12 + 30, -40); ctx.lineTo(i * 12 - 30, 40); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(210,140,110,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  });
}
function pork(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-46, -18); ctx.quadraticCurveTo(0, -30, 48, -14); ctx.lineTo(42, 20); ctx.quadraticCurveTo(0, 28, -44, 16); ctx.closePath();
    const g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, '#e8b09a'); g.addColorStop(1, '#b8735a'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#f6e8dc'; ctx.beginPath(); ctx.moveTo(-46, -18); ctx.quadraticCurveTo(0, -30, 48, -14); ctx.lineTo(47, -6); ctx.quadraticCurveTo(0, -20, -45, -10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,50,30,0.35)'; ctx.fillRect(-30, 0, 50, 3);
  });
}
function liver(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-40, -10); ctx.bezierCurveTo(-30, -28, 30, -26, 42, -6); ctx.bezierCurveTo(40, 14, -20, 22, -40, 10); ctx.closePath();
    const g = ctx.createLinearGradient(0, -24, 0, 20); g.addColorStop(0, '#8a3a2a'); g.addColorStop(1, '#4a1810'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,200,180,0.35)'; ell(ctx, -6, -12, 18, 4); ctx.fill();
  });
}
function gizzard(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ell(ctx, 0, 0, 30, 20); ctx.fillStyle = '#9a4a3a'; ctx.fill();
    ctx.strokeStyle = '#d8b8a0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 14, 0.4, 2.8); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,20,10,0.5)'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -16); ctx.lineTo(i * 9, 16); ctx.stroke(); }
  });
}
function bokChoy(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    // white stem
    ctx.beginPath(); ctx.moveTo(-14, 70); ctx.quadraticCurveTo(-22, 10, -10, -10); ctx.lineTo(10, -10); ctx.quadraticCurveTo(22, 10, 14, 70); ctx.closePath();
    const sg = ctx.createLinearGradient(-20, 0, 20, 0); sg.addColorStop(0, '#d8eec0'); sg.addColorStop(0.5, '#f6fbe8'); sg.addColorStop(1, '#b8d898'); ctx.fillStyle = sg; ctx.fill();
    // leaf
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.bezierCurveTo(-60, -30, -50, -110, 0, -116); ctx.bezierCurveTo(50, -110, 60, -30, 10, -4); ctx.closePath();
    const lg = ctx.createLinearGradient(0, -116, 0, 0); lg.addColorStop(0, '#3f9a3a'); lg.addColorStop(1, '#2a6a22'); ctx.fillStyle = lg; ctx.fill();
    ctx.strokeStyle = '#a8d880'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -100); ctx.stroke();
    ctx.lineWidth = 1.5; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, -i * 20); ctx.lineTo(-26, -i * 20 - 14); ctx.moveTo(0, -i * 20); ctx.lineTo(26, -i * 20 - 14); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ell(ctx, -18, -70, 8, 20); ctx.fill();
  });
}
function carrotFlower(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const a = i / 5 * TAU, a2 = a + TAU / 10; ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.quadraticCurveTo(Math.cos(a2) * 16, Math.sin(a2) * 16, Math.cos(a + TAU / 5) * 30, Math.sin(a + TAU / 5) * 30); }
    ctx.closePath(); ctx.fillStyle = '#f07a1a'; ctx.fill();
    ctx.strokeStyle = '#c8560a'; ctx.lineWidth = 2; ctx.stroke();
    ell(ctx, 0, 0, 10, 10); ctx.fillStyle = '#ffa850'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(ctx, -10, -10, 6, 3); ctx.fill();
  });
}
function mushroom(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    // straw mushroom halved: dark grey cap, cream inside
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 36, 0, 0, TAU);
    const g = ctx.createLinearGradient(-26, 0, 26, 0); g.addColorStop(0, '#3a3634'); g.addColorStop(0.5, '#6a6260'); g.addColorStop(1, '#2a2624'); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, 6, 16, 26, 0, 0, TAU); ctx.fillStyle = '#efe4cc'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(ctx, -12, -16, 5, 10); ctx.fill();
  });
}
function cilantro(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.strokeStyle = '#4a8a2a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -6); ctx.stroke();
    for (const [lx, ly, a] of [[0, -20, 0], [-16, -6, -0.8], [16, -6, 0.8]]) at(ctx, lx, ly, a, 1, 1, () => {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) { const aa = Math.PI + i / 3 * Math.PI; ctx.lineTo(Math.cos(aa) * 14, Math.sin(aa) * 14); ctx.lineTo(Math.cos(aa + 0.5) * 8, Math.sin(aa + 0.5) * 8); }
      ctx.closePath(); ctx.fillStyle = '#4fb03a'; ctx.fill();
    });
  });
}
function chiliRing(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ell(ctx, 0, 0, 13, 11); ctx.fillStyle = '#e0201a'; ctx.fill();
    ell(ctx, 0, 0, 7, 6); ctx.fillStyle = '#ffd8a0'; ctx.fill();
    ctx.fillStyle = '#f8f0c0'; for (let i = 0; i < 3; i++) { ell(ctx, Math.cos(i * 2) * 3, Math.sin(i * 2) * 3, 2, 1.4); ctx.fill(); }
  });
}
function gravyBlob(ctx, x, y, rx, ry, t, a = 1, seed = 3) {
  const r = rng(seed);
  ctx.save(); ctx.globalAlpha = a;
  ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const ang = i / n * TAU, w = 1 + 0.12 * Math.sin(ang * 3 + seed) + 0.08 * Math.sin(ang * 5 + t * 1.5);
    const px = x + Math.cos(ang) * rx * w, py = y + Math.sin(ang) * ry * w;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 4, x, y, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(210,130,50,0.85)'); g.addColorStop(0.6, 'rgba(150,72,22,0.82)'); g.addColorStop(1, 'rgba(100,45,12,0.75)');
  ctx.fillStyle = g; ctx.fill();
  // gloss highlights
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) { const a2 = r() * TAU, d = Math.sqrt(r()) * 0.7; ctx.fillStyle = 'rgba(255,230,180,0.55)'; ell(ctx, x + Math.cos(a2) * rx * d, y + Math.sin(a2) * ry * d, 4 + r() * 12, 2 + r() * 4); ctx.fill(); }
  ctx.restore();
}

// ---------------- full dish ----------------
// o: k view ratio, rot orbit angle, gravy 0..1, tops 0..1, garnish 0..1, t, fry
const TOPS = (() => {
  const r = rng(404), out = [];
  const kinds = ['shrimp', 'shrimp', 'shrimp', 'shrimp', 'squid', 'squid', 'squid', 'pork', 'pork', 'pork', 'liver', 'liver', 'gizzard', 'bok', 'bok', 'bok', 'bok', 'carrot', 'carrot', 'carrot', 'carrot', 'mush', 'mush', 'mush'];
  kinds.forEach((kd, i) => { const a = i / kinds.length * TAU * 3.1 + r() * 0.5, rr = 40 + r() * 150; out.push({ kd, a, rr, rot: r() * TAU, h: 20 + r() * 30 }); });
  return out;
})();
function topping(ctx, kd, x, y, s, rot) {
  if (kd === 'shrimp') shrimp(ctx, x, y, s, rot);
  else if (kd === 'squid') squid(ctx, x, y, s * 0.8, rot);
  else if (kd === 'pork') pork(ctx, x, y, s * 0.85, rot);
  else if (kd === 'liver') liver(ctx, x, y, s * 0.85, rot);
  else if (kd === 'gizzard') gizzard(ctx, x, y, s * 0.8, rot);
  else if (kd === 'bok') bokChoy(ctx, x, y, s * 0.75, rot);
  else if (kd === 'carrot') carrotFlower(ctx, x, y, s * 0.85, rot);
  else if (kd === 'mush') mushroom(ctx, x, y, s * 0.8, rot);
}
function dish(ctx, x, y, s, o = {}) {
  const k = o.k === undefined ? 0.4 : o.k, rot = o.rot || 0, t = o.t || 0;
  const gv = o.gravy === undefined ? 1 : o.gravy, tp = o.tops === undefined ? 1 : o.tops, gn = o.garnish || 0;
  at(ctx, x, y, 0, s, s, () => {
    if (o.plate !== false) plate(ctx, 0, 0, 1, k);
    nest(ctx, 0, -6, 0.86, k, o.fry === undefined ? 1 : o.fry, { h: 80, rot: 0 });
    const dome = 80 * 0.86 * (1 - k * 0.7);
    if (gv > 0) gravyBlob(ctx, 0, -dome * 0.85, 190 * Math.min(1, 0.4 + gv * 0.6), 190 * k * Math.min(1, 0.4 + gv * 0.6), t, Math.min(1, gv * 1.4));
    if (tp > 0) {
      const items = TOPS.map((it, idx) => {
        const a = it.a + rot, rr = it.rr * 0.9;
        return { ...it, idx, px: Math.cos(a) * rr, py: Math.sin(a) * rr * k - dome * (1 - (rr / 200) * 0.5) - it.h * (1 - k) * 0.4, sr: it.rot + (k > 0.8 ? rot : 0) };
      }).sort((a, b) => a.py - b.py);
      const nShow = Math.round(items.length * tp);
      items.forEach(it => { if (it.idx < nShow) topping(ctx, it.kd, it.px, it.py, 1, it.sr); });
      if (gv > 0.3) gravyBlob(ctx, 0, -dome * 0.95, 150, 150 * k, t + 3, (gv - 0.3) * 0.7, 9); // glaze over toppings
    }
    if (gn > 0) garnishOn(ctx, 0, -dome, 170, k, gn, rot);
  });
}
function garnishOn(ctx, x, y, R, k, a, rot = 0) {
  const r = rng(88);
  ctx.save(); ctx.globalAlpha = clamp(a);
  for (let i = 0; i < 14; i++) { const an = r() * TAU + rot, d = Math.sqrt(r()) * R; cilantro(ctx, x + Math.cos(an) * d, y + Math.sin(an) * d * k - 10, 0.9, r() * TAU); }
  for (let i = 0; i < 9; i++) { const an = r() * TAU + rot, d = Math.sqrt(r()) * R; chiliRing(ctx, x + Math.cos(an) * d, y + Math.sin(an) * d * k - 12, 1, r() * TAU); }
  ctx.fillStyle = '#1a1210';
  for (let i = 0; i < 120; i++) { const an = r() * TAU + rot, d = Math.sqrt(r()) * R; ctx.fillRect(x + Math.cos(an) * d, y + Math.sin(an) * d * k - 14, 3, 3); }
  ctx.restore();
}

// ---------------- big wok (carbon steel, long handle right) ----------------
// origin = centre of rim ellipse; s=1 → rim rx 300; k = view ratio; fillFn(ctx) drawn clipped inside interior (origin centre)
function bigWok(ctx, x, y, s, rot = 0, o = {}) {
  const k = o.k === undefined ? 0.22 : o.k;
  at(ctx, x, y, rot, s, s, () => {
    const rx = 300, ry = 300 * k, depth = 170 * (1 - k * 0.85);
    if (o.handle !== false) {
      ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.roundRect(rx - 10, -14, 90, 24, 8); ctx.fill();
      const hg = ctx.createLinearGradient(0, -18, 0, 18); hg.addColorStop(0, '#8a5a30'); hg.addColorStop(1, '#4a2a12');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(rx + 70, -18, 230, 34, 16); ctx.fill();
      ctx.fillStyle = '#1a1412'; ctx.beginPath(); ctx.roundRect(-rx - 60, -12, 60, 22, 10); ctx.fill();
    }
    // outer bowl
    ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.bezierCurveTo(-rx * 0.9, depth * 1.3, rx * 0.9, depth * 1.3, rx, 0); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI, true); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, depth); g.addColorStop(0, '#2e2c2c'); g.addColorStop(1, '#060606'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.globalCompositeOperation = 'screen';
    const hot = o.hot === undefined ? 1 : o.hot;
    const bg = ctx.createRadialGradient(0, depth * 1.1, 10, 0, depth * 1.1, rx * 0.9);
    bg.addColorStop(0, `rgba(255,120,40,${0.75 * hot})`); bg.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = bg; ctx.fillRect(-rx, 0, rx * 2, depth * 1.4);
    const rg = ctx.createLinearGradient(-rx, 0, rx, 0); rg.addColorStop(0.15, 'rgba(255,190,120,0)'); rg.addColorStop(0.25, 'rgba(255,190,120,0.35)'); rg.addColorStop(0.35, 'rgba(255,190,120,0)');
    ctx.fillStyle = rg; ctx.fillRect(-rx, 0, rx * 2, depth * 1.4);
    ctx.restore();
    // interior
    ell(ctx, 0, 0, rx, ry);
    const ig = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 10, 0, 0, rx);
    ig.addColorStop(0, '#2a2422'); ig.addColorStop(0.6, '#161212'); ig.addColorStop(1, '#3a3432'); ctx.fillStyle = ig; ctx.fill();
    // seasoned patina rings
    ctx.strokeStyle = 'rgba(120,80,50,0.18)'; ctx.lineWidth = 3; for (let i = 1; i < 5; i++) { ell(ctx, 0, 0, rx * i / 5, ry * i / 5); ctx.stroke(); }
    if (o.fill) { ctx.save(); ell(ctx, 0, 0, rx * 0.97, ry * 0.97); ctx.clip(); o.fill(ctx, rx, ry); ctx.restore(); }
    // rim
    ctx.lineWidth = 8; ctx.strokeStyle = '#55504c'; ell(ctx, 0, 0, rx, ry); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,190,130,0.6)'; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  });
}
// ladle (soup ladle, bowl at origin, handle up-right)
function ladle(ctx, x, y, s, rot = 0, liquid = null, tilt = 0) {
  at(ctx, x, y, rot, s, s, () => {
    const hg = ctx.createLinearGradient(0, -10, 0, 10); hg.addColorStop(0, '#d8d4cc'); hg.addColorStop(1, '#6a6862');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(30, -8); ctx.lineTo(330, -60); ctx.lineTo(334, -46); ctx.lineTo(34, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 54, 54 * 0.35, tilt, 0, Math.PI); ctx.bezierCurveTo(-40, 44, 40, 44, -54 * Math.cos(tilt), 0); ctx.closePath();
    ell(ctx, 0, 0, 54, 26); ctx.fillStyle = '#8a8680'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-54, 0); ctx.bezierCurveTo(-50, 50, 50, 50, 54, 0); ctx.closePath(); ctx.fillStyle = '#6a6862'; ctx.fill();
    if (liquid) { ell(ctx, 0, 2, 46, 18); ctx.fillStyle = liquid; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -14, -2, 14, 4); ctx.fill(); }
    ctx.strokeStyle = '#d8d4cc'; ctx.lineWidth = 4; ell(ctx, 0, 0, 54, 26); ctx.stroke();
  });
}
// liquid pour stream with ribbon from (x0,y0) to (x1,y1)
function pourStream(ctx, x0, y0, x1, y1, w, col, t, a = 1) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, col); g.addColorStop(1, col);
  ctx.strokeStyle = g; ctx.lineCap = 'round';
  ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0);
  const mx = (x0 + x1) / 2 + Math.sin(t * 9) * 6;
  ctx.quadraticCurveTo(lerp(x0, x1, 0.15), (y0 + y1) / 2, x1 + Math.sin(t * 13) * 3, y1); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,240,210,0.45)'; ctx.lineWidth = w * 0.25; ctx.beginPath(); ctx.moveTo(x0 - w * 0.2, y0); ctx.quadraticCurveTo(lerp(x0, x1, 0.15) - w * 0.2, (y0 + y1) / 2, x1 - w * 0.2, y1); ctx.stroke();
  void mx;
  ctx.restore();
}

// ---------------- condiments, tea, chopsticks ----------------
function soyDish(ctx, x, y, s, k = 0.45, chili = 1, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.save(); ctx.filter = 'blur(8px)'; ell(ctx, 6, 14, 100, 100 * k); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 10 * (1 - k), 94, 94 * k); ctx.fillStyle = '#b8b2a8'; ctx.fill();
    ell(ctx, 0, 0, 100, 100 * k); ctx.fillStyle = '#f4f0e8'; ctx.fill();
    ctx.strokeStyle = '#3a5fa8'; ctx.lineWidth = 4; ell(ctx, 0, 0, 92, 92 * k); ctx.stroke();
    ell(ctx, 0, 4 * (1 - k), 76, 76 * k);
    const g = ctx.createRadialGradient(-20, -10 * k, 4, 0, 0, 80); g.addColorStop(0, '#6a2c10'); g.addColorStop(1, '#1e0a04'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,220,180,0.4)'; ell(ctx, -26, -20 * k, 20, 5 * k + 1); ctx.fill();
    const r = rng(o.seed || 21);
    for (let i = 0; i < 9 * chili; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 56; chiliRing(ctx, Math.cos(a) * d, Math.sin(a) * d * k, 0.8, r() * TAU); }
  });
}
function pickles(ctx, x, y, s, k = 0.45) {
  at(ctx, x, y, 0, s, s, () => {
    ell(ctx, 0, 10 * (1 - k), 94, 94 * k); ctx.fillStyle = '#b8b2a8'; ctx.fill();
    ell(ctx, 0, 0, 100, 100 * k); ctx.fillStyle = '#f4f0e8'; ctx.fill();
    const r = rng(31);
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 62, w = 26 + r() * 14, rot = r() * Math.PI;
      at(ctx, Math.cos(a) * d, Math.sin(a) * d * k - 6, rot, 1, k + 0.3, () => { ctx.fillStyle = i % 2 ? '#f6f0dc' : '#f29a3a'; ctx.beginPath(); ctx.roundRect(-w / 2, -5, w, 10, 3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-w / 2 + 2, -4, w - 4, 2); });
    }
  });
}
function teaCup(ctx, x, y, s, t = 0, k = 0.4) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.save(); ctx.filter = 'blur(6px)'; ell(ctx, 4, 4, 70, 70 * k); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.restore();
    const h = 90 * (1 - k * 0.8);
    ctx.beginPath(); ctx.moveTo(-60, -h); ctx.quadraticCurveTo(-58, 0, -40, 0); ctx.lineTo(40, 0); ctx.quadraticCurveTo(58, 0, 60, -h); ctx.closePath();
    const g = ctx.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, '#d8d2c4'); g.addColorStop(0.4, '#fffdf6'); g.addColorStop(1, '#a8a296'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#3a5fa8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-58, -h * 0.75); ctx.quadraticCurveTo(0, -h * 0.75 + 10 * k, 58, -h * 0.75); ctx.stroke();
    ell(ctx, 0, -h, 60, 60 * k); ctx.fillStyle = '#f4f0e8'; ctx.fill();
    ell(ctx, 0, -h + 3, 52, 52 * k); const tg = ctx.createRadialGradient(-10, -h, 2, 0, -h, 52); tg.addColorStop(0, '#d8a040'); tg.addColorStop(1, '#8a5210'); ctx.fillStyle = tg; ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,0.5)'; ell(ctx, -18, -h - 4 * k, 14, 3 * k + 1); ctx.fill();
  });
}
function chopsticks(ctx, x, y, s, rot = 0, spread = 0.06, col = ['#e2c08a', '#a8763e']) {
  at(ctx, x, y, rot, s, s, () => {
    for (const d of [-spread, spread]) at(ctx, 0, 0, d, 1, 1, () => {
      const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(420, -6); ctx.lineTo(420, 6); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a5121a'; ctx.fillRect(330, -6, 90, 12);
    });
  });
}
// crispy noodle crumb shards (ballistic burst) – wrapper over lib.flakes with noodle colours
function crumbs(ctx, t, t0, seed, n, x, y, o = {}) {
  L.flakes(ctx, t, t0, seed, n, x, y, Object.assign({ colors: ['#e09a32', '#f6c25a', '#b8661a', '#ffd77a'], size: 9, speed: 600, g: 1200, life: 1.4 }, o));
}
// oil bubbles field around (x,y)
function oilBubbles(ctx, t, seed, x, y, rx, ry, n = 40, a = 1) {
  const r = rng(seed);
  ctx.save(); ctx.globalAlpha = a;
  for (let i = 0; i < n; i++) {
    const ang = r() * TAU, d = Math.sqrt(r()), sp = 2 + r() * 3, ph = r();
    const life = (t * sp + ph) % 1, rad = (3 + r() * 9) * Math.sin(life * Math.PI);
    const px = x + Math.cos(ang) * rx * d, py = y + Math.sin(ang) * ry * d;
    ctx.strokeStyle = 'rgba(255,240,180,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(px, py, rad, rad * 0.7, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,230,0.5)'; ctx.beginPath(); ctx.arc(px - rad * 0.3, py - rad * 0.3, rad * 0.25, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

module.exports = { nestCanvas, nest, strands, noodleBundle, plate, shrimp, squid, pork, liver, gizzard, bokChoy, carrotFlower, mushroom, cilantro, chiliRing, gravyBlob, dish, topping, garnishOn, bigWok, ladle, pourStream, soyDish, pickles, teaCup, chopsticks, crumbs, oilBubbles };
