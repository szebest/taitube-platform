# Formatting & i18n

The authority for how a number, date, count or sentence reaches a person. Design and rejected
alternatives: [SDD ADR-26](../SDD.md#adr-26--formatting-and-i18n-one-universal-intl-core-catalogues-out-of-the-server).
Enforcement: [ARCHITECTURE.md Invariant 10](../../ARCHITECTURE.md).

| Package | Tier, layer | Holds |
|---|---|---|
| `@vp/intl` | universal, T2 | formatters, the value union, option allowlists, `IntlCache`, `localeChain` |
| `@vp/messages` | universal, T3 | `dt()`, `createTranslator()` (`t`, `tOr`), one catalogue per locale, `ERROR_COPY`, the supported-locale list (`SUPPORTED_LOCALES`, `LOCALE_DETAILS`) |
| `@vp/intl-react` | client, T4 | `IntlProvider`, `useT`, `useFormat`, `<Format>`, `createLocaleStore()`, zone and clock detection |
| `@vp/queries` | client, T5 | `requestLocale()`: the negotiation chain, the one module that reads `Accept-Language` and `navigator.languages` |

---

## 1. Formatter or message?

- **A value on its own** (a view count badge, a duration, a date in a table cell): a formatter.
  `<Format value={videoDuration(video.durationSeconds)} />` or `useFormat().format(...)`.
- **A value inside words** (`1.2M views`, `Published 22 Sept 2026`): a message.
  `useT().tOr('videos.views', { count }, '')`.
- **Words with no value** (an error, a label): a message with no placeholders.

A component never builds the string itself: no `${n} views`, no `toLocaleString()`, no `toFixed`.

## 2. The value union

A formatter reads a value tagged with one literal `type`, and `formatValue` switches on it:

```ts
type FormatValue =
  | string                                            // as authored
  | number                                            // plain decimal
  | { type: 'count'; value: number; options?: CompactOptions }      // 1.2M
  | { type: 'number'; value: number; options?: NumberOptions }      // 1,500 · 3 days
  | { type: 'percent'; value: number; options?: PercentOptions }    // percentage points: 7 is 7%
  | { type: 'bytes'; value: number; options?: BytesOptions }        // 4.5 MB
  | { type: 'bitrate'; value: number; options?: BitrateOptions }    // 4.5 Mb/s, in bits per second
  | { type: 'numberRange'; value: readonly [number, number]; options?: NumberOptions }
  | { type: 'money'; value: number; units?: 'minor' | 'major'; options?: MoneyOptions }
  | { type: 'date' | 'time' | 'dateTime'; value: string; options?: ... }   // ISO 8601 only
  | { type: 'dateRange'; value: readonly [string, string]; options?: DateOptions }
  | { type: 'relative'; value: string; now?: string; options?: RelativeOptions }   // 3 days ago
  | { type: 'calendarDay'; value: string; now?: string }            // today 18:30, yesterday
  | { type: 'duration'; value: number; options?: DurationOptions }  // 12:45, 1 hr, 2 min
  | { type: 'list'; value: readonly string[]; options?: ListOptions }
  | { type: 'displayName'; value: string | USER; of: DisplayNameType };
```

`FORMAT_KINDS` lists the tags and `KindsMatchUnion` holds it equal to the union at compile time. Domain
values (`views`, `subscribers`, `commentCount`, `videoDuration`, `fileSize`, `uploadProgress`, `resolution`,
`publishedAt`) return one of these; they never build a string or an `Intl` object. `collator` returns a
comparator and `truncate` cuts on graphemes; `pluralCategory` picks a branch.

A formatter returns `Result<string, FormatFailure>`, one of `FORMAT_UNSUPPORTED_LOCALE`,
`FORMAT_UNKNOWN_OPTION`, `FORMAT_WRONG_KIND`, `FORMAT_UNRENDERABLE`.

## 3. Option allowlists

Each formatter declares the options it takes and derives its option type from the list:

```ts
export const COMPACT_OPTION_KEYS = [
  'compactDisplay',
  'maximumFractionDigits',
] as const satisfies OptionKeys<Intl.NumberFormatOptions>;

export type CompactOptions = Pick<Intl.NumberFormatOptions, (typeof COMPACT_OPTION_KEYS)[number]>;
```

A misspelt key fails to compile where it is declared, and `withOptions` declines an unnamed key at runtime
with the key in the failure. A formatter's own option names (`base` on `bytes`, `style` on the date family)
go in `OptionKeys`' second argument. Prefer a named style (`{ style: 'short' }`) to spelt-out fields at a call
site: one decision instead of thirty that drift.

## 4. Placeholders

```ts
views: dt('{count:plural}', {
  plural: { count: { one: '{?} view', other: '{?} views', formatter: { notation: 'compact' } } },
}),
```

| Token | Argument | Renders through |
|---|---|---|
| `{name}` | `string \| number` | as authored, or `number` |
| `{name:number}` | `number` | `number`, options from `config.number[name]` |
| `{name:date}` | ISO 8601 `string` | `date`, options from `config.date[name]` |
| `{name:list}` | `readonly string[]` | `list`, options from `config.list[name]` |
| `{name:plural}` | `number` | `Intl.PluralRules` picks `config.plural[name][category]`; `{?}` is the count |
| `{name:enum}` | a key of `config.enum[name]` | the label |

Argument names and types are read off the template at compile time, so a misspelt or wrongly typed
argument does not compile. The grammar is flat: no nesting, no escapes. A plural with `type: 'ordinal'` is
how `3rd` is written; the suffixes are copy.

`t` returns a `Result`, and a missing key is a failure carrying the key. `tOr(key, args, fallback)` is the
render-path form. Keys walk the locale chain per key: `sv-FI`, `sv`, `en`.

## 5. SSR rules

- The locale, time zone, currency and reference instant are arguments. `@vp/intl` and `@vp/messages` never
  read `navigator`, the clock, `process` or a `toLocale*` method (`intl-purity.test.ts`).
- `relative` and `calendarDay` measure from the value's `now`, else the context's.
- `IntlProvider` is told its `locale`, it never detects one. A server render passes `locale`, `timeZone` and
  `now`, and the browser hydrates with the same: the negotiated locale travels in router context and the
  router's dehydrated data, and the browser loads its catalogue before it hydrates.
- `<html lang>` and `dir` come from the negotiated locale (`ThemedDocument`'s `lang` and `dir`).
- `queries`' `app-words.dom.test.tsx` hydrates a server render at every supported locale and asserts the
  markup is byte-identical; a new surface that reads the runtime in render fails it before it ships.

## 6. Locale negotiation

One module decides the locale, `packages/client/queries/src/request-locale.ts`, called from each app's root
`beforeLoad`. The first candidate a supported locale serves wins (`pl-PL` is `pl`, a malformed tag is skipped):

1. the `lang` search param (`?lang=pl`, what an `hreflang` alternate links to);
2. the saved preference (the web's device preferences cookie, `locale`);
3. `Accept-Language` during a server render;
4. `navigator.languages` on a client-only navigation;
5. `en`.

The result goes into router context (`locale`, `direction`, `browserLocale`), so the root route, every
loader and every `head` read one value, and the hydration trusts the server's instead of negotiating
again. `navigator.language(s)` is read nowhere else (`single-locale-source.test.ts`). A preference change
calls `router.invalidate()`: the root route negotiates again, the app re-renders in place, the query
cache stays.

## 7. Catalogue loading

- `en` is in the main chunk and is the fallback every key walks to. Every other catalogue is a dynamic
  import in `LOCALE_DETAILS[locale].load`, so a visitor downloads the one catalogue they read.
- `createLocaleStore()` (one per router) holds the active locale and its loaded catalogue; `AppWords`
  renders its snapshot. Nothing imports a translation statically outside a spec.
- Every catalogue holds exactly `en`'s keys (`catalogue-parity.test.ts`): a new message lands in every
  catalogue in the same change, translated, with its placeholders unchanged.

## 8. RTL checklist

- `dir` is the whole switch: a locale's `direction` in `LOCALE_DETAILS` puts `dir="rtl"` on `<html>`, and
  nothing else changes. No component branches on direction.
- Logical properties only: `inline-start`/`inline-end`, `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, never
  `left`/`right` (`zero-matches` holds it in the client packages and app code).
- An icon that points along the reading direction (a chevron, a back arrow) flips with it through
  `<Icon mirrored>`; one that points at the world (play, a clock) does not.
- A story that lays out text is tagged `text`: the workbench visual suite shoots it again under
  `direction: rtl` and once per translation. The player, the progress bars and every horizontally
  scrolling shelf carry the tag.
- Numbers and dates go through `@vp/intl`, which picks the locale's digits and separators.

## 9. Where a new one goes
- Specs assert shape, not glyphs: ICU data moves between Node versions and differs in Bun.



- A formatter: `packages/universal/intl/src/formatters/<name>.ts` and its spec, a member in `TaggedValue`, a
  tag in `FORMAT_KINDS`, a case in `formatValue`. Test at least three locales, one with a different grouping
  separator and one non-Latin script.
- A domain value: `packages/universal/intl/src/domain/<name>.ts`, returning a tagged value.
- A message: the feature file under `packages/universal/messages/src/en/` and the same key in every other
  catalogue (`pl/`), or `catalogue-parity.test.ts` fails. A new `ErrorCode` needs its entry in `ERROR_COPY`
  and a message in `en/errors.ts`, or it does not compile.
- A language: a `packages/universal/messages/src/<tag>/` catalogue with every `en` key (each feature file
  with its spec), and one entry in `SUPPORTED_LOCALES` and `LOCALE_DETAILS` (its name in itself, its
  direction, its dynamic import). No other code changes: negotiation, `hreflang`, the language setting and
  the workbench's locale toolbar all read the list.
