// pprops.js - Phở bò Hà Nội: props, characters & environment (dawn, winter mist, 5:30 AM).
// Everything is drawn with canvas paths/gradients. Static scenery is cached once in offscreen canvases.
//
// CONVENTIONS: s = scale (1 = native size given below), rot = radians, t = seconds (loop/animation time),
// k-style params are 0..1. "origin" = the point (x,y) refers to. All functions save/restore the context.
//
// ===================================== ENVIRONMENT =====================================
// dawnSky(ctx, k, o?)            k 0 = pre-dawn deep blue, 1 = sunrise (lavender -> orange horizon).
//                                o {y0=0, h=H, x0=0, w=W, t=0 (star twinkle), sunX=W*0.68, stars=true}
// fog(ctx, t, seed, y, h, alpha=0.5, col='#cdd2ea')   drifting mist band covering y..y+h (full width).
// dawnAerial(ctx, t, k, camY=1, o?)  misty old-quarter rooftops from above, lamps, ONE white steam column
//                                from the pho stall. Cached 1080x2600 city; camY 0 = top of plate (sky +
//                                far roofs) -> 1 = bottom (near roofs + stall). Crane down = animate camY 0->1.
//                                o {steam=1 (alpha), lamps=1, fogA=1}. Returns {stallX, stallY} on screen.
// dawnStreet(ctx, t, panX, o?)   narrow Hanoi street at dawn, 3 parallax layers (cached). Layer width
//                                STREET.SW=2080, so panX 0..1000 (layer x = screen x + panX).
//                                o {k=0.25 dawn, stallX=1500 (layer x of pho stall centre), fogA=0.55,
//                                   steam=1, mid(ctx, ox) callback drawn after houses/lamps but before
//                                   fog & foreground branches (translate by ox = -panX to use layer coords)}
//                                Ground (sidewalk top) y = STREET.GY = 1400, road from STREET.ROAD = 1500.
//                                Returns {ox, GY, stallX (screen)}.
// streetLamp(ctx, x, y, s, o?)   cast-iron lamp post, origin = pole base on ground, 540 tall, arm to +x
//                                (o.flip arm to -x). o {on=1, t, pool=true (light pool on ground)}.
//                                lampHead(x,y,s,flip) -> [x,y] of the bulb.
// bicycleRider(ctx, x, y, s, t, o?) old man (pith helmet, army jacket) riding right; origin ground
//                                midway between wheels; ~360 tall, 300 long. o {flip, basket=true, speed=1}
// broomSweeper(ctx, x, y, s, t, o?) street sweeper (conical hat, orange vest, long bamboo broom), faces
//                                left; origin = feet; ~340 tall. o {flip}
//
// ===================================== STALL =====================================
// giantPot(ctx, x, y, s, o?)     dented aluminium stock pot on a honeycomb-coal stove. origin = floor
//                                centre. Stove 0..-120, pot -120..-400 (rim y = y-400s, rim radius 175s).
//                                o {lid: 'on'|'off'| number = lift px, lidTilt, simmer=0.6, bones=true,
//                                   t, steam=1 (alpha mult), stove=true}. Returns {rimX, rimY, R}.
// potTop(ctx, x, y, R, o?)       top-down pot interior (R = outer rim radius). o {clarity=1 (0 murky ->
//                                1 clear amber), skim=0 (foam), bones=true, onion=true, anise=true,
//                                simmer=0.5, t, rim=true, fat=1}
// meatCabinet(ctx, x, y, s, o?)  glass cabinet with hanging beef; origin bottom centre; 320x260. o {t, light=1}
// stallTable(ctx, x, y, s, o?)   low wooden pho table side view, origin floor centre, top at y-h*s.
//                                o {w=300, h=78, condiments=true}
// lowStool(ctx, x, y, s, col='#2f6fd6', h=62)  blue plastic stool, origin floor centre.
//
// ===================================== ÔNG TƯ (cook) =====================================
// ongTu(ctx, x, y, s, o?)        thin elderly cook, beret, grey moustache, brown knit sweater, dark-red
//                                scarf. FACES RIGHT (o.flip faces left). origin = between feet; ~655 tall.
//                                The pot is expected at x+270*s (same s): giantPot(ctx, x+270*s, y, s).
//                                o.pose: 'stand' | 'stir' (t) | 'lid' (k lift) | 'ladle' (k pour tilt) |
//                                  'slurp' (k: bowl at mouth + noodles in, cheeks sucked) | 'laugh' (shake,
//                                  t) | 'drum' (k 0 up -> 1 hits the pot rim) | 'present' (bowl=true)
//                                o {k, t, shake, expr (override face), turn, flip}
//                                Returns {head:[x,y], cup:[x,y] (ladle lip, pose ladle), hit:[x,y] (drum)}.
// ongTuFace(ctx, x, y, s, o?)    close-up head, origin between the eyes, head ~290 wide at s=1, chin y+205,
//                                beret top y-250. o {expr:'smile'|'laugh'|'slurp', k, t, turn (-1..1),
//                                tilt, blink, look [dx,dy], body=true (neck, scarf, sweater to y+620),
//                                noodles=true (slurp)}
//
// ===================================== BOWL & FOOD =====================================
// Bowl options (both views): fill 0..1, noodles 0..1, beef 0..1 (slices placed; alias beefRare),
//   cook 0..1 (pink -> brown-grey), scallion 0..1, onion 0..1, herbs 0..1, fat 0..1, steam alpha (0),
//   t, clarity 1, rot (top view rotation), pepper 0..1
// phoBowl(ctx, x, y, s, o?)      blue-and-white porcelain bowl, 3/4 side; origin = foot bottom centre;
//                                rim radius 200s at y-150s; o.k = rim ellipse ratio (0.36). Returns {rimY, R}.
// phoBowlTop(ctx, x, y, R, o?)   same bowl from above, R = outer rim radius.
// bowlContents(ctx,R,o)          just the broth/noodles/beef/herbs disc at the current origin (radius R),
//                                same options; for custom containers (e.g. inside a ladle or close-up).
// Ingredients (origin = centre unless noted; size at s=1 in brackets):
//   charredOnion(ctx,x,y,s,rot,o{char=1, cut=true}) [130]   gingerKnob(ctx,x,y,s,rot,o{char=1}) [170]
//   starAnise(ctx,x,y,s,rot,o{toast=0}) [80]   cinnamonStick(ctx,x,y,s,rot) [190 long]
//   cardamom(ctx,x,y,s,rot) [black cardamom 80]   clove(ctx,x,y,s,rot) [40]
//   beefBone(ctx,x,y,s,rot,o{view:'side'|'top'}) [side 260 long / top 120]
//   rockSugar(ctx,x,y,s,rot,o{seed}) [90 chunk]
//   fishSauceBottle(ctx,x,y,s,rot,o{level=0.7}) origin bottom centre [300 tall]
//   beefBlock(ctx,x,y,s,rot,o{cut=0}) origin bottom centre [320 wide, 130 tall]; cut 0..1 trims right end
//   beefSlice(ctx,x,y,s,rot,o{cook=0, alpha=1, curl=0, seed}) [150x95, thin, translucent, marbled]
//   noodleSheet(ctx,x,y,s,rot) [220x150]   noodleBundle(ctx,x,y,s,rot,o{seed}) [200]
//   bambooStrainer(ctx,x,y,s,rot,o{noodles=1, t, wet=1}) origin = basket centre, handle to -x [basket 170, total 560]
//   herbPlate(ctx,x,y,s,o{rot, basil, sawtooth, sprouts, lime, chili}) top-down plate R 230
//   basilLeaf(ctx,x,y,s,rot) [70]  sawtooth(ctx,x,y,s,rot) [120]  beanSprout(ctx,x,y,s,rot) [80]
//   limeWedge(ctx,x,y,s,rot,o{squeeze=0, view:'side'|'top'}) [90]  chiliSlice(ctx,x,y,s) [26]
//   quay(ctx,x,y,s,rot) [fried dough pair, 270 long]
//   vinegarGarlicJar(ctx,x,y,s,o) origin bottom centre [130 tall]
//   porcelainSpoon(ctx,x,y,s,rot,o{fill=0}) origin = bowl of spoon, handle to +x [210 long]
//   teaspoon(ctx,x,y,s,rot) origin = bowl, handle to +x [95]
//   chopsticksPair(ctx,x,y,s,rot,spread=0) origin = tips, sticks extend to +x [400]
//   icedTea(ctx,x,y,s,o{level=0.8, t}) origin bottom centre [170 tall]
//   ladle(ctx,x,y,s,rot,o{fill=0, tip=0, len=430}) origin = centre of cup lip; handle goes UP (-y) len
//     when rot=0 (rot rotates the whole ladle). tip = extra cup rotation (radians, + pours toward +x).
//     ladleGrip(x,y,s,rot,o{len,tip}) -> [x,y] handle end (put the hand here).
//     ladlePour(x,y,s,o{tip}) -> [x,y] spout point (start brothStream here).
//   brothStream(ctx,x0,y0,x1,y1,w,t)  pouring broth ribbon (amber, glinting).
// Night time-lapse: moonAndStars(ctx,t,k,o{sky=true, trails=0}) k 0..1 moon arc + night->predawn sky.
//   clockFace(ctx,x,y,R,hours, o{blur=0})   e.g. hours 2.5 = 2:30.
//
// ===================================== EFFECTS =====================================
// richSteam(ctx,t,seed,x,y,w,h,alpha=0.6,o{n=14, col='#fff7ec', drift=0})  thick billowing steam
//   rising from (x,y) (w = base width) up h px. Uses cached puff sprites (cheap).
// slurpVortex(ctx,t,x,y,s,k)     noodle tornado; (x,y) = mouth (top), funnel extends ~620s downward.
// soundRings(ctx,x,y,k,o{n=4, R=420, col='255,240,200', dir=0 (radians), spread=TAU (full)})
// steamFog(ctx,x,y,w,h,a,t=0)    fogged glass in rect (use inside a lens clip).
//   fogGlassesFn(a,t) -> function for people.face({glassesFn}) (fogs both lenses).
// sunglasses(ctx,x,y,s,rot,o{fog=0,t}) tourist's sunglasses alone (for flying off); lenses at ±70s.
//
// ===================================== PEOPLE EXTRAS =====================================
// scarf(ctx,x,y,s,color='#c8423a',o{tail=1, flip, rot=0, sway=0}) generic knit scarf wrap; origin = neck
//                                centre (~68 wide); sway = tail swing in radians (wind / walking).
// touristScarf(ctx,x,y,s,st,color) scarf on people.tourist (same x,y,s,st as the tourist; draw AFTER it).
// faceScarf(ctx,x,y,s,color,o{turn}) scarf on people.face close-up (same x,y,s; draw AFTER the face).
// localEater(ctx,x,y,s,o?)       Hanoian on a low stool with a bowl, faces right (o.flip left).
//                                origin = floor under stool; ~300 tall. o {seed: 0 man+helmet, 1 woman+
//                                conical hat, 2 student (hoodie) (seed%3), k slurp 0..1, t, glance 0..1
//                                (turns head back toward -x, eyebrows up)}
// fancyPinkyHand(ctx,x,y,s,rot,o{skin, spoon:true}) fair hand pinching a tiny teaspoon, pinky raised;
//                                origin = wrist; hand points +x; ~150 long.
// Constants: STREET {GY, ROAD, SW, stallX}, AER {h}, COL palette, TU (Ong Tu clothing colours).
// Helpers: hx(hex)->[r,g,b], mixc(hexA,hexB,f)->rgb string, rgba(hex,a)->rgba string.
// people.js (small addition): face(ctx,x,y,s,{glassesY}) moves the sunglasses: -178 = on the head
//   (default, unchanged), 0 = over the eyes; combine with glassesFn: fogGlassesFn(a,t) for fogged lenses.
// =====================================================================================

const L = require('./lib');
const { W, H, TAU, lerp, clamp, rng, at, glow, ease, createCanvas } = L;
const P = require('./props');
const { seg, ell, ik, shade, metalGrad, cylBody } = P;

// ---------- colour helpers ----------
function hx(c) {
  if (c[0] === '#') { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = c.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
}
function mixc(a, b, t) { const A = hx(a), B = hx(b); t = clamp(t); return `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`; }
function rgba(c, a) { const A = hx(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }
const COL = {
  broth: ['#f4c46a', '#d98f32', '#9a5418'], beefRaw: '#e2687a', beefRawD: '#b8384f', beefCook: '#9c8174', beefCookD: '#6e5248',
  noodle: '#f8f2e4', scallion: '#5fae3e', cobalt: '#1f4c9e', porcelain: '#f7f6f2', sweater: '#7a5236', scarfRed: '#86202a',
  skinTu: ['#e6b48e', '#c48a62', '#94603e'], lamp: '#ffc979',
};

// ---------- cached puff sprites (steam / fog) ----------
const PUFF = {};
function puffs(col) {
  if (PUFF[col]) return PUFF[col];
  const arr = [];
  for (let v = 0; v < 3; v++) {
    const c = createCanvas(256, 256), x = c.getContext('2d'), r = rng(50 + v * 7);
    for (let i = 0; i < 8; i++) {
      const px = 128 + (r() - 0.5) * 100, py = 128 + (r() - 0.5) * 90, rr = 46 + r() * 44;
      const g = x.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(0.55, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    }
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, 256, 256);
    arr.push(c);
  }
  PUFF[col] = arr; return arr;
}

// =====================================================================================
// ENVIRONMENT
// =====================================================================================
const SKY0 = ['#070b26', '#151c48', '#2f2f66', '#5e4a7c'];   // pre-dawn
const SKY1 = ['#25336e', '#6f6ca8', '#d99aa4', '#ffb460'];   // sunrise
function dawnSky(ctx, k, o = {}) {
  const y0 = o.y0 || 0, h = o.h || H, x0 = o.x0 || 0, w = o.w || W;
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  const st = [0, 0.42, 0.78, 1];
  for (let i = 0; i < 4; i++) g.addColorStop(st[i], mixc(SKY0[i], SKY1[i], k));
  ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
  // stars
  if (o.stars !== false && k < 0.7) {
    const r = rng(77), a = 1 - k / 0.7, tt = o.t || 0;
    for (let i = 0; i < 90; i++) {
      const sx = x0 + r() * w, sy = y0 + Math.pow(r(), 1.6) * h * 0.62, sz = 0.8 + r() * 2.2, ph = r() * TAU;
      ctx.globalAlpha = a * (0.45 + 0.55 * Math.sin(tt * 2 + ph)) * (1 - (sy - y0) / (h * 0.7));
      ctx.fillStyle = '#fff6e6'; ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha = 1;
  }
  // sun glow near horizon
  if (k > 0.25) {
    const a = clamp((k - 0.25) / 0.75), sx = o.sunX === undefined ? x0 + w * 0.68 : o.sunX;
    glow(ctx, sx, y0 + h, h * 0.9, 'rgba(255,150,80,0.55)', a);
    glow(ctx, sx, y0 + h, h * 0.35, 'rgba(255,215,150,0.8)', a * a);
  }
  ctx.restore();
}

function fog(ctx, t, seed, y, h, alpha = 0.5, col = '#cdd2ea') {
  if (alpha <= 0.01) return;
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, alpha * 0.55)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
  const sp = puffs(col), r = rng(seed), span = W * 1.8;
  for (let i = 0; i < 9; i++) {
    const ph = r(), v = 8 + r() * 22, ww = W * (0.45 + r() * 0.5), hh = h * (0.5 + r() * 0.6);
    const xx = ((ph * span + t * v) % span) - W * 0.45, yy = y + h * (0.2 + r() * 0.6) + Math.sin(t * 0.3 + i) * 10;
    ctx.globalAlpha = alpha * (0.55 + 0.45 * r());
    ctx.drawImage(sp[i % 3], xx - ww / 2, yy - hh / 2, ww, hh);
  }
  ctx.restore();
}

// ---------- dawn aerial ----------
const AER = { h: 2600, horizon: 720 };
let AER_C = null, AER_LAMPS = [], AER_STALL = null;
function buildAerial() {
  const c = createCanvas(W, AER.h), x = c.getContext('2d'), r = rng(901);
  AER_LAMPS = [];
  x.fillStyle = '#5d6596'; x.fillRect(0, AER.horizon - 10, W, AER.h);
  const rows = 26;
  for (let j = 0; j < rows; j++) {
    const d = j / (rows - 1), yb = AER.horizon + 30 + Math.pow(d, 1.45) * 1980, sc = 0.16 + d * 1.35;
    const haze = 1 - d;
    let bx = -60 - r() * 80 * sc;
    while (bx < W + 60) {
      const w = (80 + r() * 110) * sc, fh = (70 + r() * 120) * sc, rh = (50 + r() * 50) * sc;
      const gap = r() < 0.12 ? (20 + r() * 40) * sc : 2 * sc;
      // facade
      const wallBase = ['#c9a25e', '#b48e5a', '#a7ad8a', '#c6b69a', '#b5785c'][(r() * 5) | 0];
      const wall = mixc(mixc(wallBase, '#4b4f7a', 0.55), '#8d95c4', haze * 0.75);
      x.fillStyle = wall; x.fillRect(bx, yb - fh, w, fh);
      x.fillStyle = 'rgba(10,12,40,0.25)'; x.fillRect(bx + w * 0.82, yb - fh, w * 0.18, fh);
      // windows
      const nw = Math.max(1, Math.round(w / (34 * sc))), nf = Math.max(1, Math.round(fh / (46 * sc)));
      for (let a = 0; a < nw; a++) for (let b = 0; b < nf; b++) {
        const wx = bx + (a + 0.25) * (w / nw), wy = yb - fh + (b + 0.3) * (fh / nf), ww = w / nw * 0.5, wh = fh / nf * 0.45;
        const lit = d > 0.25 && r() < 0.13;
        x.fillStyle = lit ? mixc('#ffcf7e', '#9ea6d0', haze * 0.6) : mixc('#262a4a', '#7880b0', haze * 0.8);
        x.fillRect(wx, wy, ww, wh);
      }
      // roof (seen from above: big tiled plane)
      const roofCol = mixc(mixc(['#7a3a2c', '#6a3226', '#5a3b33', '#4d4f5e'][(r() * 4) | 0], '#3a3358', 0.35), '#8a90bd', haze * 0.8);
      const sk = (r() - 0.5) * 16 * sc;
      x.fillStyle = roofCol;
      x.beginPath(); x.moveTo(bx - 3 * sc, yb - fh); x.lineTo(bx + w + 3 * sc, yb - fh); x.lineTo(bx + w - 6 * sc + sk, yb - fh - rh); x.lineTo(bx + 6 * sc + sk, yb - fh - rh); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(0,0,20,0.22)'; x.lineWidth = Math.max(1, 1.4 * sc);
      for (let q = 1; q < 6; q++) { const yy = yb - fh - rh * q / 6; x.beginPath(); x.moveTo(bx + 3 * sc, yy); x.lineTo(bx + w - 3 * sc, yy); x.stroke(); }
      x.fillStyle = 'rgba(255,220,200,0.12)'; x.fillRect(bx, yb - fh - 2 * sc, w, 3 * sc);
      // water tank / antenna
      if (r() < 0.25) { x.fillStyle = mixc('#c9ccd6', '#9aa0c8', haze); x.fillRect(bx + w * 0.3, yb - fh - rh - 22 * sc, 26 * sc, 22 * sc); }
      if (r() < 0.2) { x.strokeStyle = 'rgba(20,20,40,0.5)'; x.beginPath(); x.moveTo(bx + w * 0.7, yb - fh - rh); x.lineTo(bx + w * 0.7, yb - fh - rh - 50 * sc); x.moveTo(bx + w * 0.6, yb - fh - rh - 40 * sc); x.lineTo(bx + w * 0.8, yb - fh - rh - 40 * sc); x.stroke(); }
      if (gap > 10 * sc && d > 0.3) AER_LAMPS.push([bx + w + gap / 2, yb - 8 * sc, sc]);
      bx += w + gap;
    }
    // static haze band between rows
    if (j % 3 === 2) { const fg = x.createLinearGradient(0, yb - 120 * sc, 0, yb + 40 * sc); fg.addColorStop(0, 'rgba(195,200,232,0)'); fg.addColorStop(0.6, `rgba(195,200,232,${0.4 * haze + 0.05})`); fg.addColorStop(1, 'rgba(195,200,232,0)'); x.fillStyle = fg; x.fillRect(0, yb - 120 * sc, W, 160 * sc); }
    // pho stall on a near row
    if (j === 21) {
      const sx = 640, sy = yb + 6 * sc;
      x.fillStyle = '#2a1f2a'; x.fillRect(sx - 90 * sc, sy - 10 * sc, 180 * sc, 30 * sc);
      x.fillStyle = '#e88a3a'; x.beginPath(); x.moveTo(sx - 110 * sc, sy - 12 * sc); x.lineTo(sx + 110 * sc, sy - 12 * sc); x.lineTo(sx + 90 * sc, sy - 46 * sc); x.lineTo(sx - 90 * sc, sy - 46 * sc); x.closePath(); x.fill();
      x.fillStyle = '#ffd38a'; x.fillRect(sx - 80 * sc, sy - 10 * sc, 160 * sc, 14 * sc);
      AER_STALL = [sx, sy - 20 * sc, sc];
    }
  }
  AER_C = c;
}
function dawnAerial(ctx, t, k, camY = 1, o = {}) {
  if (!AER_C) buildAerial();
  const oy = -clamp(camY) * (AER.h - H);
  ctx.save();
  dawnSky(ctx, k, { y0: oy - 200, h: AER.horizon + 240, t });
  ctx.drawImage(AER_C, 0, oy);
  // lamps
  const la = (o.lamps === undefined ? 1 : o.lamps) * (1 - k * 0.6);
  for (const [lx, ly, sc] of AER_LAMPS) {
    const yy = ly + oy; if (yy < -100 || yy > H + 100) continue;
    glow(ctx, lx, yy, 70 * sc, 'rgba(255,190,110,0.9)', la);
    glow(ctx, lx, yy, 14 * sc, 'rgba(255,240,200,1)', la);
  }
  // live fog
  const fa = o.fogA === undefined ? 1 : o.fogA;
  fog(ctx, t, 31, oy + AER.horizon - 80, 260, 0.55 * fa, '#c3c8e6');
  fog(ctx, t * 1.3, 32, oy + AER.horizon + 500, 420, 0.4 * fa, '#c3c8e6');
  fog(ctx, t * 0.8, 33, oy + AER.horizon + 1200, 520, 0.3 * fa, '#c8cce6');
  // stall glow + steam column
  const [sx, sy, sc] = AER_STALL, syy = sy + oy;
  glow(ctx, sx, syy, 220 * sc, 'rgba(255,170,80,0.8)', 0.8);
  const sa = o.steam === undefined ? 1 : o.steam;
  if (sa > 0) richSteam(ctx, t, 404, sx, syy - 20 * sc, 120 * sc, 1300, 0.75 * sa, { n: 22, drift: 0.12 });
  // warm sunrise wash
  if (k > 0.3) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = (k - 0.3) * 0.5; ctx.fillStyle = '#ff9a50'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  return { stallX: sx, stallY: syy };
}

// ---------- street lamp ----------
function lampHead(x, y, s, flip = false) { return [x + (flip ? -96 : 96) * s, y - 512 * s]; }
function streetLamp(ctx, x, y, s, o = {}) {
  const on = o.on === undefined ? 1 : o.on, f = o.flip ? -1 : 1;
  at(ctx, x, y, 0, s * f, s, () => {
    ctx.fillStyle = '#1c1d2a';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(10, -40); ctx.lineTo(7, -520); ctx.lineTo(-7, -520); ctx.lineTo(-10, -40); ctx.closePath(); ctx.fill();
    ctx.fillRect(-20, -46, 40, 12); ctx.fillRect(-12, -300, 24, 8);
    ctx.strokeStyle = '#1c1d2a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -500); ctx.quadraticCurveTo(10, -560, 70, -545); ctx.lineTo(96, -532); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(22, -515, 16, Math.PI, Math.PI * 1.8); ctx.stroke();
    // lamp hood
    ctx.fillStyle = '#23242f'; ctx.beginPath(); ctx.moveTo(72, -536); ctx.lineTo(120, -536); ctx.lineTo(108, -514); ctx.lineTo(84, -514); ctx.closePath(); ctx.fill();
    ctx.fillStyle = on > 0.05 ? mixc('#6b6050', '#fff1c8', on) : '#6b6050';
    ell(ctx, 96, -512, 13, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -500); ctx.lineTo(-3, -60); ctx.stroke();
  });
  if (on > 0.02) {
    const [hx_, hy] = lampHead(x, y, s, o.flip), tt = o.t || 0, fl = 0.94 + 0.06 * Math.sin(tt * 13 + x);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    // cone
    const cg = ctx.createLinearGradient(0, hy, 0, y);
    cg.addColorStop(0, `rgba(255,200,120,${0.32 * on * fl})`); cg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(hx_ - 14 * s, hy); ctx.lineTo(hx_ + 14 * s, hy); ctx.lineTo(hx_ + 230 * s, y); ctx.lineTo(hx_ - 230 * s, y); ctx.closePath(); ctx.fill();
    ctx.restore();
    glow(ctx, hx_, hy, 190 * s, 'rgba(255,185,100,0.75)', on * fl);
    glow(ctx, hx_, hy + 4 * s, 40 * s, 'rgba(255,245,215,1)', on);
    if (o.pool !== false) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.55 * on * fl;
      ctx.translate(hx_, y); ctx.scale(1, 0.22);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, 260 * s); pg.addColorStop(0, 'rgba(255,190,110,0.9)'); pg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = pg; ctx.fillRect(-260 * s, -260 * s, 520 * s, 520 * s); ctx.restore();
    }
  }
}

// ---------- dawn street (cached parallax layers) ----------
const STREET = { GY: 1400, ROAD: 1500, SW: 2080, stallX: 1500 };
const ST_CACHE = {};
function branch(x, px, py, ang, len, w, depth, r, leaves) {
  const ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
  x.strokeStyle = '#17162a'; x.lineWidth = w; x.lineCap = 'round';
  x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo((px + ex) / 2 + (r() - 0.5) * len * 0.3, (py + ey) / 2 + (r() - 0.5) * len * 0.3, ex, ey); x.stroke();
  if (depth <= 0 || w < 1.2) {
    if (leaves && r() < 0.35) { x.fillStyle = ['#a8322a', '#c4532c', '#8a2a2a'][(r() * 3) | 0]; x.beginPath(); x.ellipse(ex, ey + 6, 7, 11, r() * 3, 0, TAU); x.fill(); }
    return;
  }
  const n = 2 + (r() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) branch(x, ex, ey, ang + (r() - 0.5) * 1.3, len * (0.62 + r() * 0.2), w * 0.62, depth - 1, r, leaves);
}
function tubeHouse(x, x0, w, top, r, isStall) {
  const GY = STREET.GY;
  const wallBase = ['#d6ad5c', '#c99a55', '#b9b98e', '#d8c7a6', '#c98a62', '#cfb06a'][(r() * 6) | 0];
  // wall
  x.fillStyle = wallBase; x.fillRect(x0, top, w, GY - top);
  // grime gradient
  const gg = x.createLinearGradient(0, top, 0, GY); gg.addColorStop(0, 'rgba(60,40,30,0.1)'); gg.addColorStop(0.6, 'rgba(60,40,30,0)'); gg.addColorStop(1, 'rgba(40,30,25,0.35)');
  x.fillStyle = gg; x.fillRect(x0, top, w, GY - top);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(x0 + w - 8, top, 8, GY - top);
  x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(x0, top, 5, GY - top);
  // roof
  if (r() < 0.55) {
    x.fillStyle = ['#7c3b2a', '#6e3424', '#8a4a30'][(r() * 3) | 0];
    x.beginPath(); x.moveTo(x0 - 10, top + 6); x.lineTo(x0 + w + 10, top + 6); x.lineTo(x0 + w - 24, top - 60); x.lineTo(x0 + 24, top - 60); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
    for (let i = 1; i < 6; i++) { const yy = top + 6 - i * 11; x.beginPath(); x.moveTo(x0 - 4 + i * 5, yy); x.lineTo(x0 + w + 4 - i * 5, yy); x.stroke(); }
  } else {
    x.fillStyle = shade(wallBase, -0.15); x.fillRect(x0 - 4, top - 18, w + 8, 20);
    if (r() < 0.7) { x.fillStyle = '#b9bcc4'; x.beginPath(); x.roundRect(x0 + w * 0.25, top - 74, 64, 56, 8); x.fill(); x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(x0 + w * 0.25 + 44, top - 74, 20, 56); }
    x.strokeStyle = '#2a2a33'; x.lineWidth = 3; x.beginPath(); x.moveTo(x0 + w * 0.75, top - 18); x.lineTo(x0 + w * 0.75, top - 110); x.moveTo(x0 + w * 0.65, top - 90); x.lineTo(x0 + w * 0.88, top - 90); x.moveTo(x0 + w * 0.68, top - 70); x.lineTo(x0 + w * 0.84, top - 70); x.stroke();
  }
  // upper floors
  const lit = [];
  for (let fy = GY - 420; fy > top + 30; fy -= 215) {
    const kind = r();
    const wx = x0 + w * 0.18, ww = w * 0.64, wh = 130, wy = fy - 10;
    if (kind < 0.45) {
      // shuttered window (green louvres)
      x.fillStyle = '#2b2a35'; x.fillRect(wx, wy, ww, wh);
      const isLit = r() < 0.3;
      if (isLit) lit.push([wx + ww * 0.25, wy + 10, ww * 0.5, wh - 20]);
      const open = isLit ? 0.5 : 0;
      x.fillStyle = '#3f7a5a';
      x.fillRect(wx, wy, ww * (0.5 - open * 0.5), wh); x.fillRect(wx + ww * (0.5 + open * 0.5), wy, ww * (0.5 - open * 0.5), wh);
      x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2;
      for (let yy = wy + 8; yy < wy + wh; yy += 9) { x.beginPath(); x.moveTo(wx, yy); x.lineTo(wx + ww * (0.5 - open * 0.5), yy); x.moveTo(wx + ww * (0.5 + open * 0.5), yy); x.lineTo(wx + ww, yy); x.stroke(); }
      x.fillStyle = shade(wallBase, -0.2); x.fillRect(wx - 10, wy + wh, ww + 20, 10);
    } else {
      // balcony with railing + plants
      x.fillStyle = '#2b2a35'; x.fillRect(wx, wy - 10, ww, wh + 30);
      const isLit = r() < 0.35;
      if (isLit) lit.push([wx + 8, wy, ww - 16, wh + 10]);
      x.fillStyle = shade(wallBase, -0.25); x.fillRect(x0 + 4, fy + 120, w - 8, 14);
      x.strokeStyle = '#1e1e26'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(x0 + 6, fy + 62); x.lineTo(x0 + w - 6, fy + 62); x.stroke();
      for (let bx = x0 + 12; bx < x0 + w - 6; bx += 14) { x.beginPath(); x.moveTo(bx, fy + 62); x.lineTo(bx, fy + 120); x.stroke(); }
      if (r() < 0.7) for (let p = 0; p < 3; p++) { const px = x0 + 20 + r() * (w - 40); x.fillStyle = '#8a4a30'; x.fillRect(px - 9, fy + 98, 18, 22); x.fillStyle = ['#3e6e3a', '#2f5a33', '#557a3a'][p % 3]; x.beginPath(); x.ellipse(px, fy + 86, 16, 18, 0, 0, TAU); x.fill(); }
      if (r() < 0.3) { x.fillStyle = '#d8d8d2'; x.fillRect(x0 + w - 70, fy + 20, 54, 36); x.strokeStyle = '#999'; x.lineWidth = 2; x.beginPath(); x.arc(x0 + w - 43, fy + 38, 12, 0, TAU); x.stroke(); }
    }
  }
  // ground floor: rolling shutter (or open stall front, drawn later)
  if (!isStall) {
    const sx = x0 + 10, sw = w - 20, sy = GY - 205;
    x.fillStyle = shade(wallBase, -0.3); x.fillRect(x0, sy - 30, w, 26);
    if (r() < 0.6) { x.fillStyle = ['#b8322c', '#2f5aa0', '#2f7a4a', '#d9a030'][(r() * 4) | 0]; x.fillRect(x0 + 6, sy - 76, w - 12, 44); x.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 4; i++) x.fillRect(x0 + 18 + i * (w - 36) / 4, sy - 62, (w - 36) / 4 - 10, 14); }
    const sg = x.createLinearGradient(0, sy, 0, GY); sg.addColorStop(0, '#9aa3ad'); sg.addColorStop(1, '#6f7680');
    x.fillStyle = sg; x.fillRect(sx, sy, sw, GY - sy);
    x.strokeStyle = 'rgba(30,35,45,0.45)'; x.lineWidth = 2;
    for (let yy = sy + 6; yy < GY; yy += 9) { x.beginPath(); x.moveTo(sx, yy); x.lineTo(sx + sw, yy); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,0.18)'; for (let yy = sy + 9; yy < GY; yy += 9) x.fillRect(sx, yy, sw, 2);
    x.fillStyle = '#4a4f58'; x.fillRect(sx, GY - 14, sw, 14); x.fillStyle = '#c9a23a'; x.fillRect(sx + sw / 2 - 6, GY - 26, 12, 14);
  }
  return lit;
}
function buildStreet(stallX) {
  const SW = STREET.SW, GY = STREET.GY, r = rng(1234);
  const far = createCanvas(SW, H), fx = far.getContext('2d');
  // far skyline silhouettes (bluish, hazy)
  for (let row = 0; row < 2; row++) {
    let bx = -20;
    while (bx < SW) {
      const w = 90 + r() * 140, top = 380 + row * 120 + r() * 160;
      fx.fillStyle = row ? '#4c517e' : '#636a98'; fx.fillRect(bx, top, w + 2, H - top);
      if (r() < 0.5) { fx.beginPath(); fx.moveTo(bx - 6, top + 2); fx.lineTo(bx + w + 6, top + 2); fx.lineTo(bx + w - 20, top - 36); fx.lineTo(bx + 20, top - 36); fx.closePath(); fx.fill(); }
      fx.fillStyle = row ? 'rgba(255,200,130,0.55)' : 'rgba(255,200,130,0.35)';
      for (let i = 0; i < 4; i++) if (r() < 0.35) fx.fillRect(bx + 14 + r() * (w - 30), top + 30 + r() * 300, 12, 16);
      bx += w;
    }
  }
  const main = createCanvas(SW, H), x = main.getContext('2d');
  // houses
  let bx = -30; const lits = [];
  const houses = [];
  while (bx < SW + 30) {
    let w = 170 + r() * 90;
    const isStall = stallX > bx && stallX < bx + w;
    if (isStall) { w = Math.max(w, 300); bx = stallX - w / 2; }
    const top = 300 + r() * 260;
    houses.push([bx, w, top, isStall]);
    bx += w;
  }
  for (const [hx0, w, top, isStall] of houses) lits.push(...tubeHouse(x, hx0, w, top, r, isStall));
  // dawn tint (blue multiply)
  x.save(); x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = 0.62; x.fillStyle = '#28305e'; x.fillRect(0, 0, SW, H);
  const tg = x.createLinearGradient(0, 200, 0, GY); tg.addColorStop(0, 'rgba(150,140,200,0.25)'); tg.addColorStop(1, 'rgba(20,20,50,0.35)');
  x.globalAlpha = 1; x.fillStyle = tg; x.fillRect(0, 0, SW, H);
  x.restore();
  // lit windows (warm)
  for (const [lx, ly, lw, lh] of lits) {
    const g = x.createLinearGradient(0, ly, 0, ly + lh); g.addColorStop(0, '#ffcf80'); g.addColorStop(1, '#e88a3c');
    x.fillStyle = g; x.fillRect(lx, ly, lw, lh);
    x.fillStyle = 'rgba(60,30,20,0.5)'; x.fillRect(lx + lw * 0.1, ly + lh * 0.55, lw * 0.3, lh * 0.45);
  }
  // sidewalk + road
  const sg = x.createLinearGradient(0, GY, 0, STREET.ROAD); sg.addColorStop(0, '#4a4a64'); sg.addColorStop(1, '#3a3a52');
  x.fillStyle = sg; x.fillRect(0, GY, SW, STREET.ROAD - GY);
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
  for (let i = 0; i < SW; i += 60) { x.beginPath(); x.moveTo(i, GY); x.lineTo(i - 30, STREET.ROAD); x.stroke(); }
  x.beginPath(); x.moveTo(0, GY + 50); x.lineTo(SW, GY + 50); x.stroke();
  x.fillStyle = '#6a6a82'; x.fillRect(0, STREET.ROAD - 12, SW, 14);
  const rg = x.createLinearGradient(0, STREET.ROAD, 0, H); rg.addColorStop(0, '#26283c'); rg.addColorStop(1, '#14151f');
  x.fillStyle = rg; x.fillRect(0, STREET.ROAD, SW, H - STREET.ROAD);
  x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 400; i++) x.fillRect(r() * SW, STREET.ROAD + r() * (H - STREET.ROAD), 3, 2);
  x.fillStyle = 'rgba(220,220,200,0.35)'; for (let i = 0; i < SW; i += 220) x.fillRect(i, 1760, 120, 10);
  // bare bàng tree on the sidewalk
  const tx0 = 430;
  x.fillStyle = '#1a1828'; x.beginPath(); x.moveTo(tx0 - 26, GY + 40); x.quadraticCurveTo(tx0 - 10, 1000, tx0 - 30, 700); x.lineTo(tx0 + 4, 700); x.quadraticCurveTo(tx0 + 20, 1000, tx0 + 26, GY + 40); x.closePath(); x.fill();
  const br = rng(55);
  branch(x, tx0 - 12, 720, -2.2, 190, 22, 5, br, true); branch(x, tx0 - 10, 730, -1.0, 210, 22, 5, br, true); branch(x, tx0 - 14, 800, -2.8, 160, 16, 4, br, true);
  // wires
  require('./world').wires(x, 0, 520, SW, 470, 6, 77, 70, '#141322');
  // fg layer: overhanging branches top
  const fg = createCanvas(SW + 400, H), gx = fg.getContext('2d');
  const fr = rng(66);
  branch(gx, -20, 60, 0.15, 340, 34, 6, fr, true); branch(gx, SW + 380, 20, Math.PI - 0.2, 360, 36, 6, fr, true); branch(gx, 1100, -40, 1.9, 260, 26, 5, fr, true);
  ST_CACHE[stallX] = { far, main, fg };
  return ST_CACHE[stallX];
}
// stall front, drawn live (warm glow)
function stallFront(ctx, sx, t) {
  const GY = STREET.GY;
  ctx.save();
  // interior
  const ig = ctx.createLinearGradient(0, GY - 220, 0, GY);
  ig.addColorStop(0, '#ffb35c'); ig.addColorStop(1, '#c4642a');
  ctx.fillStyle = ig; ctx.fillRect(sx - 140, GY - 215, 280, 215);
  ctx.fillStyle = 'rgba(80,30,10,0.55)'; ctx.fillRect(sx - 140, GY - 215, 280, 30);
  // back shelves
  ctx.fillStyle = 'rgba(90,40,15,0.6)'; ctx.fillRect(sx - 120, GY - 170, 240, 6); ctx.fillRect(sx - 120, GY - 130, 240, 6);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#f3efe6' : '#e9e4d8'; ell(ctx, sx - 100 + i * 28, GY - 180, 11, 7); ctx.fill(); }
  // sign
  ctx.fillStyle = '#9c1f22'; ctx.beginPath(); ctx.roundRect(sx - 150, GY - 300, 300, 74, 6); ctx.fill();
  ctx.strokeStyle = '#e9b44c'; ctx.lineWidth = 4; ctx.strokeRect(sx - 142, GY - 292, 284, 58);
  ctx.fillStyle = '#ffe2a0'; ctx.font = '46px TitleSerif'; ctx.textAlign = 'center'; ctx.fillText('PHỞ BÒ', sx, GY - 246);
  ctx.restore();
  glow(ctx, sx, GY - 262, 190, 'rgba(255,90,60,0.35)', 0.8);
  // counter + pot
  giantPot(ctx, sx - 60, GY, 0.42, { lid: 'off', simmer: 0.8, t, steam: 0 });
  ctx.save();
  ctx.fillStyle = '#5a3420'; ctx.fillRect(sx + 10, GY - 92, 120, 92); ctx.fillStyle = '#7b4a2a'; ctx.fillRect(sx + 4, GY - 98, 132, 10);
  ctx.restore();
  meatCabinet(ctx, sx + 70, GY - 98, 0.3, { t });
  lowStool(ctx, sx - 210, GY + 40, 0.75); lowStool(ctx, sx + 200, GY + 50, 0.75, '#3b7be0');
  stallTable(ctx, sx + 30, GY + 70, 0.55, { condiments: false });
  // light spill
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  ctx.translate(sx, GY + 30); ctx.scale(1, 0.3);
  const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, 420); pg.addColorStop(0, 'rgba(255,170,90,0.7)'); pg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = pg; ctx.fillRect(-420, -420, 840, 840); ctx.restore();
  glow(ctx, sx, GY - 110, 330, 'rgba(255,160,80,0.5)', 0.9 + 0.1 * Math.sin(t * 9));
}
function dawnStreet(ctx, t, panX = 0, o = {}) {
  const stallX = o.stallX === undefined ? STREET.stallX : o.stallX, k = o.k === undefined ? 0.25 : o.k;
  const C = ST_CACHE[stallX] || buildStreet(stallX);
  ctx.save();
  dawnSky(ctx, k, { h: 900, t });
  ctx.drawImage(C.far, -panX * 0.35, 0);
  fog(ctx, t, 21, 520, 380, 0.5 * (o.fogA === undefined ? 0.55 : o.fogA) / 0.55, '#a9aed6');
  ctx.drawImage(C.main, -panX, 0);
  const ox = -panX;
  // lamps
  for (const lx of [150, 820, 1900]) streetLamp(ctx, lx + ox, STREET.GY + 30, 1, { t, on: 1 - k * 0.5 });
  stallFront(ctx, stallX + ox, t);
  if ((o.steam === undefined ? 1 : o.steam) > 0) richSteam(ctx, t, 515, stallX + ox - 60, STREET.GY - 180, 110, 900, 0.65 * (o.steam === undefined ? 1 : o.steam), { n: 16, drift: -0.05 });
  if (o.mid) o.mid(ctx, ox);
  const fa = o.fogA === undefined ? 0.55 : o.fogA;
  fog(ctx, t * 1.2, 22, 1150, 380, fa, '#b8bde0');
  fog(ctx, t * 0.7, 23, 1450, 300, fa * 0.6, '#b8bde0');
  ctx.drawImage(C.fg, -panX * 1.35 - 120, 0);
  if (k > 0.3) { ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = (k - 0.3) * 0.45; ctx.fillStyle = '#ff9a50'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  return { ox, GY: STREET.GY, stallX: stallX + ox };
}

// ---------- bicycle rider ----------
function wheel(ctx, x, y, R, a) {
  ctx.strokeStyle = '#151520'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#8d93a3'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, R - 6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(190,195,210,0.75)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 12; i++) { const b = a + i * TAU / 12; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * (R - 6), y + Math.sin(b) * (R - 6)); ctx.stroke(); }
  ctx.fillStyle = '#555'; ell(ctx, x, y, 6, 6); ctx.fill();
}
function bicycleRider(ctx, x, y, s, t, o = {}) {
  const sp = o.speed === undefined ? 1 : o.speed, ca = t * 5 * sp;
  at(ctx, x, y, 0, s * (o.flip ? -1 : 1), s, () => {
    const R = 72, rw = [-120, -R], fw = [120, -R], crank = [0, -R + 6], seat = [-48, -220], bar = [92, -236];
    // far pedal leg
    const pf = [crank[0] + Math.cos(ca + Math.PI) * 26, crank[1] + Math.sin(ca + Math.PI) * 26];
    const hip = [-44, -238];
    const knF = ik(hip[0], hip[1], pf[0], pf[1], 104, 100, 1);
    seg(ctx, hip[0], hip[1], knF[0], knF[1], 30, 24, '#3b4a32'); seg(ctx, knF[0], knF[1], pf[0], pf[1], 22, 18, '#3b4a32');
    wheel(ctx, rw[0], rw[1], R, ca * 0.6); wheel(ctx, fw[0], fw[1], R, ca * 0.6);
    // frame
    ctx.strokeStyle = '#1f3a5a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(rw[0], rw[1]); ctx.lineTo(crank[0], crank[1]); ctx.lineTo(seat[0] + 4, seat[1] + 20); ctx.lineTo(rw[0], rw[1]);
    ctx.moveTo(crank[0], crank[1]); ctx.lineTo(bar[0] - 8, bar[1] + 34); ctx.lineTo(seat[0] + 4, seat[1] + 24);
    ctx.moveTo(bar[0] - 8, bar[1] + 34); ctx.lineTo(fw[0], fw[1]); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bar[0] - 8, bar[1] + 34); ctx.lineTo(bar[0], bar[1]); ctx.lineTo(bar[0] - 26, bar[1] - 4); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.roundRect(seat[0] - 22, seat[1] + 6, 44, 10, 5); ctx.fill();
    // mudguard + basket
    ctx.strokeStyle = '#2a4466'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(fw[0], fw[1], R + 8, -2.6, -0.6); ctx.stroke();
    if (o.basket !== false) {
      ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.moveTo(110, -190); ctx.lineTo(176, -190); ctx.lineTo(168, -150); ctx.lineTo(116, -150); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,20,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(114 + i * 18, -190); ctx.lineTo(118 + i * 16, -150); ctx.stroke(); }
      ctx.fillStyle = '#e9e1c9'; ell(ctx, 132, -196, 16, 9); ctx.fill(); ctx.fillStyle = '#3f7a3a'; ell(ctx, 154, -200, 14, 10); ctx.fill();
    }
    ctx.fillStyle = '#1b1b1b'; ell(ctx, crank[0], crank[1], 12, 12); ctx.fill();
    // near leg
    const pn = [crank[0] + Math.cos(ca) * 26, crank[1] + Math.sin(ca) * 26];
    const knN = ik(hip[0], hip[1], pn[0], pn[1], 104, 100, 1);
    seg(ctx, hip[0], hip[1], knN[0], knN[1], 32, 26, '#4a5a3c'); seg(ctx, knN[0], knN[1], pn[0], pn[1], 24, 20, '#4a5a3c');
    ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.roundRect(pn[0] - 16, pn[1] - 6, 34, 12, 5); ctx.fill();
    // torso (army jacket), leaning forward
    const sh = [-6, -380];
    seg(ctx, hip[0], hip[1] + 6, sh[0], sh[1], 64, 58, '#566a44');
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-30, -330, 8, 70);
    // arm to bar
    const hd = [bar[0] - 22, bar[1] - 2], el = ik(sh[0], sh[1] + 10, hd[0], hd[1], 70, 70, 1);
    seg(ctx, sh[0], sh[1] + 10, el[0], el[1], 26, 22, '#5e7449'); seg(ctx, el[0], el[1], hd[0], hd[1], 22, 18, '#5e7449');
    ctx.fillStyle = '#c48a62'; ell(ctx, hd[0], hd[1], 11, 10); ctx.fill();
    // head + pith helmet
    const hx0 = 12, hy0 = -420;
    ctx.fillStyle = '#c48a62'; ctx.fillRect(hx0 - 12, hy0 + 14, 18, 18);
    ell(ctx, hx0, hy0, 24, 27); ctx.fillStyle = '#d29a70'; ctx.fill();
    ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.moveTo(hx0 + 18, hy0 + 14); ctx.quadraticCurveTo(hx0 + 26, hy0 + 18, hx0 + 18, hy0 + 22); ctx.fill(); // moustache
    ctx.fillStyle = '#e8e2d6'; ctx.beginPath(); ctx.ellipse(hx0 + 22, hy0 + 18, 9, 4, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a2420'; ell(ctx, hx0 + 12, hy0 - 2, 3, 3); ctx.fill();
    // pith helmet
    ctx.fillStyle = '#5f7347'; ctx.beginPath(); ctx.ellipse(hx0 - 2, hy0 - 12, 40, 9, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx0 - 2, hy0 - 16, 28, 26, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(hx0 - 10, hy0 - 30, 10, 6, -0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d9b44a'; ell(ctx, hx0 + 12, hy0 - 26, 5, 5); ctx.fill();
  });
}

// ---------- broom sweeper ----------
function broomSweeper(ctx, x, y, s, t, o = {}) {
  const sw = Math.sin(t * 3.2);
  at(ctx, x, y, 0, s * (o.flip ? -1 : 1), s, () => {
    const hip = [10, -170], sh = [-14, -300];
    // legs
    seg(ctx, hip[0], hip[1], -20, -86, 32, 28, '#2c3550'); seg(ctx, -20, -86, -26, -6, 26, 22, '#2c3550');
    seg(ctx, hip[0] + 6, hip[1], 30, -86, 32, 28, '#36405e'); seg(ctx, 30, -86, 40, -6, 26, 22, '#36405e');
    ctx.fillStyle = '#1e1a18'; ctx.fillRect(-48, -12, 34, 12); ctx.fillRect(18, -12, 34, 12);
    // broom (long bamboo handle + fan of twigs)
    const bx = -150 + sw * 70, by = -6, gx = -50, gy = -230;
    ctx.strokeStyle = '#c9a35e'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(gx + 30, gy - 40); ctx.lineTo(bx + 16, by - 40); ctx.stroke();
    ctx.strokeStyle = '#a5824a'; ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) { const a = -0.7 + i / 15 * 1.0; ctx.beginPath(); ctx.moveTo(bx + 16, by - 40); ctx.lineTo(bx + 16 + Math.cos(Math.PI - a) * 70, by - 40 + Math.sin(Math.PI - a) * 50 * 0.8 + 6); ctx.stroke(); }
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(bx + 8, by - 50, 18, 14);
    // dust puffs
    ctx.fillStyle = 'rgba(200,200,220,0.25)'; for (let i = 0; i < 4; i++) { ell(ctx, bx - 40 - i * 18 + sw * 10, -8 - i * 4, 14 + i * 4, 6 + i * 2); ctx.fill(); }
    // torso: jacket + orange vest
    seg(ctx, hip[0], hip[1], sh[0], sh[1], 74, 66, '#2f4a6a');
    ctx.fillStyle = '#ff7a1a'; ctx.beginPath(); ctx.roundRect(-44, -316, 72, 120, 18); ctx.fill();
    ctx.fillStyle = '#e8f05a'; ctx.fillRect(-44, -262, 72, 9); ctx.fillRect(-44, -234, 72, 9);
    // arms to broom handle
    const h1 = [gx + 6, gy], h2 = [lerp(gx, bx, 0.28) + 10, lerp(gy - 40, by - 40, 0.28)];
    for (const hd of [h2, h1]) { const el = ik(sh[0], sh[1] + 10, hd[0], hd[1], 70, 66, -1); seg(ctx, sh[0], sh[1] + 10, el[0], el[1], 24, 20, '#2f4a6a'); seg(ctx, el[0], el[1], hd[0], hd[1], 20, 16, '#2f4a6a'); ctx.fillStyle = '#b97a52'; ell(ctx, hd[0], hd[1], 10, 10); ctx.fill(); }
    // head + mask + conical hat
    const hx0 = -22, hy0 = -334;
    ell(ctx, hx0, hy0, 22, 25); ctx.fillStyle = '#c48a62'; ctx.fill();
    ctx.fillStyle = '#7a9cc9'; ctx.beginPath(); ctx.roundRect(hx0 - 26, hy0 + 2, 26, 16, 6); ctx.fill();
    ctx.fillStyle = '#e8d9a8'; ctx.beginPath(); ctx.moveTo(hx0 - 66, hy0 - 6); ctx.lineTo(hx0 + 2, hy0 - 62); ctx.lineTo(hx0 + 64, hy0 - 6); ctx.quadraticCurveTo(hx0, hy0 + 4, hx0 - 66, hy0 - 6); ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,40,0.35)'; ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx0 - 66 + i * 16, hy0 - 6 - i * 14); ctx.lineTo(hx0 + 64 - i * 16, hy0 - 6 - i * 14); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(hx0 + 2, hy0 - 62); ctx.lineTo(hx0 + 64, hy0 - 6); ctx.lineTo(hx0 + 10, hy0 - 2); ctx.closePath(); ctx.fill();
  });
}

// =====================================================================================
// STALL
// =====================================================================================
function cylPath(ctx, yb, rb, rt, h, k) {
  const yt = yb - h;
  ctx.beginPath(); ctx.moveTo(-rb, yb);
  ctx.ellipse(0, yb, rb, rb * k, 0, Math.PI, 0, true);
  ctx.lineTo(rt, yt);
  ctx.ellipse(0, yt, rt, rt * k, 0, 0, Math.PI, true);
  ctx.closePath();
}
function drawLid(ctx, x, y, R, k, tilt = 0) {
  at(ctx, x, y, tilt, 1, 1, () => {
    ell(ctx, 0, 6, R + 4, (R + 4) * k); ctx.fillStyle = '#4c4e52'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, R + 4, (R + 4) * k, 0, 0, TAU); ctx.fillStyle = metalGrad(ctx, -R, R, 1); ctx.fill();
    // dome
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.92, R * 0.92 * k + 34, 0, Math.PI, 0); ctx.closePath();
    const dg = ctx.createLinearGradient(-R, -40, R, 0); dg.addColorStop(0, '#6d7074'); dg.addColorStop(0.3, '#f4ead8'); dg.addColorStop(0.55, '#a3a4a6'); dg.addColorStop(1, '#55575b');
    ctx.fillStyle = dg; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, R + 2, (R + 2) * k, 0, 0, Math.PI); ctx.stroke();
    // knob
    ctx.fillStyle = '#2a2420'; ctx.beginPath(); ctx.roundRect(-22, -R * k - 58, 44, 22, 8); ctx.fill();
    ctx.fillRect(-6, -R * k - 40, 12, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-16, -R * k - 55, 20, 4);
  });
}
function giantPot(ctx, x, y, s, o = {}) {
  const t = o.t || 0, k = 0.28, R = 175, yb = -120, h = 280, yt = -400, simmer = o.simmer === undefined ? 0.6 : o.simmer;
  const lid = o.lid === undefined ? 'on' : o.lid, lift = lid === 'on' ? 0 : lid === 'off' ? null : +lid;
  at(ctx, x, y, 0, s, s, () => {
    ell(ctx, 0, 0, 210, 34); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    if (o.stove !== false) {
      const sg = ctx.createLinearGradient(-130, 0, 130, 0);
      sg.addColorStop(0, '#3b2f28'); sg.addColorStop(0.35, '#8a7564'); sg.addColorStop(1, '#2e241f');
      cylBody(ctx, 0, 132, 122, 120, k, sg);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-124, -30, 248, 8);
      // vent with embers
      ctx.beginPath(); ctx.roundRect(-46, -84, 92, 54, 10); ctx.fillStyle = '#1a0d08'; ctx.fill();
      const fl = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1 + 1);
      const eg = ctx.createRadialGradient(0, -50, 4, 0, -50, 50); eg.addColorStop(0, `rgba(255,220,120,${fl})`); eg.addColorStop(0.5, `rgba(255,110,30,${0.8 * fl})`); eg.addColorStop(1, 'rgba(120,20,0,0.2)');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.roundRect(-40, -78, 80, 44, 8); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(30,10,5,0.6)`; ell(ctx, -26 + i * 17, -52 + (i % 2) * 8, 6, 6); ctx.fill(); }
      glow(ctx, 0, -55, 150, 'rgba(255,110,40,0.7)', 0.55 * fl);
      glow(ctx, 0, -122, 230, 'rgba(255,120,50,0.5)', 0.35 * fl);
    }
    // pot body
    cylPath(ctx, yb, R * 0.97, R, h, k); ctx.fillStyle = metalGrad(ctx, -R, R, 1); ctx.fill();
    ctx.save(); cylPath(ctx, yb, R * 0.97, R, h, k); ctx.clip();
    const soot = ctx.createLinearGradient(0, yb + 50, 0, yb - 150); soot.addColorStop(0, 'rgba(18,12,8,0.95)'); soot.addColorStop(1, 'rgba(18,12,8,0)');
    ctx.fillStyle = soot; ctx.fillRect(-R - 5, yt - 60, 2 * R + 10, h + 120);
    const r = rng(17);
    for (let i = 0; i < 7; i++) { const dx = (r() - 0.5) * 2 * R * 0.8, dy = yt + 60 + r() * 170; const ew = 10 + r() * 12, eh = 5 + r() * 6, er = r() * 0.6 - 0.3; ctx.fillStyle = 'rgba(40,40,45,0.08)'; ctx.beginPath(); ctx.ellipse(dx, dy, ew, eh, er, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(dx, dy + 1, ew * 0.85, eh * 0.8, er, 0.3, 2.6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,240,220,0.12)'; ctx.fillRect(-R * 0.6, yt, 14, h); ctx.fillRect(R * 0.5, yt, 6, h);
    // warm stove rim light
    const wl = ctx.createLinearGradient(0, yb + 40, 0, yb - 60); wl.addColorStop(0, 'rgba(255,120,40,0.45)'); wl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = wl; ctx.fillRect(-R - 5, yb - 70, 2 * R + 10, 130);
    ctx.restore();
    // handles
    for (const sd of [-1, 1]) { ctx.strokeStyle = '#3d3f43'; ctx.lineWidth = 12; ctx.beginPath(); ctx.ellipse(sd * (R + 4), yt + 52, 26, 18, 0, sd > 0 ? -1.4 : Math.PI - 1.7, sd > 0 ? 1.7 : Math.PI + 1.4); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke(); }
    // top
    if (lift === null || lift > 0) {
      ell(ctx, 0, yt, R - 4, (R - 4) * k);
      const ig = ctx.createLinearGradient(0, yt - R * k, 0, yt + R * k); ig.addColorStop(0, '#2b2b2e'); ig.addColorStop(1, '#8c8c90');
      ctx.fillStyle = ig; ctx.fill();
      ctx.save(); ell(ctx, 0, yt, R - 6, (R - 6) * k); ctx.clip();
      at(ctx, 0, yt + 16, 0, 1, k, () => potTop(ctx, 0, 0, R - 10, { rim: false, simmer, t, bones: o.bones, clarity: o.clarity, skim: o.skim, onion: o.onion, anise: o.anise }));
      // back inner wall
      ctx.beginPath(); ctx.ellipse(0, yt, R - 6, (R - 6) * k, 0, Math.PI, 0); ctx.lineTo(R - 6, yt + 14); ctx.ellipse(0, yt + 14, R - 6, (R - 6) * k, 0, 0, Math.PI, true); ctx.closePath();
      ctx.fillStyle = 'rgba(70,70,76,0.85)'; ctx.fill();
      ctx.restore();
    }
    ctx.lineWidth = 9; ctx.strokeStyle = '#d9d4cb'; ell(ctx, 0, yt, R - 2, (R - 2) * k); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#5b5d61'; ell(ctx, 0, yt + 4, R + 2, (R + 2) * k); ctx.stroke();
    if (lift !== null) drawLid(ctx, 0, yt - lift, R, k, o.lidTilt || 0);
    const sa = o.steam === undefined ? 1 : o.steam;
    if (sa > 0) {
      if (lift === null || lift > 20) richSteam(ctx, t, 211, 0, yt - 10, R * 1.4, 760, 0.6 * sa, { n: 16 });
      else { richSteam(ctx, t, 212, -R, yt, 40, 300, 0.35 * sa, { n: 5 }); richSteam(ctx, t, 213, R, yt, 40, 300, 0.35 * sa, { n: 5 }); }
    }
  });
  return { rimX: x, rimY: y - 400 * s, R: 175 * s };
}

function potTop(ctx, x, y, R, o = {}) {
  const clarity = o.clarity === undefined ? 1 : o.clarity, skim = o.skim || 0, t = o.t || 0, simmer = o.simmer === undefined ? 0.5 : o.simmer;
  const fatA = o.fat === undefined ? 1 : o.fat;
  ctx.save(); ctx.translate(x, y);
  let Ri = R;
  if (o.rim !== false) {
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU);
    const mg = ctx.createLinearGradient(-R, -R, R, R); mg.addColorStop(0, '#f6eee0'); mg.addColorStop(0.3, '#9a9c9f'); mg.addColorStop(0.6, '#d5d2cc'); mg.addColorStop(1, '#4a4c50');
    ctx.fillStyle = mg; ctx.fill();
    Ri = R * 0.9;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, TAU); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = R * 0.012; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, Ri, 0, TAU); ctx.clip();
  const mk = 1 - clarity;
  const bg = ctx.createRadialGradient(-Ri * 0.25, -Ri * 0.25, Ri * 0.05, 0, 0, Ri);
  bg.addColorStop(0, mixc('#f9cf78', '#b3946c', mk)); bg.addColorStop(0.55, mixc('#d98d30', '#8f6e4c', mk)); bg.addColorStop(1, mixc('#7a3e10', '#5a4632', mk));
  ctx.fillStyle = bg; ctx.fillRect(-Ri, -Ri, 2 * Ri, 2 * Ri);
  const r = rng(o.seed || 303);
  if (o.bones !== false) {
    for (let i = 0; i < 6; i++) {
      const a = r() * TAU, d = Ri * (0.2 + r() * 0.55);
      ctx.globalAlpha = 0.85; beefBone(ctx, Math.cos(a) * d, Math.sin(a) * d, Ri / 300, r() * TAU, { view: 'top' });
    }
    ctx.globalAlpha = 1;
  }
  // amber depth overlay (clear broth tints what is under it)
  ctx.fillStyle = rgba(mixc('#c8741c', '#8a6a48', mk), 0.38 + 0.5 * mk); ctx.fillRect(-Ri, -Ri, 2 * Ri, 2 * Ri);
  // murk particles
  if (mk > 0.05) { for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(90,70,50,${0.25 * mk})`; ell(ctx, (r() - 0.5) * 2 * Ri, (r() - 0.5) * 2 * Ri, Ri * 0.02 + r() * Ri * 0.03, Ri * 0.02); ctx.fill(); } }
  // floating aromatics
  const rr = rng(404);
  if (o.onion !== false) for (let i = 0; i < 3; i++) { const a = rr() * TAU + t * 0.03, d = Ri * (0.25 + rr() * 0.45); charredOnion(ctx, Math.cos(a) * d, Math.sin(a) * d, Ri / 420, rr() * TAU); }
  if (o.anise !== false) for (let i = 0; i < 4; i++) { const a = rr() * TAU - t * 0.04, d = Ri * (0.15 + rr() * 0.6); starAnise(ctx, Math.cos(a) * d, Math.sin(a) * d, Ri / 520, rr() * TAU, { toast: 0.4 }); }
  if (o.anise !== false) { const a = rr() * TAU; cinnamonStick(ctx, Math.cos(a) * Ri * 0.35, Math.sin(a) * Ri * 0.35, Ri / 560, rr() * TAU); }
  // fat droplets (golden coins)
  if (fatA > 0) {
    const fr = rng(505);
    for (let i = 0; i < 70; i++) {
      const a = fr() * TAU + t * 0.02 * (fr() - 0.5), d = Ri * Math.sqrt(fr()) * 0.95, rad = Ri * (0.006 + fr() * fr() * 0.035);
      const px = Math.cos(a) * d, py = Math.sin(a) * d;
      ctx.globalAlpha = fatA * 0.9;
      ctx.fillStyle = 'rgba(255,214,110,0.55)'; ell(ctx, px, py, rad, rad); ctx.fill();
      ctx.strokeStyle = 'rgba(150,80,10,0.45)'; ctx.lineWidth = Math.max(0.6, rad * 0.18); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,240,0.85)'; ell(ctx, px - rad * 0.35, py - rad * 0.35, rad * 0.28, rad * 0.22); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // simmer bubbles
  const nb = Math.round(simmer * 34), br = rng(606);
  for (let i = 0; i < nb; i++) {
    const ph = br(), sp = 0.6 + br() * 0.9, life = (t * sp + ph) % 1, cyc = Math.floor(t * sp + ph);
    const rb = rng(i * 97 + cyc * 13), a = rb() * TAU, d = Ri * Math.sqrt(rb()) * 0.85;
    const px = Math.cos(a) * d, py = Math.sin(a) * d, rad = Ri * (0.012 + br() * 0.02) * Math.sin(life * Math.PI * 0.9 + 0.2);
    if (life > 0.92) { ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 1.5; ell(ctx, px, py, rad * 2.4, rad * 2.4); ctx.stroke(); continue; }
    ctx.fillStyle = 'rgba(255,225,160,0.35)'; ell(ctx, px, py, rad, rad); ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,225,0.8)'; ctx.lineWidth = Math.max(0.8, rad * 0.2); ctx.beginPath(); ctx.arc(px, py, rad, 3.6, 5.6); ctx.stroke();
  }
  // foam / scum
  if (skim > 0) {
    const sr = rng(707);
    for (let i = 0; i < 26; i++) {
      const a = sr() * TAU + t * 0.05, edge = sr() < 0.7, d = edge ? Ri * (0.75 + sr() * 0.2) : Ri * sr() * 0.5;
      const px = Math.cos(a) * d, py = Math.sin(a) * d, rad = Ri * (0.04 + sr() * 0.08) * skim;
      ctx.fillStyle = `rgba(196,176,150,${0.85 * Math.min(1, skim * 1.4)})`;
      ctx.beginPath(); for (let q = 0; q < 5; q++) { const qa = sr() * TAU, qd = rad * 0.5 * sr(); ctx.moveTo(px + Math.cos(qa) * qd + rad * 0.6, py + Math.sin(qa) * qd); ctx.arc(px + Math.cos(qa) * qd, py + Math.sin(qa) * qd, rad * (0.4 + sr() * 0.5), 0, TAU); } ctx.fill();
      ctx.fillStyle = `rgba(120,95,70,${0.4 * skim})`; for (let q = 0; q < 4; q++) { ell(ctx, px + (sr() - 0.5) * rad, py + (sr() - 0.5) * rad, rad * 0.12, rad * 0.12); ctx.fill(); }
    }
  }
  // reflection + edge shadow
  ctx.globalCompositeOperation = 'screen';
  const hl = ctx.createRadialGradient(-Ri * 0.35, -Ri * 0.4, 0, -Ri * 0.35, -Ri * 0.4, Ri * 0.5);
  hl.addColorStop(0, 'rgba(255,250,230,0.45)'); hl.addColorStop(1, 'rgba(255,250,230,0)');
  ctx.fillStyle = hl; ctx.fillRect(-Ri, -Ri, 2 * Ri, 2 * Ri);
  ctx.globalCompositeOperation = 'source-over';
  const es = ctx.createRadialGradient(0, 0, Ri * 0.7, 0, 0, Ri); es.addColorStop(0, 'rgba(40,15,0,0)'); es.addColorStop(1, 'rgba(40,15,0,0.55)');
  ctx.fillStyle = es; ctx.fillRect(-Ri, -Ri, 2 * Ri, 2 * Ri);
  ctx.restore();
}

function meatCabinet(ctx, x, y, s, o = {}) {
  const t = o.t || 0, light = o.light === undefined ? 1 : o.light;
  at(ctx, x, y, 0, s, s, () => {
    // base box
    ctx.fillStyle = '#4e2e1a'; ctx.fillRect(-160, -60, 320, 60);
    ctx.fillStyle = '#6b4126'; ctx.fillRect(-160, -64, 320, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-150, -46, 140, 40); ctx.fillRect(10, -46, 140, 40);
    // interior
    const ig = ctx.createLinearGradient(0, -260, 0, -64); ig.addColorStop(0, '#6a3a1e'); ig.addColorStop(1, '#3b2214');
    ctx.fillStyle = ig; ctx.fillRect(-150, -256, 300, 192);
    // bulb glow
    glow(ctx, 0, -240, 200, 'rgba(255,180,90,0.9)', 0.75 * light);
    // rail + hanging beef
    ctx.strokeStyle = '#b0b0b0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-140, -236); ctx.lineTo(140, -236); ctx.stroke();
    const meats = [[-92, '#b8483c', 'brisket'], [-12, '#8a5a40', 'shank'], [74, '#c45a4a', 'flank']];
    for (const [mx, col, kind] of meats) {
      const sw = Math.sin(t * 1.2 + mx) * 0.03;
      at(ctx, mx, -236, sw, 1, 1, () => {
        ctx.strokeStyle = '#ccc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16); ctx.arc(-6, 16, 6, 0, Math.PI); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-26, 22); ctx.quadraticCurveTo(0, 14, 28, 24); ctx.quadraticCurveTo(38, 80, 22, 120); ctx.quadraticCurveTo(0, 132, -24, 118); ctx.quadraticCurveTo(-36, 70, -26, 22); ctx.fill();
        if (kind !== 'shank') { ctx.strokeStyle = 'rgba(255,240,225,0.75)'; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-28, 44 + i * 26); ctx.quadraticCurveTo(0, 38 + i * 26, 30, 48 + i * 26); ctx.stroke(); } }
        else { ctx.strokeStyle = 'rgba(240,215,180,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 70, 16, 30, 0.1, 0, TAU); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,230,200,0.3)'; ctx.beginPath(); ctx.ellipse(-12, 50, 6, 26, 0.1, 0, TAU); ctx.fill();
      });
    }
    // tray with sliced cooked beef + noodles
    ctx.fillStyle = '#d8d8d8'; ctx.fillRect(-140, -86, 130, 14); ctx.fillStyle = '#c9c4bc'; ctx.fillRect(10, -86, 130, 14);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#9a7466' : '#8a6658'; ctx.beginPath(); ctx.ellipse(-120 + i * 18, -90, 14, 7, -0.3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#f6f0e2'; ctx.beginPath(); ctx.ellipse(76, -94, 56, 16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,170,0.7)'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(30, -96 + i * 2); ctx.quadraticCurveTo(76, -110 + i * 4, 124, -96 + i * 2); ctx.stroke(); }
    // frame + glass
    ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 8; ctx.strokeRect(-154, -260, 308, 198);
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -260); ctx.lineTo(0, -62); ctx.stroke();
    ctx.fillStyle = 'rgba(200,220,240,0.08)'; ctx.fillRect(-150, -256, 300, 192);
    ctx.save(); ctx.beginPath(); ctx.rect(-150, -256, 300, 192); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (const [a, w] of [[-120, 26], [-80, 8], [40, 30], [92, 10]]) { ctx.beginPath(); ctx.moveTo(a, -256); ctx.lineTo(a + w, -256); ctx.lineTo(a + w - 90, -64); ctx.lineTo(a - 90, -64); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = '#e7e9ee'; ctx.fillRect(-160, -270, 320, 12);
    ctx.fillStyle = '#b52a24'; ctx.font = 'bold 26px BodySansBold'; ctx.textAlign = 'center'; ctx.fillText('PHỞ', 0, -38);
  });
}

function stallTable(ctx, x, y, s, o = {}) {
  const w = o.w || 300, h = o.h || 78;
  at(ctx, x, y, 0, s, s, () => {
    ell(ctx, 0, 0, w * 0.55, 18); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    ctx.fillStyle = '#3b2416'; ctx.fillRect(-w / 2 + 14, -h, 16, h); ctx.fillRect(w / 2 - 30, -h, 16, h);
    ctx.fillStyle = '#2c1a0f'; ctx.fillRect(-w / 2 + 20, -h * 0.4, w - 40, 9);
    const g = ctx.createLinearGradient(0, -h - 20, 0, -h); g.addColorStop(0, '#b07a48'); g.addColorStop(1, '#5e3a22');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h - 20, w, 20, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,225,180,0.45)'; ctx.fillRect(-w / 2 + 4, -h - 20, w - 8, 3);
    if (o.condiments !== false) {
      const ty = -h - 20;
      // chopstick tube
      ctx.fillStyle = '#c8a46a'; ctx.beginPath(); ctx.roundRect(-w / 2 + 30, ty - 70, 36, 70, 5); ctx.fill();
      ctx.strokeStyle = '#d9b37a'; ctx.lineWidth = 4; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 36 + i * 5, ty - 66); ctx.lineTo(-w / 2 + 30 + i * 7, ty - 120 - (i % 3) * 6); ctx.stroke(); }
      // chili sauce
      ctx.fillStyle = '#c3281e'; ctx.beginPath(); ctx.roundRect(-w / 2 + 84, ty - 64, 34, 64, 8); ctx.fill(); ctx.fillStyle = '#2f8f3a'; ctx.fillRect(-w / 2 + 92, ty - 80, 18, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-w / 2 + 89, ty - 58, 5, 40);
      vinegarGarlicJar(ctx, -w / 2 + 160, ty, 0.5);
      // lime bowl
      ctx.fillStyle = '#f2f0ea'; ctx.beginPath(); ctx.ellipse(w / 2 - 70, ty - 10, 40, 12, 0, 0, Math.PI); ctx.lineTo(w / 2 - 110, ty - 10); ctx.fill();
      limeWedge(ctx, w / 2 - 82, ty - 18, 0.32, -0.3); limeWedge(ctx, w / 2 - 58, ty - 20, 0.32, 0.4);
    }
  });
}
function lowStool(ctx, x, y, s, col = '#2f6fd6', h = 62) { P.stool(ctx, x, y, s, col, h); }

// =====================================================================================
// ÔNG TƯ
// =====================================================================================
const TU = { sweater: '#7a5236', sweaterD: '#553722', sweaterL: '#9a6e4a', scarf: '#86202a', scarfD: '#5c1219', pants: '#3a3940', beret: '#272533' };
function tuHand(ctx, x, y, rot, kind = 'grip') {
  at(ctx, x, y, rot, 1, 1, () => {
    const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, COL.skinTu[0]); g.addColorStop(1, COL.skinTu[2]);
    ctx.fillStyle = g;
    if (kind === 'open') { ctx.beginPath(); ctx.roundRect(-8, -12, 34, 24, 10); ctx.fill(); ctx.beginPath(); ctx.roundRect(18, -11, 16, 9, 4); ctx.roundRect(18, -1, 17, 9, 4); ctx.fill(); }
    else { ctx.beginPath(); ctx.roundRect(-6, -13, 30, 26, 11); ctx.fill(); ctx.strokeStyle = 'rgba(90,50,30,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(14 + i * 4, -12); ctx.lineTo(16 + i * 4, 12); ctx.stroke(); } }
    ctx.fillStyle = COL.skinTu[1]; ctx.beginPath(); ctx.ellipse(6, -12, 9, 6, -0.4, 0, TAU); ctx.fill(); // thumb
  });
}
function tuArm(ctx, sx, sy, hx, hy, bend, kind, rotOverride) {
  const e = ik(sx, sy, hx, hy, 120, 115, bend);
  seg(ctx, sx, sy, e[0], e[1], 38, 32, TU.sweater);
  seg(ctx, e[0], e[1], hx, hy, 32, 26, TU.sweater);
  ctx.strokeStyle = 'rgba(40,20,10,0.25)'; ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) { const u = i / 5; ctx.beginPath(); ctx.moveTo(lerp(e[0], hx, u) - 8, lerp(e[1], hy, u) - 6); ctx.lineTo(lerp(e[0], hx, u) + 8, lerp(e[1], hy, u) + 6); ctx.stroke(); }
  const a = Math.atan2(hy - e[1], hx - e[0]);
  // knit cuff
  seg(ctx, lerp(e[0], hx, 0.86), lerp(e[1], hy, 0.86), hx - Math.cos(a) * 4, hy - Math.sin(a) * 4, 30, 30, TU.sweaterD);
  tuHand(ctx, hx + Math.cos(a) * 8, hy + Math.sin(a) * 8, rotOverride === undefined ? a : rotOverride, kind);
  return e;
}
function ongTu(ctx, x, y, s, o = {}) {
  const pose = o.pose || 'stand', k = clamp(o.k || 0), t = o.t || 0, f = o.flip ? -1 : 1;
  const jit = o.shake ? [Math.sin(t * 43) * 4 * o.shake, Math.sin(t * 37 + 1) * 3 * o.shake] : [0, 0];
  const out = { head: null, cup: null, hit: null, hand: null };
  const Wp = (p) => [x + p[0] * s * f, y + p[1] * s];
  const ladleClipX = 270;
  at(ctx, x, y, 0, s * f, s, () => {
    const bob = Math.sin(t * 1.7) * 2;
    let lean = 0.0, tilt = 0, expr = 'smile', ek = k, eyesClosed = false;
    if (pose === 'laugh') { lean = -0.07 - 0.03 * Math.sin(t * 9) * (o.shake || 1); tilt = -0.22; expr = 'laugh'; }
    if (pose === 'slurp') { lean = 0.04; tilt = 0.08; expr = 'slurp'; }
    if (pose === 'drum') { lean = 0.03 * k; expr = k > 0.85 ? 'laugh' : 'smile'; }
    if (pose === 'stir' || pose === 'ladle' || pose === 'lid') lean = 0.06;
    if (o.expr) expr = o.expr;
    const hip = [jit[0], -300 + bob + jit[1]];
    const R = (p) => [hip[0] + p[0] * Math.cos(lean) - p[1] * Math.sin(lean), hip[1] + p[0] * Math.sin(lean) + p[1] * Math.cos(lean)];
    const shF = R([26, -166]), shB = R([-18, -170]), headP = R([16, -262]);
    // ----- pose targets -----
    let hF = R([40, 22]), hB = R([-50, -28]), bF = 1, bB = 1, kF = 'open', kB = 'open';
    const items = [], itemsBehind = [];
    if (pose === 'stir') {
      const a = t * 2.6, dip = [ladleClipX + Math.cos(a) * 80, -392 + Math.sin(a) * 16];
      hF = [150 + Math.cos(a) * 26, -540 + Math.sin(a) * 8];
      items.push(() => { ctx.strokeStyle = '#a77a45'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hF[0] - 30, hF[1] - 30); ctx.lineTo(dip[0], dip[1]); ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,180,0.4)'; ctx.lineWidth = 3; ctx.stroke(); ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 2; ell(ctx, dip[0], dip[1] + 2, 22, 6); ctx.stroke(); });
      hB = R([-50, -28]); kB = 'open';
    } else if (pose === 'lid') {
      const e = ease.inOut(k), lift = e * 190, L = [ladleClipX + 10 * e, -400 - lift - 6];
      hF = [108 + 10 * e, -418 - lift]; kF = 'grip';
      items.push(() => drawLid(ctx, L[0], L[1], 175, 0.28, -0.22 * e));
      hB = R([-50, -28]); kB = 'open';
    } else if (pose === 'ladle') {
      const e = ease.inOut(clamp(k / 0.45)), tip = ease.inOut(clamp((k - 0.45) / 0.55)) * 1.25;
      const cup = [lerp(262, 300, e), lerp(-372, -478, e)], rot = -0.95, len = 250;
      const g = ladleGrip(cup[0], cup[1], 1, rot, { len, tip });
      hF = g;
      out.cup = Wp(ladlePour(cup[0], cup[1], 1, { tip }));
      items.push(() => {
        ctx.save();
        if (cup[1] > -440) { ctx.beginPath(); ctx.rect(-3000, -3000, 6000, 2616); ctx.rect(-3000, -384, 3000 + ladleClipX - 168, 4000); ctx.rect(ladleClipX + 168, -384, 3000, 4000); ctx.clip(); }
        ladle(ctx, cup[0], cup[1], 1, rot, { len, tip, fill: e > 0.3 ? 1 : 0 });
        ctx.restore();
        if (cup[1] > -400) { ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 2; ell(ctx, cup[0], -386, 50, 9); ctx.stroke(); }
      });
      hB = R([-50, -28]); kB = 'open';
    } else if (pose === 'drum') {
      const e = ease.in(k), cup = [lerp(170, 122, e), lerp(-570, -448, e)], rot = -1.0, len = 200, tip = -0.35;
      hF = ladleGrip(cup[0], cup[1], 1, rot, { len, tip });
      out.hit = Wp([100, -402]);
      items.push(() => ladle(ctx, cup[0], cup[1], 1, rot, { len, tip }));
      hB = R([-50, -28]); kB = 'open';
    } else if (pose === 'slurp') {
      const mouth = [headP[0] + 12, headP[1] + 40];
      const bowlP = [mouth[0] + 34, mouth[1] + 70];
      hB = [bowlP[0] - 36, bowlP[1] + 10]; bB = 1; kB = 'open';
      hF = [mouth[0] + 70, mouth[1] - 10]; kF = 'grip';
      items.push(() => {
        phoBowl(ctx, bowlP[0], bowlP[1] + 24, 0.2, { fill: 0.8, noodles: 1, beef: 1, cook: 0.8, scallion: 1, k: 0.5 });
        // noodle strands bowl -> mouth, shortening with k
        const top = [mouth[0], mouth[1] + 4], lift = [hF[0] - 8, hF[1] + 14];
        ctx.strokeStyle = COL.noodle; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const sx_ = bowlP[0] - 14 + i * 6, sy_ = bowlP[1] - 6;
          ctx.lineWidth = 3.2; ctx.strokeStyle = i % 2 ? '#efe6d2' : COL.noodle;
          ctx.beginPath(); ctx.moveTo(top[0] - 4 + i * 2, top[1]); ctx.bezierCurveTo(lift[0] + i * 2, lift[1] - 10, lift[0] - 6 + i * 3, lift[1] + 20 + Math.sin(t * 20 + i) * 3 * (1 - k), sx_, sy_); ctx.stroke();
        }
        chopsticksPair(ctx, hF[0] - 58, hF[1] + 44, 0.32, -0.65, 0.05);
      });
    } else if (pose === 'laugh') {
      hF = R([40, -86]); hB = R([4, -78]); kF = 'open'; kB = 'open'; bF = 1; bB = 1;
    } else if (pose === 'present') {
      const e = ease.out(k === 0 && o.k === undefined ? 1 : k);
      const bp = [lerp(80, 165, e), lerp(-330, -400, e)];
      hF = [bp[0] + 34, bp[1] - 14]; hB = [bp[0] - 34, bp[1] - 12]; kF = 'open'; kB = 'open';
      if (o.bowl !== false) items.push(() => phoBowl(ctx, bp[0], bp[1] + 6, 0.3, { fill: 0.85, noodles: 1, beef: 1, cook: 0.3, scallion: 1, onion: 1, herbs: 1, steam: 0.5, t }));
    }
    // ----- back arm -----
    tuArm(ctx, shB[0], shB[1], hB[0], hB[1], bB, kB);
    for (const fn of itemsBehind) fn();
    // ----- legs -----
    const legs = [[-14, -4, '#2f2e35'], [16, 18, TU.pants]];
    for (const [hx0, fx, col] of legs) {
      const kn = ik(hip[0] + hx0, hip[1] + 6, fx, -12, 150, 145, -1);
      seg(ctx, hip[0] + hx0, hip[1] + 6, kn[0], kn[1], 40, 32, col); seg(ctx, kn[0], kn[1], fx, -14, 32, 28, col);
      ctx.fillStyle = '#1b1715'; ctx.beginPath(); ctx.roundRect(fx - 18, -22, 52, 22, [12, 14, 4, 4]); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(fx - 10, -20, 30, 3);
    }
    // ----- torso -----
    at(ctx, hip[0], hip[1], lean, 1, 1, () => {
      const tg = ctx.createLinearGradient(-50, 0, 60, 0); tg.addColorStop(0, TU.sweaterD); tg.addColorStop(0.45, TU.sweater); tg.addColorStop(1, TU.sweaterL);
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.moveTo(-46, 14); ctx.quadraticCurveTo(-56, -80, -48, -160); ctx.quadraticCurveTo(-40, -184, 0, -188); ctx.quadraticCurveTo(48, -186, 56, -160); ctx.quadraticCurveTo(62, -80, 50, 14); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(40,20,10,0.22)'; ctx.lineWidth = 2;
      for (let xx = -44; xx < 60; xx += 9) { ctx.beginPath(); ctx.moveTo(xx, -186); ctx.lineTo(xx + 2, 14); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,220,180,0.12)'; for (let xx = -40; xx < 60; xx += 9) { ctx.beginPath(); ctx.moveTo(xx, -186); ctx.lineTo(xx + 2, 14); ctx.stroke(); }
      ctx.fillStyle = TU.sweaterD; ctx.fillRect(-60, -10, 130, 26);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; for (let xx = -56; xx < 60; xx += 6) { ctx.beginPath(); ctx.moveTo(xx, -10); ctx.lineTo(xx, 16); ctx.stroke(); }
      ctx.restore();
      // neck
      ctx.fillStyle = COL.skinTu[1]; ctx.fillRect(-2, -228, 30, 46);
      ctx.strokeStyle = 'rgba(90,50,30,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -222); ctx.lineTo(10, -190); ctx.stroke();
      // scarf: wrap + tail
      ctx.fillStyle = TU.scarf; ctx.beginPath(); ctx.roundRect(-30, -204, 84, 32, 14); ctx.fill();
      ctx.fillStyle = TU.scarfD; ctx.beginPath(); ctx.moveTo(28, -186); ctx.quadraticCurveTo(44, -120, 34, -70); ctx.lineTo(10, -74); ctx.quadraticCurveTo(18, -126, 8, -184); ctx.closePath(); ctx.fill();
      ctx.fillStyle = TU.scarf; ctx.beginPath(); ctx.moveTo(18, -188); ctx.quadraticCurveTo(30, -130, 22, -86); ctx.lineTo(2, -90); ctx.quadraticCurveTo(10, -132, 2, -186); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,180,0.25)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-24 + i * 20, -202); ctx.lineTo(-20 + i * 20, -174); ctx.stroke(); }
      ctx.strokeStyle = '#d9b06a'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 4, -90); ctx.lineTo(3 + i * 4, -78); ctx.stroke(); }
      // white towel over back shoulder
      ctx.fillStyle = '#ece6da'; ctx.beginPath(); ctx.moveTo(-50, -168); ctx.quadraticCurveTo(-30, -186, -12, -176); ctx.lineTo(-20, -110); ctx.lineTo(-52, -104); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,150,130,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-48, -114); ctx.lineTo(-22, -118); ctx.stroke();
    });
    // ----- head -----
    const hp = [headP[0], headP[1]];
    out.head = Wp(hp);
    ongTuFace(ctx, hp[0], hp[1], 0.3, { expr, k: ek, t, turn: o.turn === undefined ? 0.45 : o.turn, tilt: tilt + lean * 0.5, body: false, noodles: false, shake: o.shake, blink: o.blink });
    for (const fn of items) fn();
    // ----- front arm -----
    tuArm(ctx, shF[0], shF[1], hF[0], hF[1], bF, kF);
    out.hand = Wp(hF);
  });
  return out;
}

function ongTuFace(ctx, x, y, s, o = {}) {
  const expr = o.expr || 'smile', k = clamp(o.k === undefined ? 0.5 : o.k), t = o.t || 0, turn = o.turn || 0, tx = turn * 55;
  const sh = o.shake ? [Math.sin(t * 45) * 6 * o.shake, Math.sin(t * 39 + 2) * 4 * o.shake] : [0, 0];
  const look = o.look || [0, 0], sk = COL.skinTu;
  at(ctx, x + sh[0] * s, y + sh[1] * s, 0, s, s, () => {
    if (o.body !== false) {
      // sweater shoulders
      const sg = ctx.createLinearGradient(-320, 0, 320, 0); sg.addColorStop(0, TU.sweaterD); sg.addColorStop(0.5, TU.sweater); sg.addColorStop(1, TU.sweaterL);
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-330, 640); ctx.quadraticCurveTo(-330, 350, -150, 300); ctx.lineTo(150, 300); ctx.quadraticCurveTo(330, 350, 330, 640); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(40,20,10,0.25)'; ctx.lineWidth = 4;
      for (let xx = -320; xx < 330; xx += 22) { ctx.beginPath(); ctx.moveTo(xx, 300); ctx.lineTo(xx * 1.05, 640); ctx.stroke(); }
      ctx.restore();
      // neck
      ctx.fillStyle = sk[1]; ctx.beginPath(); ctx.moveTo(-58 + tx * 0.3, 150); ctx.lineTo(62 + tx * 0.3, 150); ctx.lineTo(70, 300); ctx.lineTo(-66, 300); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(100,55,30,0.4)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, 190); ctx.lineTo(-30, 280); ctx.moveTo(26, 190); ctx.lineTo(34, 280); ctx.stroke();
    }
    at(ctx, 0, 0, o.tilt || 0, 1, 1, () => {
      const cx = tx * 0.35;
      // ears
      for (const sd of [-1, 1]) {
        const ex = cx + sd * 136 - tx * 0.25; if (sd * turn > 0.55) continue;
        ctx.fillStyle = sk[1]; ctx.beginPath(); ctx.ellipse(ex, 20, 22, 38, sd * 0.15, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(110,60,35,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(ex + sd * 2, 20, 11, 24, sd * 0.15, -1.4, 1.4); ctx.stroke();
      }
      // head shape (thin, hollow cheeks)
      const suck = expr === 'slurp' ? k : 0;
      const hg = ctx.createLinearGradient(-150, -100, 160, 120); hg.addColorStop(0, sk[0]); hg.addColorStop(0.6, sk[1]); hg.addColorStop(1, sk[2]);
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.moveTo(cx, -175);
      ctx.bezierCurveTo(cx + 120, -175, cx + 142, -80, cx + 138, 10);
      ctx.bezierCurveTo(cx + 134 - suck * 26, 90, cx + 108 - suck * 16, 150, cx + 48, 200);
      ctx.quadraticCurveTo(cx + tx * 0.4, 222, cx - 48, 200);
      ctx.bezierCurveTo(cx - 108 + suck * 16, 150, cx - 134 + suck * 26, 90, cx - 138, 10);
      ctx.bezierCurveTo(cx - 142, -80, cx - 120, -175, cx, -175); ctx.fill();
      // far-side shading
      ctx.save(); ctx.clip();
      const fs = ctx.createLinearGradient(cx - 140 + tx, 0, cx - 40 + tx, 0); fs.addColorStop(0, 'rgba(80,40,25,0.35)'); fs.addColorStop(1, 'rgba(80,40,25,0)');
      if (turn > 0) { ctx.fillStyle = fs; ctx.fillRect(-200, -200, 400, 450); }
      // cheekbone + hollow cheeks
      for (const sd of [-1, 1]) {
        const chx = tx + sd * 82;
        ctx.fillStyle = `rgba(90,45,25,${0.14 + suck * 0.35})`; ctx.beginPath(); ctx.ellipse(chx + sd * 8, 92, 28 + suck * 6, 40 + suck * 10, sd * 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,200,0.25)'; ctx.beginPath(); ctx.ellipse(chx, 40, 26, 12, sd * -0.3, 0, TAU); ctx.fill();
        if (expr !== 'slurp') { ctx.fillStyle = 'rgba(230,110,90,0.22)'; ctx.beginPath(); ctx.ellipse(chx, 62, 30, 20, 0, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
      // grey hair tufts at temples
      ctx.fillStyle = '#d9d6d0';
      for (const sd of [-1, 1]) { const hx0 = cx + sd * 126 - tx * 0.2; if (sd * turn > 0.55) continue; ctx.beginPath(); ctx.moveTo(hx0, -120); ctx.quadraticCurveTo(hx0 + sd * 26, -70, hx0 + sd * 4, -28); ctx.quadraticCurveTo(hx0 - sd * 10, -70, hx0 - sd * 18, -110); ctx.closePath(); ctx.fill(); }
      // forehead wrinkles
      ctx.strokeStyle = 'rgba(110,60,35,0.45)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      const browUp = expr === 'laugh' ? 10 : expr === 'slurp' ? 14 * k : 0;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(tx - 60 + i * 6, -84 - i * 15 - browUp * 0.5); ctx.quadraticCurveTo(tx, -94 - i * 15 - browUp * 0.5, tx + 60 - i * 6, -84 - i * 15 - browUp * 0.5); ctx.stroke(); }
      // beret
      at(ctx, cx - 6, -158, -0.1, 1, 1, () => {
        ctx.fillStyle = TU.beret; ctx.beginPath(); ctx.ellipse(0, -8, 168, 70, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b1a24'; ctx.beginPath(); ctx.ellipse(4, 32, 136, 22, 0.05, 0, Math.PI); ctx.lineTo(-132, 30); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.ellipse(-50, -40, 70, 22, -0.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = TU.beret; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(10, -74); ctx.lineTo(16, -96); ctx.stroke();
      });
      // eyebrows (bushy grey)
      for (const sd of [-1, 1]) {
        const bx = tx + sd * 64, by = -48 - browUp;
        ctx.fillStyle = '#d8d4cc'; ctx.beginPath(); ctx.moveTo(bx - 40, by + 8 + (sd < 0 ? 4 : 0)); ctx.quadraticCurveTo(bx, by - 22, bx + 42, by + 8 + (sd > 0 ? 4 : 0)); ctx.quadraticCurveTo(bx, by - 2, bx - 40, by + 8); ctx.fill();
        ctx.strokeStyle = '#a7a299'; ctx.lineWidth = 2.5; for (let i = 0; i < 7; i++) { const u = i / 6; ctx.beginPath(); ctx.moveTo(bx - 36 + u * 72, by + 2 - Math.sin(u * Math.PI) * 10); ctx.lineTo(bx - 30 + u * 72 + sd * 4, by - 8 - Math.sin(u * Math.PI) * 10); ctx.stroke(); }
      }
      // eyes
      const blink = o.blink || (expr === 'smile' && (t % 3.7) < 0.12);
      for (const sd of [-1, 1]) {
        const ex = tx + sd * 64, ey = 0;
        ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        if (expr === 'laugh' || (expr === 'slurp' && k > 0.35)) {
          ctx.beginPath();
          if (expr === 'laugh') ctx.arc(ex, ey + 12, 24, Math.PI * 1.15, Math.PI * 1.85); else { ctx.moveTo(ex - 24, ey - 4); ctx.lineTo(ex + 2 * sd, ey + 6); ctx.lineTo(ex - 24 * -1, ey - 4); }
          ctx.stroke();
        } else if (blink) { ctx.beginPath(); ctx.arc(ex, ey - 8, 24, 0.3, Math.PI - 0.3); ctx.stroke(); }
        else {
          ctx.fillStyle = '#fbf3e6'; ctx.beginPath(); ctx.ellipse(ex, ey, 24, expr === 'slurp' ? 20 : 15, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#2a1a12'; ell(ctx, ex + 4 + look[0] * 8 + turn * 6, ey + 1 + look[1] * 5, 11, 12); ctx.fill();
          ctx.fillStyle = '#fff'; ell(ctx, ex + 8 + turn * 6, ey - 4, 3.5, 3.5); ctx.fill();
          ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(ex, ey + 2, 26, 16, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        }
        // crow's feet + eye bags
        ctx.strokeStyle = 'rgba(110,60,35,0.5)'; ctx.lineWidth = 2.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(ex + sd * 30, ey + i * 7); ctx.lineTo(ex + sd * 46, ey + i * 12); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(ex, ey + 6, 22, 0.4, Math.PI - 0.4); ctx.stroke();
      }
      // nose (big)
      const nx = tx * 1.12;
      ctx.fillStyle = sk[1]; ctx.beginPath(); ctx.moveTo(nx - 8, -10); ctx.quadraticCurveTo(nx + 12 + turn * 10, 30, nx + 30 + turn * 8, 64); ctx.quadraticCurveTo(nx, 84, nx - 30 + turn * 8, 64); ctx.quadraticCurveTo(nx - 18, 30, nx - 8, -10); ctx.fill();
      ctx.fillStyle = mixc(sk[0], '#e08a74', 0.25); ell(ctx, nx + turn * 10, 60, 28, 22); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,225,0.6)'; ell(ctx, nx + turn * 10 - 6, 52, 8, 6); ctx.fill();
      ctx.fillStyle = 'rgba(70,30,20,0.55)'; ell(ctx, nx - 12 + turn * 6, 74, 7, 4); ctx.fill(); ell(ctx, nx + 14 + turn * 10, 74, 7, 4); ctx.fill();
      // nasolabial folds
      ctx.strokeStyle = 'rgba(110,60,35,0.45)'; ctx.lineWidth = 3.5;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(nx + sd * 36, 60); ctx.quadraticCurveTo(tx + sd * 64, 110, tx + sd * 60, 150); ctx.stroke(); }
      // mouth
      const mx = tx * 1.05, my = 128;
      if (expr === 'laugh') {
        ctx.fillStyle = '#5a1418'; ctx.beginPath(); ctx.moveTo(mx - 46, my - 6); ctx.quadraticCurveTo(mx, my - 2, mx + 46, my - 6); ctx.quadraticCurveTo(mx + 30, my + 60, mx, my + 62); ctx.quadraticCurveTo(mx - 30, my + 60, mx - 46, my - 6); ctx.fill();
        ctx.fillStyle = '#d65a5e'; ell(ctx, mx, my + 44, 22, 12); ctx.fill();
        ctx.fillStyle = '#f2ead8'; for (let i = -3; i <= 3; i++) { if (i === 1) continue; ctx.fillRect(mx + i * 11 - 5, my - 4, 9, 11); }
      } else if (expr === 'slurp') {
        const pr = 1 + k * 0.25;
        ctx.fillStyle = '#b8575a'; ell(ctx, mx + 4, my + 4, 26 * pr, 22 * pr); ctx.fill();
        ctx.fillStyle = '#4a1014'; ell(ctx, mx + 4, my + 4, 13, 11); ctx.fill();
        ctx.strokeStyle = 'rgba(110,40,30,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(mx + 4 + Math.cos(a) * 15, my + 4 + Math.sin(a) * 13); ctx.lineTo(mx + 4 + Math.cos(a) * 24 * pr, my + 4 + Math.sin(a) * 20 * pr); ctx.stroke(); }
        if (o.noodles !== false) {
          const len = lerp(560, 40, k);
          for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = i % 2 ? '#efe5cf' : COL.noodle; ctx.lineWidth = 9;
            ctx.beginPath(); ctx.moveTo(mx - 6 + i * 4, my + 6);
            ctx.bezierCurveTo(mx - 20 + i * 8 + Math.sin(t * 18 + i) * 10, my + len * 0.35, mx + 10 + i * 10 - Math.sin(t * 15 + i) * 14, my + len * 0.7, mx - 30 + i * 18, my + len);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(200,180,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
          }
          ctx.fillStyle = 'rgba(255,220,140,0.9)'; for (let i = 0; i < 6; i++) { const ph = (t * 2.5 + i / 6) % 1; ell(ctx, mx + (i - 3) * 20 + ph * (i - 3) * 30, my + 20 - ph * 60 + ph * ph * 120, 4, 5); ctx.fill(); }
        }
      } else {
        ctx.strokeStyle = '#5a2a1e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(mx - 40, my - 2); ctx.quadraticCurveTo(mx, my + 26, mx + 40, my - 2); ctx.stroke();
        ctx.fillStyle = 'rgba(190,100,90,0.6)'; ell(ctx, mx, my + 18, 22, 7); ctx.fill();
      }
      // drooping grey moustache
      const mLift = expr === 'laugh' ? -12 : 0, mPurse = expr === 'slurp' ? 0.7 : 1;
      for (const sd of [-1, 1]) {
        ctx.fillStyle = '#d6d2ca';
        ctx.beginPath(); ctx.moveTo(nx + sd * 4, 84);
        ctx.quadraticCurveTo(mx + sd * 50 * mPurse, 84 + mLift, mx + sd * 64 * mPurse, 136 + mLift * 0.6);
        ctx.quadraticCurveTo(mx + sd * 40 * mPurse, 116 + mLift, mx + sd * 2, 104 + mLift * 0.5);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#a6a197'; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) { const u = i / 6; ctx.beginPath(); ctx.moveTo(mx + sd * (6 + u * 44) * mPurse, 92 + u * 10 + mLift * 0.6); ctx.lineTo(mx + sd * (12 + u * 50) * mPurse, 106 + u * 20 + mLift * 0.6); ctx.stroke(); }
      }
      // chin + jowl line
      ctx.strokeStyle = 'rgba(110,60,35,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx * 0.8, 178, 22, 0.4, Math.PI - 0.4); ctx.stroke();
    });
    if (o.body !== false) {
      // scarf (dark red knit wrap, knot, tail)
      ctx.fillStyle = TU.scarf; ctx.beginPath(); ctx.moveTo(-120, 250); ctx.quadraticCurveTo(0, 210, 124, 250); ctx.lineTo(132, 320); ctx.quadraticCurveTo(0, 360, -128, 320); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(40,0,5,0.35)'; ctx.lineWidth = 5; for (let xx = -110; xx < 125; xx += 18) { ctx.beginPath(); ctx.moveTo(xx, 240 + Math.abs(xx) * 0.08); ctx.lineTo(xx + 2, 330 - Math.abs(xx) * 0.08); ctx.stroke(); }
      ctx.fillStyle = TU.scarfD; ctx.beginPath(); ctx.moveTo(30, 310); ctx.quadraticCurveTo(70, 450, 50, 620); ctx.lineTo(-10, 620); ctx.quadraticCurveTo(10, 450, -16, 320); ctx.closePath(); ctx.fill();
      ctx.fillStyle = TU.scarf; ctx.beginPath(); ctx.ellipse(10, 318, 36, 26, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,170,0.18)'; ctx.lineWidth = 4; for (let yy = 360; yy < 610; yy += 22) { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(54, yy + 4); ctx.stroke(); }
    }
  });
}

// =====================================================================================
// BOWL & FOOD
// =====================================================================================
const rot2 = (px, py, a) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];

// contents of a bowl on a disc of radius R centred at (0,0); caller clips + (for 3/4 view) scales y.
function bowlContents(ctx, R, o = {}) {
  const t = o.t || 0, fill = o.fill === undefined ? 1 : o.fill, nood = o.noodles === undefined ? 1 : o.noodles;
  const beef = o.beef !== undefined ? o.beef : (o.beefRare !== undefined ? o.beefRare : 1);
  const cook = o.cook || 0, scal = o.scallion === undefined ? 1 : o.scallion, onion = o.onion === undefined ? 1 : o.onion;
  const herbs = o.herbs || 0, fatA = o.fat === undefined ? 1 : o.fat, pepper = o.pepper || 0, clarity = o.clarity === undefined ? 1 : o.clarity;
  ctx.save(); if (o.rot) ctx.rotate(o.rot);
  // bowl floor (seen when not full)
  ctx.fillStyle = '#ece9e2'; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  // broth
  if (fill > 0.02) {
    const mk = 1 - clarity, a = clamp(fill * 2.5);
    const bg = ctx.createRadialGradient(-R * 0.2, -R * 0.25, R * 0.05, 0, 0, R);
    bg.addColorStop(0, rgba(mixc('#f7cd78', '#b89a72', mk), a)); bg.addColorStop(0.6, rgba(mixc('#df9a3c', '#957452', mk), a)); bg.addColorStop(1, rgba(mixc('#93501a', '#6a5038', mk), a));
    ctx.fillStyle = bg; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  }
  const r = rng(o.seed || 77);
  // noodles: a soft mound + many glossy strands (amber tinted where submerged)
  if (nood > 0) {
    const mr = R * (0.45 + 0.4 * nood);
    const ng = ctx.createRadialGradient(0, 0, mr * 0.2, 0, 0, mr);
    ng.addColorStop(0, rgba('#fbf6e9', 0.95 * nood)); ng.addColorStop(0.75, rgba('#f1e2c2', 0.85 * nood)); ng.addColorStop(1, 'rgba(240,220,180,0)');
    ctx.fillStyle = ng; ell(ctx, 0, 0, mr, mr); ctx.fill();
    const ns = Math.round(46 * nood);
    ctx.lineCap = 'round';
    for (let i = 0; i < ns; i++) {
      const cx = (r() - 0.5) * mr * 0.9, cy = (r() - 0.5) * mr * 0.9, rr = R * (0.18 + r() * 0.4), a0 = r() * TAU, a1 = a0 + 0.8 + r() * 1.6;
      const sub = Math.hypot(cx, cy) / R;
      ctx.lineWidth = R * 0.05; ctx.strokeStyle = rgba(mixc('#d9c39a', '#a26a2c', sub * fill), 0.55);
      ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a1); ctx.stroke();
      ctx.lineWidth = R * 0.036; ctx.strokeStyle = mixc('#fdf9ef', '#e9c487', sub * fill * 0.8);
      ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a1); ctx.stroke();
      ctx.lineWidth = R * 0.008; ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(cx, cy, rr - R * 0.008, a0 + 0.1, a1 - 0.2); ctx.stroke();
    }
  }
  // beef slices fanned on top
  const nb = beef * 6;
  for (let i = 0; i < Math.ceil(nb - 0.001); i++) {
    const a = i / 6 * TAU + 0.35, d = R * 0.34, al = clamp(nb - i);
    beefSlice(ctx, Math.cos(a) * d, Math.sin(a) * d, R / 330, a + Math.PI / 2 + (i % 2 ? 0.2 : -0.15), { cook, alpha: al, seed: i + 3, curl: 0.2 });
  }
  // onion: thin translucent crescents
  for (let i = 0; i < Math.round(12 * onion); i++) {
    const px = (r() - 0.5) * R * 1.3, py = (r() - 0.5) * R * 1.3, rr = R * (0.06 + r() * 0.06), a0 = r() * TAU;
    ctx.strokeStyle = 'rgba(250,246,236,0.92)'; ctx.lineWidth = R * 0.016; ctx.beginPath(); ctx.arc(px, py, rr, a0, a0 + 2.2 + r()); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,220,170,0.6)'; ctx.lineWidth = R * 0.005; ctx.stroke();
  }
  // herbs (ngo / cilantro sprigs)
  for (let i = 0; i < Math.round(8 * herbs); i++) {
    const px = (r() - 0.5) * R * 1.2, py = (r() - 0.5) * R * 1.2, rs = R / 900, a = r() * TAU;
    at(ctx, px, py, a, rs, rs, () => {
      ctx.fillStyle = '#3f8f32';
      for (let q = 0; q < 3; q++) { const qa = q * 2.1; ctx.beginPath(); ctx.ellipse(Math.cos(qa) * 22, Math.sin(qa) * 22, 24, 18, qa, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#6cbf4a'; ell(ctx, -4, -4, 12, 9); ctx.fill();
    });
  }
  // scallion rings + whites
  for (let i = 0; i < Math.round(46 * scal); i++) {
    const a = r() * TAU, d = R * Math.sqrt(r()) * 0.85, px = Math.cos(a) * d, py = Math.sin(a) * d, rr = R * (0.014 + r() * 0.012);
    const white = r() < 0.18;
    ctx.fillStyle = white ? '#f2f6e2' : (r() < 0.5 ? '#4f9d33' : '#6fbf45'); ell(ctx, px, py, rr, rr * 0.85); ctx.fill();
    ctx.fillStyle = white ? '#d6e6b0' : '#b9e08a'; ell(ctx, px, py, rr * 0.5, rr * 0.42); ctx.fill();
  }
  // floating fat
  if (fill > 0.3 && fatA > 0) {
    const fr = rng(909);
    for (let i = 0; i < 40; i++) {
      const a = fr() * TAU + t * 0.03, d = R * (0.55 + fr() * 0.42), rad = R * (0.006 + fr() * fr() * 0.03);
      const px = Math.cos(a) * d, py = Math.sin(a) * d;
      ctx.globalAlpha = fatA;
      ctx.fillStyle = 'rgba(255,212,110,0.55)'; ell(ctx, px, py, rad, rad); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,240,0.85)'; ell(ctx, px - rad * 0.35, py - rad * 0.35, rad * 0.3, rad * 0.24); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < Math.round(70 * pepper); i++) { ctx.fillStyle = 'rgba(30,20,15,0.8)'; ell(ctx, (r() - 0.5) * R * 1.4, (r() - 0.5) * R * 1.4, R * 0.006, R * 0.006); ctx.fill(); }
  ctx.restore();
  // glossy highlight + rim shadow
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  const hl = ctx.createRadialGradient(-R * 0.35, -R * 0.45, 0, -R * 0.35, -R * 0.45, R * 0.6);
  hl.addColorStop(0, 'rgba(255,250,235,0.32)'); hl.addColorStop(1, 'rgba(255,250,235,0)'); ctx.fillStyle = hl; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
  const es = ctx.createRadialGradient(0, 0, R * 0.72, 0, 0, R); es.addColorStop(0, 'rgba(60,25,0,0)'); es.addColorStop(1, 'rgba(60,25,0,0.45)');
  ctx.fillStyle = es; ctx.fillRect(-R, -R, 2 * R, 2 * R);
}

function phoBowl(ctx, x, y, s, o = {}) {
  const k = o.k || 0.36, R = 200, ry = -150, fill = o.fill === undefined ? 1 : o.fill;
  const prof = (u) => 78 + 122 * (1 - Math.pow(1 - u, 2.2));
  const pt = (th, u) => { const rr = prof(u); return [rr * Math.cos(th), -(22 + u * 128) + rr * k * Math.sin(th)]; };
  at(ctx, x, y, o.rotate || 0, s, s, () => {
    ell(ctx, 0, 2, 150, 150 * k * 0.6); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
    // body
    const body = () => { ctx.beginPath(); ctx.moveTo(R, ry); ctx.ellipse(0, ry, R, R * k, 0, 0, Math.PI, false); ctx.bezierCurveTo(-R, -70, -122, -26, -80, -22); ctx.lineTo(-72, 0); ctx.lineTo(72, 0); ctx.lineTo(80, -22); ctx.bezierCurveTo(122, -26, R, -70, R, ry); ctx.closePath(); };
    body();
    const bg = ctx.createLinearGradient(-R, 0, R, 0); bg.addColorStop(0, '#c9ccd2'); bg.addColorStop(0.28, '#ffffff'); bg.addColorStop(0.6, '#e9eaec'); bg.addColorStop(1, '#a6aab3');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); body(); ctx.clip();
    const vg = ctx.createLinearGradient(0, ry + 60, 0, 0); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(40,50,80,0.22)'); ctx.fillStyle = vg; ctx.fillRect(-R, ry, 2 * R, 160);
    // cobalt decoration
    ctx.strokeStyle = COL.cobalt; ctx.lineCap = 'round';
    for (const [u, lw] of [[0.9, 5], [0.84, 2.5], [0.12, 2.5], [0.05, 4]]) {
      ctx.lineWidth = lw; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const p = pt(i / 40 * Math.PI, u); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
    }
    // scroll band between 0.68..0.8
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const th = (i + 0.5) / 14 * Math.PI, f = Math.sin(th); if (f < 0.15) continue;
      const c = pt(th, 0.74), rr = 9 * f + 2;
      ctx.globalAlpha = 0.5 + 0.5 * f;
      ctx.beginPath(); ctx.ellipse(c[0], c[1], rr * 1.2, rr * 0.9, 0, 0.2, TAU - 0.6); ctx.stroke();
      const n = pt(th + 0.5 / 14 * Math.PI, 0.74); ctx.beginPath(); ctx.moveTo(c[0] + rr, c[1]); ctx.quadraticCurveTo((c[0] + n[0]) / 2, c[1] + 10, n[0] - rr, n[1]); ctx.stroke();
    }
    // flowers on the belly
    for (let i = 0; i < 4; i++) {
      const th = (i + 0.5) / 4 * Math.PI, f = Math.sin(th), c = pt(th, 0.45);
      ctx.globalAlpha = 0.35 + 0.65 * f;
      at(ctx, c[0], c[1], 0, f * 0.9 + 0.1, 1, () => {
        ctx.fillStyle = COL.cobalt; for (let q = 0; q < 5; q++) { const a = q / 5 * TAU - 1.57; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 11, Math.sin(a) * 9, 9, 6, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#f4f6fb'; ell(ctx, 0, 0, 4, 4); ctx.fill();
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(18, 4); ctx.quadraticCurveTo(34, 18, 52, 6); ctx.moveTo(-18, 4); ctx.quadraticCurveTo(-34, -10, -50, 4); ctx.stroke();
        ctx.fillStyle = COL.cobalt; ctx.beginPath(); ctx.ellipse(34, 2, 8, 4, 0.4, 0, TAU); ctx.ellipse(-34, -6, 8, 4, -0.4, 0, TAU); ctx.fill();
      });
    }
    // lotus petals near foot
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const th = (i + 0.5) / 12 * Math.PI, f = Math.sin(th); if (f < 0.2) continue;
      const b = pt(th, 0.16), tp = pt(th, 0.36); const w = 10 * f + 2;
      ctx.globalAlpha = 0.5 + 0.5 * f; ctx.beginPath(); ctx.moveTo(b[0] - w, b[1]); ctx.quadraticCurveTo(b[0] - w, tp[1] + 6, tp[0], tp[1]); ctx.quadraticCurveTo(b[0] + w, tp[1] + 6, b[0] + w, b[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // glaze highlight
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-112, -92, 12, 40, 0.45, 0, TAU); ctx.fill();
    ctx.restore();
    // interior
    ell(ctx, 0, ry, R - 6, (R - 6) * k);
    const ig = ctx.createLinearGradient(0, ry - R * k, 0, ry + R * k); ig.addColorStop(0, '#c9ccd3'); ig.addColorStop(0.6, '#f4f4f2'); ig.addColorStop(1, '#ffffff');
    ctx.fillStyle = ig; ctx.fill();
    ctx.strokeStyle = COL.cobalt; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, ry + 6, R - 20, (R - 20) * k, 0, Math.PI, TAU); ctx.stroke();
    if (fill > 0.01 || (o.noodles || 0) > 0) {
      const d = 8 + (1 - fill) * 92, rs = R * (0.95 - (1 - fill) * 0.3);
      ctx.save(); ell(ctx, 0, ry, R - 7, (R - 7) * k); ctx.clip();
      at(ctx, 0, ry + d, 0, 1, k, () => { ctx.beginPath(); ctx.arc(0, 0, rs, 0, TAU); ctx.clip(); bowlContents(ctx, rs, o); });
      // inner front wall lip shading
      ctx.restore();
    }
    // rim
    ctx.lineWidth = 7; ctx.strokeStyle = '#fbfbfa'; ell(ctx, 0, ry, R - 3, (R - 3) * k); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120,130,150,0.6)'; ell(ctx, 0, ry + 1, R, R * k); ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(0, ry, R - 4, (R - 4) * k, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    if (o.steam) richSteam(ctx, o.t || 0, o.seed || 31, 0, ry - 10, R * 1.1, 620, o.steam, { n: 12 });
  });
  return { rimY: y - 150 * s, R: 200 * s };
}

function phoBowlTop(ctx, x, y, R, o = {}) {
  const fill = o.fill === undefined ? 1 : o.fill;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ell(ctx, R * 0.05, R * 0.08, R * 1.03, R * 1.03); ctx.fill();
  const og = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.2, 0, 0, R); og.addColorStop(0, '#ffffff'); og.addColorStop(0.85, '#eef0f2'); og.addColorStop(1, '#b9bec8');
  ctx.fillStyle = og; ell(ctx, 0, 0, R, R); ctx.fill();
  // cobalt rim band
  ctx.strokeStyle = COL.cobalt; ctx.lineWidth = R * 0.012; ell(ctx, 0, 0, R * 0.965, R * 0.965); ctx.stroke(); ell(ctx, 0, 0, R * 0.9, R * 0.9); ctx.stroke();
  ctx.lineWidth = R * 0.008;
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * TAU, c = [Math.cos(a) * R * 0.933, Math.sin(a) * R * 0.933];
    ctx.beginPath(); ctx.arc(c[0], c[1], R * 0.017, a, a + 4.6); ctx.stroke();
  }
  // inner wall
  const iw = ctx.createRadialGradient(R * 0.1, R * 0.12, R * 0.6, 0, 0, R * 0.88); iw.addColorStop(0, '#f6f6f4'); iw.addColorStop(1, '#c7cbd3');
  ctx.fillStyle = iw; ell(ctx, 0, 0, R * 0.88, R * 0.88); ctx.fill();
  ctx.strokeStyle = 'rgba(31,76,158,0.55)'; ctx.lineWidth = R * 0.008; ell(ctx, 0, 0, R * 0.84, R * 0.84); ctx.stroke();
  const rs = R * (0.66 + 0.16 * fill);
  ctx.save(); ell(ctx, 0, 0, rs, rs); ctx.clip();
  if (fill < 0.02 && !(o.noodles > 0)) {
    ctx.fillStyle = '#efede8'; ctx.fillRect(-rs, -rs, 2 * rs, 2 * rs);
    ctx.strokeStyle = COL.cobalt; ctx.lineWidth = R * 0.01; ell(ctx, 0, 0, R * 0.2, R * 0.2); ctx.stroke();
  } else bowlContents(ctx, rs, o);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = R * 0.02; ctx.beginPath(); ctx.arc(0, 0, R * 0.95, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
  if (o.steam) richSteam(ctx, o.t || 0, o.seed || 37, x, y, R * 1.2, R * 2.5, o.steam, { n: 12 });
}

// ---------- aromatics ----------
function charredOnion(ctx, x, y, s, rot = 0, o = {}) {
  const ch = o.char === undefined ? 1 : o.char;
  at(ctx, x, y, rot, s, s, () => {
    if (o.cut === false) {
      const g = ctx.createRadialGradient(-20, -20, 5, 0, 0, 70); g.addColorStop(0, mixc('#e8c890', '#4a2a18', ch)); g.addColorStop(1, mixc('#a8743c', '#120a06', ch));
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -75); ctx.quadraticCurveTo(68, -50, 62, 10); ctx.quadraticCurveTo(50, 62, 0, 64); ctx.quadraticCurveTo(-50, 62, -62, 10); ctx.quadraticCurveTo(-68, -50, 0, -75); ctx.fill();
      ctx.strokeStyle = 'rgba(40,20,10,0.4)'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(0, -72); ctx.quadraticCurveTo(i * 30, -10, i * 12, 62); ctx.stroke(); }
      return;
    }
    // halved onion seen on its cut face
    ctx.fillStyle = mixc('#c49058', '#2a160a', ch); ell(ctx, 0, 0, 66, 58); ctx.fill();
    for (let i = 7; i >= 0; i--) {
      const rr = i / 7, c1 = mixc('#f4ecd4', '#3a200e', ch * (0.55 + 0.45 * rr)), c2 = mixc('#e2d6b0', '#9a5a1e', ch * 0.8);
      ctx.fillStyle = i % 2 ? c1 : c2; ell(ctx, 2 * (1 - rr), 4 * (1 - rr), 60 * rr + 4, 52 * rr + 4); ctx.fill();
    }
    // char blotches
    const r = rng(o.seed || 12);
    for (let i = 0; i < 14 * ch; i++) { ctx.fillStyle = `rgba(15,8,4,${0.4 + r() * 0.5})`; ell(ctx, (r() - 0.5) * 100, (r() - 0.5) * 86, 4 + r() * 12, 3 + r() * 8); ctx.fill(); }
    ctx.fillStyle = `rgba(255,170,80,${0.25 * ch})`; ell(ctx, -14, -12, 18, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 3; ell(ctx, 0, 0, 66, 58); ctx.stroke();
  });
}
function gingerKnob(ctx, x, y, s, rot = 0, o = {}) {
  const ch = o.char === undefined ? 1 : o.char;
  at(ctx, x, y, rot, s, s, () => {
    const lobes = [[-50, 6, 42, 30, 0.2], [0, -8, 50, 34, 0], [48, 4, 40, 28, -0.2], [12, -48, 22, 30, 0.4], [70, -30, 18, 24, -0.6], [-74, -10, 16, 20, 0.5]];
    const g = ctx.createLinearGradient(0, -60, 0, 40); g.addColorStop(0, mixc('#e1c08a', '#6a4426', ch * 0.7)); g.addColorStop(1, mixc('#a87c48', '#2a180c', ch * 0.8));
    ctx.fillStyle = g; for (const [lx, ly, rx, ry, a] of lobes) { ctx.beginPath(); ctx.ellipse(lx, ly, rx, ry, a, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(80,50,25,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-70 + i * 17, -4 + (i % 3) * 6, 14, 0.3, 1.4); ctx.stroke(); }
    const r = rng(41);
    for (let i = 0; i < 16 * ch; i++) { ctx.fillStyle = `rgba(14,8,4,${0.5 + r() * 0.4})`; ell(ctx, (r() - 0.5) * 150, (r() - 0.5) * 60 - 6, 5 + r() * 14, 3 + r() * 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,240,200,0.3)'; ell(ctx, -10, -24, 28, 7); ctx.fill();
  });
}
function starAnise(ctx, x, y, s, rot = 0, o = {}) {
  const toast = o.toast || 0;
  at(ctx, x, y, rot, s, s, () => {
    for (let i = 0; i < 8; i++) {
      at(ctx, 0, 0, i / 8 * TAU, 1, 1, () => {
        const g = ctx.createLinearGradient(0, 0, 40, 0); g.addColorStop(0, mixc('#5a2c18', '#3a1a0c', toast)); g.addColorStop(1, mixc('#8a4a2a', '#5a2a12', toast));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(18, -12, 40, -3); ctx.lineTo(42, 0); ctx.lineTo(40, 3); ctx.quadraticCurveTo(18, 12, 4, 0); ctx.fill();
        ctx.fillStyle = '#2a1208'; ctx.beginPath(); ctx.ellipse(24, 0, 10, 3.2, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b06a3a'; ctx.beginPath(); ctx.ellipse(22, 0, 6, 2.6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,180,0.4)'; ctx.fillRect(22, -1, 4, 1.2);
      });
    }
    ctx.fillStyle = '#3a1a0c'; ell(ctx, 0, 0, 7, 7); ctx.fill();
  });
}
function cinnamonStick(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(0, -16, 0, 16); g.addColorStop(0, '#b06a3c'); g.addColorStop(0.4, '#8a4a26'); g.addColorStop(1, '#4e2612');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-95, -15, 190, 30, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(40,18,6,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(-90 + i * 24, -14); ctx.lineTo(-84 + i * 24, 14); ctx.stroke(); }
    ctx.strokeStyle = '#d8945a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-92, -4); ctx.lineTo(92, -6); ctx.stroke();
    ctx.fillStyle = '#c47e4a'; ell(ctx, 95, 0, 7, 15); ctx.fill();
    ctx.strokeStyle = '#5a2c14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(95, 2, 8, -2, 2.8); ctx.stroke(); ctx.beginPath(); ctx.arc(95, 0, 4, 1, 5); ctx.stroke();
  });
}
function cardamom(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(-30, -20, 30, 20); g.addColorStop(0, '#6a4a34'); g.addColorStop(1, '#22140c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-24, -26, 18, -20); ctx.quadraticCurveTo(42, -8, 40, 0); ctx.quadraticCurveTo(42, 8, 18, 20); ctx.quadraticCurveTo(-24, 26, -40, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(160,120,90,0.45)'; ctx.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-36, i * 3); ctx.bezierCurveTo(-10, i * 9 - 4, 10, i * 9 + 4, 38, i * 2); ctx.stroke(); }
    ctx.fillStyle = '#3a2416'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-50, -4); ctx.lineTo(-50, 4); ctx.fill();
  });
}
function clove(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = '#4a2414'; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(1.5, 26); ctx.lineTo(-1.5, 26); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? '#6a3420' : '#5a2a16'; ctx.beginPath(); ctx.ellipse(Math.cos(i * 1.57) * 6, -6 + Math.sin(i * 1.57) * 4, 6, 4, i * 1.57, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#8a4a2a'; ell(ctx, 0, -6, 5, 5); ctx.fill();
  });
}
function beefBone(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    if (o.view === 'top') {
      ctx.fillStyle = '#9a5a44'; ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, rr = 58 + Math.sin(i * 2.3) * 6; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(rr, 0); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#efe1c4'; ell(ctx, 0, 0, 40, 36); ctx.fill();
      ctx.strokeStyle = '#d3bf98'; ctx.lineWidth = 3; ell(ctx, 0, 0, 34, 30); ctx.stroke();
      const mg = ctx.createRadialGradient(-4, -4, 2, 0, 0, 24); mg.addColorStop(0, '#e8b48a'); mg.addColorStop(1, '#8a4a30');
      ctx.fillStyle = mg; ell(ctx, 0, 0, 24, 21); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.5)'; ell(ctx, -8, -8, 6, 4); ctx.fill();
      return;
    }
    const g = ctx.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, '#faf0d8'); g.addColorStop(0.6, '#dccaa4'); g.addColorStop(1, '#a8916a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(-96, -18, 192, 36, 18); ctx.fill();
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * 106, -20, 30, 26, 0, 0, TAU); ctx.ellipse(sd * 110, 18, 28, 24, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(150,70,50,0.75)'; ctx.beginPath(); ctx.ellipse(-30, 10, 34, 12, 0.1, 0, TAU); ctx.ellipse(60, -12, 22, 9, -0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.55)'; ctx.fillRect(-80, -12, 160, 5);
    ctx.fillStyle = '#b8744e'; ell(ctx, 128, 0, 8, 18); ctx.fill();
  });
}
function rockSugar(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    const r = rng(o.seed || 5), pts = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + r() * 0.4, rr = 34 + r() * 14; pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.85]); }
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    const g = ctx.createLinearGradient(-40, -40, 40, 40); g.addColorStop(0, 'rgba(255,248,220,0.95)'); g.addColorStop(0.5, 'rgba(236,206,140,0.85)'); g.addColorStop(1, 'rgba(190,150,80,0.9)');
    ctx.fillStyle = g; ctx.fill();
    for (let i = 0; i < pts.length; i += 2) { ctx.fillStyle = i % 4 ? 'rgba(255,255,255,0.4)' : 'rgba(160,110,40,0.25)'; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pts[4][0], pts[4][1]); ctx.lineTo(4, -2); ctx.stroke();
  });
}
function fishSauceBottle(ctx, x, y, s, rot = 0, o = {}) {
  const lv = o.level === undefined ? 0.7 : o.level;
  at(ctx, x, y, rot, s, s, () => {
    const shape = () => { ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-50, -150); ctx.quadraticCurveTo(-50, -196, -16, -214); ctx.lineTo(-14, -272); ctx.lineTo(14, -272); ctx.lineTo(16, -214); ctx.quadraticCurveTo(50, -196, 50, -150); ctx.lineTo(50, 0); ctx.closePath(); };
    shape(); ctx.fillStyle = 'rgba(200,220,210,0.25)'; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    const ly = -lv * 260, lg = ctx.createLinearGradient(-50, 0, 50, 0); lg.addColorStop(0, '#6a2a0a'); lg.addColorStop(0.35, '#c4621e'); lg.addColorStop(1, '#5a2008');
    ctx.fillStyle = lg; ctx.fillRect(-60, ly, 120, -ly + 4);
    ctx.fillStyle = 'rgba(255,200,120,0.5)'; ctx.fillRect(-60, ly, 120, 3);
    ctx.restore();
    ctx.strokeStyle = 'rgba(230,245,240,0.6)'; ctx.lineWidth = 3; shape(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-38, -190, 8, 176); ctx.fillRect(30, -150, 4, 120);
    // label
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(-50, -126, 100, 82); ctx.fillStyle = '#b8241e'; ctx.fillRect(-50, -126, 100, 16); ctx.fillRect(-50, -56, 100, 12);
    ctx.fillStyle = '#b8241e'; ctx.font = 'bold 19px BodySansBold'; ctx.textAlign = 'center'; ctx.fillText('NƯỚC MẮM', 0, -84);
    ctx.fillStyle = '#2a5a9a'; ctx.beginPath(); ctx.ellipse(-4, -68, 18, 6, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(12, -68); ctx.lineTo(24, -76); ctx.lineTo(24, -60); ctx.fill();
    // cap
    ctx.fillStyle = '#c3281e'; ctx.beginPath(); ctx.roundRect(-18, -300, 36, 32, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-12, -296, 6, 24);
  });
}
function marbling(ctx, r, x0, y0, w, h, n, col = 'rgba(255,240,235,0.7)', lw = 2.5) {
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sx = x0 + r() * w, sy = y0 + r() * h, len = 20 + r() * 50, a = (r() - 0.5) * 1.2;
    ctx.lineWidth = lw * (0.5 + r()); ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + Math.cos(a) * len * 0.3, sy + Math.sin(a) * len * 0.3 + (r() - 0.5) * 12, sx + Math.cos(a) * len * 0.7, sy + Math.sin(a) * len * 0.7 + (r() - 0.5) * 12, sx + Math.cos(a) * len, sy + Math.sin(a) * len); ctx.stroke();
  }
}
function beefBlock(ctx, x, y, s, rot = 0, o = {}) {
  const cut = clamp(o.cut || 0), xr = 160 - 230 * cut;
  at(ctx, x, y, rot, s, s, () => {
    ell(ctx, (xr - 160) / 2, 2, (xr + 160) / 2 + 10, 14); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    const shape = () => { ctx.beginPath(); ctx.moveTo(-160, -10); ctx.quadraticCurveTo(-170, -110, -120, -126); ctx.lineTo(xr, -122); ctx.lineTo(xr, 0); ctx.lineTo(-150, 0); ctx.closePath(); };
    shape(); const g = ctx.createLinearGradient(0, -130, 0, 0); g.addColorStop(0, '#d04a52'); g.addColorStop(0.5, '#b2303e'); g.addColorStop(1, '#7a1a26'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    ctx.fillStyle = '#f4e6d8'; ctx.beginPath(); ctx.moveTo(-170, -100); ctx.quadraticCurveTo(0, -112, xr + 10, -104); ctx.lineTo(xr + 10, -140); ctx.lineTo(-170, -140); ctx.fill();
    marbling(ctx, rng(8), -160, -96, xr + 160, 90, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-160, -100, xr + 160, 10);
    ctx.restore();
    // cut face (lighter, glossy)
    ctx.fillStyle = '#e46a74'; ctx.beginPath(); ctx.moveTo(xr, -122); ctx.lineTo(xr + 18, -116); ctx.lineTo(xr + 18, 2); ctx.lineTo(xr, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f6e8dc'; ctx.fillRect(xr, -122, 18, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(xr + 3, -100, 3, 90);
  });
}
function beefSlice(ctx, x, y, s, rot = 0, o = {}) {
  const cook = clamp(o.cook || 0), al = o.alpha === undefined ? 1 : o.alpha, curl = o.curl || 0;
  at(ctx, x, y, rot, s, s * (1 - curl * 0.25), () => {
    ctx.globalAlpha *= al;
    const r = rng((o.seed || 1) * 31), pts = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = 1 + (r() - 0.5) * 0.18; pts.push([Math.cos(a) * 75 * rr, Math.sin(a) * 46 * rr + Math.cos(a * 2) * 6]); }
    const path = (sc = 1) => { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const p = pts[i % 10], q = pts[(i + 1) % 10]; const mx = (p[0] + q[0]) / 2 * sc, my = (p[1] + q[1]) / 2 * sc; i ? ctx.quadraticCurveTo(p[0] * sc, p[1] * sc, mx, my) : ctx.moveTo(mx, my); } ctx.closePath(); };
    // cooked base
    path(); const cg = ctx.createLinearGradient(-70, -40, 70, 40); cg.addColorStop(0, mixc('#ee8a96', '#b39488', cook)); cg.addColorStop(1, mixc('#c84a5c', '#7e6256', cook)); ctx.fillStyle = cg; ctx.fill();
    // raw pink centre shrinking as it cooks (edges cook first)
    if (cook > 0.02 && cook < 0.98) {
      ctx.save(); ctx.globalAlpha *= 0.9; path(1 - cook * 0.95);
      const rg = ctx.createLinearGradient(-70, -40, 70, 40); rg.addColorStop(0, '#f0909c'); rg.addColorStop(1, '#cf5064'); ctx.fillStyle = rg; ctx.fill(); ctx.restore();
    }
    ctx.save(); path(); ctx.clip();
    marbling(ctx, r, -70, -40, 120, 80, 6, rgba(mixc('#fff2ee', '#e8dccc', cook), 0.7), 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-20, -18, 40, 9, -0.2, 0, TAU); ctx.fill();
    ctx.restore();
    path(); ctx.strokeStyle = rgba(mixc('#f6b0b8', '#8a6a5c', cook), 0.7); ctx.lineWidth = 3; ctx.stroke();
  });
}
function noodleSheet(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.beginPath(); ctx.moveTo(-110, -70);
    for (let i = 0; i <= 10; i++) ctx.lineTo(-110 + i * 22, -75 + Math.sin(i * 1.7) * 5);
    for (let i = 0; i <= 8; i++) ctx.lineTo(110 + Math.sin(i * 1.3) * 5, -75 + i * 18.75);
    for (let i = 10; i >= 0; i--) ctx.lineTo(-110 + i * 22, 75 + Math.sin(i * 1.1) * 5);
    ctx.closePath();
    const g = ctx.createLinearGradient(-110, -75, 110, 75); g.addColorStop(0, 'rgba(255,253,246,0.95)'); g.addColorStop(1, 'rgba(232,226,210,0.9)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(200,190,170,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-30, -30, 60, 12, -0.3, 0, TAU); ctx.fill();
  });
}
function noodleBundle(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createRadialGradient(-20, -20, 10, 0, 0, 100); g.addColorStop(0, '#fffcf2'); g.addColorStop(1, '#e2d6bc');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 100, 62, 0, 0, TAU); ctx.fill();
    const r = rng(o.seed || 9); ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const y0 = (r() - 0.5) * 100, a = (r() - 0.5) * 0.6; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(200,185,150,0.6)';
      ctx.beginPath(); ctx.moveTo(-92, y0); ctx.bezierCurveTo(-30, y0 + a * 80 - 20, 30, y0 - a * 80 + 20, 92, y0 + (r() - 0.5) * 20); ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = '#fcf8ee'; ctx.stroke();
    }
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 100, 62, 0, 0, TAU); ctx.clip();
    const sh = ctx.createRadialGradient(0, 0, 60, 0, 0, 104); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(120,90,50,0.35)'); ctx.fillStyle = sh; ctx.fillRect(-110, -70, 220, 140);
    ctx.restore();
  });
}
function bambooStrainer(ctx, x, y, s, rot = 0, o = {}) {
  const t = o.t || 0, nd = o.noodles === undefined ? 1 : o.noodles, wet = o.wet === undefined ? 1 : o.wet;
  at(ctx, x, y, rot, s, s, () => {
    // handle
    const hg = ctx.createLinearGradient(0, -10, 0, 10); hg.addColorStop(0, '#e2c27a'); hg.addColorStop(1, '#8a6a30');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(-480, -16, 400, 18, 9); ctx.fill();
    ctx.strokeStyle = '#7a5a26'; ctx.lineWidth = 3; for (const nx of [-420, -300, -180]) { ctx.beginPath(); ctx.moveTo(nx, -16); ctx.lineTo(nx, 2); ctx.stroke(); }
    ctx.strokeStyle = '#9a9ca0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-100, -8); ctx.lineTo(-82, -8); ctx.stroke();
    // basket (wire mesh cone)
    const basket = () => { ctx.beginPath(); ctx.moveTo(-85, -10); ctx.quadraticCurveTo(-70, 110, 0, 118); ctx.quadraticCurveTo(70, 110, 85, -10); ctx.closePath(); };
    if (nd > 0) { basket(); ctx.fillStyle = rgba('#f6efdc', 0.9 * nd); ctx.fill(); }
    ctx.save(); basket(); ctx.clip();
    if (nd > 0) { ctx.strokeStyle = rgba('#fffaf0', nd); ctx.lineWidth = 5; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(-80, i * 10); ctx.bezierCurveTo(-30, i * 10 - 14, 30, i * 10 + 14, 80, i * 10 - 4); ctx.stroke(); } }
    ctx.strokeStyle = 'rgba(70,60,40,0.75)'; ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(i * 9, -10); ctx.lineTo(i * 4, 120); ctx.stroke(); }
    for (let j = 0; j < 12; j++) { ctx.beginPath(); ctx.moveTo(-90, j * 10); ctx.lineTo(90, j * 10); ctx.stroke(); }
    ctx.restore();
    basket(); ctx.strokeStyle = '#6a5428'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 8; ell(ctx, 0, -10, 85, 22); ctx.stroke();
    if (nd > 0) { ctx.fillStyle = rgba('#fbf6e8', nd); ctx.beginPath(); ctx.ellipse(0, -14, 72 * nd, 18 + 12 * nd, 0, Math.PI, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(210,195,160,0.6)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-30 + i * 12, -10, 20, 3.6, 5.2); ctx.stroke(); } }
    // drips
    if (wet > 0) for (let i = 0; i < 6; i++) { const ph = (t * 1.6 + i * 0.37) % 1, dx = -50 + i * 20; ctx.fillStyle = `rgba(230,240,255,${0.8 * wet * (1 - ph)})`; ell(ctx, dx, 118 + ph * 220, 4, 7); ctx.fill(); }
  });
}
// ---------- herbs ----------
function basilLeaf(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(0, -20, 0, 20); g.addColorStop(0, '#5fae3e'); g.addColorStop(1, '#2c6e24');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-35, 0); ctx.quadraticCurveTo(-10, -26, 35, 0); ctx.quadraticCurveTo(-10, 26, -35, 0); ctx.fill();
    ctx.strokeStyle = '#9ad06a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(32, 0); ctx.stroke();
    ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-20 + i * 14, 0); ctx.lineTo(-10 + i * 14, -10); ctx.moveTo(-20 + i * 14, 0); ctx.lineTo(-10 + i * 14, 10); ctx.stroke(); }
    ctx.strokeStyle = '#6a2a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-35, 0); ctx.lineTo(-46, 3); ctx.stroke();
  });
}
function sawtooth(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = '#3e8a30'; ctx.beginPath(); ctx.moveTo(-60, 0);
    for (let i = 0; i <= 12; i++) { const u = i / 12, w = Math.sin(u * Math.PI) * 16 + 4; ctx.lineTo(-60 + u * 120, -w - (i % 2) * 4); }
    for (let i = 12; i >= 0; i--) { const u = i / 12, w = Math.sin(u * Math.PI) * 16 + 4; ctx.lineTo(-60 + u * 120, w + (i % 2) * 4); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a6d880'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(58, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.ellipse(-10, -6, 40, 4, 0, 0, TAU); ctx.fill();
  });
}
function beanSprout(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(190,190,160,0.7)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-34, 4); ctx.quadraticCurveTo(0, -12, 30, 0); ctx.stroke();
    ctx.strokeStyle = '#fbfaf0'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = '#e8e4d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(30, 0); ctx.quadraticCurveTo(44, 4, 46, 14); ctx.stroke();
    ctx.fillStyle = '#e6d860'; ctx.beginPath(); ctx.ellipse(-36, 5, 8, 6, 0.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#b6c84a'; ctx.beginPath(); ctx.ellipse(-40, 3, 4, 3, 0.4, 0, TAU); ctx.fill();
  });
}
function limeWedge(ctx, x, y, s, rot = 0, o = {}) {
  const sq = o.squeeze || 0;
  at(ctx, x, y, rot, s, s * (1 - sq * 0.4), () => {
    if (o.view === 'top') {
      ctx.fillStyle = '#3f8a2a'; ctx.beginPath(); ctx.ellipse(0, 0, 45, 22, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7cbf3a'; ctx.beginPath(); ctx.ellipse(0, -4, 40, 12, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#d8eca0'; ctx.beginPath(); ctx.ellipse(0, -6, 36, 7, 0, 0, TAU); ctx.fill();
      return;
    }
    ctx.fillStyle = '#3a7a24'; ctx.beginPath(); ctx.arc(0, 0, 45, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f2f6dc'; ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a0 = i / 5 * Math.PI + 0.06, a1 = (i + 1) / 5 * Math.PI - 0.06;
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 38); g.addColorStop(0, '#e8f2a8'); g.addColorStop(1, '#a6d24a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(Math.cos((a0 + a1) / 2) * 4, Math.sin((a0 + a1) / 2) * 4); ctx.arc(0, 0, 36, a0, a1); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 5; i++) { const a = (i + 0.5) / 5 * Math.PI; ell(ctx, Math.cos(a) * 22, Math.sin(a) * 22, 3, 2); ctx.fill(); }
    if (sq > 0) for (let i = 0; i < 8; i++) { const ph = ((o.t || 0) * 2 + i / 8) % 1; ctx.fillStyle = `rgba(230,250,190,${0.9 * sq * (1 - ph)})`; ell(ctx, (i - 4) * 9, 50 + ph * 160, 3.5, 5); ctx.fill(); }
  });
}
function chiliSlice(ctx, x, y, s) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = '#d42a1e'; ell(ctx, 0, 0, 13, 13); ctx.fill();
    ctx.fillStyle = '#f2e6c0'; ell(ctx, 0, 0, 8, 8); ctx.fill();
    ctx.fillStyle = '#f6d860'; for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ell(ctx, Math.cos(a) * 4, Math.sin(a) * 4, 2, 1.4); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ell(ctx, -5, -7, 4, 2); ctx.fill();
  });
}
function herbPlate(ctx, x, y, s, o = {}) {
  const v = (n) => (o[n] === undefined ? 1 : o[n]);
  at(ctx, x, y, o.rot || 0, s, s, () => {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, 10, 14, 234, 234); ctx.fill();
    const pg = ctx.createRadialGradient(-60, -60, 20, 0, 0, 230); pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#d6d9de'); ctx.fillStyle = pg; ell(ctx, 0, 0, 230, 230); ctx.fill();
    ctx.strokeStyle = COL.cobalt; ctx.lineWidth = 4; ell(ctx, 0, 0, 214, 214); ctx.stroke();
    const r = rng(o.seed || 21);
    for (let i = 0; i < Math.round(36 * v('sprouts')); i++) beanSprout(ctx, 40 + (r() - 0.5) * 140, 40 + (r() - 0.5) * 120, 1, r() * TAU);
    for (let i = 0; i < Math.round(6 * v('sawtooth')); i++) sawtooth(ctx, -70 + (r() - 0.5) * 60, 60 + (r() - 0.5) * 90, 1, -0.6 + (r() - 0.5) * 0.8);
    for (let sp = 0; sp < Math.round(3 * v('basil')); sp++) {
      const cx = -60 + sp * 50 + (r() - 0.5) * 30, cy = -80 + (r() - 0.5) * 50;
      ctx.strokeStyle = '#5a2a4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy + 60); ctx.lineTo(cx, cy - 40); ctx.stroke();
      for (let q = 0; q < 6; q++) basilLeaf(ctx, cx + (q % 2 ? 24 : -24), cy + 40 - q * 16, 0.9, q % 2 ? -0.4 : Math.PI + 0.4);
    }
    if (v('lime') > 0) { limeWedge(ctx, 120, -70, 0.9, -0.5); limeWedge(ctx, 150, -10, 0.9, 0.3); }
    if (v('chili') > 0) { ctx.fillStyle = '#f2f2ee'; ell(ctx, 110, 110, 46, 46); ctx.fill(); ctx.strokeStyle = COL.cobalt; ctx.lineWidth = 2; ctx.stroke(); for (let i = 0; i < 9; i++) chiliSlice(ctx, 110 + (r() - 0.5) * 50, 110 + (r() - 0.5) * 50, 0.9); }
  });
}
function quay(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    for (const dy of [-14, 14]) {
      const g = ctx.createLinearGradient(0, dy - 18, 0, dy + 18); g.addColorStop(0, '#f2b860'); g.addColorStop(0.5, '#c87a2a'); g.addColorStop(1, '#8a4a16');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-135, dy - 18, 270, 36, 18); ctx.fill();
      const r = rng(dy + 50); for (let i = 0; i < 26; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(255,220,140,0.45)' : 'rgba(110,50,10,0.35)'; ell(ctx, -125 + r() * 250, dy + (r() - 0.5) * 26, 3 + r() * 6, 2 + r() * 3); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(110,50,10,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-120, 0); ctx.lineTo(120, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,240,200,0.35)'; ctx.fillRect(-110, -26, 220, 4);
  });
}
function vinegarGarlicJar(ctx, x, y, s, o = {}) {
  at(ctx, x, y, 0, s, s, () => {
    const jar = () => { ctx.beginPath(); ctx.moveTo(-50, -110); ctx.lineTo(-54, -10); ctx.quadraticCurveTo(-54, 0, -42, 0); ctx.lineTo(42, 0); ctx.quadraticCurveTo(54, 0, 54, -10); ctx.lineTo(50, -110); ctx.closePath(); };
    jar(); ctx.fillStyle = 'rgba(210,230,220,0.3)'; ctx.fill();
    ctx.save(); jar(); ctx.clip();
    ctx.fillStyle = 'rgba(236,214,140,0.75)'; ctx.fillRect(-60, -84, 120, 90);
    const r = rng(33);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = 'rgba(250,246,230,0.95)'; ctx.beginPath(); ctx.ellipse(-40 + r() * 80, -70 + r() * 66, 8, 5, r() * 3, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 8; i++) chiliSlice(ctx, -40 + r() * 80, -70 + r() * 66, 0.55);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(-42, -104, 7, 96);
    ctx.restore();
    ctx.strokeStyle = 'rgba(230,240,240,0.7)'; ctx.lineWidth = 3; jar(); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,240,240,0.8)'; ell(ctx, 0, -110, 50, 9); ctx.stroke();
    // little spoon
    ctx.strokeStyle = '#c0c4c8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(14, -70); ctx.lineTo(34, -150); ctx.stroke();
  });
}
function porcelainSpoon(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(6, 8, 44, 32, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f8f8f6'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(-40, -32, 0, -30); ctx.quadraticCurveTo(28, -28, 44, -10); ctx.lineTo(170, -12); ctx.quadraticCurveTo(178, -6, 170, 0); ctx.lineTo(44, 10); ctx.quadraticCurveTo(28, 28, 0, 30); ctx.quadraticCurveTo(-40, 32, -40, 0); ctx.fill();
    const ig = ctx.createRadialGradient(-6, -6, 4, 0, 0, 34); ig.addColorStop(0, '#ffffff'); ig.addColorStop(1, '#cfd3da');
    ctx.fillStyle = ig; ell(ctx, 0, 0, 32, 23); ctx.fill();
    if (o.fill) { ctx.fillStyle = rgba('#d98f32', 0.85 * o.fill); ell(ctx, 0, 0, 28 * (0.6 + 0.4 * o.fill), 19 * (0.6 + 0.4 * o.fill)); ctx.fill(); ctx.fillStyle = 'rgba(255,240,200,0.6)'; ell(ctx, -8, -6, 8, 4); ctx.fill(); }
    ctx.strokeStyle = COL.cobalt; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(60, -6); ctx.lineTo(160, -8); ctx.stroke();
    ctx.fillStyle = COL.cobalt; ell(ctx, 120, -3, 5, 3); ctx.fill();
  });
}
function teaspoon(ctx, x, y, s, rot = 0) {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(0, -10, 0, 10); g.addColorStop(0, '#f6f6f8'); g.addColorStop(0.5, '#a0a4aa'); g.addColorStop(1, '#5a5e64');
    ctx.fillStyle = g; ell(ctx, 0, 0, 16, 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(80, -4); ctx.quadraticCurveTo(86, 0, 80, 4); ctx.lineTo(14, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, -4, -4, 5, 3); ctx.fill();
  });
}
function chopsticksPair(ctx, x, y, s, rot = 0, spread = 0) {
  at(ctx, x, y, rot, s, s, () => {
    for (const sd of [-1, 1]) {
      at(ctx, 0, sd * 3, sd * spread * 0.5, 1, 1, () => {
        const g = ctx.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, '#e6b878'); g.addColorStop(1, '#93622e');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -2.5); ctx.lineTo(400, -7); ctx.lineTo(400, 7); ctx.lineTo(0, 2.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5a3418'; ctx.fillRect(330, -6.5, 8, 13);
        ctx.fillStyle = 'rgba(255,240,210,0.5)'; ctx.fillRect(20, -2.5, 360, 1.5);
      });
    }
  });
}
function icedTea(ctx, x, y, s, o = {}) {
  const lv = o.level === undefined ? 0.8 : o.level, t = o.t || 0;
  at(ctx, x, y, 0, s, s, () => {
    const glassP = () => { ctx.beginPath(); ctx.moveTo(-56, -170); ctx.lineTo(-44, -4); ctx.quadraticCurveTo(-44, 0, -38, 0); ctx.lineTo(38, 0); ctx.quadraticCurveTo(44, 0, 44, -4); ctx.lineTo(56, -170); ctx.closePath(); };
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ell(ctx, 0, 0, 52, 9); ctx.fill();
    glassP(); ctx.fillStyle = 'rgba(220,235,235,0.18)'; ctx.fill();
    ctx.save(); glassP(); ctx.clip();
    const ly = -12 - lv * 150;
    const tg = ctx.createLinearGradient(-50, 0, 50, 0); tg.addColorStop(0, 'rgba(176,130,40,0.9)'); tg.addColorStop(0.4, 'rgba(226,184,90,0.85)'); tg.addColorStop(1, 'rgba(150,104,30,0.9)');
    ctx.fillStyle = tg; ctx.fillRect(-60, ly, 120, -ly);
    for (let i = 0; i < 5; i++) { const cx = -30 + (i % 3) * 30 + Math.sin(t + i) * 2, cy = ly + 14 + Math.floor(i / 3) * 36; ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.roundRect(cx - 16, cy - 14, 32, 28, 6); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,240,200,0.6)'; ctx.fillRect(-60, ly, 120, 3);
    // ribs
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 12, -168); ctx.lineTo(i * 9.6, -2); ctx.stroke(); }
    // condensation
    const r = rng(61); for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(ctx, (r() - 0.5) * 96, -10 - r() * 150, 1.5 + r() * 2.5, 2 + r() * 3); ctx.fill(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(235,245,245,0.75)'; ctx.lineWidth = 3; glassP(); ctx.stroke(); ell(ctx, 0, -170, 56, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.moveTo(-46, -160); ctx.lineTo(-38, -160); ctx.lineTo(-32, -10); ctx.lineTo(-38, -10); ctx.fill();
  });
}
// ---------- ladle ----------
// origin = centre of the cup lip. tip rotates the cup (positive = pours toward +x). Handle leaves the cup's
// -x lip edge in direction rot (0 = straight up, negative leans to -x).
function ladleGrip(x, y, s, rot = 0, o = {}) {
  const len = o.len || 430, tip = o.tip || 0, a = rot2(-58, 0, tip);
  return [x + (a[0] + Math.sin(rot) * len) * s, y + (a[1] - Math.cos(rot) * len) * s];
}
function ladlePour(x, y, s, o = {}) { const p = rot2(62, 6, o.tip || 0); return [x + p[0] * s, y + p[1] * s]; }
function ladle(ctx, x, y, s, rot = 0, o = {}) {
  const len = o.len || 430, tip = o.tip || 0, fillL = o.fill || 0;
  at(ctx, x, y, 0, s, s, () => {
    const a = rot2(-58, 0, tip), e = [a[0] + Math.sin(rot) * len, a[1] - Math.cos(rot) * len];
    // handle
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4a4c50'; ctx.lineWidth = 15; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    ctx.strokeStyle = '#c6c8cc'; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0] - 2, a[1] - 2); ctx.lineTo(e[0] - 2, e[1] - 2); ctx.stroke();
    ctx.fillStyle = '#3a3c40'; ell(ctx, e[0], e[1], 10, 10); ctx.fill();
    at(ctx, 0, 0, tip, 1, 1, () => {
      // cup
      ctx.beginPath(); ctx.ellipse(0, 0, 62, 18, 0, 0, Math.PI); ctx.bezierCurveTo(-62, 50, -30, 62, 0, 62); ctx.bezierCurveTo(30, 62, 62, 50, 62, 0); ctx.closePath();
      ctx.beginPath(); ctx.moveTo(-62, 0); ctx.bezierCurveTo(-62, 46, -32, 62, 0, 62); ctx.bezierCurveTo(32, 62, 62, 46, 62, 0); ctx.ellipse(0, 0, 62, 18, 0, 0, Math.PI, false); ctx.closePath();
      ctx.fillStyle = metalGrad(ctx, -62, 62, 1); ctx.fill();
      ell(ctx, 0, 0, 62, 18); ctx.fillStyle = '#55575c'; ctx.fill();
      if (fillL > 0) { ell(ctx, 0, 2, 56 * fillL + 4, 15 * fillL + 1); const bg = ctx.createLinearGradient(-50, 0, 50, 0); bg.addColorStop(0, '#f2c068'); bg.addColorStop(1, '#a8601e'); ctx.fillStyle = bg; ctx.fill(); ctx.fillStyle = 'rgba(255,250,220,0.6)'; ell(ctx, -16, -2, 14, 3); ctx.fill(); }
      ctx.strokeStyle = '#e8e6e2'; ctx.lineWidth = 4; ell(ctx, 0, 0, 62, 18); ctx.stroke();
    });
  });
}
function brothStream(ctx, x0, y0, x1, y1, w = 26, t = 0) {
  ctx.save();
  const cx = x0 + (x1 - x0) * 0.15, cy = y0 + (y1 - y0) * 0.05;
  const path = (off, ww) => { ctx.beginPath(); ctx.moveTo(x0 + off, y0); ctx.quadraticCurveTo(cx + off * 0.7, cy, x1 + off * 0.4, y1); };
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(150,80,20,0.55)'; ctx.lineWidth = w * 1.1; path(0); ctx.stroke();
  const g = ctx.createLinearGradient(x0 - w, 0, x0 + w, 0); g.addColorStop(0, 'rgba(240,170,70,0.85)'); g.addColorStop(0.5, 'rgba(255,214,130,0.9)'); g.addColorStop(1, 'rgba(200,120,40,0.85)');
  ctx.strokeStyle = g; ctx.lineWidth = w * 0.8; path(0); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,225,0.8)'; ctx.lineWidth = w * 0.15; path(-w * 0.18); ctx.stroke();
  // travelling glints
  for (let i = 0; i < 6; i++) {
    const u = (t * 2.2 + i / 6) % 1, ix = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, iy = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1;
    glow(ctx, ix, iy, w * 0.9, 'rgba(255,240,190,0.9)', 0.6);
  }
  // splash ring
  ctx.strokeStyle = 'rgba(255,230,170,0.6)'; ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) { const ph = (t * 3 + i * 0.5) % 1; ell(ctx, x1, y1, w * (0.8 + ph * 2.2), w * (0.25 + ph * 0.7)); ctx.globalAlpha = 1 - ph; ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.restore();
}
// ---------- night time-lapse ----------
function moonAndStars(ctx, t, k, o = {}) {
  ctx.save();
  if (o.sky !== false) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mixc('#050814', '#141a3c', k)); g.addColorStop(0.6, mixc('#0b1230', '#2c3466', k)); g.addColorStop(1, mixc('#141c40', '#6a5a86', k));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // stars rotate around a pole above the frame
  const r = rng(808), pole = [W * 0.5, -400], ang = k * 0.5;
  for (let i = 0; i < 160; i++) {
    const sx = r() * W * 1.6 - W * 0.3, sy = r() * H * 0.8, b = r(), tw = 0.6 + 0.4 * Math.sin(t * (2 + b * 3) + i);
    const dx = sx - pole[0], dy = sy - pole[1], d = Math.hypot(dx, dy), a0 = Math.atan2(dy, dx);
    const a = a0 + ang, px = pole[0] + Math.cos(a) * d, py = pole[1] + Math.sin(a) * d;
    const al = (0.35 + 0.65 * b) * tw * (1 - k * 0.8);
    if (o.trails) { ctx.strokeStyle = `rgba(220,230,255,${al * 0.5 * o.trails})`; ctx.lineWidth = 1 + b * 1.5; ctx.beginPath(); ctx.arc(pole[0], pole[1], d, a - 0.25 * o.trails, a); ctx.stroke(); }
    ctx.fillStyle = `rgba(235,240,255,${al})`; ell(ctx, px, py, 1 + b * 2.2, 1 + b * 2.2); ctx.fill();
  }
  // moon arc
  const ma = lerp(-2.5, -0.6, k), mx = W * 0.5 + Math.cos(ma) * 700, my = 1150 + Math.sin(ma) * 900;
  glow(ctx, mx, my, 360, 'rgba(200,215,255,0.6)', 0.6 * (1 - k * 0.5));
  const mg = ctx.createRadialGradient(mx - 20, my - 20, 10, mx, my, 70); mg.addColorStop(0, '#fffdf2'); mg.addColorStop(1, '#d6dae6');
  ctx.fillStyle = mg; ell(ctx, mx, my, 70, 70); ctx.fill();
  ctx.fillStyle = 'rgba(150,160,185,0.35)'; for (const [cx, cy, cr] of [[-20, -10, 16], [18, 14, 12], [6, -30, 8], [-10, 30, 10]]) { ell(ctx, mx + cx, my + cy, cr, cr); ctx.fill(); }
  ctx.restore();
}
function clockFace(ctx, x, y, R, hours, o = {}) {
  at(ctx, x, y, 0, 1, 1, () => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ell(ctx, R * 0.06, R * 0.08, R * 1.1, R * 1.1); ctx.fill();
    const wg = ctx.createLinearGradient(-R, -R, R, R); wg.addColorStop(0, '#a8703a'); wg.addColorStop(1, '#4a2a12');
    ctx.fillStyle = wg; ell(ctx, 0, 0, R * 1.1, R * 1.1); ctx.fill();
    const fg = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R); fg.addColorStop(0, '#fffaf0'); fg.addColorStop(1, '#e2d6bc');
    ctx.fillStyle = fg; ell(ctx, 0, 0, R, R); ctx.fill();
    ctx.fillStyle = '#2a2018'; ctx.font = `bold ${R * 0.2}px TitleSerif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - Math.PI / 2; ctx.fillText(String(i), Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78); }
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU; ctx.strokeStyle = '#3a3028'; ctx.lineWidth = i % 5 ? 1.5 : 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); ctx.lineTo(Math.cos(a) * R * (i % 5 ? 0.88 : 0.85), Math.sin(a) * R * (i % 5 ? 0.88 : 0.85)); ctx.stroke(); }
    ctx.textBaseline = 'alphabetic';
    const hand = (a, len, w, col, alpha = 1) => { ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-Math.cos(a) * len * 0.15, -Math.sin(a) * len * 0.15); ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len); ctx.stroke(); ctx.globalAlpha = 1; };
    const ha = (hours % 12) / 12 * TAU - Math.PI / 2, ma = (hours % 1) * TAU - Math.PI / 2, blur = o.blur || 0;
    if (blur > 0) for (let i = 1; i <= 6; i++) hand(ma - i * blur * 0.12, R * 0.75, R * 0.04, '#2a2018', 0.15);
    hand(ha, R * 0.5, R * 0.07, '#1a1410'); hand(ma, R * 0.75, R * 0.04, '#1a1410');
    ctx.fillStyle = '#b8241e'; ell(ctx, 0, 0, R * 0.05, R * 0.05); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.45, R * 0.4, R * 0.16, -0.6, 0, TAU); ctx.fill();
  });
}

// =====================================================================================
// EFFECTS
// =====================================================================================
function richSteam(ctx, t, seed, x, y, w, h, alpha = 0.6, o = {}) {
  if (alpha <= 0) return;
  const n = o.n || 14, sp = puffs(o.col || '#fff7ec'), r = rng(seed * 13 + 7), drift = o.drift || 0;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < n; i++) {
    const ph0 = r(), spd = (150 + r() * 110) / Math.max(200, h), xo = (r() - 0.5) * w * 0.8, wf = 0.6 + r() * 1.4, wp = r() * TAU, v = sp[i % 3];
    const ph = (t * spd + ph0) % 1;
    const py = y - ph * h, sz = w * (0.55 + ph * 1.5) * (0.8 + 0.4 * ((i * 7) % 5) / 4);
    const px = x + xo * (1 - ph * 0.4) + Math.sin(t * wf + wp + ph * 5) * w * 0.25 * ph + drift * ph * h;
    const a = alpha * Math.min(1, ph / 0.12) * Math.pow(1 - ph, 1.3) * 0.9;
    if (a <= 0.003) continue;
    ctx.globalAlpha = a;
    ctx.drawImage(v, px - sz / 2, py - sz / 2, sz, sz);
  }
  ctx.restore();
}
function slurpVortex(ctx, t, x, y, s, k) {
  if (k <= 0) return;
  at(ctx, x, y, 0, s, s, () => {
    const Hh = 620 * Math.min(1, k * 1.4), n = 9;
    // swirling air
    for (let j = 0; j < 3; j++) {
      ctx.strokeStyle = `rgba(255,248,230,${0.18 * k})`; ctx.lineWidth = 6 - j * 1.5; ctx.beginPath();
      for (let q = 0; q <= 40; q++) { const u = q / 40, rr = 24 + 300 * Math.pow(u, 1.6), a = u * 9 - t * 9 + j * 2.1; const px = Math.cos(a) * rr * 1.15, py = u * Hh - Math.sin(a) * rr * 0.22; q ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    // noodle strands, back halves first then front
    for (const front of [false, true]) {
      for (let i = 0; i < n; i++) {
        ctx.lineCap = 'round'; let prev = null;
        for (let q = 0; q <= 50; q++) {
          const u = q / 50, rr = 10 + 260 * Math.pow(u, 1.7) * k, a = u * 7 - t * 14 + i / n * TAU;
          const isF = Math.sin(a) < 0, px = Math.cos(a) * rr, py = u * Hh - Math.sin(a) * rr * 0.24;
          if (prev && isF === front) {
            ctx.strokeStyle = front ? '#fbf3df' : 'rgba(214,190,140,0.75)'; ctx.lineWidth = (front ? 11 : 9) * (0.55 + u * 0.6);
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(px, py); ctx.stroke();
            if (front) { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(prev[0] - 2, prev[1] - 2); ctx.lineTo(px - 2, py - 2); ctx.stroke(); }
          }
          prev = [px, py];
        }
      }
    }
    // flying droplets + scallion bits
    const r = rng(616);
    for (let i = 0; i < 30; i++) {
      const u = (r() + t * (0.8 + r())) % 1, a = r() * TAU + t * 10, rr = 40 + 300 * Math.pow(1 - u, 1.5) * k;
      const px = Math.cos(a) * rr, py = (1 - u) * Hh - Math.sin(a) * rr * 0.24, green = i % 4 === 0;
      ctx.fillStyle = green ? '#5fae3e' : `rgba(255,214,140,${0.85 * k})`; ell(ctx, px, py, green ? 6 : 4, green ? 5 : 4); ctx.fill();
    }
  });
}
function soundRings(ctx, x, y, k, o = {}) {
  const n = o.n || 4, R = o.R || 420, col = o.col || '255,240,200', dir = o.dir || 0, spread = o.spread === undefined ? TAU : o.spread;
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const ph = clamp(k * 1.6 - i * 0.2); if (ph <= 0 || ph >= 1) continue;
    const rr = R * ease.out(ph), a = (1 - ph);
    const a0 = spread >= TAU - 0.01 ? 0 : dir - spread / 2, a1 = spread >= TAU - 0.01 ? TAU : dir + spread / 2;
    ctx.strokeStyle = `rgba(${col},${a * 0.35})`; ctx.lineWidth = 22 * a + 4; ctx.beginPath(); ctx.arc(x, y, rr, a0, a1); ctx.stroke();
    ctx.strokeStyle = `rgba(${col},${a * 0.9})`; ctx.lineWidth = 8 * a + 2; ctx.beginPath(); ctx.arc(x, y, rr, a0, a1); ctx.stroke();
  }
  ctx.restore();
}
function steamFog(ctx, x, y, w, h, a, t = 0) {
  if (a <= 0) return;
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, `rgba(236,240,244,${0.92 * a})`); g.addColorStop(1, `rgba(214,222,230,${0.8 * a})`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const sp = puffs('#ffffff'), r = rng(321);
  ctx.globalAlpha = 0.5 * a;
  for (let i = 0; i < 4; i++) { const sz = Math.max(w, h) * (0.8 + r() * 0.6), px = x + (r() * w) + Math.sin(t * 0.7 + i) * w * 0.15; ctx.drawImage(sp[i % 3], px - sz / 2, y + r() * h - sz / 2, sz, sz); }
  ctx.globalAlpha = 1;
  // condensation droplets
  for (let i = 0; i < 18; i++) { const px = x + r() * w, py = y + r() * h, rr = 1.5 + r() * 3.5; ctx.fillStyle = `rgba(255,255,255,${0.75 * a})`; ell(ctx, px, py, rr, rr); ctx.fill(); ctx.fillStyle = `rgba(120,130,140,${0.35 * a})`; ell(ctx, px + rr * 0.3, py + rr * 0.4, rr * 0.5, rr * 0.4); ctx.fill(); }
  // one droplet trail clearing the fog
  const tr = (t * 0.25) % 1; ctx.fillStyle = `rgba(30,25,20,${0.45 * a})`; ctx.fillRect(x + w * 0.62, y, 3, h * tr);
  ctx.restore();
}
const fogGlassesFn = (a, t = 0) => (ctx, cx, cy) => steamFog(ctx, cx - 50, cy - 30, 100, 60, a, t);
function sunglasses(ctx, x, y, s, rot = 0, o = {}) {
  at(ctx, x, y, rot, s, s, () => {
    ctx.strokeStyle = '#121212'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-120, -14); ctx.lineTo(-170, -22); ctx.moveTo(120, -14); ctx.lineTo(170, -22); ctx.stroke();
    ctx.fillStyle = '#121212';
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.roundRect(sx * 70 - 52, -28, 104, 56, 22); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(sx * 70 - 46, -23, 92, 46, 18); ctx.clip();
      const lg = ctx.createLinearGradient(0, -25, 0, 25); lg.addColorStop(0, '#3a2a20'); lg.addColorStop(1, '#0c0a08');
      ctx.fillStyle = lg; ctx.fillRect(sx * 70 - 50, -30, 100, 60);
      if (o.fog) steamFog(ctx, sx * 70 - 50, -30, 100, 60, o.fog, o.t || 0);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(sx * 70 - 40, -20); ctx.lineTo(sx * 70 - 10, -20); ctx.lineTo(sx * 70 - 34, 18); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.fillStyle = '#121212';
    }
    ctx.fillRect(-20, -10, 40, 9);
  });
}

// =====================================================================================
// PEOPLE EXTRAS
// =====================================================================================
const PEOPLE = require('./people');
function knitBand(ctx, col, x0, y0, x1, y1, n) {
  ctx.strokeStyle = rgba(shade(col, -0.35), 0.55); ctx.lineWidth = 1.6;
  for (let i = 1; i < n; i++) { const u = i / n; ctx.beginPath(); ctx.moveTo(lerp(x0, x1, u), y0); ctx.lineTo(lerp(x0, x1, u) + 2, y1); ctx.stroke(); }
}
function scarfColor(col) { return col && col[0] === '#' ? col : '#c8423a'; }
// generic wrap: origin = neck centre, ~60 wide; tail hangs on +x side (flip -> -x)
function scarf(ctx, x, y, s, color = '#c8423a', o = {}) {
  const c = scarfColor(color), tail = o.tail === undefined ? 1 : o.tail, fl = o.flip ? -1 : 1, sw = o.sway || 0;
  at(ctx, x, y, o.rot || 0, s * fl, s, () => {
    // tail (behind the knot)
    if (tail > 0) {
      const L = 110 * tail;
      ctx.fillStyle = shade(c, -0.15); ctx.beginPath(); ctx.moveTo(6, 10); ctx.lineTo(30, 12); ctx.quadraticCurveTo(34 + sw * 10, 10 + L * 0.5, 30 + sw * 20, 10 + L); ctx.lineTo(8 + sw * 20, 14 + L); ctx.quadraticCurveTo(10 + sw * 8, 10 + L * 0.5, 6, 10); ctx.fill();
      ctx.strokeStyle = rgba(shade(c, -0.4), 0.5); ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(6 + i * 6, 12); ctx.lineTo(8 + i * 5.5 + sw * 20, 12 + L); ctx.stroke(); }
      ctx.strokeStyle = shade(c, -0.1); ctx.lineWidth = 2.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(9 + i * 4 + sw * 20, 12 + L); ctx.lineTo(9 + i * 4 + sw * 22, 24 + L); ctx.stroke(); }
    }
    // wrap band (two loops)
    for (const [yy, hh, f] of [[-6, 22, -0.1], [10, 24, 0]]) {
      const g = ctx.createLinearGradient(0, yy - hh / 2, 0, yy + hh / 2); g.addColorStop(0, shade(c, 0.12 + f)); g.addColorStop(1, shade(c, -0.28 + f));
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-34, yy - hh / 2, 68, hh, hh / 2); ctx.fill();
      knitBand(ctx, c, -30, yy - hh / 2 + 3, 30, yy + hh / 2 - 3, 10);
    }
    // knot
    ctx.fillStyle = shade(c, 0.05); ell(ctx, 16, 12, 12, 11); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ell(ctx, 12, 8, 6, 3); ctx.fill();
  });
}
// scarf on people.tourist: same (x,y,s,st) as the tourist call; draw AFTER the tourist.
function touristScarf(ctx, x, y, s, st = {}, color = '#c8423a') {
  const sit = st.sit || 0, walk = st.walk;
  const bob = walk !== null && walk !== undefined ? Math.abs(Math.sin(walk)) * -6 : 0;
  const hip = [lerp(0, 14, sit), lerp(-205 + bob, -80, sit)];
  const lean = lerp(-0.06, -0.16, sit) + (st.lean || 0);
  const rot = (px, py, a) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];
  const a1 = rot(0, -150, lean), sh = [hip[0] + a1[0], hip[1] + a1[1]];
  const a2 = rot(-6, -52, lean), head = [sh[0] + a2[0], sh[1] + a2[1]];
  const hr = lean * 0.5 + (st.look || 0), nk = rot(1, 38, hr), neck = [head[0] + nk[0], head[1] + nk[1]];
  scarf(ctx, x + neck[0] * s, y + neck[1] * s, s * 0.95, color, { flip: true, rot: lean * (st.flip ? -1 : 1), tail: 0.9, sway: st.walk ? Math.sin(st.walk) * 0.3 : 0 });
}
// scarf on people.face close-up: same (x,y,s) as the face call; draw AFTER the face.
function faceScarf(ctx, x, y, s, color = '#c8423a', o = {}) {
  const c = scarfColor(color), tx = (o.turn || 0) * 70 * 0.3;
  at(ctx, x, y, o.tilt || 0, s, s, () => {
    // hanging tail
    ctx.fillStyle = shade(c, -0.18); ctx.beginPath(); ctx.moveTo(40 + tx, 300); ctx.lineTo(150 + tx, 300); ctx.quadraticCurveTo(160 + tx, 460, 140 + tx, 640); ctx.lineTo(50 + tx, 640); ctx.quadraticCurveTo(40 + tx, 460, 40 + tx, 300); ctx.fill();
    knitBand(ctx, c, 46 + tx, 320, 146 + tx, 630, 8);
    // two loops around the neck
    for (const [yy, hh, f] of [[222, 70, 0.06], [282, 80, -0.04]]) {
      ctx.beginPath(); ctx.moveTo(-150 + tx, yy - hh / 2); ctx.quadraticCurveTo(tx, yy - hh / 2 + 34, 150 + tx, yy - hh / 2); ctx.lineTo(160 + tx, yy + hh / 2); ctx.quadraticCurveTo(tx, yy + hh / 2 + 40, -160 + tx, yy + hh / 2); ctx.closePath();
      const g = ctx.createLinearGradient(0, yy - hh / 2, 0, yy + hh / 2 + 30); g.addColorStop(0, shade(c, 0.12 + f)); g.addColorStop(1, shade(c, -0.3 + f)); ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip(); knitBand(ctx, c, -160 + tx, yy - hh / 2, 160 + tx, yy + hh / 2 + 40, 22); ctx.restore();
    }
    ctx.fillStyle = shade(c, 0.02); ell(ctx, 95 + tx, 305, 42, 36); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ell(ctx, 82 + tx, 292, 18, 9); ctx.fill();
  });
}
// ---------- local eaters ----------
const LOCALS = [
  { skin: ['#e0ac84', '#bf855e', '#8e5c3c'], top: '#2c3a52', topD: '#1c2638', pants: '#3a3a3e', hat: 'helmet', hatC: '#5d6b3a', hair: '#1a1410' },
  { skin: ['#ecc09c', '#cf9a74', '#9c6a4a'], top: '#7a2c3a', topD: '#561c28', pants: '#2a2a30', hat: 'nonla', hatC: '#e8d7a6', hair: '#120e0c' },
  { skin: ['#e6b690', '#c88e66', '#946040'], top: '#8a8f98', topD: '#5f646c', pants: '#2d3a5a', hat: 'hood', hatC: '#8a8f98', hair: '#151010' },
];
function localEater(ctx, x, y, s, o = {}) {
  const C = LOCALS[((o.seed || 0) % 3 + 3) % 3], k = clamp(o.k || 0), t = o.t || 0, gl = clamp(o.glance || 0), fl = o.flip ? -1 : 1;
  const sk = ease.inOut(k), bob = Math.sin(t * 2.3) * 2;
  at(ctx, x, y, 0, s * fl, s, () => {
    P.stool(ctx, 0, 0, 0.8, '#2f6fd6', 62);
    const hip = [0, -62], sh = [24 + sk * 14, -196 + sk * 10 + bob], head = [sh[0] + 16 + sk * 16 - gl * 10, sh[1] - 48 + sk * 8];
    // far leg
    seg(ctx, hip[0], hip[1], 74, -84, 30, 24, shade(C.pants, -0.25)); seg(ctx, 74, -84, 80, -6, 22, 18, shade(C.pants, -0.25));
    ctx.fillStyle = '#20201f'; ctx.beginPath(); ctx.ellipse(90, -6, 20, 8, 0, 0, TAU); ctx.fill();
    // far arm holding the bowl
    const bowl = [96 + sk * 8, -138 - sk * 26];
    const elF = ik(sh[0] - 6, sh[1] + 10, bowl[0] - 26, bowl[1] + 4, 62, 60, 1);
    seg(ctx, sh[0] - 6, sh[1] + 10, elF[0], elF[1], 24, 20, C.topD); seg(ctx, elF[0], elF[1], bowl[0] - 26, bowl[1] + 4, 18, 15, C.skin[2]);
    // torso
    ctx.beginPath(); ctx.moveTo(hip[0] - 34, hip[1] + 6); ctx.quadraticCurveTo(sh[0] - 44, (hip[1] + sh[1]) / 2, sh[0] - 30, sh[1] - 4); ctx.lineTo(sh[0] + 30, sh[1] + 2); ctx.quadraticCurveTo(sh[0] + 40, (hip[1] + sh[1]) / 2, hip[0] + 34, hip[1] + 4); ctx.closePath();
    const tg = ctx.createLinearGradient(-40, 0, 60, 0); tg.addColorStop(0, C.topD); tg.addColorStop(0.6, C.top); tg.addColorStop(1, shade(C.top, -0.2)); ctx.fillStyle = tg; ctx.fill();
    if (C.hat === 'hood') { ctx.fillStyle = C.topD; ctx.beginPath(); ctx.ellipse(sh[0] - 22, sh[1] + 2, 26, 16, -0.4, 0, TAU); ctx.fill(); }
    // near leg
    seg(ctx, hip[0], hip[1], 80, -92, 34, 28, C.pants); seg(ctx, 80, -92, 88, -6, 26, 20, C.pants);
    ctx.fillStyle = '#2a2826'; ctx.beginPath(); ctx.ellipse(100, -6, 22, 9, 0, 0, TAU); ctx.fill();
    // bowl
    phoBowl(ctx, bowl[0], bowl[1] + 28, 0.24, { fill: 0.8 - k * 0.2, beef: 0.5, noodles: 0.8, herbs: 0.5, steam: 0.4, t, k: 0.4, seed: 40 + (o.seed || 0) });
    // head
    at(ctx, head[0], head[1], -0.08 + sk * 0.2 - gl * 0.1, 1, 1, () => {
      const turn = 1 - gl * 1.6; // 1 = profile right, negative = looking back
      ctx.fillStyle = C.skin[1]; ctx.fillRect(-10, 16, 20, 26);
      const hg = ctx.createRadialGradient(6, -8, 3, 0, 0, 34); hg.addColorStop(0, C.skin[0]); hg.addColorStop(1, C.skin[2]);
      ctx.fillStyle = hg; ell(ctx, 0, 0, 29, 33); ctx.fill();
      const fx = turn * 22;
      // nose
      ctx.fillStyle = C.skin[2]; ctx.beginPath(); ctx.moveTo(fx + 4, -2); ctx.lineTo(fx + 4 + 9 * Math.sign(turn || 1), 9); ctx.lineTo(fx + 4, 12); ctx.fill();
      // eye + brow
      const ex = fx - 4 * Math.sign(turn || 1); ctx.fillStyle = '#1a1210';
      if (k > 0.5) { ctx.fillRect(ex - 5, -6, 10, 2.5); } else { ell(ctx, ex, -5, 3.2, 3.6 + gl); ctx.fill(); }
      ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - 7, -14 - gl * 6); ctx.lineTo(ex + 6, -15 - gl * 7); ctx.stroke();
      // mouth: o when slurping
      if (k > 0.2) { ctx.fillStyle = '#5a2020'; ell(ctx, fx + 2, 20, 4 + k * 2, 4 + k * 2); ctx.fill(); }
      else { ctx.strokeStyle = '#7a3a2a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(fx - 6, 20); ctx.lineTo(fx + 3, 20); ctx.stroke(); }
      // ear
      ctx.fillStyle = C.skin[2]; ell(ctx, fx * -0.3 - 4, 0, 6, 9); ctx.fill();
      // hair / hat
      ctx.fillStyle = C.hair; ctx.beginPath(); ctx.ellipse(-4, -12, 30, 24, 0, Math.PI, TAU); ctx.fill();
      if (C.hat === 'helmet') {
        const g = ctx.createLinearGradient(0, -50, 0, -6); g.addColorStop(0, shade(C.hatC, 0.2)); g.addColorStop(1, shade(C.hatC, -0.25));
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -14, 34, 30, 0, Math.PI, TAU); ctx.fill();
        ctx.fillStyle = shade(C.hatC, -0.35); ctx.fillRect(-38, -16, 76, 6);
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-14, 24); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ell(ctx, -10, -34, 10, 5); ctx.fill();
      } else if (C.hat === 'nonla') {
        ctx.save(); ctx.rotate(-0.1);
        const g = ctx.createLinearGradient(-60, 0, 60, 0); g.addColorStop(0, shade(C.hatC, -0.25)); g.addColorStop(0.45, shade(C.hatC, 0.1)); g.addColorStop(1, shade(C.hatC, -0.3));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-62, -14); ctx.lineTo(0, -66); ctx.lineTo(62, -14); ctx.quadraticCurveTo(0, -4, -62, -14); ctx.fill();
        ctx.strokeStyle = 'rgba(140,110,60,0.5)'; ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-62 * i / 4, -14 - 52 * (1 - i / 4) + 0); ctx.lineTo(62 * i / 4, -14 - 52 * (1 - i / 4)); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = '#d8c48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(fx - 6, 30); ctx.stroke();
      } else {
        ctx.fillStyle = C.hatC; ctx.beginPath(); ctx.moveTo(-34, 30); ctx.quadraticCurveTo(-42, -40, 0, -42); ctx.quadraticCurveTo(30, -42, 32, -14); ctx.quadraticCurveTo(14, -24, 8, 0); ctx.quadraticCurveTo(-4, 26, -6, 36); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = shade(C.hatC, -0.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(32, -14); ctx.quadraticCurveTo(14, -24, 8, 0); ctx.stroke();
      }
    });
    // near arm with chopsticks: lifts noodles from bowl toward mouth
    const mouth = [head[0] + 24, head[1] + 20], hnd = [lerp(bowl[0] - 6, mouth[0] + 30, sk), lerp(bowl[1] - 50, mouth[1] + 26, sk)];
    const el = ik(sh[0] + 4, sh[1] + 12, hnd[0], hnd[1], 66, 62, 1);
    seg(ctx, sh[0] + 4, sh[1] + 12, el[0], el[1], 26, 22, C.top); seg(ctx, el[0], el[1], hnd[0], hnd[1], 20, 16, C.skin[1]);
    const tip = [lerp(bowl[0] + 4, mouth[0] + 4, sk), lerp(bowl[1] - 4, mouth[1] + 4, sk)];
    // noodles hanging from chopstick tips (into bowl or mouth)
    ctx.strokeStyle = '#f8efda'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(tip[0] + i * 2, tip[1]); ctx.quadraticCurveTo(tip[0] + 10 + i * 3, lerp(tip[1] + 30, tip[1] + 60, sk), bowl[0] + i * 4 - 4, bowl[1] - 8); ctx.stroke(); }
    const ang = Math.atan2(hnd[1] - tip[1], hnd[0] - tip[0]);
    chopsticksPair(ctx, tip[0], tip[1], 0.22, ang, 0.06);
    ell(ctx, hnd[0], hnd[1], 11, 10); ctx.fillStyle = C.skin[1]; ctx.fill();
    if (k > 0.3) soundRings(ctx, mouth[0] + 4, mouth[1], (t * 1.5) % 1, { n: 2, R: 60, dir: -0.6, spread: 1.4, col: '255,245,220' });
  });
}
function fancyPinkyHand(ctx, x, y, s, rot = 0, o = {}) {
  const SK = o.skin || PEOPLE.SKIN;
  at(ctx, x, y, rot, s, s, () => {
    // cuff of the teal shirt
    ctx.fillStyle = '#2f8f8a'; ctx.beginPath(); ctx.roundRect(-46, -26, 40, 52, 10); ctx.fill();
    // teaspoon (held by thumb+index pinch at ~ (128,-14), bowl dangling forward)
    if (o.spoon !== false) teaspoon(ctx, 152, 30, 0.9, -2.2);
    // curled middle + ring fingers
    for (const [fy, w] of [[2, 15], [16, 14]]) { seg(ctx, 70, fy, 98, fy + 6, w, w - 2, SK[1]); seg(ctx, 98, fy + 6, 90, fy + 20, w - 2, w - 4, SK[2]); }
    // palm
    const pg = ctx.createLinearGradient(0, -30, 0, 34); pg.addColorStop(0, SK[0]); pg.addColorStop(1, SK[2]);
    ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(-8, -20); ctx.quadraticCurveTo(40, -36, 86, -20); ctx.quadraticCurveTo(96, 4, 84, 28); ctx.quadraticCurveTo(40, 36, -8, 22); ctx.closePath(); ctx.fill();
    // index finger to pinch point
    seg(ctx, 80, -16, 112, -24, 16, 14, SK[1]); seg(ctx, 112, -24, 130, -14, 14, 12, SK[1]);
    // thumb from below
    seg(ctx, 40, -8, 92, -6, 20, 16, SK[2]); seg(ctx, 92, -6, 124, -10, 16, 13, SK[1]);
    ctx.fillStyle = '#f2b8a0'; ell(ctx, 128, -12, 6, 4); ctx.fill();
    // the raised pinky (proud!)
    seg(ctx, 76, 26, 104, 18, 13, 11, SK[1]); seg(ctx, 104, 18, 128, -2, 11, 9, SK[1]); seg(ctx, 128, -2, 142, -24, 9, 8, SK[0]);
    ctx.fillStyle = '#f6c9b2'; ell(ctx, 142, -25, 4.5, 3.5); ctx.fill();
    // sparkle at pinky tip
    ctx.fillStyle = 'rgba(255,250,220,0.95)'; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? 4 : 16; i ? ctx.lineTo(160 + Math.cos(a) * rr, -44 + Math.sin(a) * rr) : ctx.moveTo(160 + rr, -44); } ctx.fill();
  });
}

module.exports = {
  // environment
  dawnSky, fog, dawnAerial, dawnStreet, streetLamp, lampHead, bicycleRider, broomSweeper,
  // stall
  giantPot, potTop, meatCabinet, stallTable, lowStool,
  // cook
  ongTu, ongTuFace,
  // bowl & food
  phoBowl, phoBowlTop, bowlContents, charredOnion, gingerKnob, starAnise, cinnamonStick, cardamom, clove, beefBone, rockSugar,
  fishSauceBottle, beefBlock, beefSlice, noodleSheet, noodleBundle, bambooStrainer, herbPlate, basilLeaf, sawtooth, beanSprout,
  limeWedge, chiliSlice, quay, vinegarGarlicJar, porcelainSpoon, teaspoon, chopsticksPair, icedTea, ladle, ladleGrip, ladlePour,
  brothStream, moonAndStars, clockFace,
  // effects
  richSteam, slurpVortex, soundRings, steamFog, fogGlassesFn, sunglasses,
  // people extras
  scarf, touristScarf, faceScarf, localEater, fancyPinkyHand,
  // constants / helpers
  STREET, AER, COL, TU, hx, mixc, rgba,
};
