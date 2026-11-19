// Phở Hà Nội – 80 BPM grid (beat 0.75s). Each shot file is optional so parts can be built separately.
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB'), C = opt('./shotsC');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const pick = (M, n) => M['s' + n] || blank(n);
const TIMES = [
  [0, 3.75], [3.75, 6.75], [6.75, 9.75], [9.75, 12], [12, 15],
  [15, 18], [18, 21], [21, 24], [24, 27], [27, 30.75],
  [30.75, 33.75], [33.75, 36.75], [36.75, 39.75], [39.75, 42], [42, 45],
  [45, 48.75], [48.75, 51.75], [51.75, 54.75], [54.75, 57.75], [57.75, 60],
  [60, 63], [63, 66.75], [66.75, 70.5], [70.5, 73.5], [73.5, 77.25], [77.25, 81], [81, 84], [84, 90],
];
const SHOTS = TIMES.map(([start, end], i) => {
  const n = i + 1, M = n <= 10 ? A : n <= 20 ? B : C;
  return { id: n, start, end, draw: pick(M, n) };
});
module.exports = { SHOTS, TIMES };
