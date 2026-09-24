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

Or serve it from the compose stack, which is what the sample button needs (a browser will not fetch a
playlist from a `file://` page):
```bash
make hls-sample
docker compose -f infra/compose/docker-compose.yml --profile tools up -d hls-test-page   # http://localhost:8080
```

**Play Local Sample** plays `sample/index.m3u8` beside the page, which `make hls-sample` cuts from the
`s15` fixture; nothing is fetched from another host.
