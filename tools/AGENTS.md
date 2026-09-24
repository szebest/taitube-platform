# AGENTS.md — tools (Non-Package Developer Assets)

Instructions for any coding agent working in `tools/`.

---

## 1. Directory Inventory

`tools/` holds developer assets that are **not** workspace packages — they have no `package.json`,
no tier and no layer.

```
tools/
├── chaos/          # Chaos injection scripts (kill-worker, redis-restart, disk-fill, toxiproxy)
└── hls-test-page/  # Vendored HTML/JS test harness for local HLS playback verification
```

The four CLI **packages** that used to live here are workspace packages, so they now sit under
`packages/server/` with every other server-tier package:

| Package | Location | What it does |
|---|---|---|
| `@vp/compose-autoscaler` | `packages/server/compose-autoscaler` | Queue-depth autoscaler daemon for local Docker Compose |
| `@vp/dev-token` | `packages/server/dev-token` | Ed25519 JWT generator and local standalone JWKS mock server |
| `@vp/gen-video` | `packages/server/gen-video` | Deterministic synthetic video fixture generator (FFmpeg) |
| `@vp/upload-client` | `packages/server/upload-client` | Reference CLI for resumable multipart uploads |

Their root scripts are unchanged: `pnpm gen-video`, `pnpm dev-token`, `pnpm upload-client`,
`pnpm compose-autoscaler`.

**Adding something here?** If it needs a `package.json`, it is a package — put it under
`packages/<tier>/` and give it a `vp.tier` and `vp.layer`. `tools/` is for scripts and static assets only.

---

## 2. Invariants & Rules

1. **Local-First & Offline:** All tools must execute completely offline without cloud dependencies.
2. **Deterministic Outputs:** `gen-video` generates bit-for-bit identical test media fixtures matching the JSON manifest checksums.
3. **One script runner:** TypeScript here runs through `tsx`, never `bun <file>.ts`. Bun is a test runtime only.

---

## 3. Dedicated Skills & References

- **`vp-chaos-toxiproxy`**: Operating and scripting chaos injection scenarios.
- **`vp-keda-queue-autoscaling`**: Autoscaler mechanics and tuning.
- **`vp-ffmpeg-hls-ladder`**: Media fixture generation parameters.
