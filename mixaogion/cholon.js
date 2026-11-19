// Cholon at night: sky, curved Chinese tile roofs, red lanterns, shopfronts with Latin/Vietnamese signs,
// wok fire, steel counter + burner, steel table/stools, and chef "chú A Phát".
const L = require('./lib');
const P = require('./props');
const { W, H, TAU, lerp, clamp, rng, at, glow, createCanvas } = L;
const { ell, seg, ik, shade } = P;

// ---------------- sky ----------------
function nightSky(ctx, x0, y0, w, h, horizon) {
  const g = ctx.createLinearGradient(0, y0, 0, horizon);
  g.addColorStop(0, '#060a1f'); g.addColorStop(0.45, '#17183d'); g.addColorStop(0.8, '#3a2350'); g.addColorStop(1, '#6a2f48');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
}
function stars(ctx, x0, y0, w, h, t, seed = 3, n = 90) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w, y = y0 + r() * h, s = 0.6 + r() * 1.8, ph = r() * TAU;
    ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2 + ph));
    ctx.fillStyle = '#e8eaff'; ctx.fillRect(x, y, s, s);
  }
  ctx.restore();
}
function moon(ctx, x, y, r) {
  glow(ctx, x, y, r * 5, 'rgba(160,170,255,0.35)', 1);
  ell(ctx, x, y, r, r); const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#d9d3c0'); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(150,140,130,0.25)'; ell(ctx, x + r * 0.25, y + r * 0.1, r * 0.22, r * 0.18); ctx.fill(); ell(ctx, x - r * 0.3, y + r * 0.35, r * 0.15, r * 0.12); ctx.fill();
}

// ---------------- curved Chinese roof ----------------
// origin (x,y) = middle of eave line; w = eave width; h = roof height; col = tile colour
function roof(ctx, x, y, w, h, col = '#7a3a25', o = {}) {
  at(ctx, x, y, 0, 1, 1, () => {
    const hw = w / 2, up = o.up === undefined ? 34 : o.up, ridgeW = hw * 0.78;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-hw - 18, -up);
      ctx.quadraticCurveTo(-hw * 0.7, 6, 0, 8);
      ctx.quadraticCurveTo(hw * 0.7, 6, hw + 18, -up);
      ctx.quadraticCurveTo(hw * 0.86, -h * 0.35, ridgeW, -h);
      ctx.lineTo(-ridgeW, -h);
      ctx.quadraticCurveTo(-hw * 0.86, -h * 0.35, -hw - 18, -up);
      ctx.closePath();
    };
    path();
    const g = ctx.createLinearGradient(0, -h, 0, 8);
    g.addColorStop(0, shade(col, -0.45)); g.addColorStop(0.7, col); g.addColorStop(1, shade(col, 0.12));
    ctx.fillStyle = g; ctx.fill();
    // tile columns
    ctx.save(); path(); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
    const n = Math.max(6, Math.round(w / 22));
    for (let i = 0; i <= n; i++) {
      const u = i / n - 0.5;
      ctx.beginPath(); ctx.moveTo(u * ridgeW * 2, -h); ctx.quadraticCurveTo(u * w * 0.98, -h * 0.3, u * (w + 36), 8 - Math.abs(u) * 2 * up * 0.9); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,200,150,0.14)'; ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) { const u = (i + 0.5) / n - 0.5; ctx.beginPath(); ctx.moveTo(u * ridgeW * 2, -h); ctx.quadraticCurveTo(u * w * 0.98, -h * 0.3, u * (w + 36), 8 - Math.abs(u) * 2 * up * 0.9); ctx.stroke(); }
    ctx.restore();
    // eave band
    ctx.strokeStyle = shade(col, -0.55); ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-hw - 18, -up); ctx.quadraticCurveTo(-hw * 0.7, 6, 0, 8); ctx.quadraticCurveTo(hw * 0.7, 6, hw + 18, -up); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,190,120,0.25)'; ctx.lineWidth = 3; ctx.stroke();
    // ridge + curled ends
    ctx.fillStyle = shade(col, -0.5); ctx.fillRect(-ridgeW - 6, -h - 14, ridgeW * 2 + 12, 16);
    ctx.fillStyle = o.ridge || '#2f6f5e';
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sx * ridgeW, -h - 6); ctx.quadraticCurveTo(sx * (ridgeW + 30), -h - 10, sx * (ridgeW + 26), -h - 44); ctx.quadraticCurveTo(sx * (ridgeW + 12), -h - 30, sx * (ridgeW - 6), -h - 14); ctx.closePath(); ctx.fill();
    }
    if (o.pearl) { ell(ctx, 0, -h - 26, 13, 13); ctx.fillStyle = '#d8a03a'; ctx.fill(); }
  });
}

// ---------------- lanterns ----------------
// origin = hang point; swing radians; s scale; lit 0..1
function lantern(ctx, x, y, s, swing = 0, lit = 1, o = {}) {
  at(ctx, x, y, swing, s, s, () => {
    ctx.strokeStyle = '#1a0c08'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.stroke();
    const cy = 92, rx = 54, ry = 62;
    // body
    ell(ctx, 0, cy, rx, ry);
    const g = ctx.createRadialGradient(-10, cy - 8, 4, 0, cy, rx * 1.1);
    g.addColorStop(0, lit > 0.3 ? '#ffd08a' : '#e0503a'); g.addColorStop(0.35, '#f0402a'); g.addColorStop(0.8, '#b0141a'); g.addColorStop(1, '#5a070c');
    ctx.fillStyle = g; ctx.fill();
    // ribs
    ctx.strokeStyle = 'rgba(80,0,0,0.5)'; ctx.lineWidth = 2.5;
    for (const k of [0.25, 0.6, 0.9]) { ell(ctx, 0, cy, rx * k, ry); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, cy - ry); ctx.lineTo(0, cy + ry); ctx.stroke();
    // gold band glyph-free ornament (simple ring)
    if (o.band !== false) { ctx.strokeStyle = 'rgba(255,200,90,0.55)'; ctx.lineWidth = 3; ell(ctx, 0, cy, rx * 0.38, ry * 0.38); ctx.stroke(); }
    // caps
    ctx.fillStyle = '#e2a53e';
    ctx.beginPath(); ctx.roundRect(-30, cy - ry - 8, 60, 14, 4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-30, cy + ry - 6, 60, 14, 4); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-30, cy - ry + 2, 60, 4);
    // tassel
    ctx.strokeStyle = '#d0302a'; ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 3, cy + ry + 8); ctx.lineTo(i * 4.5 + Math.sin(swing * 6) * 4, cy + ry + 58); ctx.stroke(); }
    ctx.fillStyle = '#e2a53e'; ctx.fillRect(-6, cy + ry + 6, 12, 10);
    // inner glow
    if (lit > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = lit * 0.75;
      const ig = ctx.createRadialGradient(0, cy, 0, 0, cy, rx);
      ig.addColorStop(0, 'rgba(255,230,160,0.95)'); ig.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = ig; ell(ctx, 0, cy, rx, ry); ctx.fill(); ctx.restore();
    }
  });
  if (lit > 0 && o.halo !== false) {
    const cx = x - Math.sin(swing) * 92 * s, cyy = y + Math.cos(swing) * 92 * s;
    glow(ctx, cx, cyy, 190 * s, 'rgba(255,70,30,0.55)', lit * (o.haloA || 0.8));
  }
}
// wire with n lanterns between (x0,y0)-(x1,y1)
function lanternString(ctx, x0, y0, x1, y1, sag, n, s, t, seed = 1, o = {}) {
  ctx.save(); ctx.strokeStyle = o.wire || '#140806'; ctx.lineWidth = Math.max(1.5, 3 * s);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1); ctx.stroke(); ctx.restore();
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, mt = 1 - u;
    const px = mt * mt * x0 + 2 * mt * u * (x0 + x1) / 2 + u * u * x1;
    const py = mt * mt * y0 + 2 * mt * u * ((y0 + y1) / 2 + sag * 2) + u * u * y1;
    const sw = Math.sin(t * (1.3 + (i % 3) * 0.17) + i * 1.9 + seed) * (o.amp || 0.1) + (o.wind || 0);
    lantern(ctx, px, py, s * (1 + ((i * 7 + seed) % 5) * 0.03), sw, o.lit === undefined ? 1 : o.lit, o);
  }
}

// ---------------- signboard ----------------
function sign(x, cx, cy, w, h, text, o = {}) {
  const bg = o.bg || '#a5121a', fg = o.fg || '#f6c453';
  x.fillStyle = shade(o.frame || '#e2a53e', -0.2); x.fillRect(cx - w / 2 - 8, cy - h / 2 - 8, w + 16, h + 16);
  const g = x.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, shade(bg, 0.12)); g.addColorStop(1, shade(bg, -0.3));
  x.fillStyle = g; x.fillRect(cx - w / 2, cy - h / 2, w, h);
  x.strokeStyle = o.frame || '#e2a53e'; x.lineWidth = 4; x.strokeRect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, h - 16);
  let fs = Math.round(h * (o.k || 0.5));
  x.font = `${fs}px ${o.font || 'TitleSerif'}`; x.letterSpacing = (o.ls || 4) + 'px';
  while (x.measureText(text).width > w - 50 && fs > 10) { fs -= 2; x.font = `${fs}px ${o.font || 'TitleSerif'}`; }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillText(text, cx + 3, cy + 5);
  x.fillStyle = fg; x.fillText(text, cx, cy + 2);
  if (o.sub) { x.font = `${Math.round(h * 0.2)}px BodySansBold`; x.letterSpacing = '3px'; x.fillStyle = shade(fg, 0.3); x.fillText(o.sub, cx, cy + h * 0.36); }
  x.letterSpacing = '0px';
}

// ---------------- the street (cached facades, transparent sky) ----------------
const CH = { w: 1700, h: 1920, ox: 310, base: 1180, walk: 1460 };
let STREET = null;
function hangingDucks(x, cx, cy) {
  for (let i = 0; i < 3; i++) {
    const dx = cx + (i - 1) * 46;
    x.strokeStyle = '#2a1a10'; x.lineWidth = 2; x.beginPath(); x.moveTo(dx, cy - 30); x.lineTo(dx, cy); x.stroke();
    const g = x.createLinearGradient(dx - 18, 0, dx + 18, 0); g.addColorStop(0, '#6a2a0c'); g.addColorStop(0.4, '#d8782a'); g.addColorStop(1, '#5a200a');
    x.fillStyle = g; x.beginPath(); x.ellipse(dx, cy + 40, 18, 42, 0, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,220,150,0.5)'; x.beginPath(); x.ellipse(dx - 6, cy + 28, 4, 14, 0, 0, TAU); x.fill();
  }
}
function building(x, bx, bw, top, col, o = {}) {
  const base = CH.base, r = o.r;
  // wall
  const fg = x.createLinearGradient(0, top, 0, base);
  fg.addColorStop(0, shade(col, -0.35)); fg.addColorStop(1, shade(col, -0.6));
  x.fillStyle = fg; x.fillRect(bx, top, bw, base - top);
  // upper floor: windows
  const signY = 610, wy0 = top + 40, wy1 = signY - 80;
  const nwin = bw > 400 ? 3 : 2, ww = bw / nwin * 0.52;
  for (let i = 0; i < nwin; i++) {
    const cx = bx + bw * (i + 0.5) / nwin;
    x.fillStyle = '#1a0d08'; x.fillRect(cx - ww / 2 - 8, wy0 - 8, ww + 16, wy1 - wy0 + 16);
    const lit = r() < 0.7;
    const lg = x.createLinearGradient(0, wy0, 0, wy1);
    lg.addColorStop(0, lit ? '#ffcf7a' : '#2a2030'); lg.addColorStop(1, lit ? '#e0782a' : '#1a1420');
    x.fillStyle = lg; x.fillRect(cx - ww / 2, wy0, ww, wy1 - wy0);
    // lattice
    x.strokeStyle = 'rgba(60,20,10,0.85)'; x.lineWidth = 4;
    for (let k = 1; k < 3; k++) { x.beginPath(); x.moveTo(cx - ww / 2 + ww * k / 3, wy0); x.lineTo(cx - ww / 2 + ww * k / 3, wy1); x.stroke(); }
    for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(cx - ww / 2, wy0 + (wy1 - wy0) * k / 4); x.lineTo(cx + ww / 2, wy0 + (wy1 - wy0) * k / 4); x.stroke(); }
    // shutters
    x.fillStyle = r() < 0.5 ? '#6a1a14' : '#24463e';
    x.fillRect(cx - ww / 2 - 34, wy0, 26, wy1 - wy0); x.fillRect(cx + ww / 2 + 8, wy0, 26, wy1 - wy0);
    if (lit) { x.save(); x.globalCompositeOperation = 'screen'; const gg = x.createRadialGradient(cx, (wy0 + wy1) / 2, 10, cx, (wy0 + wy1) / 2, ww * 1.4); gg.addColorStop(0, 'rgba(255,170,80,0.35)'); gg.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = gg; x.fillRect(cx - ww * 1.5, wy0 - ww, ww * 3, wy1 - wy0 + ww * 2); x.restore(); }
  }
  // balcony railing (red)
  x.fillStyle = '#3a120c'; x.fillRect(bx - 6, wy1 + 14, bw + 12, 14);
  x.strokeStyle = '#8a2418'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(bx, wy1 - 30); x.lineTo(bx + bw, wy1 - 30); x.stroke();
  for (let rx = bx + 6; rx < bx + bw; rx += 18) { x.beginPath(); x.moveTo(rx, wy1 - 30); x.lineTo(rx, wy1 + 14); x.stroke(); }
  // sign
  sign(x, bx + bw / 2, signY, bw - 40, o.main ? 120 : 90, o.text, { bg: o.sbg, fg: o.sfg, sub: o.sub, k: o.main ? 0.5 : 0.52 });
  // shop opening
  const oy = signY + (o.main ? 80 : 66);
  x.fillStyle = '#140a06'; x.fillRect(bx + 16, oy, bw - 32, base - oy);
  const ig = x.createLinearGradient(0, oy, 0, base);
  ig.addColorStop(0, 'rgba(255,170,80,0.55)'); ig.addColorStop(1, 'rgba(255,120,50,0.15)');
  x.fillStyle = ig; x.fillRect(bx + 16, oy, bw - 32, base - oy);
  // back wall tiles
  x.strokeStyle = 'rgba(80,40,20,0.35)'; x.lineWidth = 1.5;
  for (let ty = oy + 140; ty < base; ty += 26) { x.beginPath(); x.moveTo(bx + 16, ty); x.lineTo(bx + bw - 16, ty); x.stroke(); }
  // shelves with bowls / jars
  for (let sy = oy + 60; sy < oy + 200; sy += 70) {
    x.fillStyle = 'rgba(70,35,15,0.9)'; x.fillRect(bx + 30, sy + 30, bw - 60, 6);
    for (let gx = bx + 40; gx < bx + bw - 50; gx += 30 + r() * 16) {
      const c = ['#e9e2d0', '#c0392b', '#d9a441', '#7a8a6a', '#f1e3c0'][(r() * 5) | 0];
      x.fillStyle = c; x.globalAlpha = 0.7;
      if (r() < 0.5) { x.beginPath(); x.ellipse(gx + 10, sy + 22, 13, 8, 0, 0, TAU); x.fill(); } else x.fillRect(gx, sy + 30 - (14 + r() * 16), 16, 14 + r() * 16);
      x.globalAlpha = 1;
    }
  }
  if (o.ducks) hangingDucks(x, bx + bw / 2, oy + 30);
  // red pillars
  for (const px of [bx + 4, bx + bw - 22]) {
    const pg = x.createLinearGradient(px, 0, px + 18, 0); pg.addColorStop(0, '#4a0c0a'); pg.addColorStop(0.4, '#a3221a'); pg.addColorStop(1, '#3a0808');
    x.fillStyle = pg; x.fillRect(px, top + 10, 18, base - top - 10);
  }
  // roof on top
  roof(x, bx + bw / 2, top + 4, bw + 40, 110 + bw * 0.08, o.roof || '#7a3a25', { ridge: o.ridgeCol, pearl: o.main });
}
function buildStreet() {
  const c = createCanvas(CH.w, CH.h), x = c.getContext('2d');
  x.translate(CH.ox, 0);
  const r = rng(808);
  // far skyline silhouettes (behind)
  x.fillStyle = '#1d1430';
  let fx = -CH.ox;
  while (fx < CH.w - CH.ox) { const fw = 120 + r() * 160, fh = 260 + r() * 180; x.fillRect(fx, 470 - fh * 0.5, fw, 800); roof(x, fx + fw / 2, 470 - fh * 0.5, fw + 10, 50, '#24183a', { up: 18, ridge: '#24183a' }); fx += fw + 10; }
  const defs = [
    [-310, 300, 260, '#7a5a3a', 'HỦ TIẾU', '#1e5a3e', '#f6e2a0', '#3f5a52', false, false],
    [-10, 290, 230, '#6e2a22', 'VỊT QUAY', '#b8861e', '#7a0e10', '#7a3a25', true, false],
    [280, 520, 210, '#8a6a3a', 'MÌ XÀO GIÒN', '#a5121a', '#f6c453', '#2f5f52', false, true],
    [800, 290, 250, '#3f5a52', 'SỦI CẢO', '#a5121a', '#f6e2a0', '#7a3a25', false, false],
    [1090, 300, 230, '#7a4b5a', 'TRÀ · CHÈ', '#e2a53e', '#7a0e10', '#3a4a5e', false, false],
  ];
  for (const d of defs) building(x, d[0], d[1], d[2], d[3], { text: d[4], sbg: d[5], sfg: d[6], roof: d[7], ducks: d[8], main: d[9], sub: d[9] ? 'TIỆM MÌ · CHỢ LỚN' : null, r });
  // sidewalk (dark wet tiles)
  const sb = CH.base;
  x.fillStyle = '#2a2224'; x.fillRect(-CH.ox, sb, CH.w, CH.walk - sb);
  for (let ty = sb; ty < CH.walk; ty += 40) {
    const off = ((ty - sb) / 40) % 2 ? 0 : 36;
    for (let tx = -CH.ox - off; tx < CH.w; tx += 72) { x.fillStyle = r() < 0.5 ? '#3a2e2e' : '#30262a'; x.fillRect(tx + 2, ty + 2, 68, 36); }
  }
  const sw = x.createLinearGradient(0, sb, 0, CH.walk); sw.addColorStop(0, 'rgba(255,140,70,0.25)'); sw.addColorStop(0.3, 'rgba(255,140,70,0.05)'); sw.addColorStop(1, 'rgba(0,0,0,0.2)');
  x.fillStyle = sw; x.fillRect(-CH.ox, sb, CH.w, CH.walk - sb);
  // curb + road
  x.fillStyle = '#8a8078'; x.fillRect(-CH.ox, CH.walk, CH.w, 18);
  x.fillStyle = '#4a4440'; x.fillRect(-CH.ox, CH.walk + 18, CH.w, 8);
  const rg = x.createLinearGradient(0, CH.walk + 26, 0, CH.h); rg.addColorStop(0, '#1e1a22'); rg.addColorStop(1, '#0e0c12');
  x.fillStyle = rg; x.fillRect(-CH.ox, CH.walk + 26, CH.w, CH.h);
  // wet reflections of lit shopfronts
  x.save(); x.globalCompositeOperation = 'screen'; x.filter = 'blur(28px)';
  for (const d of defs) {
    const cx = d[0] + d[1] / 2;
    const g = x.createLinearGradient(0, CH.walk + 26, 0, CH.h);
    g.addColorStop(0, d[9] ? 'rgba(255,140,60,0.4)' : 'rgba(255,120,60,0.22)'); g.addColorStop(1, 'rgba(255,90,40,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, CH.walk + 26, d[1] * 0.32, CH.h - CH.walk, 0, 0, Math.PI); x.fill();
  }
  x.restore();
  x.fillStyle = 'rgba(255,240,200,0.35)';
  for (let lx = -CH.ox; lx < CH.w; lx += 220) x.fillRect(lx, 1800, 120, 9);
  STREET = c;
}
function drawStreet(ctx) { if (!STREET) buildStreet(); ctx.drawImage(STREET, -CH.ox, 0); }

// ---------------- fire ----------------
// wok-hei flame tongues rising from (x,y) base; w width, h height, k intensity 0..1+
function fire(ctx, x, y, w, h, t, k = 1, seed = 1) {
  if (k <= 0.01) return;
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const n = 14;
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n - 0.5, ph = r() * TAU, sp = 7 + r() * 6;
      const fl = 0.55 + 0.45 * Math.sin(t * sp + ph) * Math.sin(t * (sp * 0.6) + ph * 2);
      const hh = h * k * (1 - Math.abs(u) * 1.2) * (0.5 + 0.6 * fl) * (1 - layer * 0.25);
      if (hh < 4) continue;
      const bx = x + u * w, bw = w / n * (2.4 - layer * 0.5);
      const sway = Math.sin(t * 5 + i + layer) * hh * 0.18 + u * hh * 0.35;
      const g = ctx.createLinearGradient(0, y, 0, y - hh);
      if (layer === 2) { g.addColorStop(0, 'rgba(255,255,230,0.9)'); g.addColorStop(0.5, 'rgba(255,220,120,0.6)'); g.addColorStop(1, 'rgba(255,180,60,0)'); }
      else if (layer === 1) { g.addColorStop(0, 'rgba(255,210,90,0.75)'); g.addColorStop(0.5, 'rgba(255,130,30,0.5)'); g.addColorStop(1, 'rgba(255,60,10,0)'); }
      else { g.addColorStop(0, 'rgba(255,140,40,0.6)'); g.addColorStop(0.6, 'rgba(220,50,10,0.4)'); g.addColorStop(1, 'rgba(120,20,5,0)'); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(bx - bw / 2, y);
      ctx.bezierCurveTo(bx - bw * 0.6, y - hh * 0.45, bx + sway - bw * 0.2, y - hh * 0.75, bx + sway, y - hh);
      ctx.bezierCurveTo(bx + sway + bw * 0.2, y - hh * 0.7, bx + bw * 0.6, y - hh * 0.4, bx + bw / 2, y);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  glow(ctx, x, y - h * 0.3 * k, Math.max(w, h) * 0.9 * Math.min(1.4, k), 'rgba(255,120,30,0.7)', Math.min(1, k * 0.8));
}
function embers(ctx, t, seed, n, x, y, w, h, a = 1) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.4 + r() * 0.6, bx = (r() - 0.5) * w, sz = 2 + r() * 4;
    const life = (t * sp + ph) % 1;
    const px = x + bx + Math.sin(t * 3 + i) * 30 * life, py = y - life * h;
    ctx.globalAlpha = (1 - life) * 0.95 * a;
    ctx.fillStyle = `rgba(255,${150 + r() * 90 | 0},60,1)`;
    ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function smoke(ctx, t, seed, x, y, w, h, n = 8, a = 0.35, col = '120,110,110') {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.3 + r() * 0.3, bx = (r() - 0.5) * w, rad = 30 + r() * 50;
    const life = (t * sp + ph) % 1;
    const yy = y - life * h, xx = x + bx + Math.sin(t * 1.4 + i * 1.7) * 40 * life;
    ctx.globalAlpha = a * Math.sin(life * Math.PI);
    const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, rad * (0.6 + life * 1.4));
    g.addColorStop(0, `rgba(${col},0.8)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, rad * (0.6 + life * 1.4), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------------- burner + steel counter ----------------
function burner(ctx, x, y, s) {
  at(ctx, x, y, 0, s, s, () => {
    ell(ctx, 0, 0, 150, 34); ctx.fillStyle = '#1a1614'; ctx.fill();
    ctx.strokeStyle = '#4a4440'; ctx.lineWidth = 10; ell(ctx, 0, 0, 132, 28); ctx.stroke();
    ctx.fillStyle = '#2a2420'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.fillRect(Math.cos(a) * 110 - 6, Math.sin(a) * 22 - 14, 12, 18); }
  });
}
// steel counter: top surface centred x, top at y, width w, height h
function counter(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#3a3c40'); g.addColorStop(0.2, '#8a8e92'); g.addColorStop(0.35, '#d8d4cc'); g.addColorStop(0.5, '#7c8084'); g.addColorStop(0.8, '#9a9ea2'); g.addColorStop(1, '#3a3c40');
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - w / 2, y + 30, w, 4); ctx.fillRect(x - w / 2, y + h * 0.55, w, 4);
  // warm firelight on steel
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const fg = ctx.createLinearGradient(0, y, 0, y + h); fg.addColorStop(0, 'rgba(255,140,60,0.5)'); fg.addColorStop(1, 'rgba(255,100,40,0)');
  ctx.fillStyle = fg; ctx.fillRect(x - w / 2, y, w, h); ctx.restore();
  // top lip
  ctx.fillStyle = '#c9c6c0'; ctx.fillRect(x - w / 2 - 10, y - 14, w + 20, 16);
  ctx.fillStyle = 'rgba(255,230,200,0.7)'; ctx.fillRect(x - w / 2 - 10, y - 14, w + 20, 3);
  // little gas bottle + jars on counter
}
// steel table (side), origin floor centre, top at -h
function steelTable(ctx, x, y, s, w = 300, h = 210) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.strokeStyle = '#8a8e92'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-w / 2 + 20, -h); ctx.lineTo(-w / 2 + 30, 0); ctx.moveTo(w / 2 - 20, -h); ctx.lineTo(w / 2 - 30, 0); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-w / 2 + 26, -h * 0.3); ctx.lineTo(w / 2 - 26, -h * 0.3); ctx.stroke();
    const g = ctx.createLinearGradient(0, -h - 18, 0, -h);
    g.addColorStop(0, '#f2efe8'); g.addColorStop(1, '#7c8084');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h - 18, w, 18, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,90,0.4)'; ctx.fillRect(-w / 2 + 4, -h - 18, w - 8, 3);
  });
}
function steelStool(ctx, x, y, s, h = 120) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.strokeStyle = '#7c8084'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-36, -h); ctx.lineTo(-46, 0); ctx.moveTo(36, -h); ctx.lineTo(46, 0); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, -h * 0.4); ctx.lineTo(40, -h * 0.4); ctx.stroke();
    ctx.fillStyle = '#c9c6c0'; ctx.beginPath(); ctx.ellipse(0, -h, 52, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,90,0.45)'; ctx.beginPath(); ctx.ellipse(-10, -h - 3, 30, 4, 0, 0, TAU); ctx.fill();
  });
}

// ---------------- chef "chú A Phát" (front view, upper body) ----------------
// origin = waist centre. o: {hl:[x,y], hr:[x,y] hand targets relative to origin, mood:'smile'|'focus'|'worried'|'laugh', look, t, tilt, light}
const CSKIN = ['#e8b88e', '#c88a60', '#9a6040'];
function chef(ctx, x, y, s, o = {}) {
  const t = o.t || 0, mood = o.mood || 'focus';
  at(ctx, x, y, o.lean || 0, s, s, () => {
    const shL = [-108, -300], shR = [108, -300];
    const hl = o.hl || [-120, -60], hr = o.hr || [120, -60];
    const armDraw = (sh, hd, side, front) => {
      const el = ik(sh[0], sh[1], hd[0], hd[1], 120, 118, side > 0 ? -1 : 1);
      seg(ctx, sh[0], sh[1], el[0], el[1], 50, 42, CSKIN[1]);
      seg(ctx, el[0], el[1], hd[0], hd[1], 42, 36, CSKIN[1]);
      // short white sleeve
      const mx = lerp(sh[0], el[0], 0.55), my = lerp(sh[1], el[1], 0.55);
      seg(ctx, sh[0], sh[1] - 4, mx, my, 70, 60, '#f1ede4');
      ell(ctx, hd[0], hd[1], 24, 22); ctx.fillStyle = CSKIN[0]; ctx.fill();
    };
    // torso: white shirt
    ctx.beginPath(); ctx.moveTo(-120, -310); ctx.quadraticCurveTo(-140, -150, -112, 160); ctx.lineTo(112, 160); ctx.quadraticCurveTo(140, -150, 120, -310); ctx.quadraticCurveTo(0, -345, -120, -310); ctx.closePath();
    const tg = ctx.createLinearGradient(-130, 0, 130, 0); tg.addColorStop(0, '#fff6e8'); tg.addColorStop(0.6, '#e9e2d4'); tg.addColorStop(1, '#a8a296');
    ctx.fillStyle = tg; ctx.fill();
    // apron (white, with neck strap) slightly different tone
    ctx.beginPath(); ctx.moveTo(-70, -240); ctx.lineTo(70, -240); ctx.lineTo(96, 160); ctx.lineTo(-96, 160); ctx.closePath();
    const ag = ctx.createLinearGradient(0, -240, 0, 160); ag.addColorStop(0, '#fbfaf6'); ag.addColorStop(1, '#ddd6c8'); ctx.fillStyle = ag; ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,80,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#e9e4da'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-62, -240); ctx.lineTo(-34, -318); ctx.moveTo(62, -240); ctx.lineTo(34, -318); ctx.stroke();
    ctx.fillStyle = 'rgba(160,120,80,0.25)'; ell(ctx, 30, -40, 22, 14); ctx.fill(); ell(ctx, -40, 40, 14, 10); ctx.fill(); // sauce stains
    ctx.fillStyle = '#e9e4da'; ctx.fillRect(-112, -20, 224, 14); // apron tie
    // neck
    ctx.fillStyle = CSKIN[1]; ctx.fillRect(-28, -360, 56, 50);
    // towel on left shoulder (checked blue)
    ctx.save(); ctx.beginPath(); ctx.moveTo(-150, -300); ctx.quadraticCurveTo(-110, -345, -50, -322); ctx.lineTo(-62, -298); ctx.quadraticCurveTo(-110, -310, -126, -230); ctx.lineTo(-150, -150); ctx.lineTo(-172, -160); ctx.closePath();
    ctx.fillStyle = '#9cc4dc'; ctx.fill(); ctx.clip();
    ctx.strokeStyle = 'rgba(40,80,140,0.5)'; ctx.lineWidth = 5;
    for (let i = -200; i < 0; i += 16) { ctx.beginPath(); ctx.moveTo(i, -360); ctx.lineTo(i + 60, -120); ctx.stroke(); }
    ctx.restore();
    // head
    at(ctx, 0, -425, (o.tilt || 0), 1, 1, () => {
      ell(ctx, -74, 6, 16, 24); ctx.fillStyle = CSKIN[1]; ctx.fill(); ell(ctx, 74, 6, 16, 24); ctx.fill();
      ell(ctx, 0, 0, 76, 86);
      const hg = ctx.createRadialGradient(-20, -20, 8, 0, 0, 90); hg.addColorStop(0, CSKIN[0]); hg.addColorStop(0.75, CSKIN[1]); hg.addColorStop(1, CSKIN[2]);
      ctx.fillStyle = hg; ctx.fill();
      // cloth cap
      ctx.beginPath(); ctx.moveTo(-80, -26); ctx.quadraticCurveTo(-86, -112, 0, -116); ctx.quadraticCurveTo(86, -112, 80, -26); ctx.quadraticCurveTo(0, -44, -80, -26); ctx.closePath();
      const cg = ctx.createLinearGradient(0, -116, 0, -26); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#d8d2c6'); ctx.fillStyle = cg; ctx.fill();
      ctx.strokeStyle = 'rgba(120,110,100,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-80, -30); ctx.quadraticCurveTo(0, -48, 80, -30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-30, -112); ctx.quadraticCurveTo(-20, -70, -36, -40); ctx.stroke();
      const lx = (o.look || 0) * 8;
      // brows
      ctx.strokeStyle = '#2a1a12'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      const bw = mood === 'worried' ? 1 : 0;
      ctx.beginPath(); ctx.moveTo(-50, -20 - bw * 4); ctx.lineTo(-16, -24 - bw * 14); ctx.moveTo(50, -20 - bw * 4); ctx.lineTo(16, -24 - bw * 14); ctx.stroke();
      // eyes
      if (mood === 'laugh' || mood === 'smile') {
        ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(-32, 8, 13, Math.PI * 1.1, Math.PI * 1.9); ctx.moveTo(19, 2); ctx.arc(32, 8, 13, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      } else {
        const er = mood === 'worried' ? 10 : 7;
        ctx.fillStyle = '#fff'; ell(ctx, -32 + lx, 4, er + 4, er); ctx.fill(); ell(ctx, 32 + lx, 4, er + 4, er); ctx.fill();
        ctx.fillStyle = '#1a1210'; ell(ctx, -32 + lx * 1.5, 4, 5, 6); ctx.fill(); ell(ctx, 32 + lx * 1.5, 4, 5, 6); ctx.fill();
      }
      // nose
      ctx.fillStyle = 'rgba(150,80,50,0.45)'; ell(ctx, 0, 30, 14, 10); ctx.fill();
      // mustache
      ctx.fillStyle = '#2a1a12'; ctx.beginPath(); ctx.moveTo(-30, 50); ctx.quadraticCurveTo(0, 36, 30, 50); ctx.quadraticCurveTo(0, 46, -30, 50); ctx.fill();
      // mouth
      ctx.strokeStyle = '#6a2a1a'; ctx.lineWidth = 5;
      if (mood === 'laugh') {
        const op = 0.6 + 0.4 * Math.abs(Math.sin(t * 14));
        ctx.beginPath(); ctx.moveTo(-28, 58); ctx.quadraticCurveTo(0, 58 + 40 * op, 28, 58); ctx.closePath(); ctx.fillStyle = '#5a1a12'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillRect(-20, 58, 40, 7);
      } else if (mood === 'worried') {
        ell(ctx, 0, 66, 11, 13); ctx.fillStyle = '#4a1612'; ctx.fill();
        // sweat drop
        ctx.fillStyle = 'rgba(190,230,255,0.9)'; ctx.beginPath(); ctx.moveTo(70, -40); ctx.quadraticCurveTo(84, -12, 70, -6); ctx.quadraticCurveTo(56, -12, 70, -40); ctx.fill();
      } else if (mood === 'smile') {
        ctx.beginPath(); ctx.moveTo(-26, 60); ctx.quadraticCurveTo(0, 78, 26, 60); ctx.stroke();
      } else { ctx.beginPath(); ctx.moveTo(-18, 64); ctx.lineTo(18, 64); ctx.stroke(); }
      // fire rim light
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,170,90,${0.55 * (o.light === undefined ? 1 : o.light)})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, 74, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); ctx.restore();
    });
    armDraw(shL, hl, -1); armDraw(shR, hr, 1);
  });
}

module.exports = { nightSky, stars, moon, roof, lantern, lanternString, sign, CH, drawStreet, fire, embers, smoke, burner, counter, steelTable, steelStool, chef, CSKIN };
