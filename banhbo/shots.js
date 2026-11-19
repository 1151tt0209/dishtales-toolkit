// Bánh bò nướng lá dứa – 62.3 s, 104 BPM grid (beat 0.5769 s), 108 beats.
// shotsA.js exports s2..s6 (process: pandan, batter, mould, oven). shotsB.js exports s1, s7..s14 (finished cake, gags, bite, CTA).
// Each file is optional so the pipeline renders placeholders until a writer delivers.
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const BEAT = 60 / 104;
// shot boundaries in beats: s1 hook | s2 pandan | s3 batter | s4 gag1 | s5 pour | s6 oven | s7 unmould | s8 cut | s9 gag2 | s10 tear | s11 lift | s12 bite | s13 farewell | s14 CTA
const CUTS = [0, 4, 10, 18, 24, 30, 42, 50, 56, 64, 76, 81, 90, 99, 108];
const OWNER = n => (n >= 2 && n <= 6) ? A : B;
const r3 = x => Math.round(x * 1000) / 1000;
const TIMES = CUTS.slice(0, -1).map((b, i) => [r3(b * BEAT), r3(CUTS[i + 1] * BEAT)]);
const SHOTS = TIMES.map(([start, end], i) => { const n = i + 1, M = OWNER(n); return { id: n, start, end, draw: M['s' + n] || blank(n) }; });
const DUR = r3(108 * BEAT); // 62.308
const BITE = r3(81 * BEAT); // 46.731 (loudest moment, preceded by 0.577 s of absolute silence)
module.exports = { SHOTS, TIMES, BEAT, CUTS, DUR, BITE };
