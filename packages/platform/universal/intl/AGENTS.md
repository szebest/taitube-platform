# AGENTS.md — @kit/intl (Formatting on `Intl`, One Universal Core)

Instructions for any coding agent working on `@kit/intl`.

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

Every number, date, count, duration and list an app shows a person is formatted here, on the
platform's own `Intl` constructors and nothing else. A formatter takes a tagged value and a
`FormatContext` and returns `Result<string, FormatFailure>`.

A platform package (`packages/platform/`): no app vocabulary, platform dependencies only (`pnpm boundaries`). It is `universal`, layer T2, because ticket 89's server render runs it in Node and the browser runs it
again on hydration. It depends on `@kit/result` only, and owns its four failure codes:
`FormatErrorCodes` is the one place they are written, and the app spreads it into its error code set. The words around a value (the
`views` in `1.2M views`) are copy and live in the app's catalogue, not here. The app's own tagged values
(a view count, a video duration) live in the app.

---

## 2. Invariants

1. **The context is an argument.** No `navigator`, `Date.now()`, zero-argument `new Date()`, `process`
   or `toLocale*` call anywhere in `src/`. The locale, the time zone and the reference instant arrive in
   `FormatContext`. `tests/architecture/intl-purity.test.ts` holds it.
2. **Every `Intl` object comes from an `IntlCache`.** Formatters never `new Intl.X` themselves. The
   cache is a value an owner creates with `createIntlCache()` and passes in, one per lifetime (a
   provider per locale, a container per process); never a module constant.
3. **A formatter declines, it does not throw.** An unsupported locale, an unknown option, a value of the
   wrong shape and anything `Intl` refuses become one of the four `FORMAT_*` failures. `catch` stays in
   `@kit/result`'s `tryCatch`.
4. **Values carry one literal `type`.** `formatValue` switches on it exhaustively, with `assertNever` in
   the default. `FORMAT_KINDS` and the union are held equal at compile time by `KindsMatchUnion`.
5. **Option names are allowlisted.** Each formatter declares its keys `as const satisfies OptionKeys<...>`
   and wraps itself in `withOptions`, so a misspelt key fails to compile at the declaration and declines at
   runtime with the key.
6. **Values compose, they do not format.** A value constructor returns a tagged value; none builds an `Intl`
   object or a string. An app writes its own.
7. **No locale data.** The app registers the locales it serves with `defineLocales({ source, details })`
   (each tag's name in itself and its `direction`), and holds that value itself. `localeChain(tag)` walks a
   tag down to its language only (`sv-FI`, `sv`); the caller appends its own source locale.
8. **One file per formatter, a spec where it can break.** A new formatter goes in `src/formatters/`, gets a
   member in `TaggedValue`, a kind in `FORMAT_KINDS` and a case in `formatValue`.

---

## 3. Testing

Specs assert shape, not glyphs: `Intl` output moves between ICU versions and between Node and Bun, so a
spec pins ordering, grouping and digits, and uses a pattern where engines disagree on a space or an
abbreviation. The suites run under node and again under jsdom (`vitest.jsdom.config.ts`), and under
`bun test`.

```bash
pnpm --filter @kit/intl typecheck
pnpm --filter @kit/intl test
```
