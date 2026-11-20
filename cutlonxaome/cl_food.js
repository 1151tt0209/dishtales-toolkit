// cl_food.js — "Cút lộn xào me" food props (quail balut eggs, tamarind glaze, rau răm, hero plate).
// LOCAL in / LOCAL out. (x,y) = egg CENTRE (plate: plate-centre on the table). Every drawer save()/restore()s. Deterministic (seed).
//   const CL = require('./cl_food');
//
//  cutLon(ctx,x,y,s,{state='whole'|'open'|'fried', rot=0 (rad), seed=1, glaze=1 (fried: 0 pale/ dry … 1 glossy dark), herb=0 (0..1 rau răm bits on top),
//        shadow=true, flip=false, squash=1 (y-scale squash for cartoon jiggle), t=0 (only glints)})
//        s=1 → egg ≈ 78 w × 98 h px, pointy end UP. Use s 2..6 for macros.
//        'whole' speckled cream/brown shell · 'open' top cap removed: jagged shell rim, membrane, pale yolk + dark embryo patch
//        · 'fried' peeled egg coated in glossy amber-brown tamarind glaze with garlic/shallot bits, highlights.
//        → {center:[x,y], top:[x,y], rx, ry}
//  eggCap(ctx,x,y,s,{rot=0,seed=1})  the little broken shell cap (pointy), for the peel animation.
//  ramLeaf(ctx,x,y,s,{rot=0,seed=1}) one rau răm leaf (long, narrow, dark green with a purple-ish centre vein), ~64 × 18 px at s=1.
//  cutLonPlate(ctx,x,y,s,{k=1 (0..1 how many eggs are piled: n·k), n=12, herb=1 (0..1), t=0, steam=1, sauce=1 (puddle of glaze on the plate),
//        shadow=true, seed=3})  white/blue Saigon plate, rx 330·s, ry 150·s (3q view), pyramid of fried eggs + rau răm + steam.
//        → {center:[x,y], top:[x,y] (pile peak), rim:{x,y,rx,ry}, eggs:[[x,y,r]…] (last placed first-listed order = placement order)}
//  eggPos(i,n,seed) → [dx,dy,rot] pile layout used by cutLonPlate, 0-based placement order (bottom layer first) in plate-local units.
const L = require('./lib');
const { rng, TAU, clamp, createCanvas } = L;

const CACHE = new Map();
function cached(key, w, h, draw) {
  let c = CACHE.get(key);
  if (!c) { c = createCanvas(w, h); const x = c.getContext('2d'); draw(x, w, h); CACHE.set(key, c); }
  return c;
}
const bucket = px => px <= 90 ? 160 : px <= 200 ? 320 : 640;   // sprite width buckets

function eggPath(x, rx, ry, pointy = 0.22) { // egg outline, pointy end up
  x.beginPath();
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU, sx = Math.cos(a), sy = Math.sin(a);
    const k = 1 - pointy * (sy < 0 ? -sy : 0) * 0.55; // narrower toward top
    const px = sx * rx * k, py = sy * ry;
    i ? x.lineTo(px, py) : x.moveTo(px, py);
  }
  x.closePath();
}

function drawEgg(x, W, state, seed, glaze, herb) {
  const sc = W / 160, H = W * 1.25;
  x.save(); x.translate(W / 2, H / 2); x.scale(sc, sc);
  const rx = 56, ry = 70, r = rng(seed * 7919 + state.length * 13);
  if (state === 'fried') {
    // glaze body
    const base = x.createRadialGradient(-18, -30, 6, 0, 0, 92);
    const g = glaze;
    base.addColorStop(0, `rgb(${Math.round(200 - 40 * g)},${Math.round(120 - 40 * g)},${Math.round(50 - 14 * g)})`);
    base.addColorStop(0.45, `rgb(${Math.round(176 - 50 * g)},${Math.round(98 - 40 * g)},${Math.round(40 - 12 * g)})`);
    base.addColorStop(1, `rgb(${Math.round(100 - 30 * g)},${Math.round(44 - 16 * g)},${Math.round(18 - 6 * g)})`);
    eggPath(x, rx, ry, 0.12); x.fillStyle = base; x.fill();
    // lumps (shallot / garlic bits, chilli flakes)
    x.save(); eggPath(x, rx, ry, 0.12); x.clip();
    for (let i = 0; i < 11; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.85, px = Math.cos(a) * rx * d, py = Math.sin(a) * ry * d;
      const kind = r();
      x.save(); x.translate(px, py); x.rotate(r() * TAU);
      if (kind < 0.5) { x.fillStyle = `rgba(240,200,110,${0.55 + r() * 0.3})`; x.beginPath(); x.ellipse(0, 0, 7 + r() * 6, 3 + r() * 2, 0, 0, TAU); x.fill(); }
      else if (kind < 0.8) { x.fillStyle = `rgba(150,50,20,${0.55 + r() * 0.3})`; x.beginPath(); x.ellipse(0, 0, 4 + r() * 3, 2.2, 0, 0, TAU); x.fill(); }
      else { x.fillStyle = `rgba(60,28,12,0.5)`; x.beginPath(); x.ellipse(0, 0, 9 + r() * 5, 4, 0, 0, TAU); x.fill(); }
      x.restore();
    }
    x.restore();
    // sticky sheen: dark rim light + bright highlights
    const rim = x.createRadialGradient(0, 0, 40, 0, 0, 96); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(30,10,4,0.45)');
    eggPath(x, rx, ry, 0.12); x.fillStyle = rim; x.fill();
    x.globalAlpha = 0.35 + 0.5 * glaze;
    const hl = x.createLinearGradient(-40, -60, 10, -10); hl.addColorStop(0, 'rgba(255,238,200,0.95)'); hl.addColorStop(1, 'rgba(255,238,200,0)');
    x.fillStyle = hl; x.beginPath(); x.ellipse(-22, -34, 20, 10, -0.7, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,248,230,0.9)'; x.beginPath(); x.ellipse(-30, -44, 5, 3, -0.7, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(22, 30, 9, 3.5, -0.4, 0, TAU); x.fill();
    x.globalAlpha = 1;
  } else {
    // shell
    const base = x.createRadialGradient(-20, -28, 8, 0, 0, 96);
    base.addColorStop(0, '#f2e6c8'); base.addColorStop(0.55, '#d9c299'); base.addColorStop(1, '#a98b62');
    eggPath(x, rx, ry, 0.22); x.fillStyle = base; x.fill();
    x.save(); eggPath(x, rx, ry, 0.22); x.clip();
    for (let i = 0; i < 46; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.95;
      x.fillStyle = `rgba(${90 + r() * 30},${60 + r() * 20},${32 + r() * 14},${0.35 + r() * 0.4})`;
      x.beginPath(); x.ellipse(Math.cos(a) * rx * d, Math.sin(a) * ry * d, 2 + r() * 5, 1.5 + r() * 3.5, r() * TAU, 0, TAU); x.fill();
    }
    const sh = x.createLinearGradient(30, -10, -30, 60); sh.addColorStop(0, 'rgba(40,24,10,0)'); sh.addColorStop(1, 'rgba(40,24,10,0.35)');
    x.fillStyle = sh; x.fillRect(-80, -90, 160, 180);
    x.restore();
    x.fillStyle = 'rgba(255,252,238,0.7)'; x.beginPath(); x.ellipse(-24, -36, 11, 24, 0.35, 0, TAU); x.fill();
    if (state === 'open') {
      // opened top: cut ellipse showing membrane + yolk
      x.save();
      x.translate(0, -48);
      x.fillStyle = '#c9b184'; x.beginPath(); x.ellipse(0, 0, 34, 15, 0, 0, TAU); x.fill(); // inner shell rim
      x.fillStyle = '#efe3c4';
      x.beginPath(); // jagged rim
      for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU, j = 1 + (i % 2 ? 0.1 : -0.06) + (r() - 0.5) * 0.12; const px = Math.cos(a) * 36 * j, py = Math.sin(a) * 16 * j; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.closePath(); x.fill();
      x.fillStyle = '#f7efd8'; x.beginPath(); x.ellipse(0, 1, 30, 12, 0, 0, TAU); x.fill();           // white
      const yg = x.createRadialGradient(-6, -2, 2, 0, 1, 20); yg.addColorStop(0, '#ffd45e'); yg.addColorStop(1, '#e6a22a');
      x.fillStyle = yg; x.beginPath(); x.ellipse(2, 1, 19, 8, 0, 0, TAU); x.fill();                    // yolk
      x.fillStyle = 'rgba(70,40,30,0.8)'; x.beginPath(); x.ellipse(11, 3, 7, 3.4, 0.2, 0, TAU); x.fill(); // embryo patch
      x.fillStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.ellipse(-8, -3, 5, 2, 0, 0, TAU); x.fill();
      x.restore();
    }
  }
  x.restore();
}

function cutLon(ctx, x, y, s = 1, o = {}) {
  const state = o.state || 'whole', seed = o.seed || 1, glaze = o.glaze == null ? 1 : o.glaze;
  const px = 112 * s, W = bucket(px), gb = Math.round(glaze * 3);
  const spr = cached(`egg|${W}|${state}|${seed % 6}|${gb}`, W, Math.round(W * 1.25), (c, w) => drawEgg(c, w, state, seed % 6 + 1, gb / 3, 0));
  const k = (112 * s) / W; // world px per sprite px
  ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); ctx.scale(1, o.squash || 1);
  if (o.shadow !== false) {
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46 * s); g.addColorStop(0, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.save(); ctx.translate(0, 44 * s); ctx.scale(1, 0.32); ctx.beginPath(); ctx.arc(0, 0, 46 * s, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.scale(k, k); ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.scale(1 / k, 1 / k);
  if (o.herb > 0 && state === 'fried') { const hr = rng(seed * 31 + 5); for (let i = 0; i < Math.ceil(3 * o.herb); i++) ramLeaf(ctx, (hr() - 0.5) * 36 * s, (hr() - 0.6) * 56 * s, s * 0.55, { rot: (hr() - 0.5) * 2.4, seed: seed + i }); }
  ctx.restore();
  return { center: [x, y], top: [x, y - 49 * s], rx: 39 * s, ry: 49 * s };
}

function eggCap(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  const g = ctx.createRadialGradient(-6, -8, 2, 0, 0, 36); g.addColorStop(0, '#f2e6c8'); g.addColorStop(1, '#a98b62');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-30, 12);
  const r = rng((o.seed || 1) * 11);
  ctx.quadraticCurveTo(-26, -22, 0, -34); ctx.quadraticCurveTo(26, -22, 30, 12);
  for (let i = 0; i <= 6; i++) ctx.lineTo(30 - i * 10, 12 + (i % 2 ? 6 : -2) + r() * 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(90,60,32,0.5)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse((r() - 0.5) * 40, (r() - 0.3) * 30, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function ramLeaf(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -9, 0, 9); g.addColorStop(0, '#79c24a'); g.addColorStop(1, '#3d8a2e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-32, 0); ctx.quadraticCurveTo(-8, -17, 32, -1); ctx.quadraticCurveTo(-8, 15, -32, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(110,50,90,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(0, -3, 30, -1); ctx.stroke();
  ctx.fillStyle = 'rgba(200,255,170,0.35)'; ctx.beginPath(); ctx.ellipse(-4, -5, 16, 2.2, -0.05, 0, TAU); ctx.fill();
  ctx.restore();
}

// pile layout in plate-local px at s=1: rows from bottom, back-to-front inside a row. returns [dx,dy,rot,layer]
function eggPos(i, n, seed = 3) {
  const r = rng(seed * 101 + i * 17), layers = [7, 4, 1]; // bottom ring 7, middle 4, top 1 = 12
  let li = 0, k = i; while (li < layers.length - 1 && k >= layers[li]) { k -= layers[li]; li++; }
  const cnt = layers[li], a = (k / cnt) * TAU + li * 0.7 + (r() - 0.5) * 0.25;
  const R = [175, 92, 0][li], ryF = 0.42;
  return [Math.cos(a) * R + (r() - 0.5) * 8, Math.sin(a) * R * ryF - li * 74 + (r() - 0.5) * 6 - 24, (r() - 0.5) * 1.4, li, a];
}

const PLATE_CACHE = {};
function plateSprite() {
  return cached('plate', 760, 420, (x, w, h) => {
    x.translate(w / 2, h / 2 + 10);
    const rx = 350, ry = 160;
    const sh = x.createRadialGradient(0, 24, 40, 0, 24, rx + 14); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    x.save(); x.scale(1, ry / rx); x.fillStyle = sh; x.beginPath(); x.arc(0, 24 * rx / ry, rx + 14, 0, TAU); x.fill(); x.restore();
    let g = x.createLinearGradient(0, -ry, 0, ry); g.addColorStop(0, '#f6f1e6'); g.addColorStop(1, '#bfc6c4');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 8, rx, ry, 0, 0, TAU); x.fill();       // outer rim
    x.strokeStyle = '#3b6fa3'; x.lineWidth = 6; x.beginPath(); x.ellipse(0, 6, rx - 16, ry - 8, 0, 0, TAU); x.stroke();     // blue ring
    x.strokeStyle = '#6b9bc9'; x.lineWidth = 2.5; x.beginPath(); x.ellipse(0, 6, rx - 30, ry - 16, 0, 0, TAU); x.stroke();
    g = x.createRadialGradient(0, -10, 20, 0, 0, rx); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#dadcd6');
    x.fillStyle = g; x.beginPath(); x.ellipse(0, 6, rx - 38, ry - 22, 0, 0, TAU); x.fill();     // well
    // blue flowers (Saigon enamel look)
    x.fillStyle = 'rgba(59,111,163,0.55)';
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, px = Math.cos(a) * (rx - 60), py = Math.sin(a) * (ry - 36) + 6; x.beginPath(); x.ellipse(px, py, 11, 5, a, 0, TAU); x.fill(); }
  });
}

function cutLonPlate(ctx, x, y, s = 1, o = {}) {
  const n = o.n || 12, kk = o.k == null ? 1 : o.k, seed = o.seed || 3, t = o.t || 0, cnt = Math.round(n * clamp(kk));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const sp = plateSprite(); ctx.drawImage(sp, -sp.width / 2, -sp.height / 2 + 10 - 10);
  if (o.sauce !== 0) { // glaze puddle
    const g = ctx.createRadialGradient(0, 8, 10, 0, 8, 220); g.addColorStop(0, `rgba(120,50,18,${0.75 * (o.sauce == null ? 1 : o.sauce)})`); g.addColorStop(1, 'rgba(120,50,18,0)');
    ctx.save(); ctx.scale(1, 0.42); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 8 / 0.42, 220, 0, TAU); ctx.fill(); ctx.restore();
  }
  const eggs = [];
  for (let i = 0; i < cnt; i++) {
    const [dx, dy, rot, li] = eggPos(i, n, seed);
    cutLon(ctx, dx, dy, 1.55 - li * 0.05, { state: 'fried', rot: rot * 0.5, seed: i + 1, glaze: 1, shadow: li === 0, t });
    eggs.push([x + dx * s, y + dy * s, 38 * s]);
  }
  const herb = o.herb == null ? 1 : o.herb, hr = rng(seed * 77);
  if (herb > 0) for (let i = 0; i < Math.round(16 * herb) && cnt > 4; i++) {
    const a = hr() * TAU, d = Math.sqrt(hr());
    ramLeaf(ctx, Math.cos(a) * 170 * d, -90 + Math.sin(a) * 60 * d - hr() * 50, 1.3, { rot: (hr() - 0.5) * 2.8, seed: i });
  }
  ctx.restore();
  if (o.steam !== 0 && cnt > 0) L.steam(ctx, t, seed, x, y - 90 * s, 260 * s, 380 * s, 8, 0.28 * (o.steam == null ? 1 : o.steam));
  return { center: [x, y], top: [x, y - 160 * s], rim: { x, y: y + 8 * s, rx: 350 * s, ry: 160 * s }, eggs };
}

module.exports = { cutLon, eggCap, ramLeaf, cutLonPlate, eggPos };
