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
  ctx.translate(500, y); ctx.scale(sc, sc);
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
function goldText(ctx, y0, y1) {
  const tg = ctx.createLinearGradient(0, y0, 0, y1);
  tg.addColorStop(0, '#fff4cf'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#b8762a');
  return tg;
}
// shrink font until text fits maxW
function fitFont(ctx, txt, size, fam, maxW) {
  let fs = size; ctx.font = `${fs}px ${fam}`;
  while (ctx.measureText(txt).width > maxW && fs > 20) { fs -= 2; ctx.font = `${fs}px ${fam}`; }
  return fs;
}
// main title slam: MÌ XÀO GIÒN / CHỢ LỚN / Crispy Fried Noodles
function title(ctx, T, t0, t1, y = 470) {
  const k = T - t0;
  if (k < 0 || T > t1) return;
  const a = clamp(k / 0.12) * clamp((t1 - T) / 0.4);
  const sc = lerp(1.35, 1, ease.outExpo(clamp(k / 0.5)));
  backdrop(ctx, a * 0.8, y + 40);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(255,120,30,0.6)'; ctx.shadowBlur = 40; ctx.fillStyle = goldText(ctx, -120, 120);
  ctx.letterSpacing = '6px'; fitFont(ctx, 'MÌ XÀO GIÒN', 120, 'TitleSerif', 820); ctx.fillText('MÌ XÀO GIÒN', 0, -60);
  ctx.font = '76px TitleSerif'; ctx.letterSpacing = '18px'; ctx.fillText('CHỢ LỚN', 0, 48);
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(242,194,90,0.9)'; ctx.fillRect(-170, 104, 340, 3);
  ctx.font = '44px BodySans'; ctx.letterSpacing = '5px'; ctx.fillStyle = 'rgba(255,248,232,0.95)'; ctx.fillText('Crispy Fried Noodles', 0, 156);
  ctx.restore();
}
function endCard(ctx, T, t0) {
  const k = T - t0;
  if (k < 0) return;
  const a = clamp(k / 0.5);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, 0, 0, 1050); g.addColorStop(0, 'rgba(10,5,2,0.85)'); g.addColorStop(0.75, 'rgba(10,5,2,0.7)'); g.addColorStop(1, 'rgba(10,5,2,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 1050);
  const z = lerp(1.08, 1, ease.out(clamp(k / 1.2)));
  ctx.translate(W / 2, 450); ctx.scale(z, z);
  ctx.shadowColor = 'rgba(255,120,30,0.55)'; ctx.shadowBlur = 36; ctx.fillStyle = goldText(ctx, -120, 120);
  ctx.letterSpacing = '6px'; fitFont(ctx, 'MÌ XÀO GIÒN', 112, 'TitleSerif', 820); ctx.fillText('MÌ XÀO GIÒN', 0, -60);
  ctx.font = '64px TitleSerif'; ctx.letterSpacing = '16px'; ctx.fillText('CHỢ LỚN', 0, 36);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = a * clamp((k - 0.5) / 0.5);
  ctx.letterSpacing = '2px'; ctx.fillStyle = '#ffe6b0'; fitFont(ctx, 'Giòn. Sánh. Đậm vị Chợ Lớn.', 52, 'BodySansBold', 840); ctx.fillText('Giòn. Sánh. Đậm vị Chợ Lớn.', 0, 140);
  ctx.font = '38px BodySans'; ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('Crunchy. Saucy. Pure Cholon.', 0, 200);
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(-90, 250, 180, 3);
  ctx.font = '34px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,236,200,0.9)'; ctx.fillText('DISH TALES', 0, 296);
  ctx.restore();
}

// ---------------- CTA helpers ----------------
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
// LIKE heart button + "+1"
function ctaLike(ctx, T, t0, x = 330, y = 760) {
  const k = T - t0; if (k < 0) return;
  const pop = ease.outBack(clamp(k / 0.45));
  const pulse = k > 0.45 ? 1 + 0.08 * Math.max(0, Math.sin(((k - 0.45) / 0.5) * Math.PI * 2)) : 1;
  ctx.save(); ctx.globalAlpha = clamp(k / 0.15);
  ctx.beginPath(); ctx.arc(x, y, 105 * pop, 0, Math.PI * 2); ctx.fillStyle = 'rgba(20,10,8,0.55)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.stroke();
  heart(ctx, x, y + 12, 1.15 * pop * pulse, '#fe2c55');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '38px BodySansBold'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
  ctx.fillText('THÍCH', x, y + 150); ctx.font = '30px BodySans'; ctx.fillStyle = '#fff'; ctx.fillText('LIKE', x, y + 192);
  const f = clamp((k - 0.2) / 1.2);
  if (f > 0 && f < 1) { ctx.globalAlpha = Math.sin(f * Math.PI); ctx.font = '60px BodySansBold'; ctx.fillStyle = '#ff5c7a'; ctx.fillText('+1', x + 110, y - 90 - f * 120); }
  ctx.restore();
}
// FOLLOW pill; pressed at tp -> grey "ĐÃ THEO DÕI / FOLLOWING" with path checkmark
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
  if (pk >= 0 && pk < 0.4) L.glow(ctx, x, y, 260, 'rgba(255,240,220,0.9)', 1 - pk / 0.4);
  if (pk >= 0) confetti(ctx, T, tp, x, y);
}
function confetti(ctx, T, t0, x, y) {
  const k = T - t0; if (k < 0 || k > 2.2) return;
  const r = L.rng(515), cols = ['#fe2c55', '#25f4ee', '#ffd76a', '#ffffff', '#7cf07a'];
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.8, v = 500 + r() * 700, sz = 8 + r() * 10, spin = (r() - 0.5) * 16, c = cols[i % cols.length];
    const px = x + Math.cos(a) * v * k * 0.7, py = y + Math.sin(a) * v * k * 0.7 + 700 * k * k;
    ctx.globalAlpha = clamp(1 - k / 2.2); ctx.fillStyle = c;
    ctx.save(); ctx.translate(px, py); ctx.rotate(spin * k); ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2); ctx.restore();
  }
  ctx.restore();
}
// cartoon pointing hand pressing at (x,y): comes from lower right, press at tp
function ctaHand(ctx, T, tp, x, y) {
  const k = T - (tp - 0.55); if (k < 0 || T > tp + 0.9) return;
  const appr = ease.out(clamp(k / 0.45)), back = ease.in(clamp((T - tp - 0.35) / 0.5));
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
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(W / 2 - 80, y - 40, 160, 3);
  ctx.font = '44px TitleSerif'; ctx.letterSpacing = '10px'; ctx.fillStyle = '#ffe6b0'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 12;
  ctx.fillText('DISH TALES', W / 2, y);
  ctx.restore();
}
// generic bilingual block centred at y with auto-fit inside x 70..930
function biText(ctx, a, y, vi, en, o = {}) {
  if (a <= 0) return;
  if (o.bd !== false) backdrop(ctx, a * 0.85, y + 20);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 14; ctx.letterSpacing = '1px';
  ctx.fillStyle = o.vcol || '#ffe6b0'; fitFont(ctx, vi, o.vsize || 62, o.serif ? 'TitleSerif' : 'BodySansBold', 840); ctx.fillText(vi, 500, y);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; fitFont(ctx, en, o.esize || 40, 'BodySans', 840); ctx.fillText(en, 500, y + (o.gap || 66));
  ctx.restore();
}

module.exports = { caption, line, label, title, endCard, fadeIO, backdrop, CAP_Y, fitFont, ctaLike, ctaFollow, ctaHand, confetti, logo, biText, heart };
