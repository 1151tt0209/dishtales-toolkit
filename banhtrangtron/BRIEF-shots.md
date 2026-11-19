# Brief for the shot writers: Bánh tráng trộn Sài Gòn (banhtrangtron/)

Folder: `C:\Users\admin\OneDrive\Desktop\thevideo\banhtrangtron\` (Node + @napi-rs/canvas, 1080×1920 vertical, 30fps, 90s).

Read these first:
- `PLAN-banh-trang-tron.md`: the 28-shot table with timing, framing, content and the exact bilingual text.
- `shots.js`: the TIMES table and how shot files are loaded.
- `render.js`: the draw call, flashes and colour grade.
- `text.js`: caption, line, label, title, endCard, fadeIO and CAP_Y.
- The header of `tprops.js`: the full API, about 155 lines. Read it, it is the source of truth.
- `people.js`: tourist, face, eyeMacro, thumbsUp, SKIN, HAIR, SHIRT.
- `lib.js`: cam, ease, inv, glow, flare, godRays, dust, bokeh, sparkle, motionBlurX, buffer.

Style and structure references (same toolkit):
- `D:\DishTales-hoathinh\pho\shotsA.js|shotsB.js|shotsC.js` (the most recent video).
- `D:\DishTales-hoathinh\mixaogion\shots*.js`.
- CTA reference: `pho\shotsC.js` → `s28`. Port its structure and swap in this video's background, music grid and text.

Preview images of every prop: `banhtrangtron\previews\props_env.png`, `props_cart.png`, `props_chars.png`, `props_food.png`, `props_fx.png`. Regenerate them with `node _test_tprops.js all`.

## Contract
- **Shot signature:** each shot is `function sN(ctx, lt, p, T)`.
  - `lt` is local time in the shot (s), `p` is progress 0..1, `T` is global time.
  - It must paint the **full frame** with an opaque background.
  - render.js wraps each call in save/restore.
- **Files:**
  - `shotsA.js` exports s1..s10, `shotsB.js` exports s11..s20, `shotsC.js` exports s21..s28.
  - Do not edit shots.js, render.js, audio.js or another agent's shot file.
- **Helpers:**
  - Do not change existing exports in tprops.js, people.js, lib.js, text.js or the older prop files (pprops, bprops, props, food, world).
  - Put any new helper inside your own shot file.
  - Small, backward-compatible bug fixes in tprops.js are OK, but list them in your report.
- **Music grid: 150 BPM.**
  - 1 beat = **0.4s**, 1 bar = 1.6s. Beats fall on T = n·0.4.
  - Every cut is already on that grid. Time these on-beat motions to it:
    - scissor snips (s4, s6)
    - drum hits (s2)
    - ingredients landing (s7–s10, s15, s18)
    - egg bounces (s10)
    - bag shakes (s16, s21, s22, s26)
    - the kids' "ồ" reactions (s22)
    - heart pulses (s28, every 0.4s)
  - A handy helper: `const beat = T => (T / 0.4) % 1` (0 on the beat). `1 - beat` is a decaying hit.
- **Flashes** are handled by render.js (12.0, 48.0, 60.0, 72.8, 82.4, 86.0). Do not draw your own white flash on those times.
  - render.js also applies the warm/teal grade, vignette and grain. Don't double-grade heavily.
- **Silence 72.0–72.8 (s23):** the bag hangs in the air, so keep the motion floaty and slow.
- **Cinematic tools:**
  - Camera moves via `L.cam(ctx,cx,cy,zoom,rot,fn)`: crane, push-in, dolly, shake on beats in s16.
  - Depth: foreground bokeh/leaf blur.
  - Backlight: rimmed characters, `sunFlare`, `L.godRays`, `L.dust`.
  - Slow-motion feel in s5, s11, s13, s16 and s23. Use the `slow`/`swirl` options and slow particles.
- **Palette: 4 PM golden backlight.**
  - Amber sun low at the upper right, teal shadows, school-yellow walls, red phượng flowers, white school shirts.
  - The colours are in `TP.COL`: sun, sunHot, amber, teal, tealD, tealL, wall, phuong… plus the food colours.
  - Near the end (s27) the sun drops into a deeper orange-pink dusk.
- **Text:** every on-screen text is bilingual (Vietnamese big and cream-yellow, English small and white below), via text.js.
  - Safe zone is **x 70–930, y < 1560**. text.js centres on x=505, which is already inside it.
  - Steps ①–⑬: `caption(ctx,T,t0,t1,vi,en,{n})`, with t0/t1 = shot start+0.15 / end−0.1, at the default CAP_Y 1395.
  - Dialogue (s20, s21, s25, s26): `line(...)`.
  - City card (s1): `label(...)`.
  - Title (s5): `title(ctx,T,t0,t1,y,'Saigon Rice Paper Salad','BÁNH TRÁNG','TRỘN',s1,s2)`. Cambria Bold (TitleSerif) has all the accented capitals.
  - End card (s27, from 82.4): `endCard(ctx,T,82.4,{l1:'BÁNH TRÁNG',l2:'TRỘN',vi:'Chua. Cay. Giòn. Ghiền!',en:'Sour. Spicy. Crunchy. Addictive!'})`.
  - Copy the exact strings from the plan.
  - Keep important picture content (faces, the bag) out of the caption band y≈1330–1500 while a caption is showing, or accept the dark backdrop over it.
- **Performance:** target **< 0.25 s/frame**.
  - Each tprops drawer is < 21 ms warm. saigonAerial is ≈25 ms and schoolStreet with everything is ≈45 ms.
  - First calls build caches: aerial 130 ms, street 250 ms, counterTop 100 ms. That is fine once per render.
  - Avoid re-creating big canvases per frame. If you build a custom background, cache it at module level.
  - Particle counts: ≤ ~300 per frame is fine.
- **Verify:**
  - From the banhtrangtron folder, run `node render.js --sheet <times> <name>.png` with 2–3 times per shot, e.g. `--sheet 0.5,1.6,2.9 a1.png`. Output goes to `previews\`.
  - **Look at the images** (Read tool) and fix anything ugly or wrong:
    - clipping
    - empty areas
    - text outside the safe zone
    - floating characters (feet must touch the ground line)
    - wrong relative scale
    - hands not reaching props
  - Re-check after fixing. Each shot should read clearly as a phone video.
- **Report:** which shots are done, the preview paths, known weaknesses, and any tprops fix you made.

## Characters
- **Cô Ba** (vendor): nón lá, purple floral áo bà ba, cream apron, clear gloves.
  - Full body: `TP.coBa(ctx,x,y,s,{pose,k,t,...})`, ≈455 tall at s=1, origin between the feet.
  - Poses: stand, snip, pour, shake, hand, thumbs, laugh, wave.
  - Close-up: `TP.coBaFace(ctx,x,y,s,{expr})`. Expressions: smile, laugh, wink, talk, proud.
- **Kids** (5–6 of them): white shirt, navy shorts or skirt, coloured backpack.
  - Body: `TP.schoolKid(ctx,x,y,s,{seed:0..5,pose,t,flip,...})`, ≈350 tall at s=1.
    - Poses: stand, run, cheer, point, clap, shake, laugh, lookUp, eat, wave.
    - Use a fixed seed per kid so each one keeps a consistent look across shots. Seeds 0–5 give 6 distinct looks (hair, bag colour, boy/girl, glasses).
  - Close-up: `TP.kidFace(ctx,x,y,s,{seed,expr})`. Expressions: smile, shout, laugh, wow, chew, sour, spicy.
- **Tourist** (series regular): blond, sunglasses on his head, turquoise tee, backpack, **no scarf** (it's hot).
  - Full body: `TP.touristShake(ctx,x,y,s,{pose,k,t,glassK,face})`, ≈425 tall.
    - Poses: stand, hold, shake, behindBack, overShoulder, toss, catch, eat, thumbs.
    - `glassK` 0→1 drops the sunglasses onto his eyes (s22 bartender moment).
  - Close-ups: `people.face(ctx,x,y,s,{...glassesY})`, where glassesY −178 means on the head and 0 means over the eyes. For other poses use `people.tourist`. Do not add a scarf.
- **Parents on scooters:** `TP.motorbikeParent` (background; schoolStreet already draws 4 by default).
- **Hands for inserts:** `TP.cHand(ctx,x,y,s,rot,{kind,glove})` (Cô Ba's are gloved) and `TP.cArm` (shoulder→elbow→wrist).

## tprops.js API, condensed (`const TP = require('./tprops')`; see the header for every option)
General conventions:
- s = scale, rot = radians, t = seconds, k = 0..1 progress, o = options.
- The origin is noted for each drawer, and sizes are given at s=1.
- Returned points are in screen coordinates.

### Environment
- `saigonAerial(ctx,t,camY,o)`: drone descent over golden-hour Saigon. camY 0 = wide city, 1 = close over the yellow school gate. Returns {gate, z, horizon, sun}. Use it for s1 and s27 (reverse: camY 1→0, with a warmer overlay for dusk).
- `schoolStreet(ctx,t,panX,o)`: side-on street outside the school gate.
  - panX runs 0..1320; screen x = streetX − panX.
  - Landmarks: gate at street x 760 (w 420), ground y 1560, curb 1650.
  - The cart (s=0.95) is drawn at street x 1660, y 1470; `cart:false` hides it.
  - Options: `{gateOpen, sun, parents, crowd, petals, fg, mid(ctx,ox), yard(ctx,ox)}`.
    - `mid` draws your characters between the street and the foreground leaves.
    - `yard` draws inside the gate opening, e.g. kids running out in s2.
  - Returns {ox, gate, cart, sun}.
- `fallingPetals(ctx,t,seed,n,x0,y0,w,h)`, `canopy(...)`.
- `schoolDrum(ctx,x,y,s,{hit,t})`: s2 insert. hit = 1 on the beat.
- `motorbikeParent(ctx,x,y,s,t,{flip,seed,look,wave})`.

### Cart and counter
- `btCart(ctx,x,y,s,{t,light,umbrella})`: 340 wide; glass top at y−287s, sign top at −456s. Returns {top, counter, sign, jars[8]}.
- `counterTop(ctx,t,o)`: full-frame close-up background.
  - Default is a side view: steel counter from y=COUNTER_Y 1180 down, soft jars and a golden street behind. Use it for s4, s6, s8, s10–s14.
  - `{top:true}` is the top-down steel surface with leaf dapples (s7, s15, s18). `{top:true, board:true}` adds a cutting board.
- `jar(ctx,x,y,s,{fill,label,open,level})` (160×232).
- `chiliOilJar(ctx,x,y,s,{spoon})`, `shrimpSaltJar(...)`. `CART_JARS`, `COUNTER_Y`.

### Food and tools
- **Rice paper:** `riceSheet(ctx,x,y,s,rot,{curl,light,cut})` (Ø400; `light` = backlit glow, used in s5), `riceSheetStack`, `riceStrips(ctx,x,y,s,{n,fall,t,h,speed})`.
- **Scissors:** `scissors(ctx,x,y,s,rot,{open})`, origin at the pivot.
- **The bag:**
  - `plasticBag(ctx,x,y,s,{open,tied,fill,mix,shake,swirl,t,glow})`: the HERO prop. Body 230×280 at s=1. Returns {mouth, knot, top}.
  - `bagMouthTop(ctx,x,y,s,{layers,lastK,mix,spin,t})`: the top-down open bag. Push a layer name per step and animate lastK for the pop-in.
- **Mango and meats:** `greenMango(...,{peel})`, `peeler`/`grater`, `mangoShreds({fall})`, `beefJerky`, `driedSquidShreds({fall,jerky})`.
- **Eggs and spoons:** `quailEgg({peel,half})`, `spoon(...,{fill:'sate'|'scallion'|'salt',tip})`.
- **Pours and powders:** `pourStream(ctx,x0,y0,x1,y1,w,t,col)`, `saltCloud({t,k,light})`.
- **Calamansi:** `calamansi({half,squeeze})`, `juiceDrops({t,slow})`.
- **Garnish:** `rauRam({chopped})`, `peanuts({fall})`, `friedShallots({fall})`.
- **Utensils:** `skewer(...,{food})`, `plasticFork(...,{food:'mix'})`, `mixBite`.
- **Drink:** `traTac(ctx,x,y,s,{level,ice,straw})`.

### Effects
- `FLAVORS`: 4 entries: CHUA/SOUR yellow, CAY/SPICY red, MẶN/SALTY teal, NGỌT/SWEET pink.
- `flavorBurst(ctx,x,y,s,{t,k,only})`: returns 4 label anchors. Write each anchor's vi/en with text.js-style bilingual text ≈70–90 px below it (s24). Use the plan's order: Chua! Cay! Mặn! Ngọt!, revealed one per beat from 72.8.
- `shakeLines(ctx,x,y,s,{t,k,dir:'h'|'v'|'both'})`: prefer `'h'` or `'v'`; `'both'` looks a little like a smiley.
- `whoosh(ctx,x,y,ang,len,{k})`: bartender moves in s22 and the toss in s23.
- `ingredientBits`/`confetti(ctx,x,y,s,{t,loop,kinds})`: s24 burst, s26 celebration.
- `sunFlare(ctx,x,y,s)`.

### Helpers and palette
COL, SKIN_BA, KID_SKINS, KID_LOOKS, kidLook, rrect, lgr, rgr, canvas, mapper, rimLine, txt, rot2, ikPick, ikPickY, ribbon, layoutBits, cHand, cArm, handRot, nonLa, floral, fillTexture, STREET, AER, CART.

## Scale notes
- **One shared scale.** Cart and people use the same s: a hand at counter height sits at y−230s, the cart glass top at y−287s.
- **Street wides (schoolStreet):**
  - The cart is fixed at s=0.95 on y=1470.
  - Put characters in `mid` at s≈0.9–1.1 with feet at y≈1500–1680. Lower y means further forward, so draw back to front, sorted by y.
  - Kids ≈0.9–1.0, Cô Ba ≈0.95 standing behind the cart (feet ≈1470), tourist ≈1.0–1.1.
- **Medium shots:** coBa s≈2–3 (s=3 fills the frame from the knees up when the feet are below the frame). Kids s≈1.6–2.6. touristShake s≈2.4–3.2. btCart s≈1.4–2.2.
- **Faces:** coBaFace / kidFace / people.face at s≈1.4–2.2. For s25, a 2×2 or 3-face composition at s≈1.2–1.4 works.
- **Bags:** plasticBag hero s≈2–3.5. In a character's hand, pass `bag:{...}` options to the pose instead of drawing it separately; poses shake/hold/hand/eat draw the bag aligned to the hand. bagMouthTop at s≈2–2.4 fills the width in top-down shots.
- **Close-up food:**
  - riceSheet s≈1.5–2.5. scissors s≈2–2.6. quailEgg s≈2.5–4 (macro).
  - spoon s≈2–3. calamansi s≈2.5–3.5. traTac s≈2–3.
  - riceStrips / mangoShreds / squid / peanuts / shallots in fall mode s≈1.6–2.4.

## Draw order and patterns
- **Street shot pattern:**
  ```js
  const st = TP.schoolStreet(ctx, T, panX, {
    gateOpen,
    petals: 1,
    mid: (c, ox) => {
      // street-space x + ox, sorted by feet y
      TP.schoolKid(c, 900 + ox, 1600, 0.95, { seed: 2, pose: 'run', t: T });
    },
  });
  ```
  - Kids pouring out of the gate (s2): draw them in `yard` so they appear inside the gate opening, then in `mid` once they are past it.
  - The tourist tracking shot (s3): animate panX and let kids overtake him (run pose + motionBlurX or whoosh).
- **Counter close-ups:** draw `counterTop` → props on the counter → hands/arms → particles → text. Gloved hands: `cHand(...,{glove:true})`.
- **Cô Ba behind the cart:** draw coBa first, then btCart in front (the cart hides her legs), then the bag/hand inserts if they cross the glass. Or draw the cart first and pass work poses for hands above the glass.
- **Top-down assembly (s7, s15, s18):** `counterTop(ctx,T,{top:true})` → `bagMouthTop` with a growing `layers` array and `lastK` = landing progress → falling-bits mode of the next ingredient above it.
- **Shake (s16):**
  - `coBa` pose 'shake' (k = swing) or a plasticBag close-up with `{shake:1, swirl:1, mix: rising 0→1}`, plus `cam` shake on beats and `shakeLines` 'h'.
  - Flash at 48.0 is automatic. Inside-bag slow-mo: draw a big plasticBag (s≈3.5) with `swirl` and `t` slowed down.
- **Toss and catch (s22–s24):** touristShake poses overShoulder / behindBack / toss / catch.
  - The k of the 'toss' pose drives the arc with tossH as the apex.
  - For s23 (camera looking up), draw the bag yourself with plasticBag against the sky/phượng canopy and the kids' lookUp faces at the bottom.
- **Flavour burst (s24):** tourist face (eat) → `flavorBurst` centred on the mouth → labels from the returned anchors → `ingredientBits`.
- **Particles and text always last.** Text goes after everything, so the render.js grade still applies on top.

## Per-shot prop hints
| # | Props |
|---|---|
| 1 | saigonAerial camY 0→1 + label "SÀI GÒN · 4 GIỜ CHIỀU / Saigon · 4 PM" |
| 2 | schoolStreet (gate centred, gateOpen 0→1 after the drum beats), schoolDrum insert (hit on beats), kids via yard/mid, petals |
| 3 | schoolStreet panX tracking, touristShake 'stand' walking + kids 'run' overtaking |
| 4 | counterTop or btCart close (s≈2) dolly, jars glinting (sparkle), gloved hand + scissors snip on beat |
| 5 | riceSheet ×3–5 flying up with `light` 1, sunFlare behind; title at 12.0 |
| 6 | counterTop, riceSheet + scissors (open on beats) + riceStrips dropping |
| 7 | counterTop top + bagMouthTop(['strips']) + riceStrips fall |
| 8 | greenMango + peeler + mangoShreds flying |
| 9 | driedSquidShreds fall (jerky .5) + beefJerky pieces raining into the open bag |
| 10 | quailEgg peel 0→1, eggs bouncing on beats |
| 11 | chiliOilJar + spoon tip + pourStream (w≈10–14 at close scale), sparkle drops |
| 12 | saltCloud with light 1 against a backlit street |
| 13 | calamansi squeeze + juiceDrops slow |
| 14 | spoon fill 'scallion' + pourStream with scallion flecks |
| 15 | top-down bagMouthTop adding herbs, peanuts and shallots on beats (rauRam chopped / peanuts fall / friedShallots fall) |
| 16 | coBa 'shake' and/or plasticBag shake + swirl close-up, shakeLines, cam beat shake |
| 17 | plasticBag open 1, mix 1, backlit, sunFlare |
| 18 | bagMouthTop layers + 'toppings', skewers dropping in (skewer food 'egg'/'jerky') |
| 19 | btCart top: plasticBag + traTac, kids' hands reaching up (schoolKid 'point'/'cheer' at the bottom) |
| 20 | coBa 'hand' gives the bag; touristShake 'eat' with plasticFork; puzzled people.face; line "Ủa… sao nhạt?" |
| 21 | 2–3 schoolKid 'shake' + kidFace 'laugh'; line "Phải LẮC chú ơi!" |
| 22 | touristShake glassK 0→1, then overShoulder → behindBack → shake; whoosh; kids 'cheer' (expr 'wow') on beats |
| 23 | low angle: phượng canopy + sky, plasticBag rising, kids 'lookUp'; silence 72.0–72.8 |
| 24 | touristShake 'catch' at 72.8 → face eating + flavorBurst + 4 bilingual words + ingredientBits |
| 25 | happy tourist face, kids 'clap', coBa 'thumbs'; line "Ghiền luôn!" |
| 26 | schoolStreet crowd: every kid 'shake' on beats, tourist in the centre conducting (shake/thumbs), confetti |
| 27 | saigonAerial reverse (camY 1→0.2) with an orange-pink dusk overlay, endCard at 82.4 |
| 28 | CTA (port pho s28): background = blurred schoolStreet or counterTop; heart pulse every 0.4s; FOLLOW press; "coin" timing at the tap; bilingual lines from the plan + question "Bạn thêm mấy muỗng sa tế?" / "How many spoons of chili oil?" |

## Known prop weaknesses (work around them)
- `shakeLines` with dir 'both' reads a bit like a smiley, so use 'h' or 'v'.
- `pourStream` is thin by default; pass w≈10–16 at close-up scale.
- motorbikeParent's waving arm is thin; keep parents in the background.
- The chopped `rauRam` pile is small; scale it up (s≈2.5–3) or draw several.
- schoolStreet has no built-in crowd of kids; add them in `mid`/`yard`.
