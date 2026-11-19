// bx_chars.js - BÁNH XÈO characters (Má Tư, the blond tourist, boatman, ducks).
// Node + @napi-rs/canvas, 1080x1920. Flat cartoon + warm rim light. Every drawer save()/restore()s, deterministic in (t, opts).
// All drawers take LOCAL coords (= the ctx transform at call time) and return LOCAL anchors (+ ret.device = raw NP result).
//
// ---------------------------------------------------------------- API
// MATU                                   palette {aoba maroon, aobaD, khan black/white check, khanW, hair grey, hairD}
// maTu(ctx,x,y,s,o)                      Má Tư: NP.coUt + maroon áo bà ba, khăn rằn, GREY hair + top bun, smile lines, NO nón lá (o.hat:true adds it).
//   origin = between the feet (floor). s=1: standing ≈ 470 px tall (eyes y≈-431), seated on her own stool ≈ 310 px (eyes y≈-270),
//   shoulders ±55 px. o.sit (default by pose), o.stool:false (sit on your own stool/step: hips at y≈-78*s), o.flip, o.t, o.k 0..1,
//   o.expr (smile|talk|laugh|wink|calm|slurp), o.turn, o.tilt, o.look[x,y]. All NP.coUt poses work too (stand, wave, thumbs, fan…).
//   poses:
//    'pour'    (sit) ladle over o.panAt [x,y] (pan centre, LOCAL); k 0 tip starts → 1 emptied. ret.ladle{cup,lip}, ret.stream{from,to,k}
//    'swirl'   (sit) both hands on the pan ears, circular swirl (t). o.panAt, o.panRx (LOCAL px, default 130*s).
//              o.hold(ctx,{x,y,rot}) draws the pan in LOCAL coords between arms and hands. ret.pan{x,y,rot}
//    'spatula' (sit) right hand spatula under the crêpe edge; k 0 flat → 1 lifted/folded. Left hand on the pan handle. ret.spatula{tip,grip}
//    'pick'    (stand) woven basket on left forearm, right hand pinches at o.pickAt [x,y] LOCAL. ret.basket{x,y}, ret.pick
//    'offer'   (stand) spatula raised in R hand, tiny apron held out to her left (screen-left unless flipped). ret.apron{x,y} (apron centre)
//    'plate'   (stand) both hands at o.plateAt [x,y] LOCAL (plate centre). o.hold(ctx,{x,y}) draws the plate between arms and hands.
//    'laugh'   hand on belly, head tossed back · 'wink' thumbs-up + wink · 'eyebrow' calm face, one arched raised brow, hand on hip
// maTuFace(ctx,x,y,s,o)                  close-up head (origin = eyes centre, head ±150*s wide, -215..196*s tall, body to +600*s).
//                                        o.expr as above + 'eyebrow'; o.t, o.turn, o.tilt, o.look, o.hat
//
// tourist(ctx,x,y,s,o)  (= touristBX)    the series' blond backpacker (NP.tourist). origin feet; s=1 standing ≈ 560 px (eyes y≈-462),
//   seated ≈ 380 px (eyes y≈-270, hips y≈-48). o.stand, o.flip, o.t, o.k, SERIES LOOK by default: plain turquoise tee, shades on head, khaki shorts, NO vest, NO backpack.
//   o.vest:true (orange life vest), o.pack:true (backpack), o.apron:true (small apron over the tee), o.stool:true (red plastic stool under a seated pose; stoolV),
//   o.expr: NP TFACE (neutral smile sniff wow panic chew bliss yawn) + 'foggy' (glasses down, fogged white) + 'blownHair' + 'crunch'.
//   o.hairBlown 0..1 (wind on the hair from the stove/fan). o.poseFn merges on top like hp_chars.
//   poses: 'knifeFork' (k: saw stroke, pinky up) · 'pointTry' (o.pointAt LOCAL) · 'dumpBowl' (k 0 hold → 1 tipped; ret.bowl{lip})
//          'flip' (pan, k 0 wind-up → 1 follow-through; ret.pan{x,y,rot}, ret.crepe{x,y} mid-air arc; o.noPan to draw your own)
//          'gape' · 'applaud' · 'bow' (prayer hands + polite nod; standing leans 0..0.14 with k) · 'wrapBite' (k 0 chest → 1 bite; crunch)
//          'thumbs' (both thumbs) · all NP.tourist poses (sit, yawn, photo, point, sniff, bite, hug, cheer…)
//
// boatmanRow(ctx,x,y,s,{t,phase,duck 0..1,flip,oarLen,boat})   NP.boatman rowing; duck crouches him (low branch gag). origin feet. s=1 ≈ 470 px.
//                                        o.boat:true → draws his own xuồng ba lá (origin = waterline, s = boat scale like touristInXuong); ret.boat
// stoolV(ctx,x,y,s,col)                  red plastic street stool, origin floor, seat top y-34*s.
// duck(ctx,x,y,s,{t,pose:'swim'|'quack'|'lookUp'|'flapRun',flip,ph})  flat cartoon duck. 'swim' origin = waterline (body half under),
//                                        others origin = feet. s=1 ≈ 120 px long. ret {head, beak, body}
// duckLine(ctx,t,x,y,s,n,{spacing=110*s,pose,follow 0..1,flip})  n ducks following a leader (ducks waddle/bob out of phase). ret [duck rets]
// touristInXuong(ctx,x,y,s,{t,sniff,perk,flip,phase,expr,bob,pack=true,vest=false})   xuồng ba lá (origin = waterline, len 1100*s) with the boatman rowing at the
//                                        stern and the tourist SEATED on the plank (hull front covers her legs, correct waterline).
//                                        sniff 0..1 = nose up sniffing; perk 0..1 = sits up, wow; o.sink (90) px*s below the seat anchor. ret {boat:{deck,seat,bow,stern}, tourist, boatman}
//
// Anchors are LOCAL px. Never depends on bx_food/bx_fx (self-drawn ladle, spatula, basket, apron, bowl, wrap, mini pan).
const L = require('./lib');
const NP = require('./nprops');
const PEOPLE = require('./people');
const { Path2D } = require('@napi-rs/canvas');
const { TAU, clamp, lerp, ease, at, rng } = L;
const PI = Math.PI;

const MATU = { aoba: '#7a2430', aobaD: '#4e1420', khan: '#1a1616', khanW: '#f0ece0', hair: '#bdb8b2', hairD: '#8a8580' };
const BX_BEAT = 0.48;

// ------------------------------------------------------------------ helpers
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clampTo = (p, c, R) => { const d = dist(p, c); return d <= R ? p : [c[0] + (p[0] - c[0]) * R / d, c[1] + (p[1] - c[1]) * R / d]; };
function invApply(m, X, Y) { // DOMMatrix-like {a,b,c,d,e,f}
  const det = m.a * m.d - m.b * m.c || 1e-9, x = X - m.e, y = Y - m.f;
  return [(m.d * x - m.c * y) / det, (-m.b * x + m.a * y) / det];
}
function devToLocal(B0, ret) {
  const out = {}, sc = Math.hypot(B0.a, B0.b) || 1;
  for (const k in ret) {
    const v = ret[k];
    if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number') out[k] = invApply(B0, v[0], v[1]);
    else if (v && typeof v === 'object' && 'x' in v && 's' in v) { const p = invApply(B0, v.x, v.y); out[k] = { x: p[0], y: p[1], s: v.s / sc }; }
    else out[k] = v;
  }
  out.device = ret;
  return out;
}
const inLocal = (ctx, B0, fn) => { ctx.save(); ctx.setTransform(B0); fn(); ctx.restore(); };
function stroke2(ctx, w, dark, light, path) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; path(); ctx.strokeStyle = dark; ctx.lineWidth = w; ctx.stroke(); ctx.strokeStyle = light; ctx.lineWidth = w * 0.62; ctx.stroke(); }

// ---- self-drawn props (body units of whoever holds them)
function ladleV(ctx, g, cup, tilt, fill) { // long bamboo handle g→cup, small steel cup
  stroke2(ctx, 7, '#3a2414', '#a7794a', () => { ctx.beginPath(); ctx.moveTo(g[0] + (g[0] - cup[0]) * 0.18, g[1] + (g[1] - cup[1]) * 0.18); ctx.lineTo(cup[0], cup[1]); });
  at(ctx, cup[0], cup[1], tilt, 1, 1, () => {
    ctx.beginPath(); ctx.moveTo(-17, -4); ctx.quadraticCurveTo(-16, 16, 0, 17); ctx.quadraticCurveTo(16, 16, 17, -4); ctx.closePath();
    NP.outFill(ctx, NP.lgr(ctx, -17, 0, 17, 0, [[0, '#e8e4dc'], [0.5, '#a9a6a0'], [1, '#5d5b58']]), 2);
    NP.ell(ctx, 0, -4, 17, 5); ctx.fillStyle = fill > 0.05 ? '#f0c040' : '#3c3a38'; ctx.fill(); ctx.strokeStyle = NP.OUT; ctx.lineWidth = 1.6; ctx.stroke();
    if (fill > 0.05) { ctx.fillStyle = 'rgba(255,250,200,0.7)'; NP.ell(ctx, -5, -6, 6, 1.8); ctx.fill(); }
  });
}
function spatulaV(ctx, g, tip, w = 1) { // steel turner with wooden handle
  const a = Math.atan2(tip[1] - g[1], tip[0] - g[0]), Lh = dist(g, tip);
  at(ctx, g[0], g[1], a, w, w, () => {
    ctx.lineCap = 'round';
    ctx.beginPath(); NP.rrect(ctx, -22, -5, 56, 10, 5); NP.outFill(ctx, '#7a4a26', 1.8);
    ctx.strokeStyle = '#7d7a76'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(Lh / w - 34, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Lh / w - 36, -14); ctx.lineTo(Lh / w + 4, -18); ctx.lineTo(Lh / w + 6, 18); ctx.lineTo(Lh / w - 36, 14); ctx.closePath();
    NP.outFill(ctx, NP.lgr(ctx, 0, -18, 0, 18, [[0, '#f2efe8'], [1, '#8c8984']]), 1.8);
    ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.lineWidth = 2; for (const yy of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(Lh / w - 28, yy); ctx.lineTo(Lh / w - 4, yy); ctx.stroke(); }
  });
}
function basketV(ctx, x, y, r, t) { // round woven rổ with greens poking out
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, -r * 0.2, r * 0.75, r * 1.05, 0, PI * 1.05, PI * 1.95); ctx.stroke(); // handle
  const g = ['#3f8a2a', '#5aa83a', '#7cc04a', '#2f6e22'];
  for (let i = 0; i < 9; i++) { const a = -PI * 0.85 + i * 0.21, l = r * (0.55 + (i % 3) * 0.12); ctx.fillStyle = g[i % 4]; NP.ell(ctx, Math.cos(a) * r * 0.6, -r * 0.18 + Math.sin(a) * l * 0.55, r * 0.26, r * 0.15); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(-r, -r * 0.2); ctx.quadraticCurveTo(-r * 0.92, r * 0.62, 0, r * 0.66); ctx.quadraticCurveTo(r * 0.92, r * 0.62, r, -r * 0.2); ctx.closePath();
  NP.outFill(ctx, NP.weave(ctx, r * 0.42, '#c49a52'), 2);
  ctx.strokeStyle = 'rgba(90,60,20,0.55)'; ctx.lineWidth = 2; for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.97, -r * 0.2 + i * r * 0.26); ctx.quadraticCurveTo(0, r * 0.05 + i * r * 0.3, r * 0.97, -r * 0.2 + i * r * 0.26); ctx.stroke(); }
  NP.ell(ctx, 0, -r * 0.2, r, r * 0.22); ctx.strokeStyle = '#7a5428'; ctx.lineWidth = 4; ctx.stroke();
  NP.rimLine(ctx, () => { ctx.moveTo(-r, -r * 0.15); ctx.quadraticCurveTo(-r * 0.92, r * 0.6, -r * 0.2, r * 0.66); }, 'rgba(255,200,130,0.7)', 3);
  ctx.restore();
}
function apronV(ctx, x, y, w, t, col = '#3a6ea8') { // tiny cloth apron hanging from (x,y) = top edge centre
  ctx.save(); ctx.translate(x, y);
  const sw = Math.sin(t * 3) * w * 0.04, h = w * 1.25;
  ctx.beginPath(); ctx.moveTo(-w * 0.3, 0); ctx.lineTo(w * 0.3, 0); ctx.lineTo(w * 0.34, h * 0.32); ctx.lineTo(w * 0.5 + sw, h * 0.36); ctx.quadraticCurveTo(w * 0.52 + sw, h * 0.8, w * 0.4 + sw, h); ctx.quadraticCurveTo(sw, h * 1.06, -w * 0.4 + sw, h); ctx.quadraticCurveTo(-w * 0.52 + sw, h * 0.8, -w * 0.5 + sw, h * 0.36); ctx.lineTo(-w * 0.34, h * 0.32); ctx.closePath();
  NP.outFill(ctx, col, 1.8);
  ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 6; i++) ctx.fillRect(-w * 0.6 + i * w * 0.24, 0, w * 0.06, h * 1.1); ctx.restore(); // white stripes
  ctx.beginPath(); NP.rrect(ctx, -w * 0.2 + sw, h * 0.55, w * 0.4, h * 0.22, 3); NP.outFill(ctx, '#f3eadb', 1.4); // pocket
  ctx.strokeStyle = '#f3eadb'; ctx.lineWidth = Math.max(1.5, w * 0.05); ctx.beginPath(); ctx.moveTo(-w * 0.34, h * 0.33); ctx.quadraticCurveTo(-w * 0.75, h * 0.45 + sw, -w * 0.72, h * 0.75); ctx.moveTo(w * 0.34, h * 0.33); ctx.quadraticCurveTo(w * 0.78, h * 0.4, w * 0.8 + sw, h * 0.7); ctx.stroke();
  ctx.restore();
}
function miniPan(ctx, c, rot, rx, crepe = true) { // small cast pan, handle towards -x of rot frame
  at(ctx, c[0], c[1], rot, 1, 1, () => {
    stroke2(ctx, rx * 0.2, '#141210', '#3a3330', () => { ctx.beginPath(); ctx.moveTo(-rx * 0.9, 0); ctx.lineTo(-rx * 2.0, -rx * 0.05); });
    NP.ell(ctx, 0, rx * 0.08, rx, rx * 0.36); ctx.fillStyle = '#121010'; ctx.fill();
    NP.ell(ctx, 0, 0, rx, rx * 0.32); NP.outFill(ctx, '#2a2624', 2);
    NP.ell(ctx, 0, 0, rx * 0.86, rx * 0.25); ctx.fillStyle = '#1a1716'; ctx.fill();
    if (crepe) { NP.ell(ctx, 0, -1, rx * 0.74, rx * 0.2); ctx.fillStyle = '#f2c040'; ctx.fill(); ctx.strokeStyle = '#b8761e'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = 'rgba(160,90,20,0.6)'; for (let i = 0; i < 5; i++) { NP.ell(ctx, -rx * 0.5 + i * rx * 0.25, -2 + (i % 2) * 4, rx * 0.06, rx * 0.025); ctx.fill(); } }
    NP.rimLine(ctx, () => ctx.ellipse(0, 0, rx, rx * 0.32, 0, PI * 1.05, PI * 1.6), 'rgba(255,190,120,0.75)', 2.5);
  });
}
function crepeFly(ctx, c, rot, rx) { // half-moon bánh xèo in the air (seen from below-ish)
  at(ctx, c[0], c[1], rot, 1, 1, () => {
    ctx.beginPath(); ctx.ellipse(0, 0, rx, rx * 0.34, 0, 0, TAU); NP.outFill(ctx, NP.lgr(ctx, 0, -rx * 0.3, 0, rx * 0.3, [[0, '#f8d45a'], [1, '#d08a1c']]), 2);
    ctx.fillStyle = 'rgba(150,80,20,0.55)'; for (let i = 0; i < 7; i++) { NP.ell(ctx, -rx * 0.6 + i * rx * 0.2, Math.sin(i * 2.1) * rx * 0.12, rx * 0.07, rx * 0.03); ctx.fill(); }
    ctx.fillStyle = '#f6efd8'; NP.ell(ctx, rx * 0.2, -rx * 0.05, rx * 0.12, rx * 0.06); ctx.fill(); // bean sprout peeking
  });
}
function bowlV(ctx, c, rot, r, fillCol = '#f0c848', fill = 1) { // mixing bowl, rim ellipse at c
  at(ctx, c[0], c[1], rot, 1, 1, () => {
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r * 0.95, r * 0.8, 0, r * 0.82); ctx.quadraticCurveTo(r * 0.95, r * 0.8, r, 0); ctx.closePath();
    NP.outFill(ctx, NP.lgr(ctx, -r, 0, r, 0, [[0, '#f6f2ea'], [0.5, '#d8d0c2'], [1, '#8f877c']]), 2);
    ctx.strokeStyle = '#3b6fb0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.95, r * 0.25); ctx.quadraticCurveTo(0, r * 0.45, r * 0.95, r * 0.25); ctx.stroke();
    NP.ell(ctx, 0, 0, r, r * 0.3); NP.outFill(ctx, '#ece6da', 2);
    if (fill > 0.02) { NP.ell(ctx, 0, r * 0.03, r * 0.86 * Math.sqrt(fill), r * 0.24 * Math.sqrt(fill)); ctx.fillStyle = fillCol; ctx.fill(); ctx.fillStyle = 'rgba(255,255,220,0.6)'; NP.ell(ctx, -r * 0.3, 0, r * 0.2, r * 0.04); ctx.fill(); }
  });
}
function wrapV(ctx, c, rot, w, bite) { // lettuce-wrapped bánh xèo piece (cuốn rau)
  at(ctx, c[0], c[1], rot, 1, 1, () => {
    ctx.beginPath(); ctx.moveTo(-w, -w * 0.3); ctx.quadraticCurveTo(-w * 0.2, -w * 0.62, w * 0.9, -w * 0.4); ctx.quadraticCurveTo(w * 1.1, 0, w * 0.9, w * 0.38); ctx.quadraticCurveTo(-w * 0.2, w * 0.6, -w, w * 0.3); ctx.closePath();
    NP.outFill(ctx, NP.lgr(ctx, 0, -w * 0.6, 0, w * 0.6, [[0, '#9ad860'], [0.5, '#5ea83a'], [1, '#3a7a26']]), 2);
    ctx.strokeStyle = 'rgba(230,255,200,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.9, 0); ctx.quadraticCurveTo(0, -w * 0.05, w * 0.95, 0); ctx.stroke();
    // yellow crêpe + herbs at the bite end (+x)
    const bx = w * 0.85 - bite * w * 0.35;
    ctx.fillStyle = '#f2c040'; NP.ell(ctx, bx, 0, w * 0.2, w * 0.34); ctx.fill(); ctx.strokeStyle = '#b06a18'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e86a4a'; NP.ell(ctx, bx + w * 0.04, -w * 0.08, w * 0.07, w * 0.05); ctx.fill(); // shrimp
    ctx.fillStyle = '#2f7a2a'; NP.ell(ctx, bx + w * 0.1, w * 0.14, w * 0.08, w * 0.04); ctx.fill();
    if (bite > 0.1) { ctx.fillStyle = '#f6e9c8'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(bx + w * 0.16, -w * 0.2 + i * w * 0.2, w * 0.09, 0, TAU); ctx.fill(); } }
  });
}
function crumbs(ctx, x, y, r, t, n = 8, seed = 3) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const ph = (t * 1.8 + R()) % 1, a = -PI * 0.1 + R() * PI * 1.2, v = r * (0.6 + R());
    const px = x + Math.cos(a) * v * ph * 1.4, py = y + Math.sin(a) * v * ph * 0.6 + ph * ph * r * 1.2;
    ctx.fillStyle = `rgba(${R() > 0.5 ? '240,190,70' : '120,170,70'},${0.95 * (1 - ph)})`;
    ctx.save(); ctx.translate(px, py); ctx.rotate(R() * 6); ctx.fillRect(-r * 0.07, -r * 0.05, r * 0.14, r * 0.1); ctx.restore();
  }
}
function crunchLines(ctx, x, y, r, t) {
  ctx.strokeStyle = 'rgba(255,240,200,0.95)'; ctx.lineWidth = Math.max(2, r * 0.05); ctx.lineCap = 'round';
  const pop = 0.7 + 0.3 * Math.abs(Math.sin(t * 14));
  for (let i = 0; i < 5; i++) { const a = -PI * 0.15 - i * 0.32; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); ctx.lineTo(x + Math.cos(a) * r * (1.25 * pop + 0.2), y + Math.sin(a) * r * (1.25 * pop + 0.2)); ctx.stroke(); }
}

// ------------------------------------------------------------------ MÁ TƯ overlay (face units, origin eyes)
function maTuOverlay(ctx, turn, ex, t) {
  const tx = clamp(turn, -1, 1) * 60;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // top bun (búi tóc), slightly back
  const bx = -30 + tx * 0.25;
  NP.ell(ctx, bx, -222, 66, 50); ctx.fillStyle = NP.lgr(ctx, 0, -270, 0, -175, [[0, '#d6d2cc'], [1, MATU.hairD]]); ctx.fill(); ctx.strokeStyle = 'rgba(70,60,55,0.6)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = 'rgba(110,100,95,0.6)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(bx, -222, 26 + i * 12, PI * 1.1, PI * 1.75); ctx.stroke(); }
  ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx - 70, -252); ctx.lineTo(bx + 62, -196); ctx.stroke(); // wooden hairpin
  // grey hair (same path as coUtFace)
  const hairP = new Path2D();
  hairP.moveTo(-150 + tx * 0.1, 30); hairP.bezierCurveTo(-170, -120, -100, -228, tx * 0.2, -226); hairP.bezierCurveTo(100, -228, 170, -120, 150 + tx * 0.1, 30);
  hairP.lineTo(136, 0); hairP.bezierCurveTo(130, -80, 90, -130, 8 + tx * 0.4, -142); hairP.bezierCurveTo(-90, -130, -130, -80, -136, 0); hairP.closePath();
  ctx.fillStyle = NP.lgr(ctx, 0, -230, 0, 30, [[0, '#d2cec8'], [0.55, MATU.hair], [1, MATU.hairD]]); ctx.fill(hairP);
  ctx.save(); ctx.clip(hairP);
  ctx.strokeStyle = 'rgba(110,100,95,0.45)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 10; i++) { const sx = i < 5 ? -1 : 1, kk = i % 5; ctx.beginPath(); ctx.moveTo(sx * (20 + kk * 22), -150 + kk * 10); ctx.quadraticCurveTo(sx * (110 + kk * 6), -110 + kk * 10, sx * (138 + kk * 2), -10 + kk * 8); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 30, -200); ctx.quadraticCurveTo(-90 + i * 34, -150, -120 + i * 30, -60); ctx.stroke(); }
  ctx.globalCompositeOperation = 'screen'; ctx.beginPath(); ctx.arc(tx * 0.2, -10, 160, PI * 1.08, PI * 1.38); ctx.strokeStyle = 'rgba(255,200,140,0.35)'; ctx.lineWidth = 12; ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(80,70,65,0.55)'; ctx.lineWidth = 3; ctx.stroke(hairP);
  // smile lines: crow's feet + nasolabial folds + one forehead line
  ctx.strokeStyle = 'rgba(120,58,40,0.5)'; ctx.lineWidth = 3.5;
  for (const sx of [-1, 1]) {
    const ex = sx * 62 + tx * (sx === 1 ? 1.15 : 0.85) + sx * 56;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(ex, 4 + i * 12); ctx.lineTo(ex + sx * 18, 2 + i * 20); ctx.stroke(); }
    const mx = tx * 1.05 + sx * (ex === 'laugh' ? 80 : 72);
    ctx.beginPath(); ctx.moveTo(tx * 1.05 + sx * 38, 92); ctx.quadraticCurveTo(mx + sx * 6, 112, mx, 150); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,58,40,0.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-50 + tx, -112); ctx.quadraticCurveTo(tx, -122, 50 + tx, -112); ctx.stroke();
  if (ex === 'eyebrow') { // cover the right brow with skin, draw a high arched brow
    const bxR = 62 + tx * 1.15, by = -58;
    ctx.strokeStyle = NP.SKIN_U[1]; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(bxR - 42, by + 8); ctx.quadraticCurveTo(bxR + 2, by - 12, bxR + 44, by + 4); ctx.stroke();
    ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(bxR - 44, by - 8); ctx.quadraticCurveTo(bxR - 4, by - 58 - Math.sin(t * 6) * 4, bxR + 44, by - 20); ctx.stroke();
  }
}
function withGrey(fn) { const h = NP.COL.hair; NP.COL.hair = MATU.hair; try { return fn(); } finally { NP.COL.hair = h; } }

// ------------------------------------------------------------------ MÁ TƯ full body
function maTu(ctx, x, y, s = 1, o = {}) {
  const pose = o.pose || 'stand', fl = o.flip ? -1 : 1, U = NP.U_CO, t = o.t || 0, k = clamp(o.k ?? 0.5);
  const sx = s * fl * U, sy = s * U, sw = s * U;
  const toB = (p) => [(p[0] - x) / sx, (p[1] - y) / sy];
  const toL = (p) => [x + p[0] * sx, y + p[1] * sy];
  const B0 = ctx.getTransform();
  const extra = {}, after = [];
  const sitDef = { pour: 1, swirl: 1, spatula: 1, pick: 0, offer: 0, plate: 0, laugh: 0, wink: 0, eyebrow: 0, stand: 0 }[pose];
  const o2 = Object.assign({}, o, { palette: o.palette || MATU, hat: !!o.hat });
  if (sitDef !== undefined) o2.sit = o.sit ?? sitDef;
  const NATIVE = ['stand', 'wave', 'thumbs', 'fan', 'flip', 'hook', 'offer0', 'roll', 'pole', 'cheer'];
  if (!NATIVE.includes(pose)) o2.pose = o2.sit ? 'sit' : 'stand';
  let pf = null, exprOv = o.expr === 'eyebrow' ? 'eyebrow' : null;
  if (o.expr === 'eyebrow') o2.expr = 'calm';
  const panDef = (P) => o.panAt ? toB(o.panAt) : [128, P.SY + 70];

  if (pose === 'pour') {
    pf = (P) => {
      const pan = panDef(P), e = ease.inOut(k), tilt = lerp(0.25, 1.35, ease.out(clamp(k * 1.6)));
      const cup = [pan[0] + lerp(-34, 30, e) * 1, pan[1] - 70 - Math.sin(e * PI) * 8];
      const S = P.shR, dS = dist(cup, S);
      const g = clampTo([cup[0] + (S[0] - cup[0]) * 0.62, cup[1] + (S[1] - cup[1]) * 0.62 - 10], S, 118);
      const lip = [cup[0] + Math.cos(tilt) * 17 * 1.0, cup[1] + Math.sin(tilt) * 17 - 4];
      const pourK = clamp((k - 0.05) / 0.12) * (1 - clamp((k - 0.92) / 0.08));
      const handL = clampTo([pan[0] - (o.panRx ? o.panRx / sw : 105) - 12, pan[1] + 4], P.shL, 120);
      void dS;
      return {
        hR: g, kR: 'grip', rR: Math.atan2(cup[1] - g[1], cup[0] - g[0]), flipR: cup[0] < g[0],
        hL: handL, kL: 'grip', rL: 0.1, flipL: false,
        pre: () => {
          if (pourK > 0) { // batter ribbon
            const to = [pan[0] + lerp(-40, 40, e), pan[1]];
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(190,120,20,0.8)'; ctx.lineWidth = 7.5 * pourK; ctx.beginPath(); ctx.moveTo(lip[0], lip[1]); ctx.quadraticCurveTo(lip[0] + 4, (lip[1] + to[1]) / 2, to[0], to[1]); ctx.stroke();
            ctx.strokeStyle = '#f4c843'; ctx.lineWidth = 5.5 * pourK; ctx.stroke();
            ctx.strokeStyle = 'rgba(255,250,210,0.8)'; ctx.lineWidth = 1.6 * pourK; ctx.stroke();
            extra.stream = { from: toL(lip), to: toL(to), k: pourK };
          }
          ladleV(ctx, g, cup, tilt, 1 - e);
          extra.ladle = { cup: toL(cup), lip: toL(lip), grip: toL(g) };
        },
        expr: 'smile', look: [0.7, 0.9], turn: 0.35, tilt: 0.05,
      };
    };
  } else if (pose === 'swirl') {
    pf = (P) => {
      const pan = panDef(P), ph = t * TAU * (o.swirlHz ?? 0.9), rx = o.panRx ? o.panRx / sw : 105;
      const off = [Math.cos(ph) * 10, Math.sin(ph) * 5], rot = Math.sin(ph) * 0.1;
      const c = [pan[0] + off[0], pan[1] + off[1] - 8];
      const eL = clampTo([c[0] - rx - 8, c[1] + Math.sin(rot) * -rx], P.shL, 122), eR = clampTo([c[0] + rx * 0.55, c[1] - 26], P.shR, 122);
      return {
        hL: eL, kL: 'grip', rL: 0.05, flipL: false, hR: eR, kR: 'grip', rR: PI - 0.2, flipR: true,
        pre: () => { const cl = toL(c); extra.pan = { x: cl[0], y: cl[1], rot: rot * fl }; if (o.hold) inLocal(ctx, B0, () => o.hold(ctx, extra.pan)); },
        expr: 'calm', look: [0.6, 0.9], turn: 0.3,
      };
    };
  } else if (pose === 'spatula') {
    pf = (P) => {
      const pan = panDef(P), e = ease.inOut(k), rx = o.panRx ? o.panRx / sw : 105;
      const tip = [pan[0] - rx * 0.1 + e * 10, pan[1] - 4 - e * 46];
      const g = clampTo([tip[0] - 18, tip[1] - 92 + e * 20], P.shR, 118);
      const handL = clampTo([pan[0] - rx - 14, pan[1] + 4], P.shL, 120);
      return {
        hR: g, kR: 'grip', rR: Math.atan2(tip[1] - g[1], tip[0] - g[0]), flipR: tip[0] < g[0],
        hL: handL, kL: 'grip', rL: 0.1, flipL: false,
        post: () => { spatulaV(ctx, g, tip, 0.9); extra.spatula = { tip: toL(tip), grip: toL(g) }; NP.cHand(ctx, g[0], g[1], 0.36, Math.atan2(tip[1] - g[1], tip[0] - g[0]), { kind: 'grip', skin: NP.SKIN_U, flip: tip[0] < g[0] }); },
        expr: e > 0.6 ? 'talk' : 'smile', look: [0.7, 0.9], turn: 0.3,
      };
    };
  } else if (pose === 'pick') {
    pf = (P) => {
      const pk = o.pickAt ? toB(o.pickAt) : [150, P.SY + 150], g = clampTo(pk, P.shR, 124);
      const bc = [-62, P.SY + 138];
      return {
        hL: [-40, P.SY + 96], kL: 'grip', rL: -0.2, flipL: true,
        hR: g, kR: 'pinch', rR: Math.atan2(g[1] - P.shR[1], g[0] - P.shR[0]),
        post: () => { basketV(ctx, bc[0], bc[1], 48, t); NP.cHand(ctx, -40, P.SY + 96, 0.36, -0.2, { kind: 'grip', skin: NP.SKIN_U, flip: true }); extra.basket = toL(bc); extra.pick = toL(g); },
        expr: 'smile', look: [0.8, 0.8], turn: 0.4,
      };
    };
  } else if (pose === 'offer') {
    pf = (P) => {
      const wav = Math.sin(t * 5) * 4, gR = [92, P.SY - 64 + wav], gL = [-118, P.SY + 6];
      return {
        hR: gR, kR: 'grip', rR: -PI / 2 + 0.15, flipR: false,
        hL: gL, kL: 'pinch', rL: PI + 0.3, flipL: false,
        pre: () => { spatulaV(ctx, [gR[0] + 2, gR[1] + 30], [gR[0] + 14, gR[1] - 70], 0.9); },
        post: () => { apronV(ctx, gL[0] - 6, gL[1] + 8, 62, t); NP.cHand(ctx, gL[0], gL[1], 0.36, PI + 0.3, { kind: 'pinch', skin: NP.SKIN_U, flip: false }); extra.apron = toL([gL[0] - 6, gL[1] + 48]); },
        expr: 'talk', look: [-0.5, 0.2], turn: -0.15,
      };
    };
  } else if (pose === 'plate') {
    pf = (P) => {
      const pc = o.plateAt ? toB(o.plateAt) : [40, P.SY + 84];
      const hl = clampTo([pc[0] - 52, pc[1] + 10], P.shL, 122), hr = clampTo([pc[0] + 52, pc[1] + 10], P.shR, 122);
      return {
        hL: hl, kL: 'flat', rL: -0.35, flipL: false, hR: hr, kR: 'flat', rR: PI + 0.35, flipR: true,
        pre: () => { const cl = toL(pc); extra.plate = cl; if (o.hold) inLocal(ctx, B0, () => o.hold(ctx, { x: cl[0], y: cl[1] })); },
        expr: 'smile', look: [0.3, 0.6], turn: 0.2,
      };
    };
  } else if (pose === 'laugh') {
    pf = (P) => {
      const sh = Math.sin(t * 16) * 3;
      return {
        hL: [-10, P.hipY - 34 + sh], kL: 'flat', rL: 0.1, flipL: false,
        hR: [70, P.SY - 6 + sh], kR: 'open', rR: -1.1,
        expr: 'laugh', tilt: -0.1 + Math.sin(t * 16) * 0.02, turn: 0.2,
      };
    };
  } else if (pose === 'wink') {
    pf = (P) => ({ hR: [70, P.SY - 40 + Math.sin(t * 8) * 2], kR: 'thumb', rR: 0.15, hL: [-56, P.hipY - 10], kL: 'fist', rL: 1.4, expr: 'wink', turn: 0.25, tilt: 0.06 });
  } else if (pose === 'eyebrow') {
    exprOv = 'eyebrow'; o2.expr = o.expr && o.expr !== 'eyebrow' ? o.expr : 'calm';
    pf = (P) => ({ hL: [-62, P.hipY - 12], kL: 'fist', rL: 1.5, hR: [30, P.SY + 70], kR: 'point', rR: -0.9, turn: 0.15, tilt: -0.05, look: [0.2, 0.1] });
  }
  const userFn = o.poseFn;
  let turnUsed = 0.3, tiltUsed = 0, exUsed = 'smile';
  o2.poseFn = (P) => {
    const r = Object.assign({}, pf ? pf(P) : {}, userFn ? userFn(P) || {} : {});
    for (const kk of Object.keys(r)) if (r[kk] === undefined) delete r[kk];
    turnUsed = o.turn ?? r.turn ?? 0.3; tiltUsed = o.tilt ?? r.tilt ?? 0; exUsed = o2.expr || r.expr || 'smile';
    const fr = r.front, fy = -342 + P.B;
    r.front = () => {
      at(ctx, 0, fy, tiltUsed, 0.22, 0.22, () => maTuOverlay(ctx, turnUsed, exprOv || exUsed, t));
      if (fr) fr();
    };
    return r;
  };
  const ret = withGrey(() => NP.coUt(ctx, x, y, s, o2));
  for (const f of after) f();
  return Object.assign(devToLocal(B0, ret), extra);
}
function maTuFace(ctx, x, y, s = 1, o = {}) {
  const ex = o.expr || 'smile', o2 = Object.assign({ palette: MATU, hat: !!o.hat }, o, { expr: ex === 'eyebrow' ? 'calm' : ex, hat: !!o.hat });
  withGrey(() => NP.coUtFace(ctx, x, y, s, o2));
  at(ctx, x, y, o.tilt || 0, s, s, () => maTuOverlay(ctx, o.turn || 0, ex, o.t || 0));
  return { eyes: [x, y], mouth: [x + (o.turn || 0) * 63 * s, y + 128 * s], top: [x, y - 270 * s] };
}

// ------------------------------------------------------------------ TOURIST (bánh xèo poses)
const FOG = (t) => (ctx, cx) => {
  ctx.fillStyle = 'rgba(245,248,250,0.92)'; ctx.fillRect(cx - 60, -40, 120, 80);
  ctx.strokeStyle = 'rgba(200,210,220,0.9)'; ctx.lineWidth = 6; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 40 + i * 26, 20); ctx.quadraticCurveTo(cx - 30 + i * 26 + Math.sin(t * 3 + i) * 6, 0, cx - 44 + i * 26, -20); ctx.stroke(); }
  ctx.fillStyle = 'rgba(190,200,210,0.8)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx - 30 + i * 20, 14 + (i % 2) * 6, 4, 0, TAU); ctx.fill(); }
};
const EXPR_BX = {
  foggy: (t) => ({ mouth: 'o', mOpen: 0.45, brow: 0.9, glassesY: 0, glassesFn: FOG(t), blush: 0.8 }),
  blownHair: (t) => ({ mouth: 'o', mOpen: 0.35, open: 0.55, brow: 1.1, hairLift: 1 }),
  crunch: (t) => ({ open: 0, happyClosed: 1, mouth: 'grin', mOpen: 0.25 + 0.25 * Math.abs(Math.sin(t * 14)), blush: 0.9, brow: 0.6 }),
};
function faceOverBX(ctx, ex, t, hb) { // face units (eyes y0, head ±150)
  ctx.lineCap = 'round';
  if (ex === 'foggy') { // steam wisps rising off the lenses
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i / 3) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.7 * Math.sin(ph * PI)})`; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-70 + i * 70, -30 - ph * 160); ctx.quadraticCurveTo(-40 + i * 70 + Math.sin(t * 4 + i) * 30, -90 - ph * 180, -70 + i * 70, -150 - ph * 200); ctx.stroke(); }
  }
  if (ex === 'crunch') { crunchLines(ctx, 150, 120, 120, t); crumbs(ctx, 40, 170, 120, t, 10, 9); }
  if (hb > 0.02) { // wind streaks blowing the hair (from screen-left)
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * hb})`; ctx.lineWidth = 7;
    for (let i = 0; i < 4; i++) { const ph = (t * 2.2 + i * 0.27) % 1, xx = -320 + ph * 520; ctx.beginPath(); ctx.moveTo(xx, -230 + i * 34); ctx.quadraticCurveTo(xx + 80, -244 + i * 34, xx + 150, -226 + i * 30); ctx.stroke(); }
  }
}
function tourist(ctx, x, y, s = 1, o = {}) {
  const pose = o.pose || 'sit', fl = o.flip ? -1 : 1, UT = NP.UT, t = o.t || 0, k = clamp(o.k ?? 0.5);
  const sx = s * fl * UT, sy = s * UT;
  const toB = (p) => [(p[0] - x) / sx, (p[1] - y) / sy];
  const toL = (p) => [x + p[0] * sx, y + p[1] * sy];
  const B0 = ctx.getTransform();
  const extra = {};
  const o2 = Object.assign({}, o, { vest: !!o.vest, pack: !!o.pack });
  const NATIVE = ['sit', 'yawn', 'photo', 'point', 'sniff', 'rollBig', 'bite', 'hug', 'cheer', 'split'];
  if (!NATIVE.includes(pose)) o2.pose = 'sit';
  let ovEx = null;
  const hb = clamp(o.hairBlown ?? (o.expr === 'blownHair' ? 1 : 0));
  if (o.expr && EXPR_BX[o.expr]) { ovEx = o.expr; delete o2.expr; o2.face = Object.assign({}, EXPR_BX[o.expr](t), o.face || {}); }
  if (hb > 0) o2.face = Object.assign({}, o2.face || {}, { hairLift: Math.max(hb, (o2.face && o2.face.hairLift) || 0) });
  const faceAt = (P, fn) => { ctx.save(); ctx.translate(0, P.FY); ctx.scale(0.18, 0.18); fn(); ctx.restore(); };
  const SK = PEOPLE.SKIN;
  const pinky = (g, sr) => at(ctx, g[0], g[1], sr + PI, 0.4, 0.4, () => {
    ctx.lineCap = 'round'; ctx.strokeStyle = NP.OUT; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(-6, 26); ctx.quadraticCurveTo(-30, 56, -14, 82); ctx.stroke();
    ctx.strokeStyle = SK[1]; ctx.lineWidth = 11; ctx.stroke();
  });
  let pf = null, lean = 0;
  if (pose === 'knifeFork') {
    pf = (P) => {
      const saw = Math.sin(k * TAU * 2) * 10, gL = [-46, P.SY + 96], gR = [48 + saw, P.SY + 100];
      return {
        hL: gL, kL: 'grip', rL: -0.6, flipL: true, hR: gR, kR: 'grip', rR: PI + 0.5, flipR: false, lateHands: true,
        face: { mouth: 'smile', lookY: 0.9, lookX: 0, turn: 0.05, brow: 0.5 },
        front: () => {
          // fork (left) tines down, knife (right) blade down-left
          at(ctx, gL[0], gL[1], 0.55, 1, 1, () => { stroke2(ctx, 5, '#555', '#e0e0e0', () => { ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 44); }); ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = 2.4; for (const xx of [-6, -2, 2, 6]) { ctx.beginPath(); ctx.moveTo(xx, 44); ctx.lineTo(xx, 62); ctx.stroke(); } });
          at(ctx, gR[0], gR[1], -0.6, 1, 1, () => { stroke2(ctx, 5, '#555', '#e0e0e0', () => { ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 30); }); ctx.beginPath(); ctx.moveTo(-4, 30); ctx.lineTo(4, 30); ctx.lineTo(3, 70); ctx.quadraticCurveTo(-6, 62, -4, 30); NP.outFill(ctx, '#ececec', 1.5); });
          NP.cHand(ctx, gL[0], gL[1], 0.4, -0.6, { kind: 'grip', skin: SK, flip: true });
          NP.cHand(ctx, gR[0], gR[1], 0.4, PI + 0.5, { kind: 'grip', skin: SK, flip: false });
          pinky(gR, PI + 0.5); L.sparkle(ctx, gR[0] + 22, gR[1] - 30, 16, 0.5 + 0.5 * Math.sin(t * 9));
          extra.fork = toL([gL[0] + 10, gL[1] + 60]); extra.knife = toL([gR[0] - 20, gR[1] + 60]);
        },
      };
    };
  } else if (pose === 'pointTry') {
    pf = (P) => {
      const pt = o.pointAt ? toB(o.pointAt) : [220, P.SY + 120], g = clampTo(pt, P.shR, 150), a = Math.atan2(pt[1] - P.shR[1], pt[0] - P.shR[0]);
      return { hR: g, kR: 'point', rR: a, hL: [-30, P.SY + 70], kL: 'fist', rL: -0.4, face: { mouth: 'o', mOpen: 0.6, brow: 1, pupil: 1.2, lookX: Math.cos(a), lookY: Math.sin(a), turn: 0.3 * Math.sign(Math.cos(a)) } };
    };
  } else if (pose === 'dumpBowl') {
    pf = (P) => {
      const e = ease.inOut(k), c = [lerp(10, 70, e), lerp(P.SY + 80, P.SY + 6, e)], rot = lerp(0, 1.35, ease.in(clamp((k - 0.2) / 0.8)));
      const r = 44, hl = [c[0] - Math.cos(rot) * r, c[1] - Math.sin(rot) * r + 12], hr = [c[0] + Math.cos(rot) * r, c[1] + Math.sin(rot) * r + 12];
      return {
        hL: hl, kL: 'flat', rL: -0.4 + rot, flipL: false, hR: hr, kR: 'flat', rR: PI + 0.4 + rot, flipR: true, lateHands: true,
        face: { mouth: e > 0.6 ? 'grin' : 'smile', mOpen: 0.5, lookX: 0.5, lookY: 0.5, turn: 0.25 },
        front: () => { bowlV(ctx, c, rot, r, o.bowlCol || '#f0c848', o.fill ?? (1 - clamp((k - 0.6) / 0.4))); extra.bowl = { c: toL(c), lip: toL([c[0] + Math.cos(rot) * r, c[1] + Math.sin(rot) * r]), rot: rot * fl }; },
      };
    };
  } else if (pose === 'flip') {
    pf = (P) => {
      const e = ease.inOut(k), a = lerp(0.45, -0.55, e), g = [lerp(60, 96, e), lerp(P.SY + 96, P.SY + 10, e)], rx = 46;
      const c = [g[0] + Math.cos(a) * rx * 2, g[1] + Math.sin(a) * rx * 2];
      const air = clamp((k - 0.55) / 0.45), cy = c[1] - Math.sin(air * PI) * 160 - air * 10;
      return {
        hR: g, kR: 'grip', rR: a, flipR: false, hL: [-36, P.SY + 70 - e * 50], kL: e > 0.6 ? 'open' : 'fist', rL: -1.2, lateHands: true,
        face: e > 0.55 ? { mouth: 'o', mOpen: 0.9, brow: 1.1, lookY: -1, lookX: 0.4, pupil: 1.2 } : { mouth: 'neutral', brow: -0.2, lookX: 0.6, lookY: 0.6, open: 0.7 },
        front: () => {
          if (!o.noPan) miniPan(ctx, c, a, rx, air <= 0.02);
          if (air > 0.02 && !o.noPan) crepeFly(ctx, [c[0] + air * 20, cy], -air * TAU * 0.9, rx * 0.75);
          extra.pan = { x: toL(c)[0], y: toL(c)[1], rot: a * fl }; extra.crepe = toL([c[0] + air * 20, cy]);
          if (e > 0.5) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(g[0], g[1], 90 + i * 18, -1.4 - i * 0.05, -0.4); ctx.stroke(); } }
        },
      };
    };
  } else if (pose === 'gape') {
    pf = (P) => ({ hL: [-62, P.FY + 66], kL: 'open', rL: -1.9, hR: [62, P.FY + 66], kR: 'open', rR: -1.2, face: { mouth: 'o', mOpen: 1.1, brow: 1.2, pupil: 0.8, open: 1 }, lateHands: true });
  } else if (pose === 'applaud') {
    pf = (P) => { const c = Math.abs(Math.sin(t * TAU * 2.2)); return { hL: [-8 - c * 26, P.SY + 30], kL: 'flat', rL: -PI / 2 + 0.3, flipL: false, hR: [8 + c * 26, P.SY + 30], kR: 'flat', rR: -PI / 2 - 0.3, flipR: true, face: { mouth: 'grin', mOpen: 0.6, happyClosed: 1, open: 0, blush: 0.8 } }; };
  } else if (pose === 'bow') {
    lean = (o.stand ? 0.14 : 0.06) * ease.inOut(k);
    pf = (P) => ({ hL: [-8, P.SY + 26], kL: 'flat', rL: -PI / 2 + 0.15, flipL: false, hR: [8, P.SY + 26], kR: 'flat', rR: -PI / 2 - 0.15, flipR: true, face: { mouth: 'smile', happyClosed: 1, open: 0, blush: 0.6 }, tilt: 0.12 + 0.1 * k });
  } else if (pose === 'wrapBite') {
    pf = (P) => {
      const e = ease.inOut(k), c = [lerp(10, 16, e), lerp(P.SY + 70, P.FY + 34, e)], rot = lerp(-0.5, -0.15, e), w = 40;
      const bite = clamp((k - 0.7) / 0.3);
      return {
        hL: [c[0] - 30, c[1] + 16], kL: 'pinch', rL: -0.6, flipL: false, hR: [c[0] + 14, c[1] + 22], kR: 'pinch', rR: PI + 0.8, flipR: true, lateHands: true,
        face: bite > 0 ? EXPR_BX.crunch(t) : { mouth: 'o', mOpen: 0.4 + e * 0.6, lookY: 0.6, brow: 0.7 },
        front: () => {
          wrapV(ctx, [c[0] - 18, c[1]], rot, w, bite);
          if (bite > 0) faceAt(P, () => { crunchLines(ctx, 150, 110, 110, t); crumbs(ctx, 30, 160, 130, t, 10, 5); });
          extra.wrap = toL(c);
        },
      };
    };
  } else if (pose === 'thumbs') {
    pf = (P) => ({ hL: [-74, P.SY - 20 + Math.sin(t * 8) * 3], kL: 'thumb', rL: PI - 0.15, flipL: true, hR: [74, P.SY - 20 + Math.sin(t * 8 + 1) * 3], kR: 'thumb', rR: 0.15, face: { mouth: 'grin', mOpen: 0.6, happyClosed: 1, open: 0, blush: 0.6 } });
  }
  const userFn = o.poseFn;
  o2.poseFn = (P) => {
    const r = Object.assign({}, pf ? pf(P) : {}, userFn ? userFn(P) || {} : {});
    for (const kk of Object.keys(r)) if (r[kk] === undefined) delete r[kk];
    if (r.face && o2.face) r.face = Object.assign({}, r.face, o2.face);
    if (o.apron) { // small striped apron over the life vest (drawn after arms, before hands)
      const bh = r.behind;
      r.behind = () => { if (bh) bh(); apronV(ctx, 0, P.SY + 30, 84, t, o.apronCol || '#3a6ea8'); ctx.strokeStyle = '#f3eadb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-25, P.SY + 30); ctx.quadraticCurveTo(0, P.SY - 14, 25, P.SY + 30); ctx.stroke(); };
    }
    const fr = r.front;
    if (ovEx || hb > 0.02) r.front = () => { faceAt(P, () => faceOverBX(ctx, ovEx, t, hb)); if (fr) fr(); };
    return r;
  };
  if (o.stool) stoolV(ctx, x, y, s, o.stoolCol);
  let ret;
  if (lean) { ctx.save(); ctx.translate(x, y); ctx.rotate(lean * fl); ctx.translate(-x, -y); ret = NP.tourist(ctx, x, y, s, o2); ctx.restore(); }
  else ret = NP.tourist(ctx, x, y, s, o2);
  return Object.assign(devToLocal(B0, ret), extra);
}

// red plastic street stool (ghế nhựa đỏ). origin = floor centre; seat top at y-34*s (tourist sit hips sit on it), ±90*s wide.
function stoolV(ctx, x, y, s = 1, col = '#d33a2c') {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(20,10,10,0.25)'; NP.ell(ctx, 0, 0, 96, 9); ctx.fill();
  ctx.strokeStyle = NP.OUT; ctx.lineWidth = 2;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 74, -26); ctx.lineTo(sx * 90, 0); ctx.lineTo(sx * 76, 0); ctx.lineTo(sx * 62, -26); ctx.closePath(); ctx.fillStyle = '#a52a20'; ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.rect(-82, -34, 164, 12); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,190,150,0.6)'; ctx.fillRect(-80, -33, 160, 3);
  ctx.restore();
}

// ------------------------------------------------------------------ BOATMAN rowing (with duck/crouch)
function boatmanRow(ctx, x, y, s = 1, o = {}) {
  const dk = clamp(o.duck || 0), B0 = ctx.getTransform();
  if (o.boat) { // own xuồng: origin = waterline, s = boat scale (as touristInXuong)
    const t = o.t || 0, bo = { t, bob: o.bob ?? 4, flip: o.flip, seed: o.seed || 1 }, BKk = NP.BK || 2.5;
    const boat = devToLocal(B0, NP.xuongBaLa(ctx, x, y, s, Object.assign({ part: 'back' }, bo)));
    ctx.save(); NP.boatXform(ctx, x, y, s, bo);
    ctx.translate(-150, -22); ctx.scale(1, 1 - 0.3 * ease.inOut(dk)); ctx.rotate(0.18 * dk); ctx.translate(150, 22);
    const bm = NP.boatman(ctx, -150, -22, 1 / BKk, { pose: 'row', t, phase: o.phase ?? t * 0.8, oarLen: o.oarLen });
    ctx.restore();
    NP.xuongBaLa(ctx, x, y, s, Object.assign({ part: 'front' }, bo));
    return Object.assign(devToLocal(B0, bm), { boat });
  }
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, 1 - 0.3 * ease.inOut(dk)); ctx.rotate(0.18 * dk * (o.flip ? -1 : 1)); ctx.translate(-x, -y);
  const ret = NP.boatman(ctx, x, y, s, { pose: 'row', t: o.t || 0, phase: o.phase ?? (o.t || 0) * 0.8, flip: o.flip, oarLen: o.oarLen, pivot: o.pivot });
  ctx.restore();
  return devToLocal(B0, ret);
}

// ------------------------------------------------------------------ DUCKS
function duck(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, pose = o.pose || 'swim', fl = o.flip ? -1 : 1, ph = o.ph || 0, ret = {};
  const B0 = ctx.getTransform();
  ctx.save(); ctx.translate(x, y); ctx.scale(s * fl, s);
  const M = NP.mapper(ctx);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const W = '#f6f2e8', WD = '#cfc6b4', BK = '#f0a020';
  const swim = pose === 'swim';
  const bob = swim ? Math.sin(t * 3 + ph) * 2.5 : pose === 'flapRun' ? -Math.abs(Math.sin(t * 14 + ph)) * 8 : 0;
  const by = (swim ? -10 : -46) + bob;
  // legs (not when swimming)
  if (!swim) {
    for (const i of [0, 1]) {
      const sw = pose === 'flapRun' ? Math.sin(t * 14 + ph + i * PI) * 14 : (i ? 4 : -4);
      ctx.strokeStyle = '#e08a18'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-6 + i * 10, by + 20); ctx.lineTo(-6 + i * 10 + sw, -6); ctx.stroke();
      ctx.fillStyle = BK; ctx.beginPath(); ctx.moveTo(-12 + i * 10 + sw, 0); ctx.lineTo(8 + i * 10 + sw, 0); ctx.lineTo(-2 + i * 10 + sw, -8); ctx.closePath(); ctx.fill();
    }
  } else { ctx.fillStyle = 'rgba(30,50,60,0.25)'; NP.ell(ctx, 0, 2, 64, 7); ctx.fill(); }
  // body
  const body = new Path2D();
  body.moveTo(-58, by - 6); body.quadraticCurveTo(-70, by - 26, -50, by - 22); body.quadraticCurveTo(-20, by - 30, 20, by - 22); body.quadraticCurveTo(52, by - 18, 48, by + 4); body.quadraticCurveTo(40, by + 26, 0, by + 28); body.quadraticCurveTo(-44, by + 28, -58, by - 6); body.closePath();
  ctx.save();
  if (swim) { ctx.beginPath(); ctx.rect(-200, -400, 400, 400 + 2); ctx.clip(); }
  ctx.fillStyle = NP.lgr(ctx, 0, by - 30, 0, by + 28, [[0, W], [1, WD]]); ctx.fill(body); ctx.strokeStyle = NP.OUT; ctx.lineWidth = 2.4; ctx.stroke(body);
  // wing
  const flap = pose === 'flapRun' ? Math.sin(t * 18 + ph) : pose === 'quack' ? Math.sin(t * 6 + ph) * 0.2 : 0;
  ctx.save(); ctx.translate(-6, by - 8); ctx.rotate(-0.15 - flap * 0.9);
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.quadraticCurveTo(0, -14 - Math.max(0, flap) * 20, -38, -4); ctx.quadraticCurveTo(-12, 16, 18, 0); ctx.closePath(); ctx.fillStyle = '#e4dccb'; ctx.fill(); ctx.strokeStyle = NP.OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  ctx.restore();
  if (swim) { ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-64, 1); ctx.quadraticCurveTo(-90, 3 + Math.sin(t * 3 + ph) * 2, -110, 1); ctx.moveTo(52, 0); ctx.lineTo(60, 0); ctx.stroke(); }
  // neck + head
  const up = pose === 'lookUp' ? 1 : pose === 'quack' ? 0.4 : 0, nod = swim ? Math.sin(t * 2 + ph) * 2 : 0;
  const hx = 34 - up * 6, hy = by - 40 - up * 10 + nod;
  ctx.beginPath(); ctx.moveTo(24, by - 16); ctx.quadraticCurveTo(30, by - 30, hx - 6, hy + 8); ctx.lineTo(hx + 10, hy + 10); ctx.quadraticCurveTo(46, by - 22, 40, by - 12); ctx.closePath(); ctx.fillStyle = W; ctx.fill(); ctx.strokeStyle = NP.OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(hx, hy, 16, 0, TAU); ctx.fillStyle = W; ctx.fill(); ctx.stroke();
  NP.rimLine(ctx, () => ctx.arc(hx, hy, 15, PI * 1.05, PI * 1.6), 'rgba(255,200,130,0.85)', 3);
  // beak
  const open = pose === 'quack' ? 0.5 + 0.5 * Math.abs(Math.sin(t * 9 + ph)) : 0, ba = -up * 0.6;
  ctx.save(); ctx.translate(hx + 12, hy + 3); ctx.rotate(ba);
  ctx.fillStyle = BK; ctx.strokeStyle = '#8a4a10'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(14, -7 - open * 3, 22, -2 - open * 4); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(20, 1 + open * 6); ctx.quadraticCurveTo(10, 6 + open * 6, 0, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  // eye
  ctx.fillStyle = '#141010'; ctx.beginPath(); ctx.arc(hx + 4, hy - 4 - up * 2, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 5, hy - 5 - up * 2, 1.2, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(240,120,110,0.35)'; NP.ell(ctx, hx + 2, hy + 6, 5, 3); ctx.fill();
  if (pose === 'quack' && open > 0.6) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(hx + 30, hy, 10 + i * 8, -0.6, 0.6); ctx.stroke(); } }
  ret.head = M(hx, hy); ret.beak = M(hx + 30, hy + 2); ret.body = M(0, by);
  ctx.restore();
  return devToLocal(B0, ret);
}
function duckLine(ctx, t, x, y, s = 1, n = 4, o = {}) {
  const sp = o.spacing ?? 110 * s, fl = o.flip ? -1 : 1, fo = o.follow ?? 1, out = [];
  for (let i = n - 1; i >= 0; i--) {
    const lag = i * 0.35 * fo, dx = -i * sp * fl, dy = Math.sin(t * 1.3 - lag) * 6 * s * (i ? 1 : 0.3);
    const ss = s * (i === 0 ? 1 : 0.82);
    out[i] = duck(ctx, x + dx, y + dy, ss, { t, pose: o.pose || 'swim', flip: o.flip, ph: i * 1.7 });
  }
  return out;
}

// ------------------------------------------------------------------ TOURIST IN XUỒNG + BOATMAN
function touristInXuong(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, B0 = ctx.getTransform(), BKk = NP.BK || 2.5;
  const bo = { t, bob: o.bob ?? 4, flip: o.flip, seed: o.seed || 0 };
  const boat = NP.xuongBaLa(ctx, x, y, s, Object.assign({ part: 'back' }, bo));
  const bl = devToLocal(B0, boat);
  // boatman in boat space (stern)
  let bm;
  ctx.save(); NP.boatXform(ctx, x, y, s, bo);
  const BB = ctx.getTransform();
  bm = NP.boatman(ctx, -150, -22, 1 / BKk, { pose: 'row', t, phase: o.phase ?? t * 0.7 });
  ctx.restore();
  void BB;
  // tourist seated on the plank
  const sn = clamp(o.sniff || 0), pk = clamp(o.perk || 0);
  const tex = o.expr || (sn > 0.4 ? 'sniff' : pk > 0.4 ? 'wow' : 'smile');
  const st = bl.seat, ts = s * 0.92;
  const tr = tourist(ctx, st[0], st[1] + (o.sink ?? 90) * s - pk * 8 * s, ts, {
    t, flip: o.flip, expr: tex, pack: o.pack ?? true, vest: !!o.vest,
    poseFn: (P) => (sn > 0.3 ? { hR: [44, P.SY + 40], kR: 'flat', rR: -0.6, tilt: -0.12 * sn } : pk > 0.3 ? { hL: [-60, P.SY + 60], hR: [60, P.SY + 60], kL: 'open', kR: 'open', rL: -2, rR: -1.1 } : {}),
  });
  if (sn > 0.2) { ctx.save(); ctx.strokeStyle = `rgba(255,236,190,${0.8 * sn})`; ctx.lineWidth = 3 * s; ctx.lineCap = 'round'; const h = tr.head; for (let i = 0; i < 3; i++) { const ph = (t * 1.4 + i / 3) % 1; ctx.beginPath(); ctx.moveTo(h[0] + (o.flip ? -1 : 1) * (60 + ph * 90) * s, h[1] + (10 - i * 12) * s); ctx.quadraticCurveTo(h[0] + (o.flip ? -1 : 1) * (40 + ph * 70) * s, h[1] - (20 + i * 10) * s, h[0] + (o.flip ? -1 : 1) * (24 + ph * 40) * s, h[1] + 20 * s); ctx.stroke(); } ctx.restore(); }
  NP.xuongBaLa(ctx, x, y, s, Object.assign({ part: 'front' }, bo));
  return { boat: bl, tourist: tr, boatman: devToLocal(B0, bm) };
}

module.exports = { MATU, BX_BEAT, maTu, maTuFace, tourist, touristBX: tourist, stoolV, boatmanRow, duck, duckLine, touristInXuong, apronV, basketV, spatulaV, ladleV, miniPan, crepeFly, bowlV, wrapV };
