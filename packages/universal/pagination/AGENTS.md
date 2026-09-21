# AGENTS.md — @vp/pagination (Keyset Cursors & the Paginator)

Instructions for any coding agent working on `@vp/pagination`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)
---

## 1. Scope & Purpose

`@vp/pagination` is the one keyset pagination mechanism in the repo: `Paginator`, the `limit + 1`
protocol, and the pluggable `CursorCodec` that decides how a cursor travels over HTTP.

It is `universal` because both sides of the wire need the same codec. `@vp/api-contracts` validates an
inbound cursor with it and the API mints one with it; before the split, a server-tier home forced
`@vp/api-contracts` to carry a second, browser-safe decoder.

---

## 2. Invariants

1. **One mechanism.** Every paginated endpoint goes through `Paginator`. Repositories return
   `limit + 1` rows and never encode a cursor; the extra row is the only evidence a further page exists
   and it never reaches the client.
2. **One codec, not a copy.** A caller that needs to read a cursor uses `CursorCodec`. Do not
   reimplement base64url decoding anywhere else — that duplication is exactly what this package deleted.
3. **Runtime-agnostic by construction.** `btoa`/`atob` and `TextEncoder`, never `Buffer`, so the codec
   runs unchanged under Node, Bun and the browser.
4. **Page bounds are injected.** `PAGE_SIZE_DEFAULT` / `PAGE_SIZE_MAX` are resolved once at the
   composition root and handed to `Paginator`; no call site hard-codes a page size.
5. **Relative imports carry `.js`** (`./cursor-codec.js`), because CRA's webpack refuses extensionless ESM.

---

## 3. Local Commands

```bash
pnpm --filter @vp/pagination typecheck
pnpm --filter @vp/pagination test
```
