'use strict';
// Hu tieu cho noi Cai Rang - soundtrack. "Cumbia song nuoc + surf twang", 96 BPM, A minor, loop Am-G-F-E.
// Everything synthesised in code: Karplus-Strong surf electric guitar (spring reverb, tremolo picking, whammy), dan sen (cai luong
// scoops / nhan bends), musette accordion, electric finger bass tumbao, guira, timbales, cascara, cowbell, song lang, kitchen foley
// used as percussion (ladle-on-pot cowbell, noodle-basket shaker, garlic guira), river ambience and formant voices.
// Output: audio.wav 48 kHz / stereo / 16-bit / 70.0 s, ~-15 LUFS, TP <= -1.5 dBTP.
const fs = require('fs'), path = require('path');
const T_START = Date.now();
console.time('render');
const SR = 48000, DUR = 70.0, N = Math.round(SR * DUR), TAU = Math.PI * 2;
const BEAT = 0.625, BAR = 2.5, S16 = 0.15625;
const TARGET_LUFS = -15, CEIL_DBTP = -1.65;
const S0 = 51.875, S1 = 52.5, FADE0 = 69.4, FADE1 = 69.95;
const I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);

// ======================================================================= generic helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const rngFor = (name) => mulberry32(hashStr('hutieu:' + name));
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
const secs = (s) => Math.max(1, Math.round(s * SR));
const dbf = (x) => 20 * Math.log10(Math.max(1e-12, x));
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
function scaleTo(x, peak) { let m = 0; for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i])); if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
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
  return fadeEdges(x, 0.0002, Math.min(0.01, dur * 0.3));
}
function modal(modes, dur, att = 0.0004) {
  const n = secs(dur), y = new Float32Array(n);
  for (const [f, a, d] of modes) {
    if (f >= SR * 0.45) continue;
    // recursive sine oscillator with exponential decay
    const w = TAU * f / SR, r = Math.exp(-1 / (d * SR)), c2 = 2 * r * Math.cos(w);
    let s1 = 0, s2 = -r * Math.sin(w) * a; // y[-1] such that y[n]=a r^n sin(wn)
    s1 = 0; s2 = a * Math.sin(-w) / r * r * r; // placeholder overwritten below
    let ym1 = a * Math.sin(-w) / r, ym2 = a * Math.sin(-2 * w) / (r * r);
    for (let i = 0; i < n; i++) { const v = c2 * ym1 - r * r * ym2; y[i] += v; ym2 = ym1; ym1 = v; }
  }
  const na = secs(att); for (let i = 0; i < na; i++) y[i] *= i / na;
  return fadeEdges(y, 0.0001, Math.min(0.02, dur * 0.2));
}
const MEMO = new Map();
function memo(k, fn) { let v = MEMO.get(k); if (!v) { v = fn(); MEMO.set(k, v); } return v; }
const DARK = new WeakMap();
function darkOf(s) { let d = DARK.get(s); if (!d) { d = filt(filt(s, 'lp', 3200, 0.7), 'hp', 250, 0.7); DARK.set(s, d); } return d; }

// ---- wavetables + polyBLEP pulse
const TN = 2048;
function makeTable(amps) {
  const t = new Float32Array(TN + 1);
  for (let h = 0; h < amps.length; h++) { const a = amps[h]; if (!a) continue; for (let i = 0; i < TN; i++) t[i] += a * Math.sin(TAU * (h + 1) * i / TN); }
  let m = 0; for (let i = 0; i < TN; i++) m = Math.max(m, Math.abs(t[i]));
  for (let i = 0; i < TN; i++) t[i] /= m; t[TN] = t[0]; return t;
}
function tabRead(t, ph) { const p = ph * TN, i = p | 0, fr = p - i; return t[i] + (t[i + 1] - t[i]) * fr; }
const SAWT = {};
function sawTab(f) { let H = 64; while (H > 4 && f * H >= 19000) H >>= 1; if (!SAWT[H]) SAWT[H] = makeTable(Array.from({ length: H }, (_, h) => 1 / (h + 1))); return SAWT[H]; }
const TAB_TRI = makeTable(Array.from({ length: 31 }, (_, h) => (h % 2 ? 0 : (h % 4 ? -1 : 1) / ((h + 1) * (h + 1)))));
const TAB_TRI_LO = makeTable(Array.from({ length: 9 }, (_, h) => (h % 2 ? 0 : (h % 4 ? -1 : 1) / ((h + 1) * (h + 1)))));
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
function pulseS(ph, dt, du) { const v = (ph < du ? 1 : -1) + blep(ph, dt) - blep((ph - du + 1) % 1, dt); return v - (2 * du - 1); }

// ---- buses
function mkBus() { return { L: new Float32Array(N), R: new Float32Array(N) }; }
const MH = mkBus(), ML = mkBus(), SFX = mkBus(), FX2 = mkBus(), HALL = mkBus(), ROOM = mkBus();
const AMB_KEYS = [[0, 0], [0.2, 1], [9.8, 1], [10.2, 0.35], [39.8, 0.35], [40.2, 0.6], [45, 0.5], [47.4, 0.45], [49.9, 0.75], [51.8, 0.6], [51.875, 0], [52.6, 0], [53.2, 0.3], [65, 0.3], [69.3, 0.2], [69.95, 0]];
const ambEnv = (t) => pw(AMB_KEYS, t);
// put a mono (pan number or function of local time) or stereo {L,R} signal on a bus with optional reverb sends
function put(b, t0, sig, o = {}) {
  const g = o.gain ?? 1, off = Math.round(t0 * SR), st = !!sig.L, len = st ? sig.L.length : sig.length;
  const pan = o.pan ?? 0, pf = typeof pan === 'function', hall = o.hall || 0, room = o.room || 0, env = o.env;
  let gl = Math.cos((clamp(pf ? 0 : pan, -1, 1) + 1) * Math.PI / 4) * Math.SQRT2, gr = Math.sin((clamp(pf ? 0 : pan, -1, 1) + 1) * Math.PI / 4) * Math.SQRT2;
  const E = 16;
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
    if (hall) { HALL.L[i] += l * hall; HALL.R[i] += r * hall; }
    if (room) { ROOM.L[i] += l * room; ROOM.R[i] += r * room; }
  }
}
const putAmb = (t0, sig, o = {}) => put(FX2, t0, sig, { ...o, env: ambEnv });

function kick() {
  return memo('kick', () => {
    const n = secs(0.42), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (47 + 95 * Math.exp(-t / 0.032) + 60 * Math.exp(-t / 0.005)) / SR; const e = Math.min(1, t / 0.0015) * (t < 0.04 ? 1 : Math.exp(-(t - 0.04) / 0.15)); y[i] = Math.sin(TAU * ph) * e; }
    addInto(y, burst(rngFor('kclick'), 0.006, 'hp', 2500, 0.7, 0.0015), 0, 0.3);
    for (let i = 0; i < n; i++) y[i] = Math.tanh(1.5 * y[i]) / Math.tanh(1.5);
    return fadeEdges(y, 0.0001, 0.03);
  });
}
function snare(v = 0) {
  return memo('sn' + v, () => {
    const R = rngFor('sn' + v), n = secs(0.3);
    const body = modal([[188, 1, 0.09], [335, 0.6, 0.06], [510, 0.35, 0.045]], 0.3);
    const nz = filt(filt(noise(R, n), 'hp', 1800, 0.7), 'lp', 9500, 0.7);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] = Math.tanh(body[i] * 0.8 + nz[i] * 1.0 * Math.exp(-t / 0.11) * Math.min(1, t / 0.0005)); }
    return fadeEdges(y, 0.0001, 0.03);
  });
}
function clap(v = 0) {
  return memo('cl' + v, () => {
    const R = rngFor('cl' + v), n = secs(0.26), nz = filt(noise(R, n), 'bp', 1150, 1.3), y = new Float32Array(n);
    const bt = [0, 0.008, 0.017, 0.026];
    for (let i = 0; i < n; i++) { const t = i / SR; let e = 0; for (let k = 0; k < 4; k++) if (t >= bt[k]) e += Math.exp(-(t - bt[k]) / (k < 3 ? 0.0035 : 0.07)) * (k < 3 ? 1 : 0.9); y[i] = nz[i] * e; }
    return scaleTo(fadeEdges(filt(y, 'hp', 400, 0.7), 0.0002, 0.03), 1);
  });
}
function hat(open = false) {
  return memo('hat' + open, () => {
    const n = secs(open ? 0.36 : 0.08), y = new Float32Array(n), fr = [205.3, 304.4, 369.6, 522.7, 540, 800], ph = fr.map(() => 0);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 6; k++) { const dt = fr[k] * 1.0 / SR; ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1; s += pulseS(ph[k], dt, 0.5); } y[i] = s; }
    const z = filt(filt(y, 'bp', 10000, 1), 'hp', 7000, 0.7);
    for (let i = 0; i < n; i++) z[i] *= Math.exp(-i / SR / (open ? 0.12 : 0.022)) * Math.min(1, i / 24);
    return scaleTo(fadeEdges(z, 0.0002, 0.01), 1);
  });
}
// ======================================================================= foley
function snip(R) {
  const y = new Float32Array(secs(0.09));
  addInto(y, modal([[3300 + R() * 300, 1, 0.006], [5200, 0.7, 0.004], [7600, 0.5, 0.003]], 0.03), 0, 0.6);
  addInto(y, burst(R, 0.02, 'hp', 4000, 0.7, 0.003), 0, 0.6);
  addInto(y, modal([[2800, 1, 0.005], [4700, 0.6, 0.004]], 0.025), secs(0.028), 0.4);
  addInto(y, burst(R, 0.015, 'hp', 3500, 0.7, 0.003), secs(0.028), 0.35);
  return y;
}
function xoet(R, dur = 0.3) {
  const n = secs(dur), x = filt(noise(R, n), 'bp', (t) => 2200 * Math.pow(6000 / 2200, t / dur), 2);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] *= Math.pow(Math.sin(Math.PI * u), 0.6) * (1 - 0.3 * u); }
  const y = new Float32Array(n + secs(0.09)); addInto(y, x, 0, 1); addInto(y, snip(R), n - secs(0.02), 0.8);
  return filtIn(y, 'hp', 1500, 0.7);
}
function crinkle(R, dur, rate = 350, lo = 2000, hi = 8000) {
  const n = secs(dur), y = new Float32Array(n + secs(0.01)), V = [];
  for (let k = 0; k < 10; k++) V.push(burst(R, 0.006, 'bp', lo + (hi - lo) * R(), 1.5, 0.0012));
  let t = 0;
  for (;;) { t += -Math.log(1 - R() * 0.999999) / rate; if (t >= dur) break; const u = t / dur; addInto(y, V[(R() * 10) | 0], Math.round(t * SR), Math.pow(Math.sin(Math.PI * u), 0.5) * (0.3 + 0.7 * R())); }
  return y;
}
function grate(R, dur) {
  const n = secs(dur), x = filt(noise(R, n), 'bp', (t) => 1500 * Math.pow(2, t / dur), 1.4);
  for (let i = 0; i < n; i++) { const t = i / SR, u = i / n; x[i] *= (0.3 + 0.7 * Math.abs(Math.sin(Math.PI * 80 * t))) * Math.pow(Math.sin(Math.PI * u), 0.4); }
  return filtIn(x, 'hp', 800, 0.7);
}
function dryDrop(R) { const y = burst(R, 0.05, 'bp', 900 + R() * 900, 1.2, 0.012); addInto(y, modal([[300 + R() * 150, 1, 0.015]], 0.05), 0, 0.4); return filtIn(y, 'hp', 150, 0.7); }
function bubble(f0, len, rise = 0.9) {
  const n = secs(len), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / len; ph += f0 * (1 + rise * u) / SR; y[i] = Math.sin(TAU * ph) * Math.sin(Math.PI * Math.min(1, u * 3)) * Math.exp(-u * 3); }
  return fadeEdges(y, 0.001, 0.005);
}
function glug(R) {
  const y = new Float32Array(secs(0.36));
  for (let k = 0; k < 3; k++) addInto(y, bubble(260 + R() * 160, 0.08, 0.8), secs(k * 0.085), 0.8 - k * 0.15);
  addInto(y, burst(R, 0.06, 'lp', 500, 0.7, 0.02), 0, 0.3);
  return filtIn(y, 'hp', 120, 0.7);
}
const drip = (R) => bubble(900 + R() * 500, 0.045, 1.2);
function tss(R, open = false) { const d = open ? 0.18 : 0.05; const y = burst(R, d, 'hp', 5500, 0.7, open ? 0.06 : 0.014); addInto(y, crinkle(R, d, 900, 6000, 11000), 0, 0.5); return y; }
function squirt(R) {
  const n = secs(0.22), x = filt(noise(R, n), 'bp', (t) => 1500 * Math.pow(3500 / 1500, t / 0.22), 2.5);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.5 + 0.5 * Math.sin(TAU * 30 * t)) * Math.min(1, t / 0.01) * Math.exp(-t / 0.07); }
  const y = new Float32Array(n + secs(0.05)); addInto(y, x, 0, 1); addInto(y, drip(R), secs(0.12), 0.4);
  return filtIn(y, 'hp', 600, 0.7);
}
function flutterEnv(R, n, fc) { const x = filt(filt(noise(R, n), 'lp', fc, 0.7), 'lp', fc, 0.7); scaleTo(x, 1); for (let i = 0; i < n; i++) x[i] = Math.abs(x[i]); return x; }
function drizzle(R, dur) {
  const n = secs(dur), x = filt(noise(R, n), 'bp', 2600, 2), fl = flutterEnv(R, n, 25);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] *= (0.4 + 0.6 * fl[i]) * Math.pow(Math.sin(Math.PI * u), 0.5); }
  for (let t = 0.05; t < dur - 0.05; t += 0.06 + R() * 0.12) addInto(x, drip(R), Math.round(t * SR), 0.25);
  return filtIn(x, 'hp', 900, 0.7);
}
const tick = (R, f) => modal([[f * (0.9 + 0.2 * R()), 1, 0.006], [f * 2.7, 0.4, 0.004]], 0.03);
const leafRustle = (R, dur) => filtIn(crinkle(R, dur, 220, 1500, 4500), 'hp', 900, 0.7);
function softThud(R) {
  const y = burst(R, 0.14, 'lp', 350, 0.7, 0.03); let ph = 0;
  for (let i = 0; i < y.length; i++) { const t = i / SR; ph += (70 + 50 * Math.exp(-t / 0.02)) / SR; y[i] += Math.sin(TAU * ph) * Math.exp(-t / 0.05) * 0.8; }
  return fadeEdges(filtIn(y, 'hp', 50, 0.7), 0.0005, 0.02);
}
const iceClink = (R, f = 2400) => filtIn(modal([[f, 1, 0.18], [f * 2.32, 0.6, 0.1], [f * 3.36, 0.4, 0.07], [f * 4.25, 0.3, 0.05]], 0.4), 'hp', 800, 0.7);
function bagShake(v) {
  return memo('bag' + v, () => {
    const R = rngFor('bag' + v), d = 0.12, y = crinkle(R, d, 700, 2500, 9000);
    for (let k = 0; k < 16; k++) addInto(y, burst(R, 0.008, 'bp', 3000 + R() * 3500, 2, 0.0015), Math.round(R() * 0.075 * SR), 0.5 + 0.5 * R());
    for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] *= Math.min(1, t / 0.004) * Math.exp(-t / 0.05); }
    return scaleTo(fadeEdges(filtIn(y, 'hp', 1200, 0.7), 0.0005, 0.02), 1);
  });
}
function forkScrape(R, dur) {
  const n = secs(dur), imp = new Float32Array(n);
  let t = 0.01; while (t < dur - 0.01) { imp[Math.round(t * SR)] = 0.6 + 0.4 * R(); t += 1 / (45 + 25 * R()); }
  const y = new Float32Array(n);
  for (const [f, g] of [[1700, 1], [2950, 0.6], [4400, 0.4]]) addInto(y, filt(imp, 'bp', f, 25), 0, g * 6);
  addInto(y, filt(noise(R, n), 'bp', 3000, 1), 0, 0.08);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] *= Math.pow(Math.sin(Math.PI * u), 0.5); }
  return scaleTo(fadeEdges(filtIn(y, 'hp', 900, 0.7), 0.003, 0.02), 1);
}
function plasticThud(R) { const y = softThud(R); const c = crinkle(R, 0.12, 900, 2000, 8000); addInto(y, c, 0, 0.5); return y; }

function heartThump() {
  return memo('heart', () => {
    const y = new Float32Array(secs(0.35));
    const one = (g) => { const n = secs(0.18), z = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (48 + 30 * Math.exp(-t / 0.03)) / SR; z[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.06) * Math.min(1, t / 0.002) * g; } return fadeEdges(z, 0.0005, 0.02); };
    addInto(y, one(1), 0, 1); addInto(y, one(0.6), secs(0.15), 1);
    return y;
  });
}
function uiClick(R) {
  const y = new Float32Array(secs(0.09));
  addInto(y, burst(R, 0.01, 'hp', 3000, 0.7, 0.002), 0, 0.5);
  addInto(y, modal([[4300, 0.6, 0.008], [2100, 0.5, 0.012], [900, 0.4, 0.015]], 0.04), 0, 0.7);
  addInto(y, burst(R, 0.008, 'hp', 3500, 0.7, 0.0015), secs(0.055), 0.3);
  return y;
}
const ting = (f, dur = 0.5) => modal([[f, 1, dur * 0.4], [f * 2.76, 0.4, dur * 0.2], [f * 5.4, 0.2, dur * 0.1]], dur);
function crash(R, dur = 2.2) {
  const n = secs(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = filt(filt(noise(R, n), 'hp', 3200, 0.7), 'lp', 12500, 0.7);
    for (let k = 0; k < 9; k++) { const f = 3000 + R() * 6000, a = 0.06 * R(); let ph = R(); for (let i = 0; i < n; i++) { ph += f / SR; x[i] += a * Math.sin(TAU * ph); } }
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.min(1, t / 0.001) * (0.6 * Math.exp(-t / 0.35) + 0.4 * Math.exp(-t / 1.1)); }
    out[ch] = fadeEdges(x, 0.0002, 0.2);
  }
  return out;
}
function reverseCrash(R, dur) {
  const n = secs(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = filt(filt(noise(R, n), 'hp', 3000, 0.7), 'lp', 11000, 0.7);
    for (let i = 0; i < n; i++) x[i] *= Math.pow(i / n, 1.6);
    out[ch] = fadeEdges(x, 0.01, 0.004);
  }
  return out;
}
function riser(R, dur, f0 = 250, f1 = 7000) {
  const n = secs(dur), x = filt(noise(R, n), 'bp', (t) => f0 * Math.pow(f1 / f0, t / dur), (t) => 1.5 + 2 * t / dur);
  for (let i = 0; i < n; i++) x[i] *= Math.pow(i / n, 2.2);
  return fadeEdges(filtIn(x, 'hp', 200, 0.7), 0.01, 0.01);
}
function whoosh(R, dur, f0, fPeak, f1, peakAt = 0.55, Q = 1.2) {
  const n = secs(dur), fc = (t) => { const u = t / dur; return u < peakAt ? f0 * Math.pow(fPeak / f0, u / peakAt) : fPeak * Math.pow(f1 / fPeak, (u - peakAt) / (1 - peakAt)); };
  const x = filt(noise(R, n), 'bp', fc, Q);
  for (let i = 0; i < n; i++) { const u = i / n; x[i] *= u < peakAt ? Math.pow(u / peakAt, 1.8) : Math.pow(1 - (u - peakAt) / (1 - peakAt), 1.4); }
  return fadeEdges(filtIn(x, 'hp', 150, 0.7), 0.003, 0.01);
}
function bigBoom(R, dur = 1.6, fStart = 92, fEnd = 33, decay = 0.5) {
  const n = secs(dur), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (fEnd + (fStart - fEnd) * Math.exp(-t / 0.12)) / SR; y[i] = Math.sin(TAU * ph) * Math.exp(-t / decay) * Math.min(1, t / 0.003); }
  addInto(y, burst(R, 0.1, 'lp', 1500, 0.7, 0.02), 0, 0.25);
  for (let i = 0; i < n; i++) y[i] = Math.tanh(1.8 * y[i]) / Math.tanh(1.8);
  return fadeEdges(y, 0.0005, 0.1);
}
// ======================================================================= formant voices
const VF = { a: [1050, 1750, 3300], e: [650, 2450, 3400], i: [430, 3050, 3800], o: [650, 1150, 3200], u: [430, 1100, 3100], oo: [400, 900, 3000], ae: [900, 2100, 3300], uh: [800, 1450, 3200] };
function consonant(R, type, d) {
  const n = secs(d); let x = noise(R, n);
  if (type === 's') x = filt(filt(x, 'hp', 4500, 0.7), 'lp', 9000, 0.7);
  else if (type === 'sh') x = filt(filt(x, 'bp', 2600, 1.2), 'lp', 6000, 0.7);
  else if (type === 't') x = filt(x, 'bp', 4000, 1);
  else x = filt(x, 'bp', 1800, 1.2);
  const plos = type === 't' || type === 'k';
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= plos ? Math.exp(-t / 0.012) : Math.min(1, t / 0.02) * Math.min(1, Math.max(0, d - t) / 0.02); }
  return x;
}
function talk(R, segs, o = {}) {
  const total = segs.reduce((s, g) => s + g.d, 0), n = secs(total + 0.06);
  const ex = new Float32Array(n), cons = new Float32Array(n), F = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const first = segs.find((s) => s.v); const cur = (first ? VF[first.v] : VF.uh).slice();
  const sm = 1 - Math.exp(-1 / (0.012 * SR)), vibR = 4.5 + R() * 2, fsc = o.fs || 1, bw = o.bw || 1;
  let i = 0, ph = 0;
  for (const g of segs) {
    const ns = secs(g.d);
    if (g.v) {
      const A = VF[g.v], B = VF[g.v2 || g.v], f0 = g.f0, f1 = g.f1 ?? g.f0, att = g.att ?? 0.02, rel = g.rel ?? 0.04, tab = sawTab(Math.max(f0, f1) * 1.1);
      for (let k = 0; k < ns && i < n; k++, i++) {
        const u = k / ns, t = k / SR;
        for (let j = 0; j < 3; j++) { cur[j] += (A[j] + (B[j] - A[j]) * u - cur[j]) * sm; F[j][i] = cur[j]; }
        const f = (f0 + (f1 - f0) * u) * (1 + 0.012 * Math.sin(TAU * vibR * i / SR));
        ph += f / SR; ph -= Math.floor(ph);
        const e = (g.a ?? 1) * Math.min(1, t / att) * clamp((g.d - t) / rel);
        ex[i] = (tabRead(tab, ph) + (R() * 2 - 1) * (g.br ?? 0.15)) * e;
      }
    } else {
      const i0 = i;
      for (let k = 0; k < ns && i < n; k++, i++) for (let j = 0; j < 3; j++) F[j][i] = cur[j];
      if (g.n) addInto(cons, consonant(R, g.n, g.d), i0, g.na ?? 0.5);
    }
  }
  for (; i < n; i++) for (let j = 0; j < 3; j++) F[j][i] = cur[j];
  const src = filt(ex, 'lp', 3500, 0.7), out = new Float32Array(n), BW = [110, 160, 250], GN = [1, 0.6, 0.3];
  for (let j = 0; j < 3; j++) {
    let k = null, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let s = 0; s < n; s++) {
      if ((s & 31) === 0) { const fj = F[j][s] * fsc; k = coefs('bp', fj, fj / (BW[j] * bw)); }
      const v = src[s], y = k[0] * v + k[1] * x1 + k[2] * x2 - k[3] * y1 - k[4] * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = y; out[s] += y * GN[j] * 3;
    }
  }
  for (let s = 0; s < n; s++) out[s] += cons[s];
  return fadeEdges(out, 0.003, 0.01);
}
function applause(R, dur, rate = 260) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n), V = [];
  for (let k = 0; k < 16; k++) V.push(filtIn(burst(R, 0.04, 'bp', 700 + R() * 1800, 1.2 + R(), 0.006 + R() * 0.008), 'hp', 300, 0.7));
  let t = 0;
  for (;;) {
    t += -Math.log(1 - R() * 0.999999) / rate; if (t >= dur - 0.05) break;
    const e = smooth(t / 0.35) * (1 - smooth((t - (dur - 0.9)) / 0.9)) * (0.4 + 0.6 * R()), p = R() * 2 - 1, v = V[(R() * 16) | 0], o = Math.round(t * SR);
    addInto(L, v, o, e * Math.cos((p + 1) * Math.PI / 4)); addInto(Rr, v, o, e * Math.sin((p + 1) * Math.PI / 4));
  }
  return { L, R: Rr };
}

const ADULT = { fs: 1.0, bw: 1.25 }, LADY = { fs: 1.16, bw: 1.35 };
// ======================================================================= plucked-string core + shared foley (nem nuong engine)
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
function slideWhistle(R, dur, m0, m1) {
  const n = secs(dur), y = new Float32Array(n), br = filt(noise(R, n), 'bp', 3000, 1); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / dur; const m = m0 + (m1 - m0) * (0.6 * u + 0.4 * smooth(u)) + 0.25 * Math.sin(TAU * 6 * t); ph += m2f(m) / SR; ph -= Math.floor(ph); const e = smooth(t / 0.05) * (1 - smooth((t - dur + 0.08) / 0.08)); y[i] = (Math.sin(TAU * ph) + 0.08 * Math.sin(2 * TAU * ph) + br[i] * 0.4) * e; }
  return scaleTo(fadeEdges(y, 0.002, 0.01), 1);
}

// ---- percussion
function shaker(acc, v) {
  return memo(`shk${acc}${v % 4}`, () => {
    const R = rngFor('shk' + acc + (v % 4)), d = acc ? 0.09 : 0.06, n = secs(d), at = acc ? 0.018 : 0.008;
    const x = filt(filt(noise(R, n), 'hp', 4200, 0.7), 'lp', 11000, 0.7);
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= t < at ? t / at : Math.exp(-(t - at) / (acc ? 0.025 : 0.014)); }
    return scaleTo(fadeEdges(x, 0.0005, 0.01), 1);
  });
}
// ---- river / food foley
function waterLap(R, dur) {
  const n = secs(dur), out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const ch of ['L', 'R']) {
    const y = out[ch], bed = filt(filt(noise(R, n), 'lp', 380, 0.6), 'hp', 70, 0.7), mid = filt(noise(R, n), 'bp', 700, 0.9), env = new Float32Array(n);
    let t = R() * 0.8;
    while (t < dur) { const a = 0.5 + 0.5 * R(), at = 0.12 + 0.1 * R(), dc = 0.35 + 0.4 * R(), i0 = Math.round(t * SR), len = secs(at + dc * 3); for (let k = 0; k < len && i0 + k < n; k++) { const u = k / SR; env[i0 + k] += a * (u < at ? Math.sin(Math.PI / 2 * u / at) : Math.exp(-(u - at) / dc)); } t += 0.55 + R() * 1.0; }
    for (let i = 0; i < n; i++) y[i] = bed[i] * (0.3 + 0.3 * env[i]) + mid[i] * 0.6 * env[i];
    for (let tt = R() * 0.5; tt < dur - 0.1; tt += 0.3 + R() * 1.2) addInto(y, bubble(500 + R() * 900, 0.03 + R() * 0.04, 0.6 + R()), Math.round(tt * SR), 0.03 + 0.05 * R());
  }
  return out;
}
function rooster(R, k = 1) {
  const x = talk(R, [
    { d: 0.03, n: 'k', na: 0.4 }, { d: 0.1, v: 'o', f0: 560 * k, f1: 620 * k, a: 0.7, br: 0.35 }, { d: 0.03, n: 'k', na: 0.3 },
    { d: 0.08, v: 'a', f0: 620 * k, f1: 640 * k, a: 0.7, br: 0.35 }, { d: 0.02 }, { d: 0.12, v: 'u', v2: 'oo', f0: 680 * k, f1: 720 * k, a: 0.8, br: 0.35 }, { d: 0.03 },
    { d: 0.62, v: 'oo', v2: 'o', f0: 830 * k, f1: 560 * k, a: 1, br: 0.45, rel: 0.25 },
  ], { fs: 1.4, bw: 1.6 });
  return scaleTo(filtIn(filtIn(x, 'lp', 3600, 0.7), 'hp', 300, 0.7), 1);
}
function birdCall(R) {
  const k = 2 + ((R() * 3) | 0), y = new Float32Array(secs(0.85)), base = 2600 + R() * 1600; let t = 0;
  for (let j = 0; j < k; j++) { const d = 0.05 + R() * 0.05, f0 = base * (0.9 + 0.25 * R()), f1 = f0 * (1.15 + 0.3 * R()), n = secs(d), z = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += (f0 + (f1 - f0) * Math.sin(Math.PI * u)) / SR; z[i] = Math.sin(TAU * ph) * Math.pow(Math.sin(Math.PI * u), 1.5); } addInto(y, z, secs(t), 0.7 + 0.3 * R()); t += d + 0.03 + R() * 0.06; }
  return y;
}
function motorboat(R, dur, rate = 7) {
  const n = secs(dur), y = new Float32Array(n), P = [];
  for (let k = 0; k < 4; k++) { const z = burst(R, 0.07, 'lp', 260 + 80 * k, 0.9, 0.018); scaleTo(z, 1); let ph = 0; for (let i = 0; i < z.length; i++) { const t = i / SR; ph += (62 + 25 * Math.exp(-t / 0.01)) / SR; z[i] = z[i] * 0.6 + Math.sin(TAU * ph) * Math.exp(-t / 0.025) * 0.7; } P.push(z); }
  let t = 0.01, k = 0; while (t < dur - 0.08) { addInto(y, P[k++ % 4], Math.round(t * SR), 0.7 + 0.3 * R()); t += (1 + 0.06 * (R() - 0.5)) / rate; }
  addInto(y, filt(noise(R, n), 'bp', 900, 0.8), 0, 0.12);
  return scaleTo(filtIn(y, 'hp', 45, 0.7), 1);
}
function boatPass(R, dur) {
  const m = motorboat(R, dur, 11), n = m.length, bell = (u) => Math.pow(Math.sin(Math.PI * clamp(u)), 1.5);
  const y = filt(m, 'lp', (t) => 500 + 3000 * bell(t / dur), 0.8);
  for (let i = 0; i < n; i++) y[i] *= 0.2 + 0.8 * bell(i / n);
  addInto(y, scaleTo(whoosh(R, dur, 250, 1600, 350, 0.5, 0.9), 0.6), 0, 1);
  return scaleTo(y, 1);
}
function splash(R, size = 1) {
  const d = 0.25 + 0.6 * size, n = secs(d + 0.35), y = new Float32Array(n);
  const x = scaleTo(filt(noise(R, secs(d)), 'bp', (t) => 1900 - 1000 * t / d, 0.7), 1);
  for (let i = 0; i < x.length; i++) { const t = i / SR; x[i] *= Math.min(1, t / 0.006) * Math.exp(-t / (0.06 + 0.2 * size)); }
  addInto(y, fadeEdges(x, 0.0005, 0.02), 0, 1);
  const pl = new Float32Array(secs(0.15)); let ph = 0; for (let i = 0; i < pl.length; i++) { const t = i / SR; ph += (70 + 110 * Math.exp(-t / 0.03)) / SR; pl[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.05); }
  addInto(y, fadeEdges(pl, 0.0005, 0.02), 0, 0.5 + 0.3 * size);
  for (let k = 0; k < 4 + 8 * size; k++) addInto(y, bubble(700 + R() * 1200, 0.03 + 0.03 * R(), 0.8), Math.round((0.05 + R() * d) * SR), 0.15 + 0.15 * R());
  return scaleTo(filtIn(y, 'hp', 55, 0.7), 1);
}
function sizzle(R, dur) {
  const n = secs(dur), x = filt(filt(noise(R, n), 'hp', 3500, 0.7), 'lp', 11000, 0.7), fl = flutterEnv(R, n, 18);
  scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.3 + 0.7 * fl[i]) * smooth(t / 0.25) * (1 - smooth((t - (dur - 0.5)) / 0.5)) * 0.6; }
  const c = crinkle(R, dur, 70, 1500, 6000); scaleTo(c, 0.8); addInto(x, c, 0, 1);
  return x;
}
function flare(R, dur = 1.2) {
  const n = secs(dur), fc = (t) => (t < 0.1 ? 300 * Math.pow(10, t / 0.1) : 3000 * Math.pow(0.35, (t - 0.1) / (dur - 0.1)));
  const x = scaleTo(filt(noise(R, n), 'bp', fc, 0.55), 1), lo = scaleTo(filt(noise(R, n), 'lp', 180, 0.7), 1);
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / 0.06) * Math.exp(-Math.max(0, t - 0.06) / 0.35); x[i] = (x[i] + lo[i] * 0.8) * e; }
  addInto(x, sizzle(R, dur), 0, 0.5);
  return scaleTo(fadeEdges(x, 0.002, 0.05), 1);
}
const fanSwish = (R) => scaleTo(whoosh(R, 0.3, 400, 1400, 600, 0.45, 0.8), 1);
function sniff(R) {
  const y = new Float32Array(secs(0.55));
  const one = (d, f0, f1, a) => { const n = secs(d), x = filt(noise(R, n), 'bp', (t) => f0 + (f1 - f0) * t / d, 2.2); for (let i = 0; i < n; i++) x[i] *= Math.pow(Math.sin(Math.PI * i / n), 0.7) * a; return x; };
  addInto(y, one(0.1, 1600, 2400, 0.8), 0, 1); addInto(y, one(0.24, 1800, 3000, 1), secs(0.16), 1);
  return scaleTo(filtIn(y, 'hp', 700, 0.7), 1);
}
function woodThunk(R, f = 170) {
  const y = modal([[f, 1, 0.09], [f * 2.31, 0.6, 0.05], [f * 4.1, 0.35, 0.03], [f * 6.7, 0.2, 0.015]], 0.35);
  addInto(y, burst(R, 0.04, 'lp', 900, 0.7, 0.01), 0, 0.4);
  return scaleTo(y, 1);
}
function herbTuk(R) { const y = new Float32Array(secs(0.14)); addInto(y, modal([[240 + R() * 40, 1, 0.025], [610, 0.4, 0.012]], 0.1), 0, 0.9); addInto(y, burst(R, 0.02, 'lp', 1800, 0.7, 0.005), 0, 0.5); addInto(y, scaleTo(leafRustle(R, 0.1), 0.5), secs(0.005), 1); return scaleTo(filtIn(y, 'hp', 90, 0.7), 1); }
function crack(R) {
  const y = new Float32Array(secs(0.4));
  addInto(y, scaleTo(burst(R, 0.03, 'hp', 2000, 0.7, 0.006), 1), 0, 1);
  addInto(y, modal([[2300, 1, 0.012], [3700, 0.7, 0.008], [5200, 0.5, 0.006], [1200, 0.6, 0.02]], 0.06), 0, 0.5);
  addInto(y, scaleTo(crinkle(R, 0.32, 900, 1500, 7000), 0.7), secs(0.012), 1);
  return scaleTo(y, 1);
}
function crunch(R, dur = 0.3, lo = 900) {
  const y = scaleTo(crinkle(R, dur, 1300, lo, 6000), 0.8);
  addInto(y, scaleTo(burst(R, 0.06, 'bp', 500, 0.8, 0.02), 0.8), 0, 1);
  addInto(y, scaleTo(burst(R, 0.02, 'hp', 2500, 0.7, 0.005), 0.7), 0, 1);
  return scaleTo(y, 1);
}
function steamHiss(R, dur) { const n = secs(dur), x = filt(filt(noise(R, n), 'hp', 2500, 0.7), 'bp', 5500, 0.5); for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= smooth(t / 0.15) * (1 - smooth((t - dur * 0.45) / (dur * 0.55))); } return scaleTo(x, 1); }
function squeak(R, f = 1400) { const d = 0.07 + R() * 0.04, n = secs(d), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += f * (1 + 0.3 * u + 0.04 * Math.sin(TAU * 55 * i / SR)) / SR; y[i] = (Math.sin(TAU * ph) + 0.35 * Math.sin(2 * TAU * ph)) * Math.pow(Math.sin(Math.PI * u), 0.8); } return scaleTo(fadeEdges(y, 0.002, 0.005), 1); }
function pat(R) { const y = scaleTo(softThud(R), 0.8); addInto(y, scaleTo(crinkle(R, 0.06, 500, 1500, 5000), 0.4), 0, 1); return scaleTo(y, 1); }
function peanutRattle(R) { const y = new Float32Array(secs(0.85)); for (let k = 0; k < 18; k++) { const t = R() * 0.6; addInto(y, dryDrop(R), secs(t), (0.5 + 0.5 * R()) * (1 - t)); } addInto(y, scaleTo(crinkle(R, 0.5, 300, 1200, 5000), 0.3), 0, 1); return scaleTo(y, 1); }
function knifeCrunch(R) { const y = crunch(R, 0.28, 700); addInto(y, tick(R, 4200), 0, 0.5); return scaleTo(y, 1); }
function handOver(R) { const y = new Float32Array(secs(0.65)); addInto(y, scaleTo(whoosh(R, 0.45, 300, 1500, 500), 0.7), 0, 1); addInto(y, scaleTo(softThud(R), 0.8), secs(0.42), 1); return scaleTo(y, 1); }
function boing() {
  return memo('boing', () => {
    const n = secs(0.6), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, f = 150 * (1 + 0.5 * Math.exp(-t / 0.04)) * (1 + 0.22 * Math.sin(TAU * 13 * t) * Math.exp(-t / 0.25)); ph += f / SR; ph -= Math.floor(ph); y[i] = (tabRead(TAB_TRI, ph) * 0.8 + Math.sin(TAU * ph * 2) * 0.2) * Math.exp(-t / 0.22) * Math.min(1, t / 0.003); }
    return scaleTo(fadeEdges(y, 0.0005, 0.03), 1);
  });
}
function creak(R, dur, f0 = 500) {
  const n = secs(dur), imp = new Float32Array(n); let t = 0.02;
  while (t < dur - 0.02) { const u = t / dur; imp[Math.round(t * SR)] = 0.5 + 0.5 * R(); t += 1 / (35 + 60 * Math.sin(Math.PI * u) + 10 * R()); }
  const y = filt(imp, 'bp', f0, 12); addInto(y, filt(imp, 'bp', f0 * 1.63, 10), 0, 0.6); addInto(y, filt(imp, 'bp', f0 * 2.4, 8), 0, 0.35);
  for (let i = 0; i < n; i++) y[i] *= Math.pow(Math.sin(Math.PI * i / n), 0.5);
  return scaleTo(fadeEdges(y, 0.005, 0.02), 1);
}
function bambooRattle(R, dur, rate = 14) {
  const y = new Float32Array(secs(dur + 0.15)); let t = 0.01;
  while (t < dur) { const f = 650 + R() * 550; addInto(y, modal([[f, 1, 0.035], [f * 2.6, 0.4, 0.018], [f * 4.3, 0.15, 0.01]], 0.1), secs(t), (0.5 + 0.5 * R()) * Math.pow(Math.sin(Math.PI * t / dur), 0.4)); t += (0.5 + R()) / rate; }
  return scaleTo(y, 1);
}
function sparkleAt(t0, R, g, notes = [91, 95, 98, 100, 103]) { for (let k = 0; k < notes.length; k++) put(MH, t0 + k * 0.07 + R() * 0.02, ting(m2f(notes[k]), 0.9), { gain: g * (1 - k * 0.1), pan: (k % 2 ? 0.45 : -0.45) * (0.5 + 0.5 * R()), hall: 0.35 }); }

// several voices in near-unison -> stereo
function crowdSay(R, segFn, voices) {
  const n = secs(1.0), L = new Float32Array(n), Rr = new Float32Array(n);
  for (const [f, vo, p, dt] of voices) { const x = scaleTo(talk(R, segFn(f), vo), 1); addInto(L, x, secs(dt), Math.cos((p + 1) * Math.PI / 4)); addInto(Rr, x, secs(dt), Math.sin((p + 1) * Math.PI / 4)); }
  let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(Rr[i])); for (let i = 0; i < n; i++) { L[i] /= m; Rr[i] /= m; }
  return { L, R: Rr };
}

// ======================================================================= cumbia song nuoc + surf twang instruments
const SURF = mkBus(), SEN = mkBus(), ACC = mkBus(), SPRING = mkBus();
const E8 = BAR / 8;
const ROOT = { Am: 45, G: 43, F: 41, E: 40 }, FIFTH = { Am: 40, G: 38, F: 36, E: 47 };
const ACCV = { Am: [57, 60, 64], G: [55, 59, 62], F: [57, 60, 65], E: [56, 59, 64] };
const CHT = [[0, 'Am'], [5, 'F'], [7.5, 'E']];
{ const LP = ['Am', 'G', 'F', 'E']; for (let k = 0; k < 16; k++) CHT.push([10 + 2.5 * k, LP[k % 4]]); }
CHT.push([50, '-'], [52.5, 'Am'], [55, 'G'], [57.5, 'F'], [58.75, 'E'], [60, 'Am'], [62.5, 'F'], [63.75, 'E'], [65, 'Am'], [66.25, 'F'], [67.5, 'E'], [68.75, 'Am']);
function chordAt(t) { let c = CHT[0][1]; for (const [s, nm] of CHT) { if (t >= s - 1e-6) c = nm; else break; } return c; }

// surf electric guitar: bright KS near the bridge, overdriven; bend(t) in semitones
function surf(m, len, o = {}) {
  const L = q05(len);
  return memo(`sf${m}|${L}|${o.k || ''}`, () => {
    const bend = o.bend, vib = o.vib || 0;
    const f = bend || vib ? (t) => m2f(m + (bend ? bend(t) : 0) + vib * Math.sin(TAU * 5.6 * t) * smooth((t - 0.2) / 0.3)) : m2f(m);
    const y = ks(f, L + 0.25, { t60: 3, s: 0.35, bright: 0.92, pos: 0.12, seed: m * 11 + 3 });
    choke(y, L, 0.06); for (let i = 0; i < 16; i++) y[i] *= i / 16;
    scaleTo(y, 1); for (let i = 0; i < y.length; i++) y[i] = Math.tanh(2.2 * y[i]) / Math.tanh(2.2);
    return fadeEdges(y, 0.0003, 0.02);
  });
}
// tremolo picking: re-pluck every 78 ms (alternate down/up strokes), optional whammy bend / crescendo
function surfTrem(m, dur, o = {}) {
  const D = q05(dur);
  return memo(`st${m}|${D}|${o.k || ''}`, () => {
    const P = 0.078, n = secs(D + 0.45), y = new Float32Array(n), bend = o.bend;
    let j = 0;
    for (let t = 0; t < D - 0.01; t += P, j++) {
      const last = t + P >= D - 0.01, len = last ? 0.4 : P + 0.02, t0 = t;
      const f = bend ? (tt) => m2f(m + bend(t0 + tt)) : m2f(m);
      const p = ks(f, len + 0.03, { t60: 2.6, s: 0.35, bright: j % 2 ? 0.7 : 0.92, pos: j % 2 ? 0.16 : 0.11, seed: (j % 6) + m * 5 });
      if (!last) choke(p, P, 0.01);
      addInto(y, fadeEdges(p, 0.0002, 0.006), secs(t), (j % 2 ? 0.7 : 1) * (o.cres ? o.cres(t / D) : 1));
    }
    scaleTo(y, 1); for (let i = 0; i < n; i++) y[i] = Math.tanh(2.2 * y[i]) / Math.tanh(2.2);
    return fadeEdges(y, 0.0003, 0.03);
  });
}
// pick slide "piu": scraped string, band-pass noise sweeping 4200 -> 400 Hz with winding rasp
function pickSlide(R, dur = 0.42) {
  const n = secs(dur), x = filt(noise(R, n), 'bp', (t) => 4200 * Math.pow(400 / 4200, t / dur), 5);
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / dur; x[i] *= (Math.sin(TAU * 95 * t) > 0 ? 1 : 0.35) * smooth(t / 0.015) * Math.pow(1 - u, 1.1); }
  return scaleTo(fadeEdges(x, 0.001, 0.01), 1);
}
// spring "drip": train of dispersive chirps ~37 ms apart
function springDrip() {
  return memo('sdrip', () => {
    const y = new Float32Array(secs(0.4));
    for (let k = 0; k < 8; k++) {
      const nn = secs(0.028), z = new Float32Array(nn); let ph = 0;
      for (let i = 0; i < nn; i++) { const u = i / nn; ph += 3400 * Math.pow(450 / 3400, u) / SR; z[i] = Math.sin(TAU * ph) * Math.sin(Math.PI * u); }
      addInto(y, z, secs(k * 0.037), Math.pow(0.68, k));
    }
    return scaleTo(y, 1);
  });
}
// spring tank: 40 first-order allpasses (dispersion) inside a damped feedback delay
function springVerb(x, D, fb) {
  const inp = filt(x, 'hp', 150, 0.7), y = new Float32Array(N), dl = new Float32Array(D), M = 40, a = 0.6, x1 = new Float64Array(M), y1 = new Float64Array(M);
  let di = 0, lp = 0;
  for (let i = 0; i < N; i++) {
    let s = inp[i] + fb * lp;
    for (let k = 0; k < M; k++) { const o = -a * s + x1[k] + a * y1[k]; x1[k] = s; y1[k] = o; s = o; }
    const d = dl[di]; dl[di] = s; di = di + 1 === D ? 0 : di + 1;
    lp += (d - lp) * 0.5; y[i] = d;
  }
  filtIn(y, 'lp', 4000, 0.7); filtIn(y, 'hp', 150, 0.7);
  return y;
}
// dan sen (cai luong): bright pluck, scoop from (m - sl), "nhan" press-bend up bd semitones and back, 6 Hz vibrato
function sen(m, len, sl = 0, bd = 0) {
  const L = q05(len);
  return memo(`se${m}|${L}|${sl}|${bd}`, () => {
    const pk = Math.min(0.32, L * 0.45);
    const f = (t) => m2f(m - sl * (1 - smooth((t - 0.012) / 0.1)) + bd * smooth((t - pk) / 0.07) * (1 - smooth((t - pk - 0.12) / 0.09)) + 0.28 * Math.sin(TAU * 6 * t) * smooth((t - 0.18) / 0.25));
    const y = ks(f, L + 0.35, { t60: 1.4, s: 0.3, bright: 0.85, pos: 0.08, seed: m * 3 + sl * 17 + bd });
    choke(y, L, 0.08); for (let i = 0; i < 20; i++) y[i] *= i / 20;
    return scaleTo(fadeEdges(y, 0.0003, 0.02), 1);
  });
}
// accordion: 3 detuned saw reeds per note (musette = wide beating), bellows swell, reed formants
function acc(notes, len, o = {}) {
  const L = q05(len), att = o.att ?? 0.016;
  return memo(`ac${notes.join(',')}|${L}|${o.mu ? 1 : 0}|${att}`, () => {
    const n = secs(L + 0.08), y = new Float32Array(n), det = o.mu ? [0, 15, -5] : [0, 7, -7], R = rngFor('acc' + notes.join(','));
    for (const m of notes) for (const c of det) {
      const f = m2f(m) * Math.pow(2, c / 1200), tab = sawTab(f); let ph = R();
      for (let i = 0; i < n; i++) { ph += f / SR; ph -= Math.floor(ph); y[i] += tabRead(tab, ph); }
    }
    for (let i = 0; i < n; i++) { const t = i / SR; let e = Math.min(1, t / att) * (0.93 + 0.07 * Math.sin(TAU * 3.2 * t)); if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / 0.07)); y[i] *= e; }
    const out = filt(y, 'bp', 1200, 0.8); addInto(out, filt(y, 'bp', 2600, 1.6), 0, 0.5); addInto(out, filt(y, 'lp', 700, 0.7), 0, 0.35); filtIn(out, 'lp', 5500, 0.7);
    return scaleTo(fadeEdges(out, 0.0008, 0.01), 1);
  });
}
// electric finger bass (brighter + grittier than the nem nuong upright)
function ebass(m, len) {
  const L = q05(len);
  return memo(`eb${m}|${L}`, () => {
    const f = m2f(m), rel = 0.06, n = secs(L + rel), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += f * (1 + 0.008 * Math.exp(-t / 0.02)) / SR; ph -= Math.floor(ph);
      const p = TAU * ph, br = Math.exp(-t / 0.12);
      let e = Math.min(1, t / 0.004) * (0.6 + 0.4 * Math.exp(-t / 0.15)) * Math.exp(-t / 1.6);
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (Math.sin(p) + 0.5 * Math.sin(2 * p) + 0.35 * (0.4 + 0.6 * br) * Math.sin(3 * p) + 0.2 * br * Math.sin(4 * p) + 0.08 * br * Math.sin(5 * p)) * e;
    }
    for (let i = 0; i < n; i++) y[i] = Math.tanh(1.8 * y[i]) / Math.tanh(1.8);
    addInto(y, burst(rngFor('ebk' + m), 0.014, 'bp', 1800, 1.1, 0.004), 0, 0.12);
    return fadeEdges(y, 0.0005, 0.01);
  });
}
// ---- latin percussion
function timbale(hi, v = 0) {
  return memo(`tb${hi}${v % 3}`, () => {
    const R = rngFor('tb' + hi + (v % 3)), f = (hi ? 540 : 380) * (1 + 0.01 * (v % 3));
    const y = modal([[f, 1, 0.16], [f * 1.51, 0.55, 0.1], [f * 2.03, 0.35, 0.07], [f * 2.74, 0.22, 0.045], [f * 3.6, 0.12, 0.03]], 0.5);
    addInto(y, burst(R, 0.03, 'bp', 3200, 0.8, 0.006), 0, 0.55);
    addInto(y, burst(R, 0.012, 'hp', 5000, 0.7, 0.002), 0, 0.3);
    for (let i = 0; i < y.length; i++) y[i] = Math.tanh(1.3 * y[i]);
    return scaleTo(fadeEdges(y, 0.0001, 0.03), 1);
  });
}
function cascara(v = 0) {
  return memo('cs' + (v % 3), () => { const R = rngFor('cs' + (v % 3)); const y = modal([[1900 * (1 + 0.015 * (v % 3)), 1, 0.022], [3150, 0.5, 0.012], [4700, 0.3, 0.008]], 0.08); addInto(y, burst(R, 0.006, 'hp', 4000, 0.7, 0.0015), 0, 0.5); return scaleTo(fadeEdges(y, 0.0001, 0.01), 1); });
}
function cowbell(v = 0) {
  return memo('cb' + (v ? 1 : 0), () => {
    const n = secs(0.32), y = new Float32Array(n), fr = [587, 845], ph = [0, 0.3];
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 2; k++) { const dt = fr[k] / SR; ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1; s += pulseS(ph[k], dt, 0.5); } const t = i / SR; y[i] = s * Math.min(1, t / 0.0008) * (0.7 * Math.exp(-t / 0.035) + 0.3 * Math.exp(-t / 0.16)); }
    const z = filt(y, 'bp', 870, 2.2); addInto(z, filt(y, 'bp', 2650, 3), 0, 0.35);
    return scaleTo(fadeEdges(z, 0.0001, 0.02), v ? 0.85 : 1);
  });
}
// guira: metal scraper = high-passed noise gated by a 150 Hz ridge saw
function guira(long, v = 0) {
  return memo(`gu${long}${v % 4}`, () => {
    const R = rngFor('gu' + long + (v % 4)), d = long ? 0.2 : 0.055, n = secs(d), x = filt(filt(noise(R, n), 'hp', 3400, 0.7), 'lp', 11500, 0.7);
    const rate = 150 * (0.95 + 0.1 * R()); let ph = R();
    for (let i = 0; i < n; i++) { const t = i / SR; ph += rate / SR; ph -= Math.floor(ph); const ridge = 0.35 + 0.65 * Math.pow(1 - ph, 3); const e = long ? smooth(t / 0.05) * Math.pow(1 - t / d, 1.2) : Math.min(1, t / 0.004) * Math.exp(-t / 0.018); x[i] *= ridge * e; }
    return scaleTo(fadeEdges(x, 0.0005, 0.008), 1);
  });
}
function songLang() {
  return memo('lang', () => { const y = modal([[1250, 1, 0.03], [2900, 0.5, 0.015], [700, 0.4, 0.04]], 0.14); addInto(y, burst(rngFor('lang'), 0.005, 'hp', 3000, 0.7, 0.001), 0, 0.4); return scaleTo(fadeEdges(y, 0.0001, 0.01), 1); });
}
// ladle on the broth pot (used as cowbell in 20-30)
function potHit(v = 0) {
  return memo('pot' + (v % 3), () => { const k = 1 + 0.012 * (v % 3); const y = modal([[780 * k, 1, 0.25], [1830 * k, 0.6, 0.15], [2950 * k, 0.5, 0.1], [4100 * k, 0.3, 0.06]], 0.6); addInto(y, burst(rngFor('pot' + (v % 3)), 0.006, 'hp', 3000, 0.7, 0.0015), 0, 0.3); return scaleTo(fadeEdges(y, 0.0001, 0.05), 1); });
}
// ---- hu tieu foley
function lidClank(R) { const y = new Float32Array(secs(0.7)); const hit = (k) => modal([[880 * k, 1, 0.22], [2210 * k, 0.6, 0.13], [3650 * k, 0.4, 0.08], [5200 * k, 0.2, 0.05]], 0.5); addInto(y, hit(1), 0, 1); addInto(y, hit(1.01), secs(0.065), 0.45); addInto(y, hit(0.99), secs(0.12), 0.25); addInto(y, burst(R, 0.01, 'hp', 3000, 0.7, 0.002), 0, 0.4); return scaleTo(y, 1); }
function brothPour(R, dur) { const n = secs(dur), x = filt(filt(noise(R, n), 'bp', 650, 0.7), 'lp', 2400, 0.7), fl = flutterEnv(R, n, 9); scaleTo(x, 1); for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.35 + 0.65 * fl[i]) * smooth(t / 0.08) * (1 - smooth((t - dur + 0.3) / 0.3)); } for (let t = 0.05; t < dur - 0.2; t += 0.09 + R() * 0.12) addInto(x, bubble(300 + R() * 500, 0.05 + R() * 0.05, 0.8), secs(t), 0.25 + 0.2 * R()); return scaleTo(x, 1); }
function potBubbles(R, dur, rate = 26) { const y = new Float32Array(secs(dur + 0.1)); for (let t = R() * 0.05; t < dur; t += -Math.log(1 - R() * 0.999) / rate) addInto(y, bubble(220 + R() * 520, 0.04 + R() * 0.06, 0.5 + R()), secs(t), 0.4 + 0.6 * R()); addInto(y, scaleTo(filt(noise(R, y.length), 'lp', 500, 0.7), 0.15), 0, 1); return scaleTo(y, 1); }
function basketShake(R) { const y = scaleTo(bambooRattle(R, 0.22, 45), 0.8); addInto(y, scaleTo(crinkle(R, 0.22, 500, 2500, 9000), 0.6), 0, 1); return scaleTo(y, 1); }
function garlicRain(R, dur) { const y = new Float32Array(secs(dur + 0.1)); for (let t = 0; t < dur; t += 0.012 + R() * 0.03) addInto(y, dryDrop(R), secs(t), 0.3 + 0.5 * R()); addInto(y, scaleTo(crinkle(R, dur, 600, 3000, 9000), 0.5), 0, 1); return scaleTo(y, 1); }
function smallSlurp(R, dur, f0 = 1200, f1 = 3200) { const n = secs(dur), x = filt(noise(R, n), 'bp', (t) => f0 * Math.pow(f1 / f0, t / dur), 3.5); for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.5 + 0.5 * Math.abs(Math.sin(TAU * 14 * t))) * smooth(t / 0.02) * (1 - smooth((t - dur + 0.05) / 0.05)); } return scaleTo(fadeEdges(x, 0.001, 0.005), 1); }
function bigSlurp(R) {
  const d0 = 1.5, n = secs(1.85), y = new Float32Array(n), nn = secs(d0);
  const fc = (t) => 400 * Math.pow(4500 / 400, Math.min(1, t / d0));
  const a = filt(noise(R, nn), 'bp', fc, 3.2), b = filt(noise(R, nn), 'bp', (t) => fc(t) * 0.55, 1.4);
  for (let i = 0; i < nn; i++) { const t = i / SR; const fl = 0.4 + 0.6 * Math.abs(Math.sin(TAU * 11 * t + 2.5 * Math.sin(TAU * 2.7 * t))); const e = smooth(t / 0.05) * (1 - smooth((t - d0 + 0.12) / 0.12)); y[i] = (a[i] + 0.6 * b[i]) * fl * e; }
  scaleTo(y, 1);
  for (let k = 0; k < 26; k++) addInto(y, bubble(300 + R() * 1400, 0.03 + R() * 0.05, 1 + R()), secs(R() * 1.4), 0.15 + 0.2 * R());
  addInto(y, scaleTo(slideWhistle(R, 1.3, 70, 96), 0.32), secs(0.15), 1);
  const pop = modal([[620, 1, 0.025], [1500, 0.5, 0.012]], 0.12); addInto(pop, burst(R, 0.01, 'bp', 2200, 1, 0.003), 0, 0.6);
  addInto(y, scaleTo(pop, 0.9), secs(1.55), 1);
  return scaleTo(y, 1);
}
function inhale(R, dur = 0.9) { const n = secs(dur), x = filt(filt(noise(R, n), 'bp', (t) => 700 + 1300 * t / dur, 1.6), 'hp', 400, 0.7); for (let i = 0; i < n; i++) { const u = i / n; x[i] *= Math.pow(u, 1.2) * (1 - smooth((u - 0.92) / 0.08)); } return scaleTo(fadeEdges(x, 0.01, 0.01), 1); }
function bloop(f) { return memo('bl' + f, () => { const n = secs(0.35), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += f * (1 + 1.6 * smooth(t / 0.09)) / SR; y[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.004) * Math.exp(-t / 0.08); } addInto(y, ting(f * 2.6, 0.3), secs(0.05), 0.15); return scaleTo(fadeEdges(y, 0.0005, 0.02), 1); }); }
function wings(R, flaps = 8, rate = 4.5) { const y = new Float32Array(secs(flaps / rate + 0.4)); for (let k = 0; k < flaps; k++) addInto(y, whoosh(R, 0.2, 180, 900 + R() * 300, 250, 0.4, 0.9), secs(k / rate), Math.pow(0.85, k)); return scaleTo(y, 1); }
function squawk(R) { const x = talk(R, [{ d: 0.035, n: 'k', na: 0.4 }, { d: 0.32, v: 'a', v2: 'uh', f0: 640, f1: 470, a: 1, br: 0.6, rel: 0.12 }], { fs: 1.35, bw: 1.9 }); return scaleTo(filtIn(filtIn(x, 'hp', 350, 0.7), 'lp', 4200, 0.7), 1); }
function chatSlap(R) { const y = new Float32Array(secs(0.3)); addInto(y, clap(3), 0, 0.8); addInto(y, modal([[1750, 1, 0.025], [3300, 0.6, 0.012], [900, 0.5, 0.03]], 0.12), 0, 0.6); addInto(y, burst(R, 0.04, 'bp', 2600, 0.9, 0.01), 0, 0.6); return scaleTo(y, 1); }
// ---- voices (formant)
const voc = (R, segs, who) => scaleTo(talk(R, segs, who), 1);
const vHuTieuDay = (R) => voc(R, [{ d: 0.05, n: 'h', na: 0.35 }, { d: 0.16, v: 'u', f0: 300, f1: 270, a: 0.9, att: 0.02, rel: 0.03 }, { d: 0.03, n: 't', na: 0.3 }, { d: 0.2, v: 'i', v2: 'e', f0: 330, f1: 390, a: 1, rel: 0.02 }, { d: 0.06, v: 'oo', f0: 390, f1: 380, a: 0.8, rel: 0.03 }, { d: 0.03 }, { d: 0.02, n: 't', na: 0.2 }, { d: 0.75, v: 'uh', v2: 'i', f0: 410, f1: 330, a: 1, rel: 0.25 }], LADY);
const vHongCon = (R) => voc(R, [{ d: 0.04, n: 'h', na: 0.3 }, { d: 0.12, v: 'u', f0: 290, f1: 265, a: 0.9, rel: 0.02 }, { d: 0.025, n: 't', na: 0.25 }, { d: 0.16, v: 'i', v2: 'e', f0: 300, f1: 350, a: 1, rel: 0.02 }, { d: 0.05, v: 'oo', f0: 350, a: 0.7, rel: 0.02 }, { d: 0.04 }, { d: 0.04, n: 'h', na: 0.3 }, { d: 0.16, v: 'o', v2: 'oo', f0: 300, f1: 290, a: 1, rel: 0.03 }, { d: 0.03 }, { d: 0.025, n: 'k', na: 0.3 }, { d: 0.3, v: 'o', v2: 'uh', f0: 300, f1: 400, a: 1, rel: 0.1 }], LADY);
const vLaugh = (R) => voc(R, [380, 360, 345, 325].flatMap((f) => [{ d: 0.04, n: 'h', na: 0.35 }, { d: 0.11, v: 'a', f0: f, f1: f * 0.95, a: 1, att: 0.01, rel: 0.04 }, { d: 0.05 }]), LADY);
const vPhaiHup = (R) => voc(R, [{ d: 0.06, n: 'f', na: 0.3 }, { d: 0.17, v: 'a', v2: 'i', f0: 280, f1: 250, a: 1, rel: 0.02 }, { d: 0.04 }, { d: 0.04, n: 'h', na: 0.35 }, { d: 0.13, v: 'u', f0: 330, f1: 360, a: 1, rel: 0.01 }, { d: 0.06 }, { d: 0.04, v: 'u', f0: 240, a: 0.5, att: 0.005 }, { d: 0.16, v: 'oo', v2: 'i', f0: 250, f1: 300, a: 1, rel: 0.02 }, { d: 0.05, v: 'u', f0: 300, a: 0.5 }, { d: 0.32, v: 'o', v2: 'u', f0: 320, f1: 295, a: 1, rel: 0.12 }], LADY);
const vHoldMy = (R) => voc(R, [{ d: 0.05, n: 'h', na: 0.3 }, { d: 0.18, v: 'o', v2: 'oo', f0: 170, f1: 185, a: 1, rel: 0.02 }, { d: 0.03, v: 'u', f0: 180, a: 0.5, rel: 0.01 }, { d: 0.03 }, { d: 0.03, v: 'u', f0: 175, a: 0.5, att: 0.005 }, { d: 0.15, v: 'a', v2: 'i', f0: 190, f1: 175, a: 1, rel: 0.02 }, { d: 0.03 }, { d: 0.02, v: 'u', f0: 190, a: 0.4, att: 0.003 }, { d: 0.15, v: 'ae', f0: 200, f1: 205, a: 1, rel: 0.01 }, { d: 0.035, n: 'k', na: 0.4 }, { d: 0.03 }, { d: 0.025, n: 't', na: 0.3 }, { d: 0.17, v: 'ae', f0: 215, f1: 170, a: 1, rel: 0.03 }, { d: 0.04, n: 'k', na: 0.45 }], ADULT);
const vThemTo = (R) => voc(R, [{ d: 0.03, n: 't', na: 0.35 }, { d: 0.14, v: 'e', f0: 210, f1: 220, a: 1, rel: 0.01 }, { d: 0.06, v: 'u', f0: 215, a: 0.6, rel: 0.02 }, { d: 0.03 }, { d: 0.025, n: 't', na: 0.35 }, { d: 0.18, v: 'o', f0: 225, f1: 230, a: 1, rel: 0.02 }, { d: 0.03 }, { d: 0.04, v: 'u', f0: 230, a: 0.5, att: 0.005 }, { d: 0.3, v: 'uh', v2: 'a', f0: 255, f1: 210, a: 1, rel: 0.1 }], ADULT);
const segSup = (f) => [{ d: 0.06, n: 's', na: 0.45 }, { d: 0.13, v: 'u', f0: f, f1: f * 0.85, a: 1, att: 0.008, rel: 0.015 }, { d: 0.03, n: 't', na: 0.12 }];
const SUP_V = [[150, ADULT, -0.5, 0], [175, ADULT, 0.45, 0.01], [200, ADULT, -0.15, 0.018], [280, LADY, 0.3, 0.006], [320, LADY, -0.35, 0.014], [240, ADULT, 0.1, 0.022]];

// ======================================================================= arrangement helpers
function senMel(b0, arr, g = 0.26) { for (const [p, l, m, op = {}] of arr) put(SEN, b0 + p * E8, sen(m, l * E8 * 0.95, op.sl || 0, op.bd || 0), { gain: g, pan: 0.22, hall: 0.18, room: 0.05 }); }
function surfNote(t, m, len, op = {}, g = 0.24, spr = 0.45) {
  let sig;
  if (op.trem) { const o = { ...op }; if (op.wh && !op.bend) { o.bend = (tt) => -2 * smooth((tt - len * 0.55) / (len * 0.45)); o.k = 'wh'; } sig = surfTrem(m, len, o); }
  else sig = surf(m, len, op);
  put(SURF, t, sig, { gain: g, pan: -0.22, hall: 0.06 });
  put(SPRING, t, sig, { gain: g * spr, pan: -0.22 });
}
function surfMel(b0, arr, g = 0.24, spr) { for (const [p, l, m, op = {}] of arr) surfNote(b0 + p * E8, m, l * E8 * 0.97, op, g * (op.trem ? 0.85 : 1), spr); }
const AMIN = [9, 11, 0, 2, 4, 5, 7];
function thirdBelow(m) { const i = AMIN.indexOf(((m % 12) + 12) % 12); if (i < 0) return m - 4; const t = AMIN[(i + 5) % 7]; let d = (m % 12) - t; if (d <= 0) d += 12; return m - d; }
function accMel(b0, arr, g = 0.17) { for (const [p, l, m] of arr) put(ACC, b0 + p * E8, acc([thirdBelow(m), m], l * E8 * 0.92, { mu: 1 }), { gain: g, pan: -0.05, hall: 0.15, room: 0.05 }); }
function timbRoll(t0, dur, g0, g1, step = BAR / 16) { for (let k = 0, t = t0; t < t0 + dur - 1e-6; t += step, k++) put(MH, t, timbale(k % 2 ? 0 : 1, k), { gain: g0 + (g1 - g0) * (t - t0) / dur, pan: k % 2 ? -0.35 : -0.1, room: 0.12, hall: 0.05 }); }
// one bar of cumbia: bass tumbao, light kick, guira chucu-chucu, timbales 2&4, accordion offbeats, song lang downbeat
function grooveBar(b0, o = {}) {
  const lv = o.lvl ?? 1, until = o.until ?? b0 + BAR + 1e-3, ok = (t) => t < until - 1e-6, ch0 = chordAt(b0 + 1e-3);
  for (let j = 0; j < 4; j++) {
    const t = b0 + j * BEAT; if (!ok(t)) break;
    const ch = chordAt(t + 1e-3);
    if (o.bass !== false) {
      if (j === 0) put(ML, t, ebass(ROOT[ch], BEAT * 1.7), { gain: 0.5 * lv });
      if (j === 2) put(ML, t, ebass(ch !== ch0 ? ROOT[ch] : FIFTH[ch], BEAT * 1.3), { gain: 0.45 * lv });
      if (j === 1 && o.ghost) put(ML, t + BEAT / 2, ebass(ROOT[ch] + 12, 0.15), { gain: 0.16 * lv });
      if (j === 3 && ok(t + BEAT / 2)) { const nx = chordAt(b0 + BAR + 1e-3); if (ROOT[nx]) { const r = ROOT[nx], ap = r < ROOT[ch] ? r + 2 : r - 1; put(ML, t + BEAT / 2, ebass(ap, 0.22), { gain: 0.32 * lv }); } }
    }
    if (o.kick !== false && (j === 0 || j === 2)) put(ML, t, kick(), { gain: (j ? 0.42 : 0.55) * lv });
    if (o.guira !== false) { put(MH, t, guira(1, j), { gain: 0.085 * lv, pan: 0.32, room: 0.08 }); for (const d of [0.3125, 0.46875]) if (ok(t + d)) put(MH, t + d, guira(0, j * 2 + (d > 0.4 ? 1 : 0)), { gain: 0.06 * lv, pan: 0.32, room: 0.08 }); }
    if (o.timb !== false && (j === 1 || j === 3)) put(MH, t, timbale(j === 3 ? 1 : 0, j), { gain: 0.19 * lv, pan: -0.25, room: 0.12, hall: 0.05 });
    if (o.bell === 'cow') put(MH, t, cowbell(j), { gain: (j ? 0.065 : 0.09) * lv, pan: 0.15, room: 0.06 });
    if (o.bell === 'pot') put(MH, t, potHit(j), { gain: (j ? 0.07 : 0.09) * lv, pan: 0.28, room: 0.1 });
    if (j === 0 && o.lang !== false) put(MH, t, songLang(), { gain: 0.13 * lv, pan: -0.1, room: 0.1, hall: 0.05 });
  }
  if (o.casc) for (const p of [0, 2, 3, 5, 6]) { const t = b0 + p * E8; if (ok(t)) put(MH, t, cascara(p), { gain: 0.065 * lv, pan: -0.4, room: 0.06 }); }
  const ag = o.acc ?? 0.11;
  if (ag) for (const p of [1, 3, 5, 7]) { const t = b0 + p * E8; if (ok(t)) put(ACC, t, acc(ACCV[chordAt(t + 1e-3)], 0.19), { gain: ag * lv, pan: 0.14, room: 0.08, hall: 0.06 }); }
  if (o.twang) { const t = b0; put(SURF, t, surf(ROOT[ch0] + 12, 0.55), { gain: o.twang * lv, pan: -0.3, hall: 0.05 }); put(SPRING, t, surf(ROOT[ch0] + 12, 0.55), { gain: o.twang * lv * 0.5, pan: -0.3 }); }
}

// ======================================================================= SCORE
// ---------- ambience bed (follows AMB_KEYS): water, birds, distant motorboats
{
  const R = rngFor('amb');
  putAmb(0, waterLap(R, DUR), { gain: 0.6 });
  for (const [t, p] of [[1.1, 0.6], [3.6, -0.5], [6.9, 0.4], [9.2, -0.6], [18.3, 0.5], [27.4, -0.5], [36.1, 0.6], [44.0, -0.4], [50.4, 0.5], [51.1, -0.6], [61.3, 0.5], [64.2, -0.5]]) putAmb(t, birdCall(R), { gain: 0.06, pan: p, hall: 0.25 });
  const mb = motorboat(R, 10, 6.4); for (let i = 0; i < mb.length; i++) { const t = i / SR; mb[i] *= smooth(t / 2.5) * (1 - smooth((t - 7) / 3)); }
  putAmb(0.2, mb, { gain: 0.07, pan: (t) => 0.7 - 1.2 * t / 10, hall: 0.2 });
  putAmb(12.4, boatPass(R, 3.2), { gain: 0.07, pan: (t) => -0.7 + 0.45 * t, hall: 0.15 });
  putAmb(33.0, boatPass(R, 3.6), { gain: 0.06, pan: (t) => 0.7 - 0.4 * t, hall: 0.15 });
  putAmb(61.0, boatPass(R, 3.4), { gain: 0.05, pan: (t) => -0.6 + 0.35 * t, hall: 0.15 });
}

// ---------- ACT I 0-10: dawn on the river, solo surf guitar through the spring tank; band rises at 5, title 8.75
{
  const R = rngFor('act1');
  surfNote(0.3, 57, 1.9, { trem: 1, cres: (u) => 0.2 + 0.8 * smooth(u * 1.4), k: 'intro' }, 0.2, 0.7);
  surfMel(2.5, [[0, 1, 57], [1, 1, 60], [2, 1, 64], [3, 1, 67], [4, 3, 69, { trem: 1 }], [7, 1, 67]], 0.23, 0.6);
  surfMel(5.0, [[0, 2, 65], [2, 2, 64], [4, 4, 60, { trem: 1 }]], 0.23, 0.55);
  surfMel(7.5, [[0, 2, 64], [2, 2, 56]], 0.23, 0.55);
  put(ACC, 5.0, acc(ACCV.F, 2.35, { att: 0.3 }), { gain: 0.07, pan: 0.15, hall: 0.2 });
  put(ACC, 7.5, acc(ACCV.E, 1.15, { att: 0.15 }), { gain: 0.08, pan: 0.15, hall: 0.2 });
  put(ML, 5.0, ebass(41, 2.3), { gain: 0.38 }); put(ML, 7.5, ebass(40, 1.1), { gain: 0.42 });
  for (let t = 5.0, j = 0; t < 8.7; t += BEAT, j++) { const lv = 0.4 + 0.5 * (t - 5) / 3.75; put(MH, t, guira(1, j), { gain: 0.08 * lv, pan: 0.32, room: 0.08 }); put(MH, t + 0.3125, guira(0, j), { gain: 0.055 * lv, pan: 0.32, room: 0.08 }); put(MH, t + 0.46875, guira(0, j + 1), { gain: 0.055 * lv, pan: 0.32, room: 0.08 }); }
  for (const t of [2.5, 5.0, 7.5]) put(MH, t, songLang(), { gain: 0.12, pan: -0.1, room: 0.1, hall: 0.1 });
  put(SFX, 1.5, vHuTieuDay(R), { gain: 0.3, pan: 0.45, hall: 0.4, room: 0.1 });
  put(SFX, 6.25, lidClank(R), { gain: 0.34, pan: 0.05, room: 0.15 });
  put(SFX, 6.35, steamHiss(R, 2.0), { gain: 0.14, pan: 0.05 });
  put(SFX, 7.0, sniff(R), { gain: 0.38, pan: -0.1, room: 0.15 });
  put(SFX, 7.7, whoosh(R, 0.4, 300, 1500, 500), { gain: 0.16, pan: (t) => -0.3 + t });
  put(MH, 7.75, reverseCrash(R, 1.0), { gain: 0.1, hall: 0.1 });
  // title hit 8.75: low E twang + spring drip + crash, timbale roll into the band at 10
  put(MH, 8.75, crash(R, 2.2), { gain: 0.17, hall: 0.25 });
  put(FX2, 8.75, bigBoom(R, 1.3, 88, 36, 0.42), { gain: 0.28 });
  put(ML, 8.75, kick(), { gain: 0.6 }); put(ML, 8.75, ebass(40, 1.0), { gain: 0.45 });
  surfNote(8.75, 40, 1.15, { vib: 0.25, k: 'tw' }, 0.3, 0.9);
  put(MH, 8.8, springDrip(), { gain: 0.07, pan: -0.25, hall: 0.1 });
  put(MH, 8.75, ting(m2f(93), 1.1), { gain: 0.06, hall: 0.35, pan: 0.3 });
  timbRoll(8.75, 1.25, 0.05, 0.2);
}

// ---------- ACT II 10-40: full band. 10-20 sen melody A, 20-30 surf melody (ladle-on-pot cowbell), 30-40 sen melody B (cowbell + cascara)
{
  const R = rngFor('band');
  put(MH, 10, crash(R, 1.8), { gain: 0.12, hall: 0.2 });
  put(ACC, 10, acc(ACCV.Am, 0.5), { gain: 0.12, pan: 0.14, hall: 0.1 });
  for (let k = 0; k < 12; k++) {
    const b0 = 10 + 2.5 * k, sec = k >> 2;
    if (sec === 0) grooveBar(b0, { acc: 0.11, ghost: k >= 2, twang: 0.09 });
    else if (sec === 1) grooveBar(b0, { bell: 'pot', acc: 0.085, ghost: true });
    else grooveBar(b0, { bell: 'cow', casc: true, acc: 0.11, ghost: true, lvl: 1.05, twang: 0.08 });
  }
  const SA = [[[1, 1, 72], [2, 1, 74], [3, 3, 76, { sl: 2 }], [6, 1, 74], [7, 1, 72]], [[0, 2, 74, { bd: 1 }], [2, 2, 71], [4, 1, 67], [5, 1, 69], [6, 2, 71]], [[0, 3, 72, { sl: 1 }], [3, 1, 69], [4, 2, 72], [6, 2, 77, { bd: 1 }]], [[0, 3, 76], [3, 1, 74], [4, 2, 71, { bd: 1 }], [6, 2, 68]]];
  const SU = [[[0, 1, 57], [1, 1, 60], [2, 1, 64], [3, 1, 62], [4, 4, 64, { trem: 1 }]], [[0, 1, 62], [1, 1, 59], [2, 1, 55], [3, 1, 59], [4, 4, 62, { trem: 1 }]], [[0, 1, 60], [1, 1, 57], [2, 1, 53], [3, 1, 57], [4, 2, 60], [6, 2, 65]], [[0, 4, 64, { trem: 1, wh: 1 }], [4, 2, 59], [6, 2, 56]]];
  const SB = [[[0, 2, 81, { sl: 3 }], [2, 1, 79], [3, 1, 76], [4, 2, 79, { bd: 2 }], [6, 1, 76], [7, 1, 74]], [[0, 3, 74, { bd: 1 }], [3, 1, 71], [4, 2, 74], [6, 2, 79]], [[0, 2, 77, { sl: 2 }], [2, 2, 76], [4, 1, 74], [5, 1, 72], [6, 2, 69]], [[0, 4, 71, { bd: 1 }], [4, 1, 68], [5, 1, 71], [6, 2, 76, { sl: 2 }]]];
  for (let j = 0; j < 4; j++) { senMel(10 + 2.5 * j, SA[j], 0.27); }
  for (let j = 0; j < 4; j++) surfMel(20 + 2.5 * j, SU[j], 0.25, 0.45);
  for (let j = 0; j < 4; j++) senMel(30 + 2.5 * j, SB[j], 0.28);
  // sen answers under the surf section, surf answers under sen B
  senMel(22.5, [[7, 1, 76, { sl: 2 }]], 0.15); senMel(27.5, [[7, 1, 69, { sl: 1 }]], 0.15);
  surfMel(32.5, [[7, 1, 64]], 0.14); surfMel(37.5, [[6, 1, 64], [7, 1, 68]], 0.14);
  // build into 30: reverse cymbal, timbale fill
  put(MH, 28.75, reverseCrash(R, 1.25), { gain: 0.13, hall: 0.1 });
  timbRoll(29.375, 0.625, 0.08, 0.2);
  put(MH, 30, crash(R, 2.2), { gain: 0.16, hall: 0.25 });
  put(FX2, 30, bigBoom(R, 1.2, 80, 38, 0.4), { gain: 0.2 });
  // into 40: timbale fill + crash
  timbRoll(39.375, 0.625, 0.08, 0.2);
}

// ---------- ACT II foley 10-40
{
  const R = rngFor('act2');
  // 11.25-13.75 pot simmers, clock spins 3:00 -> 8:00 (accelerating ticks + ding)
  put(SFX, 11.25, potBubbles(R, 2.5, 22), { gain: 0.16, pan: 0.1, room: 0.08 });
  for (let t = 11.25, dt = 0.3; t < 13.7; t += dt, dt = Math.max(0.045, dt * 0.86)) put(SFX, t, tick(R, 3200), { gain: 0.16, pan: -0.2 });
  put(SFX, 13.75, ting(m2f(91), 0.9), { gain: 0.2, pan: -0.2, hall: 0.2 }); put(SFX, 13.75, ting(m2f(96), 0.6), { gain: 0.1, pan: -0.2 });
  // 13.75-17.5 boats bump, bamboo hook, "Hu tieu hong con?", selfie-stick sign, laugh
  put(SFX, 13.8, woodThunk(R, 150), { gain: 0.34, pan: 0.15, room: 0.15 });
  put(SFX, 13.85, creak(R, 0.5, 420), { gain: 0.12, pan: 0.2, room: 0.1 });
  put(SFX, 13.9, splash(R, 0.3), { gain: 0.12, pan: 0.25 });
  put(SFX, 14.15, bambooRattle(R, 0.25, 22), { gain: 0.16, pan: -0.2 });
  put(SFX, 14.5, vHongCon(R), { gain: 0.42, pan: 0.2, room: 0.12, hall: 0.06 });
  put(SFX, 15.65, whoosh(R, 0.35, 400, 2200, 700), { gain: 0.14, pan: -0.3 }); put(SFX, 15.95, squeak(R, 1600), { gain: 0.12, pan: -0.3 });
  put(SFX, 16.4, vLaugh(R), { gain: 0.3, pan: 0.2, room: 0.12, hall: 0.06 });
  // 17.5-20 noodles into the basket, 3 shakes on the beat
  put(SFX, 17.5, softThud(R), { gain: 0.22, pan: 0.05 }); put(SFX, 17.5, crinkle(R, 0.2, 400, 1500, 6000), { gain: 0.1 });
  for (const t of [18.125, 18.75, 19.375]) put(SFX, t - 0.03, basketShake(R), { gain: 0.24, pan: 0.15, room: 0.1 });
  // 20-22.5 drips, noodles into the bowl
  for (const t of [20.05, 20.35, 20.6, 20.8]) put(SFX, t, drip(R), { gain: 0.16, pan: 0.1 });
  put(SFX, 21.25, softThud(R), { gain: 0.24 }); put(SFX, 21.27, splash(R, 0.15), { gain: 0.1 });
  // 22.5-26.25 toppings land one per beat (pentatonic pings)
  [81, 84, 86, 88, 91, 93].forEach((m, k) => { const t = 22.5 + k * BEAT; put(SFX, t, k % 2 ? pat(R) : softThud(R), { gain: 0.22, pan: k % 2 ? 0.2 : -0.2, room: 0.08 }); put(MH, t, ting(m2f(m), 0.5), { gain: 0.05, pan: k % 2 ? 0.3 : -0.3, hall: 0.2 }); });
  // 26.25-28.75 fried garlic sprinkle (falling garlic = guira)
  put(SFX, 26.25, garlicRain(R, 2.3), { gain: 0.13, pan: 0.1, room: 0.06 });
  // 30 broth ladled: big steam "phiii" + pour
  put(SFX, 29.95, brothPour(R, 1.8), { gain: 0.24, pan: 0.05, room: 0.1 });
  put(SFX, 30.0, steamHiss(R, 2.4), { gain: 0.26, pan: (t) => 0.2 * Math.sin(t * 3) });
  // 32.5-35 sprouts, chili, lime squirt
  put(SFX, 32.5, leafRustle(R, 0.5), { gain: 0.2, pan: -0.15 });
  for (const t of [33.4, 33.6, 33.8]) put(SFX, t, herbTuk(R), { gain: 0.18, pan: 0.15 });
  put(SFX, 34.4, squirt(R), { gain: 0.26, pan: 0.1 });
  // 35-37.5 sparkle on the finished bowl
  sparkleAt(35.0, R, 0.07); sparkleAt(36.25, R, 0.05, [96, 100, 103]);
  // 37.5-40 bowl handed across the boats
  put(SFX, 37.6, handOver(R), { gain: 0.3, pan: (t) => -0.4 + 0.9 * t });
  put(SFX, 37.7, creak(R, 0.7, 380), { gain: 0.12, pan: 0.3 });
  put(SFX, 38.9, softThud(R), { gain: 0.2, pan: 0.3 });
}

// ---------- ACT III 40-50: breakdown, the slurp gag
{
  const R = rngFor('act3');
  put(MH, 40, crash(R, 1.6), { gain: 0.1, hall: 0.25 });
  put(MH, 40.05, springDrip(), { gain: 0.06, pan: -0.25, hall: 0.1 });
  put(ML, 40, ebass(45, 2.3), { gain: 0.36 }); put(ML, 42.5, ebass(43, 2.3), { gain: 0.36 });
  put(ACC, 40, acc(ACCV.Am, 2.4, { att: 0.25 }), { gain: 0.055, pan: 0.15, hall: 0.2 });
  put(ACC, 42.5, acc(ACCV.G, 2.4, { att: 0.25 }), { gain: 0.055, pan: 0.15, hall: 0.2 });
  for (let t = 40, j = 0; t < 44.99; t += BEAT, j++) put(MH, t, guira(1, j), { gain: 0.05, pan: 0.32, room: 0.08 });
  for (const t of [40, 42.5]) put(MH, t, songLang(), { gain: 0.1, pan: -0.1, room: 0.1, hall: 0.1 });
  senMel(40, [[5, 1, 72], [6, 2, 76, { sl: 2 }]], 0.17); senMel(42.5, [[4, 2, 79, { bd: 1 }], [6, 2, 74]], 0.15);
  // tiny spoon sips, dì Bay's advice, her demo slurp
  for (const t of [40.3, 40.7]) { put(SFX, t, iceClink(R, 3400), { gain: 0.06, pan: -0.2 }); put(SFX, t + 0.05, smallSlurp(R, 0.14, 2500, 3600), { gain: 0.12, pan: -0.2 }); }
  put(SFX, 41.25, vPhaiHup(R), { gain: 0.42, pan: 0.2, room: 0.12, hall: 0.06 });
  put(SFX, 43.75, smallSlurp(R, 0.42, 700, 2800), { gain: 0.3, pan: 0.2, room: 0.1 });
  // 45-47.5 sunglasses down, backpack handed off, "Hold my backpack!", inhale; timbale crescendo + surf tremolo climb
  put(SFX, 45.0, whoosh(R, 0.25, 500, 2500, 900), { gain: 0.14, pan: -0.15 }); put(SFX, 45.22, uiClick(R), { gain: 0.2, pan: -0.15 });
  put(SFX, 45.3, handOver(R), { gain: 0.2, pan: (t) => -0.2 + 0.8 * t });
  put(SFX, 45.5, vHoldMy(R), { gain: 0.42, pan: -0.2, room: 0.12, hall: 0.06 });
  put(SFX, 46.5, inhale(R, 0.95), { gain: 0.3, pan: -0.15, room: 0.08 });
  timbRoll(45, 2.5, 0.04, 0.2);
  for (let j = 0; j < 4; j++) put(ML, 45 + j * BEAT, kick(), { gain: 0.3 + 0.08 * j });
  for (let j = 0; j < 8; j++) put(ML, 45 + j * E8, ebass(41, E8 * 0.8), { gain: 0.2 + 0.03 * j });
  put(ACC, 45, acc(ACCV.F, 2.45, { att: 1.6 }), { gain: 0.08, pan: 0.15, hall: 0.15 });
  [57, 59, 60, 62, 64, 65, 67, 69].forEach((m, j) => surfNote(45 + j * E8, m, E8 * 1.02, { trem: 1 }, 0.1 + 0.022 * j, 0.5));
  put(MH, 45, riser(R, 2.5, 250, 7000), { gain: 0.08 });
  put(MH, 46.5, reverseCrash(R, 1.0), { gain: 0.12 });
  // 47.5 SLUUURP + whammy dive, bloop rings, boats rock, hats fly, herons take off; band slams on E until 50
  put(MH, 47.5, crash(R, 2.4), { gain: 0.18, hall: 0.25 });
  put(FX2, 47.5, bigBoom(R, 1.4, 90, 34, 0.45), { gain: 0.3 });
  grooveBar(47.5, { bell: 'cow', casc: true, acc: 0.12, lvl: 1.1, until: 50 });
  surfNote(47.5, 64, 1.9, { trem: 1, bend: (t) => -12 * smooth((t - 0.15) / 1.5) + 0.35 * Math.sin(TAU * 7 * t) * smooth(t / 0.3), k: 'dive' }, 0.26, 0.7);
  put(SFX, 47.5, bigSlurp(R), { gain: 0.5, pan: -0.1, room: 0.1 });
  [[47.95, 300], [48.25, 360], [48.6, 430]].forEach(([t, f], k) => put(SFX, t, bloop(f), { gain: 0.2 - 0.03 * k, pan: k % 2 ? 0.3 : -0.3, hall: 0.12 }));
  put(SFX, 48.2, creak(R, 0.9, 360), { gain: 0.14, pan: -0.4, room: 0.1 }); put(SFX, 48.4, creak(R, 0.8, 470), { gain: 0.12, pan: 0.4, room: 0.1 });
  put(SFX, 48.3, splash(R, 0.6), { gain: 0.14, pan: 0.2 });
  put(SFX, 48.1, whoosh(R, 0.55, 300, 2400, 600), { gain: 0.16, pan: (t) => -0.2 - t }); put(SFX, 48.35, whoosh(R, 0.55, 350, 2800, 700), { gain: 0.14, pan: (t) => 0.2 + t });
  put(SFX, 48.7, wings(R, 9, 4.8), { gain: 0.18, pan: (t) => 0.3 - 0.4 * t, hall: 0.1 });
  put(SFX, 49.0, squawk(R), { gain: 0.16, pan: 0.4, hall: 0.25 });
  // 50-51.875 music stops, water only; 51.25 "chat" slap on the sunglasses
  put(SFX, 51.25, chatSlap(R), { gain: 0.38, pan: -0.05, room: 0.12 });
}

// ---------- 52.5-65: crowd "SUP!" x4, accordion chorus, flavor bursts, "Them to nua!", end card at 60
{
  const R = rngFor('finale');
  [52.5, 53.125, 53.75, 54.375].forEach((t, k) => put(SFX, t - 0.04, crowdSay(R, segSup, SUP_V), { gain: 0.42 + 0.03 * k, room: 0.15, hall: 0.08 }));
  put(MH, 52.5, crash(R, 2.2), { gain: 0.17, hall: 0.25 });
  put(FX2, 52.5, bigBoom(R, 1.1, 85, 38, 0.38), { gain: 0.22 });
  for (const b0 of [52.5, 55, 57.5]) grooveBar(b0, { bell: 'cow', casc: true, acc: 0.07, ghost: true, lvl: 1.1, twang: 0.07 });
  const CH = [[[0, 2, 76], [2, 1, 77], [3, 1, 76], [4, 2, 72], [6, 2, 69]], [[0, 2, 74], [2, 1, 76], [3, 1, 74], [4, 2, 71], [6, 2, 67]], [[0, 2, 72], [2, 2, 69], [4, 2, 71], [6, 2, 68]]];
  CH.forEach((bar, j) => accMel(52.5 + 2.5 * j, bar, 0.17));
  // flavor bursts 55-58.75
  sparkleAt(55.0, R, 0.06); put(SFX, 55.625, bloop(520), { gain: 0.12, pan: 0.3 }); sparkleAt(56.25, R, 0.05, [93, 96, 100]); put(SFX, 56.875, bloop(620), { gain: 0.1, pan: -0.3 });
  put(SFX, 57.5, vThemTo(R), { gain: 0.44, pan: -0.15, room: 0.12, hall: 0.06 });
  put(MH, 58.75, ting(m2f(88), 0.7), { gain: 0.05, hall: 0.3 });
  // end card 60
  put(MH, 59.375, reverseCrash(R, 0.625), { gain: 0.1 });
  put(MH, 60, crash(R, 1.8), { gain: 0.12, hall: 0.25 });
  grooveBar(60, { casc: true, acc: 0.1, lvl: 0.95 });
  grooveBar(62.5, { casc: true, acc: 0.1, lvl: 0.95 });
  surfMel(60, [[0, 4, 69, { trem: 1 }], [4, 1, 67], [5, 1, 64], [6, 1, 62], [7, 1, 60]], 0.24, 0.5);
  senMel(62.5, [[0, 2, 77, { bd: 1 }], [2, 2, 76], [4, 4, 71, { sl: 2 }]], 0.26);
}

// ---------- CTA 65-70: heart pop + pick slide, cowbell ting, FOLLOW click (song lang + sen bend), wink, cha-cha-cha ending on Am
{
  const R = rngFor('cta');
  grooveBar(65, { acc: 0.075, lvl: 0.85, lang: false });
  grooveBar(67.5, { acc: 0.075, lvl: 0.85, until: 68.75, timb: false, lang: false });
  put(SURF, 64.9, pickSlide(R), { gain: 0.2, pan: -0.25 }); put(SPRING, 64.9, pickSlide(R), { gain: 0.12, pan: -0.25 });
  put(SFX, 65.0, bloop(700), { gain: 0.16, pan: 0.1 });
  for (let t = 65.0; t < 68.7; t += BEAT) put(FX2, t, heartThump(), { gain: 0.3 });
  put(MH, 65.625, cowbell(0), { gain: 0.16, pan: 0.15, room: 0.1 }); put(MH, 65.625, ting(m2f(93), 0.6), { gain: 0.05, hall: 0.3 });
  accMel(65, [[0, 1, 69], [1, 1, 72], [2, 1, 76], [3, 1, 81]], 0.15);
  put(SFX, 66.2, uiClick(R), { gain: 0.32, pan: 0.1 });
  put(MH, 66.25, songLang(), { gain: 0.2, pan: -0.1, room: 0.1, hall: 0.1 });
  put(SEN, 66.25, sen(81, 1.0, 2, 1), { gain: 0.28, pan: 0.22, hall: 0.2 });
  put(SFX, 66.25, crinkle(R, 0.8, 900, 4000, 11000), { gain: 0.08, pan: 0.2 });
  put(MH, 66.25, crash(R, 1.2), { gain: 0.07, hall: 0.25 });
  put(SFX, 66.875, ting(m2f(100), 0.4), { gain: 0.1, pan: 0.3, hall: 0.2 }); put(SFX, 66.86, tick(R, 4500), { gain: 0.1, pan: 0.3 });
  accMel(67.5, [[0, 1, 68], [1, 1, 71], [2, 1, 74], [3, 1, 76]], 0.15);
  [[67.5, 1], [67.8125, 0], [68.125, 1]].forEach(([t, hi], k) => put(MH, t, timbale(hi, k), { gain: 0.2, pan: -0.25, room: 0.12, hall: 0.05 }));
  // final Am hit 68.75 rings into the fade
  put(ACC, 68.75, acc([57, 60, 64, 69], 0.9, { mu: 1 }), { gain: 0.12, pan: 0.05, hall: 0.25 });
  put(ML, 68.75, ebass(45, 0.8), { gain: 0.5 }); put(ML, 68.75, kick(), { gain: 0.55 });
  put(MH, 68.75, timbale(1, 2), { gain: 0.22, pan: -0.25, room: 0.12 }); put(MH, 68.75, cowbell(0), { gain: 0.1, pan: 0.15 });
  put(MH, 68.75, crash(R, 1.4), { gain: 0.1, hall: 0.25 });
  surfNote(68.75, 69, 0.6, { trem: 1, k: 'end' }, 0.2, 0.7); surfNote(68.75, 45, 0.7, { vib: 0.2, k: 'endlo' }, 0.2, 0.8);
  put(MH, 69.0, springDrip(), { gain: 0.05, pan: -0.25 });
}
console.log('score placed', ((Date.now() - T_START) / 1000).toFixed(1) + 's');

// ---------- instrument bus voicing -> MH (surf amp EQ + spring tank, sen, accordion); music stops 50.0-52.5
{
  const spL = springVerb(SPRING.L, secs(0.033), 0.7), spR = springVerb(SPRING.R, secs(0.041), 0.7);
  const sp = { L: spL, R: spR };
  for (const ch of ['L', 'R']) {
    const s = SURF[ch], e = SEN[ch], a = ACC[ch];
    filtIn(s, 'hp', 120, 0.7); filtIn(s, 'peak', 400, 0.9, -3); filtIn(s, 'peak', 2800, 1.0, 5); filtIn(s, 'lp', 5500, 0.7);
    filtIn(e, 'hp', 250, 0.7); filtIn(e, 'peak', 900, 1.2, 3); filtIn(e, 'peak', 2200, 1.4, 3); filtIn(e, 'lp', 6500, 0.7);
    filtIn(a, 'hp', 150, 0.7); filtIn(a, 'lp', 7000, 0.7);
    const m = MH[ch], r = sp[ch]; for (let i = 0; i < N; i++) m[i] += 1.4 * s[i] + 1.6 * e[i] + 1.3 * a[i] + 0.6 * r[i];
  }
  const a = Math.round(50.0 * SR), b = Math.round(50.06 * SR), c = I_S1;
  for (const bus of [MH, ML]) for (let i = a; i < c; i++) { const g = i < b ? 0.5 + 0.5 * Math.cos(Math.PI * (i - a) / (b - a)) : 0; bus.L[i] *= g; bus.R[i] *= g; }
}

// ======================================================================= MIX + MASTER
const gateS = (i) => {
  if (i < I_S0 - secs(0.03)) return 1;
  if (i < I_S0) return 0.5 + 0.5 * Math.cos(Math.PI * (i - (I_S0 - secs(0.03))) / secs(0.03));
  if (i < I_S1 - secs(0.008)) return 0;
  if (i < I_S1) return 0.5 - 0.5 * Math.cos(Math.PI * (i - (I_S1 - secs(0.008))) / secs(0.008));
  return 1;
};
// stem peaks (pre-master)
function busPeak(b) { let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(b.L[i]), Math.abs(b.R[i])); return m; }
const stemPk = { MH: busPeak(MH), ML: busPeak(ML), SFX: busPeak(SFX), FX2: busPeak(FX2) };
// gate every bus (and reverb sends) over the hush
for (const b of [MH, ML, SFX, FX2, HALL, ROOM]) for (let i = I_S0 - secs(0.03); i < I_S1; i++) { const g = gateS(i); b.L[i] *= g; b.R[i] *= g; }
// music: high part HP 110 / LP 13k, + bass/kick part, HP 30
filtIn(MH.L, 'hp', 70, 0.7); filtIn(MH.R, 'hp', 70, 0.7); filtIn(MH.L, 'lp', 13000, 0.7); filtIn(MH.R, 'lp', 13000, 0.7);
const musL = new Float32Array(N), musR = new Float32Array(N);
filtIn(MH.L, 'peak', 3600, 0.6, 1.5); filtIn(MH.R, 'peak', 3600, 0.6, 1.5);
const ML_G = 0.5;
for (let i = 0; i < N; i++) { musL[i] = MH.L[i] + ML.L[i] * ML_G; musR[i] = MH.R[i] + ML.R[i] * ML_G; }
filtIn(musL, 'hp', 30, 0.7); filtIn(musR, 'hp', 30, 0.7);
filtIn(SFX.L, 'hp', 80, 0.7); filtIn(SFX.R, 'hp', 80, 0.7);
// duck: keyed by SFX only
const duck = new Float32Array(N);
{
  const at = 1 - Math.exp(-1 / (0.005 * SR)), rl = 1 - Math.exp(-1 / (0.25 * SR)); let e = 0;
  for (let i = 0; i < N; i++) { const x = Math.max(Math.abs(SFX.L[i]), Math.abs(SFX.R[i])); e += (x - e) * (x > e ? at : rl); duck[i] = 1 - 0.3 * clamp(e / 0.25); }
}
function reverb(inL, inR, o = {}) {
  const size = o.size ?? 1, fb = o.fb ?? 0.85, damp = o.damp ?? 0.28, apfb = 0.5, clearAt = o.clearAt ?? -1;
  const sc = (SR / 44100) * size, spread = 23;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apT = [556, 441, 341, 225];
  const mkC = (len) => ({ buf: new Float32Array(Math.max(8, Math.round(len * sc))), i: 0, st: 0 });
  const cl = combT.map((t) => mkC(t)), cr = combT.map((t) => mkC(t + spread));
  const al = apT.map((t) => mkC(t / size * (0.6 + 0.4 * size))), ar = apT.map((t) => mkC((t + spread) / size * (0.6 + 0.4 * size)));
  const pre = new Float32Array(secs(o.pre ?? 0.022)); let pi = 0;
  const outL = new Float32Array(N), outR = new Float32Array(N);
  const fl = filt(filt(inL, 'hp', o.hp ?? 180, 0.7), 'lp', o.lp ?? 7500, 0.7), fr = filt(filt(inR, 'hp', o.hp ?? 180, 0.7), 'lp', o.lp ?? 7500, 0.7);
  const all = [...cl, ...cr, ...al, ...ar];
  const inG = 0.03 * (o.inGain ?? 1);
  for (let n = 0; n < N; n++) {
    if (n === clearAt) { for (const c of all) { c.buf.fill(0); c.st = 0; } pre.fill(0); }
    const x = pre[pi]; pre[pi] = (fl[n] + fr[n]) * 0.5 * inG; pi = (pi + 1) % pre.length;
    let l = 0, r = 0;
    for (const c of cl) { const ov = c.buf[c.i]; c.st = ov * (1 - damp) + c.st * damp; c.buf[c.i] = x + c.st * fb; c.i = (c.i + 1) % c.buf.length; l += ov; }
    for (const c of cr) { const ov = c.buf[c.i]; c.st = ov * (1 - damp) + c.st * damp; c.buf[c.i] = x + c.st * fb; c.i = (c.i + 1) % c.buf.length; r += ov; }
    for (const a of al) { const b = a.buf[a.i]; const ov = -l + b; a.buf[a.i] = l + b * apfb; a.i = (a.i + 1) % a.buf.length; l = ov; }
    for (const a of ar) { const b = a.buf[a.i]; const ov = -r + b; a.buf[a.i] = r + b * apfb; a.i = (a.i + 1) % a.buf.length; r = ov; }
    outL[n] = l; outR[n] = r;
  }
  return [outL, outR];
}
console.log('reverbs...');
const [hallL, hallR] = reverb(HALL.L, HALL.R, { fb: 0.865, damp: 0.3, pre: 0.028, clearAt: I_S0 });
const [roomL, roomR] = reverb(ROOM.L, ROOM.R, { size: 0.45, fb: 0.72, damp: 0.42, pre: 0.006, hp: 250, lp: 9000, inGain: 1.6, clearAt: I_S0 });
const SCL = 3;
let preL = new Float32Array(N), preR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const ml = SCL * Math.tanh(musL[i] * duck[i] / SCL), mr = SCL * Math.tanh(musR[i] * duck[i] / SCL);
  preL[i] = ml + hallL[i] + SFX.L[i] + FX2.L[i] + roomL[i];
  preR[i] = mr + hallR[i] + SFX.R[i] + FX2.R[i] + roomR[i];
}
filtIn(preL, 'hp', 24, 0.7); filtIn(preR, 'hp', 24, 0.7);
const masterEnv = (t) => (t <= FADE0 ? 1 : t >= FADE1 ? 0 : Math.pow(0.5 + 0.5 * Math.cos(Math.PI * (t - FADE0) / (FADE1 - FADE0)), 1.4));
for (let i = 0; i < N; i++) { const g = masterEnv(i / SR) * gateS(i); preL[i] *= g; preR[i] *= g; }

function kweight(x) {
  const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const x0 = x[i], y0 = 1.53512485958697 * x0 - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2; x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0; }
  x1 = x2 = y1 = y2 = 0;
  for (let i = 0; i < y.length; i++) { const x0 = y[i], y0 = x0 - 2 * x1 + x2 + 1.99004745483398 * y1 - 0.99007225036621 * y2; x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0; }
  return y;
}
function loudness(L, R) {
  const kl = kweight(L), kr = kweight(R), cs = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) cs[i + 1] = cs[i] + kl[i] * kl[i] + kr[i] * kr[i];
  const lk = (z) => -0.691 + 10 * Math.log10(z);
  const B = Math.round(0.4 * SR), H = Math.round(0.1 * SR), blocks = [];
  for (let s = 0; s + B <= N; s += H) blocks.push((cs[s + B] - cs[s]) / B);
  const absG = blocks.filter((z) => z > 0 && lk(z) > -70);
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const rel = lk(mean(absG)) - 10;
  const integ = lk(mean(absG.filter((z) => lk(z) > rel)));
  const S = Math.round(3 * SR); let maxS = -Infinity;
  for (let s = 0; s + S <= N; s += H) maxS = Math.max(maxS, lk((cs[s + S] - cs[s]) / S));
  let maxM = -Infinity; for (const z of blocks) if (z > 0) maxM = Math.max(maxM, lk(z));
  return { integ, maxS, maxM };
}
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
    if (p > 0.2 && i >= TT && i + TT < M) {
      for (const h of taps) { let a = 0, b = 0; for (let j = 0; j < 2 * TT; j++) { const c = h[j], ix = i - TT + 1 + j; a += L[ix] * c; b += R[ix] * c; } p = Math.max(p, Math.abs(a), Math.abs(b)); }
    }
    tp[i] = p;
  }
  return tp;
}
function limit(inL, inR, gain, ceilDb) {
  const L = new Float32Array(N), R = new Float32Array(N), CEIL = Math.pow(10, ceilDb / 20);
  for (let i = 0; i < N; i++) { L[i] = inL[i] * gain; R[i] = inR[i] * gain; }
  const LA = secs(0.004), rel = 1 - Math.exp(-1 / (0.12 * SR));
  const req = new Float32Array(N), tp = truePeak(L, R);
  for (let i = 0; i < N; i++) { const p = Math.max(tp[i], i > 0 ? tp[i - 1] : 0); req[i] = p > CEIL ? CEIL / p : 1; }
  const h = new Float32Array(N), dq = new Int32Array(N); let qh = 0, qt = 0;
  for (let j = N - 1; j >= 0; j--) { while (qt > qh && req[dq[qt - 1]] >= req[j]) qt--; dq[qt++] = j; while (dq[qh] > j + LA) qh++; h[j] = req[dq[qh]]; }
  const r = new Float32Array(N); let g = 1;
  for (let i = 0; i < N; i++) { g = Math.min(h[i], g + (1 - g) * rel); r[i] = g; }
  let sum = 0, minG = 1, over2 = 0; const W = LA + 1, G2 = Math.pow(10, -2 / 20), gr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    sum += r[i]; if (i >= W) sum -= r[i - W];
    const gs = i >= W - 1 ? sum / W : Math.min(1, sum / (i + 1));
    L[i] *= gs; R[i] *= gs; gr[i] = gs; if (gs < minG) minG = gs; if (gs < G2) over2++;
  }
  return { L, R, minG, over2: over2 / N, gr };
}
console.log('limiter...');
let gain = Math.pow(10, (TARGET_LUFS - loudness(preL, preR).integ) / 20), out;
for (let it = 0; it < 6; it++) {
  out = limit(preL, preR, gain, CEIL_DBTP);
  const lu = loudness(out.L, out.R).integ;
  if (Math.abs(lu - TARGET_LUFS) < 0.08) break;
  gain *= Math.pow(10, (TARGET_LUFS - lu) / 20);
}
const mL = out.L, mR = out.R;
for (let i = I_S0; i < I_S1; i++) { mL[i] = 0; mR[i] = 0; }
// soft water lapping in the hush (after the limiter, fixed level: RMS -46 dBFS over 51.925-52.45)
{
  const R = rngFor('hushwater'), w = waterLap(R, 3.0), w0 = Math.round(51.075 * SR);
  const env = (t) => smooth((t - 51.375) / 0.5) * (1 - smooth((t - 52.6) / 1.0));
  let ss = 0, cnt = 0; const a = Math.round(51.925 * SR), b = Math.round(52.45 * SR);
  for (let i = a; i < b; i++) { const k = i - w0, e = env(i / SR); ss += (w.L[k] * e) ** 2 + (w.R[k] * e) ** 2; cnt += 2; }
  const g = Math.pow(10, -46 / 20) / Math.sqrt(ss / cnt);
  for (let k = 0; k < w.L.length; k++) { const i = w0 + k; if (i >= N) break; const e = env(i / SR) * g; mL[i] += w.L[k] * e; mR[i] += w.R[k] * e; }
}
for (let i = Math.round(FADE1 * SR); i < N; i++) { mL[i] = 0; mR[i] = 0; }
{
  const tp = truePeak(mL, mR); let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, tp[i]);
  const lim = Math.pow(10, -1.55 / 20);
  if (pk > lim) { const g = lim / pk; for (let i = 0; i < N; i++) { mL[i] *= g; mR[i] *= g; } }
}
console.timeEnd('render');

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

// ======================================================================= verification (re-read the file)
{
  const buf = fs.readFileSync(OUT);
  const ch = buf.readUInt16LE(22), sr = buf.readUInt32LE(24), bits = buf.readUInt16LE(34), dl = buf.readUInt32LE(40), n = dl / 4;
  const L = new Float32Array(n), R = new Float32Array(n); let clipped = 0, pk = 0;
  for (let i = 0; i < n; i++) { const l = buf.readInt16LE(44 + i * 4), r = buf.readInt16LE(46 + i * 4); if (Math.abs(l) >= 32767 || Math.abs(r) >= 32767) clipped++; L[i] = l / 32768; R[i] = r / 32768; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
  const tpA = truePeak(L, R); let tp = 0; for (let i = 0; i < n; i++) tp = Math.max(tp, tpA[i]);
  const lu = loudness(L, R);
  const rms = (a, b) => { const i0 = Math.round(a * SR), i1 = Math.round(b * SR); let s = 0; for (let i = i0; i < i1; i++) s += L[i] * L[i] + R[i] * R[i]; return dbf(Math.sqrt(s / (2 * (i1 - i0)))); };
  let tailZero = true; for (let i = Math.round(FADE1 * SR); i < n; i++) if (L[i] !== 0 || R[i] !== 0) { tailZero = false; break; }
  let dcL = 0, dcR = 0; for (let i = 0; i < n; i++) { dcL += L[i]; dcR += R[i]; }
  let sS = 0, sM = 0; for (let i = 0; i < n; i++) { const m = (L[i] + R[i]) / 2, s = (L[i] - R[i]) / 2; sM += m * m; sS += s * s; }
  const grDb = -dbf(out.minG);
  console.log(`\nformat: ${ch} ch, ${sr} Hz, ${bits}-bit, ${(n / sr).toFixed(3)} s`);
  console.log(`peak ${dbf(pk).toFixed(2)} dBFS | true peak ${dbf(tp).toFixed(2)} dBTP | clipped samples ${clipped}`);
  console.log(`loudness: integrated ${lu.integ.toFixed(2)} LUFS | max short-term ${lu.maxS.toFixed(2)} | max momentary ${lu.maxM.toFixed(2)}`);
  console.log(`limiter: max GR ${grDb.toFixed(2)} dB | time with GR > 2 dB ${(out.over2 * 100).toFixed(2)}%`);
  console.log(`DC L ${(dcL / n).toExponential(2)} R ${(dcR / n).toExponential(2)} | side/mid ${dbf(Math.sqrt(sS / sM)).toFixed(1)} dB`);
  console.log('stem peaks (pre-master): ' + Object.entries(stemPk).map(([k, v]) => `${k} ${dbf(v).toFixed(1)}`).join(' | '));
  const W = [['intro', 0.3, 10], ['A', 10, 20], ['B', 20, 30], ['C', 30, 40], ['D', 40, 50], ['E', 50, 51.8], ['hush', 51.925, 52.45], ['burst', 52.5, 53.0], ['F', 53, 65], ['CTA', 65, 69]];
  console.log('section RMS: ' + W.map(([k, a, b]) => `${k} ${rms(a, b).toFixed(1)}`).join(' | '));
  // GR hot spots
  const hot = []; for (let s = 0; s < 70; s += 0.5) { let m = 1; for (let i = Math.round(s * SR); i < Math.round((s + 0.5) * SR); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -3 / 20)) hot.push(`${s.toFixed(1)}(${(-dbf(m)).toFixed(1)})`); }
  console.log('GR > 3 dB at: ' + (hot.join(' ') || 'none'));
  const hush = rms(51.925, 52.45), burstR = rms(52.5, 53.0);
  const checks = [
    ['format 48k/2ch/16-bit/70.000 s', ch === 2 && sr === 48000 && bits === 16 && n === N],
    [`loudness -15 +-0.5 (${lu.integ.toFixed(2)})`, Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    [`true peak <= -1.45 dBTP (${dbf(tp).toFixed(2)})`, dbf(tp) <= -1.45],
    ['no clipping', clipped === 0],
    [`hush RMS in [-70,-38] (${hush.toFixed(1)})`, hush >= -70 && hush <= -38],
    [`burst 52.5-53.0 > -30 dBFS (${burstR.toFixed(1)})`, burstR > -30],
    ['tail digital zero', tailZero],
    [`limiter GR <= 6 dB (${grDb.toFixed(2)})`, grDb <= 6],
  ];
  let ok = true; for (const [k, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + k); if (!v) ok = false; }
  console.log(`run time ${((Date.now() - T_START) / 1000).toFixed(1)} s`);
  if (!ok) process.exitCode = 1;
}
