// Cút lộn xào me – 60.0 s, 128 BPM grid (beat 0.46875 s), 128 beats.
// shotsA.js: s1..s5 · shotsB.js: s6..s9 · shotsC.js: s10..s14. Each file is optional (placeholders until delivered).
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB'), C = opt('./shotsC');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const BEAT = 60 / 128;
// shot boundaries in beats: s1 hook | s2 crack eggs | s3 tamarind | s4 gag1 | s5 garlic | s6 toss | s7 plate | s8 gag2 | s9 demo | s10 tension | s11 lift | s12 bite | s13 farewell | s14 CTA
const CUTS = [0, 4, 12, 20, 28, 36, 44, 56, 64, 72, 84, 92, 102, 117, 128];
const OWNER = n => n <= 5 ? A : n <= 9 ? B : C;
const r3 = x => Math.round(x * 1000) / 1000;
const TIMES = CUTS.slice(0, -1).map((b, i) => [r3(b * BEAT), r3(CUTS[i + 1] * BEAT)]);
const SHOTS = TIMES.map(([start, end], i) => { const n = i + 1, M = OWNER(n); return { id: n, start, end, draw: M['s' + n] || blank(n) }; });
const DUR = r3(128 * BEAT); // 60.000
const BITE = r3(92 * BEAT); // 43.125 (loudest moment, preceded by 0.469 s of absolute silence from 42.656)
module.exports = { SHOTS, TIMES, BEAT, CUTS, DUR, BITE };
