'use strict';
// shotsA.js — "Nem nướng Cái Răng" shots 1..10 (0 – 30.6 s). 100 BPM grid: beat 0.6 s, bar 2.4 s.
// Each shot: sN(ctx, lt, p, T) paints the full opaque frame. render.js adds grade, vignette, flashes and grain.
const L = require('./lib');
const X = require('./text');
const NP = require('./nprops');
const { W, H, TAU, rng, clamp, lerp, ease, at, createCanvas } = L;
const { COL } = NP;
const PI = Math.PI;

// ---------------------------------------------------------------- beat helpers
const BEAT = 0.6;
const bphase = T => ((T / BEAT) % 1 + 1) % 1;
const bidx = T => Math.floor(T / BEAT + 1e-6);
const hitK = (T, d = 0.2) => { const u = bphase(T); return u < d ? 1 - u / d : 0; };
const cap = (ctx, T, s0, s1, vi, en, n) => X.caption(ctx, T, s0 + 0.15, s1 - 0.1, vi, en, { n });
const seg01 = (v, a, b) => clamp((v - a) / (b - a));
// NP drawers return DEVICE coords (mapper uses getTransform). Under L.cam we need them back in the current user space.
function unmap(ctx) {
  const m = ctx.getTransform(), det = m.a * m.d - m.b * m.c;
  return (q) => { const x = q[0] - m.e, y = q[1] - m.f; return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det]; };
}
function U(ctx, r) {
  const u = unmap(ctx), o = {};
  for (const k in r) o[k] = Array.isArray(r[k]) && r[k].length === 2 && typeof r[k][0] === 'number' ? u(r[k]) : r[k];
  return o;
}

// camera that never shows outside the 1080x1920 canvas (clamps the look-at point for the zoom + roll)
function cam(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  L.cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}

// ---------------------------------------------------------------- one-time caches (blur allowed only here)
const CACHE = {};
function cached(name, w, h, fn) {
  if (!CACHE[name]) { const c = createCanvas(w, h); fn(c.getContext('2d'), c); CACHE[name] = c; }
  return CACHE[name];
}
function blurred(name, w, h, blur, fn) {
  return cached(name, w, h, (x) => {
    const tmp = createCanvas(w, h); fn(tmp.getContext('2d'));
    x.filter = `blur(${blur}px)`; x.drawImage(tmp, 0, 0); x.filter = 'none';
  });
}

// dark out-of-focus nipa-palm frond (foreground framing), 800x800, stem from bottom-left corner
function frondSprite() {
  return blurred('frond', 800, 800, 10, (x) => {
    const r = rng(41);
    for (let f = 0; f < 3; f++) {
      const a0 = -0.5 - f * 0.32, len = 760 - f * 90;
      const sx = 40, sy = 790, ex = sx + Math.cos(a0) * len, ey = sy + Math.sin(a0) * len;
      const mx = (sx + ex) / 2 + 60, my = (sy + ey) / 2 + 40;
      x.strokeStyle = 'rgba(16,14,20,0.95)'; x.lineWidth = 12 - f * 2; x.lineCap = 'round';
      x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(mx, my, ex, ey); x.stroke();
      for (let i = 1; i < 26; i++) {
        const u = i / 26, px = (1 - u) * (1 - u) * sx + 2 * u * (1 - u) * mx + u * u * ex, py = (1 - u) * (1 - u) * sy + 2 * u * (1 - u) * my + u * u * ey;
        for (const sd of [-1, 1]) {
          const la = a0 + sd * (1.0 + r() * 0.2) + 0.25, ll = (150 - u * 80) * (0.8 + r() * 0.3);
          x.fillStyle = `rgba(${18 + f * 6},${20 + f * 5},${26 + f * 4},0.95)`;
          x.beginPath(); x.moveTo(px, py);
          x.quadraticCurveTo(px + Math.cos(la - 0.12) * ll * 0.6, py + Math.sin(la - 0.12) * ll * 0.6 - 6, px + Math.cos(la) * ll, py + Math.sin(la) * ll + 30);
          x.quadraticCurveTo(px + Math.cos(la + 0.12) * ll * 0.5, py + Math.sin(la + 0.12) * ll * 0.5 + 6, px, py);
          x.fill();
        }
      }
    }
  });
}
function frond(ctx, x, y, s, rot, alpha, flip) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(flip ? -s : s, s);
  ctx.drawImage(frondSprite(), -40, -790); ctx.restore();
}

// warm dark bokeh backdrop for macro shots (coals / grill)
function coalBg() {
  return blurred('coalBg', W, H, 26, (x) => {
    x.fillStyle = L.lgr ? '#000' : '#000';
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#120a10'); g.addColorStop(0.45, '#2a1210'); g.addColorStop(0.75, '#5a2412'); g.addColorStop(1, '#7a3414');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r = rng(77);
    for (let i = 0; i < 60; i++) {
      const px = r() * W, py = 200 + r() * 1300, rad = 20 + r() * 90, a = 0.15 + r() * 0.4;
      const warm = r();
      x.fillStyle = warm < 0.7 ? `rgba(255,${120 + (r() * 90 | 0)},50,${a})` : `rgba(120,170,200,${a * 0.5})`;
      x.beginPath(); x.arc(px, py, rad, 0, TAU); x.fill();
    }
    // smoke haze
    for (let i = 0; i < 14; i++) {
      const px = r() * W, py = 100 + r() * 900, rad = 200 + r() * 260;
      const gg = x.createRadialGradient(px, py, 0, px, py, rad);
      gg.addColorStop(0, 'rgba(120,90,90,0.18)'); gg.addColorStop(1, 'rgba(120,90,90,0)');
      x.fillStyle = gg; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
  });
}

// glowing coal bed (macro). Static lumps cached once into a sprite; per frame only flicker glows are added.
const COAL_H = 1000;
let COAL_GLOWS = null;
function coalSprite() {
  return cached('coalSprite', W + 200, COAL_H, (x) => {
    const r = rng(303), CW = W + 200;
    // hot glowing base between the lumps
    const g = x.createLinearGradient(0, 0, 0, COAL_H);
    g.addColorStop(0, 'rgba(150,40,10,0)'); g.addColorStop(0.06, 'rgba(200,60,14,1)'); g.addColorStop(0.4, '#ff8a2a'); g.addColorStop(1, '#ffb347');
    x.fillStyle = g; x.fillRect(0, 0, CW, COAL_H);
    const lumps = [];
    for (let row = 0; row < 13; row++) {
      const u = row / 12, sc = lerp(0.3, 1.9, Math.pow(u, 1.6)), yy = 20 + Math.pow(u, 1.25) * (COAL_H - 20);
      const n = Math.round(lerp(26, 6, u));
      for (let i = 0; i < n; i++) lumps.push({ x: (i + 0.5 + (r() - 0.5) * 0.8) / n * CW, y: yy + (r() - 0.5) * 30 * sc, sc: sc * (0.75 + r() * 0.5), r: r() });
    }
    lumps.sort((a, b) => a.y - b.y);
    COAL_GLOWS = [];
    for (const c of lumps) {
      const k = 7 + (c.r * 4 | 0), rx = 78 * c.sc, ry = 44 * c.sc, pts = [];
      for (let j = 0; j < k; j++) { const a = j / k * TAU + r() * 0.3, rr = 0.7 + r() * 0.4; pts.push([Math.cos(a) * rx * rr, Math.sin(a) * ry * rr - (Math.sin(a) < 0 ? ry * 0.35 : 0)]); }
      x.save(); x.translate(c.x, c.y);
      // underside glow halo
      const hg = x.createRadialGradient(0, ry * 0.4, 0, 0, ry * 0.4, rx * 1.3);
      hg.addColorStop(0, 'rgba(255,170,60,0.55)'); hg.addColorStop(1, 'rgba(255,120,30,0)');
      x.fillStyle = hg; x.fillRect(-rx * 1.4, -ry * 1.2, rx * 2.8, ry * 3);
      x.beginPath(); pts.forEach((q, j) => j ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath();
      const hot = c.r;
      const lg = x.createLinearGradient(0, -ry * 1.3, 0, ry);
      lg.addColorStop(0, hot > 0.6 ? '#b9a69a' : '#6e625e'); // ash-grey top
      lg.addColorStop(0.35, '#2e2220'); lg.addColorStop(0.8, '#1a0f0c');
      lg.addColorStop(1, hot > 0.4 ? '#ff7a2a' : '#7a2a10'); // glowing underside
      x.fillStyle = lg; x.fill();
      x.strokeStyle = `rgba(255,${(120 + hot * 100) | 0},50,${0.35 + hot * 0.5})`; x.lineWidth = 1.5 + 2.5 * c.sc; x.stroke();
      if (hot > 0.55) { // glowing cracks
        x.strokeStyle = 'rgba(255,200,90,0.85)'; x.lineWidth = 2 * c.sc;
        x.beginPath(); x.moveTo(pts[0][0] * 0.55, pts[0][1] * 0.3); x.lineTo(pts[2][0] * 0.2, 0); x.lineTo(pts[k - 2][0] * 0.5, pts[k - 2][1] * 0.4); x.stroke();
        COAL_GLOWS.push([c.x, c.y, rx, c.r * 50]);
      }
      x.restore();
    }
  });
}
function coalBed(ctx, t, y0, o = {}) {
  const heat = o.heat ?? 1, spr = coalSprite(), ox = -100 + Math.sin(t * 0.2) * 20;
  ctx.drawImage(spr, ox, y0 - 20);
  if (y0 - 20 + COAL_H < H) { ctx.fillStyle = '#ffb347'; ctx.fillRect(0, y0 - 20 + COAL_H, W, H); }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [gx, gy, gr, ph] of COAL_GLOWS) {
    const f = 0.5 + 0.5 * Math.sin(t * (2.2 + (ph % 3)) + ph) * Math.sin(t * 1.3 + ph * 0.7);
    if (f < 0.25) continue;
    const g = ctx.createRadialGradient(gx + ox, gy + y0 - 20, 0, gx + ox, gy + y0 - 20, gr * 1.1);
    g.addColorStop(0, `rgba(255,150,50,${0.35 * f * heat})`); g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g; ctx.fillRect(gx + ox - gr * 1.1, gy + y0 - 20 - gr * 1.1, gr * 2.2, gr * 2.2);
  }
  ctx.restore();
  L.glow(ctx, 540, y0 + 250, 900, 'rgba(255,110,30,0.5)', 0.45 * heat);
}

// grill wires across the frame (macro), perspective lines between yTop and yBot
function grillWires(ctx, yTop, yBot, n, t) {
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), y = lerp(yTop, yBot, u * u * 0.6 + u * 0.4), w = lerp(5, 14, u);
    ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(W + 20, y + 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,140,60,0.55)'; ctx.lineWidth = w * 0.3; ctx.beginPath(); ctx.moveTo(-20, y + w * 0.3); ctx.lineTo(W + 20, y + 6 + w * 0.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,200,0.35)'; ctx.lineWidth = w * 0.18; ctx.beginPath(); ctx.moveTo(-20, y - w * 0.3); ctx.lineTo(W + 20, y + 6 - w * 0.3); ctx.stroke();
  }
  ctx.restore();
}

// warm, out-of-focus boat-interior backdrop (s6, s10 use different ones)
function deckBg() {
  return blurred('deckBg', W, H, 22, (x) => {
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f2b183'); g.addColorStop(0.28, '#d98a72'); g.addColorStop(0.42, '#7a4a3a'); g.addColorStop(1, '#3a241c');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // sun hot spot + river band
    const sg = x.createRadialGradient(760, 420, 0, 760, 420, 520);
    sg.addColorStop(0, 'rgba(255,240,200,0.95)'); sg.addColorStop(0.3, 'rgba(255,190,120,0.6)'); sg.addColorStop(1, 'rgba(255,160,110,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, 1000);
    x.fillStyle = 'rgba(60,70,110,0.5)'; x.fillRect(0, 620, W, 140);
    // planks
    for (let i = 0; i < 9; i++) { const y = 800 + i * 140; x.fillStyle = i % 2 ? '#5a3826' : '#6a4430'; x.fillRect(0, y, W, 130); x.fillStyle = 'rgba(255,190,130,0.25)'; x.fillRect(0, y, W, 6); }
    // herbs / plates blobs
    const r = rng(9);
    for (let i = 0; i < 18; i++) { x.fillStyle = r() < 0.6 ? `rgba(${60 + r() * 40 | 0},${120 + r() * 60 | 0},${50 + r() * 30 | 0},0.9)` : 'rgba(240,235,225,0.9)'; x.beginPath(); x.arc(r() * W, 900 + r() * 500, 40 + r() * 70, 0, TAU); x.fill(); }
    for (let i = 0; i < 22; i++) { x.fillStyle = `rgba(255,${200 + r() * 50 | 0},150,${0.3 + r() * 0.5})`; x.beginPath(); x.arc(r() * W, r() * 760, 15 + r() * 40, 0, TAU); x.fill(); }
  });
}

// top-down wooden deck under the basin (s10), lightly blurred for depth
function boardBg() {
  return blurred('boardBg', W, H, 7, (x) => {
    for (let i = 0; i < 12; i++) {
      const y = i * 170 - 30;
      const g = x.createLinearGradient(0, y, 0, y + 165);
      g.addColorStop(0, i % 2 ? '#8a5e3c' : '#7a5034'); g.addColorStop(1, i % 2 ? '#6a4428' : '#5e3c24');
      x.fillStyle = g; x.fillRect(0, y, W, 165);
      x.fillStyle = 'rgba(30,16,8,0.7)'; x.fillRect(0, y + 165, W, 5);
      const r = rng(i + 3);
      x.strokeStyle = 'rgba(40,22,10,0.25)'; x.lineWidth = 2;
      for (let k = 0; k < 6; k++) { const yy = y + 20 + r() * 130; x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(300, yy + (r() - 0.5) * 20, 700, yy + (r() - 0.5) * 20, W, yy); x.stroke(); }
    }
    NP.herbBasket(x, 130, 330, 1.25, { ry: 0.8 });
    NP.nemPlate(x, 930, 1640, 1.3, { kind: 'nem', n: 4 });
    NP.sauceBowl(x, 160, 1720, 1.1, { fill: 0.85, ry: 0.8 });
    NP.lettuce(x, 900, 260, 2.2, 0.6); NP.basil(x, 1010, 380, 2, 2.4);
    // warm sun wash from top-right
    const sg = x.createRadialGradient(1000, 120, 0, 1000, 120, 1300);
    sg.addColorStop(0, 'rgba(255,190,120,0.45)'); sg.addColorStop(1, 'rgba(255,190,120,0)');
    x.globalCompositeOperation = 'screen'; x.fillStyle = sg; x.fillRect(0, 0, W, H);
  });
}

// birds for the drone wide
function birds(ctx, t, x0, y0, n, s) {
  ctx.save(); ctx.strokeStyle = 'rgba(40,24,34,0.85)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = rng(5);
  for (let i = 0; i < n; i++) {
    const bx = x0 + i * 70 * s + r() * 60 + t * 38, by = y0 + (r() - 0.5) * 120 * s + Math.sin(t * 1.2 + i) * 8;
    const fl = Math.sin(t * 9 + i * 1.7), w = (16 + r() * 8) * s;
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(bx - w, by - fl * w * 0.6); ctx.quadraticCurveTo(bx - w * 0.4, by - w * 0.15, bx, by); ctx.quadraticCurveTo(bx + w * 0.4, by - w * 0.15, bx + w, by - fl * w * 0.6); ctx.stroke();
  }
  ctx.restore();
}

// stylised cartoon aroma ribbon (Catmull-Rom through pts), drawn up to fraction k with a wobbling, tapering body
function aromaRibbon(ctx, t, pts, k, w, alpha = 0.8) {
  const sp = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < 12; j++) {
      const u = j / 12, u2 = u * u, u3 = u2 * u;
      sp.push([0, 1].map(d => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3)));
    }
  }
  sp.push(pts[pts.length - 1]);
  const N = sp.length, last = Math.floor((N - 1) * clamp(k));
  if (last < 2) return;
  ctx.save(); ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    for (let i = 1; i <= last; i++) {
      const u = i / (N - 1), a = sp[i - 1], b = sp[i];
      const wob = Math.sin(t * 4 - i * 0.35) * w * 0.25, nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1;
      const ww = w * (0.55 + 0.45 * Math.sin(u * Math.PI)) * (pass ? 0.35 : 1), head = Math.min(1, (last - i) / 8 + 0.3);
      ctx.strokeStyle = pass ? `rgba(255,250,240,${alpha * head})` : `rgba(255,215,170,${alpha * 0.45 * head})`;
      ctx.lineWidth = ww;
      ctx.beginPath(); ctx.moveTo(a[0] + nx / nl * wob, a[1] + ny / nl * wob);
      const wob2 = Math.sin(t * 4 - (i + 1) * 0.35) * w * 0.25; ctx.lineTo(b[0] + nx / nl * wob2, b[1] + ny / nl * wob2); ctx.stroke();
    }
  }
  ctx.restore();
}

const BOKEH_W = ['rgba(255,200,140,1)', 'rgba(255,170,110,1)', 'rgba(255,230,190,1)'];

// sleeve/arm options for Cô Út's forearms in close-ups
let ARM = null;
function armO(ctx, sc) {
  return { skin: NP.SKIN_U, wu: [19 * sc, 16 * sc], wf: [15 * sc, 12 * sc], sleeve: NP.weave(ctx, 24 * sc), sleeveTo: 1.6, cuff: COL.aobaD };
}

// ---------------------------------------------------------------- warm-up caches (module load)
(function warm() {
  const c = createCanvas(W, H), x = c.getContext('2d');
  NP.floatingMarket(x, 0, { zoom: 0.1 });
  NP.riverSide(x, 0, 0, {});
  NP.coUtBoat(x, 540, 1200, 0.5, { t: 0 });
  NP.herbBasket(x, 540, 900, 1, {});
  frondSprite(); coalBg(); deckBg(); boardBg(); coalSprite();
  void ARM;
})();

// =====================================================================================================================
// S1 0–3.6  Drone over Cái Răng at dawn, descending/pushing forward. Label.
function s1(ctx, lt, p, T) {
  const e = ease.inOut(p);
  let sunP = [560, 400];
  cam(ctx, 540, 960, 1.08 - 0.05 * e, -0.012 + 0.01 * e, () => {
    const r = NP.floatingMarket(ctx, T, { zoom: 0.04 + 0.42 * e, sun: 0.16 + 0.06 * p, mist: 0.85, panX: -4 + 7 * e });
    sunP = r.sun;
    L.flare(ctx, r.sun[0], r.sun[1], 0.8, 0.5);
    birds(ctx, T, -120, r.sun[1] - 160, 6, 1.1);
  });
  // drone breaking out of a cloud: soft haze fading away
  const fog = 1 - ease.out(clamp(lt / 1.4));
  if (fog > 0) {
    ctx.save(); ctx.globalAlpha = fog * 0.75;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,214,196,1)'); g.addColorStop(0.5, 'rgba(250,190,170,0.85)'); g.addColorStop(1, 'rgba(230,170,170,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  NP.mist(ctx, 1450 - lt * 60, 520, T, 0.35 * (1 - p * 0.6));
  void sunP;
  X.label(ctx, T, 0.3, 3.45, 'CHỢ NỔI CÁI RĂNG · 5:30 SÁNG', 'Cai Rang Floating Market · 5:30 AM', 250);
}

// S2 3.6–7.2  Tourist's xuồng glides between big ghe; boatman rows; tourist yawns, then takes a photo.
function s2(ctx, lt, p, T) {
  const pan = lt * 55, photo = lt > 1.8;
  cam(ctx, 540, 1150, 1.03 + 0.04 * ease.inOut(p), 0.004 * Math.sin(T * 0.9), () => {
    NP.riverSide(ctx, T, pan, {
      horizon: 960, sunX: 600, mist: 0.8, fgY: 1700,
      mid: (c, ox) => {
        NP.ghe(c, ox * 0.55 + 140, 1150, 0.27, { t: T, seed: 2 });
        NP.ghe(c, ox * 0.6 + 760, 1110, 0.21, { t: T, seed: 5, flip: true });
        NP.mist(c, 1090, 150, T + 7, 0.4);
        // the xuồng (camera tracks it)
        const bx = 420 + lt * 26, by = 1600, s = 0.8;
        NP.ripples(c, bx - 500, by - 20, 1000, 80, T, { alpha: 0.5, seed: 4 });
        NP.boatWake(c, bx - 540 * s, by, s, T, { dir: 1, len: 700, strength: 0.8 });
        const rx = U(c, NP.xuongBaLa(c, bx, by, s, { t: T, part: 'back' }));
        NP.boatman(c, bx - 375 * s, rx.deck[1], s, { pose: 'row', phase: T / (BEAT * 4), t: T });
        NP.tourist(c, rx.seat[0], rx.seat[1], s, { pose: photo ? 'photo' : 'yawn', t: T, look: photo ? 0.35 : -0.05 });
        NP.xuongBaLa(c, bx, by, s, { t: T, part: 'front' });
        // near ghe stern slice on the right (foreground, parallax 1.25)
        NP.ghe(c, ox * 1.25 + 1820, 1640, 0.86, { t: T, seed: 3, pole: false });
      },
    });
  });
  // phone shutter flash on the beat after he raises the phone
  const shot = T - 6.0;
  if (shot > 0 && shot < 0.25) { L.glow(ctx, 640, 1180, 160, 'rgba(255,255,255,1)', (1 - shot / 0.25) * 0.8); }
  frond(ctx, -60, 520, 0.9, 0.5, 0.95, false);
  L.bokeh(ctx, T, 21, 7, BOKEH_W, 0.22, 30, 90);
}

// S3 7.2–9.6  Cây bẹo close-up, backlit, produce silhouettes, rim light, flare, slow push (slow motion).
function s3(ctx, lt, p, T) {
  const ts = 7.2 + lt * 0.35, e = ease.inOut(p);
  const sx = 520, sy = 960;
  cam(ctx, 560, 820, 1.0 + 0.1 * e, 0.025 - 0.02 * e, () => {
    NP.dawnSky(ctx, -200, 1160, { t: ts });
    NP.sun(ctx, sx, sy, 2.6, { rays: 0.9, t: ts });
    NP.water(ctx, 1160, H + 200, ts, { sunX: sx });
    NP.ghe(ctx, 150, 1215, 0.2, { t: ts, seed: 6 });
    NP.ghe(ctx, 980, 1205, 0.17, { t: ts, seed: 1, flip: true });
    NP.mist(ctx, 1150, 160, ts, 0.85);
    // hero bẹo pole from below frame, produce hanging in front of the sun
    const tip = unmap(ctx)(NP.beoPole(ctx, 640, 2160, 2.5, { len: 600, angle: -0.07, bend: 0.06, t: ts, w: 26, seed: 2 }));
    // produce hanging from the cross-bar, spread out as silhouettes against the sun
    const bar = [[-230, 40], [230, 40]], sw = Math.sin(ts * 1.6) * 0.04;
    ctx.save(); ctx.translate(tip[0], tip[1] + 10); ctx.rotate(sw);
    ctx.strokeStyle = '#6a4a24'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bar[0][0], bar[0][1]); ctx.quadraticCurveTo(0, 20, bar[1][0], bar[1][1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,214,180,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(bar[0][0], bar[0][1]); ctx.moveTo(0, -10); ctx.lineTo(bar[1][0], bar[1][1]); ctx.stroke();
    const items = [['pineapple', -200, 150, 2.1], ['pumpkin', -70, 230, 2.0], ['watermelon', 75, 170, 2.0], ['sweetpotato', 205, 250, 2.0]];
    for (const [kind, ix, sl, isz] of items) {
      const swing = Math.sin(ts * 1.3 + ix) * 0.06;
      ctx.save(); ctx.translate(ix, 30); ctx.rotate(swing);
      ctx.strokeStyle = 'rgba(230,214,180,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sl - 40); ctx.stroke();
      NP.fruit(ctx, kind, 0, sl, isz, swing);
      ctx.restore();
    }
    ctx.restore();
    // backlight bloom wrapping the produce edges
    L.glow(ctx, sx, sy, 520, 'rgba(255,200,140,0.6)', 0.55);
    L.godRays(ctx, sx, sy, PI / 2, 2.6, 1500, 11, 'rgba(255,190,130,0.6)', 0.18, ts);
    L.flare(ctx, sx, sy, 1.2, 0.55 + 0.1 * Math.sin(lt * 2));
  });
  // dew / pollen drifting slowly in the backlight
  L.dust(ctx, ts, 31, 40, 0, 300, W, 1300, '255,225,180', 3.4, 0.7);
  for (let i = 0; i < 4; i++) { const ph = (lt * 0.5 + i * 0.27) % 1; L.sparkle(ctx, 420 + i * 90, 600 + i * 70, 0.35 + 0.3 * Math.sin(ph * PI), Math.sin(ph * PI) * 0.8); }
  frond(ctx, 1160, 1950, 1.0, -0.3, 0.9, true);
}

// S4 9.6–12.0  Smoke ribbon snakes across the water into the tourist's nose; he turns and sniffs.
function s4(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const fx = 730, fy = 1090, fs = 1.5;
  const sniffK = seg01(lt, 0.95, 1.25), wowK = seg01(lt, 1.85, 2.0);
  const expr = wowK > 0.5 ? 'wow' : sniffK > 0.5 ? 'sniff' : 'neutral';
  const turn = lerp(0.45, -0.35, ease.inOut(seg01(lt, 0.7, 1.3)));
  cam(ctx, 640, 900, 1.0 + 0.07 * e, 0, () => {
    let grill = [250, 1050];
    NP.riverSide(ctx, T, 20 + lt * 18, {
      horizon: 1040, sunX: 420, mist: 0.75, fgY: 9999,
      mid: (c, ox) => {
        const r = U(c, NP.coUtBoat(c, 250 + ox * 0.4, 1240, 0.3, { t: T, part: 'back', umbrella: true, cook: 0.6 }));
        NP.coUt(c, r.stool[0], r.stool[1], 0.3, { pose: 'fan', t: T, fan: T / BEAT });
        NP.coUtBoat(c, 250 + ox * 0.4, 1240, 0.3, { t: T, part: 'front' });
        grill = r.grill || grill;
      },
    });
    // smoke ribbon from her grill to his nose
    const nose = [fx + turn * 70 * fs * 0.8 - 10, fy + 70 * fs];
    const pts = [[grill[0], grill[1] - 10], [grill[0] + 30, grill[1] - 150], [grill[0] + 140, grill[1] - 230], [440, 1010], [nose[0] - 170, nose[1] - 10], [nose[0] - 70, nose[1] + 25], nose];
    NP.smoke(ctx, T, pts, { k: ease.out(seg01(lt, 0, 1.15)), w: 90, alpha: 0.5, warm: 0.8, seed: 13 });
    NP.touristFace(ctx, fx, fy, fs, { expr, t: T, turn });
    aromaRibbon(ctx, T, pts, ease.out(seg01(lt, 0, 1.15)), 34, 0.8 * (1 - 0.7 * wowK));
    // the last curl of smoke wraps in front of the face
    if (lt > 0.9) NP.smoke(ctx, T, [[nose[0] - 70, nose[1] + 40], [nose[0] - 20, nose[1] + 10], nose], { k: 1, w: 30, alpha: 0.4 * (1 - wowK * 0.6), warm: 0.9, seed: 8 });
    if (wowK > 0) { for (let i = 0; i < 3; i++) L.sparkle(ctx, fx - 140 + i * 140, fy - 230 - (i % 2) * 40, 0.5, wowK * 0.9); }
  });
  L.bokeh(ctx, T, 44, 6, BOKEH_W, 0.2, 40, 110);
  frond(ctx, -80, 2000, 1.1, 0.2, 0.9, false);
}

// S5 12.0–14.4  Slow-motion ember macro over the coals + title.
function s5(ctx, lt, p, T) {
  const ts = 12 + lt * 0.28, e = ease.inOut(p);
  ctx.drawImage(coalBg(), 0, 0);
  cam(ctx, 540, 1200 - e * 60, 1.06 + 0.05 * e, 0, () => {
    coalBed(ctx, ts, 1170, { heat: 1 });
    grillWires(ctx, 1010, 1180, 4, ts);
    // a raw skewer just laid on the grill, fat starting to bead
    NP.nemSkewer(ctx, 560, 1080, 3.4, { cook: 0.18 + 0.05 * p, rot: -0.05, t: ts, seed: 4, stick: 380 });
    NP.sizzle(ctx, ts * 3, 420, 1115, 2.4, { seed: 3, alpha: 0.8 });
    NP.sizzle(ctx, ts * 3, 720, 1110, 2.4, { seed: 9, alpha: 0.7 });
  });
  // big slow embers floating up past the lens
  NP.embers(ctx, ts, 11, 26, 0, 1100, W, 600, { alpha: 1, speed: 0.6, size: 3.2, rise: 1400 });
  NP.embers(ctx, ts, 12, 10, 0, 900, W, 700, { alpha: 0.6, speed: 0.45, size: 6, rise: 1200 });
  // heat shimmer streaks
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 5; i++) { const y = 940 - ((ts * 120 + i * 140) % 700); ctx.strokeStyle = `rgba(255,180,120,${0.06})`; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(300, y - 30, 700, y + 30, W, y); ctx.stroke(); }
  ctx.restore();
  X.title(ctx, T, 12.0, 14.35, 470, 'Grilled Pork Sausage Rolls', 'NEM NƯỚNG', 'CÁI RĂNG', 112, 86);
}

// S6 14.4–17.4  Hands shaping nem on sticks. ① Vo nem
function s6(ctx, lt, p, T) {
  const e = ease.inOut(p);
  ctx.drawImage(deckBg(), 0, 0);
  cam(ctx, 540, 960, 1.0 + 0.06 * e, -0.01 + 0.02 * e, () => {
    // banana leaf tray with shaped raw skewers
    at(ctx, 540, 1170, -0.04, 1, 1, () => {
      ctx.fillStyle = '#3f7a3c'; ctx.beginPath(); ctx.ellipse(0, 0, 520, 120, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,240,170,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-500, 0); ctx.lineTo(500, 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,70,30,0.5)'; ctx.lineWidth = 2;
      for (let i = -9; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(i * 52, 0); ctx.lineTo(i * 52 + 40, -100); ctx.moveTo(i * 52, 0); ctx.lineTo(i * 52 + 40, 100); ctx.stroke(); }
    });
    for (let i = 0; i < 4; i++) NP.nemSkewer(ctx, 340 + i * 130, 1150 + (i % 2) * 26, 1.35, { cook: 0, rot: 1.2 + i * 0.04, seed: 50 + i, stick: 320, drip: false });
    // pork paste bowl, left
    at(ctx, 150, 1050, 0, 1, 1, () => {
      ctx.fillStyle = '#e8ecef'; ctx.beginPath(); ctx.ellipse(0, 0, 150, 52, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = COL.nemRaw; ctx.beginPath(); ctx.ellipse(0, -6, 122, 38, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,230,0.5)'; for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.arc(Math.sin(i * 2.3) * 100, Math.cos(i * 1.7) * 26 - 6, 3, 0, TAU); ctx.fill(); }
    });
    // forearms (sleeves) behind the hands
    const pp = 0.15 + p * 0.85, len = lerp(70, 260, ease.inOut(pp)), sl = Math.sin(pp * TAU * 3 + T * 2) * 22, S = 2.1, cx = 550, cy = 790;
    const wl = [cx + (-len / 2 - 70 + sl) * S, cy + 6 * S], wr = [cx + (len / 2 + 70 - sl) * S, cy + 6 * S];
    const ao = armO(ctx, 5);
    NP.cArm(ctx, -320, 1600, -90, 1120, wl[0], wl[1], ao);
    NP.cArm(ctx, 1400, 1600, 1170, 1120, wr[0], wr[1], ao);
    NP.nemShaping(ctx, cx, cy, S, { p: pp, t: T });
    // glossy fat highlight sweeps with the hands
    L.glow(ctx, cx + sl * 2, cy - 30, 120, 'rgba(255,230,210,0.6)', 0.35);
  });
  L.bokeh(ctx, T, 61, 8, BOKEH_W, 0.25, 40, 120);
  cap(ctx, T, 14.4, 17.4, 'Vo nem', 'Shape the pork paste', 1);
}

// S7 17.4–21.0  Grill over the coals, Cô Út fans on every beat; smoke & sparks. ② Nướng than
function s7(ctx, lt, p, T) {
  const e = ease.inOut(p), hit = hitK(T, 0.25), fanPh = T / BEAT;
  let grill = [640, 1130];
  cam(ctx, 560, 1100, 1.0 + 0.08 * e, Math.sin(T * 1.3) * 0.003, () => {
    NP.riverSide(ctx, T, 30 + lt * 8, {
      horizon: 1000, sunX: 820, mist: 0.6, fgY: 1760,
      mid: (c, ox) => {
        const bx = 430 + ox * 0.05, by = 1830, s = 1.85;
        const r = U(c, NP.coUtBoat(c, bx, by, s, { t: T, part: 'back', umbrella: true, cook: lerp(0.35, 0.6, p), glow: 0.8 + 0.3 * hit, skewers: 5 }));
        grill = r.grill || grill;
        NP.coUt(c, r.stool[0], r.stool[1], s, { pose: 'fan', t: T, fan: fanPh });
        NP.coUtBoat(c, bx, by, s, { t: T, part: 'front' });
      },
    });
    // smoke pushed sideways by the fan, sparks burst on the beat
    const push = 0.5 + 0.5 * Math.cos(fanPh * TAU);
    NP.smoke(ctx, T, [[grill[0], grill[1] - 20], [grill[0] - 30 - push * 40, grill[1] - 200], [grill[0] - 120 - push * 80, grill[1] - 420], [grill[0] - 60, grill[1] - 700], [grill[0] + 80, grill[1] - 1000]], { k: 1, w: 70, alpha: 0.6, warm: 0.85, seed: 5 });
    NP.embers(ctx, T, 70 + bidx(T), Math.round(6 + 16 * hit), grill[0] - 160, grill[1] - 40, 320, 40, { alpha: 1, speed: 1.4, size: 2.2, rise: 380 });
    NP.embers(ctx, T, 71, 8, grill[0] - 140, grill[1] - 30, 280, 30, { alpha: 0.8, speed: 0.9, size: 1.8, rise: 300 });
    L.glow(ctx, grill[0], grill[1], 300, 'rgba(255,130,50,1)', 0.18 + 0.2 * hit);
  });
  L.bokeh(ctx, T, 72, 6, BOKEH_W, 0.2, 40, 110);
  cap(ctx, T, 17.4, 21.0, 'Nướng than', 'Charcoal grill', 2);
}

// S8 21.0–24.0  Skewers flipped with tongs on the beat, caramelising, fat-drip flare. ③ Lật đều tay
function s8(ctx, lt, p, T) {
  const e = ease.inOut(p), cook = lerp(0.55, 0.95, p);
  const u = bphase(T), fu = clamp(u / 0.32), flipA = PI * ease.inOut(fu), side = bidx(T) % 2;
  const lift = Math.sin(flipA) * 70, sy = Math.max(0.18, Math.abs(Math.cos(flipA)));
  ctx.drawImage(coalBg(), 0, 0);
  cam(ctx, 540, 1060, 1.02 + 0.05 * e, -0.015 + 0.02 * e, () => {
    coalBed(ctx, T, 1220, { heat: 0.9 });
    grillWires(ctx, 900, 1250, 5, T);
    // neighbours (behind / in front)
    NP.nemSkewer(ctx, 470, 880, 2.1, { cook: cook - 0.05, rot: 0.03, t: T, seed: 7, stick: 380 });
    NP.nemSkewer(ctx, 600, 1240, 2.7, { cook: cook + 0.02, rot: -0.04, t: T, seed: 8, stick: 420 });
    // hero skewer being turned
    const hx = 540, hy = 1060 - lift;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.06); ctx.scale(1, sy);
    NP.nemSkewer(ctx, 0, 0, 3.0, { cook: side ? cook - 0.08 : cook, t: T, seed: side ? 12 : 13, stick: 440, drip: false });
    ctx.restore();
    if (fu > 0.85 && fu < 1) NP.sizzle(ctx, T * 2, hx, 1090, 2.4, { seed: 4 });
    NP.sizzle(ctx, T, hx - 150, 1090, 2, { seed: 6, alpha: 0.7 });
    NP.steam(ctx, T, 81, hx - 250, 1020, 500, 600, { n: 5, alpha: 0.35, w: 22 });
    // fat drip → flare when it hits the coals (every 2 beats)
    const du = ((T / (BEAT * 2)) + 0.4) % 1, dx = hx - 90;
    if (du < 0.55) { const dy = 1110 + du * du * 900; ctx.fillStyle = 'rgba(255,220,140,0.95)'; ctx.beginPath(); ctx.ellipse(dx, dy, 8, 12, 0, 0, TAU); ctx.fill(); }
    else { const k = clamp((du - 0.55) / 0.25); L.flare(ctx, dx, 1380, 0.8, (1 - k) * 0.9); NP.embers(ctx, T, 90 + Math.floor(T / (BEAT * 2)), 10, dx - 60, 1330, 120, 30, { alpha: 1 - k, speed: 2, rise: 260 }); }
    // tongs from the upper right gripping the meat end
    const tip = [hx + 210, hy - 6], hinge = [960, 600 + lift * 0.3];
    const ang = Math.atan2(tip[1] - hinge[1], tip[0] - hinge[0]), dist = Math.hypot(tip[0] - hinge[0], tip[1] - hinge[1]);
    const ao = armO(ctx, 3.6);
    NP.cArm(ctx, 1300, 160, 1180, 420, hinge[0] + 30, hinge[1] - 30, ao);
    NP.tongs(ctx, hinge[0], hinge[1], dist / 240, ang, { open: fu > 0 && fu < 1 ? 0.08 : 0.3 });
    NP.cHand(ctx, hinge[0] + 40, hinge[1] - 40, 1.25, ang + 0.2, { kind: 'grip', flip: true });
  });
  NP.embers(ctx, T, 83, 14, 0, 1200, W, 300, { alpha: 0.9, speed: 1, size: 2.4, rise: 900 });
  cap(ctx, T, 21.0, 24.0, 'Lật đều tay', 'Turn till caramelized', 3);
}

// S9 24.0–27.6  Cô Út hooks the xuồng with a bamboo pole — boats bump. "Ăn nem hông con?"
function s9(ctx, lt, p, T) {
  const reachK = ease.inOut(seg01(lt, 0.2, 1.3));
  const pullK = ease.in2 ? ease.in2(seg01(lt, 1.35, 2.4)) : ease.inOut(seg01(lt, 1.35, 2.4));
  const bumpT = lt - 2.4, bump = bumpT > 0 ? Math.exp(-bumpT * 5) * Math.sin(bumpT * 26) : 0;
  const shake = bumpT > 0 ? Math.exp(-bumpT * 6) : 0;
  cam(ctx, 610 + Math.sin(T * 60) * 6 * shake, 1150 + Math.cos(T * 53) * 6 * shake, 1.45 + 0.06 * ease.inOut(p), 0, () => {
    NP.riverSide(ctx, T, lt * 10, {
      horizon: 900, sunX: 560, mist: 0.7, fgY: 1560,
      mid: (c, ox) => {
        NP.ghe(c, ox * 0.5 + 900, 1010, 0.18, { t: T, seed: 4, flip: true });
        // Cô Út's boat (left, slightly farther)
        const cs = 0.42, cbx = 330, cby = 1215;
        const r = U(c, NP.coUtBoat(c, cbx, cby, cs, { t: T, part: 'back', umbrella: true, cook: 0.9, sway: bump * 0.012 }));
        // tourist's xuồng drifts in from the right, flipped (bow left), boatman at stern
        const xs = 0.5, xbx = lerp(940, 860, pullK) + bump * 10, xby = 1300;
        const tgt = U(c, NP.xuongBaLa(c, xbx, xby, xs, { t: T, part: 'back', flip: true, sway: -bump * 0.02 }));
        // pole from Cô Út's hands to the xuồng's bow post
        const bowP = tgt.bow, base = [r.stool[0] + 24 * 1.26 * cs, r.stool[1] - 34 * 1.26 * cs];
        const dxp = bowP[0] - base[0], dyp = bowP[1] - base[1];
        const want = Math.hypot(dxp, dyp) / cs, ang = Math.atan2(dxp, -dyp);
        const poleLen = lerp(500, want, reachK), poleAng = lerp(0.6, ang, reachK);
        NP.coUt(c, r.stool[0], r.stool[1], cs, { pose: 'pole', poleAngle: poleAng, poleLen, t: T, expr: lt > 1.4 ? 'laugh' : 'smile' });
        NP.coUtBoat(c, cbx, cby, cs, { t: T, part: 'front', sway: bump * 0.012 });
        NP.boatman(c, xbx + 375 * xs, tgt.deck[1], xs, { pose: lt > 2.5 ? 'nod' : 'row', phase: T / (BEAT * 4), t: T, flip: true });
        NP.tourist(c, tgt.seat[0], tgt.seat[1], xs, { pose: lt > 2.5 ? 'point' : 'sit', t: T, look: -0.6, expr: lt > 2.5 ? 'wow' : 'smile', flip: true });
        NP.xuongBaLa(c, xbx, xby, xs, { t: T, part: 'front', flip: true, sway: -bump * 0.02 });
        NP.boatWake(c, xbx + 300 * xs, xby, xs, T, { dir: -1, len: 400, strength: 0.6 * (1 - pullK * 0.5) });
        if (bumpT > 0 && bumpT < 0.6) NP.splash(c, (r.bow[0] + tgt.bow[0]) / 2, xby - 10, 0.6, bumpT / 0.6, { seed: 3 });
      },
    });
  });
  if (bumpT > 0 && bumpT < 0.35) L.glow(ctx, 600, 1150, 200, 'rgba(255,240,210,1)', (1 - bumpT / 0.35) * 0.4);
  frond(ctx, 1150, 260, 0.85, 2.6, 0.9, true);
  L.bokeh(ctx, T, 93, 6, BOKEH_W, 0.2, 30, 90);
  X.line(ctx, T, 24.15, 27.5, '"Ăn nem hông con?"', '"Want some nem?"');
}

// S10 27.6–30.6  Rice paper dipped in water, turning translucent. ④ Bánh tráng
function s10(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const down = ease.inOut(seg01(lt, 0.25, 0.95)), up = ease.inOut(seg01(lt, 1.35, 2.1));
  const inWater = down > 0.98 && up < 0.02;
  const wet = ease.out(seg01(lt, 0.9, 2.3));
  const bx = 540, by = 1060, bs = 2.15;
  // paper path: above basin → into water → lifted toward camera
  const py = lerp(lerp(640, by - 10, down), 760, up), pry = lerp(lerp(0.62, 0.42, down), 0.7, up), prot = lerp(-0.12, 0.0, down) + up * 0.08;
  const pscale = lerp(lerp(1.75, 1.95, down), 2.05, up);
  ctx.drawImage(boardBg(), 0, 0);
  cam(ctx, 540, 1000, 1.0 + 0.06 * e, -0.01 + 0.015 * e, () => {
    const dipK = clamp(seg01(lt, 0.8, 1.0) * (1 - seg01(lt, 2.4, 3.0))) + (up > 0 ? 0.5 * (1 - seg01(lt, 2.1, 2.9)) : 0);
    NP.waterBasin(ctx, bx, by, bs, { t: T, dip: clamp(dipK), ry: 0.45 });
    // paper
    const drawPaper = () => NP.ricePaper(ctx, bx, py, pscale, { wet, ry: pry, rot: prot });
    if (down > 0.5 && up < 0.5) {
      // submerged: under a tinted water film
      ctx.save(); ctx.beginPath(); ctx.ellipse(bx, by + 3 * bs, (210 - 14) * bs, (210 - 14) * bs * 0.45, 0, 0, TAU); ctx.clip();
      drawPaper();
      ctx.fillStyle = 'rgba(120,110,150,0.28)'; ctx.fillRect(0, by - 300, W, 600);
      ctx.restore();
      NP.ripples(ctx, bx - 300, by - 60, 600, 120, T, { alpha: 0.6, seed: 9 });
    } else drawPaper();
    // drips from the lifted wet sheet
    if (up > 0.3) {
      const r = rng(17);
      for (let i = 0; i < 9; i++) {
        const ph = (lt * 1.4 + r()) % 1, dx = bx + (r() - 0.5) * 520, y0 = py + 170 * pscale * pry * (0.7 + r() * 0.3);
        const dy = y0 + ph * ph * 380;
        if (dy < by - 10) { ctx.fillStyle = `rgba(255,235,210,${0.8 * (1 - ph * 0.5)})`; ctx.beginPath(); ctx.ellipse(dx, dy, 5, 9, 0, 0, TAU); ctx.fill(); }
      }
      // gloss sheen sweeping across the wet sheet
      const sw = (lt - 1.6) * 600;
      ctx.save(); ctx.beginPath(); ctx.ellipse(bx, py, 170 * pscale, 170 * pscale * pry, prot, 0, TAU); ctx.clip();
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createLinearGradient(bx - 500 + sw, 0, bx - 300 + sw, 0);
      g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(0.5, 'rgba(255,240,220,0.35)'); g.addColorStop(1, 'rgba(255,240,220,0)');
      ctx.fillStyle = g; ctx.fillRect(0, py - 400, W, 800); ctx.restore();
    }
    // hands pinching the edge, arms from the top corners
    const R = 170 * pscale, ca = Math.cos(prot), sa = Math.sin(prot);
    const eL = [bx - R * ca * 0.97, py - R * sa * 0.97], eR = [bx + R * ca * 0.97, py + R * sa * 0.97];
    const ao = armO(ctx, 3.8);
    NP.cArm(ctx, -160, -120, -40, 300, eL[0] - 60, eL[1] - 40, ao);
    NP.cArm(ctx, 1240, -120, 1120, 300, eR[0] + 60, eR[1] - 40, ao);
    NP.cHand(ctx, eL[0] - 70, eL[1] - 40, 1.3, 0.55, { kind: 'pinch', flip: false });
    NP.cHand(ctx, eR[0] + 70, eR[1] - 40, 1.3, PI - 0.55, { kind: 'pinch', flip: true });
  });
  L.glow(ctx, 900, 200, 600, 'rgba(255,190,120,1)', 0.18);
  cap(ctx, T, 27.6, 30.6, 'Bánh tráng', 'Soften the rice paper', 4);
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8, s9, s10 };
