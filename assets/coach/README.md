# American male coach

The app serves these pre-generated MP3 clips as its default voice. Preview it in
**Program → Coach voice**. This is an AI-generated voice, not a recording of a
personal trainer. The selected voice is audition A: Kokoro's stock `am_puck`
American male voice at its natural 1.0 speed, with casual, lightly flirty copy.
The preview uses the exact script and voice settings from audition A. Exercise
instructions, counts, rests and transitions use that same voice. Pitch is
unmodified. No voice cloning is used.

The same voice introduces Today, Program, Progress and Ground rules, confirms
successful local saves, check-ins and milestones, and guides standalone hold
timers. Use **Hear today's plan** and **Hear exercise instructions** on demand.
Program has a separate switch for section introductions and confirmations;
the global **Voice on/off** control also mutes workout and camera speech.
Navigation narration is limited to once per section every 15 seconds and
replaces previous speech. Browsers require a click/tap before audio starts.
The optional camera coach shares this voice and mute setting, including setup,
form cues, rep counts and session summaries. Common camera counts are bundled
(1–100 and ten-second checkpoints through 600); other numbers use labeled
device speech. Guided workouts use bundled counts throughout.

Audio is generated during development, never on the user's device. There are
no API keys, paid speech requests, or third-party speech requests at runtime.
Only clips needed for nearby workout segments are fetched and decoded. Serve
the full repository over HTTP(S); opening `index.html` directly from disk
may block audio fetches and use the device voice instead. This is not a full
offline-download feature.

If a clip fails, the app labels the device-voice fallback. Mute persists locally.
Pause, skip, close, and mute cancel both playing and pending audio. Time-sensitive
cues that load late are dropped, rather than spoken after the movement. Form
guidance can finish across a rep count; that spoken count is skipped while the
on-screen count continues.

## Rebuild

Use Python 3.12 in an isolated environment and install
`kokoro-onnx==0.6.1`, `soundfile==0.13.1`, `numpy==2.5.4`, and
`onnxruntime==1.31.1`. The models are development-only; do not commit them.

Download `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the upstream
[model-files-v1.1 release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1)
to `.voice-tools/models/`. `generation.json` records the exact source SHA-256s.

Run from the repository root:

```sh
node scripts/coach-catalog.mjs
python scripts/generate-coach.py
npm run validate
```

`--limit 4` renders the sample and common phrases first without replacing the
manifest. Settings live in `profile.json`; changing them and rebuilding the catalog
gives clips new URLs to avoid stale browser audio. Existing matching clips are reused;
use `--force` to render them again.
The catalog derives phrases from the actual exercise definitions and guided
segments, so validation catches a new spoken phrase without a corresponding clip.

## Sources and licenses

- [Kokoro-82M v1.0](https://huggingface.co/hexgrad/Kokoro-82M): Apache-2.0 model
  weights; stock [American male voice](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md).
- [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx): MIT generator.
- [SoundFile](https://github.com/bastibe/python-soundfile): BSD-3-Clause wrapper
  around libsndfile, used for MP3 output.

These packages and model weights are not shipped to app users. The generated
audio is included as app content. Preserve this provenance when redistributing.
