// _test_cl_foodfx.js — preview sheets + timings for cl_food.js / cl_fx.js.   node _test_cl_foodfx.js
'use strict';
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const CF = require('./cl_food');
const FX = require('./cl_fx');
const OUT = path.join(__dirname, 'previews'); fs.mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920;
function sheet(name, bg, fn) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  if (typeof bg === 'function') bg(ctx); else { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
  fn(ctx);
  fs.writeFileSync(path.join(OUT, name), c.toBuffer('image/png'));
  console.log('wrote', name);
}
function label(ctx, txt, x, y, col = '#fff') { ctx.save(); ctx.font = 'bold 26px sans-serif'; ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.restore(); }
function night(ctx) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1430'); g.addColorStop(0.6, '#142347'); g.addColorStop(1, '#1d2a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function dusk(ctx) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2c3e5c'); g.addColorStop(1, '#5a6e5a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function timeIt(name, fn, n = 30) {
  const c = createCanvas(W, H), ctx = c.getContext('2d'); ctx.fillStyle = '#123'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) fn(ctx, i / 30); ctx.getImageData(0, 0, 1, 1);
  const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) { fn(ctx, i / 30); ctx.getImageData(0, 0, 1, 1); } const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  console.log(`  ${name.padEnd(34)} ${ms.toFixed(2)} ms`); return ms;
}

// ---------------------------------------------------------------- fish
sheet('clfood_fish.png', dusk, (ctx) => {
  const rows = [
    ['alive normal', { state: 'alive', t: 0.3 }],
    ['alive wiggle1 mouth sly', { state: 'alive', wiggle: 1, mouth: 0.8, eye: 'sly', t: 0.2 }],
    ['alive angry bend', { state: 'alive', eye: 'angry', bend: 0.35, mouth: 0.4, t: 0 }],
    ['alive dizzy', { state: 'alive', eye: 'dizzy', wiggle: 0.3, t: 1.1 }],
    ['skewered', { state: 'skewered', t: 0 }],
    ['charred + skewer', { state: 'charred', skewer: 110, t: 0.5 }],
    ['scraped k .5', { state: 'scraped', k: 0.5, skewer: 110, t: 0.5 }],
    ['plated', { state: 'plated', t: 0.5 }],
  ];
  rows.forEach(([lb, o], i) => {
    const y = 140 + i * 228;
    const a = CF.snakehead(ctx, 540, y, 0.95, o);
    label(ctx, lb, 30, y - 82);
    ctx.fillStyle = '#f0f'; for (const k of ['mouth', 'tail', 'eye', 'belly']) { ctx.beginPath(); ctx.arc(a[k][0], a[k][1], 5, 0, 7); ctx.fill(); }
  });
});

// ---------------------------------------------------------------- straw
sheet('clfood_straw.png', night, (ctx) => {
  ctx.fillStyle = '#2a2a1e'; ctx.fillRect(0, 1080, W, 840);
  const piles = [[200, 0.55, 0], [540, 1, 0], [880, 1, 0.3]];
  for (const [x, k, b] of piles) {
    const s = 0.42, gy = 760;
    CF.snakehead(ctx, x, gy - 300 * s, s, { rot: Math.PI / 2, state: b > 0.5 ? 'charred' : 'skewered', skewerA: 140, t: 0 });
    CF.strawPile(ctx, x, gy, s, { k, burn: b, t: 0.4 });
    label(ctx, `k ${k} burn ${b}`, x - 90, gy + 60);
  }
  const p2 = [[200, 0.6], [540, 0.85], [880, 1]];
  for (const [x, b] of p2) {
    const s = 0.42, gy = 1300;
    CF.snakehead(ctx, x, gy - 300 * s, s, { rot: Math.PI / 2, state: 'charred', skewerA: 140, t: 0.3 });
    CF.strawPile(ctx, x, gy, s, { k: 1, burn: b, t: 0.4 });
    label(ctx, `burn ${b}`, x - 60, gy + 60);
  }
  CF.strawArmful(ctx, 300, 1560, 1, { t: 0.5 });
  label(ctx, 'strawArmful', 200, 1660);
  CF.strawScraps(ctx, 620, 1500, 400, 200, 51);
  label(ctx, 'strawScraps', 720, 1740);
  CF.bambooSkewer(ctx, 120, 1820, 960, 1800, { w: 16 });
  CF.bambooSkewer(ctx, 120, 1870, 960, 1870, { w: 16, char: 0.7 });
});

// ---------------------------------------------------------------- spread
sheet('clfood_spread.png', '#3a2a1c', (ctx) => {
  const a = CF.lotusSpread(ctx, 540, 520, 1, { k: 1, t: 0.6, saltK: 0.6 });
  label(ctx, 'lotusSpread top k=1', 30, 50);
  ctx.fillStyle = '#f0f'; for (const k of ['fish', 'herbs', 'flowers', 'paper', 'bun', 'slices', 'salt']) { ctx.beginPath(); ctx.arc(a[k][0], a[k][1], 6, 0, 7); ctx.fill(); }
  CF.lotusSpread(ctx, 300, 1230, 0.5, { k: 0.45, t: 0.6, view: 'angle' });
  label(ctx, 'angle k=.45', 180, 1080);
  CF.lotusSpread(ctx, 800, 1230, 0.5, { k: 1, t: 0.6, view: 'angle' });
  label(ctx, 'angle k=1', 700, 1080);
  CF.chiliSalt(ctx, 160, 1560, 1, { k: 0, view: '3q' });
  CF.chiliSalt(ctx, 400, 1560, 1, { k: 0.8, t: 0.3, view: '3q' });
  const L1 = CF.lime(ctx, 640, 1500, 1, { squeeze: 0 });
  const L2 = CF.lime(ctx, 840, 1450, 1, { squeeze: 0.8, rot: 0.2 });
  CF.limeDrops(ctx, L2.drip, [840, 1700], 0.5);
  CF.lime(ctx, 640, 1700, 1, { half: false });
  CF.cucumberSlice(ctx, 120, 1800, 1); CF.starSlice(ctx, 220, 1800, 1); CF.dienDien(ctx, 360, 1790, 0.8); CF.bunCoil(ctx, 980, 1800, 0.8);
  void L1;
});

// ---------------------------------------------------------------- roll / basket / trap
sheet('clfood_roll.png', '#2e3b2a', (ctx) => {
  const st = [['flat', 1], ['filled', 0.5], ['filled', 1], ['rolled', 0.2], ['rolled', 0.42], ['rolled', 0.7], ['rolled', 1], ['bitten', 1]];
  st.forEach(([stage, k], i) => {
    const x = 270 + (i % 2) * 540, y = 200 + Math.floor(i / 2) * 330;
    CF.ricePaperRoll(ctx, x, y, 1, { stage, k, t: 0.4, dip: stage === 'bitten' ? 1 : 0 });
    label(ctx, `${stage} ${k}`, x - 120, y - 180);
  });
  CF.fishBasket(ctx, 200, 1880, 0.95, { t: 0.3, fish: 2, strap: true });
  CF.fishBasket(ctx, 470, 1880, 0.8, { t: 0.3, fish: 1, open: 0.4 });
  CF.nomTrap(ctx, 720, 1880, 0.6, { t: 0.3 });
  CF.nomTrap(ctx, 950, 1880, 0.55, { t: 0.3, k: 0.45, inside: (c) => CF.snakehead(c, 0, -120, 0.5, { wiggle: 1, t: 0.4, mouth: 0.6, eye: 'angry' }) });
});

// ---------------------------------------------------------------- fire
sheet('clfx_fire.png', night, (ctx) => {
  ctx.fillStyle = '#16180f'; ctx.fillRect(0, 1150, W, 770);
  const gx = 540, gy = 1100, s = 0.75;
  FX.fireLight(ctx, gx, gy - 200, 900, 1, { t: 0.4 });
  CF.snakehead(ctx, gx, gy - 300 * s, s, { rot: Math.PI / 2, state: 'charred', skewerA: 140, t: 0.4, rimFire: 1 });
  CF.strawPile(ctx, gx, gy, s, { k: 1, burn: 0.35, t: 0.4 });
  FX.fireSmoke(ctx, gx, gy - 650, 1, { t: 0.4, k: 1 });
  FX.strawFire(ctx, gx, gy, s, { t: 0.4, k: 0.85 });
  FX.sparks(ctx, gx, gy - 300, 1, { t: 0.4, n: 120 });
  label(ctx, 'strawFire + sparks + smoke + fireLight', 30, 50);
  const ks = [0.1, 0.3, 0.55, 0.8];
  ks.forEach((k, i) => { FX.whoosh(ctx, 140 + i * 265, 1600, 0.45, k, { seed: 3 }); label(ctx, `whoosh ${k}`, 70 + i * 265, 1820); });
  FX.emberGlow(ctx, 540, 1880, 1, { t: 0.3, k: 1, w: 300 });
});

sheet('clfx_fire_stages.png', night, (ctx) => {
  ctx.fillStyle = '#16180f'; ctx.fillRect(0, 900, W, 1020);
  [0.08, 0.35, 0.65, 1].forEach((k, i) => { const x = 140 + i * 265; CF.strawPile(ctx, x, 880, 0.32, { burn: 0.3, t: 0.7 }); FX.strawFire(ctx, x, 880, 0.32, { t: 0.7 + i * 0.37, k, seed: 1 + i }); label(ctx, 'fire k ' + k, x - 70, 930); });
  [0, 0.4, 0.8].forEach((tt, i) => { const x = 200 + i * 340; FX.strawFire(ctx, x, 1500, 0.5, { t: tt, k: 0.8, wind: i === 2 ? 0.6 : 0 }); label(ctx, i === 2 ? 'wind .6' : 't ' + tt, x - 50, 1550); });
  FX.emberGlow(ctx, 270, 1780, 1, { t: 0.3, k: 1, w: 220 }); label(ctx, 'emberGlow', 200, 1860);
  FX.steamWisps(ctx, 800, 1800, 1, { t: 0.5, k: 1, w: 200 }); label(ctx, 'steamWisps', 730, 1860);
});

// ---------------------------------------------------------------- water
sheet('clfx_water.png', (ctx) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#081226'); g.addColorStop(1, '#0d2238'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }, (ctx) => {
  [0.08, 0.25, 0.5, 0.8].forEach((k, i) => { const x = 140 + i * 265; ctx.fillStyle = 'rgba(40,70,90,0.5)'; ctx.fillRect(x - 130, 400, 260, 8); FX.splashCrown(ctx, x, 400, 0.5, k, { t: k, seed: 4 }); label(ctx, `splash ${k}`, x - 70, 470); });
  FX.ripplesNight(ctx, 270, 700, 1, { t: 0.5 });
  FX.bubbles(ctx, 800, 760, 1, { t: 0.5, n: 20 });
  FX.dropletsSlowmo(ctx, 540, 1050, 1, { t: 0.4, k: 0.5 });
  label(ctx, 'ripples / bubbles / droplets', 30, 560);
  const hit = FX.torchBeam(ctx, 150, 1350, 0.55, 800, { t: 0.4, k: 1, hit: true });
  label(ctx, 'torchBeam', 60, 1300);
  void hit;
  FX.steamWisps(ctx, 800, 1850, 1, { t: 0.5, k: 1, w: 200 });
});

// ---------------------------------------------------------------- words
sheet('clfx_words.png', dusk, (ctx) => {
  const keys = Object.keys(FX.CL_WORDS);
  keys.forEach((key, i) => { const x = 300 + (i % 2) * 480, y = 240 + Math.floor(i / 2) * 400; FX.clWord(ctx, key, x, y, 130, { t: 0.5, k: 1 }); });
  FX.comicWord(ctx, 'PHỪNG!', 300, 1500, 110, { t: 0.2, k: 0.5, en: 'FWOOSH' });
  FX.dizzy(ctx, 780, 1450, 1, 0.4, {});
  FX.slapMark(ctx, 780, 1700, 1, { k: 1 });
});

// ---------------------------------------------------------------- timings
console.log('timings (avg over 30 frames):');
const T = {};
T.alive = timeIt('snakehead alive wiggle', (c, t) => CF.snakehead(c, 540, 900, 1, { wiggle: 1, t }));
T.charred = timeIt('snakehead charred', (c, t) => CF.snakehead(c, 540, 900, 1, { state: 'charred', t, skewer: 120 }));
T.scraped = timeIt('snakehead scraped .6', (c, t) => CF.snakehead(c, 540, 900, 1, { state: 'scraped', k: 0.6, t }));
T.pile = timeIt('strawPile burn .35', (c, t) => CF.strawPile(c, 540, 1200, 1, { burn: 0.35, t }));
T.spread = timeIt('lotusSpread', (c, t) => CF.lotusSpread(c, 540, 900, 1, { t }));
T.roll = timeIt('ricePaperRoll rolled .7', (c, t) => CF.ricePaperRoll(c, 540, 900, 1, { stage: 'rolled', k: 0.7, t }));
T.basket = timeIt('fishBasket 2 fish', (c, t) => CF.fishBasket(c, 540, 1200, 1, { fish: 2, t }));
T.trap = timeIt('nomTrap', (c, t) => CF.nomTrap(c, 540, 1200, 1, { t, k: 0.4 }));
T.fire = timeIt('strawFire', (c, t) => FX.strawFire(c, 540, 1300, 1, { t, k: 1 }));
T.sparks = timeIt('sparks 120', (c, t) => FX.sparks(c, 540, 1000, 1, { t, n: 120 }));
T.smoke = timeIt('fireSmoke', (c, t) => FX.fireSmoke(c, 540, 600, 1, { t, k: 1 }));
T.combo = timeIt('fire+sparks+smoke', (c, t) => { FX.strawFire(c, 540, 1300, 1, { t, k: 1 }); FX.sparks(c, 540, 1000, 1, { t, n: 120 }); FX.fireSmoke(c, 540, 600, 1, { t, k: 1 }); });
T.light = timeIt('fireLight', (c, t) => FX.fireLight(c, 540, 1000, 900, 1, { t }));
T.whoosh = timeIt('whoosh', (c, t) => FX.whoosh(c, 540, 1000, 1, 0.5, {}));
T.torch = timeIt('torchBeam', (c, t) => FX.torchBeam(c, 100, 1000, 0.5, 900, { t, k: 1, hit: true }));
T.splash = timeIt('splashCrown', (c, t) => FX.splashCrown(c, 540, 1000, 1, 0.4, { t }));
T.bubbles = timeIt('bubbles', (c, t) => FX.bubbles(c, 540, 1000, 1, { t, n: 20 }));
T.drops = timeIt('dropletsSlowmo', (c, t) => FX.dropletsSlowmo(c, 540, 1000, 1, { t, k: 0.5 }));
T.word = timeIt('clWord', (c, t) => FX.clWord(c, 'PHUNG', 540, 900, 130, { t, k: 1 }));
T.steam = timeIt('steamWisps', (c, t) => FX.steamWisps(c, 540, 900, 1, { t, k: 1 }));
