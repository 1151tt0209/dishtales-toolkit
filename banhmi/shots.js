// The 17 shots. Each: { start, end, draw(ctx, lt, p, T) } — lt local seconds, p 0..1, T global seconds.
const L = require('./lib');
const { W, H, BAR, TAU, C, rng, clamp, lerp, inv, ease, wobble, cam, at, buffer, motionBlurX } = L;

function bg(ctx, c0, c1, cx = W / 2, cy = H / 2) {
  const g = ctx.createRadialGradient(cx, cy, 50, cx, cy, W * 0.75);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function wood(ctx, x, y, w, h, seed, base = '#5a3519', dark = '#3a1f0c', vertical = false) {
  ctx.save();
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  const r = rng(seed);
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = r() > 0.5 ? dark : '#7a4a24';
    ctx.lineWidth = 1 + r() * 4;
    ctx.beginPath();
    const o = r() * (vertical ? w : h), amp = 4 + r() * 14, f = 0.002 + r() * 0.004, ph = r() * 9;
    for (let k = 0; k <= 60; k++) {
      const s = (k / 60) * (vertical ? h : w);
      const d = o + Math.sin(s * f + ph) * amp;
      if (vertical) ctx.lineTo(x + d, y + s); else ctx.lineTo(x + s, y + d);
    }
    ctx.stroke();
  }
  ctx.restore();
}
const shake = (T, hits, amt = 10, decay = 14) => {
  let dx = 0, dy = 0;
  for (const h of hits) {
    const a = T - h; if (a < 0 || a > 0.4) continue;
    const k = amt * Math.exp(-a * decay);
    dx += Math.sin(a * 90) * k; dy += Math.cos(a * 70) * k;
  }
  return [dx, dy];
};

// ---------------- ACT I ----------------
// S1 0–2: macro crust cracking in darkness
const cracks = (() => {
  const r = rng(101), out = [];
  const origins = [[760, 520, 0.3], [1180, 470, 0.9], [960, 600, 1.5]];
  for (const [ox, oy, t0] of origins) {
    const branches = [];
    for (let b = 0; b < 4; b++) {
      let x = ox, y = oy, a = r() * TAU;
      const pts = [[x, y]];
      for (let k = 0; k < 16; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 28; y += Math.sin(a) * 18; pts.push([x, y]); }
      branches.push(pts);
    }
    out.push({ t0, branches, ox, oy });
  }
  return out;
})();
const blisters = (() => {
  const r = rng(55), a = [];
  for (let i = 0; i < 420; i++) {
    const x = r() * 2200 - 140, y = 330 + r() * 800;
    if (((x - 960) / 1700) ** 2 + ((y - 1500) / 1180) ** 2 > 1) continue;
    a.push([x, y, 6 + r() * 26, r()]);
  }
  return a;
})();
function s1(ctx, lt, p, T) {
  ctx.fillStyle = '#060403'; ctx.fillRect(0, 0, W, H);
  const z = lerp(1.0, 1.22, ease.inOut(p));
  const [sx, sy] = shake(T, [0.3, 0.9, 1.5], 5, 18);
  cam(ctx, 960 - sx, 560 - sy, z, -0.04, () => {
    const g = ctx.createLinearGradient(0, 300, 0, 1100);
    g.addColorStop(0, '#f2b65c'); g.addColorStop(0.3, '#c8732a'); g.addColorStop(1, '#2e1505');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(960, 1500, 1700, 1180, 0, 0, TAU); ctx.fill();
    for (const [x, y, s, k] of blisters) {
      const gg = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, 1, x, y, s);
      gg.addColorStop(0, k > 0.5 ? 'rgba(255,225,160,0.55)' : 'rgba(255,210,140,0.35)');
      gg.addColorStop(1, 'rgba(120,50,10,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
    for (const c of cracks) {
      const k = ease.out(inv(c.t0, c.t0 + 0.3, lt));
      if (k <= 0) continue;
      for (const pts of c.branches) {
        const m = Math.max(2, Math.floor(pts.length * k));
        for (const [wd, col] of [[16, 'rgba(40,15,3,0.9)'], [5, 'rgba(255,236,190,0.95)']]) {
          ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); for (let i = 0; i < m; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
        }
      }
      L.glow(ctx, c.ox, c.oy, 160, 'rgba(255,190,90,0.8)', 0.6 * (1 - inv(c.t0, c.t0 + 0.6, lt)));
      L.flakes(ctx, lt, c.t0, 200 + c.t0 * 10, 18, c.ox, c.oy, { speed: 420, size: 9, life: 1 });
    }
  });
  const fl = 0.55 + 0.35 * wobble(lt * 6);
  L.glow(ctx, 150, 820, 1100, 'rgba(255,120,30,0.9)', fl * 0.55);
  L.dust(ctx, lt, 3, 40, 0, BAR, W, H - 2 * BAR, '255,170,90', 2.5, 0.6);
  ctx.fillStyle = `rgba(0,0,0,${1 - ease.out(inv(0, 0.7, lt))})`; ctx.fillRect(0, 0, W, H);
}

// S2 2–4: aerial Saigon dawn, crane down to an alley with a glowing cart
const city = (() => {
  const r = rng(202), layers = [];
  const specs = [{ y: 720, hmin: 50, hmax: 150, col: '#5a4552', win: 0.05 }, { y: 830, hmin: 90, hmax: 220, col: '#2e2232', win: 0.12 }, { y: 950, hmin: 130, hmax: 300, col: '#140e15', win: 0.2 }];
  for (const s of specs) {
    const b = []; let x = -400;
    while (x < 2400) {
      const w = 60 + r() * 140, h = s.hmin + r() * (s.hmax - s.hmin);
      const gapHere = s === specs[2] && x > 820 && x < 1000;
      if (!gapHere) b.push({ x, w, h, tank: r() > 0.6, ant: r() > 0.7, wins: Array.from({ length: 14 }, () => [r(), r(), r() < s.win]) });
      x += w + (gapHere ? 150 : r() * 8);
    }
    layers.push({ ...s, b });
  }
  return layers;
})();
function s2(ctx, lt, p, T) {
  const k = ease.inOut(p);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0d2633'); sky.addColorStop(0.35, '#3c4d63'); sky.addColorStop(0.58, '#d27a45'); sky.addColorStop(0.68, '#ffd18a'); sky.addColorStop(1, '#ffd18a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  cam(ctx, lerp(960, 920, k), lerp(520, 700, k), lerp(1.0, 1.45, k), 0, () => {
    L.glow(ctx, 1180, 600, 800, 'rgba(255,190,110,0.9)', 0.95);
    ctx.fillStyle = '#fff1c9'; ctx.beginPath(); ctx.arc(1180, 600, 66, 0, TAU); ctx.fill();
    city.forEach((layer, li) => {
      const par = li * 60 * k; // nearer layers rise as we crane down
      for (const b of layer.b) {
        const top = layer.y - b.h - par;
        ctx.fillStyle = layer.col; ctx.fillRect(b.x, top, b.w, 900);
        if (b.tank) { ctx.fillRect(b.x + b.w * 0.2, top - 26, 34, 26); ctx.beginPath(); ctx.ellipse(b.x + b.w * 0.2 + 17, top - 26, 17, 6, 0, 0, TAU); ctx.fill(); }
        if (b.ant) { ctx.strokeStyle = layer.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.7, top); ctx.lineTo(b.x + b.w * 0.7, top - 50); ctx.stroke(); }
        for (const [wx, wy, lit] of b.wins) if (lit) { ctx.fillStyle = 'rgba(255,200,110,0.85)'; ctx.fillRect(b.x + 8 + wx * (b.w - 24), top + 20 + wy * Math.min(b.h, 260), 10, 14); }
      }
      // mist band in front of each layer
      const mg = ctx.createLinearGradient(0, layer.y - 140 - par, 0, layer.y + 40 - par);
      mg.addColorStop(0, 'rgba(240,170,120,0)'); mg.addColorStop(1, `rgba(240,170,120,${0.32 - li * 0.08})`);
      ctx.fillStyle = mg; ctx.fillRect(-400, layer.y - 140 - par, 2800, 600);
    });
    // glowing cart deep in the alley gap
    const cy = 905 - 120 * k;
    L.glow(ctx, 910, cy, 160, 'rgba(255,170,70,1)', 0.9);
    ctx.fillStyle = '#ffd890'; ctx.fillRect(892, cy - 14, 36, 22);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(888, cy - 24, 44, 9);
  });
  // foreground power lines (fast parallax)
  ctx.strokeStyle = '#0b0709'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const y0 = 260 + i * 34 - 260 * k;
    ctx.beginPath(); ctx.moveTo(-50, y0); ctx.quadraticCurveTo(960, y0 + 120 + i * 10, 1980, y0 - 20); ctx.stroke();
  }
  // birds
  for (let i = 0; i < 5; i++) {
    const bx = 300 + i * 70 + lt * 140, by = 330 + Math.sin(i * 2) * 30 - k * 60, f = Math.sin(lt * 12 + i) * 8;
    ctx.strokeStyle = 'rgba(20,15,20,0.8)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(bx - 12, by - f); ctx.lineTo(bx, by); ctx.lineTo(bx + 12, by - f); ctx.stroke();
  }
  L.flare(ctx, lerp(1180, 1290, k), lerp(600, 410, k), 1.1, 0.7);
}

// S3 4–6: low angle, peel with baguettes slides out of a glowing oven; flour burst in god rays
const bricks = (() => { const r = rng(303), a = []; for (let row = 0; row < 26; row++) for (let c = 0; c < 22; c++) a.push([c * 96 - (row % 2) * 48, row * 44, r()]); return a; })();
function s3(ctx, lt, p, T) {
  ctx.fillStyle = '#140a06'; ctx.fillRect(0, 0, W, H);
  const fl = 0.8 + 0.2 * wobble(lt * 9, 2);
  const z = lerp(1.05, 1.15, ease.inOut(p));
  cam(ctx, 960, 540, z, 0, () => {
    for (const [x, y, v] of bricks) { ctx.fillStyle = `rgba(${90 + v * 40},${40 + v * 20},${25},0.5)`; ctx.fillRect(x, y, 90, 38); }
    L.glow(ctx, 960, 470, 900, 'rgba(255,120,40,0.8)', 0.6 * fl, 'source-over');
    // oven mouth
    ctx.save();
    ctx.beginPath(); ctx.moveTo(620, 640); ctx.lineTo(620, 470); ctx.arc(960, 470, 340, Math.PI, 0); ctx.lineTo(1300, 640); ctx.closePath();
    ctx.fillStyle = '#2a0f05'; ctx.fill(); ctx.clip();
    const og = ctx.createRadialGradient(960, 520, 20, 960, 520, 420);
    og.addColorStop(0, '#fff0b0'); og.addColorStop(0.35, '#ffad42'); og.addColorStop(0.8, '#a8360a'); og.addColorStop(1, '#3a1004');
    ctx.globalAlpha = fl; ctx.fillStyle = og; ctx.fillRect(600, 100, 720, 560); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) { // flame tongues
      const fx = 700 + i * 65, hgt = 120 + 60 * Math.abs(Math.sin(lt * 7 + i * 1.9));
      const g = ctx.createLinearGradient(0, 640, 0, 640 - hgt);
      g.addColorStop(0, 'rgba(255,140,30,0.7)'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(fx - 30, 640); ctx.quadraticCurveTo(fx + Math.sin(lt * 9 + i) * 25, 640 - hgt * 1.2, fx + 30, 640); ctx.fill();
    }
    ctx.restore();
    ctx.lineWidth = 26; ctx.strokeStyle = '#2b130a';
    ctx.beginPath(); ctx.moveTo(620, 640); ctx.lineTo(620, 470); ctx.arc(960, 470, 340, Math.PI, 0); ctx.lineTo(1300, 640); ctx.stroke();
    ctx.fillStyle = '#24100a'; ctx.fillRect(520, 640, 880, 50);
  });
  // peel + loaves come toward camera
  const k = ease.out(inv(0.1, 1.3, lt));
  const s = lerp(0.5, 1.3, k), py = lerp(600, 760, k);
  at(ctx, 960, py, lerp(0, -0.03, k), s, s, () => {
    ctx.fillStyle = '#6b4220'; ctx.fillRect(-40, 120, 80, 700); // handle toward camera
    ctx.beginPath(); ctx.roundRect(-560, -150, 1120, 300, 40);
    const g = ctx.createLinearGradient(0, -150, 0, 150); g.addColorStop(0, '#b07a45'); g.addColorStop(1, '#6e4520');
    ctx.fillStyle = g; ctx.fill();
    [[-90, 0.9], [-30, 0.95], [30, 1], [95, 1.05]].forEach(([oy, sc], i) => L.drawBaguette(ctx, (i % 2) * 20 - 10, oy, 960 * sc, 120 * sc, (i - 1.5) * 0.01));
    L.steam(ctx, lt, 31, 0, -120, 800, 380, 12, 0.35);
  });
  // flour burst as the peel leaves the oven
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  L.flakes(ctx, lt, 0.3, 333, 160, 960, 640, { speed: 520, g: -40, life: 1.8, spread: TAU, size: 4, colors: ['#fff6e0', '#ffe9c4', '#ffffff'], slow: 0.6 });
  ctx.restore();
  L.godRays(ctx, -100, 80, 0.55, 0.5, 2300, 7, 'rgba(255,200,130,0.55)', 0.5, lt);
  L.dust(ctx, lt, 33, 90, 0, BAR, W, H - 2 * BAR, '255,235,200', 3, 0.7);
  L.flare(ctx, 960, 420, 0.9, 0.5 * fl);
}

// S4 6–8: side profile, serrated knife slices the loaf; rack focus to steam
function knife(ctx, x, y, rot, s = 1) {
  at(ctx, x, y, rot, s, s, () => {
    // blade extends to +x from tip at origin
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(560, -30); ctx.lineTo(560, 40); ctx.lineTo(30, 46); ctx.quadraticCurveTo(-6, 30, 0, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, -30, 0, 46);
    g.addColorStop(0, '#f4f7fa'); g.addColorStop(0.45, '#aab3bd'); g.addColorStop(0.55, '#d9e0e6'); g.addColorStop(1, '#6f7a85');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#5d6a75';
    for (let i = 0; i < 26; i++) { const bx = 30 + i * 20; ctx.beginPath(); ctx.moveTo(bx, 46); ctx.lineTo(bx + 10, 56); ctx.lineTo(bx + 20, 46); ctx.fill(); }
    ctx.beginPath(); ctx.roundRect(560, -36, 300, 82, 20);
    const hg = ctx.createLinearGradient(0, -36, 0, 46); hg.addColorStop(0, '#5a3218'); hg.addColorStop(1, '#22100a');
    ctx.fillStyle = hg; ctx.fill();
    ctx.fillStyle = '#c9ced3'; for (const rx of [620, 720, 820]) { ctx.beginPath(); ctx.arc(rx, 5, 8, 0, TAU); ctx.fill(); }
  });
}
function s4(ctx, lt, p, T) {
  bg(ctx, '#3b2312', '#0b0604', 960, 420);
  L.bokeh(ctx, lt, 404, 14, ['rgba(255,180,90,1)', 'rgba(255,220,150,1)'], 0.25);
  const Lb = 1760, Tb = 330, bx = 960, by = 600;
  const kx = lerp(-Lb * 0.5, Lb * 0.36, ease.inOut(inv(0.15, 1.4, lt))) + Math.sin(lt * 55) * 22 * (lt < 1.4 ? 1 : 0);
  const focus = inv(1.2, 1.8, lt);
  ctx.save();
  ctx.filter = focus > 0 ? `blur(${(focus * 4).toFixed(1)}px)` : 'none';
  at(ctx, bx, by, -0.03, 1, 1, () => {
    L.drawBaguette(ctx, 0, 0, Lb, Tb, 0);
    // slit behind the knife
    const open = 1 + inv(1.4, 1.6, lt) * 1.2;
    const sy = -Tb * 0.06;
    ctx.beginPath(); ctx.moveTo(-Lb * 0.47, sy);
    for (let i = 0; i <= 40; i++) { const x = lerp(-Lb * 0.47, kx, i / 40); ctx.lineTo(x, sy - 6 * open * Math.sin((i / 40) * Math.PI) - 2); }
    for (let i = 40; i >= 0; i--) { const x = lerp(-Lb * 0.47, kx, i / 40); ctx.lineTo(x, sy + 9 * open * Math.sin((i / 40) * Math.PI) + 2); }
    ctx.closePath(); ctx.fillStyle = '#f7ecd2'; ctx.fill();
    ctx.strokeStyle = 'rgba(80,35,10,0.8)'; ctx.lineWidth = 3; ctx.stroke();
  });
  ctx.restore();
  if (lt < 1.45) knife(ctx, bx + kx, by - 20 + (kx * -0.03), -0.42, 1);
  else { const k = ease.out(inv(1.45, 1.8, lt)); knife(ctx, bx + Lb * 0.36 + k * 300, by - 20 - k * 260, -0.42 - k * 0.3, 1); }
  // flakes from the blade while sawing
  for (let i = 0; i < 18; i++) {
    const tb = 0.2 + i * 0.07;
    const kxb = lerp(-Lb * 0.5, Lb * 0.36, ease.inOut(inv(0.15, 1.4, tb)));
    L.flakes(ctx, lt, tb, 450 + i, 5, bx + kxb, by - 30, { speed: 380, size: 6, life: 0.9, spread: 1.6 });
  }
  L.flakes(ctx, lt, 1.4, 499, 40, bx + Lb * 0.36, by - 30, { speed: 650, size: 9, life: 1.2, spread: 2.2 });
  L.steam(ctx, lt, 41, bx, by - 40, 1300, 420, 16, 0.25 + 0.4 * focus);
}

// ---------------- ACT II ----------------
const TABLE = (ctx, seed) => { wood(ctx, 0, 0, W, H, seed, '#4e2d16', '#2f1909', true); bg2(ctx); };
function bg2(ctx) { const g = ctx.createRadialGradient(960, 520, 200, 960, 540, 1150); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.7)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

// S5 8–9.5: top-down open bread, butter-mayo swirl
function s5(ctx, lt, p, T) {
  TABLE(ctx, 505);
  const Lb = 1500, Tb = 230;
  at(ctx, 960, 520, 0.06 + p * 0.07, lerp(1.0, 1.1, ease.inOut(p)), undefined, () => {
    L.drawOpenTop(ctx, Lb, Tb);
    const k = ease.inOut(inv(0.05, 1.25, lt));
    const pts = [];
    for (let i = 0; i <= 120 * k; i++) { const x = lerp(-Lb * 0.4, Lb * 0.4, i / 120); pts.push([x, Tb * 0.5 + Math.sin(x * 0.018) * Tb * 0.16]); }
    if (pts.length > 1) {
      for (const [w, col, a] of [[70, '#e0a92e', 1], [52, C.butter, 1], [28, C.butterL, 1], [8, '#fffbe8', 0.9]]) {
        ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach(([x, y], i) => ctx.lineTo(x, y - (w === 8 ? 12 : 0))); ctx.stroke(); ctx.restore();
      }
      const [hx, hy] = pts[pts.length - 1];
      if (lt < 1.35) at(ctx, hx + 20, hy - 10, -0.6, 1, 1, () => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(20, 30, 70, 46, 0, 0, TAU); ctx.fill();
        const g = ctx.createRadialGradient(-20, -15, 5, 0, 0, 80); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#8c96a0');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 70, 46, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.roundRect(60, -12, 520, 24, 12); ctx.fill();
      });
    }
  });
  L.godRays(ctx, 1900, 100, 2.5, 0.6, 2000, 6, 'rgba(255,220,150,0.5)', 0.35, lt);
}

// S6 9.5–11: ECU tracking along the knife spreading pâté
const crumbPores = L.pores('ecu', 900, 4200, 1100, 606);
function s6(ctx, lt, p, T) {
  const off = lt * 520;
  const cg = ctx.createLinearGradient(0, 0, 0, H); cg.addColorStop(0, '#f4e3bf'); cg.addColorStop(1, '#dfc293');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  at(ctx, 2100 - off, 540 + Math.sin(lt * 1.5) * 10, 0, 1, 1, () => L.drawPores(ctx, crumbPores, 3));
  const kxS = 1080; // knife tip screen x
  const startS = 500 - off;
  // pâté band from start to knife
  ctx.save();
  ctx.beginPath();
  const n = 60;
  for (let i = 0; i <= n; i++) { const x = lerp(startS, kxS, i / n); ctx.lineTo(x, 430 + Math.sin((x + off) * 0.011) * 18 + Math.sin((x + off) * 0.05) * 5); }
  for (let i = n; i >= 0; i--) { const x = lerp(startS, kxS, i / n); ctx.lineTo(x, 660 + Math.sin((x + off) * 0.013 + 2) * 16 + Math.sin((x + off) * 0.06) * 5); }
  ctx.closePath();
  ctx.fillStyle = '#8f5a3a'; ctx.fill(); ctx.clip();
  // flat spread: mottled lumps + scattered glossy specular spots
  const lr = rng(611);
  for (let i = 0; i < 160; i++) {
    const wx = lr() * 4200 - off, wy = 420 + lr() * 260, rr = 10 + lr() * 34, dk = lr();
    if (wx < startS - 40 || wx > kxS + 40) { lr(); continue; }
    ctx.fillStyle = dk > 0.5 ? 'rgba(110,62,38,0.45)' : 'rgba(170,112,78,0.4)';
    ctx.beginPath(); ctx.ellipse(wx, wy, rr * 1.6, rr, 0, 0, TAU); ctx.fill();
    if (lr() > 0.55) { ctx.fillStyle = 'rgba(255,232,210,0.55)'; ctx.beginPath(); ctx.ellipse(wx - rr * 0.4, wy - rr * 0.3, rr * 0.5, rr * 0.18, -0.2, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(90,50,30,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  // creamy pile at the blade
  ctx.beginPath(); ctx.moveTo(kxS - 70, 430); ctx.bezierCurveTo(kxS + 20, 410, kxS + 50, 470, kxS + 30, 545); ctx.bezierCurveTo(kxS + 50, 630, kxS + 10, 680, kxS - 70, 662); ctx.closePath();
  const pp = ctx.createLinearGradient(kxS - 70, 0, kxS + 50, 0); pp.addColorStop(0, '#8f5a3a'); pp.addColorStop(1, '#a8714f');
  ctx.fillStyle = pp; ctx.fill();
  L.glow(ctx, kxS - 10, 500, 70, 'rgba(255,225,200,0.7)', 0.6);
  // butter knife, tip at band, handle top-right
  at(ctx, kxS + 20, 545 + Math.sin(lt * 4) * 6, -0.9, 1.2, 1.2, () => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.roundRect(30, 30, 640, 120, 60); ctx.fill();
    ctx.beginPath(); ctx.roundRect(0, -60, 600, 120, 60);
    const g = ctx.createLinearGradient(0, -60, 0, 60); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#a9b1ba'); g.addColorStop(1, '#5f6973');
    ctx.fillStyle = g; ctx.fill();
    const gx = ((lt * 0.9) % 1) * 600;
    const sg = ctx.createLinearGradient(gx - 80, 0, gx + 80, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(0, -60, 600, 120, 60); ctx.fill();
  });
  // depth-of-field edges
  const v = ctx.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(30,15,5,0.6)'); v.addColorStop(0.3, 'rgba(0,0,0,0)'); v.addColorStop(0.75, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,15,5,0.6)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// S7 11–12.5: three chả lụa slices orbiting & spinning, then dropping into the bread
function chaDisc(ctx, R, spin) {
  const sx = Math.max(0.1, Math.abs(Math.cos(spin)));
  ctx.save(); ctx.scale(sx, 1);
  ctx.beginPath(); ctx.arc(R * 0.07 * Math.sign(Math.cos(spin) || 1), 0, R, 0, TAU); ctx.fillStyle = C.chaRim; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#f7e2d2'); g.addColorStop(0.75, C.cha); g.addColorStop(1, C.chaD);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = R * 0.06; ctx.strokeStyle = C.chaRim; ctx.stroke();
  const r = rng(707);
  for (let i = 0; i < 40; i++) { const a = r() * TAU, d = r() * R * 0.85; ctx.fillStyle = 'rgba(190,150,120,0.35)'; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2 + r() * 4, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = R * 0.05; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, R * 0.8, -2.5, -1.7); ctx.stroke();
  ctx.restore();
}
function s7(ctx, lt, p, T) {
  bg(ctx, '#3a1d0c', '#080403', 960, 480);
  L.bokeh(ctx, lt, 707, 18, ['rgba(255,190,100,1)', 'rgba(255,140,60,1)'], 0.3);
  const drop = Math.max(0, lt - 1.0);
  // bread edge waiting at bottom
  at(ctx, 960, 1060 - ease.out(inv(0.6, 1.1, lt)) * 120, 0, 1.4, 1.4, () => L.drawSandwich(ctx, 1500, 260, { n: 1, top: false }));
  const discs = [0, 1, 2].map(i => {
    const a = i * TAU / 3 + lt * 1.6;
    return { i, a, d: Math.sin(a) };
  }).sort((a, b) => a.d - b.d);
  for (const { i, a, d } of discs) {
    const sc = 0.78 + 0.22 * (d + 1) / 2;
    const x = 960 + Math.cos(a) * 380 * (1 - inv(0.9, 1.3, lt) * 0.5);
    const y = 470 + d * 70 + drop * drop * 3200 + i * drop * 300;
    at(ctx, x, y, a * 0.3, sc, sc * (1 + drop * 1.5), () => {
      ctx.save(); ctx.filter = d < -0.3 ? 'blur(3px)' : 'none';
      chaDisc(ctx, 200, lt * 3.2 + i * 1.3);
      ctx.restore();
    });
  }
  L.dust(ctx, lt, 77, 50, 0, BAR, W, H - 2 * BAR, '255,220,170', 2.5, 0.5);
}

// S8 12.5–14: eye-level, ham slices layering with a speed ramp
function hamSlice(ctx, len, th, seed) {
  L.band(ctx, -len / 2, len / 2, 0, th, seed, 12, 0.02);
  L.fillGrad(ctx, 0, th, C.ham, C.hamD);
  L.band(ctx, -len / 2, len / 2, -th * 0.42, th * 0.18, seed, 12, 0.02); ctx.fillStyle = C.hamFat; ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,225,0.5)'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); const x = -len / 2 + (i + 0.5) * len / 6; ctx.moveTo(x, -th * 0.1); ctx.quadraticCurveTo(x + 30, th * 0.1, x + 10, th * 0.3); ctx.stroke(); }
}
function s8(ctx, lt, p, T) {
  bg(ctx, '#3c2414', '#0a0604', 960, 600);
  L.bokeh(ctx, lt, 808, 12, ['rgba(255,200,120,1)'], 0.22);
  const lands = [12.8, 13.1, 13.6], starts = [12.5, 12.85, 13.15];
  const [sx, sy] = shake(T, lands, 7, 16);
  const Tb = 300, Lb = 1500;
  cam(ctx, 960 - sx, 600 - sy, 1.5, 0, () => {
    at(ctx, 960, 720, 0, 1, 1, () => {
      L.drawSandwich(ctx, Lb, Tb, { n: 2, top: false });
      const stackTop = -Tb * 0.06 - 2 - Tb * 0.06 * 0.7 - Tb * 0.1 * 0.7 - Tb * 0.05;
      lands.forEach((tl, i) => {
        const k = inv(starts[i], tl, T);
        if (k <= 0) return;
        const fall = i === 2 ? ease.in2(k) : ease.in(k);
        const landY = stackTop - i * 16;
        let y = lerp(-700, landY, fall);
        if (T > tl) y += -Math.exp(-(T - tl) * 10) * Math.sin((T - tl) * 30) * 14;
        at(ctx, (i - 1) * 40, y, (1 - fall) * (i - 1) * 0.15, 1, 1, () => hamSlice(ctx, Lb * 0.9, 34, 3 + i));
        L.flakes(ctx, T, tl, 880 + i, 14, (i - 1) * 200, landY, { speed: 300, size: 5, life: 0.7, slow: i === 2 ? 0.4 : 1 });
      });
    });
  });
  L.godRays(ctx, 200, 0, 1.2, 0.5, 1600, 6, 'rgba(255,210,150,0.5)', 0.3, lt);
}

// S9 14–15.5: char siu chopped with a cleaver on a wooden board; dolly-in
function charSiuBlock(ctx, w, h) {
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.35);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#d1453a'); g.addColorStop(0.3, C.xsRed); g.addColorStop(1, C.xsDark);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(40,0,0,0.35)';
  const r = rng(909); for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(-w / 2 + r() * w, -h / 2 + r() * h * 0.3, 10 + r() * 30, 4 + r() * 6, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,180,0.6)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-w * 0.4, -h * 0.32); ctx.lineTo(w * 0.35, -h * 0.34); ctx.stroke(); ctx.restore();
}
function cutFace(ctx, h) {
  ctx.beginPath(); ctx.ellipse(0, 0, h * 0.22, h / 2, 0, 0, TAU);
  ctx.fillStyle = C.xsRed; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 4, h * 0.17, h * 0.42, 0, 0, TAU);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#f0a88a'); g.addColorStop(1, '#c76d55');
  ctx.fillStyle = g; ctx.fill();
}
function s9(ctx, lt, p, T) {
  ctx.fillStyle = '#120905'; ctx.fillRect(0, 0, W, H);
  const chops = [14.3, 14.8];
  const [sx, sy] = shake(T, chops, 12, 18);
  cam(ctx, 960 - sx, 560 - sy, lerp(1.0, 1.28, ease.inOut(p)), 0, () => {
    // board top in perspective
    ctx.save();
    ctx.beginPath(); ctx.moveTo(150, 600); ctx.lineTo(1770, 600); ctx.lineTo(1950, 1000); ctx.lineTo(-30, 1000); ctx.closePath(); ctx.clip();
    wood(ctx, -30, 600, 2000, 400, 919, '#8a5a30', '#5a3519');
    ctx.restore();
    ctx.fillStyle = '#4a2b14'; ctx.fillRect(-30, 1000, 2000, 60);
    const cutsDone = chops.filter(c => T >= c).length;
    const sliceW = 70, blockW = 760 - cutsDone * sliceW;
    const bx = 760 - (760 - blockW) / 2, by = 610;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(bx, by + 100, blockW / 2 + 20, 26, 0, 0, TAU); ctx.fill();
    at(ctx, bx, by, 0, 1, 1, () => charSiuBlock(ctx, blockW, 200));
    at(ctx, bx + blockW / 2, by, 0, 1, 1, () => cutFace(ctx, 196));
    // fallen slices
    chops.forEach((c, i) => {
      if (T < c) return;
      const k = ease.outBack(inv(c, c + 0.35, T));
      const x0 = 760 + 380 - (i) * sliceW - sliceW / 2;
      at(ctx, x0 + 60 + k * (90 + i * 40) + i * 150, by + k * 40, k * (1.0 + i * 0.1), 1, 1, () => {
        ctx.beginPath(); ctx.roundRect(-sliceW / 2, -100, sliceW, 200, 30); ctx.fillStyle = C.xsRed; ctx.fill();
        at(ctx, sliceW * 0.3, 0, 0, 1, 1, () => cutFace(ctx, 196));
      });
    });
    // glaze drips
    for (let i = 0; i < 4; i++) {
      const ph = ((lt * 0.9 + i * 0.27) % 1);
      const dx = bx - blockW / 2 + 100 + i * (blockW - 200) / 3, dy = by + 92 + ph * 120;
      ctx.fillStyle = C.xsDark;
      ctx.beginPath(); ctx.ellipse(dx, dy, 9, 14 + ph * 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,170,0.7)'; ctx.beginPath(); ctx.arc(dx - 3, dy - 5, 3, 0, TAU); ctx.fill();
    }
    // cleaver
    let cy = -380;
    for (const c of chops) {
      if (T >= c - 0.22 && T < c) cy = lerp(-380, -40, ease.in(inv(c - 0.22, c, T)));
      else if (T >= c && T < c + 0.25) cy = lerp(-40, -380, ease.out(inv(c + 0.08, c + 0.25, T)));
    }
    if (T < chops[0] - 0.22) cy = -380 + Math.sin(lt * 4) * 10;
    const cutX = 760 + 380 - cutsDone * sliceW - (T >= chops[0] && T < chops[0] + 0.1 ? sliceW : 0);
    at(ctx, cutX - (cy > -100 ? 0 : 20), by + cy, -0.05, 1, 1, () => {
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.roundRect(-40, -560, 80, 320, 30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-170, -260); ctx.lineTo(150, -260); ctx.lineTo(160, 120); ctx.lineTo(-170, 120); ctx.closePath();
      const g = ctx.createLinearGradient(-170, 0, 160, 0); g.addColorStop(0, '#5d6670'); g.addColorStop(0.5, '#e8edf2'); g.addColorStop(1, '#7c8690');
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#1f1f22'; ctx.beginPath(); ctx.arc(-110, -200, 20, 0, TAU); ctx.fill();
    });
    chops.forEach((c, i) => L.flakes(ctx, T, c, 990 + i, 22, cutX, by + 90, { speed: 420, size: 6, life: 0.8, colors: [C.xsRed, '#e8a080', '#7a3010'] }));
  });
  L.steam(ctx, lt, 91, 760, 600, 700, 400, 10, 0.3);
  L.glow(ctx, 1500, 200, 700, 'rgba(255,170,90,0.7)', 0.35);
}

// S10 15.5–17: ladle pours glossy char siu sauce into the sandwich
function s10(ctx, lt, p, T) {
  bg(ctx, '#2e1a0e', '#070403', 960, 500);
  L.bokeh(ctx, lt, 1010, 12, ['rgba(255,170,90,1)'], 0.25);
  at(ctx, 980, 860, 0, 1.55, 1.55, () => L.drawSandwich(ctx, 1500, 280, { n: 4, top: false }));
  const head = ease.in2(inv(0.05, 0.35, lt)), tail = ease.in2(inv(1.25, 1.5, lt));
  const lip = [740, 330], land = [990, 700];
  // pool spreading on fillings
  const pool = ease.out(inv(0.35, 1.3, lt));
  if (pool > 0) {
    ctx.beginPath(); ctx.ellipse(land[0], land[1] + 10, 60 + pool * 260, 18 + pool * 30, 0, 0, TAU);
    const g = ctx.createRadialGradient(land[0], land[1], 5, land[0], land[1], 300); g.addColorStop(0, '#7a2410'); g.addColorStop(1, '#4a1206');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,140,0.5)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const rr = ((lt * 1.5 + i / 3) % 1); ctx.globalAlpha = 1 - rr; ctx.beginPath(); ctx.ellipse(land[0], land[1] + 10, 40 + rr * 200 * pool, 10 + rr * 30 * pool, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const r = rng(1011);
    for (let i = 0; i < 14; i++) { const ph = (lt * 2 + r()) % 1; ctx.strokeStyle = `rgba(255,200,160,${0.6 * (1 - ph)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(land[0] + (r() - 0.5) * 400 * pool, land[1] + 10 + (r() - 0.5) * 40 * pool, 3 + ph * 6, 0, TAU); ctx.stroke(); }
  }
  // stream
  if (head > 0 && tail < 1) {
    const sw = Math.sin(lt * 9) * 14;
    const bez = t => { const c = [lip[0] + 160 + sw, lip[1] + 40]; const u = 1 - t; return [u * u * lip[0] + 2 * u * t * c[0] + t * t * land[0], u * u * lip[1] + 2 * u * t * c[1] + t * t * land[1]]; };
    const t0 = tail, t1 = head;
    for (const [w, col] of [[30, '#5a1a0c'], [22, '#8e2d12'], [6, 'rgba(255,190,140,0.75)']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = bez(lerp(t0, t1, i / 30)); ctx.lineTo(x + (w === 6 ? -6 : 0), y); } ctx.stroke();
    }
  }
  // ladle
  const tilt = lerp(-0.2, -0.75, ease.out(inv(0, 0.4, lt))) + inv(1.2, 1.5, lt) * 0.4;
  at(ctx, lip[0] - 80, lip[1] - 30, tilt, 1, 1, () => {
    ctx.strokeStyle = '#8d969f'; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-120, -20); ctx.lineTo(-640, -260); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 150, 90, 0, 0, Math.PI); const g = ctx.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, '#d8dee4'); g.addColorStop(1, '#5c6670');
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 150, 26, 0, 0, TAU); ctx.fillStyle = '#6a1d0b'; ctx.fill();
    ctx.strokeStyle = '#eef2f5'; ctx.lineWidth = 6; ctx.stroke();
  });
  L.steam(ctx, lt, 1012, 990, 700, 600, 450, 14, 0.4);
  L.glow(ctx, 300, 200, 800, 'rgba(255,160,80,0.7)', 0.3);
}

// S11 17–18.5: cucumber splits, juice spray; whip-pan out at the end
function cukeHalf(ctx, Lc, Tc, upper) {
  ctx.save();
  ctx.beginPath(); ctx.rect(-Lc, upper ? -Tc : 0, Lc * 2, Tc);
  ctx.clip();
  ctx.beginPath(); ctx.roundRect(-Lc / 2, -Tc / 2, Lc, Tc, Tc / 2);
  const g = ctx.createLinearGradient(0, -Tc / 2, 0, Tc / 2); g.addColorStop(0, '#5f9a3e'); g.addColorStop(0.5, C.cuke); g.addColorStop(1, '#173a14');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(150,200,110,0.35)'; ctx.lineWidth = 6;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-Lc * 0.45, -Tc * 0.35 + i * Tc * 0.17); ctx.lineTo(Lc * 0.45, -Tc * 0.35 + i * Tc * 0.17); ctx.stroke(); }
  const r = rng(1111); ctx.fillStyle = 'rgba(200,230,160,0.5)';
  for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc((r() - 0.5) * Lc * 0.9, (r() - 0.5) * Tc * 0.8, 2 + r() * 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function cukeFace(ctx, Lc, Tc) {
  ctx.beginPath(); ctx.roundRect(-Lc / 2 + 6, -Tc * 0.2, Lc - 12, Tc * 0.4, Tc * 0.2);
  const g = ctx.createLinearGradient(0, -Tc * 0.2, 0, Tc * 0.2); g.addColorStop(0, '#eefbd5'); g.addColorStop(1, '#bfe08f');
  ctx.fillStyle = g; ctx.fill();
  ctx.beginPath(); ctx.roundRect(-Lc * 0.44, -Tc * 0.08, Lc * 0.88, Tc * 0.16, Tc * 0.08); ctx.fillStyle = 'rgba(170,215,110,0.8)'; ctx.fill();
  ctx.fillStyle = '#f8fbe6';
  for (let i = 0; i < 22; i++) { ctx.beginPath(); ctx.ellipse(-Lc * 0.42 + i * Lc * 0.04, (i % 2 ? 1 : -1) * Tc * 0.03, 9, 5, (i % 2 ? 0.5 : -0.5), 0, TAU); ctx.fill(); }
}
function s11scene(ctx, lt, T) {
  bg(ctx, '#1d3a2a', '#04100a', 1100, 300);
  L.bokeh(ctx, lt, 1110, 16, ['rgba(200,255,170,1)', 'rgba(255,240,180,1)'], 0.3);
  L.glow(ctx, 1300, 180, 900, 'rgba(255,240,190,0.9)', 0.45);
  const k = ease.out(inv(0.3, 0.8, lt));
  const Lc = 1300, Tc = 220;
  at(ctx, 960, 560, -0.05 + lt * 0.02, 1, 1, () => {
    at(ctx, 0, k * 110, k * 0.06, 1, 1, () => { cukeHalf(ctx, Lc, Tc, false); if (k > 0) at(ctx, 0, 0, 0, 1, k, () => cukeFace(ctx, Lc, Tc)); });
    at(ctx, 0, -k * 110, -k * 0.06, 1, 1, () => { cukeHalf(ctx, Lc, Tc, true); });
  });
  // juice spray
  const r = rng(1120);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 70; i++) {
    const age = lt - 0.3 - r() * 0.08; const a = -Math.PI / 2 + (r() - 0.5) * 2.6 + (r() > 0.5 ? Math.PI : 0); const v = 300 + r() * 600; const x0 = 960 + (r() - 0.5) * 1100;
    if (age < 0) { r(); continue; }
    const x = x0 + Math.cos(a) * v * age, y = 560 + Math.sin(a) * v * age + 500 * age * age;
    const s = 3 + r() * 6;
    ctx.globalAlpha = Math.max(0, 1 - age * 0.9);
    ctx.fillStyle = 'rgba(220,255,220,0.9)'; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,1)'; ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.3, s * 0.35, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (lt > 0.3 && lt < 0.7) L.sparkle(ctx, 960, 560, 260, 1 - inv(0.3, 0.7, lt));
}
function s11(ctx, lt, p, T) {
  const w = ease.in(inv(1.1, 1.5, lt));
  motionBlurX(ctx, w * 500, w > 0 ? 8 : 1, x => { x.save(); x.translate(-w * 2200, 0); s11scene(x, lt, T); x.restore(); });
}

// S12 18.5–20.5: top-down, tongs drop pickled carrot & daikon; brine droplets burst
const shreds = (() => { const r = rng(1212), a = []; for (let i = 0; i < 150; i++) a.push({ bx: (r() - 0.5) * 120, by: (r() - 0.5) * 90, fx: (r() - 0.5) * 1150, fy: 115 + (r() - 0.5) * 140, a0: r() * TAU, a1: r() * TAU, l: 50 + r() * 70, w: 5 + r() * 4, c: r() > 0.45 ? C.carrot : C.daikon, d: r() * 0.25 }); return a; })();
function s12scene(ctx, lt, T) {
  TABLE(ctx, 1213);
  const Lb = 1450, Tb = 230;
  at(ctx, 960, 470, -0.04 - lt * 0.03, 1.08, 1.08, () => {
    L.drawOpenTop(ctx, Lb, Tb);
    L.topFillings(ctx, Lb, Tb);
    ctx.lineCap = 'round';
    for (const s of shreds) {
      const k = ease.out(inv(0.55 + s.d, 0.95 + s.d, lt));
      const x = lerp(s.bx, s.fx, k), y = lerp(-260 + s.by, s.fy, k), sc = lerp(1.6, 1, k);
      const a = lerp(s.a0, s.a1, k);
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w * sc;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * s.l * sc / 2, y - Math.sin(a) * s.l * sc / 2); ctx.lineTo(x + Math.cos(a) * s.l * sc / 2, y + Math.sin(a) * s.l * sc / 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * s.l * sc / 3, y - Math.sin(a) * s.l * sc / 3 - 2); ctx.lineTo(x + Math.cos(a) * s.l * sc / 3, y + Math.sin(a) * s.l * sc / 3 - 2); ctx.stroke();
    }
  });
  // tongs from top of frame
  const open = ease.out(inv(0.45, 0.7, lt)), lift = ease.in(inv(0.6, 1.2, lt));
  for (const sgn of [-1, 1]) {
    at(ctx, 960 + sgn * (20 + open * 70), 200 - lift * 500, sgn * (0.12 + open * 0.15), 1, 1, () => {
      ctx.fillStyle = '#b8c0c8'; ctx.beginPath(); ctx.roundRect(-18, -700, 36, 700, 14); ctx.fill();
      ctx.fillStyle = '#e9eef2'; ctx.fillRect(-6, -700, 6, 700);
    });
  }
  // brine droplets toward camera
  const r = rng(1230);
  for (let i = 0; i < 40; i++) {
    const age = lt - 0.7 - r() * 0.1; const a = r() * TAU, v = 200 + r() * 500;
    if (age < 0 || age > 1.3) { r(); continue; }
    const x = 960 + Math.cos(a) * v * age, y = 560 + Math.sin(a) * v * age * 0.7, s = (4 + r() * 8) * (1 + age * 2.5);
    ctx.save(); ctx.globalAlpha = 1 - age / 1.3;
    ctx.fillStyle = 'rgba(255,230,200,0.35)'; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    ctx.restore();
    L.sparkle(ctx, x - s * 0.3, y - s * 0.3, s * 1.6, 0.8 * (1 - age / 1.3));
  }
  L.godRays(ctx, 1900, 150, 2.6, 0.5, 2000, 6, 'rgba(255,220,160,0.5)', 0.3, lt);
}
function s12(ctx, lt, p, T) {
  const w = 1 - ease.out(inv(0, 0.3, lt));
  motionBlurX(ctx, w * 500, w > 0.02 ? 8 : 1, x => { x.save(); x.translate(w * 1800, 0); s12scene(x, lt, T); x.restore(); });
}

// S13 20.5–22: herbs tumbling, rack focus from foreground leaf to sandwich behind
function s13(ctx, lt, p, T) {
  const f = ease.inOut(inv(0.15, 1.15, lt));
  bg(ctx, '#2a1a0c', '#060403', 960, 560);
  ctx.save(); ctx.filter = `blur(${lerp(16, 0, f).toFixed(1)}px)`;
  at(ctx, 960, 720, 0, 1.25, 1.25, () => L.drawSandwich(ctx, 1500, 280, { n: 6, top: false }));
  L.bokeh(ctx, lt, 1313, 10, ['rgba(255,200,120,1)'], 0.25);
  ctx.restore();
  const r = rng(1314);
  const herbs = [];
  for (let i = 0; i < 12; i++) herbs.push({ x: 200 + r() * 1500, y0: -100 - r() * 300, sp: 300 + r() * 250, s: 40 + r() * 60, rot: r() * TAU, rs: (r() - 0.5) * 4, ring: r() > 0.65, z: r() });
  for (const h of herbs) {
    const y = h.y0 + h.sp * (lt + 0.6), x = h.x + Math.sin(lt * 2 + h.rot) * 40;
    ctx.save(); ctx.filter = `blur(${(Math.abs(h.z - 0.5) * 6 * (1 - f) + h.z * 3 * f).toFixed(1)}px)`;
    at(ctx, x, y, h.rot + lt * h.rs, Math.cos(lt * 3 + h.rot) * 0.6 + 0.4 > 0 ? 1 : -1, 1, () => {
      if (h.ring) { ctx.strokeStyle = '#7cc45a'; ctx.lineWidth = h.s * 0.18; ctx.beginPath(); ctx.ellipse(0, 0, h.s * 0.4, h.s * 0.4 * Math.abs(Math.cos(lt * 3 + h.rot)) + 3, 0, 0, TAU); ctx.stroke(); }
      else L.leaf(ctx, h.s);
    });
    ctx.restore();
  }
  // hero foreground leaf, sharp then blurred
  ctx.save(); ctx.filter = `blur(${lerp(0, 14, f).toFixed(1)}px)`;
  at(ctx, 470 + lt * 60, 440 + lt * 180, -0.4 + lt * 0.5, 1, 1, () => L.leaf(ctx, 230));
  ctx.restore();
  L.glow(ctx, 1600, 250, 800, 'rgba(255,220,150,0.7)', 0.3);
}

// S14 22–23.5: red chili rings spinning on dark, glints on the beat
function s14(ctx, lt, p, T) {
  bg(ctx, '#2a0606', '#050101', 960, 540);
  L.bokeh(ctx, lt, 1414, 14, ['rgba(255,60,40,1)', 'rgba(255,120,60,1)'], 0.25);
  const r = rng(1415);
  const glints = [22.2, 22.6, 23.0];
  for (let i = 0; i < 7; i++) {
    const x = 220 + i * 250 + (r() - 0.5) * 120, y0 = 260 + r() * 450, R = 70 + r() * 80, ph = r() * TAU;
    const y = y0 + lt * 120 + Math.sin(lt * 2 + ph) * 20;
    const spin = Math.cos(lt * 4 + ph);
    ctx.save(); ctx.filter = R < 95 ? 'blur(3px)' : 'none';
    at(ctx, x, y, lt * 0.8 + ph, 1, 1, () => L.chiliRing(ctx, R, spin));
    ctx.restore();
    const gi = i % 3;
    const ga = 1 - inv(0, 0.25, T - glints[gi]);
    if (T >= glints[gi] && ga > 0 && i < 3) L.sparkle(ctx, x - R * 0.5, y - R * 0.6, 180, ga);
  }
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  L.flakes(ctx, lt, 0.1, 1416, 60, 960, 540, { speed: 400, g: 120, life: 1.6, spread: TAU, size: 6, colors: [C.seed, '#ffe39a'], stagger: 0.5 });
  ctx.restore();
}

// S15 23.5–26: soy-sauce drop in a spotlight (A), then pepper rain (B)
function s15a(ctx, lt, T) {
  ctx.fillStyle = '#050302'; ctx.fillRect(0, 0, W, H);
  L.godRays(ctx, 960, -200, Math.PI / 2, 0.35, 1400, 5, 'rgba(255,220,170,0.6)', 0.35, lt);
  const land = 24.4;
  at(ctx, 960, 860, 0, 1.7, 1.7, () => L.drawSandwich(ctx, 1500, 280, { n: 7, top: false }));
  const surf = 745;
  // bottle top-left
  at(ctx, 760, 380, -2.2, 1, 1, () => {
    ctx.beginPath(); ctx.roundRect(-40, 0, 80, 140, 14); ctx.fillStyle = 'rgba(70,30,15,0.95)'; ctx.fill();
    ctx.beginPath(); ctx.roundRect(-110, 140, 220, 520, 40); ctx.fillStyle = 'rgba(60,25,12,0.95)'; ctx.fill();
    ctx.fillStyle = '#efe6cf'; ctx.fillRect(-110, 300, 220, 200); ctx.fillStyle = '#c0392b'; ctx.fillRect(-110, 340, 220, 40);
    ctx.strokeStyle = 'rgba(255,220,180,0.5)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-80, 180); ctx.lineTo(-80, 620); ctx.stroke();
  });
  const lipX = 770, lipY = 420;
  const tForm = 23.5, tDetach = 23.9;
  let dx = lipX, dy = lipY, stretch = 1, size = lerp(8, 20, inv(tForm, tDetach, T));
  if (T >= tDetach) { const k = inv(tDetach, land, T); dx = lerp(lipX, 960, ease.sine(k)); dy = lerp(lipY, surf, ease.in2(k)); stretch = 1 + k * 0.8; size = 20; }
  if (T < land) {
    at(ctx, dx, dy, 0, 1, 1, () => {
      ctx.beginPath(); ctx.moveTo(0, -size * 2.2 * stretch);
      ctx.bezierCurveTo(size * 0.6, -size, size * 1.05, size * 0.2, 0, size); ctx.bezierCurveTo(-size * 1.05, size * 0.2, -size * 0.6, -size, 0, -size * 2.2 * stretch);
      const g = ctx.createRadialGradient(-size * 0.3, -size * 0.2, 1, 0, 0, size * 1.4); g.addColorStop(0, '#8a4a20'); g.addColorStop(1, C.soy);
      ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = 'rgba(255,240,220,0.9)'; ctx.beginPath(); ctx.ellipse(-size * 0.35, -size * 0.1, size * 0.18, size * 0.3, -0.3, 0, TAU); ctx.fill();
    });
    L.glow(ctx, dx, dy, 60, 'rgba(255,200,150,0.5)', 0.5);
  } else {
    const a = T - land;
    for (let i = 0; i < 3; i++) { const rr = a * 400 - i * 40; if (rr <= 0) continue; ctx.strokeStyle = `rgba(255,210,170,${Math.max(0, 0.6 - a)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(960, surf + 8, rr, rr * 0.18, 0, 0, TAU); ctx.stroke(); }
    const r = rng(1515);
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * TAU, v = 160 + r() * 80, up = 520 + r() * 260;
      const x = 960 + Math.cos(ang) * v * a, y = surf + Math.sin(ang) * v * a * 0.2 - up * a + 1300 * a * a;
      if (y > surf + 20) continue;
      ctx.fillStyle = C.soy; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,200,0.8)'; ctx.beginPath(); ctx.arc(x - 2, y - 2, 2.5, 0, TAU); ctx.fill();
    }
    const cr = ease.out(inv(0, 0.2, a)) * (1 - inv(0.2, 0.4, a));
    if (cr > 0) { ctx.fillStyle = C.soy; ctx.beginPath(); ctx.ellipse(960, surf - 20 * cr, 30 * cr, 50 * cr, 0, 0, TAU); ctx.fill(); }
  }
}
function s15b(ctx, lt, T) {
  const k = T - 24.8;
  bg(ctx, '#2a170c', '#060302', 960, 500);
  cam(ctx, 960, 560, lerp(1.0, 1.12, k / 1.2), 0, () => {
    at(ctx, 960, 860, 0, 1.45, 1.45, () => L.drawSandwich(ctx, 1500, 280, { n: 8, top: false }));
    // pepper mill
    at(ctx, 960, 300, 0, 1, 1, () => {
      ctx.beginPath(); ctx.moveTo(-90, -400); ctx.lineTo(90, -400); ctx.lineTo(110, 100); ctx.quadraticCurveTo(0, 150, -110, 100); ctx.closePath();
      const g = ctx.createLinearGradient(-110, 0, 110, 0); g.addColorStop(0, '#2e180b'); g.addColorStop(0.4, '#8a5a32'); g.addColorStop(1, '#24120a');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 10;
      for (let i = 0; i < 6; i++) { const x = ((i * 50 + k * 300) % 300) - 150; ctx.beginPath(); ctx.moveTo(x, -400); ctx.lineTo(x, 160); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#9aa3ab'; ctx.beginPath(); ctx.ellipse(0, 125, 40, 14, 0, 0, TAU); ctx.fill();
    });
    // pepper rain through a light beam
    const r = rng(1520);
    for (let i = 0; i < 260; i++) {
      const born = r() * 1.2, vx = (r() - 0.5) * 160, s = 2 + r() * 4;
      const a = k - born; if (a < 0) { r(); continue; }
      const x = 960 + vx * a + (r() - 0.5) * 30, y = 430 + 260 * a + 420 * a * a;
      if (y > 780) continue;
      const inBeam = Math.abs((x - 960) - (y - 500) * 0.5) < 120;
      ctx.fillStyle = inBeam ? 'rgba(255,230,190,0.95)' : '#1a1009';
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
    }
  });
  L.godRays(ctx, 600, -250, 1.12, 0.12, 1700, 4, 'rgba(255,215,150,0.7)', 0.45, k);
  L.dust(ctx, k, 1521, 40, 0, BAR, W, H - 2 * BAR, '255,220,170', 2, 0.5);
}
function s15(ctx, lt, p, T) { if (T < 24.8) s15a(ctx, lt, T); else s15b(ctx, lt, T); }

// ---------------- ACT III ----------------
// S16 26–28: wrap in paper, pull back & crane up to reveal the Saigon alley cart; scooters pass
function paper(ctx, Lp, Tp, k) {
  const h = Tp * 0.75 * k;
  ctx.beginPath();
  ctx.moveTo(-Lp * 0.42, Tp * 0.48); ctx.lineTo(Lp * 0.42, Tp * 0.48);
  ctx.lineTo(Lp * 0.44, Tp * 0.48 - h); ctx.lineTo(Lp * 0.1, Tp * 0.48 - h * 1.08); ctx.lineTo(-Lp * 0.2, Tp * 0.48 - h * 0.95); ctx.lineTo(-Lp * 0.44, Tp * 0.48 - h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, Tp * 0.48 - h, 0, Tp * 0.48); g.addColorStop(0, '#f6efdf'); g.addColorStop(1, '#d9ccb0');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(80,70,60,0.22)';
  for (let i = 0; i < 9; i++) for (let j = 0; j < 7; j++) ctx.fillRect(-Lp * 0.4 + j * Lp * 0.12, Tp * 0.42 - i * Tp * 0.08, Lp * 0.1 * (0.6 + ((i * 7 + j) % 4) * 0.1), Tp * 0.02);
  ctx.strokeStyle = 'rgba(150,130,100,0.45)'; ctx.lineWidth = 3;
  for (const fx of [-0.15, 0.2]) { ctx.beginPath(); ctx.moveTo(Lp * fx, Tp * 0.48); ctx.lineTo(Lp * fx + 20, Tp * 0.48 - h); ctx.stroke(); }
  ctx.restore();
}
function alley(ctx, lt) {
  const sky = ctx.createLinearGradient(0, 0, 0, 700); sky.addColorStop(0, '#f3b46d'); sky.addColorStop(1, '#ffe3a8');
  ctx.fillStyle = sky; ctx.fillRect(-2000, -1500, 6000, 3500);
  const vx = 960, vy = 480;
  // road
  ctx.fillStyle = '#3b2f2a'; ctx.beginPath(); ctx.moveTo(vx - 40, vy); ctx.lineTo(vx + 40, vy); ctx.lineTo(3000, 2200); ctx.lineTo(-1100, 2200); ctx.closePath(); ctx.fill();
  const rg = ctx.createLinearGradient(0, vy, 0, 1100); rg.addColorStop(0, 'rgba(255,210,150,0.6)'); rg.addColorStop(1, 'rgba(255,210,150,0)');
  ctx.fillStyle = rg; ctx.fill();
  // facades
  for (const side of [-1, 1]) {
    const r = rng(side > 0 ? 1601 : 1602);
    for (let i = 0; i < 9; i++) {
      const d0 = Math.pow(0.78, i), d1 = Math.pow(0.78, i + 1);
      const xa = vx + side * (60 + 1700 * d0), xb = vx + side * (60 + 1700 * d1);
      const ta = vy - 1300 * d0 - 40, tb = vy - 1300 * d1 - 40, ba = vy + 760 * d0, bb = vy + 760 * d1;
      const tone = 40 + r() * 50;
      ctx.fillStyle = `rgb(${tone + 70},${tone + 40},${tone + 20})`;
      ctx.beginPath(); ctx.moveTo(xa, ta); ctx.lineTo(xb, tb); ctx.lineTo(xb, bb); ctx.lineTo(xa, ba); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,20,10,0.4)'; ctx.lineWidth = 3 * d0; ctx.stroke();
      // windows & balconies
      for (let fl = 0; fl < 4; fl++) {
        const t = 0.15 + fl * 0.2;
        const ya = lerp(ta, ba, t), yb = lerp(tb, bb, t);
        ctx.fillStyle = r() > 0.6 ? 'rgba(255,200,110,0.9)' : 'rgba(40,25,20,0.7)';
        const xm = lerp(xa, xb, 0.3), xn = lerp(xa, xb, 0.7);
        ctx.beginPath(); ctx.moveTo(xm, lerp(ya, yb, 0.3)); ctx.lineTo(xn, lerp(ya, yb, 0.7)); ctx.lineTo(xn, lerp(ya, yb, 0.7) + 90 * lerp(d0, d1, 0.7)); ctx.lineTo(xm, lerp(ya, yb, 0.3) + 90 * lerp(d0, d1, 0.3)); ctx.closePath(); ctx.fill();
      }
      // shop sign
      const sc = ['#c0392b', '#2a7f62', '#d4a017', '#2c5d9e'][Math.floor(r() * 4)];
      ctx.fillStyle = sc; const ys = lerp(ta, ba, 0.82), ys2 = lerp(tb, bb, 0.82);
      ctx.beginPath(); ctx.moveTo(xa, ys); ctx.lineTo(xb, ys2); ctx.lineTo(xb, ys2 + 70 * d1); ctx.lineTo(xa, ys + 70 * d0); ctx.closePath(); ctx.fill();
    }
  }
  // power lines & lanterns
  ctx.strokeStyle = 'rgba(30,20,20,0.85)'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const y = 80 + i * 40; ctx.beginPath(); ctx.moveTo(-200, y); ctx.quadraticCurveTo(960, y + 150 - i * 15, 2120, y + 10); ctx.stroke(); }
  for (let i = 0; i < 7; i++) {
    const x = 300 + i * 220, y = 200 + Math.sin((x - 960) / 1200 * Math.PI + Math.PI / 2) * 100 + Math.sin(lt * 2 + i) * 6;
    ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x, y); ctx.stroke();
    L.glow(ctx, x, y + 26, 90, 'rgba(255,120,60,0.9)', 0.6);
    ctx.fillStyle = '#d42d1f'; ctx.beginPath(); ctx.ellipse(x, y + 26, 22, 28, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f4c542'; ctx.fillRect(x - 12, y - 4, 24, 5); ctx.fillRect(x - 12, y + 52, 24, 5);
  }
  // cart
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(960, 820, 330, 30, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a6f97'; ctx.fillRect(660, 660, 600, 150);
  ctx.fillStyle = '#1d4e6b'; ctx.fillRect(660, 790, 600, 20);
  for (const wx of [720, 1200]) { ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(wx, 815, 32, 0, TAU); ctx.fill(); ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(wx, 815, 10, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#d9c9a8'; ctx.fillRect(650, 640, 620, 22); // counter
  ctx.fillStyle = 'rgba(255,240,200,0.25)'; ctx.fillRect(700, 470, 520, 170);
  ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 8; ctx.strokeRect(700, 470, 520, 170);
  L.glow(ctx, 960, 560, 300, 'rgba(255,200,110,0.9)', 0.6);
  for (let i = 0; i < 5; i++) L.drawBaguette(ctx, 790 + i * 85, 590 - (i % 2) * 18, 150, 30, -0.3);
  ctx.fillStyle = '#f4c542'; ctx.fillRect(680, 400, 560, 70);
  ctx.fillStyle = '#c0392b'; ctx.font = 'bold 50px BodySansBold'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BÁNH MÌ', 960, 437);
}
function scooter(ctx, x, y, s, col) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = '#0d0a0a';
    ctx.beginPath(); ctx.arc(-180, 120, 70, 0, TAU); ctx.arc(200, 120, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-260, 60); ctx.quadraticCurveTo(-200, -40, -40, -20); ctx.lineTo(150, -10); ctx.lineTo(230, -150); ctx.lineTo(270, -140); ctx.lineTo(240, 80); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#151012'; ctx.beginPath(); ctx.ellipse(-60, -150, 70, 120, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-40, -310, 55, 0, TAU); ctx.fill();
  });
  L.glow(ctx, x + 280 * s, y - 100 * s, 260 * s, 'rgba(255,250,220,1)', 0.8);
}
function s16(ctx, lt, p, T) {
  const wrap = ease.out(inv(0.05, 0.6, lt));
  const zk = ease.inOut(inv(0.55, 1.75, lt));
  const zoom = lerp(6.2, 1.0, 1 - Math.pow(1 - zk, 2));
  const cy = lerp(620, 540, zk);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  cam(ctx, 960, cy, zoom, 0, () => {
    alley(ctx, lt);
    at(ctx, 960, 618, 0, 0.18, 0.18, () => { L.drawSandwich(ctx, 1500, 300, { n: 8, gap: 10 }); paper(ctx, 1500, 300, wrap); });
  });
  L.flare(ctx, 960, 300 - zk * 200, 1.0, 0.25 + zk * 0.45);
  const hz = ctx.createLinearGradient(0, 0, 0, H); hz.addColorStop(0, 'rgba(255,190,120,0.25)'); hz.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H); ctx.restore();
  L.dust(ctx, lt, 1616, 50, 0, BAR, W, H - 2 * BAR, '255,230,180', 2.5, 0.6);
  // foreground scooter whoosh
  const sk = inv(1.0, 1.9, lt);
  if (sk > 0 && sk < 1) {
    const sx = lerp(-700, 2600, sk);
    ctx.save(); ctx.filter = 'blur(10px)';
    for (let i = 0; i < 5; i++) { ctx.globalAlpha = 1 / (i + 1); scooter(ctx, sx - i * 60, 860, 1.25, '#8e1f1f'); }
    ctx.restore();
  }
}

// S17 28–30: the bite, crumbs explode toward camera, freeze, title
function s17(ctx, lt, p, T) {
  bg(ctx, '#3a2414', '#090504', 960, 520);
  L.bokeh(ctx, lt, 1717, 22, ['rgba(255,170,80,1)', 'rgba(255,90,50,1)', 'rgba(255,220,150,1)'], 0.4, 30, 110);
  const bite = 0.5;
  const push = ease.out(inv(0, 0.5, lt));
  const dim = ease.inOut(inv(1.0, 1.5, lt));
  const s = (lerp(0.95, 1.12, push) + lt * 0.02) * (1 - dim * 0.18);
  const sy = 650 + dim * 200;
  const [c, x] = L.buffer('sand');
  at(x, 0, 0, 0, 1, 1, () => {
    x.translate(980, sy); x.rotate(-0.16); x.scale(s, s);
    L.drawSandwich(x, 1500, 300, { n: 8, gap: 12 });
    paper(x, 1500, 300, 0.55);
    if (lt >= bite) {
      x.globalCompositeOperation = 'destination-out';
      for (const [bx, by, br] of [[690, -60, 110], [720, 30, 120], [700, 120, 100]]) { x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill(); }
    }
  });
  ctx.drawImage(c, 0, 0);
  // crumbs exploding toward camera, slowing to a freeze
  if (lt >= bite) {
    const a = ease.outExpo(inv(bite, bite + 0.9, lt)) * 0.9 + (lt - bite) * 0.03;
    const r = rng(1718);
    const ox = 980 + Math.cos(-0.16) * 640 * s, oy = sy + Math.sin(-0.16) * 640 * s;
    for (let i = 0; i < 110; i++) {
      const ang = r() * TAU, v = 200 + r() * 900, sz = (4 + r() * 12) * (1 + a * r() * 2.5), rot = r() * TAU + a * 4;
      const px = ox + Math.cos(ang) * v * a, py = oy + Math.sin(ang) * v * a * 0.8;
      ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
      ctx.filter = sz > 30 ? 'blur(3px)' : 'none';
      ctx.fillStyle = [C.crustL, C.crustM, C.crustHi, C.crustL, '#b5651d', C.crumbD][i % 6];
      ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.5); ctx.lineTo(sz * 0.8, -sz * 0.7); ctx.lineTo(sz, sz * 0.4); ctx.lineTo(-sz * 0.4, sz * 0.7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    L.glow(ctx, ox, oy, 400, 'rgba(255,220,150,0.8)', 0.5 * (1 - inv(bite, bite + 0.6, lt)));
  }
  // title
  if (dim > 0) {
    const dg = ctx.createLinearGradient(0, BAR, 0, H - BAR); dg.addColorStop(0, `rgba(8,4,2,${0.8 * dim})`); dg.addColorStop(0.55, `rgba(8,4,2,${0.45 * dim})`); dg.addColorStop(1, `rgba(8,4,2,${0.15 * dim})`);
    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    const ta = ease.out(inv(1.05, 1.6, lt));
    ctx.save();
    ctx.globalAlpha = ta;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = global.VERTICAL ? '96px TitleSerif' : '128px TitleSerif';
    ctx.letterSpacing = `${lerp(40, 14, ta).toFixed(1)}px`;
    const tg = ctx.createLinearGradient(0, 300, 0, 420); tg.addColorStop(0, '#fff2c6'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#b8781e');
    ctx.shadowColor = 'rgba(255,170,60,0.6)'; ctx.shadowBlur = 40;
    ctx.fillStyle = tg; ctx.fillText('BÁNH MÌ VIỆT NAM', 960, 360);
    ctx.shadowBlur = 0;
    ctx.font = '40px BodySans'; ctx.letterSpacing = '12px'; ctx.fillStyle = 'rgba(255,240,215,0.92)';
    ctx.fillText('Giòn từ vỏ · Đậm từ tâm', 960, 465);
    ctx.strokeStyle = 'rgba(242,194,90,0.8)'; ctx.lineWidth = 2;
    const lw = 160 * ta;
    ctx.beginPath(); ctx.moveTo(960 - 330 - lw, 465); ctx.lineTo(960 - 330, 465); ctx.moveTo(960 + 330, 465); ctx.lineTo(960 + 330 + lw, 465); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = `rgba(0,0,0,${ease.in(inv(1.7, 2.0, lt))})`; ctx.fillRect(0, 0, W, H);
}

const SHOTS = [
  [0, 2, s1], [2, 4, s2], [4, 6, s3], [6, 8, s4],
  [8, 9.5, s5], [9.5, 11, s6], [11, 12.5, s7], [12.5, 14, s8], [14, 15.5, s9], [15.5, 17, s10],
  [17, 18.5, s11], [18.5, 20.5, s12], [20.5, 22, s13], [22, 23.5, s14], [23.5, 26, s15],
  [26, 28, s16], [28, 30, s17],
].map(([start, end, draw], i) => ({ id: i + 1, start, end, draw }));

module.exports = { SHOTS };
