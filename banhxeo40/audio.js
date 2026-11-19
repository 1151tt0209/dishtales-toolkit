'use strict';
// Banh xeo mien Tay 40s - soundtrack (music + foley), fully synthesised, deterministic (seeded PRNG).
// Music: ethereal Vietnamese folk, 72 BPM (beat 0.8333 s, 48 beats), "dieu Bac" pentatonic on G (ho xu xang xe cong = G A C D E),
//   dan tranh arpeggios (Karplus-Strong, nhan / rung / luyen bends), airy pads, breathy sao truc from 13.33 s, dan bau answer 23.3-29.8 s,
//   long lush reverb; blooms at 17.5, holds its breath 22.3-22.9, silent 30.5-30.83, light climax at 33.333 then playful
//   (mo wood block, song loan clapper, shaker, trong com hand drum), final dan tranh note + small bell, silent at 40.0.
// Foley: fire crackle bed, XEEO batter sizzle, whoosh, ceramic clink, knife cuts, sprouts, 2nd sizzle + oil pops, flare,
//   pan scrape + swirl sizzle, sprinkle, fold "RAC", plate down, slow-mo crust crack, leaf rustle, dip plop + drips,
//   BITE CRUNCH (loudest), evening ambience (breeze, canal water, birds), pop + heart pulses, follow click + sparkle.
// Output: audio.wav 48 kHz / stereo / 16-bit / exactly 40.0 s (1,920,000 frames), ~-14 LUFS, peak <= -1 dBFS.
const fs = require('fs'), path = require('path');
const T_START = Date.now();
const SR = 48000, DUR = 40.0, N = Math.round(SR * DUR), TAU = Math.PI * 2;
const BEAT = 60 / 72, bt = (b) => b * BEAT;
const TARGET_LUFS = -14, CEIL_DBTP = -1.4;
const END_FADE0 = 39.72, END_FADE1 = 39.985;
const log = (...a) => console.log(`[${((Date.now() - T_START) / 1000).toFixed(1)}s]`, ...a);

// ======================================================================= generic helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const rngFor = (name) => mulberry32(hashStr('bx40:' + name));
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
const secs = (s) => Math.max(1, Math.round(s * SR));
const dbf = (x) => 20 * Math.log10(Math.max(1e-12, x));
const sgn = (R) => (R() < 0.5 ? -1 : 1);
function pw(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t < keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return va + (vb - va) * (t - a) / (b - a); }
  return keys[keys.length - 1][1];
}
function noise(R, n) { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = R() * 2 - 1; return y; }
function addInto(dst, src, off = 0, g = 1) { for (let k = 0; k < src.length; k++) { const i = off + k; if (i >= 0 && i < dst.length) dst[i] += src[k] * g; } return dst; }
function fadeEdges(x, a = 0.002, b = 0.004) {
  const na = Math.min(x.length >> 1, secs(a)), nb = Math.min(x.length >> 1, secs(b));
  for (let i = 0; i < na; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / na);
  for (let i = 0; i < nb; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / nb);
  return x;
}
function peakOf(x) { let m = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > m) m = v; } return m; }
function scaleTo(x, peak) { const m = peakOf(x); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
function coefs(type, f, Q, gdb = 0) {
  f = clamp(f, 10, SR * 0.47);
  const w = TAU * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else { const A = Math.pow(10, gdb / 40); b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
// biquad; f and Q may be functions of time (coefficients refreshed every 32 samples). out may equal x (in place).
function filt(x, type, f, Q = 0.707, gdb = 0, out) {
  const y = out || new Float32Array(x.length);
  const df = typeof f === 'function', dQ = typeof Q === 'function', dyn = df || dQ;
  let k = coefs(type, df ? f(0) : f, dQ ? Q(0) : Q, gdb);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (dyn && (i & 31) === 0) { const t = i / SR; k = coefs(type, df ? f(t) : f, dQ ? Q(t) : Q, gdb); }
    const v = x[i], o = k[0] * v + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o;
  }
  return y;
}
const filtIn = (x, type, f, Q = 0.707, gdb = 0) => filt(x, type, f, Q, gdb, x);
function burst(R, dur, type, fc, Q = 1, decay = dur / 4, attack = 0.0005) {
  const n = secs(dur); const x = filt(noise(R, n), type, fc, Q);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.min(1, t / attack) * Math.exp(-t / decay); }
  return fadeEdges(x, 0.0001, Math.min(0.01, dur * 0.3));
}
// bank of decaying sinusoids [freq, amp, decay(s)]
function modal(modes, dur, att = 0.0004) {
  const n = secs(dur), y = new Float32Array(n);
  for (const [f, a, d] of modes) {
    if (f >= SR * 0.45) continue;
    const w = TAU * f / SR, r = Math.exp(-1 / (d * SR)), c2 = 2 * r * Math.cos(w), r2 = r * r;
    let ym1 = a * Math.sin(-w) / r, ym2 = a * Math.sin(-2 * w) / r2;
    for (let i = 0; i < n; i++) { const v = c2 * ym1 - r2 * ym2; y[i] += v; ym2 = ym1; ym1 = v; }
  }
  const na = secs(att); for (let i = 0; i < na; i++) y[i] *= i / na;
  return fadeEdges(y, 0.0001, Math.min(0.02, dur * 0.2));
}
const MEMO = new Map();
function memo(k, fn) { let v = MEMO.get(k); if (!v) { v = fn(); MEMO.set(k, v); } return v; }
const TN = 2048;
function makeTable(amps) {
  const t = new Float32Array(TN + 1);
  for (let h = 0; h < amps.length; h++) { const a = amps[h]; if (!a) continue; for (let i = 0; i < TN; i++) t[i] += a * Math.sin(TAU * (h + 1) * i / TN); }
  let m = 0; for (let i = 0; i < TN; i++) m = Math.max(m, Math.abs(t[i]));
  for (let i = 0; i < TN; i++) t[i] /= m; t[TN] = t[0]; return t;
}
function tabRead(t, ph) { const p = ph * TN, i = p | 0, fr = p - i; return t[i] + (t[i + 1] - t[i]) * fr; }
function flutterEnv(R, n, fc) { const x = filt(filt(noise(R, n), 'lp', fc, 0.7), 'lp', fc, 0.7); scaleTo(x, 1); for (let i = 0; i < n; i++) x[i] = Math.abs(x[i]); return x; }
const stereo = (n) => ({ L: new Float32Array(n), R: new Float32Array(n) });
function panInto(dst, src, off, g, p) { addInto(dst.L, src, off, g * Math.cos((p + 1) * Math.PI / 4) * Math.SQRT2); addInto(dst.R, src, off, g * Math.sin((p + 1) * Math.PI / 4) * Math.SQRT2); }

// ---- loudness (BS.1770 K-weighting @48k)
function kweight(x) {
  const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const x0 = x[i], y0 = 1.53512485958697 * x0 - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2; x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0; }
  x1 = x2 = y1 = y2 = 0;
  for (let i = 0; i < y.length; i++) { const x0 = y[i], y0 = x0 - 2 * x1 + x2 + 1.99004745483398 * y1 - 0.99007225036621 * y2; x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0; }
  return y;
}
const lk = (z) => -0.691 + 10 * Math.log10(Math.max(1e-20, z));
function kcum(L, R) { const kl = kweight(L), kr = R === L ? kl : kweight(R), n = L.length, cs = new Float64Array(n + 1); for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + kl[i] * kl[i] + kr[i] * kr[i]; return cs; }
// max momentary (400 ms) loudness of a (short) signal, zero-padded
function maxMomentary(L, R = L) {
  const cs = kcum(L, R), n = L.length, B = secs(0.4), H = secs(0.005);
  if (n <= B) return lk(cs[n] / B);
  let m = -Infinity; for (let s = 0; s + B <= n; s += H) m = Math.max(m, lk((cs[s + B] - cs[s]) / B)); return m;
}
// BS.1770 gated integrated loudness of the window [a,b] s of a cumulative K-energy array
function integWin(cs, a, b) {
  const B = secs(0.4), H = secs(0.1), i0 = Math.round(a * SR), i1 = Math.min(cs.length - 1, Math.round(b * SR)), blocks = [];
  for (let s = i0; s + B <= i1; s += H) blocks.push((cs[s + B] - cs[s]) / B);
  if (!blocks.length) return lk((cs[i1] - cs[i0]) / B);
  const absG = blocks.filter((z) => lk(z) > -70); if (!absG.length) return -Infinity;
  const mean = (a2) => a2.reduce((p, q) => p + q, 0) / a2.length;
  const rel = lk(mean(absG)) - 10, g2 = absG.filter((z) => lk(z) > rel);
  return lk(mean(g2));
}
function maxMomWin(cs, a, b) { const B = secs(0.4), H = secs(0.01); let m = -Infinity, at = a; for (let s = Math.round(a * SR); s + B <= Math.min(cs.length - 1, Math.round(b * SR)); s += H) { const v = lk((cs[s + B] - cs[s]) / B); if (v > m) { m = v; at = s / SR; } } return [m, at]; }
// normalise an event (mono array or {L,R}) so that its max momentary loudness = target LUFS (pre-master), with a peak cap
function normM(sig, target, cap = 0.6) {
  const st = !!sig.L, L = st ? sig.L : sig, R = st ? sig.R : sig;
  const lu = maxMomentary(L, R); let g = Math.pow(10, (target - lu) / 20);
  const pk = Math.max(peakOf(L), peakOf(R)); if (pk * g > cap) g = cap / pk;
  for (let i = 0; i < L.length; i++) L[i] *= g; if (st) for (let i = 0; i < R.length; i++) R[i] *= g;
  return sig;
}

// ======================================================================= buses
function mkBus(H = null) { return { L: new Float32Array(N), R: new Float32Array(N), H }; }
const HALLA = mkBus(), HALLB = mkBus(), HALLF = mkBus(), ROOM = mkBus();
const MUS_A = mkBus(HALLA), MUS_B = mkBus(HALLB);   // music before / after the bite (separate so the 30.5 silence is clean)
const SFX = mkBus(HALLF), AMB = mkBus(HALLF);
// put a mono (pan number or function of local time) or stereo {L,R} signal on a bus; hall = send to the bus' hall, room = kitchen room
function put(b, t0, sig, o = {}) {
  const g = o.gain ?? 1, off = Math.round(t0 * SR), st = !!sig.L, len = st ? sig.L.length : sig.length;
  const pan = o.pan ?? 0, pf = typeof pan === 'function', hall = o.hall || 0, room = o.room || 0, env = o.env, H = b.H;
  let gl = Math.cos((clamp(pf ? 0 : pan, -1, 1) + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((clamp(pf ? 0 : pan, -1, 1) + 1) * Math.PI / 4) * Math.SQRT2;
  const E = 24;
  for (let k = 0; k < len; k++) {
    const i = off + k; if (i < 0) continue; if (i >= N) break;
    let l, r;
    if (st) { l = sig.L[k]; r = sig.R[k]; }
    else {
      if (pf && (k & 63) === 0) { const p = clamp(pan(k / SR), -1, 1); gl = Math.cos((p + 1) * Math.PI / 4) * Math.SQRT2; gr = Math.sin((p + 1) * Math.PI / 4) * Math.SQRT2; }
      l = sig[k] * gl; r = sig[k] * gr;
    }
    let w = g; if (k < E) w *= k / E; else if (len - k < E) w *= (len - k) / E;
    if (env) w *= env(i / SR);
    l *= w; r *= w;
    b.L[i] += l; b.R[i] += r;
    if (hall && H) { H.L[i] += l * hall; H.R[i] += r * hall; }
    if (room) { ROOM.L[i] += l * room; ROOM.R[i] += r * room; }
  }
}

// ======================================================================= instruments
// Karplus-Strong plucked string; f may be a function of time (bends / vibrato). s = loop-filter tap (0.5 = classic, smaller = brighter)
function ks(f, dur, o = {}) {
  const R = rngFor('ks:' + (o.seed ?? 0));
  const ff = typeof f === 'function' ? f : null, fc = ff ? ff(0) : f;
  const n = secs(dur), y = new Float32Array(n);
  const t60 = o.t60 ?? 2.5, s = o.s ?? 0.5, bright = o.bright ?? 0.5, pos = o.pos ?? 0.2;
  const el = Math.max(4, Math.round(SR / fc)), ex = new Float32Array(el), ex2 = new Float32Array(el);
  let lp = 0; for (let k = 0; k < el; k++) { lp += (R() * 2 - 1 - lp) * bright; ex[k] = lp; }
  const pd = Math.max(1, Math.round(pos * el)); let mean = 0, mx = 0;
  for (let k = 0; k < el; k++) { ex2[k] = ex[k] - (k >= pd ? ex[k - pd] : 0); mean += ex2[k]; }
  mean /= el; for (let k = 0; k < el; k++) { ex2[k] -= mean; mx = Math.max(mx, Math.abs(ex2[k])); }
  for (let k = 0; k < el; k++) ex2[k] /= mx || 1;
  let P = SR / fc - s, g = Math.pow(10, -3 / (t60 * fc));
  for (let i = 0; i < n; i++) {
    if (ff && (i & 15) === 0) { const fr = ff(i / SR); P = SR / fr - s; g = Math.pow(10, -3 / (t60 * fr)); }
    let v = i < el ? ex2[i] : 0;
    const d = i - P;
    if (d >= 1) { const j = Math.floor(d), a = d - j; const v1 = y[j] + (y[j + 1] - y[j]) * a, v0 = y[j - 1] + (y[j] - y[j - 1]) * a; v += g * ((1 - s) * v1 + s * v0); }
    y[i] = v;
  }
  return y;
}
function choke(y, len, tau) { const n0 = secs(len); for (let i = n0; i < y.length; i++) y[i] *= Math.exp(-(i - n0) / SR / tau); return y; }
const q05 = (x) => Math.max(0.05, Math.round(x / 0.05) * 0.05);

// ---- dan tranh: steel string plucked with finger picks near the bridge; left-hand ornaments
//   rung = vibrato, nhan = press-bend up a whole tone and release, luyen = pluck pressed then release down, len = scoop up
function tranh(m, ring = 2.4, orn = '') {
  const L = q05(ring);
  return memo(`tr${m}|${L}|${orn}`, () => {
    const pf = (t) => {
      let d = 0.035 * Math.sin(TAU * 4.3 * t) * smooth((t - 0.35) / 0.5);
      if (orn === 'rung') d += 0.3 * Math.sin(TAU * 5.3 * t) * smooth((t - 0.15) / 0.25);
      else if (orn === 'nhan') d += 2 * smooth((t - 0.2) / 0.11) * (1 - smooth((t - 0.56) / 0.16)) + 0.12 * Math.sin(TAU * 5.5 * t) * smooth((t - 0.3) / 0.1) * (1 - smooth((t - 0.5) / 0.1));
      else if (orn === 'luyen') d += 2 * (1 - smooth((t - 0.07) / 0.2));
      else if (orn === 'len') d -= 2 * (1 - smooth((t - 0.012) / 0.09));
      return m2f(m + d);
    };
    const t60 = m < 55 ? 5.5 : m < 67 ? 4.4 : m < 79 ? 3.2 : 2.3;
    const y = ks(pf, L + 0.4, { t60, s: 0.32, bright: 0.8, pos: 0.12, seed: 500 + m * 7 + orn.length * 31 });
    choke(y, L, 0.12);
    addInto(y, burst(rngFor('trp' + m), 0.006, 'hp', 3000, 0.7, 0.0012), 0, 0.06);
    filtIn(y, 'peak', 260, 1.0, 3); filtIn(y, 'peak', 2600, 1.2, 2); filtIn(y, 'hp', 70, 0.7); filtIn(y, 'lp', 9500, 0.7);
    return scaleTo(fadeEdges(y, 0.0003, 0.06), 1);
  });
}
// ---- sao truc (bamboo flute): soft near-sine tone, breath noise around the pitch, chiff, delayed breath vibrato, grace / scoop
function sao(m, len, o = {}) {
  const L = q05(len), sc = o.sc || 0, gr = o.gr || 0, vib = o.vib ?? 1;
  return memo(`sao${m}|${L}|${sc}|${gr}|${vib}`, () => {
    const R = rngFor(`sao${m}|${L}|${sc}|${gr}`), rel = 0.16, n = secs(L + rel), y = new Float32Array(n), f0 = m2f(m);
    const b1 = scaleTo(filt(noise(R, n), 'bp', f0, 7), 1), b3 = scaleTo(filt(noise(R, n), 'bp', 2 * f0, 9), 1);
    const b2 = scaleTo(filt(filt(noise(R, n), 'bp', 2600, 0.6), 'hp', 900, 0.7), 1);
    let ph = 0; const vr = 4.7 + R() * 0.6, g0 = gr ? 0.075 : 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let mm = m;
      if (gr && t < 0.075) mm = gr + (m - gr) * smooth((t - 0.05) / 0.025);
      else if (sc) mm = m - sc * (1 - smooth((t - g0) / 0.13));
      const vd = vib * smooth((t - 0.3) / 0.45);
      mm += 0.17 * vd * Math.sin(TAU * vr * t);
      const f = m2f(mm); ph += f / SR; ph -= Math.floor(ph);
      let e = smooth(t / 0.07) * (0.92 + 0.08 * Math.exp(-t / 0.15)) * (1 + 0.1 * vd * Math.sin(TAU * vr * t + 1));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      const p = TAU * ph, chiff = Math.exp(-t / 0.045);
      const tone = Math.sin(p) + 0.2 * Math.sin(2 * p) + 0.08 * Math.sin(3 * p) + 0.025 * Math.sin(4 * p);
      y[i] = (tone * 0.8 + b1[i] * 0.12 + b3[i] * 0.04 + b2[i] * (0.05 + 0.22 * chiff)) * e;
    }
    filtIn(y, 'lp', 8000, 0.7); filtIn(y, 'peak', 1100, 0.8, 1.5);
    return scaleTo(fadeEdges(y, 0.001, 0.01), 1);
  });
}
// ---- dan bau (monochord): plucked harmonic, near-sine, long sustain, wide rod bends and vibrato
function bau(m, len, o = {}) {
  const L = q05(len), sl = o.sl || 0, bends = o.bends || [], vib = o.vib ?? 0.3;
  return memo(`bau${m}|${L}|${sl}|${JSON.stringify(bends)}|${vib}`, () => {
    const R = rngFor('bau' + m + L), rel = 0.18, n = secs(L + rel), y = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let d = -sl * (1 - smooth((t - 0.03) / 0.17));
      for (const [a, b, s] of bends) d += s * smooth((t - a) / (b - a));
      d += vib * Math.sin(TAU * 5.6 * t) * smooth((t - 0.35) / 0.4);
      ph += m2f(m + d) / SR; ph -= Math.floor(ph);
      const p = TAU * ph;
      let e = Math.min(1, t / 0.004) * (0.72 * Math.exp(-t / 2.4) + 0.28 * Math.exp(-t / 0.15));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (Math.sin(p) + 0.13 * Math.sin(2 * p) + 0.05 * Math.sin(3 * p) + 0.3 * Math.exp(-t / 0.035) * Math.sin(4 * p)) * e;
    }
    addInto(y, burst(R, 0.02, 'bp', m2f(m) * 3, 1.2, 0.005), 0, 0.15);
    filtIn(y, 'lp', 5000, 0.7); filtIn(y, 'peak', 850, 0.9, 2);
    return scaleTo(fadeEdges(y, 0.0005, 0.02), 1);
  });
}
// ---- airy pad segment (stereo): detuned soft voices, slow breathing, optional sub, air noise, octave shimmer
const TAB_PAD = makeTable([1, 0.3, 0.12, 0.06, 0.03, 0.015]);
function padSeg(notes, dur, att, rel, seed, o = {}) {
  const R = rngFor('pad' + seed), n = secs(dur), out = stereo(n);
  const voices = [];
  notes.forEach((m, k) => {
    if (k === 0) { voices.push({ f: m2f(m), det: 1, pan: 0, amp: 0.8, sub: true }); return; }
    const a = 0.5 / Math.sqrt(1 + 0.35 * (k - 1));
    voices.push({ f: m2f(m), det: Math.pow(2, -(4 + 4 * R()) / 1200), pan: -0.35 - 0.3 * R(), amp: a });
    voices.push({ f: m2f(m), det: Math.pow(2, (4 + 4 * R()) / 1200), pan: 0.35 + 0.3 * R(), amp: a });
  });
  if (o.shimmer) for (const m of notes.slice(-2)) { voices.push({ f: m2f(m + 12), det: 1.002, pan: -0.7, amp: 0.16 * o.shimmer }); voices.push({ f: m2f(m + 12), det: 0.998, pan: 0.7, amp: 0.16 * o.shimmer }); }
  for (const v of voices) {
    const gl = Math.cos((v.pan + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((v.pan + 1) * Math.PI / 4) * Math.SQRT2;
    const lr = 0.07 + 0.13 * R(), lph = R() * TAU, inc = v.f * v.det / SR; let ph = R();
    for (let i = 0; i < n; i++) {
      ph += inc; if (ph >= 1) ph -= 1;
      const s = (v.sub ? Math.sin(TAU * ph) : tabRead(TAB_PAD, ph)) * v.amp * (0.75 + 0.25 * Math.sin(TAU * lr * i / SR + lph));
      out.L[i] += s * gl; out.R[i] += s * gr;
    }
  }
  if (o.air) notes.slice(1).forEach((m, k) => {
    const z = scaleTo(filt(noise(R, n), 'bp', m2f(m) * 2, 16), 1), p = k % 2 ? 0.6 : -0.6;
    addInto(out.L, z, 0, o.air * 0.1 * (1 - p)); addInto(out.R, z, 0, o.air * 0.1 * (1 + p));
  });
  filtIn(out.L, 'lp', o.lp ?? 3400, 0.7); filtIn(out.R, 'lp', o.lp ?? 3400, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / att) * (1 - smooth((t - (dur - rel)) / rel)); out.L[i] *= e; out.R[i] *= e; }
  return out;
}
// ---- percussion
function mo(hi) { return memo('mo' + hi, () => { const R = rngFor('mo' + hi), f = hi ? 985 : 690; const y = modal([[f, 1, 0.06], [f * 2.21, 0.3, 0.025], [f * 3.73, 0.12, 0.012]], 0.25); addInto(y, burst(R, 0.012, 'bp', 3200, 0.9, 0.002), 0, 0.35); addInto(y, burst(R, 0.05, 'bp', f, 8, 0.02), 0, 0.5); return scaleTo(fadeEdges(y, 0.0002, 0.03), 1); }); }
function songLoan() { return memo('sl', () => { const R = rngFor('sl'), y = new Float32Array(secs(0.12)); const hit = () => { const z = modal([[1850, 1, 0.016], [2950, 0.6, 0.01], [4700, 0.3, 0.006]], 0.08); addInto(z, burst(R, 0.008, 'hp', 2500, 0.7, 0.0015), 0, 0.6); return z; }; addInto(y, hit(), 0, 1); addInto(y, hit(), secs(0.005), 0.5); return scaleTo(fadeEdges(y, 0.0002, 0.02), 1); }); }
function shaker(acc, v) {
  return memo(`shk${acc}${v % 4}`, () => {
    const R = rngFor('shk' + acc + (v % 4)), d = acc ? 0.09 : 0.06, n = secs(d), at = acc ? 0.018 : 0.008;
    const x = filt(filt(noise(R, n), 'hp', 4200, 0.7), 'lp', 11000, 0.7);
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= t < at ? t / at : Math.exp(-(t - at) / (acc ? 0.025 : 0.014)); }
    return scaleTo(fadeEdges(x, 0.0005, 0.01), 1);
  });
}
function drumBum() { return memo('bum', () => { const n = secs(0.5), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (74 + 46 * Math.exp(-t / 0.025)) / SR; y[i] = (Math.sin(TAU * ph) * Math.exp(-t / 0.2) + 0.25 * Math.sin(2 * TAU * ph) * Math.exp(-t / 0.06)) * Math.min(1, t / 0.0015); } addInto(y, burst(rngFor('bum'), 0.03, 'lp', 600, 0.7, 0.008), 0, 0.3); for (let i = 0; i < n; i++) y[i] = Math.tanh(1.3 * y[i]); return scaleTo(fadeEdges(y, 0.0002, 0.04), 1); }); }
function drumTak(v = 0) { return memo('tak' + v, () => { const R = rngFor('tak' + v), y = modal([[238, 1, 0.045], [402, 0.7, 0.03], [661, 0.5, 0.02], [1050, 0.3, 0.012]], 0.22); addInto(y, burst(R, 0.03, 'bp', 2100, 0.9, 0.009), 0, 0.9); return scaleTo(fadeEdges(y, 0.0002, 0.03), 1); }); }
const ting = (f, dur = 0.5) => modal([[f, 1, dur * 0.4], [f * 2.76, 0.4, dur * 0.2], [f * 5.4, 0.2, dur * 0.1]], dur);
function smallBell(f, dec = 0.16) { const y = modal([[f, 1, dec], [f * 1.0031, 0.5, dec], [f * 2.76, 0.45, dec * 0.6], [f * 5.4, 0.22, dec * 0.35], [f * 8.93, 0.1, dec * 0.2]], 0.6); addInto(y, burst(rngFor('bell' + f), 0.004, 'hp', 4000, 0.7, 0.0008), 0, 0.1); return scaleTo(y, 1); }
function crash(R, dur = 2.2) {
  const n = secs(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = filt(filt(noise(R, n), 'hp', 3200, 0.7), 'lp', 9000, 0.7);
    for (let k = 0; k < 9; k++) { const f = 3000 + R() * 5000, a = 0.05 * R(); let ph = R(); for (let i = 0; i < n; i++) { ph += f / SR; x[i] += a * Math.sin(TAU * ph); } }
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.min(1, t / 0.004) * (0.5 * Math.exp(-t / 0.3) + 0.5 * Math.exp(-t / 1.0)); }
    out[ch] = fadeEdges(x, 0.0005, 0.25);
  }
  return out;
}
function reverseCrash(R, dur) {
  const n = secs(dur), out = {};
  for (const ch of ['L', 'R']) { const x = filt(filt(noise(R, n), 'hp', 2500, 0.7), 'lp', 9000, 0.7); for (let i = 0; i < n; i++) x[i] *= Math.pow(i / n, 2.2); out[ch] = fadeEdges(x, 0.01, 0.006); }
  return out;
}

// ======================================================================= foley building blocks
function crinkle(R, dur, rate = 350, lo = 2000, hi = 8000) {
  const n = secs(dur), y = new Float32Array(n + secs(0.01)), V = [];
  for (let k = 0; k < 10; k++) V.push(burst(R, 0.006, 'bp', lo + (hi - lo) * R(), 1.5, 0.0012));
  let t = 0;
  for (;;) { t += -Math.log(1 - R() * 0.999999) / rate; if (t >= dur) break; const u = t / dur; addInto(y, V[(R() * 10) | 0], Math.round(t * SR), Math.pow(Math.sin(Math.PI * u), 0.5) * (0.3 + 0.7 * R()) * sgn(R)); }
  return y;
}
function bubble(f0, len, rise = 0.9) {
  const n = secs(len), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / len; ph += f0 * (1 + rise * u) / SR; y[i] = Math.sin(TAU * ph) * Math.sin(Math.PI * Math.min(1, u * 3)) * Math.exp(-u * 3); }
  return fadeEdges(y, 0.001, 0.005);
}
function softThud(R, f = 70) {
  const y = burst(R, 0.14, 'lp', 350, 0.7, 0.03); let ph = 0;
  for (let i = 0; i < y.length; i++) { const t = i / SR; ph += (f + 50 * Math.exp(-t / 0.02)) / SR; y[i] += Math.sin(TAU * ph) * Math.exp(-t / 0.05) * 0.8; }
  return fadeEdges(filtIn(y, 'hp', 45, 0.7), 0.0005, 0.02);
}
function whoosh(R, dur, f0, fPeak, f1, peakAt = 0.55, Q = 1.2) {
  const n = secs(dur), fc = (t) => { const u = t / dur; return u < peakAt ? f0 * Math.pow(fPeak / f0, u / peakAt) : fPeak * Math.pow(f1 / fPeak, (u - peakAt) / (1 - peakAt)); };
  const x = filt(noise(R, n), 'bp', fc, Q);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] *= u < peakAt ? Math.pow(u / peakAt, 1.8) : Math.pow(1 - (u - peakAt) / (1 - peakAt), 1.4); }
  return fadeEdges(filtIn(x, 'hp', 150, 0.7), 0.003, 0.01);
}
function steamHiss(R, dur, fc = 5200) { const n = secs(dur), x = filt(filt(noise(R, n), 'hp', 2200, 0.7), 'bp', fc, 0.5), fl = flutterEnv(R, n, 6); for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.6 + 0.4 * fl[i]) * smooth(t / 0.15) * (1 - smooth((t - dur * 0.45) / (dur * 0.55))); } return scaleTo(fadeEdges(x, 0.005, 0.02), 1); }
// grain bank: short resonant noise grains (oil micro-bubbles bursting, crumb fractures)
function grainBank(R, count, d0, d1, f0, f1, Q, click = 0) {
  const V = [];
  for (let k = 0; k < count; k++) {
    const d = d0 + (d1 - d0) * R(), f = f0 * Math.pow(f1 / f0, R()), n = secs(d) + 4;
    const x = filt(noise(R, n), 'bp', f, Q);
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.exp(-t / (d / 3.5)); }
    if (click) addInto(x, modal([[f * (0.85 + 0.3 * R()), 1, d * 0.6], [f * (1.6 + 0.5 * R()), 0.5, d * 0.35]], d), 0, click * 0.04);
    V.push(scaleTo(fadeEdges(x, 0.00004, d * 0.25), 1));
  }
  return V;
}
// frying: stereo granular sizzle. o.rate(t) grains/s, o.amp(t) grain level, o.hiss(t) hiss level, o.pop(t) big oil pops/s
function fry(R, dur, o) {
  const n = secs(dur), out = stereo(n + secs(0.03));
  const small = grainBank(R, 64, 0.0003, 0.0022, 2200, 11000, 1.1), mid = grainBank(R, 24, 0.002, 0.009, 900, 4200, 2.2, 1);
  for (const ch of ['L', 'R']) {
    const y = out[ch];
    const h = scaleTo(filt(filt(noise(R, n), 'hp', 2600, 0.7), 'lp', 12500, 0.7), 1), fl = flutterEnv(R, n, 26), fl2 = flutterEnv(R, n, 4);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] += h[i] * o.hiss(t) * (0.45 + 0.35 * fl[i] + 0.2 * fl2[i]) * 0.5; }
    let t = R() * 0.002;
    for (;;) { const r = Math.max(1, o.rate(t)); t += -Math.log(1 - R() * 0.999999) / r; if (t >= dur) break; addInto(y, small[(R() * 64) | 0], Math.round(t * SR), Math.pow(R(), 2.4) * o.amp(t) * sgn(R)); }
    if (o.pop) { t = R() * 0.05; for (;;) { const r = Math.max(0.2, o.pop(t)); t += -Math.log(1 - R() * 0.999999) / r; if (t >= dur) break; addInto(y, mid[(R() * 24) | 0], Math.round(t * SR), (0.3 + 0.7 * Math.pow(R(), 1.5)) * o.amp(t) * 1.4 * sgn(R)); } }
  }
  out.L = fadeEdges(out.L, 0.002, 0.03); out.R = fadeEdges(out.R, 0.002, 0.03);
  return out;
}
// crunch: dense brittle fractures (heavy-tailed amplitudes), o.rate(t), o.amp(t), freq range, grain length range
function crunchCore(R, dur, o) {
  const n = secs(dur + 0.05), y = new Float32Array(n);
  const bank = grainBank(R, 48, o.gd0, o.gd1, o.f0, o.f1, o.Q ?? 1.6, o.click ?? 1);
  let t = 0;
  for (;;) { t += -Math.log(1 - R() * 0.999999) / Math.max(1, o.rate(t)); if (t >= dur) break; addInto(y, bank[(R() * 48) | 0], Math.round(t * SR), o.amp(t) * Math.pow(R(), o.skew ?? 1.8) * sgn(R)); }
  return y;
}
function oilPop(R) {
  const f = 1400 + 2600 * R(), y = new Float32Array(secs(0.08));
  addInto(y, burst(R, 0.012, 'bp', f, 1.4, 0.0022, 0.00005), 0, 1);
  addInto(y, modal([[f * 1.35, 0.5, 0.0035], [f * 0.7, 0.4, 0.004]], 0.015), 0, 0.03);
  const tail = filt(noise(R, secs(0.07)), 'hp', 4500, 0.7); for (let i = 0; i < tail.length; i++) tail[i] *= 0.12 * Math.exp(-i / SR / 0.018);
  addInto(y, tail, secs(0.002), 1);
  return scaleTo(fadeEdges(y, 0.0001, 0.01), 1);
}
function woodCrack(R) {
  const y = new Float32Array(secs(0.12)), f = 1500 + 2200 * R();
  addInto(y, burst(R, 0.02, 'hp', 1400, 0.7, 0.003), 0, 1);
  addInto(y, modal([[f, 0.6, 0.006], [f * 1.7, 0.4, 0.004], [f * 0.55, 0.4, 0.01]], 0.05), 0, 0.03);
  addInto(y, crinkle(R, 0.08, 500, 1200, 6000), secs(0.004), 0.25);
  return scaleTo(y, 1);
}
// wood fire under the clay stove: low roar breathing + crackle (ticks, clusters, sharp pops)
function fireBed(R, dur) {
  const n = secs(dur), out = stereo(n + secs(0.2));
  const bank = grainBank(R, 28, 0.002, 0.012, 800, 5000, 2.4, 1);
  for (const ch of ['L', 'R']) {
    const y = out[ch];
    const rum = scaleTo(filt(filt(noise(R, n), 'lp', 230, 0.7), 'hp', 35, 0.7), 1), fl = flutterEnv(R, n, 2.2);
    const br = scaleTo(filt(noise(R, n), 'bp', 650, 0.5), 1), fl2 = flutterEnv(R, n, 1.1);
    for (let i = 0; i < n; i++) y[i] = rum[i] * 0.4 * (0.35 + 0.65 * fl[i]) + br[i] * 0.05 * fl2[i];
    let t = R() * 0.05;
    for (;;) {
      t += -Math.log(1 - R() * 0.999999) / 13; if (t >= dur) break;
      if (R() < 0.09) addInto(y, woodCrack(R), secs(t), (0.3 + 0.45 * R()) * sgn(R));
      else addInto(y, bank[(R() * 28) | 0], secs(t), (0.06 + 0.4 * Math.pow(R(), 2)) * sgn(R));
      if (R() < 0.22) { const k = 2 + ((R() * 5) | 0); for (let j = 0; j < k; j++) addInto(y, bank[(R() * 28) | 0], secs(t + 0.004 + R() * 0.07), (0.04 + 0.18 * R()) * sgn(R)); }
    }
  }
  return out;
}
function flare(R, dur = 1.0) {
  const n = secs(dur), fc = (t) => (t < 0.12 ? 250 * Math.pow(8, t / 0.12) : 2000 * Math.pow(0.3, (t - 0.12) / (dur - 0.12)));
  const out = stereo(n);
  for (const ch of ['L', 'R']) {
    const x = scaleTo(filt(noise(R, n), 'bp', fc, 0.55), 1), lo = scaleTo(filt(noise(R, n), 'lp', 160, 0.7), 1);
    for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / 0.1) * Math.exp(-Math.max(0, t - 0.1) / 0.32); x[i] = (x[i] * 0.7 + lo[i]) * e; }
    out[ch] = fadeEdges(x, 0.002, 0.05);
  }
  return out;
}
// cast-iron pan dragged / rotated on the clay stove: stick-slip impulses through pan modes + grit + low rumble
function panScrape(R, dur) {
  const n = secs(dur), imp = new Float32Array(n);
  let t = 0.01; while (t < dur - 0.01) { const u = t / dur; imp[Math.round(t * SR)] = (0.4 + 0.6 * R()) * sgn(R); t += 1 / (45 + 45 * Math.sin(Math.PI * u) + 30 * R()); }
  const y = new Float32Array(n);
  for (const [f, Q, g] of [[305, 16, 1], [865, 22, 0.8], [1620, 26, 0.6], [2470, 26, 0.45], [3880, 22, 0.25]]) addInto(y, filt(imp, 'bp', f * (0.97 + 0.06 * R()), Q), 0, g);
  scaleTo(y, 1);
  const grit = scaleTo(filt(filt(noise(R, n), 'bp', 1300, 0.7), 'hp', 300, 0.7), 1), ge = flutterEnv(R, n, 60);
  const rum = scaleTo(filt(noise(R, n), 'lp', 170, 0.7), 1);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] = (y[i] * 0.7 + grit[i] * 0.45 * ge[i] + rum[i] * 0.35) * Math.pow(Math.sin(Math.PI * u), 0.6); }
  return scaleTo(fadeEdges(filtIn(y, 'hp', 60, 0.7), 0.005, 0.02), 1);
}
// thin steel spatula sliding under the crepe
function spatulaSlide(R, dur) {
  const n = secs(dur), imp = new Float32Array(n);
  let t = 0.01; while (t < dur - 0.01) { imp[Math.round(t * SR)] = (0.5 + 0.5 * R()) * sgn(R); t += 1 / (80 + 40 * R()); }
  const y = new Float32Array(n);
  for (const [f, g] of [[1900, 1], [3350, 0.6], [5250, 0.35]]) addInto(y, filt(imp, 'bp', f, 30), 0, g);
  scaleTo(y, 1); addInto(y, scaleTo(filt(noise(R, n), 'bp', 2800, 1), 1), 0, 0.15);
  for (let i = 0; i < n; i++) y[i] *= Math.pow(Math.sin(Math.PI * i / n), 0.7);
  return scaleTo(fadeEdges(filtIn(y, 'hp', 800, 0.7), 0.004, 0.02), 1);
}
function waterLap(R, dur) {
  const n = secs(dur), out = stereo(n);
  for (const ch of ['L', 'R']) {
    const y = out[ch], bed = filt(filt(noise(R, n), 'lp', 380, 0.6), 'hp', 70, 0.7), mid = filt(noise(R, n), 'bp', 700, 0.9), env = new Float32Array(n);
    let t = R() * 0.8;
    while (t < dur) { const a = 0.5 + 0.5 * R(), at = 0.12 + 0.1 * R(), dc = 0.35 + 0.4 * R(), i0 = Math.round(t * SR), len = secs(at + dc * 3); for (let k = 0; k < len && i0 + k < n; k++) { const u = k / SR; env[i0 + k] += a * (u < at ? Math.sin(Math.PI / 2 * u / at) : Math.exp(-(u - at) / dc)); } t += 0.55 + R() * 1.0; }
    for (let i = 0; i < n; i++) y[i] = bed[i] * (0.3 + 0.3 * env[i]) + mid[i] * 0.6 * env[i];
    for (let tt = R() * 0.5; tt < dur - 0.1; tt += 0.3 + R() * 1.2) addInto(y, bubble(500 + R() * 900, 0.03 + R() * 0.04, 0.6 + R()), Math.round(tt * SR), 0.03 + 0.05 * R());
  }
  return out;
}
function birdCall(R) {
  const k = 2 + ((R() * 3) | 0), y = new Float32Array(secs(0.85)), base = 2600 + R() * 1600; let t = 0;
  for (let j = 0; j < k; j++) { const d = 0.05 + R() * 0.05, f0 = base * (0.9 + 0.25 * R()), f1 = f0 * (1.15 + 0.3 * R()), n = secs(d), z = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += (f0 + (f1 - f0) * Math.sin(Math.PI * u)) / SR; z[i] = Math.sin(TAU * ph) * Math.pow(Math.sin(Math.PI * u), 1.5); } addInto(y, z, secs(t), 0.7 + 0.3 * R()); t += d + 0.03 + R() * 0.06; }
  return y;
}
// distant spotted dove "cuc cu cu"
function dove(R) {
  const y = new Float32Array(secs(1.4));
  for (const [t0, d, f, a] of [[0, 0.26, 610, 0.8], [0.36, 0.2, 575, 0.6], [0.66, 0.5, 540, 1]]) {
    const n = secs(d), z = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const u = i / n; ph += f * (1 + 0.04 * Math.sin(Math.PI * u) - 0.03 * u) / SR; z[i] = (Math.sin(TAU * ph) + 0.12 * Math.sin(2 * TAU * ph)) * Math.pow(Math.sin(Math.PI * u), 1.3); }
    addInto(y, z, secs(t0), a);
  }
  addInto(y, scaleTo(filt(noise(R, y.length), 'bp', 600, 4), 0.05), 0, 1);
  return scaleTo(fadeEdges(filtIn(y, 'lp', 1800, 0.7), 0.005, 0.02), 1);
}
function breeze(R, dur) {
  const n = secs(dur), out = stereo(n);
  for (const ch of ['L', 'R']) {
    const lo = scaleTo(filt(filt(noise(R, n), 'lp', 650, 0.6), 'hp', 70, 0.7), 1), mid = scaleTo(filt(noise(R, n), 'bp', (t) => 900 + 500 * Math.sin(TAU * 0.11 * t), 0.6), 1);
    const gust = flutterEnv(R, n, 0.35), fr = crinkle(R, dur, 70, 1800, 5500);
    for (let i = 0; i < n; i++) { const g = 0.35 + 0.65 * gust[i]; out[ch][i] = (lo[i] * 0.5 + mid[i] * 0.25) * g + fr[i] * 0.12 * g * g; }
  }
  return out;
}

// ======================================================================= MUSIC
log('music...');
// harmony (beats): dieu Bac pentatonic G A C D E only
const CH = {
  G: { arp: [55, 62, 67, 69, 74, 76, 79, 81], pad: [43, 55, 62, 69, 74] },
  C: { arp: [48, 55, 60, 64, 67, 72, 74, 76], pad: [36, 55, 64, 67, 74] },
  Am: { arp: [45, 52, 57, 60, 64, 69, 72, 76], pad: [45, 57, 64, 67, 72] },
  D: { arp: [50, 57, 62, 67, 69, 72, 74, 79], pad: [38, 57, 62, 67, 72] },
  Em: { arp: [52, 55, 62, 64, 69, 74, 76, 79], pad: [40, 55, 62, 64, 69] },
};
const CHT = [[0, 'G'], [4, 'C'], [8, 'Am'], [12, 'D'], [16, 'G'], [19, 'D'], [21, 'C'], [23, 'G'], [25, 'Em'], [27, 'Am'], [30, 'C'], [32, 'G'], [34, 'D'], [37, 'G'], [39, 'D'], [40, 'G'], [42, 'C'], [44, 'Am'], [45, 'C'], [46, 'D'], [47, 'G']];
function chordAt(b) { let c = CHT[0][1]; for (const [s, nm] of CHT) { if (b >= s - 1e-6) c = nm; else break; } return c; }
const PC = new Set([7, 9, 0, 2, 4]);
const mb = (t) => (t < 30.6 ? MUS_A : MUS_B);
const RS = rngFor('human');
const tpan = (m) => clamp((m - 66) / 26, -0.65, 0.65);
const TR_G = 0.3;
function T(b, m, o = {}) {
  const t = bt(b) + (o.exact ? 0 : (RS() - 0.5) * 0.014) + (o.dt || 0);
  const g = (o.g ?? 0.5) * TR_G * (m < 52 ? 0.8 : 1) * (0.9 + 0.2 * RS());
  put(mb(t), t, tranh(m, o.ring ?? 2.4, o.orn || ''), { gain: g, pan: tpan(m), hall: o.hall ?? 0.42 });
}
function arp(b0, b1, step, pat, g, o = {}) {
  let k = 0;
  for (let b = b0; b < b1 - 1e-6; b += step, k++) {
    const idx = pat[k % pat.length]; if (idx < 0) continue;
    const tones = CH[chordAt(b + 1e-4)].arp, m = tones[Math.min(idx, tones.length - 1)];
    const on = Math.abs(b - Math.round(b)) < 1e-6, acc = on ? 1 : (step < 0.5 && Math.abs(b * 2 - Math.round(b * 2)) > 1e-6 ? 0.62 : 0.8);
    let orn = '';
    if (o.orn && RS() < o.orn) orn = (m % 12 === 2 || m % 12 === 7) && step >= 0.5 ? 'nhan' : 'rung';
    T(b, m, { g: g * acc, ring: o.ring ?? 2.4, orn });
  }
}
function gliss(bEnd, m0, m1, dur, g0, g1, ring = 1.6) {
  const notes = []; for (let m = m0; m <= m1; m++) if (PC.has(((m % 12) + 12) % 12)) notes.push(m);
  const tE = bt(bEnd), k = notes.length;
  notes.forEach((m, j) => { const u = j / (k - 1), t = tE - dur * Math.pow(1 - u, 1.15); put(mb(t), t, tranh(m, ring), { gain: (g0 + (g1 - g0) * u) * TR_G, pan: tpan(m), hall: 0.5 }); });
}
function trem(b0, b1, m, g0, g1) { const t0 = bt(b0), t1 = bt(b1); let k = 0; for (let t = t0; t < t1 - 1e-6; t += 0.072, k++) put(mb(t), t, tranh(m, 0.1), { gain: (g0 + (g1 - g0) * (t - t0) / (t1 - t0)) * (k % 2 ? 0.75 : 1) * TR_G, pan: tpan(m), hall: 0.4 }); }
function melody(fn, arr, g, pan, hall) { for (const [b, l, m, op = {}] of arr) { const t = bt(b); put(mb(t), t, fn(m, bt(l) * 0.96, op), { gain: g * (op.g ?? 1), pan, hall }); } }

// ---- pads
const PADS = [
  // [b0, b1, chord, gain, opts]
  [1, 4, 'G', 0.9, { att: 2.6 }], [4, 8, 'C', 0.9], [8, 12, 'Am', 0.9], [12, 16, 'D', 0.95], [16, 19, 'G', 1.0, { air: 0.6 }], [19, 21, 'D', 0.9, { air: 0.6 }],
  [21, 23, 'C', 1.25, { shimmer: 1, air: 1, lp: 5200, att: 0.6 }], [23, 25, 'G', 1.25, { shimmer: 1, air: 1, lp: 5200 }], [25, 27, 'Em', 1.1, { shimmer: 0.6, air: 0.8, lp: 4200 }],
  [27, 30, 'Am', 0.95, { air: 0.5, att: 1.2 }], [30, 32, 'C', 0.95, { air: 0.5 }], [32, 34, 'G', 0.95, { air: 0.5 }], [34, 36.4, 'D', 0.9, { rel: 0.9 }],
  [37, 39, 'G', 0.8, { att: 2.0, air: 0.6 }], [39, 40, 'D', 0.95, { shimmer: 0.6, air: 0.8, att: 0.6 }],
  [40, 42, 'G', 1.25, { shimmer: 1, air: 1, lp: 5500, att: 0.15 }], [42, 44, 'C', 1.05, { lp: 4800, shimmer: 0.5 }], [44, 45, 'Am', 1.0, { lp: 4800, att: 0.25 }], [45, 46, 'C', 1.0, { lp: 4800, att: 0.25 }],
  [46, 47, 'D', 1.0, { lp: 4800, att: 0.25 }], [47, 47.8, 'G', 0.9, { lp: 4800, att: 0.08, rel: 0.4, tail: 0 }],
];
const PAD_G = 0.1;
PADS.forEach(([b0, b1, nm, g, o = {}], k) => {
  const shortSeg = b1 - b0 <= 1.01, pre = o.att != null && o.att < 0.7 ? 0.1 : 0.35;
  const t0 = Math.max(0, bt(b0) - (b0 === 37 || b0 === 1 || b0 === 40 ? 0 : pre)), tail = o.tail ?? (shortSeg ? 0.5 : 1.3);
  const dur = bt(b1) + tail - t0, att = o.att ?? (shortSeg ? 0.25 : 1.1), rel = o.rel ?? (shortSeg ? 0.55 : 1.5);
  put(mb(t0 + 0.01), t0, padSeg(CH[nm].pad, dur, att, rel, k, o), { gain: g * PAD_G, hall: 0.55 });
});

// ---- dan tranh
// intro (music enters quietly at 0.83)
T(1, 55, { g: 0.5, exact: true }); T(1, 74, { g: 0.85, orn: 'rung', ring: 3.2, exact: true });
T(2, 67, { g: 0.5 }); T(2.5, 69, { g: 0.55 }); T(3, 74, { g: 0.65, orn: 'nhan' });
T(4, 48, { g: 0.5 }); T(4, 76, { g: 0.75, orn: 'rung', ring: 3 }); T(5, 67, { g: 0.5 }); T(5.5, 72, { g: 0.55 });
gliss(6, 60, 81, 0.3, 0.25, 0.6);                     // swept into the whip-pan at 5.0
arp(6, 16, 0.5, [0, 2, 4, 3, 5, 4, 6, 5], 0.55, { orn: 0.15 });
T(8, 45, { g: 0.5 }); T(12, 50, { g: 0.5 });
// flute enters 13.33: tranh thins out
T(16, 55, { g: 0.5 }); arp(16, 20, 0.5, [0, -1, 3, 4, -1, 6, -1, 5], 0.5, { orn: 0.2 });
T(19, 50, { g: 0.45 });
// RAC at 16.667 (beat 20): nothing new; rising gliss blooms into the hero plate at 17.5
gliss(21, 62, 88, 0.55, 0.2, 0.75, 2.2);
T(21, 48, { g: 0.6, ring: 3.4, exact: true }); T(21, 79, { g: 0.6, orn: 'rung', ring: 3, exact: true });
arp(21.5, 26.5, 0.5, [3, 5, 7, 6, 4, 5, 2, 0, 3, 5, 7, 6, 4, 6, 5, 2], 0.5, { orn: 0.25 });
T(23, 55, { g: 0.55 }); T(25, 52, { g: 0.55 });
// breath hold 22.3-22.9 (beats 26.76-27.48): silence in the arrangement
T(28, 45, { g: 0.45 }); arp(28, 35, 0.5, [0, -1, 3, 4, -1, 6, -1, 5], 0.4, { orn: 0.2 });
T(30, 48, { g: 0.45 }); T(32, 55, { g: 0.45 }); T(34, 50, { g: 0.45 });
// after the bite: a few high notes over the ambience, vê tremolo, gliss into the climax
T(38, 79, { g: 0.45, orn: 'rung', ring: 2.6 }); T(38.5, 76, { g: 0.35 });
trem(38.75, 39.62, 74, 0.08, 0.42);
gliss(40, 55, 88, 0.36, 0.25, 0.7);
// climax 33.333
T(40, 43, { g: 0.75, ring: 3, exact: true }); T(40, 55, { g: 0.6, ring: 3, exact: true }); T(40, 86, { g: 0.6, orn: 'rung', ring: 2.6, exact: true });
arp(40.5, 41.5, 0.5, [4, 6], 0.5);
// playful 34.58-39.17: rippling 16ths
arp(41.5, 47, 0.25, [0, -1, 4, 5, 6, -1, 5, 4, 2, -1, 4, 5, 7, 6, 5, 4], 0.36, { orn: 0.06, ring: 1.6 });
for (const b of [42, 44, 45, 46]) T(b, CH[chordAt(b)].arp[0], { g: 0.45, ring: 1.8 });
// final: decisive chord on beat 47 (39.167), then a clean last note + small bell at 39.5
for (const [m, g] of [[43, 0.6], [55, 0.5], [67, 0.45], [74, 0.45]]) put(MUS_B, bt(47), choke(tranh(m, 0.35).slice(), 0.35, 0.06), { gain: g * TR_G, pan: tpan(m), hall: 0.3 });
{ const y = tranh(79, 0.22).slice(); choke(y, 0.22, 0.07); put(MUS_B, 39.5, y, { gain: 0.6 * TR_G, pan: 0.15, hall: 0.25 }); }
put(MUS_B, 39.505, smallBell(m2f(91), 0.11), { gain: 0.07, pan: 0.3, hall: 0.2 });

// ---- sao truc
const SAO_G = 0.16;
melody(sao, [[16, 1.5, 74, { sc: 2 }], [17.5, 0.5, 76], [18, 1.5, 79, { gr: 81 }], [19.5, 0.5, 76], [20, 1.0, 74, { vib: 0.6 }]], SAO_G, 0.12, 0.5);
melody(sao, [[21, 2, 79, { gr: 81 }], [23, 0.5, 81], [23.5, 0.5, 79], [24, 1, 76], [25, 0.5, 74], [25.5, 1.2, 76, { sc: 2 }]], SAO_G * 1.1, 0.12, 0.55);
melody(sao, [[40, 1.75, 86, { sc: 2 }], [42, 0.5, 79, { vib: 0.3 }], [42.5, 0.5, 81, { vib: 0.3 }], [43, 0.5, 84, { vib: 0.3 }], [43.5, 0.25, 81, { vib: 0 }], [43.75, 0.25, 79, { vib: 0 }], [44, 0.5, 76, { vib: 0.3 }],
  [44.5, 0.5, 79, { vib: 0.3 }], [45, 1, 81], [46, 0.5, 79, { vib: 0.3 }], [46.5, 0.5, 76, { vib: 0.3 }], [47, 0.4, 79, { vib: 0 }]], SAO_G * 0.95, 0.12, 0.45);
// ---- dan bau answers while the roll is made (23.3-29.8)
melody(bau, [[28, 1.5, 72, { sl: 3 }], [29.5, 0.5, 69], [30, 2, 76, { bends: [[0.65, 0.85, 3], [1.1, 1.3, -3]] }], [32, 0.5, 74], [32.5, 0.5, 72], [33, 1.5, 74, { vib: 0.45 }], [34.5, 1.2, 69, { sl: 2 }]], 0.17, -0.12, 0.5);

// ---- chimes, swells, light percussion
{
  const R = rngFor('chime');
  [91, 93, 96, 98, 100, 103].forEach((m, k) => put(MUS_A, 17.5 + k * 0.055 + R() * 0.02, ting(m2f(m), 1.4), { gain: 0.045 * (1 - k * 0.08), pan: (k % 2 ? 0.5 : -0.5) * (0.5 + 0.5 * R()), hall: 0.7 }));
  put(MUS_B, bt(40) - 1.5, reverseCrash(R, 1.5), { gain: 0.05, hall: 0.3 });
  put(MUS_B, bt(40), crash(R, 2.6), { gain: 0.045, hall: 0.35 });
  put(MUS_B, bt(40), drumBum(), { gain: 0.32, hall: 0.15 });
  put(MUS_B, bt(40), songLoan(), { gain: 0.1, pan: 0.25, hall: 0.2 });
  // groove 34.17-39.0: shaker 16ths, mo, trong com, song loan
  for (let s = 4; s < 28; s++) {
    const b = 40 + s / 4, t = bt(b) + (RS() - 0.5) * 0.008, j = s % 16;
    put(MUS_B, t, shaker(s % 4 === 2, s), { gain: s % 4 === 2 ? 0.05 : s % 2 ? 0.026 : 0.034, pan: 0.42, hall: 0.12 });
    if (j === 0 || j === 8) put(MUS_B, t, mo(false), { gain: 0.11, pan: -0.3, hall: 0.18 });
    if (j === 4 || j === 12 || j === 14) put(MUS_B, t, mo(true), { gain: j === 14 ? 0.07 : 0.1, pan: -0.38, hall: 0.18 });
    if (j === 0 || j === 6 || j === 8) put(MUS_B, t, drumBum(), { gain: j === 6 ? 0.18 : 0.26, pan: 0.05, hall: 0.1 });
    if (j === 4 || j === 12) put(MUS_B, t, drumTak(0), { gain: 0.16, pan: 0.1, hall: 0.12 });
    if (j === 10 || j === 15) put(MUS_B, t, drumTak(1), { gain: 0.06, pan: 0.1, hall: 0.1 });
    if (j === 0) put(MUS_B, t, songLoan(), { gain: 0.08, pan: 0.25, hall: 0.15 });
  }
  put(MUS_B, bt(47), drumBum(), { gain: 0.3, hall: 0.1 });
  put(MUS_B, bt(47), mo(false), { gain: 0.1, pan: -0.3, hall: 0.12 });
  put(MUS_B, bt(47), songLoan(), { gain: 0.1, pan: 0.25, hall: 0.12 });
}

// ======================================================================= FOLEY
log('foley...');
const F = (t, sig, o = {}) => put(SFX, t, sig, o);
// fire bed (kitchen 0-17.5): almost silent tiny crackle at 0-0.3, bed under the pan, quieter on the table shots, flare 10.0-10.8
{
  const R = rngFor('fire');
  const fire = normM(fireBed(R, 17.7), -27);
  const FK = [[0, 0.35], [0.3, 0.6], [4.9, 0.6], [5.15, 0.3], [9.1, 0.3], [9.6, 0.65], [9.95, 1.0], [10.8, 0.85], [11.2, 0.6], [17.3, 0.55], [17.52, 0]];
  F(0, fire, { env: (t) => pw(FK, t), room: 0.12 });
  F(9.95, normM(flare(R, 1.0), -21), { room: 0.15 });
}
// sizzle bed 0.3-17.5 (after the big XEEO it settles into a continuous xeo-xeo bed)
{
  const R = rngFor('bed');
  const bed = normM(fry(R, 17.3, { rate: () => 1500, amp: () => 1, hiss: () => 1, pop: () => 7 }), -21);
  const SK = [[0.3, 0], [0.36, 0.55], [2.0, 0.75], [4.9, 0.6], [5.15, 0.22], [9.25, 0.22], [9.32, 0.55], [10.6, 0.45], [10.83, 0.5], [13.33, 0.38], [15.8, 0.3], [16.6, 0.35], [16.75, 0.55], [17.2, 0.4], [17.47, 0.35], [17.53, 0]];
  F(0.3, bed, { env: (t) => pw(SK, t), room: 0.1 });
}
// 0.30 the big XEEO: batter hits the hot cast iron
{
  const R = rngFor('xeo1'), d = 3.4, n = secs(d);
  const s = fry(R, d, { rate: (t) => 9000 * Math.exp(-t / 0.35) + 1600, amp: (t) => 0.35 + 0.65 * Math.exp(-t / 0.9), hiss: (t) => Math.min(1, t / 0.012) * (0.3 + 0.7 * Math.exp(-t / 0.7)) * (1 - smooth((t - d + 0.6) / 0.6)), pop: (t) => 45 * Math.exp(-t / 0.5) + 5 });
  for (const ch of ['L', 'R']) {
    const sw = scaleTo(filt(noise(R, n), 'bp', (t) => 1500 + 3800 * smooth(t / 0.32), 0.85), 1);
    for (let i = 0; i < n; i++) { const t = i / SR; sw[i] *= Math.min(1, t / 0.01) * (0.25 + 0.75 * Math.exp(-t / 0.45)) * (1 - smooth((t - d + 0.8) / 0.8)); }
    addInto(s[ch], sw, 0, 0.55);
    addInto(s[ch], burst(R, 0.1, 'lp', 700, 0.7, 0.025), 0, 0.5);            // wet splat of batter
  }
  F(0.3, normM(s, -14.5, 0.55), { room: 0.18 });
  // ladle pour stream + a few bubbles
  const pn = secs(0.55), pour = scaleTo(filt(filt(noise(R, pn), 'bp', 600, 0.7), 'lp', 1800, 0.7), 1), pfl = flutterEnv(R, pn, 10);
  for (let i = 0; i < pn; i++) { const t = i / SR; pour[i] *= (0.4 + 0.6 * pfl[i]) * smooth(t / 0.04) * (1 - smooth((t - 0.35) / 0.2)); }
  for (let t = 0.04; t < 0.45; t += 0.05 + R() * 0.07) addInto(pour, bubble(300 + R() * 400, 0.05, 0.8), secs(t), 0.25);
  F(0.24, normM(fadeEdges(pour, 0.005, 0.02), -24), { pan: -0.1 });
}
// 5.0 whoosh (whip pan in from the right)
{
  const R = rngFor('whoosh'), d = 0.5;
  const w = whoosh(R, d, 260, 2600, 380, 0.62, 1.0); addInto(w, whoosh(R, d, 1500, 6500, 2000, 0.62, 0.8), 0, 0.35);
  F(5.0 - 0.62 * d, normM(w, -19), { pan: (t) => 0.85 - 1.55 * (t / d) });
}
// 6.9 shrimp set on the ceramic plate: light "cach"
{
  const R = rngFor('clink'), y = new Float32Array(secs(0.4));
  addInto(y, modal([[2930, 1, 0.06], [5150, 0.55, 0.035], [7700, 0.3, 0.02], [1380, 0.45, 0.05]], 0.4), 0, 1);
  addInto(y, burst(R, 0.006, 'hp', 3000, 0.7, 0.001), 0, 0.5);
  addInto(y, softThud(R, 120), 0, 0.25);
  F(6.9, normM(y, -24, 0.3), { pan: 0.1, room: 0.08 });
}
// 7.50 / 7.92 knife slices through pork belly onto the wooden board
for (const [t0, k] of [[7.5, 0], [7.917, 1]]) {
  const R = rngFor('knife' + k), y = new Float32Array(secs(0.35)), sl = secs(0.075);
  const s = scaleTo(filt(noise(R, sl), 'bp', (t) => 1800 + 1500 * t / 0.075, 1.3), 1), fl = flutterEnv(R, sl, 180);
  for (let i = 0; i < sl; i++) { const u = i / sl; s[i] *= Math.pow(u, 0.8) * (0.4 + 0.6 * fl[i]); }
  addInto(y, fadeEdges(s, 0.003, 0.003), 0, 0.5);
  addInto(y, modal([[205, 1, 0.045], [470, 0.6, 0.028], [1080, 0.35, 0.016], [2650, 0.25, 0.006]], 0.25), sl, 1.0);
  addInto(y, burst(R, 0.008, 'hp', 2500, 0.7, 0.0015), sl, 0.6);
  addInto(y, modal([[4100 + 300 * R(), 0.3, 0.008]], 0.04), sl, 1);
  F(t0 - 0.075, normM(y, -18, 0.4), { pan: -0.05, room: 0.1 });
}
// 8.33-9.17 coconut-heart shreds rustle, bean sprouts falling into the bamboo basket (slow-mo)
{
  const R = rngFor('sprouts');
  const sh = crinkle(R, 0.45, 260, 2500, 8000); filtIn(sh, 'hp', 1500, 0.7);
  F(8.33, normM(sh, -27), { pan: 0.2 });
  const n = secs(0.75), y = new Float32Array(n + secs(0.1));
  let t = 0.01; for (;;) { const r = 18 + 70 * Math.sin(Math.PI * clamp(t / 0.62)); t += -Math.log(1 - R() * 0.999999) / r; if (t >= 0.62) break;
    const f = 1300 + 1800 * R(), z = modal([[f, 1, 0.006], [f * 2.3, 0.4, 0.004], [750 + 350 * R(), 0.25, 0.03]], 0.06); addInto(z, burst(R, 0.006, 'bp', 3500 + 3000 * R(), 1.2, 0.0012), 0, 0.03);
    addInto(y, z, secs(t), (0.3 + 0.7 * R()) * sgn(R)); }
  addInto(y, scaleTo(crinkle(R, 0.7, 500, 1500, 5000), 1), 0, 0.15);
  F(8.55, normM(filtIn(y, 'hp', 300, 0.7), -23), { pan: -0.1, room: 0.08 });
}
// 9.30 second sizzle: shrimp + pork into the pan, "tach tach" pops
{
  const R = rngFor('xeo2'), d = 2.0;
  const s = fry(R, d, { rate: (t) => 6000 * Math.exp(-t / 0.3) + 900, amp: (t) => 0.4 + 0.6 * Math.exp(-t / 0.6), hiss: (t) => Math.min(1, t / 0.015) * (0.3 + 0.7 * Math.exp(-t / 0.5)) * (1 - smooth((t - d + 0.6) / 0.6)), pop: (t) => 25 * Math.exp(-t / 0.5) + 3 });
  F(9.3, normM(s, -16, 0.5), { room: 0.15 });
  for (const t of [9.36, 9.47, 9.62, 9.71, 9.9, 10.05, 10.22, 10.41]) F(t + (R() - 0.5) * 0.03, normM(oilPop(R), -24 + R() * 4, 0.4), { pan: (R() - 0.5) * 0.9, room: 0.1 });
}
// 10.83-13.33 pan swirl: cast iron scraping on the stove, batter sizzling as it flows round, steam
{
  const R = rngFor('swirl'), d = 2.7, n = secs(d);
  const s = fry(R, d, { rate: (t) => 2600 + 1800 * Math.max(0, Math.sin(TAU * 0.75 * t)), amp: (t) => 0.6 + 0.4 * Math.max(0, Math.sin(TAU * 0.75 * t)), hiss: (t) => smooth(t / 0.15) * (0.55 + 0.45 * Math.sin(TAU * 0.75 * t - 0.6)) * (1 - smooth((t - d + 0.5) / 0.5)), pop: () => 6 });
  for (let i = 0; i < n; i++) { const t = i / SR, c = Math.cos(TAU * 0.75 * t); s.L[i] *= 0.72 + 0.28 * c; s.R[i] *= 0.72 - 0.28 * c; }
  for (const [t0, k] of [[0.05, 1], [1.0, 0.8], [1.75, 0.7]]) {
    const sw = scaleTo(filt(noise(R, secs(0.6)), 'bp', (t) => 1800 + 3200 * smooth(t / 0.25), 0.9), 1);
    for (let i = 0; i < sw.length; i++) { const t = i / SR; sw[i] *= Math.min(1, t / 0.02) * Math.exp(-t / 0.22) * k; }
    addInto(s.L, sw, secs(t0), 0.35); addInto(s.R, sw, secs(t0), 0.35);
  }
  F(10.83, normM(s, -18, 0.7), { room: 0.15 });
  for (const [t0, d2, p] of [[10.86, 0.62, 0.25], [11.86, 0.5, -0.2], [12.68, 0.46, 0.15]]) F(t0, normM(panScrape(R, d2), -22, 0.45), { pan: p, room: 0.15 });
  F(11.2, normM(steamHiss(R, 2.2), -28), { pan: 0.1, room: 0.1 });
}
// 14.6 sprouts sprinkled onto the crepe: soft drops + local sizzle surge
{
  const R = rngFor('sprinkle'), y = new Float32Array(secs(0.9));
  for (let k = 0; k < 26; k++) { const t = R() * 0.5, f = 900 + 1400 * R(); const z = modal([[f, 1, 0.008], [f * 2.1, 0.3, 0.005]], 0.04); addInto(z, burst(R, 0.01, 'bp', 2500 + 2500 * R(), 1, 0.002), 0, 0.03); addInto(y, z, secs(t), (0.4 + 0.6 * R()) * sgn(R)); }
  const f2 = fry(R, 0.8, { rate: (t) => 2500 * Math.exp(-t / 0.3) + 300, amp: () => 0.6, hiss: (t) => smooth(t / 0.08) * Math.exp(-t / 0.3) * 0.6 });
  addInto(y, f2.L, secs(0.05), 0.6);
  F(14.55, normM(filtIn(y, 'hp', 250, 0.7), -23), { pan: -0.15, room: 0.1 });
}
// 16.667 fold: spatula slides under, the crisp edges meet - soft "RAC" + steam puff
{
  const R = rngFor('fold');
  F(16.2, normM(spatulaSlide(R, 0.38), -27, 0.3), { pan: 0.2, room: 0.1 });
  const n = secs(0.7), out = stereo(n);
  for (const ch of ['L', 'R']) {
    const c = crunchCore(R, 0.11, { rate: (t) => 2200 * Math.exp(-t / 0.035) + 150, amp: (t) => Math.exp(-t / 0.05), f0: 1500, f1: 8500, gd0: 0.0005, gd1: 0.003, Q: 1.5, click: 1 });
    addInto(out[ch], scaleTo(c, 1), secs(0.004), 1);
    addInto(out[ch], scaleTo(softThud(R, 95), 1), 0, 0.35);
    addInto(out[ch], scaleTo(steamHiss(R, 0.6, 4800), 1), secs(0.02), 0.22);
  }
  F(16.663, normM(out, -15, 0.6), { room: 0.12 });
}
// 17.50 match cut: plate set down on the wooden table ("coc"), warm steam
{
  const R = rngFor('plate'), y = new Float32Array(secs(0.5));
  addInto(y, modal([[148, 1, 0.06], [338, 0.6, 0.04], [725, 0.35, 0.025], [1480, 0.2, 0.012]], 0.4), 0, 1);
  addInto(y, modal([[2650, 0.2, 0.12], [4870, 0.12, 0.07], [6900, 0.06, 0.04]], 0.4), 0, 1);
  addInto(y, burst(R, 0.01, 'bp', 2400, 0.8, 0.002), 0, 0.4);
  addInto(y, softThud(R, 80), 0, 0.6);
  F(17.5, normM(y, -18, 0.4), { room: 0.06 });
  F(17.55, normM(steamHiss(R, 4.0, 4200), -36), { pan: -0.1 });
}
// 22.50 the crust breaks - extreme slow-motion: tension crackle, big low fracture, stretched crunch, crumbs falling, steam
{
  const R = rngFor('slowcrack');
  const pre = crinkle(R, 0.5, 120, 900, 4000); for (let i = 0; i < pre.length; i++) pre[i] *= Math.pow(i / pre.length, 2);
  F(22.0, normM(pre, -31, 0.2), { pan: 0 });
  const n = secs(2.4), out = stereo(n);
  const main = burst(R, 0.3, 'lp', 1300, 0.7, 0.06, 0.0006);
  addInto(main, modal([[205, 1, 0.13], [470, 0.8, 0.085], [920, 0.6, 0.055], [1690, 0.4, 0.03], [2900, 0.25, 0.018]], 0.6), 0, 0.03);
  const sub = new Float32Array(secs(0.9)); { let ph = 0; for (let i = 0; i < sub.length; i++) { const t = i / SR; ph += (48 + 40 * Math.exp(-t / 0.05)) / SR; sub[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.3) * Math.min(1, t / 0.004); } fadeEdges(sub, 0.001, 0.05); }
  for (const ch of ['L', 'R']) {
    const c = crunchCore(R, 1.6, { rate: (t) => 650 * Math.exp(-t / 0.22) + 110 * Math.exp(-t / 0.8) + 8, amp: (t) => Math.exp(-t / 0.45), f0: 320, f1: 4000, gd0: 0.004, gd1: 0.028, Q: 2, click: 1.5, skew: 2.2 });
    addInto(out[ch], scaleTo(c, 1), secs(0.008), 0.85);
    addInto(out[ch], scaleTo(main, 1), 0, 0.9);
    addInto(out[ch], sub, 0, 0.45);
  }
  // crumbs ticking onto the plate
  for (let k = 0; k < 34; k++) {
    const t = 0.35 + Math.pow(R(), 1.3) * 1.7, f = 2600 + 3800 * R(), z = modal([[f, 1, 0.012], [f * 1.9, 0.4, 0.007]], 0.05);
    addInto(z, burst(R, 0.006, 'bp', 4000, 1, 0.0015), 0, 0.02);
    panInto(out, scaleTo(z, 1), secs(t), (0.06 + 0.16 * R()) * (1 - t / 2.4), (R() - 0.5) * 1.4);
  }
  const st = steamHiss(R, 1.8, 4500); panInto(out, st, secs(0.4), 0.05, 0);
  F(22.5, normM(out, -13.5, 0.6), { room: 0.05, hall: 0.22 });
}
// 25.0-28.3 mustard-green leaf rustle while the roll is made
{
  const R = rngFor('leaf');
  const gesture = (d, crisp) => {
    const n = secs(d), y = new Float32Array(n + secs(0.05));
    addInto(y, scaleTo(crinkle(R, d, 380, 1400, 6500), 1), 0, 0.75);
    const sw = scaleTo(filt(noise(R, n), 'bp', 2100, 0.8), 1); for (let i = 0; i < n; i++) sw[i] *= Math.pow(Math.sin(Math.PI * i / n), 1.2) * 0.35; addInto(y, sw, 0, 1);
    for (let k = 0; k < crisp; k++) addInto(y, scaleTo(crunchCore(R, 0.035, { rate: () => 900, amp: () => 1, f0: 1500, f1: 5000, gd0: 0.0008, gd1: 0.003 }), 1), secs(R() * d * 0.8), 0.4);
    return filtIn(y, 'hp', 500, 0.7);
  };
  for (const [t0, d, c, lu, p] of [[25.05, 0.5, 2, -23, 0.2], [25.4, 0.12, 3, -25, 0.1], [25.85, 0.6, 1, -24.5, -0.15], [26.6, 0.45, 1, -25.5, 0.25], [27.25, 0.7, 2, -23.5, -0.1], [27.95, 0.35, 1, -25.5, 0.05]]) F(t0, normM(gesture(d, c), lu, 0.4), { pan: p });
  // faint outdoor air under the POV shots
  const b = breeze(R, 5.6); for (const ch of ['L', 'R']) for (let i = 0; i < b[ch].length; i++) { const t = i / SR; b[ch][i] *= smooth(t / 0.8) * (1 - smooth((t - 4.9) / 0.5)); }
  put(AMB, 24.8, normM(b, -38), {});
  // held breath before the bite: only a whisper of outdoor air (~-60 dBFS), so 30.5-30.83 is near-silence, not a dropout
  const a = breeze(R, 1.2); for (const ch of ['L', 'R']) for (let i = 0; i < a[ch].length; i++) { const t = i / SR; a[ch][i] *= smooth(t / 0.3) * (1 - smooth((t - 0.8) / 0.4)); }
  put(AMB, 30.1, normM(a, -58), {});
}
// 29.00 dip into the garlic-chilli fish sauce: small "tom" + drips 29.6
{
  const R = rngFor('dip'), y = new Float32Array(secs(0.45));
  addInto(y, burst(R, 0.04, 'bp', 1700, 1, 0.008), 0, 0.35);
  addInto(y, bubble(430, 0.1, 1.3), secs(0.006), 1);
  for (let k = 0; k < 3; k++) addInto(y, bubble(900 + 700 * R(), 0.035, 1), secs(0.05 + 0.05 * k + R() * 0.02), 0.25);
  addInto(y, softThud(R, 110), 0, 0.15);
  F(29.0, normM(filtIn(y, 'hp', 150, 0.7), -20, 0.5), { pan: 0.05 });
  F(29.6, normM(bubble(1350, 0.045, 1.2), -25, 0.3), { pan: 0.08 });
  F(29.83, normM(bubble(1650, 0.04, 1.2), -29, 0.2), { pan: 0.04 });
}
// 30.833 THE BITE: tooth click, crust fracture, dense crunch, wet lettuce crunch, chew, crumbs (loudest moment)
{
  const R = rngFor('bite'), n = secs(0.8), out = stereo(n);
  const tooth = new Float32Array(secs(0.02)); addInto(tooth, burst(R, 0.006, 'hp', 2500, 0.7, 0.0009, 0.00005), 0, 1); addInto(tooth, modal([[3600, 0.6, 0.0025], [5400, 0.4, 0.0018]], 0.015), 0, 0.02);
  const body = new Float32Array(secs(0.14)); addInto(body, burst(R, 0.1, 'lp', 1700, 0.7, 0.016, 0.0002), 0, 1); addInto(body, modal([[420, 1, 0.022], [880, 0.7, 0.015], [1650, 0.5, 0.01], [2600, 0.35, 0.007]], 0.12), 0, 0.02);
  const thump = softThud(R, 85);
  for (const ch of ['L', 'R']) {
    const R2 = rngFor('bite' + ch);
    // three fracture waves: crust under the incisors, the fold of crust behind it, then the lettuce/filling
    const wave = (t) => Math.exp(-t / 0.07) + 0.75 * (t > 0.11 ? Math.exp(-(t - 0.11) / 0.07) : 0) + 0.55 * (t > 0.22 ? Math.exp(-(t - 0.22) / 0.09) : 0);
    const cc = crunchCore(R2, 0.5, { rate: (t) => 3800 * (0.3 + wave(t)) * (1 - smooth((t - 0.33) / 0.15)) + 60, amp: (t) => (0.25 + wave(t)) * (1 - 0.85 * smooth((t - 0.3) / 0.18)), f0: 600, f1: 7500, gd0: 0.0008, gd1: 0.007, Q: 1.4, click: 1 });
    const wet = crunchCore(R2, 0.42, { rate: (t) => 1100 * (1 - smooth((t - 0.25) / 0.15)) + 60, amp: (t) => smooth(t / 0.05) * (1 - smooth((t - 0.22) / 0.18)), f0: 1100, f1: 3200, gd0: 0.004, gd1: 0.012, Q: 3, click: 0.5 });
    addInto(out[ch], scaleTo(cc, 1), secs(0.003), 1); addInto(out[ch], scaleTo(wet, 1), secs(0.03), 0.45);
    addInto(out[ch], scaleTo(tooth, 1), 0, 0.8); addInto(out[ch], scaleTo(body, 1), secs(0.002), 0.7); addInto(out[ch], scaleTo(thump, 1), 0, 0.5);
  }
  { const pk = Math.max(peakOf(out.L), peakOf(out.R)); for (let i = 0; i < n; i++) { const m = (out.L[i] + out.R[i]) / 2 / pk, s = (out.L[i] - out.R[i]) / 2 / pk; out.L[i] = Math.tanh(2.6 * (m + 0.55 * s)); out.R[i] = Math.tanh(2.6 * (m - 0.55 * s)); } }
  out.L = fadeEdges(out.L, 0.0002, 0.08); out.R = fadeEdges(out.R, 0.0002, 0.08);
  F(30.833, normM(out, -9.5, 0.97), { room: 0.03 });
  // chew + crumbs flying onto the table
  const chew = crunchCore(R, 0.22, { rate: (t) => 1500 * Math.exp(-t / 0.06) + 100, amp: (t) => Math.exp(-t / 0.08), f0: 700, f1: 5000, gd0: 0.001, gd1: 0.006 });
  addInto(chew, softThud(R, 90), 0, 0.3);
  F(31.27, normM(chew, -19, 0.4));
  const cr = stereo(secs(0.9));
  for (let k = 0; k < 22; k++) { const t = 0.05 + R() * 0.7, f = 2000 + 3500 * R(), z = modal([[f, 1, 0.008], [f * 2.2, 0.3, 0.005]], 0.04); panInto(cr, z, secs(t), (0.2 + 0.8 * R()) * (1 - t), (R() - 0.5) * 1.6); }
  put(SFX, 30.95, normM(cr, -28, 0.15), {});
}
// 31.67-33.33 evening by the canal: breeze, water lapping, birds (then lower under the playful ending)
{
  const R = rngFor('amb');
  const AK = [[31.35, 0], [31.8, 1], [33.4, 1], [33.9, 0.32], [38.6, 0.3], [39.4, 0]];
  const env = (t) => pw(AK, t);
  put(AMB, 31.3, normM(breeze(R, 8.2), -27), { env });
  put(AMB, 31.3, normM(waterLap(R, 8.2), -29), { env });
  for (const [t, p, g] of [[31.85, 0.55, -30], [32.45, -0.5, -32], [33.0, 0.35, -31], [35.2, -0.45, -36], [37.9, 0.5, -37]]) put(AMB, t, normM(birdCall(R), g, 0.2), { pan: p, hall: 0.25, env });
  put(AMB, 32.15, normM(dove(R), -33, 0.2), { pan: -0.6, hall: 0.3, env });
}
// 36.667 soft pop as the heart appears; heart pulses on each beat after; 37.5 follow click + sparkle
{
  const R = rngFor('cta');
  const pop = new Float32Array(secs(0.25)); { let ph = 0; for (let i = 0; i < pop.length; i++) { const t = i / SR; ph += (280 + 520 * smooth(t / 0.045)) / SR; pop[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.002) * Math.exp(-t / 0.045); } }
  addInto(pop, burst(R, 0.03, 'bp', 2200, 1, 0.006), 0, 0.15); fadeEdges(pop, 0.0005, 0.03);
  F(36.667, normM(pop, -23, 0.3), { pan: 0.1, hall: 0.12 });
  const heart = new Float32Array(secs(0.4));
  const one = (g) => { const z = new Float32Array(secs(0.16)); let ph = 0; for (let i = 0; i < z.length; i++) { const t = i / SR; ph += (68 + 40 * Math.exp(-t / 0.02)) / SR; z[i] = (Math.sin(TAU * ph) + 0.3 * Math.sin(2 * TAU * ph)) * Math.exp(-t / 0.05) * Math.min(1, t / 0.003) * g; } return fadeEdges(z, 0.0005, 0.02); };
  addInto(heart, one(1), 0, 1); addInto(heart, one(0.6), secs(0.17), 1);
  const hn = normM(heart, -24, 0.4);
  for (const b of [45, 46, 47]) F(bt(b), hn, { pan: 0.1, gain: b === 47 ? 0.8 : 1 });
  const click = new Float32Array(secs(0.09));
  addInto(click, burst(R, 0.01, 'hp', 3000, 0.7, 0.002), 0, 0.5);
  addInto(click, modal([[4300, 0.6, 0.008], [2100, 0.5, 0.012], [900, 0.4, 0.015]], 0.04), 0, 0.02);
  addInto(click, burst(R, 0.008, 'hp', 3500, 0.7, 0.0015), secs(0.055), 0.3);
  F(37.5, normM(click, -23, 0.3), { pan: 0.2 });
  [91, 93, 96, 98, 100, 103].forEach((m, k) => put(MUS_B, 37.53 + k * 0.045 + R() * 0.01, ting(m2f(m), 0.7), { gain: 0.04 * (1 - k * 0.1), pan: (k % 2 ? 0.45 : -0.2), hall: 0.35 }));
}

// ======================================================================= MIX + MASTER
log('reverbs...');
function reverb(inL, inR, o = {}) {
  const size = o.size ?? 1, fb = o.fb ?? 0.85, damp = o.damp ?? 0.28, apfb = 0.5;
  const sc = (SR / 44100) * size, spread = 23;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apT = [556, 441, 341, 225];
  const mkC = (len) => ({ buf: new Float32Array(Math.max(8, Math.round(len * sc))), i: 0, st: 0 });
  const cl = combT.map((t) => mkC(t)), cr = combT.map((t) => mkC(t + spread));
  const al = apT.map((t) => mkC(t / size * (0.6 + 0.4 * size))), ar = apT.map((t) => mkC((t + spread) / size * (0.6 + 0.4 * size)));
  const pre = new Float32Array(secs(o.pre ?? 0.022)); let pi = 0;
  const outL = new Float32Array(N), outR = new Float32Array(N);
  const fl = filt(filt(inL, 'hp', o.hp ?? 180, 0.7), 'lp', o.lp ?? 7500, 0.7), fr = filt(filt(inR, 'hp', o.hp ?? 180, 0.7), 'lp', o.lp ?? 7500, 0.7);
  const inG = 0.03 * (o.inGain ?? 1);
  for (let n = 0; n < N; n++) {
    const x = pre[pi]; pre[pi] = (fl[n] + fr[n]) * 0.5 * inG; pi = (pi + 1) % pre.length;
    let l = 0, r = 0;
    for (const c of cl) { const ov = c.buf[c.i]; c.st = ov * (1 - damp) + c.st * damp; c.buf[c.i] = x + c.st * fb; if (++c.i >= c.buf.length) c.i = 0; l += ov; }
    for (const c of cr) { const ov = c.buf[c.i]; c.st = ov * (1 - damp) + c.st * damp; c.buf[c.i] = x + c.st * fb; if (++c.i >= c.buf.length) c.i = 0; r += ov; }
    for (const a of al) { const b = a.buf[a.i]; const ov = -l + b; a.buf[a.i] = l + b * apfb; if (++a.i >= a.buf.length) a.i = 0; l = ov; }
    for (const a of ar) { const b = a.buf[a.i]; const ov = -r + b; a.buf[a.i] = r + b * apfb; if (++a.i >= a.buf.length) a.i = 0; r = ov; }
    outL[n] = l; outR[n] = r;
  }
  return [outL, outR];
}
// stop all reverb sends just before the end so the tail can be cut cleanly
for (const b of [HALLA, HALLB, HALLF, ROOM]) for (let i = secs(39.62); i < N; i++) { const g = 1 - smooth((i / SR - 39.62) / 0.1); b.L[i] *= g; b.R[i] *= g; }
const LUSH = { fb: 0.9, damp: 0.24, pre: 0.04, hp: 160, lp: 8500, size: 1.15 };
const [hAL, hAR] = reverb(HALLA.L, HALLA.R, LUSH);
const [hBL, hBR] = reverb(HALLB.L, HALLB.R, { ...LUSH, fb: 0.88 });
const [hFL, hFR] = reverb(HALLF.L, HALLF.R, { fb: 0.86, damp: 0.3, pre: 0.03 });
const [rmL, rmR] = reverb(ROOM.L, ROOM.R, { size: 0.42, fb: 0.7, damp: 0.45, pre: 0.006, hp: 220, lp: 8000, inGain: 1.6 });

// music ducking / automation (dB) - music A = before the bite, music B = after
const ENV_A = [[0, -90], [0.8, -90], [0.83, -10], [2.6, -10], [4.6, -1.5], [9.2, -1.5], [9.3, -8], [9.95, -8], [10.8, -2], [13.1, -2], [13.4, 0], [16.55, 0], [16.66, -10], [16.95, -10], [17.4, 0], [17.5, 2], [22.15, 2], [22.35, -12], [22.9, -12], [23.6, 0], [28.9, 0], [29.0, -6], [29.35, -6], [29.8, -1], [30.1, -1], [30.48, -90], [40, -90]];
const ENV_B = [[0, -90], [30.84, -90], [30.85, -14], [31.1, -12], [31.7, -6], [32.6, -5], [33.25, 0], [33.333, 1.5], [34.3, 0], [40, 0]];
const mkEnv = (keys) => { const e = new Float32Array(N); for (let i = 0; i < N; i++) { const d = pw(keys, i / SR); e[i] = d <= -89 ? 0 : Math.pow(10, d / 20); } return e; };
const eA = mkEnv(ENV_A), eB = mkEnv(ENV_B);
let musL = new Float32Array(N), musR = new Float32Array(N);
for (let i = 0; i < N; i++) { musL[i] = (MUS_A.L[i] + hAL[i]) * eA[i] + (MUS_B.L[i] + hBL[i]) * eB[i]; musR[i] = (MUS_A.R[i] + hAR[i]) * eA[i] + (MUS_B.R[i] + hBR[i]) * eB[i]; }
filtIn(musL, 'hp', 32, 0.7); filtIn(musR, 'hp', 32, 0.7);
// calibrate music: "normal" level -20 LUFS (pre-master) over 13.3-22 s
{ const lu = integWin(kcum(musL, musR), 13.4, 22.1), g = Math.pow(10, (-20 - lu) / 20); for (let i = 0; i < N; i++) { musL[i] *= g; musR[i] *= g; } log(`music calib ${lu.toFixed(1)} LUFS -> -20 (x${g.toFixed(2)})`); }
const folL = new Float32Array(N), folR = new Float32Array(N);
filtIn(SFX.L, 'hp', 28, 0.7); filtIn(SFX.R, 'hp', 28, 0.7);
for (let i = 0; i < N; i++) { folL[i] = SFX.L[i] + AMB.L[i] + hFL[i] + rmL[i]; folR[i] = SFX.R[i] + AMB.R[i] + hFR[i] + rmR[i]; }
const preL = new Float32Array(N), preR = new Float32Array(N);
const endEnv = (t) => (t <= END_FADE0 ? 1 : t >= END_FADE1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (t - END_FADE0) / (END_FADE1 - END_FADE0)));
for (let i = 0; i < N; i++) { const g = endEnv(i / SR); preL[i] = (musL[i] + folL[i]) * g; preR[i] = (musR[i] + folR[i]) * g; }

function truePeak(L, R) {
  const TT = 16, OS = 4, taps = [];
  for (let k = 1; k < OS; k++) {
    const fr = k / OS, h = new Float64Array(2 * TT);
    for (let j = -TT + 1; j <= TT; j++) { const x = j - fr, w = 0.5 + 0.5 * Math.cos(Math.PI * x / TT); h[j + TT - 1] = (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; }
    taps.push(h);
  }
  const tp = new Float32Array(L.length), M = L.length;
  for (let i = 0; i < M; i++) {
    let p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (p > 0.25 && i >= TT && i + TT < M) for (const h of taps) { let a = 0, b = 0; for (let j = 0; j < 2 * TT; j++) { const c = h[j], ix = i - TT + 1 + j; a += L[ix] * c; b += R[ix] * c; } p = Math.max(p, Math.abs(a), Math.abs(b)); }
    tp[i] = p;
  }
  return tp;
}
// look-ahead true-peak limiter (5 ms look-ahead, 80 ms release, smoothed gain)
function limit(inL, inR, gain, ceilDb) {
  const L = new Float32Array(N), R = new Float32Array(N), CEIL = Math.pow(10, ceilDb / 20);
  for (let i = 0; i < N; i++) { L[i] = inL[i] * gain; R[i] = inR[i] * gain; }
  const LA = secs(0.005), rel = 1 - Math.exp(-1 / (0.08 * SR));
  const req = new Float32Array(N), tp = truePeak(L, R);
  for (let i = 0; i < N; i++) { const p = Math.max(tp[i], i > 0 ? tp[i - 1] : 0); req[i] = p > CEIL ? CEIL / p : 1; }
  const h = new Float32Array(N), dq = new Int32Array(N); let qh = 0, qt = 0;
  for (let j = N - 1; j >= 0; j--) { while (qt > qh && req[dq[qt - 1]] >= req[j]) qt--; dq[qt++] = j; while (dq[qh] > j + LA) qh++; h[j] = req[dq[qh]]; }
  const r = new Float32Array(N); let g = 1;
  for (let i = 0; i < N; i++) { g = Math.min(h[i], g + (1 - g) * rel); r[i] = g; }
  let sum = 0, minG = 1; const W = LA + 1, gr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    sum += r[i]; if (i >= W) sum -= r[i - W];
    const gs = i >= W - 1 ? sum / W : Math.min(1, sum / (i + 1));
    L[i] *= gs; R[i] *= gs; gr[i] = gs; if (gs < minG) minG = gs;
  }
  return { L, R, minG, gr };
}
log('limiter...');
const fullInteg = (L, R) => integWin(kcum(L, R), 0, DUR);
let gain = Math.pow(10, (TARGET_LUFS - fullInteg(preL, preR)) / 20), out;
for (let it = 0; it < 5; it++) {
  out = limit(preL, preR, gain, CEIL_DBTP);
  const lu = fullInteg(out.L, out.R);
  if (Math.abs(lu - TARGET_LUFS) < 0.08) break;
  gain *= Math.pow(10, (TARGET_LUFS - lu) / 20);
}
const mL = out.L, mR = out.R;
log('master gain ' + dbf(gain).toFixed(1) + ' dB');
{ const g2 = gain * gain, cM = kcum(musL, musR), cF = kcum(folL, folR), sh = 10 * Math.log10(g2);
  for (const [a, b] of [[0, 5], [5, 9.2], [5, 10.83], [10.83, 17.5], [17.5, 25], [25, 30.5], [30.5, 31.2], [31.2, 33.33], [33.3, 40]]) console.log(`  stems ${a}-${b}: music ${(integWin(cM, a, b) + sh).toFixed(1)} | foley ${(integWin(cF, a, b) + sh).toFixed(1)} (max mom ${(maxMomWin(cF, a, b)[0] + sh).toFixed(1)})`); }
for (let i = secs(END_FADE1); i < N; i++) { mL[i] = 0; mR[i] = 0; }
{ const tp = truePeak(mL, mR); let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, tp[i]); const lim = Math.pow(10, -1.2 / 20); if (pk > lim) { const g = lim / pk; for (let i = 0; i < N; i++) { mL[i] *= g; mR[i] *= g; } } }

function writeWav(file, L, R) {
  const dataLen = N * 4, buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(dataLen, 40);
  const D = rngFor('dither'); let o = 44;
  for (let i = 0; i < N; i++) {
    const dz = L[i] === 0 && R[i] === 0, dl = dz ? 0 : (D() - D()), dr = dz ? 0 : (D() - D());
    buf.writeInt16LE(clamp(Math.round(L[i] * 32767 + dl), -32768, 32767), o); o += 2;
    buf.writeInt16LE(clamp(Math.round(R[i] * 32767 + dr), -32768, 32767), o); o += 2;
  }
  fs.writeFileSync(file, buf);
}
const OUT = path.join(__dirname, 'audio.wav');
writeWav(OUT, mL, mR);
log('wrote ' + OUT);

// ======================================================================= verification (re-read the file)
{
  const buf = fs.readFileSync(OUT);
  const ch = buf.readUInt16LE(22), sr = buf.readUInt32LE(24), bits = buf.readUInt16LE(34), dl = buf.readUInt32LE(40), n = dl / 4;
  const L = new Float32Array(n), R = new Float32Array(n); let pk = 0;
  for (let i = 0; i < n; i++) { L[i] = buf.readInt16LE(44 + i * 4) / 32768; R[i] = buf.readInt16LE(46 + i * 4) / 32768; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
  const tpA = truePeak(L, R); let tp = 0; for (let i = 0; i < n; i++) tp = Math.max(tp, tpA[i]);
  const cs = kcum(L, R);
  let tailZero = true; for (let i = secs(END_FADE1); i < n; i++) if (L[i] !== 0 || R[i] !== 0) { tailZero = false; break; }
  console.log(`\nformat: ${ch} ch, ${sr} Hz, ${bits}-bit, ${n} frames = ${(n / sr).toFixed(4)} s`);
  console.log(`sample peak ${dbf(pk).toFixed(2)} dBFS | true peak ${dbf(tp).toFixed(2)} dBTP | limiter max GR ${(-dbf(out.minG)).toFixed(2)} dB | tail zero ${tailZero}`);
  console.log(`integrated ${integWin(cs, 0, DUR).toFixed(2)} LUFS`);
  for (const [a, b] of [[0, 5], [5, 10.83], [10.83, 17.5], [17.5, 25], [25, 30.5], [30.5, 31.2], [31.2, 33.33], [33.3, 40]]) {
    const [mm, at] = maxMomWin(cs, a, Math.min(DUR, b + 0.0)); console.log(`  ${a.toFixed(2)}-${b.toFixed(2)}: integ ${integWin(cs, a, b).toFixed(1)} LUFS | max momentary ${mm.toFixed(1)} @${at.toFixed(2)}`);
  }
  const [gm, gat] = maxMomWin(cs, 0, DUR); console.log(`global max momentary ${gm.toFixed(1)} LUFS (window starting ${gat.toFixed(2)} s)`);
  // GR hot spots
  const hot = []; for (let s = 0; s < 40; s += 0.5) { let m = 1; for (let i = secs(s); i < Math.min(N, secs(s + 0.5)); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -2 / 20)) hot.push(`${s.toFixed(1)}(${(-dbf(m)).toFixed(1)})`); }
  console.log('limiter GR > 2 dB at: ' + (hot.join(' ') || 'none'));
  console.log(`run time ${((Date.now() - T_START) / 1000).toFixed(1)} s`);
}
