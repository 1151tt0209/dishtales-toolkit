// Coffee props: phin, glasses, ice, kettle, beans, wok & stove, grinder, spoon, stools, table, hands.
const L = require('./lib');
const { W, H, TAU, lerp, clamp, rng, at, glow, buffer } = L;

// draw fn into an offscreen layer then composite with blur (depth of field)
function layer(ctx, blur, fn, alpha = 1) {
  const [c, x] = buffer(blur > 0.3 ? 'dof' : 'lay');
  fn(x);
  ctx.save();
  ctx.globalAlpha = alpha;
  if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}
// layer for nested use (separate buffer name)
function layer2(ctx, blur, fn, alpha = 1) {
  const [c, x] = buffer('dof2');
  fn(x);
  ctx.save(); ctx.globalAlpha = alpha;
  if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
  ctx.drawImage(c, 0, 0); ctx.restore();
}

// two-bone IK: returns joint position. bend = +1/-1 selects side.
function ik(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  d = Math.min(d, l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = base + bend * a;
  return [ax + Math.cos(ang) * l1, ay + Math.sin(ang) * l1];
}
function seg(ctx, x0, y0, x1, y1, w0, w1, col) {
  // tapered capsule
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a), ny = Math.cos(a);
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
}

// ---------- metal ----------
function metalGrad(ctx, x0, x1, warm = 1) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#4b4d50');
  g.addColorStop(0.1, '#8d9094');
  g.addColorStop(0.24, warm ? '#fff1dc' : '#f2f5f7');
  g.addColorStop(0.34, '#c9c6c1');
  g.addColorStop(0.62, '#7c7f83');
  g.addColorStop(0.84, '#a8acb0');
  g.addColorStop(0.93, '#d8d4cc');
  g.addColorStop(1, '#3e4043');
  return g;
}
// solid cylinder (frustum) body: bottom centre (0,yb), radii rb/rt, height h (screen px), ellipse ratio k
function cylBody(ctx, yb, rb, rt, h, k, fill) {
  const yt = yb - h;
  ctx.beginPath();
  ctx.moveTo(-rb, yb);
  ctx.ellipse(0, yb, rb, rb * k, 0, Math.PI, 0, true);
  ctx.lineTo(rt, yt);
  ctx.ellipse(0, yt, rt, rt * k, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}
function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }

// ---------- PHIN ----------
// origin = centre of plate top surface. o.k ellipse ratio, o.c = cos(elev) for heights.
// o.fill: {grounds:0..1 level, kind:'dry'|'wet'|'water', bloom:0..1, bubbles:t}, o.press: depth 0..1 (null=none) / pressLift px
// o.lid: null (no lid) or lift px; o.t time
const PH = { R: 140, th: 12, rb: 92, rt: 104, h: 178 };
function phin(ctx, x, y, s, o = {}) {
  const k = o.k === undefined ? 0.3 : o.k, c = Math.sqrt(1 - k * k);
  const { R, rb, rt } = PH, h = PH.h * c, th = PH.th * c;
  at(ctx, x, y, o.rot || 0, s, s, () => {
    // plate underside / thickness
    ell(ctx, 0, th, R, R * k); ctx.fillStyle = '#55585b'; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(-R - 2, 0, 2 * R + 4, th + R * k + 2); ctx.clip();
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.ellipse(0, th, R, R * k, 0, Math.PI, 0, true); ctx.lineTo(R, 0);
    ctx.ellipse(0, 0, R, R * k, 0, 0, Math.PI, false); ctx.closePath(); ctx.fillStyle = metalGrad(ctx, -R, R); ctx.fill();
    ctx.restore();
    // plate top
    ell(ctx, 0, 0, R, R * k);
    const pg = ctx.createRadialGradient(-R * 0.3, -R * k * 0.6, 10, 0, 0, R);
    pg.addColorStop(0, '#f4ece0'); pg.addColorStop(0.55, '#a9abad'); pg.addColorStop(1, '#6d7074');
    ctx.fillStyle = pg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,250,240,0.6)'; ctx.stroke();
    // chamber
    cylBody(ctx, 0, rb, rt, h, k, metalGrad(ctx, -rt, rt));
    // subtle vertical brushed lines
    ctx.save(); ctx.globalAlpha = 0.12; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i++) { const u = i / 9; ctx.beginPath(); ctx.moveTo(u * rb, rb * k * Math.sqrt(1 - u * u)); ctx.lineTo(u * rt, -h + rt * k * Math.sqrt(1 - u * u)); ctx.stroke(); }
    ctx.restore();
    const yt = -h;
    // rim
    ell(ctx, 0, yt, rt, rt * k); ctx.fillStyle = '#d9d6d0'; ctx.fill();
    if (o.lid === null || o.lid === undefined || o.lid > 2) {
      // interior
      ctx.save();
      ell(ctx, 0, yt, rt - 6, (rt - 6) * k); ctx.clip();
      const ig = ctx.createLinearGradient(0, yt - rt * k, 0, yt + rt * k);
      ig.addColorStop(0, '#2c2c2e'); ig.addColorStop(1, '#8b8d90');
      ctx.fillStyle = ig; ctx.fillRect(-rt, yt - rt, rt * 2, rt * 2 + h);
      const f = o.fill;
      if (f && f.level > 0) {
        const lv = f.level, ly = -lv * h, lr = lerp(rb, rt, lv) - 6;
        const dome = (f.bloom || 0) * 26;
        // content surface
        ell(ctx, 0, ly, lr, lr * k);
        if (f.kind === 'water') {
          const wg = ctx.createRadialGradient(-lr * 0.3, ly - lr * k * 0.3, 4, 0, ly, lr);
          wg.addColorStop(0, '#5a3220'); wg.addColorStop(0.5, '#25120a'); wg.addColorStop(1, '#120804');
          ctx.fillStyle = wg; ctx.fill();
          // reflection of light
          ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
          ell(ctx, -lr * 0.25, ly - lr * k * 0.25, lr * 0.35, lr * k * 0.18); ctx.fillStyle = 'rgba(255,220,170,0.7)'; ctx.fill();
          ctx.restore();
          crema(ctx, ly, lr, k, f.t || 0, 0.5);
        } else {
          const dg = ctx.createRadialGradient(-lr * 0.2, ly - lr * k * 0.4, 4, 0, ly, lr);
          if (f.kind === 'wet') { dg.addColorStop(0, '#5b3a24'); dg.addColorStop(1, '#22130a'); }
          else { dg.addColorStop(0, '#8a6244'); dg.addColorStop(1, '#3b2416'); }
          ctx.fillStyle = dg; ctx.fill();
          // dome (bloom)
          if (dome > 0) {
            ctx.beginPath(); ctx.ellipse(0, ly, lr * 0.96, lr * k * 0.96 + dome, 0, Math.PI, 0, false);
            ctx.ellipse(0, ly, lr * 0.96, lr * k * 0.96, 0, 0, Math.PI, false);
            const bg = ctx.createRadialGradient(-lr * 0.2, ly - dome, 4, 0, ly, lr);
            bg.addColorStop(0, '#9a6a42'); bg.addColorStop(0.6, '#5a3620'); bg.addColorStop(1, '#2b170c');
            ctx.fillStyle = bg; ctx.fill();
          }
          // texture specks
          const r = rng(44);
          for (let i = 0; i < 160; i++) {
            const a = r() * TAU, rr = Math.sqrt(r()) * lr * 0.95;
            const px = Math.cos(a) * rr, py = ly + Math.sin(a) * rr * k - (dome * (1 - (rr / lr) ** 2));
            ctx.fillStyle = r() > 0.5 ? 'rgba(20,10,5,0.5)' : 'rgba(190,140,95,0.35)';
            ctx.fillRect(px, py, 2 + r() * 2, 2);
          }
          if (f.kind === 'wet' && f.bubbles !== undefined) bubbles(ctx, f.bubbles, ly, lr, k, dome);
        }
      }
      // press inside
      if (o.press !== undefined && o.press !== null && !(o.pressLift > 0)) pressDisk(ctx, o.press, h, rb, rt, k, 0);
      ctx.restore();
      // press above rim (being lowered)
      // rim edge highlight
      ell(ctx, 0, yt, rt, rt * k); ctx.lineWidth = 7; ctx.strokeStyle = '#f2ede4'; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,60,60,0.6)'; ell(ctx, 0, yt, rt - 5, (rt - 5) * k); ctx.stroke();
      if (o.pressLift > 0) pressDisk(ctx, 0, h, rb, rt, k, o.pressLift);
    }
    if (o.lid !== null && o.lid !== undefined) lid(ctx, yt - o.lid, rt, k, c);
    // specular stripe
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
    const sg = ctx.createLinearGradient(-rt * 0.62, 0, -rt * 0.4, 0);
    sg.addColorStop(0, 'rgba(255,240,215,0)'); sg.addColorStop(0.5, 'rgba(255,240,215,0.9)'); sg.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.fillStyle = sg; ctx.fillRect(-rt * 0.62, -h + 8, rt * 0.22, h - 4);
    ctx.restore();
  });
}
function crema(ctx, ly, lr, k, t, a) {
  ctx.save(); ctx.globalAlpha = a;
  const r = rng(91);
  for (let i = 0; i < 26; i++) {
    const ang = r() * TAU + t * 0.2 * (r() - 0.5), rr = Math.sqrt(r()) * lr * 0.9;
    ell(ctx, Math.cos(ang) * rr, ly + Math.sin(ang) * rr * k, 3 + r() * 6, (3 + r() * 6) * k);
    ctx.fillStyle = 'rgba(200,150,95,0.5)'; ctx.fill();
  }
  ctx.restore();
}
function bubbles(ctx, t, ly, lr, k, dome) {
  const r = rng(7);
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU, rr = Math.sqrt(r()) * lr * 0.85, ph = r(), sp = 0.7 + r() * 1.3, sz = 2 + r() * 7;
    const life = (t * sp + ph) % 1;
    const px = Math.cos(a) * rr, py = ly + Math.sin(a) * rr * k - dome * (1 - (rr / lr) ** 2);
    const rad = sz * Math.sin(life * Math.PI);
    if (rad < 0.5) continue;
    ell(ctx, px, py, rad, rad * 0.8);
    ctx.fillStyle = 'rgba(120,80,50,0.55)'; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,225,180,0.7)'; ctx.stroke();
    ell(ctx, px - rad * 0.3, py - rad * 0.3, rad * 0.25, rad * 0.2); ctx.fillStyle = 'rgba(255,245,225,0.9)'; ctx.fill();
  }
}
function pressDisk(ctx, depth, h, rb, rt, k, lift) {
  // depth: 0 at rim .. 1 resting on grounds level (~0.42)
  const lv = lerp(1, 0.42, depth);
  const y = -lv * h - lift, r = lerp(rb, rt, lv) - 10;
  ell(ctx, 0, y + 5, r, r * k); ctx.fillStyle = '#5c5f62'; ctx.fill();
  ell(ctx, 0, y, r, r * k);
  const g = ctx.createRadialGradient(-r * 0.3, y - r * k * 0.5, 4, 0, y, r);
  g.addColorStop(0, '#f4efe6'); g.addColorStop(1, '#8a8d91');
  ctx.fillStyle = g; ctx.fill();
  // holes ring
  ctx.fillStyle = 'rgba(40,30,25,0.8)';
  for (let ring = 1; ring <= 2; ring++) for (let i = 0; i < 10 * ring; i++) {
    const a = (i / (10 * ring)) * TAU, rr = r * (0.3 + ring * 0.25);
    ell(ctx, Math.cos(a) * rr, y + Math.sin(a) * rr * k, 3, 3 * k); ctx.fill();
  }
  pressStem(ctx, y, k);
}
function pressStem(ctx, y, k) {
  // little central stem with knob
  const g = ctx.createLinearGradient(-12, 0, 12, 0);
  g.addColorStop(0, '#6a6d70'); g.addColorStop(0.35, '#f5f0e8'); g.addColorStop(1, '#55585b');
  ctx.fillStyle = g; ctx.fillRect(-7, y - 46, 14, 46);
  ell(ctx, 0, y - 46, 16, 16 * Math.max(k, 0.25)); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
}
function lid(ctx, y, rt, k, c) {
  const r = rt + 8, h = 26 * c;
  cylBody(ctx, y + 4, r, r - 3, h, k, metalGrad(ctx, -r, r));
  ell(ctx, 0, y + 4 - h, r - 3, (r - 3) * k);
  const g = ctx.createRadialGradient(-r * 0.3, y - h - r * k * 0.5, 4, 0, y - h, r);
  g.addColorStop(0, '#fff6ea'); g.addColorStop(0.5, '#b9b9b8'); g.addColorStop(1, '#75787b');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,250,240,0.8)'; ctx.stroke();
  // knob
  cylBody(ctx, y + 4 - h, 22, 18, 30 * c, k, metalGrad(ctx, -22, 22));
  ell(ctx, 0, y + 4 - h - 30 * c, 18, 18 * k); ctx.fillStyle = '#e9e5de'; ctx.fill();
}
// world-space point of the phin's drip hole (centre under plate)
const phinBottom = (x, y, s, k = 0.3) => [x, y + PH.th * Math.sqrt(1 - k * k) * s + 2 * s];
const phinTop = (x, y, s, k = 0.3) => [x, y - PH.h * Math.sqrt(1 - k * k) * s];

// ---------- GLASS ----------
// origin = centre of glass bottom. o: {h, rb, rt, k, level(0..1), ice:[...], tea, drops, t, sugar}
function glass(ctx, x, y, s, o = {}) {
  const k = o.k === undefined ? 0.22 : o.k, c = Math.sqrt(1 - k * k);
  const gh = (o.h || 210) * c, rb = o.rb || 78, rt = o.rt || 92, base = 22 * c;
  const col = o.tea ? ['#d98a2b', '#9a4f12', '#5a2a08'] : o.colors || ['#6a3a1c', '#2c140a', '#120703'];
  at(ctx, x, y, o.rot || 0, s, s, () => {
    // shadow / caustic
    ctx.save(); ctx.filter = 'blur(10px)';
    ell(ctx, 10, 6, rb * 1.25, rb * k * 1.3); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
    ctx.restore();
    if ((o.level || 0) > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(8px)'; ell(ctx, -26, 10, rb * 0.6, rb * k * 0.5); ctx.fillStyle = o.tea ? 'rgba(255,160,60,0.5)' : 'rgba(170,90,40,0.45)'; ctx.fill(); ctx.restore(); }
    // back wall
    cylBody(ctx, 0, rb, rt, gh, k, 'rgba(210,225,230,0.10)');
    // thick base
    cylBody(ctx, 0, rb, rb - 1, base, k, 'rgba(220,235,240,0.28)');
    // contents
    const lv = clamp(o.level || 0, 0, 1);
    if (lv > 0) {
      const top = base + (gh - base) * lv, rr = lerp(rb, rt, (top) / gh) - 7;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-(rb - 7), -base);
      ctx.ellipse(0, -base, rb - 7, (rb - 7) * k, 0, Math.PI, 0, true);
      ctx.lineTo(rr, -top); ctx.ellipse(0, -top, rr, rr * k, 0, 0, Math.PI, false); ctx.closePath();
      const g = ctx.createLinearGradient(-rr, 0, rr, 0);
      g.addColorStop(0, col[1]); g.addColorStop(0.3, col[0]); g.addColorStop(0.7, col[2]); g.addColorStop(1, col[1]);
      ctx.fillStyle = g; ctx.fill();
      if (o.layers) { // swirl of fresh coffee in ice (pour)
        ctx.clip();
        o.layers(ctx, top, rr, k);
      }
      ctx.restore();
      // surface
      ell(ctx, 0, -top, rr, rr * k);
      const sg = ctx.createRadialGradient(-rr * 0.3, -top - rr * k * 0.3, 2, 0, -top, rr);
      sg.addColorStop(0, o.tea ? '#f0b050' : '#8a5530'); sg.addColorStop(1, o.tea ? '#9a5410' : '#2a1309');
      ctx.fillStyle = sg; ctx.fill();
    }
    // ice cubes
    if (o.ice) for (const cube of o.ice) iceCube(ctx, cube.x, cube.y, cube.s, cube.r, cube.under ? (o.tea ? 'tea' : 'coffee') : null);
    // front wall glass highlights
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-rb, 0); ctx.ellipse(0, 0, rb, rb * k, 0, Math.PI, 0, true); ctx.lineTo(rt, -gh);
    ctx.ellipse(0, -gh, rt, rt * k, 0, 0, Math.PI, false); ctx.closePath();
    const fg = ctx.createLinearGradient(-rt, 0, rt, 0);
    fg.addColorStop(0, 'rgba(255,255,255,0.35)'); fg.addColorStop(0.08, 'rgba(255,255,255,0.05)');
    fg.addColorStop(0.18, 'rgba(255,255,255,0.32)'); fg.addColorStop(0.24, 'rgba(255,255,255,0.02)');
    fg.addColorStop(0.85, 'rgba(255,255,255,0.04)'); fg.addColorStop(0.93, 'rgba(255,255,255,0.3)'); fg.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = fg; ctx.fill();
    // condensation drops
    if (o.drops) {
      ctx.clip();
      const r = rng(o.dropSeed || 3);
      for (let i = 0; i < o.drops; i++) {
        const u = r() * 2 - 1, v = r();
        const dy = -base - v * (gh - base) * 0.95 + ((o.t || 0) * (r() < 0.15 ? 30 : 0)) % 40;
        const dx = u * lerp(rb, rt, v) * 0.95, ds = 1.5 + r() * 4;
        ell(ctx, dx, dy, ds, ds * 1.25); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
        ell(ctx, dx - ds * 0.3, dy - ds * 0.4, ds * 0.35, ds * 0.35); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      }
    }
    ctx.restore();
    // outlines
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ell(ctx, 0, -gh, rt, rt * k); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(-rb, 0); ctx.lineTo(-rt, -gh); ctx.moveTo(rb, 0); ctx.lineTo(rt, -gh); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, rb, rb * k, 0, 0, Math.PI); ctx.stroke();
  });
}
const glassTop = (x, y, s, o = {}) => { const k = o.k === undefined ? 0.22 : o.k; return [x, y - (o.h || 210) * Math.sqrt(1 - k * k) * s]; };
function iceCube(ctx, x, y, s, r, tint) {
  at(ctx, x, y, r, s, s, () => {
    ctx.beginPath(); ctx.roundRect(-30, -30, 60, 60, 14);
    const g = ctx.createLinearGradient(-30, -30, 30, 30);
    if (tint === 'coffee') { g.addColorStop(0, 'rgba(210,150,100,0.55)'); g.addColorStop(1, 'rgba(90,45,20,0.35)'); }
    else if (tint === 'tea') { g.addColorStop(0, 'rgba(255,215,140,0.6)'); g.addColorStop(1, 'rgba(200,110,30,0.35)'); }
    else { g.addColorStop(0, 'rgba(240,250,255,0.75)'); g.addColorStop(1, 'rgba(170,200,215,0.35)'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-20, -22, 22, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-8, 4); ctx.lineTo(14, 18); ctx.lineTo(4, 26); ctx.stroke();
  });
}

// ---------- KETTLE (aluminium, side view, spout to +x) ----------
// origin = body centre. returns nothing; use kettleSpout() for the tip.
function kettle(ctx, x, y, s, rot) {
  at(ctx, x, y, rot, s, s, () => {
    // handle (bail)
    ctx.lineWidth = 14; ctx.strokeStyle = '#2b2b2d'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(-10, -110, 120, 95, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    // spout
    ctx.beginPath(); ctx.moveTo(90, 10); ctx.quadraticCurveTo(170, 0, 205, -95); ctx.lineTo(222, -92); ctx.quadraticCurveTo(200, 40, 100, 60); ctx.closePath();
    ctx.fillStyle = metalGrad(ctx, 90, 225); ctx.fill();
    // body
    ctx.beginPath(); ctx.moveTo(-150, 70);
    ctx.bezierCurveTo(-175, -10, -150, -95, -95, -110); ctx.lineTo(95, -110);
    ctx.bezierCurveTo(150, -95, 175, -10, 150, 70); ctx.quadraticCurveTo(0, 95, -150, 70); ctx.closePath();
    const g = ctx.createLinearGradient(0, -110, 0, 85);
    g.addColorStop(0, '#f6efe4'); g.addColorStop(0.25, '#bfc0bf'); g.addColorStop(0.6, '#8c8e90'); g.addColorStop(1, '#4c4e50');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = metalGrad(ctx, -165, 165); ctx.globalAlpha = 0.45; ctx.fill(); ctx.globalAlpha = 1;
    // dents / soot
    ctx.fillStyle = 'rgba(30,25,20,0.28)'; ell(ctx, 40, 55, 110, 18); ctx.fill();
    // lid & knob
    ell(ctx, 0, -110, 95, 16); ctx.fillStyle = '#d7d4cd'; ctx.fill();
    ctx.fillStyle = '#2b2b2d'; ell(ctx, 0, -126, 20, 12); ctx.fill();
    // highlight
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = 'rgba(255,240,220,0.6)';
    ell(ctx, -80, -60, 22, 45); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
}
function kettleSpout(x, y, s, rot) {
  const tx = 214, ty = -94;
  return [x + s * (tx * Math.cos(rot) - ty * Math.sin(rot)), y + s * (tx * Math.sin(rot) + ty * Math.cos(rot))];
}
// pour stream from (x0,y0) launched with velocity (vx, vy) falling to y1; thickness w
function stream(ctx, x0, y0, vx, y1, w, kind, t, g = 2200) {
  const pts = [];
  for (let i = 0; i <= 30; i++) {
    const tt = i * 0.012;
    const px = x0 + vx * tt, py = y0 + 0.5 * g * tt * tt + 40 * tt;
    pts.push([px + Math.sin(t * 40 + i) * 0.8 * i / 30, py]);
    if (py > y1) break;
  }
  const last = pts[pts.length - 1]; last[1] = Math.min(last[1], y1);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const draw = (lw, col) => { ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
  if (kind === 'water') {
    draw(w, 'rgba(200,225,235,0.45)');
    ctx.globalCompositeOperation = 'screen'; draw(w * 0.35, 'rgba(255,250,235,0.9)');
  } else {
    draw(w, '#2a1208'); draw(w * 0.6, '#4a2412');
    ctx.globalCompositeOperation = 'screen'; draw(w * 0.18, 'rgba(255,190,130,0.75)');
  }
  ctx.restore();
  return last;
}
function splash(ctx, x, y, t, seed, kind, n = 14) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ph = r(), life = (t * 3 + ph) % 1, a = -Math.PI / 2 + (r() - 0.5) * 2.2, v = 60 + r() * 90;
    const px = x + Math.cos(a) * v * life, py = y + Math.sin(a) * v * life + 260 * life * life;
    const sz = (2 + r() * 4) * (1 - life);
    ell(ctx, px, py, sz, sz); ctx.fillStyle = kind === 'water' ? 'rgba(235,245,255,0.8)' : 'rgba(110,60,30,0.9)'; ctx.fill();
  }
  ctx.restore();
}

// ---------- BEANS ----------
function bean(ctx, x, y, s, rot, shade = 0.5, gloss = 1) {
  at(ctx, x, y, rot, s, s, () => {
    ell(ctx, 0, 0, 13, 9);
    const g = ctx.createRadialGradient(-4, -4, 1, 0, 0, 14);
    const base = shade > 0.66 ? ['#7a4a26', '#2e1709'] : shade > 0.33 ? ['#6a3d1e', '#241106'] : ['#5a3218', '#1c0d05'];
    g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#140802'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-10, 1); ctx.bezierCurveTo(-4, -4, 3, 5, 10, -1); ctx.stroke();
    if (gloss) { ell(ctx, -5, -5, 4, 2); ctx.fillStyle = `rgba(255,230,190,${0.55 * gloss})`; ctx.fill(); }
  });
}

// ---------- WOK on clay charcoal stove (side view). origin = wok rim centre ----------
function stove(ctx, x, y, s, t) {
  at(ctx, x, y, 0, s, s, () => {
    // clay body
    ctx.beginPath(); ctx.moveTo(-190, 40); ctx.lineTo(-160, 420); ctx.lineTo(160, 420); ctx.lineTo(190, 40); ctx.closePath();
    const g = ctx.createLinearGradient(-190, 0, 190, 0);
    g.addColorStop(0, '#3a1d10'); g.addColorStop(0.3, '#a2532c'); g.addColorStop(0.55, '#7a3a1d'); g.addColorStop(1, '#2a140a');
    ctx.fillStyle = g; ctx.fill();
    // opening with embers
    ctx.beginPath(); ctx.ellipse(0, 300, 90, 70, 0, 0, TAU);
    const eg = ctx.createRadialGradient(0, 300, 5, 0, 300, 95);
    const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.7);
    eg.addColorStop(0, `rgba(255,${200 * fl | 0},90,1)`); eg.addColorStop(0.5, '#e0571c'); eg.addColorStop(1, '#3a0e04');
    ctx.fillStyle = eg; ctx.fill();
    // charcoal lumps glowing
    const r = rng(12);
    for (let i = 0; i < 9; i++) {
      const cx = (r() - 0.5) * 140, cy = 300 + (r() - 0.3) * 70, cs = 16 + r() * 16;
      ctx.beginPath(); ctx.roundRect(cx - cs, cy - cs * 0.7, cs * 2, cs * 1.4, 8);
      ctx.fillStyle = '#1b0d07'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,${120 + 80 * Math.sin(t * 5 + i) | 0},40,0.9)`; ctx.stroke();
    }
    // top ring
    ell(ctx, 0, 40, 190, 34); ctx.fillStyle = '#5a2c16'; ctx.fill();
    ell(ctx, 0, 40, 150, 26); ctx.fillStyle = '#1a0a05'; ctx.fill();
    glow(ctx, 0, 60, 230, 'rgba(255,110,30,0.75)', 0.7 * fl);
  });
}
// wok (iron) — origin = rim centre; beans drawn inside via callback
function wok(ctx, x, y, s, rot, fillFn) {
  at(ctx, x, y, rot, s, s, () => {
    // handles
    ctx.fillStyle = '#121212';
    ctx.beginPath(); ctx.roundRect(-300, -14, 50, 20, 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(250, -14, 50, 20, 8); ctx.fill();
    // bowl
    ctx.beginPath(); ctx.moveTo(-265, 0); ctx.bezierCurveTo(-240, 150, 240, 150, 265, 0); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, 130);
    g.addColorStop(0, '#2b2a2a'); g.addColorStop(1, '#070707'); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const rg = ctx.createLinearGradient(-260, 0, 260, 0);
    rg.addColorStop(0, 'rgba(255,140,60,0)'); rg.addColorStop(0.2, 'rgba(255,160,90,0.35)'); rg.addColorStop(0.3, 'rgba(255,160,90,0)');
    ctx.fillStyle = rg; ctx.fill(); ctx.restore();
    // inner (back) surface ellipse
    ell(ctx, 0, 0, 265, 46);
    const ig = ctx.createRadialGradient(0, 10, 10, 0, 0, 265);
    ig.addColorStop(0, '#1a1513'); ig.addColorStop(1, '#3a3532');
    ctx.fillStyle = ig; ctx.fill();
    if (fillFn) fillFn();
    // rim
    ctx.lineWidth = 6; ctx.strokeStyle = '#4d4a48';
    ctx.beginPath(); ctx.ellipse(0, 0, 265, 46, 0, 0, Math.PI); ctx.stroke();
  });
}

// ---------- spoon (long handle, bowl at origin) ----------
function spoon(ctx, x, y, s, rot, heap, heapCol = '#4a2c18') {
  at(ctx, x, y, rot, s, s, () => {
    const g = ctx.createLinearGradient(0, -10, 0, 10);
    g.addColorStop(0, '#f5f1ea'); g.addColorStop(0.5, '#a4a6a8'); g.addColorStop(1, '#5c5f62');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(30, -6, 330, 12, 6); ctx.fill();
    ell(ctx, 0, 0, 46, 30); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
    if (heap > 0) {
      ctx.beginPath(); ctx.ellipse(0, 0, 42 * Math.min(1, heap + 0.3), 26, 0, Math.PI, 0, false);
      ctx.ellipse(0, -2, 42 * Math.min(1, heap + 0.3), 30 * heap, 0, 0, Math.PI, true);
      ctx.fillStyle = heapCol; ctx.fill();
      const r = rng(3);
      for (let i = 0; i < 40 * heap; i++) { ctx.fillStyle = r() > 0.5 ? 'rgba(20,10,5,0.6)' : 'rgba(170,120,80,0.5)'; ctx.fillRect((r() - 0.5) * 70, -r() * 26 * heap, 2.5, 2.5); }
    }
  });
}

// ---------- plastic stool (side view). origin = floor centre ----------
function stool(ctx, x, y, s, col = '#2f6fd6', h = 62) {
  at(ctx, x, y, 0, s, s, () => {
    const dk = shade(col, -0.35);
    ctx.fillStyle = dk;
    ctx.beginPath(); ctx.moveTo(-52, 0); ctx.lineTo(-40, -h + 8); ctx.lineTo(40, -h + 8); ctx.lineTo(52, 0); ctx.lineTo(38, 0); ctx.lineTo(30, -h + 30); ctx.lineTo(-30, -h + 30); ctx.lineTo(-38, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-50, -h, 100, 14, 5); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-46, -h + 2, 92, 3);
    ctx.fillStyle = shade(col, -0.15);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(i * 18, -h + 40, 6, 9, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); }
  });
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
// low wooden table (side view), origin floor centre, top surface at -h
function lowTable(ctx, x, y, s, w = 230, h = 100) {
  at(ctx, x, y, 0, s, s, () => {
    ctx.fillStyle = '#3a2416';
    ctx.fillRect(-w / 2 + 12, -h, 14, h); ctx.fillRect(w / 2 - 26, -h, 14, h);
    ctx.fillStyle = '#2a190e'; ctx.fillRect(-w / 2 + 20, -h * 0.35, w - 40, 8);
    const g = ctx.createLinearGradient(0, -h - 16, 0, -h);
    g.addColorStop(0, '#a26a3e'); g.addColorStop(1, '#5a3620');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h - 16, w, 16, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,170,0.4)'; ctx.fillRect(-w / 2 + 4, -h - 16, w - 8, 3);
  });
}

// ---------- hands ----------
// stylised hand at origin pointing +x. kind: 'fist' | 'point' | 'flat'. skin colours.
function hand(ctx, x, y, s, rot, kind = 'fist', skin = ['#c98a5c', '#8a5532'], flip = false) {
  at(ctx, x, y, rot, s, flip ? -s : s, () => {
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, skin[0]); g.addColorStop(1, skin[1]);
    ctx.fillStyle = g;
    // palm / back of hand
    ctx.beginPath(); ctx.roundRect(-55, -32, 80, 64, 26); ctx.fill();
    if (kind === 'point') {
      ctx.beginPath(); ctx.roundRect(10, -32, 80, 20, 10); ctx.fill();          // index finger
      ctx.beginPath(); ctx.roundRect(5, -12, 34, 18, 9); ctx.fill();
      ctx.beginPath(); ctx.roundRect(5, 4, 32, 17, 8); ctx.fill();
      ctx.beginPath(); ctx.roundRect(2, 18, 28, 15, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,210,0.6)'; ell(ctx, 84, -22, 5, 6); ctx.fill(); // nail
    } else if (kind === 'flat') {
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(10, -32 + i * 16, 70 - Math.abs(i - 1.2) * 8, 15, 7); ctx.fill(); }
    } else {
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.roundRect(8, -32 + i * 16, 34, 15, 7); ctx.fill(); }
    }
    // thumb
    ctx.fillStyle = skin[0];
    ctx.beginPath(); ctx.ellipse(0, -36, 30, 13, -0.3, 0, TAU); ctx.fill();
    // knuckle creases
    ctx.strokeStyle = 'rgba(80,40,20,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(20, -24 + i * 16); ctx.lineTo(28, -22 + i * 16); ctx.stroke(); }
  });
}
// sleeve/forearm from (x0,y0) to wrist (x1,y1)
function forearm(ctx, x0, y0, x1, y1, skin = '#b97a4e', sleeve = '#e9e4da', w = 66) {
  seg(ctx, x0, y0, x1, y1, w * 1.15, w * 0.8, skin);
  const mx = lerp(x0, x1, 0.45), my = lerp(y0, y1, 0.45);
  seg(ctx, x0, y0, mx, my, w * 1.35, w * 1.25, sleeve);
  ctx.save(); ctx.globalAlpha = 0.25; seg(ctx, x0, y0, mx, my, w * 0.5, w * 0.4, '#fff'); ctx.restore();
}

module.exports = {
  layer, layer2, ik, seg, metalGrad, cylBody, ell, PH, phin, phinBottom, phinTop, glass, glassTop, iceCube,
  kettle, kettleSpout, stream, splash, bean, stove, wok, spoon, stool, shade, lowTable, hand, forearm, bubbles,
};
