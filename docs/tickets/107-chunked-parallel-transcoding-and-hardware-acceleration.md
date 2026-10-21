# 107: Chunked parallel transcoding and hardware-accelerated pipeline fallback

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 14 - Segment streaming uploader · 28 - Load test S3 |
| Blocks | — |
| Spec | [SDD §8.5 Chunked parallel transcoding](../SDD.md#85-chunked-parallel-transcoding-phase-4-stretch--designed-not-built) · [SDD ADR-08 Transcode parallelism](../SDD.md#adr-08--transcode-parallelism-one-job-per-rendition-fan-out-chunked-transcoding-as-stretch) · [SDD §8.2 Transcode one rendition](../SDD.md#82-transcode-one-rendition-to-hls-ts-segments) |

**Status:** ready

> **Why.** (added by Gemini, let Claude verify it)
> Currently, `buildTranscodeArgs` in `@vp/ffmpeg` transcodes entire video streams as a single monolithic job hardcoded to software `libx264`. For long-form media (> 5 minutes or 4K/1080p60), this creates head-of-line queue blocking, risks worker OOM/timeout terminations, and leaves modern host hardware acceleration (NVENC, VAAPI, Intel QSV, Apple VideoToolbox) completely unutilized. This ticket implements SDD §8.5 chunked parallel transcoding across BullMQ child flows, combined with probe-time hardware acceleration autoselection and zero-downtime CPU fallback to guarantee local-first safety.

## What to build (added by Gemini, let Claude verify it)

### 1. Hardware acceleration detection and graceful CPU fallback (added by Gemini, let Claude verify it)
- Extend `@vp/env-schema` with `FFMPEG_HWACCEL` (`auto | none | nvenc | vaapi | qsv | videotoolbox`, defaulting to `auto`). (added by Gemini, let Claude verify it)
- In `@vp/ffmpeg`, introduce `detectHardwareAcceleration()`: probes available encoders via `ffmpeg -encoders` and verifies device context initialization. (added by Gemini, let Claude verify it)
- Update `buildTranscodeArgs` to configure the detected hardware encoder (e.g. `h264_nvenc`, `h264_vaapi`, `h264_qsv`, `h264_videotoolbox`) with equivalent rate-control (`-b:v`, `-maxrate`, `-bufsize`) and keyframe GOP settings. (added by Gemini, let Claude verify it)
- Enhance `classifyFfmpegError` to classify hardware device initialization or encoder failures as transient fallback conditions, allowing immediate fallback to software `libx264` without failing the overall job. (added by Gemini, let Claude verify it)
- Ensure Core Rule 1 (Local-first) is preserved: environments without hardware acceleration fall back to `libx264` transparently; `make smoke-offline` remains 100% green without GPU requirements. (added by Gemini, let Claude verify it)

### 2. Keyframe-aligned chunk splitting stage (`split` stage) (added by Gemini, let Claude verify it)
- When `probe` detects media duration > 300s (5 minutes), flag the pipeline for chunked processing with `chunkSeconds = 30`. (added by Gemini, let Claude verify it)
- Create worker stage `split.ts`: runs `ffmpeg -i src -c copy -map 0 -f segment -segment_time 30 -reset_timestamps 1 -segment_format mp4 chunk_%03d.mp4` to split input into stream-copy chunks aligned to existing source keyframes. (added by Gemini, let Claude verify it)
- Upload chunk segments to storage under temporary prefix `raw-chunks/<videoId>/`. (added by Gemini, let Claude verify it)

### 3. Fan-out chunk transcoding & fan-in concatenation (added by Gemini, let Claude verify it)
- Generate a BullMQ FlowProducer tree: `package` parent depends on `concat-{rendition}` jobs, each of which depends on `N` parallel `transcode-chunk-{rendition}` child jobs. (added by Gemini, let Claude verify it)
- Leverage existing `chunkIndex` and `chunkCount` fields in `@vp/job-contracts` `TranscodeJobPayload`. (added by Gemini, let Claude verify it)
- Audio is extracted and transcoded once from the master source to avoid seam distortion, and muxed back at concatenation. (added by Gemini, let Claude verify it)
- Concat worker stage (`concat.ts`): merges transcoded chunks via FFmpeg concat demuxer (`-f concat -safe 0 -i list.txt -c copy`) and generates final HLS segments and playlists. (added by Gemini, let Claude verify it)
- Automatic cleanup: scratch files and remote `raw-chunks/<videoId>/` objects are deleted upon successful `package` completion or unrecoverable error. (added by Gemini, let Claude verify it)

## Acceptance criteria (added by Gemini, let Claude verify it)

- [ ] `FFMPEG_HWACCEL` is declared in `@vp/env-schema`, documented in `.env.example`, and covered by `env-key-closure.test.ts`. (added by Gemini, let Claude verify it)
- [ ] `detectHardwareAcceleration()` correctly identifies available encoders, with mockable test doubles for all platforms. (added by Gemini, let Claude verify it)
- [ ] If hardware acceleration fails during execution (simulated via invalid device), `classifyFfmpegError` catches the device error and the worker retries immediately with `libx264`. (added by Gemini, let Claude verify it)
- [ ] Source files under 5 minutes bypass chunking and transcode via standard single-stage flow (zero regression for small clips). (added by Gemini, let Claude verify it)
- [ ] Source files over 5 minutes are split into keyframe-aligned MP4 chunks and processed across parallel BullMQ worker stages. (added by Gemini, let Claude verify it)
- [ ] Audio across concatenated chunks exhibits zero seam pops, jitter, or sync drift (proved by automated ffprobe audio PTS continuity check). (added by Gemini, let Claude verify it)
- [ ] Master playlist and individual rendition HLS streams from chunked transcode pass playback verification in `hls-test-page`. (added by Gemini, let Claude verify it)
- [ ] Temporary chunk files in object storage are completely purged post-packaging. (added by Gemini, let Claude verify it)
- [ ] Dual runtime parity: executes identically and passes test suite under both `vitest` and `bun test`. (added by Gemini, let Claude verify it)
- [ ] `make smoke` and `make smoke-offline` pass with no regressions. (added by Gemini, let Claude verify it)

## Out of scope (added by Gemini, let Claude verify it)

- AV1 / HEVC hardware encoders (remains scoped to H.264 / AVC1 as per SDD §8.1). (added by Gemini, let Claude verify it)
- Dynamic cloud spot instance provisioning for worker nodes. (added by Gemini, let Claude verify it)

## Testing plan (added by Gemini, let Claude verify it)

- Unit tests in `@vp/ffmpeg`: `detect-hwaccel.test.ts`, `build-transcode-args-hwaccel.test.ts`, `classify-ffmpeg-error.test.ts`. (added by Gemini, let Claude verify it)
- Worker stage tests in `apps/server/worker`: `split.test.ts`, `concat.test.ts`. (added by Gemini, let Claude verify it)
- End-to-end integration test with a synthesized 6-minute video fixture proving fan-out chunking, concatenation, and playback. (added by Gemini, let Claude verify it)

## Definition of Done (added by Gemini, let Claude verify it)

- Code and tests committed adhering to file discipline (<= 400 lines per file). (added by Gemini, let Claude verify it)
- Architecture fitness tests in `tests/architecture/` remain 100% green. (added by Gemini, let Claude verify it)
- `python3 docs/tickets/gen-index.py` confirms index, frontier, and anchor validity. (added by Gemini, let Claude verify it)
