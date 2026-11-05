# Sci-Op

**Sciatica operational movement.** A home training app for getting back to lifting with L5-S1 disc-related sciatica: a daily spine routine, a two-phase strength program, symptom check-ins, progress tracking, and a voice-coached guided session with an animated 3D figure.

> Not medical advice. Stop any exercise that sends symptoms down the leg, and get urgent care for saddle numbness, bladder or bowel changes, or new leg weakness.

## Files

| File | What it is |
|---|---|
| `index.html` | The app. Fully self-contained (3D engine, figure model and fallback frames are embedded), so it runs offline. |
| `form-coach.html` | Optional camera form coach: rep counting and joint-based form cues using MediaPipe Pose. Needs HTTPS for camera access. |

## Run it

- **Locally:** open `index.html` in Chrome.
- **Hosted:** enable GitHub Pages (Settings → Pages → deploy from `main`, root). The app is then at `https://<user>.github.io/sci-op/` and the coach at `.../form-coach.html`. Pages serves HTTPS, so the camera coach works there.
- **Phone:** open the Pages URL in Chrome and use *Add to home screen*.

Progress is stored in the browser (`localStorage`) when run outside claude.ai.

## Features

- Daily routine: walk, McGill curl-up, side plank, bird dog, sciatic nerve glide, slant-board calf stretch, slackboard balance.
- Phase 1 (weeks 1–4) and Phase 2 (weeks 5–10) strength work, with readiness milestones for heavier lifting.
- Guided session: rep and hold counts, rests, side switches, spoken coaching, optional voice commands (next, pause, resume, repeat, back, leg), and a one-tap "symptoms going down the leg" stop.
- 3D figure with orbit views; falls back to pre-rendered frames where WebGL is unavailable.

## How the animation works

The figure is a rigged humanoid driven by hand-keyframed pose specs per exercise, blended with minimum-jerk easing and grounded each frame so feet, hands and knees stay planted. The walk is replayed from motion-capture data. Exercise motions are keyframed demonstrations, not motion capture.

## Limitations

- The form coach sees joints, not spinal curvature, so it cannot detect low-back rounding.
- Form-coach thresholds have not been tuned on real users.

## Credits

- Figure mesh: CC0 human model from [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app).
- Walk motion capture: Mixamo clip bundled with the three.js `Xbot` example.
- [three.js](https://threejs.org) r128 (MIT), embedded.
- [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (Apache 2.0), loaded from CDN by the form coach.
