// bxprops.js — single entry point for "Bánh xèo miền Tây" shots: const BX = require('./bxprops');
// Re-exports bx_env.js, bx_food.js, bx_fx.js, bx_chars.js (each file's HEADER is the source of truth for its API),
// plus BX.HP (= ./hprops, hủ tiếu library) and BX.NP (= ./nprops, river world library).
'use strict';
function opt(name) { try { return require(name); } catch (e) { if (!/Cannot find module/.test(e.message)) throw e; return {}; } }
const HP = require('./hprops');
const NP = require('./nprops');
module.exports = Object.assign({}, opt('./bx_env'), opt('./bx_food'), opt('./bx_fx'), opt('./bx_chars'), { HP, NP, BEAT: 0.48 });
