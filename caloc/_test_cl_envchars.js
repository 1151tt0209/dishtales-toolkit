// _test_cl_envchars.js: previews + timings for cl_env.js and cl_chars.js.  node _test_cl_envchars.js
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const E = require('./cl_env');
const CH = require('./cl_chars');
const OUTD = path.join(__dirname, 'previews');
if (!fs.existsSync(OUTD)) fs.mkdirSync(OUTD);
const save = (cv, n) => { fs.writeFileSync(path.join(OUTD, n), cv.toBuffer('image/png')); console.log('wrote previews/' + n); };
// napi-rs canvas defers raster work, so every timed call is followed by a 1-px readback to force the flush
const ms = (fn, n = 1, g = null) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) { fn(i); (g || ctx).getImageData(0, 0, 1, 1); } return Number(process.hrtime.bigint() - t0) / 1e6 / n; };

// ------------------------------------------------------------------ env
const cv = createCanvas(1080, 1920), ctx = cv.getContext('2d');
const envCalls = {
  wide: (t) => E.floodField(ctx, t, { panX: 0, hut: { X: -500, Z: 2000, lamp: 0.7 }, dike: { Z: 2600 }, xuong: { x: 700, y: 1500, s: 0.55 }, torch: [300, 1100] }),
  dike: (t) => E.dikeScene(ctx, t, { view: 'wide', fire: 1 }),
  water: (t) => E.fieldWaterClose(ctx, t, { beam: { from: [300, 700], to: [600, 1500] }, hut: {}, xuong: { x: 820, y: 1000, s: 0.35 } }),
  drone: (t) => E.floodField(ctx, t, { high: 1, torch: [520, 900], torchS: 0.6, hut: { X: -300, Z: 3000, lamp: 0.8 } }),
};
const timings = {};
for (const [n, f] of Object.entries(envCalls)) {
  f(3); save(cv, 'clenv_' + n + '.png');
  ms((i) => f(3 + i / 30), 2);
  timings['env ' + n] = ms((i) => f(3.1 + i / 30), 6);
}

// ------------------------------------------------------------------ grid helper
function grid(file, W, H, cols, rows, cells, bg = ['#0b1230', '#1a2a55']) {
  const c = createCanvas(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const cw = W / cols, chh = H / rows;
  cells.forEach((cell, i) => {
    const cx = (i % cols) * cw, cy = Math.floor(i / cols) * chh;
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.strokeRect(cx, cy, cw, chh);
    g.save(); g.beginPath(); g.rect(cx, cy, cw, chh); g.clip();
    cell.fn(g, cx + cw / 2, cy + chh - 40, cw, chh);
    g.restore();
    g.fillStyle = '#ffe9a8'; g.font = 'bold 22px Arial'; g.fillText(cell.label, cx + 10, cy + 28);
  });
  save(c, file);
}
const dot = (g, p, col = '#ff3b6b') => { if (!p) return; g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], 5, 0, 7); g.fill(); };

// ------------------------------------------------------------------ Chú Ba
const T = 1.37, S = 0.78;
const cb = (pose, extra = {}) => ({ label: pose + (extra.lbl ? ' ' + extra.lbl : ''), fn: (g, x, y) => { const r = CH.chuBa(g, x, y, S, Object.assign({ pose, t: T, k: 0.6 }, extra)); dot(g, r.handR, '#ff3b6b'); dot(g, r.handL, '#3bd1ff'); dot(g, r.eyes, '#7dff6b'); } });
grid('clchars_chuba.png', 1620, 2400, 4, 5, [
  cb('stand'), cb('wade'), cb('wade', { trap: true, lbl: '+trap' }), cb('trapDown', { k: 0.15, lbl: 'k.15' }),
  cb('trapDown', { k: 1, lbl: 'k1' }), cb('skewer', { k: 0.3, lbl: 'k.3' }), cb('skewer', { k: 0.95, lbl: 'k.95' }), cb('carryStraw'),
  cb('light'), cb('squat'), cb('scrape', { k: 0.5 }), cb('laugh'),
  cb('offer'), cb('shrug'), cb('catchBasket', { basketFish: 1 }), cb('sit'),
  cb('thumbs', { wink: true, lbl: 'wink' }), cb('stand', { torch: true, basket: true, lbl: 'torch+basket' }), cb('wade', { torch: true, flip: true, lbl: 'torch flip' }),
  { label: 'chuBaFace laugh/under', fn: (g, x, y) => { CH.chuBaFace(g, x - 90, y - 300, 0.55, { expr: 'grin', t: T, torch: true, beam: false }); CH.chuBaFace(g, x + 100, y - 120, 0.4, { expr: 'laugh', t: T, under: 0.9, turn: -0.4 }); } },
]);

// ------------------------------------------------------------------ tourist
const tu = (pose, extra = {}) => ({ label: pose + (extra.lbl ? ' ' + extra.lbl : ''), fn: (g, x, y) => { const yy = extra.yOff ? y + extra.yOff : y; const r = CH.touristNight(g, x, yy, S, Object.assign({ pose, t: T, k: 0.6 }, extra)); dot(g, r.handR, '#ff3b6b'); dot(g, r.handL, '#3bd1ff'); if (r.light) dot(g, r.light.from, '#fff'); } });
grid('clchars_tourist.png', 1620, 2400, 4, 5, [
  tu('stand', { pack: true, lbl: '+pack' }), tu('phoneLight'), tu('rubHands'), tu('rollShorts'),
  tu('grab', { k: 0.9 }), tu('slipped', { k: 0.7 }), tu('slapped'), tu('wobble'),
  tu('fallBack', { k: 0.6 }), tu('popUp', { frog: true, yOff: -120, lbl: '+frog' }), tu('thumbs'), tu('sitFire'),
  tu('sitFire', { roll: true, lbl: '+roll' }), tu('bite', { k: 0.8 }), tu('bliss'), tu('stand', { wet: true, lotusHat: true, lbl: 'wet+hat' }),
  { label: 'stand knee-deep + reflect', fn: (g, x, y) => { CH.touristNight(g, x, y - 20, S, { pose: 'stand', t: T, waterline: y - 20 - 125 * S, reflect: 0.5 }); } },
  { label: 'frog sit/ribbit/jump', fn: (g, x, y) => { CH.frog(g, x - 120, y - 40, 1.6, { t: T, pose: 'sit' }); CH.frog(g, x, y - 40, 1.6, { t: T, pose: 'ribbit', k: 0.8 }); CH.frog(g, x + 120, y - 60, 1.6, { t: T, pose: 'jump' }); } },
  { label: 'egret stand/fly', fn: (g, x, y) => { CH.egret(g, x - 80, y - 20, 1.1, { t: T }); CH.egret(g, x + 90, y - 300, 0.8, { t: T, pose: 'fly' }); } },
  { label: 'popUp no frog', fn: (g, x, y) => { CH.touristNight(g, x, y - 120, S, { pose: 'popUp', t: T + 0.5 }); } },
]);


// ------------------------------------------------------------------ scene: Chú Ba wading with torch, tourist in the xuồng
function scene(t) {
  const sb = 0.62, bx = 790;
  let tr = null;
  const r = E.fieldWaterClose(ctx, t, {
    hut: { X: -900, Z: 3200, lamp: 0.7 }, midZ: 1000 / sb,
    mid: (c, R) => {
      const wy = R.wl(sb);
      const b = E.xuongMoored(c, bx, wy, sb, { t, flip: true, part: 'back' });
      tr = CH.touristNight(c, b.seat[0], b.seat[1] + 8 * sb, sb * 0.95, { pose: 'phoneLight', stand: false, t, lightAt: [bx - 330, wy + 140] });
      E.xuongMoored(c, bx, wy, sb, { t, flip: true, part: 'front', pole: false });
    },
  });
  const s = 2.0, wl = r.wl(s);
  const cbR = CH.chuBa(ctx, 300, wl + 130 * s, s, { pose: 'wade', t, torch: true, torchAt: [820, wl + 300], waterline: wl, basket: true, speed: 0.5 });
  return { r, cbR, tr };
}
let sc = scene(3);
save(cv, 'clchars_scene.png');
console.log('scene anchors', JSON.stringify({ cbEyes: sc.cbR.eyes.map(Math.round), torch: sc.cbR.torch.from.map(Math.round), tourHead: sc.tr.head.map(Math.round) }));
ms((i) => scene(3 + i / 30), 3);
timings['scene full'] = ms((i) => scene(3.2 + i / 30), 10);

// per-character
const c2 = createCanvas(1080, 1920), g2 = c2.getContext('2d');
g2.fillStyle = '#10183a'; g2.fillRect(0, 0, 1080, 1920);
const chars = {
  'chuBa wade torch s2': (i) => CH.chuBa(g2, 400, 1400, 2, { pose: 'wade', t: i / 30, torch: true, waterline: 1140 }),
  'chuBa skewer s1.5': (i) => CH.chuBa(g2, 400, 1400, 1.5, { pose: 'skewer', t: i / 30, k: (i % 30) / 30 }),
  'chuBaFace s1.2': (i) => CH.chuBaFace(g2, 540, 700, 1.2, { t: i / 30, expr: 'talk', torch: true }),
  'tourist phoneLight s1.5': (i) => CH.touristNight(g2, 540, 1500, 1.5, { pose: 'phoneLight', t: i / 30 }),
  'tourist popUp s1.5': (i) => CH.touristNight(g2, 540, 1200, 1.5, { pose: 'popUp', t: i / 30, frog: true }),
  'frog s2': (i) => CH.frog(g2, 540, 1000, 2, { t: i / 30, pose: 'ribbit' }),
};
for (const [n, f] of Object.entries(chars)) { ms(f, 3, g2); timings[n] = ms(f, 15, g2); }
console.log('\nTIMINGS (ms, steady state):');
for (const [n, v] of Object.entries(timings)) console.log('  ' + n.padEnd(28) + v.toFixed(1));
