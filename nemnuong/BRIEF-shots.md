# Brief for the shot writers: Nem nướng Cái Răng (nemnuong/)

Folder: `C:\Users\admin\OneDrive\Desktop\thevideo\nemnuong\` (Node + @napi-rs/canvas, 1080×1920 vertical, 30fps, 90s).

Read these first:
- `C:\Users\admin\OneDrive\Desktop\thevideo\PLAN-nem-nuong.md`: the 28-shot table with timing, framing, content and the exact bilingual text.
- `shots.js`: the TIMES table and how shot files are loaded.
- `render.js`: the draw call, flashes and colour grade.
- `text.js`: caption, line, label, title, endCard, fadeIO and CAP_Y.
- The header of `nprops.js`: the full API. Read it, it is the source of truth (the condensed summary further below may lag behind it).
- `people.js`: tourist, face, eyeMacro, thumbsUp, SKIN, HAIR, SHIRT.
- `lib.js`: cam, ease, inv, glow, flare, godRays, dust, bokeh, sparkle, motionBlurX, buffer.
- `river.js`: older river pieces (sky, water, mist, ghe, xuong, wake, coUt...). nprops.js wraps/upgrades most of these; prefer nprops.

Style and structure references (same toolkit):
- `D:\DishTales-hoathinh\banhtrangtron\shotsA.js|shotsB.js|shotsC.js` (the most recent video) and `D:\DishTales-hoathinh\pho\shots*.js`.
- CTA reference: `D:\DishTales-hoathinh\banhtrangtron\shotsC.js` → `s28` (and pho s28). Port its structure; swap in this video's background, music grid and text.

Preview images of every prop: `nemnuong\previews\props_*.png`. Regenerate them with `node _test_nprops.js all`.

## Contract
- **Shot signature:** each shot is `function sN(ctx, lt, p, T)`.
  - `lt` is local time in the shot (s), `p` is progress 0..1, `T` is global time.
  - It must paint the **full frame** with an opaque background.
  - render.js wraps each call in save/restore.
- **Files:**
  - `shotsA.js` exports s1..s10, `shotsB.js` exports s11..s20, `shotsC.js` exports s21..s28.
  - Do not edit shots.js, render.js, audio.js or another agent's shot file.
- **Helpers:**
  - Do not change existing exports in nprops.js, river.js, people.js, lib.js, text.js, props.js, pprops.js.
  - Put any new helper inside your own shot file.
  - Small, backward-compatible bug fixes in nprops.js are OK, but list them in your report (another agent may be editing nearby, so keep them minimal).
- **Music grid: 100 BPM (Mekong bossa-reggae).**
  - 1 beat = **0.6s**, 1 bar = 2.4s. Beats fall on T = n·0.6.
  - Every cut is already on that grid. Time these on-beat motions to it:
    - hand-fan swings (s7: one swing per beat; the fan is the shaker)
    - skewer flips (s8)
    - herbs / ingredients landing (s11–s14, s17)
    - roll pats (s15)
    - boat bobbing in the reggae section (s20–s27, gentle, on the off-beat is fine)
    - "Một, hai, ba… DZÔ!" counts at 78.6 / 79.2 / 79.8, shout 80.4 (s26)
    - heart pulses (s28, every 0.6s)
  - A handy helper: `const beat = T => (T / 0.6) % 1` (0 on the beat). `1 - beat` is a decaying hit.
- **Flashes** are handled by render.js (12.0, 48.0, 60.0, 72.0, 82.2, 86.4). Do not draw your own white flash on those times.
  - render.js also applies the warm/teal grade, vignette and grain. Don't double-grade heavily.
- **Silence 71.4–72.0 (end of s23):** the roll dangles on the cây bẹo right in front of the tourist's mouth; everything goes still and slow (only water ripples). Bite + flavour burst at 72.0 (s24).
- **Cinematic tools:**
  - Camera moves via `L.cam(ctx,cx,cy,zoom,rot,fn)`: drone, crane, push-in, dolly, gentle boat rocking (small rot on a slow sine), shake for the motorboat wave in s21.
  - Depth: foreground bokeh, mist, out-of-focus boat gunwales / cây bẹo produce in the foreground.
  - Backlight: rimmed characters against the low sunrise sun, lens flare, `L.godRays` through charcoal smoke, `L.dust`/embers.
  - Slow-motion feel in s3, s5, s14, s18, s23. Slow particles, slow steam/smoke.
- **Palette: Cái Răng at 5:30 AM sunrise.**
  - Pink-orange sky, low red-orange sun near the horizon, mist on the water, teal shadows, brown river water with orange sun glitter, dark-green coconut banks.
  - Colours are in `NP.COL` (see the nprops header).
  - The sun rises a little through the video; by s27 it is higher and golden (warm clear morning).
- **Text:** every on-screen text is bilingual (Vietnamese big and cream-yellow, English small and white below), via text.js.
  - Safe zone is **x 70–930, y < 1560**. text.js centres on x=505, which is already inside it.
  - Steps ①–⑫: `caption(ctx,T,t0,t1,vi,en,{n})`, with t0/t1 = shot start+0.15 / end−0.1, at the default CAP_Y.
  - Dialogue (s9, s20, s21, s22, s25, s26): `line(...)`.
  - Place card (s1): `label(...)` "CHỢ NỔI CÁI RĂNG · 5:30 SÁNG" / "Cai Rang Floating Market · 5:30 AM".
  - Title (s5): `title(ctx,T,t0,t1,y,'Grilled Pork Sausage Rolls','NEM NƯỚNG','CÁI RĂNG',s1,s2)`. Cambria Bold (TitleSerif) has all the accented capitals.
  - End card (s27, from 82.2): `endCard(ctx,T,82.2,{l1:'NEM NƯỚNG',l2:'CÁI RĂNG',vi:'Nướng thơm. Cuốn chặt. Chấm đẫm!',en:'Grilled. Rolled. Dipped!'})`.
  - Copy the exact strings from the plan.
  - Keep important picture content (faces, the roll) out of the caption band y≈1330–1500 while a caption is showing, or accept the dark backdrop over it.
- **Performance:** target **< 0.25 s/frame**. Cache custom backgrounds at module level; never re-create big canvases per frame; ≤ ~300 particles per frame.
- **Verify:**
  - From the nemnuong folder, run `node render.js --sheet <times> <name>.png` with 2–3 times per shot, e.g. `--sheet 0.5,1.8,3.3 a1.png`. Output goes to `previews\`.
  - **Look at the images** (Read tool) and fix anything ugly or wrong:
    - clipping, empty areas, text outside the safe zone
    - floating characters (people must sit/stand IN the boats at the documented deck height; boats must sit IN the water with a waterline, not float above it)
    - wrong relative scale (people vs boats vs food)
    - hands not reaching props
  - Re-check after fixing. Each shot should read clearly as a phone video.
- **Report:** which shots are done, the preview paths, known weaknesses, and any nprops fix you made.

## Characters
- **Cô Út** (vendor): nón lá, earthy-pink áo bà ba, khăn rằn (black/white checked scarf), bamboo hand fan; sits in her small boat behind a clay charcoal stove with nem skewers.
- **Tourist** (series regular): blond, sunglasses pushed up on his head, turquoise tee, backpack, plus an **orange life vest**. Sits in a small rowing xuồng.
- **Chú lái xuồng** (boatman): grey tee, bucket hat, oar; rows the tourist's xuồng, pulls the boats together with the oar in s25.
- Background traders on ghe with tall cây bẹo poles; a passing motorboat (s21) whose wake pushes the two boats apart.

## nprops.js API, condensed
The nprops.js header (lines 1–~175) is the source of truth; this is a condensed copy.

- **Conventions:** drawers take `(ctx,x,y,s,o)` unless the header says otherwise; they save/restore ctx, are deterministic in `o.t`/`o.seed`, cache static scenery and return screen points. `COL` is the sunrise palette. **Never use `ctx.filter` blur** (Skia charges ~10 ms per call).
- **Warm-up:** the first call of `floatingMarket`, `coUtBoat` and `herbBasket` builds caches (up to ~210 ms). Call them once at module load.
- **Character scale (s=1, up is negative):**
  - Cô Út standing (`o.sit:0`): origin between the feet; eyes ≈-431, nón apex ≈-571. Seated (the default for every pose except `'stand'`): origin = deck under her stool, eyes ≈-270.
  - Tourist standing: origin between the feet, hips -240, eyes -462. Seated: origin = deck under the hips, eyes ≈-270.
  - Boatman: origin between the feet, eyes -440. Vendor: ≈340 tall.
  - Face close-ups `coUtFace` / `touristFace`: origin between the eyes, head ≈300 wide, chin y≈200.
- **Boats (origin = waterline centre, px at s=1):**
  - `ghe`: 1900 long, gunwale -250, deck -137.5; bẹo pole base x=625.
  - `coUtBoat`: 1600 long, gunwale -210, deck -105; `ret.stool` at x=-50, stove x=155.
  - `xuongBaLa`: 1100 long, gunwale -135, deck -55; `ret.seat` (100,-100) for the tourist; boatman at x=-375; oarlock (-425,-210).
  - `motorBoat`: 1600 long; exhaust at (-750,-490).
  - **To put someone in a boat:** draw the boat with `{part:'back'}`, then the person at `ret.deck` / `ret.stool` / `ret.seat`, then the boat with `{part:'front'}`.
- **Environment:** `dawnSky`, `sun`, `floatingMarket(ctx,t,o)` (full-frame drone wide; returns `{horizon,sun,project}`), `riverSide(ctx,t,panX,o)` (water-level background with an `o.mid` callback for your boats/people, plus a foreground water overlay), `water`, `ripples`, `boatWake`, `bigWave` (returns `{crest}`), `splash` (`o.spikes`), `mist`.
- **Boats and props:** `ghe`, `motorBoat`, `xuongBaLa`, `coUtBoat`, `beoPole` (returns its tip; can hang the giant roll), `fruit`, `puffs`.
- **Characters:**
  - `coUt` poses: stand, fan, flip, hook, offer, roll, pole, thumbs, wave, cheer.
  - `tourist` poses: sit, yawn, photo, point, sniff, rollBig, split, bite, hug (self-hug), cheer.
  - `boatman` poses: row, pull, nod, cheer.
  - Also `coUtFace`, `touristFace`, `touristFaceOpts`, `vendor`, `crowdBoats`, `miniHead`.
  - touristFace expressions include neutral, smile, sniff, wow, panic, chew, bliss.
- **Food:**
  - `charcoalStove`, `grillRack`, `nemSkewer` (`o.cook` raw→charred; `o.drip:false`), `nemShaping`, `handFan`, `tongs`, `nemPlate`.
  - `ricePaper`, `waterBasin`, `herb` (+ per-herb aliases), `herbBasket`, `ramRoll` (`o.snap`).
  - `rollAssembly` (`o.layers` 0..6, `o.roll` 0..1), `nemRoll`, `nemRollCut` (backlit cross-section), `giantRoll`.
  - `sauceBowl`, `sauceStream`, `toppingFall`.
- **FX:** `smoke` (ribbon along a path), `embers`, `steam`/`steamWisps`, `sizzle`, `flavorBurst`, `waveWhoosh`. No hearts or CTA parts here: port those from banhtrangtron s28.
- **Known weaknesses, work around them:**
  - `rollAssembly` at roll .45–.8 looks schematic. Pass through that range fast; don't hold on it.
  - `ricePaper` with `wet`+`sag` together droops into a teardrop; use one or the other.
  - `charcoalStove` `o.flare` draws a lens streak across the whole frame; use it only where you want that.
  - `floatingMarket` zoomed in costs ~30 ms; keep the other layers on top of it light.

## Per-shot prop hints
| # | Props |
|---|---|
| 1 | Drone over the dawn floating market (floatingMarket, camera drifting down/forward), label |
| 2 | Tourist's xuồng gliding between big ghe, boatman rowing, tourist yawning then taking a photo; mist, sun glitter |
| 3 | Cây bẹo close-up backlit by the sun (produce silhouettes, rim light, flare), slow push |
| 4 | Charcoal smoke ribbon snakes across the water into the tourist's nose; he turns, sniffs (touristFace 'sniff') |
| 5 | Ember/spark slow-mo macro over the coals, flash 12.0 (automatic), title |
| 6 | ① hands shaping pink nem paste on bamboo sticks |
| 7 | ② grill rack over coals, Cô Út fanning on each beat, smoke + sparks |
| 8 | ③ skewers flipped with tongs, caramelising, fat drip flare |
| 9 | Cô Út hooks the tourist's xuồng with a bamboo hook, boats bump together; line "Ăn nem hông con?" / "Want some nem?" |
| 10 | ④ rice paper dipped in water, going translucent |
| 11 | ⑤ top-down: herbs land on the rice paper on beats (rollAssembly layers) |
| 12 | ⑥ star fruit + green banana slices land |
| 13 | ⑦ pickles + crispy ram (crack) |
| 14 | ⑧ hot nem slides off the skewer onto the paper, steam, slow-mo |
| 15 | ⑨ rolling it tight (rollAssembly roll 0→1), pats on beats |
| 16 | ⑩ thick orange sauce pours into the bowl (flash 48.0 automatic) |
| 17 | ⑪ peanuts + chili garlic + scallion oil land on the sauce |
| 18 | Cross-section of the roll, backlit, flare, slow rotation (no text) |
| 19 | ⑫ roll dipped deep into the sauce, slow lift with a drip |
| 20 | Tourist builds a burrito-size giant roll; line "Cuốn kiểu Mỹ!" / "American size!" (flash 60.0 automatic) |
| 21 | Motorboat passes, wake pushes the boats apart; tourist in the splits between two gunwales; line "Ơ ơ ơ…!" / "Whoa whoa whoa…!"; camera shake |
| 22 | Cô Út hangs the roll on the tip of a long cây bẹo pole; line "Để cô đưa!" / "I got you!" |
| 23 | Roll dangles across the water toward his open mouth; slow; silence 71.4–72.0 |
| 24 | Bite at 72.0 (flash automatic), touristFace bliss + flavorBurst, 4 words revealed one per beat: Thơm! Giòn! Mát! Béo! / Smoky! Crunchy! Fresh! Rich! |
| 25 | Boatman pulls the boats back together with the oar; tourist hugs belly; line "Ngon hết sẩy!" / "Absolutely amazing!" |
| 26 | Whole market raises rolls; counts on 78.6/79.2/79.8, "DZÔ!" at 80.4; line "Một, hai, ba… DZÔ!" / "One, two, three… CHEERS!" |
| 27 | Crane up over the market, sun higher and golden, endCard at 82.2 |
| 28 | CTA (port banhtrangtron s28): blurred market background; heart pulse every 0.6s, tap ~85.2, FOLLOW press ~87.0; lines "Thấy ngon thì LIKE & FOLLOW nhé!" / "Hungry? LIKE & FOLLOW for more!" + question "Bạn cuốn mấy cuốn một lần?" / "How many rolls can you eat?" |
