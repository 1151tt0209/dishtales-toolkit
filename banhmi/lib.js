// Shared helpers: math, easing, camera, bread/filling drawing, particles, light FX.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const W = 1920, H = 1080, BAR = 138; // 2.39:1 letterbox inside 1080p
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

// ---------- palette ----------
const C = {
  crustHi: '#f6cf86', crustL: '#eaa64a', crustM: '#c4732a', crustD: '#7a3d12', crustDD: '#3d1c07',
  crumb: '#f6e8cb', crumbD: '#e3caa0',
  pate: '#8a5536', pateD: '#5e3420',
  butter: '#f2c94c', butterL: '#fbe6a0',
  cha: '#ebcdb6', chaD: '#cfa385', chaRim: '#9f6e45',
  ham: '#ef9a98', hamD: '#d7686a', hamFat: '#fbe3dc',
  xs: '#d9876a', xsRed: '#b3242a', xsDark: '#6e0d10',
  cuke: '#2f6b2a', cukeL: '#5f9a3e', cukeFlesh: '#d9efb4',
  carrot: '#f28a26', daikon: '#f5f0e2',
  herb: '#3f8f3a', herbL: '#79c25f',
  chili: '#e0261f', chiliL: '#ff5a40', chiliD: '#8a0d0a', seed: '#f6d36b',
  soy: '#2a120a',
};

// ---------- crumb pores ----------
const poreSets = {};
function pores(key, n, w, h, seed) {
  if (!poreSets[key]) {
    const r = rng(seed);
    const arr = [];
    for (let i = 0; i < n; i++) arr.push({ x: (r() - 0.5) * w, y: (r() - 0.5) * h, rx: 2 + r() * 9, ry: 1.5 + r() * 5, a: r() * TAU, s: r() });
    poreSets[key] = arr;
  }
  return poreSets[key];
}
function drawPores(ctx, list, scale = 1) {
  for (const p of list) {
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx * scale, p.ry * scale, p.a, 0, TAU);
    ctx.fillStyle = p.s > 0.5 ? 'rgba(170,125,70,0.30)' : 'rgba(150,105,55,0.22)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x + 1.2 * scale, p.y + 1.2 * scale, p.rx * 0.6 * scale, p.ry * 0.5 * scale, p.a, 0, TAU);
    ctx.fillStyle = 'rgba(255,250,235,0.35)';
    ctx.fill();
  }
}

// ---------- baguette (side view) ----------
function bagProfile(L, T, n = 80) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const u = -1 + (2 * i) / n;
    const a = Math.abs(u);
    const ft = Math.pow(Math.max(0, 1 - Math.pow(a, 3.2)), 0.55);
    const fb = Math.pow(Math.max(0, 1 - Math.pow(a, 5)), 0.4);
    top.push([u * L / 2, -T * 0.56 * ft]);
    bot.push([u * L / 2, T * 0.44 * fb]);
  }
  return { top, bot };
}
function bagPath(ctx, L, T) {
  const { top, bot } = bagProfile(L, T);
  ctx.beginPath();
  ctx.moveTo(top[0][0], 0);
  for (const p of top) ctx.lineTo(p[0], p[1]);
  for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath();
}
function crustFill(ctx, L, T) {
  const g = ctx.createLinearGradient(0, -T * 0.56, 0, T * 0.44);
  g.addColorStop(0, C.crustHi);
  g.addColorStop(0.22, C.crustL);
  g.addColorStop(0.6, C.crustM);
  g.addColorStop(1, C.crustD);
  ctx.fillStyle = g;
  ctx.fill();
  // darker toasted ends
  const e = ctx.createLinearGradient(-L / 2, 0, L / 2, 0);
  e.addColorStop(0, 'rgba(90,40,10,0.55)');
  e.addColorStop(0.12, 'rgba(90,40,10,0)');
  e.addColorStop(0.88, 'rgba(90,40,10,0)');
  e.addColorStop(1, 'rgba(90,40,10,0.55)');
  ctx.fillStyle = e;
  ctx.fill();
}
const speckCache = {};
function crustSpecks(ctx, L, T) {
  const key = L + 'x' + T;
  if (!speckCache[key]) {
    const r = rng(77), arr = [];
    for (let i = 0; i < 140; i++) arr.push([(r() - 0.5) * L * 0.92, (r() - 0.6) * T * 0.8, 1 + r() * 2.5, r()]);
    speckCache[key] = arr;
  }
  for (const s of speckCache[key]) {
    ctx.fillStyle = s[3] > 0.5 ? 'rgba(110,50,15,0.35)' : 'rgba(255,230,170,0.35)';
    ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, TAU); ctx.fill();
  }
}
function scoring(ctx, L, T, n = 5) {
  for (let i = 0; i < n; i++) {
    const u = -0.62 + (1.24 * i) / (n - 1);
    const x = u * L / 2, y = -T * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.38);
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.075, T * 0.07, 0, 0, TAU);
    const g = ctx.createLinearGradient(0, -T * 0.07, 0, T * 0.07);
    g.addColorStop(0, '#fbe2a8'); g.addColorStop(1, '#e7ad5c');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(120,55,15,0.55)'; ctx.stroke();
    ctx.restore();
  }
}
function crustShine(ctx, L, T) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createLinearGradient(0, -T * 0.55, 0, -T * 0.2);
  g.addColorStop(0, 'rgba(255,240,200,0.55)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -T * 0.4, L * 0.42, T * 0.1, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
// closed whole baguette
function drawBaguette(ctx, x, y, L, T, rot = 0) {
  at(ctx, x, y, rot, undefined, undefined, () => {
    // contact shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.filter = 'blur(14px)';
    ctx.beginPath(); ctx.ellipse(0, T * 0.5, L * 0.48, T * 0.12, 0, 0, TAU); ctx.fill();
    ctx.restore();
    bagPath(ctx, L, T); crustFill(ctx, L, T);
    ctx.save(); bagPath(ctx, L, T); ctx.clip(); crustSpecks(ctx, L, T); ctx.restore();
    scoring(ctx, L, T);
    crustShine(ctx, L, T);
  });
}

// ---------- fillings ----------
// wavy band along x from x0..x1 centred on y, thickness h
function band(ctx, x0, x1, y, h, seed, amp = 6, freq = 0.02) {
  const n = 40;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    ctx.lineTo(x, y - h / 2 + Math.sin(x * freq + seed) * amp);
  }
  for (let i = n; i >= 0; i--) {
    const x = lerp(x0, x1, i / n);
    ctx.lineTo(x, y + h / 2 + Math.sin(x * freq * 1.3 + seed * 2) * amp * 0.7);
  }
  ctx.closePath();
}
function fillGrad(ctx, y, h, c0, c1) {
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fill();
}
// cilantro leaf at origin, size s
function leaf(ctx, s, col0 = C.herbL, col1 = C.herb) {
  ctx.beginPath();
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * TAU;
    const r = s * (0.62 + 0.38 * Math.abs(Math.cos(1.5 * th))) * (1 + 0.07 * Math.sin(11 * th));
    ctx.lineTo(Math.cos(th) * r, Math.sin(th) * r * 0.92 - s * 0.1);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s * 1.1);
  g.addColorStop(0, col0); g.addColorStop(1, col1);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(200,255,170,0.45)'; ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  for (const a of [-Math.PI / 2, -Math.PI / 2 - 1.05, -Math.PI / 2 + 1.05]) { ctx.moveTo(0, s * 0.35); ctx.lineTo(Math.cos(a) * s * 0.75, Math.sin(a) * s * 0.75); }
  ctx.stroke();
  ctx.strokeStyle = '#4c8a34'; ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.quadraticCurveTo(s * 0.1, s * 0.9, -s * 0.05, s * 1.4); ctx.stroke();
}
function chiliRing(ctx, R, spin = 1) {
  ctx.save();
  ctx.scale(Math.max(0.08, Math.abs(spin)), 1);
  // thickness edge
  ctx.beginPath(); ctx.arc(R * 0.06, 0, R, 0, TAU); ctx.fillStyle = C.chiliD; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  g.addColorStop(0, C.chiliL); g.addColorStop(1, C.chili);
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R * 0.64, 0, TAU); ctx.fillStyle = '#4a0c07'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R * 0.56, 0, TAU); ctx.fillStyle = 'rgba(250,215,170,0.35)'; ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9; ctx.beginPath();
    ctx.ellipse(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28, R * 0.1, R * 0.06, a, 0, TAU);
    ctx.fillStyle = C.seed; ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,220,200,0.7)'; ctx.lineWidth = R * 0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, R * 0.85, -2.6, -1.6); ctx.stroke();
  ctx.restore();
}

// Side-view sandwich. opts: n = number of filling layers (0..8), gap (top lift px), top: draw top half,
// bottom: draw bottom half, peek: herb/pickle bits sticking out (closed look)
const LAYERS = ['pate', 'cha', 'ham', 'xs', 'cuke', 'pickle', 'herb', 'chili'];
function drawSandwich(ctx, L, T, o = {}) {
  const n = o.n === undefined ? 8 : o.n;
  const gap = o.gap || 0;
  const split = -T * 0.06;
  const x0 = -L * 0.43, x1 = L * 0.43;
  const drawTop = o.top !== false, drawBot = o.bottom !== false;
  // contact shadow
  if (drawBot && o.shadow !== false) {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.filter = 'blur(16px)';
    ctx.beginPath(); ctx.ellipse(0, T * 0.5, L * 0.48, T * 0.12, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (drawBot) {
    ctx.save();
    ctx.beginPath(); ctx.rect(-L, split, L * 2, T * 2); ctx.clip();
    bagPath(ctx, L, T); crustFill(ctx, L, T);
    ctx.save(); bagPath(ctx, L, T); ctx.clip(); crustSpecks(ctx, L, T); ctx.restore();
    ctx.restore();
    // crumb face
    ctx.beginPath(); ctx.ellipse(0, split, L * 0.47, T * 0.07, 0, 0, TAU);
    ctx.fillStyle = C.crumbD; ctx.fill();
  }
  // fillings stack (grows upward from split)
  let y = split - 2;
  const fill = (name, h, fn) => {
    const i = LAYERS.indexOf(name);
    if (i >= n) return;
    fn(y - h / 2, h);
    y -= h * 0.7;
  };
  if (drawBot || o.fillingsOnly) {
    fill('pate', T * 0.06, (yy, h) => { band(ctx, x0, x1, yy, h, 1, 3); fillGrad(ctx, yy, h, C.pate, C.pateD); });
    fill('cha', T * 0.1, (yy, h) => {
      band(ctx, x0 - 10, x1 + 10, yy, h, 2, 7, 0.03); fillGrad(ctx, yy, h, C.cha, C.chaD);
      ctx.strokeStyle = C.chaRim; ctx.lineWidth = 3; ctx.stroke();
    });
    fill('ham', T * 0.09, (yy, h) => {
      band(ctx, x0 - 30, x1 + 25, yy, h, 3, 9, 0.025); fillGrad(ctx, yy, h, C.ham, C.hamD);
      band(ctx, x0 - 30, x1 + 25, yy - h * 0.42, h * 0.16, 3, 9, 0.025); ctx.fillStyle = C.hamFat; ctx.fill();
    });
    fill('xs', T * 0.1, (yy, h) => {
      for (let k = 0; k < 7; k++) {
        const cx = lerp(x0 + 40, x1 - 40, k / 6);
        ctx.save(); ctx.translate(cx, yy); ctx.rotate(Math.sin(k * 2.1) * 0.12);
        ctx.beginPath(); ctx.roundRect(-L * 0.06, -h / 2, L * 0.12, h, h * 0.3);
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, C.xsRed); g.addColorStop(0.25, C.xs); g.addColorStop(1, '#c46e52');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = C.xsDark; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore();
      }
    });
    fill('cuke', T * 0.06, (yy, h) => {
      for (let k = 0; k < 3; k++) {
        const cx = lerp(x0 + 120, x1 - 120, k / 2);
        ctx.beginPath(); ctx.roundRect(cx - L * 0.14, yy - h / 2, L * 0.28, h, h / 2);
        ctx.fillStyle = C.cukeFlesh; ctx.fill();
        ctx.beginPath(); ctx.roundRect(cx - L * 0.14, yy - h / 2, L * 0.28, h * 0.32, h / 2);
        ctx.fillStyle = C.cuke; ctx.fill();
      }
    });
    fill('pickle', T * 0.08, (yy, h) => {
      const r = rng(5);
      ctx.lineCap = 'round';
      for (let k = 0; k < 70; k++) {
        const cx = lerp(x0, x1, r()), cy = yy + (r() - 0.5) * h * 1.2;
        const a = (r() - 0.5) * 0.9, l = 20 + r() * 50;
        ctx.strokeStyle = r() > 0.45 ? C.carrot : C.daikon; ctx.lineWidth = 3 + r() * 3;
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * l / 2, cy - Math.sin(a) * l / 2); ctx.lineTo(cx + Math.cos(a) * l / 2, cy + Math.sin(a) * l / 2); ctx.stroke();
      }
    });
    fill('herb', T * 0.06, (yy, h) => {
      const r = rng(9);
      for (let k = 0; k < 9; k++) {
        const cx = lerp(x0 + 30, x1 - 30, k / 8) + (r() - 0.5) * 30;
        at(ctx, cx, yy - h * 0.6, (r() - 0.5) * 1.2, 1, 1, () => leaf(ctx, T * (0.07 + r() * 0.04)));
      }
    });
    fill('chili', T * 0.03, (yy) => {
      const r = rng(13);
      for (let k = 0; k < 5; k++) {
        const cx = lerp(x0 + 80, x1 - 80, k / 4) + (r() - 0.5) * 40;
        at(ctx, cx, yy - 6, 0, 1, 1, () => chiliRing(ctx, T * 0.045, 0.35 + r() * 0.3));
      }
    });
  }
  if (drawTop) {
    ctx.save();
    ctx.translate(0, -gap + (o.topBase || 0));
    if (o.topRot) { ctx.translate(-L * 0.45, split); ctx.rotate(o.topRot); ctx.translate(L * 0.45, -split); }
    ctx.save();
    ctx.beginPath(); ctx.rect(-L, -T * 2, L * 2, T * 2 + split); ctx.clip();
    bagPath(ctx, L, T); crustFill(ctx, L, T);
    ctx.save(); bagPath(ctx, L, T); ctx.clip(); crustSpecks(ctx, L, T); ctx.restore();
    ctx.restore();
    scoring(ctx, L, T);
    crustShine(ctx, L, T);
    ctx.restore();
  }
}

// Top-down opened baguette ("like a book"): two halves above/below the hinge line y=0.
function openHalf(ctx, L, T, flip) {
  ctx.save();
  if (flip) ctx.scale(1, -1);
  ctx.beginPath();
  ctx.ellipse(0, T * 0.5, L / 2, T * 0.5, 0, 0, TAU);
  const g = ctx.createLinearGradient(0, 0, 0, T);
  g.addColorStop(0, C.crustM); g.addColorStop(1, C.crustD);
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, T * 0.5, L / 2 - T * 0.12, T * 0.38, 0, 0, TAU);
  const g2 = ctx.createRadialGradient(0, T * 0.5, T * 0.05, 0, T * 0.5, L * 0.5);
  g2.addColorStop(0, '#fbf1da'); g2.addColorStop(1, C.crumbD);
  ctx.fillStyle = g2; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, T * 0.5, L / 2 - T * 0.13, T * 0.37, 0, 0, TAU); ctx.clip();
  ctx.translate(0, T * 0.5);
  drawPores(ctx, pores('open' + L, 260, L, T * 0.8, 21));
  ctx.restore();
  ctx.restore();
}
function drawOpenTop(ctx, L, T, o = {}) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.filter = 'blur(26px)';
  ctx.beginPath(); ctx.ellipse(16, 22, L * 0.52, T * 1.05, 0, 0, TAU); ctx.fill();
  ctx.restore();
  openHalf(ctx, L, T, true);
  openHalf(ctx, L, T, false);
  // hinge shadow
  ctx.fillStyle = 'rgba(90,45,15,0.5)';
  ctx.beginPath(); ctx.ellipse(0, 0, L * 0.47, 6, 0, 0, TAU); ctx.fill();
}
// top-down fillings laid on the lower half (centre y = T*0.5)
function topFillings(ctx, L, T) {
  const cy = T * 0.5;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, cy, L / 2 - T * 0.1, T * 0.4, 0, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.ellipse(0, cy, L * 0.42, T * 0.3, 0, 0, TAU); ctx.fillStyle = C.pate; ctx.fill();
  const r = rng(31);
  for (let k = 0; k < 6; k++) { // cha discs
    const x = lerp(-L * 0.36, L * 0.36, k / 5);
    ctx.beginPath(); ctx.arc(x, cy + (r() - 0.5) * 20, T * 0.27, 0, TAU);
    ctx.fillStyle = C.cha; ctx.fill(); ctx.strokeStyle = C.chaRim; ctx.lineWidth = 4; ctx.stroke();
  }
  for (let k = 0; k < 5; k++) { // ham folds
    const x = lerp(-L * 0.32, L * 0.32, k / 4) + 30;
    ctx.beginPath(); ctx.ellipse(x, cy - 10, T * 0.3, T * 0.18, 0.4, 0, TAU);
    ctx.fillStyle = C.ham; ctx.fill(); ctx.strokeStyle = C.hamFat; ctx.lineWidth = 5; ctx.stroke();
  }
  for (let k = 0; k < 6; k++) { // char siu slices
    const x = lerp(-L * 0.35, L * 0.35, k / 5) - 20;
    at(ctx, x, cy + 22, 0.3 + r() * 0.4, 1, 1, () => {
      ctx.beginPath(); ctx.roundRect(-T * 0.18, -T * 0.11, T * 0.36, T * 0.22, 10);
      ctx.fillStyle = C.xs; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.xsRed; ctx.stroke();
    });
  }
  for (let k = 0; k < 2; k++) { // cucumber spears
    const x = k ? L * 0.15 : -L * 0.17;
    ctx.beginPath(); ctx.roundRect(x - L * 0.17, cy - T * 0.1, L * 0.34, T * 0.12, 20);
    ctx.fillStyle = C.cukeFlesh; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.cuke; ctx.stroke();
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
  const cols = o.colors || [C.crustL, C.crustM, C.crustHi, C.crumb];
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
  W, H, BAR, TAU, C, LAYERS, rng, clamp, lerp, inv, ease, wobble, cam, at, buffer, motionBlurX,
  pores, drawPores, bagProfile, bagPath, crustFill, crustSpecks, scoring, crustShine, drawBaguette,
  band, fillGrad, leaf, chiliRing, drawSandwich, openHalf, drawOpenTop, topFillings,
  glow, flare, godRays, dust, bokeh, steam, flakes, sparkle, createCanvas,
};
