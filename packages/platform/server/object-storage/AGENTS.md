# AGENTS.md — @kit/object-storage (Object Headers & Multipart Sizing)

> Tier rules for this directory: [../AGENTS.md](../../../server/AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../../AGENTS.md)

---

## 1. Scope & Purpose

Pure functions and constants for an S3-compatible bucket, no SDK. Tier `server`, `vp.layer` 1; its
dependencies are in [package.json](package.json). The key layout of this product stays in `@vp/storage`.

- **Headers (`src/mime.ts`):** `getHeaderMapping` gives an object's `Content-Type` and `Cache-Control` by
  extension, `application/octet-stream` for an unknown one.
- **Multipart (`src/multipart.ts`):** a part is a thousandth of the file, clamped to `PartSizeBounds`.

---

## 2. Invariants

- No product value: no key, prefix or host of this product.
- Runs unchanged under Node and Bun.

---

## 3. Local Commands

```bash
pnpm --filter @kit/object-storage typecheck
pnpm --filter @kit/object-storage test
```
