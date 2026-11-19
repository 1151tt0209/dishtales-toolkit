// _test_nprops.js — preview sheets for nprops.js.  node _test_nprops.js [env|boats|chars|food|fx|all]
const fs = require('fs'), path = require('path');
const L = require('./lib');
const P = require('./nprops');
const { createCanvas, W, H } = L;
const OUTD = path.join(__dirname, 'previews'); fs.mkdirSync(OUTD, { recursive: true });
const which = process.argv[2] || 'all';
const timings = [];
const SC = createCanvas(W, H).getContext('2d'); // scratch target for timing-only draws (keeps sheets clean)
const time = (name, fn, reps = 1, cx = null) => { // cx: flush skia's deferred drawing so timings are real
  const fl = () => { if (cx) cx.getImageData(0, 0, 1, 1); };
  fl(); const t0 = process.hrtime.bigint(); fn(); fl(); const first = Number(process.hrtime.bigint() - t0) / 1e6; let avg = first;
  if (reps > 1) { const t1 = process.hrtime.bigint(); for (let i = 0; i < reps; i++) { fn(i + 1); fl(); } avg = Number(process.hrtime.bigint() - t1) / 1e6 / reps; }
  timings.push([name, first, avg]); };
const save = (c, n) => { fs.writeFileSync(path.join(OUTD, n), c.toBuffer('image/png')); console.log('wrote previews/' + n); };
const label = (ctx, txt, x, y, sz = 26) => { ctx.save(); ctx.font = `700 ${sz}px BodySansBold`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(txt, x, y); ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y); ctx.restore(); };
const bg = (ctx, x, y, w, h, a = '#3b4a6b', b = '#e79a6e') => { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); };
const clipCell = (ctx, x, y, w, h, fn) => { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); fn(); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); };

// ---------------------------------------------------------------- ENV
function sheetEnv() {
  const full = createCanvas(W, H), f = full.getContext('2d');
  const sheet = createCanvas(W * 2, H), s = sheet.getContext('2d');
  const put = (i, name) => { const cx = (i % 4) * 540, cy = Math.floor(i / 4) * 960; s.drawImage(full, cx, cy, 540, 960); label(s, name, cx + 10, cy + 10); };
  time('floatingMarket zoom0', (i = 0) => P.floatingMarket(f, 2 + i * 0.033, { zoom: 0 }), 5, f); put(0, 'floatingMarket z0');
  time('floatingMarket zoom1', (i = 0) => P.floatingMarket(f, 3 + i * 0.033, { zoom: 1, sun: 0.4 }), 5, f); put(1, 'floatingMarket z1');
  P.floatingMarket(f, 4, { zoom: 0.6, gold: 1, sun: 0.7 }); put(2, 'floatingMarket gold');
  time('riverSide', (i = 0) => P.riverSide(f, 2 + i * 0.033, i * 4), 5, f); put(3, 'riverSide');
  P.riverSide(f, 3, 200, { horizon: 760, mid: (c, ox) => { P.boatWake(c, 700 + ox, 1250, 0.7, 3, { dir: 1, len: 700 }); P.motorBoat(c, 760 + ox, 1250, 0.3, { t: 3, speed: 1 }); } }); put(4, 'riverSide+wake+motor');
  bg(f, 0, 0, W, H, '#6b5a7a', '#f0a070'); P.water(f, 900, H, 2, {}); P.bigWave(f, 540, 1300, 1, 0.5, {}); P.splash(f, 300, 1000, 1, 0.4, {}); P.splash(f, 800, 1000, 1, 0.8, { seed: 3 }); put(5, 'water bigWave splash');
  bg(f, 0, 0, W, H); P.dawnSky(f, 0, 1100, { warm: 1 }); P.sun(f, 540, 1000, 1.4, { flare: 1, rays: 1, t: 2 }); P.mist(f, 1000, 300, 2, 0.9); P.ripples(f, 0, 1150, W, 700, 2, {}); put(6, 'sky sun mist ripples');
  bg(f, 0, 0, W, H); P.riverSide(f, 5, 0, { horizon: 1200, mist: 1 }); put(7, 'riverSide low');
  save(sheet, 'props_env.png');
}

// ---------------------------------------------------------------- BOATS
function sheetBoats() {
  const c = createCanvas(W * 2, H), ctx = c.getContext('2d');
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1080, H); ctx.clip(); P.riverSide(ctx, 2, 0, { horizon: 520, fgY: 9999 }); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(1080, 0, 1080, H); ctx.clip(); ctx.translate(1080, 0); P.riverSide(ctx, 2, 300, { horizon: 520, fgY: 9999 }); ctx.restore();
  // ghe with cây bẹo
  const s1 = 0.36;
  time('ghe', () => P.ghe(ctx, 500, 1080, s1, { t: 1, seed: 1 }), 1, ctx);
  label(ctx, 'ghe s=.36', 20, 560);
  // coUtBoat with Cô Út fanning
  const s2 = 0.42, bx = 1550, by = 1050;
  let r;
  time('coUtBoat', () => { r = P.coUtBoat(ctx, bx, by, s2, { t: 1, part: 'back', umbrella: true }); }, 1, ctx);
  P.coUt(ctx, r.stool[0], r.stool[1], s2, { pose: 'fan', t: 1, fan: 0.3 });
  P.coUtBoat(ctx, bx, by, s2, { t: 1, part: 'front' });
  label(ctx, 'coUtBoat + coUt fan s=.42', 1100, 560);
  // xuong with tourist + boatman
  const s3 = 0.5, xb = 520, yb = 1640;
  const rx = P.xuongBaLa(ctx, xb, yb, s3, { t: 1, part: 'back' });
  P.boatman(ctx, xb + -375 * s3, rx.deck[1], s3, { pose: 'row', phase: 0.3 });
  P.tourist(ctx, xb + 100 * s3, rx.deck[1], s3, { pose: 'sit', t: 1 });
  P.xuongBaLa(ctx, xb, yb, s3, { t: 1, part: 'front' });
  label(ctx, 'xuongBaLa + boatman + tourist s=.5', 20, 1300);
  // motor boat
  P.boatWake(ctx, 1500, 1700, 0.5, 2, { dir: 1 });
  P.motorBoat(ctx, 1700, 1700, 0.4, { t: 2, speed: 0.6 });
  label(ctx, 'motorBoat s=.4', 1100, 1300);
  // crowdBoats
  P.crowdBoats(ctx, 2, 1880, 0.22, { n: 6, raise: 0.7, x0: 0, x1: 2160 });
  // beo pole with giant roll
  P.beoPole(ctx, 2050, 1100, 0.6, { angle: -0.3, hang: 'giantRoll', t: 1 });
  save(c, 'props_boats.png');
}

// ---------------------------------------------------------------- CHARACTERS
function sheetChars() {
  const cw = 360, ch = 640, cols = 6;
  const coP = ['stand', 'fan', 'flip', 'hook', 'offer', 'roll', 'pole', 'thumbs', 'wave', 'cheer'];
  const toP = ['sit', 'yawn', 'photo', 'point', 'sniff', 'rollBig', 'bite', 'hug', 'cheer', 'split'];
  const bmP = ['row', 'pull', 'nod', 'cheer'];
  const cells = [];
  coP.forEach(p => cells.push(['coUt ' + p, (ctx, x, y) => P.coUt(ctx, x, y, 0.95, { pose: p, t: 1.2, k: 0.6, hang: 'giantRoll', poleAngle: 0.4 })]));
  toP.forEach(p => cells.push(['tourist ' + p, (ctx, x, y) => P.tourist(ctx, x, y, 0.95, p === 'split' ? { pose: p, t: 1, footL: [-170, 0], footR: [170, 0] } : { pose: p, t: 1.2, k: 0.6 })]));
  bmP.forEach(p => cells.push(['boatman ' + p, (ctx, x, y) => P.boatman(ctx, x, y, 0.95, { pose: p, phase: 0.3, k: 0.6, t: 1 })]));
  cells.push(['vendor x3', (ctx, x, y) => { P.vendor(ctx, x - 100, y, 0.9, { seed: 1 }); P.vendor(ctx, x, y, 0.9, { seed: 2, raise: 1, t: 1 }); P.vendor(ctx, x + 100, y, 0.9, { seed: 3, sit: true }); }]);
  cells.push(['coUt stand (scale ref)', (ctx, x, y) => { P.coUt(ctx, x - 70, y, 0.95, { pose: 'stand', sit: 0 }); P.tourist(ctx, x + 80, y, 0.95, { pose: 'point', stand: true }); }]);
  const rows = Math.ceil(cells.length / cols) + 2;
  const c = createCanvas(cw * cols, ch * rows), ctx = c.getContext('2d');
  bg(ctx, 0, 0, c.width, c.height, '#47577a', '#d99070');
  cells.forEach(([n, fn], i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    clipCell(ctx, x, y, cw, ch, () => { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.moveTo(x, y + ch - 40); ctx.lineTo(x + cw, y + ch - 40); ctx.stroke(); fn(ctx, x + cw / 2, y + ch - 40); });
    label(ctx, n, x + 8, y + 8, 22);
  });
  // faces row(s)
  const fy = Math.ceil(cells.length / cols) * ch, faces = [];
  ['smile', 'laugh', 'wink', 'talk', 'calm'].forEach(e => faces.push(['coUtFace ' + e, (ctx, x, y) => P.coUtFace(ctx, x, y, 0.5, { expr: e, t: 1 })]));
  ['neutral', 'smile', 'sniff', 'wow', 'panic', 'chew', 'bliss'].forEach(e => faces.push(['touristFace ' + e, (ctx, x, y) => P.touristFace(ctx, x, y, 0.5, { expr: e, t: 1 })]));
  faces.forEach(([n, fn], i) => {
    const x = (i % cols) * cw, y = fy + Math.floor(i / cols) * ch;
    clipCell(ctx, x, y, cw, ch, () => fn(ctx, x + cw / 2, y + 260));
    label(ctx, n, x + 8, y + 8, 22);
  });
  time('coUt fan', () => P.coUt(SC, 100, 100, 1, { pose: 'fan', t: 1 }), 10, SC);
  time('tourist sit', () => P.tourist(SC, 100, 100, 1, { pose: 'sit', t: 1 }), 10, SC);
  time('touristFace s1', () => P.touristFace(SC, 540, 900, 1, { expr: 'wow', t: 1 }), 10, SC);
  time('coUtFace s1', () => P.coUtFace(SC, 540, 900, 1, { expr: 'smile', t: 1 }), 10, SC);
  time('boatman', () => P.boatman(SC, 300, 900, 1, { t: 1 }), 10, SC);
  save(c, 'props_chars.png');
}

// ---------------------------------------------------------------- FOOD
function sheetFood() {
  const cw = 540, ch = 540, cols = 4;
  const cells = [
    ['charcoalStove+grill', (c, x, y) => P.charcoalStove(c, x, y + 230, 1.15, { t: 1, grill: true, skewers: 4, cook: 0.75, flare: 0.4 })],
    ['grillRack cook .2/.9', (c, x, y) => { P.grillRack(c, x, y - 90, 1.3, { skewers: [{ cook: 0.1 }, { cook: 0.4 }], t: 1 }); P.grillRack(c, x, y + 120, 1.3, { skewers: 2, cook: 0.95, t: 1 }); }],
    ['nemSkewer 0 / .5 / 1', (c, x, y) => { [0, 0.5, 1].forEach((k, i) => P.nemSkewer(c, x, y - 140 + i * 140, 1.4, { cook: k, t: 1.3, rot: -0.05 })); }],
    ['nemShaping p=.2/.8', (c, x, y) => { P.nemShaping(c, x, y - 110, 0.95, { p: 0.2 }); P.nemShaping(c, x, y + 120, 0.95, { p: 0.8 }); }],
    ['handFan / blur, tongs', (c, x, y) => { P.handFan(c, x - 230, y - 100, 1.2, -0.2); P.handFan(c, x - 230, y + 70, 1.2, 0.1, { blur: 1 }); P.tongs(c, x - 200, y + 200, 1.5, -0.1, { open: 0.5 }); }],
    ['nemPlate nem/rolls/cut', (c, x, y) => { P.nemPlate(c, x, y - 160, 1.1, { kind: 'nem' }); P.nemPlate(c, x, y, 1.1, { kind: 'rolls' }); P.nemPlate(c, x, y + 160, 1.1, { kind: 'cut' }); }],
    ['ricePaper dry / wet+sag', (c, x, y) => { P.ricePaper(c, x - 120, y - 80, 0.75, { wet: 0 }); P.ricePaper(c, x + 120, y + 60, 0.75, { wet: 1, sag: 0.7, ry: 0.8 }); }],
    ['waterBasin dip', (c, x, y) => P.waterBasin(c, x, y, 1.15, { t: 1.4, dip: 1 })],
    ['herbs', (c, x, y) => { const k = ['lettuce', 'basil', 'diepca', 'tiato', 'starfruit', 'banana', 'cucumber', 'carrot', 'daikon']; k.forEach((n, i) => P.herb(c, n, x - 170 + (i % 3) * 170, y - 160 + Math.floor(i / 3) * 160, 1.2, 0)); }],
    ['herbBasket', (c, x, y) => P.herbBasket(c, x, y, 1.5, {})],
    ['ramRoll / snap', (c, x, y) => { P.ramRoll(c, x, y - 120, 2.2, 0); P.ramRoll(c, x, y + 80, 2.2, 0, { snap: 0.5 }); }],
    ['rollAssembly L2.5', (c, x, y) => P.rollAssembly(c, x, y, 1.4, { layers: 2.5, t: 1 })],
    ['rollAssembly L5 slide.5', (c, x, y) => P.rollAssembly(c, x, y, 1.4, { layers: 5, slide: 0.5, t: 1 })],
    ['rollAssembly roll .2', (c, x, y) => P.rollAssembly(c, x, y, 1.4, { layers: 6, roll: 0.2, t: 1 })],
    ['rollAssembly roll .45', (c, x, y) => P.rollAssembly(c, x, y, 1.4, { layers: 6, roll: 0.45, t: 1 })],
    ['rollAssembly roll .8', (c, x, y) => P.rollAssembly(c, x, y, 1.4, { layers: 6, roll: 0.8, t: 1 })],
    ['nemRoll / bite / tie', (c, x, y) => { P.nemRoll(c, x, y - 150, 1.6, 0); P.nemRoll(c, x, y + 20, 1.6, 0, { bite: 0.5 }); P.nemRoll(c, x, y + 180, 1.3, 0.1, { tie: true }); }],
    ['nemRollCut backlit', (c, x, y) => P.nemRollCut(c, x - 120, y, 2.4, { backlight: 1 })],
    ['giantRoll bite', (c, x, y) => P.giantRoll(c, x, y, 0.8, -0.1, { bite: 0.4, t: 1 })],
    ['sauceBowl toppings + stream', (c, x, y) => { P.sauceBowl(c, x, y + 60, 1.8, { fill: 0.85, peanuts: 1, scallionOil: 1, chiliGarlic: 0.6, t: 1 }); P.sauceStream(c, x + 160, y - 230, x + 20, y + 60, 1, { k: 1 }); P.toppingFall(c, 1.3, 1, 5, 30, x - 40, y - 200, { kind: 'mix', floor: y + 70 }); }],
  ];
  const rows = Math.ceil(cells.length / cols);
  const c = createCanvas(cw * cols, ch * rows), ctx = c.getContext('2d');
  bg(ctx, 0, 0, c.width, c.height, '#5a4a5a', '#c08060');
  cells.forEach(([n, fn], i) => { const x = (i % cols) * cw, y = Math.floor(i / cols) * ch; clipCell(ctx, x, y, cw, ch, () => fn(ctx, x + cw / 2, y + ch / 2)); label(ctx, n, x + 8, y + 8, 22); });
  time('charcoalStove+grill', () => P.charcoalStove(SC, 100, 300, 1, { t: 1, grill: true }), 10, SC);
  time('rollAssembly', () => P.rollAssembly(SC, 300, 300, 1, { layers: 6, roll: 0.3, t: 1 }), 10, SC);
  time('herbBasket (cached)', () => P.herbBasket(SC, 300, 300, 1, {}), 10, SC);
  save(c, 'props_food.png');
}

// ---------------------------------------------------------------- FX
function sheetFx() {
  const cw = 540, ch = 720, cols = 4;
  const cells = [
    ['smoke ribbon k=1', (c, x, y) => P.smoke(c, 1, [[x - 150, y + 300], [x - 80, y + 100], [x + 60, y - 20], [x + 20, y - 200], [x + 160, y - 300]], { k: 1, w: 50, alpha: 0.8 })],
    ['smoke k=.5 cool', (c, x, y) => P.smoke(c, 1, [[x, y + 300], [x - 60, y], [x + 60, y - 300]], { k: 0.5, warm: 0, alpha: 0.8 })],
    ['embers', (c, x, y) => { c.fillStyle = '#201418'; c.fillRect(x - 270, y - 360, 540, 720); P.embers(c, 1, 3, 40, x - 150, y + 200, 300, 60, { size: 2 }); }],
    ['steam wisps', (c, x, y) => { c.fillStyle = '#2a2a3a'; c.fillRect(x - 270, y - 360, 540, 720); P.steam(c, 1.5, 4, x - 150, y + 250, 300, 500, { n: 8, alpha: 0.6 }); }],
    ['sizzle', (c, x, y) => { P.nemSkewer(c, x, y, 2, { cook: 0.8, t: 1 }); P.sizzle(c, 1, x, y - 30, 2, {}); }],
    ['flavorBurst k=.6', (c, x, y) => P.flavorBurst(c, x, y, 0.75, 0.6, {})],
    ['flavorBurst k=.25', (c, x, y) => P.flavorBurst(c, x, y, 0.75, 0.25, {})],
    ['waveWhoosh', (c, x, y) => P.waveWhoosh(c, x + 100, y, 1, 0.45, { dir: 1 })],
  ];
  const rows = Math.ceil(cells.length / cols);
  const c = createCanvas(cw * cols, ch * rows), ctx = c.getContext('2d');
  bg(ctx, 0, 0, c.width, c.height, '#4a5a7a', '#d08a6a');
  cells.forEach(([n, fn], i) => { const x = (i % cols) * cw, y = Math.floor(i / cols) * ch; clipCell(ctx, x, y, cw, ch, () => fn(ctx, x + cw / 2, y + ch / 2)); label(ctx, n, x + 8, y + 8, 22); });
  time('smoke', () => P.smoke(SC, 1, [[100, 600], [200, 300], [100, 0]], { k: 1 }), 10, SC);
  time('flavorBurst', () => P.flavorBurst(SC, 500, 500, 1, 0.6, {}), 10, SC);
  save(c, 'props_fx.png');
}

const run = { env: sheetEnv, boats: sheetBoats, chars: sheetChars, food: sheetFood, fx: sheetFx };
for (const k of Object.keys(run)) if (which === 'all' || which.split(',').includes(k)) run[k]();
console.log('\nTIMINGS (ms)   first   avg');
for (const [n, a, b] of timings) console.log(`  ${n.padEnd(26)} ${a.toFixed(1).padStart(7)} ${b.toFixed(1).padStart(7)}`);
