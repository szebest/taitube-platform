# tools/hls-test-page — Static HLS Test Page & SSE Monitor

A self-contained, local-first static test page for verifying HLS video playback and real-time Server-Sent Events (SSE) progress streams.

## Features

- **Local-First & Offline Capable**: Uses vendored `hls.js` (located in `vendor/hls.min.js`), completely eliminating any third-party CDN dependency (SDD P9, PRD FR-19).
- **HLS Player**: Automatically attaches `hls.js` or uses native HLS playback (Safari/iOS) to play adaptive bitrate playlists (`.m3u8`).
- **Real-Time Pipeline Progress**: Visualizes live transcode progress across all ladder renditions (`1080p`, `720p`, `480p`, and overall) as defined in SDD §20.
- **SSE Event Log**: Displays structured logs for `snapshot`, `progress`, and `status` SSE events.
- **Mock Simulation**: Includes a "Simulate Mock SSE" button that plays through a simulated transcode event lifecycle to verify UI rendering without requiring a running backend.

## Usage

Simply open `index.html` in your browser:

```bash
# On macOS
open tools/hls-test-page/index.html

# On Linux
xdg-open tools/hls-test-page/index.html

# On Windows
start tools/hls-test-page/index.html
```

Or serve via any static file server:
```bash
npx serve tools/hls-test-page
```
