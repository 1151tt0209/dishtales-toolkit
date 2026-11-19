// Shots 10–17: fill & cover, the drip, hero pour over ice, the first sip, "phê", coffee-drunk, ending.
const L = require('./lib');
const P = require('./props');
const Wd = require('./world');
const Pp = require('./people');
const Tx = require('./text');
const A = require('./shotsA');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, godRays, dust, bokeh, steam, buffer } = L;
const { ell } = P;
const { pour, bump, cafeBokeh, tableTop, darkBg, UNCLE_SKIN, TOUR_SKIN } = A;

// ============ S10 22–24 Fill & cover (orbit) ============
function s10(ctx, lt, p, T) {
  const orb = ease.inOut(p);
  cafeBokeh(ctx, T, lerp(160, -160, orb));
  glow(ctx, lerp(200, 800, orb), 380, 700, 'rgba(255,200,130,0.6)', 0.65);
  cam(ctx, 540, 1000, lerp(1.0, 1.08, orb), lerp(-0.03, 0.03, orb), () => {
    tableTop(ctx, 1500);
    const gs = 2.0, gy = 1700;
    P.glass(ctx, 540, gy, gs, { level: 0.06, drops: 0 });
    const [, gt] = P.glassTop(540, gy, gs);
    const level = lerp(0.42, 0.95, ease.out(clamp((lt - 0.2) / 1.0)));
    const lidT = clamp((lt - 1.25) / 0.25), lidLift = lt < 1.25 ? null : 180 * (1 - ease.outBack(lidT));
    P.phin(ctx, 540, gt - 4, gs, { k: 0.32, fill: { level, kind: 'water', t: T }, lid: lidLift === null ? null : Math.max(0, lidLift) });
    // orbiting specular band
    const [, ty] = P.phinTop(540, gt - 4, gs, 0.32);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.55;
    const bx = lerp(380, 700, orb), sg = ctx.createLinearGradient(bx - 30, 0, bx + 30, 0);
    sg.addColorStop(0, 'rgba(255,240,215,0)'); sg.addColorStop(0.5, 'rgba(255,240,215,0.85)'); sg.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.fillStyle = sg; ctx.fillRect(bx - 30, ty + 10, 60, gt - ty - 10); ctx.restore();
    const on = clamp((lt - 0.2) / 0.12) * clamp((1.2 - lt) / 0.15);
    if (on > 0) pour(ctx, 960, 560, 560, ty + 20, 14, 'water', T, on);
    if (lt > 1.45 && lt < 1.9) L.sparkle(ctx, 360, ty - 20, 90, 1 - (lt - 1.45) / 0.45);
    // first drip under the phin
    const [dx, dy] = P.phinBottom(540, gt - 4, gs, 0.32);
    const dk = (lt * 1.3) % 1; ell(ctx, dx, dy + dk * 120, 5, 7); ctx.fillStyle = '#2a1208'; ctx.fill();
    steam(ctx, T, 81, 540, ty, 240, 600, 10, lidLift === null ? 0.4 : 0.25);
  });
  Tx.caption(ctx, T, 22.1, 23.9, 'Rót đầy, đậy nắp', 'Fill & cover', { n: 7 });
}

// ============ S11 24–28 The drip (macro), then time-lapse ============
function dripMacro(ctx, lt, T) {
  // backlit amber background
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1608'); g.addColorStop(0.55, '#7a4a20'); g.addColorStop(1, '#1a0a04');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  glow(ctx, 540, 900, 700, 'rgba(255,170,80,0.55)', 0.8);
  bokeh(ctx, T, 92, 10, ['rgba(255,190,110,0.9)', 'rgba(255,230,170,0.8)'], 0.25, 40, 140);
  // underside of the phin plate
  const pg = ctx.createLinearGradient(0, 260, 0, 470); pg.addColorStop(0, '#2a2a2c'); pg.addColorStop(0.7, '#8d9094'); pg.addColorStop(1, '#3a3b3e');
  ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(-50, 250); ctx.lineTo(1130, 250); ctx.lineTo(1130, 430); ctx.quadraticCurveTo(540, 470, -50, 430); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3c3e41'; ctx.beginPath(); ctx.ellipse(540, 445, 330, 42, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = 'rgba(20,12,8,0.9)';
  for (let i = -6; i <= 6; i++) { ell(ctx, 540 + i * 40, 470 + Math.abs(i) * -2, 6, 3); ctx.fill(); }
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,230,190,0.5)'; ctx.fillRect(-50, 390, 1180, 6); ctx.restore();
  // coffee in the glass below
  const sy = 1130;
  const cg = ctx.createLinearGradient(0, sy, 0, H); cg.addColorStop(0, '#3a1a0a'); cg.addColorStop(0.2, '#1a0904'); cg.addColorStop(1, '#0a0402');
  ctx.fillStyle = cg; ctx.fillRect(0, sy, W, H - sy);
  ell(ctx, 540, sy, 620, 70); const sg = ctx.createRadialGradient(400, sy - 20, 10, 540, sy, 620); sg.addColorStop(0, '#9a5a2a'); sg.addColorStop(0.5, '#3a1808'); sg.addColorStop(1, '#1a0904'); ctx.fillStyle = sg; ctx.fill();
  // glass walls
  for (const gx of [70, 1010]) { const wg = ctx.createLinearGradient(gx - 30, 0, gx + 30, 0); wg.addColorStop(0, 'rgba(255,255,255,0)'); wg.addColorStop(0.5, 'rgba(255,240,220,0.14)'); wg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = wg; ctx.fillRect(gx - 30, 600, 60, 1320); }
  // drops: [formStart, release, impact]
  for (const [f0, rel, imp] of [[-0.3, 0.25, 0.5], [0.75, 1.35, 1.6]]) {
    if (lt >= f0 && lt < rel) {
      const k = ease.in2(clamp((lt - f0) / (rel - f0)));
      const r = 14 + k * 34, hang = 470 + 12 + k * 40;
      ctx.beginPath(); ctx.moveTo(540 - 8, 470); ctx.quadraticCurveTo(540 - r, hang, 540, hang + r); ctx.quadraticCurveTo(540 + r, hang, 540 + 8, 470); ctx.closePath();
      dropFill(ctx, 540, hang, r);
    } else if (lt >= rel && lt < imp) {
      const k = (lt - rel) / (imp - rel), y = lerp(520, sy, k * k);
      ctx.beginPath(); ctx.ellipse(540, y, 30, 38 + k * 10, 0, 0, TAU); dropFill(ctx, 540, y, 34);
      // slow-mo motion streak
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#5a2a10'; ctx.fillRect(536, y - 140 * k, 8, 140 * k); ctx.restore();
    }
    const age = lt - imp;
    if (age >= 0 && age < 1.2) crown(ctx, 540, sy, age, Math.round(imp * 10));
  }
}
function dropFill(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 2, x, y, r * 1.2);
  g.addColorStop(0, '#e0a060'); g.addColorStop(0.35, '#6a3412'); g.addColorStop(1, '#1a0904');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ell(ctx, x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.18); ctx.fillStyle = 'rgba(255,250,235,0.95)'; ctx.fill(); ctx.restore();
}
function crown(ctx, x, y, age, seed) {
  // ripples
  for (let i = 0; i < 3; i++) {
    const a = age - i * 0.12; if (a < 0) continue;
    ctx.strokeStyle = `rgba(255,190,120,${0.5 * (1 - a / 1.1)})`; ctx.lineWidth = 4;
    ell(ctx, x, y, 40 + a * 520, (40 + a * 520) * 0.11); ctx.stroke();
  }
  // crown: thin liquid wall rising into a ring of spikes
  const k = age / 0.55;
  if (k < 1) {
    const hgt = Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * 150 * (1 - k * 0.6), rx = 70 + k * 110, ry = rx * 0.16;
    const g = ctx.createLinearGradient(0, y - hgt, 0, y);
    g.addColorStop(0, 'rgba(230,160,90,0.95)'); g.addColorStop(1, 'rgba(70,30,10,0.95)');
    ctx.beginPath(); ctx.moveTo(x - rx - 30, y);
    for (let i = 0; i <= 12; i++) { const u = i / 12, xx = x - rx + u * 2 * rx, spike = i % 2 ? 0 : 22; ctx.lineTo(xx, y - hgt - spike * (1 - k)); }
    ctx.lineTo(x + rx + 30, y); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ell(ctx, x, y - hgt, rx * 0.92, ry); ctx.fillStyle = 'rgba(40,16,6,0.9)'; ctx.fill();
    for (let i = 0; i <= 12; i += 2) { const xx = x - rx + (i / 12) * 2 * rx; ctx.beginPath(); ctx.arc(xx, y - hgt - 30 * (1 - k) - k * 40, 7, 0, TAU); dropFill(ctx, xx, y - hgt - 30, 9); }
  }
  const r = rng(seed);
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.0, v = 450 + r() * 400, tt = age * 0.6;
    const px = x + Math.cos(a) * v * tt, py = y + Math.sin(a) * v * tt + 0.5 * 2600 * tt * tt;
    if (py > y + 4) continue;
    ctx.beginPath(); ctx.arc(px, py, 6 + r() * 8, 0, TAU); dropFill(ctx, px, py, 12);
  }
}
function timelapse(ctx, lt, T) {
  // lt: 0..2 ; sun sweeps, shadows rotate, coffee rises, fingers tap, watch spins
  const k = lt / 2;
  const sun = Math.sin(k * Math.PI * 1.5);
  darkBg(ctx, `rgb(${90 + 60 * sun | 0},${60 + 40 * sun | 0},${40 + 20 * sun | 0})`, '#1a0d06');
  ctx.save(); ctx.translate(-k * 300, 0); bokeh(ctx, T * 4, 77, 22, ['rgba(255,190,110,0.9)', 'rgba(255,230,170,0.8)'], 0.3, 30, 120); ctx.restore();
  cam(ctx, 590, 1360, 1.22, 0, () => {
    tableTop(ctx, 1400);
    // sweeping shadow band on the table
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
    ctx.translate(lerp(-600, 1500, k), 1400); ctx.rotate(0.5 - k * 0.6); ctx.fillRect(-180, 0, 360, 900); ctx.restore();
    const gs = 1.3, gy = 1640;
    P.glass(ctx, 400, gy, gs, { level: lerp(0.06, 0.42, k), drops: 0 });
    const [, gt] = P.glassTop(400, gy, gs);
    P.phin(ctx, 400, gt - 4, gs, { k: 0.3, lid: 0 });
    const [dx, dy] = P.phinBottom(400, gt - 4, gs);
    for (let i = 0; i < 3; i++) { const d = (lt * 5 + i / 3) % 1; ell(ctx, dx, dy + d * (gy - 60 - dy), 4, 6); ctx.fillStyle = '#2a1208'; ctx.fill(); }
    // tourist's hand drumming fingers + wristwatch
    P.forearm(ctx, 1250, 1300, 860, 1440, TOUR_SKIN[1], '#2f8f8a', 74);
    const tap = Math.sin(lt * 40) > 0 ? -10 : 0;
    P.hand(ctx, 800, 1450 + tap, 1.2, Math.PI, 'flat', TOUR_SKIN);
    at(ctx, 930, 1420, -0.35, 1, 1, () => {
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-20, -46, 40, 92);
      ell(ctx, 0, 0, 36, 36); ctx.fillStyle = '#d9d4c8'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#3a3a3a'; ctx.stroke();
      ctx.strokeStyle = '#111'; ctx.lineCap = 'round';
      const a1 = lt * 25, a2 = lt * 2.2;
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a1) * 28, Math.sin(a1) * 28); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a2) * 18, Math.sin(a2) * 18); ctx.stroke();
    });
  });
  // fast-forward streak overlay
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.15;
  for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(255,220,170,1)'; ctx.fillRect(((T * 3000 + i * 400) % 1600) - 200, 0, 30, H); }
  ctx.restore();
  // ">>" badge
  ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffe6b0'; ctx.font = '44px BodySansBold'; ctx.textAlign = 'center';
  ctx.fillText('▶▶  ×300', 540, 300); ctx.restore();
}
function s11(ctx, lt, p, T) {
  if (lt < 2.0) dripMacro(ctx, lt, T); else timelapse(ctx, lt - 2.0, T);
  Tx.caption(ctx, T, 24.3, 27.85, 'Từng giọt · 4–5 phút', 'Drop by drop · 4–5 min', { n: 8 });
}

// ============ S12 28–31 Hero pour over ice ============
const ICE = [{ x: -40, y: -90, s: 1.0, r: 0.3 }, { x: 45, y: -100, s: 0.95, r: -0.4 }, { x: 0, y: -170, s: 1.05, r: 0.9 }, { x: -50, y: -235, s: 0.9, r: -0.2 }, { x: 48, y: -250, s: 1.0, r: 0.5 }, { x: 5, y: -320, s: 0.95, r: 1.2 }];
function s12(ctx, lt, p, T) {
  const slide = ease.inOut(clamp((lt - 2.4) / 0.5));
  cafeBokeh(ctx, T, -slide * 400);
  glow(ctx, 160, 340, 900, 'rgba(255,205,140,0.8)', 0.75);
  godRays(ctx, 120, 280, 1.0, 0.9, 2200, 9, 'rgba(255,215,150,0.5)', 0.4, T);
  const z = lerp(1.0, 1.1, ease.inOut(clamp(lt / 2.4)));
  cam(ctx, 540, 1050, z, 0, () => {
    ctx.save(); ctx.translate(-slide * 400, 0); tableTop(ctx, 1560); ctx.restore();
    const gx = lerp(540, 540, slide), gy = 1750, gs = 1.9, h = 330;
    const level = lerp(0, 0.78, ease.out(clamp((lt - 0.2) / 1.1)));
    const c = Math.sqrt(1 - 0.22 * 0.22), inner = (h - 22) * c;
    const surfY = -(22 * c + inner * level);
    const ice = ICE.map(q => ({ ...q, under: q.y > surfY + 20 }));
    P.glass(ctx, gx, gy, gs, {
      h, rb: 82, rt: 98, level, ice, drops: Math.round(clamp((lt - 0.6) / 1.5) * 70), t: T, dropSeed: 5,
      layers: (cx, top, rr) => {
        // swirling fresh coffee ribbons
        cx.save(); cx.globalCompositeOperation = 'screen'; cx.globalAlpha = 0.5 * clamp(1.6 - lt);
        cx.strokeStyle = 'rgba(200,120,60,0.8)'; cx.lineWidth = 8;
        for (let i = 0; i < 4; i++) { cx.beginPath(); for (let yy = -30; yy > -top; yy -= 12) { const xx = Math.sin(yy * 0.05 + T * 6 + i * 1.6) * rr * 0.7; yy === -30 ? cx.moveTo(xx, yy) : cx.lineTo(xx, yy); } cx.stroke(); }
        cx.restore();
      },
    });
    // ice crack lines appearing
    if (lt > 0.4) {
      ctx.save(); ctx.globalAlpha = clamp((lt - 0.4) / 0.6) * 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      const r = rng(14);
      for (const q of ICE) { const n = Math.floor(clamp((lt - 0.4) / 1.4) * 3); for (let i = 0; i < n; i++) { const x0 = gx + q.x * gs, y0 = gy + q.y * gs; ctx.beginPath(); ctx.moveTo(x0 + (r() - 0.5) * 40, y0 + (r() - 0.5) * 40); ctx.lineTo(x0 + (r() - 0.5) * 60, y0 + (r() - 0.5) * 60); ctx.lineTo(x0 + (r() - 0.5) * 60, y0 + (r() - 0.5) * 60); ctx.stroke(); } }
      ctx.restore();
    }
    // pour from the small brewing glass (upper right)
    const on = clamp((lt - 0.15) / 0.15) * clamp((1.25 - lt) / 0.2);
    const [, top] = P.glassTop(gx, gy, gs, { h });
    if (on > 0.01) {
      const sgx = lerp(1150, 860, ease.out(clamp(lt / 0.3))), sgy = 560;
      P.glass(ctx, sgx, sgy, 1.1, { rot: -2.0, level: 0, k: 0.25 });
      pour(ctx, sgx - 150, sgy + 40, gx + 10, top + 120, 22, 'coffee', T, on);
      P.splash(ctx, gx, top + 140, T, 6, 'coffee', 10);
    }
    // stir with a long spoon
    if (lt > 1.35 && lt < 2.35) {
      const k = lt - 1.35, a = k * 18;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, top + 60 * gs); ctx.restore();
      P.spoon(ctx, gx + Math.cos(a) * 30, top + 160 + Math.sin(a) * 8, 1.4, -1.35, 0);
    }
    flare(ctx, 180, 360, 0.8, 0.5);
  });
  // slide motion streaks
  if (slide > 0 && slide < 1) { ctx.save(); ctx.globalAlpha = 0.25 * Math.sin(slide * Math.PI); ctx.fillStyle = 'rgba(255,230,190,1)'; for (let i = 0; i < 6; i++) ctx.fillRect(0, 1500 + i * 60, W, 3); ctx.restore(); }
  Tx.caption(ctx, T, 28.3, 30.9, 'Đen đá', 'Over ice', { n: 9 });
}

// ============ S13 31–33 The first sip ============
function streetBg(ctx, T, blur, scale = 1, cx = 540, cy = 1060) {
  P.layer(ctx, blur, (x) => cam(x, cx, cy, 1.9 * scale, 0, () => A.streetScene(x, 0, T)));
}
function icedGlass(ctx, x, y, s, rot, level = 0.75) {
  P.glass(ctx, x, y, s, { h: 330, rb: 82, rt: 98, level, ice: ICE.map(q => ({ ...q, under: true })), drops: 50, t: 0, dropSeed: 5, rot });
}
function s13(ctx, lt, p, T) {
  streetBg(ctx, T, 20);
  ctx.fillStyle = 'rgba(20,10,5,0.3)'; ctx.fillRect(0, 0, W, H);
  const z = lerp(1.0, 1.12, ease.inOut(p));
  const pulse = bump(lt, 1.5, 0.15) * 0.015;
  cam(ctx, 540, 980, z + pulse, 0, () => {
    const closeEyes = ease.inOut(clamp((lt - 0.55) / 0.4));
    Pp.face(ctx, 540, 900, 2.0, { lookY: 0.6, open: 1 - closeEyes, brow: 0.2 - closeEyes * 0.3, mouth: 'sip', t: T });
    const up = ease.inOut(clamp(lt / 0.6));
    icedGlass(ctx, lerp(560, 600, up), lerp(2350, 1650, up), 2.2, lerp(0, -0.35, up), lerp(0.75, 0.6, clamp((lt - 0.8) / 1)));
  });
  // drain the colour as the world goes quiet
  const d = clamp((lt - 0.5) / 0.6);
  if (d > 0) { ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = d * 0.55; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  ctx.save(); const vg = ctx.createRadialGradient(540, 960, 300, 540, 960, 1200); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.35 + d * 0.35})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.restore();
}

// ============ S14 33–35.5 Eye macro → dolly zoom ============
function eyeReflection(ctx, IR, T) {
  ctx.save(); ctx.globalAlpha = 0.28;
  // curved reflected street: windows + bikes' lights
  ctx.fillStyle = 'rgba(255,200,130,0.7)';
  for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.28; ctx.fillRect(Math.sin(a) * IR * 0.85 - 6, -IR * 0.82 + Math.cos(a * 1.4) * 22, 12, 18); }
  ctx.strokeStyle = 'rgba(255,230,180,0.8)'; ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, IR * 1.4, IR * (1.1 + i * 0.12), Math.PI * 1.25 + Math.sin(T * 3 + i) * 0.05, Math.PI * 1.75); ctx.stroke(); }
  ctx.restore();
}
function s14(ctx, lt, p, T) {
  if (lt < 1.2) {
    const dil = ease.outExpo(clamp(lt / 0.35));
    const shake = bump(lt, 0, 0.35) * 14;
    cam(ctx, 540 + Math.sin(T * 70) * shake, 960 + Math.cos(T * 61) * shake, lerp(1.25, 1.1, ease.out(clamp(lt / 1.2))), 0, () => {
      Pp.eyeMacro(ctx, 540, 960, 1.2, { pupil: lerp(0.24, 0.62, dil), brow: dil * 0.6, open: lerp(0.85, 1.12, dil), reflect: (c, IR) => eyeReflection(c, IR, T) });
    });
  } else {
    const k = ease.inOut(clamp((lt - 1.2) / 1.3));
    // dolly zoom: background grows while face stays the same size
    streetBg(ctx, T, lerp(4, 10, k), lerp(0.75, 1.65, k), 520, 1000);
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.25 * k;
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; ctx.strokeStyle = 'rgba(255,220,170,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(540 + Math.cos(a) * 500, 960 + Math.sin(a) * 500); ctx.lineTo(540 + Math.cos(a) * (700 + k * 400), 960 + Math.sin(a) * (700 + k * 400)); ctx.stroke(); }
    ctx.restore();
    Pp.face(ctx, 540, 900, 1.55, { open: 1.25, pupil: 0.6, brow: 1.1, mouth: 'o', mOpen: 0.8, hairLift: 0.5 * k, t: T });
  }
  Tx.line(ctx, T, 34.3, 35.45, 'Trời ơi…', '…wow.', { serif: true, vsize: 70 });
}

// ============ S15 35.5–39.5 Euphoria ("phê") ============
function lightTrails(ctx, T, k, seed) {
  const r = rng(seed);
  const cols = ['255,90,90', '255,200,80', '90,200,255', '255,120,220', '120,255,170'];
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const y0 = 300 + r() * 1300, amp = 80 + r() * 200, ph = r() * TAU, sp = 0.6 + r() * 0.8, col = cols[i % cols.length];
    for (const [lw, a] of [[34, 0.12], [14, 0.35], [5, 0.9]]) {
      ctx.lineWidth = lw; ctx.strokeStyle = `rgba(${col},${a * k})`;
      ctx.beginPath();
      for (let x = -100; x <= 1180; x += 30) { const yy = y0 + Math.sin(x * 0.004 + ph + T * sp) * amp; x === -100 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function steamFlowers(ctx, T, k) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,240,220,${0.35 * k})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (let f = 0; f < 4; f++) {
    const cx = [210, 860, 180, 880][f], cy = [520, 420, 1180, 1200][f];
    for (let pt = 0; pt < 6; pt++) {
      ctx.beginPath();
      for (let s = 0; s < 1; s += 0.05) { const a = pt * TAU / 6 + T * 0.6 + s * 2.4, rr = s * 110; s === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function euphoriaScene(ctx, lt, T, o = {}) {
  const k = clamp(lt / 0.4);
  streetBg(ctx, T, 10, 1.1);
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.6;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ff8a3c'); g.addColorStop(1, '#3cc8ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  lightTrails(ctx, T, k, 5);
  steamFlowers(ctx, T, k);
  bokeh(ctx, T, 33, 20, ['rgba(255,120,120,0.9)', 'rgba(255,220,100,0.9)', 'rgba(100,220,255,0.9)'], 0.4 * k, 20, 80);
  if (o.extra) o.extra(ctx);
}
function s15(ctx, lt, p, T) {
  euphoriaScene(ctx, lt, T);
  const rot = Math.sin(lt * 0.9) * 0.02;
  cam(ctx, 540, 990, lerp(1.0, 1.08, p), rot, () => {
    const blink = (lt > 0.3 && lt < 1.0) ? 0.0 : 1;
    Pp.face(ctx, 540, 930, 1.5, { mouth: 'grin', mOpen: 0.4, open: blink, happyClosed: true, brow: 0.6, blush: 0.4, hairLift: 0.55 + Math.sin(lt * 3) * 0.15, t: T, pupil: 1.3, tilt: Math.sin(lt * 1.3) * 0.04 });
    icedGlass(ctx, 250, 1760, 1.5, 0.1, 0.55);
    const th = ease.outBack(clamp((lt - 0.95) / 0.4));
    if (th > 0) Pp.thumbsUp(ctx, 830, lerp(2100, 1480, th), 1.6, 0.12);
  });
  // sparkles around
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + lt * 0.8, x = 540 + Math.cos(a) * 420, y = 760 + Math.sin(a * 1.3) * 380; L.sparkle(ctx, x, y, 40 + 20 * Math.sin(lt * 5 + i), 0.5 + 0.5 * Math.sin(lt * 4 + i)); }
  Tx.line(ctx, T, 36.4, 38.9, 'Ngon!', 'So good!', { vsize: 84 });
}

// ============ S16 39.5–42.5 Coffee-drunk ============
function star(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = '#ffe066'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c99a1a'; ctx.stroke(); ctx.restore();
}
function drunkScene(ctx, lt, T) {
  euphoriaScene(ctx, 3, T);
  const hic = bump(lt, 1.1, 0.25);
  const stand = bump(lt, 1.4, 0.75);
  const fy = 950 - hic * 40 - stand * 140 + Math.sin(lt * 2.4) * 10;
  const sway = Math.sin(lt * 2.1) * 0.12;
  Pp.face(ctx, 540 + Math.sin(lt * 1.7) * 40, fy, 1.45, {
    mouth: hic > 0.3 ? 'o' : 'woozy', open: hic > 0.3 ? 1 : 0.42, openR: hic > 0.3 ? 1 : 0.62, pupil: 0.9, lookX: Math.sin(lt * 2.7) * 0.6, lookY: 0.2,
    brow: hic > 0.3 ? 0.8 : -0.1, blush: 0.95, hairLift: 0.3, t: T, tilt: sway,
  });
  // stars & a sparrow circling the head
  for (let i = 0; i < 5; i++) {
    const a = lt * 3 + i * TAU / 5, x = 540 + Math.cos(a) * 270, y = fy - 360 + Math.sin(a) * 60;
    if (i === 2) Wd.sparrow(ctx, x, y, 1.6, lt * 20, Math.cos(a) > 0); else star(ctx, x, y, 26, lt * 3 + i);
  }
  // hiccup bubble
  const hb = lt - 1.1;
  if (hb > 0 && hb < 1.0) { ctx.save(); ctx.globalAlpha = 1 - hb; ell(ctx, 640 + hb * 60, fy + 120 - hb * 300, 30 + hb * 20, 30 + hb * 20); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.stroke(); ell(ctx, 628 + hb * 60, fy + 108 - hb * 300, 8, 6); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); }
  icedGlass(ctx, 250, 1770, 1.5, 0.15 + Math.sin(lt * 2) * 0.05, 0.25);
  // uncle slides iced tea in from the left
  const slide = ease.out(clamp((lt - 1.95) / 0.4));
  if (slide > 0) {
    const tx = lerp(-250, 760, slide);
    P.forearm(ctx, tx - 520, 1950, tx - 120, 1780, UNCLE_SKIN[0], '#e9e4da', 90);
    P.glass(ctx, tx, 1820, 1.25, { level: 0.8, tea: true, ice: [{ x: -20, y: -80, s: 0.8, r: 0.2, under: true }, { x: 25, y: -150, s: 0.8, r: -0.5 }], drops: 30, t: T });
    P.hand(ctx, tx - 120, 1760, 1.1, 0, 'fist', UNCLE_SKIN);
  }
}
function s16(ctx, lt, p, T) {
  const rot = Math.sin(lt * 2.2) * 0.07, ghost = 18 + Math.sin(lt * 1.6) * 26;
  const [b, bx] = buffer('drunk');
  cam(bx, 540, 960, 1.04, rot, () => drunkScene(bx, lt, T));
  ctx.drawImage(b, 0, 0);
  ctx.save(); ctx.globalAlpha = 0.35; ctx.drawImage(b, ghost, 8); ctx.globalAlpha = 0.2; ctx.drawImage(b, -ghost * 0.8, -6); ctx.restore();
  Tx.label(ctx, T, 39.7, 42.4, 'SAY CÀ PHÊ', 'Coffee-drunk', 280);
  Tx.line(ctx, T, 41.4, 42.6, '“Uống trà đá cho tỉnh nè!”', '“Have some iced tea, buddy!”', { vsize: 52, esize: 38 });
}

// ============ S17 42.5–45 Crane out, end card ============
function s17(ctx, lt, p, T) {
  const k = ease.inOut(clamp(lt / 2.3));
  cam(ctx, lerp(420, 540, k), lerp(1150, 900, k), lerp(1.6, 1.0, k), 0, () => {
    A.streetScene(ctx, lt, T, {
      nod: bump(lt, 0.3, 0.3) + bump(lt, 0.7, 0.3) + bump(lt, 1.1, 0.3),
      tableProps: (c) => {
        P.glass(c, 290, 1240, 0.45, { level: 0.7, tea: true, drops: 0 });
        P.glass(c, 370, 1240, 0.45, { level: 0.08, drops: 0 });
        P.phin(c, 370, 1240 - 210 * 0.45 * 0.975, 0.45, { k: 0.3, lid: 0 });
      },
    });
    // tourist on the stool, raising his empty glass
    const raise = ease.outBack(clamp((lt - 0.1) / 0.4));
    Pp.tourist(ctx, 520, 1345, 1, { sit: 1, raise, look: -0.15 * raise, smile: true });
    if (raise > 0.2) P.glass(ctx, lerp(500, 440, raise), lerp(1240, 1050, raise), 0.38, { level: 0, drops: 0, ice: [{ x: 0, y: -60, s: 0.8, r: 0.3 }] });
  });
  flare(ctx, 160, 300, 1.0, 0.6);
  godRays(ctx, 160, 300, 0.95, 0.9, 2200, 9, 'rgba(255,215,150,0.45)', 0.4, T);
  Tx.line(ctx, T, 42.7, 43.8, 'Thêm ly nữa!', 'One more!', { vsize: 70 });
  Tx.endCard(ctx, T, 43.1);
  if (lt > 2.1) { ctx.fillStyle = `rgba(0,0,0,${ease.in2(clamp((lt - 2.1) / 0.4))})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s10, s11, s12, s13, s14, s15, s16, s17 };
