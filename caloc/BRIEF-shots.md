# Brief for the shot writers: Cá lóc nướng trui (caloc/)

Folder: `D:\DishTales-hoathinh\caloc\` (Node + @napi-rs/canvas, 1080×1920 vertical, 30 fps, **70.0 s**).

Read these first:
- `PLAN-ca-loc.md`: the 22-shot table with timing, framing, content and the exact bilingual text. Copy the strings exactly.
- `shots.js`: the beat CUTS / TIMES table and how shot files are loaded.
- `render.js`: the draw call, flashes and colour grade.
- `text.js`: caption, line, label, title, endCard, fadeIO, CAP_Y.
- `clprops.js`, then the API headers of **`cl_env.js`, `cl_chars.js`, `cl_food.js`, `cl_fx.js`**. These are this video's props: moonlit night sky, flooded field, dike + bonfire spot, low water view, fireflies, Chú Ba (head torch, poses), tourist night poses (grab/slip/slap/wobble/fallBack/popUp with lotus hat + frog), frog, snakehead (alive/skewered/charred/scraped/plated), straw pile, lotus spread, chili salt, lime, rice-paper roll, basket, trap, strawFire, sparks, smoke, whoosh, fireLight, torchBeam, splashCrown, bubbles, comicWord, dizzy, steam… The headers are the source of truth.
- Also available: `CL.BX` (bánh xèo library: herbs, leaf wraps, sizzleWord…), `CL.HP` (hprops), `CL.NP` (nprops: river world, xuồng, splash, ripples), `people.js` (tourist, face, eyeMacro, thumbsUp), `lib.js` (cam, ease, inv, glow, flare, godRays, dust, bokeh, sparkle, motionBlurX).

Prop previews: `previews\clenv_*.png`, `clchars_*.png`, `clfood_*.png`, `clfx_*.png`.

Style and structure references (same toolkit): `D:\DishTales-hoathinh\banhxeo\shotsA.js|shotsB.js|shotsC.js` (the previous video). CTA reference: `banhxeo\shotsC.js` → `s22`. Port its structure to s22 here with the moonlit field background, the 2/3 s grid and the new timing/text.

## Contract
- **Signature:** `function sN(ctx, lt, p, T)`. `lt` = local time in the shot (s), `p` = progress 0..1, `T` = global time. Paint the **full frame** with an opaque background. render.js wraps each call in save/restore.
- **Files:** `shotsA.js` exports s1..s8, `shotsB.js` exports s9..s15, `shotsC.js` exports s16..s22. Don't edit shots.js, render.js, audio.js or another agent's shot file.
- **Helpers:** don't change existing exports in cl_*.js, bx_*, hprops/hp_*, nprops, people, lib, text, props. New helpers go inside your own shot file. Tiny backward-compatible bug fixes in cl_*.js are OK; list them in your report.
- **Music grid: 90 BPM "Mekong spaghetti western", straight 8ths.** 1 beat = **2/3 s (0.6667)**, 1 bar = 2.667 s; beats at T = n·2/3. Helper: `const beat = T => (T * 1.5) % 1`.
  - On-beat motions: trap slam ~7.33 (s3), skewer pushes at 16.667 / 17.333 (s6), straw armfuls at 19.333 / 20.0 (s7), lighter ~22.0 and **ignition WHOOSH at 22.667** (s8), second straw ~26.0 (s9), scrape strokes on beats 28–30.667 (s10), items placed on beats in s12 (34.0, 34.667, 35.333, 36.0), lime squeezes at 37.333 / 38.0 (s13), bounce 46.0, bonk 46.667, **SLAP 47.333** (s16), **SPLASH 50.0** (s17), pop-up 52.667 and frog RIBBIT 53.333 (s18), the bite ~58.0 (s20), heart at 64.667, FOLLOW press at 66.0, wink at 66.667 (s22).
- **Flashes** are drawn by render.js at 9.333, 22.667, 30.667, 42.0, 50.667, 60.667, 66.0. Don't add your own white flashes there. render.js also applies a warm/blue grade, vignette and grain; don't double-grade.
- **Comedy (Act III):**
  - s15: tourist rolls up his shorts at the field edge, spots a cá lóc, rubs his hands: "Để tôi bắt một con!"; Chú Ba grins and shrugs.
  - s16: grabs it bare-handed: it slips, bounces off his head (46.0), shoulder (46.667), SLAPS his face with its tail (47.333): comic "BÉP!" / "SLAP!", dizzy stars.
  - s17: wobble on one leg, arms windmilling, falls back → SPLASH crown at 50.0, comic "ÙM!" / "SPLOOSH!".
  - s18: **Silence 51.333–52.667**: freeze-ish calm, only bubbles + ripples + fireflies. Pops up at 52.667 with a lotus-leaf hat and a frog on top; frog RIBBIT at 53.333 ("ỘP!" / "RIBBIT!"); the fish leaps in an arc into Chú Ba's basket.
  - s19: Chú Ba laughs, hands him a ready roll by the fire. s20: bite, bliss, eye-macro sparkle, thumbs up (frog still on the hat).
- **Cinematic:** `L.cam(ctx,cx,cy,zoom,rot,fn)` for drone, push-ins, dollies, shake (s8 ignition, s17 splash). Depth via foreground rice stalks / bokeh fireflies. Light: cool moon rim light + warm orange fire/torch light (fireLight pools, torch beams with dust), sparks against the moon, steam lit by moonlight. Slow-motion feel in s3, s8, s11, s18 (fish arc).
- **Palette: night.** Deep indigo/teal sky and water, pale-gold full moon, green-yellow fireflies, orange fire. Readable, not mud-black: keep silhouettes rim-lit and foreground well lit by fire/torch. Must not look like the gold bánh xèo or the blue-sky hủ tiếu.
- **Text:** all bilingual (VI big cream-yellow, EN small white) via text.js. Safe zone **x 70–930, y < 1560**.
  - Steps ①–⑨: `caption(ctx,T,t0,t1,vi,en,{n, y:360})`, high on screen (y≈300–420) so the food stays clear. t0/t1 = shot start + 0.15 / end − 0.1.
  - Dialogue (s15, s19, s20): `line(...)`.
  - Place card (s1): `label(...)` "MÙA NƯỚC NỔI · 9 GIỜ TỐI" / "Mekong flood season · 9 PM".
  - Title (s4): `title(ctx,T,t0,t1,y,'Mekong Straw-Fire Snakehead','CÁ LÓC','NƯỚNG TRUI',s1,s2)` (check text.js for the exact signature).
  - End card (s21, from 60.667): `endCard(ctx,T,60.667,{l1:'CÁ LÓC',l2:'NƯỚNG TRUI',vi:'Xiên tre. Phủ rơm. Lửa phừng!',en:'Skewer. Straw. WHOOSH!'})`.
  - Comic words via `comicWord` inside the safe zone.
- **Performance:** < 0.25 s/frame. Cache backgrounds at module level, never create big canvases per frame, ≤ ~300 particles per frame.
- **Verify:** from the caloc folder run `node render.js --sheet <times> <name>.png` (output in `previews\`), 2–3 times per shot. **Look at the images** (Read tool) and fix: clipping, empty areas, text outside the safe zone, floating characters (people stand IN the water with a waterline / ON the dike; boats IN the water; the fish ON its skewer planted in the ground), wrong scale between people, boats, fire and food, hands not reaching props, scenes too dark to read. Re-check after fixing.
- **Report:** shots done, preview paths, known weaknesses, any cl_* fixes.
