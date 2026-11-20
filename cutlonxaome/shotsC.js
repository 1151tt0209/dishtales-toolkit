// shotsC.js — writer C: s10 tension · s11 lift + eye macro + silence · s12 bite · s13 farewell · s14 CTA
// Night Saigon: cool blue ambient, warm firelight on faces/food, pink/cyan neon rims. All shots paint a full opaque frame.
// sN(ctx, lt, p, T): T = global time. Deterministic (no Math.random), heavy layers cached in c_scene.js.
const L = require('./lib');
const CT = require('./ctprops');
const CL = require('./cl_food');
const P = require('./people');
const S = require('./c_scene');
const { W, H, TAU, rng, clamp, lerp, ease } = L;
const { ell, rg, lg, hitAt, env } = S;
const BEAT = 60 / 128;

// camera helper (z >= 1), centre clamped so the frame never shows black bars
const cam = (ctx, cx, cy, z, rot, fn) => L.cam(ctx, clamp(cx, 540 / z, W - 540 / z), clamp(cy, 960 / z, H - 960 / z), z, rot, fn);
const sm = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const BOK = ['rgba(255,179,71,0.9)', 'rgba(255,90,170,0.9)', 'rgba(90,220,255,0.9)', 'rgba(255,220,150,0.9)'];

function edgeDark(ctx, a, r0 = 0.3, col = '6,10,22') {
  if (a <= 0) return;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = rg(ctx, W / 2, H / 2, H * r0, H * 0.72, [[0, `rgba(${col},0)`], [1, `rgba(${col},${a})`]]);
  ctx.fillRect(0, 0, W, H); ctx.restore();
}
function haze(ctx, a) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(20,40,64,${a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }

// ============================================================================ s10 TENSION 33.75–39.375
// sweat 34.6 · gulp 35.3 · eyes shut 36.2 (open 37.4) · cat ears 37.0 · push-in 37.5–39.3 · spoon trembles closer
function s10(ctx, lt, p, T) {
  const t = T;
  const push = ease.inOut(clamp((T - 37.5) / 1.8));
  const z = 1 + 0.7 * push;
  S.drawPlate(ctx, S.streetPlate('cart', 26), 1 + (z - 1) * 0.35 + lt * 0.006, 640, 1000);
  L.bokeh(ctx, t, 1010, 10, BOK, 0.16, 30, 80);
  const shakeX = Math.sin(T * 31) * 2 * push, shakeY = Math.cos(T * 27) * 2 * push;
  cam(ctx, 640 + shakeX, 1000 + shakeY, z, 0, () => {
    // Cô Năm (midground, left) watching, arms crossed
    const coT = T > 38.2 ? 'smile' : 'skeptic';
    CT.coNam(ctx, 150, 1650, 1.45, { pose: 'eyebrow', expr: coT, lookX: 0.8, lookY: 0.2, turn: 0.45, t, light: { x: 620, y: 1500, k: 0.75, r: 700 }, neon: { col: 'pink', k: 0.7, side: -1 }, shadow: false });
    haze(ctx, 0.22);
    const wake = 0.12 + 0.88 * (T < 37 ? 0 : T < 37.08 ? (T - 37) / 0.08 : hitAt(T, 37.08, 0.8));
    // tourist face
    const shut = T >= 36.2 && T < 37.4;
    const shutK = shut ? clamp((T - 36.2) / 0.08) * clamp((37.4 - T) / 0.12) : 0;
    const det = clamp((T - 37.4) / 0.3);
    const gk = clamp((T - 35.3) / 0.35), ga = env(T, 35.3, 35.75, 0.05, 0.12);
    const fo = {
      turn: -0.12, tilt: -0.03 + 0.01 * Math.sin(t * 2), lookX: lerp(-0.25, -0.1, det), lookY: lerp(0.65, 0.85, det) + 0.1 * Math.sin(t * 7) * (1 - det),
      open: shut ? 1 - shutK : lerp(1.05, 0.95, det), brow: shut ? -0.5 * shutK : lerp(0.65 + 0.1 * Math.sin(t * 3), 0.15, det),
      mouth: shut ? 'neutral' : det > 0.5 ? 'neutral' : 'woozy', blush: 0.1, t, pupil: lerp(1, 0.85, det), cross: 0.35 * det * push,
    };
    S.litFace(ctx, 660, 1000 + ga * 6, 1.3, fo, {
      warm: 1.1, cool: 1,
      pre: (bx) => { S.torso(bx); S.gulp(bx, gk, ga); },
      post: (bx) => {
        S.catchlights(bx, fo, 1); S.lipGloss(bx, fo, 0.8);
        const sk = clamp((T - 34.6) / 1.4), sa = T < 34.6 ? 0 : clamp((36.8 - T) / 0.6);
        S.sweat(bx, sk, sa, 1);
        if (shut) { bx.strokeStyle = `rgba(150,80,60,${0.45 * shutK})`; bx.lineWidth = 3; for (const sx of [-1, 1]) { const ex = S.eyeX(sx, fo.turn); for (let i = 0; i < 3; i++) { bx.beginPath(); bx.moveTo(ex - sx * (52 + i * 6), -6 + i * 10); bx.lineTo(ex - sx * (68 + i * 8), -10 + i * 14); bx.stroke(); } } }
      },
    });
    // cat on a stool (left, in front of his shoulder), watching; ears flick at 37.0
    S.stool(ctx, 150, 1610, 1.5, '#d8423a');
    CT.cat(ctx, 150, 1610, 1.5, { t, wake, flip: false });
    // spoon in his hand, trembling, creeping up toward the mouth
    const amp = 2 + 10 * clamp(lt / 5.6) + 6 * push;
    const tx = Math.sin(T * 41) * amp + Math.sin(T * 67) * amp * 0.4, ty = Math.cos(T * 53) * amp * 0.6;
    const rise = ease.inOut(clamp((T - 37.4) / 1.9));
    const bx0 = lerp(560, 610, rise) + tx, by0 = lerp(1500, 1360, rise) + ty;
    S.spoonRig(ctx, bx0, by0, 1.05, 0.95, { armAng: 1.35, t, seed: 4, eggRot: -0.1 + Math.sin(T * 41) * 0.02, bowlRot: Math.sin(T * 41) * 0.03 });
    CT.steam(ctx, t, { x: bx0, y: by0 - 60, w: 80, h: 260, n: 5, s: 0.7, alpha: 0.5, warm: 0.7, seed: 10 });
  });
  // riser: darkness creeps in from the edges
  edgeDark(ctx, 0.25 + 0.5 * clamp((T - 36.2) / 3.1), lerp(0.32, 0.2, push));
}

// ============================================================================ s11 LIFT 39.375–43.125
// A 39.375–40.6 spoon rises · B 40.6–41.9 eye macro (egg reflected) · C 41.9–42.656 mouth opens · D 42.656–43.125 silence (frozen, grey)
function eyeReflect(T) {
  return (x, IR) => {
    // warm firelight glow + the spoon with the glazed egg, curved on the cornea
    x.fillStyle = rg(x, -40, 60, 10, IR * 1.2, [[0, 'rgba(255,170,70,0.55)'], [1, 'rgba(255,170,70,0)']]); x.fillRect(-IR * 1.3, -IR * 1.3, IR * 2.6, IR * 2.6);
    const k = clamp((T - 40.6) / 1.3), sy = lerp(70, 20, k), sc = lerp(1.5, 1.8, k);
    x.save(); x.translate(20, sy); x.scale(sc, sc);
    x.fillStyle = 'rgba(150,170,195,0.6)'; ell(x, 0, 30, 110, 46); x.fill();
    x.fillStyle = 'rgba(200,215,230,0.45)'; x.beginPath(); x.moveTo(60, 50); x.lineTo(240, 170); x.lineTo(226, 186); x.lineTo(46, 66); x.fill();
    x.fillStyle = rg(x, -14, -20, 4, 70, [[0, 'rgba(240,150,60,0.95)'], [0.6, 'rgba(168,80,28,0.9)'], [1, 'rgba(90,36,16,0.5)']]); ell(x, 0, -10, 52, 62); x.fill();
    x.fillStyle = 'rgba(255,240,210,0.9)'; ell(x, -18, -36, 12, 7, -0.5); x.fill();
    x.fillStyle = 'rgba(95,174,58,0.8)'; ell(x, 38, 14, 16, 7, -0.6); x.fill();
    x.restore();
    for (const [px, py, c, r] of [[-150, 40, '255,90,170', 18], [150, -60, '90,220,255', 14], [-90, -150, '255,200,110', 10], [120, 120, '255,90,170', 9]]) {
      x.fillStyle = rg(x, px, py, 0, r * 2, [[0, `rgba(${c},0.8)`], [1, `rgba(${c},0)`]]); x.fillRect(px - r * 2, py - r * 2, r * 4, r * 4);
    }
  };
}
function biteCloseup(ctx, T, frozen) {
  // C: extreme close on the face, mouth opening, spoon arriving from below
  const k = clamp((T - 41.9) / 0.65), mk = ease.out(k);
  S.drawPlate(ctx, S.streetPlate('cart', 26), 1.5, 540, 700);
  const z = 1 + 0.06 * k;
  cam(ctx, 540, 960, z, 0, () => {
    const fo = { turn: 0, tilt: 0.02, lookX: 0, lookY: 1, cross: 0.85, open: 1.2, brow: 0.85, mouth: 'neutral', blush: 0.25, t: T, pupil: 0.8, hairLift: 0.1 };
    S.litFace(ctx, 540, 560, 2.6, fo, { warm: 1.2, cool: 0.9, pre: (bx) => { S.torso(bx); S.bigMouth(bx, mk, 0); }, post: (bx) => { S.catchlights(bx, fo, 1); S.sweat(bx, 0.15, 0.9, 1); } });
    const sy = lerp(1820, 1240, ease.inOut(k)) + Math.sin(T * 47) * 4;
    S.spoonRig(ctx, 560 + Math.sin(T * 39) * 3, sy, 1.7, 1.15, { armAng: 1.45, t: T, seed: 4, eggRot: -0.05 });
    if (!frozen) CT.steam(ctx, T, { x: 560, y: sy - 90, w: 140, h: 420, n: 7, s: 1.2, alpha: 0.5, warm: 0.8, seed: 12 });
  });
}
function s11(ctx, lt, p, T) {
  if (T < 40.6) {
    // A: the lift
    const k = clamp((T - 39.375) / 1.225), ek = ease.inOut(k);
    S.drawPlate(ctx, S.streetPlate('cart', 26), 1.25, 540, 900);
    L.bokeh(ctx, T, 1110, 8, BOK, 0.14, 30, 70);
    cam(ctx, 540, 1000, 1 + 0.08 * k, 0, () => {
      const fo = { turn: 0.05, tilt: -0.02, lookX: 0, lookY: lerp(0.9, 1, ek), cross: lerp(0.1, 0.6, ek), open: 1.1, brow: lerp(0.3, 0.7, ek), mouth: k > 0.65 ? 'o' : 'neutral', mOpen: 0.1, blush: 0.15, t: T, pupil: 0.9 };
      S.litFace(ctx, 540, 960, 1.9, fo, { warm: 1.15, pre: (bx) => S.torso(bx), post: (bx) => { S.catchlights(bx, fo, 1); S.lipGloss(bx, fo, 0.8); S.sweat(bx, 0.35, 0.8, 1); } });
      const sy = lerp(1900, 1420, ek) + Math.sin(T * 43) * 5;
      S.spoonRig(ctx, 560 + Math.sin(T * 37) * 4, sy, 1.35, 1.0, { armAng: 1.4, t: T, seed: 4 });
      CT.steam(ctx, T, { x: 560, y: sy - 80, w: 110, h: 380, n: 6, s: 1, alpha: 0.5, warm: 0.8, seed: 11 });
    });
    edgeDark(ctx, 0.45, 0.28);
    return;
  }
  if (T < 41.9) {
    // B: eye macro — blue iris, the glazed egg reflected in the cornea
    const k = clamp((T - 40.6) / 1.3);
    cam(ctx, 540, 900, 1 + 0.12 * ease.inOut(k), 0, () => {
      P.eyeMacro(ctx, 540, 900 + Math.sin(T * 40) * 1.5, 1.0, { pupil: lerp(0.3, 0.55, ease.inOut(k)), open: 1.02 + 0.02 * Math.sin(T * 9), brow: 0.5, t: T, reflect: eyeReflect(T) });
    });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = lg(ctx, 0, H, W, 0, [[0, 'rgba(255,150,60,0.75)'], [0.5, 'rgba(128,128,128,0)'], [1, 'rgba(40,80,180,0.8)']]); ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = lg(ctx, W - 160, 0, W, 0, [[0, 'rgba(90,220,255,0)'], [1, 'rgba(90,220,255,0.2)']]); ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = lg(ctx, 0, 0, 160, 0, [[0, 'rgba(255,90,170,0.18)'], [1, 'rgba(255,90,170,0)']]); ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // sweat bead on the brow
    const by = 300 + 30 * k;
    ctx.fillStyle = lg(ctx, 790, by - 40, 830, by + 20, [[0, 'rgba(220,245,255,0.9)'], [1, 'rgba(120,180,220,0.75)']]);
    ctx.beginPath(); ctx.moveTo(810, by - 46); ctx.quadraticCurveTo(836, by - 6, 832, by + 6); ctx.arc(810, by + 6, 22, 0, Math.PI); ctx.quadraticCurveTo(784, by - 6, 810, by - 46); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ell(ctx, 802, by - 2, 6, 9, -0.3); ctx.fill();
    edgeDark(ctx, 0.55, 0.25);
    return;
  }
  if (T < 42.656) { biteCloseup(ctx, T, false); edgeDark(ctx, 0.5, 0.26); return; }
  // D: absolute silence — time nearly stops, colour drains, darkness closes in
  const Tc = 42.656 + (T - 42.656) * 0.15;
  biteCloseup(ctx, Tc, true);
  const d = clamp((T - 42.656) / 0.12);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.85 * d; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = d; ctx.fillStyle = '#5a6a8a'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  edgeDark(ctx, 0.5 + 0.4 * d, 0.2, '2,4,10');
}

// ============================================================================ s12 BITE 43.125–47.8125
// burst 43.125 · chews 43.7 44.0 44.3 44.6 44.9 · eyes widen 44.4 · thumbs-up 46.0 (ting) · laugh 47.0
const CHEWS = [43.7, 44.0, 44.3, 44.6, 44.9];
function s12(ctx, lt, p, T) {
  const b = T - 43.125, tm = b < 0.45 ? b * 0.35 : 0.1575 + (b - 0.45); // slow-mo first, then normal speed
  const burst = hitAt(T, 43.125, 0.9);
  let chew = 0; for (const c of CHEWS) chew = Math.max(chew, hitAt(T, c, 0.28));
  const wide = T >= 44.4, wk = ease.outBack(clamp((T - 44.4) / 0.25));
  const laugh = T >= 47.0, lk = clamp((T - 47.0) / 0.2);
  const z = lerp(1.14, 1, ease.out(clamp(tm / 0.6))) + 0.03 * ease.inOut(clamp((T - 45.5) / 2.3));
  const fx = 540, fy = 1130;
  S.drawPlate(ctx, S.streetPlate('cart', 26), 1.2 + (z - 1) * 0.4, 540, 1000);
  L.bokeh(ctx, tm, 1210, 12, BOK, 0.18 + 0.12 * burst, 30, 90);
  const sq = 1 + 0.035 * chew * (T < 45 ? 1 : 0);
  cam(ctx, fx, fy - 20, z, 0, () => {
    // face
    const fo = { turn: -0.05, t: tm, hairLift: 0.9 * hitAt(T, 43.125, 1.2) + (laugh ? 0.25 + 0.1 * Math.sin(T * 14) : 0) + (wide ? 0.2 * hitAt(T, 44.4, 0.6) : 0) };
    if (T < 44.4) {
      fo.open = 0; fo.happyClosed = T > 43.6; fo.brow = T < 43.6 ? -0.4 : 0.4; fo.mouth = 'neutral'; fo.blush = lerp(0.3, 0.6, clamp(b / 1.2));
      fo.tilt = -0.06 * burst + 0.03 * Math.sin(tm * 3);
    } else if (!laugh) {
      fo.open = lerp(1, 1.35, wk); fo.brow = lerp(0.4, 1.05, wk); fo.mouth = T < 44.95 ? 'neutral' : 'smile'; fo.blush = lerp(0.6, 0.95, clamp((T - 44.4) / 1.1));
      fo.pupil = 1.35; fo.lookX = 0; fo.lookY = 0; fo.tilt = 0.03 * Math.sin(T * 2.5);
      if (T > 45.8) { fo.lookX = 0.35 * clamp((T - 45.8) / 0.2); fo.lookY = 0.3 * clamp((T - 45.8) / 0.2); }
    } else {
      fo.open = 0; fo.happyClosed = true; fo.brow = 0.9; fo.mouth = 'grin'; fo.mOpen = 0.5 + 0.5 * Math.abs(Math.sin((T - 47) * 13)); fo.blush = 0.95;
      fo.tilt = -0.07 * lk + 0.035 * Math.sin((T - 47) * 13);
    }
    const ck = T < 44.95 ? Math.max(T < 43.7 ? clamp(b / 0.15) : 0.5, 0.5 + 0.5 * chew) : clamp((45.25 - T) / 0.3) * 0.5;
    L.at(ctx, fx, fy + 240, 0, 1 + (sq - 1) * 0.7, 2 - sq, () => {
      S.litFace(ctx, 0, -240, 1.7, fo, {
        warm: 1.2 + 0.4 * burst, cool: 0.9,
        pre: (bx) => { S.torso(bx); S.cheeks(bx, ck, fo.turn); },
        post: (bx) => {
          S.catchlights(bx, fo, 1); S.lipGloss(bx, fo, 1);
          // sauce glint on the lip corner
          if (T < 46.5) { const a = clamp((46.5 - T) / 0.5); bx.fillStyle = `rgba(122,52,18,${0.85 * a})`; ell(bx, 40, 150, 9, 6); bx.fill(); bx.fillStyle = `rgba(255,220,170,${0.9 * a})`; ell(bx, 37, 147, 3, 2); bx.fill(); }
          if (wide && !laugh) { // star-struck sparkles in the eyes
            const sa = clamp((T - 44.4) / 0.2) * (0.75 + 0.25 * Math.sin(T * 12));
            for (const sx of [-1, 1]) { const ex = S.eyeX(sx, fo.turn) + fo.lookX * 22; L.sparkle(bx, ex - 6, -8 + fo.lookY * 10, 16 * wk, sa); }
          }
          if (T < 44.4 && T > 43.6) { bx.strokeStyle = 'rgba(255,200,140,0.35)'; bx.lineWidth = 4; for (const sx of [-1, 1]) { bx.beginPath(); bx.arc(S.eyeX(sx, 0), -30, 70, -2.2 + (sx > 0 ? 0.6 : 0), -1.5 + (sx > 0 ? 0.6 : 0)); bx.stroke(); } }
        },
      });
    });
    const mx = fx, my = fy + 140 * 1.7;
    // burst: steam + glow + sauce-glint sparkles radiating from the mouth
    if (b < 1.6) {
      L.glow(ctx, mx, my, 420, 'rgba(255,190,100,1)', 0.55 * burst);
      CT.steam(ctx, tm + 2, { x: mx, y: my - 10, w: 360, h: 520, n: 12, s: 1.7, alpha: 0.75 * clamp(1 - b / 1.6), warm: 0.9, seed: 21 });
      const r = rng(43);
      for (let i = 0; i < 14; i++) {
        const a = r() * TAU, d = (160 + r() * 260) * ease.out(clamp(tm / 0.55)), al = clamp(1 - tm / 0.6) * (0.6 + 0.4 * r());
        if (al > 0) L.sparkle(ctx, mx + Math.cos(a) * d, my + Math.sin(a) * d * 0.8, 14 + r() * 26, al);
      }
      // spoon pulled out down-right (empty, sauce smear)
      const sk = ease.in(clamp(tm / 0.35));
      if (sk < 1) S.spoonRig(ctx, lerp(mx + 30, 1000, sk), lerp(my + 40, 1960, sk), 1.5, 1.1, { egg: false, armAng: 1.4, t: tm, bowlRot: 0.2 * sk });
    }
    // gentle warm steam from the mouth while chewing
    if (T > 43.6 && T < 45.2) CT.steam(ctx, T, { x: mx, y: my - 30, w: 140, h: 260, n: 5, s: 0.9, alpha: 0.35, warm: 1, seed: 22 });
    // thumbs-up at 46.0
    if (T >= 45.75) {
      const tk = clamp((T - 45.75) / 0.35), pop = ease.outBack(tk), hx = 860, hy = lerp(2150, 1520, pop) + (laugh ? Math.sin((T - 47) * 13) * 8 : 0);
      P.thumbsUp(ctx, hx, hy, 1.7 * (0.9 + 0.1 * pop), -0.12 + 0.05 * Math.sin(T * 3));
      L.glow(ctx, hx - 30, hy, 160, 'rgba(255,170,80,1)', 0.25);
      const ting = T - 46.0;
      if (ting >= 0 && ting < 0.5) { const a = Math.sin(ting / 0.5 * Math.PI); L.sparkle(ctx, hx - 4, hy - 190, 60 * a + 10, a); L.glow(ctx, hx - 4, hy - 190, 160, 'rgba(255,240,200,1)', 0.6 * a); }
    }
  });
  // sleeve of the thumbs-up arm is just off-frame; flushed warm glow
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = `rgba(255,140,90,${0.2 + 0.15 * clamp((T - 44.4) / 1.5)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  edgeDark(ctx, 0.35, 0.3);
}

// ============================================================================ s13 FAREWELL 47.8125–54.84375
// two fingers 48.6 · wok toss + flare 49.7 · plate stack 51.0 (ting 51.6) · cat to lap 51.9–52.3 · waves 53.0 · walks off 53.6 · whoosh 54.7
const PLATE_T = [50.95, 51.05, 51.15, 51.25, 51.35, 51.45];
function s13Scene(ctx, T) {
  const t = T;
  const toss = T - 49.7, tossK = clamp(toss / 0.7);
  const shake = toss >= 0 && toss < 0.4 ? (1 - toss / 0.4) * 7 : 0;
  const z = 1.12 + 0.05 * ease.inOut(clamp((T - 47.8) / 3)) - 0.04 * ease.inOut(clamp((T - 52.8) / 2));
  S.drawPlate(ctx, S.streetPlate('wide', 18), 1.05, 540, 900);
  L.bokeh(ctx, t, 1310, 10, BOK, 0.14, 30, 80);
  cam(ctx, 560 + Math.sin(T * 47) * shake, 1130 + Math.cos(T * 41) * shake, z, 0, () => {
    // ground
    ctx.drawImage(S.groundPlate(), -40, 1440, W + 80, 900);
    // Cô Năm behind the cart
    const wave = T >= 53.0;
    const coPose = wave ? 'wave' : 'tongs';
    const coExpr = T < 48.6 ? 'smile' : T < 49.5 ? 'o' : T < 50.6 ? 'proud' : T < 51.6 ? 'grin' : 'laugh';
    const lift = toss >= -0.15 && toss < 0.8 ? Math.sin(clamp((toss + 0.15) / 0.95) * Math.PI) : 0;
    CT.coNam(ctx, 210, 1620, 1.5, { pose: coPose, k: tossK, expr: coExpr, lookX: T > 48.4 && T < 49.5 ? 0.6 : 0.3, turn: 0.4, t, lean: -0.05 * lift, light: { x: 420, y: 1200, k: 0.8 + 0.6 * lift, r: 650 }, neon: { col: 'pink', k: 0.8, side: -1 }, shadow: false, fanL: false });
    // cart + wok on the burner
    const cart = S.wokCart(ctx, 330, 1290, 0.9, t, { flame: 1 + 1.2 * lift });
    const [bxp, byp] = cart.burner;
    const wokY = byp - 52 - 70 * lift, wokR = -0.28 * lift;
    S.wok(ctx, bxp, wokY, 0.9, wokR, t);
    // eggs jumping out of the wok
    if (toss > 0 && toss < 0.75) {
      const r = rng(77);
      for (let i = 0; i < 6; i++) {
        const u = clamp(toss / (0.6 + r() * 0.1)), vx = (r() - 0.35) * 160, vy = 520 + r() * 260;
        const ex = bxp + (r() - 0.5) * 80 + vx * u, ey = wokY - 10 - vy * u + 900 * u * u * 0.62;
        CL.cutLon(ctx, ex, ey, 0.42, { state: 'fried', glaze: 1, herb: 0.5, seed: 30 + i, shadow: false, rot: (r() - 0.5) * 2 + u * 6 * (r() - 0.5), t });
      }
    }
    if (toss > 0) {
      CT.flareUp(ctx, t, bxp, wokY + 20, clamp(toss / 0.9), { s: 1.3, seed: 5 });
      CT.sparks(ctx, t, { x: bxp, y: wokY + 10, w: 200, h: 520, n: 40, s: 1, t0: 49.7, seed: 9 });
    }
    CT.steam(ctx, t, { x: bxp, y: wokY - 10, w: 200, h: 360, n: 6, s: 1.1, alpha: 0.45, warm: 0.6, seed: 31 });
    // low table + plates
    S.lowTable(ctx, 690, 1530, 1.0);
    const stackN = PLATE_T.length;
    S.plateStack(ctx, 690, 1508, 1, 1, () => 1, T);
    S.plateStack(ctx, 690, 1508 - 13, 1, stackN, (i) => clamp((T - PLATE_T[i]) / 0.3), T);
    const ting = T - 51.6;
    if (ting >= 0 && ting < 0.5) { const a = Math.sin(ting / 0.5 * Math.PI); L.sparkle(ctx, 640, 1508 - 13 * (stackN + 1) - 10, 50 * a + 8, a); L.glow(ctx, 690, 1430, 200, 'rgba(255,240,200,1)', 0.4 * a); }
    // tourist on his stool (faces left toward her)
    const standK = ease.inOut(clamp((T - 53.3) / 0.3));
    const walkK = clamp((T - 53.6) / 1.1);
    const tX = 930, gY = 1720, ts = 1.65;
    S.stool(ctx, tX + 14 * ts, gY - 136, 1.05, '#2f6fd0');
    const raise = T >= 48.6 && T < 49.9 ? ease.out(clamp((T - 48.6) / 0.25)) * clamp((49.9 - T) / 0.3) : 0;
    let lapX = tX - 50 * ts, lapY = gY - 100 * ts;
    // cat: spare stool -> his lap (51.9–52.3) -> back to his stool when he stands
    const catStool = [560, 1600];
    S.stool(ctx, catStool[0], catStool[1], 1.0, '#d8423a');
    const jumpK = clamp((T - 51.9) / 0.4);
    let cx = catStool[0], cy = catStool[1], cFlip = false, cWake = 0.25;
    if (walkK <= 0) {
      if (jumpK > 0) { const e = ease.inOut(jumpK); cx = lerp(catStool[0], lapX, e); cy = lerp(catStool[1], lapY, e) - Math.sin(jumpK * Math.PI) * 140; cWake = 1; }
      if (jumpK >= 1) { cWake = 0.4 + 0.3 * Math.sin(T * 2); }
    }
    const catOnLap = jumpK >= 1 && T < 53.3;
    if (!catOnLap && !(jumpK > 0 && jumpK < 1) && T < 53.3) CT.cat(ctx, cx, cy, 0.9, { t, wake: T > 51.5 ? 0.8 : 0.25, flip: cFlip });
    if (T >= 53.3) CT.cat(ctx, tX + 14 * ts, gY - 136, 0.9, { t, wake: 0.6, flip: true });
    if (walkK <= 0) {
      // hand raised high (above the head, not across the face): two fingers "một dĩa nữa" 48.6, then a wave 53.0
      const HAND = [-52, -382];
      const st = { sit: 1 - standK, raise, look: raise > 0 ? -0.1 : 0, smile: T > 48.4 };
      if (raise > 0) { st.glassHand = [HAND[0] + Math.sin(T * 9) * 3 * raise, HAND[1]]; st.glassHandK = raise; }
      if (wave) { const wv = Math.sin((T - 53) * 14); st.glassHand = [HAND[0] + wv * 16, HAND[1] - standK * 40]; st.glassHandK = ease.out(clamp((T - 53) / 0.2)); }
      P.tourist(ctx, tX, gY, ts, st);
      if (raise > 0.6) { // second finger (the built-in one is at hand -> (-4,-30))
        const a = clamp((raise - 0.6) / 0.2), hx = st.glassHand[0], hy = st.glassHand[1];
        ctx.save(); ctx.translate(tX, gY); ctx.scale(ts, ts); ctx.globalAlpha = a;
        ctx.strokeStyle = P.SKIN[1]; ctx.lineCap = 'round'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(hx + 6, hy - 4); ctx.lineTo(hx + 12, hy - 31); ctx.stroke();
        ctx.restore();
      }
    } else {
      const wx = lerp(tX, 1300, ease.in(walkK));
      L.at(ctx, wx, 0, 0, -1, 1, () => P.tourist(ctx, 0, gY, ts, { walk: (T - 53.6) * 9, smile: true, glassHand: [-52 + Math.sin(T * 14) * 16, -420], glassHandK: clamp(1 - walkK * 1.4) }));
    }
    if (catOnLap) CT.cat(ctx, lapX + 6, lapY + 6, 0.8, { t, wake: cWake, flip: false });
    if (jumpK > 0 && jumpK < 1 && walkK <= 0) CT.cat(ctx, cx, cy, 0.85, { t, wake: 1, flip: false });
  });
}
function s13(ctx, lt, p, T) {
  if (T >= 54.55) {
    const k = clamp((T - 54.55) / 0.29);
    L.motionBlurX(ctx, -420 * ease.in(k), 7, (bx) => { bx.save(); bx.translate(-260 * ease.in(k), 0); s13Scene(bx, T); bx.restore(); });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(15,28,46,${0.5 * k})`; ctx.fillRect(0, 0, W, H); ctx.restore();
  } else s13Scene(ctx, T);
  edgeDark(ctx, 0.3, 0.32);
}

// ============================================================================ s14 CTA 54.84375–60
// heart pop 55.2 (pulses every beat) · FOLLOW pressed 56.4 · final still from 59.4
function s14(ctx, lt, p, T) {
  const Tf = Math.min(T, 59.4), lk = Tf - 54.844;
  const z = lerp(1.08, 1, ease.out(clamp(lk / 1.2)));
  const bt = Tf - 55.2, beat = bt >= 0 ? Math.exp(-((bt / BEAT) % 1) * 6) : 0;
  S.drawPlate(ctx, S.streetPlate('cart', 34), 1.15 + (z - 1) * 0.5, 540, 700);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(10,18,32,0.35)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  L.bokeh(ctx, Tf, 1410, 14, BOK, 0.22, 30, 90);
  const slide = 1 - ease.out(clamp(lk / 0.35));
  cam(ctx, 540, 1100, z, 0, () => {
    ctx.save(); ctx.translate(slide * 260, 0);
    // table plane
    ctx.fillStyle = lg(ctx, 0, 1220, 0, H, [[0, '#2a5fa8'], [0.08, '#1d4a8a'], [1, '#0d2244']]); ctx.fillRect(-300, 1240, W + 600, 900);
    ctx.fillStyle = 'rgba(255,200,120,0.25)'; ctx.fillRect(-300, 1240, W + 600, 5);
    ctx.fillStyle = rg(ctx, 540, 1420, 40, 620, [[0, 'rgba(255,170,70,0.35)'], [1, 'rgba(255,170,70,0)']]); ctx.fillRect(-300, 1240, W + 600, 900);
    // hero plate
    const ps = 1.3 * (1 + 0.012 * beat);
    CL.cutLonPlate(ctx, 540, 1430, ps, { t: Tf, steam: false, seed: 3 });
    CT.steam(ctx, Tf, { x: 540, y: 1330, w: 420, h: 520, n: 9, s: 1.4, alpha: 0.55, warm: 0.8, seed: 41 });
    CT.glazeSparkle(ctx, Tf, 540, 1380, 300, 1, { n: 8, ryr: 0.45, seed: 52, size: 1.3 });
    L.glow(ctx, 540, 1380, 380, 'rgba(255,170,80,1)', 0.18 + 0.12 * beat);
    // foreground hero eggs (big, out of focus edge)
    CL.ramLeaf(ctx, 300, 1840, 3.2, { rot: -0.6, seed: 7 });
    CL.ramLeaf(ctx, 820, 1880, 2.8, { rot: 0.9, seed: 8 });
    CL.cutLon(ctx, 130, 1760, 3.0, { state: 'fried', glaze: 1, herb: 0.8, seed: 61, shadow: false, t: Tf, rot: -0.25 });
    CL.cutLon(ctx, 975, 1800, 2.7, { state: 'fried', glaze: 1, herb: 0.6, seed: 62, shadow: false, t: Tf, rot: 0.3 });
    L.sparkle(ctx, 95, 1660, 34 * (0.6 + 0.4 * beat), 0.8);
    L.sparkle(ctx, 1000, 1690, 26 * (0.6 + 0.4 * beat), 0.7);
    ctx.restore();
  });
  // CTA UI
  if (T >= 55.0) {
    const tap = 55.2, Th = Tf >= tap ? tap + ((Tf - tap) / BEAT) * (8 / 15) : Tf;
    CT.heartPop(ctx, Th, 290, 790, 1.1, { t0: 55.0, tap });
    CT.followButton(ctx, Tf, 750, 790, { t0: 55.73, tap: 56.4 });
  }
  edgeDark(ctx, 0.35, 0.3);
}

module.exports = { s10, s11, s12, s13, s14 };
