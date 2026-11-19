// Nem nướng Cái Răng – 100 BPM grid (beat 0.6s, bar 2.4s). Each shot file is optional so parts can be built separately.
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB'), C = opt('./shotsC');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const pick = (M, n) => M['s' + n] || blank(n);
const TIMES = [
  [0, 3.6], [3.6, 7.2], [7.2, 9.6], [9.6, 12.0], [12.0, 14.4],
  [14.4, 17.4], [17.4, 21.0], [21.0, 24.0], [24.0, 27.6], [27.6, 30.6],
  [30.6, 34.2], [34.2, 37.2], [37.2, 40.8], [40.8, 43.8], [43.8, 47.4],
  [47.4, 50.4], [50.4, 54.0], [54.0, 57.0], [57.0, 60.0], [60.0, 63.0],
  [63.0, 66.0], [66.0, 69.0], [69.0, 72.0], [72.0, 75.0], [75.0, 78.0], [78.0, 81.0], [81.0, 84.0], [84.0, 90],
];
const SHOTS = TIMES.map(([start, end], i) => {
  const n = i + 1, M = n <= 10 ? A : n <= 20 ? B : C;
  return { id: n, start, end, draw: pick(M, n) };
});
module.exports = { SHOTS, TIMES };
