// preview sheets + timings for bx_food.js / bx_fx.js →  previews/bxfood_*.png, previews/bxfx_*.png
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./lib');
const F = require('./bx_food');
const X = require('./bx_fx');
const { createCanvas } = require('@napi-rs/canvas');
const OUT = path.join(__dirname, 'previews'); fs.mkdirSync(OUT, { recursive: true });

function sheet(name, w, h, fn) {
  const c = createCanvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a2c1e'); g.addColorStop(1, '#2a1610'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,170,80,0.08)'; for (let i = 0; i < w; i += 60) ctx.fillRect(i, 0, 2, h);
  fn(ctx);
  fs.writeFileSync(path.join(OUT, name), c.toBuffer('image/png'));
  console.log('wrote', name);
}
function label(ctx, x, y, s) { ctx.save(); ctx.font = '22px BodySans'; ctx.fillStyle = '#ffe8c0'; ctx.textAlign = 'center'; ctx.fillText(s, x, y); ctx.restore(); }
function time(name, fn, n = 20) {
  const c = createCanvas(1080, 1920), ctx = c.getContext('2d'); fn(ctx, 0); // warm caches
  const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(ctx, i / 30); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  console.log(`${name.padEnd(28)} ${ms.toFixed(2)} ms`); return ms;
}
const only = process.argv[2];

// ------------------------------------------------ pan sequence (3q + top)
if (!only || only === 'pan') {
  const stages = [
    ['oil', { oil: 1 }], ['searing .2', { oil: 1, searing: 0.2 }], ['searing 1', { oil: 0.6, searing: 1 }],
    ['batter .35', { searing: 1, batter: 0.35 }], ['batter .8', { searing: 1, batter: 0.8 }], ['batter 1 cook .2', { searing: 1, batter: 1, cook: 0.2 }],
    ['cook .6', { searing: 1, cook: 0.6 }], ['cook 1', { searing: 1, cook: 1 }], ['sprouts+beans', { searing: 1, cook: 1, sprouts: 1, mungBeans: 1 }],
    ['fold .3', { searing: 1, cook: 1, sprouts: 1, mungBeans: 1, fold: 0.3 }], ['fold .6', { searing: 1, cook: 1, sprouts: 1, mungBeans: 1, fold: 0.6 }], ['fold 1', { searing: 1, cook: 1, sprouts: 1, mungBeans: 1, fold: 1 }],
  ];
  for (const view of ['3q', 'top']) {
    sheet(`bxfood_pan_${view}.png`, 2400, view === 'top' ? 2000 : 1500, (ctx) => {
      stages.forEach(([lb, o], i) => { const cx = 330 + (i % 4) * 590, cy = (view === 'top' ? 290 : 230) + Math.floor(i / 4) * (view === 'top' ? 650 : 480); F.pan(ctx, cx - 60, cy, 1, Object.assign({ view, t: 1.3, handle: view === 'top' ? 0.2 : 0.35 }, o)); label(ctx, cx, cy + (view === 'top' ? 290 : 200), `${view} ${lb}`); });
    });
  }
}
// ------------------------------------------------ crêpe hero
if (!only || only === 'hero') {
  sheet('bxfood_hero.png', 2400, 1600, (ctx) => {
    F.plate(ctx, 450, 420, 1.1, { view: '3q' }); F.banhXeo(ctx, 450, 400, 1.15, { view: '3q', steam: 1, t: 1 }); label(ctx, 450, 640, 'plate 3q fold1 steam');
    F.plate(ctx, 1200, 420, 1.1, { view: '3q' }); F.banhXeo(ctx, 1200, 400, 1.15, { view: '3q', rot: 0.5, bite: 1, t: 1 }); label(ctx, 1200, 640, 'rot .5 bite 1');
    F.banhXeo(ctx, 1950, 400, 1.1, { view: 'side', t: 1 }); label(ctx, 1950, 640, 'side');
    F.banhXeo(ctx, 450, 1100, 1.1, { view: 'top', t: 1 }); label(ctx, 450, 1420, 'top fold 1');
    F.banhXeo(ctx, 1200, 1100, 1, { view: '3q', fold: 0, t: 1 }); label(ctx, 1200, 1420, 'open fold 0');
    F.banhXeo(ctx, 1950, 1100, 1.1, { view: '3q', rot: Math.PI, t: 1 }); label(ctx, 1950, 1420, 'rot PI (fold edge front)');
  });
}
// ------------------------------------------------ tools
if (!only || only === 'tools') {
  sheet('bxfood_tools.png', 2400, 2200, (ctx) => {
    [0, 0.35, 0.7, 1].forEach((m, i) => { F.batterBowl(ctx, 300 + i * 560, 260, 1, { view: '3q', mix: m, scallions: i === 3 ? 1 : 0, t: 0.5 }); label(ctx, 300 + i * 560, 470, `batterBowl mix ${m}`); });
    F.whisk(ctx, 520, 250, 0.8, 0.4, { t: 0.3 });
    F.pourStream(ctx, 1500, 40, 1430, 220, 0.4, { col: 'milk', w: 14 }); F.turmericSprinkle(ctx, 1.0, 0.2, 2080, 30, { floor: 200 });
    F.cuttingBoard(ctx, 450, 760, 1, { view: '3q' });
    const sb = F.scallionBunch(ctx, 450, 740, 0.9, { cut: 0.5, sq: 0.6 }); F.knife(ctx, sb.cutX[0], sb.cutX[1], 0.8, 0, { lift: 0.4 }); label(ctx, 450, 960, 'board + scallions cut .5 + knife lift .4');
    F.scallionBunch(ctx, 1200, 740, 0.8, { cut: 0 }); F.scallionBunch(ctx, 1200, 860, 0.8, { cut: 1 }); label(ctx, 1200, 960, 'scallions cut 0 / 1');
    F.knife(ctx, 1900, 820, 1, 0, {}); label(ctx, 1900, 960, 'knife');
    F.lid(ctx, 350, 1230, 1, { view: '3q' }); label(ctx, 350, 1400, 'lid 3q'); F.lid(ctx, 950, 1230, 0.8, { view: 'top' }); label(ctx, 950, 1430, 'lid top');
    F.plate(ctx, 1600, 1230, 0.9, { view: '3q' }); label(ctx, 1600, 1430, 'plate');
    F.spatula(ctx, 1950, 1150, 0.8, 0.3); F.ladle(ctx, 2100, 1350, 0.8, -0.3, { fill: 1 }); label(ctx, 2150, 1500, 'spatula / ladle');
    F.forkKnife(ctx, 300, 1900, 1); label(ctx, 300, 1940, 'forkKnife');
    F.pourStream(ctx, 560, 1550, 760, 1900, 0.7, { col: 'batter', w: 18 });
    F.pourStream(ctx, 900, 1550, 1000, 1900, 0.7, { col: 'sauce', w: 10 });
    F.pourStream(ctx, 1150, 1550, 1250, 1900, 0.7, { col: 'oil', w: 8 });
    F.pan(ctx, 1800, 1800, 0.7, { view: 'side', cook: 1, searing: 1, sprouts: 1, mungBeans: 1, fold: 0.5, handle: 0 }); label(ctx, 1800, 1960, 'pan side, fold .5');
  });
}
// ------------------------------------------------ herbs / sauce / wrap
if (!only || only === 'herbs') {
  sheet('bxfood_herbs.png', 2400, 1800, (ctx) => {
    ['mustard', 'lettuce', 'lacach', 'hung', 'diepca'].forEach((k, i) => { F.herbLeaf(ctx, 200 + i * 300, 330, k === 'mustard' || k === 'lettuce' ? 1 : 2.4, 0, k); label(ctx, 200 + i * 300, 380, k); });
    F.herbBasket(ctx, 1950, 300, 0.9, { view: '3q' }); label(ctx, 1950, 470, 'herbBasket 3q');
    F.herbBasket(ctx, 400, 850, 0.8, { view: 'top', fill: 0.6 }); label(ctx, 400, 1100, 'basket top fill .6');
    F.fishSauceBowl(ctx, 950, 800, 1.3, { view: '3q', chili: 1, garlic: 1, t: 0.3 }); label(ctx, 950, 960, 'fishSauce 3q');
    F.fishSauceBowl(ctx, 1400, 800, 1.3, { view: 'top', chili: 0.5, garlic: 0.5, t: 0.3 }); label(ctx, 1400, 960, 'fishSauce top');
    [0, 0.3, 0.5, 0.7, 1].forEach((k, i) => { F.leafWrap(ctx, 250 + i * 430, 1420, 0.9, { k, dip: i === 4 ? 1 : 0, t: 0.3 }); label(ctx, 250 + i * 430, 1700, `leafWrap k ${k}`); });
  });
}
// ------------------------------------------------ fx
if (!only || only === 'fx') {
  sheet('bxfx_words.png', 2400, 1400, (ctx) => {
    X.sizzleWord(ctx, 400, 250, 1, { k: 1, t: 0.2 }); X.sizzleWord(ctx, 1200, 250, 1, { k: 0.5, t: 0.2, vi: 'XÈÈÈÈO!!!', en: 'SIZZZZLE!!!' }); X.sizzleWord(ctx, 2000, 250, 0.8, { k: 1, out: 0.5, t: 0.4 });
    X.crunchWord(ctx, 400, 700, 1, { k: 1, t: 0.1 }); X.quack(ctx, 1000, 800, 1, { k: 1 }); X.quack(ctx, 1700, 800, 1, { k: 0.6, flip: true });
    X.heartPop(ctx, 2150, 650, 1.5, { k: 1, t: 0.2 }); X.sparkles(ctx, 0.4, 2150, 650, 1, {});
    X.crumbBurst(ctx, 0.3, 0, 400, 1250, 1, {}); X.crumbBurst(ctx, 0.8, 0, 1000, 1250, 1, {});
    X.oilSparkle(ctx, 0.5, 1700, 1250, 1, {}); X.smokeWisp(ctx, 2, 2150, 1300, 1, {});
  });
  sheet('bxfx_steam.png', 2400, 1600, (ctx) => {
    [0.15, 0.4, 1].forEach((k, i) => { X.steamEruption(ctx, 1, 300 + i * 450, 1450, 0.8, k, { sun: i === 2 }); label(ctx, 300 + i * 450, 1520, `steam k ${k}`); });
    X.steamEruption(ctx, 1, 1900, 1450, 0.75, 0.5, { mushroom: true, sun: true }); X.steamEruption(ctx, 1, 1900 + 0, 1450, 0, 0);
    label(ctx, 1900, 1520, 'mushroom .5 / see next');
  });
  sheet('bxfx_mushroom.png', 1200, 1600, (ctx) => { X.steamEruption(ctx, 2, 600, 1450, 0.8, 1, { mushroom: true, sun: true }); label(ctx, 600, 1520, 'mushroom k1 sun'); });
  sheet('bxfx_fly.png', 2400, 900, (ctx) => {
    X.flyingCrepe(ctx, 600, 450, 0.9, { t: 0.3, spin: 0.4, trail: 1, vx: 1, vy: -0.3 }); X.flyingCrepe(ctx, 1700, 450, 0.9, { t: 0.5, spin: 2.1, trail: 0.3, tilt: 0.6, rot: 0.2 });
  });
}
// ------------------------------------------------ timings
if (!only || only === 'time') {
  const R = [];
  R.push(time('pan 3q cook+fill+fold.5', (c, t) => F.pan(c, 540, 900, 1, { view: '3q', t, searing: 1, cook: 1, sprouts: 1, mungBeans: 1, fold: 0.5 })));
  R.push(time('pan 3q batter .5', (c, t) => F.pan(c, 540, 900, 1, { view: '3q', t, searing: 1, batter: 0.5 })));
  R.push(time('pan top oil', (c, t) => F.pan(c, 540, 900, 1, { view: 'top', t, oil: 1 })));
  R.push(time('banhXeo 3q', (c, t) => F.banhXeo(c, 540, 900, 1.3, { view: '3q', t, steam: 1 })));
  R.push(time('batterBowl', (c, t) => F.batterBowl(c, 540, 900, 1, { mix: 0.5, scallions: 1, t })));
  R.push(time('herbBasket', (c, t) => F.herbBasket(c, 540, 900, 1, {})));
  R.push(time('fishSauceBowl', (c, t) => F.fishSauceBowl(c, 540, 900, 1, { chili: 1, garlic: 1, t })));
  R.push(time('leafWrap .7', (c, t) => F.leafWrap(c, 540, 900, 1, { k: 0.7, t })));
  R.push(time('scallionBunch .5', (c, t) => F.scallionBunch(c, 540, 900, 1, { cut: 0.5 })));
  R.push(time('lid+plate+tools', (c, t) => { F.lid(c, 540, 900, 1); F.plate(c, 540, 900, 1); F.spatula(c, 500, 900, 1, 0); F.knife(c, 500, 900, 1, 0); }));
  R.push(time('fx sizzleWord', (c, t) => X.sizzleWord(c, 540, 900, 1, { k: 1, t })));
  R.push(time('fx steamEruption', (c, t) => X.steamEruption(c, t, 540, 1400, 1, 0.6, {})));
  R.push(time('fx mushroom', (c, t) => X.steamEruption(c, t, 540, 1400, 1, 1, { mushroom: true, sun: true })));
  R.push(time('fx flyingCrepe', (c, t) => X.flyingCrepe(c, 540, 900, 1, { t, trail: 1 })));
  R.push(time('fx oilSparkle', (c, t) => X.oilSparkle(c, t, 540, 900, 1, {})));
  R.push(time('fx crumbBurst', (c, t) => X.crumbBurst(c, t + 0.2, 0, 540, 900, 1, {})));
}
