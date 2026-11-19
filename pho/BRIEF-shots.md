# Brief for the shot writers: Phở Hà Nội (pho/)

Folder: `D:\DishTales-hoathinh\pho\` (Node + @napi-rs/canvas, 1080×1920 vertical, 30fps, 90s).
Read first: `D:\DishTales-hoathinh\PLAN-pho.md` (the 28-shot table: timing, framing, content, on-screen text), `shots.js` (timing table, shot-file loading), `render.js` (draw call, flashes, colour grade), `text.js` (caption/line/label/title/endCard/fadeIO), the header of `pprops.js` (full API), `people.js` (tourist, face, eyeMacro, thumbsUp), and `lib.js`.
For style/structure, look at `D:\DishTales-hoathinh\mixaogion\shotsA.js|shotsB.js|shotsC.js` (most recent video, same toolkit) and `D:\DishTales-hoathinh\buncha\shots*.js`.
Preview images of the props: `pho\previews\props_*.png`.

## Contract
- Each shot: `function sN(ctx, lt, p, T)`. lt = local time in the shot (s), p = progress 0..1, T = global time. It must paint the FULL frame (opaque background).
- `shotsA.js` exports s1..s10, `shotsB.js` exports s11..s20, `shotsC.js` exports s21..s28. Do not edit shots.js, render.js, audio.js or another agent's shot file.
- Do not change existing exports in pprops.js/people.js/lib.js/text.js. If you need a new helper, put it inside your own shot file. (Small, backward-compatible bug fixes in pprops.js are OK, but say so in your report.)
- Music is 80 BPM, so 1 beat = 0.75s. Beats are at T = n*0.75. Time on-beat motions (bones dropping, toppings landing, drum hits, slurps in shot 26, heart pulses) to that grid.
- Cinematic: camera moves (`cam` in lib.js: slow push-in/pan/crane), depth (foreground blur/bokeh, fog), backlight, steam (`richSteam`), lens flare (`flare`), god rays, dust, slow-motion feel. Palette: misty blue-lavender dawn + warm amber lamp/broth light.
- Text: every on-screen text is bilingual (VN big cream-yellow, EN small white below) via text.js. Safe zone x 70–930, y < 1560. Step captions: `caption(ctx,T,t0,t1,vi,en,{n})` using the shot's start..end (with small margins), at the default CAP_Y. Exact text is in PLAN-pho.md.
- Characters:
  - Ông Tư: `PP.ongTu` / `PP.ongTuFace`.
  - Tourist: `people.tourist` / `people.face` with a scarf drawn after (`PP.touristScarf` / `PP.faceScarf`, colour '#c8423a'). He is blond, sunglasses on his head, teal shirt, backpack.
  - Hanoi locals: `PP.localEater`.
- Performance: avoid per-frame work that is too heavy. A whole 90s render should stay reasonable (target < 0.25s/frame). Use cached sprites where pprops already does.
- Verify by running `node render.js --sheet <times> <name>.png` (from the pho folder) with 2–3 times per shot, e.g. `--sheet 0.5,2,3.5 a1.png`. Output goes to `previews\`. LOOK at the images (Read tool), fix anything ugly or wrong (clipping, empty areas, text outside the safe zone, characters floating, wrong scale), and re-check. Each shot should look polished and readable as a phone video.
- Report: which shots are done, the preview paths, known weaknesses, and any helper you changed.

## pprops.js API (const PP = require('./pprops'))
General: s = scale, rot = radians, t = seconds, k = 0..1 progress, o = options object (all optional). Origin as noted. Sizes at s=1.

### Environment
- `dawnSky(ctx,k,o{y0=0,h=H,x0=0,w=W,t,sunX,stars})`: night → predawn gradient (k 0→1), fading stars, warm horizon glow.
- `fog(ctx,t,seed,y,h,alpha=0.5,col)`: drifting fog band, full width.
- `dawnAerial(ctx,t,k,camY=1,o{steam=1,lamps=1,fogA})`: misty Hanoi rooftops from high up (cached 1080×2600). camY 0..1 pans from the top (sky) to the bottom (stall street). Returns {stallX,stallY}, the stall's steam column on screen (≈(640,1862) at camY .6), for zoom targeting.
- `dawnStreet(ctx,t,panX,o{k=.25, stallX=1500, fogA=.55, steam=1, mid(ctx,ox)})`: full-frame Old Quarter street (bàng tree with red leaves, wires, lit windows, lamps, PHỞ BÒ stall, fog). The layer is STREET.SW=2080 wide, so panX runs 0..1000 and screen x = layer x − panX. Ground (sidewalk top) is y = STREET.GY = 1400; the road starts at STREET.ROAD = 1500. `mid` is a callback for drawing characters between the background and the foreground fog; it gets ox = −panX. Returns {ox, GY, stallX (screen)}.
- `streetLamp(ctx,x,y,s,o{on=1,t,pool=1,flip})`: origin at the pole base, 540 tall, light cone + ground pool. `lampHead(x,y,s,flip)` → bulb [x,y].
- `bicycleRider(ctx,x,y,s,t,o{flip,basket,speed})`: origin on the ground under the bike, ~360 tall, faces right, pedals animate with t.
- `broomSweeper(ctx,x,y,s,t,o{flip})`: street sweeper with nón lá and bamboo broom, origin on the ground, ~340 tall, faces left.

### Stall
- `giantPot(ctx,x,y,s,o{lid:'on'|'off'|number lift px, lidTilt, simmer=1, bones=1, t, steam=1, stove=1})`: origin at the floor centre under the stove. The rim centre is at y−400s and R = 175s. Returns {rimX,rimY,R}.
- `potTop(ctx,x,y,R,o{clarity=1, skim=0, bones=1, onion=1, anise=1, simmer, t, rim=1, fat})`: top-down broth surface for the pot close-up. clarity 0 is murky brown, 1 is clear amber. skim 0..1 adds grey scum foam.
- `meatCabinet(ctx,x,y,s,o{t,light})`: origin at the bottom centre, 320w × 260h. Glass case with hanging brisket, beef slices, noodles and a red "PHỞ" sign.
- `stallTable(ctx,x,y,s,o{w=300,h=78,condiments=1})`: origin at the floor centre; the tabletop is at y−h·s. Includes a chopstick cup, chili sauce and a vinegar jar.
- `lowStool(ctx,x,y,s,col='#2f6fd6',h=62)`: blue plastic stool, origin at the floor centre.

### Ông Tư (old cook: beret, grey hair and moustache, brown cardigan, maroon scarf, towel on the shoulder)
- `ongTu(ctx,x,y,s,o{pose,k,t,shake,expr,turn,flip,bowl})`: faces right (flip mirrors). Origin is the floor between the feet; ~655 tall at s=1. Place giantPot at (x+270s, y) with the same s, since the pot poses are aligned to that.
  - Poses:
    - `stand`
    - `stir`: t animates the stick in the pot.
    - `lid`: k 0..1 lifts the lid by 190.
    - `ladle`: k 0..0.45 lifts, then 0.45..1 tips to pour.
    - `slurp`: a small bowl with noodles at the mouth.
    - `laugh`: uses shake.
    - `drum`: k 0..1 swings the ladle down onto the pot rim; o.hit = impact point.
    - `present`: k 0..1 offers a steaming bowl forward; bowl:false hides it.
  - `expr` overrides the face: 'smile' | 'laugh' | 'slurp'.
  - Returns {head:[x,y], cup:[x,y] (spout point in the ladle pose; start brothStream here), hit:[x,y] (drum), hand}.
- `ongTuFace(ctx,x,y,s,o{expr:'smile'|'laugh'|'slurp', k, t, turn(-1..1), tilt, blink, look:[dx,dy], body=true, noodles, shake})`: close-up head. Origin between the eyes, ~290 wide. Chin at y+205s, beret top at y−250s. body:true draws the cardigan shoulders and scarf down to y+620s. In the slurp expression, k drives the noodles being sucked in.

### Bowls (blue-and-white porcelain)
- `phoBowl(ctx,x,y,s,o)`: 3/4 view. Origin at the foot bottom centre. Rim radius 200s at y−150s; o.k = rim ellipse ratio (default .36). Returns {rimY,R}.
- `phoBowlTop(ctx,x,y,R,o)`: top-down; R = outer rim radius.
- `bowlContents(ctx,R,o)`: just the contents disc at the current origin, for custom containers.
- Bowl options: fill 0..1 (0 = empty bowl), noodles 0..1, beef 0..1 (alias beefRare), cook 0..1 (pink rare → grey-brown cooked), scallion, onion, herbs, fat (fat-droplet glints), pepper (each 0..1), steam 0..1, t, clarity=1, rot (top view), seed.

### Ingredients (origin is the centre unless noted; [size at s=1])
- Aromatics:
  - `charredOnion(ctx,x,y,s,rot,o{char=1,cut=true})` [130]
  - `gingerKnob(…,o{char=1})` [170]
  - `starAnise(…,o{toast=0})` [80]
  - `cinnamonStick(ctx,x,y,s,rot)` [190]
  - `cardamom` [80, black cardamom]
  - `clove` [40]
- Broth and beef:
  - `beefBone(…,o{view:'side'|'top'})` [side 260 / top 120]
  - `rockSugar(…,o{seed})` [90]
  - `fishSauceBottle(…,o{level=.7})`: origin at the bottom [300 tall]
  - `beefBlock(…,o{cut=0})`: origin at the bottom [320×130]
  - `beefSlice(…,o{cook=0, alpha=1, curl=0, seed})` [150×95, translucent marbled pink]
- Noodles:
  - `noodleSheet(ctx,x,y,s,rot)` [220×150]
  - `noodleBundle(…,o{seed})` [200]
  - `bambooStrainer(…,o{noodles=1,t,wet=1})`: origin at the basket centre, handle toward −x [560 total]
- Herbs and garnish:
  - `herbPlate(ctx,x,y,s,o{rot,basil,sawtooth,sprouts,lime,chili})`: top-down, R 230
  - `basilLeaf(ctx,x,y,s,rot)` [70]
  - `sawtooth(ctx,x,y,s,rot)` [120]
  - `beanSprout(ctx,x,y,s,rot)` [80]
  - `limeWedge(…,o{squeeze=0, view:'side'|'top', t})` [90]
  - `chiliSlice(ctx,x,y,s)` [26]
- Table items:
  - `quay(ctx,x,y,s,rot)` [270]
  - `vinegarGarlicJar(ctx,x,y,s,o)`: origin at the bottom [130]
  - `porcelainSpoon(…,o{fill=0})`: origin at the spoon bowl, handle toward +x [210]
  - `teaspoon(ctx,x,y,s,rot)` [95]
  - `chopsticksPair(ctx,x,y,s,rot,spread=0)`: origin at the tips, extends +x 400
  - `icedTea(ctx,x,y,s,o{level=.8,t})`: origin at the bottom [170]
- Ladle and pour:
  - `ladle(ctx,x,y,s,rot,o{fill=0, tip=0, len=430})`: origin at the centre of the cup lip; the handle goes up (−y) by len when rot=0. tip rotates the cup only (positive pours toward +x).
    - `ladleGrip(x,y,s,rot,o{len,tip})` → handle end (hand position).
    - `ladlePour(x,y,s,o{tip})` → spout point.
  - `brothStream(ctx,x0,y0,x1,y1,w=26,t)`: glinting amber pour ribbon.

### Time-lapse
- `moonAndStars(ctx,t,k,o{sky=true, trails=0})`: k 0..1 moves the moon along an arc and the sky from night to predawn. trails 0..1 adds star-trail arcs.
- `clockFace(ctx,x,y,R,hours,o{blur=0})`: wall clock. hours 2.5 = 2:30. blur draws motion ghosts of the minute hand.

### Effects
- `richSteam(ctx,t,seed,x,y,w,h,alpha=.6,o{n=14, col='#fff7ec', drift=0})`: billowing steam rising from (x,y), base width w, height h. Uses cached sprites, so it is cheap.
- `slurpVortex(ctx,t,x,y,s,k)`: noodle tornado. (x,y) is the mouth at the top; the funnel extends ~620s downward.
- `soundRings(ctx,x,y,k,o{n=4, R=420, col='255,240,200', dir=0, spread=TAU})`: expanding rings; dir/spread make directional arcs.
- `steamFog(ctx,x,y,w,h,a,t)`: fogged glass in a rect (use inside a lens clip).
- `fogGlassesFn(a,t)`: returns a function for `people.face({glassesFn})`.
- `sunglasses(ctx,x,y,s,rot,o{fog=0,t})`: the tourist's sunglasses on their own (for flying off); lenses at ±70s.

### People extras
- `scarf(ctx,x,y,s,color='#c8423a',o{tail=1, flip, rot=0, sway=0})`: knit scarf; origin at the neck centre, ~68 wide.
- `touristScarf(ctx,x,y,s,st,color)`: call with the same x,y,s,st as `people.tourist`, after drawing the tourist. Works sitting and walking.
- `faceScarf(ctx,x,y,s,color,o{turn,tilt})`: call with the same x,y,s as `people.face`, after drawing the face.
- `localEater(ctx,x,y,s,o{seed,k,t,glance,flip})`: Hanoian eater with their own blue stool (0.8), bowl, chopsticks and steam. Faces right. Origin is the floor under the stool, ~300 tall.
  - seed%3: 0 = man in an olive helmet, 1 = woman in a nón lá, 2 = student in a grey hoodie.
  - k 0..1 lifts noodles to the mouth (slurp).
  - glance 0..1 turns the head back toward −x with raised brows.
- `fancyPinkyHand(ctx,x,y,s,rot,o{skin, spoon=true})`: fair hand pinching a teaspoon with the pinky raised, plus a sparkle. Origin at the wrist, points +x, ~160 long.
- Sunglasses position on `people.face`: the option `glassesY` (default −178 = on the head; 0 = over the eyes). Fogged glasses: `face(ctx,x,y,s,{glassesY: lerp(-178,0,e), glassesFn: PP.fogGlassesFn(a,t)})`, then `PP.faceScarf(ctx,x,y,s,'#c8423a')`.

### Constants
- `STREET` {GY:1400, ROAD:1500, SW:2080, stallX:1500}
- `AER` {h:2600, horizon:720}
- `COL` (palette), `TU` (Ông Tư's clothing colours)
- `hx(hex)` → [r,g,b]; `mixc(a,b,f)` → rgb string; `rgba(hex,a)` → rgba string

### Scale notes
- Ông Tư full body: s ≈ 1.0–1.3 in a wide stall shot. ongTuFace: s ≈ 1.6–2.2 for a close-up.
- phoBowl hero shot: s ≈ 1.8–2.4. phoBowlTop: R ≈ 380–460. giantPot: s ≈ 1–1.6. localEater in the background: s ≈ 0.8–1.2.
- Draw order: draw the pot body first, then ongTu (the ladle in the ladle pose clips itself below the rim). For the lid pose, draw giantPot with lid:'off'; ongTu draws the lid.
- Street shot pattern: `const st = PP.dawnStreet(ctx,t,panX,{mid:(c,ox)=>{ /* characters at layer x + ox */ }})`. Characters stand on y = STREET.GY.
