// Characters: the backpacker tourist (full body profile, face close-up, eye macro) + gestures.
const L = require('./lib');
const P = require('./props');
const { TAU, lerp, clamp, rng, at, glow } = L;
const { ell, seg, ik } = P;

const SKIN = ['#f7d2b5', '#e3a07e', '#c97c5e'];
const HAIR = ['#f7dc8c', '#d9ad55', '#a7782f'];
const SHIRT = '#2f8f8a', SHIRT_D = '#1f6764', SHORTS = '#b59a6a', PACK = '#c46a2b';

// ---------------------------------------------------------------------------
// FULL BODY, profile facing left. origin = ground under hips. height ~430 at s=1
// st: { walk: phase|null, sit: 0..1, raise: 0..1, lean, look, glassHand }
function ikPick(ax, ay, bx, by, l1, l2, preferX) {
  const a = ik(ax, ay, bx, by, l1, l2, 1), b = ik(ax, ay, bx, by, l1, l2, -1);
  return (preferX < 0 ? a[0] < b[0] : a[0] > b[0]) ? a : b;
}
function tourist(ctx, x, y, s, st = {}) {
  const sit = st.sit || 0, walk = st.walk;
  at(ctx, x, y, 0, s, s, () => {
    const bob = walk !== null && walk !== undefined ? Math.abs(Math.sin(walk)) * -6 : 0;
    const hip = [lerp(0, 14, sit), lerp(-205 + bob, -80, sit)];
    const lean = lerp(-0.06, -0.16, sit) + (st.lean || 0);
    const rot = (px, py) => [px * Math.cos(lean) - py * Math.sin(lean), px * Math.sin(lean) + py * Math.cos(lean)];
    const sh = [hip[0] + rot(0, -150)[0], hip[1] + rot(0, -150)[1]];
    const head = [sh[0] + rot(-6, -52)[0], sh[1] + rot(-6, -52)[1]];
    // feet
    let fA, fB;
    if (walk !== null && walk !== undefined) {
      fA = [Math.sin(walk) * 48, Math.min(0, -Math.cos(walk) * 22)];
      fB = [Math.sin(walk + Math.PI) * 48, Math.min(0, -Math.cos(walk + Math.PI) * 22)];
    } else { fA = [lerp(-12, -128, sit), 0]; fB = [lerp(14, -96, sit), 0]; }
    const legs = (f, far) => {
      const kn = ikPick(hip[0], hip[1], f[0], f[1], 100, 105, -1);
      seg(ctx, hip[0], hip[1], kn[0], kn[1], 46, 40, far ? '#8f7a52' : SHORTS);
      seg(ctx, kn[0], kn[1], f[0], f[1] - 8, 30, 24, far ? '#c98466' : SKIN[1]);
      ctx.fillStyle = far ? '#1d1a18' : '#2c2723';
      ctx.beginPath(); ctx.roundRect(f[0] - 34, f[1] - 12, 46, 12, 5); ctx.fill();
      return kn;
    };
    // hands
    const sw = walk !== null && walk !== undefined ? Math.sin(walk + Math.PI) : 0;
    const knNear = ikPick(hip[0], hip[1], fA[0], fA[1], 100, 105, -1);
    let hA = [sh[0] + sw * 40, sh[1] + 140], hB = [sh[0] - sw * 40, sh[1] + 140];
    if (sit > 0) { hA = [lerp(hA[0], knNear[0] - 4, sit), lerp(hA[1], knNear[1] - 12, sit)]; hB = [lerp(hB[0], knNear[0] + 18, sit), lerp(hB[1], knNear[1] - 4, sit)]; }
    if (st.raise) hA = [lerp(hA[0], sh[0] - 70, st.raise), lerp(hA[1], sh[1] - 95, st.raise)];
    if (st.glassHand) hA = [lerp(hA[0], st.glassHand[0], st.glassHandK || 1), lerp(hA[1], st.glassHand[1], st.glassHandK || 1)];
    const arm = (hd, far) => {
      const el = ikPick(sh[0], sh[1] + 6, hd[0], hd[1], 78, 76, 1);
      seg(ctx, sh[0], sh[1] + 6, el[0], el[1], 32, 26, far ? '#c98466' : SKIN[1]);
      seg(ctx, el[0], el[1], hd[0], hd[1], 26, 22, far ? '#c98466' : SKIN[1]);
      // sleeve
      const mx = lerp(sh[0], el[0], 0.45), my = lerp(sh[1] + 6, el[1], 0.45);
      seg(ctx, sh[0], sh[1] + 4, mx, my, 42, 38, far ? SHIRT_D : SHIRT);
      ell(ctx, hd[0], hd[1], 15, 15); ctx.fillStyle = far ? '#c98466' : SKIN[1]; ctx.fill();
      if (!far && st.raise > 0.6) { seg(ctx, hd[0], hd[1], hd[0] - 4, hd[1] - 30, 10, 9, SKIN[1]); }
    };
    // far limbs
    legs(fB, true); arm(hB, true);
    // backpack
    at(ctx, sh[0] + 30, sh[1] + 70, lean, 1, 1, () => {
      ctx.beginPath(); ctx.roundRect(-10, -70, 66, 130, 22); ctx.fillStyle = PACK; ctx.fill();
      ctx.beginPath(); ctx.roundRect(4, 0, 46, 48, 12); ctx.fillStyle = '#a3561f'; ctx.fill();
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(-4, -76, 50, 12);
    });
    // torso
    at(ctx, hip[0], hip[1], lean, 1, 1, () => {
      ctx.beginPath(); ctx.roundRect(-36, -158, 76, 168, 30);
      const g = ctx.createLinearGradient(-36, 0, 40, 0); g.addColorStop(0, '#3fb0a8'); g.addColorStop(1, SHIRT_D);
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#5a4630'; ctx.fillRect(-4, -150, 9, 120); // strap
    });
    legs(fA, false);
    // head (profile, facing left)
    at(ctx, head[0], head[1], lean * 0.5 + (st.look || 0), 1, 1, () => {
      ctx.fillStyle = SKIN[1]; ctx.fillRect(-10, 18, 22, 26);
      ell(ctx, 0, 0, 33, 37); const hg = ctx.createRadialGradient(-12, -10, 4, 0, 0, 38); hg.addColorStop(0, SKIN[0]); hg.addColorStop(1, SKIN[2]); ctx.fillStyle = hg; ctx.fill();
      ctx.beginPath(); ctx.moveTo(-30, -4); ctx.lineTo(-42, 8); ctx.lineTo(-30, 12); ctx.fillStyle = '#e59273'; ctx.fill(); // nose
      ell(ctx, 8, 2, 7, 10); ctx.fillStyle = '#d98e70'; ctx.fill(); // ear
      // hair
      ctx.beginPath(); ctx.moveTo(-30, -16); ctx.quadraticCurveTo(-30, -48, 0, -46); ctx.quadraticCurveTo(36, -44, 34, -6); ctx.lineTo(24, 10); ctx.quadraticCurveTo(14, -16, -10, -22); ctx.closePath();
      ctx.fillStyle = HAIR[1]; ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-26 + i * 14, -40); ctx.lineTo(-34 + i * 14, -52 - (i % 2) * 6); ctx.lineTo(-18 + i * 14, -42); ctx.fillStyle = HAIR[0]; ctx.fill(); }
      // sunglasses on head
      ctx.fillStyle = '#141414'; ell(ctx, -14, -38, 15, 7); ctx.fill();
      ell(ctx, -18, 0, 3.5, 4.5); ctx.fillStyle = '#1f2a33'; ctx.fill(); // eye
      ctx.strokeStyle = '#b55a48'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-28, 21); ctx.quadraticCurveTo(-22, st.smile ? 25 : 22, -16, 20); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,130,0.7)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 33, Math.PI * 0.75, Math.PI * 1.35); ctx.stroke(); ctx.restore();
    });
    arm(hA, false);
  });
}

// ---------------------------------------------------------------------------
// FACE close-up (front ¾). origin = between the eyes. s=1 → head ~310 wide.
// o: {turn, lookX, lookY, open, openR, pupil, brow, mouth, mOpen, blush, hairLift, glassesFn, t, shirt}
function face(ctx, x, y, s, o = {}) {
  const tn = o.turn || 0, tx = tn * 70;
  at(ctx, x, y, o.tilt || 0, s, s, () => {
    // shoulders + shirt
    if (o.shirt !== false) {
      ctx.beginPath(); ctx.moveTo(-330, 600); ctx.quadraticCurveTo(-310, 300, -120, 270); ctx.lineTo(120, 270); ctx.quadraticCurveTo(310, 300, 330, 600); ctx.closePath();
      const sg = ctx.createLinearGradient(-330, 0, 330, 0); sg.addColorStop(0, '#46b8ae'); sg.addColorStop(0.6, SHIRT); sg.addColorStop(1, SHIRT_D);
      ctx.fillStyle = sg; ctx.fill();
      // straps
      ctx.fillStyle = '#5a4630'; ctx.beginPath(); ctx.roundRect(-230, 270, 46, 340, 14); ctx.fill(); ctx.beginPath(); ctx.roundRect(190, 270, 46, 340, 14); ctx.fill();
      ctx.fillStyle = '#3b2e20'; ctx.fillRect(-232, 400, 50, 16); ctx.fillRect(188, 400, 50, 16);
    }
    // neck
    const ng = ctx.createLinearGradient(-60, 0, 60, 0); ng.addColorStop(0, SKIN[1]); ng.addColorStop(1, SKIN[2]);
    ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(-62 + tx * 0.3, 140); ctx.lineTo(-70, 290); ctx.quadraticCurveTo(0, 320, 70, 290); ctx.lineTo(62 + tx * 0.3, 140); ctx.fill();
    // collar
    ctx.strokeStyle = SHIRT_D; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-110, 272); ctx.quadraticCurveTo(0, 330, 110, 272); ctx.stroke();
    // ears
    const earL = 150 - tx * 0.25, earR = 150 + tx * 0.25;
    ell(ctx, -earL - tx * 0.2, 25, 26 * (1 - tn * 0.6), 46); ctx.fillStyle = SKIN[1]; ctx.fill();
    ell(ctx, earR - tx * 0.2, 25, 26 * (1 + tn * 0.6), 46); ctx.fill();
    // head shape
    ctx.beginPath();
    ctx.moveTo(tx * 0.4, 200);
    ctx.bezierCurveTo(70 + tx * 0.5, 200, 135 + tx * 0.1, 140, 150 + tx * 0.1 - tn * 30, 30);
    ctx.bezierCurveTo(160, -90, 120, -205, tx * 0.2, -215);
    ctx.bezierCurveTo(-120, -205, -160, -90, -150 + tx * 0.1 - tn * 30, 30);
    ctx.bezierCurveTo(-135 + tx * 0.1, 140, -70 + tx * 0.5, 200, tx * 0.4, 200);
    const hg = ctx.createRadialGradient(-50 + tx, -50, 20, 0, 20, 230);
    hg.addColorStop(0, SKIN[0]); hg.addColorStop(0.7, SKIN[1]); hg.addColorStop(1, SKIN[2]);
    ctx.fillStyle = hg; ctx.fill();
    ctx.save(); ctx.clip();
    // sunburn on nose/cheeks
    ell(ctx, tx * 1.1, 70, 50, 40); ctx.fillStyle = 'rgba(235,120,95,0.12)'; ctx.fill();
    const bl = 0.18 + (o.blush || 0) * 0.45;
    for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * 92 + tx, 82); ctx.scale(1, 0.66); const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 64); bg.addColorStop(0, `rgba(240,110,105,${bl})`); bg.addColorStop(0.55, `rgba(240,110,105,${bl * 0.75})`); bg.addColorStop(1, 'rgba(240,110,105,0)'); ctx.fillStyle = bg; ctx.fillRect(-64, -64, 128, 128); ctx.restore(); } // radial blush (no blur filter: ~10 ms fixed cost each)
    // stubble
    const r = rng(17); ctx.fillStyle = 'rgba(180,140,70,0.3)';
    for (let i = 0; i < 320; i++) { const a = r() * Math.PI, rr = 90 + r() * 70; const px = Math.cos(a) * rr * 0.95 + tx * 0.4, py = 110 + Math.sin(a) * rr * 0.55; if (py > 120) ctx.fillRect(px, py, 2, 2); }
    // shadow side
    const ss = ctx.createLinearGradient(-160, 0, 160, 0); ss.addColorStop(0, 'rgba(0,0,0,0)'); ss.addColorStop(0.7, 'rgba(0,0,0,0)'); ss.addColorStop(1, 'rgba(80,30,40,0.3)');
    ctx.fillStyle = ss; ctx.fillRect(-200, -250, 400, 500);
    const rl = ctx.createLinearGradient(-160, 0, -100, 0); rl.addColorStop(0, 'rgba(255,200,120,0.55)'); rl.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = rl; ctx.fillRect(-200, -250, 120, 500);
    ctx.restore();
    // eyes
    const op = o.open === undefined ? 1 : o.open;
    for (const sx of [-1, 1]) {
      const ex = sx * 64 + tx * (sx === 1 ? 1.15 : 0.85), w = 48 * (1 + sx * tn * 0.5);
      eye(ctx, ex, 0, w, sx === 1 && o.openR !== undefined ? o.openR : op, o, sx);
    }
    // brows
    const br = o.brow || 0;
    ctx.strokeStyle = HAIR[2]; ctx.lineCap = 'round'; ctx.lineWidth = 12;
    for (const sx of [-1, 1]) {
      const ex = sx * 64 + tx * (sx === 1 ? 1.15 : 0.85), by = -58 - br * 22 - (o.browTilt || 0) * sx * 0;
      ctx.beginPath(); ctx.moveTo(ex - 44, by + 10 + (sx < 0 ? 0 : br * 6)); ctx.quadraticCurveTo(ex, by - 16, ex + 44, by + 10 + (sx > 0 ? 0 : br * 6)); ctx.stroke();
    }
    // nose
    const nx = tx * 1.25;
    ctx.strokeStyle = 'rgba(160,80,60,0.55)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(nx + 14, 10); ctx.quadraticCurveTo(nx + 30, 60, nx + 24, 86); ctx.stroke();
    ell(ctx, nx, 84, 24, 17); ctx.fillStyle = 'rgba(225,135,110,0.22)'; ctx.fill();
    ctx.fillStyle = 'rgba(110,50,40,0.6)'; ell(ctx, nx - 13, 94, 7, 4); ctx.fill(); ell(ctx, nx + 13, 94, 7, 4); ctx.fill();
    ell(ctx, nx - 6, 74, 8, 5); ctx.fillStyle = 'rgba(255,240,225,0.7)'; ctx.fill();
    // mouth
    mouth(ctx, tx * 1.05, 140, o.mouth || 'neutral', o.mOpen || 0, o.t || 0);
    // hair
    hair(ctx, tx, o.hairLift || 0, o.t || 0);
    // sunglasses on head
    if (o.glasses !== false) {
      const gY = o.glassesY === undefined ? -178 : o.glassesY, gK = clamp((gY + 178) / 178); // glassesY: -178 on head (default), 0 = over the eyes
      at(ctx, tx * (0.6 + 0.4 * gK), gY, 0, 1, 1, () => {
        ctx.fillStyle = '#121212';
        for (const sx of [-1, 1]) {
          ctx.beginPath(); ctx.roundRect(sx * 70 - 52, -28, 104, 56, 22); ctx.fill();
          ctx.save(); ctx.beginPath(); ctx.roundRect(sx * 70 - 46, -23, 92, 46, 18); ctx.clip();
          const lg = ctx.createLinearGradient(0, -25, 0, 25); lg.addColorStop(0, '#3a2a20'); lg.addColorStop(1, '#0c0a08');
          ctx.fillStyle = lg; ctx.fillRect(sx * 70 - 50, -30, 100, 60);
          if (o.glassesFn) o.glassesFn(ctx, sx * 70, 0);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(sx * 70 - 40, -20); ctx.lineTo(sx * 70 - 10, -20); ctx.lineTo(sx * 70 - 34, 18); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.fillRect(-20, -10, 40, 9);
      });
    }
  });
}
function eye(ctx, ex, ey, w, open, o, sx) {
  const hgt = 30 * open;
  ctx.save();
  if (open < 0.08) {
    // closed / blissful
    ctx.strokeStyle = '#4a2a1c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.happyClosed) { ctx.moveTo(ex - w * 0.8, ey + 6); ctx.quadraticCurveTo(ex, ey - 22, ex + w * 0.8, ey + 6); }
    else { ctx.moveTo(ex - w * 0.8, ey); ctx.quadraticCurveTo(ex, ey + 14, ex + w * 0.8, ey); }
    ctx.stroke(); ctx.restore(); return;
  }
  // almond
  const path = () => { ctx.beginPath(); ctx.moveTo(ex - w, ey + 2); ctx.bezierCurveTo(ex - w * 0.5, ey - hgt * 1.3, ex + w * 0.5, ey - hgt * 1.3, ex + w, ey); ctx.bezierCurveTo(ex + w * 0.5, ey + hgt * 0.9, ex - w * 0.5, ey + hgt * 0.9, ex - w, ey + 2); };
  path(); ctx.fillStyle = '#fbf6f0'; ctx.fill();
  ctx.clip();
  const ix = ex + ((o.lookX || 0) - (o.cross || 0) * sx) * w * 0.45, iy = ey + (o.lookY || 0) * 10 - 2, ir = 21; // [banhbo] o.cross 0..1 = cross-eyed
  const ig = ctx.createRadialGradient(ix, iy, 2, ix, iy, ir);
  ig.addColorStop(0, '#9fd0f2'); ig.addColorStop(0.6, '#3f86c4'); ig.addColorStop(1, '#1b4570');
  ell(ctx, ix, iy, ir, ir); ctx.fillStyle = ig; ctx.fill();
  if (o.spiral) {
    ctx.strokeStyle = '#1b2b40'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let a = 0; a < 14; a += 0.2) { const rr = a * 1.5; ctx.lineTo(ix + Math.cos(a + o.spiral) * rr, iy + Math.sin(a + o.spiral) * rr); }
    ctx.stroke();
  } else {
    const pr = 8 * (o.pupil || 1);
    ell(ctx, ix, iy, pr, pr); ctx.fillStyle = '#0b0d10'; ctx.fill();
  }
  ell(ctx, ix - 7, iy - 7, 6, 5); ctx.fillStyle = '#fff'; ctx.fill();
  ell(ctx, ix + 6, iy + 6, 2.5, 2.5); ctx.fill();
  // lid shadow
  const ls = ctx.createLinearGradient(0, ey - hgt, 0, ey); ls.addColorStop(0, 'rgba(120,60,40,0.4)'); ls.addColorStop(1, 'rgba(120,60,40,0)');
  ctx.fillStyle = ls; ctx.fillRect(ex - w, ey - hgt * 1.4, w * 2, hgt);
  ctx.restore();
  // upper lid line + lashes
  ctx.strokeStyle = '#3a2216'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ex - w, ey + 2); ctx.bezierCurveTo(ex - w * 0.5, ey - hgt * 1.3, ex + w * 0.5, ey - hgt * 1.3, ex + w, ey); ctx.stroke();
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { const u = 0.25 + i * 0.18, lx = lerp(ex - w, ex + w, u), ly = ey - hgt * 0.95 * Math.sin(u * Math.PI); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + sx * 4 + (u - 0.5) * 10, ly - 9); ctx.stroke(); }
  // crease
  ctx.strokeStyle = 'rgba(150,80,60,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ex - w * 0.8, ey - hgt - 6); ctx.quadraticCurveTo(ex, ey - hgt * 1.5 - 14, ex + w * 0.85, ey - hgt - 8); ctx.stroke();
}
function mouth(ctx, mx, my, type, op, t) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lip = '#c86a5c', dark = '#4a1612';
  if (type === 'neutral') {
    ctx.strokeStyle = lip; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(mx - 42, my); ctx.quadraticCurveTo(mx, my + 6, mx + 42, my - 2); ctx.stroke();
  } else if (type === 'smile' || type === 'woozy') {
    const wz = type === 'woozy';
    ctx.strokeStyle = lip; ctx.lineWidth = 8; ctx.beginPath();
    ctx.moveTo(mx - 58, my - 12 + (wz ? 8 : 0));
    if (wz) ctx.bezierCurveTo(mx - 25, my + 18, mx + 10, my + 2, mx + 55, my - 22);
    else ctx.quadraticCurveTo(mx, my + 34, mx + 58, my - 12);
    ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(160,70,60,0.5)';
    ctx.beginPath(); ctx.arc(mx - 62, my - 14 + (wz ? 8 : 0), 7, -1.2, 1.2); ctx.stroke();
  } else if (type === 'grin') {
    ctx.beginPath(); ctx.moveTo(mx - 70, my - 16); ctx.quadraticCurveTo(mx, my - 4, mx + 70, my - 16); ctx.quadraticCurveTo(mx + 40, my + 50 + op * 20, mx, my + 54 + op * 20); ctx.quadraticCurveTo(mx - 40, my + 50 + op * 20, mx - 70, my - 16);
    ctx.fillStyle = dark; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#fbf6ee'; ctx.fillRect(mx - 70, my - 18, 140, 22);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(mx + i * 17, my - 18); ctx.lineTo(mx + i * 17, my + 3); ctx.stroke(); }
    ell(ctx, mx, my + 54 + op * 20, 40, 22); ctx.fillStyle = '#d4605a'; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(mx - 70, my - 16); ctx.quadraticCurveTo(mx, my - 4, mx + 70, my - 16); ctx.quadraticCurveTo(mx + 40, my + 50 + op * 20, mx, my + 54 + op * 20); ctx.quadraticCurveTo(mx - 40, my + 50 + op * 20, mx - 70, my - 16);
    ctx.strokeStyle = lip; ctx.lineWidth = 5; ctx.stroke();
  } else if (type === 'o') {
    ell(ctx, mx, my + 6, 20 + op * 8, 22 + op * 18); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = lip; ctx.lineWidth = 6; ctx.stroke();
  } else if (type === 'sip') {
    ell(ctx, mx, my + 2, 26, 14); ctx.fillStyle = lip; ctx.fill();
    ell(ctx, mx, my + 2, 10, 5); ctx.fillStyle = dark; ctx.fill();
  }
  ctx.restore();
}
function hair(ctx, tx, lift, t) {
  const r = rng(23);
  // back mass
  ctx.beginPath();
  ctx.moveTo(-158 + tx * 0.1, 10);
  ctx.bezierCurveTo(-175, -160, -90, -255 - lift * 30, tx * 0.2, -250 - lift * 30);
  ctx.bezierCurveTo(100, -255 - lift * 30, 178, -160, 158 + tx * 0.1, 10);
  ctx.lineTo(140, -40); ctx.quadraticCurveTo(110, -120, 40 + tx * 0.5, -132);
  ctx.quadraticCurveTo(-20, -110, -60 + tx * 0.5, -140); ctx.quadraticCurveTo(-120, -110, -140, -40); ctx.closePath();
  const g = ctx.createLinearGradient(0, -260, 0, 0); g.addColorStop(0, HAIR[0]); g.addColorStop(0.6, HAIR[1]); g.addColorStop(1, HAIR[2]);
  ctx.fillStyle = g; ctx.fill();
  // tufts
  for (let i = 0; i < 22; i++) {
    const u = i / 21, bx = lerp(-150, 150, u) + tx * 0.3, by = -160 - Math.sin(u * Math.PI) * 88 - lift * 40 * Math.sin(u * Math.PI);
    const len = 22 + r() * 26 + lift * 75, ang = -Math.PI / 2 + (u - 0.5) * 3.0 + (r() - 0.5) * 0.6 + Math.sin(t * 6 + i) * 0.08 * (1 + lift * 3);
    ctx.beginPath(); ctx.moveTo(bx - 20, by + 26); ctx.quadraticCurveTo(bx + Math.cos(ang) * len * 0.5 - 10, by + Math.sin(ang) * len * 0.5, bx + Math.cos(ang) * len, by + Math.sin(ang) * len); ctx.quadraticCurveTo(bx + 10, by + 10, bx + 20, by + 26); ctx.closePath();
    ctx.fillStyle = r() < 0.5 ? HAIR[0] : HAIR[1]; ctx.fill();
  }
  // fringe
  for (let i = 0; i < 6; i++) { const fx = -110 + i * 38 + tx * 0.5; ctx.beginPath(); ctx.moveTo(fx - 26, -150); ctx.quadraticCurveTo(fx + 10, -120, fx + 34 + (i % 2) * 8, -104 + (i % 3) * 6); ctx.quadraticCurveTo(fx + 20, -140, fx + 30, -158); ctx.closePath(); ctx.fillStyle = i % 2 ? HAIR[0] : HAIR[1]; ctx.fill(); }
  // strands
  ctx.strokeStyle = 'rgba(140,95,35,0.5)'; ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) { const bx = -120 + i * 14 + tx * 0.3; ctx.beginPath(); ctx.moveTo(bx, -140); ctx.quadraticCurveTo(bx + 10, -200, bx + 20 - (i - 9) * 3, -235 - lift * 30); ctx.stroke(); }
  // sheen
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(tx * 0.2, -40, 190, Math.PI * 1.15, Math.PI * 1.5);
  for (const [lw, al] of [[22, 0.1], [14, 0.14], [7, 0.2]]) { ctx.strokeStyle = `rgba(255,240,200,${al})`; ctx.lineWidth = lw; ctx.stroke(); } ctx.restore();
}

// ---------------------------------------------------------------------------
// EYE macro. origin = eye centre. s=1 → eye 820 wide. o: {pupil 0.25..0.7, open, t, reflect}
function eyeMacro(ctx, x, y, s, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    // skin
    const sg = ctx.createRadialGradient(-100, -200, 50, 0, 0, 900);
    sg.addColorStop(0, '#f6cdb0'); sg.addColorStop(1, '#c9876a');
    ctx.fillStyle = sg; ctx.fillRect(-900, -1100, 1800, 2200);
    // pores
    const r = rng(5); ctx.fillStyle = 'rgba(150,80,60,0.12)';
    for (let i = 0; i < 900; i++) { ctx.beginPath(); ctx.arc(-900 + r() * 1800, -1100 + r() * 2200, 1 + r() * 2, 0, TAU); ctx.fill(); }
    // brow
    ctx.save(); ctx.translate(0, -470 - (o.brow || 0) * 60);
    for (let i = 0; i < 160; i++) {
      const u = r(), bx = lerp(-520, 480, u), by = -Math.sin(u * Math.PI) * 80 + r() * 50;
      ctx.strokeStyle = r() < 0.5 ? '#c99a52' : '#a9783a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 40 + r() * 20, by - 10 - r() * 14); ctx.stroke();
    }
    ctx.restore();
    const w = 430, hgt = 250 * (o.open === undefined ? 1 : o.open);
    const path = () => { ctx.beginPath(); ctx.moveTo(-w, 20); ctx.bezierCurveTo(-w * 0.45, -hgt * 1.25, w * 0.45, -hgt * 1.25, w, 0); ctx.bezierCurveTo(w * 0.45, hgt * 0.95, -w * 0.45, hgt * 0.95, -w, 20); };
    // lid crease
    ctx.strokeStyle = 'rgba(150,80,60,0.5)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-w * 0.85, -hgt * 0.9); ctx.quadraticCurveTo(0, -hgt * 1.6, w * 0.9, -hgt * 0.85); ctx.stroke();
    path(); ctx.save(); ctx.clip();
    // sclera
    const sc = ctx.createRadialGradient(0, 0, 50, 0, 0, w);
    sc.addColorStop(0, '#fffaf4'); sc.addColorStop(0.75, '#f3e2da'); sc.addColorStop(1, '#d9a8a0');
    ctx.fillStyle = sc; ctx.fillRect(-w, -hgt * 1.5, w * 2, hgt * 3);
    // veins
    ctx.strokeStyle = 'rgba(200,60,60,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1; let vx = side * w, vy = (r() - 0.5) * hgt;
      ctx.beginPath(); ctx.moveTo(vx, vy);
      for (let k = 0; k < 5; k++) { vx -= side * (30 + r() * 40); vy += (r() - 0.5) * 40; ctx.lineTo(vx, vy); }
      ctx.stroke();
    }
    // iris
    const IR = 215, pr = IR * (o.pupil || 0.3);
    const ig = ctx.createRadialGradient(0, 0, pr, 0, 0, IR);
    ig.addColorStop(0, '#5a3f22'); ig.addColorStop(0.18, '#7fb8e3'); ig.addColorStop(0.65, '#3d7fbd'); ig.addColorStop(0.92, '#1f4f80'); ig.addColorStop(1, '#0e2440');
    ell(ctx, 0, 0, IR, IR); ctx.fillStyle = ig; ctx.fill();
    // fibres
    for (let i = 0; i < 220; i++) {
      const a = (i / 220) * TAU + r() * 0.02, r0 = pr * (1.02 + r() * 0.2), r1 = IR * (0.55 + r() * 0.4);
      ctx.strokeStyle = r() < 0.5 ? 'rgba(200,235,255,0.35)' : 'rgba(10,40,80,0.35)'; ctx.lineWidth = 1.5 + r() * 2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(230,180,90,0.45)'; ctx.lineWidth = 10; ell(ctx, 0, 0, pr * 1.35, pr * 1.35); ctx.stroke();
    ell(ctx, 0, 0, pr, pr); ctx.fillStyle = '#050505'; ctx.fill();
    // reflection of the street in the cornea
    if (o.reflect) { ctx.save(); ell(ctx, 0, 0, IR * 1.25, IR * 1.25); ctx.clip(); ctx.globalCompositeOperation = 'screen'; o.reflect(ctx, IR); ctx.restore(); }
    // window highlight
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.roundRect(-150, -150, 70, 90, 20); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ell(ctx, 90, 110, 24, 18); ctx.fill();
    ctx.restore();
    // upper lid shadow
    const ls = ctx.createLinearGradient(0, -hgt * 1.2, 0, -hgt * 0.2); ls.addColorStop(0, 'rgba(90,40,30,0.6)'); ls.addColorStop(1, 'rgba(90,40,30,0)');
    ctx.fillStyle = ls; ctx.fillRect(-w, -hgt * 1.5, w * 2, hgt * 1.3);
    ctx.restore();
    // lid lines + lashes
    ctx.strokeStyle = '#3a2216'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-w, 20); ctx.bezierCurveTo(-w * 0.45, -hgt * 1.25, w * 0.45, -hgt * 1.25, w, 0); ctx.stroke();
    ctx.lineWidth = 5;
    for (let i = 0; i < 46; i++) {
      const u = 0.06 + i / 46 * 0.9, bt = u, mt = 1 - bt;
      const lx = mt * mt * mt * -w + 3 * mt * mt * bt * -w * 0.45 + 3 * mt * bt * bt * w * 0.45 + bt * bt * bt * w;
      const ly = mt * mt * mt * 20 + 3 * mt * mt * bt * -hgt * 1.25 + 3 * mt * bt * bt * -hgt * 1.25;
      ctx.strokeStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.quadraticCurveTo(lx + (u - 0.5) * 60, ly - 50, lx + (u - 0.5) * 110, ly - 70 - Math.sin(u * Math.PI) * 30); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(160,80,70,0.6)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-w, 20); ctx.bezierCurveTo(-w * 0.45, hgt * 0.95, w * 0.45, hgt * 0.95, w, 0); ctx.stroke();
  });
}

// thumbs-up hand (fist + thumb), origin = fist centre
function thumbsUp(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(-50, -40, 50, 60); g.addColorStop(0, SKIN[0]); g.addColorStop(1, SKIN[2]);
    ctx.fillStyle = g;
    // wrist
    ctx.beginPath(); ctx.roundRect(-34, 30, 68, 120, 26); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-55, -40, 110, 90, 34); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(-60 + 4, -34 + i * 21, 30, 20, 10); ctx.fill(); }
    ctx.beginPath(); ctx.roundRect(-14, -110, 34, 86, 17); ctx.fill(); // thumb
    ell(ctx, 3, -100, 9, 9); ctx.fillStyle = 'rgba(255,235,220,0.7)'; ctx.fill();
    ctx.strokeStyle = 'rgba(150,80,60,0.45)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-50, -14 + i * 21); ctx.lineTo(-30, -14 + i * 21); ctx.stroke(); }
  });
}

module.exports = { tourist, face, eyeMacro, thumbsUp, SKIN, HAIR, SHIRT };
