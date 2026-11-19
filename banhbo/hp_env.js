// hp_env.js - DAYTIME (8 AM, hard sun) environment for "Hủ tiếu chợ nổi". See the API header in hprops.js.
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const { W, H, TAU, rng, clamp, lerp, ease, glow } = L;
const PI = Math.PI;
const { COL, BK, mixc, lgr, rgr, ell, canvas, drawMip, palmSprite, bushSprite, treeStrip, fmLayout, halfLayer, ghe, xuongSprite } = NP;

// ------------------------------------------------------------------ day palette
const DAY = {
  sky0: '#1546a0', sky1: '#2f72cc', sky2: '#6aa6e2', sky3: '#bcdcf2',
  w0: '#c4e0ee', w1: '#7cb4d4', w2: '#3c86b0', w3: '#1a5579', w4: '#0f3a58',
  bankFar: '#6f9e9a', bankMid: '#2f6e47', bankNear: '#1d4e2f', bankDeep: '#10301e',
  palmFar: '#7aa8a2', palmNear: '#1f5a30', haze: '#b9d6ee',
  hulls: ['#b23a2a', '#2c7c4c', '#2a66a6', '#86522e', '#c8462e', '#23704a'],
  paints: ['#f0c63a', '#f4f0e2', '#e0452f', '#45ab5c', '#f0c63a', '#2f7ec2'],
  rim: 'rgba(255,252,215,0.7)',
};

// ------------------------------------------------------------------ cumulus sprites (cached)
const _cloud = {};
function cloudSprite(v) {
  if (_cloud[v]) return _cloud[v];
  const CW = 640, CH = 300, [c, x] = canvas(CW, CH), r = rng(900 + v * 31);
  const puffs = [];
  const n = 9 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, px = 70 + u * (CW - 140) + (r() - 0.5) * 30;
    const hump = Math.sin(u * PI);
    const pr = 40 + hump * (60 + r() * 50);
    puffs.push([px, 250 - pr * 0.55 - hump * 30 * r(), pr]);
  }
  for (let i = 0; i < 5; i++) puffs.push([180 + r() * 280, 150 - r() * 50, 50 + r() * 40]);
  const body = () => { x.beginPath(); for (const [px, py, pr] of puffs) { x.moveTo(px + pr, py); x.arc(px, py, pr, 0, TAU); } };
  x.save(); x.beginPath(); x.rect(0, 0, CW, 262); x.clip();
  body(); x.fillStyle = '#ffffff'; x.fill();
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = lgr(x, 0, 40, 0, 262, [[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(206,222,240,0.55)'], [1, 'rgba(150,178,214,0.95)']]);
  x.fillRect(0, 0, CW, CH);
  // inner puff shading (each puff darker at its lower-right)
  for (const [px, py, pr] of puffs) {
    x.fillStyle = rgr(x, px + pr * 0.35, py + pr * 0.45, 0, px + pr * 0.35, py + pr * 0.45, pr, [[0, 'rgba(160,186,220,0.35)'], [1, 'rgba(160,186,220,0)']]);
    x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  // sunlit top-left rims
  for (const [px, py, pr] of puffs) {
    x.fillStyle = rgr(x, px - pr * 0.3, py - pr * 0.4, 0, px - pr * 0.3, py - pr * 0.4, pr * 0.8, [[0, 'rgba(255,255,250,0.9)'], [1, 'rgba(255,255,250,0)']]);
    x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  x.restore();
  _cloud[v] = { c, ox: CW / 2, oy: 262 };
  return _cloud[v];
}

// ------------------------------------------------------------------ sky
function daySky(ctx, y0, y1, o = {}) {
  const t = o.t || 0, x0 = o.x0 ?? 0, w = o.w ?? W, span = Math.max(1, y1 - y0);
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y1, [[0, DAY.sky0], [0.45, DAY.sky1], [0.8, DAY.sky2], [1, DAY.sky3]]);
  ctx.fillRect(x0, y0, w, y1 - y0 + 1);
  if (o.sun) sunDay(ctx, o.sun[0], o.sun[1], o.sunS ?? 1, { flare: o.flare ?? 0.5, t });
  const n = o.clouds ?? 6, r = rng(o.seed ?? 21), drift = o.drift ?? 6, panX = o.panX || 0;
  const wrap = w + 900;
  const list = [];
  for (let i = 0; i < n; i++) {
    const v = Math.floor(r() * 4), depth = r();                 // depth 0 = high/near (big), 1 = near horizon (small, flat)
    const cy = y0 + span * lerp(0.18, 0.93, Math.pow(depth, 0.8));
    const sc = lerp(1.25, 0.32, depth) * (o.cloudS ?? 1) * (0.8 + r() * 0.4);
    const cx = x0 - 450 + (((r() * wrap + t * drift * (1.2 - depth) - panX * (0.15 + (1 - depth) * 0.2)) % wrap) + wrap) % wrap;
    list.push({ v, cy, sc, cx, depth });
  }
  list.sort((a, b) => b.depth - a.depth);
  for (const c of list) {
    const spr = cloudSprite(c.v);
    ctx.globalAlpha = lerp(1, 0.75, c.depth);
    drawMip(ctx, spr.c, spr.ox, spr.oy, c.sc, c.cx, c.cy);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// white-gold high sun: disc + halo (+ optional flare / rays)
function sunDay(ctx, x, y, s = 1, o = {}) {
  ctx.save();
  glow(ctx, x, y, 520 * s, 'rgba(210,235,255,0.55)', 1);
  glow(ctx, x, y, 210 * s, 'rgba(255,248,215,0.85)', 1);
  ctx.fillStyle = rgr(ctx, x, y, 0, x, y, 52 * s, [[0, '#ffffff'], [0.75, '#fffbe8'], [0.93, '#fff0b8'], [1, 'rgba(255,240,190,0)']]);
  ctx.beginPath(); ctx.arc(x, y, 52 * s, 0, TAU); ctx.fill();
  glow(ctx, x, y, 90 * s, 'rgba(255,255,245,1)', 1);
  if (o.rays) L.godRays(ctx, x, y, PI / 2, 2.8, 1900 * s, 12, 'rgba(255,250,225,0.5)', 0.16 * o.rays, o.t || 0);
  if (o.flare) L.flare(ctx, x, y, s * 0.8, o.flare);
  ctx.restore();
}

// ------------------------------------------------------------------ water (blue, dense white-gold glitter)
function dayWater(ctx, y0, y1, t, o = {}) {
  const sunX = o.sunX ?? 640, x0 = o.x0 ?? 0, w = o.w ?? W, hh = y1 - y0, panX = o.panX || 0;
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y1, [[0, DAY.w0], [0.035, DAY.w1], [0.22, DAY.w2], [0.6, DAY.w3], [1, DAY.w4]]);
  ctx.fillRect(x0, y0, w, hh);
  // sky reflection streaks (soft lighter horizontal bands)
  const r0 = rng((o.seed ?? 5) + 300);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 10; i++) {
    const v = Math.pow(r0(), 1.4), yy = y0 + v * hh, bw = (200 + r0() * 500) * (0.4 + v), bx = x0 + ((r0() * (w + 600) - panX * (0.3 + v) + t * 6) % (w + 600) + (w + 600)) % (w + 600) - 300;
    ctx.globalAlpha = 0.18 * (1 - v * 0.5);
    ctx.fillStyle = rgr(ctx, bx, yy, 0, bx, yy, bw, [[0, 'rgba(190,225,255,1)'], [1, 'rgba(190,225,255,0)']]);
    ctx.save(); ctx.translate(bx, yy); ctx.scale(1, 0.05 + v * 0.06); ctx.beginPath(); ctx.arc(0, 0, bw, 0, TAU); ctx.restore(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // sun column (sun is high -> narrow, broken, white-gold)
  const cw = o.colW ?? 200, NB = 26, bh = hh / NB, colA = o.colA ?? 1;
  for (let i = 0; i < NB; i++) {
    const v = i / NB, yy = y0 + v * hh;
    const hw = lerp(cw * 0.2, cw * 1.3, Math.pow(v, 0.8)) * (0.8 + 0.3 * Math.sin(t * 2.3 + i * 1.7));
    const al = colA * (v < 0.4 ? lerp(0.55, 0.32, v / 0.4) : lerp(0.32, 0, (v - 0.4) / 0.6)) * (0.7 + 0.3 * Math.sin(t * 3.1 + i * 2.3));
    const cx = sunX + Math.sin(t * 1.3 + i * 0.9) * 8 * (0.3 + v);
    const c = '255,250,225';
    ctx.fillStyle = lgr(ctx, cx - hw, 0, cx + hw, 0, [[0, `rgba(${c},0)`], [0.3, `rgba(${c},${al * 0.4})`], [0.5, `rgba(${c},${al})`], [0.7, `rgba(${c},${al * 0.4})`], [1, `rgba(${c},0)`]]);
    ctx.fillRect(cx - hw, yy, hw * 2, bh * (0.6 + 0.3 * Math.sin(i * 3.1 + t)) + 0.5);
  }
  ctx.restore();
  NP.ripples(ctx, x0, y0, w, hh, t, { seed: o.seed ?? 5, alpha: o.rippleAlpha ?? 0.55, n: o.n ?? 120, panX, col: '235,248,255' });
  // glitter: half in the sun column, half everywhere; brightest get a 4-point star
  const r = rng(o.seed ?? 77), n = o.glitter ?? 280, gA = o.glitterA ?? 1;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const v = Math.pow(r(), 1.5), yy = y0 + v * hh;
    const inCol = i % 2 === 0;
    const px = inCol ? sunX + lerp(cw * 0.2, cw * 1.6, v) * (r() * 2 - 1) : x0 + ((r() * (w + 200) - panX * (0.3 + v)) % (w + 200) + (w + 200)) % (w + 200) - 100;
    const sp = 4 + r() * 7, ph = r() * TAU, sz0 = 0.6 + r() * 0.8;
    const tw = Math.sin(t * sp + ph);
    if (tw < 0.25) continue;
    const s = (1 + v * 5) * sz0;
    ctx.globalAlpha = gA * tw * (inCol ? 1 : 0.7) * (1 - v * 0.4);
    ctx.fillStyle = '#fffbea';
    ell(ctx, px, yy, s * 3, s * 0.6); ctx.fill();
    if (tw > 0.8 && (inCol || v > 0.3)) {
      const L2 = s * (5 + 4 * (tw - 0.8) * 5);
      ctx.strokeStyle = 'rgba(255,255,248,1)'; ctx.lineWidth = Math.max(1, s * 0.45);
      ctx.beginPath(); ctx.moveTo(px - L2, yy); ctx.lineTo(px + L2, yy); ctx.moveTo(px, yy - L2 * 0.7); ctx.lineTo(px, yy + L2 * 0.7); ctx.stroke();
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ day ghe sprites (saturated hulls) + day haze
const _gheD = {};
function gheDaySprite(v) {
  if (_gheD[v]) return _gheD[v];
  const S = 0.5, [c, x] = canvas(800 * S + 40, 900 * S + 60);
  const r = rng(700 + v * 13), I = NP.ITEMS;
  const items = [I[v % I.length], I[(v + 2) % I.length], r() < 0.5 ? I[(v + 3) % I.length] : null].filter(Boolean);
  ghe(x, 400 * S + 20, 830 * S + 20, S / BK, { items, seed: v, t: 0, bob: 0, hull: DAY.hulls[v % DAY.hulls.length], paint: DAY.paints[v % DAY.paints.length], flip: v % 2 === 1, people: true });
  // hard 8 AM sun: brighten the top-left of the sprite a touch
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = lgr(x, 0, 0, c.width, 0, [[0, 'rgba(255,250,220,0.18)'], [0.5, 'rgba(255,250,220,0)'], [1, 'rgba(0,20,40,0.12)']]); x.fillRect(0, 0, c.width, c.height);
  _gheD[v] = { c, ox: 400 * S + 20, oy: 830 * S + 20, S };
  return _gheD[v];
}
function dayHazed(spr, lvl) {
  if (!lvl) return spr.c;
  spr.hzd = spr.hzd || [];
  if (spr.hzd[lvl]) return spr.hzd[lvl];
  const [c, x] = canvas(spr.c.width, spr.c.height);
  x.drawImage(spr.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = lvl / 4 * 0.5; x.fillStyle = DAY.haze; x.fillRect(0, 0, c.width, c.height);
  return (spr.hzd[lvl] = c);
}

// ------------------------------------------------------------------ DRONE WIDE (morning)
function floatingMarketDay(ctx, t, o = {}) {
  const zoom = clamp(o.zoom || 0);
  const hy = o.horizon ?? lerp(520, 760, ease.inOut(zoom));
  const camH = o.camY ?? lerp(62, 24, ease.inOut(zoom)), z0 = zoom * 60 + (o.dolly || 0), panX = o.panX || 0, f = 900;
  const sx = o.sunX ?? (760 - panX * 3), sy = o.sunY ?? Math.max(120, hy - 420);
  const project = (wx, wz) => { const z = wz - z0; if (z < 1) return null; return [540 + f * (wx - panX) / z, hy + f * camH / z, f / z]; };
  ctx.save();
  // sky at half resolution
  const [hc, hx] = halfLayer('fmSkyDay');
  hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, hc.width, hc.height); hx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  daySky(hx, 0, hy + 2, { t, panX, clouds: o.clouds ?? 7, seed: 23 });
  if (sy < hy) sunDay(hx, sx, sy, 1.1, {});
  hx.setTransform(1, 0, 0, 1, 0, 0);
  const hh = Math.min(hc.height, Math.ceil(hy / 2) + 2);
  ctx.drawImage(hc, 0, 0, hc.width, hh, 0, 0, W, hh * 2);
  const far = treeStrip(DAY.bankFar, 3, 150), mid = treeStrip(DAY.bankMid, 8, 170);
  const off = ((panX * 2) % 1400 + 1400) % 1400;
  ctx.globalAlpha = 0.9; ctx.drawImage(far, -off, hy - 92, 2048 * 0.7, 106 * 0.7 + 30); ctx.drawImage(far, -off + 1433, hy - 92, 2048 * 0.7, 106 * 0.7 + 30);
  ctx.globalAlpha = 1;
  dayWater(ctx, hy, H, t, { sunX: sx, colW: 160, n: 130, glitter: o.glitter ?? 300, panX: panX * 0.5 });
  for (const side of [-1, 1]) {
    ctx.beginPath();
    let first = true;
    for (let wz = 18; wz <= 2400; wz *= 1.12) {
      const wob = Math.sin(wz * 0.02 + side) * 4 + Math.sin(wz * 0.007) * 6;
      const p = project(side * (68 + wob), wz); if (!p) continue;
      if (first) { ctx.moveTo(side < 0 ? -10 : W + 10, p[1]); first = false; }
      ctx.lineTo(p[0], p[1]);
    }
    ctx.lineTo(side < 0 ? -10 : W + 10, hy); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, hy, 0, H, [[0, mixc(DAY.bankFar, DAY.haze, 0.35)], [0.12, DAY.bankMid], [0.5, DAY.bankNear], [1, DAY.bankDeep]]);
    ctx.fill();
  }
  ctx.drawImage(mid, -off * 1.3 - 300, hy - 120, 2048 * 0.9, 190 * 0.9);
  const lay = fmLayout(), objs = [];
  for (const p of lay.palms) objs.push({ z: p.wz, p, type: 'palm' });
  if (o.boats !== false) for (const b of lay.boats) objs.push({ z: b.wz, b, type: 'boat' });
  objs.sort((a, b) => b.z - a.z);
  for (const ob of objs) {
    if (ob.type === 'palm') {
      const p = ob.p, pr = project(p.wx, p.wz); if (!pr) continue;
      const k = Math.round(clamp(1 - (p.wz - z0) / 1100) * 10) / 10;
      const col = mixc(DAY.palmFar, DAY.palmNear, Math.pow(k, 0.7));
      const sc = pr[2] * 0.11 * p.sc;
      if (pr[0] < -400 || pr[0] > W + 400 || sc < 0.02) continue;
      if (p.bush) drawMip(ctx, bushSprite(p.v, col), 150, 150, sc * 1.6, pr[0], pr[1]);
      else drawMip(ctx, palmSprite(p.v, col, k > 0.5 ? DAY.rim : null), 130, 410, sc, pr[0], pr[1]);
    } else {
      const b = ob.b, wx = b.wx + (b.drift ? ((t * b.drift + 40) % 80) - 40 : 0), pr = project(wx, b.wz); if (!pr) continue;
      const sc = pr[2] * 16 / 760;
      if (pr[0] < -300 || pr[0] > W + 300 || pr[1] > H + 200) continue;
      const spr = b.kind === 'xuong' ? xuongSprite() : gheDaySprite(b.v), q = sc / spr.S;
      const bob = Math.sin(t * 1.4 + b.ph) * 2 * q, rk = Math.sin(t * 1.1 + b.ph) * 0.02;
      const img = dayHazed(spr, Math.round(clamp((b.wz - z0) / 700) * 4));
      // hard shadow on the water right under the hull
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#062038';
      ctx.beginPath(); ctx.ellipse(pr[0] + 30 * q * spr.S, pr[1] + bob + 6 * q * spr.S, 380 * q * spr.S, 26 * q * spr.S, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(pr[0], pr[1] + bob); ctx.rotate(rk);
      ctx.save(); ctx.scale(1, -0.7); ctx.globalAlpha = 0.3; drawMip(ctx, img, spr.ox, spr.oy, q); ctx.restore();
      drawMip(ctx, img, spr.ox, spr.oy, q);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = 'rgba(255,255,250,1)'; ctx.lineWidth = Math.max(1, 3 * q * spr.S);
      ctx.beginPath(); ctx.ellipse(pr[0], pr[1] + bob + 2, 360 * q * spr.S, 12 * q * spr.S, 0, 0, PI); ctx.stroke(); ctx.restore();
    }
  }
  // thin horizon haze (no mist) + bright air
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, hy - 70, 0, hy + 120, [[0, 'rgba(210,232,250,0)'], [0.45, 'rgba(210,232,250,0.45)'], [1, 'rgba(210,232,250,0)']]);
  ctx.fillRect(0, hy - 70, W, 190);
  ctx.restore();
  if (sy < hy && (o.rays ?? 1) > 0) L.godRays(ctx, sx, sy, PI / 2, 2.4, 1700, 8, 'rgba(255,250,225,0.5)', 0.1 * (o.rays ?? 1), t);
  if (sy < hy) glow(ctx, sx, sy, 260, 'rgba(255,252,235,0.6)', 0.7);
  ctx.restore();
  return { horizon: hy, sun: [sx, sy], project };
}

// ------------------------------------------------------------------ WATER-LEVEL MID SHOT (morning)
function riverSideDay(ctx, t, panX = 0, o = {}) {
  const hy = o.horizon ?? 980, sx = (o.sunX ?? 780) - panX * 0.05, sy = o.sunY ?? 230;
  ctx.save();
  daySky(ctx, 0, hy, { t, panX: panX * 0.3, clouds: o.clouds ?? 6, seed: o.cloudSeed ?? 21 });
  if (o.sun !== false) sunDay(ctx, sx, sy, o.sunS ?? 1, { rays: o.rays ?? 0.4, flare: o.flare ?? 0, t });
  const far = treeStrip(DAY.bankFar, 3, 150), mid = treeStrip(DAY.bankMid, 8, 170);
  const o1 = ((panX * 0.12) % 2048 + 2048) % 2048, o2 = ((panX * 0.22) % 2048 + 2048) % 2048;
  ctx.globalAlpha = 0.95; ctx.drawImage(far, -o1, hy - 130, 2048, 170); ctx.drawImage(far, 2048 - o1, hy - 130, 2048, 170);
  ctx.globalAlpha = 1;
  ctx.drawImage(mid, -o2, hy - 150, 2048 * 1.1, 190 * 1.1 * 0.9); ctx.drawImage(mid, 2048 * 1.1 - o2, hy - 150, 2048 * 1.1, 190 * 1.1 * 0.9);
  dayWater(ctx, hy, H, t, { sunX: sx, panX, n: 120, glitter: o.glitter ?? 260 });
  if (o.farBoats !== false) {
    const r = rng(o.seed ?? 12);
    for (let i = 0; i < 9; i++) {
      const v = Math.floor(r() * 8), bx = ((r() * 1800 - panX * 0.35) % 1800 + 1800) % 1800 - 360, sc = 0.16 + r() * 0.1;
      const spr = gheDaySprite(v), q = sc / spr.S, by = hy + 14 + sc * 60 + Math.sin(t * 1.3 + i) * 1.5;
      ctx.save(); ctx.translate(bx, by); ctx.scale(q, q);
      ctx.save(); ctx.scale(1, -0.6); ctx.globalAlpha = 0.28; ctx.drawImage(spr.c, -spr.ox, -spr.oy); ctx.restore();
      ctx.drawImage(dayHazed(spr, 1), -spr.ox, -spr.oy); ctx.restore();
    }
  }
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, hy - 160, 0, hy + 60, [[0, 'rgba(215,235,250,0)'], [0.7, 'rgba(215,235,250,0.35)'], [1, 'rgba(215,235,250,0)']]);
  ctx.fillRect(0, hy - 160, W, 220);
  ctx.restore();
  const ox = -panX;
  if (o.mid) { ctx.save(); o.mid(ctx, ox); ctx.restore(); }
  const fy = o.fgY ?? 1560;
  if (fy < H) {
    ctx.save();
    ctx.fillStyle = lgr(ctx, 0, fy, 0, H, [[0, 'rgba(8,40,70,0)'], [0.3, 'rgba(8,40,70,0.28)'], [1, 'rgba(6,30,55,0.6)']]);
    ctx.fillRect(0, fy, W, H - fy);
    NP.ripples(ctx, 0, fy + 20, W, H - fy, t, { seed: 99, n: 40, alpha: 0.55, panX: panX * 1.4, col: '235,248,255' });
    ctx.restore();
  }
  ctx.restore();
  return { horizon: hy, sun: [sx, sy] };
}

// tod wrappers: 'morning' (default) -> day versions; 'dawn' -> original nprops versions
function floatingMarket(ctx, t, o = {}) { return (o.tod === 'dawn') ? NP.floatingMarket(ctx, t, o) : floatingMarketDay(ctx, t, o); }
function riverSide(ctx, t, panX = 0, o = {}) { return (o.tod === 'dawn') ? NP.riverSide(ctx, t, panX, o) : riverSideDay(ctx, t, panX, o); }

// ------------------------------------------------------------------ heat shimmer (strip displacement of what is already drawn)
let _shim = null;
function heatShimmer(ctx, x, y, w, h, t, o = {}) {
  const m = ctx.getTransform();
  const P = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f]);
  const cw = ctx.canvas.width, chh = ctx.canvas.height;
  let X0 = Math.floor(Math.min(...P.map(p => p[0]))), X1 = Math.ceil(Math.max(...P.map(p => p[0])));
  let Y0 = Math.floor(Math.min(...P.map(p => p[1]))), Y1 = Math.ceil(Math.max(...P.map(p => p[1])));
  X0 = Math.max(0, X0); Y0 = Math.max(0, Y0); X1 = Math.min(cw, X1); Y1 = Math.min(chh, Y1);
  const bw = X1 - X0, bh = Y1 - Y0; if (bw < 4 || bh < 4) return;
  if (!_shim || _shim[0].width < bw || _shim[0].height < bh) _shim = canvas(Math.max(bw, _shim ? _shim[0].width : 0), Math.max(bh, _shim ? _shim[0].height : 0));
  const [sc, sx] = _shim;
  sx.setTransform(1, 0, 0, 1, 0, 0); sx.clearRect(0, 0, bw, bh);
  sx.drawImage(ctx.canvas, X0, Y0, bw, bh, 0, 0, bw, bh);
  const amp = (o.amp ?? 6) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)), strip = Math.max(3, Math.round(o.strip ?? 6)), al = o.alpha ?? 0.9;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let yy = 0; yy < bh; yy += strip) {
    const v = yy / bh, env = Math.sin(v * PI) * (o.rise ? 1 : 1) * (1 - v * 0.3);
    const dx = Math.sin(t * 9 + yy * 0.09) * amp * env + Math.sin(t * 5.3 + yy * 0.031) * amp * 0.5 * env;
    const dy = -Math.abs(Math.sin(t * 6 + yy * 0.05)) * amp * 0.3 * env;
    ctx.globalAlpha = al * env;
    ctx.drawImage(sc, 0, yy, bw, strip, X0 + dx, Y0 + yy + dy, bw, strip);
  }
  ctx.restore();
}

module.exports = { DAY, cloudSprite, daySky, sunDay, dayWater, gheDaySprite, dayHazed, floatingMarketDay, riverSideDay, floatingMarket, riverSide, heatShimmer };
