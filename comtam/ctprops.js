// ctprops.js — single entry point for "Cơm tấm Sài Gòn" shots: const CT = require('./ctprops');
// Re-exports ct_env.js, ct_food.js, ct_fx.js, ct_chars.js (each file's HEADER is the source of truth for its API),
// plus CT.BP (= ./bprops, bún chả grill library), CT.KT (= ./kitchen, bột chiên kitchen), CT.SG (= ./sgworld, Saigon world).
'use strict';
function opt(name) { try { return require(name); } catch (e) { if (!new RegExp("Cannot find module '\\" + name + "'").test(e.message)) throw e; return {}; } }
const BP = require('./bprops');
const KT = require('./kitchen');
const SG = require('./sgworld');
module.exports = Object.assign({}, opt('./ct_env'), opt('./ct_food'), opt('./ct_fx'), opt('./ct_chars'), { BP, KT, SG, BEAT: 8 / 15 });
