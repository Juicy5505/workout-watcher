// Regression tests for detector.js on simulated rep signals. Run: node app/tests/test-detector.mjs
// Robustness across noise patterns: SEED=70 node app/tests/test-detector.mjs (any seed; 7 is the reference run).
// Mirrors the page: time-based EMA (alpha = min(0.75, 1 - exp(-dt / 48 ms)), so 0.5 at 30 fps), full reps only
// (ampFrac 0.6), pushups anchored at the top with getUpFirst and an undo limit, situps anchored at the bottom.
// The page forgets the learned depth (rest()) only when the person's size on camera changes; that has no
// equivalent in a 1-D signal, so these tests never call it.
import { createDetector, feed } from "../detector.js";

let seed = Number(process.env.SEED || 7);
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
let failures = 0;

// Signal paths are lists of segments [seconds, target]: the value eases (smoothstep) from where it is to target.
// Pushups: 0 is the top (arms locked) and the bottom is negative. Situps: 0 is lying down and sitting up is positive.
const pushRep = (period, depth) => [[period / 2, -depth], [period / 2, 0]];
const sitRep = (period, height) => [[period / 2, height], [period / 2, 0]];
const hold = (s, v = 0) => [[s, v]];

// expect: exact count or [min, max]. opts: floor, exercise ("push" | "sit"), fps, noise, undoFirstAbove, start.
function sim(name, segs, { floor, exercise = "push", fps = 30, noise = 0.006, undoFirstAbove, start = 0, expect }) {
  const d = createDetector(), push = exercise === "push";
  const opts = push ? { anchor: "top", getUpFirst: true, undoFirstAbove: undoFirstAbove ?? 4 * floor, ampFrac: 0.6 } : { anchor: "bottom", ampFrac: 0.6 };
  const a = Math.min(0.75, 1 - Math.exp(-(1000 / fps) / 48));
  let ema = null, count = 0, v = start;
  const step = x => {
    const y = x + gauss() * noise;
    ema = ema == null ? y : ema * (1 - a) + y * a;
    const ev = feed(d, ema, floor, opts);
    if (ev === "rep") count++;
    if (ev === "undo") count--;
  };
  for (let i = 0; i < fps; i++) step(v);
  for (const [s, target] of segs) {
    const n = Math.max(1, Math.round(s * fps)), from = v;
    for (let i = 1; i <= n; i++) { const k = i / n; step(from + (target - from) * k * k * (3 - 2 * k)); }
    v = target;
  }
  for (let i = 0; i < fps; i++) step(v);
  const [lo, hi] = Array.isArray(expect) ? expect : [expect, expect];
  const ok = count >= lo && count <= hi;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: expected ${lo === hi ? lo : `${lo}–${hi}`}, counted ${count}`);
}

const reps = (n, f) => Array.from({ length: n }, (_, i) => f(i)).flat();
const P = { floor: 0.07 };

// --- Basic pushups and situps ---
sim("pushups steady", reps(30, () => pushRep(1.2, 0.14)), { ...P, noise: 0.012, expect: 30 });
sim("pushups fast", reps(30, () => pushRep(0.6, 0.12)), { ...P, noise: 0.012, expect: 30 });
sim("pushups fatiguing (depth 0.16 -> 0.07)", reps(40, i => pushRep(1 + i * 0.03, 0.16 - i * 0.0023)), { ...P, noise: 0.012, expect: 40 });
sim("pushups varied speed and depth", reps(25, () => pushRep(0.7 + rand() * 1.8, 0.1 + rand() * 0.06)), { ...P, noise: 0.012, expect: 25 });
sim("pushups with 0.8 s pauses at the top, noisy", reps(20, () => [...pushRep(1.1, 0.13), ...hold(0.8)]), { ...P, noise: 0.02, expect: 20 });
sim("situps steady", reps(30, () => sitRep(1.8, 0.3)), { floor: 0.1, exercise: "sit", noise: 0.012, expect: 30 });
sim("situps fast, shallow", reps(30, () => sitRep(1.0, 0.18)), { floor: 0.1, exercise: "sit", noise: 0.012, expect: 30 });

// --- Standing up after a set ---
sim("stand up straight from the top", [...reps(25, () => pushRep(1, 0.13)), ...hold(2, 0.6)], { ...P, expect: 25 });
sim("knees dip, then stand up", [...reps(25, () => pushRep(1, 0.13)), ...hold(0.3, -0.05), ...hold(0.3, 0), ...hold(2, 0.6)], { ...P, expect: 25 });
sim("1 rep, then stand up", [...pushRep(1.2, 0.14), ...hold(2, 0.6)], { ...P, expect: 1 });

// --- Lower detection frame rates ---
for (const fps of [15, 12]) {
  sim(`pushups fast @${fps} fps`, reps(30, () => pushRep(0.6, 0.12)), { ...P, noise: 0.012, fps, expect: 30 });
  // The last reps are only ~1.1x the minimum depth; at 12 fps with this much jitter one of them can fall short.
  sim(`pushups fatiguing @${fps} fps`, reps(40, i => pushRep(1 + i * 0.03, 0.16 - i * 0.0023)), { ...P, noise: 0.012, fps, expect: fps >= 15 ? 40 : [39, 40] });
}

// --- Starting at the bottom (tracking starts or restarts while someone lies on the floor) ---
const B = { floor: 0.05 };
sim("start at bottom, deep reps (depth 0.25)", [...hold(2, -0.25), ...hold(1, 0), ...reps(20, () => pushRep(1.2, 0.25))], { ...B, start: -0.25, expect: 20 });
sim("start at bottom, normal reps (depth 0.15, under the undo limit)", [...hold(2, -0.15), ...hold(1, 0), ...reps(20, () => pushRep(1.2, 0.15))], { ...B, start: -0.15, expect: 20 });
sim("start at bottom, sensitivity 5 (floor 0.03, depth 0.15)", [...hold(2, -0.15), ...hold(1, 0), ...reps(20, () => pushRep(1.2, 0.15))], { floor: 0.03, start: -0.15, expect: 20 });

// --- Bounces, stalls and wobbles must never add a rep ---
const bounceRep = (period, depth, b, w) => [[0.4 * period, -depth], [w, -depth + b], [w, -depth], [0.4 * period, 0]];
sim("deep reps with a small bottom bounce", reps(20, () => bounceRep(1.2, 0.25, 0.035, 0.1)), { ...B, expect: 20 });
sim("deep reps with a 0.06 bottom bounce", reps(40, () => bounceRep(1.4, 0.18, 0.06, 0.1)), { ...B, noise: 0.003, expect: 40 });
sim("rest 6 s, then reps with a wide 0.065 bottom bounce", [...reps(10, () => pushRep(1.2, 0.18)), ...hold(6), ...reps(10, () => bounceRep(1.6, 0.18, 0.065, 0.25))], { ...B, noise: 0.003, expect: 20 });
sim("first set with a wide 0.065 bottom bounce", reps(20, () => bounceRep(1.6, 0.18, 0.065, 0.25)), { ...B, noise: 0.003, expect: 20 });
const stallRep = (depth, sag) => [[0.6, -depth], [0.4, -depth * 0.55], [0.2, -depth * 0.55 - sag], [0.1, -depth * 0.55 - sag], [0.4, 0]];
for (const sag of [0.015, 0.02, 0.03, 0.04]) {
  sim(`stall halfway up with a ${sag} sag`, [...reps(10, () => pushRep(1.2, 0.16)), ...reps(5, () => stallRep(0.16, sag))], { ...B, noise: 0.003, expect: 15 });
}
const bobRep = (height, b) => [[0.7, height], [0.15, height - b], [0.15, height], [0.7, 0]];
sim("situps, rest 6 s, then a bob at the top of each", [...reps(10, () => sitRep(1.6, 0.3)), ...hold(6), ...reps(10, () => bobRep(0.3, 0.08))], { floor: 0.06, exercise: "sit", noise: 0.003, expect: 20 });
sim("situps with a stall and sag on the way up", reps(15, () => [[0.5, 0.15], [0.2, 0.13], [0.5, 0.3], [0.8, 0]]), { floor: 0.06, exercise: "sit", noise: 0.003, expect: 15 });

// --- Half reps never count; holding plank never counts ---
sim("half-depth reps after full ones don't count", [...reps(15, () => pushRep(1.2, 0.18)), ...reps(15, () => pushRep(1.2, 0.08))], { ...B, noise: 0.003, expect: 15 });
sim("full and half reps mixed: only the full ones count", reps(20, i => pushRep(1.2, i % 2 ? 0.08 : 0.17)), { ...B, noise: 0.003, expect: 10 });
sim("half situps (partway up) don't count", [...reps(10, () => sitRep(1.6, 0.3)), ...reps(10, () => sitRep(1.6, 0.13))], { floor: 0.06, exercise: "sit", noise: 0.003, expect: 10 });
const plankShift = (s, by) => [[s, -by], [s, 0]]; // shoulders sink a little and come back while holding plank
sim("holding plank 10 s with jitter after a set", [...reps(10, () => pushRep(1.2, 0.16)), ...hold(10)], { ...B, noise: 0.012, expect: 10 });
sim("holding plank with small sags (0.04) after a set", [...reps(10, () => pushRep(1.2, 0.16)), ...hold(5), ...plankShift(0.6, 0.04), ...hold(2), ...plankShift(0.5, 0.045), ...hold(3)], { ...B, noise: 0.006, expect: 10 });

// --- Reps that change: shallower when tired, or the person shifts position ---
sim("person shifts lower by 0.1 between sets", [...reps(10, () => pushRep(1.2, 0.15)), ...hold(2, -0.1), ...reps(10, () => [[0.6, -0.25], [0.6, -0.1]])], { ...B, expect: [18, 20] });
sim("person shifts higher by 0.1 between sets", [...reps(10, () => pushRep(1.2, 0.15)), ...hold(2, 0.1), ...reps(10, () => [[0.6, -0.05], [0.6, 0.1]])], { ...B, expect: 20 });

console.log(failures ? `\n${failures} FAILED` : "\nAll passed");
process.exit(failures ? 1 : 0);
