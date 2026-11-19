'use strict';
// Ca loc nuong trui - soundtrack. "Mekong spaghetti western", 90 BPM, straight 8ths, A minor (Am / G / F / E Andalusian, Dm, C).
// Everything synthesised in code: Morricone-style whistled melody (sine + breath + vibrato + portamento), twangy baritone electric
// guitar (driven Karplus-Strong, whammy vibrato, tremolo picking, dispersive spring reverb), bold trumpet lead (saw + brass formants,
// swells, falls, harmon-mute "wah"), dan bau answers with big monochord bends, dan kim plucks, upright-bass + low-tom heartbeat,
// clip-clop woodblock gallop, cabasa 16ths, whip cracks on the accents, big tam-tam gong, timpani rolls, wordless male "ooh-aah"
// formant choir for the fire. The straw fire is an instrument (spark 16ths, ignition WHOOSH). Night flood-season ambience:
// crickets at several rates + tree-cricket trill, frogs, water lapping, a distant owl, faint firefly chimes. Comedy: boing, bonk,
// SLAP, slide whistle down, SPLASH, underwater hush, RIBBIT, muted-trumpet "wah-wah-waaah".
// Output: audio.wav 48 kHz / stereo / 16-bit / 70.0 s, ~-15 LUFS, TP <= -1.5 dBTP.
const fs = require('fs'), path = require('path');
const T_START = Date.now();
console.time('render');
const SR = 48000, DUR = 70.0, N = Math.round(SR * DUR), TAU = Math.PI * 2;
const BEAT = 2 / 3, BAR = BEAT * 4, E8 = BEAT / 2, S16 = BEAT / 4;
const bt = (b) => b * BEAT;
const TARGET_LUFS = -15, CEIL_DBTP = -1.65;
const S0 = bt(77), S1 = bt(79), FADE0 = bt(104), FADE1 = DUR;
const I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);
// ======================================================================= generic helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const rngFor = (name) => mulberry32(hashStr('caloc:' + name));
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
const AMB_KEYS = [[0, 0], [0.15, 1], [9.2, 1], [9.5, 0.35], [22.5, 0.35], [22.8, 0.2], [42, 0.2], [42.3, 0.45], [51.3, 0.45], [51.33, 0], [52.67, 0], [53.2, 0.4], [60.5, 0.45], [60.8, 0.8], [69.3, 0.5], [70, 0]];
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
function tom(f) { return memo('tom' + f, () => { const n = secs(0.5), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += f * (1 + 0.35 * Math.exp(-t / 0.03)) / SR; y[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.16) * Math.min(1, t / 0.001); } addInto(y, burst(rngFor('tm' + f), 0.03, 'bp', 1800, 0.8, 0.006), 0, 0.3); return scaleTo(fadeEdges(y, 0.0002, 0.03), 1); }); }
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
// sizzle swell: rises over `rise` s to a roar, then settles
function swell(R, dur, rise = 0.6) {
  const n = secs(dur), x = filt(filt(noise(R, n), 'hp', 2400, 0.7), 'lp', 11000, 0.7), fl = flutterEnv(R, n, 20);
  scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR, e = (0.15 + 0.85 * smooth(t / rise)) * (1 - 0.35 * smooth((t - rise) / (dur - rise))) * (1 - smooth((t - dur + 0.4) / 0.4)); x[i] *= (0.5 + 0.5 * fl[i]) * e; }
  const c = crinkle(R, dur, 300, 1200, 6500); for (let i = 0; i < c.length && i < n; i++) c[i] *= 0.3 + 0.7 * smooth(i / SR / rise);
  addInto(x, scaleTo(c, 0.9), 0, 1);
  return scaleTo(fadeEdges(x, 0.01, 0.03), 1);
}
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

// ======================================================================= Mekong spaghetti-western instruments
const WHI = mkBus(), GTR = mkBus(), GSP = mkBus(), TPT = mkBus(), BAU = mkBus(), KIM = mkBus(), CHO = mkBus();
// straw-fire bed (ambience) and the musical spark 16ths
const FIRE_KEYS = [[0, 0], [9.25, 0], [9.4, 1], [11.5, 0.75], [13.1, 0.55], [13.5, 0], [22.55, 0], [22.75, 1.1], [24.5, 0.8], [25.3, 0.4], [26.0, 0.45], [26.4, 0.9], [28, 0.55], [34, 0.3], [42, 0.12], [51.3, 0.12], [51.33, 0], [52.67, 0], [54.0, 0.3], [56.7, 0.45], [60.6, 0.4], [64.6, 0.3], [69.3, 0.2], [70, 0]];
const fireEnv = (t) => pw(FIRE_KEYS, t);
const FMUS_KEYS = [[0, 0], [22.6, 0], [22.7, 1], [25, 0.75], [28, 0.55], [30.6, 0.6], [34, 0.4], [41.9, 0.4], [42, 0.12], [50, 0.12], [51.3, 0], [54.6, 0], [55, 0.35], [60.6, 0.45], [64.6, 0.3], [69.3, 0.2]];
const CH = {
  Am: { root: 45, tones: [45, 48, 52, 57], up: [57, 60, 64, 69] },
  G: { root: 43, tones: [43, 47, 50, 55], up: [55, 59, 62, 67] },
  F: { root: 41, tones: [41, 45, 48, 53], up: [53, 57, 60, 65] },
  E: { root: 40, tones: [40, 44, 47, 52], up: [52, 56, 59, 64] },
  Dm: { root: 38, tones: [38, 41, 45, 50], up: [50, 53, 57, 62] },
  C: { root: 36, tones: [36, 40, 43, 48], up: [48, 52, 55, 60] },
};
const CHT = [];
function plan(b0, s) { let b = b0; for (const tok of s.split(' ')) { const [nm, n] = tok.split(':'); CHT.push([bt(b), nm]); b += +n; } return b; }
plan(0, 'Am:14');                         // night, lone whistle, heartbeat, trap
plan(14, 'Am:2 G:2 F:1 E:1');             // TITLE 9.333
plan(20, 'Am:2 G:2 F:2 E:2');             // whistle theme, skewer
plan(28, 'Am:2 E:2');                     // straw, dan bau answer
plan(32, 'Dm:1 E:1');                     // lighter tension
plan(34, 'Am:2 G:2 F:2 E:2');             // IGNITION 22.667
plan(42, 'Am:2 E:2');                     // scraping
plan(46, 'Am:2 Dm:2 E:2 Am:2');           // hero 30.667
plan(54, 'F:2 G:2 Am:2 E:3');             // plate, lime, roll
plan(63, 'Am:1 E:1 Am:1 E:1 Am:1 E:1');   // ACT III playful
plan(69, 'Dm:1 E:1 F:1');                 // boing / bonk / SLAP
plan(72, 'E:3');                          // wobble
plan(75, 'Am:4');                         // splash -> hush
plan(79, 'E:1 Am:1');                     // burst, ribbit
plan(81, 'Am:1');                         // wah-wah-waaah
plan(82, 'F:2 C:2 G:2 Am:1 F:1 E:1');     // warm reprise, bite
plan(91, 'Am:2 G:2 F:1 E:1');             // end card 60.667
plan(97, 'Am:2 Dm:1 E:1 Am:4');           // CTA + final chord
function chordAt(t) { let c = CHT[0][1]; for (const [s, nm] of CHT) { if (t >= s - 1e-6) c = nm; else break; } return c; }
const pos8 = (t0, p) => t0 + p * E8;

// ---- Morricone whistle: sine + breath at the pitch + air hiss, portamento from the previous note, delayed vibrato, optional glide up
function whistle(m, len, o = {}) {
  const L = q05(len), from = o.from ?? m, gl = o.gl || 0, vib = o.vib ?? 1;
  return memo(`wh${m}|${L}|${from}|${gl}|${vib}`, () => {
    const R = rngFor(`wh${m}|${L}|${from}|${gl}`), rel = 0.07, n = secs(L + rel), y = new Float32Array(n);
    const br = scaleTo(filt(noise(R, n), 'bp', m2f(m + gl * 0.5), 3), 1), hs = scaleTo(filt(filt(noise(R, n), 'hp', 2500, 0.7), 'lp', 8000, 0.7), 1);
    const port = from !== m ? Math.min(0.08, L * 0.35) : 0; let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let mm = port ? from + (m - from) * smooth(t / port) : m - 0.3 * (1 - smooth(t / 0.03));
      if (gl) mm += gl * Math.pow(smooth(t / L), 0.8);
      mm += vib * 0.2 * Math.sin(TAU * 5.7 * t) * smooth((t - 0.16) / 0.25);
      ph += m2f(mm) / SR; ph -= Math.floor(ph);
      let e = smooth(t / 0.035) * (0.92 + 0.08 * Math.sin(TAU * 1.1 * t));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = ((Math.sin(TAU * ph) + 0.04 * Math.sin(2 * TAU * ph)) + br[i] * 0.1 * (0.5 + 0.5 * Math.exp(-t / 0.06)) + hs[i] * 0.02) * e;
    }
    return scaleTo(fadeEdges(y, 0.002, 0.02), 1);
  });
}
// ---- baritone electric guitar: bright bridge-pickup KS, overdrive, whammy vibrato / dive
function bari(m, len, o = {}) {
  const L = q05(len), wh = o.wh || 0, dive = o.dive || 0, dr = o.dr ?? 2.2, t60 = o.t60 ?? 3.2, ch = o.ch ?? 0.09;
  return memo(`bar${m}|${L}|${wh}|${dive}|${dr}|${t60}|${ch}`, () => {
    const f = (wh || dive) ? (t) => m2f(m + wh * 0.35 * Math.sin(TAU * 5.2 * t) * smooth((t - 0.12) / 0.3) - dive * smooth((t - 0.15) / Math.max(0.1, L - 0.15))) : m2f(m);
    const y = ks(f, L + 0.3, { t60, s: 0.28, bright: 0.92, pos: 0.09, seed: 5000 + m * 7 });
    choke(y, L, ch); scaleTo(y, 1);
    for (let i = 0; i < y.length; i++) y[i] = Math.tanh(dr * y[i]) / Math.tanh(dr);
    return scaleTo(fadeEdges(y, 0.0003, 0.03), 1);
  });
}
function putG(t, sig, o = {}) { put(GTR, t, sig, o); if (o.spring) put(GSP, t, sig, { gain: (o.gain ?? 1) * o.spring, pan: o.pan }); }
// tremolo picking (32nds); rise = chromatic climb over the stretch (comic wobble)
function tremolo(t0, dur, notes, g0, g1, o = {}) {
  const step = BEAT / 8, rise = o.rise || 0, pan = o.pan ?? -0.3;
  for (let t = t0, k = 0; t < t0 + dur - 1e-6; t += step, k++) {
    const u = (t - t0) / dur, up = Math.floor(rise * u + 1e-9);
    notes.forEach((m, j) => putG(t + j * 0.004, bari(m + up, 0.1, { dr: 1.6, t60: 1.2, ch: 0.03 }), { gain: (g0 + (g1 - g0) * u) * (k % 2 ? 0.75 : 1) * (j ? 0.7 : 1), pan: pan + j * 0.12, spring: o.spring ?? 0.5 }));
  }
}
// ---- trumpet: two saws, scoop, swell, fall-off, vibrato; brightness follows dynamics. mute 1 = harmon "wah", 2 = wobbling sad "waaah"
function trumpet(m, len, o = {}) {
  const L = q05(len), sw = o.sw || 0, fall = o.fall || 0, mute = o.mute || 0, vib = o.vib ?? 1, sc = o.sc ?? 0.7;
  return memo(`tp${m}|${L}|${sw}|${fall}|${mute}|${vib}|${sc}`, () => {
    const R = rngFor(`tp${m}|${L}|${sw}|${fall}|${mute}`), rel = fall ? 0.35 : 0.08, n = secs(L + rel), y = new Float32Array(n), env = new Float32Array(n);
    const ph = [R(), R()], det = [1, 1.0025];
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let e = sw ? 0.2 + 0.8 * smooth(t / Math.max(0.05, L * sw)) : smooth(t / 0.03) * (0.82 + 0.3 * Math.exp(-t / 0.07));
      if (t > L) e *= fall ? 1 - smooth((t - L) / rel) : 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      let mm = m - sc * (1 - smooth(t / 0.05)) + vib * 0.14 * Math.sin(TAU * 5.4 * t) * smooth((t - 0.2) / 0.3);
      if (fall) mm -= fall * Math.pow(smooth((t - L * 0.8) / (L * 0.2 + rel)), 1.5);
      if (mute === 2) mm += 0.4 * Math.sin(TAU * 6 * t) * smooth((t - 0.12) / 0.2);
      const f = m2f(mm), tab = sawTab(f); let s = 0;
      for (let k = 0; k < 2; k++) { ph[k] += f * det[k] / SR; ph[k] -= Math.floor(ph[k]); s += tabRead(tab, ph[k]); }
      y[i] = s * 0.5 * e; env[i] = e;
    }
    const envF = (t) => env[Math.min(n - 1, Math.round(t * SR))];
    let out;
    if (mute) {
      const wahF = (t) => 480 + 1600 * smooth(t / 0.12) * (mute === 2 ? 0.6 + 0.4 * Math.cos(TAU * 1.7 * t) : 1 - 0.55 * smooth((t - L * 0.55) / (L * 0.45)));
      out = filt(y, 'bp', wahF, 2.4); filtIn(out, 'hp', 330, 0.7); addInto(out, filt(y, 'bp', 1800, 4), 0, 0.25);
    } else {
      out = filt(y, 'lp', (t) => 700 + 5200 * envF(t), 0.8); addInto(out, filt(y, 'bp', 1250, 1.6), 0, 0.5); addInto(out, filt(y, 'bp', 2600, 2), 0, 0.25);
    }
    scaleTo(out, 1); for (let i = 0; i < n; i++) out[i] = Math.tanh(1.6 * out[i]);
    return scaleTo(fadeEdges(out, 0.001, 0.02), 1);
  });
}
// ---- dan bau: near-sine harmonic tone, pluck tick, big lever bends b = [[fraction of note, semitones], ...]
function bau(m, len, o = {}) {
  const L = q05(len), b = o.b || [[0, 0]], vib = o.vib ?? 1;
  const key = `bau${m}|${L}|${JSON.stringify(b)}|${vib}`;
  return memo(key, () => {
    const R = rngFor(key), rel = 0.1, n = secs(L + rel), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, mm = m + pw(b, t / L) + vib * 0.18 * Math.sin(TAU * 5.2 * t) * smooth((t - 0.25) / 0.3);
      ph += m2f(mm) / SR; ph -= Math.floor(ph); const p = TAU * ph;
      let e = Math.min(1, t / 0.003) * (0.45 + 0.55 * Math.exp(-t / 0.18)) * Math.exp(-t / 3);
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (Math.sin(p) + 0.3 * Math.exp(-t / 0.4) * Math.sin(2 * p) + 0.12 * Math.exp(-t / 0.2) * Math.sin(3 * p) + 0.05 * Math.sin(4 * p)) * e;
    }
    addInto(y, burst(R, 0.01, 'bp', 2500, 1, 0.002), 0, 0.15);
    return scaleTo(fadeEdges(y, 0.0005, 0.02), 1);
  });
}
// ---- percussion: woodblocks, timpani, tam-tam gong, whip
function wblock(hi) { return memo('wb' + hi, () => { const f = hi ? 1180 : 790, R = rngFor('wb' + hi); const y = modal([[f, 1, 0.045], [f * 2.73, 0.3, 0.02], [f * 4.1, 0.1, 0.01]], 0.15); addInto(y, burst(R, 0.006, 'bp', 3000, 1, 0.0015), 0, 0.5); return scaleTo(y, 1); }); }
function timp(f) { return memo('tim' + f, () => { const R = rngFor('tim' + f), y = modal([[f, 1, 0.5], [f * 1.5, 0.45, 0.35], [f * 1.99, 0.3, 0.28], [f * 2.44, 0.15, 0.2]], 1.2, 0.002); addInto(y, burst(R, 0.05, 'lp', 400, 0.7, 0.015), 0, 0.4); return scaleTo(y, 1); }); }
function timpRoll(t0, dur, f, g0, g1) { for (let t = t0, k = 0; t < t0 + dur - 1e-6; t += 0.05, k++) { const u = (t - t0) / dur; put(ML, t, timp(f + (k % 2)), { gain: g0 + (g1 - g0) * u * u, pan: k % 2 ? 0.15 : -0.15, hall: 0.12 }); } }
function gong(dur = 5, k = 1) {
  return memo(`gong${dur}|${k}`, () => {
    const R = rngFor(`gong${dur}|${k}`), base = [1, 1.52, 2.03, 2.61, 3.11, 3.82, 4.47, 5.2, 6.3, 7.4, 8.9, 10.6, 12.3, 14.8];
    const modes = base.map((r, i) => [58 * k * r * (1 + 0.004 * (R() - 0.5)), Math.pow(0.8, i) * (0.6 + 0.4 * R()), dur * (0.45 - 0.022 * i)]);
    const y = modal(modes, dur, 0.002), n = y.length;
    const sh = filt(filt(noise(R, n), 'bp', 1400, 0.6), 'hp', 600, 0.7);
    for (let i = 0; i < n; i++) { const t = i / SR; sh[i] *= smooth(t / 0.3) * Math.exp(-t / (dur * 0.3)); }
    addInto(y, scaleTo(sh, 0.25), 0, 1);
    addInto(y, scaleTo(burst(R, 0.12, 'lp', 180, 0.7, 0.04), 0.6), 0, 1);
    return scaleTo(fadeEdges(y, 0.001, 0.3), 1);
  });
}
function whip(R) { const y = new Float32Array(secs(0.45)); addInto(y, scaleTo(whoosh(R, 0.2, 600, 3500, 4000, 0.85, 1.0), 0.45), 0, 1); addInto(y, scaleTo(burst(R, 0.06, 'hp', 1800, 0.7, 0.008, 0.0002), 1), secs(0.19), 1.2); addInto(y, modal([[2400, 1, 0.012], [4100, 0.6, 0.008]], 0.05), secs(0.19), 0.5); return scaleTo(y, 1); }
const WHIP_AT = 0.19;
function whipAt(t, g = 0.3, pan = 0.25) { const R = rngFor('whip' + t); put(SFX, t - WHIP_AT, whip(R), { gain: g, pan, room: 0.15, hall: 0.12 }); }
// ---- wordless male choir (formant voices, 2 per note, spread across the stereo field)
function choir(notes, dur, o = {}) {
  const v1 = o.v1 || 'oo', v2 = o.v2 || 'a', key = `cho${notes.join(',')}|${dur}|${v1}|${v2}|${o.att ?? 0.2}`;
  return memo(key, () => {
    const R = rngFor(key), n = secs(dur + 0.12), L = new Float32Array(n), Rr = new Float32Array(n), V = notes.length * 2;
    notes.forEach((m, k) => {
      for (let d = 0; d < 2; d++) {
        const f = m2f(m) * (d ? 1.007 : 0.996);
        const x = scaleTo(talk(R, [{ d: dur, v: v1, v2, f0: f, f1: f, a: 1, att: o.att ?? 0.2, rel: o.rel ?? 0.5, br: 0.12 }], { fs: 0.92, bw: 1.3 }), 1);
        const p = -0.75 + 1.5 * ((k * 2 + d) / (V - 1)), dt = secs(R() * 0.03);
        addInto(L, x, dt, Math.cos((p + 1) * Math.PI / 4)); addInto(Rr, x, dt, Math.sin((p + 1) * Math.PI / 4));
      }
    });
    let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(L[i]), Math.abs(Rr[i])); for (let i = 0; i < n; i++) { L[i] /= mx; Rr[i] /= mx; }
    return { L, R: Rr };
  });
}
// ---- creatures + voices
function croak(R, f0 = 120, d = 0.14, am = 32) {
  const n = secs(d), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += f0 * (1 + 0.15 * (1 - t / d)) / SR; ph -= Math.floor(ph); const g = Math.sin(TAU * am * t) > 0 ? 1 : 0.15; y[i] = (2 * ph - 1) * g * Math.sin(Math.PI * t / d); }
  const z = filt(y, 'bp', 800, 2.5); addInto(z, filt(y, 'bp', 1600, 3), 0, 0.6); filtIn(z, 'hp', 200, 0.7);
  scaleTo(z, 1); for (let i = 0; i < n; i++) z[i] = Math.tanh(2 * z[i]);
  return scaleTo(fadeEdges(z, 0.002, 0.01), 1);
}
function ribbit(R) { const y = new Float32Array(secs(0.45)); addInto(y, croak(R, 190, 0.13, 38), 0, 1); addInto(y, croak(R, 215, 0.15, 42), secs(0.19), 1); return scaleTo(y, 1); }
function owl(R) {
  const y = new Float32Array(secs(1.3));
  const hoot = (d, f0, f1) => { const n = secs(d), x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += (f0 + (f1 - f0) * u) / SR; x[i] = Math.sin(TAU * ph) * Math.pow(Math.sin(Math.PI * u), 0.7); } const b = scaleTo(filt(noise(R, n), 'bp', f0, 4), 0.2); for (let i = 0; i < n; i++) b[i] *= Math.sin(Math.PI * i / n); addInto(x, b, 0, 1); return x; };
  addInto(y, hoot(0.22, 400, 380), 0, 0.7); addInto(y, hoot(0.42, 410, 360), secs(0.42), 1);
  return scaleTo(fadeEdges(y, 0.01, 0.02), 1);
}
const vWow = (R) => voc(R, [{ d: 0.07, v: 'u', f0: 165, f1: 175, a: 0.6, att: 0.03, rel: 0.005 }, { d: 0.36, v: 'u', v2: 'a', f0: 175, f1: 240, a: 1, att: 0.005, rel: 0.005 }, { d: 0.32, v: 'a', v2: 'oo', f0: 240, f1: 165, a: 1, att: 0.005, rel: 0.15 }], ADULT);
const vMmm = (R) => { const x = voc(R, [{ d: 0.32, v: 'u', v2: 'oo', f0: 135, f1: 150, a: 0.8, att: 0.06, rel: 0.05, br: 0.04 }, { d: 0.6, v: 'oo', f0: 160, f1: 190, a: 1, att: 0.05, rel: 0.25, br: 0.04 }], ADULT); return scaleTo(filtIn(x, 'lp', 900, 0.7), 1); };
const vGasp = (R) => voc(R, [{ d: 0.16, n: 'h', na: 0.9 }, { d: 0.2, v: 'a', v2: 'uh', f0: 210, f1: 185, a: 0.7, br: 0.8, att: 0.01, rel: 0.08 }], ADULT);
const segHa = (f) => [{ d: 0.05, n: 'h', na: 0.5 }, { d: 0.2, v: 'a', f0: f, f1: f * 0.94, a: 1, att: 0.01, rel: 0.08 }];
const HA_V = [[120, ADULT, -0.3, 0], [128, ADULT, 0.25, 0.01], [150, ADULT, 0, 0.018]];
function sparkTick(v) { return memo('spk' + (v % 6), () => { const R = rngFor('spk' + (v % 6)), y = burst(R, 0.03, 'hp', 2800 + 600 * (v % 3), 0.7, 0.004, 0.0002); addInto(y, scaleTo(crinkle(R, 0.025, 900, 2500, 9000), 0.5), 0, 1); return scaleTo(y, 1); }); }
function bonk(R) { const y = modal([[310, 1, 0.07], [760, 0.5, 0.04], [1290, 0.25, 0.025]], 0.3); addInto(y, scaleTo(woodThunk(R, 150), 0.8), 0, 1); addInto(y, tom(120), 0, 0.5); return scaleTo(y, 1); }

// ======================================================================= arrangement helpers
// whistle / trumpet / bau / kim phrases in straight 8ths from t0: [pos, len8, midi, opts]
function whiMel(t0, arr, g = 0.2, pan = 0.12) {
  let prev = null;
  for (const [p, l, m, op = {}] of arr) {
    const from = op.from ?? (prev != null && Math.abs(prev - m) <= 7 && !op.noport ? prev : m);
    put(WHI, pos8(t0, p), whistle(m, l * E8 * 0.96, { ...op, from }), { gain: g * (op.g ?? 1), pan, hall: 0.38, room: 0.04 });
    prev = m;
  }
}
function tptMel(t0, arr, g = 0.2, pan = -0.1) { for (const [p, l, m, op = {}] of arr) put(TPT, pos8(t0, p), trumpet(m, l * E8 * (op.stac ?? 0.95), op), { gain: g * (op.g ?? 1), pan, hall: 0.3, room: 0.05 }); }
function bauMel(t0, arr, g = 0.2, pan = -0.22) { for (const [p, l, m, op = {}] of arr) put(BAU, pos8(t0, p), bau(m, l * E8 * 0.97, op), { gain: g * (op.g ?? 1), pan, hall: 0.3, room: 0.04 }); }
function kimMel(t0, arr, g = 0.2, pan = 0.3) { for (const [p, l, m, op = {}] of arr) put(KIM, pos8(t0, p), kim(m, l * E8 * 0.95, op), { gain: g * (op.g ?? 1), pan, hall: 0.18, room: 0.05 }); }
// rhythm section over nb beats from beat b0
function band(b0, nb, o = {}) {
  const bg = o.bg ?? 1, gg = o.gg ?? 1;
  for (let k = 0; k < nb; k++) {
    const b = b0 + k, t = bt(b), j = k % 4, nm = chordAt(t + 1e-3), c = CH[nm];
    const fresh = k === 0 || chordAt(t - BEAT + 1e-3) !== nm, fifth = c.root + 7 > 50 ? c.root - 5 : c.root + 7;
    // bass
    if (o.bass === 'boom') { if (j === 0 || fresh) put(ML, t, ubass(c.root, BEAT * 1.8), { gain: 0.5 * bg }); else if (j === 2) put(ML, t, ubass(fifth, BEAT * 1.6), { gain: 0.42 * bg }); }
    else if (o.bass === 'gallop') { put(ML, t, ubass(j % 2 ? fifth : c.root, BEAT * 0.45), { gain: 0.46 * bg }); put(ML, t + BEAT * 0.75, ubass(c.root, 0.12), { gain: 0.24 * bg }); }
    else if (o.bass === 'pedal') { if (j === 0 || fresh) put(ML, t, ubass(c.root, BEAT * Math.min(3.7, nb - k)), { gain: 0.45 * bg }); }
    else if (o.bass === 'oompah') put(ML, t, ubass(fresh ? c.root : fifth, BEAT * 0.35), { gain: 0.46 * bg });
    // heartbeat (lub-dub) and kick
    if (o.heart && (j === 0 || j === 2)) { put(ML, t, tom(66), { gain: 0.55 * o.heart }); put(ML, t + 0.17, tom(58), { gain: 0.35 * o.heart }); }
    if (o.kick && j % 2 === 0) put(ML, t, kick(), { gain: 0.32 * o.kick });
    // clip-clop gallop woodblocks (ka-ta-KUM)
    if (o.clip) { put(MH, t, wblock(1), { gain: 0.085 * o.clip, pan: 0.32, room: 0.1 }); put(MH, t + BEAT * 0.5, wblock(0), { gain: 0.065 * o.clip, pan: 0.24, room: 0.1 }); put(MH, t + BEAT * 0.75, wblock(1), { gain: 0.05 * o.clip, pan: 0.32, room: 0.1 }); }
    // cabasa 8ths (accented offbeat)
    if (o.cab) for (let e = 0; e < 2; e++) put(MH, t + e * E8, shaker(e === 1, k * 2 + e), { gain: (e ? 0.055 : 0.035) * o.cab, pan: -0.34 });
    // guitar
    if (o.gtr === 'riff') {
      if (j === 0 || fresh) putG(t, bari(c.root, BEAT * 0.9, { wh: 0.6 }), { gain: 0.17 * gg, pan: -0.25, spring: 0.55, room: 0.05 });
      if (j === 1) putG(t + E8, bari(c.root + 12, 0.16), { gain: 0.12 * gg, pan: -0.25, spring: 0.4 });
      if (j === 2 && !fresh) putG(t, bari(fifth + 12 > 57 ? fifth : fifth + 12, BEAT * 0.45), { gain: 0.13 * gg, pan: -0.25, spring: 0.45 });
      if (j === 3) { putG(t, bari(c.root + 12, 0.16), { gain: 0.1 * gg, pan: -0.25, spring: 0.4 }); putG(t + E8, bari(c.root + 10, 0.16), { gain: 0.1 * gg, pan: -0.25, spring: 0.4 }); }
    } else if (o.gtr === 'trem') {
      tremolo(t, BEAT, [c.up[0], c.up[2]], (o.tg0 ?? 0.05) + ((o.tg1 ?? 0.05) - (o.tg0 ?? 0.05)) * k / nb, (o.tg0 ?? 0.05) + ((o.tg1 ?? 0.05) - (o.tg0 ?? 0.05)) * (k + 1) / nb);
    } else if (o.gtr === 'pizz') {
      if (j % 2 === 0 || fresh) putG(t, bari(c.root + 12, 0.1, { dr: 1.4, t60: 0.8, ch: 0.03 }), { gain: 0.16 * gg, pan: -0.25, spring: 0.25 });
      else { putG(t, bari(c.up[1], 0.09, { dr: 1.4, t60: 0.8, ch: 0.03 }), { gain: 0.11 * gg, pan: -0.3, spring: 0.25 }); putG(t + 0.006, bari(c.up[2], 0.09, { dr: 1.4, t60: 0.8, ch: 0.03 }), { gain: 0.09 * gg, pan: -0.2, spring: 0.25 }); }
    } else if (o.gtr === 'arp') {
      for (let e = 0; e < 2; e++) { const m = c.up[(k * 2 + e) % 4]; putG(t + e * E8, bari(m, BEAT * 0.9, { dr: 1.2, t60: 2.2 }), { gain: 0.08 * gg, pan: -0.28, spring: 0.5 }); }
      if (j === 0 || fresh) putG(t, bari(c.root, BEAT * 1.6, { dr: 1.3 }), { gain: 0.1 * gg, pan: -0.2, spring: 0.5 });
    }
  }
}
// band stab: guitar + bass (+ trumpet note)
function stab(t, nm, g = 1, o = {}) {
  const c = CH[nm];
  putG(t, bari(c.root, o.len ?? 0.4, { wh: 0.4 }), { gain: 0.2 * g, pan: -0.25, spring: 0.6 });
  putG(t + 0.005, bari(c.up[2], o.len ?? 0.4), { gain: 0.12 * g, pan: -0.15, spring: 0.5 });
  put(ML, t, ubass(c.root, o.blen ?? 0.5), { gain: 0.55 * g });
  if (o.kick) put(ML, t, kick(), { gain: 0.4 * g });
  if (o.tpt) put(TPT, t, trumpet(o.tpt, o.tlen ?? 0.3, { mute: o.mute || 0 }), { gain: 0.2 * g, pan: -0.1, hall: 0.2 });
}
// melodies (straight 8ths)
const WTHEME = [[0, 1, 76], [1, 1, 81], [2, 2, 84, { vib: 1.2 }], [4, 1, 83], [5, 1, 81], [6, 2, 79], [8, 2, 77], [10, 1, 81], [11, 1, 77], [12, 4, 76, { vib: 1.4 }]];  // Am G F E
const WANS = [[0, 1, 81], [1, 1, 84], [2, 2, 88, { vib: 1.2 }], [4, 2, 86], [6, 2, 81], [8, 2, 80], [10, 2, 83], [12, 4, 81, { vib: 1.4 }]];                     // Am Dm E Am
const TTHEME = [[0, 1, 64, { sc: 1.2 }], [1, 1, 69], [2, 3, 72, { vib: 1.2 }], [5, 1, 71], [6, 2, 67], [8, 1, 69], [9, 1, 72], [10, 2, 77], [12, 4, 76, { vib: 1.3 }]]; // Am G F E

// ======================================================================= SCORE
// ---------- ambience: flood-season night (AMB_KEYS) - water lapping, crickets, frogs, owl, firefly chimes; straw fire bed (FIRE_KEYS)
{
  const R = rngFor('amb');
  putAmb(0, waterLap(R, DUR), { gain: 0.45 });
  put(FX2, 0, crickets(R, DUR), { gain: 0.045, env: (t) => Math.min(1, ambEnv(t) * 1.5) });
  for (let t = 0.4; t < DUR - 0.5; t += 0.5 + R() * 1.6) putAmb(t, croak(R, 95 + R() * 60, 0.1 + 0.08 * R(), 24 + R() * 16), { gain: 0.03 + 0.035 * R(), pan: R() * 1.6 - 0.8, hall: 0.12 });
  for (const [t, p] of [[1.8, 0.6], [31.2, -0.6], [57.3, 0.5], [62.4, -0.5]]) putAmb(t, owl(R), { gain: 0.05, pan: p, hall: 0.35 });
  for (const [a, b] of [[0.3, 9.0], [13.4, 22.4], [54.2, 69.0]]) for (let t = a + R() * 0.4; t < b; t += 0.35 + R() * 0.9) put(FX2, t, ting(m2f(96 + ((R() * 12) | 0)), 0.5), { gain: 0.008 + 0.008 * R(), pan: R() * 1.6 - 0.8, hall: 0.4, env: ambEnv });
  put(FX2, 9.2, fireBed(R, 60.75), { gain: 0.14, env: fireEnv });
  // the fire as an instrument: spark 16ths on the music bus
  for (let t = bt(34), k = 0; t < FADE0; t += S16, k++) { const e = pw(FMUS_KEYS, t); if (e <= 0.01 || (k % 4 && R() < 0.2)) continue; put(MH, t + (R() - 0.5) * 0.006, sparkTick(k), { gain: 0.05 * e * [1, 0.4, 0.65, 0.45][k % 4], pan: R() * 1.2 - 0.6, room: 0.06 }); }
}

// ---------- ACT I 0-9.333: lone whistle + guitar twang over the moonlit field; heartbeat at 4.0; trap SPLASH ~7.5; "wow"
{
  const R = rngFor('act1');
  putG(0.25, bari(33, 3.0, { wh: 1, t60: 5, dr: 2.6 }), { gain: 0.2, pan: -0.2, spring: 0.9, hall: 0.1 });
  whiMel(bt(1), [[0, 3, 76, { vib: 1.2 }], [3, 1, 81], [4, 5, 84, { vib: 1.3 }], [9, 1, 83]], 0.2);
  putG(bt(4), bari(40, 1.3, { wh: 1.2 }), { gain: 0.15, pan: -0.25, spring: 0.8 });
  // heartbeat enters at 4.0 (beat 6)
  band(6, 8, { heart: 1, bass: 'pedal', bg: 0.8, gtr: 'trem', tg0: 0.02, tg1: 0.06 });
  whiMel(bt(6), [[0, 2, 81], [2, 1, 79], [3, 1, 77], [4, 4, 76, { vib: 1.4 }]], 0.19);
  put(BAU, bt(10), bau(69, 0.9, { b: [[0, -5], [0.25, 0], [0.7, 0], [1, -2]] }), { gain: 0.2, pan: -0.22, hall: 0.3 });
  // the trap slams down, SPLASH, the fish thrashes
  put(SFX, 7.46, woodThunk(R, 150), { gain: 0.35, pan: 0.05, room: 0.12 });
  put(SFX, 7.5, splash(R, 1.4), { gain: 0.62, pan: 0.05, room: 0.15, hall: 0.06 });
  put(SFX, 7.5, bigBoom(R, 0.8, 80, 40, 0.25), { gain: 0.3 });
  for (let t = 7.68; t < 8.8; t += 0.08 + R() * 0.08) put(SFX, t, splash(R, 0.15 + 0.15 * R()), { gain: 0.16 + 0.1 * R(), pan: R() * 0.6 - 0.3 });
  put(SFX, 7.95, chatSlap(R), { gain: 0.12, pan: 0.1 });
  put(SFX, 8.05, vWow(R), { gain: 0.32, pan: 0.25, room: 0.15, hall: 0.05 });
  // build into the title
  timpRoll(8.1, 9.333 - 8.1, 44, 0.05, 0.3);
  put(MH, 9.333 - 1.2, reverseCrash(R, 1.2), { gain: 0.12, hall: 0.1 });
  put(SFX, 9.333 - 0.9, riser(R, 0.9, 300, 6000), { gain: 0.1, pan: 0 });
}

// ---------- TITLE 9.333: gong + whip + full band + bonfire roar + trumpet theme
{
  const R = rngFor('title'), t0 = bt(14);
  put(MH, t0, gong(5, 1), { gain: 0.32, hall: 0.35 });
  whipAt(t0, 0.38);
  put(SFX, t0, bigBoom(R, 1.6, 90, 32, 0.5), { gain: 0.42 });
  put(SFX, t0, flare(R, 2.4), { gain: 0.32, pan: 0 });
  put(SFX, t0 + 0.05, crinkle(R, 2.0, 160, 2000, 9000), { gain: 0.18, pan: 0.1 });
  put(CHO, t0, choir([45, 52, 57, 60], 2.4, { v1: 'oo', v2: 'a', att: 0.1 }), { gain: 0.2, hall: 0.3 });
  band(14, 6, { bass: 'boom', heart: 0.5, kick: 1, gtr: 'riff', cab: 1 });
  tptMel(t0, TTHEME.slice(0, 7).concat([[10, 2, 71, { fall: 2 }]]), 0.22);
  tptMel(t0, [[0, 1, 57], [1, 1, 64], [2, 3, 64], [5, 1, 67], [6, 2, 62], [8, 1, 65], [9, 1, 69], [10, 2, 68, { fall: 2 }]], 0.12, 0.2);
  put(MH, t0, crash(R, 2.2), { gain: 0.12, hall: 0.2 });
}

// ---------- ACT II 13.333-22.667: whistle theme over the gallop; skewer 16.667 / 17.333; straw 19.333 / 20.0; lighter 22.0
{
  const R = rngFor('act2'), t0 = bt(20);
  band(20, 12, { bass: 'gallop', bg: 0.9, clip: 1, cab: 0.8, gtr: 'riff', gg: 0.7 });
  whiMel(t0, WTHEME, 0.21);
  kimMel(bt(26), [[0, 1, 76], [1, 1, 74], [2, 1, 71], [3, 1, 68, { sl: 1 }]], 0.17);
  bauMel(bt(28), [[0, 4, 69, { b: [[0, -5], [0.2, 0], [0.7, 0], [0.85, 2], [1, 0]] }], [4, 4, 71, { b: [[0, 0], [0.4, 0], [0.55, 1], [0.75, 1], [1, -1]] }]], 0.22);
  // skewer pushes
  for (const t of [16.667, 17.333]) { put(SFX, t, woodThunk(R, 240), { gain: 0.3, pan: 0.1, room: 0.1 }); put(SFX, t + 0.02, squeak(R, 950), { gain: 0.16, pan: 0.1 }); put(SFX, t + 0.03, creak(R, 0.25, 420), { gain: 0.1, pan: 0.12 }); }
  // straw armfuls
  for (const t of [19.333, 20.0]) { put(SFX, t, leafRustle(R, 0.6), { gain: 0.3, pan: -0.15, room: 0.08 }); put(SFX, t, crinkle(R, 0.55, 320, 1500, 8000), { gain: 0.26, pan: -0.1 }); put(SFX, t, softThud(R), { gain: 0.14, pan: -0.1 }); }
  // tension 21.333-22.667: band drops to heartbeat + tremolo, timpani roll, reverse crash into the ignition
  band(32, 2, { heart: 1.1, bass: 'pedal', gtr: 'trem', tg0: 0.06, tg1: 0.13 });
  timpRoll(21.6, 22.667 - 21.6, 45, 0.05, 0.32);
  put(MH, 22.667 - 1.3, reverseCrash(R, 1.3), { gain: 0.14, hall: 0.1 });
  // lighter click 22.0 + tiny flame
  put(SFX, 22.0, tick(R, 3600), { gain: 0.3, pan: 0.15 }); put(SFX, 22.0, uiClick(R), { gain: 0.3, pan: 0.15 });
  put(SFX, 22.01, burst(R, 0.06, 'hp', 3500, 0.7, 0.015), { gain: 0.18, pan: 0.15 });
  put(SFX, 22.06, whoosh(R, 0.35, 400, 2200, 900, 0.3), { gain: 0.16, pan: 0.15 });
}

// ---------- IGNITION 22.667: WHOOSH + choir + gong + roar + sparks; trumpet theme over the band; second straw 26.0
{
  const R = rngFor('ignite'), t0 = bt(34);
  put(SFX, t0 - 0.05, whoosh(R, 1.9, 150, 2800, 500, 0.2, 0.8), { gain: 0.6, pan: (t) => -0.3 + 0.3 * t, hall: 0.08 });
  put(SFX, t0, flare(R, 2.4), { gain: 0.5, pan: 0 });
  put(SFX, t0, swell(R, 3.0, 0.35), { gain: 0.42, pan: 0.05 });
  put(SFX, t0, bigBoom(R, 2.0, 90, 30, 0.6), { gain: 0.55 });
  put(SFX, t0 + 0.1, crinkle(R, 2.6, 200, 2000, 9000), { gain: 0.3, pan: 0.1 });
  sparkleAt(t0 + 0.15, R, 0.05, [88, 91, 95, 98, 100]);
  put(MH, t0, gong(5, 0.9), { gain: 0.36, hall: 0.35 });
  put(MH, t0, crash(R, 2.6), { gain: 0.14, hall: 0.25 });
  whipAt(t0, 0.3, -0.2);
  put(CHO, t0, choir([45, 52, 57, 60, 64], 3.2, { v1: 'oo', v2: 'a', att: 0.12 }), { gain: 0.26, hall: 0.35 });
  band(34, 8, { bass: 'boom', kick: 1, heart: 0.4, gtr: 'riff', clip: 0.8, cab: 1 });
  tptMel(t0, TTHEME, 0.23);
  tptMel(t0, [[0, 1, 57], [1, 1, 64], [2, 3, 64], [5, 1, 67], [6, 2, 62], [8, 1, 65], [9, 1, 69], [10, 2, 72], [12, 4, 68]], 0.12, 0.2);
  // second straw 26.0
  put(SFX, 26.0, leafRustle(R, 0.7), { gain: 0.26, pan: -0.2 }); put(SFX, 26.0, crinkle(R, 0.6, 300, 1500, 8000), { gain: 0.2, pan: -0.15 });
  put(SFX, 26.25, whoosh(R, 1.0, 200, 1800, 400, 0.3), { gain: 0.3, pan: 0 }); put(SFX, 26.3, flare(R, 1.2), { gain: 0.24, pan: 0.05 });
  put(CHO, 26.3, choir([45, 52, 57], 1.6, { v1: 'oo', v2: 'a', att: 0.25 }), { gain: 0.1, hall: 0.3 });
}

// ---------- 28-30.667 scraping on the beats; 30.667 HERO hit (trumpet + choir + sizzle); whistle answer
{
  const R = rngFor('scrape');
  band(42, 4, { bass: 'gallop', bg: 0.85, clip: 1, gtr: 'riff', gg: 0.6, cab: 0.6 });
  kimMel(bt(42), [[1, 1, 69], [3, 1, 72], [5, 1, 71], [7, 1, 68, { sl: 1 }]], 0.2);
  for (const t of [28.0, 28.667, 29.333, 30.0]) { put(SFX, t, forkScrape(R, 0.42), { gain: 0.3, pan: 0.1, room: 0.06 }); put(SFX, t, grate(R, 0.38), { gain: 0.12, pan: 0.15 }); }
  const t0 = bt(46);
  put(TPT, t0, trumpet(69, 1.1), { gain: 0.24, pan: -0.1, hall: 0.35 }); put(TPT, t0, trumpet(64, 1.1), { gain: 0.15, pan: 0.15, hall: 0.35 });
  put(CHO, t0, choir([45, 52, 57, 60], 1.8, { v1: 'a', v2: 'a', att: 0.04 }), { gain: 0.22, hall: 0.35 });
  put(SFX, t0, sizzle(R, 2.0), { gain: 0.42, pan: 0.05 }); put(SFX, t0 + 0.2, steamHiss(R, 1.5), { gain: 0.1, pan: -0.05 });
  put(MH, t0, gong(4, 1.15), { gain: 0.16, hall: 0.3 }); whipAt(t0, 0.2, 0.3);
  sparkleAt(t0 + 0.3, R, 0.045, [91, 95, 98, 103]);
  band(46, 8, { bass: 'boom', kick: 0.7, gtr: 'riff', gg: 0.8, clip: 0.7, cab: 0.8 });
  whiMel(t0, WANS, 0.2);
  bauMel(bt(53), [[0, 2, 76, { b: [[0, -2], [0.25, 0], [1, 0]] }]], 0.18);
}

// ---------- 36-42 plate: item taps 34-36, lime squelch 37.333 / 38.0, rice-paper crinkle 39.333-42; dan bau lead
{
  const R = rngFor('plate');
  for (const [t, p] of [[34.0, -0.2], [34.667, 0.15], [35.333, -0.05], [36.0, 0.2]]) { put(SFX, t, softThud(R), { gain: 0.26, pan: p, room: 0.08 }); put(SFX, t, herbTuk(R), { gain: 0.2, pan: p }); put(SFX, t + 0.01, leafRustle(R, 0.25), { gain: 0.12, pan: p }); }
  for (const t of [37.333, 38.0]) { put(SFX, t, squirt(R), { gain: 0.34, pan: 0.1, room: 0.06 }); put(SFX, t + 0.18, drip(R), { gain: 0.16, pan: 0.12 }); put(MH, t + 0.05, ting(m2f(98), 0.4), { gain: 0.03, pan: 0.3, hall: 0.3 }); }
  put(SFX, 39.333, crinkle(R, 2.6, 110, 1500, 7000), { gain: 0.3, pan: -0.05 });
  put(SFX, 39.4, leafRustle(R, 0.8), { gain: 0.12, pan: 0.05 });
  put(SFX, 41.33, smallSlurp(R, 0.15, 700, 1300), { gain: 0.08, pan: 0.1 });
  band(54, 9, { bass: 'boom', bg: 0.85, gtr: 'arp', clip: 0.5, cab: 0.7 });
  bauMel(bt(54), [[0, 3, 72, { b: [[0, -2], [0.15, 0], [1, 0]] }], [3, 1, 69], [4, 4, 71, { b: [[0, 0], [0.5, 0], [0.7, 1], [1, 0]] }], [8, 3, 72, { b: [[0, -3], [0.2, 0], [1, 0]] }], [11, 1, 71], [12, 6, 68, { b: [[0, -1], [0.15, 0], [0.7, 0], [1, -3]] }]], 0.24);
  whiMel(bt(60), [[0, 1, 76, { g: 0.7 }], [1, 1, 80, { g: 0.7 }], [2, 2, 83, { g: 0.7, vib: 1.3 }]], 0.18);
}

// ---------- ACT III 42.0: whip, playful staccato theme (pizzicato guitar, woodblocks, muted trumpet "wah")
{
  const R = rngFor('act3'), t0 = bt(63);
  whipAt(t0, 0.36, -0.25);
  put(MH, t0, crash(R, 1.4), { gain: 0.08, hall: 0.2 });
  band(63, 6, { bass: 'oompah', gtr: 'pizz', clip: 1.2, cab: 0.5 });
  tptMel(t0, [[0, 1, 76], [1, 1, 72], [2, 2, 71], [4, 1, 76], [5, 1, 72], [6, 2, 71], [8, 1, 69], [9, 1, 72], [10, 1, 74], [11, 1, 71]].map(([p, l, m]) => [p, l, m, { mute: 1, stac: 0.7, vib: 0.3 }]), 0.24, -0.05);
  kimMel(t0, [[1, 1, 81], [5, 1, 81], [9, 1, 84]], 0.12, 0.35);
  // boing 46.0 / bonk 46.667 / SLAP 47.333 - stop-time hits under the comedy
  put(SFX, 46.0, boing(), { gain: 0.38, pan: 0.1, room: 0.1 });
  put(SFX, 46.667, bonk(R), { gain: 0.42, pan: -0.05, room: 0.12 });
  put(SFX, 46.69, ting(m2f(91), 0.5), { gain: 0.06, pan: 0.2, hall: 0.2 });
  put(SFX, 47.333, chatSlap(R), { gain: 0.5, pan: 0.05, room: 0.12 });
  put(SFX, 47.333, splash(R, 0.25), { gain: 0.18, pan: 0.1 });
  put(SFX, 47.34, burst(R, 0.05, 'bp', 1200, 0.8, 0.012), { gain: 0.25, pan: 0 });
  stab(46.0, 'Dm', 0.7, { tpt: 74, mute: 1 }); stab(46.667, 'E', 0.75, { tpt: 76, mute: 1 }); stab(47.333, 'F', 0.9, { tpt: 77, mute: 1, kick: true });
  put(MH, 47.333, crash(R, 1.2), { gain: 0.07, hall: 0.15 });
  // wobble 48-50: rising tremolo + timpani + slide whistle DOWN
  tremolo(48.0, 2.0, [52, 59], 0.05, 0.14, { rise: 5, spring: 0.6 });
  put(ML, 48.0, ubass(40, 1.9), { gain: 0.42 });
  timpRoll(48.6, 1.4, 40, 0.04, 0.26);
  put(SFX, 48.1, slideWhistle(R, 1.85, 96, 62), { gain: 0.3, pan: (t) => 0.3 - 0.3 * t, hall: 0.15 });
  put(SFX, 48.2, whoosh(R, 0.5, 300, 1500, 600, 0.4), { gain: 0.12, pan: -0.2 });
  put(SFX, 48.9, whoosh(R, 0.5, 300, 1500, 600, 0.4), { gain: 0.12, pan: 0.2 });
  // SPLASH 50.0
  const tS = bt(75);
  put(SFX, tS, splash(R, 1.8), { gain: 0.75, pan: 0, room: 0.15, hall: 0.08 });
  put(SFX, tS, bigBoom(R, 1.2, 85, 32, 0.4), { gain: 0.5 });
  put(SFX, tS + 0.12, splash(R, 0.7), { gain: 0.3, pan: -0.3 }); put(SFX, tS + 0.2, splash(R, 0.6), { gain: 0.26, pan: 0.35 });
  for (let k = 0; k < 10; k++) put(SFX, tS + 0.4 + R() * 0.8, drip(R), { gain: 0.08 + 0.06 * R(), pan: R() * 1.4 - 0.7 });
  stab(tS, 'Am', 1.0, { kick: true, len: 1.0, blen: 1.2 });
  put(MH, tS, gong(3, 0.75), { gain: 0.2, hall: 0.25 });
  put(MH, tS, crash(R, 1.4), { gain: 0.1, hall: 0.2 });
  put(SFX, bt(76), whoosh(R, 0.6, 900, 300, 120, 0.2, 0.9), { gain: 0.16 });   // water closes over him (flash 50.667)
  put(SFX, bt(76), bubble(300, 0.12, 1.2), { gain: 0.2 });
}
// ---------- 51.333-52.667 hush (post-limiter). 52.667 burst out; 53.333 RIBBIT; wah-wah-waaah; fish plop + kim flourish ~53.8
{
  const R = rngFor('burst'), tB = bt(79);
  put(SFX, tB, splash(R, 1.1), { gain: 0.6, pan: 0, room: 0.12 });
  put(SFX, tB, whoosh(R, 0.5, 300, 3000, 1200, 0.3), { gain: 0.3, pan: 0 });
  put(SFX, tB + 0.08, vGasp(R), { gain: 0.3, pan: 0.1, room: 0.12 });
  stab(tB, 'E', 0.8, { len: 0.5 });
  put(MH, tB, wblock(1), { gain: 0.08, pan: 0.3 });
  const tF = bt(80);
  put(SFX, tF, ribbit(R), { gain: 0.48, pan: 0.15, room: 0.12, hall: 0.05 });
  put(ML, tF, ubass(45, 0.25), { gain: 0.4 }); put(MH, tF, wblock(0), { gain: 0.08, pan: 0.3 });
  put(SFX, 53.8, bloop(m2f(55)), { gain: 0.3, pan: -0.35, hall: 0.1 }); put(SFX, 53.82, basketShake(R), { gain: 0.24, pan: -0.35 }); put(SFX, 53.8, splash(R, 0.22), { gain: 0.15, pan: -0.35 });
  [69, 72, 74, 76, 79, 81].forEach((m, k) => put(KIM, 53.72 + k * 0.055, kim(m, 0.12, { vb: 0 }), { gain: 0.13, pan: -0.4, hall: 0.2 }));
  put(TPT, 53.6, trumpet(67, 0.3, { mute: 1, vib: 0.2 }), { gain: 0.26, pan: 0.05, hall: 0.2 });
  put(TPT, 53.98, trumpet(66, 0.3, { mute: 1, vib: 0.2 }), { gain: 0.26, pan: 0.05, hall: 0.2 });
  put(TPT, 54.36, trumpet(65, 1.0, { mute: 2, vib: 0 }), { gain: 0.28, pan: 0.05, hall: 0.25 });
  put(ML, 54.36, ubass(41, 0.9), { gain: 0.35 });
}

// ---------- ACT IV 54.667-60.667: warm reprise, laugh, bite 58.0 + "mmm"
{
  const R = rngFor('act4'), t0 = bt(82);
  band(82, 9, { bass: 'boom', bg: 0.8, gtr: 'arp', gg: 1.1, clip: 0.4, cab: 0.5 });
  whiMel(t0, [[0, 1, 72], [1, 1, 77], [2, 2, 81, { vib: 1.2 }], [4, 2, 79], [6, 2, 76], [8, 2, 74], [10, 2, 79], [12, 2, 76], [14, 2, 77], [16, 2, 76, { vib: 1.4 }]], 0.19);
  bauMel(bt(84), [[2, 2, 64, { b: [[0, -2], [0.3, 0], [1, 0]] }], [6, 2, 67, { b: [[0, 0], [0.6, 0], [1, 2]] }]], 0.16);
  put(CHO, t0, choir([41, 48, 57], 3.5, { v1: 'oo', v2: 'oo', att: 0.6, rel: 1.0 }), { gain: 0.09, hall: 0.3 });
  put(SFX, 54.8, crowdSay(R, segHa, HA_V), { gain: 0.22, room: 0.12, hall: 0.05 });
  put(SFX, 55.1, crowdSay(R, segHa, HA_V), { gain: 0.18, room: 0.12, hall: 0.05 });
  put(SFX, 56.7, inhale(R, 0.6), { gain: 0.1, pan: -0.1 });
  put(SFX, 58.0, crunch(R, 0.45, 650), { gain: 0.46, pan: 0, room: 0.1 });
  put(SFX, 58.0, crack(R), { gain: 0.28, pan: 0.05 });
  put(SFX, 58.2, crunch(R, 0.3, 900), { gain: 0.2, pan: -0.05 });
  put(SFX, 58.4, vMmm(R), { gain: 0.36, pan: 0.05, room: 0.12 });
  sparkleAt(58.9, R, 0.06, [86, 89, 93, 98, 101]);
}

// ---------- END CARD 60.667: soft gong + full whistle theme
{
  const R = rngFor('end'), t0 = bt(91);
  put(MH, t0, gong(5, 1.1), { gain: 0.2, hall: 0.35 });
  put(MH, t0, crash(R, 2.0), { gain: 0.07, hall: 0.3 });
  band(91, 6, { bass: 'boom', kick: 0.6, gtr: 'riff', gg: 0.8, clip: 0.8, cab: 0.8 });
  const WEND = [[0, 1, 76], [1, 1, 81], [2, 2, 84, { vib: 1.2 }], [4, 1, 83], [5, 1, 81], [6, 2, 79], [8, 1, 77], [9, 1, 81], [10, 2, 76, { vib: 1.3 }]];
  whiMel(t0, WEND, 0.22);
  tptMel(t0, WEND.map(([p, l, m, o]) => [p, l, m - 12, o]), 0.13, -0.15);
  put(CHO, t0, choir([45, 52, 57], 3.8, { v1: 'oo', v2: 'a', att: 0.5, rel: 1.0 }), { gain: 0.12, hall: 0.35 });
}

// ---------- CTA 64.667: heart pop; 66.0 FOLLOW click + whoosh; 66.667 wink = whistle gliss up + twang + whip; final chord, fade 69.333-70
{
  const R = rngFor('cta');
  band(97, 4, { bass: 'boom', gtr: 'arp', clip: 0.6, cab: 0.6 });
  put(SFX, 64.667, bloop(m2f(79)), { gain: 0.32, pan: -0.15, hall: 0.1 }); put(SFX, 64.667, heartThump(), { gain: 0.22 });
  put(MH, 64.72, ting(m2f(91), 0.7), { gain: 0.06, pan: -0.2, hall: 0.3 });
  put(SFX, 66.0, uiClick(R), { gain: 0.38, pan: 0.1 });
  put(SFX, 66.0, whoosh(R, 0.55, 300, 2600, 700, 0.3), { gain: 0.3, pan: (t) => -0.3 + t });
  put(MH, 66.02, ting(m2f(93), 0.8), { gain: 0.08, pan: 0.2, hall: 0.3 });
  const tW = bt(100);
  put(WHI, tW, whistle(79, 0.6, { gl: 12, vib: 0.4 }), { gain: 0.22, pan: 0.15, hall: 0.4 });
  putG(tW, bari(40, 1.2, { wh: 1.5 }), { gain: 0.2, pan: -0.2, spring: 1.0 });
  whipAt(tW, 0.36, 0.3);
  stab(tW, 'E', 0.8, { len: 0.5 });
  // final chord A minor add9 (67.333)
  const tF = bt(101), LF = DUR - tF;
  put(MH, tF, gong(4, 1.2), { gain: 0.16, hall: 0.35 });
  put(WHI, tF, whistle(81, LF - 0.1, { vib: 1.3, from: 79 }), { gain: 0.2, pan: 0.12, hall: 0.4 });
  put(TPT, tF, trumpet(69, LF - 0.2, { sw: 0.3 }), { gain: 0.18, pan: -0.1, hall: 0.35 });
  put(TPT, tF, trumpet(64, LF - 0.2, { sw: 0.3 }), { gain: 0.11, pan: 0.15, hall: 0.35 });
  put(BAU, tF + 0.1, bau(76, LF - 0.3, { b: [[0, -3], [0.12, 0], [0.6, 0], [0.8, 2], [1, 0]] }), { gain: 0.14, pan: -0.25, hall: 0.3 });
  tremolo(tF, LF, [57, 64], 0.06, 0.03, { spring: 0.6 });
  put(ML, tF, ubass(33, LF), { gain: 0.5 }); put(ML, tF, kick(), { gain: 0.35 });
  put(CHO, tF, choir([45, 52, 57, 59], LF, { v1: 'oo', v2: 'a', att: 0.3, rel: 1.0 }), { gain: 0.14, hall: 0.35 });
  put(MH, tF, crash(R, 2.4), { gain: 0.08, hall: 0.3 });
}

// ---------- instrument bus voicing -> MH (whistle, twangy guitar + spring reverb, trumpet, dan bau, kim, choir)
{
  const [spL, spR] = reverb(GSP.L, GSP.R, { size: 0.32, fb: 0.84, damp: 0.12, pre: 0.01, hp: 200, lp: 5500, inGain: 2.2, clearAt: I_S0 });
  for (const x of [spL, spR]) {
    for (let st = 0; st < 12; st++) { const a = 0.62; let x1 = 0, y1 = 0; for (let i = 0; i < N; i++) { const v = x[i], o = -a * v + x1 + a * y1; x1 = v; y1 = o; x[i] = o; } }
    filtIn(x, 'peak', 1800, 1.2, 3);
  }
  const SPR = { L: spL, R: spR };
  for (const ch of ['L', 'R']) {
    const w = WHI[ch], g = GTR[ch], tp = TPT[ch], b = BAU[ch], k = KIM[ch], c = CHO[ch], sp = SPR[ch];
    filtIn(w, 'hp', 300, 0.7); filtIn(w, 'lp', 9000, 0.7);
    filtIn(g, 'hp', 50, 0.7); filtIn(g, 'peak', 1300, 1.0, 4); filtIn(g, 'peak', 300, 1.0, -2); filtIn(g, 'lp', 6500, 0.7);
    filtIn(tp, 'hp', 160, 0.7); filtIn(tp, 'peak', 1300, 0.9, 1.5); filtIn(tp, 'lp', 8500, 0.7);
    filtIn(b, 'hp', 180, 0.7); filtIn(b, 'lp', 6000, 0.7);
    filtIn(k, 'hp', 200, 0.7); filtIn(k, 'peak', 1150, 1.5, 4.5); filtIn(k, 'peak', 2600, 1.4, 2); filtIn(k, 'lp', 5200, 0.7);
    filtIn(c, 'hp', 90, 0.7); filtIn(c, 'lp', 6000, 0.7);
    const m = MH[ch]; for (let i = 0; i < N; i++) m[i] += 1.0 * w[i] + 1.0 * g[i] + 0.55 * sp[i] + 1.0 * tp[i] + 1.1 * b[i] + 1.4 * k[i] + 1.0 * c[i];
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
// underwater hush 51.333-52.667 (after the limiter, fixed level): muffled water + bubbles + low rumble, RMS ~-44 dBFS over 51.4-52.6
{
  const R = rngFor('hushwater'), w0 = Math.round(51.0 * SR), len = secs(2.4), wl = waterLap(R, 2.4);
  const hL = filt(wl.L, 'lp', 380, 0.7), hR = filt(wl.R, 'lp', 380, 0.7);
  const rum = filt(filt(noise(R, len), 'lp', 120, 0.7), 'hp', 35, 0.7); scaleTo(rum, 0.5);
  for (let i = 0; i < len; i++) { hL[i] += rum[i]; hR[i] += rum[i]; }
  for (let t = 0.38; t < 1.75; t += 0.07 + R() * 0.16) { const b = bubble(220 + R() * 500, 0.04 + R() * 0.06, 1.1 + R() * 0.5), p = R() * 1.2 - 0.6, o = secs(t), gb = 0.25 + 0.35 * R(); addInto(hL, b, o, gb * (1 - p) * 0.7); addInto(hR, b, o, gb * (1 + p) * 0.7); }
  const env = (t) => smooth((t - 51.34) / 0.35) * (1 - smooth((t - 52.62) / 0.4));
  let ss = 0, cnt = 0; const a = Math.round(51.4 * SR), b = Math.round(52.6 * SR);
  for (let i = a; i < b; i++) { const k = i - w0, e = env(i / SR); ss += (hL[k] * e) ** 2 + (hR[k] * e) ** 2; cnt += 2; }
  const g = Math.pow(10, -44 / 20) / Math.sqrt(ss / cnt);
  for (let k = 0; k < len; k++) { const i = w0 + k; if (i >= N) break; const e = env(i / SR) * g; mL[i] += hL[k] * e; mR[i] += hR[k] * e; }
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
  const W = [['intro', 0.3, 4.0], ['actI', 4.0, 9.3], ['title', 9.4, 13.3], ['actII', 13.4, 22.6], ['ignite', 22.67, 28.0], ['scrape/hero', 28.0, 34.0], ['plate', 34.0, 42.0], ['actIII', 42.0, 48.0], ['wobble', 48.0, 50.0], ['splash', 50.0, 51.3], ['hush', 51.4, 52.6], ['catch', 52.67, 54.67], ['warm', 54.67, 60.6], ['end', 60.67, 64.6], ['CTA', 64.67, 69.3]];
  console.log('section RMS: ' + W.map(([k, a, b]) => `${k} ${rms(a, b).toFixed(1)}`).join(' | '));
  const hot = []; for (let s = 0; s < 69.5; s += 0.5) { let m = 1; for (let i = Math.round(s * SR); i < Math.round((s + 0.5) * SR); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -3 / 20)) hot.push(`${s.toFixed(1)}(${(-dbf(m)).toFixed(1)})`); }
  console.log('GR > 3 dB at: ' + (hot.join(' ') || 'none'));
  const hush = rms(51.4, 52.6), burstR = rms(52.667, 53.2), ign = rms(22.667, 23.3), spl = rms(50.0, 50.6), ttl = rms(9.333, 10.0);
  const win = []; for (let s = 0; s + BEAT <= 70 + 1e-9; s += BEAT) win.push(`${s.toFixed(2)}:${rms(s, s + BEAT).toFixed(1)}`);
  console.log('RMS per beat: ' + win.join(' '));
  const checks = [
    ['format 48k/2ch/16-bit/70.000 s', ch === 2 && sr === 48000 && bits === 16 && n === N],
    [`loudness -15 +-0.5 (${lu.integ.toFixed(2)})`, Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    [`true peak <= -1.5 dBTP (${dbf(tp).toFixed(2)})`, dbf(tp) <= -1.5],
    ['no clipping', clipped === 0],
    [`hush 51.4-52.6 RMS in [-70,-38] (${hush.toFixed(1)})`, hush >= -70 && hush <= -38],
    [`burst 52.667-53.2 > -30 dBFS (${burstR.toFixed(1)})`, burstR > -30],
    [`ignition 22.667-23.3 > -22 dBFS (${ign.toFixed(1)})`, ign > -22],
    [`splash 50.0-50.6 > -22 dBFS (${spl.toFixed(1)})`, spl > -22],
    [`title 9.333-10.0 > -22 dBFS (${ttl.toFixed(1)})`, ttl > -22],
    ['tail digital zero', tailZero],
    [`limiter GR <= 6 dB (${grDb.toFixed(2)})`, grDb <= 6],
  ];
  let ok = true; for (const [k, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + k); if (!v) ok = false; }
  console.log(`run time ${((Date.now() - T_START) / 1000).toFixed(1)} s`);
  if (!ok) process.exitCode = 1;
}
