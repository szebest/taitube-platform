# AGENTS.md — @vp/ffmpeg (FFmpeg Command Builders & Probing)

Instructions for any coding agent working on `@vp/ffmpeg`.

> Tiers, layers and the import rules in full: [docs/standards/package-boundaries.md](../../../docs/standards/package-boundaries.md)
---

## 1. Scope & Purpose

`@vp/ffmpeg` encapsulates all FFmpeg and FFprobe execution parameters, CLI command builders, rendition presets, and output parsers.
- **Probe Parser:** Parses FFprobe JSON output to extract container format, video/audio stream codecs, resolution, aspect ratio, frame rate, and duration.
- **Ladder Presets:** Computes output ladder based on source height:
  - `1080p`: 1920x1080, 4500k video, 128k audio
  - `720p`: 1280x720, 2200k video, 96k audio
  - `480p`: 854x480, 800k video, 64k audio (always included as lowest baseline)
  - No upscaling: renditions exceeding source height are omitted.
- **Keyframe Alignment:** Fixed GOP size (GOP = 2 * framerate) for 6-second MPEG-TS segments aligned across all renditions.

---

## 2. Invariants

- Must never run shell injections: execute FFmpeg using argument arrays (`child_process.spawn`), never raw interpolated strings.
- Progress parsing captures `frame=`, `fps=`, `time=`, `speed=` to emit percentage and ETA.

---

## 3. Dedicated Skills

- **`ffmpeg`**: General FFmpeg CLI commands.
- **`vp-ffmpeg-hls-ladder`**: Video pipeline HLS ladder specification.

---

## 4. Local Commands

```bash
pnpm --filter @vp/ffmpeg typecheck
pnpm --filter @vp/ffmpeg test
```
