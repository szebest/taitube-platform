# AGENTS.md — @vp/ffmpeg (FFmpeg Command Builders & Probing)

Instructions for any coding agent working on `@vp/ffmpeg`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/ffmpeg` builds the FFmpeg and FFprobe argument lists, runs the processes and parses what they
print. Tier `server`, `vp.layer` 2; depends on `@opentelemetry/api`, `@vp/domain`, `@vp/errors`,
`@vp/job-contracts`, `@vp/result` and `@vp/storage`.

- **Probe:** `runFfprobe` parses FFprobe JSON into `ProbeMetadata` (duration, dimensions, rotation, fps,
  codecs, bitrate, ladder). It throws a `PermanentError` for a file with no video stream, a codec
  outside the allowlist, or a duration over `maxDurationSec` (`MAX_DURATION_SEC`).
- **Ladder:** the rungs are `CANONICAL_LADDER` in `@vp/job-contracts`; `selectLadder` keeps the rungs
  no taller than the source and, when none is, the smallest one. It never upscales.
- **Transcode:** `runFfmpegTranscode` encodes one `LadderEntry` to HLS with MPEG-TS segments. The GOP is
  `gopSeconds * fps` frames with scene-cut keyframes off, so segments align across renditions;
  `gopSeconds` and `hlsSegmentSeconds` come from config (`GOP_SECONDS`, `HLS_SEGMENT_SECONDS`).
- **Thumbnails:** `runFfmpegThumbnail` writes the poster, the sprite sheet and its WebVTT.
- **Master playlist:** `generateMasterPlaylist` builds `master.m3u8` from the ladder and, when given, the measured
  bitrates; it omits `FRAME-RATE` when the probe measured none.
- **Handing it to a stage:** `MediaTools` / `mediaTools` bundle probe, transcode and thumbnail; the
  worker's composition root hands it to the stages, and a spec hands a double.

---

## 2. Invariants

- FFmpeg and FFprobe run through `child_process.spawn` with an argument array, never an interpolated
  shell string.
- `runFfmpeg` owns every FFmpeg run: a traced span (a presigned URL in the command is stripped with
  `sanitizeStorageUrl`), a hard timeout that sends SIGTERM and then SIGKILL after `killGraceMs`, an
  optional `AbortSignal`, and a failure classified by `classifyFfmpegError` from the stderr tail.
- Transcode progress is read from `-progress pipe:1` (`out_time_ms=` / `out_time_us=`, both
  microseconds) and reported as `{ percent, outTimeMs }`.

---

## 3. Dedicated Skills

- **`ffmpeg`**: General FFmpeg CLI commands.
- **`vp-ffmpeg-hls-ladder`**: Video pipeline HLS ladder specification.

---

## 4. Local Commands

```bash
pnpm --filter @vp/ffmpeg typecheck
pnpm --filter @vp/ffmpeg test
pnpm --filter @vp/ffmpeg test:integration   # encodes real fixtures
```
