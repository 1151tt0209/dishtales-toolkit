const A = require('./shotsA');
const B = require('./shotsB');
const T = [
  [A.s1, 0, 2.5], [A.s2, 2.5, 4.5], [A.s3, 4.5, 7], [A.s4, 7, 9.5], [A.s5, 9.5, 12], [A.s6, 12, 14],
  [A.s7, 14, 17], [A.s8, 17, 19], [A.s9, 19, 22], [B.s10, 22, 24], [B.s11, 24, 28], [B.s12, 28, 31],
  [B.s13, 31, 33], [B.s14, 33, 35.5], [B.s15, 35.5, 39.5], [B.s16, 39.5, 42.5], [B.s17, 42.5, 45],
];
module.exports = { SHOTS: T.map(([draw, start, end], i) => ({ id: i + 1, start, end, draw })) };
