# v2 draft (paused): bánh xèo ~58 s with cooking steps + tourist gags

Paused 19/11/2026 at the user's request. Not wired in; the 40 s version in the parent folder is the finished one.

What exists here:
- `shots.js`: the new 70-beat timeline (58.333 s). It reuses s1..s16 unchanged by passing each a "virtual T" on the old 40 s timeline,
  and inserts new shots that are NOT written yet:
  - `shotsC.js` (kitchen): `n1` ① batter mixing, `h2` tourist sneaks a crispy edge and gets a spatula tap, `n2` ⑦ fish sauce.
  - `shotsD.js` (tourist): `h1` arrives at Má Tư's shop and orders, `h4` knife & fork → "use your hands", `h6` wrap as big as his head,
    `h5` plate tower, "one more!".
- `overlay.js`: numbered step captions ①–⑨ (badge) + dialogue lines (`talk`) on the new timing.
- `render.js`: flashes moved to 25.0 / 46.667 / 51.667 and DUR taken from shots.js.

To resume: copy these three files over the parent ones, write shotsC.js + shotsD.js, regenerate `audio.js` for 58.333 s
(old cue times shift by shot: s2–s8 +5.0, s9–s11 +7.5, s12–s13 +13.333, s14–s15 +15.833, s16 +18.333), then render.
