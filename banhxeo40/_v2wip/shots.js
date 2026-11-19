// Bánh xèo miền Tây v2 (~56 s) – 72 BPM grid (beat 0.8333 s), 67 beats = 55.833 s.
// v1 shots (s1..s16 from shotsA/shotsB) are reused unchanged: they keep their original length and receive a
// "virtual" T on the old 40 s timeline (oldStart + lt), so every internal sync still lands.
// New shots get the real global T:
//   shotsC.js: n1 (① batter mixing), h2 (gag: hand tapped with the spatula), n2 (⑦ fish sauce)
//   shotsD.js: h1 (tourist arrives at the shop), h4 (gag: knife & fork), h6 (gag: giant wrap), h5 (gag: plate tower / one more)
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const A = opt('./shotsA'), B = opt('./shotsB'), C = opt('./shotsC'), D = opt('./shotsD');
const blank = n => (ctx) => { ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 1080, 1920); ctx.fillStyle = '#888'; ctx.font = '80px BodySansBold'; ctx.fillText('shot ' + n, 380, 960); };
const BEAT = 60 / 72;
const r3 = x => Math.round(x * 1000) / 1000;

// v1 timeline (beats) for the reused shots
const OLD_CUTS = [0, 6, 8, 9, 10, 11, 13, 16, 19, 21, 26, 30, 34, 36, 38, 40, 48];
const OLD_START = {}; OLD_CUTS.slice(0, -1).forEach((b, i) => { OLD_START['s' + (i + 1)] = b * BEAT; });

// [name, module, beats]
const SEQ = [
  ['s1', A, 6],   // hook pour + title
  ['h1', D, 3],   // tourist arrives at Má Tư's riverside bánh xèo shop, orders
  ['n1', C, 3],   // ① batter mixing
  ['s2', A, 2],   // ② ingredient table
  ['s3', A, 1],
  ['s4', A, 1],
  ['s5', A, 1],
  ['s6', A, 2],   // ③ sear shrimp & pork
  ['s7', A, 3],   // ④ pour & swirl
  ['s8', A, 3],   // ⑤ sprouts + coconut heart
  ['h2', C, 3],   // GAG: tourist sneaks a crispy edge, gets a spatula tap
  ['s9', A, 2],   // ⑥ fold (match cut out)
  ['s10', B, 5],  // hero plate (match cut in)
  ['s11', B, 4],  // break in half
  ['n2', C, 3],   // ⑦ fish sauce
  ['h4', D, 4],   // GAG: knife & fork, Má Tư: use your hands
  ['s12', B, 4],  // ⑧ Má Tư demonstrates the wrap
  ['s13', B, 2],  // ⑨ dip
  ['h6', D, 3],   // GAG: tourist copies her, builds a wrap as big as his head; Má Tư: smaller!
  ['s14', B, 2],  // bite
  ['s15', B, 2],  // wide canal
  ['h5', D, 3],   // GAG: plate tower, "one more!"
  ['s16', B, 8],  // sunset CTA
];
let b = 0;
const SHOTS = SEQ.map(([name, M, beats], i) => {
  const start = r3(b * BEAT), end = r3((b + beats) * BEAT); b += beats;
  const fn = M[name] || blank(name);
  const old = OLD_START[name];
  const draw = old === undefined ? fn : (ctx, lt, p, T) => fn(ctx, lt, p, old + lt);
  return { id: i + 1, name, start, end, draw };
});
const DUR = r3(b * BEAT);
module.exports = { SHOTS, BEAT, DUR };
