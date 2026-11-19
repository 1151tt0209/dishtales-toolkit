// Shared helpers: math, easing, camera, bread/filling drawing, particles, light FX.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const W = 1080, H = 1920, BAR = 0; // vertical 9:16 Shorts frame
const TAU = Math.PI * 2;

GlobalFonts.registerFromPath('C:/Windows/Fonts/georgiab.ttf', 'TitleSerif');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeui.ttf', 'BodySans');
GlobalFonts.registerFromPath('C:/Windows/Fonts/segoeuib.ttf', 'BodySansBold');

// ---------- math ----------
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const ease = {
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  in2: t => t * t,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  sine: t => 0.5 - 0.5 * Math.cos(Math.PI * t),
};
const wobble = (t, s = 0) => (Math.sin(t * 1.7 + s) + Math.sin(t * 3.1 + 1 + s * 2) * 0.6 + Math.sin(t * 7.3 + 2 + s * 3) * 0.3) / 1.9;

// camera: world point (cx,cy) appears at screen centre, scaled by zoom
function cam(ctx, cx, cy, zoom, rot, fn) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (rot) ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
  fn();
  ctx.restore();
}
function at(ctx, x, y, rot, sx, sy, fn) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (sx !== undefined) ctx.scale(sx, sy === undefined ? sx : sy);
  fn();
  ctx.restore();
}

// offscreen buffers (reused)
const buffers = {};
function buffer(name) {
  if (!buffers[name]) buffers[name] = createCanvas(W, H);
  const c = buffers[name];
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
  x.clearRect(0, 0, W, H);
  return [c, x];
}
// horizontal motion blur of a full-frame scene
function motionBlurX(ctx, dx, n, drawFn) {
  const [c, x] = buffer('mb');
  drawFn(x);
  if (Math.abs(dx) < 1) { ctx.drawImage(c, 0, 0); return; }
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = i === 0 ? 1 : 1 / (i + 1);
    ctx.drawImage(c, (i / (n - 1) - 0.5) * dx, 0);
  }
  ctx.restore();
}

// ---------- light & particles ----------
function glow(ctx, x, y, r, color, alpha = 1, mode = 'screen') {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
function flare(ctx, x, y, s, alpha = 1) {
  glow(ctx, x, y, 220 * s, 'rgba(255,200,120,0.9)', alpha);
  glow(ctx, x, y, 60 * s, 'rgba(255,250,230,1)', alpha);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha * 0.8;
  ctx.translate(x, y); ctx.scale(1, 0.018);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1100 * s);
  g.addColorStop(0, 'rgba(160,220,255,0.9)');
  g.addColorStop(0.4, 'rgba(90,160,255,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(-1100 * s, -1100 * s, 2200 * s, 2200 * s);
  ctx.restore();
  // ghost orbs toward centre
  for (let i = 1; i <= 3; i++) {
    const gx = lerp(x, W / 2, 0.5 + i * 0.35), gy = lerp(y, H / 2, 0.5 + i * 0.35);
    glow(ctx, gx, gy, 30 * s * i, 'rgba(120,200,255,0.18)', alpha);
  }
}
function godRays(ctx, x, y, angle, spread, len, n, color, alpha, t = 0) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const a = angle + (i / (n - 1) - 0.5) * spread;
    const w = 0.025 + 0.02 * Math.sin(i * 3.7 + t * 0.8);
    ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.sin(i * 2.3 + t * 1.3));
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len);
    ctx.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// drifting dust (deterministic in time)
function dust(ctx, t, seed, n, x0, y0, w, h, color = '255,230,180', size = 3, alpha = 0.8) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const bx = r() * w, by = r() * h, sp = 8 + r() * 30, ph = r() * TAU, s = 0.4 + r() * 1;
    const x = x0 + ((bx + Math.sin(t * 0.7 + ph) * 25 + t * sp) % w);
    const y = y0 + ((by - t * sp * 0.6 + h * 10) % h);
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + ph);
    ctx.globalAlpha = alpha * tw;
    ctx.fillStyle = `rgba(${color},1)`;
    ctx.beginPath(); ctx.arc(x, y, size * s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function bokeh(ctx, t, seed, n, colors, alpha = 0.35, rmin = 20, rmax = 90) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const x = r() * W + Math.sin(t * 0.3 + i) * 30, y = BAR + r() * (H - 2 * BAR) + Math.cos(t * 0.25 + i) * 20;
    const rad = rmin + r() * (rmax - rmin);
    const col = colors[Math.floor(r() * colors.length)];
    ctx.globalAlpha = alpha * (0.4 + 0.6 * r());
    const g = ctx.createRadialGradient(x, y, rad * 0.7, x, y, rad);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function steam(ctx, t, seed, x, y, w, h, n = 10, alpha = 0.35) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.35 + r() * 0.3, bx = (r() - 0.5) * w, rad = 40 + r() * 70;
    const life = (t * sp + ph) % 1;
    const yy = y - life * h;
    const xx = x + bx + Math.sin(t * 1.3 + i * 1.7) * 30 * life;
    ctx.globalAlpha = alpha * Math.sin(life * Math.PI);
    const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, rad * (0.6 + life));
    g.addColorStop(0, 'rgba(255,245,230,0.8)'); g.addColorStop(1, 'rgba(255,245,230,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, rad * (0.6 + life), 0, TAU); ctx.fill();
  }
  ctx.restore();
}
// burst of flakes from (x,y) at time t0; ballistic, deterministic
function flakes(ctx, t, t0, seed, n, x, y, o = {}) {
  const age = t - t0;
  if (age < 0) return;
  const r = rng(seed);
  const g = o.g === undefined ? 900 : o.g, sp = o.speed || 500, life = o.life || 1.2;
  const cols = o.colors || ['#3b2416', '#5a3a22', '#2a170c', '#7a5236'];
  const slow = o.slow || 1;
  for (let i = 0; i < n; i++) {
    const a = (o.angle === undefined ? -Math.PI / 2 : o.angle) + (r() - 0.5) * (o.spread || 2.4);
    const v = sp * (0.35 + r() * 0.8), s = (o.size || 7) * (0.4 + r());
    const delay = r() * (o.stagger || 0);
    const at_ = (age - delay) * slow;
    if (at_ < 0 || at_ > life) { r(); r(); continue; }
    const px = x + Math.cos(a) * v * at_;
    const py = y + Math.sin(a) * v * at_ + 0.5 * g * at_ * at_;
    const rot = r() * TAU + at_ * (r() - 0.5) * 12;
    ctx.save();
    ctx.globalAlpha = 1 - Math.pow(at_ / life, 3);
    ctx.translate(px, py); ctx.rotate(rot);
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath(); ctx.moveTo(-s, -s * 0.5); ctx.lineTo(s * 0.8, -s * 0.7); ctx.lineTo(s, s * 0.4); ctx.lineTo(-s * 0.4, s * 0.7); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function sparkle(ctx, x, y, s, alpha) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255,255,255,1)';
  for (const [sx, sy] of [[1, 0.06], [0.06, 1]]) {
    ctx.beginPath(); ctx.ellipse(x, y, s * sx, s * sy, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  glow(ctx, x, y, s * 0.6, 'rgba(255,255,240,0.9)', alpha);
}

module.exports = {
  W, H, BAR, TAU, rng, clamp, lerp, inv, ease, wobble, cam, at, buffer, motionBlurX,
  glow, flare, godRays, dust, bokeh, steam, flakes, sparkle, createCanvas,
};
