# AGENTS.md — @vp/storage (Object Keys & Storage Conventions)

Instructions for any coding agent working on `@vp/storage`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/storage` holds the S3 conventions the API, the worker, `@vp/adapters`, `@vp/db` and `@vp/ffmpeg`
share: object keys, per-extension headers and multipart sizing. Pure functions and constants, no SDK. Tier
`server`, `vp.layer` 1; its dependencies are in [package.json](package.json). Besides `.` it exports `./keys`.

- **Keys (`src/keys.ts`, SDD §7):** the raw upload is `raw/<videoId>/source.<ext>`; everything published
  sits under `videos/<videoId>/`: HLS under `hls/` for generation 1 and `hls/g<n>/` after, thumbnails under
  `thumbs/`.
- **Headers (`src/mime.ts`):** `getHeaderMapping` gives an object's `Content-Type` and `Cache-Control` by
  extension, `application/octet-stream` for an unknown one.
- **Multipart (`src/multipart.ts`):** a part is a thousandth of the file, clamped to `PartSizeBounds`.

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
