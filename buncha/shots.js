const A = require('./shotsA'), B = require('./shotsB');
let C = null; try { C = require('./shotsC'); } catch (e) { if (!/Cannot find module '\.\/shotsC'/.test(e.message)) throw e; }
const T = [
  [A.s1, 0, 3.5], [A.s2, 3.5, 6.5], [A.s3, 6.5, 9.5], [A.s4, 9.5, 12], [A.s5, 12, 15],
  [A.s6, 15, 18], [A.s7, 18, 21], [A.s8, 21, 24], [A.s9, 24, 27], [A.s10, 27, 30],
  [B.s11, 30, 33.5], [B.s12, 33.5, 36.5], [B.s13, 36.5, 39.5], [B.s14, 39.5, 42.5], [B.s15, 42.5, 45.5],
  [B.s16, 45.5, 48], [B.s17, 48, 51], [B.s18, 51, 54], [B.s19, 54, 57], [B.s20, 57, 60.5],
];
if (C) T.push([C.s21, 60.5, 63.5], [C.s22, 63.5, 67], [C.s23, 67, 70.5], [C.s24, 70.5, 73.5], [C.s25, 73.5, 77], [C.s26, 77, 81], [C.s27, 81, 84.5], [C.s28, 84.5, 90]);
module.exports = { SHOTS: T.map(([draw, start, end], i) => ({ id: i + 1, start, end, draw })) };
