'use strict';
/*
 * BÚN ĐẬU MẮM TÔM HÀ NỘI / Hanoi Tofu & Noodles with Shrimp Paste — cinematic short soundtrack (60 s)
 * Fully procedural audio in pure Node.js (no packages, no samples).
 * Run:  node audio.js   ->  writes audio.wav (48 kHz, stereo, 16-bit PCM, 60.000 s, ≈ −15 LUFS, ≤ −1.3 dBTP)
 *       DEBUG=1 node audio.js  ->  also prints per-cue foley-vs-music balance and limiter activity
 *
 * Based on ../bunmam/audio.js (same DSP, reverbs, limiter, loudness normalisation, dither, WAV writer,
 * self-check). New colour for Hanoi: northern (Bắc) G pentatonic, sáo trúc (bamboo flute) lead,
 * đàn nguyệt second voice with tremolo, đàn tranh glissandi, mõ + phách rhythm, soft bass.
 * 120 BPM — every scene cut sits on the 0.5 s grid.
 *
 * Layout of this file:
 *   1. Core constants, seeded PRNG, math helpers
 *   2. DSP helpers (biquad filters, noise bursts, wavetables, modal resonators)
 *   3. Instruments  (đàn tranh pluck, pad/strings, drone, drums, mõ, bass)
 *   4. Sound effects (generic foley kept from the earlier films)
 *   4b. New: sáo trúc, đàn nguyệt, phách, gong, comic reed, Hanoi street, fry / knife / whisk foley, comedy
 *   5. Mix buses (MUSIC, SFX, AMB) + put()
 *   6. Score / cue list (ambience, Act 1 Hanoi noon, Act 2 building the tray, Act 3 panic → splat → love)
 *   7. Master: ducking, smell pitch-warp, music gate, room + hall reverbs, loudness normalise,
 *      true-peak limiter, fade, WAV writer, verification report + pass/fail self-check
 */
const fs = require('fs');
const path = require('path');

// ───────────────────────────── 1. Core ─────────────────────────────
const SR = 48000;
const DUR = 60.0;
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
const rngFor = (name) => mulberry32(hashStr('bundau:' + name));   // independent deterministic stream per cue

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

// ───────────────────────────── 6. Score ─────────────────────────────
console.time('render');
// G "Bắc" pentatonic (G A C D E): the bright northern colour (bún mắm used the D-minor "oán" mode)
const SCALE = [55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91];
const V = { G: [55, 59, 62, 67, 71], C: [52, 55, 60, 64, 67], Am: [52, 57, 60, 64, 69], D: [50, 57, 62, 66, 69], Em: [52, 55, 59, 64, 67] };
const ROOT = { G: 43, C: 36, Am: 45, D: 38, Em: 40 };
const FIFTH = { G: 50, C: 43, Am: 52, D: 45, Em: 47 };
const pumpAt = (tAbs, depth = 0.3) => {
  const tb = ((tAbs % BEAT) + BEAT) % BEAT;
  const d = tb < 0.008 ? smooth(tb / 0.008) : Math.exp(-(tb - 0.008) / 0.11);
  return 1 - depth * d;
};
function flute(t, midi, dur, o = {}) {   // sáo trúc lead, right of centre
  put(MUSIC, t, sao(midi, dur, { seed: 'f' + t.toFixed(3), ...o }), { gain: o.gain ?? 0.13, pan: o.pan ?? 0.14, rev: o.rev ?? 0.4 });
}
const fluteP = (list, o = {}) => list.forEach(([t, m, d, ex]) => flute(t, m, d, { ...o, ...(ex || {}) }));
function nguyet(t, midi, dur, o = {}) {  // đàn nguyệt second voice, left of centre
  put(MUSIC, t, kim(midi, dur, { nguyet: true, seed: 'n' + t.toFixed(3), ...o }), { gain: o.gain ?? 0.06, pan: o.pan ?? -0.35, rev: o.rev ?? 0.3 });
}
const nguyetP = (list, o = {}) => list.forEach(([t, m, d, ex]) => nguyet(t, m, d, { ...o, ...(ex || {}) }));
function tranhNote(t, midi, dur, gain, pan, seed, rev = 0.45) {
  put(MUSIC, t, tranh(midi, dur, rngFor('tr' + seed + t), {}), { gain, pan, rev });
}
/* đàn tranh glissando through SCALE from note `from` to note `to` */
function gliss(t0, from, to, step, gain, seed, o = {}) {
  const a = SCALE.indexOf(from), b = SCALE.indexOf(to);
  if (a < 0 || b < 0) throw new Error('gliss: notes must be in SCALE');
  const dir = b >= a ? 1 : -1, cnt = Math.abs(b - a), p0 = o.pan0 ?? -0.6, p1 = o.pan1 ?? 0.6;
  for (let k = 0; k <= cnt; k++) tranhNote(t0 + k * step, SCALE[a + dir * k], o.dur ?? 1.2, gain * (o.cresc ? 0.7 + 0.3 * k / Math.max(1, cnt) : 1), p0 + (p1 - p0) * k / Math.max(1, cnt), seed + k, o.rev ?? 0.5);
}
const K = kick({ decay: 0.2, click: 0.2 }), KG = kick({ decay: 0.14, seed: 'g', click: 0.12 }), KD = kick({ decay: 0.3, fEnd: 42, seed: 'd' });
const MO_HI = mo(rngFor('moH'), 980), MO_LO = mo(rngFor('moL'), 700);
const PH = [0, 1, 2, 3].map((k) => phach(rngFor('ph' + k), false)), PHA = [0, 1].map((k) => phach(rngFor('pha' + k), true));
const ph = (t, acc, gain) => put(MUSIC, t, acc ? PHA[Math.round(t * 8) & 1] : PH[Math.round(t * 8) & 3], { gain, pan: 0.38, rev: 0.18 });
const cutTing = (t, midi, pan) => put(MUSIC, t, ting(m2f(midi), 0.6), { gain: 0.03, pan, rev: 0.6 });

// ambience: everything through putAmb follows one envelope (street at noon → kitchen focus →
// gone for the silence → faint during the bite → back in full for the crane-up from 56.2)
const ambEnv = (t) => pw([[0, 0], [0.6, 0.75], [2.0, 1], [9.8, 1], [10.4, 0.42], [38.0, 0.42], [38.6, 0.55], [46.6, 0.5], [46.95, 0], [48.5, 0], [48.7, 0.28], [56.2, 0.28], [57.2, 1.0], [60, 1.0]], t);
function putAmb(t0, sig, o = {}) { const s = Float32Array.from(sig); mulEnv(s, (t) => ambEnv(t0 + t)); put(AMB, t0, s, o); }
function put2Amb(t0, [L, R], o = {}) { const a = Float32Array.from(L), b = Float32Array.from(R); mulEnv(a, (t) => ambEnv(t0 + t)); mulEnv(b, (t) => ambEnv(t0 + t)); put(AMB, t0, a, { ...o, right: b }); }
function sparrowAt(t, gain, pan, seed) { putAmb(t, sparrow(rngFor('sp' + seed)), { gain, pan, rev: 0.2, hall: 0.35 }); }

// ---------- AMBIENCE: Hanoi old quarter at noon (own bus, never keys the duck) ----------
{
  put2Amb(0, cityHum(rngFor('city'), 60), { gain: 0.19, rev: 0.03, hall: 0.05 });
  put2Amb(0, windLeaves(rngFor('wind'), 60), { gain: 0.14, rev: 0.02, hall: 0.05 });
  // distant motorbikes criss-crossing the lanes
  const RB = rngFor('bikes');
  [[0.4, 1], [2.2, -1], [6.2, 1], [8.4, -1], [12.5, 1], [17.6, -1], [23.0, 1], [29.4, -1], [35.2, 1], [41.0, -1], [44.8, 1], [50.2, -1], [53.6, 1], [56.4, -1], [58.0, 1]].forEach(([t, dir], k) => {
    const d = 2.4 + RB() * 1.2;
    const [L, R] = scooter(RB, d, { dir, f0: 68 + RB() * 30, v: 8 + RB() * 4, d: 7 + RB() * 6 });
    const bell = (tt) => Math.pow(Math.sin(Math.PI * clamp(tt / d, 0, 1)), 1.2);
    mulEnv(L, bell); mulEnv(R, bell);
    put2Amb(t, [L, R], { gain: 0.07 + 0.03 * RB(), rev: 0.05, hall: 0.25 });
  });
  [[2.9, 415, -0.6], [19.6, 466, 0.5], [30.8, 440, -0.4], [57.9, 415, 0.6]].forEach(([t, f, p]) => putAmb(t, horn(0.11, f), { gain: 0.03, pan: p, rev: 0.2, hall: 0.5 }));
  // sparrows: lively at noon, sparse under the kitchen, back for the crane-up
  const RS = rngFor('sparrows');
  [[0.3, -0.6], [0.9, 0.5], [1.6, -0.2], [2.3, 0.7], [4.9, -0.7], [6.3, 0.6], [7.9, -0.5], [8.6, 0.4], [9.6, -0.3],
    [12.7, 0.6], [17.2, -0.6], [21.3, 0.5], [26.1, -0.5], [29.8, 0.6], [33.5, -0.6], [36.9, 0.5], [39.2, -0.5], [43.1, 0.6],
    [50.8, -0.6], [53.3, 0.6], [55.2, -0.4], [56.4, 0.6], [57.1, -0.5], [57.8, 0.3], [58.3, -0.7], [58.9, 0.5]].forEach(([t, p], k) =>
    sparrowAt(t, 0.05 * (0.7 + 0.3 * RS()), p, 'a' + k));
  // a street vendor far down the lane: one sung syllable
  putAmb(4.4, vendorCall(rngFor('vend1')), { gain: 0.06, pan: -0.55, rev: 0.25, hall: 0.6 });
  putAmb(58.0, vendorCall(rngFor('vend2'), { dur: 1.0, pitch: [[0, 330], [0.1, 392], [0.5, 392], [1.0, 294]] }), { gain: 0.045, pan: 0.5, rev: 0.25, hall: 0.6 });
}

// ---------- ACT 1 : Hanoi noon (0–10) ----------
{
  // MUSIC: drone + pad fade in from silence, soft flute intro, tranh arpeggio
  put(MUSIC, 0.0, drone(10.0, { attack: 3.0, release: 0.3, midi: 43 }), { gain: 0.055, rev: 0.15 });
  put2(MUSIC, 0.0, pad([55, 62, 67, 71, 74], 3.05, { attack: 2.6, release: 0.5, cutoff: 900, seed: 'i1' }), { gain: 0.08, rev: 0.4 });
  put2(MUSIC, 3.0, pad(V.C, 2.5, { attack: 0.35, release: 0.3, cutoff: 1200, seed: 'i2' }), { gain: 0.06, rev: 0.4 });
  put2(MUSIC, 5.5, pad(V.G, 2.5, { attack: 0.3, release: 0.3, cutoff: 1200, seed: 'i3', env: (t) => 1 - 0.55 * smooth((t - 0.95) / 0.1) * (1 - smooth((t - 1.45) / 0.15)) }), { gain: 0.06, rev: 0.4 });
  put2(MUSIC, 8.0, pad(V.Am, 0.98, { attack: 0.3, release: 0.1, cutoff: 1100, seed: 'i4' }), { gain: 0.065, rev: 0.4 });
  put2(MUSIC, 9.0, pad(V.D, 1.0, { attack: 0.2, release: 0.05, cutoff: 1300, seed: 'i5', env: (t) => 0.8 + 0.5 * smooth((t - 0.3) / 0.65) }), { gain: 0.07, rev: 0.4 });
  fluteP([
    [0.75, 74, 0.95, { bendFrom: -2, bendTime: 0.22, attack: 0.12 }],
    [1.75, 76, 0.25, { grace: 3 }], [2.0, 74, 0.22], [2.25, 72, 0.22],
    [2.5, 79, 0.85, { bendFrom: -3, bendTime: 0.15, vib: 0.3, release: 0.2 }],
  ], { gain: 0.12, rev: 0.5 });
  [55, 62, 67, 69, 74, 76, 79, 74].forEach((m, k) => tranhNote(0.4 + k * 0.3, m, 1.4, 0.028, 0.45 - 0.11 * k, 'arp' + k, 0.5));

  // 3–5.5 the lane: walking đàn nguyệt plucks, light mõ, flute pickup before the bike
  fluteP([[3.0, 76, 0.18], [3.25, 79, 0.22, { grace: 2 }]], { gain: 0.1 });
  [67, 74, 72, 74, 67, 74, 76, 74, 67, 74].forEach((m, k) => nguyet(3.0 + k * 0.25, m, 0.2, { gain: 0.05 }));
  for (let t = 3.0; t < 5.5 - 1e-6; t += BEAT) put(MUSIC, t, (t * 2) % 2 ? MO_LO : MO_HI, { gain: 0.05, pan: -0.2, rev: 0.3 });
  [[3.0, 36], [4.0, 43], [5.0, 38]].forEach(([t, m]) => put(MUSIC, t, bassNote(m, 0.4), { gain: 0.14 }));

  // 5.5–8 the tiny stool: tiptoe descent, a hush for the creak + bwomp, then a chuckle
  fluteP([[5.5, 79, 0.1], [5.75, 76, 0.1], [6.0, 74, 0.1], [6.25, 72, 0.12, { endBend: -1, endBendTime: 0.08 }]], { gain: 0.1, attack: 0.012, release: 0.05 });
  [[5.5, 67], [5.75, 74], [6.0, 67], [6.25, 74]].forEach(([t, m]) => nguyet(t, m, 0.15, { gain: 0.04 }));
  nguyetP([[7.0, 74, 0.12, { nhan: 1, nhanAt: 0.2, nhanLen: 0.08 }], [7.125, 76, 0.1], [7.25, 74, 0.1], [7.375, 72, 0.1], [7.75, 67, 0.2]], { gain: 0.055 });
  flute(7.5, 72, 0.4, { bendFrom: -1, endBend: 2, endBendTime: 0.15, gain: 0.1 });   // "hm?"
  [[5.5, 43], [6.0, 50], [7.0, 43], [7.5, 50]].forEach(([t, m]) => put(MUSIC, t, bassNote(m, 0.35), { gain: 0.14 }));
  [5.5, 6.0, 7.0, 7.5].forEach((t) => put(MUSIC, t + 0.25, MO_HI, { gain: 0.045, pan: -0.2, rev: 0.3 }));

  // 8–10 the mẹt: shimmering tranh, swell, flute run up into the title
  [69, 72, 76, 81, 76, 72, 69, 72].forEach((m, k) => tranhNote(8.0 + k * 0.125, m, 0.8, 0.026, 0.5 - 0.12 * k, 'mt' + k, 0.5));
  [62, 69, 74, 81, 74, 69].forEach((m, k) => tranhNote(9.0 + k * 0.083, m, 0.6, 0.026, -0.5 + 0.2 * k, 'md' + k, 0.5));
  put(MUSIC, 9.0, riser(rngFor('riser1'), 1.0, 260, 7000), { gain: 0.12, pan: (t) => 0.3 * Math.sin(TAU * 0.8 * t), rev: 0.3 });
  put2(MUSIC, 9.2, reverseCrash(rngFor('rc1'), 0.8), { gain: 0.13, rev: 0.2 });   // cymbal swell into the hit
  [74, 76, 79, 81, 84, 86].forEach((m, k) => flute(9.55 + k * 0.07, m, 0.075, { gain: 0.08 + 0.008 * k, attack: 0.008, release: 0.03, vib: 0 }));
  [[9.5, 147], [9.625, 123], [9.75, 98], [9.875, 82]].forEach(([t, f]) => put(MUSIC, t, tom(f, 0.22), { gain: 0.1 + (t - 9.5) * 0.25, pan: 0.3 - (t - 9.5) * 1.6, rev: 0.25 }));

  // TITLE HIT 10.0: boom + big drum + gong + crash + tranh glissando + flute trill
  put(MUSIC, 10.0, bigBoom(rngFor('boom10'), 2.2), { gain: 0.5, rev: 0.15 });
  put(MUSIC, 10.0, tom(66, 0.5), { gain: 0.3, rev: 0.25 });            // trống cái
  put2(MUSIC, 10.0, gong(rngFor('gong10'), 3.2, 174), { gain: 0.15, rev: 0.4 });
  put2(MUSIC, 10.0, crash(rngFor('c10'), 2.2), { gain: 0.08, rev: 0.4 });
  put2(MUSIC, 10.0, pad([55, 62, 67, 71, 74, 79], 1.95, { attack: 0.03, release: 0.3, cutoff: 2600, detune: 9, seed: 'title' }), { gain: 0.1, rev: 0.45 });
  put(MUSIC, 10.0, bassNote(43, 0.9), { gain: 0.26 });
  gliss(10.0, 55, 91, 0.03, 0.04, 'tg', { dur: 1.6, rev: 0.55 });
  flute(10.0, 86, 0.9, { trill: 2, trillRate: 13, trillAt: 0.12, trillEnd: 0.6, vib: 0.25, gain: 0.13, rev: 0.5 });
  nguyet(10.0, 79, 0.9, { trem: 14, gain: 0.07 });
  fluteP([[10.95, 84, 0.2], [11.15, 81, 0.2], [11.35, 79, 0.15], [11.5, 81, 0.45, { mordent: 2 }]], { gain: 0.11, rev: 0.45 });

  // SFX
  // 3.4–4.2 close motorbike pass-by L → R (+ a friendly toot)
  put2(SFX, 3.4, scooter(rngFor('bike'), 0.8, { dir: 1, f0: 92, v: 13, d: 1.6 }), { gain: 0.55, rev: 0.06, hall: 0.06 });
  put(SFX, 3.62, horn(0.09, 466), { gain: 0.08, pan: -0.35, rev: 0.1 });
  // 5.5–8 the stool: pulled out, "cót" 6.6, bassoon "bwomp" 6.7, small creak 7.4
  put(SFX, 5.85, stoolScrape(rngFor('scrape'), 0.35), { gain: 0.22, pan: 0.1, rev: 0.2 });
  put(SFX, 6.6, creak(rngFor('cot'), 0.22, { rate: (u) => 60 + 380 * Math.pow(Math.sin(Math.PI * u), 1.2), modes: [[540, 8, 1], [1260, 9, 0.7], [2700, 10, 0.35]], scrape: 0.04 }), { gain: 0.55, pan: 0.05, rev: 0.2 });
  put(SFX, 6.7, bwomp(), { gain: 0.5, pan: 0, rev: 0.15, hall: 0.12 });
  put(SFX, 7.4, creak(rngFor('cot2'), 0.14, { rate: (u) => 80 + 300 * Math.sin(Math.PI * u), modes: [[600, 8, 1], [1400, 9, 0.6], [2900, 10, 0.3]], scrape: 0.03 }), { gain: 0.4, pan: 0.1, rev: 0.2 });
  // 8–10 the mẹt: banana-leaf "phạch" + whip pan
  put(SFX, 9.0, leafSlap(rngFor('leaf')), { gain: 0.8, pan: 0.05, rev: 0.18 });
  put(SFX, 9.0, whoosh(rngFor('whip'), 0.3, 500, 5200, 1500, 0.55, 0.9), { gain: 0.36, pan: (t) => -0.9 + 6 * t, rev: 0.05, hall: 0.1 });
}

// ---------- ACT 2 : building the tray (10–38) ----------
{
  const harm = [[10, 'G', 2], [12, 'C', 2], [14, 'Am', 2], [16, 'D', 2], [18, 'G', 2], [20, 'C', 2], [22, 'Em', 2], [24, 'D', 2], [26, 'G', 2],
    [28, 'C', 2], [30, 'Am', 1], [31, 'D', 1], [32, 'G', 1], [33, 'D', 1], [34, 'C', 1], [35, 'D', 1], [36, 'Em', 1], [37, 'D', 1]];
  const airy = (T) => T >= 28 && T < 31;
  harm.forEach(([T, ch, d]) => {
    if (T === 10) return;   // title pad covers 10–12
    const cut = airy(T) ? 2400 : T >= 34 ? 2200 + 400 * (T - 34) : 1500;
    const gn = airy(T) ? 0.055 : T >= 34 ? 0.08 : 0.06;
    put2(MUSIC, T, pad(V[ch], d - 0.03, { attack: airy(T) ? 0.4 : 0.08, release: 0.15, cutoff: cut, pump: airy(T) ? null : (t) => pumpAt(T + t, 0.25), seed: 'h' + T }), { gain: gn, rev: airy(T) ? 0.5 : 0.3 });
  });
  put2(MUSIC, 34.0, pad([62, 67, 74, 79], 4.0, { attack: 2.4, release: 0.1, cutoff: 4500, tab: TAB_STR, vib: 13, detune: 9, seed: 'hero' }), { gain: 0.05, rev: 0.5 });

  // drums: Bắc groove = soft kick on 1 & 3, mõ on 2 & 4, syncopated phách
  const PH_PAT = [[0, 1], [0.375, 0], [0.75, 0], [1.0, 1], [1.25, 0], [1.375, 0], [1.75, 0]];
  const groove = (t0, t1, o = {}) => {
    const kg = o.kick ?? 0.3, pg = o.ph ?? 0.075, mg = o.mo ?? 0.09;
    for (let t = t0; t < t1 - 1e-6; t += BAR) {
      const at = (d, f) => { if (t + d < t1 - 1e-6) f(t + d); };
      at(0, (x) => put(MUSIC, x, K, { gain: kg, rev: 0.03 }));
      at(1.0, (x) => put(MUSIC, x, K, { gain: kg * 0.85, rev: 0.03 }));
      at(0.75, (x) => put(MUSIC, x, KG, { gain: kg * 0.3, rev: 0.03 }));
      at(0.5, (x) => put(MUSIC, x, MO_HI, { gain: mg, pan: -0.25, rev: 0.28 }));
      at(1.5, (x) => put(MUSIC, x, MO_LO, { gain: mg, pan: -0.25, rev: 0.28 }));
      at(1.75, (x) => put(MUSIC, x, MO_HI, { gain: mg * 0.45, pan: -0.25, rev: 0.28 }));
      PH_PAT.forEach(([d, acc]) => at(d, (x) => ph(x, acc, acc ? pg * 1.25 : pg)));
    }
  };
  groove(10.0, 28.0); groove(31.0, 34.0, { ph: 0.085 });
  [28.0, 30.0].forEach((t) => put(MUSIC, t, K, { gain: 0.22, rev: 0.03 }));       // shrimp paste: airy
  [28.5, 29.5, 30.5].forEach((t) => put(MUSIC, t, MO_LO, { gain: 0.06, pan: -0.25, rev: 0.35 }));
  // 34–38 fullest: kick every beat, mõ off-beats, phách 16ths, toms into 38
  for (let t = 34.0; t < 38.0 - 1e-6; t += BEAT) { put(MUSIC, t, K, { gain: 0.36, rev: 0.03 }); put(MUSIC, t + 0.25, (t * 2) % 2 ? MO_LO : MO_HI, { gain: 0.08, pan: -0.25, rev: 0.28 }); }
  for (let t = 34.0; t < 37.5 - 1e-6; t += 0.125) { const k = Math.round((t - 34) / 0.125) % 4; ph(t, k === 0, k === 0 ? 0.09 : k === 2 ? 0.065 : 0.045); }
  [[37.5, 147], [37.625, 123], [37.75, 98], [37.875, 82]].forEach(([t, f]) => put(MUSIC, t, tom(f, 0.25), { gain: 0.14 + (t - 37.5) * 0.2, pan: 0.4 - (t - 37.5) * 2, rev: 0.25 }));
  put(MUSIC, 36.0, riser(rngFor('riser36'), 2.0, 300, 8000), { gain: 0.08, rev: 0.3 });
  put2(MUSIC, 37.2, reverseCrash(rngFor('rc38'), 0.8), { gain: 0.09, rev: 0.25 });

  // soft bass
  const pat = [[0, 'r', 0.4], [0.75, 'r', 0.2], [1.0, 'f', 0.4], [1.5, 'o', 0.2], [1.75, 'f', 0.2]];
  harm.forEach(([T, ch, d]) => {
    const r = ROOT[ch], f = FIFTH[ch];
    if (airy(T)) { put(MUSIC, T, bassNote(r, d - 0.15), { gain: 0.15 }); return; }
    if (T >= 34) { for (let t = T; t < T + d - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - T) / 0.25) % 2 ? r + 12 : r, 0.2), { gain: 0.21 }); return; }
    for (const [off, k, dd] of pat) { if (off >= d - 1e-6) continue; put(MUSIC, T + off, bassNote(k === 'r' ? r : k === 'f' ? f : r + 12, dd), { gain: 0.2 }); }
  });

  // đàn nguyệt 8th-note ostinato (rests through the pork chops, where it plays off-beat stabs instead)
  const patIdx = [0, 2, 1, 2, 3, 2, 1, 2];
  const NG_BASE = { G: 67, C: 72, Am: 69, D: 74, Em: 76 };
  harm.forEach(([T, ch, d]) => {
    if (T < 12 || airy(T) || T >= 34) return;
    const base = SCALE.indexOf(NG_BASE[ch]);
    for (let k = 0; k * 0.25 < d - 1e-6; k++) {
      const t = T + k * 0.25;
      if (t >= 19.25 && t < 22.0) continue;
      const soft = t >= 22 && t < 28;
      nguyet(t, SCALE[Math.min(SCALE.length - 1, base + patIdx[k % 8] - 2)], 0.22, { gain: soft ? 0.03 : 0.04, pan: -0.38 });
    }
  });
  [[19.75, 74], [20.25, 76], [20.75, 79], [21.25, 81], [21.75, 84]].forEach(([t, m]) => nguyet(t, m, 0.15, { gain: 0.055 }));
  nguyetP([[34.0, 67, 0.95, { trem: 14 }], [35.0, 69, 0.95, { trem: 14 }], [36.0, 71, 0.95, { trem: 15 }], [37.0, 74, 0.45, { trem: 15 }], [37.5, 76, 0.45, { trem: 16 }]], { gain: 0.05 });

  // sáo trúc phrases (leaving room for the key foley hits)
  fluteP([
    [12.0, 76, 0.45, { bendFrom: -2 }], [12.5, 79, 0.2], [12.75, 76, 0.2], [13.0, 74, 0.45, { mordent: 2 }], [13.75, 72, 0.22],
    [14.0, 69, 0.45, { grace: 3 }], [14.5, 72, 0.22], [14.75, 74, 0.22], [15.5, 76, 0.45, { endBend: -2, endBendTime: 0.15 }],
    [16.0, 81, 0.95, { bendFrom: -2, vib: 0.3 }], [17.0, 79, 0.22], [17.25, 76, 0.22], [17.75, 74, 0.22],
    [18.0, 79, 0.2], [18.25, 81, 0.2], [18.5, 84, 0.45, { grace: 2 }], [19.0, 81, 0.2], [19.25, 79, 0.18],
    [22.0, 76, 0.45, { bendFrom: -2 }], [22.75, 79, 0.2], [23.0, 76, 0.45], [23.75, 74, 0.2], [24.0, 72, 0.45, { mordent: 2 }], [24.75, 74, 0.22],
    [25.0, 79, 0.4], [26.0, 81, 0.4], [27.0, 84, 0.4, { mordent: 2 }],
    // 28–31 the purple paste: a suspicious, bent "uh-oh"
    [28.0, 72, 0.9, { bendFrom: 2, bendTime: 0.3, endBend: -1, vib: 0.35 }], [29.0, 69, 0.4, { grace: -2 }], [30.75, 76, 0.2],
    // 31–33 whisking: busy little figures
    [31.0, 79, 0.2], [31.25, 81, 0.2], [31.5, 79, 0.2], [31.75, 76, 0.2], [32.0, 79, 0.45, { trill: 2 }], [32.5, 81, 0.2], [32.75, 84, 0.3, { endBend: 1 }],
  ], { gain: 0.12 });
  fluteP([   // 34–38 the full theme
    [34.0, 79, 0.45, { bendFrom: -3 }], [34.5, 81, 0.2], [34.75, 84, 0.2], [35.0, 86, 0.95, { mordent: 2, vib: 0.3 }],
    [36.0, 88, 0.45, { grace: 3 }], [36.5, 86, 0.2], [36.75, 84, 0.2], [37.0, 86, 0.45, { trill: 2, trillAt: 0.05 }], [37.5, 88, 0.2], [37.75, 91, 0.2],
  ], { gain: 0.135, rev: 0.45 });
  // herb pops: tranh + nguyệt answer the pops on 25.5 / 26.5 / 27.5
  [[25.5, 79], [26.5, 81], [27.5, 86]].forEach(([t, m], k) => { tranhNote(t, m, 0.9, 0.05, 0.3 - 0.3 * k, 'pop' + k, 0.5); nguyet(t, m - 12, 0.3, { gain: 0.05 }); });
  // tranh glissandi at shot changes, and a rising one on each tray placement 34.5–37.5
  gliss(18.0, 67, 86, 0.03, 0.03, 'g18', { dur: 1.0 });
  gliss(26.0, 67, 84, 0.03, 0.028, 'g26', { dur: 1.0 });
  [34.5, 35.0, 35.5, 36.0, 36.5, 37.0, 37.5].forEach((t, k) => gliss(t, SCALE[3 + k], SCALE[6 + k], 0.035, 0.036 + 0.003 * k, 'pl' + k, { dur: 0.9, pan0: -0.4, pan1: 0.4 }));
  // comic rising whistle 33.2–34.0
  put(MUSIC, 33.2, slideWhistle(rngFor('whistle'), 0.8, 600, 2350), { gain: 0.09, pan: 0.2, rev: 0.25 });
  // shot-cut tings
  [[13.0, 91], [16.0, 93], [19.0, 96], [22.0, 98], [25.0, 96], [28.0, 100], [31.0, 98], [34.0, 103]].forEach(([t, m], i) => cutTing(t, m, i % 2 ? -0.5 : 0.5));

  // 38.0 the tray arrives: landing chord, high flute G, falling glissando, then a still "wow"
  put(MUSIC, 38.0, bigBoom(rngFor('boom38'), 1.6, { decay: 0.4 }), { gain: 0.33, rev: 0.15 });
  put(MUSIC, 38.0, K, { gain: 0.36, rev: 0.03 });
  put2(MUSIC, 38.0, crash(rngFor('c38'), 1.8), { gain: 0.09, rev: 0.4 });
  put2(MUSIC, 38.0, gong(rngFor('gong38'), 2.4, 196), { gain: 0.07, rev: 0.4 });
  put2(MUSIC, 38.0, pad([55, 62, 67, 71, 74, 79], 0.6, { attack: 0.02, release: 0.4, cutoff: 3200, detune: 9, seed: 'land' }), { gain: 0.1, rev: 0.45 });
  put(MUSIC, 38.0, bassNote(43, 0.45), { gain: 0.25 });
  flute(38.0, 91, 1.4, { bendFrom: -2, bendTime: 0.12, vib: 0.32, gain: 0.12, rev: 0.55, release: 0.3 });
  nguyet(38.0, 79, 0.9, { trem: 15, gain: 0.06 });
  gliss(38.05, 88, 67, 0.035, 0.035, 'ld', { dur: 1.4, pan0: 0.6, pan1: -0.6, rev: 0.55 });
  put2(MUSIC, 38.5, pad([55, 62, 64, 67, 71, 76], 2.0, { attack: 0.5, release: 0.4, cutoff: 2600, tab: TAB_STR, vib: 10, detune: 9, seed: 'wow' }), { gain: 0.06, rev: 0.55 });
  put(MUSIC, 38.5, bassNote(43, 1.8), { gain: 0.14 });
  [79, 83, 86, 88, 91, 88, 86, 83].forEach((m, k) => tranhNote(38.75 + k * 0.2, m, 1.0, 0.024, k % 2 ? 0.5 : -0.5, 'wow' + k, 0.6));
  fluteP([[39.5, 84, 0.45, { grace: 2 }], [40.0, 81, 0.45, { endBend: -1, endBendTime: 0.2 }]], { gain: 0.1, rev: 0.5 });

  // ---- foley (the star) ----
  // 10.6–19.1 frying: one continuous oil bed (tofu, then the green rice patties)
  const fry = fryBed(rngFor('fry'), 8.5);
  const fEnv = (t) => pw([[0, 0], [0.05, 0.85], [2.2, 1], [2.4, 0.8], [5.3, 0.8], [5.45, 1.0], [8.1, 0.9], [8.5, 0]], t);
  mulEnv(fry[0], fEnv); mulEnv(fry[1], fEnv);
  put2(SFX, 10.6, fry, { gain: 0.36, rev: 0.08 });
  [10.6, 11.2, 11.8].forEach((t, k) => put2(SFX, t, fryBurst(rngFor('tofu' + k)), { gain: 0.65, rev: 0.12 }));
  // 13–16 flipping, the cut, steam
  put2(SFX, 13.0, steam(rngFor('steam1'), 3.0), { gain: 0.12, rev: 0.12 });
  [13.5, 14.5].forEach((t, k) => put2(SFX, t, flipClink(rngFor('flip' + k)), { gain: 0.42, rev: 0.15 }));
  put(SFX, 15.2, knifeSht(rngFor('sht')), { gain: 0.8, pan: 0.05, rev: 0.12 });
  // 16–19 rice patties: a softer fresh sizzle as they go in, spatula presses on 16.5 / 17.5 / 18.5
  put2(SFX, 16.0, fryBurst(rngFor('patty'), 0.8, { plop: false }), { gain: 0.38, rev: 0.12 });
  [16.5, 17.5, 18.5].forEach((t, k) => put(SFX, t, pressSquish(rngFor('press' + k)), { gain: 0.6, pan: [-0.12, 0.12, 0][k], rev: 0.14 }));
  // 19–22 knife slicing boiled pork on wood: impacts exactly on the half-beats
  [19.5, 20.0, 20.5, 21.0, 21.5].forEach((t, k) => put(SFX, t - CHOP_PRE, boardChop(rngFor('chop' + k)), { gain: 1.0, pan: k % 2 ? 0.08 : -0.08, rev: 0.15 }));
  // 22–25 pressed noodle sheet: soft wet "thup"
  [22.5, 23.5, 24.5].forEach((t, k) => put(SFX, t, wetThup(rngFor('thup' + k)), { gain: 0.8, pan: [-0.1, 0.1, 0][k], rev: 0.14 }));
  // 25–28 herb basket: leaf rustle + pops (tuned to G5 / A5 / D6)
  put2(SFX, 25.0, rustle(rngFor('herbs'), 3.0), { gain: 0.36, rev: 0.12 });
  [[25.5, 79], [26.5, 81], [27.5, 86]].forEach(([t, m], k) => put(SFX, t, popAccent(rngFor('pop' + k), m2f(m)), { gain: 0.42, pan: [-0.25, 0.2, 0][k], rev: 0.15 }));
  // 28–31 shrimp paste glug, lime squirt, sugar, chili
  put2(SFX, 28.3, glug(rngFor('glug'), 0.7), { gain: 0.55, rev: 0.14 });
  put(SFX, 29.6, limeSquirt(rngFor('lime')), { gain: 0.8, pan: 0.15, rev: 0.14 });
  put(SFX, 30.1, powderPour(rngFor('sugar'), 0.35), { gain: 0.38, pan: -0.1, rev: 0.12 });
  put(SFX, 30.5, wetPlop(rngFor('chili'), 330), { gain: 0.6, pan: 0.05, rev: 0.14 });
  // 31–34 chopsticks whisking furiously in a ceramic bowl: accelerating clacks + building foam
  const CL = [2700, 2950, 3150, 2850, 3050, 2800].map((f, k) => bowlClack(rngFor('cl' + k), f));
  { let t = 31.05, k = 0; while (t < 34.0) { const u = (t - 31) / 3; put(SFX, t, CL[k % 6], { gain: 0.4 * (0.85 + 0.3 * ((k * 7) % 5) / 4), pan: (k % 2 ? 0.12 : -0.12), rev: 0.14 }); t += 1 / (5 + 9 * Math.pow(u, 1.2)); k++; } }
  put2(SFX, 31.3, foam(rngFor('foam1'), 2.8), { gain: 0.35, rev: 0.12 });
  // 34–38 arranging the tray: soft placements on every beat (the mắm bowl last)
  [34.5, 35.0, 35.5, 36.0, 36.5, 37.0].forEach((t, k) => put(SFX, t, placeSoft(rngFor('place' + k), k % 3), { gain: 0.72, pan: [-0.3, 0.25, -0.1, 0.3, -0.2, 0.15][k], rev: 0.15 }));
  put(SFX, 37.5, ceramic(rngFor('bowl'), 1500, 0.8), { gain: 0.5, pan: 0, rev: 0.15 });
  // 38.0 tray slides in front of him, sparkle 38.7
  put(SFX, 38.0, slideWood(rngFor('slide'), 0.6), { gain: 0.55, pan: (t) => 0.5 - 1.2 * t, rev: 0.12 });
  put(SFX, 38.0, whoosh(rngFor('trayw'), 0.6, 300, 1800, 500, 0.45, 1.0), { gain: 0.16, pan: (t) => 0.4 - t, rev: 0.08 });
  put2(SFX, 38.7, shimmer(rngFor('sparkle'), 1.4), { gain: 0.16, hall: 0.5 });
  [[38.7, 98], [38.78, 103], [38.86, 100]].forEach(([t, m], k) => put(SFX, t, ting(m2f(m), 0.6), { gain: 0.04, pan: [-0.3, 0.3, 0][k], rev: 0.2, hall: 0.5 }));
}

// ---------- ACT 3 : purple panic, splat, then love (38–60) ----------
{
  // 40.5–43.5 the smell wave; music warps 40.9–41.9 (master); two drooping wah-wahs 42.0 / 42.4
  put2(MUSIC, 40.5, pad([57, 60, 64, 69], 1.95, { attack: 0.25, release: 0.3, cutoff: 1400, detune: 18, seed: 'sour' }), { gain: 0.06, rev: 0.5 });
  put(MUSIC, 40.5, bassNote(45, 1.3), { gain: 0.15 });
  fluteP([[40.5, 76, 0.3, { endBend: 1, endBendTime: 0.15 }], [41.0, 74, 0.25], [41.25, 72, 0.6, { endBend: -1.5, endBendTime: 0.4, vib: 0.4 }]], { gain: 0.1 });
  nguyetP([[40.75, 69, 0.2], [41.25, 69, 0.2], [41.5, 68, 0.3, { endBend: -1 }]], { gain: 0.045 });
  put2(SFX, 40.8, smellWave(rngFor('smell'), 1.0), { gain: 0.7, rev: 0.1, hall: 0.25 });
  put(MUSIC, 42.0, wahWah(), { gain: 0.2, pan: 0.05, rev: 0.3 });
  put(MUSIC, 42.0, bassNote(38, 0.3), { gain: 0.14 }); put(MUSIC, 42.4, bassNote(36, 0.9), { gain: 0.14 });
  put2(MUSIC, 42.5, pad([48, 55, 60, 64], 1.0, { attack: 0.2, release: 0.3, cutoff: 1000, seed: 'after' }), { gain: 0.045, rev: 0.5 });

  // 43.5–45.5 "whip it up!": cheerful flute flourish 43.7, groove back, building into the over-whisk
  [[43.5, 'G', 1.0], [44.5, 'C', 0.5], [45.0, 'D', 0.5]].forEach(([T, ch, d], k) => {
    put2(MUSIC, T, pad(V[ch], d - 0.03, { attack: 0.05, release: 0.1, cutoff: 1800 + 600 * k, pump: (t) => pumpAt(T + t, 0.25), seed: 'pg' + k }), { gain: 0.06, rev: 0.35 });
    for (let t = T; t < T + d - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - T) / 0.25) % 2 ? ROOT[ch] + 12 : ROOT[ch], 0.2), { gain: 0.19 });
  });
  for (let t = 43.5; t < 45.5 - 1e-6; t += BEAT) { put(MUSIC, t, K, { gain: 0.28, rev: 0.03 }); put(MUSIC, t + 0.25, MO_HI, { gain: 0.07, pan: -0.25, rev: 0.28 }); }
  for (let t = 43.5, k = 0; t < 44.5 - 1e-6; t += 0.25, k++) ph(t, k % 2 === 0, 0.06);
  for (let t = 44.5, k = 0; t < 45.5 - 1e-6; t += 0.125, k++) ph(t, k % 4 === 0, 0.05 + 0.04 * (t - 44.5));
  fluteP([[43.7, 86, 0.07], [43.775, 84, 0.07], [43.85, 81, 0.07], [43.925, 79, 0.07], [44.0, 81, 0.45, { trill: 2, trillRate: 14, trillAt: 0.03 }]], { gain: 0.12, attack: 0.008, release: 0.04, vib: 0, pan: 0.3 });
  nguyet(44.5, 74, 0.45, { trem: 16, gain: 0.05 }); nguyet(45.0, 79, 0.45, { trem: 18, gain: 0.055 });
  gliss(45.0, 67, 88, 0.05, 0.036, 'wk', { dur: 0.6, cresc: true, rev: 0.35 });
  // 45.5 SPLAT stinger, then stunned: low pad + a drooping nguyệt note until the hard cut at 47.0
  put(MUSIC, 45.5, tom(90, 0.3), { gain: 0.22, rev: 0.2 });
  put2(MUSIC, 45.5, fade2(crash(rngFor('choke'), 0.35), 0.001, 0.15), { gain: 0.1, rev: 0.2 });
  flute(45.52, 88, 0.14, { endBend: 4, endBendTime: 0.1, gain: 0.08, attack: 0.005, vib: 0 });
  put2(MUSIC, 45.6, pad([43, 50, 55, 59], 1.45, { attack: 0.3, release: 0.05, cutoff: 700, seed: 'stun' }), { gain: 0.05, rev: 0.4 });
  nguyet(46.35, 67, 0.55, { endBend: -2, endBendTime: 0.35, gain: 0.05 });

  // SFX 44.6–48.5: manic whisk, SPLAT, plips, cloth, then silence with heartbeat + breath
  const CLm = [2750, 3000, 3200, 2900].map((f, k) => bowlClack(rngFor('clm' + k), f));
  { let t = 44.6, k = 0; while (t < 45.4) { const u = (t - 44.6) / 0.8; put(SFX, t, CLm[k % 4], { gain: 0.3 + 0.22 * u, pan: (k % 2 ? 0.15 : -0.15), rev: 0.14 }); t += 1 / (11 + 15 * u); k++; } }
  put2(SFX, 44.6, foam(rngFor('foam2'), 0.85), { gain: 0.3, rev: 0.12 });
  put2(SFX, 45.5, splat(rngFor('splat')), { gain: 0.75, rev: 0.15, hall: 0.12 });
  [[46.0, 1750], [46.2, 2100]].forEach(([t, f], k) => put(SFX, t, smallDrip(rngFor('plip' + k), f), { gain: 0.32, pan: 0.1, rev: 0.12 }));
  put(SFX, 46.7, clothSwipe(rngFor('cloth')), { gain: 0.45, pan: -0.05, rev: 0.08 });
  const HB = softHeart();
  [47.2, 47.7].forEach((t) => put(SFX, t, HB, { gain: 0.021 }));
  put(SFX, 48.0, inhale(rngFor('breath')), { gain: 0.3, rev: 0.05 });

  // 48.5 RỘP + the full band returns
  put2(SFX, 48.5, ropCrunch(rngFor('rop')), { gain: 0.7, rev: 0.1, hall: 0.2 });
  put(MUSIC, 48.5, bigBoom(rngFor('boom485'), 2.0, { decay: 0.5 }), { gain: 0.26, rev: 0.2 });
  put(MUSIC, 48.5, KD, { gain: 0.2, rev: 0.05 });
  put2(MUSIC, 48.5, crash(rngFor('c485'), 2.4), { gain: 0.09, rev: 0.45 });
  put2(MUSIC, 48.5, gong(rngFor('gong485'), 2.6, 196), { gain: 0.08, rev: 0.45 });
  const eu = [[48.5, 'G', 1], [49.5, 'D', 1], [50.5, 'Em', 1], [51.5, 'C', 0.5]];
  eu.forEach(([T, ch, d], k) => {
    put2(MUSIC, T, pad(V[ch], d - 0.02, { attack: 0.04, release: 0.15, cutoff: 3000, detune: 9, pump: (t) => pumpAt(T + t, 0.25), seed: 'eu' + k }), { gain: 0.08, rev: 0.45 });
    put2(MUSIC, T, pad(V[ch].map((m) => m + 12).slice(1), d, { attack: k === 0 ? 0.2 : 0.1, release: 0.25, cutoff: 5000, tab: TAB_STR, vib: 14, detune: 10, seed: 'es' + k }), { gain: 0.055, rev: 0.6 });
    for (let t = T; t < T + d - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - T) / 0.25) % 2 ? ROOT[ch] + 12 : ROOT[ch], 0.2), { gain: 0.24 });
  });
  put(MUSIC, 48.5, drone(3.5, { attack: 0.05, release: 0.3, midi: 43 }), { gain: 0.05, rev: 0.2 });
  gliss(48.55, 55, 91, 0.028, 0.045, 'eg', { dur: 1.5, rev: 0.6, cresc: true });
  for (let t = 48.5; t < 52.0 - 1e-6; t += BEAT) { put(MUSIC, t, K, { gain: 0.38, rev: 0.03 }); put(MUSIC, t + 0.25, (t * 2) % 2 ? MO_LO : MO_HI, { gain: 0.075, pan: -0.25, rev: 0.28 }); }
  for (let t = 48.5; t < 52.0 - 1e-6; t += 0.125) { const k = Math.round((t - 48.5) / 0.125) % 4; ph(t, k === 0, k === 0 ? 0.085 : k === 2 ? 0.06 : 0.042); }
  fluteP([[48.5, 79, 0.45, { bendFrom: -3, bendTime: 0.12 }], [49.0, 81, 0.2], [49.25, 84, 0.2], [49.5, 86, 0.95, { mordent: 2, vib: 0.32 }],
    [50.5, 88, 0.45, { grace: 3 }], [51.0, 86, 0.2], [51.25, 84, 0.2], [51.5, 86, 0.45, { trill: 2, trillAt: 0.05 }]], { gain: 0.14, rev: 0.5 });
  nguyetP([[48.5, 67, 0.95, { trem: 15 }], [49.5, 69, 0.95, { trem: 15 }], [50.5, 71, 0.95, { trem: 15 }], [51.5, 72, 0.45, { trem: 15 }]], { gain: 0.055 });
  // leaves fluttering shimmer 49–52 (leaves on the ambience bus so they do not duck the music)
  put2(AMB, 49.0, rustle(rngFor('leaves'), 3.0), { gain: 0.12, rev: 0.1, hall: 0.25 });
  put2(MUSIC, 49.0, shimmer(rngFor('leafsh'), 1.6), { gain: 0.06, rev: 0.6 });
  [86, 91, 88, 93, 91, 96, 93, 98].forEach((m, k) => put(MUSIC, 49.2 + k * 0.3, ting(m2f(m), 0.7), { gain: 0.026, pan: k % 2 ? 0.6 : -0.6, rev: 0.65 }));

  // 52–56 eating happily: lighter groove, crunches on 52.5–54.0, the vendor laughs (flute trill) at 54.8
  [[52, 'G'], [53, 'C'], [54, 'Am'], [55, 'D']].forEach(([T, ch], k) => {
    put2(MUSIC, T, pad(V[ch], 0.97, { attack: 0.05, release: 0.12, cutoff: 2200, pump: (t) => pumpAt(T + t, 0.3), seed: 'cg' + k }), { gain: 0.06, rev: 0.35 });
    put(MUSIC, T, bassNote(ROOT[ch], 0.4), { gain: 0.21 }); put(MUSIC, T + 0.5, bassNote(FIFTH[ch], 0.4), { gain: 0.19 });
    const b = SCALE.indexOf({ G: 67, C: 72, Am: 69, D: 74 }[ch]);
    [0, 2, 1, 2].forEach((ix, j) => nguyet(T + j * 0.25, SCALE[b + ix - 2], 0.2, { gain: 0.032, pan: -0.38 }));
  });
  for (let t = 52.0; t < 56.0 - 1e-6; t += BEAT) {
    if ((t * 2) % 2 === 0) put(MUSIC, t, K, { gain: 0.3, rev: 0.03 });
    put(MUSIC, t + 0.25, (t * 2) % 2 ? MO_LO : MO_HI, { gain: 0.08, pan: -0.25, rev: 0.28 });
  }
  for (let t = 52.0; t < 56.0 - 1e-6; t += 0.25) ph(t, Math.abs(t - Math.round(t)) < 1e-6, (t * 4) % 2 ? 0.045 : 0.06);
  fluteP([[52.25, 79, 0.15], [52.75, 81, 0.15], [53.25, 84, 0.15], [53.75, 86, 0.2, { mordent: 2 }]], { gain: 0.1 });
  fluteP([[54.8, 86, 0.13], [54.95, 84, 0.13], [55.1, 81, 0.13], [55.25, 79, 0.3, { endBend: -1, endBendTime: 0.12 }]],
    { gain: 0.11, pan: 0.4, vib: 0, attack: 0.008, trill: 2, trillRate: 18, trillAt: 0, seed: 'laugh' });
  nguyetP([[55.5, 74, 0.2], [55.75, 76, 0.2]], { gain: 0.05 });
  [52.5, 53.0, 53.5, 54.0].forEach((t, k) => put(SFX, t, crunch(rngFor('cr' + k), 1 + 0.1 * k), { gain: 0.8, pan: 0.05 * (k % 2 ? 1 : -1), rev: 0.1 }));
  [52.2, 52.3, 52.75, 53.25, 53.7, 54.35, 54.45].forEach((t, k) => put(SFX, t, chopClick(rngFor('cc' + k)), { gain: 0.3, pan: 0.15, rev: 0.12 }));

  // 56–60 crane up: C – D – G, final cadence hit 57.0 with a long ring-out
  put2(MUSIC, 56.0, pad(V.C, 0.48, { attack: 0.06, release: 0.06, cutoff: 2400, seed: 'r1' }), { gain: 0.075, rev: 0.45 });
  put2(MUSIC, 56.5, pad(V.D, 0.48, { attack: 0.06, release: 0.06, cutoff: 2400, seed: 'r2' }), { gain: 0.08, rev: 0.45 });
  put(MUSIC, 56.0, bassNote(36, 0.45), { gain: 0.22 }); put(MUSIC, 56.5, bassNote(38, 0.45), { gain: 0.22 });
  put(MUSIC, 56.0, K, { gain: 0.3, rev: 0.03 }); put(MUSIC, 56.5, K, { gain: 0.3, rev: 0.03 });
  [[56.5, 147], [56.625, 123], [56.75, 98], [56.875, 82]].forEach(([t, f]) => put(MUSIC, t, tom(f, 0.25), { gain: 0.12 + (t - 56.5) * 0.2, pan: 0.4 - (t - 56.5) * 2, rev: 0.25 }));
  fluteP([[56.0, 76, 0.2], [56.25, 79, 0.2], [56.5, 81, 0.2], [56.75, 84, 0.2]], { gain: 0.11 });
  put(MUSIC, 56.4, riser(rngFor('riser564'), 0.6, 600, 7000), { gain: 0.08, rev: 0.3 });
  put2(MUSIC, 56.5, reverseCrash(rngFor('rc57'), 0.5), { gain: 0.08, rev: 0.25 });
  put(MUSIC, 57.0, bigBoom(rngFor('boom57'), 1.8, { decay: 0.5 }), { gain: 0.45, rev: 0.2 });
  put(MUSIC, 57.0, KD, { gain: 0.3, rev: 0.05 });
  put2(MUSIC, 57.0, gong(rngFor('gong57'), 3.0, 174), { gain: 0.13, rev: 0.5 });
  put2(MUSIC, 57.0, crash(rngFor('c57'), 1.8), { gain: 0.1, rev: 0.45 });
  put2(MUSIC, 57.0, pad([43, 55, 62, 67, 71, 74], 1.8, { attack: 0.04, release: 0.8, cutoff: 2800, detune: 8, seed: 'fin' }), { gain: 0.12, rev: 0.55 });
  put2(MUSIC, 57.0, pad([67, 74, 79, 83], 1.8, { attack: 0.15, release: 0.8, cutoff: 5000, tab: TAB_STR, vib: 12, detune: 9, seed: 'fins' }), { gain: 0.045, rev: 0.6 });
  put(MUSIC, 57.0, bassNote(43, 1.5), { gain: 0.25 });
  put(MUSIC, 57.0, drone(2.4, { attack: 0.1, release: 0.4, midi: 43 }), { gain: 0.05, rev: 0.2 });
  gliss(57.0, 55, 88, 0.04, 0.045, 'fin', { dur: 1.8, rev: 0.6 });
  fluteP([[57.0, 86, 0.45, { grace: 2 }], [57.5, 84, 0.2], [57.75, 81, 0.2], [58.0, 79, 1.4, { bendFrom: -2, bendTime: 0.15, vib: 0.35, release: 0.4 }]], { gain: 0.13, rev: 0.55 });
  nguyetP([[57.0, 79, 0.9, { trem: 14 }], [58.0, 67, 1.0, { t60: 1.6, release: 0.4 }]], { gain: 0.06, rev: 0.45 });
}

// ───────────────────────────── 7. Master ─────────────────────────────

// (a) duck the music under foley (≈ −3.5 dB at full) + per-section music trim
const duck = new Float32Array(N);
{
  let e = 0; const at = 1 - Math.exp(-1 / (0.005 * SR)), rl = 1 - Math.exp(-1 / (0.25 * SR));
  for (let i = 0; i < N; i++) {
    const a = Math.max(Math.abs(SFX.L[i]), Math.abs(SFX.R[i]));
    e += (a > e ? at : rl) * (a - e);
    duck[i] = 1 - 0.34 * clamp(e / 0.25, 0, 1);
  }
  const trim = (t) => pw([[0, 1.3], [8.9, 1.3], [9.1, 1.1], [9.97, 1.1], [10.0, 1.0], [38.0, 1.0], [48.4, 1.0], [48.5, 0.6], [49.0, 1.1], [51.9, 1.1], [52.1, 0.9], [55.9, 0.9], [56.0, 1.0], [60, 1.0]], t);
  for (let i = 0; i < N; i++) duck[i] *= trim(i / SR);
}
// ambience joins the SFX bus only after the duck key was computed
for (const key of ['L', 'R', 'sL', 'sR', 'hL', 'hR']) for (let i = 0; i < N; i++) SFX[key][i] += AMB[key][i];

// (b) comic "smell" pitch-warp 40.9–41.9 on the whole music bus (dry + hall send):
//     variable delay line (two LFOs, seasick pitch drift) + stereo sway
const WOB0 = 40.9, WOB1 = 41.9, WOB_RAMP = 0.25;
function wobble(x) {
  const y = Float32Array.from(x);
  const i0 = Math.floor(WOB0 * SR), i1 = Math.ceil(WOB1 * SR);
  for (let i = i0; i < i1; i++) {
    const t = i / SR, tt = t - WOB0;
    const w = smooth(tt / WOB_RAMP) * smooth((WOB1 - t) / WOB_RAMP);
    const d = w * SR * (0.0085 * (1 - Math.cos(TAU * 0.6 * tt)) + 0.002 * (1 - Math.cos(TAU * 1.9 * tt)));
    const p = i - d, k = Math.floor(p), f = p - k;
    const xm1 = x[k - 1], x0 = x[k], x1 = x[k + 1], x2 = x[k + 2];   // cubic Hermite interpolation
    const c1 = 0.5 * (x1 - xm1), c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
    y[i] = ((c3 * f + c2) * f + c1) * f + x0;
  }
  return y;
}
for (const key of ['L', 'R', 'hL', 'hR']) MUSIC[key] = wobble(MUSIC[key]);
for (let i = Math.floor(WOB0 * SR); i < Math.ceil(WOB1 * SR); i++) {
  const t = i / SR, w = smooth((t - WOB0) / WOB_RAMP) * smooth((WOB1 - t) / WOB_RAMP), s = 0.1 * w * Math.sin(TAU * 0.5 * (t - WOB0));
  MUSIC.L[i] *= 1 + s; MUSIC.R[i] *= 1 - s;
}

// (c) music gate: hard cut at 47.0 (40 ms), closed through the heartbeat silence, open again for the 48.5 RỘP
const I_GATE0 = Math.round(46.98 * SR), I_GATE1 = Math.round(47.02 * SR), I_OPEN0 = Math.round(48.48 * SR), I_OPEN1 = Math.round(48.5 * SR);
const gateM = (i) => (i < I_GATE0 ? 1 : i < I_GATE1 ? 0.5 + 0.5 * Math.cos(Math.PI * (i - I_GATE0) / (I_GATE1 - I_GATE0)) : i < I_OPEN0 ? 0 : i < I_OPEN1 ? (i - I_OPEN0) / (I_OPEN1 - I_OPEN0) : 1);

// (d) stereo Freeverb-style reverbs (8 damped combs + 4 allpasses per side, pre-delay)
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
// hall: music (ducked) + SFX/AMB hall sends; cleared right after the 47.0 cut so nothing rings into the silence
const hallInL = new Float32Array(N), hallInR = new Float32Array(N);
for (let i = 0; i < N; i++) { hallInL[i] = MUSIC.hL[i] * duck[i] + SFX.hL[i]; hallInR[i] = MUSIC.hR[i] * duck[i] + SFX.hR[i]; }
const [hallL, hallR] = reverb(hallInL, hallInR, { fb: 0.865, damp: 0.3, pre: 0.028, clearAt: I_GATE1 + 16 });
// room: small, close space for the foley
const [roomL, roomR] = reverb(SFX.sL, SFX.sR, { size: 0.45, fb: 0.72, damp: 0.42, pre: 0.006, hp: 250, lp: 9000, inGain: 1.6 });

// (e) sum, gentle music-bus saturation, DC/sub high-pass, master envelope (end fade, last 0.3 s silent)
let preL = new Float32Array(N), preR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const g = gateM(i);
  const ml = Math.tanh(MUSIC.L[i] * duck[i] * 1.1) / 1.1, mr = Math.tanh(MUSIC.R[i] * duck[i] * 1.1) / 1.1;
  preL[i] = (ml + hallL[i]) * g + SFX.L[i] + roomL[i];
  preR[i] = (mr + hallR[i]) * g + SFX.R[i] + roomR[i];
}
preL = filt(preL, 'hp', 24, 0.7); preR = filt(preR, 'hp', 24, 0.7);
const FADE0 = 58.6, FADE1 = 59.7;
const masterEnv = (t) => (t <= FADE0 ? 1 : t >= FADE1 ? 0 : Math.pow(0.5 + 0.5 * Math.cos(Math.PI * (t - FADE0) / (FADE1 - FADE0)), 1.4));
for (let i = 0; i < N; i++) { const g = masterEnv(i / SR); preL[i] *= g; preR[i] *= g; }

// (f) loudness (ITU-R BS.1770-4 K-weighting, gated integrated) + true-peak helpers
function kweight(x) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {   // stage 1: high shelf (+4 dB, 48 kHz coefficients)
    const x0 = x[i], y0 = 1.53512485958697 * x0 - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0; y[i] = y0;
  }
  x1 = x2 = y1 = y2 = 0;
  for (let i = 0; i < y.length; i++) {   // stage 2: RLB high-pass
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
  return { integ, maxS, maxM: Math.max(...blocks.map(lk)) };
}
function truePeak(L, R) {   // tp[i] = max |signal| on [i, i+1) using 4x windowed-sinc interpolation
  const T = 16, OS = 4, taps = [];
  for (let k = 1; k < OS; k++) {
    const fr = k / OS, h = new Float64Array(2 * T);
    for (let j = -T + 1; j <= T; j++) { const x = j - fr, w = 0.5 + 0.5 * Math.cos(Math.PI * x / T); h[j + T - 1] = (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; }
    taps.push(h);
  }
  const tp = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (p > 0.2 && i >= T && i + T < N) {
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
// look-ahead true-peak limiter (instant attack via look-ahead, smooth release, moving-average gain)
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
  let sum = 0, minG = 1; const W = LA + 1;
  for (let i = 0; i < N; i++) {
    sum += r[i]; if (i >= W) sum -= r[i - W];
    const gs = i >= W - 1 ? sum / W : Math.min(1, sum / (i + 1));
    L[i] *= gs; R[i] *= gs; if (gs < minG) minG = gs;
  }
  return { L, R, minG };
}

// (g) normalise to TARGET_LUFS through the limiter (iterate: limiting lowers loudness slightly)
let gain = Math.pow(10, (TARGET_LUFS - loudness(preL, preR).integ) / 20), out;
for (let it = 0; it < 4; it++) {
  out = limit(preL, preR, gain, CEIL_DBTP);
  const lu = loudness(out.L, out.R).integ;
  if (Math.abs(lu - TARGET_LUFS) < 0.1) break;
  gain *= Math.pow(10, (TARGET_LUFS - lu) / 20);
}
let mL = out.L, mR = out.R;
// exact digital silence for the last 0.3 s; safety true-peak trim (keeps the file ≤ −1.3 dBTP after dither)
for (let i = Math.round(FADE1 * SR); i < N; i++) { mL[i] = 0; mR[i] = 0; }
{
  const tp = truePeak(mL, mR); let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, tp[i]);
  const lim = Math.pow(10, -1.38 / 20);
  if (pk > lim) { const g = lim / pk; for (let i = 0; i < N; i++) { mL[i] *= g; mR[i] *= g; } }
}
console.timeEnd('render');

// (h) WAV writer (RIFF / PCM 16-bit / 2ch / 48 kHz) with TPDF dither
function writeWav(file, L, R) {
  const dataLen = N * 4, buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(dataLen, 40);
  const D = rngFor('dither');
  let o = 44;
  for (let i = 0; i < N; i++) {
    const dz = L[i] === 0 && R[i] === 0;   // keep true digital silence silent
    const dl = dz ? 0 : (D() - D()), dr = dz ? 0 : (D() - D());
    buf.writeInt16LE(clamp(Math.round(L[i] * 32767 + dl), -32768, 32767), o); o += 2;
    buf.writeInt16LE(clamp(Math.round(R[i] * 32767 + dr), -32768, 32767), o); o += 2;
  }
  fs.writeFileSync(file, buf);
}
const OUT = path.join(__dirname, 'audio.wav');
writeWav(OUT, mL, mR);

// (i) verification: re-read the file and report format, peak, true peak, loudness, key windows + pass/fail
{
  const b = fs.readFileSync(OUT);
  const ch = b.readUInt16LE(22), sr = b.readUInt32LE(24), bits = b.readUInt16LE(34), dlen = b.readUInt32LE(40);
  const frames = dlen / (ch * bits / 8);
  const L = new Float32Array(frames), R = new Float32Array(frames);
  let pk = 0;
  for (let i = 0; i < frames; i++) { L[i] = b.readInt16LE(44 + i * 4) / 32768; R[i] = b.readInt16LE(46 + i * 4) / 32768; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
  const tp = truePeak(L, R); let tpk = 0; for (let i = 0; i < frames; i++) tpk = Math.max(tpk, tp[i]);
  const lu = loudness(L, R);
  let dcL = 0, dcR = 0, side = 0, mid = 0; for (let i = 0; i < frames; i++) { dcL += L[i]; dcR += R[i]; mid += (L[i] + R[i]) ** 2; side += (L[i] - R[i]) ** 2; }
  const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  console.log(`wrote ${OUT}`);
  console.log(`format     ${ch} ch, ${sr} Hz, ${bits}-bit PCM, ${frames} frames = ${(frames / sr).toFixed(3)} s`);
  console.log(`peak       ${dB(pk).toFixed(2)} dBFS   true peak ≈ ${dB(tpk).toFixed(2)} dBTP   limiter max GR ${dB(out.minG).toFixed(1)} dB`);
  console.log(`loudness   integrated ≈ ${lu.integ.toFixed(1)} LUFS   max short-term ${lu.maxS.toFixed(1)} LUFS   max momentary ${lu.maxM.toFixed(1)} LUFS`);
  console.log(`DC         L ${(dcL / frames).toExponential(1)}  R ${(dcR / frames).toExponential(1)}    side/mid energy ${(10 * Math.log10(side / mid)).toFixed(1)} dB (mono-compatible if < 0)`);
  const rmsW = (a, c) => { const i0 = Math.round(a * SR), i1 = Math.min(frames, Math.round(c * SR)); let s = 0; for (let i = i0; i < i1; i++) s += L[i] * L[i] + R[i] * R[i]; return dB(Math.sqrt(s / (2 * Math.max(1, i1 - i0)))); };
  const row = []; for (let s = 0; s < 60; s++) row.push(`${String(s).padStart(2)}:${rmsW(s, s + 1).toFixed(0).padStart(4)}`);
  console.log('RMS per second (dBFS):'); for (let k = 0; k < 60; k += 10) console.log('  ' + row.slice(k, k + 10).join('  '));
  for (const [name, a, c] of [['intro 0.0-3.0', 0, 3.0], ['bike pass 3.4-4.2', 3.4, 4.2], ['stool 6.6-7.1', 6.6, 7.1], ['pre-title 9.5-10.0', 9.5, 10.0], ['TITLE HIT 10.0-10.5', 10.0, 10.5],
    ['tofu drops 10.6-12.4', 10.6, 12.4], ['pork chops 19.5-21.6', 19.5, 21.6], ['whisk 31.0-34.0', 31.0, 34.0], ['tray fullest 34-38', 34.0, 38.0], ['smell 40.8-41.8', 40.8, 41.8],
    ['SPLAT 45.5-46.0', 45.5, 46.0], ['SILENCE 47.1-47.9', 47.1, 47.9], ['breath 48.0-48.45', 48.0, 48.45], ['ROP 48.5-49.0', 48.5, 49.0], ['joy 48.5-52.0', 48.5, 52.0],
    ['crunches 52.4-54.2', 52.4, 54.2], ['FINAL HIT 57.0-57.5', 57.0, 57.5], ['tail 59.7-60.0', 59.7, 60.0]]) {
    console.log(`  ${name.padEnd(22)} rms ${rmsW(a, c).toFixed(1).padStart(6)} dBFS`);
  }
  let tailZero = true; for (let i = Math.round(59.7 * SR); i < frames; i++) if (L[i] !== 0 || R[i] !== 0) { tailZero = false; break; }
  const checks = [
    ['format 2 ch / 48 kHz / 16-bit PCM', ch === 2 && sr === 48000 && bits === 16],
    ['duration exactly 60.000 s', frames === Math.round(60 * 48000)],
    ['integrated loudness -15 ± 0.5 LUFS', Math.abs(lu.integ - TARGET_LUFS) <= 0.5],
    ['true peak <= -1.3 dBTP', dB(tpk) <= -1.3],
    ['silence 47.1-47.9 below -45 dBFS RMS', rmsW(47.1, 47.9) < -45],
    ['last 0.3 s digital silence', tailZero],
  ];
  console.log('self-check:');
  for (const [nm, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${nm}`);
  if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
}

// optional: per-cue balance of foley vs (ducked) music, pre-limiter (set DEBUG=1)
if (process.env.DEBUG) {
  const KW = (x) => filt(filt(x, 'hp', 120, 0.5), 'peak', 3500, 0.6, 4);   // rough loudness weighting
  const muL = new Float32Array(N), muR = new Float32Array(N);
  for (let i = 0; i < N; i++) { const g = gateM(i); muL[i] = (MUSIC.L[i] * duck[i] + hallL[i]) * g; muR[i] = (MUSIC.R[i] * duck[i] + hallR[i]) * g; }
  const sKL = KW(SFX.L), sKR = KW(SFX.R), mKL = KW(muL), mKR = KW(muR);
  const rms = (A, B, a, b) => { let s = 0; for (let i = a; i < b; i++) s += A[i] * A[i] + B[i] * B[i]; return Math.sqrt(s / (2 * (b - a))); };
  const dB = (x) => (20 * Math.log10(x)).toFixed(1).padStart(6);
  const GR = (a, b) => { let m = 1; for (let i = a; i < b; i++) { const pre = Math.max(Math.abs(preL[i]), Math.abs(preR[i])) * gain, po = Math.max(Math.abs(mL[i]), Math.abs(mR[i])); if (pre > 0.05) m = Math.min(m, po / pre); } return m; };
  const cues = [[0.2, 2.8, 'intro'], [3.4, 4.2, 'bike'], [4.4, 5.6, 'vendor'], [5.85, 6.2, 'scrape'], [6.6, 6.82, 'cot'], [6.7, 7.1, 'bwomp'], [7.4, 7.55, 'creak2'],
    [9.0, 9.3, 'leafslap'], [10.0, 10.5, 'TITLE'], [10.6, 11.0, 'tofu1'], [11.2, 11.6, 'tofu2'], [11.8, 12.2, 'tofu3'], [12.4, 13.4, 'frybed'], [13.5, 13.8, 'flip1'],
    [15.2, 15.45, 'sht'], [16.5, 16.9, 'press1'], [17.5, 17.9, 'press2'], [19.5, 19.7, 'chop1'], [21.5, 21.7, 'chop5'], [22.5, 22.75, 'thup1'], [25.0, 28.0, 'rustle'],
    [25.5, 25.65, 'pop1'], [28.3, 29.0, 'glug'], [29.6, 30.0, 'lime'], [30.1, 30.45, 'sugar'], [30.5, 30.8, 'chili'], [31.0, 32.0, 'whisk1'], [33.0, 34.0, 'whisk3'],
    [34.5, 34.8, 'place1'], [37.5, 37.8, 'bowl'], [38.0, 38.6, 'slide'], [38.7, 39.4, 'sparkle'], [40.8, 41.8, 'smell'], [44.6, 45.4, 'manic'], [45.5, 45.9, 'SPLAT'],
    [46.0, 46.1, 'plip1'], [46.7, 47.0, 'cloth'], [47.2, 47.5, 'heart1'], [48.0, 48.42, 'breath'], [48.5, 48.9, 'ROP'], [52.5, 52.75, 'crunch1'], [54.0, 54.25, 'crunch4']];
  for (let w = 0; w + 0.25 <= DUR; w += 0.25) { const g = 20 * Math.log10(GR(Math.round(w * SR), Math.round((w + 0.25) * SR))); if (g < -1.5) console.log('limiter GR', w.toFixed(2), g.toFixed(1), 'dB'); }
  for (const [a, b, nm] of cues) {
    const ia = Math.round(a * SR), ib = Math.round(b * SR), s = rms(sKL, sKR, ia, ib), m = rms(mKL, mKR, ia, ib);
    console.log(nm.padEnd(12), `${a.toFixed(2)}-${b.toFixed(2)}`.padEnd(12), 'sfx', dB(s), ' music', dB(m), ' sfx-music', (20 * Math.log10(s / m)).toFixed(1).padStart(6), '  limGR', (20 * Math.log10(GR(ia, ib))).toFixed(1));
  }
}
