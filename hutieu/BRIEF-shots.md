# Brief for the shot writers: Hủ tiếu chợ nổi Cái Răng (hutieu/)

Folder: `D:\DishTales-hoathinh\hutieu\` (Node + @napi-rs/canvas, 1080×1920 vertical, 30 fps, **70 s**).

Read these first:
- `PLAN-hu-tieu.md`: the 22-shot table with timing, framing, content and the exact bilingual text. Copy strings exactly.
- `shots.js`: the TIMES table and how shot files are loaded.
- `render.js`: the draw call, flashes and colour grade.
- `text.js`: caption, line, label, title, endCard, fadeIO and CAP_Y.
- The header of **`hprops.js`** (new props for this video: daySky, morning market, hutieuBoat, brothPot, ladle, brothStream, noodleBasket, noodles, huTieuBowl, toppings, selfieSign, slurpRings, noodleZip, heron, steamBurst, new poses). Read it, it is the source of truth.
- The header of `nprops.js`: river, boats, coUt, tourist, boatman, crowdBoats, vendor, steam, flavorBurst...
- `people.js`: tourist, face, eyeMacro, thumbsUp, SKIN, HAIR, SHIRT.
- `lib.js`: cam, ease, inv, glow, flare, godRays, dust, bokeh, sparkle, motionBlurX, buffer.

Prop previews: `previews\hprops_*.png` (and `D:\DishTales-hoathinh\nemnuong\previews\props_*.png` for nprops).

Style and structure references (same toolkit):
- `D:\DishTales-hoathinh\nemnuong\shotsA.js|shotsB.js|shotsC.js` (the previous video, same river world but at sunrise).
- CTA reference: `D:\DishTales-hoathinh\nemnuong\shotsC.js` → `s28`. Port its structure to s22 here: swap in this video's sunny background, the 0.625 s grid, the new timing (65.0–70.0) and the new text.

## Contract
- **Shot signature:** `function sN(ctx, lt, p, T)`.
  - `lt` is local time in the shot (s), `p` is progress 0..1, `T` is global time.
  - Paint the **full frame** with an opaque background. render.js wraps each call in save/restore.
- **Files:**
  - `shotsA.js` exports s1..s8, `shotsB.js` exports s9..s15, `shotsC.js` exports s16..s22.
  - Do not edit shots.js, render.js, audio.js or another agent's shot file.
- **Helpers:**
  - Do not change existing exports in hprops.js, nprops.js, people.js, lib.js, text.js, props.js.
  - Put any new helper inside your own shot file.
  - Tiny backward-compatible bug fixes in hprops.js/nprops.js are OK; list them in your report.
- **Music grid: 96 BPM (cumbia + surf guitar).**
  - 1 beat = **0.625 s**, 1 bar = 2.5 s. Beats fall on T = n·0.625. Every cut is already on that grid.
  - Helper: `const beat = T => (T / 0.625) % 1` (0 on the beat); `1 - beat` is a decaying hit.
  - On-beat motions:
    - basket shakes, 3 on the beat (s7)
    - each topping landing on its own beat (s9: 22.5→26.25)
    - garlic sprinkle pulses (s10)
    - the market's group "SỤP!" at 52.5 / 53.125 / 53.75 / 54.375 (s19)
    - heart pulses (s22, every 0.625 s)
    - FOLLOW press at 66.25, wink at 66.875
- **Flashes** are drawn by render.js at 8.75, 30.0, 40.0, 47.5, 52.5, 60.0, 66.25. Don't draw your own white flash at those times.
  - render.js also applies the warm/teal grade, vignette and grain. Don't double-grade heavily.
- **Comedy beats (Act III):**
  - s15: the tourist sips tiny spoonfuls with his pinky up. Dì Bảy shakes her head, then demonstrates a neat slurp.
  - s16: he pulls his sunglasses down, hands his backpack to the boatman and inhales hugely.
  - s17: the huge SLURP at 47.5. Noodles zipline into his mouth and the bowl drains. Slurp rings spread across the river, boats rock, a nón lá flies off and herons take off.
  - s18: the whole market freezes and stares. The last noodle slaps his sunglasses at 51.25. **Silence 51.875–52.5**: freeze everything except water ripples.
  - s19: Dì Bảy grins and raises her bowl. The whole market slurps in unison on 4 beats.
- **Cinematic tools:**
  - Camera: `L.cam(ctx,cx,cy,zoom,rot,fn)` for drone, push-in, dolly, gentle boat rocking, shake (s17).
  - Depth: foreground bokeh, out-of-focus gunwales/cây bẹo produce.
  - Backlight: rim light, lens flare, godRays through steam, sparkle on water.
  - Slow-motion feel in s4, s8, s11.
- **Palette: Cái Răng at 8:00 AM, hard sunshine** (must look very different from nem nướng's pink sunrise).
  - Deep blue sky with white cumulus, a high white-gold sun, no mist.
  - Hard shadows, dense sparkle on the water.
  - Saturated boats (red and green hulls, yellow pineapples, orange pumpkins, striped watermelons).
  - White steam popping against the blue sky.
  - Use hprops' morning mode (`tod:'morning'`) and `daySky`.
- **Text:** every on-screen text is bilingual (Vietnamese big cream-yellow, English small white below), via text.js.
  - Safe zone: **x 70–930, y < 1560**.
  - Steps ①–⑨: `caption(ctx,T,t0,t1,vi,en,{n, y:360})`. Place them high (y≈300–420) so they don't cover the bowl. t0/t1 = shot start+0.15 / end−0.1.
  - Dialogue (s6, s15, s16, s20): `line(...)`.
  - Place card (s1): `label(...)` "CHỢ NỔI CÁI RĂNG · 8:00 SÁNG" / "Cai Rang Floating Market · 8:00 AM".
  - Title (s4): `title(ctx,T,t0,t1,y,'Floating Market Noodle Soup','HỦ TIẾU','CHỢ NỔI',s1,s2)`.
  - End card (s21, from 60.0): `endCard(ctx,T,60.0,{l1:'HỦ TIẾU',l2:'CHỢ NỔI',vi:'Nóng hổi. Ngọt xương. Húp thật to!',en:'Hot. Rich. Slurp loud!'})`.
  - Big comic word in s17: **SỤUUUP!** / **SLUUURP!**. Make it bold and shaky but keep it inside the safe zone.
- **Performance:** target **< 0.25 s/frame**. Cache backgrounds at module level, never re-create big canvases per frame, ≤ ~300 particles per frame.
- **Verify:**
  - From the hutieu folder: `node render.js --sheet <times> <name>.png`, 2–3 times per shot (output in `previews\`).
  - **Look at the images** (Read tool) and fix anything wrong:
    - clipping, empty areas, text outside the safe zone
    - floating characters: people sit IN boats at deck height; boats sit IN the water with a waterline
    - wrong scale between people, boats and food
    - hands not reaching props
  - Re-check after fixing.
- **Report:** shots done, preview paths, known weaknesses, any hprops/nprops fixes.

## Characters
- **Dì Bảy** (vendor): `coUt` with `palette` set to Dì Bảy (cobalt áo bà ba, red-black khăn rằn, nón lá). Sits in her noodle boat (`hutieuBoat`) behind the big broth pot.
- **Tourist** (series regular): blond, sunglasses pushed up on his head, turquoise tee, backpack, orange life vest, sweating. Sits in a small rowing xuồng.
- **Chú lái xuồng** (boatman): grey tee, bucket hat, oar.
- Background traders on ghe with tall cây bẹo poles (`crowdBoats`, `vendor`); in s19 they all hold bowls (`item:'bowl'`, `slurp`).
