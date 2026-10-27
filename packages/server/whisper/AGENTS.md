# AGENTS.md — @vp/whisper (Speech-to-Text & WebVTT)

Instructions for any coding agent working on `@vp/whisper`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/whisper` runs whisper.cpp's `whisper-cli` as a subprocess, the way `@vp/ffmpeg` runs ffmpeg, and
owns the WebVTT a caption track is stored as. Tier `server`, `vp.layer` 2; its dependencies are in
[package.json](package.json). A stage reaches it through `SpeechTools` / `speechTools`, which the
worker's composition root hands in and a spec replaces with a double.

- **Run:** `runWhisper` (`src/run-whisper.ts`) checks the model and VAD files, spawns `whisper-cli`
  (under `nice -n <niceness>` when given) with the argv from `buildWhisperArgs`, and reads the JSON it
  writes into cues (`parseWhisperOutput`). It returns a `Result`, never throws.
- **Failures:** `classifyWhisperFailure` maps a kill to `WHISPER_KILLED`, an unloadable model to
  `WHISPER_MODEL_INVALID`, unreadable audio to `WHISPER_INPUT_REJECTED`, anything else to
  `WHISPER_FAILED`; a run past its timeout is `WHISPER_TIMEOUT`. `RETRY_CLASS` in `@vp/errors` says
  which of them retry.
- **Windows:** `ownedCues` moves a window's cues onto the media timeline and keeps the ones that start
  inside its own span; `mergeWindows` numbers them in media order; `majorityLanguage` picks the track's
  language by spoken duration. The plan itself is `captionsWindow` in `@vp/job-contracts`.
- **WebVTT:** `toWebVtt` and `parseWebVtt` go through `node-webvtt`, never a regex of our own;
  `parseWebVtt` reports a malformed file by the line its broken cue block starts on.

---

## 2. Invariants

- `whisper-cli` runs through `child_process.spawn` with an argument array; nothing is fetched at
  runtime, the model comes from `CAPTIONS_MODEL_PATH` and `CAPTIONS_VAD_MODEL_PATH`.
- No `Bun.*`: the worker runs this under Node and Bun alike, and the specs run under both.

---

## 3. Local Commands

```bash
pnpm --filter @vp/whisper typecheck
pnpm --filter @vp/whisper test
pnpm models:fetch   # the pinned model files into .models/, for a run outside Docker
pnpm --filter @vp/whisper test:real-engine   # the real engine on a spoken clip (macOS `say`)
```
