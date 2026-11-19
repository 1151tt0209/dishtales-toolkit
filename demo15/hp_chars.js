// hp_chars.js - hủ tiếu character wrappers (Dì Bảy = coUt with a blue palette, tourist, crowd vendors).
// Every wrapper takes/returns LOCAL coordinates (the space of its x,y args). NP drawers return DEVICE; we convert.
// See the API header in hprops.js.
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const PEOPLE = require('./people');
const F = require('./hp_food');
const FX = require('./hp_fx');
const { TAU, clamp, lerp, ease, at, rng } = L;
const PI = Math.PI;
const { invApply } = F;

const DIBAY = { aoba: '#2f56b0', aobaD: '#1d3a80', khan: '#b3201c', khanW: '#141214' };
const BEAT = 60 / 96; // 0.625 s

// ------------------------------------------------------------------ helpers
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rot2 = (v, r) => { const c = Math.cos(r), n = Math.sin(r); return [c * v[0] - n * v[1], n * v[0] + c * v[1]]; };
const clampTo = (p, c, R) => { const d = dist(p, c); return d <= R ? p : [c[0] + (p[0] - c[0]) * R / d, c[1] + (p[1] - c[1]) * R / d]; };
// grip point on circle(M, Lh) that is r away from shoulder S (upper solution); fallback: towards S
function gripOn(M, Lh, S, r) {
  const d = dist(M, S) || 1e-6, ux = (S[0] - M[0]) / d, uy = (S[1] - M[1]) / d;
  const a = (Lh * Lh - r * r + d * d) / (2 * d), h2 = Lh * Lh - a * a;
  if (h2 < 0 || d > Lh + r || d < Math.abs(Lh - r)) return [M[0] + ux * Lh, M[1] + uy * Lh];
  const h = Math.sqrt(h2), px = M[0] + ux * a, py = M[1] + uy * a;
  const c1 = [px - uy * h, py + ux * h], c2 = [px + uy * h, py - ux * h];
  return c1[1] < c2[1] ? c1 : c2;
}
function devToLocal(B0, ret) {
  const out = {};
  const sc = Math.hypot(B0.a, B0.b) || 1;
  for (const k in ret) {
    const v = ret[k];
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number') out[k] = invApply(B0, v[0], v[1]);
    else if (v && typeof v === 'object' && 'x' in v && 's' in v) { const p = invApply(B0, v.x, v.y); out[k] = { x: p[0], y: p[1], s: v.s / sc }; }
    else out[k] = v;
  }
  out.device = ret;
  return out;
}

// ------------------------------------------------------------------ face overlays (face units: eyes y0 x±64, brows −58, mouth 140, head ±150)
const NEW_EXPR = {
  determined: (t) => ({ mouth: 'neutral', open: 0.75, brow: 0, glassesY: 0 }),
  slurp: (t) => ({ mouth: 'o', mOpen: 0.25, open: 0.35, brow: 0.4, blush: 0.6 }),
  noodleSlap: (t) => ({ mouth: 'o', mOpen: 0.55, open: 0.6, brow: 1.1, glassesY: 0 }),
  squint: (t) => ({ open: 0.12, mouth: 'grin', mOpen: 0.25, brow: 0.2, blush: 0.7 }),
};
function faceOverlay(ctx, expr, t) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (expr === 'determined') {
    for (const sx of [-1, 1]) { ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(sx * 118, -104); ctx.lineTo(sx * 26, -70); ctx.stroke(); }
    // glint across the glasses
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 9; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 64 - 30, 22); ctx.lineTo(sx * 64 + 6, -22); ctx.stroke(); }
    L.sparkle(ctx, 100, -20, 60, 0.9);
  } else if (expr === 'slurp') {
    ctx.fillStyle = '#c4544a'; NP.ell(ctx, 0, 140, 22, 18); ctx.fill(); ctx.fillStyle = '#5a1f1f'; NP.ell(ctx, 0, 141, 9, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(140,60,50,0.55)'; ctx.lineWidth = 7;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 70, 120, 32, sx > 0 ? PI * 0.55 : PI * 0.1, sx > 0 ? PI * 0.9 : PI * 0.45); ctx.stroke(); }
  } else if (expr === 'noodleSlap') {
    const r = rng(77);
    for (let i = 0; i < 7; i++) {
      const y0 = -60 + i * 14, ph = r() * TAU, dropL = 60 + r() * 120;
      ctx.beginPath();
      ctx.moveTo(-200, y0 - 40 + r() * 30);
      for (let u = 1; u <= 20; u++) { const xx = -200 + u * 20, yy = y0 + Math.sin(u * 0.7 + ph) * 10 + (xx > 120 ? (xx - 120) * 0.9 : 0); ctx.lineTo(xx, yy); }
      ctx.lineTo(210 + r() * 20, y0 + 120 + dropL + Math.sin(t * 6 + ph) * 8);
      ctx.strokeStyle = 'rgba(150,130,90,0.7)'; ctx.lineWidth = 15; ctx.stroke(); ctx.strokeStyle = '#fbf6e6'; ctx.lineWidth = 10; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
    }
    for (let i = 0; i < 5; i++) { const ph = (t * 1.5 + i * 0.21) % 1; ctx.fillStyle = `rgba(240,190,90,${0.9 * (1 - ph)})`; NP.ell(ctx, -110 + i * 55, 40 + ph * 160, 9, 12); ctx.fill(); }
  } else if (expr === 'squint') {
    ctx.strokeStyle = 'rgba(255,120,60,0.6)'; ctx.lineWidth = 6;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 60, -250); ctx.quadraticCurveTo(-50 + i * 60 + Math.sin(t * 8 + i) * 10, -290, -60 + i * 60, -330); ctx.stroke(); }
  }
}
function exprSplit(o) {
  if (o.expr && NEW_EXPR[o.expr]) return { base: NEW_EXPR[o.expr](o.t || 0), ov: o.expr };
  return null;
}

// =================================================================== DÌ BẢY (coUt, blue áo bà ba palette)
// coUt(ctx,x,y,s,o) - NP.coUt + palette DIBAY by default + hủ tiếu poses. All NP poses still work.
function coUt(ctx, x, y, s, o = {}) {
  const pose = o.pose || 'stand', fl = o.flip ? -1 : 1, U = NP.U_CO, t = o.t || 0, k = clamp(o.k ?? 0.5);
  const sx = s * fl * U, sy = s * U;
  const toB = (p) => [(p[0] - x) / sx, (p[1] - y) / sy];
  const toL = (p) => [x + p[0] * sx, y + p[1] * sy];
  const B0 = ctx.getTransform();
  const extra = {}, after = [];
  const o2 = Object.assign({}, o, { palette: o.palette || DIBAY });
  const sw = s * U; // body unit → local

  if (pose === 'basket') {
    const bs = o.basketS ?? 0.36, dip = clamp(o.dip ?? 0), shake = clamp(o.shake ?? 0), lift = clamp(o.lift ?? 0);
    o2.sit = o.sit ?? 1;
    o2.poseFn = (P) => {
      const pot = o.potAt ? toB(o.potAt) : [150, P.SY - 10];
      const bounce = -Math.abs(Math.sin(PI * t / BEAT)) * 16 * shake;
      const S = P.shR, Lh = Math.hypot(300, 88) * bs;
      let M = [pot[0] + (o.offX || 0) / sw * fl, pot[1] + lerp(-(112 * bs + 26), 4, dip) + bounce];
      let g = clampTo(gripOn(M, Lh, S, o.gripR ?? 88), S, 122);
      if (lift > 0) { // raise the hand above the shoulder; basket hangs forward/down from it, bottom just clear of the rim
        const eL = ease.inOut(lift), side = Math.sign(pot[0] - S[0]) || 1;
        const gL = [S[0] + 58 * side, S[1] - 96 + bounce * 0.5], th = 0.35;
        const ML = [gL[0] + Math.cos(th) * Lh * side, gL[1] + Math.sin(th) * Lh];
        g = [lerp(g[0], gL[0], eL), lerp(g[1], gL[1], eL)];
        const Mm = [lerp(M[0], ML[0], eL), lerp(M[1], ML[1], eL)], dv = Math.hypot(Mm[0] - g[0], Mm[1] - g[1]) || 1;
        M = [g[0] + (Mm[0] - g[0]) * Lh / dv, g[1] + (Mm[1] - g[1]) * Lh / dv];
      }
      const flip = g[0] < M[0], fx = flip ? -1 : 1;
      let rot = Math.atan2(g[1] - M[1], g[0] - M[0]) - Math.atan2(-88, 300 * fx);
      rot += (o.pourTilt || 0) * -fx;
      const O0 = rot2([0, -40 * bs], rot), O = [g[0] - rot2([300 * fx * bs, -128 * bs], rot)[0], g[1] - rot2([300 * fx * bs, -128 * bs], rot)[1]];
      void O0;
      const potB = o.pot ? { x: toB([o.pot.x, o.pot.y])[0], y: toB([o.pot.x, o.pot.y])[1], rx: o.pot.rx / sw, ry: o.pot.ry / sw } : null;
      let bret = null;
      return {
        hR: g, kR: 'grip', rR: Math.atan2(M[1] - g[1], M[0] - g[0]) + (flip ? 0 : 0), flipR: flip ? false : true,
        pre: () => {
          ctx.save();
          if (potB && dip > 0.02) { ctx.beginPath(); ctx.rect(potB.x - 4000, potB.y - 8000, 8000, 8000); ctx.ellipse(potB.x, potB.y, potB.rx, potB.ry, 0, 0, TAU); ctx.clip(); }
          bret = F.noodleBasket(ctx, O[0], O[1], bs, rot, { t, flip, fill: o.fill ?? 0.85, dip, shake, drip: o.drip ?? (lift > 0 ? lift : 0), seed: o.seed ?? 14 });
          ctx.restore();
          extra.basket = { mouth: toL(bret.mouth), bottom: toL(bret.bottom), grip: toL(bret.grip) };
        },
        expr: o.expr || (shake > 0.3 ? 'laugh' : 'smile'), look: [0.8, 0.6],
      };
    };
  } else if (pose === 'ladle') {
    const ls = o.ladleS ?? 0.3;
    o2.sit = o.sit ?? 1;
    o2.poseFn = (P) => {
      const pot = o.potAt ? toB(o.potAt) : [150, P.SY - 10], bowl = o.bowlAt ? toB(o.bowlAt) : [60, P.SY + 60];
      const kS = clamp(k / 0.3), kM = ease.inOut(clamp((k - 0.3) / 0.3)), kP = clamp((k - 0.6) / 0.4);
      const hover = [bowl[0] + 40 * Math.sign(pot[0] - bowl[0] || 1), bowl[1] - 70];
      const cupT = k < 0.3 ? [pot[0] + Math.sin(kS * PI) * 10, pot[1] + 8 - Math.sin(kS * PI) * 12] : [lerp(pot[0], hover[0], kM), lerp(pot[1] - 10, hover[1], kM) - Math.sin(kM * PI) * 30];
      const S = P.shR, fx = cupT[0] > S[0] ? -1 : 1, Lh = Math.hypot(250, 170) * ls;
      const g = clampTo(gripOn(cupT, Lh, S, o.gripR ?? 84), S, 122);
      let rot = Math.atan2(g[1] - cupT[1], g[0] - cupT[0]) - Math.atan2(-170, 250 * fx);
      const tilt = ease.out(clamp(kP / 0.4)) * (o.pourTilt ?? 1.1);
      rot += -fx * tilt;
      const v = rot2([250 * fx * ls, -170 * ls], rot), cup = [g[0] - v[0], g[1] - v[1]];
      const fill = k < 0.3 ? kS : 1 - clamp((kP - 0.15) / 0.85);
      return {
        hR: g, kR: 'grip', rR: Math.atan2(cup[1] - g[1], cup[0] - g[0]), flipR: fx > 0,
        pre: () => {
          const lr = F.ladle(ctx, cup[0], cup[1], ls, rot, { flip: fx < 0, fill });
          extra.ladle = { cup: toL(lr.cup), lip: toL(lr.lip), grip: toL(lr.grip) };
          extra.pourK = kP > 0.12 ? clamp((kP - 0.12) / 0.2) : 0;
          extra.pourTail = clamp((kP - 0.8) / 0.2);
          extra.bowlL = toL(bowl);
        },
        expr: o.expr || 'smile', look: [0.6, 0.7],
      };
    };
    after.push(() => {
      if (extra.pourK > 0 && extra.ladle) { const b = o.bowlAt || extra.bowlL; F.brothStream(ctx, extra.ladle.lip[0], extra.ladle.lip[1], b[0], b[1] - 4 * s, t, { w: (o.streamW ?? 9) * s, k: extra.pourK, tail: extra.pourTail, drops: 8, seed: 5 }); extra.pour = b; }
    });
  } else if (pose === 'slurp') {
    o2.sit = o.sit ?? 1;
    o2.poseFn = (P) => {
      const fy = -342 + P.B, bc = [4, fy + 96], cs = 0.26;
      const tips = [6, fy + 46], cr = 0.55, gR = [tips[0] + Math.cos(cr) * 300 * 0.62 * cs, tips[1] + Math.sin(cr) * 300 * 0.62 * cs];
      let br = null;
      return {
        hL: [bc[0] - 4, bc[1] + 26], kL: 'flat', rL: -0.25, flipL: false, hR: gR, kR: 'grip', rR: cr + PI,
        post: () => { br = F.huTieuBowl(ctx, bc[0], bc[1], 0.21, { view: '3q', layers: o.layers ?? 4, broth: o.broth ?? 0.8, t }); extra.bowl = { rim: toL(br.rim), center: toL(br.center) }; },
        front: () => {
          const surf = br ? br.center : bc;
          FX.noodleZip(ctx, surf[0], surf[1], tips[0], tips[1] - 4, (o.slurpK ?? (t * 1.6) % 1) * 0.85, { n: 4, w: 2.6, t, lines: false, drops: false, whip: 0.35, bend: 0.25 });
          F.chopsticks(ctx, tips[0], tips[1], cs, cr, { open: 0.15 });
          NP.cHand(ctx, gR[0], gR[1], 0.36, cr + PI, { kind: 'grip', skin: NP.SKIN_U, flip: false });
        },
        expr: o.expr || 'slurp', look: [0.1, 0.9], tilt: -0.05,
      };
    };
  } else if (pose === 'handBowl') {
    o2.sit = o.sit ?? 1;
    o2.poseFn = (P) => {
      const a = [60, P.SY + 84], bT = o.to ? toB(o.to) : [150, P.SY + 30], e = ease.inOut(k);
      let bc = [lerp(a[0], bT[0], e), lerp(a[1], bT[1], e)];
      bc = clampTo(bc, [P.shR[0] - 10, P.shR[1] + 10], 104);
      const bs = 0.24;
      return {
        hL: [bc[0] - 36, bc[1] + 12], hR: [bc[0] + 36, bc[1] + 12], kL: 'flat', kR: 'flat', rL: -0.5, rR: PI + 0.5, flipL: false, flipR: true,
        post: () => { const br = F.huTieuBowl(ctx, bc[0], bc[1], bs, { view: '3q', layers: o.layers ?? 7, broth: o.broth ?? 1, t, steam: o.steam ?? 0.6 }); extra.bowl = { rim: toL(br.rim), center: toL(br.center), top: toL(br.top) }; },
        expr: o.expr || 'smile', look: [0.7, 0.4],
      };
    };
  }
  const ret = NP.coUt(ctx, x, y, s, o2);
  for (const f of after) f();
  return Object.assign(devToLocal(B0, ret), extra);
}
function coUtFace(ctx, x, y, s, o = {}) { return NP.coUtFace(ctx, x, y, s, Object.assign({ palette: DIBAY }, o)); }

// =================================================================== TOURIST (blond backpacker)
function tourist(ctx, x, y, s, o = {}) {
  const pose = o.pose || 'sit', fl = o.flip ? -1 : 1, UT = NP.UT, t = o.t || 0, k = clamp(o.k ?? 0.5);
  const sx = s * fl * UT, sy = s * UT, sw = s * UT;
  const toB = (p) => [(p[0] - x) / sx, (p[1] - y) / sy];
  const toL = (p) => [x + p[0] * sx, y + p[1] * sy];
  const B0 = ctx.getTransform();
  const extra = {};
  const o2 = Object.assign({}, o);
  const es = exprSplit(o);
  let ovExpr = es ? es.ov : null;
  if (es) { delete o2.expr; o2.face = Object.assign({}, es.base, o.face || {}); }
  const poseExtra = (P) => ({});
  let pf = null;
  const faceAt = (P, fn) => { ctx.save(); ctx.translate(0, P.FY); ctx.scale(0.18, 0.18); fn(); ctx.restore(); };

  if (pose === 'sip') {
    pf = (P) => {
      const bc = [-14, P.SY + 78], ss = 0.36, mouth = [2, P.FY + 30];
      const e = ease.inOut(k), sb = [lerp(bc[0] + 10, mouth[0], e), lerp(bc[1] - 6, mouth[1], e)];
      const sr = lerp(0.6, 1.05, e), g = [sb[0] + rot2([100 * ss, -20 * ss], sr)[0], sb[1] + rot2([100 * ss, -20 * ss], sr)[1]];
      let br = null;
      const near = e > 0.75;
      return {
        hL: [bc[0] - 6, bc[1] + 30], kL: 'flat', rL: -0.3, flipL: false, hR: g, kR: 'pinch', rR: sr + PI,
        face: { mouth: near ? 'sip' : 'smile', lookY: near ? 0.2 : 0.8, lookX: 0, turn: 0.1 },
        mid: () => { br = F.huTieuBowl(ctx, bc[0], bc[1], 0.2, { view: '3q', layers: o.layers ?? 5, broth: o.broth ?? 0.85, t }); extra.bowl = { rim: toL(br.rim) }; },
        front: () => {
          F.spoon(ctx, sb[0], sb[1], ss, sr, { fill: 1 - clamp((e - 0.9) / 0.1) * 0.5 });
          NP.cHand(ctx, g[0], g[1], 0.4, sr + PI, { kind: 'pinch', skin: PEOPLE.SKIN, flip: true });
          // the raised pinky
          at(ctx, g[0], g[1], sr + PI, 0.4, 0.4, () => {
            ctx.lineCap = 'round'; ctx.strokeStyle = NP.OUT; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(-6, 26); ctx.quadraticCurveTo(-30, 56, -14, 82); ctx.stroke();
            ctx.strokeStyle = PEOPLE.SKIN[1]; ctx.lineWidth = 11; ctx.stroke();
          });
          if (o.pinkySpark !== false) L.sparkle(ctx, g[0] - 14, g[1] - 32, 18, 0.6 + 0.4 * Math.sin(t * 9));
        },
      };
    };
  } else if (pose === 'bowl') {
    pf = (P) => {
      const raise = ease.inOut(clamp(o.raise ?? 0)), bc = [lerp(0, 96, raise), lerp(P.SY + 74, P.SY - 84, raise)];
      return {
        hL: [bc[0] - 40, bc[1] + 14], hR: [bc[0] + 40, bc[1] + 14], kL: 'flat', kR: 'flat', rL: raise > 0.5 ? -PI / 2 - 0.4 : -0.5, rR: raise > 0.5 ? -PI / 2 + 0.4 : PI + 0.5, flipL: false, flipR: true,
        face: raise > 0.5 ? { mouth: 'grin', mOpen: 0.7, happyClosed: 1, open: 0 } : {},
        mid: () => { const br = F.huTieuBowl(ctx, bc[0], bc[1], 0.24, { view: '3q', layers: o.layers ?? 7, broth: o.broth ?? 1, t, steam: o.steam ?? 0 }); extra.bowl = { rim: toL(br.rim), center: toL(br.center) }; },
      };
    };
  } else if (pose === 'slurp') {
    if (!ovExpr) { ovExpr = 'slurp'; o2.face = Object.assign({}, NEW_EXPR.slurp(t), { glassesY: 0 }, o.face || {}); }
    const slOv = ovExpr;
    pf = (P) => {
      const bc = [0, P.FY + 84], bowlRot = -0.15 - k * 0.35, mouth = [0, P.FY + 26];
      let br = null;
      return {
        hL: [bc[0] - 42, bc[1] + 10], hR: [bc[0] + 42, bc[1] + 16], kL: 'flat', kR: 'flat', rL: -0.6, rR: PI + 0.4, flipL: false, flipR: true, lateHands: true,
        tilt: -0.04,
        front: () => {
          faceAt(P, () => faceOverlay(ctx, slOv, t));
          br = F.huTieuBowl(ctx, bc[0], bc[1], 0.24, { view: '3q', rot: bowlRot, layers: o.layers ?? 5, broth: o.broth ?? (1 - k), t });
          extra.bowl = { rim: toL(br.rim), center: toL(br.center) };
          if ((o.noodles ?? 1) > 0) FX.noodleZip(ctx, br.center[0], br.center[1], mouth[0], mouth[1], o.zipK ?? ((t * 1.3) % 1) * 0.9, { n: 5, w: 3.4, t, whip: 0.6, bend: 0.1, lines: o.lines ?? true });
        },
      };
    };
    ovExpr = null; // overlay drawn inside front (before the bowl)
  } else if (pose === 'sign') {
    pf = (P) => {
      const g = [84, P.SY + 30], sr = o.signRot ?? 0.32, ss = o.signS ?? 0.6;
      return {
        hR: g, kR: 'grip', rR: -PI / 2 + sr, flipR: false, lateHands: true,
        hL: o.wave ? [-110, P.SY - 60 + Math.sin(t * 9) * 8] : undefined, kL: o.wave ? 'wave' : undefined, rL: o.wave ? -PI / 2 - 0.3 + Math.sin(t * 9) * 0.25 : undefined,
        face: { mouth: 'grin', mOpen: 0.5, turn: 0.15, lookX: 0.3 },
        front: () => {
          ctx.save(); ctx.setTransform(B0);
          const r = FX.selfieSign(ctx, toL(g)[0], toL(g)[1], sw * ss, sr * fl, { t, len: o.len ?? 270, vi: o.vi, en: o.en });
          ctx.restore();
          extra.sign = r;
        },
      };
    };
  } else if (pose === 'fanHat') {
    if (!ovExpr && !o.expr) { ovExpr = 'squint'; o2.face = Object.assign({}, NEW_EXPR.squint(t), o.face || {}); }
    pf = (P) => {
      const swing = Math.sin(t * TAU * (o.fanHz ?? 2.4)), g = [88 + swing * 10, P.FY + 70], hs = o.hatS ?? 0.15;
      return {
        hR: g, kR: 'grip', rR: -PI / 2 - 0.2 + swing * 0.3, flipR: false, lateHands: true,
        front: () => {
          at(ctx, g[0], g[1], -PI / 2 + 0.25 + swing * 0.45, hs, hs, () => { ctx.translate(400, 168); NP.nonLa(ctx, 'back', {}); NP.nonLa(ctx, 'front', {}); });
          // air whoosh lines toward the face
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * Math.abs(swing)})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(g[0] - 40, P.FY + 10 + i * 14, 34 + i * 6, PI * 0.8, PI * 1.15); ctx.stroke(); }
        },
      };
    };
  }
  const userFn = o.poseFn;
  o2.poseFn = (P) => {
    const r = Object.assign({}, pf ? pf(P) : {}, userFn ? userFn(P) || {} : {});
    for (const kk of Object.keys(r)) if (r[kk] === undefined) delete r[kk];
    const fr = r.front;
    const sweat = clamp(o.sweat || 0);
    if (ovExpr || sweat > 0) r.front = () => {
      if (ovExpr) faceAt(P, () => faceOverlay(ctx, ovExpr, t));
      if (sweat > 0) FX.sweatDrops(ctx, 0, P.FY, 30, t, sweat);
      if (fr) fr();
    };
    if (r.face) { r.face = Object.assign({}, r.face, o2.face || {}); }
    return r;
  };
  if (o2.face && pf) { /* explicit face opts already merge after pfX.face inside NP */ }
  const ret = NP.tourist(ctx, x, y, s, o2);
  return Object.assign(devToLocal(B0, ret), extra);
}
function touristFace(ctx, x, y, s, o = {}) {
  const es = exprSplit(o);
  if (!es) { const fo = Object.assign({}, o); const sw = clamp(o.sweat || 0); const r = NP.touristFace(ctx, x, y, s, fo); if (sw > 0) FX.sweatDrops(ctx, x, y, 165 * s, o.t || 0, sw); return r; }
  const fo = Object.assign({}, o, es.base, o.face || {}); delete fo.expr; delete fo.face;
  const r = NP.touristFace(ctx, x, y, s, Object.assign({ expr: 'neutral' }, fo));
  at(ctx, x, y, o.tilt || 0, s, s, () => faceOverlay(ctx, es.ov, o.t || 0));
  if (o.sweat) FX.sweatDrops(ctx, x, y, 165 * s, o.t || 0, o.sweat);
  return r;
}

// =================================================================== crowd vendors that can hold / slurp a bowl
const VENDOR_SHIRTS = ['#c9786c', '#4a7ab0', '#e0b04a', '#7a9a5a', '#b04a6a', '#e8e0d0', '#5a5a8a'];
function vendorH(ctx, x, y, s = 1, o = {}) {
  const COL = NP.COL;
  const r = rng((o.seed || 0) * 13 + 5), t = o.t || 0;
  const shirt = VENDOR_SHIRTS[Math.floor(r() * VENDOR_SHIRTS.length)], hat = r() < 0.7 ? 'nonla' : r() < 0.5 ? 'bucket' : null;
  const sk = r() < 0.5 ? COL.skinB : COL.skin, man = r() < 0.4, sit = o.sit ?? r() < 0.35;
  const ph = r() * 6, turn = (r() - 0.5) * 0.6, sl = clamp(o.slurp || 0), item = o.item;
  at(ctx, x, y, 0, s * (o.flip ? -1 : 1), s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const by = Math.sin(t * 2 + ph) * 1.5 + (sit ? 90 : 0) - sl * 3;
    const hipY = -150 + by, SY = -238 + by, HY = -278 + by;
    const pants = man ? '#3a3a42' : '#1c1a1f';
    if (sit) { for (const sx of [-1, 1]) { NP.capFS(ctx, sx * 14, hipY, sx * 36, hipY - 24, 28, 24, pants, 1.6); NP.capFS(ctx, sx * 36, hipY - 24, sx * 38, -8, 22, 18, pants, 1.6); } }
    else for (const sx of [-1, 1]) NP.capFS(ctx, sx * 16, hipY, sx * 20, -8, 30, 24, pants, 1.6);
    ctx.beginPath(); ctx.moveTo(-34, SY); ctx.quadraticCurveTo(-42, SY + 40, -36, hipY + 8); ctx.lineTo(36, hipY + 8); ctx.quadraticCurveTo(42, SY + 40, 34, SY); ctx.closePath();
    NP.outFill(ctx, NP.lgr(ctx, -40, 0, 40, 0, [[0, NP.shadeC(shirt, 0.25)], [0.5, shirt], [1, NP.shadeC(shirt, -0.4)]]), 1.8);
    NP.rimLine(ctx, () => { ctx.moveTo(-34, SY); ctx.quadraticCurveTo(-42, SY + 40, -36, hipY + 8); }, 'rgba(255,200,140,0.8)', 2.4);
    const aL = [-34, SY + 6], aR = [34, SY + 6];
    let hL = [-30, SY + 70], hR = [30, SY + 70], bc = null;
    if (item === 'bowl') { bc = [lerp(0, 4, sl), lerp(SY + 58, HY + 22, ease.inOut(sl))]; hL = [bc[0] - 20, bc[1] + 6]; hR = [bc[0] + 20, bc[1] + 6]; }
    const head = () => NP.miniHead(ctx, 0, HY, 30, { skin: sk, hat, expr: sl > 0.5 ? 'calm' : 'smile', hatCol: COL.hatOlive, turn: sl > 0.5 ? 0 : turn });
    if (item === 'bowl' && sl > 0.5) head();
    NP.capFS(ctx, aL[0], aL[1], hL[0], hL[1], 18, 14, shirt, 1.6);
    NP.capFS(ctx, aR[0], aR[1], hR[0], hR[1], 18, 14, shirt, 1.6);
    if (bc) F.huTieuBowl(ctx, bc[0], bc[1], 0.15, { view: '3q', rot: -sl * 0.5, layers: 5, broth: 1 - sl * 0.7, t, shadow: false });
    ctx.fillStyle = sk[1]; for (const h of [hL, hR]) { NP.ell(ctx, h[0], h[1] + 4, 8, 8); ctx.fill(); }
    if (!(item === 'bowl' && sl > 0.5)) head();
    if (bc && sl > 0.5) { // slurp streaks
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const a = -PI / 2 + (i - 1) * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 44, HY - 4 + Math.sin(a) * 44); ctx.lineTo(Math.cos(a) * 62, HY - 4 + Math.sin(a) * 62); ctx.stroke(); }
    }
  });
}
// crowdBoats with day-ready vendors. Same placement as NP.crowdBoats. o: n, seed, x0, x1, flipAlt, pole, raise, item ('bowl'), slurp (0..1 or fn(i)→0..1), hull, paint
function crowdBoats(ctx, t, y, s = 1, o = {}) {
  const n = o.n ?? 4, x0 = o.x0 ?? -100, x1 = o.x1 ?? L.W + 100, seed = o.seed ?? 11, out = [];
  for (let i = 0; i < n; i++) {
    const r = rng(seed + i * 7);
    const x = lerp(x0, x1, (i + 0.5) / n) + (r() - 0.5) * 60 * s, sd = seed + i;
    const sl = typeof o.slurp === 'function' ? o.slurp(i) : (o.slurp || 0);
    const go = Object.assign({ seed: sd, t, flip: (o.flipAlt ?? true) && i % 2 === 1, people: true, raise: o.raise || 0, pole: o.pole ?? true, cargo: true,
      vendorFn: (c, vx, vy, vs) => vendorH(c, vx, vy, vs, { seed: sd, t, item: o.item, slurp: sl }) }, o.hull ? { hull: o.hull } : {}, o.paint ? { paint: o.paint } : {});
    out.push(NP.ghe(ctx, x, y + (i % 2) * 14 * s, s, go));
  }
  return out;
}

module.exports = { DIBAY, BEAT, coUt, diBay: coUt, coUtFace, diBayFace: coUtFace, tourist, touristFace, vendorH, crowdBoatsH: crowdBoats, faceOverlay, NEW_EXPR, gripOn };
