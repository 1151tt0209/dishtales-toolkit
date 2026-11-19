// _test_ct_foodfx.js — preview sheets + timings for ct_food.js / ct_fx.js.   node _test_ct_foodfx.js [only]
'use strict';
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const CF = require('./ct_food');
const FX = require('./ct_fx');
const OUT = path.join(__dirname, 'previews'); fs.mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920, ONLY = process.argv[2] || '';
function sheet(name, bg, fn) {
  if (ONLY && !name.includes(ONLY)) return;
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  if (typeof bg === 'function') bg(ctx); else { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
  const t0 = Date.now(); fn(ctx);
  fs.writeFileSync(path.join(OUT, name), c.toBuffer('image/png'));
  console.log('wrote', name, (Date.now() - t0) + 'ms');
}
function label(ctx, txt, x, y, col = '#fff') { ctx.save(); ctx.font = 'bold 26px sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.restore(); }
function dot(ctx, p, col = '#f0f') { if (!p) return; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, 7); ctx.fill(); }
function wood(ctx) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6b4528'); g.addColorStop(1, '#3e2614'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y + 20); ctx.stroke(); } }
function night(ctx) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1430'); g.addColorStop(0.6, '#1a1838'); g.addColorStop(1, '#2a1a1a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function street(ctx) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#24314a'); g.addColorStop(1, '#6a5640'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
const TIMES = [];
function timeIt(name, fn, n = 30) {
  if (ONLY && ONLY !== 'time') return;
  const c = createCanvas(W, H), ctx = c.getContext('2d'); ctx.fillStyle = '#123'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) fn(ctx, i / 30); ctx.getImageData(0, 0, 1, 1);
  const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) { fn(ctx, i / 30); ctx.getImageData(0, 0, 1, 1); } const ms = Number(process.hrtime.bigint() - t0) / 1e6 / n;
  console.log(`  ${name.padEnd(40)} ${ms.toFixed(2)} ms`); TIMES.push([name, ms]); return ms;
}

// ================================================================ HERO PLATE
sheet('ctfood_plate_top.png', wood, (ctx) => {
  const A = CF.comTamPlate(ctx, 540, 640, 1.05, { topDown: true, t: 0.4, glaze: 0.8 });
  label(ctx, 'topDown, all items, glaze .8', 40, 60);
  for (const k of ['rice', 'chop', 'bi', 'cha', 'egg', 'yolk', 'moHanh', 'pickles', 'cucumber', 'tomato']) dot(ctx, A[k]);
  CF.comTamPlate(ctx, 290, 1500, 0.55, { topDown: true, t: 0.4, mam: 1 });
  label(ctx, 'topDown mam 1', 140, 1220);
  CF.comTamPlate(ctx, 800, 1500, 0.55, { topDown: true, t: 0.4, items: { rice: 1, chop: 0.6, bi: 1, cha: 0, egg: 0.3, moHanh: 0, pickles: 0.8 } });
  label(ctx, 'drop-in mid', 680, 1220);
});
sheet('ctfood_plate_3q.png', wood, (ctx) => {
  const A = CF.comTamPlate(ctx, 540, 560, 1.05, { sq: 0.5, t: 0.4, glaze: 0.6, steam: 0.7 });
  label(ctx, '3/4 sq .5 angle 0 steam', 40, 60);
  for (const k of ['rice', 'ricePeak', 'chop', 'bi', 'cha', 'egg', 'yolk', 'pickles']) dot(ctx, A[k]);
  CF.comTamPlate(ctx, 290, 1200, 0.55, { sq: 0.5, angle: 0.8, t: 0.4 });
  label(ctx, 'angle .8', 160, 1000);
  CF.comTamPlate(ctx, 800, 1200, 0.55, { sq: 0.5, angle: -1.6, t: 0.4, mam: 1 });
  label(ctx, 'angle -1.6 mam', 680, 1000);
  CF.comTamPlate(ctx, 290, 1700, 0.5, { sq: 0.5, t: 0.4, items: { rice: 1, chop: 0.5, bi: 0.2, cha: 0, egg: 0, moHanh: 0, pickles: 0 } });
  label(ctx, 'items chop .5', 160, 1520);
  CF.comTamPlate(ctx, 800, 1700, 0.5, { sq: 0.7, t: 0.4, items: { rice: 1, chop: 1, bi: 1, cha: 1, egg: 0.75, moHanh: 0.5, pickles: 1 } });
  label(ctx, 'sq .7 egg .75 moHanh .5', 640, 1520);
});

// ================================================================ CHOP
sheet('ctfood_chop.png', wood, (ctx) => {
  const cooks = [0, 0.2, 0.35, 0.55, 0.75, 1];
  cooks.forEach((c, i) => {
    const x = i % 2 ? 790 : 290, y = 230 + Math.floor(i / 2) * 300;
    const A = CF.porkChop(ctx, x, y, 0.95, { cook: c, t: 0.4, sparkle: c === 1 });
    label(ctx, 'cook ' + c, x - 220, y - 110);
    for (const k of ['tip', 'bone', 'grab', 'top', 'bottom']) dot(ctx, A[k]);
  });
  const fl = [0.15, 0.35, 0.5, 0.65, 0.85];
  fl.forEach((f, i) => { const x = 130 + i * 205, y = 1350; CF.porkChop(ctx, x, y, 0.5, { cook: 0.4, cookB: 1, flip: f }); label(ctx, 'flip ' + f, x - 70, y + 120); });
  CF.porkChop(ctx, 290, 1700, 0.85, { cook: 1, topDown: true, rot: 0.3 }); label(ctx, 'topDown', 120, 1580);
  CF.porkChop(ctx, 790, 1700, 0.85, { cook: 0.35, topDown: true, rot: -0.4 }); label(ctx, 'topDown marinated', 620, 1580);
});
sheet('ctfood_grill.png', night, (ctx) => {
  const A = CF.chopsOnGrill(ctx, 1.3, { x: 540, y: 700, s: 1, cook: [0.5, 0.75, 1], flipIdx: 1, flipK: 0.4, smokeTint: 'neon', heat: 1.3 });
  label(ctx, 'grill flipIdx1 flipK .4 neon smoke heat 1.3', 30, 60);
  for (const a of A.chops) dot(ctx, a.center);
  CF.chopsOnGrill(ctx, 2.1, { x: 540, y: 1500, s: 0.9, cook: 0.2, smokeDensity: 0.9, heat: 2 });
  label(ctx, 'raw, heat 2 (fanning), dense warm smoke', 30, 1180);
});
sheet('ctfood_marinade.png', wood, (ctx) => {
  const M = [
    [[{ item: 'lemongrass', k: 0.3 }], 0],
    [[{ item: 'lemongrass', k: 1 }, { item: 'garlic', k: 1 }, { item: 'shallot', k: 0.7 }], 0],
    [[{ item: 'lemongrass', k: 1 }, { item: 'garlic', k: 1 }, { item: 'shallot', k: 1 }, { item: 'honey', k: 0.5 }], 0],
    [[{ item: 'lemongrass', k: 1 }, { item: 'garlic', k: 1 }, { item: 'shallot', k: 1 }, { item: 'honey', k: 1 }, { item: 'fishsauce', k: 1 }, { item: 'milk', k: 0.6 }], 0],
    [[{ item: 'lemongrass', k: 1 }, { item: 'garlic', k: 1 }, { item: 'shallot', k: 1 }, { item: 'honey', k: 1 }, { item: 'fishsauce', k: 1 }, { item: 'milk', k: 1 }], 0.5],
    [[{ item: 'lemongrass', k: 1 }, { item: 'garlic', k: 1 }, { item: 'shallot', k: 1 }, { item: 'honey', k: 1 }, { item: 'fishsauce', k: 1 }, { item: 'milk', k: 1 }], 1],
  ];
  M.forEach(([add, toss], i) => { const x = i % 2 ? 790 : 290, y = 330 + Math.floor(i / 2) * 600; CF.marinadeBowl(ctx, 0.5, { x, y, s: 0.68, add, toss }); label(ctx, `#${i} toss ${toss}`, x - 200, y - 250); });
});
sheet('ctfood_rice.png', wood, (ctx) => {
  CF.ricePot(ctx, 290, 350, 0.75, { lid: 0, t: 0.5 }); label(ctx, 'pot lid 0', 60, 120);
  CF.ricePot(ctx, 790, 450, 0.75, { lid: 0.7, t: 0.5 }); label(ctx, 'pot lid .7', 600, 120);
  const R = CF.brokenRice(ctx, 290, 1050, 1, { R: 200, t: 0.5 }); dot(ctx, R.top); label(ctx, 'brokenRice 3q', 120, 820);
  CF.brokenRice(ctx, 790, 1000, 1, { R: 200, view: 'top', t: 0.5 }); label(ctx, 'top', 640, 760);
  CF.brokenRice(ctx, 200, 1350, 0.6, { R: 200, k: 0.6, t: 0.5 }); label(ctx, 'k .6', 140, 1240);
  const P = CF.paddleScoop(ctx, 640, 1500, 1, { rot: -0.4, t: 0.5, steam: 0.6 }); dot(ctx, P.heapTop); dot(ctx, P.handle); label(ctx, 'paddleScoop', 500, 1350);
  const S = CF.spoonBite(ctx, 300, 1750, 1, { t: 0.5 }); dot(ctx, S.tip); label(ctx, 'spoonBite', 200, 1660);
  const T = CF.tongs(ctx, 760, 1780, 0.9, { rot: -2.6, open: 0.6 }); dot(ctx, T.tip); dot(ctx, T.grip, '#0ff');
});
sheet('ctfood_sides.png', wood, (ctx) => {
  CF.biTray(ctx, 0.5, { x: 290, y: 260, s: 0.62 }); label(ctx, 'biTray', 60, 60);
  CF.biTray(ctx, 0.5, { x: 790, y: 260, s: 0.62, toss: 0.35 }); label(ctx, 'biTray toss .35', 600, 60);
  CF.chaTrung(ctx, 290, 640, 0.8, { lid: 0.4, t: 0.5 }); label(ctx, 'cha tray lid .4', 60, 440);
  const C = CF.chaTrung(ctx, 790, 640, 0.8, { lid: 1, cut: 0.5, t: 0.5 }); dot(ctx, C.knife); label(ctx, 'cut .5', 640, 440);
  CF.chaTrung(ctx, 290, 980, 0.8, { lid: 1, cut: 1, t: 0.5 }); label(ctx, 'cut 1', 60, 860);
  CF.chaTrung(ctx, 790, 960, 1.2, { mode: 'slice', rot: 0.3 }); label(ctx, 'slice', 640, 860);
  CF.moHanh(ctx, 200, 1240, 0.9, { pour: 0, t: 0.5 }); label(ctx, 'moHanh 0', 100, 1120);
  CF.moHanh(ctx, 540, 1240, 0.9, { pour: 0.4, t: 0.5 }); label(ctx, '.4', 520, 1120);
  CF.moHanh(ctx, 880, 1240, 0.9, { pour: 1, t: 0.5 }); label(ctx, '1', 860, 1120);
  CF.doChua(ctx, 200, 1480, 0.8, { mode: 'jar', lid: 0 }); CF.doChua(ctx, 470, 1480, 0.8, { mode: 'jar', lid: 0.6 });
  CF.doChua(ctx, 760, 1620, 1, { mode: 'pile' });
  CF.cucumberSlices(ctx, 680, 1820, 1, {}); CF.tomatoSlices(ctx, 920, 1820, 1, {});
});
sheet('ctfood_egg.png', wood, (ctx) => {
  const ks = [0.05, 0.18, 0.24, 0.3, 0.37, 0.45, 0.6, 0.8, undefined];
  ks.forEach((k, i) => { const x = 190 + (i % 3) * 350, y = 330 + Math.floor(i / 3) * 520; const A = CF.friedEgg(ctx, x, y, 0.75, { cracking: k, t: 0.5 }); dot(ctx, A.yolk); label(ctx, k === undefined ? 'done' : 'crack ' + k, x - 140, y - 260); });
  CF.friedEgg(ctx, 540, 1800, 0.6, { pan: false, sq: 0.5, t: 0.5 });
});
sheet('ctfood_mam.png', wood, (ctx) => {
  [0, 0.3, 0.6, 1].forEach((p, i) => { const x = 160 + (i % 2) * 480, y = 300 + Math.floor(i / 2) * 650; const A = CF.nuocMamBowl(ctx, x, y, 1, { pour: p, t: 0.5 }); dot(ctx, A.lip); label(ctx, 'pour ' + p, x - 100, y - 160); });
  CF.mamStream(ctx, [200, 1550], [700, 1800], 0.5, { t: 0.3 }); CF.mamStream(ctx, [400, 1500], [950, 1750], 1, { t: 0.3 });
});

// ================================================================ FX
sheet('ctfx_smoke.png', night, (ctx) => {
  const tints = ['warm', 'neon', 'cool', 'grey', 'dawn'];
  tints.forEach((tn, i) => { const x = 110 + i * 215; FX.charcoalSmoke(ctx, 2, { x, y: 900, w: 200, h: 800, tint: tn, density: i % 2 ? 0.9 : 0.4, s: 0.6 }); label(ctx, tn, x - 50, 950); });
  FX.steam(ctx, 1, { x: 270, y: 1700, w: 300, h: 600, k: 1 }); label(ctx, 'steam', 200, 1760);
  FX.embersGlow(ctx, 1, 760, 1700, 400, 160, { k: 1.4 }); FX.sparks(ctx, 1, { x: 760, y: 1700, w: 400, h: 600, n: 30 }); label(ctx, 'embers+sparks', 650, 1800);
});
sheet('ctfx_sizzle.png', street, (ctx) => {
  [0.1, 0.3, 0.5, 0.8].forEach((k, i) => { FX.flareUp(ctx, 1, 160 + i * 250, 450, k, { s: 1 }); label(ctx, 'flare ' + k, 100 + i * 250, 520); });
  FX.sizzle(ctx, 1, 270, 800, 1, { r: 160 }); label(ctx, 'sizzle', 220, 900);
  [0.15, 0.4, 0.8].forEach((k, i) => { FX.powderPuff(ctx, 1, 600 + i * 170, 800, k, { s: 0.7 }); });
  FX.glazeSparkle(ctx, 1, 270, 1150, 150, 1); label(ctx, 'glazeSparkle', 180, 1250);
  FX.smellLines(ctx, 1, [600, 1300], [800, 1000], 1); label(ctx, 'smellLines', 640, 1350);
  FX.fanWhoosh(ctx, 1, 270, 1550, 1, { r: 200 }); label(ctx, 'fanWhoosh', 180, 1700);
  [0.2, 0.6].forEach((k, i) => FX.sootPuff(ctx, 1, 650 + i * 200, 1550, k, { s: 0.8 })); label(ctx, 'sootPuff', 650, 1700);
  FX.coughSmoke(ctx, 1, 650, 1800, 0.4, {}); FX.coughSmoke(ctx, 1, 850, 1800, 0.8, {}); FX.dizzyStars(ctx, 1, 950, 1450, 1, {});
});
sheet('ctfx_poof.png', street, (ctx) => {
  const ks = [0.02, 0.06, 0.15, 0.3, 0.45, 0.6, 0.8, 0.95];
  ks.forEach((k, i) => {
    const x = 270 + (i % 2) * 540, y = 260 + Math.floor(i / 2) * 460;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 270, y - 230, 540, 460); ctx.clip();
    ctx.fillStyle = '#c94'; ctx.fillRect(x - 40, y - 150, 80, 300); ctx.fillStyle = '#fdb'; ctx.beginPath(); ctx.arc(x, y - 180, 40, 0, 7); ctx.fill(); // person stand-in
    FX.poofCloud(ctx, 1, x, y, 0.42, k, {}); ctx.restore();
    label(ctx, 'poof ' + k, x - 250, y - 200);
  });
});
sheet('ctfx_poof_full.png', street, (ctx) => {
  ctx.fillStyle = '#c94'; ctx.fillRect(470, 700, 140, 700); ctx.fillStyle = '#fdb'; ctx.beginPath(); ctx.arc(540, 620, 90, 0, 7); ctx.fill();
  FX.poofCloud(ctx, 1, 540, 1000, 1, 0.2, {}); label(ctx, 'poof s1 k .2 — must cover person', 40, 60);
});
sheet('ctfx_words.png', night, (ctx) => {
  FX.ctWord(ctx, 1, 'XEO', 540, 260, {}); FX.ctWord(ctx, 1, 'PHU', 540, 620, {}); FX.ctWord(ctx, 1, 'KHU', 300, 900, {});
  FX.ctWord(ctx, 1, 'NGON', 740, 1110, {}); FX.ctWord(ctx, 1, 'WOW', 240, 1345, {});
  FX.comicWord(ctx, 0.08, 980, 1680, 'XÈO XÈO!', 'SIZZLE!', { t0: 0, pal: 'sizzle', size: 110 }); label(ctx, 'pop-in t .08 at x 980 y 1680 (clamped)', 30, 1780);
});
sheet('ctfx_cta.png', street, (ctx) => {
  [0.1, 0.3, 0.8].forEach((T, i) => FX.heartPop(ctx, T, 200 + i * 300, 400, 1, { t0: 0, tap: 0.5 }));
  [0.15, 0.6, 1.2].forEach((T, i) => FX.followButton(ctx, T, 540, 800 + i * 380, { t0: 0, tap: 0.5 }));
});

// ================================================================ TIMINGS
console.log('food timings (ms/call, warm):');
timeIt('comTamPlate 3q s1', (c, t) => CF.comTamPlate(c, 540, 900, 1, { t, glaze: 0.6 }));
timeIt('comTamPlate top s1', (c, t) => CF.comTamPlate(c, 540, 900, 1, { t, topDown: true }));
timeIt('comTamPlate 3q drop-in angle', (c, t) => CF.comTamPlate(c, 540, 900, 1, { t, angle: t, items: { chop: 0.5, egg: 0.3 }, mam: 0.5, steam: 0.5 }));
timeIt('brokenRice R210', (c, t) => CF.brokenRice(c, 540, 900, 1, { t }));
timeIt('ricePot lid .5', (c, t) => CF.ricePot(c, 540, 900, 1, { t, lid: 0.5 }));
timeIt('paddleScoop', (c, t) => CF.paddleScoop(c, 540, 900, 1, { t }));
timeIt('porkChop cook1', (c, t) => CF.porkChop(c, 540, 900, 1, { t, cook: 1 }));
timeIt('porkChop flip .4', (c, t) => CF.porkChop(c, 540, 900, 1, { t, cook: 0.5, flip: 0.4 }));
timeIt('chopsOnGrill full', (c, t) => CF.chopsOnGrill(c, t, { cook: 0.8, flipIdx: 1, flipK: 0.4 }));
timeIt('marinadeBowl all items', (c, t) => CF.marinadeBowl(c, t, { add: [{ item: 'lemongrass', k: 1 }, { item: 'garlic', k: 1 }, { item: 'shallot', k: 1 }, { item: 'honey', k: 0.6 }, { item: 'fishsauce', k: 1 }, { item: 'milk', k: 0.4 }] }));
timeIt('biTray toss .3', (c, t) => CF.biTray(c, t, { toss: 0.3 }));
timeIt('chaTrung tray cut .5', (c, t) => CF.chaTrung(c, 540, 900, 1, { t, lid: 1, cut: 0.5 }));
timeIt('chaTrung slice', (c, t) => CF.chaTrung(c, 540, 900, 1, { mode: 'slice' }));
timeIt('moHanh pour .4', (c, t) => CF.moHanh(c, 540, 900, 1, { t, pour: 0.4 }));
timeIt('friedEgg done', (c, t) => CF.friedEgg(c, 540, 900, 1, { t }));
timeIt('friedEgg cracking .6', (c, t) => CF.friedEgg(c, 540, 900, 1, { t, cracking: 0.6 }));
timeIt('doChua jar', (c, t) => CF.doChua(c, 540, 900, 1, { mode: 'jar' }));
timeIt('doChua pile', (c, t) => CF.doChua(c, 540, 900, 1, {}));
timeIt('nuocMamBowl pour .6', (c, t) => CF.nuocMamBowl(c, 540, 900, 1, { t, pour: 0.6 }));
timeIt('spoonBite', (c, t) => CF.spoonBite(c, 540, 900, 1, { t }));
timeIt('tongs', (c, t) => CF.tongs(c, 540, 900, 1, {}));
console.log('fx timings:');
timeIt('charcoalSmoke dense', (c, t) => FX.charcoalSmoke(c, t, { x: 540, y: 1200, w: 600, h: 1100, density: 0.9 }));
timeIt('steam', (c, t) => FX.steam(c, t, { x: 540, y: 1200, w: 300, h: 600 }));
timeIt('sizzle', (c, t) => FX.sizzle(c, t, 540, 900, 1, {}));
timeIt('flareUp', (c, t) => FX.flareUp(c, t, 540, 900, 0.4, {}));
timeIt('sparks', (c, t) => FX.sparks(c, t, { x: 540, y: 1200, w: 600, h: 600 }));
timeIt('embersGlow', (c, t) => FX.embersGlow(c, t, 540, 1200, 600, 200, {}));
timeIt('powderPuff', (c, t) => FX.powderPuff(c, t, 540, 900, 0.4, {}));
timeIt('glazeSparkle', (c, t) => FX.glazeSparkle(c, t, 540, 900, 150, 1));
timeIt('smellLines', (c, t) => FX.smellLines(c, t, [540, 1200], [540, 800], 1));
timeIt('fanWhoosh', (c, t) => FX.fanWhoosh(c, t, 540, 900, 1, {}));
timeIt('poofCloud s1 peak', (c, t) => FX.poofCloud(c, t, 540, 1000, 1, 0.2, {}));
timeIt('poofCloud s1 thin', (c, t) => FX.poofCloud(c, t, 540, 1000, 1, 0.6, {}));
timeIt('sootPuff', (c, t) => FX.sootPuff(c, t, 540, 900, 0.4, {}));
timeIt('coughSmoke', (c, t) => FX.coughSmoke(c, t, 540, 900, 0.4, {}));
timeIt('dizzyStars', (c, t) => FX.dizzyStars(c, t, 540, 900, 1, {}));
timeIt('comicWord', (c, t) => FX.ctWord(c, t, 'XEO', 540, 600, {}));
timeIt('heartPop', (c, t) => FX.heartPop(c, 0.3 + t, 540, 600, 1, { t0: 0, tap: 0.5 }));
timeIt('followButton', (c, t) => FX.followButton(c, 0.3 + t, 540, 1200, { t0: 0, tap: 0.5 }));
if (TIMES.length) { const mx = TIMES.reduce((a, b) => (b[1] > a[1] ? b : a)); console.log('max:', mx[0], mx[1].toFixed(2), 'ms'); }
