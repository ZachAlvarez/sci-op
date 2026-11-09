# Sci-Op

**Sciatica operational movement.** A home training app for getting back to lifting with L5-S1 disc-related sciatica: a daily spine routine, a two-phase strength program, symptom check-ins, progress tracking, and a voice-coached guided session with an animated 3D figure.

> Not medical advice. Stop any exercise that sends symptoms down the leg, and get urgent care for saddle numbness, bladder or bowel changes, or new leg weakness.

## Files

| File | What it is |
|---|---|
| `index.html` | The core app. Its 3D engine, figure model and fallback frames are embedded, so the training experience works offline (with a system-font fallback if Google Fonts is unavailable). |
| `form-coach.html` | Optional camera form coach: rep counting and joint-based form cues using MediaPipe Pose. Needs HTTPS for camera access and an internet connection to load MediaPipe and its pose model. |

## Run it

- **Locally:** open `index.html` in Chrome.
- **Hosted:** enable GitHub Pages (Settings → Pages → deploy from `main`, root). The app is then at `https://<user>.github.io/sci-op/` and the coach at `.../form-coach.html`. Pages serves HTTPS, so the camera coach works there.
- **Phone:** open the Pages URL in Chrome and use *Add to home screen*.

Progress is stored only in the browser (`localStorage`) when run outside claude.ai. No workout video is uploaded by the coach, but clearing browser data or switching devices removes locally stored progress. Export/import is not available yet.

## Development

```sh
npm ci
npx playwright install chromium   # first time only
npm run validate                  # every inline script parses
npm test                          # form-coach camera lifecycle tests
npm run serve                     # local server at http://127.0.0.1:4173
```

The tests use Chromium's fake camera and a stubbed MediaPipe module, so they run offline and can simulate slow or failing model loads. They check that the camera is released on End, on page exit, and on load failure, and that ending during startup never starts tracking. CI runs both on every push.

## Features

- Daily routine: walk, McGill curl-up, side plank, bird dog, sciatic nerve glide, slant-board calf stretch, slackboard balance.
- Phase 1 (weeks 1–4) and Phase 2 (weeks 5–10) strength work, with readiness milestones for heavier lifting.
- Guided session: rep and hold counts, rests, side switches, spoken coaching, optional voice commands (next, pause, resume, repeat, back, leg), and a one-tap "symptoms going down the leg" stop.
- 3D figure with orbit views; falls back to pre-rendered frames where WebGL is unavailable.

## How the animation works

The figure is a rigged humanoid driven by hand-keyframed pose specs per exercise, blended with minimum-jerk easing and grounded each frame so feet, hands and knees stay planted. The walk is replayed from motion-capture data. Exercise motions are keyframed demonstrations, not motion capture.

### Human figure prototype

Serve this folder over HTTP (for example, `python -m http.server 8765 --bind 127.0.0.1`), then open `http://127.0.0.1:8765/index.html?preview=figure&figure=human`.

This isolated preview compares a MakeHuman/MPFB-based human with the original figure across all 20 exercises, with playback, scrubbing, side selection, and viewing angles. It does not initialize or save workout progress. The human loads from `assets/human-base-rigged.glb`; if unavailable, the original embedded figure is used and identified in the preview. Normal app URLs keep the original model. Add `?figure=human` to try the new figure in the workout interface.

The prototype adapts a 53-bone rig, adds unweighted terminal markers for the existing solver, and applies matte shading and illustrative training shorts. Human-specific pose settings refine all 20 demonstrations: stable elbow/knee rotation through extension, fixed support feet, flat resting palms, curled equipment grips, stacked side-plank feet, grounded bridge hands, seated foot contact, and forward-facing walking feet. The lateral-walk band wraps above the knees, and dumbbell handles follow the grip orientation. Exercise views expose the movement more clearly on either side.

This is an illustrative rig, not a clinically validated anatomical model or new motion-capture library. Joint centers and surface contacts remain approximations; the checks do not establish safe technique or detect every mesh intersection. Loading the human requires a local/hosted server and the asset file; the original self-contained offline option remains available.

The human bird-dog support arm uses a fixed backward elbow bend direction and a bind-pose hinge plane to avoid elbow flips. Its palm orientation is restored after IK and supporting fingers extend above the mat. Diagnostics also check elbow direction, palm orientation and fingertip-marker clearance across 126 reach/breathing samples on both sides. Paused playback freezes the breathing animation as well as the exercise phase.

Open **Preview diagnostics → Check all exercise poses** to check 840 samples (21 positions × 20 exercises × both sides), including finite transforms, abrupt limb rotations, planted-joint drift (2 cm tolerance), and supporting fingertip clearance. The additional bird-dog checks cover breathing extremes. Use the five visual review groups to inspect start/middle/end contact sheets; **Other side** also controls the sheets. These are renderer regression checks, not biomechanical validation.

## Limitations

- The form coach sees joints, not spinal curvature, so it cannot detect low-back rounding.
- Form-coach thresholds have not been tuned on real users.
- The form coach is an assistive beta feature, not a diagnostic or clinical measurement tool.

## Credits

- Figure mesh: CC0 human model from [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app).
- Human figure prototype: [Innerscene human base with 53-bone rig](https://www.innerscene.com/tools/library/3d-parts/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1), derived from MakeHuman/MPFB, CC0. See `assets/human-base-rigged.LICENSE.txt`.
- Walk motion capture: Mixamo clip bundled with the three.js `Xbot` example.
- [three.js](https://threejs.org) r128 (MIT), embedded.
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (Apache 2.0), loaded from CDN by the form coach.
