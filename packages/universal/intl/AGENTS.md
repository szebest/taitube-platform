# AGENTS.md — @vp/intl (Formatting on `Intl`, One Universal Core)

Instructions for any coding agent working on `@vp/intl`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

Every number, date, count, duration and list the product shows a person is formatted here, on the
platform's own `Intl` constructors and nothing else. A formatter takes a tagged value and a
`FormatContext` and returns `Result<string, FormatFailure>`.

It is `universal`, layer T2, because ticket 89's server render runs it in Node and the browser runs it
again on hydration. It depends on `@vp/result` and `@vp/errors` only. The words around a value (the
`views` in `1.2M views`) are copy and live in `@vp/messages`, not here.

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
   `@vp/result`'s `tryCatch`.
4. **Values carry one literal `type`.** `formatValue` switches on it exhaustively, with `assertNever` in
   the default. `FORMAT_KINDS` and the union are held equal at compile time by `KindsMatchUnion`.
5. **Option names are allowlisted.** Each formatter declares its keys `as const satisfies OptionKeys<...>`
   and wraps itself in `withOptions`, so a misspelt key fails to compile at the declaration and declines at
   runtime with the key.
6. **Domain values compose, they do not format.** `views`, `videoDuration`, `publishedAt` and the rest
   return tagged values; none builds an `Intl` object or a string.
7. **One file per formatter, one spec per file.** A new formatter goes in `src/formatters/`, gets a
   member in `TaggedValue`, a kind in `FORMAT_KINDS` and a case in `formatValue`.

---

## 3. Testing

Specs assert shape, not glyphs: `Intl` output moves between ICU versions and between Node and Bun, so a
spec pins ordering, grouping and digits, and uses a pattern where engines disagree on a space or an
abbreviation. The suites run under node and again under jsdom (`vitest.jsdom.config.ts`), and under
`bun test`.

```bash
pnpm --filter @vp/intl typecheck
pnpm --filter @vp/intl test
```
