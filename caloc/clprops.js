// clprops.js — single entry point for "Cá lóc nướng trui" shots: const CL = require('./clprops');
// Re-exports cl_env.js, cl_food.js, cl_fx.js, cl_chars.js (each file's HEADER is the source of truth for its API),
// plus CL.BX (= ./bxprops, bánh xèo library), CL.HP (= ./hprops, hủ tiếu library) and CL.NP (= ./nprops, river world library).
'use strict';
function opt(name) { try { return require(name); } catch (e) { if (!/Cannot find module/.test(e.message)) throw e; return {}; } }
const BX = require('./bxprops');
const HP = require('./hprops');
const NP = require('./nprops');
module.exports = Object.assign({}, opt('./cl_env'), opt('./cl_food'), opt('./cl_fx'), opt('./cl_chars'), { BX, HP, NP, BEAT: 2 / 3 });
