// Shots 1–10: Saigon night, the stall, the hungry tourist, hot lard, title; act II steps 1–5.
const L = require('./lib');
const P = require('./props');
const F = require('./food');
const K = require('./kitchen');
const Wd = require('./world');
const Pp = require('./people');
const Tx = require('./text');
const { W, H, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, flakes } = L;
const { ell } = P;

const bump = (t, t0, d) => (t < t0 || t > t0 + d ? 0 : Math.sin(Math.PI * (t - t0) / d));
const shake = (t, amp, f = 37) => [Math.sin(t * f) * amp, Math.cos(t * f * 1.3) * amp];

// ---------- shared scenery ----------
function sauCook(ctx, t, o = {}) {
  const sw = Math.sin(t * 5.5);
  K.sau(ctx, 720, 1262, 0.8, {
    handR: o.handR || [40 + sw * 30, -370 + Math.abs(sw) * 10], handL: o.handL || [190, -350],
    spatula: o.spatula === undefined ? -0.3 + sw * 0.25 : o.spatula,
    stop: o.stop, bounce: o.bounce, head: o.head || { look: 0.5, mouth: 'smile' },
  });
}
function stall(ctx, t, o = {}) {
  Wd.drawStreetNight(ctx);
  ctx.fillStyle = 'rgba(10,14,40,0.18)'; ctx.fillRect(-400, 0, 2000, H);
  sauCook(ctx, t, o);
  K.cartBC(ctx, 640, 1350, 0.9, t);
  steam(ctx, t, 3, 795, 930, 160, 420, 9, 0.22);
  if (o.tables !== false) {
    P.stool(ctx, 130, 1470, 1.0, '#d63b2f'); P.stool(ctx, 330, 1480, 1.0, '#2f6fd6');
    P.lowTable(ctx, 230, 1440, 1.1);
    P.stool(ctx, 980, 1490, 1.0, '#2f6fd6');
  }
  glow(ctx, 505, 965, 520, 'rgba(255,170,80,0.7)', 0.35);
}
function darkBg(ctx, t, seed, o = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, o.top || '#1a0f0a'); g.addColorStop(0.6, o.mid || '#2a170c'); g.addColorStop(1, o.bot || '#0c0705');
  ctx.fillStyle = g; ctx.fillRect(-400, -400, W + 800, H + 800);
  bokeh(ctx, t, seed, o.n || 16, o.cols || ['rgba(255,180,90,1)', 'rgba(255,220,150,1)', 'rgba(90,170,190,1)'], o.a || 0.28, 30, 110);
}
function wood(ctx, y0, y1, seed = 2) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#6a4022'); g.addColorStop(1, '#2a160a');
  ctx.fillStyle = g; ctx.fillRect(-600, y0, W + 1200, y1 - y0);
  const r = rng(seed); ctx.strokeStyle = 'rgba(30,14,4,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) { const y = y0 + r() * (y1 - y0); ctx.beginPath(); ctx.moveTo(-600, y); ctx.bezierCurveTo(300, y + (r() - 0.5) * 40, 700, y + (r() - 0.5) * 40, W + 600, y + (r() - 0.5) * 30); ctx.stroke(); }
}
function bikes(ctx, T, list) {
  for (const [tc, y, s, dir, cols] of list) {
    const u = (T - tc) / 0.32;
    if (Math.abs(u) > 2.2) continue;
    const x = 540 + dir * 820 * u * Math.abs(u) * 0.55 + dir * 120 * u, v = Math.abs(u) * 1.6 + 0.2;
    ctx.save();
    for (let i = 6; i >= 0; i--) { ctx.globalAlpha = i === 0 ? 0.95 : 0.22; Wd.motorbike(ctx, x - dir * i * v * 22, y, s, dir < 0, T, cols); }
    ctx.restore();
    glow(ctx, x + dir * 120 * s, y - 120 * s, 160 * s, 'rgba(255,240,200,0.9)', 0.6);
  }
}
// basting brush: origin = bristle tip, handle toward +x
function brush(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = '#e8d8a8'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(70, -20); ctx.lineTo(70, 20); ctx.lineTo(0, 26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,110,0.6)'; ctx.fillRect(0, -26, 26, 52);
    ctx.fillStyle = '#9a9ea2'; ctx.fillRect(70, -22, 26, 44);
    const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#b07a42'); g.addColorStop(1, '#5a3618');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(96, -13, 330, 26, 12); ctx.fill();
  });
}

// ============ S1 0–3.5 aerial night, crane down, lights on ============
const LAMPS = (() => { const r = rng(808), a = []; for (let i = 0; i < 70; i++) a.push([-180 + r() * 1460, 1240 + r() * 1300, r() * 2.4, r()]); return a; })();
function s1(ctx, lt, p, T) {
  const cy = lerp(1000, 1700, ease.inOut(p)), z = lerp(1.0, 1.12, ease.inOut(p));
  const lights = clamp((lt - 0.2) / 2.2);
  cam(ctx, 540, cy, z, 0, () => {
    Wd.drawAerialNight(ctx, lights);
    for (const [x, y, t0, k] of LAMPS) {
      const on = clamp((lt - t0) / 0.15); if (on <= 0) continue;
      const sc = 0.4 + (y - 1150) / 1500;
      glow(ctx, x, y, 70 * sc, k < 0.7 ? 'rgba(255,190,90,1)' : 'rgba(180,230,255,1)', 0.7 * on * (0.85 + 0.15 * Math.sin(T * 9 + k * 20)));
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const r = rng(77);
    for (let i = 0; i < 46; i++) {
      const y = 2480 + r() * 210, dir = r() < 0.5 ? 1 : -1, sp = 500 + r() * 500, len = 160 + r() * 260, off = r() * 1900, wd = 6 + r() * 6;
      const x = dir > 0 ? ((off + T * sp) % 1900) - 400 : 1500 - ((off + T * sp) % 1900);
      const g = ctx.createLinearGradient(x, y, x - dir * len, y);
      g.addColorStop(0, dir > 0 ? 'rgba(255,250,220,0.9)' : 'rgba(255,60,40,0.9)'); g.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.strokeStyle = g; ctx.lineWidth = wd; ctx.globalAlpha = lights;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - dir * len, y); ctx.stroke();
    }
    ctx.restore();
  });
  dust(ctx, T, 11, 30, 0, 0, W, H, '255,200,140', 2, 0.3);
  Tx.label(ctx, T, 0.8, 3.3, 'SÀI GÒN · 6:30 TỐI', 'Saigon · 6:30 PM', 1240);
  const fb = 1 - clamp(lt / 0.8);
  if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

// ============ S2 3.5–6.5 the stall, lateral dolly, bikes ============
function s2(ctx, lt, p, T) {
  cam(ctx, lerp(470, 610, ease.inOut(p)), 980, lerp(1.0, 1.05, p), 0, () => stall(ctx, T));
  bikes(ctx, T, [
    [4.2, 1910, 1.25, 1, { body: '#c0392b', helm: '#f1c40f', jacket: '#34495e' }],
    [5.6, 1720, 0.9, -1, { body: '#2e86de', helm: '#ecf0f1', jacket: '#7d5a3c' }],
  ]);
  dust(ctx, T, 5, 30, 0, 0, W, H, '255,220,170', 2.5, 0.45);
}

// ============ S3 6.5–9.5 tourist walks, belly growls, turns ============
function s3(ctx, lt, p, T) {
  P.layer(ctx, 8, (x) => cam(x, lerp(700, 660, p), 980, 1.5, 0, () => stall(x, T, { tables: false })));
  ctx.fillStyle = 'rgba(8,10,25,0.25)'; ctx.fillRect(0, 0, W, H);
  const gg = ctx.createLinearGradient(0, 1600, 0, H); gg.addColorStop(0, 'rgba(30,22,20,0)'); gg.addColorStop(0.3, 'rgba(30,22,20,0.9)'); gg.addColorStop(1, '#100c0a');
  ctx.fillStyle = gg; ctx.fillRect(0, 1600, W, 320);
  const wk = clamp(lt / 1.4), x = lerp(960, 520, ease.out(wk) * 0.5 + wk * 0.5);
  const fl = ease.inOut(clamp((lt - 1.85) / 0.3)), sx = Math.cos(Math.PI * fl);
  const by = 1700;
  ctx.save(); ctx.filter = 'blur(10px)'; ell(ctx, x, by, 180, 26); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(x, 0); ctx.scale(Math.abs(sx) < 0.03 ? 0.03 : sx, 1);
  Pp.tourist(ctx, 0, by, 2.0, { walk: lt < 1.4 ? lt * 7 : null, look: lt > 1.2 && lt < 1.85 ? 0.15 : 0, smile: lt > 2.1 ? 1 : 0 });
  ctx.restore();
  glow(ctx, x + 150, 1000, 420, 'rgba(255,170,80,0.8)', 0.22);
  const gk = lt - 1.0;
  if (gk > 0 && gk < 0.9) {
    ctx.save(); ctx.strokeStyle = '#ffe6b0'; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = gk - i * 0.12; if (k < 0) continue; const rr = 40 + k * 260;
      ctx.globalAlpha = Math.max(0, 1 - k / 0.75); ctx.lineWidth = 8 - i * 2;
      ctx.beginPath(); ctx.arc(x - 30, by - 500, rr, Math.PI * 0.75, Math.PI * 1.25); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - 30, by - 500, rr, -Math.PI * 0.25, Math.PI * 0.25); ctx.stroke();
    }
    ctx.restore();
  }
  const ek = lt - 2.05;
  if (ek > 0) {
    const sc = ease.outBack(clamp(ek / 0.3));
    ctx.save(); ctx.translate(x + 60, 730 + Math.sin(ek * 12) * 4); ctx.scale(sc, sc); ctx.rotate(0.12);
    ctx.font = '170px TitleSerif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 14; ctx.strokeStyle = '#2a1608'; ctx.strokeText('!', 0, 0); ctx.fillStyle = '#ffd84a'; ctx.fillText('!', 0, 0);
    ctx.restore();
  }
  Tx.line(ctx, T, 7.5, 9.4, 'Ọc ọc… đói quá!', 'Grrr… so hungry!', { y: 1450, vsize: 58 });
  dust(ctx, T, 8, 24, 0, 0, W, H, '255,210,150', 3, 0.35);
}

// ============ S4 9.5–12 Sau bastes lard on the cast-iron pan ============
function s4(ctx, lt, p, T) {
  darkBg(ctx, T, 41, { n: 18, a: 0.32 });
  cam(ctx, 540, 1050, lerp(1.0, 1.14, ease.inOut(p)), lerp(-0.04, 0.02, p), () => {
    glow(ctx, 540, 1250, 620, 'rgba(60,110,255,0.9)', 0.4);
    K.flame(ctx, 540, 1215, 470, 95, T, 1.3);
    const path = (tt) => [Math.sin(tt * 2.3) * 190, -150 + tt * 115];
    K.pan(ctx, 540, 1050, 1.7, 0.45, {
      oil: 0.4 + 0.5 * p, t: T,
      fill: (c, pt) => {
        c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = 'rgba(255,200,110,0.35)'; c.lineWidth = 60; c.beginPath();
        for (let tt = 0; tt <= lt; tt += 0.03) { const [u, v] = path(tt); const [px, py] = pt(u, v); c.lineTo(px, py); }
        c.stroke();
        c.strokeStyle = 'rgba(255,250,220,0.5)'; c.lineWidth = 6; c.stroke();
        c.restore();
        const m = clamp(lt / 2.3), [lx, ly] = pt(80, 60);
        ell(c, lx, ly, 60 + 90 * m, (60 + 90 * m) * 0.45); c.fillStyle = 'rgba(255,220,150,0.22)'; c.fill();
        if (m < 1) {
          const rr = 46 * (1 - m) + 4; ell(c, lx, ly - rr * 0.3, rr, rr * 0.6);
          const g = c.createRadialGradient(lx - rr * 0.3, ly - rr * 0.6, 2, lx, ly, rr); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e8dcc0');
          c.fillStyle = g; c.fill();
        }
        const r = rng(4);
        for (let i = 0; i < 30; i++) { const u = (r() - 0.5) * 420, v = (r() - 0.5) * 420, sp = 1 + r(), ph0 = r(); if (u * u + v * v > 200 * 200) continue; const ph = (T * sp + ph0) % 1; const [px, py] = pt(u, v); ell(c, px, py, 4 + ph * 4, (4 + ph * 4) * 0.45); c.strokeStyle = `rgba(255,230,180,${0.6 * (1 - ph)})`; c.lineWidth = 1.5; c.stroke(); }
      },
      over: (c, pt) => {
        const [u, v] = path(lt); const [px, py] = pt(u, v); const rot = -0.5 + Math.cos(lt * 2.3) * 0.25;
        brush(c, px, py - 6, 1.0, rot);
        // Sau's forearm holding the handle, coming from upper right
        const hx = px + Math.cos(rot) * 330, hy = py - 6 + Math.sin(rot) * 330;
        P.forearm(c, hx + 380, hy - 360, hx, hy, K.SAU[0], '#e9e4da', 70);
        P.hand(c, hx, hy, 0.9, rot + Math.PI, 'fist', [K.SAU[0], K.SAU[1]]);
      },
    });
  });
  steam(ctx, T, 9, 540, 900, 600, 500, 10, 0.18);
  glow(ctx, 880, 280, 300, 'rgba(255,190,100,0.9)', 0.35);
  Tx.line(ctx, T, 9.8, 11.8, 'Mỡ heo nóng già', 'Sizzling pork lard', { y: 1500, vsize: 56 });
}

// ============ S5 12–15 extreme low macro: cubes thrown in, title slam ============
const S5C = K.cubeLayout(55, 12, 230);
function s5(ctx, lt, p, T) {
  darkBg(ctx, T, 52, { n: 12, a: 0.35, top: '#24140a' });
  const [sx0, sy0] = shake(T, 10 * Math.max(0, 1 - lt / 0.6));
  glow(ctx, 870, 300, 700, 'rgba(255,170,80,0.9)', 0.45);
  cam(ctx, 540 + sx0, 1180 + sy0, lerp(1.05, 1.0, ease.out(p)), lerp(0.07, -0.02, ease.inOut(p)), () => {
    K.pan(ctx, 540, 1300, 3.0, 0.22, {
      oil: 1, t: T,
      over: (c, pt) => {
        for (const cb of S5C) {
          const land = cb.i * 0.025, k = clamp((lt + 0.25 - land) / 0.25);
          const [px, py] = pt(cb.u, cb.v);
          const yy = lerp(py - 900, py, ease.in(k));
          K.cube(c, px, yy, 0.95, cb.rot + (1 - k) * 2, { gold: 0.15 + 0.5 * clamp(lt / 3), glint: k >= 1 ? 0.4 * Math.max(0, Math.sin(T * 3 + cb.i)) : 0 });
          if (k >= 1) {
            const age = lt - land;
            for (let j = 0; j < 4; j++) { const ph = (age * 2.2 + j * 0.25 + cb.i * 0.13) % 1; ell(c, px - 50 + j * 30, py + 28, 6 + ph * 10, 3 + ph * 4); c.strokeStyle = `rgba(255,230,170,${0.7 * (1 - ph)})`; c.lineWidth = 2; c.stroke(); }
          }
        }
      },
    });
    flakes(ctx, lt, 0.0, 61, 60, 540, 1260, { g: 1500, speed: 1300, life: 1.0, colors: ['#ffe4a0', '#ffcf70', '#fff6d8'], spread: 2.6, size: 7, stagger: 0.4 });
    flakes(ctx, lt, 0.9, 62, 26, 380, 1260, { g: 1500, speed: 900, life: 0.9, colors: ['#ffe4a0', '#fff6d8'], spread: 2.0, size: 5, stagger: 1.8 });
  });
  steam(ctx, T, 13, 600, 1150, 900, 800, 14, 0.32 * clamp(lt / 0.5));
  flare(ctx, 880, 290, 1.0, 0.6 + 0.1 * Math.sin(T * 7));
  godRays(ctx, 880, 290, 2.1, 0.9, 1400, 9, 'rgba(255,200,130,0.5)', 0.35, T);
  Tx.title(ctx, T, 12.2, 14.8, 470);
}

// ============ S6 15–18 (1) mix the batter (top-down swirl) ============
function s6(ctx, lt, p, T) {
  cam(ctx, 540, 960, lerp(1.18, 1.0, ease.out(p)), lerp(-0.2, 0.35, p), () => {
    wood(ctx, -700, H + 700, 6);
    K.basin(ctx, 540, 960, 1.15, T, { level: lerp(0.55, 1, clamp(lt / 2)), spin: lt * 2.4, mound: Math.max(0, 1 - lt / 1.6), paddle: lt > 0.9 ? lt * 3.2 : undefined });
  });
  const fa = clamp(lt / 0.2) * clamp((1.2 - lt) / 0.2);
  if (fa > 0) {
    ctx.save(); ctx.globalAlpha = fa; ctx.filter = 'blur(3px)';
    const g = ctx.createLinearGradient(0, 0, 0, 960); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0.7)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(500, 0); ctx.lineTo(580, 0); ctx.lineTo(560 + Math.sin(T * 20) * 6, 960); ctx.lineTo(520, 960); ctx.closePath(); ctx.fill();
    ctx.restore();
    dust(ctx, T, 31, 60, 380, 760, 320, 360, '255,255,255', 4, 0.6 * fa);
  }
  const wa = clamp((lt - 1.1) / 0.2) * clamp((2.1 - lt) / 0.2);
  if (wa > 0) {
    ctx.save(); ctx.globalAlpha = wa; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(200,230,245,0.55)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(760, 0); ctx.quadraticCurveTo(700, 500, 640 + Math.sin(T * 30) * 4, 900); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
    glow(ctx, 640, 900, 90, 'rgba(255,255,255,1)', 0.5 * wa);
  }
  Tx.caption(ctx, T, 15.2, 17.8, 'Pha bột', 'Mix the rice flour', { n: 1 });
}

// ============ S7 18–21 (2) steam it ============
function s7(ctx, lt, p, T) {
  darkBg(ctx, T, 71, { n: 10, a: 0.22, top: '#140c08' });
  const lid = clamp((lt - 0.8) / 0.8);
  cam(ctx, 540, lerp(1200, 900, ease.inOut(p)), 1.0, 0, () => {
    godRays(ctx, 180, 300, 1.05, 0.7, 1600, 10, 'rgba(255,200,130,0.55)', 0.4 * (0.3 + lid), T);
    glow(ctx, 540, 1700, 500, 'rgba(60,110,255,0.9)', 0.35);
    K.flame(ctx, 540, 1720, 300, 60, T, 1.0);
    K.steamer(ctx, 540, 1700, 1.4, lid, T);
    steam(ctx, T, 21, 540, 1250, 420, 500, 6, 0.18 * (1 - lid));
    if (lid > 0) {
      steam(ctx, T, 22, 540, 1240, 700, 1200, 22, 0.5 * clamp(lid * 2));
      steam(ctx, T * 1.6, 23, 520, 1260, 500, 800, 10, 0.4 * Math.max(0, 1 - (lt - 0.8) / 1.2));
    }
  });
  glow(ctx, 180, 300, 340, 'rgba(255,200,120,0.9)', 0.45);
  Tx.caption(ctx, T, 18.2, 20.8, 'Hấp chín', 'Steam it', { n: 2 });
}

// ============ S8 21–24 (3) cut into cubes (chop on the beat) ============
const BEATS8 = [0.25, 0.75, 1.25, 1.75, 2.25];
function s8(ctx, lt, p, T) {
  let hitAmt = 0; for (const b of BEATS8) hitAmt = Math.max(hitAmt, bump(lt, b, 0.16));
  const [sx0, sy0] = shake(T, 9 * hitAmt);
  darkBg(ctx, T, 81, { n: 10, a: 0.25 });
  cam(ctx, 540 + sx0, 1040 + sy0, lerp(1.0, 1.1, p), 0.03, () => {
    F.board(ctx, 820, -160, 1400, 1200);
    const spread = ease.inOut(clamp((lt - 2.45) / 0.5));
    const cols = 6, rows = 4, cw = 118, rh = 90, bx = 540 - cols * cw / 2, by = 1060 - rows * rh / 2, depth = 60;
    const cuts = BEATS8.filter(b => lt >= b).length;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const sepX = (i - (cols - 1) / 2) * spread * 46, sepY = (j - (rows - 1) / 2) * spread * 46;
      const gap = i < cuts ? -5 * (cuts - i) : 0;
      const x = bx + i * cw + sepX + gap, y = by + j * rh + sepY;
      if (j === rows - 1 || spread > 0) { ctx.fillStyle = '#d4caae'; ctx.fillRect(x, y + rh - 3, cw - 3, depth * (j === rows - 1 ? 1 : spread)); }
      const g = ctx.createLinearGradient(x, y, x + cw, y + rh); g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#ebe3cf');
      ctx.fillStyle = g; ctx.fillRect(x, y, cw - 3, rh - 3);
      const r = rng(i * 7 + j); ctx.fillStyle = 'rgba(210,195,160,0.5)';
      for (let k = 0; k < 6; k++) { ell(ctx, x + 10 + r() * (cw - 20), y + 10 + r() * (rh - 20), 2.5, 2); ctx.fill(); }
    }
    const cur = BEATS8.findIndex(b => lt < b + 0.25), idx = cur < 0 ? 4 : cur, nb = BEATS8[idx];
    const cx = bx + (idx + 1) * cw - 1.5 - 5 * Math.max(0, cuts - idx - 1);
    const k = (lt - (nb - 0.25)) / 0.5;
    const lift = lt > 2.5 ? ease.out(clamp((lt - 2.5) / 0.4)) * 1000 : (k < 0.5 ? (1 - ease.in(clamp(k * 2))) * 260 : ease.out(clamp((k - 0.5) * 2)) * 260);
    F.cleaver(ctx, cx + 10, by + rh * rows + 10 - lift, 1.2, 0);
    if (hitAmt > 0.1) {
      glow(ctx, cx, by + rows * rh, 120, 'rgba(255,255,255,1)', 0.4 * hitAmt);
      flakes(ctx, lt, nb, 90 + idx, 10, cx, by + rows * rh - 20, { g: 1200, speed: 380, life: 0.5, colors: ['#ffffff', '#f4ecd8'], spread: 2.0, size: 5 });
    }
  });
  glow(ctx, 860, 260, 380, 'rgba(255,190,110,0.9)', 0.3);
  Tx.caption(ctx, T, 21.2, 23.8, 'Cắt miếng', 'Cut into cubes', { n: 3 });
}

// ============ S9 24–27 (4) fry in hot lard (slow-mo drop, golden crown) ============
const S9C = K.cubeLayout(99, 7, 200);
function s9(ctx, lt, p, T) {
  darkBg(ctx, T, 91, { n: 14, a: 0.3, top: '#22120a' });
  glow(ctx, 220, 260, 600, 'rgba(255,170,80,0.9)', 0.4);
  cam(ctx, lerp(640, 440, ease.inOut(p)), 1100, 1.0, 0, () => {
    K.flame(ctx, 540, 1430, 560, 90, T, 1.1);
    K.pan(ctx, 540, 1250, 2.2, 0.3, {
      oil: 1, t: T,
      over: (c, pt) => {
        for (const cb of S9C) {
          const land = 0.85 + cb.i * 0.09, k = clamp((lt - land + 0.9) / 0.9);
          const [px, py] = pt(cb.u, cb.v);
          const yy = lerp(py - 1150, py, ease.in(k));
          K.cube(c, px, yy, 0.9, cb.rot + (1 - k) * 1.4, { gold: 0.1 + 0.4 * clamp((lt - land) / 2) });
          const age = lt - land;
          if (age > 0 && age < 1.4) {
            const rr = 40 + age * 120; c.save(); c.globalAlpha = Math.max(0, 1 - age / 1.0);
            ell(c, px, py + 30, rr, rr * 0.3); c.strokeStyle = 'rgba(255,215,120,0.9)'; c.lineWidth = 6; c.stroke(); c.restore();
            flakes(c, age, 0, 300 + cb.i, 18, px, py + 20, { g: 600, speed: 380, life: 1.2, colors: ['#ffd27a', '#ffb84a', '#fff0c0'], slow: 0.45, spread: 1.6, size: 5 });
          }
        }
      },
    });
  });
  steam(ctx, T, 19, 540, 1100, 800, 700, 12, 0.25 * clamp((lt - 0.9) / 0.4));
  Tx.caption(ctx, T, 24.2, 26.8, 'Chiên bột', 'Fry in hot lard', { n: 4 });
}

// ============ S10 27–30.5 (5) golden & crispy (orbit, flip on beat) ============
const S10C = K.cubeLayout(101, 11, 215);
function s10(ctx, lt, p, T) {
  darkBg(ctx, T, 102, { n: 14, a: 0.3 });
  const ang = lt * 0.32;
  cam(ctx, 540, 1060, 1.05, lerp(0.06, -0.06, p), () => {
    glow(ctx, 540, 1240, 560, 'rgba(60,110,255,0.9)', 0.3);
    K.pan(ctx, 540, 1060, 1.6, 0.55, {
      oil: 0.8, t: T,
      over: (c, pt) => {
        const cs = S10C.map(cb => ({ ...cb, U: cb.u * Math.cos(ang) - cb.v * Math.sin(ang), V: cb.u * Math.sin(ang) + cb.v * Math.cos(ang) })).sort((a, b) => a.V - b.V);
        let spat = null;
        for (const cb of cs) {
          const ft = 0.15 + (cb.i % 7) * 0.5, fk = clamp((lt - ft) / 0.4);
          const [px, py] = pt(cb.U, cb.V);
          const flipping = fk > 0 && fk < 1 && cb.i < 7;
          const gold = cb.i < 7 ? (fk >= 0.5 ? 1 : 0.55) : 0.55 + 0.45 * p;
          if (flipping) {
            const hgt = Math.sin(Math.PI * fk) * 110, cy = Math.cos(Math.PI * fk);
            c.save(); c.translate(px, py - hgt); c.scale(1, Math.abs(cy) < 0.05 ? 0.05 : cy);
            K.cube(c, 0, 0, 0.95, cb.rot + fk * 0.6, { gold });
            c.restore();
            spat = [px, py, fk];
          } else K.cube(c, px, py, 0.95, cb.rot, { gold, glint: gold > 0.9 ? 0.5 * Math.max(0, Math.sin(T * 4 + cb.i)) : 0 });
        }
        if (spat) K.spatula(c, spat[0] + 70 - spat[2] * 30, spat[1] + 20 - Math.sin(Math.PI * spat[2]) * 50, 0.9, -0.3 - spat[2] * 0.5, 0.55);
      },
    });
  });
  steam(ctx, T, 29, 540, 1000, 700, 700, 10, 0.22);
  glow(ctx, 860, 260, 380, 'rgba(255,190,110,0.9)', 0.3);
  Tx.caption(ctx, T, 27.2, 30.3, 'Vàng giòn', 'Golden & crispy', { n: 5 });
}

module.exports = { LAMPS, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, stall, sauCook, darkBg, wood, bikes, brush, bump, shake };
