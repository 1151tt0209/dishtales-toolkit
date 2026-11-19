// hprops.js — prop / character / environment library for "Hủ tiếu chợ nổi Cái Răng" (sunny 8 AM, 96 BPM, 1080x1920).
// Single entry point for shots: const HP = require('./hprops');  Everything below is re-exported from
//   hp_env.js (sky/water/market), hp_food.js (bowl, pot, toppings, tools, boat), hp_fx.js (text, gags, fx),
//   hp_chars.js (Dì Bảy, tourist, crowd vendors). Old nem nướng library: HP.NP (= ./nprops, patched backward-compatibly).
// THIS HEADER IS THE SOURCE OF TRUTH for the API.
// =====================================================================================================================
// CONVENTIONS
//  • COORDINATES — two spaces, never mix them up:
//      LOCAL  = the coordinate space of the (x,y) you passed in (i.e. whatever ctx transform was active at call time).
//               ALL hp_* drawers (hutieuBoat, huTieuBowl, coUt/diBay, tourist, fx…) take and RETURN LOCAL points.
//               So inside a camera transform (ctx.translate/scale) you can feed returned points straight into the next
//               drawer.
//      DEVICE = canvas pixels after the transform. Raw NP.* drawers (HP.NP.ghe, NP.coUt, NP.tourist, NP.xuongBaLa…)
//               return DEVICE points (nem nướng convention). HP.toLocal(ctx, p) converts DEVICE → LOCAL for the current
//               transform. The hp_chars wrappers already convert: their returns are LOCAL and the raw device copy is
//               kept on ret.device.
//  • Each drawer save()/restore()s — nothing leaks. Deterministic: animation from o.t (s) / o.seed only.
//  • Rotations in radians, +rot = clockwise (canvas). Scales: s = uniform. "flip" mirrors around the origin.
//  • Static parts (sky, clouds, far boats, palm strips, tiles) are cached offscreen; no ctx.filter blur per frame.
//  • Look: flat cartoon, saturated sunny 8 AM, sun high-left/back (warm rim on top/left, teal shade opposite).
//  • Beat: HP.BEAT = 0.625 s (96 BPM). Gags/bounces in poses use it (o.shake bounce is on-beat).
//  • Typical timings (ms/frame on this PC, see _test_hprops.js output): env ≤ 8, boat+Dì Bảy ≤ 4, bowl ≤ 2, fx ≤ 1.
//
// ===================================================== hp_env (ENVIRONMENT, all LOCAL; full-frame by default) =========
//  DAY                                   palette {skyTop, skyMid, skyLow, haze, water*, sun…}
//  cloudSprite(v) → canvas               cached cumulus sprite variant v (0..5)
//  daySky(ctx, y0, y1, {t, x0=0, w=W, sun:[x,y], sunS, flare, clouds=true, seed, drift, panX, cloudS})
//                                        blue gradient sky band y0..y1 + drifting clouds (+ sun/flare if sun given)
//  sunDay(ctx, x, y, s, {rays, t, flare})  white-gold sun disc + glow (+ rotating god rays)
//  dayWater(ctx, y0, y1, t, {sunX, x0, w, panX, seed, colW, colA, rippleAlpha, n, glitter=true, glitterA})
//                                        brown-green Mekong water band with ripples + sun glitter column at sunX
//  gheDaySprite(v) → canvas, dayHazed(spr, lvl) → canvas    day-lit far boat sprites (cached) + hazed copies
//  floatingMarketDay(ctx, t, {zoom 0..1 (0 = wide/high, 1 = low & close), horizon (520→760 by zoom), camY, dolly, panX, sunX, sunY, clouds, glitter, boats=true, rays})
//        → {horizon, sun:[x,y], project(wx, wz) → [x, y, scale]}
//        Wide floating market: sky, far shore + palms, rows of ghế with bẹo poles, water. project() places your own
//        boats on the water plane: wx = lateral world units (canal half-width ≈68), wz = world depth (≈20 near..2400 far);
//        returns null when behind the camera; scale = f/z (multiply by ~1/BK for a boat s).
//  riverSideDay(ctx, t, panX=0, {horizon=980, sunX, sunY, clouds, cloudSeed, sun=true, sunS, rays, flare, glitter,
//        farBoats=true, seed, mid=true, fgY}) → {horizon, sun}      side-on river: sky, palm bank, far boats, water.
//  floatingMarket(ctx,t,o) / riverSide(ctx,t,panX,o)   o.tod==='dawn' → NP sunrise versions, else the *Day versions.
//  heatShimmer(ctx, x, y, w, h, t, {amp=4, strip=8, alpha=1, rise=60})
//        displaces horizontal strips of WHAT IS ALREADY DRAWN in rect (x,y,w,h) — call after drawing the pot/stove.
//
// ===================================================== hp_food (FOOD + TOOLS + BOAT, all LOCAL in / LOCAL out) ========
//  Helpers: LP(x,y,rot,s,fx) → fn(px,py) local mapper · invApply(m,px,py) · toLocal(ctx, devP, base?) · PORC, BROTH colours
//  TOPPINGS (origin = centre; s=1 sizes ≈ real-ish cartoon px):
//    porkSlice(ctx,x,y,s,rot,{sq})  ~120×70 char siu slice (pink edge) · shrimp(…,{sq}) ~110 curled shrimp
//    liverSlice(…,{sq}) ~90 · quailEgg(…,{sq, whole}) ~60 (halved unless whole) · limeWedge(ctx,x,y,s,rot) ~90
//    chives(ctx,x,y,s,rot,{n=14, seed, sq, spread=60, len}) · beanSprouts(…,{n=10, seed, sq, spread})
//    chiliSlices(ctx,x,y,s,{n=6, seed, spread=40, sq}) · garlicBits(ctx,x,y,s,{n=18, seed, spread=50, sq})
//    (sq = vertical squash for top-down/3q views, e.g. bowl ry/rx)
//  toppingFall(ctx, t, t0, seed, n, x, y, {g=1400, w=120, floor, kinds:['garlic','chives','chili','scallion','peanut','sprout'],
//        kind, spread, size})          n pieces dropped at time t0 from (x,y), gravity g px/s², stop at y=floor.
//  noodles(ctx, x, y, s, {w=160, lift 0..1, t, seed, dry, wet, rot, liftH=240, strands}) → {top, base}
//        clear hủ tiếu noodle bundle hanging from (x, y-40-lift*liftH) down to y (dry = white/opaque).
//  huTieuBowl(ctx, x, y, s, {view:'3q'|'top'|'side', ryr, t, layers 0..7, broth/level 0..1, slosh, rot, shadow=true,
//        seed, garnish, lime, steam 0..1, steamSeed})
//        → {rim:[x,y], center, rx, ry, top, bottom, mouthR}       origin = rim centre, R = 150 (s=1).
//        layers (fractional = next layer dropping in): 0 broth+noodles only,1 +sprouts,2 +pork,3 +shrimp,4 +liver,5 +quail eggs,6 +chives,7 +fried garlic (hero).
//  brothPot(ctx, x, y, s, {t, view:'side'|'top', steam, steamSeed, lid 0..1 (null=no lid), seed, boil})
//        side: origin = pot BOTTOM centre, rim at y-250, RX 176, RY 40 → {rim, surface, rimRx, rimRy, top, base, lid}
//        top : origin = centre, r 186 → {rim, surface, rimRx, rimRy, top}. lid 0→1 lifts/slides the lid off.
//  ladle(ctx, x, y, s, rot, {flip, fill 0..1}) → {cup, lip, grip, end}   origin = cup centre; handle up-right
//        (local cup(0,0) lip(-46,2) grip(250,-170) end(300,-205)).
//  brothStream(ctx, x0, y0, x1, y1, t, {w=14, k 0..1 (length), tail, seed, bend, drops, splash})   golden pour arc.
//  noodleBasket(ctx, x, y, s, rot, {t, flip, fill, dip 0..1, shake, drip, seed}) → {mouth, bottom, grip, end}
//        wire basket, origin = basket centre (mouth(0,-40) bottom(0,72) grip(300,-128) end(420,-170)).
//  spoon(ctx, x, y, s, rot, {flip, fill, noodle}) → {bowl, grip, end}   ceramic soup spoon, bowl(-6,0) grip(100,-20).
//  chopsticks(ctx, x, y, s, rot, {flip, open, len=300, t, col, colD, hang, strands}) → {tips, grip, end}
//        origin = tips; hang = noodle strands hanging from tips (length px).
//  garnishPlate(ctx, x, y, s, {ryr}) → {center, rim}   plate of herbs, sprouts, lime, chili.
//  hutieuBoat(ctx, x, y, s, {part:'all'|'back'|'front', t, hull, paint, trim, tarpY, tarp=true, bowls=true, glow,
//        lid, boil, seed, ladle=true, sign=true, steam})
//        → {deck, seat, stove, pot, potRim, potScale, potRx, potRy, bowls[], tray, basket, bow, stern, gunwale, len,
//           tarp, ladleRest}
//        Dì Bảy's noodle boat (side view, bow +x), origin = WATERLINE centre, length ≈1600*s.
//        Order: hutieuBoat({part:'back'}) → HP.diBay(ctx, ...ret.seat, s, {pose:'basket'|'ladle', potAt:ret.potRim})
//        → hutieuBoat({part:'front'}). potRim is the pot rim centre; potRx/potRy its ellipse radii (LOCAL px).
//
// ===================================================== hp_chars (CHARACTERS, LOCAL in / LOCAL out; ret.device = raw) ==
//  DIBAY  palette {aoba:'#2f56b0', aobaD, khan:'#b3201c', khanW}  (blue áo bà ba, red khăn rằn) · BEAT = 0.625
//  diBay(ctx, x, y, s, o) ≡ coUt(…)  Dì Bảy = NP.coUt with DIBAY palette. Same scale/origin as NP.coUt:
//        seated (default for all poses but 'stand') origin = deck point under her stool; eyes ≈ y-270*s, shoulders ≈-192*s.
//        o: pose, t, k 0..1 (pose progress), flip, sit, expr ('smile','calm','laugh','talk','wink','slurp' + NP ones),
//           look:[x,y], tilt, turn, palette, reach:[x,y] (NP), poseFn (advanced hook, see nprops.js).
//        NP poses: stand, wave, offer, cheer, thumbs, fan, flip, roll, hook, pole.
//        NEW poses:
//          'basket'  {potAt:[x,y] LOCAL pot rim, dip 0..1 (into pot), shake 0..1 (on-beat bounce), lift 0..1 (up & out),
//                     pot:{x,y,rx,ry} (clip basket inside pot), basketS=.36, fill, drip, offX, gripR, pourTilt}
//                     → ret.basket {mouth, bottom, grip}
//          'ladle'   {potAt, bowlAt:[x,y] LOCAL bowl rim, k: <.3 scoop, .3–.6 carry, >.6 tilt & pour, ladleS=.3,
//                     pourTilt=1.1, streamW=9}  → ret.ladle {cup, lip, grip}, ret.pour (stream end), ret.pourK
//          'slurp'   bowl at chin + chopsticks + noodle zip, expr 'slurp' (k = slurp progress)
//          'handBowl'{to:[x,y] LOCAL target, k 0..1 (chest → target), layers, broth, steam} → ret.bowl {rim, center, top}
//  diBayFace(ctx,x,y,s,o) ≡ coUtFace  close-up face, origin between the eyes, head ≈300 wide at s=1.
//  tourist(ctx, x, y, s, o)  NP.tourist (blond backpacker). Seated origin = deck point under hips; eyes ≈-270*s.
//        o: pose, t, k, flip, sit, expr, look, face (people.face opts), sweat 0..1, poseFn.
//        NP poses: sit/nod/sniff/bite/cheer/hug/photo/point/pull/rollBig/row/split/yawn.
//        NEW poses:
//          'sip'     k 0..1 spoon from bowl to mouth, pinky up + sparkle.       → ret.spoon, ret.bowl
//          'bowl'    {raise 0..1} lifts bowl overhead, grin.                    → ret.bowl
//          'slurp'   bowl tilted at mouth, broth=1-k, noodle zip, glasses down. → ret.bowl
//          'sign'    selfie-stick sign "1 TÔ / 1 BOWL" {signRot=.32, signS=.6, len=270, wave, vi, en} → ret.sign
//                    (sign is drawn un-mirrored even with flip)
//          'fanHat'  fans himself with a nón lá {hatS=.15, fanHz=2.4}, squint face (+ o.sweat)
//        NEW expressions (any pose, also touristFace): 'determined', 'slurp', 'noodleSlap', 'squint'
//        (+ NP: smile, neutral, chew, panic, sniff, wow, …).  NEW_EXPR lists them; faceOverlay(ctx, expr, t) draws
//        the overlay in face units (origin between eyes, s=1 face).
//  touristFace(ctx, x, y, s, {expr, t, sweat, tilt, face…})  close-up, origin between eyes, head ≈300 wide.
//  vendorH(ctx, x, y, s, {seed, t, sit, flip, item:'bowl', slurp 0..1})   small crowd vendor (≈340 tall), origin deck.
//  crowdBoatsH(ctx, t, y, s, {n=4, seed=11, x0, x1, flipAlt, pole, raise, item:'bowl', slurp (0..1 or fn(i)), hull, paint})
//        → array of NP.ghe returns (DEVICE points!). Row of ghế with vendors that can hold/slurp bowls.
//  gripOn(M, Lh, S, r)  helper: grip point on circle(M,Lh) at distance r from shoulder S.
//
// ===================================================== hp_fx (TEXT / GAGS / FX, LOCAL) ===============================
//  biText(ctx, vi, en, x, y, sv=34, se=24, {stroke, viCol='#ffe9b8'})   centred bilingual pair (VI big cream, EN white)
//  selfieSign(ctx, x, y, s, rot, {t, len=560, sway, vi='1 TÔ', en='1 BOWL'}) → {grip, tip, sign, signTop}
//        origin = stick grip (bottom); stick goes up (−y) then rot.
//  slurpRings(ctx, x, y, s, k 0..1, {n=5, maxR=1100, ryr=.26, lines, seed})   expanding shock rings (comic slurp).
//  noodleZip(ctx, x0, y0, x1, y1, k 0..1, {n=6, w=6, t, whip=1, bend=-.12, seed, lines, drops}) → {tail}
//        noodles zipping from (x0,y0) bowl toward (x1,y1) mouth; k = how much is already slurped.
//  heron(ctx, x, y, s, {t, flap=2.6 Hz, pose:'fly'|'stand', flip, rot, ph})   white heron, faces +x, wingspan ≈300.
//  steamBurst(ctx, t, x, y, s, k 0..1, {n=14, sun, seed, alpha, rays, w=160})   steam column rising ≈900*s.
//  clockFace(ctx, x, y, s, k 0..1, {from=3, to=8, label})   r 80 clock, hands sweep from→to o'clock.
//  flyingHat(ctx, x, y, s, rot, {spin})   nón lá tumbling, brim ≈200 wide.
//  flavorBurst(ctx, x, y, s, k 0..1, {items=HT_FLAVORS, radius=300, labels=true})  icons+bilingual labels pop out radially.
//  flavorIcon(ctx, 'bone'|'noodle'|'garlic'|'chili'|'lime'|'shrimp')  icon ≈ 90 wide at origin.
//  HT_FLAVORS  [{icon, vi, en}] Ngọt xương!/Rich! · Dai!/Chewy! · Thơm tỏi!/Garlicky! · Cay!/Spicy!
//  sweatDrops(ctx, x, y, r, t, k 0..1, {seed})   cartoon sweat drops around a head of radius r.
// =====================================================================================================================
'use strict';
const L = require('./lib');
const PR = require('./props');
const PEOPLE = require('./people');
const NP = require('./nprops');
const ENV = require('./hp_env');
const FOOD = require('./hp_food');
const FX = require('./hp_fx');
const CH = require('./hp_chars');

module.exports = Object.assign({}, ENV, FOOD, FX, CH, { NP, L, PR, PEOPLE, ENV, FOOD, FX, CH });
