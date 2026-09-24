# AGENTS.md — tools (Non-Package Developer Assets)

Instructions for any coding agent working in `tools/`.

---

## 1. Directory Inventory

`tools/` holds developer assets that are **not** workspace packages — they have no `package.json`,
no tier and no layer.

```
tools/
├── chaos/          # Bash fault injectors: kill-worker.sh, redis-restart.sh, disk-fill.sh, toxiproxy-toxic.sh
└── hls-test-page/  # index.html HLS playback page over a vendored vendor/hls.min.js; compose serves it (profile tools, :8080)
```

The four CLI **packages** that used to live here are workspace packages, so they now sit under
`packages/server/` with every other server-tier package:

| Package | Location | What it does |
|---|---|---|
| `@vp/compose-autoscaler` | `packages/server/compose-autoscaler` | Queue-depth autoscaler daemon for local Docker Compose |
| `@vp/dev-token` | `packages/server/dev-token` | Mints and verifies EdDSA dev JWTs, prints the dev JWKS and serves it over HTTP (`mint`, `verify`, `jwks`, `serve`) |
| `@vp/gen-video` | `packages/server/gen-video` | Deterministic synthetic video fixture generator (FFmpeg) |
| `@vp/upload-client` | `packages/server/upload-client` | Reference CLI for resumable multipart uploads |

Their root scripts are unchanged: `pnpm gen-video`, `pnpm dev-token`, `pnpm upload-client`,
`pnpm compose-autoscaler`.

**Adding something here?** If it needs a `package.json`, it is a package — put it under
`packages/<tier>/` and give it a `vp.layer` (the directory is its tier; `pnpm boundaries` refuses a `vp.tier`
there). `tools/` is for scripts and static assets only.

---

## 2. Invariants & Rules

1. **Local-First & Offline:** All tools must execute completely offline without cloud dependencies.
2. **Manifest-Driven Fixtures:** `gen-video` builds each fixture in `packages/server/gen-video/manifest.json` with FFmpeg; `--check` uses ffprobe to verify a video stream, its dimensions, duration (within 1.5 s) and rotation. It prints a SHA-256 but compares none, so fixtures are not held bit-for-bit.
3. **One script runner:** `tools/` holds no TypeScript. The CLI packages' root scripts run through `tsx`, never `bun <file>.ts`; Bun is a test runtime only.

---

## 3. Dedicated Skills & References

- **`vp-chaos-toxiproxy`**: Operating and scripting chaos injection scenarios.
- **`vp-keda-queue-autoscaling`**: Autoscaler mechanics and tuning.
- **`vp-ffmpeg-hls-ladder`**: Media fixture generation parameters.
