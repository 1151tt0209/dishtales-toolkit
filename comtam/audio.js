'use strict';
// Com tam Sai Gon - soundtrack. "Saigon city-pop / disco-funk", 112.5 BPM, straight 16ths (no swing), D major / B minor.
// Loop: Gmaj7 - A/G - F#m7 - Bm9 (Em9 - A13 - Dmaj9 cadence in the CTA, Bm7 - E9 vamp for the Act III comedy groove).
// Everything is synthesised in code: four-on-the-floor disco kick (sidechain-pumps the string pads + a little of the Rhodes),
// layered handclap on 2 & 4, tight 16th noise hats with open hats on the "and"s, tambourine, syncopated slap/octave bass
// (thumb / pop / dead-note ghosts, filter-envelope saw+sine), FM Rhodes (tine + bark, quarter-note auto-pan tremolo),
// chicken-scratch muted guitar 16ths (Karplus-Strong chord stabs + dead-string scratches), bright 3-saw synth-brass stabs
// with filter envelope (and a wah-muted "wah-wah" for the cough gag), detuned-saw string pads / swells / disco string run,
// saw+square lead hook with portamento, delayed vibrato and a dotted-8th ping-pong echo, clavinet stabs, marimba pings,
// cowbell, crash / reverse cymbal / riser. Foley: dawn city (traffic hum, birds, far rooster), doppler motorbike, neon
// flicker buzz + crackles, charcoal-grill sizzle bed, fan whups, steam lid, plips, tongs + flip sizzles, powder puff, lid,
// knife chok, hot-oil burst, egg crack, jar clink + pour, plating plops, fish-sauce pour, POOF explosion, cough, kiss, pop, ding.
// Output: audio.wav 48 kHz / stereo / 16-bit / 3,276,800 samples (68.267 s = 128 beats), ~-14 LUFS, peak ~-1 dBFS.
const fs = require('fs'), path = require('path');
const T_START = Date.now();
console.time('render');
const SR = 48000, N = 3276800, DUR = N / SR, TAU = Math.PI * 2;
const BEAT = 8 / 15, BAR = BEAT * 4, E8 = BEAT / 2, S16 = BEAT / 4, S32 = BEAT / 8;
const bt = (b) => b * BEAT;
const TARGET_LUFS = -14, CEIL_DBTP = -1.03;
const S0 = bt(89), S1 = bt(91), FADE0 = 67.2, FADE1 = 68.2;   // hush 47.467-48.533, end fade
const I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);
// ======================================================================= generic helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const rngFor = (name) => mulberry32(hashStr('comtam:' + name));
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
function scaleSt(s, peak) { let m = 0; for (const ch of ['L', 'R']) for (let i = 0; i < s[ch].length; i++) m = Math.max(m, Math.abs(s[ch][i])); if (m > 0) for (const ch of ['L', 'R']) for (let i = 0; i < s[ch].length; i++) s[ch][i] *= peak / m; return s; }
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
// sum of exponentially decaying sines [[f, amp, decay]]
function modal(modes, dur, att = 0.0004) {
  const n = secs(dur), y = new Float32Array(n);
  for (const [f, a, d] of modes) {
    if (f >= SR * 0.45) continue;
    const w = TAU * f / SR, r = Math.exp(-1 / (d * SR)), c2 = 2 * r * Math.cos(w);
    let ym1 = a * Math.sin(-w) / r, ym2 = a * Math.sin(-2 * w) / (r * r);
    for (let i = 0; i < n; i++) { const v = c2 * ym1 - r * r * ym2; y[i] += v; ym2 = ym1; ym1 = v; }
  }
  const na = secs(att); for (let i = 0; i < na; i++) y[i] *= i / na;
  return fadeEdges(y, 0.0001, Math.min(0.02, dur * 0.2));
}
const MEMO = new Map();
function memo(k, fn) { let v = MEMO.get(k); if (!v) { v = fn(); MEMO.set(k, v); } return v; }
const DARK = new WeakMap();
function darkOf(s) { let d = DARK.get(s); if (!d) { d = filt(filt(s, 'lp', 3000, 0.7), 'hp', 300, 0.7); DARK.set(s, d); } return d; }
const q05 = (x) => Math.max(0.05, Math.round(x / 0.05) * 0.05);
const q01 = (x) => Math.max(0.02, Math.round(x * 100) / 100);

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
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
function pulseS(ph, dt, du) { const v = (ph < du ? 1 : -1) + blep(ph, dt) - blep((ph - du + 1) % 1, dt); return v - (2 * du - 1); }

// ---- buses
function mkBus() { return { L: new Float32Array(N), R: new Float32Array(N) }; }
const MH = mkBus(), ML = mkBus(), SFX = mkBus(), FX2 = mkBus(), HALL = mkBus(), ROOM = mkBus();
const RH = mkBus(), PAD = mkBus(), GTR = mkBus(), BRS = mkBus(), LEAD = mkBus(), CLV = mkBus();
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

// ======================================================================= DRUMS (disco kit)
const KICK_T = [];
function kickS() {
  return memo('kick', () => {
    const n = secs(0.34), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += (52 + 118 * Math.exp(-t / 0.022) + 240 * Math.exp(-t / 0.0025)) / SR;
      const e = Math.min(1, t / 0.0008) * (t < 0.02 ? 1 : Math.exp(-(t - 0.02) / 0.11));
      y[i] = Math.sin(TAU * ph) * e;
    }
    addInto(y, burst(rngFor('kclk'), 0.008, 'bp', 3800, 0.8, 0.0012), 0, 0.3);
    for (let i = 0; i < n; i++) y[i] = Math.tanh(1.8 * y[i]) / Math.tanh(1.8);
    return fadeEdges(y, 0.0001, 0.03);
  });
}
function kickAt(t, g = 1) { put(ML, t, kickS(), { gain: 0.62 * g }); KICK_T.push(t); }
// layered clap: 3 band layers with 4 smeared hand hits + air + a little snare-body tone
function clapS(v = 0) {
  return memo('clap' + (v % 4), () => {
    const R = rngFor('clap' + (v % 4)), n = secs(0.32), y = new Float32Array(n);
    const A = scaleTo(filt(noise(R, n), 'bp', 1100, 1.2), 1), B = scaleTo(filt(noise(R, n), 'bp', 2300, 1.4), 1), C = scaleTo(filt(noise(R, n), 'hp', 4500, 0.7), 1);
    const hits = [0, 0.0065 + R() * 0.002, 0.014 + R() * 0.002, 0.023 + R() * 0.002];
    for (let i = 0; i < n; i++) {
      const t = i / SR; let e = 0;
      for (let k = 0; k < 4; k++) if (t >= hits[k]) e += k < 3 ? Math.exp(-(t - hits[k]) / 0.0032) : 0.95 * Math.exp(-(t - hits[k]) / 0.085);
      y[i] = (A[i] + 0.65 * B[i]) * e + C[i] * 0.22 * Math.exp(-t / 0.05) * Math.min(1, t / 0.001);
    }
    addInto(y, modal([[205, 1, 0.045], [392, 0.45, 0.03]], 0.2), 0, 0.35);
    return scaleTo(fadeEdges(filtIn(y, 'hp', 300, 0.7), 0.0002, 0.04), 1);
  });
}
// hats: 0 closed, 1 open (rings into the next 16th), 2 tiny (32nd rolls)
function hatS(kind, v = 0) {
  return memo(`hh${kind}|${v % 4}`, () => {
    const R = rngFor(`hh${kind}|${v % 4}`), d = kind === 1 ? 0.26 : kind === 2 ? 0.045 : 0.07, n = secs(d);
    const x = filt(filt(filt(noise(R, n), 'hp', 7200, 0.7), 'peak', 10500, 1.2, 5), 'lp', 15500, 0.7);
    const dc = kind === 1 ? 0.075 : kind === 2 ? 0.011 : 0.02;
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.min(1, t / 0.0004) * (Math.exp(-t / dc) + (kind === 1 ? 0.22 * Math.exp(-t / 0.2) : 0)); }
    return scaleTo(fadeEdges(x, 0.0002, kind === 1 ? 0.06 : 0.01), 1);
  });
}
function tambS(acc, v = 0) {
  return memo(`tb${acc}|${v % 4}`, () => {
    const R = rngFor(`tb${acc}|${v % 4}`), d = acc ? 0.2 : 0.09, n = secs(d), y = new Float32Array(n);
    const nz = scaleTo(filt(filt(noise(R, n), 'hp', 5500, 0.7), 'lp', 13000, 0.7), 1), jing = new Float32Array(n);
    for (let k = 0; k < 8; k++) { const f = 5000 + R() * 6000; addInto(jing, modal([[f, 1, 0.03 + R() * 0.04], [f * 1.47, 0.5, 0.02]], d), secs(R() * (acc ? 0.012 : 0.02)), 0.5 + 0.5 * R()); }
    scaleTo(jing, 1);
    const at = acc ? 0.002 : 0.012, dc = acc ? 0.06 : 0.025;
    for (let i = 0; i < n; i++) { const t = i / SR, e = t < at ? t / at : Math.exp(-(t - at) / dc); y[i] = (nz[i] * 0.7 + jing[i] * 0.6) * e; }
    return scaleTo(fadeEdges(y, 0.0003, 0.02), 1);
  });
}
function cowbell() {
  return memo('cow', () => {
    const n = secs(0.35), y = new Float32Array(n); let p1 = 0, p2 = 0; const d1 = 562 / SR, d2 = 845 / SR;
    for (let i = 0; i < n; i++) { const t = i / SR; p1 += d1; p1 -= Math.floor(p1); p2 += d2; p2 -= Math.floor(p2); const e = Math.min(1, t / 0.0008) * (0.6 * Math.exp(-t / 0.012) + 0.4 * Math.exp(-t / 0.11)); y[i] = (pulseS(p1, d1, 0.5) + pulseS(p2, d2, 0.5)) * e; }
    const z = filt(y, 'bp', 1100, 0.9); filtIn(z, 'hp', 450, 0.7);
    return scaleTo(fadeEdges(z, 0.0002, 0.03), 1);
  });
}
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

// ======================================================================= MELODIC INSTRUMENTS
// ---- Karplus-Strong string (for the scratch guitar)
function ks(f, dur, o = {}) {
  const R = rngFor('ks:' + (o.seed ?? 0));
  const n = secs(dur), y = new Float32Array(n);
  const t60 = o.t60 ?? 2.5, s = o.s ?? 0.5, bright = o.bright ?? 0.5, pos = o.pos ?? 0.2;
  const el = Math.max(4, Math.round(SR / f)), ex = new Float32Array(el), ex2 = new Float32Array(el);
  let lp = 0; for (let k = 0; k < el; k++) { lp += (R() * 2 - 1 - lp) * bright; ex[k] = lp; }
  const pd = Math.max(1, Math.round(pos * el)); let mean = 0, mx = 0;
  for (let k = 0; k < el; k++) { ex2[k] = ex[k] - (k >= pd ? ex[k - pd] : 0); mean += ex2[k]; }
  mean /= el; for (let k = 0; k < el; k++) { ex2[k] -= mean; mx = Math.max(mx, Math.abs(ex2[k])); }
  for (let k = 0; k < el; k++) ex2[k] /= mx || 1;
  const P = SR / f - s, g = Math.pow(10, -3 / (t60 * f));
  for (let i = 0; i < n; i++) {
    let v = i < el ? ex2[i] : 0;
    const d = i - P;
    if (d >= 1) { const j = Math.floor(d), a = d - j; const v1 = y[j] + (y[j + 1] - y[j]) * a, v0 = y[j - 1] + (y[j] - y[j - 1]) * a; v += g * ((1 - s) * v1 + s * v0); }
    y[i] = v;
  }
  return y;
}
function choke(y, len, tau) { const n0 = secs(len); for (let i = n0; i < y.length; i++) y[i] *= Math.exp(-(i - n0) / SR / tau); return y; }

// ---- slap bass: saw + sine through a plucked low-pass envelope. T = thumb, P = popped octave, G = dead-note ghost, S = soft finger
function bassN(m, L, kind) {
  L = q01(L);
  return memo(`bs${m}|${L}|${kind}`, () => {
    const R = rngFor(`bs${m}|${kind}`);
    if (kind === 'G') {
      const n = secs(0.07), y = new Float32Array(n); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; ph += 95 / SR; y[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.018) * 0.7; }
      addInto(y, burst(R, 0.04, 'bp', 700, 0.9, 0.008), 0, 0.8);
      addInto(y, burst(R, 0.01, 'hp', 1800, 0.7, 0.002), 0, 0.3);
      return scaleTo(fadeEdges(y, 0.0003, 0.01), 0.7);
    }
    const f = m2f(m), rel = 0.035, n = secs(L + rel), y = new Float32Array(n), tab = sawTab(f);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += f * (1 + (kind === 'P' ? 0.02 : 0.008) * Math.exp(-t / 0.01)) / SR; ph -= Math.floor(ph);
      let e = Math.min(1, t / 0.0012) * (0.62 + 0.38 * Math.exp(-t / 0.1)) * Math.exp(-t / 1.4);
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = (0.55 * tabRead(tab, ph) + 0.75 * Math.sin(TAU * ph)) * e;
    }
    const br = kind === 'P' ? 3800 : kind === 'S' ? 450 : 1700, tau = kind === 'P' ? 0.045 : kind === 'S' ? 0.2 : 0.07;
    const z = filt(y, 'lp', (t) => 350 + br * Math.exp(-t / tau), kind === 'S' ? 0.7 : 1.15);
    if (kind !== 'S') addInto(z, burst(R, 0.012, 'hp', 1500, 0.7, 0.0025), 0, kind === 'P' ? 0.35 : 0.18);
    if (kind === 'P') addInto(z, modal([[f * 12.1, 0.25, 0.006], [2400, 0.2, 0.008]], 0.03), 0, 1);
    scaleTo(z, 1); for (let i = 0; i < n; i++) z[i] = Math.tanh(1.6 * z[i]) / Math.tanh(1.6);
    return fadeEdges(z, 0.0003, 0.008);
  });
}
// ---- Rhodes: 1:1 FM (index decays = bell attack -> warm), tine partial, a little bark; v = 1 hard / 0 soft
function rhodes(m, L, v = 1) {
  L = q05(L);
  return memo(`rh${m}|${L}|${v}`, () => {
    const f = m2f(m), rel = 0.2, n = secs(L + rel), y = new Float32Array(n), I0 = v ? 2.0 : 1.2, tg = v ? 0.3 : 0.15;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += f / SR; ph -= Math.floor(ph);
      const I = I0 * Math.exp(-t / 0.16) + 0.4 * Math.exp(-t / 1.5) + 0.15, p = TAU * ph;
      const s = Math.sin(p + I * Math.sin(p)) + tg * Math.sin(7 * p) * Math.exp(-t / 0.014) + 0.12 * Math.sin(2 * p) * Math.exp(-t / 0.4);
      let e = Math.min(1, t / 0.0018) * (0.55 * Math.exp(-t / 0.8) + 0.45 * Math.exp(-t / 3.2));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = Math.tanh(1.2 * s * e);
    }
    return scaleTo(fadeEdges(y, 0.0002, 0.02), 1);
  });
}
// ---- string section: 3 detuned saws per side, delayed vibrato, LP; returns stereo
function strings(m, L, att = 0.3, rel = 0.45) {
  L = q05(L);
  const key = `st${m}|${L}|${att}|${rel}`;
  return memo(key, () => {
    const R = rngFor(key), f = m2f(m), n = secs(L + rel), out = {}, tab = sawTab(f * 1.01);
    const DET = { L: [-0.13, 0.02, 0.1], R: [-0.08, -0.01, 0.14] };
    for (const ch of ['L', 'R']) {
      const y = new Float32Array(n), ph = DET[ch].map(() => R()), vr = 4.6 + R() * 0.8, vp = R() * TAU, mul = DET[ch].map((d) => f * Math.pow(2, d / 12) / SR);
      for (let i = 0; i < n; i++) {
        const t = i / SR, vib = 1 + 0.0035 * Math.sin(TAU * vr * t + vp) * smooth((t - 0.2) / 0.4);
        let s = 0; for (let k = 0; k < 3; k++) { ph[k] += mul[k] * vib; ph[k] -= Math.floor(ph[k]); s += tabRead(tab, ph[k]); }
        let e = smooth(t / att); if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
        y[i] = s * e;
      }
      filtIn(y, 'lp', 4200, 0.6); filtIn(y, 'hp', 170, 0.7);
      out[ch] = fadeEdges(y, 0.001, 0.02);
    }
    return scaleSt(out, 1);
  });
}
// ---- chicken-scratch guitar: KS chord stab (choked) and dead-string scratches
function gtrStab(nm, dir) {
  return memo(`gs${nm}|${dir}`, () => {
    const c = CH[nm], notes = dir ? c.gt.slice().reverse() : c.gt, y = new Float32Array(secs(0.3));
    notes.forEach((m, k) => {
      const s = ks(m2f(m), 0.28, { t60: 1.0, s: 0.3, bright: 0.88, pos: 0.13, seed: 9000 + m * 5 + dir });
      choke(s, 0.075, 0.016);
      addInto(y, s, secs(k * 0.0055), 1 - k * 0.12);
    });
    addInto(y, scaleTo(burst(rngFor('gsn' + nm + dir), 0.02, 'bp', 2600, 1.2, 0.004), 0.5), 0, 1);
    filtIn(y, 'hp', 280, 0.7); filtIn(y, 'peak', 2400, 1.0, 4);
    return scaleTo(fadeEdges(y, 0.0003, 0.03), 1);
  });
}
function gtrChk(v) {
  return memo('gc' + (v % 6), () => {
    const R = rngFor('gc' + (v % 6)), y = scaleTo(burst(R, 0.04, 'bp', 1900 + 350 * (v % 3), 1.1, 0.007), 1);
    addInto(y, scaleTo(ks(m2f(52 + (v % 6)), 0.05, { t60: 0.05, s: 0.3, bright: 0.8, pos: 0.15, seed: 700 + (v % 6) }), 0.6), 0, 1);
    filtIn(y, 'hp', 350, 0.7);
    return scaleTo(fadeEdges(y, 0.0003, 0.01), 1);
  });
}
// ---- synth brass: 3 detuned saws, scoop, filter envelope; fall = semitone drop at the end; wah 1 = mute wah, 2 = wobbly deflate
function brass(m, L, o = {}) {
  L = q05(L); const fall = o.fall || 0, wah = o.wah || 0, sw = o.sw || 0;
  const key = `br${m}|${L}|${fall}|${wah}|${sw}`;
  return memo(key, () => {
    const R = rngFor(key), rel = fall ? 0.28 : 0.1, n = secs(L + rel), y = new Float32Array(n), env = new Float32Array(n);
    const det = [-0.1, 0.0, 0.085], ph = det.map(() => R());
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let e = sw ? smooth(t / Math.max(0.05, L * sw)) : Math.min(1, t / 0.008) * (0.8 + 0.3 * Math.exp(-t / 0.07));
      if (t > L) e *= fall ? 1 - smooth((t - L) / rel) : 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      let mm = m - 0.45 * (1 - smooth(t / 0.04));
      if (fall) mm -= fall * Math.pow(smooth((t - L * 0.55) / (L * 0.45 + rel)), 1.3);
      if (wah === 2) mm += 0.3 * Math.sin(TAU * 6.2 * t) * smooth((t - 0.08) / 0.12);
      const f = m2f(mm), tab = sawTab(f * 1.01); let s = 0;
      for (let k = 0; k < 3; k++) { ph[k] += f * Math.pow(2, det[k] / 12) / SR; ph[k] -= Math.floor(ph[k]); s += tabRead(tab, ph[k]); }
      y[i] = s / 3 * e; env[i] = e;
    }
    const fe = (t) => env[Math.min(n - 1, Math.round(t * SR))];
    let out;
    if (wah) {
      const wf = (t) => 430 + 1500 * smooth(t / 0.06) * (1 - 0.75 * smooth((t - 0.08) / Math.max(0.1, L + rel - 0.08))) * (wah === 2 ? 0.7 + 0.3 * Math.cos(TAU * 5 * t) : 1);
      out = filt(y, 'bp', wf, 2.4); filtIn(out, 'hp', 280, 0.7); addInto(out, filt(y, 'lp', 900, 0.7), 0, 0.3);
    } else {
      out = filt(y, 'lp', (t) => 500 + 5200 * fe(t) * (0.5 + 0.5 * Math.exp(-t / 0.12)), 0.9);
      addInto(out, filt(y, 'bp', 1400, 1.4), 0, 0.3);
    }
    scaleTo(out, 1); for (let i = 0; i < n; i++) out[i] = Math.tanh(1.5 * out[i]);
    return scaleTo(fadeEdges(out, 0.001, 0.02), 1);
  });
}
// ---- lead hook: saw + square, portamento, delayed vibrato, plucky filter
function lead(m, L, from) {
  L = q05(L); from = from ?? m;
  return memo(`ld${m}|${L}|${from}`, () => {
    const rel = 0.09, n = secs(L + rel), y = new Float32Array(n), port = from !== m ? 0.05 : 0;
    let p1 = 0, p2 = 0.25;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let mm = port ? from + (m - from) * smooth(t / port) : m;
      mm += 0.16 * Math.sin(TAU * 5.7 * t) * smooth((t - 0.16) / 0.22);
      const f = m2f(mm), d1 = f / SR, d2 = f * 1.006 / SR;
      p1 += d1; p1 -= Math.floor(p1); p2 += d2; p2 -= Math.floor(p2);
      const s = 0.6 * tabRead(sawTab(f), p1) + 0.45 * pulseS(p2, d2, 0.5);
      let e = Math.min(1, t / 0.005) * (0.82 + 0.18 * Math.exp(-t / 0.12));
      if (t > L) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - L) / rel));
      y[i] = s * e;
    }
    const z = filt(y, 'lp', (t) => 2200 + 4200 * Math.exp(-t / 0.08), 1.0);
    filtIn(z, 'hp', 220, 0.7);
    return scaleTo(fadeEdges(z, 0.0005, 0.02), 1);
  });
}
// ---- clavinet: narrow pulse, quacky resonant LP envelope, key click
function clav(m, L) {
  L = q01(L);
  return memo(`cv${m}|${L}`, () => {
    const R = rngFor('cv' + m), f = m2f(m), n = secs(L + 0.04), y = new Float32Array(n), dt = f / SR; let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += dt; ph -= Math.floor(ph); let e = Math.min(1, t / 0.0005) * Math.exp(-t / 0.35); if (t > L) e *= Math.exp(-(t - L) / 0.008); y[i] = pulseS(ph, dt, 0.22) * e; }
    const z = filt(y, 'lp', (t) => 1400 + 6000 * Math.exp(-t / 0.05), 2.0); filtIn(z, 'hp', 220, 0.7);
    addInto(z, burst(R, 0.006, 'hp', 3000, 0.7, 0.0012), 0, 0.25);
    scaleTo(z, 1); for (let i = 0; i < n; i++) z[i] = Math.tanh(1.4 * z[i]);
    return scaleTo(fadeEdges(z, 0.0002, 0.006), 1);
  });
}
function marimba(m) {
  return memo('mb' + m, () => {
    const f = m2f(m), R = rngFor('mb' + m);
    const y = modal([[f, 1, 0.45], [f * 3.93, 0.32, 0.07], [f * 10.7, 0.06, 0.015]], 1.0, 0.0006);
    addInto(y, burst(R, 0.012, 'lp', 2000, 0.7, 0.003), 0, 0.25);
    return scaleTo(fadeEdges(y, 0.0002, 0.05), 1);
  });
}
const ting = (f, dur = 0.5) => modal([[f, 1, dur * 0.4], [f * 2.76, 0.4, dur * 0.2], [f * 5.4, 0.2, dur * 0.1]], dur);
function ding(m) {
  return memo('ding' + m, () => {
    const f = m2f(m), y = modal([[f, 1, 0.9], [f * 2.0, 0.45, 0.45], [f * 3.0, 0.3, 0.25], [f * 4.2, 0.2, 0.15], [f * 5.43, 0.1, 0.1]], 1.8, 0.0005);
    addInto(y, burst(rngFor('ding'), 0.006, 'hp', 4000, 0.7, 0.0012), 0, 0.15);
    return scaleTo(y, 1);
  });
}
function sparkleAt(t0, R, g, notes = [86, 90, 93, 95, 98]) { for (let k = 0; k < notes.length; k++) put(MH, t0 + k * 0.065 + R() * 0.015, ting(m2f(notes[k]), 0.9), { gain: g * (1 - k * 0.1), pan: (k % 2 ? 0.45 : -0.45) * (0.5 + 0.5 * R()), hall: 0.35 }); }
// "mmm" synth: warm triangle chord scooping up, nasal hum formant, slow swell
function mmmSwell(dur) {
  return memo('mmm' + dur, () => {
    const n = secs(dur), y = new Float32Array(n), notes = [62, 66, 69, 74];
    notes.forEach((m, k) => {
      const f0 = m2f(m); let ph = k * 0.21;
      for (let i = 0; i < n; i++) { const t = i / SR, mm = -0.35 * (1 - smooth(t / 0.35)) + 0.12 * Math.sin(TAU * 5 * t + k) * smooth((t - 0.3) / 0.3); ph += f0 * Math.pow(2, mm / 12) / SR; ph -= Math.floor(ph); y[i] += (tabRead(TAB_TRI, ph) + 0.25 * Math.sin(2 * TAU * ph)) * (k === 3 ? 0.5 : 1); }
    });
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] *= smooth(t / 0.5) * (1 - smooth((t - (dur - 0.7)) / 0.7)); }
    const z = filt(y, 'lp', 1100, 0.7); filtIn(z, 'peak', 300, 1.2, 5); filtIn(z, 'hp', 120, 0.7);
    return scaleTo(fadeEdges(z, 0.005, 0.05), 1);
  });
}

// ======================================================================= FOLEY
function crinkle(R, dur, rate = 350, lo = 2000, hi = 8000) {
  const n = secs(dur), y = new Float32Array(n + secs(0.01)), V = [];
  for (let k = 0; k < 10; k++) V.push(burst(R, 0.006, 'bp', lo + (hi - lo) * R(), 1.5, 0.0012));
  let t = 0;
  for (;;) { t += -Math.log(1 - R() * 0.999999) / rate; if (t >= dur) break; const u = t / dur; addInto(y, V[(R() * 10) | 0], Math.round(t * SR), Math.pow(Math.sin(Math.PI * u), 0.5) * (0.3 + 0.7 * R())); }
  return y;
}
function flutterEnv(R, n, fc) { const x = filt(filt(noise(R, n), 'lp', fc, 0.7), 'lp', fc, 0.7); scaleTo(x, 1); for (let i = 0; i < n; i++) x[i] = Math.abs(x[i]); return x; }
function bubble(f0, len, rise = 0.9) {
  const n = secs(len), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / len; ph += f0 * (1 + rise * u) / SR; y[i] = Math.sin(TAU * ph) * Math.sin(Math.PI * Math.min(1, u * 3)) * Math.exp(-u * 3); }
  return fadeEdges(y, 0.001, 0.005);
}
const tick = (R, f) => modal([[f * (0.9 + 0.2 * R()), 1, 0.006], [f * 2.7, 0.4, 0.004]], 0.03);
function softThud(R) {
  const y = burst(R, 0.14, 'lp', 350, 0.7, 0.03); let ph = 0;
  for (let i = 0; i < y.length; i++) { const t = i / SR; ph += (70 + 50 * Math.exp(-t / 0.02)) / SR; y[i] += Math.sin(TAU * ph) * Math.exp(-t / 0.05) * 0.8; }
  return fadeEdges(filtIn(y, 'hp', 50, 0.7), 0.0005, 0.02);
}
const iceClink = (R, f = 2400) => filtIn(modal([[f, 1, 0.18], [f * 2.32, 0.6, 0.1], [f * 3.36, 0.4, 0.07], [f * 4.25, 0.3, 0.05]], 0.4), 'hp', 800, 0.7);
function woodThunk(R, f = 170) {
  const y = modal([[f, 1, 0.09], [f * 2.31, 0.6, 0.05], [f * 4.1, 0.35, 0.03], [f * 6.7, 0.2, 0.015]], 0.35);
  addInto(y, burst(R, 0.04, 'lp', 900, 0.7, 0.01), 0, 0.4);
  return scaleTo(y, 1);
}
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
function lidClank(R) { const y = new Float32Array(secs(0.7)); const hit = (k) => modal([[880 * k, 1, 0.22], [2210 * k, 0.6, 0.13], [3650 * k, 0.4, 0.08], [5200 * k, 0.2, 0.05]], 0.5); addInto(y, hit(1), 0, 1); addInto(y, hit(1.01), secs(0.065), 0.45); addInto(y, hit(0.99), secs(0.12), 0.25); addInto(y, burst(R, 0.01, 'hp', 3000, 0.7, 0.002), 0, 0.4); return scaleTo(y, 1); }
function sizzle(R, dur) {
  const n = secs(dur), x = filt(filt(noise(R, n), 'hp', 3500, 0.7), 'lp', 11000, 0.7), fl = flutterEnv(R, n, 18);
  scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.3 + 0.7 * fl[i]) * smooth(t / 0.25) * (1 - smooth((t - (dur - 0.5)) / 0.5)) * 0.6; }
  const c = crinkle(R, dur, 70, 1500, 6000); scaleTo(c, 0.8); addInto(x, c, 0, 1);
  return x;
}
// sizzle swell: rises over `rise` s to a roar, then settles
function swell(R, dur, rise = 0.6) {
  const n = secs(dur), x = filt(filt(noise(R, n), 'hp', 2400, 0.7), 'lp', 11000, 0.7), fl = flutterEnv(R, n, 20);
  scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR, e = (0.15 + 0.85 * smooth(t / rise)) * (1 - 0.35 * smooth((t - rise) / Math.max(0.01, dur - rise))) * (1 - smooth((t - dur + 0.4) / 0.4)); x[i] *= (0.5 + 0.5 * fl[i]) * e; }
  const c = crinkle(R, dur, 300, 1200, 6500); for (let i = 0; i < c.length && i < n; i++) c[i] *= 0.3 + 0.7 * smooth(i / SR / rise);
  addInto(x, scaleTo(c, 0.9), 0, 1);
  return scaleTo(fadeEdges(x, 0.01, 0.03), 1);
}
// ---- formant voice engine (rooster, cough)
const VF = { a: [1050, 1750, 3300], e: [650, 2450, 3400], i: [430, 3050, 3800], o: [650, 1150, 3200], u: [430, 1100, 3100], oo: [400, 900, 3000], ae: [900, 2100, 3300], uh: [800, 1450, 3200] };
function consonant(R, type, d) {
  const n = secs(d); let x = noise(R, n);
  if (type === 's') x = filt(filt(x, 'hp', 4500, 0.7), 'lp', 9000, 0.7);
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
// dawn city: low traffic rumble + mid wash + distant passing cars (stereo)
function cityHum(R, dur) {
  const n = secs(dur), out = {};
  for (const ch of ['L', 'R']) {
    const lo = scaleTo(filt(filt(noise(R, n), 'lp', 180, 0.7), 'hp', 35, 0.7), 1), mid = scaleTo(filt(noise(R, n), 'bp', 520, 0.5), 1), fl = flutterEnv(R, n, 10), y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = lo[i] * 0.6 + mid[i] * 0.25 * (0.4 + 0.6 * fl[i]);
    for (let t = R() * 1.5; t < dur - 2.6; t += 1.6 + R() * 2.2) addInto(y, scaleTo(whoosh(R, 1.6 + R(), 180, 650 + R() * 300, 220, 0.5, 0.8), 0.35), secs(t), 1);
    out[ch] = fadeEdges(y, 0.05, 0.2);
  }
  return out;
}
// far motorbike pass: buzzy two-stroke, doppler pitch drop at closest approach, LP opens/closes with distance
function motoPass(R, dur) {
  const n = secs(dur), y = new Float32Array(n), tc = dur * 0.48, bell = (u) => Math.pow(Math.sin(Math.PI * clamp(u)), 1.6);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 78 * (1 + 0.085 * Math.tanh((tc - t) / 0.16)) * (1 + 0.02 * Math.sin(TAU * 3 * t)), d1 = f / SR;
    p1 += d1; p1 -= Math.floor(p1); p2 += 2 * d1; p2 -= Math.floor(p2);
    y[i] = tabRead(sawTab(f), p1) * 0.6 + pulseS(p2, 2 * d1, 0.3) * 0.35;
  }
  const z = filt(y, 'lp', (t) => 350 + 2600 * bell(t / dur), 0.9); filtIn(z, 'hp', 70, 0.7);
  for (let i = 0; i < n; i++) z[i] *= 0.1 + 0.9 * bell(i / n);
  addInto(z, scaleTo(whoosh(R, dur, 300, 1800, 400, 0.48, 0.8), 0.35), 0, 1);
  return scaleTo(fadeEdges(z, 0.01, 0.05), 1);
}
// neon sign flicker: 100 Hz buzz + plasma hiss through a random on/off gate
function neonBuzz(R, dur) {
  const n = secs(dur), y = new Float32Array(n), hiss = scaleTo(filt(noise(R, n), 'hp', 3500, 0.7), 1), gate = new Float32Array(n);
  let t = 0, on = 1;
  while (t < dur) { const seg = 0.015 + R() * 0.06, i0 = secs(t), i1 = Math.min(n, secs(t + seg)), v = on ? 0.6 + 0.4 * R() : 0.04 * R(); for (let i = i0; i < i1; i++) gate[i] = v; t += seg; on = R() < (on ? 0.65 : 0.8) ? 1 : 0; }
  const a = 1 - Math.exp(-1 / (0.002 * SR)); let gs = 0, ph = 0; const tab = sawTab(100);
  for (let i = 0; i < n; i++) { gs += (gate[i] - gs) * a; ph += 100 / SR; ph -= Math.floor(ph); y[i] = (tabRead(tab, ph) * 0.5 + Math.sin(TAU * ph) * 0.4 + hiss[i] * 0.12) * gs; }
  const z = filt(y, 'peak', 2400, 1.0, 6); filtIn(z, 'hp', 90, 0.7); filtIn(z, 'lp', 7000, 0.7);
  return scaleTo(fadeEdges(z, 0.003, 0.02), 1);
}
function sparkSnap(R) { const y = burst(R, 0.02, 'hp', 2200, 0.7, 0.0025); addInto(y, modal([[3300 + R() * 800, 1, 0.004], [6100, 0.5, 0.003]], 0.02), 0, 0.5); addInto(y, burst(R, 0.008, 'bp', 900, 1, 0.002), secs(0.004), 0.4); return scaleTo(y, 1); }
function fanWhup(v) {
  return memo('fan' + (v % 4), () => {
    const R = rngFor('fan' + (v % 4)), y = new Float32Array(secs(0.3));
    addInto(y, scaleTo(whoosh(R, 0.24, 230, 950 + 120 * (v % 3), 320, 0.38, 0.85), 1), 0, 1);
    const n = secs(0.07), th = new Float32Array(n); for (let i = 0; i < n; i++) th[i] = Math.sin(TAU * 85 * i / SR) * Math.sin(Math.PI * i / n);
    addInto(y, th, secs(0.06), 0.35);
    return scaleTo(fadeEdges(y, 0.002, 0.02), 1);
  });
}
function tongs(R) { const y = new Float32Array(secs(0.12)); const h = modal([[2900, 1, 0.012], [4700, 0.6, 0.008], [7300, 0.35, 0.005]], 0.06); addInto(y, h, 0, 1); addInto(y, h, secs(0.022), 0.7); addInto(y, burst(R, 0.006, 'hp', 3000, 0.7, 0.0012), 0, 0.4); return scaleTo(y, 1); }
function flipSizzle(R) { const y = new Float32Array(secs(1.0)); addInto(y, scaleTo(softThud(R), 0.7), 0, 1); addInto(y, swell(R, 0.95, 0.035), secs(0.01), 1); return scaleTo(y, 1); }
function powderPuff(R) {
  const n = secs(0.6), x = filt(filt(noise(R, n), 'lp', 1600, 0.7), 'hp', 120, 0.7), y = new Float32Array(n); scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = x[i] * Math.min(1, t / 0.008) * (Math.exp(-t / 0.09) + 0.2 * Math.exp(-t / 0.25)) + 0.3 * Math.sin(TAU * 140 * t) * Math.exp(-t / 0.04) * Math.min(1, t / 0.003); }
  addInto(y, scaleTo(crinkle(R, 0.4, 400, 3000, 9000), 0.25), secs(0.02), 1);
  return scaleTo(fadeEdges(y, 0.001, 0.05), 1);
}
function steamLid(R) {
  const y = new Float32Array(secs(1.5));
  addInto(y, modal([[1240, 1, 0.12], [2950, 0.55, 0.07], [4420, 0.35, 0.05], [6100, 0.2, 0.03]], 0.4), 0, 0.5);
  addInto(y, burst(R, 0.008, 'hp', 3000, 0.7, 0.0015), 0, 0.3);
  addInto(y, scaleTo(whoosh(R, 1.25, 900, 4800, 2600, 0.3, 0.7), 1), secs(0.04), 0.8);
  addInto(y, steamHiss(R, 1.3), secs(0.06), 0.45);
  return scaleTo(y, 1);
}
function knifeChok(R) { const y = woodThunk(R, 215); addInto(y, burst(R, 0.006, 'hp', 2600, 0.7, 0.0015), 0, 0.5); addInto(y, tick(R, 3600), 0, 0.35); return scaleTo(y, 1); }
function oilBurst(R, dur) { const y = scaleTo(swell(R, dur, 0.04), 1); for (let k = 0; k < 14; k++) addInto(y, burst(R, 0.012, 'bp', 1500 + R() * 3500, 1.5, 0.002), secs(R() * dur * 0.85), 0.4 + 0.5 * R()); return scaleTo(y, 1); }
function pour(R, dur, fc = 900) {
  const n = secs(dur), x = filt(filt(noise(R, n), 'bp', fc, 0.9), 'lp', 3500, 0.7), fl = flutterEnv(R, n, 14); scaleTo(x, 1);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.35 + 0.65 * fl[i]) * smooth(t / 0.06) * (1 - smooth((t - dur + 0.25) / 0.25)); }
  for (let t = 0.03; t < dur - 0.2; t += 0.05 + R() * 0.08) addInto(x, bubble(fc * (0.6 + R() * 0.9), 0.04 + R() * 0.04, 0.9 + R() * 0.6), secs(t), 0.3 + 0.25 * R());
  return scaleTo(filtIn(x, 'hp', 200, 0.7), 1);
}
function plip(f) { return memo('plip' + f, () => { const y = bubble(f, 0.07, 1.7); addInto(y, burst(rngFor('plip' + f), 0.004, 'hp', 3000, 0.7, 0.001), 0, 0.12); return scaleTo(fadeEdges(y, 0.0005, 0.01), 1); }); }
function cough(R, k = 1) {
  const y = scaleTo(talk(R, [{ d: 0.02, n: 'k', na: 0.9 }, { d: 0.13, v: 'uh', v2: 'u', f0: 205 * k, f1: 150 * k, a: 1, br: 1.6, att: 0.004, rel: 0.06 }], { fs: 1.0, bw: 1.6 }), 1);
  addInto(y, scaleTo(burst(R, 0.12, 'bp', 1100, 0.7, 0.035, 0.002), 0.8), secs(0.015), 1);
  filtIn(y, 'hp', 150, 0.7); filtIn(y, 'lp', 5000, 0.7);
  return scaleTo(fadeEdges(y, 0.001, 0.02), 1);
}
function kissBlip(R) {
  const n = secs(0.2), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, u = Math.min(1, t / 0.13); ph += (750 + 2100 * Math.pow(u, 0.7)) / SR; ph -= Math.floor(ph); y[i] = t < 0.15 ? Math.sin(TAU * ph) * Math.pow(Math.sin(Math.PI * t / 0.15), 1.2) * 0.6 : 0; }
  addInto(y, burst(R, 0.012, 'bp', 1600, 1.8, 0.004), 0, 0.8); addInto(y, burst(R, 0.01, 'bp', 2100, 1.8, 0.003), secs(0.012), 0.4);
  return scaleTo(fadeEdges(y, 0.0003, 0.01), 1);
}
function corkPop(R) { const n = secs(0.25), y = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (380 + 1300 * smooth(t / 0.05)) / SR; y[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.001) * Math.exp(-t / 0.045); } addInto(y, burst(R, 0.015, 'bp', 2200, 1.0, 0.003), 0, 0.6); return scaleTo(fadeEdges(y, 0.0002, 0.02), 1); }
// POOF: low boom + low-pass-falling noise blast + debris (stereo)
function poofBlast(R) {
  const dur = 1.5, n = secs(dur), boom = bigBoom(R, dur, 85, 30, 0.38), out = {};
  for (const ch of ['L', 'R']) {
    const x = filt(noise(R, n), 'lp', (t) => 7500 * Math.pow(220 / 7500, Math.min(1, t / 0.95)), 0.75);
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.min(1, t / 0.004) * (0.7 * Math.exp(-t / 0.16) + 0.3 * Math.exp(-t / 0.55)); }
    scaleTo(x, 1);
    const deb = crinkle(R, 1.1, 160, 1200, 6500); for (let i = 0; i < deb.length; i++) deb[i] *= Math.exp(-i / SR / 0.4);
    const y = new Float32Array(n); addInto(y, boom, 0, 0.9); addInto(y, x, 0, 0.75); addInto(y, scaleTo(deb, 0.35), secs(0.02), 1);
    out[ch] = fadeEdges(y, 0.0005, 0.3);
  }
  return scaleSt(out, 1);
}
function emberCrackle(R, dur) { const y = crinkle(R, dur, 14, 1200, 5500); for (let k = 0; k < 4; k++) addInto(y, burst(R, 0.01, 'bp', 900 + R() * 1500, 1.2, 0.002), secs(R() * (dur - 0.05)), 0.8); filtIn(y, 'lp', 6000, 0.7); filtIn(y, 'hp', 400, 0.7); return scaleTo(fadeEdges(y, 0.005, 0.05), 1); }
function grillBed(R, dur) {
  const n = secs(dur), out = {};
  for (const ch of ['L', 'R']) {
    const x = filt(filt(noise(R, n), 'hp', 3200, 0.7), 'lp', 10500, 0.7), fl = flutterEnv(R, n, 16); scaleTo(x, 1);
    for (let i = 0; i < n; i++) x[i] *= 0.25 + 0.75 * fl[i];
    addInto(x, scaleTo(crinkle(R, dur, 55, 1500, 6000), 0.9), 0, 1);
    out[ch] = fadeEdges(x, 0.05, 0.3);
  }
  return out;
}

// ======================================================================= HARMONY + ARRANGEMENT
// root = bass (MIDI), rh = Rhodes voicing, pd = string pad, br = brass stab (top 3), gt = guitar stab, cl = clav
const CH = {
  G: { root: 31, rh: [55, 59, 62, 66, 69], pd: [62, 66, 71, 74], br: [66, 71, 74], gt: [62, 66, 71] },       // Gmaj7(9)
  AG: { root: 31, rh: [55, 61, 64, 69], pd: [61, 64, 69, 73], br: [64, 69, 73], gt: [61, 64, 69] },          // A/G
  Fm: { root: 30, rh: [54, 57, 61, 64], pd: [61, 64, 66, 69], br: [61, 64, 69], gt: [57, 61, 64] },          // F#m7
  Bm: { root: 35, rh: [57, 61, 62, 66], pd: [62, 66, 69, 73], br: [66, 69, 73], gt: [62, 66, 73] },          // Bm9
  Em: { root: 28, rh: [55, 59, 62, 66], pd: [59, 62, 67, 71], br: [62, 67, 71], gt: [62, 67, 71] },          // Em9
  A: { root: 33, rh: [55, 61, 66, 69], pd: [61, 64, 67, 73], br: [64, 67, 73], gt: [61, 67, 71] },           // A13
  D: { root: 38, rh: [54, 57, 61, 64, 69], pd: [62, 66, 69, 73, 76], br: [66, 69, 73], gt: [62, 66, 69] },   // Dmaj9
  Bm7: { root: 35, rh: [57, 62, 66], pd: [62, 66, 69], br: [62, 66, 69], gt: [62, 66, 69], cl: [62, 66, 69] },
  E9: { root: 28, rh: [56, 59, 62, 66], pd: [62, 66, 68], br: [62, 66, 68], gt: [62, 66, 68], cl: [62, 66, 68] },
};
for (let k = 1; k <= 5; k++) { const e = CH.E9, up = (a) => a.map((m) => m + k); CH['X' + k] = { root: e.root + k, rh: up(e.rh), pd: up(e.pd), br: up(e.br), gt: up(e.gt), cl: up(e.cl) }; }
const CHT = [];
function plan(b0, s) { let b = b0; for (const tok of s.split(' ')) { const [nm, n] = tok.split(':'); CHT.push([b, nm]); b += +n; } return b; }
plan(0, 'G:4 AG:4 Fm:4 Bm:4');                                                  // intro / neon / grill (filter opening)
plan(16, 'G:4 AG:4 Fm:4 Bm:4 G:4 AG:4 Fm:4 Bm:4 G:4 AG:4 Fm:4 Bm:4');           // TITLE 8.533 -> Act II -> plating
plan(64, 'G:4 AG:2 Fm:2 Em:1 A:1');                                             // hero orbit, fish sauce, turnaround
plan(74, 'Bm7:2 E9:2 Bm7:2');                                                   // Act III cheeky groove 39.467
plan(80, 'E9:1 X1:1 X2:1 X3:1 X4:1 X5:1');                                      // frantic fanning (chromatic climb)
plan(86, 'Bm:8');                                                               // POOF / hush / cough / wah-wah
plan(94, 'G:4 AG:4 Fm:4 Bm:2');                                                 // warm return 50.133, eating
plan(108, 'G:4 AG:4 Fm:2');                                                     // end card 57.6
plan(118, 'Em:2 A:2 G:2 A:1');                                                  // CTA jingle 62.933
plan(125, 'D:3');                                                               // final tonic 66.667
function chordIdx(b) { let k = 0; for (let i = 0; i < CHT.length; i++) if (b >= CHT[i][0] - 1e-6) k = i; return k; }
const chordAt = (b) => CHT[chordIdx(b)][1];
function chordSpan(b) { const k = chordIdx(b); return [CHT[k][0], k + 1 < CHT.length ? CHT[k + 1][0] : 128]; }
const DMAJ = [1, 2, 4, 6, 7, 9, 11];
function dia3(m) { let x = m - 1, st = 0; for (;;) { if (DMAJ.includes(((x % 12) + 12) % 12)) st++; if (st >= 2) return x; x--; } }

// ---- placement helpers
const RH_PAN = (t0) => (lt) => 0.4 * Math.sin(TAU * (1.875 * (t0 + lt)));   // quarter-note suitcase auto-pan
function rhChord(t, c, L, g, v = 1) { c.rh.forEach((m, k) => put(RH, t + k * 0.004, rhodes(m, L, v), { gain: g * (k === 0 ? 0.8 : 1), pan: RH_PAN(t), hall: 0.16, room: 0.04 })); }
function padChord(t, notes, L, g, att = 0.3, rel = 0.45) { for (const m of notes) put(PAD, t, strings(m, L, att, rel), { gain: g, hall: 0.25 }); }
function brassStab(t, notes, L, g, o = {}) { notes.forEach((m, k) => put(BRS, t + k * 0.003, brass(m, L, o), { gain: g * (k === notes.length - 1 ? 1 : 0.8), pan: [-0.3, 0.3, 0][k % 3], hall: 0.2, room: 0.05 })); }
function brassRiff(b0, arr, g = 0.1) { for (const [st, l, op] of arr) { const nm = chordAt(b0 + st / 4 + 0.01); brassStab(bt(b0) + st * S16, CH[nm].br, l * S16 * 0.85, g, op || {}); } }
function brassLine(b0, arr, g = 0.12) { for (const [st, l, m, op = {}] of arr) { const t = bt(b0) + st * S16, L = l * S16 * 0.9; put(BRS, t, brass(m, L, op), { gain: g, pan: -0.14, hall: 0.22, room: 0.05 }); put(BRS, t + 0.002, brass(dia3(m), L, op), { gain: g * 0.7, pan: 0.2, hall: 0.22, room: 0.05 }); } }
function clavStab(t, c, L, g) { (c.cl || c.gt).forEach((m, k) => put(CLV, t + k * 0.002, clav(m, L), { gain: g * (k ? 0.75 : 1), pan: -0.3 + k * 0.12, room: 0.06 })); }
// lead hook with dotted-8th ping-pong echo: arr = [step16, len16, midi]
function leadMel(t0, arr, g = 0.17) {
  let prev = null;
  for (const [st, l, m] of arr) {
    const t = t0 + st * S16, L = l * S16 * 0.92, from = prev != null && Math.abs(prev - m) <= 5 ? prev : m, sig = lead(m, L, from), dk = darkOf(sig);
    put(LEAD, t, sig, { gain: g, pan: 0.04, hall: 0.2, room: 0.03 });
    put(LEAD, t + 0.75 * BEAT, dk, { gain: g * 0.26, pan: -0.55, hall: 0.1 });
    put(LEAD, t + 1.5 * BEAT, dk, { gain: g * 0.13, pan: 0.55, hall: 0.1 });
    prev = m;
  }
}
const GSTAB = new Set([3, 6, 10, 14]);   // chicken-scratch chord hits within the bar (16ths); dead scratches elsewhere
// rhythm section from beat b0 to b1 (exclusive)
function band(b0, b1, o) {
  for (let b = b0; b < b1; b++) {
    const t = bt(b), j = b % 4, nm = chordAt(b + 0.01), c = CH[nm], [cs, ce] = chordSpan(b + 0.01);
    const fresh = b === cs, lastB = b + 1 >= ce, nn = ce < 128 ? CH[chordAt(ce + 0.01)] : c, u = (b - b0) / Math.max(1, b1 - b0);
    // drums
    if (o.kick && (!o.kickHalf || j % 2 === 0)) kickAt(t, o.kick);
    if (o.clap && (j === 1 || j === 3)) put(MH, t, clapS(b), { gain: 0.16 * o.clap, pan: 0.04, room: 0.25, hall: 0.05 });
    if (o.h32) for (let s = 0; s < 8; s++) put(MH, t + s * S32, hatS(2, s + b), { gain: (s % 2 ? 0.024 : 0.042) * o.h32 * (0.75 + 0.35 * u), pan: -0.22 });
    else if (o.hat) for (let s = 0; s < 4; s++) {
      if (o.hat8 && s % 2) continue;
      if (s === 2 && o.ohat) put(MH, t + s * S16, hatS(1, b), { gain: 0.055 * o.ohat, pan: -0.18, room: 0.05 });
      else put(MH, t + s * S16, hatS(0, b * 4 + s), { gain: [0.05, 0.026, 0.04, 0.032][s] * o.hat, pan: -0.22 });
    }
    if (o.tamb) {
      put(MH, t + S16, tambS(0, b), { gain: 0.028 * o.tamb, pan: 0.42 }); put(MH, t + 3 * S16, tambS(0, b + 1), { gain: 0.024 * o.tamb, pan: 0.42 });
      if (j === 1 || j === 3) put(MH, t, tambS(1, b), { gain: 0.06 * o.tamb, pan: 0.38, room: 0.1 });
    }
    // bass
    if (o.bass) {
      const r = c.root, bg = o.bg ?? 1, j2 = b % 2, ap = nn.root === r ? r + 10 : nn.root + (nn.root > r ? -1 : 1);
      const T = (tt, m, L, g = 0.5) => put(ML, tt, bassN(m, L, 'T'), { gain: g * bg });
      const P = (tt, m, L, g = 0.36) => put(ML, tt, bassN(m, L, 'P'), { gain: g * bg, pan: 0.05 });
      const G = (tt, g = 0.22) => put(ML, tt, bassN(0, 0.05, 'G'), { gain: g * bg });
      if (o.bass === 'pedal') { if (fresh) put(ML, t, bassN(r, (ce - b) * BEAT * 0.95, 'S'), { gain: 0.5 * bg }); }
      else if (o.bass === 'simple') { T(t, r, S16 * 1.5); P(t + E8, r + 12, S16 * 1.2, 0.32); }
      else if (o.bass === 'slap') {
        if (j2 === 0) { T(t, r, S16 * 1.7); P(t + 2 * S16, r + 12, S16 * 0.9); G(t + 3 * S16); }
        else { T(t, r, S16 * 0.9, 0.44); P(t + 2 * S16, r + 12, S16 * 0.8); T(t + 3 * S16, lastB ? ap : r + 7, S16 * 0.8, 0.4); }
      } else if (o.bass === 'comedy') {
        if (j2 === 0) { T(t, r, S16 * 0.6); P(t + 3 * S16, r + 12, S16 * 0.5, 0.34); }
        else { T(t + 2 * S16, r + 7, S16 * 0.6, 0.44); G(t + 3 * S16); }
      } else if (o.bass === 'eighths') { T(t, r, S16 * 1.2); P(t + E8, r + 12, S16, 0.34); }
    }
    // Rhodes comp
    if (o.rh) {
      const g = 0.075 * o.rh;
      if (o.rhHold) { if (fresh) rhChord(t, c, (ce - b) * BEAT * 0.98, g, 1); }
      else {
        if (fresh) rhChord(t, c, Math.min(ce - b, 1.6) * BEAT, g, 1);
        if (j === 1 && !fresh) rhChord(t + 2 * S16, c, 0.4 * BEAT, g * 0.55, 0);
        if (j === 2 && !fresh) rhChord(t + 2 * S16, c, 0.9 * BEAT, g * 0.8, 1);
        if (j === 3 && !lastB) rhChord(t + 3 * S16, c, 0.2 * BEAT, g * 0.45, 0);
      }
    }
    // string pad (pumped by the kick)
    if (o.pad && fresh) padChord(t, c.pd, (ce - b) * BEAT, 0.035 * o.pad, o.padAtt ?? 0.3);
    // chicken-scratch guitar
    if (o.gtr) for (let s = 0; s < 4; s++) {
      const q = j * 4 + s, tt = t + s * S16;
      if (GSTAB.has(q)) put(GTR, tt, gtrStab(nm, q % 2), { gain: 0.085 * o.gtr, pan: 0.34, room: 0.06 });
      else put(GTR, tt, gtrChk(b * 4 + s), { gain: (s % 2 ? 0.026 : 0.04) * o.gtr, pan: 0.34 });
    }
    // clav
    if (o.clav === 'comedy') {
      if (b % 2 === 0) clavStab(t + 2 * S16, c, 0.12, 0.09);
      else { clavStab(t + S16, c, 0.08, 0.07); clavStab(t + 3 * S16, c, 0.08, 0.06); }
    } else if (o.clav === 'frantic') for (let s = 0; s < 4; s++) clavStab(t + s * S16, c, 0.07, (s % 2 ? 0.045 : 0.07) * (0.7 + 0.4 * u));
  }
}
const FULL = { kick: 1, clap: 1, hat: 1, ohat: 1, tamb: 1, bass: 'slap', bg: 1, rh: 1, pad: 0.7, gtr: 1 };
// lead hook (4 bars over Gmaj7 / A-G / F#m7 / Bm9), steps in 16ths from the hook start
const HOOK = [
  [0, 3, 78], [3, 3, 81], [6, 2, 83], [8, 1, 81], [9, 3, 78], [12, 4, 76],
  [18, 2, 76], [20, 2, 78], [22, 2, 76], [24, 3, 73], [27, 5, 69],
  [32, 3, 73], [35, 3, 76], [38, 2, 78], [40, 1, 76], [41, 3, 73], [44, 2, 71], [46, 2, 73],
  [48, 6, 74], [54, 2, 73], [56, 4, 69], [60, 2, 71], [62, 2, 73],
];
const HOOK2 = HOOK.filter((n) => n[0] < 48).concat([[48, 3, 74], [51, 3, 78], [54, 2, 81], [56, 8, 83]]);
// playful brass line for the warm return (with diatonic thirds below)
const PLAY = [[0, 1, 78], [1, 1, 81], [2, 2, 83], [6, 1, 81], [7, 1, 83], [8, 2, 86], [11, 1, 83], [12, 3, 81, { fall: 2 }]];
const PLAY2 = [[2, 1, 81], [3, 1, 83], [4, 2, 85], [6, 2, 86], [10, 1, 83], [11, 1, 81], [12, 4, 78]];

// ======================================================================= SCORE
const AMB_KEYS = [[0, 0], [0.3, 1], [4.2, 1], [5.6, 0.45], [8.4, 0.3], [9.2, 0]];
const GR_KEYS = [[0, 0], [6.38, 0], [6.6, 1], [8.4, 1], [8.9, 0.35], [14.85, 0.35], [15.0, 0.18], [17.0, 0.18], [17.1, 0.35], [39.3, 0.35], [39.6, 0.15], [42.6, 0.15], [42.7, 0], [50.1, 0], [50.6, 0.3], [57.5, 0.3], [57.8, 0.15], [62.9, 0.15], [64, 0], [70, 0]];
// ---------- ACT I: dawn, neon, motorbike, grill, title drop
{
  const R = rngFor('actI');
  put(FX2, 0, cityHum(R, 9.4), { gain: 0.11, env: (t) => pw(AMB_KEYS, t) });
  put(FX2, 0.35, birdCall(R), { gain: 0.05, pan: -0.55, hall: 0.25 });
  put(FX2, 2.35, birdCall(R), { gain: 0.045, pan: 0.6, hall: 0.25 });
  put(FX2, 3.3, birdCall(R), { gain: 0.04, pan: -0.15, hall: 0.25 });
  put(FX2, 1.5, filt(rooster(R, 1), 'lp', 2400, 0.7), { gain: 0.07, pan: 0.35, hall: 0.45 });          // far rooster ~1.5 s
  put(SFX, bt(8), neonBuzz(R, bt(9) - bt(8)), { gain: 0.13, pan: 0.2, room: 0.2 });                     // neon flicker 4.267-4.8
  [[4.85, 0.2], [5.03, 0.15], [5.24, 0.22]].forEach(([t, g], k) => put(SFX, t, sparkSnap(R), { gain: g, pan: 0.2 - 0.1 * k, room: 0.2 }));
  put(FX2, 4.6, motoPass(R, 1.2), { gain: 0.16, pan: (lt) => -0.8 + 1.6 * smooth(lt / 1.2), hall: 0.12 }); // far motorbike 4.6-5.8
  put(FX2, bt(12) - 0.05, grillBed(R, 61.5), { gain: 0.2, env: (t) => pw(GR_KEYS, t) });                  // charcoal grill bed
  put(SFX, bt(12), sizzle(R, bt(16) - bt(12) + 0.3), { gain: 0.16, pan: -0.1 });
  for (let k = 0; k < 4; k++) put(SFX, bt(12 + k), fanWhup(k), { gain: 0.34, pan: k % 2 ? 0.3 : -0.3, room: 0.1 }); // fan whup on each beat
  put(SFX, 7.5, riser(R, bt(16) - 7.5, 300, 9000), { gain: 0.2, hall: 0.15 });
  put(MH, bt(16) - 0.8, reverseCrash(R, 0.8), { gain: 0.07 });
  // music: filtered intro (LP opens over 0-4.267, applied at mix), pre-drop groove without kick
  band(0, 8, { rh: 0.85, rhHold: true, pad: 0.6, padAtt: 0.8, bass: 'pedal', bg: 0.6 });
  band(4, 8, { hat: 0.45 });
  band(8, 16, { rh: 1, pad: 0.6, bass: 'simple', bg: 0.85, hat: 0.8, tamb: 0.6 });
  band(12, 16, { gtr: 0.8 });
  brassStab(bt(15) + 2 * S16, CH.Bm.br, 0.1, 0.08); brassStab(bt(15) + 3 * S16, CH.Bm.br, 0.1, 0.09);
  // TITLE DROP 8.533
  put(MH, bt(16), crash(R, 2.4), { gain: 0.12, hall: 0.25 });
  brassStab(bt(16), CH.G.br, 0.42, 0.12);
  band(16, 24, FULL);
  leadMel(bt(16), HOOK);
}
// ---------- ACT II: cooking
{
  const R = rngFor('actII');
  band(24, 28, FULL);
  brassStab(bt(24), CH.Fm.br, 0.25, 0.09);
  put(SFX, bt(24), steamLid(R), { gain: 0.34, pan: -0.15, room: 0.15, hall: 0.08 });                          // 12.8 pot-lid steam whoosh
  band(28, 32, { rh: 1, pad: 0.8, bass: 'pedal', bg: 0.8, hat: 0.55, tamb: 0.45, gtr: 0.45 });               // breakdown for the plips
  [1250, 1480, 1120, 1660].forEach((f, k) => put(SFX, bt(28 + k), plip(f), { gain: 0.3, pan: [-0.2, 0.2, -0.1, 0.25][k], room: 0.2, hall: 0.1 }));
  put(MH, bt(31), reverseCrash(R, BEAT), { gain: 0.05 });
  // 17.067 crash, flips
  put(MH, bt(32), crash(R, 2.2), { gain: 0.11, hall: 0.25 });
  brassStab(bt(32), CH.G.br, 0.4, 0.11);
  band(32, 58, FULL);
  leadMel(bt(32), HOOK2);
  for (const b of [32, 34, 36]) { put(SFX, bt(b) - 0.09, tongs(R), { gain: 0.2, pan: 0.25, room: 0.1 }); put(SFX, bt(b), flipSizzle(R), { gain: 0.32, pan: -0.05 }); }
  put(SFX, bt(38), powderPuff(R), { gain: 0.32, pan: 0.15, room: 0.12 });                                    // 20.267
  put(SFX, bt(42), lidClank(R), { gain: 0.2, pan: -0.25, room: 0.15 });                                      // 22.4 lid
  put(SFX, bt(44), knifeChok(R), { gain: 0.42, pan: 0.1, room: 0.12 });                                      // 23.467 knife
  put(SFX, bt(46), oilBurst(R, bt(48) - bt(46) - 0.1), { gain: 0.36, pan: -0.1 });                           // 24.533-25.5 hot oil
  put(SFX, bt(51), crack(R), { gain: 0.4, pan: 0.05, room: 0.12 });                                          // 27.2 egg crack
  put(SFX, bt(51) + 0.12, swell(R, 1.4, 0.12), { gain: 0.3, pan: 0.05 });
  put(SFX, bt(54), iceClink(R, 2150), { gain: 0.16, pan: 0.3, room: 0.15 });                                 // 28.8 jar clink
  put(SFX, bt(54) + 0.13, iceClink(R, 3050), { gain: 0.11, pan: 0.3, room: 0.15 });
  put(SFX, bt(54) + 0.32, pour(R, bt(58) - bt(54) - 0.38, 950), { gain: 0.28, pan: 0.2, room: 0.1 });       // pour to 30.9
  // brass call & response while the hook rests, fill into plating
  brassRiff(48, [[0, 2], [3, 1], [6, 3], [10, 1], [12, 1], [14, 2]], 0.1);
  brassRiff(52, [[2, 1], [4, 2], [7, 1], [8, 4, { fall: 2 }]], 0.1);
  brassRiff(56, [[0, 2], [3, 1], [6, 2]], 0.09);
  // plating 30.933 ->: marimba pings rising + plops
  band(58, 66, { kick: 0.85, clap: 0.6, hat: 0.8, ohat: 0.6, tamb: 0.6, bass: 'slap', bg: 0.8, rh: 0.9, pad: 0.6 });
  [58, 60, 61, 62, 63, 64, 65].forEach((b, k) => {
    put(MH, bt(b), marimba([74, 76, 78, 81, 83, 86, 88][k]), { gain: 0.16, pan: k % 2 ? 0.3 : -0.3, hall: 0.18 });
    put(SFX, bt(b), plip(Math.round(330 * Math.pow(2, k * 2 / 12))), { gain: 0.22, pan: k % 2 ? 0.2 : -0.2, room: 0.1 });
  });
  // hero orbit 35.2-37.333: strings swell + sparkle chimes + orbiting air
  band(66, 74, { ...FULL, pad: 0 });
  padChord(bt(66), CH.G.pd.map((m) => m + 12), 2 * BEAT, 0.03, 0.9);
  padChord(bt(66), CH.G.pd, 2 * BEAT, 0.04, 0.6);
  padChord(bt(68), CH.AG.pd.map((m) => m + 12), 2 * BEAT, 0.035, 0.4);
  padChord(bt(68), CH.AG.pd, 2 * BEAT, 0.045, 0.3);
  padChord(bt(70), CH.Fm.pd, 2 * BEAT, 0.03, 0.2);
  padChord(bt(72), CH.Em.pd, BEAT, 0.03, 0.1); padChord(bt(73), CH.A.pd, BEAT, 0.03, 0.1);
  sparkleAt(bt(66) + 0.02, R, 0.06); sparkleAt(bt(67) + E8, R, 0.05, [90, 93, 95, 98, 102]); sparkleAt(bt(69), R, 0.055, [93, 95, 98, 100, 102]);
  put(SFX, bt(66), whoosh(R, 2.1, 300, 1800, 500, 0.5, 0.7), { gain: 0.11, pan: (lt) => 0.8 * Math.sin(TAU * lt / 2.1) });
  put(SFX, bt(70), pour(R, 1.3, 1300), { gain: 0.28, pan: 0.15, room: 0.15 });                               // 37.333 fish sauce
  brassStab(bt(66), CH.G.br, 0.3, 0.08);
  brassStab(bt(72), CH.Em.br, 0.2, 0.1);
  brassStab(bt(73) + 2 * S16, CH.A.br, 0.32, 0.11, { fall: 3 });
}
// ---------- ACT III: comedy, fanning, POOF, hush, cough
{
  const R = rngFor('actIII');
  band(74, 80, { kick: 0.6, kickHalf: true, hat: 0.5, hat8: true, bass: 'comedy', bg: 0.85, clav: 'comedy' }); // sparse, for the dialogue
  band(80, 86, { kick: 1, h32: 1, clap: 0.9, tamb: 0.7, bass: 'eighths', bg: 0.9, clav: 'frantic' });          // frantic fanning
  for (let k = 0; k < 8; k++) put(SFX, bt(80) + k * E8, fanWhup(k), { gain: 0.26 + 0.02 * k, pan: k % 2 ? 0.35 : -0.35, room: 0.08 });
  put(SFX, bt(80), swell(R, bt(86) - bt(80), bt(86) - bt(80) - 0.1), { gain: 0.3, pan: 0.05 });               // rising sizzle
  put(SFX, bt(80), riser(R, bt(86) - bt(80), 250, 8000), { gain: 0.2, hall: 0.12 });
  for (let k = 0; k < 8; k++) put(MH, bt(84) + k * S16, clapS(k), { gain: 0.05 + 0.012 * k, pan: 0.04, room: 0.2 }); // clap roll
  put(MH, bt(84), reverseCrash(R, bt(86) - bt(84)), { gain: 0.12 });                                        // reverse cymbal into POOF
  put(SFX, bt(86), poofBlast(R), { gain: 1.15, hall: 0.12, room: 0.1 });                                      // 45.867 POOF
  put(SFX, bt(86) + 0.45, emberCrackle(R, 3.0), { gain: 0.05, pan: 0.1 });                                    // smoulder (gated in the hush)
  put(SFX, bt(92), cough(R, 1), { gain: 0.32, pan: -0.05, room: 0.2 });                                       // 49.067 "khu" x2
  put(SFX, bt(92) + 0.175, cough(R, 1.08), { gain: 0.27, pan: -0.05, room: 0.2 });
  [[49.3, 70, 0.2, 1], [49.533, 69, 0.2, 1], [49.767, 68, 0.3, 2]].forEach(([t, m, L, w]) => {               // deflating wah-wah 49.3-50.1
    const o = { wah: w, fall: w === 2 ? 4 : 0 };
    put(BRS, t, brass(m, L, o), { gain: 0.17, pan: -0.05, hall: 0.18, room: 0.08 });
    put(BRS, t + 0.003, brass(m - 12, L, o), { gain: 0.09, pan: 0.08, hall: 0.12 });
  });
}
// ---------- warm return, eating, end card, CTA
{
  const R = rngFor('outro');
  put(MH, bt(94), crash(R, 1.8), { gain: 0.07, hall: 0.2 });
  band(94, 100, { ...FULL, gtr: 0.8, pad: 0.8 });                                                            // 50.133 groove returns warm
  brassLine(94, PLAY, 0.11); brassLine(98, PLAY2, 0.1);
  band(100, 108, { kick: 0.85, clap: 0.6, hat: 0.7, ohat: 0.5, tamb: 0.5, bass: 'slap', bg: 0.85, rh: 1.1, pad: 0.9 }); // eating
  put(SFX, 54.33, crunch(R, 0.2), { gain: 0.1, pan: 0.05 });
  sparkleAt(54.4, R, 0.07, [90, 93, 95, 98, 102]);                                                           // bite sparkle
  put(MH, 54.5, mmmSwell(2.0), { gain: 0.12, pan: 0, hall: 0.3 });                                            // "mmm"
  // END CARD 57.6
  put(MH, bt(108), crash(R, 2.4), { gain: 0.12, hall: 0.25 });
  brassStab(bt(108), CH.G.br, 0.4, 0.12);
  band(108, 118, FULL);
  leadMel(bt(108), HOOK.filter((n) => n[0] < 40));
  // CTA jingle 62.933
  band(118, 125, { ...FULL, gtr: 0.6, pad: 0.6 });
  [69, 71, 73, 74, 76, 78, 79, 81].forEach((m, k) => put(MH, bt(118) + k * S32, strings(m, 0.09, 0.006, 0.06), { gain: 0.05 + 0.006 * k, hall: 0.15 })); // disco run
  brassStab(bt(119), CH.Em.br, 0.32, 0.12);
  [[119, 0, 0.09], [119, 3, 0.06], [120, 2, 0.07], [122, 2, 0.07], [123, 0, 0.08], [123, 3, 0.06], [124, 2, 0.07]].forEach(([b, s, g]) => put(MH, bt(b) + s * S16, cowbell(), { gain: g, pan: 0.3, room: 0.1 }));
  put(SFX, 63.5, corkPop(R), { gain: 0.24, pan: -0.2, room: 0.1 });                                           // pop
  brassStab(bt(120) + 2 * S16, CH.A.br, 0.15, 0.09);
  put(MH, bt(121), ding(93), { gain: 0.13, pan: 0.1, hall: 0.3 }); put(MH, bt(121), ding(98), { gain: 0.06, pan: -0.1, hall: 0.3 }); // 64.533 ding
  sparkleAt(bt(122), R, 0.06, [91, 95, 98, 102, 105]);                                                        // 65.067 sparkle + kiss
  put(SFX, bt(122) + 0.06, kissBlip(R), { gain: 0.2, pan: 0.15, room: 0.1 });
  brassStab(bt(122), CH.G.br, 0.2, 0.09); brassStab(bt(123) + 2 * S16, CH.G.br, 0.12, 0.08);
  brassStab(bt(124), CH.A.br, 0.12, 0.09); brassStab(bt(124) + 2 * S16, CH.A.br, 0.1, 0.08); brassStab(bt(124) + 3 * S16, CH.A.br, 0.1, 0.09);
  // FINAL TONIC 66.667: Dmaj9, ring out into the fade
  const tF = bt(125);
  kickAt(tF, 1);
  put(ML, tF, bassN(38, 1.3, 'T'), { gain: 0.5 }); put(ML, tF + 2 * S16, bassN(50, 0.8, 'P'), { gain: 0.25 });
  rhChord(tF, CH.D, 1.4, 0.085, 1);
  padChord(tF, CH.D.pd, 1.3, 0.04, 0.05, 0.6);
  brassStab(tF, CH.D.br, 1.0, 0.11);
  put(MH, tF, crash(R, 2.0), { gain: 0.09, hall: 0.3 });
  sparkleAt(tF + 0.05, R, 0.05, [86, 90, 93, 98]);
}

// ---------- instrument buses: pump, EQ, merge into MH
{
  KICK_T.sort((a, b) => a - b);
  const pump = new Float32Array(N); let k = -1;
  for (let i = 0; i < N; i++) {
    const t = i / SR; while (k + 1 < KICK_T.length && KICK_T[k + 1] <= t) k++;
    if (k < 0) continue; const dt = t - KICK_T[k];
    pump[i] = dt > 0.36 ? 0 : Math.min(1, dt / 0.004) * (1 - smooth(dt / 0.36));
  }
  for (const ch of ['L', 'R']) {
    const rh = RH[ch], pd = PAD[ch], g = GTR[ch], br = BRS[ch], ld = LEAD[ch], cl = CLV[ch];
    for (let i = 0; i < N; i++) { pd[i] *= 1 - 0.55 * pump[i]; rh[i] *= 1 - 0.18 * pump[i]; }
    filtIn(rh, 'hp', 90, 0.7); filtIn(rh, 'peak', 280, 0.9, -2); filtIn(rh, 'lp', 9000, 0.7);
    filtIn(pd, 'hp', 200, 0.7); filtIn(pd, 'peak', 3000, 0.8, 1.5);
    filtIn(g, 'lp', 8000, 0.7);
    filtIn(br, 'hp', 150, 0.7); filtIn(br, 'peak', 1200, 0.9, 1.5); filtIn(br, 'lp', 9500, 0.7);
    filtIn(ld, 'hp', 220, 0.7); filtIn(ld, 'lp', 10000, 0.7);
    filtIn(cl, 'hp', 200, 0.7); filtIn(cl, 'lp', 8000, 0.7);
    const m = MH[ch]; for (let i = 0; i < N; i++) m[i] += rh[i] + pd[i] + g[i] + br[i] + ld[i] + cl[i];
  }
  // intro: low-pass opening 220 Hz -> 16 kHz over 0-4.267 s, then crossfade to dry (music + its hall send)
  const n1 = secs(4.6), fc = (t) => 220 * Math.pow(16000 / 220, Math.min(1, t / bt(8)));
  for (const b of [MH, ML, HALL]) for (const ch of ['L', 'R']) {
    const seg = b[ch].subarray(0, n1), f = filt(seg, 'lp', fc, 1.15);
    for (let i = 0; i < n1; i++) { const w = smooth((i / SR - 4.3) / 0.25); seg[i] = f[i] * (1 - w) + seg[i] * w; }
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
function busPeak(b) { let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(b.L[i]), Math.abs(b.R[i])); return m; }
const stemPk = { MH: busPeak(MH), ML: busPeak(ML), SFX: busPeak(SFX), FX2: busPeak(FX2) };
for (const b of [MH, ML, SFX, FX2, HALL, ROOM]) for (let i = I_S0 - secs(0.03); i < I_S1; i++) { const g = gateS(i); b.L[i] *= g; b.R[i] *= g; }
filtIn(MH.L, 'hp', 70, 0.7); filtIn(MH.R, 'hp', 70, 0.7); filtIn(MH.L, 'lp', 13000, 0.7); filtIn(MH.R, 'lp', 13000, 0.7);
filtIn(MH.L, 'peak', 3600, 0.6, 1.5); filtIn(MH.R, 'peak', 3600, 0.6, 1.5);
const musL = new Float32Array(N), musR = new Float32Array(N), ML_G = 0.5;
for (let i = 0; i < N; i++) { musL[i] = MH.L[i] + ML.L[i] * ML_G; musR[i] = MH.R[i] + ML.R[i] * ML_G; }
filtIn(musL, 'hp', 30, 0.7); filtIn(musR, 'hp', 30, 0.7);
filtIn(SFX.L, 'hp', 80, 0.7); filtIn(SFX.R, 'hp', 80, 0.7);
// duck: keyed by SFX only
const duck = new Float32Array(N);
{
  const at = 1 - Math.exp(-1 / (0.005 * SR)), rl = 1 - Math.exp(-1 / (0.25 * SR)); let e = 0;
  for (let i = 0; i < N; i++) { const x = Math.max(Math.abs(SFX.L[i]), Math.abs(SFX.R[i])); e += (x - e) * (x > e ? at : rl); duck[i] = 1 - 0.28 * clamp(e / 0.25); }
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
const [hallL, hallR] = reverb(HALL.L, HALL.R, { fb: 0.85, damp: 0.3, pre: 0.025, clearAt: I_S0 });
const [roomL, roomR] = reverb(ROOM.L, ROOM.R, { size: 0.45, fb: 0.72, damp: 0.42, pre: 0.006, hp: 250, lp: 9000, inGain: 1.6, clearAt: I_S0 });
const SCL = 3;
let preL = new Float32Array(N), preR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const ml = SCL * Math.tanh(musL[i] * duck[i] / SCL), mr = SCL * Math.tanh(musR[i] * duck[i] / SCL);
  preL[i] = ml + hallL[i] + SFX.L[i] + FX2.L[i] + roomL[i];
  preR[i] = mr + hallR[i] + SFX.R[i] + FX2.R[i] + roomR[i];
}
filtIn(preL, 'hp', 24, 0.7); filtIn(preR, 'hp', 24, 0.7);
// remove any residual DC offset (block mean) before mastering
{ let sl = 0, sr = 0; for (let i = 0; i < N; i++) { sl += preL[i]; sr += preR[i]; } sl /= N; sr /= N; for (let i = 0; i < N; i++) { preL[i] -= sl; preR[i] -= sr; } }
const masterEnv = (t) => (t < 0.35 ? smooth(t / 0.35) : t <= FADE0 ? 1 : t >= FADE1 ? 0 : Math.pow(0.5 + 0.5 * Math.cos(Math.PI * (t - FADE0) / (FADE1 - FADE0)), 1.4));
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
// hush 47.467-48.533 (after the limiter, fixed level): only a very soft ember crackle, peak ~-40 dBFS
{
  const R = rngFor('hushcrackle'), len = I_S1 - I_S0, c = emberCrackle(R, len / SR), p = R() * 0.6 - 0.3;
  scaleTo(c, Math.pow(10, -40 / 20));
  for (let k = 0; k < len && k < c.length; k++) { const i = I_S0 + k; mL[i] += c[k] * (1 - p); mR[i] += c[k] * (1 + p); }
}
for (let i = Math.round(FADE1 * SR); i < N; i++) { mL[i] = 0; mR[i] = 0; }
{
  const tp = truePeak(mL, mR); let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, tp[i]);
  const lim = Math.pow(10, -1.0 / 20);
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
  const peakIn = (a, b) => { let m = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i])); return dbf(m); };
  let tailZero = true; for (let i = Math.round(FADE1 * SR); i < n; i++) if (L[i] !== 0 || R[i] !== 0) { tailZero = false; break; }
  let dcL = 0, dcR = 0; for (let i = 0; i < n; i++) { dcL += L[i]; dcR += R[i]; }
  let sS = 0, sM = 0; for (let i = 0; i < n; i++) { const m = (L[i] + R[i]) / 2, s = (L[i] - R[i]) / 2; sM += m * m; sS += s * s; }
  // click detector: largest sample-to-sample jump relative to local level
  let jump = 0, jumpAt = 0; for (let i = 1; i < n; i++) { const d = Math.max(Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1])); if (d > jump) { jump = d; jumpAt = i / SR; } }
  const grDb = -dbf(out.minG);
  console.log(`\nformat: ${ch} ch, ${sr} Hz, ${bits}-bit, ${n} samples = ${(n / sr).toFixed(4)} s`);
  console.log(`peak ${dbf(pk).toFixed(2)} dBFS | true peak ${dbf(tp).toFixed(2)} dBTP | clipped samples ${clipped} | max step ${jump.toFixed(3)} at ${jumpAt.toFixed(3)} s`);
  console.log(`loudness: integrated ${lu.integ.toFixed(2)} LUFS | max short-term ${lu.maxS.toFixed(2)} | max momentary ${lu.maxM.toFixed(2)}`);
  console.log(`limiter: max GR ${grDb.toFixed(2)} dB | time with GR > 2 dB ${(out.over2 * 100).toFixed(2)}%`);
  console.log(`DC L ${(dcL / n).toExponential(2)} R ${(dcR / n).toExponential(2)} | side/mid ${dbf(Math.sqrt(sS / sM)).toFixed(1)} dB`);
  console.log('stem peaks (pre-master): ' + Object.entries(stemPk).map(([k, v]) => `${k} ${dbf(v).toFixed(1)}`).join(' | '));
  const W = [['dawn', 0.3, 4.2], ['neon/moto', 4.27, 6.4], ['grill', 6.4, 8.5], ['drop', 8.533, 12.8], ['actII', 12.8, 14.9], ['plips', 14.93, 17.0], ['flips', 17.07, 22.4], ['knife/oil', 22.4, 26.6], ['egg/jar', 26.67, 30.9], ['plating', 30.93, 35.2], ['hero', 35.2, 37.3], ['pour', 37.33, 39.4], ['comedy', 39.47, 42.6], ['frantic', 42.67, 45.8], ['poof', 45.87, 47.3], ['gap', 47.5, 48.5], ['cough/wah', 49.0, 50.1], ['warm', 50.13, 53.3], ['eat', 53.33, 57.5], ['endcard', 57.6, 62.9], ['cta', 62.93, 66.6], ['final', 66.67, 68.2]];
  console.log('section RMS: ' + W.map(([k, a, b]) => `${k} ${rms(a, b).toFixed(1)}`).join(' | '));
  const hot = []; for (let s = 0; s < 68; s += 0.5) { let m = 1; for (let i = Math.round(s * SR); i < Math.round((s + 0.5) * SR); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -3 / 20)) hot.push(`${s.toFixed(1)}(${(-dbf(m)).toFixed(1)})`); }
  console.log('GR > 3 dB at: ' + (hot.join(' ') || 'none'));
  const win = []; for (let b = 0; b < 128; b++) win.push(`${b}:${rms(bt(b), bt(b + 1)).toFixed(0)}`);
  console.log('RMS per beat: ' + win.join(' '));
  const gap = rms(S0 + 0.01, S1 - 0.01), gapPk = peakIn(S0, S1), drop = rms(bt(16), bt(16) + 0.6), poof = rms(bt(86), bt(86) + 0.5), comedy = rms(39.47, 42.6), full = rms(bt(16), bt(24));
  const checks = [
    [`format 48k/2ch/16-bit/${N} samples`, ch === 2 && sr === 48000 && bits === 16 && n === N],
    [`loudness -14 +-0.5 (${lu.integ.toFixed(2)})`, Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    [`sample peak about -1 dBFS (${dbf(pk).toFixed(2)})`, dbf(pk) <= -0.9 && dbf(pk) >= -1.8],
    [`true peak <= -0.95 dBTP (${dbf(tp).toFixed(2)})`, dbf(tp) <= -0.95],
    ['no clipping', clipped === 0],
    [`hush 47.467-48.533 RMS in [-80,-50] (${gap.toFixed(1)}), peak <= -36 (${gapPk.toFixed(1)})`, gap >= -80 && gap <= -50 && gapPk <= -36],
    [`title drop 8.533 > -20 dBFS (${drop.toFixed(1)})`, drop > -20],
    [`POOF 45.867 > -20 dBFS (${poof.toFixed(1)})`, poof > -20],
    [`comedy section quieter than full groove (${comedy.toFixed(1)} < ${full.toFixed(1)})`, comedy < full - 1],
    ['tail digital zero after 68.2', tailZero],
    [`DC < 1e-4`, Math.abs(dcL / n) < 1e-4 && Math.abs(dcR / n) < 1e-4],
    [`limiter GR <= 6 dB (${grDb.toFixed(2)})`, grDb <= 6],
  ];
  let ok = true; for (const [k, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + k); if (!v) ok = false; }
  console.log(`run time ${((Date.now() - T_START) / 1000).toFixed(1)} s`);
  if (!ok) process.exitCode = 1;
}
