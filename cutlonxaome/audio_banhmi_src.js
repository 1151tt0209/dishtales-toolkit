'use strict';
/*
 * Bánh mì — cinematic food commercial soundtrack (30 s)
 * Fully procedural audio in pure Node.js (no packages, no samples).
 * Run:  node audio.js   ->  writes audio.wav (48 kHz, stereo, 16-bit PCM, 30.0 s)
 *
 * Layout of this file:
 *   1. Core constants, seeded PRNG, math helpers
 *   2. DSP helpers (biquad filters, noise bursts, wavetables)
 *   3. Instruments  (đàn bầu lead, đàn tranh pluck, pad, drone, drums, bass)
 *   4. Sound effects (one generator per cue)
 *   5. Mix buses + put()
 *   6. Score / cue list (Act I, Act II, Act III)
 *   7. Master: ducking, reverb, limiter, hard silence gate, fade, WAV writer
 */
const fs = require('fs');
const path = require('path');

// ───────────────────────────── 1. Core ─────────────────────────────
const SR = 48000;
const DUR = 30.0;
const N = Math.round(SR * DUR);
const BEAT = 0.5;            // 120 BPM
const BAR = 4 * BEAT;
const TAU = Math.PI * 2;
const CUT = 28.0;            // hard cut to silence
const RESUME = 28.5;         // bite

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const rngFor = (name) => mulberry32(hashStr(name));   // independent deterministic stream per cue

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);
const secs = (s) => Math.max(1, Math.round(s * SR));
const expi = (a, b, u) => a * Math.pow(b / a, clamp(u, 0, 1));
function pw(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1] = keys[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
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
// single-cycle wavetable (additive, band-limited by construction)
function makeTable(amps) {
  const T = 2048, tab = new Float32Array(T + 1);
  for (let h = 0; h < amps.length; h++) { const a = amps[h]; if (!a) continue; for (let j = 0; j < T; j++) tab[j] += a * Math.sin(TAU * (h + 1) * j / T); }
  norm(tab.subarray(0, T)); tab[T] = tab[0];
  return tab;
}
function tabRead(tab, ph) { const T = tab.length - 1, p = ph * T, i = p | 0, f = p - i; return tab[i] + (tab[i + 1] - tab[i]) * f; }
const TAB_PAD = makeTable([1, 0.48, 0.3, 0.2, 0.13, 0.09, 0.06, 0.04, 0.025]);
const TAB_ENGINE = makeTable(Array.from({ length: 30 }, (_, h) => (1 / Math.pow(h + 1, 0.75)) * (h % 2 === 0 ? 1 : 0.8) * (h > 8 && h < 16 ? 1.4 : 1)));

// ───────────────────────────── 3. Instruments ─────────────────────────────

/* Đàn bầu (monochord): near-sine tone with a few soft harmonics, slow-ish attack,
 * expressive pitch glides into (bendFrom, semitones) and out of (endBend) notes,
 * and vibrato that widens as the note sustains. */
function danBau(midi, dur, o = {}) {
  const f0 = m2f(midi);
  const bendFrom = o.bendFrom || 0, bendTime = o.bendTime ?? Math.min(0.18, dur * 0.4);
  const endBend = o.endBend || 0, endBendTime = o.endBendTime ?? Math.min(0.25, dur * 0.4);
  const vibRate = o.vibRate ?? 5.4, vibDepth = o.vibDepth ?? 0.28;
  const attack = o.attack ?? Math.min(0.07, dur * 0.25), release = o.release ?? 0.14;
  const bright = o.bright ?? 1;
  const n = secs(dur + release), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let st = 0;
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
  // gentle body resonance + fade
  const body = filt(y, 'peak', 900, 1.2, 3);
  return fadeEdges(norm(body), 0.001, Math.min(0.15, dur * 0.3));
}

/* Warm pad: 3 detuned voices per note (L / C / R), soft band-limited wavetable, low-passed. */
function pad(midis, dur, o = {}) {
  const attack = o.attack ?? 0.8, release = o.release ?? 0.8, cutoff = o.cutoff ?? 1200, det = o.detune ?? 7;
  const R = rngFor('pad' + midis.join(',') + dur);
  const n = secs(dur + release), L = new Float32Array(n), Rr = new Float32Array(n);
  const voices = [];
  for (const m of midis) for (let v = 0; v < 3; v++) {
    voices.push({ f: m2f(m) * Math.pow(2, ((v - 1) * det + (R() - 0.5) * 2) / 1200), ph: R(), pan: (v - 1) * 0.7 + (R() - 0.5) * 0.2, lfo: 0.15 + R() * 0.3, lph: R() * TAU });
  }
  for (const vc of voices) {
    const a = (vc.pan + 1) * Math.PI / 4, gl = Math.cos(a), gr = Math.sin(a);
    let ph = vc.ph;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      ph += vc.f * (1 + 0.0012 * Math.sin(TAU * vc.lfo * t + vc.lph)) / SR; ph -= Math.floor(ph);
      const s = tabRead(TAB_PAD, ph);
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
    Lf[i] *= env; Rf[i] *= env;
  }
  norm2(Lf, Rf);
  fadeEdges(Lf, 0.005, 0.01); fadeEdges(Rf, 0.005, 0.01);
  return [Lf, Rf];
}

/* Low drone on D: sub sine + octave + soft fifth, slow breathing. */
function drone(dur, o = {}) {
  const attack = o.attack ?? 1.5, release = o.release ?? 0.6;
  const n = secs(dur + release), y = new Float32Array(n);
  const f = m2f(38);
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
  const R = rngFor('kick'), n = secs(0.45), y = new Float32Array(n);
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
  addInto(y, click, 0, 0.35);
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
function tick(R) { // small cymbal-ish accent
  const n = secs(0.6), y = burst(R, 0.6, 'hp', 5500, 0.7, 0.07);
  norm(y, 0.6);
  const parts = [[3150, 0.25], [4730, 0.2], [6320, 0.16], [8210, 0.12], [5480, 0.1]];
  for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; for (const [f, a] of parts) s += a * Math.sin(TAU * f * t) * Math.exp(-t / 0.16); y[i] += s * (t < 0.0008 ? t / 0.0008 : 1); }
  return fadeEdges(norm(y), 0.0005, 0.05);
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
    const r = rngFor('crash' + seed);
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

function crustCrack(R) {
  const dur = 0.22, y = crackle(R, dur, (t) => 260 * Math.exp(-t / 0.06), (t) => Math.exp(-t / 0.07), 1800, 7000);
  addInto(y, burst(R, 0.01, 'hp', 2500, 0.7, 0.0015), 0, 0.7);
  addInto(y, burst(R, 0.08, 'bp', 700, 1.5, 0.02), 0, 0.5);
  return fadeEdges(norm(filt(y, 'peak', 3200, 1, 4)), 0.0005, 0.02);
}

function fireBed(R, dur, popRate) { // stereo
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  // rumble (brownish noise, slow flicker)
  const mkR = () => { const x = noise(n, R); let b = 0; for (let i = 0; i < n; i++) { b = b * 0.995 + x[i] * 0.1; x[i] = b; } return filt(x, 'lp', 260, 0.7); };
  const rl = norm(mkR()), rr = norm(mkR());
  const hiss = norm(filt(noise(n, R), 'bp', 2800, 0.6));
  for (let i = 0; i < n; i++) {
    const t = i / SR, fl = 0.7 + 0.3 * Math.sin(TAU * 0.9 * t) * Math.sin(TAU * 0.37 * t + 1);
    L[i] += rl[i] * 0.5 * fl + hiss[i] * 0.04; Rr[i] += rr[i] * 0.5 * fl + hiss[i] * 0.04;
  }
  // pops
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

/* serrated bread-knife sawing: strokes made of tooth-grains + scrape layer + crumbs */
function knifeScrape(R, dur = 1.2) {
  const n = secs(dur), y = new Float32Array(n);
  const strokes = 4, sl = dur / strokes;
  for (let s = 0; s < strokes; s++) {
    const t0 = s * sl, fwd = s % 2 === 0, base = fwd ? 3400 : 2600;
    const rate = fwd ? 68 : 54;
    let t = t0 + 0.01;
    while (t < t0 + sl - 0.015) {
      const u = (t - t0) / sl, env = Math.pow(Math.sin(Math.PI * u), 0.7);
      const g = burst(R, 0.012, 'bp', base * (0.75 + R() * 0.6), 2.2, 0.002 + R() * 0.003);
      addInto(y, g, secs(t), env * (0.5 + 0.5 * R()));
      t += (1 / rate) * (0.75 + 0.5 * R());
    }
    // continuous scrape
    const sc = filt(noise(secs(sl), R), 'bp', base * 0.9, 1.6);
    for (let i = 0; i < sc.length; i++) sc[i] *= 0.35 * Math.pow(Math.sin(Math.PI * i / sc.length), 1.2);
    addInto(y, sc, secs(t0), 1);
  }
  addInto(y, crackle(R, dur, () => 35, () => 0.6, 2500, 8000), 0, 1);
  return fadeEdges(norm(y), 0.005, 0.02);
}

/* bright crisp crust crack (stereo) */
function bigCrack(R) {
  const n = secs(0.35), L = new Float32Array(n), Rr = new Float32Array(n);
  addPan(L, Rr, burst(R, 0.03, 'hp', 2000, 0.7, 0.004), 0, 1.0, -0.2);
  addPan(L, Rr, burst(R, 0.03, 'hp', 2400, 0.7, 0.004), secs(0.002), 1.0, 0.2);
  for (let k = 0; k < 40; k++) {
    const t = Math.pow(R(), 2) * 0.12;
    addPan(L, Rr, burst(R, 0.006, 'bp', 2000 + R() * 6000, 1.3, 0.0008 + R() * 0.0012), secs(t), (0.3 + 0.7 * R()) * Math.exp(-t / 0.05), (R() - 0.5) * 1.6);
  }
  const body = burst(R, 0.12, 'bp', 520, 2.5, 0.025);
  addPan(L, Rr, body, 0, 0.8, 0);
  return norm2(L, Rr);
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

/* creamy butter / mayo squish */
function squish(R, dur = 1.1) {
  const n = secs(dur), x = noise(n, R);
  const lp = filt(x, 'lp', (t) => 520 + 330 * Math.sin(TAU * 3.3 * t) + 120 * Math.sin(TAU * 7.1 * t), 1.2);
  const wet = filt(x, 'bp', (t) => 420 + 230 * Math.sin(TAU * 4.1 * t + 1) + 90 * Math.sin(TAU * 9.3 * t), 7);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur;
    const env = smooth(u / 0.15) * smooth((1 - u) / 0.3) * (0.7 + 0.3 * Math.sin(TAU * 4.8 * t));
    y[i] = (lp[i] * 0.8 + wet[i] * 1.6) * env;
  }
  // sticky little pops
  let t = 0.05;
  while (t < dur - 0.1) { addInto(y, burst(R, 0.03, 'bp', 600 + R() * 600, 3, 0.006), secs(t), 0.25 * R()); t += 0.06 + R() * 0.08; }
  return fadeEdges(norm(y), 0.01, 0.02);
}

/* long pâté knife smear */
function smear(R, dur = 1.2) {
  const n = secs(dur), x = noise(n, R);
  const a = filt(x, 'bp', (t) => expi(1500, 2600, t / dur), 1.3);
  const b = filt(x, 'lp', 650, 0.9);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, u = t / dur;
    const env = smooth(u / 0.12) * smooth((1 - u) / 0.3) * (0.85 + 0.15 * Math.sin(TAU * 6.5 * t));
    y[i] = (a[i] * 0.9 + b[i] * 0.7) * env;
  }
  return fadeEdges(norm(y), 0.01, 0.02);
}

/* meaty plop: falling sine body + wet noise + smack */
function plop(R, f0 = 230, f1 = 85, dur = 0.25) {
  const n = secs(dur), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-t / (dur * 0.22))) / SR;
    y[i] = Math.sin(TAU * ph) * (t < 0.002 ? t / 0.002 : 1) * Math.exp(-t / (dur * 0.3));
  }
  addInto(y, burst(R, dur * 0.5, 'lp', 1300, 0.8, dur * 0.12), 0, 0.5);
  addInto(y, burst(R, 0.02, 'hp', 2200, 0.7, 0.003), 0, 0.25);
  return fadeEdges(norm(y), 0.001, 0.02);
}

/* cleaver chop on wooden board */
function chop(R) {
  const n = secs(0.45), y = new Float32Array(n);
  let ph = 0;
  const modes = [[185, 0.13, 0.55], [420, 0.09, 0.45], [770, 0.06, 0.3], [1290, 0.045, 0.2], [2080, 0.03, 0.12]];
  for (let i = 0; i < n; i++) {
    const t = i / SR, at = t < 0.001 ? t / 0.001 : 1;
    ph += (55 + 75 * Math.exp(-t / 0.02)) / SR;
    let s = Math.sin(TAU * ph) * Math.exp(-t / 0.07);
    for (const [f, d, a] of modes) s += a * Math.sin(TAU * f * t) * Math.exp(-t / d);
    y[i] = s * at;
  }
  addInto(y, burst(R, 0.015, 'hp', 3200, 0.7, 0.0025), 0, 0.8);
  addInto(y, burst(R, 0.06, 'bp', 1000, 1, 0.012), 0, 0.5);
  return fadeEdges(norm(y), 0.0005, 0.04);
}

/* hot-sauce pour: stream + gurgling bubbles + sizzle (stereo) */
function pourSizzle(R, dur = 1.3) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const stream = filt(noise(n, R), 'bp', 900, 0.7);
  for (let i = 0; i < n; i++) { const u = i / n; stream[i] *= 0.18 * smooth(u / 0.1) * smooth((0.85 - u) / 0.2); }
  addPan(L, Rr, stream, 0, 1, 0);
  // bubbles
  let t = 0.02;
  while (t < dur * 0.8) {
    const f0 = 260 + R() * 520, len = 0.025 + R() * 0.045, m = secs(len), b = new Float32Array(m);
    let ph = 0;
    for (let i = 0; i < m; i++) { const tt = i / SR; ph += f0 * (1 + 0.9 * tt / len) / SR; b[i] = Math.sin(TAU * ph) * (tt < 0.001 ? tt / 0.001 : 1) * Math.exp(-tt / (len * 0.3)); }
    addPan(L, Rr, fadeEdges(b, 0.0005, 0.004), secs(t), 0.35 + 0.45 * R(), (R() - 0.5) * 0.6);
    t += -Math.log(1 - R() * 0.99) / 28;
  }
  // sizzle
  const szL = filt(noise(n, R), 'hp', 4500, 0.7), szR = filt(noise(n, R), 'hp', 4500, 0.7);
  const crL = crackle(R, dur, () => 90, () => 1, 3000, 9000), crR = crackle(R, dur, () => 90, () => 1, 3000, 9000);
  for (let i = 0; i < n; i++) {
    const u = i / n, e = smooth((u - 0.15) / 0.4) * smooth((1 - u) / 0.15);
    const fl = 0.75 + 0.25 * Math.sin(TAU * 11 * i / SR);
    L[i] += (szL[i] * 0.22 * fl + crL[i] * 0.5) * e; Rr[i] += (szR[i] * 0.22 * fl + crR[i] * 0.5) * e;
  }
  fadeEdges(L, 0.005, 0.02); fadeEdges(Rr, 0.005, 0.02);
  return norm2(L, Rr);
}

/* crisp wet cucumber snap */
function cucumberSnap(R) {
  const n = secs(0.3), y = new Float32Array(n);
  addInto(y, burst(R, 0.01, 'hp', 2500, 0.7, 0.0012), 0, 1);
  addInto(y, burst(R, 0.15, 'bp', 2650, 6, 0.04), 0, 0.9);
  addInto(y, burst(R, 0.15, 'bp', 1350, 4, 0.045), secs(0.001), 0.5);
  const wet = filt(noise(secs(0.16), R), 'lp', (t) => expi(3200, 600, t / 0.16), 2);
  for (let i = 0; i < wet.length; i++) wet[i] *= 0.3 * Math.exp(-i / SR / 0.06);
  addInto(y, wet, secs(0.004), 1);
  addInto(y, crackle(R, 0.15, (t) => 200 * Math.exp(-t / 0.05), () => 0.5, 4000, 9000), secs(0.003), 1);
  return fadeEdges(norm(y), 0.0003, 0.02);
}

/* light rustling crunch (pickled carrot / daikon) — stereo */
function rustleCrunch(R, dur = 0.4) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  let t = 0;
  while (t < dur - 0.01) {
    const a = Math.exp(-t / 0.12) * (0.3 + 0.7 * R());
    addPan(L, Rr, burst(R, 0.008, 'bp', 2500 + R() * 4500, 1.5, 0.001 + R() * 0.002), secs(t), a, (R() - 0.5) * 1.2);
    t += -Math.log(1 - R() * 0.99) / (160 * Math.exp(-t / 0.15) + 20);
  }
  for (let k = 0; k < 6; k++) addPan(L, Rr, burst(R, 0.03, 'bp', 700 + R() * 600, 1.5, 0.008), secs(R() * 0.12), 0.6, (R() - 0.5));
  return norm2(L, Rr);
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

/* gentle leafy rustle (herbs) — stereo */
function leafRustle(R, dur = 1.2) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  let t = 0;
  while (t < dur - 0.06) {
    const u = t / dur, env = Math.pow(Math.sin(Math.PI * u), 0.8);
    const len = 0.015 + R() * 0.04, m = secs(len);
    const g = filt(noise(m, R), 'bp', 2000 + R() * 4500, 1.4);
    for (let i = 0; i < m; i++) g[i] *= Math.pow(Math.sin(Math.PI * i / m), 2);
    addPan(L, Rr, g, secs(t), env * Math.pow(R(), 1.5), (R() - 0.5) * 1.5);
    t += -Math.log(1 - R() * 0.99) / (70 + 40 * Math.sin(TAU * 1.7 * t));
  }
  return norm2(L, Rr);
}

/* soy drop: deep resonant bloop + splash with droplets (stereo) */
function bloopSplash(R) {
  const n = secs(1.2), L = new Float32Array(n), Rr = new Float32Array(n);
  const b = new Float32Array(n);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 140 + 290 * (1 - Math.exp(-t / 0.05));
    ph += f / SR; ph2 += (38 + 30 * Math.exp(-t / 0.05)) / SR;
    const at = t < 0.003 ? t / 0.003 : 1;
    b[i] = at * (Math.sin(TAU * ph) * Math.exp(-t / 0.22) + 0.8 * Math.sin(TAU * ph2) * Math.exp(-t / 0.3));
  }
  addPan(L, Rr, fadeEdges(b, 0.001, 0.05), 0, 1, 0);
  const spL = burst(R, 0.5, 'bp', 2600, 0.8, 0.09), spR = burst(R, 0.5, 'bp', 2400, 0.8, 0.09);
  addInto(L, spL, secs(0.006), 0.45); addInto(Rr, spR, secs(0.006), 0.45);
  for (let k = 0; k < 7; k++) {
    const t = 0.05 + R() * 0.4, f = 1400 + R() * 2600, m = secs(0.06), d = new Float32Array(m);
    let p = 0; for (let i = 0; i < m; i++) { const tt = i / SR; p += f * (1 + 1.5 * tt / 0.06) / SR; d[i] = Math.sin(TAU * p) * Math.exp(-tt / 0.015); }
    addPan(L, Rr, fadeEdges(d, 0.0005, 0.005), secs(t), 0.15 + 0.2 * R(), (R() - 0.5) * 1.6);
  }
  return norm2(L, Rr);
}

/* pepper mill: twisting ratchet clicks + gritty crushing */
function pepperMill(R, dur = 1.2) {
  const n = secs(dur), y = new Float32Array(n);
  const strokes = [[0, 0.55], [0.6, dur - 0.02]];
  for (const [a, b] of strokes) {
    let t = a + 0.01;
    while (t < b - 0.01) {
      const u = (t - a) / (b - a), env = Math.pow(Math.sin(Math.PI * u), 0.5);
      const g = burst(R, 0.01, 'bp', 3200 + R() * 1500, 3, 0.0015);
      addInto(y, g, secs(t), env * (0.7 + 0.3 * R()));
      addInto(y, burst(R, 0.02, 'bp', 900, 2, 0.004), secs(t), env * 0.35);
      const rate = 24 + 10 * (t / dur);
      t += (1 / rate) * (0.85 + 0.3 * R());
    }
    const grit = crackle(R, b - a, () => 350, (t) => Math.pow(Math.sin(Math.PI * t / (b - a)), 0.6) * 0.45, 3500, 9500);
    addInto(y, grit, secs(a), 1);
  }
  return fadeEdges(norm(y), 0.003, 0.02);
}

/* paper wrapping crinkle — stereo */
function paperRustle(R, dur = 0.8) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  let t = 0;
  while (t < dur - 0.01) {
    const u = t / dur, env = smooth(u / 0.08) * Math.pow(1 - u, 0.6);
    const cl = R() < 0.15 ? 4 : 1; // clusters of crinkles
    for (let c = 0; c < cl; c++) addPan(L, Rr, burst(R, 0.008, 'bp', 1500 + R() * 5000, 2, 0.0006 + R() * 0.0025), secs(t + c * 0.003), env * Math.pow(R(), 1.3), (R() - 0.5) * 1.6);
    t += -Math.log(1 - R() * 0.99) / 110;
  }
  const slide = filt(noise(n, R), 'bp', 2200, 0.6);
  for (let i = 0; i < n; i++) { const u = i / n; slide[i] *= 0.12 * Math.sin(Math.PI * u); }
  addPan(L, Rr, slide, 0, 1, 0);
  return norm2(L, Rr);
}

/* scooter passing L→R with doppler shift, distance attenuation and air absorption — stereo */
function scooter(R, dur = 1.0) {
  const n = secs(dur), L = new Float32Array(n), Rr = new Float32Array(n);
  const c = 343, v = 11, d = 3.5, tPass = dur * 0.5;
  const nz = noise(n, R);
  let ph = 0, ph2 = 0, lp = 0, lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = v * (t - tPass), r = Math.hypot(x, d), vr = x * v / r;
    const dop = c / (c + vr);
    const f0 = 82 * (1 + 0.025 * Math.sin(TAU * 1.3 * t)) * dop;
    ph += f0 / SR; ph -= Math.floor(ph); ph2 += f0 * 0.5 / SR; ph2 -= Math.floor(ph2);
    const putt = 0.7 + 0.3 * Math.sin(TAU * ph2);
    const s = tabRead(TAB_ENGINE, ph) * putt + nz[i] * 0.3 * (0.4 + 0.6 * Math.max(0, Math.sin(TAU * ph)));
    const fc = 700 + 3200 * (d / r), k = 1 - Math.exp(-TAU * fc / SR);
    lp += k * (s - lp); lp2 += k * (lp - lp2);
    const amp = (d / r) * smooth(t / 0.15) * smooth((dur - t) / 0.12);
    const pan = clamp(x / r, -1, 1) * 0.9, a = (pan + 1) * Math.PI / 4;
    L[i] = lp2 * amp * Math.cos(a); Rr[i] = lp2 * amp * Math.sin(a);
  }
  return norm2(L, Rr);
}

/* the hero bite: layered crunch, wide stereo */
function biteCrunch(R) {
  const n = secs(0.9), L = new Float32Array(n), Rr = new Float32Array(n);
  addInto(L, burst(R, 0.04, 'hp', 1500, 0.7, 0.006), 0, 0.6);
  addInto(Rr, burst(R, 0.04, 'hp', 1600, 0.7, 0.006), secs(0.0015), 0.6);
  // decorrelated L/R crust-noise layer for width
  addInto(L, burst(R, 0.35, 'bp', 2400, 0.6, 0.08), secs(0.002), 0.45);
  addInto(Rr, burst(R, 0.35, 'bp', 2700, 0.6, 0.08), secs(0.003), 0.45);
  const cluster = (t0, len, rate0, gain) => {
    let t = 0;
    while (t < len) {
      const a = gain * Math.exp(-t / (len * 0.5)) * (0.4 + 0.6 * R());
      addPan(L, Rr, burst(R, 0.014, 'bp', 700 + R() * 5800, 1.2, 0.0015 + R() * 0.006), secs(t0 + t), a, (R() - 0.5) * 1.9);
      t += -Math.log(1 - R() * 0.99) / (rate0 * Math.exp(-t / (len * 0.4)) + 30);
    }
  };
  cluster(0, 0.45, 950, 1.0);
  cluster(0.16, 0.3, 550, 0.8);   // second break of the crust
  const mid = burst(R, 0.4, 'bp', 1200, 0.8, 0.09);
  addPan(L, Rr, mid, 0, 0.6, 0);
  const th = new Float32Array(secs(0.35)); let ph = 0;
  for (let i = 0; i < th.length; i++) { const t = i / SR; ph += (48 + 55 * Math.exp(-t / 0.03)) / SR; th[i] = Math.sin(TAU * ph) * (t < 0.002 ? t / 0.002 : 1) * Math.exp(-t / 0.09); }
  addPan(L, Rr, fadeEdges(th, 0.001, 0.02), 0, 0.75, 0);
  norm2(L, Rr);
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(2 * L[i]); Rr[i] = Math.tanh(2 * Rr[i]); } // dense, saturated crunch
  fadeEdges(L, 0.0005, 0.05); fadeEdges(Rr, 0.0005, 0.05);
  return norm2(L, Rr);
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

/* low boom for the final chord */
function boom(dur = 1.4) {
  const n = secs(dur), y = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; ph += (36 + 28 * Math.exp(-t / 0.08)) / SR; y[i] = Math.sin(TAU * ph) * (t < 0.004 ? t / 0.004 : 1) * Math.exp(-t / 0.45); }
  return fadeEdges(norm(y), 0.002, 0.1);
}

// ───────────────────────────── 5. Buses ─────────────────────────────
const mkBus = () => ({ L: new Float32Array(N), R: new Float32Array(N), sL: new Float32Array(N), sR: new Float32Array(N) });
const MUSIC = mkBus(), SFX = mkBus();
const I_CUT = Math.round(CUT * SR), CUT_FADE = secs(0.010);

/* put(bus, t0, sig, {gain, pan, rev, right})
 * - mono sig + pan (number or fn(localSec)) or stereo via `right`
 * - anything starting before 28.0 s is hard-truncated at 28.0 s with a 10 ms fade (the silence gap) */
function put(bus, t0, sig, o = {}) {
  const gain = o.gain ?? 1, pan = o.pan ?? 0, rev = o.rev ?? 0, right = o.right || null;
  const i0 = Math.round(t0 * SR), len = sig.length;
  const cutI = t0 < CUT ? I_CUT : N, cutF = cutI - CUT_FADE;
  const edge = Math.min(16, len >> 2);   // 0.33 ms safety ramp (generators shape their own attacks)
  const panFn = typeof pan === 'function';
  let gl = 1, gr = 1;
  if (!right && !panFn) { const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4; gl = Math.cos(a); gr = Math.sin(a); }
  for (let k = 0; k < len; k++) {
    const i = i0 + k;
    if (i < 0) continue;
    if (i >= cutI || i >= N) break;
    let g = gain;
    if (k < edge) g *= k / edge; else if (k > len - edge) g *= (len - k) / edge;
    if (i >= cutF) g *= (cutI - i) / CUT_FADE;
    let l, r;
    if (right) { l = sig[k] * g; r = right[k] * g; }
    else {
      if (panFn) { const a = (clamp(pan(k / SR), -1, 1) + 1) * Math.PI / 4; gl = Math.cos(a); gr = Math.sin(a); }
      l = sig[k] * g * gl; r = sig[k] * g * gr;
    }
    bus.L[i] += l; bus.R[i] += r;
    if (rev) { bus.sL[i] += l * rev; bus.sR[i] += r * rev; }
  }
}
const put2 = (bus, t0, [L, R], o = {}) => put(bus, t0, L, { ...o, right: R });

// ───────────────────────────── 6. Score ─────────────────────────────
console.time('render');
const SCALE = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86]; // D F G A C (D pentatonic) D4..D6
const fifthOf = (m) => ([0, 2, 5, 7, 9].includes((m + 7) % 12) ? m + 7 : m + 5);
// kick sidechain-style pump for Act II pad
const pumpAt = (tAbs) => {
  const tb = ((tAbs % BEAT) + BEAT) % BEAT;
  const d = tb < 0.008 ? smooth(tb / 0.008) : Math.exp(-(tb - 0.008) / 0.11);   // smooth dip, no step
  return 1 - 0.38 * d;
};

function lead(t, midi, dur, o = {}) {
  put(MUSIC, t, danBau(midi, dur, o), { gain: o.gain ?? 0.2, pan: o.pan ?? -0.08, rev: o.rev ?? 0.42 });
}
function tranhNote(t, midi, dur, gain, pan, seed, rev = 0.45) {
  put(MUSIC, t, tranh(midi, dur, rngFor('tr' + seed + t), {}), { gain, pan, rev });
}

// ---------- ACT I : Dawn (0–8) ----------
{
  const R = rngFor('actI');
  // faint warm fire-crackle bed 0–4.2, louder oven fire 4.0–6.2
  put2(SFX, 0.0, fireBed(rngFor('fire1'), 4.4, 6), { gain: 0.07, rev: 0.15 });
  put2(SFX, 3.9, fireBed(rngFor('fire2'), 2.4, 22), { gain: 0.26, rev: 0.2 });
  // crust cracking 0.3 / 0.9 / 1.5, growing
  [[0.3, 0.3, -0.3], [0.9, 0.7, 0.25], [1.5, 0.68, 0.0]].forEach(([t, g, p], k) => put(SFX, t, crustCrack(rngFor('crust' + k)), { gain: g, pan: p, rev: 0.3 }));

  // music enters at 2.0
  put(MUSIC, 2.0, drone(5.7, { attack: 1.6, release: 0.3 }), { gain: 0.12, rev: 0.15 });
  put2(MUSIC, 2.0, pad([50, 57, 62, 65], 4.1, { attack: 1.8, release: 0.7, cutoff: 900 }), { gain: 0.075, rev: 0.35 });
  put2(MUSIC, 6.0, pad([53, 57, 60, 65], 1.75, { attack: 0.6, release: 0.25, cutoff: 1100 }), { gain: 0.075, rev: 0.35 });
  tranhNote(2.0, 50, 2.5, 0.12, -0.3, 'a');
  tranhNote(2.0, 62, 2.5, 0.06, 0.3, 'b');
  // rooster, distant
  put(SFX, 2.55, rooster(rngFor('rooster')), { gain: 0.045, pan: 0.55, rev: 0.7 });

  // đàn bầu: slow bending phrase
  lead(2.05, 69, 1.35, { bendFrom: -2, bendTime: 0.45, vibDepth: 0.35, attack: 0.12, gain: 0.17 });
  lead(3.5, 72, 0.45, { bendFrom: -1, bendTime: 0.12, gain: 0.15 });
  lead(4.0, 69, 0.95, { bendFrom: 3, bendTime: 0.28, vibDepth: 0.3, gain: 0.16 });
  lead(5.0, 67, 0.45, { bendFrom: -2, bendTime: 0.14, gain: 0.15 });
  lead(5.5, 65, 0.45, { bendFrom: 2, bendTime: 0.16, gain: 0.15 });
  lead(6.0, 62, 1.75, { bendFrom: -2, bendTime: 0.5, vibDepth: 0.45, endBend: -1, endBendTime: 0.4, attack: 0.1, gain: 0.17 });
  // đàn tranh roll in the oven scene
  [62, 69, 74, 77].forEach((m, k) => tranhNote(4.0 + k * 0.075, m, 1.6, 0.07, -0.5 + k * 0.33, 'roll4' + k));

  // tray slides out
  put(SFX, 4.15, whoosh(rngFor('tray'), 0.6, 250, 1600, 400, 0.4, 1.0), { gain: 0.6, pan: (t) => -0.5 + t * 1.6, rev: 0.2 });
  // knife sawing 6.2–7.4 then crack at 7.4
  put(SFX, 6.2, knifeScrape(rngFor('knife')), { gain: 0.55, pan: 0.1, rev: 0.12 });
  put2(SFX, 7.4, bigCrack(rngFor('crack74')), { gain: 0.85, rev: 0.25 });
  // riser into 8.0 (ends exactly at the downbeat)
  put(MUSIC, 7.0, riser(R, 1.0), { gain: 0.22, pan: (t) => 0.3 * Math.sin(TAU * 1.5 * t), rev: 0.3 });
}

// ---------- ACT II : The ritual (8–26) ----------
{
  const R = rngFor('actII');
  const bars = [8, 10, 12, 14, 16, 18, 20, 22, 24];
  const roots = [38, 41, 36, 38, 38, 41, 43, 45, 38];
  const voicing = { 38: [50, 57, 62, 65], 41: [53, 60, 65, 69], 36: [48, 55, 60, 65], 43: [55, 62, 67, 72], 45: [57, 62, 67, 69] };
  const DROP0 = 23.5, DROP1 = 25.0;
  const inDrop = (t) => t >= DROP0 - 1e-6 && t < DROP1 - 1e-6;

  // pad per bar (pumped), filtered during the drop
  bars.forEach((T, b) => {
    const ch = voicing[roots[b]];
    if (b < 7) put2(MUSIC, T, pad(ch, BAR - 0.05, { attack: 0.08, release: 0.2, cutoff: 1700, pump: (t) => pumpAt(T + t) }), { gain: 0.07, rev: 0.25 });
    else if (b === 7) {
      put2(MUSIC, T, pad(ch, 1.45, { attack: 0.08, release: 0.1, cutoff: 1700, pump: (t) => pumpAt(T + t) }), { gain: 0.07, rev: 0.25 });
      put2(MUSIC, 23.5, pad([57, 62, 67], 1.45, { attack: 0.3, release: 0.15, cutoff: 500 }), { gain: 0.08, rev: 0.4 });
    } else {
      put2(MUSIC, 25.0, pad(ch, 0.97, { attack: 0.5, release: 0.05, cutoff: 2200, pump: (t) => pumpAt(25 + t) }), { gain: 0.075, rev: 0.3 });
    }
  });

  // drums
  const K = kick(), KF = norm(filt(filt(kick({ decay: 0.32 }), 'lp', 260, 0.7), 'lp', 300, 0.7));
  for (let t = 8.0; t < 26.0 - 1e-6; t += BEAT) {
    if (inDrop(t)) put(MUSIC, t, KF, { gain: 0.4, rev: 0.08 });
    else put(MUSIC, t, K, { gain: 0.5, rev: 0.03 });
  }
  for (let t = 8.0; t < DROP0 - 1e-6; t += BEAT) {
    const beatInBar = Math.round((t - 8) / BEAT) % 4;
    if (beatInBar === 1 || beatInBar === 3) put(MUSIC, t, clap(rngFor('clap' + t)), { gain: 0.2, pan: 0.05, rev: 0.22 });
  }
  for (let t = 8.0; t < DROP0 - 1e-6; t += BEAT / 2) {
    const off = Math.round((t - 8) / (BEAT / 2)) % 2 === 1;
    put(MUSIC, t, hat(rngFor('hat' + t), off ? 0.04 : 0.025), { gain: off ? 0.065 : 0.04, pan: 0.3, rev: 0.05 });
  }
  // build 25.0–26.0: 16th hats + snare roll crescendo
  for (let k = 0; k < 8; k++) { const t = 25.0 + k * 0.125; put(MUSIC, t, hat(rngFor('hb' + k), 0.025), { gain: 0.04 + 0.004 * k, pan: 0.3, rev: 0.05 }); }
  [[25.0, 0.1], [25.25, 0.12], [25.5, 0.14], [25.625, 0.15], [25.75, 0.17], [25.875, 0.19]].forEach(([t, g], k) =>
    put(MUSIC, t, clap(rngFor('roll' + k)), { gain: g, pan: (k % 2 ? 0.15 : -0.15), rev: 0.25 }));
  put(MUSIC, 25.0, riser(rngFor('riser2'), 1.0, 400, 9000), { gain: 0.15, rev: 0.3 });

  // bass
  const pat = [[0, 0, 0.22], [0.75, 0, 0.18], [1.0, 'f', 0.22], [1.5, 12, 0.12], [1.75, 'f', 0.2]];
  bars.forEach((T, b) => {
    const root = roots[b];
    for (const [off, iv, d] of pat) {
      const t = T + off;
      if (t >= DROP0 - 1e-6 && t < DROP1 - 1e-6) continue;
      const m = iv === 'f' ? fifthOf(root) : root + iv;
      put(MUSIC, t, bassNote(m, d), { gain: 0.3 });
    }
  });

  // cut accents (subtle tick or tom on each visual cut)
  put2(MUSIC, 8.0, crash(rngFor('c8'), 1.4), { gain: 0.07, rev: 0.25 });
  [[9.5, 'tick'], [11.0, 'tom'], [12.5, 'tick'], [14.0, 'tom'], [15.5, 'tick'], [17.0, 'tom'], [18.5, 'tick'], [20.5, 'tick'], [22.0, 'tom']].forEach(([t, k], i) => {
    if (k === 'tick') put(MUSIC, t, tick(rngFor('tk' + i)), { gain: 0.07, pan: i % 2 ? 0.45 : -0.45, rev: 0.3 });
    else put(MUSIC, t, tom(i % 2 ? 98 : 123), { gain: 0.16, pan: i % 2 ? -0.3 : 0.3, rev: 0.2 });
  });
  put(MUSIC, 23.5, tom(65, 0.45), { gain: 0.22, rev: 0.35 });

  // đàn bầu rhythmic motifs  [time, midi, dur, bendFrom, extra]
  const motifs = [
    [9.0, 69, 0.22, -2], [9.25, 72, 0.22, 0], [9.5, 74, 0.45, -2, { vibDepth: 0.3 }],
    [11.0, 72, 0.22, 0], [11.25, 69, 0.22, 0], [11.5, 67, 0.45, 2],
    [13.0, 67, 0.22, -2], [13.25, 69, 0.22, 0], [13.5, 72, 0.45, -1],
    [15.0, 74, 0.45, -2], [15.5, 72, 0.22, 0], [15.75, 69, 0.22, 0],
    [16.0, 69, 0.95, -2, { bendTime: 0.25, vibDepth: 0.4 }], [17.0, 74, 0.45, -2], [17.5, 72, 0.45, 2],
    [19.0, 77, 0.45, -3], [19.5, 74, 0.45, 0, { endBend: -1 }],
    [21.0, 72, 0.22, 0], [21.25, 74, 0.22, 0], [21.5, 77, 0.45, -2],
    [22.5, 79, 0.22, -2], [22.75, 77, 0.22, 0], [23.0, 74, 0.45, 0, { endBend: -3, endBendTime: 0.3 }],
    [23.6, 81, 1.15, -5, { bendTime: 0.7, vibDepth: 0.5, attack: 0.25, gain: 0.12, rev: 0.6 }],
    [25.0, 74, 0.22, 0], [25.25, 77, 0.22, 0], [25.5, 79, 0.22, 0], [25.75, 81, 0.22, -1],
  ];
  for (const [t, m, d, bf, ex] of motifs) lead(t, m, d, { bendFrom: bf, gain: 0.17, ...(ex || {}) });

  // đàn tranh ostinato (8ths) in bars 5–8, quiet, right side
  const patIdx = [0, 2, 4, 2, 5, 4, 2, 3];
  bars.slice(4, 8).forEach((T, bb) => {
    const root = roots[bb + 4];
    const base = SCALE.findIndex((m) => m % 12 === root % 12);
    patIdx.forEach((pi, k) => {
      const t = T + k * 0.25; if (t >= DROP0 - 1e-6) return;
      tranhNote(t, SCALE[Math.min(SCALE.length - 1, base + pi)], 0.6, 0.05, 0.55, 'os' + bb + k, 0.35);
    });
  });

  // ---- ingredient SFX ----
  put(SFX, 8.1, squish(rngFor('butter'), 1.1), { gain: 0.95, pan: (t) => -0.2 + 0.4 * Math.sin(TAU * 0.9 * t), rev: 0.1 });
  put(SFX, 9.6, smear(rngFor('pate'), 1.2), { gain: 0.6, pan: (t) => -0.35 + 0.6 * t, rev: 0.12 });
  put(SFX, 11.0, whoosh(rngFor('pork1'), 0.5, 300, 2400, 600, 0.5), { gain: 0.9, pan: (t) => -0.7 + 2.4 * t, rev: 0.25 });
  put(SFX, 11.5, whoosh(rngFor('pork2'), 0.5, 350, 2800, 500, 0.45), { gain: 0.85, pan: (t) => 0.6 - 2.2 * t, rev: 0.25 });
  put(SFX, 12.1, plop(rngFor('plop1'), 230, 85, 0.25), { gain: 0.55, pan: 0.05, rev: 0.15 });
  put(SFX, 12.8, plop(rngFor('plop2'), 260, 95, 0.22), { gain: 0.45, pan: -0.25, rev: 0.15 });
  put(SFX, 13.1, plop(rngFor('plop3'), 245, 90, 0.22), { gain: 0.45, pan: 0.25, rev: 0.15 });
  put(SFX, 13.6, plop(rngFor('plop4'), 150, 52, 0.55), { gain: 0.85, pan: 0, rev: 0.35 });
  put(SFX, 14.3, chop(rngFor('chop1')), { gain: 0.62, pan: -0.1, rev: 0.18 });
  put(SFX, 14.8, chop(rngFor('chop2')), { gain: 0.65, pan: 0.1, rev: 0.18 });
  put2(SFX, 15.6, pourSizzle(rngFor('sauce'), 1.3), { gain: 0.7, rev: 0.12 });
  put(SFX, 17.3, cucumberSnap(rngFor('cuc')), { gain: 1.5, pan: 0, rev: 0.22 });
  put(SFX, 18.1, whoosh(rngFor('whip'), 0.3, 500, 4500, 1200, 0.5, 1.4), { gain: 0.55, pan: (t) => -0.9 + 6 * t, rev: 0.2 });
  put2(SFX, 19.2, rustleCrunch(rngFor('pickle')), { gain: 1.1, rev: 0.15 });
  { const r = rngFor('brine'); const notes = [98, 93, 101, 96, 105, 100, 103, 110].map((m) => m2f(m)); // D7-ish pentatonic pings
    notes.forEach((f, k) => put(SFX, 19.22 + k * 0.1 + r() * 0.03, ting(f, 0.4), { gain: 0.13 + 0.06 * r(), pan: (r() - 0.5) * 1.6, rev: 0.45 })); }
  put2(SFX, 20.6, leafRustle(rngFor('herbs'), 1.2), { gain: 0.7, rev: 0.25 });
  [[22.2, 98, -0.4], [22.6, 101, 0.4], [23.0, 105, 0]].forEach(([t, m, p]) => {
    put(SFX, t, ting(m2f(m), 0.6), { gain: 0.21, pan: p, rev: 0.45 });
    put(SFX, t, ting(m2f(m + 12) * 1.003, 0.25), { gain: 0.05, pan: -p, rev: 0.45 });
  });
  // soy drop: falling, landing at 24.4, then pepper mill
  put(SFX, 24.0, whoosh(rngFor('fall'), 0.4, 2800, 2000, 700, 0.6, 3), { gain: 0.1, pan: 0, rev: 0.3 });
  put2(SFX, 24.4, bloopSplash(rngFor('soy')), { gain: 0.62, rev: 0.45 });
  put(SFX, 24.8, pepperMill(rngFor('pepper'), 1.2), { gain: 1.3, pan: 0.15, rev: 0.12 });
}

// ---------- ACT III : Climax (26–30) ----------
{
  // biggest moment 26–28
  put2(MUSIC, 26.0, crash(rngFor('crash26'), 2.4), { gain: 0.2, rev: 0.35 });
  put(MUSIC, 26.0, kick({ decay: 0.4 }), { gain: 0.62, rev: 0.05 });
  const K = kick();
  for (let t = 26.5; t < 28.0 - 1e-6; t += BEAT) put(MUSIC, t, K, { gain: 0.52, rev: 0.03 });
  [26.5, 27.5].forEach((t) => put(MUSIC, t, clap(rngFor('cl3' + t)), { gain: 0.21, rev: 0.25 }));
  for (let t = 26.0; t < 28.0 - 1e-6; t += 0.25) put(MUSIC, t, hat(rngFor('h3' + t), 0.035), { gain: 0.06, pan: 0.3, rev: 0.05 });
  for (let t = 26.0; t < 28.0 - 1e-6; t += 0.25) put(MUSIC, t, bassNote(Math.round((t - 26) / 0.25) % 2 ? 50 : 38, 0.2), { gain: 0.3 });
  put2(MUSIC, 26.0, pad([50, 57, 60, 65, 69, 74], 2.2, { attack: 0.05, release: 0.1, cutoff: 3200, detune: 9 }), { gain: 0.13, rev: 0.4 });
  put(MUSIC, 26.0, drone(2.2, { attack: 0.05, release: 0.1 }), { gain: 0.12, rev: 0.1 });
  // đàn tranh upward glissando
  [62, 65, 67, 69, 72, 74, 77, 79, 81, 86].forEach((m, k) => tranhNote(26.0 + k * 0.03, m, 1.5, 0.05 + k * 0.004, -0.6 + k * 0.13, 'gl' + k, 0.5));
  // đàn bầu soaring
  lead(26.0, 81, 0.95, { bendFrom: -2, bendTime: 0.3, vibDepth: 0.45, gain: 0.2, rev: 0.5 });
  lead(27.0, 84, 0.45, { bendFrom: -2, gain: 0.18, rev: 0.5 });
  lead(27.5, 86, 0.6, { bendFrom: -2, vibDepth: 0.5, gain: 0.18, rev: 0.5 });

  put2(SFX, 26.0, paperRustle(rngFor('paper'), 0.8), { gain: 1.3, rev: 0.15 });
  put2(SFX, 27.0, scooter(rngFor('scooter'), 1.0), { gain: 0.65, rev: 0.12 });

  // 28.0–28.5 : silence (enforced by put() truncation + master gate)

  // 28.5 the bite — loudest SFX
  put2(SFX, RESUME, biteCrunch(rngFor('bite')), { gain: 1.5, rev: 0.22 });

  // 28.6 final ringing chord
  lead(28.6, 74, 1.25, { bendFrom: -7, bendTime: 0.55, vibDepth: 0.5, attack: 0.08, release: 0.15, gain: 0.22, rev: 0.6 });
  lead(28.6, 62, 1.25, { bendFrom: -7, bendTime: 0.55, vibDepth: 0.3, attack: 0.08, release: 0.15, gain: 0.08, rev: 0.6, pan: 0.2 });
  put2(MUSIC, 28.6, pad([50, 57, 62, 67, 69], 1.25, { attack: 0.12, release: 0.15, cutoff: 2000, detune: 8 }), { gain: 0.13, rev: 0.5 });
  put(MUSIC, 28.6, boom(1.4), { gain: 0.38, rev: 0.15 });
  [50, 57, 62, 69, 74].forEach((m, k) => tranhNote(28.6 + k * 0.045, m, 1.4, 0.06, -0.4 + k * 0.2, 'fin' + k, 0.55));
}

// ───────────────────────────── 7. Master ─────────────────────────────

// (a) duck the music under the SFX so ingredients read clearly
const duck = new Float32Array(N);
{
  let e = 0; const at = 1 - Math.exp(-1 / (0.005 * SR)), rl = 1 - Math.exp(-1 / (0.25 * SR));
  for (let i = 0; i < N; i++) {
    const a = Math.max(Math.abs(SFX.L[i]), Math.abs(SFX.R[i]));
    e += (a > e ? at : rl) * (a - e);
    duck[i] = 1 - 0.38 * clamp(e / 0.25, 0, 1);
  }
  // per-act music trim (quiet dawn, energetic ritual, full climax); 20 ms ramps ending on the cut
  const trim = (t) => pw([[0, 0.78], [7.98, 0.78], [8.0, 0.88], [25.98, 0.88], [26.0, 1.0], [30, 1.0]], t);
  for (let i = 0; i < N; i++) duck[i] *= trim(i / SR);
}

// (b) stereo Freeverb-style reverb (8 damped combs + 4 allpasses per side, pre-delay)
function reverb(inL, inR, clearAt) {
  const sc = SR / 44100, spread = 23;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apT = [556, 441, 341, 225];
  const fb = 0.85, damp = 0.28, apfb = 0.5;
  const mkC = (len) => ({ buf: new Float32Array(Math.round(len * sc)), i: 0, st: 0 });
  const cl = combT.map((t) => mkC(t)), cr = combT.map((t) => mkC(t + spread));
  const al = apT.map((t) => mkC(t)), ar = apT.map((t) => mkC(t + spread));
  const pre = new Float32Array(secs(0.022)); let pi = 0;
  const outL = new Float32Array(N), outR = new Float32Array(N);
  // pre-filter: tame lows and highs going into the tank
  const fl = filt(filt(inL, 'hp', 180, 0.7), 'lp', 7500, 0.7), fr = filt(filt(inR, 'hp', 180, 0.7), 'lp', 7500, 0.7);
  const all = [...cl, ...cr, ...al, ...ar];
  for (let n = 0; n < N; n++) {
    if (n === clearAt) { for (const c of all) { c.buf.fill(0); c.st = 0; } pre.fill(0); }
    const x = pre[pi]; pre[pi] = (fl[n] + fr[n]) * 0.5 * 0.03; pi = (pi + 1) % pre.length;
    let l = 0, r = 0;
    for (const c of cl) { const o = c.buf[c.i]; c.st = o * (1 - damp) + c.st * damp; c.buf[c.i] = x + c.st * fb; c.i = (c.i + 1) % c.buf.length; l += o; }
    for (const c of cr) { const o = c.buf[c.i]; c.st = o * (1 - damp) + c.st * damp; c.buf[c.i] = x + c.st * fb; c.i = (c.i + 1) % c.buf.length; r += o; }
    for (const a of al) { const b = a.buf[a.i]; const o = -l + b; a.buf[a.i] = l + b * apfb; a.i = (a.i + 1) % a.buf.length; l = o; }
    for (const a of ar) { const b = a.buf[a.i]; const o = -r + b; a.buf[a.i] = r + b * apfb; a.i = (a.i + 1) % a.buf.length; r = o; }
    outL[n] = l; outR[n] = r;
  }
  return [outL, outR];
}
const sendL = new Float32Array(N), sendR = new Float32Array(N);
for (let i = 0; i < N; i++) { sendL[i] = MUSIC.sL[i] * duck[i] + SFX.sL[i]; sendR[i] = MUSIC.sR[i] * duck[i] + SFX.sR[i]; }
const [wetL, wetR] = reverb(sendL, sendR, I_CUT);
const WET = 1.0;

// (c) sum, gentle music-bus saturation, DC/sub high-pass
let mL = new Float32Array(N), mR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const ml = Math.tanh(MUSIC.L[i] * duck[i] * 1.1) / 1.1, mr = Math.tanh(MUSIC.R[i] * duck[i] * 1.1) / 1.1;
  mL[i] = ml + SFX.L[i] + wetL[i] * WET;
  mR[i] = mr + SFX.R[i] + wetR[i] * WET;
}
mL = filt(mL, 'hp', 24, 0.7); mR = filt(mR, 'hp', 24, 0.7);

// (d) look-ahead TRUE-PEAK limiter (4x oversampled peak estimate, ceiling -1.6 dBTP), then silence gate + fade
// tp[i] = max |signal| on [i, i+1) for both channels, using 4x windowed-sinc interpolation
function truePeak(L, R) {
  const T = 16, OS = 4, taps = [];
  for (let k = 1; k < OS; k++) {
    const fr = k / OS, h = new Float64Array(2 * T);
    for (let j = -T + 1; j <= T; j++) { const x = j - fr, w = 0.5 + 0.5 * Math.cos(Math.PI * x / T); h[j + T - 1] = (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w; }
    taps.push(h);
  }
  const tp = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (p > 0.25 && i >= T && i + T < N) {
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
const CEIL = Math.pow(10, -1.6 / 20);   // 0.6 dB margin below -1 dBTP
const LIMG = new Float32Array(N); // limiter gain (for the debug report)
{
  const LA = secs(0.004), rel = 1 - Math.exp(-1 / (0.12 * SR));
  const req = new Float32Array(N), tp = truePeak(mL, mR);
  for (let i = 0; i < N; i++) { const p = Math.max(tp[i], i > 0 ? tp[i - 1] : 0); req[i] = p > CEIL ? CEIL / p : 1; }
  // look-ahead minimum over [i, i+LA] using a monotone deque
  const h = new Float32Array(N); const dq = new Int32Array(N); let qh = 0, qt = 0;
  for (let j = N - 1; j >= 0; j--) {
    while (qt > qh && req[dq[qt - 1]] >= req[j]) qt--;
    dq[qt++] = j;
    while (dq[qh] > j + LA) qh++;
    h[j] = req[dq[qh]];
  }
  // instant attack (already look-ahead), smooth release
  const r = new Float32Array(N); let g = 1;
  for (let i = 0; i < N; i++) { g = Math.min(h[i], g + (1 - g) * rel); r[i] = g; }
  // moving average over LA+1 samples -> smooth gain that still never exceeds the requirement
  let sum = 0; const W = LA + 1;
  for (let i = 0; i < N; i++) {
    sum += r[i]; if (i >= W) sum -= r[i - W];
    const gs = i >= W - 1 ? sum / W : Math.min(1, sum / (i + 1));
    mL[i] *= gs; mR[i] *= gs; LIMG[i] = gs;
  }
}
const I_RES = Math.round(RESUME * SR), FADE0 = 29.15;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let g = 1;
  if (i >= I_CUT - CUT_FADE && i < I_CUT) g = (I_CUT - i) / CUT_FADE;
  else if (i >= I_CUT && i < I_RES) g = 0;
  if (t > FADE0) g *= Math.pow(0.5 + 0.5 * Math.cos(Math.PI * clamp((t - FADE0) / (DUR - FADE0), 0, 1)), 1.5);
  mL[i] *= g; mR[i] *= g;
}
// safety: guarantee true peak ≤ -1.5 dBFS after everything
{
  const tp = truePeak(mL, mR); let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, tp[i]);
  console.log('true-peak estimate', (20 * Math.log10(pk)).toFixed(2), 'dBTP');
  const lim = Math.pow(10, -1.5 / 20);
  if (pk > lim) { const g = lim / pk; for (let i = 0; i < N; i++) { mL[i] *= g; mR[i] *= g; } }
}
console.timeEnd('render');

// (e) WAV writer (RIFF / PCM 16-bit / 2ch / 48 kHz)
function writeWav(file, L, R) {
  const dataLen = N * 4, buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0, 'ascii'); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii'); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii'); buf.writeUInt32LE(dataLen, 40);
  let o = 44;
  for (let i = 0; i < N; i++) {
    buf.writeInt16LE(clamp(Math.round(L[i] * 32767), -32768, 32767), o); o += 2;
    buf.writeInt16LE(clamp(Math.round(R[i] * 32767), -32768, 32767), o); o += 2;
  }
  fs.writeFileSync(file, buf);
}
const OUT = path.join(__dirname, 'audio.wav');
writeWav(OUT, mL, mR);

// (f) report
const dbfs = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) : '-inf');
function stats(t0, t1) {
  const a = Math.round(t0 * SR), b = Math.min(N, Math.round(t1 * SR));
  let pk = 0, ss = 0;
  for (let i = a; i < b; i++) { pk = Math.max(pk, Math.abs(mL[i]), Math.abs(mR[i])); ss += mL[i] * mL[i] + mR[i] * mR[i]; }
  return { peak: dbfs(pk), rms: dbfs(Math.sqrt(ss / (2 * Math.max(1, b - a)))) };
}
console.log('wrote', OUT, `(${DUR}s, ${SR} Hz, stereo, 16-bit)`);
for (const [name, a, b] of [['whole', 0, 30], ['Act I   0-8', 0, 8], ['  intro 0-2', 0, 2], ['  2-8', 2, 8], ['Act II  8-26', 8, 26], ['  drop 23.5-24.8', 23.5, 24.8], ['Act III 26-28', 26, 28], ['gap 28.0-28.5', 28.0, 28.5], ['bite 28.5-28.9', 28.5, 28.9], ['final 28.6-30', 28.6, 30]]) {
  const s = stats(a, b); console.log(name.padEnd(18), 'peak', s.peak.padStart(6), 'dBFS   rms', s.rms.padStart(6), 'dBFS');
}
// optional: per-cue balance of SFX vs (ducked) music, pre-limiter  (set DEBUG=1)
if (process.env.DEBUG) {
  for (const [a, b] of [[0, 8], [8, 23.5], [23.5, 26], [26, 28], [28.5, 30]]) { let mn = 1, cnt = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) { mn = Math.min(mn, LIMG[i]); if (LIMG[i] < 0.71) cnt++; } console.log('limiter', a, b, 'max GR', (20 * Math.log10(mn)).toFixed(1), 'dB, time >3dB GR', (cnt / SR).toFixed(2), 's'); }
  // rough loudness weighting (cut lows, lift presence) so bass-heavy music isn't over-counted
  const KW = (x) => filt(filt(x, 'hp', 120, 0.5), 'peak', 3500, 0.6, 4);
  const muL = new Float32Array(N), muR = new Float32Array(N);
  for (let i = 0; i < N; i++) { muL[i] = MUSIC.L[i] * duck[i]; muR[i] = MUSIC.R[i] * duck[i]; }
  const sKL = KW(SFX.L), sKR = KW(SFX.R), mKL = KW(muL), mKR = KW(muR);
  const rmsOf = (fnL, fnR, a, b) => { let ss = 0; for (let i = a; i < b; i++) { const l = fnL(i), r = fnR(i); ss += l * l + r * r; } return Math.sqrt(ss / (2 * (b - a))); };
  const cues = [[0.3, 0.5], [0.9, 1.1], [1.5, 1.7], [2.5, 3.5], [4.2, 4.8], [4.0, 6.0], [6.2, 7.4], [7.4, 7.6], [7.0, 8.0], [8.1, 9.2], [9.6, 10.8], [11.0, 12.0], [12.1, 12.3], [12.8, 13.0], [13.6, 14.0], [14.3, 14.5], [15.6, 16.9], [17.3, 17.5], [18.1, 18.4], [19.2, 20.0], [20.6, 21.8], [22.2, 22.4], [24.4, 24.8], [24.8, 26.0], [26.0, 26.8], [27.0, 28.0], [28.5, 28.9]];
  for (const [a, b] of cues) {
    const ia = Math.round(a * SR), ib = Math.round(b * SR);
    const s = rmsOf((i) => sKL[i], (i) => sKR[i], ia, ib), m = rmsOf((i) => mKL[i], (i) => mKR[i], ia, ib), w = rmsOf((i) => wetL[i], (i) => wetR[i], ia, ib);
    console.log(`${a.toFixed(1)}-${b.toFixed(1)}`.padEnd(11), 'sfx', dbfs(s).padStart(6), ' music', dbfs(m).padStart(6), ' wet', dbfs(w).padStart(6), ' sfx-music', (20 * Math.log10(s / m)).toFixed(1));
  }
}
