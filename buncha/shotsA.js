// Bún chả Hà Nội – shots 1–10: smoke over the old quarter, the smoke-hand, prep of the pork.
const L = require('./lib');
const P = require('./props');
const R = require('./river');
const Wd = require('./world');
const Pp = require('./people');
const F = require('./food');
const Tx = require('./text');
const B = require('./bprops');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, bokeh } = L;
const { ell } = P;

const bump = (t, t0, d) => (t < t0 || t > t0 + d ? 0 : Math.sin(Math.PI * (t - t0) / d));
const TOUR_SKIN = ['#f2c3a0', '#c97c5e'];
const LAN_SKIN = B.LAN_SKIN;
function darkBg(ctx, c0, c1) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function warmBokeh(ctx, T, shift = 0, seed = 77, c0 = '#5a4026', c1 = '#1c1208') {
  darkBg(ctx, c0, c1);
  ctx.save(); ctx.translate(shift, 0);
  bokeh(ctx, T, seed, 22, ['rgba(255,210,130,0.9)', 'rgba(255,235,180,0.8)', 'rgba(220,120,60,0.6)'], 0.32, 30, 120);
  ctx.restore();
}
function emberBg(ctx, T, shift = 0, seed = 41) {
  darkBg(ctx, '#1a0e06', '#3a1a0a');
  ctx.save(); ctx.translate(shift, 0);
  bokeh(ctx, T, seed, 16, ['rgba(255,150,60,0.9)', 'rgba(255,210,130,0.8)', 'rgba(255,90,30,0.7)'], 0.3, 30, 120);
  ctx.restore();
}
// falling bàng leaves (red/orange), screen space
function bangLeaves(ctx, T, seed, n, a = 1, size = 1) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sp = 60 + r() * 90, x0 = r() * 1300 - 100, ph = r() * 30, sc = (0.6 + r() * 0.9) * size;
    const y = ((T + ph) * sp) % 2200 - 140, x = x0 + Math.sin((T + ph) * 1.3) * 60;
    at(ctx, x, y, (T + ph) * 2, sc, sc * (0.5 + 0.5 * Math.abs(Math.sin((T + ph) * 3))), () => {
      ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(0, -16, 22, 0); ctx.quadraticCurveTo(0, 16, -22, 0);
      ctx.fillStyle = ['#c0442a', '#d9772e', '#a8341e', '#e0a040'][i % 4]; ctx.fill();
      ctx.strokeStyle = 'rgba(80,20,10,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke(); ctx.globalAlpha = 1;
    });
  }
}
function topBand(ctx, a = 0.55, h = 620) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(10,6,4,${a})`); g.addColorStop(1, 'rgba(10,6,4,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, h); }
function noonSky(ctx, y0, y1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#4f8fc6'); g.addColorStop(1, '#9cc6df'); ctx.fillStyle = g; ctx.fillRect(-600, y0, 2400, y1 - y0); }

// cô Lan: light-blue áo bà ba, nón lá, fanning with a quạt nan. o: {t, laugh, fan (0..1 strength), handA, nod, holdFn, noFan}
function coLan(ctx, x, y, s, o = {}) {
  const t = o.t || 0, fk = o.fan === undefined ? 1 : o.fan;
  const sw = Math.sin(t * 12.566) * fk; // 2 strokes per second
  const handA = o.handA || [104 + sw * 10, -66 - sw * 12];
  R.coUt(ctx, x, y, s, {
    t, shirt: B.LAN_SHIRT, shirtD: B.LAN_SHIRT_D, laugh: o.laugh || 0, nod: o.nod || 0, handA, handB: o.handB || [70, -40],
    holdFn: o.holdFn || (o.noFan ? null : (c, hA) => B.fan(c, hA[0] + 4, hA[1] + 8, 0.3, 1.75 + sw * 0.55, 1)),
  });
}
// tiny red stool + seated tourist (x = stool centre, ground y 1345)
function tinyStoolTourist(ctx, x, T, st = {}, squash = 0) {
  at(ctx, x, 1345, 0, 1, 1 - squash * 0.25, () => P.stool(ctx, 0, 0, 0.75, '#d63a2f', 40));
  Pp.tourist(ctx, x + 10, 1345 + 52 + squash * 10, 1, Object.assign({ sit: 1 }, st));
}
// grill (top-down art) lying on the street brazier, squashed into ¾
function streetGrill(ctx, x, y, s, char = 0.7, k = 0.32) {
  B.grill(ctx, x, y, s, 0, {
    fold: 1, char: char * 0.6, k, shadow: false,
    items: (c) => { for (let i = 0; i < 4; i++) B.patty(c, -95 + i * 64, -40, 1, i, char, 'vien', i + 1); for (let i = 0; i < 2; i++) B.patty(c, -60 + i * 120, 50, 1, 0.1, char, 'mieng', i + 5); },
  });
}
// the alley set: brazier + grill + smoke on the left, cô Lan fanning, low table, optional tourist.
// o: {laugh, fan, table(ctx), tourist:{x, st, squash}|null, smokeA, smokeGold, handA, holdFn, noFan}
const BRZ = [430, 1352, 0.55];
function chaSet(ctx, T, o = {}) {
  noonSky(ctx, -1400, 0);
  Wd.drawStreet(ctx);
  godRays(ctx, 1000, -100, 2.2, 0.5, 2100, 8, 'rgba(255,235,170,0.5)', 0.3, T);
  P.stool(ctx, 190, 1345, 0.8, '#2f6fd6', 40);
  coLan(ctx, 200, 1318, 1.0, { t: T, laugh: o.laugh, fan: o.fan, handA: o.handA, holdFn: o.holdFn, noFan: o.noFan, nod: o.nod });
  const [bx, by, bs] = BRZ;
  B.brazier(ctx, bx, by, bs, T, { heat: 1 });
  streetGrill(ctx, bx, by - 205 * bs, bs * 0.95, 0.75);
  B.embers(ctx, T, 7, 16, bx, by - 130, 260, 300, 0.9, 1);
  const sc = o.smokeGold ? '255,215,140' : '246,244,240', sa = o.smokeA === undefined ? 0.9 : o.smokeA;
  B.smoke(ctx, T, 13, bx, by - 150, 160, 1300, 16, sa * 0.6, 240, '150,140,135', 1.1);
  B.smoke(ctx, T, 11, bx, by - 150, 200, 1250, 26, sa, 220, sc, 1.2);
  P.lowTable(ctx, 690, 1345, 0.9, 270, 90);
  if (o.table) o.table(ctx);
  if (o.tourist) tinyStoolTourist(ctx, o.tourist.x || 900, T, o.tourist.st || {}, o.tourist.squash || 0);
}
// food on the low table in the street (sauce bowl, bún plate, herbs) – drawn small
function tableFood(ctx, opt = {}) {
  B.bunPlate(ctx, 640, 1258, 62, 0.35);
  if (!opt.noBowl) B.sauceBowl(ctx, 735, 1268, 0.22, { patties: 3, papaya: 3, carrot: 2 });
  R.basket(ctx, 620, 1240, 0.12, 420, (c) => { for (let i = 0; i < 18; i++) F.herbLeaf(c, Math.cos(i * 2.4) * 260 * Math.sqrt(i / 18), Math.sin(i * 2.4) * 260 * Math.sqrt(i / 18), 2.4, i, ['xalach', 'kinhgioi', 'tiato'][i % 3]); });
}
function bike(ctx, T, tc, y, s, dir, cols) {
  const u = (T - tc) / 0.32;
  if (Math.abs(u) > 2.2) return;
  const x = 540 + dir * 820 * u * Math.abs(u) * 0.55 + dir * 120 * u, v = Math.abs(u) * 1.6 + 0.2;
  ctx.save(); for (let i = 0; i < 7; i++) { ctx.globalAlpha = i === 0 ? 0.95 : 0.22; Wd.motorbike(ctx, x - dir * i * v * 22, y, s, dir < 0, T, cols); } ctx.restore();
}
function woodTop(ctx, col = '#6a4424') {
  ctx.fillStyle = col; ctx.fillRect(-600, -600, 2300, 3200);
  ctx.strokeStyle = 'rgba(30,15,5,0.25)'; ctx.lineWidth = 3;
  for (let i = 0; i < 32; i++) { ctx.beginPath(); ctx.moveTo(-600, -500 + i * 100); ctx.bezierCurveTo(300, -520 + i * 104, 700, -480 + i * 96, 1700, -500 + i * 100); ctx.stroke(); }
}

// ============ S1 0–3.5 Aerial old quarter, a smoke column rises ============
function s1(ctx, lt, p, T) {
  const cy = lerp(1250, 1820, ease.inOut(p)), z = lerp(1.0, 1.1, p);
  cam(ctx, 560, cy, z, 0, () => {
    noonSky(ctx, -600, 0);
    Wd.drawAerial(ctx);
    B.smoke(ctx, T + 3, 101, 640, 2050, 90, 1350, 26, 0.95, 260, '130,122,118', 1.3);
    B.smoke(ctx, T + 7, 102, 640, 2050, 40, 900, 14, 0.9, 120, '250,246,240', 0.9);
    glow(ctx, 640, 2010, 180, 'rgba(255,140,50,0.9)', 0.35);
    for (let i = 0; i < 6; i++) { const bx = -100 + ((lt * (120 + i * 25) + i * 210) % 1400), by = 1050 + i * 34 + Math.sin(lt * 3 + i) * 10; Wd.sparrow(ctx, bx, by, 0.7, lt * 18 + i, false); }
  });
  glow(ctx, 880, 120, 700, 'rgba(255,240,190,0.8)', 0.6);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; const hz = ctx.createLinearGradient(0, 500, 0, 1400); hz.addColorStop(0, 'rgba(255,235,190,0)'); hz.addColorStop(0.5, 'rgba(255,235,190,0.16)'); hz.addColorStop(1, 'rgba(255,235,190,0)'); ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H); ctx.restore();
  const wy = lerp(1500, 260, ease.inOut(p));
  Wd.wires(ctx, -60, wy, 1140, wy - 140, 6, 31, 120, '#120c08', lt);
  bangLeaves(ctx, T, 3, 10, 0.95, 1.4);
  flare(ctx, 880, 140, 0.9, 0.35 + 0.4 * bump(lt, 1.4, 1.4));
  dust(ctx, lt, 3, 40, 0, 0, W, H, '255,235,190', 2.5, 0.5);
  { const g = ctx.createLinearGradient(0, 1200, 0, 1560); g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(0.5, 'rgba(10,6,4,0.5)'); g.addColorStop(1, 'rgba(10,6,4,0)'); ctx.fillStyle = g; ctx.fillRect(0, 1200, W, 360); }
  Tx.label(ctx, T, 0.7, 3.3, 'HÀ NỘI · 11:00 TRƯA', 'Hanoi · 11:00 AM', 1360);
  if (lt < 0.7) { ctx.fillStyle = `rgba(0,0,0,${1 - ease.out(lt / 0.7)})`; ctx.fillRect(0, 0, W, H); }
}

// ============ S2 3.5–6.5 Wide pan along the alley: smoke billows, bikes whizz ============
function s2(ctx, lt, p, T) {
  cam(ctx, lerp(760, 440, ease.inOut(p)), 1060, 1.12, 0, () => {
    chaSet(ctx, T, { smokeA: 0.7, table: (c) => tableFood(c) });
    B.smoke(ctx, T + 5, 12, BRZ[0], BRZ[1] - 150, 300, 900, 12, 0.6, 380, '246,244,240', 1.6);
  });
  bike(ctx, T, 4.7, 1900, 1.25, 1, { body: '#c0392b', helm: '#f1c40f', jacket: '#34495e' });
  bike(ctx, T, 5.9, 1700, 0.85, -1, { body: '#2e86de', helm: '#ecf0f1', jacket: '#7d5a3c' });
  bangLeaves(ctx, T, 5, 8, 0.9, 1.1);
  dust(ctx, T, 5, 30, 0, 0, W, H, '255,235,190', 2.5, 0.45);
}

// ============ S3 6.5–9.5 Tracking: the smoke-hand hooks the tourist's nose and floats him in ============
function s3(ctx, lt, p, T) {
  const walkIn = clamp(lt / 1.1), x0 = lerp(1300, 1080, walkIn);
  const pull = ease.inOut(clamp((lt - 1.45) / 1.55));
  const tx = lerp(x0, 760, pull), lift = ease.out(clamp((lt - 1.4) / 0.5)) * 70 + Math.sin(T * 5) * 8 * pull;
  const ty = 1345 - lift;
  const sniff = bump(lt, 0.5, 0.8);
  const camX = lerp(1000, 820, ease.inOut(p));
  cam(ctx, camX, 1130, 1.5, 0, () => {
    chaSet(ctx, T, { smokeA: 0.55, table: (c) => tableFood(c) });
    P.stool(ctx, 900, 1345, 0.75, '#d63a2f', 40);
    const nose = [tx - 46, ty - 405];
    const arrive = clamp((lt - 0.6) / 0.8);
    B.smokeRibbon(ctx, BRZ[0] + 40, BRZ[1] - 160, nose[0] - 90, nose[1], T, arrive, 0.9, 4);
    ctx.save(); ctx.globalAlpha = 0.25 * clamp(lift / 50); ctx.filter = 'blur(6px)'; ell(ctx, tx, 1350, 60, 10); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    at(ctx, tx, ty, -0.12 * pull, 1, 1, () => {
      Pp.tourist(ctx, 0, 0, 1, { walk: pull > 0.05 ? Math.sin(T * 3) * 0.6 : (1300 - x0) / 40, look: 0.18 * sniff + 0.1 * pull, lean: 0.06 * pull });
    });
    const ha = clamp((lt - 1.0) / 0.4);
    const curl = 0.2 + 0.8 * ease.inOut(clamp((lt - 1.2) / 0.35)) - 0.25 * Math.max(0, Math.sin((lt - 1.6) * 9)) * pull;
    B.smokeHand(ctx, nose[0] - 95, nose[1] + 8, 0.9, -0.08, ha, curl, T);
    if (sniff > 0.05) { ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${0.8 * sniff})`; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(nose[0] - 40 - i * 22, nose[1] - 10, 12 + i * 4, -1, 1); ctx.stroke(); } ctx.restore(); }
  });
  bangLeaves(ctx, T, 6, 6, 0.9, 1.3);
  dust(ctx, T, 6, 30, 0, 0, W, H, '255,235,190', 2.5, 0.45);
}

// ============ S4 9.5–12 Close: fan waves, coals flare, sparks; a fat drop forms ============
function s4(ctx, lt, p, T) {
  emberBg(ctx, T, -lt * 25, 43);
  const sw = Math.sin(lt * 12.566);
  const gust = Math.max(0, -Math.cos(lt * 12.566));
  cam(ctx, 540, 1180, lerp(1.0, 1.12, ease.inOut(p)), -0.03, () => {
    glow(ctx, 540, 1150, 750, 'rgba(255,110,30,0.9)', 0.45 + 0.25 * gust);
    B.brazier(ctx, 540, 1700, 1.6, T, { heat: 1 + 0.6 * gust, k: 0.36, seed: 4 });
    const gy = 1352;
    streetGrill(ctx, 540, 1300, 1.5, 0.55, 0.5);
    const df = clamp((lt - 1.6) / 0.9);
    if (df > 0) { at(ctx, 540, gy + 18 + df * 26, 0, 1, 1, () => { ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(14 * df + 4, 8, 0, 14 + 18 * df); ctx.quadraticCurveTo(-14 * df - 4, 8, 0, -16); const g = ctx.createLinearGradient(-10, 0, 10, 0); g.addColorStop(0, '#ffd27a'); g.addColorStop(1, '#c97a20'); ctx.fillStyle = g; ctx.fill(); ell(ctx, -4, 6, 3, 5); ctx.fillStyle = '#fff6d0'; ctx.fill(); }); glow(ctx, 540, gy + 40, 80, 'rgba(255,220,120,0.9)', 0.4 * df); }
    B.embers(ctx, T, 44, Math.round(40 + gust * 40), 540, 1150, 820, 900, 1, 1.6);
    B.smoke(ctx, T, 45, 540, 1000, 700, 900, 10, 0.25, 120);
  });
  B.fan(ctx, 1010, 1180, 1.25, -1.05 + sw * 0.55, 0.85 + 0.15 * sw);
  P.hand(ctx, 1040, 1230, 1.5, -2.0 + sw * 0.4, 'fist', LAN_SKIN);
  P.forearm(ctx, 1240, 1500, 1060, 1250, LAN_SKIN[0], B.LAN_SHIRT, 70);
  if (gust > 0.4) { ctx.save(); ctx.strokeStyle = `rgba(255,240,210,${0.35 * (gust - 0.4)})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(1000, 1100, 300 + i * 40, 2.4, 2.9); ctx.stroke(); } ctx.restore(); }
}

// ============ S5 12–15 Extreme close slow-mo: fat hits the coals, fire burst + title ============
function s5(ctx, lt, p, T) {
  emberBg(ctx, T, 0, 51);
  const burst = Math.max(0, 1 - lt / 2.2);
  cam(ctx, 540, 1000, lerp(1.08, 1.0, ease.out(p)), 0, () => {
    B.brazier(ctx, 540, 2420, 3.4, T * 0.4, { heat: 1.2 + burst, k: 0.42, seed: 9 });
    B.flames(ctx, T * 0.35, 52, 540, 1500, 700, 900 * ease.outExpo(clamp(lt / 0.25)) * (0.4 + 0.6 * burst) + 120, 1);
    if (lt < 0.12) { ell(ctx, 540, lerp(1300, 1460, lt / 0.12), 14, 26); ctx.fillStyle = '#ffd27a'; ctx.fill(); }
    if (lt < 1.6) { const k = lt / 1.6; const r = rng(53); ctx.save(); ctx.globalCompositeOperation = 'screen'; for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.6, v = 400 + r() * 500; const px = 540 + Math.cos(a) * v * k, py = 1470 + Math.sin(a) * v * k + 500 * k * k; ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffe2a0'; ell(ctx, px, py, 6 + r() * 6, 6 + r() * 6); ctx.fill(); } ctx.restore(); }
    B.embers(ctx, T * 0.4, 54, 70, 540, 1500, 1000, 1500, 1, 2.2);
    B.smoke(ctx, T * 0.5, 55, 540, 1300, 600, 1200, 12, 0.3 * (1 - burst * 0.5), 100, '230,225,220', 1.5);
  });
  P.layer(ctx, 10, (c) => { c.clearRect(0, 0, W, H); for (const [y, w] of [[180, 60], [300, 40]]) P.seg(c, -50, y, 1130, y + 40, w, w, '#3a2410'); });
  flare(ctx, 540, 1460, 1.2, 0.6 * burst);
  topBand(ctx, 0.55, 800);
  Tx.title(ctx, T, 12.05, 14.8, 430, 'Hanoi Grilled Pork & Noodles', 'BÚN CHẢ', 'HÀ NỘI', 140, 96);
}

// ============ S6 15–18 Close dolly-in: knife slices pork belly ============
function s6(ctx, lt, p, T) {
  warmBokeh(ctx, T, -lt * 20, 61);
  glow(ctx, 300, 500, 900, 'rgba(255,200,130,0.6)', 0.6);
  const cuts = [0.5, 1.0, 1.5, 2.0, 2.5];
  const n = cuts.filter(t0 => lt > t0).length;
  const S = 1.9, slabR = 940 - n * 70;
  cam(ctx, lerp(600, 680, ease.inOut(p)), 1180, lerp(1.0, 1.22, ease.inOut(p)), 0, () => {
    F.board(ctx, 1250);
    const w = (slabR - 200) / S;
    B.rawBelly(ctx, 200 + (slabR - 200) / 2, 1360, S, w);
    for (let i = 0; i < n; i++) {
      const k = ease.out(clamp((lt - cuts[i]) / 0.35));
      at(ctx, lerp(slabR + 30, 760 + i * 46, k), lerp(1300, 1390, k), lerp(-1.4, -0.25, k), 1, 1, () => B.rawSlice(ctx, 0, 0, 1.6, 0));
    }
    const nextI = cuts.findIndex(t => lt < t + 0.2), ci = nextI < 0 ? cuts.length - 1 : nextI, t0 = cuts[ci];
    const d = lt < t0 ? ease.in(clamp((lt - (t0 - 0.3)) / 0.3)) : 1 - ease.out(clamp((lt - t0) / 0.2));
    const kx = 940 - ci * 70 - 70;
    B.knife(ctx, kx + 60 + Math.sin(d * Math.PI) * 50, lerp(1000, 1362, d), 1.05, -0.12);
    P.hand(ctx, kx + 60 + 230 + Math.sin(d * Math.PI) * 50, lerp(1000, 1362, d) - 80, 1.1, 0, 'fist', LAN_SKIN, true);
  });
  Tx.caption(ctx, T, 15.15, 17.9, 'Thái ba chỉ', 'Slice the pork belly', { n: 1 });
}

// ============ S7 18–21 Medium, shake per chop: two cleavers mince the pork ============
function s7(ctx, lt, p, T) {
  darkBg(ctx, '#3a2412', '#120a04');
  glow(ctx, 760, 380, 900, 'rgba(255,215,150,0.6)', 0.65);
  const per = 0.25, ph = (lt % per) / per, ci = Math.floor(lt / per) % 2;
  const hit = bump(ph, 0.0, 0.25);
  const fine = clamp(lt / 3);
  cam(ctx, 540 + (ci ? 1 : -1) * hit * 8, 1220 + hit * 10, lerp(1.0, 1.06, p), lerp(0.03, -0.03, p), () => {
    F.board(ctx, 1240);
    B.mince(ctx, 540, 1420, 1.6, 70, 220, 230, 90, fine);
    for (let side = 0; side < 2; side++) {
      const u = side === ci ? ph : (ph + 0.5) % 1;
      const y = u < 0.12 ? 1390 : lerp(1390, 860, Math.sin((u - 0.12) / 0.88 * Math.PI));
      const x = side ? 640 : 440, rot = side ? 0.12 : -0.12;
      P.forearm(ctx, x + (side ? 300 : -300), y - 300, x + Math.sin(rot) * 420, y - 440, LAN_SKIN[0], B.LAN_SHIRT, 70);
      F.cleaver(ctx, x, y, 1.15, rot);
      at(ctx, x + Math.sin(rot) * 420, y - 420, 0, 1, 1, () => { P.hand(ctx, 0, 0, 1.2, -Math.PI / 2 + rot, 'fist', LAN_SKIN, side === 1); });
    }
    if (hit > 0.5) { const r = rng(((lt / per) | 0) + 1); for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (r() - 0.5) * 2.4, v = 60 + r() * 160; ell(ctx, (ci ? 640 : 440) + Math.cos(a) * v * (1 - hit + 0.4), 1390 + Math.sin(a) * v * (1 - hit + 0.4), 7, 5); ctx.fillStyle = r() < 0.3 ? '#f6e4de' : '#d9787e'; ctx.fill(); } }
  });
  if (hit > 0.7) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; const cx = ci ? 640 : 440; for (let i = 0; i < 6; i++) { const a = Math.PI + i * 0.2 - 0.5 + (ci ? 0.3 : 0); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 140, 1410 + Math.sin(a) * 60); ctx.lineTo(cx + Math.cos(a) * 200, 1410 + Math.sin(a) * 90); ctx.stroke(); } ctx.restore(); }
  Tx.caption(ctx, T, 18.15, 20.9, 'Băm thịt', 'Mince the pork', { n: 2 });
}

// ============ S8 21–24 Top-down: marinade, seasonings on beats ============
function s8(ctx, lt, p, T) {
  darkBg(ctx, '#4a3018', '#1a0e06');
  const beats = [0.4, 0.9, 1.4, 1.9, 2.4];
  const k = (i) => ease.outBack(clamp((lt - beats[i]) / 0.25));
  const mixing = clamp((lt - 2.55) / 0.45);
  cam(ctx, 540, 900, lerp(1.0, 1.08, ease.inOut(p)), lerp(-0.1, 0.12, p) + mixing * 0.8, () => {
    woodTop(ctx);
    B.bowlTop(ctx, 540, 900, 400, (c, iR) => {
      B.minceTop(c, iR, 81, 260, 0.15 * (lt > beats[0] ? 1 : 0) + 0.35 * mixing);
      if (lt > beats[0]) { ell(c, 30, -20, iR * 0.45 * k(0), iR * 0.4 * k(0)); c.fillStyle = `rgba(170,90,20,${0.55 * (1 - mixing * 0.6)})`; c.fill(); }
      const r = rng(83);
      if (lt > beats[1]) for (let i = 0; i < 60; i++) { const a = r() * TAU, d = Math.sqrt(r()) * iR * 0.5; c.fillStyle = `rgba(255,255,255,${0.9 * (1 - mixing)})`; c.fillRect(-60 + Math.cos(a) * d * k(1), 40 + Math.sin(a) * d * k(1), 5, 5); }
      if (lt > beats[2]) for (let i = 0; i < 30; i++) { const a = r() * TAU, d = Math.sqrt(r()) * iR * 0.6; at(c, 80 + Math.cos(a) * d, -90 + Math.sin(a) * d, r() * 3 + mixing * 4, k(2), k(2), () => { ell(c, 0, 0, 12, 6); c.fillStyle = '#b05a8a'; c.fill(); ell(c, 0, 0, 7, 3); c.fillStyle = '#f0c8de'; c.fill(); }); }
      if (lt > beats[3]) for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * iR * 0.5; B.garlic(c, -100 + Math.cos(a) * d, -60 + Math.sin(a) * d, 1.4 * k(3)); }
      if (lt > beats[4]) for (let i = 0; i < 90; i++) { const a = r() * TAU, d = Math.sqrt(r()) * iR * 0.85; c.fillStyle = '#1a1210'; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 2.5 * k(4), 0, TAU); c.fill(); }
      if (mixing > 0) { c.save(); c.strokeStyle = `rgba(90,40,10,${0.5 * mixing})`; c.lineWidth = 6; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(0, 0, 60 + i * 55, lt * 6 + i, lt * 6 + i + 2.4); c.stroke(); } c.restore(); }
    });
    const fall = (i) => clamp((lt - (beats[i] - 0.3)) / 0.3);
    const f0 = fall(0); if (f0 > 0 && f0 < 1) { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(200,110,30,0.85)'; ctx.lineWidth = 26 * (1 - f0 * 0.5); ctx.beginPath(); ctx.moveTo(900, 300); ctx.quadraticCurveTo(700, 500, 570, 880); ctx.stroke(); ctx.restore(); }
    for (let i = 1; i < 5; i++) { const f = fall(i); if (f <= 0 || f >= 1) continue; const r = rng(90 + i); for (let j = 0; j < 14; j++) { const sx = 540 + (r() - 0.5) * 300, sz = lerp(3.2, 1, f); at(ctx, lerp(sx * 1.4 - 216, sx, f), lerp(-200, 900, f), j, sz, sz, () => { if (i === 1) { ctx.fillStyle = '#fff'; ctx.fillRect(-4, -4, 8, 8); } else if (i === 2) { ell(ctx, 0, 0, 12, 6); ctx.fillStyle = '#b05a8a'; ctx.fill(); } else if (i === 3) B.garlic(ctx, 0, 0, 1.4); else { ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); } }); } }
    beats.forEach((t0, i) => { if (lt > t0 && lt < t0 + 0.35) L.sparkle(ctx, 540 + Math.cos(i * 2.3) * 220, 900 + Math.sin(i * 2.3) * 220, 80, 1 - (lt - t0) / 0.35); });
  });
  glow(ctx, 860, 260, 800, 'rgba(255,225,160,0.6)', 0.45);
  Tx.caption(ctx, T, 21.15, 23.9, 'Ướp thịt', 'Fish sauce, sugar, shallot, pepper', { n: 3, esize: 36 });
}

// ============ S9 24–27 Low ¾ close: hands roll, press and line up patties ============
function s9(ctx, lt, p, T) {
  warmBokeh(ctx, T, lt * 30, 91, '#4a3420', '#160c06');
  glow(ctx, 860, 380, 800, 'rgba(255,220,160,0.65)', 0.6);
  const cyc = 0.75, ci = Math.min(3, Math.floor(lt / cyc)), u = clamp((lt - ci * cyc) / cyc);
  const roll = clamp(u / 0.5), press = bump(u, 0.5, 0.3), slide = clamp((u - 0.78) / 0.22);
  cam(ctx, lerp(500, 600, ease.inOut(p)), 1200, 1.15, 0, () => {
    F.board(ctx, 1250);
    for (let i = 0; i < ci + (slide >= 1 ? 1 : 0); i++) B.pattySide(ctx, 640 + i * 105, 1355, 1.25, 0, 0, 'vien');
    const px = lerp(400, 640 + ci * 105, ease.inOut(slide)), sq = u < 0.5 ? 0 : clamp((u - 0.5) / 0.2);
    if (slide < 1) at(ctx, px, lerp(1330, 1355, sq), 0, 1, 1, () => {
      if (sq < 1 && slide === 0) { ell(ctx, 0, -20 * (1 - sq), 48 + sq * 12, 48 - sq * 26); const g = ctx.createRadialGradient(-14, -34, 4, 0, -20, 56); g.addColorStop(0, '#f0a8a2'); g.addColorStop(1, '#b85a5e'); ctx.fillStyle = g; ctx.fill(); const r = rng(ci + 4); for (let i = 0; i < 12; i++) { ell(ctx, (r() - 0.5) * 70, -20 * (1 - sq) + (r() - 0.5) * 50 * (1 - sq * 0.5), 3, 2); ctx.fillStyle = 'rgba(255,230,225,0.7)'; ctx.fill(); } }
      else B.pattySide(ctx, 0, 0, 1.25, 0, 0, 'vien');
    });
    const a = roll * TAU * 1.5;
    P.forearm(ctx, 120, 1000, 330, 1220, LAN_SKIN[0], B.LAN_SHIRT, 66);
    if (u < 0.5) {
      P.hand(ctx, 370 + Math.cos(a) * 26, 1240 + Math.sin(a) * 12, 1.25, Math.PI * 0.08, 'flat', LAN_SKIN, false);
      P.hand(ctx, 490 - Math.cos(a) * 20, 1310, 1.2, Math.PI, 'flat', LAN_SKIN, true);
    } else if (slide === 0) {
      P.hand(ctx, 420, lerp(1150, 1300, press), 1.3, 0.1, 'flat', LAN_SKIN);
    }
  });
  Tx.caption(ctx, T, 24.15, 26.9, 'Vo chả viên', 'Shape the patties', { n: 4 });
}

// ============ S10 27–30 Top-down: open bamboo grill fills, then folds shut ============
function s10(ctx, lt, p, T) {
  darkBg(ctx, '#3a2614', '#140a04');
  const beats = [0.3, 0.6, 0.9, 1.2, 1.5, 1.8];
  const fold = ease.inOut(clamp((lt - 2.1) / 0.55));
  const thud = bump(lt, 2.62, 0.18);
  cam(ctx, lerp(560, 330, fold), 1000 + thud * 8, lerp(1.0, 1.15, ease.inOut(p)), -0.05, () => {
    woodTop(ctx, '#5a3a1e');
    B.grill(ctx, 330, 960, 1.55, 0, {
      fold, char: 0,
      items: (c) => {
        const slots = [[-95, -60, 'vien'], [-25, -60, 'vien'], [45, -60, 'vien'], [110, -60, 'vien'], [-60, 45, 'mieng'], [75, 45, 'mieng']];
        slots.forEach(([x, y, kind], i) => { const k = clamp((lt - (beats[i] - 0.2)) / 0.2); if (k <= 0) return; const sc = lerp(2.4, 1, ease.out(k)); c.save(); c.globalAlpha = k; B.patty(c, x, y, sc * (kind === 'vien' ? 0.85 : 0.9), i * 0.4, 0, kind, i + 11); c.restore(); });
      },
    });
    beats.forEach((t0, i) => { if (lt > t0 && lt < t0 + 0.3) L.sparkle(ctx, 330 + ((i % 4) - 1.5) * 90, 960 + (i < 4 ? -90 : 70), 60, 1 - (lt - t0) / 0.3); });
  });
  glow(ctx, 860, 260, 800, 'rgba(255,220,160,0.55)', 0.45);
  if (thud > 0.05) { ctx.save(); ctx.strokeStyle = `rgba(255,240,210,${0.6 * thud})`; ctx.lineWidth = 6; ctx.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(540 + Math.cos(a) * 330, 960 + Math.sin(a) * 260); ctx.lineTo(540 + Math.cos(a) * 400, 960 + Math.sin(a) * 320); ctx.stroke(); } ctx.restore(); }
  Tx.caption(ctx, T, 27.15, 29.9, 'Kẹp vỉ tre', 'Into the bamboo grill', { n: 5 });
}

module.exports = {
  s1, s2, s3, s4, s5, s6, s7, s8, s9, s10,
  bump, darkBg, warmBokeh, emberBg, bangLeaves, topBand, noonSky, coLan, tinyStoolTourist, chaSet, tableFood, streetGrill, bike, woodTop, BRZ, TOUR_SKIN, LAN_SKIN,
};
