// Shots 1–10 (0–30.75s): misty dawn Hanoi, the tourist is lured in, the pot opens, title, broth prep.
const L = require('./lib');
const PP = require('./pprops');
const PE = require('./people');
const X = require('./text');
const { W, H, TAU, rng, clamp, lerp, ease, cam, at, glow, flare, dust, bokeh, godRays, flakes, sparkle } = L;
const { STREET } = PP;
const GY = STREET.GY;

// ---------- local helpers ----------
const bump = (lt, t0, d) => { const u = (lt - t0) / d; return u < 0 || u > 1 ? 0 : Math.sin(u * Math.PI); };
const inv = (a, b, v) => clamp((v - a) / (b - a));
function fill(ctx, c0, c1, y0 = 0, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// halved onion, cut face up-ish, charred unevenly (no bullseye)
function onionHalf(ctx, x, y, s, rot, ch) {
  at(ctx, x, y, rot, s, s, () => {
    // charred outer skin rim
    const sk = ctx.createLinearGradient(0, -60, 0, 70); sk.addColorStop(0, '#5a3418'); sk.addColorStop(1, '#140904');
    ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(0, 8, 70, 62, 0, 0, TAU); ctx.fill();
    // cut face
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 62, 50, 0, 0, TAU); ctx.clip();
    const f = ctx.createRadialGradient(-6, -4, 4, 0, 0, 66); f.addColorStop(0, '#f6e7c4'); f.addColorStop(0.55, '#d9aa66'); f.addColorStop(1, '#6a3412');
    ctx.fillStyle = f; ctx.fillRect(-70, -60, 140, 120);
    // three faint layer lines, slightly wobbly
    ctx.strokeStyle = 'rgba(140,90,40,0.28)'; ctx.lineWidth = 2.5;
    for (const k of [0.38, 0.62, 0.84]) { ctx.beginPath(); for (let a = 0; a <= TAU + 0.01; a += 0.2) { const w = 1 + 0.04 * Math.sin(a * 3 + k * 9); const px = Math.cos(a) * 60 * k * w, py = Math.sin(a) * 48 * k * w; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
    // uneven blackened patches (soft), heavier on one side
    const r = rng(77);
    for (let i = 0; i < 9; i++) {
      const a = -0.6 + r() * 2.6, d = 22 + r() * 40, px = Math.cos(a) * d, py = Math.sin(a) * d * 0.8, rr = 10 + r() * 22;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(18,8,3,${0.85 * ch})`); g.addColorStop(0.6, `rgba(50,20,6,${0.55 * ch})`); g.addColorStop(1, 'rgba(60,25,8,0)');
      ctx.fillStyle = g; ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    // caramelised amber sheen
    ctx.fillStyle = `rgba(200,110,30,${0.25 * ch})`; ctx.beginPath(); ctx.ellipse(10, 6, 40, 30, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(30,14,5,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 62, 50, 0, 0, TAU); ctx.stroke();
    // backlit rim highlight
    ctx.strokeStyle = 'rgba(255,190,110,0.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 8, 70, 62, 0, 3.6, 5.8); ctx.stroke();
  });
}
// rising embers (tiny glowing sparks with wobble)
function embers(ctx, t, seed, n, x, y, w, h, a = 1) {
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.25 + r() * 0.5, life = (t * sp + ph) % 1, ox = (r() - 0.5) * w, sz = 1.5 + r() * 3.5, wf = 1 + r() * 3;
    const px = x + ox + Math.sin(t * wf + i) * 30 * life, py = y - life * h;
    const al = a * Math.sin(life * Math.PI) * (0.6 + 0.4 * Math.sin(t * 20 + i));
    ctx.globalAlpha = clamp(al);
    const g = ctx.createRadialGradient(px, py, 0, px, py, sz * 4);
    g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.3, 'rgba(255,150,40,0.8)'); g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g; ctx.fillRect(px - sz * 4, py - sz * 4, sz * 8, sz * 8);
  }
  ctx.restore();
}
// glowing charcoal bed (honeycomb coal lumps), seen at a low angle
function coalBed(ctx, t, x0, y0, w, h, seed = 5) {
  const r = rng(seed);
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#ff7a1e'); g.addColorStop(0.35, '#b33a08'); g.addColorStop(1, '#2a0904');
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  const rows = 9;
  for (let j = 0; j < rows; j++) {
    const yb = y0 + 20 + Math.pow(j / (rows - 1), 1.3) * h * 0.9, sc = 0.55 + j * 0.25;
    for (let xx = x0 - 40 + r() * 60; xx < x0 + w + 40; xx += (55 + r() * 60) * sc) {
      const yy = yb + (r() - 0.5) * 50 * sc;
      const rx = (48 + r() * 26) * sc, ry = rx * 0.45, fl = 0.6 + 0.4 * Math.sin(t * (2 + r() * 3) + xx);
      ctx.fillStyle = '#1b0b07'; ctx.beginPath(); ctx.ellipse(xx, yy, rx, ry, 0, 0, TAU); ctx.fill();
      const hot = Math.pow(r(), 2.2);
      const cg = ctx.createRadialGradient(xx, yy - ry * 0.3, 1, xx, yy, rx);
      cg.addColorStop(0, `rgba(255,${(150 + 80 * fl) | 0},60,${0.95 * hot * fl})`); cg.addColorStop(0.5, `rgba(220,60,10,${0.7 * hot})`); cg.addColorStop(1, 'rgba(60,10,0,0)');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(xx, yy, rx * 0.95, ry * 0.95, 0, 0, TAU); ctx.fill();
      const sh = ctx.createLinearGradient(0, yy - ry, 0, yy + ry); sh.addColorStop(0, 'rgba(90,40,20,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(xx, yy, rx, ry, 0, 0, TAU); ctx.fill();
      // ash crust + cracks
      ctx.strokeStyle = `rgba(255,${(200 + 50 * fl) | 0},120,${(0.25 + 0.6 * hot) * fl})`; ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.moveTo(xx - rx * 0.6, yy - ry * 0.1); ctx.lineTo(xx - rx * 0.1, yy + ry * 0.2); ctx.lineTo(xx + rx * 0.5, yy - ry * 0.25); ctx.stroke();
      ctx.fillStyle = 'rgba(160,150,140,0.25)'; ctx.beginPath(); ctx.ellipse(xx + rx * 0.2, yy - ry * 0.45, rx * 0.4, ry * 0.25, 0, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
// flame tongues licking up from a line
function flames(ctx, t, x0, x1, y, hmax, seed = 9, a = 1) {
  const r = rng(seed), n = Math.round((x1 - x0) / 50);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + r()) * (x1 - x0) / n, ph = r() * TAU, sp = 5 + r() * 6;
    const h = hmax * (0.35 + 0.65 * Math.abs(Math.sin(t * sp * 0.5 + ph))) * (0.5 + r() * 0.5), w = 22 + r() * 22;
    const sway = Math.sin(t * sp + ph) * w * 0.5;
    const g = ctx.createLinearGradient(0, y, 0, y - h);
    g.addColorStop(0, `rgba(255,200,90,${0.85 * a})`); g.addColorStop(0.5, `rgba(255,110,20,${0.6 * a})`); g.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x - w * 0.6 + sway * 0.5, y - h * 0.5, x + sway, y - h); ctx.quadraticCurveTo(x + w * 0.6 + sway * 0.5, y - h * 0.5, x + w, y); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// soft steam ribbon along a sampled path (array of [x,y]); width w, alpha a
function steamRibbon(ctx, pts, w, a, t = 0) {
  if (a <= 0 || pts.length < 2) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [ww, aa] of [[w * 2.4, 0.10], [w * 1.6, 0.16], [w, 0.32], [w * 0.45, 0.45]]) {
    ctx.strokeStyle = `rgba(255,250,240,${aa * a})`; ctx.lineWidth = ww;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  ctx.restore();
}
const qbez = (p0, p1, p2, u) => [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];
function shake(ctx, amp, T) { ctx.translate(Math.sin(T * 71) * amp, Math.cos(T * 57 + 1) * amp); }

// ---------- S1 0–3.75 very high wide, slow crane down over misty roofs ----------
function s1(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const z = lerp(1.05, 1.14, e);
  cam(ctx, lerp(540, 590, e), 960, z, lerp(-0.012, 0, e), () => {
    PP.dawnAerial(ctx, T, 0.08 + 0.05 * p, lerp(0.02, 0.92, e), { steam: 1 });
  });
  // a few birds crossing the sky (slow)
  ctx.save(); ctx.strokeStyle = 'rgba(20,22,48,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const r = rng(12);
  for (let i = 0; i < 6; i++) {
    const bx = lerp(-80, 1160, (lt * 0.18 + r() * 0.5) % 1.2), by = 520 + r() * 260 - e * 500, f = Math.sin(T * 9 + i * 2) * 8, s = 10 + r() * 6;
    ctx.beginPath(); ctx.moveTo(bx - s, by - f); ctx.quadraticCurveTo(bx - s * 0.4, by - 4, bx, by); ctx.quadraticCurveTo(bx + s * 0.4, by - 4, bx + s, by - f); ctx.stroke();
  }
  ctx.restore();
  // near mist sweeping up past the lens (parallax sells the crane)
  PP.fog(ctx, T * 1.6, 41, lerp(1500, -300, e), 520, 0.45, '#c9cde8');
  dust(ctx, T, 11, 30, 0, 0, W, H, '235,235,255', 2.2, 0.35);
  X.label(ctx, T, 0.5, 3.45, 'HÀ NỘI · 5:30 SÁNG', 'Hanoi · 5:30 AM', 300);
}

// ---------- S2 3.75–6.75 wide pan along the empty street ----------
function s2(ctx, lt, p, T) {
  const e = ease.inOut(p);
  const panX = lerp(150, 760, e);
  PP.dawnStreet(ctx, T, panX, {
    k: 0.22,
    mid: (c, ox) => {
      // sweeper on the far sidewalk, working toward -x
      PP.broomSweeper(c, 1080 + ox - lt * 18, GY + 70, 0.95, T);
      // old man cycles past on the road (a bit faster than the pan)
      PP.bicycleRider(c, lerp(-150, 2000, lt / 3) + ox, 1700, 1.0, T, { speed: 1.6 });
    },
  });
  // leaves swirling from the broom
  flakes(ctx, T, 4.2, 23, 10, 1080 - panX - lt * 18 - 90, GY + 60, { g: 120, speed: 160, life: 2.4, angle: -2.4, spread: 1.4, size: 9, stagger: 1.6, colors: ['#9a4a2a', '#b8742e', '#6e3a20'] });
  dust(ctx, T, 21, 26, 0, 500, W, 1100, '255,220,170', 2.2, 0.35);
}

// ---------- S3 6.75–9.75 tourist, cold, lured onto a stool by a steam ribbon ----------
function s3(ctx, lt, p, T) {
  const SX = 1500;                                // stall layer x
  const stoolX = SX + 200, stoolY = GY + 50;      // right stool (from stallFront)
  const ts = 0.66;                                // tourist scale
  // tourist position (layer coords) & state
  let tx, walk = null, sit = 0, look = 0, lean = 0, hand = null, handK = 0, liftY = 0;
  const tStop = 1.35, tPull = 1.75, tLand = 2.45;
  const stopX = SX - 245;
  if (lt < tStop) { tx = lerp(SX + 470, stopX, lt / tStop); walk = T * 7.5; hand = [-46, -238]; handK = 0.9 * (0.5 + 0.5 * Math.sin(lt * 9) * 0 + 0.5); }
  else if (lt < tPull) { const k = (lt - tStop) / (tPull - tStop); tx = stopX - 8 * ease.out(k); look = 0.35 * ease.out(k); lean = 0.08 * ease.out(k); hand = [-46, -238]; handK = 0.9 * (1 - k); }
  else if (lt < tLand) {
    const k = (lt - tPull) / (tLand - tPull), e = ease.inOut(k);
    tx = lerp(stopX - 8, stoolX - 14 * ts, e); sit = ease.in(clamp(k * 1.2)); look = 0.35 * (1 - k); lean = lerp(0.08, -0.1, e);
    liftY = -Math.sin(k * Math.PI) * 70;          // feet off the ground, floating backwards
  } else { const k = (lt - tLand) / (3 - tLand); tx = stoolX - 14 * ts; sit = 1; liftY = -bump(lt, tLand, 0.25) * 10; lean = -0.1 * (1 - ease.out(k)); }
  const tyBase = sit > 0 ? lerp(GY + 40, stoolY + 4 + 80 * ts - 80 * ts, sit) : GY + 40;
  const ty = (sit > 0 ? lerp(GY + 40, stoolY - 46 * 0.75 + 80 * ts, sit) : GY + 40) + liftY;
  void tyBase;
  // camera follows tourist (medium shot)
  const camX = clamp(tx - 30, SX - 230, 1800), camY = GY - 285;
  const z = lerp(2.05, 2.2, ease.inOut(p));
  const panX = camX - 540;
  cam(ctx, 540, camY, z, 0, () => {
    PP.dawnStreet(ctx, T, panX, {
      k: 0.24, stallX: SX, fogA: 0.4,
      mid: (c, ox) => {
        const st = { walk, sit, look, lean, glassHand: hand, glassHandK: handK };
        const tx0 = tx; { const tx = tx0 + ox; const SXs = SX + ox; const stoolXs = stoolX + ox;
        // the steam ribbon: from the pot, loops around his waist, drags him in
        const potX = SXs - 60, potY = GY - 175;
        const rk = inv(tStop + 0.1, tPull + 0.15, lt), fade = 1 - inv(tLand + 0.1, 3, lt);
        const waist = [tx + 6 * ts, ty - 150 * ts * (1 - sit * 0.55)];
        const n = 40, pts = [];
        const ctrl = [lerp(potX, waist[0], 0.5), potY - 220];
        for (let i = 0; i <= n; i++) {
          const u = i / n * rk;
          pts.push(qbez([potX, potY], ctrl, waist, u).map((v, j) => v + (j ? Math.sin(T * 3 + i * 0.4) * 6 : 0)));
        }
        // behind-the-body half of the loop
        const loopA = inv(tPull - 0.1, tPull + 0.2, lt) * fade;
        if (loopA > 0) {
          const back = []; for (let i = 0; i <= 16; i++) { const a = Math.PI + i / 16 * Math.PI; back.push([waist[0] + Math.cos(a) * 62 * ts, waist[1] + Math.sin(a) * 20 * ts]); }
          steamRibbon(c, back, 16, 0.5 * loopA, T);
        }
        PE.tourist(c, tx, ty, ts, st);
        PP.touristScarf(c, tx, ty, ts, st, '#c8423a');
        // breath puffs while walking (he blows on his hands)
        if (lt < tPull + 0.1) {
          const hx = tx - 52 * ts, hy = ty - 245 * ts;
          for (let i = 0; i < 3; i++) {
            const ph = (lt * 1.6 + i / 3) % 1, a = Math.sin(ph * Math.PI) * 0.55 * (1 - inv(tStop, tPull, lt));
            glow(c, hx - ph * 60, hy - ph * 30, 14 + ph * 34, 'rgba(240,245,255,0.8)', a);
          }
        }
        if (rk > 0) { steamRibbon(c, pts, 30, 1.0 * fade, T); const tip = pts[pts.length - 1]; glow(c, tip[0], tip[1], 50, 'rgba(255,255,255,0.7)', 0.6 * fade); }
        if (loopA > 0) {
          const front = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI; front.push([waist[0] + Math.cos(a) * 64 * ts, waist[1] + Math.sin(a) * 22 * ts]); }
          steamRibbon(c, front, 18, 0.85 * loopA, T);
          // little curl/hand of steam at the end tugging
          glow(c, waist[0] + 64 * ts, waist[1], 40, 'rgba(255,255,255,0.6)', 0.5 * loopA);
        }
        // surprise marks when he stops short
        const sk = bump(lt, tStop - 0.05, 0.7);
        if (sk > 0) {
          const hx = tx - 4 * ts, hy = ty - 430 * ts;
          c.save(); c.globalAlpha = clamp(sk * 1.6); c.strokeStyle = '#fff2c8'; c.lineWidth = 5; c.lineCap = 'round';
          for (const a of [-2.3, -1.6, -0.9]) { c.beginPath(); c.moveTo(hx + Math.cos(a) * 34, hy + Math.sin(a) * 34); c.lineTo(hx + Math.cos(a) * (60 + sk * 14), hy + Math.sin(a) * (60 + sk * 14)); c.stroke(); }
          c.restore();
        }
        // landing dust puff
        const lk = bump(lt, tLand - 0.02, 0.4);
        if (lk > 0) glow(c, stoolXs, stoolY + 6, 60 + lk * 50, 'rgba(230,230,250,0.7)', lk * 0.6);
        }
      },
    });
  });
  // ---- foreground: wet road reflections, fog, blurred stool, bokeh ----
  const toS = (Lx) => 540 + (Lx - camX) * z;
  const gS = 960 + (GY - camY) * z;                       // ground line on screen
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  // stall light smeared on the wet road
  for (const [lx, w, a, col] of [[SX - 60, 260, 0.55, '255,170,80'], [SX + 70, 160, 0.35, '255,200,120'], [820, 120, 0.3, '255,215,150'], [1900, 120, 0.3, '255,215,150']]) {
    const x = toS(lx); if (x < -300 || x > W + 300) continue;
    const g = ctx.createLinearGradient(0, gS + 40, 0, H);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    for (let i = 0; i < 6; i++) { const wx = x + Math.sin(T * 1.7 + i * 1.9) * 10 + (i - 2.5) * w * 0.14; ctx.fillRect(wx - w * 0.06, gS + 40, w * 0.1, H - gS); }
  }
  ctx.restore();
  // puddle ripples
  ctx.save(); ctx.strokeStyle = 'rgba(255,210,150,0.25)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const ph = (T * 0.6 + i / 3) % 1, x = toS(SX - 20); ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(x, gS + 260, 40 + ph * 160, (40 + ph * 160) * 0.18, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
  PP.fog(ctx, T * 1.4, 37, gS + 60, 260, 0.55, '#aeb4dc');
  // out-of-focus blue stool + table edge right at the lens (bottom corners), parallax
  ctx.save(); ctx.filter = 'blur(14px)';
  const fx = 140 - (camX - 1500) * 0.6;
  ctx.fillStyle = '#2f5fae'; ctx.beginPath(); ctx.moveTo(fx - 200, H); ctx.lineTo(fx - 150, H - 230); ctx.lineTo(fx + 170, H - 230); ctx.lineTo(fx + 220, H); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a7fd4'; ctx.fillRect(fx - 175, H - 262, 370, 48);
  ctx.fillStyle = '#1c2f55'; ctx.fillRect(fx - 90, H - 200, 180, 200);
  const tx2 = W - 40 - (camX - 1500) * 0.6;
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(tx2 - 260, H - 300, 520, 50); ctx.fillStyle = '#3a2414'; ctx.fillRect(tx2 - 230, H - 250, 40, 250);
  ctx.restore();
  bokeh(ctx, T, 38, 8, ['rgb(255,190,110)', 'rgb(255,150,80)', 'rgb(200,210,255)'], 0.25, 30, 80);
  dust(ctx, T, 31, 24, 0, 300, W, 1200, '255,225,180', 2.4, 0.4);
}

// ---------- S4 9.75–12 close: Ông Tư lifts the lid, steam engulfs the frame ----------
function s4(ctx, lt, p, T) {
  const lk = ease.out(clamp((lt - 0.2) / 0.45));          // clank at 10.0
  const burst = clamp((lt - 0.3) / 1.9);
  const z = lerp(1.0, 1.18, ease.in(p)) + bump(lt, 0.25, 0.25) * 0.02;
  // warm stall interior background
  fill(ctx, '#3a1c10', '#120806');
  bokeh(ctx, T, 41, 14, ['rgb(255,170,90)', 'rgb(255,200,140)', 'rgb(255,120,60)'], 0.28, 30, 90);
  glow(ctx, 540, 700, 700, 'rgba(255,150,70,0.5)', 0.5);
  cam(ctx, 560, 1080, z, 0, () => {
    const s = 1.55, ox = 150, oy = 1800;
    PP.giantPot(ctx, ox + 270 * s, oy, s, { lid: 'off', simmer: 0.9, t: T, steam: 0.4 + burst });
    PP.ongTu(ctx, ox, oy, s, { pose: 'lid', k: lk, t: T, expr: lk > 0.5 ? 'laugh' : 'smile' });
  });
  // steam burst
  const px = 560 + (150 + 270 * 1.55 - 560) * z, py = 1080 + (1800 - 400 * 1.55 - 1080) * z;
  if (burst > 0) {
    PP.richSteam(ctx, T, 44, px, py, lerp(300, 1100, burst), lerp(800, 2200, burst), lerp(0.6, 1, burst), { n: 26 });
    PP.richSteam(ctx, T + 3, 45, px - 120, py + 60, lerp(400, 1300, burst), lerp(600, 2000, burst), lerp(0.4, 0.9, burst), { n: 20, drift: -0.2 });
    const wa = ease.in(clamp((lt - 0.9) / 1.35));
    const g = ctx.createRadialGradient(px, py - 200, 50, px, py - 200, lerp(300, 1800, wa));
    g.addColorStop(0, `rgba(255,252,246,${0.95 * wa})`); g.addColorStop(1, `rgba(255,248,238,${0.6 * wa * wa})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (lk > 0.2) flare(ctx, px - 60, py - 30, 1.2, 0.4 * (1 - burst * 0.5));
}

// ---------- S5 12–15 macro slow-mo ladle of crystal-clear broth + TITLE ----------
function ladleCup(ctx, x, y, rx, ry, depth, t, k) {
  // back lip shadow / metal bowl
  ctx.save();
  ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.bezierCurveTo(x - rx, y + depth * 0.8, x - rx * 0.5, y + depth, x, y + depth); ctx.bezierCurveTo(x + rx * 0.5, y + depth, x + rx, y + depth * 0.8, x + rx, y); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI, false); ctx.closePath();
  const mg = ctx.createLinearGradient(x - rx, 0, x + rx, 0);
  mg.addColorStop(0, '#2c2d31'); mg.addColorStop(0.18, '#9c9ea3'); mg.addColorStop(0.32, '#f4efe4'); mg.addColorStop(0.5, '#7d7f84'); mg.addColorStop(0.8, '#c9c7c2'); mg.addColorStop(1, '#3a3b3f');
  ctx.fillStyle = mg; ctx.fill();
  // warm reflected light on the underside
  const wl = ctx.createLinearGradient(0, y + depth * 0.3, 0, y + depth);
  wl.addColorStop(0, 'rgba(255,150,60,0)'); wl.addColorStop(1, 'rgba(255,150,60,0.45)');
  ctx.fillStyle = wl; ctx.fill();
  // inner back wall
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = '#4a4b50'; ctx.fill();
  // broth surface
  const bx = x, by = y + ry * 0.12, brx = rx * 0.94, bry = ry * 0.86;
  ctx.save(); ctx.beginPath(); ctx.ellipse(bx, by, brx, bry, 0, 0, TAU); ctx.clip();
  const bg = ctx.createRadialGradient(bx - brx * 0.25, by - bry * 0.4, 10, bx, by, brx);
  bg.addColorStop(0, '#ffe3a0'); bg.addColorStop(0.45, '#f0a94a'); bg.addColorStop(1, '#8c4812');
  ctx.fillStyle = bg; ctx.fillRect(bx - brx, by - bry, brx * 2, bry * 2);
  // see-through: the metal bottom shows (clear broth)
  const cg = ctx.createRadialGradient(bx + brx * 0.1, by + bry * 0.2, 10, bx, by, brx * 0.7);
  cg.addColorStop(0, 'rgba(255,240,210,0.35)'); cg.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = cg; ctx.fillRect(bx - brx, by - bry, brx * 2, bry * 2);
  // gentle surface ripples
  ctx.strokeStyle = 'rgba(255,245,215,0.35)'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) { const ph = (t * 0.25 + i / 4) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(bx + 40, by + 10, brx * ph, bry * ph, 0, 0, TAU); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // golden fat droplets (coins) that drift and glitter
  const r = rng(515);
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU + t * 0.05 * (r() - 0.5), d = Math.sqrt(r()) * 0.92, rad = (5 + r() * r() * 34) * (rx / 380);
    const px = bx + Math.cos(a) * brx * d, py = by + Math.sin(a) * bry * d, ry2 = rad * (bry / brx) * 1.4;
    ctx.fillStyle = 'rgba(255,205,90,0.55)'; ctx.beginPath(); ctx.ellipse(px, py, rad, ry2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(160,80,10,0.55)'; ctx.lineWidth = Math.max(1, rad * 0.14); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,240,0.9)'; ctx.beginPath(); ctx.ellipse(px - rad * 0.35, py - ry2 * 0.35, rad * 0.3, ry2 * 0.25, 0, 0, TAU); ctx.fill();
  }
  // a floating star anise + scallion-free clear look
  PP.starAnise(ctx, bx + brx * 0.38, by - bry * 0.15, 1.1 * (rx / 380), 0.3 + t * 0.05, { toast: 0.5 });
  // surface sheen
  ctx.globalCompositeOperation = 'screen';
  const hl = ctx.createLinearGradient(bx - brx, by - bry, bx + brx * 0.2, by + bry);
  hl.addColorStop(0, 'rgba(255,255,240,0)'); hl.addColorStop(0.45, 'rgba(255,255,240,0.35)'); hl.addColorStop(0.55, 'rgba(255,255,240,0)');
  ctx.fillStyle = hl; ctx.fillRect(bx - brx, by - bry, brx * 2, bry * 2);
  ctx.restore();
  // lip ring
  ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y + 5, rx + 3, ry + 3, 0, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
  // glitter on the fat
  const g = rng(616);
  for (let i = 0; i < 9; i++) {
    const a = g() * TAU, d = Math.sqrt(g()) * 0.8, tw = Math.max(0, Math.sin(t * (2.5 + g() * 3) + i * 1.7));
    sparkle(ctx, x + Math.cos(a) * rx * 0.94 * d, y + ry * 0.12 + Math.sin(a) * ry * 0.86 * d, 16 + 18 * g(), tw * tw * (0.5 + 0.5 * k));
  }
}
function s5(ctx, lt, p, T) {
  // dark warm stall background with out-of-focus lights
  fill(ctx, '#2a140a', '#0c0503');
  bokeh(ctx, T, 51, 16, ['rgb(255,180,100)', 'rgb(255,210,150)', 'rgb(255,140,70)'], 0.35, 40, 120);
  glow(ctx, 760, 520, 640, 'rgba(255,170,90,0.55)', 0.55);
  // pot surface far below, out of focus
  ctx.save(); ctx.filter = 'blur(10px)';
  ctx.beginPath(); ctx.ellipse(540, 1880, 900, 330, 0, 0, TAU);
  const pg = ctx.createRadialGradient(400, 1760, 40, 540, 1880, 900); pg.addColorStop(0, '#ffcf80'); pg.addColorStop(0.5, '#c87528'); pg.addColorStop(1, '#4a2208');
  ctx.fillStyle = pg; ctx.fill(); ctx.restore();
  // slow-mo rise
  const e = ease.out(p);
  const cy = lerp(1300, 1130, e), rx = lerp(380, 400, e), ry = rx * 0.3, depth = rx * 0.75;
  const tilt = Math.sin(lt * 0.9) * 0.025;
  at(ctx, 540, cy, tilt, 1, 1, () => {
    // handle going up-right out of frame
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = '#3e4044'; ctx.lineWidth = 46; ctx.beginPath(); ctx.moveTo(rx * 0.92, -10); ctx.quadraticCurveTo(rx * 1.15, -200, rx * 1.6, -900); ctx.stroke();
    ctx.strokeStyle = '#bfc1c5'; ctx.lineWidth = 32; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(rx * 0.88, -14); ctx.quadraticCurveTo(rx * 1.1, -200, rx * 1.55, -900); ctx.stroke();
    ctx.restore();
    ladleCup(ctx, 0, 0, rx, ry, depth, T, clamp(lt / 0.6));
    // drips falling back (slow motion) from the lip
    const r = rng(55);
    for (let i = 0; i < 4; i++) {
      const dx = (r() - 0.5) * rx * 1.6, ph = (lt * 0.35 + r()) % 1, y0 = depth * (0.5 + 0.4 * (1 - Math.abs(dx) / rx));
      const yy = y0 + ph * 700, dr = 7 + r() * 6;
      ctx.fillStyle = 'rgba(255,205,120,0.85)'; ctx.beginPath(); ctx.ellipse(dx, yy, dr * 0.8, dr * 1.25, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,235,0.9)'; ctx.beginPath(); ctx.ellipse(dx - dr * 0.25, yy - dr * 0.4, dr * 0.25, dr * 0.35, 0, 0, TAU); ctx.fill();
      // thin trail from the lip
      if (ph < 0.25) { ctx.strokeStyle = `rgba(255,200,110,${0.6 * (1 - ph * 4)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(dx, y0 - 10); ctx.lineTo(dx, yy); ctx.stroke(); }
    }
  });
  // steam curling off the broth through the light
  PP.richSteam(ctx, T, 57, 540, cy - 20, 520, 700, 0.45, { n: 14, drift: 0.05 });
  godRays(ctx, 900, 200, 2.3, 0.6, 1500, 7, 'rgb(255,210,150)', 0.12, T);
  dust(ctx, T, 58, 50, 100, 300, 880, 1200, '255,235,200', 2.6, 0.55);
  flare(ctx, 820, 1040, 1.4, 0.3 + 0.1 * Math.sin(T * 2));
  X.title(ctx, T, 12.3, 14.85, 470, 'Hanoi Beef Pho', 'PHỞ BÒ', 'HÀ NỘI');
}

// ---------- S6 15–18 onion & ginger charring over charcoal, backlit ----------
function s6(ctx, lt, p, T) {
  fill(ctx, '#1a0a06', '#060202');
  // backlight behind the produce (warm, low sun of the coals)
  glow(ctx, 600, 760, 900, 'rgba(255,120,40,0.55)', 0.7);
  godRays(ctx, 620, 900, -Math.PI / 2, 1.4, 1200, 9, 'rgb(255,170,90)', 0.13, T);
  const z = lerp(1.3, 1.45, ease.inOut(p));
  cam(ctx, 540, lerp(900, 880, p), z, lerp(0.02, -0.01, p), () => {
    coalBed(ctx, T, -200, 1080, 1480, 900, 61);
    flames(ctx, T, -100, 1180, 1110, 220, 62, 0.9);
    // grill wires
    ctx.save(); ctx.strokeStyle = '#2a2420'; ctx.lineWidth = 9;
    for (let i = -1; i < 12; i++) { ctx.beginPath(); ctx.moveTo(i * 100 - 40, 1060); ctx.lineTo(i * 100 + 60, 1060 + 40); ctx.stroke(); }
    ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-100, 1065); ctx.lineTo(1180, 1065); ctx.stroke();
    ctx.restore();
    // onion halves & ginger (slowly turning, smoking)
    const roll = Math.sin(lt * 1.3) * 0.06;
    PP.gingerKnob(ctx, 340, 1010, 1.35, -0.2 + roll, { char: 0.6 + 0.4 * p });
    PP.charredOnion(ctx, 585, 970, 2.0, 0.08 - roll, { char: 0.7 + 0.3 * p, cut: false });
    onionHalf(ctx, 790, 1005, 1.55, -0.12 + roll, 0.55 + 0.45 * p);
    // rim light on top edges
    glow(ctx, 585, 840, 160, 'rgba(255,190,110,0.5)', 0.4);
    PP.richSteam(ctx, T, 63, 560, 930, 260, 900, 0.22, { n: 10, col: '#c9b8a8', drift: 0.05 });
    PP.richSteam(ctx, T + 1, 64, 260, 960, 180, 800, 0.18, { n: 8, col: '#c9b8a8', drift: -0.05 });
  });
  embers(ctx, T, 65, 60, 540, 1250, 1100, 1200, 1);
  // foreground out-of-focus embers
  bokeh(ctx, T, 66, 8, ['rgb(255,140,50)', 'rgb(255,190,90)'], 0.3, 20, 60);
  flare(ctx, 600, 760, 1.2, 0.3 + 0.1 * Math.sin(T * 5));
  X.caption(ctx, T, 15.3, 17.8, 'Nướng hành, gừng', 'Char the onion & ginger', { n: 1 });
}

// ---------- S7 18–21 top-down small pan toasting spices, smoke threads ----------
function s7(ctx, lt, p, T) {
  // dark wooden board / stove top
  fill(ctx, '#2a1a10', '#140b06');
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 3;
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(0, i * 150 + 30); ctx.bezierCurveTo(300, i * 150 + 10, 700, i * 150 + 60, W, i * 150 + 30); ctx.stroke(); }
  ctx.restore();
  const z = lerp(1.0, 1.08, ease.inOut(p));
  const toss = bump(lt, 1.5, 0.5);                                    // little pan flip on the beat 19.5
  cam(ctx, 540, 880, z, lerp(-0.04, 0.03, p), () => {
    const cx = 540 + toss * 14, cy = 860 - toss * 20, R = 400;
    // fire glow ring under the pan
    glow(ctx, cx, cy, R * 1.5, 'rgba(255,110,30,0.6)', 0.55 + 0.1 * Math.sin(T * 7));
    // handle (to bottom-right)
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#1b1715'; ctx.lineWidth = 56; ctx.beginPath(); ctx.moveTo(cx + R * 0.7, cy + R * 0.7); ctx.lineTo(cx + R * 1.5, cy + R * 1.55); ctx.stroke();
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 44; ctx.beginPath(); ctx.moveTo(cx + R * 1.0, cy + R * 1.02); ctx.lineTo(cx + R * 1.55, cy + R * 1.6); ctx.stroke(); ctx.restore();
    // iron pan
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    const rg = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); rg.addColorStop(0, '#5a5550'); rg.addColorStop(0.5, '#25221f'); rg.addColorStop(1, '#0e0c0b');
    ctx.fillStyle = rg; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.88, 0, TAU);
    const ig = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, 10, cx, cy, R * 0.88); ig.addColorStop(0, '#3a3430'); ig.addColorStop(1, '#151210');
    ctx.fillStyle = ig; ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,150,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R * 0.96, 3.6, 5.2); ctx.stroke();
    // spices: jiggle + hop on the toss
    const r = rng(71), tk = 0.25 + 0.6 * p;
    const items = [];
    for (let i = 0; i < 6; i++) items.push(['anise', 1.25 + r() * 0.3]);
    for (let i = 0; i < 4; i++) items.push(['cinn', 1.0 + r() * 0.2]);
    for (let i = 0; i < 4; i++) items.push(['card', 1.0 + r() * 0.2]);
    for (let i = 0; i < 14; i++) items.push(['clove', 1.3 + r() * 0.3]);
    items.forEach(([kind, s], i) => {
      const a = r() * TAU + lt * 0.15, d = Math.sqrt(r()) * R * 0.72, rot = r() * TAU + lt * 0.3 * (r() - 0.5) + toss * (r() - 0.5) * 3;
      const hop = 1 + toss * (0.15 + r() * 0.25);
      const jx = Math.sin(T * 11 + i) * 1.5, jy = Math.cos(T * 13 + i) * 1.5;
      const px = cx + Math.cos(a) * d + jx + toss * (r() - 0.5) * 60, py = cy + Math.sin(a) * d + jy - toss * r() * 40;
      if (toss > 0.05) { ctx.save(); ctx.globalAlpha = 0.35 * toss; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(px + 10, py + 14 + toss * 30, 30 * s, 20 * s, 0, 0, TAU); ctx.fill(); ctx.restore(); }
      if (kind === 'anise') PP.starAnise(ctx, px, py, s * hop, rot, { toast: tk });
      else if (kind === 'cinn') PP.cinnamonStick(ctx, px, py, s * hop, rot);
      else if (kind === 'card') PP.cardamom(ctx, px, py, s * hop, rot);
      else PP.clove(ctx, px, py, s * hop, rot);
    });
    // heat shimmer sheen
    glow(ctx, cx - R * 0.3, cy - R * 0.3, R * 0.6, 'rgba(255,220,180,0.25)', 0.35);
  });
  // fragrant smoke threads (thin curling wisps drifting up/away)
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
  const r2 = rng(72);
  for (let i = 0; i < 12; i++) {
    const sx = 540 + (r2() - 0.5) * 520, sy = 880 + (r2() - 0.5) * 420, ph = r2() * TAU, len = 260 + r2() * 360, drift = (r2() - 0.4) * 1.6;
    ctx.strokeStyle = `rgba(235,225,215,${0.12 + 0.08 * r2()})`; ctx.lineWidth = 5 + r2() * 6;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    for (let q = 1; q <= 24; q++) {
      const u = q / 24, yy = sy - u * len - (T * 40 % 40), xx = sx + Math.sin(u * 6 + T * 1.6 + ph) * 40 * u + drift * u * 200;
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
  PP.richSteam(ctx, T, 73, 540, 900, 500, 900, 0.18, { n: 10, col: '#d8cfc6', drift: 0.08 });
  dust(ctx, T, 74, 40, 100, 300, 880, 1100, '255,220,180', 2.4, 0.4);
  X.caption(ctx, T, 18.3, 20.8, 'Rang hoa hồi, quế', 'Toast star anise & cinnamon', { n: 2 });
}

// ---------- S8 21–24 beef bones drop into the giant pot on the beat ----------
function s8(ctx, lt, p, T) {
  const hits = [0.0, 0.75, 1.5, 2.25];
  let sh = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.3) sh = Math.max(sh, (1 - d / 0.3) * 16); }
  ctx.save(); shake(ctx, sh, T);
  // warm stall back wall, out of focus
  fill(ctx, '#4a2414', '#160a05');
  bokeh(ctx, T, 81, 14, ['rgb(255,180,100)', 'rgb(255,140,70)', 'rgb(255,220,160)'], 0.3, 40, 110);
  ctx.fillStyle = 'rgba(40,18,8,0.5)'; ctx.fillRect(0, 560, W, 14); ctx.fillRect(0, 760, W, 14);
  glow(ctx, 540, 820, 700, 'rgba(255,160,80,0.5)', 0.45);
  const z = lerp(1.0, 1.06, p);
  cam(ctx, 540, 1060, z, 0, () => {
    const s = 1.75, px = 540, py = 1780;
    const info = PP.giantPot(ctx, px, py, s, { lid: 'off', simmer: 0.7, t: T, steam: 0.6, clarity: 0.4, skim: 0.2 });
    const rimY = info.rimY, R = info.R;
    // falling bones (land on each beat), clipped by the front rim as they sink
    hits.forEach((h, i) => {
      const fallT = 0.38, u = (lt - (h - fallT)) / fallT;
      if (u < 0 || u > 1.35) return;
      const r = rng(800 + i), x = px + (r() - 0.5) * R * 0.9, rot0 = r() * TAU;
      const y = u <= 1 ? lerp(rimY - 1400, rimY - 40, u * u) : rimY - 40 + (u - 1) * 380;
      ctx.save();
      ctx.beginPath(); ctx.rect(-500, -2000, 2200, rimY + 2000 - 10);
      ctx.ellipse(px, rimY, R - 4, (R - 4) * 0.28, 0, 0, Math.PI, true);
      ctx.clip();
      PP.beefBone(ctx, x, y, 1.75, rot0 + u * 2.4, { view: 'side' });
      ctx.restore();
    });
    // splashes
    hits.forEach((h, i) => {
      const d = lt - h; if (d < 0 || d > 0.9) return;
      const r = rng(800 + i), x = px + (r() - 0.5) * R * 0.9;
      flakes(ctx, lt, h, 820 + i, 26, x, rimY - 10, { g: 1800, speed: 900, life: 0.8, spread: 1.6, size: 9, colors: ['#ffd48a', '#f0a850', '#fff0c8', '#e08a30'] });
      const k = clamp(d / 0.5);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = 'rgba(255,230,170,0.9)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(x, rimY + 6, 40 + k * 140, (40 + k * 140) * 0.25, 0, 0, TAU); ctx.stroke(); ctx.restore();
      // crown splash
      const ck = bump(d, 0, 0.35);
      if (ck > 0) {
        ctx.save(); ctx.fillStyle = 'rgba(255,214,140,0.85)';
        for (let q = 0; q < 9; q++) { const a = Math.PI + (q + 0.5) / 9 * Math.PI, hh = (60 + 50 * Math.sin(q * 2.1)) * ck; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 60, rimY + Math.sin(a) * 12 - hh / 2, 7, hh / 2, Math.cos(a) * 0.4, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    });
  });
  ctx.restore();
  dust(ctx, T, 83, 30, 100, 300, 880, 1100, '255,225,180', 2.4, 0.4);
  X.caption(ctx, T, 21.3, 23.8, 'Xương bò vào nồi', 'Beef bones in the pot', { n: 3 });
}

// ---------- S9 24–27 close: ladle skims the foam, broth turns clear ----------
function s9(ctx, lt, p, T) {
  const clarity = ease.inOut(p), skim = 1 - ease.inOut(clamp(p * 1.15));
  // inner pot wall
  fill(ctx, '#3a3a3e', '#7a7a80', 0, 600);
  const z = lerp(1.0, 1.1, ease.inOut(p));
  cam(ctx, 540, 1000, z, 0, () => {
    at(ctx, 540, 1060, 0, 1, 0.62, () => PP.potTop(ctx, 0, 0, 980, { rim: false, clarity, skim, simmer: 0.8, t: T, fat: 0.4 + 0.6 * clarity }));
    // back wall rim highlight
    ctx.save(); ctx.strokeStyle = 'rgba(255,240,220,0.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(540, 1060, 980, 980 * 0.62, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.restore();
    // ladle sweeping arcs, skimming
    const a = lerp(-2.6, 0.2, ease.inOut(clamp(lt / 1.4))) + (lt > 1.4 ? lerp(0, -2.0, ease.inOut(clamp((lt - 1.4) / 1.4))) : 0);
    const lx = 540 + Math.cos(a) * 330, ly = 1060 + Math.sin(a) * 200;
    const s = 2.3;
    // ripple wake
    ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) { const ph = (T * 1.5 + i / 3) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.ellipse(lx, ly + 20, 150 + ph * 220, (150 + ph * 220) * 0.3, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
    PP.ladle(ctx, lx, ly, s, 0.55, { fill: 0.6, tip: -0.15 });
    // foam collected in the cup
    const fk = 1 - skim * 0.3;
    ctx.save(); ctx.fillStyle = `rgba(206,186,160,${0.9 * fk})`;
    const fr = rng(91);
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(lx + (fr() - 0.5) * 90 * s * 0.8, ly + (fr() - 0.5) * 22 * s * 0.6, (12 + fr() * 14) * s, (6 + fr() * 6) * s, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  });
  PP.richSteam(ctx, T, 93, 540, 1200, 700, 1100, 0.4, { n: 16 });
  glow(ctx, 300, 700, 500, 'rgba(255,200,130,0.4)', 0.35);
  dust(ctx, T, 94, 30, 100, 300, 880, 1100, '255,235,200', 2.2, 0.35);
  X.caption(ctx, T, 24.3, 26.8, 'Hớt bọt', 'Skim for a clear broth', { n: 4 });
}

// ---------- S10 27–30.75 locked-off time-lapse: night passes, pot simmers ----------
function rooster(ctx, x, y, s, k) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = '#120e18';
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 30, -0.1, 0, TAU); ctx.fill();                       // body
    ctx.beginPath(); ctx.moveTo(-30, -6); ctx.quadraticCurveTo(-80, -60, -60, 10); ctx.quadraticCurveTo(-50, -20, -30, 10); ctx.fill(); // tail
    ctx.beginPath(); ctx.moveTo(-40, -10); ctx.quadraticCurveTo(-95, -30, -70, 20); ctx.lineTo(-40, 6); ctx.fill();
    const hr = -0.5 * k;                                                                            // head up when crowing
    at(ctx, 30, -18, hr, 1, 1, () => {
      ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(4, -34); ctx.lineTo(22, -30); ctx.lineTo(18, 6); ctx.closePath(); ctx.fill(); // neck
      ctx.beginPath(); ctx.arc(14, -36, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a1c18'; ctx.beginPath(); ctx.moveTo(4, -46); ctx.lineTo(10, -58); ctx.lineTo(16, -48); ctx.lineTo(22, -58); ctx.lineTo(26, -44); ctx.closePath(); ctx.fill(); // comb
      ctx.fillStyle = '#120e18'; ctx.beginPath(); ctx.moveTo(25, -40); ctx.lineTo(38 + 4 * k, -38 - 6 * k); ctx.lineTo(26, -34); ctx.fill();
      if (k > 0) { ctx.beginPath(); ctx.moveTo(25, -34); ctx.lineTo(36, -26 + 4 * k); ctx.lineTo(26, -31); ctx.fill(); }
    });
    ctx.strokeStyle = '#120e18'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-6, 26); ctx.lineTo(-8, 52); ctx.moveTo(10, 26); ctx.lineTo(12, 52); ctx.stroke();
  });
}
function s10(ctx, lt, p, T) {
  const k = p;
  PP.moonAndStars(ctx, T, k, { trails: 0.3 + 0.7 * p });
  // dawn glow creeping in at the end
  const dk = inv(0.7, 1, p);
  if (dk > 0) { const hg = ctx.createLinearGradient(0, 500, 0, 1250); hg.addColorStop(0, 'rgba(120,90,170,0)'); hg.addColorStop(0.6, `rgba(230,130,130,${0.45 * dk})`); hg.addColorStop(1, `rgba(255,175,110,${0.85 * dk})`); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H); glow(ctx, 760, 1180, 900, 'rgba(255,150,80,0.7)', dk * 0.8); glow(ctx, 760, 1210, 360, 'rgba(255,215,150,0.9)', dk * 0.7); }
  // drifting time-lapse clouds (fast)
  ctx.save();
  const cr = rng(101);
  for (let i = 0; i < 5; i++) {
    const y = 300 + cr() * 600, sp = 500 + cr() * 500, x = ((cr() * 2000 + lt * sp) % 2200) - 600, w = 400 + cr() * 400;
    ctx.globalAlpha = 0.18 + 0.1 * dk; PP.fog(ctx, 0, 110 + i, y - 60, 120, 0, '#b0b4d8');
    const g = ctx.createRadialGradient(x, y, 10, x, y, w * 0.5); g.addColorStop(0, `rgba(${dk > 0.3 ? '220,170,170' : '140,150,200'},0.45)`); g.addColorStop(1, 'rgba(140,150,200,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.25); ctx.translate(-x, -y); ctx.fillRect(x - w, y - w, w * 2, w * 2); ctx.restore();
  }
  ctx.restore();
  // rooftop silhouettes of the old quarter
  ctx.save();
  const sr = rng(102);
  ctx.fillStyle = '#0a0b1a';
  let x = -20;
  const roofs = [];
  while (x < W + 40) { const w = 110 + sr() * 120, h = 1130 + sr() * 100; roofs.push([x, w, h]); x += w; }
  for (const [rx, w, h] of roofs) {
    ctx.beginPath(); ctx.moveTo(rx, H); ctx.lineTo(rx, h + 40); ctx.lineTo(rx + w * 0.15, h); ctx.lineTo(rx + w * 0.85, h); ctx.lineTo(rx + w, h + 40); ctx.lineTo(rx + w, H); ctx.closePath(); ctx.fill();
  }
  // windows flicking on/off as hours pass
  for (const [rx, w, h] of roofs) {
    for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) {
      const wx = rx + w * (0.22 + i * 0.36), wy = h + 90 + j * 120, on = Math.sin((wx * 0.37 + wy) * 1.3 + Math.floor(T * 6) * 2.1) > 0.55;
      ctx.fillStyle = on ? 'rgba(255,200,120,0.85)' : 'rgba(40,44,70,0.9)'; ctx.fillRect(wx, wy, w * 0.18, 52);
    }
  }
  ctx.restore();
  // rooster on a roof crowing at 30.2
  const rk = bump(lt, 3.15, 0.55);
  let rf = roofs[0]; for (const q of roofs) if (q[0] > 560 && q[0] + q[1] < 1000 && q[2] < rf[2] + (rf === roofs[0] ? 9999 : 0)) rf = q;
  const rX = rf[0] + rf[1] * 0.5, rY = rf[2] - 30;
  rooster(ctx, rX, rY - 20, 1.6, rk);
  if (rk > 0) PP.soundRings(ctx, rX + 95, rY - 125, inv(3.15, 3.7, lt), { n: 3, R: 220, dir: -0.7, spread: 1.6 });
  // clock spinning through the night (18:00 -> 6:00)
  const hours = 18 + 12 * ease.inOut(p);
  PP.clockFace(ctx, 540, 860, 150, hours, { blur: 1.5 });
  // giant pot simmering in the stall glow, bottom
  glow(ctx, 540, 1700, 700, 'rgba(255,140,60,0.6)', 0.7);
  PP.giantPot(ctx, 540, 1960, 1.05, { lid: 'off', simmer: 0.9, t: T * 4, steam: 1 });
  // dark scrim behind the caption band so it reads over windows & steam
  { const sg = ctx.createLinearGradient(0, 1270, 0, 1540); sg.addColorStop(0, 'rgba(6,7,20,0)'); sg.addColorStop(0.45, 'rgba(6,7,20,0.62)'); sg.addColorStop(1, 'rgba(6,7,20,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 1270, W, 270); }
  // time-lapse exposure flicker
  const fl = Math.sin(Math.floor(T * 12) * 12.9898) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(0,0,10,${0.05 * fl})`; ctx.fillRect(0, 0, W, H);
  X.caption(ctx, T, 27.3, 30.5, 'Ninh 12 tiếng', 'Simmer all night', { n: 5 });
}

module.exports = { s1, s2, s3, s4, s5, s6, s7, s8, s9, s10 };
