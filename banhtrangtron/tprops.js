// =====================================================================================================
// tprops.js — prop / character / fx library for "Bánh tráng trộn Sài Gòn" (Dish Tales, 1080x1920, 30fps)
// Node + @napi-rs/canvas. Requires ./lib (W,H,TAU,rng,clamp,lerp,ease,at,glow,flare,sparkle,godRays,dust,bokeh),
// ./props (seg, ell, ik, shade), ./people (PEOPLE.face for the tourist), ./pprops (hx, mixc, rgba).
//
// CONVENTIONS
//  * Every drawer is (ctx, x, y, s, ...) with (x,y) = the ORIGIN stated below, in screen px; s = uniform scale.
//    "s=1: ..." gives the drawn size at s=1. rot (where present) is radians about the origin.
//  * All drawers save/restore their own state. Static scenery is cached offscreen on first call (first call is slower,
//    see timings), later calls just blit. Results are deterministic for a given (t, seed).
//  * Characters share one scale: at s=1 Cô Ba ≈ 455 tall, a kid ≈ 350, the tourist ≈ 425, and btCart is 340 wide with its
//    glass top at y≈-287 — so draw cart + people with the SAME s and they fit (a hand at counter height is ≈ y-230*s).
//  * Functions that return points return SCREEN coords (already transformed), ready for text.js labels / particles.
//  * Palette (COL): 4 PM golden backlight — COL.sun/sunHot/amber, teal shadows COL.teal/tealD/tealL, school-yellow
//    COL.wall/wallL/wallD, red phượng COL.phuong/phuongL/phuongD, food colours (rice, sate, sateOil, mango, jerky, squid,
//    egg, yolk, salt, tac, herb, peanut, shallot, tea, mixed, mixedD), steel, glove. Use them for grades / particles.
//
// HELPERS  rrect(ctx,x,y,w,h,r) path · lgr(ctx,x0,y0,x1,y1,[[o,c]..]) / rgr(ctx,x0,y0,r0,x1,y1,r1,stops) gradients ·
//   canvas(w,h)->[cv,ctx] · mapper(ctx)->fn(x,y)->[sx,sy] · rimLine(ctx,pathFn,col,w) warm back-rim stroke ·
//   txt(ctx,s,x,y,font,col,align='center',base='middle') · rot2(a,x,y)->[x,y] · ikPick/ikPickY(ax,ay,bx,by,l1,l2,prefer)
//   -> elbow/knee [x,y] · ribbon(c,len,w,curl,col,edge) · layoutBits(o,n,w,hPile).  SKIN_BA (Cô Ba skin [l,m,d]),
//   KID_SKINS (4 skin triples), KID_LOOKS (6 kid looks: hair/bag colour/bottom/glasses; seed picks one).
//
// ---------------------------------------------------------------------------------------------- ENVIRONMENT
//  saigonAerial(ctx, t, camY=0, o)  full frame. camY 0..1 = drone descent: 0 wide golden-hour city (river bend, dầu
//      trees, rooftops, sun low right), 1 = close over the yellow school gate. o.zoomEnd (2.6).
//      -> {gate:[x,y], z (zoom), horizon (screen y), sun:[x,y]}.  First call ≈130 ms (builds cache), then fast (blits).
//      AER = cache-space constants (CW 1400, CH 2700, HOR 430, GATE [700,2335]).
//  schoolStreet(ctx, t, panX=0, o)  full frame, side-on street in front of the primary school: yellow wall + red trim,
//      teal gate, phượng trees, dầu trunks, power wires, curb, sun upper right. panX 0..1320 (STREET.PAN_MAX) pans the
//      2400-wide street (parallax far/back/front layers). The cart (btCart s=0.95) parks at street x 1660 (visible from
//      panX≈900). Kids/Cô Ba/tourist are NOT drawn here — add them in o.mid (s≈0.9–1.1, feet at y≈1500–1680).
//      o: {gateOpen 0..1 (default 1), sun 0..1 (glow/god rays/dust, default 1), parents (scooter parents along the wall,
//          default true, s=0.78 at y=1445), crowd 0..1 (fraction of those parents shown, default 1), cart (default true;
//          false hides it), petals 0..1 (falling phượng petals), fg (foreground leaves, default true),
//          mid(ctx, ox) callback drawn between the street and the foreground (put characters here), yard(ctx, ox) callback
//          drawn inside the gate opening}
//      -> {ox (=-panX), gate:[x,y] (gate centre bottom), cart:[x,y] (cart origin), sun:[x,y]}.  First ≈250 ms, then ≈7 ms.
//      STREET: {W, PAN_MAX, WALL_TOP 850, WALL_Y 1330, GROUND 1560, CURB 1650, GATE_X 760, GATE_W 420, CART_X 1660,
//          CART_Y 1470, PARENT_Y 1445, ...}. Street x -> screen x = streetX + ox.
//  fallingPetals(ctx, t, seed, n, x0, y0, w, h)  red phượng petals drifting through the rect (screen space).
//  canopy(c, cx, cy, R, o)  painterly leaf mass (o: seed, col [d,m,l], flowers 0..1, n, squash, leaf, sunlit).
//  schoolDrum(ctx, x, y, s, o)  the school's trống trường on its red stand. origin = floor centre; s=1: drum ≈330 wide,
//      centre y≈-250, head faces +x. o: {hit 0..1 (0 stick drawn back, 1 impact + ripple), t, arm (striking arm, true), stick}
//  motorbikeParent(ctx, x, y, s, t=0, o)  parent on a scooter waiting for school out. origin = ground centre, faces +x;
//      s=1: ≈430 long, rider head top ≈-400. o: {flip, seed (look), look -1..1 (head turn), empty (no rider), wave 0..1}
//
// ---------------------------------------------------------------------------------------------- CART + COUNTER
//  btCart(ctx, x, y, s, o)  Cô Ba's stainless glass-top bánh tráng cart, front view. origin = floor centre (between the
//      wheels); s=1: 340 wide, glass top y≈-287, counter -224, sign board top ≈-456 ("BÁNH TRÁNG TRỘN", red/gold),
//      red front panel "CÔ BA · BÁNH TRÁNG · TRÀ TẮC", 8 labelled jars, a stack of rice sheets, quail eggs, trà tắc cups.
//      o: {t, light 0..1 (glass glint + warm rim, default 1), umbrella (big red/white street parasol behind; canopy rim
//          ≈-560*s, apex ≈-700*s, ±280*s wide)}
//      -> {top:[x,y] glass-top centre (work surface), counter:[x,y], sign:[x,y], jars:[[x,y] x8]}.  Cached: ≈1 ms.
//      CART (internal constants), CART_JARS ([fill,label] x8: SA TẾ, MUỐI TÔM, KHÔ BÒ, KHÔ MỰC, TRỨNG CÚT, ĐẬU PHỘNG, ...).
//  counterTop(ctx, t, o)  full-frame close-up background. Default side view: blurred golden school street behind,
//      row of soft-focus jars along the back of a brushed-steel counter; counter surface from y=COUNTER_Y (1180) down.
//      o.top = true: top-down full-frame steel work surface with dappled leaf light (for overhead "assembly" shots);
//      o.board: wooden cutting board centred (top view).  -> {y: 1180, jars:[[x,y] x6]}.  First ≈100 ms, then fast.
//  jar(ctx, x, y, s, o)  glass ingredient jar. origin = bottom centre; s=1: 160 wide x 232 tall.
//      o: {fill 'sate'|'salt'|'jerky'|'squid'|'eggs'|'peanuts'|'shallots'|'mango'|'scallion'|'strips', label (Vietnamese
//          text; '' none), lid (colour), open (no lid, rim visible), level 0..1}  -> {mouth:[x,y], top:[x,y]}. Cached.
//  chiliOilJar(ctx, x, y, s, o)  open SA TẾ jar (o.open=true, label, level, spoon: spoon standing in the oil, handle up).
//  shrimpSaltJar(ctx, x, y, s, o)  MUỐI TÔM jar (orange-pink salt, yellow lid).
//  fillTexture(c, type, x, y, w, h, seed)  paints an ingredient texture into a rect (used by jars/cart/bag).
//
// ---------------------------------------------------------------------------------------------- CHARACTERS
//  coBa(ctx, x, y, s, o)  Cô Ba, the cheerful street vendor: nón lá (purple strap), purple floral áo bà ba, cream apron,
//      hoop earrings, clear plastic gloves. Front view. origin = between the feet; s=1: ≈455 tall to the hat apex
//      (eyes y≈-342, shoulders -282, hips -190, hands at counter height ≈-230 for work poses).
//      o: {pose 'stand'|'snip' (scissors over the counter, k = snip open/close)|'pour' (spoon of sa tế)|'shake' (tied bag
//          swinging from the right hand, left hand on hip; k drives the swing)|'hand' (hands the bag forward)|'thumbs'|
//          'laugh'|'wave', k 0..1, t, expr (face override), flip, items (draw pose props, default true), bag (plasticBag
//          opts), gloves (true), turn -1..1 (face)}
//      -> {head:[x,y], handL, handR, bag:[x,y]|null, face:{x,y,s}}.  ≈6 ms.
//  coBaFace(ctx, x, y, s, o)  close-up head (+ shoulders). origin = between the eyes; head ≈290 wide, chin y≈195,
//      nón lá brim ≈±330. o: {expr 'smile'|'laugh'|'wink'|'talk'|'proud', t, turn -1..1, tilt, blink (auto from t),
//      hat (true), hatTilt, hatRy (brim openness), body (shoulders to y≈600, true), talk 0..1, look [x,y]}
//  nonLa(ctx, part, o)  standalone conical hat in face units (part 'back'|'front'; o: cy, R, ry, ap, strap...).
//  schoolKid(ctx, x, y, s, o)  primary-school kid in white shirt + navy shorts/skirt + coloured backpack, big round head.
//      origin = feet; s=1: ≈350 tall (eyes y≈-292, shoulders -234, hips -150). o: {seed (0..5 → KID_LOOKS: hair, bag,
//      girl/boy, glasses; skin from KID_SKINS), pose 'stand'|'run'|'cheer'|'point'|'clap'|'shake' (bag hangs from the right
//      hand, left fist pumps)|'laugh'|'lookUp'|'eat' (fork to mouth)|'wave', t (gait/animation seconds), k, flip, expr,
//      turn, lean, item ('bag'|null; default bag for shake/eat), bag (plasticBag opts)}
//      -> {head, handL, handR, bag:[x,y]|null, face:{x,y,s}}.
//  kidFace(ctx, x, y, s, o)  kid close-up head. origin = between the eyes; head ≈300 wide, chin y≈165.
//      o: {seed, expr 'smile'|'shout'|'laugh'|'wow'|'chew'|'sour' (pucker)|'spicy' (red cheeks, steam), t, turn, look,
//          blink, sweat 0..1}.  kidLook(seed) returns the look object.
//  touristShake(ctx, x, y, s, o)  the series' blond backpacker (turquoise tee, khaki shorts, sneakers, sunglasses on the
//      head, NO scarf). Front view; face via PEOPLE.face. origin = feet; s=1: ≈425 tall (face origin y≈-385,
//      shoulders -330, hips -200). o: {pose 'stand'|'hold'|'shake' (bag swinging from the right hand, left fist up)|
//          'behindBack'|'overShoulder'|'toss' (k = toss arc; tossH apex px)|'catch'|'eat'|'thumbs', k 0..1, t, flip,
//          glassK 0..1 (0 glasses on head, 1 over eyes), face {PEOPLE.face opts}, bag (plasticBag opts), tossH}
//      -> {head, handL, handR, bag:[x,y,rot]|null, mouth:[x,y], face:{x,y,s}}.
//  cHand(ctx, x, y, s, rot, o)  cartoon hand: wrist at origin, fingers +x, ≈100 long. o: {kind 'open'|'flat'|'wave'|
//      'grip'|'fist'|'pinch'|'point'|'thumb', flip (thumb +y), glove, skin [l,d]}.
//  cArm(ctx, sx,sy, ex,ey, wx,wy, o)  shoulder→elbow→wrist capsule arm (o: wu, wf, skin, sleeve, sleeveTo, cuff).
//  handRot(ex,ey,wx,wy,bias) forearm angle · floral(ctx,unit) áo bà ba pattern fill.
//
// ---------------------------------------------------------------------------------------------- FOOD + TOOLS
//  riceSheet(ctx, x, y, s, rot, o)  one round bánh tráng (rice paper) with woven texture. origin centre; s=1: Ø400.
//      o: {curl 0..1 (foreshorten/bend), alpha, light 0..1 (backlit translucent glow), cut 0..1 (wedge cut off right)}
//  riceSheetStack(ctx, x, y, s, o)  stack; origin bottom centre; s=1: 400 wide, ≈3/sheet. o: {n=20}
//  riceStrips(ctx, x, y, s, o)  cut strips; origin = pile base (or bottom of a falling column). s=1: strip 80x9.
//      o: {n=24, seed, spread, fall (rain mode), t, h (fall height 600), speed, col}
//  scissors(ctx, x, y, s, rot, o)  red-handled kéo. origin = pivot; blades +x (≈225), loops -x (≈135); s=1: 360 long.
//      o: {open 0..1}
//  plasticBag(ctx, x, y, s, o)  ** HERO ** clear bịch nilon of bánh tráng trộn. origin = body centre; s=1: body 230 wide
//      x 280 tall (y -128..140), knot y≈-158, ears to y≈-235. Glossy highlights, crinkles, warm backlit rim.
//      o: {open 0..1 (0 tied; open shows a cylindrical mouth), tied (knot + red rubber band, default !open), fill 0..1,
//          mix 0..1 (0 = white strips / green mango / jerky layers, 1 = fully tossed red-orange), shake 0..1 (slosh +
//          wobble), t, swirl 0..1 (bits flying inside — slow-mo), glow (rim, 1), empty}
//      -> {mouth:[x,y], knot:[x,y], top:[x,y]}.  ≈12 ms.
//  bagMouthTop(ctx, x, y, s, o)  open bag seen from straight above (the "assembly" shot). origin = mouth centre; s=1:
//      plastic ring Ø≈440, contents disc r≈150. o: {layers ['strips','mango','jerky','squid','eggs','sate','salt','tac',
//      'scallion','herbs','peanuts','shallots','toppings'] in add order, lastK 0..1 (pop-in of the newest layer), mix 0..1
//      (cross-fade to tossed), t, spin}.  ≈20 ms with 7 layers (layers cached).
//  greenMango(ctx, x, y, s, rot, o)  xoài xanh; origin centre; s=1: 260 long. o: {peel 0..1, grooves}
//  mangoShreds(ctx, x, y, s, o)  julienned mango pile/rain; s=1: shred 70x4.5. o: {n=36, seed, spread, fall, t, h, speed}
//  grater / peeler(ctx, x, y, s, rot, o)  julienne peeler (orange handle); origin = grip; head +x; s=1: 300 long.
//  beefJerky(ctx, x, y, s, rot, o)  khô bò strip; origin centre; s=1: 140x30. o: {seed}
//  driedSquidShreds(ctx, x, y, s, o)  khô mực shreds pile/rain; s=1: strand 50x5. o: {n=30, seed, spread, fall, t, h,
//      speed, jerky 0..1 (mix in jerky)}
//  quailEgg(ctx, x, y, s, o)  trứng cút; origin centre; s=1: 54x70. o: {peel 0..1 (speckled → white), half (yolk), rot}
//  spoon(ctx, x, y, s, rot, o)  steel spoon; origin = bowl centre, handle toward -x; s=1: 240 long, bowl 74x48.
//      o: {fill 'sate'|'scallion'|'salt'|null, tip 0..1 (contents poured out), drip}
//  pourStream(ctx, x0, y0, x1, y1, w=6, t=0, col=COL.sateOil, o)  glossy stream with drops (o: drops 5, scallion flecks).
//  saltCloud(ctx, x, y, s, o)  muối tôm falling cloud from (x,y); s=1: cone 300 wide x 420 tall.
//      o: {t, k 0..1 density, seed, n=220, col, light 0..1 (sun-catch glow)}
//  calamansi(ctx, x, y, s, rot, o)  quả tắc; origin centre; s=1: Ø70. o: {half (cut face), squeeze 0..1}
//  juiceDrops(ctx, x, y, s, o)  falling drops; o: {t, n=8, seed, h=300, slow 0..1 (slow-mo stretch), col}
//  rauRam(ctx, x, y, s, rot, o)  rau răm sprig; origin stem base, +x; s=1: 200 long. o: {chopped (pile), seed, n}
//      rauRamLeaf(c,x,y,s,rot) single leaf.
//  peanuts / friedShallots(ctx, x, y, s, o)  pile/rain; s=1: nut 16x11 / ring 14. o: {n, seed, spread, fall, t, h}
//  skewer(ctx, x, y, s, rot, o)  bamboo xiên; origin = grip; tip +x (260), end -x (140). o: {food null|'mix'|'egg'|'jerky'}
//  plasticFork(ctx, x, y, s, rot, o)  white fork; origin = grip; tines +x (100). o: {food null|'mix'}
//  mixBite(c, seed) tangle of tossed strips (≈70 wide) for custom bites.
//  traTac(ctx, x, y, s, o)  iced calamansi tea, plastic cup + pink straw; origin bottom centre; s=1: 160 rim x 260 tall.
//      o: {level 0..1, ice (true), straw (true), t}
//
// ---------------------------------------------------------------------------------------------- EFFECTS
//  FLAVORS  [{key,vi,en,col,colD,icon}] x4: CHUA/SOUR (yellow, tắc), CAY/SPICY (red, chili), MẶN/SALTY (teal, shrimp),
//      NGỌT/SWEET (pink, heart).
//  flavorBurst(ctx, x, y, s, o)  four glowing ribbons swirling out of (x,y) with icon discs at their heads; s=1: radius
//      ≈400. o: {t (swirl), k 0..1 (burst progress), labels (icons, true), only 0..3 (single ribbon), spin}
//      -> [{x,y,key,vi,en,col}] x4 label anchors (screen) — put the bilingual words with text.js ≈70–90 px below each.
//  shakeLines(ctx, x, y, s, o)  cartoon motion ticks around an object (s=1: object radius ≈150).
//      o: {t (flicker), k 0..1, col, n (3 per side), dir 'h'|'v'|'both', vTop (-300) / vBot (150) arc offsets for 'v'}
//  whoosh(ctx, x, y, ang, len, o)  speed-swipe streaks ending at (x,y) heading ang. o: {k, col, n 4, w 10, curve 0.3}
//  ingredientBits / confetti(ctx, x, y, s, o)  exploding (or floating, o.loop) ingredient confetti; s=1: radius ≈500.
//      o: {t (s since burst), n=60, seed, gravity 900, burst 900, loop, kinds subset of 'strip','mango','jerky','squid',
//          'peanut','shallot','herb','egg','chili','salt'}
//  sunFlare(ctx, x, y, s=1, o)  golden sun glow + lib.flare + anamorphic streak. o: {alpha 1, streak true}
//
// TIMINGS (this machine, 1080x1920, warm caches): saigonAerial ≈25 ms, schoolStreet with crowd+cart+parents+petals ≈45 ms,
//  every other drawer < 21 ms. First-call cache builds:
//  saigonAerial ≈130 ms, schoolStreet ≈250 ms, counterTop ≈100 ms. Warm caches once (e.g. in a shots preload) if needed.
// =====================================================================================================
'use strict';
const L = require('./lib');
const { W, H, TAU, lerp, clamp, rng, at, glow, ease, createCanvas, godRays, dust, flare, sparkle, bokeh } = L;
const P = require('./props');
const { seg, ell, ik, shade } = P;
const PEOPLE = require('./people');
const PP = require('./pprops');
const { hx, mixc, rgba } = PP;
const { Path2D } = require('@napi-rs/canvas');
const PI = Math.PI;

// ---------------------------------------------------------------- small helpers
const rot2 = (a, x, y) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function lgr(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function rgr(ctx, x0, y0, r0, x1, y1, r1, stops) { const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of stops) g.addColorStop(o, c); return g; }
function canvas(w, h) { const c = createCanvas(Math.ceil(w), Math.ceil(h)); return [c, c.getContext('2d')]; }
function ikPick(ax, ay, bx, by, l1, l2, preferX) {
  const a = ik(ax, ay, bx, by, l1, l2, 1), b = ik(ax, ay, bx, by, l1, l2, -1);
  return (preferX < 0 ? a[0] < b[0] : a[0] > b[0]) ? a : b;
}
function ikPickY(ax, ay, bx, by, l1, l2, preferY) {
  const a = ik(ax, ay, bx, by, l1, l2, 1), b = ik(ax, ay, bx, by, l1, l2, -1);
  return (preferY < 0 ? a[1] < b[1] : a[1] > b[1]) ? a : b;
}
// local->screen mapper from the current transform (for returning anchor points)
function mapper(ctx) { const m = ctx.getTransform(); return (x, y) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }
function rimLine(ctx, fn, col = 'rgba(255,205,140,0.75)', w = 4) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; fn(); ctx.stroke(); ctx.restore();
}
function txt(ctx, s, x, y, font, col, align = 'center', base = 'middle') { ctx.font = font; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = col; ctx.fillText(s, x, y); }

// ---------------------------------------------------------------- palette
const COL = {
  sun: '#ffc46b', sunHot: '#fff1c9', amber: '#ff9b3d', orange: '#f2762e', haze: '#f3b77a',
  teal: '#1d4e57', tealD: '#12333b', tealL: '#3f7f86', sky0: '#6f9fba', sky1: '#f6c98e', sky2: '#ffdca6',
  wall: '#f0c34a', wallL: '#ffe08a', wallD: '#c8962c', wallS: '#8a6a3a', trim: '#b5452f', gate: '#2c5a60',
  phuong: '#e5402b', phuongL: '#ff7a45', phuongD: '#a8231a', leaf: '#3e7a3a', leafD: '#1f4a2a', leafL: '#86b64e',
  brick: '#b8765a', asphalt: '#4d4a50',
  shirt: '#fbfbf6', navy: '#1f2b4d', navyL: '#33457a', scarf: '#d8262b',
  aobaba: '#7a4a9c', aobabaL: '#a070c4', aobabaD: '#4b2b6b', apron: '#efe3c8', apronD: '#c9b48e',
  rice: '#f4ead2', riceD: '#d9c9a2', sate: '#c22e1a', sateOil: '#e8501f', mango: '#7fb33a', mangoD: '#4f7f23', mangoFlesh: '#e6e49a',
  jerky: '#7a2616', jerkyL: '#b4482a', squid: '#f2c88e', squidD: '#d98a4e', egg: '#fbf5e8', eggShell: '#efe2c4', yolk: '#f4b23a',
  salt: '#f0905c', saltL: '#ffc08a', tac: '#8fbf34', tacFlesh: '#ffb53c', herb: '#3f8f3a', herbD: '#245e2a',
  peanut: '#c98a4a', peanutL: '#e8b878', shallot: '#d98c36', shallotD: '#9a5a1e', tea: '#e39a3a', mixed: '#d9542a', mixedD: '#9e2f17',
  steel: '#c9ced3', steelD: '#7d858c', glove: 'rgba(235,245,250,0.28)',
};
// coBa / kid skin tones
const SKIN_BA = ['#e9b48c', '#c98a62', '#9a6242'];
const KID_SKINS = [['#f3c9a4', '#d9a07a', '#b37854'], ['#eab890', '#cf9068', '#a86a48'], ['#f6d2b0', '#e0ab86', '#bb825e'], ['#e4ac84', '#c7865e', '#9c623f']];

// =====================================================================================
// ENVIRONMENT
// =====================================================================================
// leafy canopy painted into a (usually cached) context.
// o: {seed, col:[dark,mid,light], flowers 0..1 (phượng blossoms), n, squash, leaf (leaf size), sunlit 0..1}
function canopy(c, cx, cy, R, o = {}) {
  const r = rng(o.seed || 1), sq = o.squash || 0.72, n = o.n || Math.round(R * R / 70);
  const cols = o.col || [COL.leafD, COL.leaf, COL.leafL];
  const blobs = [];
  for (let i = 0; i < 8; i++) { const a = r() * TAU, d = r() * R * 0.55; blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * sq, R * (0.38 + r() * 0.34)]); }
  for (const b of blobs) { ell(c, b[0], b[1], b[2], b[2] * sq); c.fillStyle = cols[0]; c.fill(); }
  const lz = o.leaf || 7, sun = o.sunlit === undefined ? 1 : o.sunlit;
  for (let i = 0; i < n; i++) {
    const b = blobs[(r() * blobs.length) | 0], a = r() * TAU, d = Math.sqrt(r()) * b[2];
    const x = b[0] + Math.cos(a) * d, y = b[1] + Math.sin(a) * d * sq;
    const lf = clamp(0.45 + ((x - cx) * 0.6 - (y - cy)) / (R * 1.5) + (r() - 0.5) * 0.45);
    c.fillStyle = lf > 0.86 && sun > 0.5 ? '#d9d46a' : lf > 0.66 ? cols[2] : lf > 0.36 ? cols[1] : cols[0];
    const sz = lz * (0.6 + r() * 0.8);
    c.beginPath(); c.ellipse(x, y, sz, sz * 0.42, r() * PI, 0, TAU); c.fill();
  }
  if (o.flowers) {
    const nf = Math.round(n * o.flowers * 0.12);
    for (let i = 0; i < nf; i++) {
      const b = blobs[(r() * blobs.length) | 0], a = r() * TAU, d = Math.sqrt(r()) * b[2] * 1.02;
      const x = b[0] + Math.cos(a) * d, y = b[1] + Math.sin(a) * d * sq;
      const lf = clamp(0.45 + ((x - cx) * 0.6 - (y - cy)) / (R * 1.5));
      const m = 3 + ((r() * 5) | 0);
      for (let j = 0; j < m; j++) {
        const fx = x + (r() - 0.5) * lz * 3, fy = y + (r() - 0.5) * lz * 2.2, fr = lz * (0.35 + r() * 0.4);
        c.fillStyle = lf > 0.6 ? (r() < 0.4 ? COL.phuongL : COL.phuong) : (r() < 0.5 ? COL.phuong : COL.phuongD);
        ell(c, fx, fy, fr, fr); c.fill();
      }
    }
  }
}
// straight dầu-tree trunk (tall, pale bark with patches). base (x,y), height h, width w
function dauTrunk(c, x, y, h, w, seed = 3) {
  const r = rng(seed);
  c.fillStyle = lgr(c, x - w / 2, 0, x + w / 2, 0, [[0, '#5d5a52'], [0.55, '#8d867a'], [0.85, '#c9b79a'], [1, '#6a6458']]);
  c.beginPath(); c.moveTo(x - w * 0.62, y); c.quadraticCurveTo(x - w * 0.5, y - h * 0.5, x - w * 0.38, y - h); c.lineTo(x + w * 0.38, y - h); c.quadraticCurveTo(x + w * 0.5, y - h * 0.5, x + w * 0.62, y); c.closePath(); c.fill();
  for (let i = 0; i < h / 30; i++) { const py = y - r() * h, px = x + (r() - 0.5) * w * 0.6; c.fillStyle = r() < 0.5 ? 'rgba(235,225,205,0.35)' : 'rgba(40,38,34,0.25)'; ell(c, px, py, w * (0.08 + r() * 0.12), 6 + r() * 14); c.fill(); }
  // sunlit right edge
  c.fillStyle = 'rgba(255,200,120,0.35)'; c.fillRect(x + w * 0.22, y - h, w * 0.14, h);
}

// ---------------------------------------------------------------- AERIAL (s1)
// cache coords: city plane 1400 x 2700, horizon at y=430, school gate at (700,2335)
const AER = { CW: 1400, CH: 2700, HOR: 430, GATE: [700, 2335], PATCH: [300, 1560, 800, 1140], PRES: 2.6, SUNX: 820 };
const aerK = (y) => 0.1 + Math.pow(clamp((y - AER.HOR) / (AER.CH - AER.HOR)), 1.15) * 1.55;
const aerHaze = (y) => Math.pow(1 - clamp((y - AER.HOR) / (AER.CH - AER.HOR)), 1.7) * 0.82;
const HOUSE_PAL = ['#f4e3c4', '#f2c9b4', '#cfe3d4', '#f4d98a', '#ece4d8', '#d9cbe6', '#f5b98a', '#bfd8e2', '#f6efe4', '#e8a98e'];
let AER_OBJ = null, AER_CACHE = null;
function aerHouse(c, x, yb, w, k, r) {
  const hz = aerHaze(yb), fh = (30 + r() * 80) * k, rd = 42 * k;
  const base = HOUSE_PAL[(r() * HOUSE_PAL.length) | 0];
  const front = mixc(mixc(base, '#35566a', 0.36), COL.haze, hz);
  c.fillStyle = front; c.fillRect(x, yb - fh, w, fh + 1);
  // sunlit right edge + shadow left
  c.fillStyle = rgba('#ffd9a0', 0.22 * (1 - hz)); c.fillRect(x + w - 3 * k, yb - fh, 3 * k, fh);
  // windows / balconies
  if (k > 0.3) {
    const floors = Math.max(1, Math.round(fh / (26 * k)));
    for (let f = 0; f < floors; f++) {
      const wy = yb - fh + 6 * k + f * (fh / floors);
      c.fillStyle = mixc('#26343c', COL.haze, hz * 0.9); c.fillRect(x + w * 0.2, wy, w * 0.6, Math.max(1, fh / floors * 0.42));
      if (r() < 0.25) { c.fillStyle = rgba('#ffcf86', 0.7 * (1 - hz)); c.fillRect(x + w * 0.2 + r() * w * 0.4, wy, w * 0.14, fh / floors * 0.42); }
      if (r() < 0.5) { c.fillStyle = mixc('#e8e2d4', COL.haze, hz); c.fillRect(x + w * 0.12, wy + fh / floors * 0.45, w * 0.76, Math.max(1, 2 * k)); }
      if (r() < 0.3) { c.fillStyle = mixc(['#3f8a3a', '#c94f6a', '#3a6fb0'][(r() * 3) | 0], COL.haze, hz); c.fillRect(x + w * 0.15, wy + fh / floors * 0.32, w * 0.2, 3 * k); }
    }
  }
  const tile = r() < 0.32;
  if (tile) {
    const tc = mixc(r() < 0.5 ? '#b5523a' : '#9c4632', COL.haze, hz * 0.9);
    c.fillStyle = tc; c.beginPath(); c.moveTo(x - 2 * k, yb - fh); c.lineTo(x + w + 2 * k, yb - fh); c.lineTo(x + w * 0.82, yb - fh - rd); c.lineTo(x + w * 0.18, yb - fh - rd); c.closePath(); c.fill();
    c.strokeStyle = rgba('#3a1a10', 0.25); c.lineWidth = Math.max(0.6, k);
    for (let i = 1; i < 5; i++) { const u = i / 5; c.beginPath(); c.moveTo(x + w * u, yb - fh); c.lineTo(lerp(x + w * 0.18, x + w * 0.82, u), yb - fh - rd); c.stroke(); }
    c.fillStyle = rgba('#ffcf8a', 0.5 * (1 - hz * 0.6)); c.fillRect(x + w * 0.18, yb - fh - rd - k, w * 0.64, 2.2 * k);
  } else {
    const rc = mixc(['#d6cbb8', '#c9bfae', '#e0d6c4', '#bdb3a2'][(r() * 4) | 0], COL.haze, hz * 0.85);
    c.fillStyle = rc; c.fillRect(x, yb - fh - rd, w, rd);
    c.fillStyle = rgba('#000', 0.12); c.fillRect(x, yb - fh - 2.5 * k, w, 2.5 * k);
    c.fillStyle = rgba('#ffd9a0', 0.55 * (1 - hz * 0.6)); c.fillRect(x, yb - fh - rd, w, 1.8 * k);
    if (k > 0.25 && r() < 0.55) { // stainless water tank
      const tx = x + w * (0.2 + r() * 0.5), ty = yb - fh - rd * (0.35 + r() * 0.3);
      c.fillStyle = mixc('#9aa3aa', COL.haze, hz * 0.7); rrect(c, tx, ty - 7 * k, 22 * k, 10 * k, 5 * k); c.fill();
      c.fillStyle = rgba('#fff4dc', 0.7 * (1 - hz)); c.fillRect(tx + 2 * k, ty - 6 * k, 18 * k, 2 * k);
      c.fillStyle = rgba('#000', 0.18); c.fillRect(tx + 2 * k, ty + 3 * k, 22 * k, 3 * k);
    }
    if (k > 0.4 && r() < 0.25) { c.fillStyle = mixc('#4f8f3e', COL.haze, hz); ell(c, x + w * 0.75, yb - fh - rd * 0.5, 6 * k, 4 * k); c.fill(); }
  }
}
function aerTree(c, x, yb, k, r, flowers = 0) {
  const hz = aerHaze(yb), h = (38 + r() * 30) * k;
  c.strokeStyle = mixc('#4a4036', COL.haze, hz); c.lineWidth = Math.max(1, 3 * k);
  c.beginPath(); c.moveTo(x, yb); c.lineTo(x, yb - h); c.stroke();
  const cols = [mixc(COL.leafD, COL.haze, hz), mixc(COL.leaf, COL.haze, hz), mixc(COL.leafL, COL.haze, hz)];
  canopy(c, x, yb - h - 10 * k, (20 + r() * 14) * k, { seed: (r() * 1e6) | 0, col: cols, leaf: Math.max(1.5, 4 * k), flowers, n: Math.round(70 + 60 * k) });
}
function drawSkyline(c) {
  const r = rng(91), y = AER.HOR;
  // far haze blocks
  for (let x = -20; x < AER.CW + 20;) {
    const w = 8 + r() * 26, h = 6 + r() * 36 + (Math.abs(x - 600) < 300 ? r() * 40 : 0);
    c.fillStyle = mixc('#b89a92', COL.haze, 0.45 + r() * 0.2); c.fillRect(x, y - h, w, h + 6); x += w * (0.7 + r() * 0.4);
  }
  // Landmark 81 (stepped tower)
  const lx = 470; c.fillStyle = mixc('#8f8a9c', COL.haze, 0.42);
  c.beginPath(); c.moveTo(lx - 26, y); c.lineTo(lx - 22, y - 220); c.lineTo(lx - 15, y - 262); c.lineTo(lx - 8, y - 300); c.lineTo(lx - 2, y - 335); c.lineTo(lx + 2, y - 335); c.lineTo(lx + 9, y - 296); c.lineTo(lx + 16, y - 255); c.lineTo(lx + 22, y - 210); c.lineTo(lx + 26, y); c.closePath(); c.fill();
  c.fillStyle = rgba('#ffd9a0', 0.4); c.fillRect(lx + 12, y - 250, 6, 250);
  // Bitexco (tapered with helipad)
  const bx = 960; c.fillStyle = mixc('#958c98', COL.haze, 0.38);
  c.beginPath(); c.moveTo(bx - 22, y); c.quadraticCurveTo(bx - 18, y - 120, bx - 9, y - 205); c.lineTo(bx + 4, y - 215); c.quadraticCurveTo(bx + 18, y - 120, bx + 22, y); c.closePath(); c.fill();
  ell(c, bx - 18, y - 150, 16, 4); c.fill(); c.fillStyle = rgba('#ffd9a0', 0.45); c.fillRect(bx - 22, y - 152, 16, 2);
  // more towers
  for (const [tx, th, tw] of [[300, 120, 24], [360, 90, 30], [620, 150, 26], [690, 110, 34], [1100, 130, 28], [1180, 95, 36], [1260, 140, 22], [180, 70, 40]]) {
    c.fillStyle = mixc('#a5949a', COL.haze, 0.42 + r() * 0.12); c.fillRect(tx - tw / 2, y - th, tw, th + 4);
    c.fillStyle = rgba('#ffe2b0', 0.35); c.fillRect(tx + tw / 2 - 4, y - th, 4, th);
  }
  // Saigon river ribbon with sun glitter
  c.fillStyle = mixc('#e9b47a', '#fff0cf', 0.3);
  c.beginPath(); c.moveTo(-10, y + 40); c.bezierCurveTo(300, y + 18, 520, y + 70, 820, y + 44); c.bezierCurveTo(1050, y + 26, 1250, y + 58, 1420, y + 40);
  c.lineTo(1420, y + 58); c.bezierCurveTo(1250, y + 76, 1050, y + 44, 820, y + 62); c.bezierCurveTo(520, y + 90, 300, y + 36, -10, y + 58); c.closePath(); c.fill();
  for (let i = 0; i < 90; i++) { const gx = AER.SUNX + (r() - 0.5) * 360 * (1 + r()), gy = y + 42 + r() * 22; c.fillStyle = rgba('#fff8e0', 0.5 + r() * 0.5); c.fillRect(gx, gy, 2 + r() * 8, 1.5); }
}
function drawSchoolAerial(c) {
  const k0 = aerK(1960), k1 = aerK(2335);
  // yard
  c.fillStyle = '#d8cab0'; c.fillRect(395, 1955, 610, 385);
  c.fillStyle = rgba('#000', 0.08); c.fillRect(395, 1955, 610, 30);
  c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3; c.strokeRect(560, 2060, 280, 170); c.beginPath(); c.moveTo(700, 2060); c.lineTo(700, 2230); c.stroke();
  // long tree shadows across the yard (sun behind -> toward camera)
  c.fillStyle = 'rgba(40,70,90,0.18)'; c.beginPath(); c.moveTo(540, 2150); c.lineTo(600, 2150); c.lineTo(520, 2330); c.lineTo(450, 2330); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(830, 2125); c.lineTo(880, 2125); c.lineTo(830, 2330); c.lineTo(770, 2330); c.closePath(); c.fill();
  // back building (3 floors) base 1960
  const fh = 135 * k0, rd = 85;
  c.fillStyle = lgr(c, 0, 1960 - fh, 0, 1960, [[0, '#e9b84a'], [1, '#c9952e']]); c.fillRect(395, 1960 - fh, 610, fh);
  for (let f = 0; f < 3; f++) {
    const fy = 1960 - fh + f * fh / 3;
    c.fillStyle = 'rgba(70,50,30,0.55)'; c.fillRect(395, fy + fh / 3 * 0.22, 610, fh / 3 * 0.5);
    for (let d = 0; d < 16; d++) { c.fillStyle = '#3f6b55'; c.fillRect(410 + d * 37, fy + fh / 3 * 0.32, 14, fh / 3 * 0.4); }
    c.fillStyle = '#f8f1e2'; c.fillRect(395, fy + fh / 3 * 0.66, 610, 4); for (let b = 0; b < 60; b++) c.fillRect(397 + b * 10.2, fy + fh / 3 * 0.66, 2, fh / 3 * 0.18);
    for (let col = 0; col < 9; col++) { c.fillStyle = '#f2cf6a'; c.fillRect(395 + col * 75, fy, 9, fh / 3); }
  }
  // red banner
  c.fillStyle = '#c4271c'; c.fillRect(570, 1960 - fh * 0.67 + 2, 260, 14); c.fillStyle = '#ffd34a'; c.font = '11px BodySansBold'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TIÊN HỌC LỄ · HẬU HỌC VĂN', 700, 1960 - fh * 0.67 + 9);
  // roof
  c.fillStyle = '#a9472f'; c.beginPath(); c.moveTo(385, 1960 - fh); c.lineTo(1015, 1960 - fh); c.lineTo(985, 1960 - fh - rd); c.lineTo(415, 1960 - fh - rd); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(60,20,10,0.3)'; c.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const u = i / 40; c.beginPath(); c.moveTo(lerp(385, 1015, u), 1960 - fh); c.lineTo(lerp(415, 985, u), 1960 - fh - rd); c.stroke(); }
  c.fillStyle = '#ffcf8a'; c.fillRect(415, 1960 - fh - rd - 2, 570, 4);
  // wings (roofs with end facades)
  for (const [x0, x1] of [[395, 505], [895, 1005]]) {
    const ye = 2250, fe = 120 * aerK(ye);
    c.fillStyle = '#9e432c'; c.beginPath(); c.moveTo(x0, 1960 - fh); c.lineTo(x1, 1960 - fh); c.lineTo(x1, ye - fe); c.lineTo(x0, ye - fe); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(60,20,10,0.28)'; for (let i = 1; i < 6; i++) { const xx = lerp(x0, x1, i / 6); c.beginPath(); c.moveTo(xx, 1960 - fh); c.lineTo(xx, ye - fe); c.stroke(); }
    c.fillStyle = 'rgba(255,207,138,0.6)'; c.fillRect(x0 + (x0 < 700 ? (x1 - x0) - 5 : 0), 1960 - fh, 5, ye - fe - 1960 + fh);
    c.fillStyle = lgr(c, 0, ye - fe, 0, ye, [[0, '#ecbd50'], [1, '#c48f2c']]); c.fillRect(x0, ye - fe, x1 - x0, fe);
    for (let f = 0; f < 3; f++) for (let w = 0; w < 3; w++) { c.fillStyle = '#3a4a48'; c.fillRect(x0 + 14 + w * 32, ye - fe + 10 + f * fe / 3, 18, fe / 3 - 22); }
    c.fillStyle = '#b8462e'; c.beginPath(); c.moveTo(x0 - 6, ye - fe); c.lineTo(x1 + 6, ye - fe); c.lineTo(x1 - 10, ye - fe - 26); c.lineTo(x0 + 10, ye - fe - 26); c.closePath(); c.fill();
  }
  // flagpole + flag
  c.strokeStyle = '#e8e8e8'; c.lineWidth = 3; c.beginPath(); c.moveTo(700, 2110); c.lineTo(700, 1940); c.stroke();
  c.fillStyle = '#d42a1e'; c.beginPath(); c.moveTo(700, 1942); c.quadraticCurveTo(730, 1936, 752, 1946); c.lineTo(752, 1978); c.quadraticCurveTo(730, 1968, 700, 1974); c.closePath(); c.fill();
  c.fillStyle = '#ffd400'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = i % 2 ? 4 : 9; c.lineTo(726 + Math.cos(a) * rr, 1959 + Math.sin(a) * rr); } c.closePath(); c.fill();
  // phượng trees in the yard (fiery red canopies)
  const r = rng(77);
  for (const [tx, ty, R] of [[560, 2150, 92], [850, 2130, 86], [470, 2300, 60], [940, 2295, 64]]) {
    c.strokeStyle = '#4b3a2c'; c.lineWidth = 7; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 4, ty - 70); c.stroke();
    canopy(c, tx, ty - 95, R, { seed: (r() * 1e5) | 0, col: ['#2f5a2c', '#4f8a3a', '#8fbf52'], flowers: 1.6, leaf: 6, n: Math.round(R * R / 18) });
  }
  // front wall + gate
  const wy = 2335, wh = 40 * k1;
  c.fillStyle = '#f0c34a'; c.fillRect(380, wy - wh, 270, wh); c.fillRect(750, wy - wh, 270, wh);
  c.fillStyle = '#c8962c'; c.fillRect(380, wy - 6, 270, 6); c.fillRect(750, wy - 6, 270, 6);
  c.fillStyle = '#fff2c4'; c.fillRect(380, wy - wh - 6, 270, 6); c.fillRect(750, wy - wh - 6, 270, 6);
  c.fillStyle = '#e9b84a'; c.fillRect(632, wy - wh - 40, 22, wh + 40); c.fillRect(746, wy - wh - 40, 22, wh + 40);
  c.fillStyle = '#c4271c'; c.fillRect(626, wy - wh - 66, 148, 28); c.fillStyle = '#ffd34a'; c.font = '13px BodySansBold'; c.fillText('THCS NGUYỄN DU', 700, wy - wh - 52);
  c.fillStyle = '#2c5a60'; c.fillRect(654, wy - wh + 6, 92, wh - 6);
  c.fillStyle = rgba('#000', 0.25); c.fillRect(654, wy - wh + 6, 92, 6);
}
function buildAerial() {
  if (AER_OBJ) return;
  const r = rng(4242), objs = [];
  objs.push({ y: AER.HOR, d: (c) => drawSkyline(c) });
  const streets = [560, 700, 880, 1110, 1380, 1700, 2340];
  const SCH = (x, w, y) => y > 1850 && y <= 2345 && x + w > 380 && x < 1020;
  let si = 0, y = AER.HOR + 30;
  while (y < AER.CH + 80) {
    const k = aerK(y);
    if (si < streets.length && y >= streets[si]) {
      const ys = streets[si], sw = 120 * aerK(ys); si++;
      objs.push({ y: ys, d: (c) => {
        const hz = aerHaze(ys);
        c.fillStyle = mixc('#8a7d74', COL.haze, hz); c.fillRect(-20, ys - 6, AER.CW + 40, sw + 6);
        c.fillStyle = mixc('#5e5a5c', COL.haze, hz); c.fillRect(-20, ys + sw * 0.18, AER.CW + 40, sw * 0.64);
        c.fillStyle = rgba('#fff3d0', 0.45 * (1 - hz)); for (let x = 0; x < AER.CW; x += 60 * aerK(ys)) c.fillRect(x, ys + sw * 0.5, 26 * aerK(ys), Math.max(1, 2 * aerK(ys)));
        c.fillStyle = rgba('#2a3a48', 0.35); c.fillRect(-20, ys + sw * 0.18, AER.CW + 40, sw * 0.18);
      } });
      const rr = rng(ys);
      objs.push({ y: ys + sw * 0.3, d: (c) => { const kk = aerK(ys); for (let x = 20 + rr() * 60; x < AER.CW; x += (110 + rr() * 90) * Math.max(0.5, kk)) { if (ys === 2340 && Math.abs(x - 700) < 90) continue; aerTree(c, x, ys + 4, kk, rr, ys === 2340 || rr() < 0.12 ? 0.9 : 0); } } });
      y = ys + sw + 4;
      continue;
    }
    const yy = y;
    const rowR = rng((yy * 13) | 0);
    objs.push({ y: yy, d: (c) => {
      let x = -40 - rowR() * 60;
      while (x < AER.CW + 40) {
        const w = (70 + rowR() * 80) * Math.max(0.45, k);
        if (!SCH(x, w, yy)) aerHouse(c, x, yy, w, k, rowR); else rowR();
        x += w + rowR() * 3 * k;
      }
    } });
    y += 52 * k + 6;
  }
  objs.push({ y: 1955, d: (c) => drawSchoolAerial(c) });
  objs.sort((a, b) => a.y - b.y);
  AER_OBJ = objs;
  const [city, cc] = canvas(AER.CW, AER.CH);
  for (const o of objs) o.d(cc);
  const [pa, pc] = canvas(AER.PATCH[2] * AER.PRES, AER.PATCH[3] * AER.PRES);
  pc.scale(AER.PRES, AER.PRES); pc.translate(-AER.PATCH[0], -AER.PATCH[1]);
  for (const o of objs) if (o.y > AER.PATCH[1] - 250) o.d(pc);
  AER_CACHE = { city, patch: pa, streets };
}
// saigonAerial(ctx,t,camY,o) -> {gate:[x,y], z, horizon, sun:[x,y]}
function saigonAerial(ctx, t, camY = 0, o = {}) {
  buildAerial();
  const e = ease.inOut(clamp(camY));
  const z0 = 0.84, z1 = o.zoomEnd || 2.6, z = z0 * Math.pow(z1 / z0, e);
  const F = [lerp(700, AER.GATE[0], e) + Math.sin(t * 0.3) * 6 * (1 - e), lerp(1170, AER.GATE[1], e)], S = [540, lerp(1100, 1250, e)];
  const toS = (px, py) => [(px - F[0]) * z + S[0], (py - F[1]) * z + S[1]];
  const horY = toS(0, AER.HOR)[1];
  const sun = [lerp(800, 900, e), horY - 150];
  // sky (moves with horizon only)
  ctx.fillStyle = lgr(ctx, 0, horY - 900, 0, horY + 10, [[0, '#4f86a8'], [0.45, '#9fb9c0'], [0.75, COL.sky1], [1, COL.sky2]]);
  ctx.fillRect(0, 0, W, H);
  if (horY > -200) {
    glow(ctx, sun[0], sun[1], 520, 'rgba(255,190,110,0.7)', 1);
    glow(ctx, sun[0], sun[1], 120, 'rgba(255,250,225,1)', 1);
    // thin cloud streaks
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffd7a8';
    for (let i = 0; i < 5; i++) { ell(ctx, (i * 260 + t * 8) % 1400 - 160, horY - 260 - i * 70, 220, 10); ctx.fill(); }
    ctx.restore();
  }
  // city
  ctx.save();
  ctx.translate(S[0] - F[0] * z, S[1] - F[1] * z); ctx.scale(z, z);
  ctx.drawImage(AER_CACHE.city, 0, 0);
  if (z > 1.15) { ctx.globalAlpha = clamp((z - 1.15) / 0.4); ctx.drawImage(AER_CACHE.patch, AER.PATCH[0], AER.PATCH[1], AER.PATCH[2], AER.PATCH[3]); ctx.globalAlpha = 1; }
  // motorbikes on streets
  const r = rng(55);
  for (const ys of AER_CACHE.streets) {
    const k = aerK(ys), sw = 120 * k, hz = aerHaze(ys);
    for (let i = 0; i < 14; i++) {
      const dir = r() < 0.5 ? 1 : -1, lane = ys + sw * (dir > 0 ? 0.62 : 0.36), sp = (40 + r() * 50) * k, x0 = r() * (AER.CW + 200);
      const x = ((x0 + dir * t * sp) % (AER.CW + 200) + AER.CW + 200) % (AER.CW + 200) - 100;
      const cc = ['#c43a2a', '#2f4f8f', '#e8e8e8', '#222', '#d9a12a', '#5a8f4a'][(r() * 6) | 0];
      ctx.fillStyle = mixc('#202020', COL.haze, hz * 0.7); ell(ctx, x, lane + 2 * k, 10 * k, 3 * k); ctx.fill();
      ctx.fillStyle = mixc(cc, COL.haze, hz * 0.7); rrect(ctx, x - 8 * k, lane - 6 * k, 16 * k, 6 * k, 3 * k); ctx.fill();
      ctx.fillStyle = mixc(r() < 0.5 ? '#f4f4f4' : '#d24a3a', COL.haze, hz * 0.7); ell(ctx, x, lane - 9 * k, 3.4 * k, 3.4 * k); ctx.fill();
    }
  }
  // kids pouring out of the school
  const kids = o.kids || 0;
  if (kids > 0) {
    const kr = rng(9), n = 70, kk = aerK(2200);
    for (let i = 0; i < n; i++) {
      const sx = 520 + kr() * 360, sy = 1980 + kr() * 220, ph = clamp(kids * 1.7 - (i / n) * 0.7);
      const out = clamp(ph * 2 - 1), gx = 700 + (kr() - 0.5) * 70, gy = AER.GATE[1] + 10;
      let px = lerp(sx, gx, Math.min(1, ph * 2)), py = lerp(sy, gy, Math.min(1, ph * 2));
      if (out > 0) { px += (kr() - 0.5) * 600 * out; py += 30 + kr() * 70 * out; } else { kr(); kr(); }
      px += Math.sin(t * 9 + i) * 1.5;
      ctx.fillStyle = '#fbfbf6'; ell(ctx, px, py, 3.2 * kk, 4 * kk); ctx.fill();
      ctx.fillStyle = '#22252e'; ell(ctx, px, py - 4 * kk, 2.4 * kk, 2.4 * kk); ctx.fill();
      ctx.fillStyle = '#d8262b'; ctx.fillRect(px - 1 * kk, py - 2 * kk, 2 * kk, 2 * kk);
    }
  }
  ctx.restore();
  // atmosphere: horizon haze band, warm wash, rays
  if (horY > -400) {
    ctx.fillStyle = lgr(ctx, 0, horY - 160, 0, horY + 520, [[0, 'rgba(255,214,160,0)'], [0.35, 'rgba(255,206,150,0.55)'], [1, 'rgba(255,190,130,0)']]);
    ctx.fillRect(0, horY - 160, W, 680);
  }
  ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = lgr(ctx, 0, 0, W, H, [[0, 'rgba(255,170,80,0.55)'], [1, 'rgba(20,70,90,0.5)']]); ctx.fillRect(0, 0, W, H); ctx.restore();
  const rs = horY > -100 ? sun : [1000, -160];
  godRays(ctx, rs[0], rs[1], 1.95, 1.2, 2400, 9, 'rgba(255,205,140,0.55)', 0.22 * (o.rays === undefined ? 1 : o.rays), t);
  if (horY > -100) flare(ctx, sun[0], sun[1], 0.7, 0.55 * (o.flare === undefined ? 1 : o.flare));
  // birds
  for (let i = 0; i < 5; i++) {
    const bx = (200 + i * 90 + t * 60) % 1300 - 100, by = (horY > 0 ? horY - 380 : 300) + Math.sin(i * 2.1) * 60 + Math.sin(t * 2 + i) * 6, w = 12 + (i % 3) * 3, fl = Math.sin(t * 9 + i * 1.3) * 5;
    ctx.strokeStyle = 'rgba(60,40,40,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(bx - w, by - fl); ctx.quadraticCurveTo(bx - w / 2, by - 6, bx, by); ctx.quadraticCurveTo(bx + w / 2, by - 6, bx + w, by - fl); ctx.stroke();
  }
  return { gate: toS(AER.GATE[0], AER.GATE[1]), z, horizon: horY, sun };
}

// ---------------------------------------------------------------- SCHOOL STREET (s2,s3,s19..s26)
const STREET = {
  W: 2400, PAN_MAX: 1320, WALL_TOP: 850, WALL_Y: 1330, BACK: 1450, GROUND: 1560, CURB: 1650,
  GATE_X: 760, GATE_W: 420, GATE_TOP: 900, CART_X: 1660, CART_Y: 1470, PARENT_Y: 1445,
  PARENTS: [[130, 1], [1180, -1], [2080, -1], [2330, 1]], BACK_F: 0.9, FAR_F: 0.35, FG_F: 1.35,
};
let ST_C = null;
function wires(c, x0, y0, x1, y1, n, seed) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sag = 40 + r() * 70, dy = (r() - 0.5) * 40;
    c.strokeStyle = rgba('#1c1a1c', 0.6 + r() * 0.3); c.lineWidth = 1.5 + r() * 2.5;
    c.beginPath(); c.moveTo(x0, y0 + dy); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag + dy, x1, y1 + dy * 0.6); c.stroke();
  }
}
function buildStreet() {
  if (ST_C) return ST_C;
  const S = STREET, r = rng(2024);
  // ---- FAR: sky + skyline above the school roof
  const [far, fc] = canvas(1600, 900);
  fc.fillStyle = lgr(fc, 0, 0, 0, 900, [[0, '#7aa6bd'], [0.45, '#c9c4b0'], [0.8, '#ffd29a'], [1, '#ffcf96']]); fc.fillRect(0, 0, 1600, 900);
  for (let i = 0; i < 6; i++) { fc.fillStyle = rgba('#fff0d8', 0.35); ell(fc, r() * 1600, 120 + r() * 300, 160 + r() * 200, 12 + r() * 10); fc.fill(); }
  for (let x = -20; x < 1620;) {
    const w = 60 + r() * 120, h = 120 + r() * 260; const col = mixc(HOUSE_PAL[(r() * 10) | 0], COL.haze, 0.62);
    fc.fillStyle = col; fc.fillRect(x, 640 - h, w, h + 300);
    for (let f = 0; f < h / 40; f++) { fc.fillStyle = rgba('#5a5a6a', 0.18); fc.fillRect(x + w * 0.15, 650 - h + f * 40, w * 0.7, 14); }
    fc.fillStyle = rgba('#ffe6b8', 0.35); fc.fillRect(x + w - 6, 640 - h, 6, h);
    x += w + r() * 10;
  }
  fc.fillStyle = mixc('#9a8a96', COL.haze, 0.5); fc.fillRect(1180, 120, 90, 600); fc.fillStyle = rgba('#ffe6b8', 0.4); fc.fillRect(1255, 120, 15, 600); // tower
  // ---- BACK (x0.9): school building + yard (seen above the wall and through the gate)
  const BW = 2300;
  const [back, bc] = canvas(BW, H);
  const roofY = 455, baseY = 1255;
  bc.fillStyle = '#d6c6a6'; bc.fillRect(0, baseY - 6, BW, H - baseY); // yard ground
  bc.fillStyle = lgr(bc, 0, baseY, 0, 1340, [[0, '#b9a98a'], [1, '#e4d6b8']]); bc.fillRect(0, baseY, BW, 90);
  bc.fillStyle = lgr(bc, 0, roofY, 0, baseY, [[0, '#f6cf63'], [1, '#d6a23a']]); bc.fillRect(0, roofY, BW, baseY - roofY);
  const fl = (baseY - roofY - 30) / 3;
  for (let f = 0; f < 3; f++) {
    const fy = roofY + 30 + f * fl;
    bc.fillStyle = 'rgba(80,55,30,0.55)'; bc.fillRect(0, fy + 20, BW, fl - 60); // corridor shade
    for (let d = 0; d < 22; d++) { const dx = 40 + d * 104; bc.fillStyle = '#3e6e58'; bc.fillRect(dx, fy + 50, 46, fl - 90); bc.fillStyle = 'rgba(255,255,255,0.15)'; bc.fillRect(dx + 4, fy + 54, 10, fl - 98); bc.fillStyle = '#2a3a3a'; bc.fillRect(dx + 60, fy + 60, 30, 40); }
    // railing
    bc.fillStyle = '#fbf3e0'; bc.fillRect(0, fy + fl - 42, BW, 8); bc.fillRect(0, fy + fl - 6, BW, 6);
    for (let b = 0; b < BW / 16; b++) bc.fillRect(b * 16, fy + fl - 36, 4, 32);
    bc.fillStyle = 'rgba(0,0,0,0.18)'; bc.fillRect(0, fy + fl, BW, 10);
    for (let cI = 0; cI < BW / 208 + 1; cI++) { bc.fillStyle = lgr(bc, cI * 208, 0, cI * 208 + 26, 0, [[0, '#ffe08a'], [1, '#d9a63e']]); bc.fillRect(cI * 208, fy, 26, fl); }
  }
  // banner on the 3rd floor
  bc.fillStyle = '#c4271c'; rrect(bc, 380, roofY + 30 + fl - 92, 760, 50, 6); bc.fill();
  txt(bc, 'TIÊN HỌC LỄ  –  HẬU HỌC VĂN', 760, roofY + 30 + fl - 66, '36px TitleSerif', '#ffd84a');
  // roof
  bc.fillStyle = '#a8462c'; bc.beginPath(); bc.moveTo(0, roofY + 34); bc.lineTo(BW, roofY + 34); bc.lineTo(BW, roofY - 70); bc.lineTo(0, roofY - 70); bc.closePath(); bc.fill();
  bc.strokeStyle = 'rgba(60,20,10,0.35)'; bc.lineWidth = 3; for (let x = 0; x < BW; x += 22) { bc.beginPath(); bc.moveTo(x, roofY - 70); bc.lineTo(x, roofY + 34); bc.stroke(); }
  for (let yy = roofY - 50; yy < roofY + 34; yy += 22) { bc.fillStyle = 'rgba(255,190,120,0.12)'; bc.fillRect(0, yy, BW, 4); }
  bc.fillStyle = '#ffcf8a'; bc.fillRect(0, roofY - 74, BW, 6);
  bc.fillStyle = 'rgba(0,0,0,0.25)'; bc.fillRect(0, roofY + 34, BW, 14);
  // yard drum shed + bits visible through the gate
  bc.fillStyle = 'rgba(30,40,50,0.25)'; ell(bc, 760, 1330, 520, 18); bc.fill();
  // ---- MAIN (x1): canopy, wall, gate pillars, sign, sidewalk, trunks, pole
  const [main, mc] = canvas(S.W, H);
  // wall (with gate hole)
  const holeL = S.GATE_X - S.GATE_W / 2, holeR = S.GATE_X + S.GATE_W / 2;
  const wallG = lgr(mc, 0, S.WALL_TOP, 0, S.WALL_Y, [[0, '#ffd970'], [0.6, '#f0c04a'], [1, '#d9a53a']]);
  mc.fillStyle = wallG; mc.fillRect(0, S.WALL_TOP, holeL, S.WALL_Y - S.WALL_TOP); mc.fillRect(holeR, S.WALL_TOP, S.W - holeR, S.WALL_Y - S.WALL_TOP);
  // plaster texture + stains
  for (let i = 0; i < 900; i++) { const x = r() * S.W, y = S.WALL_TOP + r() * (S.WALL_Y - S.WALL_TOP); if (x > holeL - 80 && x < holeR + 80) continue; mc.fillStyle = r() < 0.5 ? 'rgba(255,240,190,0.12)' : 'rgba(150,100,30,0.08)'; ell(mc, x, y, 4 + r() * 22, 2 + r() * 8); mc.fill(); }
  for (let i = 0; i < 18; i++) { const x = r() * S.W; if (x > holeL - 100 && x < holeR + 100) continue; mc.fillStyle = lgr(mc, 0, S.WALL_Y - 160, 0, S.WALL_Y, [[0, 'rgba(90,70,40,0)'], [1, 'rgba(90,70,40,0.25)']]); mc.fillRect(x, S.WALL_Y - 160, 30 + r() * 80, 160); }
  // coping + decorative grille band
  mc.fillStyle = '#fff1bf'; mc.fillRect(0, S.WALL_TOP - 18, holeL - 70, 22); mc.fillRect(holeR + 70, S.WALL_TOP - 18, S.W, 22);
  mc.fillStyle = 'rgba(120,80,20,0.35)'; mc.fillRect(0, S.WALL_TOP + 4, holeL - 70, 8); mc.fillRect(holeR + 70, S.WALL_TOP + 4, S.W, 8);
  for (let x = 20; x < S.W; x += 120) {
    if (x > holeL - 160 && x < holeR + 80) continue;
    mc.fillStyle = 'rgba(110,70,20,0.55)'; rrect(mc, x, S.WALL_TOP + 40, 90, 70, 8); mc.fill();
    mc.strokeStyle = '#ffe9a8'; mc.lineWidth = 6; mc.beginPath(); mc.moveTo(x + 45, S.WALL_TOP + 40); mc.lineTo(x + 45, S.WALL_TOP + 110); mc.moveTo(x, S.WALL_TOP + 75); mc.lineTo(x + 90, S.WALL_TOP + 75); mc.stroke();
    mc.beginPath(); mc.arc(x + 45, S.WALL_TOP + 75, 22, 0, TAU); mc.stroke();
  }
  // skirting stripe
  mc.fillStyle = '#8f8a80'; mc.fillRect(0, S.WALL_Y - 60, holeL, 60); mc.fillRect(holeR, S.WALL_Y - 60, S.W - holeR, 60);
  mc.fillStyle = 'rgba(255,255,255,0.2)'; mc.fillRect(0, S.WALL_Y - 60, holeL, 5); mc.fillRect(holeR, S.WALL_Y - 60, S.W - holeR, 5);
  // painted slogan on wall
  txt(mc, 'AN TOÀN GIAO THÔNG – TRƯỜNG HỌC THÂN THIỆN', 1650, S.WALL_TOP + 205, '30px BodySansBold', 'rgba(190,50,30,0.75)');
  // pillars + arch sign
  for (const px of [holeL - 70, holeR]) {
    mc.fillStyle = lgr(mc, px, 0, px + 70, 0, [[0, '#ffe08a'], [0.5, '#f2c24c'], [1, '#c9902c']]); mc.fillRect(px, 760, 70, S.WALL_Y - 760);
    mc.fillStyle = '#fff1bf'; mc.fillRect(px - 10, 742, 90, 22); mc.fillStyle = '#b5452f'; mc.fillRect(px - 6, 724, 82, 20);
    mc.fillStyle = 'rgba(0,0,0,0.15)'; mc.fillRect(px + 52, 764, 18, S.WALL_Y - 764);
    mc.fillStyle = '#8f8a80'; mc.fillRect(px, S.WALL_Y - 60, 70, 60);
  }
  mc.fillStyle = '#b5452f'; mc.fillRect(holeL - 76, 772, S.GATE_W + 152, 104);
  mc.fillStyle = '#c92b1f'; rrect(mc, holeL - 64, 780, S.GATE_W + 128, 88, 6); mc.fill();
  mc.strokeStyle = '#ffd84a'; mc.lineWidth = 3; rrect(mc, holeL - 56, 787, S.GATE_W + 112, 74, 4); mc.stroke();
  txt(mc, 'TRƯỜNG THCS', S.GATE_X, 808, '26px TitleSerif', '#ffe27a');
  txt(mc, 'NGUYỄN DU', S.GATE_X, 844, '44px TitleSerif', '#ffd84a');
  mc.fillStyle = 'rgba(255,255,255,0.18)'; mc.fillRect(holeL - 64, 780, S.GATE_W + 128, 6);
  // sidewalk pavers in perspective
  mc.fillStyle = '#a87458'; mc.fillRect(0, S.WALL_Y, S.W, S.CURB - S.WALL_Y);
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const y0 = S.WALL_Y + (S.CURB - S.WALL_Y) * Math.pow(i / rows, 1.25), y1 = S.WALL_Y + (S.CURB - S.WALL_Y) * Math.pow((i + 1) / rows, 1.25), bw = 40 + (y1 - S.WALL_Y) * 0.35;
    for (let x = (i % 2) * bw * 0.5 - bw; x < S.W + bw; x += bw) {
      mc.fillStyle = mixc(r() < 0.5 ? '#c08466' : '#b07055', '#d9b49a', r() * 0.3); mc.fillRect(x + 2, y0 + 1.5, bw - 4, y1 - y0 - 3);
    }
  }
  mc.fillStyle = lgr(mc, 0, S.WALL_Y, 0, S.WALL_Y + 60, [[0, 'rgba(40,30,30,0.35)'], [1, 'rgba(40,30,30,0)']]); mc.fillRect(0, S.WALL_Y, S.W, 60);
  // curb + road
  mc.fillStyle = '#cfc8bc'; mc.fillRect(0, S.CURB, S.W, 26); mc.fillStyle = '#8d877c'; mc.fillRect(0, S.CURB + 26, S.W, 12);
  for (let x = 0; x < S.W; x += 110) { mc.fillStyle = 'rgba(0,0,0,0.2)'; mc.fillRect(x, S.CURB, 3, 26); }
  mc.fillStyle = lgr(mc, 0, S.CURB + 38, 0, H, [[0, '#57525a'], [1, '#3e3b42']]); mc.fillRect(0, S.CURB + 38, S.W, H - S.CURB - 38);
  for (let i = 0; i < 1200; i++) { mc.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; mc.fillRect(r() * S.W, S.CURB + 40 + r() * 240, 2 + r() * 4, 2); }
  mc.fillStyle = 'rgba(255,255,255,0.75)'; for (let x = 0; x < S.W; x += 260) mc.fillRect(x, 1860, 150, 10);
  // trunks: phượng (left of gate) + dầu trees
  const phX = 250;
  mc.fillStyle = lgr(mc, phX - 40, 0, phX + 40, 0, [[0, '#4a3a2e'], [0.6, '#7a6650'], [1, '#3a2e24']]);
  mc.beginPath(); mc.moveTo(phX - 42, 1480); mc.bezierCurveTo(phX - 30, 1200, phX - 70, 900, phX - 10, 600); mc.lineTo(phX + 30, 610); mc.bezierCurveTo(phX - 20, 900, phX + 20, 1200, phX + 40, 1480); mc.closePath(); mc.fill();
  mc.strokeStyle = '#5a4636'; mc.lineCap = 'round';
  for (const [x1, y1, w] of [[-200, 260, 26], [500, 300, 24], [150, 180, 18], [700, 420, 16]]) { mc.lineWidth = w; mc.beginPath(); mc.moveTo(phX + 5, 640); mc.quadraticCurveTo((phX + x1) / 2, 420, x1, y1); mc.stroke(); }
  mc.fillStyle = 'rgba(30,25,25,0.3)'; ell(mc, phX, 1482, 70, 12); mc.fill();
  // tree grate
  mc.fillStyle = '#6d6a64'; mc.fillRect(phX - 80, 1476, 160, 14);
  for (const [dx, h, w] of [[1380, 1500, 66], [2240, 1500, 60]]) { dauTrunk(mc, dx, 1470, h, w, dx); mc.fillStyle = 'rgba(30,25,25,0.3)'; ell(mc, dx, 1472, 60, 10); mc.fill(); }
  // electric pole + wire tangle
  const poleX = 2010;
  mc.fillStyle = lgr(mc, poleX - 18, 0, poleX + 18, 0, [[0, '#8f8b84'], [0.6, '#c9c3b6'], [1, '#77736c']]); mc.fillRect(poleX - 18, 120, 36, 1440);
  mc.fillStyle = '#444'; mc.fillRect(poleX - 60, 300, 120, 10); mc.fillRect(poleX - 30, 340, 60, 40);
  wires(mc, -100, 330, poleX, 310, 7, 11); wires(mc, poleX, 310, S.W + 100, 360, 6, 12);
  for (let i = 0; i < 4; i++) { mc.strokeStyle = '#1c1a1c'; mc.lineWidth = 3; mc.beginPath(); mc.arc(poleX + (i - 1.5) * 16, 400 + i * 12, 22, 0, PI * 1.6); mc.stroke(); }
  // canopies (phượng red over the left, dầu green over the right)
  canopy(mc, 200, 240, 360, { seed: 5, col: ['#264a26', '#3f7a34', '#7fb04a'], flowers: 1.25, leaf: 13, n: 2600, squash: 0.55 });
  canopy(mc, 640, 170, 260, { seed: 6, col: ['#264a26', '#3f7a34', '#7fb04a'], flowers: 1.1, leaf: 12, n: 1500, squash: 0.5 });
  canopy(mc, 1400, 40, 300, { seed: 7, col: ['#1f4426', '#34683a', '#6f9e4a'], leaf: 12, n: 1700, squash: 0.45 });
  canopy(mc, 2250, 60, 320, { seed: 8, col: ['#1f4426', '#34683a', '#6f9e4a'], leaf: 12, n: 1800, squash: 0.45 });
  canopy(mc, 1840, -30, 220, { seed: 9, col: ['#264a26', '#3f7a34', '#7fb04a'], flowers: 1.2, leaf: 12, n: 1000, squash: 0.5 });
  // dappled leaf shadows on the wall + sidewalk
  for (let i = 0; i < 160; i++) {
    const x = r() * S.W, y = lerp(S.WALL_TOP, S.CURB, r());
    mc.fillStyle = 'rgba(70,50,60,0.13)'; ell(mc, x, y, 20 + r() * 60, 8 + r() * 22); mc.fill();
  }
  // long diagonal shadows of trunks/pole across the sidewalk (sun upper-right)
  for (const sx of [phX, 1380, 2240, poleX]) { mc.fillStyle = 'rgba(40,40,60,0.22)'; mc.beginPath(); mc.moveTo(sx - 20, 1480); mc.lineTo(sx + 20, 1480); mc.lineTo(sx - 240, S.CURB); mc.lineTo(sx - 310, S.CURB); mc.closePath(); mc.fill(); }
  // ---- FG (x1.35): blurred parked bikes + hanging phượng branch
  const FW = 2900;
  const [fgT, ft] = canvas(FW, H);
  for (const [bx, fl] of [[260, 1], [1480, -1], [2560, 1]]) motorbikeParent(ft, bx, 2000, 1.35, 0, { flip: fl < 0, empty: true, seed: bx });
  canopy(ft, 1050, -40, 230, { seed: 31, col: ['#2a4a26', '#467a36', '#86b04e'], flowers: 1.4, leaf: 18, n: 700, squash: 0.5 });
  canopy(ft, 2300, -60, 200, { seed: 32, col: ['#2a4a26', '#467a36', '#86b04e'], flowers: 1.4, leaf: 18, n: 600, squash: 0.5 });
  const [fg, fgc] = canvas(FW, H);
  fgc.filter = 'blur(7px)'; fgc.drawImage(fgT, 0, 0); fgc.filter = 'none';
  ST_C = { far, back, main, fg };
  return ST_C;
}
// gate leaves (inward swing). k: 0 closed .. 1 open
function gateLeaves(ctx, ox, k) {
  const S = STREET, hl = S.GATE_W / 2, top = S.GATE_TOP, bot = S.WALL_Y - 4, th = Math.min(1, k) * 1.45;
  for (const side of [-1, 1]) {
    const hx0 = S.GATE_X + ox + side * hl; // hinge at pillar
    const wv = hl * Math.cos(th), rise = Math.sin(th) * 34, shrink = Math.sin(th) * 0.08;
    const fx = hx0 - side * wv; // free edge
    const ft = top - rise * 0.2 + (bot - top) * shrink * 0.5, fb = bot - rise;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(hx0, top); ctx.lineTo(fx, ft); ctx.lineTo(fx, fb); ctx.lineTo(hx0, bot); ctx.closePath();
    ctx.clip();
    const bars = 13;
    ctx.strokeStyle = '#2c5a60'; ctx.lineWidth = Math.max(2, 9 * Math.cos(th) + 2);
    for (let i = 0; i <= bars; i++) { const u = i / bars, x = lerp(hx0, fx, u); ctx.beginPath(); ctx.moveTo(x, lerp(top, ft, u) - 30); ctx.lineTo(x, lerp(bot, fb, u)); ctx.stroke(); }
    ctx.lineWidth = 14;
    for (const v of [0.06, 0.5, 0.94]) { ctx.beginPath(); ctx.moveTo(hx0, lerp(top, bot, v)); ctx.lineTo(fx, lerp(ft, fb, v)); ctx.stroke(); }
    ctx.restore();
    // finials
    ctx.fillStyle = '#d9b14a';
    for (let i = 0; i <= bars; i += 2) { const u = i / bars, x = lerp(hx0, fx, u), y = lerp(top, ft, u); ctx.beginPath(); ctx.moveTo(x - 5, y + 2); ctx.lineTo(x, y - 16); ctx.lineTo(x + 5, y + 2); ctx.fill(); }
    // frame + rim light
    ctx.strokeStyle = '#1f4448'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(hx0, top); ctx.lineTo(fx, ft); ctx.lineTo(fx, fb); ctx.lineTo(hx0, bot); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,130,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx0, top - 2); ctx.lineTo(fx, ft - 2); ctx.stroke();
  }
}
// schoolStreet(ctx,t,panX,o) -> {ox, gate:[x,y], cart:[x,y], sun:[x,y]}
// o: {mid(ctx,ox), yard(ctx,oxBack), gateOpen 0..1, sun 0..1, crowd 0..1, cart true, fg true, petals 0..1, parents true}
function schoolStreet(ctx, t, panX = 0, o = {}) {
  const C = buildStreet(), S = STREET, sunK = o.sun === undefined ? 1 : o.sun;
  const ox = -panX;
  ctx.drawImage(C.far, -panX * S.FAR_F - 40, 0);
  const sunX = 930 - panX * 0.12, sunY = 210;
  glow(ctx, sunX, sunY, 520, 'rgba(255,200,120,0.75)', sunK);
  ctx.drawImage(C.back, -panX * S.BACK_F, 0);
  if (o.yard) o.yard(ctx, -panX * S.BACK_F);
  gateLeaves(ctx, ox, o.gateOpen === undefined ? 1 : o.gateOpen);
  ctx.drawImage(C.main, ox, 0);
  // parents waiting on motorbikes along the wall
  if (o.parents !== false) {
    const crowd = o.crowd === undefined ? 1 : o.crowd;
    S.PARENTS.forEach(([px, fl], i) => { if (i / S.PARENTS.length < crowd) motorbikeParent(ctx, px + ox, S.PARENT_Y, 0.78, t, { flip: fl < 0, seed: i * 7 + 3, look: Math.sin(t * 0.6 + i) * 0.5 }); });
  }
  if (o.cart !== false) btCart(ctx, S.CART_X + ox, S.CART_Y, 0.95, { t, light: sunK });
  if (o.mid) o.mid(ctx, ox);
  if (o.fg !== false) ctx.drawImage(C.fg, -panX * S.FG_F - 120, 0);
  // light
  if (sunK > 0) {
    godRays(ctx, sunX, sunY, 2.05, 1.0, 2300, 10, 'rgba(255,210,150,0.6)', 0.2 * sunK, t);
    dust(ctx, t, 7, 50, 0, 300, W, 1300, '255,225,170', 2.6, 0.55 * sunK);
    flare(ctx, sunX, sunY, 0.55, 0.35 * sunK);
  }
  if (o.petals) fallingPetals(ctx, t, 41, Math.round(26 * o.petals), 0, -100, W, 1700);
  return { ox, gate: [S.GATE_X + ox, S.WALL_Y], cart: [S.CART_X + ox, S.CART_Y], sun: [sunX, sunY] };
}
// red phượng petals drifting down (screen space)
function fallingPetals(ctx, t, seed, n, x0, y0, w, h) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const sp = 60 + r() * 80, ph = r(), bx = r() * w, sz = 6 + r() * 7;
    const life = ((t * sp / h) + ph) % 1, y = y0 + life * h, x = x0 + bx + Math.sin(t * 1.5 + i) * 40 + life * 80;
    const a = t * (2 + r() * 3) + i;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(1, Math.abs(Math.sin(a * 0.7)) * 0.8 + 0.2);
    ctx.fillStyle = r() < 0.5 ? COL.phuong : COL.phuongL; ell(ctx, 0, 0, sz, sz * 0.6); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- school drum (s2)
// origin = floor centre of the stand. s=1: drum ~330 wide, centre at y=-250. head faces +x.
// o: {hit 0..1 (0 = stick drawn back, 1 = impact), t, arm (draw striking arm, default true), stick true}
function schoolDrum(ctx, x, y, s, o = {}) {
  const hit = o.hit || 0, t = o.t || 0;
  let ret = {};
  at(ctx, x, y, 0, s, s, () => {
    const W2 = 160, R = 120, cy = -250;
    // stand
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 22; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 150, 0); ctx.lineTo(sx * 95, cy + 40); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sx * 40, 0); ctx.lineTo(sx * 95, cy + 40); ctx.stroke(); }
    ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-130, -70); ctx.lineTo(130, -70); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 0, 2, 190, 16); ctx.fill();
    // body (barrel)
    const vib = hit > 0.85 ? Math.sin(t * 90) * 2 * (hit - 0.85) / 0.15 : 0;
    ctx.save(); ctx.translate(vib, 0);
    ctx.beginPath(); ctx.moveTo(-W2, cy - R * 0.9); ctx.quadraticCurveTo(0, cy - R * 1.15, W2, cy - R * 0.9); ctx.lineTo(W2, cy + R * 0.9); ctx.quadraticCurveTo(0, cy + R * 1.15, -W2, cy + R * 0.9); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, cy - R, 0, cy + R, [[0, '#e0503a'], [0.35, '#b8271c'], [0.8, '#7a140f'], [1, '#4a0c08']]); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(255,220,180,0.25)'; ctx.fillRect(-W2, cy - R * 0.75, W2 * 2, 16);
    for (const bx of [-W2 + 30, W2 - 50]) { ctx.fillStyle = '#d9a43a'; ctx.fillRect(bx, cy - R * 1.2, 18, R * 2.4); ctx.fillStyle = 'rgba(255,240,180,0.5)'; ctx.fillRect(bx + 3, cy - R * 1.2, 4, R * 2.4); }
    ctx.restore();
    // studs
    for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) { const a = -PI / 2 + (i / 8 - 0.5) * PI * 0.9, px = sx * (W2 - 12), py = cy + Math.sin(a + PI / 2) * R * 0.95 * (i / 8 * 2 - 1) ; ctx.fillStyle = '#f2cf6a'; ell(ctx, px, cy + (i / 8 - 0.5) * R * 1.7, 5, 5); ctx.fill(); }
    // hide head (ellipse on +x side)
    const ripple = hit > 0.9 ? (hit - 0.9) / 0.1 : 0;
    ell(ctx, W2, cy, 34, R * 0.92); ctx.fillStyle = rgr(ctx, W2 - 6, cy - 20, 4, W2, cy, R, [[0, '#f6e2b4'], [0.7, '#d9bb84'], [1, '#9a7442']]); ctx.fill();
    ctx.strokeStyle = '#6a1a10'; ctx.lineWidth = 8; ctx.stroke();
    ell(ctx, W2 + 2, cy, 12, 34); ctx.fillStyle = 'rgba(200,40,30,0.55)'; ctx.fill(); // red centre mark
    if (ripple > 0) for (let i = 0; i < 3; i++) { ell(ctx, W2, cy, 10 + 24 * (ripple + i * 0.3), (30 + 80 * (ripple + i * 0.3)) * 0.92); ctx.strokeStyle = `rgba(255,240,200,${(1 - ripple) * 0.6})`; ctx.lineWidth = 3; ctx.stroke(); }
    // rim light
    rimLine(ctx, () => { ctx.beginPath(); ctx.moveTo(-W2, cy - R * 0.9); ctx.quadraticCurveTo(0, cy - R * 1.15, W2, cy - R * 0.9); }, 'rgba(255,210,150,0.8)', 6);
    ctx.restore();
    // stick + arm
    const a = lerp(-1.25, 0.05, ease.in2(hit)), pv = [W2 + 250, cy - 40];
    const tip = [pv[0] + Math.cos(PI + a) * 210, pv[1] + Math.sin(PI + a) * 210];
    if (o.arm !== false) { P.forearm(ctx, W2 + 520, cy - 10, pv[0] + 30, pv[1] + 6, '#b77a52', '#5d7486', 62); }
    if (o.stick !== false) {
      seg(ctx, pv[0] + 30, pv[1] + 4, tip[0], tip[1], 22, 18, '#8a5a32');
      ell(ctx, tip[0], tip[1], 26, 26); ctx.fillStyle = '#e8dcc4'; ctx.fill(); ctx.strokeStyle = '#b8a888'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (o.arm !== false) P.hand(ctx, pv[0] + 18, pv[1] + 2, 0.55, PI + a, 'fist', ['#c98a62', '#8a5532']);
    const m = mapper(ctx); ret = { face: m(W2 + 20, cy), stick: m(tip[0], tip[1]) };
    if (hit > 0.92) { ctx.save(); ctx.globalCompositeOperation = 'screen'; PP.soundRings(ctx, W2 + 30, cy, (hit - 0.92) / 0.08, { n: 3, R: 260, dir: 0, spread: 2.2 }); ctx.restore(); }
  });
  return ret;
}

// ---------------------------------------------------------------- parent on a scooter
// origin = ground centre, faces +x (flip mirrors). s=1: ~430 long, rider head top ~ -400.
// o: {flip, seed, look (-1..1 head turn), empty (no rider), wave 0..1}
function motorbikeParent(ctx, x, y, s, t = 0, o = {}) {
  const r = rng((o.seed || 1) * 31 + 7);
  const bodyC = ['#c8312a', '#e9e6df', '#2f5f9a', '#1e1e22', '#e2a43a', '#5f8f6a', '#b9b2c8'][(r() * 7) | 0];
  const helm = ['#f2f2f2', '#d24a3a', '#3d6db0', '#f0c94a', '#ec8fb0', '#2a2a2a'][(r() * 6) | 0];
  const jacket = ['#f3b6c6', '#a9d4e8', '#f6e3a2', '#c9b6e8', '#e9f0f2', '#9fd6b4'][(r() * 6) | 0];
  at(ctx, x, y, 0, o.flip ? -s : s, s, () => {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 0, 2, 210, 16); ctx.fill();
    // wheels
    for (const wx of [-150, 150]) {
      ell(ctx, wx, -46, 46, 46); ctx.fillStyle = '#1a1a1c'; ctx.fill();
      ell(ctx, wx, -46, 26, 26); ctx.fillStyle = '#8d9096'; ctx.fill();
      ell(ctx, wx, -46, 10, 10); ctx.fillStyle = '#d0d3d8'; ctx.fill();
    }
    // body
    ctx.beginPath(); ctx.moveTo(-200, -96); ctx.quadraticCurveTo(-205, -165, -130, -178); ctx.lineTo(-20, -168); ctx.quadraticCurveTo(10, -120, 40, -96); ctx.lineTo(90, -96);
    ctx.lineTo(120, -230); ctx.quadraticCurveTo(140, -250, 170, -238); ctx.lineTo(175, -150); ctx.quadraticCurveTo(190, -96, 205, -70); ctx.lineTo(120, -70); ctx.lineTo(-90, -70); ctx.quadraticCurveTo(-190, -60, -200, -96); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -250, 0, -60, [[0, shade(bodyC, 0.25)], [0.5, bodyC], [1, shade(bodyC, -0.35)]]); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ell(ctx, -110, -150, 70, 9); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.moveTo(-160, -180); ctx.quadraticCurveTo(-90, -200, -10, -182); ctx.lineTo(-20, -168); ctx.lineTo(-150, -170); ctx.closePath(); ctx.fill(); // seat
    ctx.fillStyle = '#ddd'; ell(ctx, 172, -200, 12, 16); ctx.fill(); // headlight
    ctx.strokeStyle = '#222'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(130, -262); ctx.lineTo(180, -258); ctx.stroke(); // handlebar
    ctx.fillStyle = '#c9ccd2'; ell(ctx, 120, -282, 8, 12); ctx.fill(); // mirror
    ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(130, -262); ctx.lineTo(120, -280); ctx.stroke();
    if (!o.empty) {
      const br = Math.sin(t * 2 + (o.seed || 0)) * 2;
      // legs
      seg(ctx, -60, -190, 40, -168, 46, 40, '#3a3a48'); seg(ctx, 40, -168, 60, -96, 36, 30, '#3a3a48');
      ctx.fillStyle = '#2a2420'; rrect(ctx, 40, -104, 52, 14, 6); ctx.fill();
      // torso in sun jacket
      at(ctx, -55, -190, -0.1, 1, 1, () => {
        ctx.beginPath(); ctx.moveTo(-36, 10); ctx.quadraticCurveTo(-44, -80, -16, -142 + br); ctx.lineTo(30, -138 + br); ctx.quadraticCurveTo(46, -70, 40, 10); ctx.closePath();
        ctx.fillStyle = lgr(ctx, -40, 0, 40, 0, [[0, shade(jacket, -0.15)], [0.6, jacket], [1, shade(jacket, -0.3)]]); ctx.fill();
        // arm to handlebar
      });
      const sh = [-50, -320 + br];
      const el = ikPickY(sh[0], sh[1], 140, -262, 88, 88, 1);
      seg(ctx, sh[0], sh[1], el[0], el[1], 30, 26, shade(jacket, -0.08)); seg(ctx, el[0], el[1], 140, -262, 26, 22, shade(jacket, -0.08));
      ell(ctx, 142, -262, 12, 12); ctx.fillStyle = '#c98a62'; ctx.fill();
      // head with helmet + mask
      at(ctx, -40, -360 + br, (o.look || 0) * 0.25, 1, 1, () => {
        ell(ctx, 0, 0, 30, 34); ctx.fillStyle = '#d9a07a'; ctx.fill();
        ctx.fillStyle = '#e8eef2'; ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(31, 2); ctx.quadraticCurveTo(30, 30, 6, 32); ctx.quadraticCurveTo(-8, 22, -6, 4); ctx.fill(); // mask
        ctx.fillStyle = '#1a1210'; ell(ctx, 18, -6, 3, 3.5); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -4, 36, PI, TAU); ctx.lineTo(36, 0); ctx.quadraticCurveTo(10, -14, -36, -2); ctx.closePath(); ctx.fillStyle = helm; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ell(ctx, -6, -26, 14, 5); ctx.fill();
        ctx.fillStyle = 'rgba(30,30,40,0.6)'; ctx.fillRect(-30, -6, 60, 4);
      });
      if (o.wave) { const wv = Math.sin(t * 12) * 0.3; seg(ctx, -40, -310, -10 + wv * 30, -420, 22, 18, shade(jacket, -0.1)); ell(ctx, -10 + wv * 30, -428, 12, 14); ctx.fillStyle = '#c98a62'; ctx.fill(); }
    }
    rimLine(ctx, () => { ctx.beginPath(); ctx.moveTo(-200, -100); ctx.quadraticCurveTo(-205, -165, -130, -178); }, 'rgba(255,200,130,0.6)', 4);
  });
}

// =====================================================================================
// JARS, CART, COUNTER
// =====================================================================================
// texture painter for ingredient fills (used by jars, counter, bag cross-sections)
function fillTexture(c, type, x, y, w, h, seed = 1) {
  const r = rng(seed * 97 + type.length * 13);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const A = w * h;
  const base = { sate: '#8f1a0e', salt: '#e98552', jerky: '#5a1a0c', squid: '#e8b47a', eggs: '#efe6d0', peanuts: '#b97a3c', shallots: '#b8702a', mango: '#9cc24a', scallion: '#4f7f2a', strips: '#e9dcbc', mixed: '#b83a1c', tea: '#e39a3a' }[type] || '#888';
  c.fillStyle = base; c.fillRect(x, y, w, h);
  const n = Math.round(A / 60);
  if (type === 'sate') {
    c.fillStyle = lgr(c, 0, y, 0, y + h, [[0, '#ff6a2a'], [0.25, '#d0361a'], [1, '#6a0f08']]); c.fillRect(x, y, w, h);
    for (let i = 0; i < n * 0.8; i++) { c.fillStyle = r() < 0.6 ? '#5a0a04' : (r() < 0.5 ? '#ff8a3a' : '#e8c14a'); ell(c, x + r() * w, y + r() * h, 1.5 + r() * 3.5, 1 + r() * 2); c.fill(); }
  } else if (type === 'salt') {
    for (let i = 0; i < n * 3; i++) { c.fillStyle = ['#ffb07a', '#d9643a', '#fff0d8', '#f09060', '#b84a2a'][(r() * 5) | 0]; c.fillRect(x + r() * w, y + r() * h, 1.5 + r() * 2.5, 1.5 + r() * 2.5); }
  } else if (type === 'jerky' || type === 'squid' || type === 'mango' || type === 'strips' || type === 'shallots' || type === 'mixed') {
    const cols = { jerky: ['#3e0f06', '#7a2616', '#b4482a', '#5a1a0c'], squid: ['#f6d6a6', '#d98a4e', '#f2c88e', '#c47a3e'], mango: ['#b8d86a', '#7fb33a', '#d6e88a', '#5f9a2a'], strips: ['#f4ead2', '#d9c9a2', '#fff8e6', '#c9b68e'], shallots: ['#e8a24a', '#9a5a1e', '#f2c06a', '#c47a2a'], mixed: ['#e0602a', '#9e2f17', '#f4b06a', '#c84a1e'] }[type];
    const len = type === 'shallots' ? 7 : 22;
    for (let i = 0; i < n * 1.2; i++) {
      const px = x + r() * w, py = y + r() * h, a = r() * PI, l = len * (0.5 + r());
      c.strokeStyle = cols[(r() * 4) | 0]; c.lineWidth = type === 'jerky' ? 5 : type === 'shallots' ? 3 : 3.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(px - Math.cos(a) * l / 2, py - Math.sin(a) * l / 2); c.quadraticCurveTo(px + (r() - 0.5) * 8, py + (r() - 0.5) * 8, px + Math.cos(a) * l / 2, py + Math.sin(a) * l / 2); c.stroke();
    }
  } else if (type === 'eggs') {
    for (let i = 0; i < A / 700; i++) { const px = x + r() * w, py = y + r() * h; c.fillStyle = rgr(c, px - 4, py - 5, 1, px, py, 15, [[0, '#ffffff'], [0.7, '#f1e8d4'], [1, '#c9b894']]); c.beginPath(); c.ellipse(px, py, 11, 14, r() * PI, 0, TAU); c.fill(); }
  } else if (type === 'peanuts') {
    for (let i = 0; i < A / 90; i++) { const px = x + r() * w, py = y + r() * h; c.fillStyle = r() < 0.5 ? '#e8b878' : '#c98a4a'; c.beginPath(); c.ellipse(px, py, 5, 3.6, r() * PI, 0, TAU); c.fill(); c.fillStyle = 'rgba(120,60,20,0.35)'; c.fillRect(px - 1, py - 3, 1.2, 6); }
  } else if (type === 'scallion') {
    c.fillStyle = lgr(c, 0, y, 0, y + h, [[0, '#d8c24a'], [1, '#6a7a1a']]); c.fillRect(x, y, w, h);
    for (let i = 0; i < n; i++) { c.fillStyle = r() < 0.7 ? '#4f9a2e' : '#9ad04a'; ell(c, x + r() * w, y + r() * h, 2.5 + r() * 3, 2 + r() * 2); c.fill(); }
  } else if (type === 'tea') {
    c.fillStyle = lgr(c, 0, y, 0, y + h, [[0, '#f6c060'], [1, '#c8701e']]); c.fillRect(x, y, w, h);
  }
  // soft depth shading
  c.fillStyle = lgr(c, x, 0, x + w, 0, [[0, 'rgba(0,0,0,0.25)'], [0.3, 'rgba(0,0,0,0)'], [0.75, 'rgba(255,230,180,0.08)'], [1, 'rgba(0,0,0,0.3)']]); c.fillRect(x, y, w, h);
  c.restore();
}
// ---------------------------------------------------------------- glass jar
// origin = bottom centre. s=1: 160 wide x 232 tall (lid top at -232). Cached per (fill,label,open,level).
// o: {fill:'sate'|'salt'|'jerky'|'squid'|'eggs'|'peanuts'|'shallots'|'mango'|'scallion'|'strips', label (text, '' none), lid colour, open, level 0..1}
const JAR_CACHE = {}; const JAR_RES = 2;
function jar(ctx, x, y, s, o = {}) {
  const fill = o.fill || 'sate', label = o.label === undefined ? '' : o.label, open = !!o.open, level = o.level === undefined ? 0.8 : o.level, lid = o.lid || '#d0281c';
  const key = [fill, label, open, level, lid].join('|');
  if (!JAR_CACHE[key]) {
    const [cv, c] = canvas(200 * JAR_RES, 270 * JAR_RES);
    c.scale(JAR_RES, JAR_RES); c.translate(100, 255);
    c.fillStyle = 'rgba(0,0,0,0.25)'; ell(c, 0, 2, 86, 10); c.fill();
    // contents
    const top = -8 - 172 * level;
    c.save(); rrect(c, -73, -195, 146, 189, 16); c.clip();
    fillTexture(c, fill, -73, top, 146, -top, fill.length * 7 + 3);
    if (open || true) { ell(c, 0, top, 73, 12); c.fillStyle = rgba(fill === 'sate' ? '#ff7a34' : '#ffffff', fill === 'sate' ? 0.55 : 0.18); c.fill(); }
    c.restore();
    // glass body
    rrect(c, -80, -200, 160, 200, 20); c.fillStyle = 'rgba(200,230,240,0.13)'; c.fill();
    c.strokeStyle = 'rgba(235,250,255,0.55)'; c.lineWidth = 4; c.stroke();
    c.fillStyle = lgr(c, -80, 0, 80, 0, [[0, 'rgba(255,255,255,0.0)'], [0.12, 'rgba(255,255,255,0.55)'], [0.2, 'rgba(255,255,255,0.08)'], [0.78, 'rgba(255,255,255,0.0)'], [0.88, 'rgba(255,220,170,0.4)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(-80, -196, 160, 192);
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-62, -186, 6, 150);
    ell(c, 0, -2, 78, 8); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 3; c.stroke();
    // neck
    c.fillStyle = 'rgba(220,240,250,0.3)'; c.fillRect(-66, -212, 132, 14);
    if (!open) {
      // lid
      c.fillStyle = lgr(c, 0, -236, 0, -204, [[0, shade(lid, 0.3)], [0.5, lid], [1, shade(lid, -0.4)]]);
      rrect(c, -72, -236, 144, 32, 8); c.fill();
      c.strokeStyle = rgba('#000000', 0.18); c.lineWidth = 2; for (let i = -64; i <= 64; i += 8) { c.beginPath(); c.moveTo(i, -232); c.lineTo(i, -208); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(-66, -233, 132, 4);
    } else {
      ell(c, 0, -210, 66, 11); c.strokeStyle = 'rgba(240,250,255,0.7)'; c.lineWidth = 4; c.stroke();
    }
    if (label) {
      c.fillStyle = '#fff6dc'; rrect(c, -66, -128, 132, 52, 6); c.fill();
      c.strokeStyle = lid; c.lineWidth = 3; rrect(c, -61, -123, 122, 42, 4); c.stroke();
      let fs = 30; c.font = `${fs}px BodySansBold`; while (c.measureText(label).width > 112 && fs > 12) { fs -= 1; c.font = `${fs}px BodySansBold`; }
      txt(c, label, 0, -101, `${fs}px BodySansBold`, '#b8231a');
    }
    JAR_CACHE[key] = cv;
  }
  const cv = JAR_CACHE[key];
  ctx.drawImage(cv, x - 100 * s, y - 255 * s, 200 * s, 270 * s);
  return { mouth: [x, y - 210 * s], top: [x, y - 236 * s] };
}
// chili-oil (sa tế) jar, open by default; o: {open=true, label='SA TẾ', level, spoon (draw spoon in it)}
function chiliOilJar(ctx, x, y, s, o = {}) {
  if (o.spoon) spoon(ctx, x + 12 * s, y - 120 * s, s * 0.85, 2.05, { fill: 'sate' }); // bowl sunk in the oil, handle up-right out of the mouth
  const r = jar(ctx, x, y, s, { fill: 'sate', label: o.label === undefined ? 'SA TẾ' : o.label, open: o.open === undefined ? true : o.open, level: o.level === undefined ? 0.82 : o.level });
  return r;
}
// muối tôm (shrimp salt) jar
function shrimpSaltJar(ctx, x, y, s, o = {}) {
  return jar(ctx, x, y, s, { fill: 'salt', label: o.label === undefined ? 'MUỐI TÔM' : o.label, open: !!o.open, level: o.level === undefined ? 0.75 : o.level, lid: '#e0a020' });
}

// ---------------------------------------------------------------- the cart (xe bánh tráng)
// origin = floor centre, front view. s=1: 340 wide, counter at y=-220, glass top -280, sign top -470 (matches characters at s=1).
const CART = { U: 0.5, RES: 1.7, BX: 360, BY: 960, COUNTER: -220, TOP: -280, SIGN: -415 };
const CART_JARS = [['sate', 'SA TẾ'], ['salt', 'MUỐI TÔM'], ['jerky', 'KHÔ BÒ'], ['squid', 'KHÔ MỰC'], ['eggs', 'TRỨNG CÚT'], ['peanuts', 'ĐẬU PHỘNG'], ['shallots', 'HÀNH PHI'], ['mango', 'XOÀI']];
let CART_CV = null;
function buildCart() {
  if (CART_CV) return CART_CV;
  const R = CART.RES, [cv, c] = canvas(CART.BX * 2 * R, CART.BY * R);
  c.scale(R, R); c.translate(CART.BX, CART.BY - 40);
  const steel = (x0, x1, a = 1) => lgr(c, x0, 0, x1, 0, [[0, '#8c949b'], [0.18, '#e6eaee'], [0.4, '#aab2b9'], [0.7, '#d4d9de'], [1, '#7a838a']]);
  // shadow
  c.fillStyle = 'rgba(20,20,30,0.35)'; ell(c, 0, 4, 330, 26); c.fill();
  // wheels (bicycle style)
  for (const wx of [-235, 235]) {
    c.lineWidth = 14; c.strokeStyle = '#1b1b1d'; c.beginPath(); c.arc(wx, -66, 60, 0, TAU); c.stroke();
    c.lineWidth = 4; c.strokeStyle = '#b9c0c6'; c.beginPath(); c.arc(wx, -66, 50, 0, TAU); c.stroke();
    c.lineWidth = 1.6; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; c.beginPath(); c.moveTo(wx, -66); c.lineTo(wx + Math.cos(a) * 50, -66 + Math.sin(a) * 50); c.stroke(); }
    c.fillStyle = '#d9dee2'; ell(c, wx, -66, 9, 9); c.fill();
    c.strokeStyle = 'rgba(255,210,150,0.6)'; c.lineWidth = 3; c.beginPath(); c.arc(wx, -66, 62, -1.4, 0.2); c.stroke();
  }
  // leg + chassis
  c.fillStyle = steel(-290, 290); c.fillRect(-300, -150, 600, 16);
  c.fillStyle = '#6b7279'; c.fillRect(-12, -134, 24, 120); c.fillRect(-40, -18, 80, 12);
  // lower cabinet
  c.fillStyle = steel(-280, 280); rrect(c, -282, -428, 564, 282, 8); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2; c.stroke();
  for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(-280, -426 + i * 4.7, 560, 1); }
  // red decal panel
  c.fillStyle = lgr(c, 0, -410, 0, -168, [[0, '#e0402c'], [1, '#a8170f']]); rrect(c, -258, -410, 516, 242, 14); c.fill();
  c.strokeStyle = '#ffd84a'; c.lineWidth = 5; rrect(c, -248, -400, 496, 222, 10); c.stroke();
  txt(c, 'CÔ BA', 0, -335, '92px TitleSerif', '#ffe25a');
  c.save(); c.globalAlpha = 0.35; txt(c, 'CÔ BA', 3, -330, '92px TitleSerif', '#5a0a04'); c.restore(); txt(c, 'CÔ BA', 0, -335, '92px TitleSerif', '#ffe25a');
  c.fillStyle = '#ffd84a'; c.fillRect(-170, -282, 340, 3);
  txt(c, 'BÁNH TRÁNG  •  TRÀ TẮC', 0, -245, '32px BodySansBold', '#fff6e0');
  txt(c, 'Ngon – Bổ – Rẻ', 0, -205, 'italic 26px BodySans', '#ffd84a');
  // chili + bag icons on the decal
  for (const sx of [-1, 1]) {
    c.save(); c.translate(sx * 200, -330); c.rotate(sx * 0.5);
    c.fillStyle = '#ff5a2a'; c.beginPath(); c.moveTo(0, -36); c.quadraticCurveTo(18, -10, 6, 34); c.quadraticCurveTo(-2, 40, -6, 30); c.quadraticCurveTo(-10, -6, 0, -36); c.fill();
    c.fillStyle = '#4f9a2e'; c.beginPath(); c.moveTo(-6, -36); c.quadraticCurveTo(0, -48, 8, -40); c.lineTo(4, -32); c.fill();
    c.restore();
  }
  // counter plate
  c.fillStyle = steel(-300, 300); c.fillRect(-304, -448, 608, 22);
  c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillRect(-304, -448, 608, 3);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-300, -426, 600, 5);
  // glass display (one row of 8 jars)
  const gT = -560, gB = -448;
  c.fillStyle = 'rgba(40,70,80,0.55)'; c.fillRect(-282, gT, 564, gB - gT);
  c.fillStyle = lgr(c, 0, gT, 0, gB, [[0, 'rgba(255,220,160,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(-282, gT, 564, gB - gT);
  CART_JARS.forEach(([f, l], i) => {
    const jx = -245 + i * 70;
    c.save(); c.translate(jx, gB - 2); c.scale(0.42, 0.42); c.translate(-jx, -(gB - 2));
    // draw jar inline (cache-based)
    c.restore();
    jar(c, jx, gB - 3, 0.42, { fill: f, label: l, lid: i % 2 ? '#e0a020' : '#d0281c', level: 0.78 });
  });
  // glass panes + reflections
  c.fillStyle = 'rgba(210,235,245,0.12)'; c.fillRect(-282, gT, 564, gB - gT);
  c.save(); c.beginPath(); c.rect(-282, gT, 564, gB - gT); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.22)';
  for (const [x0, w] of [[-250, 40], [-180, 14], [40, 60], [130, 18]]) { c.beginPath(); c.moveTo(x0, gT); c.lineTo(x0 + w, gT); c.lineTo(x0 + w - 80, gB); c.lineTo(x0 - 80, gB); c.closePath(); c.fill(); }
  c.restore();
  c.fillStyle = steel(-290, 290); for (const px of [-290, -6, 278]) c.fillRect(px, gT, 12, gB - gT);
  c.fillStyle = steel(-300, 300); c.fillRect(-300, gT - 14, 600, 16);
  c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(-300, gT - 14, 600, 3);
  // sign poles + board
  c.fillStyle = steel(-290, -276); c.fillRect(-286, -880, 12, 330); c.fillStyle = steel(274, 288); c.fillRect(274, -880, 12, 330);
  c.fillStyle = 'rgba(0,0,0,0.3)'; rrect(c, -306, -906, 620, 146, 14); c.fill();
  c.fillStyle = lgr(c, 0, -910, 0, -770, [[0, '#ff4a32'], [0.55, '#d4241a'], [1, '#9a1610']]); rrect(c, -310, -912, 620, 144, 14); c.fill();
  c.strokeStyle = '#ffd84a'; c.lineWidth = 6; rrect(c, -298, -900, 596, 120, 10); c.stroke();
  { let fs = 70; c.font = fs + 'px TitleSerif'; while (c.measureText('BÁNH TRÁNG TRỘN').width > 540 && fs > 30) { fs -= 2; c.font = fs + 'px TitleSerif'; }
    c.save(); c.globalAlpha = 0.4; txt(c, 'BÁNH TRÁNG TRỘN', 4, -836, fs + 'px TitleSerif', '#4a0804'); c.restore();
    txt(c, 'BÁNH TRÁNG TRỘN', 0, -840, fs + 'px TitleSerif', '#ffe25a'); }
  c.fillStyle = 'rgba(255,255,255,0.25)'; rrect(c, -300, -908, 600, 16, 8); c.fill();
  // little bulbs under the sign
  for (let i = 0; i < 13; i++) { const bx = -270 + i * 45, by = -758 + Math.sin(i / 12 * PI) * 10; c.strokeStyle = '#2a2a2a'; c.lineWidth = 2; if (i) { c.beginPath(); c.moveTo(bx - 45, -758 + Math.sin((i - 1) / 12 * PI) * 10); c.lineTo(bx, by); c.stroke(); } c.fillStyle = '#fff1b0'; ell(c, bx, by + 8, 6, 8); c.fill(); }
  // items on the glass top: rice-paper stack (left), trà tắc cups (right), egg tray (middle-left)
  riceSheetStack(c, -170, gT - 14, 0.42, { n: 26 });
  for (let i = 0; i < 3; i++) traTac(c, 150 + i * 56, gT - 14, 0.36, { level: 0.85, ice: true });
  c.fillStyle = '#7a4a2a'; rrect(c, -60, gT - 40, 110, 26, 6); c.fill();
  for (let i = 0; i < 6; i++) { quailEgg(c, -46 + i * 17, gT - 46, 0.32, { peel: 1 }); }
  // bundle of plastic bags hanging from the right pole
  c.strokeStyle = '#555'; c.lineWidth = 3; c.beginPath(); c.moveTo(286, -700); c.quadraticCurveTo(320, -700, 318, -670); c.stroke();
  for (let i = 0; i < 4; i++) { c.save(); c.translate(312 + i * 5, -640 + i * 4); c.rotate(0.05 * i); c.fillStyle = 'rgba(235,245,250,0.35)'; rrect(c, -26, -30, 52, 88, 12); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.stroke(); c.restore(); }
  // warm rim light on the right edges
  c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(255,190,110,0.35)';
  c.fillRect(268, -428, 14, 282); c.fillRect(282, -912, 18, 144); c.fillRect(286, -560, 10, 112);
  c.restore();
  CART_CV = cv;
  return cv;
}
// big red/white street parasol (dù) planted behind the cart. origin = pole foot; canopy rim y≈-560, apex -690, rx 300 (s=1).
function beachUmbrella(ctx, x, y, s, t = 0) {
  const RIM = -560, RX = 280, RY = 40, AP = -700, N = 12, sway = Math.sin(t * 1.3) * 0.012;
  at(ctx, x, y, sway, s, s, () => {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.fillStyle = lgr(ctx, -4, 0, 4, 0, [[0, '#8d9296'], [0.5, '#e6e9eb'], [1, '#6b7074']]); ctx.fillRect(-4, RIM - 30, 8, -RIM + 30 - 200);
    const P = (a) => [Math.cos(a) * RX, RIM + Math.sin(a) * RY];
    const RED = ['#e8432e', '#a8241a'], WHT = ['#f7f1e3', '#c9bfae'];
    // outer dome (back half, seen above the rim)
    for (let i = 0; i < N; i++) {
      const a0 = PI + i / (N / 2) * PI / 2 * 1, a1 = a0 + TAU / N; if (a0 >= TAU - 1e-6) break;
      const p0 = P(a0), p1 = P(a1), cl = i % 2 ? WHT : RED;
      ctx.beginPath(); ctx.moveTo(0, AP); ctx.quadraticCurveTo(p0[0] * 0.62, (AP + p0[1]) / 2 - 22, p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.quadraticCurveTo(p1[0] * 0.62, (AP + p1[1]) / 2 - 22, 0, AP); ctx.closePath();
      ctx.fillStyle = lgr(ctx, -RX, 0, RX, 0, [[0, cl[1]], [0.55, cl[0]], [0.8, cl[0]], [1, mixc(cl[0], '#fff1c8', 0.35)]]); ctx.fill();
      ctx.strokeStyle = 'rgba(60,20,20,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // underside (whole rim ellipse, in shade) with ribs
    for (let i = 0; i < N; i++) {
      const a0 = i * TAU / N, a1 = a0 + TAU / N, p0 = P(a0), p1 = P(a1), cl = i % 2 ? WHT : RED;
      ctx.beginPath(); ctx.moveTo(0, RIM - 14); ctx.lineTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.closePath();
      ctx.fillStyle = mixc(cl[1], '#3a1830', 0.25); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.beginPath(); ctx.ellipse(0, RIM, RX, RY, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = rgr(ctx, RX * 0.6, RIM, 10, RX * 0.6, RIM, RX, [[0, 'rgba(255,170,90,0.45)'], [1, 'rgba(255,170,90,0)']]); ctx.fillRect(-RX, RIM - RY, RX * 2, RY * 2); ctx.restore();
    ctx.strokeStyle = 'rgba(90,90,95,0.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < N; i++) { const p = P(i * TAU / N); ctx.beginPath(); ctx.moveTo(0, RIM - 14); ctx.lineTo(p[0], p[1]); ctx.stroke(); }
    // scalloped valance on the front rim
    for (let i = 0; i < N * 2; i++) {
      const a0 = i * PI / (N * 2), a1 = a0 + PI / (N * 2), p0 = P(a0), p1 = P(a1), cl = Math.floor(i / 2) % 2 ? WHT : RED;
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 30, p1[0], p1[1]); ctx.lineTo(p1[0], p1[1] - 6); ctx.lineTo(p0[0], p0[1] - 6); ctx.closePath();
      ctx.fillStyle = mixc(cl[0], '#ffd9a0', Math.max(0, Math.cos(a0)) * 0.3); ctx.fill(); ctx.strokeStyle = 'rgba(60,20,20,0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // rim edges + finial
    ctx.beginPath(); ctx.ellipse(0, RIM, RX, RY, 0, PI, TAU); ctx.strokeStyle = 'rgba(255,240,210,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#d8dcde'; ctx.beginPath(); ctx.arc(0, AP - 6, 8, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,215,150,0.6)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(4, AP + 2); ctx.quadraticCurveTo(RX * 0.62, (AP + RIM) / 2 - 22, RX - 4, RIM - 2); ctx.stroke(); ctx.restore();
  });
}
// btCart(ctx,x,y,s,o) -> {top:[x,y] glass-top centre (work surface), counter:[x,y], sign:[x,y], jars:[[x,y]...8]}
// o: {t, light 0..1 (glass glint + rim), umbrella (draw a big beach umbrella above)}
function btCart(ctx, x, y, s, o = {}) {
  const cv = buildCart(), k = s * CART.U, t = o.t || 0;
  if (o.umbrella) {
    beachUmbrella(ctx, x - 24 * s, y, s, t);
  }
  ctx.drawImage(cv, x - CART.BX * k, y - (CART.BY - 40) * k, CART.BX * 2 * k, CART.BY * k);
  const L = o.light === undefined ? 1 : o.light;
  if (L > 0) { // moving glint across the glass
    const gx = x + (((t * 0.35) % 1.6) - 0.8) * 340 * k * 2;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 282 * k, y - 560 * k, 564 * k, 112 * k); ctx.clip();
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(255,235,200,${0.35 * L})`;
    ctx.beginPath(); ctx.moveTo(gx, y - 560 * k); ctx.lineTo(gx + 40 * k, y - 560 * k); ctx.lineTo(gx - 40 * k, y - 448 * k); ctx.lineTo(gx - 80 * k, y - 448 * k); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 13; i++) { const bx = x + (-270 + i * 45) * k, by = y + (-750 + Math.sin(i / 12 * PI) * 10) * k; glow(ctx, bx, by, 26 * k, 'rgba(255,220,140,0.8)', 0.5 + 0.3 * Math.sin(t * 3 + i)); }
  }
  return { top: [x, y - 574 * k], counter: [x, y - 448 * k], sign: [x, y - 840 * k], jars: CART_JARS.map((_, i) => [x + (-245 + i * 70) * k, y - 500 * k]) };
}

// ---------------------------------------------------------------- counter close-up background
// counterTop(ctx,t,o) -> {y: counter surface line (1180), jars:[[x,y]...]}
// side view (default): blurred golden street behind, row of soft-focus jars on the back of a steel counter, surface y>=1180.
// o.top=true: top-down plain steel work surface (full frame) with dappled leaf light; o.board: draw a wooden cutting board (top view) centred.
const COUNTER_Y = 1180;
let CT_C = null, CT_TOP = null;
function counterTop(ctx, t, o = {}) {
  if (o.top) {
    if (!CT_TOP) {
      const [cv, c] = canvas(W, H), r = rng(808);
      c.fillStyle = lgr(c, 0, 0, W, H, [[0, '#d9dde0'], [0.5, '#aab1b7'], [1, '#7d858c']]); c.fillRect(0, 0, W, H);
      for (let i = 0; i < 900; i++) { c.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'; c.lineWidth = 1 + r(); const y0 = r() * H; c.beginPath(); c.moveTo(0, y0); c.lineTo(W, y0 + (r() - 0.5) * 30); c.stroke(); }
      for (let i = 0; i < 30; i++) { c.strokeStyle = 'rgba(60,60,70,0.12)'; c.lineWidth = 1; const x0 = r() * W, y0 = r() * H; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + (r() - 0.5) * 200, y0 + (r() - 0.5) * 60); c.stroke(); }
      // leaf dapple
      for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(40,50,70,0.1)'; ell(c, r() * W, r() * H, 40 + r() * 120, 20 + r() * 60); c.fill(); }
      c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = rgr(c, 820, 300, 50, 820, 300, 1200, [[0, 'rgba(255,190,110,0.55)'], [1, 'rgba(255,190,110,0)']]); c.fillRect(0, 0, W, H); c.restore();
      // rolled edge of the tray
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 10; c.strokeRect(30, 30, W - 60, H - 60);
      c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 6; c.strokeRect(42, 42, W - 84, H - 84);
      CT_TOP = cv;
    }
    ctx.drawImage(CT_TOP, 0, 0);
    if (o.board) {
      at(ctx, W / 2, H / 2, 0.04, 1, 1, () => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, 18, 22, 470, 470); ctx.fill();
        ctx.fillStyle = rgr(ctx, -80, -80, 50, 0, 0, 470, [[0, '#d9a86a'], [0.8, '#b8824a'], [1, '#8a5a2e']]); ell(ctx, 0, 0, 460, 460); ctx.fill();
        const r = rng(4); for (let i = 1; i < 14; i++) { ctx.strokeStyle = 'rgba(110,60,20,0.18)'; ctx.lineWidth = 2; ell(ctx, (r() - 0.5) * 20, (r() - 0.5) * 20, i * 32, i * 32); ctx.stroke(); }
        ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 8; ell(ctx, 0, 0, 458, 458); ctx.stroke();
      });
    }
    glow(ctx, 860 + Math.sin(t * 0.3) * 20, 260, 600, 'rgba(255,200,120,0.35)', 1);
    return { y: 0 };
  }
  if (!CT_C) {
    const [cv, c] = canvas(W, H), r = rng(77);
    // far background: golden street (blurred)
    const [bgT, bt] = canvas(W, COUNTER_Y + 120);
    bt.fillStyle = lgr(bt, 0, 0, 0, COUNTER_Y, [[0, '#7aa0a8'], [0.4, '#e9b878'], [1, '#c98a4a']]); bt.fillRect(0, 0, W, COUNTER_Y + 120);
    bt.fillStyle = '#e8b648'; bt.fillRect(0, 380, W, 600); // school wall
    for (let i = 0; i < 6; i++) { bt.fillStyle = '#3a6a3a'; ell(bt, r() * W, 120 + r() * 200, 200 + r() * 150, 120); bt.fill(); bt.fillStyle = COL.phuong; ell(bt, r() * W, 100 + r() * 200, 60 + r() * 60, 40); bt.fill(); }
    bt.fillStyle = '#c92b1f'; bt.fillRect(80, 560, 330, 90); // sign shapes
    for (let i = 0; i < 4; i++) { bt.fillStyle = ['#fbfbf6', '#2f8f8a', '#fbfbf6', '#1f2b4d'][i]; ell(bt, 520 + i * 140, 900, 50, 160); bt.fill(); } // passers-by blobs
    c.filter = 'blur(28px)'; c.drawImage(bgT, 0, 0); c.filter = 'none';
    // back row of jars (soft focus)
    const [jT, jt] = canvas(W, COUNTER_Y + 40);
    const jl = [['jerky', 'KHÔ BÒ'], ['salt', 'MUỐI TÔM'], ['eggs', 'TRỨNG CÚT'], ['sate', 'SA TẾ'], ['squid', 'KHÔ MỰC'], ['peanuts', 'ĐẬU PHỘNG']];
    jl.forEach(([f, l], i) => jar(jt, 90 + i * 180, COUNTER_Y - 10, 1.05, { fill: f, label: l, lid: i % 2 ? '#e0a020' : '#d0281c' }));
    c.filter = 'blur(6px)'; c.drawImage(jT, 0, 0); c.filter = 'none';
    // counter surface (steel, perspective)
    c.fillStyle = lgr(c, 0, COUNTER_Y, 0, H, [[0, '#e8ecef'], [0.08, '#b9c0c6'], [0.5, '#8d959c'], [1, '#5d656c']]); c.fillRect(0, COUNTER_Y, W, H - COUNTER_Y);
    for (let i = 0; i < 400; i++) { c.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; c.lineWidth = 1 + r(); const y0 = COUNTER_Y + r() * (H - COUNTER_Y); c.beginPath(); c.moveTo(0, y0); c.lineTo(W, y0 + (r() - 0.5) * 8); c.stroke(); }
    // reflections of the jars and the sun on steel
    c.save(); c.globalAlpha = 0.22; c.translate(0, COUNTER_Y * 2); c.scale(1, -1); c.filter = 'blur(10px)'; c.drawImage(jT, 0, 0); c.restore(); c.filter = 'none';
    c.fillStyle = 'rgba(255,255,255,0.65)'; c.fillRect(0, COUNTER_Y - 2, W, 4);
    c.fillStyle = lgr(c, 0, COUNTER_Y, 0, COUNTER_Y + 80, [[0, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]); c.fillRect(0, COUNTER_Y + 2, W, 80);
    CT_C = cv;
  }
  ctx.drawImage(CT_C, 0, 0);
  bokeh(ctx, t, 12, 14, ['rgba(255,210,140,0.9)', 'rgba(255,170,90,0.8)', 'rgba(255,240,200,0.9)'], 0.35, 30, 110);
  glow(ctx, 860 + Math.sin(t * 0.3) * 20, 300, 640, 'rgba(255,190,110,0.55)', 1);
  return { y: COUNTER_Y, jars: [0, 1, 2, 3, 4, 5].map((i) => [90 + i * 180, COUNTER_Y - 10]) };
}

// ================================================================ PEOPLE
const OUT = 'rgba(52,26,34,0.55)';
// capsule sub-path (no beginPath): (x0,y0)->(x1,y1), widths w0 -> w1
function capPath(ctx, x0, y0, x1, y1, w0, w1) {
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + PI / 2, a - PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - PI / 2, a + PI / 2, true);
  ctx.closePath();
}
// stroke-then-fill capsule (cartoon outline)
function capFS(ctx, x0, y0, x1, y1, w0, w1, fill, lw = 2.4, out = OUT) {
  ctx.beginPath(); capPath(ctx, x0, y0, x1, y1, w0, w1);
  if (lw) { ctx.strokeStyle = out; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function outFill(ctx, fill, lw = 2.4, out = OUT) { if (lw) { ctx.strokeStyle = out; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); } ctx.fillStyle = fill; ctx.fill(); }

// ---------------------------------------------------------------- cartoon hand
// Wrist at origin, fingers toward +x, thumb toward -y (o.flip mirrors so thumb is +y).
// ~100 units wrist->fingertip. kinds: open, flat, wave, grip, fist, pinch, point, thumb.
// o.glove: clear plastic glove overlay. o.skin: [light, dark].
function cHand(ctx, x, y, s, rot, o = {}) {
  const kind = o.kind || 'open', sk = o.skin || SKIN_BA, fl = o.flip ? -1 : 1;
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
      [[-15, -0.36, 37], [-5, -0.12, 44], [5, 0.1, 41], [14.5, 0.33, 32]].forEach(([yy, a, L], i) => {
        C(50, yy, 50 + Math.cos(a * sp) * L, yy + Math.sin(a * sp) * L * (kind === 'flat' ? 0.4 : 1), 13.5 - i * 0.6, 11 - i * 0.6);
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
    // knuckle hints + nails
    ctx.strokeStyle = 'rgba(110,50,35,0.32)'; ctx.lineWidth = 1.8;
    if (kind === 'grip' || kind === 'fist' || kind === 'thumb') {
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(46, -15 + i * 10.5); ctx.lineTo(52, -14.5 + i * 10.5); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(255,236,222,0.7)';
    if (kind === 'thumb') { ctx.beginPath(); ctx.ellipse(26, -57, 5, 4, 0, 0, TAU); ctx.fill(); }
    if (kind === 'point') { ctx.beginPath(); ctx.ellipse(94, -19, 4, 3.5, 0, 0, TAU); ctx.fill(); }
    // warm rim light along the top edge
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,200,130,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.bezierCurveTo(14, -25, 40, -25, 54, -17); ctx.stroke(); ctx.restore();
    if (o.glove) {
      // loose cuff past the wrist
      ctx.beginPath(); ctx.moveTo(-34, -21); ctx.lineTo(-8, -18); ctx.lineTo(-8, 18); ctx.lineTo(-34, 22); ctx.lineTo(-30, 10); ctx.lineTo(-36, 2); ctx.lineTo(-31, -8); ctx.closePath();
      ctx.fillStyle = 'rgba(236,246,252,0.2)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
      for (const p of parts) { ctx.beginPath(); p(ctx); ctx.fillStyle = 'rgba(236,246,252,0.13)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.42)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      // specular creases
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(4, -12); ctx.quadraticCurveTo(20, -18, 38, -14); ctx.stroke();
      ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(10, 6); ctx.quadraticCurveTo(22, 2, 30, 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-26, -12); ctx.lineTo(-16, -10); ctx.moveTo(-28, 8); ctx.lineTo(-18, 6); ctx.stroke();
    }
  });
}

// arm: shoulder -> elbow -> wrist. o: {wu:[w0,w1], wf:[w0,w1], skin, sleeve(fill), sleeveTo (0 none .. 1 elbow .. 2 wrist), cuff}
function cArm(ctx, sx, sy, ex, ey, wx, wy, o) {
  const sk = o.skin, wu = o.wu, wf = o.wf, st = o.sleeveTo || 0;
  capFS(ctx, ex, ey, wx, wy, wf[0], wf[1], sk[1]);
  capFS(ctx, sx, sy, ex, ey, wu[0], wu[1], sk[1]);
  // soft light on the upper side of skin
  ctx.save(); ctx.globalAlpha = 0.45; seg(ctx, lerp(ex, wx, 0.05), lerp(ey, wy, 0.05) - wf[0] * 0.15, lerp(ex, wx, 0.85), lerp(ey, wy, 0.85) - wf[1] * 0.15, wf[0] * 0.35, wf[1] * 0.3, sk[0]); ctx.restore();
  if (st > 0) {
    const fill = o.sleeve, k = Math.min(st, 1), ux = lerp(sx, ex, k), uy = lerp(sy, ey, k);
    capFS(ctx, sx, sy, ux, uy, wu[0] * 1.32, wu[1] * 1.3 + (st <= 1 ? 2 : 0), fill);
    if (st > 1) {
      const fx = lerp(ex, wx, st - 1), fy = lerp(ey, wy, st - 1);
      capFS(ctx, ex, ey, fx, fy, wu[1] * 1.3, wf[1] * 1.45, fill);
      ctx.beginPath(); capPath(ctx, ex, ey, ex, ey + 0.01, wu[1] * 1.3, wu[1] * 1.3); ctx.fillStyle = fill; ctx.fill(); // fill elbow seam
      if (o.cuff) { ctx.save(); ctx.globalAlpha = 0.35; seg(ctx, lerp(ex, fx, 0.9), lerp(ey, fy, 0.9), fx, fy, wf[1] * 1.45, wf[1] * 1.45, o.cuff); ctx.restore(); }
    } else {
      const a = Math.atan2(uy - sy, ux - sx), nx = -Math.sin(a), ny = Math.cos(a), hw = wu[1] * 0.62;
      const hx = lerp(sx, ux, 0.84), hy = lerp(sy, uy, 0.84);
      ctx.strokeStyle = 'rgba(110,110,135,0.42)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx + nx * hw, hy + ny * hw); ctx.quadraticCurveTo(hx + Math.cos(a) * 2, hy + Math.sin(a) * 2, hx - nx * hw, hy - ny * hw); ctx.stroke();
    }
  }
}
function handRot(ex, ey, wx, wy, bias = 0) { return Math.atan2(wy - ey, wx - ex) + bias; }
// hand at h (elbow el) grips a tied bag's knot; wrist bends down; returns bag centre (bag drawn at scale bs, rotated br).
function knotHang(h, el, hs, br, bs, setRot) {
  const r = handRot(el[0], el[1], h[0], h[1]) + 0.9; setRot(r);
  const kn = rot2(r, 50 * hs, 6 * hs), d = rot2(br, 0, 150 * bs);
  return [h[0] + kn[0] + d[0], h[1] + kn[1] + d[1]];
}

// ---------------------------------------------------------------- áo bà ba floral fabric
let _floralTile = null;
function floralTile() {
  if (_floralTile) return _floralTile;
  const [c, x] = canvas(128, 128);
  x.fillStyle = COL.aobaba; x.fillRect(0, 0, 128, 128);
  const r = rng(77);
  const flower = (cx, cy, rr, col, rot) => {
    x.fillStyle = col;
    for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; x.beginPath(); x.ellipse(cx + Math.cos(a) * rr * 0.62, cy + Math.sin(a) * rr * 0.62, rr * 0.55, rr * 0.36, a, 0, TAU); x.fill(); }
    x.fillStyle = '#ffd25e'; x.beginPath(); x.arc(cx, cy, rr * 0.26, 0, TAU); x.fill();
  };
  const leaf = (cx, cy, a) => { x.fillStyle = 'rgba(150,200,120,0.75)'; x.beginPath(); x.ellipse(cx, cy, 9, 3.6, a, 0, TAU); x.fill(); };
  const pts = [[24, 26, 15, 'rgba(255,240,248,0.95)'], [88, 18, 11, 'rgba(255,186,222,0.92)'], [70, 78, 16, 'rgba(255,240,248,0.95)'], [16, 98, 11, 'rgba(255,186,222,0.92)'], [112, 108, 9, 'rgba(255,222,240,0.9)']];
  for (const [cx, cy, rr] of pts) for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { leaf(cx + dx + rr, cy + dy + rr * 0.7, 0.6); leaf(cx + dx - rr * 0.9, cy + dy + rr * 0.9, -0.7); }
  for (const [cx, cy, rr, col] of pts) for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) flower(cx + dx, cy + dy, rr, col, r() * 3);
  x.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(r() * 128, r() * 128, 1.6, 0, TAU); x.fill(); }
  _floralTile = c; return c;
}
// pattern fill; tile = `unit` user units (default 34)
function floral(ctx, unit = 34) {
  const p = ctx.createPattern(floralTile(), 'repeat');
  try { p.setTransform(new (require('@napi-rs/canvas').DOMMatrix)().scale(unit / 128)); } catch (e) { /* older canvas: unscaled */ }
  return p;
}

// ---------------------------------------------------------------- nón lá (conical hat)
// Drawn in face units (head ≈ 300 wide). cy = brim centre, R = brim radius, ry = brim ellipse half-height
// (bigger = seen more from below), ap = apex y. part: 'back' (outer cone + inside) or 'front' (near rim + strap).
function nonLa(ctx, part, o = {}) {
  const cy = o.cy ?? -168, R = o.R ?? 400, ry = o.ry ?? 62, ap = o.ap ?? -505, tl = o.tilt || 0;
  ctx.save(); ctx.rotate(tl);
  if (part === 'back') {
    // outer surface above the far arc
    ctx.beginPath(); ctx.moveTo(-R, cy); ctx.lineTo(0, ap); ctx.lineTo(R, cy); ctx.ellipse(0, cy, R, ry, 0, 0, PI, true); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -R, 0, R, 0, [[0, '#fff0c4'], [0.35, '#efd9a0'], [0.7, '#d9bb78'], [1, '#a98a50']]);
    ctx.strokeStyle = 'rgba(90,60,30,0.55)'; ctx.lineWidth = 5; ctx.stroke(); ctx.fill();
    ctx.save(); ctx.clip();
    // bamboo hoop rings
    for (let i = 1; i <= 9; i++) {
      const u = i / 10, ccy = lerp(cy, ap, u), rx = R * (1 - u), rr = ry * (1 - u);
      ctx.strokeStyle = `rgba(140,100,50,${0.22 + 0.1 * (i % 2)})`; ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.ellipse(0, ccy, rx, rr, 0, PI, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,248,215,0.35)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, ccy - 3, rx, rr, 0, PI * 1.05, PI * 1.6); ctx.stroke();
    }
    // leaf seams (radial)
    ctx.strokeStyle = 'rgba(130,95,45,0.18)'; ctx.lineWidth = 2;
    for (let i = -7; i <= 7; i++) { ctx.beginPath(); ctx.moveTo(0, ap); ctx.lineTo(i * R / 7, cy - ry * Math.sqrt(1 - (i / 7) ** 2)); ctx.stroke(); }
    // backlit translucency glow near the top-left, shadow on right
    ctx.fillStyle = rgr(ctx, -R * 0.35, cy - 120, 10, -R * 0.35, cy - 120, R * 0.7, [[0, 'rgba(255,236,170,0.45)'], [1, 'rgba(255,236,170,0)']]); ctx.fillRect(-R, ap, R * 2, cy - ap);
    ctx.restore();
    // inside of the hat
    ctx.beginPath(); ctx.ellipse(0, cy, R, ry, 0, 0, TAU);
    ctx.fillStyle = rgr(ctx, 0, cy - ry * 0.3, 10, 0, cy, R, [[0, '#5e4122'], [0.45, '#8a6a3a'], [1, '#c9a764']]); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(70,45,20,0.35)'; ctx.lineWidth = 2.4;
    for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.ellipse(0, cy - ry * 0.35 * (i / 7), R * (i / 7), ry * (i / 7), 0, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ctx.beginPath(); ctx.moveTo(0, cy - ry * 0.4); ctx.lineTo(Math.cos(a) * R, cy + Math.sin(a) * ry); ctx.stroke(); }
    ctx.restore();
  } else {
    // forehead shadow is drawn by caller (needs face clip). near rim:
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(80,52,24,0.7)'; ctx.lineWidth = 15; ctx.beginPath(); ctx.ellipse(0, cy + 2, R, ry, 0, 0.02, PI - 0.02); ctx.stroke();
    ctx.strokeStyle = '#ead39a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.ellipse(0, cy, R, ry, 0, 0.02, PI - 0.02); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,225,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, cy - 3, R, ry, 0, PI * 0.45, PI - 0.05); ctx.stroke();
    // stitches on the rim
    ctx.strokeStyle = 'rgba(120,85,40,0.5)'; ctx.lineWidth = 2;
    for (let i = 1; i < 30; i++) { const a = i / 30 * PI, px = Math.cos(a) * R, py = cy + Math.sin(a) * ry; ctx.beginPath(); ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4); ctx.stroke(); }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Cô Ba face (close-up capable)
// origin between the eyes, head ≈ 290 wide, chin y≈195. o: expr 'smile'|'laugh'|'wink'|'talk'|'proud', t, turn -1..1, tilt,
// blink (0..1, default auto from t), hat (default true), hatTilt, hatRy, body (shoulders/áo to y 600, default true), talk 0..1, look [x,y]
function coBaFace(ctx, x, y, s, o = {}) {
  const ex = o.expr || 'smile', t = o.t || 0, tn = clamp(o.turn || 0, -1, 1), tx = tn * 60;
  const autoBlink = ((t + 0.37) % 3.3) < 0.13 ? 1 : 0;
  const bl = o.blink ?? autoBlink;
  const lk = o.look || [0, 0];
  const S = SKIN_BA;
  at(ctx, x, y, o.tilt || 0, s, s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const hat = o.hat !== false, hopt = { tilt: o.hatTilt || 0, ry: o.hatRy ?? 62, cy: -168 + Math.abs(o.hatTilt || 0) * 40 };
    if (hat) nonLa(ctx, 'back', hopt);
    // low bun peeking out when turned
    if (Math.abs(tn) > 0.15) { ctx.beginPath(); ctx.ellipse(-tn * 150, 150, 56, 50, 0, 0, TAU); ctx.fillStyle = '#1d1716'; ctx.fill(); }
    // shoulders in áo bà ba
    if (o.body !== false) {
      ctx.beginPath(); ctx.moveTo(-330, 600); ctx.quadraticCurveTo(-300, 300, -110, 262); ctx.lineTo(110, 262); ctx.quadraticCurveTo(300, 300, 330, 600); ctx.closePath();
      outFill(ctx, floral(ctx, 120), 5);
      ctx.save(); ctx.clip();
      ctx.fillStyle = lgr(ctx, -330, 0, 330, 0, [[0, 'rgba(255,190,120,0.25)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(30,10,50,0.35)']]); ctx.fillRect(-340, 250, 680, 360);
      // front placket + buttons
      ctx.strokeStyle = 'rgba(60,30,80,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(18, 275); ctx.lineTo(18, 600); ctx.stroke();
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(30, 340 + i * 90, 9, 0, TAU); ctx.fillStyle = '#efe6f6'; ctx.fill(); ctx.strokeStyle = 'rgba(80,50,90,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
    }
    // neck
    ctx.beginPath(); ctx.moveTo(-58 + tx * 0.3, 130); ctx.lineTo(-64, 278); ctx.quadraticCurveTo(0, 304, 64, 278); ctx.lineTo(58 + tx * 0.3, 130); ctx.closePath();
    ctx.fillStyle = lgr(ctx, -60, 0, 60, 0, [[0, S[1]], [1, S[2]]]); ctx.fill();
    ctx.fillStyle = 'rgba(70,30,20,0.25)'; ctx.beginPath(); ctx.ellipse(tx * 0.3, 175, 60, 26, 0, 0, TAU); ctx.fill();
    // round collar band
    ctx.strokeStyle = COL.aobabaD; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(-98, 266); ctx.quadraticCurveTo(0, 318, 98, 266); ctx.stroke();
    ctx.strokeStyle = COL.aobabaL; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-94, 260); ctx.quadraticCurveTo(0, 310, 94, 260); ctx.stroke();
    // ears + gold earrings
    for (const sx of [-1, 1]) {
      const exr = sx * (142 + sx * tx * -0.25) - tx * 0.2;
      ctx.beginPath(); ctx.ellipse(exr, 22, 24 * (1 + sx * tn * 0.6), 42, 0, 0, TAU); ctx.fillStyle = S[1]; ctx.fill();
      ctx.strokeStyle = 'rgba(120,60,40,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(exr, 22, 16, sx > 0 ? -1.2 : 1.9, sx > 0 ? 1.2 : 4.3); ctx.stroke();
      const sw = Math.sin(t * 5 + sx) * 0.15;
      ctx.save(); ctx.translate(exr, 62); ctx.rotate(sw);
      ctx.strokeStyle = '#e7b53a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 14, 12, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(-5, 6, 3, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // head shape (softer, rounder jaw)
    const head = new Path2D();
    head.moveTo(tx * 0.4, 196);
    head.bezierCurveTo(80 + tx * 0.5, 196, 140 + tx * 0.1, 130, 146 + tx * 0.1 - tn * 28, 20);
    head.bezierCurveTo(156, -100, 112, -210, tx * 0.2, -215);
    head.bezierCurveTo(-112, -210, -156, -100, -146 + tx * 0.1 - tn * 28, 20);
    head.bezierCurveTo(-140 + tx * 0.1, 130, -80 + tx * 0.5, 196, tx * 0.4, 196);
    ctx.fillStyle = rgr(ctx, -40 + tx, -30, 20, 0, 20, 230, [[0, S[0]], [0.72, S[1]], [1, S[2]]]);
    ctx.strokeStyle = 'rgba(90,40,30,0.45)'; ctx.lineWidth = 4; ctx.stroke(head); ctx.fill(head);
    ctx.save(); ctx.clip(head);
    // cheeks
    const bls = ex === 'laugh' ? 0.42 : 0.3;
    for (const sx of [-1, 1]) { ctx.save(); ctx.filter = 'blur(14px)'; ctx.beginPath(); ctx.ellipse(sx * 90 + tx, 78, 46, 30, 0, 0, TAU); ctx.fillStyle = `rgba(232,100,90,${bls})`; ctx.fill(); ctx.restore(); }
    // side shadow + warm backlight rim
    ctx.fillStyle = lgr(ctx, -160, 0, 160, 0, [[0, 'rgba(0,0,0,0)'], [0.68, 'rgba(0,0,0,0)'], [1, 'rgba(70,25,40,0.32)']]); ctx.fillRect(-200, -250, 400, 500);
    ctx.fillStyle = lgr(ctx, -160, 0, -96, 0, [[0, 'rgba(255,196,110,0.6)'], [1, 'rgba(255,196,110,0)']]); ctx.fillRect(-200, -250, 110, 500);
    ctx.restore();
    // eyes
    const happy = ex === 'smile' || ex === 'proud' || ex === 'talk';
    const eyeY = 0;
    for (const sx of [-1, 1]) {
      const exx = sx * 62 + tx * (sx === 1 ? 1.15 : 0.85), w = 46 * (1 + sx * tn * 0.45);
      const closed = ex === 'laugh' || (ex === 'wink' && sx === 1) || bl > 0.5;
      ctx.save(); ctx.translate(exx, eyeY);
      if (closed) {
        // happy closed eye: arc bowed upward
        ctx.strokeStyle = '#2a1712'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(-w * 0.85, 8); ctx.quadraticCurveTo(0, ex === 'laugh' || ex === 'wink' ? -22 : 6, w * 0.85, 8); ctx.stroke();
        // crow's feet
        ctx.strokeStyle = 'rgba(120,60,40,0.45)'; ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx * (w + 6), 6 + i * 9); ctx.lineTo(sx * (w + 22), 2 + i * 14); ctx.stroke(); }
      } else {
        const oh = happy ? 15 : 19;
        const ep = new Path2D(); ep.moveTo(-w, 4); ep.quadraticCurveTo(-w * 0.2, -oh * 1.5, w, 0); ep.quadraticCurveTo(w * 0.1, oh * (happy ? 0.55 : 1.1), -w, 4); ep.closePath();
        ctx.fillStyle = '#fbf3ea'; ctx.fill(ep);
        ctx.save(); ctx.clip(ep);
        const ix = lk[0] * 12, iy = lk[1] * 6 - 2;
        ctx.beginPath(); ctx.arc(ix, iy, 17, 0, TAU); ctx.fillStyle = rgr(ctx, ix, iy - 4, 2, ix, iy, 17, [[0, '#6a3a22'], [0.7, '#3a1d12'], [1, '#1e0e09']]); ctx.fill();
        ctx.beginPath(); ctx.arc(ix, iy, 8, 0, TAU); ctx.fillStyle = '#0b0605'; ctx.fill();
        ctx.beginPath(); ctx.arc(ix - 6, iy - 6, 5, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath(); ctx.arc(ix + 6, iy + 5, 2.4, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(90,40,30,0.25)'; ctx.fillRect(-w, -30, w * 2, 12);
        ctx.restore();
        // upper lid line + lashes
        ctx.strokeStyle = '#21110c'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(-w - 2, 5); ctx.quadraticCurveTo(-w * 0.2, -oh * 1.5 - 1, w + 4, -1); ctx.stroke();
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx * w, -2 * (sx > 0 ? 1 : -0.5)); ctx.lineTo(sx * (w + 9), -9); ctx.stroke();
        // lower lid (raised when happy)
        ctx.strokeStyle = 'rgba(120,60,40,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-w * 0.7, oh * 0.5 + 4); ctx.quadraticCurveTo(0, oh * 0.9 + 6, w * 0.8, oh * 0.4 + 2); ctx.stroke();
        if (happy) { ctx.strokeStyle = 'rgba(120,60,40,0.4)'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(sx * (w + 8), 4 + i * 9); ctx.lineTo(sx * (w + 22), i * 13); ctx.stroke(); } }
        // crease
        ctx.strokeStyle = 'rgba(120,60,40,0.35)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-w * 0.7, -oh - 2); ctx.quadraticCurveTo(0, -oh * 1.9, w * 0.8, -oh * 0.9); ctx.stroke();
      }
      ctx.restore();
    }
    // brows (thin, arched; raised when laughing)
    const br = ex === 'laugh' ? 1 : ex === 'wink' ? 0.4 : 0.2;
    ctx.strokeStyle = '#2a1a14'; ctx.lineWidth = 8;
    for (const sx of [-1, 1]) {
      const bx = sx * 62 + tx * (sx === 1 ? 1.15 : 0.85), by = -56 - br * 14 + (ex === 'wink' && sx === 1 ? 10 : 0);
      ctx.beginPath(); ctx.moveTo(bx - 40 * sx, by + 8); ctx.quadraticCurveTo(bx + 2 * sx, by - 12, bx + 42 * sx, by + 4); ctx.stroke();
    }
    // nose
    const nx = tx * 1.2;
    ctx.strokeStyle = 'rgba(140,65,45,0.5)'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(nx + 12, 18); ctx.quadraticCurveTo(nx + 26, 58, nx + 20, 78); ctx.stroke();
    ctx.fillStyle = 'rgba(110,45,35,0.55)'; ctx.beginPath(); ctx.ellipse(nx - 13, 86, 7, 4, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(nx + 13, 86, 7, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,236,220,0.6)'; ctx.beginPath(); ctx.ellipse(nx - 6, 66, 8, 5, 0, 0, TAU); ctx.fill();
    // smile lines
    ctx.strokeStyle = 'rgba(140,65,45,0.35)'; ctx.lineWidth = 3.5;
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(nx + sx * 38, 84); ctx.quadraticCurveTo(nx + sx * 62, 118, nx + sx * 56, 150); ctx.stroke(); }
    // mouth
    const mx = tx * 1.05, my = 128, lip = '#b9554a', dark = '#4a1612';
    const talk = ex === 'talk' ? 0.4 + 0.6 * Math.abs(Math.sin(t * 9)) : (o.talk || 0);
    if (ex === 'laugh' || talk > 0.05) {
      const op = ex === 'laugh' ? 1 + 0.12 * Math.sin(t * 22) : talk * 0.7;
      const mp = new Path2D(); mp.moveTo(mx - 64, my - 10); mp.quadraticCurveTo(mx, my - 2, mx + 64, my - 10); mp.quadraticCurveTo(mx + 40, my + 30 + 30 * op, mx, my + 34 + 30 * op); mp.quadraticCurveTo(mx - 40, my + 30 + 30 * op, mx - 64, my - 10); mp.closePath();
      ctx.fillStyle = dark; ctx.fill(mp);
      ctx.save(); ctx.clip(mp);
      ctx.fillStyle = '#fbf6ee'; ctx.fillRect(mx - 64, my - 14, 128, 20);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(mx + i * 16, my - 14); ctx.lineTo(mx + i * 16, my + 5); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(mx, my + 34 + 30 * op, 36, 20, 0, 0, TAU); ctx.fillStyle = '#d4605a'; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = lip; ctx.lineWidth = 6; ctx.stroke(mp);
    } else if (ex === 'wink') {
      ctx.strokeStyle = lip; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(mx - 52, my - 2); ctx.quadraticCurveTo(mx, my + 26, mx + 58, my - 20); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(150,60,50,0.5)'; ctx.beginPath(); ctx.arc(mx + 62, my - 22, 8, 1.8, 4.6); ctx.stroke();
    } else {
      // closed smile with full lips
      ctx.beginPath(); ctx.moveTo(mx - 60, my - 8); ctx.quadraticCurveTo(mx, my + 34, mx + 60, my - 8); ctx.quadraticCurveTo(mx, my + 10, mx - 60, my - 8);
      ctx.fillStyle = lip; ctx.fill();
      ctx.strokeStyle = '#7a2a22'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(mx - 60, my - 8); ctx.quadraticCurveTo(mx, my + 18, mx + 60, my - 8); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,210,0.5)'; ctx.beginPath(); ctx.ellipse(mx, my + 20, 16, 4, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(150,60,50,0.5)'; ctx.lineWidth = 4;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(mx + sx * 64, my - 10, 7, sx > 0 ? 1.8 : -1.3, sx > 0 ? 4.4 : 1.3); ctx.stroke(); }
    }
    // hair: centre part, swept back, grey strands at the temples
    const hairP = new Path2D();
    hairP.moveTo(-150 + tx * 0.1, 30); hairP.bezierCurveTo(-170, -120, -100, -228, tx * 0.2, -226); hairP.bezierCurveTo(100, -228, 170, -120, 150 + tx * 0.1, 30);
    hairP.lineTo(136, 0); hairP.bezierCurveTo(130, -80, 90, -130, 8 + tx * 0.4, -142); hairP.bezierCurveTo(-90, -130, -130, -80, -136, 0); hairP.closePath();
    ctx.fillStyle = lgr(ctx, 0, -230, 0, 20, [[0, '#2e2622'], [0.6, '#1c1513'], [1, '#120d0c']]); ctx.fill(hairP);
    ctx.save(); ctx.clip(hairP);
    ctx.strokeStyle = 'rgba(200,195,190,0.55)'; ctx.lineWidth = 2.2;
    for (let i = 0; i < 10; i++) { const sx = i < 5 ? -1 : 1, k = i % 5; ctx.beginPath(); ctx.moveTo(sx * (60 + k * 16), -150 + k * 14); ctx.quadraticCurveTo(sx * (118 + k * 6), -110 + k * 10, sx * (138 + k * 2), -10 + k * 8); ctx.stroke(); }
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,190,120,0.45)'; ctx.lineWidth = 10; ctx.filter = 'blur(4px)';
    ctx.beginPath(); ctx.arc(tx * 0.2, -10, 160, PI * 1.08, PI * 1.38); ctx.stroke();
    ctx.restore();
    if (hat) {
      // brim shadow across forehead
      ctx.save(); ctx.clip(head);
      ctx.fillStyle = lgr(ctx, 0, -150, 0, -40, [[0, 'rgba(60,25,15,0.55)'], [1, 'rgba(60,25,15,0)']]); ctx.fillRect(-200, -240, 400, 200);
      ctx.restore();
      nonLa(ctx, 'front', hopt);
      // chin strap (quai nón)
      ctx.strokeStyle = 'rgba(132,62,150,0.88)'; ctx.lineWidth = 5.5;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 150, -110); ctx.bezierCurveTo(sx * 162, 20, sx * 120, 170, tx * 0.4 + sx * 10, 204); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(225,170,240,0.5)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-148, -100); ctx.bezierCurveTo(-160, 20, -118, 166, tx * 0.4 - 10, 200); ctx.stroke();
    }
  });
}

// ---------------------------------------------------------------- Cô Ba full body
// Front view, origin = between the feet on the ground. s=1: ≈455 tall to the nón apex (eyes y≈-342, shoulders -282, hips -190).
// o: pose 'stand'|'snip'|'pour'|'shake'|'hand'|'thumbs'|'laugh'|'wave', k 0..1 (pose progress), t, expr (face; default per pose),
// flip, items (default true: draws pose props), bag (opts merged into plasticBag), gloves (default true), turn (face).
// returns { head:[x,y], handL:[x,y], handR:[x,y], bag:[x,y]|null, face:{x,y,s} } in screen coords (L/R = screen side, unflipped).
function coBa(ctx, x, y, s, o = {}) {
  const pose = o.pose || 'stand', k = clamp(o.k ?? 0.5), t = o.t || 0, items = o.items !== false;
  const fl = o.flip ? -1 : 1, ret = {};
  const exprDef = { stand: 'smile', snip: 'smile', pour: 'proud', shake: 'laugh', hand: 'smile', thumbs: 'wink', laugh: 'laugh', wave: 'smile' }[pose];
  const bob = pose === 'laugh' ? -Math.abs(Math.sin(t * TAU * 2.5)) * 5 : pose === 'shake' ? Math.sin(t * TAU * 2.5) * 2 : Math.sin(t * 2.2) * 1.5;
  at(ctx, x, y, 0, s * fl, s, () => {
    const M = mapper(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // ground shadow
    ctx.fillStyle = 'rgba(30,15,20,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 70, 10, 0, 0, TAU); ctx.fill();
    // trousers (black satin, wide)
    const pants = lgr(ctx, -45, 0, 45, 0, [[0, '#3c3542'], [0.45, '#25202b'], [1, '#141118']]);
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sx * 2, -196 + bob); ctx.lineTo(sx * 42, -196 + bob); ctx.lineTo(sx * 44, -14); ctx.lineTo(sx * 4, -14); ctx.closePath();
      outFill(ctx, pants);
      ctx.strokeStyle = 'rgba(255,220,180,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx * 18, -150); ctx.lineTo(sx * 22, -20); ctx.stroke();
    }
    // feet + sandals
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sx * 24, -6, 20, 8, 0, 0, TAU); outFill(ctx, '#6b3d22');
      ctx.beginPath(); ctx.ellipse(sx * 24, -10, 14, 6, 0, PI, TAU); ctx.fillStyle = SKIN_BA[1]; ctx.fill();
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx * 14, -9); ctx.lineTo(sx * 24, -15); ctx.lineTo(sx * 34, -9); ctx.stroke();
    }
    const by = bob;
    // pose targets (screen-left / screen-right hands)
    const shL = [-44, -280 + by], shR = [44, -280 + by];
    let hL, hR, kL = 'flat', kR = 'flat', rL = null, rR = null, bagAt = null, bagRot = 0, bagHeld = null;
    const sh = Math.sin(t * TAU * 2.5);
    if (pose === 'stand') { hL = [-60, -176 + by]; hR = [60, -176 + by]; rL = PI / 2 + 0.2; rR = PI / 2 - 0.2; }
    else if (pose === 'wave') { hL = [-60, -176 + by]; rL = PI / 2 + 0.2; hR = [78 + Math.sin(t * 9) * 10, -350 + by]; kR = 'wave'; rR = -PI / 2 + Math.sin(t * 9) * 0.25; }
    else if (pose === 'snip') {
      const cut = (t * 1.2) % 1;
      hL = [-50, -246 + by]; kL = 'pinch'; rL = -0.4;
      hR = [26, -236 + by + cut * 10]; kR = 'grip'; rR = -0.9;
    } else if (pose === 'pour') {
      hL = [-42, -206 + by]; kL = 'grip'; rL = -0.5; bagAt = [-30, -192 + by]; bagHeld = 'open';
      hR = [18, -272 + by]; kR = 'grip'; rR = lerp(-0.2, 0.7, ease.inOut(k));
    } else if (pose === 'shake') {
      hR = [150 + sh * 10, -236 + by + Math.cos(t * TAU * 5) * 8]; kR = 'grip';
      bagRot = -sh * 0.5; bagHeld = 'tied';
      hL = [-52, -200 + by]; kL = 'fist'; rL = PI * 0.6;
    } else if (pose === 'hand') {
      const e = ease.out(k);
      hR = [lerp(48, 132, e), lerp(-205, -262, e) + by]; kR = 'grip'; rR = -0.25;
      bagAt = [hR[0] + 6, hR[1] + 70]; bagHeld = 'tied'; bagRot = Math.sin(t * 6) * 0.05;
      hL = [-52, -200 + by]; kL = 'fist'; rL = PI * 0.6;
    } else if (pose === 'thumbs') {
      hR = [66, -318 + by + Math.sin(t * 8) * 2]; kR = 'thumb'; rR = 0.15;
      hL = [-52, -200 + by]; kL = 'fist'; rL = PI * 0.6;
    } else { // laugh
      hL = [-26, -214 + by]; kL = 'flat'; rL = 0.2; hR = [28, -208 + by]; kR = 'flat'; rR = PI - 0.25;
    }
    const elL = ikPick(shL[0], shL[1], hL[0], hL[1], 66, 62, -1), elR = pose === 'shake' ? ikPickY(shR[0], shR[1], hR[0], hR[1], 66, 62, 1) : ikPick(shR[0], shR[1], hR[0], hR[1], 66, 62, 1);
    if (pose === 'shake') bagAt = knotHang(hR, elR, 0.36, bagRot, 0.24, (r) => { rR = r; });
    // bag behind hands
    const bagO = Object.assign({ tied: bagHeld === 'tied', open: bagHeld === 'open' ? 1 : 0, fill: 0.7, mix: 1, t }, o.bag || {});
    const drawBag = () => { if (bagAt && items && typeof plasticBag === 'function') at(ctx, bagAt[0], bagAt[1], bagRot, 1, 1, () => plasticBag(ctx, 0, 0, 0.24, bagO)); };
    // torso: áo bà ba (long tunic with side slits)
    const tor = new Path2D();
    tor.moveTo(-18, -292 + by); tor.quadraticCurveTo(-40, -290 + by, -50, -276 + by); tor.lineTo(-44, -236 + by); tor.quadraticCurveTo(-40, -200 + by, -46, -150 + by);
    tor.quadraticCurveTo(-26, -142 + by, -6, -146 + by); tor.lineTo(6, -146 + by); tor.quadraticCurveTo(26, -142 + by, 46, -150 + by);
    tor.quadraticCurveTo(40, -200 + by, 44, -236 + by); tor.lineTo(50, -276 + by); tor.quadraticCurveTo(40, -290 + by, 18, -292 + by); tor.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(tor); ctx.fillStyle = floral(ctx, 26); ctx.fill(tor);
    ctx.save(); ctx.clip(tor);
    ctx.fillStyle = lgr(ctx, -50, 0, 50, 0, [[0, 'rgba(255,190,120,0.28)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(25,8,45,0.4)']]); ctx.fillRect(-60, -300 + by, 120, 160);
    // side slit lines + placket
    ctx.strokeStyle = 'rgba(40,15,60,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, -176 + by); ctx.lineTo(-44, -150 + by); ctx.moveTo(40, -176 + by); ctx.lineTo(44, -150 + by); ctx.stroke();
    ctx.restore();
    // waist apron with money pouch
    const ap = new Path2D(); ap.moveTo(-40, -212 + by); ap.lineTo(40, -212 + by); ap.lineTo(44, -128 + by); ap.quadraticCurveTo(0, -122 + by, -44, -128 + by); ap.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke(ap); ctx.fillStyle = lgr(ctx, -44, 0, 44, 0, [[0, '#fff6e2'], [0.5, COL.apron], [1, COL.apronD]]); ctx.fill(ap);
    ctx.save(); ctx.clip(ap); ctx.strokeStyle = 'rgba(200,60,50,0.55)'; ctx.lineWidth = 2.5; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 12, -214 + by); ctx.lineTo(i * 12.6, -120 + by); ctx.stroke(); } ctx.restore();
    ctx.fillStyle = '#c94a3c'; ctx.fillRect(-42, -216 + by, 84, 7);
    // pouch + cash
    ctx.fillStyle = '#5a6f8a'; rrect(ctx, -26, -190 + by, 52, 30, 6); outFill(ctx, '#58708c', 2);
    ctx.fillStyle = '#7fbf8a'; ctx.fillRect(-18, -197 + by, 18, 9); ctx.fillStyle = '#e48bb0'; ctx.fillRect(-2, -199 + by, 16, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-22, -186 + by); ctx.lineTo(22, -186 + by); ctx.stroke();
    // neck
    ctx.fillStyle = SKIN_BA[1]; rrect(ctx, -11, -304 + by, 22, 18, 6); ctx.fill();
    // collar band
    ctx.strokeStyle = COL.aobabaD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, -290 + by); ctx.quadraticCurveTo(0, -280 + by, 18, -290 + by); ctx.stroke();
    if (pose === 'pour' || pose === 'hand' || pose === 'thumbs') drawBag();
    // arms (long floral sleeves)
    const armO = { skin: SKIN_BA, wu: [19, 16], wf: [15, 12], sleeve: floral(ctx, 26), sleeveTo: 1.88, cuff: COL.aobabaD };
    const glove = o.gloves !== false;
    const doHand = (h, el, kind, rr, flipH) => cHand(ctx, h[0], h[1], 0.36, rr ?? handRot(el[0], el[1], h[0], h[1]), { kind, skin: SKIN_BA, glove, flip: flipH });
    // items held (drawn before the hand so fingers wrap them)
    const preItems = () => {
      if (!items) return;
      if (pose === 'snip') {
        if (typeof riceSheet === 'function') riceSheet(ctx, hL[0] + 8, hL[1] - 22, 0.17, -0.3, { curl: 0.3 });
        if (typeof scissors === 'function') scissors(ctx, hR[0] + 6, hR[1] - 4, 0.17, -0.95, { open: 0.5 + 0.5 * Math.sin(t * TAU * 1.2) });
      }
      if (pose === 'pour' && typeof spoon === 'function') {
        const tip = ease.inOut(k);
        spoon(ctx, hR[0] + 14, hR[1] - 2, 0.28, rR + PI, { fill: 'sate', tip });
        if (tip > 0.55 && typeof pourStream === 'function') pourStream(ctx, hR[0] - 30, hR[1] + 8, bagAt[0] + 2, bagAt[1] - 30, 4, t, COL.sateOil);
      }
    };
    cArm(ctx, shL[0], shL[1], elL[0], elL[1], hL[0], hL[1], armO);
    cArm(ctx, shR[0], shR[1], elR[0], elR[1], hR[0], hR[1], armO);
    if (pose === 'shake') drawBag();
    preItems();
    doHand(hL, elL, kL, rL, kL !== 'flat' || pose === 'laugh');
    doHand(hR, elR, kR, rR, pose === 'laugh');
    // head
    const fy = -342 + by + (pose === 'laugh' ? -2 : 0);
    const ftilt = pose === 'laugh' ? -0.08 + Math.sin(t * TAU * 2.5) * 0.03 : pose === 'shake' ? sh * 0.05 : (o.tilt || 0);
    coBaFace(ctx, 0, fy, 0.22, { expr: o.expr || exprDef, t, turn: o.turn || 0, body: false, tilt: ftilt, look: o.look, hatTilt: ftilt * 0.5 });
    ret.head = M(0, fy); ret.handL = M(hL[0], hL[1]); ret.handR = M(hR[0], hR[1]); ret.bag = bagAt ? M(bagAt[0], bagAt[1]) : null;
    ret.face = { x: ret.head[0], y: ret.head[1], s: 0.22 * s };
  });
  if (fl < 0) { const sw = ret.handL; ret.handL = ret.handR; ret.handR = sw; }
  return ret;
}

// ---------------------------------------------------------------- kids
const KID_LOOKS = [
  { girl: false, hair: 'spiky', bag: '#2f7fd6', bottom: 'shorts', hc: '#1c1714' },
  { girl: true, hair: 'pigtails', bag: '#f27aa8', bottom: 'skirt', hc: '#221814' },
  { girl: false, hair: 'bowl', bag: '#f2b632', bottom: 'trousers', hc: '#2b1e18' },
  { girl: true, hair: 'ponytail', bag: '#8a5cd6', bottom: 'skirt', hc: '#1c1714' },
  { girl: false, hair: 'side', bag: '#3fae5a', bottom: 'shorts', hc: '#231a16', glasses: true },
  { girl: true, hair: 'bob', bag: '#f2683a', bottom: 'skirt', hc: '#2b1e18' },
];
function kidLook(seed) { const i = ((seed | 0) % 6 + 6) % 6; return Object.assign({ skin: KID_SKINS[((seed | 0) % 4 + 4) % 4] }, KID_LOOKS[i]); }

// kid face: origin between eyes, head ≈ 300 wide (big round cartoon head), chin y≈165.
// o: seed, expr 'smile'|'shout'|'laugh'|'wow'|'chew'|'sour'|'spicy', t, turn, look [x,y], blink, sweat (0..1)
function kidFace(ctx, x, y, s, o = {}) {
  const L = kidLook(o.seed || 0), S = L.skin, ex = o.expr || 'smile', t = o.t || 0;
  const tn = clamp(o.turn || 0, -1, 1), tx = tn * 50, lk = o.look || [0, 0];
  const bl = o.blink ?? (((t * 1.1 + (o.seed || 0) * 0.71) % 2.9) < 0.12 ? 1 : 0);
  at(ctx, x, y, o.tilt || 0, s, s, () => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const hc = L.hc, hg = lgr(ctx, 0, -220, 0, 120, [[0, mixc(hc, '#6a5040', 0.35)], [0.5, hc], [1, hc]]);
    // back hair
    if (L.hair === 'pigtails') for (const sx of [-1, 1]) {
      const sw = Math.sin(t * 7 + sx) * 0.12;
      at(ctx, sx * 150 + tx * 0.2, -60, sx * (0.5 + sw), 1, 1, () => { ctx.beginPath(); ctx.ellipse(0, 70, 42, 80, 0, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = hg; ctx.fill(); ctx.fillStyle = '#e8343a'; ctx.beginPath(); ctx.ellipse(0, 4, 22, 14, 0, 0, TAU); ctx.fill(); });
    }
    if (L.hair === 'ponytail') { const sw = Math.sin(t * 6) * 0.15; at(ctx, 128 - tx * 0.3, -150, 0.8 + sw, 1, 1, () => { ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(90, -10, 120, 120, 60, 210); ctx.bezierCurveTo(40, 120, 0, 40, -10, 20); ctx.closePath(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = hg; ctx.fill(); }); }
    if (L.hair === 'bob') { ctx.beginPath(); ctx.moveTo(-175 + tx * 0.1, 150); ctx.bezierCurveTo(-200, -120, -110, -230, tx * 0.2, -228); ctx.bezierCurveTo(110, -230, 200, -120, 175 + tx * 0.1, 150); ctx.quadraticCurveTo(0, 120, -175 + tx * 0.1, 150); ctx.closePath(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(); ctx.fillStyle = hg; ctx.fill(); }
    // neck
    ctx.fillStyle = S[1]; rrect(ctx, -44 + tx * 0.3, 120, 88, 110, 30); ctx.fill();
    // ears
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 146 - tx * 0.2, 30, 26 * (1 + sx * tn * 0.6), 34, 0, 0, TAU); outFill(ctx, S[1], 4); ctx.strokeStyle = 'rgba(140,70,50,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx * 146 - tx * 0.2, 30, 13, sx > 0 ? -1.2 : 1.9, sx > 0 ? 1.2 : 4.3); ctx.stroke(); }
    // head (round, full cheeks; puffed when chewing)
    const puff = ex === 'chew' ? 1 + 0.06 * Math.abs(Math.sin(t * 8)) : 1;
    const head = new Path2D();
    head.moveTo(tx * 0.4, 168);
    head.bezierCurveTo(90 * puff + tx * 0.5, 168, 150 * puff + tx * 0.1, 110, 150 + tx * 0.1 - tn * 24, 10);
    head.bezierCurveTo(152, -120, 92, -200, tx * 0.2, -200);
    head.bezierCurveTo(-92, -200, -152, -120, -150 + tx * 0.1 - tn * 24, 10);
    head.bezierCurveTo(-150 * puff + tx * 0.1, 110, -90 * puff + tx * 0.5, 168, tx * 0.4, 168);
    ctx.strokeStyle = 'rgba(80,35,25,0.5)'; ctx.lineWidth = 5; ctx.stroke(head);
    ctx.fillStyle = rgr(ctx, -40 + tx, -30, 20, 0, 10, 220, [[0, S[0]], [0.75, S[1]], [1, S[2]]]); ctx.fill(head);
    ctx.save(); ctx.clip(head);
    const blush = ex === 'spicy' ? 0.75 : ex === 'laugh' || ex === 'shout' ? 0.5 : 0.35;
    for (const sx of [-1, 1]) { ctx.save(); ctx.filter = 'blur(10px)'; ctx.beginPath(); ctx.ellipse(sx * 92 + tx, 74, 40, 26, 0, 0, TAU); ctx.fillStyle = `rgba(240,95,95,${blush})`; ctx.fill(); ctx.restore(); }
    if (ex === 'spicy') { ctx.fillStyle = 'rgba(230,60,40,0.22)'; ctx.fillRect(-200, -60, 400, 260); }
    ctx.fillStyle = lgr(ctx, -150, 0, 150, 0, [[0, 'rgba(0,0,0,0)'], [0.7, 'rgba(0,0,0,0)'], [1, 'rgba(80,30,40,0.28)']]); ctx.fillRect(-200, -250, 400, 450);
    ctx.fillStyle = lgr(ctx, -150, 0, -92, 0, [[0, 'rgba(255,200,120,0.55)'], [1, 'rgba(255,200,120,0)']]); ctx.fillRect(-200, -250, 110, 450);
    ctx.restore();
    // eyes
    const closedArc = ex === 'laugh' || ex === 'chew' || bl > 0.5;
    const big = ex === 'wow' ? 1.18 : ex === 'shout' ? 1.05 : 1;
    for (const sx of [-1, 1]) {
      const exx = sx * 58 + tx * (sx > 0 ? 1.15 : 0.85);
      ctx.save(); ctx.translate(exx, 4);
      if (ex === 'sour') {
        ctx.strokeStyle = '#1e1210'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-26 * sx, -12); ctx.lineTo(18 * sx, 0); ctx.lineTo(-26 * sx, 12); ctx.stroke();
      } else if (closedArc) {
        ctx.strokeStyle = '#1e1210'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-28, 8); ctx.quadraticCurveTo(0, bl > 0.5 && ex !== 'laugh' && ex !== 'chew' ? 12 : -24, 28, 8); ctx.stroke();
      } else {
        const rw = 30 * big, rh = 36 * big;
        ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, TAU); ctx.fillStyle = '#fffdf8'; ctx.fill(); ctx.strokeStyle = '#1e1210'; ctx.lineWidth = 4; ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, 0, TAU); ctx.clip();
        const ix = lk[0] * 9, iy = lk[1] * 10 + 4, ir = 24 * big;
        ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fillStyle = rgr(ctx, ix, iy + 8, 2, ix, iy, ir, [[0, '#8a5232'], [0.6, '#4a2414'], [1, '#1c0c06']]); ctx.fill();
        ctx.beginPath(); ctx.arc(ix, iy, ir * (ex === 'wow' ? 0.62 : 0.5), 0, TAU); ctx.fillStyle = '#0a0504'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ix - 8, iy - 9, 8 * big, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(ix + 8, iy + 8, 3.5, 0, TAU); ctx.fill();
        if (ex === 'wow') { sparkle(ctx, ix + 10, iy - 12, 0.12, 1); }
        ctx.restore();
        ctx.strokeStyle = '#1e1210'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, 0, PI * 1.1, PI * 1.9); ctx.stroke();
        ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx * rw * 0.85, -rh * 0.55); ctx.lineTo(sx * (rw + 9), -rh * 0.8); ctx.stroke();
      }
      ctx.restore();
    }
    // brows
    const bRaise = ex === 'wow' ? 1 : ex === 'shout' ? 0.7 : ex === 'sour' || ex === 'spicy' ? -0.4 : 0.25;
    ctx.strokeStyle = mixc(L.hc, '#000', 0.2); ctx.lineWidth = 10;
    for (const sx of [-1, 1]) {
      const bx = sx * 58 + tx * (sx > 0 ? 1.15 : 0.85), byy = -56 - bRaise * 18;
      const tilt = ex === 'sour' || ex === 'spicy' ? 10 : 0;
      ctx.beginPath(); ctx.moveTo(bx - 26 * sx, byy + 4 - tilt); ctx.quadraticCurveTo(bx, byy - 8, bx + 26 * sx, byy + 6 + tilt * 0.5); ctx.stroke();
    }
    // nose
    ctx.strokeStyle = 'rgba(150,70,50,0.55)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tx * 1.2, 50, 12, 0.3, PI - 0.3); ctx.stroke();
    // mouth
    const mx = tx * 1.05, my = 98, dark = '#4a1612';
    if (ex === 'shout' || ex === 'laugh' || ex === 'spicy') {
      const op = (ex === 'shout' ? 1.15 : ex === 'spicy' ? 0.8 : 1) * (1 + 0.1 * Math.sin(t * 20));
      const mp = new Path2D(); mp.moveTo(mx - 46, my - 6); mp.quadraticCurveTo(mx, my + 2, mx + 46, my - 6); mp.bezierCurveTo(mx + 40, my + 50 * op, mx - 40, my + 50 * op, mx - 46, my - 6); mp.closePath();
      ctx.fillStyle = dark; ctx.fill(mp); ctx.save(); ctx.clip(mp);
      ctx.fillStyle = '#fffaf2'; ctx.fillRect(mx - 46, my - 10, 92, 14);
      ctx.beginPath(); ctx.ellipse(mx, my + 44 * op, 28, 18, 0, 0, TAU); ctx.fillStyle = '#e0605e'; ctx.fill();
      ctx.restore(); ctx.strokeStyle = '#8a3028'; ctx.lineWidth = 5; ctx.stroke(mp);
      if (ex === 'spicy') { ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.ellipse(mx, my + 48, 18, 14 + Math.sin(t * 18) * 3, 0, 0, TAU); ctx.fill(); }
    } else if (ex === 'wow') {
      ctx.beginPath(); ctx.ellipse(mx, my + 10, 18, 22 + Math.sin(t * 6) * 2, 0, 0, TAU); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = '#8a3028'; ctx.lineWidth = 5; ctx.stroke();
    } else if (ex === 'chew') {
      const ch = Math.sin(t * 16);
      ctx.strokeStyle = '#8a3028'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(mx - 30, my + 4); ctx.quadraticCurveTo(mx - 12, my + 14 + ch * 6, mx, my + 6); ctx.quadraticCurveTo(mx + 14, my + 14 - ch * 6, mx + 30, my + 2); ctx.stroke();
    } else if (ex === 'sour') {
      ctx.strokeStyle = '#8a3028'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(mx - 26, my + 10); ctx.quadraticCurveTo(mx - 10, my - 4, mx, my + 8); ctx.quadraticCurveTo(mx + 10, my - 4, mx + 26, my + 10); ctx.stroke();
    } else {
      const mp = new Path2D(); mp.moveTo(mx - 40, my - 4); mp.quadraticCurveTo(mx, my + 4, mx + 40, my - 4); mp.quadraticCurveTo(mx, my + 40, mx - 40, my - 4); mp.closePath();
      ctx.fillStyle = dark; ctx.fill(mp); ctx.save(); ctx.clip(mp); ctx.fillStyle = '#fffaf2'; ctx.fillRect(mx - 40, my - 8, 80, 12); ctx.restore();
      ctx.strokeStyle = '#8a3028'; ctx.lineWidth = 5; ctx.stroke(mp);
    }
    if (o.sweat) { ctx.globalAlpha = clamp(o.sweat); ctx.fillStyle = 'rgba(190,230,255,0.9)'; ctx.beginPath(); ctx.moveTo(122, -80); ctx.quadraticCurveTo(140, -50, 122, -38); ctx.quadraticCurveTo(104, -50, 122, -80); ctx.fill(); ctx.globalAlpha = 1; }
    // front hair
    ctx.save();
    const cap = new Path2D();
    if (L.hair === 'spiky') {
      cap.moveTo(-152, 10); cap.bezierCurveTo(-170, -90, -120, -190, -60, -205);
      const sp = [[-90, -250], [-40, -228], [-10, -272], [30, -230], [70, -262], [100, -210], [150, -220]];
      for (const [px, py] of sp) cap.lineTo(px + tx * 0.2, py + Math.sin(t * 5 + px) * 3);
      cap.bezierCurveTo(170, -150, 160, -60, 152, 10); cap.lineTo(134, -40); cap.lineTo(110, -100); cap.lineTo(80, -84); cap.lineTo(40, -118); cap.lineTo(10, -92); cap.lineTo(-30, -120); cap.lineTo(-64, -90); cap.lineTo(-100, -110); cap.lineTo(-130, -40); cap.closePath();
    } else if (L.hair === 'bowl') {
      cap.moveTo(-160, 20); cap.bezierCurveTo(-176, -140, -96, -226, tx * 0.2, -226); cap.bezierCurveTo(96, -226, 176, -140, 160, 20);
      cap.lineTo(140, 10); cap.lineTo(138, -70); cap.quadraticCurveTo(0, -90, -138, -70); cap.lineTo(-140, 10); cap.closePath();
    } else if (L.hair === 'side') {
      cap.moveTo(-152, 0); cap.bezierCurveTo(-170, -130, -100, -220, tx * 0.2, -222); cap.bezierCurveTo(100, -222, 172, -130, 152, 0);
      cap.lineTo(136, -40); cap.quadraticCurveTo(120, -110, 40, -128); cap.quadraticCurveTo(-60, -150, -120, -60); cap.lineTo(-136, -20); cap.closePath();
    } else { // girls: pigtails / ponytail / bob → centre/side part with fringe
      cap.moveTo(-158, 40); cap.bezierCurveTo(-176, -130, -100, -226, tx * 0.2, -226); cap.bezierCurveTo(100, -226, 176, -130, 158, 40);
      cap.lineTo(140, 0); cap.quadraticCurveTo(130, -84, 70, -104); cap.quadraticCurveTo(40, -70, 6, -96); cap.quadraticCurveTo(-30, -66, -70, -100); cap.quadraticCurveTo(-130, -84, -140, 0); cap.closePath();
    }
    ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke(cap); ctx.fillStyle = hg; ctx.fill(cap);
    ctx.clip(cap);
    ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,190,120,0.5)'; ctx.lineWidth = 12; ctx.filter = 'blur(4px)';
    ctx.beginPath(); ctx.arc(tx * 0.2, -20, 170, PI * 1.1, PI * 1.42); ctx.stroke();
    ctx.restore();
    if (L.hair === 'bob') { // star clip
      at(ctx, -92 + tx * 0.3, -120, 0.3, 1, 1, () => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? 9 : 22; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); outFill(ctx, '#ffd23a', 3); });
    }
    if (L.glasses) {
      ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 6;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 58 + tx * (sx > 0 ? 1.15 : 0.85), 4, 42, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-18 + tx, 0); ctx.quadraticCurveTo(tx, -10, 18 + tx, 0); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4;
      for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 58 + tx, 4, 32, PI * 1.15, PI * 1.4); ctx.stroke(); } ctx.restore();
    }
  });
}

// kid full body. Front view, origin = feet on ground. s=1: ≈350 tall (eyes y≈-292, shoulders -234, hips -150).
// o: seed, pose 'stand'|'run'|'cheer'|'point'|'clap'|'shake'|'laugh'|'lookUp'|'eat'|'wave', t, k, flip, expr, turn,
//    bag (plasticBag opts when holding one), item ('bag'|null; default bag for shake/eat), lean.
// returns { head:[x,y], handL, handR, bag:[x,y]|null, face:{x,y,s} } (screen coords).
function schoolKid(ctx, x, y, s, o = {}) {
  const L = kidLook(o.seed || 0), S = L.skin, pose = o.pose || 'stand', t = (o.t || 0) + (o.seed || 0) * 0.37, k = clamp(o.k ?? 0.5);
  const fl = o.flip ? -1 : 1, ret = {};
  const exprDef = { stand: 'smile', run: 'shout', cheer: 'shout', point: 'wow', clap: 'laugh', shake: 'laugh', laugh: 'laugh', lookUp: 'wow', eat: 'chew', wave: 'smile' }[pose];
  const ph = t * TAU * 2.4;
  let bob = 0, lean = o.lean || 0;
  if (pose === 'run') { bob = -Math.abs(Math.sin(ph)) * 12; lean += 0.1; }
  else if (pose === 'cheer') bob = -Math.abs(Math.sin(t * TAU * 1.6)) * 26;
  else if (pose === 'laugh' || pose === 'clap') bob = -Math.abs(Math.sin(t * TAU * 2.5)) * 5;
  else bob = Math.sin(t * 2.5) * 1.5;
  at(ctx, x, y, 0, s * fl, s, () => {
    const M = mapper(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(30,15,20,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 52 * (1 + bob / 80), 8, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(0, bob); ctx.rotate(lean); // body frame pivots at feet
    const hip = -150;
    // legs
    const feet = [[-16, 0], [16, 0]];
    if (pose === 'run') { feet[0] = [-6 + Math.sin(ph) * 30, -Math.max(0, Math.cos(ph)) * 34 - bob]; feet[1] = [6 - Math.sin(ph) * 30, -Math.max(0, -Math.cos(ph)) * 34 - bob]; }
    if (pose === 'cheer') { feet[0] = [-22, -bob * 0.1]; feet[1] = [22, -bob * 0.1]; }
    const legW = 17, sock = L.girl ? '#ffffff' : null;
    for (let i = 0; i < 2; i++) {
      const sx = i ? 1 : -1, hx0 = sx * 11, fx = feet[i][0], fy = feet[i][1] - 8 - bob;
      const kn = pose === 'run' ? ikPick(hx0, hip, fx, fy, 76, 72, 1) : [lerp(hx0, fx, 0.5) + sx * 1.5, lerp(hip, fy, 0.5)];
      const trouser = L.bottom === 'trousers';
      capFS(ctx, kn[0], kn[1], fx, fy, legW * 0.95, legW * 0.8, trouser ? COL.navy : S[1]);
      capFS(ctx, hx0, hip, kn[0], kn[1], legW * 1.05, legW, trouser ? COL.navy : S[1]);
      if (sock) capFS(ctx, lerp(kn[0], fx, 0.62), lerp(kn[1], fy, 0.62), fx, fy, legW * 0.9, legW * 0.85, sock, 2);
      // sneaker
      ctx.beginPath(); ctx.ellipse(fx + 3, fy + 6, 17, 9, 0, 0, TAU); outFill(ctx, '#f4f2ee', 2.4);
      ctx.fillStyle = L.bag; ctx.fillRect(fx - 10, fy + 8, 26, 3);
    }
    // backpack (behind torso)
    rrect(ctx, -44, -246, 88, 104, 18); outFill(ctx, L.bag, 2.6);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; rrect(ctx, -44, -170, 88, 28, 12); ctx.fill();
    // bottoms
    if (L.bottom === 'skirt') {
      ctx.beginPath(); ctx.moveTo(-34, -168); ctx.lineTo(34, -168); ctx.lineTo(46, -112); ctx.quadraticCurveTo(0, -104, -46, -112); ctx.closePath(); outFill(ctx, COL.navy);
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -166); ctx.lineTo(i * 13, -110); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.moveTo(-32, -170); ctx.lineTo(32, -170); ctx.lineTo(34, -118); ctx.lineTo(4, -116); ctx.lineTo(0, -140); ctx.lineTo(-4, -116); ctx.lineTo(-34, -118); ctx.closePath(); outFill(ctx, COL.navy);
      ctx.fillStyle = '#1a1a22'; ctx.fillRect(-32, -172, 64, 6); ctx.fillStyle = '#d8c070'; ctx.fillRect(-6, -173, 12, 8);
    }
    // shirt
    const tor = new Path2D(); tor.moveTo(-14, -240); tor.quadraticCurveTo(-30, -240, -38, -230); tor.lineTo(-34, -168); tor.lineTo(34, -168); tor.lineTo(38, -230); tor.quadraticCurveTo(30, -240, 14, -240); tor.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke(tor); ctx.fillStyle = lgr(ctx, -38, 0, 38, 0, [[0, '#fffefa'], [0.6, '#f3f1ea'], [1, '#c9ccd6']]); ctx.fill(tor);
    ctx.strokeStyle = 'rgba(120,120,140,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -226); ctx.lineTo(0, -170); ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = '#d9d9e0'; ctx.beginPath(); ctx.arc(2, -210 + i * 15, 1.8, 0, TAU); ctx.fill(); }
    // badge
    ctx.fillStyle = '#2f5fb0'; rrect(ctx, 14, -222, 13, 9, 2); ctx.fill();
    // backpack straps
    ctx.fillStyle = mixc(L.bag, '#000', 0.25);
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 20, -240); ctx.lineTo(sx * 30, -240); ctx.lineTo(sx * 30, -176); ctx.lineTo(sx * 23, -176); ctx.closePath(); ctx.fill(); }
    // neck + red scarf (khăn quàng đỏ)
    ctx.fillStyle = S[1]; rrect(ctx, -9, -252, 18, 16, 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-20, -242); ctx.quadraticCurveTo(0, -232, 20, -242); ctx.lineTo(16, -236); ctx.quadraticCurveTo(0, -228, -16, -236); ctx.closePath(); ctx.fillStyle = COL.scarf; ctx.fill();
    const fly = pose === 'run' ? Math.sin(ph * 2) * 4 : Math.sin(t * 3) * 1.5;
    ctx.beginPath(); ctx.moveTo(-3, -232); ctx.lineTo(-12 + fly, -200); ctx.lineTo(-3, -204); ctx.closePath(); outFill(ctx, COL.scarf, 1.8);
    ctx.beginPath(); ctx.moveTo(3, -232); ctx.lineTo(12 + fly, -202); ctx.lineTo(4, -206); ctx.closePath(); outFill(ctx, '#b81c22', 1.8);
    ctx.beginPath(); ctx.ellipse(0, -232, 6, 5, 0, 0, TAU); outFill(ctx, '#e8343a', 1.6);
    // arms
    const shL = [-34, -232], shR = [34, -232];
    let hL, hR, kL = 'fist', kR = 'fist', rL = null, rR = null, bagAt = null, bagRot = 0;
    const swing = Math.sin(ph);
    if (pose === 'run') { hL = [-40 - swing * 22, -176 - swing * 20]; hR = [40 + swing * 22, -176 + swing * 20]; }
    else if (pose === 'cheer') { const w = Math.sin(t * TAU * 1.6) * 8; hL = [-62 - w, -330]; hR = [62 + w, -330]; kL = kR = 'open'; rL = -PI / 2 - 0.4; rR = -PI / 2 + 0.4; }
    else if (pose === 'point') { hL = [-44, -138]; rL = PI / 2 + 0.12; hR = [86, -316]; kR = 'point'; rR = -0.95; }
    else if (pose === 'wave') { hL = [-44, -138]; rL = PI / 2 + 0.12; hR = [64 + Math.sin(t * 9) * 8, -316]; kR = 'wave'; rR = -PI / 2 + Math.sin(t * 9) * 0.3; }
    else if (pose === 'clap') { const c = Math.abs(Math.sin(t * TAU * 2.5)); hL = [-4 - c * 22, -224]; hR = [4 + c * 22, -224]; kL = kR = 'flat'; rL = -1.2; rR = -1.9; }
    else if (pose === 'shake') {
      const sh = Math.sin(t * TAU * 2.6);
      hR = [118 + sh * 8, -200 + Math.cos(t * TAU * 5.2) * 6]; kR = 'grip'; bagRot = -sh * 0.5;
      hL = [-58, -300 - Math.abs(sh) * 10]; kL = 'fist'; rL = -PI / 2 - 0.3;
    } else if (pose === 'eat') {
      bagAt = [-20, -196]; hL = [-26, -206]; kL = 'grip'; rL = -0.5;
      const lift = 0.5 + 0.5 * Math.sin(t * TAU * 0.8); hR = [lerp(10, 6, lift), lerp(-210, -262, lift)]; kR = 'pinch'; rR = -1.6;
    } else if (pose === 'laugh') { hL = [-20, -186]; hR = [20, -186]; kL = kR = 'flat'; rL = 0.1; rR = PI - 0.1; }
    else if (pose === 'lookUp') { hL = [-26, -214]; hR = [26, -214]; kL = kR = 'grip'; rL = -PI / 2; rR = -PI / 2; }
    else { hL = [-44, -136]; hR = [44, -136]; rL = PI / 2 + 0.12; rR = PI / 2 - 0.12; }
    const elL = ikPick(shL[0], shL[1], hL[0], hL[1], 52, 50, -1), elR = pose === 'shake' ? ikPickY(shR[0], shR[1], hR[0], hR[1], 52, 50, 1) : ikPick(shR[0], shR[1], hR[0], hR[1], 52, 50, 1);
    if (pose === 'shake') bagAt = knotHang(hR, elR, 0.34, bagRot, 0.2, (r) => { rR = r; });
    const armO = { skin: S, wu: [14, 12], wf: [11, 9.5], sleeve: '#f6f5f0', sleeveTo: 0.55 };
    const bagO = Object.assign({ tied: pose === 'shake', open: pose === 'eat' ? 1 : 0, fill: 0.6, mix: 1, t }, o.bag || {});
    const holdBag = (pose === 'shake' || pose === 'eat') && o.item !== null && typeof plasticBag === 'function';
    cArm(ctx, shL[0], shL[1], elL[0], elL[1], hL[0], hL[1], armO);
    cArm(ctx, shR[0], shR[1], elR[0], elR[1], hR[0], hR[1], armO);
    if (holdBag) at(ctx, bagAt[0], bagAt[1], bagRot, 1, 1, () => plasticBag(ctx, 0, 0, 0.2, bagO));
    if (pose === 'eat' && typeof skewer === 'function') skewer(ctx, hR[0] + 4, hR[1] - 4, 0.14, -1.55, { food: 'mix' });
    cHand(ctx, hL[0], hL[1], 0.34, rL ?? handRot(elL[0], elL[1], hL[0], hL[1]), { kind: kL, skin: S, flip: kL === 'grip' || kL === 'pinch' });
    cHand(ctx, hR[0], hR[1], 0.34, rR ?? handRot(elR[0], elR[1], hR[0], hR[1]), { kind: kR, skin: S, flip: pose === 'laugh' });
    // head
    const fy = -292, ftilt = pose === 'lookUp' ? -0.18 : pose === 'laugh' ? -0.1 + Math.sin(t * TAU * 2.5) * 0.04 : pose === 'run' ? -lean * 0.5 : 0;
    const look = pose === 'lookUp' ? [0, -1] : pose === 'eat' ? [0.2, 0.6] : o.look;
    kidFace(ctx, 0, fy, 0.3, { seed: o.seed || 0, expr: o.expr || exprDef, t, turn: o.turn ?? (pose === 'run' ? 0.35 : 0), tilt: ftilt, look });
    ctx.restore();
    // map anchors through the lean/bob frame
    const ca = Math.cos(lean), sa = Math.sin(lean);
    const tf = (p) => M(p[0] * ca - p[1] * sa, p[0] * sa + p[1] * ca + bob);
    ret.head = tf([0, fy]); ret.handL = tf(hL); ret.handR = tf(hR); ret.bag = bagAt ? tf(bagAt) : null;
    ret.face = { x: ret.head[0], y: ret.head[1], s: 0.3 * s };
  });
  if (fl < 0) { const sw = ret.handL; ret.handL = ret.handR; ret.handR = sw; }
  return ret;
}

// ---------------------------------------------------------------- tourist, front view, with the bag
// origin = feet on ground; s=1: ≈425 tall (face origin y≈-385 at PEOPLE.face scale 0.18, shoulders -330, hips -200).
// o: pose 'hold'|'shake'|'behindBack'|'overShoulder'|'toss'|'catch'|'eat'|'thumbs'|'stand', k 0..1, t, flip,
//    glassK 0..1 (sunglasses: 0 on head, 1 over eyes), face {...PEOPLE.face opts merged}, bag (plasticBag opts), tossH (px apex height).
// returns { head:[x,y], handL, handR, bag:[x,y,rot]|null, mouth:[x,y], face:{x,y,s} }.
function touristShake(ctx, x, y, s, o = {}) {
  const pose = o.pose || 'hold', k = clamp(o.k ?? 0.5), t = o.t || 0, fl = o.flip ? -1 : 1, ret = {};
  const SK = PEOPLE.SKIN, HAIRc = PEOPLE.HAIR, SHIRT = PEOPLE.SHIRT, SHIRT_D = '#1f6764', SHORTS = '#b59a6a', PACK = '#c46a2b';
  const sh = Math.sin(t * TAU * 2.5);
  let bob = pose === 'shake' || pose === 'overShoulder' || pose === 'behindBack' ? Math.abs(sh) * -4 : pose === 'catch' ? -ease.out(k) * 6 : Math.sin(t * 2.2) * 1.5;
  at(ctx, x, y, 0, s * fl, s, () => {
    const M = mapper(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(30,15,20,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 74, 11, 0, 0, TAU); ctx.fill();
    const by = bob;
    // pose targets
    const shL = [-52, -326 + by], shR = [52, -326 + by];
    let hL, hR, kL = 'grip', kR = 'grip', rL = null, rR = null, bagAt = null, bagRot = 0, bagBehind = false, bagTied = true, bagOpen = 0;
    const faceO = { mouth: 'smile' };
    if (pose === 'hold') { bagAt = [0, -262 + by]; hL = [-30, -250 + by]; hR = [30, -250 + by]; kL = 'flat'; kR = 'flat'; rL = -0.5; rR = PI + 0.5; faceO.lookY = 0.6; faceO.mouth = 'grin'; faceO.mOpen = 0.2; }
    else if (pose === 'stand') { hL = [-66, -206 + by]; hR = [66, -206 + by]; kL = kR = 'flat'; rL = PI / 2 + 0.2; rR = PI / 2 - 0.2; }
    else if (pose === 'thumbs') { hL = [-66, -206 + by]; kL = 'flat'; rL = PI / 2 + 0.2; hR = [76, -380 + by]; kR = 'thumb'; rR = 0.1; faceO.mouth = 'grin'; faceO.mOpen = 0.3; }
    else if (pose === 'shake') {
      hR = [184 + sh * 10, -292 + by + Math.cos(t * TAU * 5) * 8]; bagRot = -sh * 0.55; bagAt = [0, 0];
      hL = [-74, -420 + by - Math.abs(sh) * 12]; kL = 'fist'; rL = -PI / 2 - 0.3;
      faceO.mouth = 'grin'; faceO.mOpen = 0.5 + 0.3 * Math.abs(sh); faceO.hairLift = Math.abs(sh) * 0.4;
    } else if (pose === 'overShoulder') {
      bagAt = [74 + sh * 14, -430 + by + Math.cos(t * TAU * 5) * 10]; bagRot = 0.4 + sh * 0.4;
      hR = [bagAt[0] - 8, bagAt[1] - 60]; rR = -0.9; hL = [30, -420 + by]; kL = 'grip'; rL = -1.0;
      faceO.mouth = 'grin'; faceO.mOpen = 0.6; faceO.turn = 0.25; faceO.hairLift = 0.3;
    } else if (pose === 'behindBack') {
      bagAt = [-70 + sh * 12, -228 + by + Math.cos(t * TAU * 5) * 10]; bagRot = -0.3 + sh * 0.4; bagBehind = true;
      hL = [-50, -240 + by]; hR = [44, -232 + by]; rL = PI * 0.15; rR = PI * 0.9;
      faceO.mouth = 'o'; faceO.mOpen = 0.4; faceO.turn = -0.2; faceO.brow = 0.6;
    } else if (pose === 'toss' || pose === 'catch') {
      const H = o.tossH ?? 240;
      const ph = pose === 'toss' ? k : 1 - k * 0.5;
      const yy = -400 - Math.sin(Math.min(ph, 1) * PI * (pose === 'toss' ? 0.5 : 1)) * H;
      bagAt = [6, pose === 'catch' ? lerp(-400 - H * 0.6, -440, ease.out(k)) + by : yy + by]; bagRot = (pose === 'toss' ? k : 1 - k) * TAU * 1.2;
      const up = pose === 'catch' ? ease.out(k) : 1 - k * 0.6;
      hL = [-40, lerp(-280, -450, up) + by]; hR = [40, lerp(-280, -450, up) + by]; kL = kR = 'open'; rL = -PI / 2 - 0.3; rR = -PI / 2 + 0.3;
      if (pose === 'catch' && k > 0.85) { hL = [bagAt[0] - 30, bagAt[1] + 10]; hR = [bagAt[0] + 30, bagAt[1] + 10]; kL = kR = 'flat'; rL = -0.6; rR = PI + 0.6; }
      faceO.lookY = -1; faceO.mouth = 'o'; faceO.mOpen = 0.6; faceO.brow = 0.8; faceO.tilt = -0.1;
    } else if (pose === 'eat') {
      bagAt = [-26, -262 + by]; bagTied = false; bagOpen = 1; hL = [-34, -272 + by]; kL = 'grip'; rL = -0.4;
      const lift = ease.inOut(clamp(k * 1.6)); hR = [lerp(30, 14, lift), lerp(-250, -350, lift) + by]; kR = 'pinch'; rR = -1.7;
      faceO.mouth = lift > 0.8 ? 'o' : 'smile'; faceO.mOpen = 0.5; faceO.lookY = 0.4; faceO.happyClosed = k > 0.85 ? 1 : 0;
    }
    const bagO = Object.assign({ tied: bagTied, open: bagOpen, fill: 0.75, mix: 1, t, shake: pose === 'shake' || pose === 'overShoulder' || pose === 'behindBack' ? Math.abs(sh) : 0 }, o.bag || {});
    const drawBag = () => { if (bagAt && typeof plasticBag === 'function') at(ctx, bagAt[0], bagAt[1], bagRot, 1, 1, () => plasticBag(ctx, 0, 0, 0.19, bagO)); };
    if (bagBehind) drawBag();
    // backpack peeking behind shoulders
    rrect(ctx, -62, -336 + by, 124, 140, 26); outFill(ctx, PACK, 2.6);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; rrect(ctx, -62, -236 + by, 124, 40, 16); ctx.fill();
    // legs (shorts + calves + sneakers)
    for (const sx of [-1, 1]) {
      capFS(ctx, sx * 23, -128, sx * 24, -20, 28, 21, SK[1]);
      ctx.save(); ctx.globalAlpha = 0.4; seg(ctx, sx * 22 - 4, -120, sx * 24 - 4, -30, 7, 5, SK[0]); ctx.restore();
      ctx.beginPath(); ctx.ellipse(sx * 26, -10, 26, 12, 0, 0, TAU); outFill(ctx, '#e9e6df');
      ctx.fillStyle = '#c9542e'; ctx.fillRect(sx * 26 - 20, -6, 40, 4);
      ctx.fillStyle = '#ffffff'; rrect(ctx, sx * 24 - 10, -30, 20, 12, 4); ctx.fill();
    }
    const shorts = new Path2D(); shorts.moveTo(-46, -206 + by); shorts.lineTo(46, -206 + by); shorts.lineTo(50, -122); shorts.lineTo(6, -118); shorts.lineTo(0, -160); shorts.lineTo(-6, -118); shorts.lineTo(-50, -122); shorts.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke(shorts); ctx.fillStyle = lgr(ctx, -50, 0, 50, 0, [[0, '#d2b886'], [0.5, SHORTS], [1, '#8a7246']]); ctx.fill(shorts);
    ctx.strokeStyle = 'rgba(80,60,30,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-40, -170); ctx.lineTo(-28, -150); ctx.moveTo(40, -170); ctx.lineTo(28, -150); ctx.stroke();
    // t-shirt
    const tor = new Path2D(); tor.moveTo(-20, -338 + by); tor.quadraticCurveTo(-46, -338 + by, -58, -322 + by); tor.lineTo(-50, -270 + by); tor.lineTo(-50, -196 + by); tor.quadraticCurveTo(0, -190 + by, 50, -196 + by); tor.lineTo(50, -270 + by); tor.lineTo(58, -322 + by); tor.quadraticCurveTo(46, -338 + by, 20, -338 + by); tor.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke(tor); ctx.fillStyle = lgr(ctx, -58, 0, 58, 0, [[0, '#46b8ae'], [0.55, SHIRT], [1, SHIRT_D]]); ctx.fill(tor);
    ctx.save(); ctx.clip(tor);
    ctx.strokeStyle = 'rgba(10,50,48,0.35)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-30, -250 + by); ctx.quadraticCurveTo(-10, -232 + by, -26, -210 + by); ctx.moveTo(30, -240 + by); ctx.quadraticCurveTo(14, -226 + by, 28, -208 + by); ctx.stroke();
    ctx.restore();
    // backpack straps over chest
    ctx.fillStyle = '#5a4630';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * 26, -338 + by); ctx.lineTo(sx * 38, -338 + by); ctx.lineTo(sx * 40, -226 + by); ctx.lineTo(sx * 30, -226 + by); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#3b2e20'; ctx.fillRect(sx * 35 - 7, -280 + by, 14, 5); ctx.fillStyle = '#5a4630'; }
    ctx.fillStyle = '#3b2e20'; ctx.fillRect(-36, -262 + by, 72, 4);
    if (!bagBehind && pose !== 'shake' && pose !== 'overShoulder') drawBag();
    const elL = pose === 'behindBack' ? [-82, -262 + by] : ikPick(shL[0], shL[1], hL[0], hL[1], 80, 76, -1);
    const elR = pose === 'behindBack' ? [84, -258 + by] : pose === 'shake' ? ikPickY(shR[0], shR[1], hR[0], hR[1], 80, 76, 1) : ikPick(shR[0], shR[1], hR[0], hR[1], 80, 76, 1);
    if (pose === 'shake') bagAt = knotHang(hR, elR, 0.4, bagRot, 0.19, (r) => { rR = r; });
    const armO = { skin: SK, wu: [24, 20], wf: [19, 15], sleeve: lgr(ctx, -60, 0, 60, 0, [[0, '#46b8ae'], [1, SHIRT_D]]), sleeveTo: 0.5 };
    cArm(ctx, shL[0], shL[1], elL[0], elL[1], hL[0], hL[1], armO);
    cArm(ctx, shR[0], shR[1], elR[0], elR[1], hR[0], hR[1], armO);
    if (pose === 'shake' || pose === 'overShoulder') drawBag();
    if (pose === 'eat' && typeof plasticFork === 'function') plasticFork(ctx, hR[0] + 6, hR[1] - 6, 0.2, -1.7, { food: 'mix' });
    if (pose !== 'behindBack') {
      cHand(ctx, hL[0], hL[1], 0.4, rL ?? handRot(elL[0], elL[1], hL[0], hL[1]), { kind: kL, skin: SK, flip: kL === 'grip' || kL === 'pinch' });
      cHand(ctx, hR[0], hR[1], 0.4, rR ?? handRot(elR[0], elR[1], hR[0], hR[1]), { kind: kR, skin: SK, flip: pose === 'hold' || kR === 'flat' && pose === 'catch' });
    }
    // head via people.face
    const fy = -385 + by;
    const fo = Object.assign({ shirt: false, t, glassesY: lerp(-178, 0, clamp(o.glassK || 0)), blush: 0.4 }, faceO, o.face || {});
    PEOPLE.face(ctx, 0, fy, 0.18, fo);
    ret.head = M(0, fy); ret.mouth = M(0, fy + 140 * 0.18);
    ret.handL = M(hL[0], hL[1]); ret.handR = M(hR[0], hR[1]);
    ret.bag = bagAt ? [...M(bagAt[0], bagAt[1]), bagRot * fl] : null;
    ret.face = { x: ret.head[0], y: ret.head[1], s: 0.18 * s };
  });
  if (fl < 0) { const sw = ret.handL; ret.handL = ret.handR; ret.handR = sw; }
  return ret;
}

// =====================================================================================
// FOOD & TOOLS
// =====================================================================================
// scatter layout shared by piles / falling bits. o: {n, seed, spread (1), fall (bool), t, h (fall height, 600), speed (1)}
// returns array of [x, y, angle, r()] ; pile = mound sitting on y=0, fall = column from y=-h..0 drifting down with t.
function layoutBits(o, n, w, hPile) {
  const r = rng((o.seed || 1) * 131 + n), out = [], sp = o.spread ?? 1, t = o.t || 0;
  const fh = o.h ?? 600, speed = (o.speed ?? 1) * 0.55;
  for (let i = 0; i < n; i++) {
    let px, py, a;
    if (o.fall) {
      const ph = r(), sw = r();
      const u = ((ph + t * speed) % 1);
      px = (r() - 0.5) * w * sp + Math.sin(t * 2 + sw * 9) * 12;
      py = -fh + u * fh; a = r() * TAU + t * (r() - 0.5) * 8;
    } else {
      px = (r() + r() - 1) * w * sp; py = -r() * hPile * (1 - Math.min(1, Math.abs(px) / (w * sp))) * 0.95; a = r() * TAU;
    }
    out.push([px, py, a, r()]);
  }
  return out;
}
// curvy ribbon helper (used for strips / shreds)
function ribbon(c, l, w, curl, col, edge) {
  c.beginPath(); c.moveTo(-l / 2, 0); c.bezierCurveTo(-l / 6, -curl, l / 6, curl, l / 2, 0);
  c.lineCap = 'round'; c.lineWidth = w;
  if (edge) { c.strokeStyle = edge; c.lineWidth = w + 2.4; c.stroke(); c.lineWidth = w; }
  c.strokeStyle = col; c.stroke();
}

// ---------------------------------------------------------------- bánh tráng (rice paper)
let _riceTex = null;
function riceTex() {
  if (_riceTex) return _riceTex;
  const N = 512, [cv, c] = canvas(N, N), r = rng(41);
  c.translate(N / 2, N / 2);
  c.beginPath(); c.arc(0, 0, 250, 0, TAU); c.save(); c.clip();
  c.fillStyle = rgr(c, -40, -60, 10, 0, 0, 250, [[0, 'rgba(255,250,232,0.97)'], [0.75, 'rgba(244,234,206,0.95)'], [1, 'rgba(222,204,160,0.95)']]); c.fillRect(-256, -256, 512, 512);
  // woven bamboo-mat imprint (diagonal cross-hatch)
  c.strokeStyle = 'rgba(170,140,90,0.16)'; c.lineWidth = 2;
  for (let i = -520; i < 520; i += 13) { c.beginPath(); c.moveTo(i, -260); c.lineTo(i + 520, 260); c.stroke(); c.beginPath(); c.moveTo(i, 260); c.lineTo(i + 520, -260); c.stroke(); }
  c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.2;
  for (let i = -520; i < 520; i += 13) { c.beginPath(); c.moveTo(i + 3, -260); c.lineTo(i + 523, 260); c.stroke(); }
  // translucent bubbles + mottling
  for (let i = 0; i < 140; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 240; c.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(200,170,120,0.12)'; c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, 2 + r() * 7, 2 + r() * 5, r() * PI, 0, TAU); c.fill(); }
  // sesame-free plain; scorch freckles near rim
  for (let i = 0; i < 26; i++) { const a = r() * TAU, d = 200 + r() * 45; c.fillStyle = 'rgba(190,140,70,0.25)'; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 2 + r() * 3, 0, TAU); c.fill(); }
  c.restore();
  // rim: slightly thicker, darker edge
  c.strokeStyle = 'rgba(190,160,105,0.65)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 247, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,252,240,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 242, PI * 1.05, PI * 1.6); c.stroke();
  _riceTex = cv; return cv;
}
// rice sheet: origin centre, s=1: 400 diameter. o: {curl 0..1 (foreshortens + bends), alpha, light 0..1 (backlit glow), cut 0..1 (removes a wedge, as if strips were cut off the right edge)}
function riceSheet(ctx, x, y, s, rot = 0, o = {}) {
  const curl = clamp(o.curl || 0), cut = clamp(o.cut || 0);
  at(ctx, x, y, rot, s, s * (1 - curl * 0.62), () => {
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (cut > 0) { ctx.beginPath(); ctx.rect(-210, -210, 420 - cut * 380, 420); ctx.clip(); }
    // drop shadow-ish dark underside showing when curled
    if (curl > 0) { ctx.fillStyle = `rgba(150,110,60,${0.35 * curl})`; ctx.beginPath(); ctx.ellipse(0, 14 * curl, 200, 200, 0, 0, TAU); ctx.fill(); }
    ctx.drawImage(riceTex(), -200, -200, 400, 400);
    if (cut > 0) { // jagged cut edge
      const ex = 200 - cut * 380; ctx.strokeStyle = 'rgba(200,170,110,0.9)'; ctx.lineWidth = 3; ctx.beginPath();
      for (let yy = -200; yy <= 200; yy += 20) ctx.lineTo(ex + ((yy / 20) % 2 ? 3 : -3), yy); ctx.stroke();
    }
    if (o.light) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = rgr(ctx, -60, -80, 10, 0, 0, 220, [[0, `rgba(255,220,140,${0.85 * o.light})`], [0.6, `rgba(255,170,80,${0.35 * o.light})`], [1, 'rgba(255,150,60,0)']]);
      ctx.beginPath(); ctx.arc(0, 0, 200, 0, TAU); ctx.fill();
    }
    ctx.restore();
  });
}
// stack of sheets: origin bottom centre, s=1: 400 wide, ≈ 3 units per sheet. o: {n=20}
function riceSheetStack(ctx, x, y, s, o = {}) {
  const n = o.n || 20, r = rng(n * 7 + 3);
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = 'rgba(40,25,15,0.25)'; ctx.beginPath(); ctx.ellipse(4, 2, 206, 42, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < n; i++) {
      const yy = -i * 3, dx = (r() - 0.5) * 10;
      ctx.beginPath(); ctx.ellipse(dx, yy, 200, 40, 0, 0, PI); ctx.fillStyle = i % 2 ? '#e2d0a6' : '#efe0bb'; ctx.fill();
      ctx.strokeStyle = 'rgba(160,125,75,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    const top = -n * 3;
    ctx.save(); ctx.translate(0, top); ctx.scale(1, 0.2); ctx.drawImage(riceTex(), -200, -200, 400, 400); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,220,160,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, top, 198, 39, 0, PI * 1.05, PI * 1.5); ctx.stroke(); ctx.restore();
  });
}
// strips: origin = pile base centre (or column bottom when fall). s=1: strip 80×9. o: {n=24, seed, spread, fall, t, h, speed, col}
function riceStrips(ctx, x, y, s, o = {}) {
  const n = o.n ?? 24, L = layoutBits(o, n, 110, 70);
  at(ctx, x, y, 0, s, s, () => {
    for (const [px, py, a, q] of L) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(a);
      ribbon(ctx, 64 + q * 34, 9, (q - 0.5) * 22, o.col || (q < 0.5 ? 'rgba(246,236,210,0.96)' : 'rgba(234,220,186,0.96)'), 'rgba(170,135,85,0.5)');
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -2); ctx.lineTo(16, -2); ctx.stroke();
      ctx.restore();
    }
  });
}

// ---------------------------------------------------------------- scissors (kéo)
// origin = pivot screw. Blades toward +x (≈225), red handle loops toward -x (≈135). s=1: 360 long. o: {open 0..1}
function scissors(ctx, x, y, s, rot = 0, o = {}) {
  const op = clamp(o.open ?? 0.3) * 0.48;
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineJoin = 'round';
    const blade = (sgn) => {
      ctx.save(); ctx.rotate(sgn * op / 2);
      // handle
      ctx.beginPath(); ctx.moveTo(-10, sgn * 4); ctx.quadraticCurveTo(-60, sgn * 10, -84, sgn * 24);
      ctx.strokeStyle = '#8f1b14'; ctx.lineWidth = 20; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#d93a2b'; ctx.lineWidth = 15; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-112, sgn * 34, 36, 22, sgn * 0.25, 0, TAU); ctx.strokeStyle = '#8f1b14'; ctx.lineWidth = 17; ctx.stroke(); ctx.strokeStyle = '#e04434'; ctx.lineWidth = 12; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,190,170,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-112, sgn * 34, 36, 22, sgn * 0.25, PI * 1.1, PI * 1.6); ctx.stroke();
      // blade
      ctx.beginPath(); ctx.moveTo(-14, -sgn * 2); ctx.lineTo(225, -sgn * 1); ctx.quadraticCurveTo(160, sgn * 22, 24, sgn * 27); ctx.quadraticCurveTo(-8, sgn * 24, -14, sgn * 10); ctx.closePath();
      ctx.fillStyle = lgr(ctx, 0, -sgn * 2, 0, sgn * 27, [[0, '#f8fbfd'], [0.35, '#c4ccd3'], [0.7, '#8a939b'], [1, '#5d656c']]); ctx.fill();
      ctx.strokeStyle = 'rgba(40,45,55,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -sgn * 1); ctx.lineTo(200, -sgn * 0.5); ctx.stroke();
      ctx.restore();
    };
    blade(1); blade(-1);
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fillStyle = rgr(ctx, -2, -2, 1, 0, 0, 8, [[0, '#ffffff'], [1, '#6a737b']]); ctx.fill(); ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 1.5; ctx.stroke();
    // sun glint on blade
    ctx.save(); ctx.globalCompositeOperation = 'screen'; glow(ctx, 150, -2, 22, '#fff4d0', 0.6); ctx.restore();
  });
}

// ---------------------------------------------------------------- the plastic bag (bịch nilon) — hero object
const BAG_CONT = {};
// content texture: mix 0 = layered unmixed ingredients, 1 = fully tossed red-orange. 240x300 local units, centre origin.
function bagContent(mixed) {
  const key = mixed ? 1 : 0; if (BAG_CONT[key]) return BAG_CONT[key];
  const R = 2, [cv, c] = canvas(260 * R, 320 * R), r = rng(mixed ? 909 : 404);
  c.scale(R, R); c.translate(130, 160);
  const bit = (px, py, fn) => { c.save(); c.translate(px, py); c.rotate(r() * TAU); fn(); c.restore(); };
  if (!mixed) {
    // layers (bottom→top): strips, mango, jerky/squid, eggs, red sate puddles + salt
    c.fillStyle = '#efe2c0'; c.fillRect(-130, -160, 260, 320);
    for (let i = 0; i < 260; i++) bit((r() - 0.5) * 260, (r() - 0.5) * 320, () => ribbon(c, 40 + r() * 30, 7, (r() - 0.5) * 16, r() < 0.5 ? '#f6ecd4' : '#e2d2a8', 'rgba(170,135,85,0.35)'));
    for (let i = 0; i < 70; i++) bit((r() - 0.5) * 250, -40 + r() * 110, () => ribbon(c, 34 + r() * 26, 4, (r() - 0.5) * 12, r() < 0.5 ? '#9cc84a' : '#d6e48a'));
    for (let i = 0; i < 26; i++) bit((r() - 0.5) * 240, -70 + r() * 60, () => ribbon(c, 30 + r() * 18, 7, (r() - 0.5) * 10, r() < 0.5 ? '#6a1c0e' : '#9a3418'));
    for (let i = 0; i < 26; i++) bit((r() - 0.5) * 240, -80 + r() * 70, () => ribbon(c, 26 + r() * 20, 4, (r() - 0.5) * 14, '#f2c88e'));
    for (let i = 0; i < 6; i++) { const px = (r() - 0.5) * 200, py = -100 + r() * 40; c.fillStyle = rgr(c, px - 5, py - 6, 1, px, py, 16, [[0, '#ffffff'], [0.7, '#f1e8d4'], [1, '#c9b894']]); c.beginPath(); c.ellipse(px, py, 13, 16, r(), 0, TAU); c.fill(); }
    for (let i = 0; i < 12; i++) { const px = (r() - 0.5) * 220, py = -130 + r() * 50; c.fillStyle = 'rgba(200,40,20,0.85)'; c.beginPath(); c.ellipse(px, py, 14 + r() * 14, 6 + r() * 5, r(), 0, TAU); c.fill(); c.fillStyle = 'rgba(255,140,80,0.7)'; c.beginPath(); c.ellipse(px - 4, py - 2, 5, 2, 0, 0, TAU); c.fill(); }
    for (let i = 0; i < 160; i++) { c.fillStyle = ['#ffb07a', '#d9643a', '#f09060'][(r() * 3) | 0]; c.fillRect((r() - 0.5) * 240, -150 + r() * 70, 2.5, 2.5); }
  } else {
    c.fillStyle = lgr(c, 0, -160, 0, 160, [[0, '#e8662c'], [0.5, '#c8461e'], [1, '#8e2a12']]); c.fillRect(-130, -160, 260, 320);
    for (let i = 0; i < 300; i++) bit((r() - 0.5) * 260, (r() - 0.5) * 320, () => ribbon(c, 36 + r() * 30, 7, (r() - 0.5) * 18, ['#f0843a', '#e0602a', '#f6a860', '#c84a1e'][(r() * 4) | 0], 'rgba(110,30,10,0.35)'));
    for (let i = 0; i < 60; i++) bit((r() - 0.5) * 250, (r() - 0.5) * 300, () => ribbon(c, 30 + r() * 20, 4, (r() - 0.5) * 12, r() < 0.5 ? '#a8c84a' : '#d8d870'));
    for (let i = 0; i < 26; i++) bit((r() - 0.5) * 250, (r() - 0.5) * 300, () => ribbon(c, 28 + r() * 16, 7, (r() - 0.5) * 10, '#5e160a'));
    for (let i = 0; i < 6; i++) { const px = (r() - 0.5) * 200, py = (r() - 0.5) * 260; c.fillStyle = rgr(c, px - 5, py - 6, 1, px, py, 16, [[0, '#fff6ea'], [0.7, '#f0c8a0'], [1, '#c87848']]); c.beginPath(); c.ellipse(px, py, 13, 16, r(), 0, TAU); c.fill(); }
    for (let i = 0; i < 26; i++) bit((r() - 0.5) * 250, (r() - 0.5) * 300, () => { c.fillStyle = r() < 0.5 ? '#3f8f3a' : '#2c6e2c'; c.beginPath(); c.ellipse(0, 0, 9, 3.5, 0, 0, TAU); c.fill(); });
    for (let i = 0; i < 40; i++) bit((r() - 0.5) * 250, (r() - 0.5) * 300, () => { c.fillStyle = '#e8b878'; c.beginPath(); c.ellipse(0, 0, 5, 3.6, 0, 0, TAU); c.fill(); });
    // oil gloss specks
    for (let i = 0; i < 90; i++) { c.fillStyle = 'rgba(255,220,170,0.55)'; c.beginPath(); c.ellipse((r() - 0.5) * 260, (r() - 0.5) * 320, 1.5 + r() * 3, 1 + r() * 1.5, r(), 0, TAU); c.fill(); }
  }
  BAG_CONT[key] = cv; return cv;
}
// body contour of the bag (local units). wob = 0..1 shake deformation, ph = phase
function bagBody(open, wob, ph) {
  const w = (a, b) => Math.sin(ph * a + b) * 7 * wob;
  const p = new Path2D();
  if (open) {
    p.moveTo(-104 + w(1, 0), -128); p.bezierCurveTo(-112 + w(2, 1), -60, -120 + w(1.3, 2), 40, -100, 118);
    p.quadraticCurveTo(-60 + w(1.1, 3), 140, 0, 140); p.quadraticCurveTo(60 + w(1.7, 4), 140, 100, 118);
    p.bezierCurveTo(120 + w(1.2, 5), 40, 112 + w(2.2, 6), -60, 104 + w(1, 7), -128); p.closePath();
  } else {
    p.moveTo(-20, -122); p.bezierCurveTo(-70 + w(1, 0), -110, -112 + w(1.6, 1), -70, -114 + w(1.2, 2), 0);
    p.bezierCurveTo(-116 + w(2, 3), 70, -100, 128, -40, 138); p.quadraticCurveTo(0, 144 + w(1.4, 4), 40, 138);
    p.bezierCurveTo(100, 128, 116 + w(1.8, 5), 70, 114 + w(1.1, 6), 0); p.bezierCurveTo(112 + w(1.5, 7), -70, 70 + w(1, 8), -110, 20, -122); p.closePath();
  }
  return p;
}
const BAG_CRINK = {};
function bagCrinkles(open) {
  const key = open ? 1 : 0; if (BAG_CRINK[key]) return BAG_CRINK[key];
  const R = 2, [cv, c] = canvas(280 * R, 320 * R), r = rng(open ? 5 : 6);
  c.scale(R, R); c.translate(140, 160); c.lineCap = 'round'; c.lineJoin = 'round';
  const crease = (pts, a, w) => {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.strokeStyle = `rgba(40,60,70,${a * 0.35})`; c.lineWidth = w + 1.5; c.save(); c.translate(1.6, 1.6); c.stroke(); c.restore();
    c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = w; c.stroke();
  };
  // radiating creases from the neck / top corners
  for (let i = 0; i < 12; i++) {
    const sx = open ? (i % 2 ? 1 : -1) * (40 + r() * 60) : (r() - 0.5) * 30, sy = -124;
    const pts = [[sx, sy]]; let px = sx, py = sy; const ang = PI / 2 + (r() - 0.5) * 1.4 + (open ? 0 : (sx > 0 ? -0.5 : 0.5));
    for (let k = 0; k < 4; k++) { px += Math.cos(ang + (r() - 0.5) * 0.8) * (20 + r() * 26); py += Math.sin(ang + (r() - 0.5) * 0.8) * (20 + r() * 26); pts.push([px, py]); }
    crease(pts, 0.35 + r() * 0.35, 1.2 + r() * 1.8);
  }
  // random short zig-zag crinkles
  for (let i = 0; i < 22; i++) {
    let px = (r() - 0.5) * 200, py = (r() - 0.5) * 240; const pts = [[px, py]];
    for (let k = 0; k < 3; k++) { px += (r() - 0.5) * 34; py += (r() - 0.5) * 30; pts.push([px, py]); }
    crease(pts, 0.25 + r() * 0.35, 1 + r() * 1.4);
  }
  // bottom corner folds
  for (const sx of [-1, 1]) { crease([[sx * 96, 100], [sx * 70, 126], [sx * 40, 136]], 0.5, 2); crease([[sx * 108, 50], [sx * 92, 88]], 0.35, 1.5); }
  BAG_CRINK[key] = cv; return cv;
}
// plastic bag of bánh tráng trộn. origin = body centre; s=1: body 230 wide × 280 tall (y -128..140), knot at y≈-158, ears to y≈-235.
// o: {open 0..1 (0 = tied/closed), tied (draw knot + rubber band, default !open), fill 0..1 (content level), mix 0..1 (0 layered, 1 tossed),
//     shake 0..1 (slosh + wobble), t, swirl 0..1 (bits flying inside, slow-mo shake shot), glow (backlit rim, default 1), empty}
// returns { mouth:[x,y], knot:[x,y], top:[x,y] } screen coords.
function plasticBag(ctx, x, y, s, o = {}) {
  const open = (o.open || 0) > 0.5, tied = o.tied ?? !open, fill = o.empty ? 0 : clamp(o.fill ?? 0.7), mix = clamp(o.mix ?? 1), t = o.t || 0, sh = clamp(o.shake || 0);
  const ph = t * TAU * 2.5, ret = {};
  at(ctx, x, y, 0, s, s, () => {
    const M = mapper(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const body = bagBody(open, sh, ph);
    // back rim of mouth (open)
    if (open) {
      ctx.beginPath(); ctx.ellipse(0, -128, 104, 24, 0, PI, TAU); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -128, 104, 24, 0, 0, TAU); ctx.fillStyle = 'rgba(40,20,15,0.25)'; ctx.fill();
    }
    // contents
    if (fill > 0) {
      ctx.save(); ctx.clip(body);
      const top = 140 - 268 * fill, slosh = Math.sin(ph) * 16 * sh, tilt = Math.sin(ph) * 0.18 * sh;
      ctx.save();
      ctx.beginPath();
      // content region with sloshing surface
      ctx.moveTo(-140, top + 16 + slosh * -0.6); ctx.quadraticCurveTo(0, top - 14 + Math.cos(ph * 2) * 6 * sh, 140, top + 16 + slosh * 0.6); ctx.lineTo(140, 160); ctx.lineTo(-140, 160); ctx.closePath(); ctx.clip();
      ctx.translate(slosh * 0.6, 0); ctx.rotate(tilt);
      if (mix < 1) ctx.drawImage(bagContent(false), -130, -160, 260, 320);
      if (mix > 0) { ctx.globalAlpha = mix; ctx.drawImage(bagContent(true), -130, -160, 260, 320); ctx.globalAlpha = 1; }
      ctx.restore();
      // depth: darker towards bottom/sides, condensation/oil smear on plastic
      ctx.fillStyle = rgr(ctx, -20, 0, 30, 0, 20, 170, [[0, 'rgba(0,0,0,0)'], [0.7, 'rgba(40,10,5,0.18)'], [1, 'rgba(40,10,5,0.5)']]); ctx.fillRect(-140, -160, 280, 320);
      if (mix > 0.4) { ctx.fillStyle = `rgba(230,90,40,${0.18 * mix})`; ctx.beginPath(); ctx.ellipse(-20, top - 6, 110, 26, 0, 0, TAU); ctx.fill(); }
      if (o.swirl) {
        const r = rng(17);
        for (let i = 0; i < 46; i++) {
          const rad = 30 + r() * 80, a = r() * TAU + t * (1.2 + r()) * 1.6, bx = Math.cos(a) * rad, byy = 10 + Math.sin(a) * rad * 0.9;
          ctx.save(); ctx.globalAlpha = o.swirl; ctx.translate(bx, byy); ctx.rotate(a * 2 + r() * 6);
          const kind = i % 5;
          if (kind === 0) ribbon(ctx, 40, 7, 8, '#f0843a', 'rgba(110,30,10,0.4)');
          else if (kind === 1) ribbon(ctx, 34, 4, 10, '#b8d860');
          else if (kind === 2) ribbon(ctx, 30, 7, 6, '#5e160a');
          else if (kind === 3) { ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.ellipse(0, 0, 10, 4, 0, 0, TAU); ctx.fill(); }
          else { ctx.fillStyle = '#e8b878'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 4, 0, 0, TAU); ctx.fill(); }
          ctx.restore();
        }
      }
      ctx.restore();
    }
    // plastic film
    ctx.save(); ctx.clip(body);
    ctx.fillStyle = 'rgba(232,244,250,0.12)'; ctx.fillRect(-150, -170, 300, 340);
    ctx.save(); ctx.translate(sh * Math.sin(ph) * 3, 0); ctx.drawImage(bagCrinkles(open), -140, -160, 280, 320); ctx.restore();
    // big soft specular streak (left) + small hotspots
    ctx.fillStyle = lgr(ctx, -100, 0, -40, 0, [[0, 'rgba(255,255,255,0)'], [0.4, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
    ctx.beginPath(); ctx.moveTo(-88, -100); ctx.quadraticCurveTo(-112, 10, -76, 110); ctx.lineTo(-56, 104); ctx.quadraticCurveTo(-84, 10, -64, -96); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(64, -70, 9, 18, 0.4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(76, -40, 4, 6, 0.4, 0, TAU); ctx.fill();
    // warm backlight rim (sun behind)
    if (o.glow !== 0) { ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(255,190,110,${0.55 * (o.glow ?? 1)})`; ctx.lineWidth = 14; ctx.filter = 'blur(5px)'; ctx.stroke(body); ctx.filter = 'none'; }
    ctx.restore();
    // edges: dark hairline for contrast + white rim
    ctx.strokeStyle = 'rgba(40,50,60,0.35)'; ctx.lineWidth = 4; ctx.stroke(body);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.4; ctx.stroke(body);
    if (open) {
      // front lip of the mouth, slightly ruffled
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * PI; ctx.lineTo(Math.cos(a) * 104, -128 + Math.sin(a) * 24 + Math.sin(i * 2.3) * 2); }
      ctx.strokeStyle = 'rgba(40,50,60,0.3)'; ctx.lineWidth = 4.5; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(0, -122, 100, 18, 0, 0, PI); ctx.fill();
      ret.mouth = M(0, -128); ret.top = ret.mouth; ret.knot = ret.mouth;
    } else {
      // gathered neck + twist
      const nw = Math.sin(ph) * 4 * sh;
      ctx.beginPath(); ctx.moveTo(-22, -122); ctx.quadraticCurveTo(-12 + nw, -138, -9 + nw, -152); ctx.lineTo(9 + nw, -152); ctx.quadraticCurveTo(12 + nw, -138, 22, -122); ctx.closePath();
      ctx.fillStyle = 'rgba(232,244,250,0.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(60,70,80,0.35)'; ctx.lineWidth = 1.4;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 2 + nw, -128 - i * 6); ctx.lineTo(12 + nw, -132 - i * 6); ctx.stroke(); }
      if (tied) {
        // ears (bunny-ear flaps)
        const ew = Math.sin(ph + 1) * 10 * sh;
        for (const sx of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(nw, -156); ctx.bezierCurveTo(sx * 18 + nw, -186, sx * 40 + ew, -214, sx * 54 + ew * sx, -236);
          ctx.quadraticCurveTo(sx * 30 + ew, -228, sx * 8 + nw, -230); ctx.quadraticCurveTo(sx * 10 + nw, -190, nw, -156); ctx.closePath();
          ctx.fillStyle = 'rgba(236,246,252,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(40,50,60,0.3)'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.8; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx * 6 + nw, -170); ctx.lineTo(sx * 30 + ew, -212); ctx.stroke();
        }
        // knot + red rubber band
        ctx.beginPath(); ctx.ellipse(nw, -157, 14, 9, 0, 0, TAU); ctx.fillStyle = 'rgba(236,246,252,0.5)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#c8231b'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.ellipse(nw, -150, 11, 4, 0, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(nw, -151, 11, 4, 0, PI, TAU); ctx.stroke();
      }
      ret.knot = M(nw, -157); ret.mouth = ret.knot; ret.top = M(0, tied ? -236 : -152);
    }
  });
  return ret;
}
// open bag seen from straight above. origin = mouth centre; s=1: plastic ring Ø≈440, contents disc r≈150.
// o: {layers: array in add order of 'strips'|'mango'|'jerky'|'squid'|'eggs'|'sate'|'salt'|'tac'|'scallion'|'herbs'|'peanuts'|'shallots'|'toppings',
//     lastK 0..1 (pop-in of the last layer), mix 0..1 (cross-fade to tossed), t, spin (ruffle rotation)}
const MOUTH_LAYERS = {};
function mouthLayer(name) {
  if (MOUTH_LAYERS[name]) return MOUTH_LAYERS[name];
  const R = 1.6, [cv, c] = canvas(340 * R, 340 * R), r = rng(name.length * 71 + name.charCodeAt(0) * 3);
  c.scale(R, R); c.translate(170, 170); c.lineCap = 'round';
  const inDisc = (k = 1) => { const a = r() * TAU, d = Math.sqrt(r()) * 140 * k; return [Math.cos(a) * d, Math.sin(a) * d]; };
  const bit = (n, k, fn) => { for (let i = 0; i < n; i++) { const [px, py] = inDisc(k); c.save(); c.translate(px, py); c.rotate(r() * TAU); fn(r()); c.restore(); } };
  if (name === 'strips') bit(230, 1, (q) => ribbon(c, 50 + q * 34, 9, (q - 0.5) * 22, q < 0.5 ? '#f6ecd4' : '#e4d4aa', 'rgba(160,125,80,0.45)'));
  else if (name === 'mango') bit(90, 0.85, (q) => ribbon(c, 40 + q * 26, 4.5, (q - 0.5) * 14, q < 0.5 ? '#a8d050' : '#dfe890', 'rgba(70,110,30,0.35)'));
  else if (name === 'jerky') bit(28, 0.8, (q) => { ribbon(c, 38 + q * 22, 9, (q - 0.5) * 10, q < 0.5 ? '#6a1c0e' : '#9a3418', 'rgba(40,5,0,0.4)'); c.fillStyle = '#f0e0b0'; c.fillRect(-4, -2, 3, 2); });
  else if (name === 'squid') bit(36, 0.8, (q) => ribbon(c, 30 + q * 24, 5, (q - 0.5) * 18, q < 0.5 ? '#f6d6a6' : '#e8a868', 'rgba(150,90,40,0.35)'));
  else if (name === 'eggs') bit(7, 0.7, () => { c.fillStyle = 'rgba(40,20,10,0.25)'; c.beginPath(); c.ellipse(3, 4, 17, 21, 0, 0, TAU); c.fill(); c.fillStyle = rgr(c, -5, -7, 1, 0, 0, 20, [[0, '#ffffff'], [0.7, '#f3ebd8'], [1, '#cdbd98']]); c.beginPath(); c.ellipse(0, 0, 16, 20, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(-6, -8, 4, 6, 0.4, 0, TAU); c.fill(); });
  else if (name === 'sate') { bit(22, 0.8, (q) => { c.fillStyle = 'rgba(205,40,18,0.82)'; c.beginPath(); c.ellipse(0, 0, 18 + q * 22, 9 + q * 9, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,160,100,0.75)'; c.beginPath(); c.ellipse(-5, -3, 6, 2.5, 0, 0, TAU); c.fill(); }); bit(120, 0.85, () => { c.fillStyle = '#5a0a04'; c.fillRect(0, 0, 3, 2); }); }
  else if (name === 'salt') bit(700, 1, (q) => { c.fillStyle = ['#ffb07a', '#d9643a', '#fff0d8', '#f09060', '#b84a2a'][(q * 5) | 0]; c.fillRect(0, 0, 2.6, 2.6); });
  else if (name === 'tac') { bit(26, 0.9, (q) => { c.fillStyle = 'rgba(255,220,110,0.4)'; c.beginPath(); c.ellipse(0, 0, 10 + q * 10, 5 + q * 5, 0, 0, TAU); c.fill(); }); bit(3, 0.6, () => calamansi(c, 0, 0, 0.4, 0, { half: true })); }
  else if (name === 'scallion') bit(40, 0.85, (q) => { c.fillStyle = 'rgba(200,190,60,0.35)'; c.beginPath(); c.ellipse(0, 0, 14, 7, 0, 0, TAU); c.fill(); c.strokeStyle = q < 0.5 ? '#3f9a2e' : '#8acb4a'; c.lineWidth = 2.6; c.beginPath(); c.arc(0, 0, 4 + q * 2, 0, TAU); c.stroke(); });
  else if (name === 'herbs') bit(34, 0.85, (q) => rauRamLeaf(c, 0, 0, 0.55 + q * 0.3, 0));
  else if (name === 'peanuts') bit(70, 0.9, (q) => peanutHalf(c, q));
  else if (name === 'shallots') bit(80, 0.9, (q) => shallotRing(c, q));
  else if (name === 'toppings') {
    bit(5, 0.55, () => quailEgg(c, 0, 0, 0.5, { peel: 1, half: true }));
    bit(10, 0.7, (q) => ribbon(c, 44 + q * 20, 10, (q - 0.5) * 10, q < 0.5 ? '#6a1c0e' : '#9a3418', 'rgba(40,5,0,0.4)'));
    bit(12, 0.7, (q) => rauRamLeaf(c, 0, 0, 0.6, 0));
  }
  MOUTH_LAYERS[name] = cv; return cv;
}
function bagMouthTop(ctx, x, y, s, o = {}) {
  const layers = o.layers || [], lastK = o.lastK ?? 1, mix = clamp(o.mix || 0), t = o.t || 0;
  at(ctx, x, y, (o.spin || 0), s, s, () => {
    // crinkled plastic ring (held open) — outer
    const r = rng(23);
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) { const a = i / 36 * TAU, rr = 205 + (i % 2 ? 14 : -6) + r() * 8; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = 'rgba(236,246,252,0.28)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.stroke();
    // inner walls going down (darker funnel)
    ctx.beginPath(); ctx.arc(0, 0, 165, 0, TAU); ctx.fillStyle = rgr(ctx, 0, 0, 60, 0, 0, 170, [[0, 'rgba(70,50,40,0.75)'], [1, 'rgba(160,170,175,0.5)']]); ctx.fill();
    // bag floor
    ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.fillStyle = 'rgba(210,214,212,0.6)'; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.clip();
    layers.forEach((nm, i) => {
      const last = i === layers.length - 1, k = last ? clamp(lastK) : 1;
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = (mix > 0 ? 1 - mix : 1) * Math.min(1, k * 1.6);
      const sc = last ? lerp(1.12, 1, ease.out(k)) : 1;
      ctx.scale(sc, sc); ctx.drawImage(mouthLayer(nm), -170, -170, 340, 340); ctx.restore();
    });
    if (mix > 0) { ctx.globalAlpha = mix; ctx.drawImage(bagContent(true), -150, -185, 300, 370); ctx.globalAlpha = 1; }
    // vignette inside funnel
    ctx.fillStyle = rgr(ctx, 0, 0, 90, 0, 0, 152, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,15,10,0.45)']]); ctx.fillRect(-160, -160, 320, 320);
    ctx.restore();
    // crease lines on the ring + gloss
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + r() * 0.2 + t * 0.02; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 160, Math.sin(a) * 160); ctx.lineTo(Math.cos(a + 0.08) * (205 + r() * 10), Math.sin(a + 0.08) * (205 + r() * 10)); ctx.stroke(); }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,230,180,0.55)'; ctx.lineWidth = 10; ctx.filter = 'blur(4px)'; ctx.beginPath(); ctx.arc(0, 0, 182, PI * 1.05, PI * 1.55); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, 165, 0, TAU); ctx.stroke();
  });
}

// ---------------------------------------------------------------- xoài xanh (green mango) + bào (julienne peeler)
// mango: origin centre, s=1: 260 long (along x). o: {peel 0..1 — right part peeled showing pale flesh, grooves (julienne lines on flesh)}
function greenMango(ctx, x, y, s, rot = 0, o = {}) {
  const pe = clamp(o.peel || 0);
  at(ctx, x, y, rot, s, s, () => {
    const p = new Path2D(); p.moveTo(-130, 4); p.bezierCurveTo(-130, -70, -20, -88, 60, -72); p.bezierCurveTo(124, -60, 140, -10, 128, 22); p.bezierCurveTo(112, 70, 30, 82, -40, 74); p.bezierCurveTo(-110, 66, -130, 40, -130, 4); p.closePath();
    ctx.fillStyle = 'rgba(20,30,10,0.25)'; ctx.beginPath(); ctx.ellipse(6, 76, 120, 12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(30,50,15,0.6)'; ctx.lineWidth = 4; ctx.stroke(p);
    ctx.fillStyle = rgr(ctx, -30, -40, 10, 0, 0, 150, [[0, '#b8dc62'], [0.5, COL.mango], [1, COL.mangoD]]); ctx.fill(p);
    ctx.save(); ctx.clip(p);
    const r = rng(9); ctx.fillStyle = 'rgba(230,240,180,0.5)'; for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.arc((r() - 0.5) * 250, (r() - 0.5) * 150, 1.4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,200,80,0.25)'; ctx.beginPath(); ctx.ellipse(-60, -30, 60, 30, -0.2, 0, TAU); ctx.fill();
    if (pe > 0) {
      const ex = 140 - pe * 270;
      ctx.beginPath(); ctx.moveTo(ex, -100); for (let yy = -100; yy <= 100; yy += 10) ctx.lineTo(ex + Math.sin(yy * 0.3) * 6, yy); ctx.lineTo(160, 100); ctx.lineTo(160, -100); ctx.closePath();
      ctx.fillStyle = lgr(ctx, 0, -80, 0, 80, [[0, '#f6f2b4'], [0.5, COL.mangoFlesh], [1, '#c8c86a']]); ctx.fill();
      ctx.strokeStyle = 'rgba(160,170,60,0.45)'; ctx.lineWidth = 2; for (let yy = -70; yy <= 70; yy += 9) { ctx.beginPath(); ctx.moveTo(ex + 8, yy); ctx.lineTo(150, yy * 1.02); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(60,90,20,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex, -100); for (let yy = -100; yy <= 100; yy += 10) ctx.lineTo(ex + Math.sin(yy * 0.3) * 6, yy); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-40, -50, 46, 10, -0.15, 0, TAU); ctx.fill();
    ctx.restore();
    // stem
    ctx.fillStyle = '#5a4020'; ctx.beginPath(); ctx.ellipse(-128, 2, 6, 8, 0, 0, TAU); ctx.fill();
  });
}
// pile / rain of julienned mango. origin = pile base. s=1: shred ≈ 70×4.5. o: {n=36, seed, spread, fall, t, h, speed}
function mangoShreds(ctx, x, y, s, o = {}) {
  const L = layoutBits(o, o.n ?? 36, 80, 50);
  at(ctx, x, y, 0, s, s, () => { for (const [px, py, a, q] of L) { ctx.save(); ctx.translate(px, py); ctx.rotate(a); ribbon(ctx, 50 + q * 30, 4.5, (q - 0.5) * 18, q < 0.5 ? '#b0d458' : '#e2ec98', 'rgba(70,110,30,0.4)'); ctx.restore(); } });
}
// julienne peeler (dao bào sợi): origin = grip centre of handle; head toward +x. s=1: 300 long. o: {}
function grater(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    // handle
    rrect(ctx, -110, -22, 150, 44, 22); ctx.fillStyle = lgr(ctx, 0, -22, 0, 22, [[0, '#ffb04a'], [0.5, '#f08a1c'], [1, '#a4560c']]); ctx.fill(); ctx.strokeStyle = 'rgba(90,40,0,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.55)'; rrect(ctx, -100, -16, 120, 7, 4); ctx.fill();
    ctx.beginPath(); ctx.arc(-92, 0, 6, 0, TAU); ctx.fillStyle = '#6a3a10'; ctx.fill();
    // metal frame + blade with teeth
    ctx.fillStyle = lgr(ctx, 0, -60, 0, 60, [[0, '#f0f3f6'], [0.5, '#a9b1b8'], [1, '#6d757c']]);
    ctx.beginPath(); ctx.moveTo(30, -14); ctx.lineTo(120, -62); ctx.lineTo(190, -62); ctx.lineTo(190, 62); ctx.lineTo(120, 62); ctx.lineTo(30, 14); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(40,45,55,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2a2d33'; ctx.fillRect(130, -48, 44, 96);
    ctx.fillStyle = lgr(ctx, 130, 0, 174, 0, [[0, '#dfe4e8'], [1, '#8b939a']]); ctx.fillRect(140, -48, 26, 96);
    ctx.fillStyle = '#2a2d33'; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(140, -48 + i * 8); ctx.lineTo(148, -44 + i * 8); ctx.lineTo(140, -40 + i * 8); ctx.fill(); }
    ctx.save(); ctx.globalCompositeOperation = 'screen'; glow(ctx, 160, -30, 26, '#fff4d0', 0.5); ctx.restore();
  });
}
const peeler = grater;

// ---------------------------------------------------------------- khô bò / khô mực / trứng cút
// beef jerky strip: origin centre, s=1: 140×30. o: {seed}
function beefJerky(ctx, x, y, s, rot = 0, o = {}) {
  const r = rng((o.seed || 1) * 17 + 5);
  at(ctx, x, y, rot, s, s, () => {
    const p = new Path2D(); p.moveTo(-70, -10);
    for (let i = 0; i <= 10; i++) p.lineTo(-70 + i * 14, -12 + Math.sin(i * 1.7) * 3 - r() * 4);
    for (let i = 10; i >= 0; i--) p.lineTo(-70 + i * 14, 14 + Math.sin(i * 1.3) * 3 + r() * 4);
    p.closePath();
    ctx.fillStyle = lgr(ctx, 0, -14, 0, 16, [[0, COL.jerkyL], [0.4, COL.jerky], [1, '#3e0f06']]); ctx.fill(p);
    ctx.strokeStyle = 'rgba(30,5,0,0.6)'; ctx.lineWidth = 2; ctx.stroke(p);
    ctx.save(); ctx.clip(p);
    ctx.strokeStyle = 'rgba(30,5,0,0.4)'; ctx.lineWidth = 1.5; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-70, -8 + i * 3.5); ctx.lineTo(70, -9 + i * 3.6 + r() * 2); ctx.stroke(); }
    for (let i = 0; i < 18; i++) { ctx.fillStyle = r() < 0.6 ? '#e8361a' : '#f2e2b0'; ctx.fillRect((r() - 0.5) * 130, (r() - 0.5) * 22, 3, 2); }
    ctx.fillStyle = 'rgba(255,190,140,0.35)'; ctx.fillRect(-66, -10, 130, 4);
    ctx.restore();
  });
}
// dried squid shreds: pile or rain. origin = pile base. s=1: strand ≈ 50×5. o: {n=30, seed, spread, fall, t, h, speed, jerky (mix in jerky strips 0..1)}
function driedSquidShreds(ctx, x, y, s, o = {}) {
  const L = layoutBits(o, o.n ?? 30, 80, 46), jk = o.jerky || 0;
  at(ctx, x, y, 0, s, s, () => {
    for (const [px, py, a, q] of L) {
      ctx.save(); ctx.translate(px, py); ctx.rotate(a);
      if (q < jk) ribbon(ctx, 34 + q * 20, 9, (q - 0.5) * 12, q < jk / 2 ? '#6a1c0e' : '#9a3418', 'rgba(30,5,0,0.5)');
      else { ribbon(ctx, 36 + q * 26, 5, (q - 0.5) * 24, q < 0.6 ? '#f6d6a6' : '#e8a868', 'rgba(150,90,40,0.45)'); }
      ctx.restore();
    }
  });
}
// quail egg: origin centre, s=1: 54×70. o: {peel 0..1 (0 speckled shell, 1 glossy white), half (cut, shows yolk), rot}
function quailEgg(ctx, x, y, s, o = {}) {
  const pe = clamp(o.peel ?? 1), r = rng(31);
  at(ctx, x, y, o.rot || 0, s, s, () => {
    const egg = new Path2D(); egg.moveTo(0, -35); egg.bezierCurveTo(24, -35, 28, 8, 27, 14); egg.bezierCurveTo(26, 30, 14, 35, 0, 35); egg.bezierCurveTo(-14, 35, -26, 30, -27, 14); egg.bezierCurveTo(-28, 8, -24, -35, 0, -35); egg.closePath();
    ctx.fillStyle = 'rgba(40,20,10,0.25)'; ctx.beginPath(); ctx.ellipse(3, 34, 22, 5, 0, 0, TAU); ctx.fill();
    if (o.half) {
      ctx.fillStyle = rgr(ctx, -8, -10, 2, 0, 0, 36, [[0, '#ffffff'], [0.75, COL.egg], [1, '#d6c8a6']]); ctx.fill(egg);
      ctx.beginPath(); ctx.ellipse(0, 4, 15, 17, 0, 0, TAU); ctx.fillStyle = rgr(ctx, -4, -2, 1, 0, 4, 17, [[0, '#ffd56a'], [1, COL.yolk]]); ctx.fill();
      ctx.strokeStyle = 'rgba(150,110,60,0.4)'; ctx.lineWidth = 1.5; ctx.stroke(egg);
      return;
    }
    ctx.fillStyle = rgr(ctx, -9, -14, 2, 0, 0, 40, [[0, '#ffffff'], [0.65, COL.egg], [1, '#cfc2a2']]); ctx.fill(egg);
    ctx.strokeStyle = 'rgba(150,120,80,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(egg);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(-9, -16, 5, 10, 0.3, 0, TAU); ctx.fill();
    if (pe < 1) {
      // shell covers the bottom (1-pe) portion with a jagged edge
      ctx.save(); ctx.clip(egg);
      const ey = lerp(-40, 40, pe);
      ctx.beginPath(); ctx.moveTo(-30, 40); ctx.lineTo(-30, ey);
      for (let i = 0; i <= 10; i++) ctx.lineTo(-30 + i * 6, ey + (i % 2 ? -5 : 4));
      ctx.lineTo(30, 40); ctx.closePath();
      ctx.fillStyle = COL.eggShell; ctx.fill(); ctx.strokeStyle = 'rgba(120,90,50,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.clip();
      for (let i = 0; i < 26; i++) { ctx.fillStyle = r() < 0.5 ? '#5a3a24' : '#7a5034'; ctx.beginPath(); ctx.ellipse((r() - 0.5) * 54, (r() - 0.5) * 70, 2 + r() * 5, 1.5 + r() * 4, r() * 3, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  });
}

// ---------------------------------------------------------------- spoon, pour stream, salt
// spoon: origin = bowl centre, handle toward -x. s=1: 240 long, bowl 74×48.
// o: {fill: 'sate'|'scallion'|'salt'|null, tip 0..1 (how far the contents have poured out), drip}
function spoon(ctx, x, y, s, rot = 0, o = {}) {
  const tip = clamp(o.tip || 0);
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.quadraticCurveTo(-100, -8, -170, -10); ctx.strokeStyle = 'rgba(40,45,55,0.55)'; ctx.lineWidth = 15; ctx.stroke();
    ctx.strokeStyle = lgr(ctx, 0, -16, 0, 6, [[0, '#ffffff'], [0.5, '#c5ccd2'], [1, '#7d858c']]); ctx.lineWidth = 11; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-172, -10, 13, 9, 0, 0, TAU); ctx.fillStyle = '#c9ced3'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, 38, 24, 0, 0, TAU); ctx.fillStyle = lgr(ctx, 0, -24, 0, 24, [[0, '#8a939b'], [0.5, '#e8ecef'], [1, '#9aa2a9']]); ctx.fill(); ctx.strokeStyle = 'rgba(40,45,55,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    if (o.fill && tip < 0.98) {
      const k = 1 - tip;
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 33, 20, 0, 0, TAU); ctx.clip();
      const cx = lerp(0, 18, tip);
      ctx.beginPath(); ctx.ellipse(cx, 2, 31 * Math.sqrt(k), 18 * Math.sqrt(k), 0, 0, TAU);
      if (o.fill === 'sate') {
        ctx.fillStyle = rgr(ctx, cx - 8, -4, 2, cx, 2, 30, [[0, '#ff8a40'], [0.5, '#d0301a'], [1, '#7a120a']]); ctx.fill();
        const r = rng(3); ctx.fillStyle = '#4a0804'; for (let i = 0; i < 20 * k; i++) ctx.fillRect(cx + (r() - 0.5) * 44 * k, (r() - 0.5) * 24 * k, 3, 2);
      } else if (o.fill === 'scallion') {
        ctx.fillStyle = rgr(ctx, cx - 8, -4, 2, cx, 2, 30, [[0, '#f4ea7a'], [0.6, '#b8b83a'], [1, '#6a7a1a']]); ctx.fill();
        const r = rng(4); for (let i = 0; i < 14 * k; i++) { ctx.strokeStyle = r() < 0.5 ? '#3f9a2e' : '#9ad04a'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(cx + (r() - 0.5) * 40 * k, (r() - 0.5) * 20 * k, 3.5, 0, TAU); ctx.stroke(); }
      } else { ctx.fillStyle = COL.salt; ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(cx - 10, -6, 9, 3, -0.2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(-16, -14, 10, 3, 0.1, 0, TAU); ctx.fill();
  });
}
// glossy stream from (x0,y0) to (x1,y1). w = width (local units of the current transform), t animates wobble/drops, col = base colour.
// o: {drops (count, default 5), scallion (green flecks)}
function pourStream(ctx, x0, y0, x1, y1, w = 6, t = 0, col = COL.sateOil, o = {}) {
  const n = 18, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, wob = Math.sin(u * 9 - t * 14) * w * 0.35 * u;
    pts.push([lerp(x0, x1, u) + wob + Math.sin(u * PI) * (x1 - x0) * 0.08, lerp(y0, y1, u * u * 0.4 + u * 0.6)]);
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    const u = i / n, ww = w * (1 - u * 0.45);
    ctx.strokeStyle = col; ctx.lineWidth = ww; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i + 1][0], pts[i + 1][1]); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,230,190,0.75)'; ctx.lineWidth = Math.max(1, w * 0.22); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0] - w * 0.18, p[1]) : ctx.moveTo(p[0] - w * 0.18, p[1])); ctx.stroke();
  // flecks + drops
  const r = rng(12), nd = o.drops ?? 5;
  ctx.fillStyle = o.scallion ? '#3f9a2e' : '#5a0a04';
  for (let i = 0; i < 10; i++) { const u = (r() + t * 1.4) % 1, j = (u * n) | 0; ctx.fillRect(pts[j][0] - 1, pts[j][1], w * 0.3, w * 0.25); }
  for (let i = 0; i < nd; i++) {
    const u = (r() + t * 1.1) % 1, dx = x1 + (r() - 0.5) * w * 4, dy = y1 + u * w * 10 - w * 3;
    ctx.globalAlpha = 1 - u; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(dx, dy, w * 0.35, w * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,0.9)'; ctx.beginPath(); ctx.arc(dx - w * 0.12, dy - w * 0.15, w * 0.1, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // splash ring at the target
  ctx.strokeStyle = rgba(col.length === 7 ? col : '#e8501f', 0.55); ctx.lineWidth = Math.max(1, w * 0.3); ctx.beginPath(); ctx.ellipse(x1, y1, w * (1.6 + Math.sin(t * 20) * 0.3), w * 0.5, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}
// shrimp-salt cloud falling from (x,y). s=1: cone ≈ 300 wide × 420 tall. o: {t, k 0..1 (density), seed, n=220, col, light 0..1 (sun-catch glow)}
function saltCloud(ctx, x, y, s, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), n = Math.round((o.n || 220) * k), r = rng((o.seed || 1) * 19);
  const cols = o.col ? [o.col] : ['#ffb07a', '#e2643a', '#fff0d8', '#f09060', '#c8502a'];
  at(ctx, x, y, 0, s, s, () => {
    if (o.light !== 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgr(ctx, 0, 180, 10, 0, 180, 220, [[0, `rgba(255,170,100,${0.35 * k * (o.light ?? 1)})`], [1, 'rgba(255,170,100,0)']]); ctx.fillRect(-240, -20, 480, 460); ctx.restore(); }
    for (let i = 0; i < n; i++) {
      const u = (r() + t * (0.5 + r() * 0.3)) % 1, spread = (r() - 0.5) * 2;
      const px = spread * (20 + u * 150) + Math.sin(t * 3 + i) * 6 * u, py = u * 420;
      const sz = 2 + r() * 3.5;
      ctx.globalAlpha = Math.min(1, (1 - u) * 1.6); ctx.fillStyle = cols[(r() * cols.length) | 0]; ctx.fillRect(px, py, sz, sz);
    }
    ctx.globalAlpha = 1;
  });
}

// ---------------------------------------------------------------- tắc, rau răm, đậu phộng, hành phi
// calamansi: origin centre, s=1: Ø70. o: {half (cut face), squeeze 0..1 (squash)}
function calamansi(ctx, x, y, s, rot = 0, o = {}) {
  const sq = clamp(o.squeeze || 0);
  at(ctx, x, y, rot, s * (1 + sq * 0.25), s * (1 - sq * 0.35), () => {
    if (o.half) {
      ctx.beginPath(); ctx.arc(0, 0, 35, 0, TAU); ctx.fillStyle = '#4f8a22'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 31, 0, TAU); ctx.fillStyle = '#fff3c8'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, TAU); ctx.fillStyle = rgr(ctx, -6, -6, 2, 0, 0, 28, [[0, '#ffd27a'], [1, COL.tacFlesh]]); ctx.fill();
      ctx.strokeStyle = 'rgba(255,245,210,0.9)'; ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); ctx.stroke(); }
      ctx.fillStyle = '#fff6d0'; for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 12, Math.sin(a) * 12, 3, 5, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-10, -12, 8, 4, -0.6, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 35, 0, TAU); ctx.fillStyle = rgr(ctx, -12, -12, 3, 0, 0, 36, [[0, '#c8e070'], [0.55, COL.tac], [0.85, '#5f8a1e'], [1, '#e89a2a']]); ctx.fill();
      ctx.strokeStyle = 'rgba(40,60,10,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      const r = rng(8); ctx.fillStyle = 'rgba(230,250,170,0.5)'; for (let i = 0; i < 30; i++) { const a = r() * TAU, d = r() * 32; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.1, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(-12, -14, 9, 5, -0.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4a3a18'; ctx.beginPath(); ctx.arc(0, -33, 3, 0, TAU); ctx.fill();
    }
  });
}
// juice drops falling from (x,y). s=1: fall ≈ o.h (300). o: {t, n=8, seed, h, slow (0..1 slow-mo stretch), col}
function juiceDrops(ctx, x, y, s, o = {}) {
  const t = o.t || 0, n = o.n ?? 8, r = rng((o.seed || 2) * 7), h = o.h ?? 300, sl = o.slow || 0;
  at(ctx, x, y, 0, s, s, () => {
    for (let i = 0; i < n; i++) {
      const u = (r() + t * (sl ? 0.35 : 1.2) * (0.8 + r() * 0.4)) % 1, px = (r() - 0.5) * 30 + Math.sin(i) * u * 20, py = u * u * h;
      const sz = 5 + r() * 6, st = 1 + (sl ? 0.2 : 1.2) * u;
      ctx.save(); ctx.translate(px, py); ctx.scale(1, st);
      ctx.beginPath(); ctx.moveTo(0, -sz * 1.6); ctx.quadraticCurveTo(sz, -sz * 0.2, sz * 0.9, sz * 0.3); ctx.arc(0, sz * 0.3, sz * 0.9, 0, PI); ctx.quadraticCurveTo(-sz, -sz * 0.2, 0, -sz * 1.6);
      ctx.fillStyle = o.col || 'rgba(255,214,90,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,250,220,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.ellipse(-sz * 0.35, -sz * 0.1, sz * 0.22, sz * 0.35, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  });
}
// one rau răm leaf (origin = base, points +x, ≈ 60 long at s=1)
function rauRamLeaf(c, x, y, s, rot) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(24, -14, 62, -1); c.quadraticCurveTo(24, 12, 0, 0); c.closePath();
  c.fillStyle = lgr(c, 0, -10, 0, 10, [[0, '#5aa84a'], [1, COL.herbD]]); c.fill(); c.strokeStyle = 'rgba(20,50,20,0.5)'; c.lineWidth = 1.2; c.stroke();
  c.strokeStyle = 'rgba(200,240,170,0.6)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2, 0); c.lineTo(58, -1); c.stroke();
  c.fillStyle = 'rgba(80,30,40,0.45)'; c.beginPath(); c.moveTo(20, -1); c.lineTo(28, -5); c.lineTo(36, -1); c.lineTo(28, 3); c.closePath(); c.fill(); // dark chevron mark
  c.restore();
}
// rau răm sprig: origin = stem base, extends +x. s=1: 200 long. o: {chopped (pile of bits instead), seed, n}
function rauRam(ctx, x, y, s, rot = 0, o = {}) {
  if (o.chopped) {
    const L = layoutBits(o, o.n ?? 20, 70, 30);
    at(ctx, x, y, rot, s, s, () => { for (const [px, py, a, q] of L) rauRamLeaf(ctx, px, py, 0.32 + q * 0.2, a); });
    return;
  }
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7a3a4a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(90, -14, 190, -6); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,140,160,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(90, -16, 190, -8); ctx.stroke();
    for (let i = 0; i < 7; i++) { const u = 0.15 + i * 0.12, px = u * 190, py = -14 * Math.sin(u * PI) + 4; ctx.fillStyle = '#5a2a34'; ctx.beginPath(); ctx.arc(px, py - 4, 3.5, 0, TAU); ctx.fill(); rauRamLeaf(ctx, px, py - 4, 0.75 + (i % 3) * 0.08, (i % 2 ? 1 : -1) * (0.7 - i * 0.04) - 0.1); }
    rauRamLeaf(ctx, 188, -6, 0.8, -0.05);
  });
}
function peanutHalf(c, q) { c.fillStyle = q < 0.5 ? COL.peanutL : COL.peanut; c.beginPath(); c.ellipse(0, 0, 8, 5.6, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(110,55,20,0.45)'; c.lineWidth = 1; c.stroke(); c.fillStyle = 'rgba(255,240,210,0.6)'; c.beginPath(); c.ellipse(-2, -2, 3, 1.4, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(120,60,20,0.4)'; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.stroke(); }
function shallotRing(c, q) { c.strokeStyle = q < 0.5 ? COL.shallot : COL.shallotD; c.lineWidth = 2.6; c.beginPath(); c.ellipse(0, 0, 6 + q * 3, 4 + q * 2, 0, 0, TAU * (0.7 + q * 0.3)); c.stroke(); c.strokeStyle = 'rgba(255,220,150,0.5)'; c.lineWidth = 1; c.beginPath(); c.ellipse(0, -0.6, 6 + q * 3, 4 + q * 2, 0, PI, TAU); c.stroke(); }
// roasted peanut halves: pile or rain. origin = pile base. s=1: nut 16×11. o: {n=30, seed, spread, fall, t, h}
function peanuts(ctx, x, y, s, o = {}) { const L = layoutBits(o, o.n ?? 30, 60, 30); at(ctx, x, y, 0, s, s, () => { for (const [px, py, a, q] of L) { ctx.save(); ctx.translate(px, py); ctx.rotate(a); peanutHalf(ctx, q); ctx.restore(); } }); }
// fried shallot rings: pile or rain. origin = pile base. s=1: ring ≈ 14. o: {n=40, seed, spread, fall, t, h}
function friedShallots(ctx, x, y, s, o = {}) { const L = layoutBits(o, o.n ?? 40, 60, 26); at(ctx, x, y, 0, s, s, () => { for (const [px, py, a, q] of L) { ctx.save(); ctx.translate(px, py); ctx.rotate(a); shallotRing(ctx, q); ctx.restore(); } }); }

// ---------------------------------------------------------------- skewer, fork, trà tắc
// tossed bite (tangle of red-orange strips + bits) centred at origin, ≈ 70 wide
function mixBite(c, seed = 5) {
  const r = rng(seed);
  for (let i = 0; i < 14; i++) { c.save(); c.translate((r() - 0.5) * 50, (r() - 0.5) * 30); c.rotate(r() * TAU); ribbon(c, 34 + r() * 18, 7, (r() - 0.5) * 16, ['#f0843a', '#e0602a', '#f6a860', '#c84a1e'][(r() * 4) | 0], 'rgba(110,30,10,0.45)'); c.restore(); }
  for (let i = 0; i < 4; i++) { c.save(); c.translate((r() - 0.5) * 40, (r() - 0.5) * 24); c.rotate(r() * TAU); ribbon(c, 28, 4, 6, '#b8d860'); c.restore(); }
  c.fillStyle = '#3f8f3a'; c.beginPath(); c.ellipse(8, -8, 9, 3.5, 0.5, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,230,190,0.7)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc((r() - 0.5) * 50, (r() - 0.5) * 26, 1.6, 0, TAU); c.fill(); }
}
// bamboo skewer: origin = grip point, pointed tip toward +x (260), blunt end -x (140). s=1: 400 long.
// o: {food: null|'mix'|'egg'|'jerky' (speared near the tip)}
function skewer(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-140, -4); ctx.lineTo(236, -3); ctx.lineTo(260, 0); ctx.lineTo(236, 3); ctx.lineTo(-140, 4); ctx.closePath();
    ctx.fillStyle = lgr(ctx, 0, -4, 0, 4, [[0, '#f6dca0'], [0.5, '#d9b36a'], [1, '#9a7638']]); ctx.fill(); ctx.strokeStyle = 'rgba(90,60,20,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (o.food === 'mix') { ctx.save(); ctx.translate(200, 0); mixBite(ctx, 7); ctx.restore(); }
    else if (o.food === 'egg') quailEgg(ctx, 200, 0, 0.8, { peel: 1, rot: PI / 2 });
    else if (o.food === 'jerky') beefJerky(ctx, 196, 0, 0.5, PI / 2);
  });
}
// plastic fork: origin = grip, tines toward +x (to 100), handle toward -x (to -60). s=1: 160 long. o: {food: null|'mix'}
function plasticFork(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    const p = new Path2D(); p.moveTo(-60, -5); p.lineTo(40, -6); p.quadraticCurveTo(52, -16, 62, -16); p.lineTo(100, -16); p.lineTo(100, 16); p.lineTo(62, 16); p.quadraticCurveTo(52, 16, 40, 6); p.lineTo(-60, 5); p.closePath();
    ctx.fillStyle = 'rgba(250,250,248,0.92)'; ctx.fill(p); ctx.strokeStyle = 'rgba(80,90,100,0.55)'; ctx.lineWidth = 1.6; ctx.stroke(p);
    ctx.strokeStyle = 'rgba(120,130,140,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(72, -8 + i * 8); ctx.lineTo(101, -8 + i * 8); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-54, -2); ctx.lineTo(36, -3); ctx.stroke();
    if (o.food === 'mix') { ctx.save(); ctx.translate(90, 0); ctx.scale(0.8, 0.8); mixBite(ctx, 11); ctx.restore(); }
  });
}
// iced calamansi tea in a plastic cup with straw: origin = bottom centre, s=1: 160 wide (rim) × 260 tall. Cached per (level, ice, straw).
// o: {level 0..1, ice (bool, default true), straw (default true), t (bubble shimmer)}
const TRA_CACHE = {};
function traTac(ctx, x, y, s, o = {}) {
  const level = o.level ?? 0.85, ice = o.ice !== false, straw = o.straw !== false, key = [level, ice, straw].join('|');
  if (!TRA_CACHE[key]) {
    const R = 2, [cv, c] = canvas(200 * R, 380 * R), r = rng(66);
    c.scale(R, R); c.translate(100, 360);
    const cup = new Path2D(); cup.moveTo(-80, -260); cup.lineTo(80, -260); cup.lineTo(60, 0); cup.quadraticCurveTo(0, 6, -60, 0); cup.closePath();
    c.fillStyle = 'rgba(30,20,10,0.25)'; c.beginPath(); c.ellipse(0, 2, 66, 9, 0, 0, TAU); c.fill();
    // straw behind
    if (straw) { c.save(); c.translate(26, -150); c.rotate(0.2); c.fillStyle = '#e83a5a'; c.fillRect(-7, -200, 14, 330); c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-4, -200, 3, 330); c.restore(); }
    c.save(); c.clip(cup);
    const top = -12 - 238 * level;
    c.fillStyle = lgr(c, 0, top, 0, 0, [[0, 'rgba(250,196,90,0.9)'], [1, 'rgba(200,110,30,0.95)']]); c.fillRect(-90, top, 180, -top);
    if (ice) for (let i = 0; i < 7; i++) { const px = (r() - 0.5) * 110, py = top + 16 + r() * 120; c.save(); c.translate(px, py); c.rotate(r()); c.fillStyle = 'rgba(255,250,235,0.45)'; c.beginPath(); c.roundRect(-18, -16, 36, 32, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2; c.stroke(); c.restore(); }
    for (let i = 0; i < 3; i++) calamansi(c, (r() - 0.5) * 90, top + 60 + i * 50, 0.55, r() * 3, { half: true });
    // mint-like leaf
    rauRamLeaf(c, -30, top + 8, 0.6, -0.3);
    for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc((r() - 0.5) * 120, top + r() * -top, 1 + r() * 2, 0, TAU); c.fill(); }
    // liquid surface
    c.beginPath(); c.ellipse(0, top, 80, 10, 0, 0, TAU); c.fillStyle = 'rgba(255,220,140,0.6)'; c.fill();
    c.restore();
    // plastic cup: ridges, gloss, condensation
    c.fillStyle = 'rgba(235,245,250,0.12)'; c.fill(cup);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2.6; c.stroke(cup);
    c.save(); c.clip(cup);
    c.fillStyle = lgr(c, -80, 0, 80, 0, [[0, 'rgba(255,255,255,0)'], [0.15, 'rgba(255,255,255,0.45)'], [0.25, 'rgba(255,255,255,0.05)'], [0.85, 'rgba(255,220,170,0.35)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(-90, -270, 180, 280);
    for (let i = 0; i < 70; i++) { const px = (r() - 0.5) * 140, py = -r() * 240; c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(px, py, 1.4 + r() * 2.2, 1.8 + r() * 2.6, 0, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-78, -236); c.lineTo(78, -236); c.stroke();
    c.restore();
    // rim + sealed film
    c.beginPath(); c.ellipse(0, -260, 80, 12, 0, 0, TAU); c.fillStyle = 'rgba(240,250,255,0.35)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.stroke();
    if (straw) { c.save(); c.translate(26, -150); c.rotate(0.2); c.fillStyle = '#ff5a78'; c.fillRect(-7, -200, 14, 92); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(-4, -200, 3, 92); c.restore(); }
    TRA_CACHE[key] = cv;
  }
  ctx.drawImage(TRA_CACHE[key], x - 100 * s, y - 360 * s, 200 * s, 380 * s);
  return { top: [x, y - 260 * s] };
}

// =====================================================================================
// EFFECTS
// =====================================================================================
const FLAVORS = [
  { key: 'sour', vi: 'CHUA', en: 'SOUR', col: '#ffd84a', colD: '#e0a010', icon: 'tac' },
  { key: 'spicy', vi: 'CAY', en: 'SPICY', col: '#ff3b2a', colD: '#a8140c', icon: 'chili' },
  { key: 'salty', vi: 'MẶN', en: 'SALTY', col: '#35d0c0', colD: '#127a78', icon: 'salt' },
  { key: 'sweet', vi: 'NGỌT', en: 'SWEET', col: '#ff8ac8', colD: '#c03c88', icon: 'sweet' },
];
function flavorIcon(ctx, kind, x, y, s) {
  at(ctx, x, y, 0, s, s, () => {
    if (kind === 'tac') calamansi(ctx, 0, 0, 0.9, 0, { half: true });
    else if (kind === 'chili') {
      ctx.beginPath(); ctx.moveTo(-30, -14); ctx.bezierCurveTo(-10, -26, 26, -16, 34, 18); ctx.bezierCurveTo(14, 6, -8, 4, -28, 2); ctx.closePath();
      ctx.fillStyle = lgr(ctx, 0, -20, 0, 14, [[0, '#ff6a4a'], [1, '#b0100a']]); ctx.fill(); ctx.strokeStyle = 'rgba(80,0,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(0, -14, 12, 3, 0.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3f8f3a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-30, -8); ctx.quadraticCurveTo(-42, -12, -44, -26); ctx.stroke();
    } else if (kind === 'salt') {
      const r = rng(5); for (let i = 0; i < 26; i++) { ctx.fillStyle = ['#ffffff', '#ffb07a', '#e2643a'][(r() * 3) | 0]; const a = r() * TAU, d = r() * 26; ctx.fillRect(Math.cos(a) * d, Math.sin(a) * d, 5, 5); }
      ctx.save(); ctx.translate(-4, -2); ctx.rotate(0.3); ctx.beginPath(); ctx.ellipse(0, 0, 24, 10, 0, 0, PI); ctx.strokeStyle = '#ff7a50'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    } else {
      // sweet: sparkly sugar cube / heart
      ctx.beginPath(); ctx.moveTo(0, 22); ctx.bezierCurveTo(-34, 0, -26, -30, 0, -14); ctx.bezierCurveTo(26, -30, 34, 0, 0, 22); ctx.closePath();
      ctx.fillStyle = lgr(ctx, 0, -26, 0, 22, [[0, '#ffc2e2'], [1, '#e04a98']]); ctx.fill(); ctx.strokeStyle = 'rgba(120,20,70,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(-10, -10, 6, 3, -0.6, 0, TAU); ctx.fill();
    }
  });
}
// four swirling flavour ribbons bursting out of (x,y). s=1: radius ≈ 400.
// o: {t (seconds, drives swirl), k 0..1 (burst progress: 0 nothing, 1 full), labels (draw icons on the ribbon heads, default true), only: index 0..3 to draw a single ribbon, spin}
// returns 4 label anchors [{x,y,key,vi,en,col}] (screen coords of each ribbon head) — place bilingual text with text.js near them.
function flavorBurst(ctx, x, y, s, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), out = [];
  const R = 400 * ease.out(k);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  FLAVORS.forEach((f, i) => {
    const base = -PI / 2 + i * PI / 2 + PI / 4 + (o.spin || 0) + t * 0.6;
    const pts = [];
    for (let j = 0; j <= 28; j++) {
      const u = j / 28, a = base + u * 2.0 + Math.sin(u * 5 + t * 3 + i) * 0.18, rr = u * R;
      pts.push([x + Math.cos(a) * rr * s, y + Math.sin(a) * rr * s * 0.9]);
    }
    const head = pts[pts.length - 1];
    out.push({ x: head[0], y: head[1], key: f.key, vi: f.vi, en: f.en, col: f.col });
    if (o.only !== undefined && o.only !== i) return;
    if (k <= 0.01) return;
    // glow, body, highlight
    for (const [w, col, a] of [[70, f.col, 0.18], [34, f.colD, 0.9], [24, f.col, 1], [6, '#ffffff', 0.7]]) {
      ctx.globalAlpha = a;
      ctx.beginPath(); pts.forEach((p, j) => j ? ctx.lineTo(p[0], p[1] - (w === 6 ? 6 * s : 0)) : ctx.moveTo(p[0], p[1]));
      ctx.strokeStyle = col; ctx.lineWidth = w * s * (0.5 + 0.5 * k);
      if (w === 70) ctx.filter = 'blur(10px)';
      ctx.stroke(); ctx.filter = 'none';
    }
    ctx.globalAlpha = 1;
    // sparkles trailing
    const r = rng(i * 13 + 1);
    for (let j = 0; j < 6; j++) { const p = pts[(r() * 26) | 0]; sparkle(ctx, p[0] + (r() - 0.5) * 30 * s, p[1] + (r() - 0.5) * 30 * s, (10 + r() * 14) * s, 0.8 * k); }
    if (o.labels !== false && k > 0.5) {
      ctx.save(); ctx.globalAlpha = clamp((k - 0.5) * 2);
      ctx.beginPath(); ctx.arc(head[0], head[1], 46 * s, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill(); ctx.strokeStyle = f.colD; ctx.lineWidth = 6 * s; ctx.stroke();
      flavorIcon(ctx, f.icon, head[0], head[1], s);
      ctx.restore();
    }
  });
  if (k > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; glow(ctx, x, y, 160 * s * k, '#fff2c0', 0.7 * k); ctx.restore(); }
  ctx.restore();
  return out;
}
// cartoon shake/motion lines around an object at (x,y). s=1: object radius ≈ 150.
// o: {t, k 0..1 intensity, col (default white), n (pairs, 3), dir ('h'|'v'|'both')}
function shakeLines(ctx, x, y, s, o = {}) {
  const t = o.t || 0, k = clamp(o.k ?? 1), n = o.n ?? 3, col = o.col || 'rgba(255,255,255,0.95)';
  if (k <= 0) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.globalAlpha = k;
  const flick = (Math.floor(t * 15) % 2) ? 1 : 0.8;
  for (const sd of [-1, 1]) for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.32, r0 = (165 + flick * 10) * s, r1 = r0 + (40 + i % 2 * 18) * s * flick;
    const ang = (sd < 0 ? PI : 0) + a;
    ctx.lineWidth = (9 - Math.abs(i - (n - 1) / 2) * 2) * s;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); ctx.stroke();
  }
  if (o.dir === 'v' || o.dir === 'both') for (const sd of [-1, 1]) { ctx.lineWidth = 7 * s; ctx.beginPath(); ctx.arc(x, y + (sd < 0 ? (o.vTop ?? -300) : (o.vBot ?? 150)) * s, 50 * s, sd < 0 ? PI * 1.2 : PI * 0.2, sd < 0 ? PI * 1.8 : PI * 0.8); ctx.stroke(); }
  ctx.restore();
}
// speed whoosh arcs (a fast swipe). Draws an arc trail ending at (x,y) going in direction ang (radians), length len.
// o: {k 0..1 (fade), col, n (streaks, 4), w (width, 10), curve (bend, 0.3)}
function whoosh(ctx, x, y, ang, len, o = {}) {
  const k = clamp(o.k ?? 1), n = o.n ?? 4, w = o.w ?? 10, cv = o.curve ?? 0.3, col = o.col || '#ffffff';
  if (k <= 0) return;
  ctx.save(); ctx.lineCap = 'round';
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * w * 2.4, l = len * (1 - Math.abs(i - (n - 1) / 2) * 0.22);
    const ex = x + nx * off, ey = y + ny * off, sx = ex - dx * l, sy = ey - dy * l;
    const g = ctx.createLinearGradient(sx, sy, ex, ey); g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, 0.9 * k));
    ctx.strokeStyle = g; ctx.lineWidth = w * (1 - Math.abs(i - (n - 1) / 2) * 0.25);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2 + nx * l * cv, (sy + ey) / 2 + ny * l * cv, ex, ey); ctx.stroke();
  }
  ctx.restore();
}
// confetti-like ingredient bits exploding / floating around (x,y). s=1: spread radius ≈ 500.
// o: {t (seconds since burst), n=60, seed, gravity (900), burst (initial speed, 900), loop (float in place instead of burst), kinds (array subset)}
const BIT_KINDS = ['strip', 'mango', 'jerky', 'squid', 'peanut', 'shallot', 'herb', 'egg', 'chili', 'salt'];
function ingredientBits(ctx, x, y, s, o = {}) {
  const t = o.t || 0, n = o.n ?? 60, r = rng((o.seed || 3) * 29), g = o.gravity ?? 900, sp = o.burst ?? 900, kinds = o.kinds || BIT_KINDS;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, v = sp * (0.35 + r() * 0.65), spin = (r() - 0.5) * 14, kind = kinds[(r() * kinds.length) | 0], sz = 0.8 + r() * 0.7, ph = r() * TAU;
    let px, py, rot;
    if (o.loop) { const rad = (120 + r() * 380) * s; px = x + Math.cos(a + t * 0.3) * rad + Math.sin(t * 1.3 + ph) * 20 * s; py = y + Math.sin(a + t * 0.3) * rad * 0.8 + Math.cos(t * 1.1 + ph) * 24 * s; rot = ph + t * spin * 0.2; }
    else { px = x + Math.cos(a) * v * t * s; py = y + (Math.sin(a) * v * t - v * 0.4 * t + 0.5 * g * t * t) * s; rot = ph + t * spin; }
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(s * sz * 1.4, s * sz * 1.4);
    if (kind === 'strip') ribbon(ctx, 40, 7, 8, '#f0843a', 'rgba(110,30,10,0.45)');
    else if (kind === 'mango') ribbon(ctx, 36, 4.5, 10, '#b0d458', 'rgba(70,110,30,0.4)');
    else if (kind === 'jerky') ribbon(ctx, 32, 8, 6, '#7a2616', 'rgba(30,5,0,0.5)');
    else if (kind === 'squid') ribbon(ctx, 34, 5, 12, '#f6d6a6', 'rgba(150,90,40,0.45)');
    else if (kind === 'peanut') peanutHalf(ctx, 0.3);
    else if (kind === 'shallot') shallotRing(ctx, 0.4);
    else if (kind === 'herb') rauRamLeaf(ctx, -20, 0, 0.6, 0);
    else if (kind === 'egg') quailEgg(ctx, 0, 0, 0.3, { peel: 1, half: true });
    else if (kind === 'chili') { ctx.fillStyle = '#e8301a'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd060'; ctx.fillRect(-1, -1, 2, 2); }
    else { ctx.fillStyle = '#ffb07a'; ctx.fillRect(-3, -3, 6, 6); }
    ctx.restore();
  }
  ctx.restore();
}
const confetti = ingredientBits;
// golden sun flare wrapper (lib.flare + soft halo + anamorphic streak). o: {alpha 1, streak true}
function sunFlare(ctx, x, y, s = 1, o = {}) {
  const a = o.alpha ?? 1;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  glow(ctx, x, y, 420 * s, '#ffb45a', 0.35 * a);
  if (o.streak !== false) { const g = ctx.createLinearGradient(x - 700 * s, y, x + 700 * s, y); g.addColorStop(0, 'rgba(255,190,110,0)'); g.addColorStop(0.5, `rgba(255,236,190,${0.55 * a})`); g.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = g; ctx.fillRect(x - 700 * s, y - 5 * s, 1400 * s, 10 * s); }
  ctx.restore();
  flare(ctx, x, y, s, a);
}

module.exports = {
  // helpers + palette
  COL, SKIN_BA, KID_SKINS, rrect, lgr, rgr, canvas, mapper, rimLine, txt, rot2, ikPick, ikPickY, ribbon, layoutBits,
  // environment
  saigonAerial, schoolStreet, STREET, AER, fallingPetals, schoolDrum, motorbikeParent, canopy,
  // cart
  btCart, counterTop, CART, CART_JARS, COUNTER_Y, jar, chiliOilJar, shrimpSaltJar, fillTexture,
  // characters
  cHand, cArm, handRot, nonLa, floral, coBa, coBaFace, schoolKid, kidFace, kidLook, KID_LOOKS, touristShake,
  // food & tools
  riceSheet, riceSheetStack, riceStrips, scissors, plasticBag, bagMouthTop, greenMango, mangoShreds, grater, peeler,
  beefJerky, driedSquidShreds, quailEgg, spoon, pourStream, saltCloud, calamansi, juiceDrops, rauRam, rauRamLeaf,
  peanuts, friedShallots, skewer, plasticFork, traTac, mixBite,
  // fx
  FLAVORS, flavorBurst, shakeLines, whoosh, ingredientBits, confetti, sunFlare,
};
