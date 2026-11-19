'use strict';
// MÌ XÀO GIÒN CHỢ LỚN — 90 s soundtrack, fully synthesized (48 kHz stereo 16-bit, 120 BPM). Run: node audio.js -> audio.wav
// Engine ported from the bún đậu / cà phê films; score + master written for the 90 s format (hush 73.0-73.5, burst 73.5, sting 82.0, CTA 84.5-90).
const fs = require('fs');
const path = require('path');

// ───────────────────────────── 1. Core ─────────────────────────────
const SR = 48000;
const DUR = 90.0;
const N = Math.round(SR * DUR);
const BEAT = 0.5;            // 120 BPM
const BAR = 4 * BEAT;
const TAU = Math.PI * 2;
const TARGET_LUFS = -15.0;
const CEIL_DBTP = -1.45;     // limiter ceiling (margin under the −1.3 dBTP spec after dither)

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rngFor = (name) => mulberry32(hashStr('mixaogion:' + name));   // independent deterministic stream per cue

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
const secs = (s) => Math.max(1, Math.round(s * SR));
const expi = (a, b, u) => a * Math.pow(b / a, clamp(u, 0, 1));
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
const TAB_PAD = makeTable([1, 0.48, 0.3, 0.2, 0.13, 0.09, 0.06, 0.04, 0.025]);
const TAB_STR = makeTable(Array.from({ length: 16 }, (_, h) => (1 / (h + 1)) * (h % 2 === 0 ? 1 : 0.85)));   // soft saw (strings)
const TAB_ENGINE = makeTable(Array.from({ length: 30 }, (_, h) => (1 / Math.pow(h + 1, 0.75)) * (h % 2 === 0 ? 1 : 0.8) * (h > 8 && h < 16 ? 1.4 : 1)));
const TAB_HORN = makeTable(Array.from({ length: 14 }, (_, h) => (1 / (h + 1)) * (h % 2 === 0 ? 1 : 0.55)));
const TAB_MOTO = makeTable([1, 0.55, 0.35, 0.22, 0.12, 0.08, 0.05]);   // tonal (musical) motorbike

// ───────────────────────────── 3. Instruments ─────────────────────────────

/* Đàn tranh pluck: Karplus–Strong string with a soft, low-passed excitation. */
function tranh(midi, dur, R, o = {}) {
  const f = m2f(midi);
  const P = Math.max(2, Math.round(SR / f - 0.5));
  const buf = new Float32Array(P);
  let lp = 0; const bright = o.bright ?? 0.55;
  for (let i = 0; i < P; i++) { lp += bright * ((R() * 2 - 1) - lp); buf[i] = lp; }
  let mean = 0; for (let i = 0; i < P; i++) mean += buf[i]; mean /= P; for (let i = 0; i < P; i++) buf[i] -= mean;
  const decay = o.decay ?? 0.9965;
  const n = secs(dur), y = new Float32Array(n);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = buf[idx], b = buf[(idx + 1) % P];
    y[i] = a; buf[idx] = decay * 0.5 * (a + b); idx = (idx + 1) % P;
  }
  const body = filt(y, 'peak', 900, 1.2, 3);
  return fadeEdges(norm(body), 0.001, Math.min(0.15, dur * 0.3));
}

/* Warm pad / strings: 3 detuned voices per note (L / C / R), band-limited wavetable, low-passed. */
function pad(midis, dur, o = {}) {
  const attack = o.attack ?? 0.8, release = o.release ?? 0.8, cutoff = o.cutoff ?? 1200, det = o.detune ?? 7;
  const tab = o.tab || TAB_PAD, vib = (o.vib || 0) / 1200;
  const R = rngFor('pad' + midis.join(',') + dur + (o.seed || ''));
  const n = secs(dur + release), L = new Float32Array(n), Rr = new Float32Array(n);
  const voices = [];
  for (const m of midis) for (let v = 0; v < 3; v++) {
    voices.push({ f: m2f(m) * Math.pow(2, ((v - 1) * det + (R() - 0.5) * 2) / 1200), ph: R(), pan: (v - 1) * 0.7 + (R() - 0.5) * 0.2, lfo: 0.15 + R() * 0.3, lph: R() * TAU, vr: 4.6 + R() * 1.2 });
  }
  for (const vc of voices) {
    const a = (vc.pan + 1) * Math.PI / 4, gl = Math.cos(a), gr = Math.sin(a);
    let ph = vc.ph;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += vc.f * (1 + 0.0012 * Math.sin(TAU * vc.lfo * t + vc.lph) + vib * smooth((t - 0.3) / 0.8) * Math.sin(TAU * vc.vr * t + vc.lph)) / SR; ph -= Math.floor(ph);
      const s = tabRead(tab, ph);
      L[i] += s * gl; Rr[i] += s * gr;
    }
  }
  const fl = (x) => filt(filt(x, 'lp', cutoff, 0.6), 'lp', cutoff * 1.5, 0.6);
  const Lf = fl(L), Rf = fl(Rr);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = smooth(t / attack);
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    if (o.pump) env *= o.pump(t);
    if (o.env) env *= o.env(t);
    Lf[i] *= env; Rf[i] *= env;
  }
  norm2(Lf, Rf);
  fadeEdges(Lf, 0.005, 0.01); fadeEdges(Rf, 0.005, 0.01);
  return [Lf, Rf];
}

/* Low drone (default D): sub sine + octave + soft fifth, slow breathing. */
function drone(dur, o = {}) {
  const attack = o.attack ?? 1.5, release = o.release ?? 0.6;
  const n = secs(dur + release), y = new Float32Array(n);
  const f = m2f(o.midi ?? 38);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = Math.sin(TAU * f * t) + 0.55 * Math.sin(TAU * 2 * f * t + 0.4) + 0.18 * Math.sin(TAU * 3 * f * 1.0007 * t) + 0.08 * Math.sin(TAU * 4 * f * t);
    s *= 0.85 + 0.15 * Math.sin(TAU * 0.25 * t);
    let env = smooth(t / attack);
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    y[i] = s * env;
  }
  return fadeEdges(norm(y), 0.01, 0.02);
}

function kick(o = {}) {
  const R = rngFor('kick' + (o.seed || '')), n = secs(0.45), y = new Float32Array(n);
  const fEnd = o.fEnd ?? 46, fStart = o.fStart ?? 150, dec = o.decay ?? 0.26;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = fEnd + (fStart - fEnd) * Math.exp(-t / 0.032);
    ph += f / SR;
    const env = (t < 0.001 ? t / 0.001 : 1) * Math.exp(-t / dec);
    y[i] = Math.tanh(1.6 * Math.sin(TAU * ph) * env) / Math.tanh(1.6);
  }
  const click = burst(R, 0.012, 'hp', 1800, 0.7, 0.0025);
  addInto(y, click, 0, o.click ?? 0.35);
  return fadeEdges(norm(y), 0.0005, 0.03);
}
/* mõ (wooden temple block): hollow knock, a few inharmonic wood modes + click */
function mo(R, f = 820) {
  const y = modal([[f, 0.055, 1], [f * 2.31, 0.028, 0.42], [f * 3.87, 0.014, 0.2], [f * 0.52, 0.03, 0.15]], 0.3);
  addInto(y, burst(R, 0.006, 'bp', 2600, 0.8, 0.0009), 0, 0.35);
  return fadeEdges(norm(y), 0.0003, 0.03);
}
function tom(f = 110, decay = 0.28) {
  const R = rngFor('tom' + f), n = secs(decay * 3), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (f + f * 0.5 * Math.exp(-t / 0.04)) / SR; y[i] = Math.sin(TAU * ph) * (t < 0.001 ? t / 0.001 : 1) * Math.exp(-t / decay); }
  addInto(y, burst(R, 0.05, 'bp', 1200, 0.8, 0.008), 0, 0.15);
  return fadeEdges(norm(y), 0.0005, 0.05);
}
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
function bassNote(midi, dur) {
  const f = m2f(midi), rel = 0.05, n = secs(dur + rel), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += f * Math.pow(2, (-0.25 * Math.exp(-t / 0.012)) / 12) / SR;
    let s = Math.sin(TAU * ph) + 0.28 * Math.sin(2 * TAU * ph) + 0.08 * Math.sin(3 * TAU * ph);
    let env = (t < 0.004 ? t / 0.004 : 1) * (0.7 + 0.3 * Math.exp(-t / 0.08));
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / rel, 0, 1));
    y[i] = Math.tanh(1.4 * s * env);
  }
  return fadeEdges(norm(filt(y, 'lp', 1100, 0.7)), 0.002, 0.01);
}

// ───────────────────────────── 4. Sound effects ─────────────────────────────

/* crackle: sparse random micro-impulses (1–3 ms bursts) — returns mono */
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
function cityHum(R, dur) {
  const n = secs(dur);
  const mk = () => { const x = noise(n, R); let b = 0; for (let i = 0; i < n; i++) { b = b * 0.997 + x[i] * 0.06; x[i] = b; } return norm(filt(filt(x, 'lp', 380, 0.7), 'hp', 45, 0.7)); };
  const L = mk(), Rr = mk();
  const mL = norm(filt(noise(n, R), 'bp', 750, 0.5)), mR = norm(filt(noise(n, R), 'bp', 700, 0.5));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const sw = 0.75 + 0.25 * Math.sin(TAU * 0.13 * t + 1) * Math.sin(TAU * 0.31 * t);
    const sw2 = 0.75 + 0.25 * Math.sin(TAU * 0.11 * t + 2.3) * Math.sin(TAU * 0.27 * t + 0.4);
    L[i] = L[i] * 0.8 * sw + mL[i] * 0.1 * (0.7 + 0.3 * Math.sin(TAU * 0.21 * t));
    Rr[i] = Rr[i] * 0.8 * sw2 + mR[i] * 0.1 * (0.7 + 0.3 * Math.sin(TAU * 0.19 * t + 1));
  }
  return fade2(norm2(L, Rr), 0.3, 0.3);
}

/* sparrow call: a few quick descending chirps with trill */
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
function scooter(R, dur = 1.0, o = {}) {
  const dir = o.dir ?? 1, base = o.f0 ?? 82, v = o.v ?? 11, d = o.d ?? 3.5, tonal = !!o.tonal;
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const c = 343, tPass = dur * 0.5;
  const nz = noise(n, R);
  let ph = 0, ph2 = 0, ph3 = 0, lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = dir * v * (t - tPass), r = Math.hypot(x, d), vr = x * dir * v / r;
    const dop = c / (c + vr);
    const f0 = base * (1 + (tonal ? 0.004 : 0.025) * Math.sin(TAU * 1.3 * t)) * dop;
    ph += f0 / SR; ph -= Math.floor(ph); ph2 += f0 * 0.5 / SR; ph2 -= Math.floor(ph2); ph3 += f0 * 1.5 / SR; ph3 -= Math.floor(ph3);
    let s;
    if (tonal) s = tabRead(TAB_MOTO, ph) + 0.55 * tabRead(TAB_MOTO, ph3) + 0.35 * tabRead(TAB_MOTO, ph2) + nz[i] * 0.06;
    else { const putt = 0.7 + 0.3 * Math.sin(TAU * ph2); s = tabRead(TAB_ENGINE, ph) * putt + nz[i] * 0.3 * (0.4 + 0.6 * Math.max(0, Math.sin(TAU * ph))); }
    const fc = (tonal ? 1200 : 700) + 3200 * (d / r), k = 1 - Math.exp(-TAU * fc / SR);
    lp += k * (s - lp); lp2 += k * (lp - lp2);
    const amp = (d / r) * smooth(t / 0.15) * smooth((dur - t) / 0.12);
    const pan = clamp(x / r, -1, 1) * 0.9, a = (pan + 1) * Math.PI / 4;
    L[i] = lp2 * amp * Math.cos(a); Rr[i] = lp2 * amp * Math.sin(a);
  }
  return norm2(L, Rr);
}

/* whoosh: band-passed noise with a moving centre frequency and bell envelope */
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
function horn(dur = 0.13, f = 415) {
  const n = secs(dur + 0.03), y = new Float32Array(n);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p1 += f / SR; p1 -= Math.floor(p1); p2 += f * 1.26 / SR; p2 -= Math.floor(p2);
    let env = smooth(t / 0.005);
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / 0.025, 0, 1));
    y[i] = (tabRead(TAB_HORN, p1) + 0.8 * tabRead(TAB_HORN, p2)) * env;
  }
  return fadeEdges(norm(filt(filt(y, 'bp', 1100, 0.7), 'lp', 2800, 0.7)), 0.002, 0.01);
}

/* stick-slip creak (plastic stool): impulse train through resonant modes */
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
function smellWave(R, dur = 1.0) {
  const n = secs(dur), env = (u) => (u < 0.6 ? Math.pow(u / 0.6, 1.5) : Math.pow((1 - u) / 0.4, 1.3));
  const side = (ph) => {
    const x = noise(n, R);
    const fc = (t) => expi(260, 2400, Math.pow(t / dur, 0.8)) * (1 + 0.32 * Math.sin(TAU * 6.5 * t + ph));
    const a = filt(x, 'bp', fc, 2.6), b = filt(x, 'lp', (t) => fc(t) * 0.6, 0.7);
    const y = new Float32Array(n); let p = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, u = i / n;
      p += 220 * Math.pow(2, (u * 14 + 0.6 * Math.sin(TAU * 6.5 * t)) / 12) / SR;
      y[i] = (a[i] + 0.4 * b[i] + 0.05 * (Math.sin(TAU * p) + 0.3 * Math.sin(2 * TAU * p))) * env(u);
    }
    return y;
  };
  const L = side(0), Rr = side(1.7);
  for (let i = 0; i < n; i++) { const t = i / SR, s = 0.55 * Math.sin(TAU * 1.6 * t); L[i] *= 1 + s; Rr[i] *= 1 - s; }
  return fade2(norm2(L, Rr), 0.01, 0.03);
}

// ───────────── 4b. New for BÚN ĐẬU: sáo trúc, đàn nguyệt, phách, gong, reed, Hanoi street, fry / knife / whisk foley, comedy ─────────────

/* Sáo trúc (bamboo flute) — the lead voice of this film.
 * Pitch-tracked additive tone (soft 2nd/3rd/4th harmonics, purer in the upper register),
 * breath noise band-passed around the fundamental, airy hiss and an attack "chiff".
 * Ornaments: bendFrom (vuốt: slide into the note), grace (láy: a quick neighbour note first),
 * mordent (main-upper-main flick), trill (láy rền), endBend, vib (pitch vibrato, delayed)
 * with matching breath tremolo. */
function sao(midi, dur, o = {}) {
  const R = rngFor('sao' + (o.seed ?? '') + ':' + midi + ':' + dur);
  const bendFrom = o.bendFrom || 0, bendTime = o.bendTime ?? Math.min(0.1, dur * 0.35);
  const grace = o.grace || 0, graceLen = o.graceLen ?? 0.045;
  const mordent = o.mordent || 0, mordLen = o.mordLen ?? 0.055;
  const trill = o.trill || 0, trillRate = o.trillRate ?? 12, trillAt = o.trillAt ?? 0.08, trillEnd = o.trillEnd ?? dur;
  const endBend = o.endBend || 0, endBendTime = o.endBendTime ?? Math.min(0.2, dur * 0.4);
  const vibDepth = o.vib ?? (dur >= 0.4 ? 0.22 : 0), vibRate = o.vibRate ?? 5.3;
  const attack = o.attack ?? 0.028, release = o.release ?? 0.07, breath = o.breath ?? 1, cents = (o.cents || 0) / 100;
  const g0 = grace ? graceLen : 0;
  const st = (t) => {
    let v = cents;
    if (grace) v += grace * (1 - smooth((t - graceLen + 0.012) / 0.012));
    if (bendFrom) { const u = clamp((t - g0) / bendTime, 0, 1); v += bendFrom * (1 - u) * (1 - u) * (1 + u); }
    if (mordent) { const m0 = g0 + 0.035; v += mordent * smooth((t - m0) / 0.008) * (1 - smooth((t - m0 - mordLen) / 0.008)); }
    if (trill && t >= trillAt && t < trillEnd) v += trill * smooth((t - trillAt) / 0.02) * (1 - smooth((t - trillEnd + 0.03) / 0.03)) * (0.5 + 0.5 * Math.tanh(5 * Math.sin(TAU * trillRate * (t - trillAt) - Math.PI / 2)));
    if (endBend) v += endBend * smooth((t - (dur - endBendTime)) / endBendTime);
    if (vibDepth) v += vibDepth * smooth((t - 0.12) / Math.max(0.2, dur * 0.5)) * Math.sin(TAU * vibRate * t);
    return v;
  };
  const n = secs(dur + release), y = new Float32Array(n), fa = new Float32Array(n), env = new Float32Array(n);
  const hi = clamp((midi - 72) / 18, 0, 1);
  const h2 = 0.2 * (1 - 0.5 * hi), h3 = 0.1 * (1 - 0.6 * hi), h4 = 0.035 * (1 - hi);
  const vd = vibDepth > 0 ? 1 : 0;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = m2f(midi + st(t));
    fa[i] = f; ph += f / SR; ph -= Math.floor(ph);
    let e = t < attack ? Math.pow(t / attack, 1.4) : 1;
    e *= 0.82 + 0.18 * Math.exp(-t / 0.18);                                   // breath accent, then settle
    e *= 1 - 0.1 * vd * smooth((t - 0.12) / 0.4) * (0.5 + 0.5 * Math.sin(TAU * vibRate * t + 1.2));
    if (t > dur) e *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    env[i] = e;
    const p = TAU * ph;
    y[i] = (Math.sin(p) + h2 * Math.sin(2 * p) + h3 * Math.sin(3 * p) + h4 * Math.sin(4 * p)) * e;
  }
  const nz = noise(n, R);
  const tb = norm(filt(nz, 'bp', (t) => fa[Math.min(n - 1, (t * SR) | 0)], 7));   // tonal breath
  const air = norm(filt(nz, 'hp', 3200, 0.7));
  const fl = flutter(R, n, 22);
  for (let i = 0; i < n; i++) {
    const t = i / SR, ch = Math.exp(-t / 0.03);
    y[i] += (tb[i] * 0.09 * (0.7 + 0.3 * fl[i]) + air[i] * (0.02 + 0.07 * ch)) * breath * env[i];
  }
  return fadeEdges(norm(filt(y, 'lp', 9000, 0.7)), 0.002, 0.008);
}

/* Bendable waveguide string (from bún mắm's đàn kìm).
 * o.nguyet = true -> đàn nguyệt voicing for this film: brighter plectrum, near-bridge pick,
 *   shorter ring, lifted 1.5 k / 3.6 k formants, no default vibrato (second voice, tremolo).
 * o.tranh = true  -> softer, rounder đàn tranh voicing (for pressed/bent tranh notes).
 * Ornaments: bendFrom, nhan (press-bend up and back), endBend, vib, trem (đánh vê re-picks). */
function kim(midi, dur, o = {}) {
  const R = rngFor('kim' + (o.seed ?? '') + ':' + midi + ':' + dur);
  const isTr = !!o.tranh, isNg = !!o.nguyet;
  const bendFrom = o.bendFrom || 0, bendTime = o.bendTime ?? Math.min(0.12, dur * 0.35);
  const nhan = o.nhan || 0, nhanAt = o.nhanAt ?? 0.3, nhanLen = o.nhanLen ?? Math.min(0.22, dur * 0.45);
  const endBend = o.endBend || 0, endBendTime = o.endBendTime ?? Math.min(0.2, dur * 0.4);
  const vibDepth = o.vib ?? (!isNg && dur >= 0.6 ? 0.2 : 0), vibRate = o.vibRate ?? 5.6;
  const trem = o.trem || 0, cents = (o.cents || 0) / 100;
  const t60 = o.t60 ?? (isTr ? 2.6 : isNg ? 1.0 : 1.3), release = o.release ?? 0.09;
  const s = isTr ? 0.62 : isNg ? 0.85 : 0.78;          // loop filter s·x[n] + (1-s)·x[n-1], group delay (1-s)
  const n = secs(dur + release);
  const st = (t) => {
    let v = cents;
    if (bendFrom) { const u = clamp(t / bendTime, 0, 1); v += bendFrom * (1 - u) * (1 - u) * (1 + u); }
    if (nhan) { const a = dur * nhanAt; v += nhan * smooth((t - a) / (nhanLen * 0.45)) * (1 - smooth((t - a - nhanLen * 0.55) / (nhanLen * 0.45))); }
    if (endBend) v += endBend * smooth((t - (dur - endBendTime)) / endBendTime);
    if (vibDepth) v += vibDepth * smooth((t - 0.15) / Math.max(0.2, dur * 0.6)) * Math.sin(TAU * vibRate * t);
    return v;
  };
  const exc = new Float32Array(n);
  const picks = [[0, o.noPick ? 0.3 : 1]];
  if (trem) for (let t = 1 / trem; t < dur - 0.04; t += 1 / trem) picks.push([t + (R() - 0.5) * 0.004, 0.5 + 0.25 * R()]);
  const bright = o.bright ?? (isTr ? 0.45 : isNg ? 0.9 : 0.8), pos = isTr ? 0.22 : isNg ? 0.1 : 0.12;
  for (const [tp, a] of picks) {
    const P = SR / m2f(midi + st(tp)), Lx = Math.max(4, Math.round(P)), q = Math.max(1, Math.round(pos * P));
    const e = new Float32Array(Lx + q); let lp = 0;
    for (let k = 0; k < Lx; k++) { lp += bright * ((R() * 2 - 1) - lp); e[k] = lp * (1 - k / Lx); }
    e[0] += isTr ? 0.25 : 0.7;
    for (let k = Lx + q - 1; k >= q; k--) e[k] -= e[k - q];
    addInto(exc, e, Math.max(0, Math.round(tp * SR)), a);
  }
  const M = 8192, mask = M - 1, buf = new Float32Array(M); let w = 0;
  const y = new Float32Array(n);
  let D = 0, g = 0;
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) { const f = m2f(midi + st(i / SR)); D = clamp(SR / f - (1 - s), 3, M - 4); g = Math.pow(0.001, 1 / (t60 * f)); }
    const Di = Math.floor(D), fr = D - Di;
    const x0 = buf[(w - Di) & mask], x1 = buf[(w - Di - 1) & mask], x2 = buf[(w - Di - 2) & mask];
    const a = x0 + (x1 - x0) * fr, b = x1 + (x2 - x1) * fr;
    const v = exc[i] + g * (s * a + (1 - s) * b);
    buf[w] = v; w = (w + 1) & mask; y[i] = v;
  }
  let out = filt(y, 'hp', isTr ? 90 : 140, 0.7);
  if (isTr) out = filt(out, 'peak', 900, 1.2, 3);
  else if (isNg) { out = filt(out, 'peak', 1550, 1.5, 5); out = filt(out, 'peak', 3600, 2.2, 4); out = filt(out, 'peak', 280, 1.2, 1.5); out = filt(out, 'lp', 10000, 0.7); }
  else { out = filt(out, 'peak', 1250, 1.6, 5); out = filt(out, 'peak', 2900, 2.2, 3); out = filt(out, 'peak', 320, 1.2, 2.5); out = filt(out, 'lp', 8500, 0.7); }
  for (let i = 0; i < n; i++) { const t = i / SR; if (t > dur) out[i] *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1)); }
  return fadeEdges(norm(out), 0.0005, 0.01);
}

/* phách: two bamboo sticks on a wooden block — sharp, dry, high click (acc = flam with the second stick) */
function phach(R, acc = false) {
  const f = acc ? 2150 : 2450 + R() * 90;
  const y = modal([[f, 0.016, 1], [f * 1.71, 0.009, 0.55], [f * 2.63, 0.005, 0.3], [f * 0.48, 0.02, 0.25]], 0.09);
  addInto(y, burst(R, 0.005, 'hp', 3500, 0.7, 0.0007), 0, 0.5);
  if (acc) addInto(y, modal([[f * 1.03, 0.012, 0.6], [f * 1.74, 0.007, 0.3]], 0.06), secs(0.011), 0.55);
  return fadeEdges(norm(y), 0.0002, 0.01);
}

/* gong-like accent: inharmonic plate partials, upper partials bloom after the strike, slow beating (stereo) */
function gong(R, dur = 3.0, f = 180) {
  const n = secs(dur);
  const parts = [[1, 1.9, 1], [1.49, 1.4, 0.5], [2.02, 1.1, 0.55], [2.7, 0.8, 0.4], [3.41, 0.6, 0.32], [4.2, 0.42, 0.24], [5.35, 0.3, 0.17], [6.95, 0.2, 0.11]];
  const mk = () => {
    const y = new Float32Array(n);
    for (const [r, d, a] of parts) {
      const fr = f * r * (1 + (R() - 0.5) * 0.006), p = R() * TAU, w = TAU * fr / SR, bw = TAU * (0.8 + R() * 2.2), sw = r > 2 ? 0.04 : 0.002;
      for (let i = 0; i < n; i++) { const t = i / SR; y[i] += a * Math.sin(w * i + p) * (1 - Math.exp(-t / sw)) * Math.exp(-t / d) * (0.85 + 0.15 * Math.sin(bw * t)); }
    }
    addInto(y, norm(burst(R, 0.08, 'lp', 700, 0.7, 0.015)), 0, 0.6);   // soft padded mallet
    return y;
  };
  return fade2(norm2(mk(), mk()), 0.001, 0.3);
}

/* double-reed (bassoon / muted-brass) voice for comic sounds: band-limited reed wavetable
 * through vocal-ish formants, optional moving low-pass ("plunger"), pitch fn bend(t) */
const TAB_REED = makeTable(Array.from({ length: 28 }, (_, h) => (1 / Math.pow(h + 1, 0.85)) * (h === 0 ? 0.6 : h % 2 ? 1.0 : 0.8)));
function reed(midi, dur, o = {}) {
  const rel = o.release ?? 0.08, n = secs(dur + rel), src = new Float32Array(n);
  const bend = o.bend || (() => 0), vibD = o.vib ?? 0, vibR = o.vibRate ?? 6, att = o.attack ?? 0.02;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const s = bend(t) + vibD * smooth((t - 0.12) / 0.3) * Math.sin(TAU * vibR * t);
    ph += m2f(midi + s) / SR; ph -= Math.floor(ph);
    let e = smooth(t / att);
    if (t > dur) e *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / rel, 0, 1));
    src[i] = tabRead(TAB_REED, ph) * e * (1 + 0.04 * Math.sin(TAU * 23 * t));
  }
  const y = new Float32Array(n);
  for (const [f, q, g] of (o.formants || [[460, 2.2, 1], [1150, 3.5, 0.45], [2500, 4, 0.15]])) addInto(y, filt(src, 'bp', f, q), 0, g);
  addInto(y, src, 0, o.dry ?? 0.1);
  const out = o.lp ? filt(y, 'lp', o.lp, o.lpQ ?? 2) : y;
  return fadeEdges(norm(out), 0.002, 0.02);
}
/* comic low bassoon "bwomp" (stool sags): drooping pitch, quick "bw-" opening then "-omp" closing */
function bwomp() {
  return reed(40, 0.42, { bend: (t) => 1.5 - 5 * smooth(t / 0.4), lp: (t) => 220 + 1500 * smooth(t / 0.035) * (1 - 0.8 * smooth((t - 0.05) / 0.3)), lpQ: 2.5, attack: 0.012, release: 0.1, dry: 0.35 });
}
/* two drooping "wah-wah" notes (muted brass through a plunger), second note at +0.4 s */
function wahWah() {
  const notes = [[0, 62, 0.3, (t) => -0.6 * smooth((t - 0.18) / 0.12), 0], [0.4, 60, 0.95, (t) => -2.2 * smooth((t - 0.3) / 0.6), 0.5]];
  const n = secs(1.6), y = new Float32Array(n);
  for (const [t0, m, d, b, vb] of notes) addInto(y, reed(m, d, { bend: b, vib: vb, vibRate: 6.5, attack: 0.025, release: 0.1, formants: [[560, 2, 1], [1150, 3, 0.6], [2500, 4, 0.25]], dry: 0.2 }), secs(t0), 1);
  const open = (t) => { let v = 0; for (const [t0, , d] of notes) { const u = t - t0; if (u >= 0) v = Math.max(v, smooth(u / 0.06) * (u < d ? 1 - 0.7 * smooth((u - 0.08) / (d * 0.9)) : 0.3 * Math.exp(-(u - d) / 0.1))); } return v; };
  return fadeEdges(norm(filt(y, 'lp', (t) => 350 + 2400 * open(t), 3.0)), 0.003, 0.05);
}
/* comic rising slide whistle */
function slideWhistle(R, dur, f0, f1) {
  const n = secs(dur + 0.06), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = clamp(t / dur, 0, 1);
    const f = expi(f0, f1, Math.pow(u, 1.3)) * (1 + 0.012 * smooth((u - 0.6) / 0.3) * Math.sin(TAU * 7 * t));
    ph += f / SR; ph -= Math.floor(ph);
    let e = smooth(t / 0.04) * (0.65 + 0.35 * u);
    if (t > dur) e *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / 0.06, 0, 1));
    y[i] = (Math.sin(TAU * ph) + 0.08 * Math.sin(2 * TAU * ph)) * e;
  }
  const air = filt(noise(n, R), 'hp', 3000, 0.7);
  for (let i = 0; i < n; i++) y[i] += air[i] * 0.05 * smooth(i / SR / 0.04) * (i / SR < dur ? 1 : 0);
  return fadeEdges(norm(y), 0.004, 0.01);
}

/* distant street-vendor call: one sung open vowel ("ơ" gliding to "a"), no consonants, so it
 * reads as a voice far down the street but never as words; formant synthesis, low-passed by distance */
function vendorCall(R, o = {}) {
  const dur = o.dur ?? 1.2, n = secs(dur + 0.1), src = new Float32Array(n);
  const pc = o.pitch ?? [[0, 294], [0.12, 392], [0.6, 392], [0.72, 440], [0.86, 392], [dur, 330]];
  const ac = [[0, 0], [0.07, 1], [dur * 0.8, 0.85], [dur, 0]];
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = pw(pc, t) * (1 + 0.014 * smooth((t - 0.25) / 0.3) * Math.sin(TAU * 5.6 * t));
    ph += f / SR; ph -= Math.floor(ph);
    let s = 0; for (let h = 1; h <= 12; h++) s += Math.sin(TAU * h * ph) / Math.pow(h, 1.15);
    src[i] = (s + 0.15 * (R() - 0.5)) * pw(ac, t);
  }
  const vow = (a, b) => (t) => a + (b - a) * smooth((t - 0.15) / 0.45);
  const y = new Float32Array(n);
  addInto(y, filt(src, 'bp', vow(560, 850), 5), 0, 1);
  addInto(y, filt(src, 'bp', vow(1300, 1250), 7), 0, 0.55);
  addInto(y, filt(src, 'bp', vow(2650, 2900), 9), 0, 0.2);
  return fadeEdges(norm(filt(y, 'lp', 2800, 0.7)), 0.01, 0.05);
}

/* light wind in the bàng / tamarind leaves: gusty low wind body + gust-driven leaf rustle (stereo) */
function windLeaves(R, dur) {
  const n = secs(dur), p1 = R() * TAU, p2 = R() * TAU;
  const g = (t) => clamp(0.5 + 0.3 * Math.sin(TAU * 0.07 * t + p1) + 0.2 * Math.sin(TAU * 0.19 * t + p2), 0, 1);
  const mk = (off) => {
    const w = norm(filt(filt(noise(n, R), 'bp', (t) => 380 + 520 * g(t + off), 0.7), 'lp', 1600, 0.7));
    const lv = norm(crackle(R, dur, (t) => 40 + 420 * Math.pow(g(t + off), 2), (t) => 0.3 + 0.7 * g(t + off), 3000, 9500));
    const sh = norm(filt(noise(n, R), 'bp', 6000, 0.8));
    for (let i = 0; i < n; i++) { const gg = g(i / SR + off); w[i] = w[i] * 0.45 * (0.25 + 0.75 * gg) + lv[i] * 0.5 + sh[i] * 0.06 * gg; }
    return w;
  };
  return fade2(norm2(mk(0), mk(0.8)), 0.5, 0.5);
}

/* banana leaf slapped onto the bamboo tray: "phạch" */
function leafSlap(R) {
  const n = secs(0.45), y = new Float32Array(n);
  addInto(y, norm(burst(R, 0.04, 'bp', 1800, 0.8, 0.007, 0.0005)), 0, 1);
  addInto(y, norm(burst(R, 0.03, 'hp', 3500, 0.7, 0.004)), 0, 0.5);
  addInto(y, modal([[210, 0.03, 1], [520, 0.02, 0.4]], 0.12, 0.0008), 0, 0.5);
  addInto(y, norm(crackle(R, 0.25, (t) => 900 * Math.exp(-t / 0.06), (t) => Math.exp(-t / 0.08), 2500, 8000)), secs(0.004), 0.4);
  return fadeEdges(norm(y), 0.0004, 0.03);
}

/* deep-fry bed: dense oil-bubble crackle, high hiss, low bubbling, fat spits (stereo) */
function fryBed(R, dur) {
  const n = secs(dur);
  const mk = () => {
    const hs = norm(filt(noise(n, R), 'hp', 4800, 0.7)), fl = flutter(R, n, 9);
    const cr = norm(crackle(R, dur, (t) => 480 + 160 * Math.sin(TAU * 0.7 * t), () => 1, 2200, 9500));
    const bb = norm(filt(noise(n, R), 'bp', 700, 1.0)), fl2 = flutter(R, n, 30);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = hs[i] * 0.22 * (0.6 + 0.4 * fl[i]) + cr[i] * 0.6 + bb[i] * 0.07 * fl2[i];
    let t = 0.03;
    while (t < dur - 0.05) { addInto(y, burst(R, 0.012, 'bp', 1200 + R() * 2800, 1.3, 0.001 + R() * 0.002), secs(t), 0.25 + 0.4 * R()); t += 0.04 + R() * 0.22; }
    return y;
  };
  return fade2(norm2(mk(), mk()), 0.05, 0.2);
}
/* tofu cube dropped into hot oil: a dry plop, then an aggressive sizzle explosion settling down (stereo) */
function fryBurst(R, dur = 0.85, o = {}) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const withPlop = o.plop !== false, t0 = withPlop ? 0.012 : 0;
  if (withPlop) addPan(L, Rr, plop(R, 280, 120, 0.11, 0.6), 0, 0.5, 0);
  for (const side of [L, Rr]) {
    const hs = norm(filt(noise(n, R), 'hp', 3000, 0.7)), md = norm(filt(noise(n, R), 'bp', 2100, 0.6));
    const cr = norm(crackle(R, dur, (t) => 250 + 3300 * Math.exp(-t / 0.16), (t) => 0.45 + 0.55 * Math.exp(-t / 0.22), 1800, 9500));
    for (let i = 0; i < n; i++) {
      const t = i / SR - t0; if (t < 0) continue;
      const e = smooth(t / 0.008) * smooth((dur - t0 - t) / 0.3);
      side[i] += (hs[i] * 0.5 * (0.3 + 0.7 * Math.exp(-t / 0.28)) + md[i] * 0.35 * Math.exp(-t / 0.1) + cr[i] * 0.7) * e;
    }
  }
  return fade2(norm2(L, Rr), 0.001, 0.05);
}
/* tofu flipped: light metal clink of the strainer/chopsticks + a small sizzle flare (stereo) */
function flipClink(R) {
  const n = secs(0.6), L = new Float32Array(n), Rr = new Float32Array(n);
  addPan(L, Rr, clink(R, 2350), 0, 0.5, 0.1);
  addPan(L, Rr, modal([[3900, 0.02, 1], [6100, 0.01, 0.4]], 0.06), 0, 0.2, 0.1);
  const fb = fryBurst(R, 0.5, { plop: false });
  addPan(L, Rr, fb[0], secs(0.07), 0.35, -0.4); addPan(L, Rr, fb[1], secs(0.07), 0.35, 0.4);
  return fade2(norm2(L, Rr), 0.0005, 0.03);
}
/* knife through crispy tofu: "sht" (blade sweep + skin crackle + board tap at +0.12) */
function knifeSht(R) {
  const n = secs(0.3), y = new Float32Array(n);
  const sw = filt(noise(secs(0.13), R), 'bp', (t) => expi(7000, 2600, t / 0.13), 2.0);
  for (let i = 0; i < sw.length; i++) { const t = i / SR; sw[i] *= smooth(t / 0.012) * Math.pow(1 - t / 0.13, 1.2); }
  addInto(y, norm(sw), 0, 0.8);
  addInto(y, norm(crackle(R, 0.1, (t) => 1400 * Math.exp(-t / 0.05), (t) => Math.exp(-t / 0.06), 2500, 9000)), secs(0.01), 0.45);
  addInto(y, modal([[200, 0.03, 1], [470, 0.02, 0.5], [1150, 0.01, 0.3]], 0.12), secs(0.12), 0.35);
  addInto(y, burst(R, 0.006, 'hp', 3000, 0.7, 0.001), secs(0.12), 0.25);
  return fadeEdges(norm(y), 0.001, 0.02);
}
/* spatula pressing a rice patty into the oil: metal touch, soft squish, sizzle flare */
function pressSquish(R) {
  const n = secs(0.7), y = new Float32Array(n);
  addInto(y, modal([[1850, 0.03, 1], [3050, 0.018, 0.5], [620, 0.02, 0.3]], 0.1), 0, 0.25);
  const sq = filt(noise(secs(0.18), R), 'bp', (t) => expi(450, 900, t / 0.18), 2.5);
  for (let i = 0; i < sq.length; i++) { const t = i / SR; sq[i] *= smooth(t / 0.01) * Math.exp(-t / 0.06); }
  addInto(y, norm(sq), secs(0.01), 0.55);
  const hs = filt(noise(n, R), 'hp', 3400, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR - 0.02; hs[i] *= t < 0 ? 0 : smooth(t / 0.04) * Math.exp(-t / 0.2); }
  addInto(y, norm(hs), 0, 0.6);
  addInto(y, norm(crackle(R, 0.6, (t) => 1400 * Math.exp(-t / 0.15) + 80, (t) => Math.exp(-t / 0.2), 2000, 9000)), secs(0.02), 0.5);
  return fadeEdges(norm(y), 0.001, 0.05);
}
/* knife chop on a wooden board (boiled pork): short blade whisper, impact lands at +0.03 s */
const CHOP_PRE = 0.03;
function boardChop(R) {
  const n = secs(0.35), y = new Float32Array(n);
  const wh = filt(noise(secs(CHOP_PRE + 0.005), R), 'bp', (t) => expi(3000, 6000, t / CHOP_PRE), 1.5);
  for (let i = 0; i < wh.length; i++) { const t = i / SR; wh[i] *= Math.pow(clamp(t / CHOP_PRE, 0, 1), 2); }
  addInto(y, norm(wh), 0, 0.18);
  addInto(y, modal([[185, 0.055, 1], [430, 0.035, 0.65], [980, 0.018, 0.4], [2150, 0.008, 0.25]], 0.3, 0.0005), secs(CHOP_PRE), 1);
  addInto(y, burst(R, 0.008, 'hp', 2500, 0.7, 0.0012), secs(CHOP_PRE), 0.4);
  addInto(y, norm(burst(R, 0.04, 'lp', 1400, 0.7, 0.008)), secs(CHOP_PRE), 0.35);
  return fadeEdges(norm(y), 0.001, 0.03);
}
/* soft wet "thup": knife through a pressed rice-noodle sheet onto the board */
function wetThup(R) {
  const n = secs(0.35), y = new Float32Array(n);
  addInto(y, modal([[140, 0.045, 1], [310, 0.03, 0.5], [720, 0.012, 0.2]], 0.25, 0.002), 0, 0.9);
  const sq = filt(noise(secs(0.12), R), 'bp', (t) => expi(600, 1200, t / 0.12), 2.2);
  for (let i = 0; i < sq.length; i++) { const t = i / SR; sq[i] *= smooth(t / 0.004) * Math.exp(-t / 0.035); }
  addInto(y, norm(sq), 0, 0.5);
  addInto(y, burst(R, 0.04, 'lp', 900, 0.7, 0.01), 0, 0.4);
  return fadeEdges(norm(filt(y, 'lp', 3500, 0.7)), 0.002, 0.03);
}
/* cartoon "pop" (herbs popping into the basket), ends on pitch fTarget */
function popAccent(R, fTarget = 1175) {
  const n = secs(0.14), y = new Float32Array(n), f = fTarget / 2.2;
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += f * (0.5 + 1.7 * (1 - Math.exp(-t / 0.012))) / SR; y[i] = Math.sin(TAU * ph) * smooth(t / 0.0015) * Math.exp(-t / 0.03); }
  addInto(y, burst(R, 0.004, 'hp', 2500, 0.7, 0.0006), 0, 0.35);
  return fadeEdges(norm(y), 0.0003, 0.01);
}
/* thick purple shrimp paste poured: viscous stream, fat slow gloopy bubbles, final plop (stereo) */
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
function bowlClack(R, f = 2900) {
  const y = modal([[f, 0.035, 1], [f * 1.76, 0.018, 0.5], [f * 0.58, 0.03, 0.35], [f * 2.9, 0.008, 0.25]], 0.12);
  addInto(y, modal([[1350, 0.006, 1]], 0.03), 0, 0.3);
  addInto(y, burst(R, 0.004, 'hp', 3500, 0.7, 0.0006), 0, 0.4);
  return fadeEdges(norm(y), 0.0002, 0.01);
}
/* whipped shrimp-paste foam: crackle + tiny bubbles, density building (stereo) */
function foam(R, dur) {
  const env = (t) => smooth(t / 0.3) * smooth((dur - t) / 0.12) * (0.3 + 0.7 * Math.pow(t / dur, 1.2));
  const mk = () => {
    const y = norm(crackle(R, dur, (t) => 120 + 1100 * Math.pow(t / dur, 1.4), env, 3000, 10000));
    let t = 0.02;
    while (t < dur - 0.03) { addInto(y, bubble(1600 + R() * 3000, 0.008 + R() * 0.01, 0.6, 0.3), secs(t), 0.35 * env(t) * R()); t += 1 / (30 + 220 * (t / dur)); }
    return y;
  };
  return fade2(norm2(mk(), mk()), 0.01, 0.03);
}
/* soft placement on the leaf-lined bamboo tray: thud + leaf crinkle + bamboo knock */
function placeSoft(R, k = 0) {
  const n = secs(0.4), y = new Float32Array(n);
  addInto(y, plop(R, 190 + 30 * k, 85, 0.14, 0.45), 0, 0.8);
  addInto(y, norm(crackle(R, 0.08, (t) => 900 * Math.exp(-t / 0.03), (t) => Math.exp(-t / 0.04), 2500, 8000)), secs(0.002), 0.35);
  addInto(y, modal([[520, 0.03, 1], [1240, 0.015, 0.4]], 0.12), 0, 0.2);
  return fadeEdges(norm(y), 0.001, 0.03);
}
/* big wet SPLAT (shrimp paste explodes on his face): thump, slap, squelch, droplet spray (stereo) */
function splat(R) {
  const n = secs(1.0), L = new Float32Array(n), Rr = new Float32Array(n);
  const th = new Float32Array(secs(0.35)); let ph = 0;
  for (let i = 0; i < th.length; i++) { const t = i / SR; ph += (70 + 140 * Math.exp(-t / 0.02)) / SR; th[i] = Math.sin(TAU * ph) * smooth(t / 0.0015) * Math.exp(-t / 0.07); }
  addPan(L, Rr, th, 0, 0.8, 0);
  addPan(L, Rr, norm(burst(R, 0.06, 'lp', 3200, 0.7, 0.012, 0.0008)), 0, 1.0, -0.2);
  addPan(L, Rr, norm(burst(R, 0.06, 'lp', 3000, 0.7, 0.012, 0.0008)), secs(0.002), 1.0, 0.2);
  const sp = filt(noise(secs(0.5), R), 'bp', (t) => expi(1800, 900, t / 0.5), 1.0);
  for (let i = 0; i < sp.length; i++) { const t = i / SR; sp[i] *= smooth(t / 0.003) * Math.exp(-t / 0.09) * (0.7 + 0.3 * Math.sin(TAU * 35 * t)); }
  addPan(L, Rr, norm(sp), 0, 0.7, 0);
  for (let k = 0; k < 26; k++) addPan(L, Rr, bubble(700 + R() * 2400, 0.02 + R() * 0.035, 1.1, 0.3), secs(0.03 + Math.pow(R(), 1.5) * 0.6), 0.25 * (0.4 + 0.6 * R()), (R() - 0.5) * 1.8);
  for (let k = 0; k < 20; k++) addPan(L, Rr, burst(R, 0.006, 'bp', 1500 + R() * 3500, 1.2, 0.0015), secs(0.05 + R() * 0.4), 0.3 * R(), (R() - 0.5) * 1.8);
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(1.5 * L[i]); Rr[i] = Math.tanh(1.5 * Rr[i]); }
  return fade2(norm2(L, Rr), 0.0005, 0.06);
}
/* cloth wiping a face: rising fabric swipe */
function clothSwipe(R, dur = 0.34) {
  const n = secs(dur), x = noise(n, R);
  const a = filt(x, 'bp', (t) => expi(1100, 3200, t / dur), 1.2), lo = filt(x, 'bp', 500, 0.8), fl = flutter(R, n, 70);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] = (a[i] * (0.5 + 0.5 * fl[i]) + 0.3 * lo[i]) * Math.pow(Math.sin(Math.PI * u), 1.2); }
  return fadeEdges(norm(y), 0.005, 0.02);
}
/* soft heartbeat lub-dub, saturated a little so its upper harmonics read at a low level */
function softHeart() {
  const n = secs(0.42), y = new Float32Array(n);
  const beat = (t0, fs, fe, dec, amp) => {
    let ph = 0;
    for (let i = secs(t0); i < n; i++) { const t = i / SR - t0; ph += (fe + (fs - fe) * Math.exp(-t / 0.025)) / SR; y[i] += amp * Math.sin(TAU * ph) * smooth(t / 0.004) * Math.exp(-t / dec); }
  };
  beat(0, 150, 78, 0.05, 1); beat(0.16, 170, 88, 0.04, 0.7);
  for (let i = 0; i < n; i++) y[i] = Math.tanh(3.0 * y[i]);
  return fadeEdges(norm(filt(filt(y, 'lp', 1100, 0.7), 'hp', 70, 0.7)), 0.001, 0.04);
}
/* a breath in through the mouth (anticipation before the bite), growing to the end */
function inhale(R, dur = 0.42) {
  const n = secs(dur), x = noise(n, R);
  const f1 = filt(x, 'bp', (t) => expi(800, 1150, t / dur), 2.2), f2 = filt(x, 'bp', (t) => expi(1700, 2300, t / dur), 3), air = filt(x, 'hp', 3000, 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] = (f1[i] + 0.6 * f2[i] + 0.3 * air[i]) * Math.pow(u, 1.4) * smooth((1 - u) / 0.06); }
  return fadeEdges(norm(y), 0.005, 0.005);
}
/* the huge crispy "RỘP": several crust breaks in quick succession + crunch body + low thump (stereo) */
function ropCrunch(R) {
  const n = secs(0.9), L = new Float32Array(n), Rr = new Float32Array(n);
  for (const [t0, a] of [[0, 1], [0.03, 0.75], [0.065, 0.55], [0.11, 0.35]]) {
    addPan(L, Rr, norm(crackle(R, 0.09, (t) => 5000 * Math.exp(-t / 0.025), (t) => Math.exp(-t / 0.03), 1200, 9500)), secs(t0), a * 0.9, (R() - 0.5) * 0.5);
    addPan(L, Rr, norm(burst(R, 0.05, 'bp', 900 + R() * 700, 0.9, 0.012)), secs(t0), a * 0.6, (R() - 0.5) * 0.3);
  }
  const th = new Float32Array(secs(0.6)); let ph = 0;
  for (let i = 0; i < th.length; i++) { const t = i / SR; ph += (55 + 70 * Math.exp(-t / 0.03)) / SR; th[i] = Math.sin(TAU * ph) * smooth(t / 0.002) * Math.exp(-t / 0.14); }
  addPan(L, Rr, th, 0, 0.6, 0);
  addPan(L, Rr, norm(burst(R, 0.12, 'lp', 600, 0.7, 0.025)), 0, 0.3, 0);
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(1.4 * L[i]); Rr[i] = Math.tanh(1.4 * Rr[i]); }
  return fade2(norm2(L, Rr), 0.0005, 0.08);
}
/* a smaller happy bite of crispy tofu */
function crunch(R, size = 1) {
  const n = secs(0.35), y = new Float32Array(n);
  for (const [t0, a] of [[0, 1], [0.028, 0.6], [0.06, 0.35]]) {
    addInto(y, norm(crackle(R, 0.07, (t) => 3200 * Math.exp(-t / 0.02), (t) => Math.exp(-t / 0.025), 1400, 9000)), secs(t0), a);
    addInto(y, norm(burst(R, 0.04, 'bp', 1000 + R() * 600, 0.9, 0.01)), secs(t0), a * 0.45);
  }
  addInto(y, modal([[95 / size, 0.05, 1], [210, 0.03, 0.4]], 0.2, 0.001), 0, 0.45 * size);
  norm(y); for (let i = 0; i < n; i++) y[i] = Math.tanh(2.2 * y[i]);   // round off the sharpest crackle peaks
  return fadeEdges(norm(y), 0.0005, 0.03);
}
/* bamboo chopsticks tapping together */
function chopClick(R) {
  const y = modal([[3300 + R() * 300, 0.01, 1], [5400, 0.005, 0.4], [1750, 0.012, 0.35]], 0.05);
  addInto(y, burst(R, 0.003, 'hp', 4000, 0.7, 0.0005), 0, 0.4);
  return fadeEdges(norm(y), 0.0002, 0.008);
}
// ── ported from the cà phê / bánh mì engine ──
function clap(R) {
  const n = secs(0.3), x = new Float32Array(n);
  for (const [off, a] of [[0, 0.8], [0.009, 0.9], [0.018, 1.0]]) addInto(x, burst(R, 0.02, null, 0, 1, 0.0035), secs(off), a);
  addInto(x, burst(R, 0.28, null, 0, 1, 0.07), secs(0.02), 0.55);
  let y = filt(filt(x, 'bp', 1150, 0.8), 'hp', 450, 0.7);
  y = norm(y);
  const body = new Float32Array(secs(0.12));
  for (let i = 0; i < body.length; i++) { const t = i / SR; body[i] = Math.sin(TAU * 195 * t) * Math.exp(-t / 0.04); }
  addInto(y, body, 0, 0.25);
  return fadeEdges(norm(y), 0.0005, 0.03);
}
function hat(R, decay = 0.03) {
  const x = burst(R, decay * 4, 'hp', 7200, 0.7, decay);
  return norm(filt(x, 'peak', 10500, 1, 4));
}
/* shaker: soft-attack band-passed noise grain */
function shaker(R, acc = false) {
  const x = burst(R, 0.11, 'bp', 6800, 0.9, acc ? 0.03 : 0.018, acc ? 0.006 : 0.004);
  return norm(filt(x, 'hp', 3500, 0.7));
}
/* charcoal fire bed (from banhmi fireBed) — stereo */
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
function wokToss(R, dur = 0.65) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  addPan(L, Rr, whoosh(R, 0.3, 500, 2000, 800, 0.5, 1.0), 0, 0.22, -0.2);
  const land = 0.1;
  for (let k = 0; k < 130; k++) {
    const t = land + Math.pow(R(), 1.7) * 0.45;
    const a = (0.25 + 0.75 * R()) * Math.exp(-(t - land) / 0.16);
    addPan(L, Rr, burst(R, 0.006, 'bp', 1500 + R() * 4500, 2.0, 0.0004 + R() * 0.0012), secs(t), a, (R() - 0.5) * 1.4);
  }
  const ring = modal([[318, 0.25, 1], [745, 0.18, 0.6], [1305, 0.12, 0.45], [2080, 0.08, 0.3], [2970, 0.05, 0.2]], 0.55);
  addPan(L, Rr, ring, secs(land), 0.12, 0.1);
  addPan(L, Rr, burst(R, 0.12, 'bp', 1300, 2, 0.03, 0.01), secs(0.02), 0.25, 0);
  return fade2(norm2(L, Rr), 0.003, 0.03);
}
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
function metalScrape(R, dur) {
  const n = secs(dur), x = new Float32Array(n);
  let t = 0;
  while (t < dur) { const i = secs(t); if (i < n) x[i] += 0.5 + 0.5 * R(); t += 1 / ((170 + 60 * Math.sin(TAU * 1.1 * t)) * (0.8 + 0.4 * R())); }
  const nz = noise(n, R);
  for (let i = 0; i < n; i++) x[i] += nz[i] * 0.25;
  const y = new Float32Array(n);
  for (const [f, q, g] of [[1870, 30, 1], [3010, 35, 0.7], [4490, 40, 0.5], [6230, 40, 0.3]]) addInto(y, filt(x, 'bp', f, q), 0, g);
  addInto(y, filt(nz, 'bp', 2600, 1.1), 0, 0.12);
  const out = filt(y, 'lp', 8500, 0.7);
  for (let i = 0; i < n; i++) { const tt = i / SR, u = tt / dur; out[i] *= Math.pow(Math.sin(Math.PI * u), 0.8) * (0.8 + 0.2 * Math.sin(TAU * 3 * tt)); }
  return fadeEdges(norm(out), 0.01, 0.03);
}
/* ice cracking crackles (stereo) */
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
function heartbeat() {
  const n = secs(0.48), y = new Float32Array(n);
  const beat = (t0, fs, fe, dec, amp) => {
    let ph = 0;
    for (let i = secs(t0); i < n; i++) { const t = i / SR - t0; ph += (fe + (fs - fe) * Math.exp(-t / 0.03)) / SR; y[i] += amp * Math.sin(TAU * ph) * smooth(t / 0.006) * Math.exp(-t / dec); }
  };
  beat(0, 82, 48, 0.075, 1); beat(0.17, 96, 58, 0.055, 0.72);
  for (let i = 0; i < n; i++) y[i] = Math.tanh(2.2 * y[i]);
  return fadeEdges(norm(filt(y, 'lp', 420, 0.7)), 0.001, 0.04);
}
/* comic but tasteful hiccup: short voiced "hic" with a bubbly blip */
function hiccup(R) {
  const dur = 0.13, n = secs(dur), src = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f0 = 270 + 170 * smooth(t / 0.05);
    ph += f0 / SR; ph -= Math.floor(ph);
    let s = 0; for (let h = 1; h <= 14; h++) s += Math.sin(TAU * h * ph) / Math.pow(h, 1.2);
    src[i] = s * smooth(t / 0.003) * Math.exp(-t / 0.032);
  }
  const y = new Float32Array(n);
  for (const [f, q, g] of [[680, 5, 1], [1300, 6, 0.6], [2600, 8, 0.25]]) addInto(y, filt(src, 'bp', f, q), 0, g);
  addInto(y, burst(R, 0.02, 'bp', 2200, 1.2, 0.004), 0, 0.25);
  const out = new Float32Array(secs(0.2));
  addInto(out, norm(y), 0, 1);
  addInto(out, bubble(620, 0.06, 0.8, 0.3), secs(0.015), 0.25);
  return fadeEdges(norm(out), 0.001, 0.02);
}
/* kettle simmer bed: low rumble + gentle bubbling + hiss (stereo) */
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
function songLang(R, acc = false) {
  const f = acc ? 1180 : 1320 + R() * 40;
  const y = modal([[f, 0.035, 1], [f * 1.58, 0.018, 0.45], [f * 2.41, 0.01, 0.25], [f * 0.5, 0.04, 0.3]], 0.15);
  addInto(y, burst(R, 0.004, 'bp', 3000, 0.9, 0.0008), 0, 0.4);
  if (acc) addInto(y, modal([[f * 1.06, 0.025, 0.7], [f * 1.62, 0.012, 0.3]], 0.1), secs(0.055), 0.6);
  return fadeEdges(norm(y), 0.0002, 0.02);
}

/* erhu / bowed two-string fiddle: band-limited saw wavetable, bow noise tracking the pitch,
 * snakeskin body formants. Ornaments: bendFrom, path [[t, semis]..] (slides), endBend, wide vibrato. */
const TAB_SAW = makeTable(Array.from({ length: 18 }, (_, h) => 1 / (h + 1)));
function erhu(midi, dur, o = {}) {
  const R = rngFor('erhu' + (o.seed ?? '') + ':' + midi + ':' + dur);
  const bendFrom = o.bendFrom || 0, bendTime = o.bendTime ?? Math.min(0.16, dur * 0.35);
  const endBend = o.endBend || 0, endBendTime = o.endBendTime ?? Math.min(0.25, dur * 0.4);
  const vibDepth = o.vib ?? (dur >= 0.35 ? 0.32 : 0.08), vibRate = o.vibRate ?? 6.0;
  const attack = o.attack ?? 0.06, release = o.release ?? 0.12, path = o.path || null;
  const st = (t) => {
    let v = 0;
    if (bendFrom) { const u = clamp(t / bendTime, 0, 1); v += bendFrom * (1 - u) * (1 - u) * (1 + u); }
    if (path) v += pw(path, t);
    if (endBend) v += endBend * smooth((t - (dur - endBendTime)) / endBendTime);
    if (vibDepth) v += vibDepth * smooth((t - 0.12) / Math.max(0.2, dur * 0.5)) * Math.sin(TAU * vibRate * t);
    return v;
  };
  const n = secs(dur + release), y = new Float32Array(n), env = new Float32Array(n), fa = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = m2f(midi + st(t));
    fa[i] = f; ph += f / SR; ph -= Math.floor(ph);
    let e = smooth(t / attack) * (o.swell ? 0.65 + 0.35 * smooth(t / Math.max(0.1, dur * 0.7)) : 1);
    e *= 1 + 0.06 * Math.sin(TAU * 0.9 * t + 1.3);
    if (t > dur) e *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    env[i] = e;
    y[i] = tabRead(TAB_SAW, ph) * e;
  }
  const nz = noise(n, R);
  const bow = norm(filt(nz, 'bp', (t) => fa[Math.min(n - 1, (t * SR) | 0)] * 2, 4));
  const hiss = norm(filt(nz, 'hp', 3500, 0.7));
  for (let i = 0; i < n; i++) y[i] += (bow[i] * 0.07 + hiss[i] * 0.015) * env[i];
  let out = filt(y, 'hp', 220, 0.7);
  out = filt(out, 'peak', 520, 1.3, 6); out = filt(out, 'peak', 1150, 1.6, 4); out = filt(out, 'peak', 2700, 2.0, 3);
  out = filt(out, 'lp', 6500, 0.7);
  return fadeEdges(norm(out), 0.003, 0.01);
}

/* nonverbal cartoon voice: glottal wavetable + breath through 3 moving formants.
 * o = { dur, pitch:[[t,Hz]..], amp:[[t,a]..], f1, f2, f3 (keys), breath, vib, lp } */
const TAB_VOX = makeTable(Array.from({ length: 30 }, (_, h) => 1 / Math.pow(h + 1, 1.15)));
function vox(R, o) {
  const dur = o.dur, n = secs(dur + 0.05), src = new Float32Array(n);
  const P = o.pitch, A = o.amp ?? [[0, 0], [0.04, 1], [Math.max(0.05, dur - 0.06), 0.85], [dur, 0]];
  const F1 = o.f1 ?? [[0, 700], [dur, 700]], F2 = o.f2 ?? [[0, 1200], [dur, 1200]], F3 = o.f3 ?? [[0, 2600], [dur, 2600]];
  const br = o.breath ?? 0.18, vb = o.vib ?? 0.012;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = pw(P, t) * (1 + vb * Math.sin(TAU * 5.5 * t));
    ph += f / SR; ph -= Math.floor(ph);
    src[i] = (tabRead(TAB_VOX, ph) + br * (R() * 2 - 1)) * pw(A, t);
  }
  const y = new Float32Array(n);
  addInto(y, filt(src, 'bp', (t) => pw(F1, t), 5), 0, 1);
  addInto(y, filt(src, 'bp', (t) => pw(F2, t), 7), 0, 0.5);
  addInto(y, filt(src, 'bp', (t) => pw(F3, t), 9), 0, 0.18);
  return fadeEdges(norm(filt(y, 'lp', o.lp ?? 4200, 0.7)), 0.004, 0.03);
}
/* "ha-ha-ha" laugh: k syllables, falling pitch, amp pulses */
function laugh(R, o = {}) {
  const k = o.k ?? 5, rate = o.rate ?? 6.5, f0 = o.f0 ?? 300, dur = k / rate + 0.12;
  const amp = [[0, 0]], pitch = [];
  for (let j = 0; j < k; j++) {
    const t0 = j / rate, a = 1 - 0.1 * j;
    amp.push([t0 + 0.01, 0.05], [t0 + 0.035, a], [t0 + 0.6 / rate, a * 0.6], [t0 + 0.92 / rate, 0.03]);
    pitch.push([t0, f0 * (1.12 - 0.04 * j)], [t0 + 0.8 / rate, f0 * (1.0 - 0.04 * j)]);
  }
  amp.push([dur, 0]);
  return vox(R, { dur, pitch, amp, f1: [[0, 820], [dur, 760]], f2: [[0, 1350], [dur, 1250]], f3: [[0, 2800], [dur, 2800]], breath: 0.45, vib: 0.02 });
}

/* hand-fan (quạt nan) flap: air whump + bamboo-paper flutter */
function fanFlap(R) {
  const n = secs(0.3), y = new Float32Array(n);
  addInto(y, whoosh(R, 0.2, 260, 900, 380, 0.45, 0.9), 0, 0.9);
  addInto(y, plop(R, 130, 70, 0.1, 0.6), secs(0.07), 0.35);
  addInto(y, norm(crackle(R, 0.12, (t) => 600 * Math.exp(-t / 0.05), (t) => Math.exp(-t / 0.05), 1500, 6000)), secs(0.06), 0.25);
  return fadeEdges(norm(y), 0.003, 0.03);
}
/* flame burst "FWOOSH": low roar + swept air + crackle (stereo) */
function fwoosh(R, dur = 1.2, o = {}) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const pk = o.peakAt ?? 0.08, bell = (t) => (t < pk ? smooth(t / pk) : Math.exp(-(t - pk) / (dur * 0.32)));
  for (const side of [L, Rr]) {
    const x = noise(n, R);
    const air = filt(x, 'bp', (t) => 250 + 2600 * bell(t), 0.8);
    const roar = filt(filt(noise(n, R), 'lp', 160, 0.8), 'lp', 220, 0.7);
    const fl = flutter(R, n, 18);
    for (let i = 0; i < n; i++) { const t = i / SR, b = bell(t); side[i] = (air[i] * 0.8 * (0.6 + 0.4 * fl[i]) + roar[i] * 3.2) * b; }
    addInto(side, crackle(R, dur, (t) => 40 + 500 * bell(t), (t) => bell(t), 1500, 7000), 0, 0.5);
  }
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(1.5 * L[i]); Rr[i] = Math.tanh(1.5 * Rr[i]); }
  return fade2(norm2(L, Rr), 0.004, 0.08);
}
/* steam-whistle (kettle) for cartoon "steam from the ears" */
function steamWhistle(R, dur = 1.0, f = 1650) {
  const n = secs(dur + 0.1), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = clamp(t / dur, 0, 1);
    const ff = f * (0.93 + 0.1 * smooth(u / 0.3)) * (1 + 0.006 * Math.sin(TAU * 9 * t));
    ph += ff / SR; ph -= Math.floor(ph);
    let e = smooth(t / 0.07) * (0.8 + 0.2 * Math.sin(TAU * 13 * t));
    if (t > dur) e *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / 0.1, 0, 1));
    y[i] = (Math.sin(TAU * ph) + 0.12 * Math.sin(2 * TAU * ph)) * e;
  }
  const hs = filt(noise(n, R), 'bp', f * 1.1, 2.5);
  for (let i = 0; i < n; i++) y[i] += hs[i] * 0.6 * smooth(i / SR / 0.05) * (i / SR < dur ? 1 : Math.exp(-(i / SR - dur) / 0.04));
  return fadeEdges(norm(y), 0.003, 0.02);
}
/* stomach growl "ọc ọc": low wobbling reed through a closed-mouth filter + gurgles */
function stomachGrowl(R, dur = 1.1) {
  const y = new Float32Array(secs(dur + 0.2));
  addInto(y, reed(33, dur, { bend: (t) => 3 * Math.sin(TAU * 2.6 * t) + 2 * Math.sin(TAU * 7.3 * t) - 2 * t, vib: 0, formants: [[230, 2.5, 1], [520, 3, 0.5], [900, 4, 0.15]], lp: (t) => 380 + 260 * Math.abs(Math.sin(TAU * 2.2 * t)), lpQ: 1.5, attack: 0.08, release: 0.15, dry: 0.15 }), 0, 1);
  for (let k = 0; k < 8; k++) addInto(y, bubble(140 + R() * 220, 0.05 + R() * 0.06, 0.6, 0.35), secs(R() * dur), 0.25 + 0.2 * R());
  return fadeEdges(norm(filt(y, 'lp', 900, 0.7)), 0.01, 0.05);
}
/* street lamp switching on: relay "tschk" + sodium-ballast hum swell */
function lampOn(R) {
  const n = secs(1.2), y = new Float32Array(n);
  addInto(y, burst(R, 0.01, 'bp', 2400, 1.2, 0.0015), 0, 0.8);
  addInto(y, modal([[1900, 0.02, 0.7], [3300, 0.012, 0.4]], 0.06), secs(0.003), 0.5);
  for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / 0.2) * Math.exp(-t / 0.7); y[i] += (Math.sin(TAU * 100 * t) + 0.4 * Math.sin(TAU * 200 * t) + 0.15 * Math.sin(TAU * 300 * t)) * 0.12 * e; }
  return fadeEdges(norm(y), 0.0003, 0.05);
}
/* egg cracked on the pan rim: sharp crack + shell crumble */
function eggCrack(R) {
  const n = secs(0.25), y = new Float32Array(n);
  addInto(y, burst(R, 0.012, 'bp', 2600, 1.4, 0.002), 0, 1);
  addInto(y, modal([[1750, 0.015, 0.5], [3100, 0.008, 0.3]], 0.05), 0, 0.5);
  addInto(y, norm(crackle(R, 0.1, (t) => 1200 * Math.exp(-t / 0.03), (t) => Math.exp(-t / 0.04), 2000, 8000)), secs(0.008), 0.35);
  return fadeEdges(norm(y), 0.0002, 0.03);
}
/* whisking batter: rapid wet strokes + wire tine ticks (stereo) */
function whisk(R, dur = 1.5, rate = 8) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  for (let t = 0.01, k = 0; t < dur - 0.08; t += 1 / rate, k++) {
    const st = filt(noise(secs(0.09), R), 'bp', (u) => expi(700, 1500, u / 0.09), 2.5);
    for (let i = 0; i < st.length; i++) { const u = i / SR; st[i] *= Math.sin(Math.PI * clamp(u / 0.09, 0, 1)); }
    const p = k % 2 ? 0.25 : -0.25;
    addPan(L, Rr, st, secs(t), 0.8, p);
    addPan(L, Rr, modal([[3400 + R() * 400, 0.03, 1], [5200, 0.015, 0.4]], 0.08), secs(t + 0.04), 0.18, -p);
    addPan(L, Rr, bubble(500 + R() * 400, 0.03, 0.8, 0.3), secs(t + 0.05), 0.15, p);
  }
  return fade2(norm2(L, Rr), 0.01, 0.04);
}
/* spatula / ladle strike on a wok: bright "keng" */
function wokKeng(R, f = 1180) {
  const y = modal([[f, 0.28, 1], [f * 2.31, 0.18, 0.6], [f * 3.48, 0.12, 0.4], [f * 0.54, 0.22, 0.5], [f * 5.1, 0.06, 0.25]], 0.7);
  addInto(y, burst(R, 0.006, 'hp', 2500, 0.7, 0.0009), 0, 0.5);
  return fadeEdges(norm(y), 0.0002, 0.05);
}
/* deep-fry bed: rolling big bubbles + hiss (stereo) */
function deepFry(R, dur, rate = 40) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const hL = filt(noise(n, R), 'hp', 3800, 0.7), hR = filt(noise(n, R), 'hp', 3800, 0.7), fl = flutter(R, n, 6);
  for (let i = 0; i < n; i++) { const f = 0.5 + 0.5 * fl[i]; L[i] = hL[i] * 0.12 * f; Rr[i] = hR[i] * 0.12 * f; }
  let t = 0.01;
  while (t < dur - 0.06) {
    addPan(L, Rr, bubble(260 + R() * 700, 0.02 + R() * 0.04, 1.1, 0.3), secs(t), 0.25 + 0.4 * R(), (R() - 0.5) * 1.2);
    if (R() < 0.4) addPan(L, Rr, burst(R, 0.006, 'bp', 2500 + R() * 5000, 1.5, 0.0008), secs(t), 0.4 * R(), (R() - 0.5) * 1.3);
    t += -Math.log(1 - R() * 0.99) / rate;
  }
  norm2(L, Rr);
  for (let i = 0; i < n; i++) { const t2 = i / SR, e = smooth(t2 / 0.1) * smooth((dur - t2) / 0.25); L[i] *= e; Rr[i] *= e; }
  return [L, Rr];
}
/* far-off crowd chatter: formant-swept noise voices with syllabic gating (stereo, unintelligible) */
function chatter(R, dur, voices = 5) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  for (let v = 0; v < voices; v++) {
    const x = noise(n, R), r1 = 3 + R() * 2.5, ph1 = R() * TAU, ph2 = R() * TAU, base = 500 + R() * 300;
    const y = new Float32Array(n);
    addInto(y, filt(x, 'bp', (t) => base + 250 * Math.sin(TAU * 1.7 * t + ph1) + 150 * Math.sin(TAU * 4.1 * t + ph2), 6), 0, 1);
    addInto(y, filt(x, 'bp', (t) => base * 2.2 + 400 * Math.sin(TAU * 2.3 * t + ph2), 8), 0, 0.5);
    // talk-spurts: on ~2–4 s, pause ~1–2 s; syllables at r1 Hz
    let t = R() * 2, on = R() < 0.6;
    const gate = new Float32Array(n);
    while (t < dur) { const len = on ? 1.5 + R() * 2.5 : 0.8 + R() * 1.8; if (on) for (let i = secs(t); i < Math.min(n, secs(t + len)); i++) { const u = i / SR - t; gate[i] = smooth(u / 0.15) * smooth((len - u) / 0.2); } t += len; on = !on; }
    for (let i = 0; i < n; i++) { const t2 = i / SR, syl = Math.pow(0.5 + 0.5 * Math.sin(TAU * r1 * t2 + 3 * Math.sin(TAU * 0.6 * t2 + ph1)), 1.5); y[i] *= gate[i] * syl; }
    addPan(L, Rr, y, 0, 1, (R() - 0.5) * 1.6);
  }
  const oL = filt(filt(L, 'lp', 2200, 0.7), 'hp', 250, 0.7), oR = filt(filt(Rr, 'lp', 2200, 0.7), 'hp', 250, 0.7);
  return fade2(norm2(oL, oR), 0.3, 0.3);
}

/* ── CTA sounds ── */
/* bubbly "pop" for the LIKE heart bouncing in */
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
// ───────────────────────────── 5. Buses ─────────────────────────────
// MUSIC: dry + hall send.  SFX: dry + room send (s) + hall send (h).
const mkBus = () => ({ L: new Float32Array(N), R: new Float32Array(N), sL: new Float32Array(N), sR: new Float32Array(N), hL: new Float32Array(N), hR: new Float32Array(N) });
const MUSIC = mkBus(), SFX = mkBus(), AMB = mkBus();   // AMB = ambience beds: mixed like SFX but does not key the duck

/* put(bus, t0, sig, {gain, pan, rev, hall, right})
 * - mono sig + pan (number or fn(localSec)) or stereo via `right`
 * - rev: MUSIC -> hall send, SFX -> close room send;  hall: SFX -> hall send */
function put(bus, t0, sig, o = {}) {
  const gain = o.gain ?? 1, pan = o.pan ?? 0, right = o.right || null;
  const rev = o.rev ?? 0, hall = o.hall ?? 0;
  const toHall = bus === MUSIC ? rev : hall, toRoom = bus === MUSIC ? 0 : rev;
  const i0 = Math.round(t0 * SR), len = sig.length;
  const edge = Math.min(16, len >> 2);   // 0.33 ms safety ramp (generators shape their own attacks)
  const panFn = typeof pan === 'function';
  let gl = 1, gr = 1;
  if (!right && !panFn) { const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4; gl = Math.cos(a); gr = Math.sin(a); }
  for (let k = 0; k < len; k++) {
    const i = i0 + k;
    if (i < 0) continue;
    if (i >= N) break;
    let g = gain;
    if (k < edge) g *= k / edge; else if (k > len - edge) g *= (len - k) / edge;
    let l, r;
    if (right) { l = sig[k] * g; r = right[k] * g; }
    else {
      if (panFn) { const a = (clamp(pan(k / SR), -1, 1) + 1) * Math.PI / 4; gl = Math.cos(a); gr = Math.sin(a); }
      l = sig[k] * g * gl; r = sig[k] * g * gr;
    }
    bus.L[i] += l; bus.R[i] += r;
    if (toRoom) { bus.sL[i] += l * toRoom; bus.sR[i] += r * toRoom; }
    if (toHall) { bus.hL[i] += l * toHall; bus.hR[i] += r * toHall; }
  }
}
const put2 = (bus, t0, [L, R], o = {}) => put(bus, t0, L, { ...o, right: R });

// ───────────────────────────── 6. Score helpers (shared by the 90 s films) ─────────────────────────────
console.time('render');
const pumpAt = (tAbs, depth = 0.3) => {
  const tb = ((tAbs % BEAT) + BEAT) % BEAT;
  const d = tb < 0.008 ? smooth(tb / 0.008) : Math.exp(-(tb - 0.008) / 0.11);
  return 1 - depth * d;
};
/* note list → instrument: notes [[beat, midi, beats, extra]] from t0 (1 beat = 0.5 s); legato 96 % */
const phr = (t0, notes, fn, o = {}) => notes.forEach(([b, m, d, ex]) => fn(t0 + b * BEAT, m, d * BEAT * (o.legato ?? 0.96), { ...o, ...(ex || {}) }));
/* chord pads [[t, name, dur, extra]] with optional side-chain pump */
function chords(list, o = {}) {
  list.forEach(([t, ch, d, ex]) => {
    const p = { ...o, ...(ex || {}) };
    put2(MUSIC, t, pad(Array.isArray(ch) ? ch : V[ch], d - 0.03, { attack: p.attack ?? 0.08, release: p.release ?? 0.15, cutoff: p.cutoff ?? 1500, tab: p.tab, vib: p.vib, detune: p.detune,
      pump: p.pump ? (u) => pumpAt(t + u, p.pump) : null, env: p.env, seed: (p.seed || 'c') + t }), { gain: p.gain ?? 0.06, rev: p.rev ?? 0.35 });
  });
}
const bass = (list, gain = 0.2) => list.forEach(([t, m, d]) => put(MUSIC, t, bassNote(m, d), { gain }));
/* the lift into a hit at time t: riser + reverse cymbal + 4-stroke tom fill in the last beat */
function buildInto(t, len, seed, o = {}) {
  put(MUSIC, t - len, riser(rngFor('ris' + seed), len, o.f0 ?? 260, o.f1 ?? 7000), { gain: o.riser ?? 0.11, pan: (u) => 0.3 * Math.sin(TAU * 0.8 * u), rev: 0.3 });
  put2(MUSIC, t - len * 0.8, reverseCrash(rngFor('rc' + seed), len * 0.8), { gain: o.rc ?? 0.12, rev: 0.2 });
  if (o.toms !== false) [[0, 147], [0.125, 123], [0.25, 98], [0.375, 82]].forEach(([d, f]) => put(MUSIC, t - 0.5 + d, tom(f, 0.22), { gain: (o.tomG ?? 0.1) + d * 0.25, pan: 0.3 - d * 1.6, rev: 0.25 }));
}
/* the big tutti hit: boom + big drum + gong + crash + wide pad + bass */
function bigHit(t, o = {}) {
  const k = o.scale ?? 1;
  put(MUSIC, t, bigBoom(rngFor('boom' + t), o.boomDur ?? 2.2, o.boomOpt || {}), { gain: 0.5 * k, rev: 0.15 });
  put(MUSIC, t, tom(o.drumF ?? 66, 0.5), { gain: 0.3 * k, rev: 0.25 });
  if (o.gongF) put2(MUSIC, t, gong(rngFor('gong' + t), o.gongDur ?? 3.2, o.gongF), { gain: (o.gongG ?? 0.15) * k, rev: 0.4 });
  put2(MUSIC, t, crash(rngFor('crash' + t), o.crashDur ?? 2.2), { gain: (o.crashG ?? 0.08) * k, rev: 0.4 });
  put2(MUSIC, t, pad(o.chord, o.padDur ?? 1.95, { attack: 0.03, release: 0.4, cutoff: 2600, detune: 9, seed: 'hit' + t }), { gain: (o.padG ?? 0.1) * k, rev: 0.45 });
  put(MUSIC, t, bassNote(o.root, o.bassDur ?? 0.9), { gain: 0.26 * k });
}
/* ambience bus: everything through putAmb follows AMB_KEYS (defined by the film before use) */
const ambEnv = (t) => pw(AMB_KEYS, t);
function putAmb(t0, sig, o = {}) { const s = Float32Array.from(sig); mulEnv(s, (t) => ambEnv(t0 + t)); put(AMB, t0, s, o); }
function put2Amb(t0, [L, R], o = {}) { const a = Float32Array.from(L), b = Float32Array.from(R); mulEnv(a, (t) => ambEnv(t0 + t)); mulEnv(b, (t) => ambEnv(t0 + t)); put(AMB, t0, a, { ...o, right: b }); }
function bikesAmb(list, seed, o = {}) {   // distant motorbikes [[t, dir]]
  const RB = rngFor(seed);
  list.forEach(([t, dir]) => {
    const d = 2.4 + RB() * 1.2;
    const [L, R] = scooter(RB, d, { dir, f0: 68 + RB() * 30, v: 8 + RB() * 4, d: 7 + RB() * 6 });
    const bell = (tt) => Math.pow(Math.sin(Math.PI * clamp(tt / d, 0, 1)), 1.2);
    mulEnv(L, bell); mulEnv(R, bell);
    put2Amb(t, [L, R], { gain: (o.gain ?? 0.07) + 0.03 * RB(), rev: 0.05, hall: 0.25 });
  });
}
/* CTA (identical choreography in every film): heart pops in 84.7, "+1" ding 84.85, FOLLOW slides
 * in 85.2, press 86.0 (click + ting + confetti), wink 86.5 */
function ctaSfx(key) {
  put(SFX, 84.7, heartPop(rngFor('heart')), { gain: 0.42, pan: -0.15, rev: 0.12, hall: 0.1 });
  put(SFX, 84.85, dingUp(), { gain: 0.16, pan: -0.1, rev: 0.1, hall: 0.3 });
  put(SFX, 85.2, whoosh(rngFor('ctaW'), 0.32, 700, 4200, 1500, 0.6, 1.0), { gain: 0.2, pan: (u) => 0.8 - 4 * u, rev: 0.05, hall: 0.1 });
  put(SFX, 86.0, uiClick(rngFor('click')), { gain: 0.45, pan: 0.05, rev: 0.1 });
  put(SFX, 86.0, ting(m2f(key + 24), 0.9), { gain: 0.1, pan: 0.1, rev: 0.1, hall: 0.4 });
  put(SFX, 86.03, ting(m2f(key + 31), 0.9), { gain: 0.07, pan: -0.1, rev: 0.1, hall: 0.4 });
  put2(SFX, 86.02, confetti(rngFor('conf'), 1.7), { gain: 0.3, rev: 0.1, hall: 0.2 });
  put(SFX, 86.5, ting(m2f(key + 36), 0.35), { gain: 0.07, pan: 0.3, rev: 0.1, hall: 0.4 });            // wink sparkle
  put(SFX, 86.5, slideWhistle(rngFor('wink'), 0.16, 1500, 2300), { gain: 0.06, pan: 0.3, rev: 0.1, hall: 0.2 });
}

// ───────────────────────────── 6b. Score: MÌ XÀO GIÒN CHỢ LỚN ─────────────────────────────
// D gong-mode pentatonic (D E F# A B): Cantonese-street colour. nhị hồ (erhu) lead, guzheng (tranh + bending kìm-tranh),
// woodblock, small gong, big drum, bo cymbal.
const SCALE = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86, 88, 90, 93, 95];
const V = { D: [50, 57, 62, 66, 69], G: [55, 59, 62, 67, 71], Bm: [47, 54, 59, 62, 66], Em: [52, 59, 64, 67, 71], Asus: [45, 57, 62, 64, 69] };
const ROOT = { D: 38, G: 43, Bm: 35, Em: 40, Asus: 45 };
const FIFTH = { D: 45, G: 50, Bm: 42, Em: 47, Asus: 52 };
// ambience: Cholon night street → kitchen focus → gone for the hush → faint after the crunch → full for the pull-back
const AMB_KEYS = [[0, 0], [0.6, 0.8], [2.0, 1], [11.8, 1], [12.6, 0.45], [60.3, 0.45], [60.9, 0.55], [72.5, 0.5], [72.95, 0], [73.5, 0], [74.5, 0.25], [80.6, 0.25], [81.6, 1.0], [82.6, 0.6], [88.0, 0.6], [89.4, 0]];
const FILM = {
  trim: [[0, 1], [60.8, 0.95], [72.9, 0.95], [73.5, 1], [90, 1]],
  windows: [['intro 0-12', 0, 12], ['title 12-15', 12, 15], ['theme A 15-31', 15, 31], ['toss 33.5-36.5', 33.5, 36.5], ['theme B 36.5-46', 36.5, 46],
    ['orbit/serve 46-60.5', 46, 60.5], ['comedy 60.8-67.4', 60.8, 67.4], ['flame 67.5-72.9', 67.5, 72.9], ['burst 73.5-77', 73.5, 77], ['chorus 77-81', 77, 81], ['end card 82-84.5', 82, 84.5], ['CTA 84.5-89', 84.5, 89]],
};

function erh(t, midi, dur, o = {}) {      // nhị hồ lead, right of centre
  put(MUSIC, t, erhu(midi, dur, { seed: 'e' + t.toFixed(3), ...o }), { gain: o.gain ?? 0.085, pan: o.pan ?? 0.16, rev: o.rev ?? 0.38 });
}
function zheng(t, midi, dur, o = {}) {    // guzheng with press-bends (kìm string model, tranh voicing), left of centre
  put(MUSIC, t, kim(midi, dur, { tranh: true, seed: 'z' + t.toFixed(3), ...o }), { gain: o.gain ?? 0.07, pan: o.pan ?? -0.3, rev: o.rev ?? 0.4 });
}
function tranhNote(t, midi, dur, gain, pan, seed, rev = 0.45) { put(MUSIC, t, tranh(midi, dur, rngFor('tr' + seed + t.toFixed(3)), {}), { gain, pan, rev }); }
const tr = (t, m, d, g = 0.03, p = 0, rv = 0.45) => tranhNote(t, m, d, g, p, 'n' + m, rv);
function gliss(t0, from, to, step, gain, seed, o = {}) {
  const a = SCALE.indexOf(from), b = SCALE.indexOf(to);
  if (a < 0 || b < 0) throw new Error('gliss: notes must be in SCALE');
  const dir = b >= a ? 1 : -1, cnt = Math.abs(b - a), p0 = o.pan0 ?? -0.6, p1 = o.pan1 ?? 0.6;
  for (let k = 0; k <= cnt; k++) tranhNote(t0 + k * step, SCALE[a + dir * k], o.dur ?? 1.2, gain * (o.cresc ? 0.7 + 0.3 * k / Math.max(1, cnt) : 1), p0 + (p1 - p0) * k / Math.max(1, cnt), seed + k, o.rev ?? 0.5);
}
const K = kick({ decay: 0.2, click: 0.2 }), KG = kick({ decay: 0.14, seed: 'g', click: 0.12 }), KD = kick({ decay: 0.3, fEnd: 42, seed: 'd' });
const WB_HI = mo(rngFor('wbH'), 1250), WB_LO = mo(rngFor('wbL'), 930);
const wb = (t, hi, gain) => put(MUSIC, t, hi ? WB_HI : WB_LO, { gain, pan: 0.3, rev: 0.25 });
const DRUM = tom(92, 0.32), DRUM_LO = tom(70, 0.4);
const XG = gong(rngFor('xiaoluo'), 1.3, 440);                          // small gong (stereo)
const xg = (t, gain) => put2(MUSIC, t, XG, { gain, rev: 0.35 });
const BO = crash(rngFor('bo'), 0.9);                                     // bo cymbal (stereo)
const bo = (t, gain) => put2(MUSIC, t, BO, { gain, rev: 0.3 });
const cutTing = (t, midi, pan) => put(MUSIC, t, ting(m2f(midi), 0.6), { gain: 0.03, pan, rev: 0.6 });
const bars = (t0, names, len = 2) => names.map((n, k) => [t0 + k * len, n, len]);
const chAt = (list) => (t) => { let c = null; for (const [a, n] of list) if (t >= a - 1e-6) c = n; return c; };
/* Cantonese street groove: kick 1 & 3, big drum on 1 (+ 3 when full), woodblock 2 & 4 with 8th off-beats,
 * small gong every other bar, bo cymbal on bar 1 of each phrase, bass root / fifth. half = slow-motion half-time */
function groove(t0, t1, chordOf, o = {}) {
  const kg = o.kick ?? 0.28, dg = o.drum ?? 0.12, wg = o.wb ?? 0.06, gg = o.gong ?? 0.035, bg = o.bass ?? 0.17, half = !!o.half;
  for (let t = t0; t < t1 - 1e-6; t += BEAT) {
    const i = Math.round((t - t0) / BEAT), b = i % 4, bar = Math.floor(i / 4), ch = chordOf(t);
    if (kg && (b === 0 || (!half && b === 2))) put(MUSIC, t, half ? KD : K, { gain: kg * (b ? 0.85 : 1), rev: 0.03 });
    if (kg && !half && b === 3 && o.ghost !== false) put(MUSIC, t + 0.25, KG, { gain: kg * 0.3, rev: 0.03 });
    if (dg && (b === 0 || (o.full && b === 2))) put(MUSIC, t, b ? DRUM : DRUM_LO, { gain: dg * (b ? 0.7 : 1), pan: -0.1, rev: 0.22 });
    if (dg && o.full && b === 3) put(MUSIC, t + 0.25, DRUM, { gain: dg * 0.5, pan: -0.1, rev: 0.22 });
    if (wg && (half ? b === 2 : (b === 1 || b === 3))) wb(t, true, wg);
    if (wg && !half && o.wbOff) wb(t + 0.25, false, wg * 0.45);
    if (wg && !half && o.wb16 && (b === 3)) { wb(t + 0.25, false, wg * 0.5); wb(t + 0.375, false, wg * 0.4); }
    if (gg && b === 0 && bar % 2 === 1) xg(t, gg);
    if (o.bo && b === 0 && bar % 4 === 0) bo(t, o.bo);
    if (bg && ch) {
      if (b === 0) put(MUSIC, t, bassNote(ROOT[ch], half ? 1.8 : 0.9), { gain: bg });
      else if (!half && b === 2) put(MUSIC, t, bassNote(FIFTH[ch], 0.45), { gain: bg * 0.8 });
      if (!half && b === 3 && o.walk) put(MUSIC, t + 0.25, bassNote(ROOT[ch] + 2, 0.2), { gain: bg * 0.55 });
    }
  }
}
/* guzheng running 8th-note arpeggios (the classic "流水" texture) */
function zhengBed(list, o = {}) {
  list.forEach(([t, ch, d]) => { const v = V[ch]; for (let k = 0; k < d / 0.25 - 1e-6; k++) tr(t + k * 0.25, v[[1, 2, 3, 4, 3, 2, 4, 3][k % 8]] + (o.oct ?? 12), 0.6, (o.gain ?? 0.022) * (k % 2 ? 0.75 : 1), -0.45, 0.4); });
}
const THEME_A = [[0, 74, 1], [1, 76, 0.5], [1.5, 78, 0.5], [2, 81, 1.5, { bendFrom: -2 }], [3.5, 78, 0.5],
  [4, 76, 0.5], [4.5, 74, 0.5], [5, 71, 1], [6, 74, 2, { endBend: -1, endBendTime: 0.3 }],
  [8, 81, 0.5], [8.5, 83, 0.5], [9, 86, 1, { bendFrom: -2 }], [10, 83, 0.5], [10.5, 81, 0.5], [11, 78, 1],
  [12, 76, 0.5], [12.5, 78, 0.5], [13, 81, 0.5], [13.5, 78, 0.5], [14, 76, 2, { path: [[0, 0], [0.5, 0], [0.7, 2], [1.0, 0]] }],
  [16, 71, 0.5], [16.5, 74, 0.5], [17, 76, 1], [18, 78, 0.5], [18.5, 81, 0.5], [19, 83, 1, { bendFrom: -2 }],
  [20, 81, 1], [21, 78, 0.5], [21.5, 76, 0.5], [22, 74, 2],
  [24, 76, 0.5], [24.5, 78, 0.5], [25, 81, 1], [26, 78, 0.5], [26.5, 76, 0.5], [27, 71, 1],
  [28, 69, 0.5], [28.5, 71, 0.5], [29, 74, 0.5], [29.5, 76, 0.5], [30, 74, 2, { bendFrom: -2, bendTime: 0.3 }]];
const CHA = ['D', 'Bm', 'G', 'Asus', 'Em', 'D', 'Asus', 'D'];
const THEME_B = [[0, 69, 0.5], [0.5, 71, 0.5], [1, 74, 1, { bendFrom: -2 }], [2, 71, 0.5], [2.5, 69, 0.5], [3, 66, 1],
  [4, 64, 0.5], [4.5, 66, 0.5], [5, 69, 1.5, { nhan: 2, nhanAt: 0.4 }], [6.5, 71, 0.5], [7, 74, 1],
  [8, 76, 0.5], [8.5, 74, 0.5], [9, 71, 1], [10, 74, 0.5], [10.5, 76, 0.5], [11, 78, 1, { bendFrom: -2 }],
  [12, 81, 1.5, { nhan: 2, nhanAt: 0.4 }], [13.5, 78, 0.5], [14, 76, 1], [15, 74, 1],
  [16, 71, 0.5], [16.5, 74, 0.5], [17, 76, 1], [18, 74, 1]];
const upTo = (notes, end) => notes.filter((n) => n[0] < end - 1e-6).map(([b, m, d, ex]) => [b, m, Math.min(d, end - b), ex]);

// ---------- AMBIENCE: Cholon at 7 pm — voices, bowls and chopsticks, motorbikes (own bus, never keys the duck) ----------
{
  put2Amb(0, cityHum(rngFor('city'), DUR), { gain: 0.16, rev: 0.03, hall: 0.05 });
  put2Amb(0.5, chatter(rngFor('chat'), 89.0, 6), { gain: 0.07, rev: 0.1, hall: 0.25 });
  put2Amb(3.3, fireBed(rngFor('burner'), 58.0, 4), { gain: 0.11, rev: 0.05, hall: 0.05 });   // the wok burner's roar
  bikesAmb([[0.3, -1], [2.2, 1], [5.4, -1], [9.0, 1], [14.0, -1], [19.4, 1], [25.0, -1], [30.2, 1], [36.0, -1], [42.4, 1], [48.0, -1], [53.6, 1], [58.8, -1],
    [63.0, 1], [69.0, -1], [76.2, 1], [80.2, -1], [81.6, 1], [84.0, -1], [86.6, 1]], 'bikes', { gain: 0.065 });
  [[2.4, 440, 0.5], [21.6, 415, -0.5], [44.2, 466, 0.4], [65.8, 440, -0.6], [82.4, 415, 0.5]].forEach(([t, f, p]) => putAmb(t, horn(0.1, f), { gain: 0.025, pan: p, rev: 0.2, hall: 0.5 }));
  const RC = rngFor('dishes');   // bowls and chopsticks from the tables around
  for (let t = 1.2, k = 0; t < 88.5; t += 1.4 + 2.2 * RC(), k++) {
    const s = k % 3 === 0 ? bowlClack(rngFor('ad' + k), 2600 + 600 * RC()) : k % 3 === 1 ? clink(rngFor('ad' + k), 1500 + 900 * RC()) : ceramic(rngFor('ad' + k), 1300 + 500 * RC(), 0.3);
    putAmb(t, s, { gain: 0.035 + 0.02 * RC(), pan: (RC() - 0.5) * 1.4, rev: 0.2, hall: 0.45 });
  }
}

// ---------- ACT I: lanterns over Cholon (0–15) ----------
{
  // 0–3.5 crane down past swaying red lanterns: drone + pad, guzheng gliss, the erhu's first call, a small gong
  put(MUSIC, 0.0, drone(12.0, { attack: 3.0, release: 0.3, midi: 38 }), { gain: 0.05, rev: 0.15 });
  put2(MUSIC, 0.0, pad([50, 57, 62, 66, 69], 3.55, { attack: 2.6, release: 0.5, cutoff: 900, seed: 'i1' }), { gain: 0.08, rev: 0.4 });
  gliss(0.2, 50, 88, 0.07, 0.024, 'ig', { dur: 1.6, rev: 0.6, pan0: -0.5, pan1: 0.5 });
  phr(1.3, [[0, 81, 1.5, { bendFrom: -2, bendTime: 0.3, attack: 0.15 }], [1.5, 78, 0.5], [2, 76, 0.5, { path: [[0, 0], [0.15, 2], [0.3, 0]] }], [2.5, 74, 1.8, { vib: 0.4, endBend: -2, endBendTime: 0.4 }]], erh, { gain: 0.075, rev: 0.55 });
  xg(0.6, 0.05);
  // 3.5–6.5 the stove roars up: big drum + bass enter, woodblock, guzheng ostinato
  put(MUSIC, 3.5, DRUM_LO, { gain: 0.2, rev: 0.25 });
  chords([[3.5, 'D', 1.5], [5.0, 'Bm', 1.5]], { gain: 0.05, cutoff: 1200 });
  [62, 69, 66, 69, 62, 69, 71, 69, 59, 66, 62, 66].forEach((m, k) => zheng(3.5 + k * 0.25, m, 0.25, { gain: 0.045, vib: 0 }));
  for (let t = 3.5; t < 6.5 - 1e-6; t += BEAT) wb(t, Math.round(t * 2) % 2 === 1, 0.05);
  [4.5, 5.5].forEach((t) => put(MUSIC, t, DRUM, { gain: 0.1, pan: -0.1, rev: 0.22 }));
  bass([[3.5, 38, 0.45], [4.5, 45, 0.45], [5.0, 35, 0.45], [6.0, 42, 0.4]], 0.14);
  // 6.5–9.5 the foreigner walks by, flames in his sunglasses: bouncy erhu, woodblock 8ths
  const C2 = [[6.5, 'G', 1.5], [8.0, 'D', 1.5]];
  chords(C2, { gain: 0.05, cutoff: 1300 });
  phr(6.5, [[0, 74, 0.5], [0.5, 76, 0.5], [1, 78, 0.5], [1.5, 81, 0.5, { bendFrom: -1 }], [2, 83, 1, { vib: 0.3 }], [3, 81, 0.5], [3.5, 78, 0.5], [4, 81, 1.5, { bendFrom: -2 }]], erh, { gain: 0.075 });
  for (let t = 6.5, k = 0; t < 9.5 - 1e-6; t += 0.25, k++) wb(t, k % 2 === 0, k % 2 ? 0.025 : 0.04);
  [6.5, 7.5, 8.0, 9.0].forEach((t) => put(MUSIC, t, K, { gain: 0.2, rev: 0.03 }));
  bass([[6.5, 43, 0.45], [7.5, 50, 0.45], [8.0, 38, 0.45], [9.0, 45, 0.4]], 0.14);
  cutTing(8.3, 93, 0.4);   // the glint in his sunglasses
  // 9.5–12 A Phát swirls the wok: drum roll building, chord build, erhu run into the title
  for (let t = 9.5, k = 0; t < 11.5 - 1e-6; t += 0.25, k++) put(MUSIC, t, DRUM, { gain: 0.04 + 0.006 * k, pan: -0.1, rev: 0.22 });
  [9.5, 10.5, 11.0].forEach((t) => put(MUSIC, t, K, { gain: 0.22, rev: 0.03 }));
  chords([[9.5, 'Em', 1.0], [10.5, 'Asus', 1.5, { env: (u) => 0.75 + 0.5 * smooth(u / 1.4) }]], { gain: 0.06, cutoff: 1400 });
  [71, 74, 76, 81, 83, 81, 76, 74].forEach((m, k) => tr(10.0 + k * 0.125, m, 0.8, 0.025, 0.5 - 0.12 * k, 0.5));
  bass([[9.5, 40, 0.45], [10.5, 45, 1.4]], 0.15);
  buildInto(12.0, 2.0, 't12');
  erh(11.4, 81, 0.55, { bendFrom: -5, bendTime: 0.5, vib: 0, gain: 0.07 });
  // TITLE HIT 12.0
  bigHit(12.0, { chord: [50, 57, 62, 66, 69, 74], root: 38, gongF: 147, scale: 0.8 });
  xg(12.0, 0.06);
  gliss(12.0, 50, 95, 0.028, 0.038, 'tg', { dur: 1.6, rev: 0.55 });
  erh(12.0, 86, 1.0, { bendFrom: -2, bendTime: 0.12, vib: 0.45, gain: 0.085 });
  zheng(12.0, 81, 0.9, { trem: 14, gain: 0.06 });
  phr(13.0, [[0, 83, 0.4], [0.4, 81, 0.4], [0.8, 78, 0.3], [1.1, 81, 1.2, { path: [[0, 0], [0.3, 0], [0.45, 2], [0.6, 0]] }]], erh, { gain: 0.075, rev: 0.45 });
  chords([[13.0, 'G', 1.0], [14.0, 'Asus', 1.0]], { gain: 0.05, cutoff: 1300 });
  [[14.0, 76], [14.25, 74], [14.5, 71], [14.75, 74]].forEach(([t, m]) => tr(t, m, 0.6, 0.03, -0.3, 0.4));
  for (let t = 13.5; t < 15 - 1e-6; t += BEAT) wb(t, true, 0.04);

  // SFX
  put2(SFX, 3.5, fwoosh(rngFor('stoveUp'), 1.4, { peakAt: 0.15 }), { gain: 0.36, rev: 0.1, hall: 0.15 });
  put2(SFX, 3.6, fireBed(rngFor('stove1'), 3.0, 10), { gain: 0.16, rev: 0.06, hall: 0.05 });
  put(SFX, 4.4, wokKeng(rngFor('kengA'), 1150), { gain: 0.18, pan: -0.3, rev: 0.15, hall: 0.2 });
  put(SFX, 5.4, wokKeng(rngFor('kengB'), 1250), { gain: 0.16, pan: -0.3, rev: 0.15, hall: 0.2 });
  put2(SFX, 6.6, scooter(rngFor('bike'), 0.9, { dir: 1, f0: 88, v: 13, d: 1.6 }), { gain: 0.4, rev: 0.06, hall: 0.06 });
  put(SFX, 7.4, inhale(rngFor('sniff'), 0.4), { gain: 0.36, pan: 0.1, rev: 0.1 });
  put(SFX, 7.9, vox(rngFor('ooh'), { dur: 0.6, pitch: [[0, 180], [0.3, 230], [0.6, 210]], f1: [[0, 330], [0.6, 360]], f2: [[0, 800], [0.6, 850]], f3: [[0, 2400], [0.6, 2400]], breath: 0.12 }), { gain: 0.3, pan: 0.1, rev: 0.12, hall: 0.1 });
  put2(SFX, 9.5, fireBed(rngFor('swirl'), 2.6, 14), { gain: 0.2, rev: 0.06, hall: 0.05 });
  [9.5, 10.5, 11.0, 11.5].forEach((t, k) => put(SFX, t, wokKeng(rngFor('swirlK' + k), 1100 + 60 * k), { gain: 0.24, pan: k % 2 ? 0.15 : -0.12, rev: 0.12 }));
  [10.0, 11.25].forEach((t, k) => put2(SFX, t, wokToss(rngFor('swirlT' + k), 0.65), { gain: 0.26, rev: 0.1 }));
  put2(SFX, 12.0, fwoosh(rngFor('fw12'), 1.6, { peakAt: 0.08 }), { gain: 0.42, rev: 0.1, hall: 0.15 });
  put2(SFX, 12.1, fryBurst(rngFor('xeo12'), 1.0, { plop: false }), { gain: 0.26, rev: 0.12, hall: 0.1 });
  put2(SFX, 12.4, sizzle(rngFor('siz12'), 2.4), { gain: 0.14, rev: 0.08 });
}

// ---------- ACT II: the nest and the wok (15–60.5) ----------
{
  // 15–31 THEME A on the erhu: first half light (woodblock + drum), second half full (gong, guzheng flow, walking bass)
  const CA = bars(15, CHA);
  chords(CA, { gain: 0.045, cutoff: 1400, pump: 0.25 });
  phr(15, THEME_A, erh, { gain: 0.085 });
  groove(15, 23, chAt(CA), { kick: 0.25, wb: 0.05, gong: 0, drum: 0.1 });
  groove(23, 31, chAt(CA), { full: true, wbOff: true, walk: true, bo: 0.04 });
  zhengBed(CA.slice(4), { gain: 0.02 });
  phr(23, THEME_A.filter((n) => n[0] >= 16).map(([b, m, d, ex]) => [b - 16, m - 12, d, ex]), zheng, { gain: 0.035 });
  [[18.5, 74], [18.75, 76], [22.5, 78], [22.75, 76]].forEach(([t, m]) => tr(t, m, 0.5, 0.03, 0.4, 0.4));
  // 31–33.5 greens rain into the wok: guzheng cascade, woodblock 8ths climbing, lift into the toss
  chords([[31, 'Asus', 2.5, { env: (u) => 0.8 + 0.4 * smooth(u / 2.4) }]], { gain: 0.055, cutoff: 1500, pump: 0.3 });
  groove(31, 33, chAt([[31, 'Asus']]), { full: true, wbOff: true, walk: true });
  gliss(31.0, 95, 62, 0.06, 0.026, 'veg', { pan0: 0.6, pan1: -0.6, dur: 1.0 });
  phr(31, [[0, 83, 0.5], [0.5, 81, 0.5], [1, 78, 0.5], [1.5, 81, 0.5], [2, 83, 1, { path: [[0, 0], [0.2, 0], [0.3, 2], [0.4, 0], [0.5, 2], [0.6, 0]] }], [3, 86, 1, { bendFrom: -2 }]], erh, { gain: 0.08 });
  buildInto(33.5, 1.5, 't33', { riser: 0.09, rc: 0.1 });
  // 33.5 TOSS (flash): hit, then half-time slow motion as everything hangs in the air
  bigHit(33.5, { chord: [47, 54, 59, 62, 66, 71], root: 35, scale: 0.6, gongF: 196, gongG: 0.1 });
  xg(33.5, 0.05);
  const CS = [[33.5, 'Bm', 1.5], [35.0, 'G', 1.5]];
  chords(CS, { gain: 0.06, attack: 0.3, release: 0.3, cutoff: 1100, rev: 0.5 });
  groove(33.5, 36.5, chAt(CS), { half: true, kick: 0.25, wb: 0.05, drum: 0.1, gong: 0 });
  erh(33.6, 83, 1.4, { bendFrom: -2, bendTime: 0.3, vib: 0.45, gain: 0.08, rev: 0.6 });
  erh(35.0, 81, 1.4, { vib: 0.4, gain: 0.075, rev: 0.6, endBend: -3, endBendTime: 0.4 });
  [[33.75, 90], [34.25, 86], [34.75, 83], [35.25, 81], [35.75, 78], [36.0, 76]].forEach(([t, m], k) => tr(t, m, 1.4, 0.022, 0.5 - 0.2 * k, 0.6));
  [[36.0, 147], [36.125, 123], [36.25, 98], [36.375, 82]].forEach(([t, f], k) => put(MUSIC, t, tom(f, 0.22), { gain: 0.08 + 0.02 * k, pan: 0.3 - 0.2 * k, rev: 0.25 }));
  // 36.5–46 THEME B on the guzheng (bends), erhu answering with long notes
  const CB = [...bars(36.5, ['D', 'G', 'Em', 'D']), [44.5, 'G', 1.5]];
  chords(CB, { gain: 0.045, cutoff: 1500, pump: 0.25 });
  phr(36.5, upTo(THEME_B, 19), zheng, { gain: 0.08, pan: -0.2 });
  phr(36.5, upTo(THEME_B, 19).filter((n, k) => k % 3 === 0), (t, m, d) => tr(t, m - 12, d + 0.3, 0.025, -0.45), {});
  [[37.0, 81, 1.8, { bendFrom: -2 }], [39.0, 78, 1.8], [41.0, 83, 1.8, { bendFrom: -2 }], [43.0, 81, 1.6], [44.75, 86, 1.1, { path: [[0, 0], [0.4, 0], [0.55, 2], [0.7, 0]] }]]
    .forEach(([t, m, d, ex]) => erh(t, m, d, { gain: 0.06, vib: 0.38, ...(ex || {}) }));
  groove(36.5, 46, chAt(CB), { wbOff: true, walk: true, drum: 0.1 });
  // 46–49 orbit around the finished plate: the erhu soars, guzheng 16th arpeggios, wide pads
  const CO = [[46, 'D', 1.5], [47.5, 'Bm', 1.5]];
  chords(CO, { gain: 0.06, cutoff: 1800, attack: 0.2, rev: 0.5 });
  phr(46, [[0, 81, 1.5, { bendFrom: -2, bendTime: 0.25 }], [1.5, 83, 0.5], [2, 86, 1], [3, 83, 1.5, { path: [[0, 0], [0.4, 0], [0.55, 2], [0.7, 0]] }], [4.5, 81, 0.5], [5, 78, 1, { endBend: -1 }]], erh, { gain: 0.09, rev: 0.5 });
  for (let k = 0; k < 24; k++) { const v = (k < 12 ? V.D : V.Bm).slice(1); tr(46 + k * 0.125, v[k % 4] + 12 + (Math.floor(k / 4) % 2) * 12, 0.5, 0.016, -0.5 + 0.04 * k, 0.5); }
  groove(46, 49, chAt(CO), { half: true, kick: 0.22, wb: 0.04, drum: 0.1, gong: 0 });
  xg(46.0, 0.04);
  // 49–55 THEME A bars 1–3 at full: erhu + guzheng an octave down; 49.0 pepper & cilantro sprinkle = high tranh
  const CF = bars(49, ['D', 'Bm', 'G']);
  chords(CF, { gain: 0.05, cutoff: 1600, pump: 0.3 });
  phr(49, upTo(THEME_A, 12), erh, { gain: 0.085 });
  phr(49, upTo(THEME_A, 12), (t, m, d, o) => zheng(t, m - 12, d, o), { gain: 0.035 });
  groove(49, 55, chAt(CF), { full: true, wbOff: true, walk: true, bo: 0.035 });
  for (let k = 0; k < 8; k++) tr(49.1 + k * 0.11, [90, 93, 95, 90, 88, 93, 90, 95][k], 0.4, 0.012, (k % 2 ? 0.4 : -0.4), 0.5);
  // 55–58 the table is laid out on the beat: rising stabs, a ting on each
  [74, 76, 78, 81, 83, 86].forEach((m, k) => {
    const t = 55 + k * BEAT;
    tr(t, m, 0.5, 0.035, -0.3 + 0.12 * k, 0.4); tr(t, m - 12, 0.5, 0.025, -0.3 + 0.12 * k, 0.4);
    erh(t, m, 0.16, { gain: 0.055, attack: 0.01, release: 0.05, vib: 0 });
    put(MUSIC, t, k % 2 ? KG : K, { gain: 0.26, rev: 0.03 });
    wb(t + 0.25, k % 2 === 0, 0.04);
    put(MUSIC, t, bassNote([38, 40, 42, 45, 47, 45][k], 0.4), { gain: 0.14 });
  });
  xg(57.5, 0.04);
  chords([[55, 'D', 1.0], [56, 'Em', 1.0], [57, 'Asus', 1.0]], { gain: 0.045, cutoff: 1600 });
  // 58–60.5 macro: gravy seeps into the crisp nest — stop-time, held chord, guzheng tremolo
  chords([[58, 'G', 2.5, { vib: 0.25 }]], { gain: 0.045, attack: 0.2, release: 0.3, cutoff: 1100, rev: 0.5 });
  put(MUSIC, 58.0, bassNote(43, 1.6), { gain: 0.12 });
  zheng(58.5, 83, 1.2, { trem: 12, gain: 0.045 });
  erh(59.0, 78, 1.2, { vib: 0.4, gain: 0.05, endBend: 2, endBendTime: 0.5 });
  buildInto(60.8, 0.8, 't60', { toms: false, riser: 0.07, rc: 0.09 });

  // SFX
  put2(SFX, 15.0, rustle(rngFor('noodleShake'), 2.6), { gain: 0.28, rev: 0.1 });
  [15.2, 15.9, 16.6, 17.3].forEach((t, k) => put(SFX, t, leafSlap(rngFor('strand' + k)), { gain: 0.18, pan: k % 2 ? 0.25 : -0.25, rev: 0.1 }));
  put(SFX, 18.0, whoosh(rngFor('dropW'), 0.4, 1600, 900, 300, 0.4, 1.0), { gain: 0.2, pan: 0, rev: 0.1 });
  put2(SFX, 18.3, fryBurst(rngFor('dfry18'), 1.2, { plop: true }), { gain: 0.42, rev: 0.12, hall: 0.1 });
  put2(SFX, 18.4, deepFry(rngFor('dfry'), 3.4, 60), { gain: 0.28, rev: 0.08 });
  put2(SFX, 18.6, foam(rngFor('foam18'), 2.2), { gain: 0.16, rev: 0.1 });
  put(SFX, 21.0, metalScrape(rngFor('spider'), 0.35), { gain: 0.2, pan: 0.05, rev: 0.12 });
  [21.4, 21.8, 22.3].forEach((t, k) => put(SFX, t, smallDrip(rngFor('oilDrip' + k), 1000 - 80 * k), { gain: 0.22, pan: 0.1 * k, rev: 0.12 }));
  put(SFX, 22.6, norm(crackle(rngFor('nestCrackle'), 1.4, (u) => 120 * Math.exp(-u / 0.6), (u) => Math.exp(-u / 0.7), 2500, 9000)), { gain: 0.14, pan: 0, rev: 0.1 });
  put(SFX, 23.0, ceramic(rngFor('nestPlate'), 1500, 0.6), { gain: 0.4, pan: 0.05, rev: 0.12 });
  [23.25, 23.45, 23.6].forEach((t, k) => put(SFX, t, crunch(rngFor('crumb' + k), 0.25), { gain: 0.14, pan: -0.2 + 0.2 * k, rev: 0.1 }));
  // 24–33 the wok on the beat: a "keng" each beat, an ingredient "xèo" on each drop
  for (let t = 24.0, k = 0; t < 33 - 1e-6; t += BEAT, k++) put(SFX, t, wokKeng(rngFor('beatK' + k), k % 2 ? 1260 : 1130), { gain: k % 4 === 0 ? 0.22 : 0.15, pan: k % 2 ? 0.15 : -0.12, rev: 0.12 });
  put2(SFX, 24.0, fireBed(rngFor('wokFire'), 9.3, 12), { gain: 0.16, rev: 0.06 });
  [[24.4, 'shrimp'], [25.3, 'squid'], [26.2, 'shrimp2'], [27.3, 'pork'], [28.1, 'liver'], [28.9, 'giblet']].forEach(([t, s], k) => {
    put(SFX, t - 0.05, wetPlop(rngFor('in' + s), 260 + 30 * k), { gain: 0.26, pan: (k % 3 - 1) * 0.2, rev: 0.1 });
    put2(SFX, t, fryBurst(rngFor('xeo' + s), 0.7, { plop: false }), { gain: 0.3, rev: 0.1 });
  });
  put2(SFX, 26.7, wokToss(rngFor('toss26'), 0.65), { gain: 0.28, rev: 0.1 });
  put2(SFX, 29.5, wokToss(rngFor('toss29'), 0.65), { gain: 0.28, rev: 0.1 });
  put2(SFX, 30.0, rustle(rngFor('greens'), 2.6), { gain: 0.3, rev: 0.1, hall: 0.1 });
  [30.2, 30.7, 31.3, 31.9, 32.4].forEach((t, k) => put(SFX, t, leafSlap(rngFor('veg' + k)), { gain: 0.24, pan: k % 2 ? 0.3 : -0.3, rev: 0.1 }));
  put2(SFX, 30.5, sizzle(rngFor('siz30'), 3.0), { gain: 0.2, rev: 0.08 });
  put2(SFX, 33.5, wokToss(rngFor('toss33'), 0.65), { gain: 0.38, rev: 0.1 });
  put2(SFX, 33.5, fwoosh(rngFor('wokhei'), 2.2, { peakAt: 0.25 }), { gain: 0.48, rev: 0.1, hall: 0.2 });
  put(SFX, 33.55, whoosh(rngFor('rampW'), 1.0, 300, 2400, 500, 0.35, 1.0), { gain: 0.22, pan: (u) => -0.3 + 0.6 * u, rev: 0.08, hall: 0.2 });
  put2(SFX, 35.9, fryBurst(rngFor('land36'), 0.8, { plop: false }), { gain: 0.32, rev: 0.12 });
  put(SFX, 36.0, wokKeng(rngFor('land36k'), 1100), { gain: 0.26, pan: 0, rev: 0.12 });
  put2(SFX, 36.6, waterPour(rngFor('stock'), 0.8, { f0: 700, f1: 1400, thick: 0.4 }), { gain: 0.3, rev: 0.1 });
  put2(SFX, 36.75, fryBurst(rngFor('stockXeo'), 1.0, { plop: false }), { gain: 0.4, rev: 0.12, hall: 0.1 });
  put2(SFX, 37.0, steam(rngFor('stockSteam'), 2.0), { gain: 0.22, rev: 0.1, hall: 0.2 });
  put2(SFX, 37.8, glug(rngFor('oyster'), 0.6), { gain: 0.3, rev: 0.12 });
  put2(SFX, 38.6, waterPour(rngFor('soy'), 0.5, { f0: 900, f1: 1800 }), { gain: 0.24, rev: 0.1 });
  put2(SFX, 38.7, sizzle(rngFor('siz38'), 1.6), { gain: 0.16, rev: 0.08 });
  put(SFX, 39.5, stirClink(rngFor('slurryStir'), 1450), { gain: 0.2, pan: 0.2, rev: 0.12 });
  put2(SFX, 39.8, waterPour(rngFor('slurry'), 0.9, { f0: 600, f1: 1100, thick: 0.6 }), { gain: 0.26, rev: 0.1 });
  put2(SFX, 40.3, kettleSimmer(rngFor('thick'), 2.4), { gain: 0.24, rev: 0.08 });
  put(SFX, 41.0, metalScrape(rngFor('ladleStir'), 0.8), { gain: 0.16, pan: -0.1, rev: 0.12 });
  put(SFX, 42.5, whoosh(rngFor('pourW'), 0.5, 1500, 800, 300, 0.4, 1.0), { gain: 0.16, pan: 0, rev: 0.1 });
  put2(SFX, 42.6, waterPour(rngFor('gravy'), 2.4, { f0: 400, f1: 900, thick: 1 }), { gain: 0.3, rev: 0.12 });
  put2(SFX, 42.8, sizzle(rngFor('xeeeo'), 3.2), { gain: 0.26, rev: 0.1 });
  put2(SFX, 43.2, steam(rngFor('gravySteam'), 2.8), { gain: 0.22, rev: 0.1, hall: 0.25 });
  put2(SFX, 46.0, shimmer(rngFor('orbit'), 2.0), { gain: 0.14, rev: 0.1, hall: 0.3 });
  put(SFX, 46.0, whoosh(rngFor('orbitW'), 2.8, 300, 1400, 400, 0.5, 0.8), { gain: 0.12, pan: (u) => -0.7 + 0.5 * u, rev: 0.1, hall: 0.3 });
  put(SFX, 49.0, powderPour(rngFor('pepper'), 0.6), { gain: 0.3, pan: 0.05, rev: 0.1 });
  [49.8, 50.2, 50.6].forEach((t, k) => put(SFX, t, leafSlap(rngFor('ngo' + k)), { gain: 0.2, pan: k % 2 ? 0.25 : -0.25, rev: 0.1 }));
  [51.0, 51.25, 51.5].forEach((t, k) => put(SFX, t, chopClick(rngFor('chili' + k)), { gain: 0.26, pan: 0.2 - 0.15 * k, rev: 0.1 }));
  put(SFX, 52.0, ceramic(rngFor('saucer'), 1900, 0.4), { gain: 0.36, pan: -0.15, rev: 0.12 });
  put2(SFX, 52.4, glug(rngFor('soyChili'), 0.5), { gain: 0.24, rev: 0.12 });
  [53.5, 54.0].forEach((t, k) => put(SFX, t, wetPlop(rngFor('pickle' + k), 330 + 40 * k), { gain: 0.36, pan: 0.15, rev: 0.12 }));
  [[55.0, 'cer', 1500], [55.5, 'cer', 1950], [56.0, 'bc', 2900], [56.25, 'bc', 3100], [56.5, 'cup', 2200], [57.0, 'tea', 0], [57.5, 'pl', 2]].forEach(([t, kind, f], k) => {
    if (kind === 'tea') { put2(SFX, t, waterPour(rngFor('tea'), 0.8, { f0: 1100, f1: 2300 }), { gain: 0.22, rev: 0.1 }); return; }
    const s = kind === 'cer' ? ceramic(rngFor('srv' + k), f, 0.6) : kind === 'bc' ? bowlClack(rngFor('srv' + k), f) : kind === 'cup' ? ceramic(rngFor('srv' + k), f, 0.2) : placeSoft(rngFor('srv' + k), f);
    put(SFX, t, s, { gain: kind === 'bc' ? 0.3 : 0.4, pan: -0.3 + 0.1 * k, rev: 0.12 });
  });
  put2(SFX, 57.3, steam(rngFor('teaSteam'), 1.8), { gain: 0.12, rev: 0.1, hall: 0.2 });
  put(SFX, 58.2, norm(crackle(rngFor('seep'), 2.0, (u) => 60 + 40 * Math.sin(u * 3), (u) => 0.6 + 0.4 * Math.sin(Math.PI * clamp(u / 2, 0, 1)), 2000, 8000)), { gain: 0.1, pan: 0, rev: 0.12 });
  put2(SFX, 58.4, foam(rngFor('seepFoam'), 1.8), { gain: 0.08, rev: 0.1 });
}

// ---------- ACT III: "let me try!" (60.8–73) ----------
{
  bigHit(60.8, { chord: [50, 57, 62, 66, 69], root: 38, scale: 0.5, crashG: 0.06 });
  gliss(60.8, 74, 90, 0.03, 0.03, 'wow', { dur: 1.0 });
  // 61–63.5 bouncy (guzheng staccato offbeats + woodblock), A Phát tossing flames behind him
  for (let t = 61.0, k = 0; t < 63.5 - 1e-6; t += BEAT, k++) {
    const ch = t < 62.5 ? 'D' : 'Asus';
    put(MUSIC, t, bassNote(k % 2 ? FIFTH[ch] : ROOT[ch], 0.2), { gain: 0.15 });
    V[ch].slice(2, 5).forEach((m, j) => zheng(t + 0.25, m + 12, 0.1, { gain: 0.022, pan: -0.3 + 0.2 * j, noPick: j > 0, vib: 0 }));
    wb(t + 0.25, true, 0.045);
  }
  phr(61.5, [[0, 81, 0.5], [1, 83, 0.5], [2, 86, 1, { bendFrom: -2 }]], erh, { gain: 0.07 });
  // 63.5–67 he rolls up his sleeves and grabs the wok; A Phát's worried erhu wobble; tiptoe
  const tip = [[63.5, 76], [64.0, 74], [64.5, 71], [65.5, 74], [65.75, 71], [66.0, 69], [66.5, 66]];
  tip.forEach(([t, m]) => { zheng(t, m, 0.12, { gain: 0.05, vib: 0 }); wb(t, false, 0.03); });
  chords([[63.5, 'Em', 2.0], [65.5, 'Bm', 1.5]], { gain: 0.04, cutoff: 1000, attack: 0.2 });
  erh(64.6, 78, 0.9, { path: [[0, 0], [0.15, 0.6], [0.3, -0.6], [0.45, 0.6], [0.6, -0.6], [0.9, -2]], vib: 0, gain: 0.07 });   // "uh-oh…"
  bass([[63.5, 40, 0.4], [64.5, 40, 0.3], [65.5, 35, 0.4], [66.5, 35, 0.3]], 0.12);
  put(MUSIC, 67.0, riser(rngFor('r67'), 0.5, 500, 4000), { gain: 0.06, rev: 0.2 });
  // 67.5 FWOOM (flash): small gong + bo, erhu slides down in dismay, comic drum; then blinking quiet
  put(MUSIC, 67.5, bigBoom(rngFor('boom67'), 1.4), { gain: 0.24, rev: 0.15 });
  xg(67.5, 0.07); bo(67.5, 0.06);
  put(MUSIC, 67.5, DRUM_LO, { gain: 0.2, rev: 0.25 });
  erh(67.9, 86, 1.0, { path: [[0, 0], [0.15, 0], [1.0, -12]], vib: 0, attack: 0.03, gain: 0.075 });
  put2(MUSIC, 68.0, pad([49, 56, 61, 64], 1.4, { attack: 0.05, release: 0.3, cutoff: 900, seed: 'oops' }), { gain: 0.04, rev: 0.4 });
  [[69.3, 90], [69.7, 90]].forEach(([t, m]) => cutTing(t, m, 0.2));   // blink, blink
  [[69.5, 74], [70.0, 71]].forEach(([t, m]) => { zheng(t, m, 0.3, { gain: 0.04, endBend: -1 }); wb(t, false, 0.03); });
  // 70.5–73 the bite: guzheng tremolo climbing + thin riser + drone (cut by the hush at 72.97)
  [[70.5, 76, 1.0], [71.5, 78, 0.75], [72.25, 81, 0.75]].forEach(([t, m, d]) => zheng(t, m, d, { trem: 16, gain: 0.045 + 0.005 * (m - 76) / 2 }));
  chords([[70.5, 'Asus', 2.5, { env: (u) => 0.6 + 0.6 * smooth(u / 2.4) }]], { gain: 0.05, cutoff: 1500, attack: 0.3 });
  put(MUSIC, 71.0, riser(rngFor('r73'), 2.0, 400, 6000), { gain: 0.07, rev: 0.2 });
  put(MUSIC, 70.5, drone(2.5, { attack: 1.0, release: 0.05, midi: 45 }), { gain: 0.05, rev: 0.1 });
  erh(71.0, 81, 1.9, { bendFrom: -2, bendTime: 0.6, vib: 0.2, gain: 0.04, swell: true, release: 0.05 });

  // SFX
  put(SFX, 60.8, tom(80, 0.3), { gain: 0.25, rev: 0.1 });
  put2(SFX, 60.8, fwoosh(rngFor('fw60'), 1.0, { peakAt: 0.1 }), { gain: 0.22, rev: 0.1, hall: 0.15 });
  [61.5, 62.5].forEach((t, k) => { put2(SFX, t, wokToss(rngFor('bgToss' + k), 0.65), { gain: 0.16, rev: 0.12, hall: 0.2 }); put2(SFX, t + 0.1, fwoosh(rngFor('bgFire' + k), 0.8), { gain: 0.14, rev: 0.12, hall: 0.2 }); });
  put(SFX, 63.0, stoolScrape(rngFor('standUp'), 0.45), { gain: 0.38, pan: 0.1, rev: 0.1 });
  put(SFX, 63.75, vox(rngFor('let'), { dur: 0.2, pitch: [[0, 200], [0.2, 215]], f1: [[0, 500], [0.2, 550]], f2: [[0, 1800], [0.2, 1750]], f3: [[0, 2500], [0.2, 2500]], breath: 0.15 }), { gain: 0.42, pan: 0.15, rev: 0.12, hall: 0.1 });
  put(SFX, 63.97, vox(rngFor('me'), { dur: 0.18, pitch: [[0, 215], [0.18, 225]], f1: [[0, 300], [0.18, 290]], f2: [[0, 2100], [0.18, 2200]], f3: [[0, 2700], [0.18, 2800]], breath: 0.1, lp: 3200 }), { gain: 0.4, pan: 0.15, rev: 0.12, hall: 0.1 });
  put(SFX, 64.17, vox(rngFor('try'), { dur: 0.42, pitch: [[0, 240], [0.15, 280], [0.42, 250]], f1: [[0, 700], [0.25, 720], [0.42, 380]], f2: [[0, 1150], [0.25, 1250], [0.42, 2100]], f3: [[0, 2500], [0.42, 2700]], breath: 0.22 }), { gain: 0.44, pan: 0.15, rev: 0.12, hall: 0.1 });
  [64.9, 65.2].forEach((t, k) => put(SFX, t, clothSwipe(rngFor('sleeve' + k), 0.28), { gain: 0.32, pan: 0.15, rev: 0.1 }));
  put(SFX, 65.8, metalScrape(rngFor('grabWok'), 0.4), { gain: 0.22, pan: 0.1, rev: 0.12 });
  put(SFX, 66.0, wokKeng(rngFor('grabK'), 1150), { gain: 0.24, pan: 0.1, rev: 0.12 });
  put2(SFX, 66.6, wokToss(rngFor('clumsy'), 0.65), { gain: 0.26, rev: 0.1 });
  put(SFX, 66.95, wokKeng(rngFor('clank'), 980), { gain: 0.24, pan: 0.2, rev: 0.12 });
  put2(SFX, 67.5, fwoosh(rngFor('fwoom'), 2.0, { peakAt: 0.06 }), { gain: 0.55, rev: 0.1, hall: 0.2 });
  put(SFX, 67.5, whoosh(rngFor('fwoomW'), 0.6, 200, 1800, 400, 0.2, 0.9), { gain: 0.22, pan: 0, rev: 0.08, hall: 0.15 });
  put2(SFX, 67.75, sizzle(rngFor('hair'), 2.2), { gain: 0.22, rev: 0.08 });
  put(SFX, 67.8, norm(crackle(rngFor('hairCrk'), 1.8, (u) => 300 * Math.exp(-u / 0.5), (u) => Math.exp(-u / 0.8), 2500, 9000)), { gain: 0.16, pan: 0.1, rev: 0.1 });
  put2(SFX, 68.1, steam(rngFor('hairSmoke'), 2.4), { gain: 0.16, rev: 0.1, hall: 0.2 });
  put(SFX, 68.3, vox(rngFor('ai'), { dur: 0.32, pitch: [[0, 230], [0.12, 290], [0.32, 260]], f1: [[0, 760], [0.2, 700], [0.32, 380]], f2: [[0, 1200], [0.2, 1350], [0.32, 2100]], f3: [[0, 2500], [0.32, 2700]], breath: 0.18 }), { gain: 0.44, pan: -0.3, rev: 0.12, hall: 0.12 });
  put(SFX, 68.68, vox(rngFor('da'), { dur: 0.45, pitch: [[0, 270], [0.45, 190]], f1: [[0, 500], [0.06, 760], [0.45, 700]], f2: [[0, 1600], [0.06, 1250], [0.45, 1200]], f3: [[0, 2500], [0.45, 2500]], breath: 0.18 }), { gain: 0.44, pan: -0.3, rev: 0.12, hall: 0.12 });
  [69.3, 69.7].forEach((t, k) => put(SFX, t, popAccent(rngFor('blink' + k), m2f(90 + 2 * k)), { gain: 0.16, pan: 0.15, rev: 0.1 }));
  put(SFX, 69.9, hiccup(rngFor('cough')), { gain: 0.22, pan: 0.15, rev: 0.1 });   // a sooty little cough
  put(SFX, 70.5, slideWood(rngFor('chair'), 0.4), { gain: 0.3, pan: 0.1, rev: 0.1 });
  put(SFX, 70.9, bowlClack(rngFor('chopsticks'), 3000), { gain: 0.28, pan: 0.1, rev: 0.1 });
  put(SFX, 71.4, heartbeat(), { gain: 0.45, pan: 0, rev: 0.05 });
  put(SFX, 71.7, inhale(rngFor('in71'), 0.45), { gain: 0.38, pan: 0.1, rev: 0.1 });
  put(SFX, 72.2, heartbeat(), { gain: 0.5, pan: 0, rev: 0.05 });
}

// ---------- 73.5 RỘP!: burst, chorus, pull-back, end card, CTA ----------
{
  bigHit(73.5, { chord: [38, 50, 57, 62, 66, 69, 74], root: 38, gongF: 147, gongG: 0.18, boomDur: 2.6, padDur: 2.0, scale: 0.7 });
  xg(73.5, 0.06);
  gliss(73.5, 50, 95, 0.022, 0.04, 'burst', { dur: 1.8, rev: 0.55 });
  erh(73.5, 86, 1.2, { bendFrom: -3, bendTime: 0.15, vib: 0.5, gain: 0.09 });
  zheng(73.5, 81, 1.0, { trem: 16, gain: 0.06 });
  // 75.5–81 chorus: THEME A bars 3–5 at full (erhu + guzheng octave + tranh doubling, pumped pads, gong)
  const CC = bars(75.5, ['G', 'Asus', 'Em']);
  chords([[75.5, 'G', 2], [77.5, 'Asus', 2], [79.5, 'Em', 1.5]], { gain: 0.055, cutoff: 1800, pump: 0.3 });
  const chorus = THEME_A.filter((n) => n[0] >= 8 && n[0] < 19).map(([b, m, d, ex]) => [b - 8, m, Math.min(d, 19 - b), ex]);
  phr(75.5, chorus, erh, { gain: 0.09 });
  phr(75.5, chorus, (t, m, d, o) => zheng(t, m - 12, d, o), { gain: 0.04 });
  phr(75.5, chorus.filter((n) => Number.isInteger(n[0])), (t, m, d) => tr(t, m, d + 0.3, 0.022, 0.35, 0.4));
  groove(74.5, 81, chAt([[74.5, 'D'], ...CC]), { full: true, wbOff: true, walk: true, kick: 0.3, bo: 0.04 });
  zhengBed(CC, { gain: 0.018 });
  // 81–82 pull back along the lantern street: erhu run up the scale, lift into the sting
  SCALE.slice(8, 17).forEach((m, k) => erh(81.0 + k * 0.09, m, 0.09, { gain: 0.05 + 0.004 * k, attack: 0.01, release: 0.03, vib: 0 }));
  chords([[81.0, 'Asus', 1.0]], { gain: 0.05, cutoff: 1800 });
  buildInto(82.0, 1.0, 't82', { riser: 0.08, rc: 0.1 });
  // 82.0 END CARD STING
  bigHit(82.0, { chord: [50, 57, 62, 66, 69, 74], root: 38, gongF: 147, scale: 0.75, padDur: 2.4 });
  xg(82.0, 0.05);
  gliss(82.0, 50, 95, 0.028, 0.032, 'sting', { dur: 1.6, rev: 0.6 });
  erh(82.0, 86, 0.8, { bendFrom: -2, vib: 0.45, gain: 0.075, rev: 0.55 });
  put2(MUSIC, 82.4, pad([50, 57, 62, 66, 69], 2.1, { attack: 0.5, release: 0.4, cutoff: 1100, seed: 'hold' }), { gain: 0.055, rev: 0.5 });
  zheng(82.9, 81, 1.5, { gain: 0.05, rev: 0.6, nhan: 2, nhanAt: 0.4 });
  tr(83.4, 74, 1.2, 0.03, 0.2);
  // 84.5–90 CTA reprise: THEME A bar 1–1.5 softly on guzheng + erhu, the final D rings out from 87.5
  phr(84.5, upTo(THEME_A, 6), erh, { gain: 0.05, rev: 0.55 });
  phr(84.5, upTo(THEME_A, 6), (t, m, d) => tr(t, m, d + 0.4, 0.028, -0.2, 0.5));
  chords([[84.5, 'D', 2.0], [86.5, 'G', 1.0]], { gain: 0.045, cutoff: 1200, attack: 0.2 });
  [84.5, 85.5, 86.5].forEach((t) => put(MUSIC, t, K, { gain: 0.16, rev: 0.05 }));
  [85.0, 86.0, 87.0].forEach((t) => wb(t, true, 0.035));
  bass([[84.5, 38, 0.9], [85.5, 45, 0.9], [86.5, 43, 0.9]], 0.12);
  // final tonic
  erh(87.5, 74, 1.9, { vib: 0.35, gain: 0.06, rev: 0.6, release: 0.5, swell: true });
  [50, 57, 62, 66, 69, 74].forEach((m, k) => tr(87.5 + k * 0.05, m, 2.4, 0.03, -0.4 + 0.16 * k, 0.6));
  put2(MUSIC, 87.5, pad([38, 50, 57, 62, 66, 69], 2.3, { attack: 0.08, release: 0.15, cutoff: 1300, seed: 'fin' }), { gain: 0.06, rev: 0.5 });
  put(MUSIC, 87.5, bassNote(38, 1.6), { gain: 0.14 });
  put2(MUSIC, 87.5, gong(rngFor('gongFin'), 2.4, 147), { gain: 0.05, rev: 0.4 });

  // SFX
  put2(SFX, 73.5, ropCrunch(rngFor('rop')), { gain: 0.46, rev: 0.1 });
  put(SFX, 73.5, crunch(rngFor('bite'), 1.0), { gain: 0.42, pan: 0.05, rev: 0.1 });
  put(SFX, 73.6, norm(crackle(rngFor('crumbs'), 1.2, (u) => 200 * Math.exp(-u / 0.35), (u) => Math.exp(-u / 0.5), 2500, 9000)), { gain: 0.16, pan: 0, rev: 0.12 });
  put2(SFX, 73.6, shimmer(rngFor('lanterns'), 1.8), { gain: 0.22, rev: 0.1, hall: 0.3 });
  put(SFX, 73.55, whoosh(rngFor('burstW'), 0.9, 300, 3000, 900, 0.3, 1.0), { gain: 0.24, pan: (u) => 0.5 - u, rev: 0.05, hall: 0.2 });
  put(SFX, 75.2, vox(rngFor('grin'), { dur: 0.55, pitch: [[0, 200], [0.25, 250], [0.55, 220]], f1: [[0, 300], [0.55, 320]], f2: [[0, 1000], [0.55, 950]], f3: [[0, 2400], [0.55, 2400]], breath: 0.1, lp: 1800 }), { gain: 0.3, pan: 0.1, rev: 0.12, hall: 0.1 });
  [77.0, 77.45, 77.9, 78.6].forEach((t, k) => put(SFX, t, crunch(rngFor('more' + k), 0.55), { gain: 0.38, pan: 0.1, rev: 0.1 }));
  put2(SFX, 77.2, steam(rngFor('hairStill'), 3.0), { gain: 0.1, rev: 0.1, hall: 0.2 });
  put(SFX, 79.2, laugh(rngFor('phatLaugh'), { k: 6, rate: 6, f0: 160 }), { gain: 0.34, pan: -0.3, rev: 0.12, hall: 0.12 });
  [[79.9, 2600], [80.4, 2900]].forEach(([t, f], k) => put(SFX, t, bowlClack(rngFor('eat' + k), f), { gain: 0.26, pan: 0.15, rev: 0.12 }));
  put(SFX, 81.0, whoosh(rngFor('pullW'), 1.0, 250, 2600, 900, 0.7, 0.9), { gain: 0.24, pan: 0, rev: 0.05, hall: 0.25 });
  put2(SFX, 82.0, shimmer(rngFor('shim82'), 1.4), { gain: 0.14, rev: 0.1, hall: 0.3 });
  ctaSfx(74);
}

// ───────────────────────────── 7. Master ─────────────────────────────
// Needs from the score: FILM = { trim: [[t, g]..] music trim keys, windows: [[name, a, b]..] }
const S0 = 73.0, S1 = 73.5;                                  // the hush before the big bite
const I_SF = Math.round((S0 - 0.03) * SR), I_S0 = Math.round(S0 * SR), I_S1 = Math.round(S1 * SR);
const gateS = (i) => (i < I_SF ? 1 : i < I_S0 ? 0.5 + 0.5 * Math.cos(Math.PI * (i - I_SF) / (I_S0 - I_SF)) : i < I_S1 ? 0 : 1);
const FADE0 = 88.7, FADE1 = 89.95;                           // final note rings out, last 50 ms digital zero

// (a) duck the music under foley (≈ −3.5 dB at full) + per-section music trim
const duck = new Float32Array(N);
{
  let e = 0; const at = 1 - Math.exp(-1 / (0.005 * SR)), rl = 1 - Math.exp(-1 / (0.25 * SR));
  for (let i = 0; i < N; i++) {
    const a = Math.max(Math.abs(SFX.L[i]), Math.abs(SFX.R[i]));
    e += (a > e ? at : rl) * (a - e);
    duck[i] = 1 - 0.34 * clamp(e / 0.25, 0, 1);
  }
  for (let i = 0; i < N; i++) duck[i] *= pw(FILM.trim, i / SR);
}
// ambience joins the SFX bus only after the duck key was computed
for (const key of ['L', 'R', 'sL', 'sR', 'hL', 'hR']) for (let i = 0; i < N; i++) SFX[key][i] += AMB[key][i];
// the hush: every bus (dry and sends) is cut to zero on [72.97, 73.5) so nothing feeds the reverbs
for (const bus of [MUSIC, SFX]) for (const key of ['L', 'R', 'sL', 'sR', 'hL', 'hR']) { const x = bus[key]; for (let i = I_SF; i < I_S1; i++) x[i] *= gateS(i); }

// (b) stereo Freeverb-style reverbs (8 damped combs + 4 allpasses per side, pre-delay)
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
// hall: music (ducked) + SFX/AMB hall sends; room: small close space for the foley. Both wiped at 73.0.
const hallInL = new Float32Array(N), hallInR = new Float32Array(N);
for (let i = 0; i < N; i++) { hallInL[i] = MUSIC.hL[i] * duck[i] + SFX.hL[i]; hallInR[i] = MUSIC.hR[i] * duck[i] + SFX.hR[i]; }
const [hallL, hallR] = reverb(hallInL, hallInR, { fb: 0.865, damp: 0.3, pre: 0.028, clearAt: I_S0 });
const [roomL, roomR] = reverb(SFX.sL, SFX.sR, { size: 0.45, fb: 0.72, damp: 0.42, pre: 0.006, hp: 250, lp: 9000, inGain: 1.6, clearAt: I_S0 });

// (c) sum, gentle music-bus saturation, DC/sub high-pass, hush gate, master envelope
let preL = new Float32Array(N), preR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const ml = Math.tanh(MUSIC.L[i] * duck[i] * 1.1) / 1.1, mr = Math.tanh(MUSIC.R[i] * duck[i] * 1.1) / 1.1;
  preL[i] = ml + hallL[i] + SFX.L[i] + roomL[i];
  preR[i] = mr + hallR[i] + SFX.R[i] + roomR[i];
}
preL = filt(preL, 'hp', 24, 0.7); preR = filt(preR, 'hp', 24, 0.7);
const masterEnv = (t) => (t <= FADE0 ? 1 : t >= FADE1 ? 0 : Math.pow(0.5 + 0.5 * Math.cos(Math.PI * (t - FADE0) / (FADE1 - FADE0)), 1.4));
for (let i = 0; i < N; i++) { const g = masterEnv(i / SR) * gateS(i); preL[i] *= g; preR[i] *= g; }

// (d) loudness (ITU-R BS.1770-4 K-weighting, gated integrated) + true-peak helpers
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

// (e) normalise to TARGET_LUFS through the limiter (iterate: limiting lowers loudness slightly)
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

// (f) WAV writer (RIFF / PCM 16-bit / 2ch / 48 kHz) with TPDF dither (true zeros stay zero)
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

// (g) verification: re-read the file and report format, peak, loudness, RMS map, hush + pass/fail
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
    ['silence 73.0-73.5 is digital zero', hushZero],
    ['burst after the hush (73.5-74.0 > -30 dBFS)', rmsW(73.5, 74.0) > -30],
    ['last 0.05 s digital silence', tailZero],
    ['limiter max GR <= 6 dB', -dB(out.minG) <= 6],
  ];
  console.log('self-check:');
  for (const [nm, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${nm}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}
