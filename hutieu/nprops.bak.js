// nprops.js — prop / character / environment library for "Nem nướng Cái Răng" (Cái Răng floating market, Cần Thơ, 5:30 AM sunrise).
// Vertical 1080x1920, 30 fps. Built on lib.js (+ props.js ik/seg, people.js face for the tourist).
// =====================================================================================================================
// CONVENTIONS
//   • Every drawer: fn(ctx, x, y, s, o) unless stated. (x,y) = documented ORIGIN, s = uniform scale (s=1 sizes below).
//     Each drawer saves/restores ctx state (transform, alpha, composite, filter) — nothing leaks.
//   • Deterministic: everything animated takes o.t (seconds) and/or o.seed; same (t, seed) → same pixels.
//   • Static scenery (sky bands, palm strips, boat sprites, mist, textures) is cached offscreen on first use.
//   • Drawers return SCREEN-space points (already through the current ctx transform) where useful, e.g.
//     { deck:[x,y], tip:[x,y], handL:[x,y] } so shots can attach props without redoing the maths.
//   • "L/R" in returns = screen left/right of the UNFLIPPED drawing. o.flip mirrors horizontally around the origin.
//   • Light: low red-orange sun BEHIND the subjects (backlight). Drawers add warm rim light on top/left edges and
//     teal shade on the opposite side. render.js already adds the global grade, vignette, flashes and grain.
//   • COL = sunrise palette (below). Characters share one scale (see SCALE).
//
// SCALE (s = 1)  — all characters use ONE scale; all boats share the same scale (1 unit ≈ 0.3 cm of a real person).
//   Values measured from the drawers (y up = negative).
//   coUt standing        : origin = between the feet. Feet 0, hips ≈-240, shoulders ≈-353, eyes ≈-431, nón lá apex ≈-571,
//                          nón brim ≈ 250 wide.
//   coUt seated (o.sit=1): origin = deck point under her low stool's feet. Hips ≈-78, shoulders ≈-192, eyes ≈-270,
//                          nón apex ≈-410. o.sit defaults to 1 for EVERY pose except 'stand' (pass o.sit:0 to stand).
//   tourist standing     : origin = between the feet ('split' pose). Feet 0, hips -240, shoulders -391, eyes -462, crown ≈-516.
//   tourist seated       : origin = deck point under the hips (sits on plank/deck, legs forward). Hips ≈-48, eyes ≈-270,
//                          top of hair ≈-333.
//   boatman standing     : origin = between the feet. Hips -232, shoulders -372, eyes -440 (hat/oar reach higher).
//   vendor (crowd)       : origin = deck point. ≈ 340 tall incl. hat (they're always small/background).
//   Faces: coUtFace / touristFace close-ups: origin between the eyes, head ≈ 300 wide, chin y≈200 (= people.js face).
//
// BOATS (side view, origin = WATERLINE centre, bow toward +x unless o.flip). Boats are drawn in native units × BK (=2.5),
//   so ALL numbers below are already ×2.5 = screen px at s=1. Put a person in a boat at the returned ret.deck (or
//   [bx + dx*s, by + DECK*s]) with the same s; drawing order: boat({part:'back'}) → person → boat({part:'front'}).
//   name        length  gunwale(mid)  DECK (feet / seat floor)   stations (x,y at s=1)
//   ghe          1900     -250          -137.5                  bẹo pole base x=+625 (pole tip ≈ y-1850), cabin x -900..-225
//   coUtBoat     1600     -210          -105                    Cô Út stool x=-50 (seated coUt origin = ret.stool),
//                                                               stove x=+155 (base y≈-145), herbs (587,-250), plates (-612,-240)
//   xuongBaLa    1100     -135          -55                     plank seat (100,-100) (tourist seated origin = ret.seat),
//                                                               boatman (standing) x=-375, oarlock (-425,-210)
//   motorBoat    1600     -215          -115                    cabin x -275..+225, exhaust (-750,-490)
//   All boat drawers return screen points { deck (at x=0), gunwale, bow, stern, len (screen px), …stations } — see each fn.
//
// HELPERS (exported)
//   COL; rgba(hex,a); mixc(hexA,hexB,f); lgr/rgr(ctx,…,stops); rrect; capPath; capFS; mapper(ctx); ikPick; rimLine;
//   cHand(ctx,x,y,s,rot,o) cartoon hand: wrist origin, ~100 long, kinds open|flat|wave|grip|fist|pinch|point|thumb, o.skin, o.flip
//   cArm(ctx,sx,sy,ex,ey,wx,wy,o) arm segments with sleeve (o.sleeve fill, o.sleeveTo 0..2)
//
// ENVIRONMENT
//   dawnSky(ctx,y0,y1,o)                 sunrise gradient between y0 (top) and y1 (horizon). o.warm 0..1.
//   sun(ctx,x,y,s,o)                     red-gold sun disc + halo (+o.flare 0..1, +o.rays 0..1 god rays, o.t).
//   floatingMarket(ctx,t,o) → {horizon, sun:[x,y], project(wx,wz)→[x,y,scale]}
//        Full-frame DRONE wide of Cái Răng: river to the horizon, dozens of moored ghe with cây bẹo (pineapple,
//        pumpkin, sweet potato, watermelon), coconut/palm banks, mist, low sun + glitter reflection, a few moving boats.
//        o.zoom 0..1 (0 = high drone, 1 = pushed in & lower), o.camY (altitude override, world m, default lerp(62,24,zoom)),
//        o.horizon (screen y override), o.sun 0..1 (sun elevation; 0 = touching horizon), o.mist 0..1, o.panX (m),
//        o.gold 0..1 (shot 27 golden-river boost), o.boats false to hide boats. Cached sprites; animated water/bob.
//   riverSide(ctx,t,panX,o) → {horizon, sun:[x,y]}
//        Water-level mid-shot background: sky, sun, far palm bank (parallax .15), distant ghe row (.35), water with
//        ripples & glitter, mist; then o.mid(ctx, ox) (ox = -panX, draw your boats/people here); then a foreground
//        water overlay (parallax 1.4) from o.fgY (default 1560) down. o.horizon (default 980), o.sunX (default 610),
//        o.sunY (default horizon-70), o.mist, o.farBoats (default true).
//   water(ctx,y0,y1,t,o)                 plain water band (gradient + ripples + glitter under o.sunX).
//   ripples(ctx,x,y,w,h,t,o)             perspective ripple highlights in a rect. o.alpha, o.seed, o.col, o.n.
//   boatWake(ctx,x,y,s,t,o)              V wake trailing behind a moving boat. (x,y)=stern waterline; o.dir +1 = boat moves right
//                                        (wake extends left); o.len (600), o.strength 0..1.
//   bigWave(ctx,x,y,s,k,o)               motor-boat wake WAVE (shot 21): side-view rolling swell, crest at x, waterline y,
//                                        height 150*s*o.amp; k = life 0..1 (rises, breaks, foam). o.w width (900), o.dir,
//                                        o.breaking 0..1, o.t, o.seed. Returns {crest:[x,y]} (screen) for spray/boat placement.
//   splash(ctx,x,y,s,k,o)                crown splash + droplets at waterline, k = life 0..1, o.seed, o.spikes (13).
//   mist(ctx,y,h,t,a)                    drifting mist band (cached soft sprite).
//
// BOATS (see table above). Common o: part 'back'|'front'|'all'(default), flip, t (bob), sway (rad), bob (px amp, default 4).
//   ghe(ctx,x,y,s,o)        Mekong trader boat: painted bow eye (mắt ghe), curved cabin (mui), cây bẹo with o.items
//                           (array of 'pineapple'|'pumpkin'|'sweetpotato'|'watermelon'|'cabbage'|'coconut', default by o.seed),
//                           o.cargo (piles on deck, default true), o.hull colour. Returns {deck, gunwale, beoTip, bow, stern}.
//   motorBoat(ctx,x,y,s,o)  ghe máy with cabin + long-tail engine, o.smoke (default true), o.speed 0..1 (spray, wake drawn by
//                           boatWake separately). Returns {deck, gunwale, exhaust, stern, bow}.
//   xuongBaLa(ctx,x,y,s,o)  tourist's small rowing sampan (xuồng ba lá), plank seat. Returns {deck, seat, oarlock, bow, stern}.
//   coUtBoat(ctx,x,y,s,o)   Cô Út's nem boat: clay charcoal stove (lò đất) amidships with grill + skewers (o.cook, o.skewers),
//                           herb baskets, plates of nem, sauce bowls, small umbrella (o.umbrella). Draws the stove in the
//                           'back' pass. o.glow, o.flare. Returns {deck, stove, grill, stool, herbs, plates, bow, stern}.
//   beoPole(ctx,x,y,s,o) → tip [x,y]  long bamboo pole + hook. (x,y)=base, length 760*s (o.len). o.angle (rad, 0 = up,
//                           + leans right), o.bend, o.hang: item name | array | 'giantRoll' | null, o.swing (rad), o.t, o.dew.
//
// CHARACTERS (all at one scale — see SCALE). Common o: t, flip, k (pose progress 0..1 / phase), expr, items (default true).
//   coUt(ctx,x,y,s,o) → {head, face:{x,y,s}, handL, handR, tool}   Cô Út: earthy-pink áo bà ba, black-white khăn rằn,
//        nón lá, black pants. Poses: 'stand'|'fan' (o.fan phase, beat-syncable)|'flip' (tongs, k)|'hook' (pole reach, k)|
//        'offer' (plate held out, k)|'roll' (hands rolling paper, k)|'pole' (holding bẹo pole: o.poleAngle, o.hang)|
//        'thumbs'|'wave'|'cheer' ("Dzô!", raises a roll). o.sit 0/1 (default 1 for fan/flip/roll). o.reach [x,y] local
//        override for the main hand. Faces screen-right in 3/4 (o.flip faces left).
//   coUtFace(ctx,x,y,s,o)   close-up: expr 'smile'|'laugh'|'calm'|'wink'|'talk', o.t (blink/earrings), o.turn -1..1,
//                           o.tilt, o.look [x,y], o.hat (true), o.body (true; shoulders to y≈600), o.talk 0..1.
//   tourist(ctx,x,y,s,o) → {head, face, handL, handR, mouth, footL, footR}   blond backpacker + orange life vest.
//        Poses: 'sit'|'yawn'|'photo'|'point'|'sniff'|'rollBig' (holds giant roll; o.rollFn(ctx, x, y, rot) optional)|
//        'split' (STANDING, o.footL / o.footR = local [x,y] foot positions, e.g. one on each boat)|'bite'|
//        'hug' (SELF-hug: arms crossed on chest, blissful face, sways)|'cheer'.
//        Seated poses use the deck origin; 'split' uses the feet origin. o.look (head turn -1..1), o.expr override.
//   touristFace(ctx,x,y,s,o) close-up, wraps people.face. expr 'neutral'|'smile'|'sniff'|'wow'|'panic'|'chew'|'bliss'|'yawn'.
//                           o.t animates chew/sniff. Other people.face options pass through (turn, lookX, shirt…).
//   boatman(ctx,x,y,s,o) → {head, handL, handR, oarTip}  grey tee, olive nón tai bèo, long oar. Poses 'row' (o.phase),
//                           'pull' (oar stretched out to the side, k), 'nod', 'cheer'.
//   vendor(ctx,x,y,s,o)     background vendor (seeded look): o.seed, o.raise 0..1 (raises a nem roll), o.t.
//   crowdBoats(ctx,t,y,s,o) a row of vendor boats across the frame (o.n, o.seed, o.raise 0..1, o.x0, o.x1).
//
// FOOD & PROPS (built to hold up in extreme close-ups)
//   charcoalStove(ctx,x,y,s,o) → {top, rimW}  clay lò đất, origin = base centre; 230 wide, rim at y=-190. o.glow 0..1
//                           (flicker auto from o.t), o.flare 0..1, o.embers (true), o.grill (draws grill rack), o.skewers.
//   grillRack(ctx,x,y,s,o)  wire rack seen slightly from above, origin = centre, 300×110. o.skewers = n or array of
//                           {cook, dx, rot}; o.cook default; o.t (drips/sizzle).
//   nemSkewer(ctx,x,y,s,o)  one nem nướng on a bamboo skewer, origin = centre of meat, meat 170×40, stick 320.
//                           o.cook 0..1 (pink raw → caramel w/ char marks + gloss), o.rot, o.t, o.seed, o.stick (stick length, 320), o.len/o.h,
//                           o.drip (fat drop; auto when cook > .6; o.drip:false disables). Returns {a:[x,y], b:[x,y]} stick ends.
//   nemShaping(ctx,x,y,s,o) close-up hands shaping pork paste onto a stick. o.p 0..1. origin = centre of stick, ~520 wide.
//   handFan(ctx,x,y,s,rot,o)   woven bamboo fan (quạt nan); origin = handle end; 230 long. o.blur (motion) 0..1.
//   tongs(ctx,x,y,s,rot,o)  metal tongs (kẹp gắp); origin = hinge; 240 long; o.open 0..1 → returns tip [x,y].
//   nemPlate(ctx,x,y,s,o)   white plate (dĩa), origin centre, 300×110 ellipse. o.kind 'nem'|'rolls'|'cut', o.n.
//   ricePaper(ctx,x,y,s,o)  round bánh tráng, R=170; o.wet 0..1 (stiff/opaque/crosshatch → soft/translucent/glossy),
//                           o.ry (ellipse squash 0.2..1, default 1 = top-down), o.rot, o.sag (draping when held, 0..1).
//   waterBasin(ctx,x,y,s,o) tin basin of water, origin centre, R=210 (top-down-ish, o.ry 0.45). o.t, o.dip 0..1 (ripples).
//   herb(ctx,kind,x,y,s,rot,o)   kind: 'lettuce'|'basil'|'diepca'|'tiato'|'starfruit'|'banana'|'cucumber'|'carrot'|'daikon'
//                           (each ~60–160 long at s=1). Also aliases lettuce(), basil(), … with (ctx,x,y,s,rot).
//   herbBasket(ctx,x,y,s,o) round bamboo basket heaped with herbs; origin centre; R=150, o.ry 0.5.
//   ramRoll(ctx,x,y,s,rot,o)   bánh tráng ram (fried crisp roll), 150×30 golden blistered. o.snap 0..1 (breaks in two +
//                           crumbs), o.t, o.seed.
//   rollAssembly(ctx,x,y,s,o)  TOP-DOWN assembly on wet rice paper (shots 11–15). origin = paper centre, R=170.
//                           o.layers 0..6 (fractional = the next layer dropping in): 1 lettuce, 2 herbs (basil/diếp cá/
//                           tía tô), 3 star fruit + green banana + cucumber, 4 pickled carrot/daikon + ram, 5 hot nem
//                           (o.slide 0..1 = pulled off the stick), 6 = all. o.roll 0..1: fold bottom (0–.35), sides
//                           (.35–.55), roll tight (.55–1). o.t, o.wet (default 1).
//   nemRoll(ctx,x,y,s,rot,o)   finished roll, side view, 270×86, translucent paper showing contents. o.bite 0..1.
//   nemRollCut(ctx,x,y,s,o) cross-section of a roll cut in half: oval face 120 wide + body to the right (o.len 160).
//                           o.backlight 0..1 (glowing translucent edge), o.rot.
//   giantRoll(ctx,x,y,s,rot,o) burrito-size roll, 600×210; o.bite 0..1 (bite mark at +x end), o.t (steam).
//   sauceBowl(ctx,x,y,s,o)  small bowl of thick orange nem sauce (tương chấm). origin = rim centre, R=110 (ellipse ry .42).
//                           o.fill 0..1, o.slosh (rad/amp), o.peanuts 0..1, o.scallionOil 0..1, o.chiliGarlic 0..1, o.t.
//   sauceStream(ctx,x0,y0,x1,y1,t,o)  thick viscous orange ribbon from (x0,y0) (spoon) to (x1,y1). o.w (22), o.k 0..1 reach.
//   toppingFall(ctx,t,t0,seed,n,x,y,o)  falling particles: o.kind 'peanut'|'scallion'|'chili'|'mix', o.w spread, o.g.
//
// EFFECTS
//   smoke(ctx,t,pts,o)        charcoal smoke RIBBON that follows a path pts [[x,y]...] (catmull smoothed).
//                             o.k 0..1 (how far the head has travelled), o.w (width, 40), o.alpha, o.warm 0..1 (sunlit),
//                             o.seed. Used for shot 4 (smoke into the tourist's nose).
//   embers(ctx,t,seed,n,x,y,w,h,o)  rising sparks from a rect (o.alpha, o.speed, o.size).
//   steam(ctx,t,seed,x,y,w,h,o)     soft translucent steam wisps rising from base (x..x+w, y) to y−h (o.n, o.alpha, o.w).
//                                    Alias steamWisps.
//   sizzle(ctx,t,x,y,s,o)            fat sizzle: spits, micro-sparks, tiny bubbles at a point (o.seed, o.alpha).
//   flavorBurst(ctx,x,y,s,k,o)       4 icons pop out radially: smoky, crunchy, fresh, rich (o.labels true draws EN+VI words).
//                                     k 0..1 life. Icons ≈ 120 diameter at s=1, ring radius 300.
//   waveWhoosh(ctx,x,y,s,k,o)        cartoon whoosh arcs + spray streaks (o.dir +1 = moving right).
//   godRays/flare/glow come from lib.js.
//
// PERFORMANCE NOTES
//   • No ctx.filter blur anywhere (Skia blur costs ≈10 ms per use regardless of size) — soft edges are radial gradients
//     or stacked low-alpha strokes. Keep it that way in shot code too.
//   • Internal perf helpers (not exported): mipOf/drawMip (pre-scaled sprite mip chain), halfLayer (half-res offscreen
//     layer upscaled once), hazedSprite (sprite pre-blended toward the mist colour per distance band).
//   • First call of floatingMarket / coUtBoat / herbBasket builds caches (see "first" column); later calls are cheap.
//
// TIMINGS (filled in from _test_nprops.js; ms, first call incl. cache build / cached)
//   measured with getImageData flush, Windows laptop, 1080×1920:
//   drawer                        first    avg
//   floatingMarket zoom0          ~210     ~25   (full frame, cached sprites)
//   floatingMarket zoom1           ~55     ~28-33 (borderline over the 25 ms target)
//   riverSide (full frame)         ~20     ~20
//   ghe                              6       6
//   coUtBoat (stove+grill+props)   ~20     ~20   (first ever call incl. sprite builds ≈31)
//   coUt fan                         3       4
//   tourist sit                      3.6     3.5
//   touristFace s1                   5       5-6
//   coUtFace s1                     10-12    9-10
//   boatman                          4       4
//   charcoalStove+grill              6       6
//   rollAssembly                     6       6
//   herbBasket                      10       2   (cached)
//   smoke                            3       3
//   flavorBurst                      6-8     4
// =====================================================================================================================
const L = require('./lib');
const P = require('./props');
const PEOPLE = require('./people');
const { W, H, TAU, rng, clamp, lerp, inv, ease, at, glow, createCanvas } = L;
const { ik, seg } = P;
const PI = Math.PI;
const { Path2D, DOMMatrix } = require('@napi-rs/canvas');

// ------------------------------------------------------------------------------------------------ helpers
const rot2 = (a, x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
function hx(c) { if (c[0] !== '#') { const m = c.match(/\d+/g); return [+m[0], +m[1], +m[2]]; } const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mixc(a, b, t) { const A = hx(a), B = hx(b); t = clamp(t); return `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`; }
function rgba(c, a) { const A = hx(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function lgr(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function rgr(ctx, x0, y0, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function canvas(w, h) { const c = createCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); return [c, c.getContext('2d')]; }
function ikPick(ax, ay, bx, by, l1, l2, preferX) { const a = ik(ax, ay, bx, by, l1, l2, 1), b = ik(ax, ay, bx, by, l1, l2, -1); return (preferX < 0 ? a[0] < b[0] : a[0] > b[0]) ? a : b; }
function ikUp(ax, ay, bx, by, l1, l2, preferY) { const a = ik(ax, ay, bx, by, l1, l2, 1), b = ik(ax, ay, bx, by, l1, l2, -1); return (preferY < 0 ? a[1] < b[1] : a[1] > b[1]) ? a : b; }
function mapper(ctx) { const m = ctx.getTransform(); return (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }
function rimLine(ctx, fn, col = 'rgba(255,205,140,0.75)', w = 4) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); fn(); ctx.stroke(); ctx.restore(); }
function ell(ctx, x, y, rx, ry, r = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), r, 0, TAU); }
const OUT = 'rgba(48,24,30,0.6)';
function capPath(ctx, x0, y0, x1, y1, w0, w1) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + PI / 2, a - PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - PI / 2, a + PI / 2, true);
  ctx.closePath();
}
function capFS(ctx, x0, y0, x1, y1, w0, w1, fill, lw = 2.4, out = OUT) {
  ctx.beginPath(); capPath(ctx, x0, y0, x1, y1, w0, w1);
  if (lw) { ctx.strokeStyle = out; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function outFill(ctx, fill, lw = 2.4, out = OUT) { if (lw) { ctx.strokeStyle = out; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); } ctx.fillStyle = fill; ctx.fill(); }
// catmull-rom → smooth point list
function smoothPts(pts, per = 8) {
  if (pts.length < 3) return pts.slice();
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// ------------------------------------------------------------------------------------------------ palette
const COL = {
  skyTop: '#2e2f5e', skyHi: '#5b4a82', skyMid: '#b5628a', skyPink: '#ec7f86', skyOrange: '#f9a35f', skyHorizon: '#ffd99a',
  sunCore: '#fff3cf', sun: '#ffb86b', sunRed: '#ff6a3d',
  water: '#3f4570', waterMid: '#8a5f80', waterHi: '#f2a070', waterDeep: '#232a4a', glitter: '#fff0c8',
  teal: '#1f4d55', tealD: '#13343c', haze: '#a07a95', bankFar: '#5e4f72', bankMid: '#36384f', bankNear: '#1d2533',
  smoke: '#4a4448', smokeLit: '#c9a08a',
  wood: '#6b4127', woodD: '#3e2416', woodL: '#9a6440', paintBlue: '#2f6f8f', paintRed: '#b8402e', paintGreen: '#3f7a4a',
  bamboo: '#c9a35e', bambooD: '#8e6b32', bambooL: '#ead39a',
  aoba: '#c9786c', aobaL: '#e7a495', aobaD: '#97504a', pants: '#1c1a1f', khan: '#141214', khanW: '#ece6dc',
  skin: ['#f3c7a2', '#d99a74', '#b27255'], skinT: ['#f7d2b5', '#e3a07e', '#c97c5e'], skinB: ['#e0a879', '#bf8058', '#91573a'],
  hair: '#1b1514', vest: '#f2742b', vestD: '#b94d18', vestStrap: '#2a2a2e',
  tee: '#8b8f93', teeD: '#5f6367', hatOlive: '#6f6b3e',
  nemRaw: '#e9a39c', nemCooked: '#b8622e', nemChar: '#4a2412', nemGloss: '#ffd9a0',
  ricePaper: '#f4ead6', ram: '#e5a443', ramD: '#b8701e', sauce: '#e07b2c', sauceD: '#a9521b', sauceL: '#f6a85a',
  lettuce: '#8fcf5a', lettuceD: '#4f9a35', basil: '#2f7a35', basilStem: '#7a3a5a', diepca: '#3f8f45', tiato: '#7a3a7a', tiatoG: '#4f8a3f',
  star: '#e8d24a', banana: '#cfe0a0', cucumber: '#4a8a3a', carrot: '#f08a2e', daikon: '#f4efe0',
  plate: '#f6f2ea', clay: '#b0603a', clayD: '#6e3520', clayL: '#d98a5c', coal: '#2a1a14', ember: '#ff7a2a', emberHot: '#ffd36a',
};
const SKIN_U = COL.skin, SKIN_T = COL.skinT;

// ================================================================================================ ENVIRONMENT
function dawnSky(ctx, y0, y1, o = {}) {
  const w = o.warm ?? 1;
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y1, [[0, COL.skyTop], [0.3, COL.skyHi], [0.58, mixc(COL.skyMid, COL.skyPink, w * 0.4)], [0.8, COL.skyPink], [0.92, COL.skyOrange], [1, COL.skyHorizon]]);
  ctx.fillRect(o.x0 ?? 0, y0, o.w ?? W, y1 - y0 + 1);
  // thin cloud streaks lit from below
  const r = rng(o.seed ?? 31), span = y1 - y0, t = o.t || 0;
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < (o.clouds ?? 9); i++) {
    const cy = y0 + span * (0.35 + r() * 0.5), cx = ((r() * 1.6 - 0.3) * W + t * 4 * (0.5 + r())) % (W * 1.4) - W * 0.2, cw = 200 + r() * 420, ch = 6 + r() * 14;
    const k = (cy - y0) / span;
    ctx.globalAlpha = 0.25 + 0.35 * k;
    ctx.fillStyle = rgr(ctx, cx, cy, 0, cx, cy, cw / 2, [[0, mixc('#ffc49a', '#ffe2b0', k)], [1, 'rgba(255,190,150,0)']]);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ch / cw); ctx.beginPath(); ctx.arc(0, 0, cw / 2, 0, TAU); ctx.restore(); ctx.fill();
  }
  ctx.restore();
}
function sun(ctx, x, y, s = 1, o = {}) {
  ctx.save();
  glow(ctx, x, y, 520 * s, 'rgba(255,150,90,0.55)', 1);
  glow(ctx, x, y, 230 * s, 'rgba(255,190,120,0.8)', 1);
  ctx.fillStyle = rgr(ctx, x, y, 0, x, y, 62 * s, [[0, COL.sunCore], [0.7, '#ffe3a3'], [0.92, '#ffb46a'], [1, 'rgba(255,140,80,0)']]);
  ctx.beginPath(); ctx.arc(x, y, 62 * s, 0, TAU); ctx.fill();
  glow(ctx, x, y, 95 * s, 'rgba(255,250,230,0.9)', 1);
  if (o.rays) L.godRays(ctx, x, y, PI / 2, 2.6, 1900 * s, 14, 'rgba(255,200,140,0.5)', 0.22 * o.rays, o.t || 0);
  if (o.flare) L.flare(ctx, x, y, s, o.flare);
  ctx.restore();
}

// ---- cached soft mist sprite
let _mistSpr = null;
function mistSprite() {
  if (_mistSpr) return _mistSpr;
  const [c, x] = canvas(1024, 128);
  const r = rng(91);
  for (let i = 0; i < 40; i++) {
    const cx = r() * 1024, cy = 64 + (r() - 0.5) * 50, rw = 80 + r() * 200;
    x.save(); x.translate(cx, cy); x.scale(1, 0.22);
    x.fillStyle = rgr(x, 0, 0, 0, 0, 0, rw, [[0, 'rgba(255,236,226,0.32)'], [1, 'rgba(255,236,226,0)']]);
    x.beginPath(); x.arc(0, 0, rw, 0, TAU); x.fill(); x.restore();
    // wrap
    if (cx > 1024 - rw) { x.save(); x.translate(cx - 1024, cy); x.scale(1, 0.22); x.fillStyle = rgr(x, 0, 0, 0, 0, 0, rw, [[0, 'rgba(255,236,226,0.32)'], [1, 'rgba(255,236,226,0)']]); x.beginPath(); x.arc(0, 0, rw, 0, TAU); x.fill(); x.restore(); }
    if (cx < rw) { x.save(); x.translate(cx + 1024, cy); x.scale(1, 0.22); x.fillStyle = rgr(x, 0, 0, 0, 0, 0, rw, [[0, 'rgba(255,236,226,0.32)'], [1, 'rgba(255,236,226,0)']]); x.beginPath(); x.arc(0, 0, rw, 0, TAU); x.fill(); x.restore(); }
  }
  _mistSpr = c; return c;
}
// drifting mist band centred on y, height h, alpha a; tint = warm pink by default
function mist(ctx, y, h, t, a = 0.6, o = {}) {
  const spr = mistSprite(), sw = (o.scaleX || 1.6) * 1024, off = ((t * (o.speed ?? 14)) % sw + sw) % sw;
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = o.mode || 'screen';
  for (let k = -1; k * sw - off < W + sw; k++) ctx.drawImage(spr, k * sw - off + (o.x0 || 0), y - h / 2, sw, h);
  ctx.restore();
}

// ---- palm / coconut tree sprites (silhouette w/ warm rim), cached
const _palm = {};
function palmSprite(v, col, rim) {
  const key = v + col + rim;
  if (_palm[key]) return _palm[key];
  const [c, x] = canvas(260, 420);
  const r = rng(200 + v * 17);
  x.translate(130, 410);
  const lean = (r() - 0.5) * 0.5, hgt = 300 + r() * 80;
  const top = [Math.sin(lean) * hgt, -hgt];
  x.strokeStyle = col; x.lineCap = 'round'; x.lineWidth = 11;
  x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(top[0] * 0.2, -hgt * 0.5, top[0], top[1]); x.stroke();
  const nf = 9 + Math.floor(r() * 4);
  for (let i = 0; i < nf; i++) {
    const a = -PI / 2 + (i / (nf - 1) - 0.5) * 3.6 + (r() - 0.5) * 0.3, len = 90 + r() * 50;
    const ex = top[0] + Math.cos(a) * len, ey = top[1] + Math.sin(a) * len * 0.7 + len * 0.35;
    const cx1 = top[0] + Math.cos(a) * len * 0.5, cy1 = top[1] + Math.sin(a) * len * 0.5 - 18;
    x.fillStyle = col; x.beginPath(); x.moveTo(top[0], top[1] - 3); x.quadraticCurveTo(cx1, cy1 - 8, ex, ey); x.quadraticCurveTo(cx1, cy1 + 10, top[0], top[1] + 4); x.fill();
    // leaflets
    x.strokeStyle = col; x.lineWidth = 2.2;
    for (let j = 2; j < 11; j++) { const u = j / 11; const px = lerp(top[0], ex, u), py = lerp(top[1], ey, u) - Math.sin(u * PI) * 14; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a + 1.6) * 16, py + 14); x.moveTo(px, py); x.lineTo(px + Math.cos(a - 1.6) * 16, py + 14); x.stroke(); }
  }
  if (rim) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = lgr(x, -130, 0, 130, 0, [[0, rim], [0.35, 'rgba(0,0,0,0)']]); x.fillRect(-130, -420, 260, 420); }
  _palm[key] = c; return c;
}
// bushy riverbank shrub (nipa / bần) sprite
const _bush = {};
function bushSprite(v, col) {
  const key = v + col; if (_bush[key]) return _bush[key];
  const [c, x] = canvas(300, 160); const r = rng(500 + v);
  x.fillStyle = col;
  for (let i = 0; i < 22; i++) { const bx = 20 + r() * 260, by = 150 - r() * 70 * Math.sin((bx / 300) * PI), br = 20 + r() * 34; x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill(); }
  x.fillRect(0, 140, 300, 20);
  // nipa fronds
  x.strokeStyle = col; x.lineWidth = 4; x.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const bx = 30 + r() * 240; x.beginPath(); x.moveTo(bx, 140); x.quadraticCurveTo(bx + (r() - 0.5) * 60, 40, bx + (r() - 0.5) * 120, 10 + r() * 40); x.stroke(); }
  _bush[key] = c; return c;
}
// long tileable far treeline strip (silhouette), cached by colour
const _strip = {};
function treeStrip(col, seed = 3, hgt = 150) {
  const key = col + seed + hgt; if (_strip[key]) return _strip[key];
  const [c, x] = canvas(2048, hgt + 20); const r = rng(seed);
  x.fillStyle = col; x.fillRect(0, hgt * 0.72, 2048, hgt);
  for (let i = 0; i < 120; i++) { const bx = r() * 2048, br = 12 + r() * 30, by = hgt * 0.72 - r() * 10; for (const dx of [0, -2048, 2048]) { x.beginPath(); x.arc(bx + dx, by, br, 0, TAU); x.fill(); } }
  for (let i = 0; i < 26; i++) {
    const bx = r() * 2048, sc = 0.25 + r() * 0.2;
    for (const dx of [0, -2048, 2048]) x.drawImage(palmSprite(Math.floor(r() * 6), col, null), bx + dx - 130 * sc, hgt * 0.8 - 410 * sc, 260 * sc, 420 * sc);
  }
  _strip[key] = c; return c;
}

// ---- floating-market boat sprites (cached ghe variants with cargo poles)
const ITEMS = ['pineapple', 'pumpkin', 'sweetpotato', 'watermelon', 'cabbage', 'coconut'];
const _gheSpr = {};
function gheSprite(v) {
  if (_gheSpr[v]) return _gheSpr[v];
  const S = 0.5, [c, x] = canvas(800 * S + 40, 900 * S + 60);
  const r = rng(700 + v * 13);
  const items = [ITEMS[v % ITEMS.length], ITEMS[(v + 2) % ITEMS.length], r() < 0.5 ? ITEMS[(v + 3) % ITEMS.length] : null].filter(Boolean);
  ghe(x, 400 * S + 20, 830 * S + 20, S / BK, { items, seed: v, t: 0, bob: 0, hull: [COL.wood, '#5a3a2a', '#6a4632', '#4a3a3a'][v % 4], paint: [COL.paintBlue, COL.paintRed, COL.paintGreen][v % 3], flip: v % 2 === 1, people: true });
  _gheSpr[v] = { c, ox: 400 * S + 20, oy: 830 * S + 20, S };
  return _gheSpr[v];
}

// ---- water band
function water(ctx, y0, y1, t, o = {}) {
  const sunX = o.sunX ?? 610, gold = o.gold || 0;
  ctx.save();
  ctx.fillStyle = lgr(ctx, 0, y0, 0, y1, [[0, mixc('#f0a58a', '#ffd08a', gold)], [0.06, mixc(COL.waterMid, '#d38a6a', gold)], [0.35, mixc(COL.water, '#8a5a5a', gold * 0.6)], [1, mixc(COL.waterDeep, '#3a2f3e', gold * 0.5)]]);
  ctx.fillRect(o.x0 ?? 0, y0, o.w ?? W, y1 - y0);
  // reflection column of the sun
  ctx.globalCompositeOperation = 'screen';
  const cw = (o.colW ?? 240) * (1 + gold);
  // soft column: stacked horizontal bands, each a feathered horizontal gradient (shimmering widths)
  const NB = 34, bh = (y1 - y0) / NB;
  for (let i = 0; i < NB; i++) {
    const v = i / NB, yy = y0 + v * (y1 - y0);
    const hw = lerp(cw * 0.18, cw * 1.25, Math.pow(v, 0.8)) * (0.85 + 0.25 * Math.sin(t * 2.1 + i * 1.7));
    const al = (v < 0.5 ? lerp(0.75 + gold * 0.2, 0.38 + gold * 0.3, v * 2) : lerp(0.38 + gold * 0.3, 0, (v - 0.5) * 2)) * (0.75 + 0.25 * Math.sin(t * 3 + i * 2.3));
    const cx = sunX + Math.sin(t * 1.3 + i * 0.9) * 6 * (0.3 + v);
    const c = v < 0.5 ? '255,190,120' : '255,150,90';
    ctx.fillStyle = lgr(ctx, cx - hw, 0, cx + hw, 0, [[0, `rgba(${c},0)`], [0.3, `rgba(${c},${al * 0.45})`], [0.5, `rgba(${c},${al})`], [0.7, `rgba(${c},${al * 0.45})`], [1, `rgba(${c},0)`]]);
    ctx.fillRect(cx - hw, yy, hw * 2, bh * (0.72 + 0.28 * Math.sin(i * 3.1 + t)) + 0.5);
  }
  ctx.restore();
  ripples(ctx, o.x0 ?? 0, y0, o.w ?? W, y1 - y0, t, { seed: o.seed ?? 5, alpha: o.rippleAlpha ?? 0.5, n: o.n ?? 90, panX: o.panX || 0 });
  // glitter under the sun
  const r = rng(o.seed ?? 77), n = o.glitter ?? 110;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const v = Math.pow(r(), 1.6), yy = y0 + v * (y1 - y0), spread = lerp(cw * 0.15, cw * 1.3, v) * (r() * 2 - 1) * 0.85;
    const tw = Math.sin(t * (4 + r() * 6) + r() * TAU);
    if (tw < 0.2) continue;
    const s = (1 + v * 6) * (0.6 + r() * 0.8);
    ctx.globalAlpha = tw * (1 - v * 0.6) * (0.7 + gold * 0.3);
    ctx.fillStyle = COL.glitter;
    ell(ctx, sunX + spread, yy, s * 3.2, s * 0.6); ctx.fill();
  }
  ctx.restore();
}
// ripple highlights in a rect; denser/thinner toward the top (far)
function ripples(ctx, x, y, w, h, t, o = {}) {
  const r = rng(o.seed ?? 5), n = o.n ?? 80, a = o.alpha ?? 0.5, col = o.col || '255,214,180', dark = o.dark ?? true;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const v = Math.pow(r(), 1.5), yy = y + v * h, len = (14 + r() * 50) * (0.4 + v * 2.2), sp = (6 + r() * 14) * (0.3 + v);
    let xx = x + ((r() * (w + 300) + t * sp - (o.panX || 0) * (0.3 + v) + Math.sin(t * 1.2 + i) * 6) % (w + 300) + (w + 300)) % (w + 300) - 150;
    const ph = Math.sin(t * 1.6 + i * 1.3);
    ctx.globalAlpha = a * (0.35 + 0.65 * Math.abs(ph)) * (0.5 + v * 0.5);
    ctx.strokeStyle = `rgba(${col},1)`; ctx.lineWidth = 1 + v * 3.5;
    ctx.beginPath(); ctx.moveTo(xx - len / 2, yy); ctx.quadraticCurveTo(xx, yy - 2 - v * 3, xx + len / 2, yy); ctx.stroke();
    if (dark) { ctx.globalAlpha *= 0.7; ctx.strokeStyle = 'rgba(20,30,55,1)'; ctx.beginPath(); ctx.moveTo(xx - len * 0.4, yy + 3 + v * 5); ctx.quadraticCurveTo(xx, yy + 6 + v * 7, xx + len * 0.45, yy + 3 + v * 5); ctx.stroke(); }
  }
  ctx.restore();
}

// ---- DRONE WIDE: Cái Răng floating market
const _fm = {};
function fmLayout() {
  if (_fm.layout) return _fm.layout;
  const r = rng(4242), boats = [], palms = [];
  // moored clusters along both sides + a loose middle lane; wx in metres, wz depth in metres
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1, wz = 40 + Math.pow(r(), 0.8) * 640;
    const wx = side * (20 + r() * 40) + (r() - 0.5) * 6;
    boats.push({ wx, wz, v: Math.floor(r() * 8), ph: r() * TAU, kind: 'ghe', drift: 0 });
  }
  for (let i = 0; i < 8; i++) boats.push({ wx: (r() - 0.5) * 24, wz: 60 + r() * 400, v: Math.floor(r() * 8), ph: r() * TAU, kind: r() < 0.5 ? 'xuong' : 'ghe', drift: (r() < 0.5 ? -1 : 1) * (1.2 + r() * 1.5) });
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1, wz = 30 + Math.pow(r(), 0.7) * 1100;
    palms.push({ wx: side * (74 + r() * 80), wz, v: Math.floor(r() * 6), bush: r() < 0.35, sc: 0.8 + r() * 0.5 });
  }
  _fm.layout = { boats, palms };
  return _fm.layout;
}
let _xuongSpr = null;
function xuongSprite() {
  if (_xuongSpr) return _xuongSpr;
  const S = 0.5, [c, x] = canvas(480 * S + 40, 420 * S + 40);
  xuongBaLa(x, 240 * S + 20, 380 * S + 20, S / BK, { bob: 0, people: true });
  _xuongSpr = { c, ox: 240 * S + 20, oy: 380 * S + 20, S }; return _xuongSpr;
}
// mip-mapped sprite levels (each half the size of the previous) - drawing big sprites tiny is slow in skia
const _mips = new WeakMap();
function mipOf(img, lvl) {
  if (!lvl) return img;
  let arr = _mips.get(img); if (!arr) { arr = [img]; _mips.set(img, arr); }
  for (let i = arr.length; i <= lvl; i++) {
    const p = arr[i - 1], [c, x] = canvas(Math.max(1, Math.ceil(p.width / 2)), Math.max(1, Math.ceil(p.height / 2)));
    x.imageSmoothingQuality = 'high'; x.drawImage(p, 0, 0, c.width, c.height); arr.push(c);
  }
  return arr[lvl];
}
// draw img (local origin ox,oy in img px) scaled by q, picking a mip level; caller has set the transform origin
function drawMip(ctx, img, ox, oy, q, dx = 0, dy = 0) {
  const lvl = Math.max(0, Math.min(4, Math.floor(Math.log2(1 / Math.max(1e-4, q))))), m = mipOf(img, lvl), k = 2 ** lvl;
  ctx.drawImage(m, dx - ox * q, dy - oy * q, m.width * k * q, m.height * k * q);
}
// reusable half-resolution scratch layers (W/2 x H/2), one per name
const _half = {};
function halfLayer(name) { return _half[name] || (_half[name] = canvas(W / 2, H / 2)); }
function hazedSprite(spr, lvl) {
  if (!lvl) return spr.c;
  spr.hz = spr.hz || [];
  if (spr.hz[lvl]) return spr.hz[lvl];
  const [c, x] = canvas(spr.c.width, spr.c.height);
  x.drawImage(spr.c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = lvl / 4 * 0.55; x.fillStyle = COL.haze; x.fillRect(0, 0, c.width, c.height);
  return (spr.hz[lvl] = c);
}
function floatingMarket(ctx, t, o = {}) {
  const zoom = clamp(o.zoom || 0), gold = o.gold || 0;
  const hy = o.horizon ?? lerp(520, 760, ease.inOut(zoom));
  const camH = o.camY ?? lerp(62, 24, ease.inOut(zoom)), z0 = zoom * 60 + (o.dolly || 0), panX = o.panX || 0, f = 900;
  const sunE = o.sun ?? 0.25, sx = 560 - panX * 3, sy = hy - 20 - sunE * 260;
  const project = (wx, wz) => { const z = wz - z0; if (z < 1) return null; return [540 + f * (wx - panX) / z, hy + f * camH / z, f / z]; };
  ctx.save();
  // soft sky + sun + horizon glow are rendered at HALF resolution and upscaled (all smooth gradients) - perf
  const [hc, hx] = halfLayer('fmSky');
  hx.setTransform(1, 0, 0, 1, 0, 0); hx.clearRect(0, 0, hc.width, hc.height); hx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  dawnSky(hx, 0, hy + 2, { t, warm: 1 });
  sun(hx, sx, sy, 1.15, {});
  glow(hx, sx, hy, 600, 'rgba(255,170,110,0.45)', 1);
  hx.setTransform(1, 0, 0, 1, 0, 0);
  const hh = Math.min(hc.height, Math.ceil(hy / 2) + 2);
  ctx.drawImage(hc, 0, 0, hc.width, hh, 0, 0, W, hh * 2);
  // far haze treeline
  const far = treeStrip(COL.bankFar, 3, 150), mid = treeStrip(COL.bankMid, 8, 170);
  const off = ((panX * 2) % 1400 + 1400) % 1400;
  ctx.globalAlpha = 0.85; ctx.drawImage(far, -off, hy - 92, 2048 * 0.7, 106 * 0.7 + 30); ctx.drawImage(far, -off + 1433, hy - 92, 2048 * 0.7, 106 * 0.7 + 30);
  ctx.globalAlpha = 1;
  // banks (land polygons) receding to horizon
  const water0 = hy;
  water(ctx, water0, H, t, { sunX: sx, gold, colW: 220, n: 120, glitter: 160 });
  for (const side of [-1, 1]) {
    ctx.beginPath();
    let first = true;
    for (let wz = 18; wz <= 2400; wz *= 1.12) {
      const wob = Math.sin(wz * 0.02 + side) * 4 + Math.sin(wz * 0.007) * 6;
      const p = project(side * (68 + wob), wz); if (!p) continue;
      if (first) { ctx.moveTo(side < 0 ? -10 : W + 10, p[1]); first = false; }
      ctx.lineTo(p[0], p[1]);
    }
    ctx.lineTo(side < 0 ? -10 : W + 10, hy); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, hy, 0, H, [[0, mixc(COL.bankFar, COL.haze, 0.4)], [0.12, COL.bankMid], [0.5, COL.bankNear], [1, '#141a24']]);
    ctx.fill();
  }
  // mid treeline at horizon over land edges
  ctx.drawImage(mid, -off * 1.3 - 300, hy - 120, 2048 * 0.9, 190 * 0.9);
  // objects sorted far → near
  const lay = fmLayout(), objs = [];
  for (const p of lay.palms) objs.push({ z: p.wz, p, type: 'palm' });
  if (o.boats !== false) for (const b of lay.boats) objs.push({ z: b.wz, b, type: 'boat' });
  objs.sort((a, b) => b.z - a.z);
  for (const ob of objs) {
    if (ob.type === 'palm') {
      const p = ob.p, pr = project(p.wx, p.wz); if (!pr) continue;
      const k = Math.round(clamp(1 - (p.wz - z0) / 1100) * 10) / 10; // quantised: sprite cache key
      const col = mixc(mixc(COL.bankFar, '#a88aa0', 0.2), COL.bankNear, Math.pow(k, 0.7));
      const sc = pr[2] * 0.11 * p.sc;
      if (pr[0] < -400 || pr[0] > W + 400 || sc < 0.02) continue;
      if (p.bush) drawMip(ctx, bushSprite(p.v, col), 150, 150, sc * 1.6, pr[0], pr[1]);
      else drawMip(ctx, palmSprite(p.v, col, k > 0.5 ? 'rgba(255,170,110,0.55)' : null), 130, 410, sc, pr[0], pr[1]);
    } else {
      const b = ob.b, wx = b.wx + (b.drift ? ((t * b.drift + 40) % 80) - 40 : 0), pr = project(wx, b.wz); if (!pr) continue;
      const sc = pr[2] * 16 / 760 * 1.0; // ~16 m boats
      if (pr[0] < -300 || pr[0] > W + 300 || pr[1] > H + 200) continue;
      const spr = b.kind === 'xuong' ? xuongSprite() : gheSprite(b.v), q = sc / spr.S;
      const bob = Math.sin(t * 1.4 + b.ph) * 2 * q, rk = Math.sin(t * 1.1 + b.ph) * 0.02;
      const img = hazedSprite(spr, Math.round(clamp((b.wz - z0) / 700) * 4)); // atmospheric haze baked per level (0..4)
      ctx.save(); ctx.translate(pr[0], pr[1] + bob); ctx.rotate(rk);
      // reflection
      ctx.save(); ctx.scale(1, -0.7); ctx.globalAlpha = 0.28; drawMip(ctx, img, spr.ox, spr.oy, q); ctx.restore();
      drawMip(ctx, img, spr.ox, spr.oy, q);
      ctx.restore();
      // waterline foam
      ctx.save(); ctx.globalAlpha = 0.4; ctx.strokeStyle = 'rgba(255,220,190,1)'; ctx.lineWidth = Math.max(1, 3 * q * spr.S);
      ctx.beginPath(); ctx.ellipse(pr[0], pr[1] + bob + 2, 360 * q * spr.S, 12 * q * spr.S, 0, 0, PI); ctx.stroke(); ctx.restore();
    }
  }
  // mist over the river
  const mA = o.mist ?? 0.7;
  mist(ctx, hy + 10, 120, t, mA * 0.9, { speed: 10 });
  mist(ctx, hy + 120, 220, t + 30, mA * 0.55, { speed: 18, scaleX: 2.2 });
  mist(ctx, hy + 420, 360, t + 60, mA * 0.3, { speed: 26, scaleX: 3 });
  // sun glare + rays
  L.godRays(ctx, sx, sy, PI / 2, 2.4, 1700, 9, 'rgba(255,190,130,0.6)', 0.17 + gold * 0.12, t);
  glow(ctx, sx, sy, 300, 'rgba(255,220,170,0.5)', 0.8 + gold * 0.4);
  if (gold) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = gold * 0.6; ctx.fillStyle = '#ffb34a'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  ctx.restore();
  return { horizon: hy, sun: [sx, sy], project };
}

// ---- WATER-LEVEL MID SHOT
function riverSide(ctx, t, panX = 0, o = {}) {
  const hy = o.horizon ?? 980, sx = (o.sunX ?? 610) - panX * 0.05, sy = o.sunY ?? hy - 70;
  ctx.save();
  dawnSky(ctx, 0, hy, { t });
  sun(ctx, sx, sy, o.sunS ?? 1.1, { rays: o.rays ?? 0.6, t });
  const far = treeStrip(COL.bankFar, 3, 150), mid = treeStrip(COL.bankMid, 8, 170);
  const o1 = ((panX * 0.12) % 2048 + 2048) % 2048, o2 = ((panX * 0.22) % 2048 + 2048) % 2048;
  ctx.globalAlpha = 0.9; ctx.drawImage(far, -o1, hy - 130, 2048, 170); ctx.drawImage(far, 2048 - o1, hy - 130, 2048, 170);
  ctx.globalAlpha = 1;
  glow(ctx, sx, hy - 20, 520, 'rgba(255,170,110,0.4)', 1);
  ctx.drawImage(mid, -o2, hy - 150, 2048 * 1.1, 190 * 1.1 * 0.9); ctx.drawImage(mid, 2048 * 1.1 - o2, hy - 150, 2048 * 1.1, 190 * 1.1 * 0.9);
  water(ctx, hy, H, t, { sunX: sx, panX, n: 110, glitter: 140, gold: o.gold || 0 });
  if (o.farBoats !== false) {
    const r = rng(o.seed ?? 12);
    for (let i = 0; i < 9; i++) {
      const v = Math.floor(r() * 8), bx = ((r() * 1800 - panX * 0.35) % 1800 + 1800) % 1800 - 360, sc = 0.16 + r() * 0.1;
      const spr = gheSprite(v), q = sc / spr.S, by = hy + 14 + sc * 60 + Math.sin(t * 1.3 + i) * 1.5;
      ctx.save(); ctx.translate(bx, by); ctx.scale(q, q);
      ctx.save(); ctx.scale(1, -0.6); ctx.globalAlpha = 0.25; ctx.drawImage(spr.c, -spr.ox, -spr.oy); ctx.restore();
      ctx.globalAlpha = 0.9; ctx.drawImage(spr.c, -spr.ox, -spr.oy); ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = lgr(ctx, 0, hy - 200, 0, hy + 60, [[0, 'rgba(240,150,140,0)'], [0.7, 'rgba(240,160,140,0.35)'], [1, 'rgba(240,160,140,0)']]); ctx.fillRect(0, hy - 200, W, 260); ctx.restore();
  }
  mist(ctx, hy + 6, 110, t, (o.mist ?? 0.7) * 0.9, { speed: 12 });
  mist(ctx, hy + 90, 160, t + 20, (o.mist ?? 0.7) * 0.4, { speed: 20, scaleX: 2 });
  const ox = -panX;
  if (o.mid) { ctx.save(); o.mid(ctx, ox); ctx.restore(); }
  // foreground water overlay
  const fy = o.fgY ?? 1560;
  if (fy < H) {
    ctx.save();
    ctx.fillStyle = lgr(ctx, 0, fy, 0, H, [[0, 'rgba(30,40,70,0)'], [0.25, 'rgba(30,40,70,0.35)'], [1, 'rgba(18,24,46,0.7)']]);
    ctx.fillRect(0, fy, W, H - fy);
    ripples(ctx, 0, fy + 20, W, H - fy, t, { seed: 99, n: 40, alpha: 0.55, panX: panX * 1.4 });
    ctx.restore();
  }
  ctx.restore();
  return { horizon: hy, sun: [sx, sy] };
}

// ---- wakes, waves, splashes
function boatWake(ctx, x, y, s = 1, t = 0, o = {}) {
  const dir = o.dir ?? 1, len = (o.len ?? 600) * s, st = o.strength ?? 1;
  ctx.save(); ctx.lineCap = 'round';
  // churned water right behind stern
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = rgr(ctx, x - dir * 40 * s, y + 6 * s, 0, x - dir * 40 * s, y + 6 * s, 140 * s, [[0, `rgba(255,236,220,${0.55 * st})`], [1, 'rgba(255,236,220,0)']]);
  ctx.save(); ctx.translate(x - dir * 60 * s, y + 8 * s); ctx.scale(1.8, 0.35); ctx.beginPath(); ctx.arc(0, 0, 140 * s, 0, TAU); ctx.restore(); ctx.fill();
  // two diverging V arms (side view: one goes toward camera (down), one away (up))
  for (const arm of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, px = x - dir * u * len, py = y + arm * u * (arm > 0 ? 70 : 22) * s + Math.sin(u * 14 - t * 6 + j) * 3 * s + j * 6 * s * arm;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.globalAlpha = st * (0.55 - j * 0.15); ctx.strokeStyle = 'rgba(255,232,212,1)'; ctx.lineWidth = (5 - j * 1.4) * s; ctx.stroke();
    }
  }
  // foam flecks
  const r = rng(o.seed ?? 3);
  for (let i = 0; i < 40; i++) {
    const u = r(), life = (u + t * 0.6) % 1, px = x - dir * life * len, py = y + (r() - 0.3) * life * 70 * s;
    ctx.globalAlpha = st * (1 - life) * 0.8; ctx.fillStyle = '#fff1e0'; ell(ctx, px, py, (3 + r() * 6) * s, (1 + r() * 2) * s); ctx.fill();
  }
  ctx.restore();
}
function bigWave(ctx, x, y, s = 1, k = 0.5, o = {}) {
  // a translucent river swell rolling toward dir; steep front, long back; orange-lit back, foam crest, lace
  const env = Math.sin(clamp(k) * PI), amp = (o.amp ?? 1) * env * 150 * s, w = (o.w ?? 900) * s, t = o.t || 0, dir = o.dir ?? 1;
  if (amp < 0.5) return { crest: [x, y] };
  const N = 64, pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N * 2 - 1, f = u * dir - 0.1, px = x + u * w / 2;
    const prof = (f < 0 ? Math.exp(-f * f * 3.2) : Math.exp(-f * f * 16)) * amp;
    pts.push([px, y - prof + Math.sin(u * 22 + t * 5) * 2.5 * s * env]);
  }
  let ci = 0; for (let i = 1; i <= N; i++) if (pts[i][1] < pts[ci][1]) ci = i;
  const top = pts[ci], base = y + 50 * s;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.bezierCurveTo(x + w * 0.3, base, x - w * 0.3, base, pts[0][0], pts[0][1]); ctx.closePath(); // tapered ends, no hard sides
  // body: translucent teal-indigo, fading into the river at the base
  ctx.fillStyle = lgr(ctx, 0, y - amp, 0, base, [[0, 'rgba(96,150,158,0.82)'], [0.3, 'rgba(62,96,118,0.78)'], [0.75, 'rgba(46,62,96,0.5)'], [1, 'rgba(40,52,84,0)']]);
  ctx.fill();
  ctx.save(); ctx.clip();
  // light passing through the thin crest (sub-surface glow)
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = lgr(ctx, 0, y - amp, 0, y - amp * 0.45, [[0, 'rgba(120,210,190,0.45)'], [1, 'rgba(120,210,190,0)']]);
  ctx.fillRect(x - w / 2, y - amp - 10, w, amp);
  // sunrise on the back slope
  ctx.fillStyle = lgr(ctx, x - w / 2 * dir, 0, top[0], 0, [[0, 'rgba(255,160,100,0)'], [0.7, 'rgba(255,170,110,0.35)'], [1, 'rgba(255,200,140,0.55)']]);
  ctx.fillRect(x - w / 2, y - amp - 10, w, amp + 70 * s);
  // lace: dashed foam lines trailing down the face
  ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
  const r = rng(o.seed ?? 31);
  for (let j = 0; j < 7; j++) {
    const d = (j + 1) / 8, off = r() * 40 * s;
    ctx.beginPath();
    for (let i = 4; i <= N - 4; i++) {
      const p = pts[i], yy = p[1] + d * (base - p[1]) * 0.7 + Math.sin(i * 0.9 + j * 2 + t * 3) * 4 * s;
      if (i === 4) ctx.moveTo(p[0] + off, yy); else ctx.lineTo(p[0] + off, yy);
    }
    ctx.setLineDash([(18 + r() * 30) * s, (10 + r() * 26) * s]);
    ctx.strokeStyle = `rgba(235,245,248,${0.32 * (1 - d)})`; ctx.lineWidth = (3.5 - d * 2.5) * s; ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  // crest rim light + foam crest
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const crest = pts.slice(Math.max(0, ci - 16), Math.min(N, ci + 10) + 1);
  ctx.strokeStyle = 'rgba(255,214,170,0.55)'; ctx.lineWidth = 12 * s;
  ctx.beginPath(); crest.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,244,0.95)'; ctx.lineWidth = 5 * s; ctx.stroke();
  const rf = rng((o.seed ?? 31) + 7);
  ctx.fillStyle = 'rgba(255,250,244,0.9)';
  for (let i = 0; i < 26; i++) {
    const p = crest[Math.floor(rf() * crest.length)], j = Math.sin(t * 6 + i) * 3 * s;
    ell(ctx, p[0] + (rf() - 0.5) * 14 * s, p[1] - rf() * 6 * s + j, (3 + rf() * 6) * s, (2 + rf() * 3) * s); ctx.fill();
  }
  // curling lip + spray when breaking (k > .4)
  const br = clamp((k - 0.4) / 0.4) * (o.breaking ?? 1);
  if (br > 0) {
    ctx.fillStyle = 'rgba(255,250,244,0.8)';
    ctx.beginPath(); ctx.moveTo(top[0] - dir * 40 * s, top[1] + 4 * s);
    ctx.quadraticCurveTo(top[0] + dir * 60 * s * br, top[1] - 44 * s * br, top[0] + dir * 100 * s * br, top[1] + 26 * s * br);
    ctx.quadraticCurveTo(top[0] + dir * 46 * s, top[1] + 2 * s, top[0] - dir * 40 * s, top[1] + 4 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,170,0.7)'; ctx.lineWidth = 2.5 * s; ctx.stroke();
    const rs = rng(o.seed ?? 21);
    for (let i = 0; i < 50; i++) {
      const a = -PI / 2 + dir * (rs() * 1.5) - 0.25 * dir, v = (50 + rs() * 220) * s * br;
      const px = top[0] + Math.cos(a) * v, py = top[1] + Math.sin(a) * v + 140 * s * br * br, rr = (1.5 + rs() * 4.5) * s;
      ctx.globalAlpha = (1 - br * 0.55) * 0.9;
      ctx.fillStyle = i % 3 ? 'rgba(255,250,244,1)' : 'rgba(255,214,170,1)';
      ell(ctx, px, py, rr, rr * (0.8 + rs() * 0.5)); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return { crest: [top[0], top[1]] };
}
function splash(ctx, x, y, s = 1, k = 0, o = {}) {
  // milk-crown splash: translucent sheet + thin tapered spikes with droplet tips, flying drops, foam ring
  if (k <= 0 || k >= 1) return;
  const r = rng(o.seed ?? 8), fade = 1 - k;
  const ch = Math.sin(Math.min(1, k * 1.6) * PI * 0.5) * (1 - k * 0.55) * 150 * s, cw = (50 + k * 130) * s;
  ctx.save(); ctx.lineCap = 'round';
  // thin translucent sheet (back half of the crown)
  ctx.fillStyle = lgr(ctx, 0, y - ch * 0.6, 0, y, [[0, `rgba(240,248,252,${0.12 * fade})`], [1, `rgba(240,248,252,${0.45 * fade})`]]);
  ctx.beginPath(); ctx.moveTo(x - cw, y);
  ctx.bezierCurveTo(x - cw * 1.05, y - ch * 0.5, x - cw * 0.5, y - ch * 0.62, x, y - ch * 0.55);
  ctx.bezierCurveTo(x + cw * 0.5, y - ch * 0.62, x + cw * 1.05, y - ch * 0.5, x + cw, y);
  ctx.closePath(); ctx.fill();
  // spikes
  const NS = o.spikes ?? 13;
  for (let i = 0; i < NS; i++) {
    const u = (i + 0.5) / NS * 2 - 1, bx = x + u * cw, lean = u * 0.55 + (r() - 0.5) * 0.25;
    const hh = ch * (0.55 + r() * 0.6) * (1 - Math.abs(u) * 0.35), bw = (6 + r() * 6) * s * (1 - k * 0.4);
    const tx = bx + lean * hh, ty = y - hh;
    ctx.fillStyle = `rgba(250,252,255,${0.75 * fade})`;
    ctx.beginPath(); ctx.moveTo(bx - bw, y); ctx.quadraticCurveTo(bx - bw * 0.3 + lean * hh * 0.4, y - hh * 0.55, tx, ty);
    ctx.quadraticCurveTo(bx + bw * 0.3 + lean * hh * 0.4, y - hh * 0.55, bx + bw, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(255,206,160,${0.6 * fade})`; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(bx + bw, y); ctx.quadraticCurveTo(bx + bw * 0.3 + lean * hh * 0.4, y - hh * 0.55, tx, ty); ctx.stroke();
    const dd = (2.5 + r() * 3) * s, sep = k * 30 * s;
    ctx.fillStyle = `rgba(255,255,255,${0.9 * fade})`;
    ell(ctx, tx + lean * sep, ty - sep, dd, dd * 1.25); ctx.fill();
  }
  // flying droplets on ballistic arcs
  for (let i = 0; i < 40; i++) {
    const a = -PI / 2 + (r() - 0.5) * 2.4, v = (220 + r() * 520) * s, tt = k * 1.1;
    const px = x + Math.cos(a) * v * tt, py = y + Math.sin(a) * v * tt + 900 * s * tt * tt;
    const rr = (2 + r() * 5) * s;
    if (py > y + 10 * s) continue;
    ctx.fillStyle = i % 4 ? `rgba(250,252,255,${0.85 * (1 - k * 0.7)})` : `rgba(255,214,170,${0.85 * (1 - k * 0.7)})`;
    ell(ctx, px, py, rr, rr * 1.3, a + PI / 2); ctx.fill();
  }
  // foam rings on the water
  ctx.strokeStyle = `rgba(255,248,240,${0.55 * fade})`; ctx.lineWidth = 4 * s;
  ell(ctx, x, y + 4 * s, cw * 1.3, cw * 0.18); ctx.stroke();
  ctx.strokeStyle = `rgba(255,248,240,${0.3 * fade})`; ctx.lineWidth = 2 * s;
  ell(ctx, x, y + 6 * s, cw * 1.7 * (0.6 + k), cw * 0.24 * (0.6 + k)); ctx.stroke();
  ctx.restore();
}

// ================================================================================================ BOATS
// Boats are authored in NATIVE units and scaled by BK so that at the same s they match the characters
// (Cô Út ≈ 548 tall, coUtBoat ≈ 1600 long). Public numbers in the header are already ×BK.
const BK = 2.5;
function boatXform(ctx, x, y, s, o) {
  const t = o.t || 0, ph = o.seed ? o.seed * 1.7 : 0;
  const bob = Math.sin(t * 1.4 + ph) * (o.bob ?? 4) * s;
  const rk = (o.sway || 0) + Math.sin(t * 1.1 + ph) * 0.012 * (o.rock ?? 1);
  ctx.translate(x, y + bob); if (rk) ctx.rotate(rk);
  const k = s * BK; ctx.scale(o.flip ? -k : k, k);
}
// hull outline in native units; returns gunwale y-function
function hullPath(ctx, Lh, gunMid, sternUp, bowUp, depth) {
  const c = (-gunMid + 0.125 * (sternUp + bowUp)) / 0.75;
  ctx.beginPath();
  ctx.moveTo(-Lh / 2, -sternUp);
  ctx.bezierCurveTo(-Lh * 0.2, -c, Lh * 0.2, -c, Lh / 2, -bowUp);
  ctx.quadraticCurveTo(Lh / 2 - 14, -gunMid * 0.25, Lh * 0.34, depth);
  ctx.quadraticCurveTo(0, depth + 8, -Lh * 0.36, depth);
  ctx.quadraticCurveTo(-Lh / 2 + 10, -gunMid * 0.25, -Lh / 2, -sternUp);
  ctx.closePath();
  return (x) => { // approx gunwale y at x (bezier sampled by u ≈ x)
    const u = clamp(x / Lh + 0.5), a = (1 - u);
    return -(a * a * a * sternUp + 3 * a * a * u * c + 3 * a * u * u * c + u * u * u * bowUp);
  };
}
function gunwaleStroke(ctx, Lh, gunMid, sternUp, bowUp, dy = 0) {
  const c = (-gunMid + 0.125 * (sternUp + bowUp)) / 0.75;
  ctx.beginPath(); ctx.moveTo(-Lh / 2, -sternUp + dy); ctx.bezierCurveTo(-Lh * 0.2, -c + dy, Lh * 0.2, -c + dy, Lh / 2, -bowUp + dy);
}
// draws the visible hull side (front part)
function hullSide(ctx, d) {
  const { Lh, gun, st, bw, dep, base, paint, trim, eye } = d;
  const gy = hullPath(ctx, Lh, gun, st, bw, dep);
  ctx.save(); ctx.clip();
  ctx.fillStyle = lgr(ctx, 0, -bw, 0, dep, [[0, shadeC(base, 0.18)], [0.35, base], [1, shadeC(base, -0.55)]]);
  ctx.fillRect(-Lh, -bw - 20, Lh * 2, dep + bw + 40);
  // teal shade (backlit side faces camera)
  ctx.fillStyle = rgba(COL.tealD, 0.28); ctx.fillRect(-Lh, -gun * 0.6, Lh * 2, dep + gun);
  // strakes
  ctx.strokeStyle = 'rgba(20,10,8,0.35)'; ctx.lineWidth = 1.6;
  for (let i = 1; i <= 4; i++) { gunwaleStroke(ctx, Lh, gun, st, bw, i * (gun * 0.2)); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,200,150,0.12)'; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) { gunwaleStroke(ctx, Lh, gun, st, bw, i * (gun * 0.2) + 2); ctx.stroke(); }
  // paint band under gunwale
  if (paint) { gunwaleStroke(ctx, Lh, gun, st, bw, gun * 0.12); ctx.strokeStyle = paint; ctx.lineWidth = gun * 0.16; ctx.stroke(); }
  if (trim) { gunwaleStroke(ctx, Lh, gun, st, bw, gun * 0.24); ctx.strokeStyle = trim; ctx.lineWidth = gun * 0.05; ctx.stroke(); }
  // bow panel + mắt ghe
  if (eye) {
    ctx.fillStyle = eye.panel || COL.paintRed;
    ctx.beginPath(); ctx.moveTo(Lh * 0.31, -gun * 1.5); ctx.quadraticCurveTo(Lh * 0.36, -gun * 0.3, Lh * 0.42, dep); ctx.lineTo(Lh, dep); ctx.lineTo(Lh, -gun * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(Lh * 0.3, -gun * 0.3, Lh, dep + gun);
    const ex = Lh * 0.415, ey = gy(Lh * 0.415) + gun * 0.42, er = gun * 0.28;
    ctx.fillStyle = '#f5efe2'; ctx.beginPath(); ctx.moveTo(ex - er * 1.4, ey); ctx.quadraticCurveTo(ex, ey - er * 1.1, ex + er * 1.4, ey - er * 0.15); ctx.quadraticCurveTo(ex, ey + er * 0.9, ex - er * 1.4, ey); ctx.fill();
    ctx.strokeStyle = '#1a1210'; ctx.lineWidth = er * 0.16; ctx.stroke();
    ctx.fillStyle = '#16100e'; ctx.beginPath(); ctx.arc(ex + er * 0.25, ey - er * 0.08, er * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + er * 0.38, ey - er * 0.22, er * 0.12, 0, TAU); ctx.fill();
  }
  // waterline darkening + wet sheen
  ctx.fillStyle = lgr(ctx, 0, -gun * 0.25, 0, dep, [[0, 'rgba(10,14,28,0)'], [0.6, 'rgba(10,14,28,0.55)'], [1, 'rgba(10,14,28,0.8)']]);
  ctx.fillRect(-Lh, -gun * 0.25, Lh * 2, dep + gun);
  ctx.restore();
  // gunwale cap rail with warm rim
  gunwaleStroke(ctx, Lh, gun, st, bw, 0); ctx.strokeStyle = shadeC(base, -0.35); ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
  rimLine(ctx, () => gunwaleStroke(ctx, Lh, gun, st, bw, -3), 'rgba(255,196,130,0.85)', 3.2);
  // stem/stern posts
  ctx.strokeStyle = shadeC(base, -0.45); ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(Lh / 2, -bw); ctx.lineTo(Lh / 2 + 8, -bw - 14); ctx.stroke();
  // foam at waterline
  ctx.strokeStyle = 'rgba(255,226,200,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-Lh * 0.42, 2); ctx.quadraticCurveTo(0, 7, Lh * 0.43, 0); ctx.stroke();
  return gy;
}
function shadeC(hex, f) { return f < 0 ? mixc(hex, '#000000', -f) : mixc(hex, '#ffffff', f); }
// far inner gunwale (seen behind the deck)
function innerGunwale(ctx, Lh, gun, st, bw, col) {
  ctx.save();
  gunwaleStroke(ctx, Lh * 0.97, gun * 0.93, st * 0.95, bw * 0.95, -gun * 0.06); ctx.strokeStyle = shadeC(col, -0.5); ctx.lineWidth = 6; ctx.stroke();
  // inner hull wall
  gunwaleStroke(ctx, Lh * 0.97, gun * 0.93, st * 0.95, bw * 0.95, -gun * 0.06);
  ctx.lineTo(Lh * 0.4, -gun * 0.4); ctx.lineTo(-Lh * 0.4, -gun * 0.4); ctx.closePath();
  ctx.fillStyle = shadeC(col, -0.42); ctx.fill();
  rimLine(ctx, () => gunwaleStroke(ctx, Lh * 0.97, gun * 0.93, st * 0.95, bw * 0.95, -gun * 0.06 - 3), 'rgba(255,190,130,0.6)', 2.4);
  ctx.restore();
}

// ---- fruit / produce (char units, ~90 across at s=1)
function fruit(ctx, kind, x, y, s = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const rim = (r) => { ctx.save(); ctx.clip(); ctx.fillStyle = rgr(ctx, -r * 0.7, -r * 0.8, 0, -r * 0.7, -r * 0.8, r * 1.3, [[0, 'rgba(255,200,140,0.55)'], [1, 'rgba(255,200,140,0)']]); ctx.globalCompositeOperation = 'screen'; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4); ctx.fillStyle = 'rgba(20,50,60,0.35)'; ctx.globalCompositeOperation = 'source-over'; ell(ctx, r * 0.45, r * 0.5, r * 0.9, r * 0.8); ctx.fill(); ctx.restore(); };
  if (kind === 'pineapple') {
    ctx.fillStyle = '#4f8a54';
    for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.28; ctx.beginPath(); ctx.moveTo(-6, -40); ctx.quadraticCurveTo(Math.cos(a) * 30 - 4, -40 + Math.sin(a) * 30, Math.cos(a) * 52, -44 + Math.sin(a) * 48); ctx.quadraticCurveTo(Math.cos(a) * 20 + 4, -40 + Math.sin(a) * 22, 6, -40); ctx.fill(); }
    ell(ctx, 0, 0, 30, 44); ctx.fillStyle = rgr(ctx, -10, -12, 4, 0, 0, 46, [[0, '#f0b44a'], [0.6, '#c27a2a'], [1, '#7a4418']]); ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 30, 44); ctx.clip(); ctx.strokeStyle = 'rgba(70,34,10,0.6)'; ctx.lineWidth = 2;
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * 11 - 40, -50); ctx.lineTo(i * 11 + 40, 50); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 11 + 40, -50); ctx.lineTo(i * 11 - 40, 50); ctx.stroke(); }
    ctx.restore(); ell(ctx, 0, 0, 30, 44); rim(40);
  } else if (kind === 'pumpkin') {
    ell(ctx, 0, 0, 50, 36); ctx.fillStyle = rgr(ctx, -14, -12, 4, 0, 0, 54, [[0, '#ffb35a'], [0.6, '#e0761f'], [1, '#8a3e10']]); ctx.fill();
    ctx.strokeStyle = 'rgba(120,50,10,0.5)'; ctx.lineWidth = 2.4;
    for (const rx of [14, 30, 44]) { ell(ctx, 0, 0, rx, 35); ctx.stroke(); }
    ctx.fillStyle = '#5a6a2a'; ctx.fillRect(-4, -46, 8, 14); ell(ctx, 0, 0, 50, 36); rim(46);
  } else if (kind === 'sweetpotato') {
    ctx.beginPath(); ctx.moveTo(-56, 2); ctx.quadraticCurveTo(-30, -24, 10, -20); ctx.quadraticCurveTo(48, -16, 58, 0); ctx.quadraticCurveTo(40, 20, 0, 20); ctx.quadraticCurveTo(-36, 20, -56, 2);
    ctx.fillStyle = lgr(ctx, 0, -22, 0, 22, [[0, '#c4566a'], [0.5, '#8e2e4a'], [1, '#4e1428']]); ctx.fill();
    ctx.strokeStyle = 'rgba(40,10,20,0.5)'; ctx.lineWidth = 1.2; for (const xx of [-30, -8, 20, 40]) { ctx.beginPath(); ctx.moveTo(xx, -14); ctx.quadraticCurveTo(xx + 3, 0, xx - 2, 14); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-56, 2); ctx.quadraticCurveTo(-30, -24, 10, -20); ctx.quadraticCurveTo(48, -16, 58, 0); ctx.quadraticCurveTo(40, 20, 0, 20); ctx.quadraticCurveTo(-36, 20, -56, 2); rim(40);
  } else if (kind === 'watermelon') {
    ell(ctx, 0, 0, 52, 38); ctx.fillStyle = rgr(ctx, -14, -12, 4, 0, 0, 56, [[0, '#4f9a4a'], [0.7, '#256a2e'], [1, '#123a1a']]); ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 52, 38); ctx.clip(); ctx.strokeStyle = 'rgba(160,210,120,0.55)'; ctx.lineWidth = 5;
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); for (let j = 0; j <= 10; j++) { const yy = -40 + j * 8, xx = i * 13 + Math.sin(j * 1.4 + i) * 4; j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); }
    ctx.restore(); ell(ctx, 0, 0, 52, 38); rim(46);
  } else if (kind === 'cabbage') {
    ell(ctx, 0, 0, 42, 38); ctx.fillStyle = rgr(ctx, -12, -12, 4, 0, 0, 46, [[0, '#e4f2b0'], [0.6, '#a9cf6e'], [1, '#5f8f3a']]); ctx.fill();
    ctx.strokeStyle = 'rgba(80,120,50,0.6)'; ctx.lineWidth = 2;
    for (const a of [-0.9, -0.2, 0.5]) { ctx.beginPath(); ctx.arc(Math.cos(a) * 60 - 30, 0, 50, -0.8, 0.8); ctx.stroke(); }
    ell(ctx, 0, 0, 42, 38); rim(40);
  } else { // coconut
    ell(ctx, 0, 0, 38, 40); ctx.fillStyle = rgr(ctx, -10, -12, 4, 0, 0, 44, [[0, '#9cc25a'], [0.6, '#5e8a2e'], [1, '#2f4a16']]); ctx.fill();
    ctx.fillStyle = '#6a4a2a'; ell(ctx, 0, -36, 12, 6); ctx.fill();
    ell(ctx, 0, 0, 38, 40); rim(38);
  }
  ctx.restore();
}
function cargoPile(ctx, x, y, w, items, seed, s) {
  const r = rng(seed);
  const n = Math.round(w / (36 * s)) * 2;
  for (let row = 0; row < 3; row++) {
    const cnt = Math.max(1, Math.round(n / (row + 1.5)));
    for (let i = 0; i < cnt; i++) {
      const u = (i + 0.5) / cnt, px = x - w / 2 * (1 - row * 0.28) + u * w * (1 - row * 0.28) + (r() - 0.5) * 8 * s;
      fruit(ctx, items[Math.floor(r() * items.length)], px, y - row * 26 * s - Math.sin(u * PI) * 10 * s, s * (0.42 + r() * 0.1), (r() - 0.5) * 1.2);
    }
  }
}

// ---- cây bẹo: long bamboo pole with hanging goods (char units)
function beoPole(ctx, x, y, s = 1, o = {}) {
  const len = o.len ?? 760, t = o.t || 0, ang = (o.angle || 0) + Math.sin(t * 0.9 + (o.seed || 0)) * 0.01, bend = o.bend ?? 0.04;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  const tipX = Math.sin(bend) * len * 0.5, tipY = -len;
  const w0 = o.w ?? Math.max(10, len * 0.016), w1 = w0 * 0.55;
  // pole
  ctx.beginPath(); ctx.moveTo(-w0 / 2, 0); ctx.quadraticCurveTo(tipX * 0.3 - w0 / 2, -len * 0.5, tipX - w1 / 2, tipY); ctx.lineTo(tipX + w1 / 2, tipY); ctx.quadraticCurveTo(tipX * 0.3 + w0 / 2, -len * 0.5, w0 / 2, 0); ctx.closePath();
  ctx.fillStyle = lgr(ctx, -w0, 0, w0, 0, [[0, COL.bambooL], [0.45, COL.bamboo], [1, COL.bambooD]]); ctx.fill();
  ctx.strokeStyle = 'rgba(70,45,15,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
  // nodes
  ctx.strokeStyle = COL.bambooD; ctx.lineWidth = Math.max(2, w0 * 0.18);
  for (let u = 0.08; u < 1; u += 0.13) { const px = tipX * 0.3 * 2 * u * (1 - u) + tipX * u * u, py = -len * u, ww = lerp(w0, w1, u) * 0.6; ctx.beginPath(); ctx.moveTo(px - ww, py); ctx.lineTo(px + ww, py + 1); ctx.stroke(); }
  rimLine(ctx, () => { ctx.moveTo(-w0 * 0.4, 0); ctx.quadraticCurveTo(tipX * 0.3 - w0 * 0.4, -len * 0.5, tipX - w1 * 0.35, tipY); }, 'rgba(255,200,140,0.8)', Math.max(1.5, w0 * 0.2));
  // hanging goods
  const m = mapper(ctx);
  let tip = m(tipX, tipY);
  const hang = o.hang;
  if (hang) {
    const sw = (o.swing ?? 0) + Math.sin(t * 1.6 + (o.seed || 0)) * 0.08;
    ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(-ang + sw);
    const list = Array.isArray(hang) ? hang : [hang];
    if (list[0] === 'giantRoll' || list[0] === 'roll') {
      const sl = o.string ?? 140;
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, sl); ctx.stroke();
      if (list[0] === 'giantRoll') giantRoll(ctx, 0, sl + 96, o.rollS ?? 0.5, 0, { t, tie: true });
      else nemRoll(ctx, 0, sl + 40, o.rollS ?? 0.6, 0, { tie: true });
      tip = mapper(ctx)(0, sl + 60);
    } else {
      const n = list.length;
      for (let i = 0; i < n; i++) {
        const dx = (i - (n - 1) / 2) * 34, sl = 30 + (i % 2) * 34 + i * 6;
        ctx.strokeStyle = 'rgba(230,214,180,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx, sl); ctx.stroke();
        fruit(ctx, list[i], dx, sl + 40, o.itemS ?? 1, Math.sin(t * 1.3 + i) * 0.1);
      }
    }
    ctx.restore();
  }
  // hook at tip
  ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX + 4, tipY - 14); ctx.arc(tipX + 12, tipY - 14, 8, PI, 0.2 * PI); ctx.stroke();
  ctx.restore();
  return tip;
}

// ---- GHE (trader boat with cây bẹo)
function ghe(ctx, x, y, s = 1, o = {}) {
  const part = o.part || 'all', Lh = 760, gun = 100, st = 132, bw = 168, dep = 26, deck = -55;
  const base = o.hull || COL.wood, paint = o.paint || COL.paintBlue;
  const items = o.items || [ITEMS[(o.seed || 0) % 6], ITEMS[((o.seed || 0) + 2) % 6]];
  ctx.save(); boatXform(ctx, x, y, s, o);
  const m = mapper(ctx), ret = { deck: m(0, deck), gunwale: m(0, -gun), bow: m(Lh / 2, -bw), stern: m(-Lh / 2, -st), len: Lh * BK * s };
  if (part !== 'front') {
    innerGunwale(ctx, Lh, gun, st, bw, base);
    // cabin (mui): arched thatch roof on posts
    const c0 = -360, c1 = -90, top = -300;
    // plank walls + doorway with warm lamp-lit interior
    const wy0 = -200, wy1 = -40, wx0 = c0 + 6, wx1 = c1 - 6;
    ctx.fillStyle = lgr(ctx, 0, wy0, 0, wy1, [[0, shadeC(base, -0.55)], [1, shadeC(base, -0.25)]]); ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.strokeStyle = 'rgba(20,12,8,0.45)'; ctx.lineWidth = 2;
    for (let yy = wy0 + 22; yy < wy1; yy += 22) { ctx.beginPath(); ctx.moveTo(wx0, yy); ctx.lineTo(wx1, yy); ctx.stroke(); }
    const dx0 = c0 + 70, dw = 78;
    ctx.fillStyle = '#1a100c'; ctx.fillRect(dx0, -178, dw, 138);
    ctx.fillStyle = rgr(ctx, dx0 + dw / 2, -120, 0, dx0 + dw / 2, -120, 70, [[0, 'rgba(255,170,90,0.55)'], [1, 'rgba(255,140,70,0)']]); ctx.fillRect(dx0, -178, dw, 138);
    ctx.fillStyle = shadeC(base, -0.2); ctx.fillRect(dx0 + dw + 40, -165, 60, 40); ctx.fillStyle = 'rgba(255,190,120,0.35)'; ctx.fillRect(dx0 + dw + 46, -160, 48, 30); // window
    ctx.fillStyle = 'rgba(255,190,130,0.35)'; ctx.fillRect(wx1 - 6, wy0, 6, wy1 - wy0); // rim on sun side
    // thatched arched roof (mui), solid canopy
    ctx.beginPath(); ctx.moveTo(c0 - 18, -186); ctx.quadraticCurveTo(c0 - 8, top, (c0 + c1) / 2, top); ctx.quadraticCurveTo(c1 + 8, top, c1 + 18, -186);
    ctx.quadraticCurveTo((c0 + c1) / 2, -168, c0 - 18, -186); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, top, 0, -170, [[0, '#c29a62'], [0.45, '#8a6640'], [1, '#4a3420']]); ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(40,25,10,0.35)'; ctx.lineWidth = 2; for (let xx = c0 - 14; xx < c1 + 18; xx += 12) { ctx.beginPath(); ctx.moveTo(xx, top - 4); ctx.lineTo(xx + 5, -166); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(60,38,18,0.55)'; ctx.lineWidth = 3; for (const yy of [top + 30, top + 62]) { ctx.beginPath(); ctx.moveTo(c0 - 20, yy + 40); ctx.quadraticCurveTo((c0 + c1) / 2, yy - 40, c1 + 20, yy + 40); ctx.stroke(); } ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(wx0, -184, wx1 - wx0, 12); // roof shadow on walls
    rimLine(ctx, () => { ctx.moveTo(c0 - 16, -188); ctx.quadraticCurveTo(c0 - 6, top - 2, (c0 + c1) / 2, top - 2); ctx.quadraticCurveTo(c1 + 6, top - 2, c1 + 16, -188); }, 'rgba(255,200,140,0.9)', 4);
    // laundry / hammock line hint
    ctx.strokeStyle = 'rgba(60,40,30,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c1 + 10, -200); ctx.quadraticCurveTo(c1 + 70, -186, c1 + 130, -205); ctx.stroke();
    ctx.fillStyle = ['#d65a4a', '#e8c24a', '#4a8ad6'][(o.seed || 0) % 3]; ctx.fillRect(c1 + 40, -196, 18, 26);
    // cây bẹo
    if (o.pole !== false) ret.beoTip = beoPole(ctx, 250, deck, 1 / BK, { len: o.poleLen ?? 1850, angle: o.poleAngle ?? 0.03, hang: items, t: o.t, seed: o.seed, itemS: 1.15, w: 26 });
    // cargo
    if (o.cargo !== false) cargoPile(ctx, 60, -88, 180, items, (o.seed || 0) + 5, 1);
    if (o.people) vendor(ctx, -40, deck, 1 / BK, { seed: o.seed || 0, t: o.t, raise: 0 });
  }
  if (part !== 'back') {
    hullSide(ctx, { Lh, gun, st, bw, dep, base, paint, trim: '#e8d8b0', eye: { panel: COL.paintRed } });
    // painted name plate
    ctx.fillStyle = 'rgba(240,226,190,0.8)'; ctx.fillRect(-250, -84, 90, 18); ctx.fillStyle = 'rgba(40,30,30,0.7)'; ctx.fillRect(-243, -79, 76, 3); ctx.fillRect(-243, -72, 50, 3);
  }
  ctx.restore();
  return ret;
}

// ---- MOTOR BOAT (ghe máy, long-tail)
function motorBoat(ctx, x, y, s = 1, o = {}) {
  const part = o.part || 'all', Lh = 640, gun = 86, st = 110, bw = 140, dep = 24, deck = -46, t = o.t || 0;
  const base = o.hull || '#3f6f6a';
  ctx.save(); boatXform(ctx, x, y, s, o);
  const m = mapper(ctx), ret = { deck: m(0, deck), gunwale: m(0, -gun), bow: m(Lh / 2, -bw), stern: m(-Lh / 2, -st), exhaust: m(-300, -196), len: Lh * BK * s };
  if (part !== 'front') {
    innerGunwale(ctx, Lh, gun, st, bw, base);
    // cabin box with windows
    const c0 = -110, c1 = 90, top = -220;
    ctx.fillStyle = lgr(ctx, 0, top, 0, -80, [[0, '#cfc2a0'], [1, '#7a6a50']]); ctx.fillRect(c0, top + 14, c1 - c0, 140);
    ctx.fillStyle = 'rgba(30,40,55,0.85)'; for (let i = 0; i < 3; i++) ctx.fillRect(c0 + 18 + i * 62, top + 36, 42, 34);
    ctx.fillStyle = 'rgba(255,180,120,0.35)'; ctx.fillRect(c0 + 18, top + 36, 42, 12);
    ctx.fillStyle = COL.paintBlue; ctx.beginPath(); ctx.moveTo(c0 - 20, top + 16); ctx.lineTo(c1 + 24, top + 16); ctx.lineTo(c1 + 12, top); ctx.lineTo(c0 - 8, top); ctx.closePath(); ctx.fill();
    rimLine(ctx, () => { ctx.moveTo(c0 - 8, top); ctx.lineTo(c1 + 12, top); }, 'rgba(255,200,140,0.9)', 3);
    // engine on its pivot post + long tail
    ctx.fillStyle = '#4a4c52'; rrect(ctx, -330, -150, 62, 46, 8); ctx.fill(); ctx.fillStyle = '#2a2c30'; ctx.fillRect(-324, -112, 50, 10);
    ctx.fillStyle = '#7a7c82'; ctx.fillRect(-326, -146, 54, 6);
    ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-320, -110); ctx.lineTo(-470, 18); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-300, -150); ctx.lineTo(-300, -196); ctx.stroke(); // exhaust pipe
    ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-270, -130); ctx.lineTo(-200, -170); ctx.stroke(); // tiller
    rimLine(ctx, () => { ctx.moveTo(-330, -150); ctx.lineTo(-268, -150); }, 'rgba(255,200,140,0.8)', 2.5);
  }
  if (part !== 'back') {
    hullSide(ctx, { Lh, gun, st, bw, dep, base, paint: '#d8c890', trim: COL.paintRed, eye: { panel: '#b8402e' } });
    const sp = o.speed || 0;
    if (sp > 0) { // bow spray + prop wash
      splash(ctx, Lh * 0.42, 4, 0.5 * sp, 0.25 + ((t * 2) % 1) * 0.5, { seed: Math.floor(t * 2) });
      ctx.save(); ctx.globalAlpha = 0.7 * sp; ctx.fillStyle = 'rgba(255,240,226,0.8)';
      const r = rng(Math.floor(t * 15)); for (let i = 0; i < 18; i++) { ell(ctx, -470 - r() * 90, 14 - r() * 40, 6 + r() * 10, 3 + r() * 5); ctx.fill(); }
      ctx.restore();
    }
  }
  ctx.restore();
  if (o.smoke !== false && part !== 'back') puffs(ctx, ret.exhaust[0], ret.exhaust[1], s * BK, t, { dir: o.flip ? 1 : -1, n: 8 });
  return ret;
}
// small exhaust puffs (world-space)
function puffs(ctx, x, y, s, t, o = {}) {
  const r = rng(o.seed ?? 4), dir = o.dir ?? -1;
  ctx.save();
  for (let i = 0; i < (o.n ?? 8); i++) {
    const ph = r(), life = (t * 0.7 + ph) % 1, rad = (8 + life * 34) * s;
    const px = x + dir * life * 160 * s + Math.sin(t * 2 + i) * 6 * s, py = y - life * 90 * s;
    ctx.globalAlpha = (1 - life) * 0.5;
    ctx.fillStyle = rgr(ctx, px - rad * 0.3, py - rad * 0.3, 0, px, py, rad, [[0, '#d7b4a0'], [0.6, '#8a7a80'], [1, 'rgba(90,80,90,0)']]);
    ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- XUỒNG BA LÁ (tourist's rowing sampan)
function xuongBaLa(ctx, x, y, s = 1, o = {}) {
  const part = o.part || 'all', Lh = 440, gun = 54, st = 70, bw = 82, dep = 14, deck = -22;
  const base = o.hull || '#4a3020';
  ctx.save(); boatXform(ctx, x, y, s, o);
  const m = mapper(ctx), ret = { deck: m(0, deck), seat: m(40, -40), oarlock: m(-170, -84), bow: m(Lh / 2, -bw), stern: m(-Lh / 2, -st), len: Lh * BK * s, gunwale: m(0, -gun) };
  if (part !== 'front') {
    innerGunwale(ctx, Lh, gun, st, bw, base);
    ctx.fillStyle = '#8a6440'; ctx.fillRect(10, -44, 64, 8); // plank seat end
    ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-170, -50); ctx.lineTo(-170, -84); ctx.stroke(); // oarlock post
    if (o.people) {
      boatman(ctx, -150, deck, 1 / BK, { pose: 'row', phase: 0.3 });
      vendor(ctx, 60, deck, 1 / BK * 0.9, { seed: 7, sit: true });
    }
  }
  if (part !== 'back') hullSide(ctx, { Lh, gun, st, bw, dep, base, paint: null, trim: '#b89a6a', eye: null });
  ctx.restore();
  return ret;
}

// ---- CÔ ÚT'S NEM BOAT
function coUtBoat(ctx, x, y, s = 1, o = {}) {
  const part = o.part || 'all', Lh = 640, gun = 84, st = 112, bw = 146, dep = 24, deck = -42, t = o.t || 0;
  const base = o.hull || '#2f6f86';
  ctx.save(); boatXform(ctx, x, y, s, o);
  const m = mapper(ctx);
  const ret = { deck: m(0, deck), stool: m(-20, deck), herbs: m(235, -100), plates: m(-245, -96), bow: m(Lh / 2, -bw), stern: m(-Lh / 2, -st), gunwale: m(0, -gun), len: Lh * BK * s };
  if (part !== 'front') {
    innerGunwale(ctx, Lh, gun, st, bw, base);
    if (o.umbrella) {
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-290, deck); ctx.lineTo(-282, -330); ctx.stroke();
      ctx.save(); ctx.translate(-282, -330);
      for (let i = 0; i < 8; i++) { const a0 = PI + i / 8 * PI, a1 = PI + (i + 1) / 8 * PI; ctx.fillStyle = i % 2 ? '#e8e0d0' : '#c9443a'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(Math.cos(a0) * 170, Math.sin(a0) * 40 + 30); ctx.quadraticCurveTo(Math.cos((a0 + a1) / 2) * 180, Math.sin((a0 + a1) / 2) * 44 + 40, Math.cos(a1) * 170, Math.sin(a1) * 40 + 30); ctx.closePath(); ctx.fill(); }
      rimLine(ctx, () => { ctx.moveTo(-170, 30); ctx.quadraticCurveTo(0, -60, 170, 30); }, 'rgba(255,200,140,0.8)', 3);
      ctx.restore();
    }
    // crates
    ctx.fillStyle = '#6a4a30'; ctx.fillRect(20, -60, 84, 20); ctx.fillRect(-290, -86, 92, 46); ctx.fillRect(196, -88, 80, 48);
    ctx.strokeStyle = 'rgba(30,18,10,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(20, -60, 84, 20); ctx.strokeRect(-290, -86, 92, 46);
    // plates (stack w/ nem) + sauce bowls
    nemPlate(ctx, -245, -96, 0.15, { kind: 'nem', n: 4 });
    sauceBowl(ctx, -205, -94, 0.11, { fill: 0.8 });
    // herbs basket
    herbBasket(ctx, 236, -98, 0.26, { ry: 0.45 });
    // stove + grill
    const st0 = charcoalStove(ctx, 62, -58, 0.3, { glow: o.glow ?? 1, flare: o.flare || 0, t, grill: true, skewers: o.skewers ?? 5, cook: o.cook ?? 0.7, embers: o.embers ?? true });
    ret.stove = m(62, -58); ret.grill = st0.top; ret.skewers = st0.skewers;
  }
  if (part !== 'back') {
    hullSide(ctx, { Lh, gun, st, bw, dep, base, paint: '#d9c48a', trim: '#c9443a', eye: { panel: '#c9443a' } });
    // little hand-painted sign "NEM NƯỚNG"
    ctx.fillStyle = '#f2e6c8'; rrect(ctx, -170, -76, 150, 30, 4); ctx.fill();
    ctx.fillStyle = '#b8302a'; ctx.font = 'bold 19px BodySansBold'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NEM NƯỚNG', -95, -60);
  }
  ctx.restore();
  return ret;
}

// ================================================================================================ CHARACTERS
// ---- cartoon hand: wrist origin, fingers toward +x, ~100 long at s=1
function cHand(ctx, x, y, s, rot, o = {}) {
  const kind = o.kind || 'open', sk = o.skin || SKIN_U, fl = o.flip ? -1 : 1;
  at(ctx, x, y, rot, s, s * fl, () => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const g = lgr(ctx, 0, -34, 0, 34, [[0, sk[0]], [0.65, sk[1]], [1, sk[2] || sk[1]]]);
    const parts = [];
    const C = (x0, y0, x1, y1, w0, w1) => parts.push((c) => capPath(c, x0, y0, x1, y1, w0, w1));
    const R = (rx, ry, rw, rh, rr) => parts.push((c) => c.roundRect(rx, ry, rw, rh, rr));
    const palm = () => parts.push((c) => {
      c.moveTo(-6, -17); c.bezierCurveTo(14, -27, 44, -27, 56, -18); c.quadraticCurveTo(64, 0, 56, 20);
      c.bezierCurveTo(42, 27, 12, 26, -6, 16); c.closePath();
    });
    const curled = () => { for (let i = 0; i < 4; i++) R(40, -21 + i * 10.5 - (i === 3 ? 1 : 0), 27 - i * 2, 12.5, 6.2); };
    C(-22, 0, 4, 0, 27, 31); // wrist
    if (kind === 'open' || kind === 'wave' || kind === 'flat') {
      const sp = kind === 'wave' ? 1.35 : kind === 'flat' ? 0.25 : 1;
      [[-15, -0.36, 37], [-5, -0.12, 44], [5, 0.1, 41], [14.5, 0.33, 32]].forEach(([yy, a, Ln], i) => {
        C(50, yy, 50 + Math.cos(a * sp) * Ln, yy + Math.sin(a * sp) * Ln * (kind === 'flat' ? 0.4 : 1), 13.5 - i * 0.6, 11 - i * 0.6);
      });
      palm();
      if (kind === 'flat') C(12, -16, 44, -28, 15, 11); else C(10, -14, 32, -40, 15, 11.5);
    } else if (kind === 'point') {
      C(50, -14, 98, -18, 13.5, 11); palm(); for (let i = 1; i < 4; i++) R(42, -21 + i * 10.5, 24 - i * 2, 12, 6);
      C(18, -16, 48, -4, 14, 11);
    } else if (kind === 'pinch') {
      palm(); for (let i = 1; i < 4; i++) R(42, -21 + i * 10.5, 25 - i * 2, 12, 6);
      C(50, -14, 78, -27, 13, 10.5); C(12, -16, 74, -33, 15, 10.5);
    } else if (kind === 'thumb') {
      palm(); curled(); C(24, -16, 26, -60, 17, 13.5);
    } else { // grip / fist
      palm(); curled();
      if (kind === 'grip') C(20, -20, 56, -24, 15, 11.5); else C(18, -18, 52, -10, 15, 11.5);
    }
    for (const p of parts) { ctx.beginPath(); p(ctx); ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.stroke(); ctx.fillStyle = g; ctx.fill(); }
    ctx.strokeStyle = 'rgba(110,50,35,0.32)'; ctx.lineWidth = 1.8;
    if (kind === 'grip' || kind === 'fist' || kind === 'thumb') {
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(46, -15 + i * 10.5); ctx.lineTo(52, -14.5 + i * 10.5); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,236,222,0.7)';
    if (kind === 'thumb') { ctx.beginPath(); ctx.ellipse(26, -57, 5, 4, 0, 0, TAU); ctx.fill(); }
    if (kind === 'point') { ctx.beginPath(); ctx.ellipse(94, -19, 4, 3.5, 0, 0, TAU); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,130,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.bezierCurveTo(14, -25, 40, -25, 54, -17); ctx.stroke(); ctx.restore();
  });
}

// arm: shoulder -> elbow -> wrist. o: {wu:[w0,w1], wf:[w0,w1], skin, sleeve(fill), sleeveTo (0 none .. 1 elbow .. 2 wrist), cuff}
function cArm(ctx, sx, sy, ex, ey, wx, wy, o) {
  const sk = o.skin, wu = o.wu, wf = o.wf, st = o.sleeveTo || 0;
  capFS(ctx, ex, ey, wx, wy, wf[0], wf[1], sk[1]);
  capFS(ctx, sx, sy, ex, ey, wu[0], wu[1], sk[1]);
  ctx.save(); ctx.globalAlpha = 0.45; seg(ctx, lerp(ex, wx, 0.05), lerp(ey, wy, 0.05) - wf[0] * 0.15, lerp(ex, wx, 0.85), lerp(ey, wy, 0.85) - wf[1] * 0.15, wf[0] * 0.35, wf[1] * 0.3, sk[0]); ctx.restore();
  if (st > 0) {
    const fill = o.sleeve, k = Math.min(st, 1), ux = lerp(sx, ex, k), uy = lerp(sy, ey, k);
    capFS(ctx, sx, sy, ux, uy, wu[0] * 1.32, wu[1] * 1.3 + (st <= 1 ? 2 : 0), fill);
    if (st > 1) {
      const fx = lerp(ex, wx, st - 1), fy = lerp(ey, wy, st - 1);
      capFS(ctx, ex, ey, fx, fy, wu[1] * 1.3, wf[1] * 1.45, fill);
      ctx.beginPath(); capPath(ctx, ex, ey, ex, ey + 0.01, wu[1] * 1.3, wu[1] * 1.3); ctx.fillStyle = fill; ctx.fill();
      if (o.cuff) { ctx.save(); ctx.globalAlpha = 0.45; seg(ctx, lerp(ex, fx, 0.88), lerp(ey, fy, 0.88), fx, fy, wf[1] * 1.45, wf[1] * 1.45, o.cuff); ctx.restore(); }
    } else {
      const a = Math.atan2(uy - sy, ux - sx), nx = -Math.sin(a), ny = Math.cos(a), hw = wu[1] * 0.62;
      const hx2 = lerp(sx, ux, 0.84), hy2 = lerp(sy, uy, 0.84);
      ctx.strokeStyle = 'rgba(40,40,50,0.35)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx2 + nx * hw, hy2 + ny * hw); ctx.quadraticCurveTo(hx2 + Math.cos(a) * 2, hy2 + Math.sin(a) * 2, hx2 - nx * hw, hy2 - ny * hw); ctx.stroke();
    }
  }
}
function handRot(ex, ey, wx, wy, bias = 0) { return Math.atan2(wy - ey, wx - ex) + bias; }

// ---- fabric tiles: áo bà ba (earthy-pink cotton weave) and khăn rằn (black/white check)
let _weaveTile = null, _khanTile = null;
function weaveTile() {
  if (_weaveTile) return _weaveTile;
  const [c, x] = canvas(64, 64);
  x.fillStyle = COL.aoba; x.fillRect(0, 0, 64, 64);
  const r = rng(31);
  for (let i = 0; i < 64; i += 2) { x.fillStyle = `rgba(${i % 4 ? '255,220,205' : '110,50,45'},${0.06 + r() * 0.05})`; x.fillRect(0, i, 64, 1); x.fillRect(i, 0, 1, 64); }
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(255,235,220,${0.1 + r() * 0.12})`; x.fillRect(r() * 64, r() * 64, 1 + r() * 2, 1); }
  _weaveTile = c; return c;
}
function khanTile() {
  if (_khanTile) return _khanTile;
  const [c, x] = canvas(64, 64);
  x.fillStyle = COL.khan; x.fillRect(0, 0, 64, 64);
  x.fillStyle = COL.khanW;
  for (let yy = 0; yy < 64; yy += 8) for (let xx = 0; xx < 64; xx += 8) if (((xx + yy) / 8) % 2 === 0 && !(xx % 32 >= 24 || yy % 32 >= 24)) x.fillRect(xx + 1, yy + 1, 6, 6);
  x.fillStyle = 'rgba(236,230,220,0.85)'; for (let i = 26; i < 64; i += 32) { x.fillRect(i, 0, 2, 64); x.fillRect(0, i, 64, 2); }
  _khanTile = c; return c;
}
function tilePattern(ctx, tile, unit) {
  const p = ctx.createPattern(tile, 'repeat');
  try { p.setTransform(new DOMMatrix().scale(unit / 64)); } catch (e) { /* unscaled */ }
  return p;
}
const weave = (ctx, unit = 30) => tilePattern(ctx, weaveTile(), unit);
const khanRan = (ctx, unit = 24) => tilePattern(ctx, khanTile(), unit);

// ---- nón lá (conical hat), face units (head ≈ 300 wide). part 'back' | 'front'
function nonLa(ctx, part, o = {}) {
  const cy = o.cy ?? -168, R = o.R ?? 400, ry = o.ry ?? 62, ap = o.ap ?? -505, tl = o.tilt || 0;
  ctx.save(); ctx.rotate(tl);
  if (part === 'back') {
    ctx.beginPath(); ctx.moveTo(-R, cy); ctx.lineTo(0, ap); ctx.lineTo(R, cy); ctx.ellipse(0, cy, R, ry, 0, 0, PI, true); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#fff0c4'], [0.35, '#efd9a0'], [0.7, '#d9bb78'], [1, '#a98a50']]);
    ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.lineWidth = 5; ctx.stroke(); ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 1; i <= 9; i++) {
      const u = i / 10, ccy = lerp(cy, ap, u), rx = R * (1 - u), rr = ry * (1 - u);
      ctx.strokeStyle = `rgba(140,100,50,${0.22 + 0.1 * (i % 2)})`; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.ellipse(0, ccy, rx, rr, 0, PI, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,248,215,0.35)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, ccy - 3, rx, rr, 0, PI * 1.05, PI * 1.6); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(130,95,45,0.18)'; ctx.lineWidth = 2;
    for (let i = -7; i <= 7; i++) { ctx.beginPath(); ctx.moveTo(0, ap); ctx.lineTo(i * R / 7, cy - ry * Math.sqrt(1 - (i / 7) ** 2)); ctx.stroke(); }
    // backlit translucency (sun behind): glowing upper-left, teal shade right
    ctx.fillStyle = rgr(ctx, -R * 0.35, cy - 120, 10, -R * 0.35, cy - 120, R * 0.7, [[0, 'rgba(255,214,150,0.5)'], [1, 'rgba(255,214,150,0)']]); ctx.fillRect(-R, ap, R * 2, cy - ap);
    ctx.fillStyle = lgr(ctx, R * 0.2, 0, R, 0, [[0, 'rgba(30,60,70,0)'], [1, 'rgba(30,60,70,0.28)']]); ctx.fillRect(-R, ap, R * 2, cy - ap);
    ctx.restore();
    rimLine(ctx, () => { ctx.moveTo(-R + 6, cy - 4); ctx.lineTo(0, ap + 6); }, 'rgba(255,210,150,0.9)', 7);
    ctx.beginPath(); ctx.ellipse(0, cy, R, ry, 0, 0, TAU);
    ctx.fillStyle = rgr(ctx, 0, cy - ry * 0.3, 10, 0, cy, R, [[0, '#5e4122'], [0.45, '#8a6a3a'], [1, '#c9a764']]); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(70,45,20,0.35)'; ctx.lineWidth = 2.4;
    for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.ellipse(0, cy - ry * 0.35 * (i / 7), R * (i / 7), ry * (i / 7), 0, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.beginPath(); ctx.moveTo(0, cy - ry * 0.4); ctx.lineTo(Math.cos(a) * R, cy + Math.sin(a) * ry); ctx.stroke(); }
    ctx.restore();
  } else {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(80,52,24,0.7)'; ctx.lineWidth = 15; ctx.beginPath(); ctx.ellipse(0, cy + 2, R, ry, 0, 0.02, PI - 0.02); ctx.stroke();
    ctx.strokeStyle = '#ead39a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, cy, R, ry, 0, 0.02, PI - 0.02); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,225,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, cy - 3, R, ry, 0, PI * 0.45, PI - 0.05); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,85,40,0.5)'; ctx.lineWidth = 2;
    for (let i = 1; i < 30; i++) { const a = i / 30 * PI, px = Math.cos(a) * R, py = cy + Math.sin(a) * ry; ctx.beginPath(); ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4); ctx.stroke(); }
  }
  ctx.restore();
}

// ---- khăn rằn scarf around a neck (in face units: neck base ≈ y 270, width ±110)
function scarfFace(ctx, t) {
  const sw = Math.sin(t * 2.3) * 6;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(-122, 238); ctx.quadraticCurveTo(0, 300, 122, 238); ctx.lineTo(128, 286); ctx.quadraticCurveTo(0, 352, -128, 286); ctx.closePath();
  outFill(ctx, khanRan(ctx, 70), 4);
  // knot + two tails on her left (screen right)
  ctx.beginPath(); ctx.moveTo(52, 300); ctx.quadraticCurveTo(84 + sw, 420, 70 + sw, 560); ctx.lineTo(128 + sw, 552); ctx.quadraticCurveTo(122 + sw * 0.6, 410, 96, 296); ctx.closePath();
  outFill(ctx, khanRan(ctx, 70), 4);
  ctx.beginPath(); ctx.moveTo(84, 304); ctx.quadraticCurveTo(140 + sw, 400, 156 + sw * 1.2, 500); ctx.lineTo(196 + sw * 1.2, 486); ctx.quadraticCurveTo(170 + sw, 380, 120, 296); ctx.closePath();
  outFill(ctx, khanRan(ctx, 70), 4);
  ell(ctx, 88, 304, 34, 26); outFill(ctx, khanRan(ctx, 70), 4);
  // fringe
  ctx.strokeStyle = 'rgba(236,230,220,0.8)'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const fx = lerp(72, 128, i / 5) + sw; ctx.beginPath(); ctx.moveTo(fx, 556 - i * 1.5); ctx.lineTo(fx - 2, 578); ctx.stroke(); }
  // shading + rim
  ctx.fillStyle = 'rgba(20,40,50,0.25)'; ctx.beginPath(); ctx.moveTo(-128, 286); ctx.quadraticCurveTo(0, 352, 128, 286); ctx.lineTo(122, 268); ctx.quadraticCurveTo(0, 330, -122, 268); ctx.fill();
  rimLine(ctx, () => { ctx.moveTo(-120, 240); ctx.quadraticCurveTo(-60, 272, 0, 280); }, 'rgba(255,200,140,0.7)', 5);
  ctx.restore();
}

// ---- CÔ ÚT face (close-up capable). origin between the eyes, head ≈ 290 wide, chin y≈196.
function coUtFace(ctx, x, y, s, o = {}) {
  const ex = o.expr || 'smile', t = o.t || 0, tn = clamp(o.turn || 0, -1, 1), tx = tn * 60;
  const autoBlink = ((t + 0.37) % 3.3) < 0.13 ? 1 : 0;
  const bl = o.blink ?? autoBlink;
  const lk = o.look || [0, 0];
  const S = SKIN_U;
  at(ctx, x, y, o.tilt || 0, s, s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const hat = o.hat !== false, hopt = { tilt: o.hatTilt || 0, ry: o.hatRy ?? 62, cy: -168 + Math.abs(o.hatTilt || 0) * 40 };
    if (hat) nonLa(ctx, 'back', hopt);
    // low bun
    if (Math.abs(tn) > 0.12) { ell(ctx, -tn * 150, 140, 58, 52); ctx.fillStyle = COL.hair; ctx.fill(); rimLine(ctx, () => ctx.arc(-tn * 150, 140, 56, PI * 1.05, PI * 1.5), 'rgba(255,190,120,0.5)', 4); }
    if (o.body !== false) {
      ctx.beginPath(); ctx.moveTo(-330, 600); ctx.quadraticCurveTo(-300, 300, -110, 262); ctx.lineTo(110, 262); ctx.quadraticCurveTo(300, 300, 330, 600); ctx.closePath();
      outFill(ctx, weave(ctx, 110), 5);
      ctx.save(); ctx.clip();
      ctx.fillStyle = lgr(ctx, -330, 0, 330, 0, [[0, 'rgba(255,190,120,0.28)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(20,50,60,0.35)']]); ctx.fillRect(-340, 250, 680, 360);
      ctx.strokeStyle = 'rgba(90,35,30,0.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(18, 275); ctx.lineTo(18, 600); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(32, 360 + i * 90, 9, 0, TAU); ctx.fillStyle = '#f3e6dc'; ctx.fill(); ctx.strokeStyle = 'rgba(90,40,35,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
      rimLine(ctx, () => { ctx.moveTo(-326, 590); ctx.quadraticCurveTo(-296, 300, -110, 264); }, 'rgba(255,196,130,0.75)', 6);
    }
    // neck
    ctx.beginPath(); ctx.moveTo(-58 + tx * 0.3, 130); ctx.lineTo(-64, 278); ctx.quadraticCurveTo(0, 304, 64, 278); ctx.lineTo(58 + tx * 0.3, 130); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -60, 0, 60, 0, [[0, S[1]], [1, S[2]]]); ctx.fill();
    ctx.fillStyle = 'rgba(70,30,20,0.25)'; ell(ctx, tx * 0.3, 175, 60, 26); ctx.fill();
    ctx.strokeStyle = COL.aobaD; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-98, 266); ctx.quadraticCurveTo(0, 318, 98, 266); ctx.stroke();
    ctx.strokeStyle = COL.aobaL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-94, 260); ctx.quadraticCurveTo(0, 310, 94, 260); ctx.stroke();
    if (o.body !== false && o.scarf !== false) scarfFace(ctx, t);
    // ears + small gold earrings
    for (const sx of [-1, 1]) {
      const exr = sx * (142 + sx * tx * -0.25) - tx * 0.2;
      ell(ctx, exr, 22, 24 * (1 + sx * tn * 0.6), 42); ctx.fillStyle = S[1]; ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,40,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(exr, 22, 16, sx > 0 ? -1.2 : 1.9, sx > 0 ? 1.2 : 4.3); ctx.stroke();
      const sw = Math.sin(t * 5 + sx) * 0.15;
      ctx.save(); ctx.translate(exr, 62); ctx.rotate(sw);
      ctx.fillStyle = '#e7b53a'; ctx.beginPath(); ctx.arc(0, 10, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(-3, 7, 2.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // head shape
    const head = new Path2D();
    head.moveTo(tx * 0.4, 196);
    head.bezierCurveTo(80 + tx * 0.5, 196, 140 + tx * 0.1, 130, 146 + tx * 0.1 - tn * 28, 20);
    head.bezierCurveTo(156, -100, 112, -210, tx * 0.2, -215);
    head.bezierCurveTo(-112, -210, -156, -100, -146 + tx * 0.1 - tn * 28, 20);
    head.bezierCurveTo(-140 + tx * 0.1, 130, -80 + tx * 0.5, 196, tx * 0.4, 196);
    ctx.fillStyle = rgr(ctx, -40 + tx, -30, 20, 0, 20, 230, [[0, S[0]], [0.72, S[1]], [1, S[2]]]);
    ctx.strokeStyle = 'rgba(90,40,30,0.45)'; ctx.lineWidth = 4; ctx.stroke(head); ctx.fill(head);
    ctx.save(); ctx.clip(head);
    const bls = ex === 'laugh' ? 0.42 : 0.3;
    for (const sx of [-1, 1]) { ctx.save(); ctx.translate(sx * 90 + tx, 78); ctx.scale(1, 0.66); const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 62); bg.addColorStop(0, `rgba(232,100,90,${bls})`); bg.addColorStop(0.55, `rgba(232,100,90,${bls * 0.75})`); bg.addColorStop(1, 'rgba(232,100,90,0)'); ctx.fillStyle = bg; ctx.fillRect(-62, -62, 124, 124); ctx.restore(); }
    ctx.fillStyle = lgr(ctx, -160, 0, 160, 0, [[0, 'rgba(0,0,0,0)'], [0.66, 'rgba(0,0,0,0)'], [1, 'rgba(25,55,65,0.34)']]); ctx.fillRect(-200, -250, 400, 500);
    ctx.fillStyle = lgr(ctx, -160, 0, -96, 0, [[0, 'rgba(255,190,110,0.65)'], [1, 'rgba(255,190,110,0)']]); ctx.fillRect(-200, -250, 110, 500);
    ctx.restore();
    // eyes
    const happy = ex === 'smile' || ex === 'talk';
    for (const sx of [-1, 1]) {
      const exx = sx * 62 + tx * (sx === 1 ? 1.15 : 0.85), w = 46 * (1 + sx * tn * 0.45);
      const closed = ex === 'laugh' || (ex === 'wink' && sx === 1) || bl > 0.5;
      ctx.save(); ctx.translate(exx, 0);
      if (closed) {
        ctx.strokeStyle = '#2a1712'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(-w * 0.85, 8); ctx.quadraticCurveTo(0, ex === 'laugh' || ex === 'wink' ? -22 : 6, w * 0.85, 8); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx * w * 0.85, 8); ctx.lineTo(sx * (w + 8), 0); ctx.stroke();
      } else {
        const oh = happy ? 15 : 20;
        const ep = new Path2D(); ep.moveTo(-w, 4); ep.quadraticCurveTo(-w * 0.2, -oh * 1.5, w, 0); ep.quadraticCurveTo(w * 0.1, oh * (happy ? 0.55 : 1.1), -w, 4); ep.closePath();
        ctx.fillStyle = '#fbf3ea'; ctx.fill(ep);
        ctx.save(); ctx.clip(ep);
        const ix = lk[0] * 12 + tn * 6, iy = lk[1] * 6 - 2;
        ctx.beginPath(); ctx.arc(ix, iy, 17, 0, TAU); ctx.fillStyle = rgr(ctx, ix, iy - 4, 2, ix, iy, 17, [[0, '#6a3a22'], [0.7, '#3a1d12'], [1, '#1e0e09']]); ctx.fill();
        ctx.beginPath(); ctx.arc(ix, iy, 8, 0, TAU); ctx.fillStyle = '#0b0605'; ctx.fill();
        ctx.beginPath(); ctx.arc(ix - 6, iy - 6, 5, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.arc(ix + 6, iy + 5, 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(90,40,30,0.25)'; ctx.fillRect(-w, -30, w * 2, 12);
        ctx.restore();
        ctx.strokeStyle = '#21110c'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-w - 2, 5); ctx.quadraticCurveTo(-w * 0.2, -oh * 1.5 - 1, w + 4, -1); ctx.stroke();
        ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(sx * w, -2 * (sx > 0 ? 1 : -0.5)); ctx.lineTo(sx * (w + 11), -11); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx * w * 0.6, -oh * 1.05); ctx.lineTo(sx * (w * 0.7 + 4), -oh * 1.05 - 9); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,60,40,0.45)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-w * 0.7, oh * 0.5 + 4); ctx.quadraticCurveTo(0, oh * 0.9 + 6, w * 0.8, oh * 0.4 + 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(120,60,40,0.3)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w * 0.7, -oh - 2); ctx.quadraticCurveTo(0, -oh * 1.9, w * 0.8, -oh * 0.9); ctx.stroke();
      }
      ctx.restore();
    }
    // brows
    const br = ex === 'laugh' ? 1 : ex === 'wink' ? 0.4 : ex === 'calm' ? 0 : 0.2;
    ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 8;
    for (const sx of [-1, 1]) {
      const bx = sx * 62 + tx * (sx === 1 ? 1.15 : 0.85), by = -58 - br * 14 + (ex === 'wink' && sx === 1 ? 10 : 0);
      ctx.beginPath(); ctx.moveTo(bx - 40 * sx, by + 8); ctx.quadraticCurveTo(bx + 2 * sx, by - 12, bx + 42 * sx, by + 4); ctx.stroke();
    }
    // nose
    const nx = tx * 1.2;
    ctx.strokeStyle = 'rgba(140,65,45,0.5)'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(nx + 12, 18); ctx.quadraticCurveTo(nx + 26, 58, nx + 20, 78); ctx.stroke();
    ctx.fillStyle = 'rgba(110,45,35,0.55)'; ell(ctx, nx - 13, 86, 7, 4); ctx.fill(); ell(ctx, nx + 13, 86, 7, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,236,220,0.6)'; ell(ctx, nx - 6, 66, 8, 5); ctx.fill();
    // mouth
    const mx = tx * 1.05, my = 128, lip = '#c0564c', dark = '#4a1612';
    const talk = ex === 'talk' ? 0.4 + 0.6 * Math.abs(Math.sin(t * 9)) : (o.talk || 0);
    if (ex === 'laugh' || talk > 0.05) {
      const op = ex === 'laugh' ? 1 + 0.12 * Math.sin(t * 22) : talk * 0.7;
      const mp = new Path2D(); mp.moveTo(mx - 64, my - 10); mp.quadraticCurveTo(mx, my - 2, mx + 64, my - 10); mp.quadraticCurveTo(mx + 40, my + 30 + 30 * op, mx, my + 34 + 30 * op); mp.quadraticCurveTo(mx - 40, my + 30 + 30 * op, mx - 64, my - 10); mp.closePath();
      ctx.fillStyle = dark; ctx.fill(mp);
      ctx.save(); ctx.clip(mp);
      ctx.fillStyle = '#fbf6ee'; ctx.fillRect(mx - 64, my - 14, 128, 20);
      ell(ctx, mx, my + 34 + 30 * op, 36, 20); ctx.fillStyle = '#d4605a'; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = lip; ctx.lineWidth = 6; ctx.stroke(mp);
    } else if (ex === 'wink') {
      ctx.strokeStyle = lip; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(mx - 52, my - 2); ctx.quadraticCurveTo(mx, my + 26, mx + 58, my - 20); ctx.stroke();
    } else {
      const mw = ex === 'calm' ? 44 : 60;
      ctx.beginPath(); ctx.moveTo(mx - mw, my - 8); ctx.quadraticCurveTo(mx, my + mw * 0.55, mx + mw, my - 8); ctx.quadraticCurveTo(mx, my + 10, mx - mw, my - 8);
      ctx.fillStyle = lip; ctx.fill();
      ctx.strokeStyle = '#7a2a22'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(mx - mw, my - 8); ctx.quadraticCurveTo(mx, my + mw * 0.3, mx + mw, my - 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,210,0.5)'; ell(ctx, mx, my + mw * 0.33, 14, 4); ctx.fill();
    }
    // hair: centre part, glossy black, swept back
    const hairP = new Path2D();
    hairP.moveTo(-150 + tx * 0.1, 30); hairP.bezierCurveTo(-170, -120, -100, -228, tx * 0.2, -226); hairP.bezierCurveTo(100, -228, 170, -120, 150 + tx * 0.1, 30);
    hairP.lineTo(136, 0); hairP.bezierCurveTo(130, -80, 90, -130, 8 + tx * 0.4, -142); hairP.bezierCurveTo(-90, -130, -130, -80, -136, 0); hairP.closePath();
    ctx.fillStyle = lgr(ctx, 0, -230, 0, 20, [[0, '#2e2622'], [0.6, '#1c1513'], [1, '#120d0c']]); ctx.fill(hairP);
    ctx.save(); ctx.clip(hairP);
    ctx.strokeStyle = 'rgba(120,90,80,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) { const sx = i < 5 ? -1 : 1, kk = i % 5; ctx.beginPath(); ctx.moveTo(sx * (20 + kk * 22), -150 + kk * 10); ctx.quadraticCurveTo(sx * (110 + kk * 6), -110 + kk * 10, sx * (138 + kk * 2), -10 + kk * 8); ctx.stroke(); }
    ctx.globalCompositeOperation = 'screen'; ctx.beginPath(); ctx.arc(tx * 0.2, -10, 160, PI * 1.08, PI * 1.38);
    for (const [lw, al] of [[16, 0.12], [10, 0.16], [5, 0.24]]) { ctx.strokeStyle = `rgba(255,190,120,${al})`; ctx.lineWidth = lw; ctx.stroke(); }
    ctx.restore();
    if (hat) {
      ctx.save(); ctx.clip(head);
      ctx.fillStyle = lgr(ctx, 0, -150, 0, -40, [[0, 'rgba(60,25,15,0.55)'], [1, 'rgba(60,25,15,0)']]); ctx.fillRect(-200, -240, 400, 200);
      ctx.restore();
      nonLa(ctx, 'front', hopt);
      // quai nón: deep-pink satin strap
      ctx.strokeStyle = 'rgba(196,58,92,0.9)'; ctx.lineWidth = 5.5;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 150, -110); ctx.bezierCurveTo(sx * 162, 20, sx * 120, 170, tx * 0.4 + sx * 10, 204); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,170,190,0.5)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-148, -100); ctx.bezierCurveTo(-160, 20, -118, 166, tx * 0.4 - 10, 200); ctx.stroke();
    }
  });
}

// ---- CÔ ÚT full body. Internally authored in coBa units ×U (shoulders ±44, eyes −342 standing).
const U_CO = 1.26;
function coUt(ctx, x, y, s, o = {}) {
  const pose = o.pose || 'stand', k = clamp(o.k ?? 0.5), t = o.t || 0, items = o.items !== false;
  const sit = (o.sit ?? (pose === 'stand' ? 0 : 1)) ? 1 : 0;
  const fl = o.flip ? -1 : 1, ret = {}, U = U_CO;
  const exprDef = { stand: 'smile', fan: 'calm', flip: 'smile', hook: 'smile', offer: 'smile', roll: 'calm', pole: 'smile', thumbs: 'wink', wave: 'smile', cheer: 'laugh' }[pose] || 'smile';
  const bob = pose === 'cheer' ? -Math.abs(Math.sin(t * TAU * 1.667)) * 5 : Math.sin(t * 2.2) * 1.5;
  at(ctx, x, y, 0, s * fl * U, s * U, () => {
    const M = mapper(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const B = bob + (sit ? 128 : 0), SY = -280 + B, hipY = -190 + B;
    const pantsG = lgr(ctx, -45, 0, 45, 0, [[0, '#3c3542'], [0.45, '#25202b'], [1, '#141118']]);
    ctx.fillStyle = 'rgba(30,15,20,0.3)'; ell(ctx, 0, 0, 72, 10); ctx.fill();
    const sandal = (sx, fx) => {
      ell(ctx, fx, -6, 20, 8); outFill(ctx, '#6b3d22');
      ctx.beginPath(); ctx.ellipse(fx, -10, 14, 6, 0, PI, TAU); ctx.fillStyle = SKIN_U[1]; ctx.fill();
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(fx - 10, -9); ctx.lineTo(fx, -15); ctx.lineTo(fx + 10, -9); ctx.stroke();
    };
    if (!sit) {
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sx * 2, hipY - 6); ctx.lineTo(sx * 42, hipY - 6); ctx.lineTo(sx * 44, -14); ctx.lineTo(sx * 4, -14); ctx.closePath();
        outFill(ctx, pantsG);
        ctx.strokeStyle = 'rgba(255,220,180,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx * 18, hipY + 40); ctx.lineTo(sx * 22, -20); ctx.stroke();
        sandal(sx, sx * 24);
      }
    } else {
      if (o.stool !== false) { // low wooden stool (ghế đẩu)
        ctx.strokeStyle = COL.woodD; ctx.lineWidth = 6;
        for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 26, hipY + 8); ctx.lineTo(sx * 34, -4); ctx.stroke(); }
        rrect(ctx, -38, hipY + 2, 76, 10, 3); outFill(ctx, COL.woodL, 2);
      }
      for (const sx of [-1, 1]) { capFS(ctx, sx * 44, hipY - 18, sx * 47, -16, 30, 27, pantsG); sandal(sx, sx * 48); }
    }
    // pose targets
    const shL = [-44, SY], shR = [44, SY];
    let hL = [-60, SY + 104], hR = [60, SY + 104], kL = 'flat', kR = 'flat', rL = PI / 2 + 0.2, rR = PI / 2 - 0.2;
    let tool = null, pre = null, post = null;
    const knee = sit ? [[-44, hipY - 18], [44, hipY - 18]] : null;
    if (sit) { hL = [-46, hipY - 30]; hR = [46, hipY - 30]; rL = PI / 2 + 0.5; rR = PI / 2 - 0.5; }
    const fanPh = o.fan ?? t * 1.667, fsn = Math.sin(fanPh * TAU);
    if (pose === 'wave') { hR = [78 + Math.sin(t * 9) * 10, SY - 70]; kR = 'wave'; rR = -PI / 2 + Math.sin(t * 9) * 0.25; }
    else if (pose === 'thumbs') { hR = [66, SY - 38 + Math.sin(t * 8) * 2]; kR = 'thumb'; rR = 0.15; }
    else if (pose === 'fan') {
      hR = [116 + fsn * 6, SY + 54 + Math.cos(fanPh * TAU) * 8]; kR = 'grip'; rR = -0.15 + fsn * 0.5;
      pre = () => { if (items) handFan(ctx, hR[0] + 4, hR[1] - 2, 0.42, rR + 0.05, { blur: Math.abs(Math.cos(fanPh * TAU)) * 0.6 }); };
      tool = () => M(hR[0] + Math.cos(rR) * 70, hR[1] + Math.sin(rR) * 70);
    } else if (pose === 'flip') {
      const lift = Math.sin(k * PI);
      hR = [110, SY + 44 - lift * 18]; kR = 'grip'; rR = 0.75 - lift * 0.25;
      let tip = null;
      pre = () => { if (items) tip = tongs(ctx, hR[0] + 6, hR[1], 0.3, rR, { open: 0.25 + 0.35 * (1 - lift) }); };
      tool = () => tip || M(hR[0] + 60, hR[1] + 50);
    } else if (pose === 'hook') {
      const e = ease.inOut(k);
      hL = [30, SY + 54]; kL = 'grip'; hR = [74, SY - 14 - e * 30]; kR = 'grip';
      const a = Math.atan2(hR[1] - hL[1], hR[0] - hL[0]), dx = Math.cos(a), dy = Math.sin(a), Lp = 300 + e * 320;
      rL = a; rR = a;
      const tx0 = hL[0] - dx * 50, ty0 = hL[1] - dy * 50, tx1 = hR[0] + dx * Lp, ty1 = hR[1] + dy * Lp;
      pre = () => {
        capFS(ctx, tx0, ty0, tx1, ty1, 9, 7, lgr(ctx, tx0, ty0 - 8, tx0, ty0 + 8, [[0, COL.bambooL], [0.5, COL.bamboo], [1, COL.bambooD]]), 1.6);
        ctx.strokeStyle = COL.bambooD; ctx.lineWidth = 2;
        for (let u = 0.15; u < 1; u += 0.17) { const px = lerp(tx0, tx1, u), py = lerp(ty0, ty1, u); ctx.beginPath(); ctx.moveTo(px - dy * 5, py + dx * 5); ctx.lineTo(px + dy * 5, py - dx * 5); ctx.stroke(); }
        ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(tx1, ty1); ctx.lineTo(tx1 + dx * 16, ty1 + dy * 16); ctx.arc(tx1 + dx * 16 + dy * 10, ty1 + dy * 16 - dx * 10, 10, a + PI / 2, a - PI / 2 + 0.6, true); ctx.stroke();
      };
      tool = () => M(tx1 + dx * 16, ty1 + dy * 16);
    } else if (pose === 'offer') {
      const e = ease.out(k);
      hR = [lerp(56, 150, e), lerp(SY + 86, SY + 30, e)]; hL = [lerp(6, 92, e), lerp(SY + 90, SY + 36, e)]; kL = kR = 'flat'; rL = -0.15; rR = -0.15;
      const px = (hL[0] + hR[0]) / 2, py = (hL[1] + hR[1]) / 2 - 10;
      post = () => { if (items) nemPlate(ctx, px, py, 0.34, { kind: o.plate || 'rolls', n: 3 }); };
      tool = () => M(px, py);
    } else if (pose === 'roll') {
      const ph = Math.sin(t * 6) * 4;
      hL = [-26 + ph, SY + 92]; hR = [26 + ph, SY + 94]; kL = kR = 'flat'; rL = 0.1; rR = PI - 0.1;
      pre = () => { if (items) nemRoll(ctx, ph, SY + 96, 0.24, Math.sin(t * 3) * 0.05, {}); };
      tool = () => M(ph, SY + 96);
    } else if (pose === 'pole') {
      const a = o.poleAngle ?? 0.9, d = [Math.sin(a), -Math.cos(a)], base = [24, SY + 118];
      hL = [base[0] + d[0] * 50, base[1] + d[1] * 50]; hR = [base[0] + d[0] * 150, base[1] + d[1] * 150]; kL = kR = 'grip';
      rL = rR = Math.atan2(d[1], d[0]);
      let tip = null;
      pre = () => { tip = beoPole(ctx, base[0], base[1], 1 / U, { len: o.poleLen ?? 1600, angle: a, bend: o.bend ?? 0.05, hang: o.hang ?? null, t, w: 20, rollS: o.rollS, swing: o.swing, string: o.string }); };
      tool = () => tip;
    } else if (pose === 'cheer') {
      hR = [62, SY - 96 + Math.sin(t * TAU * 1.667) * 6]; kR = 'grip'; rR = -PI / 2;
      hL = [-64, SY - 30]; kL = 'fist'; rL = -PI / 2 - 0.4;
      post = () => { if (items) nemRoll(ctx, hR[0] + 2, hR[1] - 36, 0.2, -PI / 2 + 0.1, {}); };
      tool = () => M(hR[0], hR[1] - 70);
    } else if (!sit) { hL = [-60, SY + 104]; hR = [60, SY + 104]; }
    if (o.reach) { hR = [o.reach[0] / U, o.reach[1] / U]; }
    const elL = ikPick(shL[0], shL[1], hL[0], hL[1], 66, 62, -1), elR = ikPick(shR[0], shR[1], hR[0], hR[1], 66, 62, 1);
    // torso: áo bà ba
    const hem = SY + (sit ? 108 : 134);
    const tor = new Path2D();
    tor.moveTo(-18, SY - 12); tor.quadraticCurveTo(-40, SY - 10, -50, SY + 4); tor.lineTo(-44, SY + 44); tor.quadraticCurveTo(-40, SY + 80, -48, hem);
    tor.quadraticCurveTo(-26, hem + 8, -6, hem + 4); tor.lineTo(6, hem + 4); tor.quadraticCurveTo(26, hem + 8, 48, hem);
    tor.quadraticCurveTo(40, SY + 80, 44, SY + 44); tor.lineTo(50, SY + 4); tor.quadraticCurveTo(40, SY - 10, 18, SY - 12); tor.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(tor); ctx.fillStyle = weave(ctx, 24); ctx.fill(tor);
    ctx.save(); ctx.clip(tor);
    ctx.fillStyle = lgr(ctx, -50, 0, 50, 0, [[0, 'rgba(255,190,120,0.3)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(20,50,60,0.38)']]); ctx.fillRect(-60, SY - 20, 120, 170);
    ctx.strokeStyle = 'rgba(90,35,30,0.5)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(4, SY - 4); ctx.lineTo(4, hem); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = '#f3e6dc'; ell(ctx, 8, SY + 14 + i * 24, 2.6, 2.6); ctx.fill(); }
    ctx.strokeStyle = 'rgba(90,35,30,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, hem - 26); ctx.lineTo(-44, hem); ctx.moveTo(40, hem - 26); ctx.lineTo(44, hem); ctx.stroke();
    // pocket
    ctx.strokeStyle = 'rgba(90,35,30,0.4)'; ctx.lineWidth = 1.6; ctx.strokeRect(-34, hem - 34, 22, 18);
    ctx.restore();
    rimLine(ctx, () => { ctx.moveTo(-18, SY - 12); ctx.quadraticCurveTo(-40, SY - 10, -50, SY + 4); ctx.lineTo(-44, SY + 44); }, 'rgba(255,200,140,0.8)', 2.4);
    if (sit) { // knees + thighs come forward over the tunic hem
      for (const sx of [-1, 1]) {
        capFS(ctx, sx * 16, hipY + 2, sx * 44, hipY - 18, 40, 36, pantsG);
        ell(ctx, sx * 44, hipY - 20, 18, 14); ctx.fillStyle = 'rgba(255,220,180,0.12)'; ctx.fill();
      }
    }
    // neck + collar + khăn rằn
    ctx.fillStyle = SKIN_U[1]; rrect(ctx, -11, SY - 24, 22, 18, 6); ctx.fill();
    ctx.strokeStyle = COL.aobaD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, SY - 10); ctx.quadraticCurveTo(0, SY, 18, SY - 10); ctx.stroke();
    if (o.scarf !== false) {
      const kh = khanRan(ctx, 12), sw = Math.sin(t * 2.3) * 2;
      ctx.beginPath(); ctx.moveTo(-24, SY - 14); ctx.quadraticCurveTo(0, SY - 2, 24, SY - 14); ctx.lineTo(25, SY - 4); ctx.quadraticCurveTo(0, SY + 9, -25, SY - 4); ctx.closePath(); outFill(ctx, kh, 1.6);
      ctx.beginPath(); ctx.moveTo(8, SY + 2); ctx.quadraticCurveTo(16 + sw, SY + 24, 12 + sw, SY + 46); ctx.lineTo(24 + sw, SY + 44); ctx.quadraticCurveTo(26 + sw, SY + 20, 18, SY); ctx.closePath(); outFill(ctx, kh, 1.6);
      ell(ctx, 13, SY + 2, 7, 5); outFill(ctx, kh, 1.4);
    }
    const armO = { skin: SKIN_U, wu: [19, 16], wf: [15, 12], sleeve: weave(ctx, 24), sleeveTo: 1.84, cuff: COL.aobaD };
    const doHand = (h, el, kind, rr, flipH) => cHand(ctx, h[0], h[1], 0.36, rr ?? handRot(el[0], el[1], h[0], h[1]), { kind, skin: SKIN_U, flip: flipH });
    if (pose === 'pole' && pre) { pre(); pre = null; }
    if (pose === 'hook' && pre) { pre(); pre = null; }
    cArm(ctx, shL[0], shL[1], elL[0], elL[1], hL[0], hL[1], armO);
    cArm(ctx, shR[0], shR[1], elR[0], elR[1], hR[0], hR[1], armO);
    if (pre) pre();
    doHand(hL, elL, kL, rL, kL !== 'flat' || pose === 'roll');
    doHand(hR, elR, kR, rR, pose === 'roll');
    if (post) post();
    // head
    const fy = -342 + B + (pose === 'cheer' ? -3 : 0);
    const ftilt = pose === 'cheer' ? -0.06 + Math.sin(t * TAU * 1.667) * 0.03 : (o.tilt || 0);
    coUtFace(ctx, 0, fy, 0.22, { expr: o.expr || exprDef, t, turn: o.turn ?? 0.3, body: false, tilt: ftilt, look: o.look || [0.4, pose === 'fan' || pose === 'flip' || pose === 'roll' ? 0.8 : 0], hatTilt: ftilt * 0.5 });
    ret.head = M(0, fy); ret.handL = M(hL[0], hL[1]); ret.handR = M(hR[0], hR[1]);
    ret.face = { x: ret.head[0], y: ret.head[1], s: 0.22 * s * U };
    ret.tool = tool ? tool() : ret.handR;
  });
  if (fl < 0) { const sw = ret.handL; ret.handL = ret.handR; ret.handR = sw; }
  return ret;
}

// ---- TOURIST close-up face (wraps people.js face)
const TFACE = {
  neutral: { mouth: 'neutral' },
  smile: { mouth: 'smile' },
  sniff: { open: 0.05, brow: 0.7, tilt: -0.12, mouth: 'smile', lookY: -1 },
  wow: { mouth: 'o', mOpen: 0.9, brow: 1, pupil: 1.3 },
  panic: { mouth: 'o', mOpen: 1, brow: 1.2, pupil: 0.6, hairLift: 0.8 },
  chew: { mouth: 'smile', happyClosed: 1, open: 0, blush: 0.7 },
  bliss: { open: 0, happyClosed: 1, mouth: 'smile', blush: 1 },
  yawn: { open: 0.1, mouth: 'o', mOpen: 1.4, brow: 0.5 },
};
function touristFaceOpts(expr, t = 0) {
  const f = Object.assign({}, TFACE[expr] || TFACE.smile);
  if (expr === 'chew') { const c = Math.abs(Math.sin(t * 8)); f.mouth = c > 0.5 ? 'grin' : 'smile'; f.mOpen = 0.15 + c * 0.25; }
  if (expr === 'panic') f.lookX = Math.sin(t * 23) * 0.5;
  if (expr === 'sniff') { f.tilt = -0.12 + Math.sin(t * 5) * 0.03; f.hairLift = 0.15; }
  return f;
}
function touristFace(ctx, x, y, s, o = {}) {
  const t = o.t || 0, fo = Object.assign({ t, glassesY: -178, blush: 0.4 }, touristFaceOpts(o.expr || 'smile', t), o);
  delete fo.expr;
  PEOPLE.face(ctx, x, y, s, fo);
  return { mouth: [x, y + 140 * s], eyes: [x, y] };
}

// ---- TOURIST full body (front view), internally tourist units ×UT (shoulders ±52, face −385 standing)
const UT = 1.2;
function tourist(ctx, x, y, s, o = {}) {
  const pose = o.pose || 'sit', k = clamp(o.k ?? 0.5), t = o.t || 0, fl = o.flip ? -1 : 1, ret = {};
  const SK = PEOPLE.SKIN, SHIRT = PEOPLE.SHIRT, SHIRT_D = '#1f6764', SHORTS = '#b59a6a', PACK = '#c46a2b';
  const standing = pose === 'split' || o.stand;
  const bob = pose === 'cheer' ? -Math.abs(Math.sin(t * TAU * 1.667)) * 5 : pose === 'split' ? Math.sin(t * 9) * 4 : Math.sin(t * 2.2) * 1.5;
  at(ctx, x, y, 0, s * fl * UT, s * UT, () => {
    const M = mapper(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // --- legs / hip height
    let B = bob + (standing ? 0 : 160), footL = [-26, 0], footR = [26, 0];
    if (pose === 'split') {
      footL = o.footL ? [o.footL[0] / UT, o.footL[1] / UT] : [-110, 0]; footR = o.footR ? [o.footR[0] / UT, o.footR[1] / UT] : [110, 0];
      const cx = (footL[0] + footR[0]) / 2, Lg = 196;
      let hy = -200;
      for (const [f, hx2] of [[footL, cx - 24], [footR, cx + 24]]) { const dx = f[0] - hx2; hy = Math.max(hy, f[1] - Math.sqrt(Math.max(0, Lg * Lg - dx * dx))); }
      B = hy + 200 + bob * 0.5;
      ctx.translate(cx, 0);
      footL[0] -= cx; footR[0] -= cx;
    }
    const hipY = -200 + B, SY = -326 + B, FY = -385 + B;
    const sneaker = (fx, fy) => {
      ell(ctx, fx, fy - 10, 26, 12); outFill(ctx, '#e9e6df');
      ctx.fillStyle = '#c9542e'; ctx.fillRect(fx - 20, fy - 6, 40, 4);
      ctx.fillStyle = '#ffffff'; rrect(ctx, fx - 10, fy - 30, 20, 12, 4); ctx.fill();
    };
    if (standing) ctx.fillStyle = 'rgba(30,15,20,0.3)', ell(ctx, 0, 0, 74, 11), ctx.fill();
    const legs = () => {
      if (standing) {
        for (const [sx, f] of [[-1, footL], [1, footR]]) {
          const hp = [sx * 24, hipY + 10], kn = ikPick(hp[0], hp[1], f[0], f[1] - 16, 100, 100, sx);
          capFS(ctx, kn[0], kn[1], f[0], f[1] - 18, 26, 21, SK[1]);
          ctx.save(); ctx.globalAlpha = 0.4; seg(ctx, kn[0] - 4, kn[1] + 8, f[0] - 4, f[1] - 30, 7, 5, SK[0]); ctx.restore();
          capFS(ctx, hp[0], hp[1] - 6, lerp(hp[0], kn[0], 0.8), lerp(hp[1], kn[1], 0.8), 46, 38, lgr(ctx, -50, 0, 50, 0, [[0, '#d2b886'], [0.5, SHORTS], [1, '#8a7246']]));
          sneaker(f[0], f[1]);
        }
      } else {
        // seated on the plank, knees up, feet forward on the deck
        for (const sx of [-1, 1]) {
          const kn = [sx * 42, hipY - 46], ft = [sx * 46, -2];
          capFS(ctx, kn[0], kn[1], ft[0], ft[1] - 18, 26, 21, SK[1]);
          ctx.save(); ctx.globalAlpha = 0.4; seg(ctx, kn[0] - 4, kn[1] + 6, ft[0] - 4, ft[1] - 30, 7, 5, SK[0]); ctx.restore();
          sneaker(ft[0], ft[1]);
        }
      }
    };
    const thighsFront = () => {
      if (standing) return;
      for (const sx of [-1, 1]) {
        capFS(ctx, sx * 20, hipY, sx * 42, hipY - 44, 48, 42, lgr(ctx, -50, 0, 50, 0, [[0, '#d2b886'], [0.5, SHORTS], [1, '#8a7246']]));
        ell(ctx, sx * 42, hipY - 48, 15, 12); ctx.fillStyle = SK[1]; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
      }
    };
    // --- pose targets
    const shL = [-52, SY], shR = [52, SY];
    let hL = [-66, SY + 120], hR = [66, SY + 120], kL = 'flat', kR = 'flat', rL = PI / 2 + 0.2, rR = PI / 2 - 0.2;
    if (!standing) { hL = [-44, hipY - 52]; hR = [44, hipY - 52]; rL = PI / 2 + 0.6; rR = PI / 2 - 0.6; }
    let faceO = { mouth: 'smile' }, held = null, heldFront = null, ftilt = 0;
    if (o.expr) faceO = touristFaceOpts(o.expr, t);
    const setF = (e) => { if (!o.expr) faceO = touristFaceOpts(e, t); };
    if (pose === 'yawn') {
      const st = Math.sin(t * 1.5) * 6;
      hL = [-78, SY - 118 + st]; hR = [78, SY - 118 + st]; kL = kR = 'fist'; rL = -PI / 2 - 0.3; rR = -PI / 2 + 0.3; setF('yawn'); ftilt = -0.08;
    } else if (pose === 'photo') {
      hL = [34, FY + 52]; hR = [92, FY + 48]; kL = kR = 'grip'; rL = -1.2; rR = -1.9; setF('smile'); faceO.turn = 0.3; faceO.lookX = 0.7;
      heldFront = () => { // phone
        at(ctx, 64, FY + 18, 0.06, 1, 1, () => {
          rrect(ctx, -22, -40, 44, 78, 7); outFill(ctx, '#1d1f24', 2);
          ctx.fillStyle = lgr(ctx, -18, -36, 18, 34, [[0, '#4a6a8a'], [1, '#22324a']]); rrect(ctx, -18, -35, 36, 68, 4); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-16, -33, 10, 64);
        });
      };
      ret.phone = () => M(64, FY + 18);
    } else if (pose === 'point') {
      hR = [148, SY - 28]; kR = 'point'; rR = -0.25; setF('wow'); faceO.turn = 0.35; faceO.lookX = 0.8; faceO.mOpen = 0.5;
    } else if (pose === 'sniff') {
      setF('sniff'); ftilt = -0.1;
    } else if (pose === 'rollBig') {
      const gs = o.rollS ?? 0.3;
      hL = [-62, SY + 66]; hR = [62, SY + 66]; kL = kR = 'grip'; rL = -0.3; rR = PI + 0.3; setF('wow');
      held = () => { if (o.rollFn) o.rollFn(ctx, 0, SY + 56, 0); else giantRoll(ctx, 0, SY + 56, gs, 0, { t }); };
      ret.roll = () => M(0, SY + 56);
    } else if (pose === 'bite') {
      const big = (o.roll || 'giant') === 'giant', ch = Math.abs(Math.sin(t * 8));
      hL = [-34, FY + 74]; hR = [big ? 120 : 64, FY + 70]; kL = kR = 'grip'; rL = -0.4; rR = PI + 0.5;
      setF('chew'); if (!o.expr) { faceO.mouth = ch > 0.4 ? 'o' : 'grin'; faceO.mOpen = 0.4 + ch * 0.4; }
      heldFront = () => { if (big) giantRoll(ctx, 50, FY + 34, o.rollS ?? 0.3, -0.12, { t, bite: o.bite ?? k }); else nemRoll(ctx, 22, FY + 34, 0.26, -0.15, { bite: o.bite ?? k }); };
    } else if (pose === 'hug') {
      hL = [26, SY + 34]; hR = [-26, SY + 46]; kL = kR = 'flat'; rL = -0.5; rR = PI + 0.5; setF('bliss'); ftilt = Math.sin(t * 2) * 0.05 - 0.06; // self-hug, hands crossed on chest
    } else if (pose === 'cheer') {
      hR = [70, SY - 124 + Math.sin(t * TAU * 1.667) * 6]; kR = 'grip'; rR = -PI / 2; hL = [-74, SY - 70]; kL = 'fist'; rL = -PI / 2 - 0.4;
      setF('smile'); if (!o.expr) { faceO.mouth = 'grin'; faceO.mOpen = 0.6; }
      held = () => nemRoll(ctx, hR[0] + 2, hR[1] - 40, 0.24, -PI / 2 + 0.08, {});
    } else if (pose === 'split') {
      const w1 = Math.sin(t * 11), w2 = Math.cos(t * 13);
      hL = [-128 + w1 * 14, SY - 50 + w2 * 30]; hR = [130 - w2 * 14, SY - 70 + w1 * 30]; kL = kR = 'open'; rL = PI + 0.6 + w1 * 0.4; rR = -0.6 + w2 * 0.4;
      setF('panic'); ftilt = Math.sin(t * 9) * 0.08;
    }
    if (o.look !== undefined) faceO.turn = o.look;
    const elL = ikPick(shL[0], shL[1], hL[0], hL[1], 80, 76, -1), elR = ikPick(shR[0], shR[1], hR[0], hR[1], 80, 76, 1);
    // --- draw
    ctx.save(); if (pose === 'split') { ctx.translate(0, hipY); ctx.rotate(ftilt * 0.6); ctx.translate(0, -hipY); }
    // backpack behind shoulders
    rrect(ctx, -60, SY - 8, 120, 128, 24); outFill(ctx, PACK, 2.6);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; rrect(ctx, -60, SY + 82, 120, 38, 16); ctx.fill();
    ctx.restore();
    legs();
    ctx.save(); if (pose === 'split') { ctx.translate(0, hipY); ctx.rotate(ftilt * 0.6); ctx.translate(0, -hipY); }
    // shorts (pelvis)
    const sh2 = new Path2D(); sh2.moveTo(-46, hipY - 6); sh2.lineTo(46, hipY - 6); sh2.lineTo(48, hipY + 22); sh2.quadraticCurveTo(0, hipY + 30, -48, hipY + 22); sh2.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke(sh2); ctx.fillStyle = lgr(ctx, -50, 0, 50, 0, [[0, '#d2b886'], [0.5, SHORTS], [1, '#8a7246']]); ctx.fill(sh2);
    // tee
    const tor = new Path2D(); tor.moveTo(-20, SY - 12); tor.quadraticCurveTo(-46, SY - 12, -58, SY + 4); tor.lineTo(-50, SY + 56); tor.lineTo(-50, hipY + 4); tor.quadraticCurveTo(0, hipY + 10, 50, hipY + 4); tor.lineTo(50, SY + 56); tor.lineTo(58, SY + 4); tor.quadraticCurveTo(46, SY - 12, 20, SY - 12); tor.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(tor); ctx.fillStyle = lgr(ctx, -58, 0, 58, 0, [[0, '#46b8ae'], [0.55, SHIRT], [1, SHIRT_D]]); ctx.fill(tor);
    // orange life vest
    for (const sx of [-1, 1]) {
      const vp = new Path2D();
      vp.moveTo(sx * 8, SY + 6); vp.lineTo(sx * 22, SY - 12); vp.quadraticCurveTo(sx * 40, SY - 14, sx * 46, SY + 2); vp.lineTo(sx * 54, SY + 40);
      vp.quadraticCurveTo(sx * 56, hipY - 30, sx * 52, hipY - 4); vp.quadraticCurveTo(sx * 30, hipY + 2, sx * 6, hipY - 4); vp.closePath();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(vp);
      ctx.fillStyle = lgr(ctx, -56, 0, 56, 0, [[0, '#ffa25a'], [0.5, COL.vest], [1, COL.vestD]]); ctx.fill(vp);
      ctx.save(); ctx.clip(vp);
      ctx.strokeStyle = 'rgba(140,50,10,0.35)'; ctx.lineWidth = 2; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx * 8, SY + 6 + i * 26); ctx.lineTo(sx * 56, SY + 4 + i * 26); ctx.stroke(); }
      ctx.fillStyle = 'rgba(230,236,240,0.85)'; ctx.fillRect(Math.min(sx * 30, sx * 46), SY + 10, 16, 6); // reflective tape
      ctx.restore();
    }
    // buckle straps
    for (const yy of [SY + 52, SY + 88]) { ctx.fillStyle = COL.vestStrap; ctx.fillRect(-50, yy, 100, 7); ctx.fillStyle = '#16161a'; rrect(ctx, -9, yy - 3, 18, 13, 3); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-7, yy - 1, 14, 2); }
    rimLine(ctx, () => { ctx.moveTo(-22, SY - 12); ctx.quadraticCurveTo(-40, SY - 14, -46, SY + 2); ctx.lineTo(-54, SY + 40); }, 'rgba(255,205,140,0.8)', 2.6);
    thighsFront();
    if (held && (pose === 'rollBig')) held();
    const armO = { skin: SK, wu: [24, 20], wf: [19, 15], sleeve: lgr(ctx, -60, 0, 60, 0, [[0, '#46b8ae'], [1, SHIRT_D]]), sleeveTo: 0.5 };
    cArm(ctx, shL[0], shL[1], elL[0], elL[1], hL[0], hL[1], armO);
    cArm(ctx, shR[0], shR[1], elR[0], elR[1], hR[0], hR[1], armO);
    if (held && pose === 'cheer') held();
    cHand(ctx, hL[0], hL[1], 0.4, rL ?? handRot(elL[0], elL[1], hL[0], hL[1]), { kind: kL, skin: SK, flip: kL === 'grip' || kL === 'pinch' || pose === 'hug' });
    cHand(ctx, hR[0], hR[1], 0.4, rR ?? handRot(elR[0], elR[1], hR[0], hR[1]), { kind: kR, skin: SK, flip: pose === 'rollBig' || pose === 'bite' || pose === 'hug' });
    // head
    const fo = Object.assign({ shirt: false, t, glassesY: lerp(-178, 0, clamp(o.glassK || 0)), blush: 0.4, tilt: ftilt }, faceO, o.face || {});
    PEOPLE.face(ctx, 0, FY, 0.18, fo);
    if (heldFront) heldFront();
    ret.head = M(0, FY); ret.mouth = M(0, FY + 140 * 0.18);
    ret.handL = M(hL[0], hL[1]); ret.handR = M(hR[0], hR[1]);
    ret.face = { x: ret.head[0], y: ret.head[1], s: 0.18 * s * UT };
    ctx.restore();
    ret.footL = M(footL[0], footL[1]); ret.footR = M(footR[0], footR[1]);
    if (ret.phone) ret.phone = ret.phone(); if (ret.roll) ret.roll = ret.roll();
  });
  if (fl < 0) { let sw = ret.handL; ret.handL = ret.handR; ret.handR = sw; sw = ret.footL; ret.footL = ret.footR; ret.footR = sw; }
  return ret;
}

// ---- small stylised head for boatman / vendors. (x,y) = head centre, r = radius. o: skin, hat 'nonla'|'bucket'|null,
//      hatCol, expr 'smile'|'laugh'|'calm', turn -1..1, hair, tilt
function miniHead(ctx, x, y, r, o = {}) {
  const sk = o.skin || COL.skinB, tn = o.turn || 0, ex = o.expr || 'smile', hat = o.hat === undefined ? 'nonla' : o.hat;
  at(ctx, x, y, o.tilt || 0, r / 40, r / 40, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (hat === 'nonla') {
      ctx.beginPath(); ctx.moveTo(-82, -18); ctx.lineTo(0, -82); ctx.lineTo(82, -18); ctx.ellipse(0, -18, 82, 12, 0, 0, PI, true); ctx.closePath();
      ctx.fillStyle = lgr(ctx, -82, 0, 82, 0, [[0, '#fbe6b4'], [0.5, '#e2c486'], [1, '#9a7c48']]); ctx.fill(); ctx.strokeStyle = 'rgba(90,60,30,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      rimLine(ctx, () => { ctx.moveTo(-80, -19); ctx.lineTo(0, -80); }, 'rgba(255,214,150,0.9)', 3);
    }
    // neck + head
    ctx.fillStyle = sk[2]; ctx.fillRect(-13, 26, 26, 22);
    ell(ctx, tn * 6, 0, 36, 40); ctx.fillStyle = rgr(ctx, -12 + tn * 10, -10, 4, 0, 4, 44, [[0, sk[0]], [0.7, sk[1]], [1, sk[2]]]); ctx.fill();
    ctx.strokeStyle = 'rgba(70,30,20,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ell(ctx, tn * 6, 0, 36, 40); ctx.clip();
    ctx.fillStyle = lgr(ctx, -36, 0, 36, 0, [[0, 'rgba(255,190,110,0.5)'], [0.25, 'rgba(255,190,110,0)'], [0.7, 'rgba(0,0,0,0)'], [1, 'rgba(25,55,65,0.35)']]); ctx.fillRect(-40, -44, 80, 88);
    // hair
    if (hat !== 'nonla' || true) { ctx.fillStyle = o.hair || COL.hair; ctx.beginPath(); ctx.ellipse(tn * 6, -26, 40, 22, 0, PI, TAU); ctx.fill(); }
    ctx.restore();
    // ears
    ctx.fillStyle = sk[1]; ell(ctx, -36 + tn * 4, 4, 6, 10); ctx.fill(); ell(ctx, 36 + tn * 8, 4, 6, 10); ctx.fill();
    // face
    const fx = tn * 14;
    ctx.fillStyle = '#1e120e';
    for (const sx of [-1, 1]) {
      if (ex === 'laugh') { ctx.strokeStyle = '#1e120e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx + sx * 13, 0, 6, PI * 1.1, PI * 1.9); ctx.stroke(); }
      else { ell(ctx, fx + sx * 13, -1, 3.6, ex === 'calm' ? 3.2 : 4.4); ctx.fill(); ctx.fillStyle = '#fff'; ell(ctx, fx + sx * 13 - 1.2, -2.4, 1.2, 1.2); ctx.fill(); ctx.fillStyle = '#1e120e'; }
      ctx.strokeStyle = 'rgba(30,18,12,0.8)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(fx + sx * 7, -11); ctx.quadraticCurveTo(fx + sx * 13, -14, fx + sx * 20, -11); ctx.stroke();
      ctx.fillStyle = 'rgba(230,100,90,0.25)'; ell(ctx, fx + sx * 21, 10, 7, 4); ctx.fill(); ctx.fillStyle = '#1e120e';
    }
    ctx.strokeStyle = 'rgba(120,55,40,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx + 2, 2); ctx.quadraticCurveTo(fx + 6, 10, fx + 1, 12); ctx.stroke();
    if (ex === 'laugh') { ctx.fillStyle = '#4a1612'; ctx.beginPath(); ctx.moveTo(fx - 11, 18); ctx.quadraticCurveTo(fx, 34, fx + 11, 18); ctx.closePath(); ctx.fill(); }
    else { ctx.strokeStyle = '#7a2a22'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(fx - 9, 19); ctx.quadraticCurveTo(fx, ex === 'calm' ? 22 : 26, fx + 9, 19); ctx.stroke(); }
    if (o.mustache) { ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(fx - 10, 16); ctx.quadraticCurveTo(fx, 12, fx + 10, 16); ctx.stroke(); }
    if (hat === 'nonla') { ctx.strokeStyle = '#ead39a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -18, 82, 12, 0, 0.05, PI - 0.05); ctx.stroke(); }
    else if (hat === 'bucket') {
      const hc = o.hatCol || COL.hatOlive;
      ctx.beginPath(); ctx.moveTo(-34, -22); ctx.quadraticCurveTo(-34, -56, 0, -58); ctx.quadraticCurveTo(34, -56, 34, -22); ctx.closePath(); outFill(ctx, lgr(ctx, -34, 0, 34, 0, [[0, shadeC(hc, 0.25)], [1, shadeC(hc, -0.35)]]), 2);
      ctx.beginPath(); ctx.ellipse(0, -20, 54, 11, 0, 0, TAU); outFill(ctx, shadeC(hc, -0.1), 2);
      ctx.strokeStyle = shadeC(hc, -0.45); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-33, -28); ctx.quadraticCurveTo(0, -24, 33, -28); ctx.stroke();
      rimLine(ctx, () => { ctx.moveTo(-34, -24); ctx.quadraticCurveTo(-34, -56, 0, -58); }, 'rgba(255,205,140,0.8)', 2.4);
    }
  });
}

// ---- BOATMAN (chú lái xuồng). Char units, origin between the feet. Eyes ≈ −440, hat top ≈ −505.
function boatman(ctx, x, y, s = 1, o = {}) {
  const pose = o.pose || 'row', t = o.t || 0, k = clamp(o.k ?? 0.5), fl = o.flip ? -1 : 1, ret = {};
  const SK = COL.skinB;
  at(ctx, x, y, 0, s * fl, s, () => {
    const M = mapper(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ph = o.phase ?? t * 0.8, rw = Math.sin(ph * TAU);
    const lean = pose === 'row' ? rw * 0.06 : pose === 'pull' ? -0.12 * k : 0;
    const by = pose === 'nod' ? Math.abs(Math.sin(t * 5)) * 3 : pose === 'cheer' ? -Math.abs(Math.sin(t * TAU * 1.667)) * 6 : 0;
    const hipY = -232 + by, SY = -372 + by, HY = -440 + by;
    ctx.fillStyle = 'rgba(30,15,20,0.3)'; ell(ctx, 0, 0, 70, 10); ctx.fill();
    // legs: rolled dark pants, bare calves + feet
    for (const sx of [-1, 1]) {
      const fx = sx * (pose === 'row' ? 34 : 26);
      capFS(ctx, sx * 22, hipY, fx, -60, 40, 34, lgr(ctx, -40, 0, 40, 0, [[0, '#4a4a52'], [1, '#22232a']]));
      capFS(ctx, fx, -66, fx, -10, 24, 20, SK[1]);
      ell(ctx, fx + sx * 6, -6, 20, 7); outFill(ctx, SK[2], 1.6);
    }
    // oar geometry
    let hL, hR, kL = 'grip', kR = 'grip', rL, rR, oarA, oarB;
    if (pose === 'row') {
      const piv = o.pivot || [-52, -155];
      hR = [38 + rw * 30, SY + 70 - rw * 8]; const d = [piv[0] - hR[0], piv[1] - hR[1]], dl = Math.hypot(d[0], d[1]), u = [d[0] / dl, d[1] / dl];
      hL = [hR[0] + u[0] * 48, hR[1] + u[1] * 48];
      oarA = [hR[0] - u[0] * 40, hR[1] - u[1] * 40]; oarB = [hR[0] + u[0] * (o.oarLen ?? 600), hR[1] + u[1] * (o.oarLen ?? 600)];
      rL = rR = Math.atan2(u[1], u[0]);
    } else if (pose === 'pull') {
      const e = ease.inOut(k), a = lerp(0.35, -0.08, e);
      hL = [16, SY + 66]; hR = [70 + e * 30, SY + 50]; const u = [Math.cos(a), Math.sin(a)];
      oarA = [hL[0] - u[0] * 50, hL[1] - u[1] * 50]; oarB = [hR[0] + u[0] * lerp(260, 520, e), hR[1] + u[1] * lerp(260, 520, e)];
      rL = rR = a;
    } else {
      hR = [64, SY + 96]; rR = -PI / 2; oarA = [74, SY + 360]; oarB = [70, SY - 260]; // oar held upright
      hL = pose === 'cheer' ? [-70, SY - 110 + Math.sin(t * TAU * 1.667) * 8] : [-58, SY + 120];
      kL = pose === 'cheer' ? 'fist' : 'flat'; rL = pose === 'cheer' ? -PI / 2 - 0.3 : PI / 2 + 0.2;
    }
    const drawOar = () => {
      const a = Math.atan2(oarB[1] - oarA[1], oarB[0] - oarA[0]);
      capFS(ctx, oarA[0], oarA[1], oarB[0], oarB[1], 12, 10, lgr(ctx, 0, -10, 0, 10, [[0, COL.woodL], [1, COL.wood]]), 1.8);
      at(ctx, oarB[0], oarB[1], a, 1, 1, () => { ctx.beginPath(); ctx.moveTo(-10, -7); ctx.quadraticCurveTo(-60, -26, -120, -22); ctx.lineTo(-120, 22); ctx.quadraticCurveTo(-60, 26, -10, 7); ctx.closePath(); outFill(ctx, lgr(ctx, 0, -24, 0, 24, [[0, COL.woodL], [1, COL.woodD]]), 1.8); });
      rimLine(ctx, () => { ctx.moveTo(oarA[0], oarA[1] - 5); ctx.lineTo(oarB[0], oarB[1] - 5); }, 'rgba(255,200,140,0.6)', 2);
    };
    ret.oarTip = M(oarB[0], oarB[1]);
    if (pose !== 'pull') drawOar();
    ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); ctx.translate(0, -hipY);
    const MM = mapper(ctx);
    // tee
    const tor = new Path2D(); tor.moveTo(-22, SY - 10); tor.quadraticCurveTo(-50, SY - 10, -60, SY + 8); tor.lineTo(-50, SY + 60); tor.lineTo(-48, hipY + 6); tor.quadraticCurveTo(0, hipY + 12, 48, hipY + 6); tor.lineTo(50, SY + 60); tor.lineTo(60, SY + 8); tor.quadraticCurveTo(50, SY - 10, 22, SY - 10); tor.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(tor); ctx.fillStyle = lgr(ctx, -60, 0, 60, 0, [[0, '#b4b6b8'], [0.5, COL.tee], [1, COL.teeD]]); ctx.fill(tor);
    ctx.save(); ctx.clip(tor); ctx.fillStyle = 'rgba(40,40,45,0.25)'; ell(ctx, 30, SY + 90, 26, 34); ctx.fill(); ctx.restore(); // sweat patch / fold
    rimLine(ctx, () => { ctx.moveTo(-22, SY - 10); ctx.quadraticCurveTo(-50, SY - 10, -60, SY + 8); ctx.lineTo(-50, SY + 60); }, 'rgba(255,205,140,0.8)', 2.6);
    // khăn rằn tied at the waist
    ctx.fillStyle = khanRan(ctx, 14); ctx.fillRect(-48, hipY - 6, 96, 12); ctx.beginPath(); ctx.moveTo(-30, hipY + 2); ctx.lineTo(-44, hipY + 40); ctx.lineTo(-30, hipY + 42); ctx.lineTo(-22, hipY + 4); ctx.fill();
    if (pose === 'pull') drawOar();
    const shL = [-52, SY + 6], shR = [52, SY + 6];
    const elL = ikPick(shL[0], shL[1], hL[0], hL[1], 82, 78, -1), elR = ikPick(shR[0], shR[1], hR[0], hR[1], 82, 78, 1);
    const armO = { skin: SK, wu: [22, 19], wf: [18, 14], sleeve: lgr(ctx, -60, 0, 60, 0, [[0, '#b4b6b8'], [1, COL.teeD]]), sleeveTo: 0.45 };
    cArm(ctx, shL[0], shL[1], elL[0], elL[1], hL[0], hL[1], armO);
    cArm(ctx, shR[0], shR[1], elR[0], elR[1], hR[0], hR[1], armO);
    cHand(ctx, hL[0], hL[1], 0.4, rL ?? handRot(elL[0], elL[1], hL[0], hL[1]), { kind: kL, skin: SK, flip: true });
    cHand(ctx, hR[0], hR[1], 0.4, rR ?? handRot(elR[0], elR[1], hR[0], hR[1]), { kind: kR, skin: SK, flip: true });
    const nod = pose === 'nod' ? Math.sin(t * 5) * 0.12 : 0;
    miniHead(ctx, 0, HY, 40, { skin: SK, hat: 'bucket', expr: pose === 'cheer' ? 'laugh' : o.expr || 'smile', tilt: nod + lean * 0.5, mustache: true, turn: o.turn || 0 });
    ret.head = MM(0, HY); ret.handL = MM(hL[0], hL[1]); ret.handR = MM(hR[0], hR[1]);
    if (pose === 'pull') ret.oarTip = MM(oarB[0], oarB[1]);
    ctx.restore();
  });
  if (fl < 0) { const sw = ret.handL; ret.handL = ret.handR; ret.handR = sw; }
  return ret;
}

// ---- background VENDOR (seeded look). Char units, origin = deck point between the feet. ≈330 tall incl. hat.
const VENDOR_SHIRTS = ['#c9786c', '#4a7ab0', '#e0b04a', '#7a9a5a', '#b04a6a', '#e8e0d0', '#5a5a8a'];
function vendor(ctx, x, y, s = 1, o = {}) {
  const r = rng((o.seed || 0) * 13 + 5), t = o.t || 0;
  const shirt = VENDOR_SHIRTS[Math.floor(r() * VENDOR_SHIRTS.length)], hat = r() < 0.7 ? 'nonla' : r() < 0.5 ? 'bucket' : null;
  const sk = r() < 0.5 ? COL.skinB : COL.skin, man = r() < 0.4, sit = o.sit ?? r() < 0.35;
  const raise = clamp(o.raise || 0), ph = r() * 6;
  at(ctx, x, y, 0, s * (o.flip ? -1 : 1), s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const by = Math.sin(t * 2 + ph) * 1.5 - raise * Math.abs(Math.sin(t * TAU * 1.667 + ph)) * 4 + (sit ? 90 : 0);
    const hipY = -150 + by, SY = -238 + by, HY = -278 + by;
    // legs
    const pants = man ? '#3a3a42' : '#1c1a1f';
    if (sit) { for (const sx of [-1, 1]) { capFS(ctx, sx * 14, hipY, sx * 36, hipY - 24, 28, 24, pants, 1.6); capFS(ctx, sx * 36, hipY - 24, sx * 38, -8, 22, 18, pants, 1.6); } }
    else for (const sx of [-1, 1]) capFS(ctx, sx * 16, hipY, sx * 20, -8, 30, 24, pants, 1.6);
    // torso
    ctx.beginPath(); ctx.moveTo(-34, SY); ctx.quadraticCurveTo(-42, SY + 40, -36, hipY + 8); ctx.lineTo(36, hipY + 8); ctx.quadraticCurveTo(42, SY + 40, 34, SY); ctx.closePath();
    outFill(ctx, lgr(ctx, -40, 0, 40, 0, [[0, shadeC(shirt, 0.25)], [0.5, shirt], [1, shadeC(shirt, -0.4)]]), 1.8);
    rimLine(ctx, () => { ctx.moveTo(-34, SY); ctx.quadraticCurveTo(-42, SY + 40, -36, hipY + 8); }, 'rgba(255,200,140,0.8)', 2.4);
    // arms
    const aL = [-34, SY + 6], aR = [34, SY + 6];
    const hL = [-30, SY + 70], hR = raise > 0 ? [lerp(30, 52, raise), lerp(SY + 70, SY - 74, raise)] : [30, SY + 70];
    capFS(ctx, aL[0], aL[1], hL[0], hL[1], 18, 14, shirt, 1.6); ell(ctx, hL[0], hL[1] + 4, 8, 8); ctx.fillStyle = sk[1]; ctx.fill();
    capFS(ctx, aR[0], aR[1], hR[0], hR[1], 18, 14, shirt, 1.6); ell(ctx, hR[0], hR[1] + (raise > 0.5 ? -4 : 4), 8, 8); ctx.fillStyle = sk[1]; ctx.fill();
    if (raise > 0.3) nemRoll(ctx, hR[0] + 2, hR[1] - 26, 0.15, -PI / 2 + 0.1, {});
    miniHead(ctx, 0, HY, 30, { skin: sk, hat, expr: raise > 0.5 ? 'laugh' : 'smile', hatCol: COL.hatOlive, turn: (r() - 0.5) * 0.6 });
  });
}

// ---- a row of vendor boats across the frame (background / crowd). o: n, seed, raise, x0, x1, flipAlt, pole
function crowdBoats(ctx, t, y, s = 1, o = {}) {
  const n = o.n ?? 4, x0 = o.x0 ?? -100, x1 = o.x1 ?? W + 100, seed = o.seed ?? 11, out = [];
  for (let i = 0; i < n; i++) {
    const r = rng(seed + i * 7);
    const x = lerp(x0, x1, (i + 0.5) / n) + (r() - 0.5) * 60 * s;
    out.push(ghe(ctx, x, y + (i % 2) * 14 * s, s, { seed: seed + i, t, flip: (o.flipAlt ?? true) && i % 2 === 1, people: true, raise: o.raise || 0, pole: o.pole ?? true, cargo: true }));
  }
  return out;
}

// ================================================================================================ FOOD & PROPS
// ---- nem nướng on a bamboo skewer. origin = meat centre, meat 170×40, stick 320 (−160..+160) along +x.
function nemMeatPath(ctx, len, hh, seed) {
  const r = rng(seed), n = 9, top = [], bot = [];
  for (let i = 0; i <= n; i++) { const u = i / n, xx = lerp(-len / 2 + hh * 0.5, len / 2 - hh * 0.5, u); top.push([xx, -hh / 2 - (r() - 0.5) * hh * 0.16]); bot.push([xx, hh / 2 + (r() - 0.5) * hh * 0.16]); }
  ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i <= n; i++) { const a = top[i - 1], b = top[i]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  ctx.lineTo(top[n][0], top[n][1]);
  ctx.bezierCurveTo(len / 2 + hh * 0.1, top[n][1], len / 2 + hh * 0.1, bot[n][1], bot[n][0], bot[n][1]);
  for (let i = n - 1; i >= 0; i--) { const a = bot[i + 1], b = bot[i]; ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
  ctx.lineTo(bot[0][0], bot[0][1]);
  ctx.bezierCurveTo(-len / 2 - hh * 0.1, bot[0][1], -len / 2 - hh * 0.1, top[0][1], top[0][0], top[0][1]);
  ctx.closePath();
}
function nemColor(cook) { return cook < 0.5 ? mixc(COL.nemRaw, COL.nemCooked, cook * 2 * 0.6) : mixc(mixc(COL.nemRaw, COL.nemCooked, 0.6), COL.nemCooked, (cook - 0.5) * 2); }
function nemSkewer(ctx, x, y, s = 1, o = {}) {
  const cook = clamp(o.cook ?? 0.8), t = o.t || 0, seed = o.seed ?? 3, len = o.len ?? 170, hh = o.h ?? 40, stick = o.stick ?? 320;
  const ret = {};
  at(ctx, x, y, o.rot || 0, s, s, () => {
    const M = mapper(ctx);
    ret.a = M(-stick / 2, 0); ret.b = M(stick / 2, 0);
    // bamboo stick (flat bamboo skewer, slightly charred near the meat)
    capFS(ctx, -stick / 2, 0, stick / 2, 0, 7, 6, lgr(ctx, 0, -4, 0, 4, [[0, '#f1dca6'], [0.5, COL.bamboo], [1, COL.bambooD]]), 1.2);
    ctx.fillStyle = `rgba(40,20,10,${0.5 * cook})`; ctx.fillRect(-len / 2 - 18, -3.5, 18, 7); ctx.fillRect(len / 2, -3.5, 18, 7);
    const base = nemColor(cook);
    nemMeatPath(ctx, len, hh, seed);
    ctx.save();
    ctx.fillStyle = lgr(ctx, 0, -hh / 2, 0, hh / 2, [[0, mixc(base, '#ffffff', 0.18)], [0.45, base], [1, mixc(base, '#2a0e06', 0.35 + cook * 0.2)]]);
    ctx.fill(); ctx.strokeStyle = `rgba(70,25,15,${0.45 + cook * 0.3})`; ctx.lineWidth = 2; ctx.stroke();
    ctx.clip();
    const r = rng(seed + 9);
    // minced texture: garlic/fat specks (raw) → caramel blisters (cooked)
    for (let i = 0; i < 46; i++) {
      const px = (r() - 0.5) * len, py = (r() - 0.5) * hh, rr = 1 + r() * 2.6;
      ctx.fillStyle = cook < 0.4 ? `rgba(255,236,226,${0.5 - cook})` : `rgba(${r() < 0.5 ? '90,30,10' : '255,190,120'},${0.25 + cook * 0.25})`;
      ell(ctx, px, py, rr * 1.3, rr); ctx.fill();
    }
    // char/grill marks
    if (cook > 0.3) {
      ctx.strokeStyle = `rgba(40,14,6,${(cook - 0.3) * 0.9})`; ctx.lineWidth = 7; ctx.lineCap = 'round';
      for (let i = -3; i <= 3; i++) { const gx = i * 26 + 6; ctx.beginPath(); ctx.moveTo(gx - 8, -hh / 2 - 2); ctx.lineTo(gx + 8, hh / 2 + 2); ctx.stroke(); }
      ctx.fillStyle = `rgba(30,10,5,${(cook - 0.3) * 0.6})`;
      for (let i = 0; i < 6; i++) { ell(ctx, (r() - 0.5) * len, hh * (0.2 + r() * 0.3), 6 + r() * 8, 3 + r() * 3); ctx.fill(); }
    }
    // glaze gloss + backlit rim
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(255,${200 + cook * 30},${150 + cook * 40},${0.35 + cook * 0.35})`; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-len / 2 + 14, -hh * 0.3); ctx.bezierCurveTo(-len * 0.2, -hh * 0.42, len * 0.2, -hh * 0.36, len / 2 - 14, -hh * 0.32); ctx.stroke();
    ctx.fillStyle = `rgba(255,240,210,${0.3 + cook * 0.4})`;
    for (let i = 0; i < 7; i++) { ell(ctx, (r() - 0.5) * len * 0.85, -hh * (0.18 + r() * 0.12), 3 + r() * 5, 1.4 + r()); ctx.fill(); }
    ctx.restore();
    // dripping fat bead
    if (o.drip !== false && (o.drip !== undefined || cook > 0.6)) {
      const ph = o.drip ?? ((t * 0.9 + (seed % 7) * 0.13) % 1);
      const dx = ((seed * 37) % 100 - 50) / 100 * len * 0.6;
      const dy = hh / 2 + 2 + (ph < 0.6 ? ph / 0.6 * 6 : 6 + ((ph - 0.6) / 0.4) ** 2 * 90);
      const sz = ph < 0.6 ? 2 + ph * 5 : 4.5;
      ctx.fillStyle = 'rgba(255,214,140,0.9)'; ctx.beginPath(); ctx.moveTo(dx, hh / 2 - 1); if (ph < 0.6) ctx.quadraticCurveTo(dx + sz, dy - sz, dx, dy + sz); else ctx.moveTo(dx, dy - sz); ctx.arc(dx, dy, sz, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.9)'; ell(ctx, dx - sz * 0.3, dy - sz * 0.3, sz * 0.3, sz * 0.3); ctx.fill();
    }
  });
  return ret;
}

// ---- wire grill rack (vỉ nướng), origin centre, 300×110, seen from above at a shallow angle.
function grillRack(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, cookD = o.cook ?? 0.7, out = [];
  let sk = o.skewers ?? 4;
  if (typeof sk === 'number') { const n = sk, r = rng(o.seed ?? 5); sk = []; for (let i = 0; i < n; i++) sk.push({ cook: clamp(cookD + (r() - 0.5) * 0.15), dx: (r() - 0.5) * 30, rot: (r() - 0.5) * 0.06 }); }
  at(ctx, x, y, 0, s, s, () => {
    const M = mapper(ctx), wT = 132, wB = 150, hh = 55;
    const rowY = (i, n) => lerp(-hh * 0.7, hh * 0.75, n === 1 ? 0.5 : i / (n - 1));
    // back frame + wires
    ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-wT, -hh); ctx.lineTo(wT, -hh); ctx.lineTo(wB, hh); ctx.lineTo(-wB, hh); ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,58,62,0.9)';
    for (let i = 1; i < 14; i++) { const u = i / 14; ctx.beginPath(); ctx.moveTo(lerp(-wT, wT, u), -hh); ctx.lineTo(lerp(-wB, wB, u), hh); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,150,80,0.35)'; ctx.lineWidth = 1.2;
    for (let i = 1; i < 14; i++) { const u = i / 14; ctx.beginPath(); ctx.moveTo(lerp(-wT, wT, u) - 1, -hh); ctx.lineTo(lerp(-wB, wB, u) - 1, hh); ctx.stroke(); }
    sk.forEach((q, i) => {
      const yy = rowY(i, sk.length), pers = 0.92 + (yy + hh) / (2 * hh) * 0.1;
      const r = nemSkewer(ctx, (q.dx || 0) + 20, yy, pers * 0.95, { cook: q.cook ?? cookD, rot: q.rot || 0, t, seed: 11 + i * 5, stick: 300 });
      out.push(M((q.dx || 0) + 20, yy)); void r;
    });
    // front frame + handle
    ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-wB, hh); ctx.lineTo(wB, hh); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,190,120,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-wB, hh - 2); ctx.lineTo(wB, hh - 2); ctx.stroke();
  });
  return { skewers: out };
}

// ---- clay charcoal stove (lò đất / cà ràng). origin = base centre; 230 wide; rim at y=−190.
function charcoalStove(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, seed = o.seed ?? 2;
  const fl = 0.86 + 0.14 * Math.sin(t * 13.7) * Math.sin(t * 5.3 + 1);
  const gl = clamp(o.glow ?? 0.8) * fl, ret = {};
  at(ctx, x, y, 0, s, s, () => {
    const M = mapper(ctx);
    ctx.fillStyle = 'rgba(20,10,15,0.35)'; ell(ctx, 0, 2, 140, 14); ctx.fill();
    const body = new Path2D();
    body.moveTo(-112, -184); body.quadraticCurveTo(-126, -96, -86, -6); body.quadraticCurveTo(0, 10, 86, -6); body.quadraticCurveTo(126, -96, 112, -184); body.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke(body);
    ctx.fillStyle = lgr(ctx, -125, 0, 125, 0, [[0, COL.clayL], [0.35, COL.clay], [1, COL.clayD]]); ctx.fill(body);
    ctx.save(); ctx.clip(body);
    // grooves, soot, cracks, teal shade
    ctx.strokeStyle = 'rgba(70,30,15,0.35)'; ctx.lineWidth = 3;
    for (const gy of [-150, -60]) { ctx.beginPath(); ctx.ellipse(0, gy, 130, 14, 0, 0, PI); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,200,150,0.25)'; ctx.lineWidth = 2;
    for (const gy of [-147, -57]) { ctx.beginPath(); ctx.ellipse(0, gy, 130, 14, 0, 0.2, PI - 0.6); ctx.stroke(); }
    ctx.fillStyle = lgr(ctx, 0, -190, 0, -130, [[0, 'rgba(30,15,10,0.7)'], [1, 'rgba(30,15,10,0)']]); ctx.fillRect(-140, -200, 280, 80);
    const r = rng(seed);
    ctx.strokeStyle = 'rgba(60,25,12,0.4)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) { let cx = (r() - 0.5) * 160, cy = -170 + r() * 120; ctx.beginPath(); ctx.moveTo(cx, cy); for (let j = 0; j < 4; j++) { cx += (r() - 0.5) * 18; cy += 6 + r() * 10; ctx.lineTo(cx, cy); } ctx.stroke(); }
    ctx.fillStyle = lgr(ctx, 30, 0, 125, 0, [[0, 'rgba(25,55,70,0)'], [1, 'rgba(25,55,70,0.4)']]); ctx.fillRect(-140, -200, 280, 210);
    // warm firelight spill on the belly
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgr(ctx, 0, -10, 10, 0, -10, 110, [[0, `rgba(255,120,40,${0.35 * gl})`], [1, 'rgba(255,120,40,0)']]); ctx.fillRect(-140, -150, 280, 160);
    ctx.restore();
    // draft hole with glowing coals
    const hole = new Path2D(); hole.moveTo(-42, -6); hole.lineTo(-42, -46); hole.arc(0, -46, 42, PI, 0); hole.lineTo(42, -6); hole.quadraticCurveTo(0, 0, -42, -6); hole.closePath();
    ctx.fillStyle = '#1e0c08'; ctx.fill(hole);
    ctx.save(); ctx.clip(hole);
    ctx.fillStyle = rgr(ctx, 0, -14, 4, 0, -14, 60, [[0, `rgba(255,236,170,${gl})`], [0.35, `rgba(255,140,40,${0.9 * gl})`], [1, 'rgba(120,30,10,0)']]); ctx.fillRect(-50, -100, 100, 100);
    const r2 = rng(seed + 4);
    for (let i = 0; i < 9; i++) { const cx = (r2() - 0.5) * 70, cy = -8 - r2() * 22; ell(ctx, cx, cy, 9 + r2() * 6, 6 + r2() * 4); ctx.fillStyle = `rgba(30,14,10,${0.85 - gl * 0.3})`; ctx.fill(); ctx.strokeStyle = `rgba(255,${120 + (r2() * 80 | 0)},40,${gl})`; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(70,30,15,0.6)'; ctx.lineWidth = 3; ctx.stroke(hole);
    // rim lip + coal bed
    ell(ctx, 0, -188, 120, 25); ctx.fillStyle = lgr(ctx, -120, 0, 120, 0, [[0, '#e6a77c'], [0.5, COL.clay], [1, COL.clayD]]); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
    ell(ctx, 0, -187, 102, 18); ctx.fillStyle = '#1a0b07'; ctx.fill();
    ctx.save(); ell(ctx, 0, -187, 102, 18); ctx.clip();
    ctx.fillStyle = rgr(ctx, 0, -187, 4, 0, -187, 100, [[0, `rgba(255,220,140,${gl})`], [0.4, `rgba(255,110,30,${0.9 * gl})`], [1, `rgba(90,20,8,${0.6 * gl})`]]); ctx.fillRect(-110, -210, 220, 50);
    const r3 = rng(seed + 8);
    for (let i = 0; i < 16; i++) { const cx = (r3() - 0.5) * 190, cy = -187 + (r3() - 0.5) * 28; ell(ctx, cx, cy, 10 + r3() * 8, 5 + r3() * 3); ctx.fillStyle = `rgba(28,14,10,${0.75 - 0.25 * gl})`; ctx.fill(); ctx.strokeStyle = `rgba(255,${150 + (r3() * 90 | 0)},60,${0.8 * gl * (0.6 + 0.4 * Math.sin(t * 7 + i))})`; ctx.lineWidth = 1.8; ctx.stroke(); }
    ctx.restore();
    rimLine(ctx, () => ctx.ellipse(0, -188, 120, 25, 0, PI * 0.95, PI * 1.6), 'rgba(255,210,150,0.85)', 3);
    rimLine(ctx, () => { ctx.moveTo(-112, -182); ctx.quadraticCurveTo(-126, -96, -86, -6); }, 'rgba(255,190,120,0.6)', 3);
    glow(ctx, 0, -200, 230, 'rgba(255,120,40,1)', 0.28 * gl);
    if (o.flare) L.flare(ctx, 0, -196, 0.6, o.flare);
    ret.top = M(0, -196);
    const a = M(-115, -190), b = M(115, -190); ret.rimW = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (o.grill) ret.skewers = grillRack(ctx, 0, -200, 0.74, { skewers: o.skewers ?? 4, cook: o.cook, t, seed: seed + 1 }).skewers;
    if (o.embers !== false) embers(ctx, t, seed + 20, 7, -80, -230, 160, 30, { alpha: 0.9 * gl, rise: 220 });
  });
  return ret;
}

// ---- close-up: hands shaping pork paste onto a bamboo stick. origin = stick centre, ~520 wide. o.p 0..1
function nemShaping(ctx, x, y, s = 1, o = {}) {
  const p = clamp(o.p ?? 0.5), t = o.t || 0, e = ease.inOut(p);
  at(ctx, x, y, o.rot || 0, s, s, () => {
    const len = lerp(70, 260, e), hh = lerp(90, 60, e);
    capFS(ctx, -260, 0, 260, 0, 10, 9, lgr(ctx, 0, -5, 0, 5, [[0, '#f4e2b0'], [0.5, COL.bamboo], [1, COL.bambooD]]), 1.4);
    nemMeatPath(ctx, len, hh, 17);
    ctx.fillStyle = lgr(ctx, 0, -hh / 2, 0, hh / 2, [[0, '#f8c4b8'], [0.5, COL.nemRaw], [1, '#b8665e']]); ctx.fill();
    ctx.strokeStyle = 'rgba(120,50,40,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.clip();
    const r = rng(23);
    for (let i = 0; i < 70; i++) { ctx.fillStyle = r() < 0.6 ? 'rgba(255,240,232,0.55)' : 'rgba(150,60,50,0.35)'; ell(ctx, (r() - 0.5) * 260, (r() - 0.5) * 90, 1.5 + r() * 2.5, 1.2 + r() * 1.5); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -len * 0.1, -hh * 0.25, len * 0.35, hh * 0.1); ctx.fill();
    ctx.restore();
    const sl = Math.sin(p * TAU * 3 + t * 2) * 22;
    cHand(ctx, -len / 2 - 70 + sl, 6, 1.35, -0.05, { kind: 'grip', flip: true });
    cHand(ctx, len / 2 + 70 - sl, 6, 1.35, PI + 0.05, { kind: 'grip' });
  });
}

// ---- quạt nan (woven bamboo hand fan). origin = handle end; 230 long along +x.
function handFan(ctx, x, y, s = 1, rot = 0, o = {}) {
  const blur = clamp(o.blur || 0);
  const one = (a) => at(ctx, x, y, rot + a, s, s, () => {
    capFS(ctx, 0, 0, 95, 0, 12, 10, lgr(ctx, 0, -6, 0, 6, [[0, COL.bambooL], [1, COL.bambooD]]), 1.6);
    const blade = new Path2D();
    blade.moveTo(84, 0); blade.bezierCurveTo(90, -70, 160, -84, 210, -64); blade.bezierCurveTo(240, -40, 240, 40, 210, 64); blade.bezierCurveTo(160, 84, 90, 70, 84, 0); blade.closePath();
    ctx.fillStyle = lgr(ctx, 84, -80, 230, 80, [[0, '#f3dca0'], [0.5, '#d9b66c'], [1, '#a9853f']]); ctx.fill(blade);
    ctx.save(); ctx.clip(blade);
    ctx.strokeStyle = 'rgba(120,80,30,0.45)'; ctx.lineWidth = 2;
    for (let i = -24; i < 24; i++) { ctx.beginPath(); ctx.moveTo(80 + i * 8, -90); ctx.lineTo(80 + i * 8 + 180, 90); ctx.stroke(); ctx.beginPath(); ctx.moveTo(80 + i * 8, 90); ctx.lineTo(80 + i * 8 + 180, -90); ctx.stroke(); }
    ctx.fillStyle = 'rgba(160,50,40,0.5)'; ell(ctx, 160, 0, 32, 32); ctx.fill(); // faded red painted circle
    ctx.fillStyle = lgr(ctx, 84, 0, 240, 0, [[0, 'rgba(255,200,130,0.35)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(25,55,65,0.3)']]); ctx.fillRect(80, -90, 170, 180);
    ctx.restore();
    ctx.strokeStyle = COL.bambooD; ctx.lineWidth = 6; ctx.stroke(blade);
    ctx.strokeStyle = 'rgba(255,220,160,0.6)'; ctx.lineWidth = 1.6; ctx.stroke(blade);
  });
  if (blur > 0.05) { ctx.save(); ctx.globalAlpha = 0.25 * blur; one(-0.22 * blur); one(0.22 * blur); ctx.restore(); }
  one(0);
}

// ---- kẹp gắp (metal tongs). origin = hinge; 240 long along +x. o.open 0..1. Returns tip [x,y].
function tongs(ctx, x, y, s = 1, rot = 0, o = {}) {
  const op = clamp(o.open ?? 0.3), a = 0.03 + op * 0.16; let tip;
  at(ctx, x, y, rot, s, s, () => {
    const M = mapper(ctx);
    for (const sx of [-1, 1]) {
      const ex = Math.cos(a) * 240, ey = sx * Math.sin(a) * 240;
      capFS(ctx, 0, sx * 4, ex, ey, 11, 8, lgr(ctx, 0, -10, 0, 10, [[0, '#e8ecef'], [0.5, '#9aa3ab'], [1, '#4a5056']]), 1.4);
      at(ctx, ex, ey, sx * a, 1, 1, () => { ctx.fillStyle = '#7a838a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 5, -sx * 5); ctx.lineTo(-11 + i * 5, -sx * 10); ctx.lineTo(-8 + i * 5, -sx * 5); ctx.fill(); } });
      rimLine(ctx, () => { ctx.moveTo(4, sx * 4 - 3); ctx.lineTo(ex, ey - 3); }, 'rgba(255,220,180,0.8)', 1.6);
    }
    ell(ctx, 0, 0, 10, 10); outFill(ctx, '#6a7076', 1.4);
    tip = M(Math.cos(a) * 240, 0);
  });
  return tip;
}

// ---- dĩa (white plate). origin = centre, 300×110. o.kind 'nem'|'rolls'|'cut', o.n
function nemPlate(ctx, x, y, s = 1, o = {}) {
  const kind = o.kind || 'nem', n = o.n ?? 3, ret = {};
  at(ctx, x, y, o.rot || 0, s, s, () => {
    const M = mapper(ctx);
    ctx.fillStyle = 'rgba(20,10,15,0.3)'; ell(ctx, 4, 12, 156, 54); ctx.fill();
    ell(ctx, 0, 0, 150, 55); ctx.fillStyle = lgr(ctx, 0, -55, 0, 55, [[0, '#ffffff'], [1, '#c9cfd6']]); ctx.fill(); ctx.strokeStyle = 'rgba(80,80,100,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    ell(ctx, 0, 2, 112, 38); ctx.fillStyle = lgr(ctx, 0, -38, 0, 38, [[0, '#dfe5ea'], [1, '#ffffff']]); ctx.fill();
    ctx.strokeStyle = 'rgba(60,110,170,0.6)'; ctx.lineWidth = 2.5; ell(ctx, 0, 0, 140, 50); ctx.stroke();
    rimLine(ctx, () => ctx.ellipse(0, 0, 150, 55, 0, PI * 0.95, PI * 1.55), 'rgba(255,215,170,0.9)', 3);
    herb(ctx, 'lettuce', -40, 2, 0.9, -0.15); herb(ctx, 'lettuce', 30, 6, 0.8, 0.2);
    if (kind === 'nem') for (let i = 0; i < n; i++) nemSkewer(ctx, 10 + (i - (n - 1) / 2) * 8, -8 + (i - (n - 1) / 2) * 18, 0.62, { cook: 0.85, rot: -0.12 + i * 0.05, seed: 30 + i, stick: 300 });
    else if (kind === 'rolls') for (let i = 0; i < n; i++) nemRoll(ctx, (i - (n - 1) / 2) * 34, -14 + (i - (n - 1) / 2) * 6 - Math.abs(i - (n - 1) / 2) * 4, 0.5, -0.2 + i * 0.12, {});
    else for (let i = 0; i < n; i++) nemRollCut(ctx, (i - (n - 1) / 2) * 70 - 20, -18 + (i % 2) * 14, 0.45, { len: 60, rot: -0.15 });
    ret.center = M(0, 0); ret.top = M(0, -40);
  });
  return ret;
}

// ---- bánh tráng (rice paper). R=170. o.wet 0..1, o.ry, o.rot, o.sag 0..1
function ricePaperPath(ctx, R, ry, sag) {
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * TAU, sy = Math.sin(a), cx = Math.cos(a);
    const px = cx * R * (1 - sag * 0.12 * Math.max(0, sy)), py = sy * R * ry + sag * Math.max(0, sy) * R * 0.75 * (1 - cx * cx * 0.6);
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function ricePaper(ctx, x, y, s = 1, o = {}) {
  const wet = clamp(o.wet ?? 0), ry = o.ry ?? 1, sag = clamp(o.sag || 0), R = 170;
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ricePaperPath(ctx, R, ry, sag);
    ctx.fillStyle = `rgba(${lerp(248, 240, wet) | 0},${lerp(240, 236, wet) | 0},${lerp(226, 228, wet) | 0},${lerp(0.97, 0.62, wet)})`; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.scale(1, ry);
    // bamboo-mat crosshatch imprint (fades when wet)
    ctx.strokeStyle = `rgba(190,170,130,${0.4 * (1 - wet)})`; ctx.lineWidth = 1.4;
    for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(i * 13 - 200, -200); ctx.lineTo(i * 13 + 200, 200); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 13 + 200, -200); ctx.lineTo(i * 13 - 200, 200); ctx.stroke(); }
    ctx.fillStyle = `rgba(255,255,255,${0.25 * (1 - wet)})`; ell(ctx, -40, -50, 90, 60); ctx.fill();
    // wet gloss streaks + soft wrinkles
    if (wet > 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = `rgba(255,240,220,${0.55 * wet})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(-20, -20, 120, PI * 1.05, PI * 1.45); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(10, 0, 90, PI * 1.1, PI * 1.35); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = `rgba(160,150,140,${0.25 * wet})`; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-120 + i * 55, 60 - i * 20); ctx.quadraticCurveTo(-90 + i * 55, 30 - i * 25, -60 + i * 50, 70 - i * 18); ctx.stroke(); }
    }
    ctx.restore();
    ctx.strokeStyle = `rgba(170,150,120,${0.6 - wet * 0.3})`; ctx.lineWidth = 2; ricePaperPath(ctx, R, ry, sag); ctx.stroke();
    rimLine(ctx, () => { ctx.ellipse(0, 0, R, R * ry, 0, PI * 1.0, PI * 1.5); }, 'rgba(255,220,170,0.8)', 3);
  });
}

// ---- thau nước (tin basin of water). origin = centre, R=210, o.ry 0.45, o.dip 0..1 ripples
function waterBasin(ctx, x, y, s = 1, o = {}) {
  const ry = o.ry ?? 0.45, t = o.t || 0, dip = clamp(o.dip || 0), R = 210;
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(20,10,15,0.3)'; ell(ctx, 0, R * ry * 0.5 + 30, R * 1.02, R * ry * 0.9); ctx.fill();
    // outer wall (visible below the rim)
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * ry, 0, 0, PI); ctx.lineTo(-R * 0.86, R * ry * 0.3 + 40); ctx.ellipse(0, 40, R * 0.86, R * ry * 0.86, 0, PI, 0, true); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#d8dde2'], [0.3, '#9aa3ab'], [0.7, '#6a7178'], [1, '#3e444a']]); ctx.fill();
    // rim
    ell(ctx, 0, 0, R, R * ry); ctx.fillStyle = '#c7cdd2'; ctx.fill(); ctx.strokeStyle = 'rgba(40,45,55,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    ell(ctx, 0, 3, R - 14, (R - 14) * ry);
    ctx.fillStyle = lgr(ctx, 0, -R * ry, 0, R * ry, [[0, '#f6b07a'], [0.45, '#c97f8a'], [1, '#4b5578']]); ctx.fill();
    ctx.save(); ell(ctx, 0, 3, R - 14, (R - 14) * ry); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,240,200,0.5)'; ell(ctx, -50, -20, 70, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,200,0.5)'; ctx.lineWidth = 2;
    const nR = dip > 0 ? 4 : 2;
    for (let i = 0; i < nR; i++) { const ph = (t * 0.8 + i / nR) % 1, rr = (dip > 0 ? 30 + ph * 170 : 60 + ph * 120); ctx.globalAlpha = (1 - ph) * (dip > 0 ? dip : 0.35); ell(ctx, dip > 0 ? 20 : -30, 8, rr, rr * ry); ctx.stroke(); }
    ctx.restore();
    rimLine(ctx, () => ctx.ellipse(0, 0, R, R * ry, 0, PI * 0.95, PI * 1.6), 'rgba(255,225,190,0.9)', 3.5);
  });
}

// ---- herbs & garnish. (x,y) ≈ centre, long axis along +x.
function herb(ctx, kind, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const leaf = (lx, ly, a, Ln, Wd, c0, c1, serr) => at(ctx, lx, ly, a, 1, 1, () => {
      ctx.beginPath(); ctx.moveTo(0, 0);
      if (serr) { for (let i = 1; i <= 8; i++) { const u = i / 8; ctx.lineTo(u * Ln, -Math.sin(u * PI) * Wd * (i % 2 ? 1 : 0.86)); } for (let i = 7; i >= 0; i--) { const u = i / 8; ctx.lineTo(u * Ln, Math.sin(u * PI) * Wd * (i % 2 ? 1 : 0.86)); } }
      else { ctx.quadraticCurveTo(Ln * 0.4, -Wd * 1.3, Ln, 0); ctx.quadraticCurveTo(Ln * 0.4, Wd * 1.3, 0, 0); }
      ctx.closePath(); ctx.fillStyle = lgr(ctx, 0, -Wd, 0, Wd, [[0, c0], [1, c1]]); ctx.fill();
      ctx.strokeStyle = 'rgba(20,50,20,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(230,255,200,0.45)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(Ln * 0.85, 0); ctx.stroke();
    });
    if (kind === 'lettuce') {
      const p = new Path2D(); p.moveTo(-80, 0);
      for (let i = 0; i <= 16; i++) { const u = i / 16, xx = lerp(-80, 80, u); p.quadraticCurveTo(xx - 5, -34 * Math.sin(u * PI) - 10 - (i % 2) * 8, xx, -30 * Math.sin(u * PI) - 6); }
      p.quadraticCurveTo(70, 30, 0, 26); p.quadraticCurveTo(-70, 30, -80, 0); p.closePath();
      ctx.fillStyle = lgr(ctx, 0, -40, 0, 30, [[0, '#d6f08a'], [0.5, COL.lettuce], [1, COL.lettuceD]]); ctx.fill(p);
      ctx.strokeStyle = 'rgba(40,90,30,0.45)'; ctx.lineWidth = 1.5; ctx.stroke(p);
      ctx.strokeStyle = 'rgba(245,255,215,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-78, 2); ctx.quadraticCurveTo(0, 4, 70, -6); ctx.stroke();
      ctx.strokeStyle = 'rgba(245,255,215,0.4)'; ctx.lineWidth = 1.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 20, 2); ctx.lineTo(i * 20 + 10, -24); ctx.stroke(); }
    } else if (kind === 'basil') {
      ctx.strokeStyle = COL.basilStem; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-60, 6); ctx.quadraticCurveTo(0, 0, 60, -6); ctx.stroke();
      [[-40, -0.9, 34], [-40, 0.9, 34], [-6, -0.8, 40], [-6, 0.8, 40], [28, -0.6, 32], [28, 0.6, 32], [56, 0, 26]].forEach(([lx, a, Ln]) => leaf(lx, -lx * 0.1, a, Ln, Ln * 0.38, '#5fae4a', COL.basil, false));
      ctx.fillStyle = '#8a4aa0'; ell(ctx, 66, -8, 5, 4); ctx.fill();
    } else if (kind === 'diepca') {
      ctx.strokeStyle = '#b0584a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-50, 8); ctx.quadraticCurveTo(0, 0, 50, -4); ctx.stroke();
      [[-24, -0.9], [8, 0.8], [40, -0.3]].forEach(([lx, a]) => at(ctx, lx, 0, a, 1, 1, () => {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(10, -26, 40, -22, 34, 0); ctx.bezierCurveTo(40, 22, 10, 26, 0, 0); ctx.closePath();
        ctx.fillStyle = lgr(ctx, 0, -20, 0, 20, [[0, '#a8d66a'], [1, COL.diepca]]); ctx.fill(); ctx.strokeStyle = 'rgba(20,50,20,0.4)'; ctx.lineWidth = 1.2; ctx.stroke();
      }));
    } else if (kind === 'tiato') {
      ctx.strokeStyle = '#6a2a5a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-50, 6); ctx.lineTo(50, -4); ctx.stroke();
      [[-30, -0.7, COL.tiatoG, COL.tiato], [-30, 0.7, COL.tiato, '#3a1a3e'], [10, -0.5, COL.tiatoG, COL.tiato], [10, 0.6, COL.tiato, '#3a1a3e']].forEach(([lx, a, c0, c1]) => leaf(lx, 0, a, 52, 20, c0, c1, true));
    } else if (kind === 'starfruit') {
      const p = new Path2D(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? 16 : 34; i ? p.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : p.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } p.closePath();
      ctx.fillStyle = rgr(ctx, 0, 0, 2, 0, 0, 36, [[0, '#fffbd0'], [1, COL.star]]); ctx.fill(p); ctx.strokeStyle = '#9aa83a'; ctx.lineWidth = 2.4; ctx.stroke(p);
      ctx.strokeStyle = 'rgba(160,170,60,0.5)'; ctx.lineWidth = 1.2; for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.stroke(); }
      ctx.fillStyle = '#7a5a30'; for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; ell(ctx, Math.cos(a) * 9, Math.sin(a) * 9, 2.4, 1.4, a); ctx.fill(); }
    } else if (kind === 'banana' || kind === 'cucumber') {
      const ban = kind === 'banana';
      ell(ctx, 0, 0, 30, 30); ctx.fillStyle = ban ? '#5a7a2e' : '#2f7a34'; ctx.fill();
      ell(ctx, 0, 0, 26, 26); ctx.fillStyle = rgr(ctx, 0, 0, 2, 0, 0, 26, ban ? [[0, '#f4f0cf'], [1, COL.banana]] : [[0, '#eef8c8'], [1, COL.cucumber]]); ctx.fill();
      ctx.fillStyle = ban ? 'rgba(60,40,30,0.6)' : 'rgba(220,240,180,0.9)';
      for (let i = 0; i < (ban ? 9 : 6); i++) { const a = i / (ban ? 9 : 6) * TAU; ell(ctx, Math.cos(a) * (ban ? 8 : 11), Math.sin(a) * (ban ? 8 : 11), ban ? 1.6 : 3, ban ? 1.6 : 1.8, a); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -9, -10, 8, 4, -0.6); ctx.fill();
    } else { // carrot / daikon julienne
      const c = kind === 'carrot' ? COL.carrot : COL.daikon, r = rng(kind === 'carrot' ? 5 : 9);
      for (let i = 0; i < 7; i++) { const yy = (r() - 0.5) * 22, a = (r() - 0.5) * 0.3; capFS(ctx, -40 + r() * 10, yy, 40 - r() * 10, yy + a * 40, 5, 5, c, 0.8, 'rgba(120,60,20,0.4)'); }
    }
  });
}
const lettuce = (ctx, x, y, s, rot) => herb(ctx, 'lettuce', x, y, s, rot);
const basil = (ctx, x, y, s, rot) => herb(ctx, 'basil', x, y, s, rot);
const diepca = (ctx, x, y, s, rot) => herb(ctx, 'diepca', x, y, s, rot);
const tiato = (ctx, x, y, s, rot) => herb(ctx, 'tiato', x, y, s, rot);
const starfruit = (ctx, x, y, s, rot) => herb(ctx, 'starfruit', x, y, s, rot);
const banana = (ctx, x, y, s, rot) => herb(ctx, 'banana', x, y, s, rot);
const cucumber = (ctx, x, y, s, rot) => herb(ctx, 'cucumber', x, y, s, rot);
const carrot = (ctx, x, y, s, rot) => herb(ctx, 'carrot', x, y, s, rot);
const daikon = (ctx, x, y, s, rot) => herb(ctx, 'daikon', x, y, s, rot);

// ---- rổ rau (bamboo basket heaped with herbs). origin = centre, R=150, o.ry 0.5. Cached sprite when small.
const _basketCache = new Map();
function herbBasketLive(ctx, ry, seed) {
  const R = 150;
  ctx.beginPath(); ctx.ellipse(0, 0, R, R * ry, 0, 0, PI); ctx.lineTo(-R * 0.8, R * ry * 0.4 + 46); ctx.ellipse(0, 46, R * 0.8, R * ry * 0.7, 0, PI, 0, true); ctx.closePath();
  ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#e6c582'], [0.5, '#b88e4a'], [1, '#6e532a']]); ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(90,60,25,0.5)'; ctx.lineWidth = 2;
  for (let i = -20; i < 20; i++) { ctx.beginPath(); ctx.moveTo(i * 12, 0); ctx.lineTo(i * 12 + 30, 120); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i * 12 + 30, 0); ctx.lineTo(i * 12, 120); ctx.stroke(); }
  ctx.restore();
  const r = rng(seed), kinds = ['lettuce', 'lettuce', 'basil', 'tiato', 'diepca', 'lettuce', 'basil'];
  for (let i = 0; i < 22; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * R * 0.82; const kd = kinds[(r() * kinds.length) | 0]; herb(ctx, kd, Math.cos(a) * rr, Math.sin(a) * rr * ry - 18 - (1 - rr / R) * 26, 0.75 + r() * 0.3, r() * TAU); }
  ctx.strokeStyle = '#8a6430'; ctx.lineWidth = 9; ell(ctx, 0, 0, R, R * ry); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,160,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, -2, R, R * ry, 0, PI * 0.95, PI * 1.6); ctx.stroke();
}
function herbBasket(ctx, x, y, s = 1, o = {}) {
  const ry = o.ry ?? 0.5, seed = o.seed ?? 4;
  at(ctx, x, y, 0, s, s, () => {
    const m = ctx.getTransform(), eff = Math.hypot(m.a, m.b);
    if (o.cache === false || eff > 1.3) { herbBasketLive(ctx, ry, seed); return; }
    const key = `${ry}|${seed}`, CS = 1.3;
    let spr = _basketCache.get(key);
    if (!spr) { const [c, x2] = canvas(380 * CS, 300 * CS); x2.scale(CS, CS); x2.translate(190, 120); herbBasketLive(x2, ry, seed); spr = c; _basketCache.set(key, c); }
    ctx.drawImage(spr, -190, -120, 380, 300);
  });
}

// ---- bánh tráng ram (fried crisp roll), 150×30, along +x. o.snap 0..1
function ramRoll(ctx, x, y, s = 1, rot = 0, o = {}) {
  const snap = clamp(o.snap || 0), seed = o.seed ?? 6, t = o.t || 0;
  const half = (x0, x1, endL, endR) => {
    ctx.beginPath(); ctx.roundRect(x0, -15, x1 - x0, 30, [endL ? 15 : 3, endR ? 15 : 3, endR ? 15 : 3, endL ? 15 : 3]);
    ctx.fillStyle = lgr(ctx, 0, -15, 0, 15, [[0, '#ffd27a'], [0.45, '#e09a3a'], [1, '#9a5a1e']]); ctx.fill(); ctx.strokeStyle = 'rgba(90,45,15,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save(); ctx.clip(); const r = rng(seed + x0 | 0);
    for (let i = 0; i < 18; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,236,170,0.7)' : 'rgba(150,80,25,0.4)'; ell(ctx, lerp(x0, x1, r()), (r() - 0.5) * 24, 2 + r() * 3, 1.5 + r() * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(140,70,20,0.45)'; ctx.lineWidth = 1.2; for (let xx = x0 + 10; xx < x1; xx += 14) { ctx.beginPath(); ctx.moveTo(xx, -15); ctx.quadraticCurveTo(xx + 5, 0, xx - 2, 15); ctx.stroke(); }
    ctx.restore();
    if (!endR) { // jagged broken face with spiral layers
      ctx.fillStyle = '#f2c066'; ell(ctx, x1, 0, 6, 14); ctx.fill(); ctx.strokeStyle = 'rgba(140,70,20,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x1, 0, 3, 8, 0, 0, TAU); ctx.stroke();
    }
  };
  at(ctx, x, y, rot, s, s, () => {
    if (snap < 0.02) { half(-75, 75, true, true); return; }
    const e = ease.out(snap);
    at(ctx, -e * 14, e * 4, -e * 0.35, 1, 1, () => half(-75, 0, true, false));
    at(ctx, e * 14, e * 4, e * 0.35, -1, 1, () => half(-75, 0, true, false));
    const r = rng(seed + 50);
    for (let i = 0; i < 14; i++) { const vx = (r() - 0.5) * 220, vy = -60 - r() * 160, tt = snap * 0.6; ctx.fillStyle = r() < 0.5 ? '#f2c066' : '#c9822c'; ell(ctx, vx * tt, vy * tt + 400 * tt * tt, 2 + r() * 2.5, 1.5 + r() * 1.5, r() * 3); ctx.fill(); }
    void t;
  });
}

// ---- roll body shared by nemRoll / giantRoll. Drawn at origin, length L, height Hh. bite 0..1 at +x end.
function rollShape(ctx, L, Hh, bite) {
  const r = Hh / 2, bx = L / 2 - bite * L * 0.42;
  ctx.beginPath();
  ctx.moveTo(-L / 2 + r, -r); ctx.lineTo(bx - (bite > 0 ? 0 : r), -r);
  if (bite > 0) { // scalloped bite edge (3 tooth arcs)
    const n = 3; for (let i = 0; i < n; i++) { const y0 = -r + i * Hh / n, y1 = y0 + Hh / n; ctx.quadraticCurveTo(bx - Hh * 0.22, (y0 + y1) / 2, bx + (i % 2 ? 4 : -2), y1); }
  } else ctx.arc(bx - r, 0, r, -PI / 2, PI / 2);
  ctx.lineTo(-L / 2 + r, r); ctx.arc(-L / 2 + r, 0, r, PI / 2, PI * 1.5); ctx.closePath();
  return bx;
}
function drawRollBody(ctx, L, Hh, o) {
  const bite = clamp(o.bite || 0), seed = o.seed ?? 8, r = Hh / 2;
  const bx = rollShape(ctx, L, Hh, bite);
  ctx.save(); ctx.clip();
  // contents seen through the translucent paper: lettuce base, purple tía tô, herbs, carrot, nem, ram
  ctx.fillStyle = '#9fcf5a'; ctx.fillRect(-L / 2, -r, L, Hh);
  const R = rng(seed), k = Hh / 86;
  const band = (y0, h, col, wob) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-L / 2, y0); for (let xx = -L / 2; xx <= L / 2; xx += 18 * k) ctx.lineTo(xx, y0 + Math.sin(xx * 0.08 / k + wob) * 5 * k); for (let xx = L / 2; xx >= -L / 2; xx -= 18 * k) ctx.lineTo(xx, y0 + h + Math.sin(xx * 0.07 / k + wob * 2) * 5 * k); ctx.closePath(); ctx.fill(); };
  band(-r, Hh * 0.28, '#6fb04a', 1);
  band(-r * 0.55, Hh * 0.22, mixc(COL.tiato, '#ffffff', 0.15), 2);
  band(-r * 0.15, Hh * 0.3, mixc(COL.nemCooked, '#000000', 0.08), 3);
  band(r * 0.35, Hh * 0.2, '#e9b45a', 4);
  band(r * 0.62, Hh * 0.3, '#8fc75a', 5);
  for (let i = 0; i < L / (12 * k); i++) { ctx.fillStyle = [COL.carrot, '#f5f2e6', '#3f8f3a', COL.star][(R() * 4) | 0]; ell(ctx, (R() - 0.5) * L, (R() - 0.5) * Hh * 0.9, (5 + R() * 9) * k, (2 + R() * 3) * k, (R() - 0.5) * 0.6); ctx.fill(); }
  ctx.fillStyle = 'rgba(80,25,10,0.5)'; for (let i = 0; i < L / (30 * k); i++) { ell(ctx, (R() - 0.5) * L, -r * 0.15 + Hh * 0.15 + (R() - 0.5) * 8 * k, 6 * k, 3 * k); ctx.fill(); }
  // paper: milky translucent layer, thicker at the top/bottom edges, wrinkles, gloss
  ctx.fillStyle = lgr(ctx, 0, -r, 0, r, [[0, 'rgba(250,246,236,0.75)'], [0.25, 'rgba(250,246,236,0.32)'], [0.7, 'rgba(250,246,236,0.28)'], [1, 'rgba(235,228,215,0.8)']]); ctx.fillRect(-L / 2, -r, L, Hh);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.6 * k;
  for (let i = 0; i < 9; i++) { const xx = (R() - 0.5) * L; ctx.beginPath(); ctx.moveTo(xx, -r); ctx.quadraticCurveTo(xx + (R() - 0.5) * 20 * k, 0, xx + (R() - 0.5) * 30 * k, r); ctx.stroke(); }
  ctx.fillStyle = lgr(ctx, -L / 2, 0, -L / 2 + Hh * 0.7, 0, [[0, 'rgba(245,240,228,0.85)'], [1, 'rgba(245,240,228,0)']]); ctx.fillRect(-L / 2, -r, Hh * 0.7, Hh);
  if (bite > 0) { // exposed cross-section at the bite
    ctx.fillStyle = 'rgba(250,246,236,0.6)'; ctx.fillRect(bx - Hh * 0.3, -r, Hh * 0.3, Hh);
    ell(ctx, bx - Hh * 0.12, -r * 0.1, Hh * 0.1, Hh * 0.18); ctx.fillStyle = COL.nemCooked; ctx.fill();
    ell(ctx, bx - Hh * 0.08, r * 0.5, Hh * 0.08, Hh * 0.1); ctx.fillStyle = '#e9b45a'; ctx.fill();
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(255,245,225,0.75)'; ctx.lineWidth = 5 * k; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-L / 2 + r, -r * 0.62); ctx.lineTo(bx - r * 0.8, -r * 0.62); ctx.stroke();
  ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(-L / 2 + r * 1.4, -r * 0.4); ctx.lineTo(-L / 2 + L * 0.4, -r * 0.4); ctx.stroke();
  ctx.restore();
  rollShape(ctx, L, Hh, bite); ctx.strokeStyle = 'rgba(150,130,110,0.6)'; ctx.lineWidth = 2 * k; ctx.stroke();
  rimLine(ctx, () => { ctx.moveTo(-L / 2 + r, -r + 1); ctx.lineTo(bx - r, -r + 1); }, 'rgba(255,215,160,0.9)', 3 * k);
  // paper seam spiral on the left end
  ctx.strokeStyle = 'rgba(200,190,170,0.6)'; ctx.lineWidth = 1.5 * k; ctx.beginPath(); ctx.arc(-L / 2 + r, 0, r * 0.7, PI * 0.6, PI * 1.4); ctx.stroke();
  if (o.tie) { // hẹ (garlic chive) tie
    const tx = -L * 0.05;
    ctx.strokeStyle = '#3f8a2e'; ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(tx - 4 * k, -r); ctx.quadraticCurveTo(tx + 6 * k, 0, tx - 2 * k, r); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,255,160,0.6)'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(tx - 4 * k, -r); ctx.quadraticCurveTo(tx + 5 * k, 0, tx - 2 * k, r); ctx.stroke();
    ctx.strokeStyle = '#3f8a2e'; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.moveTo(tx - 4 * k, -r); ctx.quadraticCurveTo(tx - 16 * k, -r - 16 * k, tx - 4 * k, -r - 26 * k); ctx.moveTo(tx - 4 * k, -r); ctx.quadraticCurveTo(tx + 12 * k, -r - 12 * k, tx + 20 * k, -r - 6 * k); ctx.stroke();
  }
}
// ---- finished nem roll (cuốn), side view 270×86 along +x. o.bite 0..1, o.tie (chive tie on top for hanging)
function nemRoll(ctx, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = 'rgba(20,10,15,0.18)'; ell(ctx, 4, 46, 130, 8); ctx.fill();
    drawRollBody(ctx, 270, 86, o);
  });
}
// ---- giant roll (burrito-size gag roll), 600×210. o.bite 0..1, o.t steam, o.tie
function giantRoll(ctx, x, y, s = 1, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    drawRollBody(ctx, 600, 210, Object.assign({ seed: 12 }, o));
    if (o.steam !== false && o.t !== undefined) steamWisps(ctx, o.t, 31, -200, -110, 400, 260, { n: 4, alpha: 0.35, w: 18 });
  });
}
// ---- cross-section of a cut roll: oval face 120 wide at origin, body extends to +x (o.len 160). o.backlight 0..1
function nemRollCut(ctx, x, y, s = 1, o = {}) {
  const len = o.len ?? 160, bl = clamp(o.backlight ?? 0.5);
  at(ctx, x, y, o.rot || 0, s, s, () => {
    // body behind the face
    ctx.save(); ctx.translate(len / 2, 0); drawRollBody(ctx, len + 40, 100, { seed: o.seed ?? 14 }); ctx.restore();
    // cut face
    ell(ctx, 0, 0, 52, 52); ctx.fillStyle = 'rgba(248,244,232,0.95)'; ctx.fill();
    ell(ctx, 0, 0, 46, 46); ctx.fillStyle = '#8cc757'; ctx.fill();
    ctx.save(); ell(ctx, 0, 0, 46, 46); ctx.clip();
    ell(ctx, -6, -6, 36, 30); ctx.fillStyle = '#5ea442'; ctx.fill();
    ell(ctx, 2, -14, 18, 12); ctx.fillStyle = COL.nemCooked; ctx.fill(); ctx.strokeStyle = 'rgba(60,20,8,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(40,14,6,0.5)'; ctx.fillRect(-6, -20, 4, 12);
    ell(ctx, 10, 16, 13, 13); ctx.fillStyle = '#e9b45a'; ctx.fill(); ctx.strokeStyle = 'rgba(150,80,20,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(10, 16, 7, 0, PI * 1.6); ctx.stroke();
    const r = rng(41);
    for (let i = 0; i < 16; i++) { ctx.fillStyle = [COL.carrot, '#f5f2e6', COL.tiato, COL.star][(r() * 4) | 0]; ell(ctx, (r() - 0.5) * 76, (r() - 0.5) * 76, 3 + r() * 4, 2 + r() * 2, r() * 3); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 49, 0, TAU); ctx.stroke();
    if (bl > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 52, PI * 0.9, PI * 1.8); for (const [lw, al] of [[11, 0.25], [7, 0.35], [3, 0.5]]) { ctx.strokeStyle = `rgba(255,220,160,${al * bl})`; ctx.lineWidth = lw; ctx.stroke(); }
      ctx.restore();
      glow(ctx, -20, -30, 60, 'rgba(255,200,130,1)', 0.3 * bl);
    }
  });
}

// ---- top-down roll assembly on wet rice paper (shots 11–15). origin = paper centre.
function rollAssembly(ctx, x, y, s = 1, o = {}) {
  const layers = clamp(o.layers ?? 6, 0, 6), roll = clamp(o.roll || 0), t = o.t || 0, slide = clamp(o.slide ?? 1);
  const f1 = clamp(roll / 0.35), f2 = clamp((roll - 0.35) / 0.2), f3 = clamp((roll - 0.55) / 0.45);
  const L0 = Math.floor(layers), frac = layers - L0;
  const BY = 52; // filling band centre (lower third)
  const drawLayer = (i) => {
    if (i === 1) { herb(ctx, 'lettuce', -40, BY, 1.0, 0.05); herb(ctx, 'lettuce', 40, BY + 4, 0.95, -0.08); }
    else if (i === 2) { herb(ctx, 'basil', -60, BY - 8, 0.8, 0.1); herb(ctx, 'diepca', 0, BY - 12, 0.9, -0.1); herb(ctx, 'tiato', 60, BY - 6, 0.8, 0.15); }
    else if (i === 3) { for (let k = 0; k < 3; k++) herb(ctx, 'starfruit', -80 + k * 30, BY + 10, 0.5, k); for (let k = 0; k < 2; k++) herb(ctx, 'banana', 20 + k * 30, BY + 14, 0.55, 0); herb(ctx, 'cucumber', 80, BY + 10, 0.55, 0); }
    else if (i === 4) { herb(ctx, 'carrot', -50, BY - 2, 0.8, 0.05); herb(ctx, 'daikon', 50, BY, 0.8, -0.05); ramRoll(ctx, 0, BY + 18, 0.9, 0.03, { seed: 3 }); }
    else if (i === 5) {
      const mx = 0, my = BY - 4;
            nemSkewer(ctx, mx, my, 0.9, { cook: 0.9, stick: 0.01, t, seed: 21, drip: false });
      if (slide < 1) { const sx2 = lerp(0, 330, ease.in(slide)); capFS(ctx, -160 * 0.9 + sx2, my, 160 * 0.9 + sx2, my, 6, 5, COL.bamboo, 1.2); }
      steamWisps(ctx, t, 7, -60, my - 10, 120, 140, { n: 3, alpha: 0.35, w: 10 });
    }
  };
  at(ctx, x, y, o.rot || 0, s, s, () => {
    const R = 170, foldY = 100;
    if (f3 >= 1) { nemRoll(ctx, 0, -40, 0.85, 0, { seed: 9 }); return; }
    const rollY = lerp(BY, -R + 40, ease.inOut(f3)); // roll front travels up
    const sideX = lerp(R + 5, 112, ease.inOut(f2));
    ctx.save();
    ctx.beginPath(); ctx.rect(-sideX, -R - 10, sideX * 2, (f3 > 0 ? rollY - 30 : 400) + R + 10); ctx.clip();
    if (f1 > 0) { ctx.beginPath(); ctx.rect(-300, -300, 600, 300 + foldY); ctx.clip(); }
    ricePaper(ctx, 0, 0, 1, { wet: o.wet ?? 1 });
    ctx.restore();
    if (f3 === 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(-sideX, -300, sideX * 2, 600); ctx.clip();
      for (let i = 1; i <= Math.min(L0, 5); i++) drawLayer(i);
      if (frac > 0 && L0 < 5) { const e = ease.out(frac); ctx.save(); ctx.globalAlpha = clamp(frac * 2); ctx.translate(0, -(1 - e) * 260); const sc = 1 + (1 - e) * 0.25; ctx.translate(0, BY); ctx.scale(sc, sc); ctx.translate(0, -BY); drawLayer(L0 + 1); ctx.restore(); }
      ctx.restore();
    }
    if (f1 > 0 && f3 === 0) { // bottom flap folding up over the filling (mirrors about the fold line)
      const c = Math.cos(f1 * PI), h = (R - foldY + 6);
      ctx.save(); ctx.translate(0, foldY); ctx.scale(1, c); ctx.translate(0, -foldY);
      ctx.beginPath(); ctx.rect(-sideX, foldY, sideX * 2, h + 10); ctx.clip();
      ctx.globalAlpha = 0.85; ricePaper(ctx, 0, 0, 1, { wet: 1 }); ctx.restore();
      ctx.strokeStyle = 'rgba(255,250,235,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-sideX + 4, foldY); ctx.lineTo(sideX - 4, foldY); ctx.stroke();
    }
    if (f2 > 0) { // side flaps: circle segments beyond ±sideX mirrored inward; straight fold edges
      const cutY = f3 > 0 ? rollY - 30 : foldY + 4, yl = -Math.sqrt(Math.max(0, R * R - sideX * sideX));
      ctx.save(); ctx.beginPath(); ctx.rect(-R - 20, -R - 20, 2 * R + 40, cutY + R + 20); ctx.clip();
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sx * sideX, yl);
        for (let i = 0; i <= 24; i++) { const yy = lerp(yl, foldY + 4, i / 24), cx2 = Math.sqrt(Math.max(0, R * R - yy * yy)); ctx.lineTo(sx * Math.min(sideX, 2 * sideX - Math.max(sideX, cx2)), yy); }
        ctx.lineTo(sx * sideX, foldY + 4); ctx.closePath();
        ctx.fillStyle = 'rgba(244,240,228,0.62)'; ctx.fill();
        ctx.strokeStyle = 'rgba(170,150,120,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = lgr(ctx, sx * sideX, 0, sx * (sideX - 26), 0, [[0, 'rgba(120,100,80,0.18)'], [1, 'rgba(120,100,80,0)']]); ctx.fillRect(Math.min(sx * sideX, sx * (sideX - 26)), yl, 26, foldY + 4 - yl);
        ctx.strokeStyle = 'rgba(255,250,235,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx * sideX, yl + 6); ctx.lineTo(sx * sideX, foldY + 4); ctx.stroke();
      }
      ctx.restore();
    }
    if (f3 > 0) nemRoll(ctx, 0, rollY, lerp(0.78, 0.85, f3), 0, { seed: 9 });
  });
}

// ---- tương chấm (thick orange nem dipping sauce) in a small bowl. origin = rim centre, R=110, ry .42
function sauceBowl(ctx, x, y, s = 1, o = {}) {
  const R = 110, ry = 0.42, fill = clamp(o.fill ?? 0.8), t = o.t || 0, sl = o.slosh || 0;
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(20,10,15,0.3)'; ell(ctx, 4, 80, 90, 16); ctx.fill();
    // bowl body
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * ry, 0, 0, PI); ctx.bezierCurveTo(-R, 60, -60, 82, -44, 84); ctx.lineTo(44, 84); ctx.bezierCurveTo(60, 82, R, 60, R, 0); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#ffffff'], [0.4, '#e9edf0'], [1, '#8f9aa6']]); ctx.fill(); ctx.strokeStyle = 'rgba(60,70,90,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(40,90,170,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 22, R * 0.96, R * ry * 0.9, 0, 0.15, PI - 0.15); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 30, R * 0.92, R * ry * 0.86, 0, 0.2, PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(40,90,170,0.6)'; for (let i = 0; i < 5; i++) { const a = 0.4 + i * 0.58; ell(ctx, Math.cos(a) * R * 0.85, 46 + Math.sin(a) * 10, 5, 3); ctx.fill(); }
    // rim + inside
    ell(ctx, 0, 0, R, R * ry); ctx.fillStyle = '#f4f6f8'; ctx.fill(); ctx.strokeStyle = 'rgba(60,70,90,0.5)'; ctx.stroke();
    ell(ctx, 0, 2, R - 8, (R - 8) * ry); ctx.fillStyle = lgr(ctx, 0, -40, 0, 40, [[0, '#9aa6b2'], [1, '#e6eaee']]); ctx.fill();
    if (fill > 0) {
      const sr = (R - 10) * (0.7 + 0.3 * fill), sy = (1 - fill) * 26 + 4, tilt = sl * Math.sin(t * 6);
      ctx.save(); ell(ctx, 0, 2, R - 8, (R - 8) * ry); ctx.clip();
      ctx.beginPath(); ctx.ellipse(0, sy, sr, sr * ry, tilt * 0.15, 0, TAU);
      ctx.fillStyle = rgr(ctx, -20, sy - 10, 4, 0, sy, sr, [[0, COL.sauceL], [0.55, COL.sauce], [1, COL.sauceD]]); ctx.fill();
      ctx.save(); ctx.clip();
      const r = rng(o.seed ?? 3);
      if (o.scallionOil) { for (let i = 0; i < 14 * o.scallionOil; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * sr * 0.8; ctx.strokeStyle = '#4a9a3a'; ctx.lineWidth = 2.5; ell(ctx, Math.cos(a) * rr, sy + Math.sin(a) * rr * ry, 4, 2.6); ctx.stroke(); } ctx.fillStyle = 'rgba(255,220,80,0.25)'; ell(ctx, 10, sy, sr * 0.6, sr * ry * 0.5); ctx.fill(); }
      if (o.peanuts) for (let i = 0; i < 26 * o.peanuts; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * sr * 0.75; ctx.fillStyle = r() < 0.5 ? '#e9cf9a' : '#c79a5a'; ell(ctx, Math.cos(a) * rr, sy + Math.sin(a) * rr * ry, 3 + r() * 3, 2 + r() * 2, r() * 3); ctx.fill(); }
      if (o.chiliGarlic) for (let i = 0; i < 18 * o.chiliGarlic; i++) { const a = r() * TAU, rr = Math.sqrt(r()) * sr * 0.75; ctx.fillStyle = r() < 0.6 ? '#d1281e' : '#f6f0dc'; ell(ctx, Math.cos(a) * rr, sy + Math.sin(a) * rr * ry, 2.6, 1.8, r() * 3); ctx.fill(); }
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,230,190,0.55)'; ell(ctx, -sr * 0.35 + tilt * 10, sy - sr * ry * 0.4, sr * 0.3, sr * ry * 0.14, -0.1); ctx.fill();
      ctx.restore(); ctx.restore();
    }
    rimLine(ctx, () => ctx.ellipse(0, 0, R, R * ry, 0, PI * 0.95, PI * 1.6), 'rgba(255,225,190,0.95)', 3);
  });
}

// ---- viscous sauce ribbon (x0,y0) → (x1,y1). o.w 22, o.k reach 0..1
function sauceStream(ctx, x0, y0, x1, y1, t = 0, o = {}) {
  const k = clamp(o.k ?? 1), w = o.w ?? 22;
  if (k <= 0) return;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24 * k, wob = Math.sin(t * 5 + u * 9) * 6 * u;
    const bx = lerp(x0, x1, u * u * 0.4 + u * 0.6) + wob, by = lerp(y0, y1, u * u * 0.3 + u * 0.7) * 1;
    pts.push([bx, by]);
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
  for (let pass = 0; pass < 3; pass++) {
    path();
    ctx.strokeStyle = pass === 0 ? COL.sauceD : pass === 1 ? COL.sauce : 'rgba(255,225,170,0.7)';
    ctx.lineWidth = pass === 0 ? w + 3 : pass === 1 ? w : w * 0.22;
    if (pass === 2) ctx.translate(-w * 0.22, 0);
    ctx.stroke();
  }
  ctx.restore();
  const e = pts[pts.length - 1];
  ell(ctx, e[0], e[1], w * 0.62, w * 0.72); ctx.fillStyle = COL.sauce; ctx.fill();
  if (k >= 1) { ctx.fillStyle = COL.sauce; ell(ctx, x1, y1 + w * 0.3, w * 1.4, w * 0.5); ctx.fill(); ctx.fillStyle = 'rgba(255,225,170,0.6)'; ell(ctx, x1 - w * 0.4, y1, w * 0.5, w * 0.16); ctx.fill(); }
}

// ---- falling toppings from (x,y) since t0. o.kind 'peanut'|'scallion'|'chili'|'mix', o.w spread (120), o.g (1400), o.floor
function toppingFall(ctx, t, t0, seed, n, x, y, o = {}) {
  const age = t - t0; if (age < 0) return;
  const r = rng(seed), g = o.g ?? 1400, wd = o.w ?? 120, floor = o.floor ?? Infinity, kinds = ['peanut', 'scallion', 'chili'];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const kd = o.kind && o.kind !== 'mix' ? o.kind : kinds[(r() * 3) | 0];
    const dl = r() * (o.spread ?? 0.4), ox = (r() - 0.5) * wd, vx = (r() - 0.5) * 120, vy = r() * 80, rr = r() * TAU, sp = (r() - 0.5) * 12, sz = (o.size ?? 1) * (0.8 + r() * 0.5);
    const a = age - dl; if (a < 0) continue;
    let px = x + ox + vx * a, py = y + vy * a + 0.5 * g * a * a;
    if (py > floor) py = floor - r() * 6;
    at(ctx, px, py, rr + sp * a, sz, sz, () => {
      if (kd === 'peanut') { ctx.fillStyle = r() < 0.5 ? '#ecd29c' : '#c99a58'; ctx.beginPath(); ctx.moveTo(-6, -3); ctx.lineTo(5, -5); ctx.lineTo(6, 4); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(110,70,30,0.6)'; ctx.lineWidth = 1; ctx.stroke(); }
      else if (kd === 'scallion') { ctx.strokeStyle = '#3f9a36'; ctx.lineWidth = 3; ell(ctx, 0, 0, 6, 4); ctx.stroke(); ctx.fillStyle = 'rgba(210,255,170,0.6)'; ell(ctx, 0, 0, 3, 2); ctx.fill(); }
      else { ctx.fillStyle = r() < 0.7 ? '#d1281e' : '#f3eedb'; ell(ctx, 0, 0, 4, 2.4); ctx.fill(); }
    });
  }
  ctx.restore();
}

// ================================================================================================ EFFECTS
// ---- charcoal smoke ribbon along pts (catmull smoothed). o.k head travel 0..1, o.w 40, o.alpha, o.warm, o.seed
function smoke(ctx, t, pts, o = {}) {
  const k = clamp(o.k ?? 1), w = o.w ?? 40, al = o.alpha ?? 0.6, warm = clamp(o.warm ?? 0.6), seed = o.seed ?? 1;
  const sp = smoothPts(pts, 10), N = sp.length, last = Math.max(1, Math.floor((N - 1) * k));
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i <= last; i++) {
    const u = i / (N - 1), p = sp[i], fade = Math.min(1, (last - i) / 6 + 0.25) * Math.sin(Math.min(1, u * 3 + 0.15) * PI / 2);
    const ww = w * (0.5 + u * 1.6) * (0.85 + 0.3 * Math.sin(t * 3 + i * 0.7 + seed));
    const ox = Math.sin(t * 1.7 + i * 0.45 + seed) * ww * 0.35, oy = Math.cos(t * 1.3 + i * 0.5) * ww * 0.2;
    const cx = p[0] + ox, cy = p[1] + oy;
    const col = mixc('#8d93a6', '#ffcf9a', warm * (0.4 + 0.6 * Math.sin(u * PI)));
    const A = hx(col);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ww);
    g.addColorStop(0, `rgba(${A[0]},${A[1]},${A[2]},${al * fade * 0.55})`); g.addColorStop(1, `rgba(${A[0]},${A[1]},${A[2]},0)`);
    ctx.fillStyle = g; ctx.fillRect(cx - ww, cy - ww, ww * 2, ww * 2);
    void r;
  }
  // soft sunlit core: small warm screen-blended puffs (no hard stroke spine)
  if (warm > 0) {
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i <= last; i += 2) {
      const u = i / (N - 1), p = sp[i], fade = Math.min(1, (last - i) / 6 + 0.2) * Math.sin(Math.min(1, u * 3 + 0.15) * PI / 2) * Math.sin(Math.min(1, u * 1.4 + 0.2) * PI);
      const ww = w * (0.35 + u * 0.7), cx = p[0] + Math.sin(t * 1.7 + i * 0.45 + seed) * w * 0.3, cy = p[1];
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ww);
      g.addColorStop(0, `rgba(255,214,170,${al * warm * 0.22 * fade})`); g.addColorStop(1, 'rgba(255,214,170,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - ww, cy - ww, ww * 2, ww * 2);
    }
  }
  ctx.restore();
}

// ---- rising sparks from rect (x,y,w,h). o.alpha, o.speed, o.size, o.rise (distance, 260)
function embers(ctx, t, seed, n, x, y, w, h, o = {}) {
  const r = rng(seed), al = o.alpha ?? 1, sp = o.speed ?? 1, sz = o.size ?? 1, rise = o.rise ?? 260;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ph = r(), per = 1.2 + r() * 1.2, bx = x + r() * w, by = y + r() * h, dr = (r() - 0.5) * 60;
    const life = ((t * sp) / per + ph) % 1;
    const px = bx + dr * life + Math.sin(t * 4 + i) * 8 * life, py = by - rise * life;
    const a = al * Math.sin(life * PI) * (0.6 + 0.4 * Math.sin(t * 20 + i * 3));
    const rr = (1.6 + r() * 2) * sz * (1 - life * 0.5);
    ctx.fillStyle = `rgba(255,${150 + (r() * 80 | 0)},60,${a})`; ell(ctx, px, py, rr, rr); ctx.fill();
    ctx.strokeStyle = `rgba(255,120,40,${a * 0.5})`; ctx.lineWidth = rr; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - dr * 0.08, py + 10 * sz); ctx.stroke();
  }
  ctx.restore();
}

// ---- curling steam wisps rising from base (x..x+w, y) up to y−h. o.n, o.alpha, o.w (stroke width)
function steamWisps(ctx, t, seed, x, y, w, h, o = {}) {
  // thin translucent ribbons: fade in from the base, taper + fade toward the head, soft edges from 3 stacked widths
  const r = rng(seed), n = o.n ?? 5, al = o.alpha ?? 0.45, lw = o.w ?? 14, M = 16;
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const ph = r(), sp = 0.3 + r() * 0.25, bx = x + r() * w, amp = 10 + r() * 20, fq = 2 + r() * 2;
    const life = (t * sp + ph) % 1, head = life * h, tail = Math.max(0, head - h * 0.6), A = al * Math.sin(life * PI);
    if (A < 0.01 || head - tail < 2) continue;
    const P = [];
    for (let j = 0; j <= M; j++) { const d = lerp(tail, head, j / M), px = bx + Math.sin(d / h * fq * PI + t * 1.5 + i) * amp * (d / h + 0.2), py = y - d; P.push([px, py, d]); }
    // one continuous path per layer, alpha ramped along the rise by a vertical gradient (no segment banding)
    ctx.beginPath(); P.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    const y0 = y - tail, y1 = y - head, fin = clamp((head - tail) / (h * 0.25));
    for (const [wm, am] of [[2.2, 0.12], [1.2, 0.22], [0.5, 0.4]]) {
      const a = A * am * fin, g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,246,234,0)'); g.addColorStop(0.3, 'rgba(255,246,234,' + a + ')');
      g.addColorStop(0.6, 'rgba(255,246,234,' + a * 0.8 + ')'); g.addColorStop(1, 'rgba(255,246,234,0)');
      ctx.strokeStyle = g; ctx.lineWidth = lw * wm; ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- fat sizzle at a point: spits, micro sparks, bubbles. o.seed, o.alpha
function sizzle(ctx, t, x, y, s = 1, o = {}) {
  const r = rng(o.seed ?? 5), al = o.alpha ?? 1;
  at(ctx, x, y, 0, s, s, () => {
    ctx.save();
    for (let i = 0; i < 10; i++) { // spits
      const per = 0.35 + r() * 0.3, ph = r(), life = (t / per + ph) % 1, a = -PI / 2 + (r() - 0.5) * 2.2, v = 60 + r() * 80;
      const px = Math.cos(a) * v * life, py = Math.sin(a) * v * life + 120 * life * life;
      ctx.fillStyle = `rgba(255,230,170,${al * (1 - life)})`; ell(ctx, px, py, 2.2, 2.2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const ph = r(), life = (t * 3 + ph) % 1, px = (r() - 0.5) * 50, py = -life * 50; ctx.fillStyle = `rgba(255,170,70,${al * (1 - life) * 0.8})`; ell(ctx, px, py, 1.4, 1.4); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 7; i++) { const ph = r(), life = (t * 2.2 + ph) % 1, px = (r() - 0.5) * 60, rr = 2 + life * 4; ctx.strokeStyle = `rgba(255,240,200,${al * (1 - life) * 0.8})`; ctx.lineWidth = 1.2; ell(ctx, px, (r() - 0.5) * 8, rr, rr * 0.8); ctx.stroke(); }
    ctx.restore();
  });
}

// ---- flavour icons popping out radially: smoky, crunchy, fresh, rich. k 0..1, o.labels (true)
function flavorBurst(ctx, x, y, s = 1, k = 0.5, o = {}) {
  const items = [
    { en: 'SMOKY', vi: 'Thơm khói', col: '#8a8fa3', a: -2.36 }, { en: 'CRUNCHY', vi: 'Giòn rụm', col: '#e5a03a', a: -0.79 },
    { en: 'FRESH', vi: 'Tươi mát', col: '#5fae4a', a: 0.79 }, { en: 'RICH', vi: 'Đậm đà', col: '#e0702a', a: 2.36 },
  ];
  at(ctx, x, y, 0, s, s, () => {
    items.forEach((it, i) => {
      const kk = clamp((k - i * 0.08) / 0.5), e = ease.outBack(kk), fade = k > 0.85 ? clamp((1 - k) / 0.15) : 1;
      if (kk <= 0) return;
      const px = Math.cos(it.a) * 300 * e, py = Math.sin(it.a) * 300 * e;
      ctx.save(); ctx.globalAlpha = fade * clamp(kk * 3);
      // trail
      ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px * 0.35, py * 0.35); ctx.lineTo(px * 0.75, py * 0.75); ctx.stroke();
      at(ctx, px, py, Math.sin(kk * 8) * 0.08 * (1 - kk), Math.max(0.01, e), Math.max(0.01, e), () => {
        glow(ctx, 0, 0, 110, 'rgba(255,200,130,1)', 0.35);
        ell(ctx, 0, 0, 60, 60); ctx.fillStyle = rgr(ctx, -15, -20, 4, 0, 0, 62, [[0, '#fffaf0'], [1, '#f3e2c4']]); ctx.fill(); ctx.strokeStyle = it.col; ctx.lineWidth = 6; ctx.stroke();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (i === 0) { ctx.strokeStyle = it.col; ctx.lineWidth = 8; for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(j * 16, 30); ctx.bezierCurveTo(j * 16 - 14, 10, j * 16 + 14, -6, j * 16, -30); ctx.stroke(); } }
        else if (i === 1) { ramRoll(ctx, 0, 6, 0.55, -0.4, { snap: 0.45, seed: 2 }); ctx.strokeStyle = '#c9541e'; ctx.lineWidth = 4; for (const [a, b] of [[-34, -34], [34, -36], [0, -44]]) { ctx.beginPath(); ctx.moveTo(a * 0.6, b * 0.6); ctx.lineTo(a, b); ctx.stroke(); } }
        else if (i === 2) { herb(ctx, 'basil', 0, 4, 0.75, -0.6); }
        else { ctx.beginPath(); ctx.moveTo(0, -36); ctx.bezierCurveTo(26, -6, 28, 30, 0, 32); ctx.bezierCurveTo(-28, 30, -26, -6, 0, -36); ctx.fillStyle = lgr(ctx, 0, -36, 0, 32, [[0, COL.sauceL], [1, COL.sauceD]]); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ell(ctx, -8, 6, 5, 9, 0.3); ctx.fill(); }
        if (o.labels !== false) {
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.font = '700 34px TitleSerif'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(40,20,20,0.75)'; ctx.strokeText(it.vi, 0, 104); ctx.fillStyle = '#ffe9b8'; ctx.fillText(it.vi, 0, 104);
          ctx.font = '700 24px BodySansBold'; ctx.lineWidth = 6; ctx.strokeText(it.en, 0, 134); ctx.fillStyle = '#ffffff'; ctx.fillText(it.en, 0, 134);
        }
      });
      ctx.restore();
    });
  });
}

// ---- cartoon whoosh arcs + spray streaks. k life 0..1, o.dir +1 = moving right
function waveWhoosh(ctx, x, y, s = 1, k = 0.5, o = {}) {
  const dir = o.dir ?? 1, r = rng(o.seed ?? 3), fade = Math.sin(clamp(k) * PI);
  at(ctx, x, y, 0, s * dir, s, () => {
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const yy = -60 + i * 40, len = 260 - i * 30, off = -k * 120 - i * 30;
      ctx.strokeStyle = `rgba(255,252,240,${0.85 * fade * (1 - i * 0.15)})`; ctx.lineWidth = 10 - i * 2;
      ctx.beginPath(); ctx.moveTo(off, yy); ctx.quadraticCurveTo(off - len * 0.5, yy - 26, off - len, yy + 4); ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const a = -PI * 0.9 + r() * 0.8, v = 120 + r() * 220, px = -40 + Math.cos(a) * v * k, py = Math.sin(a) * v * k + 260 * k * k;
      ctx.strokeStyle = `rgba(230,245,255,${0.8 * fade})`; ctx.lineWidth = 3 + r() * 3;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - Math.cos(a) * 18, py - Math.sin(a) * 18); ctx.stroke();
    }
    ctx.restore();
  });
}

// ================================================================================================ EXPORTS
module.exports = {
  COL, BK, SKIN_U, ITEMS, OUT, U_CO, UT,
  // helpers
  rgba, mixc, lgr, rgr, rrect, capPath, capFS, outFill, mapper, ikPick, ikUp, rimLine, ell, smoothPts, shadeC,
  cHand, cArm, handRot, weave, khanRan, nonLa,
  // environment
  dawnSky, sun, mist, water, ripples, floatingMarket, riverSide, boatWake, bigWave, splash,
  // boats
  ghe, motorBoat, xuongBaLa, coUtBoat, beoPole, fruit, puffs,
  // characters
  coUt, coUtFace, tourist, touristFace, touristFaceOpts, boatman, vendor, crowdBoats, miniHead,
  // food & props
  charcoalStove, grillRack, nemSkewer, nemShaping, handFan, tongs, nemPlate, ricePaper, waterBasin,
  herb, lettuce, basil, diepca, tiato, starfruit, banana, cucumber, carrot, daikon, herbBasket,
  ramRoll, rollAssembly, nemRoll, nemRollCut, giantRoll, sauceBowl, sauceStream, toppingFall,
  // fx
  smoke, embers, steam: steamWisps, steamWisps, sizzle, flavorBurst, waveWhoosh,
};

// @@END@@
