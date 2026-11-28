# AGENTS.md — @kit/intl (Formatting on `Intl`, One Universal Core)

Instructions for any coding agent working on `@kit/intl`.

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · authority: [docs/standards/formatting-and-i18n.md](../../../../docs/standards/formatting-and-i18n.md)

---

## 1. Scope & Purpose

Every number, date, count, duration and list an app shows a person is formatted here, on the
platform's own `Intl` constructors and nothing else. A formatter is a kind, `defineKind({ name, arg,
options, render })`: `render(arg, options, context)` returns `Result<Out, FormatFailure>`, text for every
kind `format` can show, and `context` is the `FormatContext` plus `format`, so a kind composes another by
its tagged value without importing it.

A platform package (`packages/platform/`): no app vocabulary, platform dependencies only (`pnpm boundaries`). It is `universal`, layer T3, because ticket 89's server render runs it in Node and the browser runs it
again on hydration. It depends on `@kit/result` and `@kit/di` only, and owns its four failure codes:
`FormatErrorCodes` is the one place they are written, and the app spreads it into its error code set. The words around a value (the
`views` in `1.2M views`) are copy and live in the app's catalogue, not here. The app's own tagged values
(a view count, a video duration) live in the app.

The kinds it ships are in [formatting-and-i18n.md](../../../../docs/standards/formatting-and-i18n.md#3-kinds-and-tagged-values):
numbers, dates, ranges, relative time, durations, lists with `max` and `more`, names, `initials`, `capitalize`,
`timeZone`, `isolate`, `truncate`, `collator` and `pluralCategory`. `parseDecimal(text, context)` in `src/parsers/` is
the inverse for numbers and returns a `Result` like a formatter.

---

## 2. Invariants

1. **The context is an argument.** No `navigator`, `Date.now()`, zero-argument `new Date()`, `process`
   or `toLocale*` call anywhere in `src/`. The locale, the time zone and the reference instant arrive in
   `FormatContext`. `tests/architecture/intl-purity.test.ts` holds it.
2. **Every `Intl` object comes from an `IntlCache`.** Formatters never `new Intl.X` themselves. The
   cache is a value an owner creates with `createIntlCache(env)` and passes in, one per lifetime (a
   provider per locale, a container per process); never a module constant. `env` is the `IntlEnvironment`
   the constructors come from (`Intl` by default), and a kind needing one the cache has no accessor for
   passes its own `IntlDescriptor` to `cache.get`.
3. **A formatter declines, it does not throw.** An unsupported locale, an unknown option, a value of the
   wrong shape and anything `Intl` refuses become one of the four `FORMAT_*` failures. `catch` stays in
   `@kit/result`'s `tryCatch`.
4. **Values carry one literal `type`, the kind's name.** `createIntl(context, kinds)` looks it up in the
   registry it was handed (`formatKinds`, plus an app's own), never a `switch`; `TaggedValue` is derived
   from that registry, and a name it does not hold declines as `FORMAT_WRONG_KIND`.
5. **Option names are allowlisted.** Each kind declares its keys `as const satisfies OptionKeys<...>` and
   checks them with `optionKeys`, so a misspelt key fails to compile at the declaration and declines at
   runtime with the key.
6. **Values compose, they do not format.** A value constructor returns a tagged value; none builds an `Intl`
   object or a string. An app writes its own.
7. **No locale data.** The app registers the locales it serves with `defineLocales({ source, details })`
   (each tag's name in itself and its `direction`), and holds that value itself. `localeChain(tag)` walks a
   tag down to its language only (`sv-FI`, `sv`); the caller appends its own source locale.
8. **One file per formatter, a spec where it can break.** A new formatter goes in `src/formatters/` and an
   entry in `formatKinds`; an app's own goes in the registry it passes to `createIntl`, with no edit here.
9. **A default narrows nothing.** A kind applies each default only when no sibling of the same pair is given
   (`percent` with `minimumFractionDigits: 2` is `7.00%`), so an override never turns a valid call into a `RangeError`.
10. **A calendar date is not an instant.** `date`, `time` and `dateTime` decline `2024-05-01`, which read as UTC
    midnight is the day before west of UTC; `plainDate` reads it in no zone.
11. **Rounding is symmetric and a unit follows it.** `relative` rounds half away from zero and picks the unit
    after, so `3570 s` reads "in 1 hour" and "1 hour ago".
12. **A package ships no words.** "and N more" is the `more` copy the caller passes; a source scan fails on an English
    literal in `src/`. A `toLocaleUpperCase` call is allowed only with the context's locale as its argument.
13. **Parsers read separators from `Intl`.** `parseDecimal` derives grouping, decimal, minus and numerals from
    `Intl.NumberFormat.formatToParts`, never a table, and declines grouping the locale does not use.
14. **Presets are data the app registers.** `definePresets` freezes a table of named option sets per kind and
   `resolveEntry` resolves a name along the locale chain, then `default`, with `{ preset, ...overrides }` laid
   over it. The message engine and a server render call the same function. `FormatPresets` is the token the
   app provides the table under; it has no default.

---

## 3. Testing

Specs assert shape, not glyphs: `Intl` output moves between ICU versions and between Node and Bun, so a
spec pins ordering, grouping and digits, and uses a pattern where engines disagree on a space or an
abbreviation. The suites run under node and again under jsdom (`vitest.jsdom.config.ts`), and under
`bun test`.

`duration-fallback.test.ts` runs the fallback against the engine's own `Intl.DurationFormat` over 17 locales, 6 option
sets and 6 durations (days included) and asserts equal strings, so a drift in the fallback fails on the engine that
has the constructor. It skips where the constructor is absent; a second test builds a cache from an
`IntlEnvironment` without `DurationFormat`, which exercises the fallback on every runtime.

### Runtime matrix

`Intl.DurationFormat` is native on:

| Runtime | Native | Source |
|---|---|---|
| Node 24.10 (ICU 77.1), and jsdom on it | yes | run: conformance table green |
| Bun 1.4.2 | yes | run: conformance table green under `bun test` |
| Chrome and Edge 129+, Safari 18.4+, Firefox 136+ | yes | MDN, documented, not run |

### Known engine differences

The fallback is built from the same engine's `NumberFormat`, `ListFormat` and `DateTimeFormat`, so within one
runtime native and fallback agree on every case in the table (612 of 612 on Node and on Bun). Engines differ from each
other, which is why no spec pins a literal outside a locale's own rules and why `duration.test.ts` asserts the
same text with and without the native constructor, never a string copied from one engine. Observed Node 24.10 against
Bun 1.4.2 (116 of the 612 cases differ):

| Locale, style, duration | Node 24.10 | Bun 1.4.2 |
|---|---|---|
| `de` `long`, 1 d 2 h | `1 Tag, 2 Stunden` | `1 Tag und 2 Stunden` |
| `de` `narrow`, 5 min | `5 Min.` | `5min` |
| `pl` `narrow`, 2 h 1 min 1 s | `2 h, 1 min i 1 s` | `2h 1min 1s` |
| `hi` `long`, 2 h 1 min 1 s | `2 घंटे, 1 मिनट, और 1 सेकंड` | `2 घंटे, 1 मिनट और 1 सेकंड` |
| `pt-BR` `short`, 1 s | `1 s` | `1 seg` |
| `ru` `digital`, 1 d 2 h | `1 дн. 2:00:00` | `1 дн 2:00:00` |
| `ja` `digital`, 1 d 2 h | `1 日 2:00:00` | `1日 2:00:00` |
| `he` `digital`, 1 d 2 h | `1 יום, 2:00:00` | `1 יום ו-2:00:00` |
| `ar` `digital`, 1 d 2 h | `يوم و2:00:00` | `يوم 2:00:00` |

Bun's `ListFormat` also places bidi isolates around Latin items in `ar`; V8's does not. A spec that must hold on both
matches the digits and the order, not the separators.

```bash
pnpm --filter @kit/intl typecheck
pnpm --filter @kit/intl test
```
