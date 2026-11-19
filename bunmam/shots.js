const A = require('./shotsA');
const B = require('./shotsB');
const T = [
  [A.s1, 0, 3], [A.s2, 3, 5.5], [A.s3, 5.5, 8], [A.s4, 8, 10], [A.s5, 10, 13], [A.s6, 13, 16],
  [A.s7, 16, 19], [A.s8, 19, 22], [A.s9, 22, 24.5], [A.s10, 24.5, 27.5],
  [B.s11, 27.5, 31], [B.s12, 31, 33.5], [B.s13, 33.5, 36.5], [B.s14, 36.5, 40], [B.s15, 40, 43],
  [B.s16, 43, 45.5], [B.s17, 45.5, 47.5], [B.s18, 47.5, 51.5], [B.s19, 51.5, 56], [B.s20, 56, 60],
];
module.exports = { SHOTS: T.map(([draw, start, end], i) => ({ id: i + 1, start, end, draw })) };
