---
name: hls-ladder
description: >-
  Building an HLS adaptive-bitrate ladder with FFmpeg: probe and fail fast, pick rungs
  without upscaling, keyframes aligned across renditions, segmenting, progress, exit-code
  classification, playlist ordering, verification. Use when writing or changing an FFmpeg
  transcode, probe, thumbnail or packaging step, or debugging playback and bitrate
  switching.
license: MIT
---

# FFmpeg HLS ladder

The operational rules for a video-on-demand HLS ladder; FFmpeg in general is the `ffmpeg`
skill. This repo's rungs, bitrates,
codec strings, keys and stages: `references/this-repo.md`; its design doc wins on any
number.

## Rules

1. **argv arrays only**: `spawn('ffmpeg', [...args])`, never a shell string. Paths come
   from generated ids; a user's filename is metadata, never a path.
2. **Probe first, fail fast**:
   `ffprobe -v error -print_format json -show_format -show_streams -show_error`. No video
   stream, an unreadable container, a codec outside the supported set or a duration over
   the limit is a permanent error, classified at the throw site. Apply rotation (stream
   side data or the `rotate` tag) before choosing rungs.
3. **The ladder never upscales**: keep the rungs whose height is at most the source's, and
   always keep the smallest one.
4. **Keyframes aligned across renditions**, which is what makes switching seamless:
   `-g G -keyint_min G -sc_threshold 0 -force_key_frames "expr:gte(t,n_forced*S)"` with
   `G` computed from the probed frame rate and the segment's keyframe interval `S`, never a
   hard-coded frame count. A variable-frame-rate source gets `-fps_mode cfr` so `t` is
   monotonic.
5. **Segments**: `-f hls -hls_playlist_type vod -hls_flags
   independent_segments+temp_file -hls_segment_filename "<out>/seg_%05d.ts"`, the segment
   duration a whole multiple of the keyframe interval. With `temp_file` a segment is
   complete only once it loses its `.tmp` suffix: an uploader that streams segments keys off
   that rename.
6. **Scaling**: `scale=w=W:h=H:force_original_aspect_ratio=decrease:force_divisible_by=2`,
   `-pix_fmt yuv420p`, threads set to the container's CPU limit.
7. **Progress**: `-progress pipe:1 -nostdin -loglevel error`; parse `out_time_ms` and
   `speed`, throttle updates, keep the last lines of stderr for the failure record.
8. **Exit codes to errors**: a kill by the OOM killer (137) or a timeout is transient
   (kill the whole process group on timeout, so no zombie survives); `Invalid data found`
   or `moov atom not found` in stderr is permanent; any other non-zero exit is transient.
   The timeout scales with the source duration, with a floor.
9. **Playlist last**: upload segments as they close, a rendition's playlist only after all
   of its segments landed, and the master playlist last of all, so its presence means
   ready. Playlists get a short cache lifetime (`application/vnd.apple.mpegurl`), segments
   an immutable one.
10. **The master playlist is generated in code**, highest rung first, each variant with
    `BANDWIDTH` (peak), `AVERAGE-BANDWIDTH` (measured: bytes x 8 / duration), `RESOLUTION`,
    `FRAME-RATE` and `CODECS`, plus `#EXT-X-INDEPENDENT-SEGMENTS`.

## Verification

- A segment starts on a keyframe:
  `ffprobe -v error -select_streams v -show_entries frame=key_frame,pts_time
  -read_intervals "%+#1" seg_00007.ts` prints `key_frame=1`.
- Alignment across rungs: dump keyframe times per rendition
  (`-skip_frame nokey -show_entries frame=pts_time`) and diff them; tolerance one frame.
- The segment count is `ceil(duration / segment length)`; the playlist has
  `#EXT-X-PLAYLIST-TYPE:VOD` and `#EXT-X-ENDLIST`.
- Play it in an hls.js page, throttle the bandwidth in the browser and confirm the level
  switches without a decode error.

## Thumbnails

A poster frame from a point inside the video (not frame zero), scaled and padded to the
poster size; a sprite from `fps=1/<interval>`, scaled and tiled, with a WebVTT file of
`#xywh=` cues generated in code. Scale very large sources down before tiling.

## Never

- `fluent-ffmpeg` (unmaintained) or shell interpolation.
- Upscaling, or a per-rendition change of bitrate or GOP without updating the ladder's
  single source of truth.
- Writing a reprocessed ladder over the old one's keys: a reprocess writes under a new
  generation prefix.
