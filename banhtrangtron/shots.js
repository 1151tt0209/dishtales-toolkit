// Bánh tráng trộn Sài Gòn – 150 BPM grid (beat 0.4s, bar 1.6s). Each shot file is optional so parts can be built separately.
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB'), C = opt('./shotsC');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const pick = (M, n) => M['s' + n] || blank(n);
const TIMES = [
  [0, 3.2], [3.2, 6.4], [6.4, 9.6], [9.6, 12.0], [12.0, 14.4],
  [14.4, 17.6], [17.6, 20.8], [20.8, 24.0], [24.0, 27.2], [27.2, 30.4],
  [30.4, 33.6], [33.6, 36.8], [36.8, 40.0], [40.0, 43.2], [43.2, 46.4],
  [46.4, 50.4], [50.4, 53.6], [53.6, 56.8], [56.8, 60.0], [60.0, 63.2],
  [63.2, 66.4], [66.4, 69.6], [69.6, 72.8], [72.8, 76.0], [76.0, 79.2], [79.2, 81.6], [81.6, 84.4], [84.4, 90],
];
const SHOTS = TIMES.map(([start, end], i) => {
  const n = i + 1, M = n <= 10 ? A : n <= 20 ? B : C;
  return { id: n, start, end, draw: pick(M, n) };
});
module.exports = { SHOTS, TIMES };
