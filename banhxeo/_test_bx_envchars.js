// _test_bx_envchars.js - previews + timings for bx_env.js / bx_chars.js
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const E = require('./bx_env'), C = require('./bx_chars');
const OUT = path.join(__dirname, 'previews'); fs.mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920;
const save = (cv, name) => fs.writeFileSync(path.join(OUT, name), cv.toBuffer('image/png'));
const tm = {};
function time(name, fn, n = 1) { const t0 = process.hrtime.bigint(); let r; for (let i = 0; i < n; i++) r = fn(i); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n; (tm[name] = tm[name] || []).push(ms); return r; }
const only = process.argv[2] || 'all';

if (only === 'all' || only === 'env') {
  for (const d of [0, 0.5, 1]) {
    const cv = createCanvas(W, H), ctx = cv.getContext('2d');
    time('riversideScene', () => E.riversideScene(ctx, 2.0, { dusk: d, panX: 0 }));
    time('riversideScene#2', () => E.riversideScene(ctx, 2.1, { dusk: d, panX: 20 }));
    E.riversideScene(ctx, 2.0, { dusk: d });
    save(cv, `bxenv_river_d${d}.png`);
  }
  { const cv = createCanvas(W, H), ctx = cv.getContext('2d'); time('riverside high', () => E.riversideScene(ctx, 1, { dusk: 0.4, high: 1 })); E.riversideScene(ctx, 1.03, { dusk: 0.4, high: 1 }); save(cv, 'bxenv_river_high.png'); }
  { const cv = createCanvas(W, H), ctx = cv.getContext('2d'); time('riverside house close', () => E.riversideScene(ctx, 1, { dusk: 0.3, cam: { zoom: 1.8, x: 300, y: 1000 } })); save(cv, 'bxenv_river_close.png'); }
  for (const v of ['wide', 'stove']) for (const d of [0, 1]) {
    const cv = createCanvas(W, H), ctx = cv.getContext('2d');
    time('kitchen ' + v, () => E.kitchenInterior(ctx, 1.5, { view: v, dusk: d, fire: 1 }), 2);
    save(cv, `bxenv_kitchen_${v}_d${d}.png`);
  }
  { const cv = createCanvas(W, H), ctx = cv.getContext('2d'); time('herbGarden', () => E.herbGarden(ctx, 1, { dusk: 0.3 }), 2); save(cv, 'bxenv_garden.png'); }
}

function bg(ctx, col = '#8fb8c8') { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#b89a70'; ctx.fillRect(0, 1500, W, 420); }
function grid(name, items, cols, cellH, drawCell, bgc) {
  const rows = Math.ceil(items.length / cols), cv = createCanvas(W, Math.max(H, rows * cellH)), ctx = cv.getContext('2d');
  ctx.fillStyle = bgc || '#8fb8c8'; ctx.fillRect(0, 0, cv.width, cv.height);
  items.forEach((it, i) => {
    const cx = (i % cols + 0.5) * W / cols, cy = Math.floor(i / cols) * cellH;
    ctx.fillStyle = 'rgba(160,130,90,0.5)'; ctx.fillRect((i % cols) * W / cols + 2, cy + cellH * 0.82, W / cols - 4, cellH * 0.18);
    drawCell(ctx, it, cx, cy + cellH * 0.82, i);
    ctx.fillStyle = '#000'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(String(it.label || it.pose || it), cx - W / cols / 2 + 8, cy + 28);
  });
  save(cv, name);
}
function stool(ctx, x, y, s) { ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 40 * s, y - 70 * s, 80 * s, 14 * s); ctx.fillRect(x - 34 * s, y - 56 * s, 8 * s, 56 * s); ctx.fillRect(x + 26 * s, y - 56 * s, 8 * s, 56 * s); }
function panAt(ctx, p) { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 90, 30, p.rot || 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#f2c040'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, 70, 22, p.rot || 0, 0, Math.PI * 2); ctx.fill(); }

if (only === 'all' || only === 'chars') {
  const ms = [
    { pose: 'pour', k: 0.1 }, { pose: 'pour', k: 0.5 }, { pose: 'pour', k: 0.95 },
    { pose: 'swirl' }, { pose: 'spatula', k: 0 }, { pose: 'spatula', k: 1 },
    { pose: 'pick' }, { pose: 'offer' }, { pose: 'plate' },
    { pose: 'laugh' }, { pose: 'wink' }, { pose: 'eyebrow' },
  ].map((o) => Object.assign({ label: o.pose + (o.k !== undefined ? ' k' + o.k : '') }, o));
  grid('bxchars_matu.png', ms, 3, 640, (ctx, o, cx, fy) => {
    const s = 0.82, sitP = ['pour', 'swirl', 'spatula'].includes(o.pose);
    const pan = [cx + 120 * s, fy - 205 * s];
    if (sitP) { ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx + 20, pan[1] + 18, 200, 14); ctx.fillStyle = '#e8622a'; ctx.beginPath(); ctx.ellipse(pan[0], pan[1] + 30, 50, 10, 0, 0, 7); ctx.fill(); panAt(ctx, { x: pan[0], y: pan[1] }); }
    const r = time('maTu', () => C.maTu(ctx, cx - 30, fy, s, Object.assign({ t: 1.2, panAt: pan, panRx: 90, pickAt: [cx + 120, fy - 260], plateAt: [cx - 10, fy - 300], hold: o.pose === 'plate' ? (c, p) => { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(p.x, p.y, 70, 18, 0, 0, 7); c.fill(); c.strokeStyle = '#335'; c.lineWidth = 2; c.stroke(); } : o.pose === 'swirl' ? (c, p) => panAt(c, p) : null }, o)));
    if (r.stream) { ctx.fillStyle = 'red'; ctx.fillRect(r.stream.to[0] - 3, r.stream.to[1] - 3, 6, 6); }
  });
  grid('bxchars_matu_face.png', ['smile', 'laugh', 'wink', 'eyebrow', 'talk', 'calm'], 3, 640, (ctx, ex, cx, fy) => {
    time('maTuFace', () => C.maTuFace(ctx, cx, fy - 300, 0.9, { expr: ex, t: 1, turn: 0.2 }));
  });
  const ts = ['knifeFork', 'pointTry', 'dumpBowl', 'flip', 'flip', 'gape', 'applaud', 'bow', 'wrapBite', 'wrapBite', 'thumbs', 'sit'].map((p, i) => ({ pose: p, label: p, k: p === 'flip' ? (i === 3 ? 0 : 0.85) : p === 'wrapBite' ? (i === 8 ? 0.3 : 0.9) : 0.6 }));
  ts[11] = { pose: 'sit', label: 'sit apron+hair', apron: true, hairBlown: 1 };
  grid('bxchars_tourist.png', ts, 3, 640, (ctx, o, cx, fy) => {
    time('tourist', () => C.tourist(ctx, cx - 10, fy, 0.85, Object.assign({ t: 1.3, stool: true, pointAt: [cx + 160, fy - 120] }, o)));
  });
  grid('bxchars_tourist_expr.png', [{ expr: 'foggy' }, { expr: 'blownHair' }, { expr: 'crunch' }, { expr: 'wow', stand: true, pose: 'bow', k: 1 }, { expr: 'smile', stand: true, apron: true, pose: 'thumbs' }, { expr: 'sniff' }].map((o) => Object.assign({ label: o.expr + (o.stand ? ' stand' : '') }, o)), 3, 900, (ctx, o, cx, fy) => {
    time('tourist', () => C.tourist(ctx, cx, fy, o.stand ? 0.8 : 0.85, Object.assign({ t: 0.7, stool: !o.stand }, o)));
  });
  // water: boatman, ducks, tourist in xuong
  for (const d of [0, 1]) {
    const cv = createCanvas(W, H), ctx = cv.getContext('2d');
    E.riversideScene(ctx, 2, { dusk: d * 0.6 });
    const r = time('touristInXuong', () => C.touristInXuong(ctx, 560, 1380, 0.55, { t: 2, sniff: d ? 1 : 0, perk: d ? 0 : 1 }));
    time('duckLine4', () => C.duckLine(ctx, 2, 300, 1580, 1, 4, {}));
    time('boatmanRow', () => C.boatmanRow(ctx, 880, 1240, 0.3, { t: 2, duck: d, boat: true, flip: true }));
    ctx.fillStyle = 'red'; ctx.fillRect(r.boat.seat[0] - 4, r.boat.seat[1] - 4, 8, 8);
    save(cv, `bxchars_water_${d}.png`);
  }
  grid('bxchars_ducks.png', ['swim', 'quack', 'lookUp', 'flapRun'], 2, 480, (ctx, p, cx, fy) => {
    if (p === 'swim') { ctx.fillStyle = '#3a7a8a'; ctx.fillRect(cx - 270, fy, 540, 80); }
    time('duck', () => C.duck(ctx, cx, fy, 2.4, { t: 0.4, pose: p }));
  });
}
for (const k in tm) { const a = tm[k]; console.log(k.padEnd(24), 'avg', (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), 'ms  max', Math.max(...a).toFixed(2), 'n', a.length); }
