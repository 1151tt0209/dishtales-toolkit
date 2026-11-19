'use strict';
/*
 * CÀ PHÊ ĐEN SÀI GÒN / Saigon Black Coffee — cinematic short soundtrack (45 s)
 * Fully procedural audio in pure Node.js (no packages, no samples).
 * Run:  node audio.js   ->  writes audio.wav (48 kHz, stereo, 16-bit PCM, 45.000 s)
 *
 * Based on ../banhmi/audio.js (same instruments, DSP, reverb, limiter, WAV writer).
 *
 * Layout of this file:
 *   1. Core constants, seeded PRNG, math helpers
 *   2. DSP helpers (biquad filters, noise bursts, wavetables, modal resonators)
 *   3. Instruments  (đàn bầu lead, đàn tranh pluck, pad/strings, drone, drums, mõ, shaker, bass)
 *   4. Sound effects (street, café foley, phin brewing, ice, Act III body sounds)
 *   5. Mix buses + put()
 *   6. Score / cue list (Act 1 dawn, Act 2 phin, Act 3 "phê")
 *   7. Master: ducking, tape wobble, room + hall reverbs, loudness normalise,
 *      true-peak limiter, fade, WAV writer, verification report
 */
const fs = require('fs');
const path = require('path');

// ───────────────────────────── 1. Core ─────────────────────────────
const SR = 48000;
const DUR = 45.0;
const N = Math.round(SR * DUR);
const BEAT = 0.5;            // 120 BPM
const BAR = 4 * BEAT;
const TAU = Math.PI * 2;
const TARGET_LUFS = -15.0;
const CEIL_DBTP = -1.3;      // limiter ceiling (0.3 dB margin under -1 dBTP)

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rngFor = (name) => mulberry32(hashStr('caphe:' + name));   // independent deterministic stream per cue

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

/* Đàn bầu (monochord): near-sine tone with a few soft harmonics, slow-ish attack,
 * expressive pitch glides into (bendFrom, semitones) and out of (endBend) notes,
 * vibrato that widens as the note sustains, optional detune (cents) for the "drunk" act. */
function danBau(midi, dur, o = {}) {
  const f0 = m2f(midi);
  const bendFrom = o.bendFrom || 0, bendTime = o.bendTime ?? Math.min(0.18, dur * 0.4);
  const endBend = o.endBend || 0, endBendTime = o.endBendTime ?? Math.min(0.25, dur * 0.4);
  const vibRate = o.vibRate ?? 5.4, vibDepth = o.vibDepth ?? 0.28;
  const attack = o.attack ?? Math.min(0.07, dur * 0.25), release = o.release ?? 0.14;
  const bright = o.bright ?? 1, cents = (o.cents || 0) / 100;
  const n = secs(dur + release), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let st = cents;
    if (bendFrom) { const u = clamp(t / bendTime, 0, 1); st += bendFrom * (1 - u) * (1 - u) * (1 + u); } // eased glide
    if (endBend) st += endBend * smooth((t - (dur - endBendTime)) / endBendTime);
    const vd = vibDepth * smooth((t - 0.12) / Math.max(0.25, dur * 0.75));
    st += vd * Math.sin(TAU * vibRate * t + 0.3 * Math.sin(TAU * 0.7 * t));
    ph += f0 * Math.pow(2, st / 12) / SR; ph -= Math.floor(ph);
    const hd = 0.5 + 0.5 * Math.exp(-t / 0.35);
    const w = Math.sin(TAU * ph)
      + 0.20 * bright * hd * Math.sin(2 * TAU * ph)
      + 0.09 * bright * hd * Math.sin(3 * TAU * ph)
      + 0.035 * bright * hd * Math.sin(4 * TAU * ph)
      + 0.015 * bright * hd * Math.sin(5 * TAU * ph);
    let env;
    if (t < attack) env = Math.pow(t / attack, 1.6);
    else env = 0.8 + 0.2 * Math.exp(-(t - attack) / 0.25);
    env *= Math.exp(-t / (dur * 3 + 0.6));
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    y[i] = w * env;
  }
  return fadeEdges(y, 0.003, 0.005);
}

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
/* mõ (wooden temple block): hollow knock, a few inharmonic wood modes + click */
function mo(R, f = 820) {
  const y = modal([[f, 0.055, 1], [f * 2.31, 0.028, 0.42], [f * 3.87, 0.014, 0.2], [f * 0.52, 0.03, 0.15]], 0.3);
  addInto(y, burst(R, 0.006, 'bp', 2600, 0.8, 0.0009), 0, 0.35);
  return fadeEdges(norm(y), 0.0003, 0.03);
}
/* shaker: soft-attack band-passed noise grain */
function shaker(R, acc = false) {
  const x = burst(R, 0.11, 'bp', 6800, 0.9, acc ? 0.03 : 0.018, acc ? 0.006 : 0.004);
  return norm(filt(x, 'hp', 3500, 0.7));
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

/* distant rooster: harmonic source through formant filters, pitch contour */
function rooster(R) {
  const dur = 1.0, n = secs(dur), src = new Float32Array(n);
  const pitch = [[0, 470], [0.12, 640], [0.13, 560], [0.3, 720], [0.31, 660], [0.48, 780], [0.5, 760], [0.8, 830], [1.0, 560]];
  const amp = [[0, 0], [0.02, 1], [0.11, 0.8], [0.13, 0.1], [0.15, 0.9], [0.29, 0.8], [0.31, 0.1], [0.33, 0.9], [0.47, 0.8], [0.49, 0.15], [0.52, 1], [0.85, 0.85], [1.0, 0]];
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = pw(pitch, t) * (1 + 0.012 * Math.sin(TAU * 23 * t) + 0.01 * (R() - 0.5));
    ph += f / SR; ph -= Math.floor(ph);
    let s = 0; for (let h = 1; h <= 10; h++) s += Math.sin(TAU * h * ph) / h;
    src[i] = (s + 0.25 * (R() - 0.5)) * pw(amp, t);
  }
  const y = new Float32Array(n);
  for (const [f, q, g] of [[850, 4, 1], [1550, 5, 0.7], [2700, 6, 0.35]]) addInto(y, filt(src, 'bp', f, q), 0, g);
  return fadeEdges(norm(filt(y, 'lp', 2600, 0.7)), 0.01, 0.05);
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

/* hand grinder: one crank of crunchy bean cracking + ratchet + grind body */
function grindCrank(R, dur = 0.46) {
  const n = secs(dur), y = new Float32Array(n);
  const env = (t) => Math.pow(Math.sin(Math.PI * clamp(t / dur, 0, 1)), 0.6);
  addInto(y, crackle(R, dur, (t) => 80 + 520 * env(t), (t) => env(t), 1200, 7500), 0, 1);
  for (let k = 0; k < 9; k++) { const t = 0.03 + R() * (dur - 0.08); addInto(y, burst(R, 0.025, 'bp', 650 + R() * 1300, 1.5, 0.003 + R() * 0.005), secs(t), (0.5 + 0.5 * R()) * env(t)); }
  for (let t = 0.02; t < dur - 0.02; t += 1 / 26) addInto(y, burst(R, 0.008, 'bp', 3400, 4, 0.0012), secs(t), 0.3 * env(t));
  const body = filt(noise(n, R), 'lp', 420, 0.8);
  for (let i = 0; i < n; i++) { const t = i / SR; y[i] += body[i] * 0.5 * env(t) * (0.5 + 0.5 * Math.sin(TAU * 43 * t)); }
  return fadeEdges(norm(y), 0.004, 0.02);
}

/* fine powder pouring hiss with grain sparkle */
function powderPour(R, dur) {
  const n = secs(dur), y = filt(noise(n, R), 'bp', 3600, 0.7), fl = flutter(R, n, 9);
  const gr = crackle(R, dur, () => 650, () => 0.35, 4000, 11000);
  for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / 0.12) * smooth((dur - t) / 0.25); y[i] = (y[i] * 0.35 * (0.6 + 0.4 * fl[i]) + gr[i]) * e; }
  return fadeEdges(norm(y), 0.01, 0.02);
}

/* water pour into a vessel: stream with rising fill resonance, bubbles, splash (stereo).
 * Returned length = dur + 0.35 (two tail drips). */
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

/* steam hiss with flutter and swell (stereo) */
function steam(R, dur) {
  const n = secs(dur);
  const mk = () => { const x = filt(filt(noise(n, R), 'hp', 2500, 0.7), 'bp', 5600, 0.5), fl = flutter(R, n, 7); for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= (0.4 + 0.6 * fl[i]) * smooth(t / 0.4) * smooth((dur - t) / 0.5); } return x; };
  return norm2(mk(), mk());
}

/* spoonful of grounds dropped into the phin: soft thud + powdery puff + grains */
function groundsDrop(R) {
  const n = secs(0.45), y = new Float32Array(n);
  addInto(y, plop(R, 150, 72, 0.18, 0.3), 0, 0.85);
  const puff = filt(noise(secs(0.35), R), 'lp', 3600, 0.7);
  for (let i = 0; i < puff.length; i++) { const t = i / SR; puff[i] *= smooth(t / 0.012) * Math.exp(-t / 0.075); }
  addInto(y, puff, secs(0.004), 0.6);
  addInto(y, crackle(R, 0.25, (t) => 320 * Math.exp(-t / 0.06), (t) => Math.exp(-t / 0.08), 3000, 9000), secs(0.003), 0.5);
  addInto(y, modal([[3150, 0.012, 1], [5200, 0.006, 0.4]], 0.06), 0, 0.12);   // spoon touching the rim
  return fadeEdges(norm(y), 0.001, 0.03);
}

/* phin shake: quick metallic rattle + grounds shuffle */
function phinShake(R, dur = 0.4) {
  const n = secs(dur + 0.1), y = new Float32Array(n);
  for (let t = 0, k = 0; t < dur; t += 1 / 11, k++) {
    const a = (0.6 + 0.4 * R()) * Math.pow(Math.sin(Math.PI * (t + 0.03) / (dur + 0.06)), 0.5);
    addInto(y, modal([[2350 + R() * 90, 0.03, 1], [3870 + R() * 90, 0.02, 0.6], [5650, 0.012, 0.4]], 0.09), secs(t), a * 0.55);
    addInto(y, modal([[430 + (k % 2) * 40, 0.02, 1]], 0.06), secs(t), a * 0.25);
    addInto(y, burst(R, 0.04, 'bp', 3000 + R() * 3000, 1.2, 0.012, 0.002), secs(t + 0.004), a * 0.5);
  }
  return fadeEdges(norm(y), 0.002, 0.03);
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

/* "kịch": a satisfying two-stage metallic click (seat + lock) */
function kichClick(R) {
  const n = secs(0.35), y = new Float32Array(n);
  addInto(y, burst(R, 0.006, 'hp', 2500, 0.7, 0.0012), 0, 0.5);
  addInto(y, modal([[2900, 0.02, 0.5], [4600, 0.012, 0.3]], 0.08), 0, 0.5);
  const t2 = secs(0.022);
  addInto(y, burst(R, 0.008, 'hp', 1800, 0.7, 0.0018), t2, 1.0);
  addInto(y, modal([[2150, 0.045, 0.8], [3420, 0.03, 0.5], [5300, 0.018, 0.35], [7200, 0.01, 0.2]], 0.25), t2, 0.9);
  addInto(y, modal([[180, 0.04, 0.6], [420, 0.03, 0.35]], 0.2), t2, 0.9);
  return fadeEdges(norm(y), 0.0003, 0.03);
}

/* bloom fizz: tiny bubble crackles as the grounds degas (stereo) */
function fizz(R, dur) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const env = (t) => smooth(t / (dur * 0.25)) * smooth((dur - t) / (dur * 0.3));
  let t = 0.005;
  while (t < dur - 0.02) {
    const e = env(t), p = (R() - 0.5) * 1.2;
    if (R() < 0.6) addPan(L, Rr, burst(R, 0.004, 'bp', 3000 + R() * 7000, 1.4, 0.0003 + R() * 0.0008), secs(t), e * Math.pow(R(), 1.4), p);
    else addPan(L, Rr, bubble(1800 + R() * 2800, 0.008 + R() * 0.008, 0.5, 0.3), secs(t), e * 0.5 * Math.pow(R(), 1.2), p);
    t += -Math.log(1 - R() * 0.99) / (140 + 80 * Math.sin(TAU * 0.8 * t));
  }
  const hL = filt(noise(n, R), 'bp', 6500, 0.8), hR = filt(noise(n, R), 'bp', 6500, 0.8);
  for (let i = 0; i < n; i++) { const e = env(i / SR) * 0.06; L[i] += hL[i] * e; Rr[i] += hR[i] * e; }
  return fade2(norm2(L, Rr), 0.01, 0.02);
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

/* huge slow-motion drip "tách": impact + pitched-down rising bubble + weight */
function bigDrip(R, pitch = 1) {
  const n = secs(1.0), y = new Float32Array(n);
  let ph = 0, ps = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = (290 + 560 * (1 - Math.exp(-t / 0.055))) * pitch;
    ph += f / SR; ps += (48 + 34 * Math.exp(-t / 0.03)) / SR;
    const at = t < 0.002 ? t / 0.002 : 1;
    y[i] = at * (Math.sin(TAU * ph) * Math.exp(-t / 0.16) + 0.75 * Math.sin(TAU * ps) * Math.exp(-t / 0.12));
  }
  addInto(y, burst(R, 0.03, 'bp', 3200, 1.4, 0.007), 0, 0.5);
  addInto(y, burst(R, 0.02, 'lp', 2500, 0.7, 0.004), 0, 0.35);
  for (let k = 0; k < 4; k++) addInto(y, bubble(1500 + R() * 1200, 0.05, 1.2, 0.25), secs(0.06 + R() * 0.2), 0.12 + 0.08 * R());
  for (let i = 0; i < n; i++) y[i] = Math.tanh(1.3 * y[i]);
  return fadeEdges(norm(y), 0.0005, 0.08);
}
/* small quick drip (time-lapse patter) */
function smallDrip(R, f = 900) {
  const y = bubble(f, 0.05, 1.4, 0.22);
  addInto(y, burst(R, 0.006, 'bp', 3500, 1.2, 0.0012), 0, 0.4);
  return fadeEdges(norm(y), 0.0003, 0.01);
}
/* clock tick / tock */
function clockTick(R, hi) {
  const y = modal(hi ? [[4100, 0.006, 1], [6200, 0.004, 0.5], [2300, 0.01, 0.3]] : [[3100, 0.007, 1], [4800, 0.005, 0.5], [1800, 0.012, 0.35]], 0.06);
  addInto(y, burst(R, 0.004, 'hp', 4000, 0.7, 0.0006), 0, 0.5);
  return fadeEdges(norm(y), 0.0002, 0.01);
}
/* fingertip tap on a wooden table */
function fingerTap(R) {
  const y = modal([[210, 0.05, 1], [560, 0.025, 0.5], [1250, 0.012, 0.3]], 0.2, 0.001);
  addInto(y, burst(R, 0.02, 'lp', 1500, 0.7, 0.003), 0, 0.4);
  return fadeEdges(norm(y), 0.0005, 0.02);
}
/* light finger "tick" (5.6) */
function lightTick(R) {
  const y = modal([[2650, 0.035, 1], [5300, 0.015, 0.25], [1320, 0.02, 0.2]], 0.2);
  addInto(y, burst(R, 0.004, 'hp', 3000, 0.7, 0.0006), 0, 0.35);
  return fadeEdges(norm(y), 0.0002, 0.02);
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

/* shepard-like riser: octave-spaced sines all gliding up one octave under a
 * fixed bell over log-frequency, with accelerating tremolo (eerie vertigo) — stereo */
function shepard(dur, o = {}) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const base = m2f(o.midi ?? 26), K = 8, span = o.span ?? 1, c = 4.2, sig = 1.3;
  for (let k = 0; k < K; k++) {
    for (const [buf, cents] of [[L, 4], [Rr, -4]]) {
      let ph = (k * 0.137 + (cents > 0 ? 0 : 0.5)) % 1;
      for (let i = 0; i < n; i++) {
        const u = i / n, pos = k + span * u, f = base * Math.pow(2, pos + cents / 1200);
        ph += f / SR; ph -= Math.floor(ph);
        const a = Math.exp(-0.5 * Math.pow((pos - c) / sig, 2));
        buf[i] += a * (Math.sin(TAU * ph) + 0.12 * Math.sin(3 * TAU * ph));
      }
    }
  }
  let trph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = i / n;
    trph += (2.5 + 6 * u * u) / SR;
    const e = smooth(u / 0.25) * (0.3 + 0.7 * Math.pow(u, 1.4)) * (0.78 + 0.22 * Math.sin(TAU * trph));
    L[i] *= e; Rr[i] *= e;
  }
  return fade2(norm2(L, Rr), 0.02, 0.01);
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

/* plastic stool scrape on concrete */
function stoolScrape(R, dur = 0.45) {
  const n = secs(dur), y = new Float32Array(n);
  addInto(y, creak(R, dur, { rate: (u) => 45 + 150 * Math.pow(Math.sin(Math.PI * u), 0.7), modes: [[480, 6, 1], [1150, 8, 0.7], [2400, 9, 0.35]], scrape: 0.25, scrapeF: 1100 }), 0, 1);
  const rough = flutter(R, n, 60), sc = filt(noise(n, R), 'bp', 900, 1.5);
  for (let i = 0; i < n; i++) { const u = i / n; y[i] += sc[i] * 0.35 * rough[i] * Math.pow(Math.sin(Math.PI * u), 0.6); }
  return fadeEdges(norm(y), 0.005, 0.02);
}

// ───────────────────────────── 5. Buses ─────────────────────────────
// MUSIC: dry + hall send.  SFX: dry + room send (s) + hall send (h).
const mkBus = () => ({ L: new Float32Array(N), R: new Float32Array(N), sL: new Float32Array(N), sR: new Float32Array(N), hL: new Float32Array(N), hR: new Float32Array(N) });
const MUSIC = mkBus(), SFX = mkBus();

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
const SCALE = [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89]; // D F G A C (D minor / F major pentatonic)
const fifthOf = (m) => ([0, 2, 5, 7, 9].includes((m + 7) % 12) ? m + 7 : m + 5);
const pumpAt = (tAbs, depth = 0.3) => {
  const tb = ((tAbs % BEAT) + BEAT) % BEAT;
  const d = tb < 0.008 ? smooth(tb / 0.008) : Math.exp(-(tb - 0.008) / 0.11);
  return 1 - depth * d;
};
function lead(t, midi, dur, o = {}) {
  put(MUSIC, t, danBau(midi, dur, o), { gain: o.gain ?? 0.18, pan: o.pan ?? -0.08, rev: o.rev ?? 0.42 });
}
function tranhNote(t, midi, dur, gain, pan, seed, rev = 0.45) {
  put(MUSIC, t, tranh(midi, dur, rngFor('tr' + seed + t), {}), { gain, pan, rev });
}
function sparrowAt(t, gain, pan, seed) {
  put(SFX, t, sparrow(rngFor('sp' + seed)), { gain, pan, rev: 0.25, hall: 0.25 });
}
const V = {   // chord voicings (pentatonic-safe where possible)
  Dm: [50, 57, 62, 65, 69], Bb: [46, 53, 58, 62, 65], C: [48, 55, 60, 62, 67], F: [53, 60, 65, 69, 72],
};
const ROOT = { Dm: 38, Bb: 34, C: 36, F: 41 };

// ---------- ACT 1 : Saigon wakes (0–7) ----------
{
  // ambience: one long city-hum bed 0 → 32.2 with its own level automation
  const hum = cityHum(rngFor('hum1'), 32.4);
  const humEnv = (t) => pw([[0, 0], [1.6, 0.55], [2.5, 1.0], [4.5, 1.0], [5.2, 0.5], [7.0, 0.4], [24, 0.36], [26, 0.3], [31.45, 0.3], [32.2, 0.0]], t);
  mulEnv(hum[0], humEnv); mulEnv(hum[1], humEnv);
  put2(SFX, 0.0, hum, { gain: 0.16, rev: 0.0, hall: 0.05 });

  // sparrows at dawn
  const R = rngFor('birds1');
  [[0.25, -0.6], [0.7, 0.5], [1.15, -0.2], [1.45, 0.7], [1.95, -0.7], [2.3, 0.35], [3.9, 0.8], [5.1, -0.75], [6.2, 0.7]].forEach(([t, p], k) =>
    sparrowAt(t, (t < 2.5 ? 0.075 : 0.045) * (0.7 + 0.3 * R()), p, 'a' + k));
  put(SFX, 0.6, rooster(rngFor('rooster')), { gain: 0.05, pan: -0.55, rev: 0.4, hall: 0.6 });
  put2(SFX, 1.3, shimmer(rngFor('flare'), 1.4), { gain: 0.11, hall: 0.5 });

  // music: pad swell from silence + drone + đàn tranh pentatonic arpeggio
  put(MUSIC, 0.0, drone(7.0, { attack: 2.5, release: 0.3 }), { gain: 0.09, rev: 0.15 });
  put2(MUSIC, 0.0, pad(V.Dm, 4.6, { attack: 2.4, release: 0.6, cutoff: 900 }), { gain: 0.08, rev: 0.35 });
  put2(MUSIC, 4.5, pad(V.Bb, 2.5, { attack: 0.7, release: 0.15, cutoff: 1300, env: (t) => 0.75 + 0.25 * smooth((t - 0.5) / 2) }), { gain: 0.085, rev: 0.35 });
  [62, 65, 69, 72, 74, 72, 69, 65].forEach((m, k) => tranhNote(0.5 + k * 0.25, m, 1.4, 0.05 + 0.006 * Math.sin(k), -0.4 + 0.1 * k, 'arp' + k, 0.5));
  [69, 72, 74, 77].forEach((m, k) => tranhNote(2.5 + k * 0.5, m, 1.2, 0.035, 0.4 - 0.25 * k, 'arp2' + k, 0.5));
  [69, 72, 74].forEach((m, k) => tranhNote(4.5 + k * 0.5, m, 1.2, 0.045, -0.3 + 0.3 * k, 'arp3' + k, 0.5));
  // gentle đàn bầu in the café
  lead(5.0, 69, 0.9, { bendFrom: -2, bendTime: 0.3, vibDepth: 0.32, gain: 0.13 });
  lead(6.0, 72, 0.45, { bendFrom: -1, gain: 0.12 });
  lead(6.5, 74, 0.4, { bendFrom: -2, gain: 0.12 });
  // rising swell into the title (ends exactly on 7.0)
  put(MUSIC, 5.0, riser(rngFor('riser1'), 2.0, 220, 6500), { gain: 0.15, pan: (t) => 0.3 * Math.sin(TAU * 0.8 * t), rev: 0.3 });
  put2(MUSIC, 6.0, reverseCrash(rngFor('rc1'), 1.0), { gain: 0.12, rev: 0.2 });

  // street: two motorbikes with doppler + whoosh layer (centres 2.7 L→R, 3.5 R→L)
  put2(SFX, 2.7 - 0.7, scooter(rngFor('moto1'), 1.4, { dir: 1, f0: 84, v: 12 }), { gain: 0.5, rev: 0.12, hall: 0.06 });
  put(SFX, 2.7 - 0.4, whoosh(rngFor('mw1'), 0.8, 300, 2200, 500, 0.5, 1.1), { gain: 0.25, pan: (t) => -0.85 + 2.1 * t, rev: 0.1 });
  put2(SFX, 3.5 - 0.7, scooter(rngFor('moto2'), 1.4, { dir: -1, f0: 96, v: 13, d: 3.0 }), { gain: 0.55, rev: 0.12, hall: 0.06 });
  put(SFX, 3.5 - 0.4, whoosh(rngFor('mw2'), 0.8, 320, 2500, 520, 0.5, 1.1), { gain: 0.27, pan: (t) => 0.85 - 2.1 * t, rev: 0.1 });
  put(SFX, 3.0, horn(0.12, 415), { gain: 0.09, pan: 0.45, rev: 0.3, hall: 0.35 });
  put(SFX, 3.17, horn(0.16, 415), { gain: 0.09, pan: 0.45, rev: 0.3, hall: 0.35 });
  // plastic stool creak (tourist sits) ~4.0
  put(SFX, 3.86, creak(rngFor('stool1'), 0.32), { gain: 0.32, pan: 0.15, rev: 0.25 });
  put(SFX, 3.96, plop(rngFor('sit1'), 170, 75, 0.18, 0.4), { gain: 0.3, pan: 0.15, rev: 0.2 });

  // café: kettle simmer bed (continues under the roasting) + light tick at 5.6
  put2(SFX, 4.5, kettleSimmer(rngFor('simmer'), 3.4), { gain: 0.24, rev: 0.15 });
  put(SFX, 5.6, lightTick(rngFor('tick56')), { gain: 0.3, pan: 0.1, rev: 0.3, hall: 0.2 });

  // TITLE HIT 7.0: boom + shimmer + short đàn bầu phrase
  put(MUSIC, 7.0, bigBoom(rngFor('boom7'), 2.2), { gain: 0.55, rev: 0.15 });
  put2(MUSIC, 7.0, crash(rngFor('c7'), 2.4), { gain: 0.1, rev: 0.4 });
  put2(MUSIC, 7.0, shimmer(rngFor('flare7'), 1.6), { gain: 0.1, rev: 0.6 });
  put2(MUSIC, 7.0, pad([50, 57, 62, 65, 69, 74], 1.9, { attack: 0.03, release: 0.3, cutoff: 2600, detune: 9 }), { gain: 0.11, rev: 0.45 });
  [50, 57, 62, 65, 69, 74, 81].forEach((m, k) => tranhNote(7.0 + k * 0.035, m, 1.8, 0.05, -0.6 + k * 0.2, 'title' + k, 0.55));
  lead(7.0, 81, 0.7, { bendFrom: -5, bendTime: 0.35, vibDepth: 0.4, attack: 0.05, gain: 0.2, rev: 0.55 });
  lead(7.75, 79, 0.22, { gain: 0.17 });
  lead(8.0, 77, 0.45, { bendFrom: -2, gain: 0.17 });
  lead(8.5, 74, 1.1, { bendFrom: 0, vibDepth: 0.38, endBend: -1, endBendTime: 0.35, gain: 0.17, rev: 0.5 });
}

// ---------- ACT 2 : the art of the phin (7–31) ----------
{
  // harmony per bar (bars start on odd seconds); 24–26 suspense, 28–31 faster changes
  const harm = [[7, 'Dm', 2], [9, 'Dm', 2], [11, 'Bb', 2], [13, 'C', 2], [15, 'Dm', 2], [17, 'F', 2], [19, 'Bb', 2], [21, 'C', 2], [23, 'Dm', 1],
    [26, 'C', 2], [28, 'Dm', 1], [29, 'Bb', 1], [30, 'C', 1]];
  harm.forEach(([T, ch, d]) => {
    const cut = T >= 28 ? 3400 : T >= 26 ? 2200 : 1500;
    put2(MUSIC, T, pad(V[ch], d - 0.03, { attack: T === 26 ? 0.8 : 0.08, release: 0.15, cutoff: cut, pump: (t) => pumpAt(T + t, 0.28) }), { gain: T >= 28 ? 0.085 : 0.065, rev: 0.3 });
  });
  // hero strings swell 28–31
  put2(MUSIC, 28.0, pad([62, 69, 74, 77], 3.0, { attack: 2.0, release: 0.2, cutoff: 3800, tab: TAB_STR, vib: 12, detune: 9 }), { gain: 0.05, rev: 0.45 });
  // suspense 24–26: dark filtered pad + D drone + đàn bầu harmonic-like high tone
  put2(MUSIC, 24.0, pad([46, 53, 58, 62], 2.0, { attack: 0.4, release: 0.3, cutoff: 520 }), { gain: 0.08, rev: 0.5 });
  put(MUSIC, 24.0, drone(2.1, { attack: 0.3, release: 0.4 }), { gain: 0.07, rev: 0.2 });
  lead(24.1, 86, 1.6, { bendFrom: -2, bendTime: 0.8, vibDepth: 0.2, vibRate: 4.2, attack: 0.4, bright: 0.25, gain: 0.05, rev: 0.75, pan: 0.2 });

  // drums: soft kick (1 & 3 + ghost), mõ on 2 & 4, shaker 16ths
  const K = kick({ decay: 0.22, click: 0.25 }), KG = kick({ decay: 0.16, seed: 'g', click: 0.15 });
  const MO_HI = mo(rngFor('moH'), 900), MO_LO = mo(rngFor('moL'), 640);
  const grooveA = (t0, t1, o = {}) => {
    for (let t = t0; t < t1 - 1e-6; t += BAR) {
      put(MUSIC, t, K, { gain: o.kick ?? 0.38, rev: 0.03 });
      put(MUSIC, t + 1.0, K, { gain: (o.kick ?? 0.38) * 0.9, rev: 0.03 });
      put(MUSIC, t + 0.75, KG, { gain: 0.12, rev: 0.03 });
      put(MUSIC, t + 0.5, MO_HI, { gain: 0.11, pan: 0.25, rev: 0.3 });
      put(MUSIC, t + 1.5, MO_LO, { gain: 0.12, pan: 0.25, rev: 0.3 });
      put(MUSIC, t + 1.75, MO_HI, { gain: 0.05, pan: 0.3, rev: 0.3 });
    }
  };
  grooveA(7.0, 24.0);
  for (let t = 9.0; t < 24.0 - 1e-6; t += 0.125) {
    const k = Math.round((t - 9) / 0.125) % 4;
    put(MUSIC, t, shaker(rngFor('sh' + t), k === 2), { gain: k === 2 ? 0.05 : k === 0 ? 0.035 : 0.025, pan: -0.35, rev: 0.08 });
  }
  // time-lapse 26–28: building pulse
  for (let t = 26.0; t < 28.0 - 1e-6; t += BEAT) put(MUSIC, t, K, { gain: 0.22 + 0.1 * (t - 26), rev: 0.03 });
  for (let t = 27.0; t < 28.0 - 1e-6; t += 0.25) put(MUSIC, t, KG, { gain: 0.08, rev: 0.03 });
  for (let t = 26.0; t < 28.0 - 1e-6; t += 0.125) put(MUSIC, t, shaker(rngFor('sh2' + t), false), { gain: 0.02 + 0.012 * (t - 26), pan: -0.35, rev: 0.08 });
  put(MUSIC, 26.0, riser(rngFor('riser26'), 2.0, 300, 8000), { gain: 0.1, rev: 0.3 });
  // hero 28–31: four-on-floor, mõ, shaker, toms fill into 31
  for (let t = 28.0; t < 31.0 - 1e-6; t += BEAT) put(MUSIC, t, K, { gain: 0.42, rev: 0.03 });
  for (let t = 28.0; t < 30.5 - 1e-6; t += BEAT) put(MUSIC, t + 0.25, MO_HI, { gain: 0.08, pan: 0.25, rev: 0.3 });
  for (let t = 28.5; t < 30.5 - 1e-6; t += 1.0) put(MUSIC, t, clap(rngFor('clp' + t)), { gain: 0.1, rev: 0.25 });
  for (let t = 28.0; t < 31.0 - 1e-6; t += 0.125) { const k = Math.round((t - 28) / 0.125) % 2; put(MUSIC, t, shaker(rngFor('sh3' + t), k === 1), { gain: k ? 0.05 : 0.03, pan: -0.35, rev: 0.08 }); }
  [[30.5, 147], [30.625, 123], [30.75, 98], [30.875, 82]].forEach(([t, f]) => put(MUSIC, t, tom(f, 0.25), { gain: 0.15 + (t - 30.5) * 0.2, pan: 0.4 - (t - 30.5) * 2, rev: 0.25 }));
  put2(MUSIC, 28.0, crash(rngFor('c28'), 1.6), { gain: 0.06, rev: 0.3 });
  put(MUSIC, 29.0, riser(rngFor('riser29'), 2.0, 300, 9000), { gain: 0.12, rev: 0.3 });

  // bass
  const pat = [[0, 0, 0.4], [0.75, 0, 0.2], [1.0, 'f', 0.4], [1.5, 12, 0.2], [1.75, 'f', 0.2]];
  harm.forEach(([T, ch, d]) => {
    const root = ROOT[ch];
    if (T >= 26 && T < 28) { for (let t = T; t < T + d - 1e-6; t += 0.25) put(MUSIC, t, bassNote(root + (Math.round((t - T) / 0.25) % 2 ? 12 : 0), 0.18), { gain: 0.14 + 0.06 * (t - 26) }); return; }
    if (T >= 28) { for (let t = T; t < T + d - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - T) / 0.25) % 2 ? root + 12 : root, 0.2), { gain: 0.26 }); return; }
    for (const [off, iv, dd] of pat) {
      if (off >= d) continue;
      const t = T + off, m = iv === 'f' ? fifthOf(root) : root + iv;
      put(MUSIC, t, bassNote(m, dd), { gain: 0.24 });
    }
  });

  // đàn tranh motif (8ths, quiet, right) — rests during the press (17–19) and drip
  const patIdx = [0, 2, 4, 2, 5, 4, 2, 3];
  harm.forEach(([T, ch, d]) => {
    if (T < 9 || T === 17 || (T >= 24 && T < 26)) return;
    let base = SCALE.findIndex((m) => m % 12 === ROOT[ch] % 12 && m >= 57);
    if (base < 0) base = SCALE.findIndex((m) => m % 12 === (ROOT[ch] + 4) % 12 && m >= 57);   // Bb (not pentatonic) -> start on its third, D
    const step = T >= 26 ? 0.125 : 0.25;
    for (let k = 0; k * step < d - 1e-6; k++) {
      const t = T + k * step, pi = patIdx[k % 8] + (T >= 26 && k >= 8 ? 2 : 0);
      tranhNote(t, SCALE[Math.min(SCALE.length - 1, base + pi)], 0.6, T >= 26 ? 0.04 : 0.045, 0.5, 'os' + T + k, 0.35);
    }
  });

  // đàn bầu phrases  [time, midi, dur, bendFrom, extra]
  const motifs = [
    [11.0, 74, 0.45, -2], [11.5, 72, 0.22, 0], [11.75, 69, 0.22, 0], [12.0, 67, 0.9, 2, { vibDepth: 0.35 }],
    [13.0, 69, 0.45, -2], [13.5, 72, 0.45, 0], [14.0, 74, 0.95, -2, { vibDepth: 0.38, bendTime: 0.25 }],
    [15.0, 77, 0.45, -3], [15.5, 74, 0.22, 0], [15.75, 72, 0.22, 0], [16.0, 69, 0.9, 0, { endBend: -2, endBendTime: 0.3 }],
    [17.0, 65, 0.45, -2], [17.5, 69, 0.45, 0], [18.0, 72, 0.95, -2, { vibDepth: 0.4 }],
    [19.0, 74, 0.45, -2], [19.5, 77, 0.45, 0], [20.0, 74, 0.22, 0], [20.25, 72, 0.22, 0], [20.5, 69, 0.95, 1, { vibDepth: 0.35 }],
    [21.0, 72, 0.45, -2], [21.5, 74, 0.45, 0], [22.0, 79, 0.9, -3, { vibDepth: 0.4, bendTime: 0.25 }],
    [23.0, 77, 0.45, 0], [23.5, 74, 0.42, 0, { endBend: -2, endBendTime: 0.25 }],
    // hero soar 28–31
    [28.0, 81, 0.9, -3, { vibDepth: 0.42, bendTime: 0.25 }], [29.0, 84, 0.45, -2], [29.5, 81, 0.45, 0], [30.0, 79, 0.45, -2], [30.5, 81, 0.45, -1],
  ];
  for (const [t, m, d, bf, ex] of motifs) lead(t, m, d, { bendFrom: bf, gain: t >= 28 ? 0.19 : 0.15, ...(ex || {}) });

  // shot accents (very soft) on cuts
  [[9.5, 0.5], [12.0, -0.5], [14.0, 0.5], [17.0, -0.5], [19.0, 0.5], [22.0, -0.5]].forEach(([t, p], i) => put(MUSIC, t, ting(m2f([93, 96, 98, 101, 98, 105][i]), 0.6), { gain: 0.035, pan: p, rev: 0.6 }));

  // ACT 2 PEAK LANDING 31.0 (rings until the 31.5 cut)
  put(MUSIC, 31.0, bigBoom(rngFor('boom31'), 1.2, { decay: 0.4 }), { gain: 0.45, rev: 0.15 });
  put2(MUSIC, 31.0, crash(rngFor('c31'), 1.0), { gain: 0.15, rev: 0.4 });
  put(MUSIC, 31.0, K, { gain: 0.45, rev: 0.03 });
  put2(MUSIC, 31.0, pad([50, 57, 62, 65, 69, 74, 77], 0.55, { attack: 0.02, release: 0.05, cutoff: 3600, detune: 9 }), { gain: 0.12, rev: 0.4 });
  put(MUSIC, 31.0, bassNote(38, 0.5), { gain: 0.3 });
  lead(31.0, 86, 0.5, { bendFrom: -3, bendTime: 0.18, vibDepth: 0.4, gain: 0.2, rev: 0.5, release: 0.05 });
  [62, 69, 74, 77, 81, 86].forEach((m, k) => tranhNote(31.0 + k * 0.03, m, 0.55, 0.05, -0.5 + 0.2 * k, 'land' + k, 0.5));

  // ---- foley (the star) ----
  // 7.0–9.5 roasting: charcoal bed, butter sizzle, beans in the wok
  put2(SFX, 7.0, fireBed(rngFor('char'), 2.8, 28), { gain: 0.3, rev: 0.12 });
  put2(SFX, 7.05, sizzle(rngFor('butter'), 2.45), { gain: 0.26, rev: 0.1 });
  put2(SFX, 7.6 - 0.1, wokToss(rngFor('wok1')), { gain: 0.75, rev: 0.18 });
  put2(SFX, 8.6 - 0.1, wokToss(rngFor('wok2')), { gain: 0.75, rev: 0.18 });
  // 9.5–12.0 hand grinder (one crank per beat) + powder hiss
  [9.5, 10.0, 10.5, 11.0, 11.5].forEach((t, k) => put(SFX, t, grindCrank(rngFor('grind' + k)), { gain: 0.8 + 0.05 * (k % 2), pan: 0.12 * (k % 2 ? 1 : -1), rev: 0.15 }));
  put(SFX, 11.25, powderPour(rngFor('powder'), 0.75), { gain: 0.42, pan: -0.1, rev: 0.15 });
  // 12.0–14.0 kettle pour + steam
  put2(SFX, 12.2, waterPour(rngFor('kettle'), 1.4, { f0: 700, f1: 1900, metal: true }), { gain: 0.62, rev: 0.18 });
  put2(SFX, 12.0, steam(rngFor('steam'), 2.0), { gain: 0.12, rev: 0.15 });
  // 14.0–17.0 grounds into the phin + shake
  [14.4, 15.2, 16.0].forEach((t, k) => put(SFX, t, groundsDrop(rngFor('gd' + k)), { gain: 1.0, pan: [-0.1, 0.1, 0][k], rev: 0.2 }));
  put(SFX, 16.4, phinShake(rngFor('shake'), 0.4), { gain: 0.7, rev: 0.18 });
  // 17.0–19.0 press: scrape + "kịch"
  put(SFX, 17.3, metalScrape(rngFor('scrape'), 1.0), { gain: 0.5, pan: 0.05, rev: 0.15 });
  put(SFX, 18.4 - 0.022, kichClick(rngFor('kich')), { gain: 1.15, rev: 0.22, hall: 0.12 });
  // 19.0–22.0 small pour + bloom fizz
  put2(SFX, 19.3, waterPour(rngFor('pour2'), 0.7, { f0: 1100, f1: 1700 }), { gain: 0.48, rev: 0.18 });
  put2(SFX, 20.0, fizz(rngFor('bloom'), 2.0), { gain: 0.75, rev: 0.12 });
  // 22.0–24.0 fill pour + aluminum lid clink
  put2(SFX, 22.2, waterPour(rngFor('pour3'), 1.0, { f0: 900, f1: 2300 }), { gain: 0.55, rev: 0.18 });
  put(SFX, 23.5, clink(rngFor('lid'), 1180), { gain: 0.5, pan: 0.1, rev: 0.25, hall: 0.25 });
  // 24.0–28.0 THE DRIP: two huge slow-motion drips with long tails
  [[24.5, 1.0], [25.6, 0.93]].forEach(([t, p], k) => {
    put(SFX, t - 0.35, whoosh(rngFor('pre' + k), 0.4, 150, 500, 250, 0.85, 1.0), { gain: 0.06, rev: 0.1 });
    put(SFX, t, bigDrip(rngFor('drip' + k), p), { gain: 0.6, pan: 0, rev: 0.2, hall: 0.85 });
  });
  // time-lapse 26–28: fast ticking clock, accelerating drips, finger taps, whoosh into 28
  { let t = 26.0, k = 0; while (t < 27.97) { put(SFX, t, clockTick(rngFor('ck' + k), k % 2 === 0), { gain: 0.24, pan: 0.35, rev: 0.12 }); const u = (t - 26) / 2; t += 0.125 * (1 - 0.6 * u); k++; } }
  { let t = 26.05, k = 0; while (t < 27.95) { const u = (t - 26) / 2; put(SFX, t, smallDrip(rngFor('sd' + k), 850 + 500 * u + 120 * (k % 3)), { gain: 0.26 + 0.1 * u, pan: (k % 2 ? 0.1 : -0.1), rev: 0.15, hall: 0.15 }); t += Math.max(0.045, 0.42 * Math.pow(1 - u, 1.6)); k++; } }
  [26.5, 26.56, 26.62, 26.7].forEach((t, k) => put(SFX, t, fingerTap(rngFor('tap' + k)), { gain: 0.45 + 0.05 * k, pan: -0.3, rev: 0.15 }));
  put(SFX, 26.8, whoosh(rngFor('tl'), 1.2, 200, 5200, 2500, 0.93, 1.0), { gain: 0.32, pan: (t) => -0.6 + t, rev: 0.12, hall: 0.1 });
  // 28.0–31.0 hero pour over ice, ice cracking, stir, glass slide
  put2(SFX, 28.2, waterPour(rngFor('hero'), 1.0, { f0: 520, f1: 1300, thick: 1 }), { gain: 0.65, rev: 0.18, hall: 0.1 });
  put2(SFX, 28.4, iceCrack(rngFor('ice'), 1.6, (t) => 170 * Math.exp(-t / 0.6) + 22), { gain: 0.8, rev: 0.15 });
  [[29.6, 2093, -0.15], [29.9, 2217, 0.15], [30.2, 2093, -0.1]].forEach(([t, f, p], k) => put(SFX, t, stirClink(rngFor('stir' + k), f), { gain: 0.55, pan: p, rev: 0.2, hall: 0.15 }));
  put(SFX, 30.4, slideWood(rngFor('slide'), 0.5), { gain: 0.65, pan: (t) => 0.3 - t, rev: 0.12 });
}

// ---------- ACT 3 : "phê" (31–45) ----------
{
  // 31.0–33.0 first sip in near-silence; heartbeat from 32.5; reversed cymbal into 33
  put(SFX, 32.0, slurp(rngFor('sip'), 0.4), { gain: 0.42, pan: 0.05, rev: 0.12 });
  const HB = heartbeat();
  for (let t = 32.5, k = 0; t < 35.5 - 1e-6; t += BEAT, k++) put(SFX, t, HB, { gain: 0.42 + 0.03 * Math.min(k, 5), rev: 0.05 });
  put2(SFX, 32.5, reverseCrash(rngFor('rc32'), 0.5), { gain: 0.2, rev: 0.1 });

  // 33.0 IMPACT: deep boom + whoosh
  put(SFX, 33.0, bigBoom(rngFor('boom33'), 2.4, { fStart: 85, fEnd: 30, decay: 0.75, crack: 0.35 }), { gain: 0.9, rev: 0.1, hall: 0.25 });
  put(SFX, 33.0, whoosh(rngFor('imp33'), 1.3, 2600, 3000, 220, 0.06, 0.9), { gain: 0.32, pan: (t) => 0.4 * Math.sin(TAU * 0.8 * t), rev: 0.1, hall: 0.4 });

  // 33.0–35.5 vertigo: shepard riser + eerie drone + noise riser + reverse cymbal
  put2(MUSIC, 33.0, shepard(2.5), { gain: 0.16, rev: 0.45 });
  put(MUSIC, 33.0, drone(2.5, { attack: 0.6, release: 0.05, midi: 38 }), { gain: 0.08, rev: 0.3 });
  put2(MUSIC, 33.2, pad([74, 75, 81], 2.3, { attack: 1.6, release: 0.05, cutoff: 3000, detune: 18 }), { gain: 0.03, rev: 0.6 });   // dissonant shimmer cluster
  put(MUSIC, 34.0, riser(rngFor('riser34'), 1.5, 300, 9000), { gain: 0.14, rev: 0.3 });
  put2(MUSIC, 34.5, reverseCrash(rngFor('rc34'), 1.0), { gain: 0.14, rev: 0.25 });

  // 35.5–39.5 EUPHORIA: F – C – Dm – Bb, lush strings, soaring đàn bầu
  const eu = [[35.5, 'F', [53, 60, 65, 69, 72, 77]], [36.5, 'C', [48, 55, 60, 64, 67, 72]], [37.5, 'Dm', [50, 57, 62, 65, 69, 74]], [38.5, 'Bb', [46, 53, 58, 62, 65, 69]]];
  eu.forEach(([T, ch, v], k) => {
    put2(MUSIC, T, pad(v, 0.98, { attack: 0.05, release: 0.15, cutoff: 3200, detune: 9, pump: (t) => pumpAt(T + t, 0.25) }), { gain: 0.085, rev: 0.45 });
    put2(MUSIC, T, pad(v.map((m) => m + 12).slice(1), 1.0, { attack: k === 0 ? 0.25 : 0.12, release: 0.25, cutoff: 5000, tab: TAB_STR, vib: 14, detune: 10, seed: 'str' + k }), { gain: 0.06, rev: 0.6 });
    for (let t = T; t < T + 1 - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - T) / 0.25) % 2 ? ROOT[ch] + 12 : ROOT[ch], 0.2), { gain: 0.26 });
  });
  put(MUSIC, 35.5, bigBoom(rngFor('boom355'), 1.6, { decay: 0.5 }), { gain: 0.5, rev: 0.2 });
  put2(MUSIC, 35.5, crash(rngFor('c355'), 2.6), { gain: 0.16, rev: 0.45 });
  put(MUSIC, 35.5, drone(4.0, { attack: 0.05, release: 0.3, midi: 41 }), { gain: 0.06, rev: 0.2 });
  // đàn tranh upward glissando at 35.5
  [53, 57, 60, 62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89].forEach((m, k) => tranhNote(35.5 + k * 0.028, m, 1.5, 0.042 + k * 0.003, -0.7 + k * 0.1, 'gl' + k, 0.6));
  // groove
  const K = kick({ decay: 0.24 }), MO_HI = mo(rngFor('moH3'), 900);
  for (let t = 35.5; t < 39.5 - 1e-6; t += BEAT) put(MUSIC, t, K, { gain: 0.42, rev: 0.03 });
  for (let t = 36.0; t < 39.5 - 1e-6; t += 1.0) put(MUSIC, t, clap(rngFor('cl3' + t)), { gain: 0.12, rev: 0.3 });
  for (let t = 35.5; t < 39.5 - 1e-6; t += BEAT) put(MUSIC, t + 0.25, MO_HI, { gain: 0.07, pan: 0.3, rev: 0.3 });
  for (let t = 35.5; t < 39.5 - 1e-6; t += 0.125) { const k = Math.round((t - 35.5) / 0.125) % 2; put(MUSIC, t, shaker(rngFor('sh4' + t), k === 1), { gain: k ? 0.05 : 0.03, pan: -0.35, rev: 0.08 }); }
  // tranh 8th arpeggio, right
  eu.forEach(([T, , v]) => [0, 2, 4, 2].forEach((ix, k) => tranhNote(T + k * 0.25, v[ix] + 12, 0.7, 0.035, 0.55, 'eu' + T + k, 0.45)));
  // soaring đàn bầu
  [[35.5, 84, 0.95, -3, { vibDepth: 0.45, bendTime: 0.3 }], [36.5, 86, 0.45, -2], [37.0, 84, 0.22, 0], [37.25, 81, 0.22, 0],
    [37.5, 81, 0.95, -2, { vibDepth: 0.45 }], [38.5, 77, 0.45, -2], [39.0, 79, 0.45, 0, { endBend: -2, endBendTime: 0.3 }]]
    .forEach(([t, m, d, bf, ex]) => lead(t, m, d, { bendFrom: bf, gain: 0.2, rev: 0.55, ...(ex || {}) }));
  // musical motorbike whooshes pitched to the key (F2 on C chord fifth / D on Dm)
  put2(SFX, 36.5 - 0.6, scooter(rngFor('mt1'), 1.2, { dir: 1, f0: m2f(41), v: 10, tonal: true }), { gain: 0.5, rev: 0.1, hall: 0.35 });
  put(SFX, 36.5 - 0.4, whoosh(rngFor('mtw1'), 0.8, 400, 2400, 600, 0.5, 2.5), { gain: 0.12, pan: (t) => -0.8 + 2 * t, rev: 0.1, hall: 0.3 });
  put2(SFX, 38.0 - 0.6, scooter(rngFor('mt2'), 1.2, { dir: -1, f0: m2f(45), v: 10, tonal: true }), { gain: 0.5, rev: 0.1, hall: 0.35 });
  put(SFX, 38.0 - 0.4, whoosh(rngFor('mtw2'), 0.8, 450, 2700, 650, 0.5, 2.5), { gain: 0.12, pan: (t) => 0.8 - 2 * t, rev: 0.1, hall: 0.3 });
  // ambience returns (faint city + birds)
  const hum2 = cityHum(rngFor('hum2'), 9.5);
  const h2 = (t) => pw([[0, 0], [1.0, 0.7], [7, 0.7], [9.2, 0]], t);
  mulEnv(hum2[0], h2); mulEnv(hum2[1], h2);
  put2(SFX, 35.5, hum2, { gain: 0.1, hall: 0.05 });

  // 39.5–42.5 COFFEE-DRUNK: slow, lazy, detuned (whole music bus wobbles in the master)
  put2(MUSIC, 39.5, pad(V.F, 2.0, { attack: 0.3, release: 0.2, cutoff: 2000, detune: 14 }), { gain: 0.08, rev: 0.5 });
  put2(MUSIC, 39.5, pad([65, 69, 72, 77], 2.0, { attack: 0.6, release: 0.3, cutoff: 3500, tab: TAB_STR, vib: 25, detune: 16, seed: 'drunk' }), { gain: 0.035, rev: 0.6 });
  put2(MUSIC, 41.5, pad(V.Bb, 1.0, { attack: 0.2, release: 0.15, cutoff: 1800, detune: 14 }), { gain: 0.08, rev: 0.5 });
  [[39.5, 41, 0.9], [40.5, 41, 0.4], [41.0, 48, 0.4], [41.5, 34, 0.9]].forEach(([t, m, d]) => put(MUSIC, t, bassNote(m, d), { gain: 0.22 }));
  const KD = kick({ decay: 0.3, fEnd: 42 });
  [39.5, 40.5, 41.5].forEach((t) => put(MUSIC, t, KD, { gain: 0.32, rev: 0.05 }));
  [40.0, 41.0, 42.0].forEach((t, k) => put(MUSIC, t, k % 2 ? mo(rngFor('mod' + k), 640) : MO_HI, { gain: 0.08, pan: 0.3, rev: 0.4 }));
  lead(39.5, 79, 0.9, { endBend: -3, endBendTime: 0.6, cents: -30, vibRate: 3.2, vibDepth: 0.5, gain: 0.17, rev: 0.6 });
  lead(40.8, 74, 0.55, { bendFrom: 4, bendTime: 0.4, cents: 25, vibRate: 3, vibDepth: 0.45, gain: 0.15, rev: 0.6 });
  lead(41.5, 72, 0.9, { bendFrom: -5, bendTime: 0.6, endBend: -2, endBendTime: 0.4, cents: -35, vibRate: 2.8, vibDepth: 0.5, gain: 0.16, rev: 0.6 });
  [65, 69, 72].forEach((m, k) => tranhNote(39.5 + k * 0.09, m, 1.2, 0.04, 0.3 - 0.3 * k, 'dr' + k, 0.5));
  // body comedy (tasteful)
  put(SFX, 40.6, hiccup(rngFor('hic')), { gain: 0.55, pan: 0.05, rev: 0.15 });
  put(SFX, 41.0, stoolScrape(rngFor('stool2'), 0.45), { gain: 0.42, pan: 0.15, rev: 0.2 });
  put(SFX, 41.5, plop(rngFor('sit2'), 160, 70, 0.2, 0.4), { gain: 0.32, pan: 0.15, rev: 0.2 });
  put(SFX, 41.42, slideWood(rngFor('slide2'), 0.36), { gain: 0.25, pan: (t) => -0.4 + t, rev: 0.12 });
  put(SFX, 41.8, stirClink(rngFor('icetea'), 1975), { gain: 0.45, pan: -0.05, rev: 0.2, hall: 0.2 });
  put2(SFX, 41.81, iceCrack(rngFor('ice2'), 0.3, (t) => 90 * Math.exp(-t / 0.1) + 10), { gain: 0.3, rev: 0.15 });

  // 42.5–45.0 RESOLUTION: back in tune, C → F cadence, final hit at 43.0
  put2(MUSIC, 42.5, pad(V.C, 0.48, { attack: 0.1, release: 0.06, cutoff: 2400 }), { gain: 0.085, rev: 0.45 });
  put(MUSIC, 42.5, bassNote(36, 0.45), { gain: 0.24 });
  lead(42.5, 72, 0.45, { bendFrom: -2, gain: 0.16, rev: 0.55 });
  put(MUSIC, 42.5, riser(rngFor('riser425'), 0.5, 600, 7000), { gain: 0.08, rev: 0.3 });
  put(MUSIC, 43.0, bigBoom(rngFor('boom43'), 1.8, { decay: 0.5 }), { gain: 0.5, rev: 0.2 });
  put(MUSIC, 43.0, KD, { gain: 0.3, rev: 0.05 });
  put2(MUSIC, 43.0, crash(rngFor('c43'), 1.8), { gain: 0.12, rev: 0.45 });
  put2(MUSIC, 43.0, pad([53, 60, 65, 69, 74, 79], 1.2, { attack: 0.04, release: 0.5, cutoff: 2800, detune: 8 }), { gain: 0.12, rev: 0.55 });
  put2(MUSIC, 43.0, pad([65, 72, 77, 81], 1.2, { attack: 0.15, release: 0.5, cutoff: 5000, tab: TAB_STR, vib: 12, detune: 9, seed: 'fin' }), { gain: 0.045, rev: 0.6 });
  put(MUSIC, 43.0, bassNote(41, 1.2), { gain: 0.26 });
  lead(43.0, 77, 1.4, { bendFrom: -5, bendTime: 0.45, vibDepth: 0.5, attack: 0.06, release: 0.3, gain: 0.21, rev: 0.6 });
  [53, 60, 65, 69, 72, 77, 81].forEach((m, k) => tranhNote(43.0 + k * 0.045, m, 1.6, 0.05, -0.5 + k * 0.17, 'fin' + k, 0.6));
  [[43.2, 0.6], [43.6, -0.5], [44.0, 0.3], [44.3, -0.7]].forEach(([t, p], k) => sparrowAt(t, 0.05, p, 'z' + k));
}

// ───────────────────────────── 7. Master ─────────────────────────────

// (a) duck the music under foley (≈ −3.5 dB at full) + per-act music trim
const duck = new Float32Array(N);
{
  let e = 0; const at = 1 - Math.exp(-1 / (0.005 * SR)), rl = 1 - Math.exp(-1 / (0.25 * SR));
  for (let i = 0; i < N; i++) {
    const a = Math.max(Math.abs(SFX.L[i]), Math.abs(SFX.R[i]));
    e += (a > e ? at : rl) * (a - e);
    duck[i] = 1 - 0.34 * clamp(e / 0.25, 0, 1);
  }
  const trim = (t) => pw([[0, 1.25], [4.5, 1.25], [5.5, 1.0], [6.95, 1.0], [7.0, 0.85], [24, 0.85], [26, 0.95], [28, 1.0], [33, 1.0], [35.4, 1.0], [35.5, 1.15], [39.4, 1.15], [39.7, 1.0], [45, 1.0]], t);
  for (let i = 0; i < N; i++) duck[i] *= trim(i / SR);
}

// (b) coffee-drunk tape wobble 39.5–42.5 on the whole music bus (dry + hall send):
//     variable delay line (two slow LFOs, ≈ ±0.6 semitone seasick drift) + gentle sway
const WOB0 = 39.5, WOB1 = 42.55, WOB_RAMP = 0.45;
function wobble(x) {
  const y = Float32Array.from(x);
  const i0 = Math.floor(WOB0 * SR), i1 = Math.ceil(WOB1 * SR);
  for (let i = i0; i < i1; i++) {
    const t = i / SR, tt = t - WOB0;
    const w = smooth(tt / WOB_RAMP) * smooth((WOB1 - t) / WOB_RAMP);
    const d = w * SR * (0.0075 * (1 - Math.cos(TAU * 0.55 * tt)) + 0.0018 * (1 - Math.cos(TAU * 1.7 * tt)));
    const p = i - d, k = Math.floor(p), f = p - k;
    const xm1 = x[k - 1], x0 = x[k], x1 = x[k + 1], x2 = x[k + 2];   // cubic Hermite interpolation
    const c1 = 0.5 * (x1 - xm1), c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
    y[i] = ((c3 * f + c2) * f + c1) * f + x0;
  }
  return y;
}
for (const key of ['L', 'R', 'hL', 'hR']) MUSIC[key] = wobble(MUSIC[key]);
for (let i = Math.floor(WOB0 * SR); i < Math.ceil(WOB1 * SR); i++) {
  const t = i / SR, w = smooth((t - WOB0) / WOB_RAMP) * smooth((WOB1 - t) / WOB_RAMP), s = 0.1 * w * Math.sin(TAU * 0.45 * (t - WOB0));
  MUSIC.L[i] *= 1 + s; MUSIC.R[i] *= 1 - s;
}

// (c) music gate: hard-ish cut at 31.5 (60 ms), back open for the 33.0 impact
const I_GATE0 = Math.round(31.47 * SR), I_GATE1 = Math.round(31.53 * SR), I_OPEN0 = Math.round(32.94 * SR), I_OPEN1 = Math.round(32.99 * SR);
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
// hall: music (ducked) + SFX hall sends; cleared right after the 31.5 cut so nothing rings back at 33
const hallInL = new Float32Array(N), hallInR = new Float32Array(N);
for (let i = 0; i < N; i++) { hallInL[i] = MUSIC.hL[i] * duck[i] + SFX.hL[i]; hallInR[i] = MUSIC.hR[i] * duck[i] + SFX.hR[i]; }
const [hallL, hallR] = reverb(hallInL, hallInR, { fb: 0.865, damp: 0.3, pre: 0.028, clearAt: I_GATE1 + 16 });
// room: small, close, intimate space for the foley
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
const FADE0 = 43.9, FADE1 = 44.7;
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
for (let it = 0; it < 3; it++) {
  out = limit(preL, preR, gain, CEIL_DBTP);
  const lu = loudness(out.L, out.R).integ;
  if (Math.abs(lu - TARGET_LUFS) < 0.1) break;
  gain *= Math.pow(10, (TARGET_LUFS - lu) / 20);
}
let mL = out.L, mR = out.R;
// exact digital silence for the last 0.3 s; safety true-peak trim
for (let i = Math.round(FADE1 * SR); i < N; i++) { mL[i] = 0; mR[i] = 0; }
{
  const tp = truePeak(mL, mR); let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, tp[i]);
  const lim = Math.pow(10, -1.1 / 20);
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

// (i) verification: re-read the file and report duration, peak, true peak, loudness, per-second RMS
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
  const row = []; for (let s = 0; s < 45; s++) row.push(`${String(s).padStart(2)}:${rmsW(s, s + 1).toFixed(0).padStart(4)}`);
  console.log('RMS per second (dBFS):'); for (let k = 0; k < 45; k += 9) console.log('  ' + row.slice(k, k + 9).join('  '));
  for (const [name, a, c] of [['pre-title 6.5-7.0', 6.5, 7.0], ['TITLE HIT 7.0-7.5', 7.0, 7.5], ['drip zone 24-26', 24, 26], ['hero 30.5-31.0', 30.5, 31.0], ['peak 31.0-31.5', 31.0, 31.5],
    ['SILENCE 31.6-32.0', 31.6, 32.0], ['sip 32.0-32.45', 32.0, 32.45], ['pre-impact 32.5-33', 32.5, 33.0], ['IMPACT 33.0-33.5', 33.0, 33.5], ['euphoria 35.5-39.5', 35.5, 39.5],
    ['drunk 39.5-42.5', 39.5, 42.5], ['pre-final 42.5-43', 42.5, 43.0], ['FINAL HIT 43.0-43.5', 43.0, 43.5], ['tail 44.7-45.0', 44.7, 45.0]]) {
    console.log(`  ${name.padEnd(22)} rms ${rmsW(a, c).toFixed(1).padStart(6)} dBFS`);
  }
}

// optional: per-cue balance of foley vs (ducked) music, pre-limiter (set DEBUG=1)
if (process.env.DEBUG) {
  const KW = (x) => filt(filt(x, 'hp', 120, 0.5), 'peak', 3500, 0.6, 4);   // rough loudness weighting
  const muL = new Float32Array(N), muR = new Float32Array(N);
  for (let i = 0; i < N; i++) { const g = gateM(i); muL[i] = (MUSIC.L[i] * duck[i] + hallL[i]) * g; muR[i] = (MUSIC.R[i] * duck[i] + hallR[i]) * g; }
  const sKL = KW(SFX.L), sKR = KW(SFX.R), mKL = KW(muL), mKR = KW(muR);
  const rms = (A, B, a, b) => { let s = 0; for (let i = a; i < b; i++) s += A[i] * A[i] + B[i] * B[i]; return Math.sqrt(s / (2 * (b - a))); };
  const dB = (x) => (20 * Math.log10(x)).toFixed(1).padStart(6);
  const GR = (a, b) => { let m = 1; const lg = Math.min(...[]) ; for (let i = a; i < b; i++) { const pre = Math.max(Math.abs(preL[i]), Math.abs(preR[i])) * gain, po = Math.max(Math.abs(mL[i]), Math.abs(mR[i])); if (pre > 0.05) m = Math.min(m, po / pre); } return m; };
  const cues = [[0.2, 2.5, 'dawn'], [1.6, 2.1, 'flare'], [2.3, 3.0, 'moto1'], [3.0, 3.3, 'horn'], [3.1, 3.9, 'moto2'], [3.85, 4.3, 'stool'], [4.6, 5.5, 'simmer'], [5.6, 5.8, 'tick'], [7.0, 7.6, 'TITLE'],
    [7.6, 8.1, 'wok1'], [8.6, 9.1, 'wok2'], [9.5, 11.9, 'grind'], [11.3, 12.0, 'powder'], [12.2, 13.6, 'kettle'], [14.4, 14.7, 'drop1'], [15.2, 15.5, 'drop2'], [16.0, 16.3, 'drop3'], [16.4, 16.8, 'shake'],
    [17.3, 18.3, 'scrape'], [18.38, 18.6, 'kich'], [19.3, 20.0, 'pour2'], [20.0, 22.0, 'fizz'], [22.2, 23.2, 'pour3'], [23.5, 23.8, 'lid'], [24.5, 25.2, 'drip1'], [25.6, 26.0, 'drip2'],
    [26.0, 28.0, 'timelapse'], [28.2, 29.2, 'heropour'], [29.2, 30.0, 'ice'], [29.6, 30.4, 'stir'], [30.4, 30.9, 'slide'], [32.0, 32.45, 'sip'], [32.5, 33.0, 'heart'], [35.9, 37.1, 'tonal moto1'],
    [37.4, 38.6, 'tonal moto2'], [40.6, 40.8, 'hiccup'], [41.0, 41.45, 'stool2'], [41.8, 42.1, 'clink']];
  for (const [a, b, nm] of cues) {
    const ia = Math.round(a * SR), ib = Math.round(b * SR), s = rms(sKL, sKR, ia, ib), m = rms(mKL, mKR, ia, ib);
    console.log(nm.padEnd(12), `${a.toFixed(2)}-${b.toFixed(2)}`.padEnd(12), 'sfx', dB(s), ' music', dB(m), ' sfx-music', (20 * Math.log10(s / m)).toFixed(1).padStart(6), '  limGR', (20 * Math.log10(GR(ia, ib))).toFixed(1));
  }
}
