// Saigon environments: dawn sky, aerial rooftops, street-café set, motorbikes, power lines, uncle silhouette, menu board.
const L = require('./lib');
const P = require('./props');
const { W, H, TAU, lerp, clamp, rng, at, glow, createCanvas } = L;
const { ell, shade } = P;

function toRGB(c) {
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  return c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
}
function mix(c1, c2, t) {
  const a = toRGB(c1), b = toRGB(c2);
  return `rgb(${(a[0] * (1 - t) + b[0] * t) | 0},${(a[1] * (1 - t) + b[1] * t) | 0},${(a[2] * (1 - t) + b[2] * t) | 0})`;
}
const hex = (rgb) => { const m = rgb.match(/\d+/g).map(Number); return '#' + m.map(v => v.toString(16).padStart(2, '0')).join(''); };

// ---------- sky ----------
function sky(ctx, x0, y0, w, h, horizon) {
  const g = ctx.createLinearGradient(0, y0, 0, horizon);
  g.addColorStop(0, '#5f9fd0'); g.addColorStop(0.45, '#9cc6df'); g.addColorStop(0.8, '#e9e2c8'); g.addColorStop(1, '#f6e6b8');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
}

// ---------- aerial rooftops (cached) ----------
let AERIAL = null;
const AER = { w: 1500, h: 2700, ox: 210 }; // canvas x = world x + ox
function buildAerial() {
  const c = createCanvas(AER.w, AER.h), x = c.getContext('2d');
  x.translate(AER.ox, 0);
  sky(x, -AER.ox, 0, AER.w, AER.h, 1150);
  // distant haze band
  const hz = x.createLinearGradient(0, 950, 0, 1250); hz.addColorStop(0, 'rgba(240,230,200,0)'); hz.addColorStop(1, 'rgba(240,230,200,0.9)');
  x.fillStyle = hz; x.fillRect(-AER.ox, 950, AER.w, 300);
  const pal = ['#e6c25a', '#d9a94e', '#e9d7b0', '#c9b48a', '#e2c77a', '#b9a07a', '#ddb86a', '#cfc0a0'];
  const rows = 6;
  for (let i = 0; i < rows; i++) {
    const r = rng(100 + i);
    const sc = 0.32 + i * 0.22, base = 1150 + i * 270 + i * i * 12, haze = Math.max(0, 0.85 - i * 0.2);
    let bx = -AER.ox - r() * 100;
    while (bx < AER.w - AER.ox) {
      const bw = (110 + r() * 170) * sc, bh = (160 + r() * 420) * sc, col = pal[(r() * pal.length) | 0];
      const top = base - bh;
      const fc = hex(mix(col, '#eadfc2', haze));
      // facade
      x.fillStyle = fc; x.fillRect(bx, top, bw, bh + 400);
      // side shadow
      x.fillStyle = `rgba(40,30,50,${0.25 * (1 - haze)})`; x.fillRect(bx + bw * 0.82, top, bw * 0.18, bh + 400);
      // roof slab (seen from above)
      const rh = 26 * sc;
      x.fillStyle = hex(mix(shade(col, 0.25), '#efe2c4', haze)); x.fillRect(bx, top - rh, bw, rh);
      x.fillStyle = `rgba(0,0,0,${0.18 * (1 - haze)})`; x.fillRect(bx, top - 3 * sc, bw, 3 * sc);
      // windows
      const fh = 70 * sc;
      for (let fy = top + 20 * sc; fy < base - 30 * sc; fy += fh) {
        for (let wx = bx + 12 * sc; wx < bx + bw - 30 * sc; wx += 42 * sc) {
          const lit = r() < 0.12;
          x.fillStyle = lit ? `rgba(255,${200 + r() * 40 | 0},120,${0.9 - haze * 0.5})` : `rgba(40,50,70,${0.45 * (1 - haze * 0.8)})`;
          x.fillRect(wx, fy, 22 * sc, 32 * sc);
        }
        // balcony line
        x.fillStyle = `rgba(60,40,30,${0.25 * (1 - haze)})`; x.fillRect(bx, fy + 46 * sc, bw * 0.8, 4 * sc);
      }
      // Hanoi pitched tile roof
      if (r() < 0.6) {
        const ph = bw * 0.28;
        x.beginPath(); x.moveTo(bx - 4 * sc, top - rh * 0.4); x.lineTo(bx + bw * 0.5, top - rh - ph); x.lineTo(bx + bw + 4 * sc, top - rh * 0.4); x.closePath();
        x.fillStyle = hex(mix('#a8482a', '#eadfc2', haze)); x.fill();
        x.strokeStyle = `rgba(70,25,10,${0.35 * (1 - haze)})`; x.lineWidth = 1.5 * sc;
        for (let k = 1; k < 6; k++) { const yy = top - rh - ph + (ph + rh * 0.6) * k / 6, hw = bw * 0.5 * k / 6 + 4 * sc; x.beginPath(); x.moveTo(bx + bw * 0.5 - hw, yy); x.lineTo(bx + bw * 0.5 + hw, yy); x.stroke(); }
      }
      // stainless water tank on roof
      if (r() < 0.35) {
        const tx = bx + bw * (0.2 + r() * 0.5), tr = 20 * sc, th = 40 * sc, ty = top - rh * 0.5;
        const tg = x.createLinearGradient(tx - tr, 0, tx + tr, 0);
        const hz2 = (v) => hex(mix(v, '#eadfc2', haze * 0.8));
        tg.addColorStop(0, hz2('#6d7378')); tg.addColorStop(0.3, hz2('#f4f1ea')); tg.addColorStop(1, hz2('#5a5f63'));
        x.fillStyle = tg; x.fillRect(tx - tr, ty - th, tr * 2, th);
        x.beginPath(); x.ellipse(tx, ty - th, tr, tr * 0.35, 0, 0, TAU); x.fillStyle = hz2('#dcdad4'); x.fill();
        // legs
        x.fillStyle = hz2('#3a3a3a'); x.fillRect(tx - tr * 0.8, ty, 3 * sc, 10 * sc); x.fillRect(tx + tr * 0.7, ty, 3 * sc, 10 * sc);
      }
      if (r() < 0.4) { // antenna
        x.strokeStyle = hex(mix('#2a2a2a', '#eadfc2', haze)); x.lineWidth = 2 * sc;
        const ax = bx + bw * r(); x.beginPath(); x.moveTo(ax, top - rh); x.lineTo(ax, top - rh - 70 * sc); x.moveTo(ax - 20 * sc, top - rh - 55 * sc); x.lineTo(ax + 20 * sc, top - rh - 55 * sc); x.stroke();
      }
      if (r() < 0.35) { // rooftop plants
        for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(bx + bw * (0.1 + r() * 0.8), top - rh, (8 + r() * 10) * sc, 0, TAU); x.fillStyle = hex(mix('#3f7a3a', '#e6dcc0', haze)); x.fill(); }
      }
      bx += bw + r() * 6 * sc;
    }
  }
  AERIAL = c;
}
function drawAerial(ctx) {
  if (!AERIAL) buildAerial();
  ctx.drawImage(AERIAL, -AER.ox, 0);
}

// ---------- power lines ----------
function wires(ctx, x0, y0, x1, y1, n, seed, sag = 80, col = '#15100d', t = 0) {
  const r = rng(seed);
  ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = y0 + (r() - 0.5) * 90, b = y1 + (r() - 0.5) * 120, sg = sag * (0.5 + r()), sw = Math.sin(t * 0.8 + i) * 3;
    ctx.lineWidth = 1.5 + r() * 3.5;
    ctx.beginPath(); ctx.moveTo(x0, a); ctx.quadraticCurveTo((x0 + x1) / 2, (a + b) / 2 + sg + sw, x1, b); ctx.stroke();
  }
  ctx.restore();
}
function sparrow(ctx, x, y, s, flap, flip) {
  at(ctx, x, y, 0, flip ? -s : s, s, () => {
    ctx.fillStyle = '#17110d';
    ell(ctx, 0, 0, 14, 9); ctx.fill();
    ell(ctx, 10, -7, 7, 6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(16, -7); ctx.lineTo(22, -5); ctx.lineTo(16, -4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-24, 6); ctx.lineTo(-12, 5); ctx.fill();
    if (flap !== null && flap !== undefined) {
      const a = Math.sin(flap) * 0.9;
      ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(-10, -4 - 24 * Math.cos(a)); ctx.lineTo(8, -5); ctx.fill();
    }
  });
}

// ---------- street-café set (static, cached) ----------
let STREET = null;
const ST = { w: 1600, h: 1920, ox: 260, base: 1130, walk: 1345 };
function signboard(x, cx, cy, w, h, bg, fg, text) {
  x.fillStyle = bg; x.fillRect(cx - w / 2, cy - h / 2, w, h);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(cx - w / 2, cy + h / 2 - 6, w, 6);
  x.font = `${Math.round(h * 0.55)}px BodySansBold`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = fg; x.fillText(text, cx, cy + 2);
}
function buildStreet() {
  const c = createCanvas(ST.w, ST.h), x = c.getContext('2d');
  x.translate(ST.ox, 0);
  sky(x, -ST.ox, 0, ST.w, 700, 700);
  const r = rng(555);
  const pal = ['#e8c35a', '#dcae55', '#e9d6a8', '#d9b46a', '#c9a77a', '#e5c97a'];
  const signs = [['BIA HƠI', '#1f5fa8', '#ffffff'], ['BÚN CHẢ', '#b3261e', '#ffe9a8'], ['PHỞ GÀ', '#e8c33a', '#a3161a'], ['TẠP HÓA', '#2d7a3e', '#fff6d6'], ['BÁNH CUỐN', '#c0392b', '#fff2c0'], ['CÀ PHÊ', '#5a3a22', '#ffe9c0']];
  let bx = -ST.ox, si = 0;
  while (bx < ST.w - ST.ox) {
    const bw = 230 + r() * 110, top = 130 + r() * 210, col = pal[(r() * pal.length) | 0];
    const base = ST.base;
    // facade
    const fg = x.createLinearGradient(0, top, 0, base);
    fg.addColorStop(0, shade(col, 0.12)); fg.addColorStop(1, shade(col, -0.25));
    x.fillStyle = fg; x.fillRect(bx, top, bw, base - top);
    // parapet & roof tank
    x.fillStyle = shade(col, -0.1); x.fillRect(bx - 4, top - 18, bw + 8, 22);
    if (r() < 0.6) {
      const tx = bx + bw * (0.25 + r() * 0.5), tg = x.createLinearGradient(tx - 34, 0, tx + 34, 0);
      tg.addColorStop(0, '#7d8186'); tg.addColorStop(0.3, '#fbf3e6'); tg.addColorStop(1, '#5f6367');
      x.fillStyle = tg; x.fillRect(tx - 34, top - 100, 68, 82);
      x.beginPath(); x.ellipse(tx, top - 100, 34, 11, 0, 0, TAU); x.fillStyle = '#e6e1d7'; x.fill();
    }
    // upper floors
    for (let fy = top + 30; fy < base - 380; fy += 300) {
      const fh = Math.min(300, base - 380 - fy);
      if (fh < 120) break;
      // door/window with green louvred shutters
      const ww = bw * 0.5, wx = bx + (bw - ww) / 2;
      x.fillStyle = '#2a2420'; x.fillRect(wx, fy + 40, ww, fh - 80);
      x.fillStyle = 'rgba(255,190,110,0.35)'; x.fillRect(wx + 8, fy + 48, ww - 16, fh - 96);
      const shut = r() < 0.5 ? '#2f7a5c' : '#3a6f8f';
      x.fillStyle = shut; x.fillRect(wx - ww * 0.32, fy + 40, ww * 0.3, fh - 80); x.fillRect(wx + ww + 2, fy + 40, ww * 0.3, fh - 80);
      x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2;
      for (let ly = fy + 50; ly < fy + fh - 45; ly += 12) { x.beginPath(); x.moveTo(wx - ww * 0.32, ly); x.lineTo(wx - 2, ly); x.moveTo(wx + ww + 2, ly); x.lineTo(wx + ww * 1.32, ly); x.stroke(); }
      // balcony slab + railing
      x.fillStyle = shade(col, -0.35); x.fillRect(bx - 10, fy + fh - 40, bw + 20, 14);
      x.strokeStyle = '#2a2622'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(bx - 6, fy + fh - 110); x.lineTo(bx + bw + 6, fy + fh - 110); x.stroke();
      for (let rx = bx; rx <= bx + bw; rx += 16) { x.beginPath(); x.moveTo(rx, fy + fh - 110); x.lineTo(rx, fy + fh - 40); x.stroke(); }
      // potted plants
      for (let k = 0; k < 3; k++) {
        if (r() < 0.4) continue;
        const px = bx + 20 + r() * (bw - 40);
        x.fillStyle = '#8a4a2a'; x.fillRect(px - 14, fy + fh - 70, 28, 30);
        for (let l = 0; l < 6; l++) { x.beginPath(); x.ellipse(px + (r() - 0.5) * 40, fy + fh - 80 - r() * 40, 16, 10, r() * 3, 0, TAU); x.fillStyle = r() < 0.5 ? '#3f8a3e' : '#5fae4a'; x.fill(); }
      }
      // AC unit
      if (r() < 0.45) { x.fillStyle = '#e8e6e0'; x.fillRect(bx + bw - 80, fy + 60, 64, 44); x.fillStyle = '#9a9a96'; for (let g = 0; g < 4; g++) x.fillRect(bx + bw - 74, fy + 68 + g * 9, 52, 3); }
    }
    // ground floor shop
    const gy = base - 360;
    x.fillStyle = '#20160f'; x.fillRect(bx + 10, gy + 70, bw - 20, 290);
    const ig = x.createLinearGradient(0, gy + 70, 0, base);
    ig.addColorStop(0, 'rgba(255,180,90,0.45)'); ig.addColorStop(1, 'rgba(255,150,60,0.05)');
    x.fillStyle = ig; x.fillRect(bx + 10, gy + 70, bw - 20, 290);
    // shelves of goods
    for (let sy = gy + 110; sy < base - 60; sy += 60) {
      x.fillStyle = 'rgba(60,40,25,0.9)'; x.fillRect(bx + 24, sy + 34, bw - 48, 5);
      for (let gx = bx + 28; gx < bx + bw - 40; gx += 14 + r() * 10) { x.fillStyle = ['#c0392b', '#e1b12c', '#2e86de', '#ecf0f1', '#27ae60'][(r() * 5) | 0]; x.globalAlpha = 0.55; x.fillRect(gx, sy + 34 - (12 + r() * 18), 10, 12 + r() * 18); x.globalAlpha = 1; }
    }
    // rolled shutter
    x.fillStyle = '#8f9396'; x.fillRect(bx + 4, gy + 40, bw - 8, 34);
    x.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 4; k++) x.fillRect(bx + 4, gy + 44 + k * 8, bw - 8, 2);
    // sign
    const sg = signs[si++ % signs.length];
    signboard(x, bx + bw / 2, gy + 10, bw - 16, 64, sg[1], sg[2], sg[0]);
    // pilaster
    x.fillStyle = shade(col, -0.4); x.fillRect(bx - 4, top, 8, base - top);
    bx += bw;
  }
  // warm side light over facades (from left) + cool shadow right
  const lg = x.createLinearGradient(-ST.ox, 0, ST.w - ST.ox, 0);
  lg.addColorStop(0, 'rgba(255,230,160,0.22)'); lg.addColorStop(0.6, 'rgba(255,220,150,0)'); lg.addColorStop(1, 'rgba(30,60,90,0.18)');
  x.fillStyle = lg; x.fillRect(-ST.ox, 0, ST.w, ST.base);
  // sidewalk tiles
  const sb = ST.base;
  x.fillStyle = '#9c5a43'; x.fillRect(-ST.ox, sb, ST.w, 280);
  for (let ty = sb; ty < sb + 280; ty += 34) {
    const off = ((ty - sb) / 34) % 2 ? 0 : 30;
    for (let tx = -ST.ox - off; tx < ST.w; tx += 60) {
      x.fillStyle = r() < 0.5 ? '#a8634b' : '#93533d';
      x.fillRect(tx + 2, ty + 2, 56, 30);
    }
  }
  const sw = x.createLinearGradient(0, sb, 0, sb + 280); sw.addColorStop(0, 'rgba(0,0,0,0.35)'); sw.addColorStop(0.3, 'rgba(0,0,0,0)'); sw.addColorStop(1, 'rgba(255,200,140,0.12)');
  x.fillStyle = sw; x.fillRect(-ST.ox, sb, ST.w, 280);
  // curb + road
  x.fillStyle = '#c9c4ba'; x.fillRect(-ST.ox, sb + 280, ST.w, 22);
  x.fillStyle = '#7d7a74'; x.fillRect(-ST.ox, sb + 302, ST.w, 8);
  const rg = x.createLinearGradient(0, sb + 310, 0, ST.h);
  rg.addColorStop(0, '#3b3a3d'); rg.addColorStop(1, '#232226');
  x.fillStyle = rg; x.fillRect(-ST.ox, sb + 310, ST.w, ST.h);
  x.fillStyle = 'rgba(255,240,200,0.75)';
  for (let lx = -ST.ox; lx < ST.w; lx += 200) x.fillRect(lx, 1760, 110, 10);
  // road sheen
  const rs = x.createRadialGradient(150, 1500, 10, 150, 1500, 700); rs.addColorStop(0, 'rgba(255,200,140,0.22)'); rs.addColorStop(1, 'rgba(255,200,140,0)');
  x.fillStyle = rs; x.fillRect(-ST.ox, sb + 310, ST.w, 700);
  // utility pole
  const pg = x.createLinearGradient(80, 0, 112, 0); pg.addColorStop(0, '#6a6660'); pg.addColorStop(0.4, '#c7c1b6'); pg.addColorStop(1, '#4f4c48');
  x.fillStyle = pg; x.fillRect(80, 230, 32, sb + 60 - 230);
  x.fillStyle = '#2a2622'; x.fillRect(40, 300, 112, 10); x.fillRect(50, 360, 92, 8);
  // tangled wires
  wires(x, 96, 330, 1300, 380, 9, 7, 110);
  wires(x, -300, 260, 96, 330, 8, 9, 60);
  for (let k = 0; k < 6; k++) { x.strokeStyle = '#15100d'; x.lineWidth = 2; x.beginPath(); x.arc(96 + (k - 3) * 6, 360 + k * 6, 18 + k * 4, 0.3, 2.8); x.stroke(); }
  // tree (right)
  x.fillStyle = '#3b2a1e'; x.beginPath(); x.moveTo(990, sb + 40); x.quadraticCurveTo(1000, 700, 960, 420); x.lineTo(1000, 420); x.quadraticCurveTo(1040, 700, 1035, sb + 40); x.closePath(); x.fill();
  for (let l = 0; l < 70; l++) {
    const lx = 760 + r() * 600, ly = 120 + r() * 380, lr = 40 + r() * 70;
    x.beginPath(); x.arc(lx, ly, lr, 0, TAU);
    x.fillStyle = ['#2f5a2a', '#4c7a34', '#b8452a', '#d9772e', '#8a3a22'][(r() * 5) | 0]; x.globalAlpha = 0.9; x.fill();
  }
  x.globalAlpha = 1;
  // sunlit leaf edges
  for (let l = 0; l < 40; l++) { x.beginPath(); x.arc(760 + r() * 300, 140 + r() * 360, 10 + r() * 20, 0, TAU); x.fillStyle = 'rgba(220,210,120,0.35)'; x.fill(); }
  STREET = c;
}
function drawStreet(ctx) {
  if (!STREET) buildStreet();
  ctx.drawImage(STREET, -ST.ox, 0);
}

// ---------- coffee cart + stove + kettle ----------
function cart(ctx, x, y, s, t) {
  at(ctx, x, y, 0, s, s, () => {
    // wheels
    for (const wx of [-90, 90]) {
      ell(ctx, wx, -40, 40, 40); ctx.fillStyle = '#1c1c1c'; ctx.fill();
      ell(ctx, wx, -40, 16, 16); ctx.fillStyle = '#8a8a8a'; ctx.fill();
    }
    // wooden body
    const g = ctx.createLinearGradient(0, -330, 0, -60);
    g.addColorStop(0, '#9a5a2e'); g.addColorStop(1, '#5a3218');
    ctx.fillStyle = g; ctx.fillRect(-130, -330, 260, 270);
    ctx.fillStyle = '#f2d36b'; ctx.fillRect(-118, -300, 236, 96);
    ctx.font = '50px BodySansBold'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b3261e'; ctx.fillText('CÀ PHÊ', 0, -270);
    ctx.font = '26px BodySansBold'; ctx.fillStyle = '#5a2a10'; ctx.fillText('CÔ BA · SÀI GÒN', 0, -226);
    // glass cabinet
    ctx.fillStyle = 'rgba(200,225,230,0.25)'; ctx.fillRect(-125, -500, 250, 170);
    ctx.strokeStyle = '#4a2a14'; ctx.lineWidth = 8; ctx.strokeRect(-125, -500, 250, 170);
    // jars
    const jar = (jx, col, lv) => {
      ctx.fillStyle = 'rgba(230,240,240,0.45)'; ctx.fillRect(jx - 26, -440, 52, 100);
      ctx.fillStyle = col; ctx.fillRect(jx - 24, -440 + 100 * (1 - lv), 48, 100 * lv);
      ctx.fillStyle = '#c0392b'; ctx.fillRect(jx - 28, -452, 56, 14);
    };
    jar(-70, '#3b2416', 0.8); jar(0, '#f4ede0', 0.6); jar(70, '#6a3a1a', 0.7);
    // roof
    ctx.fillStyle = '#2e6d8e'; ctx.beginPath(); ctx.moveTo(-160, -500); ctx.lineTo(160, -500); ctx.lineTo(140, -540); ctx.lineTo(-140, -540); ctx.closePath(); ctx.fill();
  });
}

// uncle silhouette / figure. origin = feet centre. o.nod 0..1, o.rim (0..1), o.sil (silhouette)
function uncle(ctx, x, y, s, o = {}) {
  const shape = (c) => {
    // body
    c.beginPath(); c.moveTo(-70, -330); c.quadraticCurveTo(-80, -200, -60, 0); c.lineTo(60, 0); c.quadraticCurveTo(80, -200, 70, -330);
    c.quadraticCurveTo(0, -360, -70, -330); c.fill();
    // neck + head (nod)
    c.save(); c.translate(0, -350); c.rotate((o.nod || 0) * 0.28);
    c.fillRect(-14, -30, 28, 34);
    c.beginPath(); c.ellipse(4, -64, 36, 42, 0, 0, TAU); c.fill();
    // flat cap
    c.beginPath(); c.ellipse(0, -96, 42, 16, -0.05, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(-36, -88, 24, 7, -0.1, 0, TAU); c.fill();
    // nose
    c.beginPath(); c.moveTo(-30, -64); c.lineTo(-42, -52); c.lineTo(-30, -48); c.fill();
    c.restore();
    // arms
    c.beginPath(); c.roundRect(-92, -320, 30, 200, 15); c.fill();
    c.beginPath(); c.roundRect(62, -320, 30, 200, 15); c.fill();
  };
  at(ctx, x, y, 0, s, s, () => {
    if (o.sil) {
      ctx.fillStyle = `rgba(255,214,150,${o.rim || 0.9})`; shape(ctx);
      ctx.save(); ctx.translate(7, 4); ctx.fillStyle = '#140d09'; shape(ctx); ctx.restore();
    } else {
      // simple lit version: skin + white tank top
      ctx.fillStyle = '#9a6a48'; shape(ctx);
      ctx.fillStyle = '#ece6da';
      ctx.beginPath(); ctx.moveTo(-60, -300); ctx.quadraticCurveTo(-70, -200, -55, -40); ctx.lineTo(55, -40); ctx.quadraticCurveTo(70, -200, 60, -300); ctx.quadraticCurveTo(0, -260, -60, -300); ctx.fill();
      ctx.fillStyle = '#2b2b30'; ctx.fillRect(-60, -60, 120, 60);
    }
  });
}

// hand-painted menu board
function menuBoard(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.save(); ctx.filter = 'blur(12px)'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-250, -150, 520, 440); ctx.restore();
    const g = ctx.createLinearGradient(0, -170, 0, 270);
    g.addColorStop(0, '#2c4a3a'); g.addColorStop(1, '#1b3127');
    ctx.fillStyle = '#6a4224'; ctx.fillRect(-272, -192, 544, 484);
    ctx.fillStyle = g; ctx.fillRect(-250, -170, 500, 440);
    ctx.textBaseline = 'middle';
    ctx.font = '40px TitleSerif'; ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.fillText('MENU', 0, -125);
    ctx.fillStyle = 'rgba(255,233,168,0.5)'; ctx.fillRect(-180, -95, 360, 3);
    const rows = [['CÀ PHÊ ĐEN', '15K', '#fff3d0'], ['CÀ PHÊ SỮA', '20K', '#f2e6d8'], ['BẠC XỈU', '20K', '#f2e6d8'], ['TRÀ ĐÁ', '3K', '#f2e6d8']];
    rows.forEach((rw, i) => {
      const yy = -50 + i * 72;
      ctx.font = (i === 0 ? '44px' : '38px') + ' BodySansBold'; ctx.textAlign = 'left'; ctx.fillStyle = rw[2]; ctx.fillText(rw[0], -220, yy);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffcf5a'; ctx.fillText(rw[1], 220, yy);
    });
    // chalk dust
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff'; const r = rng(4);
    for (let i = 0; i < 300; i++) ctx.fillRect(-250 + r() * 500, -170 + r() * 440, 2, 2);
    ctx.globalAlpha = 1;
  });
}

// ---------- motorbike + rider (side view, facing +x). origin = ground centre ----------
function motorbike(ctx, x, y, s, flip, t, o = {}) {
  at(ctx, x, y, 0, flip ? -s : s, s, () => {
    const body = o.body || '#c0392b', helm = o.helm || '#f1c40f', jacket = o.jacket || '#34495e';
    // headlight beam
    glow(ctx, 230, -150, 200, 'rgba(255,240,200,0.8)', 0.6);
    for (const wx of [-170, 170]) {
      ell(ctx, wx, -60, 60, 60); ctx.fillStyle = '#141414'; ctx.fill();
      ell(ctx, wx, -60, 34, 34); ctx.fillStyle = '#9a9a9a'; ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
      for (let k = 0; k < 5; k++) { const a = t * 20 + k * TAU / 5; ctx.beginPath(); ctx.moveTo(wx, -60); ctx.lineTo(wx + Math.cos(a) * 32, -60 + Math.sin(a) * 32); ctx.stroke(); }
    }
    // body
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-230, -120); ctx.quadraticCurveTo(-160, -200, -40, -180); ctx.lineTo(60, -150); ctx.lineTo(120, -90); ctx.lineTo(-120, -80); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(120, -90); ctx.lineTo(170, -250); ctx.lineTo(220, -250); ctx.lineTo(200, -120); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1b1b'; ctx.beginPath(); ctx.roundRect(-150, -205, 170, 30, 14); ctx.fill(); // seat
    ctx.fillStyle = '#fff6d8'; ell(ctx, 222, -230, 16, 20); ctx.fill(); // headlight
    ctx.strokeStyle = '#222'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(190, -250); ctx.lineTo(150, -300); ctx.stroke();
    // rider
    ctx.fillStyle = '#2c2c34'; ctx.beginPath(); ctx.roundRect(-80, -260, 80, 120, 30); ctx.fill(); // legs
    ctx.fillStyle = jacket; ctx.beginPath(); ctx.roundRect(-90, -420, 100, 180, 40); ctx.fill();
    ctx.strokeStyle = jacket; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-10, -380); ctx.lineTo(140, -300); ctx.stroke();
    ctx.fillStyle = '#e0b08a'; ell(ctx, -30, -460, 34, 38); ctx.fill();
    ctx.fillStyle = helm; ctx.beginPath(); ctx.arc(-34, -470, 44, Math.PI * 0.95, Math.PI * 2.1); ctx.fill();
    ctx.fillStyle = '#7fa0c0'; ctx.fillRect(-12, -462, 40, 26); // mask
    // rim light
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,130,0.6)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(-34, -470, 44, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  });
}

module.exports = { mix, sky, drawAerial, wires, sparrow, drawStreet, ST, cart, uncle, menuBoard, motorbike, AER };
