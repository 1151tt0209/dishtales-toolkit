// Bún đậu mắm tôm props (Hanoi): mẹt, banana leaf, tofu, chả cốm, boiled pork, bún lá, herbs, shrimp-paste bowl, chopsticks.
const L = require('./lib');
const P = require('./props');
const { TAU, rng, clamp, lerp, at } = L;
const { ell } = P;

// ---------- mẹt (round flat bamboo tray), top-down; origin = centre ----------
function me(ctx, x, y, s, R = 420, fillFn, k = 1) {
  at(ctx, x, y, 0, s, s * k, () => {
    ctx.save(); ctx.filter = 'blur(18px)'; ell(ctx, 16, 26, R * 1.02, R * 1.02); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 0, R, R); ctx.fillStyle = '#c99a5a'; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, R, R); ctx.clip();
    ctx.strokeStyle = 'rgba(110,70,30,0.4)'; ctx.lineWidth = 3;
    for (let i = -R; i < R; i += 16) { ctx.beginPath(); ctx.moveTo(i, -R); ctx.lineTo(i, R); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,230,180,0.25)'; for (let i = -R; i < R; i += 16) { ctx.beginPath(); ctx.moveTo(-R, i); ctx.lineTo(R, i); ctx.stroke(); }
    if (fillFn) fillFn(ctx);
    ctx.restore();
    ctx.lineWidth = 22; ctx.strokeStyle = '#8a5e2a'; ell(ctx, 0, 0, R - 8, R - 8); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,225,170,0.55)'; ell(ctx, 0, 0, R - 16, R - 16); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,35,10,0.6)'; for (let a = 0; a < TAU; a += 0.12) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - 18), Math.sin(a) * (R - 18)); ctx.lineTo(Math.cos(a + 0.05) * (R + 2), Math.sin(a + 0.05) * (R + 2)); ctx.stroke(); }
  });
}
// banana leaf lining (top-down), unfurl 0..1 (scales from one edge)
function bananaLeaf(ctx, x, y, s, rot, unfurl = 1, w = 760, h = 560) {
  if (unfurl <= 0) return;
  at(ctx, x, y, rot, s * unfurl, s, () => {
    ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.bezierCurveTo(-w / 2, -h * 0.55, w / 2, -h * 0.55, w / 2, 0); ctx.bezierCurveTo(w / 2, h * 0.55, -w / 2, h * 0.55, -w / 2, 0);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#5fae4a'); g.addColorStop(0.5, '#3f8f3a'); g.addColorStop(1, '#2f6f2c');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(220,255,190,0.35)'; ctx.lineWidth = 2;
    for (let i = -w / 2; i < w / 2; i += 14) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - 40, -h / 2); ctx.moveTo(i, 0); ctx.lineTo(i - 40, h / 2); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = '#c9e29a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
  });
}
// ---------- fried tofu cube (¾ view). gold 0..1 (raw→golden), cut: show white inside on the front ----------
function tofu(ctx, x, y, s, rot = 0, o = {}) {
  const gold = o.gold === undefined ? 1 : o.gold;
  const top = mix('#f4ead2', '#e8a53a', gold), side = mix('#e9dcbc', '#c9781e', gold), side2 = mix('#ddcfae', '#a85a14', gold);
  at(ctx, x, y, rot, s, s, () => {
    const a = 40, d = 22;
    ctx.fillStyle = side2; ctx.beginPath(); ctx.moveTo(a, -a); ctx.lineTo(a + d, -a - d); ctx.lineTo(a + d, a - d); ctx.lineTo(a, a); ctx.closePath(); ctx.fill();
    ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(-a, -a); ctx.lineTo(-a + d, -a - d); ctx.lineTo(a + d, -a - d); ctx.lineTo(a, -a); ctx.closePath(); ctx.fill();
    if (o.cut) {
      ctx.fillStyle = '#fbf6e8'; ctx.beginPath(); ctx.roundRect(-a, -a, 2 * a, 2 * a, 4); ctx.fill();
      ctx.fillStyle = 'rgba(220,200,160,0.5)'; const r = rng(3); for (let i = 0; i < 26; i++) { ell(ctx, -a + 6 + r() * (2 * a - 12), -a + 6 + r() * (2 * a - 12), 2.5, 2); ctx.fill(); }
      ctx.strokeStyle = top; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-a, -a, 2 * a, 2 * a, 4); ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(-a, -a, a, a); g.addColorStop(0, top); g.addColorStop(1, side);
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-a, -a, 2 * a, 2 * a, 6); ctx.fill();
      if (gold > 0.4) { const r = rng(7); ctx.fillStyle = `rgba(255,240,180,${0.5 * gold})`; for (let i = 0; i < 18; i++) { ell(ctx, -a + r() * 2 * a, -a + r() * 2 * a, 2 + r() * 3, 1.5 + r() * 2); ctx.fill(); } ctx.fillStyle = `rgba(140,60,10,${0.35 * gold})`; for (let i = 0; i < 14; i++) { ell(ctx, -a + r() * 2 * a, -a + r() * 2 * a, 1.5 + r() * 2, 1.5); ctx.fill(); } }
    }
  });
}
function mix(a, b, t) { const p = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t)).toString(16).padStart(2, '0')).join(''); }
// ---------- chả cốm (green rice patty) top-ish view; fry 0..1 ----------
function chaCom(ctx, x, y, s, rot = 0, fry = 1) {
  at(ctx, x, y, rot, s, s, () => {
    ell(ctx, 0, 4, 46, 30); ctx.fillStyle = mix('#5a7a2a', '#5a3a14', fry); ctx.fill();
    ell(ctx, 0, 0, 44, 28); const g = ctx.createRadialGradient(-10, -8, 4, 0, 0, 46); g.addColorStop(0, '#a9c95a'); g.addColorStop(0.7, mix('#7aa83a', '#8a6a24', fry * 0.7)); g.addColorStop(1, mix('#6a8a2a', '#6a3a10', fry)); ctx.fillStyle = g; ctx.fill();
    const r = rng(11); ctx.fillStyle = 'rgba(220,240,160,0.6)'; for (let i = 0; i < 20; i++) { ell(ctx, (r() - 0.5) * 70, (r() - 0.5) * 40, 3, 2); ctx.fill(); }
  });
}
// ---------- boiled pork: slab (side) and slice ----------
function porkSlab(ctx, x, y, s, w = 420) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = '#c98a6a'; ctx.beginPath(); ctx.roundRect(-w / 2, -110, w, 16, 6); ctx.fill(); // skin
    ctx.fillStyle = '#f6efe2'; ctx.fillRect(-w / 2, -96, w, 30); // fat
    ctx.fillStyle = '#e8b4a4'; ctx.fillRect(-w / 2, -66, w, 34); // lean
    ctx.fillStyle = '#f6efe2'; ctx.fillRect(-w / 2, -32, w, 12);
    ctx.fillStyle = '#d99a8a'; ctx.fillRect(-w / 2, -20, w, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-w / 2, -96, w, 6);
  });
}
function porkSlice(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-50, -14); ctx.quadraticCurveTo(0, -24, 50, -14); ctx.lineTo(48, 16); ctx.quadraticCurveTo(0, 22, -48, 16); ctx.closePath();
    const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, '#c98a6a'); g.addColorStop(0.15, '#f6efe2'); g.addColorStop(0.45, '#f6efe2'); g.addColorStop(0.5, '#e8b4a4'); g.addColorStop(0.8, '#e8b4a4'); g.addColorStop(0.85, '#f6efe2'); g.addColorStop(1, '#d99a8a');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(150,80,60,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  });
}
// ---------- bún lá (pressed vermicelli square), top view ----------
function bunLa(ctx, x, y, s, rot = 0, w = 90, h = 90) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = '#f7f3ea'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(200,190,170,0.6)'; ctx.lineWidth = 1.5;
    const r = rng((w * 3 + h) | 0);
    for (let i = 0; i < w * 0.6; i++) { const yy = -h / 2 + r() * h; ctx.beginPath(); ctx.moveTo(-w / 2, yy); ctx.bezierCurveTo(-w / 6, yy + (r() - 0.5) * 12, w / 6, yy + (r() - 0.5) * 12, w / 2, yy + (r() - 0.5) * 8); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(160,150,130,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 6); ctx.stroke();
  });
}
// ---------- herbs ----------
function herbLeaf(ctx, x, y, s, rot, kind = 'kinhgioi') {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.bezierCurveTo(-14, -18, 14, -18, 26, 0); ctx.bezierCurveTo(14, 18, -14, 18, -26, 0);
    if (kind === 'tiato') { const g = ctx.createLinearGradient(0, -18, 0, 18); g.addColorStop(0, '#7a3a7a'); g.addColorStop(1, '#4f6a2a'); ctx.fillStyle = g; }
    else if (kind === 'xalach') ctx.fillStyle = '#8fd060';
    else { const g = ctx.createLinearGradient(0, -18, 0, 18); g.addColorStop(0, '#4f9a3a'); g.addColorStop(1, '#6a4a6a'); ctx.fillStyle = g; }
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,255,210,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke();
    // serrated edge hint
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; for (let i = -20; i <= 20; i += 8) { ctx.beginPath(); ctx.moveTo(i, -12 + Math.abs(i) * 0.3); ctx.lineTo(i + 3, -15 + Math.abs(i) * 0.3); ctx.stroke(); }
  });
}
function cucumber(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ell(ctx, 0, 0, 30, 22); ctx.fillStyle = '#2f6a2a'; ctx.fill();
    ell(ctx, 0, 0, 26, 18); ctx.fillStyle = '#d9eeb0'; ctx.fill();
    ell(ctx, 0, 0, 14, 9); ctx.fillStyle = '#c2dc8a'; ctx.fill();
    ctx.fillStyle = '#f4f8e0'; for (let i = 0; i < 6; i++) { ell(ctx, Math.cos(i) * 8, Math.sin(i) * 5, 2, 1.4); ctx.fill(); }
  });
}
// ---------- small ceramic dipping bowl with mắm tôm (¾ view). origin = foot centre ----------
// o: {fill 0..1, foam 0..1, chili n, lime bool, k, splash}
const PASTE = ['#b48ab8', '#7a4a80'];
function mamBowl(ctx, x, y, s, o = {}) {
  const k = o.k === undefined ? 0.4 : o.k, R = 110, hgt = 70;
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ctx.save(); ctx.filter = 'blur(8px)'; ell(ctx, 0, 4, R * 0.8, R * k * 0.5); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.restore();
    const top = -hgt;
    ctx.beginPath(); ctx.moveTo(-R, top); ctx.bezierCurveTo(-R, top + 50, -45, -4, -35, 0); ctx.lineTo(35, 0); ctx.bezierCurveTo(45, -4, R, top + 50, R, top);
    ctx.ellipse(0, top, R, R * k, 0, 0, Math.PI, false); ctx.closePath();
    const g = ctx.createLinearGradient(-R, 0, R, 0); g.addColorStop(0, '#c9c6bd'); g.addColorStop(0.3, '#fdfbf5'); g.addColorStop(1, '#a9a69c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2f5a9a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, top + 18, R * 0.94, R * k * 0.94, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    ell(ctx, 0, top, R, R * k); ctx.fillStyle = '#f4f1ea'; ctx.fill();
    ctx.save(); ell(ctx, 0, top, R - 7, (R - 7) * k); ctx.clip();
    ctx.fillStyle = '#e6e1d6'; ctx.fillRect(-R, top - R, 2 * R, 2 * R);
    const f = o.fill === undefined ? 1 : o.fill;
    if (f > 0) {
      const ly = top + 8 + (1 - f) * 20;
      ell(ctx, 0, ly, (R - 8) * (0.6 + 0.4 * f), (R - 8) * k * (0.6 + 0.4 * f));
      const pg = ctx.createRadialGradient(-30, ly - 10, 4, 0, ly, R); pg.addColorStop(0, PASTE[0]); pg.addColorStop(1, PASTE[1]); ctx.fillStyle = pg; ctx.fill();
      const fo = o.foam || 0;
      if (fo > 0) {
        const r = rng(21);
        for (let i = 0; i < 90 * fo; i++) { const a = r() * TAU, d = Math.sqrt(r()) * (R - 14); ell(ctx, Math.cos(a) * d, ly + Math.sin(a) * d * k - fo * 6, 3 + r() * 5 * fo, 2 + r() * 3 * fo); ctx.fillStyle = r() < 0.5 ? 'rgba(235,215,240,0.9)' : 'rgba(205,170,215,0.9)'; ctx.fill(); }
      }
      if (o.chili) { const r = rng(5); for (let i = 0; i < o.chili; i++) { ell(ctx, (r() - 0.5) * R, ly + (r() - 0.5) * R * k, 7, 7); ctx.fillStyle = '#d42a1e'; ctx.fill(); ell(ctx, (r() - 0.5) * 0, ly, 0.1, 0.1); } }
    }
    ctx.restore();
    ell(ctx, 0, top, R, R * k); ctx.lineWidth = 3; ctx.strokeStyle = '#2f5a9a'; ctx.stroke();
    if (o.lime) at(ctx, R * 0.75, top - 6, 0.4, 1, 1, () => { ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#5aa02c'; ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, 21, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#d6ec8a'; ctx.fill(); });
  });
}
// purple paste splats (for the comic splash)
function splat(ctx, x, y, s, seed, a = 1) {
  const r = rng(seed);
  ctx.save(); ctx.globalAlpha = a;
  at(ctx, x, y, r() * TAU, s, s, () => {
    ctx.fillStyle = PASTE[1]; ctx.beginPath();
    for (let i = 0; i <= 14; i++) { const ang = i / 14 * TAU, rr = 18 + r() * 14 + (i % 3 === 0 ? 10 : 0); i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = PASTE[0]; ell(ctx, -6, -6, 10, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, -9, -9, 3, 2); ctx.fill();
  });
  ctx.restore();
}
function chopsticks(ctx, x, y, s, rot = 0, spread = 0.06) {
  at(ctx, x, y, rot, s, s, () => {
    for (const d of [-spread, spread]) at(ctx, 0, 0, d, 1, 1, () => {
      const g = ctx.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, '#e2c08a'); g.addColorStop(1, '#a8763e');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(420, -6); ctx.lineTo(420, 6); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
    });
  });
}
// cutting board (side-ish, top surface ellipse) – just a wide wooden plank
function board(ctx, y, x0 = -100, w = 1280, h = 700) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#b07a42'); g.addColorStop(1, '#5a3618');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, y, w, h, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.3)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(x0, y + 30 + i * 45); ctx.bezierCurveTo(x0 + w * 0.3, y + 20 + i * 47, x0 + w * 0.6, y + 40 + i * 43, x0 + w, y + 30 + i * 46); ctx.stroke(); }
}
function cleaver(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(-90, 0, 90, 0); g.addColorStop(0, '#6a6e72'); g.addColorStop(0.3, '#f2f2ee'); g.addColorStop(1, '#5a5e62');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-110, -170, 200, 170, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-106, -10, 192, 4);
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.roundRect(-30, -390, 46, 220, 16); ctx.fill();
  });
}

module.exports = { me, bananaLeaf, tofu, chaCom, porkSlab, porkSlice, bunLa, herbLeaf, cucumber, mamBowl, splat, chopsticks, board, cleaver, mix, PASTE };
