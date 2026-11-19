// All on-screen text for the 40s cut, drawn by render.js AFTER the grade (so shots never draw captions).
// Safe zone x 70..930 (centre 500), y < 1560. Text sits high (y 260..500) so the food stays clear.
const L = require('./lib');
const { W, clamp, ease, lerp } = L;
const { title, fadeIO } = require('./text');

const CX = 500, MAXW = 840;

function topShade(ctx, a, y0, y1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(8,4,2,0)'); g.addColorStop(0.35, 'rgba(8,4,2,0.5)'); g.addColorStop(0.7, 'rgba(8,4,2,0.42)'); g.addColorStop(1, 'rgba(8,4,2,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
  ctx.restore();
}
// draw text centred at CX, shrinking the font until it fits MAXW
function fitText(ctx, txt, y, size, family, spacing, color, minSize = 26) {
  let s = size;
  for (; s > minSize; s -= 2) { ctx.font = `${s}px ${family}`; ctx.letterSpacing = spacing; if (ctx.measureText(txt).width <= MAXW) break; }
  ctx.fillStyle = color; ctx.fillText(txt, CX, y);
  return s;
}
// bilingual caption: vi / en may contain '\n' for a second line. Subtle rise + scale pop.
function cap(ctx, T, t0, t1, vi, en, o = {}) {
  const a = fadeIO(T, t0, t1, 0.3, 0.3);
  if (a <= 0) return;
  const y = o.y || 330;
  const k = clamp((T - t0) / 0.45);
  const sc = lerp(0.92, 1, ease.outBack(k)), dy = (1 - ease.out(k)) * 18;
  const vl = vi.split('\n'), el = en ? en.split('\n') : [];
  const vs = o.vsize || 58, es = o.esize || 34;
  const h = vl.length * vs * 1.18 + el.length * es * 1.3;
  topShade(ctx, a * 0.95, y - vs * 1.6, y + h + 40);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.translate(CX, y + dy); ctx.scale(sc, sc); ctx.translate(-CX, 0);
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 16;
  let yy = 0;
  if (o.n) { // step badge above the VI line
    ctx.save(); ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(CX, -vs * 1.05, 30, 0, Math.PI * 2); ctx.fillStyle = 'rgba(242,194,90,0.96)'; ctx.fill();
    ctx.font = '38px TitleSerif'; ctx.letterSpacing = '0px'; ctx.fillStyle = '#2a1608'; ctx.shadowBlur = 0; ctx.fillText(String(o.n), CX, -vs * 1.05 + 2);
    ctx.restore();
  }
  for (const s of vl) { fitText(ctx, s, yy, vs, 'BodySansBold', '1px', o.vcol || '#ffe6b0'); yy += vs * 1.18; }
  yy += 4;
  for (const s of el) { fitText(ctx, s, yy, es, 'BodySans', '2px', 'rgba(255,255,255,0.92)', 22); yy += es * 1.3; }
  ctx.restore();
}
// dialogue line: quoted, warm white, same position as captions
function talk(ctx, T, t0, t1, vi, en) {
  cap(ctx, T, t0, t1, '“' + vi + '”', en, { vsize: 56, vcol: '#fff2cf' });
}
// CTA block: big gold "LIKE & FOLLOW" + VI + EN lines, popped in
function ctaFollow(ctx, T, t0, t1, y = 300) {
  const a = fadeIO(T, t0, t1, 0.25, 0.01);
  if (a <= 0) return;
  topShade(ctx, a, y - 130, y + 230);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const k1 = clamp((T - t0) / 0.45), s1 = lerp(0.6, 1, ease.outBack(k1));
  ctx.save(); ctx.translate(CX, y); ctx.scale(s1, s1);
  const tg = ctx.createLinearGradient(0, -50, 0, 50);
  tg.addColorStop(0, '#fff4cf'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#c4843a');
  ctx.shadowColor = 'rgba(255,150,40,0.55)'; ctx.shadowBlur = 30; ctx.fillStyle = tg;
  ctx.font = '96px TitleSerif'; ctx.letterSpacing = '6px'; ctx.fillText('LIKE & FOLLOW', 0, 0);
  ctx.restore();
  const k2 = clamp((T - t0 - 0.3) / 0.4);
  ctx.globalAlpha = a * k2; ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 14;
  const dy = (1 - ease.out(k2)) * 16;
  fitText(ctx, 'THEO DÕI ĐỂ KHÁM PHÁ MÓN NGON MIỀN TÂY', y + 100 + dy, 46, 'BodySansBold', '1px', '#ffe6b0');
  fitText(ctx, 'FOLLOW FOR MORE MEKONG DELTA FOOD', y + 158 + dy, 34, 'BodySans', '3px', 'rgba(255,255,255,0.92)');
  ctx.restore();
}

function overlay(ctx, T) {
  ctx.save();
  if (T >= 1.25 && T <= 4.85) {
    topShade(ctx, fadeIO(T, 1.25, 4.85, 0.3, 0.4) * 0.8, 240, 720);
    title(ctx, T, 1.25, 4.85, 430, 'MEKONG DELTA CRISPY PANCAKE', 'BÁNH XÈO', 'MIỀN TÂY', 118, 88);
  }
  cap(ctx, T, 5.25, 10.7, 'TÔM TƯƠI – THỊT NGON – CỦ HỦ DỪA', 'FRESH SHRIMP – TENDER PORK – COCONUT HEART', { vsize: 52 });
  cap(ctx, T, 13.5, 17.4, 'GIÒN RỤM TỪNG MIẾNG', 'INCREDIBLY CRISPY IN EVERY BITE', { vsize: 64 });
  cap(ctx, T, 21.85, 24.9, 'VÀNG GIÒN BÊN NGOÀI\nĐẬM ĐÀ BÊN TRONG', 'GOLDEN AND CRISPY OUTSIDE\nRICH AND FLAVORFUL INSIDE', { vsize: 58 });
  cap(ctx, T, 25.25, 33.2, 'CUỐN RAU – CHẤM MẮM\nNGON KHÓ CƯỠNG!', 'FRESH HERBS – DIPPING SAUCE – IRRESISTIBLE!', { vsize: 58 });
  cap(ctx, T, 33.8, 36.55, 'BẠN ĐÃ THỬ MÓN NÀY CHƯA?', 'HAVE YOU TRIED THIS DISH?', { vsize: 62, y: 320 });
  ctaFollow(ctx, T, 36.667, 40.01, 300);
  ctx.restore();
}

module.exports = { overlay, cap, ctaFollow };
