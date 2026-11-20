// All on-screen text for cut lon xao me, drawn by render.js after the grade. Safe zone x 70..930, y < 1560.
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
  fit(ctx, 'THEO DÕI ĐỂ XEM MÓN NGON SÀI GÒN', y + 100 + (1 - ease.out(k2)) * 16, 46, 'BodySansBold', '1px', '#ffe6b0');
  fit(ctx, 'FOLLOW FOR MORE SAIGON STREET FOOD', y + 158, 34, 'BodySans', '3px', 'rgba(255,255,255,0.92)');
  ctx.restore();
}
function overlay(ctx, T) {
  ctx.save();
  if (T >= 0.3 && T <= 1.85) { shade(ctx, fadeIO(T, 0.3, 1.85, 0.2, 0.25) * 0.8, 110, 560); title(ctx, T, 0.3, 1.85, 290, 'STIR-FRIED BALUT EGGS', 'CÚT LỘN', 'XÀO ME', 118, 88); }
  cap(ctx, T, 2.1, 5.55, 'Luộc, gõ vỏ, bóc nắp trứng', 'Boil, tap and crack the egg tops', { n: 1 });
  cap(ctx, T, 5.85, 9.3, 'Vắt me lấy nước chua ngọt', 'Squeeze tamarind into sweet-sour sauce', { n: 2 });
  cap(ctx, T, 9.75, 11.3, 'Cái gì trong trứng vậy?!', "What's inside the egg?!", { y: 330, vsize: 64, vcol: '#fff2cf' });
  cap(ctx, T, 11.45, 13.05, 'Đừng xỉu nha anh ơi!', "Don't faint on me!", { y: 330, vsize: 64, vcol: '#fff2cf' });
  cap(ctx, T, 13.35, 16.8, 'Phi tỏi hành thơm lừng', 'Fry garlic & shallots until golden', { n: 3 });
  cap(ctx, T, 17.1, 20.5, 'Xóc lửa lớn, rưới sốt me', 'Toss on high flame with tamarind sauce', { n: 4 });
  cap(ctx, T, 21.0, 26.1, 'Rắc rau răm, ăn nóng!', 'Top with rau răm, serve hot!', { n: 5 });
  cap(ctx, T, 26.7, 28.2, 'Đũa trơn quá trời!', 'Too slippery for chopsticks!', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 28.6, 29.95, 'Mèo ăn mất rồi!', 'The cat got it!', { y: 330, vsize: 66, vcol: '#fff2cf' });
  cap(ctx, T, 30.3, 33.6, 'Muối tiêu chanh, rau răm', 'Salt, pepper, lime & herbs', { vsize: 62 });
  cap(ctx, T, 34.2, 38.8, 'Đến lượt anh rồi nè...', 'Your turn... no pressure', { y: 330, vsize: 64, vcol: '#fff2cf' });
  cap(ctx, T, 44.0, 46.8, 'Béo ngậy, chua ngọt, đã quá!', 'Rich, tangy, so good!', { y: 330, vsize: 62, vcol: '#fff2cf' });
  cap(ctx, T, 48.3, 54.6, 'Cô ơi, thêm một dĩa nữa!', 'One more plate, please!', { y: 330, vsize: 62 });
  ctaText(ctx, T, 55.4, 300);
  ctx.restore();
}
module.exports = { overlay };
