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
// main title slam
function title(ctx, T, t0, t1, y = 470, sub = 'Saigon Black Coffee') {
  const k = T - t0;
  if (k < 0 || T > t1) return;
  const a = clamp(k / 0.12) * clamp((t1 - T) / 0.4);
  const sc = lerp(1.35, 1, ease.outExpo(clamp(k / 0.5)));
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(W / 2, y); ctx.scale(sc, sc);
  const tg = ctx.createLinearGradient(0, -120, 0, 120);
  tg.addColorStop(0, '#fff4cf'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#b8762a');
  ctx.shadowColor = 'rgba(255,150,40,0.55)'; ctx.shadowBlur = 40; ctx.fillStyle = tg;
  ctx.font = '112px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillText('CÀ PHÊ ĐEN', 0, -60);
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
  ctx.font = '104px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillText('CÀ PHÊ ĐEN', 0, -70);
  ctx.font = '80px TitleSerif'; ctx.letterSpacing = '16px'; ctx.fillText('SÀI GÒN', 0, 30);
  ctx.shadowBlur = 0;
  const a2 = clamp((k - 0.5) / 0.5);
  ctx.globalAlpha = a * a2;
  ctx.font = '54px BodySansBold'; ctx.letterSpacing = '4px'; ctx.fillStyle = '#ffe6b0'; ctx.fillText('Đậm. Đắng. Phê.', 0, 140);
  ctx.font = '38px BodySans'; ctx.letterSpacing = '3px'; ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillText('Bold. Bitter. Unforgettable.', 0, 200);
  ctx.fillStyle = 'rgba(242,194,90,0.85)'; ctx.fillRect(-90, 250, 180, 3);
  ctx.font = '34px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillStyle = 'rgba(255,236,200,0.9)'; ctx.fillText('DISH TALES', 0, 296);
  ctx.restore();
}

module.exports = { caption, line, label, title, endCard, fadeIO, CAP_Y };
