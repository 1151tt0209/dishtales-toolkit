// Shot table: [draw, start, end] in seconds (90 s total). See PLAN-mi-xao-gion.md.
const A = require('./shotsA'), B = require('./shotsB'), Cc = require('./shotsC');
const T = [
  [A.s1, 0, 3.5], [A.s2, 3.5, 6.5], [A.s3, 6.5, 9.5], [A.s4, 9.5, 12], [A.s5, 12, 15],
  [A.s6, 15, 18], [A.s7, 18, 21], [A.s8, 21, 24], [A.s9, 24, 27], [A.s10, 27, 30],
  [B.s11, 30, 33], [B.s12, 33, 36.5], [B.s13, 36.5, 39.5], [B.s14, 39.5, 42.5], [B.s15, 42.5, 46],
  [B.s16, 46, 49], [B.s17, 49, 52], [B.s18, 52, 55], [B.s19, 55, 58], [B.s20, 58, 60.5],
  [Cc.s21, 60.5, 63.5], [Cc.s22, 63.5, 67], [Cc.s23, 67, 70.5], [Cc.s24, 70.5, 73.5], [Cc.s25, 73.5, 77],
  [Cc.s26, 77, 81], [Cc.s27, 81, 84.5], [Cc.s28, 84.5, 90],
];
module.exports = { SHOTS: T.map(([draw, start, end], i) => ({ id: i + 1, start, end, draw })) };
