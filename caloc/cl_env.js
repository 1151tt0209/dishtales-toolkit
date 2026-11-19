// =====================================================================================================
// cl_env.js — moonlit FLOOD-SEASON FIELD at night (Cá lóc nướng trui). 1080×1920, all drawers deterministic in (t, opts).
// -----------------------------------------------------------------------------------------------------
// WORLD / PROJECTION (shared by floodField, dikeScene, fieldWaterClose)
//   Pinhole camera over a flat ground/water plane. World units = px at depth Z = F = 1000 (scale F/Z).
//   proj(hz, camH, F, camX, cx) -> P with P.y(Z) (screen y of the plane at depth Z), P.s(Z) = F/Z (sprite/person scale),
//   P.x(X, Z), P.Zat(y) (depth of plane point at screen y). A person of scale s standing ON the plane at depth Z has
//   feet at P.y(Z); people knee-deep in the water: waterline at P.y(Z), feet origin ≈ waterline + 120*s.
//   Person heights at s=1 (for reference): Chú Ba ≈ 500 (eyes ≈ −456 standing, ≈ −460 wading), tourist standing ≈ 516 (eyes −462).
//
// NIGHT  palette object (sky, water, rice, silhouettes, rim, mud, straw, fire, firefly colours).
//
// nightSky(ctx, y0, y1, {t, moon:[x,y], moonS=1, clouds=6, stars=true, starA=1, panX, seed, x0, w})
//   Indigo gradient, star field (+twinkling stars), moon glow + pale-gold disc (radius 92*moonS), thin silver clouds.
//   -> {moon, moonR}
//
// floodWater(ctx, y0, y1, t, {moonX, panX, glitter=130, ripples=90, fireAt:[x,y], fire 0..1, x0, w, colW})
//   Water sheet from the horizon y0 to y1: sky reflection gradient, moon path + glitter, ripples, warm fire glow + its
//   reflection streak (fireAt in the same coords). Rice is drawn separately (riceRows) so objects can sit between rows.
//
// riceRows(ctx, t, P, {zNear, zFar, rice 0..1 (tip height), camZ, seed, hk height factor, moonSide 1|-1})
//   Rows of young rice tufts poking out of the water, perspective-correct for projection P (single batched paths).
//
// fireflies(ctx, t, {n=30, x0, y0, w, h, seed, near 0..1 (bigger, bokeh-ish), size=1, a=1})
//   Green-yellow blinking, drifting dots with glow. Deterministic in t.
//
// palmSil(ctx, x, y, s, {v 0..3, flip, t})   coconut palm silhouette with blue moon rim; origin = trunk base; ≈720*s tall.
// stiltHut(ctx, x, y, s, {lamp 0..1, t, reflect=0.3, flip})  thatched chòi on stilts; origin = waterline centre;
//   ≈470*s tall, ±215*s wide. -> {door, lamp, deck}
// treeLine(ctx, y, s, {panX, x0, w, reflect=0.35, kind:'far'|'near'})  distant palm/bamboo line sitting on y.
// torchBeam(ctx, from, to, {k=1, w0=10, w1=120, col='255,236,190', pool=true, t, motes=18})  light cone + pool on water.
// distantTorch(ctx, x, y, s, t, {reflect=true})  tiny orange torch light (s1) with glow + reflection streak.
// xuongMoored(ctx, x, y, s, {t, flip, pole=true, night=0.42, part:'all'|'back'|'front', bob=1, seed})  NP xuồng ba lá tied to a bamboo pole, lit for night,
//   hull clipped at the waterline + reflection; origin = waterline (as NP.xuongBaLa, length 1100*s). -> NP anchors (LOCAL; .seat = seated-person origin)
//   Seat someone IN the boat: draw part:'back', then the person at ret.seat (seated pose), then part:'front', pole:false.
//
// floodField(ctx, t, o)   FULL-FRAME wide moonlit field. Used by s1 (drone, high 1→0), s2, s15–18, s21 (alt), s22.
//   o: panX (camera X, world px), camZ (forward travel, drone glide), horizon=900, high 0..1 (drone height: horizon rises,
//      camera climbs), cam {zoom,cx,cy}, moon [x,y], moonS, rice=1,
//      hut {X,Z,s,lamp}|null, palms [[X,s,v],...]|false (planted on the dike), dike {Z|y, X0, X1, h=45, depth=150}|null,
//      xuong {x,y,s,flip}|null (screen spec, origin = waterline), torch [x,y]|null (distant torch light),
//      fireAt [x,y], fire 0..1 (warm light on water/rice/dike), fireflies=30, mid(ctx, ret) drawn at depth o.midZ
//      (default: in front of everything except fireflies).
//   -> {horizon, moon, P, ground(X,Z)->{x,y,s}, dikeY(x) (front top edge y), dike {front, top, back, Z}, hut, xuong, camXY}
//
// dikeScene(ctx, t, {view:'wide'|'close'|'ground', fireAt, fire 0..1, moon, moonS, panX, mid(ctx,ret), front=true,
//                    tray=true, straw=true})
//   The bonfire spot ON the dike top: moonlit mud ground with straw scraps, worn path, footprints, grass edge against the
//   flooded field behind (rice, hut, tree line, moon). Fire itself is NOT drawn here (cl_fx); only its light.
//   -> {fire:[x,y] (fire base), fireS (scale there), tray:[x,y], trayS, sit:[[x,y,s],[x,y,s]] (seated-person origins
//       left/right of the fire, scale s), horizon, moon, P, ground(X,Z), edgeY}
//   Views: wide (fire base ≈ (540,1393), s≈1.11), close (≈(540,1441), s≈1.85), ground (low hero, ≈(540,1542), s≈2.5).
//
// fieldWaterClose(ctx, t, {horizon=820, camH=70, panX, moon, moonS, rice=1, zNear=150, beam {from,to,k,w0,w1},
//                          fireAt, fire, xuong, hut, mid(ctx,ret), frontStalks=true, fireflies=16})
//   Low camera at the water surface: big rice stalks framing the foreground, torch beam, waterline helper.
//   -> {horizon, moon, P, wl(s) (screen waterline y for a person of scale s), feet(s, depth=120) (feet origin y),
//       sOf(y) (scale for a waterline at y), ground(X,Z)}
//
// nightLit(ctx, fn, {box:[x0,y0,x1,y1] LOCAL, night=0.38, moon:[dx,dy] (direction TO the moon, default up-right),
//                    rim=1, rimW=4 (local px), rimCol, fire:{x,y,k,r} LOCAL, waterline (LOCAL y), sub=0.22,
//                    reflect=0 (0..1), ring:{x,w,t}})
//   Draws fn(ctx2) into a pooled offscreen layer, then: cool night tint, true RIM light (alpha-edge) toward the moon,
//   warm fire tint + fire-side rim, waterline (part below fades to a teal ghost), mirrored wobbly reflection, ripple
//   ring. Returns fn's return value. Used by cl_chars for every character and by xuongMoored. Nesting ok (3 levels).
//   fn draws into a BOX-SIZED buffer (transform offset by the box origin), so any DEVICE coords fn computes must be
//   converted with ctx2.getTransform() inside fn (see touristNight / xuongMoored).
//
// CACHING (perf): nightSky base (gradient, stars, haze, moon), floodWater base (gradient + streaks) and the far rice rows
//   (scale < 1.2) are cached as full-width layers keyed by params + transform (LRU). A moving panX / camera re-renders
//   them each frame (still < 60 ms per frame); a skewed transform bypasses the cache. riceRows o.cache:false disables it.
// =====================================================================================================
const L = require('./lib');
const NP = require('./nprops');
const { Path2D } = require('@napi-rs/canvas');
const { W, H, TAU, rng, clamp, lerp, ease, createCanvas } = L;
const { mixc, rgba, lgr, rgr, ell } = NP;
const PI = Math.PI;
const pmod = (a, m) => ((a % m) + m) % m;
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

const NIGHT = {
  sky: ['#070b26', '#111c48', '#213670', '#3d5c95', '#6283b3'],
  moon: '#fff6dc', moonEdge: '#efd59a', moonGlow: '255,228,170',
  cloud: '150,170,215', cloudLit: '245,238,215',
  water: ['#6a88b4', '#35527f', '#1b2e57', '#0e1a38'],
  rice: '#14302a', riceLit: '#4f9068', riceTip: '#aee3bf',
  sil: '#0a1426', silMid: '#16243e', rim: '#a6c8ff', rimRGB: '166,200,255',
  far: '#1e3156', near: '#0e1b33',
  mud: '#454d6a', mudD: '#1b1d2a', path: '#5d6379', straw: '#d1ad62', strawD: '#86683a',
  fire: '#ff9a3c', fireHot: '#ffd27a', fireRGB: '255,140,60', tint: '#15234d',
  firefly: '#e2ff7a', fireflyRGB: '190,255,90',
};

// ------------------------------------------------------------------------------------------- helpers
function canvas(w, h) { const c = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); return [c, c.getContext('2d')]; }
function proj(hz, camH, F = 1000, camX = 0, cx = W / 2) {
  return { hz, camH, F, camX, cx, y: (Z) => hz + camH * F / Z, s: (Z) => F / Z, x: (X, Z) => cx + (X - camX) * F / Z, Zat: (y) => camH * F / Math.max(0.5, y - hz) };
}
function devToLocal(B0, v) {
  const inv = B0.inverse();
  const f = (p) => [inv.a * p[0] + inv.c * p[1] + inv.e, inv.b * p[0] + inv.d * p[1] + inv.f];
  const walk = (o) => {
    if (Array.isArray(o)) { if (o.length === 2 && typeof o[0] === 'number' && typeof o[1] === 'number') return f(o); return o.map(walk); }
    if (o && typeof o === 'object') { const r = {}; for (const k in o) r[k] = (k === 'len' || k === 's') ? o[k] : walk(o[k]); return r; }
    return o;
  };
  return walk(v);
}
// rim on a sprite canvas: pixels whose neighbour toward the light (lx,ly) is transparent get rim colour
function rimify(c, lx, ly, col, a = 1) {
  const [t, x] = canvas(c.width, c.height);
  x.drawImage(c, 0, 0); x.globalCompositeOperation = 'destination-out'; x.drawImage(c, -lx, -ly);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  const cx = c.getContext('2d'); cx.save(); cx.globalAlpha = a; cx.globalCompositeOperation = 'source-atop'; cx.drawImage(t, 0, 0); cx.restore();
}
const _mips = new WeakMap();
function halfOf(c) { let h = _mips.get(c); if (!h) { const [hc, hx] = canvas(Math.ceil(c.width / 2), Math.ceil(c.height / 2)); hx.drawImage(c, 0, 0, hc.width, hc.height); _mips.set(c, hc); h = hc; } return h; }
function mip(ctx, c, dw) { const m = ctx.getTransform(), sc = Math.hypot(m.a, m.b) * dw / c.width; let cc = c; let k = sc; while (k < 0.45 && cc.width > 64) { cc = halfOf(cc); k *= 2; } return cc; }

// static backdrop layers (sky gradient + moon, water base): rendered once per key, then one drawImage per frame
const _layers = [];
function cachedLayer(ctx, key, y0, y1, draw) {
  const m = ctx.getTransform(), CW = (ctx.canvas && ctx.canvas.width) || W, CH = (ctx.canvas && ctx.canvas.height) || H;
  if (m.b || m.c) { draw(ctx); return; }
  const fk = key + '|' + [m.a, m.d, m.e, m.f, CW, CH].map((v) => v.toFixed(3)).join(',');
  let e = _layers.find((q) => q.k === fk);
  if (!e) {
    const d0 = Math.max(0, Math.floor(m.d * y0 + m.f)), d1 = Math.min(CH, Math.ceil(m.d * y1 + m.f));
    if (d1 - d0 < 1) return;
    const [c, x] = canvas(CW, d1 - d0); x.setTransform(m.a, 0, 0, m.d, m.e, m.f - d0); draw(x);
    e = { k: fk, c, d0 }; _layers.push(e); if (_layers.length > 10) _layers.shift();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(e.c, 0, e.d0); ctx.restore();
}

// ------------------------------------------------------------------------------------------- nightLit layer
const _pool = [];
let _lvl = 0;
// Buffer pairs sized to the box (rounded up to 64 px). Small buffers matter: drawImage() of a canvas snapshots the
// whole source surface, so a full-frame buffer costs ~10 ms per nightLit call even for a tiny box.
function bufPair(lvl, w, h) {
  const L = _pool[lvl] || (_pool[lvl] = []);
  let best = -1;
  for (let i = 0; i < L.length; i++) { const p = L[i]; if (p.w >= w && p.h >= h && p.w * p.h <= w * h * 2.2 + 40000 && (best < 0 || p.w * p.h < L[best].w * L[best].h)) best = i; }
  if (best >= 0) { const p = L.splice(best, 1)[0]; L.push(p); return p; }
  const nw = Math.ceil(w / 64) * 64, nh = Math.ceil(h / 64) * 64;
  const [ac, ax] = canvas(nw, nh), [bc, bx] = canvas(nw, nh);
  const p = { w: nw, h: nh, A: { c: ac, x: ax }, B: { c: bc, x: bx } };
  L.push(p); if (L.length > 6) L.shift();
  return p;
}
function devBox(m, b, CW = W, CH = H) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]]) {
    const dx = m.a * x + m.c * y + m.e, dy = m.b * x + m.d * y + m.f;
    x0 = Math.min(x0, dx); y0 = Math.min(y0, dy); x1 = Math.max(x1, dx); y1 = Math.max(y1, dy);
  }
  return [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(CW, Math.ceil(x1)), Math.min(CH, Math.ceil(y1))];
}
function nightLit(ctx, fn, o = {}) {
  const m = ctx.getTransform();
  const CW = (ctx.canvas && ctx.canvas.width) || W, CH = (ctx.canvas && ctx.canvas.height) || H;
  const [bx0, by0, bx1, by1] = o.box ? devBox(m, o.box, CW, CH) : [0, 0, CW, CH];
  const bw = bx1 - bx0, bh = by1 - by0;
  if (bw < 2 || bh < 2 || _lvl > 2) return fn(ctx);
  const PR = bufPair(_lvl, bw, bh), A = PR.A, Bf = PR.B; _lvl++;
  const x = A.x, sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  const mb = [m.a, m.b, m.c, m.d, m.e - bx0, m.f - by0]; // local -> buffer
  let ret;
  try {
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, Math.min(PR.w, bw + 64), Math.min(PR.h, bh + 64)); x.beginPath(); x.rect(0, 0, bw, bh); x.clip(); x.setTransform(mb[0], mb[1], mb[2], mb[3], mb[4], mb[5]);
    ret = fn(x);
    x.restore();
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    const toDev = (p) => [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
    const B0x = 0, B0y = 0; // buffer-space box origin
    const rims = [];
    const rw = (o.rimW ?? 4) * sc;
    if ((o.rim ?? 1) > 0) {
      const md = o.moon || [0.75, -0.66], ml = Math.hypot(md[0], md[1]) || 1;
      // direction in device space (respect flips of the local transform only through the given vector, which is screen-space)
      rims.push({ dx: md[0] / ml * rw, dy: md[1] / ml * rw, col: o.rimCol || NIGHT.rim, a: 0.85 * (o.rim ?? 1) });
    }
    const fire = o.fire && (o.fire.k ?? 1) > 0.01 ? o.fire : null;
    let fd = null;
    if (fire) {
      fd = toDev([fire.x, fire.y]);
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2, dl = Math.hypot(fd[0] - cx, fd[1] - cy) || 1;
      rims.push({ dx: (fd[0] - cx) / dl * rw * 1.4, dy: (fd[1] - cy) / dl * rw * 1.4, col: '#ffb45a', a: 0.95 * (fire.k ?? 1) });
    }
    // night tint
    const night = o.night ?? 0.38;
    if (night > 0) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = rgba(o.tint || NIGHT.tint, night); x.fillRect(B0x, B0y, bw, bh); }
    if (fire) {
      const k = fire.k ?? 1, R = (fire.r ?? 700) * sc;
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = rgr(x, fd[0] - bx0, fd[1] - by0, 0, fd[0] - bx0, fd[1] - by0, R, [[0, `rgba(255,160,80,${0.55 * k})`], [0.45, `rgba(255,130,60,${0.3 * k})`], [1, 'rgba(255,120,60,0)']]);
      x.fillRect(B0x, B0y, bw, bh);
    }
    for (const r of rims) {
      // rim = colour where the layer, shifted toward the light, is empty; applied source-atop so only the figure gets it
      const y = Bf.x; y.save(); y.setTransform(1, 0, 0, 1, 0, 0); y.globalAlpha = 1;
      y.globalCompositeOperation = 'copy'; y.fillStyle = r.col; y.fillRect(0, 0, bw, bh);
      y.globalCompositeOperation = 'destination-out'; y.drawImage(A.c, 0, 0, bw, bh, -r.dx, -r.dy, bw, bh);
      y.restore();
      x.globalCompositeOperation = 'source-atop'; x.globalAlpha = r.a; x.drawImage(Bf.c, 0, 0, bw, bh, 0, 0, bw, bh); x.globalAlpha = 1;
    }
    // waterline
    let wy = null;
    if (o.waterline !== undefined && o.waterline !== null) {
      const cxL = o.box ? (o.box[0] + o.box[2]) / 2 : 0;
      wy = toDev([cxL, o.waterline])[1];
      if (wy < by1) {
        const sub = o.sub ?? 0.22, y0 = Math.max(by0, wy) - by0, wb = wy - by0;
        x.globalCompositeOperation = 'destination-out';
        x.fillStyle = lgr(x, 0, wb, 0, wb + 26 * sc, [[0, `rgba(0,0,0,${(1 - sub) * 0.55})`], [1, `rgba(0,0,0,${1 - sub})`]]);
        x.fillRect(0, y0, bw, bh - y0);
        x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(28,66,98,0.6)'; x.fillRect(0, y0, bw, bh - y0);
      }
    }
    x.restore();
    // composite
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const refl = o.reflect || 0;
    if (refl > 0 && wy !== null && wy > by0 && wy < CH) {
      const hh = Math.min(wy - by0, bh), rs = 0.85, t = o.t || 0, N = 10;
      ctx.globalAlpha = refl;
      for (let i = 0; i < N; i++) {
        const sy0 = wy - hh * (i + 1) / N, sh = hh / N + 1, dy = wy + (wy - (sy0 + sh)) * rs;
        const dx = Math.sin(t * 3 + i * 1.7) * 2.5 * sc * (1 + i * 0.25);
        ctx.save(); ctx.translate(0, dy + sh * rs); ctx.scale(1, -rs);
        ctx.drawImage(A.c, 0, sy0 - by0, bw, sh, bx0 + dx, 0, bw, sh); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (o.ring && wy !== null) { // back arc of the ring goes BEHIND the character
      const r = o.ring;
      ctx.save(); ctx.strokeStyle = 'rgba(205,228,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(r.x, o.waterline, r.w, r.w * 0.16, 0, PI + 0.3, TAU - 0.3); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(A.c, 0, 0, bw, bh, bx0, by0, bw, bh);
    ctx.restore();
    if (o.ring && wy !== null) {
      const r = o.ring, tt = r.t || 0;
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(205,228,255,0.6)'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.ellipse(r.x, o.waterline, r.w, r.w * 0.16, 0, 0.15, PI - 0.15); ctx.stroke();
      for (let i = 0; i < 2; i++) {
        const ph = pmod(tt * 0.6 + i * 0.5, 1), rr = r.w * (1.15 + ph * 1.2);
        ctx.strokeStyle = `rgba(190,215,255,${0.35 * (1 - ph)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(r.x, o.waterline + 2, rr, rr * 0.15, 0, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  } finally { _lvl--; }
  return ret;
}

// ------------------------------------------------------------------------------------------- sky
let _stars = null;
function starSprite() {
  if (_stars) return _stars;
  const [c, x] = canvas(1080, 1500), r = rng(41);
  for (let i = 0; i < 620; i++) {
    const px = r() * 1080, py = r() * 1500, s = Math.pow(r(), 3) * 1.9 + 0.5, a = 0.25 + r() * 0.65;
    x.fillStyle = r() < 0.12 ? `rgba(255,226,190,${a})` : r() < 0.2 ? `rgba(190,210,255,${a})` : `rgba(240,244,255,${a})`;
    x.beginPath(); x.arc(px, py, s, 0, TAU); x.fill();
  }
  // milky band
  for (let i = 0; i < 160; i++) {
    const u = r(), px = lerp(-100, 1180, u), py = lerp(1100, 80, u) + (r() - 0.5) * 220, rr = 30 + r() * 70;
    x.fillStyle = rgr(x, px, py, 0, px, py, rr, [[0, 'rgba(170,190,240,0.05)'], [1, 'rgba(170,190,240,0)']]); x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  _stars = c; return c;
}
let _moon = null;
function moonSprite() {
  if (_moon) return _moon;
  const R = 128, [c, x] = canvas(R * 2 + 8, R * 2 + 8);
  x.translate(R + 4, R + 4);
  x.fillStyle = rgr(x, -R * 0.25, -R * 0.25, R * 0.1, 0, 0, R, [[0, '#fffbea'], [0.7, NIGHT.moon], [1, NIGHT.moonEdge]]);
  x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
  x.save(); x.clip();
  const r = rng(9);
  for (const [mx, my, mr, a] of [[-38, -30, 44, 0.16], [22, -48, 30, 0.12], [34, 20, 52, 0.14], [-30, 44, 30, 0.1], [-62, 6, 22, 0.1], [60, -8, 18, 0.1]]) {
    x.fillStyle = rgr(x, mx, my, 0, mx, my, mr, [[0, `rgba(170,150,115,${a})`], [0.7, `rgba(170,150,115,${a * 0.7})`], [1, 'rgba(170,150,115,0)']]);
    x.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  }
  for (let i = 0; i < 26; i++) { const px = (r() - 0.5) * 2 * R, py = (r() - 0.5) * 2 * R, cr = 2 + r() * 6; x.strokeStyle = 'rgba(160,140,110,0.18)'; x.lineWidth = 1.2; x.beginPath(); x.arc(px, py, cr, 0, TAU); x.stroke(); }
  x.fillStyle = rgr(x, 0, 0, R * 0.75, 0, 0, R, [[0, 'rgba(230,200,140,0)'], [1, 'rgba(220,180,120,0.35)']]); x.fillRect(-R, -R, R * 2, R * 2);
  x.restore();
  _moon = c; return c;
}
const _cloud = {};
function cloudSprite(v) {
  if (_cloud[v]) return _cloud[v];
  const [c, x] = canvas(760, 150), r = rng(60 + v * 13);
  const n = 26 + v * 4;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), px = 60 + u * 640 + (r() - 0.5) * 40, py = 80 + Math.sin(u * PI * (1 + v * 0.5)) * 18 * (v % 2 ? 1 : -1) + (r() - 0.5) * 16;
    const rx = 40 + r() * 70 * Math.sin(u * PI + 0.2), ry = rx * (0.22 + r() * 0.12);
    x.save(); x.translate(px, py); x.scale(1, ry / rx);
    x.fillStyle = rgr(x, 0, 0, 0, 0, 0, rx, [[0, 'rgba(255,255,255,0.32)'], [0.6, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
    x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore();
  }
  _cloud[v] = c; return c;
}
function nightSky(ctx, y0, y1, o = {}) {
  const t = o.t || 0, x0 = o.x0 ?? 0, w = o.w ?? W, panX = o.panX || 0, S = NIGHT.sky;
  const moon = o.moon || [770, y0 + (y1 - y0) * 0.3], mS = o.moonS ?? 1, R = 92 * mS;
  ctx.save();
  cachedLayer(ctx, ['sky', x0, y0, y1, w, Math.round(panX * 0.04), moon[0].toFixed(1), moon[1].toFixed(1), mS, o.stars, o.starA].join(','), y0, y1, (c) => {
    c.save();
    c.fillStyle = lgr(c, 0, Math.min(y0, 0), 0, y1, [[0, S[0]], [0.35, S[1]], [0.68, S[2]], [0.9, S[3]], [1, S[4]]]);
    c.fillRect(x0, y0, w, y1 - y0);
    c.beginPath(); c.rect(x0, y0, w, y1 - y0); c.clip();
    if (o.stars !== false) {
      const sp = starSprite(), off = pmod(Math.round(panX * 0.04), 1080);
      c.globalAlpha = o.starA ?? 1;
      for (let xx = Math.floor((x0 + off) / 1080) * 1080 - off; xx < x0 + w; xx += 1080) c.drawImage(sp, xx, -260);
      c.globalAlpha = 1;
    }
    // horizon glow (moonlit haze)
    c.fillStyle = lgr(c, 0, y1 - 260, 0, y1, [[0, 'rgba(110,140,190,0)'], [1, 'rgba(120,150,200,0.45)']]);
    c.fillRect(x0, y1 - 260, w, 260);
    // moon glow
    c.globalCompositeOperation = 'screen';
    c.fillStyle = rgr(c, moon[0], moon[1], R * 0.8, moon[0], moon[1], R * 7.5, [[0, `rgba(${NIGHT.moonGlow},0.5)`], [0.18, `rgba(${NIGHT.moonGlow},0.22)`], [0.5, 'rgba(150,170,220,0.07)'], [1, 'rgba(150,170,220,0)']]);
    c.fillRect(moon[0] - R * 7.5, moon[1] - R * 7.5, R * 15, R * 15);
    c.globalCompositeOperation = 'source-over';
    const ms = moonSprite();
    c.drawImage(mip(c, ms, R * 2 * ms.width / 256), moon[0] - R * ms.width / 256, moon[1] - R * ms.width / 256, R * 2 * ms.width / 256, R * 2 * ms.width / 256);
    c.restore();
  });
  ctx.beginPath(); ctx.rect(x0, y0, w, y1 - y0); ctx.clip();
  if (o.stars !== false) {
    ctx.globalAlpha = o.starA ?? 1;
    const r = rng(o.seed ?? 3);
    for (let i = 0; i < 34; i++) {
      const sx = pmod(r() * 1080 - panX * 0.04, 1080), sy = -200 + r() * 1100, ph = r() * TAU, sp2 = 1.5 + r() * 3, ss = 6 + r() * 9;
      if (sy > y1 - 60) continue;
      const a = Math.max(0, Math.sin(t * sp2 + ph)) * (o.starA ?? 1);
      if (a < 0.05) continue;
      for (let xx = sx; xx < x0 + w; xx += 1080) if (xx > x0 && Math.hypot(xx - moon[0], sy - moon[1]) > R * 1.2) L.sparkle(ctx, xx, sy, ss, a * 0.8);
    }
    ctx.globalAlpha = 1;
  }
  // clouds
  const nc = o.clouds ?? 6, r = rng((o.seed ?? 3) + 50);
  for (let i = 0; i < nc; i++) {
    const v = i % 4, sp = cloudSprite(v), cw = (520 + r() * 520), ch = cw * 150 / 760;
    const cy = lerp(y0 + 80, y1 - 160, Math.pow(r(), 0.8)), span = w + cw + 400;
    const cx = x0 - cw - 200 + pmod(r() * span + t * (5 + r() * 6) - panX * 0.12, span);
    const dm = Math.hypot(cx + cw / 2 - moon[0], cy - moon[1]);
    const lit = clamp(1 - dm / (R * 6));
    ctx.globalAlpha = (0.4 + 0.6 * lit) * (o.cloudA ?? 1);
    ctx.drawImage(sp, cx, cy - ch / 2, cw, ch);
    if (lit > 0.05) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = lit * 0.6; ctx.drawImage(sp, cx, cy - ch / 2, cw, ch); ctx.globalCompositeOperation = 'source-over'; }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  return { moon, moonR: R };
}

// ------------------------------------------------------------------------------------------- water + rice
function floodWater(ctx, y0, y1, t, o = {}) {
  const x0 = o.x0 ?? 0, w = o.w ?? W, mx = o.moonX ?? 770, Wc = NIGHT.water;
  ctx.save();
  cachedLayer(ctx, ['water', x0, y0, y1, w].join(','), y0, y1, (c) => {
    c.fillStyle = lgr(c, 0, y0, 0, y1, [[0, Wc[0]], [0.07, Wc[1]], [0.4, Wc[2]], [1, Wc[3]]]);
    c.fillRect(x0, y0, w, y1 - y0);
    // soft sky streaks
    c.globalCompositeOperation = 'screen';
    const r0 = rng(17);
    for (let i = 0; i < 14; i++) {
      const v = Math.pow(r0(), 2), yy = y0 + v * (y1 - y0) * 0.6, hh = 2 + v * 14;
      c.fillStyle = `rgba(120,150,200,${0.06 + r0() * 0.06})`; c.fillRect(x0, yy, w, hh);
    }
    c.globalCompositeOperation = 'source-over';
  });
  ctx.globalCompositeOperation = 'screen';
  // moon path
  if (o.moonPath !== false) {
    const cw = o.colW ?? 150, NB = 30, bh = (y1 - y0) / NB;
    for (let i = 0; i < NB; i++) {
      const v = i / NB, yy = y0 + v * (y1 - y0);
      const hw = lerp(cw * 0.15, cw * 1.35, Math.pow(v, 0.75)) * (0.8 + 0.3 * Math.sin(t * 1.9 + i * 1.7));
      const al = (v < 0.35 ? lerp(0.8, 0.5, v / 0.35) : lerp(0.5, 0.0, (v - 0.35) / 0.65)) * (0.7 + 0.3 * Math.sin(t * 2.7 + i * 2.3));
      const cx = mx + Math.sin(t * 1.2 + i * 0.9) * 5 * (0.3 + v), c = '255,238,200';
      ctx.fillStyle = lgr(ctx, cx - hw, 0, cx + hw, 0, [[0, `rgba(${c},0)`], [0.32, `rgba(${c},${al * 0.35})`], [0.5, `rgba(${c},${al})`], [0.68, `rgba(${c},${al * 0.35})`], [1, `rgba(${c},0)`]]);
      ctx.fillRect(cx - hw, yy, hw * 2, bh * (0.6 + 0.35 * Math.sin(i * 3.1 + t)) + 0.5);
    }
  }
  // fire reflection streak + glow
  const fire = o.fire || 0;
  if (fire > 0.01 && o.fireAt) {
    const [fx, fy] = o.fireAt, ys = Math.max(y0, fy), NB = 16, bh = (y1 - ys) / NB;
    for (let i = 0; i < NB; i++) {
      const v = i / NB, yy = ys + v * (y1 - ys), hw = (30 + v * 90) * (0.8 + 0.3 * Math.sin(t * 7 + i * 1.3)) * (o.fireW ?? 1);
      const al = fire * lerp(0.75, 0, Math.pow(v, 0.7)) * (0.7 + 0.3 * Math.sin(t * 9 + i * 2.1));
      ctx.fillStyle = lgr(ctx, fx - hw, 0, fx + hw, 0, [[0, 'rgba(255,150,60,0)'], [0.5, `rgba(255,160,70,${al})`], [1, 'rgba(255,150,60,0)']]);
      ctx.fillRect(fx - hw + Math.sin(t * 4 + i) * 4, yy, hw * 2, bh * 0.7 + 0.5);
    }
  }
  ctx.restore();
  NP.ripples(ctx, x0, y0, w, y1 - y0, t, { seed: o.seed ?? 5, alpha: 0.32, n: o.ripples ?? 90, panX: o.panX || 0, col: '200,222,255' });
  // glitter in the moon path
  const r = rng(o.seed ?? 77), n = o.glitter ?? 130, cw = o.colW ?? 150;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = '#fff4d8';
  for (let i = 0; i < n; i++) {
    const v = Math.pow(r(), 1.5), yy = y0 + v * (y1 - y0), spread = lerp(cw * 0.15, cw * 1.4, v) * (r() * 2 - 1) * 0.85;
    const tw = Math.sin(t * (4 + r() * 6) + r() * TAU), s = (1 + v * 5) * (0.6 + r() * 0.8);
    if (tw < 0.25) continue;
    ctx.globalAlpha = tw * (1 - v * 0.7);
    ell(ctx, mx + spread, yy, s * 3, s * 0.55); ctx.fill();
  }
  ctx.restore();
}
function fireGlow(ctx, fx, fy, k, R = 620, sq = 0.55) {
  if (k <= 0.01) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(fx, fy); ctx.scale(1, sq);
  ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, R, [[0, `rgba(255,150,70,${0.5 * k})`], [0.35, `rgba(255,120,50,${0.22 * k})`], [1, 'rgba(255,110,50,0)']]);
  ctx.fillRect(-R, -R, R * 2, R * 2); ctx.restore();
}
// Clump sprites for the small / far rice (building thousands of blade paths through napi costs ~1.4 us per call,
// so far rows are drawn as pre-rendered clumps; near rows, where the blades are big, stay as vector paths).
const RICE_SC0 = 3.0, RICE_H0 = 48 * RICE_SC0, RICE_STATIC = 1.2, _riceSp = {}, _riceCache = [];
// far clumps (scale < RICE_STATIC, sway < 3 px) are baked into a cached layer: a static camera redraws them with one drawImage
function riceLayer(ctx, key, list, ms, rings) {
  const m = ctx.getTransform(), CW = (ctx.canvas && ctx.canvas.width) || W, CH = (ctx.canvas && ctx.canvas.height) || H;
  const fk = key + '|' + [m.a, m.b, m.c, m.d, m.e, m.f, CW, CH].map((v) => v.toFixed(3)).join(',');
  let e = _riceCache.find((q) => q.k === fk);
  if (!e) {
    let y0 = 1e9, y1 = -1e9;
    for (const [, syy, , hgt] of list) { y0 = Math.min(y0, syy - hgt * 1.15 - 4); y1 = Math.max(y1, syy + hgt * 0.6 + 4); }
    const d0 = m.b * 0 + m.d * y0 + m.f, d1 = m.d * y1 + m.f, dy0 = Math.max(0, Math.floor(Math.min(d0, d1)) - 40), dy1 = Math.min(CH, Math.ceil(Math.max(d0, d1)) + 40);
    if (dy1 - dy0 < 2) return;
    const [c, x] = canvas(CW, dy1 - dy0);
    x.setTransform(m.a, m.b, m.c, m.d, m.e, m.f - dy0);
    x.strokeStyle = 'rgba(190,215,255,0.22)'; x.lineWidth = 1.3; x.stroke(rings);
    drawRiceSprites(x, list, ms, true);
    e = { k: fk, c, dy0 };
    _riceCache.push(e); if (_riceCache.length > 8) _riceCache.shift();
  }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(e.c, 0, e.dy0); ctx.restore();
}
function drawRiceSprites(ctx, list, ms, still) {
  const SP = riceSprites(ms), m = ctx.getTransform();
  for (let n = list.length - 1; n >= 0; n--) { // far -> near; uniform scale k, vertical stretch for the clump height, shear for the sway
    const [sx, syy, sc, hgt, sway, v] = list[n], sp = SP[v], k = sc / RICE_SC0, ky = hgt / RICE_H0;
    let cv = sp.c, f = 1; while (k * f < 0.45 && cv.width > 40) { cv = halfOf(cv); f *= 2; }
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.transform(k * f, 0, still ? 0 : -sway / RICE_H0 * f, ky * f, sx, syy);
    ctx.drawImage(cv, -sp.ox / f, -sp.oy / f);
  }
  ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
}
function riceSprites(ms) {
  if (_riceSp[ms]) return _riceSp[ms];
  const out = [];
  for (let v = 0; v < 8; v++) {
    const Wd = 225, Hd = 255, ox = 112, oy = 168;
    const [c, x] = canvas(Wd, Hd); x.translate(ox, oy);
    const dark = new Path2D(), lit = new Path2D(), refl = new Path2D();
    const sc = RICE_SC0, hgt = RICE_H0, bw = 2.4 * sc, nb = 5;
    for (let b = 0; b < nb; b++) {
      const u = b / (nb - 1) - 0.5, lean = u * 0.9 + (hash(v * 7 + b, 3 + v) - 0.5) * 0.3, hf = 1 - Math.abs(u) * 0.45;
      const bx = u * bw * 2.2, tx = bx + lean * hgt * 0.55, ty = -hgt * hf, cx = bx + lean * hgt * 0.1, cy = -hgt * hf * 0.6;
      dark.moveTo(bx - bw, 0); dark.quadraticCurveTo(cx - bw * 0.4, cy, tx, ty); dark.quadraticCurveTo(cx + bw * 0.4, cy, bx + bw, 0); dark.closePath();
      const lo = ms * bw * 0.45;
      lit.moveTo(bx + lo - bw * 0.35, -hgt * 0.08); lit.quadraticCurveTo(cx + lo, cy, tx, ty); lit.quadraticCurveTo(cx + lo + bw * 0.3, cy, bx + lo + bw * 0.45, -hgt * 0.08); lit.closePath();
      refl.moveTo(bx - bw * 0.8, 1); refl.quadraticCurveTo(cx, hgt * hf * 0.3, tx * 0.3 + bx * 0.7, hgt * hf * 0.5); refl.lineTo(bx + bw * 0.8, 1); refl.closePath();
    }
    x.fillStyle = 'rgba(8,16,30,0.45)'; x.fill(refl);
    x.fillStyle = NIGHT.rice; x.fill(dark);
    x.fillStyle = NIGHT.riceLit; x.globalAlpha = 0.85; x.fill(lit);
    out.push({ c, ox, oy });
  }
  return (_riceSp[ms] = out);
}
function riceRows(ctx, t, P, o = {}) {
  const rice = o.rice ?? 1; if (rice <= 0.02) return;
  const dz = o.dz ?? 80, dx = o.dx ?? 62, camZ = o.camZ || 0, hk = o.hk ?? 1, ms = o.moonSide ?? 1;
  const zNear = Math.max(o.zNear ?? 60, 20), zFar = o.zFar ?? 1e9, yMax = o.yMax ?? H + 40;
  const j0 = Math.ceil((zNear + camZ) / dz);
  const dark = new Path2D(), lit = new Path2D(), refl = new Path2D(), ring = new Path2D();
  const sprites = [], still = [], ringS = new Path2D(); const useCache = o.cache !== false;
  let any = false, anyPath = false;
  for (let j = j0; j < j0 + 400; j++) {
    const Z = j * dz - camZ; if (Z > zFar) break;
    const sc = P.s(Z), by = P.y(Z);
    if (by > yMax) continue;
    if (P.camH * P.F * dz / (Z * Z) < 2.6) break;
    const useSp = sc <= RICE_SC0;
    const hx = (W / 2 + 80) / sc, i0 = Math.floor((P.camX - hx) / dx) - 1, i1 = Math.ceil((P.camX + hx) / dx) + 1;
    for (let i = i0; i <= i1; i++) {
      const h0 = hash(i, j), X = i * dx + (j % 2) * dx * 0.5 + (h0 - 0.5) * dx * 0.5;
      const sx = P.x(X, Z), syy = by + (hash(j, i) - 0.5) * 6 * sc * 0.3;
      if (sx < -60 || sx > W + 60) continue;
      const hgt = (22 + 26 * hash(i * 3, j)) * rice * sc * hk;
      if (hgt < 1.2) continue;
      any = true;
      const bw = Math.max(0.7, 2.4 * sc), sway = Math.sin(t * 1.3 + X * 0.011 + j * 0.7) * 2.2 * sc;
      const isStill = useCache && sc < RICE_STATIC, rg = isStill ? ringS : ring;
      if (hgt > 14) { const rx = bw * 5 + hgt * 0.12; rg.moveTo(sx + rx, syy + 1); rg.ellipse(sx, syy + 1, rx, rx * 0.18, 0, 0, TAU); }
      if (useSp) { (isStill ? still : sprites).push([sx, syy, sc, hgt, sway, Math.floor(hash(i * 5 + 1, j * 3) * 8)]); continue; }
      anyPath = true;
      const nb = hgt > 24 ? 5 : hgt > 6 ? 4 : 3;
      for (let b = 0; b < nb; b++) {
        const u = nb === 1 ? 0 : b / (nb - 1) - 0.5, lean = u * 0.9 + (hash(i + b, j) - 0.5) * 0.3, hf = 1 - Math.abs(u) * 0.45;
        const bx = sx + u * bw * 2.2, tx = bx + lean * hgt * 0.55 + sway, ty = syy - hgt * hf, cx = bx + lean * hgt * 0.1, cy = syy - hgt * hf * 0.6;
        dark.moveTo(bx - bw, syy); dark.quadraticCurveTo(cx - bw * 0.4, cy, tx, ty); dark.quadraticCurveTo(cx + bw * 0.4, cy, bx + bw, syy); dark.closePath();
        const lo = ms * bw * 0.45;
        lit.moveTo(bx + lo - bw * 0.35, syy - hgt * 0.08); lit.quadraticCurveTo(cx + lo, cy, tx, ty); lit.quadraticCurveTo(cx + lo + bw * 0.3, cy, bx + lo + bw * 0.45, syy - hgt * 0.08); lit.closePath();
        if (hgt > 5) { refl.moveTo(bx - bw * 0.8, syy + 1); refl.quadraticCurveTo(cx, syy + hgt * hf * 0.3, tx * 0.3 + bx * 0.7, syy + hgt * hf * 0.5); refl.lineTo(bx + bw * 0.8, syy + 1); refl.closePath(); }
      }
    }
  }
  if (!any) return;
  ctx.save();
  if (still.length) riceLayer(ctx, [P.hz, P.camH, P.F, P.camX, P.cx, camZ, rice, hk, ms, zNear, zFar, yMax, dz, dx].join(','), still, ms, ringS);
  ctx.strokeStyle = 'rgba(190,215,255,0.22)'; ctx.lineWidth = 1.3; ctx.stroke(ring);
  if (sprites.length) drawRiceSprites(ctx, sprites, ms, false);
  if (anyPath) {
    ctx.fillStyle = 'rgba(8,16,30,0.45)'; ctx.fill(refl);
    ctx.fillStyle = NIGHT.rice; ctx.fill(dark);
    ctx.fillStyle = NIGHT.riceLit; ctx.globalAlpha = 0.85; ctx.fill(lit);
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- fireflies
let _ff = null;
function ffSprite() {
  if (_ff) return _ff;
  const [c, x] = canvas(64, 64);
  x.fillStyle = rgr(x, 32, 32, 0, 32, 32, 32, [[0, 'rgba(240,255,170,1)'], [0.12, 'rgba(220,255,120,0.9)'], [0.35, `rgba(${NIGHT.fireflyRGB},0.32)`], [1, `rgba(${NIGHT.fireflyRGB},0)`]]);
  x.fillRect(0, 0, 64, 64); _ff = c; return c;
}
function fireflies(ctx, t, o = {}) {
  const n = o.n ?? 30, x0 = o.x0 ?? 0, y0 = o.y0 ?? 700, w = o.w ?? W, h = o.h ?? 1100, r = rng(o.seed ?? 21), near = o.near || 0;
  const sp = ffSprite();
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const bx = r(), by = r(), ph = r() * TAU, f1 = 0.15 + r() * 0.3, f2 = 0.2 + r() * 0.35, rate = 0.35 + r() * 0.5, ph2 = r();
    const big = r() < near ? 1 : 0, sz = (big ? 22 + r() * 30 : 7 + r() * 9) * (o.size ?? 1);
    const px = x0 + pmod(bx * w + Math.sin(t * f1 + ph) * 60 + t * 6 * (r() - 0.5), w), py = y0 + by * h + Math.sin(t * f2 + ph * 1.3) * 40 - Math.sin(t * 0.4 + ph) * 10;
    const cyc = pmod(t * rate + ph2, 1), bl = cyc < 0.4 ? Math.sin(cyc / 0.4 * PI) : 0.08;
    const a = bl * (o.a ?? 1) * (big ? 0.55 : 1);
    if (a < 0.03) continue;
    ctx.globalAlpha = a;
    ctx.drawImage(sp, px - sz * 2, py - sz * 2, sz * 4, sz * 4);
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- silhouettes
const _palm = {};
function palmSprite(v) {
  if (_palm[v]) return _palm[v];
  const PW = 560, PH = 780, [c, x] = canvas(PW, PH), r = rng(300 + v * 31);
  const bx = PW / 2, by = PH - 14, hgt = 560 + r() * 90, lean = (r() - 0.5) * 0.5 + (v % 2 ? 0.18 : -0.14);
  const top = [bx + Math.sin(lean) * hgt * 0.75, by - hgt];
  const cpt = [bx + Math.sin(lean) * hgt * 0.1, by - hgt * 0.55];
  const q = (u) => [(1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cpt[0] + u * u * top[0], (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cpt[1] + u * u * top[1]];
  x.fillStyle = NIGHT.sil; x.beginPath();
  const N = 24, side = [];
  for (let i = 0; i <= N; i++) { const u = i / N, p = q(u), pn = q(Math.min(1, u + 0.02)), pp = q(Math.max(0, u - 0.02)), a = Math.atan2(pn[1] - pp[1], pn[0] - pp[0]) + PI / 2, wd = lerp(17, 9, u) + (i % 3 === 0 ? 1.5 : 0); side.push([p[0] + Math.cos(a) * wd, p[1] + Math.sin(a) * wd, p[0] - Math.cos(a) * wd, p[1] - Math.sin(a) * wd]); }
  x.moveTo(side[0][0], side[0][1]); for (const s of side) x.lineTo(s[0], s[1]); for (let i = side.length - 1; i >= 0; i--) x.lineTo(side[i][2], side[i][3]); x.closePath(); x.fill();
  // flared base roots
  x.beginPath(); x.moveTo(bx - 30, by + 6); x.quadraticCurveTo(bx - 14, by - 10, bx - 13, by - 40); x.lineTo(bx + 13, by - 40); x.quadraticCurveTo(bx + 14, by - 10, bx + 30, by + 6); x.closePath(); x.fill();
  // fronds
  const nf = 13 + Math.floor(r() * 3);
  for (let i = 0; i < nf; i++) {
    const a = -PI / 2 + (i / (nf - 1) - 0.5) * 4.2 + (r() - 0.5) * 0.25, len = 170 + r() * 90, droop = 0.45 + r() * 0.35;
    const ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len * 0.55 + len * droop * Math.abs(Math.cos(a)) * 0.9 + (Math.sin(a) > 0 ? len * 0.2 : 0);
    const cx1 = top[0] + Math.cos(a) * len * 0.55, cy1 = top[1] + Math.sin(a) * len * 0.35 - 30 * Math.abs(Math.cos(a));
    x.strokeStyle = NIGHT.sil; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(top[0], top[1]); x.quadraticCurveTo(cx1, cy1, ex, ey); x.stroke();
    x.fillStyle = NIGHT.sil; x.beginPath();
    for (let j = 1; j < 16; j++) {
      const u = j / 16, px = (1 - u) * (1 - u) * top[0] + 2 * (1 - u) * u * cx1 + u * u * ex, py = (1 - u) * (1 - u) * top[1] + 2 * (1 - u) * u * cy1 + u * u * ey;
      const ll = (44 + r() * 14) * Math.sin(u * PI * 0.85 + 0.25), dd = Math.cos(a) >= 0 ? 1 : -1;
      for (const sd of [-1, 1]) {
        const la = PI / 2 + sd * 0.55 * dd - dd * 0.25;
        x.moveTo(px - 2.5, py); x.lineTo(px + Math.cos(la) * ll, py + Math.sin(la) * ll); x.lineTo(px + 2.5, py);
      }
    }
    x.fill();
  }
  // coconuts
  for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(top[0] + (i - 2) * 9, top[1] + 14 + (i % 2) * 8, 10, 0, TAU); x.fill(); }
  rimify(c, 4, -3, NIGHT.rim, 0.9);
  // trunk ring texture
  x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(166,200,255,0.18)'; x.lineWidth = 1.5;
  for (let i = 2; i < N - 2; i += 1) { const s = side[i]; x.beginPath(); x.moveTo(lerp(s[0], s[2], 0.1), s[1]); x.lineTo(lerp(s[0], s[2], 0.45), lerp(s[1], s[3], 0.45) + 2); x.stroke(); }
  _palm[v] = { c, ox: bx, oy: by, w: PW, h: PH, top: [top[0] - bx, top[1] - by] };
  return _palm[v];
}
function palmSil(ctx, x, y, s = 1, o = {}) {
  const P = palmSprite((o.v || 0) % 4), fl = o.flip ? -1 : 1, sway = Math.sin((o.t || 0) * 0.6 + (o.v || 0)) * 0.006;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.scale(fl * s, s);
  ctx.drawImage(mip(ctx, P.c, P.w), -P.ox, -P.oy, P.w, P.h); ctx.restore();
  return { top: [x + P.top[0] * s * fl, y + P.top[1] * s] };
}
let _hut = null;
function hutSprite() {
  if (_hut) return _hut;
  const HW = 760, HH = 680, OX = 380, OY = 560, [c, x] = canvas(HW, HH), r = rng(77);
  x.translate(OX, OY); x.lineCap = 'round'; x.lineJoin = 'round';
  // stilts (to waterline 0) + braces
  x.strokeStyle = '#0c1628'; x.lineWidth = 12;
  for (const sx of [-160, -60, 60, 160]) { x.beginPath(); x.moveTo(sx, -128); x.lineTo(sx + (r() - 0.5) * 6, 4); x.stroke(); }
  x.lineWidth = 6; x.beginPath(); x.moveTo(-160, -40); x.lineTo(-60, -110); x.moveTo(60, -110); x.lineTo(160, -40); x.stroke();
  // ladder
  x.lineWidth = 5; x.beginPath(); x.moveTo(190, -130); x.lineTo(232, 4); x.moveTo(214, -130); x.lineTo(256, 4); for (let i = 1; i < 5; i++) { const u = i / 5; x.moveTo(lerp(190, 232, u), lerp(-130, 4, u)); x.lineTo(lerp(214, 256, u), lerp(-130, 4, u)); } x.stroke();
  // deck
  x.fillStyle = '#142038'; x.fillRect(-200, -142, 430, 16);
  // walls (woven bamboo, moonlit blue-grey)
  x.fillStyle = '#1c2a46'; x.fillRect(-170, -300, 340, 160);
  x.strokeStyle = 'rgba(140,170,220,0.16)'; x.lineWidth = 2;
  for (let yy = -296; yy < -142; yy += 8) { x.beginPath(); x.moveTo(-170, yy); x.lineTo(170, yy + (r() - 0.5) * 2); x.stroke(); }
  for (let xx = -166; xx < 170; xx += 14) { x.strokeStyle = 'rgba(10,18,34,0.35)'; x.beginPath(); x.moveTo(xx, -300); x.lineTo(xx, -142); x.stroke(); }
  // door + window (dark openings)
  x.fillStyle = '#060c18'; x.fillRect(-120, -270, 74, 128); x.fillRect(40, -262, 92, 62);
  x.strokeStyle = '#0c1628'; x.lineWidth = 4; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(40 + i * 23, -262); x.lineTo(40 + i * 23, -200); x.stroke(); }
  // posts
  x.fillStyle = '#0c1628'; for (const sx of [-174, -2, 168]) x.fillRect(sx - 5, -306, 11, 166);
  // thatch roof (gable, ragged fringe)
  const roof = new Path2D(); roof.moveTo(-232, -284); roof.lineTo(-10, -470); roof.lineTo(14, -470); roof.lineTo(238, -284);
  for (let xx = 238; xx >= -232; xx -= 12) roof.lineTo(xx, -284 + 6 + r() * 14);
  roof.closePath();
  x.fillStyle = lgr(x, -230, -470, 230, -284, [[0, '#222c44'], [0.55, '#2f3b5a'], [1, '#3e4c70']]); x.fill(roof);
  x.save(); x.clip(roof); x.strokeStyle = 'rgba(12,20,36,0.45)'; x.lineWidth = 2.2;
  for (let i = 0; i < 70; i++) { const u = r(), px = lerp(-230, 236, u), top = -284 - (1 - Math.abs(u - 0.5) * 2) * 186; x.beginPath(); x.moveTo(px, -284 + 12); x.lineTo(px + (r() - 0.5) * 10, top + r() * 30); x.stroke(); }
  x.strokeStyle = 'rgba(170,200,250,0.18)'; for (let i = 0; i < 40; i++) { const u = 0.5 + r() * 0.5, px = lerp(-230, 236, u), top = -284 - (1 - Math.abs(u - 0.5) * 2) * 186; x.beginPath(); x.moveTo(px, -290); x.lineTo(px - 4, top + 10 + r() * 30); x.stroke(); }
  x.restore();
  x.strokeStyle = '#0c1628'; x.lineWidth = 7; x.beginPath(); x.moveTo(-20, -478); x.lineTo(24, -478); x.stroke();
  rimify(c, 4, -3, NIGHT.rim, 0.85);
  _hut = { c, ox: OX, oy: OY, w: HW, h: HH };
  return _hut;
}
function stiltHut(ctx, x, y, s = 1, o = {}) {
  const S = hutSprite(), fl = o.flip ? -1 : 1, t = o.t || 0;
  ctx.save(); ctx.translate(x, y); ctx.scale(fl * s, s);
  const cc = mip(ctx, S.c, S.w);
  const refl = o.reflect ?? 0.3;
  if (refl > 0) { ctx.save(); ctx.globalAlpha = refl; ctx.scale(1, -0.8); ctx.drawImage(cc, -S.ox, -S.oy, S.w, S.oy + 4, -S.ox, -S.oy, S.w, S.oy + 4); ctx.restore(); }
  ctx.drawImage(cc, -S.ox, -S.oy, S.w, S.h);
  const lamp = o.lamp || 0;
  if (lamp > 0) {
    const fl2 = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3);
    ctx.fillStyle = `rgba(255,190,100,${0.85 * lamp * fl2})`; ctx.fillRect(42, -260, 88, 58);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgr(ctx, 86, -231, 0, 86, -231, 230, [[0, `rgba(255,170,80,${0.55 * lamp * fl2})`], [1, 'rgba(255,150,60,0)']]); ctx.fillRect(-150, -460, 470, 460);
    ctx.fillStyle = lgr(ctx, 0, 0, 0, 260, [[0, `rgba(255,170,80,${0.4 * lamp})`], [1, 'rgba(255,170,80,0)']]); ctx.fillRect(60, 2, 50, 260);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  const m = (px, py) => [x + px * s * fl, y + py * s];
  return { door: m(-83, -142), lamp: m(86, -231), deck: m(0, -142) };
}
const _strip = {};
function stripSprite(kind) {
  if (_strip[kind]) return _strip[kind];
  const SW = 2048, SH = 380, BY = 360, [c, x] = canvas(SW, SH), r = rng(kind === 'far' ? 11 : 23), far = kind === 'far';
  x.fillStyle = far ? NIGHT.far : NIGHT.near;
  const sc = far ? 0.55 : 1;
  // bushes
  x.beginPath();
  for (let xx = -40; xx < SW + 40; xx += 18 + r() * 26) { const rr = (24 + r() * 46) * sc; x.moveTo(xx + rr, BY); x.arc(xx, BY - rr * 0.4, rr, 0, TAU); }
  x.fill();
  // bamboo clumps
  for (let i = 0; i < (far ? 10 : 7); i++) {
    const bx = r() * SW, hh = (120 + r() * 120) * sc;
    x.strokeStyle = x.fillStyle; x.lineWidth = 3 * sc + 1;
    for (let j = 0; j < 9; j++) { const a = (j / 8 - 0.5) * 0.8; x.beginPath(); x.moveTo(bx + j * 3 - 12, BY); x.quadraticCurveTo(bx + Math.sin(a) * hh * 0.4, BY - hh * 0.6, bx + Math.sin(a) * hh * 0.9, BY - hh * Math.cos(a)); x.stroke(); }
    x.beginPath(); for (let j = 0; j < 30; j++) { const a = (r() - 0.5) * 1.6, d = hh * (0.5 + r() * 0.5); const px = bx + Math.sin(a) * d * 0.9, py = BY - Math.cos(a) * d; x.moveTo(px + 14 * sc, py); x.arc(px, py, 14 * sc + r() * 10 * sc, 0, TAU); } x.fill();
  }
  // small palms
  for (let i = 0; i < (far ? 16 : 9); i++) {
    const bx = r() * SW, hh = (150 + r() * 170) * sc, lean = (r() - 0.5) * 0.5, tx = bx + Math.sin(lean) * hh, ty = BY - hh;
    x.strokeStyle = x.fillStyle; x.lineWidth = 7 * sc + 1; x.beginPath(); x.moveTo(bx, BY); x.quadraticCurveTo(bx + Math.sin(lean) * hh * 0.2, BY - hh * 0.5, tx, ty); x.stroke();
    x.lineWidth = 4 * sc + 1;
    for (let j = 0; j < 10; j++) { const a = -PI / 2 + (j / 9 - 0.5) * 3.8, len = (60 + r() * 30) * sc; x.beginPath(); x.moveTo(tx, ty); x.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.4 - 10 * sc, tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.5 + len * 0.45); x.stroke(); }
  }
  x.fillRect(0, BY - 4, SW, SH - BY + 4);
  // wrap seam: copy left edge onto right for tiling
  const [t2, x2] = canvas(SW, SH); x2.drawImage(c, 0, 0);
  x.save(); x.globalCompositeOperation = 'source-over'; x.drawImage(t2, SW - 120, 0, 120, SH, -120 + SW, 0, 120, SH); x.restore();
  rimify(c, 2, -3, far ? 'rgba(150,180,230,1)' : NIGHT.rim, far ? 0.35 : 0.7);
  if (far) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = lgr(x, 0, BY - 200, 0, BY, [[0, 'rgba(90,120,170,0)'], [1, 'rgba(90,120,170,0.55)']]); x.fillRect(0, 0, SW, SH); }
  _strip[kind] = { c, w: SW, h: SH, by: BY };
  return _strip[kind];
}
function treeLine(ctx, y, s = 1, o = {}) {
  const S = stripSprite(o.kind || 'far'), panX = o.panX || 0, x0 = o.x0 ?? 0, w = o.w ?? W;
  const dw = S.w * s, dh = S.h * s, off = pmod(panX * s, dw);
  const cc = mip(ctx, S.c, S.w * s);
  ctx.save();
  for (let xx = x0 - off - (pmod(x0, dw)); xx < x0 + w; xx += dw) {
    if (xx + dw < x0) continue;
    if ((o.reflect ?? 0.35) > 0) { ctx.save(); ctx.globalAlpha = o.reflect ?? 0.35; ctx.translate(0, y); ctx.scale(1, -0.6); ctx.drawImage(cc, xx, -S.by * s, dw, dh); ctx.restore(); }
    ctx.drawImage(cc, xx, y - S.by * s, dw, dh);
  }
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- lights
function torchBeam(ctx, from, to, o = {}) {
  const k = o.k ?? 1; if (k <= 0.01) return;
  const w0 = o.w0 ?? 10, w1 = o.w1 ?? 120, col = o.col || '255,236,190', t = o.t || 0;
  const dx = to[0] - from[0], dy = to[1] - from[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const [wm, am] of [[1, 0.28], [0.45, 0.4]]) {
    ctx.beginPath(); ctx.moveTo(from[0] + nx * w0 * wm, from[1] + ny * w0 * wm); ctx.lineTo(to[0] + nx * w1 * wm, to[1] + ny * w1 * wm);
    ctx.lineTo(to[0] - nx * w1 * wm, to[1] - ny * w1 * wm); ctx.lineTo(from[0] - nx * w0 * wm, from[1] - ny * w0 * wm); ctx.closePath();
    ctx.fillStyle = lgr(ctx, from[0], from[1], to[0], to[1], [[0, `rgba(${col},${am * k})`], [0.7, `rgba(${col},${am * 0.45 * k})`], [1, `rgba(${col},${am * 0.15 * k})`]]);
    ctx.fill();
  }
  if (o.pool !== false) {
    ctx.save(); ctx.translate(to[0], to[1]); ctx.scale(1, o.poolSq ?? 0.32);
    ctx.fillStyle = rgr(ctx, 0, 0, 0, 0, 0, w1 * 1.3, [[0, `rgba(${col},${0.55 * k})`], [0.5, `rgba(${col},${0.22 * k})`], [1, `rgba(${col},0)`]]);
    ctx.fillRect(-w1 * 1.3, -w1 * 1.3, w1 * 2.6, w1 * 2.6); ctx.restore();
  }
  // source glare
  ctx.fillStyle = rgr(ctx, from[0], from[1], 0, from[0], from[1], w0 * 5, [[0, `rgba(255,250,235,${0.95 * k})`], [0.3, `rgba(${col},${0.4 * k})`], [1, `rgba(${col},0)`]]);
  ctx.fillRect(from[0] - w0 * 5, from[1] - w0 * 5, w0 * 10, w0 * 10);
  const r = rng(o.seed ?? 4), nm = o.motes ?? 18;
  ctx.fillStyle = `rgba(255,245,220,1)`;
  for (let i = 0; i < nm; i++) {
    const u = pmod(r() + t * (0.03 + r() * 0.05), 1), v = (r() * 2 - 1) * 0.8, wd = lerp(w0, w1, u);
    const px = from[0] + dx * u + nx * wd * v + Math.sin(t * 2 + i) * 6, py = from[1] + dy * u + ny * wd * v + Math.cos(t * 1.7 + i) * 6;
    ctx.globalAlpha = k * (0.3 + 0.5 * Math.abs(Math.sin(t * 3 + i))) * (1 - u * 0.6);
    ctx.beginPath(); ctx.arc(px, py, 1.2 + r() * 1.8, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function distantTorch(ctx, x, y, s = 1, t = 0, o = {}) {
  const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 5.1);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rgr(ctx, x, y, 0, x, y, 70 * s, [[0, `rgba(255,220,150,${0.9 * fl})`], [0.15, `rgba(255,160,70,${0.6 * fl})`], [1, 'rgba(255,130,50,0)']]);
  ctx.fillRect(x - 70 * s, y - 70 * s, 140 * s, 140 * s);
  if (o.reflect !== false) {
    const wy = o.waterY ?? y + 26 * s;
    for (let i = 0; i < 8; i++) { const hw = (6 + i * 2.5) * s, yy = wy + i * 7 * s; ctx.fillStyle = `rgba(255,160,70,${(0.55 - i * 0.06) * fl})`; ctx.fillRect(x - hw + Math.sin(t * 5 + i) * 2 * s, yy, hw * 2, 3 * s); }
  }
  ctx.fillStyle = `rgba(255,248,230,${fl})`; ctx.beginPath(); ctx.arc(x, y, 3.2 * s, 0, TAU); ctx.fill();
  if (o.beamTo) torchBeam(ctx, [x, y], o.beamTo, { k: 0.5, w0: 2 * s, w1: 30 * s, t, motes: 0 });
  ctx.restore();
}
function xuongMoored(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, fl = o.flip ? -1 : 1, B0 = ctx.getTransform();
  // pole + rope (behind)
  const pole = [x - fl * 470 * s, y];
  if (o.pole !== false) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#0d1729'; ctx.lineWidth = 11 * s; ctx.beginPath(); ctx.moveTo(pole[0], pole[1] + 30 * s); ctx.lineTo(pole[0] + fl * 14 * s, pole[1] - 330 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(166,200,255,0.55)'; ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.moveTo(pole[0] + fl * 4 * s, pole[1] + 20 * s); ctx.lineTo(pole[0] + fl * 18 * s, pole[1] - 326 * s); ctx.stroke();
    ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = '#0d1729'; ctx.lineWidth = 9 * s; ctx.beginPath(); ctx.moveTo(pole[0], pole[1] + 4 * s); ctx.lineTo(pole[0] - fl * 6 * s, pole[1] + 170 * s); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  const box = [x - 620 * s, y - 330 * s, x + 620 * s, y + 70 * s];
  const ret = nightLit(ctx, (c) => {
    const r = NP.xuongBaLa(c, x, y, s, { t, flip: o.flip, bob: o.bob ?? 3, seed: o.seed || 0, part: o.part || 'all' });
    return devToLocal(c.getTransform(), r);
  }, { box, night: o.night ?? 0.42, waterline: y + 3 * s, reflect: 0.35, t, rimW: 3 });
  if (o.pole !== false) {
    ctx.save(); ctx.strokeStyle = 'rgba(30,30,40,0.9)'; ctx.lineWidth = 2.2 * s;
    const sb = ret.stern || [x - fl * 500 * s, y - 150 * s];
    ctx.beginPath(); ctx.moveTo(pole[0] + fl * 8 * s, pole[1] - 110 * s); ctx.quadraticCurveTo((pole[0] + sb[0]) / 2, pole[1] - 40 * s, sb[0], sb[1] + 20 * s); ctx.stroke(); ctx.restore();
  }
  NP.ripples(ctx, x - 600 * s, y - 4 * s, 1200 * s, 30 * s, t, { seed: 9, n: 10, alpha: 0.35, col: '200,222,255' });
  void B0;
  return ret;
}

// ------------------------------------------------------------------------------------------- dike (projected band)
function drawDike(ctx, P, t, d, fire) {
  const Zf = d.Z, Zb = d.Z + (d.depth ?? 150), h = d.h ?? 45;
  const yfb = P.y(Zf), yft = P.hz + (P.camH - h) * P.F / Zf, ybt = P.hz + (P.camH - h) * P.F / Zb;
  const X0 = d.X0 ?? -4000, X1 = d.X1 ?? 4000;
  const xf0 = Math.max(-200, P.x(X0, Zf)), xf1 = Math.min(W + 200, P.x(X1, Zf)), xb0 = Math.max(-200, P.x(X0, Zb)), xb1 = Math.min(W + 200, P.x(X1, Zb));
  if (xf1 < -150 || xf0 > W + 150) return { front: yfb, top: yft, back: ybt };
  const sc = P.s(Zf), r = rng(d.seed ?? 31);
  ctx.save();
  // reflection
  ctx.fillStyle = 'rgba(8,14,28,0.45)'; ctx.fillRect(xf0, yfb, xf1 - xf0, (yfb - yft) * 0.9);
  // top surface
  const bump = (xx, k) => Math.sin(xx * 0.02 + d.Z) * 2.5 * k + Math.sin(xx * 0.057) * 1.5 * k;
  ctx.beginPath(); ctx.moveTo(xb0, ybt); for (let xx = xb0; xx <= xb1; xx += 16) ctx.lineTo(xx, ybt - bump(xx, sc)); ctx.lineTo(xb1, ybt); ctx.lineTo(xf1, yft); ctx.lineTo(xf0, yft); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, ybt, 0, yft, [[0, '#3b4664'], [1, '#2a3350']]); ctx.fill();
  // worn path stripe on top
  const yp0 = lerp(ybt, yft, 0.35), yp1 = lerp(ybt, yft, 0.65);
  ctx.fillStyle = 'rgba(120,135,170,0.25)'; ctx.fillRect(Math.min(xf0, xb0), yp0, Math.max(xf1, xb1) - Math.min(xf0, xb0), Math.max(1, yp1 - yp0));
  // front face
  ctx.beginPath(); ctx.moveTo(xf0, yft); ctx.lineTo(xf1, yft); ctx.lineTo(xf1, yfb); for (let xx = xf1; xx >= xf0; xx -= 20) ctx.lineTo(xx, yfb + Math.sin(xx * 0.03) * 1.5); ctx.closePath();
  ctx.fillStyle = lgr(ctx, 0, yft, 0, yfb, [[0, '#1d2740'], [1, '#121a2e']]); ctx.fill();
  // grass along the top edges (silhouette + rim)
  const gp = new Path2D(), gl = new Path2D(), gh = Math.max(3, 16 * sc);
  for (const [yy, x0, x1, k] of [[ybt, xb0, xb1, P.s(Zb) / sc], [yft, xf0, xf1, 1]]) {
    const step = Math.max(4, 9 * sc * k);
    for (let xx = x0; xx < x1; xx += step * (0.6 + r() * 0.8)) {
      const hh = gh * k * (0.5 + r()), lean = (r() - 0.5) * 0.8;
      gp.moveTo(xx - 2 * sc * k, yy + 1); gp.lineTo(xx + lean * hh, yy - hh); gp.lineTo(xx + 2 * sc * k, yy + 1);
      gl.moveTo(xx + lean * hh, yy - hh); gl.lineTo(xx + 1.5 * sc * k, yy - hh * 0.3);
    }
  }
  ctx.fillStyle = '#0f182b'; ctx.fill(gp);
  ctx.strokeStyle = 'rgba(166,200,255,0.45)'; ctx.lineWidth = Math.max(0.8, 1.2 * sc); ctx.stroke(gl);
  // moon rim on the front top edge
  ctx.strokeStyle = 'rgba(166,200,255,0.35)'; ctx.lineWidth = Math.max(1, 2 * sc); ctx.beginPath(); ctx.moveTo(xf0, yft + 1); ctx.lineTo(xf1, yft + 1); ctx.stroke();
  if (fire && fire.k > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgr(ctx, fire.x, fire.y, 0, fire.x, fire.y, fire.r, [[0, `rgba(255,140,60,${0.55 * fire.k})`], [1, 'rgba(255,120,50,0)']]);
    ctx.fillRect(Math.min(xf0, xb0), ybt - gh * 2, Math.max(xf1, xb1) - Math.min(xf0, xb0), yfb - ybt + gh * 2);
  }
  ctx.restore();
  return { front: yfb, top: yft, back: ybt };
}

// ------------------------------------------------------------------------------------------- FLOOD FIELD (wide)
function floodField(ctx, t, o = {}) {
  const high = clamp(o.high || 0), panX = o.panX || 0, camZ = o.camZ || 0;
  const cm = Object.assign({ zoom: 1, cx: W / 2, cy: H / 2 }, o.cam || {}), z = cm.zoom;
  const vx0 = cm.cx - W / 2 / z - 4, vx1 = cm.cx + W / 2 / z + 4, vy0 = cm.cy - H / 2 / z - 4, vy1 = cm.cy + H / 2 / z + 4;
  const camXY = (p) => [W / 2 + (p[0] - cm.cx) * z, H / 2 + (p[1] - cm.cy) * z];
  const hz0 = o.horizon ?? 900, hz = hz0 - high * 560, camH0 = 300, camH = camH0 * (1 + high * 4.5);
  const P = proj(hz, camH, 1000, panX, W / 2);
  const moon = o.moon || [o.moonX ?? 770, hz - lerp(520, 240, high)];
  const fire = o.fire || 0, fireAt = o.fireAt;
  const toZ = (y) => camH0 * 1000 / Math.max(1, y - hz0); // screen spec at high=0 → world depth
  const ground = (X, Zw) => { const Z = Zw - camZ; return { x: P.x(X, Z), y: P.y(Z), s: P.s(Z) * (1 - 0.35 * high) }; };
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cm.cx, -cm.cy);
  nightSky(ctx, Math.min(vy0, 0), hz + 2, { t, moon, moonS: o.moonS ?? 1, clouds: o.clouds ?? 6, panX, x0: vx0, w: vx1 - vx0, seed: o.seed });
  const treeK = 1 - 0.55 * high;
  treeLine(ctx, hz + 2, 0.5 * treeK, { kind: 'far', panX: panX * 0.04, x0: vx0, w: vx1 - vx0, reflect: 0.25 });
  floodWater(ctx, hz, Math.max(vy1, H), t, { moonX: moon[0], panX, x0: vx0, w: vx1 - vx0, fire, fireAt, glitter: o.glitter });
  // depth-sorted objects
  const objs = [];
  const dike = o.dike === null ? null : Object.assign({ Z: 2600, X0: -4000, X1: 4000, h: 45, depth: 150 }, o.dike || {});
  if (dike && dike.y !== undefined) dike.Z = toZ(dike.y);
  let dret = null;
  const fireL = fireAt && fire > 0 ? { x: fireAt[0], y: fireAt[1], k: fire, r: 700 } : null;
  if (dike) {
    const dz = dike.Z - camZ;
    if (dz > 20) objs.push({ Z: dz, draw: () => { dret = drawDike(ctx, P, t, Object.assign({}, dike, { Z: dz }), fireL); } });
    if (o.palms !== false) {
      const PL = o.palms || [[-1150, 1.0, 0], [-640, 0.85, 1], [-420, 1.1, 2], [520, 1.0, 3], [980, 0.9, 1], [1650, 1.05, 2], [-1900, 0.95, 3]];
      for (const [X, ps, v] of PL) {
        const Zp = dz + (dike.depth ?? 150) * 0.5; if (Zp < 30) continue;
        objs.push({ Z: Zp - 1, draw: () => { const sx = P.x(X, Zp), sc = P.s(Zp); if (sx < -500 * sc || sx > W + 500 * sc) return; palmSil(ctx, sx, P.hz + (P.camH - (dike.h ?? 45)) * P.F / Zp, sc * ps * 0.8 * (1 - 0.3 * high), { v, t }); } });
      }
    }
  }
  let hret = null;
  if (o.hut !== null) {
    const hu = Object.assign({ X: -420, Z: 1900, s: 1, lamp: 0 }, o.hut || {}), Zh = hu.Z - camZ;
    if (Zh > 30) objs.push({ Z: Zh, draw: () => { const sc = P.s(Zh); hret = stiltHut(ctx, P.x(hu.X, Zh), P.y(Zh), sc * hu.s * 0.85 * (1 - 0.3 * high), { t, lamp: hu.lamp, reflect: 0.3 }); } });
  }
  let xret = null;
  if (o.xuong) {
    const xs = o.xuong, Zx = xs.y > hz ? P.Zat(xs.y) : 1e5;
    objs.push({ Z: Zx, draw: () => { xret = xuongMoored(ctx, xs.x, xs.y, xs.s ?? 0.5, { t, flip: xs.flip, pole: xs.pole }); } });
  }
  if (o.torch) { const tr = o.torch, Zt = tr[1] > hz ? P.Zat(tr[1]) : 1e5; objs.push({ Z: Zt + 50, draw: () => distantTorch(ctx, tr[0], tr[1], o.torchS ?? 1, t, { waterY: tr[1] + 22 * (o.torchS ?? 1) }) }); }
  const ret = { horizon: hz, moon: camXY(moon), P, ground: (X, Zw) => { const g = ground(X, Zw), c = camXY([g.x, g.y]); return { x: c[0], y: c[1], s: g.s * z }; }, camXY, dike: null, hut: null, xuong: null };
  ret.dikeY = (x) => (dret ? camXY([x, dret.top])[1] : null);
  if (o.mid) objs.push({ Z: o.midZ ?? 0.5, mid: true, draw: () => { ctx.save(); ret.dike = dret; ret.hut = hret; ret.xuong = xret; o.mid(ctx, ret); ctx.restore(); } });
  objs.sort((a, b) => b.Z - a.Z);
  let zPrev = 1e9;
  const riceO = { rice: o.rice ?? 1, camZ, hk: 1 - 0.5 * high, moonSide: moon[0] > W / 2 ? 1 : -1 };
  for (const ob of objs) {
    if (ob.Z < zPrev) { riceRows(ctx, t, P, Object.assign({}, riceO, { zNear: Math.max(ob.Z, 40), zFar: zPrev })); zPrev = ob.Z; }
    ob.draw();
  }
  if (zPrev > 40) riceRows(ctx, t, P, Object.assign({}, riceO, { zNear: 40, zFar: zPrev }));
  if (fireL) fireGlow(ctx, fireAt[0], fireAt[1], fire, 700, 0.6);
  if ((o.fireflies ?? 30) > 0) fireflies(ctx, t, { n: o.fireflies ?? 30, x0: vx0, y0: hz - 200, w: vx1 - vx0, h: Math.max(vy1, H) - hz + 100, seed: o.seed ?? 21, near: 0.15 });
  ctx.restore();
  ret.dike = dret ? { front: camXY([0, dret.front])[1], top: camXY([0, dret.top])[1], back: camXY([0, dret.back])[1], Z: dike.Z - camZ } : null;
  ret.hut = hret && z !== 1 ? { door: camXY(hret.door), lamp: camXY(hret.lamp), deck: camXY(hret.deck) } : hret;
  ret.xuong = xret;
  return ret;
}

// ------------------------------------------------------------------------------------------- DIKE SCENE (bonfire spot)
const DV = {
  wide: { hz: 1060, camH: 300, Zedge: 1700, fire: [0, 900], tray: [240, 640], sit: [[-260, 860], [260, 860]], moon: [770, 430], moonS: 1.25 },
  close: { hz: 960, camH: 260, Zedge: 1150, fire: [0, 540], tray: [250, 430], sit: [[-290, 560], [290, 560]], moon: [800, 330], moonS: 1.1 },
  ground: { hz: 1330, camH: 85, Zedge: 1000, fire: [0, 400], tray: [240, 330], sit: [[-260, 420], [260, 420]], moon: [700, 560], moonS: 1.6 },
};
let _dikeGrass = null;
function dikeScene(ctx, t, o = {}) {
  const V = Object.assign({}, DV[o.view || 'wide'], o.viewOpts || {}), panX = o.panX || 0, dh = 70;
  const P = proj(V.hz, V.camH, 1000, panX, W / 2);
  const Pw = proj(V.hz, V.camH + dh, 1000, panX, W / 2);
  const yEdge = P.y(V.Zedge), moon = o.moon || V.moon;
  const gp = (X, Z) => [P.x(X, Z), P.y(Z)];
  const fireP = gp(V.fire[0], V.fire[1]), fireAt = o.fireAt || [fireP[0], fireP[1] - 60 * P.s(V.fire[1])], fire = o.fire ?? 0;
  const ret = {
    fire: fireP, fireS: P.s(V.fire[1]), tray: gp(V.tray[0], V.tray[1]), trayS: P.s(V.tray[1]),
    sit: V.sit.map(([X, Z]) => [P.x(X, Z), P.y(Z), P.s(Z)]), horizon: V.hz, moon, P, edgeY: yEdge,
    ground: (X, Z) => ({ x: P.x(X, Z), y: P.y(Z), s: P.s(Z) }),
  };
  nightSky(ctx, 0, V.hz + 2, { t, moon, moonS: o.moonS ?? V.moonS, clouds: o.clouds ?? 6, panX, seed: o.seed });
  treeLine(ctx, V.hz + 2, 0.55, { kind: 'far', panX: panX * 0.04, reflect: 0.25 });
  floodWater(ctx, V.hz, yEdge + 4, t, { moonX: moon[0], panX, glitter: 70, ripples: 50, fire: fire * 0.6, fireAt: [fireAt[0], V.hz + 10], fireW: 0.8 });
  // far things in the field: hut, palms in the water
  const ZwMin = Pw.Zat(yEdge);
  const far = [];
  if (o.hut !== null) { const hu = Object.assign({ X: -900, Z: 5200, s: 1, lamp: 0.6 }, o.hut || {}); far.push({ Z: hu.Z, draw: () => stiltHut(ctx, Pw.x(hu.X, hu.Z), Pw.y(hu.Z), Pw.s(hu.Z) * hu.s * 0.85, { t, lamp: hu.lamp }) }); }
  for (const [X, Z, ps, v] of (o.farPalms || [[1300, 4200, 1, 0], [1650, 4800, 0.9, 2], [-2100, 6000, 1, 1]])) far.push({ Z, draw: () => palmSil(ctx, Pw.x(X, Z), Pw.y(Z), Pw.s(Z) * ps * 0.9, { v, t }) });
  far.sort((a, b) => b.Z - a.Z);
  let zp = 1e9;
  for (const f of far) { riceRows(ctx, t, Pw, { zNear: Math.max(f.Z, ZwMin), zFar: zp, moonSide: 1 }); zp = f.Z; f.draw(); }
  riceRows(ctx, t, Pw, { zNear: ZwMin, zFar: zp, moonSide: 1, yMax: yEdge + 2 });
  // dike top ground
  ctx.save();
  const gTop = new Path2D(); gTop.moveTo(-10, yEdge + 3);
  for (let xx = -10; xx <= W + 10; xx += 24) gTop.lineTo(xx, yEdge + Math.sin(xx * 0.017 + 1) * 3 + Math.sin(xx * 0.05) * 1.5);
  gTop.lineTo(W + 10, yEdge); gTop.lineTo(W + 10, H + 10); gTop.lineTo(-10, H + 10); gTop.closePath();
  ctx.fillStyle = lgr(ctx, 0, yEdge, 0, H, [[0, '#4a5474'], [0.25, '#363d58'], [1, '#191b27']]); ctx.fill(gTop);
  ctx.save(); ctx.clip(gTop);
  // worn path band (perspective) + ruts
  const pz0 = V.Zedge * 0.62, pz1 = V.Zedge * 0.8;
  ctx.fillStyle = 'rgba(140,150,185,0.16)'; ctx.fillRect(0, P.y(pz1), W, P.y(pz0) - P.y(pz1));
  const r = rng(o.seed ?? 12);
  // mud texture smears
  const sm = new Path2D();
  for (let i = 0; i < 90; i++) { const Z = lerp(P.Zat(H), V.Zedge, Math.pow(r(), 1.6)), X = panX + (r() - 0.5) * 2.4 * Z, sx = P.x(X, Z), sy = P.y(Z), sc = P.s(Z), lw = (20 + r() * 50) * sc; sm.moveTo(sx - lw, sy); sm.quadraticCurveTo(sx, sy - 2 * sc, sx + lw, sy + sc); }
  ctx.strokeStyle = 'rgba(15,16,26,0.35)'; ctx.lineWidth = 2; ctx.stroke(sm);
  // footprints along the path
  ctx.fillStyle = 'rgba(14,16,26,0.45)';
  for (let i = 0; i < 14; i++) { const X = -700 + i * 110 + (i % 2) * 20, Z = lerp(pz0, pz1, 0.3 + (i % 2) * 0.35), sc = P.s(Z); ell(ctx, P.x(X, Z), P.y(Z), 10 * sc, 4 * sc * V.camH / Z * 3); ctx.fill(); }
  // straw scraps
  if (o.straw !== false) {
    const sp = [new Path2D(), new Path2D(), new Path2D()];
    const fs = P.s(V.fire[1]);
    for (let i = 0; i < 170; i++) {
      const near = i < 70, Z = near ? V.fire[1] + (r() - 0.5) * 360 : lerp(P.Zat(H), V.Zedge, r()), X = near ? V.fire[0] + (r() - 0.5) * 900 : panX + (r() - 0.5) * 2.2 * Z;
      if (Z < 30) continue;
      const sx = P.x(X, Z), sy = P.y(Z), sc = P.s(Z), len = (14 + r() * 30) * sc, a = (r() - 0.5) * 2.2;
      const dfire = Math.hypot(sx - fireP[0], (sy - fireP[1]) * 2) / (fs * 420);
      const b = dfire < 0.7 ? 0 : dfire < 1.6 ? 1 : 2;
      sp[b].moveTo(sx - Math.cos(a) * len, sy - Math.sin(a) * len * 0.3); sp[b].quadraticCurveTo(sx, sy - 3 * sc, sx + Math.cos(a) * len, sy + Math.sin(a) * len * 0.3);
    }
    ctx.lineCap = 'round';
    const fk = fire;
    for (let b = 0; b < 3; b++) { ctx.strokeStyle = mixc(mixc('#7d7a88', '#9a8a68', 0.4), b === 0 ? '#ffd27a' : b === 1 ? '#d9a860' : '#9a8a68', [fk, fk * 0.7, fk * 0.3][b]); ctx.lineWidth = 2.2; ctx.stroke(sp[b]); }
  }
  // woven tray mat area (nia) placeholder ring when requested
  if (o.tray === 'mat') { const [tx, ty] = ret.tray, ts = ret.trayS; ell(ctx, tx, ty, 170 * ts, 170 * ts * V.camH / V.tray[1]); ctx.fillStyle = 'rgba(20,18,26,0.4)'; ctx.fill(); }
  // fire light on the ground
  if (fire > 0.01) {
    const fs = P.s(V.fire[1]);
    fireGlow(ctx, fireP[0], fireP[1], fire, 820 * fs, 0.32);
    fireGlow(ctx, fireP[0], fireP[1], fire * 0.8, 260 * fs, 0.35);
  }
  ctx.restore();
  // grass along the far edge (silhouette against the water) + moon rim
  const gp1 = new Path2D(), gl1 = new Path2D(), es = P.s(V.Zedge);
  for (let xx = -10; xx < W + 10; xx += 5 + r() * 7) {
    const hh = (12 + r() * 26) * es, lean = (r() - 0.5) * 0.9, yy = yEdge + Math.sin(xx * 0.017 + 1) * 3 + 4;
    gp1.moveTo(xx - 2.4 * es, yy); gp1.lineTo(xx + lean * hh, yy - hh); gp1.lineTo(xx + 2.4 * es, yy);
    gl1.moveTo(xx + lean * hh, yy - hh); gl1.lineTo(xx + 1.6 * es, yy - hh * 0.35);
  }
  ctx.fillStyle = '#121b30'; ctx.fill(gp1);
  ctx.strokeStyle = 'rgba(166,200,255,0.5)'; ctx.lineWidth = 1.3; ctx.stroke(gl1);
  if (fire > 0.01) { ctx.globalCompositeOperation = 'screen'; fireGlow(ctx, fireP[0], yEdge, fire * 0.5, 600 * P.s(V.fire[1]), 0.25); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  // palms standing on our dike at the sides (framing)
  for (const [X, Z, ps, v, flip] of (o.palms || [[-820, 1250, 1.0, 1, false], [940, 1500, 0.95, 3, true]])) {
    if (Z < 60) continue;
    const sx = P.x(X, Z), sc = P.s(Z) * ps * 0.95;
    if (sx < -420 * sc || sx > W + 420 * sc) continue;
    palmSil(ctx, sx, P.y(Z), sc, { v, t, flip });
    if (fire > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, sx, P.y(Z), 0, sx, P.y(Z), 160 * sc, [[0, `rgba(255,140,60,${0.25 * fire})`], [1, 'rgba(255,140,60,0)']]); ctx.fillRect(sx - 160 * sc, P.y(Z) - 160 * sc, 320 * sc, 320 * sc); ctx.restore(); }
  }
  if (o.mid) { ctx.save(); o.mid(ctx, ret); ctx.restore(); }
  if (o.fireflies !== 0) fireflies(ctx, t, { n: o.fireflies ?? 20, y0: V.hz - 350, h: 700, seed: (o.seed ?? 21) + 3, near: 0.2 });
  if (o.front !== false) frontGrass(ctx, t, fire, fireP);
  return ret;
}
function frontGrass(ctx, t, fire = 0, fireP = [540, 1400]) {
  if (!_dikeGrass) {
    const [c, x] = canvas(420, 360), r = rng(88);
    x.fillStyle = '#080d1a';
    for (let i = 0; i < 46; i++) {
      const bx = r() * 380 + 10, hh = 120 + r() * 220, lean = (r() - 0.35) * 0.9, bw = 6 + r() * 7;
      x.beginPath(); x.moveTo(bx - bw, 360); x.quadraticCurveTo(bx + lean * hh * 0.3, 360 - hh * 0.6, bx + lean * hh * 0.8, 360 - hh); x.quadraticCurveTo(bx + lean * hh * 0.3 + bw * 0.4, 360 - hh * 0.6, bx + bw, 360); x.fill();
    }
    rimify(c, 3, -2, NIGHT.rim, 0.6);
    _dikeGrass = c;
  }
  const sw = Math.sin(t * 1.1) * 0.02;
  for (const [x, fl] of [[-40, 1], [W + 40, -1]]) {
    ctx.save(); ctx.translate(x, H + 6); ctx.rotate(sw * fl); ctx.scale(fl * 1.1, 1.1); ctx.drawImage(_dikeGrass, -60, -360); ctx.restore();
  }
  void fire; void fireP;
}

// ------------------------------------------------------------------------------------------- WATER CLOSE (low camera)
let _stalk = null;
function stalkSprite() {
  if (_stalk) return _stalk;
  const [c, x] = canvas(360, 640), r = rng(51);
  for (let i = 0; i < 9; i++) {
    const bx = 170 + (i - 4) * 9, hh = 380 + r() * 220, lean = (i - 4) * 0.12 + (r() - 0.5) * 0.2, bw = 9 + r() * 4;
    const tx = bx + lean * hh * 0.7, ty = 630 - hh;
    x.fillStyle = '#0f2621'; x.beginPath(); x.moveTo(bx - bw, 640); x.quadraticCurveTo(bx + lean * hh * 0.2 - bw * 0.3, 640 - hh * 0.6, tx, ty); x.quadraticCurveTo(bx + lean * hh * 0.2 + bw * 0.5, 640 - hh * 0.6, bx + bw, 640); x.fill();
    x.fillStyle = 'rgba(80,140,105,0.75)'; x.beginPath(); x.moveTo(bx + bw * 0.1, 636); x.quadraticCurveTo(bx + lean * hh * 0.2 + bw * 0.4, 640 - hh * 0.6, tx, ty); x.quadraticCurveTo(bx + lean * hh * 0.2 + bw * 0.6, 640 - hh * 0.6, bx + bw * 0.9, 636); x.fill();
  }
  rimify(c, 3, -2, '#bfe6ff', 0.7);
  _stalk = c; return c;
}
function fieldWaterClose(ctx, t, o = {}) {
  const hz = o.horizon ?? 820, camH = o.camH ?? 70, panX = o.panX || 0;
  const P = proj(hz, camH, 1000, panX, W / 2);
  const moon = o.moon || [800, hz - 500];
  const fire = o.fire || 0, fireAt = o.fireAt;
  const ret = {
    horizon: hz, moon, P,
    wl: (s) => hz + camH * s, feet: (s, depth = 120) => hz + camH * s + depth * s, sOf: (y) => (y - hz) / camH,
    ground: (X, Z) => ({ x: P.x(X, Z), y: P.y(Z), s: P.s(Z) }),
  };
  nightSky(ctx, 0, hz + 2, { t, moon, moonS: o.moonS ?? 1.1, clouds: o.clouds ?? 5, panX, seed: o.seed });
  treeLine(ctx, hz + 2, 0.75, { kind: 'near', panX: panX * 0.06, reflect: 0.3 });
  floodWater(ctx, hz, H, t, { moonX: moon[0], panX, fire, fireAt, glitter: 150, ripples: 110 });
  const objs = [];
  if (o.hut) { const hu = Object.assign({ X: -700, Z: 2600, s: 1, lamp: 0.5 }, o.hut); objs.push({ Z: hu.Z, draw: () => stiltHut(ctx, P.x(hu.X, hu.Z), P.y(hu.Z), P.s(hu.Z) * hu.s * 0.85, { t, lamp: hu.lamp }) }); }
  for (const [X, Z, ps, v] of (o.palms || [[1400, 3600, 1, 2], [-1900, 4200, 1.1, 0]])) objs.push({ Z, draw: () => palmSil(ctx, P.x(X, Z), P.y(Z), P.s(Z) * ps * 0.9, { v, t }) });
  if (o.xuong) { const xs = o.xuong; objs.push({ Z: P.Zat(xs.y), draw: () => { ret.xuong = xuongMoored(ctx, xs.x, xs.y, xs.s ?? 0.6, { t, flip: xs.flip, pole: xs.pole }); } }); }
  if (o.mid) objs.push({ Z: o.midZ ?? 0.5, draw: () => { ctx.save(); o.mid(ctx, ret); ctx.restore(); } });
  objs.sort((a, b) => b.Z - a.Z);
  const zN = o.zNear ?? 150, ro = { rice: o.rice ?? 1, moonSide: moon[0] > W / 2 ? 1 : -1 };
  let zp = 1e9;
  for (const ob of objs) { if (ob.Z < zp) { riceRows(ctx, t, P, Object.assign({}, ro, { zNear: Math.max(ob.Z, zN), zFar: zp })); zp = Math.max(ob.Z, zN); } ob.draw(); }
  if (zp > zN) riceRows(ctx, t, P, Object.assign({}, ro, { zNear: zN, zFar: zp }));
  if (fireAt && fire > 0) fireGlow(ctx, fireAt[0], fireAt[1], fire, 700, 0.5);
  if (o.beam) torchBeam(ctx, o.beam.from, o.beam.to, Object.assign({ t }, o.beam));
  if ((o.fireflies ?? 16) > 0) fireflies(ctx, t, { n: o.fireflies ?? 16, y0: hz - 300, h: 900, seed: (o.seed ?? 21) + 7, near: 0.3 });
  if (o.frontStalks !== false) {
    const sp = stalkSprite(), sw = Math.sin(t * 1.2) * 0.025;
    for (const [x, sc, fl, ph] of [[60, 1.25, 1, 0], [-30, 0.95, -1, 1.3], [W - 40, 1.15, -1, 0.6], [W + 30, 0.9, 1, 2]]) {
      ctx.save(); ctx.translate(x, H + 30); ctx.rotate(sw * Math.sin(t + ph) * 1.4); ctx.scale(fl * sc, sc); ctx.drawImage(sp, -180, -640); ctx.restore();
    }
  }
  return ret;
}

module.exports = {
  NIGHT, proj, nightLit, nightSky, floodWater, riceRows, fireflies, fireGlow, palmSil, stiltHut, treeLine, torchBeam,
  distantTorch, xuongMoored, floodField, dikeScene, fieldWaterClose, frontGrass, devToLocal, rimify, DV,
};
