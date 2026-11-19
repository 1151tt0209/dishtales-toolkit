# Brief for the shot writers: Bánh xèo miền Tây (banhxeo/)

Folder: `D:\DishTales-hoathinh\banhxeo\` (Node + @napi-rs/canvas, 1080×1920 vertical, 30 fps, **69.6 s**).

Read these first:
- `PLAN-banh-xeo.md`: the 22-shot table with timing, framing, content and the exact bilingual text. Copy the strings exactly.
- `shots.js`: the beat CUTS / TIMES table and how shot files are loaded.
- `render.js`: the draw call, flashes and colour grade.
- `text.js`: caption, line, label, title, endCard, fadeIO, CAP_Y.
- `bxprops.js`, then the API headers of **`bx_env.js`, `bx_chars.js`, `bx_food.js`, `bx_fx.js`**. These are this video's props: sunset sky and water, stilt house, riverside scene, kitchen interior, herb garden, Má Tư, tourist poses, ducks, boatman, batter, pan stages, banhXeo, herbs, fish sauce, leafWrap, sizzleWord, steamEruption, crumbBurst, flyingCrepe… The headers are the source of truth.
- Also available: `BX.HP` (hprops: hủ tiếu library) and `BX.NP` (nprops: river world), `people.js` (tourist, face, eyeMacro, thumbsUp), `lib.js` (cam, ease, inv, glow, flare, godRays, dust, bokeh, sparkle, motionBlurX).

Prop previews: `previews\bxenv_*.png`, `bxchars_*.png`, `bxfood_*.png`, `bxfx_*.png`.

Style and structure references (same toolkit): `D:\DishTales-hoathinh\hutieu\shotsA.js|shotsB.js|shotsC.js` (the previous video). CTA reference: `hutieu\shotsC.js` → `s22`. Port its structure to s22 here with the dusk riverside background, the 0.48 s grid and the new timing/text.

## Contract
- **Signature:** `function sN(ctx, lt, p, T)`. `lt` = local time in the shot (s), `p` = progress 0..1, `T` = global time. Paint the **full frame** with an opaque background. render.js wraps each call in save/restore.
- **Files:** `shotsA.js` exports s1..s8, `shotsB.js` exports s9..s15, `shotsC.js` exports s16..s22. Don't edit shots.js, render.js, audio.js or another agent's shot file.
- **Helpers:** don't change existing exports in bx_*.js, hprops/hp_*, nprops, people, lib, text, props. New helpers go inside your own shot file. Tiny backward-compatible bug fixes in bx_*.js are OK; list them in your report.
- **Music grid: 125 BPM swing (gypsy jazz).** 1 beat = **0.48 s**, 1 bar = 1.92 s; beats at T = n·0.48. Helper: `const beat = T => (T / 0.48) % 1`.
  - On-beat motions: knife chops at 14.4/14.88/15.36/15.84 (s6), spatula tosses (s7), garlic/chili drops at 35.04/35.52/36.0 (s13), the catch landing exactly at 52.8 (s19), duck quacks at 53.28/53.76/54.24, heart pulses (s22), FOLLOW press at 65.76, wink at 66.24.
- **Flashes** are drawn by render.js at 8.64, 28.8, 40.32, 44.16, 52.8, 60.48, 65.76. Don't add your own white flashes there. render.js also applies the warm/teal grade, vignette and grain; don't double-grade.
- **Comedy (Act III):**
  - s15: knife & fork, pinky up; "Let me try!"; Má Tư's eyebrow, hands him the spatula + tiny apron.
  - s16: he dumps the whole batter bowl → eruption at 44.16, mushroom steam, hair blown back, glasses fogged; big shaky "XÈÈÈÈO!!!" / "SIZZZZLE!!!".
  - s17: chef flip → the crêpe launches out of the window; slow-mo spin against the sunset; his mouth open.
  - s18: crêpe flies over the canal like a frisbee, boatman ducks, ducks follow in a line. **Silence 51.84–52.8**: freeze everything except water ripples, all looking up.
  - s19: Má Tư steps out with a plate; the crêpe lands perfectly folded at 52.8; ducks quack 3× on beats; tourist applauds and bows.
  - s20: wrap in a mustard leaf, dip, CRUNCH (~58.0), crumbs, eye-macro sparkle, thumbs up.
- **Cinematic:** `L.cam(ctx,cx,cy,zoom,rot,fn)` for drone, push-ins, dollies, shake (s16). Depth via foreground bokeh/leaves. Backlight: rim light, flare, godRays through steam and bamboo slats, sparkle on water. Slow-motion feel in s8, s11, s17.
- **Palette: golden hour → sunset → dusk.** Acts I–II gold (dusk ≈ 0–0.3); kitchen dark with red fire glow and orange beams; Act III sunset (dusk ≈ 0.4–0.6); s21–s22 dusk (≈ 0.8–1) with deck lights on. Must not look like the blue-sky hủ tiếu or the pink sunrise nem nướng.
- **Text:** all bilingual (VI big cream-yellow, EN small white) via text.js. Safe zone **x 70–930, y < 1560**.
  - Steps ①–⑨: `caption(ctx,T,t0,t1,vi,en,{n, y:360})`, high on screen (y≈300–420) so the food stays clear. t0/t1 = shot start + 0.15 / end − 0.1.
  - Dialogue (s15, s19, s20): `line(...)`.
  - Place card (s1): `label(...)` "NHÀ VEN SÔNG · 5 GIỜ CHIỀU" / "Mekong riverside home · 5 PM".
  - Title (s4): `title(ctx,T,t0,t1,y,'Mekong Sizzling Crêpe','BÁNH XÈO','MIỀN TÂY',s1,s2)`.
  - End card (s21, from 60.48): `endCard(ctx,T,60.48,{l1:'BÁNH XÈO',l2:'MIỀN TÂY',vi:'Đổ xèo. Gấp giòn. Cuốn lá cải!',en:'Pour. Sizzle. Wrap & crunch!'})`.
  - Comic words via `sizzleWord` inside the safe zone.
- **Performance:** < 0.25 s/frame. Cache backgrounds at module level, never create big canvases per frame, ≤ ~300 particles per frame.
- **Verify:** from the banhxeo folder run `node render.js --sheet <times> <name>.png` (output in `previews\`), 2–3 times per shot. **Look at the images** (Read tool) and fix: clipping, empty areas, text outside the safe zone, floating characters (people sit ON stools / IN boats; boats IN the water with a waterline; the house stands on stilts in the water), wrong scale between people, house, boats and food, hands not reaching props. Re-check after fixing.
- **Report:** shots done, preview paths, known weaknesses, any bx_* fixes.
