// hp_fx.js - hủ tiếu comedy props and effects. See the API header in hprops.js.
// Convention: every drawer here works in LOCAL coordinates (same space as its x,y args) and returns LOCAL points.
'use strict';
const L = require('./lib');
const NP = require('./nprops');
const { TAU, rng, clamp, lerp, ease, glow, at } = L;
const PI = Math.PI;
const { lgr, rgr, ell, rrect, outFill, rimLine, capFS, OUT } = NP;
const { LP } = require('./hp_food');

// ---------------------------------------------------------------- outlined bilingual text (vi big cream, en small white)
function biText(ctx, vi, en, x, y, sv = 34, se = 24, o = {}) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.font = `700 ${sv}px TitleSerif`; ctx.lineWidth = sv * 0.22; ctx.strokeStyle = o.stroke || 'rgba(40,20,20,0.8)'; ctx.strokeText(vi, x, y); ctx.fillStyle = o.viCol || '#ffe9b8'; ctx.fillText(vi, x, y);
  if (en) { ctx.font = `700 ${se}px BodySansBold`; ctx.lineWidth = se * 0.25; ctx.strokeText(en, x, y + se * 1.25); ctx.fillStyle = '#ffffff'; ctx.fillText(en, x, y + se * 1.25); }
  ctx.restore();
}

// ================================================================ selfie stick with a hand-written "1 TÔ / 1 BOWL" sign
// origin = the grip at the bottom of the stick; rot 0 = stick straight up (−y). s=1: stick 560 long, sign 240×170.
function selfieSign(ctx, x, y, s = 1, rot = 0, o = {}) {
  const t = o.t || 0, len = o.len ?? 560, sway = o.sway ?? (Math.sin(t * 2.6) * 0.1 + Math.sin(t * 4.1) * 0.03);
  const vi = o.vi ?? '1 TÔ', en = o.en ?? '1 BOWL', mp = LP(x, y, rot, s);
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round';
    // telescoping stick: 3 segments getting thinner
    const segs = [[0, 0.36, 15], [0.34, 0.7, 11], [0.68, 1, 8]];
    for (const [a, b, w] of segs) {
      ctx.strokeStyle = '#1a1b20'; ctx.lineWidth = w + 3; ctx.beginPath(); ctx.moveTo(0, -len * a); ctx.lineTo(0, -len * b); ctx.stroke();
      ctx.strokeStyle = lgr(ctx, -w / 2, 0, w / 2, 0, [[0, '#9aa3ad'], [0.35, '#e8edf2'], [1, '#4a5058']]); ctx.lineWidth = w; ctx.stroke();
    }
    // rubber grip + wrist strap
    rrect(ctx, -12, -6, 24, 110 * 0.9, 9); outFill(ctx, '#2a2b30', 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-10, i * 16); ctx.lineTo(10, i * 16); ctx.stroke(); }
    ctx.strokeStyle = '#e0533a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 96); ctx.quadraticCurveTo(-26 + Math.sin(t * 3) * 6, 140, 6, 150); ctx.stroke();
    // clamp + sign swinging at the tip
    at(ctx, 0, -len, sway, 1, 1, () => {
      ctx.fillStyle = '#26272c'; rrect(ctx, -26, -20, 52, 22, 6); ctx.fill();
      ctx.fillStyle = '#3a3b42'; rrect(ctx, -8, -34, 16, 18, 4); ctx.fill();
      // cardboard sign (slightly crooked, torn edge)
      at(ctx, 0, -110, -0.04, 1, 1, () => {
        ctx.fillStyle = 'rgba(20,30,50,0.25)'; rrect(ctx, -114, -78, 240, 172, 8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-120, -86); ctx.lineTo(118, -84);
        for (let i = 0; i <= 10; i++) ctx.lineTo(120 - (i % 2) * 3, -84 + i * 17);
        ctx.lineTo(-118, 86); ctx.lineTo(-121, -86); ctx.closePath();
        outFill(ctx, lgr(ctx, -120, -86, 120, 86, [[0, '#fffdf4'], [0.6, '#f6eed8'], [1, '#e2d4b2']]), 2.4);
        ctx.strokeStyle = 'rgba(160,130,90,0.25)'; ctx.lineWidth = 1.5; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-110, -86 + i * 30); ctx.lineTo(112, -86 + i * 30); ctx.stroke(); }
        // tape
        ctx.fillStyle = 'rgba(240,235,200,0.75)'; at(ctx, 0, -86, 0.05, 1, 1, () => { ctx.fillRect(-26, -10, 52, 20); });
        // hand-written marker text
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#c0261f'; ctx.font = '700 66px TitleSerif'; ctx.save(); ctx.translate(-4, -26); ctx.rotate(-0.05); ctx.fillText(vi, 0, 0); ctx.restore();
        ctx.fillStyle = '#1f2a44'; ctx.font = '700 38px BodySansBold'; ctx.save(); ctx.translate(2, 34); ctx.rotate(0.03); ctx.fillText(en, 0, 0); ctx.restore();
        // doodle bowl with steam + underline
        ctx.strokeStyle = '#1f2a44'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-60, 62); ctx.quadraticCurveTo(0, 70, 64, 60); ctx.stroke();
        ctx.beginPath(); ctx.arc(84, -40, 14, 0, PI); ctx.closePath(); ctx.stroke();
        for (const dx of [-5, 5]) { ctx.beginPath(); ctx.moveTo(84 + dx, -48); ctx.quadraticCurveTo(80 + dx, -56, 86 + dx, -64); ctx.stroke(); }
        rimLine(ctx, () => { ctx.moveTo(-118, -84); ctx.lineTo(116, -82); }, 'rgba(255,255,240,0.95)', 3);
      });
    });
  });
  const sp = (px, py) => { const c = Math.cos(sway), n = Math.sin(sway); return mp(c * px - n * py, -len + n * px + c * py); };
  return { grip: mp(0, 40), tip: mp(0, -len), sign: sp(0, -110), signTop: sp(0, -196) };
}

// ================================================================ slurp sound-wave rings spreading on the water
// (x,y) = centre on the water plane. k 0..1 life. o: n (5), maxR (1100), ryr (0.26 perspective), lines (true), seed, col
function slurpRings(ctx, x, y, s = 1, k = 0.5, o = {}) {
  const n = o.n ?? 5, maxR = o.maxR ?? 1100, ryr = o.ryr ?? 0.26, r = rng(o.seed ?? 4);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineCap = 'round';
  for (let i = n - 1; i >= 0; i--) {
    const kk = clamp((k - i * 0.1) / 0.75); if (kk <= 0 || kk >= 1) continue;
    const R = 60 + ease.out(kk) * maxR, a = (1 - kk) * (1 - kk * 0.3), wv = 1 - kk * 0.6;
    // trough (dark, below), crest (white), inner glint
    ctx.strokeStyle = `rgba(20,70,110,${0.35 * a})`; ctx.lineWidth = 18 * wv; ell(ctx, 0, 8 * wv, R, R * ryr); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * a})`; ctx.lineWidth = 10 * wv; ell(ctx, 0, 0, R, R * ryr); ctx.stroke();
    ctx.strokeStyle = `rgba(190,240,255,${0.6 * a})`; ctx.lineWidth = 3; ell(ctx, 0, -6 * wv, R * 0.985, R * ryr * 0.96); ctx.stroke();
    // sparkles riding the crest
    for (let j = 0; j < 6; j++) { const th = r() * TAU; L.sparkle(ctx, Math.cos(th) * R, Math.sin(th) * R * ryr, 22 * wv, a * 0.9); }
  }
  // cartoon sound streaks: radial action lines + wobbly arcs above the source
  if (o.lines !== false && k < 0.6) {
    const a = Math.sin(clamp(k / 0.6) * PI);
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * a})`;
    for (let i = 0; i < 16; i++) {
      const th = -PI + (i + 0.5) / 16 * PI, d0 = 90 + k * 260, d1 = d0 + 70 + r() * 90;
      ctx.lineWidth = 7 - (i % 3) * 2; ctx.beginPath(); ctx.moveTo(Math.cos(th) * d0, Math.sin(th) * d0 * 0.75 - 40); ctx.lineTo(Math.cos(th) * d1, Math.sin(th) * d1 * 0.75 - 40); ctx.stroke();
    }
    for (let j = 0; j < 3; j++) {
      const rr = 120 + j * 70 + k * 200; ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,245,200,${0.8 * a * (1 - j * 0.25)})`;
      ctx.beginPath(); for (let u = 0; u <= 24; u++) { const th = -PI * 0.85 + u / 24 * PI * 0.7, w = Math.sin(u * 1.6 + k * 30) * 6; ctx.lineTo(Math.cos(th) * (rr + w), Math.sin(th) * (rr + w) * 0.7 - 60); } ctx.stroke();
    }
  }
  ctx.restore();
}

// ================================================================ noodles zipping from the bowl into the mouth
// (x0,y0) = bowl surface, (x1,y1) = mouth. k 0..1: 0 strands span bowl→mouth, 1 the tail has entered the mouth.
// o: n (6), w (6 strand width), t, whip (1), bend (−0.12 × distance, + = sag), seed, lines (true), drops (true)
function noodleZip(ctx, x0, y0, x1, y1, k = 0.5, o = {}) {
  const n = o.n ?? 6, w = o.w ?? 6, t = o.t || 0, whip = o.whip ?? 1, r = rng(o.seed ?? 21);
  const dx = x1 - x0, dy = y1 - y0, D = Math.hypot(dx, dy) || 1, nx = -dy / D, ny = dx / D;
  const bend = (o.bend ?? -0.12) * D, cx = (x0 + x1) / 2 + nx * bend, cy = (y0 + y1) / 2 + ny * bend;
  const uT = ease.in ? ease.in(clamp(k)) : clamp(k) * clamp(k);
  const P = (u) => { const a = 1 - u; return [a * a * x0 + 2 * a * u * cx + u * u * x1, a * a * y0 + 2 * a * u * cy + u * u * y1]; };
  if (k >= 1) return { tail: [x1, y1] };
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // speed lines
  if (o.lines !== false) {
    for (let i = 0; i < 7; i++) {
      const off = (r() - 0.5) * w * 26, u0 = Math.max(uT, r() * 0.6), u1 = Math.min(1, u0 + 0.2 + r() * 0.2), ph = (t * 3 + r()) % 1;
      const a = P(u0), b = P(u1); ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - ph)})`; ctx.lineWidth = 2 + r() * 2;
      ctx.beginPath(); ctx.moveTo(a[0] + nx * off, a[1] + ny * off); ctx.lineTo(b[0] + nx * off, b[1] + ny * off); ctx.stroke();
    }
  }
  const tailPts = [];
  for (let i = 0; i < n; i++) {
    const sp = (i - (n - 1) / 2) * w * 1.3, ph = r() * TAU, fq = 9 + r() * 5, M = 64, pts = [];
    for (let j = 0; j <= M; j++) {
      const u = lerp(uT, 1, j / M), [px, py] = P(u), dt = u - uT;
      const conv = (1 - u) * (1 - u) + 0.08;                        // strands converge into the mouth
      const wav = Math.sin(dt * fq * PI - t * 32 + ph) * w * 5 * whip * Math.exp(-dt * 5) + Math.sin(u * 20 + ph + t * 6) * w * 0.4;
      pts.push([px + nx * (sp * conv * 2 + wav), py + ny * (sp * conv * 2 + wav)]);
    }
    tailPts.push(pts[0]);
    const path = () => { ctx.beginPath(); pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); };
    path(); ctx.strokeStyle = 'rgba(170,150,110,0.6)'; ctx.lineWidth = w * 1.45; ctx.stroke();
    path(); ctx.strokeStyle = '#fbf6e6'; ctx.lineWidth = w; ctx.stroke();
    path(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = w * 0.3; ctx.stroke();
  }
  // broth droplets flung off the tails
  if (o.drops !== false) {
    for (let i = 0; i < 14; i++) {
      const tp = tailPts[i % tailPts.length], ph = (t * 2.5 + r()) % 1, a = r() * TAU, d = ph * (40 + r() * 70);
      ctx.fillStyle = `rgba(245,195,100,${0.85 * (1 - ph)})`; ell(ctx, tp[0] + Math.cos(a) * d, tp[1] + Math.sin(a) * d + ph * ph * 40, w * 0.55, w * 0.7); ctx.fill();
      if (i % 4 === 0) L.sparkle(ctx, tp[0] + Math.cos(a) * d, tp[1] + Math.sin(a) * d, w * 3, 0.7 * (1 - ph));
    }
  }
  ctx.restore();
  return { tail: P(uT) };
}

// ================================================================ white heron / egret (cò trắng)
// side view facing +x, body centre at origin, s=1 wingspan ≈ 300. o: t, flap (Hz, 2.6), pose 'fly'|'stand', flip, rot, ph
function heron(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, pose = o.pose || 'fly', fl = o.flip ? -1 : 1, a = Math.sin((t * (o.flap ?? 2.6) + (o.ph || 0)) * TAU);
  const white = lgr(ctx, 0, -30, 0, 30, [[0, '#ffffff'], [0.7, '#eef2f4'], [1, '#b9c6cf']]);
  at(ctx, x, y, o.rot || 0, s * fl, s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const wing = (far) => {
      const ang = pose === 'fly' ? -a * 1.05 : 0.15, sq = pose === 'fly' ? 0.35 + 0.65 * Math.abs(Math.cos(a * PI / 2)) : 0.4;
      at(ctx, 6, -10, far ? ang * 0.85 : ang, 1, far ? sq * 0.9 : sq, () => {
        ctx.beginPath(); ctx.moveTo(26, 0); ctx.quadraticCurveTo(40, -70, 6, -150); ctx.lineTo(-10, -146);
        for (let i = 0; i < 5; i++) { const py = -146 + i * 30; ctx.quadraticCurveTo(-46 - i * 4, py + 10, -40 - i * 3, py + 26); }
        ctx.quadraticCurveTo(-30, -6, -36, 0); ctx.closePath();
        outFill(ctx, far ? '#c9d3da' : white, 2);
        ctx.strokeStyle = far ? 'rgba(90,110,125,0.35)' : 'rgba(150,170,185,0.55)'; ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-6 - i * 6, -20 - i * 4); ctx.lineTo(-28 - i * 5, -120 + i * 22); ctx.stroke(); }
        if (!far) rimLine(ctx, () => { ctx.moveTo(26, 0); ctx.quadraticCurveTo(40, -70, 6, -150); }, 'rgba(255,240,190,0.95)', 3);
      });
    };
    if (pose === 'fly') wing(true);
    // legs
    ctx.strokeStyle = '#1e1e22'; ctx.lineWidth = 4;
    if (pose === 'fly') { ctx.beginPath(); ctx.moveTo(-30, 8); ctx.lineTo(-120, 18 + a * 4); ctx.moveTo(-30, 12); ctx.lineTo(-118, 26 + a * 4); ctx.stroke(); ctx.strokeStyle = '#e8c23a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-118, 18 + a * 4); ctx.lineTo(-132, 20 + a * 4); ctx.moveTo(-116, 26 + a * 4); ctx.lineTo(-130, 30 + a * 4); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(-6, 16); ctx.lineTo(-10, 80); ctx.lineTo(-8, 150); ctx.moveTo(6, 16); ctx.lineTo(10, 82); ctx.lineTo(6, 150); ctx.stroke(); ctx.strokeStyle = '#e8c23a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 150); ctx.lineTo(10, 152); ctx.moveTo(6, 150); ctx.lineTo(24, 152); ctx.stroke(); }
    // body
    ctx.beginPath(); ctx.moveTo(44, -10); ctx.bezierCurveTo(30, -30, -40, -26, -70, -2); ctx.lineTo(-96, 8); ctx.lineTo(-64, 12); ctx.bezierCurveTo(-30, 26, 30, 24, 44, -10); ctx.closePath();
    outFill(ctx, white, 2.2);
    // neck (S folded in flight, tall when standing) + head + yellow dagger beak
    const nk = pose === 'fly' ? [[44, -10], [64, -6], [70, -30], [86, -34]] : [[34, -14], [60, -60], [20, -100], [44, -128]];
    ctx.strokeStyle = 'rgba(120,140,155,0.6)'; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(nk[0][0], nk[0][1]); ctx.bezierCurveTo(nk[1][0], nk[1][1], nk[2][0], nk[2][1], nk[3][0], nk[3][1]); ctx.stroke();
    ctx.strokeStyle = '#f7fafb'; ctx.lineWidth = 13; ctx.stroke();
    const hx = nk[3][0], hy = nk[3][1];
    ell(ctx, hx + 4, hy, 13, 10); outFill(ctx, '#ffffff', 1.8);
    ctx.beginPath(); ctx.moveTo(hx + 12, hy - 4); ctx.lineTo(hx + 56, hy + 2); ctx.lineTo(hx + 12, hy + 5); ctx.closePath(); outFill(ctx, '#f2c230', 1.4);
    ctx.fillStyle = '#1a1a1a'; ell(ctx, hx + 6, hy - 2, 2.6, 2.6); ctx.fill(); ctx.fillStyle = '#8fd0c0'; ell(ctx, hx + 11, hy - 1, 3, 2); ctx.fill();
    rimLine(ctx, () => { ctx.moveTo(44, -10); ctx.bezierCurveTo(30, -30, -40, -26, -70, -2); }, 'rgba(255,240,190,0.95)', 3);
    if (pose === 'fly') wing(false);
    else { // folded wing
      ctx.beginPath(); ctx.moveTo(30, -12); ctx.bezierCurveTo(10, -24, -50, -16, -84, 6); ctx.bezierCurveTo(-40, 14, 10, 12, 30, -12); outFill(ctx, '#e9eef1', 1.6);
    }
  });
}

// ================================================================ big backlit steam burst (when the broth hits the bowl)
// (x,y) = base (bowl/pot surface), rises up. k 0..1 life (0.15 ≈ peak). H = 900·s.
// o: n (14), sun [dx,dy] direction to the sun (default up-right), seed, alpha (1), rays (false), w (base width 160)
function steamBurst(ctx, t, x, y, s = 1, k = 0.5, o = {}) {
  const n = o.n ?? 14, r = rng(o.seed ?? 31), H = 900 * s, al = o.alpha ?? 1, sun = o.sun || [0.6, -0.8], bw = (o.w ?? 160) * s;
  if (k <= 0) return;
  ctx.save();
  if (o.rays) L.godRays(ctx, x + sun[0] * H * 0.9, y + sun[1] * H * 0.9, Math.atan2(-sun[1], -sun[0]), 0.5, H * 1.4, 7, 'rgba(255,240,200,1)', 0.18 * al * Math.sin(clamp(k) * PI), t);
  for (let i = 0; i < n; i++) {
    const u0 = (i / n) * 0.55, age = clamp((k - u0) / 0.55); if (age <= 0) continue;
    const e = ease.out(age), life = Math.sin(age * PI) * (age < 0.15 ? age / 0.15 : 1), A = al * life * (0.75 + r() * 0.25);
    const px = x + (r() - 0.5) * bw + Math.sin(t * 1.3 + i) * 30 * s * e + (r() - 0.4) * 140 * s * e, py = y - e * H * (0.4 + r() * 0.6), R = (50 + e * 170 + r() * 50) * s;
    if (A < 0.02) continue;
    // body (white against blue), slightly cooler bottom
    ctx.fillStyle = rgr(ctx, px, py, 0, px, py, R, [[0, `rgba(255,255,255,${0.55 * A})`], [0.55, `rgba(245,250,255,${0.32 * A})`], [1, 'rgba(240,248,255,0)']]); ctx.fillRect(px - R, py - R, R * 2, R * 2);
    // warm rim toward the sun (screen)
    const rx = px + sun[0] * R * 0.45, ry = py + sun[1] * R * 0.45;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgr(ctx, rx, ry, 0, rx, ry, R * 0.6, [[0, `rgba(255,236,190,${0.4 * A})`], [1, 'rgba(255,236,190,0)']]); ctx.fillRect(rx - R, ry - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  // thin fast wisps at the base
  NP.steamWisps(ctx, t * 1.6, (o.seed ?? 31) + 3, x - bw * 0.6, y, bw * 1.2, H * 0.45, { n: 6, alpha: 0.6 * al * Math.sin(clamp(k) * PI), w: 22 * s });
  ctx.restore();
}

// ================================================================ small clock (s5: 3:00 → 8:00)
// centre origin, radius 80·s. k 0..1 → hour hand 3:00 → 8:00 (minute hand spins 5 turns). o: from (3), to (8), label (true)
function clockFace(ctx, x, y, s = 1, k = 0, o = {}) {
  const h0 = o.from ?? 3, h1 = o.to ?? 8, hr = lerp(h0, h1, clamp(k)), mn = (hr % 1) * 60;
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(10,25,40,0.3)'; ell(ctx, 6, 8, 84, 84); ctx.fill();
    ell(ctx, 0, 0, 80, 80); outFill(ctx, lgr(ctx, -80, -80, 80, 80, [[0, '#e9584a'], [1, '#9c2a22']]), 3);
    ell(ctx, 0, 0, 66, 66); ctx.fillStyle = rgr(ctx, -20, -24, 4, 0, 0, 70, [[0, '#fffdf4'], [1, '#efe2c4']]); ctx.fill();
    ctx.strokeStyle = '#3a2a22'; ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = i % 3 ? 6 : 12; ctx.lineWidth = i % 3 ? 2.5 : 4.5; ctx.beginPath(); ctx.moveTo(Math.sin(a) * (60 - l), -Math.cos(a) * (60 - l)); ctx.lineTo(Math.sin(a) * 60, -Math.cos(a) * 60); ctx.stroke(); }
    // night → day icon
    const day = clamp((hr - 5.5) / 1.5);
    ctx.save(); ctx.globalAlpha = 1 - day; ctx.fillStyle = '#3a4a7a'; ell(ctx, 0, 26, 12, 12); ctx.fill(); ctx.fillStyle = '#fffdf4'; ell(ctx, 5, 23, 10, 10); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = day; ctx.fillStyle = '#f2b628'; ell(ctx, 0, 26, 9, 9); ctx.fill(); ctx.strokeStyle = '#f2b628'; ctx.lineWidth = 2.5; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, 26 + Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * 16, 26 + Math.sin(a) * 16); ctx.stroke(); } ctx.restore();
    const ha = hr / 12 * TAU, ma = mn / 60 * TAU;
    ctx.strokeStyle = '#1e1a18'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ha) * 34, -Math.cos(ha) * 34); ctx.stroke();
    ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(ma) * 52, -Math.cos(ma) * 52); ctx.stroke();
    ctx.fillStyle = '#c0261f'; ell(ctx, 0, 0, 6, 6); ctx.fill();
    ctx.fillStyle = '#c0392b'; for (const sx of [-1, 1]) { ell(ctx, sx * 48, -72, 16, 12, sx * 0.5); outFill(ctx, '#d9473a', 2); }
    rimLine(ctx, () => ctx.ellipse(0, 0, 78, 78, 0, PI * 1.05, PI * 1.6), 'rgba(255,255,255,0.85)', 3);
    if (o.label !== false) { const hh = Math.floor(hr), mm = Math.floor(mn); biText(ctx, `${hh}:${String(mm).padStart(2, '0')}`, hh < 6 ? 'AM' : 'AM', 0, 128, 34, 20); }
  });
}

// ================================================================ nón lá flying off (s17)
// origin = hat centre, s=1 brim diameter ≈ 200. o.spin (radians: tumble, squashes width by cos), rot = tilt
function flyingHat(ctx, x, y, s = 1, rot = 0, o = {}) {
  const sq = Math.cos(o.spin || 0), sc = 0.25 * s;
  at(ctx, x, y, rot, sc * (Math.abs(sq) < 0.08 ? 0.08 * Math.sign(sq || 1) : sq), sc, () => {
    ctx.translate(0, 336);
    NP.nonLa(ctx, 'back', {}); NP.nonLa(ctx, 'front', {});
  });
}

// ================================================================ flavour burst with custom labels (s20)
// 4 icons pop out radially around (x,y). k 0..1 life. o.items [{vi,en,icon:'bone'|'noodle'|'garlic'|'chili'|'lime'|'shrimp',col,a}]
// o.radius (300), o.labels (true). Icons ≈ 120 diameter at s=1.
const HT_FLAVORS = [
  { vi: 'Ngọt xương!', en: 'Rich!', icon: 'bone', col: '#e0a040', a: -2.36 },
  { vi: 'Dai!', en: 'Chewy!', icon: 'noodle', col: '#c9b27a', a: -0.79 },
  { vi: 'Thơm tỏi!', en: 'Garlicky!', icon: 'garlic', col: '#e8b84a', a: 0.79 },
  { vi: 'Cay!', en: 'Spicy!', icon: 'chili', col: '#d8342a', a: 2.36 },
];
function flavorIcon(ctx, icon) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (icon === 'bone') {
    ctx.save(); ctx.rotate(-0.6);
    const g = lgr(ctx, 0, -14, 0, 14, [[0, '#fffaf0'], [1, '#d8c8a8']]);
    ctx.beginPath(); ctx.rect(-26, -9, 52, 18); ctx.fillStyle = g; ctx.fill();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ell(ctx, sx * 30, sy * 9, 12, 12); outFill(ctx, g, 2); }
    ctx.fillStyle = g; ctx.fillRect(-28, -8, 56, 16); ctx.restore();
    ctx.strokeStyle = 'rgba(255,200,120,0.8)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 14, -30); ctx.quadraticCurveTo(i * 14 + 6, -40, i * 14, -48); ctx.stroke(); }
  } else if (icon === 'noodle') {
    for (let i = 0; i < 5; i++) { ctx.strokeStyle = 'rgba(160,140,100,0.7)'; ctx.lineWidth = 7; ctx.beginPath(); for (let u = 0; u <= 20; u++) { const xx = -34 + u * 3.4, yy = -24 + i * 12 + Math.sin(u * 0.9 + i) * 6; u ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); ctx.strokeStyle = '#fbf6e6'; ctx.lineWidth = 4.5; ctx.stroke(); }
  } else if (icon === 'garlic') {
    ctx.beginPath(); ctx.moveTo(0, -38); ctx.bezierCurveTo(8, -20, 34, -14, 32, 10); ctx.bezierCurveTo(30, 32, -30, 32, -32, 10); ctx.bezierCurveTo(-34, -14, -8, -20, 0, -38); ctx.closePath();
    outFill(ctx, lgr(ctx, -30, -30, 30, 30, [[0, '#fffbf0'], [1, '#e2d2b4']]), 2.4);
    ctx.strokeStyle = 'rgba(180,150,110,0.6)'; ctx.lineWidth = 2; for (const sx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(sx * 0.3, -30); ctx.quadraticCurveTo(sx * 1.6, 0, sx, 28); ctx.stroke(); }
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#e8b04a'; ell(ctx, -30 + i * 12, 38 + (i % 2) * 4, 5, 4); ctx.fill(); }
  } else if (icon === 'chili') {
    ctx.beginPath(); ctx.moveTo(-30, -24); ctx.bezierCurveTo(-10, -30, 30, -10, 34, 30); ctx.bezierCurveTo(14, 8, -16, -4, -30, -12); ctx.closePath();
    outFill(ctx, lgr(ctx, 0, -30, 0, 30, [[0, '#ff6a50'], [1, '#b81e18']]), 2.4);
    ctx.strokeStyle = '#3f8a2a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-30, -18); ctx.quadraticCurveTo(-42, -24, -40, -38); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -20); ctx.quadraticCurveTo(6, -18, 22, 4); ctx.stroke();
  } else if (icon === 'lime') {
    ell(ctx, 0, 0, 30, 30); outFill(ctx, '#7cc242', 2.4); ell(ctx, 0, 0, 24, 24); ctx.fillStyle = '#d9f0a0'; ctx.fill();
    ctx.strokeStyle = '#a8d460'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23); ctx.stroke(); }
  } else if (icon === 'shrimp') {
    require('./hp_food').shrimp(ctx, 0, 0, 1.2, 0.3);
  }
}
function flavorBurst(ctx, x, y, s = 1, k = 0.5, o = {}) {
  const items = o.items || HT_FLAVORS, R = o.radius ?? 300;
  at(ctx, x, y, 0, s, s, () => {
    items.forEach((it, i) => {
      const kk = clamp((k - i * 0.08) / 0.5), e = ease.outBack(kk), fade = k > 0.85 ? clamp((1 - k) / 0.15) : 1;
      if (kk <= 0) return;
      const a = it.a ?? (-2.36 + i * PI / 2), px = Math.cos(a) * R * e, py = Math.sin(a) * R * e;
      ctx.save(); ctx.globalAlpha = fade * clamp(kk * 3);
      ctx.strokeStyle = 'rgba(255,240,210,0.4)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px * 0.35, py * 0.35); ctx.lineTo(px * 0.75, py * 0.75); ctx.stroke();
      at(ctx, px, py, Math.sin(kk * 8) * 0.08 * (1 - kk), Math.max(0.01, e), Math.max(0.01, e), () => {
        glow(ctx, 0, 0, 110, 'rgba(255,220,150,1)', 0.35);
        ell(ctx, 0, 0, 60, 60); ctx.fillStyle = rgr(ctx, -15, -20, 4, 0, 0, 62, [[0, '#fffaf0'], [1, '#f3e2c4']]); ctx.fill(); ctx.strokeStyle = it.col || '#e0a040'; ctx.lineWidth = 6; ctx.stroke();
        flavorIcon(ctx, it.icon);
        if (o.labels !== false) biText(ctx, it.vi, it.en, 0, 104, 36, 25);
      });
      ctx.restore();
    });
  });
}

// ================================================================ sweat drops (falling from the temples) + forehead shine
// (x,y) = head centre, r = head half-width in the same space. k 0..1 amount. t time.
function sweatDrops(ctx, x, y, r, t, k = 1, o = {}) {
  if (k <= 0) return;
  const rr = rng(o.seed ?? 8), n = Math.round(2 + 4 * k);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, per = 0.9 + rr() * 0.6, ph = ((t / per) + rr()) % 1;
    const sx = x + side * r * (0.75 + rr() * 0.3), sy = y - r * (0.3 + rr() * 0.4) + ph * ph * r * 1.6, z = r * (0.07 + rr() * 0.04) * (ph < 0.2 ? ph / 0.2 : 1);
    ctx.globalAlpha = (1 - Math.max(0, ph - 0.7) / 0.3) * 0.95;
    ctx.beginPath(); ctx.moveTo(sx, sy - z * 2.2); ctx.bezierCurveTo(sx + z * 1.1, sy - z * 0.4, sx + z, sy + z, sx, sy + z); ctx.bezierCurveTo(sx - z, sy + z, sx - z * 1.1, sy - z * 0.4, sx, sy - z * 2.2); ctx.closePath();
    ctx.fillStyle = 'rgba(190,235,255,0.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(40,110,160,0.8)'; ctx.lineWidth = Math.max(1, z * 0.25); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ell(ctx, sx - z * 0.35, sy - z * 0.3, z * 0.25, z * 0.4); ctx.fill();
  }
  ctx.restore();
}

module.exports = { biText, selfieSign, slurpRings, noodleZip, heron, steamBurst, clockFace, flyingHat, flavorBurst, flavorIcon, HT_FLAVORS, sweatDrops };
