# 171: Intl formatters - one open contract, lists that collapse into "and N more" with a tooltip, richer formatters, a duration conformance suite

| Field | Value |
|---|---|
| Phase | 5 - Developer experience & growth |
| Size | XL (one PR, ordered commits, see *Delivery*) |
| Blocked by | 170 - Platform packages, open/closed and extractable |
| Blocks | — |
| Spec | [170](170-platform-packages-open-closed-extractable.md) (*Formatters*, *Token and provider model*, platform packages ship no words) · [85](85-universal-intl-formatting-message-core.md) · [86](86-localisation-rollout-locale-negotiation-rtl.md) · [docs/standards/formatting-and-i18n.md](../standards/formatting-and-i18n.md) · [packages/universal/intl/AGENTS.md](../../packages/universal/intl/AGENTS.md) |

**Status:** blocked

> **Start condition.** Names are 170's: `@kit/intl` (was `@vp/intl`, `packages/universal/intl`), `@kit/i18n` (was
> `@vp/messages`; `defineKind`, `definePresets`, `FormatPresets`), `@kit/intl-react`, `@kit/ui`, `@kit/components`,
> app-side `@vp/intl-formats` and `@vp/shared-messages`. Paths below are today's; 170 moves them. Open PR #326 ([136](136-frontend-ui-and-feel-overhaul-web-and-studio.md))
> is assumed merged first (*Overlap*).

## Why

`@vp/intl` is the one place every number, date and list is formatted, and after 170 it is also what other products
install. Measured on `main` (cbc9f4f73), three things stop it being that:

- **It is closed.** `format-value.ts` is a `switch` over 16 kinds held equal to a closed union (`TaggedValue`,
  `FORMAT_KINDS`, `KindsMatchUnion`); an app cannot add or wrap a formatter without editing the package. 170 introduces
  `defineKind` for the message engine; the formatters themselves still need to be written with it.
- **Lists cannot collapse.** `formatters/list.ts` wraps `Intl.ListFormat` over `readonly string[]`: no per-item
  formatting, no limit, no way to show "Action, Comedy and 4 more" and reveal the rest. Every caller that needs it
  slices and concatenates by hand, in English.
- **Some formatters are wrong or thin.** `percent` with `{ minimumFractionDigits: 2 }` declines (`maximumFractionDigits: 1`
  is merged in first, `Intl` throws `RangeError`, verified on Node 24); `date` of `2024-05-01` renders `Apr 30, 2024` for a viewer
  in `America/New_York`; `account-menu.tsx` builds initials with `charAt(0).toUpperCase()`; the duration fallback has a
  conformance test over 5 locales but none for `pl`, the app's second locale.

## Today

| Area | What main has |
|---|---|
| Kinds | 16 files in `packages/universal/intl/src/formatters/`, one spec each; `collator`, `plural`, `truncate` sit outside the union (functions on `IntlBinding`). |
| Options | Each formatter allowlists its keys (`withOptions`); `NUMBER_OPTION_KEYS` is re-listed in `compact`, `percent`, `money`, `bytes`, `bitrate`. |
| Lists | `ListOptions = { type, style }`; message config `list: { names: { type } }`; arg `readonly string[]`. |
| Messages | `substitute.ts` switches on the placeholder kind (`number`, `date`, `list`, `plural`, `enum`) and returns one string; no structured result. |
| Duration | `Intl.DurationFormat` used when present, else `duration-fallback.ts`; `duration-fallback.test.ts` compares both over 5 locales, 6 option sets, 4 durations, and asserts the native constructor exists. Node 24.10 and Bun 1.4.2 both ship it. |
| Tooltip | `@vp/ui` has `Tooltip` (Radix: hover and focus only, never tap), `Popover`, `HoverCard`. No component renders a formatted list. |

## What to build

### 1. One open formatter contract (SOLID audit)

Every formatter, built in and app-owned, is `defineKind({ name, arg, options, render, parts? })` from 170. `render(arg,
options, ctx)` returns `Result<string, FormatFailure>`; `ctx` is today's `FormatContext` plus `ctx.format(value)`, so a kind
composes another kind (list items, range ends, money inside a range) and never imports it. `parts` is optional and returns
`Result<readonly Part[], FormatFailure>` for kinds with structure a UI may use; `render` defaults to joining it.
`collator`, `truncate` and `pluralCategory` become kinds with a non-string output (`Kind<Arg, Options, Out = string>`), so the
three stray members of `IntlBinding` go.

| Violation today | Where | Refactor |
|---|---|---|
| Open/closed: a new kind edits a `switch`, the union and `FORMAT_KINDS` | `format-value.ts` | Kind registry built from `defineKind` values; `formatValue` looks the kind up (`UnknownKind` failure), no switch on a name. `TaggedValue` becomes derived from the registry type. |
| Open/closed and interface segregation: one method per `Intl` constructor on one interface, one class implements all | `intl-cache.ts` (`IntlCache`, `MemoisedIntl`) | `cache.get(descriptor, locale, options)` with `descriptor = { name, create, supportedLocalesOf }`; the nine typed accessors stay as thin wrappers over descriptors a kind may also pass its own. A kind needing a new constructor adds a descriptor, not an interface member. |
| Dependency inversion: reads the `Intl` global inside the cache | `intl-cache.ts` (`nativeDurationFormat`, `Intl.supportedValuesOf`, `Intl.X.supportedLocalesOf`) | `createIntlCache(env = nativeIntl)`: the constructors arrive as one `IntlEnvironment` value, so the fallback path is tested by passing an environment without `DurationFormat`, not by patching a global. |
| Interface segregation: `IntlBinding` carries `pluralCategory`, `collator`, `truncate` besides `format` | `create-intl.ts` | `IntlBinding = { context, format(value), call(kind, arg, options) }`; the named helpers are derived. |
| Inconsistent contract: three formatters skip `withOptions` or the union | `formatters/collator.ts` (hand-rolled `findUnknownOption`), `truncate.ts`, `plural.ts`, `calendar-day.ts` | Same kind contract; the allowlist comes from the kind's `options` (170) once. |
| Repeated rule: "style, else fields, else default" written three times | `date.ts` `dateFormatOptions`, `time.ts` `timeFormatOptions`, `date-time.ts` `dateTimeFormatOptions` | One `resolveDateOptions({ styleKey, defaults })` helper; the three kinds call it. |
| Repeated rule: the number option list and the `maximumFractionDigits: 1` default | `number.ts`, `compact.ts`, `percent.ts`, `money.ts`, `bytes.ts`, `bitrate.ts` | `defineNumberKind({ keys, defaults, transform })` over `Intl.NumberFormat`; `bytes` and `bitrate` share one `defineScaledUnitKind({ step, units })` (they share `scale()` today). |
| Liskov: a default and a caller option can combine into an invalid pair | `percent.ts` (`{ maximumFractionDigits: 1, ...options }`); same shape in `bytes.ts`, `bitrate.ts` | Defaults apply per option only when no sibling of the same pair is given (`defaultsFor(options)`); an override only narrows, never makes a valid call invalid. A table test over every default-bearing kind. |
| Liskov in presets (170): an override must stay inside the preset's kind | `FormatPresets` | Override type is `Partial<KindOptions<K>>`, resolved along the locale chain; tested with a type fixture. |
| Hidden state: a date-only string is read as UTC midnight | `inputs.ts` `parseInstant` | Dates without a time are rejected by `date`, `time`, `dateTime` (`unrenderable`, reason names `plainDate`) and formatted by the new `plainDate` kind in the zone-less calendar. |
| Asymmetric rounding and unit promotion: `Math.round(-59.5)` is `-59`, `Math.round(59.5)` is `60`, so past and future differ, and 59.5 min can read "in 60 minutes" | `formatters/relative.ts` | Pick the unit after rounding and round half away from zero, so `3570 s` is "in 1 hour" and "1 hour ago". |

Not violations, left as they are: `FormatContext` is an argument (no globals in `src/`, held by `intl-purity.test.ts`); failures
are `Result`s; `withOptions` allowlisting; one file and one spec per kind.

### 2. Lists: per-item kind, `max`, "and N more", structured result

**Engine** (`@kit/intl`, `formatters/list.ts`):

- `ListValue.value` is `readonly (string | TaggedValue)[]`: each item is formatted through `ctx.format`, so
  `{ type: 'list', value: [money(1250), money(990)] }` joins formatted prices. `ListOptions` keeps `type` and `style`
  (`conjunction | disjunction | unit`, `long | short | narrow`) and adds `max` and `more`.
- `max`: the most items shown; `0` or absent means all. A non-integer or negative `max` is `unrenderable`.
  `max >= items.length` shows all and uses no `more` copy.
- `more` is data, not code (serializable for SSR): plural branches in the existing message shape,
  `{ one: 'and {?} more', other: 'and {?} more' }`, `{?}` the hidden count formatted by `number`. **No default and no English
  text in the package**: `max > 0` without `more` is a compile error (`ListOptions` is a union on `max`) and an
  `unrenderable` failure at runtime. The branch is chosen by `Intl.PluralRules`, so `pl` gets `one/few/many`.
- The collapsed list is `[...visible, moreText]` through the same `Intl.ListFormat`, so the conjunction, commas and `type`
  are the locale's: "Action, Comedy, and 4 more".
- `parts` returns `ListDetail = { segments, visible, hidden, total, full }`. `segments` is `Intl.ListFormat.formatToParts` output
  tagged `item | literal | more`; `visible` and `hidden` are the formatted item strings; `full` is the same list formatted
  with `max` 0. `text` (what `render` returns) is the segments joined. All plain data.

**Messages** (`@kit/i18n`): `{names:list}` accepts config `list: { names: { type?, style?, max?, more?, item? } }`.
`item: { kind: 'money', options?: ... }` (or a preset name) makes the argument `readonly ArgOf<kind>[]` instead of
`readonly string[]`; without `item` the argument is `readonly (string | TaggedValue)[]`. `max` without `more` fails typecheck.
`Translator.parts(key, args)` returns `Result<readonly MessagePart[], MessageFailure>`, `MessagePart = { type: 'text', text } |
{ type: 'list', name, detail: ListDetail }` (open: a kind with `parts` adds its member); `t` is `parts` joined, unchanged.
`substitute.ts` loses its kind `switch` and asks the registry.

**Client** (`@kit/intl-react`, which gains `@kit/ui` as a dependency, T4 over T3; `@kit/components` is the same layer and
cannot import `intl-react`):

- `useTParts()` and `useFormatParts()` beside `useT`/`useFormat`.
- `<Message id args />` renders `parts`; `<FormatList value options />` renders one list. Both render a `list` part through one
  `ListPartView`, never a plain string.
- `ListPartView` renders `segments`: each `item` in `<bdi>` (so a Latin name inside Arabic, or the reverse, keeps its
  direction), literals as text, and the `more` segment as the **trigger** of `MoreDisclosure`.
- `MoreDisclosure` (new, `@kit/ui`, built on `Popover`): a `<button type="button">` styled as inline text. Opens on click or tap,
  on Enter and Space, on keyboard focus-visible, and on mouse hover after 300 ms (`pointerType === 'mouse'` only, so touch
  never opens twice); closes on Escape, outside press, blur and mouse leave. Content is `full` as a `<ul>` of `<bdi>` items,
  `max-height` with scroll, `wrap-break-word` for long items, placement through 170's logical `Side`/`Align` (so RTL flips).
  The trigger has `aria-haspopup="dialog"` and `aria-expanded`; the visible items stay in the DOM text, the hidden ones are in
  the popover, which is a labelled group.
- **Automatic**: no prop is needed. **Opt-out**: `moreTooltip={false}` renders `detail.text` only. **Customise**:
  `moreTooltip={{ trigger?, content?, side?, align?, openDelay? }}` where `content` is `(detail: ListDetail) => ReactNode` and
  `trigger` a render prop receiving the `more` text.
- Platform packages ship no words: the "and N more" text is in the part, written by the app's catalogue; the popover has no label
  of its own (its accessible name is the trigger text).
- SSR and hydration: the server markup is the closed trigger (`useId`, no `window`, no `matchMedia`), the portal mounts on open
  only, so the two renders are byte-equal.

**App**: `@vp/shared-messages` gets `list.more` branches in `en` and `pl`, used wherever `{x:list}` shows more than two items today
(channel genres, collaborators, tags, 126/164 lists); no call site slices and concatenates.

### 3. Every existing formatter, extended where it pays

All additions are options of the kind's own contract (allowlisted, preset-able, typed in messages), each with a table row in
its spec. "Skipped" says why.

| Kind | Added | Skipped |
|---|---|---|
| `number` | `roundingMode`, `trailingZeroDisplay`, `minimumSignificantDigits`, `maximumSignificantDigits`; `unit` kept, documented as the generic route | `numberingSystem` (comes from the locale tag) |
| `compact` | `roundingMode`, `signDisplay`; default pair fix (section 1) | |
| `percent` | `maximumSignificantDigits`, `roundingMode`, `input: 'points' \| 'fraction'`; default pair fix | |
| `money` | `currencySign: 'accounting'`, `notation: 'compact'`, `trailingZeroDisplay` (`$5` not `$5.00`), integer-exact `units: 'minor'` (decimal string to `format`, not `amount / 10 ** digits`) | per-currency tables (the engine knows them) |
| `bytes`, `bitrate` | `minimumFractionDigits`, `roundingMode`, `minUnit` (never below KB), one shared scaler | bit units for bytes |
| `date` | `timeZone` per value (an event shown in its own zone), `calendar` | `era` beyond today |
| `time` | `timeZone` per value, `fractionalSecondDigits` | |
| `dateTime` | independent `dateStyle` and `timeStyle`, `timeZone` per value | |
| `dateRange` | time fields (`dateTime` options), `timeZone`: "May 3, 6 - 8 PM" for premieres and parties | |
| `numberRange` | money ranges through `ctx.format` (`range` of two tagged values) | |
| `calendarDay` | `withTime`, `style` for the date beyond the window, `windowDays` | |
| `relative` | `minUnit`, `maxUnit`, `thresholds`, calendar-aware months and years, symmetric rounding (section 1) | relative ranges (see *Considered*) |
| `plural` | nothing new: `type: 'ordinal'` already works in message config, now covered by a spec | an `ordinal` kind |
| `displayName` | `style`, `languageDisplay`, `of: 'region' \| 'script' \| 'calendar'` | |
| `collator` | `usage: 'sort' \| 'search'`, becomes a kind | |
| `truncate` | options `ellipsis`, `position: 'end' \| 'middle'` (file names), `boundary: 'grapheme' \| 'word'`; allowlist; stays grapheme-aware | |
| `duration` | `days`, `maxUnits` ("1 hr 2 min" not "1 hr 2 min 33 sec"), `hoursDisplay: 'always'` for clocks, `unit: 'seconds' \| 'milliseconds'` input | |
| `list` | section 2 | |

### 4. Intl.DurationFormat: conformance, not assumption

`duration-fallback.test.ts` exists and compares native and fallback; this ticket widens and hardens it.

- Table (`it.each`) over locales `en`, `pl`, `de`, `fr`, `es`, `pt-BR`, `ru`, `ja`, `ko`, `zh`, `ar`, `ar-EG`, `he`, `hi`, `th`, `sv`,
  `en-u-nu-thai`; styles `digital`, `short`, `long`, `narrow`; displays `hoursDisplay`/`secondsDisplay`; durations `0 s`, `1 s`,
  `5 min`, `2 h 1 min 1 s`, `123 h 7 s` and, with `days`, `1 d 2 h`. Each case runs the native constructor and the fallback and asserts equal strings.
- A difference found is fixed in `duration-fallback.ts` when the native result is the specified one; where engines themselves differ (ICU
  versions, Bun's JSC against V8) the case is listed in `AGENTS.md` under "Known engine differences" with the pair of strings and
  a `describe.skipIf` guard naming the runtime. The scan result is reported in the PR, not guessed here.
- The first assertion `expect(typeof DurationFormat).toBe('function')` becomes a runtime-matrix note: the suite skips the conformance
  block (and says so) where the constructor is absent, and a second test forces the fallback by passing an `IntlEnvironment` without it
  (section 1), so the fallback is exercised on every runtime, not only on those without the native one.
- `AGENTS.md` records which runtimes have the native `Intl.DurationFormat`, verified by running the suite: Node 24.10 and Bun 1.4.2 have it
  (checked); jsdom runs on Node's `Intl`; browsers (Chrome and Edge 129+, Safari 18.4+, Firefox 136+) are from MDN and marked "documented, not run".

### 5. New formatters

| Kind | Use in this product | Verdict |
|---|---|---|
| `initials` (grapheme-aware, locale upper-casing, two letters) | `packages/client/components/src/account-menu/account-menu.tsx` builds it with `charAt(0).toUpperCase()`: breaks on emoji and Turkish `i`; avatars in 163/164 need it | **Yes**, S |
| `capitalize` (`toLocaleUpperCase(locale)` on the first grapheme) | `apps/client/web/src/features/account/utils/set-name.ts` | **Yes**, S, same file as `initials` |
| `plainDate` (calendar date, no zone) | scheduled publishing and birthdays (ticket 167, ticket 163); fixes the `Apr 30` shift | **Yes**, S |
| `timeZone` name (`long`, `short`, `offset`: "Central European Summer Time", "GMT+2") | "times shown in ..." notice beside a premiere time (167) | **Yes**, S |
| `isolate` (wraps in FSI and PDI) | user-written names in a sentence in an RTL locale ("{channel} replied"); opt-in per placeholder, default output unchanged | **Yes**, S |
| `parseDecimal(text, ctx)` (locale grouping and decimal, any numeral system) | amount and numeric inputs in Studio and 164's supporter amount; not a formatter, a sibling in `src/parsers/` returning `Result` | **Yes**, M |
| `list` with item kind and `max`/`more` | section 2 | **Yes** (done above) |
| `measure` (any sanctioned unit) | `number` already takes `unit`; no second product need (fps and sample rate are not sanctioned units) | Later |
| `ordinal` | `plural` with `type: 'ordinal'` covers it; English rank suffixes only | No, spec added instead |
| relative-time ranges | no screen shows one | No |
| phone, address | no data in the model, locale libraries needed | No |
| locale negotiation | [86](86-localisation-rollout-locale-negotiation-rtl.md) and `packages/client/queries/src/request-locale.ts` own it | No, theirs |

### 6. Docs

`packages/universal/intl/AGENTS.md` (the contract, the audit rules as invariants, the engine-difference list, runtime matrix),
`packages/client/intl-react/AGENTS.md`, `packages/client/ui/AGENTS.md` (`MoreDisclosure`), `packages/client/components/AGENTS.md`
(no change to its contents, one line saying list rendering lives in `intl-react`), `docs/standards/formatting-and-i18n.md` (kinds,
list config, parts, the RTL checklist row for `<bdi>` and the popover), and `docs/standards/testing.md` where the conformance
pattern is new. Reasons, not history; rewritten in place.

## Delivery

One PR, ordered commits, each green: (1) contract and registry, cache descriptors and `IntlEnvironment`, no output change;
(2) the SOLID fixes with their regression tables; (3) list engine and messages parts; (4) `MoreDisclosure`, `Message`, `FormatList`,
app copy; (5) per-formatter options; (6) duration conformance; (7) new formatters and `parseDecimal`; (8) docs. Never sliced.

## Acceptance criteria

**Contract**
- [ ] Every formatter is a `defineKind`; `format-value.ts` has no `switch` on a kind name; an app registers a kind and a wrapper kind
      with no edit to `@kit/intl` (a spec registers `shout` that wraps `number` through `ctx.format`).
- [ ] `createIntlCache(env)` takes the constructors; no `Intl.` global is read in `intl-cache.ts` outside the default environment;
      `intl-purity.test.ts` still holds and a fixture proves it fires.
- [ ] `IntlBinding` is `{ context, format, call }`; `collator`, `truncate`, `pluralCategory` are kinds.
- [ ] The three date option resolvers are one helper; the number family shares `defineNumberKind`; `bytes` and `bitrate` share one scaler.
- [ ] No default-bearing kind declines a valid caller option: `percent` with `{ minimumFractionDigits: 2 }` renders `7.00%`; same table for
      `bytes`, `bitrate`, `compact`.
- [ ] `date`, `time`, `dateTime` decline a date-only string; `plainDate('2024-05-01')` renders `May 1, 2024` in every zone.
- [ ] `relative`: `3570 s` before and after now read "1 hour ago" and "in 1 hour" in `en`, and the same unit in `pl`.

**Lists**
- [ ] `max: 2` over `['A','B','C','D']` renders "A, B, and 2 more" in `en`, "A, B i 2 inne" style per the app's `pl` branches in `pl`
      (`one/few/many` all covered), and the `ar` branches in `ar`; `max: 0` and `max >= length` render all, with no `more` read.
- [ ] `max > 0` without `more` fails typecheck (`@ts-expect-error` fixture) and returns `unrenderable` at runtime; `@kit/intl` contains no
      English word (a source scan fails on `more`/`and` literals in `src/`).
- [ ] Items of other kinds format through `ctx.format`; `item: { kind: 'money' }` types the argument as `readonly number[]`.
- [ ] `parts` returns `segments`, `visible`, `hidden`, `total`, `full`; `full` equals the same list with `max` 0; `Translator.parts` joined
      equals `t`.
- [ ] `<Message>` and `<FormatList>` show the popover on click, tap, Enter, Space, keyboard focus and mouse hover; it lists all items;
      Escape, outside press and blur close it; touch opens once.
- [ ] `moreTooltip={false}` renders text only; `moreTooltip={{ content }}` renders the custom content with the `ListDetail`.
- [ ] In an RTL locale the popover flips, items are in `<bdi>`, a Latin name inside Arabic keeps its direction; a 200-character item wraps
      and the popover scrolls; no layout shift on hydration; server and client markup are equal (SSR spec).
- [ ] No axe violation on the closed and open states; the trigger is reachable by Tab and named by its text.

**Formatters and duration**
- [ ] Every added option in section 3 has a spec row and a type fixture; an unknown option still declines with its name.
- [ ] The duration table runs on Node and under `bun test`; every difference is fixed or listed in `AGENTS.md` with both strings; the
      forced-fallback test runs on every runtime; the runtime matrix is in `AGENTS.md`.
- [ ] `initials`, `capitalize`, `plainDate`, `timeZone`, `isolate` and `parseDecimal` exist with specs; `account-menu.tsx` and
      `set-name.ts` use them; `parseDecimal('1 234,5', pl)` is `1234.5`, `'1,234.5'` in `en`, and `'12,3,4'` declines.

**Docs and gates**
- [ ] The docs in section 6 are updated in this PR; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:bun`,
      `pnpm test:architecture` and `pnpm boundaries` pass, output pasted in the PR.

## Tests

One spec per source file, `it.each` tables for every locale or option matrix, no vitest runtime imports (globals), no `vi.mock` of an
import (providers and `IntlEnvironment` substitute). Locale tables: `en`, `pl`, `ar`, `ja`, `de`. Component specs render through one
named helper (`renderWithIntl`). Type fixtures in `src/__tests__/type-fixtures/`: `max` without `more`, wrong `item` argument,
unknown kind, unknown preset, preset override outside the kind. Specs assert shape (grouping, order, digits), not ICU glyphs, except
where a case is the point (the `pl` plural of "more").

## Overlap and order

| Open PR | Touches | Effect here |
|---|---|---|
| #326 (136 FE overhaul) | `packages/client/ui` (62 files, including `popover` and `hover-card`), `components` (video card, shelf, account menu variants), `queries`, `universal/messages` (38 files), `permissions`, `design-tokens` | `MoreDisclosure` builds on its `popover`; `account-menu.tsx` is touched by both. Merge 326 first, then 170, then this. |

170 is the only ticket this one waits for; 148 and 149 do not format lists. If 126, 164 or 165 land before 170 with `join(', ')`, they
are swept here.

## Findings from the survey (C)

- `percent` default pair makes valid options fail (`formatters/percent.ts`): fixed above, S.
- Date-only strings shift a day west of UTC (`inputs.ts`, `date.ts`): fixed above, S.
- `relative` rounds asymmetrically and can promote a unit (`formatters/relative.ts`): fixed above, S.
- `money` `units: 'minor'` divides in floating point (`formatters/money.ts`): fixed above, S.
- Initials and capitalisation ignore locale and graphemes (`account-menu.tsx`, `set-name.ts`): fixed above, S.
- Cache eviction is first-in, not least-recently-used (`intl-cache.ts` `BoundedMemo.get` does not refresh a hit): no issue at 256 entries per
  kind, measured by no hot-loop spec; left as is.
- `optionsKey` sorts top-level keys only (`intl-cache.ts`): no issue found, no kind passes nested options.
- Invalid `timeZone`: no issue found, `Intl` throws and `tryCatch` returns `unrenderable` per format; no early check at the provider, which
  is 86's.
- `IntlProvider` creates one cache per locale (`intl-provider.tsx`): no issue found.

## Considered, out of scope

- `measure` kind: `number` `unit` covers today's screens.
- `ordinal` kind: `plural` ordinal branches cover it.
- Relative-time ranges, phone and address formatting: no screen needs them.
- Locale negotiation and number input widgets: 86 and the forms package.
- Per-item grapheme truncation inside a list: CSS wrap and the popover cover long items; `truncate` stays callable per item.
- Showing a lone hidden item instead of "and 1 more": kept strict (`max` means max); revisit with a `collapseFrom` option if the copy looks silly.

## Open questions

1. `@kit/intl-react` gains a dependency on `@kit/ui` so `<Message>` can render the popover (the layer rules forbid `components` using `intl-react`).
   Alternative: `intl-react` exposes only hooks and parts, and `components` ships `<FormattedList>` taking the parts, so the caller wires them.
   Default in this ticket: the first, for "automatic".
2. `more` hidden count of one: "and 1 more" (strict, default) or show the item.
3. Mouse hover opens the popover after 300 ms; drop it if tap and focus feel enough.

## Definition of Done

Every criterion ticked with evidence in the PR; the duration scan and runtime matrix pasted; the docs in section 6 rewritten in place
(no history); `gen-index.py` run and this ticket set to `done` only after the merge.
