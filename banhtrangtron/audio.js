'use strict';
// Banh trang tron Sai Gon - soundtrack. "8-bit chiptune funk at the school gate", 150 BPM, F major.
// Everything synthesised in code (pulse/triangle/LFSR chip voices, slap bass, synth brass, funk kit, foley,
// formant kid voices, ambience). Output: audio.wav 48 kHz / stereo / 16-bit / 90.0 s, ~-15 LUFS, TP <= -1.5 dBTP.
const fs = require('fs'), path = require('path');
const T_START = Date.now();
console.time('render');
const SR = 48000, DUR = 90.0, N = Math.round(SR * DUR), TAU = Math.PI * 2;
const BEAT = 0.4, BAR = 1.6, S16 = 0.1, SWF = 0.56;
const TARGET_LUFS = -15, CEIL_DBTP = -1.7;
const S0 = 72.0, S1 = 72.8, FADE0 = 88.8, FADE1 = 89.95;
const I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);

// ======================================================================= generic helpers
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
const rngFor = (name) => mulberry32(hashStr('btt:' + name));
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
const AMB_KEYS = [[0, 0], [0.25, 1], [11.7, 1], [12.3, 0.3], [59.7, 0.3], [60.1, 1], [66.4, 1], [67.0, 0.55], [71.9, 0.55], [72.0, 0], [72.8, 0], [73.6, 0.25], [84.4, 0.25], [88.5, 0.3], [89.9, 0]];
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
const T = (b0, k, sw = 0.5) => b0 + Math.floor(k / 2) * 0.2 + (k % 2 ? 0.2 * sw : 0);

// ======================================================================= chip instruments
function chip(midi, len, o = {}) {
  const duty = o.duty ?? 0.25, a = o.a ?? 0.004, d = o.d ?? 0.09, s = o.s ?? 0.55, r = o.r ?? 0.04, vib = o.vib || 0, vibD = o.vibDelay ?? 0.14;
  const n = secs(len + r), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; let m = midi;
    if (o.arp) m += o.arp[Math.floor(t * (o.arpRate || 50)) % o.arp.length];
    if (o.bend) m += o.bend(t);
    if (vib) m += vib * Math.sin(TAU * 5.6 * t) * smooth((t - vibD) / 0.2);
    const dt = m2f(m) / SR; ph += dt; if (ph >= 1) ph -= 1;
    const du = typeof duty === 'function' ? duty(t) : duty;
    let e = t < a ? t / a : s + (1 - s) * Math.exp(-(t - a) / d);
    if (t > len) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - len) / r));
    y[i] = pulseS(ph, dt, du) * e * 0.5;
  }
  return fadeEdges(filt(y, 'lp', o.lp || 9000, 0.6), 0.001, 0.004);
}
function tri(midi, len, o = {}) {
  const a = o.a ?? 0.003, r = o.r ?? 0.03, n = secs(len + r), y = new Float32Array(n);
  const tab = m2f(midi) > 600 ? TAB_TRI_LO : TAB_TRI; let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; const m = midi + (o.bend ? o.bend(t) : 0);
    ph += m2f(m) / SR; ph -= Math.floor(ph);
    let e = t < a ? t / a : (o.d ? (o.s ?? 0.7) + (1 - (o.s ?? 0.7)) * Math.exp(-(t - a) / o.d) : 1);
    if (t > len) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - len) / r));
    y[i] = tabRead(tab, ph) * e * 0.6;
  }
  return fadeEdges(y, 0.001, 0.004);
}
function lfsr(R, len, rate, short = false) {
  const n = secs(len), y = new Float32Array(n); let reg = 1 + Math.floor(R() * 32766), acc = 0, v = 1;
  for (let i = 0; i < n; i++) {
    acc += rate / SR;
    while (acc >= 1) { acc -= 1; const bit = ((reg) ^ (reg >> (short ? 6 : 1))) & 1; reg = (reg >> 1) | (bit << 14); v = (reg & 1) ? 1 : -1; }
    y[i] = v;
  }
  return filt(y, 'lp', Math.min(14000, rate * 0.45 + 1500), 0.6);
}
function chipKick() {
  return memo('ck', () => {
    const n = secs(0.2), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (48 + 190 * Math.exp(-t / 0.025)) / SR; ph -= Math.floor(ph); y[i] = tabRead(TAB_TRI, ph) * Math.exp(-t / 0.07) * Math.min(1, t / 0.0015); }
    return fadeEdges(y, 0.0002, 0.02);
  });
}
function chipSnare(v = 0) {
  return memo('cs' + v, () => {
    const R = rngFor('cs' + v); const nz = lfsr(R, 0.18, 17000), n = nz.length, y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += (250 * Math.exp(-t / 0.05) + 160) / SR; ph -= Math.floor(ph); y[i] = nz[i] * Math.exp(-t / 0.075) * 0.7 + tabRead(TAB_TRI, ph) * Math.exp(-t / 0.035) * 0.6; }
    return fadeEdges(filt(y, 'hp', 160, 0.7), 0.0002, 0.02);
  });
}
function chipHat(open = false, v = 0) {
  return memo('ch' + open + v, () => {
    const R = rngFor('ch' + v + open); const d = open ? 0.22 : 0.05; const nz = filt(lfsr(R, d, 32000, true), 'hp', 6500, 0.7);
    for (let i = 0; i < nz.length; i++) nz[i] *= Math.exp(-i / SR / (open ? 0.07 : 0.018));
    return fadeEdges(nz, 0.0002, 0.01);
  });
}
function ctom(midi) {
  return memo('ct' + midi, () => {
    const n = secs(0.22), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR; ph += m2f(midi + 10 * Math.exp(-t / 0.03)) / SR; ph -= Math.floor(ph); y[i] = tabRead(TAB_TRI, ph) * Math.exp(-t / 0.09); }
    return fadeEdges(y, 0.0003, 0.02);
  });
}

// ======================================================================= funk kit
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
function cowbell() {
  return memo('cow', () => {
    const n = secs(0.35), y = new Float32Array(n); let p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) { const d1 = 562 / SR, d2 = 845 / SR; p1 += d1; if (p1 >= 1) p1--; p2 += d2; if (p2 >= 1) p2--; y[i] = pulseS(p1, d1, 0.5) + pulseS(p2, d2, 0.5); }
    const a = filt(y, 'bp', 880, 3), b = filt(y, 'bp', 2600, 3);
    for (let i = 0; i < n; i++) { const t = i / SR; a[i] = (a[i] + b[i] * 0.6) * (0.7 * Math.exp(-t / 0.015) + 0.3 * Math.exp(-t / 0.11)); }
    return scaleTo(fadeEdges(filt(a, 'hp', 400, 0.7), 0.0002, 0.02), 1);
  });
}

// ======================================================================= slap bass, brass, wah
function slapNote(m, kind, len) {
  return memo(`sl${m}_${kind}_${len.toFixed(3)}`, () => {
    if (kind === 'G') {
      const R = rngFor('ghost' + m), x = burst(R, 0.05, 'bp', 380, 1.2, 0.01); let ph = 0; const f = m2f(m);
      for (let i = 0; i < x.length; i++) { ph += f / SR; x[i] = x[i] * 0.9 + Math.sin(TAU * ph) * Math.exp(-i / SR / 0.016) * 0.45; }
      return fadeEdges(x, 0.0005, 0.01);
    }
    const pop = kind === 'P', n = secs(len + 0.05), y = new Float32Array(n), tab = sawTab(m2f(m) * 1.03); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; ph += m2f(m + 0.3 * Math.exp(-t / 0.02)) / SR; ph -= Math.floor(ph);
      let e = Math.min(1, t / 0.0012) * (pop ? Math.exp(-t / 0.17) : 0.55 + 0.45 * Math.exp(-t / 0.07));
      if (t > len) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - len) / 0.04));
      y[i] = (tabRead(tab, ph) * 0.7 + Math.sin(TAU * ph) * 0.65) * e;
    }
    const z = filt(y, 'lp', (t) => (pop ? 700 : 250) + (pop ? 5200 : 2600) * Math.exp(-t / (pop ? 0.035 : 0.05)), 1.1);
    if (pop) addInto(z, burst(rngFor('pop' + m), 0.003, 'hp', 2500, 0.7, 0.0008), 0, 0.25);
    for (let i = 0; i < n; i++) z[i] = Math.tanh(z[i] * 1.6) / 1.3;
    return fadeEdges(z, 0.0005, 0.03);
  });
}
function brass(notes, len, o = {}) {
  return memo(`br${notes.join(',')}_${len.toFixed(3)}_${o.fall ? 1 : 0}_${o.soft ? 1 : 0}`, () => {
    const n = secs(len + 0.14), L = new Float32Array(n), R = new Float32Array(n);
    const det = [-8, 0, 8], wl = [0.85, 0.6, 0.35], wr = [0.35, 0.6, 0.85];
    for (const m of notes) {
      const tab = sawTab(m2f(m) * 1.12);
      for (let v = 0; v < 3; v++) {
        let ph = Math.random() * 0 + v * 0.31;
        for (let i = 0; i < n; i++) {
          const t = i / SR;
          let mm = m + det[v] / 100 - 1.4 * Math.exp(-t / 0.025) + (o.fall ? -5 * smooth((t - len + 0.06) / 0.18) : 0);
          ph += m2f(mm) / SR; ph -= Math.floor(ph);
          let e = Math.min(1, t / 0.012) * (0.78 + 0.22 * Math.exp(-t / 0.2));
          if (t > len) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - len) / 0.1));
          const s = tabRead(tab, ph) * e; L[i] += s * wl[v]; R[i] += s * wr[v];
        }
      }
    }
    const peakF = o.soft ? 1600 : 3300;
    const fc = (t) => 350 + peakF * (Math.min(1, t / 0.02) * (0.5 + 0.5 * Math.exp(-Math.max(0, t - 0.02) / 0.12))) * (t > len ? Math.exp(-(t - len) / 0.05) : 1);
    const g = 1 / (notes.length * 1.4);
    const oL = filt(L, 'lp', fc, 0.9), oR = filt(R, 'lp', fc, 0.9);
    for (let i = 0; i < n; i++) { oL[i] *= g; oR[i] *= g; }
    fadeEdges(oL, 0.001, 0.01); fadeEdges(oR, 0.001, 0.01);
    return { L: oL, R: oR };
  });
}
function wah(m, len, o = {}) {
  const n = secs(len + 0.1), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const mm = m + (o.wob ? 0.4 * Math.sin(TAU * 5.2 * t) * smooth((t - 0.15) / 0.3) - 0.6 * smooth((t - len * 0.6) / (len * 0.4)) : -0.15 * smooth((t - len * 0.7) / (len * 0.3)));
    const dt = m2f(mm) / SR; ph += dt; if (ph >= 1) ph -= 1;
    let e = Math.min(1, t / 0.02) * (0.9 - 0.15 * t / len);
    if (t > len) e *= 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - len) / 0.1));
    y[i] = pulseS(ph, dt, 0.35) * e;
  }
  const fc = o.wob
    ? (t) => 420 + 1600 * (0.5 - 0.5 * Math.cos(TAU * 5.2 * t)) * smooth(t / 0.1) * (1 - 0.5 * smooth((t - len * 0.6) / (len * 0.4)))
    : (t) => 420 + 1600 * Math.pow(Math.sin(Math.PI * clamp(t / (len + 0.05))), 0.8);
  return fadeEdges(filt(y, 'lp', fc, 2.2), 0.002, 0.02);
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

// ======================================================================= game sounds + set pieces
function coin() {
  return memo('coin', () => {
    const a = chip(83, 0.08, { duty: 0.5, d: 1, s: 1, r: 0.004 }), b = chip(88, 0.35, { duty: 0.5, d: 0.14, s: 0.0, r: 0.05 });
    const y = new Float32Array(a.length + b.length); addInto(y, a, 0, 1); addInto(y, b, secs(0.08), 1); return y;
  });
}
function levelUp() {
  return memo('lvl', () => {
    const R = rngFor('lvl'), ns = [77, 81, 84, 89, 93, 96, 101], st = 0.033, y = new Float32Array(secs(1.0));
    ns.forEach((m, k) => addInto(y, chip(m, k === 6 ? 0.3 : 0.034, { duty: 0.25, d: k === 6 ? 0.2 : 1, s: k === 6 ? 0.3 : 1, r: 0.01, vib: k === 6 ? 0.3 : 0, vibDelay: 0.05 }), secs(k * st), 0.8));
    for (let k = 0; k < 12; k++) addInto(y, ting(3000 + R() * 4000, 0.25), secs(0.1 + R() * 0.55), 0.12);
    return y;
  });
}
function powerUp(base, triad) {
  return memo('pu' + base, () => {
    const y = new Float32Array(secs(0.6)), st = 0.028;
    for (let k = 0; k < 12; k++) { const m = base + triad[k % 3] + 12 * Math.floor(k / 3); addInto(y, chip(m, k === 11 ? 0.14 : 0.03, { duty: 0.125, d: 1, s: 1, r: 0.01, vib: k === 11 ? 0.35 : 0, vibDelay: 0.03 }), secs(k * st), 0.8); }
    return y;
  });
}
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
function schoolDrum(R) {
  const y = modal([[72, 1, 0.9], [118, 0.6, 0.6], [167, 0.4, 0.45], [231, 0.3, 0.35], [305, 0.2, 0.25]], 1.8, 0.002);
  addInto(y, burst(R, 0.06, 'lp', 450, 0.7, 0.015), 0, 0.5);
  for (let i = 0; i < y.length; i++) y[i] = Math.tanh(1.4 * y[i]);
  return scaleTo(fadeEdges(y, 0.001, 0.2), 1);
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
const KID = { fs: 1.2, bw: 1.7 };
function shoutKid(R, f0) {
  const k = f0 / 400;
  return talk(R, [
    { d: 0.11, v: 'i', v2: 'u', f0: 360 * k, f1: 390 * k, a: 0.8 }, { d: 0.035, n: 'k', na: 0.25 },
    { d: 0.09, v: 'o', f0: 390 * k, a: 0.85 }, { d: 0.03, n: 't', na: 0.25 }, { d: 0.07, v: 'uh', f0: 360 * k, a: 0.7, rel: 0.03 },
    { d: 0.05 }, { d: 0.12, n: 'sh', na: 0.55 }, { d: 0.22, v: 'e', v2: 'i', f0: 440 * k, f1: 480 * k, a: 1, att: 0.015 },
    { d: 0.04, n: 'k', na: 0.45 }, { d: 0.13, v: 'i', f0: 430 * k, f1: 360 * k, a: 0.8 }, { d: 0.04, n: 't', na: 0.35 },
  ], KID);
}
function laughKid(R, f0) {
  const segs = [];
  for (let k = 0; k < 5; k++) { const f = f0 * (1 - k * 0.04); segs.push({ d: 0.035, v: 'a', f0: f, a: 0.12, br: 1.5, att: 0.01, rel: 0.01 }, { d: 0.08, v: 'a', v2: 'uh', f0: f, f1: f * 0.94, a: 0.9, br: 0.25, att: 0.008, rel: 0.03 }, { d: 0.035 }); }
  return talk(R, segs, KID);
}
const oohKid = (R, f0) => talk(R, [{ d: 0.55, v: 'oo', v2: 'u', f0: f0, f1: f0 * 1.28, a: 0.9, att: 0.06, rel: 0.18, br: 0.2 }], KID);
function cheer(R, f0, kind) {
  if (kind === 0) return talk(R, [{ d: 0.08, v: 'i', v2: 'e', f0: f0, f1: f0 * 1.05, a: 0.7 }, { d: 0.32, v: 'e', v2: 'a', f0: f0 * 1.05, f1: f0 * 0.85, a: 1, rel: 0.12 }], KID);
  return talk(R, [{ d: 0.45, v: 'u', v2: 'oo', f0: f0, f1: f0 * 1.3, a: 0.9, att: 0.03, rel: 0.15 }], KID);
}
function chatter(R, dur, voices, density = 1) {
  const L = new Float32Array(secs(dur + 0.2)), Rr = new Float32Array(secs(dur + 0.2)), V = ['a', 'e', 'i', 'o', 'u', 'uh', 'ae'];
  for (let v = 0; v < voices; v++) {
    const segs = []; let t = R() * 1.2; segs.push({ d: t || 0.01 });
    const base = 250 + R() * 140;
    while (t < dur - 1) {
      const syl = 2 + ((R() * 5) | 0); let f = base * (1.05 + 0.15 * R());
      for (let s = 0; s < syl; s++) {
        if (R() < 0.5) { const c = ['s', 't', 'k', 'sh'][(R() * 4) | 0]; segs.push({ d: 0.03, n: c, na: 0.15 }); t += 0.03; }
        const d = 0.07 + R() * 0.1; const vv = V[(R() * V.length) | 0];
        segs.push({ d, v: vv, v2: V[(R() * V.length) | 0], f0: f, f1: f * (0.9 + 0.15 * R()), a: 0.4 + 0.5 * R(), att: 0.012, rel: 0.025 });
        t += d; f *= 0.97;
      }
      const gap = (0.25 + R() * 1.0) / density; segs.push({ d: gap }); t += gap;
    }
    const x = filt(talk(R, segs, KID), 'lp', 4200, 0.7), p = (R() * 2 - 1) * 0.8;
    const gl = Math.cos((p + 1) * Math.PI / 4), gr = Math.sin((p + 1) * Math.PI / 4);
    for (let i = 0; i < x.length && i < L.length; i++) { L[i] += x[i] * gl; Rr[i] += x[i] * gr; }
  }
  return { L, R: Rr };
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
function cicadaBed(R, dur) {
  const n = secs(dur), out = { L: new Float32Array(n), R: new Float32Array(n) };
  [[5600, 43, -0.5, 0], [6900, 37, 0.55, 2.1]].forEach(([fc, rate, p, phs]) => {
    const x = filt(filt(noise(R, n), 'bp', fc, 6), 'bp', fc, 3);
    for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= Math.pow(0.5 + 0.5 * Math.sin(TAU * rate * t), 6) * (0.55 + 0.45 * Math.sin(TAU * t / 7.3 + phs)); }
    const gl = Math.cos((p + 1) * Math.PI / 4), gr = Math.sin((p + 1) * Math.PI / 4);
    for (let i = 0; i < n; i++) { out.L[i] += x[i] * gl; out.R[i] += x[i] * gr; }
  });
  return out;
}
function motorbike(R, dur, dir) {
  const n = secs(dur), tc = dur / 2, y = new Float32Array(n), base = 60 + R() * 25, tab = sawTab(base * 1.2); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; const f = base * (1 + 0.05 * Math.tanh((tc - t) / 0.5)) * (1 + 0.03 * Math.sin(TAU * 1.3 * t));
    ph += f / SR; ph -= Math.floor(ph);
    y[i] = (tabRead(tab, ph) + 0.35 * (R() * 2 - 1)) / (1 + Math.pow((t - tc) / 0.9, 2));
  }
  const z = filt(filt(y, 'lp', 1100, 0.7), 'hp', 110, 0.7); fadeEdges(z, 0.2, 0.2);
  return { sig: z, pan: (t) => dir * Math.tanh((t - tc) / 1.0) * 0.8 };
}
function horn(R) {
  const y = new Float32Array(secs(0.4));
  for (const [t0, d] of [[0, 0.11], [0.17, 0.16]]) {
    const n = secs(d), z = new Float32Array(n); let p1 = 0, p2 = 0;
    for (let i = 0; i < n; i++) { const a = 415 / SR, b = 523 / SR; p1 += a; if (p1 >= 1) p1--; p2 += b; if (p2 >= 1) p2--; z[i] = pulseS(p1, a, 0.5) + pulseS(p2, b, 0.5); }
    addInto(y, fadeEdges(z, 0.004, 0.01), secs(t0), 0.5);
  }
  return filtIn(filtIn(y, 'lp', 2800, 0.7), 'hp', 300, 0.7);
}
function windBed(R, dur) {
  const n = secs(dur), out = {};
  const gust = flutterEnv(R, n, 0.8);
  for (const ch of ['L', 'R']) {
    const x = filt(filt(noise(R, n), 'lp', (t) => 320 + 380 * gust[Math.min(n - 1, Math.round(t * SR))], 0.9), 'hp', 120, 0.7);
    for (let i = 0; i < n; i++) x[i] *= 0.45 + 0.55 * gust[i];
    out[ch] = x;
  }
  return out;
}

// ======================================================================= score data
const CH = {
  F: { root: 41, tri: [65, 69, 72], br: [65, 69, 72, 77] }, Dm: { root: 38, tri: [62, 65, 69], br: [62, 65, 69, 74] },
  Bb: { root: 34, tri: [58, 62, 65], br: [62, 65, 70, 74] }, C: { root: 36, tri: [60, 64, 67], br: [64, 67, 72, 76] },
  C7: { root: 36, tri: [60, 64, 70], br: [64, 67, 70, 72] }, Dm9: { root: 38, tri: [62, 65, 69], br: [65, 69, 72, 76] },
  G9: { root: 43, tri: [59, 62, 65], br: [65, 69, 71, 74] },
};
const MEL = {
  a1: [[0, 2, 69], [2, 2, 72], [4, 3, 77], [7, 1, 76], [8, 2, 77], [10, 2, 81], [12, 1, 79], [13, 3, 77]],
  a2: [[0, 2, 74], [2, 1, 77], [3, 3, 81], [6, 1, 79], [7, 1, 77], [8, 2, 76], [10, 2, 74], [12, 2, 72], [14, 2, 74]],
  a3: [[0, 3, 77], [3, 1, 74], [4, 2, 70], [6, 2, 74], [8, 2, 77], [10, 1, 79], [11, 1, 81], [12, 4, 82]],
  a4: [[0, 2, 81], [2, 2, 79], [4, 2, 76], [6, 2, 72], [8, 3, 79], [11, 1, 77], [12, 1, 76], [13, 1, 77], [14, 2, 79]],
  b2: [[0, 2, 74], [2, 2, 77], [4, 2, 81], [6, 2, 84], [8, 1, 82], [9, 1, 81], [10, 2, 79], [12, 4, 77]],
  b3: [[0, 2, 82], [2, 2, 81], [4, 2, 79], [6, 2, 77], [8, 2, 74], [10, 2, 77], [12, 2, 82], [14, 2, 86]],
  b4: [[0, 3, 84], [3, 1, 82], [4, 2, 81], [6, 2, 79], [8, 1, 76], [9, 1, 77], [10, 1, 79], [11, 1, 81], [12, 4, 84]],
  c3: [[0, 2, 77], [2, 2, 74], [4, 2, 70], [6, 2, 74], [8, 2, 77], [10, 2, 82], [12, 2, 81], [14, 2, 79]],
  fillA: [[0, 1, 72], [1, 1, 76], [2, 1, 79], [3, 1, 84], [4, 1, 88], [5, 1, 86], [6, 1, 84], [7, 1, 82]],
  L1: [[8, 1, 74], [9, 1, 77], [10, 1, 79], [11, 1, 81], [12, 2, 84], [14, 2, 81]],
  L2: [[8, 1, 81], [9, 1, 79], [10, 1, 77], [11, 1, 74], [12, 1, 77], [13, 1, 79], [14, 2, 74]],
  L3: [[8, 1, 86], [9, 1, 84], [10, 1, 81], [11, 1, 79], [12, 1, 81], [13, 1, 83], [14, 2, 86]],
  L4: [[8, 1, 74], [9, 1, 79], [10, 1, 83], [11, 1, 86], [12, 3, 89], [15, 1, 88]],
  bbRun: [[8, 1, 77], [9, 1, 79], [10, 1, 81], [11, 1, 82], [12, 1, 84], [13, 1, 86], [14, 2, 89]],
};
const TRI_A = [[0, 2, 0], [3, 1, 0], [4, 1, 12], [6, 2, 0], [8, 2, 7], [10, 1, 12], [11, 1, 0], [12, 2, 12], [14, 2, 7]];
const SLAP_DM = [[0, 'T', 0, 2], [2, 'P', 12], [3, 'G'], [5, 'T', 0], [6, 'P', 12], [7, 'G'], [8, 'T', 7, 2], [10, 'P', 15], [11, 'G'], [12, 'T', 5], [13, 'P', 12], [14, 'T', 3], [15, 'P', 14]];
const SLAP_G = [[0, 'T', 0, 2], [2, 'P', 12], [3, 'G'], [4, 'T', 0], [6, 'P', 10], [7, 'P', 12], [8, 'T', -2, 2], [10, 'P', 12], [11, 'G'], [12, 'T', 0], [13, 'G'], [14, 'T', 2], [15, 'P', 9]];
const SLAP_MAJ = [[0, 'T', 0, 2], [2, 'P', 12], [3, 'G'], [4, 'T', 0], [6, 'P', 12], [7, 'G'], [8, 'T', 7, 2], [10, 'P', 12], [11, 'G'], [12, 'T', 0], [13, 'G'], [14, 'P', 12], [15, 'T', 7]];
const FSC = [5, 7, 9, 10, 0, 2, 4];
function dia(m, steps) { let cur = m; const dir = Math.sign(steps); for (let s = 0; s < Math.abs(steps); s++) { do { cur += dir; } while (FSC.indexOf(((cur % 12) + 12) % 12) < 0); } return cur; }

// ======================================================================= score helpers
const leadNote = (m, len, duty = 0.25, vib = 0.2) => memo(`ld${m}_${len.toFixed(3)}_${duty}_${vib}`, () => chip(m, len, { duty, vib, d: 0.3, s: 0.6, r: 0.05, lp: 8000 }));
function lead(b0, mel, o = {}) {
  const sw = o.sw ?? 0.5, tr = o.tr || 0, g = o.g ?? 0.5, pan = o.pan ?? 0.05, maxP = o.upto ?? 99;
  for (const [p, l, m0] of mel) {
    if (p >= maxP) continue;
    const m = o.harm ? dia(m0, o.harm) : m0 + tr;
    const t = T(b0, p, sw), len = Math.max(0.05, l * 0.1 - 0.02);
    const s = leadNote(m, len, o.duty ?? 0.25, o.vib ?? 0.2);
    put(MH, t, s, { gain: g, pan, hall: o.hall ?? 0.1 });
    if (o.echo !== false) put(MH, t + 0.3, darkOf(s), { gain: g * 0.3, pan: -pan - 0.35, hall: 0.12 });
  }
}
function brassLine(b0, mel, o = {}) {
  const sw = o.sw ?? 0.5, tr = o.tr || 0;
  for (const [p, l, m] of mel) { if (p >= (o.upto ?? 99)) continue; put(MH, T(b0, p, sw), brass([m + tr], Math.max(0.07, l * 0.1 - 0.02), { soft: o.soft }), { gain: o.g ?? 0.5, hall: 0.12 }); }
}
function stab(t, ch, len, g = 0.5, o = {}) { put(MH, t, brass(CH[ch].br, len, o), { gain: g, hall: o.hall ?? 0.15 }); }
function arp(b0, ch, o = {}) {
  const ns = CH[ch].tri.map((m) => m + (o.oct ?? 12)); const seq = [ns[0], ns[1], ns[2], ns[0] + 12, ns[2], ns[1]];
  const from = o.from ?? 0, to = o.to ?? 16;
  for (let k = from; k < to; k++) {
    const m = seq[k % seq.length];
    put(MH, T(b0, k, o.sw ?? 0.5), memo(`arp${m}_${o.duty ?? 0.125}`, () => chip(m, 0.07, { duty: o.duty ?? 0.125, d: 0.05, s: 0.25, r: 0.02, lp: 6500 })), { gain: (o.g ?? 0.2) * (o.ramp ? o.ramp(k) : 1), pan: k % 2 ? 0.55 : -0.55, hall: 0.08 });
  }
}
function triBass(b0, ch, pat = TRI_A, o = {}) {
  const r = CH[ch].root;
  for (const [p, l, s] of pat) { if (p >= (o.upto ?? 16) || p < (o.from ?? 0)) continue; put(ML, T(b0, p, o.sw ?? 0.5), memo(`tb${r + s}_${l}`, () => tri(r + s, l * 0.1 * 0.82)), { gain: o.g ?? 0.75 }); }
}
function slapBar(b0, ch, pat, o = {}) {
  const r = CH[ch].root, sw = o.sw ?? 0.5;
  for (const e of pat) {
    const [p, kind, s = 0, l = 1] = e; if (p >= (o.upto ?? 16)) continue;
    const m = kind === 'G' ? r + 12 : r + s;
    put(ML, T(b0, p, sw), slapNote(m, kind, l * 0.1 * 0.85), { gain: (o.g ?? 0.7) * (kind === 'G' ? 0.5 : kind === 'P' ? 0.8 : 1), pan: kind === 'P' ? 0.1 : 0 });
  }
}
function chipDrums(b0, o = {}) {
  const sw = o.sw ?? 0.5, g = o.g ?? 1;
  for (const k of o.kicks ?? [0, 8]) put(ML, T(b0, k, sw), chipKick(), { gain: 0.85 * g });
  for (const k of o.snares ?? [4, 12]) put(MH, T(b0, k, sw), chipSnare(k % 3), { gain: 0.45 * g, room: 0.25 });
  const hs = o.hats16 ? 1 : 2;
  for (let k = 0; k < 16; k += hs) put(MH, T(b0, k, sw), chipHat(false, k % 4), { gain: (k % 4 === 0 ? 0.2 : 0.13) * g, pan: 0.25 });
}
function funkBar(b0, o = {}) {
  const sw = o.sw ?? SWF, g = o.g ?? 1;
  for (const k of o.kicks ?? [0, 3, 8, 10]) put(ML, T(b0, k, sw), kick(), { gain: 0.9 * g });
  for (const k of o.snares ?? [4, 12]) { put(MH, T(b0, k, sw), snare(k), { gain: 0.6 * g, room: 0.35, pan: -0.05 }); if (o.clap) put(MH, T(b0, k, sw) + 0.004, clap(k), { gain: 0.35 * g, room: 0.4, pan: 0.15 }); }
  for (const k of o.ghosts ?? [7, 9, 15]) put(MH, T(b0, k, sw), snare(1), { gain: 0.12 * g, room: 0.2 });
  for (let k = 0; k < 16; k++) {
    if (o.open != null && k === o.open) { put(MH, T(b0, k, sw), hat(true), { gain: 0.14 * g, pan: 0.3 }); continue; }
    put(MH, T(b0, k, sw), hat(false), { gain: (k % 4 === 0 ? 0.22 : k % 2 === 0 ? 0.17 : 0.1) * g, pan: 0.3 });
  }
}
const R_ = rngFor('score');

// ======================================================================= THE SCORE
console.log('score...');
// ---------- ambience (whole film; AMB envelope shapes it)
{
  const R = rngFor('amb');
  putAmb(0, cicadaBed(R, 90), { gain: 0.065, hall: 0.05 });
  putAmb(0, chatter(R, 90, 4, 0.8), { gain: 0.06, hall: 0.1 });
  putAmb(3.5, chatter(rngFor('rush'), 9.0, 6, 1.6), { gain: 0.085, hall: 0.1, env: (t) => ambEnv(t) * smooth((t - 3.5) / 0.8) * (1 - smooth((t - 11.6) / 0.5)) });
  for (const [t0, dir, g] of [[0.4, 1, 0.09], [5.2, -1, 0.07], [9.0, 1, 0.06], [16, -1, 0.06], [27, 1, 0.06], [38, -1, 0.06], [49, 1, 0.06], [60.3, -1, 0.09], [64.5, 1, 0.07], [76.5, -1, 0.06], [84.6, 1, 0.05]]) {
    const mb = motorbike(R, 4.0, dir); putAmb(t0, mb.sig, { gain: g, pan: mb.pan, hall: 0.05 });
  }
  for (const [t0, p, g] of [[1.3, 0.5, 0.05], [7.1, -0.6, 0.04], [61.3, 0.6, 0.06], [80.5, -0.5, 0.03]]) putAmb(t0, horn(R), { gain: g, pan: p, hall: 0.15 });
}

// ---------- INTRO 0-12
{
  const R = rngFor('intro');
  for (const [t0, g] of [[3.2, 0.9], [3.6, 0.9], [4.0, 1.0]]) put(FX2, t0, schoolDrum(R), { gain: g * 0.3, pan: -0.1, hall: 0.55 });
  // lazy 4 PM opening: ringing triangle Fmaj7 motif over the aerial shot, then soft 8th-note pulses after the school drum
  [[0.15, 65], [0.55, 69], [0.95, 72], [1.35, 76], [1.75, 72], [2.15, 69], [2.55, 72], [2.95, 77]].forEach(([t, m], k) => put(MH, t, memo('it' + m, () => tri(m, 0.5, { d: 0.25, s: 0.35, r: 0.25 })), { gain: 0.42 + 0.06 * (k / 7), pan: k % 2 ? 0.25 : -0.25, hall: 0.35 }));
  put(ML, 0.15, tri(41, 3.0, { d: 1.5, s: 0.5, r: 0.3 }), { gain: 0.35 });
  put(MH, 0.15, brass(CH.F.br, 2.9, { soft: true }), { gain: 0.16, hall: 0.4 });
  for (let k = 0; k < 10; k++) { const m = [65, 69, 72, 69, 65, 69, 72, 74, 72, 69][k]; put(MH, 4.4 + k * 0.2, memo('ip' + m, () => chip(m + 12, 0.12, { duty: 0.5, d: 0.08, s: 0.3, r: 0.04, lp: 5000 })), { gain: 0.12 + 0.012 * k, pan: k % 2 ? 0.4 : -0.4, hall: 0.25 }); }
  for (const t of [4.4, 5.2, 6.0]) put(ML, t, chipKick(), { gain: 0.45 });
  // chip arpeggio, opening up
  const prog = [['F', 6.4], ['Dm', 8.0], ['Bb', 9.6], ['C', 11.2]];
  for (const [ch, b0] of prog) {
    arp(b0, ch, { g: 0.22, ramp: (k) => 0.8 + 0.3 * smooth((b0 - 6.4 + k * 0.1) / 5.2), to: ch === 'C' ? 8 : 16 });
    triBass(b0, ch, [[0, 3, 0], [4, 3, 0], [8, 3, 12], [12, 3, 7]], { g: b0 < 8 ? 0.45 : 0.6, upto: ch === 'C' ? 8 : 16 });
  }
  for (let t = 8.0; t < 11.9; t += 0.2) put(MH, t, chipHat(false, 1), { gain: t < 9.6 ? 0.09 : 0.13, pan: 0.25 });
  for (const t of [6.4, 7.2, 8.0, 8.8, 9.6, 10.4]) put(ML, t, chipKick(), { gain: 0.55 });
  for (let k = 0; k < 8; k++) put(MH, 11.2 + k * 0.1, chipSnare(k % 3), { gain: 0.15 + 0.05 * k, room: 0.2 });
  put(MH, 11.2, ctom(52), { gain: 0.35 }); put(MH, 11.6, ctom(48), { gain: 0.35 });
  put(SFX, 9.6, riser(R, 2.4, 300, 6000), { gain: 0.22, hall: 0.2 });
  for (const t0 of [9.6, 10.4, 11.2]) put(SFX, t0, xoet(R, 0.3), { gain: 0.35, pan: 0.2, room: 0.3 });
  for (const t0 of [10.0, 10.8, 11.6]) put(SFX, t0, snip(R), { gain: 0.35, pan: 0.25, room: 0.3 });
  // band hit 12.0
  put(MH, 12.0, crash(R, 2.4), { gain: 0.32, hall: 0.25 });
  put(FX2, 12.0, bigBoom(R, 1.5), { gain: 0.45 });
  stab(12.0, 'F', 0.5, 0.55);
  put(ML, 12.0, kick(), { gain: 0.95 });
}

// ---------- A 12-30.4 chip groove
{
  const R = rngFor('A'), seq = ['F', 'Dm', 'Bb', 'C'], mels = [MEL.a1, MEL.a2, MEL.a3, MEL.a4];
  for (let k = 0; k < 11; k++) {
    const b0 = 12 + k * BAR, ch = seq[k % 4];
    triBass(b0, ch);
    if (k < 4) { chipDrums(b0, { kicks: [0, 8, 10] }); lead(b0, mels[k], { g: 0.42 }); arp(b0, ch, { g: 0.11 }); }
    else if (k < 8) { chipDrums(b0, { kicks: [0, 8], g: 0.85 }); lead(b0, mels[k % 4], { g: 0.36, tr: -12, duty: 0.5, vib: 0.12, echo: false, pan: -0.15 }); arp(b0, ch, { g: 0.14, duty: 0.25 }); }
    else { chipDrums(b0, { kicks: [0, 6, 8, 10], hats16: true }); lead(b0, mels[k % 4], { g: 0.4, duty: 0.125 }); lead(b0, mels[k % 4], { g: 0.22, harm: -2, duty: 0.25, echo: false, pan: -0.3 }); arp(b0, ch, { g: 0.09 }); }
  }
  // fill 29.6-30.4 (C)
  lead(29.6, MEL.fillA, { g: 0.4, duty: 0.25 });
  triBass(29.6, 'C', [[0, 2, 0], [2, 2, 0], [4, 1, 12], [5, 1, 10], [6, 1, 7], [7, 1, 4]]);
  [55, 52, 50, 47].forEach((m, i) => put(MH, 29.6 + 0.4 + i * 0.1, ctom(m), { gain: 0.4 }));
  put(ML, 29.6, chipKick(), { gain: 0.85 }); put(MH, 29.6, chipSnare(0), { gain: 0.35, room: 0.25 });
  // foley windows
  for (let t = 14.4; t < 17.55; t += 0.4) put(FX2, t, snip(R), { gain: 0.42, pan: 0.2, room: 0.3 });
  for (let k = 0; k < 8; k++) { const t = 17.6 + k * 0.4; put(FX2, t, filtIn(crinkle(R, 0.18, 500), 'hp', 1000, 0.7), { gain: 0.28, pan: -0.15, room: 0.2 }); if (k % 2 === 1) put(FX2, t + 0.2, filtIn(plopS(R), 'hp', 90, 0.7), { gain: 0.35, room: 0.25 }); }
  for (let k = 0; k < 8; k++) put(FX2, 20.8 + k * 0.4, grate(R, 0.3), { gain: 0.25, pan: 0.2, room: 0.2 });
  for (let k = 0; k < 32; k++) if (R() < 0.6 || k % 4 === 0) put(FX2, 24.0 + k * 0.1, dryDrop(R), { gain: 0.25 + 0.15 * R(), pan: R() * 1.2 - 0.6, room: 0.2 });
  for (let k = 0; k < 8; k++) put(FX2, 27.2 + k * 0.4, eggPop(R), { gain: 0.38, pan: (k % 2 ? 0.2 : -0.1), room: 0.25 });
}
function plopS(R) {
  const n = secs(0.22), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (230 * Math.pow(85 / 230, Math.min(1, t / 0.12))) / SR; y[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.05) * Math.min(1, t / 0.002); }
  addInto(y, burst(R, 0.03, 'lp', 1200, 0.7, 0.008), 0, 0.3);
  return fadeEdges(y, 0.0005, 0.02);
}
function eggPop(R) {
  const y = new Float32Array(secs(0.2)); let ph = 0; const f0 = 500 + R() * 150;
  for (let i = 0; i < y.length; i++) { const t = i / SR; ph += f0 * (1 + 1.4 * Math.min(1, t / 0.05)) / SR; y[i] = Math.sin(TAU * ph) * Math.exp(-t / 0.035) * Math.min(1, t / 0.001); }
  addInto(y, burst(R, 0.01, 'bp', 2500, 1, 0.002), 0, 0.5);
  return filtIn(fadeEdges(y, 0.0005, 0.02), 'hp', 200, 0.7);
}

// ---------- B 30.4-46.4 funk
{
  const R = rngFor('B');
  const chs = ['Dm9', 'G9', 'Dm9', 'G9', 'Dm9', 'G9', 'Dm9', 'G9', 'Bb', 'C'];
  const licks = [MEL.L1, MEL.L2, MEL.L3, MEL.L4];
  for (let k = 0; k < 10; k++) {
    const b0 = 30.4 + k * BAR, ch = chs[k];
    const pat = ch === 'Dm9' ? SLAP_DM : ch === 'G9' ? SLAP_G : SLAP_MAJ;
    slapBar(b0, ch, pat, { sw: SWF });
    funkBar(b0, { open: k % 2 ? 14 : null, kicks: k === 9 ? [0, 3, 6] : undefined, clap: k >= 4 });
    if (k < 4) {
      stab(T(b0, 2, SWF), ch, 0.12, 0.42); stab(T(b0, 7, SWF), ch, 0.1, 0.36);
      lead(b0, licks[k], { g: 0.36, sw: SWF, duty: 0.25, pan: 0.15 });
    } else if (k < 8) {
      brassLine(b0, [MEL.b2, MEL.b3, MEL.b2, MEL.b4][k - 4], { sw: SWF, g: 0.55 });
      arp(b0, ch, { g: 0.08, sw: SWF });
      if (k === 6) lead(b0, MEL.b2, { g: 0.18, sw: SWF, duty: 0.125, tr: 12, echo: false, pan: 0.3 });
    } else if (k === 8) {
      brassLine(b0, MEL.c3, { sw: SWF, g: 0.5 }); lead(b0, MEL.c3, { g: 0.26, sw: SWF, duty: 0.25, pan: 0.2 });
    } else {
      for (const p of [0, 3, 6]) stab(T(b0, p, SWF), 'C', 0.14, 0.5);
      lead(b0, MEL.bbRun, { g: 0.38, sw: SWF, duty: 0.25 });
      [52, 50, 48, 45].forEach((m, i) => put(MH, T(b0, 8 + i * 2, SWF), ctom(m), { gain: 0.35 }));
    }
  }
  // foley windows
  for (let k = 0; k < 4; k++) put(FX2, 30.4 + k * 0.8, glug(R), { gain: 0.45, pan: -0.15, room: 0.3 });
  for (let k = 0; k < 8; k++) put(FX2, 30.4 + k * 0.4 + 0.3, drip(R), { gain: 0.15, pan: 0.2, room: 0.3 });
  for (let k = 0; k < 32; k++) put(FX2, T(33.6 + Math.floor(k / 16) * BAR, k % 16, SWF), tss(R, k % 8 === 6), { gain: k % 2 ? 0.1 : 0.16, pan: 0.35, room: 0.15 });
  for (let k = 0; k < 8; k++) put(FX2, 36.8 + k * 0.4 + (k % 2 ? 0.12 : 0), squirt(R), { gain: 0.3, pan: (k % 2 ? 0.3 : -0.2), room: 0.25 });
  put(FX2, 40.0, drizzle(R, 1.5), { gain: 0.3, pan: 0.1, room: 0.25 }); put(FX2, 41.6, drizzle(R, 1.5), { gain: 0.3, pan: -0.1, room: 0.25 });
  for (let k = 0; k < 24; k++) put(FX2, 43.2 + k * 0.1 + R() * 0.03, tick(R, 2200 + R() * 1500), { gain: 0.18, pan: R() * 1.2 - 0.6, room: 0.2 });
  put(FX2, 45.6, leafRustle(R, 0.7), { gain: 0.25, pan: 0.2, room: 0.2 });
}

// ---------- C 46.4-50.4 build + shake
{
  const R = rngFor('C');
  const b0 = 46.4;
  for (let k = 0; k < 16; k++) put(MH, b0 + k * 0.1, chipSnare(k % 3), { gain: 0.12 + 0.025 * k, room: 0.25 });
  for (let k = 0; k < 8; k++) put(MH, 47.2 + k * 0.05, snare(k % 2), { gain: 0.1 + 0.04 * k, room: 0.3 });
  for (let k = 0; k < 16; k++) put(FX2, b0 + k * 0.1, bagShake(k % 8), { gain: 0.12 + 0.012 * k, pan: k % 2 ? 0.35 : -0.35, room: 0.2 });
  for (let k = 0; k < 16; k += 2) put(ML, b0 + k * 0.1, memo('cped', () => tri(36, 0.16)), { gain: 0.65 });
  arp(b0, 'C', { g: 0.12, ramp: (k) => 0.6 + 0.6 * k / 16, oct: 12 });
  put(SFX, b0, riser(R, 1.6, 400, 8000), { gain: 0.25, hall: 0.2 });
  put(MH, 47.2, reverseCrash(R, 0.8), { gain: 0.22 });
  for (const t of [46.4, 47.2]) put(ML, t, kick(), { gain: 0.8 });
  // hit 48.0
  put(MH, 48.0, crash(R, 2.4), { gain: 0.32, hall: 0.25 });
  put(FX2, 48.0, bigBoom(R, 1.3, 80, 35, 0.4), { gain: 0.4 });
  stab(48.0, 'F', 0.45, 0.55); put(ML, 48.0, kick(), { gain: 1 });
  put(MH, 48.0, chip(77, 0.4, { duty: 0.25, d: 0.2, s: 0.4, arp: [0, 4, 7, 12], arpRate: 40 }), { gain: 0.3, hall: 0.2 });
  // slow-mo half-time swirl 48.0-50.4
  put(MH, 48.5, brass(CH.F.br, 1.1, { soft: true }), { gain: 0.32, hall: 0.35 });
  for (const [t, g] of [[48.0, 0], [49.2, 0.85]]) if (g) put(ML, t, kick(), { gain: g });
  for (const t of [48.8, 50.0]) { put(MH, t, snare(2), { gain: 0.5, room: 0.4, hall: 0.25 }); put(MH, t + 0.004, clap(2), { gain: 0.3, room: 0.4, hall: 0.3 }); }
  for (let k = 0; k < 12; k++) put(FX2, 48.0 + k * 0.2, bagShake((k + 3) % 8), { gain: 0.26, pan: k % 2 ? 0.45 : -0.45, room: 0.3, hall: 0.1 });
  put(ML, 48.0, tri(41, 1.5, { d: 0.6, s: 0.5 }), { gain: 0.65 }); put(ML, 49.6, tri(36, 0.7, { d: 0.4, s: 0.6 }), { gain: 0.6 });
  arp(48.0, 'F', { g: 0.1, oct: 24, duty: 0.25, to: 16 });
  put(MH, 49.6, reverseCrash(R, 0.8), { gain: 0.28 });
  lead(49.6, MEL.fillA, { g: 0.36, duty: 0.25 });
}

// ---------- D 50.4-60 tutti
{
  const R = rngFor('D'), seq = ['F', 'Dm', 'Bb', 'C'], mels = [MEL.a1, MEL.a2, MEL.a3, MEL.a4];
  put(MH, 50.4, crash(R, 2.0), { gain: 0.28, hall: 0.2 });
  for (let k = 0; k < 4; k++) {
    const b0 = 50.4 + k * BAR, ch = seq[k];
    slapBar(b0, ch, ch === 'Dm' ? SLAP_DM : SLAP_MAJ, { sw: 0.5, g: 0.62 });
    triBass(b0, ch, TRI_A, { g: 0.35 });
    funkBar(b0, { sw: 0.5, clap: true, open: 14 });
    lead(b0, mels[k], { g: 0.42, duty: 0.25 });
    brassLine(b0, mels[k], { g: 0.34, tr: -12 });
    arp(b0, ch, { g: 0.1, duty: 0.125, oct: 24 });
  }
  // ta-da
  const hits = [[56.8, 'Bb', 0.7], [57.6, 'C', 0.7], [58.4, 'F', 1.25]];
  for (const [t, ch, len] of hits) {
    stab(t, ch, len, 0.55); put(ML, t, kick(), { gain: 0.95 }); put(MH, t, snare(0), { gain: 0.5, room: 0.3 });
    put(ML, t, slapNote(CH[ch].root, 'T', len * 0.8), { gain: 0.7 });
    put(MH, t, chip(CH[ch].tri[2] + 12, len * 0.8, { duty: 0.25, d: 0.25, s: 0.5, arp: [0, -3, -7, -12].map((x) => x + 0), arpRate: 30, vib: 0.15 }), { gain: 0.22, hall: 0.2 });
  }
  put(MH, 56.8, crash(R, 1.4), { gain: 0.18, hall: 0.2 });
  put(MH, 58.4, crash(R, 2.4), { gain: 0.3, hall: 0.25 });
  for (let k = 0; k < 8; k++) put(MH, 58.4 + 0.4 + k * 0.05, chip(89 - k * 2, 0.05, { duty: 0.125, d: 1, s: 1, r: 0.01 }), { gain: 0.12 * (1 - k / 10), pan: k % 2 ? 0.3 : -0.3, hall: 0.2 });
  // foley
  for (let k = 0; k < 8; k++) put(FX2, 53.6 + k * 0.4, softThud(R), { gain: 0.4, pan: (k % 2 ? 0.15 : -0.15), room: 0.25 });
  for (let k = 0; k < 6; k++) put(FX2, 56.9 + k * 0.5 + R() * 0.1, iceClink(R, 2000 + R() * 1200), { gain: 0.22, pan: 0.3, room: 0.3, hall: 0.1 });
}

// ---------- E 60-63.2 "bland" sad wah + fork scrapes
{
  const R = rngFor('E');
  [[60.0, 70], [60.8, 69], [61.6, 68], [62.4, 67]].forEach(([t, m], i) => {
    put(MH, t, wah(m, i === 3 ? 0.85 : 0.68, { wob: i === 3 }), { gain: 0.23, hall: 0.2 });
    put(ML, t, tri(m - 24, i === 3 ? 0.8 : 0.66, { d: 0.5, s: 0.6 }), { gain: 0.35 });
  });
  put(SFX, 60.45, forkScrape(R, 0.35), { gain: 0.22, pan: 0.15, room: 0.3 });
  put(SFX, 61.25, forkScrape(R, 0.3), { gain: 0.2, pan: 0.15, room: 0.3 });
  put(SFX, 62.15, forkScrape(R, 0.25), { gain: 0.18, pan: 0.1, room: 0.3 });
}

// ---------- F 63.2-66.4 kids laugh + "You gotta SHAKE it!", shaker, cowbell
{
  const R = rngFor('F');
  [[63.25, 470, -0.4], [63.32, 430, 0.3], [63.4, 520, 0.6], [63.3, 390, -0.1]].forEach(([t, f, p]) => put(SFX, t, laughKid(R, f), { gain: 0.16, pan: p, room: 0.3, hall: 0.1 }));
  [[63.95, 400, -0.2], [63.97, 440, 0.2], [63.96, 370, 0.05]].forEach(([t, f, p]) => put(SFX, t, shoutKid(R, f), { gain: 0.26, pan: p, room: 0.3, hall: 0.12 }));
  const chs = ['F', 'C'];
  for (let k = 0; k < 2; k++) {
    const b0 = 63.2 + k * BAR;
    for (let j = 0; j < 16; j++) put(FX2, b0 + j * 0.1, bagShake(j % 8), { gain: j % 4 === 0 ? 0.32 : j % 2 ? 0.16 : 0.22, pan: 0.35, room: 0.2 });
    for (const j of [0, 3, 6, 10, 12]) put(MH, b0 + j * 0.1, cowbell(), { gain: 0.16, pan: -0.3, room: 0.25 });
    for (const j of [0, 8, 10]) put(ML, b0 + j * 0.1, chipKick(), { gain: 0.75 });
    put(MH, b0 + 1.2, chipSnare(1), { gain: 0.25, room: 0.2 });
    triBass(b0, chs[k], [[0, 2, 0], [4, 1, 12], [6, 2, 0], [8, 2, 7], [12, 2, 12], [14, 2, 7]], { g: 0.7 });
    arp(b0, chs[k], { g: 0.08, duty: 0.25, from: 8 });
  }
}

// ---------- G 66.4-69.6 bartender show: whooshes + "ooh" + swing slap groove
{
  const R = rngFor('G');
  for (let k = 0; k < 2; k++) {
    const b0 = 66.4 + k * BAR, ch = ['F', 'C'][k];
    slapBar(b0, ch, SLAP_MAJ, { sw: SWF, g: 0.66 });
    funkBar(b0, { sw: SWF, clap: true, open: k ? 14 : null });
    stab(T(b0, 2, SWF), ch, 0.12, 0.38); stab(T(b0, 10, SWF), ch, 0.12, 0.34);
    arp(b0, ch, { g: 0.07, sw: SWF });
  }
  [66.4, 67.2, 68.0, 68.8].forEach((t, i) => {
    const p = i % 2 ? 0.6 : -0.6;
    put(SFX, t - 0.18, whoosh(R, 0.45, 300, 2400, 500, 0.4), { gain: 0.35, pan: (u) => p * (u / 0.45 * 2 - 1), hall: 0.1 });
    [[340, -0.4], [380, 0.1], [420, 0.5]].forEach(([f, pp], j) => put(SFX, t + 0.08 + j * 0.015, oohKid(R, f * (1 + i * 0.03)), { gain: 0.11, pan: pp, room: 0.3, hall: 0.12 }));
    put(MH, t + 0.2, chip(77 + [0, 4, 7, 12][i], 0.12, { duty: 0.25, d: 0.1, s: 0.4 }), { gain: 0.2, pan: -p * 0.5, hall: 0.15 });
  });
}

// ---------- H 69.6-72 the toss: glissando + riser (cut dead at 72.0)
{
  const R = rngFor('H');
  put(MH, 69.6, chip(60, 2.4, { duty: (t) => 0.125 + 0.25 * t / 2.4, bend: (t) => 36 * Math.pow(t / 2.4, 1.3), d: 3, s: 1, r: 0.01, vib: 0.3 }), { gain: 0.26, hall: 0.25 });
  put(SFX, 69.6, riser(R, 2.4, 250, 9000), { gain: 0.3, hall: 0.2 });
  put(SFX, 70.4, whoosh(R, 0.9, 200, 1800, 5000, 0.5), { gain: 0.28, hall: 0.2 });
  for (let k = 0; k < 24; k++) put(MH, 69.6 + k * 0.1, chipSnare(k % 3), { gain: 0.1 + 0.012 * k, room: 0.25 });
  for (let k = 0; k < 12; k++) put(ML, 69.6 + k * 0.2, memo(`hb${k}`, () => tri(36 + k, 0.17)), { gain: 0.6 });
  put(ML, 69.6, kick(), { gain: 0.85 }); put(ML, 70.4, kick(), { gain: 0.85 }); put(ML, 71.2, kick(), { gain: 0.85 });
}

// ---------- 72.8 catch + four power-ups, 74.4 full band
{
  const R = rngFor('J');
  put(SFX, 72.8, plasticThud(R), { gain: 0.6, room: 0.3 });
  put(FX2, 72.8, bigBoom(R, 1.4, 90, 34, 0.45), { gain: 0.5 });
  put(MH, 72.8, crash(R, 2.2), { gain: 0.3, hall: 0.25 });
  const pu = [[72.8, 65, 'F'], [73.2, 69, 'Dm'], [73.6, 72, 'Bb'], [74.0, 77, 'C']];
  for (const [t, base, ch] of pu) {
    put(SFX, t + 0.02, powerUp(base, [0, 4, 7]), { gain: 0.3, pan: 0, hall: 0.15 });
    stab(t, ch, 0.25, 0.42); put(ML, t, kick(), { gain: 0.85 });
    put(ML, t, memo('pb' + ch, () => tri(CH[ch].root + 12, 0.3)), { gain: 0.6 });
  }
  for (let k = 0; k < 8; k++) put(MH, 72.8 + k * 0.2, chipHat(false, k % 4), { gain: 0.14, pan: 0.25 });
  // 74.4 - 84.4 full band
  put(MH, 74.4, crash(R, 2.2), { gain: 0.3, hall: 0.25 });
  const bars = [[74.4, 'F', MEL.a1], [76.0, 'Dm', MEL.a2], [77.6, 'Bb', MEL.a3], [79.2, 'C', MEL.b4]];
  bars.forEach(([b0, ch, mel], k) => {
    slapBar(b0, ch, ch === 'Dm' ? SLAP_DM : SLAP_MAJ, { sw: 0.5, g: 0.62 });
    triBass(b0, ch, TRI_A, { g: 0.32 });
    funkBar(b0, { sw: 0.5, clap: true, open: 14 });
    chipDrums(b0, { kicks: [], snares: [], hats16: true, g: 0.7 });
    lead(b0, mel, { g: 0.42, duty: 0.25 }); lead(b0, mel, { g: 0.2, harm: -2, duty: 0.125, echo: false, pan: -0.3 });
    brassLine(b0, mel, { g: 0.32, tr: -12 });
    arp(b0, ch, { g: 0.08, oct: 24 });
  });
  // 80.8 Bb half bar, 81.6 C7 half bar
  slapBar(80.8, 'Bb', SLAP_MAJ, { upto: 8, g: 0.62 }); funkBar(80.8, { sw: 0.5, clap: true }); lead(80.8, MEL.c3, { g: 0.4, upto: 8 }); brassLine(80.8, MEL.c3, { g: 0.32, tr: -12, upto: 8 });
  slapBar(81.6, 'C7', SLAP_MAJ, { upto: 8, g: 0.62 }); lead(81.6, MEL.fillA, { g: 0.4 }); stab(81.6, 'C7', 0.25, 0.45); stab(82.0, 'C7', 0.25, 0.45);
  [55, 52, 50, 47].forEach((m, i) => put(MH, 82.0 + i * 0.1, ctom(m), { gain: 0.4 })); put(ML, 81.6, kick(), { gain: 0.9 });
  // massed bag shakers 79.2-81.6
  for (let k = 0; k < 24; k++) for (let v = 0; v < 3; v++) put(FX2, 79.2 + k * 0.1 + v * 0.007, bagShake((k + v * 3) % 8), { gain: (k % 2 ? 0.1 : 0.15) * (v ? 0.8 : 1), pan: [-0.7, 0, 0.7][v], room: 0.25 });
  // applause + cheers 76-79.2
  putS(FX2, 76.0, applause(R, 3.6), { gain: 0.32, room: 0.2, hall: 0.15 });
  [[76.1, 420, 0, -0.5], [76.25, 470, 1, 0.4], [76.6, 390, 0, 0.1], [77.3, 500, 1, -0.3], [78.0, 440, 0, 0.6]].forEach(([t, f, kind, p]) => put(SFX, t, cheer(R, f, kind), { gain: 0.12, pan: p, room: 0.25, hall: 0.15 }));
  // 82.4 cadence
  put(MH, 82.4, crash(R, 2.6), { gain: 0.32, hall: 0.3 });
  put(FX2, 82.4, bigBoom(R, 1.6, 85, 33, 0.55), { gain: 0.45 });
  stab(82.4, 'F', 1.3, 0.55); put(ML, 82.4, kick(), { gain: 1 }); put(ML, 82.4, slapNote(41, 'T', 1.2), { gain: 0.7 });
  put(ML, 82.4, tri(29, 1.6, { d: 0.8, s: 0.4 }), { gain: 0.5 });
  put(MH, 82.4, ting(m2f(89), 1.2), { gain: 0.12, hall: 0.3 }); put(MH, 82.4, ting(m2f(96), 1.0), { gain: 0.08, hall: 0.3, pan: 0.3 });
  for (let k = 0; k < 14; k++) { const m = [65, 69, 72, 77, 81, 84, 89][k % 7] + (k >= 7 ? 0 : 0); put(MH, 82.6 + k * 0.12 * (1 + k * 0.05), chip(m + 12, 0.07, { duty: 0.125, d: 0.05, s: 0.2, r: 0.02, lp: 6500 }), { gain: 0.12 * (1 - k / 16), pan: k % 2 ? 0.4 : -0.4, hall: 0.2 }); }
}
function putS(b, t0, sig, o) { put(b, t0, sig, o); }

// ---------- CTA 84.4-90
{
  const R = rngFor('CTA');
  for (let t = 84.4; t < 89.3; t += 0.4) put(FX2, t, heartThump(), { gain: 0.5 });
  const chs = [[84.4, 'F'], [85.2, 'Dm'], [86.0, 'Bb'], [86.8, 'C'], [87.6, 'F']];
  for (const [b0, ch] of chs) {
    const half = b0 < 87.6;
    for (let k = 0; k < (half ? 8 : 12); k += 2) put(ML, b0 + k * 0.1, memo(`ctb${ch}${k % 4}`, () => tri(CH[ch].root + (k % 4 ? 12 : 0), 0.16)), { gain: 0.5 });
    for (let k = 0; k < (half ? 8 : 12); k += 2) put(MH, b0 + k * 0.1, chipHat(false, k % 4), { gain: 0.1, pan: 0.25 });
    put(ML, b0, chipKick(), { gain: 0.8 }); put(MH, b0 + 0.4, chipSnare(1), { gain: 0.3, room: 0.25 }); if (!half) put(MH, b0 + 1.2, chipSnare(2), { gain: 0.3, room: 0.25 });
    arp(b0, ch, { g: 0.11, to: half ? 8 : 12 });
  }
  lead(84.4, [[0, 1, 84], [1, 1, 81], [2, 2, 77], [4, 1, 81], [5, 1, 84], [6, 2, 89]], { g: 0.36 });
  lead(85.2, [[0, 2, 81], [2, 2, 77], [4, 4, 74]], { g: 0.32 });
  lead(86.0, [[4, 2, 82], [6, 2, 86]], { g: 0.32 });
  lead(86.8, [[0, 2, 84], [2, 2, 88], [4, 4, 91]], { g: 0.32 });
  put(SFX, 85.15, uiClick(R), { gain: 0.4, pan: 0.1 }); put(SFX, 85.2, coin(), { gain: 0.32, hall: 0.12 });
  put(SFX, 85.95, uiClick(R), { gain: 0.4, pan: 0.1 }); put(SFX, 86.0, levelUp(), { gain: 0.3, hall: 0.15 });
  put(MH, 86.0, ting(m2f(101), 0.8), { gain: 0.06, hall: 0.3 });
  // outro tag
  lead(87.6, [[0, 2, 89], [2, 2, 84], [4, 8, 89]], { g: 0.36, vib: 0.25 });
  put(MH, 88.0, brass(CH.F.br, 0.9), { gain: 0.42, hall: 0.25 });
  put(ML, 88.0, tri(29, 1.2, { d: 0.6, s: 0.5 }), { gain: 0.5 }); put(ML, 88.0, kick(), { gain: 0.8 });
  put(MH, 88.0, crash(R, 1.8), { gain: 0.18, hall: 0.3 });
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
filtIn(MH.L, 'hp', 110, 0.7); filtIn(MH.R, 'hp', 110, 0.7); filtIn(MH.L, 'lp', 13000, 0.7); filtIn(MH.R, 'lp', 13000, 0.7);
const musL = new Float32Array(N), musR = new Float32Array(N);
filtIn(MH.L, 'peak', 3600, 0.6, 3); filtIn(MH.R, 'peak', 3600, 0.6, 3);
const ML_G = 0.6;
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
// wind bed in the hush (after the limiter, fixed level: RMS -46 dBFS over 72.05-72.75)
{
  const R = rngFor('wind'), w = windBed(R, 3.2), w0 = Math.round(71.0 * SR);
  const env = (t) => smooth((t - 71) / 0.9) * (1 - smooth((t - 72.85) / 1.2));
  let ss = 0, cnt = 0; const a = Math.round(72.05 * SR), b = Math.round(72.75 * SR);
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
  const W = [['intro', 0.3, 12], ['A', 12, 30.4], ['B', 30.4, 46.4], ['C', 46.4, 50.4], ['D', 50.4, 60], ['E', 60, 63.2], ['F', 63.2, 66.4], ['G', 66.4, 69.6], ['H', 69.6, 72], ['hush', 72.05, 72.75], ['burst', 72.8, 73.3], ['J', 74.4, 84.4], ['CTA', 84.4, 88.8]];
  console.log('section RMS: ' + W.map(([k, a, b]) => `${k} ${rms(a, b).toFixed(1)}`).join(' | '));
  // GR hot spots
  const hot = []; for (let s = 0; s < 90; s += 0.5) { let m = 1; for (let i = Math.round(s * SR); i < Math.round((s + 0.5) * SR); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -3 / 20)) hot.push(`${s.toFixed(1)}(${(-dbf(m)).toFixed(1)})`); }
  console.log('GR > 3 dB at: ' + (hot.join(' ') || 'none'));
  const hush = rms(72.05, 72.75), burstR = rms(72.8, 73.3);
  const checks = [
    ['format 48k/2ch/16-bit/90.000 s', ch === 2 && sr === 48000 && bits === 16 && n === N],
    [`loudness -15 +-0.5 (${lu.integ.toFixed(2)})`, Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    [`true peak <= -1.45 dBTP (${dbf(tp).toFixed(2)})`, dbf(tp) <= -1.45],
    ['no clipping', clipped === 0],
    [`hush RMS in [-70,-38] (${hush.toFixed(1)})`, hush >= -70 && hush <= -38],
    [`burst 72.8-73.3 > -30 dBFS (${burstR.toFixed(1)})`, burstR > -30],
    ['tail digital zero', tailZero],
    [`limiter GR <= 6 dB (${grDb.toFixed(2)})`, grDb <= 6],
  ];
  let ok = true; for (const [k, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + k); if (!v) ok = false; }
  console.log(`run time ${((Date.now() - T_START) / 1000).toFixed(1)} s`);
  if (!ok) process.exitCode = 1;
}
