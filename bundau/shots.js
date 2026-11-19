const A = require('./shotsA');
const B = require('./shotsB');
const T = [
  [A.s1, 0, 3], [A.s2, 3, 5.5], [A.s3, 5.5, 8], [A.s4, 8, 10], [A.s5, 10, 13], [A.s6, 13, 16],
  [A.s7, 16, 19], [A.s8, 19, 22], [A.s9, 22, 25], [A.s10, 25, 28],
  [B.s11, 28, 31], [B.s12, 31, 34], [B.s13, 34, 38], [B.s14, 38, 40.5], [B.s15, 40.5, 43.5],
  [B.s16, 43.5, 46.5], [B.s17, 46.5, 48.5], [B.s18, 48.5, 52], [B.s19, 52, 56], [B.s20, 56, 60],
];
module.exports = { SHOTS: T.map(([draw, start, end], i) => ({ id: i + 1, start, end, draw })) };
