# This repo

The authority is `docs/SDD.md` §8 (commands, ladder, master playlist), §7 (object keys),
ADR-07, ADR-08, ADR-18. The ladder in code is `packages/server/job-contracts/src/ladder.ts`;
the FFmpeg wrappers are `@vp/ffmpeg` (`packages/server/ffmpeg`); the stages are `probe`,
`transcode-*`, `thumbnail` and `package` in `apps/server/worker/src/stages/`.

- **Supported codecs**: h264, hevc, vp9, av1, mpeg4. Permanent error codes
  `CORRUPT_CONTAINER`, `UNSUPPORTED_CODEC`, `DURATION_EXCEEDED`; transient
  `FFMPEG_OOM`, `FFMPEG_TIMEOUT`, `FFMPEG_FAILED`.
- **Rungs** (SDD §8.1): 1080p 5000k (max 5350k, buffer 7500k) High@4.1, 720p 2800k (2996k,
  4200k) High@3.1, 480p 1400k (1498k, 2100k) Main@3.1; AAC-LC 128k (96k at 480p), 48 kHz
  stereo. `CODECS`: `avc1.640029`, `avc1.64001f`, `avc1.4d401f`, `mp4a.40.2`.
- **GOP**: `G = round(2 x fps)`, a keyframe every two seconds; six-second MPEG-TS segments.
- **Tuning from config**: `X264_PRESET` (default `veryfast`), `FFMPEG_THREADS` (lowered by
  one per retry), `JOB_TIMEOUT_FACTOR` (timeout `max(factor x duration, 10 min)`).
- **Playlists**: `index.m3u8` per rendition with `max-age=60`, `master.m3u8` written last
  by `package`, segments `video/MP2T` immutable.
- **Thumbnails** (SDD §8.3): poster at 10% of the duration at 1280x720, sprite every five
  seconds at 160x90 in rows of ten.
- **Test page**: `tools/hls-test-page/` plays a ladder with the vendored
  `vendor/hls.min.js`; `make hls-sample` writes a sample for it and `make up tools` serves it
  on port 8080.
- MPEG-TS for the MVP; fMP4/CMAF and DASH are backlog (ADR-07).
