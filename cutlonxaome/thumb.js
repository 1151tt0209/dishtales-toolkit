// Thumbnail maker: node render.js --stills 24.2 --notext  &&  node thumb.js [still.png] [out-prefix]
// Writes <prefix>_vertical.png (1080x1920, Shorts) and <prefix>_wide.png (1280x720, for the Studio uploader).
const fs = require('fs');
const L = require('./lib');                       // registers TitleSerif / BodySans / BodySansBold
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const TAU = Math.PI * 2;

function star(ctx, x, y, r, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.fillStyle = '#fff6d6'; ctx.shadowColor = 'rgba(255,220,120,1)'; ctx.shadowBlur = r * 0.6;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.16 : r, ang = i * Math.PI / 4; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function outlined(ctx, txt, x, y, font, fill, stroke, sw, sp = '0px', maxW = 940) {
  ctx.font = font; ctx.letterSpacing = sp;
  // shrink the font until the text (plus its outline) fits maxW
  let px = parseInt(font, 10);
  while (ctx.measureText(txt).width + sw > maxW && px > 20) { px -= 4; font = font.replace(/^\d+px/, px + 'px'); ctx.font = font; } ctx.lineJoin = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = sw * 1.4; ctx.shadowOffsetY = sw * 0.35;
  ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.strokeText(txt, x, y);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function goldGrad(ctx, y, h) {
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#ffd85a'); g.addColorStop(1, '#f08a1c'); return g;
}

async function main() {
  const still = process.argv[2] || 'previews/still_24.20.png', prefix = process.argv[3] || 'thumbnail';
  const img = await loadImage(still);

  // ------------------------------------------------------------ vertical 1080x1920
  {
    const W = 1080, H = 1920, c = createCanvas(W, H), x = c.getContext('2d');
    // zoom into the broken crêpe (food bigger), keep it low so the headline has room
    x.save(); x.translate(540, 1210); x.scale(1.08, 1.08); x.translate(-540, -1100); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0); x.restore();
    // warm punch + vignette + top shade for the headline
    x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,170,60,0.35)'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    let g = x.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, 'rgba(12,4,0,0.82)'); g.addColorStop(0.55, 'rgba(12,4,0,0.45)'); g.addColorStop(1, 'rgba(12,4,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 900);
    g = x.createRadialGradient(540, 1150, 500, 540, 1150, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    // headline
    outlined(x, 'CÚT LỘN!', 540, 330, '230px TitleSerif', goldGrad(x, 330, 230), '#3a1204', 26, '4px', 960);
    outlined(x, 'XÀO ME SÀI GÒN', 540, 520, '78px BodySansBold', '#fff2cf', '#3a1204', 14, '2px');
    // english strap on a red ribbon
    x.save(); x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 24; x.fillStyle = '#d6281c';
    x.beginPath(); x.roundRect(150, 590, 780, 92, 20); x.fill(); x.restore();
    x.fillStyle = 'rgba(255,255,255,0.2)'; x.fillRect(150, 590, 780, 8);
    x.font = '44px BodySansBold'; x.letterSpacing = '4px'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('STIR-FRIED BALUT EGGS', 540, 638);
    // sparkles around the filling
    [[330, 1020, 62, 0.95], [790, 980, 48, 0.85], [560, 880, 40, 0.8], [180, 1150, 34, 0.7], [900, 1190, 38, 0.75]].forEach(([sx, sy, r, a]) => star(x, sx, sy, r, a));
    // channel tag
    x.font = '40px TitleSerif'; x.letterSpacing = '10px'; x.fillStyle = 'rgba(255,236,200,0.95)'; x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 12; x.fillText('DISH TALES', 540, 1500);
    fs.writeFileSync(`${prefix}_vertical.png`, await c.encode('png'));
  }

  // ------------------------------------------------------------ wide 1280x720 (crop around the crêpe)
  {
    const W = 1280, H = 720, c = createCanvas(W, H), x = c.getContext('2d');
    const sw = 1080, sh = 607.5, sy0 = 700;
    x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, sy0, sw, sh, 0, 0, W, H);
    x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,170,60,0.35)'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    let g = x.createLinearGradient(0, 0, 0, 430); g.addColorStop(0, 'rgba(12,4,0,0.85)'); g.addColorStop(1, 'rgba(12,4,0,0)'); x.fillStyle = g; x.fillRect(0, 0, W, 430);
    g = x.createRadialGradient(640, 420, 380, 640, 420, 900); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    outlined(x, 'CÚT LỘN!', 640, 105, '175px TitleSerif', goldGrad(x, 105, 175), '#3a1204', 20, '3px', 1100);
    outlined(x, 'XÀO ME SÀI GÒN', 640, 218, '58px BodySansBold', '#fff2cf', '#3a1204', 11, '2px', 1100);
    x.save(); x.shadowColor = 'rgba(0,0,0,0.5)'; x.shadowBlur = 20; x.fillStyle = '#d6281c'; x.beginPath(); x.roundRect(370, 262, 540, 58, 14); x.fill(); x.restore();
    x.font = '30px BodySansBold'; x.letterSpacing = '4px'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText('STIR-FRIED BALUT EGGS', 640, 292);
    [[210, 560, 44, 0.9], [1060, 530, 36, 0.85], [820, 470, 28, 0.8]].forEach(([sx, sy, r, a]) => star(x, sx, sy, r, a));
    fs.writeFileSync(`${prefix}_wide.png`, await c.encode('png'));
  }
  console.log('thumbnails written');
}
main().catch((e) => { console.error(e); process.exit(1); });
