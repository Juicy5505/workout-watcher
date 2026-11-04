# Rep Counter

A local web page that uses your Mac's camera to count workout reps for 1–4 people at once. Pose tracking (MediaPipe Pose) runs in the browser; video never leaves the machine.

## Run it

```bash
caffeinate -di python3 serve.py
```

Then open http://localhost:8765/rep-counter.html in Chrome or Safari and allow camera access. `serve.py` serves this folder with browser caching turned off, so a reload always loads the latest code. `caffeinate` keeps the Mac awake.

## Use it

- **People:** pick 1–4. The picture is split into that many lanes, and each person stays in their own lane.
- **Workout:** tick the movements to count and type each one's goal reps. Each person moves to the next ticked movement on their own about 2.5 s after reaching a goal.
- **Counts:** type into a person's count to set it, or use − / +. The goal can also be typed on any person's row; it's shared by everyone.
- **Movements:** pushups, situps, squats, lunges, jumping jacks, bicep curls, overhead press.
- **Camera:** floor level, 10–13 ft away, angled about 45°. Floor movements need the whole body in view; curls and press only need arms and shoulders.
- **Big screen:** press F for a fullscreen view readable from the floor.
- **Sound:** a beep on each rep. Spoken callouts are off by default (toggle under Controls).
- If reps are missed, raise Sensitivity for that movement under "Tuning and tips". If extra reps appear, lower it.

## Tests

```bash
node tests/test-detector.mjs
```

Detector tests on simulated rep signals. `SEED=70 node tests/test-detector.mjs` runs the same cases with a different noise pattern.

In-page self-test with synthetic poses for three people (no camera needed):
http://localhost:8765/rep-counter.html#selftest — add `&fps=15` or `&sens=4` to vary the frame rate or sensitivity.

## Files

- `rep-counter.html` — the page: camera, pose tracking, lanes, UI, self-test
- `detector.js` — rep detection from a 1-D movement signal
- `tests/test-detector.mjs` — detector tests
- `serve.py` — local server with caching off
