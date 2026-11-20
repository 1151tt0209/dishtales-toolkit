// shotsA.js — writer A: s1..s5 of "Cút lộn xào me" (hook, crack eggs, tamarind sauce, gag 1, garlic + wok).
// sN(ctx, lt, p, T): lt = T - shot start. Every call paints a full opaque 1080x1920 frame. No text.
// Event times are LOCAL (lt) constants at the top of each shot (absolute = shot start + lt).
const L = require('./lib');
const P = require('./a_props');
const X = require('./a_extra');
const CL = require('./cl_food');
const CT = require('./ctprops');
const PE = require('./people');
const { W, H, TAU, rng, clamp, lerp, ease } = L;
const PI = Math.PI;

// ---------------------------------------------------------------- helpers
const cam = (ctx, cx, cy, z, rot, fn) => L.cam(ctx, clamp(cx, 540 / z, W - 540 / z), clamp(cy, 960 / z, H - 960 / z), Math.max(1, z), rot, fn);
const iv = (a, b, v) => clamp((v - a) / (b - a));                       // 0..1 between a and b
const hit = (lt, tb, d = 0.25) => (lt < tb || lt > tb + d) ? 0 : Math.pow(1 - (lt - tb) / d, 2); // decaying pulse
const hits = (lt, list, d) => list.reduce((m, tb) => Math.max(m, hit(lt, tb, d)), 0);
const shake = (lt, k, seed = 1) => [Math.sin(lt * 71 + seed) * k, Math.cos(lt * 59 + seed * 2) * k];
const hand = (lt, s = 1, seed = 3) => [Math.sin(lt * 1.3 + seed) * 6 * s + Math.sin(lt * 2.9 + seed) * 3 * s, Math.cos(lt * 1.1 + seed) * 5 * s + Math.sin(lt * 3.3) * 2 * s];
const black = (ctx, a) => { if (a <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); };

// whip pan: draw the scene into a reused buffer, then smear shifted copies (dir: -1 = to the left)
function whip(ctx, k, dir, draw) {
  if (k <= 0.01) { draw(ctx); return; }
  const [bc, bx] = L.buffer('a_whip');
  bx.save(); draw(bx); bx.restore();
  const D = 520 * k * k;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bc, dir * D * 0.5, 0);
  ctx.fillStyle = '#000'; if (dir < 0) ctx.fillRect(W + dir * D * 0.5, 0, D, H); else ctx.fillRect(0, 0, D * 0.5, H);
  ctx.drawImage(bc, dir * D * 0.5 + (dir < 0 ? W : -W), 0); // wrap the edge so no black bar appears
  for (let i = 1; i <= 5; i++) { ctx.globalAlpha = 0.32 * (1 - i / 6); ctx.drawImage(bc, dir * D * (0.5 - i * 0.16), 0); ctx.drawImage(bc, dir * D * (0.5 - i * 0.16) + (dir < 0 ? W : -W), 0); }
  ctx.globalAlpha = 0.18 * k; ctx.fillStyle = '#fff2dc'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ================================================================ S1  HOOK  0.000–1.875
// flare 0.25 · toss 0.65 / 1.05 (airborne) · landings 0.95 / 1.35 · whoosh 1.75 (whip 1.70→)
const E1 = { flare: 0.25, toss: [0.65, 1.05], land: [0.95, 1.35], whoosh: 1.75 };
const S1 = (() => {
  const r = rng(101), eggs = [];
  const slots = [[-210, -38], [-60, -58], [95, -45], [235, -20], [-150, 32], [10, 22], [170, 40]];
  slots.forEach(([dx, dy], i) => eggs.push({ dx, dy, rot: (r() - 0.5) * 0.9, seed: 11 + i, h: 300 + r() * 240, sx: (r() - 0.5) * 120, spin: (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.9), d: r() * 0.04, toss: i % 3 === 2 ? [0] : i % 3 === 1 ? [1] : [0, 1] }));
  const leaves = []; for (let i = 0; i < 6; i++) leaves.push({ sx: (r() - 0.5) * 520, h: 380 + r() * 300, rot: r() * TAU, spin: (r() - 0.5) * 9, seed: 30 + i, toss: i % 2 });
  const drops = []; for (let i = 0; i < 26; i++) drops.push({ sx: (r() - 0.5) * 560, h: 260 + r() * 360, sz: 5 + r() * 9, d: r() * 0.08, toss: i % 2, x0: (r() - 0.5) * 420 });
  return { eggs, leaves, drops };
})();
const WX = 540, WY = 1130, WR = 470, WK = 0.42;
function s1core(ctx, lt, o = {}) {
  const flare = o.thumb ? 0.55 : hit(lt, E1.flare, 0.7);
  const land = hits(lt, E1.land, 0.22), tossK = hits(lt, E1.toss, 0.22);
  const [shx, shy] = shake(lt, land * 14 + flare * 6, 1);
  const z = lerp(1.03, 1.16, ease.inOut(clamp(lt / 1.875)));
  ctx.drawImage(P.nightBG(1), 0, 0);
  cam(ctx, 540 + shx, 1010 + shy, z, 0, () => {
    ctx.drawImage(P.nightBG(1), 0, 0);
    // wok motion: a jerk up/forward at each toss, settle with a bounce on landing
    let wy = 0, wr = 0;
    for (const tb of E1.toss) { const u = iv(tb - 0.08, tb + 0.06, lt), b = iv(tb + 0.06, tb + 0.3, lt); wy += -46 * Math.sin(u * PI * 0.5) * (1 - ease.out(b)); wr += -0.05 * Math.sin(u * PI * 0.5) * (1 - ease.out(b)); }
    for (const tb of E1.land) { wy += 18 * hit(lt, tb, 0.18); }
    const wx = WX, wyy = WY + wy, fk = 1 + flare * 1.5 + land * 0.4;
    // fire bed behind
    P.fire(ctx, wx, 1585, 1050, 760, lt, fk * 0.85, { seed: 5, n0: 10, n1: 8, n2: 5, alpha: 0.6 });
    ctx.drawImage(X.stoveTop(1580), 0, 0);
    X.burner(ctx, wx, 1600, 300, lt, 1 + flare);
    P.warmLight(ctx, wx, 1350, 900, 0.25 + flare * 0.3);
    P.wokBack(ctx, wx, wyy, WR, WK, { rot: wr, fire: 1 });
    ctx.save(); ctx.translate(wx, wyy); ctx.rotate(wr);
    P.saucePool(ctx, 0, 20, 360, 130, lt, 1, { seed: 9, n: 10 });
    // eggs resting (or in the pool)
    const air = [];
    S1.eggs.forEach((e, i) => {
      let fly = null;
      for (const ti of e.toss) { const tb = E1.toss[ti] + e.d, u = (lt - tb) / 0.3; if (u > 0 && u < 1) fly = { u, ti }; }
      if (fly && !o.thumbStill) { air.push([e, fly]); return; }
      let sq = 1; for (const ti of e.toss) sq -= 0.22 * hit(lt, E1.toss[ti] + e.d + 0.3, 0.2);
      CL.cutLon(ctx, e.dx, e.dy + 10, 1.95, { state: 'fried', rot: e.rot, seed: e.seed, glaze: 1, herb: 0.5, squash: sq, t: lt });
    });
    // sizzle in the pool (always on, bursts on landings)
    CT.sizzle(ctx, lt, 0, 20, 0.35 + land * 1.4, { r: 330, ryr: 0.36, n: 30, spat: 14, s: 1.4, seed: 7 });
    for (const tb of E1.land) P.splash(ctx, 0, 0, (lt - tb) / 0.4, 26, 13, '#8a3c14', 3 + tb * 10, 0.4);
    ctx.restore();
    P.wokFront(ctx, wx, wyy, WR, WK, { rot: wr, fire: 1 + flare * 0.5, handleAng: 0.12 });
    // flames licking up in front of the belly
    P.fire(ctx, wx, 1602, 640, 300, lt + 3, 0.85 + flare * 0.6 + land * 0.3, { seed: 8, blue: 1, n0: 8, n1: 7, n2: 5, alpha: 0.7 });
    X.burner(ctx, wx, 1600, 300, lt, 1 + flare, { front: true });
    // airborne: glaze drops, rau răm, eggs
    ctx.save(); ctx.translate(wx, wyy); ctx.rotate(wr);
    for (const d of S1.drops) {
      const tb = E1.toss[d.toss] + d.d, u = (lt - tb) / 0.42; if (u <= 0 || u >= 1) continue;
      const px = d.x0 + d.sx * u, py = -40 - 4 * d.h * u * (1 - u) + u * 120;
      ctx.globalAlpha = 1 - u * 0.6; ctx.fillStyle = '#7a3010'; P.ell(ctx, px, py, d.sz, d.sz * 1.25); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,170,0.9)'; P.ell(ctx, px - d.sz * 0.3, py - d.sz * 0.4, d.sz * 0.3, d.sz * 0.25); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const lf of S1.leaves) {
      const tb = E1.toss[lf.toss] + 0.02, u = (lt - tb) / 0.5; if (u <= 0 || u >= 1) continue;
      CL.ramLeaf(ctx, lf.sx * u, -30 - 4 * lf.h * u * (1 - u) + u * 60, 1.8, { rot: lf.rot + lf.spin * u, seed: lf.seed });
    }
    for (const [e, f] of air) {
      const u = f.u, px = e.dx + e.sx * Math.sin(u * PI) * 0.6, py = e.dy + 10 - 4 * e.h * u * (1 - u);
      // soft glaze trail
      ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = '#a8501c'; ctx.lineWidth = 34; ctx.lineCap = 'round';
      const u2 = Math.max(0, u - 0.08), qx = e.dx + e.sx * Math.sin(u2 * PI) * 0.6, qy = e.dy + 10 - 4 * e.h * u2 * (1 - u2);
      ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke(); ctx.restore();
      CL.cutLon(ctx, px, py, 1.95 + 0.25 * Math.sin(u * PI), { state: 'fried', rot: e.rot + e.spin * u * PI, seed: e.seed, glaze: 1, herb: 0.5, shadow: false, t: lt });
    }
    ctx.restore();
    // glints, steam, sparks
    CT.glazeSparkle(ctx, lt, wx, wyy + 10, 300, 0.8, { n: 6, ryr: 0.4, seed: 51, size: 1.0 });
    CT.steam(ctx, lt, { x: wx, y: wyy - 40, w: 620, h: 760, n: 16, s: 2.2, warm: 0.85, alpha: 0.75, seed: 4 });
    CT.sparks(ctx, lt, { x: wx, y: wyy + 80, w: 1000, h: 1000, n: 50, s: 1.5, k: 0.8, seed: 21 });
    CT.sparks(ctx, lt, { x: wx, y: wyy, w: 600, h: 900, n: 90, s: 1.8, k: 1, seed: 22, t0: E1.flare });
    if (flare > 0.01) P.fire(ctx, wx - 40, wyy + 40, 620, 1000 * Math.sqrt(flare), lt * 1.3, 1.1, { seed: 13, n0: 8, n1: 7, n2: 5, alpha: Math.min(1, flare * 1.3) });
  });
  // lens flare + warm bloom (screen space)
  if (flare > 0.02) L.flare(ctx, 380, 860, 1.6, flare * 0.85);
  P.warmLight(ctx, 540, 1100, 800, 0.12 + flare * 0.25);
}
function s1(ctx, lt) {
  const wk = clamp((lt - 1.70) / 0.175);
  whip(ctx, ease.in(wk), -1, (c) => s1core(c, lt));
  black(ctx, 1 - ease.out(clamp(lt / 0.25)));
}
function thumbDraw(ctx, T = 0.8) { s1core(ctx, T, { thumb: true }); }

// ================================================================ placeholders (filled below)
// ================================================================ S2  STEAMER → CRACK → BOWL  1.875–5.625
// lid 0.225 · egg picked 0.725 · taps 1.125 / 1.525 · crack-peel 2.025 · plops 2.525 / 2.925 / 3.325   (local)
const E2 = { lid: 0.225, pick: 0.725, taps: [1.125, 1.525], peel: 2.025, plops: [2.525, 2.925, 3.325] };
const POT = { x: 290, y: 880, R: 250, k: 0.36 }, BOWL = { x: 730, y: 1400, R: 235, k: 0.36 };
const EGS = 2.1; // hero egg scale
const POT_EGGS = (() => { const r = rng(202), a = []; for (let i = 0; i < 9; i++) a.push([(i % 3 - 1) * 120 + (r() - 0.5) * 40, -40 + Math.floor(i / 3) * 34 + (r() - 0.5) * 10, (r() - 0.5) * 0.8, 40 + i]); return a; })();
const BOWL_EGGS = [[-70, -6, -0.25], [62, -14, 0.3], [-4, 26, 0.05]];
const rot2 = (a, x, y) => [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
function crackLines(ctx, x, y, s, k, seed) { // zig-zag crack ring around the upper egg (k 0..1 grows)
  if (k <= 0) return; const r = rng(seed), n = 9, yy = y - 26 * s;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = []; for (let i = 0; i <= n; i++) { const u = i / n, ang = PI * (1 - u); pts.push([x + Math.cos(ang) * 34 * s, yy + Math.sin(ang) * 6 * s + (i % 2 ? -5 : 5) * s * (0.6 + r() * 0.6)]); }
  const m = Math.max(1, Math.round(n * k));
  for (const [col, lw] of [['rgba(70,45,25,0.8)', 2.6 * s], ['rgba(255,245,225,0.7)', 1 * s]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] + (lw < 2 * s ? 1.5 * s : 0));
    for (let i = 1; i <= m; i++) ctx.lineTo(pts[i][0], pts[i][1] + (lw < 2 * s ? 1.5 * s : 0)); ctx.stroke();
  }
  // little branch cracks
  ctx.strokeStyle = 'rgba(70,45,25,0.7)'; ctx.lineWidth = 1.8 * s;
  for (let i = 1; i < m; i += 2) { const [px, py] = pts[i]; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (r() - 0.5) * 10 * s, py - (6 + r() * 8) * s); ctx.stroke(); }
  ctx.restore();
}
function s2(ctx, lt) {
  const E = E2;
  // camera: pot (lid) → egg (taps) → bowl (plops)
  const a = ease.inOut(iv(0.6, 1.05, lt)), b = ease.inOut(iv(2.15, 2.75, lt));
  let cx = lerp(lerp(390, 560, a), 720, b), cy = lerp(lerp(860, 990, a), 1330, b), z = lerp(lerp(1.25, 1.42, a), 1.62, b) + 0.03 * Math.sin(lt * 0.9) + 0.04 * iv(2.75, 3.75, lt);
  const tap = hits(lt, E.taps, 0.12) + hit(lt, E.peel, 0.12) * 0.6, plop = hits(lt, E.plops, 0.18);
  const [hx, hy] = hand(lt, 1, 5), [sx, sy] = shake(lt, tap * 4 + plop * 6, 3);
  ctx.drawImage(P.nightBG(2), 0, 0);
  cam(ctx, cx + hx + sx, cy + hy + sy, z, 0, () => {
    ctx.drawImage(P.nightBG(2), 0, 0);
    ctx.drawImage(P.steelCounter(800), 0, 0);
    P.warmLight(ctx, 120, 760, 700, 0.35);                     // wok fire off-screen left
    P.warmLight(ctx, 1080, 600, 600, 0.18, '255,70,170');     // pink neon from the right
    // ---- steamer pot + lid
    P.potBody(ctx, POT.x, POT.y, POT.R, POT.k, { inside: (c) => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, POT.R); g.addColorStop(0, 'rgba(255,240,210,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-POT.R, -POT.R, POT.R * 2, POT.R * 2);
      POT_EGGS.forEach(([ex, ey, er, sd], i) => { if (i === 4 && lt >= E.pick) return; CL.cutLon(c, ex, ey, 1.45, { state: 'whole', rot: er, seed: sd, shadow: false }); });
    } });
    // lid: rattles, then lifted up-left by a grip hand, then out of frame
    const lu = ease.inOut(iv(E.lid, E.lid + 0.42, lt)), lo = ease.in(iv(E.lid + 0.42, E.lid + 0.75, lt));
    const rattle = lt < E.lid ? Math.sin(lt * 90) * 2.5 : 0;
    const lx = lerp(lerp(POT.x, 130, lu), -260, lo), ly = lerp(lerp(POT.y + rattle, 560, lu), 380, lo), lr = lerp(lerp(0, -0.55, lu), -0.9, lo);
    // steam: gentle seep, huge burst on lid lift (lit warm by the fire)
    const burst = lt > E.lid ? Math.exp(-(lt - E.lid) * 1.6) : 0;
    CT.steam(ctx, lt, { x: POT.x, y: POT.y, w: 380, h: 700 + burst * 300, n: 22, s: 2 + burst * 1.4, warm: 0.7, alpha: 0.35 + burst * 0.9, seed: 12 });
    if (lx > -400) {
      P.potLid(ctx, lx, ly, POT.R, POT.k, lr);
      const [kx, ky] = rot2(lr, 0, -0.36 * POT.R), gx = lx + kx, gy = ly + ky, hr = PI / 2 + lr, hs = 1.55;
      const wx = gx - Math.cos(hr) * 70 * hs, wy = gy - Math.sin(hr) * 70 * hs;
      const enter = ease.out(iv(-0.05, 0.2, lt));
      ctx.save(); ctx.translate(0, (1 - enter) * -500);
      P.arm(ctx, wx - 260, wy - 520, wx, wy, hs, { sleeve: 0.55 }); P.hand(ctx, wx, wy, hs, hr, { pose: 'grip' });
      ctx.restore();
    }
    if (burst > 0.02) { // bright firelit puff in front of the lid
      CT.steam(ctx, lt, { x: POT.x + 20, y: POT.y - 10, w: 480, h: 820, n: 18, s: 2.8, warm: 0.85, alpha: Math.min(1, burst * 1.1), seed: 13 });
      P.warmLight(ctx, POT.x, POT.y - 200, 380, burst * 0.35, '255,225,180');
    }
    // rau răm sprigs scattered on the counter
    for (const [lx2, ly2, lr2, sd] of [[470, 1585, -0.6, 81], [520, 1630, 0.9, 82], [985, 1570, 2.2, 83], [1030, 1615, -2.6, 84], [940, 1640, 0.4, 85]]) CL.ramLeaf(ctx, lx2, ly2, 1.7, { rot: lr2, seed: sd });
    // ---- bowl (back)
    const bowlIn = (c) => { const g = c.createRadialGradient(0, BOWL.R * 0.1, 0, 0, 0, BOWL.R); g.addColorStop(0, 'rgba(190,150,90,0.55)'); g.addColorStop(1, 'rgba(120,80,40,0.35)'); c.fillStyle = g; P.ell(c, 0, BOWL.R * 0.12, BOWL.R * 0.8, BOWL.R * BOWL.k * 0.65); c.fill(); };
    P.bowlBack(ctx, BOWL.x, BOWL.y, BOWL.R, BOWL.k, { inside: bowlIn });
    BOWL_EGGS.forEach(([dx, dy, rr], i) => {
      const tb = E.plops[i]; if (lt < tb) return;
      const sq = 1 - 0.28 * hit(lt, tb, 0.2) + 0.08 * hit(lt, tb + 0.1, 0.2);
      CL.cutLon(ctx, BOWL.x + dx, BOWL.y + dy - 30, 1.75, { state: 'open', rot: rr, seed: 60 + i, squash: sq });
    });
    P.bowlFront(ctx, BOWL.x, BOWL.y, BOWL.R, BOWL.k, { warm: 1 });
    CT.steam(ctx, lt, { x: BOWL.x, y: BOWL.y - 40, w: 320, h: 560, n: 12, s: 1.6, warm: 0.8, alpha: 0.55 * iv(2.45, 3.0, lt), seed: 14 });
    E.plops.forEach((tb, i) => { const [dx, dy] = BOWL_EGGS[i]; P.splash(ctx, BOWL.x + dx, BOWL.y + dy - 10, (lt - tb) / 0.4, 12, 10, 'rgba(230,200,150,0.9)', 70 + i, 0.35); });
    // ---- falling eggs 2 & 3 (dropped from her hand above frame)
    for (let i = 1; i < 3; i++) {
      const tb = E.plops[i], u = (lt - (tb - 0.28)) / 0.28; if (u <= 0 || u >= 1) continue;
      const [dx, dy, rr] = BOWL_EGGS[i], px = BOWL.x + dx, py = lerp(600, BOWL.y + dy - 30, u * u);
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#e8dcc0'; P.ell(ctx, px, py - 60 * u, 30, 70 * u); ctx.fill(); ctx.restore();
      CL.cutLon(ctx, px, py, 1.75, { state: 'open', rot: rr + (1 - u) * 0.6, seed: 60 + i, shadow: false });
    }
    // ---- hero egg: picked from the pot → held centre → carried to the bowl → dropped
    const HX = 570, HY = 1010;
    let ex, ey, er = 0, held = true;
    const pu = ease.inOut(iv(E.pick, E.pick + 0.32, lt)), cu = ease.inOut(iv(2.12, 2.42, lt));
    if (lt < E.pick) { ex = POT.x + POT_EGGS[4][0]; ey = POT.y + POT_EGGS[4][1]; }
    else { ex = lerp(POT.x + POT_EGGS[4][0], HX, pu); ey = lerp(POT.y + POT_EGGS[4][1], HY, pu) - Math.sin(pu * PI) * 90; }
    if (lt > 2.12) { ex = lerp(HX, BOWL.x + BOWL_EGGS[0][0], cu); ey = lerp(HY, 1180, cu); er = cu * BOWL_EGGS[0][2]; }
    if (lt > 2.42) { held = false; const fu = clamp((lt - 2.42) / (E.plops[0] - 2.42)); ey = lerp(1180, BOWL.y + BOWL_EGGS[0][1] - 30, fu * fu); }
    const hs2 = 1.75, hr2 = -0.62 + 0.1 * Math.sin(lt * 1.7);
    const tip = [ex - 40 * EGS * 0.55, ey + 30 * EGS * 0.6];
    const [tx, ty] = rot2(hr2, 112 * hs2, -6 * hs2), wx2 = tip[0] - tx, wy2 = tip[1] - ty;
    const handIn = ease.out(iv(E.pick - 0.3, E.pick - 0.02, lt)), handOut = ease.in(iv(2.42, 2.62, lt));
    const showHand = lt > E.pick - 0.3 && handOut < 1;
    const hOff = (1 - handIn) * 420;
    const drawArm = (pass) => { ctx.save(); ctx.translate(-hOff * 0.6 - handOut * 500, hOff - handOut * 700); if (pass === 'back') P.arm(ctx, wx2 - 330, wy2 + 420, wx2, wy2, hs2 * 1.05, { sleeve: 0.5 }); P.hand(ctx, wx2, wy2, hs2, hr2, { pose: 'pinch', pass }); ctx.restore(); };
    if (showHand) drawArm('back');
    if (lt >= E.pick && lt < E.plops[0]) {
      const open = lt >= E.peel, es = lerp(1.45, EGS, pu);
      CL.cutLon(ctx, ex, ey, es, { state: open ? 'open' : 'whole', rot: er, seed: 44, squash: 1 - 0.06 * tap, shadow: false });
      if (!open && lt > E.taps[0]) crackLines(ctx, ex, ey, EGS, iv(E.taps[0], E.taps[0] + 0.08, lt) * 0.55 + iv(E.taps[1], E.taps[1] + 0.08, lt) * 0.45, 9);
    }
    if (showHand && held) drawArm('front');
    // shell cap flick at the peel
    if (lt >= E.peel && lt < E.peel + 0.6) {
      const u = (lt - E.peel) / 0.6;
      CL.eggCap(ctx, HX + 20 + 260 * u, HY - 46 * EGS - 380 * u + 700 * u * u, EGS, { rot: u * 7, seed: 44 });
      CT.sparks(ctx, lt, { x: HX, y: HY - 46 * EGS, w: 120, h: 100, n: 10, s: 1, k: 0.6, seed: 31, t0: E.peel });
    }
    // ---- spoon in the right hand: enter, tap, tap, pry the cap, exit
    const contact = [HX + 18, HY - 50 * EGS], rest = [contact[0] + 110, contact[1] - 120];
    let sp = 0; // 0 rest .. 1 contact
    for (const tb of [...E.taps, E.peel]) { sp = Math.max(sp, ease.in(iv(tb - 0.13, tb, lt)) * (lt <= tb ? 1 : 0), lt > tb ? 1 - ease.out(iv(tb, tb + 0.2, lt)) : 0); }
    const sIn = ease.out(iv(0.75, 1.0, lt)), sOut = ease.in(iv(E.peel + 0.12, E.peel + 0.45, lt));
    if (sIn > 0 && sOut < 1) {
      const off = (1 - sIn) * 520 + sOut * 600, srot = -0.35 - 0.25 * sp + (lt > E.peel ? -0.5 * ease.out(iv(E.peel, E.peel + 0.12, lt)) : 0);
      const bx = lerp(rest[0], contact[0], sp) + off, by = lerp(rest[1], contact[1], sp) - off * 0.2, ss = 1.55;
      const [gx, gy] = rot2(srot, 150 * ss, 0), hx3 = bx + gx, hy3 = by + gy, hr3 = srot - PI / 2 - 0.1, hs3 = 1.75;
      const wx3 = hx3 - Math.cos(hr3) * 70 * hs3, wy3 = hy3 - Math.sin(hr3) * 70 * hs3;
      P.arm(ctx, wx3 + 360, wy3 + 380, wx3, wy3, hs3 * 1.05, { sleeve: 0.5 });
      P.hand(ctx, wx3, wy3, hs3, hr3, { pose: 'grip', mirror: 1, pass: 'back' });
      P.spoon(ctx, bx, by, ss, srot);
      P.hand(ctx, wx3, wy3, hs3, hr3, { pose: 'grip', mirror: 1, pass: 'front' });
      if (tap > 0.05) P.warmLight(ctx, contact[0], contact[1], 90, tap * 0.5, '255,240,210');
    }
  });
  // carry-over smear from s1's whip
  if (lt < 0.15) { const k = 1 - ease.out(lt / 0.15); ctx.save(); ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#fff2dc'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}
// ================================================================ S3  TAMARIND SAUCE (top-down, slow rotation)  5.625–9.375
// pour 0.275–0.875 · mash 1.275 / 1.575 / 1.875 · strain 2.175–2.875 · sugar 3.075 · fish sauce 3.375   (local)
const E3 = { pour: [0.275, 0.875], mash: [1.275, 1.575, 1.875], strain: [2.175, 2.875], sugar: 3.075, fish: 3.375 };
const BA = { x: 540, y: 740, R: 250 }, BB = { x: 540, y: 1290, R: 260 }, SVR = 172;
const MASH_PTS = [[-50, -20], [60, 25], [-5, -55]];
const SUGAR = (() => { const r = rng(303), a = []; for (let i = 0; i < 70; i++) { const ang = r() * TAU, d = Math.sqrt(r()) * 42; a.push([Math.cos(ang) * d, Math.sin(ang) * d * 0.9, 3 + r() * 3, r()]); } return a; })();
const press = (lt, list, a = 0.15, b = 0.2) => list.reduce((m, tb) => Math.max(m, lt <= tb ? ease.in(iv(tb - a, tb, lt)) : 1 - ease.out(iv(tb, tb + b, lt))), 0);
function s3(ctx, lt) {
  const E = E3;
  const pan = ease.inOut(iv(1.98, 2.32, lt));
  const endZ = ease.inOut(iv(2.95, 3.75, lt)), z = 1.3 + 0.04 * Math.sin(lt * 0.8) + 0.25 * endZ;
  const rotc = lerp(-0.045, 0.06, lt / 3.75);
  const mashD = press(lt, E.mash), mashHit = hits(lt, E.mash, 0.16);
  const [sx, sy] = shake(lt, mashHit * 6, 4), [hx, hy] = hand(lt, 0.6, 9);
  ctx.fillStyle = '#1a2034'; ctx.fillRect(0, 0, W, H);
  cam(ctx, 540 + sx + hx, lerp(770, 1190, pan) + 100 * endZ + sy + hy, z, rotc, () => {
    ctx.drawImage(P.boardTop(), 540 - 1200, 1010 - 1200);
    P.warmLight(ctx, 160, 600, 900, 0.22);                       // fire glow from the stove side
    P.warmLight(ctx, 1000, 1500, 700, 0.12, '255,70,170');
    // ---- bowl B (receives the strained sauce) + sieve
    const lb = ease.out(iv(2.25, 3.0, lt)) * 0.85;
    const sOut = ease.in(iv(2.92, 3.12, lt));
    P.bowlTop(ctx, BB.x, BB.y, BB.R, { inside: (c) => {
      P.liquidTop(c, BB.R, lb, ['#a5521c', '#4c1a06'], lt);
      if (lb > 0) { // thick glossy sheen + drips landing from the sieve
        c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(255,170,90,0.25)'; P.ell(c, -40, -60, 90, 22, -0.5); c.fill(); c.restore();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.4, tb = 2.3 + i * 0.09; for (let k = 0; k < 4; k++) if (tb + k * 0.33 < 2.85) X.ripple(c, Math.cos(a) * 185, Math.sin(a) * 185, 40, (lt - tb - k * 0.33) / 0.5, '255,190,130'); }
        // sugar mound dissolving
        if (lt > E.sugar - 0.02) { const dk = iv(E.sugar + 0.1, E.sugar + 0.65, lt); for (const [gx, gy, gs, gr] of SUGAR) { c.globalAlpha = (1 - dk) * (gr < dk ? 0.3 : 0.95); c.fillStyle = '#fffaf0'; c.fillRect(-90 + gx * (1 + dk * 0.6) - gs / 2, -50 + gy * (1 + dk * 0.6) - gs / 2, gs, gs); } c.globalAlpha = 1; X.ripple(c, -90, -50, 70, (lt - E.sugar) / 0.5, '255,240,220'); }
        // fish sauce ripples
        if (lt > E.fish) for (let k = 0; k < 3; k++) X.ripple(c, 60, -40, 60, (lt - E.fish - k * 0.12) / 0.45, '255,210,140');
      }
    } });
    if (sOut < 1) {
      const pk = ease.out(iv(2.25, 2.85, lt)), off = sOut * 900;
      ctx.save(); ctx.translate(off, -off * 0.25);
      P.sieve(ctx, BB.x, BB.y, SVR, 0.32, { inside: (c) => {
        if (pk <= 0) return;
        c.globalAlpha = pk; const g = c.createRadialGradient(-30, -30, 10, 0, 0, SVR); g.addColorStop(0, '#8a4416'); g.addColorStop(1, '#3e1604'); c.fillStyle = g; P.ell(c, 0, 0, SVR * 0.85 * Math.sqrt(pk), SVR * 0.85 * Math.sqrt(pk)); c.fill();
        P.tamarindLumps(c, 0, 0, SVR * 0.95, lt, { squish: 1, seed: 47, n: 8 }); c.globalAlpha = 1;
      } });
      // grip on the sieve handle (arm from lower right)
      const [hdx, hdy] = rot2(0.32, SVR * 1.9, 0), gx = BB.x + hdx, gy = BB.y + hdy, hs = 1.7, hr = 0.32 - PI / 2;
      const [fx, fy] = rot2(hr, 70 * hs, 0), wx = gx - fx, wy = gy - fy;
      const hk = (1 - ease.out(iv(1.95, 2.15, lt))) * 700; if (hk < 690) { ctx.save(); ctx.translate(hk * 0.4, hk); P.arm(ctx, wx + 200, wy + 560, wx, wy, hs, { sleeve: 0.55 }); P.hand(ctx, wx, wy, hs, hr, { pose: 'grip' }); ctx.restore(); }
      ctx.restore();
    }
    // ---- bowl A: tamarind + hot water → mashed → lifted to pour through the sieve → away
    const lift = ease.inOut(iv(2.0, 2.22, lt)), away = ease.in(iv(2.88, 3.08, lt));
    const ax = lerp(BA.x, 590, lift), ay = lerp(BA.y, 900, lift) - away * 1100, as = 1 + 0.12 * lift;
    const lw = ease.out(iv(0.32, 0.95, lt)) * 0.82 * (1 - 0.7 * iv(2.175, 2.875, lt));
    const mc = E.mash.reduce((m, tb) => m + ease.out(iv(tb, tb + 0.12, lt)), 0) / 3;
    if (away < 1) {
      ctx.save(); ctx.translate(ax, ay); ctx.scale(as, as);
      P.bowlTop(ctx, 0, 0, BA.R, { inside: (c) => {
        const tilt = lift * 60; c.translate(0, tilt);
        P.tamarindLumps(c, 0, 0, BA.R * (1 - 0.3 * lift), lt, { squish: mc, seed: 41, n: 11 });
        c.globalAlpha = 1 - mc * 0.75; P.liquidTop(c, BA.R, lw, ['rgba(226,160,90,0.42)', 'rgba(150,84,36,0.55)'], lt);
        c.globalAlpha = mc * 0.92; P.liquidTop(c, BA.R, lw, ['#9a4c1a', '#4e1c06'], lt); c.globalAlpha = 1;
        if (lt > E.pour[0]) for (let k = 0; k < 5; k++) X.ripple(c, 60, -10, 90, (lt - E.pour[0] - k * 0.14) / 0.5, '255,240,220');
        E.mash.forEach((tb, i) => { const [mx, my] = MASH_PTS[i]; X.ripple(c, mx, my, 80, (lt - tb) / 0.45, '255,190,130'); P.splash(c, mx, my, (lt - tb) / 0.35, 10, 9, '#6a2a0c', 90 + i, 0.9); });
      } });
      // holding hands while lifted
      if (lift > 0) {
        const hs = 1.7; ctx.globalAlpha = 1;
        P.arm(ctx, -BA.R - 560, 140, -BA.R - 90, 10, hs, { sleeve: 0.55 }); P.hand(ctx, -BA.R - 90, 10, hs, -0.05, { pose: 'hold', curl: 0.7 });
        P.arm(ctx, BA.R + 560, 160, BA.R + 90, 20, hs, { sleeve: 0.55 }); P.hand(ctx, BA.R + 90, 20, hs, PI + 0.05, { pose: 'hold', curl: 0.7, mirror: 1 });
      }
      ctx.restore();
    }
    // steam off the hot water
    CT.steam(ctx, lt, { x: ax, y: ay + 120, w: 420, h: 520, n: 10, s: 1.4, warm: 0.65, alpha: 0.4 * iv(0.4, 1.0, lt) * (1 - away), seed: 33 });
    // strain stream: A's lower rim → sieve
    const st = iv(E.strain[0] - 0.05, E.strain[0] + 0.05, lt) * (1 - iv(E.strain[1] - 0.1, E.strain[1], lt));
    if (st > 0) {
      const x0 = ax - 20, y0 = ay + BA.R * as * 0.8, x1 = BB.x - 10, y1 = BB.y - 30;
      P.stream(ctx, x0, y0, x0 - 10, (y0 + y1) / 2, x1, y1, 46 * st, 34 * st, '#6e2c0c', 'rgba(255,190,120,0.65)', lt);
      P.splash(ctx, x1, y1, ((lt - E.strain[0]) % 0.3) / 0.3, 8, 9, '#6e2c0c', 7 + Math.floor((lt - E.strain[0]) / 0.3), 0.8);
    }
    // ---- kettle pours hot water
    const kIn = ease.out(iv(0.0, 0.26, lt)), kOut = ease.in(iv(0.9, 1.15, lt));
    if (kIn > 0 && kOut < 1) {
      const off = (1 - kIn) * 600 + kOut * 700, tip = [700 + off * 0.75, 560 - off * 0.65];
      const pf = iv(E.pour[0], E.pour[0] + 0.08, lt) * (1 - iv(E.pour[1] - 0.06, E.pour[1], lt));
      if (pf > 0) {
        P.stream(ctx, tip[0], tip[1], tip[0] - 30, tip[1] + 60, 610, 730, 22 * pf, 18 * pf, 'rgba(225,238,255,0.55)', 'rgba(255,255,255,0.85)', lt);
        P.splash(ctx, 610, 730, ((lt - E.pour[0]) % 0.25) / 0.25, 10, 8, 'rgba(235,245,255,0.8)', 5 + Math.floor((lt - E.pour[0]) / 0.25), 0.8);
      }
      X.kettle(ctx, tip[0], tip[1], 1.55, PI - 0.75 + 0.12 * pf);
    }
    // ---- mashing claw hand (from lower right)
    const mIn = ease.out(iv(1.0, 1.2, lt)), mOut = ease.in(iv(1.98, 2.15, lt));
    if (mIn > 0 && mOut < 1) {
      let ti = 0; for (let i = 0; i < 3; i++) if (lt > E.mash[i] - 0.25) ti = i;
      const nx = ti < 2 ? iv(E.mash[ti] + 0.12, E.mash[ti + 1] - 0.15, lt) : 0;
      const [m0x, m0y] = MASH_PTS[ti], [m1x, m1y] = MASH_PTS[Math.min(2, ti + 1)];
      const tx = BA.x + lerp(m0x, m1x, ease.inOut(nx)), ty = BA.y + lerp(m0y, m1y, ease.inOut(nx));
      const hs = 2.0 - 0.22 * mashD, hr = -2.3, off = (1 - mIn) * 600 + mOut * 700;
      const [fx, fy] = rot2(hr, 112 * hs, 0), wx = tx - fx + off * 0.6, wy = ty - fy + off;
      // soft contact shadow
      const sg = ctx.createRadialGradient(tx + 20, ty + 30, 10, tx + 20, ty + 30, 160 * (1.2 - mashD * 0.4)); sg.addColorStop(0, `rgba(30,10,0,${0.25 + 0.3 * mashD})`); sg.addColorStop(1, 'rgba(30,10,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(tx - 200, ty - 200, 450, 450);
      P.arm(ctx, wx + 330, wy + 520, wx, wy, hs, { sleeve: 0.5 }); P.hand(ctx, wx, wy, hs, hr, { pose: 'claw', curl: 0.7 + 0.6 * mashD });
    }
    // ---- sugar spoon (from the left)
    const gIn = ease.out(iv(2.85, 3.0, lt)), gOut = ease.in(iv(3.18, 3.38, lt));
    if (gIn > 0 && gOut < 1) {
      const off = (1 - gIn) * 600 + gOut * 600, tipK = ease.out(iv(E.sugar - 0.06, E.sugar + 0.06, lt));
      P.spoon(ctx, BB.x - 90 - off, BB.y - 60 - 20 * tipK, 1.9 - 0.15 * tipK, PI - 0.15 + 0.35 * tipK, { heap: lt < E.sugar });
      if (lt > E.sugar - 0.04 && lt < E.sugar + 0.25) { const u = iv(E.sugar - 0.04, E.sugar + 0.25, lt); for (const [gx, gy, gs] of SUGAR.slice(0, 30)) { ctx.globalAlpha = 1 - u; ctx.fillStyle = '#fffaf0'; ctx.fillRect(BB.x - 90 + gx * (0.5 + u), BB.y - 60 + gy * (0.5 + u) + u * 10, gs, gs); } ctx.globalAlpha = 1; }
    }
    // ---- fish sauce bottle (from the upper right)
    const fIn = ease.out(iv(3.1, 3.3, lt));
    if (fIn > 0) {
      const off = (1 - fIn) * 700, mx = BB.x + 120 + off * 0.8, my = BB.y - 90 - off * 0.6, pf = iv(E.fish, E.fish + 0.06, lt);
      if (pf > 0) P.stream(ctx, mx, my, mx - 20, my + 20, BB.x + 60, BB.y - 40, 12 * pf, 10 * pf, 'rgba(196,108,40,0.95)', 'rgba(255,220,160,0.8)', lt);
      P.bottle(ctx, mx, my, 1.7, -2.2 - 0.25 * pf, 'fish');
    }
    CT.steam(ctx, lt, { x: BB.x, y: BB.y + 100, w: 380, h: 520, n: 10, s: 1.3, warm: 0.7, alpha: 0.35 * iv(2.6, 3.2, lt), seed: 34 });
  });
}
// ================================================================ S4  GAG 1: THE BALUT REVEAL  9.375–13.125 (3.75 s)
// enter 0.225 · peek 1.125 · egg up 1.625 (insert CU) · gasp 2.025 (face CU) · stagger 2.425 · stars 2.625 · fan whoosh 3.025 / 3.425
const E4 = { enter: 0.225, peek: 1.125, eggUp: 1.625, gasp: 2.025, stagger: 2.425, stars: 2.625, fans: [3.025, 3.425] };
const VEND = { x: 515, y: 1150, s: 0.66 }, TS = 1.08, TY = 1292;
// head pose of PE.tourist (mirrors people.js geometry) -> [hx, hy, rot] in the caller's coords
function touristHead(x, y, s, st) {
  const bob = st.walk != null ? Math.abs(Math.sin(st.walk)) * -6 : 0, ln = -0.06 + (st.lean || 0);
  const rot = (px, py) => [px * Math.cos(ln) - py * Math.sin(ln), px * Math.sin(ln) + py * Math.cos(ln)];
  const a = rot(0, -150), b = rot(-6, -52);
  return [x + (a[0] + b[0]) * s, y + (-205 + bob + a[1] + b[1]) * s, ln * 0.5 + (st.look || 0)];
}
function touristS4(lt) {
  const wk = iv(E4.enter, 1.0, lt), x0 = lerp(1190, 800, ease.out(wk));
  const st = { walk: wk > 0 && wk < 1 ? (1190 - x0) * 0.055 : null, smile: lt > 0.9 && lt < 2.0 };
  const pk = ease.inOut(iv(E4.peek - 0.12, E4.peek + 0.2, lt));
  st.lean = -0.24 * pk; st.look = -0.12 * pk;
  let x = x0;
  if (lt >= 2.3) { // shocked: pulled upright, then the stagger back + a woozy sway
    const sk = lt - E4.stagger, sg = ease.out(iv(E4.stagger, E4.stagger + 0.35, lt));
    x = 800 + 80 * sg;
    st.lean = 0.14 + (sk > 0 ? 0.2 * Math.sin(sk * 11) * Math.exp(-sk * 3) : 0) + 0.07 * Math.sin(lt * 4.5) * iv(2.7, 3.0, lt) + 0.06 * hits(lt, E4.fans, 0.35);
    st.look = -0.05 + 0.08 * Math.sin(lt * 3.7) * iv(2.6, 2.9, lt);
    st.raise = 0.35 * sg;
  }
  return [x, st];
}
// big cartoon eyes + "o" mouth over the profile head (wide shot reaction)
function touristShock(ctx, x, y, s, st, lt) {
  const [hx, hy, r] = touristHead(x, y, s, st), dz = iv(E4.stars, E4.stars + 0.2, lt);
  ctx.save(); ctx.translate(hx, hy); ctx.rotate(r); ctx.scale(s, s);
  ctx.fillStyle = '#fff'; P.ell(ctx, -19, -2, 11, 13); ctx.fill();
  if (dz > 0) { // swirly dizzy pupil
    ctx.strokeStyle = '#1f2a33'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 26; i++) { const a = i * 0.55 + lt * 9, rr = i * 0.32; ctx.lineTo(-19 + Math.cos(a) * rr, -2 + Math.sin(a) * rr); } ctx.stroke();
  } else { ctx.fillStyle = '#1f2a33'; P.ell(ctx, -22, -2, 3.2, 3.6); ctx.fill(); }
  ctx.fillStyle = '#5a2228'; P.ell(ctx, -23, 23, 6, 8 * (1 - 0.3 * dz)); ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,40,0.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-32, -22); ctx.quadraticCurveTo(-20, -30, -8, -24); ctx.stroke(); // raised brow
  // sweat drop
  const sw = iv(2.45, 2.7, lt); if (sw > 0) { ctx.fillStyle = 'rgba(190,230,255,0.85)'; ctx.beginPath(); ctx.moveTo(18, -30 + sw * 14); ctx.quadraticCurveTo(26, -14 + sw * 14, 18, -10 + sw * 14); ctx.quadraticCurveTo(10, -14 + sw * 14, 18, -30 + sw * 14); ctx.fill(); }
  ctx.restore();
  return [hx, hy];
}
function s4wide(ctx, lt) {
  const late = lt >= 2.3, stag = hit(lt, E4.stagger, 0.35);
  const push = ease.inOut(iv(0.9, 1.6, lt));
  const [hx, hy] = hand(lt, 1, 4), [sx, sy] = shake(lt, stag * 12 + hits(lt, E4.fans, 0.2) * 4, 6);
  const cx = late ? 700 : lerp(610, 655, push), cy = late ? 930 : lerp(910, 930, push), z = late ? 1.52 + 0.06 * iv(2.4, 3.75, lt) : lerp(1.34, 1.62, push);
  ctx.fillStyle = '#0f1c2e'; ctx.fillRect(0, 0, W, H);
  cam(ctx, cx + hx + sx, cy + hy + sy, z, 0.012 * Math.sin(lt * 0.9), () => {
    CT.alley(ctx, lt, { view: 'wide', layer: 'back', neon: 0, steam: 0.6 });
    X.neonSign(ctx, lt, 1);
    // Cô Năm behind the counter
    const neon = { col: 'pink', k: 0.55, x: 330, y: 590 }, light = { x: 250, y: 960, k: 0.55, r: 420 };
    let fanA = null;
    if (lt < 1.2) CT.coNam(ctx, VEND.x, VEND.y, VEND.s, { pose: 'stand', t: lt, expr: 'smile', lookX: 0.7, neon, light, shadow: false });
    else if (lt < 2.85) {
      const k = ease.out(iv(1.2, 1.55, lt));
      CT.coNam(ctx, VEND.x, VEND.y, VEND.s, { pose: 'plate', k, t: lt, expr: 'grin', lookX: 0.8, neon, light, shadow: false,
        plateFn: (c, p) => {
          X.balut(c, p.x, p.y - 46 * p.s, 0.3 * p.s, { t: lt, cup: 1 });
          const g = hit(lt, 1.45, 0.3); if (g > 0) L.sparkle(c, p.x - 10 * p.s, p.y - 50 * p.s, 30 * g, g);
        } });
    } else {
      const a = CT.coNam(ctx, VEND.x, VEND.y, VEND.s, { pose: 'fan', k: 0.85, t: lt, expr: 'grin', neon, light, shadow: false });
      fanA = a.fan;
    }
    ctx.drawImage(X.cartLayer(), 0, 0);
    X.cartLive(ctx, lt);
    // the tourist
    const [tx, st] = touristS4(lt);
    PE.tourist(ctx, tx, TY, TS, st);
    if (late) {
      const [qx, qy] = touristShock(ctx, tx, TY, TS, st, lt);
      X.softStars(ctx, lt, qx + 6, qy - 58 * TS, TS * 0.95, ease.out(iv(E4.stars, E4.stars + 0.25, lt)));
      if (fanA) {
        const fk = 0.35 + hits(lt, E4.fans, 0.3);
        CT.fanWhoosh(ctx, lt, fanA.grip[0], fanA.grip[1], fk, { r: 60, a0: -0.9, a1: 0.5, s: 1, seed: 64 });
        // gusts toward his face on each whoosh
        for (const tb of E4.fans) {
          const u = (lt - tb) / 0.4; if (u <= 0 || u >= 1) continue;
          ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(230,240,255,${0.55 * (1 - u)})`; ctx.lineWidth = 4;
          for (let i = 0; i < 3; i++) { const yy = qy - 20 + i * 22, x0 = lerp(fanA.center[0] + 20, qx - 60, u), x1 = x0 + 70; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.quadraticCurveTo((x0 + x1) / 2, yy - 12, x1, yy + 2); ctx.stroke(); }
          ctx.restore();
        }
      }
    }
  });
  // blurred foreground + neon wash (screen space)
  ctx.save(); ctx.globalAlpha = 0.9; ctx.drawImage(X.fgAlley(), -hx * 2.2 - 40, -hy * 2.2 + 30); ctx.restore();
}
// insert 1: the cracked balut held up close
function s4egg(ctx, lt) {
  const u = iv(E4.eggUp, 1.975, lt), rise = ease.out(iv(E4.eggUp, E4.eggUp + 0.16, lt));
  const es = 2.9 + 0.25 * u, ex = 560 + 10 * Math.sin(lt * 3), ey = lerp(1500, 880, rise) - 30 * u;
  cam(ctx, 540, 960, 1.04 + 0.06 * u, 0, () => { ctx.drawImage(P.nightBG(3), 0, 0); });
  P.warmLight(ctx, 300, 700, 900, 0.3);
  L.glow(ctx, ex, ey - 60, 520, 'rgba(255,90,190,0.8)', 0.25);
  const hs = es * 0.85, wx = ex + 4 * es, wy = ey + 128 * es + 62 * hs;
  P.arm(ctx, wx + 140, wy + 700, wx, wy, hs, { sleeve: 0.55 });
  P.hand(ctx, wx, wy, hs, -PI / 2, { pose: 'grip', pass: 'back' });
  X.balut(ctx, ex, ey, es, { t: lt, blink: lt > 1.86 && lt < 1.92, cup: 1 });
  P.hand(ctx, wx, wy, hs, -PI / 2, { pose: 'grip', pass: 'front' });
  const g = Math.max(hit(lt, 1.72, 0.3), 0.15); L.sparkle(ctx, ex - 45 * es, ey - 30 * es, 70 * g, g);
  CT.steam(ctx, lt, { x: ex, y: ey - 40 * es, w: 300, h: 600, n: 8, s: 1.3, warm: 0.8, alpha: 0.4, seed: 41 });
}
// insert 2: the tourist's face — curious → GASP
function s4face(ctx, lt) {
  const g = ease.out(iv(E4.gasp, E4.gasp + 0.08, lt)), sh = hit(lt, E4.gasp, 0.35);
  const [sx, sy] = shake(lt, sh * 16, 8);
  const z = 1.02 + 0.08 * g + 0.02 * iv(1.975, 2.4, lt);
  cam(ctx, 540, 960, z, 0, () => { ctx.drawImage(P.nightBG(2), 0, 0); });
  L.glow(ctx, 120, 700, 700, 'rgba(255,80,190,0.9)', 0.3 + 0.2 * g);
  L.glow(ctx, 980, 1100, 600, 'rgba(255,170,80,0.9)', 0.25);
  PE.face(ctx, 540 + sx, 860 + sy - 30 * g, 2.15 * z, {
    turn: -0.15, lookX: lerp(-0.25, 0, g), lookY: lerp(0.35, 0, g), open: lerp(1, 1.55, g), pupil: lerp(0.65, 0.38, g),
    brow: 1.3 * g, mouth: g > 0.25 ? 'o' : 'smile', mOpen: g, hairLift: g, t: lt,
  });
  if (sh > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = sh * 0.25; ctx.fillStyle = '#fff2dc'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}
function s4(ctx, lt) {
  if (lt >= E4.eggUp && lt < 1.975) s4egg(ctx, lt);
  else if (lt >= 1.975 && lt < 2.4) s4face(ctx, lt);
  else s4wide(ctx, lt);
}
// ================================================================ S5  WOK: OIL → GARLIC/SHALLOT → STIR → FLARE → EGGS  13.125–16.875
// oil 0.275 · garlic 0.675 · stir clinks 1.075 / 1.475 / 1.875 / 2.275 · flare 2.775 · eggs slide 3.175   (local)
const E5 = { oil: 0.275, garlic: 0.675, stirs: [1.075, 1.475, 1.875, 2.275], flare: 2.775, eggs: 3.175 };
const W5 = { x: 540, y: 1120, R: 450, k: 0.5 };
const S5 = (() => {
  const r = rng(505), bits = [];
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 0.78;
    bits.push({ a, d, kind: r() < 0.55 ? 0 : 1, rot: r() * TAU, sz: 7 + r() * 5, dl: r() * 0.22, sx: (r() - 0.5) * 120 });
  }
  const eggs = [[-40, -10, -0.3, 81], [30, -26, 0.25, 82], [-6, 18, 0.1, 83], [62, 4, -0.15, 84], [-78, 14, 0.35, 85]];
  const pile = []; for (let i = 0; i < 18; i++) pile.push([(r() - 0.5) * 150, (r() - 0.5) * 22 - 6, r() < 0.55 ? 0 : 1, r() * TAU, 7 + r() * 4]);
  return { bits, eggs, pile };
})();
function s5(ctx, lt) {
  const stirK = hits(lt, E5.stirs, 0.18), fl = hit(lt, E5.flare, 0.75), drop = hit(lt, E5.garlic + 0.18, 0.4);
  const eggLand = hit(lt, E5.eggs + 0.3, 0.35);
  const [shx, shy] = shake(lt, stirK * 5 + fl * 9 + eggLand * 7, 5);
  const [hx, hy] = hand(lt, 1, 9);
  // camera: medium → macro push (0.85–1.25) → slight pull/pan up-right for the egg bowl (2.95–3.25)
  const push = ease.inOut(iv(0.85, 1.25, lt)), pull = ease.inOut(iv(2.95, 3.25, lt));
  const z = lerp(1.04, 1.55, push) - 0.17 * pull + 0.02 * lt;
  const cx = lerp(540, 520, push) + 60 * pull, cy = lerp(1060, 1110, push) - 70 * pull;
  ctx.fillStyle = '#0f1c2e'; ctx.fillRect(0, 0, W, H);
  cam(ctx, cx + hx + shx, cy + hy + shy, z, 0.01 * Math.sin(lt * 0.8), () => {
    ctx.drawImage(P.nightBG(4), 0, 0);
    const wx = W5.x, wy = W5.y, R = W5.R, k = W5.k, fk = 1 + fl * 1.6 + drop * 0.3;
    P.fire(ctx, wx, 1640, 1100, 760, lt, fk * 0.85, { seed: 6, n0: 10, n1: 8, n2: 5, alpha: 0.6 });
    ctx.drawImage(X.stoveTop(1640), 0, 0);
    X.burner(ctx, wx, 1660, 300, lt, 1.2 + fl);
    P.warmLight(ctx, wx, 1350, 900, 0.25 + fl * 0.3);
    P.wokBack(ctx, wx, wy, R, k, { fire: 1 });
    // --- oil pool: grows from the pour, shimmers
    const oilA = ease.out(iv(E5.oil + 0.05, E5.oil + 0.45, lt));
    const gold = ease.inOut(iv(1.0, 2.6, lt));
    if (oilA > 0) {
      const pr = lerp(0.25, 1, oilA);
      P.saucePool(ctx, wx, wy + 30, 330 * pr, 150 * pr, lt, 0.95 * oilA, { light: '#f6c160', mid: '#a8661a', seed: 12, n: 12 });
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,240,190,${0.25 * oilA})`; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const yy = wy + 30 + (i - 2) * 34 * pr, ww = 240 * pr * (1 - Math.abs(i - 2) * 0.2);
        ctx.beginPath(); for (let j = 0; j <= 12; j++) { const xx = wx - ww + j * ww / 6, py = yy + Math.sin(lt * 9 + j * 1.3 + i) * 3; j ? ctx.lineTo(xx, py) : ctx.moveTo(xx, py); } ctx.stroke();
      }
      ctx.restore();
    }
    // --- garlic + shallot bits: fall in at 0.675, swirl with every stir, turn golden
    let swirl = 0; for (const tb of E5.stirs) swirl += 0.9 * ease.inOut(iv(tb - 0.12, tb + 0.14, lt));
    const list = [], air = [];
    for (const b of S5.bits) {
      const t0 = E5.garlic + b.dl, u = (lt - t0) / 0.28;
      if (u <= 0) continue;
      const a = b.a + swirl * (1.1 - b.d * 0.6), tx = wx + Math.cos(a) * 300 * b.d, ty = wy + 30 + Math.sin(a) * 135 * b.d;
      if (u < 1) { const sx = 760 + b.sx * 0.3, sy = 700; air.push([lerp(sx, tx, u) + Math.sin(u * PI) * b.sx * 0.3, lerp(sy, ty, u * u), b.kind, b.rot + u * 4, b.sz]); }
      else list.push([tx, ty, b.kind, b.rot + swirl * 1.5, b.sz]);
    }
    P.bits(ctx, list, gold, 1.25);
    const sz = (oilA > 0 ? 0.25 : 0) + drop * 1.3 + stirK * 0.6 + gold * 0.25 + eggLand;
    CT.sizzle(ctx, lt, wx, wy + 30, sz, { r: 300, ryr: 0.45, n: 34, spat: 18, s: 1.3, seed: 15 });
    for (let i = 0; i < 2; i++) P.splash(ctx, wx + (i ? 90 : -70), wy + 30, (lt - E5.garlic - 0.2 - i * 0.08) / 0.4, 16, 9, 'rgba(255,220,140,0.95)', 90 + i, 0.4);
    // --- eggs that already landed in the wok
    const ein = [];
    S5.eggs.forEach(([dx, dy, rr, sd], i) => {
      const t0 = E5.eggs + i * 0.07, u = (lt - t0) / 0.32;
      if (u >= 1) {
        CL.cutLon(ctx, wx + dx * 3.0, wy + 30 + dy * 1.5, 1.9, { state: 'open', rot: rr, seed: sd, squash: 1 - 0.2 * hit(lt, t0 + 0.32, 0.2), t: lt });
        P.splash(ctx, wx + dx * 3.0, wy + 60 + dy * 1.5, (u - 1) / 1.1, 12, 10, 'rgba(255,214,120,0.95)', sd, 0.4);
      } else ein.push([u, dx, dy, rr, sd]);
    });
    P.wokFront(ctx, wx, wy, R, k, { fire: 1 + fl * 0.6, handleAng: 0.14 });
    P.fire(ctx, wx, 1662, 660, 300, lt + 3, 0.85 + fl * 0.7, { seed: 9, blue: 1, n0: 8, n1: 7, n2: 5, alpha: 0.7 });
    X.burner(ctx, wx, 1660, 300, lt, 1.2 + fl, { front: true });
    P.bits(ctx, air, 0, 1.25);
    // --- the bowl of peeled eggs (enters 2.85, tilts 3.05–3.25, leaves 3.55)
    const bIn = ease.out(iv(2.85, 3.12, lt)), tilt = ease.inOut(iv(3.05, 3.25, lt)), bOut = ease.in(iv(3.55, 3.75, lt));
    if (bIn > 0) {
      const bx = lerp(1250, 860, bIn) + 300 * bOut, by = lerp(560, 760, bIn) - 200 * bOut, BR = 170;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.55 * tilt);
      P.bowlBack(ctx, 0, 0, BR, 0.36, { inside: (c) => { c.fillStyle = 'rgba(230,200,150,0.5)'; P.ell(c, 0, 10, BR * 0.8, BR * 0.24); c.fill(); } });
      ein.forEach(([u, dx, dy, rr, sd]) => { if (u > 0) return; CL.cutLon(ctx, dx * 1.2, dy * 0.6 - 18, 1.5, { state: 'open', rot: rr, seed: sd, shadow: false }); });
      P.bowlFront(ctx, 0, 0, BR, 0.36);
      ctx.restore();
      const lip = [bx - Math.cos(0.55 * tilt) * BR * 0.95, by + Math.sin(0.55 * tilt) * BR * 0.6 + 10];
      ein.forEach(([u, dx, dy, rr, sd]) => {
        if (u <= 0) return;
        const tx = wx + dx * 3.0, ty = wy + 30 + dy * 1.5;
        const px = lerp(lip[0], tx, u), py = lerp(lip[1], ty, u * u) - 80 * Math.sin(u * PI);
        CL.cutLon(ctx, px, py, lerp(1.5, 1.9, u), { state: 'open', rot: rr - (1 - u) * 1.2, seed: sd, shadow: false });
      });
    }
    // --- oil bottle pour (in 0–0.25, stream 0.27–0.6, out 0.62–0.85)
    const bt = ease.out(iv(0.0, 0.25, lt)) * (1 - ease.in(iv(0.62, 0.85, lt)));
    if (bt > 0) {
      const tip = ease.inOut(iv(0.12, E5.oil, lt)), mx = lerp(80, 330, bt), my = lerp(500, 720, bt);
      P.bottle(ctx, mx, my, 1.25, lerp(PI * 0.95, PI * 0.62, tip), 'oil');
      const sk = iv(E5.oil - 0.05, E5.oil + 0.02, lt) * (1 - iv(0.55, 0.62, lt));
      if (sk > 0) { const ex = wx - 40, ey = wy + 30; P.stream(ctx, mx + 6, my + 4, mx + 60, my + 60, ex, lerp(my, ey, sk), 16 * sk, 10 * sk, 'rgba(255,200,70,0.9)', 'rgba(255,250,220,0.8)', lt); }
    }
    // --- garlic dish (in 0.4–0.6, tips at 0.675, out 0.95–1.15)
    const gd = ease.out(iv(0.4, 0.6, lt)) * (1 - ease.in(iv(0.95, 1.15, lt)));
    if (gd > 0) {
      const gx = lerp(1200, 840, gd), gy = 650, ga = -0.7 * ease.inOut(iv(0.55, E5.garlic + 0.05, lt));
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(ga); ctx.scale(1.5, 1.5);
      const gg = ctx.createLinearGradient(-110, 0, 110, 0); gg.addColorStop(0, '#9aa3bf'); gg.addColorStop(0.35, '#f8f8fb'); gg.addColorStop(1, '#8a90a8');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, 0, 110, 26, 0, 0, PI); ctx.lineTo(-110, 0); ctx.fill();
      ctx.fillStyle = '#e6e7ef'; P.ell(ctx, 0, 0, 110, 24); ctx.fill();
      if (lt < E5.garlic + 0.1) P.bits(ctx, S5.pile, 0, 1.2);
      ctx.strokeStyle = '#3a6ad0'; ctx.lineWidth = 4; P.ell(ctx, 0, 0, 108, 23); ctx.stroke();
      ctx.restore();
    }
    // --- spatula: enters 0.9, sweeps through the pool on every stir (clink at the hit time), leaves 2.55
    const sp = ease.out(iv(0.9, 1.05, lt)) * (1 - ease.in(iv(2.55, 2.75, lt)));
    if (sp > 0) {
      let ang = 0, rot = -0.35;
      for (let i = 0; i < E5.stirs.length; i++) { const tb = E5.stirs[i], u = iv(tb - 0.16, tb + 0.18, lt), dir = i % 2 ? -1 : 1; ang += dir * Math.sin(u * PI) * 1.0; rot += dir * Math.sin(u * PI) * 0.25; }
      const sx = wx + 150 + Math.sin(ang) * 170 + (1 - sp) * 500, sy = wy + 40 + Math.cos(ang) * 30 - (1 - sp) * 220;
      P.spatula(ctx, sx, sy, 1.5, rot);
      const [ax, ay] = rot2(rot, 330 * 1.5, 0);
      P.arm(ctx, sx + ax + 380, sy + ay + 760, sx + ax + 30, sy + ay + 70, 1.5, { sleeve: 0.55 });
      P.hand(ctx, sx + ax + 30, sy + ay + 70, 1.5, rot - PI / 2 - 0.2, { pose: 'grip' });
      E5.stirs.forEach((tb, i) => { P.splash(ctx, sx - 30, sy + 10, (lt - tb) / 0.35, 14, 8, 'rgba(255,214,120,0.95)', 70 + i, 0.5); const g = hit(lt, tb, 0.2); if (g > 0) L.sparkle(ctx, sx + 40, sy - 30, 34 * g, g * 0.8); });
    }
    // --- steam, sparks, flare
    CT.steam(ctx, lt, { x: wx, y: wy - 20, w: 560, h: 760, n: 12, s: 2.0, warm: 0.85, alpha: 0.35 + drop * 0.5 + gold * 0.25, seed: 45 });
    CT.sparks(ctx, lt, { x: wx, y: wy + 60, w: 900, h: 1000, n: 40, s: 1.4, k: 0.6 + fl, seed: 23 });
    CT.sparks(ctx, lt, { x: wx, y: wy, w: 700, h: 900, n: 90, s: 1.8, k: 1, seed: 24, t0: E5.flare });
    if (fl > 0.01) {
      P.fire(ctx, wx + 60, wy + 60, 700, 1100 * Math.sqrt(fl), lt * 1.3, 1.1, { seed: 14, n0: 8, n1: 7, n2: 5, alpha: Math.min(1, fl * 1.3) });
      CT.flareUp(ctx, lt, wx + 240, wy + 20, iv(E5.flare, E5.flare + 0.7, lt), { s: 2.4, seed: 17 });
    }
  });
  if (fl > 0.02) L.flare(ctx, 700, 880, 1.6, fl * 0.85);
  P.warmLight(ctx, 540, 1100, 800, 0.1 + fl * 0.25 + drop * 0.1);
}

module.exports = { s1, s2, s3, s4, s5, thumbDraw, E1 };
