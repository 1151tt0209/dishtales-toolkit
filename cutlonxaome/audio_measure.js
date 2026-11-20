// Measures audio.wav with the ffmpeg-static ebur128 filter, per window -> console + audio_report.txt
// I = integrated LUFS of the window alone, S max / M max = loudest short-term (3 s) / momentary (400 ms) frame whose END lies in the window
// (from one whole-file pass), TP = true peak dBTP of the window. Also checks the silence gap is digital zero.
const { execFileSync } = require('child_process');
const fs = require('fs');
const ff = require('ffmpeg-static');
const WAV = __dirname + '/audio.wav';
const SR = 48000, CUT = 91 * 60 / 128, RES = 92 * 60 / 128;
const run = (af) => { try { return execFileSync(ff, ['-hide_banner', '-nostats', '-i', WAV, '-af', af, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).toString(); } catch (e) { return (e.stderr || '').toString() + (e.stdout || '').toString(); } };
const runErr = (af, v = 'info') => { const r = require('child_process').spawnSync(ff, ['-hide_banner', '-nostats', '-v', v, '-i', WAV, '-af', af, '-f', 'null', '-'], { maxBuffer: 1 << 28 }); return r.stderr.toString(); };

// whole-file pass: per-frame t, M, S
const frames = [];
for (const line of runErr('ebur128=framelog=verbose', 'verbose').split(/\r?\n/)) {
  const m = line.match(/t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+|-inf|nan)\s+S:\s*(-?[\d.]+|-inf|nan)/);
  if (m) frames.push({ t: +m[1], M: parseFloat(m[2]), S: parseFloat(m[3]) });
}
const whole = runErr('ebur128=peak=true');
const sumI = (s) => { const m = s.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+|-inf|nan)/); return m ? m[1] : 'n/a'; };
const sumTP = (s) => { const m = s.match(/True peak:\s*\n\s*Peak:\s*(-?[\d.]+|-inf|nan)/); return m ? m[1] : 'n/a'; };
const sumLRA = (s) => { const m = s.match(/Loudness range:\s*\n\s*LRA:\s*(-?[\d.]+)/); return m ? m[1] : 'n/a'; };

const W = [['whole', 0, 60], ['0-2', 0, 2], ['2-10', 2, 10], ['10-20', 10, 20], ['20-30', 20, 30], ['30-40', 30, 40], ['40-43', 40, 43],
  ['silence 42.656-43.125', CUT, RES], ['bite 43.125-43.6', RES, 43.6], ['43-48', 43, 48], ['48-55', 48, 55], ['55-60', 55, 60]];
const out = [];
out.push('audio.wav  ebur128 (ffmpeg-static)   whole: I ' + sumI(whole) + ' LUFS, LRA ' + sumLRA(whole) + ' LU, true-peak ' + sumTP(whole) + ' dBTP');
out.push('window'.padEnd(24) + 'I LUFS'.padStart(9) + 'S max'.padStart(9) + 'M max'.padStart(9) + 'TP dBTP'.padStart(10));
const rows = {};
for (const [name, a, b] of W) {
  const s = name === 'whole' ? whole : runErr(`atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,ebur128=peak=true`);
  const fr = frames.filter((f) => f.t > a + 1e-6 && f.t <= b + 1e-6);
  const mx = (k) => { const v = fr.map((f) => f[k]).filter((x) => isFinite(x)); return v.length ? Math.max(...v).toFixed(1) : '-inf'; };
  rows[name] = { I: sumI(s), S: mx('S'), M: mx('M'), TP: sumTP(s) };
  out.push(name.padEnd(24) + rows[name].I.padStart(9) + rows[name].S.padStart(9) + rows[name].M.padStart(9) + rows[name].TP.padStart(10));
}
// silence check on the 16-bit samples
const buf = fs.readFileSync(WAV);
let off = 12, dataOff = -1, dataLen = 0;
while (off < buf.length - 8) { const id = buf.toString('ascii', off, off + 4), len = buf.readUInt32LE(off + 4); if (id === 'data') { dataOff = off + 8; dataLen = len; break; } off += 8 + len + (len & 1); }
const nFrames = dataLen / 4, i0 = Math.round(CUT * SR), i1 = Math.round(RES * SR);
let nz = 0, maxAbs = 0;
for (let i = i0; i < i1; i++) for (let c = 0; c < 2; c++) { const v = buf.readInt16LE(dataOff + 4 * i + 2 * c); if (v) { nz++; maxAbs = Math.max(maxAbs, Math.abs(v)); } }
out.push(`duration: ${nFrames} frames = ${(nFrames / SR).toFixed(4)} s`);
out.push(`silence samples [${i0}, ${i1}) = ${(i0 / SR).toFixed(5)}..${(i1 / SR).toFixed(5)} s: ${nz === 0 ? 'ALL ZERO (digital silence)' : nz + ' non-zero samples, max |x| ' + maxAbs}`);
// is the bite the loudest moment? compare max momentary loudness of frames ending in the bite window vs everything else
const bm = Math.max(...frames.filter((f) => f.t > RES && f.t <= RES + 0.6).map((f) => f.M));
const other = frames.filter((f) => !(f.t > RES && f.t <= RES + 0.6) && isFinite(f.M));
const om = other.reduce((a, f) => (f.M > a.M ? f : a), { M: -Infinity, t: 0 });
out.push(`bite momentary max ${bm.toFixed(1)} LUFS vs loudest elsewhere ${om.M.toFixed(1)} LUFS at ${om.t.toFixed(1)} s -> ${bm > om.M ? 'BITE IS LOUDEST' : 'bite NOT loudest'}`);
const txt = out.join('\n');
console.log(txt);
fs.writeFileSync(__dirname + '/audio_report.txt', txt + '\n');
