// _test_ct_envchars.js : preview sheets + timings for ct_env.js / ct_chars.js.   node _test_ct_envchars.js [only]
'use strict';
const fs = require('fs'), path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const E = require('./ct_env');
const C = require('./ct_chars');
const OUT = path.join(__dirname, 'previews'); fs.mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920, ONLY = process.argv[2] || '';
const want = (n) => !ONLY || n.includes(ONLY);
function save(name, c) { fs.writeFileSync(path.join(OUT, name), c.toBuffer('image/png')); console.log('wrote', name); }
function sheet(name, bg, fn) {
  if (!want(name)) return;
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  if (typeof bg === 'function') bg(ctx); else { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }
  fn(ctx); save(name, c);
}
// full-frame cells, scaled into a cols x rows grid
const _cell = createCanvas(W, H), _cx = _cell.getContext('2d');
function grid(name, cols, rows, cells) {
  if (!want(name)) return;
  const c = createCanvas(W, H), ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  cells.forEach(([lab, fn], i) => {
    _cx.setTransform(1, 0, 0, 1, 0, 0); _cx.globalAlpha = 1; _cx.globalCompositeOperation = 'source-over';
    _cx.fillStyle = '#000'; _cx.fillRect(0, 0, W, H); fn(_cx);
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch, sc = Math.min(cw / W, ch / H);
    ctx.drawImage(_cell, x + (cw - W * sc) / 2, y + (ch - H * sc) / 2, W * sc, H * sc);
    label(ctx, lab, x + 10, y + 30, '#fff', 22);
  });
  save(name, c);
}
function label(ctx, txt, x, y, col = '#fff', sz = 26) { ctx.save(); ctx.font = `bold ${sz}px sans-serif`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y); ctx.restore(); }
function dot(ctx, p, col = '#0f0', r = 6) { if (!p) return; const x = p.x ?? p[0], y = p.y ?? p[1]; ctx.save(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }
function backdrop(ctx, d = 0.15) { const p = E.dawnPal(d); const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, E.ctCss(p.top)); g.addColorStop(0.7, E.ctCss(p.mid)); g.addColorStop(1, E.ctCss(p.hor)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function cellsBg(ctx, cols, rows) { ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; for (let i = 1; i < cols; i++) { ctx.beginPath(); ctx.moveTo(i * W / cols, 0); ctx.lineTo(i * W / cols, H); ctx.stroke(); } for (let j = 1; j < rows; j++) { ctx.beginPath(); ctx.moveTo(0, j * H / rows); ctx.lineTo(W, j * H / rows); ctx.stroke(); } }
function floorLine(ctx, y, x0, x1) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x0, y, x1 - x0, 6); ctx.restore(); }

// ================================================================ ENV
grid('ctenv_sky.png', 2, 2, [0, 0.35, 0.65, 1].map((d) => [`sky dawn ${d}`, (c) => E.sky(c, 1, { dawn: d })]));
grid('ctenv_aerial.png', 2, 2, [[0, 0], [0.5, 0.3], [0.85, 0.7], [1, 1]].map(([d, ds]) => [`aerial dawn ${d} descend ${ds}`, (c) => E.aerial(c, 1.3, { dawn: d, descend: ds })]));
for (const v of ['wide', 'cart', 'stool']) {
  sheet(`ctenv_alley_${v}.png`, '#000', (ctx) => {
    const a = E.alley(ctx, 1.2, { view: v, dawn: 0.12, neon: 1 });
    label(ctx, `alley ${v} dawn .12 neon 1`, 30, 50);
    for (const k of ['grill', 'stool', 'stool2', 'table', 'lamp', 'vendor', 'customer', 'seat']) { dot(ctx, a[k], '#0f0'); if (a[k]) label(ctx, k, a[k].x + 8, a[k].y - 8, '#0f0', 20); }
    if (a.counter) { ctx.strokeStyle = '#0f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.counter.x0, a.counter.y); ctx.lineTo(a.counter.x1, a.counter.y); ctx.stroke(); }
  });
}
grid('ctenv_alley_dawn.png', 2, 2, [[0, 1], [0.45, 0.8], [0.75, 0.4], [1, 0.2]].map(([d, n]) => [`wide dawn ${d} neon ${n}`, (c) => E.alley(c, 2, { view: 'wide', dawn: d, neon: n })]));
grid('ctenv_counter.png', 2, 2, [
  ['counter steel dawn .1', (c) => E.counterTop(c, 1, { dawn: 0.1, neon: 1 })],
  ['counter tile dawn .8', (c) => E.counterTop(c, 1, { dawn: 0.8, surface: 'tile' })],
  ['topDown steel', (c) => E.counterTop(c, 1, { topDown: true, dawn: 0.2, neon: 1 })],
  ['topDown tile', (c) => E.counterTop(c, 1, { topDown: true, surface: 'tile', dawn: 0.9 })],
]);
sheet('ctenv_grill.png', '#000', (ctx) => {
  const g = E.grillClose(ctx, 1.1, { dawn: 0.1, neon: 0.8, fan: 0.6 });
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) dot(ctx, g.rackPt(u, v));
  label(ctx, 'grillClose fan .6', 30, 50);
});
sheet('ctenv_lights.png', (c) => E.alley(c, 1, { view: 'cart', dawn: 0.7, neon: 0.5 }), (ctx) => {
  E.sunShafts(ctx, 1, {}); E.dawnTint(ctx, 0.7, 0.6); label(ctx, 'cart dawn .7 + sunShafts + dawnTint', 30, 50);
});

// ================================================================ CHARACTERS
const CN_POSES = [['stand', {}], ['fan', { k: 0.8, t: 0.1 }], ['tongs', { k: 0.5 }], ['plate', { k: 1 }], ['pour', { k: 0.8 }], ['eyebrow', {}],
  ['laugh', { t: 0.3 }], ['wipe', { t: 0.2 }], ['steer', { k: 0.7 }], ['wave', { t: 0.1 }], ['thumbs', { wink: true }], ['tongs k0', { pose: 'tongs', k: 0 }]];
sheet('ctchars_conam.png', (c) => backdrop(c, 0.2), (ctx) => {
  cellsBg(ctx, 3, 4);
  CN_POSES.forEach(([nm, op], i) => {
    const cx = (i % 3) * 360 + 170, cy = Math.floor(i / 3) * 480 + 455, s = 0.78;
    floorLine(ctx, cy, cx - 160, cx + 170);
    const o = Object.assign({ pose: nm, t: 0.5 }, op);
    if (nm === 'wipe') o.at = { x: cx + 120, y: cy - 220 };
    if (nm === 'steer') o.at = { x: cx + 115, y: cy - 310 };
    const a = C.coNam(ctx, cx, cy, s, o);
    label(ctx, nm, cx - 160, cy - 410, '#fff', 22);
    for (const k of ['handL', 'handR']) dot(ctx, a[k], '#0f0', 4);
    if (a.fan) dot(ctx, a.fan.center, '#ff0'); if (a.tongs) dot(ctx, a.tongs.tip, '#ff0'); if (a.plate) dot(ctx, a.plate, '#ff0'); if (a.pour) dot(ctx, a.pour, '#ff0'); if (a.towel) dot(ctx, a.towel, '#ff0');
    dot(ctx, a.mouth, '#f0f', 3);
  });
});
const TR_POSES = [['stand', {}], ['walk', { t: 0.15 }], ['sniff', { k: 0.8 }], ['grabFan', { k: 0.4 }], ['grabFan', { k: 1 }], ['fanFrantic', { t: 0.13 }],
  ['stiff', { k: 0.6, soot: 1, hairUp: 1, raccoon: 1 }], ['sit', {}], ['eat', { k: 0.2 }], ['eat', { k: 1 }], ['thumbs', {}], ['wink', { sit: true }]];
sheet('ctchars_tourist.png', (c) => backdrop(c, 0.45), (ctx) => {
  cellsBg(ctx, 3, 4);
  TR_POSES.forEach(([nm, op], i) => {
    const cx = (i % 3) * 360 + 150, cy = Math.floor(i / 3) * 480 + 460, s = 0.62;
    const seated = nm === 'sit' || nm === 'eat' || op.sit;
    const seatY = cy - 0.30 * 322.6 * s;
    if (seated) { ctx.fillStyle = '#c8282e'; ctx.fillRect(cx - 40, seatY, 80, cy - seatY); ctx.fillStyle = '#e8484c'; ctx.fillRect(cx - 46, seatY - 6, 92, 10); }
    floorLine(ctx, cy, cx - 140, cx + 200);
    const a = C.tourist(ctx, cx, seated ? seatY : cy, s, Object.assign({ pose: nm, t: 0.5 }, op));
    label(ctx, nm + (op.k !== undefined ? ' k' + op.k : ''), cx - 140, cy - 420, '#fff', 22);
    for (const k of ['handL', 'handR']) dot(ctx, a[k], '#0f0', 4);
    if (a.fan) dot(ctx, a.fan.center, '#ff0'); if (a.spoon) dot(ctx, a.spoon, '#ff0'); if (a.plate) dot(ctx, a.plate, '#0ff');
  });
});
sheet('ctchars_soot.png', (c) => backdrop(c, 0.3), (ctx) => {
  cellsBg(ctx, 3, 2);
  [[{}, 'clean'], [{ soot: 0.5 }, 'soot .5'], [{ soot: 1, hairUp: 1, raccoon: 1, smokeWisps: 1 }, 'full + wisps']].forEach(([o, nm], i) => {
    const cx = i * 360 + 160, cy = 900;
    C.tourist(ctx, cx, cy, 0.7, Object.assign({ pose: 'stiff', k: 0.3, t: 0.4 }, o)); label(ctx, nm, cx - 140, 100, '#fff', 22);
  });
  [[{ soot: 1, raccoon: 1, hairUp: 1, expr: 'stiff' }, 'face raccoon'], [{ soot: 1, raccoon: 1, hairUp: 0.6, blink: 0.7, expr: 'stiff', smokeWisps: 1 }, 'blink .7'], [{ soot: 0.7, expr: 'cough', hairUp: 0.4 }, 'cough']].forEach(([o, nm], i) => {
    C.touristFace(ctx, i * 360 + 180, 1420, 0.42, Object.assign({ t: 0.4 }, o)); label(ctx, nm, i * 360 + 20, 1000, '#fff', 22);
  });
});
sheet('ctchars_faces.png', (c) => backdrop(c, 0.6), (ctx) => {
  cellsBg(ctx, 3, 4);
  const cn = ['smile', 'grin', 'laugh', 'skeptic', 'talk', 'wink'], tr = ['smile', 'o', 'sniff', 'delight', 'chew', 'strain'];
  cn.forEach((e, i) => { const x = (i % 3) * 360 + 180, y = Math.floor(i / 3) * 480 + 210; ctx.save(); ctx.beginPath(); ctx.rect((i % 3) * 360, Math.floor(i / 3) * 480, 360, 480); ctx.clip(); C.coNamFace(ctx, x, y, 0.5, { expr: e, t: 0.3 }); ctx.restore(); label(ctx, 'coNamFace ' + e, x - 170, y - 175, '#fff', 20); });
  tr.forEach((e, i) => { const j = i + 6, x = (j % 3) * 360 + 180, y = Math.floor(j / 3) * 480 + 230; ctx.save(); ctx.beginPath(); ctx.rect((j % 3) * 360, Math.floor(j / 3) * 480, 360, 480); ctx.clip(); C.touristFace(ctx, x, y, 0.5, { expr: e, t: 0.3 }); ctx.restore(); label(ctx, 'touristFace ' + e, x - 170, y - 195, '#fff', 20); });
});
sheet('ctchars_extras.png', (c) => backdrop(c, 0.1), (ctx) => {
  ctx.fillStyle = '#c8282e'; ctx.fillRect(140, 400, 160, 140); ctx.fillStyle = '#e8484c'; ctx.fillRect(130, 392, 180, 14);
  C.cat(ctx, 220, 396, 1, { t: 1 }); label(ctx, 'cat', 140, 250);
  ctx.fillStyle = '#c8282e'; ctx.fillRect(560, 400, 160, 140); ctx.fillStyle = '#e8484c'; ctx.fillRect(550, 392, 180, 14);
  C.cat(ctx, 640, 396, 1, { t: 1, wake: 1, col: 'grey' }); label(ctx, 'cat wake grey', 560, 250);
  ctx.fillStyle = '#0d0c26'; ctx.fillRect(0, 760, W, 30);
  C.rooster(ctx, 260, 760, 1, { crow: 0 }); C.rooster(ctx, 700, 760, 1, { crow: 1 }); label(ctx, 'rooster crow 0 / 1', 140, 560);
  C.quatNan(ctx, 160, 1150, 1, 0); C.quatNan(ctx, 420, 1150, 1, 0.5, { blur: 1 }); label(ctx, 'quatNan / blur', 60, 900);
  // lighting variants
  C.coNam(ctx, 720, 1820, 0.62, { pose: 'fan', k: 0.6, t: 0.2, dawn: 0.1, light: { x: 900, y: 1640, k: 1 }, neon: { col: 'pink', x: 520, y: 1300, k: 0.8 } });
  label(ctx, 'dawn .1 + ember + pink neon', 560, 1440, '#fff', 20);
  C.tourist(ctx, 940, 1820, 0.5, { pose: 'sniff', k: 0.5, dawn: 0.5, neon: { col: 'cyan', side: 1, k: 1 } });
});
// ================================================================ SCENE COMPOSITE
sheet('ctscene_alley.png', '#000', (ctx) => {
  const o = { view: 'wide', dawn: 0.15, neon: 1, t: 1.4 };
  const a = E.alley(ctx, 1.4, Object.assign({ layer: 'back' }, o));
  const nL = { col: 'pink', x: a.neon.x, y: a.neon.y, k: 0.8 };
  if (a.stool2) C.cat(ctx, a.stool2.x, a.stool2.y, a.stool2.s, { t: 1.4 });
  C.coNam(ctx, a.vendor.x, a.vendor.y, a.vendor.s, { pose: 'fan', k: 0.7, t: 1.4, dawn: 0.15, light: { x: a.grill.x, y: a.grill.y, k: 0.9 }, neon: nL });
  E.alley(ctx, 1.4, Object.assign({ layer: 'cart' }, o));
  C.tourist(ctx, a.customer.x, a.customer.y, a.customer.s, { pose: 'sniff', k: 0.6, t: 1.4, dawn: 0.15, light: { x: a.grill.x, y: a.grill.y, k: 0.6 }, neon: nL });

  E.alley(ctx, 1.4, Object.assign({ layer: 'stools' }, o));
  E.alley(ctx, 1.4, Object.assign({ layer: 'front' }, o));
  label(ctx, 'scene: back / coNam fan / cart / tourist sniff / stools / front', 20, 40, '#fff', 22);
});
sheet('ctscene_stool.png', '#000', (ctx) => {
  const o = { view: 'stool', dawn: 0.75, neon: 0.4, t: 2 };
  const a = E.alley(ctx, 2, Object.assign({ layer: 'back' }, o));
  E.alley(ctx, 2, Object.assign({ layer: 'cart' }, o));
  E.alley(ctx, 2, Object.assign({ layer: 'stools' }, o));
  C.tourist(ctx, a.seat.x, a.seat.y, a.seat.s, { pose: 'eat', k: 0.7, t: 2, dawn: 0.75 });
  E.alley(ctx, 2, Object.assign({ layer: 'front' }, o));
  E.sunShafts(ctx, 2, { k: 0.6 });
  label(ctx, 'stool view dawn .75: tourist eat at a.seat', 20, 40, '#fff', 22);
});

// ================================================================ TIMINGS
if (!ONLY || ONLY === 'time') {
  const c = createCanvas(W, H), ctx = c.getContext('2d');
  const T = (name, fn, n = 20) => {
    for (let i = 0; i < 3; i++) fn(ctx, i / 30); ctx.getImageData(0, 0, 1, 1);
    const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) { fn(ctx, i / 30); ctx.getImageData(0, 0, 1, 1); }
    console.log(`  ${name.padEnd(44)} ${(Number(process.hrtime.bigint() - t0) / 1e6 / n).toFixed(2)} ms`);
  };
  console.log('TIMINGS (warm, per call):');
  T('sky', (x, t) => E.sky(x, t, { dawn: 0.3 }));
  T('aerial descend .5', (x, t) => E.aerial(x, t, { dawn: 0.3, descend: 0.5 }));
  T('alley wide all', (x, t) => E.alley(x, t, { view: 'wide', dawn: 0.2, neon: 1 }));
  T('alley cart all', (x, t) => E.alley(x, t, { view: 'cart', dawn: 0.2, neon: 1 }));
  T('alley stool all', (x, t) => E.alley(x, t, { view: 'stool', dawn: 0.2, neon: 1 }));
  T('counterTop', (x, t) => E.counterTop(x, t, { dawn: 0.2, neon: 1 }));
  T('grillClose', (x, t) => E.grillClose(x, t, { dawn: 0.2, fan: 0.5 }));
  ctx.fillStyle = '#123'; ctx.fillRect(0, 0, W, H);
  T('coNam fan (plain)', (x, t) => C.coNam(x, 540, 1500, 1, { pose: 'fan', k: 0.7, t }));
  T('coNam fan dawn+ember+neon', (x, t) => C.coNam(x, 540, 1500, 1, { pose: 'fan', k: 0.7, t, dawn: 0.2, light: { x: 700, y: 1300, k: 1 }, neon: { col: 'pink', side: -1 } }));
  T('coNam s=2 lit', (x, t) => C.coNam(x, 540, 1900, 2, { pose: 'plate', k: 1, t, dawn: 0.5, light: { x: 900, y: 1500, k: 1 } }));
  T('coNamFace lit', (x, t) => C.coNamFace(x, 540, 800, 1, { expr: 'talk', t, dawn: 0.3, neon: { col: 'cyan', side: 1 } }));
  T('tourist walk (plain)', (x, t) => C.tourist(x, 540, 1500, 1, { pose: 'walk', t }));
  T('tourist fanFrantic soot lit', (x, t) => C.tourist(x, 540, 1500, 1, { pose: 'fanFrantic', t, soot: 1, hairUp: 1, raccoon: 1, smokeWisps: 1, dawn: 0.3, light: { x: 800, y: 1200, k: 1 } }));
  T('touristFace lit', (x, t) => C.touristFace(x, 540, 800, 1, { expr: 'chew', t, dawn: 0.3, neon: { col: 'pink', side: -1 } }));
  T('cat', (x, t) => C.cat(x, 540, 1000, 1, { t }));
  T('rooster', (x, t) => C.rooster(x, 540, 1000, 1, { crow: 0.5, t }));
}
