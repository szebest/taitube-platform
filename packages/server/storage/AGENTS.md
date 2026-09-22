# AGENTS.md — @vp/storage (Object Keys & Storage Conventions)

Instructions for any coding agent working on `@vp/storage`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/storage` standardizes S3-compatible object keys, bucket topologies, and upload parameters for MinIO and Cloudflare R2:
- **Bucket Topologies:**
  - `raw`: Private bucket for unprocessed uploads (`raw/<videoId>/<uploadId>/source.<ext>`).
  - `public`: Public bucket for finished HLS playlists, video segments, posters, and WebVTT scrub thumbnails (`videos/<videoId>/...`).
- **Single Source of Truth:** Key formats are defined exclusively in `packages/server/storage/src/keys.ts`.
- **MIME Types:** Validation and mapping for video files (`video/mp4`, `video/quicktime`, `video/webm`).

---

## 2. Invariants

- Never assemble hardcoded S3 key strings in application code; always call `storageKeys.*` helper functions.
- Updating key conventions requires updating `docs/SDD.md` §7 in the same PR.

---

## 3. Dedicated Skills

- **`s3-storage`**
- **`cloudflare-r2`**
- **`minio`**

---

## 4. Local Commands

```bash
pnpm --filter @vp/storage typecheck
pnpm --filter @vp/storage test
```
