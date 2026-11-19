// Bánh xèo miền Tây 40s – 72 BPM grid (beat 0.8333 s, bar 3.333 s), 40 s = 48 beats.
// shotsA.js exports s1..s9 (scenes 1–3), shotsB.js exports s10..s16 (scenes 4–6). Each file is optional.
// The longer v2 draft (steps ①–⑨ + tourist gags, ~58 s) is parked in _v2wip/ (shotsC/shotsD not written yet).
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const pick = (M, n) => M['s' + n] || blank(n);
const BEAT = 60 / 72;
// shot boundaries in beats
const CUTS = [0, 6, 8, 9, 10, 11, 13, 16, 19, 21, 26, 30, 34, 36, 38, 40, 48];
const r3 = x => Math.round(x * 1000) / 1000;
const TIMES = CUTS.slice(0, -1).map((b, i) => [r3(b * BEAT), r3(CUTS[i + 1] * BEAT)]);
const SHOTS = TIMES.map(([start, end], i) => {
  const n = i + 1, M = n <= 9 ? A : B;
  return { id: n, start, end, draw: pick(M, n) };
});
const DUR = 40.0;
module.exports = { SHOTS, TIMES, BEAT, CUTS, DUR };
