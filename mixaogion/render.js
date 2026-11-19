// Mì xào giòn Chợ Lớn — 90 s vertical Short (1080x1920, 30 fps, 2700 frames).
// Usage (run inside D:\DishTales-hoathinh\mixaogion):
//   node render.js --stills 0.5,3,7.2          -> previews/still_<t>.png
//   node render.js --sheet [times|all] [name]  -> previews/sheet.png (contact sheet, 6 per row; 'all' = 1 frame per shot)
//   node render.js --range f0 f1 out.mp4       -> encode frames [f0,f1) only (used by --parallel)
//   node render.js --parallel 8                -> render in 8 processes, concat to video_noaudio.mp4 (+ mux audio.wav -> mi-xao-gion.mp4)
//   node render.js                             -> single-process render of video_noaudio.mp4 (+ mi-xao-gion.mp4 if audio.wav exists)
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const L = require('./lib');
const { SHOTS } = require('./shots');
const { W, H, rng, createCanvas } = L;

const FPS = 30, DUR = 90, TOTAL = FPS * DUR;
const OUT_FINAL = 'mi-xao-gion.mp4';
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
const GRAIN = 0.05;
// [time, alpha, duration] white-hot flashes from the plan
const FLASHES = [[12.0, 0.5, 0.25], [33.5, 0.35, 0.25], [60.8, 0.25, 0.25], [67.5, 0.6, 0.35], [73.5, 0.7, 0.3], [82.0, 0.25, 0.25], [86.0, 0.2, 0.25]];
function frame(T) {
  const shot = SHOTS.find(s => T >= s.start && T < s.end) || SHOTS[SHOTS.length - 1];
  const lt = T - shot.start, p = Math.min(1, lt / (shot.end - shot.start));
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save(); shot.draw(ctx, lt, p, T); ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  // grade: warm highlights / teal shadows
  ctx.globalCompositeOperation = 'soft-light';
  const gg = ctx.createLinearGradient(0, 0, 0, H); gg.addColorStop(0, 'rgba(255,170,90,0.3)'); gg.addColorStop(1, 'rgba(20,90,100,0.3)');
  ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(vignette, 0, 0);
  for (const [t0, a, d] of FLASHES) {
    const k = T - t0; if (k < 0 || k > d) continue;
    ctx.fillStyle = `rgba(255,236,200,${a * (1 - k / d)})`; ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = GRAIN;
  ctx.drawImage(grain[Math.floor(T * FPS) % 4], 0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

async function encode(f0, f1, out, tag = '') {
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    frame(f / FPS);
    if (!ff.stdin.write(canvas.data())) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 90 === 0) process.stdout.write(`${tag}frame ${f}/${f1} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
}
function mux(out) {
  if (!fs.existsSync('audio.wav')) { console.log('no audio.wav yet -> only', out); return; }
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', out, '-i', 'audio.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', OUT_FINAL], { stdio: 'inherit' });
  console.log('muxed', OUT_FINAL, r.status);
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
  if (args[0] === '--range') { await encode(+args[1], +args[2], args[3], `[${args[1]}] `); return; }
  const out = 'video_noaudio.mp4', t0 = Date.now();
  if (args[0] === '--parallel') {
    const n = +args[1] || 8, dir = '_seg';
    fs.mkdirSync(dir, { recursive: true });
    const step = Math.ceil(TOTAL / n), jobs = [], list = [];
    for (let i = 0; i < n; i++) {
      const a = i * step, b = Math.min(TOTAL, a + step); if (a >= b) break;
      const seg = path.join(dir, `seg${String(i).padStart(2, '0')}.mp4`); list.push(`file '${path.basename(seg)}'`);
      jobs.push(new Promise((res, rej) => {
        const c = spawn(process.execPath, [__filename, '--range', String(a), String(b), seg], { stdio: ['ignore', 'inherit', 'inherit'] });
        c.on('close', code => (code === 0 ? res() : rej(new Error('segment ' + i + ' failed ' + code))));
      }));
    }
    await Promise.all(jobs);
    fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
    const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('concat failed');
    fs.rmSync(dir, { recursive: true, force: true });
  } else {
    await encode(0, TOTAL, out);
  }
  console.log('video done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  mux(out);
}
main().catch(e => { console.error(e); process.exit(1); });
