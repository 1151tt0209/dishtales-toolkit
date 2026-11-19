// Mekong floating market: sky, river water, palm banks, boats (ghe + xuồng), cô Út, and bún mắm food props.
const L = require('./lib');
const P = require('./props');
const { W, H, TAU, rng, clamp, lerp, at, glow, createCanvas } = L;
const { ell, seg, ik, shade } = P;

// ---------------- sky & water ----------------
function sky(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#2a3f63'); g.addColorStop(0.35, '#7d6f8e'); g.addColorStop(0.7, '#e9a172'); g.addColorStop(0.92, '#ffd39a'); g.addColorStop(1, '#ffe7b8');
  ctx.fillStyle = g; ctx.fillRect(-600, y0, W + 1200, y1 - y0);
}
// river surface from horizon hy down to y1. sunX = x of the sun reflection column
function water(ctx, hy, y1, t, sunX = 540, o = {}) {
  const g = ctx.createLinearGradient(0, hy, 0, y1);
  g.addColorStop(0, o.far || '#e7b27c'); g.addColorStop(0.25, '#9a7b5c'); g.addColorStop(1, o.near || '#3a3a2c');
  ctx.fillStyle = g; ctx.fillRect(-600, hy, W + 1200, y1 - hy);
  // sun glitter column
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const r = rng(o.seed || 3);
  for (let i = 0; i < 260; i++) {
    const v = Math.pow(r(), 1.6), y = hy + v * (y1 - hy), spread = 30 + v * 260;
    const x = sunX + (r() - 0.5) * spread * 2, len = 6 + v * 50, ph = r() * TAU;
    const a = (0.4 + 0.6 * Math.sin(t * (2 + r() * 3) + ph)) * (1 - v * 0.6);
    if (a <= 0.05) continue;
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = 'rgba(255,230,170,1)';
    ctx.fillRect(x - len / 2 + Math.sin(t * 0.8 + ph) * 8, y, len, 1.5 + v * 3);
  }
  ctx.restore();
  // ripple lines
  ctx.save(); ctx.strokeStyle = 'rgba(255,240,210,0.12)'; ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const v = Math.pow(r(), 1.3), y = hy + v * (y1 - hy), x = r() * W, len = 40 + v * 240;
    ctx.beginPath(); ctx.moveTo(x - len / 2 + Math.sin(t + i) * 20, y); ctx.quadraticCurveTo(x, y - 3 - v * 4, x + len / 2 + Math.sin(t + i) * 20, y); ctx.stroke();
  }
  ctx.restore();
}
// mist band
function mist(ctx, y, h, t, a = 0.5) {
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const x = ((t * 18 + i * 260) % 1700) - 300;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 420);
    g.addColorStop(0, `rgba(255,232,200,${a * 0.5})`); g.addColorStop(1, 'rgba(255,232,200,0)');
    ctx.fillStyle = g; ctx.save(); ctx.translate(x, y); ctx.scale(1, h / 420); ctx.translate(-x, -y); ctx.fillRect(x - 420, y - 420, 840, 840); ctx.restore();
  }
  ctx.restore();
}
// coconut / nipa palm bank silhouette (cached per seed+scale)
const bankCache = {};
function bank(ctx, y, sc, haze, seed, w = 1700) {
  const key = [y, sc, haze, seed].join('|');
  if (!bankCache[key]) {
    const c = createCanvas(w, 900), x = c.getContext('2d');
    const r = rng(seed), col = mixHex('#1f3a22', '#f0c38f', haze), col2 = mixHex('#2f5a2c', '#f0c38f', haze);
    const base = 700;
    x.fillStyle = col; x.fillRect(0, base - 40 * sc, w, 300);
    for (let i = 0; i < 26; i++) {
      const px = r() * w, ph = (160 + r() * 260) * sc, lean = (r() - 0.5) * 0.5;
      const topX = px + Math.sin(lean) * ph, topY = base - ph;
      x.strokeStyle = col; x.lineWidth = 7 * sc; x.beginPath(); x.moveTo(px, base); x.quadraticCurveTo(px + lean * 40, base - ph * 0.5, topX, topY); x.stroke();
      for (let f = 0; f < 9; f++) {
        const a = -Math.PI / 2 + (f - 4) * 0.42 + (r() - 0.5) * 0.2, fl = (70 + r() * 50) * sc;
        x.strokeStyle = f % 2 ? col : col2; x.lineWidth = 5 * sc;
        x.beginPath(); x.moveTo(topX, topY);
        const ex = topX + Math.cos(a) * fl, ey = topY + Math.sin(a) * fl * 0.6 + fl * 0.45;
        x.quadraticCurveTo(topX + Math.cos(a) * fl * 0.6, topY + Math.sin(a) * fl * 0.6 - 10 * sc, ex, ey); x.stroke();
        for (let l = 1; l < 7; l++) { const u = l / 7, lx = lerp(topX, ex, u), ly = lerp(topY, ey, u) - Math.sin(u * Math.PI) * 12 * sc; x.lineWidth = 2.5 * sc; x.beginPath(); x.moveTo(lx, ly); x.lineTo(lx + 10 * sc, ly + 18 * sc); x.moveTo(lx, ly); x.lineTo(lx - 10 * sc, ly + 18 * sc); x.stroke(); }
      }
    }
    // nipa palm clumps at the waterline
    for (let i = 0; i < 40; i++) { const px = r() * w, hh = (40 + r() * 70) * sc; x.strokeStyle = col2; x.lineWidth = 4 * sc; for (let f = -3; f <= 3; f++) { x.beginPath(); x.moveTo(px, base - 30 * sc); x.quadraticCurveTo(px + f * 10 * sc, base - hh, px + f * 26 * sc, base - hh * 0.8); x.stroke(); } }
    bankCache[key] = c;
  }
  ctx.drawImage(bankCache[key], -310, y - 700);
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}

// ---------------- boats ----------------
// big wooden ghe (side view, bow to +x). origin = waterline centre. o: {cargo, beo, canopy, flip, hue}
function ghe(ctx, x, y, s, t, o = {}) {
  at(ctx, x, y + Math.sin(t * 1.6 + x * 0.01) * 4 * s, Math.sin(t * 1.3 + x) * 0.012, o.flip ? -s : s, s, () => {
    const len = 520;
    // reflection
    ctx.save(); ctx.globalAlpha = 0.25; ctx.scale(1, -0.5); hull(ctx, len, o); ctx.restore();
    // cargo
    if (o.cargo !== false) {
      const r = rng(o.seed || 1);
      for (let i = 0; i < 26; i++) {
        const cx = -180 + r() * 340, cy = -70 - r() * 50, kind = r();
        if (kind < 0.4) { ell(ctx, cx, cy, 30, 24); ctx.fillStyle = '#d9822b'; ctx.fill(); ctx.strokeStyle = '#a65a12'; ctx.lineWidth = 2; ctx.stroke(); }
        else if (kind < 0.7) { ell(ctx, cx, cy, 20, 28); ctx.fillStyle = '#c99a2e'; ctx.fill(); ctx.fillStyle = '#3f7a2a'; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 24); ctx.lineTo(cx, cy - 48); ctx.lineTo(cx + 10, cy - 24); ctx.fill(); }
        else { ell(ctx, cx, cy, 26, 26); ctx.fillStyle = '#5a7a2a'; ctx.fill(); }
      }
    }
    // canopy (mui)
    if (o.canopy) {
      ctx.fillStyle = '#4a3220'; ctx.beginPath(); ctx.moveTo(-230, -70); ctx.quadraticCurveTo(-120, -210, 20, -70); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,160,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-220, -80); ctx.quadraticCurveTo(-120, -200, 10, -80); ctx.stroke();
    }
    // cây bẹo: pole with hanging produce
    if (o.beo !== false) {
      ctx.strokeStyle = '#3a2614'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(60, -40); ctx.lineTo(70, -520); ctx.stroke();
      const items = o.beoItems || ['#d9822b', '#c99a2e', '#5a7a2a'];
      items.forEach((c, i) => {
        const hy = -470 + i * 70, sw = Math.sin(t * 2 + i) * 4;
        ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(68, hy - 20); ctx.lineTo(68 + sw, hy); ctx.stroke();
        ell(ctx, 68 + sw, hy + 22, 24, 26); ctx.fillStyle = c; ctx.fill();
      });
    }
    hull(ctx, len, o);
  });
}
function hull(ctx, len, o) {
  ctx.beginPath();
  ctx.moveTo(-len / 2, -70); ctx.quadraticCurveTo(-len / 2 + 30, 10, -len / 2 + 120, 22);
  ctx.lineTo(len / 2 - 120, 22); ctx.quadraticCurveTo(len / 2 - 20, 10, len / 2 + 10, -90);
  ctx.lineTo(len / 2 - 30, -60); ctx.lineTo(-len / 2 + 30, -55); ctx.closePath();
  const g = ctx.createLinearGradient(0, -80, 0, 25); g.addColorStop(0, '#6a4428'); g.addColorStop(1, '#2a180c');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = o.hue || '#2f6b8f'; ctx.fillRect(-len / 2 + 30, -60, len - 60, 12);
  ctx.fillStyle = '#b8352a'; ctx.fillRect(-len / 2 + 40, -46, len - 90, 6);
  // painted eye on the bow (mắt ghe)
  at(ctx, len / 2 - 60, -30, 0, 1, 1, () => {
    ell(ctx, 0, 0, 20, 12); ctx.fillStyle = '#f4ecd8'; ctx.fill();
    ell(ctx, 3, 0, 8, 8); ctx.fillStyle = '#141414'; ctx.fill();
    ctx.strokeStyle = '#b8352a'; ctx.lineWidth = 3; ell(ctx, 0, 0, 20, 12); ctx.stroke();
  });
}
// small rowboat (xuồng), origin = waterline centre, len ~ 420
function xuong(ctx, x, y, s, t, o = {}) {
  const bob = Math.sin(t * 2.1 + (o.ph || 0)) * 5 * s, roll = Math.sin(t * 1.7 + (o.ph || 0)) * 0.02 + (o.roll || 0);
  at(ctx, x, y + bob, roll, s, s, () => {
    if (o.inside) o.inside(ctx);
    ctx.beginPath(); ctx.moveTo(-230, -50); ctx.quadraticCurveTo(-200, 14, -120, 18); ctx.lineTo(120, 18); ctx.quadraticCurveTo(200, 14, 235, -55); ctx.lineTo(200, -44); ctx.lineTo(-200, -40); ctx.closePath();
    const g = ctx.createLinearGradient(0, -55, 0, 20); g.addColorStop(0, o.col || '#7a5232'); g.addColorStop(1, '#2e1c0e');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,170,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-210, -44); ctx.lineTo(205, -48); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,15,5,0.35)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-190, -26 + i * 13); ctx.lineTo(190, -28 + i * 13); ctx.stroke(); }
    // water contact line
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff3d6'; ctx.fillRect(-170, 14, 340, 3); ctx.restore();
  });
}
function wake(ctx, x, y, w, t) {
  ctx.save(); ctx.strokeStyle = 'rgba(255,240,215,0.35)'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) { const k = ((t * 0.8 + i / 5) % 1); ctx.globalAlpha = 1 - k; ell(ctx, x, y, w * (0.6 + k), 8 + k * 12); ctx.stroke(); }
  ctx.restore();
}

// ---------------- cô Út (side view, facing +x). origin = seat point ----------------
function coUt(ctx, x, y, s, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const laugh = o.laugh || 0, bob = Math.sin((o.t || 0) * 18) * 4 * laugh;
    const skin = '#c98a5e', skinD = '#9a6240', shirt = o.shirt || '#7b3f8f', shirtD = o.shirtD || '#5a2a6c';
    // far arm
    const sh = [10, -150 + bob];
    const hB = o.handB || [70, -40];
    const eB = ik(sh[0], sh[1], hB[0], hB[1], 70, 66, -1);
    seg(ctx, sh[0], sh[1], eB[0], eB[1], 30, 26, shirtD); seg(ctx, eB[0], eB[1], hB[0], hB[1], 22, 18, skinD);
    // torso (áo bà ba)
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.quadraticCurveTo(-60, -90, -40, -150 + bob); ctx.quadraticCurveTo(10, -170 + bob, 55, -145 + bob); ctx.quadraticCurveTo(70, -80, 60, 0); ctx.closePath();
    const tg = ctx.createLinearGradient(-60, 0, 70, 0); tg.addColorStop(0, shirtD); tg.addColorStop(0.6, shirt); tg.addColorStop(1, shade(shirt, 0.2));
    ctx.fillStyle = tg; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 3; i++) { ell(ctx, 48, -120 + i * 34 + bob, 3, 3); ctx.fill(); }
    // neck + head
    at(ctx, 14, -168 + bob, (o.nod || 0) * 0.2 + laugh * Math.sin((o.t || 0) * 18) * 0.05, 1, 1, () => {
      ctx.fillStyle = skinD; ctx.fillRect(-10, 0, 22, 22);
      ell(ctx, 4, -24, 30, 34); ctx.fillStyle = skin; ctx.fill();
      ell(ctx, -30, -14, 11, 10); ctx.fillStyle = '#1a1210'; ctx.fill(); // hair bun
      ctx.beginPath(); ctx.moveTo(30, -26); ctx.lineTo(40, -14); ctx.lineTo(30, -10); ctx.fillStyle = skin; ctx.fill(); // nose
      ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(24, -2, 8, 0.1, 1.6 + laugh); ctx.stroke(); // smile
      // nón lá
      ctx.save(); ctx.translate(4, -40);
      ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(-92, 6); ctx.quadraticCurveTo(0, 22, 96, 6); ctx.closePath();
      const hg = ctx.createLinearGradient(-90, 0, 96, 0); hg.addColorStop(0, '#b89a5e'); hg.addColorStop(0.45, '#f4e6b8'); hg.addColorStop(1, '#a8884e');
      ctx.fillStyle = hg; ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,40,0.45)'; ctx.lineWidth = 1.5;
      for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(lerp(0, -92, i / 7) + 2, lerp(-78, 6, i / 7)); ctx.quadraticCurveTo(0, lerp(-78, 22, i / 7), lerp(0, 96, i / 7) - 2, lerp(-78, 6, i / 7)); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 12, 92, 10, 0, 0, Math.PI); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#e9d6b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(0, 14, 26, -22); ctx.stroke(); // strap
    });
    // near arm
    const hA = o.handA || [80, -60];
    const eA = ik(sh[0] + 6, sh[1] + 6, hA[0], hA[1], 70, 66, -1);
    seg(ctx, sh[0] + 6, sh[1] + 6, eA[0], eA[1], 32, 28, shirt); seg(ctx, eA[0], eA[1], hA[0], hA[1], 24, 20, skin);
    ell(ctx, hA[0], hA[1], 14, 13); ctx.fillStyle = skin; ctx.fill();
    if (o.holdFn) o.holdFn(ctx, hA);
  });
}

// ---------------- food & kitchen props ----------------
// big aluminium pot (side ¾). origin = bottom centre. o: {k, level, broth, items(fn), r, h}
function pot(ctx, x, y, s, o = {}) {
  const k = o.k === undefined ? 0.35 : o.k, R = o.r || 200, h = o.h || 230;
  at(ctx, x, y, 0, s, s, () => {
    P.cylBody(ctx, 0, R, R, h, k, P.metalGrad(ctx, -R, R));
    // handles
    ctx.fillStyle = '#3a3a3c'; ctx.beginPath(); ctx.roundRect(-R - 34, -h + 30, 40, 18, 8); ctx.fill(); ctx.beginPath(); ctx.roundRect(R - 6, -h + 30, 40, 18, 8); ctx.fill();
    ell(ctx, 0, -h, R, R * k); ctx.fillStyle = '#dad6ce'; ctx.fill();
    ctx.save(); ell(ctx, 0, -h, R - 8, (R - 8) * k); ctx.clip();
    ctx.fillStyle = '#2a2622'; ctx.fillRect(-R, -h - R, 2 * R, 2 * R);
    const ly = -h + 18;
    ell(ctx, 0, ly, R - 10, (R - 10) * k);
    const bg = ctx.createRadialGradient(-R * 0.3, ly - 20, 10, 0, ly, R);
    bg.addColorStop(0, o.broth ? o.broth[0] : '#e0a84e'); bg.addColorStop(1, o.broth ? o.broth[1] : '#7a4a14');
    ctx.fillStyle = bg; ctx.fill();
    if (o.items) o.items(ctx, ly, R, k);
    if (o.boil) P.bubbles(ctx, o.boil, ly, R - 20, k, 0);
    ctx.restore();
    ell(ctx, 0, -h, R, R * k); ctx.lineWidth = 6; ctx.strokeStyle = '#f4f0e8'; ctx.stroke();
  });
}
// fermented fish piece (mắm cá linh/cá sặc)
function fish(ctx, x, y, s, rot, col = '#a87a3a') {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-10, -18, 30, -6); ctx.lineTo(48, -16); ctx.lineTo(44, 0); ctx.lineTo(48, 16); ctx.lineTo(30, 6); ctx.quadraticCurveTo(-10, 18, -40, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.35));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,10,0.45)'; ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-14 + i * 10, 0, 8, -0.9, 0.9); ctx.stroke(); }
    ell(ctx, -30, -3, 3, 3); ctx.fillStyle = '#1a1006'; ctx.fill();
  });
}
function lemongrass(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(-120, 0, 120, 0); g.addColorStop(0, '#f0ead0'); g.addColorStop(0.5, '#d9e2a0'); g.addColorStop(1, '#7aa246');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-120, -9, 240, 18, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,60,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-110 + i * 40, -6); ctx.lineTo(-100 + i * 40, 6); ctx.stroke(); }
  });
}
function eggplant(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.roundRect(-34, -22, 68, 44, 18); ctx.fillStyle = '#f0e2b8'; ctx.fill();
    ctx.beginPath(); ctx.roundRect(-34, -22, 68, 12, 6); ctx.fillStyle = '#4a1f5a'; ctx.fill();
    ctx.fillStyle = 'rgba(160,130,70,0.5)'; for (let i = 0; i < 8; i++) { ell(ctx, -20 + (i % 4) * 13, 2 + Math.floor(i / 4) * 10, 2, 2); ctx.fill(); }
  });
}
// roast pork block (heo quay): crackling skin on top, fat, meat layers
function porkBlock(ctx, x, y, s, rot, w = 120) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = '#e8a088'; ctx.beginPath(); ctx.roundRect(-w / 2, -10, w, 46, 6); ctx.fill();
    ctx.fillStyle = '#f6e6d4'; ctx.fillRect(-w / 2, -14, w, 12); ctx.fillRect(-w / 2, 12, w, 6);
    ctx.fillStyle = '#c96a50'; ctx.fillRect(-w / 2, 22, w, 4);
    const g = ctx.createLinearGradient(0, -34, 0, -12); g.addColorStop(0, '#f7c46a'); g.addColorStop(1, '#b8641e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -34, w, 22, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.75)'; const r = rng(w | 0); for (let i = 0; i < 18; i++) { ell(ctx, -w / 2 + 6 + r() * (w - 12), -30 + r() * 14, 2 + r() * 3, 2 + r() * 2); ctx.fill(); }
  });
}
function shrimp(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.15 + i * 0.22, r0 = 30;
      ctx.strokeStyle = i % 2 ? '#ff7a3c' : '#f2582a'; ctx.lineWidth = 24 - i * 2.6;
      ctx.beginPath(); ctx.arc(0, 0, r0, a, a + 0.24); ctx.stroke();
    }
    ctx.strokeStyle = '#ffd6b8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 38, 0.6, 1.6); ctx.stroke();
    ctx.fillStyle = '#e8401c'; ctx.beginPath(); ctx.moveTo(26, -18); ctx.lineTo(56, -30); ctx.lineTo(36, -6); ctx.fill();
  });
}
function squid(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-30, -14); ctx.quadraticCurveTo(0, -26, 30, -14); ctx.quadraticCurveTo(38, 4, 26, 16); ctx.quadraticCurveTo(0, 6, -26, 16); ctx.quadraticCurveTo(-38, 2, -30, -14); ctx.closePath();
    const g = ctx.createLinearGradient(0, -24, 0, 18); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, '#f3e2d6'); g.addColorStop(1, '#e0b8b0');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(200,110,110,0.45)'; ctx.lineWidth = 2;
    for (let i = -40; i < 40; i += 9) { ctx.beginPath(); ctx.moveTo(i, -26); ctx.lineTo(i + 20, 20); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + 20, -26); ctx.lineTo(i, 20); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(190,100,110,0.7)'; ctx.lineWidth = 2.5; ctx.stroke();
  });
}
function fishFlake(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-26, -8); ctx.quadraticCurveTo(0, -20, 26, -6); ctx.quadraticCurveTo(30, 10, 0, 14); ctx.quadraticCurveTo(-28, 12, -26, -8);
    ctx.fillStyle = '#f7f1e6'; ctx.fill(); ctx.strokeStyle = 'rgba(180,150,110,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, -6); ctx.lineTo(10, 6); ctx.stroke();
  });
}
function chiliSlice(ctx, x, y, s) { at(ctx, x, y, 0, s, s, () => { ell(ctx, 0, 0, 10, 10); ctx.fillStyle = '#d42a1e'; ctx.fill(); ell(ctx, 0, 0, 5, 5); ctx.fillStyle = '#f6d36b'; ctx.fill(); }); }
function lime(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.arc(0, 0, 34, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#5aa02c'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 28, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#d6ec8a'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { const a = Math.PI + i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26); ctx.stroke(); }
  });
}
// noodle nest (bún), top or side; n strands
function noodles(ctx, x, y, s, w = 200, h = 90, seed = 4, col = '#fbf7ee') {
  at(ctx, x, y, 0, s, s, () => {
    const r = rng(seed);
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = i % 3 ? col : '#e9e2d0'; ctx.lineWidth = 3;
      const y0 = (r() - 0.5) * h, x0 = -w / 2 + r() * 30;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      for (let k = 1; k <= 6; k++) ctx.quadraticCurveTo(x0 + k * w / 6 - w / 12, y0 + (r() - 0.5) * 30, x0 + k * w / 6 - 10, y0 + (r() - 0.5) * 16);
      ctx.stroke();
    }
  });
}
// ceramic bowl (tô) side ¾; origin = foot centre; contents via fn(ctx, topY, rx, ry)
function bowl(ctx, x, y, s, o = {}) {
  const k = o.k === undefined ? 0.32 : o.k, R = 190, hgt = 120;
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ctx.save(); ctx.filter = 'blur(10px)'; ell(ctx, 0, 6, R * 0.8, R * k * 0.5); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.restore();
    const top = -hgt;
    ctx.beginPath(); ctx.moveTo(-R, top); ctx.bezierCurveTo(-R, top + 80, -70, -6, -55, 0); ctx.lineTo(55, 0); ctx.bezierCurveTo(70, -6, R, top + 80, R, top);
    ctx.ellipse(0, top, R, R * k, 0, 0, Math.PI, false); ctx.closePath();
    const g = ctx.createLinearGradient(-R, 0, R, 0); g.addColorStop(0, '#c9c6bd'); g.addColorStop(0.3, '#fdfbf5'); g.addColorStop(1, '#a9a69c');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2f5a9a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(0, top + 26, R * 0.94, R * k * 0.94, 0, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, top + 40, R * 0.88, R * k * 0.88, 0, 0.2, Math.PI - 0.2); ctx.stroke();
    ell(ctx, 0, top, R, R * k); ctx.fillStyle = '#f4f1ea'; ctx.fill();
    ctx.save(); ell(ctx, 0, top, R - 10, (R - 10) * k); ctx.clip();
    ctx.fillStyle = '#e6e1d6'; ctx.fillRect(-R, top - R, 2 * R, 2 * R);
    if (o.fill) o.fill(ctx, top + 8, R - 12, (R - 12) * k);
    ctx.restore();
    ell(ctx, 0, top, R, R * k); ctx.lineWidth = 4; ctx.strokeStyle = '#2f5a9a'; ctx.stroke();
  });
}
// standard bowl contents: broth + noodles + toppings; amount 0..1 per layer
function bowlContents(o = {}) {
  return (ctx, ty, rx, ry) => {
    const b = o.broth === undefined ? 1 : o.broth;
    if (b > 0) { ell(ctx, 0, ty + 10 * (1 - b), rx, ry); const g = ctx.createRadialGradient(-rx * 0.3, ty - 10, 10, 0, ty, rx); g.addColorStop(0, '#f0b45a'); g.addColorStop(1, '#8a4e18'); ctx.globalAlpha = 0.95 * b; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1; }
    if (o.noodles) noodles(ctx, 0, ty - 4, 1, rx * 1.6, ry * 1.2, 7);
    const r = rng(12), tp = o.toppings || 0;
    const slots = [['pork', -70, -6], ['shrimp', 60, -14], ['squid', 10, 14], ['fish', -20, -24], ['pork', 90, 12], ['shrimp', -100, 16], ['egg', 40, -30], ['squid', -50, 22]];
    slots.forEach((sl, i) => {
      if (i >= tp) return;
      const [kd, sx, sy] = sl, X = sx * rx / 170, Y = ty + sy * ry / 55;
      if (kd === 'pork') porkBlock(ctx, X, Y, 0.55, (r() - 0.5) * 0.4, 110);
      else if (kd === 'shrimp') shrimp(ctx, X, Y, 0.7, r() * TAU);
      else if (kd === 'squid') squid(ctx, X, Y, 0.8, 0);
      else if (kd === 'fish') fishFlake(ctx, X, Y, 0.9, r());
      else eggplant(ctx, X, Y, 0.7, r());
    });
    if (o.chili) for (let i = 0; i < o.chili; i++) chiliSlice(ctx, (r() - 0.5) * rx * 1.2, ty + (r() - 0.5) * ry * 1.2, 0.9);
    if (o.herbs) for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#3f8f3a' : '#79c25f'; ell(ctx, (r() - 0.5) * rx * 1.3, ty + (r() - 0.5) * ry, 12, 6); ctx.fill(); }
  };
}
// greens basket items (top-down)
function lilyStem(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#c98ab0'); g.addColorStop(0.5, '#9fc27a'); g.addColorStop(1, '#6a8a4a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-150, -9, 300, 18, 9); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-140, -4); ctx.lineTo(140, -4); ctx.stroke();
  });
}
function dienDien(ctx, x, y, s, t = 0, bloom = 1) {
  at(ctx, x, y, 0, s, s, () => {
    const r = rng((x * 7 + y) | 0);
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU, d = r() * 26, px = Math.cos(a) * d, py = Math.sin(a) * d, sz = (8 + r() * 6) * bloom;
      ctx.fillStyle = r() < 0.5 ? '#ffd23a' : '#f5b81c';
      ctx.beginPath(); ctx.ellipse(px, py, sz, sz * 0.7, a, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8941a'; ell(ctx, px, py, sz * 0.3, sz * 0.25); ctx.fill();
    }
  });
}
function leafSmall(ctx, x, y, s, rot, col = '#3f8f3a') {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.quadraticCurveTo(0, -12, 20, 0); ctx.quadraticCurveTo(0, 12, -20, 0); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,200,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
  });
}
function sprout(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.strokeStyle = '#f8f4e8'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, -6, 24, 2); ctx.stroke();
    ell(ctx, 26, 2, 6, 4); ctx.fillStyle = '#e8d66a'; ctx.fill();
  });
}
// woven bamboo basket (top-down circle) with optional fill callback
function basket(ctx, x, y, s, R = 300, fillFn) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.save(); ctx.filter = 'blur(16px)'; ell(ctx, 14, 20, R * 1.02, R * 1.02); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    ell(ctx, 0, 0, R, R); ctx.fillStyle = '#b88a4e'; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, R, R); ctx.clip();
    ctx.strokeStyle = 'rgba(90,55,20,0.45)'; ctx.lineWidth = 3;
    for (let i = -R; i < R; i += 14) { ctx.beginPath(); ctx.moveTo(i, -R); ctx.lineTo(i + R, R); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, R); ctx.lineTo(i + R, -R); ctx.stroke(); }
    if (fillFn) fillFn(ctx);
    ctx.restore();
    ctx.lineWidth = 16; ctx.strokeStyle = '#8a5e2a'; ell(ctx, 0, 0, R - 6, R - 6); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,220,160,0.5)'; ell(ctx, 0, 0, R - 12, R - 12); ctx.stroke();
  });
}
// smell wave ribbons from (x0,y0) to (x1,y1)
function smellWave(ctx, x0, y0, x1, y1, t, k) {
  if (k <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
  const cols = ['170,210,90', '230,220,110', '150,190,120'];
  for (let i = 0; i < 6; i++) {
    const ph = i * 1.1;
    for (const [lw, a] of [[26, 0.14], [9, 0.45]]) {
      ctx.lineWidth = lw; ctx.strokeStyle = `rgba(${cols[i % 3]},${a * k})`;
      ctx.beginPath();
      for (let u = 0; u <= 1.001; u += 0.05) {
        const uu = u * k, x = lerp(x0, x1, uu) + Math.sin(uu * 10 + t * 6 + ph) * 40, y = lerp(y0, y1, uu) + Math.cos(uu * 8 + t * 5 + ph) * 30 + (i - 2.5) * 22;
        u === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  // little fish-bone icons riding the wave
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 5; i++) {
    const u = ((t * 0.7 + i / 5) % 1) * k, x = lerp(x0, x1, u) + Math.sin(u * 10 + t * 6) * 40, y = lerp(y0, y1, u) + (i - 2) * 30;
    at(ctx, x, y, Math.sin(t * 4 + i) * 0.4, 1.1, 1.1, () => {
      ctx.strokeStyle = `rgba(250,245,225,${0.85 * k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(18, 0); ctx.stroke();
      for (let r = -12; r <= 8; r += 7) { ctx.beginPath(); ctx.moveTo(r, -9); ctx.lineTo(r + 3, 9); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(28, -8); ctx.lineTo(28, 8); ctx.closePath(); ctx.stroke();
      ell(ctx, -26, 0, 6, 6); ctx.stroke();
    });
  }
  ctx.restore();
}

module.exports = {
  sky, water, mist, bank, ghe, hull, xuong, wake, coUt, pot, fish, lemongrass, eggplant, porkBlock, shrimp, squid, fishFlake,
  chiliSlice, lime, noodles, bowl, bowlContents, lilyStem, dienDien, leafSmall, sprout, basket, smellWave, mixHex,
};
