// shotsC.js – Cá lóc nướng trui, shots 16..22 (45.333–70.0 s). 90 BPM grid: beat 2/3 s, bar 2.667 s.
// s16 grab → bonk → bonk → tail SLAP · s17 wobble + fall back → SPLOOSH · s18 silence, pop-up with lotus hat + frog, fish
// leaps into Chú Ba's basket · s19 Chú Ba laughs + hands over a roll by the fire · s20 bite / eye-macro / thumbs up
// s21 moonlit wide by the dying fire + end card · s22 LIKE & FOLLOW CTA.
'use strict';
const L = require('./lib');
const { W, H, TAU, rng, clamp, lerp, inv, ease, glow, sparkle, createCanvas } = L;
const PE = require('./people');
const CL = require('./clprops');
const X = require('./text');
const CAP_Y = X.CAP_Y;
const BEAT = 2 / 3;
const beat = T => ((T * 1.5) % 1 + 1) % 1;
const hit = (T, sharp = 6) => Math.exp(-beat(T) * sharp);
void BEAT; void CAP_Y;

// =====================================================================================
// text / CTA helpers (ported from banhxeo/shotsC.js, retimed to the 2/3 s grid)
// =====================================================================================
function backdrop(ctx, a, y) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y - 170, 0, y + 190);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(4,6,16,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 170, W, 360);
  ctx.restore();
}
function fitFont(ctx, txt, size, fam, maxW) {
  let fs = size; ctx.font = `${fs}px ${fam}`;
  while (ctx.measureText(txt).width > maxW && fs > 20) { fs -= 2; ctx.font = `${fs}px ${fam}`; }
  return fs;
}
function heart(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 30);
  ctx.bezierCurveTo(-10, 20, -60, -5, -60, -35); ctx.bezierCurveTo(-60, -65, -20, -75, 0, -45);
  ctx.bezierCurveTo(20, -75, 60, -65, 60, -35); ctx.bezierCurveTo(60, -5, 10, 20, 0, 30); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-30, -42, 12, 7, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function checkMark(ctx, x, y, s, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 7 * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 14 * s, y); ctx.lineTo(x - 3 * s, y + 11 * s); ctx.lineTo(x + 16 * s, y - 12 * s); ctx.stroke(); ctx.restore();
}
function ctaLike(ctx, T, t0, tTap, x = 330, y = 760) {
  const k = T - t0; if (k < 0) return;
  const pop = ease.outBack(clamp(k / 0.4));
  const tapped = T >= tTap;
  const pulse = tapped ? 1 + 0.14 * hit(T, 7) : 1;
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15);
  ctx.beginPath(); ctx.arc(x, y, 105 * pop, 0, Math.PI * 2); ctx.fillStyle = 'rgba(8,10,24,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.stroke();
  heart(ctx, x, y + 12, 1.15 * pop * pulse, tapped ? '#fe2c55' : 'rgba(255,255,255,0.9)');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '38px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.fillText('THÍCH', x, y + 150); ctx.font = '30px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('LIKE', x, y + 192);
  const f = clamp((T - tTap) / 1.2);
  if (f > 0 && f < 1) { ctx.globalAlpha = Math.sin(f * Math.PI); ctx.font = '60px BodySansBold'; ctx.fillStyle = '#ff5c7a'; ctx.fillText('+1', x + 110, y - 90 - f * 120); }
  ctx.restore();
  const tk = T - tTap; if (tk >= 0 && tk < 0.35) glow(ctx, x, y, 220, 'rgba(255,120,150,0.9)', 1 - tk / 0.35);
}
function ctaConfetti(ctx, T, t0, x, y) {
  const k = T - t0; if (k < 0 || k > 2.2) return;
  const r = rng(515), cols = ['#fe2c55', '#25f4ee', '#ffd76a', '#ffffff', '#b8ff6a'];
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.8, v = 500 + r() * 700, sz = 8 + r() * 10, spin = (r() - 0.5) * 16, c = cols[i % cols.length];
    const px = x + Math.cos(a) * v * k * 0.7, py = y + Math.sin(a) * v * k * 0.7 + 700 * k * k;
    ctx.globalAlpha = clamp(1 - k / 2.2); ctx.fillStyle = c;
    ctx.save(); ctx.translate(px, py); ctx.rotate(spin * k); ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
  }
  ctx.restore();
}
function ctaFollow(ctx, T, t0, tp, x = 700, y = 760) {
  const k = T - t0; if (k < 0) return;
  const sl = ease.outBack(clamp(k / 0.5));
  const pressed = T >= tp, pk = T - tp;
  const press = pk >= 0 && pk < 0.25 ? 1 - Math.sin(pk / 0.25 * Math.PI) * 0.12 : 1;
  const w = 330, h = 120;
  ctx.save(); ctx.translate(x + (1 - sl) * 500, y); ctx.scale(press, press);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = pressed ? '#5a5a60' : '#fe2c55'; ctx.fill();
  ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (!pressed) {
    ctx.font = '46px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOW', 0, -14);
    ctx.font = '28px BodySansBold'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THEO DÕI', 0, 30);
  } else {
    checkMark(ctx, -118, -12, 1.4, '#fff');
    ctx.letterSpacing = '1px'; ctx.fillStyle = '#ffe6b0'; fitFont(ctx, 'ĐÃ THEO DÕI', 40, 'BodySansBold', 210); ctx.fillText('ĐÃ THEO DÕI', 24, -14);
    ctx.font = '28px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('FOLLOWING', 24, 30);
  }
  ctx.restore();
  if (pk >= 0 && pk < 0.4) glow(ctx, x, y, 260, 'rgba(255,240,220,0.9)', 1 - pk / 0.4);
  if (pk >= 0) ctaConfetti(ctx, T, tp, x, y);
}
function ctaHand(ctx, T, tp, x, y) {
  const k = T - (tp - 2 / 3); if (k < 0 || T > tp + 0.9) return;
  const appr = ease.out(clamp(k / 0.5)), back = ease.in(clamp((T - tp - 0.3) / 0.5));
  const off = (1 - appr) * 420 + back * 420;
  ctx.save(); ctx.translate(x + 30 + off * 0.6, y + 30 + off); ctx.rotate(-0.5);
  ctx.globalAlpha = 1 - back;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.roundRect(-16, -10, 32, 90, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-40, 50, 90, 110, 34); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-56, 64, 34, 60, 16); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(-30, 150, 70, 60, 10); ctx.fillStyle = '#fe2c55'; ctx.fill(); ctx.stroke();
  ctx.restore();
}
function logo(ctx, a, y = 1500) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(242,214,130,0.85)'; ctx.fillRect(500 - 80, y - 40, 160, 3);
  ctx.font = '44px TitleSerif'; ctx.letterSpacing = '10px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12;
  ctx.fillText('DISH TALES', 500, y);
  ctx.restore();
}
function biText(ctx, a, y, vi, en, o = {}) {
  if (a <= 0) return;
  if (o.bd !== false) backdrop(ctx, a * 0.85, y + 20);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.letterSpacing = '1px';
  ctx.fillStyle = o.vcol || '#ffe6b0'; fitFont(ctx, vi, o.vsize || 62, o.serif ? 'TitleSerif' : 'BodySansBold', 840); ctx.fillText(vi, 500, y);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; fitFont(ctx, en, o.esize || 40, 'BodySans', 840); ctx.fillText(en, 500, y + (o.gap || 66));
  ctx.restore();
}

// =====================================================================================
// scene helpers
// =====================================================================================
// camera that never shows outside the 1080x1920 canvas
function cam(ctx, cx, cy, z, rot, fn) {
  z = Math.max(z, 1 + 1.85 * Math.abs(rot) + 0.003);
  const m = Math.abs(rot) * 980 + 2, hw = W / 2 / z + m, hh = H / 2 / z + m * 0.6;
  L.cam(ctx, clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2)), clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2)), z, rot, fn);
}
const BGC = {};
function xPlate(key, blur, drawFn) {
  if (!BGC[key]) {
    const a = createCanvas(W, H), ax = a.getContext('2d');
    ax.fillStyle = '#000'; ax.fillRect(0, 0, W, H); drawFn(ax);
    const b = createCanvas(W, H), bx = b.getContext('2d');
    bx.drawImage(a, 0, 0);
    if (blur > 0) { bx.filter = `blur(${blur}px)`; bx.drawImage(a, 0, 0); bx.filter = 'none'; }
    BGC[key] = b;
  }
  return BGC[key];
}
function shake(T, t0, amp, dec = 3) {
  const k = T - t0; if (k < 0) return [0, 0];
  const e = amp * Math.exp(-k * dec);
  return [Math.sin(k * 71) * e, Math.cos(k * 53) * e * 0.8];
}
function shakes(T, list) { let x = 0, y = 0; for (const [t0, a, d] of list) { const s = shake(T, t0, a, d); x += s[0]; y += s[1]; } return [x, y]; }
const kick = (T, t0, dec = 7) => (T >= t0 ? Math.exp(-(T - t0) * dec) : 0);
// parabolic hop from a to b (height h above the straight line), u 0..1
function hop(a, b, u, h) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - Math.sin(u * Math.PI) * h]; }
// small white impact star + lines (comic bonk)
function bonk(ctx, x, y, s, k) {
  if (k <= 0 || k >= 1) return;
  const a = 1 - k, r = (40 + 90 * ease.out(k)) * s;
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const an = i / 8 * TAU + 0.3; ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * r * 0.55, y + Math.sin(an) * r * 0.55); ctx.lineTo(x + Math.cos(an) * r, y + Math.sin(an) * r); ctx.stroke(); }
  ctx.restore();
  sparkle(ctx, x, y, 34 * s * (1 - k * 0.5), a);
}

// =====================================================================================
// s16 (45.333–48.0) grab → slips → BONK head 46.0 → BONK shoulder 46.667 → tail SLAP 47.333
// =====================================================================================
const S16 = { hz: 880, camH: 120, s: 1.8, x: 420 };
function fish16(T, wl) {
  const s = S16.s, tx = S16.x, ty = wl + 125 * s;
  const A0 = [tx + 206 * s, ty - 215 * s], A1 = [tx - 23 * s, ty - 560 * s], A2 = [tx + 110 * s, ty - 425 * s],
    A3 = [tx + 45 * s, ty - 445 * s], A4 = [tx + 300 * s, wl + 30];
  const t0 = 45.333, tS = 45.733;
  if (T < tS) return { p: A0, rot: Math.sin(T * 25) * 0.15, bend: Math.sin(T * 31) * 0.4 };
  if (T < 46.0) { const u = inv(tS, 46.0, T); return { p: hop(A0, A1, ease.out(u), 90), rot: lerp(0, -TAU * 0.75, u), bend: 0.3 }; }
  if (T < 46.667) { const u = inv(46.0, 46.667, T); return { p: hop(A1, A2, u, 230), rot: lerp(-TAU * 0.75, -TAU * 1.6, u), bend: -0.3 * Math.sin(u * TAU) }; }
  if (T < 47.333) { const u = inv(46.667, 47.333, T); const c = hop(A2, A3, u, 300); return { p: [c[0], c[1]], rot: lerp(-TAU * 1.6, -TAU * 2, ease.inOut(u)), bend: lerp(-0.2, 0.75, ease.in2 ? ease.in2(u) : u * u) }; }
  const u = inv(47.333, 48.0, T), A3b = A3;
  return { p: [lerp(A3b[0], A4[0], u), lerp(A3b[1], A4[1], u * u) - Math.sin(u * Math.PI) * 120], rot: lerp(0, 1.2, u), bend: lerp(-0.6, 0.2, clamp(u * 3)) };
  void t0;
}
function s16(ctx, lt, p, T) {
  const { hz, camH, s, x: tx } = S16, wl = hz + camH * s, ty = wl + 125 * s;
  const sk = shakes(T, [[46.0, 9, 6], [46.667, 9, 6], [47.333, 24, 5]]);
  const z = lerp(1.03, 1.1, ease.inOut(p)) + 0.05 * kick(T, 47.333, 5);
  let tr = null, fp = null;
  cam(ctx, 520 + sk[0], 900 + sk[1], z, 0, () => {
    CL.fieldWaterClose(ctx, T, {
      horizon: hz, camH, hut: { X: -1100, Z: 3600, lamp: 0.7 }, midZ: 1000 / 0.8, fireflies: 18,
      mid: (c) => {
        const sc = 0.8, wc = hz + camH * sc;
        const laugh = T > 47.45;
        CL.chuBa(c, 900, wc + 130 * sc, sc, { pose: laugh ? 'laugh' : 'stand', expr: laugh ? 'laugh' : 'grin', t: T, flip: true, basket: true, waterline: wc, reflect: 0.3 });
      },
    });
    let pose = 'wobble', k = 0.5, lean = 0, expr;
    if (T < 45.75) { pose = 'grab'; k = lerp(0.85, 1, ease.out(clamp(lt / 0.3))); }
    else if (T < 47.333) { lean = -0.14 * kick(T, 46.0, 6) + 0.12 * kick(T, 46.667, 6) + Math.sin(T * 8) * 0.04; expr = 'panic'; }
    else { pose = 'slapped'; lean = -0.1 * kick(T, 47.333, 4); }
    tr = CL.touristNight(ctx, tx, ty, s, { pose, k, t: T, lean, expr, grabAt: [tx + 210 * s, ty - 215 * s], waterline: wl, reflect: 0.35 });
    const f = fish16(T, wl);
    fp = f.p;
    if (T < 47.95) CL.snakehead(ctx, f.p[0], f.p[1], 0.6, { state: 'alive', wiggle: 1, mouth: 0.6, eye: T > 46.5 ? 'sly' : 'angry', rot: f.rot, bend: f.bend, t: T, wet: 1 });
    // flying water drops off the wet fish
    if (T > 45.73 && T < 47.9) CL.dropletsSlowmo(ctx, f.p[0], f.p[1], 0.35, { t: T, k: 0.5 + 0.5 * beat(T), n: 14, seed: 7, warm: 0.2 });
    bonk(ctx, tx - 23 * s, ty - 545 * s, 1.1, inv(46.0, 46.35, T));
    bonk(ctx, tx + 100 * s, ty - 400 * s, 1.0, inv(46.667, 47.0, T));
    if (T > 47.9) CL.ripplesNight(ctx, tx + 300 * s, wl + 30, 1.0, { t: T, n: 2, r: 160 });
    // slap: boosted fish-tail print on the cheek + dizzy stars
    if (T >= 47.333) {
      const fc = tr.face, cx = fc.x + 46 * s, cy = fc.y + 34 * s, sk2 = clamp((T - 47.333) / 0.6);
      CL.slapMark(ctx, cx, cy, 0.9, { k: sk2, rot: -0.35, t: T });
      ctx.save(); ctx.globalAlpha = 0.6; CL.slapMark(ctx, cx, cy, 0.9, { k: Math.max(0.55, sk2), rot: -0.35, t: T }); ctx.restore();
      CL.dizzy(ctx, fc.x, fc.y - 120 * s, 1.5, T, { k: clamp((T - 47.4) / 0.25), n: 5 });
    }
  });
  void fp;
  if (T >= 47.333) CL.clWord(ctx, 'BEP', 700, 330, 170, { t: T, k: clamp((T - 47.333) / 0.22), lines: true, rot: -0.1 });
}

// =====================================================================================
// s17 (48.0–50.667) wobble on one leg, windmill, fall backwards → SPLOOSH 50.0
// =====================================================================================
const S17 = { hz: 900, camH: 110, s: 1.5, x: 700, splash: [370, 0] };
function s17(ctx, lt, p, T) {
  const { hz, camH, s, x: tx } = S17, wl = hz + camH * s, ty = wl + 125 * s, sx = S17.splash[0];
  const sk = shakes(T, [[50.0, 30, 3.5]]);
  const z = lerp(1.08, 1.02, ease.inOut(p)) + 0.04 * kick(T, 50.0, 4);
  cam(ctx, 560 + sk[0], 920 + sk[1], z, 0, () => {
    CL.fieldWaterClose(ctx, T, { horizon: hz, camH, hut: { X: -700, Z: 3000, lamp: 0.7 }, fireflies: 18 });
    if (T < 50.06) {
      let pose = 'wobble', k = 0.5, lean = 0;
      const tw = 49.333;
      if (T < 49.0) lean = Math.sin(lt * 7.5) * 0.2 * (0.6 + 0.4 * lt);          // windmilling wobble, growing
      else if (T < tw) { pose = 'slipped'; k = inv(49.0, tw, T); }
      else { pose = 'fallBack'; k = ease.in(inv(tw, 50.0, T)); }
      CL.touristNight(ctx, tx, ty, s, { pose, k, t: T * (pose === 'wobble' ? 2.2 : 1), lean, expr: 'panic', waterline: wl, reflect: 0.3, lotusHat: false });
      if (T < 49.0) { // speed arcs around the windmilling arms
        ctx.save(); ctx.strokeStyle = 'rgba(220,235,255,0.45)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (const [ax, ay, ph] of [[tx - 200 * s, ty - 390 * s, 0], [tx + 170 * s, ty - 390 * s, 1.7]]) {
          const a0 = T * 9 + ph; ctx.beginPath(); ctx.arc(ax, ay, 70 * s, a0, a0 + 1.6); ctx.stroke();
        }
        ctx.restore();
      }
    }
    if (T >= 50.0) CL.splashCrown(ctx, sx, wl + 10, 1.4, inv(50.0, 50.9, T), { t: T, seed: 3, warm: 0 });
    else if (T > 49.5) CL.ripplesNight(ctx, tx, wl, 1, { t: T, n: 2, r: 140 });
  });
  if (T >= 50.0) CL.clWord(ctx, 'UM', 520, 330, 185, { t: T, k: clamp((T - 50.0) / 0.22), lines: true });
}

// =====================================================================================
// s18 (50.667–54.0) splash settles · SILENCE 51.333–52.667 · pop-up 52.667 (lotus hat + frog) · RIBBIT 53.333
//                   · fish leaps in a slow arc into Chú Ba's basket
// =====================================================================================
const S18 = { hz: 960, camH: 90, s: 1.9, x: 400, cb: { x: 860, s: 1.1 }, fishOut: 52.95, fishIn: 53.85 };
function s18(ctx, lt, p, T) {
  const { hz, camH, s, x: tx } = S18, wl = hz + camH * s;
  const cbS = S18.cb.s, cbW = hz + camH * cbS, cbY = cbW + 130 * cbS, cbX = S18.cb.x;
  const basketMouth = [cbX - 136 * cbS, cbY - 320 * cbS];
  const z = lerp(1.0, 1.07, ease.inOut(inv(50.667, 52.667, T))) - 0.03 * ease.out(inv(52.667, 53.3, T));
  cam(ctx, 560, 880, z, 0, () => {
    CL.fieldWaterClose(ctx, T, { horizon: hz, camH, hut: { X: -1200, Z: 3400, lamp: 0.7 }, fireflies: 22 });
    // Chú Ba (right): watching, then holds the basket out for the fish
    const catching = T > 52.45;
    const inBasket = T >= S18.fishIn ? 1 : 0;
    CL.chuBa(ctx, cbX, cbY, cbS, catching
      ? { pose: 'catchBasket', basketFish: inBasket, t: T, flip: true, waterline: cbW, reflect: 0.3, expr: T > S18.fishIn ? 'laugh' : 'grin' }
      : { pose: 'stand', expr: 'o', t: T, flip: true, basket: true, waterline: cbW, reflect: 0.3 });
    // splash remains → silence: bubbles + ripples
    if (T < 50.95) CL.splashCrown(ctx, tx, wl + 10, 1.0, lerp(0.78, 1, inv(50.667, 50.95, T)), { t: T, seed: 3 });
    if (T < 52.75) {
      CL.ripplesNight(ctx, tx, wl + 6, 1.3, { t: T, n: 3, r: 200, period: 2.2, alpha: 0.9 });
      CL.bubbles(ctx, tx, wl + 4, 1.2, { t: T, n: 9, w: 170, rings: 2, seed: 4, alpha: inv(50.75, 51.2, T) });
    }
    // pop-up
    if (T >= 52.667) {
      const rise = ease.outBack(inv(52.667, 53.0, T));
      const rib = T >= 53.333 ? Math.sin(clamp((T - 53.333) / 0.55) * Math.PI) : 0;
      const frog = T >= 53.333 ? { pose: 'ribbit', k: rib } : true;
      CL.touristNight(ctx, tx, wl + (1 - rise) * 330 * s, s, { pose: 'popUp', t: T, waterline: wl, frog, reflect: 0.3 });
      CL.ripplesNight(ctx, tx, wl + 8, 1.4, { t: T - 52.667, n: 3, r: 230, period: 1.4 });
      if (T < 53.4) CL.dropletsSlowmo(ctx, tx, wl - 150 * s, 0.7, { t: T, k: ease.out(inv(52.667, 53.3, T)), n: 30, seed: 11, warm: 0.1 });
    }
    // fish leap (slow arc) into the basket
    if (T >= S18.fishOut - 0.05 && T < S18.fishIn) {
      const u = inv(S18.fishOut, S18.fishIn, T), a = [tx + 190, wl + 20];
      const fp = hop(a, basketMouth, ease.inOut(u), 360);
      CL.snakehead(ctx, fp[0], fp[1] - 30, 0.5, { state: 'alive', wiggle: 0.5, mouth: 0.4, eye: 'sly', rot: lerp(-1.1, 1.5, u), bend: Math.sin(u * TAU) * 0.3, t: T, wet: 1 });
      CL.dropletsSlowmo(ctx, fp[0], fp[1], 0.4, { t: T, k: 0.6, n: 16, seed: 13, warm: 0.1 });
      if (u < 0.25) CL.ripplesNight(ctx, a[0], a[1], 0.8, { t: T - S18.fishOut, n: 2, r: 120 });
    }
    if (T >= S18.fishIn && T < S18.fishIn + 0.4) sparkle(ctx, basketMouth[0], basketMouth[1] - 20, 40, 1 - (T - S18.fishIn) / 0.4);
  });
  if (T >= 53.333) {
    const a = 1 - inv(53.85, 54.0, T);
    ctx.save(); ctx.globalAlpha = a;
    CL.clWord(ctx, 'OP', 290, 560, 120, { t: T, k: clamp((T - 53.333) / 0.2), rot: 0.08 });
    ctx.restore();
  }
}

// =====================================================================================
// s19 (54.0–56.667) by the fire: Chú Ba laughs, hands the dripping tourist a roll
// =====================================================================================
function fireAt(ctx, T, x, y, fs, k, seed = 2) {
  CL.strawFire(ctx, x, y, fs, { t: T, k, seed, wind: 0.1 });
  CL.emberGlow(ctx, x, y + 6 * fs, fs * 1.1, { t: T, k: 0.9, w: 260, seed });
}
function s19(ctx, lt, p, T) {
  const z = lerp(1.3, 1.38, ease.inOut(p));
  cam(ctx, 520, 1130, z, 0, () => {
    const handT = 55.9;
    CL.dikeScene(ctx, T, {
      view: 'close', fire: 0.8, front: false,
      mid: (c, R) => {
        const fg = R.ground(-30, 900), tg = R.ground(-120, 640), cg = R.ground(130, 780);
        const fL = { x: fg.x, y: fg.y - 120 * fg.s, k: 0.9 };
        // Chú Ba (behind the fire's right side)
        let cbo;
        if (T < 54.95) cbo = { pose: 'laugh', expr: 'laugh' };
        else if (T < handT) cbo = { pose: 'offer', item: 'roll', offerAt: [tg.x + 150 * tg.s, tg.y - 190 * tg.s], lean: 0.15 * ease.out(inv(54.95, 55.4, T)), expr: 'grin' };
        else cbo = { pose: 'laugh', expr: 'laugh' };
        CL.chuBa(c, cg.x, cg.y, cg.s, Object.assign({ t: T, flip: true, fireLight: { x: fL.x, y: fL.y, k: 0.9 } }, cbo));
        fireAt(c, T, fg.x, fg.y, fg.s * 0.42, 0.42);
        CL.sparks(c, fg.x, fg.y - 60 * fg.s, fg.s * 0.6, { t: T, n: 30, rise: 600, w: 150 });
        CL.touristNight(c, tg.x, tg.y, tg.s, { pose: 'sitFire', roll: T >= handT, t: T, wet: true, lotusHat: true, frog: true, fireLight: { x: fL.x, y: fL.y, k: 1 } });
        CL.fireLight(c, fL.x, fL.y, 700, 0.3, { t: T });
      },
    });
  });
  X.line(ctx, T, 54.2, 56.55, 'Cá phải nướng mới ngon nè!', 'Fish taste better grilled, not wrestled!');
}

// =====================================================================================
// s20 (56.667–60.667) bite 58.0 · eye macro 58.333–59.333 · bliss + thumbs up (frog stays on the hat)
// =====================================================================================
const EYE0 = 58.333, EYE1 = 59.333;
function s20(ctx, lt, p, T) {
  if (T >= EYE0 && T < EYE1) {
    const k = inv(EYE0, EYE1, T);
    ctx.fillStyle = '#1a1210'; ctx.fillRect(0, 0, W, H);
    PE.eyeMacro(ctx, 540, 900, lerp(1.05, 1.15, k), {
      pupil: lerp(0.3, 0.62, ease.out(clamp(k * 3))), open: 1, t: T, brow: 0.6,
      reflect: (c) => {
        // fire + moon reflected in the eye
        c.save(); c.globalCompositeOperation = 'screen';
        c.fillStyle = 'rgba(255,150,60,0.55)'; c.beginPath(); c.ellipse(-60, 50, 70, 46 + Math.sin(T * 17) * 6, 0, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,240,200,0.8)'; c.beginPath(); c.arc(70, -60, 26, 0, TAU); c.fill();
        c.restore();
      },
    });
    const sp = ease.outBack(clamp((T - EYE0 - 0.1) / 0.35));
    sparkle(ctx, 640, 780, 120 * sp, 1);
    sparkle(ctx, 450, 1000, 60 * sp, 0.85);
    // warm fire flicker across the frame
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,120,40,${0.07 + 0.04 * Math.sin(T * 13)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    X.line(ctx, T, 59.0, 60.55, 'Thơm khói, ngon dữ thần!', 'Smoky and AMAZING!', { y: 320 });
    return;
  }
  const z = lerp(1.25, 1.32, ease.inOut(p)) + 0.03 * kick(T, 58.0, 6);
  const sk = shakes(T, [[58.0, 7, 7]]);
  let tr = null;
  const tx = 460, ty = 1730, ts = 2.25;
  cam(ctx, 600 + sk[0], 1150 + sk[1], z, 0, () => {
    CL.dikeScene(ctx, T, {
      view: 'close', fire: 0.85, front: false, panX: 120,
      mid: (c) => {
        const fx = 850, fy = 1330, fs = 0.95;
        fireAt(c, T, fx, fy, fs * 0.5, 0.45, 5);
        CL.sparks(c, fx, fy - 60, 0.7, { t: T, n: 26, rise: 650, w: 140, seed: 3 });
        const fL = { x: fx, y: fy - 120, k: 1 };
        let pose = 'sitFire', k = 0, roll = true;
        if (T < 57.5) pose = 'sitFire';
        else if (T < 58.0) { pose = 'bite'; k = 0.3; }
        else if (T < EYE1) { pose = 'bite'; k = 0.6 + 0.4 * inv(58.0, 58.33, T); }
        else { pose = 'bliss'; roll = false; }
        const rib = T > 60.0 ? Math.sin(clamp((T - 60.0) / 0.5) * Math.PI) : 0;
        tr = CL.touristNight(c, tx, ty, ts, { pose, k, roll, t: T, wet: true, lotusHat: true, frog: rib > 0 ? { pose: 'ribbit', k: rib } : true, fireLight: fL });
        CL.fireLight(c, fx, fy - 100, 800, 0.3, { t: T });
        // crunch: crumbs + steam at the mouth
        if (T >= 58.0 && T < EYE0) {
          const m = tr.mouth;
          bonk(c, m[0] + 60, m[1], 0.9, inv(58.0, 58.3, T));
          CL.steamWisps(c, m[0] + 40, m[1] - 10, 0.8, { t: T, k: 1, w: 120, h: 240, n: 4, warm: 0.6 });
        }
        if (T >= EYE1) {
          const h = tr.head;
          CL.steamWisps(c, h[0] + 170, h[1] + 200, 0.9, { t: T, k: 0.8, w: 120, h: 280, n: 4, warm: 0.5 });
          const th = ease.outBack(inv(59.5, 59.85, T));
          if (th > 0) PE.thumbsUp(c, h[0] + 270, h[1] + 300 + (1 - th) * 500, 1.1, -0.15 + Math.sin(T * 5) * 0.04);
          if (T > 59.6) { sparkle(c, h[0] - 120, h[1] - 60, 34 * (0.6 + 0.4 * Math.sin(T * 9)), 0.9); sparkle(c, h[0] + 110, h[1] - 110, 26, 0.8); }
        }
      },
    });
  });
  X.line(ctx, T, 59.0, 60.55, 'Thơm khói, ngon dữ thần!', 'Smoky and AMAZING!', { y: 320 });
}

// =====================================================================================
// s21 (60.667–64.667) wide: the two sit by the dying fire on the dike under the full moon + end card
// =====================================================================================
function s21(ctx, lt, p, T) {
  const z = lerp(1.32, 1.22, ease.inOut(p));
  cam(ctx, 540, 1150, z, 0, () => {
    CL.dikeScene(ctx, T, {
      view: 'wide', fire: 0.45,
      mid: (c, R) => {
        CL.xuongMoored(c, 820, 1205, 0.3, { t: T, flip: true });
        const [fx, fy] = R.fire, fs = R.fireS;
        const fL = { x: fx, y: fy - 40 * fs, k: 0.6 };
        const [a, b] = R.sit;
        const rib = (T % 2.667) > 2.0 ? Math.sin(((T % 2.667) - 2.0) / 0.667 * Math.PI) : 0;
        CL.touristNight(c, a[0] + 70, a[1], a[2], { pose: 'sitFire', t: T, wet: true, frog: rib > 0 ? { pose: 'ribbit', k: rib } : true, fireLight: fL });
        CL.chuBa(c, b[0] - 70, b[1], b[2], { pose: 'sit', t: T, flip: true, expr: 'smile', fireLight: fL });
        CL.emberGlow(c, fx, fy, fs * 0.8, { t: T, k: 0.9, w: 200, seed: 4 });
        CL.strawFire(c, fx, fy - 4, fs * 0.6, { t: T, k: 0.07, seed: 4 });
        CL.sparks(c, fx, fy - 20, fs * 0.5, { t: T, n: 16, rise: 500, w: 90, seed: 8, alpha: 0.8 });
        CL.fireLight(c, fx, fy - 30, 520, 0.4, { t: T });
        CL.fireflies(c, T, { n: 26, x0: 120, y0: 900, w: 840, h: 420, seed: 77, near: 0.35, size: 1.2 });
      },
    });
  });
  X.endCard(ctx, T, 60.667, { l1: 'CÁ LÓC', l2: 'NƯỚNG TRUI', vi: 'Xiên tre. Phủ rơm. Lửa phừng!', en: 'Skewer. Straw. WHOOSH!' });
}

// =====================================================================================
// s22 (64.667–70.0) LIKE & FOLLOW CTA on the moonlit field
// =====================================================================================
const moonPlate = () => xPlate('moonField', 8, ax => CL.floodField(ax, 3, { hut: { X: -500, Z: 2000, lamp: 0.8 }, dike: { Z: 2600 }, xuong: { x: 720, y: 1450, s: 0.55 }, fireflies: 0 }));
function s22(ctx, lt, p, T) {
  const dk = inv(64.667, 65.3, T);
  cam(ctx, 540, 960, lerp(1.12, 1.2, p), 0, () => ctx.drawImage(moonPlate(), 0, 0));
  CL.fireflies(ctx, T, { n: 22, x0: 0, y0: 200, w: W, h: 1500, seed: 31, near: 0.5, size: 1.6 });
  ctx.fillStyle = `rgba(4,6,18,${0.15 + 0.35 * dk})`; ctx.fillRect(0, 0, W, H);
  // tourist pops up from the bottom: grin, frog on his head, thumbs up + wink on 66.667
  const rise = ease.outBack(inv(64.667, 65.3, T));
  const wink = T > 66.667 && T < 67.2 ? 0.05 : 1;
  const fy = 1570 + (1 - rise) * 500 + Math.sin(T * TAU / (4 / 3)) * 4;
  PE.face(ctx, 650, fy, 0.62, { turn: 0.05, open: 1, openR: wink, mouth: 'smile', mOpen: 0.4, brow: wink < 1 ? 0.4 : 0, blush: 0.5, t: T, glassesY: -178 });
  const rib = T > 66.667 ? Math.sin(clamp((T - 66.667) / 0.5) * Math.PI) : 0;
  CL.frog(ctx, 650, fy - 158, 1.5, { t: T, pose: rib > 0 ? 'ribbit' : 'sit', k: rib });
  const th = ease.outBack(inv(66.667, 67.0, T));
  if (T > 66.667) PE.thumbsUp(ctx, 905, fy - 60 + (1 - th) * 500, 0.8, -0.15 + Math.sin(T * 5) * 0.04);
  // Chú Ba peeks in from the left, laughing
  const cu = ease.outBack(inv(65.3, 65.8, T));
  if (cu > 0) CL.chuBaFace(ctx, 230 - (1 - cu) * 450, 1640, 0.62, { expr: 'laugh', t: T, turn: 0.35 });
  ctaLike(ctx, T, 64.667, 64.667, 330, 760);
  ctaFollow(ctx, T, 65.333, 66.0, 700, 760);
  ctaHand(ctx, T, 66.0, 700, 760);
  biText(ctx, X.fadeIO(T, 65.333, 69.25, 0.35, 0.4), 520, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { vsize: 60, esize: 40 });
  const ca = X.fadeIO(T, 66.667, 69.25, 0.4, 0.4);
  if (ca > 0) {
    ctx.save(); ctx.globalAlpha = ca;
    const g = ctx.createLinearGradient(0, 960, 0, 1170); g.addColorStop(0, 'rgba(4,6,16,0)'); g.addColorStop(0.5, 'rgba(4,6,16,0.6)'); g.addColorStop(1, 'rgba(4,6,16,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 960, W, 210); ctx.restore();
    biText(ctx, ca, 1035, 'Bạn dám bắt cá bằng tay không?', 'Would YOU catch it bare-handed?', { vsize: 52, esize: 38, bd: false });
  }
  logo(ctx, X.fadeIO(T, 66.0, 69.25, 0.5, 0.4), 1210);
  const fb = inv(69.333, 70.0, T); if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { s16, s17, s18, s19, s20, s21, s22 };
