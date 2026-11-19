// Usage:
//   node render.js --stills 0.5,3,7.2      -> previews/still_<t>.png
//   node render.js --sheet [times] [name]  -> previews/sheet.png (contact sheet, up to 6 per row; "all" = one frame per shot)
//   node render.js                         -> video_noaudio.mp4 (+ caloc.mp4 if audio.wav exists)
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const L = require('./lib');
const { SHOTS } = require('./shots');
const { W, H, rng, createCanvas } = L;

const FPS = 30, DUR = 70.0;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const grain = [];
for (let g = 0; g < 4; g++) {
  const c = createCanvas(540, 960), x = c.getContext('2d');
  const img = x.createImageData(540, 960), r = rng(9000 + g);
  for (let i = 0; i < img.data.length; i += 4) { const v = 100 + r() * 155; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  x.putImageData(img, 0, 0); grain.push(c);
}
const vignette = (() => {
  const c = createCanvas(W, H), x = c.getContext('2d');
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = g; x.fillRect(0, 0, W, H); return c;
})();
let GRAIN = 0.05;
function frame(T) {
  const shot = SHOTS.find(s => T >= s.start && T < s.end) || SHOTS[SHOTS.length - 1];
  const lt = T - shot.start, p = lt / (shot.end - shot.start);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); shot.draw(ctx, lt, p, T); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  // grade: warm highlights / teal shadows
  ctx.globalCompositeOperation = 'soft-light';
  const gg = ctx.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, 'rgba(255,160,80,0.22)'); gg.addColorStop(1, 'rgba(20,70,120,0.32)');
  ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(vignette, 0, 0);
  for (const [t0, a, d] of [[9.333, 0.5, 0.5], [22.667, 0.55, 0.5], [30.667, 0.3, 0.3], [42.0, 0.25, 0.25], [50.667, 0.55, 0.45], [60.667, 0.25, 0.25], [66.0, 0.2, 0.2]]) {
    const k = T - t0; if (k < 0 || k > d) continue;
    ctx.fillStyle = `rgba(255,236,200,${a * (1 - k / d)})`; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = GRAIN;
  ctx.drawImage(grain[Math.floor(T * FPS) % 4], 0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

async function main() {
  const args = process.argv.slice(2);
  fs.mkdirSync('previews', { recursive: true });
  if (args[0] === '--stills') {
    for (const t of args[1].split(',').map(Number)) { frame(t); fs.writeFileSync(path.join('previews', `still_${t.toFixed(2)}.png`), await canvas.encode('png')); }
    return;
  }
  if (args[0] === '--sheet') {
    const times = args[1] && args[1] !== 'all' ? args[1].split(',').map(Number) : SHOTS.map(s => s.start + (s.end - s.start) * 0.6);
    const cols = Math.min(6, times.length), tw = 360, th = 640, rows = Math.ceil(times.length / cols);
    const sheet = createCanvas(cols * tw, rows * th), sx = sheet.getContext('2d');
    sx.font = '26px BodySansBold'; sx.fillStyle = '#ff0';
    for (let i = 0; i < times.length; i++) { const t = times[i]; frame(t); sx.drawImage(canvas, (i % cols) * tw, Math.floor(i / cols) * th, tw, th); sx.fillText(t.toFixed(2) + 's', (i % cols) * tw + 10, Math.floor(i / cols) * th + 34); }
    fs.writeFileSync(path.join('previews', args[2] || 'sheet.png'), await sheet.encode('png'));
    return;
  }
  const out = 'video_noaudio.mp4';
  const ff = spawn(ffmpeg, ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const total = Math.round(FPS * DUR), t0 = Date.now();
  for (let f = 0; f < total; f++) {
    frame(f / FPS);
    if (!ff.stdin.write(canvas.data())) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 90 === 0) process.stdout.write(`frame ${f}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('video done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  if (fs.existsSync('audio.wav')) {
    const r = spawnSync(ffmpeg, ['-y', '-i', out, '-i', 'audio.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', 'caloc.mp4'], { stdio: 'inherit' });
    console.log('muxed caloc.mp4', r.status);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
