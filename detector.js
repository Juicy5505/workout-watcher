// Counts reps from a 1-D "height" signal where a larger value means closer to the top of the rep
// (shoulder height for pushups, shoulders above hips for situps). No fixed angles: a rep counts once the signal
// rises `need` above the last bottom, and `need` adapts to the depth of the reps already done.
//
// Each exercise has a resting end that every rep starts or finishes at (opts.anchor):
// - "top" (pushups, arms locked): a rep counts only once it comes back near the usual top, so a bounce at the
//   bottom never counts on its own.
// - "bottom" (situps, lying down): a rep counts only if it started near the usual bottom, so a bob at the top
//   never counts on its own.
// A dip of less than `need` below the last peak (a stall halfway up, a bounce) continues the same rep.

export function createDetector() {
  return {
    mode: "falling", ext: null, start: null, trough: null, swingPeak: null,
    counted: true, undone: false, checked: false, cap: null, countH: null,
    amp: null, need: null, missed: 0, top: null, bottom: null, lastPeak: null,
  };
}

// Call after a rest between sets: forget the learned rep depth, so a shallower next set still counts from its first
// rep. The usual top and bottom, and the count of uncounted swings in a row, are kept.
export function rest(d) { d.amp = null; }

const blend = (old, v) => old == null ? v : old * 0.7 + v * 0.3;

// floor: smallest movement that can count as a rep, in the same units as h.
// opts.anchor: "top" or "bottom" (see above). opts.ampFrac: share of the learned rep depth a rise must reach (0.4).
// opts.undoFirstAbove: before any rep depth is known, a rise bigger than this undoes the rep (standing up).
// opts.getUpFirst: a first rise from where tracking started, with no descent seen, is getting up, not a rep.
// Returns "rep", "undo" or null.
export function feed(d, h, floor, opts = {}) {
  const hyst = floor * 0.45; // a reversal must exceed this; wide enough that landmark jitter rarely fakes one
  d.need = d.amp ? Math.max(floor, d.amp * (opts.ampFrac ?? 0.4)) : floor;
  const tol = Math.max(1.5 * floor, 0.5 * (d.amp ?? 0)); // how close to the usual top/bottom counts as "at" it
  if (d.ext === null) { d.ext = h; d.start = h; return null; }

  if (d.mode === "falling") {
    if (h < d.ext) d.ext = h;
    else if (h - d.ext > hyst) {
      // Only after an uncounted swing: after a counted rep, any real dip starts the next rep (the anchor check and
      // `need` already stop a sag from counting), otherwise reps shallower than `need` would be swallowed for good.
      const shallow = d.swingPeak != null && !d.counted && d.ext > d.swingPeak - d.need;
      if (!shallow) { d.trough = d.ext; d.counted = false; d.undone = false; d.checked = false; d.cap = null; }
      else d.trough = Math.min(d.trough, d.ext); // same rep: its bottom is the lowest point seen
      d.mode = "rising"; d.ext = h;
    }
  } else {
    if (h > d.ext) d.ext = h;
    else if (d.ext - h > hyst) {
      const a = d.ext - d.trough, real = d.counted && !d.undone;
      // Two uncounted swings in a row, each at least floor: reps got shallower or the person moved, so relearn.
      // A single uncounted swing (bottom bounce, top wobble) between counted reps never does.
      d.missed = d.counted || a < floor ? 0 : d.missed + 1;
      if (real || d.missed >= 2) d.amp = blend(d.amp, d.cap != null ? Math.min(a, d.cap) : a);
      if (real && d.cap == null) { d.top = blend(d.top, d.ext); d.bottom = blend(d.bottom, d.trough); }
      else if (d.missed >= 2) { if (opts.anchor === "top") d.top = d.ext; if (opts.anchor === "bottom") d.bottom = d.trough; }
      if (d.counted) d.lastPeak = d.ext;
      d.swingPeak = d.ext;
      d.mode = "falling"; d.ext = h;
    }
  }

  if (d.mode !== "rising") return null;
  const rise = h - d.trough;
  if (!d.counted && rise >= d.need) {
    // Until a rep has been learned, where tracking started stands in: pushups start in plank, situps lying down.
    const top = d.top ?? d.start, bottom = d.bottom ?? d.start;
    const nearTop = opts.anchor !== "top" || h >= top - tol;
    const fromBottom = opts.anchor !== "bottom" || d.trough <= bottom + tol;
    if (nearTop && fromBottom) {
      d.counted = true; d.countH = h;
      if (opts.getUpFirst && d.top == null && d.lastPeak == null && d.trough >= d.start - hyst) {
        d.checked = true; // getting up from the floor: learn from it, but it is not a rep and nothing to undo
        return null;
      }
      return "rep";
    }
  }
  if (d.counted && !d.undone && !d.checked) {
    const limit = d.amp ? 2.5 * d.amp : (opts.undoFirstAbove ?? Infinity);
    if (rise > limit) {
      d.checked = true;
      // A rise far past the usual top means standing up. Undo only if this "rep" started near the top
      // (the stand-up itself); if it started from a real bottom, the rep was real and only the extra rise is ignored.
      // Before the usual top is learned, fall back to the last counted peak, then to where tracking started.
      const top = d.top ?? d.lastPeak ?? d.start;
      const fromRealBottom = d.trough < top - (d.amp ? 0.6 * d.amp : floor);
      if (!fromRealBottom) { d.undone = true; return "undo"; }
      d.cap = limit; // learn at most this much depth from the rep, not the stand-up on top of it
    }
  }
  return null;
}
