// Bánh xèo miền Tây – 125 BPM swing grid (beat 0.48 s, bar 1.92 s), 69.6 s = 145 beats. Each shot file is optional.
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB'), C = opt('./shotsC');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const pick = (M, n) => M['s' + n] || blank(n);
const BEAT = 8 / 15;
// shot boundaries in beats
const CUTS = [0, 8, 12, 16, 24, 28, 32, 38, 42, 46, 50, 54, 58, 66, 70, 74, 80, 84, 88, 94, 100, 108, 118, 128];
const r2 = x => Math.round(x * 1000) / 1000;
const TIMES = CUTS.slice(0, -1).map((b, i) => [r2(b * BEAT), r2(CUTS[i + 1] * BEAT)]);
const SHOTS = TIMES.map(([start, end], i) => {
  const n = i + 1, M = n <= 8 ? A : n <= 15 ? B : C;
  return { id: n, start, end, draw: pick(M, n) };
});
module.exports = { SHOTS, TIMES, BEAT };
