# AGENTS.md — @vp/storage (Object Keys & Storage Conventions)

Instructions for any coding agent working on `@vp/storage`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/storage` holds the S3 conventions the API, the worker, `@vp/adapters`, `@vp/db` and `@vp/ffmpeg` share: object keys,
per-extension headers and multipart sizing. Pure functions and constants, no SDK. Tier `server`, `vp.layer` 1, no
dependencies. Besides `.` it exports `./keys`.

- **Keys (`src/keys.ts`, SDD §7):** the raw upload is `raw/<videoId>/source.<ext>` (`rawPrefix`,
  `rawSourceKey`); everything published sits under `videos/<videoId>/` (`videoPrefix`): HLS under
  `hls/` for generation 1 and `hls/g<n>/` after (`renditionPrefix`, `renditionObjectKey`,
  `renditionPlaylistKey`, `masterPlaylistKey`, `reprocessPrefixesBefore`), thumbnails under `thumbs/`
  (`posterKey`, `spriteKey`, `spriteVttKey`). `sanitizeStorageUrl` strips a presigned URL's query string.
- **Headers (`src/mime.ts`):** `getHeaderMapping` gives the `Content-Type` and `Cache-Control` for an
  object by extension (`.m3u8`, `.ts`, `.jpg`, `.vtt`, `.json`, `.mp4`), `application/octet-stream`
  otherwise.
- **Multipart (`src/multipart.ts`):** `calculatePartSize` (a thousandth of the file, clamped to
  `PartSizeBounds`), `calculateTotalParts`, `MULTIPART_URL_BATCH_SIZE` and `S3_MAX_KEYS_PER_REQUEST`.

---

## 2. Invariants

- Production source never builds a `raw/` or `videos/` key by hand; it calls the helpers in `keys.ts`
  (a zero-matches row in `tests/architecture/zero-matches.test.ts`).
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
