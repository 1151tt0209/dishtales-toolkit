'use strict';
// Banh xeo mien Tay - soundtrack. "Mekong gypsy jazz" (swing manouche), 125 BPM, swung 8ths (64%), D minor (Dm6 / Gm6 / A7 / Bb7).
// Everything synthesised in code: la-pompe rhythm guitars (Karplus-Strong, bass pluck on 1&3, choked chord upstroke on 2&4),
// upright bass (2-feel -> walking), brush snare swish + taps, finger snaps, warm clarinet (odd-harmonic reed, vibrato, breath),
// dan kim moon lute (nasal KS, Southern scoops / nhan bends / rung vibrato, vong co licks), violin answers + pizzicato,
// kitchen foley used as percussion (XEEO sizzle on the backbeat, spatula = rimshot, lid clank = crash, knife chops on the beat),
// fire-crackle bed in the kitchen, dusk river ambience (water lapping, birds, crickets) outside, ducks, formant "hey!" ad-libs.
// Output: audio.wav 48 kHz / stereo / 16-bit / 69.6 s, ~-15 LUFS, TP <= -1.5 dBTP.
const fs = require('fs'), path = require('path');
const T_START = Date.now();
console.time('render');
const SR = 48000, DUR = 69.6, N = Math.round(SR * DUR), TAU = Math.PI * 2;
const BEAT = 0.48, BAR = 1.92, SWING = 0.64, SW = BEAT * SWING;
const TARGET_LUFS = -15, CEIL_DBTP = -1.65;
const S0 = 51.84, S1 = 52.8, FADE0 = 69.12, FADE1 = 69.6;
const I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);
// ======================================================================= generic helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const rngFor = (name) => mulberry32(hashStr('banhxeo:' + name));
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
const AMB_KEYS = [[0, 0], [0.15, 1], [6.5, 1], [6.9, 0.25], [31.4, 0.25], [31.9, 0.75], [40.1, 0.75], [40.5, 0.3], [49.6, 0.3], [50.0, 1], [51.84, 0.8], [51.85, 0], [52.8, 0], [53.3, 0.3], [60.3, 0.35], [60.8, 0.8], [69.3, 0.5], [69.6, 0]];
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
// ======================================================================= Mekong gypsy-jazz instruments
const GTR = mkBus(), CLA = mkBus(), KIM = mkBus(), VIO = mkBus();
const FIRE_KEYS = [[0, 0], [4.7, 0], [4.9, 0.6], [6.0, 0.25], [6.6, 0.25], [6.9, 1], [31.4, 1], [31.9, 0], [40.2, 0], [40.6, 0.7], [49.6, 0.7], [50.0, 0]];
const fireEnv = (t) => pw(FIRE_KEYS, t);
const CH = {
  Dm6: { root: 38, gb: [50, 45], v: [50, 57, 59, 65], tones: [38, 41, 45, 47] },
  Gm6: { root: 43, gb: [43, 50], v: [50, 55, 58, 64], tones: [43, 46, 50, 52] },
  A7: { root: 45, gb: [45, 52], v: [52, 57, 61, 67], tones: [45, 49, 52, 43] },
  Bb7: { root: 46, gb: [46, 53], v: [53, 58, 62, 68], tones: [46, 50, 53, 44] },
  Dm69: { root: 38, gb: [50, 45], v: [50, 57, 59, 64, 65, 69], tones: [38, 45, 50, 47] },
};
const CHT = [];
function plan(t0, s) { let t = t0; for (const tok of s.split(' ')) { const [nm, b] = tok.split(':'); CHT.push([t, nm]); t += (+b) * BEAT; } return t; }
plan(0, 'Dm6:8 Gm6:4 A7:6');            // 0 - 8.64 intro
plan(8.64, 'Dm6:8 Gm6:4 A7:4');         // title motif + answer -> 16.32
plan(16.32, 'Dm6:4 Gm6:2 A7:2');        // -> 20.16
plan(20.16, 'Dm6:2 A7:2');              // stop-time break -> 22.08
plan(22.08, 'Dm6:4 Gm6:4 Bb7:2 A7:4');  // kim / violin call-and-response -> 28.8
plan(28.8, 'Dm6:4 A7:2');               // plate -> 31.68
plan(31.68, 'Dm6:8 Gm6:4 A7:6');        // garden -> 40.32
plan(40.32, 'Dm6:4 A7:4');              // act III playful -> 44.16
plan(44.16, 'Dm6:2 Gm6:2 A7:2');        // eruption break -> 47.04
plan(47.04, 'Bb7:4 A7:6');              // slow-mo flip + flight -> 51.84
plan(52.8, 'Dm6:4 Gm6:2 A7:2');         // catch -> 56.64
plan(56.64, 'Dm6:4 Bb7:2 A7:2');        // bite -> 60.48
plan(60.48, 'Dm6:8 A7:1');              // end card -> 64.8
plan(64.8, 'Gm6:2 A7:2 Bb7:1 A7:1 Dm69:12'); // CTA -> end
function chordAt(t) { let c = CHT[0][1]; for (const [s, nm] of CHT) { if (t >= s - 1e-6) c = nm; else break; } return c; }
const pos8 = (t0, p) => t0 + Math.floor(p / 2) * BEAT + (p % 2) * SW;

// ---- rhythm guitar: single bass-note pluck, la pompe chord (up = upstroke, high string first), choked short
function gnote(m, len, seed = 0) {
  const L = q05(len);
  return memo(`gn${m}|${L}|${seed}`, () => {
    const y = ks(m2f(m), L + 0.15, { t60: 1.1, s: 0.42, bright: 0.55, pos: 0.16, seed: 1000 + m * 7 + seed });
    choke(y, L, 0.05);
    return scaleTo(fadeEdges(y, 0.0003, 0.02), 1);
  });
}
function pompe(name, seed = 0, up = true, len = 0.13) {
  return memo(`pp${name}|${seed}|${up}|${len}`, () => {
    const v = CH[name].v, R = rngFor('pp' + name + seed + up + len), n = secs(len + 0.14), y = new Float32Array(n);
    const order = up ? [...v].reverse() : v;
    order.forEach((m, k) => {
      const s = ks(m2f(m), len + 0.12, { t60: len > 0.4 ? 2.2 : 0.9, s: 0.35, bright: 0.8, pos: 0.12, seed: 2000 + m * 13 + seed * 5 + k });
      choke(s, Math.max(0.02, len - k * 0.004), len > 0.4 ? 0.2 : 0.025);
      addInto(y, scaleTo(s, 1), secs(k * (up ? 0.0045 : 0.007)), 0.8 + 0.2 * R());
    });
    addInto(y, scaleTo(burst(R, 0.03, 'bp', 2600, 0.8, 0.007), 1), 0, 0.45);
    return scaleTo(fadeEdges(y, 0.0003, 0.02), 1);
  });
}
// ---- upright bass: round sine body, finger thump, short string slap
function ubass(m, len) {
  const L = q05(len);
  return memo(`ub${m}|${L}`, () => {
    const f = m2f(m), rel = 0.07, n = secs(L + rel), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += f * (1 + 0.012 * Math.exp(-t / 0.015)) / SR; ph -= Math.floor(ph);
      const p = TAU * ph, br = Math.exp(-t / 0.09);
      let e = Math.min(1, t / 0.005) * (0.55 + 0.45 * Math.exp(-t / 0.12)) * Math.exp(-t / 0.9);
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (Math.sin(p) + 0.42 * Math.sin(2 * p) + 0.2 * br * Math.sin(3 * p) + 0.08 * br * Math.sin(4 * p)) * e;
    }
    addInto(y, burst(rngFor('ubk' + m), 0.03, 'lp', 600, 0.7, 0.01), 0, 0.3);
    addInto(y, burst(rngFor('ubs' + m), 0.012, 'bp', 1500, 1, 0.003), 0, 0.07);
    return fadeEdges(y, 0.0005, 0.01);
  });
}
// ---- brushes, snaps, rimshot, toms
function brushSwish(dur) {
  const L = q05(dur);
  return memo('bsw' + L, () => {
    const n = secs(L), x = filt(filt(noise(rngFor('bsw' + L), n), 'bp', 4200, 0.6), 'hp', 1500, 0.7);
    for (let i = 0; i < n; i++) { const u = i / n; x[i] *= Math.pow(Math.sin(Math.PI * u), 1.3) * (0.75 + 0.25 * Math.sin(TAU * 2 * u)); }
    return scaleTo(fadeEdges(x, 0.005, 0.01), 1);
  });
}
function brushTap(v = 0) {
  return memo('btp' + v, () => {
    const R = rngFor('btp' + v), y = burst(R, 0.12, 'bp', 3600, 0.7, 0.03, 0.002);
    addInto(y, modal([[205, 0.5, 0.035], [340, 0.3, 0.025]], 0.1), 0, 0.5);
    addInto(y, filtIn(burst(R, 0.09, 'hp', 2500, 0.7, 0.04, 0.006), 'lp', 9000, 0.7), 0, 0.5);
    return scaleTo(y, 1);
  });
}
function snap(v = 0) {
  return memo('snp' + v, () => {
    const R = rngFor('snp' + v), y = scaleTo(burst(R, 0.06, 'bp', 2100 + v * 90, 2.2, 0.011, 0.0003), 1);
    addInto(y, scaleTo(burst(R, 0.008, 'hp', 5000, 0.7, 0.0018), 1), 0, 0.5);
    addInto(y, modal([[1350 + v * 40, 0.5, 0.012]], 0.04), 0, 0.5);
    return scaleTo(y, 1);
  });
}
function rimshot() { return memo('rim', () => { const y = scaleTo(snare(2), 0.6); addInto(y, modal([[950, 1, 0.025], [1900, 0.6, 0.014], [3400, 0.4, 0.009]], 0.1), 0, 0.7); return scaleTo(y, 1); }); }
function tom(f) { return memo('tom' + f, () => { const n = secs(0.5), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += f * (1 + 0.35 * Math.exp(-t / 0.03)) / SR; y[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.16) * Math.min(1, t / 0.001); } addInto(y, burst(rngFor('tm' + f), 0.03, 'bp', 1800, 0.8, 0.006), 0, 0.3); return scaleTo(fadeEdges(y, 0.0002, 0.03), 1); }); }
// ---- clarinet: odd-harmonic reed table, scoop or long glissando (gl semitones below), 5.3 Hz vibrato, breath noise
const TAB_CLA = makeTable([1, 0.05, 0.6, 0.04, 0.34, 0.03, 0.2, 0.02, 0.11, 0.01, 0.06, 0, 0.035, 0, 0.02]);
const TAB_CLA_HI = makeTable([1, 0.08, 0.45, 0.05, 0.2, 0.03, 0.08]);
function clar(m, len, o = {}) {
  const L = q05(len), gl = o.gl || 0, vib = o.vib ?? 1, sq = o.sq || 0;
  return memo(`cla${m}|${L}|${gl}|${vib}|${sq}`, () => {
    const R = rngFor('cla' + m + '|' + gl + '|' + L), rel = 0.07, n = secs(L + rel), y = new Float32Array(n);
    const br = filt(noise(R, n), 'bp', 1900, 0.9); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let mm = gl ? m + gl * (1 - smooth(t / Math.max(0.06, L * 0.75))) : m - 0.4 * (1 - smooth(t / 0.045));
      mm += vib * 0.16 * Math.sin(TAU * (sq ? 8 : 5.3) * t) * smooth((t - 0.14) / 0.3);
      const f = m2f(mm); ph += f / SR; ph -= Math.floor(ph);
      let e = smooth(t / 0.035) * (0.85 + 0.15 * Math.exp(-t / 0.1));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (tabRead(f > 850 ? TAB_CLA_HI : TAB_CLA, ph) + br[i] * (0.05 + 0.3 * Math.exp(-t / 0.05))) * e;
    }
    filtIn(y, 'lp', sq ? 8000 : 4300, 0.7); filtIn(y, 'peak', 1500, 1, 2);
    if (sq) for (let i = 0; i < n; i++) y[i] = Math.tanh(2.2 * y[i]);
    return scaleTo(fadeEdges(y, 0.001, 0.01), 1);
  });
}
// ---- dan kim (moon lute): nasal KS plucked near the bridge; sl = scoop from below, bd = nhan press-bend, vb = rung vibrato depth
function kim(m, len, o = {}) {
  const L = q05(len), sl = o.sl || 0, bd = o.bd || 0, vb = o.vb ?? 0.35;
  return memo(`km${m}|${L}|${sl}|${bd}|${vb}`, () => {
    const pk = Math.min(0.2, L * 0.35);
    const f = (t) => m2f(m - sl * (1 - smooth((t - 0.01) / 0.07)) + bd * smooth((t - pk) / 0.06) * (1 - smooth((t - pk - 0.14) / 0.08)) + vb * Math.sin(TAU * 5.6 * t) * smooth((t - 0.15) / 0.2));
    const y = ks(f, L + 0.3, { t60: 1.8, s: 0.25, bright: 0.9, pos: 0.07, seed: 3000 + m * 3 + sl * 11 + bd * 5 });
    choke(y, L, 0.07); for (let i = 0; i < 24; i++) y[i] *= i / 24;
    addInto(y, burst(rngFor('kmp' + m), 0.008, 'hp', 2500, 0.7, 0.0015), 0, 0.12);
    return scaleTo(fadeEdges(y, 0.0003, 0.02), 1);
  });
}
// ---- violin: 2 detuned saws, bowed attack, delayed vibrato, body resonances; pizz = short KS
function violin(m, len, o = {}) {
  const L = q05(len), sl = o.sl || 0;
  if (o.pizz) return memo(`vpz${m}`, () => { const y = ks(m2f(m), 0.45, { t60: 0.35, s: 0.5, bright: 0.45, pos: 0.3, seed: 4000 + m }); const z = filt(y, 'bp', 900, 0.6); addInto(z, y, 0, 0.4); return scaleTo(fadeEdges(z, 0.0005, 0.03), 1); });
  return memo(`vio${m}|${L}|${sl}`, () => {
    const R = rngFor('vio' + m + L), rel = 0.09, n = secs(L + rel), y = new Float32Array(n), bow = filt(noise(R, n), 'bp', 3000, 0.8);
    const ph = [R(), R()], det = [1, 1.004];
    for (let i = 0; i < n; i++) {
      const t = i / SR, mm = m - sl * (1 - smooth(t / 0.09)) + 0.2 * Math.sin(TAU * 5.8 * t) * smooth((t - 0.2) / 0.35);
      const f = m2f(mm), tab = sawTab(f); let s = 0;
      for (let k = 0; k < 2; k++) { ph[k] += f * det[k] / SR; ph[k] -= Math.floor(ph[k]); s += tabRead(tab, ph[k]); }
      let e = smooth(t / 0.07) * (0.9 + 0.1 * Math.sin(TAU * 1.3 * t));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (s * 0.5 + bow[i] * 0.12) * e;
    }
    const out = filt(y, 'bp', 450, 1.2); addInto(out, filt(y, 'bp', 2800, 1.3), 0, 0.9); addInto(out, filt(y, 'bp', 1150, 1.5), 0, 0.5); filtIn(out, 'lp', 7000, 0.7);
    return scaleTo(fadeEdges(out, 0.001, 0.01), 1);
  });
}
// ---- banh xeo foley
// "XEEEO!": batter hits the hot pan - instant loud hiss sweeping up, dense crackle, oily splat
function xeo(R, dur, rate = 260) {
  const n = secs(dur), x = filt(noise(R, n), 'bp', (t) => 2200 + 4300 * smooth(t / 0.25), 0.6), fl = flutterEnv(R, n, 22);
  scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR, e = Math.min(1, t / 0.012) * (0.55 + 0.45 * Math.exp(-t / 0.35)) * (1 - smooth((t - (dur - 0.45)) / 0.45)); x[i] *= (0.55 + 0.45 * fl[i]) * e; }
  addInto(x, scaleTo(crinkle(R, dur, rate, 1200, 7000), 0.9), 0, 1);
  addInto(x, scaleTo(burst(R, 0.06, 'lp', 900, 0.7, 0.018), 0.6), 0, 1);
  return scaleTo(fadeEdges(x, 0.0005, 0.03), 1);
}
// sizzle swell: rises over `rise` s to a roar, then settles
function swell(R, dur, rise = 0.6) {
  const n = secs(dur), x = filt(filt(noise(R, n), 'hp', 2400, 0.7), 'lp', 11000, 0.7), fl = flutterEnv(R, n, 20);
  scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR, e = (0.15 + 0.85 * smooth(t / rise)) * (1 - 0.35 * smooth((t - rise) / (dur - rise))) * (1 - smooth((t - dur + 0.4) / 0.4)); x[i] *= (0.5 + 0.5 * fl[i]) * e; }
  const c = crinkle(R, dur, 300, 1200, 6500); for (let i = 0; i < c.length && i < n; i++) c[i] *= 0.3 + 0.7 * smooth(i / SR / rise);
  addInto(x, scaleTo(c, 0.9), 0, 1);
  return scaleTo(fadeEdges(x, 0.01, 0.03), 1);
}
// backbeat sizzle "tss" (musical, on the music bus)
function szHit(v = 0) { return memo('szh' + v, () => { const R = rngFor('szh' + v), x = xeo(R, 0.34, 400); const y = filt(x, 'hp', 3000, 0.7); for (let i = 0; i < y.length; i++) y[i] *= Math.exp(-i / SR / 0.12); return scaleTo(fadeEdges(y, 0.001, 0.02), 1); }); }
function chop(R) { const y = scaleTo(woodThunk(R, 185 + R() * 20), 0.9); addInto(y, tick(R, 3000), 0, 0.35); addInto(y, scaleTo(crinkle(R, 0.05, 600, 2500, 7000), 0.4), 0, 1); return scaleTo(y, 1); }
function whisk(R) { const y = scaleTo(whoosh(R, 0.14, 1800, 4200, 2500, 0.5, 1.4), 0.8); for (let k = 0; k < 3; k++) addInto(y, tick(R, 3600 + R() * 1500), secs(0.02 + R() * 0.09), 0.2); return scaleTo(y, 1); }
function spatula(R) { const y = scaleTo(modal([[640, 1, 0.05], [1530, 0.6, 0.035], [2870, 0.45, 0.02], [4300, 0.25, 0.012]], 0.18), 1); addInto(y, scaleTo(filt(burst(R, 0.09, 'bp', 2600, 3, 0.03), 'hp', 1500, 0.7), 1), secs(0.004), 0.5); return scaleTo(y, 1); }
function plateSlide(R) { const n = secs(0.5), x = filt(noise(R, n), 'bp', (t) => 900 + 700 * t, 2.2); for (let i = 0; i < n; i++) { const u = i / n; x[i] *= Math.pow(Math.sin(Math.PI * u), 0.6); } const y = new Float32Array(secs(0.8)); addInto(y, scaleTo(x, 0.6), 0, 1); addInto(y, modal([[2650, 1, 0.12], [4870, 0.5, 0.07], [7300, 0.25, 0.04]], 0.3), secs(0.45), 0.7); addInto(y, scaleTo(softThud(R), 0.8), secs(0.45), 1); return scaleTo(y, 1); }
function ceramic(R, f = 2600) { const y = modal([[f, 1, 0.25], [f * 1.88, 0.6, 0.15], [f * 2.9, 0.35, 0.09], [f * 4.2, 0.2, 0.05]], 0.6); addInto(y, burst(R, 0.01, 'hp', 3000, 0.7, 0.002), 0, 0.4); return scaleTo(y, 1); }
function fold(R) { const y = scaleTo(softThud(R), 1); addInto(y, scaleTo(crinkle(R, 0.25, 500, 1500, 6000), 0.5), secs(0.01), 1); addInto(y, scaleTo(sizzle(R, 0.6), 0.25), secs(0.02), 1); return scaleTo(y, 1); }
function quack(R, k = 1) {
  const x = talk(R, [{ d: 0.025, n: 'k', na: 0.5 }, { d: 0.17, v: 'ae', v2: 'a', f0: 560 * k, f1: 470 * k, a: 1, att: 0.008, br: 0.45, rel: 0.05 }], { fs: 1.3, bw: 2.4 });
  const y = filt(filt(x, 'bp', 1400, 0.8), 'hp', 400, 0.7); scaleTo(y, 1); for (let i = 0; i < y.length; i++) y[i] = Math.tanh(2.5 * y[i]);
  return scaleTo(y, 1);
}
function fireBed(R, dur) {
  const n = secs(dur), out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const ch of ['L', 'R']) {
    const y = out[ch], rum = scaleTo(filt(filt(noise(R, n), 'lp', 260, 0.7), 'hp', 50, 0.7), 1), fl = flutterEnv(R, n, 3);
    for (let i = 0; i < n; i++) y[i] = rum[i] * 0.35 * (0.5 + 0.5 * fl[i]);
    addInto(y, scaleTo(crinkle(R, dur, 30, 700, 4500), 0.6), 0, 1);
    for (let t = R() * 0.5; t < dur - 0.3; t += 0.4 + R() * 1.4) addInto(y, scaleTo(crack(R), 1), secs(t), 0.15 + 0.25 * R());
  }
  return out;
}
// crickets (3 per side: 3-4 pulse chirps of ~4.5 kHz) + soft cicada shimmer
function crickets(R, dur) {
  const n = secs(dur), out = { L: new Float32Array(n), R: new Float32Array(n) };
  for (const ch of ['L', 'R']) {
    const y = out[ch];
    for (let c = 0; c < 3; c++) {
      const f = 4200 + R() * 1100, per = 0.5 + R() * 0.35, np = 3 + ((R() * 2) | 0), a = 0.4 + 0.6 * R();
      for (let t0 = R() * per; t0 < dur - 0.3; t0 += per * (0.9 + 0.2 * R())) for (let p = 0; p < np; p++) {
        const i0 = secs(t0 + p * 0.032), m = secs(0.02);
        for (let k = 0; k < m && i0 + k < n; k++) y[i0 + k] += a * Math.sin(TAU * f * (i0 + k) / SR) * Math.sin(Math.PI * k / m);
      }
    }
    const ci = filt(noise(R, n), 'bp', 6500, 3);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] += ci[i] * 0.5 * (0.6 + 0.4 * Math.sin(TAU * 0.13 * t + (ch === 'L' ? 0 : 2))) * (0.7 + 0.3 * Math.sin(TAU * 42 * t)); }
  }
  return out;
}
const vHey = (R, f = 190, who = ADULT) => voc(R, [{ d: 0.05, n: 'h', na: 0.45 }, { d: 0.24, v: 'e', v2: 'i', f0: f, f1: f * 1.22, a: 1, att: 0.015, rel: 0.07 }], who);
const segHey = (f) => [{ d: 0.05, n: 'h', na: 0.45 }, { d: 0.24, v: 'e', v2: 'i', f0: f, f1: f * 1.2, a: 1, att: 0.015, rel: 0.07 }];
const HEY_V = [[150, ADULT, -0.5, 0], [180, ADULT, 0.45, 0.012], [205, ADULT, -0.15, 0.02], [290, LADY, 0.3, 0.006], [330, LADY, -0.35, 0.016]];

// ======================================================================= arrangement helpers
const GT_PAN = [-0.38, 0.32];
// one stretch of the rhythm section, beat parity relative to t0 (t0 = beat 1)
function rhythm(t0, nBeats, o = {}) {
  const gt = o.gtr ?? 1, bs = o.bass ?? 'walk', bg = o.bg ?? 1, br = o.br ?? 0, sn = o.snap ?? 0, sz = o.sz ?? 0, two = o.two ?? true;
  let prev = null;
  for (let k = 0; k < nBeats; k++) {
    const t = t0 + k * BEAT, j = k % 4, nm = chordAt(t + 1e-3), c = CH[nm], nx = chordAt(t + BEAT + 1e-3), pv = chordAt(t - BEAT + 1e-3);
    const fresh = k === 0 || pv !== nm;
    if (gt) {
      if (o.half) {
        if (j === 0) put(GTR, t, gnote(c.gb[0], 0.9), { gain: 0.17 * gt, pan: GT_PAN[0], hall: 0.25 });
        if (j === 2) { put(GTR, t, pompe(nm, 0, false, 0.5), { gain: 0.19 * gt, pan: GT_PAN[0], hall: 0.3 }); if (two) put(GTR, t + 0.008, pompe(nm, 1, false, 0.5), { gain: 0.13 * gt, pan: GT_PAN[1], hall: 0.3 }); }
      } else if (j % 2 === 0) {
        put(GTR, t, gnote(fresh ? c.gb[0] : c.gb[j >> 1], 0.36, 0), { gain: 0.16 * gt, pan: GT_PAN[0], room: 0.05 });
        put(GTR, t, pompe(nm, 0, false, 0.09), { gain: 0.07 * gt, pan: GT_PAN[0] });
        if (two) put(GTR, t + 0.006, pompe(nm, 1, false, 0.09), { gain: 0.06 * gt, pan: GT_PAN[1] });
      } else {
        put(GTR, t - 0.055, pompe(nm, 2, true, 0.04), { gain: 0.045 * gt, pan: GT_PAN[0] });
        put(GTR, t, pompe(nm, 0, true, 0.13), { gain: 0.2 * gt, pan: GT_PAN[0], room: 0.06 });
        if (two) put(GTR, t + 0.007, pompe(nm, 1, true, 0.13), { gain: 0.15 * gt, pan: GT_PAN[1], room: 0.06 });
      }
    }
    if (bs === 'two' || (bs === 'half' && j === 0)) {
      if (j === 0 || (bs === 'two' && j === 2)) { const m = fresh ? c.root : c.tones[2] - 12 * (c.tones[2] > 48 ? 1 : 0); put(ML, t, ubass(m, bs === 'half' ? BEAT * 3.6 : BEAT * 1.7), { gain: 0.5 * bg }); }
    } else if (bs === 'walk' || bs === 'walk8') {
      let m;
      if (fresh) m = c.root;
      else if (nx !== nm && k < nBeats - 1) { const r = CH[nx].root; m = prev != null && prev > r ? r + 1 : r - 1; }
      else m = c.tones[1 + (j % 3)];
      while (m > 52) m -= 12; while (m < 33) m += 12;
      put(ML, t, ubass(m, BEAT * 0.92), { gain: (j % 2 ? 0.44 : 0.5) * bg });
      if (bs === 'walk8') put(ML, t + SW, ubass(m + (j % 2 ? -2 : 2), 0.15), { gain: 0.3 * bg });
      prev = m;
    }
    if (br) {
      if (j % 2 === 0) put(MH, t, brushSwish(BEAT * 2), { gain: 0.05 * br, pan: 0.12, room: 0.05 });
      if (j % 2 === 1) put(MH, t, brushTap(k % 3), { gain: 0.1 * br, pan: 0.1, room: 0.08 });
      if (j === 3 || (o.busy && j === 1)) put(MH, t + SW, brushTap(3), { gain: 0.045 * br, pan: 0.16, room: 0.08 });
    }
    if (sn && j % 2 === 1) put(MH, t + 0.004, snap(k % 4), { gain: 0.11 * sn, pan: j === 1 ? -0.5 : 0.5, room: 0.12, hall: 0.04 });
    if (sz && j === 3) put(MH, t, szHit(k % 3), { gain: 0.07 * sz, pan: 0.25, room: 0.05 });
  }
}
const dur8 = (t0, p, l) => pos8(t0, p + l) - pos8(t0, p);
function claMel(t0, arr, g = 0.2, pan = 0.18) { for (const [p, l, m, op = {}] of arr) put(CLA, pos8(t0, p), clar(m, dur8(t0, p, l) * 0.97, op), { gain: g * (op.g ?? 1), pan, hall: 0.2, room: 0.05 }); }
function kimMel(t0, arr, g = 0.24, pan = -0.26) { for (const [p, l, m, op = {}] of arr) put(KIM, pos8(t0, p), kim(m, dur8(t0, p, l) * 0.95, op), { gain: g * (op.g ?? 1), pan, hall: 0.18, room: 0.05 }); }
function vioMel(t0, arr, g = 0.15, pan = 0.36) { for (const [p, l, m, op = {}] of arr) put(VIO, pos8(t0, p), violin(m, dur8(t0, p, l) * 0.97, op), { gain: g * (op.g ?? 1) * (op.pizz ? 1.4 : 1), pan, hall: 0.22, room: 0.05 }); }
function kimTrem(t0, dur, m, g0, g1, pan = -0.26) { for (let t = t0, k = 0; t < t0 + dur - 1e-6; t += 0.06, k++) put(KIM, t, kim(m, 0.07, { vb: 0 }), { gain: (g0 + (g1 - g0) * (t - t0) / dur) * (k % 2 ? 0.8 : 1), pan, hall: 0.15 }); }
function brushRoll(t0, dur, g0, g1) { for (let t = t0, k = 0; t < t0 + dur - 1e-6; t += BEAT / 4, k++) put(MH, t, brushTap(k % 4), { gain: g0 + (g1 - g0) * (t - t0) / dur, pan: 0.1 + 0.05 * (k % 2), room: 0.1 }); }
// band stab: full downstroke on both guitars + bass + optional kick/crash
function stab(t, nm, g = 1, o = {}) {
  put(GTR, t, pompe(nm, 0, false, o.len ?? 0.3), { gain: 0.26 * g, pan: GT_PAN[0], room: 0.08, hall: 0.12 });
  put(GTR, t + 0.008, pompe(nm, 1, false, o.len ?? 0.3), { gain: 0.2 * g, pan: GT_PAN[1], room: 0.08, hall: 0.12 });
  put(ML, t, ubass(CH[nm].root, o.blen ?? 0.6), { gain: 0.55 * g });
  if (o.kick) put(ML, t, kick(), { gain: 0.45 * g });
  if (o.crash) put(MH, t, crash(rngFor('stc' + t), 2.0), { gain: 0.12 * g * o.crash, hall: 0.2 });
}
// melodies (positions in swung 8ths from phrase start)
const MOTIF = [[0, 2, 69], [2, 1, 74], [3, 1, 76], [4, 2, 77], [6, 1, 81], [7, 1, 79], [8, 1, 77], [9, 1, 76], [10, 4, 74]];
const ANSWER = [[0, 2, 70], [2, 1, 74], [3, 1, 76], [4, 3, 79], [7, 1, 77], [8, 2, 76], [10, 1, 73], [11, 1, 76], [12, 4, 69]];
const tr = (arr, d, op) => arr.map(([p, l, m, o]) => [p, l, m + d, { ...(o || {}), ...(op || {}) }]);

// ======================================================================= SCORE
// ---------- ambience beds: dusk river outside (AMB_KEYS), fire crackle in the kitchen (FIRE_KEYS), crickets at dusk
{
  const R = rngFor('amb');
  putAmb(0, waterLap(R, DUR), { gain: 0.55 });
  for (const [t, p] of [[0.7, 0.6], [2.3, -0.5], [4.3, 0.4], [32.0, -0.6], [33.4, 0.5], [35.8, -0.4], [38.5, 0.6], [50.2, 0.5], [61.5, -0.5], [63.6, 0.5]]) putAmb(t, birdCall(R), { gain: 0.06, pan: p, hall: 0.25 });
  const cr1 = crickets(R, 9.2); for (let i = 0; i < cr1.L.length; i++) { const t = i / SR, e = smooth(t / 0.6) * (1 - smooth((t - 7.6) / 1.4)); cr1.L[i] *= e; cr1.R[i] *= e; }
  put(FX2, 0, cr1, { gain: 0.035 });
  const cr2 = crickets(R, 9.2); for (let i = 0; i < cr2.L.length; i++) { const t = i / SR, e = smooth(t / 1.0); cr2.L[i] *= e; cr2.R[i] *= e; }
  put(FX2, 60.4, cr2, { gain: 0.035 });
  put(FX2, 4.6, fireBed(R, 45.6), { gain: 0.1, env: fireEnv });
}

// ---------- ACT I 0-8.64: dusk on the river, kim intro over soft pompe; band enters 3.84; XEEEO from the house; batter pour 6.72
{
  const R = rngFor('act1');
  rhythm(0, 8, { gtr: 0.5, bass: 'none', two: false });
  kimMel(0, [[0, 1, 57, { sl: 2 }], [1, 1, 60], [2, 2, 62, { bd: 1 }], [4, 1, 65], [5, 1, 67], [6, 2, 69, { bd: 1 }], [8, 1, 72, { sl: 1 }], [9, 1, 70], [10, 1, 69], [11, 1, 67], [12, 4, 65, { bd: 2, vb: 0.5 }]], 0.26);
  rhythm(3.84, 6, { gtr: 0.7, bass: 'two', bg: 0.75, br: 0.5, snap: 0.6 });
  kimMel(3.84, [[0, 1, 74, { sl: 2 }], [1, 1, 72], [2, 2, 69, { bd: 1 }]], 0.2);
  rhythm(6.72, 4, { gtr: 0.85, bass: 'walk', bg: 0.85, br: 0.75, snap: 0.7 });
  put(SFX, 4.92, xeo(R, 1.4), { gain: 0.62, pan: 0.2, room: 0.25, hall: 0.05 });
  put(SFX, 5.76, sniff(R), { gain: 0.36, pan: -0.15, room: 0.12 });
  put(SFX, 6.72, brothPour(R, 1.0), { gain: 0.22, pan: 0.05 });
  put(SFX, 6.76, swell(R, 1.95, 0.9), { gain: 0.34, pan: 0.05, room: 0.1 });
  put(MH, 7.68, reverseCrash(R, 0.96), { gain: 0.1, hall: 0.1 });
  brushRoll(7.68, 0.96, 0.03, 0.1);
  claMel(7.68, [[0, 1, 62], [1, 1, 65], [2, 1, 69], [3, 1, 72]], 0.16);
}

// ---------- TITLE 8.64: full band downbeat + clarinet motif (flash)
{
  const R = rngFor('title');
  stab(8.64, 'Dm6', 1.1, { kick: 1, crash: 1.2, len: 0.45 });
  put(FX2, 8.64, bigBoom(R, 1.1, 85, 38, 0.35), { gain: 0.18 });
  put(MH, 8.64, ting(m2f(86), 1.1), { gain: 0.05, hall: 0.35, pan: 0.3 });
  claMel(8.64, MOTIF, 0.22);
  rhythm(9.12, 7, { gtr: 1, bass: 'walk', br: 0.9, snap: 0.8 });   // continues into act II
  kimMel(11.04, [[0, 1, 81, { sl: 2 }], [1, 1, 79], [2, 1, 77], [3, 1, 74, { bd: 1 }]], 0.18);
}

// ---------- ACT II 11.52-40.32: full swing, walking bass
{
  rhythm(12.48, 16, { gtr: 1, bass: 'walk', br: 1, snap: 0.8, sz: 1 });
  claMel(12.48, ANSWER, 0.21);
  kimMel(14.4 + SW, [[0, 1, 81], [1, 1, 79], [2, 1, 76, { bd: 1 }]], 0.15);
  claMel(16.32, [[0, 2, 69], [2, 1, 74], [3, 1, 76], [4, 2, 77], [6, 1, 81], [7, 1, 79], [8, 1, 77], [9, 1, 74], [10, 1, 70], [11, 1, 74], [12, 1, 73], [13, 1, 76], [14, 2, 81]], 0.21);
  vioMel(16.32, [[0, 8, 65], [8, 4, 70], [12, 4, 73]], 0.07);
  // 20.16 stop-time: hits on Dm6 and A7 under the hero pour, band back at 22.08
  stab(20.16, 'Dm6', 1, { kick: 1, crash: 0.8 });
  stab(21.12, 'A7', 0.8, { len: 0.2 });
  put(MH, 20.16, rimshot(), { gain: 0.12, pan: 0.1, room: 0.1 });
  kimMel(21.12, [[0, 1, 81, { sl: 2 }], [1, 1, 79], [2, 1, 77], [3, 1, 76, { bd: 1 }]], 0.2);
  rhythm(22.08, 14, { gtr: 1, bass: 'walk', br: 1, snap: 0.8, sz: 1 });
  // kim calls, violin answers
  kimMel(22.08, [[0, 1, 69, { sl: 2 }], [1, 1, 72], [2, 2, 74, { bd: 1 }], [4, 1, 72], [5, 1, 69], [6, 2, 67, { bd: 1 }]], 0.25);
  vioMel(24.0, [[0, 3, 74, { sl: 1 }], [3, 1, 70], [4, 2, 67], [6, 2, 70]], 0.16);
  kimMel(25.92, [[0, 1, 77, { sl: 1 }], [1, 1, 74], [2, 1, 68, { bd: 1 }], [3, 1, 65], [4, 1, 64], [5, 1, 67], [6, 2, 69, { bd: 1, vb: 0.5 }]], 0.25);
  vioMel(27.84, [[0, 2, 73, { sl: 1 }], [2, 1, 76], [3, 1, 79]], 0.16);
  claMel(22.08, [[0, 8, 62], [8, 8, 62], [16, 4, 65], [20, 8, 64]], 0.06, 0.05);
  // 28.8 flash: plate; clarinet motif tag
  stab(28.8, 'Dm6', 1, { kick: 1, crash: 0.7 });
  claMel(28.8, [[0, 2, 69], [2, 1, 74], [3, 1, 76], [4, 2, 77], [6, 1, 81], [7, 1, 79], [8, 2, 76], [10, 1, 73], [11, 1, 69]], 0.21);
  rhythm(29.28, 5, { gtr: 1, bass: 'walk', br: 0.9, snap: 0.8 });
  // 31.68 garden: lighter (no swish, soft guitar), kim takes the motif, violin answer, clarinet pickup
  rhythm(31.68, 18, { gtr: 0.7, bass: 'walk', bg: 0.8, br: 0, snap: 0.9, two: false });
  kimMel(31.68, tr(MOTIF, -12), 0.27);
  vioMel(35.52, tr(ANSWER, -12), 0.15);
  vioMel(31.68, [[2, 1, 74, { pizz: 1 }], [6, 1, 77, { pizz: 1 }], [10, 1, 74, { pizz: 1 }], [14, 1, 69, { pizz: 1 }]], 0.12, 0.4);
  claMel(39.36, [[0, 1, 69], [1, 1, 73], [2, 1, 76], [3, 1, 79]], 0.17);
}
// ---------- ACT II foley
{
  const R = rngFor('act2');
  // 11.52 flour/milk pour + whisk swishes on the 8ths
  put(SFX, 11.52, brothPour(R, 1.3), { gain: 0.14, pan: -0.1 });
  put(SFX, 11.52, steamHiss(R, 1.0), { gain: 0.05, pan: -0.1 });
  for (let p = 2; p < 12; p++) put(SFX, pos8(12.48, p), whisk(R), { gain: 0.14, pan: -0.15 + 0.1 * (p % 2) });
  // knife chops on beats, scallions drop
  for (const t of [14.4, 14.88, 15.36, 15.84]) put(SFX, t, chop(R), { gain: 0.36, pan: 0.15, room: 0.1 });
  put(SFX, 16.32, garlicRain(R, 0.5), { gain: 0.16, pan: 0.1 });
  put(SFX, 16.36, leafRustle(R, 0.4), { gain: 0.18, pan: 0.1 });
  // 17.28 oil + shrimp/pork sear, spatula tosses on beats 2&4
  put(SFX, 17.28, xeo(R, 1.8, 320), { gain: 0.3, pan: 0.1, room: 0.12 });
  for (const t of [17.76, 18.72, 19.2, 19.68]) put(SFX, t, spatula(R), { gain: 0.2, pan: 0.2, room: 0.1 });
  // 20.16 hero batter pour, BIG sizzle swell
  put(SFX, 20.16, brothPour(R, 1.2), { gain: 0.18, pan: 0 });
  put(SFX, 20.16, xeo(R, 0.8, 400), { gain: 0.3, pan: 0 });
  put(SFX, 20.3, swell(R, 2.4, 0.7), { gain: 0.38, pan: 0, room: 0.1 });
  // 23.04 sprouts sprinkle
  put(SFX, 23.04, garlicRain(R, 0.7), { gain: 0.14, pan: -0.1 });
  put(SFX, 23.06, leafRustle(R, 0.7), { gain: 0.16, pan: -0.1 });
  // 24.96 lid clank = crash; 25.92 lid off steam whoosh; 27.36 fold flop
  put(SFX, 24.96, lidClank(R), { gain: 0.32, pan: 0.05, room: 0.15 });
  put(MH, 24.96, crash(R, 1.8), { gain: 0.1, hall: 0.15 });
  put(SFX, 25.92, steamHiss(R, 1.6), { gain: 0.16, pan: 0.05 });
  put(SFX, 25.92, whoosh(R, 0.6, 400, 2600, 900), { gain: 0.16, pan: (t) => -0.2 + t });
  put(SFX, 25.95, lidClank(R), { gain: 0.1, pan: 0.3 });
  put(SFX, 27.36, fold(R), { gain: 0.36, pan: 0, room: 0.1 });
  // 28.8 plate slide + crunchy knock
  put(SFX, 28.4, plateSlide(R), { gain: 0.3, pan: (t) => -0.4 + 0.8 * t, room: 0.1 });
  put(SFX, 29.28, crunch(R, 0.22, 900), { gain: 0.22, pan: 0.05 });
  put(SFX, 29.3, woodThunk(R, 210), { gain: 0.2, pan: 0.05, room: 0.08 });
  // 34.56 sauce pour + 3 plinks on the beats (tuned to the Gm6 bar)
  put(SFX, 34.56, drizzle(R, 0.9), { gain: 0.2, pan: 0.15 });
  put(SFX, 34.56, brothPour(R, 0.7), { gain: 0.08, pan: 0.15 });
  [[35.52, 74], [36.0, 79], [36.48, 82]].forEach(([t, m]) => put(MH, t, bloop(m2f(m)), { gain: 0.11, pan: 0.2, hall: 0.2 }));
  // 37.44 tear / wrap / dip
  put(SFX, 37.44, crunch(R, 0.35, 700), { gain: 0.26, pan: -0.05 });
  put(SFX, 37.8, leafRustle(R, 0.6), { gain: 0.2, pan: 0.05 });
  put(SFX, 38.64, bubble(420, 0.12, 0.7), { gain: 0.16, pan: 0.1 });
  put(SFX, 38.66, smallSlurp(R, 0.18, 900, 1600), { gain: 0.06, pan: 0.1 });
}

// ---------- ACT III 40.32-: playful pizz/kim, knife-and-fork clinks, "hey!", ERUPTION 44.16, flip 47.04, flight 49.92
{
  const R = rngFor('act3');
  stab(40.32, 'Dm6', 0.7, { len: 0.2 });
  put(MH, 40.32, ting(m2f(93), 0.8), { gain: 0.05, hall: 0.3, pan: -0.3 });
  rhythm(40.32, 8, { gtr: 0.6, bass: 'two', bg: 0.8, snap: 1, two: false });
  vioMel(40.32, [[0, 1, 62, { pizz: 1 }], [1, 1, 65, { pizz: 1 }], [2, 1, 69, { pizz: 1 }], [4, 1, 74, { pizz: 1 }], [6, 1, 72, { pizz: 1 }], [7, 1, 69, { pizz: 1 }]], 0.14);
  kimMel(42.24, [[0, 1, 73, { sl: 1 }], [1, 1, 76], [2, 1, 79, { bd: 1 }], [4, 1, 76], [5, 1, 73]], 0.22);
  for (const t of [40.8, 41.76, 42.72, 43.68]) { put(SFX, t, iceClink(R, 3100), { gain: 0.1, pan: -0.2 }); put(SFX, t + SW, iceClink(R, 3700), { gain: 0.07, pan: 0.2 }); }
  put(SFX, 42.48, vHey(R, 185), { gain: 0.32, pan: -0.15, room: 0.12 });
  put(MH, 43.2, riser(R, 0.96, 300, 6000), { gain: 0.07, pan: 0 });
  brushRoll(43.2, 0.96, 0.02, 0.12);
  kimTrem(43.44, 0.72, 69, 0.06, 0.16);
  // 44.16 ERUPTION: sizzle explosion + crash + clarinet squeal, then a fast swing break
  put(SFX, 44.16, bigBoom(R, 1.5, 95, 34, 0.45), { gain: 0.42 });
  put(SFX, 44.16, xeo(R, 2.6, 500), { gain: 0.48, pan: (t) => 0.5 * Math.sin(TAU * 1.3 * t), room: 0.15, hall: 0.06 });
  put(SFX, 44.18, flare(R, 1.6), { gain: 0.3, pan: 0 });
  put(MH, 44.16, crash(R, 2.4), { gain: 0.16, hall: 0.25 });
  stab(44.16, 'Dm6', 1, { kick: 1 });
  put(CLA, 44.16, clar(91, 0.42, { gl: -8, sq: 1, vib: 2.5 }), { gain: 0.15, pan: 0.15, hall: 0.25 });
  rhythm(44.64, 5, { gtr: 1, bass: 'walk8', br: 1, busy: 1, snap: 0, sz: 1 });
  claMel(44.16, [[1, 1, 77], [2, 1, 81], [3, 1, 86], [4, 1, 79], [5, 1, 82], [6, 1, 86], [7, 1, 88], [8, 1, 81], [9, 1, 85], [10, 1, 88], [11, 1, 91]], 0.17);
  // 47.04 flip: whoosh + slide whistle up; half-time slow-mo 47.5-49.9
  put(SFX, 47.04, whoosh(R, 0.6, 300, 2400, 700, 0.3), { gain: 0.34, pan: (t) => -0.3 + t });
  put(SFX, 47.04, slideWhistle(R, 0.7, 70, 94), { gain: 0.22, pan: 0.1, hall: 0.15 });
  put(MH, 47.04, crash(R, 2.2), { gain: 0.08, hall: 0.35 });
  rhythm(47.52, 5, { gtr: 0.8, bass: 'half', bg: 0.8, br: 0 });
  put(MH, 47.52, brushSwish(1.9), { gain: 0.05, pan: 0.1, hall: 0.3 });
  put(CLA, 47.52, clar(77, 1.9, { vib: 1.4 }), { gain: 0.16, pan: 0.15, hall: 0.4 });
  vioMel(47.52, [[0, 8, 65]], 0.08);
  kimTrem(48.48, 1.4, 57, 0.05, 0.12);
  // 49.92 flight over the river: frisbee whoosh, ducks follow; violin high E rising, kim tremolo, cut at 51.84
  put(SFX, 49.92, whoosh(R, 1.8, 250, 1600, 400, 0.45, 0.9), { gain: 0.26, pan: (t) => -0.8 + 0.9 * t, hall: 0.1 });
  [[50.4, 1.0, -0.6], [50.88, 1.08, -0.3], [51.36, 0.95, 0.1]].forEach(([t, k, p]) => put(SFX, t, quack(R, k), { gain: 0.2, pan: p, room: 0.08, hall: 0.06 }));
  put(SFX, 50.6, wings(R, 6, 5), { gain: 0.08, pan: -0.4 });
  rhythm(49.92, 4, { gtr: 0.7, bass: 'two', bg: 0.7, br: 0.6, two: false });
  put(VIO, 49.92, violin(88, 1.95, { sl: 2 }), { gain: 0.14, pan: 0.3, hall: 0.3 });
  kimTrem(49.92, 1.9, 69, 0.06, 0.16);
  put(MH, 50.88, reverseCrash(R, 0.96), { gain: 0.09, hall: 0.05 });
}

// ---------- 52.8 catch: plate clink + band slam (flash), ducks, applause; 56.64 bite + CRUNCH; 60.48 end card
{
  const R = rngFor('act3b');
  put(SFX, 52.8, ceramic(R, 2600), { gain: 0.3, pan: 0.05, room: 0.1 });
  put(SFX, 52.8, softThud(R), { gain: 0.25, pan: 0.05 });
  stab(52.8, 'Dm6', 1.2, { kick: 1, crash: 1.3, len: 0.4 });
  put(MH, 52.8, rimshot(), { gain: 0.14, pan: 0.1, room: 0.1 });
  put(CLA, 52.8, clar(86, 0.9, { gl: -2 }), { gain: 0.18, pan: 0.15, hall: 0.25 });
  put(VIO, 52.8, violin(81, 0.9), { gain: 0.12, pan: 0.36, hall: 0.25 });
  put(SFX, 52.85, crowdSay(R, segHey, HEY_V), { gain: 0.22, room: 0.1, hall: 0.05 });
  [[53.28, 1.0, -0.3], [53.76, 1.06, 0.2], [54.24, 0.94, -0.1]].forEach(([t, k, p]) => put(SFX, t, quack(R, k), { gain: 0.26, pan: p, room: 0.1 }));
  put(SFX, 53.1, applause(R, 3.4, 240), { gain: 0.2, room: 0.1 });
  rhythm(53.28, 7, { gtr: 1, bass: 'walk', br: 1, snap: 0.9, sz: 1 });
  claMel(54.72, [[0, 2, 70], [2, 1, 74], [3, 1, 76], [4, 1, 79], [5, 1, 77], [6, 1, 76], [7, 1, 73]], 0.19);
  vioMel(54.72, [[0, 2, 82], [2, 1, 86], [3, 1, 88], [4, 1, 91], [5, 1, 89], [6, 1, 88], [7, 1, 85]], 0.1);
  // 56.64 bite: band thins, drop for the crunch, sparkle "mmm", kim phrase
  rhythm(56.64, 2, { gtr: 0.8, bass: 'walk', bg: 0.8, snap: 0.8 });
  rhythm(57.6, 2, { gtr: 0.35, bass: 'none', two: false });
  put(SFX, 56.64, inhale(R, 0.7), { gain: 0.12, pan: -0.1 });
  put(SFX, 58.08, crunch(R, 0.5, 600), { gain: 0.44, pan: 0, room: 0.12 });
  put(SFX, 58.08, crack(R), { gain: 0.3, pan: 0.05 });
  put(SFX, 58.3, crunch(R, 0.3, 900), { gain: 0.2, pan: -0.05 });
  sparkleAt(58.56, R, 0.07, [86, 89, 93, 98, 101]);
  rhythm(58.56, 4, { gtr: 0.9, bass: 'walk', bg: 0.9, br: 0.8, snap: 0.8 });
  kimMel(58.56, [[0, 1, 77, { sl: 1 }], [1, 1, 74], [2, 2, 73, { bd: 1 }], [4, 4, 69, { vb: 0.6 }]], 0.25);
  // 60.48 end card: warm tutti, motif recap (clarinet + violin an octave up), kim fills, dusk crickets
  stab(60.48, 'Dm6', 1, { kick: 1, crash: 0.9 });
  rhythm(60.96, 8, { gtr: 1, bass: 'walk', br: 1, snap: 0.9 });
  claMel(60.48, MOTIF, 0.21);
  vioMel(60.48, tr(MOTIF, 12), 0.09);
  kimMel(63.36, [[0, 1, 81, { sl: 2 }], [1, 1, 79], [2, 1, 76], [3, 1, 73, { bd: 1 }]], 0.2);
}

// ---------- CTA 64.8-69.6: heart pop, FOLLOW click + chime, wink ba-dum-tss, clarinet gliss + kim tremolo, final Dm6/9, fade
{
  const R = rngFor('cta');
  put(SFX, 64.8, bloop(m2f(79)), { gain: 0.3, pan: -0.15, hall: 0.1 });
  put(SFX, 64.8, heartThump(), { gain: 0.22 });
  rhythm(64.8, 6, { gtr: 0.8, bass: 'walk', bg: 0.85, br: 0.7, snap: 0.8 });
  put(SFX, 65.76, uiClick(R), { gain: 0.36, pan: 0.1 });
  put(MH, 65.78, ting(m2f(93), 0.8), { gain: 0.1, pan: 0.2, hall: 0.3 });
  put(MH, 65.85, ting(m2f(98), 0.6), { gain: 0.06, pan: 0.3, hall: 0.3 });
  // wink: ba-dum-tss
  put(MH, 66.24, rimshot(), { gain: 0.2, pan: 0.05, room: 0.12 });
  put(MH, 66.24 + SW, tom(110), { gain: 0.26, pan: -0.15, room: 0.12 });
  put(ML, 66.24 + SW, kick(), { gain: 0.3 });
  put(MH, 66.72, crash(R, 1.2), { gain: 0.13, hall: 0.15 });
  put(MH, 66.72, hat(true), { gain: 0.08, pan: 0.3 });
  // jingle: clarinet glissando up + kim tremolo into the final chord
  put(CLA, 66.72, clar(86, 0.95, { gl: -14 }), { gain: 0.18, pan: 0.15, hall: 0.25 });
  kimTrem(66.72, 0.96, 69, 0.08, 0.2);
  // final chord 67.68 Dm6/9 (beat 141), held into the fade 69.12-69.6
  const tF = 67.68;
  put(GTR, tF, pompe('Dm69', 0, false, 1.9), { gain: 0.28, pan: GT_PAN[0], hall: 0.3 });
  put(GTR, tF + 0.012, pompe('Dm69', 1, false, 1.9), { gain: 0.22, pan: GT_PAN[1], hall: 0.3 });
  put(ML, tF, ubass(38, 1.9), { gain: 0.55 }); put(ML, tF, kick(), { gain: 0.35 });
  put(CLA, tF, clar(81, 1.9, { vib: 1.2 }), { gain: 0.17, pan: 0.15, hall: 0.35 });
  put(VIO, tF, violin(77, 1.9, { sl: 1 }), { gain: 0.1, pan: 0.36, hall: 0.35 });
  kimTrem(tF, 1.4, 74, 0.12, 0.05);
  put(MH, tF, crash(R, 2.0), { gain: 0.09, hall: 0.3 });
  put(SFX, tF + 0.1, vHey(R, 330, LADY), { gain: 0.16, pan: -0.25, hall: 0.12 });
}

// ---------- instrument bus voicing -> MH (guitar box, clarinet, nasal kim, violin)
{
  for (const ch of ['L', 'R']) {
    const g = GTR[ch], c = CLA[ch], k = KIM[ch], v = VIO[ch];
    filtIn(g, 'hp', 90, 0.7); filtIn(g, 'peak', 250, 1.0, 2); filtIn(g, 'peak', 3200, 1.0, 3); filtIn(g, 'lp', 9000, 0.7);
    filtIn(c, 'hp', 140, 0.7); filtIn(c, 'peak', 700, 0.9, 1.5); filtIn(c, 'lp', 7000, 0.7);
    filtIn(k, 'hp', 200, 0.7); filtIn(k, 'peak', 1150, 1.5, 4.5); filtIn(k, 'peak', 2600, 1.4, 2); filtIn(k, 'lp', 5200, 0.7);
    filtIn(v, 'hp', 190, 0.7); filtIn(v, 'lp', 8000, 0.7);
    const m = MH[ch]; for (let i = 0; i < N; i++) m[i] += 1.0 * g[i] + 1.2 * c[i] + 1.5 * k[i] + 1.1 * v[i];
  }
}
console.log('score placed', ((Date.now() - T_START) / 1000).toFixed(1) + 's');

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
// soft water lapping in the hush (after the limiter, fixed level: RMS -46 dBFS over 51.89-52.75)
{
  const R = rngFor('hushwater'), w = waterLap(R, 3.0), w0 = Math.round(51.04 * SR);
  const env = (t) => smooth((t - 51.34) / 0.5) * (1 - smooth((t - 52.9) / 1.0));
  let ss = 0, cnt = 0; const a = Math.round(51.89 * SR), b = Math.round(52.75 * SR);
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
  const W = [['river', 0.3, 3.8], ['band', 3.84, 8.6], ['title', 8.64, 11.5], ['kitchen', 11.52, 20.1], ['hero', 20.16, 28.7], ['plate', 28.8, 31.6], ['garden', 31.68, 40.3], ['playful', 40.32, 44.1], ['erupt', 44.16, 47.0], ['flip', 47.04, 49.9], ['flight', 49.92, 51.8], ['hush', 51.89, 52.75], ['catch', 52.8, 56.6], ['bite', 56.64, 60.4], ['end', 60.48, 64.7], ['CTA', 64.8, 69.1]];
  console.log('section RMS: ' + W.map(([k, a, b]) => `${k} ${rms(a, b).toFixed(1)}`).join(' | '));
  // GR hot spots
  const hot = []; for (let s = 0; s < 69.5; s += 0.5) { let m = 1; for (let i = Math.round(s * SR); i < Math.round((s + 0.5) * SR); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -3 / 20)) hot.push(`${s.toFixed(1)}(${(-dbf(m)).toFixed(1)})`); }
  console.log('GR > 3 dB at: ' + (hot.join(' ') || 'none'));
  const hush = rms(51.89, 52.75), burstR = rms(52.8, 53.3);
  const win = []; for (let s = 0; s + 0.96 <= 69.6 + 1e-9; s += 0.96) win.push(`${s.toFixed(2)}:${rms(s, s + 0.96).toFixed(1)}`);
  console.log('RMS per 0.96 s window: ' + win.join(' '));
  const checks = [
    ['format 48k/2ch/16-bit/69.600 s', ch === 2 && sr === 48000 && bits === 16 && n === N],
    [`loudness -15 +-0.5 (${lu.integ.toFixed(2)})`, Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    [`true peak <= -1.45 dBTP (${dbf(tp).toFixed(2)})`, dbf(tp) <= -1.45],
    ['no clipping', clipped === 0],
    [`hush RMS in [-70,-38] (${hush.toFixed(1)})`, hush >= -70 && hush <= -38],
    [`burst 52.8-53.3 > -30 dBFS (${burstR.toFixed(1)})`, burstR > -30],
    ['tail digital zero', tailZero],
    [`limiter GR <= 6 dB (${grDb.toFixed(2)})`, grDb <= 6],
  ];
  let ok = true; for (const [k, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + k); if (!v) ok = false; }
  console.log(`run time ${((Date.now() - T_START) / 1000).toFixed(1)} s`);
  if (!ok) process.exitCode = 1;
}

