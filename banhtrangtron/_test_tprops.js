// contact sheets for tprops.js  ->  previews/props_*.png     usage: node _test_tprops.js [env|cart|chars|food|fx|all]
'use strict';
const fs = require('fs');
const L = require('./lib');
const T = require('./tprops');
const { W, H, createCanvas } = L;
fs.mkdirSync(__dirname + '/previews', { recursive: true });
const which = process.argv[2] || 'all';
const timing = {};
function time(name, fn) { const t0 = process.hrtime.bigint(); const r = fn(); const ms = Number(process.hrtime.bigint() - t0) / 1e6; timing[name] = (timing[name] || []).concat(ms); return r; }
function sheet(name, cols, rows, cellFn, cw = W, ch = H, scale = 0.5) {
  const out = createCanvas(Math.round(cols * cw * scale), Math.round(rows * ch * scale)), o = out.getContext('2d');
  o.fillStyle = '#222'; o.fillRect(0, 0, out.width, out.height);
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
    const cv = createCanvas(cw, ch), ctx = cv.getContext('2d');
    const label = cellFn(ctx, i);
    if (label === null) continue;
    o.drawImage(cv, c * cw * scale, r * ch * scale, cw * scale, ch * scale);
    if (label) { o.font = '22px BodySansBold'; o.fillStyle = '#fff'; o.fillText(label, c * cw * scale + 10, r * ch * scale + 28); }
  }
  fs.writeFileSync(__dirname + `/previews/props_${name}.png`, out.toBuffer('image/png'));
  console.log('wrote previews/props_' + name + '.png');
}
function bg(ctx, a = '#f6c98e', b = '#1d4e57') { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

if (which === 'env' || which === 'all') sheet('env', 4, 1, (ctx, i) => {
  if (i === 0) { time('saigonAerial', () => T.saigonAerial(ctx, 1.2, 0.4)); return 'saigonAerial t1.2 camY .4'; }
  if (i === 1) { time('schoolStreet', () => T.schoolStreet(ctx, 2, 300, { crowd: true, petals: true, parents: true })); return 'schoolStreet pan300'; }
  if (i === 2) { time('schoolStreet', () => T.schoolStreet(ctx, 3, 1320, { crowd: true, cart: true, gateOpen: 1 })); return 'schoolStreet pan1320 cart'; }
  if (i === 3) { bg(ctx); T.schoolDrum(ctx, 540, 700, 1, { hit: 0.6, t: 1 }); T.motorbikeParent(ctx, 540, 1600, 1, 1, { wave: true }); return 'drum + motorbikeParent'; }
});

if (which === 'cart' || which === 'all') sheet('cart', 3, 1, (ctx, i) => {
  if (i === 0) { bg(ctx); time('btCart', () => T.btCart(ctx, 540, 1500, 1.6, { t: 1, umbrella: true })); return 'btCart s1.6'; }
  if (i === 1) { time('counterTop', () => T.counterTop(ctx, 1, {})); return 'counterTop'; }
  if (i === 2) { bg(ctx); T.chiliOilJar(ctx, 300, 900, 1.4, { spoon: true }); T.shrimpSaltJar(ctx, 760, 900, 1.4, {}); T.jar(ctx, 300, 1600, 1.2, { fill: 'peanuts', label: 'ĐẬU PHỘNG' }); T.jar(ctx, 760, 1600, 1.2, { fill: 'eggs', label: 'TRỨNG CÚT', open: true }); return 'jars'; }
});

if (which === 'chars' || which === 'all') sheet('chars', 4, 2, (ctx, i) => {
  bg(ctx, '#f9d9a0', '#3f7f86');
  if (i === 0) { time('coBa', () => T.coBa(ctx, 540, 1700, 3, { pose: 'wave', t: 0.3, bag: true })); return 'coBa wave'; }
  if (i === 1) { T.coBa(ctx, 540, 1700, 3, { pose: 'snip', t: 0.3, k: 0.5, gloves: true }); return 'coBa snip'; }
  if (i === 2) { T.coBa(ctx, 540, 1700, 3, { pose: 'shake', t: 0.3, k: 0.5, gloves: true }); return 'coBa shake'; }
  if (i === 3) { time('coBaFace', () => T.coBaFace(ctx, 540, 900, 2.2, { expr: 'laugh', t: 0.5 })); T.coBaFace(ctx, 540, 1600, 1.2, { expr: 'wink' }); return 'coBaFace laugh / wink'; }
  if (i === 4) { for (let k = 0; k < 3; k++) T.schoolKid(ctx, 220 + k * 320, 1700, 2.6, { seed: k + 1, pose: ['run', 'cheer', 'point'][k], t: 0.4 }); return 'kids run/cheer/point'; }
  if (i === 5) { for (let k = 0; k < 3; k++) T.schoolKid(ctx, 220 + k * 320, 1700, 2.6, { seed: k + 4, pose: ['eat', 'shake', 'laugh'][k], t: 0.4 }); return 'kids eat/shake/laugh'; }
  if (i === 6) { const ex = ['smile', 'shout', 'wow', 'sour', 'spicy', 'chew']; ex.forEach((e, k) => T.kidFace(ctx, 270 + (k % 2) * 540, 360 + Math.floor(k / 2) * 600, 1.4, { expr: e, seed: k + 1 })); return 'kidFace exprs'; }
  if (i === 7) { time('touristShake', () => T.touristShake(ctx, 540, 1750, 3, { pose: 'shake', t: 0.3 })); return 'touristShake shake'; }
}, W, H, 0.4);

if (which === 'food' || which === 'all') sheet('food', 4, 2, (ctx, i) => {
  bg(ctx, '#f3d7a8', '#c79a62');
  if (i === 0) { T.riceSheet(ctx, 540, 500, 2, 0.2, { light: 0.8 }); T.riceSheetStack(ctx, 540, 1150, 1.8, { n: 24 }); T.riceStrips(ctx, 540, 1700, 2.2, { n: 40 }); return 'riceSheet / stack / strips'; }
  if (i === 1) { T.scissors(ctx, 540, 450, 2, -0.3, { open: 0.8 }); T.greenMango(ctx, 380, 1000, 1.6, 0.1, { peel: 0.5 }); T.grater(ctx, 650, 1300, 1.4, -0.4); T.mangoShreds(ctx, 540, 1750, 2.4, {}); return 'scissors / mango / peeler'; }
  if (i === 2) { time('plasticBag', () => T.plasticBag(ctx, 300, 600, 1.7, { mix: 0, fill: 0.7 })); T.plasticBag(ctx, 780, 600, 1.7, { mix: 1, fill: 0.8 }); T.plasticBag(ctx, 300, 1450, 1.7, { open: 1, mix: 0, fill: 0.6 }); T.plasticBag(ctx, 780, 1450, 1.7, { mix: 0.6, shake: 1, swirl: 1, t: 0.2 }); return 'plasticBag tied/mixed/open/shake'; }
  if (i === 3) { time('bagMouthTop', () => T.bagMouthTop(ctx, 540, 560, 2, { layers: ['strips', 'mango', 'jerky', 'squid', 'eggs', 'sate', 'salt'] })); T.bagMouthTop(ctx, 540, 1400, 2, { layers: ['strips'], mix: 1 }); return 'bagMouthTop layered / mixed'; }
  if (i === 4) { for (let k = 0; k < 3; k++) T.beefJerky(ctx, 300, 300 + k * 90, 2, 0.1 * k, { seed: k }); T.driedSquidShreds(ctx, 760, 500, 2.4, { jerky: 0.4 }); T.quailEgg(ctx, 200, 900, 3, { peel: 0.4 }); T.quailEgg(ctx, 450, 900, 3, { peel: 1 }); T.quailEgg(ctx, 700, 900, 3, { half: true }); T.spoon(ctx, 540, 1300, 2.4, 0, { fill: 'sate' }); T.spoon(ctx, 540, 1600, 2.4, 0.3, { fill: 'scallion', tip: 0.4 }); return 'jerky squid eggs spoons'; }
  if (i === 5) { T.pourStream(ctx, 300, 300, 360, 900, 22, 0.3); time('saltCloud', () => T.saltCloud(ctx, 760, 300, 1.6, { t: 0.5 })); T.calamansi(ctx, 240, 1200, 3, 0); T.calamansi(ctx, 480, 1200, 3, 0, { half: true }); T.juiceDrops(ctx, 480, 1300, 2, { t: 0.3, slow: 1 }); T.rauRam(ctx, 600, 1300, 1.8, -0.2); T.rauRam(ctx, 800, 1700, 2, 0, { chopped: true }); return 'pour / salt / tắc / rau răm'; }
  if (i === 6) { T.peanuts(ctx, 300, 500, 3, {}); T.friedShallots(ctx, 780, 500, 3, {}); T.skewer(ctx, 400, 1000, 2, -0.3, { food: 'mix' }); T.skewer(ctx, 400, 1200, 2, -0.3, { food: 'egg' }); T.plasticFork(ctx, 500, 1550, 3, -0.4, { food: 'mix' }); return 'peanuts shallots skewers fork'; }
  if (i === 7) { time('traTac', () => T.traTac(ctx, 540, 1500, 3, {})); return 'traTac'; }
}, W, H, 0.4);

if (which === 'fx' || which === 'all') sheet('fx', 3, 1, (ctx, i) => {
  bg(ctx, '#ffcf8a', '#7a3a2a');
  if (i === 0) { const a = time('flavorBurst', () => T.flavorBurst(ctx, 540, 900, 1, { t: 0.5, k: 1 })); for (const p of a) { ctx.font = '48px BodySansBold'; ctx.fillStyle = '#fff3c4'; ctx.textAlign = 'center'; ctx.fillText(p.vi, p.x, p.y + 90); } return 'flavorBurst'; }
  if (i === 1) { T.plasticBag(ctx, 540, 800, 2, { mix: 1, shake: 1, t: 0.1 }); T.shakeLines(ctx, 540, 800, 2, { t: 0.1, dir: 'both' }); T.whoosh(ctx, 700, 1400, -0.4, 500, {}); return 'shakeLines + whoosh'; }
  if (i === 2) { T.sunFlare(ctx, 760, 400, 1); time('ingredientBits', () => T.ingredientBits(ctx, 540, 1100, 1, { t: 0.35 })); T.ingredientBits(ctx, 540, 1100, 1, { t: 2, loop: true, seed: 9, n: 30 }); return 'sunFlare + ingredientBits'; }
});

for (const [k, v] of Object.entries(timing)) console.log(k.padEnd(16), v.map(x => x.toFixed(1)).join(' / '), 'ms');
