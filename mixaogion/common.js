// Shared scene helpers for the Cholon crispy-noodle Short.
const L = require('./lib');
const P = require('./props');
const C = require('./cholon');
const F = require('./food');
const PE = require('./people');
const { W, H, TAU, rng, clamp, lerp, ease, at, glow, bokeh } = L;
const { ell } = P;

const bump = (t, t0, d) => (t < t0 || t > t0 + d ? 0 : Math.sin(Math.PI * (t - t0) / d));
const LCOLS = ['rgba(255,70,40,0.9)', 'rgba(255,150,60,0.9)', 'rgba(255,210,120,0.8)', 'rgba(255,90,60,0.85)', 'rgba(90,200,210,0.5)'];

function darkBg(ctx, c0 = '#1a0a08', c1 = '#060304') {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
// warm night bokeh background (lanterns out of focus), parallax offset px
function lanternBokeh(ctx, t, seed = 7, a = 0.5, px = 0, py = 0) {
  darkBg(ctx, '#210b0a', '#070304');
  ctx.save(); ctx.translate(px, py);
  bokeh(ctx, t, seed, 26, LCOLS, a, 40, 140);
  bokeh(ctx, t, seed + 1, 18, LCOLS, a * 0.6, 14, 50);
  ctx.restore();
}
function sky(ctx, t) {
  C.nightSky(ctx, -900, -1800, 3200, 3700, 700);
  C.stars(ctx, -900, -1800, 3200, 2300, t, 3, 220);
  C.moon(ctx, 900, -260, 54);
}
// wok contents. st: {sea, meat, veg, sauce, gloss, oil, t, seed}
const ITEMS = (() => {
  const r = rng(321), out = [];
  const add = (kd, n, grp) => { for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.78; out.push({ kd, grp, a, d, rot: r() * TAU, ph: r() * TAU }); } };
  add('shrimp', 6, 'sea'); add('squid', 5, 'sea'); add('pork', 5, 'meat'); add('liver', 3, 'meat'); add('gizzard', 3, 'meat');
  add('bok', 6, 'veg'); add('carrot', 5, 'veg'); add('mush', 4, 'veg');
  return out;
})();
function wokFill(st) {
  return (ctx, rx, ry) => {
    const t = st.t || 0, k = ry / rx;
    if (st.oil) { ell(ctx, 0, 0, rx, ry); ctx.fillStyle = `rgba(200,140,40,${0.55 * st.oil})`; ctx.fill(); F.oilBubbles(ctx, t, 5, 0, 0, rx * 0.85, ry * 0.85, 50, st.oil); }
    if (st.sauce) {
      ell(ctx, 0, ry * 0.1, rx * 0.8, ry * 0.75);
      const g = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 4, 0, 0, rx * 0.8);
      g.addColorStop(0, `rgba(190,110,40,${0.9 * st.sauce})`); g.addColorStop(1, `rgba(90,40,12,${0.9 * st.sauce})`);
      ctx.fillStyle = g; ctx.fill();
    }
    const list = ITEMS.filter(it => (st[it.grp] || 0) > 0).map(it => {
      const swirl = (st.swirl || 0) * t;
      return { ...it, px: Math.cos(it.a + swirl) * it.d * rx, py: Math.sin(it.a + swirl) * it.d * ry };
    }).sort((a, b) => a.py - b.py);
    const r = rng(st.seed || 9);
    for (const it of list) {
      const show = st[it.grp];
      if (r() > show) continue;
      at(ctx, it.px, it.py, 0, 1, clamp(k * 1.6, 0.45, 1), () => F.topping(ctx, it.kd, 0, 0, st.s || 1, it.rot + (st.swirl || 0) * t * 0.5));
    }
    if (st.sauce > 0.2 || st.gloss) F.gravyBlob(ctx, 0, 0, rx * 0.62, ry * 0.62, t, 0.45 * Math.max(st.sauce || 0, st.gloss || 0), 4);
    if (st.gloss) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; const rr = rng(44);
      for (let i = 0; i < 24; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * 0.7; ctx.globalAlpha = st.gloss * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))); ctx.fillStyle = 'rgba(255,230,180,0.9)'; ell(ctx, Math.cos(a) * d * rx, Math.sin(a) * d * ry, 8 + rr() * 16, 3 + rr() * 4); ctx.fill(); }
      ctx.restore();
    }
  };
}
// mirrored ladle (handle up-left)
function ladleL(ctx, x, y, s, rot = 0, liquid = null) { at(ctx, x, y, 0, -1, 1, () => F.ladle(ctx, 0, 0, s, -rot, liquid)); }

// the whole street in world coords; o: {fire, chef:{...}, wok:{...}, t, tourist fn, noChef}
function streetWorld(ctx, t, o = {}) {
  sky(ctx, t);
  C.drawStreet(ctx);
  // lantern strings across the street
  C.lanternString(ctx, -320, 360, 1400, 400, 40, 9, 0.62, t, 1, { haloA: 0.6 });
  C.lanternString(ctx, -320, 140, 1400, 120, 30, 7, 0.5, t, 4, { haloA: 0.5 });
  // shop interior warm glow
  const fk = o.fire === undefined ? 1 : o.fire;
  glow(ctx, 540, 960, 520, 'rgba(255,130,50,0.55)', 0.5 + 0.35 * fk);
  if (o.behind) o.behind(ctx);
  shopStation(ctx, t, o);
  if (o.front) o.front(ctx);
}
// counter + chef + burner + wok + fire (shop front). Chef waist (540,1040) s .55
function shopStation(ctx, t, o = {}) {
  const fk = o.fire === undefined ? 1 : o.fire;
  const ch = o.chef || {};
  const swirl = ch.swirl === undefined ? 1 : ch.swirl;
  const bx = 520 + Math.cos(t * 5) * 34 * swirl, by = 958 + Math.sin(t * 5) * 8 * swirl;
  const toss = ch.toss || 0; // 0..1 lift of the wok
  const wy = 965 - toss * 40, wr = -toss * 0.25;
  if (!o.noChef) C.chef(ctx, 540, 1040, 0.55, Object.assign({ hl: [(bx - 120 - 540) / 0.55, (by - 22 - 1040) / 0.55], hr: [250, (wy - 8 - 1040) / 0.55], mood: 'focus', t }, ch));
  // fire behind wok
  C.fire(ctx, 540, 1052, 330, 170 + fk * 120, t, fk, 3);
  F.bigWok(ctx, 540, wy, 0.42, wr, { k: 0.24, handle: false, fill: wokFill(o.wok || { sea: 1, meat: 1, veg: 1, sauce: 0.6, t, swirl: 1.5 }) });
  if (!o.noChef && !o.noLadle) ladleL(ctx, bx, by, 0.42, 0.1);
  C.counter(ctx, 540, 1060, 440, 400);
  C.burner(ctx, 540, 1056, 0.6);
  // front flames lick around the rim
  C.fire(ctx, 540, 1058, 300, 60 + fk * 70, t + 3, fk * 0.8, 9);
  C.embers(ctx, t, 11, 24, 540, 1000, 300, 420, fk);
  C.smoke(ctx, t, 12, 540, 900, 260, 520, 7, 0.2 * fk);
}
// steel table scene item: crispy noodle dish on table seen from the side (origin floor)
function tableWithDish(ctx, x, y, s, t, o = {}) {
  C.steelTable(ctx, x, y, s, 300, 210);
  at(ctx, x, y - 228 * s, 0, s, s, () => {
    F.dish(ctx, 0, -6, 0.32, { k: 0.3, gravy: 1, garnish: 1, t, plate: true, tops: o.eaten === undefined ? 1 : 1 - o.eaten * 0.6 });
    F.soyDish(ctx, -120, 0, 0.3, 0.3);
    F.teaCup(ctx, 125, 2, 0.4, t, 0.3);
  });
}

module.exports = { bump, LCOLS, darkBg, lanternBokeh, sky, wokFill, ladleL, streetWorld, shopStation, tableWithDish, ITEMS };
