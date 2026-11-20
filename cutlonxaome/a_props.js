// a_props.js — writer A props for "Cút lộn xào me" s1..s5 (wok, layered flames, steamer pot, bowls, hands, spoon,
// tamarind, sieve, bottles, spatula, backgrounds). Deterministic, static layers cached at module level.
//   fire(ctx,x,y,w,h,t,k,{seed,wind,blue,alpha})   soft layered flame bed, base line centred at (x,y), w wide, h tall
//   wokBack / wokFront(ctx,x,y,R,k,{rot,fire,handle})  rim centre (x,y), rim radius R, ellipse ratio k. contents go between.
//   pot(ctx,x,y,R,k,{inside(ctx)}) / potLid(ctx,x,y,R,k,rot)   aluminium steamer pot (rim centre)
//   bowlBack / bowlFront(ctx,x,y,R,k,{inside})   white/blue Saigon bowl (rim centre)
//   arm(ctx,ex,ey,wx,wy,s,{sleeve}) -> angle ; hand(ctx,x,y,s,rot,{pose:'hold'|'grip'|'open'|'claw'|'pinch',pass:'back'|'front'|'all',mirror})
//   spoon, spatula, bottle, sieve, tamarindLumps, nightBG(seed), steelCounter(), boardTop()
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const PI = Math.PI;
const ell = (c, x, y, rx, ry, r = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), r, 0, TAU); };
const SK = ['#f6cfa6', '#e2a87c', '#b87249'];
const SLV = ['#dccaf2', '#b99be0', '#7f5fae'], CUFF = '#ece0fa';

function sprite(w, h, blur, draw) { const c = createCanvas(w, h), x = c.getContext('2d'); if (blur) x.filter = `blur(${blur}px)`; draw(x, w, h); return c; }

// ============================================================== FLAMES
const FLS = (() => {
  const mk = (stops, blur, fat = 1) => sprite(160, 320, blur, (x) => {
    const cx = 80, b = 296, top = 22, hw = 50 * fat;
    x.beginPath(); x.moveTo(cx - hw, b - 30);
    x.bezierCurveTo(cx - hw * 1.25, b - 120, cx - hw * 0.55, b - 170, cx - hw * 0.1, top + 40);
    x.quadraticCurveTo(cx, top - 4, cx + hw * 0.12, top + 30);
    x.bezierCurveTo(cx + hw * 0.6, b - 170, cx + hw * 1.25, b - 120, cx + hw, b - 30);
    x.bezierCurveTo(cx + hw * 0.9, b + 14, cx - hw * 0.9, b + 14, cx - hw, b - 30); x.closePath();
    const g = x.createLinearGradient(0, b + 12, 0, top); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fill();
  });
  return [
    mk([[0, 'rgba(255,110,30,0.1)'], [0.1, 'rgba(255,100,24,0.9)'], [0.55, 'rgba(225,50,8,0.55)'], [1, 'rgba(140,16,0,0)']], 12, 1.1),
    mk([[0, 'rgba(255,200,80,0.3)'], [0.12, 'rgba(255,184,60,0.95)'], [0.6, 'rgba(255,120,20,0.55)'], [1, 'rgba(255,70,0,0)']], 8),
    mk([[0, 'rgba(255,255,240,0.6)'], [0.14, 'rgba(255,252,222,1)'], [0.55, 'rgba(255,214,110,0.75)'], [1, 'rgba(255,170,40,0)']], 4, 0.8),
    mk([[0, 'rgba(120,170,255,0)'], [0.15, 'rgba(110,160,255,0.95)'], [0.6, 'rgba(70,110,255,0.45)'], [1, 'rgba(40,80,255,0)']], 3, 0.8),
  ];
})();
function fire(ctx, x, y, w, h, t, k = 1, o = {}) {
  if (k <= 0.01) return;
  const r = rng(o.seed || 5), A = o.alpha == null ? 1 : o.alpha;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = Math.max(w, h) * 0.75, gy = y - h * 0.3;
  const g = ctx.createRadialGradient(x, gy, 0, x, gy, gr); g.addColorStop(0, `rgba(255,120,30,${0.32 * Math.min(1.4, k) * A})`); g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - gr, gy - gr, gr * 2, gr * 2);
  const L0 = [[0, o.n0 || 9, 0.75, 1.0, 0.34, 0.8], [1, o.n1 || 8, 0.5, 0.82, 0.25, 0.9], [2, o.n2 || 6, 0.28, 0.55, 0.15, 0.95]];
  if (o.blue) L0.unshift([3, 10, 0.08, 0.16, 0.1, 0.9]);
  for (const [li, n, h0, h1, wf, al] of L0) for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n - 0.5 + (r() - 0.5) * 0.08, ph = r() * TAU, f = 6 + r() * 7, hr = r(), wr = r();
    const spread = li === 2 ? 0.55 : li === 1 ? 0.8 : li === 3 ? 0.95 : 1;
    const fl = 1 + 0.2 * Math.sin(t * f + ph) + 0.12 * Math.sin(t * f * 2.7 + ph * 1.3);
    const edge = 1 - Math.abs(u) * (o.flat ? 0.4 : 1.1);
    const hh = h * lerp(h0, h1, hr) * fl * Math.min(2, k) * (0.5 + 0.5 * edge);
    const ww = w * wf * (0.8 + wr * 0.4) * (0.75 + 0.25 * Math.min(1.5, k));
    const sk = Math.sin(t * 2.3 + ph) * 0.16 + Math.sin(t * 5.3 + ph * 2) * 0.07 + (o.wind || 0) + u * 0.5;
    ctx.save(); ctx.translate(x + u * w * spread, y); ctx.transform(1, 0, -sk, 1, 0, 0);
    ctx.globalAlpha = Math.min(1, al * A); ctx.drawImage(FLS[li], -ww / 2, -hh * 0.925, ww, hh); ctx.restore();
  }
  ctx.restore();
}
// warm firelight wash (screen) — cheap radial
function warmLight(ctx, x, y, r, a, col = '255,150,60', mode = 'screen') {
  if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = mode;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

// ============================================================== WOK
function wokBack(ctx, x, y, R, k, o = {}) {
  const fl = o.fire == null ? 1 : o.fire;
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
  // far ear behind rim
  ctx.fillStyle = '#1a1a1e'; ell(ctx, -R * 1.0, -R * k * 0.15, R * 0.07, R * 0.045); ctx.fill();
  ell(ctx, 0, 0, R, R * k);
  const g = ctx.createRadialGradient(-R * 0.15, R * k * 0.15, R * 0.04, 0, 0, R * 1.02);
  g.addColorStop(0, '#2d2622'); g.addColorStop(0.45, '#18151a'); g.addColorStop(0.85, '#2a2830'); g.addColorStop(1, '#4a4650');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, R, R * k); ctx.clip();
  // patina rings
  ctx.strokeStyle = 'rgba(120,90,70,0.12)'; ctx.lineWidth = R * 0.012;
  for (let i = 1; i < 6; i++) { ell(ctx, 0, R * k * 0.08 * (i / 6), R * i / 6.5, R * k * i / 6.5); ctx.stroke(); }
  // back inner wall catches firelight
  ctx.globalCompositeOperation = 'screen';
  const g2 = ctx.createRadialGradient(0, -R * k * 0.95, 0, 0, -R * k * 0.95, R * 0.95); g2.addColorStop(0, `rgba(255,140,50,${0.55 * fl})`); g2.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g2; ctx.fillRect(-R, -R, R * 2, R * 2);
  // cool neon reflection on the front inner wall
  const g3 = ctx.createRadialGradient(-R * 0.45, R * k * 0.85, 0, -R * 0.45, R * k * 0.85, R * 0.6); g3.addColorStop(0, 'rgba(90,150,255,0.22)'); g3.addColorStop(1, 'rgba(90,150,255,0)');
  ctx.fillStyle = g3; ctx.fillRect(-R, -R, R * 2, R * 2);
  // spec streak
  ctx.strokeStyle = 'rgba(255,220,190,0.18)'; ctx.lineWidth = R * 0.025; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.9, R * k * 0.88, 0, PI * 1.12, PI * 1.42); ctx.stroke();
  ctx.restore();
  // rim (back half)
  ctx.lineWidth = R * 0.022; ctx.strokeStyle = '#6a6670'; ctx.beginPath(); ctx.ellipse(0, 0, R, R * k, 0, PI, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(255,190,120,${0.5 * fl})`; ctx.lineWidth = R * 0.008; ctx.beginPath(); ctx.ellipse(0, -R * 0.004, R, R * k, 0, PI * 1.15, PI * 1.85); ctx.stroke();
  ctx.restore();
}
function wokFront(ctx, x, y, R, k, o = {}) {
  const fl = o.fire == null ? 1 : o.fire, D = R * (o.depth || 0.42) * (1 - k * 0.45);
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot);
  // long handle (to +x), drawn first so the belly overlaps its root
  if (o.handle !== false) {
    const ha = o.handleAng == null ? 0.18 : o.handleAng, hl = R * 0.95;
    ctx.save(); ctx.translate(R * 0.94, R * k * 0.1); ctx.rotate(ha);
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.moveTo(-10, -R * 0.03); ctx.lineTo(hl * 0.42, -R * 0.022); ctx.lineTo(hl * 0.42, R * 0.022); ctx.lineTo(-10, R * 0.035); ctx.fill();
    const wg = ctx.createLinearGradient(0, -R * 0.05, 0, R * 0.05); wg.addColorStop(0, '#a06a3a'); wg.addColorStop(0.5, '#6e3f1e'); wg.addColorStop(1, '#3a1e0e');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.roundRect(hl * 0.4, -R * 0.042, hl * 0.62, R * 0.084, R * 0.04); ctx.fill();
    ctx.fillStyle = `rgba(255,170,90,${0.35 * fl})`; ctx.beginPath(); ctx.roundRect(hl * 0.42, -R * 0.038, hl * 0.58, R * 0.018, R * 0.01); ctx.fill();
    ctx.restore();
  }
  // belly
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * k, 0, 0, PI, false);
  ctx.bezierCurveTo(-R * 0.96, R * k * 0.4 + D * 0.7, -R * 0.55, R * k + D, 0, R * k + D);
  ctx.bezierCurveTo(R * 0.55, R * k + D, R * 0.96, R * k * 0.4 + D * 0.7, R, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, R * k + D);
  g.addColorStop(0, '#34323a'); g.addColorStop(0.55, '#18171c'); g.addColorStop(0.8, '#221c1c'); g.addColorStop(1, `rgb(${Math.round(lerp(40, 128, fl))},${Math.round(lerp(30, 52, fl))},${Math.round(lerp(28, 24, fl))})`);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  const g2 = ctx.createLinearGradient(-R, 0, R, 0); g2.addColorStop(0, 'rgba(110,140,230,0.35)'); g2.addColorStop(0.18, 'rgba(110,140,230,0)'); g2.addColorStop(0.75, 'rgba(255,150,70,0)'); g2.addColorStop(1, `rgba(255,150,70,${0.45 * fl})`);
  ctx.fillStyle = g2; ctx.fillRect(-R, 0, R * 2, R * k + D);
  ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(200,210,255,0.16)'; ctx.lineWidth = R * 0.03;
  ctx.beginPath(); ctx.ellipse(-R * 0.1, R * 0.02, R * 0.86, R * k + D * 0.75, 0, PI * 0.62, PI * 0.86); ctx.stroke();
  ctx.restore();
  // near ear
  ctx.fillStyle = '#222228'; ctx.beginPath(); ctx.ellipse(-R * 1.03, R * k * 0.12, R * 0.075, R * 0.05, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(160,170,210,0.4)'; ctx.beginPath(); ctx.ellipse(-R * 1.04, R * k * 0.08, R * 0.04, R * 0.015, 0, 0, TAU); ctx.fill();
  // front lip
  ctx.lineWidth = R * 0.024; ctx.strokeStyle = '#5c5a64'; ctx.beginPath(); ctx.ellipse(0, 0, R, R * k, 0, 0, PI); ctx.stroke();
  ctx.lineWidth = R * 0.009; ctx.strokeStyle = 'rgba(230,230,250,0.75)'; ctx.beginPath(); ctx.ellipse(0, -R * 0.006, R, R * k, 0, PI * 0.55, PI * 0.9); ctx.stroke();
  ctx.strokeStyle = `rgba(255,200,140,${0.7 * fl})`; ctx.beginPath(); ctx.ellipse(0, -R * 0.006, R, R * k, 0, PI * 0.06, PI * 0.3); ctx.stroke();
  ctx.restore();
  return { bottom: y + R * k + D };
}
// glossy tamarind sauce pool in the wok (call between wokBack/wokFront)
function saucePool(ctx, x, y, rx, ry, t, a = 1, o = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  ell(ctx, x, y, rx, ry);
  const g = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.3, rx * 0.05, x, y, rx);
  g.addColorStop(0, o.light || '#b4581e'); g.addColorStop(0.5, o.mid || '#7a3412'); g.addColorStop(1, 'rgba(58,20,6,0.0)');
  ctx.fillStyle = g; ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  const r = rng(o.seed || 9);
  for (let i = 0; i < (o.n || 7); i++) {
    const a0 = r() * TAU, d = Math.sqrt(r()) * 0.75, px = x + Math.cos(a0) * rx * d, py = y + Math.sin(a0) * ry * d;
    ctx.globalAlpha = a * (0.25 + 0.25 * Math.sin(t * 3 + i * 1.7));
    ell(ctx, px, py, rx * (0.05 + r() * 0.06), ry * 0.04, 0.1); ctx.fillStyle = 'rgba(255,235,210,0.9)'; ctx.fill();
  }
  ctx.restore();
}

// ============================================================== STEAMER POT (aluminium)
function potBody(ctx, x, y, R, k, o = {}) {
  const h = R * (o.h || 0.95);
  ctx.save(); ctx.translate(x, y);
  // shadow
  const sg = ctx.createRadialGradient(0, h + R * k * 0.4, 0, 0, h + R * k * 0.4, R * 1.4); sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.scale(1, 0.3); ctx.fillStyle = sg; ctx.fillRect(-R * 1.5, (h + R * k * 0.4) / 0.3 - R * 1.4, R * 3, R * 2.8); ctx.restore();
  ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(-R, h); ctx.ellipse(0, h, R, R * k, 0, PI, 0, true); ctx.lineTo(R, 0); ctx.closePath();
  const g = ctx.createLinearGradient(-R, 0, R, 0);
  g.addColorStop(0, '#5e6a86'); g.addColorStop(0.15, '#aab4c8'); g.addColorStop(0.32, '#e6eaf0'); g.addColorStop(0.5, '#8d96aa'); g.addColorStop(0.8, '#c88a5a'); g.addColorStop(1, '#6a4a3a');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(20,24,40,0.18)'; ctx.fillRect(-R, h * 0.18, R * 2, R * 0.03);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-R, h * 0.18 + R * 0.03, R * 2, R * 0.012);
  // handles
  for (const sx of [-1, 1]) { ctx.fillStyle = '#2c2c34'; ctx.beginPath(); ctx.roundRect(sx * R - (sx > 0 ? 0 : R * 0.2), h * 0.1, R * 0.2, R * 0.09, R * 0.04); ctx.fill(); }
  // rim + inside
  ell(ctx, 0, 0, R, R * k); ctx.fillStyle = '#d6dae2'; ctx.fill();
  ell(ctx, 0, R * 0.01, R * 0.95, R * k * 0.93);
  const gi = ctx.createLinearGradient(0, -R * k, 0, R * k); gi.addColorStop(0, '#3a3e4c'); gi.addColorStop(1, '#7b8296'); ctx.fillStyle = gi; ctx.fill();
  if (o.inside) { ctx.save(); ell(ctx, 0, R * 0.01, R * 0.95, R * k * 0.93); ctx.clip(); o.inside(ctx); ctx.restore(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = R * 0.012; ctx.beginPath(); ctx.ellipse(0, 0, R, R * k, 0, PI * 0.15, PI * 0.6); ctx.stroke();
  ctx.restore();
}
function potLid(ctx, x, y, R, k, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.moveTo(-R * 1.02, 0); ctx.bezierCurveTo(-R, -R * 0.42, R, -R * 0.42, R * 1.02, 0); ctx.ellipse(0, 0, R * 1.02, R * k * 1.02, 0, 0, PI, false); ctx.closePath();
  const g = ctx.createLinearGradient(-R, 0, R, 0); g.addColorStop(0, '#7a849c'); g.addColorStop(0.3, '#eef1f6'); g.addColorStop(0.55, '#a3abbd'); g.addColorStop(1, '#c48a60');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = R * 0.02; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.0, R * k, 0, PI * 0.1, PI * 0.9); ctx.stroke();
  // knob
  ctx.fillStyle = '#26262e'; ctx.beginPath(); ctx.roundRect(-R * 0.14, -R * 0.42, R * 0.28, R * 0.12, R * 0.05); ctx.fill();
  ctx.fillStyle = 'rgba(160,170,210,0.4)'; ctx.fillRect(-R * 0.1, -R * 0.41, R * 0.2, R * 0.02);
  ctx.restore();
}

// ============================================================== BOWL (white porcelain, blue band)
function bowlBack(ctx, x, y, R, k, o = {}) {
  ctx.save(); ctx.translate(x, y);
  const D = R * (o.depth || 0.62);
  // contact shadow
  const sy = R * k + D;
  const sg = ctx.createRadialGradient(0, sy, 0, 0, sy, R * 1.1); sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.translate(0, sy); ctx.scale(1, 0.28); ctx.fillStyle = sg; ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4); ctx.restore();
  ell(ctx, 0, 0, R, R * k); ctx.fillStyle = '#f3f1ec'; ctx.fill();
  ell(ctx, 0, R * 0.02, R * 0.93, R * k * 0.9);
  const g = ctx.createRadialGradient(R * 0.2, R * k * 0.3, R * 0.05, 0, 0, R);
  g.addColorStop(0, '#fbfaf6'); g.addColorStop(0.7, '#d9d6cf'); g.addColorStop(1, '#a9a69f'); ctx.fillStyle = g; ctx.fill();
  if (o.inside) { ctx.save(); ell(ctx, 0, R * 0.02, R * 0.93, R * k * 0.9); ctx.clip(); o.inside(ctx); ctx.restore(); }
  ctx.restore();
}
function bowlFront(ctx, x, y, R, k, o = {}) {
  ctx.save(); ctx.translate(x, y);
  const D = R * (o.depth || 0.62);
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * k, 0, 0, PI, false);
  ctx.bezierCurveTo(-R * 0.98, R * k + D * 0.6, -R * 0.5, R * k + D, 0, R * k + D);
  ctx.bezierCurveTo(R * 0.5, R * k + D, R * 0.98, R * k + D * 0.6, R, 0); ctx.closePath();
  const g = ctx.createLinearGradient(-R, 0, R, 0);
  g.addColorStop(0, '#9a98a8'); g.addColorStop(0.28, '#ffffff'); g.addColorStop(0.62, '#e2ddd6'); g.addColorStop(1, o.warm ? '#d9a27a' : '#8e8a90');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = '#2f5fae'; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.ellipse(0, R * 0.12, R * 1.0, R * k, 0, PI * 0.02, PI * 0.98); ctx.stroke();
  ctx.lineWidth = R * 0.016; ctx.beginPath(); ctx.ellipse(0, R * 0.24, R * 0.98, R * k, 0, PI * 0.04, PI * 0.96); ctx.stroke();
  // little blue flowers on the band
  ctx.fillStyle = 'rgba(47,95,174,0.85)';
  for (let i = 0; i < 7; i++) { const a = PI * (0.12 + i * 0.127), px = Math.cos(a) * R * 0.93, py = Math.sin(a) * R * k + R * 0.36 + Math.sin(a) * D * 0.15; ell(ctx, px, py, R * 0.03 * Math.sin(a), R * 0.03); ctx.fill(); }
  const sh = ctx.createLinearGradient(0, 0, 0, R * k + D); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(10,20,50,0.35)'); ctx.fillStyle = sh; ctx.fillRect(-R, 0, R * 2, R * k + D);
  ctx.restore();
  ctx.lineWidth = R * 0.03; ctx.strokeStyle = '#2f5fae'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.985, R * k * 0.985, 0, 0, TAU); ctx.stroke();
  ctx.lineWidth = R * 0.012; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(0, -R * 0.004, R, R * k, 0, PI * 0.58, PI * 0.88); ctx.stroke();
  ctx.restore();
}

// ============================================================== ARMS + HANDS
// forearm from (ex,ey) (offscreen elbow) to wrist (wx,wy); lilac sleeve rolled to ~mid forearm. returns angle.
function arm(ctx, ex, ey, wx, wy, s = 1, o = {}) {
  const a = Math.atan2(wy - ey, wx - ex), len = Math.hypot(wx - ex, wy - ey);
  const w0 = 54 * s, w1 = 36 * s, sl = len * (o.sleeve == null ? 0.5 : o.sleeve);
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
  // skin tube
  ctx.beginPath(); ctx.moveTo(0, -w0 * 0.5); ctx.bezierCurveTo(len * 0.5, -w0 * 0.55, len * 0.8, -w1 * 0.55, len + 4 * s, -w1 * 0.5);
  ctx.lineTo(len + 4 * s, w1 * 0.5); ctx.bezierCurveTo(len * 0.8, w1 * 0.6, len * 0.5, w0 * 0.6, 0, w0 * 0.5); ctx.closePath();
  const g = ctx.createLinearGradient(0, -w0 * 0.5, 0, w0 * 0.5); g.addColorStop(0, SK[0]); g.addColorStop(0.45, SK[1]); g.addColorStop(1, SK[2]);
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,190,120,0.35)'; ctx.beginPath(); ctx.ellipse(len * 0.7, -w1 * 0.3, len * 0.25, w1 * 0.08, 0, 0, TAU); ctx.fill();
  if (sl > 0) {
    const ws = lerp(w0, w1, sl / len) * 1.35;
    ctx.beginPath(); ctx.moveTo(-10, -w0 * 0.75); ctx.lineTo(sl, -ws * 0.55); ctx.quadraticCurveTo(sl + 10 * s, 0, sl, ws * 0.55); ctx.lineTo(-10, w0 * 0.75); ctx.closePath();
    const sg = ctx.createLinearGradient(0, -w0 * 0.75, 0, w0 * 0.75); sg.addColorStop(0, SLV[0]); sg.addColorStop(0.5, SLV[1]); sg.addColorStop(1, SLV[2]);
    ctx.fillStyle = sg; ctx.fill();
    // tiny white flowers
    const r = rng(77); ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < Math.min(30, sl / (14 * s)); i++) { const px = r() * (sl - 20 * s), py = (r() - 0.5) * w0 * 1.1; ell(ctx, px, py, 3.2 * s, 3.2 * s); ctx.fill(); }
    // rolled cuff
    ctx.fillStyle = CUFF; ctx.beginPath(); ctx.roundRect(sl - 16 * s, -ws * 0.58, 22 * s, ws * 1.16, 9 * s); ctx.fill();
    ctx.fillStyle = 'rgba(120,90,170,0.35)'; ctx.fillRect(sl - 16 * s, ws * 0.2, 22 * s, ws * 0.36);
  }
  ctx.restore();
  return a;
}
// finger: polyline from base with joints; drawn as round-capped strokes
function finger(ctx, pts, w, grad) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = 'rgba(120,58,30,0.42)'; ctx.lineWidth = w + 3; ctx.stroke();
  ctx.strokeStyle = grad; ctx.lineWidth = w; ctx.stroke();
  const [tx, ty] = pts[pts.length - 1], [px, py] = pts[pts.length - 2], a = Math.atan2(ty - py, tx - px);
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
  ctx.fillStyle = 'rgba(255,225,205,0.75)'; ell(ctx, -w * 0.05, -w * 0.12, w * 0.32, w * 0.24); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,214,170,0.45)'; ctx.lineWidth = w * 0.18; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] - w * 0.3); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1] - w * 0.3); ctx.stroke();
}
function chain(x, y, a0, segs) { const p = [[x, y]]; let a = a0; for (const [l, da] of segs) { a += da; x += Math.cos(a) * l; y += Math.sin(a) * l; p.push([x, y]); } return p; }
// hand: wrist at (x,y), pointing along rot. pose: 'hold' (cup something at ~(95,8)), 'grip' (fist round a handle along y at (70,0)),
// 'open' (relaxed, fingers forward), 'claw' (top-down squeezing), 'pinch' (thumb+index tips meet at (112,-6)).
// pass: 'back' = palm/back fingers+thumb, 'front' = fingers in front of a held object; 'all'.
function hand(ctx, x, y, s, rot, o = {}) {
  const pose = o.pose || 'open', pass = o.pass || 'all', curl = o.curl == null ? 1 : o.curl;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (o.mirror) ctx.scale(1, -1); ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -48, 0, 48); g.addColorStop(0, SK[0]); g.addColorStop(0.5, SK[1]); g.addColorStop(1, SK[2]);
  const back = pass !== 'front', front = pass !== 'back';
  // finger defs [baseY, len1, len2, len3, width]
  const F = [[-24, 30, 22, 17, 17], [-8, 33, 24, 18, 17.5], [8, 31, 22, 17, 16.5], [22, 25, 18, 14, 14.5]];
  const palm = () => {
    ctx.beginPath(); ctx.moveTo(-6, -28); ctx.bezierCurveTo(30, -38, 62, -36, 72, -24); ctx.bezierCurveTo(78, 0, 76, 20, 66, 32);
    ctx.bezierCurveTo(46, 40, 16, 38, -6, 26); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,200,150,0.35)'; ell(ctx, 34, -18, 26, 8, -0.05); ctx.fill();
    ctx.strokeStyle = 'rgba(150,80,50,0.2)'; ctx.lineWidth = 2; for (const fy of [-20, -6, 8]) { ctx.beginPath(); ctx.moveTo(62, fy); ctx.lineTo(70, fy + 2); ctx.stroke(); }
  };
  if (pose === 'hold') {
    const c = curl;
    const fs = F.map(([by, l1, l2, l3, w], i) => chain(66, by * 0.9, 0.35 * c - i * 0.04, [[l1, 0.2 * c], [l2, 0.9 * c], [l3, 0.7 * c]]));
    const th = chain(30, -30, -0.7, [[28, 0.3], [24, 0.5 * c], [18, 0.35 * c]]);
    if (back) { finger(ctx, th, 19, g); palm(); finger(ctx, fs[3], F[3][4], g); finger(ctx, fs[2], F[2][4], g); }
    if (front) { finger(ctx, fs[1], F[1][4], g); finger(ctx, fs[0], F[0][4], g); }
  } else if (pose === 'grip') {
    const fs = F.map(([by, l1, l2, l3, w], i) => chain(68, by * 0.9, 0.2, [[l1 * 0.8, 1.2 * curl], [l2 * 0.9, 1.3 * curl], [l3, 0.9 * curl]]));
    const th = chain(34, -30, -0.2, [[26, 0.25], [24, 0.45], [16, 0.3]]);
    if (back) { palm(); for (let i = 3; i >= 0; i--) finger(ctx, fs[i], F[i][4], g); }
    if (front) finger(ctx, th, 19, g);
  } else if (pose === 'pinch') {
    const fs = F.map(([by, l1, l2, l3, w], i) => chain(68, by * 0.9, 0.05 + i * 0.12, [[l1, i ? 0.9 : 0.2], [l2, i ? 1.2 : 0.25], [l3, i ? 0.8 : 0.2]]));
    const th = chain(34, -28, -0.45, [[28, 0.35], [26, 0.35], [18, 0.25]]);
    if (back) { palm(); finger(ctx, fs[3], F[3][4], g); finger(ctx, fs[2], F[2][4], g); finger(ctx, fs[1], F[1][4], g); }
    if (front) { finger(ctx, fs[0], F[0][4], g); finger(ctx, th, 19, g); }
  } else if (pose === 'claw') {
    const fs = F.map(([by, l1, l2, l3, w], i) => chain(66, by * 1.25, (i - 1.5) * 0.22, [[l1, 0.15 * curl], [l2, 0.55 * curl], [l3, 0.5 * curl]]));
    const th = chain(26, -32, -1.0, [[26, 0.35], [24, 0.4 * curl], [16, 0.3 * curl]]);
    if (back) { finger(ctx, th, 19, g); palm(); for (let i = 3; i >= 0; i--) finger(ctx, fs[i], F[i][4], g); }
  } else { // open
    const fs = F.map(([by, l1, l2, l3, w], i) => chain(66, by, (i - 1.5) * 0.08, [[l1, 0.1 * curl], [l2, 0.25 * curl], [l3, 0.2 * curl]]));
    const th = chain(28, -30, -0.6, [[28, 0.3], [24, 0.25], [16, 0.15]]);
    if (back) { finger(ctx, th, 19, g); palm(); for (let i = 3; i >= 0; i--) finger(ctx, fs[i], F[i][4], g); }
  }
  // warm rim light along the top
  if (back && o.rim !== false) { ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,170,90,${o.rimK == null ? 0.35 : o.rimK})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-4, -28); ctx.bezierCurveTo(30, -38, 60, -36, 72, -26); ctx.stroke(); }
  ctx.restore();
}

// ============================================================== UTENSILS
function spoon(ctx, x, y, s, rot = 0, o = {}) { // bowl centre at origin, handle toward +x
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, '#f4f6fa'); g.addColorStop(0.45, '#9aa2b4'); g.addColorStop(1, '#4a5064');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(26, -5); ctx.bezierCurveTo(80, -8, 150, -7, 196, -9); ctx.quadraticCurveTo(204, 0, 196, 9); ctx.bezierCurveTo(150, 7, 80, 8, 26, 6); ctx.closePath(); ctx.fill();
  ell(ctx, 0, 0, 38, 24); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ell(ctx, -10, -9, 16, 5, -0.15); ctx.fill();
  ctx.fillStyle = 'rgba(255,170,90,0.3)'; ell(ctx, 8, 10, 22, 6); ctx.fill();
  if (o.heap) { const r = rng(5); for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 3 ? 'rgba(255,252,240,0.95)' : 'rgba(220,215,200,0.9)'; const a = r() * TAU, d = Math.sqrt(r()) * 28; ctx.fillRect(Math.cos(a) * d * 1.1 - 2, Math.sin(a) * d * 0.62 - 2 - 6 * (1 - d / 28), 4, 4); } }
  ctx.restore();
}
function spatula(ctx, x, y, s, rot = 0) { // blade tip at origin, handle toward +x (wok turner)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -40, 0, 40); g.addColorStop(0, '#eef0f6'); g.addColorStop(0.5, '#8e96a8'); g.addColorStop(1, '#3e4456');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -46); ctx.quadraticCurveTo(-8, 0, 0, 46); ctx.lineTo(70, 34); ctx.quadraticCurveTo(96, 0, 70, -34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.moveTo(6, -38); ctx.lineTo(62, -28); ctx.lineTo(60, -22); ctx.lineTo(8, -30); ctx.fill();
  ctx.fillStyle = '#5a6070'; ctx.fillRect(84, -6, 140, 12);
  const wg = ctx.createLinearGradient(0, -12, 0, 12); wg.addColorStop(0, '#b07a46'); wg.addColorStop(1, '#4a2a14');
  ctx.fillStyle = wg; ctx.beginPath(); ctx.roundRect(214, -12, 200, 24, 12); ctx.fill();
  ctx.restore();
}
function bottle(ctx, x, y, s, rot, kind = 'fish') { // mouth at origin, body toward +y (rotate to pour)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const liquid = kind === 'oil' ? ['#ffe08a', '#e8a920', '#a86a10'] : ['#d9893a', '#a2501a', '#5a2408'];
  ctx.fillStyle = kind === 'oil' ? '#e83a2a' : '#c8202a'; ctx.beginPath(); ctx.roundRect(-16, -6, 32, 22, 4); ctx.fill();
  const g = ctx.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, liquid[2]); g.addColorStop(0.3, liquid[0]); g.addColorStop(0.6, liquid[1]); g.addColorStop(1, liquid[2]);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-14, 14); ctx.lineTo(14, 14); ctx.bezierCurveTo(16, 60, 58, 70, 58, 110); ctx.lineTo(58, 300); ctx.quadraticCurveTo(58, 316, 42, 316); ctx.lineTo(-42, 316); ctx.quadraticCurveTo(-58, 316, -58, 300); ctx.lineTo(-58, 110); ctx.bezierCurveTo(-58, 70, -16, 60, -14, 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.roundRect(-44, 110, 12, 180, 6); ctx.fill();
  ctx.fillStyle = kind === 'oil' ? 'rgba(40,120,60,0.85)' : 'rgba(250,240,220,0.85)'; ctx.fillRect(-58, 170, 116, 80);
  ctx.fillStyle = kind === 'oil' ? 'rgba(255,220,90,0.9)' : 'rgba(200,40,40,0.85)'; ell(ctx, 0, 210, 30, 22); ctx.fill();
  ctx.restore();
}
// liquid stream along a quadratic path, width w0→w1
function stream(ctx, x0, y0, cx, cy, x1, y1, w0, w1, col, hi, t = 0) {
  ctx.save(); ctx.lineCap = 'round';
  const N = 14;
  for (let i = 0; i < N; i++) {
    const a = i / N, b = (i + 1) / N;
    const q = (u) => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1];
    const [ax, ay] = q(a), [bx, by] = q(b);
    ctx.strokeStyle = col; ctx.lineWidth = lerp(w0, w1, a) * (1 + 0.08 * Math.sin(t * 40 + i * 1.3)); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  if (hi) { ctx.strokeStyle = hi; ctx.lineWidth = Math.max(1.5, w1 * 0.22); ctx.beginPath(); ctx.moveTo(x0 - w0 * 0.2, y0); ctx.quadraticCurveTo(cx - w0 * 0.2, cy, x1 - w1 * 0.2, y1); ctx.stroke(); }
  ctx.restore();
}
// splash ring of droplets at (x,y) aged a (0..1)
function splash(ctx, x, y, a, n, sz, col, seed = 3, ry = 0.5) {
  if (a <= 0 || a >= 1) return; const r = rng(seed);
  ctx.save(); ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const ang = r() * TAU, v = (0.5 + r() * 0.8) * sz * 3, h = (0.6 + r()) * sz * 2.2, d = ease.out(a) * v;
    const px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d * ry - Math.sin(a * PI) * h, rr = sz * (0.25 + r() * 0.3) * (1 - a * 0.6);
    ctx.globalAlpha = 1 - a; ell(ctx, px, py, rr, rr); ctx.fill();
  }
  ctx.restore();
}

// ============================================================== TAMARIND / SIEVE (top-down)
function tamarindLumps(ctx, x, y, R, t, o = {}) { // squish 0..1 (mashed), seed
  const r = rng(o.seed || 41), sq = o.squish || 0, n = o.n || 11;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * R * 0.62, rr = R * (0.17 + r() * 0.1) * (1 + sq * 0.5), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d, rot = r() * TAU;
    const flat = 1 - sq * 0.45;
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    ctx.beginPath(); for (let j = 0; j <= 10; j++) { const aa = j / 10 * TAU, wob = 1 + 0.18 * Math.sin(aa * 3 + i) + 0.08 * Math.sin(aa * 5 + i * 2); const qx = Math.cos(aa) * rr * wob, qy = Math.sin(aa) * rr * wob * (0.75 + 0.25 * flat); j ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); } ctx.closePath();
    const g = ctx.createRadialGradient(-rr * 0.3, -rr * 0.3, rr * 0.1, 0, 0, rr * 1.1); g.addColorStop(0, '#a8602c'); g.addColorStop(0.6, '#6a3014'); g.addColorStop(1, '#3a1606');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(40,14,4,0.8)'; ell(ctx, rr * 0.2, rr * 0.1, rr * 0.22, rr * 0.15, 0.4); ctx.fill(); // seed
    ctx.fillStyle = 'rgba(255,220,180,0.35)'; ell(ctx, -rr * 0.35, -rr * 0.35, rr * 0.25, rr * 0.1, -0.6); ctx.fill();
    ctx.strokeStyle = 'rgba(200,140,80,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-rr * 0.6, rr * 0.2); ctx.quadraticCurveTo(0, rr * 0.5, rr * 0.6, rr * 0.1); ctx.stroke(); // fiber
    ctx.restore();
  }
  ctx.restore();
}
const MESH = (() => sprite(512, 512, 0, (x) => {
  x.strokeStyle = 'rgba(210,215,230,0.55)'; x.lineWidth = 1.4;
  for (let i = 0; i < 512; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
}))();
function sieve(ctx, x, y, R, rot, o = {}) { // top-down strainer; o.inside(ctx) = pulp in mesh
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  // handle
  const hg = ctx.createLinearGradient(0, -14, 0, 14); hg.addColorStop(0, '#e6e9f0'); hg.addColorStop(1, '#5a6070');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(R * 0.9, -12, R * 1.3, 24, 12); ctx.fill();
  ctx.fillStyle = '#c8202a'; ctx.beginPath(); ctx.roundRect(R * 1.65, -15, R * 0.6, 30, 15); ctx.fill();
  // mesh bowl
  ell(ctx, 0, 0, R, R); ctx.fillStyle = 'rgba(40,44,60,0.35)'; ctx.fill();
  ctx.save(); ell(ctx, 0, 0, R, R); ctx.clip();
  if (o.inside) o.inside(ctx);
  ctx.drawImage(MESH, -R, -R, R * 2, R * 2);
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 0, 0, 0, R); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  ctx.lineWidth = R * 0.06; ctx.strokeStyle = '#b8bfcc'; ell(ctx, 0, 0, R, R); ctx.stroke();
  ctx.lineWidth = R * 0.02; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(0, 0, R, PI * 1.05, PI * 1.6); ctx.stroke();
  ctx.restore();
}
// top-down bowl (porcelain) — rim circle radius R
function bowlTop(ctx, x, y, R, o = {}) {
  ctx.save(); ctx.translate(x, y);
  const sg = ctx.createRadialGradient(R * 0.12, R * 0.15, R * 0.8, R * 0.12, R * 0.15, R * 1.25); sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);
  ell(ctx, 0, 0, R, R); ctx.fillStyle = '#f4f2ee'; ctx.fill();
  ctx.lineWidth = R * 0.045; ctx.strokeStyle = '#2f5fae'; ell(ctx, 0, 0, R * 0.95, R * 0.95); ctx.stroke();
  ell(ctx, 0, 0, R * 0.88, R * 0.88);
  const g = ctx.createRadialGradient(-R * 0.25, -R * 0.25, R * 0.1, 0, 0, R * 0.9); g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#e2dfd8'); g.addColorStop(1, '#b4b0a8');
  ctx.fillStyle = g; ctx.fill();
  if (o.inside) { ctx.save(); ell(ctx, 0, 0, R * 0.88, R * 0.88); ctx.clip(); o.inside(ctx); ctx.restore(); }
  ctx.lineWidth = R * 0.02; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.99, PI * 1.05, PI * 1.55); ctx.stroke();
  ctx.restore();
}
// liquid disc inside a top-down bowl
function liquidTop(ctx, R, level, col, t, o = {}) {
  if (level <= 0) return;
  const rr = R * (0.55 + 0.33 * level);
  ell(ctx, 0, 0, rr, rr); const g = ctx.createRadialGradient(-rr * 0.3, -rr * 0.3, rr * 0.05, 0, 0, rr); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5; ctx.fillStyle = 'rgba(255,240,220,0.5)'; ell(ctx, -rr * 0.35, -rr * 0.4, rr * 0.3, rr * 0.08, -0.6); ctx.fill(); ctx.restore();
}

// ============================================================== BACKGROUNDS (cached)
const BG = {};
function nightBG(seed = 1, o = {}) {
  const key = 'n' + seed; if (BG[key]) return BG[key];
  const c = createCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1424'); g.addColorStop(0.55, '#14283a'); g.addColorStop(1, '#1d3a4a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.filter = 'blur(18px)';
  const r = rng(seed * 7 + 3), cols = ['255,70,170', '60,220,255', '255,170,80', '255,200,120', '150,110,255'];
  for (let i = 0; i < 34; i++) {
    const px = r() * W, py = r() * H * 0.75, rad = 25 + r() * 90, col = cols[Math.floor(r() * cols.length)], a = 0.18 + r() * 0.32;
    const gg = x.createRadialGradient(px, py, rad * 0.6, px, py, rad); gg.addColorStop(0, `rgba(${col},${a})`); gg.addColorStop(1, `rgba(${col},${a * 0.4})`);
    x.fillStyle = gg; x.beginPath(); x.arc(px, py, rad, 0, TAU); x.fill();
  }
  // a few neon tube strokes (signage, shapeless when blurred)
  x.filter = 'blur(26px)'; x.lineCap = 'round';
  for (let i = 0; i < 5; i++) { x.strokeStyle = `rgba(${cols[i % 2]},0.45)`; x.lineWidth = 16; const px = r() * W, py = r() * H * 0.5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 400, py + (r() - 0.5) * 60); x.stroke(); }
  x.filter = 'none';
  BG[key] = c; return c;
}
// 3/4 steel cart counter with a back edge at y0 (cached, H tall)
function steelCounter(y0 = 760) {
  const key = 'sc' + y0; if (BG[key]) return BG[key];
  const c = createCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#3a4258'); g.addColorStop(0.25, '#56617e'); g.addColorStop(1, '#262c40');
  x.fillStyle = g; x.fillRect(0, y0, W, H - y0);
  const r = rng(12); x.globalAlpha = 0.08;
  for (let i = 0; i < 260; i++) { const yy = y0 + r() * (H - y0); x.fillStyle = r() < 0.5 ? '#fff' : '#000'; x.fillRect(r() * W - 200, yy, 200 + r() * 600, 1 + r() * 1.5); }
  x.globalAlpha = 1;
  x.filter = 'blur(40px)';
  const wg = x.createRadialGradient(W * 0.3, y0 + 300, 0, W * 0.3, y0 + 300, 600); wg.addColorStop(0, 'rgba(255,160,80,0.35)'); wg.addColorStop(1, 'rgba(255,160,80,0)'); x.fillStyle = wg; x.fillRect(0, y0, W, H - y0);
  x.fillStyle = 'rgba(255,80,180,0.12)'; x.fillRect(W * 0.7, y0 + 40, 220, 700);
  x.filter = 'none';
  x.fillStyle = 'rgba(220,230,255,0.55)'; x.fillRect(0, y0, W, 3);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y0 + 3, W, 10);
  BG[key] = c; return c;
}
// top-down worn wooden board on steel (square 2000 px to survive rotation); centre (1000,1000)
function boardTop() {
  if (BG.board) return BG.board;
  const S = 2400, c = createCanvas(S, S), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#2a3048'); g.addColorStop(1, '#1a2034'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  const r = rng(31); x.globalAlpha = 0.07; for (let i = 0; i < 400; i++) { x.fillStyle = r() < 0.5 ? '#fff' : '#000'; x.fillRect(r() * S, r() * S - 300, 1.4, 300 + r() * 900); } x.globalAlpha = 1;
  // round wooden chopping board (thớt)
  const cx = S / 2, cy = S / 2, R = 820;
  x.save(); x.filter = 'blur(30px)'; x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.arc(cx + 30, cy + 40, R + 10, 0, TAU); x.fill(); x.restore();
  const wg = x.createRadialGradient(cx - 200, cy - 200, 50, cx, cy, R); wg.addColorStop(0, '#b78452'); wg.addColorStop(0.7, '#8a5a32'); wg.addColorStop(1, '#5a3618');
  x.fillStyle = wg; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
  x.save(); x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.clip();
  x.strokeStyle = 'rgba(70,40,15,0.22)'; x.lineWidth = 2; for (let i = 1; i < 40; i++) { x.beginPath(); x.arc(cx + 12, cy - 8, i * 21 + Math.sin(i) * 4, 0, TAU); x.stroke(); }
  x.strokeStyle = 'rgba(255,230,190,0.08)'; x.lineWidth = 1.5; for (let i = 0; i < 120; i++) { const a = r() * TAU, d = r() * R; x.beginPath(); x.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); x.lineTo(cx + Math.cos(a) * d + (r() - 0.5) * 120, cy + Math.sin(a) * d + (r() - 0.5) * 120); x.stroke(); }
  x.restore();
  x.strokeStyle = 'rgba(40,20,6,0.6)'; x.lineWidth = 18; x.beginPath(); x.arc(cx, cy, R - 6, 0, TAU); x.stroke();
  BG.board = c; return c;
}
// small seeded crumbs (garlic/shallot) for wok
function bits(ctx, list, gold, s = 1) { // list [[x,y,kind,rot,size]], gold 0..1
  for (const [x, y, kind, rot, sz] of list) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    if (kind === 0) { // garlic cube
      ctx.fillStyle = `rgb(${Math.round(lerp(246, 222, gold))},${Math.round(lerp(236, 160, gold))},${Math.round(lerp(206, 70, gold))})`; ctx.beginPath(); ctx.roundRect(-sz * s, -sz * 0.8 * s, sz * 2 * s, sz * 1.6 * s, sz * 0.4 * s); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-sz * 0.7 * s, -sz * 0.6 * s, sz * 0.8 * s, sz * 0.35 * s);
    } else { // shallot sliver
      ctx.strokeStyle = `rgb(${Math.round(lerp(200, 170, gold))},${Math.round(lerp(110, 90, gold))},${Math.round(lerp(150, 50, gold))})`; ctx.lineWidth = sz * 0.7 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, sz * 1.5 * s, -1.2, 1.0); ctx.stroke();
    }
    ctx.restore();
  }
}

module.exports = { ell, SK, SLV, CUFF, fire, warmLight, wokBack, wokFront, saucePool, potBody, potLid, bowlBack, bowlFront, arm, hand, spoon, spatula, bottle, stream, splash, tamarindLumps, sieve, bowlTop, liquidTop, nightBG, steelCounter, boardTop, bits };
