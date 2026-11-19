// cl_chars.js: "Cá lóc nướng trui" characters for the moonlit flooded-field night (Chú Ba, the night tourist, frog, egret).
// LOCAL in / LOCAL out: (x,y) are in the CURRENT ctx space; every returned anchor is in that same space.
// THIS HEADER IS THE SOURCE OF TRUTH for the API.   const CL = require('./clprops');  (re-exports everything below)
// =====================================================================================================================
// CONVENTIONS
//  • Every drawer save()/restore()s and is deterministic from o.t / o.k / o.seed.  s = uniform scale.
//  • Every character is drawn inside cl_env.nightLit(): cool moon tint and a blue rim from the upper right. Common options
//    on every character:
//      o.night (tint amount, default .3)
//      o.fireLight {x,y,k[,r]} LOCAL: warm fire light and an orange rim from that side.
//      o.waterline (LOCAL y): legs fade below it, plus a ripple ring at the waterline.
//      o.reflect 0..1: mirrored reflection under the waterline.
//      o.rim (moon-rim strength, default 1) · o.moon (screen direction, default [.75,−.66]).
//  • o.flip mirrors the figure (faces −x). o.t = time in seconds (idle motion, gait, flapping). o.k = 0..1 progress.
//  • Light beams (head torch, phone light, lighter flame) are drawn AFTER the lit figure in the caller ctx (additive).
//
// ------------------------------------------------------------------------------------------------- CHÚ BA (farmer, 50s)
//  chuBa(ctx,x,y,s,o)
//   Look: tanned, thin moustache, black áo bà ba with rolled sleeves, khăn rằn headband, rolled trousers, barefoot.
//   Rig: origin = between the feet, facing +x (3/4 front).
//     Size at s=1: ≈ 500 px tall; eyes ≈ y−456, shoulders ≈ −400, hip ≈ −252, knees ≈ −130.
//     Knee-deep water: o.waterline = y − 130*s.
//   o.pose:
//     'stand'
//     'wade'        o.speed (cycles/s, default .7); o.trap: carries the nơm in the forward hand.
//     'trapDown'    k: nơm slammed down in front (x≈+150, base sinks to ≈ +40); o.trapSub, o.inside(ctx) passed to nomTrap.
//                   → extra.trap {top, base, rx}
//     'skewer'      k: fish held horizontally at the chest, bamboo stick pushed in through the mouth on two beats
//                   (k .0–.45 push 1, .45–.55 regrip, .55–1 push 2; the tip exits past the tail at the end).
//                   → extra.stick {tip, end}, extra.fish (snakehead anchors)
//     'carryStraw'  armful of straw at the chest (o.walk:true adds the gait). → extra.straw
//     'light'       squats and cups a lighter (o.lightAt figure-or-LOCAL point, o.flame 0..1); face lit from below.
//                   → extra.flame
//     'squat'
//     'scrape'      squats, fish on a stick in the near hand, knife strokes the char off. k / o.scrape = scraped amount
//                   (cl_food snakehead 'scraped'). → extra.fish, extra.blade
//     'laugh'       belly laugh, slaps the thigh.
//     'offer'       forward palm up holding o.item 'roll'|'fish' (or o.hold(ctx,handFig,rot)). o.offerAt LOCAL target.
//                   → extra.offer
//     'shrug'       palms up, brows up.
//     'catchBasket' holds the fish basket out in front (o.basketFish 0|1|2 tails). → extra.basket {mouth, bottom}
//     'sit'         sits on the dike, knees up, hands on knees.
//     'thumbs'      double thumbs up (o.wink:true winks).
//   o.expr: 'smile'|'grin'|'laugh'|'wink'|'talk'|'neutral'|'focus'|'o' (each pose has a sensible default).
//   o.turn −1..1 (face turn), o.tilt, o.lookX/lookY, o.under 0..1 (warm light from below).
//   o.torch: true → head torch on the khăn, beam drawn after the figure.
//     o.torchAt LOCAL target, or the default direction (forward-down).
//     o.beamLen (600*s), o.beamW (180*s), o.beam:false (lamp only, no beam).
//     → extra.torch {from, dir, to}
//   o.basket: true → small fish basket hanging at the hip. → extra.basketMouth
//   o.lean adds to the pose lean (radians, + = forward).
//   → {head, face:{x,y,s}, eyes, mouth, handL, handR, footL, footR, hip, ...extras}
//     handR = the figure's forward hand (+x side before flip); NOT swapped on flip.
//  chuBaFace(ctx,x,y,s,o)
//   Close-up bust; origin = between the eyes; s=1 → head radius ≈ 108 px; shoulders reach y+600*s.
//   o: expr, t, turn, tilt, lookX, lookY, under, torch (+ torchAt / beam), fireLight, night.
//   → {eyes, mouth, lamp, top}
//
// ------------------------------------------------------------------------------------------------- NIGHT TOURIST
//  touristNight(ctx,x,y,s,o)   (alias: tourist)
//   Look: blond backpacker, sunglasses on the head, turquoise tee, khaki shorts; o.pack:true adds the backpack.
//   Wraps nprops.tourist (UT 1.2). Origin = feet (standing) or seat (seated, the hips sit 32*s above y).
//   Size at s=1: standing ≈ 520 px tall, eyes ≈ y−462.
//   o.pose:
//     standing: 'stand'
//       'phoneLight'   phone torch in the forward hand; o.lightAt LOCAL target; o.lightK. → extra.light {from, dir, to}
//       'rubHands'     rubs hands (t-animated).
//       'rollShorts'   bends over and rolls the shorts up; k 0..1.
//       'grab'         lunges and grabs; o.grabAt LOCAL; k (hands close at k > .8). → extra.grab
//       'slipped'      foot kicks up, leans back, flails; k.
//       'slapped'      head snapped away, red fish-tail mark on the cheek, dizzy stars.
//       'wobble'       arms out, wobbling for balance.
//       'fallBack'     k 0→1 falls backwards (−1.35 rad at k=1, pivots on the feet).
//       'popUp'        head + shoulders out of the water at y (y = waterline). Wet, lotus-leaf hat, dazed.
//                      o.frog (true | {pose,k}) puts a frog on the hat.
//       'thumbs'
//     seated: 'sitFire' (palms to the fire, or holding a roll with o.roll:true)
//       'bite'         roll at the mouth; k > .5 = bitten, chewing.
//       'bliss'        hand on the chest, eyes closed, sparkles.
//       also any native nprops pose: sit yawn photo point sniff rollBig hug cheer split
//   o.stand forces standing/seated. o.expr (nprops TFACE: neutral smile sniff wow panic chew bliss yawn). o.face overrides.
//   Any pose:
//     o.wet: dark wet hair, darker tee, drips.
//     o.lotusHat: lotus-leaf hat.
//     o.frog: frog on the head.
//     o.waterline: clip with a ripple ring.
//     o.lean (extra radians).
//   → nprops anchors (head, mouth, handL/handR, face{x,y,s}, footL/footR) + extras
//
// ------------------------------------------------------------------------------------------------- EXTRAS
//  frog(ctx,x,y,s,{t, k (throat sac 0..1; default pulses for 'ribbit'), pose:'sit'|'ribbit'|'jump', flip, lit:true})
//     front-view frog, origin = bottom centre, ≈ 70×56 at s=1. → {eyes, mouth, top}
//  egret(ctx,x,y,s,{t, pose:'stand'|'fly', flip, lit:true})
//     white egret, origin = feet (stand) or body centre (fly); ≈ 260 tall at s=1. → {head, beak}
//  CB_COL: the Chú Ba palette.
//
// TIMINGS (this PC, 1080×1920, warm): see _test_cl_envchars.js output
//   (flushed, 1080×1920) chuBa ≈ 16–20 ms at s 1.5–2 (nightLit rim/tint is most of it) · touristNight ≈ 7–16 ms ·
//   chuBaFace ≈ 18 ms · frog ≈ 3 ms · full scene (fieldWaterClose + xuồng + both + beams) ≈ 46 ms.
// =====================================================================================================================
'use strict';
const { Path2D } = require('@napi-rs/canvas');
const L = require('./lib');
const NP = require('./nprops');
const PEOPLE = require('./people');
const E = require('./cl_env');
let F = null;
try { F = require('./cl_food'); } catch (e) { F = null; }
const { TAU, clamp, lerp, ease, at } = L;
const PI = Math.PI;
const { lgr, rgr, capFS, ell, ikPick, ikUp, cHand, cArm, outFill, OUT } = NP;

const CB_COL = {
  skin: ['#dba574', '#b5784b', '#80502f'], shirt: '#2b2d3a', shirtL: '#3d4152', shirtD: '#1b1c25', trousers: '#1f2029',
  cuff: '#3a3d4c', hair: '#1a1714', grey: '#8d8a86', lip: '#8a4a3a',
};
const SKB = CB_COL.skin;
const HS = 0.38; // head units → figure units

// ---------------------------------------------------------------------------------------------- small helpers
const rot2 = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mulv = (a, k) => [a[0] * k, a[1] * k];
const lerpP = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
function clampTo(p, o, r) { const dx = p[0] - o[0], dy = p[1] - o[1], d = Math.hypot(dx, dy); return d <= r ? p : [o[0] + dx / d * r, o[1] + dy / d * r]; }
function star5(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * PI / 5 - PI / 2, rr = i % 2 ? r * 0.45 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
  ctx.closePath();
}
function flameDraw(ctx, x, y, sc, t, k = 1) {
  if (k <= 0.01) return;
  const fl = 0.85 + 0.15 * Math.sin(t * 23) * Math.sin(t * 7.3), h = 30 * sc * fl * k, w = 9 * sc * k;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rgr(ctx, x, y - h * 0.4, 0, x, y - h * 0.4, 110 * sc * k, [[0, `rgba(255,190,110,${0.55 * k})`], [0.4, `rgba(255,140,60,${0.18 * k})`], [1, 'rgba(255,120,50,0)']]);
  ctx.fillRect(x - 110 * sc, y - h * 0.4 - 110 * sc, 220 * sc, 220 * sc);
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 9) * 0.08);
  for (const [m, col] of [[1, '#ff8a2a'], [0.7, '#ffd27a'], [0.38, '#fff6dc']]) {
    ctx.beginPath(); ctx.moveTo(0, -h * m - 2); ctx.bezierCurveTo(w * m, -h * m * 0.5, w * m * 1.1, 0, 0, 2); ctx.bezierCurveTo(-w * m * 1.1, 0, -w * m, -h * m * 0.5, 0, -h * m - 2);
    ctx.fillStyle = col; ctx.fill();
  }
  ctx.fillStyle = 'rgba(80,140,255,0.55)'; ell(ctx, 0, 0, w * 0.5, w * 0.35); ctx.fill();
  ctx.restore();
}
function fishSimple(ctx, x, y, s, rot, o = {}) { // fallback snakehead (no cl_food): 520 long at s=1, head +x
  at(ctx, x, y, rot, s * (o.flip ? -1 : 1), s, () => {
    ctx.beginPath(); ctx.moveTo(260, 0); ctx.bezierCurveTo(240, -60, 60, -70, -160, -36); ctx.lineTo(-260, -60); ctx.lineTo(-240, 0); ctx.lineTo(-260, 60); ctx.lineTo(-160, 36); ctx.bezierCurveTo(60, 70, 240, 60, 260, 0);
    outFill(ctx, o.state === 'charred' ? '#1c1714' : '#4a4e3a', 4);
    ctx.fillStyle = '#f2efe6'; ell(ctx, 190, -16, 10, 10); ctx.fill();
  });
  if (o.skewerA !== undefined) { ctx.save(); ctx.strokeStyle = '#c9a866'; ctx.lineWidth = 10 * s; ctx.lineCap = 'round'; const c = Math.cos(rot) * (o.flip ? -1 : 1), sn = Math.sin(rot) * (o.flip ? -1 : 1); ctx.beginPath(); ctx.moveTo(x + c * (260 + o.skewerA) * s, y + sn * (260 + o.skewerA) * s); ctx.lineTo(x - c * (260 + (o.skewerB || 0)) * s, y - sn * (260 + (o.skewerB || 0)) * s); ctx.stroke(); ctx.restore(); }
  return { center: [x, y] };
}
const fishDraw = (ctx, x, y, s, o) => (F ? F.snakehead(ctx, x, y, s, o) : fishSimple(ctx, x, y, s, o.rot || 0, o));
function basketDraw(ctx, x, y, s, o) {
  if (F) return F.fishBasket(ctx, x, y, s, o);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(-90, 0); ctx.bezierCurveTo(-150, -120, -80, -200, -50, -230); ctx.lineTo(50, -230); ctx.bezierCurveTo(80, -200, 150, -120, 90, 0); ctx.closePath(); outFill(ctx, '#b58a4a', 4); ctx.restore();
  return { mouth: [x, y - 236 * s], bottom: [x, y], neck: [x, y - 200 * s] };
}
function trapDraw(ctx, x, y, s, o) {
  if (F) return F.nomTrap(ctx, x, y, s, o);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = '#c9a060'; ctx.lineWidth = 6;
  for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(i * 40, 0); ctx.quadraticCurveTo(i * 30, -300, i * 6, -420); ctx.stroke(); }
  ctx.restore(); return { top: [x, y - 420 * s], base: [x, y], waterline: [x, y], rx: 210 * s };
}
function rollDraw(ctx, x, y, s, o) {
  if (F) return F.ricePaperRoll(ctx, x, y, s, o);
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s); NP.rrect(ctx, -140, -42, 280, 84, 42); outFill(ctx, 'rgba(240,236,220,0.9)', 3); ctx.restore();
  return { center: [x, y] };
}
function strawDraw(ctx, x, y, s, o) {
  if (F) return F.strawArmful(ctx, x, y, s, o);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ell(ctx, 0, 0, 180, 70); outFill(ctx, '#d8b260', 3); ctx.restore();
  return { center: [x, y] };
}

// ================================================================================================= CHÚ BA head
// head units: centre (0,0), radius ≈ 108; eyes y −12; mouth ≈ y 70. o: expr, t, turn, lookX, lookY, brow, under, lamp
function cbHead(ctx, o = {}) {
  const t = o.t || 0, ex = o.expr || 'smile', fx = (o.turn || 0) * 18, br = o.brow || 0;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ears
  for (const sx of [-1, 1]) { ell(ctx, sx * 92 + fx * 0.3, 2, 16, 25); outFill(ctx, SKB[1], 3); ctx.strokeStyle = 'rgba(90,45,25,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx * 92 + fx * 0.3, 2, 9, sx > 0 ? -1.2 : PI - 1.9, sx > 0 ? 1.2 : PI + 1.9); ctx.stroke(); }
  // face
  const face = new Path2D();
  face.moveTo(0, -110); face.bezierCurveTo(58, -112, 97, -80, 96, -22); face.bezierCurveTo(96, 30, 86, 70, 66, 92); face.quadraticCurveTo(36, 117, 0, 117);
  face.quadraticCurveTo(-36, 117, -66, 92); face.bezierCurveTo(-86, 70, -96, 30, -96, -22); face.bezierCurveTo(-97, -80, -58, -112, 0, -110); face.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke(face);
  ctx.fillStyle = rgr(ctx, 30 + fx, -36, 8, 10, 0, 150, [[0, SKB[0]], [0.55, SKB[1]], [1, SKB[2]]]); ctx.fill(face);
  ctx.save(); ctx.clip(face);
  // jaw shadow + stubble tone
  ctx.fillStyle = 'rgba(70,40,25,0.16)'; ell(ctx, fx, 104, 80, 30); ctx.fill();
  const und = clamp(o.under || 0);
  if (und > 0.01) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = lgr(ctx, 0, 125, 0, -50, [[0, `rgba(255,170,80,${0.7 * und})`], [0.5, `rgba(255,140,60,${0.3 * und})`], [1, 'rgba(255,120,50,0)']]);
    ctx.fillRect(-120, -60, 240, 190); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(20,14,30,${0.25 * und})`; ctx.fillRect(-120, -120, 240, 70); // brow area falls into shadow
  }
  ctx.restore();
  // hair cap + grey temples
  ctx.beginPath(); ctx.moveTo(-99, -18); ctx.bezierCurveTo(-106, -92, -52, -124, 0, -124); ctx.bezierCurveTo(52, -124, 106, -92, 99, -18);
  ctx.lineTo(92, -26); ctx.quadraticCurveTo(84, -76, 0, -84); ctx.quadraticCurveTo(-84, -76, -92, -26); ctx.closePath();
  outFill(ctx, CB_COL.hair, 3);
  ctx.strokeStyle = CB_COL.grey; ctx.lineWidth = 3;
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx * (90 - i * 2), -40 + i * 6); ctx.lineTo(sx * (96 - i), -24 + i * 5); ctx.stroke(); }
  // khăn rằn band
  const band = new Path2D(); band.moveTo(-104, -60); band.quadraticCurveTo(0, -98, 104, -60); band.lineTo(102, -30); band.quadraticCurveTo(0, -68, -102, -30); band.closePath();
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke(band);
  ctx.fillStyle = NP.tilePattern(ctx, NP.khanTile(), 22); ctx.fill(band);
  ctx.fillStyle = lgr(ctx, -104, 0, 104, 0, [[0, 'rgba(0,0,0,0.35)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]); ctx.fill(band);
  // knot + tails (left side)
  const fw = Math.sin(t * 3.1) * 6, fw2 = Math.sin(t * 2.3 + 1) * 8;
  ctx.save(); ctx.fillStyle = NP.tilePattern(ctx, NP.khanTile(), 22);
  for (const [dx, dy, ww] of [[-150 + fw, 6, 20], [-140 + fw2, 30, 16]]) {
    ctx.beginPath(); ctx.moveTo(-100, -54); ctx.quadraticCurveTo(-126, -40, dx, dy); ctx.lineTo(dx + ww * 0.8, dy + 6); ctx.quadraticCurveTo(-112, -30, -96, -40); ctx.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke(); ctx.fill();
  }
  ell(ctx, -102, -48, 16, 14); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke(); ctx.fill();
  ctx.restore();
  // brows
  const by = -40 - br * 8;
  ctx.strokeStyle = CB_COL.hair; ctx.lineWidth = 10;
  for (const sx of [-1, 1]) {
    const ox = sx * 37 + fx, tilt = (ex === 'focus' ? 6 : 0) - br * 3;
    ctx.beginPath(); ctx.moveTo(ox - sx * 20, by + tilt * 0.6); ctx.quadraticCurveTo(ox, by - 7, ox + sx * 21, by + 3 - tilt * 0.2); ctx.stroke();
  }
  // eyes
  const lx = (o.lookX || 0) * 5, ly = (o.lookY || 0) * 3;
  for (const sx of [-1, 1]) {
    const exx = sx * 36 + fx, ey = -12;
    const closed = ex === 'laugh' || (ex === 'wink' && sx < 0);
    if (closed) {
      ctx.strokeStyle = '#24160f'; ctx.lineWidth = 5; ctx.beginPath();
      if (ex === 'laugh') { ctx.moveTo(exx - 14, ey + 2); ctx.quadraticCurveTo(exx, ey - 12, exx + 14, ey + 2); } else { ctx.moveTo(exx - 14, ey); ctx.quadraticCurveTo(exx, ey + 7, exx + 14, ey); }
      ctx.stroke(); continue;
    }
    const ry = ex === 'grin' || ex === 'wink' ? 5 : ex === 'focus' ? 6 : ex === 'o' ? 10 : 8;
    ctx.beginPath(); ctx.moveTo(exx - 16, ey); ctx.quadraticCurveTo(exx, ey - ry * 1.6, exx + 16, ey); ctx.quadraticCurveTo(exx, ey + ry * 1.1, exx - 16, ey); ctx.closePath();
    ctx.fillStyle = '#f1e6d6'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#3a2416'; ell(ctx, exx + lx, ey - 1 + ly, 7.5, 8); ctx.fill();
    ctx.fillStyle = '#0d0907'; ell(ctx, exx + lx, ey - 1 + ly, 3.6, 3.8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(ctx, exx + lx + 2.5, ey - 4 + ly, 2, 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#24160f'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(exx - 17, ey + 1); ctx.quadraticCurveTo(exx, ey - ry * 1.7, exx + 17, ey + 1); ctx.stroke();
  }
  // crow's feet
  ctx.strokeStyle = 'rgba(95,50,28,0.55)'; ctx.lineWidth = 2.2;
  for (const sx of [-1, 1]) for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx * 58 + fx, -12 + i * 6); ctx.lineTo(sx * 68 + fx, -14 + i * 9); ctx.stroke(); }
  // nose
  const nx = fx * 1.3;
  ctx.strokeStyle = 'rgba(95,50,28,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(nx + 4, -6); ctx.quadraticCurveTo(nx + 8, 12, nx + 12, 22); ctx.stroke();
  ctx.fillStyle = 'rgba(120,62,35,0.35)'; ell(ctx, nx, 28, 19, 10); ctx.fill();
  ctx.fillStyle = 'rgba(60,28,16,0.7)'; ell(ctx, nx - 8, 31, 4.5, 3); ctx.fill(); ell(ctx, nx + 8, 31, 4.5, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,180,0.4)'; ell(ctx, nx + 4, 20, 5, 4); ctx.fill();
  // nasolabial folds
  ctx.strokeStyle = 'rgba(95,50,28,0.45)'; ctx.lineWidth = 2.6;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 24 + fx, 34); ctx.quadraticCurveTo(sx * 40 + fx, 52, sx * 36 + fx, ex === 'laugh' || ex === 'grin' ? 70 : 66); ctx.stroke(); }
  // mouth
  const my = 72, mx = fx;
  if (ex === 'grin' || ex === 'wink') {
    ctx.beginPath(); ctx.moveTo(mx - 30, my - 6); ctx.quadraticCurveTo(mx, my + 26, mx + 30, my - 6); ctx.quadraticCurveTo(mx, my + 2, mx - 30, my - 6); ctx.closePath();
    outFill(ctx, '#4a1a16', 2.4); ctx.save(); ctx.clip(); ctx.fillStyle = '#f4ecdc'; ctx.fillRect(mx - 30, my - 8, 60, 10); ctx.restore();
  } else if (ex === 'laugh') {
    ctx.beginPath(); ctx.moveTo(mx - 34, my - 10); ctx.quadraticCurveTo(mx, my + 52, mx + 34, my - 10); ctx.quadraticCurveTo(mx, my - 2, mx - 34, my - 10); ctx.closePath();
    outFill(ctx, '#521a17', 2.4); ctx.save(); ctx.clip(); ctx.fillStyle = '#f4ecdc'; ctx.fillRect(mx - 34, my - 12, 68, 11); ctx.fillStyle = '#c4554c'; ell(ctx, mx, my + 30, 16, 10); ctx.fill(); ctx.restore();
  } else if (ex === 'talk') {
    const h = 4 + Math.abs(Math.sin(t * 14)) * 12; ell(ctx, mx, my, 14, h); outFill(ctx, '#4a1a16', 2.4);
  } else if (ex === 'o') {
    ell(ctx, mx, my + 2, 10, 13); outFill(ctx, '#4a1a16', 2.4);
  } else if (ex === 'neutral' || ex === 'focus') {
    ctx.strokeStyle = '#4a2018'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx - (ex === 'focus' ? 14 : 20), my); ctx.lineTo(mx + (ex === 'focus' ? 14 : 20), my + 1); ctx.stroke();
  } else { // smile
    ctx.strokeStyle = '#4a2018'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(mx - 26, my - 4); ctx.quadraticCurveTo(mx, my + 16, mx + 26, my - 4); ctx.stroke();
  }
  // thin moustache
  ctx.strokeStyle = CB_COL.hair; ctx.lineWidth = 5;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx + sx * 4, 47); ctx.quadraticCurveTo(mx + sx * 22, 45, mx + sx * 38, 58); ctx.stroke(); }
  // cheeks
  ctx.fillStyle = 'rgba(205,90,65,0.22)'; ell(ctx, -54 + fx, 30, 18, 11); ctx.fill(); ell(ctx, 54 + fx, 30, 18, 11); ctx.fill();
  // head torch on the khăn
  if (o.lamp) {
    const lx0 = fx * 1.2, ly0 = -56;
    ctx.strokeStyle = '#22232a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-96, -50); ctx.quadraticCurveTo(0, -86, 96, -50); ctx.stroke();
    NP.rrect(ctx, lx0 - 20, ly0 - 16, 40, 28, 7); outFill(ctx, '#2a2b31', 2.4);
    ctx.fillStyle = '#4a4c55'; ctx.fillRect(lx0 - 16, ly0 - 13, 32, 4);
    ell(ctx, lx0, ly0 - 1, 10, 9); ctx.fillStyle = o.lampOn === false ? '#8a8a80' : '#fffbe6'; ctx.fill();
    if (o.lampOn !== false) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, lx0, ly0, 0, lx0, ly0, 46, [[0, 'rgba(255,248,220,0.9)'], [1, 'rgba(255,240,200,0)']]); ctx.fillRect(lx0 - 46, ly0 - 46, 92, 92); ctx.restore(); }
  }
}

// ================================================================================================= CHÚ BA pose solver
// returns the rig in FIGURE units (origin feet, facing +x, y up negative).
function cbPose(o) {
  const pose = o.pose || 'stand', t = o.t || 0, k = clamp(o.k ?? 0.5);
  const P = {
    pose, hip: [0, -252], lean: 0, shUp: 0, footL: [-22, 0], footR: [24, 0], knee: 'fwd',
    hL: [-62, -232], hR: [66, -232], kL: 'open', kR: 'open', rL: PI / 2 + 0.15, rR: PI / 2 - 0.15, flipL: false, flipR: true,
    elL: 'out', elR: 'out', expr: 'smile', tilt: 0, turn: 0.35, lookX: 0.4, lookY: 0, brow: 0, lateHands: false,
    under: 0, back: null, front: null, hold: null, flame: null, ex: {},
  };
  const idle = Math.sin(t * 2.1);
  P.hip[1] += idle * 1.5;
  const gait = (amp = 46, lift = 18) => {
    const ph = t * TAU * (o.speed ?? 0.7), sw = Math.sin(ph);
    P.footL = [-14 + amp * sw, -Math.max(0, Math.cos(ph)) * lift];
    P.footR = [18 - amp * sw, -Math.max(0, -Math.cos(ph)) * lift];
    P.hip = [sw * 4, -250 - Math.abs(Math.cos(ph)) * 5];
    return sw;
  };
  const squat = () => { P.hip = [-20, -112]; P.footL = [-10, 0]; P.footR = [44, 0]; P.knee = 'up'; P.lean = 0.3; };
  switch (pose) {
    case 'wade': {
      const sw = gait();
      P.lean = 0.1; P.hL = [-58 - 26 * sw, -238]; P.hR = [68 + 26 * sw, -238]; P.rL = PI / 2 + 0.2 + sw * 0.2; P.rR = PI / 2 - 0.2 - sw * 0.2;
      P.lookY = 0.5; P.turn = 0.45;
      if (o.trap) {
        P.hR = [100, -336]; P.kR = 'grip'; P.rR = -PI / 2 + 0.2; P.flipR = false; P.lateHands = true; P.elR = 'down';
        const ts = 0.5;
        P.front = (c) => { P.ex.trapF = trapDraw(c, 104, -336 + 420 * ts + 12, ts, { t, k: 0 }); };
      }
      break;
    }
    case 'trapDown': {
      const e = ease.inOut(k), ts = 0.57, top = lerp(-400, -196, e), base = top + 420 * ts;
      P.lean = 0.08 + 0.25 * e; P.hip = [0, -252 + 34 * e];
      P.hL = [124, top + 8]; P.hR = [176, top + 8]; P.kL = P.kR = 'grip'; P.rL = PI / 2 + 0.3; P.rR = PI / 2 - 0.3; P.flipL = true; P.flipR = false;
      P.lateHands = true; P.expr = e > 0.85 ? 'grin' : 'focus'; P.lookY = 1; P.lookX = 0.6; P.brow = -0.5;
      P.front = (c) => { const r = trapDraw(c, 150, base, ts, { t, k: o.trapSub ?? 0, inside: o.inside }); P.ex.trapF = r; };
      break;
    }
    case 'skewer': {
      const Lf = 180, fs = Lf / 520, cx = -112, cy = -300, mouthX = cx + Lf / 2;
      let p, g;
      if (k < 0.45) { p = lerp(0, 100, ease.inOut(k / 0.45)); g = 210; } else if (k < 0.55) { p = 100; g = lerp(210, 240, ease.inOut((k - 0.45) / 0.1)); } else { p = lerp(100, 210, ease.inOut((k - 0.55) / 0.45)); g = 240; }
      const tipX = mouthX - p;
      P.lean = 0.04; P.hL = [cx - 6, cy + 18]; P.kL = 'grip'; P.rL = -PI / 2 + 0.1; P.flipL = false;
      P.hR = [tipX + g, cy + 4]; P.kR = 'grip'; P.rR = PI + 0.15; P.flipR = true; P.elR = 'down'; P.elL = 'down';
      P.lateHands = true; P.expr = 'focus'; P.lookY = 0.6; P.lookX = 0.2; P.turn = 0.25; P.brow = -0.4;
      P.front = (c) => {
        P.ex.fishF = fishDraw(c, cx, cy, fs, { state: 'skewered', skewerA: (300 - p) / fs, skewerB: (p - Lf) / fs, t, rim: 0.6, wiggle: 0 });
        P.ex.stickF = { tip: [tipX, cy], end: [tipX + 300, cy] };
      };
      break;
    }
    case 'carryStraw': {
      if (o.walk) gait(34, 12);
      P.lean = 0.06; P.hL = [-24, -282]; P.hR = [116, -286]; P.kL = 'flat'; P.kR = 'flat'; P.rL = -0.2; P.rR = PI + 0.3; P.flipL = false; P.flipR = true;
      P.expr = o.expr || 'smile'; P.lookX = 0.7;
      P.mid = (c) => { P.ex.strawF = strawDraw(c, 44, -300, 0.55, { t, seed: o.seed ?? 7, rot: 0.04 }); };
      P.lateHands = true;
      break;
    }
    case 'light': {
      squat();
      const la = o.lightAt ? (Array.isArray(o.lightAt) && o.lightFig ? o.lightAt : null) : null;
      const h = la || o._lightFig || [118, -206];
      P.hL = [h[0] - 16, h[1] + 8]; P.hR = [h[0] + 22, h[1] - 2]; P.elL = 'down'; P.elR = 'down'; P.kL = 'grip'; P.kR = 'flat'; P.rL = -PI / 2 + 0.4; P.rR = PI + 0.6; P.flipL = false; P.flipR = true;
      P.lateHands = true; P.expr = o.expr || 'smile'; P.lookY = 1; P.lookX = 0.8; P.turn = 0.4;
      const fk = o.flame ?? 1;
      P.flame = { at: [h[0] - 14, h[1] - 22], k: fk }; P.under = 0.9 * fk;
      P.hold = (c) => { // lighter body in the left fist
        NP.rrect(c, h[0] - 24, h[1] - 18, 18, 30, 4); outFill(c, '#c0392b', 2);
        c.fillStyle = '#b9bcc4'; c.fillRect(h[0] - 23, h[1] - 22, 16, 6);
      };
      break;
    }
    case 'squat': squat(); P.expr = o.expr || 'smile'; break;
    case 'scrape': {
      squat();
      const hs = [40, -214], aim = [262, -122], d = norm(sub(aim, hs)), a = Math.atan2(d[1], d[0]), Lf = 180, fs = Lf / 520;
      const fc = add(hs, mulv(d, 150)), nrm = [d[1], -d[0]]; // nrm points up-right (top side of the fish)
      const ph = (t * 1.5) % 1, stroke = ease.inOut(Math.min(1, ph / 0.7)), u = lerp(-0.42, 0.4, stroke);
      const bp = add(add(fc, mulv(d, u * Lf)), mulv(nrm, 30));
      P.hL = hs; P.kL = 'grip'; P.rL = a - PI / 2; P.flipL = false;
      P.hR = add(bp, mulv(nrm, 22)); P.kR = 'grip'; P.rR = a + PI / 2 + 0.3; P.flipR = false; P.elR = 'down';
      P.lateHands = true; P.expr = o.expr || 'focus'; P.lookY = 1; P.lookX = 0.7; P.turn = 0.4;
      const sk = o.scrape ?? k;
      P.front = (c) => {
        P.ex.fishF = fishDraw(c, fc[0], fc[1], fs, { rot: a, flip: true, state: 'scraped', k: sk, skewerA: 60 / fs, skewerB: 30 / fs, t, rim: 0.5 });
        // knife: blade along the fish surface
        at(c, bp[0], bp[1], a, 1, 1, () => {
          c.beginPath(); c.moveTo(-34, -4); c.lineTo(30, -6); c.quadraticCurveTo(40, -2, 30, 4); c.lineTo(-34, 4); c.closePath(); outFill(c, '#d9dde2', 1.6);
          c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-30, -4, 56, 2);
        });
        const hp = add(bp, mulv(nrm, 22)); capFS(c, bp[0] + nrm[0] * 4, bp[1] + nrm[1] * 4, hp[0], hp[1], 9, 9, '#5a3a22', 1.6);
        P.ex.bladeF = bp;
      };
      break;
    }
    case 'laugh': {
      const b = Math.abs(Math.sin(t * 10)) * 6;
      P.hip = [0, -252 + b]; P.lean = -0.08; P.hL = [6, -300 + b]; P.kL = 'flat'; P.rL = -0.1; P.flipL = false;
      P.hR = [62, -208 + Math.sin(t * 12) * 14 + b]; P.kR = 'flat'; P.rR = PI / 2 + 0.6; P.flipR = true;
      P.expr = 'laugh'; P.tilt = -0.18 + Math.sin(t * 10) * 0.03; P.turn = 0.2;
      break;
    }
    case 'offer': {
      P.lean = 0.12; P.kR = 'flat'; P.rR = -0.08; P.flipR = false; P.elR = 'down';
      P.hR = o._offerFig || [190, -330];
      P.kL = 'flat'; P.rL = -0.3; P.flipL = false; P.elL = 'down';
      P.expr = o.expr || 'grin'; P.lookX = 0.8; P.turn = 0.45; P.lateHands = true; P.underElbow = true;
      P.hold = (c, hr) => {
        const it = o.item || (o.hold ? null : 'roll');
        if (o.hold) o.hold(c, hr, 0);
        else if (it === 'roll') P.ex.itemF = rollDraw(c, hr[0] + 34, hr[1] - 22, 0.36, { stage: 'rolled', k: 1, rot: -0.08, t, steam: 0.6 });
        else if (it === 'fish') P.ex.itemF = fishDraw(c, hr[0] + 30, hr[1] - 26, 0.3, { state: 'scraped', k: 1, t, rot: -0.05 });
        P.ex.offerF = [hr[0] + 34, hr[1] - 24];
      };
      break;
    }
    case 'shrug': {
      P.shUp = -14; P.hL = [-124, -300]; P.hR = [128, -300]; P.kL = P.kR = 'open'; P.rL = PI + 0.2; P.rR = -0.2; P.flipL = true; P.flipR = false;
      P.elL = P.elR = 'down'; P.tilt = 0.12; P.brow = 1; P.expr = o.expr || 'smile'; P.turn = 0.15; P.lookX = 0;
      break;
    }
    case 'catchBasket': {
      P.hip = [0, -226]; P.lean = 0.15; const bx = 136, by = -182, bs = 0.55;
      P.hL = [bx - 74, by - 70]; P.hR = [bx + 74, by - 74]; P.kL = P.kR = 'grip'; P.rL = PI / 2 + 0.2; P.rR = PI / 2 - 0.2; P.flipL = true; P.flipR = false;
      P.elL = P.elR = 'down'; P.lateHands = true; P.expr = o.expr || 'grin'; P.lookY = -0.6; P.lookX = 0.6; P.brow = 0.8;
      P.front = (c) => { P.ex.basketF = basketDraw(c, bx, by, bs, { t, fish: o.basketFish ?? 0 }); };
      break;
    }
    case 'sit': {
      P.hip = [-40, -40]; P.footL = [140, 0]; P.footR = [112, 0]; P.knee = 'up'; P.lean = 0.12;
      P.handsOnKnees = true; P.expr = o.expr || 'smile'; P.turn = 0.35;
      break;
    }
    case 'thumbs': {
      P.hL = [-72, -372 + Math.sin(t * 8) * 3]; P.kL = 'thumb'; P.rL = PI - 0.15; P.flipL = true;
      P.hR = [82, -372 + Math.sin(t * 8 + 1) * 3]; P.kR = 'thumb'; P.rR = 0.15; P.flipR = false;
      P.elL = P.elR = 'down'; P.expr = o.wink ? 'wink' : 'grin'; P.turn = 0.15; P.lookX = 0;
      break;
    }
    default: break;
  }
  if (o.expr) P.expr = o.expr;
  if (o.turn !== undefined) P.turn = o.turn;
  if (o.tilt !== undefined) P.tilt = o.tilt;
  if (o.lookX !== undefined) P.lookX = o.lookX;
  if (o.lookY !== undefined) P.lookY = o.lookY;
  if (o.under !== undefined) P.under = o.under;
  if (o.lean) P.lean += o.lean;
  return P;
}

// ================================================================================================= CHÚ BA full figure
function chuBa(ctx, x, y, s = 1, o = {}) {
  const fl = o.flip ? -1 : 1, t = o.t || 0;
  const toL = (p) => [x + p[0] * s * fl, y + p[1] * s];
  const toF = (p) => [(p[0] - x) / (s * fl), (p[1] - y) / s];
  const o2 = Object.assign({}, o);
  if (o.pose === 'offer' && o.offerAt) o2._offerFig = toF(o.offerAt);
  if (o.pose === 'light' && o.lightAt) o2._lightFig = toF(o.lightAt);
  const P = cbPose(o2);
  // rig
  const R = (p) => add(P.hip, rot2(p, P.lean));
  const shL = R([-46, -148 + P.shUp]), shR = R([46, -148 + P.shUp]);
  P.hL = clampTo(P.hL, shL, 172); P.hR = clampTo(P.hR, shR, 172);
  const elbow = (sh, h, mode, side) => (mode === 'down' ? ikUp(sh[0], sh[1], h[0], h[1], 92, 84, 1) : ikPick(sh[0], sh[1], h[0], h[1], 92, 84, side));
  const elR = elbow(shR, P.hR, P.elR, 1);
  if (P.underElbow) P.hL = clampTo([elR[0] - 4, elR[1] + 16], shL, 172);
  const elL = elbow(shL, P.hL, P.elL, -1);
  const legs = [[P.footL, -1], [P.footR, 1]].map(([f, sd]) => {
    const hj = R([sd * 24, 14]), an = [f[0], f[1] - 14];
    const dd = Math.hypot(an[0] - hj[0], an[1] - hj[1]), an2 = dd > 226 ? add(hj, mulv(sub(an, hj), 226 / dd)) : an;
    const kn = P.knee === 'up' ? ikUp(hj[0], hj[1], an2[0], an2[1], 115, 113, -1) : ikPick(hj[0], hj[1], an2[0], an2[1], 115, 113, 1);
    return { f, hj, an: an2, kn };
  });
  if (P.handsOnKnees) {
    P.hL = clampTo(add(legs[0].kn, [-4, -10]), shL, 172); P.hR = clampTo(add(legs[1].kn, [4, -14]), shR, 172);
    P.kL = P.kR = 'flat'; P.rL = 0.5; P.rR = 0.4; P.flipL = P.flipR = false;
  }
  if (pose2(P, 'squat')) {
    P.hL = clampTo(add(legs[0].kn, [16, 46]), shL, 172); P.hR = clampTo(add(legs[1].kn, [20, 52]), shR, 172);
    P.rL = PI / 2 - 0.2; P.rR = PI / 2 - 0.4;
  }
  const elL2 = P.handsOnKnees || pose2(P, 'squat') ? elbow(shL, P.hL, 'out', -1) : elL;
  const elR2 = P.handsOnKnees || pose2(P, 'squat') ? elbow(shR, P.hR, 'out', 1) : elR;
  const headC = R([4, -202]), hRot = P.lean + P.tilt, fx = P.turn * 18;
  const headPt = (p) => add(headC, rot2(mulv(p, HS), hRot));
  // lighting
  const post = [];
  let fire = o.fireLight ? Object.assign({ r: 700 * s }, o.fireLight) : null;
  if (P.flame && !fire) { const fp = toL(P.flame.at); fire = { x: fp[0], y: fp[1], k: 0.55 * P.flame.k, r: 280 * s }; }
  const wl = o.waterline;
  const hw = (/^(stand|wade|laugh|shrug|thumbs|sit|squat)$/.test(o.pose || "stand") && !o.trap) ? 340 : 470; // tighter box = cheaper nightLit
  const box = [x - hw * s, y - 640 * s, x + hw * s, y + 90 * s];
  const ex = {};
  E.nightLit(ctx, (c) => {
    c.save(); c.translate(x, y); c.scale(s * fl, s); c.lineCap = 'round'; c.lineJoin = 'round';
    if (wl === undefined || wl === null) { c.fillStyle = 'rgba(5,8,18,0.35)'; ell(c, (P.footL[0] + P.footR[0]) / 2, 2, 110, 14); c.fill(); }
    if (P.back) P.back(c);
    // legs
    for (const g of legs) {
      const cuffP = lerpP(g.kn, g.an, 0.42), dir = norm(sub(g.an, g.kn));
      capFS(c, cuffP[0], cuffP[1], g.an[0], g.an[1], 26, 20, SKB[1]);
      const f = g.f; capFS(c, f[0] - 14, f[1] - 10, f[0] + 38, f[1] - 6, 23, 16, SKB[1], 2.2);
      c.fillStyle = SKB[1]; c.strokeStyle = OUT; c.lineWidth = 1.6; for (let i = 0; i < 4; i++) { ell(c, f[0] + 44, f[1] - 12 + i * 3.5, 4, 3); c.stroke(); c.fill(); }
      c.beginPath(); NP.capPath(c, g.hj[0], g.hj[1], g.kn[0], g.kn[1], 52, 46); NP.capPath(c, g.kn[0], g.kn[1], cuffP[0], cuffP[1], 46, 43);
      c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(); c.fillStyle = CB_COL.trousers; c.fill(); // one silhouette, no knee seam
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.beginPath(); const kq = lerpP(g.kn, cuffP, 0.15); c.moveTo(kq[0] - 12, kq[1] - 4); c.quadraticCurveTo(kq[0], kq[1] + 4, kq[0] + 14, kq[1] - 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); NP.capPath(c, g.hj[0] - 8, g.hj[1], g.kn[0] - 8, g.kn[1], 14, 12); c.fill();
      const c0 = sub(cuffP, mulv(dir, 10)), c1 = add(cuffP, mulv(dir, 4)); // flat rolled cuff (butt caps, no round lumps)
      c.lineCap = 'butt'; c.beginPath(); c.moveTo(c0[0], c0[1]); c.lineTo(c1[0], c1[1]); c.strokeStyle = OUT; c.lineWidth = 52; c.stroke(); c.strokeStyle = CB_COL.cuff; c.lineWidth = 47; c.stroke(); c.lineCap = 'round';
    }
    // body frame
    c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean);
    NP.rrect(c, -46, -4, 92, 46, 18); outFill(c, CB_COL.trousers, 2.4);
    c.restore();
    const arm = (sh, el, h) => {
      cArm(c, sh[0], sh[1], el[0], el[1], h[0], h[1], { skin: SKB, wu: [23, 20], wf: [19, 16], sleeve: CB_COL.shirt, sleeveTo: 0.84 });
      // rolled sleeve: flat band (butt caps) instead of a round blob
      const a0 = lerpP(sh, el, 0.72), a1 = lerpP(sh, el, 0.88);
      c.save(); c.lineCap = 'butt'; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]);
      c.strokeStyle = OUT; c.lineWidth = 34; c.stroke(); c.strokeStyle = CB_COL.shirtL; c.lineWidth = 30; c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; const am = lerpP(a0, a1, 0.5), an = norm([a1[1] - a0[1], a0[0] - a1[0]]);
      c.beginPath(); c.moveTo(am[0] + an[0] * 14, am[1] + an[1] * 14); c.lineTo(am[0] - an[0] * 14, am[1] - an[1] * 14); c.stroke(); c.restore();
    };
    // torso
    c.save(); c.translate(P.hip[0], P.hip[1]); c.rotate(P.lean);
    const su = P.shUp;
    const tor = new Path2D();
    tor.moveTo(-18, -154 + su); tor.quadraticCurveTo(-44, -156 + su, -56, -142 + su); tor.lineTo(-58, -40); tor.lineTo(-61, 36);
    tor.quadraticCurveTo(-30, 42, -3, 38); tor.lineTo(3, 38); tor.quadraticCurveTo(30, 42, 61, 36); tor.lineTo(58, -40); tor.lineTo(56, -142 + su);
    tor.quadraticCurveTo(44, -156 + su, 18, -154 + su); tor.closePath();
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke(tor);
    c.fillStyle = lgr(c, -60, 0, 60, 0, [[0, CB_COL.shirtL], [0.5, CB_COL.shirt], [1, CB_COL.shirtD]]); c.fill(tor);
    c.save(); c.clip(tor);
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(4, -138 + su); c.lineTo(6, 38); c.stroke(); // placket
    c.beginPath(); c.moveTo(-50, -10); c.lineTo(-20, -12); c.lineTo(-20, 18); c.lineTo(-50, 20); c.stroke(); // pockets
    c.beginPath(); c.moveTo(18, -12); c.lineTo(48, -10); c.lineTo(48, 20); c.lineTo(18, 18); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-40 + i * 30, -120); c.quadraticCurveTo(-30 + i * 30, -60, -36 + i * 30, 10); c.stroke(); }
    c.fillStyle = '#c9c4b8'; for (const by of [-128, -98, -68, -38, -8]) { ell(c, 7, by + su * (by < -100 ? 1 : 0), 2.6, 2.6); c.fill(); }
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2; for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 59, 12); c.lineTo(sx * 61, 36); c.stroke(); }
    // neck + collar
    capFS(c, 0, -146 + su, 3, -176 + su, 32, 30, SKB[1], 2.2);
    c.fillStyle = 'rgba(80,40,22,0.35)'; ell(c, 1, -150 + su, 15, 5); c.fill();
    c.strokeStyle = CB_COL.shirtL; c.lineWidth = 4; c.beginPath(); c.moveTo(-19, -153 + su); c.quadraticCurveTo(2, -136 + su, 21, -153 + su); c.stroke();
    c.restore();
    // head
    c.save(); c.translate(headC[0], headC[1]); c.rotate(hRot); c.scale(HS, HS);
    cbHead(c, { t, expr: P.expr, turn: P.turn, lookX: P.lookX, lookY: P.lookY, brow: P.brow, under: P.under, lamp: !!o.torch, lampOn: o.lampOn });
    c.restore();
    // hip basket
    if (o.basket) { const bp = R([-60, 34]); c.strokeStyle = '#6a4a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(bp[0] - 10, bp[1] - 52); c.lineTo(R([-30, -6])[0], R([-30, -6])[1]); c.stroke(); const r = basketDraw(c, bp[0], bp[1] + 16, 0.24, { t, fish: o.basketFish ?? 0 }); ex.basketMouth = toL(r.mouth); }
    if (P.mid) P.mid(c);
    arm(shL, elL2, P.hL); arm(shR, elR2, P.hR);
    if (P.front) P.front(c);
    const hands = () => {
      cHand(c, P.hL[0], P.hL[1], 0.46, P.rL ?? NP.handRot(elL2[0], elL2[1], P.hL[0], P.hL[1]), { kind: P.kL, skin: SKB, flip: P.flipL });
      cHand(c, P.hR[0], P.hR[1], 0.46, P.rR ?? NP.handRot(elR2[0], elR2[1], P.hR[0], P.hR[1]), { kind: P.kR, skin: SKB, flip: P.flipR });
    };
    hands();
    if (P.hold) P.hold(c, P.hR);
    c.restore();
  }, { box, night: o.night ?? 0.3, fire, waterline: wl, sub: o.sub, ring: wl !== undefined && wl !== null ? { x, w: 78 * s, t } : null, reflect: o.reflect, t, rim: o.rim, moon: o.moon });
  // beams / flames in the caller ctx
  if (P.flame) { const fp = toL(P.flame.at); flameDraw(ctx, fp[0], fp[1], s, t, P.flame.k); ex.flame = fp; }
  if (o.torch) {
    const from = toL(headPt([fx * 1.2, -57]));
    const to = o.torchAt || add(from, mulv(norm([fl * 0.75, 0.65]), o.beamLen ?? 600 * s));
    if (o.beam !== false) E.torchBeam(ctx, from, to, { t, k: o.beamK ?? 1, w0: 8 * s, w1: o.beamW ?? 180 * s, motes: 14 });
    ex.torch = { from, dir: norm(sub(to, from)), to };
  }
  const X = P.ex;
  if (X.trapF) ex.trap = { top: toL(X.trapF.top), base: toL(X.trapF.base), rx: X.trapF.rx * s };
  if (X.fishF) { ex.fish = {}; for (const kk in X.fishF) { const v = X.fishF[kk]; ex.fish[kk] = Array.isArray(v) ? toL(v) : (typeof v === 'number' ? v * s : v); } }
  if (X.stickF) ex.stick = { tip: toL(X.stickF.tip), end: toL(X.stickF.end) };
  if (X.strawF) ex.straw = toL(X.strawF.center || [44, -300]);
  if (X.bladeF) ex.blade = toL(X.bladeF);
  if (X.basketF) ex.basket = { mouth: toL(X.basketF.mouth), bottom: toL(X.basketF.bottom) };
  if (X.offerF) ex.offer = toL(X.offerF);
  return Object.assign({
    head: toL(headC), face: { x: toL(headC)[0], y: toL(headC)[1], s: HS * s }, eyes: toL(headPt([fx, -12])), mouth: toL(headPt([fx, 72])),
    handL: toL(P.hL), handR: toL(P.hR), footL: toL(P.footL), footR: toL(P.footR), hip: toL(P.hip),
  }, ex);
}
function pose2(P, name) { return P.pose === name || (name === 'squat' && P.pose === 'squat'); }

// ================================================================================================= CHÚ BA close-up
function chuBaFace(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, tilt = o.tilt || 0, turn = o.turn || 0, fx = turn * 18;
  const hc = [x, y + 12 * s];
  const P = (p) => add(hc, rot2(mulv(p, s), tilt));
  let fire = o.fireLight ? Object.assign({ r: 900 * s }, o.fireLight) : null;
  E.nightLit(ctx, (c) => {
    c.save(); c.translate(x, y + 12 * s); c.scale(s, s); c.lineCap = 'round'; c.lineJoin = 'round';
    // shoulders (áo bà ba)
    const sh = new Path2D(); sh.moveTo(-60, 150); sh.quadraticCurveTo(-250, 160, -330, 270); sh.lineTo(-372, 720); sh.lineTo(372, 720); sh.lineTo(330, 270); sh.quadraticCurveTo(250, 160, 60, 150); sh.closePath();
    c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(sh); c.fillStyle = lgr(c, -340, 0, 340, 0, [[0, CB_COL.shirtL], [0.5, CB_COL.shirt], [1, CB_COL.shirtD]]); c.fill(sh);
    c.save(); c.clip(sh); c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 8; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-260 + i * 120, 260); c.quadraticCurveTo(-230 + i * 120, 460, -250 + i * 120, 720); c.stroke(); } c.restore();
    capFS(c, 0, 60, 4, 176, 104, 112, SKB[1], 4);
    c.fillStyle = 'rgba(70,35,20,0.35)'; ell(c, 0, 92, 70, 20); c.fill();
    c.strokeStyle = CB_COL.shirtL; c.lineWidth = 9; c.beginPath(); c.moveTo(-64, 156); c.quadraticCurveTo(4, 222, 70, 156); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 4; c.beginPath(); c.moveTo(6, 212); c.lineTo(10, 720); c.stroke();
    c.fillStyle = '#c9c4b8'; for (const by of [262, 362, 462, 562]) { ell(c, 18, by, 7, 7); c.fill(); }
    c.rotate(tilt);
    cbHead(c, { t, expr: o.expr || 'smile', turn, lookX: o.lookX ?? 0, lookY: o.lookY ?? 0, brow: o.brow || 0, under: o.under || 0, lamp: !!o.torch, lampOn: o.lampOn });
    c.restore();
  }, { box: [x - 440 * s, y - 330 * s, x + 440 * s, y + 740 * s], night: o.night ?? 0.28, fire, t, rim: o.rim, moon: o.moon, rimW: 6 });
  const ret = { eyes: P([fx, -12]), mouth: P([fx, 72]), lamp: P([fx * 1.2, -57]), top: P([0, -124]) };
  if (o.torch && o.beam !== false) { const to = o.torchAt || add(ret.lamp, mulv(norm([0.55, 0.85]), 700 * s)); E.torchBeam(ctx, ret.lamp, to, { t, w0: 16 * s, w1: 300 * s }); }
  return ret;
}

// ================================================================================================= FROG / EGRET
function frogRaw(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, pose = o.pose || 'sit', fl = o.flip ? -1 : 1;
  const sac = pose === 'ribbit' ? clamp(o.k ?? Math.abs(Math.sin(t * 10))) : clamp(o.k ?? 0) * (pose === 'sit' ? 0 : 1);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * fl, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const G = '#5f9a3e', GD = '#3f6e2a', BEL = '#d6e3a0';
  if (pose === 'jump') {
    ctx.rotate(-0.15);
    for (const sx of [-1, 1]) { capFS(ctx, sx * 12, -26, sx * 30, 8, 14, 9, G, 1.8); capFS(ctx, sx * 30, 8, sx * 22, 30, 9, 7, G, 1.6); capFS(ctx, sx * 14, -60, sx * 30, -84, 9, 7, G, 1.6); }
    ell(ctx, 0, -44, 22, 32); outFill(ctx, G, 2); ctx.fillStyle = BEL; ell(ctx, 0, -38, 13, 22); ctx.fill();
    for (const sx of [-1, 1]) { ell(ctx, sx * 13, -72, 9, 9); outFill(ctx, G, 1.8); ctx.fillStyle = '#f4d24a'; ell(ctx, sx * 13, -73, 6, 6); ctx.fill(); ctx.fillStyle = '#111'; ell(ctx, sx * 13, -73, 4.5, 2.2); ctx.fill(); }
    ctx.restore();
    return { eyes: [x, y - 72 * s], mouth: [x, y - 60 * s], top: [x, y - 84 * s] };
  }
  // back legs (folded)
  for (const sx of [-1, 1]) { ell(ctx, sx * 26, -12, 19, 12, sx * 0.3); outFill(ctx, GD, 1.8); ell(ctx, sx * 30, -2, 14, 5); outFill(ctx, G, 1.6); }
  // body
  ell(ctx, 0, -24, 30, 22); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = rgr(ctx, -8, -36, 2, 0, -24, 34, [[0, '#86c05a'], [0.6, G], [1, GD]]); ctx.fill();
  ctx.fillStyle = GD; for (const [px, py, r] of [[-14, -34, 4], [10, -38, 3.4], [18, -24, 3], [-20, -20, 3]]) { ell(ctx, px, py, r, r * 0.8); ctx.fill(); }
  ctx.fillStyle = BEL; ell(ctx, 0, -14, 17, 11); ctx.fill();
  if (sac > 0.05) { ell(ctx, 0, -12 + sac * 2, 10 + sac * 12, 7 + sac * 10); ctx.fillStyle = `rgba(236,232,170,${0.75})`; ctx.fill(); ctx.strokeStyle = 'rgba(120,120,60,0.6)'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -4, -16, 3 + sac * 3, 2 + sac * 2); ctx.fill(); }
  // front feet
  for (const sx of [-1, 1]) { capFS(ctx, sx * 12, -16, sx * 16, -2, 7, 6, G, 1.4); for (let i = -1; i <= 1; i++) { ell(ctx, sx * 16 + i * 4, -1, 2.4, 2); ctx.fillStyle = G; ctx.fill(); } }
  // eyes
  for (const sx of [-1, 1]) {
    ell(ctx, sx * 16, -42, 11, 10); outFill(ctx, G, 2);
    ctx.fillStyle = '#f4d24a'; ell(ctx, sx * 16, -43, 7.5, 7); ctx.fill();
    ctx.fillStyle = '#111'; ell(ctx, sx * 16, -43, 5.5, o.dazed ? 5 : 2.6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(ctx, sx * 16 + 2.5, -46, 1.8, 1.6); ctx.fill();
  }
  // mouth
  ctx.strokeStyle = '#2a4a1a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-17, -30); ctx.quadraticCurveTo(0, -24 + sac * 2, 17, -30); ctx.stroke();
  ctx.fillStyle = '#1f3a14'; ell(ctx, -4, -34, 1.2, 1); ctx.fill(); ell(ctx, 4, -34, 1.2, 1); ctx.fill();
  // wet shine
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(200,230,255,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -24, 26, -2.4, -1.2); ctx.stroke(); ctx.restore();
  ctx.restore();
  return { eyes: [x, y - 43 * s], mouth: [x, y - 28 * s], top: [x, y - 53 * s] };
}
function frog(ctx, x, y, s = 1, o = {}) {
  if (o.lit === false) return frogRaw(ctx, x, y, s, o);
  return E.nightLit(ctx, (c) => frogRaw(c, x, y, s, o), { box: [x - 70 * s, y - 100 * s, x + 70 * s, y + 40 * s], night: o.night ?? 0.25, fire: o.fireLight, rimW: 2.5, t: o.t, waterline: o.waterline, rim: o.rim });
}
function egretRaw(ctx, x, y, s, o) {
  const t = o.t || 0, fl = o.flip ? -1 : 1, W = '#f4f2ea', WD = '#c8ccd2';
  ctx.save(); ctx.translate(x, y); ctx.scale(s * fl, s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let head;
  if ((o.pose || 'stand') === 'fly') {
    for (const sd of [-1, 1]) { // far wing (darker, lags) then near wing; flap from up (+1) to down (-1)
      const fw = Math.sin(t * 7 + (sd < 0 ? 0.5 : 0)), tipY = -150 * fw, tipX = -46 + sd * 14;
      ctx.beginPath(); ctx.moveTo(-34, -4); ctx.quadraticCurveTo(-70, tipY * 0.55 - 10, tipX, tipY - 8);
      ctx.quadraticCurveTo(tipX + 40, tipY * 0.5, 34, -2); ctx.closePath();
      outFill(ctx, sd < 0 ? WD : W, 2.4);
      ctx.strokeStyle = 'rgba(150,160,175,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -4); ctx.quadraticCurveTo(-40, tipY * 0.45, tipX + 6, tipY * 0.9); ctx.stroke();
    }
    ell(ctx, 0, 0, 60, 18); outFill(ctx, W, 2);
    ctx.strokeStyle = W; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(50, -4); ctx.quadraticCurveTo(70, -10, 84, -6); ctx.stroke();
    head = [92, -6];
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-54, 6); ctx.lineTo(-120, 14); ctx.stroke();
  } else {
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-4, -110); ctx.moveTo(10, 0); ctx.lineTo(4, -110); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-22, 2); ctx.moveTo(10, 0); ctx.lineTo(24, 2); ctx.stroke();
    ctx.save(); ctx.translate(-6, -146); ctx.rotate(-0.35); ell(ctx, 0, 0, 56, 30); outFill(ctx, W, 2.2);
    ctx.beginPath(); ctx.moveTo(-50, 4); ctx.quadraticCurveTo(-90, 14, -96, 24); ctx.quadraticCurveTo(-70, 10, -40, 18); ctx.closePath(); outFill(ctx, W, 1.6);
    ctx.strokeStyle = WD; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, 2); ctx.quadraticCurveTo(0, 18, 34, 6); ctx.stroke(); ctx.restore();
    const bob = Math.sin(t * 1.3) * 3;
    ctx.strokeStyle = OUT; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(34, -160); ctx.bezierCurveTo(60, -186, 10, -208, 30, -238 + bob); ctx.stroke();
    ctx.strokeStyle = W; ctx.lineWidth = 11; ctx.stroke();
    head = [36, -244 + bob];
    ell(ctx, head[0], head[1], 13, 10); outFill(ctx, W, 2);
  }
  ctx.beginPath(); ctx.moveTo(head[0] + 8, head[1] - 4); ctx.lineTo(head[0] + 52, head[1] + 2); ctx.lineTo(head[0] + 8, head[1] + 5); ctx.closePath(); ctx.fillStyle = '#e8b832'; ctx.fill();
  ctx.fillStyle = '#111'; ell(ctx, head[0] + 4, head[1] - 2, 2.4, 2.4); ctx.fill();
  ctx.restore();
  return { head: [x + head[0] * s * fl, y + head[1] * s], beak: [x + (head[0] + 52) * s * fl, y + (head[1] + 2) * s] };
}
function egret(ctx, x, y, s = 1, o = {}) {
  if (o.lit === false) return egretRaw(ctx, x, y, s, o);
  return E.nightLit(ctx, (c) => egretRaw(c, x, y, s, o), { box: [x - 200 * s, y - 300 * s, x + 200 * s, y + 60 * s], night: o.night ?? 0.32, rimW: 3, t: o.t, waterline: o.waterline, reflect: o.reflect, rim: o.rim });
}

// ================================================================================================= NIGHT TOURIST
// lotus-leaf hat, face units (eyes y0; hair top ≈ −260)
function lotusHat(ctx, t = 0) {
  ctx.save(); ctx.lineJoin = 'round';
  const wob = Math.sin(t * 2) * 4;
  const p = new Path2D();
  p.moveTo(-238, -186 + wob); p.quadraticCurveTo(-210, -300, -10, -338); p.quadraticCurveTo(200, -308, 240, -190 - wob);
  p.quadraticCurveTo(186, -150, 118, -184); p.quadraticCurveTo(60, -146, 2, -178); p.quadraticCurveTo(-56, -146, -114, -182); p.quadraticCurveTo(-180, -146, -238, -186 + wob); p.closePath();
  ctx.strokeStyle = 'rgba(20,40,16,0.8)'; ctx.lineWidth = 7; ctx.stroke(p);
  ctx.fillStyle = lgr(ctx, -240, -330, 240, -160, [[0, '#7dbb52'], [0.5, '#4f8f36'], [1, '#2f6024']]); ctx.fill(p);
  ctx.save(); ctx.clip(p);
  ctx.strokeStyle = 'rgba(200,240,170,0.5)'; ctx.lineWidth = 4;
  for (const ex of [-230, -150, -70, 10, 90, 170, 236]) { ctx.beginPath(); ctx.moveTo(-6, -296); ctx.quadraticCurveTo(ex * 0.5, -260, ex, -170); ctx.stroke(); }
  ctx.fillStyle = 'rgba(20,50,20,0.25)'; ctx.fillRect(-260, -205, 520, 60);
  ctx.restore();
  ctx.fillStyle = '#9dd27a'; ell(ctx, -6, -296, 12, 9); ctx.fill();
  ctx.strokeStyle = '#4a7a2e'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -300); ctx.quadraticCurveTo(10, -340, 40, -350); ctx.stroke();
  for (const [dx, dy, r] of [[-120, -250, 10], [60, -270, 8], [150, -220, 12], [-40, -230, 7]]) {
    ctx.fillStyle = 'rgba(220,240,255,0.55)'; ell(ctx, dx, dy, r, r * 0.8); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(ctx, dx - r * 0.3, dy - r * 0.3, r * 0.3, r * 0.25); ctx.fill();
  }
  ctx.restore();
}
function wetDrips(ctx, t) { // face units
  ctx.save();
  ctx.strokeStyle = 'rgba(90,70,30,0.55)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  for (const [x0, len] of [[-120, 90], [-80, 120], [96, 100], [126, 70]]) { ctx.beginPath(); ctx.moveTo(x0, -150); ctx.quadraticCurveTo(x0 + 6, -150 + len * 0.6, x0 - 4, -150 + len); ctx.stroke(); }
  for (let i = 0; i < 7; i++) {
    const ph = (t * 1.3 + i * 0.37) % 1, xx = [-130, -96, -40, 30, 100, 132, 0][i], yy = [-60, 20, 120, 150, 10, -40, 210][i] + ph * 160;
    ctx.globalAlpha = 1 - ph; ctx.fillStyle = 'rgba(200,230,255,0.85)';
    ctx.beginPath(); ctx.moveTo(xx, yy - 14); ctx.quadraticCurveTo(xx + 7, yy, xx, yy + 7); ctx.quadraticCurveTo(xx - 7, yy, xx, yy - 14); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(190,220,255,0.5)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(-40, -160, 70, -2.6, -1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(60, -150, 60, -1.4, -0.8); ctx.stroke();
  ctx.restore();
}
function slapMark(ctx) { // face units, struck cheek (+x)
  ctx.save(); ctx.fillStyle = 'rgba(232,60,60,0.5)'; ctx.translate(80, 66); ctx.rotate(-0.4);
  ctx.beginPath(); ctx.moveTo(0, 30); ctx.quadraticCurveTo(-34, -10, -46, -44); ctx.quadraticCurveTo(-16, -24, 0, -34); ctx.quadraticCurveTo(16, -24, 46, -44); ctx.quadraticCurveTo(34, -10, 0, 30); ctx.fill();
  ctx.restore();
}
function dizzyStars(ctx, t, n = 4) { // face units, orbit above the head
  for (let i = 0; i < n; i++) {
    const a = t * 5 + i * TAU / n, px = Math.cos(a) * 200, py = -270 + Math.sin(a) * 44;
    const front = Math.sin(a) > 0;
    star5(ctx, px, py, front ? 70 : 50, a); ctx.fillStyle = front ? '#ffe45c' : '#d8b830'; ctx.fill(); ctx.strokeStyle = 'rgba(120,80,0,0.7)'; ctx.lineWidth = 4; ctx.stroke();
  }
}
function touristNight(ctx, x, y, s = 1, o = {}) {
  const pose = o.pose || 'stand', fl = o.flip ? -1 : 1, UT = NP.UT, t = o.t || 0, k = clamp(o.k ?? 0.5);
  const STAND = ['stand', 'phoneLight', 'rubHands', 'rollShorts', 'grab', 'slipped', 'slapped', 'wobble', 'fallBack', 'popUp', 'thumbs', 'split'];
  const NATIVE = ['sit', 'yawn', 'photo', 'point', 'sniff', 'rollBig', 'hug', 'cheer', 'split'];
  const standing = o.stand ?? STAND.includes(pose);
  const ox = x, oy = pose === 'popUp' ? y + 355 * s : y;
  const wl = o.waterline ?? (pose === 'popUp' ? y : undefined);
  const wet = o.wet ?? pose === 'popUp', hat = o.lotusHat ?? pose === 'popUp';
  const frogO = o.frog ? (typeof o.frog === 'object' ? o.frog : { pose: 'ribbit' }) : null;
  // lean (radians, + = forward) about the feet
  let lean = o.lean || 0;
  const e = ease.inOut(k);
  if (pose === 'rollShorts') lean += 0.22;
  else if (pose === 'grab') lean += 0.3 * e;
  else if (pose === 'slipped') lean += -0.35 * ease.out(k) + Math.sin(t * 9) * 0.05;
  else if (pose === 'slapped') lean += -0.08;
  else if (pose === 'wobble') lean += Math.sin(t * 6) * 0.18;
  else if (pose === 'fallBack') lean += -1.35 * ease.in(k);
  const sx = s * fl * UT, sy = s * UT, la = lean * fl;
  const rotAbout = (p, a) => { const c = Math.cos(a), sn = Math.sin(a), dx = p[0] - ox, dy = p[1] - oy; return [ox + dx * c - dy * sn, oy + dx * sn + dy * c]; };
  const toB = (p) => { const q = la ? rotAbout(p, -la) : p; return [(q[0] - ox) / sx, (q[1] - oy) / sy]; };
  const toL = (p) => { const q = [ox + p[0] * sx, oy + p[1] * sy]; return la ? rotAbout(q, la) : q; };
  const extra = {}, post = [];
  let C = ctx;
  const faceAt = (P, fn) => { C.save(); C.translate(0, P.FY); C.scale(0.18, 0.18); fn(); C.restore(); };
  const SK = PEOPLE.SKIN;
  const o2 = Object.assign({}, o, { vest: !!o.vest, pack: !!o.pack, stand: standing });
  delete o2.frog; delete o2.lean;
  o2.pose = NATIVE.includes(pose) ? pose : 'sit';
  if (pose === 'slipped') { o2.pose = 'split'; o2.footL = [-50, 0]; o2.footR = [70 + 40 * k, -60 * ease.out(k)]; }
  if (o.expr) { o2.face = Object.assign({}, NP.touristFaceOpts(o.expr, t), o.face || {}); delete o2.expr; }
  let pf = null;
  switch (pose) {
    case 'phoneLight': pf = (P) => {
      const hR = [70, P.SY + 44];
      return {
        hR, kR: 'grip', rR: -PI / 2 + 0.25, flipR: false, lateHands: true, face: { mouth: 'smile', turn: 0.3, lookX: 0.7, lookY: 0.4, brow: 0.3 },
        front: () => {
          at(C, hR[0] + 8, hR[1] - 22, 0.12, 1, 1, () => {
            NP.rrect(C, -13, -26, 26, 50, 5); outFill(C, '#1d1f24', 2);
            C.fillStyle = '#fffbe8'; ell(C, 6, -20, 3.4, 3.4); C.fill();
          });
          const from = toL([hR[0] + 16, hR[1] - 44]);
          const to = o.lightAt || add(from, mulv(norm([0.85 * fl, 0.5]), 520 * s));
          extra.light = { from, dir: norm(sub(to, from)), to };
          post.push(() => E.torchBeam(ctx, from, to, { t, k: o.lightK ?? 1, w0: 4 * s, w1: 110 * s, col: '235,245,255', motes: 10, seed: 9 }));
        },
      };
    }; break;
    case 'rubHands': pf = (P) => { const c = Math.sin(t * 18); return { hL: [-6, P.SY + 54 + c * 9], kL: 'flat', rL: -PI / 2 + 0.35, flipL: false, hR: [10, P.SY + 54 - c * 9], kR: 'flat', rR: -PI / 2 - 0.35, flipR: true, face: { mouth: 'grin', mOpen: 0.5, brow: 0.9, lookX: 0.5, turn: 0.2, blush: 0.6 } }; }; break;
    case 'rollShorts': pf = (P) => {
      const yy = P.hipY + 26 - 18 * e;
      return {
        hL: [-46, yy], kL: 'pinch', rL: PI / 2 + 0.3, flipL: true, hR: [48, yy], kR: 'pinch', rR: PI / 2 - 0.3, flipR: false, face: { mouth: 'smile', lookY: 1, turn: 0.1, brow: 0.4 }, tilt: 0.12,
        behind: () => { for (const sxx of [-1, 1]) { NP.rrect(C, sxx * 30 - 22, yy - 6, 44, 13, 6); outFill(C, '#c9ae7a', 2); } },
      };
    }; break;
    case 'grab': pf = (P) => {
      const g = o.grabAt ? toB(o.grabAt) : [150, P.SY + 120], cl = k > 0.8;
      const hL = clampTo([g[0] - 14, g[1] + 4], P.shL, 152), hR = clampTo([g[0] + 12, g[1] - 4], P.shR, 152);
      extra.grab = toL([(hL[0] + hR[0]) / 2, (hL[1] + hR[1]) / 2]);
      return { hL, hR, kL: cl ? 'grip' : 'open', kR: cl ? 'grip' : 'open', rL: Math.atan2(g[1] - P.shL[1], g[0] - P.shL[0]), rR: Math.atan2(g[1] - P.shR[1], g[0] - P.shR[0]), flipL: true, flipR: false, face: { mouth: 'o', mOpen: 0.8, brow: 1, pupil: 1.2, lookX: 0.8, lookY: 0.5, turn: 0.35 } };
    }; break;
    case 'slipped': pf = () => ({ face: Object.assign(NP.touristFaceOpts('panic', t), { lookY: -0.5 }) }); break;
    case 'slapped': pf = (P) => ({
      hL: [-80, P.SY + 110], kL: 'open', rL: PI / 2 + 0.6, hR: [86, P.SY + 96], kR: 'open', rR: PI / 2 - 0.8,
      face: { turn: -0.75, mouth: 'o', mOpen: 0.45, pupil: 0.5, open: 0.55, brow: -0.2, lookX: -0.6, blush: 0.2 }, tilt: 0.2,
      front: () => faceAt(P, () => { C.save(); C.rotate(0.2); slapMark(C); C.restore(); dizzyStars(C, t); }),
    }); break;
    case 'wobble': pf = (P) => { const w = Math.sin(t * 6); return { hL: [-150, P.SY + 6 + w * 22], kL: 'open', rL: PI + 0.1, flipL: true, hR: [152, P.SY + 6 - w * 22], kR: 'open', rR: -0.1, face: { mouth: 'o', mOpen: 0.6, brow: 1.1, pupil: 0.8, lookY: 0.6 }, tilt: -w * 0.1 }; }; break;
    case 'fallBack': pf = (P) => ({ hL: [-96, P.SY - 120], kL: 'open', rL: -PI / 2 - 0.5, flipL: true, hR: [104, P.SY - 128], kR: 'open', rR: -PI / 2 + 0.5, face: NP.touristFaceOpts('panic', t) }); break;
    case 'popUp': pf = (P) => ({
      hL: [-60, P.SY + 110], hR: [60, P.SY + 110], kL: 'open', kR: 'open',
      face: { mouth: 'o', mOpen: 0.3, pupil: 0.55, open: 0.6, brow: 0.3, lookY: -0.5, blush: 0.2 }, tilt: Math.sin(t * 3) * 0.08,
    }); break;
    case 'sitFire': pf = (P) => (o.roll ? {
      hR: [74, P.SY + 70], kR: 'grip', rR: PI + 0.4, flipR: true, hL: [40, P.SY + 96], kL: 'flat', rL: -0.2, lateHands: true, face: { mouth: 'smile', turn: 0.3, lookX: 0.5, lookY: 0.3 },
      front: () => { rollDraw(C, 92, P.SY + 54, 0.36, { stage: 'rolled', k: 1, rot: -0.5, t }); },
    } : { hL: [40, P.SY + 80], kL: 'open', rL: -0.25, flipL: true, hR: [110, P.SY + 60], kR: 'open', rR: -0.15, flipR: false, face: { mouth: 'smile', turn: 0.35, lookX: 0.6, lookY: 0.3, happyClosed: 0.4, blush: 0.6 } }); break;
    case 'bite': pf = (P) => {
      const bitten = k > 0.5, ch = Math.abs(Math.sin(t * 8));
      return {
        hL: [-26, P.FY + 74], kL: 'grip', rL: -0.4, flipL: true, hR: [52, P.FY + 70], kR: 'grip', rR: PI + 0.5, flipR: true, lateHands: true,
        face: bitten ? NP.touristFaceOpts('chew', t) : { mouth: 'o', mOpen: 0.6 + ch * 0.3, brow: 0.6, lookY: 0.6 },
        front: () => { rollDraw(C, 20, P.FY + 36, 0.4, { stage: bitten ? 'bitten' : 'rolled', k: 1, rot: -0.15, t, steam: 0.5 }); extra.roll = toL([20, P.FY + 36]); },
      };
    }; break;
    case 'bliss': pf = (P) => ({
      hR: [8, P.SY + 54], kR: 'flat', rR: PI + 0.4, flipR: true, hL: [-58, P.hipY - 46], kL: 'open', rL: PI / 2, face: NP.touristFaceOpts('bliss', t), tilt: -0.1 + Math.sin(t * 2) * 0.04,
      front: () => faceAt(P, () => { for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * 1.6; L.sparkle(C, Math.cos(a) * 220, -120 + Math.sin(a * 1.3) * 90, 26, 0.4 + 0.6 * Math.abs(Math.sin(t * 4 + i))); } }),
    }); break;
    case 'thumbs': pf = (P) => ({ hL: [-74, P.SY - 20 + Math.sin(t * 8) * 3], kL: 'thumb', rL: PI - 0.15, flipL: true, hR: [74, P.SY - 20 + Math.sin(t * 8 + 1) * 3], kR: 'thumb', rR: 0.15, face: { mouth: 'grin', mOpen: 0.6, happyClosed: 1, open: 0, blush: 0.6 } }); break;
    default: break;
  }
  const userFn = o.poseFn;
  o2.poseFn = (P) => {
    const r = Object.assign({}, pf ? pf(P) : {}, userFn ? userFn(P) || {} : {});
    for (const kk of Object.keys(r)) if (r[kk] === undefined) delete r[kk];
    if (r.face && o2.face) r.face = Object.assign({}, r.face, o2.face);
    const fr = r.front;
    if (wet || hat || frogO) r.front = () => {
      if (fr) fr();
      faceAt(P, () => {
        if (wet) wetDrips(C, t);
        if (hat) { C.save(); C.translate(0, -180); C.scale(1.18, 1.18); C.translate(0, 180); lotusHat(C, t); C.restore(); }
        if (frogO) frogRaw(C, 14, hat ? -352 : -262, 3.3, Object.assign({ t }, frogO));
      });
    };
    return r;
  };
  // wet look: swap the shared palette for this draw only
  const hair0 = PEOPLE.HAIR.slice(), shirt0 = PEOPLE.SHIRT;
  if (wet) { PEOPLE.HAIR[0] = '#b89a52'; PEOPLE.HAIR[1] = '#8f7438'; PEOPLE.HAIR[2] = '#5f4b22'; PEOPLE.SHIRT = '#1d7c77'; }
  const box = pose === 'popUp' ? [x - 400 * s, y - 440 * s, x + 400 * s, y + 140 * s]
    : Math.abs(lean) > 0.05 ? [ox - 780 * s, oy - 760 * s, ox + 780 * s, oy + 80 * s] : [ox - 440 * s, oy - 700 * s, ox + 440 * s, oy + 80 * s];
  const fire = o.fireLight ? Object.assign({ r: 700 * s }, o.fireLight) : null;
  let ret;
  try {
    ret = E.nightLit(ctx, (c) => {
      C = c; const Bc = c.getTransform();
      if (!standing && o.shadow !== false && (wl === undefined)) { c.fillStyle = 'rgba(5,8,18,0.3)'; ell(c, ox, oy + 4 * s, 100 * s, 12 * s); c.fill(); }
      else if (standing && wl === undefined && pose !== 'fallBack') { c.fillStyle = 'rgba(5,8,18,0.32)'; ell(c, ox, oy + 2 * s, 90 * s, 12 * s); c.fill(); }
      let r;
      if (la) { c.save(); c.translate(ox, oy); c.rotate(la); c.translate(-ox, -oy); r = NP.tourist(c, ox, oy, s, o2); c.restore(); } else r = NP.tourist(c, ox, oy, s, o2);
      return E.devToLocal(Bc, r); // NP returns buffer-device coords
    }, { box, night: o.night ?? 0.3, fire, waterline: wl, sub: o.sub ?? (pose === 'popUp' ? 0.1 : 0.22), ring: wl !== undefined ? { x: ox, w: (pose === 'popUp' ? 120 : 90) * s, t } : null, reflect: o.reflect, t, rim: o.rim, moon: o.moon });
  } finally {
    for (let i = 0; i < 3; i++) PEOPLE.HAIR[i] = hair0[i];
    PEOPLE.SHIRT = shirt0;
  }
  for (const p of post) p();
  return Object.assign(ret, extra);
}

module.exports = { chuBa, chuBaFace, touristNight, tourist: touristNight, frog, egret, CB_COL, cbHead, lotusHat };
