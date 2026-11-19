// Bún chả props: charcoal brazier, bamboo clamp grill, hand fan, patties, raw pork, knives,
// mince, sauce bowls (side + top), bún nests, plates, smoke / embers / flames, smoke hand,
// stacked bowls, CTA buttons.
const L = require('./lib');
const P = require('./props');
const R = require('./river');
const F = require('./food');
const { W, H, TAU, rng, clamp, lerp, ease, at, glow } = L;
const { ell, shade } = P;
const mix = F.mix;

const LAN_SHIRT = '#a8d4ea', LAN_SHIRT_D = '#6c9cbc';
const LAN_SKIN = ['#d9a07a', '#9a6240'];

// ---------------- smoke / embers / flames ----------------
// rising smoke puffs from (x,y) going up h px; drift = px of sideways drift at the top
function smoke(ctx, t, seed, x, y, w, h, n = 14, alpha = 0.5, drift = 120, col = '235,232,225', grow = 1) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.16 + r() * 0.14, bx = (r() - 0.5) * w, rad = (50 + r() * 70) * grow;
    const life = (t * sp + ph) % 1;
    const yy = y - life * h;
    const xx = x + bx * (1 - life * 0.3) + drift * life * life + Math.sin(t * 0.9 + i * 1.7) * 26 * life;
    const rr = rad * (0.5 + life * 1.8);
    ctx.globalAlpha = alpha * Math.sin(Math.min(1, life * 1.4) * Math.PI) * (0.6 + 0.4 * r());
    const g = ctx.createRadialGradient(xx - rr * 0.2, yy - rr * 0.25, 0, xx, yy, rr);
    g.addColorStop(0, `rgba(${col},0.75)`); g.addColorStop(0.55, `rgba(${col},0.35)`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, rr, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// glowing embers / sparks drifting upward
function embers(ctx, t, seed, n, x, y, w, h, a = 1, size = 1) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const sp = 0.5 + r() * 0.9, ph = r(), bx = (r() - 0.5) * w, sz = (1.5 + r() * 3) * size;
    const life = (t * sp + ph) % 1;
    const px = x + bx + Math.sin(t * 3 + i) * 30 * life, py = y - life * h;
    ctx.globalAlpha = a * (1 - life) * (0.6 + 0.4 * Math.sin(t * 20 + i * 3));
    ctx.fillStyle = life < 0.3 ? '#fff2b0' : '#ff9a3a';
    ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// flame tongues rising from a line (x-w/2 .. x+w/2, y)
function flames(ctx, t, seed, x, y, w, h, k = 1) {
  if (k <= 0) return;
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 14; i++) {
    const fx = x + (r() - 0.5) * w, fh = h * (0.4 + r() * 0.6) * k * (0.75 + 0.25 * Math.sin(t * 17 + i * 2.1)), fw = 30 + r() * 50;
    const sway = Math.sin(t * 9 + i) * 18;
    const g = ctx.createLinearGradient(0, y, 0, y - fh);
    g.addColorStop(0, 'rgba(255,250,210,0.95)'); g.addColorStop(0.3, 'rgba(255,190,60,0.85)'); g.addColorStop(0.7, 'rgba(240,90,20,0.5)'); g.addColorStop(1, 'rgba(160,30,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(fx - fw, y);
    ctx.bezierCurveTo(fx - fw * 0.9, y - fh * 0.4, fx + sway - fw * 0.3, y - fh * 0.7, fx + sway * 1.6, y - fh);
    ctx.bezierCurveTo(fx + sway + fw * 0.3, y - fh * 0.7, fx + fw * 0.9, y - fh * 0.4, fx + fw, y);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  glow(ctx, x, y - h * 0.3 * k, w * 0.9, 'rgba(255,140,40,0.9)', 0.6 * k);
}
// wavy smoke ribbons between two points (screen space); k = how far it has travelled (0..1)
function smokeRibbon(ctx, x0, y0, x1, y1, t, k, a = 1, n = 5) {
  if (k <= 0) return;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = i * 1.3;
    for (const [lw, al, bl] of [[46, 0.12, 10], [18, 0.32, 3]]) {
      ctx.filter = `blur(${bl}px)`;
      ctx.lineWidth = lw; ctx.strokeStyle = `rgba(245,242,235,${al * a})`;
      ctx.beginPath();
      for (let u = 0; u <= 1.001; u += 0.04) {
        const uu = u * k, x = lerp(x0, x1, uu) + Math.sin(uu * 9 + t * 4 + ph) * 34 * (1 - uu * 0.6), y = lerp(y0, y1, uu) + Math.cos(uu * 7 + t * 3.4 + ph) * 26 * (1 - uu * 0.7) + (i - (n - 1) / 2) * 16 * (1 - uu);
        u === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
// a hand made of smoke, pointing along +x with the index finger curling ("come here"). curl 0..1
function smokeHand(ctx, x, y, s, rot, a, curl, t = 0) {
  if (a <= 0) return;
  const shape = (c) => {
    c.beginPath(); c.ellipse(0, 0, 62, 50, 0, 0, TAU); c.fill();                     // palm
    c.beginPath(); c.ellipse(-70, 6, 50, 34, 0.1, 0, TAU); c.fill();                 // wrist blob
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(52, 10 + i * 20, 26, 12, 0.5, 0, TAU); c.fill(); } // curled fingers
    c.beginPath(); c.ellipse(-10, -50, 30, 14, -0.6, 0, TAU); c.fill();              // thumb
    // index finger: three joints that curl inward
    let px = 46, py = -24, ang = -0.15;
    c.lineCap = 'round';
    for (let j = 0; j < 3; j++) {
      const len = [44, 34, 28][j], nx = px + Math.cos(ang) * len, ny = py + Math.sin(ang) * len;
      c.lineWidth = [26, 22, 18][j]; c.beginPath(); c.moveTo(px, py); c.lineTo(nx, ny); c.stroke();
      px = nx; py = ny; ang += curl * 1.25;
    }
  };
  at(ctx, x, y, rot, s, s, () => {
    ctx.save();
    ctx.globalAlpha = a * 0.35; ctx.filter = 'blur(16px)'; ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = '#fffaf0'; shape(ctx);
    ctx.globalAlpha = a * 0.6; ctx.filter = 'blur(5px)'; shape(ctx);
    ctx.globalAlpha = a * 0.5; ctx.filter = 'blur(1.5px)'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    at(ctx, -3, -3, 0, 0.9, 0.9, () => shape(ctx));
    ctx.restore();
    // swirling wisps inside
    ctx.save(); ctx.globalAlpha = a * 0.5; ctx.strokeStyle = 'rgba(200,200,205,0.6)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-10 + i * 12, 4, 18 + i * 8, t * 2 + i, t * 2 + i + 2.2); ctx.stroke(); }
    ctx.restore();
  });
}

// ---------------- brazier (lò than dài) ----------------
// 3/4 view, origin = ground centre. width 560, height 200 at s=1. k = top-face depth ratio. heat 0..1+
function brazier(ctx, x, y, s, t, o = {}) {
  const k = o.k === undefined ? 0.32 : o.k, heat = o.heat === undefined ? 1 : o.heat;
  const Wd = 280, Hb = 200, D = 200 * k;
  at(ctx, x, y, 0, s, s, () => {
    // legs + shadow
    ctx.save(); ctx.filter = 'blur(14px)'; ell(ctx, 0, 4, Wd * 1.05, 26); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
    ctx.fillStyle = '#1c1a18'; for (const lx of [-Wd + 20, Wd - 40]) ctx.fillRect(lx, -40, 20, 40);
    // back rim (top face far edge)
    ctx.beginPath(); ctx.moveTo(-Wd + 16, -Hb - D); ctx.lineTo(Wd - 16, -Hb - D); ctx.lineTo(Wd, -Hb); ctx.lineTo(-Wd, -Hb); ctx.closePath();
    ctx.fillStyle = '#2a2420'; ctx.fill();
    // charcoal bed
    ctx.save(); ctx.beginPath(); ctx.moveTo(-Wd + 26, -Hb - D + 8); ctx.lineTo(Wd - 26, -Hb - D + 8); ctx.lineTo(Wd - 10, -Hb - 4); ctx.lineTo(-Wd + 10, -Hb - 4); ctx.closePath(); ctx.clip();
    const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.7);
    const bg = ctx.createLinearGradient(0, -Hb - D, 0, -Hb); bg.addColorStop(0, '#3a0e04'); bg.addColorStop(1, `rgba(255,${(120 + 60 * fl * heat) | 0},40,1)`);
    ctx.fillStyle = bg; ctx.fillRect(-Wd, -Hb - D - 10, Wd * 2, D + 20);
    const r = rng(o.seed || 21);
    for (let i = 0; i < 46; i++) {
      const cx = (r() - 0.5) * Wd * 1.9, cy = -Hb - D + 8 + r() * (D - 6), cs = (12 + r() * 16) * (0.7 + 0.3 * (cy + Hb + D) / D);
      ctx.beginPath(); ctx.roundRect(cx - cs, cy - cs * 0.55, cs * 2, cs * 1.1, 6);
      ctx.fillStyle = '#1b0d07'; ctx.fill();
      const e = clamp(heat * (0.5 + 0.5 * Math.sin(t * (3 + r() * 4) + i)));
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,${(110 + 110 * e) | 0},${(30 + 40 * e) | 0},${0.6 + 0.4 * e})`; ctx.stroke();
      if (r() < 0.35) { ell(ctx, cx, cy, cs * 0.5, cs * 0.25); ctx.fillStyle = `rgba(255,${(150 + 80 * e) | 0},60,${0.5 * e + 0.2})`; ctx.fill(); }
    }
    ctx.restore();
    // front body (dented tin box, warm-lit)
    ctx.beginPath(); ctx.moveTo(-Wd, -Hb); ctx.lineTo(Wd, -Hb); ctx.lineTo(Wd - 14, 0 - 30); ctx.lineTo(-Wd + 14, -30); ctx.closePath();
    const fg = ctx.createLinearGradient(-Wd, 0, Wd, 0);
    fg.addColorStop(0, '#3a3532'); fg.addColorStop(0.35, '#7c7570'); fg.addColorStop(0.6, '#55504c'); fg.addColorStop(1, '#262220');
    ctx.fillStyle = fg; ctx.fill();
    // soot + dents + air holes
    const sg = ctx.createLinearGradient(0, -Hb, 0, -30); sg.addColorStop(0, 'rgba(10,6,4,0.75)'); sg.addColorStop(0.4, 'rgba(10,6,4,0.1)'); sg.addColorStop(1, 'rgba(10,6,4,0.4)');
    ctx.fillStyle = sg; ctx.fill();
    for (let i = 0; i < 5; i++) {
      const hx = -Wd + 70 + i * (Wd * 2 - 140) / 4;
      ell(ctx, hx, -80, 16, 12); ctx.fillStyle = '#120806'; ctx.fill();
      ell(ctx, hx, -78, 11, 7); ctx.fillStyle = `rgba(255,${(110 + 80 * fl) | 0},30,${0.7 * heat})`; ctx.fill();
    }
    // rim highlight
    ctx.fillStyle = '#8a827a'; ctx.fillRect(-Wd - 4, -Hb - 6, Wd * 2 + 8, 10);
    ctx.fillStyle = `rgba(255,170,90,${0.55 * heat})`; ctx.fillRect(-Wd - 4, -Hb - 6, Wd * 2 + 8, 3);
    glow(ctx, 0, -Hb - D * 0.5, Wd * 1.2, 'rgba(255,110,30,0.8)', 0.55 * fl * heat);
  });
}
const brazierTop = (x, y, s, k = 0.32) => [x, y - (200 + 100 * k) * s];

// ---------------- bamboo clamp grill (vỉ tre), TOP-DOWN ----------------
// origin = centre of the closed grill. fold 0 = open (lid lies to the right), 1 = closed.
// items(ctx) draws the meat in local coords on the bottom half (≈ ±150 × ±110). char 0..1 scorches the bamboo.
const GW = 300, GH = 220;
function grillHalf(ctx, char, seed) {
  const bam = mix('#e6c98c', '#4a2c14', char), bamD = mix('#b8935a', '#2a180a', char);
  const stick = (x0, y0, x1, y1, w) => {
    ctx.strokeStyle = bamD; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = bam; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  ctx.lineCap = 'round';
  for (let x = -GW / 2 + 20; x < GW / 2 - 10; x += 22) stick(x, -GH / 2 + 4, x, GH / 2 - 4, 5);
  for (const y of [-GH / 2 + 50, 0, GH / 2 - 50]) stick(-GW / 2 + 8, y, GW / 2 - 8, y, 4);
  stick(-GW / 2, -GH / 2, GW / 2, -GH / 2, 12); stick(-GW / 2, GH / 2, GW / 2, GH / 2, 12);
  stick(-GW / 2, -GH / 2 - 6, -GW / 2, GH / 2 + 6, 12); stick(GW / 2, -GH / 2 - 6, GW / 2, GH / 2 + 6, 12);
  // ties
  ctx.fillStyle = mix('#8a6a3a', '#20120a', char);
  for (const [tx, ty] of [[-GW / 2, -GH / 2], [GW / 2, -GH / 2], [-GW / 2, GH / 2], [GW / 2, GH / 2]]) { ctx.beginPath(); ctx.arc(tx, ty, 9, 0, TAU); ctx.fill(); }
  // handle (two sticks converge downward)
  stick(-GW / 2 + 30, GH / 2, -14, GH / 2 + 260, 11); stick(GW / 2 - 30, GH / 2, 14, GH / 2 + 260, 11);
  ctx.fillStyle = mix('#c9a46a', '#3a2412', char * 0.6); ctx.beginPath(); ctx.roundRect(-22, GH / 2 + 200, 44, 70, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-22, GH / 2 + 210 + i * 12); ctx.lineTo(22, GH / 2 + 214 + i * 12); ctx.stroke(); }
}
function grill(ctx, x, y, s, rot, o = {}) {
  const fold = o.fold === undefined ? 1 : o.fold, char = o.char || 0;
  at(ctx, x, y, rot, s, s * (o.k || 1), () => {
    if (o.shadow !== false) { ctx.save(); ctx.filter = 'blur(12px)'; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-GW / 2 + 16, -GH / 2 + 22, GW, GH); ctx.restore(); }
    const back = o.back || 0; // 0..1 shows underside colour (after flip)
    ctx.save(); ctx.globalAlpha = 1; grillHalf(ctx, char, 1); ctx.restore();
    if (o.items) o.items(ctx);
    // lid: hinged on the right edge (x = GW/2). angle 0 (open, lying right) → π (closed over)
    const th = fold * Math.PI, c = Math.cos(th);
    const hinge = GW / 2;
    if (Math.abs(c) > 0.02 || fold > 0.5) {
      at(ctx, hinge, 0, 0, 1, 1, () => {
        ctx.scale(c === 0 ? 0.001 : c, 1);
        ctx.translate(GW / 2, 0);
        // the lid's lift: darken a bit when vertical
        grillHalf(ctx, char * (fold > 0.5 ? 1 : 0.6), 2);
      });
      if (fold > 0.05 && fold < 0.95) { ctx.fillStyle = `rgba(0,0,0,${0.25 * Math.sin(th)})`; }
    }
    if (back > 0) { ctx.save(); ctx.globalAlpha = back * 0.35; ctx.fillStyle = '#1a0c04'; ctx.fillRect(-GW / 2 - 6, -GH / 2 - 6, GW + 12, GH + 12); ctx.restore(); }
  });
}

// ---------------- patties (top-down) ----------------
// kind 'vien' (round minced patty) or 'mieng' (pork-belly slice). char 0..1 raw → caramel. marks = grill slat marks
function patty(ctx, x, y, s, rot, char = 0, kind = 'vien', seed = 1) {
  at(ctx, x, y, rot, s, s, () => {
    const raw = kind === 'vien' ? '#d88a84' : '#e39a92';
    const cooked = '#9a5424', burnt = '#4a220c';
    const base = char < 0.7 ? mix(raw, cooked, char / 0.7) : mix(cooked, burnt, (char - 0.7) / 0.3 * 0.6);
    if (kind === 'vien') {
      ell(ctx, 3, 5, 38, 33); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      ell(ctx, 0, 0, 38, 33);
      const g = ctx.createRadialGradient(-10, -10, 3, 0, 0, 40); g.addColorStop(0, mix(base, '#ffd9a0', 0.25)); g.addColorStop(1, shade(base, -0.25));
      ctx.fillStyle = g; ctx.fill();
      const r = rng(seed);
      for (let i = 0; i < 14; i++) { ell(ctx, (r() - 0.5) * 56, (r() - 0.5) * 46, 3 + r() * 3, 2 + r() * 2); ctx.fillStyle = char > 0.3 ? `rgba(60,25,8,${0.5 * char})` : 'rgba(255,230,220,0.5)'; ctx.fill(); }
      if (char > 0.25) { ctx.strokeStyle = `rgba(40,15,4,${0.6 * char})`; ctx.lineWidth = 5; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-30, i * 18 - 6); ctx.lineTo(30, i * 18 + 6); ctx.stroke(); } }
      if (char > 0.4) { ell(ctx, -12, -12, 10, 6); ctx.fillStyle = `rgba(255,220,150,${0.35 * char})`; ctx.fill(); }
    } else {
      ctx.beginPath(); ctx.moveTo(-62, -20); ctx.quadraticCurveTo(0, -30, 62, -18); ctx.lineTo(58, 20); ctx.quadraticCurveTo(0, 28, -60, 18); ctx.closePath();
      ctx.fillStyle = base; ctx.fill();
      // fat stripes
      const fat = mix('#fbefe6', '#e0a050', char);
      ctx.fillStyle = fat; ctx.beginPath(); ctx.moveTo(-60, -10); ctx.quadraticCurveTo(0, -18, 60, -8); ctx.lineTo(60, -2); ctx.quadraticCurveTo(0, -10, -60, -3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-58, 8); ctx.quadraticCurveTo(0, 2, 58, 9); ctx.lineTo(58, 14); ctx.quadraticCurveTo(0, 8, -58, 13); ctx.closePath(); ctx.fill();
      if (char > 0.2) { ctx.strokeStyle = `rgba(40,15,4,${0.7 * char})`; ctx.lineWidth = 6; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 22 - 8, -22); ctx.lineTo(i * 22 + 8, 22); ctx.stroke(); } }
      // caramel edge
      if (char > 0.3) { ctx.strokeStyle = `rgba(70,30,6,${char})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-62, -20); ctx.quadraticCurveTo(0, -30, 62, -18); ctx.lineTo(58, 20); ctx.quadraticCurveTo(0, 28, -60, 18); ctx.closePath(); ctx.stroke(); }
    }
    // glossy fat sheen
    if (char > 0.2) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ell(ctx, -8, -10, 16, 6); ctx.fillStyle = `rgba(255,220,160,${0.3 * char})`; ctx.fill(); ctx.restore(); }
  });
}
// side-view patty (for sauce bowls, chopsticks, macro)
function pattySide(ctx, x, y, s, rot, char = 1, kind = 'vien') {
  at(ctx, x, y, rot, s, s, () => {
    const base = mix('#d88a84', '#9a5424', clamp(char / 0.7));
    if (kind === 'vien') {
      ctx.beginPath(); ctx.ellipse(0, 0, 40, 20, 0, 0, TAU);
      const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, shade(base, -0.35)); g.addColorStop(0.4, base); g.addColorStop(1, shade(base, -0.3));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(40,15,4,0.55)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-28 + i * 20, -16); ctx.lineTo(-20 + i * 20, -19); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.moveTo(-60, -8); ctx.quadraticCurveTo(0, -18, 60, -6); ctx.lineTo(58, 10); ctx.quadraticCurveTo(0, 2, -58, 12); ctx.closePath();
      ctx.fillStyle = base; ctx.fill();
      ctx.fillStyle = mix('#fbefe6', '#e0a050', char); ctx.fillRect(-56, -4, 112, 4);
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ell(ctx, -10, -8, 14, 4); ctx.fillStyle = 'rgba(255,220,160,0.35)'; ctx.fill(); ctx.restore();
  });
}

// ---------------- raw pork + knives + mince ----------------
function rawBelly(ctx, x, y, s, w = 420) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = '#efc4ae'; ctx.beginPath(); ctx.roundRect(-w / 2, -120, w, 18, 6); ctx.fill(); // skin
    ctx.fillStyle = '#fbf1ec'; ctx.fillRect(-w / 2, -104, w, 30);   // fat
    ctx.fillStyle = '#d9787e'; ctx.fillRect(-w / 2, -74, w, 30);    // lean
    ctx.fillStyle = '#f8ebe6'; ctx.fillRect(-w / 2, -44, w, 12);
    ctx.fillStyle = '#cf6a72'; ctx.fillRect(-w / 2, -32, w, 32);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-w / 2, -104, w, 5);
    ctx.fillStyle = 'rgba(120,30,40,0.25)'; ctx.fillRect(w / 2 - 6, -120, 6, 120);
  });
}
function rawSlice(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-60, -14); ctx.quadraticCurveTo(0, -22, 60, -14); ctx.lineTo(58, 16); ctx.quadraticCurveTo(0, 22, -58, 16); ctx.closePath();
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, '#efc4ae'); g.addColorStop(0.15, '#fbf1ec'); g.addColorStop(0.4, '#fbf1ec'); g.addColorStop(0.45, '#d9787e'); g.addColorStop(0.7, '#d9787e'); g.addColorStop(0.75, '#f8ebe6'); g.addColorStop(0.82, '#cf6a72'); g.addColorStop(1, '#cf6a72');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(150,60,60,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  });
}
// chef knife: origin = middle of the cutting edge, blade along x (tip at -x), handle at +x
function knife(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-230, 0); ctx.quadraticCurveTo(-200, -60, -120, -80); ctx.lineTo(130, -80); ctx.lineTo(130, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -80, 0, 0); g.addColorStop(0, '#5e6266'); g.addColorStop(0.5, '#e8e9e6'); g.addColorStop(0.85, '#b9bcbc'); g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(-200, -4, 330, 3);
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.roundRect(126, -72, 170, 50, 14); ctx.fill();
    ctx.fillStyle = '#c0c4c4'; for (const rx of [170, 230]) { ell(ctx, rx, -47, 5, 5); ctx.fill(); }
  });
}
// minced pork pile (side-ish), fine 0..1 makes the bits smaller & pinker
function mince(ctx, x, y, s, seed, n = 160, rx = 220, ry = 80, fine = 0) {
  at(ctx, x, y, 0, s, s, () => {
    const r = rng(seed);
    ell(ctx, 0, 0, rx, ry * 0.5); ctx.fillStyle = '#b9545c'; ctx.fill();
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()), px = Math.cos(a) * d * rx, py = Math.sin(a) * d * ry * 0.5 - (1 - d) * ry * 0.9;
      const sz = lerp(14, 6, fine) * (0.6 + r() * 0.8);
      ell(ctx, px, py, sz, sz * 0.7); ctx.fillStyle = r() < 0.25 ? '#f6e4de' : ['#d9787e', '#c9626a', '#e28a8e'][(r() * 3) | 0]; ctx.fill();
    }
  });
}
// minced meat inside a top-down bowl (radius R)
function minceTop(ctx, R, seed, n = 220, tint = 0) {
  const r = rng(seed);
  ell(ctx, 0, 0, R, R); ctx.fillStyle = mix('#c9626a', '#9a5a3a', tint); ctx.fill();
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.97; ell(ctx, Math.cos(a) * d, Math.sin(a) * d, 4 + r() * 6, 3 + r() * 4); ctx.fillStyle = mix(r() < 0.25 ? '#f6e4de' : ['#d9787e', '#c9626a', '#e28a8e'][(r() * 3) | 0], '#a0602c', tint * 0.7); ctx.fill(); }
}
// plain top-down bowl (white ceramic, blue rim). fillFn(ctx, innerR)
function bowlTop(ctx, x, y, R, fillFn, rot = 0) {
  at(ctx, x, y, rot, 1, 1, () => {
    ctx.save(); ctx.filter = 'blur(18px)'; ell(ctx, 18, 26, R * 1.04, R * 1.04); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 0, R, R); const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.2, 0, 0, R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfcac0'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = R * 0.035; ctx.strokeStyle = '#2f5a9a'; ell(ctx, 0, 0, R * 0.96, R * 0.96); ctx.stroke();
    ctx.lineWidth = R * 0.015; ell(ctx, 0, 0, R * 0.9, R * 0.9); ctx.stroke();
    const iR = R * 0.84;
    ell(ctx, 0, 0, iR, iR); const ig = ctx.createRadialGradient(R * 0.2, R * 0.2, 4, 0, 0, iR); ig.addColorStop(0, '#f6f3ec'); ig.addColorStop(1, '#d6d0c4'); ctx.fillStyle = ig; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, iR, iR); ctx.clip(); if (fillFn) fillFn(ctx, iR); ctx.restore();
  });
}

// ---------------- nước chấm (sauce) ----------------
const SAUCE = ['#f2b25a', '#b8641e'];
function papaya(ctx, x, y, s, rot) { at(ctx, x, y, rot, s, s, () => { ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(18, -10); ctx.lineTo(14, 12); ctx.lineTo(-18, 10); ctx.closePath(); ctx.fillStyle = 'rgba(236,228,170,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(160,170,90,0.7)'; ctx.lineWidth = 2; ctx.stroke(); }); }
function carrot(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = i % 2 ? 11 : 16; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath();
    ctx.fillStyle = '#f08a2a'; ctx.fill(); ell(ctx, 0, 0, 6, 6); ctx.fillStyle = '#f7b260'; ctx.fill();
  });
}
function garlic(ctx, x, y, s) { at(ctx, x, y, 0, s, s, () => { ctx.beginPath(); ctx.moveTo(-5, -4); ctx.lineTo(5, -5); ctx.lineTo(6, 4); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fillStyle = '#fbf6e2'; ctx.fill(); }); }
function chiliRing(ctx, x, y, s) { at(ctx, x, y, 0, s, s, () => { ell(ctx, 0, 0, 10, 10); ctx.fillStyle = '#d42a1e'; ctx.fill(); ell(ctx, 0, 0, 5, 5); ctx.fillStyle = '#f6d36b'; ctx.fill(); ell(ctx, 1, 1, 2, 2); ctx.fillStyle = '#fff4c0'; ctx.fill(); }); }
// sauce surface top-down inside radius iR. o: {papaya, carrot, garlic, chili, patties, mieng, ripples:[[x,y,age]], t, level}
function sauceTop(ctx, iR, o = {}) {
  const sR = iR * (o.level === undefined ? 0.97 : o.level);
  ell(ctx, 0, 0, sR, sR);
  const g = ctx.createRadialGradient(-iR * 0.3, -iR * 0.3, 10, 0, 0, iR); g.addColorStop(0, '#f6c272'); g.addColorStop(0.7, '#d8893a'); g.addColorStop(1, '#a8561a');
  ctx.fillStyle = g; ctx.fill();
  // oil glints
  const r0 = rng(77); ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 14; i++) { const a = r0() * TAU, d = Math.sqrt(r0()) * sR * 0.85; ell(ctx, Math.cos(a) * d, Math.sin(a) * d, 6 + r0() * 10, 4 + r0() * 6); ctx.fillStyle = 'rgba(255,230,160,0.25)'; ctx.fill(); }
  ctx.restore();
  (o.ripples || []).forEach(([x, y, age]) => { if (age < 0 || age > 1.2) return; for (let k = 0; k < 3; k++) { const rr = 10 + (age * 160 - k * 30); if (rr < 4) continue; ctx.strokeStyle = `rgba(255,236,190,${0.6 * (1 - age / 1.2)})`; ctx.lineWidth = 3; ell(ctx, x, y, rr, rr); ctx.stroke(); } });
  const r = rng(o.seed || 5);
  const pos = (i, ring) => { const a = i * 2.39996 + ring, d = Math.sqrt((i + 0.5) / 30) * sR * 0.82; return [Math.cos(a) * d, Math.sin(a) * d]; };
  for (let i = 0; i < (o.patties || 0); i++) { const [x, y] = pos(i * 3 + 1, 0.5); patty(ctx, x * 0.6, y * 0.6, 1.25 * (sR / 260), i, 0.85, 'vien', i + 3); }
  for (let i = 0; i < (o.mieng || 0); i++) { const [x, y] = pos(i * 3 + 2, 2.1); patty(ctx, x * 0.75, y * 0.75, 1.1 * (sR / 260), i * 1.3, 0.85, 'mieng', i + 9); }
  const np = Math.floor(o.papaya || 0), nc = Math.floor(o.carrot || 0);
  for (let i = 0; i < np; i++) { const [x, y] = pos(i, 0); papaya(ctx, x, y, 1.6 * (sR / 260), i * 1.7); }
  for (let i = 0; i < nc; i++) { const [x, y] = pos(i + 13, 1.0); carrot(ctx, x, y, 1.4 * (sR / 260), i); }
  for (let i = 0; i < (o.garlic || 0); i++) { const a = r() * TAU, d = Math.sqrt(r()) * sR * 0.9; garlic(ctx, Math.cos(a) * d, Math.sin(a) * d, 1.2 * (sR / 260)); }
  for (let i = 0; i < (o.chili || 0); i++) { const a = r() * TAU, d = Math.sqrt(r()) * sR * 0.85; chiliRing(ctx, Math.cos(a) * d, Math.sin(a) * d, 1.3 * (sR / 260)); }
  // rim shading
  const sh = ctx.createRadialGradient(0, 0, sR * 0.7, 0, 0, sR); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(60,20,0,0.35)');
  ctx.fillStyle = sh; ell(ctx, 0, 0, sR, sR); ctx.fill();
}
// side-view sauce bowl using river.bowl; o: {k, patties, papaya, carrot, chili, level, rot}
function sauceBowl(ctx, x, y, s, o = {}) {
  R.bowl(ctx, x, y, s, {
    k: o.k === undefined ? 0.32 : o.k, rot: o.rot || 0,
    fill: (c, ty, rx, ry) => {
      const lv = o.level === undefined ? 1 : o.level;
      const yy = ty + 30 * (1 - lv);
      ell(c, 0, yy, rx, ry); const g = c.createRadialGradient(-rx * 0.3, yy - 10, 6, 0, yy, rx); g.addColorStop(0, '#f6c272'); g.addColorStop(1, '#a8561a'); c.fillStyle = g; c.fill();
      const r = rng(o.seed || 3);
      for (let i = 0; i < (o.papaya || 0); i++) papaya(c, (r() - 0.5) * rx * 1.6, yy + (r() - 0.5) * ry * 1.3, 1.1, r() * 3);
      for (let i = 0; i < (o.carrot || 0); i++) carrot(c, (r() - 0.5) * rx * 1.5, yy + (r() - 0.5) * ry * 1.2, 1.0, r() * 3);
      for (let i = 0; i < (o.chili || 0); i++) chiliRing(c, (r() - 0.5) * rx * 1.5, yy + (r() - 0.5) * ry * 1.2, 0.9);
      for (let i = 0; i < (o.patties || 0); i++) pattySide(c, -rx * 0.55 + i * rx * 0.5, yy - 6 + (i % 2) * 10, 0.95, (i - 1) * 0.15, 0.9, i % 2 ? 'mieng' : 'vien');
      c.save(); c.globalCompositeOperation = 'screen'; ell(c, -rx * 0.35, yy - ry * 0.3, rx * 0.25, ry * 0.15); c.fillStyle = 'rgba(255,235,180,0.3)'; c.fill(); c.restore();
    },
  });
}

// ---------------- bún ----------------
function bunNest(ctx, x, y, s, seed = 1, rx = 70, ry = 46) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.save(); ctx.filter = 'blur(6px)'; ell(ctx, 4, 8, rx, ry); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 0, rx, ry); ctx.fillStyle = '#ece6d6'; ctx.fill();
    const r = rng(seed); ctx.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.8, cx = Math.cos(a) * d * rx, cy = Math.sin(a) * d * ry, lr = 10 + r() * 18;
      ctx.strokeStyle = i % 3 ? '#fffdf6' : '#d9d2bf'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(cx, cy, lr, lr * 0.55, r() * 3, r() * 3, r() * 3 + 3.6); ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ell(ctx, -rx * 0.3, -ry * 0.35, rx * 0.35, ry * 0.2); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); ctx.restore();
  });
}
// white plate top-down (k = 1) or 3/4 (k < 1)
function plate(ctx, x, y, R, k = 1, fillFn) {
  at(ctx, x, y, 0, 1, k, () => {
    ctx.save(); ctx.filter = 'blur(16px)'; ell(ctx, 14, 24, R, R); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 0, R, R); const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 10, 0, 0, R); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d4cfc6'); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#2f5a9a'; ell(ctx, 0, 0, R * 0.93, R * 0.93); ctx.stroke();
    ell(ctx, 0, 0, R * 0.78, R * 0.78); ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fill();
  });
  if (fillFn) at(ctx, x, y, 0, 1, 1, () => fillFn(ctx));
}
function bunPlate(ctx, x, y, R, k = 1) {
  plate(ctx, x, y, R, k, (c) => {
    const n = [[-0.32, -0.25], [0.3, -0.28], [-0.36, 0.25], [0.28, 0.24], [0, 0]];
    n.forEach(([u, v], i) => bunNest(c, u * R, v * R * k, R / 260, 30 + i, 80, 54 * Math.max(0.6, k)));
  });
}

// ---------------- hand fan (quạt nan) ----------------
// origin = bottom of the handle; fan extends toward -y. turn = cos-like squash for perspective
function fan(ctx, x, y, s, rot, turn = 1) {
  at(ctx, x, y, rot, s * (Math.abs(turn) < 0.08 ? 0.08 * Math.sign(turn || 1) : turn), s, () => {
    ctx.fillStyle = '#8a5a2a'; ctx.beginPath(); ctx.roundRect(-9, -150, 18, 150, 8); ctx.fill();
    ctx.fillStyle = '#5a3a18'; ctx.fillRect(-10, -40, 20, 6); ctx.fillRect(-10, -60, 20, 6);
    ctx.beginPath(); ctx.moveTo(0, -130); ctx.bezierCurveTo(-170, -150, -170, -360, 0, -380); ctx.bezierCurveTo(170, -360, 170, -150, 0, -130); ctx.closePath();
    const g = ctx.createRadialGradient(-30, -280, 10, 0, -260, 180); g.addColorStop(0, '#f2dca0'); g.addColorStop(1, '#b88a48'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(110,70,30,0.45)'; ctx.lineWidth = 3;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(0, -130); ctx.lineTo(i * 20, -400); ctx.stroke(); }
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(110,70,30,0.3)';
    for (let rr = 40; rr < 260; rr += 18) { ctx.beginPath(); ctx.arc(0, -130, rr, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    ctx.fillStyle = 'rgba(180,40,30,0.75)'; ctx.beginPath(); ctx.arc(0, -270, 30, 0, TAU); ctx.fill(); // red stamp
    ctx.restore();
    ctx.lineWidth = 10; ctx.strokeStyle = '#7a4a20'; ctx.beginPath(); ctx.moveTo(0, -130); ctx.bezierCurveTo(-170, -150, -170, -360, 0, -380); ctx.bezierCurveTo(170, -360, 170, -150, 0, -130); ctx.stroke();
  });
}

// ---------------- stacked bowls (side view) ----------------
function bowlStack(ctx, x, y, s, n, pop = 1) {
  for (let i = 0; i < n; i++) {
    const k = i === n - 1 ? pop : 1;
    const yy = y - i * 46 * s - (1 - k) * 220 * s;
    R.bowl(ctx, x + (i % 2 ? 6 : -4) * s, yy, s, { k: 0.3, fill: (c, ty, rx, ry) => { ell(c, 0, ty + 18, rx * 0.7, ry * 0.5); c.fillStyle = 'rgba(200,120,50,0.55)'; c.fill(); } });
  }
}

// ---------------- CTA ----------------
function heartPath(ctx, s) {
  ctx.beginPath(); ctx.moveTo(0, 30 * s);
  ctx.bezierCurveTo(-60 * s, -10 * s, -40 * s, -60 * s, 0, -32 * s);
  ctx.bezierCurveTo(40 * s, -60 * s, 60 * s, -10 * s, 0, 30 * s); ctx.closePath();
}
function checkPath(ctx, x, y, s) { ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.lineTo(x - 4 * s, y + 10 * s); ctx.lineTo(x + 16 * s, y - 12 * s); }

module.exports = {
  LAN_SHIRT, LAN_SHIRT_D, LAN_SKIN, smoke, embers, flames, smokeRibbon, smokeHand, brazier, brazierTop, grill, GW, GH, patty, pattySide,
  rawBelly, rawSlice, knife, mince, minceTop, bowlTop, SAUCE, papaya, carrot, garlic, chiliRing, sauceTop, sauceBowl, bunNest, plate, bunPlate,
  fan, bowlStack, heartPath, checkPath,
};
