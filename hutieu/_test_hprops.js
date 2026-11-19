// _test_hprops.js — visual + timing test for hprops.js. Writes previews/hprops_{env,boat,bowl,chars,fx}.png
'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const HP = require('./hprops');
const { W, H } = HP.L;
const OUT = path.join(__dirname, 'previews');
fs.mkdirSync(OUT, { recursive: true });

const scratch = createCanvas(W, H).getContext('2d');
const times = [];
// time fn on a scratch canvas (warm-up + 5 runs), then draw once for real
function T(name, ctx, fn) {
  scratch.setTransform(ctx.getTransform());
  fn(scratch); scratch.getImageData(0, 0, 1, 1);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 5; i++) fn(scratch); scratch.getImageData(0, 0, 1, 1);
  const ms = Number(process.hrtime.bigint() - t0) / 5e6;
  times.push([name, ms]);
  return fn(ctx);
}
function label(ctx, s, x, y) { ctx.save(); ctx.font = 'bold 26px BodySansBold'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(s, x, y); ctx.fillStyle = '#ffef6a'; ctx.fillText(s, x, y); ctx.restore(); }
// 2x2 grid of full-frame scenes at half scale
function grid(file, scenes) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H);
  scenes.forEach((sc, i) => {
    const px = (i % 2) * W / 2, py = Math.floor(i / 2) * H / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, W / 2, H / 2); ctx.clip();
    ctx.translate(px, py); ctx.scale(0.5, 0.5);
    sc.fn(ctx);
    ctx.restore();
    label(ctx, sc.name, px + 12, py + 34);
  });
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  fs.writeFileSync(path.join(OUT, file), c.toBuffer('image/png'));
}
function plain(file, fn) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  fn(ctx);
  fs.writeFileSync(path.join(OUT, file), c.toBuffer('image/png'));
}
const dot = (ctx, p, col = '#ff00ff') => { ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], 7, 0, 7); ctx.fill(); ctx.restore(); };

// ================================================================ ENV
grid('hprops_env.png', [
  { name: 'floatingMarketDay', fn: (ctx) => { const r = T('floatingMarketDay', ctx, (c) => HP.floatingMarketDay(c, 2.0, {})); const p = r.project(20, 60); dot(ctx, [p[0], p[1]]); } },
  { name: 'riverSideDay', fn: (ctx) => T('riverSideDay', ctx, (c) => HP.riverSideDay(c, 2.0, 120, {})) },
  { name: 'daySky+sun+dayWater', fn: (ctx) => { T('daySky', ctx, (c) => HP.daySky(c, 0, 1100, { t: 3, sun: [300, 380], flare: true })); T('dayWater', ctx, (c) => HP.dayWater(c, 1100, H, 3, { sunX: 300 })); } },
  { name: 'heatShimmer over pot', fn: (ctx) => {
    HP.riverSideDay(ctx, 1.0, 0, { farBoats: false });
    HP.brothPot(ctx, 540, 1500, 1.4, { t: 1, steam: 1, boil: 1 });
    T('heatShimmer', ctx, (c) => HP.heatShimmer(c, 300, 600, 480, 560, 1.0, { amp: 6 }));
  } },
]);

// ================================================================ BOAT
function boatScene(ctx, t, pose, po) {
  HP.riverSideDay(ctx, t, 0, { farBoats: true });
  const s = 0.62, bx = 520, by = 1360;
  const b = T('hutieuBoat back', ctx, (c) => HP.hutieuBoat(c, bx, by, s, { part: 'back', t, steam: 1 }));
  const r = T('diBay ' + pose, ctx, (c) => HP.diBay(c, b.seat[0], b.seat[1], s, Object.assign({ pose, t, potAt: b.potRim, pot: { x: b.potRim[0], y: b.potRim[1], rx: b.potRx, ry: b.potRy } }, po)));
  T('hutieuBoat front', ctx, (c) => HP.hutieuBoat(c, bx, by, s, { part: 'front', t }));
  dot(ctx, b.potRim, '#ff00ff'); dot(ctx, b.seat, '#00ffff');
  return { b, r };
}
grid('hprops_boat.png', [
  { name: 'basket dip+shake', fn: (ctx) => boatScene(ctx, 1.0, 'basket', { dip: 1, shake: 1 }) },
  { name: 'basket lift (drip)', fn: (ctx) => boatScene(ctx, 1.3, 'basket', { lift: 1, drip: 1 }) },
  { name: 'ladle pour k=.85', fn: (ctx) => {
    HP.riverSideDay(ctx, 2, 0, {});
    const s = 0.62, bx = 520, by = 1360, t = 2;
    const b = HP.hutieuBoat(ctx, bx, by, s, { part: 'back', t });
    const bowlAt = [b.potRim[0] + 150, b.potRim[1] + 70];
    HP.huTieuBowl(ctx, bowlAt[0], bowlAt[1], 0.3, { view: '3q', layers: 3, broth: 0.4, t });
    const r = T('diBay ladle', ctx, (c) => HP.diBay(c, b.seat[0], b.seat[1], s, { pose: 'ladle', t, k: 0.85, potAt: b.potRim, bowlAt }));
    HP.hutieuBoat(ctx, bx, by, s, { part: 'front', t });
    dot(ctx, bowlAt);
  } },
  { name: 'ladle scoop k=.15 + lid', fn: (ctx) => {
    HP.riverSideDay(ctx, 2, 0, {});
    const s = 0.9, bx = 420, by = 1500, t = 2;
    const b = HP.hutieuBoat(ctx, bx, by, s, { part: 'back', t, lid: 0.6 });
    HP.diBay(ctx, b.seat[0], b.seat[1], s, { pose: 'ladle', t, k: 0.15, potAt: b.potRim, bowlAt: [b.potRim[0] + 200, b.potRim[1] + 90] });
    HP.hutieuBoat(ctx, bx, by, s, { part: 'front', t });
  } },
]);

// ================================================================ BOWL / FOOD (plain light background, full res)
plain('hprops_bowl.png', (ctx) => {
  ctx.fillStyle = '#e9dcc0'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(0, 0, W, 560); // wooden table for top view
  T('huTieuBowl top L7', ctx, (c) => HP.huTieuBowl(c, 270, 280, 1.4, { view: 'top', layers: 7, t: 1 }));
  T('huTieuBowl 3q L7 steam', ctx, (c) => HP.huTieuBowl(c, 800, 250, 1.3, { view: '3q', layers: 7, t: 1, steam: 1, lime: true }));
  // layer progression (3q)
  for (let i = 0; i <= 7; i++) HP.huTieuBowl(ctx, 70 + i * 134, 690, 0.42, { view: '3q', layers: i, t: 1, shadow: false });
  label(ctx, 'layers 0..7', 20, 600);
  T('huTieuBowl side', ctx, (c) => HP.huTieuBowl(c, 160, 900, 0.7, { view: 'side', layers: 7, t: 1 }));
  HP.huTieuBowl(ctx, 160, 1010, 0.7, { view: '3q', layers: 7, broth: 0.2, rot: -0.3, t: 1 });
  // toppings row
  const tp = [['porkSlice', (c) => HP.porkSlice(c, 420, 860, 1.2, 0.2)], ['shrimp', (c) => HP.shrimp(c, 560, 860, 1.2, 0.3)], ['liverSlice', (c) => HP.liverSlice(c, 690, 860, 1.2, -0.2)],
    ['quailEgg', (c) => HP.quailEgg(c, 800, 860, 1.4, 0)], ['limeWedge', (c) => HP.limeWedge(c, 920, 860, 1.2, 0.3)],
    ['chives', (c) => HP.chives(c, 430, 990, 1.2, 0, { n: 14 })], ['beanSprouts', (c) => HP.beanSprouts(c, 580, 990, 1.2, 0, { n: 10 })],
    ['chiliSlices', (c) => HP.chiliSlices(c, 730, 990, 1.4, { n: 7 })], ['garlicBits', (c) => HP.garlicBits(c, 880, 990, 1.4, { n: 20 })]];
  for (const [n, f] of tp) T(n, ctx, f);
  // tools
  T('ladle', ctx, (c) => HP.ladle(c, 120, 1240, 0.8, 0, { fill: 1 }));
  T('noodleBasket', ctx, (c) => HP.noodleBasket(c, 470, 1260, 0.7, 0, { fill: 1, drip: 1, t: 1 }));
  T('spoon', ctx, (c) => HP.spoon(c, 790, 1160, 1.2, 0, { fill: 1, noodle: true }));
  T('chopsticks hang', ctx, (c) => HP.chopsticks(c, 760, 1300, 1, -0.3, { hang: 120, t: 1 }));
  T('noodles lift', ctx, (c) => HP.noodles(c, 150, 1600, 1, { lift: 0.6, t: 1 }));
  T('noodles dry', ctx, (c) => HP.noodles(c, 330, 1600, 0.8, { dry: true }));
  T('garnishPlate', ctx, (c) => HP.garnishPlate(c, 600, 1560, 0.9));
  T('brothPot side lid.5', ctx, (c) => HP.brothPot(c, 900, 1840, 0.6, { t: 1, lid: 0.5, steam: 1 }));
  T('brothPot top', ctx, (c) => HP.brothPot(c, 160, 1810, 0.5, { t: 1, view: 'top', boil: 1 }));
  T('brothStream', ctx, (c) => HP.brothStream(c, 470, 1680, 560, 1850, 1, { w: 14, k: 1, splash: true }));
  T('toppingFall', ctx, (c) => HP.toppingFall(c, 1.0, 0.5, 4, 24, 700, 1700, { floor: 1880, kinds: ['garlic', 'chives', 'chili'] }));
});

// ================================================================ CHARACTERS
plain('hprops_chars.png', (ctx) => {
  ctx.fillStyle = '#9fd3f0'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#c8b48a'; for (let r = 0; r < 4; r++) ctx.fillRect(0, 430 + r * 440, W, 14);
  const cells = [
    ['diBay slurp', (c) => HP.diBay(c, 180, 440, 0.95, { pose: 'slurp', t: 1, k: 0.5 })],
    ['diBay handBowl', (c) => HP.diBay(c, 540, 440, 0.95, { pose: 'handBowl', t: 1, k: 1, to: [700, 260] })],
    ['diBay stand smile', (c) => HP.diBay(c, 900, 440, 0.8, { pose: 'wave', t: 1, sit: 0, expr: 'smile' })],
    ['tourist sip', (c) => HP.tourist(c, 180, 880, 1, { pose: 'sip', t: 1, k: 1 })],
    ['tourist bowl', (c) => HP.tourist(c, 540, 880, 1, { pose: 'bowl', t: 1, raise: 1 })],
    ['tourist slurp', (c) => HP.tourist(c, 900, 880, 1, { pose: 'slurp', t: 1, k: 0.5 })],
    ['tourist sign', (c) => HP.tourist(c, 180, 1320, 1, { pose: 'sign', t: 1 })],
    ['tourist fanHat', (c) => HP.tourist(c, 540, 1320, 1, { pose: 'fanHat', t: 1.1, sweat: 1 })],
    ['tourist determined', (c) => HP.tourist(c, 900, 1320, 1, { pose: 'sit', t: 1, expr: 'determined' })],
    ['touristFace noodleSlap', (c) => HP.touristFace(c, 180, 1620, 0.75, { expr: 'noodleSlap', t: 1 })],
    ['touristFace squint', (c) => HP.touristFace(c, 450, 1620, 0.75, { expr: 'squint', t: 1, sweat: 1 })],
    ['vendorH bowl slurp', (c) => { HP.vendorH(c, 680, 1760, 1, { seed: 2, t: 1, item: 'bowl', slurp: 0 }); HP.vendorH(c, 800, 1760, 1, { seed: 3, t: 1, item: 'bowl', slurp: 1 }); }],
    ['diBayFace slurp', (c) => HP.diBayFace(c, 960, 1620, 0.5, { expr: 'slurp', t: 1 })],
  ];
  for (const [n, f] of cells) T(n, ctx, f);
  label(ctx, 'diBay slurp / handBowl / wave', 20, 40); label(ctx, 'tourist sip / bowl / slurp', 20, 480); label(ctx, 'tourist sign / fanHat / determined', 20, 920); label(ctx, 'faces: noodleSlap, squint | vendors | diBayFace', 20, 1360);
});
plain('hprops_crowd.png', (ctx) => {
  HP.riverSideDay(ctx, 1, 0, {});
  T('crowdBoatsH', ctx, (c) => HP.crowdBoatsH(c, 1, 1300, 0.45, { n: 4, item: 'bowl', slurp: (i) => i % 2 }));
});

// ================================================================ FX
plain('hprops_fx.png', (ctx) => {
  HP.daySky(ctx, 0, 1100, { t: 1 }); HP.dayWater(ctx, 1100, H, 1, { sunX: 540 });
  T('biText', ctx, (c) => HP.biText(c, 'Hủ tiếu chợ nổi', 'Floating-market noodles', 540, 120, 64, 34));
  T('selfieSign', ctx, (c) => HP.selfieSign(c, 140, 760, 0.8, 0.2, { t: 1 }));
  T('slurpRings', ctx, (c) => HP.slurpRings(c, 540, 520, 0.4, 0.6));
  T('noodleZip', ctx, (c) => HP.noodleZip(c, 380, 760, 700, 420, 0.4, { t: 1 }));
  T('heron fly', ctx, (c) => HP.heron(c, 820, 260, 1, { t: 0.3 }));
  T('heron stand', ctx, (c) => HP.heron(c, 900, 1260, 0.9, { pose: 'stand' }));
  T('steamBurst', ctx, (c) => HP.steamBurst(c, 1, 300, 1700, 0.8, 0.6, {}));
  T('clockFace', ctx, (c) => HP.clockFace(c, 160, 1000, 1, 0.7, { label: true }));
  T('flyingHat', ctx, (c) => HP.flyingHat(c, 700, 980, 1, 0.5));
  T('flavorBurst', ctx, (c) => HP.flavorBurst(c, 600, 1450, 1, 0.8));
  T('sweatDrops', ctx, (c) => { c.save(); c.fillStyle = '#f2c9a0'; c.beginPath(); c.arc(950, 1700, 70, 0, 7); c.fill(); c.restore(); HP.sweatDrops(c, 950, 1700, 80, 1, 1); });
});

times.sort((a, b) => b[1] - a[1]);
console.log('per-prop timings (ms, avg of 5):');
for (const [n, ms] of times) console.log('  ' + n.padEnd(28) + ms.toFixed(2));
