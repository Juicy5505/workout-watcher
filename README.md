# Workout Watcher

Workout Watcher counts your reps with your camera: pushups, situps, squats, lunges, jumping jacks, bicep curls, overhead press, or any movement you teach it. Up to 4 people can work out at once, each in their own lane of the picture.

**Use it:** https://juicy5505.github.io/workout-watcher/

Pose tracking (MediaPipe Pose) runs in your browser. Video never leaves your device, and your workout is saved only in that browser. The page downloads the pose-tracking library from cdn.jsdelivr.net, its model from storage.googleapis.com, and fonts from Google Fonts; nothing is sent back.

## How to use it

- **Camera:** prop your phone (sideways) or laptop at floor level about 10–13 ft (3–4 m) away. Side-on or facing the camera both work for pushups. Allow camera access when the browser asks; if you said no, turn it on in the browser's site settings and press **Try again**.
- **People:** pick 1–4. The picture is split into that many lanes; each person stays in their own lane.
- **Workout:** tick the movements to count and type each one's goal reps. Each person moves to the next ticked movement on their own about 2.5 s after reaching a goal.
- **Counts:** type into a person's count to set it, or use − / +. The goal can also be typed on any person's row; it's shared by everyone.
- **Only full reps count:** a rep has to cover most of your usual depth. Half reps and small movements while holding a position are ignored.
- **Teach a movement:** type a name under the movement list, pick who shows it, press **Teach it**, and do about 5 reps after the 3-second countdown. The page picks the body point that moved most and adds the movement with a goal of 20. Remove it with ✕.
- **Big screen:** press F (or the Big screen button) for a large view readable from the floor. On iPhone it fills the browser window; tap **Close big screen** to return.
- **Sound:** a beep on each rep. Spoken callouts are off by default (toggle under Controls). Browsers keep sound off until you click the page once.
- **Tuning:** if reps are missed, raise Sensitivity for that movement under "Tuning and tips". If extra reps appear, lower it.
- **Something counted wrong?** Use **Record 30 s for diagnosis** under "Tuning and tips". It saves what the pose tracker saw (body-point positions of everyone in view; no video or names) to a file. Open the page with `#replay` at the end of the address to load that file and see exactly how it was counted. Share a recording only with someone you trust, for example as an attachment to a GitHub issue on this repo.

Works in current Chrome, Edge, Safari and Firefox on desktop and mobile. The camera needs https (the hosted site) or http://localhost.

## Run it locally

```bash
python3 serve.py
```

Then open http://localhost:8765/. `serve.py` serves this folder with browser caching turned off, so a reload always loads the latest code. On a Mac, `caffeinate -di python3 serve.py` also keeps the computer awake.

## Tests

```bash
node tests/test-detector.mjs
```

Rep-detector tests on simulated movement signals. `SEED=70 node tests/test-detector.mjs` repeats them with a different noise pattern.

In-page self-test with synthetic bodies for three people (no camera needed): open the page with `#selftest` (add `&fps=15` or `&sens=4` to vary the frame rate or sensitivity).

## Files

- `index.html`: the app (camera, pose tracking, lanes, UI, teach mode, diagnostics, self-test)
- `detector.js`: rep detection from a 1-D movement signal
- `tests/test-detector.mjs`: detector tests
- `serve.py`: local server with caching turned off
- `rep-counter.html`: forwards old links to `index.html`
