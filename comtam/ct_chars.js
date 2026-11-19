// ============================================================================
// ct_chars.js : CƠM TẤM SÀI GÒN characters   (1080x1920, 30 fps, @napi-rs/canvas)
// ----------------------------------------------------------------------------
// Rig conventions (same family as caloc/cl_chars.js):
//   * every full-figure drawer is  fn(ctx, x, y, s = 1, o = {})  with (x, y) =
//     the point BETWEEN THE FEET on the floor, in the caller's LOCAL coords;
//     s = character scale (use alley anchors: a.vendor.s, a.customer.s, a.seat.s
//     or ct_env sAt(Z): 1 m = 322.6 px at s = 1).
//   * figures face +x (3/4 view toward camera); o.flip mirrors (faces -x).
//   * every drawer save()/restore()s; deterministic (o.t drives all motion,
//     no Math.random); returned anchors are in the caller's LOCAL coords.
//   * lighting (all optional, all figure-clipped):
//       o.dawn  0..1       ambient grade from ct_env dawnPal (cobalt -> rose -> peach)
//                          + a key rim from the sky (o.rim scales it, 0 = off)
//       o.light {x,y,k,r}  warm charcoal-ember light (LOCAL pos, k 0..1, r radius px)
//                          -> orange wash + orange rim on the side facing it
//       o.neon  {col,k,x,y} neon rim: col 'pink' | 'cyan' | 'r,g,b'; x,y = LOCAL
//                          position of the sign (or side:-1|1); adds a coloured
//                          spill + rim on that side
//     With none of them the figure is drawn straight into ctx (fastest).
//     With any of them it is drawn through one reused offscreen buffer.
//   * o.shadow false hides the contact shadow.
//
// ---- CÔ NĂM (50s Saigon vendor) ----------------------------------------------
// coNam(ctx, x, y, s = 1, o) -> anchors          ~500 px tall at s = 1 (1.55 m)
//   look: round friendly face, low bun + raspberry claw clip (kẹp càng cua),
//   gold ear studs, beauty mark; lilac áo bà ba with tiny white flowers, rolled
//   sleeves, side slits; dark-green waist apron + checkered towel; black satin
//   wide trousers; rubber slide sandals.
//   o.pose:
//     'stand'    idle (hand resting on apron)
//     'fan'      fanning the grill in front (+x) with a quạt nan; o.k 0..1 = effort
//                (speed + amplitude), o.t drives it.        -> a.fan {grip,center,rot,dir}
//     'tongs'    steel tongs over the grill, o.k 0..1 = one flip (lift, twist,
//                set down); fan hangs in the other hand (o.fanL false hides).
//                                                           -> a.tongs {tip, base, ang, open}
//     'plate'    serving a plate held out on her palm; o.k 0..1 = reach (0 at chest,
//                1 arm out). o.plateFn(ctx, p) draws the food: p {x,y,rx,ry,s} in LOCAL
//                coords (s = LOCAL px per figure unit); default = empty white plate.
//                                                           -> a.plate {x,y,rx,ry,s}
//     'pour'     small fish-sauce bowl (chén nước mắm), o.k 0..1 tilt.
//                                                           -> a.pour {x,y} (lip; start of the stream), a.bowl {x,y}
//     'eyebrow'  skeptical: arms crossed, one brow up, mouth pulled sideways
//     'laugh'    belly laugh, head back, hand slapping the air (o.t bounces)
//     'wipe'     towel circles at o.at {x,y} (LOCAL target, clamped to reach)
//                                                           -> a.towel {x,y}
//     'steer'    hand on someone's shoulder at o.at {x,y} (LOCAL), other palm
//                showing the way (o.k 0..1 push)
//     'wave'     waving hello (o.t)
//     'thumbs'   thumbs up; o.wink true -> wink
//   o.expr overrides: 'smile' | 'grin' | 'laugh' | 'talk' | 'o' | 'neutral' |
//     'skeptic' | 'wink' | 'proud' | 'focus';  o.turn (-1..1, default 0.35),
//     o.tilt, o.lookX / o.lookY (-1..1), o.lean (added), o.t.
//   -> { head, face:{x,y,s}, eyes, mouth, handL, handR, footL, footR, hip, + pose extras }
//      face.s = LOCAL px per head unit (head radius ~108 head units).
//
// coNamFace(ctx, x, y, s = 1, o) -> anchors        close-up bust, (x,y) = head centre,
//   head radius ~270 px at s = 1 (fills ~half the frame width). Same o.expr / turn /
//   tilt / lookX / lookY / t / dawn / light / neon / wink; o.brow -1..1 extra brow lift.
//   -> { head, eyes, mouth, nose, s }
//
// ---- TOURIST (Western backpacker) ----------------------------------------------
// tourist(ctx, x, y, s = 1, o) -> anchors          ~600 px tall at s = 1 (1.85 m)
//   look: messy blond hair, sunglasses pushed up on the head, sunburnt nose,
//   freckles, turquoise tee with a sun print, khaki cargo shorts, white sneakers,
//   orange backpack (o.pack false hides).
//   o.pose:
//     'stand'      idle
//     'walk'       o.t gait (o.speed, default 0.8 cycles/s)
//     'sniff'      nose up, eyes closed, drifting toward the smell; o.k 0..1 = float
//                  (heels lift, body rises, arms trail)       -> a.nose
//     'grabFan'    reaching forward for the fan, o.k 0..1 (grips + holds it from 0.7)
//                                                             -> a.fan
//     'fanFrantic' fanning the grill like crazy: blurred ghost arms + speed lines, o.t
//                                                             -> a.fan
//     'stiff'      post-explosion: rigid plank, arms down, eyes wide (o.k 0..1 tilt back)
//     'sit'        on a low plastic stool: (x,y) = STOOL SEAT centre (a.seat), feet
//                  on the floor o.seatH px below (default 0.30 m * s*322.6), knees high
//     'eat'        seated, spoon (right) + fork (left); o.k 0..1 spoon plate -> mouth
//                                                             -> a.spoon (bowl tip), a.plate (lap / table point)
//     'thumbs'     thumbs up (grin)
//     'wave'       waving
//     'wink'       finger-gun at camera + wink
//     o.sit true seats 'thumbs' | 'wave' | 'wink' | 'stand' on the stool too.
//   soot (after the flare-up):
//     o.soot 0..1 (face, tee, arms blackened, seeded blotches), o.hairUp 0..1
//     (singed hair standing up, glasses knocked askew), o.raccoon 0..1 (clean
//     rings round the eyes), o.blink 0..1 (lids), o.smokeWisps 0..1 (curls rising
//     off the hair, o.t).
//   o.expr: 'smile' | 'grin' | 'o' | 'sniff' | 'strain' | 'stiff' | 'chew' | 'wink' |
//     'delight' | 'cough';  o.turn / tilt / lookX / lookY / t / lean as Cô Năm.
//   -> { head, face:{x,y,s}, eyes, mouth, nose, handL, handR, footL, footR, hip, + extras }
//
// touristFace(ctx, x, y, s = 1, o) -> anchors       close-up bust, same conventions as
//   coNamFace; same expr + soot options; o.k with expr 'chew' bulges the cheek.
//   -> { head, eyes, mouth, nose, s }
//
// ---- EXTRAS --------------------------------------------------------------------
// cat(ctx, x, y, s = 1, o) -> {head, top}   orange tabby curled asleep; (x,y) = seat-top
//   centre it lies on (a.stool2), ~150 px long at s = 1. o.t breathing + tail tip,
//   o.wake 0..1 (ear flick, one eye slits open), o.col 'orange' | 'grey'.
// rooster(ctx, x, y, s = 1, o) -> {beak}    silhouette on a wall / roof, feet at (x,y),
//   ~200 px tall at s = 1, faces +x. o.crow 0..1 (neck stretches, head back, beak
//   opens), o.col (default deep indigo), o.rimCol (dawn rim, default peach), o.flip.
// quatNan(ctx, x, y, s, rot, o) woven bamboo hand fan, (x,y) = grip, blade toward
//   -y rotated by rot; ~170 px at s = 1. o.blur 0..1 smears it (frantic fanning).
//
// ---- TIMINGS (see _test_ct_envchars.js, warm cache) --------------------------------
//   one fresh process, single core, ms per call:
//   coNam plain ~6 | coNam dawn+ember+neon ~25 | coNam s=2 lit ~30
//   coNamFace plain ~7 | coNamFace dawn+neon ~27 | touristFace lit ~29
//   tourist plain ~4-6 | tourist fanFrantic soot+dawn+ember ~26 | cat ~2 | rooster ~2
//   Lighting cost scales with the lit box pixel area (buffer + 3 passes per rim);
//   rim:0 drops the rims, omitting dawn/light/neon skips the buffer entirely.
//   Mouth anchors: Co Nam face y 64, tourist face y 80 (head units, HS-scaled).
// ============================================================================
'use strict';
const L = require('./lib');
const PR = require('./props');
const E = require('./ct_env');
const { Path2D } = require('@napi-rs/canvas');
const { TAU, rng, clamp, lerp, inv, ease, createCanvas } = L;
const { ik, seg } = PR;
const PI = Math.PI;

// ================================================================== small helpers
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mulv = (a, k) => [a[0] * k, a[1] * k];
const lerpP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const norm = (a) => { const d = Math.hypot(a[0], a[1]) || 1; return [a[0] / d, a[1] / d]; };
const rot2 = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const _hx = new Map();
function hx(c) {
  if (Array.isArray(c)) return c;
  let v = _hx.get(c); if (v) return v;
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; } else { const m = c.match(/[\d.]+/g); v = [+m[0], +m[1], +m[2]]; }
  _hx.set(c, v); return v;
}
function mixc(a, b, t) { const A = hx(a), B = hx(b); t = clamp(t); return `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`; }
function rgba(c, a) { const A = hx(c); return `rgba(${A[0] | 0},${A[1] | 0},${A[2] | 0},${a})`; }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function lgr(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function rgr(ctx, x0, y0, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function ell(ctx, x, y, rx, ry, r = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), r, 0, TAU); }
function ikPick(ax, ay, bx, by, l1, l2, preferX) { const a = ik(ax, ay, bx, by, l1, l2, 1), b = ik(ax, ay, bx, by, l1, l2, -1); return (preferX < 0 ? a[0] < b[0] : a[0] > b[0]) ? a : b; }
function ikUp(ax, ay, bx, by, l1, l2, preferY) { const a = ik(ax, ay, bx, by, l1, l2, 1), b = ik(ax, ay, bx, by, l1, l2, -1); return (preferY < 0 ? a[1] < b[1] : a[1] > b[1]) ? a : b; }
function clampTo(p, o, r) { const dx = p[0] - o[0], dy = p[1] - o[1], d = Math.hypot(dx, dy); return d <= r ? p : [o[0] + dx / d * r, o[1] + dy / d * r]; }
const OUT = 'rgba(40,20,42,0.66)';
function capPath(ctx, x0, y0, x1, y1, w0, w1) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + PI / 2, a - PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - PI / 2, a + PI / 2, true);
  ctx.closePath();
}
function capFS(ctx, x0, y0, x1, y1, w0, w1, fill, lw = 2.4, out = OUT) {
  ctx.beginPath(); capPath(ctx, x0, y0, x1, y1, w0, w1);
  if (lw) { ctx.strokeStyle = out; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function outFill(ctx, fill, lw = 2.4, out = OUT) { if (lw) { ctx.strokeStyle = out; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); } ctx.fillStyle = fill; ctx.fill(); }
const handRot = (e, h, bias = 0) => Math.atan2(h[1] - e[1], h[0] - e[0]) + bias;

// ================================================================== lighting buffer
const _bufs = [];
function buf(i, w, h) {
  let b = _bufs[i];
  if (!b || b.w < w || b.h < h) {
    const nw = Math.ceil(Math.max(w, b ? b.w : 0, 64)), nh = Math.ceil(Math.max(h, b ? b.h : 0, 64));
    const c = createCanvas(nw, nh); b = _bufs[i] = { c, x: c.getContext('2d'), w: nw, h: nh };
  }
  return b;
}
const NEON = { pink: '255,70,175', cyan: '70,225,255', magenta: '255,60,200', violet: '170,110,255' };
const neonCol = (c) => NEON[c] || (typeof c === 'string' && c[0] === '#' ? hx(c).join(',') : c) || NEON.pink;
let _lvl = 0;
// draws fn(ctxLike) (LOCAL coords) through a buffer and applies dawn grade / ember / neon rims.
// box = LOCAL [x0,y0,x1,y1] that bounds the figure; sc = character scale (rim width).
function lit(ctx, box, sc, fn, o) {
  const dawn = o.dawn, light = o.light && (o.light.k ?? 1) > 0.01 ? o.light : null, neon = o.neon && (o.neon.k ?? 1) > 0.01 ? o.neon : null;
  if ((dawn === undefined || dawn === null) && !light && !neon) return fn(ctx);
  if (_lvl > 0) return fn(ctx);
  const m = ctx.getTransform();
  const CW = ctx.canvas ? ctx.canvas.width : 1080, CH = ctx.canvas ? ctx.canvas.height : 1920;
  const dv = (p) => [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f];
  const cs = [dv([box[0], box[1]]), dv([box[2], box[1]]), dv([box[0], box[3]]), dv([box[2], box[3]])];
  const bx0 = Math.max(0, Math.floor(Math.min(cs[0][0], cs[1][0], cs[2][0], cs[3][0])));
  const by0 = Math.max(0, Math.floor(Math.min(cs[0][1], cs[1][1], cs[2][1], cs[3][1])));
  const bx1 = Math.min(CW, Math.ceil(Math.max(cs[0][0], cs[1][0], cs[2][0], cs[3][0])));
  const by1 = Math.min(CH, Math.ceil(Math.max(cs[0][1], cs[1][1], cs[2][1], cs[3][1])));
  const bw = bx1 - bx0, bh = by1 - by0;
  if (bw < 2 || bh < 2) return fn(ctx);
  const A = buf(0, bw, bh), B = buf(1, bw, bh), x = A.x;
  const dsc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  _lvl++;
  let ret;
  try {
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, Math.min(A.w, bw + 4), Math.min(A.h, bh + 4));
    x.beginPath(); x.rect(0, 0, bw, bh); x.clip();
    x.setTransform(m.a, m.b, m.c, m.d, m.e - bx0, m.f - by0);
    ret = fn(x);
    x.restore();
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop';
    const cx = bw / 2, cy = bh / 2, rw = Math.max(1.5, (o.rimW ?? 5) * sc * dsc);
    const rims = [];
    if (dawn !== undefined && dawn !== null) {
      const d = clamp(dawn), pal = E.dawnPal(d), ak = o.amb ?? 1;
      x.fillStyle = E.ctCss(pal.amb, (0.30 - 0.14 * d) * ak); x.fillRect(0, 0, bw, bh);
      const fy = Math.floor(bh * 0.55); x.fillStyle = lgr(x, 0, fy, 0, bh, [[0, 'rgba(0,0,0,0)'], [1, `rgba(12,8,34,${(0.26 - 0.12 * d) * ak})`]]); x.fillRect(0, fy, bw, bh - fy);
      const rk = (o.rim ?? 1) * (0.35 + 0.5 * d);
      if (rk > 0.02) { const sd = o.sunDir || [0.78, -0.62], sl = Math.hypot(sd[0], sd[1]); rims.push({ dx: sd[0] / sl * rw * 0.8, dy: sd[1] / sl * rw * 0.8, col: E.ctCss(pal.key), a: Math.min(0.9, rk) }); }
    }
    if (light) {
      const k = light.k ?? 1, lp = dv([light.x, light.y]), R = (light.r ?? 520) * sc * dsc;
      const lx = lp[0] - bx0, ly = lp[1] - by0;
      x.fillStyle = rgr(x, lx, ly, 0, lx, ly, R, [[0, `rgba(255,150,70,${0.62 * k})`], [0.4, `rgba(255,120,55,${0.34 * k})`], [1, 'rgba(255,110,50,0)']]);
      x.fillRect(0, 0, bw, bh);
      const dl = Math.hypot(lx - cx, ly - cy) || 1;
      rims.push({ dx: (lx - cx) / dl * rw * 1.25, dy: (ly - cy) / dl * rw * 1.25, col: '#ffb060', a: Math.min(1, 0.95 * k) });
    }
    if (neon) {
      const k = neon.k ?? 1, col = neonCol(neon.col);
      let nx, ny;
      if (neon.x !== undefined) { const np = dv([neon.x, neon.y]); nx = np[0] - bx0; ny = np[1] - by0; } else { nx = cx + (neon.side ?? -1) * bw; ny = cy - bh * 0.3; }
      x.fillStyle = rgr(x, nx, ny, 0, nx, ny, Math.max(bw, bh) * 1.1, [[0, `rgba(${col},${0.42 * k})`], [0.5, `rgba(${col},${0.14 * k})`], [1, `rgba(${col},0)`]]);
      x.fillRect(0, 0, bw, bh);
      const dl = Math.hypot(nx - cx, ny - cy) || 1;
      rims.push({ dx: (nx - cx) / dl * rw, dy: (ny - cy) / dl * rw, col: `rgb(${col})`, a: Math.min(1, 0.9 * k) });
    }
    for (const r of rims) {
      const y = B.x; y.save(); y.setTransform(1, 0, 0, 1, 0, 0); y.globalAlpha = 1;
      y.globalCompositeOperation = 'copy'; y.fillStyle = r.col; y.fillRect(0, 0, bw, bh);
      y.globalCompositeOperation = 'destination-out'; y.drawImage(A.c, 0, 0, bw, bh, -r.dx, -r.dy, bw, bh);
      y.restore();
      x.globalAlpha = r.a; x.drawImage(B.c, 0, 0, bw, bh, 0, 0, bw, bh); x.globalAlpha = 1;
    }
    x.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(A.c, 0, 0, bw, bh, bx0, by0, bw, bh); ctx.restore();
  } finally { _lvl--; }
  return ret;
}

// ================================================================== hands (wrist origin, fingers +x, ~100 long)
const SK_CN = ['#f2c69c', '#dca077', '#b8744d'];
const SK_TR = ['#f9dcc6', '#eab396', '#cc8670'];
function cHand(ctx, x, y, s, rot, o = {}) {
  const kind = o.kind || 'open', sk = o.skin || SK_CN, fl = o.flip ? -1 : 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s * fl);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const g = lgr(ctx, 0, -34, 0, 34, [[0, sk[0]], [0.65, sk[1]], [1, sk[2]]]);
  const parts = [];
  const C = (x0, y0, x1, y1, w0, w1) => parts.push((c) => capPath(c, x0, y0, x1, y1, w0, w1));
  const Rr = (rx, ry, rw, rh, rr) => parts.push((c) => c.roundRect(rx, ry, rw, rh, rr));
  const palm = () => parts.push((c) => {
    c.moveTo(-6, -17); c.bezierCurveTo(14, -27, 44, -27, 56, -18); c.quadraticCurveTo(64, 0, 56, 20);
    c.bezierCurveTo(42, 27, 12, 26, -6, 16); c.closePath();
  });
  const curled = () => { for (let i = 0; i < 4; i++) Rr(40, -21 + i * 10.5 - (i === 3 ? 1 : 0), 27 - i * 2, 12.5, 6.2); };
  C(-22, 0, 4, 0, 27, 31);
  if (kind === 'open' || kind === 'wave' || kind === 'flat') {
    const sp = kind === 'wave' ? 1.35 : kind === 'flat' ? 0.25 : 1;
    [[-15, -0.36, 37], [-5, -0.12, 44], [5, 0.1, 41], [14.5, 0.33, 32]].forEach(([yy, a, Ln], i) => {
      C(50, yy, 50 + Math.cos(a * sp) * Ln, yy + Math.sin(a * sp) * Ln * (kind === 'flat' ? 0.4 : 1), 13.5 - i * 0.6, 11 - i * 0.6);
    });
    palm();
    if (kind === 'flat') C(12, -16, 44, -28, 15, 11); else C(10, -14, 32, -40, 15, 11.5);
  } else if (kind === 'point') {
    C(50, -14, 98, -18, 13.5, 11); palm(); for (let i = 1; i < 4; i++) Rr(42, -21 + i * 10.5, 24 - i * 2, 12, 6);
    C(18, -16, 26, -58, 14, 11);
  } else if (kind === 'pinch') {
    palm(); for (let i = 1; i < 4; i++) Rr(42, -21 + i * 10.5, 25 - i * 2, 12, 6);
    C(50, -14, 78, -27, 13, 10.5); C(12, -16, 74, -33, 15, 10.5);
  } else if (kind === 'thumb') {
    palm(); curled(); C(24, -16, 26, -60, 17, 13.5);
  } else {
    palm(); curled();
    if (kind === 'grip') C(20, -20, 56, -24, 15, 11.5); else C(18, -18, 52, -10, 15, 11.5);
  }
  for (const p of parts) { ctx.beginPath(); p(ctx); ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.stroke(); ctx.fillStyle = g; ctx.fill(); }
  ctx.strokeStyle = 'rgba(110,50,35,0.32)'; ctx.lineWidth = 1.8;
  if (kind === 'grip' || kind === 'fist' || kind === 'thumb') {
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(46, -15 + i * 10.5); ctx.lineTo(52, -14.5 + i * 10.5); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,236,222,0.7)';
  if (kind === 'thumb') { ell(ctx, 26, -57, 5, 4); ctx.fill(); }
  if (kind === 'point') { ell(ctx, 94, -19, 4, 3.5); ctx.fill(); }
  ctx.restore();
}
function cArm(ctx, sh, el, wr, o) {
  const sk = o.skin, wu = o.wu, wf = o.wf, st = o.sleeveTo || 0;
  capFS(ctx, el[0], el[1], wr[0], wr[1], wf[0], wf[1], sk[1]);
  capFS(ctx, sh[0], sh[1], el[0], el[1], wu[0], wu[1], sk[1]);
  ctx.save(); ctx.globalAlpha = 0.4; seg(ctx, lerp(el[0], wr[0], 0.05), lerp(el[1], wr[1], 0.05) - wf[0] * 0.15, lerp(el[0], wr[0], 0.85), lerp(el[1], wr[1], 0.85) - wf[1] * 0.15, wf[0] * 0.35, wf[1] * 0.3, sk[0]); ctx.restore();
  if (st > 0) {
    const fill = o.sleeve, k = Math.min(st, 1), u = lerpP(sh, el, k);
    capFS(ctx, sh[0], sh[1], u[0], u[1], wu[0] * 1.36, wu[1] * 1.32 + (st <= 1 ? 3 : 0), fill);
    if (st > 1) {
      const f = lerpP(el, wr, st - 1);
      capFS(ctx, el[0], el[1], f[0], f[1], wu[1] * 1.32, wf[1] * 1.5, fill);
      ctx.beginPath(); capPath(ctx, el[0], el[1], el[0], el[1] + 0.01, wu[1] * 1.32, wu[1] * 1.32); ctx.fillStyle = fill; ctx.fill();
      if (o.cuff) { // rolled cuff: flat band with butt caps
        const c0 = lerpP(el, wr, st - 1 - 0.1), c1 = lerpP(el, wr, st - 1 + 0.02);
        ctx.save(); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]);
        ctx.strokeStyle = OUT; ctx.lineWidth = wf[1] * 1.75 + 3; ctx.stroke(); ctx.strokeStyle = o.cuff; ctx.lineWidth = wf[1] * 1.75; ctx.stroke(); ctx.restore();
      }
    } else if (o.cuff) {
      const c0 = lerpP(sh, el, k - 0.12), c1 = lerpP(sh, el, k + 0.02);
      ctx.save(); ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]);
      ctx.strokeStyle = OUT; ctx.lineWidth = wu[1] * 1.4 + 3; ctx.stroke(); ctx.strokeStyle = o.cuff; ctx.lineWidth = wu[1] * 1.4; ctx.stroke(); ctx.restore();
    }
  }
}

// ================================================================== props held by the rigs
// quạt nan: woven bamboo fan, grip at (0,0), blade toward -y
function quatNan(ctx, x, y, s = 1, rot = 0, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const blur = clamp(o.blur || 0);
  const draw = (al) => {
    ctx.globalAlpha = al;
    // handle (split bamboo, wrapped)
    rrect(ctx, -6, -62, 12, 86, 5); outFill(ctx, '#a8763c', 2);
    ctx.fillStyle = '#7a4f24'; ctx.fillRect(-6, -8, 12, 5); ctx.fillRect(-6, 2, 12, 5);
    // blade: rounded paddle
    const bl = new Path2D(); bl.moveTo(-14, -58); bl.bezierCurveTo(-74, -66, -84, -150, -62, -176); bl.quadraticCurveTo(0, -206, 62, -176);
    bl.bezierCurveTo(84, -150, 74, -66, 14, -58); bl.closePath();
    ctx.fillStyle = lgr(ctx, -70, 0, 70, 0, [[0, '#c99a55'], [0.45, '#efd39a'], [1, '#b98845']]); ctx.fill(bl);
    ctx.save(); ctx.clip(bl);
    if (al > 0.6) {
      ctx.strokeStyle = 'rgba(120,78,30,0.38)'; ctx.lineWidth = 3;
      for (let i = -9; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(i * 9 - 60, -40); ctx.lineTo(i * 9 + 60, -210); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,240,200,0.28)';
      for (let i = -9; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(i * 9 + 60, -40); ctx.lineTo(i * 9 - 60, -210); ctx.stroke(); }
      ctx.fillStyle = 'rgba(60,30,10,0.25)'; ctx.fillRect(-90, -78, 180, 22); // soot band near the handle
    }
    ctx.restore();
    ctx.strokeStyle = '#6b4219'; ctx.lineWidth = 7; ctx.stroke(bl);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(bl);
  };
  if (blur > 0.02) { for (let i = 3; i >= 1; i--) { ctx.save(); ctx.rotate(-i * 0.16 * blur); draw(0.18); ctx.restore(); } }
  draw(1);
  ctx.restore();
}
// steel spring tongs from grip g along angle a, length len, open 0..1
function tongsDraw(ctx, g, a, len, open) {
  const d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]];
  const back = add(g, mulv(d, -26)), sp = 3 + open * 14;
  const tipA = add(add(g, mulv(d, len)), mulv(n, sp)), tipB = add(add(g, mulv(d, len)), mulv(n, -sp * 0.5));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [tp, w] of [[tipB, 0], [tipA, 1]]) {
    ctx.beginPath(); ctx.moveTo(back[0], back[1]); ctx.quadraticCurveTo(g[0] + n[0] * (w ? 8 : -5), g[1] + n[1] * (w ? 8 : -5), tp[0], tp[1]);
    const hook = add(tp, mulv(n, w ? -6 : 6)); ctx.lineTo(hook[0], hook[1]);
    ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = w ? '#dfe5ec' : '#a9b1bc'; ctx.lineWidth = 5; ctx.stroke();
  }
  ell(ctx, back[0], back[1], 7, 7); outFill(ctx, '#b9c1cb', 2);
  ctx.restore();
  return { tip: lerpP(tipA, tipB, 0.5), base: back };
}
function plateDraw(ctx, p) {
  ell(ctx, p.x, p.y + p.ry * 0.25, p.rx * 1.02, p.ry * 1.05); ctx.fillStyle = 'rgba(30,20,40,0.25)'; ctx.fill();
  ell(ctx, p.x, p.y, p.rx, p.ry); outFill(ctx, lgr(ctx, p.x - p.rx, 0, p.x + p.rx, 0, [[0, '#e9eef3'], [0.5, '#ffffff'], [1, '#cfd8e2']]), 2);
  ell(ctx, p.x, p.y + p.ry * 0.05, p.rx * 0.72, p.ry * 0.66); ctx.fillStyle = '#f4f6f8'; ctx.fill();
  ctx.strokeStyle = 'rgba(70,110,170,0.55)'; ctx.lineWidth = 2; ell(ctx, p.x, p.y, p.rx * 0.9, p.ry * 0.86); ctx.stroke();
}
function chenDraw(ctx, x, y, s, tilt, fill) { // small dipping bowl, (x,y) = bottom centre
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-30, -26); ctx.quadraticCurveTo(-28, 0, 0, 0); ctx.quadraticCurveTo(28, 0, 30, -26); ctx.closePath();
  outFill(ctx, lgr(ctx, -30, 0, 30, 0, [[0, '#dfe6ee'], [0.5, '#ffffff'], [1, '#c3ccd8']]), 2);
  ctx.strokeStyle = '#3f6fb5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-27, -17); ctx.quadraticCurveTo(0, -10, 27, -17); ctx.stroke();
  ell(ctx, 0, -26, 30, 7); outFill(ctx, '#f2f4f7', 1.6);
  if (fill > 0) { ell(ctx, 0, -25, 25 * fill + 2, 5 * fill + 1); ctx.fillStyle = '#c47a2c'; ctx.fill(); ctx.fillStyle = 'rgba(230,60,40,0.9)'; ell(ctx, -6, -25, 2.4, 1.2); ctx.fill(); ell(ctx, 7, -24, 2, 1); ctx.fill(); }
  ctx.restore();
}
function towelDraw(ctx, x, y, s, rot) { // crumpled checkered khăn
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-34, -6); ctx.quadraticCurveTo(-20, -22, 4, -16); ctx.quadraticCurveTo(30, -24, 38, -4); ctx.quadraticCurveTo(30, 14, 6, 12); ctx.quadraticCurveTo(-24, 18, -34, -6); ctx.closePath();
  outFill(ctx, '#eef2f4', 2);
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(60,110,190,0.45)';
  for (let i = -4; i <= 4; i++) { ctx.fillRect(i * 9, -30, 3, 60); ctx.fillRect(-40, i * 9, 80, 3); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,40,60,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-18, -4); ctx.quadraticCurveTo(0, 2, 20, -6); ctx.stroke();
  ctx.restore();
}

// ================================================================== shared rig solver (figure units)
// figure units: origin between the feet, y up = negative, facing +x. hip ~(0,-250), head centre ~(4,-452).
const HS = 0.38;
function basePose(o) {
  return {
    pose: o.pose || 'stand', hip: [0, -250], lean: 0, shUp: 0, footL: [-24, 0], footR: [22, 0], knee: 'fwd', oy: 0,
    hL: [-60, -238], hR: [62, -238], kL: 'open', kR: 'open', rL: null, rR: null, flipL: false, flipR: true,
    elL: 'out', elR: 'out', expr: 'smile', tilt: 0, turn: 0.35, lookX: 0.4, lookY: 0, brow: 0, browL: 0, browR: 0,
    order: ['armL', 'handL', 'armR', 'handR'], back: null, mid: null, front: null, tool: null, hold: null, ex: {}, shadow: true,
  };
}
function solve(P) {
  const R = (p) => add(P.hip, rot2(p, P.lean));
  const su = P.shUp;
  const shL = R([-44, -148 + su]), shR = R([44, -148 + su]);
  P.hL = clampTo(P.hL, shL, 172); P.hR = clampTo(P.hR, shR, 172);
  const elb = (sh, h, mode, side) => (mode === 'down' ? ikUp(sh[0], sh[1], h[0], h[1], 92, 84, 1)
    : mode === 'up' ? ikUp(sh[0], sh[1], h[0], h[1], 92, 84, -1)
      : ikPick(sh[0], sh[1], h[0], h[1], 92, 84, mode === 'in' ? -side : side));
  const elL = elb(shL, P.hL, P.elL, -1), elR = elb(shR, P.hR, P.elR, 1);
  const legs = [[P.footL, -1], [P.footR, 1]].map(([f, sd]) => {
    const hj = R([sd * 21, 14]), an = [f[0], f[1] - 14];
    const dd = Math.hypot(an[0] - hj[0], an[1] - hj[1]), an2 = dd > 226 ? add(hj, mulv(sub(an, hj), 226 / dd)) : an;
    let kn = P.knee === 'up' ? ikUp(hj[0], hj[1], an2[0], an2[1], 115, 113, -1) : ikPick(hj[0], hj[1], an2[0], an2[1], 115, 113, 1);
    const sw = clamp((Math.hypot(an2[0] - hj[0], an2[1] - hj[1]) - 212) / 12); // near full extension: lock the knee straight (no bow)
    if (sw > 0) kn = lerpP(kn, lerpP(hj, an2, 0.505), sw);
    return { f, hj, an: an2, kn, sd };
  });
  const headC = R([4, -202 + su * 0.6]);
  return { R, shL, shR, elL, elR, legs, headC, hRot: P.lean + P.tilt };
}

// ================================================================== CÔ NĂM
const CN = {
  skin: SK_CN, hair: '#1d1520', hairL: '#3a3048', grey: '#9a94a4',
  ao: ['#d9c4ef', '#b898dc', '#8d6cb8'], aoCuff: '#e6d8f5',
  pants: '#262030', pantsL: '#4a4160', apron: ['#3f8a63', '#2c6a4a', '#1b4632'], clip: '#c43e6c', clipL: '#f07aa0',
  sole: '#2f4d78', strap: '#e9e2cf', lip: '#b44b5c', gold: '#f2c14e',
};
let _flowerTile = null;
function flowerTile() {
  if (_flowerTile) return _flowerTile;
  const c = createCanvas(44, 44), x = c.getContext('2d');
  const fl = (cx, cy, r, a) => {
    x.fillStyle = 'rgba(255,255,255,0.92)';
    for (let i = 0; i < 5; i++) { const an = a + i * TAU / 5; ell(x, cx + Math.cos(an) * r * 0.62, cy + Math.sin(an) * r * 0.62, r * 0.5, r * 0.36, an); x.fill(); }
    x.fillStyle = '#f5c84a'; ell(x, cx, cy, r * 0.28, r * 0.28); x.fill();
  };
  x.fillStyle = 'rgba(120,170,110,0.55)'; ell(x, 30, 9, 4, 2, 0.6); x.fill(); ell(x, 8, 32, 4, 2, -0.5); x.fill();
  fl(11, 11, 6.5, 0.2); fl(33, 31, 5.5, 1.1); fl(41, 3, 3.5, 0.5); fl(2, 40, 3.5, 0.9);
  _flowerTile = c; return c;
}
function cnPose(o) {
  const P = basePose(o), t = o.t || 0, k = clamp(o.k ?? 0.5), pose = P.pose;
  P.hip = [0, -248]; P.footL = [-40, 0]; P.footR = [38, 0];
  const breath = Math.sin(t * 2.0);
  P.hip[1] += breath * 1.2; P.shUp = breath * 1.5;
  const handOnHip = () => { P.hL = [-70, -262]; P.kL = 'fist'; P.rL = PI * 0.62; P.flipL = false; P.elL = 'out'; };
  switch (pose) {
    case 'fan': {
      const rate = 1.6 + 2.6 * k, amp = 0.35 + 0.35 * k, ph = t * TAU * rate, sw = Math.sin(ph);
      P.lean = 0.07 + 0.02 * sw * k; P.hR = [112 + 8 * sw, -306 + 14 * sw]; P.kR = 'grip'; P.elR = 'down';
      const fr = PI * 0.62 + amp * sw; // fan blade direction (rot of the -y axis): forward-down
      P.rR = fr; P.flipR = false;
      P.tool = (c) => { const gp = add(P.hR, rot2([22, -2], fr)); quatNan(c, gp[0], gp[1], 0.62, fr, { blur: k * 0.6 * Math.abs(Math.cos(ph)) });
        const dir = rot2([0, -1], fr); P.ex.fan = { grip: gp, center: add(gp, mulv(dir, 0.62 * 125)), rot: fr, dir }; };
      handOnHip(); P.expr = 'focus'; P.lookX = 0.7; P.lookY = 0.7; P.turn = 0.45;
      break;
    }
    case 'tongs': {
      const e = clamp(k), lift = Math.sin(e * PI), tw = Math.sin(e * PI) * 0.9;
      const a = 0.42 - 0.3 * lift; // tool angle (down-forward, rises a little mid flip)
      P.lean = 0.08; P.hR = [104 + 8 * lift, -318 - 14 * lift]; P.kR = 'grip'; P.elR = 'down';
      P.rR = a + PI / 2; P.flipR = false;
      P.tool = (c) => { const gp = add(P.hR, rot2([22, -2], P.rR)); const open = e < 0.12 || e > 0.9 ? 0.8 : 0.15; const r = tongsDraw(c, gp, a, 132, open);
        P.ex.tongs = { tip: r.tip, base: r.base, ang: a, open, twist: tw }; };
      if (o.fanL !== false) { P.hL = [-62, -246]; P.kL = 'grip'; P.rL = PI * 0.98 + 0.05 * breath; P.flipL = true;
        P.back = (c) => { const gp = add(P.hL, rot2([22, 2], P.rL)); quatNan(c, gp[0], gp[1], 0.55, P.rL + PI * 0.5 + 0.2); }; }
      else handOnHip();
      P.expr = 'focus'; P.lookX = 0.8; P.lookY = 0.6; P.turn = 0.45;
      break;
    }
    case 'plate': {
      const e = ease.inOut(k);
      P.lean = 0.05 * e; P.hR = [lerp(70, 150, e), lerp(-330, -350, e)]; P.kR = 'flat'; P.rR = -0.12; P.flipR = false; P.elR = 'down';
      P.hL = [lerp(30, 108, e), lerp(-318, -336, e)]; P.kL = 'flat'; P.rL = 0.15; P.flipL = false; P.elL = 'down';
      P.order = ['armL', 'handL', 'armR', 'handR'];
      P.hold = (c) => {
        const pc = add(P.hR, [6, -16]), pl = { x: pc[0], y: pc[1], rx: 78, ry: 22 };
        P.ex.plate = pl;
        if (o.plateFn) P.ex._plateFn = true; else plateDraw(c, pl);
        // thumb over the rim
        capFS(c, P.hR[0] + 6, P.hR[1] - 8, P.hR[0] + 22, P.hR[1] - 14, 8, 6.5, CN.skin[1], 1.6);
      };
      P.expr = 'grin'; P.lookX = 0.9; P.turn = 0.5;
      break;
    }
    case 'pour': {
      const e = clamp(k), tilt = -1.15 * ease.inOut(e);
      P.hR = [108, -322]; P.kR = 'flat'; P.rR = -0.05 + tilt * 0.6; P.flipR = false; P.elR = 'down';
      handOnHip();
      P.hold = (c) => {
        const base = add(P.hR, rot2([26, -8], P.rR)), s2 = 0.62;
        chenDraw(c, base[0], base[1], s2, tilt, 1 - 0.5 * e);
        const lip = add(base, rot2([30 * s2, -26 * s2], tilt));
        P.ex.pour = lip; P.ex.bowl = base;
      };
      P.expr = 'smile'; P.lookX = 0.8; P.lookY = 0.6; P.turn = 0.45;
      break;
    }
    case 'eyebrow': {
      P.hip[0] = -4; P.lean = -0.04; P.footL = [-34, 0]; P.footR = [30, 0];
      P.hR = [-34, -312]; P.kR = 'flat'; P.rR = PI * 0.92; P.flipR = false; P.elR = 'out';
      P.hL = [40, -304]; P.kL = 'flat'; P.rL = -0.1; P.flipL = true; P.elL = 'out';
      P.order = ['armR', 'handR', 'armL', 'handL'];
      P.expr = 'skeptic'; P.tilt = 0.1; P.turn = 0.55; P.lookX = 0.9; P.browR = 1; P.browL = -0.6;
      break;
    }
    case 'laugh': {
      const b = Math.abs(Math.sin(t * 9));
      P.lean = -0.07 - 0.03 * b; P.hip[1] += -4 * b; P.shUp = -6 * b;
      P.hL = [26, -284]; P.kL = 'flat'; P.rL = 0.2; P.flipL = false; P.elL = 'down';
      const sl = Math.sin(t * 9);
      P.hR = [104, -352 + 30 * sl]; P.kR = 'open'; P.rR = 0.2 + 0.35 * sl; P.flipR = false;
      P.expr = 'laugh'; P.tilt = -0.18 - 0.04 * b; P.turn = 0.4;
      break;
    }
    case 'wipe': {
      const ph = t * TAU * 1.4, tgF = o._atF || [150, -292];
      P.lean = 0.14; P.hip[0] = -6;
      P.hR = [tgF[0] + Math.cos(ph) * 26, tgF[1] + Math.sin(ph) * 9]; P.kR = 'flat'; P.rR = 0.05; P.flipR = false; P.elR = 'down';
      P.mid = null;
      P.hold = (c) => { towelDraw(c, P.hR[0] + 18, P.hR[1] + 6, 0.9, Math.sin(ph) * 0.15); P.ex.towel = [P.hR[0] + 18, P.hR[1] + 6];
        capFS(c, P.hR[0] + 4, P.hR[1] - 6, P.hR[0] + 34, P.hR[1] - 4, 15, 12, CN.skin[1], 2); };
      P.hL = [60, -282]; P.kL = 'flat'; P.rL = 0.25; P.flipL = false; P.elL = 'down';
      P.expr = 'smile'; P.lookX = 0.8; P.lookY = 0.8; P.turn = 0.5;
      break;
    }
    case 'steer': {
      const e = ease.inOut(k), tgF = o._atF || [150, -400];
      P.lean = 0.06 + 0.06 * e; P.hip[0] = 6 * e;
      P.hR = [tgF[0] - 6, tgF[1] + 4]; P.kR = 'flat'; P.rR = 0.35; P.flipR = false; P.elR = 'down';
      P.hL = [96, -270]; P.kL = 'open'; P.rL = 0.55; P.flipL = false; P.elL = 'down';
      P.expr = 'grin'; P.turn = 0.6; P.lookX = 1;
      break;
    }
    case 'wave': {
      const w = Math.sin(t * TAU * 1.6);
      P.hR = [84, -500]; P.kR = 'wave'; P.rR = -PI / 2 + 0.28 * w; P.flipR = false; P.elR = 'out';
      handOnHip(); P.expr = 'grin'; P.turn = 0.3; P.lookX = 0.5; P.tilt = 0.04 * w;
      break;
    }
    case 'thumbs': {
      P.hR = [104, -360]; P.kR = 'thumb'; P.rR = -0.05; P.flipR = false; P.elR = 'down';
      handOnHip(); P.expr = o.wink ? 'wink' : 'grin'; P.turn = 0.25; P.lookX = 0.2; P.tilt = 0.06;
      break;
    }
    default: { // stand
      P.hL = [-56, -240]; P.kL = 'open'; P.rL = PI / 2 + 0.25; P.flipL = false;
      P.hR = [40, -268]; P.kR = 'flat'; P.rR = PI * 0.75; P.flipR = false; P.elR = 'down';
      P.expr = 'smile';
    }
  }
  if (o.expr) P.expr = o.expr;
  if (o.turn !== undefined) P.turn = o.turn;
  if (o.tilt !== undefined) P.tilt = o.tilt;
  if (o.lookX !== undefined) P.lookX = o.lookX;
  if (o.lookY !== undefined) P.lookY = o.lookY;
  if (o.lean) P.lean += o.lean;
  if (o.brow) P.brow += o.brow;
  return P;
}

// ---- head in head units (centre 0,0, radius ~108), face turned by o.turn toward +x
function cnHead(ctx, o = {}) {
  const t = o.t || 0, ex = o.expr || 'smile', fx = (o.turn || 0) * 22, br = o.brow || 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // bun (behind) + claw clip
  const bx = -100 + fx * 0.25, by = -18;
  ell(ctx, bx, by, 44, 38, -0.2); outFill(ctx, lgr(ctx, bx, by - 38, bx, by + 38, [[0, CN.hairL], [1, CN.hair]]), 3);
  ctx.strokeStyle = 'rgba(140,130,170,0.45)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(bx + 4, by + 2, 14 + i * 7, -2.4, -0.4 + i * 0.2); ctx.stroke(); }
  // kẹp càng cua: curved bar + teeth
  ctx.save(); ctx.translate(bx - 22, by + 2); ctx.rotate(-1.42); ctx.scale(0.72, 0.72);
  ctx.fillStyle = CN.clip; ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 10 - 4, -6); ctx.quadraticCurveTo(i * 11, 30, i * 9 + 3, 38); ctx.lineTo(i * 9 + 8, 36); ctx.quadraticCurveTo(i * 11 + 6, 24, i * 10 + 5, -6); ctx.closePath(); ctx.stroke(); ctx.fill(); }
  rrect(ctx, -40, -16, 80, 18, 9); outFill(ctx, lgr(ctx, 0, -16, 0, 2, [[0, CN.clipL], [1, CN.clip]]), 2.4);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; rrect(ctx, -30, -13, 40, 4, 2); ctx.fill();
  ctx.restore();
  // ear + gold stud
  const ex0 = -82 + fx * 0.45;
  ell(ctx, ex0, 6, 15, 23); outFill(ctx, CN.skin[1], 3);
  ctx.strokeStyle = 'rgba(120,60,35,0.5)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ex0, 6, 8, PI - 1.9, PI + 1.9); ctx.stroke();
  ell(ctx, ex0 + 1, 26, 4.5, 4.5); outFill(ctx, CN.gold, 1.4); ctx.fillStyle = '#fff6c8'; ell(ctx, ex0, 25, 1.6, 1.6); ctx.fill();
  // face: round, soft jowls
  const face = new Path2D();
  face.moveTo(fx * 0.2, -108); face.bezierCurveTo(62, -110, 100 + fx * 0.1, -74, 100, -16); face.bezierCurveTo(101, 38, 90, 74, 64 + fx * 0.3, 96);
  face.quadraticCurveTo(34 + fx * 0.4, 114, fx * 0.5, 112); face.quadraticCurveTo(-38, 112, -68, 92); face.bezierCurveTo(-92, 72, -100, 36, -98, -16);
  face.bezierCurveTo(-98, -76, -58, -108, fx * 0.2, -108); face.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(face);
  ctx.fillStyle = rgr(ctx, 26 + fx, -30, 8, 8, 4, 150, [[0, CN.skin[0]], [0.6, CN.skin[1]], [1, CN.skin[2]]]); ctx.fill(face);
  ctx.save(); ctx.clip(face);
  ctx.fillStyle = lgr(ctx, -104, 0, -40 + fx * 0.6, 0, [[0, 'rgba(110,50,40,0.22)'], [1, 'rgba(110,50,40,0)']]); ctx.fillRect(-110, -120, 120, 240); // far-cheek turn shade
  ctx.fillStyle = lgr(ctx, 0, 70, 0, 116, [[0, 'rgba(90,40,30,0)'], [1, 'rgba(90,40,30,0.2)']]); ctx.fillRect(-110, 60, 220, 60);
  ctx.restore();
  // hair: pulled back, centre part, glossy
  ctx.beginPath(); ctx.moveTo(-102, 14); ctx.bezierCurveTo(-110, -88, -52, -128, 4, -126); ctx.bezierCurveTo(64, -126, 108, -92, 101, -26);
  ctx.quadraticCurveTo(96, -56, 74, -72); ctx.quadraticCurveTo(44 + fx * 0.6, -92, 10 + fx * 0.6, -78); ctx.quadraticCurveTo(-40, -96, -76, -54); ctx.quadraticCurveTo(-88, -26, -84, 6); ctx.closePath();
  outFill(ctx, lgr(ctx, 0, -126, 0, 10, [[0, CN.hairL], [0.5, CN.hair], [1, CN.hair]]), 3);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(140,150,220,0.38)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(-6, -30, 88, -2.5, -1.75); ctx.stroke(); ctx.beginPath(); ctx.arc(14, -30, 84, -1.35, -0.75); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = 'rgba(10,6,14,0.6)'; ctx.lineWidth = 2.2; // part + comb lines
  ctx.beginPath(); ctx.moveTo(10 + fx * 0.6, -80); ctx.quadraticCurveTo(0, -110, -12, -124); ctx.stroke();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14 - i * 14, -92 + i * 8); ctx.quadraticCurveTo(-60 - i * 6, -84 + i * 12, -84, -30 + i * 10); ctx.stroke(); }
  ctx.strokeStyle = CN.grey; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(60 + i * 8, -86 + i * 6); ctx.quadraticCurveTo(84, -60 + i * 4, 94, -28 + i * 3); ctx.stroke(); }
  // a loose strand
  ctx.strokeStyle = CN.hair; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(74 + fx * 0.3, -70); ctx.bezierCurveTo(92, -40, 80, -20, 90 + Math.sin(t * 2) * 3, 4); ctx.stroke();
  // brows
  const bl = (o.browL || 0) + br, brr = (o.browR || 0) + br;
  ctx.strokeStyle = '#2a1c22'; ctx.lineWidth = 7;
  for (const sx of [-1, 1]) {
    const ox = sx * 36 + fx, lift = (sx < 0 ? bl : brr) * 10, sk = ex === 'skeptic' ? (sx > 0 ? -6 : 5) : ex === 'focus' ? 4 : 0;
    const by2 = -42 - lift - (ex === 'o' ? 8 : 0);
    ctx.beginPath(); ctx.moveTo(ox - sx * 20, by2 + 4 + sk * (sx > 0 ? 0 : 0.6)); ctx.quadraticCurveTo(ox + sx * 2, by2 - 8 + (sx > 0 ? sk : 0), ox + sx * 22, by2 + 3); ctx.stroke();
  }
  // eyes
  const lx = (o.lookX || 0) * 5, ly = (o.lookY || 0) * 4;
  for (const sx of [-1, 1]) {
    const exx = sx * 34 + fx, ey = -10, far = sx < 0 ? 0.9 : 1;
    const closed = ex === 'laugh' || ex === 'proud' || (ex === 'wink' && sx < 0);
    if (closed) {
      ctx.strokeStyle = '#24160f'; ctx.lineWidth = 5; ctx.beginPath();
      if (ex === 'wink') { ctx.moveTo(exx - 14, ey); ctx.quadraticCurveTo(exx, ey + 8, exx + 14, ey); } else { ctx.moveTo(exx - 15, ey + 3); ctx.quadraticCurveTo(exx, ey - 11, exx + 15, ey + 3); }
      ctx.stroke(); continue;
    }
    const ry = (ex === 'grin' || ex === 'wink' || ex === 'smile' ? 9 : ex === 'skeptic' ? (sx > 0 ? 11 : 6.5) : ex === 'focus' ? 8.5 : ex === 'o' ? 13 : 10) * far;
    ctx.beginPath(); ctx.moveTo(exx - 17 * far, ey); ctx.quadraticCurveTo(exx, ey - ry * 1.7, exx + 17 * far, ey); ctx.quadraticCurveTo(exx, ey + ry * (ex === 'grin' || ex === 'smile' || ex === 'wink' ? 0.75 : 1.1), exx - 17 * far, ey); ctx.closePath();
    ctx.fillStyle = '#f3eadf'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#4a2a18'; ell(ctx, exx + lx, ey - 3 + ly, 9.5, 10); ctx.fill();
    ctx.fillStyle = '#120a08'; ell(ctx, exx + lx, ey - 3 + ly, 4.8, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, exx + lx + 3, ey - 7 + ly, 2.8, 2.8); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#24160f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(exx - 18 * far, ey + 1); ctx.quadraticCurveTo(exx, ey - ry * 1.8, exx + 18 * far, ey + 1); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(exx + 17 * far, ey); ctx.lineTo(exx + 22 * far, ey - 4); ctx.stroke(); // lash flick
    if (ex === 'grin' || ex === 'smile' || ex === 'wink') { ctx.strokeStyle = 'rgba(110,55,35,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(exx - 12, ey + 9); ctx.quadraticCurveTo(exx, ey + 4, exx + 12, ey + 9); ctx.stroke(); }
  }
  // laugh lines
  ctx.strokeStyle = 'rgba(110,55,35,0.4)'; ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(56 + fx, -8 + i * 6); ctx.lineTo(64 + fx, -10 + i * 9); ctx.stroke(); }
  // nose
  const nx = fx * 1.25;
  ctx.strokeStyle = 'rgba(120,58,32,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(nx + 3, -4); ctx.quadraticCurveTo(nx + 9, 14, nx + 10, 22); ctx.stroke();
  ctx.fillStyle = 'rgba(150,72,42,0.28)'; ell(ctx, nx, 28, 18, 10); ctx.fill();
  ctx.fillStyle = 'rgba(70,30,18,0.65)'; ell(ctx, nx - 7, 31, 4.2, 2.8); ctx.fill(); ell(ctx, nx + 8, 31, 4.2, 2.8); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,200,0.5)'; ell(ctx, nx + 4, 20, 5, 4); ctx.fill();
  // cheeks
  const ck = ex === 'laugh' || ex === 'grin' || ex === 'proud' ? 0.4 : 0.26;
  ctx.fillStyle = `rgba(225,95,90,${ck})`; ell(ctx, -54 + fx * 0.8, 30, 20, 12); ctx.fill(); ell(ctx, 56 + fx, 30, 20, 12); ctx.fill();
  // mouth
  const my = 64, mx = fx * 1.05;
  if (ex === 'grin' || ex === 'wink' || ex === 'proud') {
    ctx.beginPath(); ctx.moveTo(mx - 30, my - 6); ctx.quadraticCurveTo(mx, my + 28, mx + 30, my - 6); ctx.quadraticCurveTo(mx, my + 2, mx - 30, my - 6); ctx.closePath();
    outFill(ctx, '#5a1c22', 2.6); ctx.save(); ctx.clip(); ctx.fillStyle = '#f6efe3'; ctx.fillRect(mx - 30, my - 8, 60, 10); ctx.restore();
    ctx.strokeStyle = CN.lip; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - 30, my - 6); ctx.quadraticCurveTo(mx, my + 30, mx + 30, my - 6); ctx.stroke();
  } else if (ex === 'laugh') {
    ctx.beginPath(); ctx.moveTo(mx - 34, my - 10); ctx.quadraticCurveTo(mx, my + 54, mx + 34, my - 10); ctx.quadraticCurveTo(mx, my - 2, mx - 34, my - 10); ctx.closePath();
    outFill(ctx, '#5a1a20', 2.6); ctx.save(); ctx.clip(); ctx.fillStyle = '#f6efe3'; ctx.fillRect(mx - 34, my - 12, 68, 11); ctx.fillStyle = '#d0606a'; ell(ctx, mx, my + 32, 16, 10); ctx.fill(); ctx.restore();
  } else if (ex === 'talk') {
    const h = 4 + Math.abs(Math.sin(t * 13)) * 11; ell(ctx, mx, my, 15, h); outFill(ctx, '#5a1c22', 2.4);
    ctx.strokeStyle = CN.lip; ctx.lineWidth = 2.5; ell(ctx, mx, my, 15, h); ctx.stroke();
  } else if (ex === 'o') {
    ell(ctx, mx, my + 2, 10, 13); outFill(ctx, '#5a1c22', 2.4);
  } else if (ex === 'skeptic') {
    ctx.strokeStyle = CN.lip; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(mx - 18, my + 4); ctx.quadraticCurveTo(mx + 4, my + 2, mx + 22, my - 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,55,35,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx + 26, my - 12); ctx.quadraticCurveTo(mx + 32, my - 4, mx + 28, my + 4); ctx.stroke();
  } else if (ex === 'neutral' || ex === 'focus') {
    ctx.strokeStyle = CN.lip; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(mx - 16, my); ctx.quadraticCurveTo(mx, my + (ex === 'focus' ? -2 : 3), mx + 16, my); ctx.stroke();
  } else {
    ctx.strokeStyle = CN.lip; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(mx - 24, my - 4); ctx.quadraticCurveTo(mx, my + 16, mx + 24, my - 4); ctx.stroke();
  }
  // beauty mark
  ctx.fillStyle = '#3a2018'; ell(ctx, mx + 30, my + 14, 3.2, 3.2); ctx.fill();
}

// ---- body pieces (figure units, inside the figure transform)
function cnLegs(c, J) {
  for (const g of J.legs) {
    const f = g.f, cuff = lerpP(g.kn, g.an, 0.82);
    // sandal sole + foot + strap
    rrect(c, f[0] - 26, f[1] - 7, 84, 10, 5); outFill(c, CN.sole, 2.2);
    capFS(c, g.an[0], g.an[1], cuff[0], cuff[1], 21, 23, CN.skin[1], 2);
    capFS(c, f[0] - 16, f[1] - 15, f[0] + 42, f[1] - 10, 26, 16, CN.skin[1], 2.4);
    c.fillStyle = CN.skin[1]; c.strokeStyle = OUT; c.lineWidth = 1.4; for (let i = 0; i < 4; i++) { ell(c, f[0] + 49, f[1] - 15 + i * 4, 4.6, 3.3); c.stroke(); c.fill(); }
    c.save(); c.lineCap = 'butt'; c.strokeStyle = OUT; c.lineWidth = 18; c.beginPath(); c.moveTo(f[0] + 12, f[1] - 26); c.lineTo(f[0] + 17, f[1] - 2); c.stroke();
    c.strokeStyle = CN.strap; c.lineWidth = 14; c.stroke(); c.restore();
    // wide black satin trousers: straight, flaring a little to the hem (knee bend hidden inside)
    const hem = lerpP(g.kn, g.an, 0.8), mid = lerpP(g.hj, hem, 0.5), kv = [g.kn[0] - mid[0], g.kn[1] - mid[1]];
    const kb = [mid[0] + kv[0] * 0.2, mid[1] + kv[1] * 0.2];
    const d0 = Math.atan2(kb[1] - g.hj[1], kb[0] - g.hj[0]), d1 = Math.atan2(hem[1] - kb[1], hem[0] - kb[0]);
    const nrm = (a, w) => [-Math.sin(a) * w, Math.cos(a) * w], na = nrm(d0, 27), nb = nrm((d0 + d1) / 2, 29), nc = nrm(d1, 33);
    c.beginPath(); c.moveTo(g.hj[0] + na[0], g.hj[1] + na[1]); c.lineTo(kb[0] + nb[0], kb[1] + nb[1]); c.lineTo(hem[0] + nc[0], hem[1] + nc[1]);
    c.quadraticCurveTo(hem[0] + Math.cos(d1) * 6, hem[1] + Math.sin(d1) * 6, hem[0] - nc[0], hem[1] - nc[1]); c.lineTo(kb[0] - nb[0], kb[1] - nb[1]); c.lineTo(g.hj[0] - na[0], g.hj[1] - na[1]);
    c.arc(g.hj[0], g.hj[1], 27, d0 + PI / 2, d0 - PI / 2); c.closePath();
    c.strokeStyle = OUT; c.lineWidth = 4; c.stroke(); c.fillStyle = CN.pants; c.fill();
    c.save(); c.globalAlpha = 0.45; seg(c, g.hj[0] + 12, g.hj[1] + 10, hem[0] + 12, hem[1] - 8, 10, 12, CN.pantsL); c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(kb[0] - 12, kb[1] + 10); c.quadraticCurveTo(kb[0] - 4, kb[1] + 60, hem[0] - 14, hem[1] - 6); c.stroke();
  }
}
function cnTorso(c, P, o) {
  const su = P.shUp, t = o.t || 0;
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean);
  const tor = new Path2D();
  tor.moveTo(-14, -156 + su); tor.quadraticCurveTo(-42, -158 + su, -54, -144 + su); tor.quadraticCurveTo(-60, -110, -58, -60);
  tor.quadraticCurveTo(-58, -20, -66, 44); tor.quadraticCurveTo(0, 52, 68, 44);
  tor.quadraticCurveTo(62, -10, 62, -48); tor.quadraticCurveTo(70, -100, 58, -140 + su); tor.quadraticCurveTo(44, -158 + su, 20, -156 + su); tor.closePath();
  c.strokeStyle = OUT; c.lineWidth = 3; c.stroke(tor);
  c.fillStyle = lgr(c, -62, 0, 66, 0, [[0, CN.ao[2]], [0.45, CN.ao[1]], [0.75, CN.ao[0]], [1, CN.ao[1]]]); c.fill(tor);
  c.save(); c.clip(tor);
  c.fillStyle = c.createPattern(flowerTile(), 'repeat'); c.globalAlpha = 0.85; c.fillRect(-80, -170, 160, 230); c.globalAlpha = 1;
  // shading: under-bust, side shadow, folds
  c.fillStyle = 'rgba(60,30,90,0.22)'; ell(c, 28, -66, 40, 10, -0.1); c.fill();
  c.fillStyle = lgr(c, -66, 0, -20, 0, [[0, 'rgba(40,20,70,0.35)'], [1, 'rgba(40,20,70,0)']]); c.fillRect(-70, -170, 60, 230);
  c.strokeStyle = 'rgba(70,40,100,0.45)'; c.lineWidth = 2.2;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-40 + i * 18, -40 + i * 4); c.quadraticCurveTo(-30 + i * 18, -20, -36 + i * 20, 10); c.stroke(); }
  // front opening + snap buttons
  c.strokeStyle = 'rgba(70,40,100,0.55)'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(16, -144 + su); c.quadraticCurveTo(22, -60, 20, 46); c.stroke();
  c.fillStyle = '#f5f0fa'; for (const by of [-128, -100, -72, -44]) { ell(c, 22, by + (by < -110 ? su : 0), 3, 3); c.fill(); }
  c.restore();
  // side slit at the hem (back side)
  c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-62, 14); c.lineTo(-66, 44); c.stroke();
  // apron (waist down), ties + towel
  const ap = new Path2D(); ap.moveTo(-34, -30); ap.lineTo(66, -32); ap.quadraticCurveTo(76, 40, 84, 124); ap.quadraticCurveTo(22, 136, -42, 124); ap.quadraticCurveTo(-40, 40, -34, -30); ap.closePath();
  c.strokeStyle = OUT; c.lineWidth = 3; c.stroke(ap);
  c.fillStyle = lgr(c, -40, 0, 84, 0, [[0, CN.apron[2]], [0.55, CN.apron[1]], [1, CN.apron[0]]]); c.fill(ap);
  c.save(); c.clip(ap);
  c.strokeStyle = 'rgba(10,30,20,0.45)'; c.lineWidth = 2.4; for (const xx of [-6, 30, 58]) { c.beginPath(); c.moveTo(xx, -20); c.quadraticCurveTo(xx + 6, 60, xx + 10, 130); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(-50, 100, 140, 40);
  rrect(c, 4, 18, 46, 38, 5); c.strokeStyle = 'rgba(200,230,210,0.5)'; c.lineWidth = 2; c.setLineDash([5, 4]); c.stroke(); c.setLineDash([]); // pocket stitching
  c.strokeStyle = '#d24a4a'; c.lineWidth = 4; c.beginPath(); c.moveTo(14, 26); c.lineTo(10, 4); c.stroke(); // pen in the pocket
  c.restore();
  // waist string + bow at the back
  c.strokeStyle = OUT; c.lineWidth = 9; c.beginPath(); c.moveTo(-60, -30); c.quadraticCurveTo(0, -38, 66, -32); c.stroke();
  c.strokeStyle = CN.apron[1]; c.lineWidth = 6; c.stroke();
  const sw = Math.sin(t * 2.2) * 3;
  for (const [dx, dy] of [[-84, -40], [-82, -16]]) { c.beginPath(); c.moveTo(-60, -30); c.quadraticCurveTo(-72, -32, dx + sw, dy); c.strokeStyle = OUT; c.lineWidth = 8; c.stroke(); c.strokeStyle = CN.apron[1]; c.lineWidth = 5; c.stroke(); }
  // towel hanging from the string
  c.save(); c.translate(64, -28); c.rotate(0.06 + Math.sin(t * 1.7) * 0.03);
  rrect(c, -10, -4, 26, 62, 4); outFill(c, '#eef2f4', 2.2);
  c.save(); c.clip(); c.fillStyle = 'rgba(60,110,190,0.5)'; for (let i = 0; i < 8; i++) { c.fillRect(-12, i * 8, 30, 2.5); } c.fillRect(-2, -6, 3, 70); c.fillRect(8, -6, 3, 70); c.restore();
  c.restore();
  // neck + neckline
  capFS(c, 0, -146 + su, 4, -178 + su, 30, 28, CN.skin[1], 2.2);
  c.fillStyle = 'rgba(90,40,25,0.3)'; ell(c, 2, -152 + su, 14, 5); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-15, -156 + su); c.quadraticCurveTo(4, -136 + su, 21, -156 + su); c.stroke();
  c.strokeStyle = CN.aoCuff; c.lineWidth = 2; c.beginPath(); c.moveTo(-13, -154 + su); c.quadraticCurveTo(4, -138 + su, 19, -154 + su); c.stroke();
  c.restore();
}
function cnArm(c, sh, el, h) { cArm(c, sh, el, h, { skin: CN.skin, wu: [25, 21], wf: [21, 17], sleeve: CN.ao[1], sleeveTo: 1.48, cuff: CN.aoCuff }); }

function coNam(ctx, x, y, s = 1, o = {}) {
  const fl = o.flip ? -1 : 1, t = o.t || 0;
  const toL = (p) => [x + p[0] * s * fl, y + p[1] * s];
  const toF = (p) => [(p[0] - x) / (s * fl), (p[1] - y) / s];
  const o2 = Object.assign({}, o);
  if (o.at) o2._atF = toF([o.at.x ?? o.at[0], o.at.y ?? o.at[1]]);
  const P = cnPose(o2);
  const J = solve(P);
  const res = {};
  const box = [x - 340 * s, y - 600 * s, x + 340 * s, y + 40 * s];
  lit(ctx, box, s, (c) => {
    c.save(); c.translate(x, y); c.scale(s * fl, s); c.lineCap = 'round'; c.lineJoin = 'round';
    if (o.shadow !== false) { c.fillStyle = 'rgba(8,6,24,0.35)'; ell(c, (P.footL[0] + P.footR[0]) / 2 + 6, 2, 96, 13); c.fill(); }
    if (P.back) P.back(c);
    cnLegs(c, J);
    cnTorso(c, P, o);
    // head
    c.save(); c.translate(J.headC[0], J.headC[1]); c.rotate(J.hRot); c.scale(HS, HS);
    cnHead(c, { t, expr: P.expr, turn: P.turn, lookX: P.lookX, lookY: P.lookY, brow: P.brow, browL: P.browL, browR: P.browR });
    c.restore();
    if (P.mid) P.mid(c);
    if (P.tool) P.tool(c);
    const parts = {
      armL: () => cnArm(c, J.shL, J.elL, P.hL), armR: () => cnArm(c, J.shR, J.elR, P.hR),
      handL: () => cHand(c, P.hL[0], P.hL[1], 0.46, P.rL ?? handRot(J.elL, P.hL), { kind: P.kL, skin: CN.skin, flip: P.flipL }),
      handR: () => cHand(c, P.hR[0], P.hR[1], 0.46, P.rR ?? handRot(J.elR, P.hR), { kind: P.kR, skin: CN.skin, flip: P.flipR }),
    };
    for (const k of P.order) parts[k]();
    if (P.front) P.front(c);
    if (P.hold) P.hold(c);
    c.restore();
    if (P.ex._plateFn && P.ex.plate) { const p = P.ex.plate, pc = toL([p.x, p.y]); o.plateFn(c, { x: pc[0], y: pc[1], rx: p.rx * s, ry: p.ry * s, s }); }
  }, o);
  return cnAnchors(P, J, toL, s, res);
}
function cnAnchors(P, J, toL, s, res) {
  const hp = (p) => toL(add(J.headC, rot2(mulv(p, HS), J.hRot)));
  const fx = P.turn * 22, X = P.ex;
  const out = {
    head: toL(J.headC), face: { x: toL(J.headC)[0], y: toL(J.headC)[1], s: HS * s }, eyes: hp([fx, -10]), mouth: hp([fx * 1.05, 64]), nose: hp([fx * 1.25, 26]),
    handL: toL(P.hL), handR: toL(P.hR), footL: toL(P.footL), footR: toL(P.footR), hip: toL(P.hip),
  };
  if (X.fan) out.fan = { grip: toL(X.fan.grip), center: toL(X.fan.center), rot: X.fan.rot, dir: X.fan.dir };
  if (X.tongs) out.tongs = { tip: toL(X.tongs.tip), base: toL(X.tongs.base), ang: X.tongs.ang, open: X.tongs.open };
  if (X.plate) { const p = toL([X.plate.x, X.plate.y]); out.plate = { x: p[0], y: p[1], rx: X.plate.rx * s, ry: X.plate.ry * s, s }; }
  if (X.pour) out.pour = toL(X.pour);
  if (X.bowl) out.bowl = toL(X.bowl);
  if (X.towel) out.towel = toL(X.towel);
  if (X.spoon) out.spoon = toL(X.spoon);
  if (X.lap) out.plate = (() => { const p = toL(X.lap); return { x: p[0], y: p[1] }; })();
  return Object.assign(out, res);
}

// ---- Cô Năm close-up bust: (x,y) = head centre, head radius ~270 px at s = 1
function coNamFace(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, turn = o.turn ?? 0.3, tilt = o.tilt || 0, HSF = 2.5 * s;
  const box = [x - 560 * s, y - 380 * s, x + 560 * s, y + 900 * s];
  let ex = o.expr || 'smile'; if (o.wink) ex = 'wink';
  lit(ctx, box, s * 3, (c) => {
    c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
    // shoulders / áo bà ba
    c.save(); c.scale(HSF / 2.5, HSF / 2.5);
    const sh = new Path2D(); sh.moveTo(-520, 900); sh.quadraticCurveTo(-500, 420, -240, 330); sh.quadraticCurveTo(-110, 300, -60, 250); sh.lineTo(80, 250); sh.quadraticCurveTo(130, 300, 260, 330); sh.quadraticCurveTo(520, 420, 540, 900); sh.closePath();
    c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(sh);
    c.fillStyle = lgr(c, -520, 0, 540, 0, [[0, CN.ao[2]], [0.5, CN.ao[1]], [0.8, CN.ao[0]], [1, CN.ao[1]]]); c.fill(sh);
    c.save(); c.clip(sh); c.save(); c.scale(3.2, 3.2); c.fillStyle = c.createPattern(flowerTile(), 'repeat'); c.globalAlpha = 0.85; c.fillRect(-180, 60, 360, 240); c.restore();
    c.fillStyle = 'rgba(50,25,80,0.28)'; ell(c, 10, 300, 200, 70); c.fill();
    c.strokeStyle = 'rgba(70,40,100,0.55)'; c.lineWidth = 5; c.beginPath(); c.moveTo(40, 330); c.quadraticCurveTo(54, 600, 50, 900); c.stroke();
    c.fillStyle = '#f5f0fa'; for (const by of [420, 560, 700]) { ell(c, 54, by, 9, 9); c.fill(); }
    c.restore();
    // neck
    c.beginPath(); c.moveTo(-70, 120); c.lineTo(-74, 300); c.quadraticCurveTo(10, 350, 90, 300); c.lineTo(80, 120); c.closePath(); outFill(c, lgr(c, -70, 0, 90, 0, [[0, CN.skin[2]], [1, CN.skin[1]]]), 5);
    c.fillStyle = 'rgba(90,40,25,0.28)'; ell(c, 6, 170, 70, 26); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(-92, 268); c.quadraticCurveTo(6, 350, 104, 268); c.stroke();
    c.strokeStyle = CN.aoCuff; c.lineWidth = 5; c.beginPath(); c.moveTo(-86, 272); c.quadraticCurveTo(6, 344, 98, 272); c.stroke();
    c.restore();
    c.rotate(tilt); c.scale(HSF, HSF);
    cnHead(c, { t, expr: ex, turn, lookX: o.lookX ?? 0.2, lookY: o.lookY ?? 0, brow: o.brow || 0, browL: ex === 'skeptic' ? -0.6 : 0, browR: ex === 'skeptic' ? 1 : 0 });
    c.restore();
  }, o);
  const hp = (p) => { const r = rot2(mulv(p, HSF), tilt); return [x + r[0], y + r[1]]; };
  const fx = turn * 22;
  return { head: [x, y], eyes: hp([fx, -10]), mouth: hp([fx * 1.05, 64]), nose: hp([fx * 1.25, 26]), s: HSF };
}

// ================================================================== TOURIST
const TR = {
  skin: SK_TR, hair: ['#f8e19a', '#dcb35c', '#a7782f'], brow: '#b98a42',
  tee: ['#45d0c4', '#22a89f', '#137a76'], shorts: ['#cdb382', '#b59a6a', '#8a7248'], pack: ['#e08a45', '#c46a2b', '#8e4719'],
  shoe: '#f1efe8', shoeD: '#b8b6ae', sock: '#ffffff', eye: '#3c86c8', burn: '#ee8a7c', soot: '#55504c',
};
const TS = 1.2; // tourist figure units -> 600 px at s = 1
function trPose(o) {
  const P = basePose(o), t = o.t || 0, k = clamp(o.k ?? 0.5);
  let pose = P.pose;
  const seated = pose === 'sit' || pose === 'eat' || (o.sit && /^(stand|thumbs|wave|wink)$/.test(pose));
  P.turn = 0.3; P.lookX = 0.3; P.expr = 'smile';
  P.hL = [-58, -240]; P.rL = PI / 2 + 0.2; P.flipL = false; P.hR = [60, -240]; P.rR = PI / 2 - 0.1; P.flipR = false;
  const breath = Math.sin(t * 1.9); P.hip[1] += breath * 1.2; P.shUp = breath * 1.4;
  if (seated) {
    const SH = o.seatH !== undefined ? o.seatH / TS : 0.30 * 322.6 / TS;
    P.oy = SH; P.hip = [-8, -SH - 24 + breath * 1]; P.footL = [96, 0]; P.footR = [140, 0]; P.knee = 'up'; P.lean = -0.04;
    P.hL = [40, -SH - 58]; P.kL = 'flat'; P.rL = -0.2; P.hR = [60, -SH - 50]; P.kR = 'flat'; P.rR = -0.25; P.shadow = false; // hands resting on the thighs
    P.seatH = SH;
  }
  const gait = (amp, lift, sp) => {
    const ph = t * TAU * sp, sw = Math.sin(ph);
    P.footL = [-12 + amp * sw, -Math.max(0, Math.cos(ph)) * lift];
    P.footR = [16 - amp * sw, -Math.max(0, -Math.cos(ph)) * lift];
    P.hip = [sw * 4, -248 - Math.abs(Math.cos(ph)) * 6];
    return sw;
  };
  switch (pose) {
    case 'walk': {
      const sw = gait(48, 20, o.speed ?? 0.8);
      P.lean = 0.06; P.hL = [-30 - 40 * sw, -244]; P.hR = [44 + 40 * sw, -244]; P.rL = PI / 2 + 0.3 * sw; P.rR = PI / 2 - 0.3 * sw;
      P.expr = 'smile'; P.lookX = 0.8; P.turn = 0.35;
      break;
    }
    case 'sniff': {
      const e = ease.inOut(k), fl = Math.sin(t * 2.4) * 4 * e;
      P.lean = 0.16 + 0.06 * e; P.hip = [8, -250 - 34 * e + fl]; P.footL = [-30, -24 * e]; P.footR = [10, -10 * e];
      P.hL = [-86 - 20 * e, -240 + 10 * e]; P.hR = [-50 - 26 * e, -232]; P.kL = P.kR = 'open'; P.rL = PI * 0.75; P.rR = PI * 0.7; P.flipR = false;
      P.elL = P.elR = 'down';
      P.expr = 'sniff'; P.tilt = -0.32; P.turn = 0.5; P.lookX = 0.4;
      break;
    }
    case 'grabFan': {
      const e = ease.out(k);
      P.lean = 0.1 * e; P.footR = [24 + 30 * e, 0]; P.hR = [lerp(60, 172, e), lerp(-250, -360, e)]; P.elR = 'down';
      if (k < 0.7) { P.kR = 'open'; P.rR = lerp(PI / 2, -0.15, e); } else {
        P.kR = 'grip'; const fr = -0.2 + Math.sin(t * 6) * 0.06; P.rR = fr;
        if (o.fan !== false) P.tool = (c) => { const gp = add(P.hR, rot2([22, -2], fr)); quatNan(c, gp[0], gp[1], 0.62, fr); const dir = rot2([0, -1], fr); P.ex.fan = { grip: gp, center: add(gp, mulv(dir, 78)), rot: fr, dir }; };
      }
      P.hL = [-40, -262]; P.kL = 'open'; P.rL = PI * 0.8;
      P.expr = k < 0.7 ? 'o' : 'grin'; P.lookX = 1; P.turn = 0.55;
      break;
    }
    case 'fanFrantic': {
      const rate = o.rate ?? 6.5, ph = t * TAU * rate, sw = Math.sin(ph);
      P.lean = 0.12; P.footL = [-34, 0]; P.footR = [38, 0];
      const hp = (s2) => [126 + 10 * s2, -318 + 26 * s2], fr = (s2) => PI * 0.6 + 0.7 * s2;
      P.hR = hp(sw); P.kR = 'grip'; P.rR = fr(sw); P.elR = 'down';
      P.ghost = [Math.sin(ph - 0.9), Math.sin(ph - 1.8), Math.sin(ph - 2.6)].map((g) => ({ h: hp(g), r: fr(g) }));
      P.tool = (c) => { const gp = add(P.hR, rot2([22, -2], P.rR)); quatNan(c, gp[0], gp[1], 0.62, P.rR, { blur: 1 }); const dir = rot2([0, -1], P.rR); P.ex.fan = { grip: gp, center: add(gp, mulv(dir, 78)), rot: P.rR, dir }; };
      P.hL = [-56, -268]; P.kL = 'fist'; P.rL = PI * 0.62;
      P.expr = 'strain'; P.lookX = 0.9; P.lookY = 0.7; P.turn = 0.5; P.tilt = 0.06 * sw;
      break;
    }
    case 'stiff': {
      const e = clamp(k);
      P.footL = [-10, 0]; P.footR = [12, 0]; P.hip = [0, -252]; P.lean = -0.12 * e;
      P.hL = [-50, -226]; P.hR = [50, -226]; P.kL = P.kR = 'flat'; P.rL = PI / 2 + 0.05; P.rR = PI / 2 - 0.05; P.flipR = true;
      P.expr = 'stiff'; P.turn = 0.1; P.lookX = 0; P.lookY = 0;
      if (e > 0) { P.rigid = -0.12 * e; }
      break;
    }
    case 'eat': {
      const e = ease.inOut(k), SH = P.seatH;
      P.lean = 0.06 + 0.08 * (1 - e);
      const plate = [150, -SH - 70];
      P.hR = lerpP([150, -SH - 92], [50, -SH - 134], e); P.kR = 'grip'; P.rR = lerp(1.32, -0.62, e); P.elR = 'down';
      P.hL = [100, -SH - 80]; P.kL = 'grip'; P.rL = -0.1 + PI / 2; P.elL = 'down';
      P.order = ['armR', 'handR']; P.farBehind = true; // far (fork) arm passes behind the torso, only the hand shows
      P.tool = (c) => {
        // fork (left): tines down into the plate
        const fg = add(P.hL, rot2([22, -2], P.rL)), fa = 0.9;
        const fd = [Math.cos(fa), Math.sin(fa)], ft = add(fg, mulv(fd, 46));
        c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(fg[0] - fd[0] * 22, fg[1] - fd[1] * 22); c.lineTo(ft[0], ft[1]); c.stroke();
        c.strokeStyle = '#dfe5ec'; c.lineWidth = 3.5; c.stroke();
        // spoon (right): bowl toward the mouth
        const sg = add(P.hR, rot2([22, -2], P.rR)), sd = rot2([0, -1], P.rR), st = add(sg, mulv(sd, 52));
        c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(sg[0] - sd[0] * 18, sg[1] - sd[1] * 18); c.lineTo(st[0], st[1]); c.stroke();
        c.strokeStyle = '#e8edf2'; c.lineWidth = 3.5; c.stroke();
        ell(c, st[0] + sd[0] * 8, st[1] + sd[1] * 8, 11, 7, Math.atan2(sd[1], sd[0])); outFill(c, '#eef2f6', 2);
        if (o.rice !== false && e < 0.98) { c.fillStyle = '#fbf6ea'; ell(c, st[0] + sd[0] * 8, st[1] + sd[1] * 8 - 3, 8, 4, Math.atan2(sd[1], sd[0])); c.fill(); }
        P.ex.spoon = add(st, mulv(sd, 8));
      };
      P.ex.lap = plate;
      P.expr = e > 0.8 ? 'chew' : 'delight'; P.lookX = 0.8; P.lookY = lerp(0.8, 0.1, e); P.turn = 0.4; P.tilt = lerp(0.12, -0.04, e);
      break;
    }
    case 'thumbs': {
      P.hR = seated ? [112, -P.seatH - 262] : [110, -360]; P.kR = 'thumb'; P.rR = -0.05; P.elR = 'down';
      P.expr = 'grin'; P.turn = 0.2; P.lookX = 0.1; P.tilt = 0.05;
      break;
    }
    case 'wave': {
      const w = Math.sin(t * TAU * 1.7);
      P.hR = seated ? [90, -P.seatH - 470] : [86, -506]; P.kR = 'wave'; P.rR = -PI / 2 + 0.3 * w; P.elR = 'out';
      P.expr = 'grin'; P.turn = 0.3; P.lookX = 0.4;
      break;
    }
    case 'wink': {
      P.hR = seated ? [120, -P.seatH - 250] : [126, -372]; P.kR = 'point'; P.rR = -0.2; P.elR = 'down';
      if (!seated) { P.hL = [-62, -262]; P.kL = 'fist'; P.rL = PI * 0.62; }
      P.expr = 'wink'; P.turn = 0.15; P.lookX = 0; P.tilt = 0.08;
      break;
    }
    case 'sit': break;
    default: { // stand
      if (!seated) { P.hL = [-50, -232]; P.hR = [52, -234]; P.kL = P.kR = 'flat'; P.rL = PI / 2 + 0.12; P.rR = PI / 2 - 0.12; P.flipR = true; }
    }
  }
  if (o.expr) P.expr = o.expr;
  if (o.turn !== undefined) P.turn = o.turn;
  if (o.tilt !== undefined) P.tilt = o.tilt;
  if (o.lookX !== undefined) P.lookX = o.lookX;
  if (o.lookY !== undefined) P.lookY = o.lookY;
  if (o.lean) P.lean += o.lean;
  return P;
}

// soot blotch set (head units), deterministic
const _sootH = (() => { const r = rng(4242), a = []; for (let i = 0; i < 26; i++) a.push([(r() * 2 - 1) * 100, (r() * 2 - 1) * 110, 10 + r() * 26, 7 + r() * 18, r() * PI, r()]); return a; })();
function trHead(ctx, o = {}) {
  const t = o.t || 0, ex = o.expr || 'smile', fx = (o.turn || 0) * 22, br = o.brow || 0;
  const soot = clamp(o.soot || 0), up = clamp(o.hairUp || 0), rac = clamp(o.raccoon || 0), blink = clamp(o.blink || 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // back hair mass (behind the face)
  ctx.beginPath(); ctx.moveTo(-96, 40); ctx.bezierCurveTo(-118, -60, -70, -132, 8, -128); ctx.bezierCurveTo(80, -128, 112, -70, 100, -10); ctx.lineTo(-96, 40); ctx.closePath();
  outFill(ctx, mixc(TR.hair[1], '#2a2420', soot * 0.6), 3);
  // ear
  const ex0 = -86 + fx * 0.45;
  ell(ctx, ex0, 8, 15, 25); outFill(ctx, mixc(TR.skin[1], TR.soot, soot * 0.28), 3);
  ctx.strokeStyle = 'rgba(150,70,55,0.5)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(ex0, 8, 8, PI - 1.9, PI + 1.9); ctx.stroke();
  // face: longer oval, defined jaw
  const face = new Path2D();
  face.moveTo(fx * 0.2, -112); face.bezierCurveTo(58, -114, 92 + fx * 0.1, -80, 92, -20); face.bezierCurveTo(92, 40, 88, 84, 70 + fx * 0.3, 112);
  face.quadraticCurveTo(44 + fx * 0.4, 140, 8 + fx * 0.5, 142); face.quadraticCurveTo(-36, 140, -60, 112); face.bezierCurveTo(-84, 84, -92, 40, -92, -20);
  face.bezierCurveTo(-94, -80, -58, -114, fx * 0.2, -112); face.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(face);
  ctx.fillStyle = rgr(ctx, 26 + fx, -30, 8, 8, 4, 150, [[0, TR.skin[0]], [0.6, TR.skin[1]], [1, TR.skin[2]]]); ctx.fill(face);
  ctx.save(); ctx.clip(face);
  ctx.fillStyle = lgr(ctx, -98, 0, -36 + fx * 0.6, 0, [[0, 'rgba(150,70,60,0.24)'], [1, 'rgba(150,70,60,0)']]); ctx.fillRect(-100, -120, 120, 270);
  ctx.fillStyle = rgr(ctx, fx * 1.25 + 8, 18, 0, fx * 1.25 + 8, 18, 26, [[0, 'rgba(238,110,100,0.4)'], [1, 'rgba(238,110,100,0)']]); ctx.fillRect(fx * 1.25 - 24, -12, 64, 60); // sunburnt nose
  // stubble shadow along the jaw + upper lip, stipple
  ctx.fillStyle = rgr(ctx, fx * 0.8 + 4, 96, 10, fx * 0.8 + 4, 96, 70, [[0, 'rgba(150,110,70,0.22)'], [1, 'rgba(150,110,70,0)']]); ctx.fillRect(-100, 40, 200, 110);
  ctx.fillStyle = 'rgba(120,80,40,0.35)';
  for (let i = 0; i < 46; i++) { const a = (i * 2.399) % TAU, r = 30 + ((i * 37) % 31); const px = fx * 0.8 + 4 + Math.cos(a) * r * 1.05, py = 100 + Math.sin(a) * r * 0.55; if (py > 62) { ctx.fillRect(px, py, 2, 2); } }
  ctx.fillStyle = 'rgba(238,120,105,0.28)'; ell(ctx, -50 + fx * 0.8, 28, 22, 13); ctx.fill(); ell(ctx, 56 + fx, 28, 22, 13); ctx.fill();
  ctx.fillStyle = 'rgba(170,90,50,0.45)'; // freckles
  for (const [a, b] of [[-46, 18], [-38, 26], [-30, 16], [-50, 30], [44, 18], [52, 26], [36, 22], [60, 16], [8, 10], [-6, 14], [20, 8]]) { ell(ctx, a + fx * (a > 0 ? 1 : 0.8), b, 2.2, 2); ctx.fill(); }
  if (soot > 0.01) {
    // grey ash smudges (soft, semi-transparent) — skin stays visible underneath
    ctx.fillStyle = rgba(TR.soot, 0.2 * soot); ctx.fillRect(-120, -130, 240, 260);
    for (const [bx, by, rx, ry, ro, v] of _sootH) {
      if (v < 0.25 + soot * 0.6) {
        const cx = bx + fx * 0.5, rr = Math.max(rx, ry) * 1.25;
        ctx.fillStyle = rgr(ctx, cx, by, 0, cx, by, rr, [[0, rgba(TR.soot, 0.62 * soot)], [1, rgba(TR.soot, 0)]]);
        ell(ctx, cx, by, rx * 1.25, ry * 1.25, ro); ctx.fill();
      }
    }
  }
  if (rac > 0.01) { // towel wipe: a clean skin stripe across the eyes
    ctx.globalAlpha = rac;
    ctx.fillStyle = lgr(ctx, 0, -44, 0, 22, [[0, rgba(TR.skin[0], 0)], [0.2, TR.skin[0]], [0.8, TR.skin[0]], [1, rgba(TR.skin[0], 0)]]);
    ctx.fillRect(-100, -44, 200, 66);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // hair
  const hc = TR.hair.map((cc) => mixc(cc, '#3a3230', soot * 0.55));
  if (up > 0.01) {
    // singed spikes standing up
    ctx.save();
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = -PI + 0.2 + (i / (n - 1)) * (PI - 0.4), ln = (52 + ((i * 37) % 23) * 1.6) * up + 12, wob = Math.sin(t * 9 + i) * 3 * up;
      const b0 = [Math.cos(a - 0.2) * 92, Math.sin(a - 0.2) * 92 - 30], b1 = [Math.cos(a + 0.2) * 92, Math.sin(a + 0.2) * 92 - 30];
      const tip = [Math.cos(a) * (96 + ln) + wob, Math.sin(a) * (96 + ln) - 30];
      ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.quadraticCurveTo((b0[0] + tip[0]) / 2 - 6, (b0[1] + tip[1]) / 2, tip[0], tip[1]); ctx.quadraticCurveTo((b1[0] + tip[0]) / 2 + 6, (b1[1] + tip[1]) / 2, b1[0], b1[1]); ctx.closePath();
      outFill(ctx, lgr(ctx, b0[0], b0[1], tip[0], tip[1], [[0, hc[1]], [0.6, hc[0]], [1, '#2a2222']]), 2.6);
    }
    ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(-96, 6); ctx.bezierCurveTo(-112, -92, -56, -134, 10, -132); ctx.bezierCurveTo(78, -132, 110, -86, 98, -22);
  // swept fringe tufts to +x
  ctx.quadraticCurveTo(92, -50, 76, -58); ctx.quadraticCurveTo(70, -36, 56, -30); ctx.quadraticCurveTo(52, -56, 34, -66);
  ctx.quadraticCurveTo(26, -44, 6, -40); ctx.quadraticCurveTo(10, -64, -10, -74); ctx.quadraticCurveTo(-30, -52, -50, -50);
  ctx.quadraticCurveTo(-56, -66, -70, -60); ctx.quadraticCurveTo(-84, -30, -84, 4); ctx.closePath();
  outFill(ctx, lgr(ctx, 0, -134, 0, -30, [[0, hc[0]], [0.6, hc[1]], [1, hc[2]]]), 3);
  ctx.strokeStyle = rgba(hc[2], 0.7); ctx.lineWidth = 2.4;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-70 + i * 26, -118 + Math.abs(i - 2.5) * 4); ctx.quadraticCurveTo(-50 + i * 26, -96, -40 + i * 24, -62); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,250,215,0.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(10, -40, 84, -2.2, -1.2); ctx.stroke();
  // sunglasses pushed up on the head (askew when hair is up)
  ctx.save(); ctx.translate(fx * 0.7 + 6, -106 - up * 30); ctx.rotate(-0.06 + up * 0.38);
  ctx.strokeStyle = '#141418'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-74, 4); ctx.lineTo(-100, 14); ctx.stroke();
  for (const sx of [-1, 1]) { rrect(ctx, sx * 34 - 26, -14, 52, 30, 12); outFill(ctx, lgr(ctx, 0, -14, 0, 16, [[0, '#3c4a66'], [0.5, '#1b2232'], [1, '#2b2140']]), 3.2, '#101014');
    ctx.fillStyle = 'rgba(255,170,220,0.5)'; rrect(ctx, sx * 34 - 18, -9, 16, 5, 2.5); ctx.fill(); }
  ctx.strokeStyle = '#101014'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -4); ctx.quadraticCurveTo(0, -10, 8, -4); ctx.stroke();
  if (up > 0.5) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22, -12); ctx.lineTo(34, 4); ctx.lineTo(40, -6); ctx.stroke(); } // cracked lens
  ctx.restore();
  // brows
  const bc = soot > 0.5 ? '#1a1616' : TR.brow;
  ctx.strokeStyle = bc; ctx.lineWidth = 8;
  for (const sx of [-1, 1]) {
    const ox = sx * 36 + fx;
    let lift = br * 10, ang = 0;
    if (ex === 'o' || ex === 'stiff' || ex === 'sniff' || ex === 'delight') lift += 9;
    if (ex === 'strain' || ex === 'cough') ang = 7;
    const by2 = -44 - lift;
    ctx.beginPath(); ctx.moveTo(ox - sx * 20, by2 + 4 + (sx > 0 ? ang : ang * 0.6)); ctx.quadraticCurveTo(ox, by2 - 7, ox + sx * 22, by2 + 2 - (ang ? 3 : 0)); ctx.stroke();
  }
  // eyes
  const lx = (o.lookX || 0) * 5, ly = (o.lookY || 0) * 4;
  for (const sx of [-1, 1]) {
    const exx = sx * 34 + fx, ey = -10, far = sx < 0 ? 0.9 : 1;
    const shut = ex === 'sniff' || ex === 'cough' || (ex === 'wink' && sx < 0) || ex === 'chew';
    if (shut) {
      ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 5; ctx.beginPath();
      if (ex === 'cough') { ctx.moveTo(exx - 14, ey - 8); ctx.lineTo(exx + 2 * sx, ey); ctx.lineTo(exx - 14, ey + 8); if (sx > 0) { ctx.moveTo(exx + 14, ey - 8); ctx.lineTo(exx - 2, ey); ctx.lineTo(exx + 14, ey + 8); ctx.beginPath(); ctx.moveTo(exx + 14, ey - 8); ctx.lineTo(exx - 2, ey); ctx.lineTo(exx + 14, ey + 8); } }
      else if (ex === 'wink') { ctx.moveTo(exx - 14, ey); ctx.quadraticCurveTo(exx, ey + 8, exx + 14, ey); }
      else { ctx.moveTo(exx - 15, ey + 2); ctx.quadraticCurveTo(exx, ey - 10, exx + 15, ey + 2); }
      ctx.stroke(); continue;
    }
    const wide = ex === 'stiff' || ex === 'o';
    const ry = (wide ? 14 : ex === 'grin' || ex === 'wink' || ex === 'delight' ? 8.5 : ex === 'strain' ? 5.5 : 10) * far;
    const rx = (wide ? 18 : 17) * far;
    ctx.beginPath();
    if (wide) { ell(ctx, exx, ey - 2, rx, ry); } else { ctx.moveTo(exx - rx, ey); ctx.quadraticCurveTo(exx, ey - ry * 1.7, exx + rx, ey); ctx.quadraticCurveTo(exx, ey + ry * 1.05, exx - rx, ey); ctx.closePath(); }
    ctx.fillStyle = '#f8f4ee'; ctx.fill();
    ctx.save(); ctx.clip();
    const pr = wide ? 5 : 9;
    ctx.fillStyle = TR.eye; ell(ctx, exx + lx, ey - 2 + ly, pr, pr * 1.05); ctx.fill();
    ctx.fillStyle = '#0d1018'; ell(ctx, exx + lx, ey - 2 + ly, pr * 0.48, pr * 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, exx + lx + 2.5, ey - 5 + ly, 2.2, 2.2); ctx.fill();
    if (ex === 'delight') { ctx.fillStyle = '#fff'; ell(ctx, exx + lx - 3, ey + 1 + ly, 1.6, 1.6); ctx.fill(); }
    if (blink > 0.01) { ctx.fillStyle = soot > 0.4 && rac < 0.5 ? mixc(TR.skin[1], TR.soot, 0.3) : TR.skin[1]; ctx.fillRect(exx - 22, ey - 26, 44, 26 * blink * 1.5); }
    ctx.restore();
    ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 3.4; ctx.beginPath();
    if (wide) { ctx.arc(exx, ey - 2, rx + 0.5, PI * 1.05, PI * 1.95); } else { ctx.moveTo(exx - rx - 1, ey + 1); ctx.quadraticCurveTo(exx, ey - ry * 1.8, exx + rx + 1, ey + 1); }
    ctx.stroke();
    if (blink > 0.5) { ctx.beginPath(); ctx.moveTo(exx - rx, ey - 2 + (blink - 0.5) * 18); ctx.lineTo(exx + rx, ey - 2 + (blink - 0.5) * 18); ctx.stroke(); }
  }
  // nose (longer)
  const nx = fx * 1.3;
  ctx.strokeStyle = 'rgba(150,70,50,0.55)'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(nx + 2, -8); ctx.quadraticCurveTo(nx + 16, 16, nx + 14, 30); ctx.quadraticCurveTo(nx + 8, 36, nx - 2, 34); ctx.stroke();
  ctx.fillStyle = 'rgba(100,40,30,0.55)'; ell(ctx, nx - 6, 36, 4, 2.6); ctx.fill(); ell(ctx, nx + 9, 36, 4, 2.6); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,230,0.6)'; ell(ctx, nx + 8, 18, 4, 5); ctx.fill();
  // mouth
  const my = 80, mx = fx * 1.05;
  if (ex === 'grin' || ex === 'wink' || ex === 'delight') {
    const w = ex === 'delight' ? 36 : 32;
    ctx.beginPath(); ctx.moveTo(mx - w, my - 8); ctx.quadraticCurveTo(mx, my + (ex === 'delight' ? 40 : 28), mx + w, my - 8); ctx.quadraticCurveTo(mx, my, mx - w, my - 8); ctx.closePath();
    outFill(ctx, '#5a1e1e', 2.6); ctx.save(); ctx.clip(); ctx.fillStyle = '#fbf7ef'; ctx.fillRect(mx - w, my - 10, w * 2, 11); if (ex === 'delight') { ctx.fillStyle = '#d8606a'; ell(ctx, mx, my + 26, 14, 8); ctx.fill(); } ctx.restore();
  } else if (ex === 'o' || ex === 'cough') {
    ell(ctx, mx, my + 4, ex === 'cough' ? 13 : 11, ex === 'cough' ? 9 : 15); outFill(ctx, '#4a1a1a', 2.4);
  } else if (ex === 'sniff') {
    ctx.strokeStyle = '#7a3a34'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(mx - 18, my - 2); ctx.quadraticCurveTo(mx, my + 10, mx + 18, my - 2); ctx.stroke();
  } else if (ex === 'strain') {
    rrect(ctx, mx - 28, my - 10, 56, 18, 6); outFill(ctx, '#fbf7ef', 3);
    ctx.strokeStyle = 'rgba(80,60,60,0.6)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(mx - 28, my - 1); ctx.lineTo(mx + 28, my - 1); for (let i = -2; i <= 2; i++) { ctx.moveTo(mx + i * 10, my - 10); ctx.lineTo(mx + i * 10, my + 8); } ctx.stroke();
  } else if (ex === 'stiff') {
    ctx.strokeStyle = '#5a2a24'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx - 20, my);
    for (let i = 1; i <= 4; i++) ctx.lineTo(mx - 20 + i * 10, my + (i % 2 ? -3 : 3)); ctx.stroke();
  } else if (ex === 'chew') {
    const ch = Math.sin(t * 10);
    ctx.strokeStyle = '#7a3a34'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(mx - 16, my + ch * 2); ctx.quadraticCurveTo(mx, my + 8 - ch * 3, mx + 18, my - 2); ctx.stroke();
  } else {
    ctx.strokeStyle = '#7a3a34'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(mx - 24, my - 4); ctx.quadraticCurveTo(mx, my + 14, mx + 24, my - 4); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(150,80,60,0.35)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(fx * 0.9 - 8, 122); ctx.quadraticCurveTo(fx * 0.9 + 2, 127, fx * 0.9 + 12, 122); ctx.stroke(); // chin
  if (ex === 'chew' || o.cheek) { // bulging cheek: pushes the face edge out
    const kk = o.cheek ?? (0.7 + 0.3 * Math.sin(t * 10)), cx = 84 + fx * 0.3, cy = 56, r = 10 + 16 * kk;
    ell(ctx, cx, cy, r, r * 1.15); ctx.fillStyle = TR.skin[1]; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.15, 0, -1.25, 1.25); ctx.stroke();
    ctx.fillStyle = rgr(ctx, cx - 6, cy, 0, cx - 6, cy, r + 6, [[0, 'rgba(240,120,110,0.4)'], [1, 'rgba(240,120,110,0)']]); ctx.fillRect(cx - r - 10, cy - r - 10, 2 * r + 20, 2.4 * r + 20);
  }
  // smoke wisps rising off the hair
  const sw = clamp(o.smokeWisps || 0);
  if (sw > 0.01) {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.7 + i / 3) % 1, x0 = -40 + i * 40, y0 = -130 - up * 60 - ph * 120;
      ctx.strokeStyle = `rgba(90,86,96,${0.55 * sw * (1 - ph)})`; ctx.lineWidth = 14 - ph * 6;
      ctx.beginPath(); ctx.moveTo(x0, y0 + 40); ctx.bezierCurveTo(x0 + 24, y0 + 20, x0 - 24, y0 - 6, x0 + 6 * Math.sin(t * 3 + i), y0 - 30); ctx.stroke();
    }
    ctx.restore();
  }
}

function trLegs(c, J, P) {
  for (const g of J.legs) {
    const f = g.f, kneeLow = lerpP(g.kn, g.an, 0.08);
    // sneaker
    const toe = f[0] + 46;
    c.beginPath(); c.moveTo(f[0] - 20, f[1] - 2); c.lineTo(f[0] - 20, f[1] - 22); c.quadraticCurveTo(f[0] + 6, f[1] - 30, f[0] + 22, f[1] - 22); c.quadraticCurveTo(toe, f[1] - 18, toe, f[1] - 4); c.lineTo(toe, f[1] - 2); c.closePath();
    outFill(c, TR.shoe, 2.4);
    c.fillStyle = TR.tee[1]; c.beginPath(); c.moveTo(f[0] - 6, f[1] - 14); c.quadraticCurveTo(f[0] + 14, f[1] - 20, f[0] + 30, f[1] - 10); c.lineTo(f[0] + 26, f[1] - 6); c.quadraticCurveTo(f[0] + 12, f[1] - 13, f[0] - 4, f[1] - 9); c.closePath(); c.fill();
    rrect(c, f[0] - 22, f[1] - 6, toe - f[0] + 24, 7, 3); outFill(c, TR.shoeD, 1.6);
    // sock + bare shin
    capFS(c, f[0] - 4, f[1] - 26, f[0] - 2, f[1] - 40, 22, 22, TR.sock, 2);
    capFS(c, kneeLow[0], kneeLow[1], g.an[0], g.an[1] - 10, 30, 21, TR.skin[1], 2.4);
    c.save(); c.globalAlpha = 0.35; seg(c, kneeLow[0] + 4, kneeLow[1] + 6, g.an[0] + 3, g.an[1] - 16, 9, 6, TR.skin[0]); c.restore();
    // khaki shorts leg to just above the knee
    const sEnd = lerpP(g.hj, g.kn, 0.98);
    c.beginPath(); capPath(c, g.hj[0], g.hj[1], sEnd[0], sEnd[1], 58, 52); c.strokeStyle = OUT; c.lineWidth = 3.4; c.stroke();
    c.fillStyle = lgr(c, g.hj[0] - 30, 0, g.hj[0] + 30, 0, [[0, TR.shorts[2]], [0.5, TR.shorts[1]], [1, TR.shorts[0]]]); c.fill();
    // cargo pocket
    const pm = lerpP(g.hj, g.kn, 0.62), a = Math.atan2(g.kn[1] - g.hj[1], g.kn[0] - g.hj[0]);
    c.save(); c.translate(pm[0], pm[1]); c.rotate(a - PI / 2); rrect(c, -14 + g.sd * 4, -16, 30, 30, 4); outFill(c, TR.shorts[0], 1.6); c.fillStyle = TR.shorts[2]; c.fillRect(-14 + g.sd * 4, -16, 30, 7); c.restore();
    // hem
    const ha = Math.atan2(sEnd[1] - g.hj[1], sEnd[0] - g.hj[0]), hn = [-Math.sin(ha) * 27, Math.cos(ha) * 27];
    c.strokeStyle = 'rgba(60,45,20,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(sEnd[0] + hn[0] - Math.cos(ha) * 6, sEnd[1] + hn[1] - Math.sin(ha) * 6); c.lineTo(sEnd[0] - hn[0] - Math.cos(ha) * 6, sEnd[1] - hn[1] - Math.sin(ha) * 6); c.stroke();
  }
}
const _sootB = (() => { const r = rng(777), a = []; for (let i = 0; i < 18; i++) a.push([(r() * 2 - 1) * 60, -160 + r() * 200, 8 + r() * 22, 6 + r() * 14, r() * PI, r()]); return a; })();
function trTorso(c, P, o) {
  const su = P.shUp, soot = clamp(o.soot || 0);
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean);
  // waistband of the shorts
  rrect(c, -50, -12, 100, 40, 12); outFill(c, TR.shorts[1], 2.4);
  c.fillStyle = '#4a3a28'; c.fillRect(-50, -10, 100, 8);
  // tee
  const tor = new Path2D();
  tor.moveTo(-16, -158 + su); tor.quadraticCurveTo(-46, -158 + su, -56, -144 + su); tor.quadraticCurveTo(-60, -80, -56, 6); tor.quadraticCurveTo(0, 14, 58, 6); tor.quadraticCurveTo(62, -80, 56, -144 + su); tor.quadraticCurveTo(46, -158 + su, 18, -158 + su); tor.closePath();
  c.strokeStyle = OUT; c.lineWidth = 3; c.stroke(tor);
  c.fillStyle = lgr(c, -58, 0, 60, 0, [[0, TR.tee[2]], [0.45, TR.tee[1]], [0.8, TR.tee[0]], [1, TR.tee[1]]]); c.fill(tor);
  c.save(); c.clip(tor);
  // sun-over-waves print
  c.fillStyle = 'rgba(255,248,230,0.85)'; c.beginPath(); c.arc(18, -82, 20, PI, TAU); c.fill();
  c.strokeStyle = 'rgba(255,248,230,0.85)'; c.lineWidth = 3; for (let i = 0; i < 4; i++) { const a = PI + 0.4 + i * 0.75; c.beginPath(); c.moveTo(18 + Math.cos(a) * 25, -82 + Math.sin(a) * 25); c.lineTo(18 + Math.cos(a) * 33, -82 + Math.sin(a) * 33); c.stroke(); }
  c.lineWidth = 3.4; for (let j = 0; j < 2; j++) { c.beginPath(); for (let i = 0; i <= 6; i++) { const xx = -8 + i * 9, yy = -74 + j * 9 + (i % 2 ? -3 : 3); if (i) c.lineTo(xx, yy); else c.moveTo(xx, yy); } c.stroke(); }
  c.fillStyle = 'rgba(0,40,40,0.25)'; c.fillRect(-60, -170, 22, 190);
  c.strokeStyle = 'rgba(0,60,60,0.4)'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-30 + i * 22, -20); c.quadraticCurveTo(-24 + i * 22, -2, -28 + i * 22, 8); c.stroke(); }
  if (soot > 0.01) { c.fillStyle = rgba(TR.soot, 0.42 * soot); for (const [bx, by, rx, ry, ro, v] of _sootB) if (v < 0.3 + soot * 0.7) { ell(c, bx, by, rx, ry, ro); c.fill(); } }
  c.restore();
  // crew neck + neck
  capFS(c, 0, -148 + su, 4, -182 + su, 32, 30, mixc(TR.skin[1], TR.soot, soot * 0.28), 2.2);
  c.strokeStyle = OUT; c.lineWidth = 9; c.beginPath(); c.moveTo(-17, -157 + su); c.quadraticCurveTo(3, -144 + su, 22, -157 + su); c.stroke();
  c.strokeStyle = TR.tee[0]; c.lineWidth = 6; c.stroke();
  // backpack straps (front)
  if (o.pack !== false) {
    for (const xx of [-34]) { c.strokeStyle = OUT; c.lineWidth = 15; c.beginPath(); c.moveTo(xx + 2, -156 + su); c.quadraticCurveTo(xx - 6, -100, xx - 8, -40); c.stroke(); c.strokeStyle = '#3a3a44'; c.lineWidth = 12; c.stroke(); c.fillStyle = '#8a8a96'; c.fillRect(xx - 12, -96, 10, 8); }
  }
  c.restore();
}
function trPack(c, P) {
  c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean);
  rrect(c, -96, -170, 64, 150, 22); outFill(c, lgr(c, -96, 0, -32, 0, [[0, TR.pack[2]], [0.5, TR.pack[1]], [1, TR.pack[0]]]), 3);
  rrect(c, -100, -86, 40, 54, 12); outFill(c, TR.pack[1], 2.4);
  c.strokeStyle = 'rgba(40,20,10,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-98, -72); c.lineTo(-62, -72); c.stroke();
  rrect(c, -86, -192, 30, 26, 8); outFill(c, '#3a3a44', 2.4); // rolled mat strap top
  c.restore();
}
function trArm(c, sh, el, h, soot) {
  const sk = soot > 0.01 ? TR.skin.map((cc) => mixc(cc, TR.soot, soot * 0.25)) : TR.skin;
  cArm(c, sh, el, h, { skin: sk, wu: [24, 20], wf: [20, 16], sleeve: soot > 0.01 ? mixc(TR.tee[1], TR.soot, soot * 0.35) : TR.tee[1], sleeveTo: 0.5, cuff: TR.tee[0] });
}

function tourist(ctx, x, y, s = 1, o = {}) {
  const fl = o.flip ? -1 : 1, t = o.t || 0, S = s * TS;
  const P = trPose(o);
  const J = solve(P);
  const oy = P.oy || 0;
  const toL = (p) => [x + p[0] * S * fl, y + (p[1] + oy) * S];
  const box = [x - 360 * S, y - 640 * S, x + 380 * S, y + (40 + oy) * S];
  const soot = clamp(o.soot || 0);
  const skin = soot > 0.01 ? TR.skin.map((cc) => mixc(cc, TR.soot, soot * 0.25)) : TR.skin;
  lit(ctx, box, S, (c) => {
    c.save(); c.translate(x, y); c.scale(S * fl, S); c.translate(0, oy); c.lineCap = 'round'; c.lineJoin = 'round';
    if (P.shadow && o.shadow !== false) { c.fillStyle = 'rgba(8,6,24,0.35)'; ell(c, (P.footL[0] + P.footR[0]) / 2 + 8, 2, 92, 12); c.fill(); }
    if (P.rigid) { c.rotate(P.rigid); }
    if (o.pack !== false) trPack(c, P);
    if (P.back) P.back(c);
    if (P.farBehind) { trArm(c, J.shL, J.elL, P.hL, soot); cHand(c, P.hL[0], P.hL[1], 0.46, P.rL ?? handRot(J.elL, P.hL), { kind: P.kL, skin, flip: P.flipL }); }
    trLegs(c, J, P);
    trTorso(c, P, o);
    c.save(); c.translate(J.headC[0], J.headC[1]); c.rotate(J.hRot); c.scale(HS, HS);
    trHead(c, { t, expr: P.expr, turn: P.turn, lookX: P.lookX, lookY: P.lookY, brow: P.brow, soot, hairUp: o.hairUp, raccoon: o.raccoon, blink: o.blink, smokeWisps: o.smokeWisps, cheek: o.cheek });
    c.restore();
    if (P.mid) P.mid(c);
    if (P.ghost) { // frantic arm blur
      for (let i = P.ghost.length - 1; i >= 0; i--) {
        const g = P.ghost[i], el = ikUp(J.shR[0], J.shR[1], g.h[0], g.h[1], 92, 84, 1);
        c.save(); c.globalAlpha = 0.2 + 0.08 * (2 - i);
        trArm(c, J.shR, el, g.h, soot); cHand(c, g.h[0], g.h[1], 0.46, g.r, { kind: 'grip', skin, flip: false });
        const gp = add(g.h, rot2([22, -2], g.r)); quatNan(c, gp[0], gp[1], 0.62, g.r);
        c.restore();
      }
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 4;
      for (let i = 0; i < 4; i++) { const a = PI * 0.25 + i * 0.25; c.beginPath(); c.arc(J.shR[0] + 20, J.shR[1] + 40, 190 + i * 14, a, a + 0.5); c.stroke(); }
    }
    if (P.tool) P.tool(c);
    const parts = {
      armL: () => trArm(c, J.shL, J.elL, P.hL, soot), armR: () => trArm(c, J.shR, J.elR, P.hR, soot),
      handL: () => cHand(c, P.hL[0], P.hL[1], 0.46, P.rL ?? handRot(J.elL, P.hL), { kind: P.kL, skin, flip: P.flipL }),
      handR: () => cHand(c, P.hR[0], P.hR[1], 0.46, P.rR ?? handRot(J.elR, P.hR), { kind: P.kR, skin, flip: P.flipR }),
    };
    for (const k of P.order) parts[k]();
    if (P.front) P.front(c);
    if (P.hold) P.hold(c);
    c.restore();
  }, o);
  const hp = (p) => toL(add(J.headC, rot2(mulv(p, HS), J.hRot)));
  const fx = P.turn * 22, X = P.ex;
  const out = {
    head: toL(J.headC), face: { x: toL(J.headC)[0], y: toL(J.headC)[1], s: HS * S }, eyes: hp([fx, -10]), mouth: hp([fx * 1.05, 80]), nose: hp([fx * 1.3 + 14, 30]),
    handL: toL(P.hL), handR: toL(P.hR), footL: toL(P.footL), footR: toL(P.footR), hip: toL(P.hip),
  };
  if (X.fan) out.fan = { grip: toL(X.fan.grip), center: toL(X.fan.center), rot: X.fan.rot, dir: X.fan.dir };
  if (X.spoon) out.spoon = toL(X.spoon);
  if (X.lap) out.plate = toL(X.lap);
  return out;
}

// ---- tourist close-up bust: (x,y) = head centre, head radius ~270 px at s = 1
function touristFace(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, turn = o.turn ?? 0.25, tilt = o.tilt || 0, HSF = 2.5 * s, soot = clamp(o.soot || 0);
  const box = [x - 560 * s, y - 520 * s, x + 560 * s, y + 900 * s];
  let ex = o.expr || 'smile'; if (o.wink) ex = 'wink';
  lit(ctx, box, s * 3, (c) => {
    c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
    c.save(); c.scale(HSF / 2.5, HSF / 2.5);
    const sh = new Path2D(); sh.moveTo(-540, 900); sh.quadraticCurveTo(-520, 420, -260, 340); sh.quadraticCurveTo(-120, 310, -70, 270); sh.lineTo(90, 270); sh.quadraticCurveTo(140, 310, 270, 340); sh.quadraticCurveTo(540, 420, 560, 900); sh.closePath();
    c.strokeStyle = OUT; c.lineWidth = 6; c.stroke(sh);
    c.fillStyle = lgr(c, -540, 0, 560, 0, [[0, TR.tee[2]], [0.5, TR.tee[1]], [0.8, TR.tee[0]], [1, TR.tee[1]]]); c.fill(sh);
    c.save(); c.clip(sh);
    if (soot > 0.01) { c.fillStyle = rgba(TR.soot, 0.42 * soot); for (const [bx, by, rx, ry, ro, v] of _sootB) if (v < 0.3 + soot * 0.7) { ell(c, bx * 5, 600 + by * 2, rx * 4, ry * 4, ro); c.fill(); } }
    c.restore();
    // pack straps
    if (o.pack !== false) for (const xx of [-300, 300]) { c.strokeStyle = OUT; c.lineWidth = 74; c.beginPath(); c.moveTo(xx * 0.8, 330); c.quadraticCurveTo(xx, 600, xx * 1.05, 900); c.stroke(); c.strokeStyle = '#3a3a44'; c.lineWidth = 64; c.stroke(); }
    c.beginPath(); c.moveTo(-70, 120); c.lineTo(-76, 310); c.quadraticCurveTo(10, 360, 96, 310); c.lineTo(84, 120); c.closePath();
    outFill(c, lgr(c, -70, 0, 90, 0, [[0, mixc(TR.skin[2], TR.soot, soot * 0.28)], [1, mixc(TR.skin[1], TR.soot, soot * 0.28)]]), 5);
    c.fillStyle = 'rgba(110,50,40,0.25)'; ell(c, 6, 180, 70, 26); c.fill();
    c.strokeStyle = OUT; c.lineWidth = 30; c.beginPath(); c.moveTo(-96, 286); c.quadraticCurveTo(6, 352, 110, 286); c.stroke();
    c.strokeStyle = TR.tee[0]; c.lineWidth = 24; c.stroke();
    c.restore();
    c.rotate(tilt); c.scale(HSF, HSF);
    trHead(c, { t, expr: ex, turn, lookX: o.lookX ?? 0.2, lookY: o.lookY ?? 0, brow: o.brow || 0, soot, hairUp: o.hairUp, raccoon: o.raccoon, blink: o.blink, smokeWisps: o.smokeWisps, cheek: ex === 'chew' ? (o.k ?? undefined) : o.cheek });
    c.restore();
  }, o);
  const hp = (p) => { const r = rot2(mulv(p, HSF), tilt); return [x + r[0], y + r[1]]; };
  const fx = turn * 22;
  return { head: [x, y], eyes: hp([fx, -10]), mouth: hp([fx * 1.05, 80]), nose: hp([fx * 1.3 + 14, 30]), s: HSF };
}

// ================================================================== CAT (asleep on a stool)
function cat(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, wake = clamp(o.wake || 0), br = 1 + 0.035 * Math.sin(t * 2.1);
  const pal = o.col === 'grey' ? ['#b9b6c4', '#8d8a9c', '#5e5b6e', '#4a4758'] : ['#f6b96a', '#e0913e', '#b5651f', '#8a4a16'];
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(10,6,24,0.3)'; ell(ctx, 0, 0, 82, 9); ctx.fill();
  // body loaf
  ctx.save(); ctx.translate(-6, -30); ctx.scale(1, br);
  ell(ctx, 0, 0, 74, 34); outFill(ctx, rgr(ctx, -10, -24, 4, 0, 0, 80, [[0, pal[0]], [0.7, pal[1]], [1, pal[2]]]), 3);
  ctx.save(); ell(ctx, 0, 0, 74, 34); ctx.clip(); ctx.strokeStyle = rgba(pal[3], 0.55); ctx.lineWidth = 7;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 18 - 6, -36); ctx.quadraticCurveTo(i * 18 + 4, -16, i * 18 - 2, -2); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,240,220,0.5)'; ell(ctx, 10, 26, 60, 12); ctx.fill();
  ctx.restore(); ctx.restore();
  // tail wrapped around the front
  const tw = Math.sin(t * 1.3) * 6 * (0.4 + wake);
  ctx.beginPath(); ctx.moveTo(-74, -22); ctx.bezierCurveTo(-96, 4, -40, 6, 20, 2); ctx.quadraticCurveTo(44, 0, 50 + tw, -8);
  ctx.strokeStyle = OUT; ctx.lineWidth = 19; ctx.stroke(); ctx.strokeStyle = pal[1]; ctx.lineWidth = 14; ctx.stroke();
  ctx.strokeStyle = pal[3]; ctx.lineWidth = 14; ctx.setLineDash([6, 12]); ctx.stroke(); ctx.setLineDash([]);
  // head tucked at +x
  const hx0 = 52, hy0 = -26 + Math.sin(t * 2.1) * 1;
  for (const [ex0, rot] of [[-16, -0.35], [16, 0.25 + wake * 0.4 * Math.max(0, Math.sin(t * 8))]]) {
    ctx.save(); ctx.translate(hx0 + ex0, hy0 - 22); ctx.rotate(rot);
    ctx.beginPath(); ctx.moveTo(-12, 6); ctx.lineTo(0, -20); ctx.lineTo(12, 6); ctx.closePath(); outFill(ctx, pal[1], 2.6);
    ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(0, -12); ctx.lineTo(6, 3); ctx.closePath(); ctx.fillStyle = '#f2a2a0'; ctx.fill();
    ctx.restore();
  }
  ell(ctx, hx0, hy0, 30, 25); outFill(ctx, rgr(ctx, hx0 - 6, hy0 - 10, 2, hx0, hy0, 34, [[0, pal[0]], [1, pal[1]]]), 3);
  ctx.strokeStyle = rgba(pal[3], 0.6); ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(hx0 + i * 8, hy0 - 24); ctx.lineTo(hx0 + i * 7, hy0 - 14); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,240,225,0.8)'; ell(ctx, hx0 + 4, hy0 + 10, 14, 9); ctx.fill();
  // eyes
  ctx.strokeStyle = '#3a2014'; ctx.lineWidth = 3;
  for (const sx of [-1, 1]) {
    const ex0 = hx0 + sx * 12, ey0 = hy0 - 2;
    if (sx > 0 && wake > 0.3) { ell(ctx, ex0, ey0, 6, 4 * wake); ctx.fillStyle = '#d6e86a'; ctx.fill(); ctx.stroke(); ctx.fillStyle = '#111'; ell(ctx, ex0, ey0, 1.3, 3.2 * wake); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(ex0 - 6, ey0); ctx.quadraticCurveTo(ex0, ey0 + 4, ex0 + 6, ey0); ctx.stroke(); }
  }
  ctx.fillStyle = '#e07a80'; ctx.beginPath(); ctx.moveTo(hx0 + 1, hy0 + 6); ctx.lineTo(hx0 - 3, hy0 + 2); ctx.lineTo(hx0 + 5, hy0 + 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
  for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(hx0 + sx * 10, hy0 + 8 + i * 3); ctx.lineTo(hx0 + sx * 34, hy0 + 4 + i * 7); ctx.stroke(); }
  // paw
  ell(ctx, hx0 + 8, hy0 + 24, 13, 7); outFill(ctx, pal[0], 2.2);
  ctx.restore();
  const fl = o.flip ? -1 : 1;
  return { head: [x + hx0 * s * fl, y + hy0 * s], top: [x + 10 * s * fl, y - 70 * s] };
}

// ================================================================== ROOSTER silhouette
function rooster(ctx, x, y, s = 1, o = {}) {
  const cr = clamp(o.crow || 0), t = o.t || 0, fl = o.flip ? -1 : 1;
  const col = o.col || '#1a1434', rim = o.rimCol || 'rgba(255,190,140,0.9)';
  const neck = [20 + 14 * cr, -120 - 34 * cr], hd = [neck[0] + 16 + 10 * cr, neck[1] - 26 - 10 * cr], ha = -0.2 - 0.7 * cr;
  const shape = (c) => {
    c.beginPath();
    // body
    c.ellipse(-10, -78, 56, 40, -0.15, 0, TAU);
    // neck hackles
    c.moveTo(-14, -108); c.quadraticCurveTo(neck[0] - 30, neck[1] + 10, hd[0] - 10, hd[1] + 6); c.lineTo(hd[0] + 12, hd[1] + 12); c.quadraticCurveTo(neck[0] + 22, neck[1] + 40, 40, -84); c.closePath();
    c.moveTo(hd[0] + 15, hd[1]); c.arc(hd[0], hd[1], 15, 0, TAU);
    // tail sickles
    for (let i = 0; i < 5; i++) { const a = -2.0 - i * 0.18, r0 = 70 + i * 12; c.moveTo(-50, -86); c.quadraticCurveTo(-60 + Math.cos(a) * r0 * 0.6, -110 + Math.sin(a) * r0 * 0.9, -86 - i * 10 + Math.sin(t * 1.5 + i) * 2, -40 - i * 12); c.quadraticCurveTo(-72 + Math.cos(a) * r0 * 0.5, -100 + Math.sin(a) * r0 * 0.7, -44, -76); c.closePath(); }
    // legs + feet
    for (const lx of [-16, 8]) { c.rect(lx - 3, -42, 6, 40); c.moveTo(lx - 12, 0); c.lineTo(lx + 16, 0); c.lineTo(lx + 16, -4); c.lineTo(lx - 12, -4); c.closePath(); }
  };
  const head = (c) => {
    c.save(); c.translate(hd[0], hd[1]); c.rotate(ha);
    c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(-10 + i * 7, -10); c.arc(-8 + i * 7, -14 - (i === 1 || i === 2 ? 4 : 0), 6, 0, TAU); }
    c.moveTo(12, -4); c.lineTo(26, -2 - 6 * cr); c.lineTo(12, 0 - 2 * cr);
    c.moveTo(12, 3 + 2 * cr); c.lineTo(24, 5 + 9 * cr); c.lineTo(10, 7);
    c.moveTo(6, 10); c.ellipse(6, 16, 5, 8, 0, 0, TAU);
    c.restore();
  };
  ctx.save(); ctx.translate(x, y); ctx.scale(s * fl, s);
  ctx.save(); ctx.translate(2.5, -2.5); ctx.fillStyle = rim; shape(ctx); ctx.fill('nonzero'); head(ctx); ctx.fill(); ctx.restore();
  ctx.fillStyle = col; shape(ctx); ctx.fill('nonzero'); head(ctx); ctx.fill();
  ctx.restore();
  const bk = rot2([22, 2], ha);
  return { beak: [x + (hd[0] + bk[0]) * s * fl, y + (hd[1] + bk[1]) * s] };
}

module.exports = { coNam, coNamFace, tourist, touristFace, cat, rooster, quatNan, CT_CHARS: { HS, TS, CN, TR, lit } };
