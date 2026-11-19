# Brief for the shot writers: Cơm tấm Sài Gòn (comtam/)

Folder: `D:\DishTales-hoathinh\comtam\` (Node + @napi-rs/canvas, 1080×1920 vertical, 30 fps, **68.267 s**). Use absolute paths in Bash (`/d/DishTales-hoathinh/comtam/...`); the cwd resets after every call.

## Read these first
- `PLAN-com-tam.md`: the 23-shot table with timing, framing, content and the exact bilingual text. Copy the strings exactly.
- `shots.js`: the beat CUTS / TIMES table and how shot files are loaded.
- `render.js`: the draw call, flashes and colour grade.
- `text.js`: caption, line, label, title, endCard, fadeIO, CAP_Y.
- `ctprops.js`, then the API headers of **`ct_env.js`, `ct_chars.js`, `ct_food.js`, `ct_fx.js`**. These are this video's props:
  - Environment: blue-hour → sunrise Saigon sky, rooftop aerial, alley + cart + neon "CƠM TẤM" sign, counter, grill close.
  - Characters: Cô Năm (vendor; fan/tongs/plate/pour/eyebrow/laugh/wipe/steer/wave poses), the tourist (sniff/grabFan/fanFrantic/stiff/sit/eat with soot, hairUp and raccoon options), cat, rooster.
  - Food: broken rice, pot, pork chop (cook/flip), chops on grill, marinade, bì, chả trứng, mỡ hành, fried egg, đồ chua, nước mắm, the hero comTamPlate (items progress, angle, mam), spoonBite, tongs.
  - Fx: charcoalSmoke, sizzle, flareUp, sparks, steam, powderPuff, glazeSparkle, smellLines, fanWhoosh, poofCloud, coughSmoke, comicWord, heartPop, followButton.
  - The headers are the source of truth.
- Also available:
  - `CT.BP` (bprops: smoke, embers, flames, brazier, grill, fan, plate…), `CT.KT` (kitchen: pan, egg, bowl, steamer…) and `CT.SG` (sgworld: Saigon street/aerial/motorbike).
  - `people.js` (tourist, face, eyeMacro, thumbsUp).
  - `lib.js` (cam, ease, inv, glow, flare, godRays, dust, bokeh, sparkle, motionBlurX).

Prop previews: `previews\ctenv_*.png`, `ctchars_*.png`, `ctfood_*.png`, `ctfx_*.png`.

Style/structure reference (same toolkit): `D:\DishTales-hoathinh\caloc\shotsA.js|shotsB.js|shotsC.js`. CTA reference: `caloc\shotsC.js` → `s22`. Port it to **s23** here with the alley/sunrise background, the 8/15 s grid and the new timing/text.

## Contract
- **Signature:** `function sN(ctx, lt, p, T)`. `lt` = local time in the shot (s), `p` = progress 0..1, `T` = global time.
  - Paint the **full frame** with an opaque background.
  - render.js wraps each call in save/restore.
- **Files:**
  - `shotsA.js` exports s1..s8.
  - `shotsB.js` exports s9..s15.
  - `shotsC.js` exports s16..s23.
  - Don't edit shots.js, render.js, audio.js or another agent's shot file.
- **Helpers:**
  - Don't change existing exports in ct_*.js, bprops, kitchen, sgworld, people, lib, text or props.
  - New helpers go inside your own shot file.
  - Tiny backward-compatible bug fixes in ct_*.js are OK; list them in your report.
- **Music grid: 112.5 BPM city-pop/disco-funk.** 1 beat = **8/15 s (0.5333)**, beat n at T = n·8/15. Helper: `const beat = T => (T * 1.875) % 1`.
  - Act I:
    - Neon flicker 4.8–5.33 (s2).
    - Fan strokes at 6.4 / 6.933 / 7.467 / 8.0 (s3).
    - Title at 8.533.
  - Act II:
    - Lid 12.8 (s5).
    - Marinade drops on the beats 14.933, 15.467, 16.0, 16.533 (s6).
    - **Flips at 17.067 / 18.133 / 19.2** (s7).
    - Puff 20.267 (s8).
    - Knife cut ~23.467 (s9).
    - Oil pour ~24.8 (s10).
    - Egg crack ~27.2 (s11).
    - Plating items at 30.933 (rice), 32.0 (chop), 32.533 (bì), 33.067 (chả), 33.6 (egg), 34.133 (mỡ hành), 34.667 (pickles/cucumber/tomato) (s13).
    - Fish-sauce pour 37.333–39.0 (s15).
  - Act III:
    - Fanning frenzy 42.667–44.8 (s17).
    - **POOF at 45.867** (s18).
    - **Silence 47.467–48.533** (s19: hold still, only slow smoke).
    - **Cough at 49.067**.
    - Towel wipe ~52.0 (s20).
    - Bite ~54.4 (s21).
  - End and CTA:
    - End card 57.6.
    - Heart ~63.5, **FOLLOW press 64.533**, **wink 65.067** (s23).
- **Flashes** are drawn by render.js at 8.533, 17.067, 30.933, 39.467, 45.867, 57.6 and 64.533. Don't add your own white flashes there. render.js also applies a warm/teal grade, vignette and grain; don't double-grade.
- **Dawn progression** (pass `dawn` to the env sky/alley):
  - About 0 in s1–s4 (deep blue hour, neon strong).
  - Rising 0.2→0.6 through Act II.
  - About 0.7–0.85 in s14–s15 (peach backlight).
  - About 0.9–1 in Act III and the end (sunrise with warm shafts through smoke; neon still on but weaker).
- **Comedy (Act III):** follow the plan. Timing must land exactly on the cues above.
  - s16: "Để tôi quạt cho!" / "Let me help!" and Cô Năm's raised eyebrow.
  - s17: frantic fanning with motion blur and speed lines.
  - s18: giant POOF swallows him completely.
  - s19: smoke thins slowly in silence; he's revealed stiff, sooty, hair up, blinking white eyes; coughs a smoke ring at 49.067 with "KHỤ!" / "COUGH!".
  - s20: Cô Năm laughs, takes the fan, seats him, wipes his face. The towel leaves a clean raccoon stripe: "Ngồi đi, để cô!" / "Sit down, leave it to me!".
  - s21: he eats, bliss, thumbs up, still sooty with the stripe: "Ngon bá cháy!" / "Absolutely FIRE!".
- **Cinematic:**
  - Camera and depth:
    - `L.cam(ctx,cx,cy,zoom,rot,fn)` for the drone, push-ins, dolly and orbit.
    - Shake on the POOF.
    - Depth via foreground smoke/bokeh, a neon blur, and foreground stool/plant silhouettes.
  - Light:
    - Ember orange from below.
    - Neon pink/cyan rim.
    - Cool blue ambient, turning into peach sunrise.
    - Smoke lit by lamps/neon/sun shafts.
  - Slow-motion feel in s3, s7, s11 and s14.
  - Food close-ups must be appetizing: gloss, steam, sparkle.
- **Text:** all bilingual (VI big cream-yellow, EN small white) via text.js. Safe zone **x 70–930, y < 1560**.
  - Steps ①–⑩: `caption(ctx,T,t0,t1,vi,en,{n, y:360})`, high on screen (y≈300–420) so the food stays clear. t0/t1 = shot start + 0.15 / end − 0.1.
  - Dialogue (s16, s20, s21): `line(...)`.
  - Place card (s1): `label(ctx,T,0.35,4.0,'SÀI GÒN · 5 GIỜ SÁNG','Saigon · 5 AM',470)`.
  - Title (s4): `title(ctx,T,8.533,12.7,420,'Saigon Broken Rice','CƠM TẤM','SÀI GÒN',112,86)`.
  - End card (s22): `endCard(ctx,T,57.6,{l1:'CƠM TẤM',l2:'SÀI GÒN',vi:'Than hồng. Sườn nướng. Chan mắm!',en:'Charcoal. Pork chop. Fish sauce!'})`.
  - CTA question (s23): "Bạn thích sườn, bì hay chả?" / "Team pork chop, skin or egg cake?".
  - Comic words via `comicWord` inside the safe zone.
- **Performance:** < 0.25 s/frame. Cache backgrounds at module level, never create big canvases per frame, ≤ ~300 particles per frame.
- **Verify:**
  - From the comtam folder run `node render.js --sheet <times> <name>.png` (output in `previews\`), 2–3 times per shot.
  - **Look at the images** (Read tool) and fix:
    - Clipping, empty areas, text outside the safe zone.
    - Floating characters: people stand ON the floor line, stools sit ON the floor, the plate sits ON the counter.
    - Wrong scale between people, cart, stools and food.
    - Hands not reaching props (fan, tongs, spoon).
    - Scenes too dark to read.
  - Re-check after fixing.
- **Report:** shots done, preview paths, known weaknesses, any ct_* fixes.
