'use strict';
/*
 * BÚN MẮM MIỀN TÂY / Mekong Fermented Fish Noodle Soup — cinematic short soundtrack (60 s)
 * Fully procedural audio in pure Node.js (no packages, no samples).
 * Run:  node audio.js   ->  writes audio.wav (48 kHz, stereo, 16-bit PCM, 60.000 s)
 *
 * Based on ../caphe/audio.js (same instruments, DSP, reverb, limiter, WAV writer),
 * plus a bendable waveguide đàn kìm (moon lute) lead for a southern "đờn ca tài tử" colour.
 *
 * Layout of this file:
 *   1. Core constants, seeded PRNG, math helpers
 *   2. DSP helpers (biquad filters, noise bursts, wavetables, modal resonators)
 *   3. Instruments  (đàn bầu, đàn tranh pluck, pad/strings, drone, drums, mõ, shaker, bass)
 *   4. Sound effects (generic foley from the earlier films)
 *   4b. New: đàn kìm, river/boat ambience, kitchen foley, comedy sounds
 *   5. Mix buses (MUSIC, SFX, AMB) + put()
 *   6. Score / cue list (Act 1 river wakes, Act 2 cooking, Act 3 smell → love)
 *   7. Master: ducking, smell wobble, music gate, room + hall reverbs, loudness normalise,
 *      true-peak limiter, fade, WAV writer, verification report
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
const rngFor = (name) => mulberry32(hashStr('bunmam:' + name));   // independent deterministic stream per cue

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


// ───────────── 4b. New for BÚN MẮM: đàn kìm, river, boats, kitchen foley, comedy ─────────────

/* Đàn kìm (moon lute) — bendable waveguide string (fractional delay, so pitch can glide):
 * bright plectrum excitation with a near-bridge pluck-position comb (nasal), 2-tap loop
 * filter, round wooden body + nasal formants. Ornaments: bendFrom (luyến glide in),
 * nhan (nhấn: press-bend up and back), endBend, vib (rung), trem (đánh vê tremolo re-picks).
 * o.tranh = true -> softer, rounder đàn tranh voicing of the same bendable string. */
function kim(midi, dur, o = {}) {
  const R = rngFor('kim' + (o.seed ?? '') + ':' + midi + ':' + dur);
  const isTr = !!o.tranh;
  const bendFrom = o.bendFrom || 0, bendTime = o.bendTime ?? Math.min(0.12, dur * 0.35);
  const nhan = o.nhan || 0, nhanAt = o.nhanAt ?? 0.3, nhanLen = o.nhanLen ?? Math.min(0.22, dur * 0.45);
  const endBend = o.endBend || 0, endBendTime = o.endBendTime ?? Math.min(0.2, dur * 0.4);
  const vibDepth = o.vib ?? (dur >= 0.6 ? 0.2 : 0), vibRate = o.vibRate ?? 5.6;
  const trem = o.trem || 0, cents = (o.cents || 0) / 100;
  const t60 = o.t60 ?? (isTr ? 2.6 : 1.3), release = o.release ?? 0.09;
  const s = isTr ? 0.62 : 0.78;                      // loop filter s·x[n] + (1-s)·x[n-1], group delay (1-s)
  const n = secs(dur + release);
  const st = (t) => {
    let v = cents;
    if (bendFrom) { const u = clamp(t / bendTime, 0, 1); v += bendFrom * (1 - u) * (1 - u) * (1 + u); }
    if (nhan) { const a = dur * nhanAt; v += nhan * smooth((t - a) / (nhanLen * 0.45)) * (1 - smooth((t - a - nhanLen * 0.55) / (nhanLen * 0.45))); }
    if (endBend) v += endBend * smooth((t - (dur - endBendTime)) / endBendTime);
    if (vibDepth) v += vibDepth * smooth((t - 0.15) / Math.max(0.2, dur * 0.6)) * Math.sin(TAU * vibRate * t);
    return v;
  };
  // excitation: first pick + tremolo re-picks
  const exc = new Float32Array(n);
  const picks = [[0, o.noPick ? 0.3 : 1]];
  if (trem) for (let t = 1 / trem; t < dur - 0.04; t += 1 / trem) picks.push([t + (R() - 0.5) * 0.004, 0.5 + 0.25 * R()]);
  const bright = o.bright ?? (isTr ? 0.45 : 0.8), pos = isTr ? 0.22 : 0.12;
  for (const [tp, a] of picks) {
    const P = SR / m2f(midi + st(tp)), Lx = Math.max(4, Math.round(P)), q = Math.max(1, Math.round(pos * P));
    const e = new Float32Array(Lx + q); let lp = 0;
    for (let k = 0; k < Lx; k++) { lp += bright * ((R() * 2 - 1) - lp); e[k] = lp * (1 - k / Lx); }
    e[0] += isTr ? 0.25 : 0.7;                       // plectrum click
    for (let k = Lx + q - 1; k >= q; k--) e[k] -= e[k - q];   // pluck-position comb
    addInto(exc, e, Math.max(0, Math.round(tp * SR)), a);
  }
  // waveguide loop
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
  else { out = filt(out, 'peak', 1250, 1.6, 5); out = filt(out, 'peak', 2900, 2.2, 3); out = filt(out, 'peak', 320, 1.2, 2.5); out = filt(out, 'lp', 8500, 0.7); }
  for (let i = 0; i < n; i++) { const t = i / SR; if (t > dur) out[i] *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1)); }
  return fadeEdges(norm(out), 0.0005, 0.01);
}

/* one lap of water against a hull / bank */
function lap(R, len) {
  const m = secs(len), n = secs(len + 0.12), x = noise(n, R), fc = 380 + R() * 520;
  const a = filt(x, 'bp', (t) => fc * (1 + 0.6 * t / len), 1.4), lo = filt(x, 'lp', 300, 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < m; i++) { const u = i / m, e = Math.pow(Math.sin(Math.PI * u), 1.6) * (1 - 0.4 * u); y[i] = (a[i] + 0.6 * lo[i]) * e; }
  addInto(y, bubble(200 + R() * 300, 0.04 + R() * 0.05, 0.7, 0.3), secs(len * (0.2 + 0.4 * R())), 0.15 * R());
  return fadeEdges(norm(y), 0.005, 0.02);
}
/* Mekong river bed: low water body, gentle lapping, far drops, slow swells (stereo) */
function riverAmb(R, dur) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const brown = () => { const x = noise(n, R); let b = 0; for (let i = 0; i < n; i++) { b = b * 0.996 + x[i] * 0.08; x[i] = b; } return norm(filt(filt(x, 'lp', 480, 0.7), 'hp', 70, 0.7)); };
  const bl = brown(), br = brown();
  const wl = norm(filt(noise(n, R), 'bp', 1300, 0.7)), wr = norm(filt(noise(n, R), 'bp', 1150, 0.7));
  const p1 = R() * TAU, p2 = R() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR, s1 = 0.7 + 0.3 * Math.sin(TAU * 0.17 * t + p1) * Math.sin(TAU * 0.41 * t), s2 = 0.7 + 0.3 * Math.sin(TAU * 0.15 * t + p2) * Math.sin(TAU * 0.37 * t + 1);
    L[i] = bl[i] * 0.42 * s1 + wl[i] * 0.035 * s2; Rr[i] = br[i] * 0.42 * s2 + wr[i] * 0.035 * s1;
  }
  let t = 0.15;
  while (t < dur - 0.6) { addPan(L, Rr, lap(R, 0.16 + R() * 0.3), secs(t), 0.22 + 0.3 * R(), (R() - 0.5) * 1.5); t += 0.22 + R() * 0.6; }
  t = 0.3;
  while (t < dur - 0.3) { addPan(L, Rr, smallDrip(R, 700 + R() * 900), secs(t), 0.04 + 0.05 * R(), (R() - 0.5) * 1.6); t += 0.5 + R() * 1.6; }
  norm2(L, Rr);
  for (let i = 0; i < n; i++) { const tt = i / SR, e = smooth(tt / 0.5) * smooth((dur - tt) / 0.5); L[i] *= e; Rr[i] *= e; }
  return [L, Rr];
}

/* far "tắc ráng" long-tail boat engine: single-cylinder putt-putt (mono, distant) */
function boatEngine(R, dur, o = {}) {
  const n = secs(dur), y = new Float32Array(n), rate = o.rate ?? 7.2;
  const thump = modal([[95, 0.05, 1], [190, 0.03, 0.5], [410, 0.015, 0.3]], 0.18);
  let t = 0.01;
  while (t < dur - 0.2) {
    const a = 0.75 + 0.25 * R();
    addInto(y, thump, secs(t), a);
    addInto(y, burst(R, 0.05, 'bp', 650 + R() * 500, 1.2, 0.012), secs(t + 0.003), 0.45 * a);
    t += (1 / rate) * (0.94 + 0.12 * R()) * (1 + 0.04 * Math.sin(TAU * 0.3 * t));
  }
  return fadeEdges(norm(filt(y, 'lp', o.lp ?? 1500, 0.7)), 0.2, 0.2);
}

/* distant greater coucal (chim bìm bịp): hollow accelerating hoots */
function coucal(R, count = 6) {
  const n = secs(2.0), y = new Float32Array(n);
  let t = 0.02, gap = 0.26;
  for (let k = 0; k < count; k++) {
    const m = secs(0.12), f = 400 - 6 * k + R() * 8, g = new Float32Array(m); let ph = 0;
    for (let i = 0; i < m; i++) { const u = i / m; ph += f * (1.04 - 0.08 * u) / SR; g[i] = (Math.sin(TAU * ph) + 0.25 * Math.sin(2 * TAU * ph) + 0.08 * Math.sin(3 * TAU * ph)) * Math.pow(Math.sin(Math.PI * u), 1.3); }
    addInto(y, g, secs(t), 0.8 + 0.2 * R());
    t += gap; gap *= 0.9;
  }
  return fadeEdges(norm(filt(y, 'lp', 1800, 0.7)), 0.005, 0.05);
}

/* water slapping a wooden hull: splash + hollow wood thump + bubbles */
function hullSlap(R, size = 1) {
  const n = secs(0.5), y = new Float32Array(n);
  addInto(y, modal([[150 / size, 0.06, 1], [330 / size, 0.04, 0.6], [720, 0.02, 0.25]], 0.3), 0, 0.6);
  addInto(y, filt(burst(R, 0.25, 'bp', 1400, 0.7, 0.05, 0.004), 'lp', 4500, 0.7), 0, 4);
  for (let k = 0; k < 4; k++) addInto(y, bubble(400 + R() * 900, 0.03 + R() * 0.03, 0.9, 0.3), secs(0.02 + R() * 0.15), 0.15 * R());
  return fadeEdges(norm(y), 0.002, 0.03);
}

/* oar stroke: wood knock on the gunwale + push of water + bubbles + drips */
function oarStroke(R) {
  const n = secs(0.9), y = new Float32Array(n);
  addInto(y, modal([[430, 0.035, 1], [1080, 0.02, 0.5], [2350, 0.01, 0.3]], 0.15, 0.0006), 0, 0.55);
  addInto(y, burst(R, 0.01, 'bp', 2500, 1, 0.002), 0, 0.2);
  const m = secs(0.5), x = noise(m, R);
  const sw = filt(x, 'bp', (t) => expi(2200, 650, t / 0.5), 1.0), lo = filt(x, 'lp', 700, 0.7);
  for (let i = 0; i < m; i++) { const t = i / SR, e = smooth(t / 0.04) * Math.exp(-Math.max(0, t - 0.04) / 0.13); sw[i] = sw[i] * e + lo[i] * e * 0.5; }
  addInto(y, norm(sw), secs(0.03), 0.9);
  for (let k = 0; k < 6; k++) addInto(y, bubble(500 + R() * 1100, 0.025 + R() * 0.03, 1.0, 0.3), secs(0.06 + R() * 0.3), 0.18 * R());
  for (let k = 0; k < 3; k++) addInto(y, smallDrip(R, 1100 + R() * 700), secs(0.45 + k * 0.12 + R() * 0.05), 0.08);
  return fadeEdges(norm(y), 0.001, 0.04);
}

/* water sloshing around a rocking boat */
function slosh(R, dur = 0.6) {
  const n = secs(dur), x = noise(n, R), y = new Float32Array(n);
  const a = filt(x, 'bp', (t) => 520 + 380 * Math.sin(TAU * 3 * t), 1.6), b = filt(x, 'lp', 450, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR, u = t / dur, e = Math.pow(Math.sin(Math.PI * u), 0.8) * (0.55 + 0.45 * Math.abs(Math.sin(TAU * 2.4 * t))); y[i] = (a[i] + 0.5 * b[i]) * e; }
  for (let k = 0; k < 8; k++) addInto(y, bubble(300 + R() * 700, 0.03 + R() * 0.04, 0.9, 0.3), secs(R() * (dur - 0.08)), 0.12 * R());
  return fadeEdges(norm(y), 0.01, 0.03);
}

/* kingfisher: sharp high piping calls */
function kingfisher(R) {
  const n = secs(0.5), y = new Float32Array(n);
  let t = 0;
  for (let k = 0; k < 3; k++) {
    const len = 0.045 + R() * 0.02, m = secs(len), f0 = 6200 + R() * 600, f1 = 4300 + R() * 400, g = new Float32Array(m); let ph = 0;
    for (let i = 0; i < m; i++) { const u = i / m; ph += expi(f0, f1, u) / SR; g[i] = (Math.sin(TAU * ph) + 0.2 * Math.sin(2 * TAU * ph)) * Math.pow(Math.sin(Math.PI * u), 1.2); }
    addInto(y, g, secs(t), 1 - 0.15 * k);
    t += len + 0.05 + R() * 0.02;
  }
  return fadeEdges(norm(y), 0.001, 0.01);
}

/* wing flutter: a train of soft feathery air pulses, fading as the bird leaves */
function wings(R, dur = 0.5, rate = 14) {
  const n = secs(dur), y = new Float32Array(n);
  for (let t = 0; t < dur - 0.05; t += (1 / rate) * (0.9 + 0.2 * R())) {
    const a = Math.exp(-t / (dur * 0.6)) * (0.7 + 0.3 * R());
    addInto(y, burst(R, 0.05, 'bp', 900 + R() * 900, 0.9, 0.012, 0.006), secs(t), a);
  }
  return fadeEdges(norm(filt(y, 'lp', 5000, 0.7)), 0.003, 0.02);
}

/* nasal sniff (inhale): formant-filtered breath with a slight upward glide */
function sniff(R, dur = 0.17, o = {}) {
  const n = secs(dur + 0.04), x = noise(n, R), rise = o.rise ?? 1.25;
  const f1 = filt(x, 'bp', (t) => expi(1500, 1500 * rise, t / dur), 3.5);
  const f2 = filt(x, 'bp', (t) => expi(3300, 3300 * rise, t / dur), 3);
  const air = filt(x, 'hp', 2200, 0.7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur;
    const e = u < 1 ? smooth(u / 0.18) * (1 - 0.35 * u) * smooth((1 - u) / 0.12) * (o.pulses ? 0.6 + 0.4 * Math.abs(Math.sin(Math.PI * o.pulses * u)) : 1) : 0;
    y[i] = (f1[i] + f2[i] * 0.6 + air[i] * 0.25) * e * (0.85 + 0.15 * Math.sin(TAU * 60 * t));
  }
  return fadeEdges(norm(y), 0.002, 0.01);
}

/* big pot at a rolling boil: low rumble, dense bubbles, big blorps, steam hiss (stereo) */
function boilBed(R, dur) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const mkR = () => { const x = noise(n, R); let b = 0; for (let i = 0; i < n; i++) { b = b * 0.996 + x[i] * 0.08; x[i] = b; } return norm(filt(x, 'lp', 300, 0.7)); };
  const rl = mkR(), rr = mkR();
  const hl = norm(filt(noise(n, R), 'bp', 3800, 0.8)), hr = norm(filt(noise(n, R), 'bp', 3600, 0.8));
  for (let i = 0; i < n; i++) { const t = i / SR, fl = 0.8 + 0.2 * Math.sin(TAU * 0.9 * t); L[i] = rl[i] * 0.35 * fl + hl[i] * 0.04; Rr[i] = rr[i] * 0.35 * fl + hr[i] * 0.04; }
  let t = 0.02;
  while (t < dur - 0.12) { addPan(L, Rr, bubble(130 + R() * 380, 0.025 + R() * 0.05, 0.75, 0.35), secs(t), 0.25 + 0.45 * R(), (R() - 0.5) * 1.1); t += -Math.log(1 - R() * 0.99) / 55; }
  t = 0.05;
  while (t < dur - 0.25) {
    addPan(L, Rr, bubble(80 + R() * 70, 0.09 + R() * 0.06, 0.5, 0.4), secs(t), 0.7 + 0.3 * R(), (R() - 0.5) * 0.8);
    addPan(L, Rr, burst(R, 0.04, 'bp', 900 + R() * 900, 1.2, 0.008), secs(t + 0.08), 0.35, (R() - 0.5) * 0.8);
    t += -Math.log(1 - R() * 0.99) / 6;
  }
  norm2(L, Rr);
  for (let i = 0; i < n; i++) { const tt = i / SR, e = smooth(tt / 0.3) * smooth((dur - tt) / 0.4); L[i] *= e; Rr[i] *= e; }
  return [L, Rr];
}

/* something dropped into liquid: impact, rising cavity "bloop", thump, spray, droplets.
 * size scales weight; slow > 1 = slow-motion (longer, deeper, more droplets) */
function plunge(R, o = {}) {
  const sz = o.size ?? 1, slow = o.slow ?? 1;
  const n = secs(1.2 * slow), y = new Float32Array(n);
  addInto(y, burst(R, 0.06 * slow, 'lp', 3500 / slow, 0.7, 0.012 * slow, 0.001), 0, 0.7);
  addInto(y, bubble((260 / sz) / slow, 0.11 * slow * sz, 1.4, 0.4), secs(0.015 * slow), 0.9);
  addInto(y, plop(R, 180 / sz, 70, 0.2 * slow, 0.2), 0, 0.5 * sz);
  addInto(y, norm(burst(R, 0.35 * slow, 'bp', 2400 / Math.sqrt(slow), 0.7, 0.07 * slow, 0.01)), secs(0.01), 0.45);
  const cnt = Math.round(6 * sz * slow);
  for (let k = 0; k < cnt; k++) addInto(y, bubble((900 + R() * 1600) / Math.sqrt(slow), 0.025 + R() * 0.03, 1.1, 0.3), secs((0.12 + R() * 0.45) * slow), 0.2 * R());
  for (let i = 0; i < n; i++) y[i] = Math.tanh(1.2 * y[i]);
  return fadeEdges(norm(y), 0.001, 0.05);
}

/* bruised lemongrass stalks: woody thunk on the rim + splash */
function lemongrassDrop(R) {
  const n = secs(1.3), y = new Float32Array(n);
  addInto(y, modal([[190, 0.06, 1], [470, 0.04, 0.6], [1150, 0.02, 0.35], [2400, 0.01, 0.2]], 0.3, 0.0006), 0, 0.8);
  addInto(y, norm(crackle(R, 0.05, (t) => 1500 * Math.exp(-t / 0.015), () => 1, 1500, 6000)), 0, 0.35);
  addInto(y, plunge(R, { size: 1.15 }), secs(0.05), 0.8);
  return fadeEdges(norm(y), 0.0005, 0.04);
}

/* fish bones / bits rattling in a bamboo basket */
function rattle(R, dur) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  for (let t = 0.01; t < dur - 0.06; t += (1 / 7) * (0.85 + 0.3 * R())) {
    const a = Math.pow(Math.sin(Math.PI * t / dur), 0.5);
    for (let k = 0; k < 8; k++) addPan(L, Rr, modal([[1800 + R() * 3500, 0.004 + R() * 0.008, 1]], 0.04), secs(t + R() * 0.05), a * (0.3 + 0.7 * R()), (R() - 0.5) * 0.8);
    addPan(L, Rr, burst(R, 0.08, 'bp', 2600, 0.8, 0.02, 0.008), secs(t), a * 0.8, 0);
  }
  return fade2(norm2(L, Rr), 0.004, 0.02);
}

/* aromatics hit hot oil: an instant loud burst that settles into a steady fry (stereo) */
function sizzleBurst(R, dur) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const hl = filt(noise(n, R), 'hp', 3800, 0.7), hr = filt(noise(n, R), 'hp', 3800, 0.7);
  const bl = filt(noise(n, R), 'bp', 2600, 0.5), br = filt(noise(n, R), 'bp', 2400, 0.5);
  const fl = flutter(R, n, 14);
  const rate = (t) => 110 + 900 * Math.exp(-t / 0.3), amp = (t) => 0.6 + 0.6 * Math.exp(-t / 0.4);
  const cl = norm(crackle(R, dur, rate, amp, 2200, 9000)), cr = norm(crackle(R, dur, rate, amp, 2200, 9000));
  for (let i = 0; i < n; i++) {
    const t = i / SR, e = smooth(t / 0.006) * smooth((dur - t) / 0.3), f = 0.6 + 0.4 * fl[i];
    const hs = 0.18 * f * (1 + 1.6 * Math.exp(-t / 0.45)), bs = 0.5 * Math.exp(-t / 0.22);
    L[i] = (hl[i] * hs + bl[i] * bs + cl[i] * 0.45) * e; Rr[i] = (hr[i] * hs + br[i] * bs + cr[i] * 0.45) * e;
  }
  let t = 0.3;
  while (t < dur - 0.1) { addPan(L, Rr, burst(R, 0.012, 'bp', 1500 + R() * 3000, 1.2, 0.0015 + R() * 0.002), secs(t), 0.5 + 0.5 * R(), (R() - 0.5) * 1.2); t += 0.12 + R() * 0.35; }
  return fade2(norm2(L, Rr), 0.001, 0.05);
}

/* wok spatula scrape: metal clank + gritty scrape through frying aromatics */
function spatula(R, dur = 0.32) {
  const n = secs(dur + 0.2), y = new Float32Array(n);
  addInto(y, modal([[520, 0.06, 1], [1310, 0.04, 0.6], [2650, 0.025, 0.4], [4100, 0.015, 0.25]], 0.25), 0, 0.5);
  addInto(y, metalScrape(R, dur), secs(0.01), 0.55);
  addInto(y, norm(crackle(R, dur, (t) => 500 * Math.sin(Math.PI * clamp(t / dur, 0, 1)) + 20, () => 1, 1500, 7000)), secs(0.01), 0.45);
  const gr = filt(noise(secs(dur), R), 'bp', 1800, 0.9);
  for (let i = 0; i < gr.length; i++) gr[i] *= Math.pow(Math.sin(Math.PI * i / gr.length), 0.7) * 0.25;
  addInto(y, gr, secs(0.01), 1);
  return fadeEdges(norm(y), 0.0008, 0.03);
}

/* hot aromatics tipped into broth: hiss burst, heavy bubbling, wet whump (stereo) */
function hissInto(R, dur = 1.4) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const hl = filt(noise(n, R), 'hp', 2600, 0.7), hr = filt(noise(n, R), 'hp', 2600, 0.7);
  for (let i = 0; i < n; i++) { const t = i / SR, e = smooth(t / 0.03) * (0.25 + 0.75 * Math.exp(-t / 0.35)) * smooth((dur - t) / 0.3) * 0.35; L[i] += hl[i] * e; Rr[i] += hr[i] * e; }
  addPan(L, Rr, plunge(R, { size: 1.3 }), 0, 0.7, 0);
  let t = 0.05;
  while (t < dur - 0.1) { addPan(L, Rr, bubble(160 + R() * 600, 0.02 + R() * 0.05, 0.8, 0.35), secs(t), (0.3 + 0.5 * R()) * Math.exp(-t / 0.6), (R() - 0.5) * 1.0); t += -Math.log(1 - R() * 0.99) / 60; }
  return fade2(norm2(L, Rr), 0.002, 0.05);
}

/* cleaver through crackling roast pork: crisp "rộp" crunch + crack + board thud */
function chop(R) {
  const n = secs(0.45), y = new Float32Array(n);
  addInto(y, norm(crackle(R, 0.07, (t) => 2600 * Math.exp(-t / 0.02), (t) => Math.exp(-t / 0.025), 1500, 8000)), 0, 0.9);
  addInto(y, norm(burst(R, 0.02, 'bp', 2200, 0.9, 0.004)), 0, 0.7);
  const tb = secs(0.018);
  addInto(y, modal([[115, 0.06, 1], [240, 0.04, 0.6], [520, 0.02, 0.3]], 0.3, 0.0008), tb, 0.9);
  addInto(y, norm(burst(R, 0.05, 'lp', 1200, 0.7, 0.01)), tb, 0.4);
  addInto(y, modal([[2650, 0.02, 1], [4100, 0.012, 0.5]], 0.08), tb, 0.12);
  addInto(y, norm(burst(R, 0.08, 'bp', 900, 1.2, 0.02, 0.004)), secs(0.005), 0.25);
  return fadeEdges(norm(y), 0.0005, 0.03);
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

/* crisp snap of a water-lily stem (bông súng): crack + juicy tear */
function snap(R) {
  const n = secs(0.3), y = new Float32Array(n);
  addInto(y, burst(R, 0.008, 'hp', 2500, 0.7, 0.0012), 0, 1);
  addInto(y, modal([[1650, 0.018, 1], [2950, 0.012, 0.7], [4800, 0.008, 0.5], [820, 0.02, 0.4]], 0.1), 0, 0.7);
  addInto(y, norm(crackle(R, 0.04, (t) => 1500 * Math.exp(-t / 0.01), () => 1, 2000, 9000)), secs(0.002), 0.5);
  addInto(y, norm(burst(R, 0.08, 'bp', 2800, 1.0, 0.02, 0.003)), secs(0.004), 0.35);
  return fadeEdges(norm(y), 0.0003, 0.02);
}

/* water trickling / dripping off noodles lifted in a bamboo ladle (stereo) */
function trickle(R, dur) {
  const n = secs(dur + 0.1), L = new Float32Array(n), Rr = new Float32Array(n);
  const env = (t) => smooth(t / 0.05) * Math.exp(-t / (dur * 0.55)) * smooth((dur + 0.08 - t) / 0.1);
  const st = filt(noise(n, R), 'bp', 1900, 3), fl = flutter(R, n, 30);
  for (let i = 0; i < n; i++) { const v = st[i] * env(i / SR) * (0.4 + 0.6 * fl[i]) * 0.6; L[i] += v; Rr[i] += v; }
  let t = 0.02;
  while (t < dur) { addPan(L, Rr, bubble(700 + R() * 1300, 0.02 + R() * 0.03, 1.2, 0.3), secs(t), (0.3 + 0.7 * R()) * env(t), (R() - 0.5) * 0.7); t += 1 / (40 * env(t) + 4); }
  return fade2(norm2(L, Rr), 0.004, 0.02);
}

/* ceramic bowl tap (optionally with a soft food-placement thud) */
function ceramic(R, f = 1650, thud = 0) {
  const y = modal([[f, 0.22, 1], [f * 2.71, 0.11, 0.5], [f * 5.02, 0.05, 0.3], [f * 0.56, 0.06, 0.2]], 0.7);
  addInto(y, burst(R, 0.006, 'hp', 2500, 0.7, 0.0008), 0, 0.4);
  if (thud) addInto(y, plop(R, 200, 90, 0.14, 0.5), 0, thud);
  return fadeEdges(norm(y), 0.0002, 0.05);
}

/* chili slices sprinkled onto broth: little plinks on the surface */
function sprinkle(R, dur = 0.45) {
  const n = secs(dur + 0.1), y = new Float32Array(n);
  for (let k = 0; k < 16; k++) {
    const t = Math.pow(R(), 1.3) * dur;
    addInto(y, bubble(1300 + R() * 1700, 0.012 + R() * 0.01, 1.0, 0.3), secs(t), 0.5 * (0.4 + 0.6 * R()));
    addInto(y, burst(R, 0.004, 'bp', 4500, 1.2, 0.0006), secs(t), 0.06 * R());
  }
  return fadeEdges(norm(y), 0.001, 0.02);
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

/* sad-trombone-ish "wah-wah" on the đàn bầu, through a plunger-like resonant low-pass */
function wahWah() {
  const notes = [[0, 69, 0.3, { bendFrom: 0.7, bendTime: 0.12, endBend: -0.6, endBendTime: 0.12 }],
    [0.36, 67, 0.95, { bendFrom: 0.7, bendTime: 0.15, endBend: -1.6, endBendTime: 0.6, vibRate: 6.5, vibDepth: 0.55 }]];
  const n = secs(1.6), y = new Float32Array(n);
  for (const [t0, m, d, o] of notes) addInto(y, danBau(m, d, { attack: 0.03, release: 0.12, bright: 1.6, ...o }), secs(t0), 1);
  const open = (t) => { let v = 0; for (const [t0, , d] of notes) { const u = t - t0; if (u >= 0) v = Math.max(v, smooth(u / 0.07) * (u < d ? 1 - 0.65 * smooth((u - 0.1) / (d * 0.9)) : 0.35 * Math.exp(-(u - d) / 0.1))); } return v; };
  return fadeEdges(norm(filt(y, 'lp', (t) => 380 + 2300 * open(t), 3.0)), 0.003, 0.05);
}

/* fish leaps out and drops back in with a musically pitched "bloop" (bloop at +0.25 s) */
function fishJump(R, midi) {
  const n = secs(1.1), y = new Float32Array(n), f = m2f(midi);
  addInto(y, norm(burst(R, 0.15, 'bp', 2600, 0.8, 0.035, 0.003)), 0, 0.35);
  for (let k = 0; k < 4; k++) addInto(y, bubble(1500 + R() * 1500, 0.02, 1.0, 0.3), secs(0.04 + R() * 0.15), 0.1 * R());
  const m = secs(0.5), b = new Float32Array(m); let ph = 0;
  for (let i = 0; i < m; i++) { const t = i / SR; ph += f * (1 + 0.04 * (1 - Math.exp(-t / 0.03))) / SR; b[i] = (Math.sin(TAU * ph) + 0.18 * Math.sin(2 * TAU * ph)) * smooth(t / 0.002) * Math.exp(-t / 0.12); }
  addInto(y, b, secs(0.25), 0.9);
  addInto(y, norm(burst(R, 0.12, 'lp', 3000, 0.7, 0.03, 0.002)), secs(0.25), 0.35);
  for (let k = 0; k < 6; k++) addInto(y, bubble(1000 + R() * 1400, 0.025, 1.1, 0.3), secs(0.32 + R() * 0.3), 0.12 * R());
  return fadeEdges(norm(y), 0.001, 0.05);
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
// D F G A C — "oán" colour centred on D (minor, bends), "bắc" colour centred on F (major, bright)
const SCALE = [50, 53, 55, 57, 60, 62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89];
const fifthOf = (m) => ([0, 2, 5, 7, 9].includes((m + 7) % 12) ? m + 7 : m + 5);
const pumpAt = (tAbs, depth = 0.3) => {
  const tb = ((tAbs % BEAT) + BEAT) % BEAT;
  const d = tb < 0.008 ? smooth(tb / 0.008) : Math.exp(-(tb - 0.008) / 0.11);
  return 1 - depth * d;
};
function lead(t, midi, dur, o = {}) {   // đàn bầu
  put(MUSIC, t, danBau(midi, dur, o), { gain: o.gain ?? 0.15, pan: o.pan ?? 0.12, rev: o.rev ?? 0.42 });
}
function kimN(t, midi, dur, o = {}) {  // đàn kìm (lead, left of centre)
  put(MUSIC, t, kim(midi, dur, { seed: 'k' + t.toFixed(3), ...o }), { gain: o.gain ?? 0.12, pan: o.pan ?? -0.22, rev: o.rev ?? 0.36 });
}
const kimP = (list, o = {}) => list.forEach(([t, m, d, ex]) => kimN(t, m, d, { ...o, ...(ex || {}) }));
function tranhNote(t, midi, dur, gain, pan, seed, rev = 0.45) {
  put(MUSIC, t, tranh(midi, dur, rngFor('tr' + seed + t), {}), { gain, pan, rev });
}
function tranhBend(t, midi, dur, o = {}) {  // đàn tranh with a pressed (nhấn) bend
  put(MUSIC, t, kim(midi, dur, { tranh: true, seed: 'tb' + t, ...o }), { gain: o.gain ?? 0.06, pan: o.pan ?? 0.35, rev: o.rev ?? 0.45 });
}
function sparrowAt(t, gain, pan, seed) {
  put(AMB, t, sparrow(rngFor('sp' + seed)), { gain, pan, rev: 0.2, hall: 0.35 });
}
const V = { Dm: [50, 57, 62, 65, 69], Bb: [46, 53, 58, 62, 65], C: [48, 55, 60, 62, 67], F: [53, 60, 65, 69, 72] };
const ROOT = { Dm: 38, Bb: 34, C: 36, F: 41 };
const K = kick({ decay: 0.22, click: 0.25 }), KG = kick({ decay: 0.16, seed: 'g', click: 0.15 }), KD = kick({ decay: 0.3, fEnd: 42, seed: 'd' });
const MO_HI = mo(rngFor('moH'), 900), MO_LO = mo(rngFor('moL'), 640);
const shk = (t, acc, gain) => put(MUSIC, t, shaker(rngFor('sh' + t.toFixed(3)), acc), { gain, pan: -0.35, rev: 0.08 });
const cutTing = (t, midi, pan) => put(MUSIC, t, ting(m2f(midi), 0.6), { gain: 0.032, pan, rev: 0.6 });

// ---------- ACT 1 : the river wakes (0–10) ----------
{
  // river bed 0 → 46.6 on the ambience bus (does not key the music duck)
  const riv = riverAmb(rngFor('river1'), 46.6);
  const rEnv = (t) => pw([[0, 0], [1.0, 0.6], [2.4, 1.0], [9.6, 1.0], [10.4, 0.5], [40.0, 0.5], [40.4, 0.62], [45.6, 0.55], [46.5, 0.0]], t);
  mulEnv(riv[0], rEnv); mulEnv(riv[1], rEnv);
  put2(AMB, 0.0, riv, { gain: 0.2, rev: 0.05, hall: 0.08 });
  // far "tắc ráng" engine drifting slowly L → R
  const eng = mulEnv(boatEngine(rngFor('engine1'), 9.8), (t) => pw([[0, 0], [1.2, 0.7], [4.0, 1.0], [7.5, 0.7], [9.8, 0]], t));
  put(AMB, 0.0, eng, { gain: 0.1, pan: (t) => -0.75 + 1.4 * t / 9.8, rev: 0.1, hall: 0.45 });
  // birds at dawn
  const R = rngFor('birds1');
  [[0.35, -0.6], [0.9, 0.5], [1.5, -0.25], [2.05, 0.7], [2.7, -0.7], [4.7, 0.75], [6.0, -0.6], [9.7, -0.5]].forEach(([t, p], k) =>
    sparrowAt(t, (t < 3 ? 0.06 : 0.04) * (0.7 + 0.3 * R()), p, 'a' + k));
  put(AMB, 1.4, coucal(rngFor('coucal1'), 6), { gain: 0.06, pan: 0.65, rev: 0.2, hall: 0.6 });
  put(AMB, 0.7, rooster(rngFor('rooster')), { gain: 0.03, pan: -0.7, rev: 0.4, hall: 0.7 });
  put2(SFX, 1.95, shimmer(rngFor('flare'), 1.4), { gain: 0.1, hall: 0.5 });   // lens shimmer ~2.2

  // 3–5.5 floating market: hull creaks, water slaps, oar strokes 3.4 / 4.4 / 5.2
  const hullCreak = (seed, d) => creak(rngFor(seed), d, { rate: (u) => 22 + 60 * Math.sin(Math.PI * u), modes: [[260, 6, 1], [610, 7, 0.7], [1320, 8, 0.4]], scrape: 0.03, scrapeF: 900 });
  put(SFX, 3.0, hullCreak('hull1', 1.1), { gain: 0.2, pan: -0.45, rev: 0.25, hall: 0.1 });
  put(SFX, 4.55, hullCreak('hull2', 0.9), { gain: 0.16, pan: 0.5, rev: 0.25, hall: 0.1 });
  [[3.15, -0.3], [3.9, 0.4], [4.75, -0.1], [5.35, 0.3]].forEach(([t, p], k) => put(SFX, t, hullSlap(rngFor('slap' + k), 1 + 0.15 * k), { gain: 0.25, pan: p, rev: 0.2, hall: 0.08 }));
  [3.4, 4.4, 5.2].forEach((t, k) => put(SFX, t, oarStroke(rngFor('oar' + k)), { gain: 0.45, pan: [0.25, -0.2, 0.15][k], rev: 0.2, hall: 0.1 }));

  // 5.5–8 tourist's rowboat drifts in; comic wobbles 6.3 / 7.0; kingfisher 7.4
  put(SFX, 5.6, slosh(rngFor('drift'), 0.6), { gain: 0.2, pan: 0.2, rev: 0.2 });
  const comicCreak = (seed, d) => creak(rngFor(seed), d, { rate: (u) => 40 + 260 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 1.5), modes: [[480, 9, 1], [1090, 10, 0.7], [2250, 11, 0.35]], scrape: 0.02 });
  put(SFX, 6.25, comicCreak('wob1', 0.42), { gain: 0.38, pan: 0.15, rev: 0.25 });
  put(SFX, 6.3, slosh(rngFor('sl1'), 0.55), { gain: 0.36, pan: (t) => -0.3 + t, rev: 0.2 });
  put(SFX, 6.95, comicCreak('wob2', 0.5), { gain: 0.4, pan: -0.15, rev: 0.25 });
  put(SFX, 7.0, slosh(rngFor('sl2'), 0.6), { gain: 0.38, pan: (t) => 0.3 - t, rev: 0.2 });
  put(SFX, 7.18, whoosh(rngFor('kfwhoosh'), 0.45, 700, 3200, 1400, 0.5, 1.2), { gain: 0.16, pan: (t) => 0.9 - 3 * t, rev: 0.1, hall: 0.15 });
  put(SFX, 7.22, wings(rngFor('kfw'), 0.3, 18), { gain: 0.12, pan: 0.4, rev: 0.1 });
  put(SFX, 7.4, kingfisher(rngFor('kf')), { gain: 0.13, pan: 0.5, rev: 0.2, hall: 0.3 });

  // 8–10 sniffs, curious "hm?", whip-pan
  put(SFX, 8.5, sniff(rngFor('sn1'), 0.16), { gain: 0.42, pan: 0.1, rev: 0.12 });
  put(SFX, 8.9, sniff(rngFor('sn2'), 0.2, { rise: 1.35 }), { gain: 0.48, pan: 0.1, rev: 0.12 });
  put(SFX, 9.0, whoosh(rngFor('whip'), 0.32, 500, 5200, 1500, 0.55, 0.9), { gain: 0.36, pan: (t) => -0.9 + 5.6 * t, rev: 0.05, hall: 0.1 });

  // MUSIC: pad swells from silence, D drone, slow đàn kìm phrase, market arps, playful bobbing
  put(MUSIC, 0.0, drone(10.0, { attack: 3.0, release: 0.3 }), { gain: 0.075, rev: 0.15 });
  put2(MUSIC, 0.0, pad(V.Dm, 3.05, { attack: 2.6, release: 0.5, cutoff: 900 }), { gain: 0.085, rev: 0.38 });
  put2(MUSIC, 3.0, pad(V.F, 2.55, { attack: 0.5, release: 0.4, cutoff: 1300 }), { gain: 0.075, rev: 0.38 });
  put2(MUSIC, 5.5, pad(V.C, 2.55, { attack: 0.4, release: 0.4, cutoff: 1300 }), { gain: 0.07, rev: 0.38 });
  put2(MUSIC, 8.0, pad([46, 53, 58, 60, 65], 2.0, { attack: 0.6, release: 0.05, cutoff: 1100, env: (t) => 0.8 + 0.4 * smooth((t - 1.0) / 0.95) }), { gain: 0.075, rev: 0.38 });
  kimP([
    [0.8, 69, 0.55, { bendFrom: -2, bendTime: 0.25 }], [1.35, 72, 0.4], [1.75, 74, 1.2, { trem: 12, vib: 0.22, release: 0.25 }],
    [3.0, 77, 0.45, { bendFrom: -2 }], [3.5, 74, 0.22], [3.75, 72, 0.22], [4.0, 74, 1.4, { trem: 13, vib: 0.25, nhan: 1.5, nhanAt: 0.5, nhanLen: 0.3, release: 0.2 }],
  ], { gain: 0.1, rev: 0.45 });
  [62, 65, 69, 72, 74, 72, 69, 65].forEach((m, k) => tranhNote(0.6 + k * 0.3, m, 1.4, 0.032, 0.45 - 0.1 * k, 'arp' + k, 0.5));
  [65, 69, 72, 77, 81, 77, 72, 69, 65, 69].forEach((m, k) => tranhNote(3.0 + k * 0.25, m, 1.0, 0.032, 0.5, 'mk' + k, 0.45));
  [[5.5, 55], [5.75, 67], [6.0, 60], [6.25, 67], [6.5, 55], [6.75, 67], [7.0, 60], [7.25, 67], [7.5, 55], [7.75, 67]].forEach(([t, m], k) => tranhNote(t, m, 0.4, 0.04, 0.4, 'bob' + k, 0.3));
  kimP([[5.5, 72, 0.2], [5.75, 74, 0.2], [6.0, 79, 0.4, { bendFrom: -2 }], [6.5, 77, 0.2], [6.75, 74, 0.2], [7.0, 72, 0.35, { endBend: -1.5, endBendTime: 0.2 }],
    [7.5, 74, 0.2], [7.75, 79, 0.45, { nhan: 2, nhanAt: 0.2 }]], { gain: 0.09 });
  tranhBend(9.05, 69, 0.42, { endBend: 3, endBendTime: 0.22, gain: 0.075, pan: 0.2 });   // "hm?"
  // swell into the title
  put(MUSIC, 9.0, riser(rngFor('riser1'), 1.0, 260, 7000), { gain: 0.14, pan: (t) => 0.3 * Math.sin(TAU * 0.8 * t), rev: 0.3 });
  put2(MUSIC, 9.4, reverseCrash(rngFor('rc1'), 0.6), { gain: 0.12, rev: 0.2 });
  [74, 77, 79, 81, 84].forEach((m, k) => kimN(9.72 + k * 0.056, m, 0.1, { gain: 0.08 + 0.008 * k, release: 0.05 }));

  // TITLE HIT 10.0: boom + shimmer + crash + đàn kìm tremolo flourish + đàn tranh roll
  put(MUSIC, 10.0, bigBoom(rngFor('boom10'), 2.2), { gain: 0.55, rev: 0.15 });
  put2(MUSIC, 10.0, crash(rngFor('c10'), 2.4), { gain: 0.1, rev: 0.4 });
  put2(MUSIC, 10.0, shimmer(rngFor('flare10'), 1.6), { gain: 0.1, rev: 0.6 });
  put2(MUSIC, 10.0, pad([50, 57, 62, 65, 69, 74], 1.9, { attack: 0.03, release: 0.3, cutoff: 2600, detune: 9 }), { gain: 0.1, rev: 0.45 });
  [50, 57, 62, 65, 69, 74, 81].forEach((m, k) => tranhNote(10.0 + k * 0.035, m, 1.8, 0.045, -0.6 + k * 0.2, 'title' + k, 0.55));
  kimP([[10.0, 86, 0.9, { trem: 15, vib: 0.3, gain: 0.13 }], [10.95, 84, 0.2], [11.15, 81, 0.2], [11.35, 79, 0.15], [11.5, 81, 0.45, { nhan: 2, nhanAt: 0.15, nhanLen: 0.2 }]], { rev: 0.5 });
}

// ---------- ACT 2 : cooking on the boat (10–40) ----------
{
  const harm = [[10, 'Dm', 2], [12, 'Bb', 2], [14, 'C', 2], [16, 'Dm', 2], [18, 'F', 2], [20, 'Bb', 2], [22, 'C', 2], [24, 'Dm', 2], [26, 'Bb', 2],
    [28, 'F', 2], [30, 'C', 2], [32, 'Dm', 2], [34, 'Bb', 1], [35, 'C', 1], [36, 'Dm', 1], [37, 'Bb', 1], [38, 'F', 1], [39, 'C', 1]];
  const airy = (T) => T >= 28 && T < 32;
  harm.forEach(([T, ch, d]) => {
    if (T === 10) return;   // title pad covers 10–12
    const cut = airy(T) ? 3000 : T >= 34 ? 2200 + 400 * (T - 34) : 1500;
    const gn = airy(T) ? 0.06 : T >= 36 ? 0.085 : T >= 34 ? 0.075 : 0.065;
    put2(MUSIC, T, pad(V[ch], d - 0.03, { attack: airy(T) ? 0.5 : 0.08, release: 0.15, cutoff: cut, pump: airy(T) ? null : (t) => pumpAt(T + t, 0.28) }), { gain: gn, rev: airy(T) ? 0.5 : 0.3 });
  });
  // airy strings 28–31.5, hero strings 36.5–40
  put2(MUSIC, 28.0, pad([65, 69, 72, 77], 3.4, { attack: 1.2, release: 0.4, cutoff: 4200, tab: TAB_STR, vib: 12, detune: 9, seed: 'airy' }), { gain: 0.045, rev: 0.55 });
  put2(MUSIC, 36.0, pad([62, 69, 74, 77, 81], 4.0, { attack: 2.6, release: 0.1, cutoff: 4500, tab: TAB_STR, vib: 13, detune: 9, seed: 'hero' }), { gain: 0.055, rev: 0.5 });

  // drums
  const grooveA = (t0, t1, kg = 0.36) => {
    for (let t = t0; t < t1 - 1e-6; t += BAR) {
      put(MUSIC, t, K, { gain: kg, rev: 0.03 });
      put(MUSIC, t + 1.0, K, { gain: kg * 0.9, rev: 0.03 });
      put(MUSIC, t + 0.75, KG, { gain: 0.11, rev: 0.03 });
      put(MUSIC, t + 0.5, MO_HI, { gain: 0.1, pan: 0.25, rev: 0.3 });
      put(MUSIC, t + 1.5, MO_LO, { gain: 0.11, pan: 0.25, rev: 0.3 });
      put(MUSIC, t + 1.75, MO_HI, { gain: 0.045, pan: 0.3, rev: 0.3 });
    }
  };
  grooveA(10.0, 28.0); grooveA(32.0, 36.0);
  put(MUSIC, 31.0, K, { gain: 0.3, rev: 0.03 }); put(MUSIC, 31.5, MO_LO, { gain: 0.09, pan: 0.25, rev: 0.3 });
  [28.0, 30.0].forEach((t) => put(MUSIC, t, K, { gain: 0.24, rev: 0.03 }));   // airy: downbeats only
  [29.0, 31.0 - 0.5].forEach((t) => put(MUSIC, t, MO_HI, { gain: 0.06, pan: 0.3, rev: 0.4 }));
  for (let t = 35.0; t < 36.0 - 1e-6; t += 0.5) if (t % 1 !== 0) put(MUSIC, t, K, { gain: 0.25, rev: 0.03 });
  // hero 36–40: four-on-floor, claps on 2 & 4, mõ off-beats, toms into 40
  for (let t = 36.0; t < 40.0 - 1e-6; t += BEAT) put(MUSIC, t, K, { gain: 0.4, rev: 0.03 });
  for (let t = 36.5; t < 39.5 - 1e-6; t += 1.0) put(MUSIC, t, clap(rngFor('clp' + t)), { gain: 0.1, rev: 0.25 });
  for (let t = 36.0; t < 39.5 - 1e-6; t += BEAT) put(MUSIC, t + 0.25, MO_HI, { gain: 0.075, pan: 0.25, rev: 0.3 });
  [[39.5, 147], [39.625, 123], [39.75, 98], [39.875, 82]].forEach(([t, f]) => put(MUSIC, t, tom(f, 0.25), { gain: 0.15 + (t - 39.5) * 0.2, pan: 0.4 - (t - 39.5) * 2, rev: 0.25 }));
  put(MUSIC, 34.5, riser(rngFor('riser345'), 2.0, 300, 7000), { gain: 0.07, rev: 0.3 });
  put(MUSIC, 38.0, riser(rngFor('riser38'), 2.0, 300, 9000), { gain: 0.12, rev: 0.3 });
  put2(MUSIC, 39.0, reverseCrash(rngFor('rc39'), 1.0), { gain: 0.1, rev: 0.25 });
  put2(MUSIC, 36.0, crash(rngFor('c36'), 1.6), { gain: 0.05, rev: 0.3 });
  // shaker
  for (let t = 10.5; t < 28.0 - 1e-6; t += 0.125) { const k = Math.round((t - 10) / 0.125) % 4; shk(t, k === 2, k === 2 ? 0.045 : k === 0 ? 0.032 : 0.022); }
  for (let t = 28.0; t < 31.0 - 1e-6; t += 0.25) shk(t, false, 0.018);
  for (let t = 31.0; t < 36.0 - 1e-6; t += 0.125) { const k = Math.round((t - 31) / 0.125) % 4; shk(t, k === 2, k === 2 ? 0.045 : k === 0 ? 0.032 : 0.022); }
  for (let t = 36.0; t < 40.0 - 1e-6; t += 0.125) { const k = Math.round((t - 36) / 0.125) % 2; shk(t, k === 1, k ? 0.05 : 0.03); }

  // bass
  const pat = [[0, 0, 0.4], [0.75, 0, 0.2], [1.0, 'f', 0.4], [1.5, 12, 0.2], [1.75, 'f', 0.2]];
  harm.forEach(([T, ch, d]) => {
    const root = ROOT[ch];
    if (airy(T)) { put(MUSIC, T, bassNote(root, 1.85), { gain: 0.17 }); return; }
    if (T >= 34) { for (let t = T; t < T + d - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - T) / 0.25) % 2 ? root + 12 : root, 0.2), { gain: T >= 36 ? 0.27 : 0.23 }); return; }
    for (const [off, iv, dd] of pat) { if (off >= d) continue; put(MUSIC, T + off, bassNote(iv === 'f' ? fifthOf(root) : root + iv, dd), { gain: 0.23 }); }
  });

  // đàn tranh background motif: 8ths (16ths in the hero), quieter under the chopping & plating; airy high arps 28–32
  const patIdx = [0, 2, 4, 2, 5, 4, 2, 3];
  harm.forEach(([T, ch, d]) => {
    if (T < 12) return;
    if (airy(T)) { [1, 2, 3, 4, 3, 2, 1, 2].forEach((ix, k) => tranhNote(T + k * 0.25, V[ch][ix] + 12, 0.9, 0.028, k % 2 ? 0.5 : 0.2, 'air' + T + k, 0.6)); return; }
    let base = SCALE.findIndex((m) => m % 12 === ROOT[ch] % 12 && m >= 57);
    if (base < 0) base = SCALE.findIndex((m) => m % 12 === (ROOT[ch] + 4) % 12 && m >= 57);
    const step = T >= 36 ? 0.125 : 0.25, gn = (T >= 22 && T < 28) ? 0.032 : 0.042;
    for (let k = 0; k * step < d - 1e-6; k++) {
      const pi = patIdx[k % 8] + (T >= 36 && k >= 4 ? 1 : 0);
      tranhNote(T + k * step, SCALE[Math.min(SCALE.length - 1, base + pi)], 0.6, gn, 0.5, 'os' + T + k, 0.35);
    }
  });

  // đàn kìm lead phrases (oán ornaments) + đàn bầu answers
  kimP([
    // 14–18 C → Dm
    [14.0, 72, 0.45, { bendFrom: -2 }], [14.5, 74, 0.22], [14.75, 77, 0.22], [15.0, 79, 0.45, { nhan: 2, nhanAt: 0.2, nhanLen: 0.25 }], [15.5, 77, 0.22], [15.75, 74, 0.22],
    [16.0, 74, 1.4, { trem: 14, vib: 0.25, endBend: -2, endBendTime: 0.3 }], [17.5, 72, 0.22], [17.75, 69, 0.22],
    // 18–20 F (bắc, bright)
    [18.0, 77, 0.22], [18.25, 79, 0.22], [18.5, 81, 0.45, { bendFrom: -2 }], [19.0, 79, 0.22], [19.25, 77, 0.22], [19.5, 74, 0.45, { nhan: 1.5, nhanAt: 0.3 }],
    // 22–24.5 chopping: off-beat stabs between the chops
    [22.25, 72, 0.15], [22.75, 74, 0.15], [23.25, 77, 0.15], [23.75, 79, 0.15], [24.25, 81, 0.6, { trem: 14 }],
    // 31–34 noodles
    [31.0, 74, 0.45, { bendFrom: -2 }], [31.5, 72, 0.22], [31.75, 69, 0.22], [32.0, 67, 0.45, { nhan: 2, nhanAt: 0.3 }], [32.5, 69, 0.4], [33.0, 72, 0.9, { trem: 13, vib: 0.2 }],
    // 34–36.5 build
    [34.0, 65, 0.22], [34.25, 67, 0.22], [34.5, 69, 0.22], [34.75, 72, 0.22], [35.0, 74, 0.45, { bendFrom: -2 }], [35.5, 72, 0.22], [35.75, 74, 0.22], [36.0, 77, 0.45, { bendFrom: -1 }],
    // 37–40 hero counter-line (tremolo)
    [37.0, 74, 0.95, { trem: 14, gain: 0.09 }], [38.0, 77, 0.95, { trem: 14, gain: 0.09 }], [39.0, 79, 0.45, { trem: 15, gain: 0.09 }], [39.5, 81, 0.22], [39.75, 84, 0.22],
  ]);
  [[12.0, 65, 0.45, -2], [12.5, 67, 0.45, 0], [13.0, 69, 0.9, -1, { vibDepth: 0.35 }],
    [20.0, 74, 0.45, -2], [20.5, 72, 0.45, 0], [21.0, 69, 0.95, 2, { vibDepth: 0.35, bendTime: 0.3 }],
    [26.5, 74, 0.9, -2, { vibDepth: 0.35 }],
    [28.0, 81, 1.4, -3, { vibDepth: 0.35, bendTime: 0.3 }], [29.5, 79, 0.45, 0], [30.0, 77, 0.9, -2, { vibDepth: 0.35 }],
    [36.5, 81, 0.45, -2], [37.0, 84, 0.95, -3, { vibDepth: 0.42, bendTime: 0.25 }], [38.0, 86, 0.95, -2, { vibDepth: 0.42 }], [39.0, 84, 0.45, -2], [39.5, 86, 0.45, 0]]
    .forEach(([t, m, d, bf, ex]) => lead(t, m, d, { bendFrom: bf, gain: t >= 36 ? 0.18 : 0.15, ...(ex || {}) }));
  // ingredient pluck accents 25 / 26 / 27
  [[25.0, 81], [26.0, 84], [27.0, 86]].forEach(([t, m], k) => { tranhNote(t, m, 0.9, 0.06, 0.3 - 0.3 * k, 'ing' + k, 0.5); kimN(t, m - 12, 0.3, { gain: 0.07, pan: -0.3 + 0.3 * k }); });
  // shot-cut tings
  [[13.0, 93], [16.0, 96], [19.0, 98], [22.0, 101], [24.5, 98], [27.5, 105], [31.0, 96], [33.5, 98], [36.5, 101]].forEach(([t, m], i) => cutTing(t, m, i % 2 ? -0.5 : 0.5));

  // ACT 2 PEAK LANDING 40.0
  put(MUSIC, 40.0, bigBoom(rngFor('boom40'), 1.6, { decay: 0.45 }), { gain: 0.48, rev: 0.15 });
  put2(MUSIC, 40.0, crash(rngFor('c40'), 1.8), { gain: 0.15, rev: 0.4 });
  put(MUSIC, 40.0, K, { gain: 0.45, rev: 0.03 });
  put2(MUSIC, 40.0, pad([50, 57, 62, 65, 69, 74, 77], 1.4, { attack: 0.02, release: 0.4, cutoff: 3600, detune: 9 }), { gain: 0.12, rev: 0.45 });
  put(MUSIC, 40.0, bassNote(38, 0.9), { gain: 0.3 });
  kimN(40.0, 86, 0.9, { trem: 15, vib: 0.3, gain: 0.12, rev: 0.5 });
  lead(40.0, 86, 0.8, { bendFrom: -3, bendTime: 0.18, vibDepth: 0.4, gain: 0.17, rev: 0.5 });
  [62, 69, 74, 77, 81, 86].forEach((m, k) => tranhNote(40.0 + k * 0.03, m, 1.2, 0.05, -0.5 + 0.2 * k, 'land' + k, 0.5));

  // ---- foley (the star) ----
  // 10–13 big pot rolling boil (stays under the next shots, swells again when aromatics land)
  const boil = boilBed(rngFor('boil'), 12.4);
  const bEnv = (t) => pw([[0, 1], [3.1, 1], [3.5, 0.3], [9.3, 0.3], [9.5, 0.85], [11.6, 0.7], [12.4, 0]], t);
  mulEnv(boil[0], bEnv); mulEnv(boil[1], bEnv);
  put2(SFX, 10.0, boil, { gain: 0.42, rev: 0.12 });
  put2(SFX, 10.2, steam(rngFor('steam1'), 3.0), { gain: 0.1, rev: 0.15 });
  [10.6, 11.2].forEach((t, k) => put(SFX, t, plunge(rngFor('fish' + k), { size: 0.8 + 0.1 * k }), { gain: 0.72, pan: k ? 0.15 : -0.15, rev: 0.18 }));
  put(SFX, 11.8, lemongrassDrop(rngFor('lemongrass')), { gain: 0.85, pan: 0.05, rev: 0.18 });
  // 13–16 straining through a bamboo basket
  put2(SFX, 13.4, waterPour(rngFor('strain'), 2.0, { f0: 420, f1: 900, thick: 1 }), { gain: 0.6, rev: 0.18 });
  put2(SFX, 14.2, rattle(rngFor('bones'), 0.8), { gain: 0.55, rev: 0.15 });
  // 16–19 frying aromatics: burst, spatula scrapes, oil pops
  put2(SFX, 16.3, sizzleBurst(rngFor('fry'), 2.95), { gain: 0.55, rev: 0.1 });
  [17.0, 17.8, 18.5].forEach((t, k) => put(SFX, t, spatula(rngFor('spat' + k)), { gain: 0.5, pan: [-0.15, 0.15, 0][k], rev: 0.15 }));
  // 19–22 into the pot; slow-motion eggplant splashes
  put2(SFX, 19.4, hissInto(rngFor('tip'), 1.4), { gain: 0.72, rev: 0.15 });
  [20.4, 21.0].forEach((t, k) => {
    put(SFX, t - 0.3, whoosh(rngFor('pre' + k), 0.32, 150, 600, 250, 0.85, 1.0), { gain: 0.06, rev: 0.1 });
    put(SFX, t, plunge(rngFor('egg' + k), { size: 1.3, slow: 1.8 }), { gain: 0.85, pan: k ? 0.2 : -0.2, rev: 0.2, hall: 0.5 });
  });
  // 22–24.5 cleaver through crackling roast pork
  [22.5, 23.0, 23.5, 24.0].forEach((t, k) => put(SFX, t, chop(rngFor('chop' + k)), { gain: 0.95, pan: k % 2 ? 0.08 : -0.08, rev: 0.15 }));
  // 24.5–27.5 shrimp / squid / snakehead fish onto the plate
  [25.0, 26.0, 27.0].forEach((t, k) => put(SFX, t, wetPlop(rngFor('ing' + k), [260, 220, 190][k]), { gain: 0.95, pan: [-0.2, 0.1, 0.25][k], rev: 0.15 }));
  // 27.5–31 greens & flowers: rustle + water-lily stem snaps
  put2(SFX, 27.5, rustle(rngFor('greens'), 3.4), { gain: 0.5, rev: 0.12 });
  [28.5, 29.5, 30.5].forEach((t, k) => put(SFX, t, snap(rngFor('snap' + k)), { gain: 0.9, pan: [-0.2, 0.2, 0][k], rev: 0.15 }));
  // 31–33.5 noodles dipped, lifted, dripping
  put(SFX, 31.3, plunge(rngFor('dip'), { size: 0.9 }), { gain: 0.6, pan: 0.05, rev: 0.18 });
  put2(SFX, 32.0, trickle(rngFor('drip'), 1.3), { gain: 0.45, rev: 0.15 });
  // 33.5–36.5 building the bowl
  [34.0, 34.5, 35.0, 35.5, 36.0].forEach((t, k) => put(SFX, t, ceramic(rngFor('place' + k), [1560, 1750, 1640, 1860, 1700][k], 1.1), { gain: 0.42, pan: [-0.3, 0.25, -0.1, 0.3, 0][k], rev: 0.2 }));
  // 36.5–40 HERO: big ladle pour, steam bloom, chili, lime, bowl slide
  put2(SFX, 36.8, waterPour(rngFor('hero'), 1.6, { f0: 380, f1: 820, thick: 1 }), { gain: 0.7, rev: 0.18, hall: 0.1 });
  put(SFX, 37.1, whoosh(rngFor('bloom'), 1.3, 300, 2600, 900, 0.45, 0.9), { gain: 0.2, pan: (t) => -0.3 + 0.5 * t, rev: 0.1, hall: 0.3 });
  put2(SFX, 37.0, steam(rngFor('steam2'), 2.6), { gain: 0.14, rev: 0.15 });
  put(SFX, 38.6, sprinkle(rngFor('chili')), { gain: 0.75, pan: -0.1, rev: 0.15 });
  put(SFX, 39.1, squeeze(rngFor('lime')), { gain: 0.9, pan: 0.15, rev: 0.15 });
  put(SFX, 39.4, slideWood(rngFor('slide'), 0.5), { gain: 0.6, pan: (t) => 0.3 - t, rev: 0.12 });
  put(SFX, 39.88, ceramic(rngFor('stop'), 1450, 0.6), { gain: 0.2, pan: -0.15, rev: 0.15 });
}

// ---------- ACT 3 : fear the smell, then fall in love (40–60) ----------
{
  // 40–43 smell wave
  put2(SFX, 40.3, smellWave(rngFor('smell'), 1.0), { gain: 0.7, rev: 0.1, hall: 0.25 });
  put2(MUSIC, 40.4, pad([50, 57, 62, 65], 2.1, { attack: 0.3, release: 0.3, cutoff: 1400, detune: 16 }), { gain: 0.06, rev: 0.5 });
  put(MUSIC, 41.5, wahWah(), { gain: 0.2, pan: 0.05, rev: 0.35 });
  put(MUSIC, 41.5, bassNote(37, 0.3), { gain: 0.16 }); put(MUSIC, 41.86, bassNote(35, 0.8), { gain: 0.16 });
  put2(SFX, 42.0, shimmer(rngFor('tears'), 0.9), { gain: 0.06, hall: 0.4 });
  put(SFX, 42.2, ting(m2f(101), 0.5), { gain: 0.05, pan: 0.2, rev: 0.2, hall: 0.4 });
  put(SFX, 42.32, ting(m2f(105), 0.45), { gain: 0.035, pan: -0.2, rev: 0.2, hall: 0.4 });

  // 43–45.5 bird flaps away, cô Út giggles, spoon offered
  put(SFX, 43.4, wings(rngFor('flap'), 0.7, 15), { gain: 0.55, pan: (t) => 0.1 + 1.2 * t, rev: 0.15, hall: 0.15 });
  put(SFX, 43.45, sparrow(rngFor('alarm')), { gain: 0.09, pan: 0.5, rev: 0.2, hall: 0.3 });
  put(SFX, 45.0, ceramic(rngFor('spoon'), 2550), { gain: 0.32, pan: 0.1, rev: 0.2 });
  put(SFX, 45.0, clink(rngFor('spoon2'), 2400), { gain: 0.1, pan: 0.1, rev: 0.2 });
  // playful light groove 42.5–45.5 (Bb – F – C), thinning before the cut
  [[42.5, 'Bb', 0.5], [43.0, 'F', 1.0], [44.0, 'C', 1.0], [45.0, 'C', 1.0]].forEach(([T, ch, d], k) => {
    put2(MUSIC, T, pad(V[ch], d - 0.03, { attack: 0.06, release: 0.12, cutoff: 1800, pump: (t) => pumpAt(T + t, 0.25), seed: 'pl' + k }), { gain: k === 3 ? 0.05 : 0.06, rev: 0.35 });
  });
  for (let t = 43.0; t < 45.5 - 1e-6; t += BEAT) {
    put(MUSIC, t, (t * 2) % 2 === 0 ? K : KG, { gain: (t * 2) % 2 === 0 ? 0.3 : 0.1, rev: 0.03 });
    put(MUSIC, t + 0.25, (t * 2) % 2 === 0 ? MO_HI : MO_LO, { gain: 0.08, pan: 0.3, rev: 0.3 });
    put(MUSIC, t, bassNote((t * 2) % 2 === 0 ? ROOT[t < 44 ? 'F' : 'C'] : fifthOf(ROOT[t < 44 ? 'F' : 'C']), 0.18), { gain: 0.2 });
  }
  for (let t = 43.0; t < 45.5 - 1e-6; t += 0.25) shk(t, (t * 4) % 2 === 1, 0.025);
  [[43.0, 72], [43.25, 77], [43.5, 74], [43.75, 77], [45.0, 72], [45.25, 74]].forEach(([t, m], k) => tranhNote(t, m, 0.4, 0.035, 0.45, 'pz' + k, 0.3));
  [86, 84, 86, 84, 81].forEach((m, k) => tranhNote(44.2 + k * 0.07, m, 0.5, 0.05 - 0.004 * k, 0.35, 'gig' + k, 0.4));   // giggle
  kimP([[43.5, 79, 0.2], [43.75, 81, 0.2], [44.0, 79, 0.15], [44.75, 77, 0.2], [45.5, 74, 0.45, { trem: 14, gain: 0.07 }]], { gain: 0.08 });

  // 45.5–47.5 the sip: music cut at 46.0 (master gate), near-silence, slurp, heartbeat, reversed cymbal
  put(SFX, 46.6, slurp(rngFor('sip'), 0.4), { gain: 0.45, pan: 0.05, rev: 0.12 });
  const HB = heartbeat();
  [46.8, 47.2].forEach((t, k) => put(SFX, t, HB, { gain: 0.5 + 0.05 * k, rev: 0.05 }));
  put2(SFX, 47.0, reverseCrash(rngFor('rc47'), 0.5), { gain: 0.22, rev: 0.1 });

  // 47.5 IMPACT / BLOOM
  put(SFX, 47.5, bigBoom(rngFor('boom475'), 2.4, { fStart: 85, fEnd: 30, decay: 0.7, crack: 0.35 }), { gain: 0.6, rev: 0.1, hall: 0.25 });
  put(SFX, 47.5, whoosh(rngFor('imp475'), 1.3, 2600, 3200, 260, 0.06, 0.9), { gain: 0.3, pan: (t) => 0.4 * Math.sin(TAU * 0.8 * t), rev: 0.1, hall: 0.4 });

  // 47.5–51.5 EUPHORIA: F – C – Dm – Bb, lush strings, fast joyful đàn kìm runs
  const eu = [[47.5, 'F', [53, 60, 65, 69, 72, 77]], [48.5, 'C', [48, 55, 60, 64, 67, 72]], [49.5, 'Dm', [50, 57, 62, 65, 69, 74]], [50.5, 'Bb', [46, 53, 58, 62, 65, 69]]];
  eu.forEach(([T, ch, v], k) => {
    put2(MUSIC, T, pad(v, 0.98, { attack: 0.05, release: 0.15, cutoff: 3200, detune: 9, pump: (t) => pumpAt(T + t, 0.25), seed: 'eu' + k }), { gain: 0.085, rev: 0.45 });
    put2(MUSIC, T, pad(v.map((m) => m + 12).slice(1), 1.0, { attack: k === 0 ? 0.25 : 0.12, release: 0.25, cutoff: 5000, tab: TAB_STR, vib: 14, detune: 10, seed: 'str' + k }), { gain: 0.06, rev: 0.6 });
    for (let t = T; t < T + 1 - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - T) / 0.25) % 2 ? ROOT[ch] + 12 : ROOT[ch], 0.2), { gain: 0.26 });
  });
  put(MUSIC, 47.5, bigBoom(rngFor('boom475m'), 1.6, { decay: 0.5 }), { gain: 0.3, rev: 0.2 });
  put2(MUSIC, 47.5, crash(rngFor('c475'), 2.6), { gain: 0.16, rev: 0.45 });
  put(MUSIC, 47.5, drone(4.0, { attack: 0.05, release: 0.3, midi: 41 }), { gain: 0.06, rev: 0.2 });
  [53, 57, 60, 62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86, 89].forEach((m, k) => tranhNote(47.6 + k * 0.028, m, 1.5, 0.042 + k * 0.003, -0.7 + k * 0.1, 'gl' + k, 0.6));
  for (let t = 47.5; t < 51.5 - 1e-6; t += BEAT) put(MUSIC, t, K, { gain: 0.42, rev: 0.03 });
  for (let t = 48.0; t < 51.5 - 1e-6; t += 1.0) put(MUSIC, t, clap(rngFor('cl3' + t)), { gain: 0.11, rev: 0.3 });
  for (let t = 47.5; t < 51.5 - 1e-6; t += BEAT) put(MUSIC, t + 0.25, MO_HI, { gain: 0.07, pan: 0.3, rev: 0.3 });
  for (let t = 47.5; t < 51.5 - 1e-6; t += 0.125) { const k = Math.round((t - 47.5) / 0.125) % 2; shk(t, k === 1, k ? 0.05 : 0.03); }
  kimP([
    [47.5, 81, 0.45, { bendFrom: -3, bendTime: 0.15, trem: 15 }], [48.0, 77, 0.12], [48.125, 79, 0.12], [48.25, 81, 0.12], [48.375, 84, 0.12],
    [48.5, 86, 0.45, { trem: 15 }], [49.0, 84, 0.12], [49.125, 81, 0.12], [49.25, 79, 0.12], [49.375, 77, 0.12],
    [49.5, 81, 0.45, { nhan: 2, nhanAt: 0.2, nhanLen: 0.2 }], [50.0, 74, 0.12], [50.125, 77, 0.12], [50.25, 79, 0.12], [50.375, 81, 0.12],
    [50.5, 84, 0.7, { trem: 15, vib: 0.25 }], [51.25, 81, 0.25, { endBend: -2, endBendTime: 0.15 }],
  ], { gain: 0.11, rev: 0.45 });
  [[47.5, 77, 0.95, -3, { vibDepth: 0.45, bendTime: 0.3 }], [48.5, 79, 0.95, -2, { vibDepth: 0.4 }], [49.5, 81, 0.95, -2, { vibDepth: 0.45 }], [50.5, 77, 0.95, -2, { vibDepth: 0.4 }]]
    .forEach(([t, m, d, bf, ex]) => lead(t, m, d, { bendFrom: bf, gain: 0.15, rev: 0.55, ...(ex || {}) }));
  eu.forEach(([T, , v]) => [0, 2, 4, 2].forEach((ix, k) => tranhNote(T + k * 0.25, v[ix] + 12, 0.7, 0.03, 0.55, 'eu' + T + k, 0.45)));
  // fish jumps with musically pitched bloops (bloop lands on 48.6 / 50.2), blooming chimes 48.0–49.5
  put(SFX, 48.6 - 0.25, fishJump(rngFor('fj1'), 79), { gain: 0.6, pan: -0.4, rev: 0.15, hall: 0.35 });
  put(SFX, 50.2 - 0.25, fishJump(rngFor('fj2'), 81), { gain: 0.6, pan: 0.4, rev: 0.15, hall: 0.35 });
  [84, 89, 86, 91, 93, 89, 96, 93, 98, 96].forEach((m, k) => put(MUSIC, 48.0 + k * 0.15, ting(m2f(m), 0.7), { gain: 0.03, pan: (k % 2 ? 0.6 : -0.6) * (0.4 + 0.06 * k), rev: 0.65 }));
  const riv2 = riverAmb(rngFor('river2'), 12.6);
  const r2 = (t) => pw([[0, 0], [0.8, 0.25], [8.6, 0.3], [9.4, 0.85], [12.6, 0.85]], t);
  mulEnv(riv2[0], r2); mulEnv(riv2[1], r2);
  put2(AMB, 47.4, riv2, { gain: 0.2, rev: 0.05, hall: 0.08 });

  // 51.5–56 COMIC SLURPING groove: C – F – C – Dm – Bb
  const cg = [[51.5, 'C', 0.5], [52, 'F', 1], [53, 'C', 1], [54, 'Dm', 1], [55, 'Bb', 1]];
  cg.forEach(([T, ch, d], k) => {
    put2(MUSIC, T, pad(V[ch], d - 0.03, { attack: 0.05, release: 0.12, cutoff: 2200, pump: (t) => pumpAt(T + t, 0.3), seed: 'cg' + k }), { gain: 0.06, rev: 0.35 });
    for (let t = T; t < T + d - 1e-6; t += BEAT) put(MUSIC, t, bassNote(Math.round((t - T) / BEAT) % 2 ? fifthOf(ROOT[ch]) : ROOT[ch], 0.16), { gain: 0.24 });
  });
  for (let t = 52.0; t < 56.0 - 1e-6; t += BEAT) {
    if ((t * 2) % 2 === 0) put(MUSIC, t, K, { gain: 0.32, rev: 0.03 });
    put(MUSIC, t + 0.25, (t * 2) % 2 ? MO_LO : MO_HI, { gain: 0.085, pan: 0.3, rev: 0.3 });
  }
  for (let t = 51.5; t < 56.0 - 1e-6; t += 0.25) shk(t, (t * 4) % 2 === 1, 0.03);
  [[52.0, 0.22, 0.4], [52.5, 0.25, 0.47], [53.0, 0.28, 0.55], [53.5, 0.4, 0.64]].forEach(([t, d, g], k) => put(SFX, t, slurp(rngFor('slurp' + k), d), { gain: g, pan: 0.05 * (k % 2 ? 1 : -1), rev: 0.12 }));
  kimP([[52.25, 77, 0.15], [52.75, 79, 0.15], [53.25, 81, 0.15], [53.75, 84, 0.3, { bendFrom: -2, bendTime: 0.08 }]], { gain: 0.1 });
  put(SFX, 54.3, sniff(rngFor('longsniff'), 0.62, { rise: 1.5, pulses: 2.5 }), { gain: 0.5, pan: 0.05, rev: 0.12 });
  tranhBend(54.8, 74, 0.6, { bendFrom: -2, bendTime: 0.3, vib: 0.25, gain: 0.08, pan: 0.2 });   // satisfied "mm"
  [86, 84, 86, 84, 86, 84, 81, 84, 81].forEach((m, k) => tranhNote(55.0 + k * 0.068, m, 0.45, 0.045, 0.3 + 0.03 * k, 'trill' + k, 0.4));   // cô Út laughs
  kimP([[55.5, 72, 0.22], [55.75, 74, 0.22]], { gain: 0.09 });

  // 56–60 RESOLUTION: Bb – C – F, final hit 57.0
  put2(MUSIC, 56.0, pad(V.Bb, 0.48, { attack: 0.06, release: 0.06, cutoff: 2400, seed: 'r1' }), { gain: 0.08, rev: 0.45 });
  put2(MUSIC, 56.5, pad(V.C, 0.48, { attack: 0.06, release: 0.06, cutoff: 2400, seed: 'r2' }), { gain: 0.085, rev: 0.45 });
  put(MUSIC, 56.0, bassNote(34, 0.45), { gain: 0.24 }); put(MUSIC, 56.5, bassNote(36, 0.45), { gain: 0.24 });
  put(MUSIC, 56.0, K, { gain: 0.3, rev: 0.03 }); put(MUSIC, 56.5, K, { gain: 0.3, rev: 0.03 });
  kimP([[56.0, 77, 0.45, { bendFrom: -2 }], [56.5, 79, 0.22], [56.75, 81, 0.22]], { gain: 0.1 });
  put(MUSIC, 56.4, riser(rngFor('riser564'), 0.6, 600, 7000), { gain: 0.08, rev: 0.3 });
  put(MUSIC, 57.0, bigBoom(rngFor('boom57'), 1.8, { decay: 0.5 }), { gain: 0.48, rev: 0.2 });
  put(MUSIC, 57.0, KD, { gain: 0.3, rev: 0.05 });
  put2(MUSIC, 57.0, crash(rngFor('c57'), 1.8), { gain: 0.12, rev: 0.45 });
  put2(MUSIC, 57.0, pad([53, 60, 65, 69, 74, 77], 1.8, { attack: 0.04, release: 0.8, cutoff: 2800, detune: 8, seed: 'fin' }), { gain: 0.12, rev: 0.55 });
  put2(MUSIC, 57.0, pad([65, 72, 77, 81], 1.8, { attack: 0.15, release: 0.8, cutoff: 5000, tab: TAB_STR, vib: 12, detune: 9, seed: 'fins' }), { gain: 0.045, rev: 0.6 });
  put(MUSIC, 57.0, bassNote(41, 1.5), { gain: 0.26 });
  put(MUSIC, 57.0, drone(2.4, { attack: 0.1, release: 0.4, midi: 41 }), { gain: 0.05, rev: 0.2 });
  [53, 57, 60, 62, 65, 67, 69, 72, 74, 77, 79, 81, 84].forEach((m, k) => tranhNote(57.0 + k * 0.04, m, 1.8, 0.045, -0.6 + k * 0.1, 'fin' + k, 0.6));
  kimP([[57.0, 81, 0.6, { bendFrom: -3, bendTime: 0.15, trem: 14, vib: 0.25 }], [57.65, 79, 0.25], [57.9, 77, 0.25], [58.15, 74, 0.35, { nhan: 1.5, nhanAt: 0.2, nhanLen: 0.2 }],
    [58.5, 77, 1.0, { bendFrom: -2, bendTime: 0.2, vib: 0.3, release: 0.5, t60: 2.2 }]], { gain: 0.12, rev: 0.55 });
  lead(57.0, 77, 1.3, { bendFrom: -5, bendTime: 0.4, vibDepth: 0.45, attack: 0.06, release: 0.4, gain: 0.13, rev: 0.6 });
  // river, birds and far engine return
  [[56.6, 0.6], [57.3, -0.5], [57.9, 0.3], [58.4, -0.7], [58.9, 0.5]].forEach(([t, p], k) => sparrowAt(t, 0.045, p, 'z' + k));
  put(AMB, 57.4, coucal(rngFor('coucal2'), 5), { gain: 0.045, pan: -0.6, rev: 0.2, hall: 0.6 });
  const eng2 = mulEnv(boatEngine(rngFor('engine2'), 3.4), (t) => pw([[0, 0], [1.2, 0.6], [3.4, 0.5]], t));
  put(AMB, 56.4, eng2, { gain: 0.06, pan: (t) => 0.7 - 0.3 * t, rev: 0.1, hall: 0.45 });
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
  const trim = (t) => pw([[0, 1.55], [8.3, 1.55], [8.45, 0.8], [9.0, 0.8], [9.3, 1.1], [9.97, 1.1], [10.0, 0.95], [27.5, 0.95], [28, 1.0], [36.5, 1.0], [39.9, 1.1],
    [40.3, 1.0], [45.9, 1.0], [47.5, 1.15], [51.4, 1.15], [51.6, 1.0], [54.2, 1.0], [54.3, 0.72], [54.85, 0.72], [55.0, 1.0], [60, 1.0]], t);
  for (let i = 0; i < N; i++) duck[i] *= trim(i / SR);
}
// ambience joins the SFX bus only after the duck key was computed
for (const key of ['L', 'R', 'sL', 'sR', 'hL', 'hR']) for (let i = 0; i < N; i++) SFX[key][i] += AMB[key][i];

// (b) comic "smell" warp 40.4–41.45 on the whole music bus (dry + hall send):
//     variable delay line (two LFOs, seasick pitch drift) + sway, as the smell wave hits
const WOB0 = 40.4, WOB1 = 41.45, WOB_RAMP = 0.3;
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

// (c) music gate: hard-ish cut at 46.0 (60 ms) for the sip, back open for the 47.5 bloom
const I_GATE0 = Math.round(45.97 * SR), I_GATE1 = Math.round(46.03 * SR), I_OPEN0 = Math.round(47.44 * SR), I_OPEN1 = Math.round(47.49 * SR);
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
// hall: music (ducked) + SFX hall sends; cleared right after the 46.0 cut so nothing rings back at 47.5
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
  const row = []; for (let s = 0; s < 60; s++) row.push(`${String(s).padStart(2)}:${rmsW(s, s + 1).toFixed(0).padStart(4)}`);
  console.log('RMS per second (dBFS):'); for (let k = 0; k < 60; k += 10) console.log('  ' + row.slice(k, k + 10).join('  '));
  for (const [name, a, c] of [['dawn 0.0-3.0', 0, 3.0], ['sniffs 8.4-9.0', 8.4, 9.0], ['pre-title 9.5-10.0', 9.5, 10.0], ['TITLE HIT 10.0-10.5', 10.0, 10.5], ['chops 22.4-24.4', 22.4, 24.4],
    ['hero 39.5-40.0', 39.5, 40.0], ['PEAK 40.0-40.5', 40.0, 40.5], ['smell 40.3-41.3', 40.3, 41.3], ['SILENCE 46.1-46.5', 46.1, 46.5], ['slurp 46.6-47.0', 46.6, 47.0],
    ['pre-impact 47.0-47.5', 47.0, 47.5], ['IMPACT 47.5-48.0', 47.5, 48.0], ['euphoria 47.5-51.5', 47.5, 51.5], ['slurps 52.0-54.0', 52.0, 54.0], ['pre-final 56.5-57.0', 56.5, 57.0],
    ['FINAL HIT 57.0-57.5', 57.0, 57.5], ['tail 59.7-60.0', 59.7, 60.0]]) {
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
  const cues = [[0.2, 2.8, 'dawn'], [3.4, 3.8, 'oar1'], [4.4, 4.8, 'oar2'], [5.2, 5.6, 'oar3'], [6.25, 6.8, 'wobble1'], [6.95, 7.5, 'wobble2'], [7.4, 7.7, 'kingfisher'],
    [8.5, 8.66, 'sniff1'], [8.9, 9.1, 'sniff2'], [9.0, 9.32, 'whip'], [10.0, 10.5, 'TITLE'], [10.0, 13.0, 'boil'], [10.6, 10.9, 'plop1'], [11.2, 11.5, 'plop2'], [11.8, 12.2, 'lemongrass'],
    [13.4, 15.4, 'strain'], [14.2, 15.0, 'bones'], [16.3, 16.8, 'sizzleburst'], [16.8, 19.2, 'fry'], [17.0, 17.3, 'scrape1'], [19.4, 20.2, 'tip'], [20.4, 21.0, 'egg1'], [21.0, 21.8, 'egg2'],
    [22.5, 22.7, 'chop1'], [24.0, 24.2, 'chop4'], [25.0, 25.3, 'shrimp'], [27.0, 27.3, 'fish'], [27.6, 31.0, 'greens'], [28.5, 28.7, 'snap1'], [31.3, 31.7, 'dip'], [32.0, 33.3, 'trickle'],
    [34.0, 34.3, 'place1'], [36.8, 38.4, 'heropour'], [38.6, 39.0, 'chili'], [39.1, 39.4, 'lime'], [39.4, 39.9, 'slide'], [40.3, 41.3, 'smell'], [43.4, 44.0, 'flap'], [45.0, 45.3, 'spoon'],
    [46.6, 47.0, 'sip'], [46.8, 47.3, 'heart'], [48.3, 48.9, 'fish1'], [49.9, 50.5, 'fish2'], [52.0, 52.3, 'slurp1'], [53.5, 53.9, 'slurp4'], [54.3, 54.9, 'longsniff']];
  for (let w = 0; w + 0.25 <= DUR; w += 0.25) { const g = 20 * Math.log10(GR(Math.round(w * SR), Math.round((w + 0.25) * SR))); if (g < -1.5) console.log('limiter GR', w.toFixed(2), g.toFixed(1), 'dB'); }
  for (const [a, b, nm] of cues) {
    const ia = Math.round(a * SR), ib = Math.round(b * SR), s = rms(sKL, sKR, ia, ib), m = rms(mKL, mKR, ia, ib);
    console.log(nm.padEnd(12), `${a.toFixed(2)}-${b.toFixed(2)}`.padEnd(12), 'sfx', dB(s), ' music', dB(m), ' sfx-music', (20 * Math.log10(s / m)).toFixed(1).padStart(6), '  limGR', (20 * Math.log10(GR(ia, ib))).toFixed(1));
  }
}
