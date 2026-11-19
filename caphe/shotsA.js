// Shots 1–9: Saigon wakes + the art of the phin.
const L = require('./lib');
const P = require('./props');
const Wd = require('./world');
const Pp = require('./people');
const Tx = require('./text');
const { W, H, TAU, rng, clamp, lerp, inv, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, motionBlurX } = L;
const { ell } = P;

const bump = (t, t0, d) => (t < t0 || t > t0 + d ? 0 : Math.sin(Math.PI * (t - t0) / d));
const UNCLE_SKIN = ['#b07a52', '#7a4a2c'];
const TOUR_SKIN = ['#f2c3a0', '#c97c5e'];

// pointing hand whose fingertip lands on (tx,ty); th = direction the finger points; forearm trails behind
function pointAt(ctx, tx, ty, th, s, skin, sleeve, armCol) {
  const c = Math.cos(th), sn = Math.sin(th);
  const ox = tx - s * (90 * c + 22 * sn), oy = ty - s * (90 * sn - 22 * c);
  const wx = ox - s * 55 * c, wy = oy - s * 55 * sn;
  P.forearm(ctx, wx - c * 900, wy - sn * 900, wx, wy, armCol, sleeve, 78 * s);
  P.hand(ctx, ox, oy, s, th, 'point', skin);
}
// curved pour from (x0,y0) to (x1,y1)
function pour(ctx, x0, y0, x1, y1, w, kind, t, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
  const cx = lerp(x0, x1, 0.92), cy = y0 + (y1 - y0) * 0.08;
  const path = (dx) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx + dx, cy, x1 + dx * 0.4, y1); };
  const wob = Math.sin(t * 37) * 1.5;
  if (kind === 'water') {
    ctx.lineWidth = w; ctx.strokeStyle = 'rgba(205,230,240,0.42)'; path(wob); ctx.stroke();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = w * 0.3; ctx.strokeStyle = 'rgba(255,248,230,0.95)'; path(wob - w * 0.2); ctx.stroke();
  } else {
    ctx.lineWidth = w; ctx.strokeStyle = '#1e0c05'; path(wob); ctx.stroke();
    ctx.lineWidth = w * 0.55; ctx.strokeStyle = '#4a2410'; path(wob); ctx.stroke();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = w * 0.16; ctx.strokeStyle = 'rgba(255,180,110,0.8)'; path(wob - w * 0.2); ctx.stroke();
  }
  ctx.restore();
}
function darkBg(ctx, c0, c1) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function embers(ctx, t, seed, n, x, y, w, h) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.4 + r() * 0.6, bx = (r() - 0.5) * w, sz = 2 + r() * 4;
    const life = (t * sp + ph) % 1;
    const px = x + bx + Math.sin(t * 3 + i) * 30 * life, py = y - life * h;
    ctx.globalAlpha = (1 - life) * 0.95;
    ctx.fillStyle = `rgba(255,${150 + r() * 90 | 0},60,1)`;
    ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU); ctx.fill();
    glow(ctx, px, py, sz * 5, 'rgba(255,120,30,0.6)', (1 - life) * 0.6);
  }
  ctx.restore();
}

// ============ S1 0–2.5 Aerial dawn ============
function s1(ctx, lt, p, T) {
  const cy = lerp(1020, 1640, ease.inOut(p)), z = lerp(1.0, 1.07, p);
  cam(ctx, 540, cy, z, 0, () => {
    Wd.drawAerial(ctx);
    // sun behind first rows
    glow(ctx, 640, 1095, 520, 'rgba(255,190,110,0.85)', 0.85);
    glow(ctx, 640, 1095, 120, 'rgba(255,248,225,1)', 1);
    // birds
    for (let i = 0; i < 6; i++) {
      const bx = -100 + ((lt * (120 + i * 25) + i * 210) % 1400), by = 960 + i * 34 + Math.sin(lt * 3 + i) * 10;
      Wd.sparrow(ctx, bx, by, 0.7, lt * 18 + i, false);
    }
  });
  // morning haze
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const hz = ctx.createLinearGradient(0, 700, 0, 1500); hz.addColorStop(0, 'rgba(255,200,140,0)'); hz.addColorStop(0.5, 'rgba(255,200,140,0.18)'); hz.addColorStop(1, 'rgba(255,200,140,0)');
  ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H); ctx.restore();
  // foreground wires (parallax faster than the city)
  const wy = lerp(1500, 260, ease.inOut(p));
  Wd.wires(ctx, -60, wy, 1140, wy - 140, 6, 31, 120, '#120c08', lt);
  for (let i = 0; i < 4; i++) Wd.sparrow(ctx, 260 + i * 120, wy + 18 + i * -38 + 40, 1.2, i === 1 && lt > 1.6 ? lt * 20 : null, i % 2);
  flare(ctx, 640, (1095 - cy) * z + 960, 0.9, 0.35 + 0.5 * bump(lt, 1.4, 0.9));
  dust(ctx, lt, 3, 40, 0, 0, W, H, '255,220,170', 2.5, 0.5);
  Tx.label(ctx, T, 0.7, 2.45, 'SÀI GÒN · 5:30 SÁNG', 'Saigon · 5:30 AM', 1360);
  // fade in from black
  if (lt < 0.7) { ctx.fillStyle = `rgba(0,0,0,${1 - ease.out(lt / 0.7)})`; ctx.fillRect(0, 0, W, H); }
}

// ============ S2 2.5–4.5 Street level ============
function streetScene(ctx, lt, T, o = {}) {
  Wd.drawStreet(ctx);
  godRays(ctx, -120, 120, 0.85, 0.55, 2000, 8, 'rgba(255,205,140,0.5)', 0.35, T);
  // café set
  P.stool(ctx, 150, 1345, 1, '#d63a2f');
  P.lowTable(ctx, 330, 1340, 1);
  if (o.tableProps) o.tableProps(ctx);
  Wd.uncle(ctx, 870, 1300, 0.95, { sil: true, nod: o.nod || 0, rim: 0.85 });
  Wd.cart(ctx, 870, 1330, 1, T);
  // stove + kettle steaming
  P.stove(ctx, 640, 1205, 0.3, T);
  P.kettle(ctx, 640, 1180, 0.32, 0);
  steam(ctx, T, 8, 700, 1130, 60, 320, 6, 0.3);
  P.stool(ctx, 520, 1345, 1, '#2f6fd6');
}
function s2(ctx, lt, p, T) {
  const z = lerp(1.0, 1.07, ease.inOut(p));
  cam(ctx, 540, lerp(1010, 1060, p), z, 0, () => {
    streetScene(ctx, lt, T);
    // tourist walks in from right, sits
    const wt = clamp(lt / 1.1), x = lerp(1180, 560, ease.out(wt) * 0.6 + wt * 0.4);
    const sit = ease.inOut(clamp((lt - 1.1) / 0.45));
    Pp.tourist(ctx, lerp(x, 520, sit), 1345, 1, { walk: sit > 0 ? null : (1180 - x) / 40, sit, look: lt > 1.7 ? -0.12 : 0 });
  });
  // motorbikes (speed-ramped, motion blurred) in the foreground road
  const bike = (tc, y, s, dir, cols, seed) => {
    const u = (T - tc) / 0.32;
    if (Math.abs(u) > 2.2) return;
    const x = 540 + dir * 820 * u * Math.abs(u) * 0.55 + dir * 120 * u;
    const v = Math.abs(u) * 1.6 + 0.2;
    ctx.save();
    for (let i = 0; i < 7; i++) {
      ctx.globalAlpha = i === 0 ? 0.95 : 0.22;
      Wd.motorbike(ctx, x - dir * i * v * 22, y, s, dir < 0, T, cols);
    }
    ctx.restore();
  };
  bike(2.7, 1900, 1.25, 1, { body: '#c0392b', helm: '#f1c40f', jacket: '#34495e' });
  bike(3.5, 1700, 0.85, -1, { body: '#2e86de', helm: '#ecf0f1', jacket: '#7d5a3c' });
  dust(ctx, T, 5, 30, 0, 0, W, H, '255,220,170', 2.5, 0.45);
}

// ============ S3 4.5–7 Menu, finger, uncle nods ============
function s3a(ctx, lt, T) {
  // background street (shallow DoF)
  P.layer(ctx, 16, (x) => cam(x, 760, 1020, 2.0, 0, () => streetScene(x, lt, T)));
  ctx.fillStyle = 'rgba(20,10,5,0.25)'; ctx.fillRect(0, 0, W, H);
  const rack = ease.inOut(clamp((lt - 0.45) / 0.45));
  // menu board
  P.layer2(ctx, rack * 9, (x) => {
    Wd.menuBoard(x, 470, 640, 0.98, -0.035);
    // annotation for foreign viewers
    x.save(); x.globalAlpha = clamp((lt - 0.15) / 0.3) * (1 - rack * 0.4);
    x.strokeStyle = '#ffd36b'; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(760, 410); x.quadraticCurveTo(830, 500, 735, 555); x.stroke();
    x.beginPath(); x.moveTo(735, 555); x.lineTo(752, 532); x.moveTo(735, 555); x.lineTo(762, 562); x.stroke();
    x.font = '38px BodySansBold'; x.fillStyle = '#fff2cf'; x.textAlign = 'center'; x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 10;
    x.fillText('Black coffee · 15,000₫', 700, 380);
    x.restore();
  });
  // tourist face
  P.layer(ctx, (1 - rack) * 10, (x) => {
    const fing = ease.outBack(clamp((lt - 1.0) / 0.4));
    Pp.face(x, 520, 1270, 1.25, { lookX: -0.35, lookY: -0.9, brow: lt > 1.0 ? 0.6 : 0.35, mouth: lt > 1.05 ? 'smile' : 'o', mOpen: 0.2, t: T, turn: -0.12 });
    if (fing > 0) {
      pointAt(x, 850, lerp(2000, 1150, fing), -Math.PI / 2 + 0.12, 1.3, TOUR_SKIN, '#2f8f8a', TOUR_SKIN[1]);
    }
  });
}
function s3b(ctx, lt, T) {
  // uncle silhouette behind steam, warm backlight
  darkBg(ctx, '#f6c58a', '#5a3a28');
  glow(ctx, 300, 520, 900, 'rgba(255,220,160,0.9)', 0.9);
  godRays(ctx, 300, 480, 1.1, 1.2, 2000, 10, 'rgba(255,215,150,0.6)', 0.45, T);
  bokeh(ctx, T, 51, 14, ['rgba(255,220,160,0.9)', 'rgba(255,180,100,0.8)'], 0.35, 40, 140);
  const nod = bump(lt, 0.25, 0.45);
  Wd.uncle(ctx, 560, 2250, 3.0, { sil: true, nod, rim: 1 });
  steam(ctx, T, 21, 420, 1650, 500, 1100, 14, 0.55);
  steam(ctx, T * 0.7, 22, 700, 1800, 600, 1300, 10, 0.4);
  dust(ctx, T, 9, 40, 0, 0, W, H, '255,230,190', 3, 0.6);
}
function s3(ctx, lt, p, T) {
  const sw = 1.6; // whip at local 1.6..1.85
  if (lt < sw) {
    const dx = lt > sw - 0.15 ? -ease.in((lt - (sw - 0.15)) / 0.15) * 900 : 0;
    if (dx) motionBlurX(ctx, dx, 8, (x) => s3a(x, lt, T)); else s3a(ctx, lt, T);
  } else {
    const k = clamp((lt - sw) / 0.18), dx = (1 - ease.out(k)) * 900;
    if (dx > 2) motionBlurX(ctx, dx, 8, (x) => s3b(x, lt - sw, T)); else s3b(ctx, lt - sw, T);
  }
}

// ============ S4 7–9.5 Roasting ============
const BEANS = (() => { const r = rng(61), a = []; for (let i = 0; i < 95; i++) { const u = r() * 2 - 1; a.push({ x: u * 200, y: 6 + r() * 34 - (1 - u * u) * 26, r: r() * TAU, s: r() }); } return a; })();
function s4(ctx, lt, p, T) {
  darkBg(ctx, '#140904', '#3a1a0a');
  bokeh(ctx, T, 41, 16, ['rgba(255,140,50,0.9)', 'rgba(255,200,120,0.8)', 'rgba(255,90,30,0.8)'], 0.35, 30, 110);
  const shake = bump(lt, 0, 0.25) * 10;
  const z = lerp(1.0, 1.12, ease.inOut(p));
  cam(ctx, 540 + Math.sin(T * 60) * shake, 1180 + Math.cos(T * 53) * shake, z, 0, () => {
    glow(ctx, 540, 1250, 650, 'rgba(255,110,30,0.8)', 0.6);
    P.stove(ctx, 540, 1230, 1.25, T);
    const tossA = bump(lt, 0.45, 0.4), tossB = bump(lt, 1.45, 0.4), toss = tossA + tossB;
    const wy = 1150 - toss * 46, wr = -toss * 0.09;
    const butter = clamp(1 - lt / 1.6);
    P.wok(ctx, 540, wy, 1.25, wr, () => {
      for (const b of BEANS) P.bean(ctx, b.x, b.y, 1.15, b.r, b.s, 0.8);
      if (butter > 0) {
        ctx.save(); ctx.globalAlpha = butter;
        for (const [bx, by, br] of [[-40, 18, 46], [60, 26, 30], [-120, 30, 22]]) {
          ell(ctx, bx, by, br, br * 0.35); ctx.fillStyle = 'rgba(250,215,110,0.85)'; ctx.fill();
          ell(ctx, bx - br * 0.3, by - 4, br * 0.3, br * 0.1); ctx.fillStyle = 'rgba(255,250,220,0.9)'; ctx.fill();
        }
        ctx.restore();
      }
      // glossy rim light on beans
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
      ell(ctx, -60, 10, 170, 20); ctx.fillStyle = 'rgba(255,170,90,0.35)'; ctx.fill(); ctx.restore();
    });
    // airborne beans (slow motion)
    for (const [t0, seed] of [[0.45, 3], [1.45, 4]]) {
      const age = (lt - t0) * 0.55;
      if (age < 0 || age > 0.75) continue;
      const r = rng(seed);
      for (let i = 0; i < 26; i++) {
        const vx = (r() - 0.5) * 520, vy = 700 + r() * 380, x0 = 540 + (r() - 0.5) * 300;
        const bx = x0 + vx * age, by = wy - vy * age + 0.5 * 2600 * age * age;
        if (by > wy + 10) { r(); r(); continue; }
        P.bean(ctx, bx, by, 1.35, r() * TAU + age * (r() - 0.5) * 20, r(), 1);
      }
    }
    embers(ctx, T, 5, 34, 540, 1250, 520, 900);
    steam(ctx, T, 33, 540, 1080, 300, 700, 8, 0.18);
  });
  Tx.title(ctx, T, 7.0, 9.15, 430);
  Tx.caption(ctx, T, 7.7, 9.45, 'Rang với bơ', 'Butter-roasted', { n: 1 });
}

// ============ S5 9.5–12 Grinder ============
function grinder(ctx, x, y, s, ang, fill, t) {
  at(ctx, x, y, 0, s, s, () => {
    const k = 0.32;
    // box (front face + top face)
    const wd = ctx.createLinearGradient(-190, 0, 190, 0); wd.addColorStop(0, '#5a3218'); wd.addColorStop(0.3, '#9a5a2e'); wd.addColorStop(1, '#3a1f0e');
    ctx.fillStyle = wd; ctx.fillRect(-190, 0, 380, 330);
    ctx.strokeStyle = 'rgba(40,20,8,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(-190, 20 + i * 26); ctx.bezierCurveTo(-60, 10 + i * 26 + Math.sin(i) * 8, 60, 30 + i * 26, 190, 18 + i * 26); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-190, 0); ctx.lineTo(-130, -70); ctx.lineTo(250, -70); ctx.lineTo(190, 0); ctx.closePath(); ctx.fillStyle = '#b06c3a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(190, 0); ctx.lineTo(250, -70); ctx.lineTo(250, 260); ctx.lineTo(190, 330); ctx.closePath(); ctx.fillStyle = '#2e180a'; ctx.fill();
    // brass chute
    ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.moveTo(-40, 300); ctx.lineTo(40, 300); ctx.lineTo(26, 380); ctx.lineTo(-26, 380); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.6)'; ctx.fillRect(-30, 304, 10, 70);
    // cast-iron hopper
    const cx = 30, cy = -35;
    ctx.beginPath(); ctx.moveTo(cx - 150, cy - 120); ctx.quadraticCurveTo(cx - 120, cy + 20, cx, cy + 25); ctx.quadraticCurveTo(cx + 120, cy + 20, cx + 150, cy - 120); ctx.closePath();
    const ig = ctx.createLinearGradient(cx - 150, 0, cx + 150, 0); ig.addColorStop(0, '#1b1b1d'); ig.addColorStop(0.3, '#6a6a70'); ig.addColorStop(1, '#141416');
    ctx.fillStyle = ig; ctx.fill();
    ell(ctx, cx, cy - 120, 150, 150 * k); ctx.fillStyle = '#2a2a2c'; ctx.fill();
    ctx.save(); ell(ctx, cx, cy - 120, 140, 140 * k); ctx.clip();
    const r = rng(8);
    for (let i = 0; i < 70; i++) { const u = r() * 2 - 1, v = r(); P.bean(ctx, cx + u * 130, cy - 120 + (v - 0.5) * 80 * k + (1 - fill) * 30 + Math.sin(t * 6 + i) * 1.5, 1.2, r() * TAU + (t * 0.5) * (r() - 0.5), r(), 0.9); }
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#8a8a90'; ell(ctx, cx, cy - 120, 150, 150 * k); ctx.stroke();
    // shaft + crank
    const sx = cx, sy = cy - 150;
    const ex = sx + Math.cos(ang) * 190, ey = sy - 40 + Math.sin(ang) * 190 * k;
    const behind = Math.sin(ang) < 0;
    const crank = () => {
      ctx.strokeStyle = '#222225'; ctx.lineWidth = 16; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy - 40); ctx.lineTo(ex, ey); ctx.stroke();
      const kg = ctx.createLinearGradient(ex - 18, 0, ex + 18, 0); kg.addColorStop(0, '#5a2f12'); kg.addColorStop(0.4, '#c07a3e'); kg.addColorStop(1, '#4a250e');
      ctx.fillStyle = kg; ctx.beginPath(); ctx.roundRect(ex - 18, ey - 90, 36, 92, 16); ctx.fill();
    };
    if (behind) crank();
    ctx.fillStyle = '#3a3a3e'; ctx.fillRect(sx - 10, sy - 50, 20, 60);
    ell(ctx, sx, sy - 50, 22, 9); ctx.fillStyle = '#c9a24a'; ctx.fill();
    if (!behind) crank();
    return [ex, ey];
  });
  const ex = x + s * (30 + Math.cos(ang) * 190), ey = y + s * (-35 - 150 - 40 + Math.sin(ang) * 190 * 0.32);
  return [ex, ey - 60 * s];
}
function s5(ctx, lt, p, T) {
  darkBg(ctx, '#3a2414', '#120804');
  glow(ctx, 200, 500, 900, 'rgba(255,200,130,0.75)', 0.8);
  godRays(ctx, 120, 300, 0.9, 0.9, 2200, 9, 'rgba(255,215,150,0.55)', 0.5, T);
  const tilt = ease.inOut(clamp((lt - 1.0) / 0.8));
  const cy = lerp(860, 1300, tilt), z = lerp(1.0, 1.25, tilt);
  cam(ctx, 540, cy, z, 0, () => {
    // table surface
    const tg = ctx.createLinearGradient(0, 1150, 0, 1900); tg.addColorStop(0, '#5a3820'); tg.addColorStop(1, '#2a170a');
    ctx.fillStyle = tg; ctx.fillRect(-400, 1180, 1900, 900);
    const ang = lt * Math.PI * 2 / 1.0 + 0.4;
    const knob = grinder(ctx, 520, 790, 1.15, ang, 1 - lt * 0.05, T);
    // uncle's forearm on the crank
    P.forearm(ctx, 1250, knob[1] - 160, knob[0] + 40, knob[1] + 20, UNCLE_SKIN[0], '#e9e4da', 78);
    P.hand(ctx, knob[0] + 10, knob[1] + 20, 1.05, Math.PI * 0.95, 'fist', UNCLE_SKIN);
    // powder stream from chute into a bowl
    const chx = 520, chy = 790 + 380 * 1.15;
    const r = rng(19);
    ctx.save();
    for (let i = 0; i < 260; i++) {
      const ph = r(), sp = 0.8 + r() * 0.4, life = (T * sp * 1.3 + ph) % 1;
      const px = chx + (r() - 0.5) * 22 + Math.sin(T * 7 + i) * 3 * life, py = chy + life * 300;
      ctx.fillStyle = r() < 0.5 ? '#4a2c18' : '#7a5236';
      ctx.fillRect(px, py, 2.5, 2.5);
    }
    ctx.restore();
    // golden dust in the backlight
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 80; i++) { const ph = r(), life = (T * 0.25 + ph) % 1; const px = chx - 120 + r() * 260 + Math.sin(T + i) * 20, py = chy + 280 - life * 380; ctx.globalAlpha = Math.sin(life * Math.PI) * 0.8; ctx.fillStyle = 'rgba(255,215,150,1)'; ctx.beginPath(); ctx.arc(px, py, 1.5 + r() * 2.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    // bowl with growing heap
    const bx = chx, by = chy + 330;
    ell(ctx, bx, by + 10, 170, 40); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx, by - 30, 160, 34, 0, 0, Math.PI); ctx.lineTo(bx - 120, by + 30); ctx.quadraticCurveTo(bx, by + 60, bx + 120, by + 30); ctx.closePath();
    const bg = ctx.createLinearGradient(bx - 160, 0, bx + 160, 0); bg.addColorStop(0, '#e9e3d6'); bg.addColorStop(0.3, '#fffaf0'); bg.addColorStop(1, '#a9a49a');
    ctx.fillStyle = bg; ctx.fill();
    ell(ctx, bx, by - 30, 160, 34); ctx.fillStyle = '#efe9dd'; ctx.fill();
    const heap = 0.4 + lt * 0.25;
    ctx.beginPath(); ctx.ellipse(bx, by - 30, 130, 26, 0, 0, TAU); ctx.fillStyle = '#4a2c18'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 130, by - 30); ctx.quadraticCurveTo(bx, by - 30 - 60 * heap, bx + 130, by - 30); ctx.fillStyle = '#5a3820'; ctx.fill();
  });
  dust(ctx, T, 12, 30, 0, 0, W, H, '255,220,170', 2.5, 0.5);
  Tx.caption(ctx, T, 9.7, 11.9, 'Xay mịn', 'Ground fine', { n: 2 });
}

// ============ S6 12–14 Warm the phin ============
function cafeBokeh(ctx, T, shift = 0) {
  darkBg(ctx, '#4a2c1a', '#1a0d06');
  ctx.save(); ctx.translate(shift, 0);
  bokeh(ctx, T, 77, 22, ['rgba(255,190,110,0.9)', 'rgba(255,230,170,0.8)', 'rgba(120,200,220,0.6)'], 0.32, 30, 120);
  ctx.restore();
}
function tableTop(ctx, y) {
  const g = ctx.createLinearGradient(0, y, 0, H); g.addColorStop(0, '#6a4024'); g.addColorStop(1, '#2a160a');
  ctx.fillStyle = g; ctx.fillRect(-500, y, 2100, 1500);
  ctx.strokeStyle = 'rgba(30,15,5,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(-500, y + 20 + i * 40); ctx.bezierCurveTo(200, y + 10 + i * 42, 600, y + 30 + i * 38, 1600, y + 20 + i * 41); ctx.stroke(); }
}
function s6(ctx, lt, p, T) {
  cafeBokeh(ctx, T, -lt * 40);
  glow(ctx, 260, 400, 800, 'rgba(255,200,130,0.7)', 0.7);
  const z = lerp(1.0, 1.06, p);
  cam(ctx, 540, 1000, z, 0, () => {
    tableTop(ctx, 1480);
    const gs = 1.5, gy = 1620;
    P.glass(ctx, 540, gy, gs, { level: 0.12 * clamp(lt / 1.5), colors: ['#c9b8a0', '#8a7a68', '#5a4a3a'], drops: 0 });
    const [, gt] = P.glassTop(540, gy, gs);
    P.phin(ctx, 540, gt - 4, gs, { k: 0.3 });
    // kettle pouring from upper left
    const kr = lerp(0.25, 0.62, ease.out(clamp(lt / 0.4)));
    const kx = 250, ky = 520;
    P.forearm(ctx, -120, 300, kx - 20, ky - 120, UNCLE_SKIN[0], '#e9e4da', 80);
    P.kettle(ctx, kx, ky, 1.15, kr);
    P.hand(ctx, kx - 10, ky - 120, 1.0, 0.2, 'fist', UNCLE_SKIN);
    const [sx, sy] = P.kettleSpout(kx, ky, 1.15, kr);
    const [, ty] = P.phinTop(540, gt - 4, gs);
    const on = clamp((lt - 0.2) / 0.15) * clamp((1.6 - lt) / 0.2);
    if (on > 0) { pour(ctx, sx, sy, 540, ty + 10, 16, 'water', T, on); P.splash(ctx, 540, ty + 6, T, 4, 'water', 12); }
    // water running through into the glass
    const [bx, by] = P.phinBottom(540, gt - 4, gs);
    if (lt > 0.45) { ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = 'rgba(220,235,240,0.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, gy - 40); ctx.stroke(); ctx.restore(); }
    steam(ctx, T, 61, 540, ty, 200, 700, 12, 0.45);
    steam(ctx, T * 1.2, 62, 520, gy - 200, 260, 400, 6, 0.25);
  });
  Tx.caption(ctx, T, 12.15, 13.9, 'Tráng phin', 'Warm the phin', { n: 3 });
}

// ============ S7 14–17 Spoonfuls ============
function s7(ctx, lt, p, T) {
  // top-down-ish: wooden table
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#7a4a28'); g.addColorStop(1, '#2a160a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(30,15,5,0.3)'; ctx.lineWidth = 3;
  for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.moveTo(0, i * 70); ctx.bezierCurveTo(300, i * 70 + 20, 700, i * 70 - 20, W, i * 70 + 10); ctx.stroke(); }
  glow(ctx, 250, 300, 900, 'rgba(255,200,130,0.6)', 0.6);
  const shakeX = lt > 2.4 && lt < 2.85 ? Math.sin((lt - 2.4) * 70) * 12 * (1 - (lt - 2.4) / 0.45) : 0;
  const tapY = bump(lt, 2.0, 0.12) * 3;
  const z = lerp(1.0, 1.05, p);
  cam(ctx, 540, 960, z, 0, () => {
    ctx.save(); ctx.filter = 'blur(24px)'; ell(ctx, 590, 1240, 330, 250); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
    const lv = lerp(0, 0.22, ease.out(clamp((lt - 0.4) / 0.2))) + lerp(0, 0.2, ease.out(clamp((lt - 1.2) / 0.2)));
    P.phin(ctx, 540 + shakeX, 1150 + tapY, 2.0, { k: 0.78, fill: { level: lv, kind: 'dry' } });
    const [, ty] = P.phinTop(540, 1150, 2.0, 0.78);
    // spoons
    const spoonPass = (t0, heapT) => {
      const k = lt - t0;
      if (k < -0.45 || k > 0.55) return;
      const inK = ease.out(clamp((k + 0.45) / 0.4)), outK = ease.in(clamp((k - 0.15) / 0.4));
      const x = lerp(1250, 600, inK) + outK * 700, y = lerp(700, ty + 20, inK) - outK * 200;
      const tip = ease.inOut(clamp((k + 0.05) / 0.2));
      P.spoon(ctx, x, y, 1.6, -0.35 - tip * 0.9, (1 - tip) * 1);
      if (k > 0 && k < 0.5) L.flakes(ctx, lt, t0, 30 + t0 * 10, 40, 560, ty + 30, { g: -120, speed: 160, life: 0.6, size: 3, spread: 3.2, angle: -Math.PI / 2 });
      if (k > -0.05 && k < 0.15) {
        const r = rng(8 + t0 * 10);
        for (let i = 0; i < 70; i++) { const fx = x - 40 + r() * 80, fy = y + (k + 0.05) * 1400 * r(); ctx.fillStyle = r() < 0.5 ? '#3b2416' : '#6a4a30'; ctx.fillRect(fx, fy, 3, 3); }
      }
    };
    spoonPass(0.4, 1); spoonPass(1.2, 1);
    // tap with handle at 2.0
    if (lt > 1.75 && lt < 2.35) {
      const k = lt - 1.75;
      P.spoon(ctx, lerp(1300, 830, ease.out(clamp(k / 0.25))) + ease.in(clamp((k - 0.35) / 0.25)) * 600, ty - 40 + bump(lt, 1.98, 0.1) * 24, 1.6, 0.25, 0);
    }
    // powder puff after each spoon
    for (const t0 of [0.42, 1.22]) {
      const k = lt - t0; if (k < 0 || k > 1.2) continue;
      ctx.save(); ctx.globalAlpha = (1 - k / 1.2) * 0.4;
      for (let i = 0; i < 5; i++) glow(ctx, 540 + Math.cos(i * 1.3) * 80 * k, ty + 20 - k * 140 - i * 10, 90 + k * 120, 'rgba(160,110,70,0.6)', 1, 'source-over');
      ctx.restore();
    }
  });
  Tx.caption(ctx, T, 14.2, 16.9, '2 muỗng (~20g)', '2 spoons (~20g)', { n: 4 });
}

// ============ S8 17–19 Press ============
function s8(ctx, lt, p, T) {
  cafeBokeh(ctx, T, 0);
  glow(ctx, 280, 420, 800, 'rgba(255,200,130,0.65)', 0.7);
  const click = bump(lt, 1.4, 0.12) * 5;
  cam(ctx, 540, 1080 + click, lerp(1.05, 1.15, p), 0, () => {
    tableTop(ctx, 1560);
    const gs = 2.2, gx = 540, py = 1300;
    P.glass(ctx, gx, 1700, 2.2, { level: 0, k: 0.45 });
    const lift = lerp(260, 0, ease.inOut(clamp((lt - 0.2) / 0.6)));
    const depth = ease.inOut(clamp((lt - 0.8) / 0.6));
    P.phin(ctx, gx, py, gs, { k: 0.45, fill: { level: 0.42, kind: 'dry' }, press: depth, pressLift: lift });
    // finger on the stem knob
    const c = Math.sqrt(1 - 0.45 * 0.45), h = P.PH.h * c;
    const lv = lerp(1, 0.42, depth);
    const knobY = py + gs * (-lv * h - lift - 46);
    pointAt(ctx, gx + 4, knobY - 8, 1.95, 1.3, UNCLE_SKIN, '#e9e4da', UNCLE_SKIN[0]);
    if (lt > 1.4) L.flakes(ctx, lt, 1.4, 88, 30, gx, py - h * gs * 0.42, { g: -60, speed: 220, life: 0.7, size: 3, spread: 3.14, angle: -Math.PI / 2 });
    if (lt > 1.4 && lt < 1.9) L.sparkle(ctx, gx - 200, py - h * gs - 10, 70, 1 - (lt - 1.4) / 0.5);
  });
  Tx.caption(ctx, T, 17.1, 18.9, 'Nén nhẹ', 'Press gently', { n: 5 });
}

// ============ S9 19–22 Bloom + rack focus to the curious tourist ============
function s9(ctx, lt, p, T) {
  cafeBokeh(ctx, T, 0);
  const rack = ease.inOut(clamp((lt - 1.75) / 0.6));
  const lean = ease.inOut(clamp((lt - 0.8) / 1.6));
  const bloom = ease.out(clamp((lt - 1.0) / 1.8));
  // background: tourist leaning in, phin reflected in his sunglasses
  P.layer(ctx, lerp(18, 0, rack), (x) => {
    glow(x, 540, 500, 700, 'rgba(255,210,150,0.5)', 0.6);
    Pp.face(x, 540, lerp(700, 640, lean), lerp(1.05, 1.15, lean), {
      lookY: 0.9, brow: 0.7, mouth: 'o', mOpen: 0.3 + bloom * 0.4, t: T, turn: 0.05,
      glassesFn: (c, cx, cy) => { c.save(); c.globalAlpha = 0.85; P.phin(c, cx, cy + 12, 0.14, { k: 0.6, fill: { level: 0.5, kind: 'wet', bloom } }); c.restore(); },
    });
  });
  ctx.fillStyle = `rgba(15,8,4,${0.25 * (1 - rack)})`; ctx.fillRect(0, 0, W, H);
  // foreground phin
  P.layer2(ctx, rack * 14, (x) => {
    cam(x, 540, 960, 1, 0, () => {
      const py = 1560;
      P.phin(x, 540, py, 2.15, { k: 0.62, fill: { level: 0.42 + bloom * 0.05, kind: lt > 0.5 ? 'wet' : 'dry', bloom, bubbles: T } });
      const [, ty] = P.phinTop(540, py, 2.15, 0.62);
      const on = clamp((lt - 0.3) / 0.12) * clamp((1.0 - lt) / 0.15);
      if (on > 0) { pour(x, 980, 900, 560, ty + 60, 12, 'water', T, on); }
      steam(x, T, 71, 540, ty + 40, 220, 600, 10, 0.35 + bloom * 0.2);
    });
  });
  Tx.caption(ctx, T, 19.2, 21.9, 'Ủ 30 giây', 'Let it bloom · 30s', { n: 6 });
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8, s9, streetScene, pour, bump, cafeBokeh, tableTop, darkBg, embers, UNCLE_SKIN, TOUR_SKIN };
