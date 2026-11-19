// Bún mắm – shots 1–10: river wakes + first cooking steps.
const L = require('./lib');
const P = require('./props');
const R = require('./river');
const Pp = require('./people');
const Tx = require('./text');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, motionBlurX } = L;
const { ell } = P;

const bump = (t, t0, d) => (t < t0 || t > t0 + d ? 0 : Math.sin(Math.PI * (t - t0) / d));
const UT_SKIN = ['#c98a5e', '#8a5532'];
const TOUR_SKIN = ['#f2c3a0', '#c97c5e'];
function darkBg(ctx, c0, c1) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
function warmBokeh(ctx, T, shift = 0, seed = 77) {
  darkBg(ctx, '#5a3a20', '#1c1008');
  ctx.save(); ctx.translate(shift, 0);
  bokeh(ctx, T, seed, 22, ['rgba(255,200,120,0.9)', 'rgba(255,230,170,0.8)', 'rgba(140,210,200,0.6)'], 0.32, 30, 120);
  ctx.restore();
}
function pour(ctx, x0, y0, x1, y1, w, kind, t, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
  const cx = lerp(x0, x1, 0.9), cy = y0 + (y1 - y0) * 0.1, wob = Math.sin(t * 37) * 1.5;
  const path = (dx) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx + dx, cy, x1 + dx * 0.4, y1); };
  if (kind === 'broth') {
    ctx.lineWidth = w; ctx.strokeStyle = 'rgba(200,120,40,0.85)'; path(wob); ctx.stroke();
    ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = w * 0.3; ctx.strokeStyle = 'rgba(255,230,160,0.95)'; path(wob - w * 0.2); ctx.stroke();
  } else {
    ctx.lineWidth = w; ctx.strokeStyle = 'rgba(205,230,240,0.45)'; path(wob); ctx.stroke();
    ctx.globalCompositeOperation = 'screen'; ctx.lineWidth = w * 0.3; ctx.strokeStyle = 'rgba(255,248,230,0.95)'; path(wob - w * 0.2); ctx.stroke();
  }
  ctx.restore();
}
function pointAt(ctx, tx, ty, th, s, skin, sleeve, armCol) {
  const c = Math.cos(th), sn = Math.sin(th);
  const ox = tx - s * (90 * c + 22 * sn), oy = ty - s * (90 * sn - 22 * c);
  const wx = ox - s * 55 * c, wy = oy - s * 55 * sn;
  P.forearm(ctx, wx - c * 900, wy - sn * 900, wx, wy, armCol, sleeve, 78 * s);
  P.hand(ctx, ox, oy, s, th, 'point', skin);
}
function kingfisher(ctx, x, y, s, t) {
  at(ctx, x, y, -0.1, s, s, () => {
    ell(ctx, 0, 0, 30, 14); ctx.fillStyle = '#1f8fd0'; ctx.fill();
    ell(ctx, 8, 6, 20, 8); ctx.fillStyle = '#f08a2a'; ctx.fill();
    ell(ctx, 30, -6, 13, 12); ctx.fillStyle = '#1f7fc0'; ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.moveTo(40, -8); ctx.lineTo(70, -4); ctx.lineTo(40, -2); ctx.fill();
    const a = Math.sin(t * 40) * 0.9; ctx.fillStyle = '#2aa0e0'; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-22, -6 - 34 * Math.cos(a)); ctx.lineTo(16, -8); ctx.fill();
  });
}
// background river world (wide). o.boats: draw distant boats
function river(ctx, T, o = {}) {
  const hy = o.hy || 820;
  R.sky(ctx, -400, hy);
  glow(ctx, o.sunX || 600, hy - 40, 560, 'rgba(255,200,120,0.9)', 0.9);
  glow(ctx, o.sunX || 600, hy - 40, 90, 'rgba(255,248,225,1)', 1);
  R.bank(ctx, hy, 0.55, 0.62, 3);
  R.water(ctx, hy, 2400, T, o.sunX || 600);
  R.mist(ctx, hy - 10, 110, T, 0.6);
  if (o.boats !== false) {
    R.ghe(ctx, 140 + T * 6, hy + 110, 0.45, T, { canopy: true, seed: 2, beoItems: ['#d9822b', '#5a7a2a'] });
    R.ghe(ctx, 860 - T * 5, hy + 150, 0.5, T, { flip: true, seed: 6, hue: '#2f8f5a' });
  }
}

// ============ S1 0–3 Aerial dawn ============
function s1(ctx, lt, p, T) {
  const cy = lerp(780, 1180, ease.inOut(p)), z = lerp(1.12, 1.0, ease.inOut(p));
  cam(ctx, 540, cy, z, 0, () => {
    river(ctx, T, { boats: false, hy: 860 });
    // many boats converging on the market
    const r = rng(9);
    for (let i = 0; i < 14; i++) {
      const d = r(), y = 930 + d * 900, s = 0.18 + d * 0.6, x = -100 + r() * 1300 + (r() < 0.5 ? 1 : -1) * T * (10 + 30 * d);
      R.ghe(ctx, x, y, s, T + i, { seed: i, flip: r() < 0.5, beo: r() < 0.6, canopy: r() < 0.3, hue: ['#2f6b8f', '#2f8f5a', '#8f2f3a'][i % 3] });
      R.wake(ctx, x, y + 20 * s, 200 * s, T + i * 0.3);
    }
    for (let i = 0; i < 5; i++) { const bx = -100 + ((lt * (110 + i * 30) + i * 230) % 1400), by = 600 + i * 30 + Math.sin(lt * 3 + i) * 10; at(ctx, bx, by, 0, 0.8, 0.8, () => { ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = 3; ctx.beginPath(); const f = Math.sin(lt * 14 + i) * 8; ctx.moveTo(-14, f); ctx.quadraticCurveTo(-6, -4, 0, 0); ctx.quadraticCurveTo(6, -4, 14, f); ctx.stroke(); }); }
  });
  flare(ctx, 600, (820 - cy) * z + 960, 0.9, 0.35 + 0.45 * bump(lt, 1.6, 1.0));
  dust(ctx, lt, 3, 40, 0, 0, W, H, '255,220,170', 2.5, 0.5);
  Tx.label(ctx, T, 0.8, 2.9, 'MIỀN TÂY · 5:30 SÁNG', 'Mekong Delta · 5:30 AM', 1360);
  if (lt < 0.8) { ctx.fillStyle = `rgba(0,0,0,${1 - ease.out(lt / 0.8)})`; ctx.fillRect(0, 0, W, H); }
}

// ============ S2 3–5.5 Floating market ============
function s2(ctx, lt, p, T) {
  cam(ctx, 540, 960, lerp(1.0, 1.06, p), 0, () => {
    river(ctx, T, { boats: false, hy: 620, sunX: 300 });
    R.ghe(ctx, lerp(-150, 250, p), 900, 0.75, T, { seed: 3, canopy: true, beoItems: ['#d9822b', '#c99a2e', '#5a7a2a'] });
    R.ghe(ctx, lerp(1250, 900, p), 980, 0.8, T, { seed: 8, flip: true, hue: '#8f2f3a', beoItems: ['#7aa83a', '#d9822b'] });
    R.ghe(ctx, lerp(1400, 300, ease.inOut(p)), 1520, 1.6, T, { seed: 4, flip: true, hue: '#2f8f5a', beoItems: ['#d9822b', '#c99a2e', '#c99a2e'] });
    R.wake(ctx, lerp(1400, 300, ease.inOut(p)), 1560, 300, T);
    // oar strokes
    for (const t0 of [0.4, 1.4, 2.2]) { const k = lt - t0; if (k > 0 && k < 0.6) P.splash(ctx, 820, 1600, k * 0.3, 7 + t0 * 3, 'water', 10); }
  });
  godRays(ctx, 300, 560, 1.2, 0.9, 1800, 8, 'rgba(255,215,150,0.5)', 0.4, T);
  dust(ctx, T, 5, 30, 0, 0, W, H, '255,220,170', 2.5, 0.45);
}

// ============ S3 5.5–8 Tourist drifts in, wobbling ============
function s3(ctx, lt, p, T) {
  const wob = bump(lt, 0.8, 0.5) - bump(lt, 1.5, 0.5);
  cam(ctx, 540, 1000, 1.05, 0, () => {
    river(ctx, T, { hy: 700, sunX: 380 });
    const bx = lerp(1300, 600, ease.out(clamp(lt / 1.6)));
    R.wake(ctx, bx + 120, 1480, 260, T);
    R.xuong(ctx, bx, 1470, 1.5, T, {
      ph: 1, roll: wob * 0.12,
      inside: (c) => Pp.tourist(c, 30, -34, 1.05, { sit: 1, lean: wob * 0.25, look: -0.1, glassHand: wob !== 0 ? [-110, -40] : null, glassHandK: Math.abs(wob) }),
    });
  });
  if (lt > 1.75 && lt < 2.3) { const k = (lt - 1.75) / 0.55; kingfisher(ctx, lerp(-150, 1250, k), 900 - Math.sin(k * Math.PI) * 120, 1.6, T); }
  dust(ctx, T, 6, 30, 0, 0, W, H, '255,220,170', 2.5, 0.45);
}

// ============ S4 8–10 Sniff → whip to cô Út ============
function s4a(ctx, lt, T) {
  P.layer(ctx, 16, (x) => cam(x, 540, 900, 1.6, 0, () => river(x, T, { hy: 800 })));
  const sn = bump(lt, 0.45, 0.2) + bump(lt, 0.85, 0.2);
  Pp.face(ctx, 540, 1180 - sn * 14, 1.35, { lookX: lt > 0.9 ? -0.7 : 0.2, lookY: -0.2, brow: 0.3 + sn * 0.4, mouth: 'o', mOpen: 0.1, t: T, turn: lt > 0.9 ? -0.15 : 0.05 });
  // sniff lines near the nose
  if (sn > 0.1) { ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${sn * 0.8})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(540, 1120, 90 + i * 22, -2.2, -1.6); ctx.stroke(); } ctx.restore(); }
}
function utBoat(ctx, T, o = {}) {
  river(ctx, T, { hy: 760, sunX: 760 });
  R.xuong(ctx, 520, 1560, 1.6, T, {
    ph: 3,
    inside: (c) => {
      R.coUt(c, -60, -40, 1.15, { t: T, handA: o.handA || [120, -70], handB: [90, -50], laugh: o.laugh || 0, nod: o.nod || 0, holdFn: o.holdFn });
      P.stove(c, 150, -160, 0.28, T);
      R.pot(c, 150, -150, 0.45, { boil: T });
    },
  });
  steam(ctx, T, 31, 760, 1260, 120, 500, 9, 0.5);
}
function s4b(ctx, lt, T) { utBoat(ctx, T, { nod: bump(lt, 0.2, 0.4) }); }
function s4(ctx, lt, p, T) {
  const sw = 1.0;
  if (lt < sw) {
    const dx = lt > sw - 0.15 ? -ease.in((lt - (sw - 0.15)) / 0.15) * 900 : 0;
    if (dx) motionBlurX(ctx, dx, 8, (x) => s4a(x, lt, T)); else s4a(ctx, lt, T);
  } else {
    const k = clamp((lt - sw) / 0.2), dx = (1 - ease.out(k)) * 900;
    cam(ctx, 540, 960, lerp(1.25, 1.1, ease.out(clamp((lt - sw) / 1))), 0, () => {
      if (dx > 2) motionBlurX(ctx, dx, 8, (x) => s4b(x, lt - sw, T)); else s4b(ctx, lt - sw, T);
    });
  }
}

// ============ S5 10–13 Mắm into the boiling pot ============
function s5(ctx, lt, p, T) {
  warmBokeh(ctx, T);
  glow(ctx, 260, 420, 800, 'rgba(255,200,130,0.6)', 0.7);
  const shake = bump(lt, 0, 0.25) * 10;
  cam(ctx, 540 + Math.sin(T * 60) * shake, 1060, lerp(1.0, 1.1, ease.inOut(p)), 0, () => {
    const drops = [[0.6, 'fish', -60, 0.3], [1.2, 'fish', 70, -0.5], [1.8, 'grass', 0, 0.4]];
    R.pot(ctx, 540, 1700, 2.0, {
      k: 0.5, boil: T,
      items: (c, ly, Rr, k) => {
        for (const [t0, kd, x, rot] of drops) {
          if (lt < t0) continue;
          const bob = Math.sin(T * 3 + x) * 3;
          if (kd === 'fish') R.fish(c, x, ly + bob, 2.0, rot); else R.lemongrass(c, x - 20, ly - 6 + bob, 1.2, rot);
        }
        R.fish(c, -110, ly + 30, 1.8, 2.6, '#8a6a3a');
      },
    });
    // falling items + splashes
    const topY = 1700 - 230 * 2.0 + 18 * 2;
    for (const [t0, kd, x, rot] of drops) {
      const k = (lt - (t0 - 0.35)) / 0.35;
      if (k > 0 && k < 1) { const y = lerp(300, topY, k * k); if (kd === 'fish') R.fish(ctx, 540 + x * 2, y, 2.0, rot + k); else R.lemongrass(ctx, 540, y, 1.4, rot + k * 0.5); }
      const a = lt - t0; if (a > 0 && a < 0.6) P.splash(ctx, 540 + (kd === 'fish' ? x * 2 : 0), topY, a * 0.35, 11 + t0 * 10, 'water', 18);
    }
    steam(ctx, T, 41, 540, topY - 40, 500, 900, 14, 0.5);
  });
  Tx.title(ctx, T, 10.0, 12.3, 430, 'Mekong Fermented Fish Noodle Soup', 'BÚN MẮM', 'MIỀN TÂY', 128, 86);
  Tx.caption(ctx, T, 10.6, 12.9, 'Nấu mắm với sả', 'Simmer fish & lemongrass', { n: 1 });
}

// ============ S6 13–16 Strain through a bamboo basket ============
function s6(ctx, lt, p, T) {
  warmBokeh(ctx, T, -lt * 30);
  glow(ctx, 540, 520, 700, 'rgba(255,200,120,0.85)', 0.85);
  godRays(ctx, 540, 380, Math.PI / 2, 1.1, 1800, 10, 'rgba(255,210,140,0.55)', 0.4, T);
  cam(ctx, 540, 1000, lerp(1.0, 1.08, p), 0, () => {
    R.pot(ctx, 540, 1880, 1.8, { k: 0.4, boil: T * 0.6, broth: ['#f0b85a', '#8a5418'] });
    // basket (side view) held above
    const by = 760 + Math.sin(T * 2) * 6;
    at(ctx, 540, by, 0, 1, 1, () => {
      ctx.beginPath(); ctx.ellipse(0, 0, 300, 70, 0, 0, TAU); ctx.fillStyle = '#5a3a18'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(-300, 0); ctx.bezierCurveTo(-280, 220, 280, 220, 300, 0); ctx.ellipse(0, 0, 300, 70, 0, 0, Math.PI, false); ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#b88a4e'; ctx.fillRect(-310, -80, 620, 320);
      ctx.strokeStyle = 'rgba(90,55,20,0.55)'; ctx.lineWidth = 3;
      for (let i = -320; i < 320; i += 16) { ctx.beginPath(); ctx.moveTo(i, -80); ctx.lineTo(i + 120, 240); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, 240); ctx.lineTo(i + 120, -80); ctx.stroke(); }
      ctx.restore();
      // bones & mush in the basket
      const r = rng(5);
      ell(ctx, 0, -4, 270, 56); ctx.fillStyle = '#8a6a3a'; ctx.fill();
      ctx.strokeStyle = '#f2ead6'; ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) { const bx = (r() - 0.5) * 460, byy = (r() - 0.5) * 70; ctx.beginPath(); ctx.moveTo(bx - 20, byy); ctx.lineTo(bx + 20, byy + (r() - 0.5) * 10); ctx.stroke(); for (let k = -12; k <= 12; k += 8) { ctx.beginPath(); ctx.moveTo(bx + k, byy - 7); ctx.lineTo(bx + k + 2, byy + 7); ctx.stroke(); } }
      ctx.lineWidth = 12; ctx.strokeStyle = '#8a5e2a'; ell(ctx, 0, 0, 300, 70); ctx.stroke();
    });
    // golden broth streams
    const on = clamp((lt - 0.4) / 0.2) * clamp((2.4 - lt) / 0.3);
    if (on > 0) for (let i = -3; i <= 3; i++) pour(ctx, 540 + i * 50, by + 150 - Math.abs(i) * 18, 540 + i * 40, 1420, 10 - Math.abs(i), 'broth', T + i, on);
    steam(ctx, T, 51, 540, 1400, 500, 800, 10, 0.4);
  });
  Tx.caption(ctx, T, 13.15, 15.9, 'Lọc lấy nước', 'Strain the broth', { n: 2 });
}

// ============ S7 16–19 Fry lemongrass, garlic, shallots ============
const AROMA = (() => { const r = rng(71), a = []; for (let i = 0; i < 140; i++) { const u = r() * 2 - 1; a.push({ x: u * 210, y: 8 + r() * 30 - (1 - u * u) * 20, c: ['#d9e2a0', '#f4ead0', '#b0607a', '#e8c070'][(r() * 4) | 0], s: 3 + r() * 6, ph: r() * TAU }); } return a; })();
function s7(ctx, lt, p, T) {
  darkBg(ctx, '#1a0c06', '#3a1c0c');
  bokeh(ctx, T, 41, 14, ['rgba(255,140,50,0.9)', 'rgba(255,200,120,0.8)'], 0.3, 30, 110);
  cam(ctx, 540, 1180, lerp(1.05, 1.15, ease.inOut(p)), 0, () => {
    glow(ctx, 540, 1260, 650, 'rgba(255,110,30,0.8)', 0.6);
    P.stove(ctx, 540, 1230, 1.25, T);
    P.wok(ctx, 540, 1150, 1.25, 0, () => {
      for (const a of AROMA) { const hop = Math.max(0, Math.sin(T * 9 + a.ph)) * 10; ell(ctx, a.x, a.y - hop, a.s, a.s * 0.7); ctx.fillStyle = a.c; ctx.fill(); }
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ell(ctx, -40, 20, 200, 26); ctx.fillStyle = 'rgba(255,200,120,0.25)'; ctx.fill(); ctx.restore();
    });
    // spatula scrapes
    const sc = [0.95, 1.75, 2.45].reduce((m, t0) => Math.max(m, bump(lt, t0 - 0.2, 0.45)), 0);
    at(ctx, 540 + lerp(-160, 160, sc), 1110, -0.9 + sc * 0.3, 1, 1, () => {
      ctx.fillStyle = '#6a4024'; ctx.beginPath(); ctx.roundRect(0, -8, 300, 16, 8); ctx.fill();
      ctx.fillStyle = '#9aa0a4'; ctx.beginPath(); ctx.roundRect(-70, -26, 80, 52, 8); ctx.fill();
    });
    // oil pops (sparkly)
    const r = rng(17);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 40; i++) { const ph = r(), life = (T * (1 + r()) + ph) % 1, x = 540 + (r() - 0.5) * 520, y = 1150 - life * 260 + life * life * 200; ctx.globalAlpha = (1 - life) * 0.9; ctx.fillStyle = 'rgba(255,230,160,1)'; ctx.beginPath(); ctx.arc(x, y, 2 + r() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
    steam(ctx, T, 33, 540, 1080, 340, 760, 10, 0.25);
  });
  Tx.caption(ctx, T, 16.15, 18.9, 'Phi sả, tỏi, hành', 'Fry lemongrass & garlic', { n: 3 });
}

// ============ S8 19–22 Aromatics into the pot + eggplant splash ============
function s8(ctx, lt, p, T) {
  warmBokeh(ctx, T, 0, 81);
  glow(ctx, 300, 400, 800, 'rgba(255,200,130,0.6)', 0.7);
  cam(ctx, 540, 1060, lerp(1.0, 1.06, p), 0, () => {
    const topY = 1760 - 230 * 1.9 + 18 * 1.9;
    R.pot(ctx, 540, 1760, 1.9, {
      k: 0.45, boil: T,
      items: (c, ly) => {
        const n = clamp((lt - 0.5) / 0.6); const r = rng(3);
        for (let i = 0; i < 90 * n; i++) { ell(c, (r() - 0.5) * 340, ly + (r() - 0.5) * 70, 4, 3); c.fillStyle = ['#d9e2a0', '#e8c070', '#b0607a'][i % 3]; c.fill(); }
        if (lt > 1.4) R.eggplant(c, -60, ly + Math.sin(T * 3) * 3, 1.6, 0.3);
        if (lt > 2.0) R.eggplant(c, 80, ly + 10 + Math.sin(T * 3 + 1) * 3, 1.6, -0.5);
      },
    });
    // wok tipping aromatics (top left)
    const tip = ease.inOut(clamp((lt - 0.1) / 0.4)) * (1 - ease.inOut(clamp((lt - 1.1) / 0.4)));
    if (tip > 0.01) {
      P.wok(ctx, 220, 520, 0.8, 0.9 * tip, null);
      const r = rng(9);
      for (let i = 0; i < 120 * tip; i++) { const k = (T * 2 + r()) % 1; const x = lerp(400, 520, k) + (r() - 0.5) * 60, y = lerp(620, topY, k * k); ell(ctx, x, y, 4, 3); ctx.fillStyle = ['#d9e2a0', '#e8c070', '#b0607a'][i % 3]; ctx.fill(); }
    }
    // eggplant chunks falling (slow-motion) + splash crowns
    for (const [t0, x] of [[1.4, 420], [2.0, 690]]) {
      const k = (lt - (t0 - 0.45)) / 0.45;
      if (k > 0 && k < 1) R.eggplant(ctx, x, lerp(250, topY, k * k), 2.2, k * 1.5);
      const a = lt - t0; if (a > 0 && a < 0.9) P.splash(ctx, x, topY, a * 0.32, 21 + t0 * 10, 'water', 22);
    }
    steam(ctx, T, 43, 540, topY - 20, 480, 800, 12, 0.45);
  });
  Tx.caption(ctx, T, 19.15, 21.9, 'Cà tím', 'Add eggplant', { n: 4 });
}

// ============ S9 22–24.5 Cleaver on crispy roast pork ============
function board(ctx, y) {
  const g = ctx.createLinearGradient(0, y, 0, y + 600); g.addColorStop(0, '#a8743e'); g.addColorStop(1, '#5a3618');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-80, y, 1240, 700, 30); ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.3)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(-80, y + 30 + i * 45); ctx.bezierCurveTo(300, y + 20 + i * 47, 700, y + 40 + i * 43, 1160, y + 30 + i * 46); ctx.stroke(); }
}
function s9(ctx, lt, p, T) {
  darkBg(ctx, '#2a1608', '#120804');
  glow(ctx, 300, 500, 900, 'rgba(255,190,110,0.6)', 0.7);
  const chops = [0.5, 1.0, 1.5, 2.0];
  const hit = chops.reduce((m, t0) => Math.max(m, bump(lt, t0, 0.12)), 0);
  cam(ctx, 540, 1100 + hit * 6, lerp(1.1, 1.2, p), 0, () => {
    board(ctx, 1200);
    const n = chops.filter(t0 => lt > t0).length;
    // slab + separated slices
    for (let i = 0; i < 5; i++) {
      const sep = i < n ? (i + 1) * 26 : 0, x = 200 + i * 130 + sep;
      R.porkBlock(ctx, x, 1250, 2.2, 0, i < n ? 52 : 60);
    }
    // cleaver
    const t0 = chops.find(t => lt < t + 0.5) || 2.0, k = clamp((lt - (t0 - 0.35)) / 0.35);
    const cy = lerp(700, 1150, ease.in(k));
    const cx = 200 + Math.min(4, chops.indexOf(t0)) * 156 + 60;
    at(ctx, cx, cy, 0, 1, 1, () => {
      const g = ctx.createLinearGradient(-90, 0, 90, 0); g.addColorStop(0, '#6a6e72'); g.addColorStop(0.3, '#f2f2ee'); g.addColorStop(1, '#5a5e62');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-110, -170, 200, 170, 10); ctx.fill();
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.roundRect(-30, -390, 46, 220, 16); ctx.fill();
    });
    // crackling crumbs
    for (const c0 of chops) if (lt > c0) L.flakes(ctx, lt, c0, 60 + c0 * 10, 26, 200 + chops.indexOf(c0) * 156 + 60, 1180, { g: 1500, speed: 700, life: 0.9, size: 7, colors: ['#f7c46a', '#e8a040', '#fff0c0', '#c96a20'] });
  });
  Tx.caption(ctx, T, 22.1, 24.4, 'Heo quay', 'Crispy roast pork', { n: 5 });
}

// ============ S10 24.5–27.5 Shrimp, squid, fish – one per beat ============
function s10(ctx, lt, p, T) {
  darkBg(ctx, '#4a2e18', '#1a0e06');
  glow(ctx, 540, 900, 700, 'rgba(255,210,150,0.5)', 0.6);
  cam(ctx, 540, 980, lerp(1.0, 1.06, p), lerp(-0.02, 0.02, p), () => {
    // white plate top-down
    ctx.save(); ctx.filter = 'blur(20px)'; ell(ctx, 560, 1010, 430, 430); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
    ell(ctx, 540, 980, 420, 420); ctx.fillStyle = '#f6f3ec'; ctx.fill();
    ell(ctx, 540, 980, 330, 330); ctx.fillStyle = '#ece7dc'; ctx.fill();
    ctx.strokeStyle = '#2f5a9a'; ctx.lineWidth = 6; ell(ctx, 540, 980, 395, 395); ctx.stroke();
    const items = [[0.5, 'shrimp'], [1.5, 'squid'], [2.5, 'fish']];
    const spots = { shrimp: [[420, 860], [520, 820], [620, 880]], squid: [[700, 1010], [640, 1110], [740, 1120]], fish: [[400, 1050], [470, 1150], [360, 1150]] };
    for (const [t0, kd] of items) {
      spots[kd].forEach(([x, y], i) => {
        const k = clamp((lt - (t0 - 0.3) - i * 0.05) / 0.3);
        if (k <= 0) return;
        const yy = lerp(y - 500, y, ease.outBack(k)), sc = 2.1;
        if (kd === 'shrimp') R.shrimp(ctx, x, yy, sc, i * 0.8); else if (kd === 'squid') R.squid(ctx, x, yy, sc, 0); else R.fishFlake(ctx, x, yy, sc, i);
      });
      if (lt > t0 && lt < t0 + 0.4) L.sparkle(ctx, spots[kd][1][0], spots[kd][1][1] - 60, 70, 1 - (lt - t0) / 0.4);
    }
    // herbs garnish
    for (let i = 0; i < 6; i++) R.leafSmall(ctx, 540 + Math.cos(i) * 300, 980 + Math.sin(i) * 300, 1.6, i, i % 2 ? '#3f8f3a' : '#79c25f');
  });
  Tx.caption(ctx, T, 24.6, 27.4, 'Tôm, mực, cá lóc', 'Shrimp, squid, snakehead fish', { n: 6, vsize: 54 });
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, river, utBoat, pour, bump, darkBg, warmBokeh, pointAt, UT_SKIN, TOUR_SKIN };
