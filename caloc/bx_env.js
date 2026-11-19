// bx_env.js - bánh xèo environments: golden hour → sunset → dusk riverside stilt house, kitchen interior, herb garden.
// =====================================================================================================================
// API HEADER (shot writers: rely on this block only)
// Conventions: every function draws in LOCAL coords (the current ctx transform). Scenes paint the FULL frame 0..W×0..H
//   (W=1080,H=1920) unless y0/y1 are given. All are save()/restore()d and deterministic from t / seed.
//   dusk: 0 = 5 PM gold (amber sun, magenta clouds) · 0.5 = sunset (sun touching the horizon) · 1 = after sunset
//   (indigo/purple, first stars, lights on). Static parts are cached offscreen at module level (first call builds them).
//
// GOLD                                    palette object (sky/water stops for dusk 0 and 1, silhouettes, wood, fire …)
// sunsetSky(ctx, y0, y1, {t, sun:[x,y], sunS=1, flare=0, dusk=0, clouds=7, seed=5, panX=0, stars=auto, x0=0, w=W})
//     sky gradient y0..y1 (y1 = horizon), magenta/violet backlit clouds, sun disc (clipped at y1 so it can sink),
//     big amber halo, stars when dusk>0.45.                                            → {sun:[x,y]}
// sunsetWater(ctx, y0, y1, t, {sunX=760, dusk=0, panX=0, glitter=170, rippleAlpha=1, x0=0, w=W})
//     copper river y0..y1 with a long orange sun path + ripple lines.                    → {sunX}
// stiltHouse(ctx, x, y, s, {t, dusk=0, smoke=true, lights=auto(dusk>0.55), part='all'|'back'|'front',
//            glow=1 (kitchen-window fire), door=1 (warm doorway), reflect=true, ripples=true})
//     origin (x,y) = WATERLINE under the middle of the deck. Size at s=1: ~820 wide (x −400…+420), roof ridge y≈−540,
//     deck surface y≈−140, deck front edge −125. 'back' = house, deck, stools, lights, reflection;
//     'front' = low table, front stilts, ladder, mooring post (draw people between the two parts).
//     A person on the deck: coUt/maTu/tourist at s ≈ 0.30*s (returned as personS).
//     → LOCAL anchors {deck:[x,y] (deck surface centre), deckL, deckR, table:[x,y] (table-top centre), tableW,
//        stools:[[x,y],[x,y]] (stool foot points on the deck = person origin; draw person with stool:false),
//        seat:[[x,y],…] (seat tops), window:[x,y] (kitchen window centre), door:[x,y], ladderFoot, ladderTop,
//        mooring:[x,y] (rope post), chimney:[x,y], personS}
// riversideScene(ctx, t, {panX=0, horizon=1000, dusk=0, sun:[x,y], sunS=1.25, flare=0.5, house:{x,y,s}|null,
//            palms=true, garden=true, lights=auto, high=0, cam:{zoom=1, cx=W/2, cy=H/2}, housePart='all', mid(ctx)})
//     full frame: sunset sky, palm/nipa bank silhouette (rim lit) with the sun behind it, copper water, stilt house
//     (default {x:600, y:horizon+170, s:0.9}), herb boxes + clay pots on the bank.
//     high 0..1: drone height (raises the true horizon, shows the delta plain + a shining canal, shrinks the trees)
//     → use high 1→0 together with cam.zoom for the s1 push-down. cam = lib.cam-style (world point cx,cy at centre).
//     o.mid(ctx) is called after the house 'back' part (people on deck), then the 'front' part is drawn.
//     → {horizon, sun:[x,y], house: stiltHouse anchors (LOCAL, after cam) | null, camXY(p) maps world→screen}
// kitchenInterior(ctx, t, {view='wide'|'stove', dusk=0, fire=1, beams=true, smoke=1})
//     dark kitchen, clay stove with 2 fire mouths + 2 cast-iron pans, bamboo-slat back wall with light leaks,
//     window with the sunset outside, baskets, ladles, garlic braid, shelf. 'stove' = 1.6× closer on the stove top.
//     → {stove:[x,y] (top centre), pans:[{x,y,rx,ry}×2] (inner surface ellipse), fireY, mouths:[[x,y]×2],
//        window:{x,y,w,h}, view}
// herbGarden(ctx, t, {dusk=0, sun:[x,y]=[820,330], sway=1})
//     close garden on the bank: river + sunset behind (top ~0..900), styrofoam boxes + old basins.
//     → {lacach:[x,y], caibe:[x,y], lettuce:[x,y], hung:[x,y], diepca:[x,y]  (pick points: top of each plant),
//        boxes:{name:{x,y,w}} , ground:y}
// Timings (warm cache): sunsetSky ~1.5 ms, sunsetWater ~2 ms, stiltHouse ~3 ms, riversideScene ~8-12 ms,
//   kitchenInterior ~6-9 ms, herbGarden ~6 ms (first call builds sprites: +50-250 ms).
// =====================================================================================================================
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const { W, H, TAU, rng, clamp, lerp, ease, glow } = L;
const PI = Math.PI;
const { mixc, rgba, lgr, rgr, ell, canvas, rrect } = NP;

const GOLD = {
  sky0: ['#46549a', '#9a64a4', '#e3787a', '#f8a556', '#ffd889'],
  sky1: ['#0b0f2c', '#231d50', '#55306a', '#a8464f', '#e27348'],
  sunCore: '#fff4cf', sun: '#ffc46a', sunRed: '#ff6a3a',
  cloud0: ['#7a5694', '#c96a8e', '#ffb07a'], cloud1: ['#2a2350', '#5a3468', '#d86a6a'],
  water0: ['#f6b878', '#c47858', '#7c4654', '#3c2a46'], water1: ['#d0705a', '#6e3a5a', '#2e2046', '#110f26'],
  sil: '#3d2a4e', silD: '#271a36', silNear: '#1a1224', rim: '#ffb35c', rimDusk: '#ff7a64',
  thatch: '#b98c4f', thatchD: '#6e4a28', thatchL: '#f0c47c', bamboo: '#c8a062', bambooD: '#8a6434', bambooL: '#ecc98a',
  wood: '#6b4127', woodD: '#3e2416', woodL: '#a06a42', stilt: '#4a3020', palmW: '#7a6a3c',
  fire: '#ff8a2a', fireHot: '#ffe08a', ember: '#ff5a1a', clay: '#a8583a', clayD: '#5a2a1a', clayL: '#d4875a',
  iron: '#262222', ironL: '#5c5450', styro: '#efeadf', basin: '#3f7fb8', alu: '#b8b8b4',
  leaf: '#4f9a35', leafL: '#8fd05a', leafD: '#2c6428', bulb: '#ffd98a',
};
const _mips = new WeakMap();
function halfOf(c) { let h = _mips.get(c); if (!h) { const [hc, hx] = canvas(Math.ceil(c.width / 2), Math.ceil(c.height / 2)); hx.drawImage(c, 0, 0, hc.width, hc.height); _mips.set(c, hc); h = hc; } return h; }
function mipFor(ctx, c, dw) { // pre-halved copy when drawn much smaller than the source (big downscales are slow in skia)
  const m = ctx.getTransform(); let k = dw * Math.hypot(m.a, m.b) / c.width, r = 1;
  while (k < 0.6 && c.width > 96) { c = halfOf(c); k *= 2; r *= 2; }
  return [c, r];
}
const _blend = new Map();
function blendOf(c0, c1, d, key) { // light sprite c0 with the dusk sprite c1 laid over at alpha d, quantised to 1/16 and cached (1 draw instead of 2)
  const q = Math.round(clamp(d) * 16); if (q === 0) return c0; if (q === 16) return c1;
  const k = key + '|' + c0.width + '|' + q; let b = _blend.get(k); if (b) return b;
  const [bc, bx] = canvas(c0.width, c0.height); bx.drawImage(c0, 0, 0); bx.globalAlpha = q / 16; bx.drawImage(c1, 0, 0);
  if (_blend.size > 400) _blend.clear(); _blend.set(k, bc); return bc;
}
const skyStops = (d) => GOLD.sky0.map((c, i) => mixc(c, GOLD.sky1[i], d));
const pmod = (a, m) => ((a % m) + m) % m;

// ------------------------------------------------------------------ clouds (cached per variant, gold + dusk)
const _cloud = {};
function cloudSprite(v, dk) {
  const key = v + ':' + dk; if (_cloud[key]) return _cloud[key];
  const r = rng(300 + v * 31), cw = 760, ch = 170, [c, x] = canvas(cw, ch);
  const P = dk ? GOLD.cloud1 : GOLD.cloud0;
  const path = () => {
    x.beginPath();
    const n = 9 + Math.floor(r() * 6);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), cx = 60 + u * (cw - 120) + (r() - 0.5) * 30, env = Math.sin(u * PI);
      const rx = 50 + r() * 70, ry = (16 + r() * 30) * (0.45 + env);
      x.moveTo(cx + rx, ch * 0.62 - ry * 0.4); x.ellipse(cx, ch * 0.62 - ry * 0.4, rx, ry, 0, 0, TAU);
    }
    x.rect(40, ch * 0.6, cw - 80, 10);
  };
  path();
  x.fillStyle = lgr(x, 0, 20, 0, ch * 0.72, [[0, P[0]], [0.6, P[1]], [1, P[2]]]); x.fill();
  // lit underside streak
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = lgr(x, 0, ch * 0.5, 0, ch * 0.72, [[0, 'rgba(255,200,140,0)'], [1, dk ? 'rgba(255,120,110,0.75)' : 'rgba(255,225,160,0.9)']]);
  x.fillRect(0, 0, cw, ch);
  _cloud[key] = { c, w: cw, h: ch };
  return _cloud[key];
}

// ------------------------------------------------------------------ SKY
function sunsetSky(ctx, y0, y1, o = {}) {
  const d = clamp(o.dusk || 0), t = o.t || 0, x0 = o.x0 ?? 0, w = o.w ?? W, panX = o.panX || 0;
  const sun = o.sun || [760, y1 - 150 + d * 230], sS = o.sunS ?? 1;
  const S = skyStops(d);
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y1, [[0, S[0]], [0.34, S[1]], [0.62, S[2]], [0.86, S[3]], [1, S[4]]]);
  ctx.fillRect(x0, y0, w, y1 - y0 + 1);
  ctx.beginPath(); ctx.rect(x0, y0, w, y1 - y0); ctx.clip();
  // stars
  const sa = o.stars ?? clamp((d - 0.45) / 0.45);
  if (sa > 0) {
    const r = rng(91); ctx.fillStyle = '#fff6e6';
    for (let i = 0; i < 90; i++) {
      const sx = x0 + r() * w, sy = y0 + Math.pow(r(), 1.6) * (y1 - y0) * 0.6, rad = 0.8 + r() * 1.9, ph = r() * TAU;
      ctx.globalAlpha = sa * (0.45 + 0.55 * Math.sin(t * (1.5 + r() * 2) + ph)) * (1 - (sy - y0) / ((y1 - y0) * 0.75));
      ctx.beginPath(); ctx.arc(sx, sy, rad, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // big amber halo hugging the horizon around the sun
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.translate(sun[0], y1); ctx.scale(1.7, 1);
  const hr = 700 * sS;
  ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, hr, [[0, rgba(mixc('#ffc060', '#ff6a40', d), 0.75 - d * 0.25)], [0.4, rgba(mixc('#ff9a50', '#c04a50', d), 0.35)], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(-hr, -hr, hr * 2, hr);
  ctx.restore();
  // clouds
  const nC = o.clouds ?? 7, r = rng(o.seed ?? 5);
  for (let i = 0; i < nC; i++) {
    const v = Math.floor(r() * 5), depth = r(), yy = y0 + (0.12 + depth * 0.72) * (y1 - y0) * 0.92;
    const sc = 0.55 + depth * 0.9 + r() * 0.3, cx = x0 + pmod(r() * (w + 900) - panX * (0.1 + depth * 0.25) + t * 4 * (0.4 + depth), w + 900) - 450;
    const a0 = 0.55 + 0.45 * r();
    for (const dk of [0, 1]) {
      const al = (dk ? d : 1 - d) * a0; if (al < 0.02) continue;
      const sp = cloudSprite(v, dk); ctx.globalAlpha = al;
      ctx.drawImage(mipFor(ctx, sp.c, sp.w * sc)[0], cx - sp.w * sc / 2, yy - sp.h * sc * 0.6, sp.w * sc, sp.h * sc * (0.55 + depth * 0.45));
    }
  }
  ctx.globalAlpha = 1;
  // sun disc (clipped at the horizon)
  if (sun[1] - 80 * sS < y1) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    glow(ctx, sun[0], sun[1], 300 * sS, rgba(mixc('#ffcf7a', '#ff7a4a', d), 0.9), 0.9 - d * 0.4);
    ctx.restore();
    const R = 74 * sS;
    ctx.fillStyle = rgr(ctx, sun[0], sun[1], 0, sun[0], sun[1], R, [[0, GOLD.sunCore], [0.55, mixc(GOLD.sunCore, GOLD.sun, d)], [1, mixc(GOLD.sun, GOLD.sunRed, 0.3 + d * 0.7)]]);
    ctx.beginPath(); ctx.arc(sun[0], sun[1], R, 0, TAU); ctx.fill();
    // thin cloud bands across the low sun
    ctx.globalAlpha = 0.45; ctx.fillStyle = mixc('#c86a7a', '#5a2a5a', d);
    for (let i = 0; i < 3; i++) { const yy = sun[1] - R * 0.2 + i * R * 0.32; ctx.fillRect(sun[0] - R * (1.6 - i * 0.2), yy, R * (3.4 - i * 0.6), 2.5 + i * 1.5); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if ((o.flare || 0) > 0 && sun[1] < y1 + 20) L.flare(ctx, sun[0], sun[1], sS * 0.9, o.flare * (1 - d * 0.6));
  return { sun };
}

// ------------------------------------------------------------------ WATER
function sunsetWater(ctx, y0, y1, t, o = {}) {
  const d = clamp(o.dusk || 0), sx = o.sunX ?? 760, panX = o.panX || 0, x0 = o.x0 ?? 0, w = o.w ?? W, hh = y1 - y0;
  const C = GOLD.water0.map((c, i) => mixc(c, GOLD.water1[i], d));
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y1, [[0, C[0]], [0.12, C[1]], [0.5, C[2]], [1, C[3]]]);
  ctx.fillRect(x0, y0, w, hh + 1);
  ctx.beginPath(); ctx.rect(x0, y0, w, hh); ctx.clip();
  // soft sun column
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(sx, y0); ctx.scale(0.42, 1);
  ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, hh * 1.1, [[0, rgba(mixc('#ffcf80', '#ff7050', d), 0.75 - d * 0.3)], [0.5, rgba(mixc('#e88050', '#a04050', d), 0.25)], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(-hh * 1.1, 0, hh * 2.2, hh * 1.1); ctx.restore();
  // ripple lines (light + dark)
  const ra = o.rippleAlpha ?? 1, r = rng(23);
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const u = Math.pow(r(), 1.5), yy = y0 + u * hh, len = 30 + u * 260 + r() * 80, lw = 1 + u * 4;
    const xx = x0 + pmod(r() * (w + 400) - panX * (0.4 + u) + Math.sin(t * 0.8 + i) * 12 * (0.3 + u), w + 400) - 200;
    const dark = r() < 0.5;
    ctx.strokeStyle = dark ? rgba(mixc('#4a2a44', '#0a0a1c', d), 0.35 * ra) : rgba(mixc('#ffc890', '#c86a7a', d), (0.22 - u * 0.08) * ra);
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy); ctx.stroke();
  }
  // glitter path
  const n = o.glitter ?? 170, gc = mixc('#fff2c4', '#ffa070', d);
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = gc;
  const r2 = rng(17);
  for (let i = 0; i < n; i++) {
    const u = Math.pow(r2(), 1.3), yy = y0 + 3 + u * hh, hw = 18 + u * 330, ph = r2() * TAU;
    const xx = sx + (r2() * 2 - 1) * hw * Math.sqrt(r2()) + Math.sin(t * 1.4 + ph) * 6 * u - panX * 0.02;
    const tw = 0.5 + 0.5 * Math.sin(t * (2.5 + r2() * 3) + ph);
    ctx.globalAlpha = tw * (1 - Math.abs(xx - sx) / (hw * 1.1)) * (0.95 - d * 0.35);
    const len = 6 + u * 70, th = 1.2 + u * 4.5;
    ctx.fillRect(xx - len / 2, yy - th / 2, len, th);
  }
  ctx.restore();
  // horizon shine line
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lgr(ctx, sx - 500, 0, sx + 500, 0, [[0, 'rgba(255,200,140,0)'], [0.5, rgba(mixc('#fff0c0', '#ff9070', d), 0.8)], [1, 'rgba(255,200,140,0)']]);
  ctx.fillRect(sx - 500, y0, 1000, 3);
  ctx.restore();
  return { sunX: sx };
}

// ------------------------------------------------------------------ STILT HOUSE (cached sprites: back/front × gold/dusk)
const HQ = 2, HOX = 420, HOY = 600, HW = 860, HH = 660;
const HA = { deckY: -140, deckBack: -178, deckFront: -125, tableX: -110, tableTop: -186, tableW: 150, stools: [-215, -5], seatH: 24, win: [212, -246], door: [-210, -232], chim: [262, -392], ladder: [[70, -125], [112, -125], [86, 12], [128, 12]], moor: [176, -44] };
const _house = {};
function hcol(c, dk) { return dk ? mixc(c, '#231a36', 0.62) : c; }
function thatchFill(x, dk, x0, x1, ytop, ybot) {
  x.save(); x.clip();
  x.fillStyle = lgr(x, 0, ytop, 0, ybot, [[0, hcol(GOLD.thatchL, dk)], [0.5, hcol(GOLD.thatch, dk)], [1, hcol(GOLD.thatchD, dk)]]); x.fillRect(x0, ytop, x1 - x0, ybot - ytop);
  const r = rng(41); x.lineCap = 'round';
  for (let row = ytop; row < ybot + 20; row += 16) {
    x.strokeStyle = rgba(hcol('#5a3a1c', dk), 0.55); x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(x0, row + 10); x.lineTo(x1, row + 10); x.stroke();
    for (let xx = x0; xx < x1; xx += 7 + r() * 5) {
      x.strokeStyle = r() < 0.5 ? rgba(hcol('#f4d090', dk), 0.45) : rgba(hcol('#5a3a1c', dk), 0.4); x.lineWidth = 1.4;
      x.beginPath(); x.moveTo(xx, row); x.lineTo(xx + (r() - 0.5) * 4, row + 12 + r() * 6); x.stroke();
    }
  }
  x.restore();
}
function slats(x, dk, x0, x1, y0, y1, step, col) {
  x.fillStyle = hcol(col || GOLD.bamboo, dk); x.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let xx = x0, i = 0; xx < x1; xx += step, i++) {
    x.fillStyle = hcol(i % 2 ? GOLD.bambooL : GOLD.bamboo, dk); x.fillRect(xx, y0, step - 1.5, y1 - y0);
    x.fillStyle = rgba(hcol('#3a2410', dk), 0.6); x.fillRect(xx + step - 1.5, y0, 1.5, y1 - y0);
  }
}
function post(x, dk, px, y0, y1, wd, col) {
  x.fillStyle = lgr(x, px - wd / 2, 0, px + wd / 2, 0, [[0, hcol(GOLD.woodD, dk)], [0.4, hcol(col || GOLD.stilt, dk)], [0.85, hcol(GOLD.woodL, dk)], [1, hcol(dk ? '#c06060' : '#ffb870', dk ? 0 : 0)]]);
  x.fillRect(px - wd / 2, y0, wd, y1 - y0);
}
function drawHouse(x, dk, part) {
  x.lineJoin = 'round'; x.lineCap = 'round';
  const out = hcol('#2a160c', dk), rim = dk ? 'rgba(255,130,110,0.55)' : 'rgba(255,200,120,0.95)';
  if (part === 'back') {
    // back stilts
    for (let px = -330; px <= 310; px += 64) post(x, dk, px + 22, -190, 8, 11, '#3a2418');
    // kitchen wing (woven nipa walls)
    x.fillStyle = hcol('#8a6a3a', dk); x.fillRect(110, -330, 200, 192);
    x.strokeStyle = rgba(hcol('#4a3018', dk), 0.7); x.lineWidth = 2;
    for (let yy = -326; yy < -140; yy += 9) { x.beginPath(); x.moveTo(110, yy); x.lineTo(310, yy + 2); x.stroke(); }
    for (let xx = 116; xx < 310; xx += 14) { x.strokeStyle = rgba(hcol('#c8a466', dk), 0.35); x.beginPath(); x.moveTo(xx, -330); x.lineTo(xx + 3, -140); x.stroke(); }
    x.fillStyle = hcol(GOLD.woodD, dk); x.fillRect(108, -334, 8, 196); x.fillRect(304, -334, 8, 196);
    // kitchen window (dark; fire added per frame)
    x.fillStyle = '#140806'; x.fillRect(HA.win[0] - 42, HA.win[1] - 34, 84, 68);
    x.strokeStyle = hcol(GOLD.woodD, dk); x.lineWidth = 6; x.strokeRect(HA.win[0] - 42, HA.win[1] - 34, 84, 68);
    x.lineWidth = 3; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(HA.win[0] + i * 21, HA.win[1] - 34); x.lineTo(HA.win[0] + i * 21, HA.win[1] + 34); x.stroke(); }
    // main body bamboo slats
    slats(x, dk, -300, 112, -380, HA.deckBack, 12);
    x.fillStyle = hcol(GOLD.woodD, dk);
    for (const yy of [-382, -290, HA.deckBack - 6]) x.fillRect(-304, yy, 420, 8);
    for (const xx of [-304, -100, 104]) x.fillRect(xx, -384, 10, HA.deckBack + 384);
    // doorway
    x.fillStyle = '#120806'; x.fillRect(HA.door[0] - 42, -318, 84, -318 * -1 + HA.deckBack);
    x.fillStyle = hcol(GOLD.woodD, dk); x.fillRect(HA.door[0] - 48, -324, 96, 8); x.fillRect(HA.door[0] - 48, -324, 7, 150); x.fillRect(HA.door[0] + 41, -324, 7, 150);
    // main window with propped shutter
    x.fillStyle = '#1a0c08'; x.fillRect(-40, -318, 96, 66);
    x.save(); x.translate(-40, -318); x.rotate(-0.5); x.fillStyle = hcol(GOLD.woodL, dk); x.fillRect(0, -6, 96, 10); x.restore();
    x.fillStyle = hcol(GOLD.wood, dk); x.beginPath(); x.moveTo(-40, -318); x.lineTo(56, -318); x.lineTo(56 + 24, -318 - 54); x.lineTo(-40 + 24, -318 - 54); x.closePath(); x.fill();
    x.strokeStyle = hcol(GOLD.woodD, dk); x.lineWidth = 5; x.strokeRect(-40, -318, 96, 66);
    // kitchen lean-to roof
    x.beginPath(); x.moveTo(96, -440); x.lineTo(120, -446); x.lineTo(346, -322); x.lineTo(332, -308); x.lineTo(96, -312); x.closePath();
    thatchFill(x, dk, 90, 350, -450, -300);
    x.strokeStyle = out; x.lineWidth = 2.5; x.stroke();
    // smoke hole + chimney pipe
    x.fillStyle = hcol('#3a2418', dk); x.fillRect(HA.chim[0] - 10, HA.chim[1] - 8, 20, 30);
    // main roof (hip, nipa thatch) with eave thickness
    x.beginPath(); x.moveTo(-268, -548); x.lineTo(78, -548); x.quadraticCurveTo(140, -460, 172, -372); x.lineTo(172, -352); x.quadraticCurveTo(-90, -344, -356, -352); x.lineTo(-356, -372); x.quadraticCurveTo(-318, -460, -268, -548); x.closePath();
    thatchFill(x, dk, -360, 176, -552, -340);
    x.strokeStyle = out; x.lineWidth = 3; x.stroke();
    x.fillStyle = rgba(hcol('#3a2210', dk), 0.75); x.beginPath(); x.moveTo(-356, -366); x.quadraticCurveTo(-90, -358, 172, -366); x.lineTo(172, -352); x.quadraticCurveTo(-90, -344, -356, -352); x.closePath(); x.fill();
    x.strokeStyle = hcol(GOLD.woodD, dk); x.lineWidth = 8; x.beginPath(); x.moveTo(-272, -548); x.lineTo(82, -548); x.stroke(); // ridge
    // rim light on the sun side (right) + ridge
    x.strokeStyle = rim; x.lineWidth = 4;
    x.beginPath(); x.moveTo(82, -548); x.quadraticCurveTo(142, -460, 172, -370); x.stroke();
    x.beginPath(); x.moveTo(-268, -550); x.lineTo(80, -550); x.stroke();
    x.beginPath(); x.moveTo(122, -448); x.lineTo(346, -324); x.stroke();
    x.lineWidth = 3; x.beginPath(); x.moveTo(310, -330); x.lineTo(310, -140); x.stroke();
    // string-light wire under the eave
    x.strokeStyle = 'rgba(30,20,20,0.8)'; x.lineWidth = 1.6; x.beginPath();
    for (let i = 0; i <= 10; i++) { const u = i / 10, xx = lerp(-340, 160, u), yy = -338 + Math.sin(pmod(u * 5, 1) * PI) * 14; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); }
    x.stroke();
    // deck (planks, top surface + front face)
    x.fillStyle = lgr(x, 0, HA.deckBack, 0, HA.deckFront, [[0, hcol('#5a3a24', dk)], [1, hcol('#9a6a44', dk)]]);
    x.beginPath(); x.moveTo(-318, HA.deckBack); x.lineTo(118, HA.deckBack); x.lineTo(132, HA.deckFront); x.lineTo(-336, HA.deckFront); x.closePath(); x.fill();
    x.strokeStyle = rgba(hcol('#2a160c', dk), 0.5); x.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { const u = i / 6, yy = lerp(HA.deckBack, HA.deckFront, u); x.beginPath(); x.moveTo(lerp(-318, -336, u), yy); x.lineTo(lerp(118, 132, u), yy); x.stroke(); }
    x.fillStyle = hcol(GOLD.woodD, dk); x.fillRect(-336, HA.deckFront, 468, 18);
    x.strokeStyle = rim; x.lineWidth = 2.5; x.beginPath(); x.moveTo(-336, HA.deckFront); x.lineTo(132, HA.deckFront); x.stroke();
    // kitchen floor/bottom beam
    x.fillStyle = hcol(GOLD.woodD, dk); x.fillRect(108, -142, 206, 14);
    // left bamboo railing on the deck end + clay pots
    x.strokeStyle = hcol(GOLD.bambooD, dk); x.lineWidth = 6;
    x.beginPath(); x.moveTo(-326, HA.deckFront); x.lineTo(-322, -205); x.moveTo(-300, HA.deckBack); x.lineTo(-300, -222); x.moveTo(-332, -205); x.lineTo(-296, -222); x.stroke();
    for (const [px, ps] of [[-282, 1], [-256, 0.75]]) {
      x.fillStyle = lgr(x, px - 14 * ps, 0, px + 14 * ps, 0, [[0, hcol(GOLD.clayD, dk)], [0.5, hcol(GOLD.clay, dk)], [1, hcol(GOLD.clayL, dk)]]);
      ell(x, px, HA.deckBack - 12 * ps, 15 * ps, 16 * ps); x.fill();
      x.fillStyle = hcol(GOLD.leaf, dk); for (let k = -2; k <= 2; k++) { ell(x, px + k * 6 * ps, HA.deckBack - 34 * ps - Math.abs(k) * -3, 7 * ps, 12 * ps); x.fill(); }
    }
    // stools (ghế đẩu)
    for (const sx of HA.stools) {
      x.strokeStyle = hcol(GOLD.woodD, dk); x.lineWidth = 4;
      x.beginPath(); x.moveTo(sx - 13, HA.deckY - HA.seatH + 4); x.lineTo(sx - 16, HA.deckY); x.moveTo(sx + 13, HA.deckY - HA.seatH + 4); x.lineTo(sx + 16, HA.deckY); x.stroke();
      x.fillStyle = hcol(GOLD.woodL, dk); rrect(x, sx - 19, HA.deckY - HA.seatH, 38, 6, 2); x.fill();
    }
  } else {
    // front stilts + braces
    for (let px = -326; px <= 120; px += 74) post(x, dk, px, HA.deckFront + 14, 10, 14);
    for (let px = 150; px <= 306; px += 52) post(x, dk, px, -132, 10, 13);
    x.strokeStyle = hcol(GOLD.woodD, dk); x.lineWidth = 5;
    for (let px = -326; px < 100; px += 148) { x.beginPath(); x.moveTo(px, -100); x.lineTo(px + 74, -40); x.moveTo(px + 74, -100); x.lineTo(px, -40); x.stroke(); }
    // low table
    const tx = HA.tableX, tt = HA.tableTop, tw = HA.tableW;
    x.fillStyle = hcol(GOLD.woodD, dk);
    for (const sx of [-1, 1]) x.fillRect(tx + sx * (tw / 2 - 12) - 4, tt + 6, 8, HA.deckY - tt - 4);
    x.fillStyle = lgr(x, 0, tt - 8, 0, tt + 10, [[0, hcol('#b07a4c', dk)], [1, hcol(GOLD.wood, dk)]]);
    rrect(x, tx - tw / 2, tt - 6, tw, 14, 3); x.fill();
    x.strokeStyle = rim; x.lineWidth = 2; x.beginPath(); x.moveTo(tx - tw / 2 + 3, tt - 6); x.lineTo(tx + tw / 2 - 3, tt - 6); x.stroke();
    // ladder
    const [a, b, c2, e] = HA.ladder;
    x.strokeStyle = hcol(GOLD.woodL, dk); x.lineWidth = 6;
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(c2[0], c2[1]); x.moveTo(b[0], b[1]); x.lineTo(e[0], e[1]); x.stroke();
    x.lineWidth = 4; for (let i = 1; i < 6; i++) { const u = i / 6; x.beginPath(); x.moveTo(lerp(a[0], c2[0], u), lerp(a[1], c2[1], u)); x.lineTo(lerp(b[0], e[0], u), lerp(b[1], e[1], u)); x.stroke(); }
    // mooring post + rope
    post(x, dk, HA.moor[0], -64, 12, 12, '#5a3a24');
    x.strokeStyle = hcol('#c8b080', dk); x.lineWidth = 3; x.beginPath(); x.ellipse(HA.moor[0], HA.moor[1], 10, 4, 0, 0, TAU); x.stroke();
  }
}
function houseSprite(dk, part) {
  const key = dk + part; if (_house[key]) return _house[key];
  const [c, x] = canvas(HW * HQ, HH * HQ);
  x.scale(HQ, HQ); x.translate(HOX, HOY);
  drawHouse(x, dk, part);
  return (_house[key] = c);
}
function houseSmoke(ctx, t, px, py, k, seed) {
  const r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const ph = r(), life = pmod(t * 0.22 + ph, 1), rad = 10 + life * 60;
    const xx = px - life * 120 + Math.sin(t * 0.9 + i * 1.7) * 14 * life, yy = py - life * 230;
    ctx.globalAlpha = k * Math.sin(life * PI) * 0.55;
    ctx.fillStyle = rgr(ctx, xx, yy, 0, xx, yy, rad, [[0, 'rgba(225,190,180,0.9)'], [1, 'rgba(180,140,160,0)']]);
    ctx.beginPath(); ctx.arc(xx, yy, rad, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function stiltHouse(ctx, x, y, s = 1, o = {}) {
  const d = clamp(o.dusk || 0), t = o.t || 0, part = o.part || 'all', lights = clamp(o.lights ?? (d > 0.55 ? (d - 0.55) / 0.25 : 0));
  const fire = clamp(o.glow ?? 1), fl = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const blit = (prt, flipY) => {
    const [h0, hr] = mipFor(ctx, houseSprite(0, prt), HW);
    if (hr > 1) { ctx.drawImage(blendOf(h0, mipFor(ctx, houseSprite(1, prt), HW)[0], d, 'house' + prt), -HOX, -HOY, HW, HH); return; }
    for (const dk of [0, 1]) {
      const a = dk ? d : 1; if (a < 0.02) continue;
      ctx.globalAlpha = a * (flipY ? 1 : 1);
      ctx.drawImage(mipFor(ctx, houseSprite(dk, prt), HW)[0], -HOX, -HOY, HW, HH);
    }
    ctx.globalAlpha = 1;
  };
  if (part !== 'front') {
    if (o.reflect !== false) { // wobbly reflection in the water
      ctx.save(); ctx.beginPath(); ctx.rect(-HOX, 0, HW, 420); ctx.clip();
      const sp0 = halfOf(houseSprite(1, 'back')), sp1 = halfOf(houseSprite(1, 'front')), HQm = HQ / 2; // reflection: half-res is plenty
      for (let i = 0; i < 14; i++) {
        const y0 = i * 30, dx = Math.sin(t * 2.2 + i * 0.9) * (2 + i * 0.6);
        ctx.globalAlpha = 0.42 * (1 - i / 14);
        for (const sp of [sp0, sp1]) ctx.drawImage(sp, 0, (HOY - y0 - 30) * HQm, HW * HQm, 30 * HQm, -HOX + dx, y0, HW, 30);
      }
      ctx.restore(); ctx.globalAlpha = 1;
      // reflection of lit windows
      if (fire > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(HA.win[0], -HA.win[1] * 0.98); ctx.scale(1, 2.6); glow(ctx, 0, 0, 40, 'rgba(255,130,50,0.8)', fire * fl * 0.6); ctx.restore(); }
    }
    blit('back');
    // warm doorway + kitchen-window fire
    const dg = clamp(o.door ?? 1) * (0.35 + lights * 0.65);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgr(ctx, HA.door[0], HA.deckBack - 10, 4, HA.door[0], HA.door[0] ? -260 : -260, 160, [[0, `rgba(255,170,80,${0.85 * dg})`], [1, 'rgba(120,40,20,0)']]);
    ctx.fillRect(HA.door[0] - 42, -318, 84, 318 + HA.deckBack);
    if (fire > 0) {
      ctx.fillStyle = rgr(ctx, HA.win[0], HA.win[1] + 34, 2, HA.win[0], HA.win[1] + 20, 80, [[0, `rgba(255,220,120,${fire * fl})`], [0.5, `rgba(255,110,40,${0.8 * fire * fl})`], [1, 'rgba(90,20,10,0.2)']]);
      ctx.fillRect(HA.win[0] - 39, HA.win[1] - 31, 78, 62);
      glow(ctx, HA.win[0], HA.win[1], 130, 'rgba(255,120,50,0.7)', fire * fl * (0.4 + d * 0.5));
    }
    // string lights
    if (lights > 0) {
      for (let i = 0; i < 11; i++) {
        const u = (i + 0.5) / 11, bx = lerp(-340, 160, u), by = -338 + Math.sin(pmod(u * 5, 1) * PI) * 14 + 6;
        const tw = lights * (0.85 + 0.15 * Math.sin(t * 5 + i * 2.1));
        glow(ctx, bx, by, 36, 'rgba(255,190,90,0.9)', tw * 0.8);
        ctx.globalAlpha = tw; ctx.fillStyle = GOLD.bulb; ctx.beginPath(); ctx.arc(bx, by, 4.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
      glow(ctx, -100, HA.deckY - 40, 300, 'rgba(255,150,70,0.5)', lights * 0.55);
    }
    ctx.restore();
    if (o.smoke !== false) { ctx.save(); houseSmoke(ctx, t, HA.chim[0], HA.chim[1] - 10, 1, 3); houseSmoke(ctx, t + 1.7, HA.win[0] - 20, HA.win[1] - 40, 0.55, 8); ctx.restore(); }
  }
  if (part !== 'back') {
    blit('front');
    if (o.ripples !== false) {
      ctx.save(); ctx.strokeStyle = rgba(mixc('#ffd0a0', '#c87a8a', d), 0.55); ctx.lineWidth = 2;
      for (let px = -326; px <= 306; px += 74) { const w2 = 16 + Math.sin(t * 3 + px) * 3; ctx.beginPath(); ctx.ellipse(px, 9, w2, 3.5, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
  }
  ctx.restore();
  const m = (ux, uy) => [x + ux * s, y + uy * s];
  return {
    deck: m(-100, HA.deckY), deckL: m(-320, HA.deckY), deckR: m(110, HA.deckY), table: m(HA.tableX, HA.tableTop - 6), tableW: HA.tableW * s,
    stools: HA.stools.map(sx => m(sx, HA.deckY)), seat: HA.stools.map(sx => m(sx, HA.deckY - HA.seatH)),
    window: m(HA.win[0], HA.win[1]), door: m(HA.door[0], -250), ladderTop: m(91, HA.deckFront), ladderFoot: m(107, 6),
    mooring: m(HA.moor[0], HA.moor[1]), chimney: m(HA.chim[0], HA.chim[1]), personS: 0.3 * s,
  };
}

// ------------------------------------------------------------------ RIVERSIDE SCENE
const _pal = {};
function bigPalm(v, dk) { // high-res coconut palm silhouette with rim light (sun side = right)
  const key = v + ':' + dk; if (_pal[key]) return _pal[key];
  const S = 2, [c, x] = canvas(300 * S, 760 * S), r = rng(900 + v * 37);
  x.scale(S, S); x.translate(150, 750);
  const col = dk ? '#1c1428' : GOLD.silD, rim = dk ? 'rgba(255,120,100,0.7)' : 'rgba(255,190,100,0.95)';
  const hgt = 560 + r() * 160, lean = (r() - 0.5) * 0.4, top = [Math.sin(lean) * hgt * 0.5, -hgt];
  const trunk = (stroke, w) => { x.strokeStyle = stroke; x.lineWidth = w; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(top[0] * 0.15 - lean * 60, -hgt * 0.55, top[0], top[1]); x.stroke(); };
  x.lineCap = 'round'; trunk(col, 13);
  x.save(); x.translate(3.5, 0); trunk(rim, 2.5); x.restore(); trunk(col, 9);
  const nf = 11 + Math.floor(r() * 3);
  for (let i = 0; i < nf; i++) {
    const a = -PI / 2 + (i / (nf - 1) - 0.5) * 3.9 + (r() - 0.5) * 0.25, len = 120 + r() * 70;
    const ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len * 0.6 + len * 0.42;
    const cx1 = top[0] + Math.cos(a) * len * 0.55, cy1 = top[1] + Math.sin(a) * len * 0.5 - 24;
    x.fillStyle = col; x.beginPath(); x.moveTo(top[0], top[1] - 3); x.quadraticCurveTo(cx1, cy1 - 8, ex, ey); x.quadraticCurveTo(cx1, cy1 + 9, top[0], top[1] + 4); x.fill();
    x.strokeStyle = col; x.lineWidth = 2.4;
    for (let j = 2; j < 14; j++) { const u = j / 14, px = lerp(top[0], ex, u), py = lerp(top[1], ey, u) - Math.sin(u * PI) * 18, lf = 22 * (1 - u * 0.5); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a + 1.5) * lf, py + lf * 0.9); x.moveTo(px, py); x.lineTo(px + Math.cos(a - 1.5) * lf, py + lf * 0.9); x.stroke(); }
    if (Math.cos(a) > 0.2) { x.strokeStyle = rim; x.lineWidth = 1.8; x.beginPath(); x.moveTo(top[0], top[1] - 3); x.quadraticCurveTo(cx1, cy1 - 8, ex, ey); x.stroke(); }
  }
  x.fillStyle = col; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(top[0] + (r() - 0.5) * 22, top[1] + 10 + r() * 10, 8, 0, TAU); x.fill(); }
  _pal[key] = { c, w: 300, h: 760, ox: 150, oy: 750, top };
  return _pal[key];
}
const _strips = {};
function bankStrip(kind, dk) { // tileable 2048 strip: 'far' (hazy) / 'mid' (nipa + bushes) / 'plain' (delta fields)
  const key = kind + dk; if (_strips[key]) return _strips[key];
  const hgt = kind === 'plain' ? 200 : 260, [c, x] = canvas(2048, hgt), r = rng(kind === 'far' ? 61 : 62);
  const col = kind === 'far' ? (dk ? '#3a2c56' : '#8a5a86') : kind === 'mid' ? (dk ? '#1e1630' : GOLD.sil) : (dk ? '#2a2246' : '#6a4a6e');
  if (kind === 'plain') {
    for (let i = 0; i < 9; i++) { const yy = i * 22; x.fillStyle = mixc(col, dk ? '#3a2e5a' : '#9a6a7a', (i % 2) * 0.35); x.fillRect(0, yy, 2048, 23); }
    for (let i = 0; i < 70; i++) { const bx = r() * 2048, by = r() * hgt, br = 6 + r() * 16; x.fillStyle = dk ? '#1c1630' : '#4a3456'; for (const dx of [0, -2048, 2048]) { x.beginPath(); x.arc(bx + dx, by, br, 0, TAU); x.fill(); } }
  } else {
    const base = kind === 'far' ? 0.7 : 0.62;
    x.fillStyle = col; x.fillRect(0, hgt * base, 2048, hgt);
    for (let i = 0; i < (kind === 'far' ? 140 : 90); i++) { const bx = r() * 2048, br = 14 + r() * 34, by = hgt * base + 6 - r() * 26; for (const dx of [0, -2048, 2048]) { x.beginPath(); x.arc(bx + dx, by, br, 0, TAU); x.fill(); } }
    for (let i = 0; i < (kind === 'far' ? 30 : 22); i++) {
      const bx = r() * 2048, sc = kind === 'far' ? 0.3 + r() * 0.2 : 0.45 + r() * 0.3;
      for (const dx of [0, -2048, 2048]) x.drawImage(NP.palmSprite(Math.floor(r() * 6), col, kind === 'mid' ? (dk ? 'rgba(255,120,100,0.6)' : 'rgba(255,180,100,0.85)') : null), bx + dx - 130 * sc, hgt * base + 10 - 410 * sc, 260 * sc, 420 * sc);
    }
    if (kind === 'mid') { // nipa fronds at the waterline
      x.strokeStyle = col; x.lineCap = 'round';
      for (let i = 0; i < 80; i++) { const bx = r() * 2048, hh = 40 + r() * 60, lean = (r() - 0.5) * 70; x.lineWidth = 5 + r() * 4; x.beginPath(); x.moveTo(bx, hgt); x.quadraticCurveTo(bx + lean * 0.3, hgt - hh * 0.6, bx + lean, hgt - hh); x.stroke(); }
    }
  }
  _strips[key] = { c, h: hgt };
  return _strips[key];
}
function tileStrip(ctx, sp, y, h, off, x0, w) {
  const sw = 2048 * (h / sp.h), o = pmod(off, sw);
  for (let k = -1; x0 + k * sw - o < x0 + w + sw; k++) ctx.drawImage(sp.c, x0 + k * sw - o, y, sw, h);
}
function stripPair(ctx, kind, d, y, h, off, x0, w) {
  for (const dk of [0, 1]) { const a = dk ? d : 1; if (a < 0.02) continue; ctx.globalAlpha = a; tileStrip(ctx, bankStrip(kind, dk), y, h, off, x0, w); }
  ctx.globalAlpha = 1;
}
function gardenBank(ctx, x, y, s, d, t) { // styrofoam boxes, basins and clay pots along the bank edge (silhouette-ish, rim lit)
  const r = rng(77);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const items = [[-200, 'box'], [-120, 'pot'], [-60, 'box'], [20, 'basin'], [90, 'box'], [150, 'pot']];
  for (const [bx, kind] of items) {
    const lit = mixc(kind === 'box' ? '#e8dccb' : kind === 'basin' ? '#4a7aa8' : GOLD.clay, '#3a2e50', 0.35 + d * 0.5);
    ctx.fillStyle = mixc(GOLD.leaf, '#1e2a30', 0.35 + d * 0.5);
    for (let k = 0; k < 6; k++) { ell(ctx, bx + (r() - 0.5) * 50, -34 - r() * 20 + Math.sin(t * 1.5 + k) * 1.5, 10 + r() * 8, 12 + r() * 6); ctx.fill(); }
    ctx.fillStyle = lit;
    if (kind === 'box') ctx.fillRect(bx - 30, -36, 60, 34);
    else if (kind === 'basin') { ctx.beginPath(); ctx.moveTo(bx - 34, -30); ctx.lineTo(bx + 34, -30); ctx.lineTo(bx + 26, -2); ctx.lineTo(bx - 26, -2); ctx.closePath(); ctx.fill(); }
    else { ell(ctx, bx, -18, 20, 18); ctx.fill(); }
    ctx.fillStyle = rgba(d > 0.5 ? '#ff8a70' : '#ffd090', 0.6); ctx.fillRect(bx + (kind === 'pot' ? 12 : 22), -34, 5, 30);
  }
  ctx.restore();
}
function riversideScene(ctx, t, o = {}) {
  const d = clamp(o.dusk || 0), panX = o.panX || 0, high = clamp(o.high || 0), hy = o.horizon ?? 1000;
  const cm = Object.assign({ zoom: 1, cx: W / 2, cy: H / 2 }, o.cam || {});
  const z = cm.zoom;
  // visible world rect
  const vx0 = cm.cx - W / 2 / z - 4, vx1 = cm.cx + W / 2 / z + 4, vy0 = cm.cy - H / 2 / z - 4, vy1 = cm.cy + H / 2 / z + 4;
  const camXY = (p) => [W / 2 + (p[0] - cm.cx) * z, H / 2 + (p[1] - cm.cy) * z];
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cm.cx, -cm.cy);
  const treeK = 1 - 0.6 * high, trueHz = hy - 300 * treeK - high * 420;
  const sun = o.sun || [700, trueHz + (hy - trueHz) * (high > 0 ? 0.25 : 0) + 30 + d * 280];
  const sS = o.sunS ?? 1.25;
  // sky down to the true horizon
  sunsetSky(ctx, Math.min(vy0, 0), high > 0 ? trueHz + 60 : hy - 40, { t, sun, sunS: sS, dusk: d, clouds: o.clouds ?? 7, seed: o.seed ?? 5, panX: panX * 0.3, x0: vx0, w: vx1 - vx0 });
  // delta plain when high
  if (high > 0.02) {
    stripPair(ctx, 'plain', d, trueHz, hy - trueHz + 20, panX * 0.15, vx0, vx1 - vx0);
    // a shining canal ribbon reflecting the sun across the plain
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(mixc('#ffc080', '#e0707a', d), 0.75 * high); ctx.lineWidth = 6 + 14 * high;
    ctx.beginPath(); ctx.moveTo(sun[0] - 40, trueHz + 4);
    ctx.bezierCurveTo(sun[0] + 160, trueHz + (hy - trueHz) * 0.3, sun[0] - 300, trueHz + (hy - trueHz) * 0.6, sun[0] - 80, hy); ctx.stroke(); ctx.restore();
    // haze at the true horizon
    ctx.fillStyle = lgr(ctx, 0, trueHz - 30, 0, trueHz + 90, [[0, 'rgba(255,170,130,0)'], [0.5, rgba(mixc('#ffb090', '#a05a80', d), 0.55)], [1, 'rgba(255,170,130,0)']]);
    ctx.fillRect(vx0, trueHz - 30, vx1 - vx0, 120);
  }
  // bank tree layers (far haze, mid with palms) above the shoreline
  const fh = 260 * treeK;
  stripPair(ctx, 'far', d, hy - fh * 1.25, fh * 1.25, panX * 0.25, vx0, vx1 - vx0);
  ctx.fillStyle = lgr(ctx, 0, hy - fh, 0, hy, [[0, 'rgba(255,170,120,0)'], [1, rgba(mixc('#ffb080', '#b05a70', d), 0.35)]]); ctx.fillRect(vx0, hy - fh, vx1 - vx0, fh);
  stripPair(ctx, 'mid', d, hy - fh, fh + 4, panX * 0.45, vx0, vx1 - vx0);
  // water
  sunsetWater(ctx, hy, Math.max(vy1, H), t, { sunX: sun[0], dusk: d, panX, glitter: o.glitter ?? 190, x0: vx0, w: vx1 - vx0 });
  // big palms on the bank (behind the house)
  const house = o.house === null ? null : Object.assign({ x: 600, y: hy + 170, s: 0.9 }, o.house || {});
  if (o.palms !== false) {
    const P = o.palmSpots || [[-60, 1.0, 0], [180, 0.85, 1], [390, 1.1, 2], [870, 0.95, 3], [1040, 0.8, 4], [1230, 1.05, 5]];
    for (const [px, ps, v] of P) {
      const xx = px - panX * 0.6, sc = ps * treeK * 0.95;
      const sp = bigPalm(v, 0), sp1 = bigPalm(v, 1);
      const m0 = mipFor(ctx, sp.c, sp.w * sc)[0], m1 = mipFor(ctx, sp1.c, sp.w * sc)[0];
      ctx.drawImage(blendOf(m0, m1, d, 'palm' + v), xx - sp.ox * sc + Math.sin(t * 0.7 + v) * 3, hy + 8 - sp.oy * sc, sp.w * sc, sp.h * sc);
    }
    ctx.globalAlpha = 1;
  }
  // bank edge + mud + garden
  ctx.fillStyle = mixc('#3a2a3c', '#140e1e', d); ctx.beginPath(); ctx.moveTo(vx0, hy - 8);
  for (let xx = vx0; xx <= vx1 + 40; xx += 40) ctx.lineTo(xx, hy - 6 - Math.sin(xx * 0.013 + panX * 0.006) * 5);
  ctx.lineTo(vx1, hy + 8); ctx.lineTo(vx0, hy + 8); ctx.closePath(); ctx.fill();
  if (o.garden !== false && house) gardenBank(ctx, house.x - 360 * house.s - panX * 0.0, hy - 2, 0.75 * house.s / 0.9 * treeK, d, t);
  let hret = null;
  if (house) {
    const hp = o.housePart || 'all', lights = o.lights;
    if (hp === 'front') hret = stiltHouse(ctx, house.x, house.y, house.s, { t, dusk: d, part: 'front', lights });
    else {
      hret = stiltHouse(ctx, house.x, house.y, house.s, { t, dusk: d, part: 'back', lights, smoke: o.smoke });
      if (o.mid) { ctx.save(); o.mid(ctx); ctx.restore(); }
      if (hp === 'all') stiltHouse(ctx, house.x, house.y, house.s, { t, dusk: d, part: 'front', lights });
    }
  } else if (o.mid) { ctx.save(); o.mid(ctx); ctx.restore(); }
  ctx.restore();
  if ((o.flare ?? 0.5) > 0 && sun[1] < hy) L.flare(ctx, camXY(sun)[0], camXY(sun)[1], 0.8, (o.flare ?? 0.5) * (1 - d * 0.7));
  if (hret && z !== 1) for (const k in hret) { const v = hret[k]; if (Array.isArray(v) && typeof v[0] === 'number') hret[k] = camXY(v); else if (Array.isArray(v)) hret[k] = v.map(camXY); }
  return { horizon: hy, sun: camXY(sun), house: hret, camXY };
}

// ------------------------------------------------------------------ KITCHEN INTERIOR (world 1080×1920, 'stove' view = zoom)
const KV = { wide: { z: 1, cx: 540, cy: 960 }, stove: { z: 1.6, cx: 540, cy: 1010 + (960 - 1150) / 1.6 } };
const KP = { pans: [[380, 1004], [705, 1004]], pr: [140, 46], mouths: [[380, 1340], [705, 1340]], win: { x: 640, y: 330, w: 330, h: 330 }, stoveTop: [540, 1010] };
const _kit = {};
function drawKitchen(x) {
  x.lineJoin = 'round'; x.lineCap = 'round';
  // back wall: dark bamboo slats with light leaks
  x.fillStyle = '#1c100a'; x.fillRect(-200, -200, 1480, 1700);
  const r = rng(5);
  for (let xx = -200, i = 0; xx < 1300; xx += 34, i++) {
    x.fillStyle = i % 2 ? '#3a2416' : '#33200f'; x.fillRect(xx, -200, 30, 1680);
    x.fillStyle = 'rgba(255,170,90,' + (0.18 + r() * 0.3).toFixed(2) + ')'; x.fillRect(xx + 30, -200, 2 + r() * 2, 1680);
  }
  for (const yy of [120, 760, 1150]) { x.fillStyle = '#24140c'; x.fillRect(-200, yy, 1480, 22); x.fillStyle = 'rgba(255,170,90,0.15)'; x.fillRect(-200, yy, 1480, 3); }
  // window hole (transparent, sky drawn underneath)
  const w = KP.win;
  x.save(); x.globalCompositeOperation = 'destination-out'; x.fillRect(w.x, w.y, w.w, w.h); x.restore();
  x.fillStyle = '#4a2e1c'; for (const [a, b, c, e] of [[w.x - 18, w.y - 18, w.w + 36, 20], [w.x - 18, w.y + w.h, w.w + 36, 22], [w.x - 18, w.y, 18, w.h], [w.x + w.w, w.y, 18, w.h]]) x.fillRect(a, b, c, e);
  x.fillStyle = '#3a2214'; for (let i = 1; i < 4; i++) x.fillRect(w.x + i * w.w / 4 - 5, w.y, 10, w.h);
  x.strokeStyle = 'rgba(255,190,110,0.8)'; x.lineWidth = 3; x.beginPath(); x.moveTo(w.x - 18, w.y + w.h + 1); x.lineTo(w.x + w.w + 18, w.y + w.h + 1); x.stroke();
  // shelf with jars + bottles (left)
  x.fillStyle = '#4a2c18'; x.fillRect(40, 700, 380, 18);
  x.strokeStyle = '#2a180c'; x.lineWidth = 6; x.beginPath(); x.moveTo(70, 718); x.lineTo(100, 780); x.moveTo(390, 718); x.lineTo(360, 780); x.stroke();
  const jars = [[80, 60, 70, '#8a4a2a'], [150, 40, 90, '#3a5a3a'], [200, 46, 56, '#c08a50'], [262, 30, 100, '#5a3a2a'], [310, 54, 64, '#9a5a3a'], [372, 36, 80, '#2a3a4a']];
  for (const [jx, jw, jh, c] of jars) {
    x.fillStyle = lgr(x, jx - jw / 2, 0, jx + jw / 2, 0, [[0, NP.shadeC(c, -0.5)], [0.6, c], [1, NP.shadeC(c, 0.3)]]);
    rrect(x, jx - jw / 2, 700 - jh, jw, jh, jw * 0.3); x.fill();
    x.fillStyle = 'rgba(255,200,130,0.5)'; x.fillRect(jx + jw / 2 - 7, 700 - jh + 10, 3, jh - 20);
  }
  // hanging rail with ladles + spatulas
  x.strokeStyle = '#2a180c'; x.lineWidth = 8; x.beginPath(); x.moveTo(380, 300); x.lineTo(600, 300); x.stroke();
  for (let i = 0; i < 4; i++) {
    const lx = 410 + i * 55, len = 150 + (i % 2) * 40;
    x.strokeStyle = '#6a4428'; x.lineWidth = 7; x.beginPath(); x.moveTo(lx, 300); x.lineTo(lx, 300 + len); x.stroke();
    x.fillStyle = i % 2 ? '#6a4428' : '#3a3434'; if (i % 2) { rrect(x, lx - 14, 300 + len, 28, 46, 6); x.fill(); } else { ell(x, lx, 300 + len + 14, 22, 16); x.fill(); }
    x.strokeStyle = 'rgba(255,180,110,0.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(lx + 3, 304); x.lineTo(lx + 3, 300 + len); x.stroke();
  }
  // woven baskets (rổ / nia) on the wall
  for (const [bx, by, br] of [[150, 330, 120], [300, 520, 80], [930, 860, 95]]) {
    x.fillStyle = rgr(x, bx - br * 0.3, by - br * 0.3, 0, bx, by, br, [[0, '#a07a44'], [1, '#5a3a1e']]); ell(x, bx, by, br, br); x.fill();
    x.strokeStyle = 'rgba(40,24,10,0.6)'; x.lineWidth = 2;
    for (let k = 1; k < 7; k++) { ell(x, bx, by, br * k / 7, br * k / 7); x.stroke(); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + Math.cos(a) * br, by + Math.sin(a) * br); x.stroke(); }
    x.strokeStyle = '#3a2410'; x.lineWidth = 6; ell(x, bx, by, br, br); x.stroke();
    x.strokeStyle = 'rgba(255,190,110,0.55)'; x.lineWidth = 3; x.beginPath(); x.arc(bx, by, br - 2, -0.9, 0.5); x.stroke();
  }
  // garlic braid + chili bunch
  x.strokeStyle = '#8a7048'; x.lineWidth = 5; x.beginPath(); x.moveTo(610, 230); x.lineTo(612, 520); x.stroke();
  for (let i = 0; i < 9; i++) { const gy = 260 + i * 30, gx = 612 + (i % 2 ? 14 : -14); x.fillStyle = lgr(x, gx - 16, 0, gx + 16, 0, [[0, '#9a8a74'], [0.6, '#e8dcc6'], [1, '#fff4e0']]); ell(x, gx, gy, 17, 19); x.fill(); x.strokeStyle = 'rgba(120,90,60,0.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(gx, gy - 18); x.lineTo(gx, gy + 18); x.stroke(); }
  x.strokeStyle = '#5a6a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(1000, 250); x.lineTo(1000, 330); x.stroke();
  for (let i = 0; i < 10; i++) { const a = 1.1 + i * 0.1; x.strokeStyle = '#b8201a'; x.lineWidth = 9; x.beginPath(); x.moveTo(1000, 330); x.lineTo(1000 + Math.cos(a) * 70 - 30, 330 + Math.sin(a) * 70); x.stroke(); }
  // floor
  x.fillStyle = lgr(x, 0, 1380, 0, 1920, [[0, '#2a180e'], [1, '#0e0806']]); x.fillRect(-200, 1380, 1480, 700);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(-200, 1380, 1480, 10);
  // clay stove: top slab (perspective) + front face + fire mouths
  x.fillStyle = lgr(x, 0, 935, 0, 1070, [[0, '#7a3e24'], [1, '#c87a4e']]);
  x.beginPath(); x.moveTo(190, 940); x.lineTo(890, 940); x.lineTo(940, 1070); x.lineTo(140, 1070); x.closePath(); x.fill();
  x.fillStyle = lgr(x, 140, 0, 940, 0, [[0, '#6a301a'], [0.35, GOLD.clay], [0.8, '#b8683e'], [1, '#7a3a20']]);
  rrect(x, 140, 1066, 800, 360, 24); x.fill();
  x.strokeStyle = 'rgba(50,20,10,0.45)'; x.lineWidth = 3;
  for (let i = 0; i < 14; i++) { const cx = 170 + r() * 740, cy = 1100 + r() * 300; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + (r() - 0.5) * 40, cy + 10 + r() * 20); x.stroke(); }
  x.strokeStyle = 'rgba(255,190,120,0.55)'; x.lineWidth = 4; x.beginPath(); x.moveTo(140, 1070); x.lineTo(940, 1070); x.stroke();
  for (const [mx, my] of KP.mouths) {
    x.fillStyle = '#100604'; x.beginPath(); x.moveTo(mx - 95, my + 80); x.lineTo(mx - 95, my - 30); x.quadraticCurveTo(mx, my - 150, mx + 95, my - 30); x.lineTo(mx + 95, my + 80); x.closePath(); x.fill();
    x.strokeStyle = '#4a1e10'; x.lineWidth = 10; x.stroke();
  }
  // pan burners (dark rings on the top) — pans drawn per frame
  for (const [px, py] of KP.pans) { x.fillStyle = '#2a120a'; ell(x, px, py + 14, KP.pr[0] + 16, KP.pr[1] + 12); x.fill(); }
}
function kitchenSprite(view) {
  if (_kit[view]) return _kit[view];
  const [c, x] = canvas(W, H), v = KV[view];
  x.translate(W / 2, H / 2); x.scale(v.z, v.z); x.translate(-v.cx, -v.cy);
  drawKitchen(x);
  return (_kit[view] = c);
}
function castPan(ctx, px, py, rx, ry, t, fire) {
  // fire licking around the pan bottom
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 9; i++) {
    const u = i / 8 - 0.5, fx = px + u * rx * 2.1, h = (18 + 22 * Math.abs(Math.sin(t * 9 + i * 1.9))) * fire;
    ctx.fillStyle = rgr(ctx, fx, py + ry * 0.9, 0, fx, py + ry * 0.9, h * 1.6, [[0, 'rgba(255,220,120,0.9)'], [0.5, 'rgba(255,110,30,0.6)'], [1, 'rgba(200,40,10,0)']]);
    ctx.beginPath(); ctx.ellipse(fx, py + ry * 0.9 - h * 0.3, h * 0.6, h, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // outer body + rim + inner surface
  ctx.fillStyle = lgr(ctx, px - rx, 0, px + rx, 0, [[0, '#120e0e'], [0.5, GOLD.iron], [1, '#3a3230']]);
  ctx.beginPath(); ctx.ellipse(px, py + ry * 0.35, rx * 1.06, ry * 1.25, 0, 0, PI); ctx.lineTo(px - rx * 1.06, py); ctx.ellipse(px, py, rx * 1.06, ry * 1.06, 0, PI, TAU); ctx.fill();
  // handles (short ear handles)
  ctx.fillStyle = GOLD.iron; for (const sx of [-1, 1]) { rrect(ctx, px + sx * rx * 1.04 - (sx < 0 ? 30 * rx / 140 : 0), py - 8 * ry / 46, 30 * rx / 140, 14 * ry / 46, 4); ctx.fill(); }
  ctx.fillStyle = rgr(ctx, px - rx * 0.2, py - ry * 0.3, 0, px, py, rx, [[0, '#4a4240'], [0.7, '#262020'], [1, '#121010']]);
  ctx.beginPath(); ctx.ellipse(px, py, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,100,0.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(px, py, rx * 1.03, ry * 1.03, 0, PI * 1.05, PI * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,140,70,0.55)'; ctx.beginPath(); ctx.ellipse(px, py, rx * 1.05, ry * 1.08, 0, 0.1, PI - 0.1); ctx.stroke();
}
function kitchenInterior(ctx, t, o = {}) {
  const view = o.view === 'stove' ? 'stove' : 'wide', v = KV[view], d = clamp(o.dusk || 0), fire = clamp(o.fire ?? 1);
  const fl = 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 6.3 + 2);
  const tp = (p) => [W / 2 + (p[0] - v.cx) * v.z, H / 2 + (p[1] - v.cy) * v.z];
  ctx.save();
  // outside, seen through the window (under the sprite)
  const w = KP.win, wa = tp([w.x, w.y]), ww = w.w * v.z, wh = w.h * v.z;
  ctx.save(); ctx.beginPath(); ctx.rect(wa[0], wa[1], ww, wh); ctx.clip();
  sunsetSky(ctx, wa[1], wa[1] + wh * 0.62, { t, sun: [wa[0] + ww * 0.62, wa[1] + wh * 0.5 + d * wh * 0.2], sunS: 0.5 * v.z, dusk: d, clouds: 3, seed: 9, x0: wa[0], w: ww });
  sunsetWater(ctx, wa[1] + wh * 0.62, wa[1] + wh, t, { sunX: wa[0] + ww * 0.62, dusk: d, glitter: 40, x0: wa[0], w: ww });
  const sp = bigPalm(1, d > 0.5 ? 1 : 0), ps = 0.5 * v.z; ctx.drawImage(mipFor(ctx, sp.c, sp.w * ps)[0], wa[0] + ww * 0.2 - sp.ox * ps, wa[1] + wh * 0.66 - sp.oy * ps, sp.w * ps, sp.h * ps);
  ctx.restore();
  ctx.drawImage(kitchenSprite(view), 0, 0, W, H);
  // fire in the stove mouths
  for (const m of KP.mouths) {
    const [mx, my] = tp(m), z = v.z;
    glow(ctx, mx, my, 260 * z, 'rgba(255,90,30,0.9)', fire * fl * 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i++) {
      const u = (i / 6 - 0.5), hh = (60 + 50 * Math.abs(Math.sin(t * (7 + i) + i * 2.1))) * z * fire, fx = mx + u * 130 * z + Math.sin(t * 5 + i) * 6 * z;
      ctx.fillStyle = rgr(ctx, fx, my + 50 * z, 0, fx, my + 20 * z, hh, [[0, 'rgba(255,240,170,1)'], [0.35, 'rgba(255,150,40,0.85)'], [1, 'rgba(180,30,10,0)']]);
      ctx.beginPath(); ctx.moveTo(fx - 20 * z, my + 70 * z); ctx.quadraticCurveTo(fx - 26 * z, my, fx + Math.sin(t * 6 + i) * 10 * z, my + 70 * z - hh); ctx.quadraticCurveTo(fx + 26 * z, my, fx + 20 * z, my + 70 * z); ctx.fill();
    }
    ctx.restore();
    // logs poking out
    for (const [dx, a] of [[-40, 0.12], [10, -0.05], [50, 0.2]]) {
      ctx.save(); ctx.translate(mx + dx * z, my + 70 * z); ctx.rotate(a);
      ctx.fillStyle = '#3a2214'; rrect(ctx, -12 * z, -6 * z, 24 * z, 130 * z, 6 * z); ctx.fill();
      ctx.fillStyle = `rgba(255,120,40,${0.8 * fire * fl})`; ctx.fillRect(-12 * z, -6 * z, 24 * z, 10 * z);
      ctx.restore();
    }
  }
  // embers drifting up
  if (fire > 0) {
    const r = rng(12); ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 26; i++) {
      const m = KP.mouths[i % 2], life = pmod(t * (0.3 + r() * 0.3) + r(), 1), ex = m[0] + (r() - 0.5) * 200 + Math.sin(t * 2 + i) * 20 * life, ey = m[1] - 40 - life * 520;
      const [sx, sy] = tp([ex, ey]); ctx.globalAlpha = fire * (1 - life) * 0.9; ctx.fillStyle = r() < 0.5 ? '#ffd070' : '#ff7a30';
      ctx.beginPath(); ctx.arc(sx, sy, (1.5 + r() * 2) * v.z, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // pans
  const pans = KP.pans.map(p => { const [px, py] = tp(p); return { x: px, y: py, rx: KP.pr[0] * v.z, ry: KP.pr[1] * v.z }; });
  for (const p of pans) castPan(ctx, p.x, p.y, p.rx, p.ry, t, fire * fl);
  // warm fire light on the room + dusk darkening
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = rgr(ctx, W / 2, tp([540, 1300])[1], 100, W / 2, tp([540, 1100])[1], 1400, [[0, 'rgba(255,255,255,1)'], [1, `rgba(${(120 - d * 50) | 0},${(80 - d * 40) | 0},${(90 - d * 20) | 0},1)`]]);
  ctx.fillRect(0, 0, W, H); ctx.restore();
  glow(ctx, W / 2, tp([540, 1100])[1], 700 * v.z, 'rgba(255,110,40,0.55)', fire * fl * 0.5);
  // god rays through the window + slats
  const beams = o.beams === false ? 0 : (o.beams === true || o.beams === undefined ? 1 : o.beams);
  if (beams > 0) {
    const bc = [wa[0] + ww * 0.55, wa[1] + wh * 0.45];
    L.godRays(ctx, bc[0], bc[1], 2.05, 0.7, 1500 * v.z, 7, 'rgba(255,170,90,0.55)', beams * (0.55 - d * 0.35), t);
    L.dust(ctx, t, 31, 40, 80, wa[1] + wh * 0.5, 800, 900, '255,200,140', 2.2 * v.z, 0.6 * beams);
  }
  // smoke haze drifting through
  const sm = o.smoke ?? 1;
  if (sm > 0) {
    const r = rng(44);
    for (let i = 0; i < 9; i++) {
      const life = pmod(t * 0.07 + r(), 1), sx = lerp(100, 1000, r()) + Math.sin(t * 0.4 + i) * 60, sy = lerp(1050, 150, life) * 1, rad = (140 + r() * 160) * v.z;
      const [px, py] = tp([sx, sy]);
      ctx.globalAlpha = sm * Math.sin(life * PI) * 0.16; ctx.fillStyle = rgr(ctx, px, py, 0, px, py, rad, [[0, 'rgba(230,170,140,1)'], [1, 'rgba(200,140,120,0)']]);
      ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return { stove: tp(KP.stoveTop), pans, fireY: tp(KP.mouths[0])[1], mouths: KP.mouths.map(tp), window: { x: wa[0], y: wa[1], w: ww, h: wh }, view };
}

// ------------------------------------------------------------------ HERB GARDEN (close, on the bank)
const _plant = {};
function plantSprite(kind) {
  if (_plant[kind]) return _plant[kind];
  const S = 1.5, cw = 420, chh = 420, [c, x] = canvas(cw * S, chh * S), r = rng(kind.length * 97 + 3);
  x.scale(S, S); x.translate(cw / 2, chh - 10); x.lineCap = 'round'; x.lineJoin = 'round';
  const rimS = (fn) => { x.save(); x.strokeStyle = 'rgba(255,215,140,0.85)'; x.lineWidth = 2.5; fn(); x.restore(); };
  if (kind === 'lacach') { // small round glossy leaves on woody twigs
    for (let b = 0; b < 9; b++) {
      const a = -PI / 2 + (b / 8 - 0.5) * 2.2, len = 150 + r() * 120, ex = Math.cos(a) * len, ey = Math.sin(a) * len;
      x.strokeStyle = '#6a4a2a'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(ex * 0.3, ey * 0.6, ex, ey); x.stroke();
      for (let k = 0; k < 9; k++) {
        const u = 0.3 + k / 12, px = ex * u + (r() - 0.5) * 30, py = ey * u - Math.sin(u * PI) * 20 + (r() - 0.5) * 24, lr = 16 + r() * 9, la = r() * TAU;
        x.fillStyle = lgr(x, px - lr, py - lr, px + lr, py + lr, [[0, '#2a5a20'], [0.6, '#3f7e2c'], [1, '#6aae3e']]);
        x.beginPath(); x.ellipse(px, py, lr, lr * 0.8, la, 0, TAU); x.fill();
        x.fillStyle = 'rgba(255,255,240,0.55)'; x.beginPath(); x.ellipse(px + lr * 0.3, py - lr * 0.3, lr * 0.28, lr * 0.14, la, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(30,60,20,0.5)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px - Math.cos(la) * lr * 0.8, py - Math.sin(la) * lr * 0.6); x.lineTo(px + Math.cos(la) * lr * 0.8, py + Math.sin(la) * lr * 0.6); x.stroke();
      }
    }
  } else if (kind === 'caibe') { // big paddle mustard leaves with pale midribs
    for (let b = 0; b < 7; b++) {
      const a = -PI / 2 + (b / 6 - 0.5) * 2.1 + (r() - 0.5) * 0.15, len = 230 + r() * 80;
      x.save(); x.rotate(a + PI / 2);
      x.fillStyle = lgr(x, -60, 0, 60, 0, [[0, '#3f8a30'], [0.5, '#6ab842'], [1, '#9ad86a']]);
      x.beginPath(); x.moveTo(-8, 0); x.bezierCurveTo(-70, -len * 0.4, -86, -len * 0.85, 0, -len); x.bezierCurveTo(86, -len * 0.85, 70, -len * 0.4, 8, 0); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(40,90,30,0.6)'; x.lineWidth = 1.5;
      for (let k = 1; k < 7; k++) { const yy = -len * k / 7.5; x.beginPath(); x.moveTo(0, yy); x.quadraticCurveTo(-34, yy - 18, -58 * Math.sin(k / 7 * PI + 0.3), yy - 30); x.moveTo(0, yy); x.quadraticCurveTo(34, yy - 18, 58 * Math.sin(k / 7 * PI + 0.3), yy - 30); x.stroke(); }
      x.strokeStyle = '#d8f0b8'; x.lineWidth = 7; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -len * 0.92); x.stroke();
      rimS(() => { x.beginPath(); x.moveTo(8, 0); x.bezierCurveTo(70, -len * 0.4, 86, -len * 0.85, 0, -len); x.stroke(); });
      x.restore();
    }
  } else if (kind === 'lettuce') { // frilly rosette
    for (let k = 0; k < 26; k++) {
      const a = r() * TAU, rd = 30 + r() * 110 * (1 - k / 40), px = Math.cos(a) * rd * 0.9, py = -90 + Math.sin(a) * rd * 0.55 - k * 2, lr = 50 + r() * 30;
      x.fillStyle = lgr(x, px, py - lr, px, py + lr, [[0, '#c8f080'], [0.5, '#8ed050'], [1, '#4f9a30']]);
      x.beginPath();
      for (let j = 0; j <= 24; j++) { const aa = j / 24 * TAU, rr = lr * (0.82 + 0.18 * Math.sin(aa * 9 + k)); const qx = px + Math.cos(aa) * rr, qy = py + Math.sin(aa) * rr * 0.7; j ? x.lineTo(qx, qy) : x.moveTo(qx, qy); }
      x.closePath(); x.fill(); x.strokeStyle = 'rgba(60,110,30,0.5)'; x.lineWidth = 1.5; x.stroke();
    }
  } else if (kind === 'hung') { // upright mint/basil stems with paired pointed leaves
    for (let b = 0; b < 11; b++) {
      const bx = (r() - 0.5) * 180, hh = 200 + r() * 120, lean = (r() - 0.5) * 50;
      x.strokeStyle = '#4a7a2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(bx * 0.4, 0); x.quadraticCurveTo(bx, -hh * 0.5, bx + lean, -hh); x.stroke();
      for (let k = 1; k < 7; k++) {
        const u = k / 7, px = lerp(bx * 0.4, bx + lean, u), py = -hh * u, ls = 26 - u * 10;
        for (const sx of [-1, 1]) {
          x.save(); x.translate(px, py); x.rotate(sx * (1.0 - u * 0.3) - PI / 2 + (k % 2) * 0.2);
          x.fillStyle = lgr(x, 0, -ls, 0, ls, [[0, '#7ac04a'], [1, '#2f7a2e']]);
          x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(ls * 0.6, -ls * 0.9, 0, -ls * 2); x.quadraticCurveTo(-ls * 0.6, -ls * 0.9, 0, 0); x.fill();
          x.strokeStyle = 'rgba(20,60,20,0.5)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -ls * 1.8); x.stroke();
          x.restore();
        }
      }
      x.fillStyle = '#9ad860'; ell(x, bx + lean, -hh - 8, 8, 12); x.fill();
    }
  } else if (kind === 'diepca') { // heart-shaped leaves on reddish stems
    for (let b = 0; b < 14; b++) {
      const bx = (r() - 0.5) * 200, hh = 120 + r() * 150, lean = (r() - 0.5) * 80, tx = bx + lean, ty = -hh;
      x.strokeStyle = '#9a3a4a'; x.lineWidth = 4; x.beginPath(); x.moveTo(bx * 0.5, 0); x.quadraticCurveTo(bx, -hh * 0.5, tx, ty); x.stroke();
      const ls = 30 + r() * 14, la = (r() - 0.5) * 0.8;
      x.save(); x.translate(tx, ty); x.rotate(la);
      x.fillStyle = lgr(x, -ls, -ls, ls, ls, [[0, '#2f6a2a'], [0.6, '#3f8a38'], [1, '#6ab04a']]);
      x.beginPath(); x.moveTo(0, ls * 0.2); x.bezierCurveTo(-ls * 1.2, -ls * 0.2, -ls * 0.7, -ls * 1.3, 0, -ls * 0.75); x.bezierCurveTo(ls * 0.7, -ls * 1.3, ls * 1.2, -ls * 0.2, 0, ls * 0.2); x.fill();
      x.strokeStyle = 'rgba(160,60,80,0.6)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, ls * 0.15); x.lineTo(0, -ls * 0.7); x.stroke();
      x.restore();
    }
  }
  _plant[kind] = { c, w: cw, h: chh, ox: cw / 2, oy: chh - 10 };
  return _plant[kind];
}
function container(ctx, kind, x, y, w) {
  const h = kind === 'box' ? w * 0.42 : w * 0.36;
  if (kind === 'box') {
    ctx.fillStyle = lgr(ctx, x - w / 2, 0, x + w / 2, 0, [[0, '#cfc8ba'], [0.5, GOLD.styro], [1, '#fff8ea']]); ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x - w / 2 - 6, y - h - 10, w + 12, 16);
    ctx.fillStyle = 'rgba(120,100,70,0.25)'; for (let i = 0; i < 5; i++) { ell(ctx, x - w * 0.35 + i * w * 0.17, y - h * (0.3 + (i % 2) * 0.3), 14, 6); ctx.fill(); }
    ctx.fillStyle = 'rgba(90,70,50,0.45)'; ctx.fillRect(x - w / 2, y - 12, w, 12);
  } else if (kind === 'basin') {
    ctx.fillStyle = lgr(ctx, x - w / 2, 0, x + w / 2, 0, [[0, '#24507a'], [0.5, GOLD.basin], [1, '#7ab0e0']]);
    ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x + w / 2, y - h); ctx.lineTo(x + w * 0.4, y); ctx.lineTo(x - w * 0.4, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5a90c8'; ell(ctx, x, y - h, w / 2 + 6, 16); ctx.fill();
  } else { // old aluminium basin
    ctx.fillStyle = lgr(ctx, x - w / 2, 0, x + w / 2, 0, [[0, '#7a7a78'], [0.5, GOLD.alu], [1, '#e8e8e2']]);
    ctx.beginPath(); ctx.moveTo(x - w / 2, y - h); ctx.lineTo(x + w / 2, y - h); ctx.quadraticCurveTo(x + w * 0.45, y, x, y); ctx.quadraticCurveTo(x - w * 0.45, y, x - w / 2, y - h); ctx.fill();
    ctx.fillStyle = '#c8c8c0'; ell(ctx, x, y - h, w / 2 + 4, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(80,80,70,0.4)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - w * 0.2 + i * w * 0.2, y - h * 0.5, 10, 0.5, 2.5); ctx.stroke(); }
  }
  ctx.fillStyle = '#3a2618'; ell(ctx, x, y - h - 2, w / 2 - 2, 12); ctx.fill(); // soil
  ctx.strokeStyle = 'rgba(255,200,130,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w / 2 - 2, y - h); ctx.lineTo(x + w / 2 - (kind === 'box' ? 2 : w * 0.1), y - 4); ctx.stroke();
  return y - h;
}
function herbGarden(ctx, t, o = {}) {
  const d = clamp(o.dusk || 0), sun = o.sun || [820, 330 + d * 200], sw = o.sway ?? 1, gy = 900;
  ctx.save();
  sunsetSky(ctx, 0, 560, { t, sun, sunS: 0.9, dusk: d, clouds: 5, seed: 11 });
  stripPair(ctx, 'far', d, 380, 190, 300, 0, W);
  sunsetWater(ctx, 560, gy, t, { sunX: sun[0], dusk: d, glitter: 120 });
  // bank edge: wooden plank walkway + earth
  ctx.fillStyle = lgr(ctx, 0, gy - 20, 0, H, [[0, '#4a3020'], [0.15, '#3a2618'], [1, '#1a100a']]); ctx.fillRect(0, gy - 10, W, H - gy + 10);
  ctx.fillStyle = '#6a4428'; ctx.fillRect(0, gy - 22, W, 18); ctx.strokeStyle = 'rgba(255,190,110,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, gy - 22); ctx.lineTo(W, gy - 22); ctx.stroke();
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#4a2e1a'; ctx.fillRect(40 + i * 200, gy - 60, 14, 50); }
  ctx.fillStyle = 'rgba(255,170,100,0.15)'; for (let i = 0; i < 14; i++) ctx.fillRect(0, gy + 40 + i * 70, W, 2);
  const layout = [
    ['lettuce', 'box', 210, 1240, 300, 0.8], ['caibe', 'alu', 560, 1220, 300, 0.95], ['hung', 'basin', 880, 1250, 260, 0.85],
    ['diepca', 'basin', 250, 1760, 340, 1.0], ['lacach', 'box', 700, 1780, 440, 1.15],
  ];
  const ret = { boxes: {}, ground: gy };
  layout.forEach(([pk, ck, x, y, w, ps], i) => {
    const top = container(ctx, ck, x, y, w), sp = plantSprite(pk), sc = ps * w / 340;
    ctx.save(); ctx.translate(x, top + 6); ctx.rotate(Math.sin(t * 1.3 + i * 1.7) * 0.025 * sw);
    ctx.drawImage(mipFor(ctx, sp.c, sp.w * sc)[0], -sp.ox * sc, -sp.oy * sc, sp.w * sc, sp.h * sc); ctx.restore();
    // re-draw the container front lip so stems sit inside
    ctx.fillStyle = ck === 'box' ? '#e0d8c8' : ck === 'basin' ? '#4a86c0' : '#bdbdb6'; ctx.fillRect(x - w / 2 - (ck === 'box' ? 6 : 0), top - 2, w + (ck === 'box' ? 12 : 0), 8);
    ret[pk] = [x, top - (pk === 'lettuce' ? 150 : pk === 'caibe' ? 250 : pk === 'diepca' ? 210 : 240) * sc];
    ret.boxes[pk] = { x, y: top, w };
  });
  // golden-hour light + dusk tint on the foreground
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = lgr(ctx, 0, gy, 0, H, [[0, `rgba(255,${(220 - d * 90) | 0},${(190 - d * 40) | 0},1)`], [1, `rgba(${(150 - d * 60) | 0},${(110 - d * 50) | 0},${(140 - d * 30) | 0},1)`]]);
  ctx.fillRect(0, gy - 30, W, H - gy + 30); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lgr(ctx, W, gy, 0, H, [[0, `rgba(255,150,70,${0.35 * (1 - d * 0.6)})`], [0.6, 'rgba(255,150,70,0)']]); ctx.fillRect(0, gy, W, H - gy); ctx.restore();
  L.dust(ctx, t, 8, 30, 0, 600, W, 900, '255,210,150', 2.5, 0.55 * (1 - d * 0.5));
  ctx.restore();
  return ret;
}

module.exports = { GOLD, sunsetSky, sunsetWater, stiltHouse, riversideScene, kitchenInterior, herbGarden, bigPalm, castPan };
