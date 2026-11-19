// Shots 21–28: the tourist gag (try the wok → afro), the crunch, the ending and the CTA.
const L = require('./lib');
const P = require('./props');
const C = require('./cholon');
const F = require('./food');
const PE = require('./people');
const X = require('./text');
const CM = require('./common');
const { W, H, TAU, rng, clamp, lerp, inv, ease, cam, at, glow, flare, dust, bokeh, steam, flakes } = L;
const { ell, layer } = P;
const { bump, lanternBokeh, wokFill, darkBg, ITEMS, LCOLS, streetWorld, tableWithDish } = CM;

// seated table set (world coords): table + stool + tourist in profile facing left
const TB = { x: 640, y: 1470, s: 1.6 }, TR = { x: 870, y: 1470, s: 1.8 };
function tableScene(ctx, T, st = {}, o = {}) {
  C.steelStool(ctx, TR.x + 10, TR.y, TR.s, 82);
  tableWithDish(ctx, TB.x, TB.y, TB.s, T, { eaten: o.eaten || 0 });
  PE.tourist(ctx, TR.x, TR.y, TR.s, Object.assign({ sit: 1, t: T }, st));
}

// ---------- S21 60.5–63.5 tourist at the steel table; chef's flaming toss behind; he stands up ----------
function s21(ctx, lt, p, T) {
  const burst = bump(T, 60.7, 1.0);
  const stand = ease.inOut(inv(62.6, 63.4, T));
  const z = lerp(1.0, 1.08, ease.inOut(p));
  cam(ctx, lerp(720, 700, p), 1110, z, 0, () => {
    streetWorld(ctx, T, { fire: 1 + burst * 1.6, chef: { toss: burst, mood: 'focus', swirl: 1 - burst } });
    if (burst > 0) { C.fire(ctx, 540, 960, 420, 520 * burst, T * 1.4, burst, 211); glow(ctx, 540, 900, 600, 'rgba(255,150,60,0.9)', burst * 0.8); }
    tableScene(ctx, T, { sit: 1 - stand, look: -0.15 * burst - 0.1, smile: 1, lean: -0.1 * stand });
  });
  if (burst > 0.3) flare(ctx, 520, 760, 1.4, burst * 0.6);
  dust(ctx, T, 212, 30, 0, 300, W, 1200, '255,200,140', 2.5, 0.45);
}

// ---------- S22 63.5–67 rolls up his sleeves, takes the wok; chef worried ----------
function s22(ctx, lt, p, T) {
  // blurred street behind
  layer(ctx, 10, (ctx) => cam(ctx, 560, 900, 1.5, 0, () => { CM.sky(ctx, T); C.drawStreet(ctx); C.lanternString(ctx, -320, 360, 1400, 400, 40, 9, 0.62, T, 1, { haloA: 0.6 }); }));
  ctx.fillStyle = 'rgba(20,8,4,0.35)'; ctx.fillRect(0, 0, W, H);
  const take = ease.inOut(inv(65.2, 66.0, T));
  const roll = T < 64.9 ? 0.5 + 0.5 * Math.sin((T - 63.6) * 9) : 0;
  const z = lerp(1.0, 1.06, p);
  cam(ctx, 540, 1100, z, 0, () => {
    glow(ctx, 420, 1250, 520, 'rgba(255,130,50,0.7)', 0.8);
    // chef behind the counter, hands up, worried
    const hands = ease.inOut(inv(64.6, 65.4, T));
    C.chef(ctx, 290, 1330, 1.0, { mood: 'worried', t: T, look: 0.4, hl: [lerp(-60, -150, hands), lerp(-90, -330, hands)], hr: [lerp(120, 150, hands), lerp(-80, -330, hands)] });
    // wok on the fire; slides to the right as the tourist takes it
    const wx = 420 + take * 60, wy = 1255 - take * 30 - Math.sin(T * 6) * 4 * take;
    C.fire(ctx, 420, 1340, 380, 230, T, 1, 221);
    F.bigWok(ctx, wx, wy, 0.62, -take * 0.08, { k: 0.3, handle: true, fill: wokFill({ sea: 1, meat: 1, veg: 1, sauce: 0.5, t: T, swirl: 0.8 }) });
    C.counter(ctx, 400, 1340, 720, 700);
    C.burner(ctx, 420, 1336, 0.9);
    C.fire(ctx, 420, 1342, 360, 90, T + 3, 0.8, 222);
    C.embers(ctx, T, 223, 20, 420, 1250, 400, 500, 1);
    // tourist (front of frame, profile facing left)
    const hx = (wx + 0.62 * 470 - 820) / 2.0, hy = (wy - 1730) / 2.0; // hand target on the handle (local)
    PE.tourist(ctx, 820, 1730, 2.0, { raise: roll * (T < 64.9 ? 1 : 0), glassHand: [hx, hy], glassHandK: take, look: lerp(-0.05, 0.05, take), smile: 1, t: T });
  });
  X.line(ctx, T, 64.0, 66.6, 'Cho tôi thử!', 'Let me try!', { y: 420 });
}

// ---------- S23 67–70.5 flame burst → afro, soot, smoke, blinking ----------
function s23(ctx, lt, p, T) {
  if (T < 67.5) {
    const k = inv(67.0, 67.5, T);
    darkBg(ctx, '#2a0c06', '#060303');
    bokeh(ctx, T, 231, 20, LCOLS, 0.4, 30, 110);
    const sh = 10 * k;
    const lift = bump(T, 67.05, 0.4);
    cam(ctx, 540 + Math.sin(T * 70) * sh, 1150 + Math.cos(T * 63) * sh, 1.0 + 0.15 * k, 0, () => {
      glow(ctx, 520, 1250, 800, 'rgba(255,120,40,0.9)', 0.6 + k * 0.4);
      F.bigWok(ctx, 480, 1260 - lift * 80, 1.25, -lift * 0.25, { k: 0.3, handle: true, fill: wokFill({ sea: 0.4, meat: 0.4, veg: 0.4, t: T, swirl: 1 }) });
      // the tourist's arm on the handle (from the right edge)
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = PE.SKIN[1]; ctx.lineWidth = 70; ctx.beginPath(); ctx.moveTo(1180, 1500); ctx.lineTo(980, 1270 - lift * 60); ctx.stroke();
      ctx.strokeStyle = PE.SHIRT; ctx.lineWidth = 96; ctx.beginPath(); ctx.moveTo(1260, 1600); ctx.lineTo(1150, 1470); ctx.stroke();
      ctx.restore();
      C.fire(ctx, 500, 1260, 900, 600 + 1400 * k * k, T * 1.6, 1, 232);
      C.fire(ctx, 420, 1270, 600, 400 + 900 * k, T * 1.6 + 2, 1, 233);
    });
    C.embers(ctx, T, 234, 80, 540, 1300, 1100, 1600, 1);
    glow(ctx, 540, 900, 1200, 'rgba(255,220,160,1)', k * k * 0.9);
    return;
  }
  // after the blast: dazed face
  lanternBokeh(ctx, T, 235, 0.35);
  const afro = lerp(0.3, 1, ease.outBack(inv(67.6, 67.9, T)));
  const blink = (tb) => (Math.abs(T - tb) < 0.09 ? 0.05 : 1);
  const open = Math.min(blink(68.6), blink(69.6), blink(69.82));
  const z = lerp(1.22, 1.3, inv(67.5, 70.5, T));
  // residual smoke cloud
  C.smoke(ctx, T, 236, 540, 900, 1100, 1300, 10, 0.5 * (1 - inv(67.5, 69, T)) + 0.15, '90,85,85');
  PE.face(ctx, 540, 960, z, { turn: 0, lookX: 0, lookY: 0, open, mouth: 'o', mOpen: 0.5, brow: 0.8, afro, soot: 1, smoke: 1, t: T, blush: 0.2 });
  // floating ash flecks
  flakes(ctx, T, 67.55, 237, 40, 540, 600, { colors: ['#2a2420', '#4a3e36', '#ff9a40'], size: 5, speed: 300, g: 120, life: 2.6, spread: 3.2, slow: 0.6 });
  // sparks pop around the afro
  if (T < 68.4) glow(ctx, 540, 600, 700, 'rgba(255,200,120,0.9)', (1 - inv(67.5, 68.4, T)) * 0.6);
  X.line(ctx, T, 67.9, 70.2, 'Ối!', 'Whoa!', { y: 1450, vsize: 92 });
}

// nest chunk on chopstick tips
function chunk(ctx, x, y, s, T) {
  F.nest(ctx, x, y, 0.32 * s, 0.5, 1, { h: 60 });
  F.gravyBlob(ctx, x, y - 14 * s, 40 * s, 22 * s, T, 0.6, 5);
  F.topping(ctx, 'shrimp', x + 6 * s, y - 24 * s, 0.5 * s, 0.4);
}

// ---------- S24 70.5–73.5 he picks up a noodle bite, closes his eyes (silence before the crunch) ----------
function s24(ctx, lt, p, T) {
  lanternBokeh(ctx, T, 241, 0.42, -p * 50, 0);
  const z = lerp(1.45, 1.5, inv(70.5, 73.0, T)) + 0.08 * ease.inOut(inv(73.0, 73.5, T));
  const fx = 600, fy = 900;
  const bring = ease.inOut(inv(70.7, 72.2, T));
  const open = 1 - ease.inOut(inv(71.9, 72.4, T));
  const mo = T < 72.2 ? 0.2 + 0.6 * ease.inOut(inv(71.4, 72.1, T)) : 0.05;
  PE.face(ctx, fx, fy, z, { turn: -0.3, lookX: -0.2, lookY: lerp(0.6, 0.3, bring), open, mouth: T < 72.2 ? 'o' : 'sip', mOpen: mo, brow: 0.3 + 0.4 * (1 - open), afro: 1, soot: 0.7, smoke: 0.6, t: T });
  // mouth position in world
  const mx = fx + (-0.3 * 70 * 1.05) * z, my = fy + 140 * z;
  if (T < 72.25) {
    const tx = lerp(860, mx + 10, bring), ty = lerp(1700, my + 10, bring);
    chunk(ctx, tx, ty, 1.5, T);
    F.chopsticks(ctx, tx + 10, ty + 20, 1.6, 0.9 - bring * 0.25, 0.03);
    steam(ctx, T, 242, tx, ty - 20, 160, 300, 5, 0.35);
  }
  dust(ctx, T, 243, 26, 0, 200, W, 1400, '255,210,160', 2.5, 0.4);
}

// comic jagged burst label
function comicBurst(ctx, x, y, s, a, T) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(-0.08 + Math.sin(T * 30) * 0.01); ctx.scale(s, s);
  const r = rng(251); ctx.beginPath();
  const n = 18;
  for (let i = 0; i <= n * 2; i++) { const ang = i / (n * 2) * TAU, rr = (i % 2 ? 190 : 300) * (0.9 + r() * 0.2); const px = Math.cos(ang) * rr * 1.25, py = Math.sin(ang) * rr * 0.8; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fillStyle = '#ffd34a'; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#2a1206'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '150px TitleSerif'; ctx.lineWidth = 14; ctx.strokeStyle = '#2a1206'; ctx.strokeText('RỘP!', 0, -20);
  ctx.fillStyle = '#e8321e'; ctx.fillText('RỘP!', 0, -20);
  ctx.font = '58px BodySansBold'; ctx.lineWidth = 8; ctx.strokeText('CRUNCH!', 0, 92); ctx.fillStyle = '#ffffff'; ctx.fillText('CRUNCH!', 0, 92);
  ctx.restore();
}

// ---------- S25 73.5–77 RỘP! crumbs explode, big grin ----------
function s25(ctx, lt, p, T) {
  const hit = inv(73.5, 74.2, T);
  lanternBokeh(ctx, T, 251, 0.45);
  // comic speed lines
  if (T < 74.6) {
    ctx.save(); ctx.globalAlpha = 0.55 * (1 - inv(74.0, 74.6, T)); ctx.translate(540, 1150);
    const r = rng(252);
    for (let i = 0; i < 48; i++) { const a = r() * TAU, w = 0.02 + r() * 0.03; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 300, Math.sin(a) * 300); ctx.lineTo(Math.cos(a - w) * 1600, Math.sin(a - w) * 1600); ctx.lineTo(Math.cos(a + w) * 1600, Math.sin(a + w) * 1600); ctx.closePath(); ctx.fillStyle = i % 2 ? 'rgba(255,220,140,1)' : 'rgba(255,170,80,1)'; ctx.fill(); }
    ctx.restore();
  }
  const sh = 22 * (1 - hit) * (T < 74.2 ? 1 : 0);
  const punch = 1.3 + 0.12 * (1 - ease.out(hit));
  const fx = 540 + Math.sin(T * 80) * sh, fy = 1000 + Math.cos(T * 71) * sh;
  PE.face(ctx, fx, fy, punch, { turn: 0, lookX: 0, lookY: -0.1, open: T < 73.9 ? 0.15 : 1, mouth: 'grin', mOpen: 0.8, brow: -0.3, afro: 1, soot: 0.6, smoke: 0.8, blush: 0.8, t: T });
  const my = fy + 140 * punch;
  F.crumbs(ctx, T, 73.5, 253, 60, fx, my, { speed: 900, size: 11, spread: 3.2, angle: -Math.PI / 2, life: 1.8 });
  F.crumbs(ctx, T, 73.62, 254, 40, fx, my, { speed: 700, size: 7, spread: 3.6, angle: -Math.PI / 2, life: 1.6, slow: 0.5 });
  if (T > 74.1) { L.sparkle(ctx, fx - 120 * punch, fy - 20, 1.2, 0.8 * Math.abs(Math.sin(T * 6))); L.sparkle(ctx, fx + 120 * punch, fy - 30, 1.0, 0.8 * Math.abs(Math.sin(T * 6 + 1.5))); }
  const ca = clamp((T - 73.5) / 0.12) * (1 - inv(74.5, 74.8, T));
  if (ca > 0) comicBurst(ctx, 520, 520, 0.95 + 0.25 * (1 - ease.outBack(clamp((T - 73.5) / 0.3))), ca, T);
  X.caption(ctx, T, 74.6, 76.8, 'Giòn rụm!', 'SO crunchy!', { vsize: 76, esize: 46 });
}

// ---------- S26 77–81 eats on with smoking hair; chef laughs ----------
function s26(ctx, lt, p, T) {
  const z = lerp(1.08, 1.14, p);
  cam(ctx, lerp(700, 660, p), 1080, z, 0, () => {
    streetWorld(ctx, T, { fire: 0.7, chef: { mood: 'laugh', swirl: 0.3, tilt: Math.sin(T * 9) * 0.04 } });
    const bite = 0.5 + 0.5 * Math.sin((T - 77) * 5.5);
    tableScene(ctx, T, { afro: 1, soot: 1, smile: 1, glassHand: [-58, -250], glassHandK: lerp(0.55, 1, bite), look: -0.05 * bite }, { eaten: inv(77, 81, T) });
    // chopsticks in hand (world)
    const hx = TR.x + lerp(-30, -58, lerp(0.55, 1, bite)) * TR.s, hy = TR.y + lerp(-150, -250, lerp(0.55, 1, bite)) * TR.s;
    F.chopsticks(ctx, hx - 50, hy + 30, 0.5, -0.7, 0.03);
    // hair smoke
    C.smoke(ctx, T, 261, TR.x - 40, TR.y - 560, 160, 360, 6, 0.4, '110,105,105');
  });
  X.line(ctx, T, 77.6, 80.7, 'Đáng từng sợi tóc!', 'Worth every hair!', { y: 250 });
}

// ---------- S27 81–84.5 pull back, crane up the lantern street; end card ----------
function s27(ctx, lt, p, T) {
  const e = ease.inOut(p);
  cam(ctx, lerp(680, 540, e), lerp(1100, 560, e), lerp(1.1, 0.84, e), lerp(0, 0.02, e), () => {
    streetWorld(ctx, T, { fire: 0.7, chef: { mood: 'laugh', swirl: 0.5 } });
    tableScene(ctx, T, { afro: 1, soot: 1, smile: 1, glassHand: [-58, -250], glassHandK: 0.6 }, { eaten: 0.7 });
    C.smoke(ctx, T, 271, TR.x - 40, TR.y - 560, 160, 360, 6, 0.4, '110,105,105');
  });
  layer(ctx, 10, (ctx) => {
    const fy = lerp(2200, 1300, e);
    C.lantern(ctx, 120, fy, 2.4, Math.sin(T * 1.3) * 0.08, 1, { haloA: 0.9 });
    C.lantern(ctx, 980, fy + 300, 2.0, Math.sin(T * 1.1 + 1) * 0.08, 1, { haloA: 0.9 });
  });
  dust(ctx, T, 272, 40, 0, 0, W, H, '255,200,140', 2.5, 0.5);
  X.endCard(ctx, T, 82.0);
}

// ---------- S28 84.5–90 CTA ----------
function s28(ctx, lt, p, T) {
  const dk = inv(84.5, 85.5, T);
  layer(ctx, 6 + 10 * dk, (ctx) => cam(ctx, 560, 1000, 1.25, 0, () => streetWorld(ctx, T, { fire: 0.6, chef: { mood: 'laugh', swirl: 0.4 } })));
  ctx.fillStyle = `rgba(8,4,2,${0.25 + 0.4 * dk})`; ctx.fillRect(0, 0, W, H);
  // tourist medium shot, bottom centre
  const rise = ease.outBack(inv(84.5, 85.2, T));
  const wink = T > 86.5 && T < 86.95 ? 0.05 : 1;
  const fy = 1250 + (1 - rise) * 500;
  PE.face(ctx, 540, fy, 0.64, { turn: 0.05, lookX: 0, lookY: 0, open: 1, openR: wink, mouth: 'smile', mOpen: 0.4, brow: wink < 1 ? 0.4 : 0, afro: 1, soot: 0.5, smoke: 0.5, blush: 0.5, t: T });
  const th = ease.outBack(inv(85.4, 85.9, T));
  if (th > 0) PE.thumbsUp(ctx, 890, fy - 60 + (1 - th) * 500, 1.0, -0.15 + Math.sin(T * 5) * 0.04);
  X.ctaLike(ctx, T, 84.7, 330, 760);
  X.ctaFollow(ctx, T, 85.2, 86.0, 700, 760);
  X.ctaHand(ctx, T, 86.0, 700, 760);
  X.biText(ctx, X.fadeIO(T, 85.0, 89.4, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  { const a = X.fadeIO(T, 86.5, 89.4, 0.35, 0.4); if (a > 0) { const g = ctx.createLinearGradient(0, 1300, 0, 1500); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.35, `rgba(0,0,0,${0.55 * a})`); g.addColorStop(0.75, `rgba(0,0,0,${0.55 * a})`); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 1300, 1080, 200); } }
  X.biText(ctx, X.fadeIO(T, 86.5, 89.4, 0.35, 0.4), 1400, 'Món tiếp theo là gì? Comment nhé!', 'Which dish next? Tell us in the comments!', { vsize: 56, esize: 38 });
  X.logo(ctx, X.fadeIO(T, 85.5, 89.4, 0.5, 0.4), 1530);
  const fb = inv(89.4, 90, T);
  if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s21, s22, s23, s24, s25, s26, s27, s28, comicBurst };
