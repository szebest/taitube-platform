# AGENTS.md — @vp/shared-messages (the shared words and the app's message engine)

Instructions for any coding agent working on `@vp/shared-messages`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../docs/standards/formatting-and-i18n.md) · engine: [@kit/i18n](../../platform/universal/i18n/AGENTS.md)

---

## 1. Scope & Purpose

The app side of translation that more than one consumer needs:

- `src/engine.ts`: the product's engine, `defineEngine` from `@kit/i18n` over the built-in kinds, the presets and
  `PARAMS` (`src/params.ts`, the closed vocabulary of placeholder names). It exports `dt`, `defineCatalogue` and
  `createI18n`; every catalogue in the repository declares its messages with this `dt`.
- `src/en/`, `src/pl/`: the words both apps render, or a client and a server: `auth`, `browse`, `videos`,
  `errors` (with `errors-comments`), `errorPage` and `ui`. The `en` aggregate is `en`; `pl` is on the `./pl`
  entry, so only an app's lazy translation chunk imports it.
- `src/error-copy.ts`: `ERROR_COPY`, the copy key for every `ErrorCode`.
- `src/locales.ts`: `LOCALES`, the app's `defineLocales` (`en`, the source, and `pl`), also on the `./locales`
  entry, which the API reads without the catalogues.
- `src/catalogue.ts`: `SharedCatalogue`, `SharedMessageKey`, `sharedI18n` (what `@vp/queries` renders its own
  words with).

Each app's own words live in `apps/client/<app>/src/lib/messages/`, merged with these into the app's catalogue.
`universal`: a server may import it.

---

## 2. Invariants

1. **Only shared words.** A key here has two consumers, web and studio or a client and a server, in the
   type-aware scan (`tests/architecture/translation-layers.test.ts`). A word one app alone renders goes into that
   app's catalogue.
2. **One engine.** Every catalogue uses this `dt`, so every template is checked against the same kinds, presets
   and `PARAMS`; a new placeholder name is one line in `params.ts`.
3. **Every `pl` file takes the source's params**: `pl/index.ts` is declared with `defineCatalogue<typeof en>()`,
   so a dropped, renamed or retyped argument fails to compile, and every key is in both
   (`catalogue-parity.test.ts`). Each plural holds exactly its locale's categories (`plural-categories.test.ts`).
4. **`ERROR_COPY` is total over `ErrorCode`** and points at argument-free keys only, so a new code does not
   compile until it has words (`tests/architecture/error-copy-coverage.test.ts`).
5. **No ambient read**: no `navigator`, clock or `process` (`intl-purity.test.ts`).

---

## 3. Local Commands

```bash
pnpm --filter @vp/shared-messages typecheck
pnpm --filter @vp/shared-messages test
```
