'use strict';
// Nem nuong Cai Rang - soundtrack. "Mekong bossa-reggae on the floating market at sunrise", 100 BPM, G major.
// Everything synthesised in code (Karplus-Strong nylon guitar / ukulele / dan kim, upright bass, sao truc, muted trumpet,
// steel pan, bossa + reggae percussion, river & grill foley, formant voices). Output: audio.wav 48 kHz / stereo / 16-bit / 90.0 s, ~-15 LUFS, TP <= -1.5 dBTP.
const fs = require('fs'), path = require('path');
const T_START = Date.now();
console.time('render');
const SR = 48000, DUR = 90.0, N = Math.round(SR * DUR), TAU = Math.PI * 2;
const BEAT = 0.6, BAR = 2.4, S16 = 0.15;
const TARGET_LUFS = -15, CEIL_DBTP = -1.65;
const S0 = 71.4, S1 = 72.0, FADE0 = 88.4, FADE1 = 89.95;
const I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);

// ======================================================================= generic helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const rngFor = (name) => mulberry32(hashStr('nem:' + name));
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
const AMB_KEYS = [[0, 0], [0.2, 1], [11.8, 1], [12.2, 0.35], [59.8, 0.35], [60.2, 0.45], [63, 0.6], [65, 0.45], [71.3, 0.4], [71.4, 0], [72.6, 0], [73.2, 0.3], [84, 0.3], [88.5, 0.25], [89.9, 0]];
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

// ======================================================================= Mekong bossa-reggae instruments
const GTR = mkBus(), KIM = mkBus();
const T16 = (b0, k, sw = 0.5) => b0 + Math.floor(k / 2) * 0.3 + (k % 2 ? 0.3 * sw : 0);
const SWB = 0.53, SWR = 0.6;
const ADULT = { fs: 1.0, bw: 1.25 }, LADY = { fs: 1.16, bw: 1.35 };
const CHD = {
  G: { g: [54, 59, 62, 69], thumb: [43, 50], ub: 43, dub: 31, uke: [62, 67, 71, 74] },
  Em: { g: [55, 59, 62, 66], thumb: [40, 47], ub: 40, dub: 28, uke: [62, 64, 67, 71] },
  Am: { g: [55, 60, 64, 71], thumb: [45, 52], ub: 45, dub: 33, uke: [64, 67, 69, 72] },
  D7: { g: [54, 60, 64, 69], thumb: [38, 45], ub: 38, dub: 38, uke: [62, 66, 69, 72] },
  C: { g: [52, 55, 59, 64], thumb: [48, 43], ub: 36, dub: 36, uke: [64, 67, 71, 72] },
};
const LOOP = ['G', 'Em', 'Am', 'D7'];

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
// nylon guitar
function gtr(m, len, v = 0.7, seed = 0) {
  const L = q05(len);
  return memo(`gt${m}|${L}|${v}|${seed}`, () => {
    const y = ks(m2f(m), L + 0.15, { t60: 2.6, s: 0.5, bright: 0.2 + 0.25 * v, pos: 0.18 + 0.05 * seed, seed: m * 7 + seed });
    choke(y, L, 0.035); for (let i = 0; i < 48; i++) y[i] *= i / 48;
    return fadeEdges(y, 0.0005, 0.012);
  });
}
// ukulele (brighter, shorter)
function uke(m, len, v = 0.7) {
  const L = q05(len);
  return memo(`uk${m}|${L}|${v}`, () => {
    const y = ks(m2f(m), L + 0.08, { t60: 1.1, s: 0.42, bright: 0.5 + 0.3 * v, pos: 0.26, seed: m * 13 + 5 });
    choke(y, L, 0.02); for (let i = 0; i < 24; i++) y[i] *= i / 24;
    return fadeEdges(y, 0.0004, 0.008);
  });
}
// dan kim (moon lute): bright pluck, scoop-in bend from (m - sl), delayed vibrato
function kim(m, len, sl = 0) {
  const L = q05(len);
  return memo(`km${m}|${L}|${sl}`, () => {
    const f = (t) => m2f(m - sl * (1 - smooth((t - 0.02) / 0.12)) + 0.24 * Math.sin(TAU * 5.4 * t) * smooth((t - 0.26) / 0.3));
    const y = ks(f, L + 0.3, { t60: 1.7, s: 0.32, bright: 0.8, pos: 0.11, seed: m * 3 + sl });
    choke(y, L, 0.07); for (let i = 0; i < 20; i++) y[i] *= i / 20;
    return fadeEdges(y, 0.0003, 0.02);
  });
}
function pizz(m) {
  return memo('pz' + m, () => { const y = ks(m2f(m), 0.5, { t60: 0.38, s: 0.5, bright: 0.3, pos: 0.35, seed: m + 99 }); for (let i = 0; i < 60; i++) y[i] *= i / 60; return fadeEdges(y, 0.0005, 0.05); });
}
// upright bass (dark = reggae dub tone)
function ubass(m, len, o = {}) {
  const L = q05(len), dark = o.dark ? 1 : 0;
  return memo(`ub${m}|${L}|${dark}`, () => {
    const f = m2f(m), rel = 0.07, n = secs(L + rel), y = new Float32Array(n); let ph = 0;
    const h2 = dark ? 0.3 : 0.42, h3 = dark ? 0.1 : 0.2, h4 = dark ? 0.02 : 0.08;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += f * (1 + 0.012 * Math.exp(-t / 0.025)) / SR; ph -= Math.floor(ph);
      const p = TAU * ph, br = Math.exp(-t / 0.08);
      let e = Math.min(1, t / 0.005) * (0.55 + 0.45 * Math.exp(-t / 0.12)) * Math.exp(-t / (dark ? 2.2 : 1.4));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (Math.sin(p) + h2 * Math.sin(2 * p) + h3 * (0.4 + 0.6 * br) * Math.sin(3 * p) + h4 * br * Math.sin(4 * p)) * e;
    }
    for (let i = 0; i < n; i++) y[i] = Math.tanh(1.4 * y[i]) / Math.tanh(1.4);
    addInto(y, burst(rngFor('ubk' + m), 0.02, 'bp', 1100, 1.2, 0.005), 0, dark ? 0.06 : 0.14);
    return fadeEdges(y, 0.0005, 0.01);
  });
}
// steel pan
function steelPan(m) {
  return memo('pan' + m, () => {
    const f = m2f(m), y = modal([[f, 1, 0.9], [2 * f, 0.5, 0.55], [3.01 * f, 0.22, 0.35], [4 * f, 0.12, 0.25], [5.02 * f, 0.05, 0.15]], 1.6, 0.002);
    addInto(y, burst(rngFor('pm' + m), 0.012, 'lp', 1800, 0.7, 0.003), 0, 0.25);
    return scaleTo(y, 0.9);
  });
}
// legato line synth: 'sao' (bamboo flute with breath) or 'tpt' (muted trumpet). notes: [[tAbs, len, midi, scoop]]
function lineSynth(notes, kind, o = {}) {
  const NT = notes.map(([t, d, m, sl]) => ({ t, d, m, sl: sl || 0 }));
  const start = NT[0].t - 0.02, last = NT[NT.length - 1], end = last.t + last.d + 0.5;
  const n = secs(end - start), y = new Float32Array(n), R = rngFor('line:' + kind + start.toFixed(2));
  const sao = kind === 'sao', att = sao ? 0.05 : 0.035, rel = sao ? 0.15 : 0.1, vd = o.vib ?? (sao ? 0.2 : 0.13), GL = 0.045;
  const br = filt(noise(R, n), 'bp', sao ? 2600 : 1700, 0.7);
  const tab = sawTab(m2f(Math.max(...NT.map((x) => x.m)) + 1));
  const envOf = (nt, leg, tl) => { if (tl < 0) return 0; let e = leg ? 1 : Math.min(1, tl / att); if (sao && nt.d > 0.5) e *= 0.85 + 0.15 * smooth(tl / nt.d); if (tl > nt.d) e *= Math.max(0, 1 - (tl - nt.d) / rel); return e; };
  let ph = 0, ni = 0;
  for (let i = 0; i < n; i++) {
    const t = start + i / SR;
    while (ni < NT.length - 1 && t >= NT[ni + 1].t) ni++;
    const nt = NT[ni], pv = ni > 0 ? NT[ni - 1] : null, tl = t - nt.t;
    const leg = !!pv && nt.t - (pv.t + pv.d) < 0.06;
    let m = nt.m;
    if (leg && tl >= 0 && tl < GL) m = pv.m + (nt.m - pv.m) * smooth(tl / GL);
    if (nt.sl && tl >= 0) m -= nt.sl * (1 - smooth(tl / 0.12));
    m += vd * Math.sin(TAU * 5.2 * t) * smooth((tl - 0.2) / 0.3);
    let e = envOf(nt, leg, tl);
    if (pv && !leg) e = Math.max(e, envOf(pv, false, t - pv.t));
    const fr = m2f(m); ph += fr / SR; ph -= Math.floor(ph);
    if (sao) { const chiff = leg ? 0 : Math.exp(-Math.max(0, tl) / 0.04); y[i] = (Math.sin(TAU * ph) + 0.22 * Math.sin(2 * TAU * ph) + 0.06 * Math.sin(3 * TAU * ph)) * e + br[i] * e * (0.35 + 1.2 * chiff); }
    else y[i] = tabRead(tab, ph) * e + br[i] * e * 0.3;
  }
  let out;
  if (sao) out = filt(y, 'lp', 7000, 0.7);
  else { out = filt(y, 'bp', 1400, 0.9); addInto(out, filt(y, 'bp', 2700, 2), 0, 0.35); filtIn(out, 'lp', 4200, 0.7); }
  return { sig: fadeEdges(scaleTo(out, 1), 0.003, 0.05), t0: start };
}
function line(bus, notes, kind, o = {}) { const r = lineSynth(notes, kind, o); put(bus, r.t0, r.sig, { gain: o.g ?? 0.3, pan: o.pan ?? 0, hall: o.hall ?? 0.25, room: o.room ?? 0.05 }); }
const mel = (b0, arr, sw = SWB) => arr.map(([s, l, m, sl]) => [T16(b0, s, sw), l * 0.15 * 0.96, m, sl || 0]);
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
function rim(v = 0) {
  return memo('rim' + v, () => {
    const R = rngFor('rim' + v), y = modal([[1650 + v * 40, 1, 0.022], [2870, 0.45, 0.012], [480, 0.55, 0.03]], 0.12);
    addInto(y, burst(R, 0.01, 'bp', 3600, 1, 0.0025), 0, 0.5);
    return scaleTo(filtIn(y, 'hp', 250, 0.7), 1);
  });
}
function bongo(hi, v = 0) {
  return memo(`bgo${hi}${v}`, () => {
    const R = rngFor('bgo' + hi + v), f = hi ? 430 : 300, n = secs(0.25), y = new Float32Array(n); let ph = 0, ph2 = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, fr = f * (1 + 0.12 * Math.exp(-t / 0.012)); ph += fr / SR; ph2 += fr * 1.59 / SR; y[i] = (Math.sin(TAU * ph) + 0.3 * Math.sin(TAU * ph2) * Math.exp(-t / 0.03)) * Math.exp(-t / (hi ? 0.08 : 0.11)) * Math.min(1, t / 0.0008); }
    addInto(y, burst(R, 0.015, 'bp', 2500, 0.9, 0.003), 0, v ? 0.5 : 0.25);
    return scaleTo(fadeEdges(y, 0.0002, 0.02), 1);
  });
}
function chk(v) { return memo('chk' + (v % 4), () => scaleTo(burst(rngFor('chk' + (v % 4)), 0.035, 'bp', 2300, 0.9, 0.008), 1)); }

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

// ---- cartoon voices
function vAmerican(R) {
  return scaleTo(talk(R, [
    { d: 0.06, v: 'uh', f0: 180, f1: 190, a: 0.6, att: 0.01 }, { d: 0.04, v: 'u', f0: 190, a: 0.4 },
    { d: 0.12, v: 'e', f0: 230, f1: 255, a: 1 }, { d: 0.04, v: 'uh', f0: 240, a: 0.6 }, { d: 0.06, v: 'i', f0: 225, f1: 215, a: 0.7 },
    { d: 0.03, n: 'k', na: 0.4 }, { d: 0.08, v: 'uh', f0: 210, a: 0.7 }, { d: 0.04, v: 'u', f0: 200, a: 0.4, rel: 0.02 },
    { d: 0.04 }, { d: 0.09, n: 's', na: 0.5 }, { d: 0.28, v: 'a', v2: 'i', f0: 270, f1: 205, a: 1, rel: 0.06 }, { d: 0.07, n: 's', na: 0.25 },
  ], ADULT), 1);
}
const vWhoa = (R, f) => scaleTo(talk(R, [{ d: 0.06, v: 'u', v2: 'o', f0: f, f1: f * 1.05, a: 0.7, att: 0.015 }, { d: 0.26, v: 'o', v2: 'a', f0: f * 1.06, f1: f * 0.9, a: 1, rel: 0.09 }], ADULT), 1);
function vGotYou(R) {
  return scaleTo(talk(R, [
    { d: 0.2, v: 'a', v2: 'i', f0: 285, f1: 325, a: 1, att: 0.02, rel: 0.03 }, { d: 0.03 }, { d: 0.025, n: 'k', na: 0.35 },
    { d: 0.13, v: 'a', v2: 'o', f0: 345, f1: 335, a: 1, att: 0.008, rel: 0.02 }, { d: 0.05, n: 'sh', na: 0.45 }, { d: 0.22, v: 'u', f0: 360, f1: 275, a: 0.95, att: 0.01, rel: 0.08 },
  ], LADY), 1);
}
// several voices in near-unison -> stereo
function crowdSay(R, segFn, voices) {
  const n = secs(1.0), L = new Float32Array(n), Rr = new Float32Array(n);
  for (const [f, vo, p, dt] of voices) { const x = scaleTo(talk(R, segFn(f), vo), 1); addInto(L, x, secs(dt), Math.cos((p + 1) * Math.PI / 4)); addInto(Rr, x, secs(dt), Math.sin((p + 1) * Math.PI / 4)); }
  let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(Rr[i])); for (let i = 0; i < n; i++) { L[i] /= m; Rr[i] /= m; }
  return { L, R: Rr };
}
const COUNT_V = (k) => [[k, ADULT, -0.35, 0], [k * 1.12, ADULT, 0.3, 0.012], [k * 1.75, LADY, 0.05, 0.02]];
const segMot = (f) => [{ d: 0.04, v: 'u', f0: f * 0.95, a: 0.45, att: 0.01, rel: 0.01 }, { d: 0.14, v: 'o', f0: f, f1: f * 1.04, a: 1, att: 0.01, rel: 0.03 }, { d: 0.025, n: 't', na: 0.15 }];
const segHai = (f) => [{ d: 0.06, n: 'h', na: 0.35 }, { d: 0.2, v: 'a', v2: 'i', f0: f, f1: f * 1.05, a: 1, att: 0.015, rel: 0.06 }];
const segBa = (f) => [{ d: 0.02, v: 'u', f0: f * 0.9, a: 0.5, att: 0.003, rel: 0.005, br: 0.05 }, { d: 0.24, v: 'a', f0: f, f1: f * 1.08, a: 1, att: 0.006, rel: 0.08 }];
const segDzo = (f) => [{ d: 0.05, n: 's', na: 0.3 }, { d: 0.03, v: 'u', f0: f * 0.9, a: 0.6, att: 0.004, rel: 0.01 }, { d: 0.42, v: 'o', v2: 'oo', f0: f, f1: f * 1.18, a: 1, att: 0.01, rel: 0.14 }];
function cheerA(R, f0, kind) {
  if (kind === 0) return scaleTo(talk(R, [{ d: 0.08, v: 'i', v2: 'e', f0, f1: f0 * 1.05, a: 0.7 }, { d: 0.34, v: 'e', v2: 'a', f0: f0 * 1.05, f1: f0 * 0.85, a: 1, rel: 0.12 }], ADULT), 1);
  return scaleTo(talk(R, [{ d: 0.45, v: 'u', v2: 'oo', f0, f1: f0 * 1.3, a: 0.9, att: 0.03, rel: 0.15 }], LADY), 1);
}

// ======================================================================= arrangement helpers
function strum(bus, t, notes, len, v, o = {}) {
  const sp = o.spread ?? 0.011, ns = (o.dir ?? 1) > 0 ? notes : notes.slice().reverse();
  ns.forEach((m, k) => put(bus, t + k * sp, gtr(m, Math.max(0.05, len - k * sp), v, o.seed ?? (k % 2)), { gain: (o.g ?? 0.15) * (1 - 0.05 * k), pan: (o.pan ?? -0.25) + (k - 1.5) * 0.06, hall: o.hall ?? 0.1, room: o.room ?? 0.08 }));
}
function ukeStrum(t, ch, len, g, dir = 1) {
  const u = dir > 0 ? CHD[ch].uke : CHD[ch].uke.slice().reverse();
  u.forEach((m, k) => put(GTR, t + k * 0.006, uke(m, len, 0.8), { gain: g * (1 - 0.05 * k), pan: 0.35 + (k - 1.5) * 0.04, hall: 0.08, room: 0.08 }));
}
function bossaComp(b0, ch, k, o = {}) {
  const C = CHD[ch], g = o.g ?? 0.15;
  put(GTR, T16(b0, 0, SWB), gtr(C.thumb[0], 0.6, 0.6), { gain: g * 1.3, pan: -0.3, hall: 0.08, room: 0.08 });
  put(GTR, T16(b0, 8, SWB), gtr(C.thumb[1], 0.6, 0.6), { gain: g * 1.15, pan: -0.3, hall: 0.08, room: 0.08 });
  if (o.thumbOnly) return;
  for (const s of (k % 2 ? [2, 6, 9, 12] : [0, 3, 6, 10, 13])) strum(GTR, T16(b0, s, SWB), C.g, 0.26, s === 0 || s === 6 ? 0.8 : 0.62, { g, spread: 0.008 });
}
function arpBar(b0, ch, from = 0, g = 0.15) {
  const C = CHD[ch], seq = [[0, C.thumb[0], 2.3], [2, C.g[1], 1.4], [4, C.g[2], 1.2], [6, C.g[3], 1.0], [8, C.thumb[1], 1.0], [10, C.g[2], 0.9], [12, C.g[1], 0.8], [14, C.g[3], 0.6]];
  for (const [s, m, len] of seq) if (s >= from) put(GTR, T16(b0, s, SWB), gtr(m, len, 0.55, 1), { gain: g * (m < 52 ? 1.3 : 1), pan: -0.2 + (m - 55) * 0.012, hall: 0.15, room: 0.08 });
}
function bossaBass(b0, ch, g = 0.45) {
  const r = CHD[ch].ub, f5 = r + 7 > 50 ? r - 5 : r + 7;
  put(ML, b0, ubass(r, 0.85), { gain: g }); put(ML, b0 + 0.9, ubass(f5, 0.28), { gain: g * 0.75 });
  put(ML, b0 + 1.2, ubass(f5, 0.85), { gain: g * 0.9 }); put(ML, b0 + 2.1, ubass(r, 0.28), { gain: g * 0.75 });
}
function bossaDrums(b0, k, o = {}) {
  const lvl = o.lvl ?? 1, no = o.noShk || [0, 0];
  if (o.shaker !== false) for (let s = 0; s < 16; s++) { const t = T16(b0, s, SWB); if (t >= no[0] && t < no[1]) continue; put(MH, t, shaker(s % 4 === 2 ? 1 : 0, s), { gain: 0.075 * lvl * (s % 2 ? 0.7 : 1), pan: 0.35, room: 0.1 }); }
  if (o.rim !== false) for (const s of (k % 2 ? [2, 6, 9, 12] : [0, 3, 6, 10, 13])) put(MH, T16(b0, s, SWB), rim(s % 3), { gain: 0.15 * lvl, pan: -0.1, room: 0.15 });
  if (o.kick !== false) for (const s of [0, 6, 8, 14]) put(ML, T16(b0, s, SWB), kick(), { gain: (s % 8 === 0 ? 0.38 : 0.18) * lvl });
  if (o.bongo) for (const [s, hi] of [[3, 1], [4, 0], [7, 1], [11, 1], [12, 0], [14, 1]]) put(MH, T16(b0, s, SWB), bongo(hi, s % 2), { gain: 0.12 * lvl, pan: 0.2 - hi * 0.35, room: 0.15 });
}
function kimPhrase(b0, arr, g = 0.3, sw = SWB) { for (const [s, l, m, sl] of arr) put(KIM, T16(b0, s, sw), kim(m, l * 0.15 * 0.95, sl || 0), { gain: g, pan: 0.18, hall: 0.22, room: 0.06 }); }
function reggaeBar(b0, ch, o = {}) {
  const C = CHD[ch], r = C.dub, b7 = ch === 'G' || ch === 'C' ? 9 : 10, until = o.until ?? 999, dEnd = o.drumsUntil ?? 999, lvl = o.lvl ?? 1, from = o.from ?? 0;
  const at = (x) => { const beat = Math.floor(x / 0.6 + 1e-6), fr = x - beat * 0.6; return b0 + beat * 0.6 + (Math.abs(fr - 0.3) < 1e-6 ? 0.6 * SWR : fr); };
  const ok = (t) => t >= b0 + from - 1e-6 && t < until;
  if (o.bass !== false) for (const [x, iv, len] of [[0, 0, 0.5], [0.6, 0, 0.25], [0.9, 7, 0.25], [1.2, 12, 0.5], [1.8, b7, 0.25], [2.1, 7, 0.3]]) { const t = at(x); if (ok(t)) put(ML, t, ubass(r + iv, len, { dark: true }), { gain: 0.42 * lvl }); }
  for (let bt = 0; bt < 4; bt++) { const t = at(bt * 0.6 + 0.3); if (ok(t)) { ukeStrum(t, ch, 0.11, (o.skank ?? 0.2) * lvl); put(MH, t, chk(bt), { gain: 0.04 * lvl, pan: 0.3 }); } }
  for (let j = 0; j < 8; j++) { const t = at(j * 0.3); if (t < dEnd && ok(t)) put(MH, t, hat(false), { gain: (j % 2 ? 0.045 : 0.065) * lvl, pan: 0.25 }); }
  const t3 = b0 + 1.2;
  if (ok(t3)) { if (t3 < dEnd) put(ML, t3, kick(), { gain: 0.7 * lvl }); put(MH, t3, rim(1), { gain: (t3 < dEnd ? 0.2 : 0.12) * lvl, room: 0.2, pan: -0.1 }); }
  if (o.open && at(2.1) < dEnd && ok(at(2.1))) put(MH, at(2.1), hat(true), { gain: 0.045 * lvl, pan: 0.25 });
}

// ======================================================================= SCORE
// ---------- ambience bed (follows AMB_KEYS)
{
  const R = rngFor('amb');
  putAmb(0, waterLap(R, DUR), { gain: 0.6 });
  for (const [t, p] of [[0.8, -0.6], [2.9, 0.5], [4.2, -0.3], [6.0, 0.7], [8.4, -0.5], [10.1, 0.4], [14.5, 0.6], [20.3, -0.6], [26.8, 0.5], [33.0, -0.4], [39.5, 0.6], [45.2, -0.5], [52.7, 0.4], [58.4, -0.6], [73.5, 0.5], [76.9, -0.5], [81.7, 0.6], [82.6, -0.4], [84.6, 0.5]]) putAmb(t, birdCall(R), { gain: 0.07, pan: p, hall: 0.25 });
  putAmb(1.3, rooster(R), { gain: 0.11, pan: -0.55, hall: 0.45 });
  putAmb(7.6, rooster(R, 1.1), { gain: 0.055, pan: 0.7, hall: 0.5 });
  const mb = motorboat(R, 11.5, 7.2); for (let i = 0; i < mb.length; i++) { const t = i / SR; mb[i] *= smooth(t / 2.5) * (1 - smooth((t - 8.5) / 3)); }
  putAmb(0.2, mb, { gain: 0.07, pan: (t) => -0.7 + 1.3 * t / 11.5, hall: 0.2 });
  const mb2 = motorboat(R, 8, 6.5); for (let i = 0; i < mb2.length; i++) { const t = i / SR; mb2[i] *= smooth(t / 2) * (1 - smooth((t - 5) / 3)); }
  putAmb(26, mb2, { gain: 0.06, pan: (t) => 0.7 - 0.15 * t, hall: 0.2 });
}

// ---------- ACT I 0-12: river at dawn, solo nylon guitar, bass at 7.2, sniff 10.8
{
  const R = rngFor('act1');
  put(GTR, 0.5, gtr(43, 2.3, 0.55, 1), { gain: 0.2, pan: -0.25, hall: 0.15, room: 0.08 });
  arpBar(0, 'G', 4, 0.14);
  arpBar(2.4, 'Em', 0, 0.14);
  bossaComp(4.8, 'Am', 0, { g: 0.11 });
  bossaComp(7.2, 'C', 1, { g: 0.12 }); bossaBass(7.2, 'C', 0.45);
  bossaDrums(7.2, 1, { lvl: 0.45, rim: false, kick: false });
  bossaComp(9.6, 'D7', 0, { g: 0.13 }); bossaBass(9.6, 'D7', 0.5);
  bossaDrums(9.6, 0, { lvl: 0.7, kick: false });
  // kim greeting phrase over the Cmaj7/D7 bars
  kimPhrase(7.2, [[4, 2, 79], [6, 2, 81, 2], [8, 6, 83], [14, 2, 81]], 0.22);
  kimPhrase(9.6, [[0, 4, 79], [4, 2, 76], [6, 4, 74, 2]], 0.22);
  put(MH, 9.6, riser(R, 2.4, 300, 6000), { gain: 0.08 });
  put(MH, 10.6, reverseCrash(R, 1.4), { gain: 0.12, hall: 0.1 });
  put(SFX, 10.8, sniff(R), { gain: 0.38, pan: 0.05, room: 0.15 });
  for (const [t, hi] of [[11.4, 0], [11.55, 1], [11.7, 1], [11.775, 0], [11.85, 1]]) put(MH, t, bongo(hi, 1), { gain: 0.16, pan: 0.2 - hi * 0.35, room: 0.15 });
  [67, 69, 71, 74, 76, 79].forEach((m, k) => put(KIM, 11.58 + k * 0.065, kim(m, 0.1), { gain: 0.16 + k * 0.02, pan: 0.18, hall: 0.2 }));
}

// ---------- 12.0 title hit: charcoal flare + sizzle + full band
{
  const R = rngFor('title');
  put(SFX, 11.98, flare(R, 1.5), { gain: 0.4, room: 0.15 });
  put(SFX, 12.15, sizzle(R, 2.2), { gain: 0.22, pan: 0.1 });
  put(MH, 12, crash(R, 2.4), { gain: 0.2, hall: 0.25 });
  put(FX2, 12, bigBoom(R, 1.4, 90, 36, 0.45), { gain: 0.3 });
  put(ML, 12, kick(), { gain: 0.75 });
  strum(GTR, 12, CHD.G.g, 1.0, 1, { g: 0.2, spread: 0.014 });
  put(GTR, 12, gtr(43, 1.0, 0.9), { gain: 0.24, pan: -0.3 });
  put(MH, 12, ting(m2f(91), 1.2), { gain: 0.07, hall: 0.35, pan: 0.3 });
}

// ---------- ACT II 12-60: bossa (guitar + kim), then ukulele + sao
{
  for (let k = 0; k < 20; k++) {
    const b0 = 12 + 2.4 * k, ch = LOOP[k % 4], ukSec = k >= 12;
    if (k === 0) bossaComp(b0, ch, k, { g: 0.15, thumbOnly: true }), [3, 6, 10, 13].forEach((s) => strum(GTR, T16(b0, s, SWB), CHD.G.g, 0.26, 0.65, { g: 0.15, spread: 0.008 }));
    else if (k >= 12 && k < 16) bossaComp(b0, ch, k, { g: 0.1, thumbOnly: true });
    else bossaComp(b0, ch, k, { g: k >= 16 ? 0.13 : 0.15 });
    if (ukSec) for (let j = 0; j < 8; j++) { const ord = [0, 2, 1, 3, 0, 2, 1, 3]; put(GTR, T16(b0, j * 2, SWB), uke(CHD[ch].uke[ord[j]], 0.5, j % 4 === 0 ? 0.8 : 0.6), { gain: (k >= 16 ? 0.1 : 0.13) * (j % 2 ? 0.8 : 1), pan: 0.35, hall: 0.1, room: 0.08 }); }
    bossaBass(b0, ch, 0.43);
    bossaDrums(b0, k, { lvl: k < 4 ? 0.75 : k >= 16 ? 1.1 : 1, noShk: [17.4, 21.0], bongo: (k >= 8 && k < 12) || (k >= 16 && k < 19) });
  }
  // kim: after-hit lick, intro call, melody A (21.6-31.2), melody B (31.2-40.8)
  kimPhrase(12, [[4, 2, 86], [6, 2, 83], [8, 2, 81], [10, 2, 79], [12, 4, 76, 2]], 0.26);
  kimPhrase(16.8, [[8, 2, 76], [10, 2, 79], [12, 4, 81, 2]], 0.26);
  kimPhrase(19.2, [[0, 6, 79], [6, 2, 76], [8, 8, 74, 2]], 0.26);
  const A = [[[0, 3, 74], [3, 3, 76, 2], [6, 2, 79], [8, 6, 76], [14, 2, 74]], [[0, 4, 71, 2], [4, 2, 74], [6, 2, 71], [8, 8, 67]], [[0, 3, 76], [3, 3, 79], [6, 2, 81, 2], [8, 4, 79], [12, 4, 76]], [[0, 3, 74], [3, 3, 72, 2], [6, 4, 69], [10, 2, 67], [12, 4, 69]]];
  const B = [[[0, 2, 79], [2, 2, 81], [4, 4, 83, 2], [8, 2, 81], [10, 2, 79], [12, 4, 76]], [[0, 6, 79, 2], [6, 2, 76], [8, 4, 74], [12, 4, 71]], [[0, 2, 72], [2, 2, 76], [4, 4, 79], [8, 4, 84, 2], [12, 4, 81]], [[2, 2, 78, 2], [4, 4, 76], [8, 8, 74]]];
  for (let j = 0; j < 4; j++) kimPhrase(21.6 + 2.4 * j, A[j], 0.3);
  for (let j = 0; j < 4; j++) kimPhrase(31.2 + 2.4 * j, B[j], 0.3);
  kimPhrase(50.4, [[12, 2, 86], [14, 2, 83]], 0.2); kimPhrase(55.2, [[12, 2, 88], [14, 2, 86, 2]], 0.2);
  // sao melodies
  const S1 = [[[0, 6, 86], [6, 2, 83], [8, 8, 79]], [[0, 4, 81], [4, 4, 79], [8, 4, 76], [12, 4, 74]], [[0, 6, 76, 1], [6, 2, 79], [8, 6, 81], [14, 2, 83]], [[0, 8, 81], [8, 4, 78, 1], [12, 4, 74]]];
  const S2 = [[[0, 2, 79], [2, 2, 81], [4, 4, 83], [8, 4, 86, 1], [12, 4, 83]], [[0, 8, 88, 1], [8, 4, 86], [12, 4, 83]], [[0, 4, 84], [4, 4, 83], [8, 4, 81], [12, 4, 79]], [[0, 4, 81], [4, 4, 78], [8, 7, 74, 1]]];
  line(MH, S1.flatMap((bar, j) => mel(40.8 + 2.4 * j, bar)), 'sao', { g: 0.15, pan: -0.1, hall: 0.3 });
  line(MH, S2.flatMap((bar, j) => mel(50.4 + 2.4 * j, bar)), 'sao', { g: 0.16, pan: -0.1, hall: 0.3 });
  // build into 60
  const R = rngFor('build');
  for (let s = 8; s < 16; s++) put(MH, T16(57.6, s, SWB), bongo(s % 2, 1), { gain: 0.08 + 0.012 * (s - 8), pan: s % 2 ? -0.15 : 0.2, room: 0.15 });
  for (const s of [8, 12]) put(ML, T16(57.6, s, SWB), kick(), { gain: 0.5 });
  put(MH, 57.6, riser(R, 2.4, 250, 7000), { gain: 0.1 });
  put(MH, 58.8, reverseCrash(R, 1.2), { gain: 0.14 });
}

// ---------- ACT II foley 12-60
{
  const R = rngFor('act2');
  put(SFX, 17.4, sizzle(R, 6.8), { gain: 0.15, pan: 0.1, room: 0.1 });
  for (let t = 17.4, j = 0; t < 21.0; t += 0.6, j++) put(SFX, t - 0.13, fanSwish(R), { gain: 0.2, pan: j % 2 ? 0.25 : -0.25, room: 0.12 });
  put(SFX, 21.55, drip(R), { gain: 0.2 });
  put(SFX, 21.6, flare(R, 1.3), { gain: 0.4, room: 0.15 });
  put(SFX, 24.6, woodThunk(R, 150), { gain: 0.5, room: 0.2, pan: -0.2 });
  put(SFX, 24.62, splash(R, 0.5), { gain: 0.22, pan: -0.35, room: 0.1 });
  put(SFX, 24.7, tick(R, 2600), { gain: 0.25, pan: -0.2 });
  put(SFX, 28.2, splash(R, 0.3), { gain: 0.32, pan: 0.1, room: 0.2 });
  for (let t = 30.6, j = 0; t < 34.2; t += 0.6, j++) put(SFX, t, herbTuk(R), { gain: 0.32, pan: j % 2 ? 0.2 : -0.1, room: 0.1 });
  put(SFX, 38.4, crack(R), { gain: 0.55, room: 0.15 });
  put(SFX, 41.4, steamHiss(R, 1.5), { gain: 0.16, room: 0.15, pan: 0.15 });
  for (let t = 44.0, j = 0; t < 47.0; t += 0.6, j++) { put(SFX, t, squeak(R, 1250 + 120 * (j % 3)), { gain: 0.16, pan: 0.1 }); put(SFX, t + 0.3, pat(R), { gain: 0.3, pan: -0.05, room: 0.1 }); }
  for (const t of [47.4, 47.78, 48.15, 48.55]) put(SFX, t, glug(R), { gain: 0.4, pan: 0.15, room: 0.12 });
  sparkleAt(48.0, R, 0.07, [86, 91, 95, 98, 103]);
  put(SFX, 51.0, peanutRattle(R), { gain: 0.35, pan: -0.1, room: 0.12 });
  put(SFX, 55.2, knifeCrunch(R), { gain: 0.5, room: 0.12 });
  sparkleAt(56.0, R, 0.07, [98, 95, 100, 103, 107]);
  put(SFX, 58.0, handOver(R), { gain: 0.4, pan: 0.2, room: 0.12 });
}

// ---------- ACT III 60-84: reggae, comedy, silence, bite, cheers
{
  const R = rngFor('act3');
  put(MH, 60, crash(R, 2.4), { gain: 0.26, hall: 0.25 }); put(FX2, 60, bigBoom(R, 1.4, 90, 34, 0.45), { gain: 0.32 }); put(ML, 60, kick(), { gain: 0.95 });
  strum(GTR, 60, CHD.G.g, 1.0, 1, { g: 0.17, spread: 0.012 }); ukeStrum(60, 'G', 0.6, 0.2);
  reggaeBar(60, 'G', { from: 0.6, open: true }); put(ML, 60, ubass(31, 0.5, { dark: true }), { gain: 0.55 });
  reggaeBar(62.4, 'Em', { open: true });
  reggaeBar(64.8, 'Am', { drumsUntil: 66.0 });
  reggaeBar(67.2, 'D7', { drumsUntil: 0, until: 69.0, lvl: 0.75 });
  kimPhrase(60, [[2, 1, 74], [3, 1, 76], [4, 2, 79], [6, 2, 81, 2]], 0.24, SWR);
  kimPhrase(62.4, [[10, 2, 79], [12, 4, 76, 2]], 0.2, SWR);
  // 61 "American size!" + boing
  put(SFX, 61.0, vAmerican(R), { gain: 0.48, pan: -0.1, room: 0.15 });
  put(SFX, 62.0, boing(), { gain: 0.32, pan: 0.15, room: 0.1 });
  // 63-64.5 motorboat whoosh + big wave slosh
  put(SFX, 62.9, boatPass(R, 1.8), { gain: 0.42, pan: (t) => -0.8 + 1.6 * t / 1.8, room: 0.1 });
  put(SFX, 63.85, splash(R, 1.6), { gain: 0.5, room: 0.2, pan: 0.1 });
  // 64-66 whoa x3 + rising slide-whistle swoops
  [[64.0, 180, 72, 79], [64.6, 215, 76, 84], [65.2, 258, 79, 91]].forEach(([t, f, m0, m1], j) => {
    put(SFX, t, vWhoa(R, f), { gain: 0.42, pan: -0.15, room: 0.12 });
    put(SFX, t, slideWhistle(R, j === 2 ? 0.7 : 0.45, m0, m1), { gain: 0.14, pan: 0.25, hall: 0.12 });
  });
  // 66-69 beo pole creak + bamboo rattle, co Ut "I got you!"
  put(SFX, 66.0, creak(R, 1.3, 480), { gain: 0.3, pan: 0.3, room: 0.15 });
  put(SFX, 67.0, creak(R, 0.9, 560), { gain: 0.26, pan: 0.35, room: 0.15 });
  put(SFX, 66.2, bambooRattle(R, 2.6, 14), { gain: 0.22, pan: 0.2, room: 0.15 });
  put(SFX, 67.5, vGotYou(R), { gain: 0.48, pan: 0.2, room: 0.15 });
  // 69-71.4 pizzicato tiptoe
  [50, 57, 54, 62, 57, 66, 62, 69].forEach((m, j) => { put(MH, 69.0 + j * 0.3, pizz(m), { gain: 0.32, pan: j % 2 ? 0.25 : -0.25, room: 0.15, hall: 0.05 }); put(MH, 69.0 + j * 0.3, rim(2), { gain: 0.03, pan: 0 }); });
  // 71.4-72.0 total silence (gated in the master) -- 72.0 bite crunch + big chord + trumpet
  put(SFX, 72.0, crunch(R, 0.42, 900), { gain: 0.7, room: 0.15 });
  put(SFX, 72.24, crunch(R, 0.25, 1200), { gain: 0.4, room: 0.12 });
  put(MH, 72.0, crash(R, 2.6), { gain: 0.26, hall: 0.3 }); put(FX2, 72.0, bigBoom(R, 1.6, 95, 33, 0.55), { gain: 0.35 }); put(ML, 72.0, kick(), { gain: 1 });
  strum(GTR, 72.0, CHD.G.g, 1.6, 1, { g: 0.2, spread: 0.012 }); put(GTR, 72.0, gtr(43, 1.6, 0.9), { gain: 0.22, pan: -0.3 });
  ukeStrum(72.0, 'G', 1.0, 0.18); put(ML, 72.0, ubass(31, 0.5, { dark: true }), { gain: 0.55 });
  put(KIM, 72.0, kim(86, 1.2), { gain: 0.2, pan: 0.18, hall: 0.25 });
  reggaeBar(72.0, 'G', { from: 0.6, open: true });
  reggaeBar(74.4, 'Em', { open: true });
  reggaeBar(76.8, 'Am', { until: 78.55 });
  const TPT = [[[2, 2, 74], [4, 2, 79], [6, 6, 83, 1], [12, 2, 81], [14, 2, 79]], [[0, 4, 76], [4, 2, 79], [6, 2, 76], [8, 6, 74, 1], [14, 2, 71]], [[0, 2, 72], [2, 2, 74], [4, 4, 76], [8, 2, 79], [10, 3, 81, 1]]];
  line(MH, TPT.flatMap((bar, j) => mel(72.0 + 2.4 * j, bar, 0.55)), 'tpt', { g: 0.2, pan: 0.12, hall: 0.3 });
  // 75.6 oar thunk
  put(SFX, 75.6, woodThunk(R, 120), { gain: 0.42, pan: -0.25, room: 0.2 }); put(SFX, 75.66, splash(R, 0.4), { gain: 0.2, pan: -0.3 });
  // 78.6 / 79.2 / 79.8 "Mot, hai, ba" with stop-time stabs
  [[78.6, segMot, 170, 'Am'], [79.2, segHai, 190, 'D7'], [79.8, segBa, 215, 'D7']].forEach(([t, seg, f, ch], j) => {
    put(SFX, t, crowdSay(R, seg, COUNT_V(f)), { gain: 0.45, room: 0.15 });
    strum(GTR, t, CHD[ch].g, 0.22, 0.85, { g: 0.13 + j * 0.02, spread: 0.006 }); ukeStrum(t, ch, 0.15, 0.13 + j * 0.02);
    put(ML, t, kick(), { gain: 0.6 + j * 0.1 }); put(ML, t, ubass(CHD[ch].dub + 12, 0.25, { dark: true }), { gain: 0.6 });
  });
  for (let k = 0; k < 8; k++) put(MH, 79.98 + k * 0.05, bongo(k % 2, 1), { gain: 0.06 + 0.015 * k, pan: k % 2 ? -0.2 : 0.2, room: 0.15 });
  // 80.4 DZO! crowd + cheer + glass clinks
  put(SFX, 80.4, crowdSay(R, segDzo, [[200, ADULT, -0.45, 0], [235, ADULT, 0.4, 0.012], [340, LADY, -0.1, 0.02], [215, ADULT, 0.65, 0.03]]), { gain: 0.5, room: 0.2, hall: 0.1 });
  put(SFX, 80.55, applause(R, 2.4, 200), { gain: 0.2, room: 0.2, hall: 0.12 });
  [[80.9, 300, 0, -0.5], [81.05, 420, 1, 0.45], [81.4, 260, 0, 0.15]].forEach(([t, f, kind, p]) => put(SFX, t, cheerA(R, f, kind), { gain: 0.14, pan: p, room: 0.2, hall: 0.12 }));
  [[80.5, 2500, -0.3], [80.56, 2900, 0.3], [80.68, 2200, 0], [80.8, 3200, 0.45]].forEach(([t, f, p]) => put(SFX, t, iceClink(R, f), { gain: 0.16, pan: p, room: 0.15 }));
  put(MH, 80.4, crash(R, 1.8), { gain: 0.2, hall: 0.25 }); put(ML, 80.4, kick(), { gain: 0.9 });
  strum(GTR, 80.4, CHD.D7.g, 0.5, 0.9, { g: 0.15 });
  reggaeBar(79.2, 'D7', { from: 1.2, open: true });
  // 81.6 wide sunrise outro on G, 82.2 end-card sting
  strum(GTR, 81.6, CHD.G.g, 2.4, 0.8, { g: 0.17, spread: 0.035 }); put(GTR, 81.6, gtr(43, 2.4, 0.7), { gain: 0.22, pan: -0.3, hall: 0.15 });
  put(ML, 81.6, ubass(43, 2.1), { gain: 0.55 }); put(ML, 81.6, kick(), { gain: 0.6 });
  put(MH, 81.6, crash(R, 2.4), { gain: 0.12, hall: 0.3 });
  line(MH, [[81.6, 2.1, 83, 1]], 'sao', { g: 0.15, pan: -0.1, hall: 0.35 });
  line(MH, [[81.62, 1.9, 79, 1]], 'tpt', { g: 0.14, pan: 0.15, hall: 0.35 });
  [74, 76, 79, 83, 86].forEach((m, k) => put(KIM, 82.2 + k * 0.06, kim(m, k === 4 ? 1.0 : 0.12), { gain: 0.18 + 0.02 * k, pan: 0.18, hall: 0.25 }));
  sparkleAt(82.2, R, 0.08, [91, 95, 98, 103]);
  put(FX2, 82.2, bigBoom(R, 1.2, 80, 38, 0.4), { gain: 0.22 });
}

// ---------- CTA 84-90: steel-pan plink on the heart, kim glissando on FOLLOW, final chord
{
  const R = rngFor('cta');
  for (const [b0, ch] of [[84, 'Em'], [85.2, 'Am'], [86.4, 'D7'], [87.6, 'G']]) {
    const last = ch === 'G', C = CHD[ch];
    strum(GTR, b0, C.g, last ? 2.2 : 0.42, 0.75, { g: 0.14, spread: last ? 0.03 : 0.009 });
    if (!last) { strum(GTR, b0 + 0.45, C.g, 0.25, 0.6, { g: 0.11, spread: 0.007 }); strum(GTR, b0 + 0.9, C.g, 0.28, 0.62, { g: 0.11, spread: 0.007 }); }
    put(GTR, b0, gtr(C.thumb[0], last ? 2.2 : 1.1, 0.6), { gain: 0.19, pan: -0.3 });
    put(ML, b0, ubass(C.ub, last ? 2.0 : 1.0), { gain: 0.5 });
    if (!last) put(ML, b0 + 0.9, ubass(C.ub + 7 > 50 ? C.ub - 5 : C.ub + 7, 0.25), { gain: 0.4 });
    for (let s = 0; s < (last ? 4 : 8); s++) put(MH, T16(b0, s, SWB), shaker(s % 4 === 2 ? 1 : 0, s), { gain: 0.06 * (s % 2 ? 0.7 : 1), pan: 0.35, room: 0.1 });
    if (!last) put(MH, T16(b0, 3, SWB), rim(0), { gain: 0.1, pan: -0.1, room: 0.15 });
  }
  for (let t = 85.2; t < 89.0; t += 0.6) put(FX2, t, heartThump(), { gain: 0.36 });
  put(SFX, 85.15, uiClick(R), { gain: 0.32, pan: 0.1 });
  [[85.2, 79], [85.29, 83], [85.38, 86], [85.5, 91]].forEach(([t, m], k) => put(MH, t, steelPan(m), { gain: 0.22 - 0.02 * k, pan: 0.3 - 0.15 * k, hall: 0.22, room: 0.05 }));
  put(MH, 86.4, ting(m2f(98), 0.8), { gain: 0.06, hall: 0.35 }); put(MH, 86.4, crash(R, 1.4), { gain: 0.08, hall: 0.25 });
  put(SFX, 86.95, uiClick(R), { gain: 0.32, pan: 0.1 });
  [67, 69, 71, 74, 76, 79, 81, 83, 86].forEach((m, k) => put(KIM, 87.0 + k * 0.045, kim(m, k === 8 ? 0.7 : 0.1), { gain: 0.15 + 0.012 * k, pan: -0.2 + 0.05 * k, hall: 0.25 }));
  put(MH, 87.6, steelPan(79), { gain: 0.16, pan: 0.25, hall: 0.3 }); put(MH, 87.75, steelPan(86), { gain: 0.11, pan: -0.25, hall: 0.3 });
  line(MH, [[87.6, 1.6, 83, 1]], 'sao', { g: 0.12, pan: -0.1, hall: 0.35 });
  put(ML, 87.6, kick(), { gain: 0.45 });
}
console.log('score placed', ((Date.now() - T_START) / 1000).toFixed(1) + 's');

// ---------- instrument bus voicing -> MH
for (const ch of ['L', 'R']) {
  const g = GTR[ch], k = KIM[ch];
  filtIn(g, 'hp', 65, 0.7); filtIn(g, 'peak', 190, 1.1, 2.5); filtIn(g, 'peak', 2600, 0.9, -2); filtIn(g, 'lp', 7000, 0.7);
  filtIn(k, 'hp', 220, 0.7); filtIn(k, 'peak', 1250, 1.2, 5); filtIn(k, 'peak', 3200, 1.5, 2); filtIn(k, 'lp', 7500, 0.7);
  const m = MH[ch]; for (let i = 0; i < N; i++) m[i] += 1.4 * g[i] + 1.7 * k[i];
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
// soft water lapping in the hush (after the limiter, fixed level: RMS -46 dBFS over 71.45-71.95)
{
  const R = rngFor('hushwater'), w = waterLap(R, 3.0), w0 = Math.round(70.6 * SR);
  const env = (t) => smooth((t - 70.9) / 0.5) * (1 - smooth((t - 72.1) / 1.0));
  let ss = 0, cnt = 0; const a = Math.round(71.45 * SR), b = Math.round(71.95 * SR);
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
  const W = [['intro', 0.3, 12], ['A', 12, 24], ['B', 24, 36], ['C', 36, 48], ['D', 48, 60], ['E', 60, 66], ['F', 66, 71.4], ['hush', 71.45, 71.95], ['burst', 72.0, 72.5], ['J', 72.6, 84], ['CTA', 84, 88]];
  console.log('section RMS: ' + W.map(([k, a, b]) => `${k} ${rms(a, b).toFixed(1)}`).join(' | '));
  // GR hot spots
  const hot = []; for (let s = 0; s < 90; s += 0.5) { let m = 1; for (let i = Math.round(s * SR); i < Math.round((s + 0.5) * SR); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -3 / 20)) hot.push(`${s.toFixed(1)}(${(-dbf(m)).toFixed(1)})`); }
  console.log('GR > 3 dB at: ' + (hot.join(' ') || 'none'));
  const hush = rms(71.45, 71.95), burstR = rms(72.0, 72.5);
  const checks = [
    ['format 48k/2ch/16-bit/90.000 s', ch === 2 && sr === 48000 && bits === 16 && n === N],
    [`loudness -15 +-0.5 (${lu.integ.toFixed(2)})`, Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    [`true peak <= -1.45 dBTP (${dbf(tp).toFixed(2)})`, dbf(tp) <= -1.45],
    ['no clipping', clipped === 0],
    [`hush RMS in [-70,-38] (${hush.toFixed(1)})`, hush >= -70 && hush <= -38],
    [`burst 72.0-72.5 > -30 dBFS (${burstR.toFixed(1)})`, burstR > -30],
    ['tail digital zero', tailZero],
    [`limiter GR <= 6 dB (${grDb.toFixed(2)})`, grDb <= 6],
  ];
  let ok = true; for (const [k, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + k); if (!v) ok = false; }
  console.log(`run time ${((Date.now() - T_START) / 1000).toFixed(1)} s`);
  if (!ok) process.exitCode = 1;
}
