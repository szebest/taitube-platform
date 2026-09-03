---
name: vp-ffmpeg-hls-ladder
description: Build FFmpeg commands for the video-pipeline HLS ladder — ffprobe validation, no-upscale rendition selection, per-rendition H.264/AAC transcode to 6-second MPEG-TS segments with keyframes aligned across renditions, master playlist generation, progress parsing, and exit-code/error classification. Use when touching packages/ffmpeg, the probe/transcode/thumbnail/package stages, or debugging playback/ABR glitches.
license: MIT
metadata:
  project: video-pipeline
  spec: docs/SDD.md §8, ADR-07, ADR-08, ADR-18
---

# FFmpeg HLS ladder (project conventions)

Authoritative spec: `docs/SDD.md` §8 (commands), §7 (object keys), ADR-07/08/18. This skill is the operational checklist; when in doubt the SDD wins.

## Rules that are not negotiable
1. **argv arrays only** (`spawn(ffmpeg, [...])`) — never shell strings; keys derive from UUIDs, filenames are metadata.
2. **Probe first, fail fast.** `ffprobe -v error -print_format json -show_format -show_streams -show_error`. Throw `PermanentError` with `CORRUPT_CONTAINER` (no video stream, unreadable), `UNSUPPORTED_CODEC` (codec ∉ {h264,hevc,vp9,av1,mpeg4}), `DURATION_EXCEEDED`. Apply rotation from `side_data_list`/`tags.rotate` before ladder selection.
3. **Ladder = SDD §8.1 table**, keep rungs with `height ≤ sourceHeight`, always keep the smallest rung. 1080p 5000k (max 5350k/buf 7500k) High@4.1 · 720p 2800k (2996k/4200k) High@3.1 · 480p 1400k (1498k/2100k) Main@3.1; AAC-LC 128k (96k for 480p), 48 kHz, stereo.
4. **Aligned keyframes across renditions** — this is what makes ABR switching seamless: `-g G -keyint_min G -sc_threshold 0 -force_key_frames "expr:gte(t,n_forced*2)"` with `G = round(2 × fps)` from probe (never hard-code 48). VFR sources → `-fps_mode cfr` (FFmpeg 7) so `t` is monotonic.
5. **Segments:** `-f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments+temp_file -hls_segment_type mpegts -hls_segment_filename "$OUT/seg_%05d.ts"`. `temp_file` means a segment is complete only when it no longer has the `.tmp` suffix — the streaming uploader keys off the rename.
6. **Scale filter:** `scale=w=W:h=H:force_original_aspect_ratio=decrease:force_divisible_by=2`, `-pix_fmt yuv420p`, `-preset $X264_PRESET` (default `veryfast`), `-threads $FFMPEG_THREADS` (= container CPU limit; minus one per retry attempt).
7. **Progress:** `-progress pipe:1 -nostdin -loglevel error`; parse `out_time_ms`, `speed`; throttle to one update per 2 s; keep the last 50 stderr lines for failure records.
8. **Exit codes → errors:** 137/SIGKILL → `TransientError('FFMPEG_OOM')`; hard timeout `max(JOB_TIMEOUT_FACTOR × duration, 10 min)` → `TransientError('FFMPEG_TIMEOUT')` (kill the process group, no zombies); stderr `Invalid data found` / `moov atom not found` → `PermanentError('CORRUPT_CONTAINER')`; other non-zero → `TransientError('FFMPEG_FAILED')`.
9. **Playlist last.** Upload segments as they close; upload `index.m3u8` only after every segment upload succeeded; `package` writes `master.m3u8` last (its presence == READY). Content types: `application/vnd.apple.mpegurl` (`max-age=60`), `video/MP2T` (`immutable`).
10. **Master playlist** is generated in TypeScript (SDD §8.4), highest rung first: `BANDWIDTH` = maxrate + audio, `AVERAGE-BANDWIDTH` = measured bytes×8/duration, `RESOLUTION`, `FRAME-RATE`, `CODECS` (`avc1.640029` 1080p High@4.1, `avc1.64001f` 720p High@3.1, `avc1.4d401f` 480p Main@3.1, `mp4a.40.2`), `#EXT-X-INDEPENDENT-SEGMENTS`.

## Verification recipes
- Segment starts with IDR: `ffprobe -v error -select_streams v -show_entries frame=key_frame,pkt_pts_time -read_intervals "%+#1" seg_00007.ts` → `key_frame=1`.
- Keyframe alignment across rungs: dump keyframe timestamps for 720p and 480p (`-skip_frame nokey -show_entries frame=pkt_pts_time`) and diff; tolerance ± 1 frame.
- Segment count: `ceil(duration / 6)`; playlist has `#EXT-X-PLAYLIST-TYPE:VOD` and `#EXT-X-ENDLIST`.
- Play in the vendored hls.js test page; throttle bandwidth in DevTools and confirm level switches without a decode error.

## Thumbnails (§8.3)
Poster at 10 % of duration (`-ss T -frames:v 1 -vf thumbnail,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2 -q:v 3`); sprite `fps=1/5,scale=160:90…,tile=10xROWS`; VTT generated in TS with `#xywh=` cues. Scale 4K sources before tiling.

## Do not
- Use `fluent-ffmpeg` (unmaintained) or shell interpolation.
- Upscale, or change bitrates/GOP per rendition without updating the SDD table.
- Write into a new `hls/g{n}` prefix without bumping the video's `generation` (re-process flow).
- Switch to fMP4/CMAF or DASH in MVP (backlog; ADR-07).
