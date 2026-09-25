# Formatting & i18n

The authority for how a number, date, count or sentence reaches a person. Design and rejected
alternatives: [SDD ADR-26](../SDD.md#adr-26--formatting-and-i18n-one-universal-intl-core-catalogues-out-of-the-server).
Enforcement: [ARCHITECTURE.md Invariant 10](../../ARCHITECTURE.md).

| Package | Tier, layer | Holds |
|---|---|---|
| `@vp/intl` | universal, T2 | formatters, the value union, option allowlists, `IntlCache`, `localeChain` |
| `@vp/messages` | universal, T3 | `dt()`, `createTranslator()` (`t`, `tOr`), the `en` catalogue, `ERROR_COPY` |
| `@vp/intl-react` | client, T4 | `IntlProvider`, `useT`, `useFormat`, `<Format>`, locale and zone detection |

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
- `IntlProvider` resolves the locale from its prop, then the saved preference, then `navigator.languages`,
  then `en`. A server render passes `locale`, `timeZone` and `now`, and the browser hydrates with the same.
- Specs assert shape, not glyphs: ICU data moves between Node versions and differs in Bun.

## 6. Where a new one goes

- A formatter: `packages/universal/intl/src/formatters/<name>.ts` and its spec, a member in `TaggedValue`, a
  tag in `FORMAT_KINDS`, a case in `formatValue`. Test at least three locales, one with a different grouping
  separator and one non-Latin script.
- A domain value: `packages/universal/intl/src/domain/<name>.ts`, returning a tagged value.
- A message: the feature file under `packages/universal/messages/src/en/`. A new `ErrorCode` needs its entry
  in `ERROR_COPY` and a message in `en/errors.ts`, or it does not compile.
- A language: a `PartialCatalogue` passed to `IntlProvider`'s `catalogues`. No code change.
