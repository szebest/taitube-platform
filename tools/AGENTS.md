# AGENTS.md — tools (Developer Tooling & Utilities)

Instructions for any coding agent working on developer tools and CLI utilities (`tools/`).

---

## 1. Directory Inventory

```
tools/
├── chaos/               # Chaos injection scripts (kill-worker, redis-restart, disk-fill, toxiproxy)
├── compose-autoscaler/  # Queue-depth autoscaler daemon for local Docker Compose
├── dev-token/           # Ed25519 JWT generator and local standalone JWKS mock server
├── gen-video/           # Deterministic synthetic video fixture generator (FFmpeg)
├── hls-test-page/       # Vendored HTML/JS test harness for local HLS playback verification
└── upload-client/       # Reference CLI for resumable multipart uploads
```

---

## 2. Invariants & Rules

1. **Local-First & Offline:** All tools must execute completely offline without cloud dependencies.
2. **Deterministic Outputs:** `gen-video` generates bit-for-bit identical test media fixtures matching the JSON manifest checksums.
3. **No Proprietary Runtime Locks:** CLI tools written in TypeScript must run cleanly with both `tsx` (Node) and `bun`.

---

## 3. Dedicated Skills & References

- **`vp-chaos-toxiproxy`**: Operating and scripting chaos injection scenarios.
- **`vp-keda-queue-autoscaling`**: Autoscaler mechanics and tuning.
- **`vp-ffmpeg-hls-ladder`**: Media fixture generation parameters.
