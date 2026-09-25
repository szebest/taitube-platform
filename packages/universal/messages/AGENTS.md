# AGENTS.md — @vp/messages (Typed Messages & the Copy Catalogues)

Instructions for any coding agent working on `@vp/messages`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

The product's user-facing words: `dt()` to declare a message, `createTranslator()` for `t` / `tOr`, one
catalogue per locale organised per feature (`src/en/`), and `ERROR_COPY`, the copy for every `ErrorCode`.

`universal`, layer T3, on top of `@vp/intl`. The browser renders it today and ticket 89's server render
will too. **No server package or app may import it**: the API returns a `code`, the client chooses the
words (`tests/architecture/messages-are-client-only.test.ts`).

---

## 2. Invariants

1. **The template is the type.** `dt('{count:plural} views', ...)` makes `count` a required `number`
   argument; `{x:date}` takes an ISO string, `{x:list}` a string array, `{x:enum}` one of the labels its
   config declares, `{x}` text or a number. A missing or misspelt argument is a compile error.
2. **The placeholder grammar is flat.** `{name}` or `{name:type}` and nothing nested. A plural's branches
   live in the config and select through `Intl.PluralRules`; `{?}` in a branch is the count. Anything
   richer needs a real parser, not a longer regex.
3. **Every placeholder renders through `@vp/intl`**, so a message and a direct format agree byte for byte.
4. **`t` returns a `Result`.** A missing key is a failure carrying the key; `tOr(key, args, fallback)` is
   the render-path form.
5. **The chain is walked per key**: `sv-FI`, `sv`, `en`. A partial catalogue is useful, never broken.
6. **`en` is the complete catalogue**, and the one that ships. A new locale is a `PartialCatalogue` passed
   to `createTranslator`, which is data rather than a refactor.
7. **`ERROR_COPY` is total over `ErrorCode`** and points at argument-free keys only, so a new code does
   not compile until it has words (`tests/architecture/error-copy-coverage.test.ts`).

---

## 3. Local Commands

```bash
pnpm --filter @vp/messages typecheck
pnpm --filter @vp/messages test
```
