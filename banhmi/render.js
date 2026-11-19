// Usage:
//   node render.js --stills 0.5,3,7.2      -> previews/still_<t>.png
//   node render.js --sheet                 -> previews/sheet.png (one frame per shot, mid-shot)
//   node render.js                         -> video_noaudio.mp4 (+ banh-mi.mp4 if audio.wav exists)
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const L = require('./lib');
const { SHOTS } = require('./shots');
const { W, H, BAR, rng, inv, createCanvas } = L;

const FPS = 30, DUR = 30;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// film grain plates
const grain = [];
for (let g = 0; g < 4; g++) {
  const c = createCanvas(960, 540), x = c.getContext('2d');
  const img = x.createImageData(960, 540), r = rng(9000 + g);
  for (let i = 0; i < img.data.length; i += 4) { const v = 100 + r() * 155; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  grain.push(c);
}
const vignette = (() => {
  const c = createCanvas(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  return c;
})();

function frame(T) {
  const shot = SHOTS.find(s => T >= s.start && T < s.end) || SHOTS[SHOTS.length - 1];
  const lt = T - shot.start, p = lt / (shot.end - shot.start);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); shot.draw(ctx, lt, p, T); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  // grade: teal shadows / warm highlights
  ctx.globalCompositeOperation = 'soft-light';
  const gg = ctx.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, 'rgba(255,170,90,0.35)'); gg.addColorStop(1, 'rgba(20,90,100,0.35)');
  ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(vignette, 0, 0);
  // beat flashes
  for (const [t0, a] of [[8.0, 0.55], [26.0, 0.45], [28.5, 0.3], [17.3, 0.2]]) {
    const k = T - t0; if (k < 0 || k > 0.25) continue;
    ctx.fillStyle = `rgba(255,236,200,${a * (1 - k / 0.25)})`; ctx.fillRect(0, 0, W, H);
  }
  // grain
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
  ctx.drawImage(grain[Math.floor(T * FPS) % 4], 0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // letterbox
  if (!NOBARS) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, BAR); ctx.fillRect(0, H - BAR, W, BAR); }
}
let NOBARS = false;

// ---- vertical 9:16 Shorts layout ----
const VW = 1080, VH = 1920;
const vcan = createCanvas(VW, VH), vx = vcan.getContext('2d');
const small = createCanvas(96, 170), sx = small.getContext('2d');
const PANEL = { w: 1080, h: 760, y: 560 }; // main picture: 16:9 frame scaled & side-cropped
function vframe(T) {
  frame(T);
  // blurred, darkened background from the same frame (cheap blur via downscale)
  sx.drawImage(canvas, (W - 608) / 2, 0, 608, H, 0, 0, 96, 170);
  vx.save(); vx.filter = 'blur(45px)';
  vx.drawImage(small, -60, -100, VW + 120, VH + 200);
  vx.restore();
  vx.fillStyle = 'rgba(10,5,2,0.55)'; vx.fillRect(0, 0, VW, VH);
  // main panel: scale 1080 tall frame to 760 tall -> 1351 wide, crop to 1080
  const scale = PANEL.h / H, srcW = PANEL.w / scale;
  vx.save();
  vx.shadowColor = 'rgba(0,0,0,0.7)'; vx.shadowBlur = 40;
  vx.drawImage(canvas, (W - srcW) / 2, 0, srcW, H, 0, PANEL.y, PANEL.w, PANEL.h);
  vx.restore();
  // thin gold rules
  vx.fillStyle = 'rgba(242,194,90,0.85)'; vx.fillRect(0, PANEL.y - 3, VW, 3); vx.fillRect(0, PANEL.y + PANEL.h, VW, 3);
  // header text (fades in after the cold open)
  const a = Math.min(1, Math.max(0, (T - 0.6) / 0.6)) * (1 - Math.min(1, Math.max(0, (T - 28.6) / 0.4)));
  vx.save(); vx.globalAlpha = a; vx.textAlign = 'center'; vx.textBaseline = 'middle';
  vx.font = '84px TitleSerif'; vx.letterSpacing = '6px';
  const tg = vx.createLinearGradient(0, 300, 0, 400); tg.addColorStop(0, '#fff2c6'); tg.addColorStop(0.5, '#f2c25a'); tg.addColorStop(1, '#c4842a');
  vx.shadowColor = 'rgba(255,160,50,0.5)'; vx.shadowBlur = 30; vx.fillStyle = tg;
  vx.fillText('BÁNH MÌ VIỆT NAM', VW / 2, 350);
  vx.shadowBlur = 0; vx.letterSpacing = '4px';
  vx.font = '46px BodySans'; vx.fillStyle = 'rgba(255,244,225,0.95)';
  vx.fillText('Vietnamese Bánh Mì', VW / 2, 445);
  vx.letterSpacing = '3px'; vx.font = '38px BodySans'; vx.fillStyle = 'rgba(255,226,170,0.9)';
  vx.fillText('Cách làm bánh mì thịt · How it’s made', VW / 2, PANEL.y + PANEL.h + 80);
  vx.restore();
}

async function main() {
  const args = process.argv.slice(2);
  fs.mkdirSync('previews', { recursive: true });
  if (args[0] === '--stills') {
    for (const t of args[1].split(',').map(Number)) {
      frame(t);
      fs.writeFileSync(path.join('previews', `still_${t.toFixed(2)}.png`), await canvas.encode('png'));
    }
    return;
  }
  if (args[0] === '--sheet') {
    const times = args[1] ? args[1].split(',').map(Number) : SHOTS.map(s => s.start + (s.end - s.start) * 0.6);
    const cols = 3, tw = 640, th = 360, rows = Math.ceil(times.length / cols);
    const sheet = createCanvas(cols * tw, rows * th), sx = sheet.getContext('2d');
    sx.font = '22px BodySansBold'; sx.fillStyle = '#ff0';
    times.forEach((t, i) => { frame(t); sx.drawImage(canvas, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sx.fillText(t.toFixed(2) + 's', (i % cols) * tw + 10, Math.floor(i / cols) * th + 30); });
    fs.writeFileSync(path.join('previews', args[2] || 'sheet.png'), await sheet.encode('png'));
    return;
  }
  const vertical = args.includes('--vertical');
  if (vertical || args[0] === '--vstill') { NOBARS = true; global.VERTICAL = true; }
  if (args[0] === '--vstill') {
    NOBARS = true;
    for (const t of args[1].split(',').map(Number)) { vframe(t); fs.writeFileSync(path.join('previews', `vstill_${t.toFixed(2)}.png`), await vcan.encode('png')); }
    return;
  }
  const out = vertical ? 'short_noaudio.mp4' : 'video_noaudio.mp4';
  const OW = vertical ? VW : W, OH = vertical ? VH : H, src = vertical ? vcan : canvas;
  const ff = spawn(ffmpeg, ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${OW}x${OH}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const total = FPS * DUR, t0 = Date.now();
  for (let f = 0; f < total; f++) {
    if (vertical) vframe(f / FPS); else frame(f / FPS);
    const buf = src.data();
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) process.stdout.write(`frame ${f}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('video done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  if (fs.existsSync('audio.wav')) {
    const final = vertical ? 'banh-mi-short.mp4' : 'banh-mi.mp4';
    const r = spawnSync(ffmpeg, ['-y', '-i', out, '-i', 'audio.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
    console.log('muxed', final, r.status);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
