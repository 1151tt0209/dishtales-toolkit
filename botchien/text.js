// Bilingual on-screen text for the vertical Short (safe zone: x 70..930, y < 1560).
const L = require('./lib');
const { W, H, clamp, ease, lerp } = L;

const CAP_Y = 1395; // VN line baseline area
function fadeIO(T, t0, t1, fin = 0.3, fout = 0.3) {
  return clamp((T - t0) / fin) * clamp((t1 - T) / fout);
}
function backdrop(ctx, a, y = CAP_Y) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y - 170, 0, y + 190);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, 'rgba(8,4,2,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 170, W, 360);
  ctx.restore();
}
// step caption: badge number + VN (big) + EN (small)
function caption(ctx, T, t0, t1, vi, en, o = {}) {
  const a = fadeIO(T, t0, t1);
  if (a <= 0) return;
  const y = (o.y || CAP_Y) + (1 - ease.out(clamp((T - t0) / 0.35))) * 24;
  backdrop(ctx, a * 0.9, o.y || CAP_Y);
  ctx.save(); ctx.globalAlpha = a; ctx.textBaseline = 'middle';
  ctx.font = `${o.vsize || 58}px BodySansBold`; ctx.letterSpacing = '1px';
  const vw = ctx.measureText(vi).width, bw = o.n ? 74 : 0, total = vw + bw;
  const cx = 505 - total / 2;
  if (o.n) {
    ctx.beginPath(); ctx.arc(cx + 28, y, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(242,194,90,0.95)'; ctx.fill();
    ctx.font = '36px TitleSerif'; ctx.textAlign = 'center'; ctx.fillStyle = '#2a1608'; ctx.fillText(String(o.n), cx + 28, y + 2);
  }
  ctx.font = `${o.vsize || 58}px BodySansBold`; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14;
  ctx.fillStyle = o.vcol || '#ffe6b0'; ctx.fillText(vi, cx + bw, y);
  ctx.font = `${o.esize || 40}px BodySans`; ctx.letterSpacing = '2px'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(en, 505, y + 64);
  ctx.restore();
}
// dialogue / reaction line (italic look via skew), centred
function line(ctx, T, t0, t1, vi, en, o = {}) {
  const a = fadeIO(T, t0, t1, 0.2, 0.3);
  if (a <= 0) return;
  const y = o.y || CAP_Y, sc = 0.9 + 0.1 * ease.outBack(clamp((T - t0) / 0.35));
  backdrop(ctx, a * 0.85, y);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${o.vsize || 62}px ${o.serif ? 'TitleSerif' : 'BodySansBold'}`;
  let mw = ctx.measureText(vi).width; if (en) { ctx.font = `${o.esize || 42}px BodySans`; mw = Math.max(mw, ctx.measureText(en).width); }
  const fit = Math.min(1, 840 / mw);
  ctx.translate(500, y); ctx.scale(sc * fit, sc * fit);
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 16;
  ctx.font = `${o.vsize || 62}px ${o.serif ? 'TitleSerif' : 'BodySansBold'}`; ctx.fillStyle = o.vcol || '#fff2cf';
  ctx.fillText(vi, 0, 0);
  if (en) { ctx.font = `${o.esize || 42}px BodySans`; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(en, 0, 68); }
  ctx.restore();
}
// small top label (time / location)
function label(ctx, T, t0, t1, vi, en, y = 300) {
  const a = fadeIO(T, t0, t1, 0.5, 0.4);
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
  ctx.font = '50px BodySansBold'; ctx.letterSpacing = '8px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText(vi, W / 2, y);
  ctx.font = '36px BodySans'; ctx.letterSpacing = '4px'; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillText(en, W / 2, y + 58);
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(W / 2 - 60, y - 52, 120, 3);
  ctx.restore();
}
// main title slam
function title(ctx, T, t0, t1, y = 470, sub = 'Saigon Fried Rice-Flour Cake') {
  const k = T - t0;
  if (k < 0 || T > t1) return;
  const a = clamp(k / 0.12) * clamp((t1 - T) / 0.4);
  const sc = lerp(1.35, 1, ease.outExpo(clamp(k / 0.5)));
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  const tg = ctx.createLinearGradient(0, -120, 0, 120);
  tg.addColorStop(0, '#fff4cf'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#b8762a');
  ctx.shadowColor = 'rgba(255,150,40,0.55)'; ctx.shadowBlur = 40; ctx.fillStyle = tg;
  ctx.font = '112px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillText('BỘT CHIÊN', 0, -60);
  ctx.font = '86px TitleSerif'; ctx.letterSpacing = '18px'; ctx.fillText('SÀI GÒN', 0, 50);
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(242,194,90,0.9)'; ctx.fillRect(-170, 112, 340, 3);
  ctx.font = '44px BodySans'; ctx.letterSpacing = '5px'; ctx.fillStyle = 'rgba(255,248,232,0.95)'; ctx.fillText(sub, 0, 165);
  ctx.restore();
}
function endCard(ctx, T, t0) {
  const k = T - t0;
  if (k < 0) return;
  const a = clamp(k / 0.5);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, 0, 0, 1050); g.addColorStop(0, 'rgba(10,5,2,0.85)'); g.addColorStop(0.75, 'rgba(10,5,2,0.7)'); g.addColorStop(1, 'rgba(10,5,2,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 1050);
  ctx.translate(W / 2, 470); ctx.scale(lerp(1.08, 1, ease.out(clamp(k / 1.2))), lerp(1.08, 1, ease.out(clamp(k / 1.2))));
  const tg = ctx.createLinearGradient(0, -120, 0, 120);
  tg.addColorStop(0, '#fff4cf'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#b8762a');
  ctx.shadowColor = 'rgba(255,150,40,0.5)'; ctx.shadowBlur = 36; ctx.fillStyle = tg;
  ctx.font = '104px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillText('BỘT CHIÊN', 0, -70);
  ctx.font = '80px TitleSerif'; ctx.letterSpacing = '16px'; ctx.fillText('SÀI GÒN', 0, 30);
  ctx.shadowBlur = 0;
  const a2 = clamp((k - 0.5) / 0.5);
  ctx.globalAlpha = a * a2;
  ctx.font = '50px BodySansBold'; ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('Giòn. Béo. Đậm vị Sài Gòn.', 0, 140);
  ctx.font = '38px BodySans'; ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('Crispy. Eggy. Pure Saigon.', 0, 200);
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(-90, 250, 180, 3);
  ctx.font = '34px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,236,200,0.9)'; ctx.fillText('DISH TALES', 0, 296);
  ctx.restore();
}


// ---------- CTA (shot 28): heart LIKE + FOLLOW pill pressed by a cartoon hand ----------
const P = require('./props');
const SK = ['#f7d2b5', '#e3a07e', '#c97c5e'];
function heartPath(ctx, r) {
  ctx.beginPath(); ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.25, r * 0.1, -r * 1.05, -r * 0.95, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 1.05, -r * 0.95, r * 1.25, r * 0.1, 0, r * 0.95); ctx.closePath();
}
function cta(ctx, T) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // heart
  const hk = T - 84.7;
  if (hk > 0) {
    const pop = ease.outBack(clamp(hk / 0.45)), ph = ((T - 85.2) % 0.5 + 0.5) % 0.5;
    const pulse = T > 85.2 ? 1 + 0.09 * Math.sin(Math.PI * clamp(ph / 0.22)) : 1;
    ctx.save(); ctx.translate(330, 760); ctx.scale(pop * pulse, pop * pulse);
    ctx.shadowColor = 'rgba(254,44,85,0.75)'; ctx.shadowBlur = 50;
    heartPath(ctx, 110); const hg = ctx.createLinearGradient(0, -110, 0, 110); hg.addColorStop(0, '#ff6a86'); hg.addColorStop(1, '#e0143f');
    ctx.fillStyle = hg; ctx.fill(); ctx.shadowBlur = 0;
    ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-48, -38, 22, 13, -0.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    ctx.restore();
    const la = clamp((hk - 0.25) / 0.3);
    ctx.globalAlpha = la; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12;
    ctx.font = '46px BodySansBold'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('THÍCH', 330, 912);
    ctx.font = '32px BodySans'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('LIKE', 330, 960);
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    // +1 bubbles: one per pulse
    for (let i = 0; i < 9; i++) {
      const k = T - (84.95 + i * 0.5); if (k < 0 || k > 0.9) continue;
      ctx.globalAlpha = 1 - k / 0.9; ctx.font = `${54 - k * 10}px BodySansBold`; ctx.fillStyle = '#ff4f73';
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8;
      ctx.fillText('+1', 330 + 60 + Math.sin(i * 2.1) * 30, 640 - ease.out(k / 0.9) * 170);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  }
  // follow pill
  const fk = T - 85.2;
  if (fk > 0) {
    const pressed = T >= 86.0, press = T > 85.92 && T < 86.18 ? 0.9 : 1;
    const sx = lerp(520, 0, ease.outBack(clamp(fk / 0.5)));
    ctx.save(); ctx.translate(700 + sx, 760); ctx.scale(press, press);
    const w = 360, h = 124;
    ctx.shadowColor = pressed ? 'rgba(0,0,0,0.5)' : 'rgba(254,44,85,0.7)'; ctx.shadowBlur = 36;
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fillStyle = pressed ? '#4a4a4f' : '#fe2c55'; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    if (!pressed) {
      ctx.font = '46px BodySansBold'; ctx.fillText('THEO DÕI', 0, -14);
      ctx.font = '28px BodySans'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('FOLLOW', 0, 30);
    } else {
      ctx.strokeStyle = '#7dffa0'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-150, -16); ctx.lineTo(-134, 0); ctx.lineTo(-108, -32); ctx.stroke();
      ctx.font = '38px BodySansBold'; ctx.fillText('ĐÃ THEO DÕI', 18, -14);
      ctx.font = '26px BodySans'; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillText('FOLLOWING', 18, 28);
    }
    ctx.restore();
    // flash + confetti
    const ck = T - 86.0;
    if (ck > 0 && ck < 1.4) {
      L.glow(ctx, 700, 760, 320, 'rgba(255,240,220,1)', 0.6 * Math.max(0, 1 - ck / 0.35));
      const r = L.rng(77), cols = ['#fe2c55', '#ffd84a', '#25f4ee', '#ffffff', '#7dffa0'];
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2, v = 380 + r() * 520, x = 700 + Math.cos(a) * v * ck, y = 760 + Math.sin(a) * v * ck * 0.8 + 600 * ck * ck;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - ck / 1.4); ctx.translate(x, y); ctx.rotate(r() * 6 + ck * (6 + r() * 8));
        ctx.fillStyle = cols[i % 5]; ctx.fillRect(-9, -5, 18, 10); ctx.restore();
      }
    }
  }
  // cartoon hand presses the pill at 86.0
  const hk2 = T - 85.55;
  if (hk2 > 0 && hk2 < 1.4) {
    const inK = ease.out(clamp(hk2 / 0.45)), outK = ease.in(clamp((hk2 - 0.85) / 0.5));
    const tx = 735, ty = 790 + (1 - inK) * 700 + outK * 900;
    const th = -1.85, s = 1.25, c = Math.cos(th), sn = Math.sin(th);
    const ox = tx - s * (90 * c + 22 * sn), oy = ty - s * (90 * sn - 22 * c), wx = ox - s * 55 * c, wy = oy - s * 55 * sn;
    P.forearm(ctx, wx - c * 900, wy - sn * 900, wx, wy, SK[1], '#2f8f8a', 78 * s);
    P.hand(ctx, ox, oy, s, th, 'point', SK);
  }
  // captions
  line(ctx, T, 85.0, 89.4, 'Thấy ngon thì LIKE & FOLLOW nhé!', 'Hungry? LIKE & FOLLOW for more!', { y: 500, vsize: 60 });
  line(ctx, T, 86.5, 89.4, 'Món tiếp theo là gì? Comment nhé!', 'Which dish next? Tell us in the comments!', { y: 1390, vsize: 56, esize: 38 });
  // logo
  const la = fadeIO(T, 85.4, 89.4, 0.5, 0.3);
  if (la > 0) {
    ctx.globalAlpha = la; ctx.shadowColor = 'rgba(255,150,40,0.6)'; ctx.shadowBlur = 24;
    ctx.font = '58px TitleSerif'; ctx.letterSpacing = '10px'; ctx.fillStyle = '#f2c25a'; ctx.fillText('DISH TALES', W / 2, 1515);
    ctx.shadowBlur = 0; ctx.letterSpacing = '0px'; ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(W / 2 - 230, 1513, 40, 3); ctx.fillRect(W / 2 + 190, 1513, 40, 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // fade to black
  const fb = clamp((T - 89.4) / 0.6);
  if (fb > 0) { ctx.fillStyle = `rgba(0,0,0,${fb})`; ctx.fillRect(0, 0, W, H); }
}

module.exports = { caption, line, label, title, endCard, cta, fadeIO, CAP_Y };
