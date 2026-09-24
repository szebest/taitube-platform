# AGENTS.md — @vp/upload-client (server tier)

Instructions for any coding agent working on `packages/server/upload-client`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope

Reference CLI for resumable multipart uploads, the worked example of the presigned upload flow:
`POST /v1/uploads`, part URLs from `POST /v1/uploads/<id>/parts`, a `PUT` per part straight to storage,
then `POST /v1/uploads/<id>/complete` (a single `PUT` to `singleUrl` when the API picks the `single`
strategy). `--resume <uploadId>` reads `GET /v1/uploads/<id>` and uploads only
the missing parts; `--abort <uploadId>` sends `DELETE`. `UploadClient` (`src/client.ts`) is the library,
`src/cli.ts` the flag parsing, `src/main.ts` the entrypoint (`vp-upload` bin).

This is a **workspace package with a CLI**, not a loose script, which is why it lives under
`packages/server/` rather than `tools/`. `tools/` is for assets with no `package.json`.

- **Tier `server`**, Node/Bun only.
- **`vp.layer` 6**, above the applications, because its spec boots `apps/api` (`composeApp`) against a
  stub S3 to drive a real resumable upload end to end. What the package *ships* is `@vp/logger` and
  `@vp/result`; the layer records the whole manifest, devDependencies included.

---

## 2. Invariants

1. **Local-first (Rule 1):** runs fully offline, no external host, nothing phones home.
2. **Dual runtime (Rule 2):** the root `pnpm upload-client` script runs it through `tsx`, and it must still run cleanly under `bun`, which `pnpm test:bun` proves.
3. **1:1 tests (Rule 12):** every source file has a name-matching test file, except `src/client.ts`
   (spec `upload-client.test.ts`), which is on the shrink-only list in
   `tests/architecture/untested-sources.ts`.

---

## 3. Local Commands

```bash
pnpm upload-client            # from the repo root
pnpm --filter @vp/upload-client typecheck
pnpm --filter @vp/upload-client test
```
