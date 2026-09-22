# packages/server/gen-video — Deterministic Video Fixture Generator

`gen-video` produces synthetic, copyright-free, deterministic test video fixtures for `video-pipeline` using FFmpeg's `testsrc2` and `sine` filters with burnt-in timecode.

Outputs are git-ignored and generated on demand for local testing and CI integration suites.

## Usage

```bash
# Generate the fast fixture set (< 3 min, standard + fast hostile fixtures)
pnpm gen-video

# Generate into a custom directory
pnpm gen-video --output-dir tests/fixtures

# Generate including slow fixtures (m10, l30, over-duration)
pnpm gen-video --include-slow

# Generate a single fixture
pnpm gen-video --only s15

# Verify existing fixtures against manifest
pnpm gen-video --check
```

## Cross-Platform Verification (`--check`)

FFmpeg encoders (such as `libx264`) compiled on different operating systems (Linux, macOS, Windows) or with differing CPU optimizations may produce slight variations in binary byte-streams for the exact same input.

For this reason, `--check` verifies:
1. File existence and non-emptiness (or 0-byte check for `zero-bytes`).
2. Exact structural stream metadata via `ffprobe`:
   - Duration (within tolerance)
   - Resolution (width × height)
   - Video codec (`h264`, `hevc`)
   - Audio codec (`aac`)
   - Stream tags (e.g. rotation metadata for `portrait`)
3. Rejection of hostile files by `ffprobe` (`not-a-video`, `truncated`).
4. Calculates SHA256 checksums for diagnostic tracing.

## Fixture Set

### Standard Fixtures
| ID | Filename | Description | Duration | Resolution |
|---|---|---|---|---|
| `s15` | `s15.mp4` | Standard short test video with burnt-in timecode | 15s | 1920×1080 |
| `s60` | `s60.mp4` | Standard medium test video with burnt-in timecode | 60s | 1920×1080 |
| `p720` | `p720.mp4` | 720p test video (no-upscale ladder test) | 15s | 1280×720 |
| `sd360` | `sd360.mp4` | 360p SD test video (ladder lowest tier) | 15s | 640×360 |
| `portrait` | `portrait.mp4` | Portrait video with 90° rotation metadata | 15s | 1920×1080 (rotated 90°) |
| `vfr` | `vfr.mp4` | Variable frame rate test fixture | 15s | 1920×1080 |
| `k60` | `k60.mp4` | 4K 60fps high-resolution source | 10s | 3840×2160 |
| `m10` | `m10.mp4` | 10-minute source (`--include-slow`) | 10m (600s) | 1920×1080 |
| `l30` | `l30.mp4` | 30-minute source for streaming uploader tests (`--include-slow`) | 30m (1800s) | 1280×720 |

### Hostile Fixtures
| ID | Filename | Description | Expected Behavior |
|---|---|---|---|
| `truncated` | `truncated.mp4` | Truncated MP4 stream | Probe detects damaged container |
| `audio-only` | `audio-only.mp4` | Audio stream without video | Rejected by probe stage |
| `hevc.mkv` | `hevc.mkv` | HEVC in MKV container | Probe checks format allowlist |
| `zero-bytes` | `zero-bytes.mp4` | 0-byte file | Rejected by API/probe |
| `not-a-video` | `not-a-video.mp4` | Plain text disguised as MP4 | Corrupt container rejected |
| `over-duration` | `over-duration.mp4` | 3605s source (`--include-slow`) | Rejection (> 3600s max duration) |
