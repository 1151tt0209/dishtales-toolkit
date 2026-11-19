// hp_food.js - hủ tiếu food, kitchen props and the noodle boat. See the API header in hprops.js.
// Convention: every drawer here returns points in LOCAL coordinates (same space as its x,y args).
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const { Path2D } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, ease, glow, at } = L;
const PI = Math.PI;
const { COL, BK, lgr, rgr, ell, rrect, capFS, outFill, rimLine, mapper, OUT, boatXform, hullSide, innerGunwale } = NP;

// local point mapper for a drawer placed at (x,y,rot,s[,flip])
function LP(x, y, rot = 0, s = 1, fx = 1) { const c = Math.cos(rot), n = Math.sin(rot); return (px, py) => { px *= fx; return [x + s * (c * px - n * py), y + s * (n * px + c * py)]; }; }
// inverse of a canvas transform matrix applied to a device point
function invApply(m, px, py) { const det = m.a * m.d - m.b * m.c || 1e-9, dx = px - m.e, dy = py - m.f; return [(m.d * dx - m.c * dy) / det, (-m.b * dx + m.a * dy) / det]; }
function toLocal(ctx, p, base) { const m = base || ctx.getTransform(); return p ? invApply(m, p[0], p[1]) : p; }

const PORC = { hi: '#ffffff', mid: '#f1f4f7', lo: '#b8c6d6', blue: '#1f4fa3', blueL: '#4a78c6' };
const BROTH = { hi: '#ffe39a', mid: '#e9b04c', lo: '#c98428', clear: 'rgba(236,178,80,0.82)' };

// ================================================================ single toppings (bowl scale: as seen in a bowl at s=1)
function porkSlice(ctx, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    ctx.beginPath(); ctx.moveTo(-38, -6); ctx.bezierCurveTo(-34, -22, 26, -24, 38, -10); ctx.bezierCurveTo(44, 4, 30, 18, 4, 17); ctx.bezierCurveTo(-24, 17, -42, 10, -38, -6); ctx.closePath();
    ctx.fillStyle = '#b8352a'; ctx.fill(); ctx.strokeStyle = 'rgba(70,20,15,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-32, -4); ctx.bezierCurveTo(-28, -16, 22, -18, 32, -7); ctx.bezierCurveTo(37, 3, 26, 12, 4, 11); ctx.bezierCurveTo(-20, 11, -35, 6, -32, -4); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -16, 0, 12, [[0, '#f5c2a8'], [0.6, '#e49a80'], [1, '#c87660']]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,235,220,0.75)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-24, -6); ctx.quadraticCurveTo(0, -12, 26, -5); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,70,55,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-20, 4); ctx.quadraticCurveTo(2, 0, 22, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -14, -10, 8, 2.5, -0.15); ctx.fill();
  });
}
function shrimp(ctx, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // body: C-curl of segments
    const segs = 6;
    for (let i = segs - 1; i >= 0; i--) {
      const a = -PI * 0.15 + i / segs * PI * 1.15, rr = 18, w = lerp(15, 8, i / segs);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      ell(ctx, px, py, w, w * 0.85, a); ctx.fillStyle = lgr(ctx, px - w, py - w, px + w, py + w, [[0, '#ffb487'], [0.5, '#f0703e'], [1, '#c8442a']]); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,225,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(px, py, w * 0.8, a - PI * 0.9, a - PI * 0.4); ctx.stroke();
    }
    // tail fan
    const ta = -PI * 0.15 + PI * 1.15, tx = Math.cos(ta) * 18, ty = Math.sin(ta) * 18;
    ctx.fillStyle = '#d8462c'; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx - 14, ty - 12); ctx.lineTo(tx - 4, ty - 2); ctx.lineTo(tx - 16, ty + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,25,15,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(0, 0, 18 + 9, -PI * 0.15, PI); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, 6, -16, 5, 2, 0.3); ctx.fill();
  });
}
function liverSlice(ctx, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    ctx.beginPath(); ctx.moveTo(-28, 2); ctx.bezierCurveTo(-26, -14, 20, -16, 30, -4); ctx.bezierCurveTo(34, 8, 16, 14, -2, 13); ctx.bezierCurveTo(-20, 13, -30, 10, -28, 2); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -14, 0, 14, [[0, '#8a4a42'], [0.6, '#6a332e'], [1, '#4a2220']]); ctx.fill(); ctx.strokeStyle = 'rgba(40,15,12,0.6)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,210,0.35)'; ell(ctx, -8, -7, 12, 2.6, -0.1); ctx.fill();
  });
}
function quailEgg(ctx, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    if (o.whole) { ell(ctx, 0, 0, 20, 15); ctx.fillStyle = rgr(ctx, -6, -6, 2, 0, 0, 22, [[0, '#fffdf6'], [1, '#e6dccb']]); ctx.fill(); ctx.strokeStyle = 'rgba(120,100,80,0.45)'; ctx.lineWidth = 1.4; ctx.stroke(); return; }
    ell(ctx, 0, 0, 21, 16); ctx.fillStyle = rgr(ctx, -6, -6, 2, 0, 0, 22, [[0, '#ffffff'], [1, '#e9e2d6']]); ctx.fill(); ctx.strokeStyle = 'rgba(120,100,80,0.45)'; ctx.lineWidth = 1.4; ctx.stroke();
    ell(ctx, 1, 1, 10.5, 9); ctx.fillStyle = rgr(ctx, -2, -2, 1, 1, 1, 11, [[0, '#ffd45a'], [1, '#e8a22a']]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ell(ctx, -9, -7, 5, 2, -0.5); ctx.fill();
  });
}
function chives(ctx, x, y, s = 1, rot = 0, o = {}) {
  const n = o.n ?? 1, r = rng(o.seed ?? 3);
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ox = n > 1 ? (r() - 0.5) * (o.spread ?? 60) : 0, oy = n > 1 ? (r() - 0.5) * (o.spread ?? 60) * 0.6 : 0, a = n > 1 ? r() * PI : 0, len = (o.len ?? 34) * (0.8 + r() * 0.4);
      const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
      ctx.strokeStyle = '#2f7a2a'; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(ox - dx, oy - dy); ctx.lineTo(ox + dx, oy + dy); ctx.stroke();
      ctx.strokeStyle = '#5cbf45'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ox - dx, oy - dy); ctx.lineTo(ox + dx, oy + dy); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,255,190,0.7)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(ox - dx * 0.8, oy - dy * 0.8 - 1); ctx.lineTo(ox + dx * 0.6, oy + dy * 0.6 - 1); ctx.stroke();
    }
  });
}
function beanSprouts(ctx, x, y, s = 1, rot = 0, o = {}) {
  const n = o.n ?? 1, r = rng(o.seed ?? 8);
  at(ctx, x, y, rot, s, s * (o.sq ?? 1), () => {
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ox = n > 1 ? (r() - 0.5) * (o.spread ?? 80) : 0, oy = n > 1 ? (r() - 0.5) * (o.spread ?? 80) * 0.5 : 0, a = n > 1 ? r() * TAU : 0, bend = (r() - 0.5) * 22;
      at(ctx, ox, oy, a, 1, 1, () => {
        ctx.strokeStyle = 'rgba(150,140,110,0.55)'; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, bend, 24, 0); ctx.stroke();
        ctx.strokeStyle = '#f6f3e6'; ctx.lineWidth = 4.6; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-20, -1.5); ctx.quadraticCurveTo(0, bend - 1.5, 18, -1.5); ctx.stroke();
        ell(ctx, 27, -1, 6, 4.5, 0.3); ctx.fillStyle = '#e8d46a'; ctx.fill(); ctx.fillStyle = '#9cc85a'; ell(ctx, 30, -3, 3, 2, 0.3); ctx.fill();
        ctx.strokeStyle = 'rgba(220,210,180,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-34, 4, -38, 2); ctx.stroke();
      });
    }
  });
}
function limeWedge(ctx, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(0, 30, 30, 0); ctx.closePath();
    ctx.fillStyle = '#3f8f2a'; ctx.fill(); ctx.strokeStyle = 'rgba(25,60,15,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, 24, 26, 0); ctx.closePath(); ctx.fillStyle = '#eef2b0'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-23, -1); ctx.quadraticCurveTo(0, 20, 23, -1); ctx.closePath(); ctx.fillStyle = lgr(ctx, 0, 0, 0, 18, [[0, '#d8ec7a'], [1, '#b6d84a']]); ctx.fill();
    ctx.strokeStyle = 'rgba(240,250,200,0.9)'; ctx.lineWidth = 1.3;
    for (const a of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(PI * a) * -22 * (a < 0.5 ? 1 : -1) * 0 + lerp(-20, 20, a), 10 + Math.sin(PI * a) * 6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, -10, 4, 4, 1.6, 0.4); ctx.fill();
  });
}
function chiliSlices(ctx, x, y, s = 1, o = {}) {
  const n = o.n ?? 5, r = rng(o.seed ?? 4), sp = o.spread ?? 40;
  at(ctx, x, y, 0, s, s * (o.sq ?? 1), () => {
    for (let i = 0; i < n; i++) {
      const px = n > 1 ? (r() - 0.5) * sp : 0, py = n > 1 ? (r() - 0.5) * sp * 0.6 : 0, rr = 6 + r() * 2;
      ell(ctx, px, py, rr, rr * 0.85, r()); ctx.fillStyle = '#d42a1e'; ctx.fill();
      ell(ctx, px, py, rr * 0.6, rr * 0.5); ctx.fillStyle = '#f6e4b0'; ctx.fill();
      ctx.fillStyle = '#e9c060'; for (let j = 0; j < 3; j++) { ell(ctx, px + (r() - 0.5) * rr * 0.6, py + (r() - 0.5) * rr * 0.5, 1.2, 0.8); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, px - rr * 0.4, py - rr * 0.45, rr * 0.3, rr * 0.12, -0.5); ctx.fill();
    }
  });
}
function garlicBits(ctx, x, y, s = 1, o = {}) {
  const n = o.n ?? 12, r = rng(o.seed ?? 6), sp = o.spread ?? 60;
  at(ctx, x, y, 0, s, s * (o.sq ?? 1), () => {
    for (let i = 0; i < n; i++) {
      const px = (r() - 0.5) * sp, py = (r() - 0.5) * sp * 0.6, z = 2.4 + r() * 2.6;
      ctx.fillStyle = r() < 0.5 ? '#e0a63a' : '#c98226';
      ctx.beginPath(); ctx.moveTo(px - z, py); ctx.lineTo(px, py - z * 0.8); ctx.lineTo(px + z, py - z * 0.1); ctx.lineTo(px + z * 0.2, py + z * 0.8); ctx.closePath(); ctx.fill();
      if (r() < 0.4) { ctx.fillStyle = '#ffe2a0'; ell(ctx, px - z * 0.2, py - z * 0.25, z * 0.35, z * 0.2); ctx.fill(); }
    }
  });
}

// ================================================================ toppingFall with extra kinds: garlic, chives (same physics as NP.toppingFall)
function toppingFall(ctx, t, t0, seed, n, x, y, o = {}) {
  const age = t - t0; if (age < 0) return;
  const r = rng(seed), g = o.g ?? 1400, wd = o.w ?? 120, floor = o.floor ?? Infinity;
  const kinds = o.kinds || (o.kind === 'mix' || !o.kind ? ['garlic', 'chives', 'chili'] : [o.kind]);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const kd = kinds[(r() * kinds.length) | 0];
    const dl = r() * (o.spread ?? 0.4), ox = (r() - 0.5) * wd, vx = (r() - 0.5) * 120, vy = r() * 80, rr = r() * TAU, sp = (r() - 0.5) * 12, sz = (o.size ?? 1) * (0.8 + r() * 0.5), cv = r();
    const a = age - dl; if (a < 0) continue;
    let px = x + ox + vx * a, py = y + vy * a + 0.5 * g * a * a;
    if (py > floor) py = floor - cv * 6;
    at(ctx, px, py, rr + sp * a, sz, sz, () => {
      if (kd === 'garlic') { ctx.fillStyle = cv < 0.5 ? '#e3a83c' : '#c88426'; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(0, -4); ctx.lineTo(5, -1); ctx.lineTo(1, 4); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,230,170,0.8)'; ell(ctx, -1, -1, 1.8, 1); ctx.fill(); }
      else if (kd === 'chives') { ctx.lineCap = 'round'; ctx.strokeStyle = '#2f7a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke(); ctx.strokeStyle = '#5cbf45'; ctx.lineWidth = 3; ctx.stroke(); }
      else if (kd === 'scallion') { ctx.strokeStyle = '#3f9a36'; ctx.lineWidth = 3; ell(ctx, 0, 0, 6, 4); ctx.stroke(); }
      else if (kd === 'peanut') { ctx.fillStyle = cv < 0.5 ? '#ecd29c' : '#c99a58'; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(5, -5); ctx.lineTo(6, 4); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); }
      else if (kd === 'sprout') { ctx.lineCap = 'round'; ctx.strokeStyle = '#f6f3e6'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(0, 4, 14, 0); ctx.stroke(); ctx.fillStyle = '#e8d46a'; ell(ctx, 15, 0, 3.5, 2.6); ctx.fill(); }
      else { ctx.fillStyle = cv < 0.7 ? '#d1281e' : '#f3eedb'; ell(ctx, 0, 0, 4.5, 3.6); ctx.fill(); ctx.fillStyle = '#f6e4b0'; ell(ctx, 0, 0, 2.4, 1.8); ctx.fill(); }
    });
  }
  ctx.restore();
}

// ================================================================ noodles (pile / lifted strands)
function noodles(ctx, x, y, s = 1, o = {}) {
  const w = o.w ?? 160, lift = clamp(o.lift || 0), t = o.t || 0, r = rng(o.seed ?? 12), dry = !!o.dry, wet = o.wet ?? !dry;
  const mp = LP(x, y, o.rot || 0, s);
  const topY = -40 - lift * (o.liftH ?? 240);
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (dry) {
      // dry noodle nest: dense opaque off-white loops in a flat bundle
      ell(ctx, 0, -18, w * 0.5, 26); ctx.fillStyle = '#efe6cf'; ctx.fill(); ctx.strokeStyle = 'rgba(120,100,70,0.55)'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 26; i++) {
        const cx = (r() - 0.5) * w * 0.8, cy = -18 + (r() - 0.5) * 34, rx = 14 + r() * 26, a0 = r() * TAU;
        ctx.strokeStyle = i % 3 ? 'rgba(255,252,240,0.95)' : 'rgba(190,170,130,0.7)'; ctx.lineWidth = i % 3 ? 2.4 : 1.6;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.35, (r() - 0.5) * 0.4, a0, a0 + PI * (0.8 + r())); ctx.stroke();
      }
      return;
    }
    // base pile
    if (lift < 1) {
      ell(ctx, 0, -12, w * 0.5, 22 + 10 * (1 - lift)); ctx.fillStyle = wet ? 'rgba(250,246,234,0.92)' : '#f4efe2'; ctx.fill();
      ctx.strokeStyle = 'rgba(170,150,110,0.45)'; ctx.lineWidth = 1.6; ctx.stroke();
      for (let i = 0; i < 22; i++) {
        const cx = (r() - 0.5) * w * 0.8, cy = -12 + (r() - 0.5) * 26, rx = 16 + r() * 30, a0 = r() * TAU;
        ctx.strokeStyle = i % 2 ? 'rgba(255,255,250,0.95)' : 'rgba(200,185,150,0.6)'; ctx.lineWidth = i % 2 ? 3 : 1.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.3, (r() - 0.5) * 0.5, a0, a0 + PI * (0.6 + r() * 0.8)); ctx.stroke();
      }
    }
    // lifted strands: from a gather point up top down into the pile, swaying
    if (lift > 0) {
      const ns = o.strands ?? 14;
      for (let i = 0; i < ns; i++) {
        const u = (i + 0.5) / ns, bx = (u - 0.5) * w * 0.7, sw = Math.sin(t * 3 + i) * 6 * lift;
        const gx = (u - 0.5) * 14;
        ctx.strokeStyle = 'rgba(190,175,140,0.55)'; ctx.lineWidth = 4.6;
        ctx.beginPath(); ctx.moveTo(gx, topY); ctx.bezierCurveTo(gx + sw, lerp(topY, -12, 0.4), bx * 0.6 + sw, lerp(topY, -12, 0.8), bx, -12 - (1 - lift) * 4); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,253,245,0.97)'; ctx.lineWidth = 3; ctx.stroke();
      }
      if (wet) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; for (let i = 0; i < 4; i++) { const gx = (i - 1.5) * 4; ctx.beginPath(); ctx.moveTo(gx, topY + 10); ctx.lineTo(gx + 1, topY + 60); ctx.stroke(); } }
    }
    if (wet) { // gloss dots
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 6; i++) { ell(ctx, (r() - 0.5) * w * 0.7, -14 + (r() - 0.5) * 20, 3, 1.3); ctx.fill(); }
    }
  });
  return { top: mp(0, topY), base: mp(0, 0) };
}

// ================================================================ porcelain bowl (white, blue rim pattern)
const RYR = { top: 1, side: 0.2, '3q': 0.45 };
function bowlBand(ctx, R, ryr, y0, n = 16) {
  // blue motif band hugging the outer front of the bowl, just below the rim
  ctx.save();
  ctx.strokeStyle = PORC.blue; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.ellipse(0, y0, R * 0.985, R * ryr, 0, 0.04, PI - 0.04); ctx.stroke();
  ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(0, y0 + 16, R * 0.95, R * ryr, 0, 0.08, PI - 0.08); ctx.stroke();
  ctx.fillStyle = PORC.blue;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) / n * PI; const px = Math.cos(a) * R * 0.97, py = y0 + 8 + Math.sin(a) * R * ryr;
    const sc = 0.45 + Math.sin(a) * 0.55;
    ctx.beginPath(); ctx.ellipse(px, py, 5 * sc, 4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 6 * sc, py - 1, 3 * sc, PI, TAU); ctx.lineWidth = 1.5; ctx.strokeStyle = PORC.blue; ctx.stroke();
  }
  ctx.restore();
}
function huTieuBowl(ctx, x, y, s = 1, o = {}) {
  const view = o.view || '3q', ryr = o.ryr ?? RYR[view] ?? 0.45, R = 150, t = o.t || 0;
  const layers = clamp(o.layers ?? 7, 0, 7), Lfull = Math.floor(layers + 1e-6), frac = layers - Lfull;
  const broth = clamp(o.broth ?? o.level ?? 1), slosh = o.slosh || 0;
  const mp = LP(x, y, o.rot || 0, s);
  const bodyH = R * 0.62 * (1 - ryr * 0.55) + 10;            // outside wall height below the rim (visual)
  const sx0 = Math.sin(t * 7.5) * slosh * R * 0.06, sy0 = Math.cos(t * 7.5) * slosh * R * 0.02;
  const surf = { cx: sx0, cy: (1 - ryr) * R * 0.1 * (1.6 - broth) + sy0 + (1 - broth) * R * ryr * 0.35, rx: R * lerp(0.7, 0.9, broth), ry: R * ryr * lerp(0.7, 0.9, broth) };
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // contact shadow (hard, down-right: 8 AM sun)
    if (view !== 'top' && o.shadow !== false) { ctx.fillStyle = 'rgba(10,25,40,0.28)'; ell(ctx, 18, bodyH + 4, R * 0.62, R * ryr * 0.45 + 6); ctx.fill(); }
    if (view === 'top' && o.shadow !== false) { ctx.fillStyle = 'rgba(10,25,40,0.25)'; ell(ctx, 14, 16, R * 1.02, R * 1.02); ctx.fill(); }
    // outer wall
    if (view !== 'top') {
      ctx.beginPath(); ctx.moveTo(-R, 0); ctx.bezierCurveTo(-R * 0.98, bodyH * 0.7, -R * 0.6, bodyH, -R * 0.36, bodyH); ctx.lineTo(R * 0.36, bodyH); ctx.bezierCurveTo(R * 0.6, bodyH, R * 0.98, bodyH * 0.7, R, 0);
      ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI, false); ctx.closePath();
      outFill(ctx, lgr(ctx, -R, 0, R, 0, [[0, '#dfe6ee'], [0.22, PORC.hi], [0.55, PORC.mid], [1, PORC.lo]]), 2.6);
      // foot ring
      ctx.fillStyle = '#d6dee7'; ctx.beginPath(); ctx.ellipse(0, bodyH + 2, R * 0.38, 7 + R * ryr * 0.1, 0, 0, PI); ctx.fill();
      ctx.strokeStyle = PORC.blue; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, bodyH - 6, R * 0.4, R * ryr * 0.18 + 3, 0, 0.2, PI - 0.2); ctx.stroke();
      bowlBand(ctx, R, ryr, 6);
      rimLine(ctx, () => { ctx.moveTo(-R * 0.97, 8); ctx.bezierCurveTo(-R * 0.95, bodyH * 0.6, -R * 0.65, bodyH * 0.9, -R * 0.45, bodyH * 0.96); }, 'rgba(255,255,255,0.9)', 4);
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#0a1a30'; ctx.beginPath(); ctx.moveTo(R * 0.55, 6); ctx.bezierCurveTo(R * 0.9, bodyH * 0.4, R * 0.7, bodyH * 0.9, R * 0.3, bodyH); ctx.lineTo(R * 0.36, bodyH); ctx.bezierCurveTo(R * 0.6, bodyH, R * 0.98, bodyH * 0.7, R, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // rim + inner glaze
    ell(ctx, 0, 0, R, R * ryr); ctx.fillStyle = PORC.hi; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
    ell(ctx, 0, 0, R * 0.93, R * ryr * 0.9); ctx.fillStyle = lgr(ctx, 0, -R * ryr, 0, R * ryr, [[0, '#c8d3df'], [0.5, '#eef2f6'], [1, '#ffffff']]); ctx.fill();
    // inner blue rim line + tiny pattern (inside the lip)
    ctx.strokeStyle = PORC.blueL; ctx.lineWidth = 2.2; ell(ctx, 0, 0, R * 0.955, R * ryr * 0.94); ctx.stroke();
    if (view === 'top') { ctx.strokeStyle = PORC.blue; ctx.lineWidth = 2.6; ell(ctx, 0, 0, R * 0.995, R * 0.995); ctx.stroke(); ctx.fillStyle = PORC.blue; for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ell(ctx, Math.cos(a) * R * 0.975, Math.sin(a) * R * 0.975, 3, 1.6, a + PI / 2); ctx.fill(); } }
    // ---- contents: clip = inside rim, open upward so piled toppings can rise above the back rim
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.93, R * ryr * 0.9, 0, 0, TAU); ctx.rect(-R * 1.6, -R * 6, R * 3.2, R * 6); ctx.clip('nonzero');
    if (view === 'top') { ctx.restore(); ctx.save(); ell(ctx, 0, 0, R * 0.93, R * 0.93); ctx.clip(); }
    // broth
    if (broth > 0.01) {
      ell(ctx, surf.cx, surf.cy, surf.rx, surf.ry); ctx.fillStyle = rgr(ctx, surf.cx - surf.rx * 0.2, surf.cy - surf.ry * 0.3, 4, surf.cx, surf.cy, surf.rx, [[0, 'rgba(255,226,140,0.92)'], [0.6, 'rgba(235,176,78,0.9)'], [1, 'rgba(200,128,40,0.95)']]); ctx.fill();
      // fat droplets + sky glints
      const rf = rng(o.seed ?? 31);
      for (let i = 0; i < 18; i++) {
        const a = rf() * TAU, d = Math.sqrt(rf()) * 0.9, px = surf.cx + Math.cos(a) * d * surf.rx, py = surf.cy + Math.sin(a) * d * surf.ry, z = 3 + rf() * 6;
        ell(ctx, px, py, z, z * Math.max(0.3, ryr)); ctx.fillStyle = 'rgba(255,214,110,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(190,120,30,0.5)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,250,0.9)'; ell(ctx, px - z * 0.3, py - z * 0.3 * Math.max(0.3, ryr), z * 0.3, z * 0.18); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, surf.cx - surf.rx * 0.35, surf.cy - surf.ry * 0.45, surf.rx * 0.28, surf.ry * 0.12, -0.15); ctx.fill();
    }
    // toppings
    const sq = view === 'top' ? 1 : lerp(ryr, 1, 0.5), base = (view === 'side' ? -R * 0.07 : 0);
    const TP = (u, v) => [surf.cx + u * R * 0.82, surf.cy + base + v * R * 0.82 * ryr];
    const drawLayer = (li, dy, al) => {
      ctx.save(); ctx.translate(0, dy); if (al < 1) ctx.globalAlpha = al;
      const rl = rng(100 + li * 17 + (o.seed || 0));
      if (li === 1) {
        // noodle mound
        const [cx, cy] = TP(0, 0.02);
        ell(ctx, cx, cy - (view === 'top' ? 0 : 6), R * 0.62, R * 0.62 * ryr * 0.95 + (view === 'top' ? 0 : 10)); ctx.fillStyle = 'rgba(250,247,236,0.93)'; ctx.fill();
        for (let i = 0; i < 30; i++) {
          const a = rl() * TAU, d = Math.sqrt(rl()) * 0.55, px = cx + Math.cos(a) * d * R, py = cy - 4 + Math.sin(a) * d * R * ryr, rx = 14 + rl() * 26, a0 = rl() * TAU;
          ctx.strokeStyle = i % 2 ? 'rgba(255,255,252,0.98)' : 'rgba(196,180,140,0.55)'; ctx.lineWidth = i % 2 ? 3 : 1.6;
          ctx.beginPath(); ctx.ellipse(px, py, rx, rx * Math.max(0.28, ryr * 0.6), (rl() - 0.5) * 0.6, a0, a0 + PI * (0.6 + rl() * 0.8)); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 6; i++) { ell(ctx, cx + (rl() - 0.5) * R * 0.8, cy + (rl() - 0.5) * R * ryr * 0.6, 3.5, 1.4); ctx.fill(); }
      } else if (li === 2) {
        for (let i = 0; i < 5; i++) { const a = PI * (1.08 + i * 0.14), [px, py] = TP(Math.cos(a) * 0.5, Math.sin(a) * 0.5 - 0.02); porkSlice(ctx, px, py - 4, 1.05, a + PI / 2 + 0.2, { sq }); }
      } else if (li === 3) {
        for (const [u, v, a] of [[0.42, -0.42, 0.4], [0.62, -0.1, 1.2], [0.36, 0.08, -0.4]]) { const [px, py] = TP(u, v); shrimp(ctx, px, py - 4, 1, a, { sq }); }
      } else if (li === 4) {
        for (const [u, v, a] of [[-0.5, 0.28, 0.3], [-0.26, 0.5, -0.2], [-0.66, 0.02, 0.8]]) { const [px, py] = TP(u, v); liverSlice(ctx, px, py - 3, 1, a, { sq }); }
      } else if (li === 5) {
        for (const [u, v, a] of [[0.12, 0.42, 0.2], [0.36, 0.42, -0.3], [0.0, 0.14, 0.5], [-0.08, -0.22, -0.2]]) { const [px, py] = TP(u, v); quailEgg(ctx, px, py - 5, 0.95, a, { sq }); }
      } else if (li === 6) {
        for (let i = 0; i < 16; i++) { const a = rl() * TAU, d = Math.sqrt(rl()) * 0.7, [px, py] = TP(Math.cos(a) * d, Math.sin(a) * d); chives(ctx, px, py - 8, 0.8, rl() * PI, { sq }); }
      } else if (li === 7) {
        const [cx, cy] = TP(0, 0.05); garlicBits(ctx, cx, cy - 8, 1, { n: 46, spread: R * 1.2, seed: 61, sq: Math.max(ryr, 0.4) });
        ctx.fillStyle = 'rgba(255,200,90,0.35)'; for (let i = 0; i < 8; i++) { const [px, py] = TP((rl() - 0.5) * 1.4, (rl() - 0.5) * 1.2); ell(ctx, px, py, 8, 8 * ryr); ctx.fill(); }
      }
      ctx.restore();
    };
    for (let li = 1; li <= Lfull; li++) drawLayer(li, 0, 1);
    if (frac > 0.001 && Lfull < 7) { const e = ease.out(frac); drawLayer(Lfull + 1, -(1 - e) * R * 1.6, clamp(frac * 4)); }
    if (o.garnish) {
      const [cx, cy] = TP(0.15, -0.2); beanSprouts(ctx, cx, cy - 10, 0.9, 0, { n: 7, seed: 5, spread: 110, sq });
      const [hx, hy] = TP(-0.2, -0.45); NP.herb(ctx, 'basil', hx, hy - 6, 0.5, -0.4);
      const [qx, qy] = TP(0.5, 0.3); chiliSlices(ctx, qx, qy, 1, { n: 4, spread: 50, sq });
    }
    ctx.restore();
    // front lip highlight drawn over contents (sells depth)
    if (view !== 'top') { rimLine(ctx, () => ctx.ellipse(0, 0, R * 0.99, R * ryr * 0.99, 0, PI * 0.1, PI * 0.9), 'rgba(255,255,255,0.95)', 3.5); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(0, 0, R, R * ryr, 0, 0, PI); ctx.stroke(); }
    rimLine(ctx, () => ctx.ellipse(0, 0, R * 0.99, R * ryr * 0.99, 0, PI * 1.15, PI * 1.5), 'rgba(255,255,255,0.9)', 3);
    if (o.lime) limeWedge(ctx, R * 0.86, -R * ryr * 0.35, 0.9, -0.5);
  });
  if (o.steam) NP.steamWisps(ctx, t, o.steamSeed ?? 7, ...mp(-R * 0.6, -R * ryr * 0.4), R * 1.2 * s, R * 2.4 * s, { n: 5, alpha: 0.45 * o.steam, w: 30 * s });
  return { rim: mp(0, 0), center: mp(surf.cx, surf.cy), rx: R * s, ry: R * ryr * s, top: mp(0, -R * ryr), bottom: mp(0, view === 'top' ? R : bodyH), mouthR: R * s };
}

// ================================================================ dented aluminium broth pot
function potContents(ctx, cx, cy, rx, ry, t, o, top) {
  const boil = clamp(o.boil ?? 0.5), r = rng(o.seed ?? 41);
  ctx.save(); ell(ctx, cx, cy, rx, ry); ctx.clip();
  ell(ctx, cx, cy, rx, ry); ctx.fillStyle = rgr(ctx, cx - rx * 0.2, cy - ry * 0.3, 4, cx, cy, rx * 1.05, [[0, '#f2c86a'], [0.55, '#d9982e'], [1, '#9a5a18']]); ctx.fill();
  const sq = ry / rx;
  // bones (knuckles poking out), daikon chunks, charred onion halves
  const items = [['bone', -0.45, -0.25, 0.3], ['bone', 0.3, -0.45, -0.6], ['bone', 0.05, 0.25, 1.4], ['daikon', -0.15, -0.5, 0], ['daikon', 0.55, 0.05, 0], ['daikon', -0.6, 0.2, 0], ['onion', 0.25, 0.45, 0.2], ['onion', -0.3, 0.42, -0.4], ['bone', 0.65, -0.3, 2.2]];
  for (const [k, u, v, a] of items) {
    const px = cx + u * rx, py = cy + v * ry, bob = Math.sin(t * 3 + u * 9) * 2 * boil;
    at(ctx, px, py + bob, 0, rx / 160, rx / 160, () => {
      ctx.save(); ctx.scale(1, top ? 1 : Math.max(0.45, sq * 1.6));
      if (k === 'bone') {
        ctx.rotate(a);
        ctx.fillStyle = '#e9dcc0'; ctx.strokeStyle = 'rgba(110,80,50,0.6)'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.roundRect(-34, -9, 68, 18, 9); ctx.fill(); ctx.stroke();
        for (const ex of [-34, 34]) { ctx.beginPath(); ctx.arc(ex, -8, 11, 0, TAU); ctx.arc(ex, 8, 11, 0, TAU); ctx.fill(); }
        ctx.fillStyle = 'rgba(170,110,70,0.5)'; ell(ctx, 0, 2, 22, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,245,0.8)'; ell(ctx, -10, -5, 14, 2.5); ctx.fill();
      } else if (k === 'daikon') {
        ell(ctx, 0, 0, 24, 20); ctx.fillStyle = lgr(ctx, -20, -20, 20, 20, [[0, '#fbf6e8'], [1, '#d9cfae']]); ctx.fill(); ctx.strokeStyle = 'rgba(150,130,90,0.55)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(230,215,180,0.9)'; ctx.lineWidth = 1.4; ell(ctx, 0, 0, 14, 11); ctx.stroke();
      } else {
        ctx.rotate(a);
        ell(ctx, 0, 0, 30, 24); ctx.fillStyle = '#9a5a2a'; ctx.fill();
        ctx.strokeStyle = '#d8a060'; ctx.lineWidth = 2.6; for (const rr of [20, 13, 6]) { ell(ctx, 0, 0, rr * 1.2, rr); ctx.stroke(); }
        ctx.fillStyle = 'rgba(60,30,12,0.55)'; ell(ctx, 10, -6, 12, 8); ctx.fill();
      }
      ctx.restore();
    });
  }
  // fat eyes
  for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()), z = 3 + r() * 7; const px = cx + Math.cos(a) * d * rx * 0.95, py = cy + Math.sin(a) * d * ry * 0.95; ell(ctx, px, py, z, z * sq); ctx.fillStyle = 'rgba(255,218,110,0.8)'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,245,0.8)'; ell(ctx, px - z * 0.3, py - z * 0.3 * sq, z * 0.3, z * 0.18 * sq + 0.3); ctx.fill(); }
  // boiling bubbles
  if (boil > 0) {
    const nb = Math.round(14 * boil);
    for (let i = 0; i < nb; i++) {
      const ph = (t * (1.5 + r()) + r()) % 1, a = r() * TAU, d = Math.sqrt(r()) * 0.85, px = cx + Math.cos(a) * d * rx, py = cy + Math.sin(a) * d * ry, z = (4 + r() * 8) * Math.sin(ph * PI);
      if (z < 0.5) continue;
      ell(ctx, px, py, z, z * Math.max(sq, 0.5)); ctx.strokeStyle = 'rgba(255,245,210,0.9)'; ctx.lineWidth = 1.8; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, px - z * 0.35, py - z * 0.3 * sq, z * 0.25, z * 0.15 + 0.3); ctx.fill();
    }
  }
  ctx.restore();
}
function potLid(ctx, cx, cy, rx, ry, rot) {
  at(ctx, cx, cy, rot, 1, 1, () => {
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, PI); ctx.bezierCurveTo(rx * 0.7, -ry * 2.4, -rx * 0.7, -ry * 2.4, -rx, 0); ctx.closePath();
    outFill(ctx, lgr(ctx, -rx, 0, rx, 0, [[0, '#8a96a2'], [0.3, '#eef2f6'], [0.6, '#b9c3cd'], [1, '#66717c']]), 2.6);
    ell(ctx, 0, 0, rx, ry); ctx.strokeStyle = 'rgba(60,70,80,0.6)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(40,50,60,0.25)'; ell(ctx, rx * 0.35, -ry * 1.1, rx * 0.1, ry * 0.3, 0.4); ctx.fill();
    ctx.fillStyle = '#3a3330'; ctx.beginPath(); ctx.roundRect(-22, -ry * 1.85 - 22, 44, 22, 8); ctx.fill();
    rimLine(ctx, () => { ctx.moveTo(-rx * 0.8, -ry * 0.4); ctx.bezierCurveTo(-rx * 0.6, -ry * 1.6, -rx * 0.2, -ry * 1.8, 0, -ry * 1.8); }, 'rgba(255,255,255,0.9)', 4);
  });
}
function brothPot(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, view = o.view || 'side', mp = LP(x, y, 0, s), ret = {};
  if (view === 'top') {
    at(ctx, x, y, 0, s, s, () => {
      ctx.fillStyle = 'rgba(10,25,40,0.3)'; ell(ctx, 20, 22, 196, 196); ctx.fill();
      ell(ctx, 0, 0, 186, 186); outFill(ctx, lgr(ctx, -186, -186, 186, 186, [[0, '#f2f5f8'], [0.5, '#b7c1cb'], [1, '#6c7782']]), 3);
      ell(ctx, 0, 0, 168, 168); ctx.fillStyle = '#4a4e52'; ctx.fill();
      potContents(ctx, 0, 0, 162, 162, t, o, true);
      rimLine(ctx, () => ctx.ellipse(0, 0, 178, 178, 0, PI * 1.05, PI * 1.6), 'rgba(255,255,255,0.95)', 5);
      for (const sx of [-1, 1]) { ctx.strokeStyle = '#7d8894'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(sx * 200, 0, 22, sx > 0 ? -PI / 2 : PI / 2, sx > 0 ? PI / 2 : PI * 1.5); ctx.stroke(); }
    });
    ret.rim = mp(0, 0); ret.surface = mp(0, 0); ret.rimRx = 176 * s; ret.rimRy = 176 * s; ret.top = mp(0, 0);
    if (o.steam) NP.steamWisps(ctx, t, o.steamSeed ?? 3, ...mp(-150, -60), 300 * s, 320 * s, { n: 7, alpha: 0.5 * o.steam, w: 50 * s });
    return ret;
  }
  const RX = 176, RY = 40, HT = 250, lid = o.lid;
  at(ctx, x, y, 0, s, s, () => {
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(10,25,40,0.3)'; ell(ctx, 24, 4, 190, 22); ctx.fill();
    // handles (behind)
    for (const sx of [-1, 1]) { ctx.strokeStyle = '#5f6a75'; ctx.lineWidth = 13; ctx.beginPath(); ctx.ellipse(sx * 182, -HT + 50, 26, 18, 0, sx > 0 ? -PI * 0.5 : PI * 0.5, sx > 0 ? PI * 0.5 : PI * 1.5); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.stroke(); }
    // body
    ctx.beginPath(); ctx.moveTo(-RX, -HT); ctx.bezierCurveTo(-RX - 8, -HT * 0.6, -RX + 2, -30, -RX + 14, -8); ctx.quadraticCurveTo(0, 14, RX - 14, -8); ctx.bezierCurveTo(RX - 2, -30, RX + 8, -HT * 0.6, RX, -HT); ctx.closePath();
    outFill(ctx, lgr(ctx, -RX, 0, RX, 0, [[0, '#7f8b97'], [0.18, '#dfe5eb'], [0.3, '#f6f8fa'], [0.55, '#b4bec8'], [0.85, '#6e7884'], [1, '#56606a']]), 3);
    ctx.save(); ctx.clip();
    // vertical brushed streaks + soot + dents
    const r = rng(o.seed ?? 44);
    ctx.lineWidth = 2; for (let i = 0; i < 18; i++) { const sx = -RX + r() * RX * 2; ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(40,50,60,0.15)'; ctx.beginPath(); ctx.moveTo(sx, -HT); ctx.lineTo(sx + (r() - 0.5) * 6, 0); ctx.stroke(); }
    ctx.fillStyle = lgr(ctx, 0, -70, 0, 10, [[0, 'rgba(30,25,25,0)'], [1, 'rgba(30,25,25,0.7)']]); ctx.fillRect(-RX - 10, -80, RX * 2 + 20, 100);
    for (const [dx, dy, dr] of [[-80, -150, 26], [60, -90, 34], [110, -190, 18], [-20, -60, 20]]) {
      ctx.fillStyle = rgr(ctx, dx + dr * 0.3, dy + dr * 0.3, 1, dx, dy, dr, [[0, 'rgba(40,50,60,0.35)'], [1, 'rgba(40,50,60,0)']]); ell(ctx, dx, dy, dr, dr * 0.8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(dx, dy, dr * 0.8, dr * 0.65, 0, PI * 1.1, PI * 1.7); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-RX * 0.62, -HT, 30, HT);
    ctx.restore();
    // rim + inside
    ell(ctx, 0, -HT, RX + 6, RY + 4); ctx.fillStyle = lgr(ctx, -RX, 0, RX, 0, [[0, '#9aa5b0'], [0.3, '#f4f7fa'], [1, '#68737e']]); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
    ell(ctx, 0, -HT, RX - 4, RY - 3); ctx.fillStyle = '#3e4246'; ctx.fill();
    if (lid == null || lid > 0.02) potContents(ctx, 0, -HT + 12, RX - 10, RY - 8, t, o, false);
    rimLine(ctx, () => ctx.ellipse(0, -HT, RX + 4, RY + 2, 0, PI * 0.05, PI * 0.95), 'rgba(255,255,255,0.85)', 3.5);
    if (lid != null) { const k = clamp(lid), e = ease.inOut(k); potLid(ctx, lerp(0, 150, e), -HT - 4 - e * 230, RX + 10, RY + 6, -e * 0.45); }
  });
  ret.rim = mp(0, -HT); ret.surface = mp(0, -HT + 12); ret.rimRx = RX * s; ret.rimRy = RY * s; ret.top = mp(0, -HT); ret.base = mp(0, 0);
  if (lid != null) { const e = ease.inOut(clamp(lid)); ret.lid = mp(lerp(0, 150, e), -HT - 4 - e * 230 - RY * 1.85); }
  const stA = o.steam ?? 0; const open = lid == null ? 1 : clamp(lid * 2);
  if (stA > 0 && open > 0) NP.steamWisps(ctx, t, o.steamSeed ?? 3, ...mp(-RX * 0.8, -HT - 20), RX * 1.6 * s, 380 * s, { n: 7, alpha: 0.5 * stA * open, w: 50 * s });
  return ret;
}

// ================================================================ ladle (aluminium). cup at origin (r46), handle toward upper right
function ladle(ctx, x, y, s = 1, rot = 0, o = {}) {
  const fx = o.flip ? -1 : 1, mp = LP(x, y, rot, s, fx), fill = clamp(o.fill ?? 0);
  at(ctx, x, y, rot, s * fx, s, () => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,45,55,0.6)'; ctx.lineWidth = 13; ctx.beginPath(); ctx.moveTo(36, -10); ctx.quadraticCurveTo(160, -60, 300, -205); ctx.stroke();
    ctx.strokeStyle = lgr(ctx, 0, -100, 0, -60, [[0, '#eef2f6'], [1, '#8e99a4']]); ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(60, -24); ctx.quadraticCurveTo(160, -64, 280, -192); ctx.stroke();
    ctx.fillStyle = '#4a4440'; ctx.beginPath(); ctx.arc(300, -205, 8, 0, TAU); ctx.fill();
    // cup
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 18, 0, 0, PI, true); ctx.bezierCurveTo(-46, 40, 46, 40, 46, 0); ctx.closePath();
    ctx.beginPath(); ctx.moveTo(-46, 0); ctx.bezierCurveTo(-46, 44, 46, 44, 46, 0); ctx.ellipse(0, 0, 46, 18, 0, 0, PI, false); ctx.closePath();
    outFill(ctx, lgr(ctx, -46, 0, 46, 0, [[0, '#8e99a4'], [0.3, '#f2f5f8'], [1, '#5f6a75']]), 2.4);
    ell(ctx, 0, 0, 46, 18); ctx.fillStyle = '#5a636c'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    if (fill > 0) { ell(ctx, 0, 1 + (1 - fill) * 6, 42 * lerp(0.7, 1, fill), 15 * lerp(0.7, 1, fill)); ctx.fillStyle = rgr(ctx, -10, -4, 2, 0, 0, 44, [[0, '#ffe39a'], [1, '#d39236']]); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, -14, -3, 10, 2.5); ctx.fill(); }
    rimLine(ctx, () => ctx.ellipse(0, 0, 45, 17, 0, PI * 0.1, PI * 0.9), 'rgba(255,255,255,0.9)', 2.5);
  });
  return { cup: mp(0, 0), lip: mp(-46, 2), grip: mp(250, -170), end: mp(300, -205) };
}
// ---- clear golden broth stream from (x0,y0) to (x1,y1). o: w (14), k head 0..1, tail 0..1, splash, seed
function brothStream(ctx, x0, y0, x1, y1, t, o = {}) {
  const w = o.w ?? 14, k = clamp(o.k ?? 1), tail = clamp(o.tail ?? 0), r = rng(o.seed ?? 9);
  if (k <= tail) return;
  const cx = lerp(x0, x1, 0.55) + (o.bend ?? 0), cy = y0 - Math.abs(x1 - x0) * 0.05;
  const P = (u) => { const a = 1 - u; return [a * a * x0 + 2 * a * u * cx + u * u * x1, a * a * y0 + 2 * a * u * cy + u * u * y1]; };
  const N = 18, pts = [];
  for (let i = 0; i <= N; i++) { const u = lerp(tail, k, i / N); const [px, py] = P(u); pts.push([px + Math.sin(t * 20 + u * 12) * w * 0.12 * u, py]); }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  path(); ctx.strokeStyle = 'rgba(190,120,35,0.55)'; ctx.lineWidth = w * 1.15; ctx.stroke();
  path(); ctx.strokeStyle = 'rgba(240,180,80,0.85)'; ctx.lineWidth = w; ctx.stroke();
  path(); ctx.strokeStyle = 'rgba(255,228,150,0.9)'; ctx.lineWidth = w * 0.45; ctx.stroke();
  ctx.translate(-w * 0.22, 0); path(); ctx.strokeStyle = 'rgba(255,255,250,0.85)'; ctx.lineWidth = Math.max(1, w * 0.13); ctx.stroke(); ctx.translate(w * 0.22, 0);
  // sparkling fat droplets riding along / flying off
  for (let i = 0; i < (o.drops ?? 12); i++) {
    const u = lerp(tail, k, ((r() + t * (0.8 + r())) % 1)), [px, py] = P(u), off = (r() - 0.5) * w * 2.6, z = w * (0.12 + r() * 0.18);
    ctx.fillStyle = 'rgba(255,220,120,0.9)'; ell(ctx, px + off, py + (r() - 0.5) * w, z, z); ctx.fill();
    if (r() < 0.45) L.sparkle(ctx, px + off, py, w * 0.9, 0.5 + 0.5 * Math.sin(t * 9 + i * 2));
  }
  if (o.splash !== false && k > 0.97) {
    ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = Math.max(1.5, w * 0.18);
    const rr = w * (1.8 + 0.6 * Math.sin(t * 14)); ell(ctx, x1, y1, rr * 1.6, rr * 0.45); ctx.stroke();
    for (let i = 0; i < 7; i++) { const a = PI + (i + 0.5) / 7 * PI, ph = (t * 3 + i * 0.37) % 1, d = w * (1.2 + ph * 3); ctx.fillStyle = `rgba(255,225,140,${0.9 * (1 - ph)})`; ell(ctx, x1 + Math.cos(a) * d * 1.4, y1 + Math.sin(a) * d - ph * w * 2, w * 0.18, w * 0.22); ctx.fill(); }
  }
  ctx.restore();
}

// ================================================================ noodle basket (vợt trụng: bamboo-ring mesh strainer, long handle)
function noodleBasket(ctx, x, y, s = 1, rot = 0, o = {}) {
  const t = o.t || 0, fx = o.flip ? -1 : 1, fill = clamp(o.fill ?? 0.8), dip = clamp(o.dip || 0), shake = clamp(o.shake || 0), drip = clamp(o.drip || 0);
  const jx = Math.sin(t * 46) * 4 * shake, jy = Math.abs(Math.sin(t * 23)) * -6 * shake;
  const mp = LP(x, y, rot, s, fx);
  at(ctx, x, y, rot, s * fx, s, () => {
    ctx.translate(jx, jy); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // handle (bamboo)
    ctx.strokeStyle = 'rgba(70,45,20,0.7)'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(52, -42); ctx.lineTo(420, -170); ctx.stroke();
    ctx.strokeStyle = lgr(ctx, 0, -120, 0, -90, [[0, COL.bambooL], [1, COL.bamboo]]); ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = COL.bambooD; ctx.lineWidth = 3; for (const u of [0.3, 0.62, 0.9]) { const px = lerp(52, 420, u), py = lerp(-42, -170, u); ctx.beginPath(); ctx.moveTo(px - 2, py - 6); ctx.lineTo(px + 2, py + 6); ctx.stroke(); }
    // mesh body
    const body = new Path2D(); body.moveTo(-60, -40); body.bezierCurveTo(-62, 10, -36, 70, 0, 72); body.bezierCurveTo(36, 70, 62, 10, 60, -40); body.closePath();
    ctx.fillStyle = 'rgba(60,40,25,0.25)'; ctx.fill(body);
    ctx.save(); ctx.clip(body);
    if (fill > 0) { ctx.fillStyle = 'rgba(245,240,225,0.85)'; ctx.fillRect(-70, lerp(70, -40, fill), 140, 120); const r = rng(5); ctx.strokeStyle = 'rgba(255,255,250,0.95)'; ctx.lineWidth = 2.4; for (let i = 0; i < 12; i++) { const cy = lerp(60, -30, r()) ; if (cy < lerp(70, -40, fill)) continue; ctx.beginPath(); ctx.ellipse((r() - 0.5) * 80, cy, 18 + r() * 14, 5, r() - 0.5, 0, PI * 1.4); ctx.stroke(); } }
    if (dip > 0) { const ly = lerp(72, -42, dip); ctx.fillStyle = 'rgba(214,150,55,0.55)'; ctx.fillRect(-70, ly, 140, 130); ctx.strokeStyle = 'rgba(255,235,170,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-70, ly + Math.sin(t * 9) * 2); ctx.quadraticCurveTo(0, ly + 5, 70, ly - Math.sin(t * 9) * 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(80,60,40,0.55)'; ctx.lineWidth = 1.6;
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -44); ctx.quadraticCurveTo(i * 9 * 0.9, 30, i * 4, 76); ctx.stroke(); }
    for (let j = 0; j < 9; j++) { const yy = -36 + j * 13; ctx.beginPath(); ctx.ellipse(0, yy, 62 - j * j * 0.6, 7, 0, 0, PI); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-48, -40, 14, 100);
    ctx.restore();
    ctx.strokeStyle = 'rgba(60,40,25,0.7)'; ctx.lineWidth = 2; ctx.stroke(body);
    // bamboo ring mouth
    ell(ctx, 0, -40, 62, 16); ctx.strokeStyle = 'rgba(70,45,20,0.75)'; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = COL.bamboo; ctx.lineWidth = 6; ctx.stroke();
    if (fill > 0.3) { const r = rng(9); ctx.save(); ell(ctx, 0, -40, 58, 13); ctx.clip(); ctx.fillStyle = '#f6f1e2'; ctx.fillRect(-60, -56, 120, 30); ctx.strokeStyle = 'rgba(190,175,140,0.7)'; ctx.lineWidth = 1.5; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.ellipse((r() - 0.5) * 80, -40 + (r() - 0.5) * 16, 16 + r() * 12, 4, r() - 0.5, 0, PI * 1.3); ctx.stroke(); } ctx.restore(); }
    rimLine(ctx, () => ctx.ellipse(0, -40, 62, 16, 0, PI * 1.05, PI * 1.6), 'rgba(255,240,200,0.9)', 2.5);
    // drips + shake spray
    if (drip > 0 || shake > 0) {
      const r = rng(o.seed ?? 14), nd = Math.round(6 * Math.max(drip, shake));
      for (let i = 0; i < nd; i++) { const ph = (t * (1.3 + r()) + r()) % 1, sx = (r() - 0.5) * 50, yy = 70 + ph * ph * 160; ctx.fillStyle = `rgba(240,200,120,${0.85 * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(sx, yy, 3.2, 5, 0, 0, TAU); ctx.fill(); }
      if (shake > 0) for (let i = 0; i < 10; i++) { const a = r() * PI + PI * 0.05, ph = (t * 4 + r()) % 1, d = 70 + ph * 70; ctx.fillStyle = `rgba(255,235,180,${0.8 * (1 - ph) * shake})`; ell(ctx, Math.cos(a) * d, 20 + Math.sin(a) * d * 0.6, 3, 3); ctx.fill(); }
    }
  });
  const j = (px, py) => mp(px + jx, py + jy);
  return { mouth: j(0, -40), bottom: j(0, 72), grip: j(300, -128), end: j(420, -170) };
}

// ================================================================ porcelain spoon + chopsticks
function spoon(ctx, x, y, s = 1, rot = 0, o = {}) {
  const fx = o.flip ? -1 : 1, mp = LP(x, y, rot, s, fx), fill = clamp(o.fill || 0);
  at(ctx, x, y, rot, s * fx, s, () => {
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.bezierCurveTo(-40, -22, 18, -24, 30, -8); ctx.quadraticCurveTo(70, -12, 120, -30); ctx.quadraticCurveTo(126, -24, 120, -20); ctx.quadraticCurveTo(70, -2, 32, 6); ctx.bezierCurveTo(16, 24, -40, 22, -40, 0); ctx.closePath();
    outFill(ctx, lgr(ctx, 0, -24, 0, 24, [[0, '#ffffff'], [0.6, '#eef2f6'], [1, '#b9c6d4']]), 2);
    ell(ctx, -6, 0, 28, 13, -0.05); ctx.fillStyle = '#dfe6ee'; ctx.fill();
    if (fill > 0) { ell(ctx, -6, 1, 26 * fill, 11 * fill, -0.05); ctx.fillStyle = 'rgba(236,176,78,0.9)'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ell(ctx, -14, -3, 6, 1.6); ctx.fill(); }
    if (o.noodle) { ctx.strokeStyle = '#fbf7ea'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-6, 0, 18, 6, 0.1, 0, PI * 1.6); ctx.stroke(); }
    ctx.strokeStyle = PORC.blue; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(70, -14); ctx.quadraticCurveTo(90, -20, 108, -26); ctx.stroke();
    rimLine(ctx, () => { ctx.moveTo(-34, -6); ctx.bezierCurveTo(-30, -18, 10, -20, 26, -10); }, 'rgba(255,255,255,0.95)', 2.4);
  });
  return { bowl: mp(-6, 0), grip: mp(100, -20), end: mp(124, -26) };
}
function chopsticks(ctx, x, y, s = 1, rot = 0, o = {}) {
  const fx = o.flip ? -1 : 1, mp = LP(x, y, rot, s, fx), op = clamp(o.open ?? 0.1), Lc = o.len ?? 300, t = o.t || 0;
  const col = o.col || '#c99a5a', colD = o.colD || '#8a6232';
  at(ctx, x, y, rot, s * fx, s, () => {
    ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) {
      const ty = sgn * op * 10, by = sgn * (6 + op * 40);
      ctx.strokeStyle = 'rgba(50,30,15,0.6)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(Lc, by); ctx.stroke();
      ctx.strokeStyle = lgr(ctx, 0, ty - 4, 0, ty + 4, [[0, col], [1, colD]]); ctx.lineWidth = 5.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(Lc * 0.2, ty + (by - ty) * 0.2 - 1.5); ctx.lineTo(Lc * 0.95, by - 1.5); ctx.stroke();
    }
    // noodles hanging from the tips (in world-down after rotation is not tracked: they hang along local +y)
    const hang = o.hang || 0;
    if (hang > 0) {
      ctx.save(); ctx.rotate(-rot * fx);
      const n = o.strands ?? 7;
      for (let i = 0; i < n; i++) { const gx = (i - (n - 1) / 2) * 3, sw = Math.sin(t * 4 + i * 0.7) * 10; ctx.strokeStyle = 'rgba(190,175,140,0.55)'; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + sw * 0.3, hang * 0.35, gx + sw, hang * 0.7, gx + sw * 0.6 + (i - n / 2) * 4, hang); ctx.stroke(); ctx.strokeStyle = 'rgba(255,253,245,0.97)'; ctx.lineWidth = 2.8; ctx.stroke(); }
      ctx.restore();
    }
  });
  return { tips: mp(0, 0), grip: mp(Lc * 0.62, 0), end: mp(Lc, 0) };
}

// ================================================================ garnish plate (bean sprouts, chives, lime, chili, basil)
function garnishPlate(ctx, x, y, s = 1, o = {}) {
  const ryr = o.ryr ?? 0.45, mp = LP(x, y, 0, s);
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(10,25,40,0.28)'; ell(ctx, 16, 14, 170, 170 * ryr + 6); ctx.fill();
    ell(ctx, 0, 6, 166, 166 * ryr); ctx.fillStyle = '#c7d2de'; ctx.fill();
    ell(ctx, 0, 0, 166, 166 * ryr); outFill(ctx, lgr(ctx, -160, 0, 160, 0, [[0, '#ffffff'], [1, '#d6dee7']]), 2.4);
    ell(ctx, 0, 0, 150, 150 * ryr); ctx.strokeStyle = PORC.blue; ctx.lineWidth = 3; ctx.stroke();
    ell(ctx, 0, 2, 118, 118 * ryr); ctx.fillStyle = 'rgba(200,212,226,0.5)'; ctx.fill();
    NP.herb(ctx, 'basil', -70, -26 * ryr * 2, 0.9, -0.5); NP.herb(ctx, 'basil', -30, -40 * ryr * 2, 0.8, 0.3);
    beanSprouts(ctx, -40, 8, 1, 0, { n: 16, seed: 3, spread: 120, sq: 0.7 });
    chives(ctx, 60, -10, 1, -0.2, { n: 9, seed: 5, spread: 40, len: 60 });
    limeWedge(ctx, 64, 28, 1.05, 0.2); limeWedge(ctx, 100, 6, 0.95, -0.5);
    chiliSlices(ctx, 10, 34, 1.1, { n: 5, spread: 50, seed: 2 });
  });
  return { center: mp(0, 0), rim: mp(0, -166 * ryr) };
}

// ================================================================ HỦ TIẾU BOAT (vendor boat with blue tarp)
function hutieuBoat(ctx, x, y, s = 1, o = {}) {
  const part = o.part || 'all', Lh = 640, gun = 84, st = 112, bw = 146, dep = 24, deck = -42, t = o.t || 0;
  const base = o.hull || '#2c7a4a', paint = o.paint || '#f0c63a', trim = o.trim || '#c8462e';
  const B0 = ctx.getTransform();
  ctx.save(); boatXform(ctx, x, y, s, o);
  const m = mapper(ctx), Lc = (px, py) => { const d = m(px, py); return invApply(B0, d[0], d[1]); };
  const POT = [72, -22], STOVE_S = 0.25, POT_S = 0.2;
  const potBase = [POT[0], POT[1] - 196 * STOVE_S];
  const ret = {
    deck: Lc(0, deck), seat: Lc(-14, deck), stove: Lc(POT[0], POT[1]), pot: Lc(potBase[0], potBase[1]), potRim: Lc(potBase[0], potBase[1] - 250 * POT_S),
    potScale: POT_S * s * BK, potRx: 176 * POT_S * s * BK, potRy: 40 * POT_S * s * BK, bowls: Lc(-196, -96), tray: Lc(178, -96), basket: Lc(262, -100), bow: Lc(Lh / 2, -bw), stern: Lc(-Lh / 2, -st), gunwale: Lc(0, -gun), len: Lh * BK * s,
    tarp: Lc(0, -340), ladleRest: Lc(potBase[0] + 30, potBase[1] - 250 * POT_S - 10),
  };
  const tarpY = o.tarpY ?? -350;
  const pole = (px, top) => { ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(px, deck + 6); ctx.lineTo(px + 4, top); ctx.stroke(); ctx.strokeStyle = COL.bamboo; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = COL.bambooD; ctx.lineWidth = 2; for (let yy = deck - 50; yy > top; yy -= 70) { ctx.beginPath(); ctx.moveTo(px - 3, yy); ctx.lineTo(px + 6, yy); ctx.stroke(); } };
  if (part !== 'front') {
    innerGunwale(ctx, Lh, gun, st, bw, base);
    if (o.tarp !== false) {
      pole(-236, tarpY + 10); pole(244, tarpY + 18);
      // tarp: underside + scalloped front edge, saturated blue, hard sun on top
      const sag = Math.sin(t * 1.7) * 3;
      ctx.beginPath(); ctx.moveTo(-300, tarpY - 18); ctx.quadraticCurveTo(0, tarpY - 34, 300, tarpY - 8); ctx.lineTo(306, tarpY + 26); ctx.quadraticCurveTo(0, tarpY + 50 + sag, -306, tarpY + 18); ctx.closePath();
      outFill(ctx, lgr(ctx, 0, tarpY - 30, 0, tarpY + 50, [[0, '#4b9af0'], [0.35, '#2a74d2'], [1, '#174f9e']]), 2.4);
      ctx.fillStyle = '#123f80'; ctx.beginPath(); ctx.moveTo(-306, tarpY + 18); ctx.quadraticCurveTo(0, tarpY + 50 + sag, 306, tarpY + 26);
      for (let i = 12; i >= 0; i--) { const px = lerp(-306, 306, i / 12), py = lerp(tarpY + 18, tarpY + 26, i / 12) + Math.sin(i / 12 * PI) * (24 + sag); ctx.quadraticCurveTo(px + 25, py + 18, px, py + 6); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { const px = -300 + i * 100; ctx.beginPath(); ctx.moveTo(px, tarpY - 22 - (i === 3 ? 6 : 0)); ctx.lineTo(px + 6, tarpY + 36); ctx.stroke(); }
      rimLine(ctx, () => { ctx.moveTo(-296, tarpY - 18); ctx.quadraticCurveTo(0, tarpY - 34, 296, tarpY - 8); }, 'rgba(255,255,240,0.95)', 4);
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 2; for (const px of [-300, 300]) { ctx.beginPath(); ctx.moveTo(px, tarpY + 22); ctx.lineTo(px + (px < 0 ? 64 : -56), tarpY + 30); ctx.stroke(); }
    }
    // crates
    ctx.fillStyle = '#7a5434'; ctx.fillRect(-250, -82, 110, 42); ctx.fillRect(140, -80, 160, 40);
    ctx.strokeStyle = 'rgba(30,18,10,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(-250, -82, 110, 42); ctx.strokeRect(140, -80, 160, 40);
    // bowl stack (side view), on the stern crate
    const nb = o.bowls ?? 5;
    for (let i = 0; i < nb; i++) huTieuBowl(ctx, -196, -90 - i * 5, 0.13, { view: 'side', layers: 0, broth: 0, shadow: i === 0 });
    // topping tray on the bow crate
    ctx.save(); ctx.translate(178, -90);
    ctx.fillStyle = '#c3ccd5'; ctx.beginPath(); ctx.moveTo(-50, -4); ctx.lineTo(50, -4); ctx.lineTo(44, 8); ctx.lineTo(-44, 8); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
    ell(ctx, 0, -4, 50, 9); ctx.fillStyle = '#9aa5b0'; ctx.fill();
    porkSlice(ctx, -32, -8, 0.3, 0.2); porkSlice(ctx, -26, -11, 0.3, -0.2); shrimp(ctx, -6, -9, 0.3, 0.6); shrimp(ctx, 4, -7, 0.28, -0.4); liverSlice(ctx, 18, -7, 0.3, 0.3); quailEgg(ctx, 34, -8, 0.32, 0); quailEgg(ctx, 40, -4, 0.3, 0.4); chives(ctx, 0, -2, 0.35, 0, { n: 8, spread: 70 });
    ctx.restore();
    // rattan basket of dry noodle nests
    ctx.save(); ctx.translate(262, -86);
    ctx.fillStyle = '#b07a3a'; ctx.beginPath(); ctx.moveTo(-34, -14); ctx.lineTo(34, -14); ctx.lineTo(28, 12); ctx.lineTo(-28, 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(60,35,15,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(90,55,20,0.6)'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -14); ctx.lineTo(i * 8, 12); ctx.stroke(); }
    noodles(ctx, -12, -10, 0.22, { dry: true, seed: 3 }); noodles(ctx, 12, -12, 0.22, { dry: true, seed: 4 }); noodles(ctx, 0, -18, 0.2, { dry: true, seed: 5 });
    ctx.restore();
    // low charcoal stove (mostly hidden by the hull) + broth pot
    const stv = NP.charcoalStove(ctx, POT[0], POT[1], STOVE_S, { glow: o.glow ?? 0.9, t, grill: false, embers: false });
    void stv;
    brothPot(ctx, potBase[0], potBase[1], POT_S, { t, lid: o.lid, boil: o.boil ?? 0.6, seed: o.seed ?? 41 });
    if (o.ladle !== false) ladle(ctx, potBase[0] + 26, potBase[1] - 250 * POT_S + 2, 0.12, -0.35, { fill: 0 });
  }
  if (part !== 'back') {
    hullSide(ctx, { Lh, gun, st, bw, dep, base, paint, trim, eye: { panel: trim } });
    if (o.tarp !== false) { pole(-262, tarpY + 22); pole(266, tarpY + 30); }
    const sign = o.sign ?? 'HỦ TIẾU';
    if (sign) { ctx.fillStyle = '#fbf3dc'; rrect(ctx, -180, -78, 150, 30, 4); ctx.fill(); ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#b8302a'; ctx.font = 'bold 20px BodySansBold'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sign, -105, -62); }
  }
  ctx.restore();
  // steam above the pot (local space, after restore)
  if (part !== 'front' && (o.steam ?? 0.8) > 0) { const pr = ret.potRim, w = 180 * s * BK * POT_S * 2; NP.steamWisps(ctx, t, 5, pr[0] - w * 0.5, pr[1] - 360 * s, w, 360 * s, { n: 6, alpha: 0.55 * (o.steam ?? 0.8), w: 24 * s }); }
  return ret;
}

module.exports = { LP, invApply, toLocal, PORC, BROTH, porkSlice, shrimp, liverSlice, quailEgg, chives, beanSprouts, limeWedge, chiliSlices, garlicBits, toppingFall, noodles, huTieuBowl, brothPot, ladle, brothStream, noodleBasket, spoon, chopsticks, garnishPlate, hutieuBoat };
