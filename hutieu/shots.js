// Hủ tiếu chợ nổi Cái Răng – 96 BPM grid (beat 0.625s, bar 2.5s), 70 s. Each shot file is optional so parts can be built separately.
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB'), C = opt('./shotsC');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const pick = (M, n) => M['s' + n] || blank(n);
const TIMES = [
  [0, 3.75], [3.75, 6.25], [6.25, 8.75], [8.75, 11.25],                                   // I
  [11.25, 13.75], [13.75, 17.5], [17.5, 20.0], [20.0, 22.5], [22.5, 26.25], [26.25, 28.75], // II
  [28.75, 32.5], [32.5, 35.0], [35.0, 37.5], [37.5, 40.0],
  [40.0, 45.0], [45.0, 47.5], [47.5, 50.0], [50.0, 52.5], [52.5, 55.0], [55.0, 58.75], [58.75, 65.0], // III
  [65.0, 70.0],                                                                              // IV CTA
];
for (const [a, b] of TIMES) if (Math.abs(a / 0.625 - Math.round(a / 0.625)) > 1e-9 || Math.abs(b / 0.625 - Math.round(b / 0.625)) > 1e-9) throw new Error('off-grid ' + a + '-' + b);
const SHOTS = TIMES.map(([start, end], i) => {
  const n = i + 1, M = n <= 8 ? A : n <= 15 ? B : C;
  return { id: n, start, end, draw: pick(M, n) };
});
module.exports = { SHOTS, TIMES };
