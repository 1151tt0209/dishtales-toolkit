// Test sheets for pprops.js -> previews/props_*.png   (node _test_props.js [t])
const fs = require('fs');
const L = require('./lib');
const { W, H, createCanvas } = L;
const PP = require('./pprops');
const PE = require('./people');
const t = +(process.argv[2] || 1.3);
fs.mkdirSync('previews', { recursive: true });
function sheet(name, bg, fn) {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const t0 = Date.now(); fn(ctx); const ms = Date.now() - t0;
  fs.writeFileSync(`previews/props_${name}.png`, c.toBuffer('image/png'));
  console.log(name, ms + 'ms');
}
function lab(ctx, s, x, y) { ctx.save(); ctx.font = '22px BodySans'; ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'left'; ctx.fillText(s, x, y); ctx.restore(); }

sheet('env', '#000', (ctx) => {
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 640); ctx.clip();
  PP.dawnSky(ctx, 0.35, { h: 640, t }); PP.fog(ctx, t, 3, 380, 260, 0.6);
  ctx.restore(); lab(ctx, 'dawnSky k.35 + fog', 20, 30);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 640, W, 640); ctx.clip(); ctx.translate(0, 640 - 640); ctx.translate(0, 0);
  ctx.translate(0, 640); ctx.scale(1, 640 / H); const r = PP.dawnAerial(ctx, t, 0.3, 0.7); ctx.restore(); lab(ctx, 'dawnAerial camY .7 (squashed)', 20, 670);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 1280, W, 640); ctx.clip(); ctx.translate(0, 1280); ctx.scale(0.5, 0.5);
  ctx.save(); ctx.translate(0, -900); PP.dawnStreet(ctx, t, 600, { mid: (c, ox) => { PP.bicycleRider(c, 1300 + ox + 300, 1600, 1, t); PP.broomSweeper(c, 1800 + ox, 1440, 1, t); } }); ctx.restore();
  ctx.restore();
  PP.streetLamp(ctx, 640, 1900, 0.5, { t }); PP.bicycleRider(ctx, 800, 1900, 0.5, t); PP.broomSweeper(ctx, 990, 1900, 0.5, t);
  lab(ctx, 'dawnStreet panX600 (half scale, cropped) + lamp, rider, sweeper', 20, 1310);
});
sheet('env2', '#000', (ctx) => {
  PP.dawnStreet(ctx, t, 400, { mid: (c, ox) => { PP.bicycleRider(c, 900 + ox + 400, 1640, 1, t); PP.broomSweeper(c, 1200 + ox + 400, 1460, 1, t); } });
  lab(ctx, 'dawnStreet panX 400 full frame', 20, 30);
});
sheet('aerial', '#000', (ctx) => { const r = PP.dawnAerial(ctx, t, 0.3, 0.6); lab(ctx, 'dawnAerial camY .6 stall=' + r.stallX.toFixed(0) + ',' + r.stallY.toFixed(0), 20, 30); });
sheet('stall', '#2a2420', (ctx) => {
  PP.giantPot(ctx, 300, 760, 1, { lid: 'off', t, simmer: 0.7 }); lab(ctx, 'giantPot lid off', 20, 30);
  PP.giantPot(ctx, 820, 760, 0.8, { lid: 60, lidTilt: 0.2, t }); lab(ctx, 'lid lifted 60', 640, 30);
  PP.potTop(ctx, 270, 1080, 220, { t, clarity: 1, skim: 0 }); lab(ctx, 'potTop clear', 20, 840);
  PP.potTop(ctx, 790, 1080, 220, { t, clarity: 0.2, skim: 1 }); lab(ctx, 'potTop murky+skim', 560, 840);
  PP.meatCabinet(ctx, 220, 1880, 1, { t }); lab(ctx, 'meatCabinet', 20, 1340);
  PP.stallTable(ctx, 640, 1880, 1.2, {}); PP.lowStool(ctx, 960, 1880, 1.2);
  PP.icedTea(ctx, 600, 1786, 0.6, { t }); PP.phoBowl(ctx, 720, 1786, 0.4, { t, herbs: 0.6, steam: 0.5 });
  lab(ctx, 'stallTable + lowStool + bowl/tea on top', 460, 1340);
});
sheet('ongtu', '#3a3028', (ctx) => {
  const poses = ['stand', 'stir', 'lid', 'ladle', 'slurp', 'laugh', 'drum', 'present'];
  poses.forEach((p, i) => {
    const x = 120 + (i % 4) * 250, y = 900 + Math.floor(i / 4) * 900;
    PP.ongTu(ctx, x, y, 0.55, { pose: p, t, k: 0.7, shake: 0.5, bowl: true }); lab(ctx, p, x - 60, y - 640);
  });
});
sheet('ongtu2', '#3a3028', (ctx) => {
  PP.giantPot(ctx, 640, 1200, 0.9, { lid: 'off', t }); PP.ongTu(ctx, 640 - 270 * 0.9, 1200, 0.9, { pose: 'ladle', k: 0.6, t });
  lab(ctx, 'ongTu ladle + giantPot at x+270s', 20, 30);
  PP.ongTuFace(ctx, 300, 1500, 0.8, { expr: 'smile', t, body: false });
  PP.ongTuFace(ctx, 820, 1500, 0.8, { expr: 'laugh', t, body: false, shake: 0.5 });
  lab(ctx, 'face smile / laugh', 20, 1250);
});
sheet('ongtuface', '#3a3028', (ctx) => {
  PP.ongTuFace(ctx, 540, 520, 1.1, { expr: 'slurp', k: 0.5, t }); lab(ctx, 'ongTuFace slurp k.5 with body', 20, 30);
  PP.ongTuFace(ctx, 540, 1350, 0.9, { expr: 'smile', t, turn: -0.5 }); lab(ctx, 'smile turn -0.5', 20, 1060);
});
sheet('food', '#3b2a1e', (ctx) => {
  PP.phoBowl(ctx, 280, 400, 1.1, { t, herbs: 0.5, steam: 0.6 }); lab(ctx, 'phoBowl full', 20, 30);
  PP.phoBowlTop(ctx, 800, 260, 230, { t, herbs: 0.6, beef: 1, cook: 0 }); lab(ctx, 'phoBowlTop rare', 600, 30);
  PP.phoBowl(ctx, 280, 760, 0.8, { fill: 0.2, beef: 0, scallion: 0, onion: 0, noodles: 0.3 }); lab(ctx, 'fill .2', 20, 560);
  PP.phoBowlTop(ctx, 800, 680, 150, { fill: 0, noodles: 0 });
  lab(ctx, 'empty top', 660, 540);
  const items = [
    (c, x, y) => PP.charredOnion(c, x, y, 0.8, 0), (c, x, y) => PP.charredOnion(c, x, y, 0.8, 0, { cut: false }), (c, x, y) => PP.gingerKnob(c, x, y, 0.7, 0.2),
    (c, x, y) => PP.starAnise(c, x, y, 1, 0.2), (c, x, y) => PP.cinnamonStick(c, x, y, 0.7, -0.3), (c, x, y) => PP.cardamom(c, x, y, 1, 0.4), (c, x, y) => PP.clove(c, x, y, 1.6, 0.4),
    (c, x, y) => PP.beefBone(c, x, y, 0.55, 0), (c, x, y) => PP.beefBone(c, x, y, 0.9, 0, { view: 'top' }), (c, x, y) => PP.rockSugar(c, x, y, 1, 0),
    (c, x, y) => PP.fishSauceBottle(c, x, y + 60, 0.5, 0), (c, x, y) => PP.beefBlock(c, x, y + 40, 0.5, 0, { cut: 0.3 }), (c, x, y) => PP.beefSlice(c, x, y, 0.9, 0.2, {}),
    (c, x, y) => PP.beefSlice(c, x, y, 0.9, 0.2, { cook: 0.5 }), (c, x, y) => PP.beefSlice(c, x, y, 0.9, 0.2, { cook: 1 }), (c, x, y) => PP.noodleSheet(c, x, y, 0.6, 0.1),
    (c, x, y) => PP.noodleBundle(c, x, y, 0.65, 0), (c, x, y) => PP.bambooStrainer(c, x + 60, y - 40, 0.42, 0, { t }), (c, x, y) => PP.basilLeaf(c, x, y, 1.6, 0.3),
    (c, x, y) => PP.sawtooth(c, x, y, 1, -0.3), (c, x, y) => PP.beanSprout(c, x, y, 1.4, 0.2), (c, x, y) => PP.limeWedge(c, x, y - 20, 1, 0), (c, x, y) => { for (let i = 0; i < 4; i++) PP.chiliSlice(c, x - 40 + i * 28, y, 1.2); },
    (c, x, y) => PP.quay(c, x, y, 0.55, 0.1), (c, x, y) => PP.vinegarGarlicJar(c, x, y + 60, 0.8), (c, x, y) => PP.porcelainSpoon(c, x - 60, y, 0.7, 0, { fill: 1 }), (c, x, y) => PP.teaspoon(c, x - 40, y, 1, 0),
    (c, x, y) => PP.chopsticksPair(c, x - 80, y, 0.45, 0, 0.1), (c, x, y) => PP.icedTea(c, x, y + 70, 0.75, { t }), (c, x, y) => PP.ladle(c, x, y + 30, 0.3, 0.4, { fill: 1, tip: 0.3 }),
  ];
  items.forEach((f, i) => { const x = 90 + (i % 6) * 180, y = 960 + Math.floor(i / 6) * 180; f(ctx, x, y); });
  PP.herbPlate(ctx, 200, 1800 - 0, 0.4, {}); PP.brothStream(ctx, 500, 1720, 560, 1880, 22, t); PP.clockFace(ctx, 820, 1800, 90, 4.4, { blur: 0.5 });
});
sheet('night', '#000', (ctx) => {
  PP.moonAndStars(ctx, t, 0.35, { trails: 1 }); PP.clockFace(ctx, 540, 1300, 220, 3.75, { blur: 1 }); lab(ctx, 'moonAndStars k.35 trails + clockFace', 20, 30);
});
sheet('fx', '#2c2622', (ctx) => {
  PP.richSteam(ctx, t, 1, 270, 700, 200, 600, 0.8); lab(ctx, 'richSteam', 20, 30);
  PP.slurpVortex(ctx, t, 800, 100, 0.8, 1); lab(ctx, 'slurpVortex k1', 640, 30);
  PP.soundRings(ctx, 270, 1000, 0.5); PP.soundRings(ctx, 800, 1000, 0.6, { dir: -1.57, spread: 1.6 }); lab(ctx, 'soundRings full / directional', 20, 820);
  ctx.save(); ctx.beginPath(); ctx.rect(70, 1250, 400, 240); ctx.clip(); ctx.fillStyle = '#334'; ctx.fillRect(70, 1250, 400, 240); PP.steamFog(ctx, 70, 1250, 400, 240, 1, t); ctx.restore(); lab(ctx, 'steamFog', 70, 1240);
  PP.sunglasses(ctx, 780, 1360, 1.4, 0.3, { fog: 0.8, t }); lab(ctx, 'sunglasses fog .8', 640, 1240);
  PP.phoBowl(ctx, 540, 1880, 0.7, { steam: 1, t });
});
sheet('people', '#3a3430', (ctx) => {
  const st = { sit: 1, look: 0 };
  PP.lowStool(ctx, 200, 640, 1.2); PE.tourist(ctx, 200, 640, 1.2, st); PP.touristScarf(ctx, 200, 640, 1.2, st, '#c8423a'); lab(ctx, 'tourist sit + touristScarf', 20, 30);
  const st2 = { walk: t * 4 }; PE.tourist(ctx, 470, 640, 1.2, st2); PP.touristScarf(ctx, 470, 640, 1.2, st2); lab(ctx, 'walking', 400, 60);
  PP.scarf(ctx, 680, 200, 2, '#3a6ab0'); lab(ctx, 'scarf()', 620, 120);
  PP.localEater(ctx, 650, 640, 1.1, { seed: 0, k: 0.2, t }); PP.localEater(ctx, 900, 640, 1.1, { seed: 1, k: 0.9, t }); PP.localEater(ctx, 650, 1000, 1.1, { seed: 2, glance: 1, t });
  lab(ctx, 'localEater seed 0/1/2 (k.2/.9/glance)', 600, 300);
  PE.face(ctx, 300, 1300, 0.85, { glassesY: 0, glassesFn: PP.fogGlassesFn(0.9, t), shirt: true }); PP.faceScarf(ctx, 300, 1300, 0.85, '#c8423a');
  lab(ctx, 'face glassesY 0 + fog + faceScarf', 20, 1020);
  PP.fancyPinkyHand(ctx, 650, 1500, 1.6, -0.2, {}); lab(ctx, 'fancyPinkyHand', 640, 1300);
});
