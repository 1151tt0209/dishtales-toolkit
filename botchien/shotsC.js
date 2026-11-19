// Shots 21–28: the tourist meets the chili, fire breath, end card, CTA.
const L = require('./lib');
const P = require('./props');
const F = require('./food');
const K = require('./kitchen');
const Wd = require('./world');
const Pp = require('./people');
const Tx = require('./text');
const A = require('./shotsA');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, steam, flakes, sparkle } = L;
const { ell } = P;
const { stall, bump, shake, wood } = A;
const TSK = [Pp.SKIN[1], Pp.SKIN[2]];

function blurStall(ctx, T, blur, dark, o = {}) {
  P.layer(ctx, blur, (x) => cam(x, o.cx || 560, o.cy || 1100, o.z || 1.25, 0, () => stall(x, T, { head: { look: 0.5, mouth: 'smile' } })));
  ctx.fillStyle = `rgba(12,6,14,${dark})`; ctx.fillRect(0, 0, W, H);
}
// red flush rising from the chin (k 0..1) over a face drawn at (x,y,s)
function flush(ctx, x, y, s, k, tilt = 0) {
  if (k <= 0) return;
  at(ctx, x, y, tilt, s, s, () => {
    ctx.save(); ell(ctx, 0, -20, 172, 262); ctx.clip();
    const top = lerp(240, -300, k);
    const g = ctx.createLinearGradient(0, top - 60, 0, top + 80);
    g.addColorStop(0, 'rgba(255,40,30,0)'); g.addColorStop(1, 'rgba(255,40,30,1)');
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.85;
    ctx.fillStyle = g; ctx.fillRect(-200, top - 60, 400, 140);
    ctx.fillStyle = 'rgb(255,40,30)'; ctx.fillRect(-200, top + 80, 400, 400);
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.18 * k; ctx.fillStyle = '#ff6040'; ctx.fillRect(-200, -300, 400, 600);
    ctx.restore();
  });
}
function puff(ctx, x, y, t, seed, n, dir, a = 0.8) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.9 + r() * 0.4) + r()) % 1, sz = 20 + ph * 70;
    ctx.save(); ctx.globalAlpha = a * (1 - ph) * 0.8; ctx.fillStyle = '#f4f4f4';
    ell(ctx, x + dir * ph * 160 + Math.sin(ph * 6 + i) * 14, y - ph * 220, sz, sz); ctx.fill(); ctx.restore();
  }
}

// ============ S21 60.5–63.5 plate arrives, tourist rubs hands ============
function s21(ctx, lt, p, T) {
  blurStall(ctx, T, 14, 0.35, { cx: 600, cy: 1000, z: 1.4 });
  glow(ctx, 860, 420, 520, 'rgba(255,180,90,1)', 0.45);
  const arrive = ease.out(clamp((lt - 0.15) / 0.9));
  const wow = lt > 1.1;
  cam(ctx, lerp(560, 520, p), 960, lerp(1.0, 1.06, p), 0, () => {
    Pp.face(ctx, 560, 820, 0.95, {
      turn: -0.1, lookY: wow ? 0.8 : 0.2, lookX: wow ? 0 : -0.3, open: wow ? 1.15 : 1, pupil: wow ? 1.35 : 1, brow: wow ? 1 : 0.2,
      mouth: lt < 1.1 ? 'smile' : lt < 1.9 ? 'o' : 'grin', mOpen: 0.6, blush: wow ? 0.5 : 0, t: T,
      glassesFn: wow ? (c, gx) => sparkle(c, gx - 10, -6, 26, 0.8) : null,
    });
    // rubbing hands
    if (lt > 1.4) { const rb = Math.sin(T * 22) * 18; P.hand(ctx, 470 + rb, 1330, 1.5, -0.4, 'fist', TSK); P.hand(ctx, 650 - rb, 1340, 1.5, Math.PI + 0.4, 'fist', TSK, true); }
    // the table edge and plate (foreground)
    wood(ctx, 1500, H + 400, 211);
    const px = lerp(-420, 540, arrive);
    P.forearm(ctx, px - 820, 1600, px - 260, 1660, K.SAU[0], '#e9e4da', 110);
    K.plate(ctx, px, 1640, 1.3, 0.38, (c) => K.dish(c, 0, -10, 0.85, { k: 0.38, sauce: 1, t: T }));
    steam(ctx, T, 212, px, 1450, 500, 600, 12, 0.35);
  });
  if (wow) for (let i = 0; i < 5; i++) sparkle(ctx, 300 + i * 120, 470 + Math.sin(i * 2 + T * 3) * 40, 26 * bump(lt, 1.1 + i * 0.08, 0.8), 0.9);
}

// ============ S22 63.5–67 POV: "ketchup?" – floods the plate with chili ============
function s22(ctx, lt, p, T) {
  ctx.fillStyle = '#1a0e08'; ctx.fillRect(0, 0, W, H);
  const chili = clamp((lt - 0.6) / 2.6);
  cam(ctx, 540, 1100, lerp(1.0, 1.1, ease.inOut(p)), lerp(-0.04, 0.04, p), () => {
    wood(ctx, -400, H + 400, 221);
    glow(ctx, 540, 1250, 700, 'rgba(255,170,80,1)', 0.25);
    K.plate(ctx, 540, 1300, 1.9, 0.55, (c) => K.dish(c, 0, -10, 0.85, { k: 0.55, sauce: 1, chili, t: T }));
    const tilt = lerp(-1.9, -2.55, ease.out(clamp((lt - 0.2) / 0.4)));
    const bx = 900 + Math.sin(lt * 2.2) * 60, by = 700, s = 1.35, hh = 390 * s;
    const nx = bx + Math.sin(tilt) * hh, ny = by - Math.cos(tilt) * hh;
    const sq = lt > 0.6 && lt < 3.3 ? 0.5 + 0.5 * Math.sin(T * 10) : 0;
    if (lt > 0.6 && lt < 3.3) {
      ctx.save(); ctx.strokeStyle = '#d0201a'; ctx.lineCap = 'round'; ctx.lineWidth = 20 + sq * 10;
      const tx = 540 + Math.sin(lt * 2.2) * 200, ty = 1250 + Math.cos(lt * 3) * 80;
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx - 40, (ny + ty) / 2, tx, ty); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,170,150,0.6)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
      flakes(ctx, lt, 0.7, 222, 30, tx, ty, { g: 1500, speed: 380, life: 0.5, colors: ['#d0201a', '#ff4a30'], spread: 2.6, size: 6, stagger: 2.4 });
    }
    P.forearm(ctx, bx + 520, by + 560, bx + 60, by - 120, Pp.SKIN[1], Pp.SHIRT, 120);
    K.bottle(ctx, bx, by, s, 'chili', tilt, { squeeze: sq });
    P.hand(ctx, bx - 20, by - 190, 1.6, tilt + Math.PI / 2, 'fist', TSK);
  });
  Tx.line(ctx, T, 64.0, 66.8, 'Sốt cà chua hả?', 'Ketchup?', { y: 470, vsize: 76 });
}

// ============ S23 67–70.5 Sau panics: "that's SPICY!" – snap zoom ============
function s23(ctx, lt, p, T) {
  blurStall(ctx, T, 16, 0.4, { cx: 400, cy: 1300, z: 1.6 });
  glow(ctx, 220, 380, 600, 'rgba(255,170,90,1)', 0.5);
  const snap = ease.outExpo(clamp(lt / 0.35));
  const [dx, dy] = shake(T, 6 + 8 * bump(lt, 0.3, 0.3));
  const talk = lt > 0.5 && lt < 3.1 ? Math.abs(Math.sin(T * 13)) : 0.3;
  cam(ctx, 540 + dx, 1000 + dy, lerp(0.8, 1.05, snap) + p * 0.05, lerp(-0.08, 0.04, snap), () => {
    K.sau(ctx, 520, 2950, 2.7, { stop: 1, handR: [-240, -420], head: { eyes: 'wide', mouth: lt < 0.5 ? 'o' : 'talk', mOpen: 0.4 + 0.6 * talk, brow: 1, look: 0, rim: 1, sweat: 1, t: T } });
  });
  // shock lines
  ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = -2.6 + i * 0.25, r0 = 430 + 20 * Math.sin(T * 20 + i); ctx.beginPath(); ctx.moveTo(540 + Math.cos(a) * r0, 760 + Math.sin(a) * r0); ctx.lineTo(540 + Math.cos(a) * (r0 + 90), 760 + Math.sin(a) * (r0 + 90)); ctx.stroke(); }
  ctx.restore();
  Tx.line(ctx, T, 67.4, 70.3, 'Ê ê… cay lắm đó!', "Whoa, that's SPICY!", { y: 1450, vsize: 78 });
}

// ============ S24 70.5–73.5 the bite – face goes red; freeze 73.0–73.5 ============
function s24(ctx, lt0, p, T) {
  const lt = Math.min(lt0, 2.5), frz = lt0 > 2.5;
  blurStall(ctx, T, 18, 0.45, { cx: 700, cy: 900, z: 1.8 });
  glow(ctx, 880, 300, 600, 'rgba(255,180,90,1)', 0.5);
  const bring = ease.inOut(clamp((lt - 0.1) / 0.6));
  const chew = lt > 0.8 && lt < 2.1;
  const red = ease.inOut(clamp((lt - 1.1) / 1.3));
  const pop = lt > 2.15;
  cam(ctx, 540, 960, lerp(1.0, 1.12, ease.inOut(clamp(lt / 2.5))), 0.06, () => {
    const fx = 540, fy = 860, s = 1.35;
    Pp.face(ctx, fx, fy, s, {
      lookY: lt < 0.8 ? 0.6 : 0, lookX: lt < 0.8 ? 0.3 : 0,
      happyClosed: chew && !pop, open: pop ? 1.3 : 1, pupil: pop ? 0.55 : 1, brow: pop ? 1.4 : 0.3,
      mouth: lt < 0.8 ? 'o' : chew ? (Math.sin(lt * 18) > 0 ? 'sip' : 'neutral') : 'o', mOpen: lt < 0.8 ? 1 : 0.6, t: T, hairLift: pop ? 0.6 : 0,
    });
    flush(ctx, fx, fy, s, red);
    if (pop) { for (const sx of [-1, 1]) { ctx.save(); ctx.fillStyle = 'rgba(160,220,255,0.85)'; ell(ctx, fx + sx * 230, fy - 120 + (lt0 - 2.15) * 30, 14, 22); ctx.fill(); ctx.restore(); } }
    if (lt < 0.85) {
      const cx = lerp(900, fx + 20, bring), cy = lerp(1500, fy + 190 * s, bring);
      K.cube(ctx, cx, cy, 1.4, 0.2, { gold: 1, red: 1 });
      F.chopsticks(ctx, cx + 20, cy - 10, 1.8, -0.35, 0.03);
    }
  });
  if (frz) {
    ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.6; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const g = ctx.createRadialGradient(540, 900, 300, 540, 900, 1200); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const dots = Math.min(3, Math.floor((lt0 - 2.5) / 0.12) + 1); for (let i = 0; i < dots; i++) { ctx.beginPath(); ctx.arc(720 + i * 70, 330, 18, 0, TAU); ctx.fill(); }
  }
}

// ============ S25 73.5–77 FIRE breath, steam from ears, chugs iced tea ============
function s25(ctx, lt, p, T) {
  blurStall(ctx, T, 16, 0.35, { cx: 300, cy: 1100, z: 1.5 });
  const fire = lt < 1.9 ? clamp(lt / 0.1) * clamp((1.9 - lt) / 0.25) : 0;
  const drink = ease.inOut(clamp((lt - 1.75) / 0.4));
  const [dx, dy] = shake(T, 14 * fire);
  const fx = 700, fy = 860, s = 0.95, turn = -0.45;
  cam(ctx, 560 + dx, 960 + dy, lerp(1.08, 1.0, p), lerp(0.05, -0.03, p), () => {
    Pp.face(ctx, fx, fy, s, { turn, open: 1.3, pupil: 0.5, brow: 1.5, mouth: drink > 0.5 ? 'sip' : 'o', mOpen: 1, hairLift: 1, t: T, tilt: -0.08 });
    flush(ctx, fx, fy, s, 1 - 0.25 * drink, -0.08);
    // ear steam puffs
    const ex = 150 * s, eyy = fy + 25 * s;
    puff(ctx, fx - ex - 30 * s * 0.45, eyy, T * 1.6, 251, 5, -1, 0.9 * (1 - drink * 0.5));
    puff(ctx, fx + ex + 10, eyy, T * 1.6, 252, 5, 1, 0.9 * (1 - drink * 0.5));
    // fire from the mouth to the left
    const mx = fx + turn * 70 * 1.05 * s, my = fy + 150 * s;
    if (fire > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const r = rng(253);
      for (let i = 0; i < 70; i++) {
        const ph = (T * (2.2 + r()) + r()) % 1, len = 760 * fire, ang = Math.PI + 0.12 + (r() - 0.5) * 0.5 * ph;
        const x = mx + Math.cos(ang) * len * ph, y = my + Math.sin(ang) * len * ph - ph * ph * 120;
        const rad = (30 + ph * 120) * fire;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const c = ph < 0.3 ? '255,240,180' : ph < 0.6 ? '255,150,40' : '220,50,20';
        g.addColorStop(0, `rgba(${c},${0.55 * (1 - ph)})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.restore();
      glow(ctx, mx - 250, my, 600, 'rgba(255,140,40,1)', 0.5 * fire);
    }
    // iced tea glass coming up to the lips
    if (lt > 1.5) {
      const gx = lerp(980, mx + 20, drink), gy = lerp(1700, my + 260, drink);
      P.glass(ctx, gx, gy, 1.3, { tea: true, ice: [{ x: -30, y: -150, s: 0.9, r: 0.3 }, { x: 25, y: -120, s: 0.85, r: -0.4 }], drops: true, level: lerp(0.9, 0.15, clamp((lt - 2.2) / 1.1)), rot: lerp(0, -0.9, drink), t: T });
      P.hand(ctx, gx + 70, gy - 90, 1.4, Math.PI, 'fist', TSK, true);
    }
  });
  // white flash at the cut
  const fl = 1 - clamp(lt / 0.25);
  if (fl > 0) { ctx.fillStyle = `rgba(255,250,235,${fl})`; ctx.fillRect(0, 0, W, H); }
  const [tx, ty] = shake(T, 10 * fire, 41);
  ctx.save(); ctx.translate(tx, ty);
  Tx.line(ctx, T, 73.6, 75.6, 'CAYYY!', 'SO SPICY!', { y: 470, vsize: 130, esize: 52, vcol: '#ff6a3a' });
  ctx.restore();
}

// ============ S26 77–81 calms down: thumbs up, Sau laughs ============
function s26(ctx, lt, p, T) {
  blurStall(ctx, T, 14, 0.3, { cx: 640, cy: 1000, z: 1.35 });
  glow(ctx, 540, 380, 700, 'rgba(255,190,100,1)', 0.45);
  const tu = ease.outBack(clamp((lt - 0.8) / 0.4));
  const laugh = Math.sin(T * 14);
  cam(ctx, lerp(500, 580, ease.inOut(p)), 960, 1.0, lerp(0.03, -0.03, p), () => {
    // Sau laughing (back right)
    ctx.save(); ctx.fillStyle = K.SAU[0]; ctx.beginPath(); ctx.ellipse(810, 1300, 340, 300, 0, Math.PI, TAU); ctx.fill(); ctx.fillStyle = '#e9e4da'; ctx.beginPath(); ctx.moveTo(620, 1300); ctx.lineTo(660, 1020); ctx.quadraticCurveTo(810, 1110, 960, 1020); ctx.lineTo(1000, 1300); ctx.fill(); ctx.fillStyle = K.SAU[0]; ctx.beginPath(); ctx.moveTo(740, 960); ctx.quadraticCurveTo(810, 1090, 880, 960); ctx.lineTo(880, 900); ctx.lineTo(740, 900); ctx.fill(); ctx.restore();
    K.sauHead(ctx, 810, 700 + Math.abs(laugh) * 10, 1.9, { eyes: 'laugh', mouth: 'laugh', mOpen: 0.6 + 0.4 * Math.abs(laugh), look: -0.4, rim: 1, tilt: 0.12 + laugh * 0.04, t: T });
    // tourist (front left)
    const tx = 360, ty = 920, s = 0.85, red = lerp(0.9, 0.15, clamp(lt / 3));
    Pp.face(ctx, tx, ty, s, { turn: 0.25, happyClosed: lt > 1.0, mouth: lt > 1.0 ? 'grin' : 'smile', mOpen: 0.3, blush: 1, t: T, tilt: 0.05 });
    flush(ctx, tx, ty, s, red, 0.05);
    puff(ctx, tx + 150 * s, ty + 20, T, 261, 3, 1, 0.5 * clamp(1 - lt / 2));
    if (tu > 0) at(ctx, 640, 1240, 0, tu, tu, () => Pp.thumbsUp(ctx, 0, 0, 1.7, -0.1));
    if (tu > 0.9) sparkle(ctx, 650, 1050, 40 * bump(lt, 1.2, 0.6), 1);
  });
  Tx.line(ctx, T, 77.8, 80.8, 'Cay mà ghiền!', 'Hot… but addictive!', { y: 1460, vsize: 80 });
}

// ============ S27 81–84.5 crane up over the night city + end card ============
function s27(ctx, lt, p, T) {
  const cy = lerp(1750, 1000, ease.inOut(p)), z = lerp(1.15, 1.0, ease.inOut(p));
  cam(ctx, 540, cy, z, lerp(0.03, 0, p), () => {
    Wd.drawAerialNight(ctx, 1);
    for (const [x, y, , k] of A.LAMPS) { const sc = 0.4 + (y - 1150) / 1500; glow(ctx, x, y, 70 * sc, k < 0.7 ? 'rgba(255,190,90,1)' : 'rgba(180,230,255,1)', 0.7 * (0.85 + 0.15 * Math.sin(T * 9 + k * 20))); }
    // the stall's bulb glowing a little brighter, bottom centre
    glow(ctx, 560, 2350, 140, 'rgba(255,210,130,1)', 0.8);
  });
  { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(10,6,18,0.15)'); g.addColorStop(0.6, 'rgba(10,6,18,0.25)'); g.addColorStop(1, 'rgba(10,6,18,0.6)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  dust(ctx, T, 271, 26, 0, 0, W, H, '255,220,170', 2, 0.25);
  Tx.endCard(ctx, T, 82.0);
}

// ============ S28 84.5–90 CTA ============
function s28(ctx, lt, p, T) {
  blurStall(ctx, T, 14, lerp(0.35, 0.65, clamp(lt / 1.5)), { cx: 560, cy: 1050, z: 1.3 });
  const wink = T > 86.5 && T < 86.95;
  const up = ease.out(clamp(lt / 0.6));
  Pp.face(ctx, 540, lerp(1300, 1130, up), 0.55, { mouth: 'grin', mOpen: 0.3, openR: wink ? 0 : 1, brow: wink ? 0.5 : 0.2, blush: 0.5, t: T });
  const tu = ease.outBack(clamp((lt - 0.5) / 0.4));
  if (tu > 0) at(ctx, 300, 1270, 0, -tu, tu, () => Pp.thumbsUp(ctx, 0, 0, 1.1, 0.12));
  Tx.cta(ctx, T);
}

module.exports = { s21, s22, s23, s24, s25, s26, s27, s28 };
