// All on-screen text for the 15 s demo, drawn by render.js after the grade. Safe zone x 70..930, y < 1560.
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
  fit(ctx, 'THEO DÕI ĐỂ KHÁM PHÁ MÓN NGON MIỀN TÂY', y + 100 + (1 - ease.out(k2)) * 16, 46, 'BodySansBold', '1px', '#ffe6b0');
  fit(ctx, 'FOLLOW FOR MORE MEKONG DELTA FOOD', y + 158, 34, 'BodySans', '3px', 'rgba(255,255,255,0.92)');
  ctx.restore();
}
function overlay(ctx, T) {
  ctx.save();
  if (T >= 0.35 && T <= 1.45) { shade(ctx, fadeIO(T, 0.35, 1.45, 0.2, 0.3) * 0.8, 110, 560); title(ctx, T, 0.35, 1.45, 290, 'MEKONG DELTA CRISPY PANCAKE', 'BÁNH XÈO', 'MIỀN TÂY', 118, 88); }
  cap(ctx, T, 1.55, 2.72, 'Đổ bột, tráng thật mỏng', 'Pour the batter, spread it thin', { n: 1 });
  cap(ctx, T, 2.9, 4.4, 'Tôm, thịt, giá vào chảo', 'Shrimp, pork & sprouts in', { n: 2 });
  cap(ctx, T, 4.55, 6.6, 'Vàng giòn thì gấp đôi', 'Golden & crispy? Fold it!', { n: 3 });
  cap(ctx, T, 6.75, 8.3, 'GIÒN RỤM TỪNG MIẾNG', 'INCREDIBLY CRISPY IN EVERY BITE', { vsize: 64 });
  cap(ctx, T, 8.4, 9.95, 'Cuốn rau, chấm mắm', 'Wrap it, dip it', { n: 4, y: 290 });
  cap(ctx, T, 10.2, 11.08, 'Giòn quá trời!', 'So CRUNCHY!', { y: 330, vsize: 66, vcol: '#fff2cf' });
  ctaText(ctx, T, 11.67, 300);
  ctx.restore();
}
module.exports = { overlay };
