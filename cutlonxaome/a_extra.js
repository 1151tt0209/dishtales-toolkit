// a_extra.js — writer A extra props: steel street cart (no text), pictogram neon sign, cracked balut with cute embryo,
// kettle, soft dizzy stars. Deterministic; static layers cached.
const L = require('./lib');
const P = require('./a_props');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI, ell = P.ell;

// ---------------------------------------------------------------- STOVE (dark steel range top + burner ring), cached per y
const SC = {};
function stoveTop(y0) {
  const key = 'st' + y0; if (SC[key]) return SC[key];
  const c = createCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#2b2f3c'); g.addColorStop(0.08, '#191b24'); g.addColorStop(1, '#0c0d13');
  x.fillStyle = g; x.fillRect(0, y0, W, H - y0);
  x.fillStyle = 'rgba(200,215,255,0.35)'; x.fillRect(0, y0, W, 2);
  const r = rng(5); x.globalAlpha = 0.06; for (let i = 0; i < 120; i++) { x.fillStyle = r() < 0.5 ? '#fff' : '#000'; x.fillRect(r() * W - 100, y0 + r() * (H - y0), 120 + r() * 400, 1.5); } x.globalAlpha = 1;
  SC[key] = c; return c;
}
// burner ring: cast-iron ring + blue jets (front half drawn by front:true)
function burner(ctx, x, y, R, t, k = 1, o = {}) {
  const ry = R * (o.ry || 0.22);
  ctx.save();
  if (!o.front) {
    ell(ctx, x, y, R * 1.25, ry * 1.35); ctx.fillStyle = '#07080c'; ctx.fill();
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.2); g.addColorStop(0, `rgba(255,120,40,${0.55 * k})`); g.addColorStop(0.6, `rgba(255,80,20,${0.25 * k})`); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / R); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 1.2, 0, TAU); ctx.fill(); ctx.restore();
  }
  // jets
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, sn = Math.sin(a); if (o.front ? sn < 0 : sn >= 0) continue;
    const px = x + Math.cos(a) * R, py = y + sn * ry, fl = 0.8 + 0.2 * Math.sin(t * 37 + i * 2.3), hh = R * 0.16 * fl * Math.min(2, k);
    ctx.strokeStyle = `rgba(80,140,255,${0.55 * Math.min(1, k)})`; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * R * 0.04, py - hh); ctx.stroke();
    ctx.strokeStyle = `rgba(190,220,255,${0.6 * Math.min(1, k)})`; ctx.lineWidth = R * 0.018; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * R * 0.03, py - hh * 0.55); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- KETTLE (top-down, aluminium). origin = spout tip, body centre at (-250,0)
function kettle(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const bx = -250;
  // soft drop shadow
  const sg = ctx.createRadialGradient(bx + 30, 40, 60, bx + 30, 40, 190); sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(bx - 200, -170, 420, 420);
  // spout (tapered)
  const sp = ctx.createLinearGradient(0, -20, 0, 20); sp.addColorStop(0, '#f2f5fa'); sp.addColorStop(0.5, '#9aa2b4'); sp.addColorStop(1, '#4a5064');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.moveTo(bx + 100, -26); ctx.quadraticCurveTo(-60, -16, 0, -9); ctx.quadraticCurveTo(6, 0, 0, 9); ctx.quadraticCurveTo(-60, 16, bx + 100, 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2e3240'; ell(ctx, -2, 0, 5, 8); ctx.fill();
  // body
  const g = ctx.createRadialGradient(bx - 45, -50, 10, bx, 0, 135); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#c9cfdb'); g.addColorStop(0.8, '#7d8598'); g.addColorStop(1, '#4b5163');
  ctx.fillStyle = g; ell(ctx, bx, 0, 130, 130); ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,90,0.45)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(bx, 0, 127, 0.2, 1.4); ctx.stroke();
  // lid + knob
  const lg = ctx.createRadialGradient(bx - 20, -20, 5, bx, 0, 75); lg.addColorStop(0, '#eef1f6'); lg.addColorStop(1, '#8a92a4');
  ctx.fillStyle = lg; ell(ctx, bx, 0, 72, 72); ctx.fill();
  ctx.strokeStyle = 'rgba(60,66,84,0.45)'; ctx.lineWidth = 3; ell(ctx, bx, 0, 72, 72); ctx.stroke();
  ctx.fillStyle = '#3a2c26'; ell(ctx, bx, 0, 20, 20); ctx.fill(); ctx.fillStyle = 'rgba(255,220,190,0.5)'; ell(ctx, bx - 6, -7, 7, 4); ctx.fill();
  // arched handle across the body
  ctx.lineCap = 'round'; ctx.strokeStyle = '#3a2c26'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(bx - 30, -118); ctx.bezierCurveTo(bx - 120, -60, bx - 120, 60, bx - 30, 118); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,200,150,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx - 42, -104); ctx.bezierCurveTo(bx - 118, -50, bx - 118, 40, bx - 60, 90); ctx.stroke();
  ctx.restore();
}
// ripple rings on a liquid surface (age a 0..1)
function ripple(ctx, x, y, r, a, col = '255,235,210', ry = 1) {
  if (a <= 0 || a >= 1) return;
  ctx.save(); ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { const u = a - i * 0.18; if (u <= 0) continue; ctx.strokeStyle = `rgba(${col},${0.55 * (1 - u)})`; ell(ctx, x, y, r * u, r * u * ry); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------- BALUT CART (world coords, wide alley view; cached, no text)
// body x 190..655, counter top y ~996..1022, wheels y 1232. Clay stove at the left end, glass case centre-left,
// clear counter on the right (vendor stands behind at x ~520).
const CART = { x0: 190, x1: 655, top: 1022, bot: 1212, stove: [248, 990], caseX: [318, 452] };
function cartLayer() {
  if (SC.cart) return SC.cart;
  const c = createCanvas(W, H), x = c.getContext('2d');
  const { x0, x1, top, bot } = CART;
  // ground shadow
  const sh = x.createRadialGradient(0, 0, 10, 0, 0, 1); x.save(); x.translate((x0 + x1) / 2 + 20, 1252); x.scale(340, 34);
  const sg = x.createRadialGradient(0, 0, 0.1, 0, 0, 1); sg.addColorStop(0, 'rgba(4,4,14,0.7)'); sg.addColorStop(1, 'rgba(4,4,14,0)'); x.fillStyle = sg; x.beginPath(); x.arc(0, 0, 1, 0, TAU); x.fill(); x.restore();
  // wheels (behind the skirt)
  for (const wx of [262, 588]) {
    const wg = x.createRadialGradient(wx - 10, 1222, 4, wx, 1232, 42); wg.addColorStop(0, '#3a3f52'); wg.addColorStop(0.7, '#181b26'); wg.addColorStop(1, '#0b0c12');
    x.fillStyle = wg; ell(x, wx, 1232, 40, 40); x.fill();
    x.strokeStyle = 'rgba(190,200,225,0.45)'; x.lineWidth = 2.5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; x.beginPath(); x.moveTo(wx, 1232); x.lineTo(wx + Math.cos(a) * 30, 1232 + Math.sin(a) * 30); x.stroke(); }
    x.fillStyle = '#c8cfdf'; ell(x, wx, 1232, 7, 7); x.fill();
    x.strokeStyle = 'rgba(255,90,190,0.35)'; x.lineWidth = 3; x.beginPath(); x.arc(wx, 1232, 38, -2.4, -1.2); x.stroke();
  }
  // legs
  x.fillStyle = '#2a2f40'; x.fillRect(x0 + 14, bot, 10, 30); x.fillRect(x1 - 24, bot, 10, 30);
  // front panel
  const fg = x.createLinearGradient(0, top, 0, bot); fg.addColorStop(0, '#7d88a6'); fg.addColorStop(0.12, '#5d6886'); fg.addColorStop(0.7, '#3a4260'); fg.addColorStop(1, '#262b40');
  x.fillStyle = fg; x.beginPath(); x.roundRect(x0, top, x1 - x0, bot - top, 10); x.fill();
  const r = rng(77); x.save(); x.beginPath(); x.roundRect(x0, top, x1 - x0, bot - top, 10); x.clip();
  x.globalAlpha = 0.09; for (let i = 0; i < 90; i++) { x.fillStyle = r() < 0.5 ? '#fff' : '#000'; x.fillRect(x0 + r() * (x1 - x0) - 60, top + r() * (bot - top), 60 + r() * 200, 1.2); } x.globalAlpha = 1;
  // warm spill from the stove on the left, pink neon from above-right
  const ws = x.createRadialGradient(x0 + 40, top, 0, x0 + 40, top, 300); ws.addColorStop(0, 'rgba(255,150,70,0.4)'); ws.addColorStop(1, 'rgba(255,150,70,0)'); x.fillStyle = ws; x.fillRect(x0, top, x1 - x0, bot - top);
  const ps = x.createLinearGradient(x1, top, x1 - 200, top + 120); ps.addColorStop(0, 'rgba(255,80,190,0.25)'); ps.addColorStop(1, 'rgba(255,80,190,0)'); x.fillStyle = ps; x.fillRect(x0, top, x1 - x0, bot - top);
  x.restore();
  // painted decal panel: big cream egg with a crack + tamarind pod + rau răm leaves (pictogram, no text)
  const dx = (x0 + x1) / 2, dy = 1112;
  x.fillStyle = 'rgba(20,16,30,0.35)'; x.beginPath(); x.roundRect(dx - 150, dy - 62, 300, 124, 26); x.fill();
  x.strokeStyle = 'rgba(255,120,200,0.55)'; x.lineWidth = 3; x.beginPath(); x.roundRect(dx - 150, dy - 62, 300, 124, 26); x.stroke();
  const eg = x.createRadialGradient(dx - 58, dy - 22, 4, dx - 46, dy, 52); eg.addColorStop(0, '#fff3d8'); eg.addColorStop(0.6, '#e6d2a6'); eg.addColorStop(1, '#a8885a');
  x.fillStyle = eg; ell(x, dx - 46, dy + 2, 36, 46); x.fill();
  x.strokeStyle = '#7a5a36'; x.lineWidth = 3; x.lineJoin = 'round'; x.beginPath(); x.moveTo(dx - 80, dy - 6); for (let i = 0; i <= 8; i++) x.lineTo(dx - 80 + i * 8.5, dy - 6 + (i % 2 ? -9 : 3)); x.stroke();
  // tamarind pod
  x.save(); x.translate(dx + 50, dy + 4); x.rotate(-0.35);
  const tg = x.createLinearGradient(0, -16, 0, 16); tg.addColorStop(0, '#c08a52'); tg.addColorStop(1, '#6e4220'); x.fillStyle = tg;
  x.beginPath(); for (let i = 0; i < 4; i++) { ell(x, -48 + i * 30, Math.sin(i * 1.3) * 3, 19, 15); } x.fill(); x.restore();
  for (const [lx, ly, a] of [[dx + 92, dy - 34, -0.6], [dx + 110, dy - 22, 0.2], [dx + 20, dy - 40, -1.3]]) { x.save(); x.translate(lx, ly); x.rotate(a); x.fillStyle = '#5fae3a'; x.beginPath(); x.moveTo(-18, 0); x.quadraticCurveTo(0, -11, 18, 0); x.quadraticCurveTo(0, 11, -18, 0); x.fill(); x.restore(); }
  // stripes + skirt
  x.fillStyle = 'rgba(255,90,190,0.6)'; x.fillRect(x0 + 8, top + 18, x1 - x0 - 16, 5);
  x.fillStyle = 'rgba(80,220,255,0.45)'; x.fillRect(x0 + 8, bot - 26, x1 - x0 - 16, 4);
  // counter slab (thin top plane) + bright front lip
  const cg = x.createLinearGradient(0, top - 26, 0, top); cg.addColorStop(0, '#59627c'); cg.addColorStop(1, '#a9b3cc');
  x.fillStyle = cg; x.beginPath(); x.moveTo(x0 - 8, top); x.lineTo(x1 + 8, top); x.lineTo(x1 - 6, top - 26); x.lineTo(x0 + 6, top - 26); x.closePath(); x.fill();
  x.fillStyle = 'rgba(235,240,255,0.85)'; x.fillRect(x0 - 8, top - 1, x1 - x0 + 16, 3);
  x.fillStyle = 'rgba(255,170,100,0.35)'; x.fillRect(x0 - 8, top - 26, 160, 2);
  // glass case (frame + panes + eggs in a basket + tamarind jar)
  const [gx0, gx1] = CART.caseX, gy0 = 868, gy1 = top - 18;
  x.fillStyle = 'rgba(150,200,255,0.10)'; x.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  // basket
  const bg = x.createLinearGradient(0, gy1 - 52, 0, gy1); bg.addColorStop(0, '#c99a5a'); bg.addColorStop(1, '#7a5228');
  x.fillStyle = bg; x.beginPath(); x.moveTo(gx0 + 10, gy1 - 46); x.lineTo(gx1 - 52, gy1 - 46); x.lineTo(gx1 - 62, gy1 - 2); x.lineTo(gx0 + 18, gy1 - 2); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(80,50,20,0.5)'; x.lineWidth = 2; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(gx0 + 12, gy1 - 40 + i * 9); x.lineTo(gx1 - 54, gy1 - 40 + i * 9); x.stroke(); }
  const er = rng(91);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
    const ex = gx0 + 22 + row * 7 + i * 12.5 + (er() - 0.5) * 3, ey = gy1 - 50 - row * 11;
    const g2 = x.createRadialGradient(ex - 3, ey - 4, 1, ex, ey, 9); g2.addColorStop(0, '#fbeccb'); g2.addColorStop(1, '#b89a6a'); x.fillStyle = g2; ell(x, ex, ey, 6.5, 8); x.fill();
    if (er() < 0.5) { x.fillStyle = 'rgba(90,70,50,0.6)'; ell(x, ex + 1, ey + 1, 1.6, 1.6); x.fill(); }
  }
  // tamarind sauce jar
  const jg = x.createLinearGradient(gx1 - 46, 0, gx1 - 14, 0); jg.addColorStop(0, '#6e2a10'); jg.addColorStop(0.5, '#b5561c'); jg.addColorStop(1, '#4a1a08');
  x.fillStyle = jg; x.beginPath(); x.roundRect(gx1 - 46, gy1 - 62, 32, 58, 8); x.fill();
  x.fillStyle = 'rgba(255,220,180,0.5)'; x.fillRect(gx1 - 40, gy1 - 56, 4, 44);
  x.fillStyle = '#d23c6a'; x.fillRect(gx1 - 48, gy1 - 70, 36, 9);
  // glass highlights + frame
  x.fillStyle = 'rgba(255,255,255,0.10)'; x.beginPath(); x.moveTo(gx0 + 14, gy0 + 6); x.lineTo(gx0 + 50, gy0 + 6); x.lineTo(gx0 + 18, gy1 - 6); x.lineTo(gx0 + 6, gy1 - 6); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.07)'; x.beginPath(); x.moveTo(gx0 + 70, gy0 + 6); x.lineTo(gx0 + 84, gy0 + 6); x.lineTo(gx0 + 52, gy1 - 6); x.lineTo(gx0 + 38, gy1 - 6); x.closePath(); x.fill();
  x.fillStyle = '#9aa4be'; for (const fx of [gx0 - 3, gx1 - 3]) x.fillRect(fx, gy0, 6, gy1 - gy0);
  x.fillStyle = '#c4cbe0'; x.fillRect(gx0 - 6, gy0 - 6, gx1 - gx0 + 12, 8);
  x.fillStyle = 'rgba(80,220,255,0.65)'; x.fillRect(gx0, gy0 + 2, gx1 - gx0, 2); // LED strip
  // clay stove (cà ràng) on the left end
  const [sx, sy] = CART.stove;
  const kg = x.createLinearGradient(sx - 50, 0, sx + 50, 0); kg.addColorStop(0, '#5a2a18'); kg.addColorStop(0.4, '#a8542e'); kg.addColorStop(1, '#4a2014');
  x.fillStyle = kg; x.beginPath(); x.moveTo(sx - 52, sy - 44); x.lineTo(sx + 52, sy - 44); x.lineTo(sx + 44, sy + 6); x.lineTo(sx - 44, sy + 6); x.closePath(); x.fill();
  x.fillStyle = '#1a0a06'; x.beginPath(); x.roundRect(sx - 20, sy - 22, 40, 22, 8); x.fill();
  // small pan on top (glossy black) with a few glazed eggs
  x.fillStyle = '#16141c'; ell(x, sx, sy - 50, 62, 15); x.fill();
  const pg = x.createRadialGradient(sx - 10, sy - 54, 2, sx, sy - 50, 54); pg.addColorStop(0, '#a8501c'); pg.addColorStop(1, '#5a2410'); x.fillStyle = pg; ell(x, sx, sy - 52, 50, 10); x.fill();
  for (let i = 0; i < 5; i++) { x.fillStyle = '#7a3814'; ell(x, sx - 30 + i * 15, sy - 55 + (i % 2) * 3, 7, 5); x.fill(); x.fillStyle = 'rgba(255,220,170,0.7)'; ell(x, sx - 32 + i * 15, sy - 57 + (i % 2) * 3, 2.4, 1.4); x.fill(); }
  x.strokeStyle = '#2a2a32'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx + 60, sy - 50); x.lineTo(sx + 110, sy - 62); x.stroke();
  // stack of small plates + spoon cup on the right end
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#e8ecf4' : '#cfd6e6'; ell(x, 612, top - 26 - i * 5, 30, 7); x.fill(); }
  x.fillStyle = '#d23c6a'; x.beginPath(); x.roundRect(560, top - 58, 22, 34, 5); x.fill();
  x.strokeStyle = '#c8cfdf'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(566 + i * 5, top - 56); x.lineTo(562 + i * 7, top - 84); x.stroke(); }
  SC.cart = c; return c;
}
// live bits on the cart: stove mouth glow + pan steam
function cartLive(ctx, t) {
  const [sx, sy] = CART.stove, fl = 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 6.3);
  L.glow(ctx, sx, sy - 12, 34, 'rgba(255,140,40,1)', 0.9 * fl);
  L.glow(ctx, sx, sy - 40, 150, 'rgba(255,140,60,0.8)', 0.35 * fl);
  L.steam(ctx, t, 31, sx, sy - 60, 70, 200, 6, 0.25);
}

// ---------------------------------------------------------------- PICTOGRAM NEON SIGN (covers the shared sign, no text)
// plate x 226..618, y 494..666 (world coords, wide view)
function neonSignLayer() {
  if (SC.neon) return SC.neon;
  const c = createCanvas(420, 200), ox = -224, oy = -484; // canvas origin = world (224,484)
  let x = c.getContext('2d'); x.translate(ox, oy);
  // dark plate with a thin steel frame
  const pg = x.createLinearGradient(0, 494, 0, 666); pg.addColorStop(0, '#1c1424'); pg.addColorStop(1, '#0c0812');
  x.fillStyle = '#4a4458'; x.beginPath(); x.roundRect(226, 494, 392, 172, 18); x.fill();
  x.fillStyle = pg; x.beginPath(); x.roundRect(232, 500, 380, 160, 14); x.fill();
  SC.neonPlate = c;
  const c2 = createCanvas(420, 200); x = c2.getContext('2d'); x.translate(ox, oy);
  // tubes: drawn as paths, then glow passes
  const tubes = [
    ['255,70,180', (q) => { q.beginPath(); q.ellipse(318, 580, 40, 52, 0, 0, TAU); }],                                              // egg
    ['255,70,180', (q) => { q.beginPath(); q.moveTo(280, 566); for (let i = 1; i <= 8; i++) q.lineTo(280 + i * 9.5, 566 + (i % 2 ? -11 : 4)); }], // crack
    ['70,225,255', (q) => { q.beginPath(); q.moveTo(386, 586); q.quadraticCurveTo(388, 640, 444, 640); q.quadraticCurveTo(500, 640, 502, 586); q.closePath(); }], // bowl
    ['255,250,250', (q) => { q.beginPath(); for (const bx of [420, 444, 468]) { q.moveTo(bx, 572); q.bezierCurveTo(bx - 10, 556, bx + 10, 546, bx, 530); } }], // steam
    ['255,175,70', (q) => { q.beginPath(); q.moveTo(526, 618); q.bezierCurveTo(540, 560, 572, 540, 590, 528); }],                   // tamarind pod
    ['110,230,90', (q) => { q.beginPath(); q.moveTo(584, 548); q.quadraticCurveTo(604, 556, 600, 580); q.quadraticCurveTo(584, 570, 584, 548); }], // leaf
  ];
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.globalCompositeOperation = 'lighter';
  for (const [col, path] of tubes) {
    for (const [lw, a] of [[22, 0.07], [13, 0.14], [7, 0.4]]) { x.strokeStyle = `rgba(${col},${a})`; x.lineWidth = lw; path(x); x.stroke(); }
    x.strokeStyle = 'rgba(255,245,250,0.9)'; x.lineWidth = 2.6; path(x); x.stroke();
  }
  // pod bumps
  for (let i = 0; i < 3; i++) { const u = 0.25 + i * 0.25, px = lerp(530, 586, u), py = lerp(606, 532, u); x.fillStyle = 'rgba(255,175,70,0.35)'; ell(x, px, py, 9, 9); x.fill(); }
  x.globalCompositeOperation = 'source-over';
  SC.neon = c2; return c2;
}
function neonSign(ctx, t, k = 1) {
  const fl = (Math.sin(t * 53) > 0.96 ? 0.6 : 1) * (0.92 + 0.08 * Math.sin(t * 9));
  const tubes = neonSignLayer(); ctx.drawImage(SC.neonPlate, 224, 484);
  ctx.save(); ctx.globalAlpha = k * fl; ctx.drawImage(tubes, 224, 484); ctx.restore();
  L.glow(ctx, 330, 590, 300, 'rgba(255,70,180,0.8)', 0.35 * k * fl);
  L.glow(ctx, 470, 600, 220, 'rgba(70,220,255,0.7)', 0.22 * k * fl);
}

// ---------------------------------------------------------------- CRACKED BALUT, cute chick peeking out (macro)
// origin = egg centre, ~150 x 190 at s = 1; top cut off at y -40 (jagged rim). o.t (breathing), o.blink
function eggPath(x, rx, ry) { // full egg outline (pointy top)
  x.beginPath(); x.moveTo(0, -ry);
  x.bezierCurveTo(rx * 0.62, -ry, rx, -ry * 0.25, rx, ry * 0.22);
  x.bezierCurveTo(rx, ry * 0.75, rx * 0.55, ry, 0, ry);
  x.bezierCurveTo(-rx * 0.55, ry, -rx, ry * 0.75, -rx, ry * 0.22);
  x.bezierCurveTo(-rx, -ry * 0.25, -rx * 0.62, -ry, 0, -ry); x.closePath();
}
function shellFill(x) { const g = x.createRadialGradient(-30, -10, 6, 0, 10, 110); g.addColorStop(0, '#f6ead0'); g.addColorStop(0.45, '#d9c7a0'); g.addColorStop(1, '#8a6a45'); return g; }
function balut(ctx, x0, y0, s, o = {}) {
  const t = o.t || 0, RX = 75, RY = 96, RIM = -40, rimRX = 66, rimRY = 16;
  ctx.save(); ctx.translate(x0, y0); if (o.rot) ctx.rotate(o.rot); ctx.scale(s, s);
  // speckles helper
  const speck = (x) => { const r = rng(44); x.fillStyle = 'rgba(110,80,50,0.45)'; for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()); ell(x, Math.cos(a) * d * 60, 10 + Math.sin(a) * d * 70, 2 + r() * 4, 1.6 + r() * 3); x.fill(); } };
  // 1. shell below the rim (back + body)
  ctx.save(); ctx.beginPath(); ctx.rect(-200, RIM - 2, 400, 400); ctx.clip();
  eggPath(ctx, RX, RY); ctx.fillStyle = shellFill(ctx); ctx.fill(); speck(ctx);
  ctx.restore();
  // 2. opening: inner membrane wall + golden broth
  const ig = ctx.createLinearGradient(0, RIM - rimRY, 0, RIM + rimRY); ig.addColorStop(0, '#fff6e6'); ig.addColorStop(1, '#d9c3a0');
  ctx.fillStyle = ig; ell(ctx, 0, RIM, rimRX, rimRY); ctx.fill();
  const yg = ctx.createRadialGradient(-14, RIM + 2, 2, 0, RIM + 4, 56); yg.addColorStop(0, '#ffd77a'); yg.addColorStop(0.7, '#e2a23c'); yg.addColorStop(1, '#a8661e');
  ctx.fillStyle = yg; ell(ctx, 0, RIM + 4, rimRX - 9, rimRY - 5); ctx.fill();
  // 3. the chick head peeking up (bobbing a little)
  const bob = Math.sin(t * 5) * 1.5, hx = 2, hy = RIM - 30 + bob, HR = 34;
  ctx.save(); ctx.beginPath(); ctx.rect(-200, -300, 400, 300 + RIM + 3); ctx.ellipse(0, RIM, rimRX - 3, rimRY - 2, 0, 0, PI); ctx.clip('evenodd');
  ctx.restore();
  ctx.save();
  // clip: everything above the front rim curve
  ctx.beginPath(); ctx.moveTo(-200, -300); ctx.lineTo(200, -300); ctx.lineTo(200, RIM); ctx.lineTo(rimRX - 4, RIM);
  ctx.ellipse(0, RIM, rimRX - 4, rimRY - 3, 0, 0, PI); ctx.lineTo(-200, RIM); ctx.closePath(); ctx.clip();
  // tiny wing nub
  const wg = ctx.createRadialGradient(hx + 30, hy + 26, 2, hx + 30, hy + 26, 24); wg.addColorStop(0, '#f6c4ae'); wg.addColorStop(1, '#c98068');
  ctx.fillStyle = wg; ell(ctx, hx + 30, hy + 28, 18, 12, -0.5); ctx.fill();
  const hg = ctx.createRadialGradient(hx - 12, hy - 14, 4, hx, hy, HR + 4); hg.addColorStop(0, '#ffe2d2'); hg.addColorStop(0.55, '#f2b39c'); hg.addColorStop(1, '#c97a64');
  ctx.fillStyle = hg; ell(ctx, hx, hy, HR, HR * 0.94); ctx.fill();
  // damp fluff tufts on top
  ctx.strokeStyle = '#d8a86a'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  for (const [a, l] of [[-0.5, 14], [0, 18], [0.45, 13]]) { ctx.beginPath(); ctx.moveTo(hx + Math.sin(a) * HR * 0.8, hy - HR * 0.86); ctx.quadraticCurveTo(hx + Math.sin(a) * HR + 6, hy - HR - l * 0.8, hx + Math.sin(a) * HR - 2 + a * 10, hy - HR - l); ctx.stroke(); }
  // big glossy eye (or sleepy closed)
  const ex = hx - 8, ey = hy - 4;
  if (o.blink) { ctx.strokeStyle = '#3a1e22'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(ex - 11, ey); ctx.quadraticCurveTo(ex, ey + 8, ex + 11, ey); ctx.stroke(); }
  else {
    const eg = ctx.createRadialGradient(ex - 3, ey - 3, 1, ex, ey, 13); eg.addColorStop(0, '#4a3058'); eg.addColorStop(1, '#170c1c');
    ctx.fillStyle = eg; ell(ctx, ex, ey, 11.5, 13); ctx.fill();
    ctx.fillStyle = '#fff'; ell(ctx, ex - 4, ey - 5, 4.2, 4.2); ctx.fill(); ell(ctx, ex + 4, ey + 4, 1.8, 1.8); ctx.fill();
  }
  // beak + blush
  ctx.fillStyle = '#f0a23c'; ctx.beginPath(); ctx.moveTo(hx - 28, hy - 2); ctx.quadraticCurveTo(hx - 48, hy + 4, hx - 31, hy + 11); ctx.quadraticCurveTo(hx - 25, hy + 6, hx - 28, hy - 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.35)'; ell(ctx, hx + 6, hy + 12, 9, 5); ctx.fill();
  // wet sheen
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, hx - 10, hy - 22, 9, 4, -0.4); ctx.fill();
  ctx.restore();
  // 4. front lip of the jagged rim
  ctx.save();
  ctx.beginPath(); const n = 16;
  for (let i = 0; i <= n; i++) { const a = PI * (i / n), rr = i % 2 ? 1 : 1.06, px = Math.cos(a) * rimRX * rr, py = RIM + Math.sin(a) * rimRY * rr - (i % 2 ? 0 : 6); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.lineTo(-rimRX, RIM + 14); ctx.ellipse(0, RIM + 2, rimRX, rimRY + 12, 0, PI, 0, true); ctx.closePath();
  ctx.fillStyle = shellFill(ctx); ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,236,0.95)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i <= n; i++) { const a = PI * (i / n), rr = i % 2 ? 1 : 1.06, px = Math.cos(a) * rimRX * rr, py = RIM + Math.sin(a) * rimRY * rr - (i % 2 ? 0 : 6); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  // back rim edge (thin)
  ctx.strokeStyle = 'rgba(255,250,236,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, RIM, rimRX, rimRY, 0, PI, TAU); ctx.stroke();
  ctx.restore();
  // hairline cracks + shell sheen + warm rim light
  ctx.strokeStyle = 'rgba(110,80,50,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, RIM + 14); ctx.lineTo(-30, -6); ctx.lineTo(-38, 12); ctx.moveTo(30, RIM + 16); ctx.lineTo(40, -10); ctx.lineTo(34, 4); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(ctx, -42, 6, 10, 26, 0.2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,90,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 12, 66, 0.05, 1.0); ctx.stroke();
  if (o.cup) eggCup(ctx);
  ctx.restore();
}

// little footed porcelain egg cup (the way hột vịt lộn is served): rim at y 34, foot at y 150 (egg-local units)
function eggCup(ctx) {
  const g = ctx.createLinearGradient(-70, 0, 70, 0); g.addColorStop(0, '#9aa6c4'); g.addColorStop(0.3, '#f4f6fb'); g.addColorStop(0.7, '#dfe4f0'); g.addColorStop(1, '#7c86a6');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-68, 34); ctx.bezierCurveTo(-66, 92, -34, 112, -16, 116); ctx.lineTo(-14, 136); ctx.bezierCurveTo(-40, 140, -52, 146, -52, 152);
  ctx.bezierCurveTo(-30, 162, 30, 162, 52, 152); ctx.bezierCurveTo(52, 146, 40, 140, 14, 136); ctx.lineTo(16, 116); ctx.bezierCurveTo(34, 112, 66, 92, 68, 34);
  ctx.ellipse(0, 34, 68, 12, 0, 0, PI); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a6ad0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 36, 67, 12, 0, 0.1, PI - 0.1); ctx.stroke(); // blue rim band
  ctx.strokeStyle = 'rgba(58,106,208,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 64, 60, 10, 0, 0.3, PI - 0.3); ctx.stroke();
  ctx.fillStyle = 'rgba(58,106,208,0.75)'; for (const fx of [-34, 0, 34]) { ell(ctx, fx, 82 + Math.abs(fx) * -0.25, 5, 7); ctx.fill(); } // tiny blue petals
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ell(ctx, -42, 66, 6, 22, 0.25); ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,190,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 50, 64, 0.2, 1.0); ctx.stroke();
}

// ---------------------------------------------------------------- SOFT DIZZY STARS (no outline, glow)
function starPath(ctx, x, y, r, rot) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * PI / 5 - PI / 2, rr = i % 2 ? r * 0.46 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
function softStars(ctx, t, x, y, s = 1, k = 1, o = {}) {
  if (k <= 0) return;
  const n = o.n || 5, R = (o.r || 70) * s, ry = R * 0.32;
  const items = [];
  for (let i = 0; i < n; i++) { const a = t * 4.2 + i / n * TAU; items.push([Math.sin(a), Math.cos(a), i]); }
  items.sort((p, q) => p[0] - q[0]);
  ctx.save();
  for (const [sn, cs, i] of items) {
    const px = x + cs * R, py = y + sn * ry, d = 0.65 + 0.35 * (sn + 1) / 2, r = 13 * s * d * Math.min(1, k * 1.4);
    ctx.globalAlpha = Math.min(1, k) * d;
    L.glow(ctx, px, py, r * 3, 'rgba(255,220,120,0.9)', 0.5 * d);
    const g = ctx.createRadialGradient(px - r * 0.2, py - r * 0.25, 0, px, py, r); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, '#ffe36a'); g.addColorStop(1, '#ffb347');
    ctx.fillStyle = g; starPath(ctx, px, py, r, t * 3 + i); ctx.fill();
    // trailing sparkle
    const ta = t * 4.2 + i / n * TAU - 0.35; ctx.fillStyle = 'rgba(255,240,190,0.6)'; ell(ctx, x + Math.cos(ta) * R, y + Math.sin(ta) * ry, 2.5 * s, 2.5 * s); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- blurred foreground (red stool + egg basket), screen space, cached
function fgAlley() {
  if (SC.fg) return SC.fg;
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.filter = 'blur(16px)';
  // red stool, bottom-left
  const sg = x.createLinearGradient(30, 0, 330, 0); sg.addColorStop(0, '#5a0c12'); sg.addColorStop(0.45, '#b8202c'); sg.addColorStop(1, '#4a080e');
  x.fillStyle = sg; x.beginPath(); x.moveTo(40, 1600); x.lineTo(320, 1600); x.lineTo(350, 1960); x.lineTo(10, 1960); x.closePath(); x.fill();
  x.fillStyle = '#d0303e'; ell(x, 180, 1600, 146, 34); x.fill(); x.fillStyle = '#7a1018'; ell(x, 180, 1602, 116, 24); x.fill();
  // bamboo basket with eggs, bottom-right
  const bg = x.createLinearGradient(0, 1700, 0, 1920); bg.addColorStop(0, '#b58248'); bg.addColorStop(1, '#5a3a18');
  x.fillStyle = bg; x.beginPath(); x.moveTo(760, 1720); x.lineTo(1120, 1720); x.lineTo(1100, 1960); x.lineTo(780, 1960); x.closePath(); x.fill();
  const r = rng(12); for (let i = 0; i < 14; i++) { x.fillStyle = r() < 0.5 ? '#efe0bc' : '#d6bf92'; ell(x, 790 + r() * 300, 1712 - r() * 40, 30, 36); x.fill(); }
  x.filter = 'none';
  SC.fg = c; return c;
}

module.exports = { stoveTop, burner, kettle, ripple, cartLayer, cartLive, CART, neonSign, balut, softStars, fgAlley };
