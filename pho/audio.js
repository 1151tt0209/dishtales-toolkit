'use strict';
/* Phở bò Hà Nội (90 s, vertical) - soundtrack generator.  node audio.js  ->  audio.wav
 * Style: "Lo-fi Hanoi morning". 80 BPM (beat 0.75 s, bar 3.0 s), lo-fi hip-hop groove with 58 % 16th
 * swing, đàn bầu lead (scoops, slides, bends, deep vibrato), FM Rhodes, round sine bass, misty pad,
 * tape wow/flutter + vinyl bed. No sáo / tranh / mõ / phách (those belong to the 120 BPM folk films).
 * Generic DSP + foley helpers are shared with buncha/audio.js; every instrument and the score are new. */
const fs = require('fs');
const path = require('path');

// ───────────────────────────── 1. Core ─────────────────────────────
const SR = 48000;
const DUR = 90.0;
const N = Math.round(SR * DUR);
const BEAT = 0.75;           // 80 BPM
const BAR = 4 * BEAT;        // 3.0 s
const S16 = BEAT / 4;        // 0.1875 s
const SWING = 0.58;          // 16th swing: the off-16th lands at 58 % of the 8th
const TAU = Math.PI * 2;
const TARGET_LUFS = -15.0;
const CEIL_DBTP = -1.45;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rngFor = (name) => mulberry32(hashStr('pho:' + name));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
const secs = (s) => Math.max(1, Math.round(s * SR));
const expi = (a, b, u) => a * Math.pow(b / a, clamp(u, 0, 1));
// swung 16th grid: k-th 16th after a beat-aligned origin
const sw = (k) => Math.floor(k / 2) * (2 * S16) + (k % 2 ? 2 * S16 * SWING : 0);

// ───────────────────────────── 2. Generic DSP + foley helpers (shared with buncha) ─────────────────────────────
function pw(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return t1 === t0 ? v1 : v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
  }
  return keys[keys.length - 1][1];
}

// ───────────────────────────── 2. DSP helpers ─────────────────────────────
function norm(x, peak = 1) {
  let m = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; }
  if (m > 0) { const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; }
  return x;
}
function norm2(L, R, peak = 1) {
  let m = 0; for (let i = 0; i < L.length; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > m) m = a; }
  if (m > 0) { const g = peak / m; for (let i = 0; i < L.length; i++) { L[i] *= g; R[i] *= g; } }
  return [L, R];
}
function noise(n, R) { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = R() * 2 - 1; return x; }
function addInto(dst, src, off = 0, g = 1) {
  for (let i = 0; i < src.length; i++) { const j = i + off; if (j >= 0 && j < dst.length) dst[j] += src[i] * g; }
  return dst;
}
// add mono grain into a stereo pair with equal-power pan
function addPan(L, R, src, off, g, pan) {
  const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4, gl = Math.cos(a) * g, gr = Math.sin(a) * g;
  for (let i = 0; i < src.length; i++) { const j = i + off; if (j >= 0 && j < L.length) { L[j] += src[i] * gl; R[j] += src[i] * gr; } }
}
function fadeEdges(x, inS = 0.002, outS = 0.004) {
  const a = Math.min(secs(inS), x.length >> 1), b = Math.min(secs(outS), x.length >> 1);
  for (let i = 0; i < a; i++) x[i] *= i / a;
  for (let i = 0; i < b; i++) x[x.length - 1 - i] *= i / b;
  return x;
}
const fade2 = ([L, R], a, b) => [fadeEdges(L, a, b), fadeEdges(R, a, b)];
function mulEnv(x, fn) { for (let i = 0; i < x.length; i++) x[i] *= fn(i / SR); return x; }

// RBJ biquad
function coefs(type, f, Q, gdb) {
  f = clamp(f, 10, SR * 0.47);
  const w = TAU * f / SR, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * Q);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; break;
    case 'peak': { const A = Math.pow(10, gdb / 40); b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; break; }
    default: throw new Error('filter type ' + type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
// f and Q may be numbers or functions of time (seconds, local)
function filt(x, type, f, Q = 0.707, gdb = 0) {
  const y = new Float32Array(x.length);
  const dyn = typeof f === 'function' || typeof Q === 'function';
  const fv = (t) => (typeof f === 'function' ? f(t) : f), qv = (t) => (typeof Q === 'function' ? Q(t) : Q);
  let c = coefs(type, fv(0), qv(0), gdb);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (dyn && (i & 31) === 0) c = coefs(type, fv(i / SR), qv(i / SR), gdb);
    const x0 = x[i];
    const y0 = c[0] * x0 + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0;
  }
  return y;
}
// envelope-shaped noise burst (attack, exponential decay), optionally filtered
function burst(R, dur, type, fc, Q = 1, decay = dur / 4, attack = 0.0005) {
  const n = secs(dur); const x = noise(n, R);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= t < attack ? t / attack : Math.exp(-(t - attack) / decay); }
  const y = type ? filt(x, type, fc, Q) : x;
  return fadeEdges(y, 0.0002, 0.001);
}
// smoothed random flutter 0..1 (|lowpassed noise|, normalised)
function flutter(R, n, fc) { const x = norm(filt(filt(noise(n, R), 'lp', fc, 0.7), 'lp', fc, 0.7)); for (let i = 0; i < n; i++) x[i] = Math.abs(x[i]); return x; }
// sum of exponentially decaying sine modes: [[freq, decay, amp], ...]
function modal(modes, dur, att = 0.0004) {
  const n = secs(dur), y = new Float32Array(n);
  for (const [f, d, a] of modes) {
    const w = TAU * f / SR;
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] += a * Math.sin(w * i) * Math.exp(-t / d); }
  }
  for (let i = 0, m = secs(att); i < m && i < n; i++) y[i] *= i / m;
  return fadeEdges(y, 0.0001, Math.min(0.02, dur * 0.2));
}
// rising-pitch bubble / droplet chirp
function bubble(f0, len, rise = 0.9, dec = 0.3) {
  const m = secs(len), b = new Float32Array(m); let ph = 0;
  for (let i = 0; i < m; i++) { const tt = i / SR; ph += f0 * (1 + rise * tt / len) / SR; b[i] = Math.sin(TAU * ph) * (tt < 0.001 ? tt / 0.001 : 1) * Math.exp(-tt / (len * dec)); }
  return fadeEdges(b, 0.0005, 0.004);
}
// single-cycle wavetable (additive, band-limited by construction)
function makeTable(amps) {
  const T = 2048, tab = new Float32Array(T + 1);
  for (let h = 0; h < amps.length; h++) { const a = amps[h]; if (!a) continue; for (let j = 0; j < T; j++) tab[j] += a * Math.sin(TAU * (h + 1) * j / T); }
  norm(tab.subarray(0, T)); tab[T] = tab[0];
  return tab;
}
function tabRead(tab, ph) { const T = tab.length - 1, p = ph * T, i = p | 0, f = p - i; return tab[i] + (tab[i + 1] - tab[i]) * f; }
function crash(R, dur = 2.2) { // stereo
  const n = secs(dur);
  const mk = (seed) => {
    const r = mulberry32(hashStr('crash' + seed) ^ Math.floor(R() * 1e9));
    const y = filt(filt(noise(n, r), 'hp', 3200, 0.7), 'lp', 13000, 0.7);
    const parts = Array.from({ length: 9 }, () => [400 + r() * 5200, r() * TAU, 0.4 + r() * 0.6]);
    for (let i = 0; i < n; i++) {
      const t = i / SR; let m = 0;
      for (const [f, p, a] of parts) m += a * Math.sin(TAU * f * t + p);
      const env = (t < 0.002 ? t / 0.002 : 1) * (0.6 * Math.exp(-t / 0.35) + 0.4 * Math.exp(-t / 1.1));
      y[i] = (y[i] * 0.9 + m * 0.035) * env;
    }
    return y;
  };
  const [L, Rr] = norm2(mk('L'), mk('R'));
  return [fadeEdges(L, 0.001, 0.2), fadeEdges(Rr, 0.001, 0.2)];
}
/* reversed cymbal swell that peaks exactly at its end */
function reverseCrash(R, dur) {
  const [L, Rr] = crash(R, dur + 0.05);
  const n = secs(dur), oL = new Float32Array(n), oR = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n, e = Math.pow(u, 1.6); oL[i] = L[n - 1 - i] * e; oR[i] = Rr[n - 1 - i] * e; }
  return fade2(norm2(oL, oR), 0.005, 0.003);
}
function crackle(R, dur, rateFn, ampFn, fLo = 1500, fHi = 6000) {
  const n = secs(dur), y = new Float32Array(n);
  let t = 0;
  while (t < dur) {
    const rate = Math.max(1, rateFn(t));
    t += -Math.log(1 - R() * 0.999) / rate;
    if (t >= dur) break;
    const a = ampFn(t) * Math.pow(R(), 1.6);
    const g = burst(R, 0.004, 'bp', fLo + R() * (fHi - fLo), 1.4, 0.0005 + R() * 0.0012);
    addInto(y, g, secs(t), a);
  }
  return y;
}

/* distant city hum: brown rumble + traffic murmur, slow swells (stereo, decorrelated) */
function sparrow(R) {
  const n = secs(0.7), y = new Float32Array(n);
  const count = 2 + Math.floor(R() * 4);
  let t = 0;
  for (let k = 0; k < count; k++) {
    const len = 0.03 + R() * 0.05, m = secs(len), f0 = 3600 + R() * 2200, f1 = f0 * (0.55 + R() * 0.3), trill = 30 + R() * 40;
    const g = new Float32Array(m); let ph = 0;
    for (let i = 0; i < m; i++) {
      const u = i / m, f = expi(f0, f1, u) * (1 + 0.04 * Math.sin(TAU * trill * i / SR));
      ph += f / SR;
      g[i] = (Math.sin(TAU * ph) + 0.15 * Math.sin(2 * TAU * ph)) * Math.pow(Math.sin(Math.PI * u), 1.5);
    }
    addInto(y, g, secs(t), 0.6 + 0.4 * R());
    t += len + 0.025 + R() * 0.06;
    if (t > 0.6) break;
  }
  return fadeEdges(norm(y), 0.001, 0.01);
}

/* lens-flare shimmer: glassy pentatonic partials with tremolo + air (stereo) */
function shimmer(R, dur = 1.4) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const notes = [93, 96, 98, 101, 105, 108];
  notes.forEach((m, k) => {
    const f = m2f(m), ph = R() * TAU, tr = 5 + R() * 6, pan = (k / (notes.length - 1)) * 1.6 - 0.8;
    const a = (pan + 1) * Math.PI / 4, gl = Math.cos(a), gr = Math.sin(a), tk = 0.12 + k * 0.06;
    for (let i = 0; i < n; i++) {
      const t = i / SR, env = smooth((t - tk + 0.25) / 0.35) * Math.exp(-Math.max(0, t - tk - 0.1) / 0.35);
      const s = Math.sin(TAU * f * t + ph) * (0.7 + 0.3 * Math.sin(TAU * tr * t)) * env / (1 + k * 0.15);
      L[i] += s * gl; Rr[i] += s * gr;
    }
  });
  const aL = filt(noise(n, R), 'hp', 7000, 0.7), aR = filt(noise(n, R), 'hp', 7000, 0.7);
  for (let i = 0; i < n; i++) { const u = i / n, e = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 2) * 0.25; L[i] += aL[i] * e; Rr[i] += aR[i] * e; }
  return fade2(norm2(L, Rr), 0.02, 0.1);
}

/* motorbike pass-by with doppler, distance attenuation and air absorption — stereo.
 * dir +1 = L→R, -1 = R→L. tonal: clean harmonic engine pitched to a note (+fifth). */
function whoosh(R, dur, f0, fPeak, f1, peakAt = 0.55, Q = 1.2) {
  const n = secs(dur), x = noise(n, R);
  const fc = (t) => { const u = t / dur; return u < peakAt ? expi(f0, fPeak, u / peakAt) : expi(fPeak, f1, (u - peakAt) / (1 - peakAt)); };
  const a = filt(x, 'bp', fc, Q);
  const b = filt(x, 'lp', (t) => fc(t) * 0.5, 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const env = u < peakAt ? Math.pow(u / peakAt, 2) : Math.pow((1 - u) / (1 - peakAt), 1.6);
    y[i] = (a[i] * 1.0 + b[i] * 0.35) * env;
  }
  return fadeEdges(norm(y), 0.003, 0.008);
}

/* distant two-tone scooter horn beep */
function creak(R, dur, o = {}) {
  const n = secs(dur), x = new Float32Array(n);
  const rate = o.rate || ((u) => 70 + 160 * Math.sin(Math.PI * u));
  let t = 0;
  while (t < dur) { const u = t / dur, i = secs(t); if (i < n) x[i] += (0.6 + 0.4 * R()) * Math.pow(Math.sin(Math.PI * u), 0.6); t += (1 / rate(u)) * (0.85 + 0.3 * R()); }
  const y = new Float32Array(n);
  for (const [f, q, g] of (o.modes || [[620, 7, 1], [1450, 9, 0.7], [2900, 10, 0.4]])) addInto(y, filt(x, 'bp', f, q), 0, g);
  const nz = filt(noise(n, R), 'bp', o.scrapeF || 1800, 1.2);
  for (let i = 0; i < n; i++) y[i] += nz[i] * (o.scrape ?? 0.05) * Math.pow(Math.sin(Math.PI * i / n), 0.8);
  return fadeEdges(norm(y), 0.005, 0.02);
}

/* thud / plop: falling sine body + soft noise */
function plop(R, f0 = 230, f1 = 85, dur = 0.25, noiseAmt = 0.5) {
  const n = secs(dur), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-t / (dur * 0.22))) / SR;
    y[i] = Math.sin(TAU * ph) * (t < 0.002 ? t / 0.002 : 1) * Math.exp(-t / (dur * 0.3));
  }
  addInto(y, burst(R, dur * 0.5, 'lp', 1300, 0.8, dur * 0.12), 0, noiseAmt);
  addInto(y, burst(R, 0.02, 'hp', 2200, 0.7, 0.003), 0, 0.2);
  return fadeEdges(norm(y), 0.001, 0.02);
}

/* fine powder pouring hiss with grain sparkle */
function powderPour(R, dur) {
  const n = secs(dur), y = filt(noise(n, R), 'bp', 3600, 0.7), fl = flutter(R, n, 9);
  const gr = crackle(R, dur, () => 650, () => 0.35, 4000, 11000);
  for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / 0.12) * smooth((dur - t) / 0.25); y[i] = (y[i] * 0.35 * (0.6 + 0.4 * fl[i]) + gr[i]) * e; }
  return fadeEdges(norm(y), 0.01, 0.02);
}

/* steam hiss with flutter and swell (stereo) */
function steam(R, dur) {
  const n = secs(dur);
  const mk = () => { const x = filt(filt(noise(n, R), 'hp', 2500, 0.7), 'bp', 5600, 0.5), fl = flutter(R, n, 7); for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.4 + 0.6 * fl[i]) * smooth(t / 0.4) * smooth((dur - t) / 0.5); } return x; };
  return norm2(mk(), mk());
}

/* aluminum lid clink (thin plate modes) */
function clink(R, f = 1180) {
  const y = modal([[f, 0.3, 1], [f * 2.32, 0.2, 0.6], [f * 3.36, 0.14, 0.32], [f * 4.25, 0.1, 0.4], [f * 6.63, 0.05, 0.22]], 0.8);
  addInto(y, burst(R, 0.005, 'hp', 3000, 0.7, 0.0008), 0, 0.4);
  return fadeEdges(norm(y), 0.0002, 0.05);
}

/* glassy "ting" ping */
function ting(freq, dur = 0.5) {
  const n = secs(dur), y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const s = Math.sin(TAU * freq * t)
      + 0.35 * Math.sin(TAU * freq * 2.76 * t) * Math.exp(-t / (dur * 0.08))
      + 0.15 * Math.sin(TAU * freq * 5.4 * t) * Math.exp(-t / (dur * 0.04));
    y[i] = s * (t < 0.0008 ? t / 0.0008 : 1) * Math.exp(-t / (dur * 0.28));
  }
  return fadeEdges(norm(y), 0.0005, 0.02);
}

/* small quick drip (time-lapse patter) */
function smallDrip(R, f = 900) {
  const y = bubble(f, 0.05, 1.4, 0.22);
  addInto(y, burst(R, 0.006, 'bp', 3500, 1.2, 0.0012), 0, 0.4);
  return fadeEdges(norm(y), 0.0003, 0.01);
}
/* glass / object sliding on a wooden table: rough friction + woody body */
function slideWood(R, dur) {
  const n = secs(dur), x = new Float32Array(n);
  let t = 0;
  while (t < dur) { const i = secs(t); if (i < n) x[i] += 0.4 + 0.6 * R(); t += 1 / (140 + 90 * R()); }
  const nz = noise(n, R), y = new Float32Array(n);
  addInto(y, filt(x, 'bp', 360, 3), 0, 1);
  addInto(y, filt(x, 'bp', 1250, 4), 0, 0.5);
  addInto(y, filt(nz, 'bp', 1600, 0.8), 0, 0.22);
  addInto(y, filt(nz, 'lp', 600, 0.8), 0, 0.3);
  for (let i = 0; i < n; i++) { const tt = i / SR; y[i] *= smooth(tt / 0.06) * smooth((dur - tt) / 0.12) * (0.85 + 0.15 * Math.sin(TAU * 9 * tt)); }
  return fadeEdges(norm(y), 0.004, 0.02);
}

/* deep cinematic boom (sub drop + body + crack, saturated) */
function bigBoom(R, dur = 2.0, o = {}) {
  const n = secs(dur), y = new Float32Array(n);
  const fS = o.fStart ?? 92, fE = o.fEnd ?? 33, dec = o.decay ?? 0.6;
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (fE + (fS - fE) * Math.exp(-t / 0.12)) / SR; y[i] = Math.sin(TAU * ph) * smooth(t / 0.003) * Math.exp(-t / dec); }
  addInto(y, burst(R, 0.5, 'lp', 380, 0.7, 0.08, 0.002), 0, 0.6);
  addInto(y, burst(R, 0.08, 'bp', 1400, 0.8, 0.012), 0, o.crack ?? 0.25);
  for (let i = 0; i < n; i++) y[i] = Math.tanh(1.8 * y[i]);
  return fadeEdges(norm(y), 0.001, 0.15);
}

/* filtered-noise riser */
function riser(R, dur, f0 = 250, f1 = 7000) {
  const n = secs(dur), x = noise(n, R);
  const a = filt(x, 'bp', (t) => expi(f0, f1, t / dur), (t) => 1.5 + 2 * t / dur);
  const b = filt(x, 'hp', (t) => expi(f0 * 4, f1 * 1.5, t / dur), 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] = (a[i] + 0.3 * b[i]) * Math.pow(u, 2.2); }
  return fadeEdges(norm(y), 0.01, 0.006);
}

/* plastic stool scrape on concrete */
function stoolScrape(R, dur = 0.45) {
  const n = secs(dur), y = new Float32Array(n);
  addInto(y, creak(R, dur, { rate: (u) => 45 + 150 * Math.pow(Math.sin(Math.PI * u), 0.7), modes: [[480, 6, 1], [1150, 8, 0.7], [2400, 9, 0.35]], scrape: 0.25, scrapeF: 1100 }), 0, 1);
  const rough = flutter(R, n, 60), sc = filt(noise(n, R), 'bp', 900, 1.5);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] += sc[i] * 0.35 * rough[i] * Math.pow(Math.sin(Math.PI * u), 0.6); }
  return fadeEdges(norm(y), 0.005, 0.02);
}

/* soft wet plop of seafood onto a plate */
function wetPlop(R, f0 = 240) {
  const n = secs(0.4), y = new Float32Array(n);
  addInto(y, plop(R, f0, 100, 0.16, 0.5), 0, 1);
  const sq = filt(noise(secs(0.09), R), 'bp', (t) => expi(800, 1600, t / 0.09), 2.0);
  for (let i = 0; i < sq.length; i++) { const t = i / SR; sq[i] *= smooth(t / 0.005) * Math.exp(-t / 0.03); }
  addInto(y, norm(sq), secs(0.003), 0.4);
  addInto(y, modal([[1900, 0.05, 1], [3700, 0.03, 0.4]], 0.15), secs(0.004), 0.08);
  return fadeEdges(norm(y), 0.0008, 0.03);
}

/* leafy rustle of herbs and flowers (stereo) */
function rustle(R, dur) {
  const n = secs(dur), env = (t) => smooth(t / 0.1) * smooth((dur - t) / 0.2) * (0.6 + 0.4 * Math.sin(TAU * 0.9 * t + 1) ** 2);
  const mk = () => {
    const c = norm(crackle(R, dur, (t) => 200 + 260 * env(t), env, 2500, 9500));
    const b = filt(noise(n, R), 'bp', 5200, 0.7), fl = flutter(R, n, 18);
    for (let i = 0; i < n; i++) c[i] = c[i] * 0.8 + b[i] * 0.5 * fl[i] * env(i / SR);
    return c;
  };
  return fade2(norm2(mk(), mk()), 0.01, 0.05);
}

/* ceramic bowl tap (optionally with a soft food-placement thud) */
function ceramic(R, f = 1650, thud = 0) {
  const y = modal([[f, 0.22, 1], [f * 2.71, 0.11, 0.5], [f * 5.02, 0.05, 0.3], [f * 0.56, 0.06, 0.2]], 0.7);
  addInto(y, burst(R, 0.006, 'hp', 2500, 0.7, 0.0008), 0, 0.4);
  if (thud) addInto(y, plop(R, 200, 90, 0.14, 0.5), 0, thud);
  return fadeEdges(norm(y), 0.0002, 0.05);
}

/* lime squeeze: juicy squelch, rind squeak, juice drips */
function squeeze(R, dur = 0.32) {
  const n = secs(dur + 0.45), x = noise(n, R), y = new Float32Array(n);
  const sq = filt(x, 'bp', (t) => 900 + 700 * Math.sin(TAU * 9 * t), 2.2), fl = flutter(R, n, 45);
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / dur; if (u < 1) y[i] = sq[i] * fl[i] * Math.pow(Math.sin(Math.PI * u), 0.7); }
  norm(y);
  addInto(y, creak(R, 0.18, { rate: (u) => 180 + 200 * u, modes: [[1700, 10, 1], [3300, 12, 0.5]], scrape: 0.02 }), 0, 0.22);
  for (let k = 0; k < 5; k++) addInto(y, smallDrip(R, 1200 + R() * 800), secs(dur * 0.4 + k * 0.07 + R() * 0.04), 0.3);
  return fadeEdges(norm(y), 0.002, 0.02);
}

/* comic smell wave: swirling wobbly filtered-noise sweep with a faint tonal "woo" (stereo) */
function glug(R, dur = 0.7) {
  const n = secs(dur + 0.25), L = new Float32Array(n), Rr = new Float32Array(n);
  const st = filt(noise(n, R), 'bp', (t) => 300 + 120 * Math.sin(TAU * 7 * t), 2.5);
  const env = (t) => smooth(t / 0.05) * smooth((dur - t) / 0.1);
  for (let i = 0; i < n; i++) { const t = i / SR, v = st[i] * env(t) * 0.5 * (0.6 + 0.4 * Math.abs(Math.sin(TAU * 3.5 * t))); L[i] += v; Rr[i] += v; }
  norm2(L, Rr);
  let t = 0.02;
  while (t < dur - 0.05) { addPan(L, Rr, filt(bubble(110 + R() * 120, 0.07 + R() * 0.05, 0.7, 0.45), 'lp', 1200, 0.7), secs(t), 0.7 + 0.3 * R(), (R() - 0.5) * 0.4); t += 0.1 + R() * 0.06; }
  addPan(L, Rr, plop(R, 200, 80, 0.2, 0.5), secs(dur - 0.02), 0.6, 0);
  return fade2(norm2(L, Rr), 0.005, 0.03);
}
/* lime squeeze with a juicy squirt jet */
function limeSquirt(R) {
  const n = secs(0.8), y = new Float32Array(n);
  addInto(y, squeeze(R, 0.28), 0, 0.8);
  const j = filt(noise(secs(0.18), R), 'bp', (t) => expi(2800, 4800, t / 0.18), 2.5);
  for (let i = 0; i < j.length; i++) { const t = i / SR; j[i] *= smooth(t / 0.008) * Math.exp(-t / 0.06); }
  addInto(y, norm(j), secs(0.06), 0.55);
  return fadeEdges(norm(y), 0.002, 0.02);
}
/* chopsticks clacking inside a ceramic bowl (whisking the shrimp paste) */
function placeSoft(R, k = 0) {
  const n = secs(0.4), y = new Float32Array(n);
  addInto(y, plop(R, 190 + 30 * k, 85, 0.14, 0.45), 0, 0.8);
  addInto(y, norm(crackle(R, 0.08, (t) => 900 * Math.exp(-t / 0.03), (t) => Math.exp(-t / 0.04), 2500, 8000)), secs(0.002), 0.35);
  addInto(y, modal([[520, 0.03, 1], [1240, 0.015, 0.4]], 0.12), 0, 0.2);
  return fadeEdges(norm(y), 0.001, 0.03);
}
/* big wet SPLAT (shrimp paste explodes on his face): thump, slap, squelch, droplet spray (stereo) */
function inhale(R, dur = 0.42) {
  const n = secs(dur), x = noise(n, R);
  const f1 = filt(x, 'bp', (t) => expi(800, 1150, t / dur), 2.2), f2 = filt(x, 'bp', (t) => expi(1700, 2300, t / dur), 3), air = filt(x, 'hp', 3000, 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] = (f1[i] + 0.6 * f2[i] + 0.3 * air[i]) * Math.pow(u, 1.4) * smooth((1 - u) / 0.06); }
  return fadeEdges(norm(y), 0.005, 0.005);
}
/* the huge crispy "RỘP": several crust breaks in quick succession + crunch body + low thump (stereo) */
function fireBed(R, dur, popRate) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const mkR = () => { const x = noise(n, R); let b = 0; for (let i = 0; i < n; i++) { b = b * 0.995 + x[i] * 0.1; x[i] = b; } return filt(x, 'lp', 260, 0.7); };
  const rl = norm(mkR()), rr = norm(mkR());
  const hiss = norm(filt(noise(n, R), 'bp', 2800, 0.6));
  for (let i = 0; i < n; i++) {
    const t = i / SR, fl = 0.7 + 0.3 * Math.sin(TAU * 0.9 * t) * Math.sin(TAU * 0.37 * t + 1);
    L[i] += rl[i] * 0.5 * fl + hiss[i] * 0.04; Rr[i] += rr[i] * 0.5 * fl + hiss[i] * 0.04;
  }
  let t = 0;
  while (true) {
    t += -Math.log(1 - R() * 0.999) / popRate; if (t >= dur - 0.02) break;
    const a = 0.25 + Math.pow(R(), 3) * 1.2;
    const g = burst(R, 0.01, 'bp', 1200 + R() * 4000, 1.1, 0.0006 + R() * 0.002);
    addPan(L, Rr, g, secs(t), a, (R() - 0.5) * 1.4);
  }
  norm2(L, Rr);
  for (let i = 0; i < n; i++) { const t2 = i / SR, e = smooth(t2 / 0.3) * smooth((dur - t2) / 0.3); L[i] *= e; Rr[i] *= e; }
  return [L, Rr];
}
/* butter sizzle: hissing fry + fat micro-pops (stereo) */
function sizzle(R, dur) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const szL = filt(noise(n, R), 'hp', 4200, 0.7), szR = filt(noise(n, R), 'hp', 4200, 0.7);
  const fl = flutter(R, n, 14);
  const crL = crackle(R, dur, () => 110, () => 1, 2500, 9000), crR = crackle(R, dur, () => 110, () => 1, 2500, 9000);
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = smooth(t / 0.12) * smooth((dur - t) / 0.3), f = 0.55 + 0.45 * fl[i];
    L[i] = (szL[i] * 0.22 * f + crL[i] * 0.55) * e; Rr[i] = (szR[i] * 0.22 * f + crR[i] * 0.55) * e;
  }
  return norm2(L, Rr);
}
/* beans tossed in an iron wok: swish + dense bean clatter + soft wok ring (stereo) */
function waterPour(R, dur, o = {}) {
  const f0 = o.f0 ?? 900, f1 = o.f1 ?? 2200, thick = o.thick ?? 0, total = dur + 0.35;
  const n = secs(total), L = new Float32Array(n), Rr = new Float32Array(n);
  const env = (t) => smooth(t / 0.05) * smooth((dur - t) / 0.12);
  const x = noise(n, R);
  const res = filt(x, 'bp', (t) => expi(f0, f1, t / dur), 4.5);
  const splL = filt(noise(n, R), 'lp', 5200, 0.7), splR = filt(noise(n, R), 'lp', 5200, 0.7);
  const fl = flutter(R, n, 28);
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = env(t), f = 0.45 + 0.55 * fl[i];
    const c = res[i] * 1.0 * e;
    L[i] += c * 0.75 + splL[i] * 0.22 * e * f; Rr[i] += c * 0.75 + splR[i] * 0.22 * e * f;
  }
  if (o.metal) { const m = filt(filt(noise(n, R), 'bp', 3300, 16), 'bp', 3300, 4); for (let i = 0; i < n; i++) { const e = env(i / SR) * 0.6; L[i] += m[i] * e; Rr[i] += m[i] * e; } }
  let t = 0.02;
  const bLo = thick ? 260 : 480, bHi = thick ? 900 : 1600;
  while (t < dur - 0.03) {
    addPan(L, Rr, bubble(bLo + R() * (bHi - bLo) * (0.6 + 0.4 * t / dur), 0.015 + R() * 0.03, 0.9, 0.3), secs(t), (0.25 + 0.35 * R()) * env(t), (R() - 0.5) * 0.9);
    t += -Math.log(1 - R() * 0.99) / 48;
  }
  [[dur + 0.06, 1400], [dur + 0.2, 1700]].forEach(([tt, f], k) => addPan(L, Rr, bubble(f, 0.05, 1.3, 0.25), secs(tt), 0.25 - k * 0.08, 0.1));
  return fade2(norm2(L, Rr), 0.005, 0.02);
}
/* slow metal-on-metal scrape (phin press screwed down) */
function iceCrack(R, dur, rateFn) {
  const n = secs(dur + 0.1), L = new Float32Array(n), Rr = new Float32Array(n);
  let t = 0.002;
  while (t < dur) {
    const a = Math.pow(R(), 1.3), p = (R() - 0.5) * 1.3, x = R();
    if (x < 0.66) addPan(L, Rr, burst(R, 0.005, 'bp', 2500 + R() * 6500, 1.5, 0.0003 + R() * 0.0012), secs(t), a, p);
    else if (x < 0.9) addPan(L, Rr, modal([[2400 + R() * 3200, 0.008 + R() * 0.02, 1]], 0.06), secs(t), a * 0.45, p);
    else { addPan(L, Rr, burst(R, 0.02, 'lp', 2000, 0.7, 0.004), secs(t), a * 0.9, p); addPan(L, Rr, burst(R, 0.02, 'bp', 1200, 1.5, 0.003), secs(t), a * 0.5, p); }
    t += -Math.log(1 - R() * 0.99) / Math.max(5, rateFn(t));
  }
  return fade2(norm2(L, Rr), 0.002, 0.02);
}
/* spoon stirring clink against glass + ice */
function stirClink(R, f) {
  const n = secs(0.6), y = new Float32Array(n);
  addInto(y, ting(f, 0.55), 0, 0.8);
  addInto(y, modal([[f * 1.83, 0.05, 1], [f * 3.1, 0.025, 0.5]], 0.15), 0, 0.25);
  for (let k = 0; k < 7; k++) addInto(y, burst(R, 0.005, 'bp', 2500 + R() * 5000, 1.5, 0.0006), secs(0.01 + R() * 0.12), 0.35 * R());
  return fadeEdges(norm(y), 0.0003, 0.03);
}
/* the first sip: air + liquid turbulence + small bubbles + tiny gulp */
function slurp(R, dur = 0.4) {
  const n = secs(dur + 0.12), x = noise(n, R), fl = flutter(R, n, 38);
  const air = filt(x, 'bp', (t) => expi(1300, 2600, t / dur), 2.5);
  const wet = filt(x, 'bp', (t) => 700 + 300 * Math.sin(TAU * 6 * t), 4);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur, e = smooth(u / 0.15) * smooth((1 - u) / 0.25);
    y[i] = (air[i] * 0.7 * (0.35 + 0.65 * fl[i]) + wet[i] * 0.8 * fl[i]) * e;
  }
  for (let k = 0; k < 9; k++) addInto(y, bubble(500 + R() * 800, 0.02 + R() * 0.02, 0.8, 0.3), secs(0.04 + R() * (dur - 0.1)), 0.18 * R());
  addInto(y, plop(R, 260, 150, 0.1, 0.1), secs(dur + 0.005), 0.3);
  return fadeEdges(norm(filt(y, 'lp', 6000, 0.7)), 0.005, 0.02);
}
/* heartbeat lub-dub (saturated so it reads on phone speakers) */
function kettleSimmer(R, dur) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const mkR = () => { const x = noise(n, R); let b = 0; for (let i = 0; i < n; i++) { b = b * 0.996 + x[i] * 0.08; x[i] = b; } return norm(filt(x, 'lp', 240, 0.7)); };
  const rl = mkR(), rr = mkR();
  const hl = norm(filt(noise(n, R), 'bp', 4200, 0.8)), hr = norm(filt(noise(n, R), 'bp', 4000, 0.8));
  for (let i = 0; i < n; i++) { const t = i / SR, fl = 0.8 + 0.2 * Math.sin(TAU * 0.7 * t); L[i] = rl[i] * 0.45 * fl + hl[i] * 0.05; Rr[i] = rr[i] * 0.45 * fl + hr[i] * 0.05; }
  let t = 0.02;
  while (t < dur - 0.08) {
    addPan(L, Rr, bubble(160 + R() * 330, 0.02 + R() * 0.04, 0.8, 0.35), secs(t), 0.25 + 0.4 * R(), (R() - 0.5) * 0.8);
    t += -Math.log(1 - R() * 0.99) / 16;
  }
  norm2(L, Rr);
  for (let i = 0; i < n; i++) { const t2 = i / SR, e = smooth(t2 / 0.4) * smooth((dur - t2) / 0.4); L[i] *= e; Rr[i] *= e; }
  return [L, Rr];
}

// ───────────── 4c. New for the 90 s films: song lang, erhu, cartoon voices, fire, kitchen, CTA ─────────────

/* song lang: southern foot clapper (wooden disc + bead) — round woody "cốc"; acc = double strike */
function heartPop(R) {
  const n = secs(0.25), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += expi(380, 1250, t / 0.05) / SR; y[i] = Math.sin(TAU * ph) * smooth(t / 0.002) * Math.exp(-t / 0.045); }
  addInto(y, burst(R, 0.01, 'bp', 2500, 1, 0.0015), 0, 0.5);
  return fadeEdges(norm(y), 0.0003, 0.03);
}
/* bright two-note "ding" (+1) */
function dingUp() {
  const y = new Float32Array(secs(0.9));
  addInto(y, ting(m2f(91), 0.7), 0, 0.8);
  addInto(y, ting(m2f(96), 0.8), secs(0.07), 1);
  return fadeEdges(norm(y), 0.0005, 0.05);
}
/* UI button click (press + release) */
function uiClick(R) {
  const n = secs(0.12), y = new Float32Array(n);
  addInto(y, burst(R, 0.006, 'hp', 2800, 0.7, 0.0009), 0, 1);
  addInto(y, modal([[4300, 0.01, 0.6], [2100, 0.012, 0.5], [900, 0.01, 0.3]], 0.04), 0, 0.8);
  addInto(y, burst(R, 0.005, 'hp', 3500, 0.7, 0.0007), secs(0.055), 0.45);
  return fadeEdges(norm(y), 0.0002, 0.02);
}
/* small party-popper + paper confetti flutter (stereo) */
function confetti(R, dur = 1.6) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const pop = burst(R, 0.06, 'lp', 2400, 0.8, 0.012);
  addPan(L, Rr, pop, 0, 0.9, 0);
  addPan(L, Rr, burst(R, 0.03, 'bp', 1500, 1.2, 0.006), 0, 0.5, 0);
  let t = 0.02;
  while (t < dur - 0.02) {
    const a = Math.exp(-t / (dur * 0.45)) * (0.3 + 0.7 * R());
    addPan(L, Rr, burst(R, 0.008, 'bp', 2500 + R() * 6000, 1.4, 0.0006 + R() * 0.0015), secs(t), a * 0.6, (R() - 0.5) * 1.6);
    t += -Math.log(1 - R() * 0.99) / (40 + 260 * Math.exp(-t / 0.35));
  }
  return fade2(norm2(L, Rr), 0.0005, 0.05);
}

// ───────────────────────────── 3. Instruments (new for this film) ─────────────────────────────
const TAB_SAWP = makeTable(Array.from({ length: 24 }, (_, h) => 1 / (h + 1)));
const TAB_REEDB = makeTable(Array.from({ length: 20 }, (_, h) => (1 / Math.pow(h + 1, 0.8)) * (h === 0 ? 0.5 : h % 2 ? 1 : 0.7)));
const TAB_RASP = makeTable(Array.from({ length: 14 }, (_, h) => (1 / Math.pow(h + 1, 0.7)) * (h > 2 && h < 9 ? 1.5 : 1)));

/* đàn bầu: monochord played on natural harmonics -> an almost pure, flute-like fundamental with a few
 * quickly fading partials; the pitch follows keys [[t, semis]] (scoop, bend after the attack, release,
 * slide, glide down) plus a deep delayed vibrato; resonant gourd/box body + soft saturation. */
function danBau(midi, dur, o = {}) {
  const R = rngFor('db' + midi + '_' + dur.toFixed(3) + (o.seed || ''));
  const tail = o.tail ?? 0.45, n = secs(dur + tail), y = new Float32Array(n);
  const keys = o.keys || [[0, 0]], vib = o.vib ?? 0.28, vr = o.vibRate ?? 4.6, vd = o.vibDelay ?? 0.3;
  const f0 = m2f(midi), H = [[1, 1, 2.6], [2, 0.3, 0.8], [3, 0.12, 0.45], [4, 0.05, 0.28], [5, 0.022, 0.18]];
  let ph = 0; const vph = R() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const ve = smooth((t - vd) / 0.45) * (1 + 0.25 * Math.sin(TAU * 0.7 * t));
    const semis = pw(keys, t) + vib * ve * Math.sin(TAU * vr * t + vph);
    ph += f0 * Math.pow(2, semis / 12) / SR; if (ph >= 1) ph -= 1;
    let s = 0;
    for (const [h, a, d] of H) s += a * Math.exp(-t / d) * Math.sin(TAU * h * ph);
    const env = smooth(t / 0.004) * (0.7 + 0.3 * Math.exp(-t / 0.35)) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.09));
    y[i] = s * env;
  }
  addInto(y, burst(R, 0.012, 'bp', 2600, 1.2, 0.003), 0, 0.16);   // the stick pluck
  let z = filt(filt(y, 'peak', 230, 1.2, 4), 'peak', 1100, 2, 3);
  for (let i = 0; i < n; i++) z[i] = Math.tanh(1.3 * z[i]);
  return fadeEdges(norm(z), 0.0008, 0.03);
}
/* gesture string -> pitch keys:  s scoop · b-3 bend up from 3 semis below · r bend 2 up and release
 * u3 bend up 3 after the attack and stay · v deep vibrato · n little vibrato · gd glide down at the end
 * t2 / t-3 slide into the next note at the end */
function gest(gs, dur) {
  let keys = [[0, 0]], vib = 0.28, end = null, endK = 0;
  for (const g of (gs || '').split(',').filter(Boolean)) {
    if (g === 's') keys = [[0, -1.6], [0.1, 0]];
    else if (g === 'r') { const a = Math.min(0.45, dur * 0.35); keys = [[0, 0], [0.12, 0], [0.12 + a * 0.6, 2], [0.12 + a * 1.3, 2], [0.12 + a * 2.1, 0]]; }
    else if (g === 'v') vib = 0.5;
    else if (g === 'n') vib = 0.12;
    else if (g === 'gd') { end = 'gd'; endK = -7; }
    else if (g[0] === 'b') { const k = +g.slice(1); keys = [[0, k], [0.12, k], [0.34, 0]]; }
    else if (g[0] === 'u') { const k = +g.slice(1); keys = [[0, 0], [0.14, 0], [0.4, k]]; }
    else if (g[0] === 't') { end = 't'; endK = +g.slice(1); }
  }
  if (end) {
    const last = keys[keys.length - 1], v = last[1];
    if (end === 'gd') keys = [...keys, [Math.max(last[0] + 0.05, dur - 0.55), v], [dur + 0.35, v + endK]];
    else keys = [...keys, [Math.max(last[0] + 0.02, dur - 0.11), v], [dur + 0.01, v + endK], [dur + 1, v + endK]];
  }
  return { keys, vib };
}

/* Rhodes (FM tine piano): ratio-1 modulator whose index falls 1.8 -> 0.3, ratio-14 tine "ding",
 * slight bark on the 3rd partial, register-dependent decay */
const RH_CACHE = new Map();
function rhodesNote(midi, dur) {
  const key = midi + ':' + dur.toFixed(3); if (RH_CACHE.has(key)) return RH_CACHE.get(key);
  const f = m2f(midi), n = secs(dur + 0.45), y = new Float32Array(n);
  const dec = clamp(2.4 * Math.pow(220 / f, 0.5), 0.8, 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR, idx = 1.5 * Math.exp(-t / 0.28) + 0.3, mod = Math.sin(TAU * f * t);
    const car = Math.sin(TAU * f * t + idx * mod);
    const tine = 0.16 * Math.sin(TAU * f * 14.1 * t) * Math.exp(-t / 0.014) + 0.07 * Math.sin(TAU * f * 3 * t + 0.4 * mod) * Math.exp(-t / 0.15);
    const env = smooth(t / 0.0025) * Math.exp(-t / dec) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.13));
    y[i] = Math.tanh(1.2 * (car * 0.85 + tine) * env);
  }
  const out = fadeEdges(norm(y), 0.0005, 0.06); RH_CACHE.set(key, out); return out;
}
/* round sub bass: sine + a little 2nd harmonic, soft clip, low-passed */
const BS_CACHE = new Map();
function subBass(midi, dur) {
  const key = midi + ':' + dur.toFixed(3); if (BS_CACHE.has(key)) return BS_CACHE.get(key);
  const f = m2f(midi), n = secs(dur + 0.08), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += f / SR; if (ph >= 1) ph -= 1;
    const env = smooth(t / 0.007) * (0.82 + 0.18 * Math.exp(-t / 0.35)) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.03));
    y[i] = Math.tanh(1.4 * (Math.sin(TAU * ph) + 0.25 * Math.sin(2 * TAU * ph + 0.3)) * env);
  }
  const out = fadeEdges(norm(filt(y, 'lp', 650, 0.7)), 0.001, 0.02); BS_CACHE.set(key, out); return out;
}
/* misty pad: 2 detuned band-limited saws per voice per side, slow drifting low-pass, long attack */
function mistPad(midis, dur, o = {}) {
  const R = rngFor('pad' + (o.seed || '') + dur.toFixed(2));
  const att = o.attack ?? 2.0, rel = o.release ?? 1.6, n = secs(dur + rel);
  const mk = (side) => {
    const y = new Float32Array(n);
    const osc = []; for (const m of midis) for (let k = 0; k < 2; k++) osc.push({ f: m2f(m) * Math.pow(2, ((k ? 1 : -1) * (4 + R() * 6) + (side ? 2 : -2)) / 1200), ph: R() });
    for (let i = 0; i < n; i++) {
      const t = i / SR; let s = 0;
      for (const q of osc) { q.ph += q.f / SR; if (q.ph >= 1) q.ph -= 1; s += tabRead(TAB_SAWP, q.ph); }
      const e = smooth(t / att) * (t < dur ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / rel, 0, 1)));
      y[i] = s * e;
    }
    const cut = o.cut ?? 950, p0 = R() * TAU;
    return filt(y, 'lp', (t) => cut * (1 + 0.35 * Math.sin(TAU * 0.11 * t + p0)), 0.9);
  };
  return fade2(norm2(mk(0), mk(1)), 0.01, 0.05);
}
/* drums: dusty kick, snare with short room, rimshot, swung hats, open hat, shaker */
function kickD(o = {}) {
  const R = rngFor('kick' + (o.seed || '')), n = secs(0.5), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += ((o.fEnd ?? 47) + (o.fTop ?? 70) * Math.exp(-t / 0.032)) / SR; y[i] = Math.sin(TAU * ph) * smooth(t / 0.0015) * Math.exp(-t / (o.decay ?? 0.24)); }
  addInto(y, burst(R, 0.012, 'lp', 2500, 0.7, 0.003), 0, 0.14);
  for (let i = 0; i < n; i++) y[i] = Math.tanh(2 * y[i]);
  return fadeEdges(norm(filt(y, 'lp', 3800, 0.7)), 0.0003, 0.05);
}
function snareD(seed) {
  const R = rngFor('sn' + seed), n = secs(0.42), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = (0.6 * Math.sin(TAU * 185 * t) * Math.exp(-t / 0.07) + 0.35 * Math.sin(TAU * 330 * t) * Math.exp(-t / 0.05)) * smooth(t / 0.001); }
  addInto(y, burst(R, 0.4, 'bp', 2200, 0.55, 0.11, 0.001), 0, 1.6);
  addInto(y, burst(R, 0.08, 'hp', 5000, 0.7, 0.025), 0, 0.5);
  for (let i = 0; i < n; i++) y[i] = Math.tanh(1.5 * y[i]);
  return fadeEdges(norm(filt(y, 'lp', 7000, 0.7)), 0.0003, 0.05);
}
function rimD(R) {
  const y = modal([[1750, 0.025, 1], [520, 0.04, 0.55], [3200, 0.012, 0.45]], 0.14);
  addInto(y, burst(R, 0.005, 'hp', 2500, 0.7, 0.0008), 0, 0.5);
  return fadeEdges(norm(filt(y, 'lp', 8000, 0.7)), 0.0002, 0.02);
}
function hatD(R, decay) {
  const n = secs(Math.max(0.06, decay * 5)), x = noise(n, R);
  const a = filt(x, 'hp', 7000, 0.7), b = filt(x, 'bp', 10500, 1.5), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] = (a[i] * 0.7 + b[i] * 0.6) * (t < 0.0008 ? t / 0.0008 : Math.exp(-(t - 0.0008) / decay)); }
  return fadeEdges(norm(filt(y, 'lp', 11000, 0.7)), 0.0002, 0.01);
}
function shakerD(R) {
  const n = secs(0.12), y = filt(noise(n, R), 'bp', 5500, 0.9);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] *= smooth(t / 0.012) * Math.exp(-t / 0.045); }
  return fadeEdges(norm(y), 0.0005, 0.01);
}
function clapD(R) {
  const y = new Float32Array(secs(0.3));
  [0, 0.009, 0.018].forEach((d, k) => addInto(y, burst(R, 0.02, 'bp', 1400, 1.0, 0.004), secs(d), 0.7 + 0.15 * k));
  addInto(y, burst(R, 0.25, 'bp', 1300, 0.8, 0.07), secs(0.022), 0.6);
  return fadeEdges(norm(y), 0.0003, 0.03);
}
/* music box / celesta tine */
function mbox(R, midi, dur = 1.6) {
  const f = m2f(midi);
  const y = modal([[f, 1.2, 1], [f * 2.0, 0.4, 0.22], [f * 5.95, 0.12, 0.16], [f * 9.8, 0.05, 0.07]], dur, 0.0006);
  addInto(y, burst(R, 0.004, 'hp', 4000, 0.7, 0.0006), 0, 0.15);
  return fadeEdges(norm(y), 0.0003, 0.05);
}
/* comic low bassoon "hmm?" (two syllables, the second questioning upwards) */
function hmmVoice(R) {
  const dur = 0.85, n = secs(dur), y = new Float32Array(n); let ph = 0;
  const f0 = m2f(41);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const semis = t < 0.34 ? -0.4 * Math.exp(-t / 0.05) : 6 * smooth((t - 0.38) / 0.36);
    ph += f0 * Math.pow(2, (semis + 0.08 * Math.sin(TAU * 5.5 * t)) / 12) / SR; if (ph >= 1) ph -= 1;
    const s1 = t < 0.33 ? smooth(t / 0.04) * smooth((0.33 - t) / 0.06) : 0;
    const s2 = t > 0.35 ? smooth((t - 0.35) / 0.05) * smooth((dur - t) / 0.14) : 0;
    y[i] = tabRead(TAB_REEDB, ph) * Math.max(s1, s2 * 0.95);
  }
  let z = filt(filt(filt(y, 'peak', 380, 1.5, 8), 'peak', 1050, 2, 5), 'lp', 2400, 0.7);
  const br = filt(noise(n, R), 'bp', 1200, 1); for (let i = 0; i < n; i++) z[i] += br[i] * 0.03 * Math.abs(y[i]);
  return fadeEdges(norm(z), 0.003, 0.04);
}
/* bicycle bell: dome-bell modes (beating pair + inharmonic partials) + clapper click */
function bellStrike(R, f0, dur = 1.3) {
  const y = modal([[f0, 0.9, 1], [f0 + 3.5, 0.85, 0.6], [f0 * 1.506, 0.55, 0.5], [f0 * 2.03, 0.4, 0.33], [f0 * 2.74, 0.25, 0.24], [f0 * 3.6, 0.12, 0.14]], dur, 0.0003);
  addInto(y, burst(R, 0.004, 'hp', 4000, 0.7, 0.0007), 0, 0.3);
  return y;
}
function bikeBell(R, kind) {
  const y = new Float32Array(secs(2.0));
  if (kind === 'ring') {   // lever trill "ring ring"
    [0, 0.42].forEach((t0) => { for (let k = 0; k < 6; k++) addInto(y, bellStrike(R, 2450 * (1 + 0.006 * (R() - 0.5)), 1.2), secs(t0 + k * 0.055), (0.55 + 0.45 * R()) * (k === 0 ? 1 : 0.7)); });
  } else {                 // "kính coong": high then low strike
    addInto(y, bellStrike(R, 2700, 1.4), 0, 1);
    addInto(y, bellStrike(R, 2030, 1.6), secs(0.24), 0.9);
  }
  return fadeEdges(norm(y), 0.0003, 0.08);
}

// ───────────────────────────── 4. New foley ─────────────────────────────
function broom(R, dur = 0.34) {
  const n = secs(dur), env = (t) => Math.pow(Math.sin(Math.PI * clamp(t / dur, 0, 1)), 1.4);
  const a = filt(noise(n, R), 'bp', (t) => 1800 + 1600 * t / dur, 0.6), b = filt(noise(n, R), 'hp', 5000, 0.7), fl = flutter(R, n, 60);
  const c = norm(crackle(R, dur, (t) => 320 * env(t), env, 3000, 9000)), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const e = env(i / SR); y[i] = (a[i] * 0.7 + b[i] * 0.45 * fl[i]) * e * (0.6 + 0.4 * fl[i]) + c[i] * 0.35; }
  return fadeEdges(norm(filt(y, 'hp', 300, 0.7)), 0.005, 0.02);
}
function coldWind(R, dur) {
  const n = secs(dur);
  const mk = () => {
    const p = R() * TAU, x = noise(n, R);
    const a = filt(x, 'bp', (t) => 420 + 260 * Math.sin(TAU * 0.07 * t + p) + 120 * Math.sin(TAU * 0.23 * t), 0.9);
    const b = filt(filt(noise(n, R), 'lp', 700, 0.7), 'hp', 120, 0.7), g = flutter(R, n, 0.6), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] = (a[i] * 0.8 + b[i] * 0.5) * (0.3 + 0.7 * g[i]) * smooth(t / 1.0) * smooth((dur - t) / 1.0); }
    return y;
  };
  return norm2(mk(), mk());
}
function haaa(R, dur = 0.85) {
  const n = secs(dur), x = noise(n, R), sc = (t) => 1 - 0.06 * t / dur;
  const f1 = filt(x, 'bp', (t) => 700 * sc(t), 5), f2 = filt(x, 'bp', (t) => 1200 * sc(t), 6), f3 = filt(x, 'bp', (t) => 2600 * sc(t), 7), br = filt(x, 'hp', 1500, 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / 0.07) * Math.pow(1 - t / dur, 1.3); y[i] = (f1[i] + 0.6 * f2[i] + 0.3 * f3[i] + 0.12 * br[i]) * e; }
  return fadeEdges(norm(filt(y, 'hp', 200, 0.7)), 0.005, 0.04);
}
function potBed(R, dur) {
  const n = secs(dur), y = filt(noise(n, R), 'lp', 220, 0.7);
  for (let i = 0; i < n; i++) y[i] *= 0.5;
  let t = 0.05;
  while (t < dur - 0.2) { addInto(y, bubble(110 + R() * 260, 0.05 + R() * 0.08, 0.6 + R() * 0.6, 0.35), secs(t), 0.4 + 0.6 * R()); t += -Math.log(1 - R() * 0.99) / 9; }
  const z = norm(filt(y, 'lp', 1600, 0.7));
  for (let i = 0; i < n; i++) { const tt = i / SR; z[i] *= smooth(tt / 0.8) * smooth((dur - tt) / 0.8); }
  return z;
}
const AL_MODES = [[318, 0.35, 1], [747, 0.26, 0.7], [1290, 0.18, 0.55], [2210, 0.11, 0.35], [3070, 0.07, 0.25], [4480, 0.04, 0.15]];
function lidClank(R) {
  const y = new Float32Array(secs(1.7));
  addInto(y, modal(AL_MODES, 1.2), 0, 1);
  addInto(y, burst(R, 0.03, 'bp', 1800, 0.7, 0.006), 0, 0.7);
  addInto(y, burst(R, 0.06, 'lp', 300, 0.7, 0.015), 0, 0.6);
  let tt = 0.11, gap = 0.1, a = 0.5;   // the lid rocks on the rim, faster and quieter
  for (let k = 0; k < 9; k++) { addInto(y, modal(AL_MODES.map(([f, d, am]) => [f * (1 + 0.01 * (R() - 0.5)), d * 0.5, am]), 0.5), secs(tt), a); tt += gap; gap *= 0.78; a *= 0.8; }
  for (let i = 0; i < y.length; i++) y[i] = Math.tanh(1.2 * y[i]);
  return fadeEdges(norm(y), 0.0002, 0.1);
}
function spiceRattle(R, dur = 0.55) {
  const n = secs(dur), y = new Float32Array(n), env = (t) => smooth(t / 0.03) * Math.exp(-t / 0.16);
  let t = 0.002;
  while (t < dur - 0.01) { addInto(y, burst(R, 0.004, 'bp', 2500 + R() * 5500, 2, 0.0006 + R() * 0.0008), secs(t), env(t) * (0.4 + 0.6 * R())); t += -Math.log(1 - R() * 0.99) / (60 + 320 * env(t)); }
  const sc = filt(noise(n, R), 'bp', 1400, 1.2); for (let i = 0; i < n; i++) y[i] += sc[i] * 0.18 * env(i / SR);
  addInto(y, modal([[540, 0.08, 1], [1320, 0.05, 0.5], [2650, 0.03, 0.3]], 0.25), 0, 0.12);
  return fadeEdges(norm(filt(y, 'hp', 300, 0.7)), 0.001, 0.03);
}
function boneBop(R) {
  const n = secs(0.9), y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (50 + 48 * Math.exp(-t / 0.05)) / SR; y[i] = Math.sin(TAU * ph) * smooth(t / 0.002) * Math.exp(-t / 0.11); }
  addInto(y, plop(R, 220, 70, 0.3, 0.4), 0, 0.7);
  const sp = filt(noise(n, R), 'bp', 1300, 0.6); for (let i = 0; i < n; i++) { const t = i / SR - 0.01; if (t > 0) y[i] += sp[i] * 0.55 * smooth(t / 0.005) * Math.exp(-t / 0.12); }
  for (let k = 0; k < 10; k++) { const t = 0.08 + R() * 0.5; addInto(y, bubble(600 + R() * 1200, 0.03 + R() * 0.04, 1.0, 0.3), secs(t), 0.25 * Math.exp(-t / 0.4)); }
  for (let i = 0; i < n; i++) y[i] = Math.tanh(1.3 * y[i]);
  return fadeEdges(norm(filt(y, 'hp', 60, 0.7)), 0.0005, 0.05);
}
function skimSwish(R, dur = 0.8) {
  const n = secs(dur), a = filt(noise(n, R), 'bp', (t) => 500 + 1400 * Math.sin(Math.PI * clamp(t / dur, 0, 1)), 1.8), fl = flutter(R, n, 24), y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] = a[i] * Math.pow(Math.sin(Math.PI * u), 1.2) * (0.4 + 0.6 * fl[i]); }
  for (let k = 0; k < 6; k++) addInto(y, bubble(400 + R() * 600, 0.03 + R() * 0.03, 0.9, 0.3), secs(dur * (0.3 + 0.6 * R())), 0.25 * R());
  return fadeEdges(norm(filt(y, 'hp', 150, 0.7)), 0.01, 0.03);
}
function clockTick(R, hi) {
  const y = modal([[hi ? 3400 : 2800, 0.008, 1], [hi ? 5600 : 4700, 0.005, 0.5], [1200, 0.01, 0.3]], 0.05);
  addInto(y, burst(R, 0.003, 'hp', 3000, 0.7, 0.0005), 0, 0.4);
  return fadeEdges(norm(y), 0.0001, 0.01);
}
function crickets(R, dur, f = 4400) {
  const n = secs(dur), y = new Float32Array(n);
  let t = R() * 0.3;
  while (t < dur - 0.2) {
    for (let p = 0; p < 3; p++) { const s = secs(t + p * 0.042), m = secs(0.026); for (let i = 0; i < m && s + i < n; i++) { const u = i / m; y[s + i] += Math.sin(TAU * f * (i / SR)) * Math.sin(Math.PI * u) ** 2; } }
    t += 0.5 + R() * 0.15;
  }
  for (let i = 0; i < n; i++) { const tt = i / SR; y[i] *= smooth(tt / 0.4) * smooth((dur - tt) / 0.4); }
  return y;
}
function rooster(R) {
  const dur = 1.25, n = secs(dur), y = new Float32Array(n), jit = filt(noise(n, R), 'lp', 60, 0.7); let ph = 0;
  const FK = [[0, 520], [0.1, 760], [0.16, 700], [0.22, 640], [0.3, 820], [0.42, 800], [0.5, 900], [0.6, 1050], [0.95, 980], [1.15, 760], [1.25, 700]];
  const AK = [[0, 0], [0.02, 1], [0.13, 0.9], [0.15, 0.1], [0.18, 0.8], [0.26, 0.7], [0.285, 0.1], [0.31, 0.9], [0.45, 0.8], [0.48, 0.15], [0.52, 1], [1.0, 0.85], [1.2, 0.3], [1.25, 0]];
  for (let i = 0; i < n; i++) { const t = i / SR; ph += pw(FK, t) * (1 + 0.6 * jit[i]) / SR; if (ph >= 1) ph -= 1; y[i] = tabRead(TAB_RASP, ph) * pw(AK, t); }
  let z = filt(filt(filt(y, 'peak', 1400, 2, 6), 'hp', 400, 0.7), 'lp', 5000, 0.7);
  for (let i = 0; i < n; i++) z[i] = Math.tanh(2 * z[i]);
  return fadeEdges(norm(z), 0.002, 0.04);
}
function knifeShk(R) {
  const y = new Float32Array(secs(0.12));
  addInto(y, burst(R, 0.06, 'bp', 5200, 1.3, 0.012, 0.003), 0, 1);
  addInto(y, burst(R, 0.03, 'hp', 3000, 0.7, 0.008), 0, 0.6);
  addInto(y, modal([[4100, 0.03, 1], [6300, 0.02, 0.5]], 0.08), 0, 0.12);
  addInto(y, burst(R, 0.02, 'lp', 900, 0.7, 0.005), secs(0.004), 0.5);
  return fadeEdges(norm(y), 0.0005, 0.01);
}
function noodleFlop(R) {
  const y = new Float32Array(secs(0.4));
  addInto(y, burst(R, 0.08, 'lp', 1100, 0.8, 0.02, 0.002), 0, 1);
  addInto(y, burst(R, 0.06, 'bp', 600, 1.0, 0.015), secs(0.005), 0.6);
  for (let k = 0; k < 5; k++) addInto(y, bubble(500 + R() * 700, 0.025, 0.9, 0.3), secs(0.02 + R() * 0.2), 0.2 * R());
  return fadeEdges(norm(filt(y, 'hp', 90, 0.7)), 0.0005, 0.03);
}
function chiliFlakes(R, dur = 0.6) { return fadeEdges(norm(crackle(R, dur, (t) => 450 * Math.exp(-t / 0.25), (t) => Math.exp(-t / 0.3), 3000, 9000)), 0.002, 0.03); }
function chopstickClack(R) {
  const y = modal([[2950, 0.03, 1], [5300, 0.02, 0.5], [1450, 0.025, 0.4]], 0.1);
  addInto(y, ceramic(R, 2600, 0), 0, 0.3);
  return fadeEdges(norm(y), 0.0002, 0.02);
}
/* the huge "XỤỤỤP": noise + buzzy lip saw through a band-pass sweeping 600 Hz -> 3 kHz, wet bubbly AM,
 * bubbles, saturation and a lo-fi slapback (110 / 220 ms) */
function bigSlurp(R, dur = 1.3, o = {}) {
  const f0 = o.f0 ?? 600, f1 = o.f1 ?? 3000, n = secs(dur), src = new Float32Array(n), nz = noise(n, R), fl = flutter(R, n, 28);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur;
    ph += (110 * Math.pow(1.7, u) + 12 * Math.sin(TAU * 7 * t)) / SR; if (ph >= 1) ph -= 1;
    const wet = 0.5 + 0.5 * fl[i] * (0.5 + 0.5 * Math.sin(TAU * (18 + 10 * u) * t));
    const env = smooth(t / 0.05) * (u < 0.8 ? 1 : Math.pow(1 - (u - 0.8) / 0.2, 1.5)) * (0.8 + 0.2 * Math.sin(Math.PI * u));
    src[i] = (nz[i] * 0.8 + (2 * ph - 1) * (o.buzz ?? 0.45)) * wet * env;
  }
  const a = filt(src, 'bp', (t) => expi(f0, f1, smooth(t / dur * 1.1)), 3), b = filt(src, 'bp', (t) => expi(f0 * 1.7, f1 * 1.4, smooth(t / dur * 1.1)), 4);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) y[i] = a[i] + 0.5 * b[i];
  const nb = o.bubbles ?? 26;
  for (let k = 0; k < nb; k++) addInto(y, bubble(500 + R() * 1500, 0.02 + R() * 0.03, 1.0, 0.3), secs(R() * dur * 0.9), 0.12 * R());
  const pk = norm(y); for (let i = 0; i < n; i++) pk[i] = Math.tanh(1.6 * pk[i]);
  const tot = n + secs(0.5), out = new Float32Array(tot), echo = filt(pk, 'lp', 2500, 0.7);
  addInto(out, pk, 0, 1);
  if (o.echo !== false) { addInto(out, echo, secs(0.11), 0.42); addInto(out, echo, secs(0.22), 0.22); }
  return fadeEdges(norm(out), 0.003, 0.05);
}
/* swirling slurp-vortex whoosh (pair with a circular pan) */
function vortex(R, dur = 1.7) {
  const n = secs(dur), fq = (t) => expi(250, 4200, smooth(t / dur * 1.05));
  const a = filt(noise(n, R), 'bp', (t) => fq(t) * (1 + 0.35 * Math.sin(TAU * (3 + 5 * t / dur) * t)), 2.5), b = filt(noise(n, R), 'hp', (t) => fq(t) * 1.5, 0.7);
  const y = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; ph += fq(t) * 0.7 / SR;
    const env = smooth(t / 0.05) * (1 - smooth((t - dur * 0.55) / (dur * 0.45)));
    y[i] = (a[i] + 0.35 * b[i] + 0.15 * Math.sin(TAU * ph)) * env;
  }
  return fadeEdges(norm(y), 0.003, 0.05);
}
function keng(R, f = 1520) {
  const y = modal([[f, 0.55, 1], [f * 1.0071, 0.5, 0.6], [f * 2.38, 0.3, 0.5], [f * 3.96, 0.18, 0.3], [f * 5.8, 0.09, 0.2]], 1.0);
  addInto(y, burst(R, 0.003, 'hp', 3500, 0.7, 0.0006), 0, 0.5);
  return fadeEdges(norm(y), 0.0002, 0.06);
}
function vinylBed() {   // hiss + rumble + sparse pops/clicks, written straight into the VINYL bus
  const R = rngFor('vinyl');
  const hL = filt(filt(noise(N, R), 'hp', 3000, 0.7), 'lp', 9000, 0.7), hR = filt(filt(noise(N, R), 'hp', 3000, 0.7), 'lp', 9000, 0.7);
  const rum = filt(filt(noise(N, R), 'lp', 90, 0.7), 'hp', 30, 0.7);
  const nH = norm(hL), nR = norm(hR), nRum = norm(rum);
  const env = (t) => pw(VINYL_KEYS, t);
  for (let i = 0; i < N; i++) { const e = env(i / SR); VINYL.L[i] += (nH[i] * 0.06 + nRum[i] * 0.05) * e; VINYL.R[i] += (nR[i] * 0.06 + nRum[i] * 0.05) * e; }
  let t = 0.3;
  while (t < DUR - 0.5) {
    const big = R() < 0.1, a = (big ? 0.35 + 0.4 * R() : 0.06 + 0.12 * R()) * env(t);
    const c = burst(R, big ? 0.004 : 0.002, 'lp', big ? 4500 : 7000, 0.7, big ? 0.0008 : 0.0003);
    addPan(VINYL.L, VINYL.R, c, secs(t), a, (R() - 0.5) * 1.2);
    t += -Math.log(1 - R() * 0.99) / 5;
  }
}

// ───────────────────────────── 5. Buses ─────────────────────────────
// every bus: dry (L,R) + room send (sL,sR) + hall send (hL,hR)
const mkBus = () => ({ L: new Float32Array(N), R: new Float32Array(N), sL: new Float32Array(N), sR: new Float32Array(N), hL: new Float32Array(N), hR: new Float32Array(N) });
const MUSIC = mkBus(), SFX = mkBus(), LOWFX = mkBus(), AMB = mkBus(), VINYL = mkBus();   // SFX is high-passed at 80 Hz; LOWFX (booms) is not; AMB/VINYL do not key the duck
function put(bus, t0, sig, o = {}) {
  const gain = o.gain ?? 1, pan = o.pan ?? 0, right = o.right || null, toRoom = o.room ?? 0, toHall = o.hall ?? 0;
  const i0 = Math.round(t0 * SR), len = sig.length, edge = Math.min(16, len >> 2), panFn = typeof pan === 'function';
  let gl = 1, gr = 1;
  if (!right && !panFn) { const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4; gl = Math.cos(a); gr = Math.sin(a); }
  for (let k = 0; k < len; k++) {
    const i = i0 + k; if (i < 0) continue; if (i >= N) break;
    let g = gain; if (k < edge) g *= k / edge; else if (k > len - edge) g *= (len - k) / edge;
    let l, r;
    if (right) { l = sig[k] * g; r = right[k] * g; }
    else { if (panFn) { const a = (clamp(pan(k / SR), -1, 1) + 1) * Math.PI / 4; gl = Math.cos(a); gr = Math.sin(a); } l = sig[k] * g * gl; r = sig[k] * g * gr; }
    bus.L[i] += l; bus.R[i] += r;
    if (toRoom) { bus.sL[i] += l * toRoom; bus.sR[i] += r * toRoom; }
    if (toHall) { bus.hL[i] += l * toHall; bus.hR[i] += r * toHall; }
  }
}
const put2 = (bus, t0, [L, R], o = {}) => put(bus, t0, L, { ...o, right: R });
const AMB_KEYS = [[0, 0], [0.5, 1], [11.8, 1], [12.6, 0.4], [62.5, 0.4], [63.2, 1], [66.6, 1], [67.5, 0.4], [72.5, 0.35], [72.72, 0], [73.5, 0], [74, 0.25], [86.5, 0.3], [87.5, 0.5], [89.5, 0]];
const VINYL_KEYS = [[0, 0], [0.4, 1.3], [12, 1.3], [13, 0.8], [63, 0.8], [63.5, 1.1], [66.75, 1.1], [67.5, 0.8], [86.5, 0.8], [87.5, 1.3], [90, 1.3]];
const ambEnv = (t) => pw(AMB_KEYS, t);
function putAmb(t0, sig, o = {}) { const s = Float32Array.from(sig); mulEnv(s, (t) => ambEnv(t0 + t)); put(AMB, t0, s, o); }
function put2Amb(t0, [L, R], o = {}) { const a = Float32Array.from(L), b = Float32Array.from(R); mulEnv(a, (t) => ambEnv(t0 + t)); mulEnv(b, (t) => ambEnv(t0 + t)); put(AMB, t0, a, { ...o, right: b }); }
const sfx = (t, sig, o = {}) => put(SFX, t, sig, o);
const sfx2 = (t, sig, o = {}) => put2(SFX, t, sig, o);
const sfxLow = (t, sig, o = {}) => put(LOWFX, t, sig, o);

// ───────────────────────────── 6. Score ─────────────────────────────
console.time('render');
const modeAt = (tab, t) => { let m = tab[0][1]; for (const [t0, v] of tab) if (t >= t0 - 1e-6) m = v; return m; };
const nextChange = (tab, t) => { for (const [t0] of tab) if (t0 > t + 1e-6) return t0; return DUR; };

// (a) harmony: Em9 – Cmaj7 – Am9 – B7sus4→B7, one bar each
const VO = { Em9: [52, 55, 59, 62, 66], Cmaj7: [48, 55, 59, 64, 67], Am9: [45, 55, 59, 60, 64], B7sus4: [47, 52, 54, 57, 64], B7: [47, 51, 54, 57, 63] };
const ROOT = { Em9: 40, Cmaj7: 36, Am9: 33, B7sus4: 35, B7: 35 };
const CH = [[0, 'Em9'], [3, 'Cmaj7'], [6, 'Am9'], [9, 'B7sus4'], [10.5, 'B7']];
for (let b = 4; b <= 20; b++) { const nm = ['Em9', 'Cmaj7', 'Am9', 'B7sus4'][b % 4]; CH.push([3 * b, nm]); if (b % 4 === 3) CH.push([3 * b + 1.5, 'B7']); }
CH.push([63, 'Em9'], [66.75, 'Am9'], [69, 'B7sus4'], [71.25, 'B7'], [73.5, 'Em9'], [75, 'Cmaj7'], [78, 'Am9'], [81, 'Cmaj7'], [82.5, 'B7sus4'], [83.25, 'B7'], [84, 'Em9'], [85.5, 'Cmaj7'], [87, 'Em9']);
const SEG = CH.map((c, i) => ({ t0: c[0], t1: i + 1 < CH.length ? CH[i + 1][0] : DUR, nm: c[1] }));
const chordAt = (t) => modeAt(CH, t);

// (b) misty pad (whole film, follows the chords)
const PAD_G = [[0, 0.12], [11.5, 0.12], [12.5, 0.075], [44.5, 0.075], [45.3, 0.11], [47.8, 0.11], [48.5, 0.075], [62.5, 0.075], [63.3, 0.1], [66.5, 0.1], [67.5, 0.08], [73.5, 0.065], [83.5, 0.07], [84.5, 0.09], [90, 0.09]];
SEG.forEach((s, k) => {
  if (s.t0 >= 87.5) return;
  const len = Math.min(s.t1, 88.9) - s.t0, cut = s.t0 >= 45 && s.t0 < 48 ? 700 : s.t0 >= 63 && s.t0 < 66.75 ? 800 : 1000;
  const p = mistPad(VO[s.nm], len + 0.15, { attack: Math.min(2.0, Math.max(0.35, len * 0.55)), release: s.t0 >= 87 ? 2.0 : 1.5, cut, seed: 'p' + k });
  put2(MUSIC, s.t0, p, { gain: pw(PAD_G, s.t0 + 0.5), hall: 0.3 });
});

// (c) Rhodes comping (autopan tremolo)
function rh(t, nm, vel, dur, notes) {
  const ns = notes || VO[nm];
  ns.forEach((m, j) => {
    const s = rhodesNote(m, dur);
    const t1 = t + j * 0.012;
    put(MUSIC, t1, s, { gain: 0.075 * vel * (j === ns.length - 1 ? 1.15 : 1), pan: (u) => 0.35 * Math.sin(TAU * 2.67 * (t1 + u)), hall: 0.22, room: 0.05 });
  });
}
const RH_MODE = [[0, 'intro'], [12, 'comp'], [27, 'long'], [30.75, 'comp'], [45, 'long'], [48, 'comp'], [60, 'long'], [63, 'none'], [66.75, 'long'], [72.72, 'none'], [73.5, 'comp'], [81, 'long'], [84, 'cta'], [90, 'none']];
for (const s of SEG) {   // intro: one soft rolled chord per change
  if (s.t0 >= 12) break;
  rh(s.t0 === 0 ? 0.9 : s.t0, s.nm, 0.42, s.t1 - Math.max(s.t0, 0.9) + 0.2);
}
for (let b = 4; b < 30; b++) {
  const T = 3 * b, change = SEG.find((s) => s.t0 > T + 0.01 && s.t0 < T + 3 - 0.01);
  const cand = [[0, 0.62, 0.95], [change && Math.abs(change.t0 - T - 1.5) < 0.01 ? 1.5 : 1.125, 0.52, 0.8], [2.25, 0.45, 0.65]];
  for (const [off, vel, dur] of cand) {
    const t = T + off; if (t >= 84) continue;
    if (modeAt(RH_MODE, t) === 'comp') rh(t + 0.006, chordAt(t + 0.01), vel, dur);
  }
}
// long chords at each chord change while the groove is filtered / thin
for (const s of SEG) {
  for (let t = s.t0; t < s.t1 - 0.05; t = nextChange(RH_MODE, t)) {
    if (modeAt(RH_MODE, t) !== 'long') continue;
    const end = Math.min(s.t1, nextChange(RH_MODE, t));
    if (end - t > 0.3) rh(t + 0.01, s.nm, 0.45, end - t + 0.1);
  }
}
// CTA: Rhodes motif reprise, Cmaj7, final Em9 ringing out
[[84.0, 71, 0.375], [84.375, 74, 0.375], [84.75, 76, 0.75]].forEach(([t, m, d]) => rh(t, null, 0.6, d + 0.2, [m]));
rh(84.0, 'Em9', 0.35, 1.45);
rh(85.5, 'Cmaj7', 0.45, 1.45);
rh(87.0, 'Em9', 0.62, 2.2, [52, 55, 59, 62, 66, 71]);

// (d) round sub bass
const BASS_MODE = [[0, 'none'], [12, 'full'], [27, 'long'], [30.75, 'full'], [45, 'long'], [48, 'full'], [60, 'long'], [63, 'none'], [69.75, 'long'], [72.72, 'none'], [73.5, 'full'], [84, 'long'], [87, 'final'], [90, 'none']];
const bassPut = (t, m, d, g = 1) => put(MUSIC, t, subBass(m, d), { gain: 0.27 * g });
SEG.forEach((s, k) => {
  const len = s.t1 - s.t0, r = ROOT[s.nm], nx = SEG[k + 1] ? ROOT[SEG[k + 1].nm] : r;
  const pat = len >= 2.99 ? [[0, r, 0.55, 1], [6, r, 0.3, 0.8], [10, r + 7, 0.3, 0.75], [14, nx - 1 === r ? nx + 2 : nx - 1, 0.15, 0.6]] : [[0, r, 0.55, 1], [6, r, 0.3, 0.8]];
  for (const [i16, m, d, g] of pat) {
    const t = s.t0 + sw(i16); if (t >= s.t1 - 0.05) continue;
    if (modeAt(BASS_MODE, t) === 'full') bassPut(t, m, d, g);
  }
  for (let t = s.t0; t < s.t1 - 0.05; t = nextChange(BASS_MODE, t)) {
    const md = modeAt(BASS_MODE, t);
    if (md === 'long') { const end = Math.min(s.t1, nextChange(BASS_MODE, t)); if (end - t > 0.3) bassPut(t, r, end - t - 0.06, 0.85); }
    if (md === 'final' && t === s.t0) bassPut(t, r, 2.2, 0.9);
  }
});

// (e) drums: 58 % swung lo-fi groove on a global 16th grid
const DK = [kickD({ seed: 'a' }), kickD({ seed: 'b', fTop: 64, decay: 0.21 })];
const DS = [snareD('a'), snareD('b'), snareD('c')];
const RD = rngFor('drumsamples');
const DR = [rimD(RD), rimD(RD), rimD(RD)], DH = Array.from({ length: 6 }, () => hatD(RD, 0.022)), DO = [hatD(RD, 0.18), hatD(RD, 0.2)];
const DSH = Array.from({ length: 4 }, () => shakerD(RD)), DC = [clapD(RD), clapD(RD)], DKN = Array.from({ length: 5 }, () => knifeShk(RD));
const GM = [[0, 'none'], [12, 'full'], [27, 'half'], [30.75, 'full'], [33.75, 'knife'], [36.75, 'full'], [45, 'half'], [48, 'full'], [60, 'light'], [63, 'none'], [69.75, 'soft'], [72.72, 'none'], [73.5, 'fullest'], [81, 'thin'], [84, 'cta'], [87, 'none']];
const RJ = rngFor('groove');
const KG = 0.32, SG = 0.17, RG = 0.08, HG = 0.05, OG = 0.05, SHG = 0.03;
const hatAcc = [1, 0.35, 0.7, 0.4];
for (let k = 0; k < DUR / S16; k++) {
  const bar = Math.floor(k / 16), p = k % 16, t = bar * BAR + sw(p), md = modeAt(GM, t);
  const j = 0.85 + 0.3 * RJ(), dt = (RJ() - 0.5) * 0.004;   // human velocity + timing
  const odd = bar % 2 === 1, tt = t + dt;
  const kick = (g = 1) => put(MUSIC, tt, DK[odd ? 1 : 0], { gain: KG * g });
  const snare = (g = 1) => put(MUSIC, tt, DS[k % 3], { gain: SG * g * j, room: 0.35, pan: 0.04 });
  const rim = (g = 1) => put(MUSIC, tt, DR[k % 3], { gain: RG * g * j, room: 0.25, pan: -0.15 });
  const hat = (g = 1) => put(MUSIC, tt, DH[k % 6], { gain: HG * g * hatAcc[p % 4] * j, pan: 0.28 });
  const ohat = (g = 1) => put(MUSIC, tt, DO[bar % 2], { gain: OG * g, pan: 0.32, room: 0.1 });
  const kickPat = odd ? [0, 6, 10] : [0, 7, 10];
  if (md === 'full' || md === 'fullest' || md === 'knife') {
    if (kickPat.includes(p)) kick(p === 0 ? 1 : 0.82);
    if (odd && p === 15) kick(0.4);
    if (p === 4 || p === 12) snare(1);
    if (odd && p === 14) rim(0.5);
    if (md === 'knife') put(SFX, tt, DKN[k % 5], { gain: 0.15 * hatAcc[p % 4] * j, pan: -0.18 + 0.1 * (p % 2), room: 0.12 });
    else if (p === 14 && bar % 2 === 1) ohat(md === 'fullest' ? 1.2 : 1);
    else hat(md === 'fullest' ? 1.15 : 1);
    if (md === 'fullest') {
      if (p % 2 === 1) put(MUSIC, tt, DSH[k % 4], { gain: SHG * j, pan: -0.4 });
      if (p === 4 || p === 12) put(MUSIC, tt + 0.004, DC[k % 2], { gain: 0.08, room: 0.3, pan: -0.06 });
      if (p === 3 && odd) kick(0.5);
    }
  } else if (md === 'half') {
    if (p === 0) kick(0.95); if (p === 10 && odd) kick(0.6);
    if (p === 8) snare(0.9);
    if (p % 4 === 0 || p % 4 === 2) hat(0.6);
  } else if (md === 'light') {
    if (p === 0) kick(0.8);
    if (p === 4 || p === 12) rim(0.9);
    if (p % 2 === 0) hat(0.55);
  } else if (md === 'soft') {
    if (p === 0 || p === 10) kick(0.7);
    if (p === 4) rim(0.8); if (p === 12) snare(0.6);
    if (p % 2 === 0) hat(0.5);
  } else if (md === 'thin') {
    const fade = 1 - clamp((t - 81) / 3, 0, 1) * 0.7;
    if (t < 83.25) { if (p === 0 || p === 10) kick(0.85 * fade); if (p === 4 || p === 12) snare(0.8 * fade); }
    if (p % 2 === 0) hat(0.7 * fade);
  } else if (md === 'cta') {
    if (p === 0) kick(0.75); if (p === 12) rim(0.8);
    if (p % 2 === 0) hat(0.45);
  }
}
put(MUSIC, 73.5, DK[0], { gain: KG * 1.1 });                       // burst downbeat
put(MUSIC, 73.5, DC[0], { gain: 0.09, room: 0.3 });

// (f) đàn bầu lead: E minor pentatonic, scoops, bends, slides, deep vibrato, dotted-8th tape echo
const E4 = 64, G4 = 67, A4 = 69, B4 = 71, D5 = 74, E5 = 76, G5 = 79, A5 = 81, B5 = 83, D6 = 86, E6 = 88, G6 = 91, A6 = 93, B6 = 95;
const LEAD_G = 0.15;
function lead(t, midi, beats, gs = '', o = {}) {
  const dur = beats * BEAT - 0.01, { keys, vib } = gest(gs, dur);
  const s = danBau(midi, dur, { keys, vib, seed: t.toFixed(3), tail: o.tail });
  const g = (o.gain ?? 1) * LEAD_G;
  put(MUSIC, t, s, { gain: g, pan: o.pan ?? 0.12, hall: o.hall ?? 0.35, room: 0.06 });
  if (o.echo !== false) put(MUSIC, t + 0.5625, filt(s, 'lp', 3000, 0.7), { gain: g * 0.22, pan: -0.35, hall: 0.5 });
}
function phrase(t0, notes, o = {}) { let t = t0; for (const [m, b, gs] of notes) { if (m) lead(t, m, b, gs, o); t += b * BEAT; } return t; }
// ACT I intro: solo, sparse
phrase(1.5, [[B4, 2, 's,v'], [D5, 1, ''], [E5, 3, 'b-2,v']], { gain: 0.95 });
phrase(6.0, [[A4, 1.5, 's'], [B4, 0.5, ''], [G4, 2, 'v']], { gain: 0.9 });
phrase(9.0, [[B4, 3, 'r,v']], { gain: 0.9 });
// theme A (first note 12.75)
phrase(12.75, [[B4, 1.5, 's'], [D5, 0.5, ''], [E5, 2, 'v'],
  [G5, 1, 'b-3'], [E5, 0.5, ''], [D5, 0.5, ''], [B4, 2, 'v'],
  [A4, 1.5, 's'], [B4, 0.5, ''], [D5, 1, 'b-5'], [B4, 0.5, ''], [A4, 0.5, ''],
  [D5, 1, 'r'], [B4, 3, 'v,gd']]);
// answer + sparse time-lapse notes
phrase(25.5, [[E5, 1, 's'], [G5, 1, 'b-2'], [A5, 0.5, ''], [G5, 0.5, ''], [E5, 1.5, 'v']]);
lead(29.25, B4, 2, 'v', { gain: 0.8 });
phrase(31.5, [[A4, 1, 's'], [B4, 0.5, ''], [D5, 1.5, 'u2']]);
lead(34.5, B4, 3, 'r,v', { gain: 0.85 });
// theme B (higher)
phrase(36.75, [[B5, 1, 's'], [A5, 0.5, ''], [G5, 0.5, ''], [E5, 2, 'b-2,v'],
  [D5, 0.5, ''], [E5, 0.5, ''], [G5, 1, 'b-5'], [A5, 0.5, ''], [G5, 0.5, ''], [E5, 1, ''],
  [D5, 0.5, ''], [E5, 1.5, 'v']]);
lead(45.0, B4, 4, 'b-3,v', { gain: 1.05, hall: 0.55 });          // the dreamy slow-motion note
// theme A variation
phrase(48.75, [[E5, 1.5, 's'], [G5, 0.5, ''], [A5, 2, 'v'],
  [B5, 1, 'b-2'], [A5, 0.5, ''], [G5, 0.5, ''], [E5, 2, 'v'],
  [D5, 1, ''], [E5, 0.5, ''], [G5, 0.5, ''], [E5, 2, 'u2'],
  [D5, 1, 'r'], [B4, 3, 'v']]);
phrase(61.5, [[G4, 1, 's'], [E4, 2, 'v']], { gain: 0.75 });
// one call after the slurp
phrase(70.125, [[B4, 1, 's'], [E5, 2.5, 'b-5,v']], { gain: 0.8 });
// BURST: joyful high solo with big bends
phrase(73.5, [[E6, 1, 'b-5'], [D6, 0.5, ''], [B5, 0.5, ''], [D6, 1, 'b-2'], [E6, 1.5, 'v'], [B5, 0.5, 's']], { gain: 1.0, hall: 0.4 });
// responses between the street slurps (8th off-beats)
[[77.625, E5, 'b-2'], [78.375, G5, ''], [79.125, A5, 'b-2'], [79.875, B5, 's'], [80.625, A5, 'gd']].forEach(([t, m, g]) => lead(t, m, 0.5, g, { gain: 0.85 }));
// outro: final phrase gliding down
phrase(81.0, [[G5, 1, 's'], [E5, 1, ''], [D5, 1, 'r'], [B4, 2, 'v,gd']]);
// CTA: two-note upward slide, then the ending note under the final chord
phrase(85.5, [[B4, 0.5, 't5'], [E5, 1.5, 'v']], { gain: 0.9 });
lead(87.0, E5, 2.6, 'n', { gain: 0.7, hall: 0.5, tail: 0.6 });

// (g) music box theme in the groove cut
{
  const R = rngFor('mbox');
  [E6, G6, B6, A6, G6, E6, D6, E6].forEach((m, k) => put(MUSIC, 63.2 + k * 0.4, mbox(R, m + 12 * 0, k === 7 ? 2.2 : 1.6), { gain: 0.07, pan: 0.25 * Math.sin(k), hall: 0.45 }));
}

// ───────────────────────────── 7. Foley + ambience ─────────────────────────────
// ACT I (0–15): cold dawn street
put2Amb(0, coldWind(rngFor('wind'), 14), { gain: 0.15 });
put2Amb(66.0, coldWind(rngFor('wind2'), 6.5), { gain: 0.07 });
[[0.8, -0.6], [2.4, 0.55], [5.0, -0.3], [8.0, 0.65], [11.0, -0.5], [13.7, 0.4]].forEach(([t, p], k) => putAmb(t, sparrow(rngFor('sp' + k)), { gain: 0.11, pan: p, hall: 0.2 }));
[[63.3, -0.55], [64.4, 0.6], [65.3, -0.2], [86.8, 0.5], [88.0, -0.45]].forEach(([t, p], k) => putAmb(t, sparrow(rngFor('spb' + k)), { gain: 0.1, pan: p, hall: 0.2 }));
{
  const R = rngFor('broom');
  [3.75, 4.5, 5.25, 6.0].forEach((t, k) => {
    putAmb(t, broom(R, 0.34), { gain: 0.2, pan: -0.45 + 0.05 * k, room: 0.1 });
    putAmb(t + 0.375, broom(R, 0.2), { gain: 0.1, pan: -0.42 + 0.05 * k });
  });
}
putAmb(4.6, bikeBell(rngFor('bell1'), 'ring'), { gain: 0.15, pan: 0.5, hall: 0.3 });
putAmb(0, potBed(rngFor('pot'), 15), { gain: 0.11, pan: 0.2, room: 0.1 });
put2Amb(0, kettleSimmer(rngFor('simmer'), 14), { gain: 0.05 });
sfx(7.2, haaa(rngFor('haaa')), { gain: 0.24, pan: 0.08, room: 0.3 });
sfx(7.95, whoosh(rngFor('air'), 0.9, 500, 2600, 900), { gain: 0.16, pan: (u) => -0.4 + 0.9 * u });
{ const R = rngFor('stool'), y = new Float32Array(secs(0.4)); addInto(y, plop(R, 190, 70, 0.2, 0.6), 0, 1); addInto(y, modal([[420, 0.04, 1], [980, 0.02, 0.5], [1730, 0.012, 0.3]], 0.2), 0, 0.5); sfx(9.6, fadeEdges(norm(y), 0.0003, 0.03), { gain: 0.3, pan: -0.2, room: 0.25 }); }
sfx(10.0, lidClank(rngFor('lid')), { gain: 0.42, pan: -0.12, room: 0.35 });
sfx2(10.1, steam(rngFor('steam'), 1.4), { gain: 0.3, hall: 0.15 });
sfx(10.1, whoosh(rngFor('steamw'), 1.3, 900, 4200, 2000, 0.2), { gain: 0.22, pan: 0.1 });
sfx2(11.25, reverseCrash(rngFor('rev12'), 0.75), { gain: 0.24 });
sfx(11.4, riser(rngFor('ris12'), 0.6, 400, 6000), { gain: 0.1 });
// 12.0 TITLE HIT
sfxLow(12.0, bigBoom(rngFor('boom12'), 2.2, { fStart: 85, fEnd: 36, decay: 0.55 }), { gain: 0.6 });
sfx2(12.0, crash(rngFor('crash12'), 2.4), { gain: 0.22, hall: 0.3 });
sfx2(12.3, waterPour(rngFor('ladle'), 2.2, { f0: 700, f1: 1500, thick: 0.4 }), { gain: 0.3, room: 0.25 });

// ACT II (15–60): making the broth
sfx2(15.0, norm2(...fireBed(rngFor('fire'), 3.3, 40)), { gain: 0.3, room: 0.1 });
sfx2(15.3, sizzle(rngFor('char'), 2.6), { gain: 0.14 });
sfx(15.2, norm(crackle(rngFor('embers'), 2.8, () => 22, () => 1, 1200, 5000)), { gain: 0.16, pan: 0.3 });
[18.0, 18.75, 19.5, 20.25].forEach((t, k) => sfx(t, spiceRattle(rngFor('spice' + k)), { gain: 0.3, pan: k % 2 ? 0.25 : -0.25, room: 0.15 }));
[21.0, 21.75, 22.5, 23.25].forEach((t, k) => sfxLow(t, boneBop(rngFor('bone' + k)), { gain: 0.45, pan: [-0.15, 0.12, -0.05, 0.18][k], room: 0.3 }));
[24.0, 24.75, 25.5, 26.25].forEach((t, k) => sfx(t, skimSwish(rngFor('skim' + k), 0.7), { gain: 0.2, pan: (u) => (k % 2 ? 0.4 : -0.4) * (1 - 2 * u / 0.7), room: 0.2 }));
// night time-lapse
{
  const R = rngFor('clock');
  for (let t = 27.0, k = 0; t < 30.7; t += 0.125, k++) sfx(t, clockTick(R, k % 2 === 0), { gain: 0.11 * (k % 2 ? 0.75 : 1), pan: 0.32 });
}
put2Amb(27.0, [crickets(rngFor('cr1'), 3.8, 4400), crickets(rngFor('cr2'), 3.8, 4750)], { gain: 0.14 });
sfx(27.5, whoosh(rngFor('moon'), 1.6, 300, 1800, 500), { gain: 0.2, hall: 0.4, pan: (u) => 0.5 - 0.6 * u / 1.6 });
sfx(30.2, rooster(rngFor('rooster')), { gain: 0.24, pan: -0.3, hall: 0.35 });
sfx2(31.0, glug(rngFor('fishsauce'), 0.7), { gain: 0.34, room: 0.2 });
{ const R = rngFor('sugar'), y = new Float32Array(secs(0.6)); addInto(y, plop(R, 300, 110, 0.22, 0.3), 0, 1); for (let k = 0; k < 5; k++) addInto(y, bubble(400 + R() * 700, 0.04, 1, 0.3), secs(0.05 + R() * 0.3), 0.25); sfx(32.25, fadeEdges(norm(y), 0.0005, 0.03), { gain: 0.34, pan: 0.1, room: 0.3 }); }
// strainer, drips, noodles, toppings
sfx2(37.0, waterPour(rngFor('strainer'), 0.8, { f0: 500, f1: 900, thick: 1 }), { gain: 0.36, room: 0.25 });
sfx(37.0, wetPlop(rngFor('strainer2'), 200), { gain: 0.28, room: 0.2 });
sfx(38.25, smallDrip(rngFor('drip1'), 1100), { gain: 0.25, pan: 0.15, room: 0.4 });
sfx(39.0, smallDrip(rngFor('drip2'), 880), { gain: 0.25, pan: -0.1, room: 0.4 });
[39.75, 40.5, 41.25].forEach((t, k) => { sfx(t, noodleFlop(rngFor('nood' + k)), { gain: 0.3, pan: -0.1 + 0.1 * k, room: 0.2 }); sfx(t + 0.01, ceramic(rngFor('noodc' + k), 1650, 0), { gain: 0.07, pan: 0.1 }); });
[42.0, 42.75, 43.5, 44.25].forEach((t, k) => { sfx(t, placeSoft(rngFor('top' + k), k), { gain: 0.3, pan: [-0.2, 0.15, -0.05, 0.22][k], room: 0.2 }); sfx(t + 0.015, ceramic(rngFor('topc' + k), 1900 + 120 * k, 0), { gain: 0.12, pan: 0.1, hall: 0.15 }); });
// 45.0 slow-motion broth pour
sfx2(45.0, waterPour(rngFor('pour45'), 2.4, { f0: 400, f1: 800, thick: 1 }), { gain: 0.4, room: 0.3, hall: 0.2 });
sfx(45.0, whoosh(rngFor('pour45w'), 2.3, 150, 900, 200, 0.3), { gain: 0.3, hall: 0.2 });
sfx2(45.15, sizzle(rngFor('pour45s'), 2.35), { gain: 0.16 });
// steam shimmer + lens flare, herbs, lime, chili
sfx2(48.75, shimmer(rngFor('shim'), 2.8), { gain: 0.2, hall: 0.4 });
sfx(49.5, ting(m2f(100), 1.2), { gain: 0.1, hall: 0.5, pan: 0.3 });
sfx(49.62, ting(m2f(95), 1.2), { gain: 0.09, hall: 0.5, pan: -0.2 });
sfx2(51.75, rustle(rngFor('herbs'), 3.0), { gain: 0.2, room: 0.15 });
sfx(51.8, norm(crackle(rngFor('herbt'), 2.9, (t) => 26 + 10 * Math.sin(t * 3), () => 1, 2500, 7000)), { gain: 0.15, pan: 0.15 });
sfx(55.2, limeSquirt(rngFor('lime')), { gain: 0.34, pan: 0.2, room: 0.2 });
[[55.55, 1300], [55.8, 1600], [56.02, 1100]].forEach(([t, f], k) => sfx(t, smallDrip(rngFor('plink' + k), f), { gain: 0.17, pan: 0.3 - 0.2 * k, room: 0.35 }));
sfx(56.6, chiliFlakes(rngFor('chili')), { gain: 0.24, pan: -0.15 });
[57.75, 58.5, 59.25].forEach((t, k) => sfx(t, chopstickClack(rngFor('chop' + k)), { gain: 0.2, pan: k % 2 ? 0.2 : -0.1, room: 0.2 }));
sfx2(59.2, iceCrack(rngFor('ice'), 0.5, () => 60), { gain: 0.2, room: 0.2 });
sfx(59.22, stirClink(rngFor('glass'), 2150), { gain: 0.16, pan: 0.35, room: 0.2 });

// ACT III (60–84): the first slurp and the whole street
sfx(60.0, slideWood(rngFor('slide'), 0.6), { gain: 0.34, pan: (u) => 0.3 - 0.5 * u / 0.6, room: 0.2 });
sfx(60.58, ting(m2f(96), 0.9), { gain: 0.14, hall: 0.4 });
[63.4, 64.9, 66.4].forEach((t, k) => sfx(t, stirClink(rngFor('spoon' + k), 2300 + 90 * k), { gain: 0.2, pan: -0.15 + 0.15 * k, room: 0.25 }));
sfx(65.8, hmmVoice(rngFor('hmm')), { gain: 0.34, pan: 0.05, room: 0.2 });
sfx(68.0, bigSlurp(rngFor('xup'), 1.3), { gain: 0.85, room: 0.3 });
sfx2(69.3, rustle(rngFor('leaves'), 0.6), { gain: 0.28, room: 0.1 });
sfx(70.5, riser(rngFor('riser70'), 2.25, 300, 6000), { gain: 0.24 });
sfx(72.0, inhale(rngFor('inhale'), 0.7), { gain: 0.3, room: 0.15 });
// 73.5 BURST
sfx(73.5, vortex(rngFor('vortex'), 1.7), { gain: 0.5, pan: (u) => 0.8 * Math.sin(TAU * 1.6 * u) });
sfx(73.5, bigSlurp(rngFor('xup2'), 0.7, { f0: 900, f1: 3400, echo: false, bubbles: 12 }), { gain: 0.35 });
sfxLow(73.5, bigBoom(rngFor('boom73'), 2.4, { fStart: 95, fEnd: 34, decay: 0.65 }), { gain: 0.72 });
sfx2(73.5, crash(rngFor('crash73'), 2.6), { gain: 0.3, hall: 0.35 });
// the whole street slurps, call and response, metal ladle "keng" on the backbeats
for (let k = 0; k < 5; k++) {
  const t = 77.25 + k * 0.75, hi = k % 2 === 0;
  sfx(t, bigSlurp(rngFor('street' + k), 0.45, hi ? { f0: 900, f1: 3600, echo: false, bubbles: 10, buzz: 0.3 } : { f0: 420, f1: 1800, echo: false, bubbles: 10, buzz: 0.55 }), { gain: 0.64, pan: hi ? -0.55 : 0.55, room: 0.25 });
}
[77.25, 78.75, 80.25].forEach((t, k) => sfx(t + 0.02, keng(rngFor('keng' + k), 1520 + 40 * k), { gain: 0.2, pan: k % 2 ? -0.35 : 0.35, hall: 0.2 }));
sfx(81.75, ting(m2f(88), 1.6), { gain: 0.12, hall: 0.5, pan: -0.2 });
sfx(81.8, ting(m2f(95), 1.6), { gain: 0.1, hall: 0.5, pan: 0.25 });
sfx2(81.75, shimmer(rngFor('shim81'), 1.6), { gain: 0.14, hall: 0.4 });

// ACT IV (84–90): CTA
sfx(84.2, heartPop(rngFor('heart')), { gain: 0.3, pan: -0.1 });
sfx(84.4, dingUp(), { gain: 0.24, hall: 0.3, pan: 0.1 });
sfx(84.7, whoosh(rngFor('ctaw'), 0.5, 600, 3500, 1200), { gain: 0.2, pan: (u) => -0.5 + 2 * u });
sfx(85.5, uiClick(rngFor('click')), { gain: 0.3 });
sfx(85.56, bikeBell(rngFor('bell2'), 'kinh'), { gain: 0.3, pan: 0.2, hall: 0.3 });
sfx2(85.5, confetti(rngFor('confetti'), 1.1), { gain: 0.3 });
sfx(86.0, ting(m2f(100), 0.4), { gain: 0.14, pan: 0.3 });

// vinyl bed + music trim
vinylBed();
const FILM = {
  trim: [[0, 1], [90, 1]],
  windows: [['intro 0-12', 0, 12], ['groove 15-27', 15, 27], ['time-lapse 27-30.75', 27, 30.75], ['dreamy pour 45-48', 45, 48],
    ['music box 63-66.75', 63, 66.75], ['slurp XUP 68-69.3', 68, 69.3], ['silence 72.75-73.5', 72.75, 73.5], ['burst 73.5-77.25', 73.5, 77.25],
    ['street slurps 77.25-81', 77.25, 81], ['CTA 84-90', 84, 90]],
};
console.log('score placed');

// ───────────────────────────── 8. Master ─────────────────────────────
const S0 = 72.75, S1 = 73.5;                                 // the held breath before the burst
const I_SF = Math.round((S0 - 0.03) * SR), I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);
const gateS = (i) => (i < I_SF ? 1 : i < I_S0 ? 0.5 + 0.5 * Math.cos(Math.PI * (i - I_SF) / (I_S0 - I_SF)) : i < I_S1 ? 0 : 1);
const FADE0 = 88.6, FADE1 = 89.95;                           // final chord rings out, last 50 ms digital zero
const KEYS6 = ['L', 'R', 'sL', 'sR', 'hL', 'hR'];

// (a) music bus: tape wow/flutter (modulated delay) + time-varying lo-fi low-pass (dreamy sweeps)
{
  const D = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = i / SR; D[i] = (1.2e-3 + 0.9e-3 * Math.sin(TAU * 0.53 * t) + 0.25e-3 * Math.sin(TAU * 0.21 * t + 1) + 0.04e-3 * Math.sin(TAU * 6.1 * t)) * SR; }
  const MLP = [[0, 5000], [11.25, 5000], [12, 8500], [26.9, 8500], [27.35, 1100], [30.2, 1100], [30.75, 8500], [44.95, 8500], [45.4, 650], [47.2, 650], [48, 8500], [90, 8500]].map(([t, f]) => [t, Math.log(f)]);
  const lpF = (t) => Math.exp(pw(MLP, t));
  for (const key of KEYS6) {
    const x = MUSIC[key], y = new Float32Array(N);
    for (let i = 0; i < N; i++) { const p = i - D[i], i0 = Math.floor(p), f = p - i0; y[i] = i0 >= 0 && i0 + 1 < N ? x[i0] * (1 - f) + x[i0 + 1] * f : 0; }
    MUSIC[key] = filt(filt(y, 'lp', lpF, 0.75), 'hp', 32, 0.7);
  }
}
// (b) foley high-pass (80 Hz) on SFX; booms (LOWFX) keep their low end
for (const key of KEYS6) { SFX[key] = filt(SFX[key], 'hp', 80, 0.7); const lo = LOWFX[key]; for (let i = 0; i < N; i++) SFX[key][i] += lo[i]; }
// (c) the silence: every bus (dry and sends) is cut to zero on [72.75, 73.5) so nothing feeds the reverbs
for (const bus of [MUSIC, SFX, AMB, VINYL]) for (const key of KEYS6) { const x = bus[key]; for (let i = I_SF; i < I_S1; i++) x[i] *= gateS(i); }

// (d) duck the music under foley (≈ −3.5 dB at full) + per-section music trim
const duck = new Float32Array(N);
{
  let e = 0; const at = 1 - Math.exp(-1 / (0.005 * SR)), rl = 1 - Math.exp(-1 / (0.25 * SR));
  for (let i = 0; i < N; i++) {
    const a = Math.max(Math.abs(SFX.L[i]), Math.abs(SFX.R[i]));
    e += (a > e ? at : rl) * (a - e);
    duck[i] = (1 - 0.34 * clamp(e / 0.25, 0, 1)) * pw(FILM.trim, i / SR);
  }
}
// ambience joins the SFX bus only after the duck key was computed
for (const key of KEYS6) for (let i = 0; i < N; i++) SFX[key][i] += AMB[key][i];

// (e) stereo Freeverb-style reverbs (8 damped combs + 4 allpasses per side, pre-delay)
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
// hall: music (ducked) + SFX/AMB hall sends; room: small close space for foley, snare and rim. Both wiped at 72.75.
const hallInL = new Float32Array(N), hallInR = new Float32Array(N), roomInL = new Float32Array(N), roomInR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  hallInL[i] = MUSIC.hL[i] * duck[i] + SFX.hL[i]; hallInR[i] = MUSIC.hR[i] * duck[i] + SFX.hR[i];
  roomInL[i] = MUSIC.sL[i] * duck[i] + SFX.sL[i]; roomInR[i] = MUSIC.sR[i] * duck[i] + SFX.sR[i];
}
const [hallL, hallR] = reverb(hallInL, hallInR, { fb: 0.865, damp: 0.3, pre: 0.028, clearAt: I_S0 });
const [roomL, roomR] = reverb(roomInL, roomInR, { size: 0.45, fb: 0.72, damp: 0.42, pre: 0.006, hp: 250, lp: 9000, inGain: 1.6, clearAt: I_S0 });

// (f) sum, gentle music-bus saturation, vinyl bed (not ducked), DC/sub high-pass, silence gate, master envelope
let preL = new Float32Array(N), preR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const ml = Math.tanh(MUSIC.L[i] * duck[i] * 1.1) / 1.1, mr = Math.tanh(MUSIC.R[i] * duck[i] * 1.1) / 1.1;
  preL[i] = ml + hallL[i] + SFX.L[i] + roomL[i] + VINYL.L[i];
  preR[i] = mr + hallR[i] + SFX.R[i] + roomR[i] + VINYL.R[i];
}
preL = filt(preL, 'hp', 24, 0.7); preR = filt(preR, 'hp', 24, 0.7);
const masterEnv = (t) => (t <= FADE0 ? 1 : t >= FADE1 ? 0 : Math.pow(0.5 + 0.5 * Math.cos(Math.PI * (t - FADE0) / (FADE1 - FADE0)), 1.4));
for (let i = 0; i < N; i++) { const g = masterEnv(i / SR) * gateS(i); preL[i] *= g; preR[i] *= g; }

// (g) loudness (ITU-R BS.1770-4 K-weighting, gated integrated) + true-peak helpers
function kweight(x) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i], y0 = 1.53512485958697 * x0 - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0;
  }
  x1 = x2 = y1 = y2 = 0;
  for (let i = 0; i < y.length; i++) {
    const x0 = y[i], y0 = x0 - 2 * x1 + x2 + 1.99004745483398 * y1 - 0.99007225036621 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0;
  }
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
function truePeak(L, R) {   // tp[i] = max |signal| on [i, i+1) using 4x windowed-sinc interpolation
  const T = 16, OS = 4, taps = [];
  for (let k = 1; k < OS; k++) {
    const fr = k / OS, h = new Float64Array(2 * T);
    for (let j = -T + 1; j <= T; j++) { const x = j - fr, w = 0.5 + 0.5 * Math.cos(Math.PI * x / T); h[j + T - 1] = (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; }
    taps.push(h);
  }
  const tp = new Float32Array(L.length), M = L.length;
  for (let i = 0; i < M; i++) {
    let p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (p > 0.2 && i >= T && i + T < M) {
      for (const h of taps) {
        let a = 0, b = 0;
        for (let j = 0; j < 2 * T; j++) { const c = h[j], ix = i - T + 1 + j; a += L[ix] * c; b += R[ix] * c; }
        p = Math.max(p, Math.abs(a), Math.abs(b));
      }
    }
    tp[i] = p;
  }
  return tp;
}
// look-ahead true-peak limiter; also reports how often it works (time with GR > 2 dB)
function limit(inL, inR, gain, ceilDb) {
  const L = new Float32Array(N), R = new Float32Array(N), CEIL = Math.pow(10, ceilDb / 20);
  for (let i = 0; i < N; i++) { L[i] = inL[i] * gain; R[i] = inR[i] * gain; }
  const LA = secs(0.004), rel = 1 - Math.exp(-1 / (0.12 * SR));
  const req = new Float32Array(N), tp = truePeak(L, R);
  for (let i = 0; i < N; i++) { const p = Math.max(tp[i], i > 0 ? tp[i - 1] : 0); req[i] = p > CEIL ? CEIL / p : 1; }
  const h = new Float32Array(N), dq = new Int32Array(N); let qh = 0, qt = 0;
  for (let j = N - 1; j >= 0; j--) {
    while (qt > qh && req[dq[qt - 1]] >= req[j]) qt--;
    dq[qt++] = j;
    while (dq[qh] > j + LA) qh++;
    h[j] = req[dq[qh]];
  }
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

// (h) normalise to TARGET_LUFS through the limiter (iterate: limiting lowers loudness slightly)
let gain = Math.pow(10, (TARGET_LUFS - loudness(preL, preR).integ) / 20), out;
for (let it = 0; it < 5; it++) {
  out = limit(preL, preR, gain, CEIL_DBTP);
  const lu = loudness(out.L, out.R).integ;
  if (Math.abs(lu - TARGET_LUFS) < 0.1) break;
  gain *= Math.pow(10, (TARGET_LUFS - lu) / 20);
}
let mL = out.L, mR = out.R;
// exact digital silence in the hush and at the very end; safety true-peak trim (≤ −1.3 dBTP after dither)
for (let i = I_S0; i < I_S1; i++) { mL[i] = 0; mR[i] = 0; }
for (let i = Math.round(FADE1 * SR); i < N; i++) { mL[i] = 0; mR[i] = 0; }
{
  const tp = truePeak(mL, mR); let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, tp[i]);
  const lim = Math.pow(10, -1.38 / 20);
  if (pk > lim) { const g = lim / pk; for (let i = 0; i < N; i++) { mL[i] *= g; mR[i] *= g; } }
}
console.timeEnd('render');

// (i) WAV writer (RIFF / PCM 16-bit / 2ch / 48 kHz) with TPDF dither (true zeros stay zero)
function writeWav(file, L, R) {
  const dataLen = N * 4, buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(dataLen, 40);
  const D = rngFor('dither');
  let o = 44;
  for (let i = 0; i < N; i++) {
    const dz = L[i] === 0 && R[i] === 0;
    const dl = dz ? 0 : (D() - D()), dr = dz ? 0 : (D() - D());
    buf.writeInt16LE(clamp(Math.round(L[i] * 32767 + dl), -32768, 32767), o); o += 2;
    buf.writeInt16LE(clamp(Math.round(R[i] * 32767 + dr), -32768, 32767), o); o += 2;
  }
  fs.writeFileSync(file, buf);
}
const OUT = path.join(__dirname, 'audio.wav');
writeWav(OUT, mL, mR);

// (j) verification: re-read the file and report format, peak, loudness, RMS map, hush + pass/fail
{
  const b = fs.readFileSync(OUT);
  const ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), bits = b.readUInt16LE(34), dlen = b.readUInt32LE(40);
  const frames = dlen / (ch * bits / 8);
  const L = new Float32Array(frames), R = new Float32Array(frames);
  let pk = 0, clipped = 0;
  for (let i = 0; i < frames; i++) {
    const a = b.readInt16LE(44 + i * 4), c = b.readInt16LE(46 + i * 4);
    if (a >= 32767 || a <= -32768 || c >= 32767 || c <= -32768) clipped++;
    L[i] = a / 32768; R[i] = c / 32768; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
  }
  const tp = truePeak(L, R); let tpk = 0; for (let i = 0; i < frames; i++) tpk = Math.max(tpk, tp[i]);
  const lu = loudness(L, R);
  let dcL = 0, dcR = 0, side = 0, mid = 0; for (let i = 0; i < frames; i++) { dcL += L[i]; dcR += R[i]; mid += (L[i] + R[i]) ** 2; side += (L[i] - R[i]) ** 2; }
  const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  console.log(`wrote ${OUT}`);
  console.log(`format     ${ch} ch, ${sr} Hz, ${bits}-bit PCM, ${frames} frames = ${(frames / sr).toFixed(3)} s`);
  console.log(`peak       ${dB(pk).toFixed(2)} dBFS   true peak ≈ ${dB(tpk).toFixed(2)} dBTP   clipped samples ${clipped}`);
  console.log(`limiter    max GR ${(-dB(out.minG)).toFixed(1)} dB   time with GR > 2 dB: ${(out.over2 * 100).toFixed(2)} %`);
  console.log(`loudness   integrated ≈ ${lu.integ.toFixed(1)} LUFS   max short-term ${lu.maxS.toFixed(1)} LUFS   max momentary ${lu.maxM.toFixed(1)} LUFS`);
  console.log(`DC         L ${(dcL / frames).toExponential(1)}  R ${(dcR / frames).toExponential(1)}    side/mid energy ${(10 * Math.log10(side / mid)).toFixed(1)} dB`);
  const rmsW = (a, c) => { const i0 = Math.round(a * SR), i1 = Math.min(frames, Math.round(c * SR)); let s = 0; for (let i = i0; i < i1; i++) s += L[i] * L[i] + R[i] * R[i]; return dB(Math.sqrt(s / (2 * Math.max(1, i1 - i0)))); };
  const row = []; for (let s = 0; s < 90; s += 5) row.push(`${String(s).padStart(2)}-${String(s + 5).padStart(2)}s:${rmsW(s, s + 5).toFixed(1).padStart(6)}`);
  console.log('RMS per 5 s (dBFS):'); for (let k = 0; k < row.length; k += 6) console.log('  ' + row.slice(k, k + 6).join('  '));
  for (const [name, a, c] of FILM.windows) console.log(`  ${name.padEnd(26)} rms ${rmsW(a, c).toFixed(1).padStart(6)} dBFS`);
  // where the limiter works hardest (0.25 s windows with > 2 dB GR)
  const hot = [];
  for (let w = 0; w + 0.25 <= DUR; w += 0.25) { let m = 1; for (let i = Math.round(w * SR); i < Math.round((w + 0.25) * SR); i++) m = Math.min(m, out.gr[i]); if (m < Math.pow(10, -2 / 20)) hot.push(`${w.toFixed(2)}s:${(-dB(m)).toFixed(1)}`); }
  console.log(`limiter GR > 2 dB at: ${hot.length ? hot.join('  ') : 'none'}`);
  let hushZero = true; for (let i = Math.round(S0 * sr); i < Math.round(S1 * sr); i++) if (L[i] !== 0 || R[i] !== 0) { hushZero = false; break; }
  let tailZero = true; for (let i = Math.round((DUR - 0.05) * sr); i < frames; i++) if (L[i] !== 0 || R[i] !== 0) { tailZero = false; break; }
  const checks = [
    ['format 2 ch / 48 kHz / 16-bit PCM', ch === 2 && sr === 48000 && bits === 16],
    ['duration exactly 90.000 s', frames === Math.round(90 * 48000)],
    ['integrated loudness -15 ± 0.5 LUFS', Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    ['true peak <= -1.3 dBTP', dB(tpk) <= -1.3],
    ['sample peak <= -1.0 dBFS', dB(pk) <= -1.0],
    ['no clipped samples', clipped === 0],
    ['silence 72.75-73.5 is digital zero', hushZero],
    ['burst after the hush (73.5-74.0 > -30 dBFS)', rmsW(73.5, 74.0) > -30],
    ['last 0.05 s digital silence', tailZero],
    ['limiter max GR <= 6 dB', -dB(out.minG) <= 6],
  ];
  console.log('self-check:');
  for (const [nm, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${nm}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}
