---
name: web-player-hls
description: HLS video player integration, WebVTT storyboard scrubbing, and playback QoS telemetry.
---

# Web: HLS Video Player & Telemetry

Guide for implementing video playback, HLS ABR streaming, and thumbnail scrub bars in `@vp/web`.

---

## 1. HLS Engine & ABR Switching

- Use `hls.js` for playback on browsers without native HLS support.
- Stream `.m3u8` master playlist from MinIO/R2 public bucket (`/public/videos/<id>/hls/master.m3u8`).
- Maintain keyframe alignment across renditions (1080p, 720p, 480p) to allow seamless level switching.

---

## 2. WebVTT Thumbnail Scrub Previews

- Scrub thumbnails are generated as sprite sheets with a companion WebVTT file (`/public/videos/<id>/thumbnails/storyboard.vtt`).
- The player scrub bar parses the WebVTT file to display frame previews on hover at the exact timestamp:

```typescript
export function useScrubPreview(vttUrl: string) {
  // Parses WebVTT cues: start, end, sprite coordinates (xywh=x,y,w,h)
  // Returns active preview image URL and background position for hovered time
}
```

---

## 3. Playback Telemetry Beacon

Send non-blocking telemetry beacons (`navigator.sendBeacon`) on:
- Playback start (latency measurement).
- Buffering stalls (stall count & duration).
- 10-second playback intervals (view verification cooldown).
- Rendition level switches (QoS tracking).
