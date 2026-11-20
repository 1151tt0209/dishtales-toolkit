// ============================================================================
// ct_env.js : CƠM TẤM SÀI GÒN environments + light helpers   (1080x1920, 30 fps)
// ----------------------------------------------------------------------------
// Look: 5 AM blue hour turning into sunrise. Deep cobalt / indigo + neon magenta
// & cyan + charcoal-ember orange  ->  violet / rose  ->  peach sunrise.
// Everything is deterministic (seeded L.rng, no Math.random), every drawer
// save()/restore()s, static parts are cached in module-level offscreen canvases
// (keyed by view / variant) and cross-faded between a NIGHT (dawn 0) and a
// SUNRISE (dawn 1) variant; the live parts (sky, neon, lamps, coals, smoke)
// are drawn per frame.
//
// `dawn` everywhere: 0 = 5 AM cobalt + stars, 0.5 = violet / rose, 1 = peach
// sunrise (sun disc). Use the same value for env + characters + dawnTint.
//
// ---- palette ---------------------------------------------------------------
// dawnPal(d) -> { top, mid, hor, amb, key, fog : [r,g,b], star, lamp, sun }
//   sky colours, ambient (amb), key/rim light (key), haze (fog);
//   star = star alpha, lamp = sodium-lamp level, sun = sun-disc progress.
// ctCss(rgbArray|hex, alpha) -> css string. ctMix(a, b, t) -> [r,g,b].
//
// ---- sky -------------------------------------------------------------------
// sky(ctx, t, o) : fills the whole frame.
//   o.dawn 0..1, o.hy horizon y (default 1190), o.sunX (default 713),
//   o.stars (0 hides), o.seed.
//   -> { hy, sun:{x,y,r,k}, pal }
//
// ---- aerial (s1 drone shot) -------------------------------------------------
// aerial(ctx, t, o) : oblique drone view over Saigon rooftops toward the
//   sunrise: tube houses, stainless water tanks, TV antennas, tangled power
//   lines, lit windows, sodium halos along the alleys, a main road, a far
//   skyline with a Bitexco-like tower (blinking red light), a thin pink
//   horizon line, and a charcoal smoke column rising from one alley.
//   o.dawn 0..1, o.descend 0..1 (push-down: zoom 0.8 -> 1.55 toward the
//   smoke alley, sky slides out the top), o.smoke 0..1 (default 1),
//   o.drift (px of slow lateral drone drift, default 10).
//   -> { smoke:{x,y} (column base, screen), tower:{x,y} (tower tip),
//        horizon (screen y), zoom, toScreen(wx,wy) -> [x,y], pal }
//
// ---- alley / hẻm (eye level, one-point perspective) --------------------------
// Drawn in LAYERS so characters can stand between them. Recommended order:
//   alley(ctx,t,{...o, layer:'back'})    sky, houses, balconies, bougainvillea,
//                                        laundry, wires, pole, street lamp,
//                                        neon sign (+ its glow / floor reflection)
//   ...characters BEHIND the cart (Cô Năm at a.vendor)...
//   alley(ctx,t,{...o, layer:'cart'})    stainless cart: glass case, rice pot,
//                                        charcoal grill on its LEFT end (live coal
//                                        glow, embers, smoke lit by the neon)
//   ...characters standing in the alley (a.customer)...
//   alley(ctx,t,{...o, layer:'stools'})  red plastic stools
//   ...seated characters (a.seat)...
//   alley(ctx,t,{...o, layer:'front'})   low steel table + foreground plant
// layer:'all' (default) draws everything. alleyBack(ctx,t,o) = back+cart,
// alleyFront(ctx,t,o) = stools+front.
//   o.view 'wide' | 'cart' | 'stool'   (zoom 1 / 1.9 / 2.0 of the same set)
//   o.dawn 0..1, o.neon 0..1 (sign brightness; feed neonFlicker()),
//   o.smoke 0..1 (grill smoke, default 0.6), o.heat 0..1 (coals, default 1),
//   o.lamp 0..1 (override sodium lamp; default from dawn), o.steam (rice pot, def 1)
//   -> anchors, all in SCREEN coords of the chosen view:
//     grill   {x,y}        grill rack top centre (put the sườn here)
//     counter {x0,x1,y}    counter-top line in front of the glass case
//     stool   {x,y}        main red-stool seat centre (tourist sits here)
//     stool2  {x,y,s}      spare stool seat right of the cart, behind the pole (sleeping cat)
//     table   {x,y}        low table top centre (plate goes here)
//     neon    {x,y,w,h}    sign centre + size
//     lamp    {x,y}        sodium lamp bulb
//     floor   y            floor line at the cart front (z = 7 m)
//     vendor  {x,y,s}      Cô Năm's feet behind the grill + char scale
//     customer{x,y,s}      standing spot in front of the cart (z = 6.2 m)
//     seat    {x,y,s}      seated tourist: x/y = stool seat, s = char scale
//     proj(X,Y,Z) -> [x,y]  metres -> screen (X right, Y up, Z depth; eye 1.6 m)
//     pxm(Z)  px per metre at depth Z;  floorAt(Z) floor y;  sAt(Z) char scale
//     zoom, view
//   Character scale convention: 1 m = 322.6 px at s = 1 (Cô Năm 500 px = 1.55 m,
//   tourist ~600 px = 1.85 m), so s = sAt(Z) works for both rigs.
//
// ---- counter top -------------------------------------------------------------
// counterTop(ctx, t, o) : full-frame background for plating / eating close-ups.
//   o.topDown (bool), o.surface 'steel' | 'tile' (blue-white tiles),
//   o.dawn, o.neon 0..1 (pink / cyan reflections), o.edge (y of the far edge
//   in the low-angle view, default 1080).
//   -> { edge, center:{x,y}, proj(u,v) -> {x,y,s} } u -1..1 across, v 0 (far)..1 (near)
//
// ---- grill close-up ------------------------------------------------------------
// grillClose(ctx, t, o) : close charcoal grill seen from above at ~55 degrees:
//   glowing coal bed (breathing hot spots), stainless wire rack, sooty brazier
//   rim, cart edge with fire reflections, bokeh alley behind.
//   o.heat 0..1 (default 1), o.fan 0..1 (fanning: brighter, more sparks),
//   o.dawn, o.neon, o.smoke 0..1 (default 0.5), o.rack (false hides rack)
//   -> { rackPt(u,v) -> {x,y,s} (u 0..1 left->right, v 0 far ..1 near, s = local
//        scale 0.67..1 for meat), rack:{x0,y0,x1,y1}, center:{x,y}, coal:{x,y} }
//
// ---- light helpers (all screen-composited, cheap) ---------------------------------
// neonLight(ctx, x, y, r, k=1, col='255,70,170')  soft neon spill (col 'r,g,b' or hex)
// neonFlicker(t, t0=0, dur=1, seed=7) -> 0..1      sign stutters on between t0..t0+dur, then hums
// lampPool(ctx, x, y, r, k=1, o)                   sodium pool on the floor (o.flat 0.3,
//                                                  o.col, o.from:{x,y} adds a light cone)
// sunShafts(ctx, t, o)                             warm rays through smoke + motes
//   o.x,o.y source (default top-right, off frame), o.angle (rad, default 2.05),
//   o.spread (0.55), o.len (2400), o.n (9), o.k (1), o.col ('255,196,130'), o.motes (true)
// dawnTint(ctx, d, k=1)                            full-frame soft-light grade for dawn d
//
// ---- TIMINGS (see _test_ct_envchars.js, warm cache, 1080x1920) ----------------------
//   one fresh process, ms per call (layers cached per view/variant after 1st frame):
//   sky ~7 | aerial(descend .5) ~40 | alley wide ~20 | alley cart ~29 | alley stool ~19
//   counterTop ~8 | grillClose ~21. First frame of a new alley view builds its layer caches (~65-85 ms);
//   the first aerial frame ~370 ms (city cache).
// ============================================================================
'use strict';
const L = require('./lib');
const B = require('./bprops');
const { W, H, TAU, rng, clamp, lerp, inv, createCanvas } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- colour utils
const _hc = new Map();
function hx(c) {
  if (typeof c !== 'string') return c;
  let v = _hc.get(c); if (v) return v;
  const n = parseInt(c.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; _hc.set(c, v); return v;
}
function ctMix(a, b, t) { a = hx(a); b = hx(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function ctCss(c, al = 1) { c = hx(c); return al >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`; }
const rgbs = (c) => { c = hx(c); return `${c[0] | 0},${c[1] | 0},${c[2] | 0}`; };
function key3(d, a, b, c) { d = clamp(d); return d < 0.5 ? ctMix(a, b, d * 2) : ctMix(b, c, (d - 0.5) * 2); }
// multiply a paint colour by a light colour [r,g,b] (0..1.2) + optional fog mix
function litc(base, light, fog, fk = 0, al = 1) {
  const b = hx(base);
  let c = [Math.min(255, b[0] * light[0]), Math.min(255, b[1] * light[1]), Math.min(255, b[2] * light[2])];
  if (fog && fk > 0) c = ctMix(c, fog, fk);
  return ctCss(c, al);
}

function dawnPal(d = 0) {
  d = clamp(d);
  return {
    d,
    top: key3(d, '#050a26', '#221a57', '#3d62ab'),
    mid: key3(d, '#0f2160', '#5a3a8c', '#c592b6'),
    hor: key3(d, '#22437f', '#d66d8f', '#ffc28c'),
    amb: key3(d, '#2b3f80', '#7a5294', '#f0b49a'),
    key: key3(d, '#6d8fe0', '#e081b0', '#ffd2a0'),
    fog: key3(d, '#1a2a5c', '#5c4580', '#d9a3a0'),
    star: clamp(1 - d * 1.7), lamp: 1 - 0.7 * inv(0.55, 1, d), sun: inv(0.55, 1, d),
  };
}

// ------------------------------------------------------------- light helpers
function colStr(col) { return typeof col === 'string' && col[0] === '#' ? rgbs(col) : col; }
function neonLight(ctx, x, y, r, k = 1, col = '255,70,170') {
  if (k <= 0.005) return;
  const c = colStr(col);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  let g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${c},${0.42 * k})`); g.addColorStop(0.4, `rgba(${c},${0.16 * k})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const r2 = r * 0.32;
  g = ctx.createRadialGradient(x, y, 0, x, y, r2);
  g.addColorStop(0, `rgba(${c},${0.5 * k})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r2, y - r2, r2 * 2, r2 * 2);
  ctx.restore();
}
function neonFlicker(t, t0 = 0, dur = 1, seed = 7) {
  if (t < t0) return 0;
  const u = (t - t0) / dur;
  if (u >= 1) return 0.93 + 0.07 * Math.sin(t * 41 + seed) * Math.sin(t * 5.3 + seed);
  const f = Math.floor(t * 22);
  const r = rng(seed * 7919 + f * 31)();
  return r < u * u * 0.85 + 0.1 ? 0.5 + 0.5 * u : 0.04 * u;
}
function lampPool(ctx, x, y, r, k = 1, o = {}) {
  if (k <= 0.005) return;
  const c = colStr(o.col || '255,164,72'), fl = o.flat === undefined ? 0.3 : o.flat;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  if (o.from) {
    const g = ctx.createLinearGradient(o.from.x, o.from.y, x, y);
    g.addColorStop(0, `rgba(${c},${0.32 * k})`); g.addColorStop(1, `rgba(${c},${0.05 * k})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(o.from.x - r * 0.06, o.from.y); ctx.lineTo(o.from.x + r * 0.06, o.from.y);
    ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x - r * 0.8, y); ctx.closePath(); ctx.fill();
  }
  ctx.translate(x, y); ctx.scale(1, fl);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${c},${0.55 * k})`); g.addColorStop(0.35, `rgba(${c},${0.28 * k})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}
function sunShafts(ctx, t, o = {}) {
  const x = o.x === undefined ? W * 1.02 : o.x, y = o.y === undefined ? -160 : o.y;
  const ang = o.angle === undefined ? 2.05 : o.angle, spread = o.spread === undefined ? 0.55 : o.spread;
  const len = o.len || 2400, n = o.n || 9, k = o.k === undefined ? 1 : o.k, c = colStr(o.col || '255,196,130');
  if (k <= 0) return;
  const r = rng(o.seed || 55);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const a = ang + (n > 1 ? (i / (n - 1) - 0.5) : 0) * spread + (r() - 0.5) * 0.05 + Math.sin(t * 0.35 + i * 1.3) * 0.012;
    const w = 0.012 + r() * 0.03, al = k * (0.10 + 0.14 * r()) * (0.65 + 0.35 * Math.sin(t * 0.9 + i * 2.1));
    const ca = Math.cos(a), sa = Math.sin(a);
    const g = ctx.createLinearGradient(x, y, x + ca * len, y + sa * len);
    g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(0.18, `rgba(${c},${al})`); g.addColorStop(0.65, `rgba(${c},${al * 0.55})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len);
    ctx.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len);
    ctx.closePath(); ctx.fill();
  }
  if (o.motes !== false) {
    const rm = rng((o.seed || 55) + 1);
    for (let i = 0; i < 70; i++) {
      const a = ang + (rm() - 0.5) * spread * 0.9, dd = len * (0.15 + rm() * 0.6);
      const px = x + Math.cos(a) * dd + Math.sin(t * 0.6 + i) * 18, py = y + Math.sin(a) * dd + ((t * (8 + rm() * 14) + rm() * 200) % 200) - 100;
      const s = 1.2 + rm() * 2.6;
      ctx.globalAlpha = k * (0.25 + 0.5 * rm()) * (0.5 + 0.5 * Math.sin(t * 2 + i));
      ctx.fillStyle = `rgb(${c})`; ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
function dawnTint(ctx, d, k = 1) {
  if (k <= 0) return;
  const p = dawnPal(d);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.6 * k;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, ctCss(p.key)); g.addColorStop(1, ctCss(p.amb));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (p.sun > 0) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.12 * p.sun * k; ctx.fillStyle = '#ffb27a'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

// ---------------------------------------------------------------------- sky
function sky(ctx, t, o = {}) {
  const d = clamp(o.dawn || 0), p = dawnPal(d), hy = o.hy === undefined ? H * 0.62 : o.hy, sx = o.sunX === undefined ? W * 0.66 : o.sunX;
  ctx.save();
  const g = ctx.createLinearGradient(0, Math.min(0, hy - 1400), 0, Math.max(H, hy + 200));
  const span = Math.max(H, hy + 200) - Math.min(0, hy - 1400), y0 = Math.min(0, hy - 1400);
  const sp = (y) => clamp((y - y0) / span);
  g.addColorStop(0, ctCss(p.top)); g.addColorStop(sp(hy - 620), ctCss(p.top)); g.addColorStop(sp(hy - 300), ctCss(p.mid));
  g.addColorStop(sp(hy), ctCss(p.hor)); g.addColorStop(1, ctCss(ctMix(p.hor, p.mid, 0.55)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  if (p.star > 0.01 && o.stars !== 0) {
    const r = rng(o.seed || 71);
    for (let i = 0; i < 190; i++) {
      const x = r() * W, yy = r() * (hy - 60), big = r() < 0.07, s = big ? 2.4 : 0.9 + r() * 1.4, sp2 = 1 + r() * 2.5, br = 0.4 + 0.6 * r(), cool = r() < 0.25;
      const a = p.star * br * (0.6 + 0.4 * Math.sin(t * sp2 + i)) * clamp(1.15 - yy / hy);
      if (a < 0.03 || yy < 0) continue;
      ctx.globalAlpha = a; ctx.fillStyle = cool ? '#bfe0ff' : '#fff4e6'; ctx.fillRect(x, yy, s, s);
      if (big) { ctx.globalAlpha = a * 0.5; ctx.fillRect(x - 4, yy + 0.8, s + 8, 0.9); ctx.fillRect(x + 0.8, yy - 4, 0.9, s + 8); }
    }
    ctx.globalAlpha = 1;
  }
  // high cirrus streaks (underside lit)
  {
    const r = rng((o.seed || 71) + 5), cc = key3(d, '#2e4a96', '#f087a8', '#ffd9b4'), dk = key3(d, '#0c1846', '#3a2a6a', '#b07a9a');
    for (let i = 0; i < 9; i++) {
      const len = 260 + r() * 520, th = 8 + r() * 22;
      const cx = ((r() * 1.6 - 0.3) * W + t * (5 + r() * 6)) % (W * 1.5) - W * 0.1, cy = hy * (0.18 + r() * 0.62);
      const al = (0.22 + 0.5 * d) * (0.5 + 0.5 * r()) * clamp(0.4 + cy / hy);
      for (const [dy, col, aa] of [[-th * 0.5, dk, 0.5], [0, cc, 1]]) {
        ctx.save(); ctx.translate(cx, cy + dy); ctx.scale(1, th / len);
        const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
        gg.addColorStop(0, ctCss(col, al * aa)); gg.addColorStop(0.6, ctCss(col, al * aa * 0.35)); gg.addColorStop(1, ctCss(col, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, len, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
  }
  // horizon glow + thin pink line
  {
    const lc = rgbs(key3(d, '#ff5fa6', '#ff8aa6', '#ffe2b8')), la = 0.55 + 0.35 * d;
    const gg = ctx.createLinearGradient(0, hy - 260, 0, hy + 40);
    gg.addColorStop(0, `rgba(${lc},0)`); gg.addColorStop(0.8, `rgba(${lc},${0.22 * la})`); gg.addColorStop(0.985, `rgba(${lc},${la})`); gg.addColorStop(1, `rgba(${lc},0)`);
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = gg; ctx.fillRect(0, hy - 260, W, 300);
    ctx.fillStyle = `rgba(${lc},${la})`; ctx.fillRect(0, hy - 2.5, W, 2.5);
    ctx.globalCompositeOperation = 'source-over';
  }
  // sun
  let sy = hy + 60, sr = 62;
  if (p.sun > 0) {
    sy = hy + 50 - p.sun * 190;
    L.glow(ctx, sx, sy, 640, 'rgba(255,184,128,0.85)', 0.7 * p.sun);
    L.glow(ctx, sx, sy, 230, 'rgba(255,232,196,1)', 0.75 * p.sun);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hy); ctx.clip();
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sg.addColorStop(0, '#fffdf4'); sg.addColorStop(0.75, '#fff0cc'); sg.addColorStop(1, '#ffd49a');
    ctx.globalAlpha = Math.min(1, p.sun * 2); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  return { hy, sun: { x: sx, y: sy, r: sr, k: p.sun }, pal: p };
}

// ================================================================== AERIAL
// world canvas CW x CH (cached at CS x), ground projection with camera height HC
const AE = { CW: 1350, CH: 2400, CS: 1.2, HY: 600, F: 1100, HC: 100, CX: 675 };
const aP = (X, Y, Z) => [AE.CX + AE.F * X / Z, AE.HY + AE.F * (AE.HC - Y) / Z];
const PAINTS = ['#e8cf86', '#9fd0b8', '#eaa3a0', '#9ec1e0', '#e6c9a8', '#c9b3d9', '#efe4cf', '#b9cc98', '#f2b880', '#d8d4cc'];
let AER = null; // { rows, base:[c0,c1], lights, smokeW:{X,Y,Z} }

function aerialData() {
  const r = rng(808);
  const rows = [];
  let Z = 52, ri = 0, smokeRow = -1;
  while (Z < 1500) {
    const far = Z > 380;
    const depth = 14 + r() * 6;
    const gapKind = ri === 7 ? 'road' : 'alley';
    const gap = gapKind === 'road' ? 22 : 3 + r() * 1.5;
    const xr = 0.62 * (Z + depth) + 12, houses = [];
    let X = -xr + r() * 3;
    while (X < xr) {
      const w = 3.8 + r() * 2.4, fl = r() < 0.04 && !far ? 7 + Math.floor(r() * 5) : 2 + Math.floor(r() * 4.2);
      const h = 3.6 + (fl - 1) * 3.3 + 0.8;
      houses.push({
        X0: X, X1: X + w - 0.25, h, fl, paint: PAINTS[Math.floor(r() * PAINTS.length)],
        roof: r() < 0.22 ? 'tin' : r() < 0.15 ? 'garden' : 'flat', tin: r() < 0.5 ? '#5d8fb2' : '#a8653e',
        tank: r() < 0.55 ? (r() < 0.75 ? 'inox' : 'blue') : null, tx: r(), tz: r(), ant: r() < 0.4, ax: r(),
        lit: Array.from({ length: fl }, () => r() < 0.28 ? (r() < 0.2 ? 2 : 1) : 0), seed: Math.floor(r() * 1e6),
      });
      X += w;
    }
    rows.push({ Zf: Z, Zb: Z + depth, houses, gapKind, gap, far, ri });
    if (smokeRow < 0 && Z + depth > 74) smokeRow = rows.length - 1;
    Z += depth + gap; ri++;
  }
  const sr = rows[smokeRow];
  return { rows, smoke: { X: -4.5, Y: 9, Z: sr.Zb + sr.gap * 0.5 } };
}

const AV0 = { roof: [0.42, 0.5, 0.88], face: [0.17, 0.2, 0.4], side: [0.26, 0.3, 0.56], fog: '#1d2d62', rim: null, tank: ['#38457a', '#8a9ad0'] };
const AV1 = { roof: [1.02, 0.84, 0.8], face: [0.42, 0.34, 0.48], side: [0.62, 0.5, 0.58], fog: '#d6a3a3', rim: '#ffd7a8', tank: ['#9a8a9a', '#fff0dc'] };

function drawAerialWorld(c, data, V, lights) {
  // far haze ground
  c.fillStyle = ctCss(ctMix(V.fog, '#000000', 0.25)); c.fillRect(0, AE.HY, AE.CW, AE.CH - AE.HY);
  // skyline (cheated 2D silhouettes on the horizon)
  if (!lights) drawSkyline(c, V);
  else skylineLights(c);
  const rows = data.rows;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i], fk = Math.pow(clamp((row.Zf - 50) / 1100), 0.6) * 0.92;
    // gap ground (road or alley floor) behind this row
    if (!lights) {
      const [, gy0] = aP(0, 0, row.Zb + row.gap), [, gy1] = aP(0, 0, row.Zb);
      c.fillStyle = litc(row.gapKind === 'road' ? '#55565e' : '#4a4a50', V.side, V.fog, fk); c.fillRect(0, gy0, AE.CW, gy1 - gy0 + 1);
    } else if (!row.far || row.gapKind === 'road') {
      // sodium halos above the alley behind the row
      const rr = rng(row.ri * 13 + 5), Zm = row.Zb + row.gap * 0.5, xr = 0.62 * Zm;
      const nl = row.gapKind === 'road' ? 14 : 6;
      for (let k = 0; k < nl; k++) {
        const X = -xr + rr() * xr * 2, [lx, ly] = aP(X, row.gapKind === 'road' ? 2 : 7, Zm), rad = AE.F * (row.gapKind === 'road' ? 9 : 6) / Zm;
        const g = c.createRadialGradient(lx, ly, 0, lx, ly, rad);
        g.addColorStop(0, 'rgba(255,170,80,0.55)'); g.addColorStop(0.3, 'rgba(255,140,60,0.22)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = g; c.fillRect(lx - rad, ly - rad, rad * 2, rad * 2);
        c.fillStyle = 'rgba(255,220,160,0.9)'; c.fillRect(lx - 1.2, ly - 1.2, 2.4, 2.4);
      }
      if (row.gapKind === 'road') { // motorbike light streaks
        for (let k = 0; k < 26; k++) {
          const X = -xr + rr() * xr * 2, [lx, ly] = aP(X, 0.8, row.Zb + 3 + rr() * (row.gap - 6));
          c.fillStyle = rr() < 0.5 ? 'rgba(255,240,210,0.9)' : 'rgba(255,60,50,0.85)'; c.fillRect(lx - 3, ly - 1, 6 + rr() * 10, 2);
        }
      }
    }
    // houses: outside-in so inner houses cover outer side faces
    const hs = row.houses.slice().sort((a, b) => Math.abs(b.X0 + b.X1) - Math.abs(a.X0 + a.X1));
    for (const hh of hs) aHouse(c, row, hh, V, fk, lights);
  }
  // tangled power lines over the foreground rows
  if (!lights) {
    const r = rng(77);
    c.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const Z0 = 58 + r() * 70, Zl = Z0 + (r() - 0.5) * 30;
      const [x0, y0] = aP(-90, 18 + r() * 6, Z0), [x1, y1] = aP(90, 18 + r() * 6, Zl);
      c.strokeStyle = ctCss(ctMix('#05060c', V.fog, 0.15), 0.85); c.lineWidth = 1.2 + r() * 1.6;
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 200, (y0 + y1) / 2 + 30 + r() * 90, x1, y1); c.stroke();
    }
  }
}
function aHouse(c, row, hh, V, fk, lights) {
  const { Zf, Zb } = row, { X0, X1, h } = hh;
  const r = rng(hh.seed);
  const far = row.far;
  const fa = aP(X0, 0, Zf), fb = aP(X1, 0, Zf), ta = aP(X0, h, Zf), tb = aP(X1, h, Zf), ba = aP(X0, h, Zb), bb = aP(X1, h, Zb);
  if (tb[0] < -20 || ta[0] > AE.CW + 20 || ba[1] > AE.CH + 10) return;
  if (lights) {
    if (far) { // window speckle
      for (let f = 0; f < hh.fl; f++) if (hh.lit[f]) {
        const [wx, wy] = aP(lerp(X0, X1, 0.3 + r() * 0.4), 2 + f * 3.3, Zf);
        c.fillStyle = hh.lit[f] === 2 ? 'rgba(150,220,255,0.8)' : 'rgba(255,200,120,0.85)'; c.fillRect(wx - 1, wy - 1, 2, 1.6);
      }
      return;
    }
    for (let f = 0; f < hh.fl; f++) if (hh.lit[f]) {
      const y0 = 1.0 + f * 3.3, y1 = y0 + 1.6, xa = lerp(X0, X1, 0.22), xb = lerp(X0, X1, 0.78);
      const p0 = aP(xa, y1, Zf), p1 = aP(xb, y0, Zf);
      const g = c.createLinearGradient(0, p0[1], 0, p1[1]);
      const col = hh.lit[f] === 2 ? '140,215,255' : '255,196,110';
      g.addColorStop(0, `rgba(${col},0.95)`); g.addColorStop(1, `rgba(${col},0.55)`);
      c.fillStyle = g; c.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
      const rad = (p1[0] - p0[0]) * 1.2, cx = (p0[0] + p1[0]) / 2, cy = (p0[1] + p1[1]) / 2;
      const gg = c.createRadialGradient(cx, cy, 0, cx, cy, rad); gg.addColorStop(0, `rgba(${col},0.3)`); gg.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = gg; c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    }
    return;
  }
  // side face toward centre
  const cxh = (X0 + X1) / 2;
  if (!far && Math.abs(cxh) > 2) {
    const sx = cxh < 0 ? X1 : X0, s0 = aP(sx, 0, Zf), s1 = aP(sx, h, Zf), s2 = aP(sx, h, Zb), s3 = aP(sx, 0, Zb);
    c.fillStyle = litc(hh.paint, V.side, V.fog, fk); c.beginPath(); c.moveTo(...s0); c.lineTo(...s1); c.lineTo(...s2); c.lineTo(...s3); c.closePath(); c.fill();
  }
  // facade
  c.fillStyle = litc(hh.paint, V.face, V.fog, fk); c.fillRect(ta[0], ta[1], tb[0] - ta[0], fa[1] - ta[1] + 0.5);
  // roof
  const rc = hh.roof === 'tin' ? hh.tin : hh.roof === 'garden' ? '#7d9a6a' : '#b8b2a8';
  c.fillStyle = litc(rc, V.roof, V.fog, fk);
  c.beginPath(); c.moveTo(...ta); c.lineTo(...tb); c.lineTo(...bb); c.lineTo(...ba); c.closePath(); c.fill();
  if (far) return;
  const ws = AE.F / Zf; // px per metre at facade
  // windows (dark glass) + ground-floor shutter
  for (let f = 0; f < hh.fl; f++) {
    const y0 = 1.0 + f * 3.3, xa = lerp(X0, X1, 0.22), xb = lerp(X0, X1, 0.78), p0 = aP(xa, y0 + 1.6, Zf), p1 = aP(xb, y0, Zf);
    if (f === 0) {
      const q0 = aP(X0 + 0.3, 2.6, Zf), q1 = aP(X1 - 0.3, 0, Zf);
      c.fillStyle = litc('#8a8c90', V.face, V.fog, fk); c.fillRect(q0[0], q0[1], q1[0] - q0[0], q1[1] - q0[1]);
      continue;
    }
    c.fillStyle = litc('#3a4250', V.face, V.fog, fk); c.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
    if (ws > 22 && r() < 0.6) { // balcony slab line
      const b0 = aP(X0, y0 - 0.4, Zf), b1 = aP(X1, y0 - 0.4, Zf);
      c.fillStyle = litc('#c8c0b4', V.roof, V.fog, fk); c.fillRect(b0[0], b0[1] - ws * 0.18, b1[0] - b0[0], ws * 0.22);
    }
  }
  // roof parapet edge (sunrise rim on the far edge)
  c.strokeStyle = litc('#e8e2d6', V.roof, V.fog, fk); c.lineWidth = Math.max(0.6, ws * 0.12);
  c.beginPath(); c.moveTo(...ta); c.lineTo(...tb); c.stroke();
  if (V.rim) { c.strokeStyle = ctCss(V.rim, 0.6 * (1 - fk)); c.lineWidth = Math.max(0.6, ws * 0.1); c.beginPath(); c.moveTo(...ba); c.lineTo(...bb); c.stroke(); }
  // tin ribs
  if (hh.roof === 'tin') {
    c.strokeStyle = litc(hh.tin, [V.roof[0] * 0.7, V.roof[1] * 0.7, V.roof[2] * 0.7], V.fog, fk); c.lineWidth = Math.max(0.5, ws * 0.06);
    const n = Math.round((X1 - X0) / 0.5);
    for (let k = 1; k < n; k++) { const xx = lerp(X0, X1, k / n), a = aP(xx, h, Zf), b = aP(xx, h, Zb); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
  } else if (hh.roof === 'garden') {
    for (let k = 0; k < 7; k++) {
      const [px, py] = aP(lerp(X0, X1, r()), h + 0.4, lerp(Zf, Zb, r())), rad = ws * (0.35 + r() * 0.5);
      c.fillStyle = litc(r() < 0.5 ? '#3f7a3a' : '#5c9a48', V.roof, V.fog, fk); c.beginPath(); c.arc(px, py, rad, 0, TAU); c.fill();
    }
  }
  // water tank
  if (hh.tank) {
    const Zt = lerp(Zf + 2, Zb - 2, hh.tz), Xt = lerp(X0 + 0.8, X1 - 0.8, hh.tx), wsT = AE.F / Zt;
    const [bx, by] = aP(Xt, h, Zt);
    if (hh.tank === 'inox') {
      const tw = 1.1 * wsT, th = 1.9 * wsT;
      const g = c.createLinearGradient(bx - tw / 2, 0, bx + tw / 2, 0);
      g.addColorStop(0, litc('#7a808a', V.side, V.fog, fk)); g.addColorStop(0.35, ctCss(ctMix(V.tank[1], V.fog, fk)));
      g.addColorStop(0.6, litc('#a8aeb8', V.side, V.fog, fk)); g.addColorStop(1, litc('#5a606a', V.face, V.fog, fk));
      c.fillStyle = g; c.fillRect(bx - tw / 2, by - th, tw, th);
      c.fillStyle = ctCss(ctMix(V.tank[1], V.fog, fk)); c.beginPath(); c.ellipse(bx, by - th, tw / 2, tw * 0.22, 0, 0, TAU); c.fill();
      c.fillStyle = litc('#3a3c40', V.face, V.fog, fk); c.fillRect(bx - tw * 0.45, by - th * 0.15, tw * 0.1, th * 0.15); c.fillRect(bx + tw * 0.35, by - th * 0.15, tw * 0.1, th * 0.15);
    } else {
      const tw = 1.8 * wsT, th = 1.0 * wsT;
      c.fillStyle = litc('#2f6fc0', V.side, V.fog, fk); c.beginPath(); c.roundRect(bx - tw / 2, by - th, tw, th, th / 2); c.fill();
      c.fillStyle = litc('#5a9ae0', V.roof, V.fog, fk); c.fillRect(bx - tw * 0.4, by - th * 0.95, tw * 0.8, th * 0.22);
    }
  }
  // TV antenna (fishbone)
  if (hh.ant) {
    const Za = lerp(Zf + 1, Zb - 1, 0.3), Xa = lerp(X0 + 0.5, X1 - 0.5, hh.ax), wa = AE.F / Za;
    const [bx, by] = aP(Xa, h, Za), top = by - 4.2 * wa;
    c.strokeStyle = ctCss(ctMix('#0a0b14', V.fog, fk * 0.8), 0.9); c.lineWidth = Math.max(0.6, wa * 0.07);
    c.beginPath(); c.moveTo(bx, by); c.lineTo(bx, top); c.stroke();
    for (let k = 0; k < 5; k++) { const yy = top + k * 0.32 * wa, hw = (0.9 - k * 0.12) * wa; c.beginPath(); c.moveTo(bx - hw, yy + hw * 0.15); c.lineTo(bx + hw, yy - hw * 0.15); c.stroke(); }
  }
  // laundry on some roofs
  if (r() < 0.18) {
    const Zl = lerp(Zf + 2, Zb - 2, 0.6), wl = AE.F / Zl, [lx0, ly] = aP(X0 + 0.5, h + 1.4, Zl), [lx1] = aP(X1 - 0.5, h + 1.4, Zl);
    c.strokeStyle = 'rgba(20,20,30,0.6)'; c.lineWidth = Math.max(0.5, wl * 0.04); c.beginPath(); c.moveTo(lx0, ly); c.lineTo(lx1, ly); c.stroke();
    for (let k = 0; k < 4; k++) {
      const xx = lerp(lx0, lx1, (k + 0.5) / 4);
      c.fillStyle = litc(['#e04848', '#f0e6d0', '#4a7ad0', '#f2c040'][k], V.side, V.fog, fk); c.fillRect(xx - wl * 0.3, ly, wl * 0.6, wl * 0.8);
    }
  }
}
function drawSkyline(c, V) {
  const r = rng(404), col = ctCss(ctMix(V === AV0 ? '#0e1a48' : '#8a6a8e', V.fog, 0.25)), col2 = ctCss(ctMix(V === AV0 ? '#14225a' : '#a77f98', V.fog, 0.4));
  // second rank (hazier, lower)
  c.fillStyle = col2;
  for (let i = 0; i < 40; i++) { const x = r() * AE.CW, w = 18 + r() * 40, h = 20 + r() * 70; c.fillRect(x, AE.HY - h, w, h + 2); }
  c.fillStyle = col;
  for (let i = 0; i < 26; i++) {
    const x = r() * AE.CW, w = 22 + r() * 46, h = 40 + r() * 150;
    if (x > 760 && x < 900) continue;
    c.fillRect(x, AE.HY - h, w, h + 2);
    if (r() < 0.4) c.fillRect(x + w * 0.4, AE.HY - h - 14, 3, 14);
  }
  // Bitexco-like tower (lotus bud with helipad disc)
  const bx = 832, base = AE.HY + 2, top = AE.HY - 330;
  c.beginPath(); c.moveTo(bx - 34, base); c.bezierCurveTo(bx - 40, base - 160, bx - 26, top + 80, bx - 6, top);
  c.lineTo(bx + 4, top + 6); c.bezierCurveTo(bx + 22, top + 90, bx + 34, base - 160, bx + 28, base); c.closePath(); c.fill();
  c.beginPath(); c.ellipse(bx + 20, top + 104, 26, 7, -0.05, 0, TAU); c.fill(); // helipad
  c.fillRect(bx - 2, top - 22, 2.4, 24);
  // a stepped supertall further left
  c.beginPath(); c.moveTo(250, base); c.lineTo(252, AE.HY - 240); c.lineTo(262, AE.HY - 262); c.lineTo(272, AE.HY - 290); c.lineTo(282, AE.HY - 262); c.lineTo(290, AE.HY - 236); c.lineTo(292, base); c.closePath(); c.fill();
  if (V.rim) { c.strokeStyle = ctCss(V.rim, 0.55); c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx + 4, top + 6); c.bezierCurveTo(bx + 22, top + 90, bx + 34, base - 160, bx + 28, base); c.stroke(); }
}
function skylineLights(c) {
  const r = rng(405);
  for (let i = 0; i < 160; i++) {
    const x = r() * AE.CW, y = AE.HY - r() * r() * 200;
    c.fillStyle = r() < 0.7 ? 'rgba(255,214,150,0.7)' : 'rgba(170,220,255,0.7)'; c.fillRect(x, y, 1.6, 1.6);
  }
  // tower spine light
  const g = c.createLinearGradient(0, AE.HY - 300, 0, AE.HY); g.addColorStop(0, 'rgba(140,200,255,0.5)'); g.addColorStop(1, 'rgba(140,200,255,0.1)');
  c.fillStyle = g; c.fillRect(831, AE.HY - 300, 2, 300);
}
function buildAerial() {
  if (AER) return AER;
  const data = aerialData();
  const mk = (V, lights) => {
    const cv = createCanvas(Math.round(AE.CW * AE.CS), Math.round(AE.CH * AE.CS)), c = cv.getContext('2d');
    c.scale(AE.CS, AE.CS); drawAerialWorld(c, data, V, lights); return cv;
  };
  AER = { data, base: [mk(AV0, false), mk(AV1, false)], lights: mk(AV0, true) };
  return AER;
}
// draw a cached world canvas with world point (fx,fy) at screen centre, zoom z
function drawCrop(ctx, cv, cs, fx, fy, z) {
  const wx0 = fx - W / 2 / z, wy0 = fy - H / 2 / z, ww = W / z, wh = H / z;
  let sx = wx0 * cs, sy = wy0 * cs, sw = ww * cs, sh = wh * cs, dx = 0, dy = 0, dw = W, dh = H;
  if (sx < 0) { dx = -sx / cs * z; dw -= dx; sw += sx; sx = 0; }
  if (sy < 0) { dy = -sy / cs * z; dh -= dy; sh += sy; sy = 0; }
  if (sx + sw > cv.width) { const e = sx + sw - cv.width; sw -= e; dw -= e / cs * z; }
  if (sy + sh > cv.height) { const e = sy + sh - cv.height; sh -= e; dh -= e / cs * z; }
  if (sw > 1 && sh > 1) ctx.drawImage(cv, sx, sy, sw, sh, dx, dy, dw, dh);
}
function aerial(ctx, t, o = {}) {
  const A = buildAerial(), d = clamp(o.dawn || 0), p = dawnPal(d), de = L.ease.inOut(clamp(o.descend || 0));
  const sm = A.data.smoke, [swx, swy] = aP(sm.X, sm.Y, sm.Z);
  const z = lerp(0.8, 1.55, de), drift = o.drift === undefined ? 10 : o.drift;
  const fx = lerp(AE.CW / 2, swx + 40, de) + Math.sin(t * 0.25) * drift, fy = lerp(AE.CH / 2, swy - 120, de) + t * 4 * (1 - de);
  const toS = (wx, wy) => [(wx - fx) * z + W / 2, (wy - fy) * z + H / 2];
  const hyS = toS(0, AE.HY)[1];
  ctx.save();
  if (hyS > -50) sky(ctx, t, { dawn: d, hy: hyS, sunX: toS(990, 0)[0] }); else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.imageSmoothingQuality = 'medium';
  if (d < 0.999) drawCrop(ctx, A.base[0], AE.CS, fx, fy, z);
  if (d > 0.001) { ctx.globalAlpha = d < 0.999 ? d : 1; drawCrop(ctx, A.base[1], AE.CS, fx, fy, z); ctx.globalAlpha = 1; }
  // mid-dawn violet wash
  const vw = 1 - Math.abs(d - 0.5) * 2;
  if (vw > 0.01) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.5 * vw; ctx.fillStyle = ctCss(p.mid); ctx.fillRect(0, Math.max(0, hyS), W, H); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  // lights
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 1 - 0.72 * d; drawCrop(ctx, A.lights, AE.CS, fx, fy, z); ctx.globalAlpha = 1;
  // horizon pink line over the far city
  if (hyS > -20 && hyS < H) {
    const lc = rgbs(key3(d, '#ff5fa6', '#ff8aa6', '#ffe2b8'));
    const g = ctx.createLinearGradient(0, hyS - 30 * z, 0, hyS + 60 * z);
    g.addColorStop(0, `rgba(${lc},0)`); g.addColorStop(0.33, `rgba(${lc},0.55)`); g.addColorStop(1, `rgba(${lc},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, hyS - 30 * z, W, 90 * z);
  }
  ctx.globalCompositeOperation = 'source-over';
  // tower tip blink
  const tip = toS(830, AE.HY - 352);
  const bl = (Math.sin(t * 3.4) > 0.55 ? 1 : 0.15) * (1 - 0.6 * d);
  L.glow(ctx, tip[0], tip[1], 26 * z, 'rgba(255,40,40,1)', bl);
  // charcoal smoke column + ember glow at its base
  const [sx, sy] = toS(swx, swy), sk = o.smoke === undefined ? 1 : o.smoke;
  if (sk > 0) {
    L.glow(ctx, sx, sy + 10 * z, 120 * z, 'rgba(255,130,60,0.9)', 0.75 * sk * (1 - 0.5 * d));
    neonLight(ctx, sx + 24 * z, sy + 14 * z, 90 * z, 0.8 * sk * (1 - 0.6 * d));
    const sc = rgbs(key3(d, '#8e9ac4', '#c8a2c4', '#f4d8c8'));
    B.smoke(ctx, t, 31, sx, sy, 16 * z, 1000 * z, 24, 0.5 * sk, 260 * z, sc, 0.55 * z);
    B.smoke(ctx, t * 1.3, 32, sx, sy, 10 * z, 260 * z, 8, 0.45 * sk, 40 * z, '255,170,130', 0.32 * z);
  }
  ctx.restore();
  return { smoke: { x: sx, y: sy }, tower: { x: tip[0], y: tip[1] }, horizon: hyS, zoom: z, toScreen: toS, pal: p };
}

// ================================================================== ALLEY (hẻm)
const AF = 1687, AVX = 540, AVY = 860, EYE = 1.6, WL = -1.6, WR = 1.6;
const ap = (X, Y, Z) => [AVX + AF * X / Z, AVY + AF * (EYE - Y) / Z];
const VIEWS = { wide: { z: 1, cx: 540, cy: 960 }, cart: { z: 1.9, cx: 430, cy: 980 }, stool: { z: 2.0, cx: 760, cy: 1250 } };
const ALV = [
  { amb: [0.27, 0.32, 0.6], warm: [0.5, 0.42, 0.55], fog: '#16245a', wire: '#05060c' },
  { amb: [0.8, 0.64, 0.68], warm: [0.95, 0.78, 0.72], fog: '#c99aa0', wire: '#2a1e2c' },
];
const fogK = (Z) => clamp((Z - 6) / 34) * 0.7;
// quads: wall plane (X const), frontal (Z const), horizontal (Y const)
function wq(c, X, z0, z1, y0, y1) { const a = ap(X, y0, z0), b = ap(X, y0, z1), e = ap(X, y1, z1), f = ap(X, y1, z0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.lineTo(f[0], f[1]); c.closePath(); }
function fq(c, Z, x0, x1, y0, y1) { const a = ap(x0, y1, Z), b = ap(x1, y0, Z); c.beginPath(); c.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); }
function hq(c, Y, x0, x1, z0, z1) { const a = ap(x0, Y, z0), b = ap(x1, Y, z0), e = ap(x1, Y, z1), f = ap(x0, Y, z1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(e[0], e[1]); c.lineTo(f[0], f[1]); c.closePath(); }
function wline(c, X, z0, y0, z1, y1) { const a = ap(X, y0, z0), b = ap(X, y1, z1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }

function alleyHouses() {
  const r = rng(2024), mk = (side, zs) => zs.slice(0, -1).map((z0, i) => ({
    side, z0, z1: zs[i + 1], fl: 2 + Math.floor(r() * 2.6), paint: PAINTS[Math.floor(r() * PAINTS.length)],
    ground: r() < 0.3 ? 'open' : 'shutter', bal: [r() < 0.7, r() < 0.6, r() < 0.5], lit: [r() < 0.4, r() < 0.3, r() < 0.3],
    ac: r() < 0.5, board: ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60'][Math.floor(r() * 4)], seed: Math.floor(r() * 1e5),
  }));
  const Lh = mk(-1, [2.6, 7.6, 11.4, 15.2, 19.6, 24, 29, 34]);
  const Rh = mk(1, [2.6, 6.9, 10.6, 14.4, 18.2, 23, 27.6, 34]);
  Lh[1].ground = 'open'; Lh[1].fl = 3; Rh[2].fl = 3; Rh[2].bal = [true, true, false]; Rh[1].fl = 4; Lh[0].fl = 3;
  return { Lh, Rh };
}
let AHS = null;

function drawWallHouse(c, hs, V) {
  const s = hs.side, X = s < 0 ? WL : WR, { z0, z1 } = hs, fk = fogK(z0), fog = hx(V.fog);
  const r = rng(hs.seed);
  const hgt = 3.6 + (hs.fl - 1) * 3.3 + 0.6;
  // gable (front-facing side wall above the nearer neighbour) : bare concrete
  fq(c, z0, s < 0 ? X - 7 : X, s < 0 ? X : X + 7, 0, hgt); c.fillStyle = litc('#b4aca2', V.amb, fog, fk); c.fill();
  // stains on gable
  c.save(); c.clip();
  for (let k = 0; k < 4; k++) { const [gx, gy] = ap(X + s * (0.6 + r() * 5), hgt - r() * 3, z0); c.fillStyle = 'rgba(30,28,36,0.18)'; c.fillRect(gx, gy, 4 + r() * 30 * 7 / z0, 60 * 7 / z0 + r() * 200 * 7 / z0); }
  c.restore();
  // wall plane
  wq(c, X, z0, z1, 0, hgt);
  const g0 = ap(X, 0, z0), g1 = ap(X, 0, z1);
  const gr = c.createLinearGradient(g0[0], 0, g1[0], 0);
  gr.addColorStop(0, litc(hs.paint, V.amb, fog, fk)); gr.addColorStop(1, litc(hs.paint, V.amb, fog, fogK(z1)));
  c.fillStyle = gr; c.fill();
  // grime gradient bottom + top
  wq(c, X, z0, z1, 0, 1.0); c.fillStyle = 'rgba(20,18,26,0.25)'; c.fill();
  // ground floor
  const za = z0 + 0.35, zb = z1 - 0.35;
  if (hs.ground === 'shutter') {
    wq(c, X, za, zb, 0, 2.7); c.fillStyle = litc('#9aa0a6', V.amb, fog, fk); c.fill();
    c.strokeStyle = litc('#5a6068', V.amb, fog, fk); c.lineWidth = Math.max(0.6, 12 / z0);
    for (let y = 0.12; y < 2.7; y += 0.14) wline(c, X, za, y, zb, y);
    wq(c, X, za, zb, 2.55, 2.7); c.fillStyle = litc('#55585e', V.amb, fog, fk); c.fill();
  } else {
    wq(c, X, za, zb, 0, 2.7); c.fillStyle = litc('#ffcf8a', V.warm, fog, fk * 0.5); c.fill();
    // interior hints: shelf + fluorescent tube
    c.strokeStyle = 'rgba(80,50,30,0.6)'; c.lineWidth = Math.max(1, 20 / z0);
    wline(c, X, za + 0.2, 1.2, zb - 0.2, 1.2); wline(c, X, za + 0.2, 1.8, zb - 0.2, 1.8);
    c.strokeStyle = 'rgba(240,255,250,0.9)'; c.lineWidth = Math.max(1, 30 / z0); wline(c, X, za + 0.4, 2.45, zb - 0.6, 2.45);
  }
  // signboard strip
  wq(c, X, za, zb, 2.78, 3.25); c.fillStyle = litc(hs.board, V.amb, fog, fk); c.fill();
  c.strokeStyle = litc('#ffffff', V.amb, fog, fk, 0.5); c.lineWidth = Math.max(0.8, 10 / z0);
  wline(c, X, za + 0.3, 3.05, za + 0.3 + (zb - za) * 0.55, 3.05);
  // upper floors
  for (let f = 1; f < hs.fl; f++) {
    const y0 = 3.6 + (f - 1) * 3.3;
    // window / balcony door
    const wa = z0 + (z1 - z0) * 0.22, wb = z1 - (z1 - z0) * 0.22;
    wq(c, X, wa, wb, y0 + 0.5, y0 + 2.5);
    c.fillStyle = hs.lit[f - 1] ? litc('#ffd59a', [1, 0.95, 0.9], fog, fk * 0.4) : litc('#2a3040', V.amb, fog, fk); c.fill();
    // grille
    c.strokeStyle = litc('#20242c', V.amb, fog, fk, 0.8); c.lineWidth = Math.max(0.6, 7 / z0);
    for (let k = 1; k < 6; k++) { const zz = lerp(wa, wb, k / 6); wline(c, X, zz, y0 + 0.5, zz, y0 + 2.5); }
    wline(c, X, wa, y0 + 1.5, wb, y0 + 1.5);
    if (hs.ac && f === 1) { wq(c, X, wb + 0.1, Math.min(z1 - 0.05, wb + 0.8), y0 + 2.6, y0 + 3.1); c.fillStyle = litc('#d8d8d0', V.amb, fog, fk); c.fill(); }
    if (hs.bal[f - 1]) drawBalcony(c, hs, y0 - 0.05, V, r);
  }
  // parapet + roofline tank silhouettes
  wq(c, X, z0, z1, hgt - 0.25, hgt); c.fillStyle = litc('#e6e0d4', V.amb, fog, fk); c.fill();
  if (r() < 0.6) { // inox water tank peeking above
    const zt = lerp(z0, z1, 0.3 + r() * 0.4), [tx, ty] = ap(X + s * 0.8, hgt, zt), tw = 1.0 * AF / zt, th = 1.6 * AF / zt;
    const g = c.createLinearGradient(tx - tw / 2, 0, tx + tw / 2, 0);
    g.addColorStop(0, litc('#8890a0', V.amb, fog, fk)); g.addColorStop(0.4, litc('#e8eef6', V.amb, fog, fk)); g.addColorStop(1, litc('#606878', V.amb, fog, fk));
    c.fillStyle = g; c.fillRect(tx - tw / 2, ty - th, tw, th);
    c.beginPath(); c.ellipse(tx, ty - th, tw / 2, tw * 0.12, 0, 0, TAU); c.fill();
  }
}
function drawBalcony(c, hs, y0, V, r) {
  const s = hs.side, X = s < 0 ? WL : WR, X2 = X - s * 0.7, { z0, z1 } = hs, fk = fogK(z0), fog = hx(V.fog);
  // underside slab (we look up at it)
  c.beginPath(); { const a = ap(X, y0, z0), b = ap(X2, y0, z0), e = ap(X2, y0, z1), f = ap(X, y0, z1); c.moveTo(...a); c.lineTo(...b); c.lineTo(...e); c.lineTo(...f); c.closePath(); }
  c.fillStyle = litc('#8a8478', V.amb, fog, fk); c.fill();
  // slab edge (outer plane)
  wq(c, X2, z0, z1, y0, y0 + 0.16); c.fillStyle = litc('#e2dccf', V.amb, fog, fk); c.fill();
  fq(c, z0, Math.min(X, X2), Math.max(X, X2), y0, y0 + 0.16); c.fill();
  // railing: outer plane bars + frontal end
  c.strokeStyle = litc('#2a2c34', V.amb, fog, fk, 0.9); c.lineWidth = Math.max(0.8, 9 / z0);
  wline(c, X2, z0, y0 + 1.0, z1, y0 + 1.0);
  for (let zz = z0 + 0.12; zz < z1; zz += 0.16) wline(c, X2, zz, y0 + 0.16, zz, y0 + 1.0);
  const fa = ap(X, y0 + 1, z0), fb = ap(X2, y0 + 1, z0); c.beginPath(); c.moveTo(...fa); c.lineTo(...fb); c.stroke();
  for (let k = 0; k <= 4; k++) { const xx = lerp(X, X2, k / 4), a = ap(xx, y0 + 0.16, z0), b = ap(xx, y0 + 1, z0); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
  // potted plants along the rail
  const np = 2 + Math.floor(r() * 3);
  for (let k = 0; k < np; k++) {
    const zz = lerp(z0 + 0.3, z1 - 0.3, (k + 0.5) / np), [px, py] = ap(X2 + s * 0.15, y0 + 1.0, zz), u = AF / zz;
    c.fillStyle = litc('#b5562e', V.amb, fog, fk); c.fillRect(px - 0.13 * u, py - 0.05 * u, 0.26 * u, 0.22 * u);
    for (let j = 0; j < 7; j++) {
      const a = -PI / 2 + (r() - 0.5) * 2.4, rr = (0.12 + r() * 0.2) * u;
      c.fillStyle = litc(j % 2 ? '#3f8a3e' : '#2c6a30', V.amb, fog, fk);
      c.beginPath(); c.ellipse(px + Math.cos(a) * rr * 0.8, py - 0.05 * u + Math.sin(a) * rr, rr * 0.5, rr * 0.22, a, 0, TAU); c.fill();
    }
  }
}
function bougainvillea(c, X, z0, z1, ytop, ybot, V, seed) {
  const r = rng(seed), fog = hx(V.fog);
  const pinks = ['#e0338a', '#c41f73', '#f25aa8', '#a3165c', '#ff7ac0'];
  for (let i = 0; i < 520; i++) {
    const zz = lerp(z0, z1, r()), u = AF / zz, hang = Math.pow(r(), 1.8), yy = lerp(ytop, ybot, hang * (0.5 + 0.5 * Math.sin(zz * 3.1) ** 2));
    const [px, py] = ap(X + (r() - 0.5) * 0.25, yy + (r() - 0.5) * 0.15, zz), rr = (0.035 + r() * 0.05) * u;
    const leaf = r() < 0.3;
    c.fillStyle = litc(leaf ? (r() < 0.5 ? '#2f6a2a' : '#4a8a36') : pinks[Math.floor(r() * pinks.length)], V.amb.map(v => Math.min(1.2, v * 1.25)), fog, fogK(zz));
    c.beginPath(); c.ellipse(px, py, rr, rr * (leaf ? 0.55 : 0.8), r() * PI, 0, TAU); c.fill();
  }
}
function laundry(c, Z, y, V) {
  const fog = hx(V.fog), fk = fogK(Z), u = AF / Z, [x0, yy] = ap(WL, y, Z), [x1] = ap(WR, y, Z);
  c.strokeStyle = ctCss(V.wire, 0.8); c.lineWidth = Math.max(1, u * 0.012);
  c.beginPath(); c.moveTo(x0, yy); c.quadraticCurveTo((x0 + x1) / 2, yy + u * 0.25, x1, yy); c.stroke();
  const items = [[0.12, 'shirt', '#e8e2d4'], [0.24, 'pants', '#3a5a8a'], [0.37, 'towel', '#f2b8c8'], [0.5, 'shirt', '#d2453a'], [0.63, 'towel', '#f0d060'], [0.75, 'pants', '#6a5a4a'], [0.86, 'shirt', '#7ac0b0']];
  for (const [f, kind, col] of items) {
    const x = lerp(x0, x1, f), sag = u * 0.25 * (1 - (2 * f - 1) ** 2), top = yy + sag, s = u;
    c.fillStyle = litc(col, V.amb.map(v => Math.min(1.2, v * 1.15)), fog, fk);
    c.beginPath();
    if (kind === 'shirt') { c.moveTo(x - 0.28 * s, top); c.lineTo(x + 0.28 * s, top); c.lineTo(x + 0.36 * s, top + 0.16 * s); c.lineTo(x + 0.2 * s, top + 0.2 * s); c.lineTo(x + 0.2 * s, top + 0.62 * s); c.lineTo(x - 0.2 * s, top + 0.62 * s); c.lineTo(x - 0.2 * s, top + 0.2 * s); c.lineTo(x - 0.36 * s, top + 0.16 * s); }
    else if (kind === 'pants') { c.moveTo(x - 0.18 * s, top); c.lineTo(x + 0.18 * s, top); c.lineTo(x + 0.2 * s, top + 0.85 * s); c.lineTo(x + 0.03 * s, top + 0.85 * s); c.lineTo(x, top + 0.25 * s); c.lineTo(x - 0.03 * s, top + 0.85 * s); c.lineTo(x - 0.2 * s, top + 0.85 * s); }
    else { c.rect(x - 0.17 * s, top, 0.34 * s, 0.55 * s); }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(10,10,20,0.25)'; c.fillRect(x - 0.2 * s, top + 0.45 * s, 0.4 * s, 0.1 * s);
    c.fillStyle = '#c0c4cc'; c.fillRect(x - 0.02 * s, top - 0.03 * s, 0.04 * s, 0.05 * s);
  }
}
function wires(c, V) {
  const r = rng(99);
  c.save(); c.lineCap = 'round'; c.strokeStyle = ctCss(V.wire, 0.95);
  const pole = [1.35, 7.2, 9.2];
  const [px, py] = ap(pole[0], pole[1], pole[2]);
  // runs along the alley (both walls, far)
  for (let k = 0; k < 9; k++) {
    const side = k % 2 ? WL + 0.2 : WR - 0.2, y = 6.2 + r() * 2.2, zf = 26 + r() * 10;
    const [x0, y0] = k < 5 ? [px, py + k * 6] : ap(side, y + 0.6, 2.8), [x1, y1] = ap(side * 0.7, y, zf);
    c.lineWidth = 1.5 + r() * 2.5; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 80, Math.max(y0, y1) + 40 + r() * 80, x1, y1); c.stroke();
  }
  // across the alley, drooping
  for (let k = 0; k < 11; k++) {
    const z = 3.2 + r() * 9, y = 5.5 + r() * 2.5, [x0, y0] = k < 6 ? [px, py + r() * 30] : ap(WR, y, z), [x1, y1] = ap(WL, y - r() * 0.6, z + (r() - 0.5) * 2);
    c.lineWidth = (2 + r() * 3) * 6 / z; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + (60 + r() * 140) * 6 / z, x1, y1); c.stroke();
  }
  // tangle coils near the pole
  c.lineWidth = 2.2;
  for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(px + (r() - 0.5) * 40, py + 30 + r() * 40, 18 + r() * 26, 8 + r() * 12, (r() - 0.5) * 0.6, 0, TAU); c.stroke(); }
  c.restore();
}
function polePiece(c, V) {
  const fog = hx(V.fog), Z = 9.2, X = 1.35, u = AF / Z;
  const [bx, by] = ap(X, 0, Z), [, ty] = ap(X, 8.2, Z);
  const g = c.createLinearGradient(bx - 0.14 * u, 0, bx + 0.14 * u, 0);
  g.addColorStop(0, litc('#7a7670', V.amb, fog, fogK(Z))); g.addColorStop(0.4, litc('#c8c2b6', V.amb, fog, fogK(Z))); g.addColorStop(1, litc('#5a5650', V.amb, fog, fogK(Z)));
  c.fillStyle = g; c.beginPath(); c.moveTo(bx - 0.15 * u, by); c.lineTo(bx - 0.1 * u, ty); c.lineTo(bx + 0.1 * u, ty); c.lineTo(bx + 0.15 * u, by); c.closePath(); c.fill();
  // crossarm + transformer cans + posters
  c.fillStyle = litc('#3a3c44', V.amb, fog, fogK(Z)); c.fillRect(bx - 0.6 * u, ty + 0.5 * u, 1.2 * u, 0.08 * u);
  for (const ox of [-0.32, 0.32]) { c.beginPath(); c.roundRect(bx + ox * u - 0.13 * u, ty + 1.0 * u, 0.26 * u, 0.55 * u, 0.05 * u); c.fillStyle = litc('#6a7a70', V.amb, fog, fogK(Z)); c.fill(); }
  for (let k = 0; k < 3; k++) { c.fillStyle = litc(['#f4e8c8', '#e8f0f4', '#f8d040'][k], V.amb, fog, fogK(Z)); c.fillRect(bx - 0.11 * u, by - (1.2 + k * 0.33) * u, 0.22 * u, 0.26 * u); }
}
function streetLampFix(c, V) {
  const Z = 6.4, u = AF / Z, fog = hx(V.fog);
  const [wx, wy] = ap(WR, 3.9, Z), [hx2, hy2] = ap(0.95, 4.0, Z);
  c.strokeStyle = litc('#3a3c44', V.amb, fog, 0); c.lineWidth = 0.06 * u; c.lineCap = 'round';
  c.beginPath(); c.moveTo(wx, wy + 0.3 * u); c.quadraticCurveTo(wx - 0.1 * u, wy - 0.1 * u, hx2, hy2 - 0.06 * u); c.stroke();
  c.fillStyle = litc('#2c2e36', V.amb, fog, 0);
  c.beginPath(); c.ellipse(hx2, hy2, 0.3 * u, 0.09 * u, 0, PI, TAU); c.fill();
  c.fillStyle = '#4a3a2a'; c.beginPath(); c.ellipse(hx2, hy2, 0.24 * u, 0.05 * u, 0, 0, PI); c.fill();
}
// sign geometry (world px)
const SIGN = { Z: 7.35, x0: -1.3, x1: 0.25, y0: 2.5, y1: 3.15 };
function signRect() { const a = ap(SIGN.x0, SIGN.y1, SIGN.Z), b = ap(SIGN.x1, SIGN.y0, SIGN.Z); return { x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1] }; }
function drawSignFace(c, x, y, w, h, lit) {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const fs = h * 0.5;
  c.font = `${fs}px BodySansBold`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const cx = x + w / 2, cy = y + h * 0.43;
  const border = () => { c.beginPath(); c.roundRect(x + h * 0.08, y + h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.12); };
  const sub = () => { c.font = `${h * 0.15}px BodySansBold`; };
  if (!lit) {
    c.strokeStyle = '#3e5a66'; c.lineWidth = h * 0.03; border(); c.stroke();
    c.strokeStyle = '#6a3a54'; c.lineWidth = h * 0.028; c.strokeText('CƠM TẤM', cx, cy);
    sub(); c.fillStyle = '#5a4a40'; c.fillText('SƯỜN · BÌ · CHẢ', cx, y + h * 0.8);
  } else {
    for (const [lw, a] of [[0.22, 0.07], [0.13, 0.14], [0.075, 0.3], [0.04, 0.85]]) { c.strokeStyle = `rgba(40,230,255,${a})`; c.lineWidth = h * lw * 0.8; border(); c.stroke(); }
    c.strokeStyle = 'rgba(220,255,255,0.95)'; c.lineWidth = h * 0.014; border(); c.stroke();
    c.font = `${fs}px BodySansBold`;
    for (const [lw, a] of [[0.26, 0.06], [0.15, 0.13], [0.085, 0.3], [0.045, 0.9]]) { c.strokeStyle = `rgba(255,50,170,${a})`; c.lineWidth = h * lw; c.strokeText('CƠM TẤM', cx, cy); }
    c.strokeStyle = 'rgba(255,225,245,0.98)'; c.lineWidth = h * 0.016; c.strokeText('CƠM TẤM', cx, cy);
    sub(); c.fillStyle = 'rgba(255,214,120,0.9)'; c.fillText('SƯỜN · BÌ · CHẢ', cx, y + h * 0.8);
  }
  c.restore();
}
function signBox(c, V) {
  const s = signRect(), u = AF / SIGN.Z;
  // brackets from the left wall
  c.strokeStyle = litc('#2a2c34', V.amb, null, 0); c.lineWidth = 0.035 * u;
  const [wx, wy] = ap(WL, 3.25, SIGN.Z);
  c.beginPath(); c.moveTo(wx, wy); c.lineTo(s.x + s.w * 0.8, s.y - 0.02 * u); c.stroke();
  c.beginPath(); c.moveTo(s.x + s.w * 0.2, s.y); c.lineTo(s.x + s.w * 0.2, s.y - 0.14 * u); c.moveTo(s.x + s.w * 0.8, s.y); c.lineTo(s.x + s.w * 0.8, s.y - 0.14 * u); c.stroke();
  c.fillStyle = '#0d0a12'; c.beginPath(); c.roundRect(s.x, s.y, s.w, s.h, s.h * 0.1); c.fill();
  c.strokeStyle = litc('#55586a', V.amb, null, 0); c.lineWidth = 3; c.stroke();
  drawSignFace(c, s.x, s.y, s.w, s.h, false);
}
function alleyFloor(c, V) {
  const fog = hx(V.fog);
  hq(c, 0, WL, WR, 1.2, 34);
  const [, yf] = ap(0, 0, 34), [, yn] = ap(0, 0, 1.2);
  const g = c.createLinearGradient(0, yf, 0, yn);
  g.addColorStop(0, litc('#6a6866', V.amb, fog, 0.7)); g.addColorStop(0.3, litc('#5a5856', V.amb, fog, 0.2)); g.addColorStop(1, litc('#3a3836', V.amb, null, 0));
  c.fillStyle = g; c.fill();
  // drains + cracks + puddles (dark, reflections are live)
  c.strokeStyle = 'rgba(10,10,16,0.55)'; c.lineWidth = 3;
  for (const X of [WL + 0.12, WR - 0.12]) { const a = ap(X, 0, 1.5), b = ap(X, 0, 34); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
  const r = rng(5150);
  for (let i = 0; i < 9; i++) {
    const Z = 2 + r() * 14, X = (r() - 0.5) * 2.6, [px, py] = ap(X, 0, Z), u = AF / Z;
    c.fillStyle = 'rgba(14,16,30,0.35)'; c.beginPath(); c.ellipse(px, py, (0.3 + r() * 0.5) * u, (0.05 + r() * 0.05) * u, 0, 0, TAU); c.fill();
  }
  c.strokeStyle = 'rgba(20,20,26,0.3)'; c.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) { const Z = 2 + r() * 20, X = (r() - 0.5) * 3, a = ap(X, 0, Z), b = ap(X + (r() - 0.5) * 0.6, 0, Z + r() * 2); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
}
function farEnd(c, V) {
  const fog = hx(V.fog), Z = 34;
  fq(c, Z, -6, 6, 0, 10.5); c.fillStyle = litc('#d8c8a8', V.amb, fog, 0.72); c.fill();
  for (let f = 0; f < 3; f++) for (let k = 0; k < 3; k++) {
    fq(c, Z, -1.6 + k * 1.1, -1.0 + k * 1.1, 1 + f * 3.2, 2.6 + f * 3.2);
    c.fillStyle = (f + k) % 3 === 1 ? 'rgba(255,200,120,0.95)' : litc('#2a3040', V.amb, fog, 0.72); c.fill();
  }
  // altar light (red) at the end of the alley
  fq(c, Z, -0.2, 0.2, 1.4, 1.8); c.fillStyle = '#ff4a3a'; c.fill();
}
function drawAlleyBack(c, V) {
  if (!AHS) AHS = alleyHouses();
  alleyFloor(c, V);
  farEnd(c, V);
  // walls far -> near (each side)
  const all = [...AHS.Lh, ...AHS.Rh].sort((a, b) => b.z0 - a.z0);
  for (const hs of all) {
    drawWallHouse(c, hs, V);
    if (hs.side > 0 && hs.z0 === 10.6) bougainvillea(c, WR - 0.75, 10.7, 14.2, 4.7, 1.9, V, 61);
    if (hs.side < 0 && hs.z0 === 15.2) bougainvillea(c, WL + 0.75, 15.3, 19, 7.9, 5.0, V, 62);
  }
  // spare stool beside the cart, right of the alley (stool2, cat sleeps here)
  redStool(c, 1.1, 12, V);
  laundry(c, 12.6, 3.25, V);
  polePiece(c, V);
  wires(c, V);
  streetLampFix(c, V);
  signBox(c, V);
}
// --- red plastic stool (front view at depth Z) ---
function redStool(c, X, Z, V, seatY = 0.42) {
  const u = AF / Z, [cx, sy] = ap(X, seatY, Z), [, fy] = ap(X, 0, Z), w = 0.16 * u, wb = 0.2 * u, fog = hx(V.fog), fk = fogK(Z);
  const red = (f) => litc(f, V.warm, fog, fk);
  const ry = w * clamp((EYE - seatY) / Z * 1.1, 0.12, 0.5);
  // body
  c.beginPath(); c.moveTo(cx - w, sy); c.lineTo(cx - wb, fy); c.lineTo(cx - wb + 0.07 * u, fy);
  c.quadraticCurveTo(cx, fy - 0.22 * u, cx + wb - 0.07 * u, fy); c.lineTo(cx + wb, fy); c.lineTo(cx + w, sy); c.closePath();
  const g = c.createLinearGradient(cx - wb, 0, cx + wb, 0);
  g.addColorStop(0, red('#9a1418')); g.addColorStop(0.35, red('#e8302c')); g.addColorStop(0.7, red('#c41f22')); g.addColorStop(1, red('#7a0e12'));
  c.fillStyle = g; c.fill();
  // side slot
  c.fillStyle = red('#4a0608'); c.beginPath(); c.roundRect(cx - w * 0.45, sy + (fy - sy) * 0.25, w * 0.9, (fy - sy) * 0.18, 0.02 * u); c.fill();
  // seat top
  c.beginPath(); c.ellipse(cx, sy, w * 1.06, ry, 0, 0, TAU); c.fillStyle = red('#ff4a40'); c.fill();
  c.beginPath(); c.ellipse(cx, sy + ry * 0.1, w * 0.8, ry * 0.7, 0, 0, TAU); c.fillStyle = red('#d42a28'); c.fill();
  c.strokeStyle = red('#ff8a7a'); c.lineWidth = Math.max(1, 0.012 * u); c.beginPath(); c.ellipse(cx, sy, w * 1.06, ry, 0, PI * 1.05, PI * 1.95); c.stroke();
  return { x: cx, y: sy };
}
// --- the stainless cơm tấm cart (layer 'cart') ---
const CART = { Z: 7, x0: -1.35, x1: 0.55, top: 0.9, gx0: -1.35, gx1: -0.8, case0: -0.66, case1: 0.18 };
function drawCart(c, V) {
  const Z = CART.Z, u = AF / Z, fog = hx(V.fog), fk = 0.05;
  const L2 = (col) => litc(col, V.amb.map(v => Math.min(1.25, v * 1.2)), fog, fk);
  const [x0, yTop] = ap(CART.x0, CART.top, Z), [x1, yFl] = ap(CART.x1, 0, Z), [, yBody] = ap(0, 0.22, Z);
  // shadow
  c.fillStyle = 'rgba(5,5,12,0.45)'; c.beginPath(); c.ellipse((x0 + x1) / 2, yFl, (x1 - x0) * 0.56, 0.1 * u, 0, 0, TAU); c.fill();
  // wheels
  for (const X of [-1.05, 0.3]) {
    const [wx, wy] = ap(X, 0.24, Z), wr = 0.24 * u;
    c.strokeStyle = L2('#1a1a1e'); c.lineWidth = 0.05 * u; c.beginPath(); c.arc(wx, wy, wr, 0, TAU); c.stroke();
    c.strokeStyle = L2('#9aa0aa'); c.lineWidth = 1.5;
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); c.stroke(); }
    c.fillStyle = L2('#c8ccd4'); c.beginPath(); c.arc(wx, wy, 0.04 * u, 0, TAU); c.fill();
  }
  // body front panel (brushed steel)
  const bodyTop = yTop + 0.03 * u;
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, L2('#6a7280')); g.addColorStop(0.18, L2('#d8dee8')); g.addColorStop(0.32, L2('#8a92a0')); g.addColorStop(0.6, L2('#c4cad4')); g.addColorStop(0.85, L2('#7a828e')); g.addColorStop(1, L2('#aab0ba'));
  c.fillStyle = g; c.fillRect(x0, bodyTop, x1 - x0, yBody - bodyTop);
  c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1;
  for (let y = bodyTop + 3; y < yBody; y += 3.2) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); }
  // panel seams + decal
  c.strokeStyle = 'rgba(20,24,34,0.5)'; c.lineWidth = 2; c.strokeRect(x0 + 0.04 * u, bodyTop + 0.05 * u, (x1 - x0) - 0.08 * u, yBody - bodyTop - 0.1 * u);
  const [gxe] = ap(CART.gx1, 0, Z);
  c.beginPath(); c.moveTo(gxe, bodyTop); c.lineTo(gxe, yBody); c.stroke();
  const dx = (gxe + x1) / 2, dy = bodyTop + (yBody - bodyTop) * 0.42;
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `${0.17 * u}px BodySansBold`; c.fillStyle = L2('#c8241e'); c.fillText('CƠM TẤM', dx, dy);
  c.font = `${0.075 * u}px BodySansBold`; c.fillStyle = L2('#1e4a9a'); c.fillText('SƯỜN NƯỚNG · BÌ · CHẢ · TRỨNG', dx, dy + 0.15 * u);
  c.restore();
  // brazier box on the left end (sooty, vents glow live)
  const [bx0] = ap(CART.gx0 + 0.04, 0, Z), [bx1] = ap(CART.gx1 - 0.03, 0, Z), [, by0] = ap(0, 0.95, Z - 0.02), [, by1] = ap(0, 0.62, Z - 0.02);
  const bg = c.createLinearGradient(0, by0, 0, by1); bg.addColorStop(0, '#1a1414'); bg.addColorStop(1, '#3a322e');
  c.fillStyle = bg; c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  c.fillStyle = '#0a0606';
  for (let k = 0; k < 3; k++) { const vx = lerp(bx0, bx1, 0.22 + k * 0.28); c.beginPath(); c.ellipse(vx, by1 - (by1 - by0) * 0.35, 0.05 * u, 0.025 * u, 0, 0, TAU); c.fill(); }
  // sheet-metal backsplash behind grill
  const [, bsy] = ap(0, 1.25, Z + 0.55);
  const [bsx0] = ap(CART.gx0, 0, Z + 0.55), [bsx1] = ap(CART.gx1, 0, Z + 0.55);
  c.fillStyle = L2('#5a5e66'); c.fillRect(bsx0, bsy, bsx1 - bsx0, by0 - bsy - 0.04 * u);
  // counter top sliver + bright trim
  hq(c, CART.top + 0.02, CART.gx1, CART.x1, Z, Z + 0.6); c.fillStyle = L2('#e4e8f0'); c.fill();
  c.fillStyle = L2('#f4f6fa'); c.fillRect(x0, yTop, x1 - x0, 0.035 * u);
  // glass case
  const [cx0, cyt] = ap(CART.case0, 1.52, Z + 0.1), [cx1, cyb] = ap(CART.case1, CART.top + 0.02, Z + 0.1);
  c.fillStyle = 'rgba(160,190,210,0.16)'; c.fillRect(cx0, cyt, cx1 - cx0, cyb - cyt);
  // shelves + food silhouettes
  const shelf = (yy, items) => {
    c.fillStyle = L2('#c8ccd4'); c.fillRect(cx0, yy, cx1 - cx0, 0.012 * u);
    for (const [f, w2, h2, col, kind] of items) {
      const ix = lerp(cx0, cx1, f);
      c.fillStyle = L2(col);
      if (kind === 'stack') { for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(ix + (k % 2) * 3, yy - k * 0.03 * u - 0.02 * u, w2 * u, 0.025 * u, -0.05, 0, TAU); c.fill(); } }
      else if (kind === 'tray') { c.fillStyle = L2('#d8dce4'); c.fillRect(ix - w2 * u, yy - 0.03 * u, w2 * 2 * u, 0.03 * u); c.fillStyle = L2(col); c.fillRect(ix - w2 * u * 0.9, yy - h2 * u, w2 * 1.8 * u, (h2 - 0.03) * u); }
      else { c.beginPath(); c.roundRect(ix - w2 * u, yy - h2 * u, w2 * 2 * u, h2 * u, 0.02 * u); c.fill(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(ix - w2 * u * 0.7, yy - h2 * u * 0.9, w2 * u * 0.3, h2 * u * 0.7); }
    }
  };
  const ys1 = lerp(cyt, cyb, 0.52), ys2 = cyb - 0.02 * u;
  shelf(ys1, [[0.2, 0.1, 0.1, '#a8521e', 'stack'], [0.5, 0.12, 0.08, '#f0b030', 'tray'], [0.8, 0.08, 0.14, '#f4e0c0', 'jar']]);
  shelf(ys2, [[0.18, 0.12, 0.06, '#f2e6c6', 'tray'], [0.5, 0.1, 0.12, '#e8783a', 'jar'], [0.78, 0.12, 0.1, '#8a3a18', 'stack']]);
  // LED tube
  c.fillStyle = 'rgba(235,250,255,0.95)'; c.fillRect(cx0 + 4, cyt + 4, cx1 - cx0 - 8, 0.015 * u);
  // aluminium frame + red painted letters on the glass
  c.strokeStyle = L2('#c0c6d0'); c.lineWidth = 0.022 * u; c.strokeRect(cx0, cyt, cx1 - cx0, cyb - cyt);
  c.beginPath(); c.moveTo(cx0, cyt); c.lineTo(lerp(cx0, cx1, 0.5), cyt - 0.06 * u); c.lineTo(cx1, cyt); c.stroke();
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `${0.09 * u}px BodySansBold`;
  c.fillStyle = 'rgba(220,40,30,0.9)'; c.fillText('CƠM TẤM CÔ NĂM', (cx0 + cx1) / 2, lerp(cyt, cyb, 0.3)); c.restore();
  // glass reflections
  c.save(); c.beginPath(); c.rect(cx0, cyt, cx1 - cx0, cyb - cyt); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.12)';
  for (const f of [0.15, 0.62]) { const xx = lerp(cx0, cx1, f); c.beginPath(); c.moveTo(xx, cyt); c.lineTo(xx + 0.08 * u, cyt); c.lineTo(xx - 0.12 * u, cyb); c.lineTo(xx - 0.2 * u, cyb); c.closePath(); c.fill(); }
  c.restore();
  // rice pot (aluminium) on the right end
  const [px, py] = ap(0.38, CART.top + 0.02, Z + 0.25), pw = 0.17 * u, ph = 0.26 * u;
  const pg = c.createLinearGradient(px - pw, 0, px + pw, 0);
  pg.addColorStop(0, L2('#6a6e76')); pg.addColorStop(0.35, L2('#e4e6ea')); pg.addColorStop(0.7, L2('#9a9ea6')); pg.addColorStop(1, L2('#5a5e66'));
  c.fillStyle = pg; c.beginPath(); c.roundRect(px - pw, py - ph, pw * 2, ph, 0.03 * u); c.fill();
  c.beginPath(); c.ellipse(px, py - ph, pw * 1.04, 0.04 * u, 0, 0, TAU); c.fillStyle = L2('#d0d4da'); c.fill();
  c.fillStyle = L2('#2a2a2e'); c.beginPath(); c.ellipse(px, py - ph - 0.04 * u, 0.04 * u, 0.02 * u, 0, 0, TAU); c.fill();
  c.fillStyle = L2('#3a3a40'); c.fillRect(px - pw - 0.04 * u, py - ph * 0.7, 0.05 * u, 0.025 * u); c.fillRect(px + pw - 0.01 * u, py - ph * 0.7, 0.05 * u, 0.025 * u);
  // fish sauce bottle + chili jar + spoon cup in front of the case
  const [fbx, fby] = ap(-0.73, CART.top + 0.02, Z + 0.06);
  c.fillStyle = 'rgba(190,110,40,0.9)'; c.beginPath(); c.roundRect(fbx - 0.03 * u, fby - 0.17 * u, 0.06 * u, 0.17 * u, 0.012 * u); c.fill();
  c.fillStyle = '#c82020'; c.fillRect(fbx - 0.018 * u, fby - 0.21 * u, 0.036 * u, 0.04 * u);
  const [jx, jy] = ap(0.08, CART.top + 0.02, Z - 0.02);
  c.fillStyle = 'rgba(220,40,20,0.85)'; c.beginPath(); c.roundRect(jx - 0.035 * u, jy - 0.07 * u, 0.07 * u, 0.07 * u, 0.01 * u); c.fill();
  // grill rack + rim (on the brazier)
  const [rx0, ry] = ap(CART.gx0 + 0.02, 0.97, Z + 0.15), [rx1] = ap(CART.gx1 - 0.02, 0.97, Z + 0.15);
  c.strokeStyle = '#2a2624'; c.lineWidth = 0.03 * u; c.beginPath(); c.moveTo(bx0, by0); c.lineTo(bx1, by0); c.stroke();
  c.strokeStyle = L2('#b8bcc4'); c.lineWidth = 2;
  hq(c, 0.97, CART.gx0 + 0.02, CART.gx1 - 0.02, Z + 0.02, Z + 0.5); c.stroke();
  for (let k = 1; k < 9; k++) { const xx = lerp(CART.gx0 + 0.02, CART.gx1 - 0.02, k / 9), a = ap(xx, 0.97, Z + 0.02), b = ap(xx, 0.97, Z + 0.5); c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); }
  // cart handle bar on the right
  const [hx0, hy0] = ap(CART.x1, 0.85, Z), [hx1, hy1] = ap(CART.x1 + 0.22, 0.95, Z - 0.05);
  c.strokeStyle = L2('#c8ccd4'); c.lineWidth = 0.03 * u; c.beginPath(); c.moveTo(hx0, hy0); c.lineTo(hx1, hy1); c.stroke();
  return { rx0, rx1, ry };
}
// --- low steel table + foreground plant (layer 'front') ---
const TABLE = { X: 0.78, Z0: 4.0, Z1: 4.5, w: 0.42, Y: 0.48 };
function drawTable(c, V) {
  const fog = hx(V.fog), { X, Z0, Z1, w, Y } = TABLE;
  const L2 = (col) => litc(col, V.amb.map(v => Math.min(1.25, v * 1.2)), fog, 0);
  // legs
  c.strokeStyle = L2('#8a909a'); c.lineCap = 'round';
  for (const [lx, lz] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
    const zz = lerp(Z0 + 0.05, Z1 - 0.05, lz), a = ap(X + lx * (w - 0.04), Y, zz), b = ap(X + lx * (w - 0.08), 0, zz);
    c.lineWidth = 0.025 * AF / zz; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
  }
  // top
  hq(c, Y, X - w, X + w, Z0, Z1);
  const [, ty0] = ap(X, Y, Z1), [, ty1] = ap(X, Y, Z0);
  const g = c.createLinearGradient(0, ty0, 0, ty1); g.addColorStop(0, L2('#9aa2ae')); g.addColorStop(0.5, L2('#e8ecf2')); g.addColorStop(1, L2('#b8bec8'));
  c.fillStyle = g; c.fill();
  fq(c, Z0, X - w, X + w, Y - 0.04, Y); c.fillStyle = L2('#d8dce4'); c.fill();
  // napkin box + chopstick cup
  const [nx, ny] = ap(X + 0.27, Y, Z1 - 0.12), u = AF / (Z1 - 0.12);
  c.fillStyle = L2('#e8e4dc'); c.fillRect(nx - 0.07 * u, ny - 0.07 * u, 0.14 * u, 0.07 * u); c.fillStyle = L2('#e04040'); c.fillRect(nx - 0.07 * u, ny - 0.045 * u, 0.14 * u, 0.012 * u);
  c.fillStyle = '#fff'; c.beginPath(); c.moveTo(nx - 0.02 * u, ny - 0.07 * u); c.lineTo(nx, ny - 0.11 * u); c.lineTo(nx + 0.02 * u, ny - 0.07 * u); c.fill();
  const [qx, qy] = ap(X - 0.3, Y, Z1 - 0.1);
  c.fillStyle = L2('#c8ccd4'); c.fillRect(qx - 0.035 * u, qy - 0.11 * u, 0.07 * u, 0.11 * u);
  c.strokeStyle = L2('#c89a5a'); c.lineWidth = 0.008 * u; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(qx - 0.025 * u + k * 0.01 * u, qy - 0.1 * u); c.lineTo(qx - 0.04 * u + k * 0.017 * u, qy - 0.24 * u); c.stroke(); }
}
function fgPlant(c, V) {
  const Z = 3.1, X = -1.3, u = AF / Z, [px, py] = ap(X, 0, Z), fog = hx(V.fog), r = rng(303);
  const L2 = (col) => litc(col, V.amb.map(v => Math.min(1.25, v * 1.1)), fog, 0);
  // glazed pot
  const pg = c.createLinearGradient(px - 0.25 * u, 0, px + 0.25 * u, 0); pg.addColorStop(0, L2('#1c3a6a')); pg.addColorStop(0.45, L2('#3d6ab0')); pg.addColorStop(1, L2('#14284a'));
  c.fillStyle = pg; c.beginPath(); c.moveTo(px - 0.24 * u, py - 0.42 * u); c.lineTo(px + 0.24 * u, py - 0.42 * u); c.lineTo(px + 0.18 * u, py); c.lineTo(px - 0.18 * u, py); c.closePath(); c.fill();
  c.strokeStyle = L2('#e8eef8'); c.lineWidth = 0.012 * u; c.beginPath(); c.moveTo(px - 0.22 * u, py - 0.3 * u); c.bezierCurveTo(px - 0.1 * u, py - 0.36 * u, px + 0.05 * u, py - 0.22 * u, px + 0.2 * u, py - 0.3 * u); c.stroke();
  // big taro / elephant-ear leaves
  for (let i = 0; i < 7; i++) {
    const a = -PI / 2 + (i - 3) * 0.32 + (r() - 0.5) * 0.2, len = (0.7 + r() * 0.5) * u, ex = px + Math.cos(a) * len * 0.9, ey = py - 0.42 * u + Math.sin(a) * len;
    c.strokeStyle = L2('#3a6a2a'); c.lineWidth = 0.02 * u; c.beginPath(); c.moveTo(px, py - 0.42 * u); c.quadraticCurveTo(px + Math.cos(a) * len * 0.3, ey + 0.2 * u, ex, ey); c.stroke();
    const lw = (0.26 + r() * 0.12) * u, rot = a + PI / 2 + (r() - 0.5) * 0.6;
    c.save(); c.translate(ex, ey); c.rotate(rot);
    c.beginPath(); c.moveTo(0, -lw * 0.2); c.bezierCurveTo(lw * 0.9, -lw * 0.4, lw * 0.8, lw * 1.2, 0, lw * 1.7); c.bezierCurveTo(-lw * 0.8, lw * 1.2, -lw * 0.9, -lw * 0.4, 0, -lw * 0.2); c.closePath();
    const lg = c.createLinearGradient(-lw, 0, lw, 0); lg.addColorStop(0, L2('#1e4a22')); lg.addColorStop(0.5, L2('#3e8a3a')); lg.addColorStop(1, L2('#183a1a'));
    c.fillStyle = lg; c.fill();
    c.strokeStyle = L2('#7ab86a'); c.lineWidth = 0.008 * u; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, lw * 1.6); c.stroke();
    c.restore();
  }
}

// --- caches per (view, layer, variant) with screen-space bboxes ---
const ALC = new Map();
const LAYER_BOX = { back: [0, 0, 1080, 1920], cart: [150, 840, 760, 1290], stools: [240, 1060, 1080, 1480], front: [0, 1150, 1080, 1920] };
function alleyCache(view, layer, vi) {
  const key = view + layer + vi;
  let e = ALC.get(key);
  if (e) return e;
  const v = VIEWS[view], b = LAYER_BOX[layer];
  let x0 = Math.max(0, Math.floor((b[0] - v.cx) * v.z + W / 2)), y0 = Math.max(0, Math.floor((b[1] - v.cy) * v.z + H / 2));
  let x1 = Math.min(W, Math.ceil((b[2] - v.cx) * v.z + W / 2)), y1 = Math.min(H, Math.ceil((b[3] - v.cy) * v.z + H / 2));
  if (layer === 'back') { x0 = 0; y0 = 0; x1 = W; y1 = H; }
  if (x1 - x0 < 2 || y1 - y0 < 2) { e = { cv: null }; ALC.set(key, e); return e; }
  const cv = createCanvas(x1 - x0, y1 - y0), c = cv.getContext('2d');
  c.translate(-x0, -y0); c.translate(W / 2, H / 2); c.scale(v.z, v.z); c.translate(-v.cx, -v.cy);
  const V = ALV[vi];
  if (layer === 'back') drawAlleyBack(c, V);
  else if (layer === 'cart') drawCart(c, V);
  else if (layer === 'stools') { redStool(c, 0.82, 4.9, V); redStool(c, -0.55, 5.3, V); for (let k = 0; k < 4; k++) redStool(c, 1.3, 8.2, V, 0.42 + k * 0.07); }
  else if (layer === 'front') { drawTable(c, V); fgPlant(c, V); }
  e = { cv, x: x0, y: y0 }; ALC.set(key, e); return e;
}
function blitLayer(ctx, view, layer, d) {
  if (d < 0.999) { const e = alleyCache(view, layer, 0); if (e.cv) ctx.drawImage(e.cv, e.x, e.y); }
  if (d > 0.001) { const e = alleyCache(view, layer, 1); if (e.cv) { ctx.globalAlpha = d < 0.999 ? d : 1; ctx.drawImage(e.cv, e.x, e.y); ctx.globalAlpha = 1; } }
}
// pre-rendered lit neon sign per view
const NEONC = new Map();
function litSign(view) {
  let e = NEONC.get(view); if (e) return e;
  const v = VIEWS[view], s = signRect(), pad = 40;
  const w = Math.ceil(s.w * v.z + pad * 2), h = Math.ceil(s.h * v.z + pad * 2);
  const cv = createCanvas(w, h), c = cv.getContext('2d');
  drawSignFace(c, pad, pad, s.w * v.z, s.h * v.z, true);
  e = { cv, x: (s.x - v.cx) * v.z + W / 2 - pad, y: (s.y - v.cy) * v.z + H / 2 - pad }; NEONC.set(view, e); return e;
}

function alleyAnchors(view) {
  const v = VIEWS[view];
  const toS = (p) => [(p[0] - v.cx) * v.z + W / 2, (p[1] - v.cy) * v.z + H / 2];
  const proj = (X, Y, Z) => toS(ap(X, Y, Z));
  const pxm = (Z) => AF / Z * v.z, sAt = (Z) => pxm(Z) / 322.6, floorAt = (Z) => proj(0, 0, Z)[1];
  const P = (X, Y, Z) => { const q = proj(X, Y, Z); return { x: q[0], y: q[1] }; };
  const s = signRect(), sc = toS([s.x + s.w / 2, s.y + s.h / 2]);
  const g = P((CART.gx0 + CART.gx1) / 2, 0.98, CART.Z + 0.25);
  const ca = proj(CART.case0 - 0.1, CART.top + 0.02, CART.Z + 0.05), cb = proj(CART.x1 - 0.05, CART.top + 0.02, CART.Z + 0.05);
  const st = P(0.82, 0.42, 4.9);
  return {
    view, zoom: v.z, proj, pxm, sAt, floorAt,
    grill: g, counter: { x0: ca[0], x1: cb[0], y: ca[1] },
    stool: st, stool2: { ...P(1.1, 0.42, 12), s: sAt(12) }, table: P(TABLE.X, TABLE.Y, (TABLE.Z0 + TABLE.Z1) / 2),
    neon: { x: sc[0], y: sc[1], w: s.w * v.z, h: s.h * v.z }, lamp: P(0.95, 3.95, 6.4),
    floor: floorAt(CART.Z),
    vendor: { ...P(-1.0, 0, 7.9), s: sAt(7.9) }, customer: { ...P(0.3, 0, 6.2), s: sAt(6.2) },
    seat: { x: st.x, y: st.y, s: sAt(4.9) },
  };
}

function alley(ctx, t, o = {}) {
  const view = VIEWS[o.view] ? o.view : 'wide', v = VIEWS[view], d = clamp(o.dawn || 0), p = dawnPal(d);
  const layer = o.layer || 'all', all = layer === 'all';
  const neon = o.neon === undefined ? 1 : clamp(o.neon), lampK = o.lamp === undefined ? p.lamp : o.lamp;
  const a = alleyAnchors(view);
  ctx.save();
  if (all || layer === 'back') {
    sky(ctx, t, { dawn: d, hy: (AVY - v.cy) * v.z + H / 2 + 120 * v.z, sunX: (AVX - v.cx) * v.z + W / 2, stars: 1 });
    blitLayer(ctx, view, 'back', d);
    // sunrise glow over the far end of the alley
    if (p.sun > 0) { const q = a.proj(0, 10, 34); L.glow(ctx, q[0], q[1], 520 * v.z, 'rgba(255,190,140,0.9)', 0.55 * p.sun); }
    // sodium lamp
    if (lampK > 0.01) {
      L.glow(ctx, a.lamp.x, a.lamp.y + 6 * v.z, 46 * v.z, 'rgba(255,236,190,1)', lampK);
      L.glow(ctx, a.lamp.x, a.lamp.y + 30 * v.z, 520 * v.z, 'rgba(255,150,60,0.75)', 0.6 * lampK);
      const fl = a.proj(0.7, 0, 6.6);
      lampPool(ctx, fl[0], fl[1], 520 * v.z, 0.9 * lampK, { flat: 0.26, from: { x: a.lamp.x, y: a.lamp.y + 10 * v.z } });
    }
    // neon sign + spill + wet-floor reflections
    if (neon > 0.005) {
      const n = litSign(view);
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = neon; ctx.drawImage(n.cv, n.x, n.y); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      neonLight(ctx, a.neon.x, a.neon.y, 560 * v.z, neon * 0.85, '255,60,170');
      neonLight(ctx, a.neon.x - a.neon.w * 0.3, a.neon.y, 260 * v.z, neon * 0.5, '60,220,255');
      for (const [dx, col, rx, ry, k] of [[0, '255,70,180', 90, 240, 0.4], [-a.neon.w * 0.35, '70,220,255', 40, 200, 0.3]]) {
        const fy = a.floorAt(5.2);
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(a.neon.x + dx, fy); ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * v.z); g.addColorStop(0, `rgba(${col},${k * neon})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(-rx * v.z, -rx * v.z, rx * 2 * v.z, rx * 2 * v.z); ctx.restore();
      }
    }
  }
  if (all || layer === 'cart') {
    blitLayer(ctx, view, 'cart', d);
    const heat = o.heat === undefined ? 1 : o.heat, fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.7);
    const z = v.z, g = a.grill;
    // coal glow through the vents + above the rack
    for (let k = 0; k < 3; k++) { const q = a.proj(lerp(CART.gx0 + 0.04, CART.gx1 - 0.03, 0.22 + k * 0.28), 0.73, CART.Z - 0.03); L.glow(ctx, q[0], q[1], 22 * z, 'rgba(255,150,50,1)', 0.9 * heat * fl); }
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const cg = ctx.createLinearGradient(0, g.y - 30 * z, 0, g.y + 10 * z); cg.addColorStop(0, 'rgba(255,90,20,0)'); cg.addColorStop(1, `rgba(255,140,40,${0.8 * heat * fl})`);
    ctx.fillStyle = cg; const q0 = a.proj(CART.gx0 + 0.05, 0, 7), q1 = a.proj(CART.gx1 - 0.05, 0, 7); ctx.fillRect(q0[0], g.y - 30 * z, q1[0] - q0[0], 40 * z);
    ctx.restore();
    L.glow(ctx, g.x, g.y, 230 * z, 'rgba(255,120,40,0.9)', 0.55 * heat * fl);
    B.embers(ctx, t, 41, 10, g.x, g.y, 120 * z, 260 * z, heat, z * 0.8);
    // rice-pot steam + glass-case LED spill
    const st = o.steam === undefined ? 1 : o.steam, pp = a.proj(0.38, CART.top + 0.32, CART.Z + 0.25);
    if (st > 0) L.steam(ctx, t, 12, pp[0], pp[1], 60 * z, 220 * z, 6, 0.22 * st);
    const lc = a.proj((CART.case0 + CART.case1) / 2, 1.4, CART.Z + 0.1); L.glow(ctx, lc[0], lc[1], 200 * z, 'rgba(200,240,255,0.7)', 0.35);
    // grill smoke, tinted by the neon
    const sm = o.smoke === undefined ? 0.6 : o.smoke;
    if (sm > 0) {
      const sc = rgbs(ctMix(key3(d, '#8a94b8', '#b8a0c0', '#e8d0c4'), '#ff78c0', 0.3 * neon));
      B.smoke(ctx, t, 77, g.x, g.y - 10 * z, 60 * z, 700 * z, 16, 0.42 * sm, 160 * z, sc, 0.9 * z);
      if (neon > 0) neonLight(ctx, g.x + 60 * z, g.y - 260 * z, 260 * z, 0.35 * neon * sm, '255,70,180');
    }
  }
  if (all || layer === 'stools') blitLayer(ctx, view, 'stools', d);
  if (all || layer === 'front') blitLayer(ctx, view, 'front', d);
  ctx.restore();
  return a;
}
function alleyBack(ctx, t, o = {}) { alley(ctx, t, { ...o, layer: 'back' }); return alley(ctx, t, { ...o, layer: 'cart' }); }
function alleyFront(ctx, t, o = {}) { alley(ctx, t, { ...o, layer: 'stools' }); return alley(ctx, t, { ...o, layer: 'front' }); }

// ================================================================== BOKEH BACKDROP (shared)
const BOKC = new Map();
function bokehBack(vi, y1) {
  const key = vi + ':' + y1; let cv = BOKC.get(key); if (cv) return cv;
  cv = createCanvas(W, y1); const c = cv.getContext('2d');
  const p = dawnPal(vi);
  const g = c.createLinearGradient(0, 0, 0, y1); g.addColorStop(0, ctCss(ctMix(p.top, '#000000', 0.2))); g.addColorStop(1, ctCss(ctMix(p.mid, '#000000', 0.35)));
  c.fillStyle = g; c.fillRect(0, 0, W, y1);
  const r = rng(909 + vi);
  const cols = ['255,60,170', '60,220,255', '255,160,70', '255,230,190', '255,60,170'];
  c.globalCompositeOperation = 'screen';
  for (let i = 0; i < 40; i++) {
    const x = r() * W, y = r() * y1, rad = 30 + r() * 110, col = cols[Math.floor(r() * cols.length)], a = (0.12 + r() * 0.3) * (vi ? 0.6 : 1);
    const gg = c.createRadialGradient(x, y, rad * 0.55, x, y, rad); gg.addColorStop(0, `rgba(${col},${a})`); gg.addColorStop(0.85, `rgba(${col},${a * 0.8})`); gg.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = gg; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill();
  }
  if (vi) { const sg = c.createRadialGradient(W * 0.8, 0, 0, W * 0.8, 0, 900); sg.addColorStop(0, 'rgba(255,200,150,0.6)'); sg.addColorStop(1, 'rgba(255,160,120,0)'); c.fillStyle = sg; c.fillRect(0, 0, W, y1); }
  BOKC.set(key, cv); return cv;
}
function bokehDraw(ctx, d, y1) {
  ctx.drawImage(bokehBack(0, y1), 0, 0);
  if (d > 0.001) { ctx.globalAlpha = d; ctx.drawImage(bokehBack(1, y1), 0, 0); ctx.globalAlpha = 1; }
}

// ================================================================== COUNTER TOP
const CTC = new Map();
function counterTex(kind, topDown) {
  const key = kind + topDown; let e = CTC.get(key); if (e) return e;
  const hh = topDown ? H : H, cv = createCanvas(W, hh), c = cv.getContext('2d'), r = rng(kind === 'tile' ? 61 : 62);
  if (kind === 'tile') {
    const T = topDown ? 216 : 180;
    c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, W, hh);
    for (let ty = 0; ty < hh; ty += T) for (let tx = 0; tx < W; tx += T) {
      c.save(); c.translate(tx + T / 2, ty + T / 2);
      const g = c.createRadialGradient(-T * 0.2, -T * 0.2, 0, 0, 0, T * 0.8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e4e2da');
      c.fillStyle = g; c.fillRect(-T / 2, -T / 2, T, T);
      c.fillStyle = '#2a5aa8'; c.strokeStyle = '#2a5aa8'; c.lineWidth = T * 0.03;
      for (let k = 0; k < 4; k++) { c.rotate(PI / 2); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(T * 0.12, -T * 0.1, T * 0.3, -T * 0.06, T * 0.32, 0); c.bezierCurveTo(T * 0.3, T * 0.06, T * 0.12, T * 0.1, 0, 0); c.fill(); c.beginPath(); c.arc(T * 0.5, T * 0.5, T * 0.16, PI, PI * 1.5); c.stroke(); }
      c.beginPath(); c.arc(0, 0, T * 0.06, 0, TAU); c.fillStyle = '#f4f2ea'; c.fill(); c.beginPath(); c.arc(0, 0, T * 0.03, 0, TAU); c.fillStyle = '#c83a2a'; c.fill();
      c.restore();
    }
    c.strokeStyle = 'rgba(150,150,140,0.9)'; c.lineWidth = 4;
    for (let x = 0; x <= W; x += T) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, hh); c.stroke(); }
    for (let y = 0; y <= hh; y += T) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // wear
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(120,110,90,${0.04 + r() * 0.06})`; c.beginPath(); c.arc(r() * W, r() * hh, 10 + r() * 60, 0, TAU); c.fill(); }
  } else {
    const g = c.createLinearGradient(0, 0, W, hh * 0.3); g.addColorStop(0, '#8e96a2'); g.addColorStop(0.4, '#cfd5de'); g.addColorStop(0.7, '#a2aab6'); g.addColorStop(1, '#bcc2cc');
    c.fillStyle = g; c.fillRect(0, 0, W, hh);
    for (let i = 0; i < 2600; i++) { const y = r() * hh, x = r() * W, l = 60 + r() * 400; c.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.08})` : `rgba(40,46,60,${0.04 + r() * 0.07})`; c.lineWidth = 1 + r(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + (r() - 0.5) * 2); c.stroke(); }
    c.strokeStyle = 'rgba(40,46,60,0.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, hh * 0.72); c.lineTo(W, hh * 0.72); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, hh * 0.72 + 3); c.lineTo(W, hh * 0.72 + 3); c.stroke();
  }
  e = { cv }; CTC.set(key, e); return e;
}
function counterTop(ctx, t, o = {}) {
  const d = clamp(o.dawn || 0), neon = o.neon === undefined ? 0.8 : clamp(o.neon), kind = o.surface === 'tile' ? 'tile' : 'steel', p = dawnPal(d);
  ctx.save();
  let res;
  if (o.topDown) {
    ctx.drawImage(counterTex(kind, true).cv, 0, 0);
    // ambient grade
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ctCss(ctMix(p.amb, '#ffffff', 0.35)); ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'screen';
    // neon smears (diagonal) + dawn patch
    for (const [x, y, rx, ry, rot, col, k] of [[180, 300, 520, 140, -0.5, '255,60,170', 0.38], [900, 520, 420, 110, -0.5, '60,220,255', 0.28]]) {
      ctx.save(); ctx.translate(x + Math.sin(t * 0.3) * 20, y); ctx.rotate(rot); ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${col},${k * neon})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2); ctx.restore();
    }
    if (p.sun > 0) L.glow(ctx, W * 0.85, H * 0.15, 1100, 'rgba(255,190,130,0.8)', 0.55 * p.sun);
    L.glow(ctx, W * 0.15, H * 0.9, 700, 'rgba(255,130,50,0.6)', 0.35);
    ctx.globalCompositeOperation = 'source-over';
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,6,20,0.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    res = { edge: 0, center: { x: W / 2, y: H / 2 }, proj: (u, v) => ({ x: W / 2 + u * W / 2, y: H / 2 + (v * 2 - 1) * H / 2, s: 1 }) };
  } else {
    const edge = o.edge === undefined ? 1080 : o.edge;
    bokehDraw(ctx, d, edge + 4);
    // the surface in perspective: texture squeezed toward the edge
    const tex = counterTex(kind, false).cv, rows = 24;
    for (let i = 0; i < rows; i++) {
      const v0 = i / rows, v1 = (i + 1) / rows, y0 = edge + (H - edge) * Math.pow(v0, 1.5), y1 = edge + (H - edge) * Math.pow(v1, 1.5);
      const dw = W * (1 + 0.42 * (1 - v0)); // far rows wider + centred so the near edge covers 0..W
      ctx.drawImage(tex, 0, v0 * H * 0.6, W, (v1 - v0) * H * 0.6 + 1, (W - dw) / 2, y0, dw, y1 - y0 + 1);
    }
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ctCss(ctMix(p.amb, '#ffffff', 0.35)); ctx.fillRect(0, edge, W, H - edge); ctx.globalCompositeOperation = 'source-over';
    const dg = ctx.createLinearGradient(0, edge, 0, H); dg.addColorStop(0, 'rgba(8,6,20,0.45)'); dg.addColorStop(0.3, 'rgba(8,6,20,0)'); dg.addColorStop(1, 'rgba(8,6,20,0.35)');
    ctx.fillStyle = dg; ctx.fillRect(0, edge, W, H - edge);
    // edge highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, edge, W, 3);
    // reflections (vertical streaks of the bokeh lights)
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const [x, col, k, w] of [[260, '255,60,170', 0.42, 120], [780, '60,220,255', 0.32, 90], [560, '255,160,70', 0.3, 160]]) {
      const xx = x + Math.sin(t * 0.4 + x) * 10;
      const g = ctx.createLinearGradient(0, edge, 0, edge + 600); g.addColorStop(0, `rgba(${col},${k * (col[0] === '2' && col[1] === '5' ? neon : 1)})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(xx - w * 0.4, edge); ctx.lineTo(xx + w * 0.4, edge); ctx.lineTo(xx + w, edge + 600); ctx.lineTo(xx - w, edge + 600); ctx.closePath(); ctx.fill();
    }
    if (p.sun > 0) L.glow(ctx, W * 0.8, edge, 900, 'rgba(255,190,130,0.8)', 0.5 * p.sun);
    ctx.restore();
    res = {
      edge, center: { x: W / 2, y: edge + (H - edge) * 0.42 },
      proj: (u, v) => { const yy = edge + 30 + (H - edge - 60) * Math.pow(v, 1.3); const s = lerp(0.62, 1, v); return { x: W / 2 + u * W * 0.5 * s, y: yy, s }; },
    };
  }
  ctx.restore();
  return res;
}

// ================================================================== GRILL CLOSE-UP
const GRC = { far: 720, near: 1520, hwF: 400, hwN: 640 };
const gPt = (u, v) => { const hw = lerp(GRC.hwF, GRC.hwN, v); return [W / 2 + (u - 0.5) * 2 * hw, lerp(GRC.far, GRC.near, v)]; };
let GRL = null;
function buildGrill() {
  if (GRL) return GRL;
  const mk = () => { const cv = createCanvas(W, H); return [cv, cv.getContext('2d')]; };
  const [cDark, a] = mk(), [cHot, b] = mk(), [cRack, k] = mk(), [cBox, m] = mk();
  const r = rng(4242);
  const bed = (c) => { const p0 = gPt(0.02, 0.0), p1 = gPt(0.98, 0.0), p2 = gPt(1.0, 1), p3 = gPt(0, 1); c.beginPath(); c.moveTo(p0[0], p0[1] + 40); c.lineTo(p1[0], p1[1] + 40); c.lineTo(p2[0] - 10, p2[1] + 70); c.lineTo(p3[0] + 10, p3[1] + 70); c.closePath(); };
  // box: inner far wall + side walls (sooty, lit from below) and the rim
  {
    const c = m;
    const f0 = gPt(-0.04, -0.08), f1 = gPt(1.04, -0.08), n0 = gPt(-0.04, 1.05), n1 = gPt(1.04, 1.05);
    c.fillStyle = '#120c0a'; c.beginPath(); c.moveTo(f0[0], f0[1]); c.lineTo(f1[0], f1[1]); c.lineTo(n1[0], n1[1] + 90); c.lineTo(n0[0], n0[1] + 90); c.closePath(); c.fill();
    const g = c.createLinearGradient(0, f0[1], 0, f0[1] + 120); g.addColorStop(0, '#2a1a14'); g.addColorStop(1, '#6a2a10');
    c.fillStyle = g; c.beginPath(); c.moveTo(f0[0] + 20, f0[1]); c.lineTo(f1[0] - 20, f1[1]); c.lineTo(f1[0] - 40, f1[1] + 120); c.lineTo(f0[0] + 40, f0[1] + 120); c.closePath(); c.fill();
  }
  // coals: chunks, dark layer + hot cracks layer
  for (const c of [a, b]) { c.save(); bed(c); c.clip(); }
  a.fillStyle = '#2a0c04'; a.fillRect(0, 0, W, H);
  b.fillStyle = 'rgba(255,90,20,0.9)'; b.fillRect(0, 0, W, H);
  const chunks = [];
  for (let i = 0; i < 520; i++) { const u = r() * 1.04 - 0.02, v = Math.pow(r(), 0.85) * 1.05; chunks.push([u, v, r(), r(), r(), r()]); }
  chunks.sort((p, q) => p[1] - q[1]);
  for (const [u, v, q1, q2, q3, q4] of chunks) {
    const [x, y0] = gPt(u, v), y = y0 + lerp(40, 70, v), s = lerp(0.62, 1, v) * (26 + q1 * 36), n = 6 + Math.floor(q2 * 3), rot = q3 * TAU;
    const pts = []; const rr = rng(Math.floor(q4 * 1e6));
    for (let j = 0; j < n; j++) { const aa = rot + j / n * TAU, rad = s * (0.65 + rr() * 0.45); pts.push([x + Math.cos(aa) * rad, y + Math.sin(aa) * rad * 0.62]); }
    const path = (c) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.closePath(); };
    // dark: charcoal body with ash-grey top
    path(a); const g = a.createLinearGradient(x, y - s, x, y + s * 0.6); g.addColorStop(0, q1 < 0.35 ? '#8a8078' : '#3a302c'); g.addColorStop(0.5, '#1c1412'); g.addColorStop(1, '#0c0807');
    a.fillStyle = g; a.fill(); a.strokeStyle = 'rgba(0,0,0,0.6)'; a.lineWidth = 2; a.stroke();
    // hot: edges + cracks glow, body mostly black (so screen adds only edges)
    path(b); b.fillStyle = q2 < 0.3 ? 'rgba(255,120,30,0.55)' : 'rgba(0,0,0,0.92)'; b.fill();
    b.strokeStyle = q3 < 0.5 ? 'rgba(255,190,80,0.95)' : 'rgba(255,110,30,0.9)'; b.lineWidth = 2 + q4 * 3; b.stroke();
    if (q4 < 0.6) { b.strokeStyle = 'rgba(255,220,130,0.85)'; b.lineWidth = 1.5; b.beginPath(); b.moveTo(x - s * 0.4, y - s * 0.1); b.lineTo(x + s * 0.1 * (q1 - 0.5) * 4, y + s * 0.05); b.lineTo(x + s * 0.4, y - s * 0.15); b.stroke(); }
  }
  a.restore(); b.restore();
  // rim of the brazier (sooty sheet metal) drawn on box layer last part -> separate pass in rack canvas front
  // rack: stainless wire grill
  {
    const c = k; c.lineCap = 'round';
    const rod = (p0, p1, w) => {
      c.strokeStyle = 'rgba(60,30,20,0.9)'; c.lineWidth = w + 2; c.beginPath(); c.moveTo(p0[0], p0[1] + 2); c.lineTo(p1[0], p1[1] + 2); c.stroke();
      c.strokeStyle = '#9aa0aa'; c.lineWidth = w; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = Math.max(1, w * 0.3); c.beginPath(); c.moveTo(p0[0], p0[1] - w * 0.25); c.lineTo(p1[0], p1[1] - w * 0.25); c.stroke();
    };
    for (let i = 0; i <= 30; i++) { const v = i / 30; rod(gPt(0, v), gPt(1, v), lerp(3.5, 6, v)); }
    for (let i = 0; i <= 5; i++) { const u = i / 5; rod(gPt(u, -0.02), gPt(u, 1.02), 7); }
    rod(gPt(0, -0.02), gPt(1, -0.02), 9); rod(gPt(0, 1.02), gPt(1, 1.02), 11);
    // handles toward the viewer
    for (const u of [0.32, 0.68]) { const p = gPt(u, 1.02); rod(p, [p[0] + (u - 0.5) * 140, H + 40], 12); }
  }
  GRL = { cDark, cHot, cRack, cBox, bed };
  return GRL;
}
function grillClose(ctx, t, o = {}) {
  const G = buildGrill(), d = clamp(o.dawn || 0), heat = o.heat === undefined ? 1 : clamp(o.heat), fan = clamp(o.fan || 0), neon = o.neon === undefined ? 0.8 : o.neon;
  ctx.save();
  bokehDraw(ctx, d, 760);
  neonLight(ctx, 160, 260, 600, 0.6 * neon, '255,60,170'); neonLight(ctx, 940, 200, 380, 0.4 * neon, '60,220,255');
  ctx.drawImage(G.cBox, 0, 0);
  ctx.drawImage(G.cDark, 0, 0);
  const fl = 0.82 + 0.18 * Math.sin(t * 11) * Math.sin(t * 6.3 + 1);
  const hk = clamp(heat * (0.7 + 0.3 * fl) + fan * 0.45, 0, 1.4);
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = Math.min(1, hk); ctx.drawImage(G.cHot, 0, 0);
  if (hk > 1) { ctx.globalAlpha = hk - 1; ctx.drawImage(G.cHot, 0, 0); }
  ctx.globalAlpha = 1;
  // breathing hot spots
  ctx.save(); G.bed(ctx); ctx.clip();
  for (let i = 0; i < 5; i++) {
    const u = 0.5 + 0.38 * Math.sin(t * (0.3 + i * 0.07) + i * 2.1), v = 0.5 + 0.4 * Math.sin(t * (0.23 + i * 0.05) + i * 1.3);
    const [x, y] = gPt(u, v);
    L.glow(ctx, x, y + 60, 260, `rgba(255,${(120 + 60 * fan) | 0},40,0.9)`, (0.35 + 0.3 * fan) * heat * (0.6 + 0.4 * Math.sin(t * 2.3 + i)));
  }
  if (fan > 0) L.glow(ctx, W / 2, 1150, 700, 'rgba(255,220,140,0.9)', 0.35 * fan);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  // rack (lit from below)
  if (o.rack !== false) {
    ctx.drawImage(G.cRack, 0, 0);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.35 * heat; ctx.fillStyle = '#ff7a30';
    ctx.fillRect(0, GRC.far - 20, W, GRC.near - GRC.far + 60); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // re-darken outside the bed so the tint stays on the grill
  }
  // brazier front rim + cart edge (steel catching the fire)
  {
    const n0 = gPt(-0.04, 1.05), n1 = gPt(1.04, 1.05);
    const g = ctx.createLinearGradient(0, n0[1] + 50, 0, n0[1] + 120); g.addColorStop(0, '#3a2a22'); g.addColorStop(1, '#141010');
    ctx.fillStyle = g; ctx.fillRect(0, n0[1] + 50, W, 90);
    ctx.fillStyle = `rgba(255,150,70,${0.6 * heat})`; ctx.fillRect(n0[0], n0[1] + 48, n1[0] - n0[0], 5);
    const sg = ctx.createLinearGradient(0, n0[1] + 140, 0, H); sg.addColorStop(0, '#c8ced8'); sg.addColorStop(0.15, '#8a929e'); sg.addColorStop(1, '#4a505a');
    ctx.fillStyle = sg; ctx.fillRect(0, n0[1] + 140, W, H);
    ctx.globalCompositeOperation = 'screen';
    L.glow(ctx, W / 2, n0[1] + 160, 600, 'rgba(255,130,50,0.9)', 0.5 * heat * fl);
    L.glow(ctx, 200, H - 80, 420, 'rgba(255,60,170,0.8)', 0.35 * neon);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, n0[1] + 140, W, 3);
  }
  // sparks + smoke
  B.embers(ctx, t, 88, 14 + Math.round(fan * 26), W / 2, 1300, 900, 1100, heat, 1.4 + fan);
  const sm = o.smoke === undefined ? 0.5 : o.smoke;
  if (sm > 0) B.smoke(ctx, t, 89, W / 2, 1100, 700, 1200, 12, 0.3 * sm, 120, rgbs(ctMix(key3(d, '#9aa2c4', '#c4a8c8', '#f0d8c8'), '#ff8a50', 0.2)), 1.6);
  ctx.restore();
  return {
    rackPt: (u, v) => { const [x, y] = gPt(u, v); return { x, y, s: lerp(0.67, 1, v) }; },
    rack: { x0: gPt(0, 0)[0], y0: GRC.far, x1: gPt(1, 0)[0], y1: GRC.near }, center: { x: W / 2, y: (GRC.far + GRC.near) / 2 }, coal: { x: W / 2, y: (GRC.far + GRC.near) / 2 + 60 },
  };
}

module.exports = {
  dawnPal, ctMix, ctCss, sky, aerial, alley, alleyBack, alleyFront, counterTop, grillClose,
  neonLight, neonFlicker, lampPool, sunShafts, dawnTint, CT_ENV: { AE, VIEWS, SIGN, CART, TABLE },
};
