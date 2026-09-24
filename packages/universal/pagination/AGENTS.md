# AGENTS.md — @vp/pagination (Keyset Cursors & the Paginator)

Instructions for any coding agent working on `@vp/pagination`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/pagination` is the one keyset pagination mechanism in the repo: `Paginator`, the `limit + 1`
protocol, and the pluggable `CursorCodec` (default `Base64UrlCursorCodec`) that decides how a cursor
travels over HTTP. `invalidCursor` is its `INVALID_CURSOR` input failure.

It is `universal` because both sides of the wire need the same codec. `@vp/api-contracts` validates an
inbound cursor with `Base64UrlCursorCodec` (`videos.ts`) and the API mints one through the `Paginator`
built in `apps/api/src/composition/services.module.ts`.

---

## 2. Invariants

1. **One mechanism.** Every paginated endpoint goes through `Paginator`. Repositories return
   `limit + 1` rows and never encode a cursor; the extra row is the only evidence a further page exists
   and it never reaches the client.
2. **One codec, not a copy.** A caller that needs to read a cursor uses `CursorCodec`. Do not
   reimplement base64url decoding anywhere else — that duplication is exactly what this package deleted.
3. **Runtime-agnostic by construction.** `btoa`/`atob` and `TextEncoder`, never `Buffer`, so the codec
   runs unchanged under Node, Bun and the browser.
4. **Page bounds are injected, and this package owns the default.** `PAGE_SIZE_DEFAULT` /
   `PAGE_SIZE_MAX` are exported here and nowhere else: `@vp/api-contracts` builds `PageLimitSchema`
   from them and `@vp/env-schema` uses them as the defaults of the env keys of the same name, which
   the composition root resolves once and hands to `Paginator`. No call site hard-codes a page size.
5. **A configured maximum clamps, it does not reject.** `Paginator.limit()` trims a request into
   `[1, maxLimit]`, so a deployment running below the advertised maximum serves a shorter page and
   keeps walking with `nextCursor`. That is deliberate — the maximum protects the database, and the
   published contract is not a per-deployment document. `PageLimitSchema`'s description says so.
6. **Relative imports are extensionless** (`./cursor-codec`), as in every tier (`esm-specifiers.test.ts`).

---

## 3. Local Commands

```bash
pnpm --filter @vp/pagination typecheck
pnpm --filter @vp/pagination test
```
