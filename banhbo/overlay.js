// All on-screen text for banh bo nuong, drawn by render.js after the grade. Safe zone x 70..930, y < 1560.
const L = require('./lib');
const { W, clamp, ease, lerp } = L;
const { title, fadeIO } = require('./text');
const CX = 500, MAXW = 840;

function shade(ctx, a, y0, y1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.35, 'rgba(8,4,2,0.5)'); g.addColorStop(0.7, 'rgba(8,4,2,0.42)'); g.addColorStop(1, 'rgba(8,4,2,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0); ctx.restore();
}
function fit(ctx, txt, y, size, fam, sp, col, min = 24) {
  let s = size; for (; s > min; s -= 2) { ctx.font = `${s}px ${fam}`; ctx.letterSpacing = sp; if (ctx.measureText(txt).width <= MAXW) break; }
  ctx.fillStyle = col; ctx.fillText(txt, CX, y);
}
// step caption: gold number badge above VI line, EN line under it
function cap(ctx, T, t0, t1, vi, en, o = {}) {
  const a = fadeIO(T, t0, t1, 0.25, 0.25); if (a <= 0) return;
  const y = o.y || 360, k = clamp((T - t0) / 0.4), sc = lerp(0.92, 1, ease.outBack(k)), dy = (1 - ease.out(k)) * 16, vs = o.vsize || 60;
  shade(ctx, a, y - 130, y + 170);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(CX, y + dy); ctx.scale(sc, sc); ctx.translate(-CX, 0);
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 16;
  if (o.n) {
    ctx.save(); ctx.beginPath(); ctx.arc(CX, -vs * 1.05, 30, 0, Math.PI * 2); ctx.fillStyle = 'rgba(242,194,90,0.96)'; ctx.fill();
    ctx.shadowBlur = 0; ctx.font = '38px TitleSerif'; ctx.letterSpacing = '0px'; ctx.fillStyle = '#2a1608'; ctx.fillText(String(o.n), CX, -vs * 1.05 + 2); ctx.restore();
  }
  fit(ctx, vi, 0, vs, 'BodySansBold', '1px', o.vcol || '#ffe6b0');
  fit(ctx, en, vs * 0.95, 34, 'BodySans', '2px', 'rgba(255,255,255,0.92)', 22);
  ctx.restore();
}
function ctaText(ctx, T, t0, y = 300) {
  const a = clamp((T - t0) / 0.3); if (a <= 0) return;
  shade(ctx, a, y - 140, y + 240);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const s1 = lerp(0.6, 1, ease.outBack(clamp((T - t0) / 0.45)));
  ctx.save(); ctx.translate(CX, y); ctx.scale(s1, s1);
  const tg = ctx.createLinearGradient(0, -50, 0, 50); tg.addColorStop(0, '#fff4cf'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#c4843a');
  ctx.shadowColor = 'rgba(255,150,40,0.55)'; ctx.shadowBlur = 30; ctx.fillStyle = tg; ctx.font = '96px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillText('LIKE & FOLLOW', 0, 0);
  ctx.restore();
  const k2 = clamp((T - t0 - 0.3) / 0.4); ctx.globalAlpha = a * k2; ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 14;
  fit(ctx, 'THEO DÕI ĐỂ XEM MÓN NGON MIỀN TÂY', y + 100 + (1 - ease.out(k2)) * 16, 46, 'BodySansBold', '1px', '#ffe6b0');
  fit(ctx, 'FOLLOW FOR MORE MEKONG DELTA FOOD', y + 158, 34, 'BodySans', '3px', 'rgba(255,255,255,0.92)');
  ctx.restore();
}
function overlay(ctx, T) {
  ctx.save();
  if (T >= 0.35 && T <= 2.25) { shade(ctx, fadeIO(T, 0.35, 2.25, 0.2, 0.3) * 0.8, 110, 560); title(ctx, T, 0.35, 2.25, 290, 'PANDAN HONEYCOMB CAKE', 'BÁNH BÒ NƯỚNG', 'LÁ DỨA', 118, 88); }
  cap(ctx, T, 2.55, 5.65, 'Giã lá dứa, vắt nước cốt', 'Pound the pandan, squeeze out the juice', { n: 1 });
  cap(ctx, T, 6.0, 10.25, 'Trộn bột, trứng, nước cốt dừa', 'Mix flour, eggs & coconut milk', { n: 2 });
  cap(ctx, T, 10.7, 12.3, 'Matcha hả?!', 'Is this... matcha?', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 12.45, 13.8, 'Lá dứa! Đừng ăn lá!', "Pandan! Don't eat the leaf!", { y: 330, vsize: 62, vcol: '#fff2cf' });
  cap(ctx, T, 14.0, 17.2, 'Quét dầu, đổ bột vào khuôn', 'Oil the mould, pour the batter', { n: 3 });
  cap(ctx, T, 17.5, 21.9, 'Nướng than trên dưới', 'Charcoal above & below', { n: 4 });
  cap(ctx, T, 22.0, 23.9, '30 phút sau...', '30 minutes later...', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 25.0, 28.6, 'VÀNG NÂU, THƠM LỪNG', 'GOLDEN & FRAGRANT', { vsize: 64 });
  cap(ctx, T, 29.0, 32.2, 'Lỗ khí như tổ ong', 'Honeycomb air pockets', { vsize: 62 });
  cap(ctx, T, 32.55, 34.85, 'Dùng dao nĩa hả?', 'Knife & fork? Really?', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 35.0, 36.85, 'Xé bằng tay nè!', 'Tear it by hand!', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 37.5, 41.0, 'Kéo sợi dài cả mét!', 'A one-metre stretch!', { vsize: 64 });
  cap(ctx, T, 41.5, 43.7, 'Dính hết kính rồi!', 'Stuck on the sunglasses!', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 47.0, 49.0, 'Dai dai, thơm thơm!', 'Chewy & fragrant!', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 52.3, 56.9, 'Mai anh ghé nữa nha!', 'See you tomorrow!', { y: 330, vsize: 62 });
  ctaText(ctx, T, 57.7, 300);
  ctx.restore();
}
module.exports = { overlay };
