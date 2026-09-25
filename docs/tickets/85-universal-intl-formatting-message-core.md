# 85: Universal `Intl` formatting core — global formatters, typed placeholders & message catalogues

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Size | L |
| Blocked by | 84 — Result-typed error handling, shared domain rules & one transport seam |
| Blocks | 86 |
| Spec | [SDD ADR-23 Package runtime tiers](../SDD.md#adr-23--package-runtime-tiers-the-directory-is-the-tier) · [SDD ADR-20 Monorepo topology](../SDD.md#adr-20--monorepo-topology-workspace-boundaries-and-contract-single-sourcing) · [SDD §15.1 Repository layout](../SDD.md#151-repository-layout-monorepo-video-pipeline) · [SDD §6.2 Error codes](../SDD.md#62-error-codes-stable-machine-readable) |

**Status:** done

> **Ticket 87 note:** a formatter is a cached, configured object with a lifetime, which is exactly what
> [87](87-composition-root-typed-container-config-value.md) gives a home to. Register the formatter cache in the
> container rather than as a module-level singleton — `defaultPaginator` and `getMetrics()` are the pattern 87
> is removing, and a process-wide formatter cache keyed by locale is the same trap with an extra dimension.
> Locale reaches a formatter as an argument or as config, never from ambient state.

---

## Why this ticket exists

Every number, date and count the product shows a user is formatted by hand, in English, at the call site.

| What the user sees | How it is produced today | What it should be |
|---|---|---|
| `1.2M views` | `format-numbers.helper.ts` — `['', 'K', 'M', 'B', 'T', 'Q']`, hardcoded English suffixes, `Math.log` and `toFixed` | `Intl.NumberFormat(locale, { notation: 'compact' })` |
| `3 days ago` | `javascript-time-ago@2.5.9` — **a runtime dependency for what the platform ships natively** | `Intl.RelativeTimeFormat` |
| the `title=` tooltip on a publish date | `new Date(...).toLocaleString()` at `video-description.tsx:22` — **no locale argument**, so it renders in whatever locale the *runtime* has | an explicit locale |
| a truncated description | `description.substring(0, 255)` at `video-description.tsx:17` — UTF-16 code units, so it splits emoji and breaks combining marks | `Intl.Segmenter` on graphemes |
| a video duration badge (`12:45`) | does not exist | a `duration` formatter |
| category and channel lists sorted A–Z | `.sort()` — code-point order, so `Ä` sorts after `Z` and `ö` after `z` | `Intl.Collator` |

Three consequences, in order of how much they will cost:

**1. `toLocaleString()` with no locale is an SSR defect waiting for ticket 63.** Ticket 63 ships streaming SSR: the server renders the HTML, the browser hydrates it. A formatter that reads its locale from the ambient runtime produces `9/22/2026` in the Node container and `22/09/2026` in a European browser — a hydration mismatch React reports as an error and repairs by re-rendering. The fix has to exist *before* SSR, not after, and it is the reason the core cannot simply be a `client` package.

**2. There is no seam, so every new surface re-invents one.** Ticket 58 already specifies `Intl.RelativeTimeFormat` and `Intl.NumberFormat` with `notation: 'compact'` — in prose, in its *Notes*, with no package to put them in and no owner. Tickets 59, 60, 61, 71, 73 and 74 each render counts, dates and durations. Without a package they will each grow their own helper, exactly as `format-numbers.helper.ts` did.

**3. Copy is not separable from code.** Every user-facing string is a literal in a `.tsx` file. There is no catalogue, no plural handling (`1 view` / `2 views` is unsolved), no way for a non-engineer to change wording, and — after ticket 84 — no home for the copy that renders a failure code, which 84 explicitly deferred to this work.

### What this is not

Not a translation project. **No second language ships in this ticket.** What ships is the machinery and one catalogue (`en`), so that adding `sv` later is a data change rather than a refactor. Locale negotiation, the switcher and RTL are ticket 86.

---

## Prior art, and what is taken from each

Two designs are borrowed from deliberately, so this is not invented from nothing.

**`@gutro/formatters`** (LeoVegas sportsbook-ui, `core-packages/formatters`) — the placeholder design:

- a **tagged value union** — `{ money: 25000, units: 'minor' }`, `{ date: iso }`, `{ list: [...] }` — so a formatter reads a value it can prove is its own kind, with a compile-time assertion that the kind list and the union match exactly;
- **`withOptions(allowed, format)`** — an option allowlist per formatter, so `date(stlye: short)` declines instead of silently rendering a default;
- **`Declined`** — a formatter refuses with a reason instead of throwing, so a bad token survives on the page as authored and one warning explains it;
- a **`USER` sentinel** meaning "the viewer's own locale/currency", resolved at format time.

**[WebDevSimplified/intl-crash-course](https://github.com/WebDevSimplified/intl-crash-course)** — the message design:

- **`dt('Hello {name}, you have {count:plural} messages', { plural: { count: {...} } })`** with the parameter *names and types extracted from the template literal at the type level*, so `t('key', { nmae: 'x' })` is a compile error and `{count:date}` demands a `Date`;
- `{x:number}` / `{x:date}` / `{x:list}` / `{x:plural}` / `{x:enum}` token types, each backed by the matching `Intl` constructor;
- a **locale fallback chain** — `en-GB` → `en` → the fallback list — walked per key, so a partial catalogue is useful.

### Where this ticket improves on both

1. **A formatter returns `Result<string, FormatFailure>`, not a bespoke `Declined`.** Ticket 84 introduced `@vp/result` and the `Failure<ErrorCode, …>` discriminant. A formatter failing is the same shape as a rule failing, handled with the same combinators, the same exhaustive `switch` and the same `assertNever`. One error mechanism in the repo, not two.
2. **`Intl` constructors are memoised.** Both references build `new Intl.NumberFormat(...)` on every call; constructing one is roughly two orders of magnitude more expensive than using it, and a feed renders hundreds per scroll. The core caches per `(locale, formatter kind, options)`.
3. **SSR determinism is a rule, not a hope.** No formatter reads `navigator.language`, `Date.now()` or the ambient locale. The locale and the clock are arguments. This is what makes a server render and a client hydration produce the same bytes.
4. **`Intl.Collator` and `Intl.Segmenter` are in scope.** Neither reference uses them, and both of this repo's current bugs — code-point sorting and `substring` truncation — are exactly what they exist to fix.
5. **Compile-time args *and* runtime option validation.** The crash course types the arguments; Tiger validates the options. Doing both means a wrong argument fails to compile and a wrong option name declines at runtime with a reason.

---

## Package structure, tier and layer

Three packages. The split is not taste — each boundary stops a specific thing from happening.

| Package | Location | Tier | Layer | Holds | Why the boundary |
|---|---|---|---|---|---|
| `@vp/intl` | `packages/universal/intl` | `universal` | **T2** | formatters, placeholder value union, option allowlists, locale chain, memo cache | must run in Node for SSR (ticket 63) and in the browser; `Intl` is a JS built-in, so `client` would be a constraint that buys nothing |
| `@vp/messages` | `packages/universal/messages` | `universal` | **T3** | `dt()`, the `t()` factory, substitution, the `en` catalogue | catalogues are copy; keeping them out of `@vp/intl` is what lets the API format a number without linking the product's wording |
| `@vp/intl-react` | `packages/client/intl-react` | `client` | **T4** | `IntlProvider`, `useT`, `useFormat`, `<Format>`, locale detection and persistence | React, `navigator`, `localStorage` — the only browser-coupled half |

Layers point strictly down — `@vp/result` (T1) ← `@vp/intl` (T2) ← `@vp/messages` (T3) ← `@vp/intl-react` (T4) — with no sibling edge, so `pnpm boundaries` passes without an exception.

### Is any of this used on the backend?

Mostly no, and the ticket is explicit about the little that is, because "universal just in case" is what `packages/AGENTS.md` warns against.

- **`@vp/intl` — yes, for two things.** SSR (ticket 63) executes it in Node, which is the decisive reason. And `apps/api` may use it where a string must be final on the server: an OpenAPI example, or a `Problem.detail` fallback such as "File exceeds 5 GB". That is a handful of call sites, not a pattern.
- **`@vp/messages` — no, and it is asserted.** Ticket 84 settled that the API returns a `code` plus a wire-safe payload and the client renders the copy. An `apps/api` or `apps/worker` import of `@vp/messages` is an architecture-test failure, because it would mean the server had started choosing wording.
- **`@vp/intl-react` — no.** `client` tier; it cannot resolve from a server package.

---

## What to build

Six workstreams. W1–W3 are the core and can be reviewed independently; W4 is the React binding; W5 removes what exists today; W6 is enforcement and docs.

---

### W1 — `@vp/intl`: values, options and failures

**The placeholder value union**, tagged so a formatter reads only its own kind, with the crash-course's type-level parameter extraction and Tiger's compile-time completeness assertion:

```ts
export type FormatValue =
  | string
  | number
  | { count: number; options?: CompactOptions }          // 1.2M — views, subscribers
  | { number: number; options?: DecimalOptions }         // 1,500 · 3 days (unit style)
  | { percent: number; options?: PercentOptions }        // percentage points: 7 is 7%
  | { bytes: number; options?: BytesOptions }            // 4.5 MB — upload size, bitrate
  | { ordinal: number }                                  // 3rd
  | { date: string; options?: DateOptions }              // ISO 8601 only
  | { dateRange: readonly [string, string]; options?: DateOptions }
  | { relative: string; now?: string; options?: RelativeOptions }   // "3 days ago"
  | { calendarDay: string; now?: string }                // "Today at 18:30"
  | { duration: number; options?: DurationOptions }      // 12:45 · 1:02:33
  | { list: readonly string[]; options?: ListOptions }
  | { displayName: string; of: DisplayNameType }         // "Swedish", "Sweden"
  | { money: number; units?: 'minor' | 'major'; options?: MoneyOptions };
```

- Option keys are declared as `as const satisfies readonly (keyof Intl.XFormatOptions | Ours)[]` arrays, so a typo fails where it is declared, and each formatter's option *type* is derived from its key list by `Pick`. Copied from `@gutro/formatters`; it is the part of that design that has held up best.
- `withOptions(allowed, format)` wraps every formatter in its allowlist. An unnamed option returns `err(unknownOption)` rather than being ignored.
- **A formatter is `(value: FormatValue, options: FormatOptions) => Result<string, FormatFailure>`.** `FormatFailure` is a `Failure<ErrorCode, …>` union from `@vp/errors` (W6 adds `FORMAT_UNSUPPORTED_LOCALE`, `FORMAT_UNKNOWN_OPTION`, `FORMAT_WRONG_KIND`, `FORMAT_UNRENDERABLE`), so it composes with everything ticket 84 built.
- **`USER`** sentinel for locale and currency, resolved at format time against the supplied context.
- **The memo cache**: `intlCache.numberFormat(locale, options)` returns a shared instance keyed by locale plus a stable option hash, bounded and cleared per locale change.

**SSR rules, enforced in W6:** no formatter reads `navigator`, `Date.now()`, `new Date()` with no argument, `process.env`, or calls a `toLocale*` method. The locale and the reference instant are arguments. A `relative` value takes `now` so a server render and a hydration agree.

---

### W2 — `@vp/intl`: the formatter catalogue

Comprehensive by design, because the alternative is each ticket growing its own. Every one is one file with its own test (Rule 12), built on the primitives rather than on each other's strings.

**Number family**

| Formatter | Renders | Built on |
|---|---|---|
| `number` | `1,500` · `3 days` (unit style) | `Intl.NumberFormat` |
| `compact` | `1.2M`, `12K` | `NumberFormat`, `notation: 'compact'` |
| `percent` | `7%`, `12.5%` | `NumberFormat`, `style: 'percent'` |
| `ordinal` | `3rd`, `21st` | `Intl.PluralRules`, `type: 'ordinal'` |
| `bytes` | `4.5 MB`, `1.2 GB` | `NumberFormat` unit style, binary/decimal switch |
| `bitrate` | `4.5 Mbps` | `bytes` scaling + unit |
| `numberRange` | `1–5` | `NumberFormat.formatRange` |
| `money` | `£12.50` | `NumberFormat`, `style: 'currency'` |

**Date and time family**

| Formatter | Renders | Built on |
|---|---|---|
| `date` / `time` / `dateTime` | named brand styles **or** explicit field options | `Intl.DateTimeFormat` |
| `dateRange` | `22–24 Sept` | `DateTimeFormat.formatRange` |
| `relative` | `3 days ago`, `in 2 hours` — **auto unit selection** | `Intl.RelativeTimeFormat` |
| `calendarDay` | `Today at 18:30`, `Yesterday` | `RelativeTimeFormat` + `DateTimeFormat` |
| `duration` | `12:45`, `1:02:33` (clock) and `1 hr 2 min` (words) | `Intl.DurationFormat` where available, deterministic fallback otherwise |

`Intl.DurationFormat` is recent enough that a support probe and a fallback are required, not optional — the fallback must produce the same string the polyfilled path would, and a test pins both.

**Text family**

| Formatter | Renders | Built on |
|---|---|---|
| `list` | `Action, Comedy and Drama` | `Intl.ListFormat` |
| `plural` | selects a catalogue branch | `Intl.PluralRules` |
| `displayName` | `Swedish`, `Sweden`, `British Pound` | `Intl.DisplayNames` |
| `collator` | a comparator for `.sort()` | `Intl.Collator` |
| `truncate` | grapheme-safe cut with an ellipsis | `Intl.Segmenter` |

`collator` and `truncate` return a comparator and a string respectively rather than pretending to be placeholder formatters; they are exported from the same package because they are the same vocabulary.

**Domain formatters** — thin compositions, so a view count is worded identically everywhere:
`views`, `subscribers`, `videoDuration`, `publishedAt` (relative text + absolute `title`), `uploadProgress`, `fileSize`, `resolution` (`1080p`), `commentCount`.

---

### W3 — `@vp/messages`: typed messages and catalogues

The crash-course design, with the parameter types extracted from the message string:

```ts
// packages/universal/messages/src/en/videos.ts
export const videos = {
  views: dt('{count:plural} views', {
    plural: { count: { one: '{?} view', other: '{?} views', formatter: { notation: 'compact' } } },
  }),
  publishedRelative: dt('Published {when:date}', { date: { when: { dateStyle: 'medium' } } }),
  categories: dt('In {names:list}', { list: { names: { type: 'conjunction' } } }),
} as const;
```

- `t('videos.views', { count: 1200 })` — the key is a dot path checked against the catalogue, and the argument object's **names and types are inferred from the template**, so a missing or misspelled argument is a compile error.
- Substitution routes `{x:number}`, `{x:date}`, `{x:list}`, `{x:plural}` and `{x:enum}` through `@vp/intl`, so a message and a standalone formatter produce identical output.
- **Locale fallback chain** per key: `sv-FI` → `sv` → `en`. A partial catalogue is useful rather than broken.
- **`t` returns a `Result`** at the boundary — a missing key or a failed substitution is a `Failure`, and the caller decides between the key, a fallback string and a warning. `tOr(key, args, fallback)` is the convenience form for render paths that must not fail.
- **The failure-code catalogue lands here**: every `ErrorCode` gets its user-facing copy, which is what ticket 84 deferred. The map is `Record<ErrorCode, MessageKey>`, exhaustive, so a new code fails to compile until someone writes its wording.

---

### W4 — `@vp/intl-react`: the browser binding

Small on purpose — everything that can be pure is already in W1–W3.

- `IntlProvider` — holds the resolved locale and time zone, builds the `t` and `format` bindings once per locale via `useMemo`, and provides them.
- `useT()` / `useFormat()` — the hooks components call.
- `<Format value={{ count: video.viewsCount }} />` — the declarative form, for the common case of rendering one value.
- **Locale resolution order**: explicit prop → persisted preference → `navigator.languages` → `en`. Locale detection lives *here* and nowhere else, because it is the one genuinely browser-coupled step; `@vp/intl` never guesses.
- **SSR-safe from day one**: the provider accepts a locale prop so ticket 63 can pass the negotiated server locale in and hydrate without a mismatch. Without the prop it falls back to `navigator`, which is correct for today's CSR app.
- Follows the repo's hook discipline from ticket 84 W9: the hook owns the decision, the component renders the result.

---

### W5 — Retire what exists today

The three defects from the table, at their call sites. Small diff, immediate value, and it survives the ticket 49–75 rewrite because only call sites change.

- Delete `apps/web/src/modules/shared/helpers/format-numbers.helper.ts` and its `index.ts` export; callers use `compact` / `views`.
- Remove **`javascript-time-ago`** from `apps/web/package.json` and `src/lib`; `relative` replaces it. Record the bundle delta in the PR.
- Replace `new Date(...).toLocaleString()` at `video-description.tsx:22` with an explicit-locale `dateTime`.
- Replace `description.substring(0, 255)` at `video-description.tsx:17` with `truncate`, with a test using an emoji and a combining-mark string that the current code breaks.
- Sort category and channel lists through `collator` rather than default `.sort()`.

---

### W6 — Enforcement, error codes and docs

| New assertion | Holds | Fixture that proves it fires |
|---|---|---|
| `tests/architecture/intl-purity.test.ts` | no `navigator`, `Date.now()`, zero-argument `new Date()`, `process` or `toLocale*` call in `@vp/intl` or `@vp/messages` | a `navigator.language` read added to a formatter |
| `tests/architecture/no-adhoc-formatting.test.ts` | no `toLocaleString` / `toLocaleDateString` / `toFixed`-as-display outside `@vp/intl`; no `Intl.` constructor outside it either | a `toLocaleDateString()` added to a component |
| `tests/architecture/messages-are-client-only.test.ts` | no `apps/api`, `apps/worker` or `packages/server/**` source imports `@vp/messages` | that import added to a service |
| `tests/architecture/error-copy-coverage.test.ts` | every `ErrorCode` has a message key | a code added with no copy |

- New codes in `ApiErrorCodes`, `PROBLEM_STATUS` and `RETRY_CLASS` (ticket 84's two exhaustive maps): `FORMAT_UNSUPPORTED_LOCALE`, `FORMAT_UNKNOWN_OPTION`, `FORMAT_WRONG_KIND`, `FORMAT_UNRENDERABLE` — all 422, all permanent. They are authoring failures, and they surface in tests and warnings rather than in responses.
- **`docs/standards/formatting-and-i18n.md`** (new) — the authority: the value union, the option allowlist, the placeholder syntax, the SSR rules, when to reach for a formatter vs. a message, and where a new formatter goes.
- **`docs/SDD.md`** — **new ADR-25 "Formatting and i18n: one universal `Intl` core, catalogues out of the server"** with the rejected alternatives (`react-intl`/FormatJS, `i18next`, `date-fns` + hand-rolled, a single `client` package) and why; §15.1 gains the three packages.
- **`ARCHITECTURE.md`** — Invariant 8: user-facing formatting happens in `@vp/intl` and nowhere else; §6 gains the four rows.
- **Root `AGENTS.md`** — the directory index gains the three packages; `packages/AGENTS.md` layer tables updated.
- **`AGENTS.md` + `CLAUDE.md` symlink** for each new package (`pnpm sync:claude`); `apps/web/AGENTS.md` gains a section saying components never format.
- **Ticket updates** — 58, 59, 60, 61, 63, 70, 71, 72, 73, 74 and 83 acknowledge the seam; 58's `Intl` note and 70's error-copy gap now point at these packages.

---

## Acceptance criteria

### W1 — Core values, options and failures
- [x] `packages/universal/intl` exists, tier `universal`, `"vp": { "layer": 2 }`, depending only on `@vp/result` and `@vp/errors`; `pnpm boundaries` passes.
- [x] `FormatValue` is the tagged union above, with a compile-time assertion that the kind list and the union members match exactly — proven by an expect-error fixture that adds a kind with no member.
- [x] Every formatter returns `Result<string, FormatFailure>`; `FormatFailure` variants are `Failure<ErrorCode, …>` from `@vp/errors` and narrow through `switch` with `assertNever` in the `default`.
- [x] `withOptions` declines an unnamed option with the offending key in the failure; a test asserts `date(stlye: 'short')` fails rather than silently rendering a default.
- [x] Option key lists are `as const satisfies readonly (keyof Intl.…Options | Ours)[]`; a misspelled key is a compile error at the declaration.
- [x] `Intl` instances are memoised per `(locale, kind, options)`; a benchmark in the PR shows the repeat-format path constructing **zero** new `Intl` objects, with before/after numbers for 1,000 formats.
- [x] **SSR purity**: no `navigator`, `Date.now()`, zero-argument `new Date()`, `process` or `toLocale*` anywhere in the package — asserted by W6.
- [x] `relative` and `calendarDay` take the reference instant as an argument; a test renders the same string from a fixed `now` in node and jsdom environments.
- [x] Unsupported locale and unknown currency are detected and cached, not thrown.

### W2 — Formatter catalogue
- [x] Every formatter in the three family tables and every domain formatter exists, each in its own file with its own `__tests__/<name>.test.ts` (Rule 12), no file over 250 lines.
- [x] Each formatter is tested against **at least three locales** including one with a different grouping separator and one non-Latin script; the assertions pin ordering and structure, not a single hardcoded glyph.
- [x] `duration` renders clock form (`12:45`, `1:02:33`) and word form; `Intl.DurationFormat` is probed and the fallback produces the same string — a test runs both paths.
- [x] `truncate` cuts on graphemes: tests with an emoji sequence, a combining mark and a CJK string that the current `substring` breaks.
- [x] `collator` returns a comparator; a test sorts `['Ärger', 'Zebra', 'apple']` correctly in `de` and `sv` (where `Ä` sorts differently) and proves default `.sort()` disagrees.
- [x] `compact`, `percent` and `ordinal` are correct in a locale using a non-ASCII numbering system.
- [x] Domain formatters compose the primitives — no domain formatter builds an `Intl` object or a string of its own.

### W3 — Messages
- [x] `packages/universal/messages` exists, tier `universal`, layer **T3**, depending on `@vp/intl`; `pnpm boundaries` passes.
- [x] `dt()` extracts parameter names and types from the template literal: `t('videos.views', { conut: 5 })` and `t('videos.publishedRelative', { when: 5 })` are **compile errors**, proven by expect-error fixtures.
- [x] `{x:number}`, `{x:date}`, `{x:list}`, `{x:plural}` and `{x:enum}` all route through `@vp/intl`; a test asserts a message and the equivalent direct formatter call produce identical output.
- [x] Plurals select via `Intl.PluralRules`; `1 view` / `2 views` is tested, plus a locale with more than two plural categories.
- [x] The locale fallback chain walks `sv-FI` → `sv` → `en` per key; a partial catalogue resolves rather than failing wholesale.
- [x] `t` returns a `Result`; `tOr(key, args, fallback)` exists for render paths. A missing key produces a `Failure` carrying the key, not a thrown error and not a silent blank.
- [x] Every `ErrorCode` has copy, via an exhaustive `Record<ErrorCode, MessageKey>`; omitting one is a compile error. This closes the gap ticket 84 deferred.
- [x] One `en` catalogue ships, organised per feature; **no second language** is in this ticket.

### W4 — React binding
- [x] `packages/client/intl-react` exists, tier `client`, layer **T4**; `lockfile-closure.test.ts` still reports zero `server`-tier packages reachable from `apps/web`.
- [x] `IntlProvider`, `useT`, `useFormat` and `<Format>` exist and are tested with Testing Library.
- [x] Bindings are built once per locale, not per render — asserted by a render-count test.
- [x] Locale resolution order is explicit prop → persisted preference → `navigator.languages` → `en`, and locale detection exists **only** in this package.
- [x] The provider accepts a locale prop, so ticket 63 can inject a server-negotiated locale; a test renders the same markup with the same locale in jsdom and in a node string render.
- [x] `useT` outside the provider fails loudly with a message naming the provider, not silently.

### W5 — Retiring the ad-hoc formatters
- [x] `format-numbers.helper.ts` is deleted along with its export; no caller remains.
- [x] `javascript-time-ago` is removed from `apps/web/package.json` and the lockfile; the PR records the bundle-size delta.
- [x] `video-description.tsx:22` formats with an explicit locale; `:17` truncates with `truncate`, proven by an emoji test that fails against the current code.
- [x] Category and channel sorting goes through `collator`.
- [x] No `toLocaleString` / `toLocaleDateString` / `Intl.` constructor remains outside `@vp/intl` — asserted by W6.

### W6 — Enforcement & docs
- [x] The four assertions exist in `tests/architecture/`, run in `pnpm test:architecture` and in CI's `lint-typecheck` fail-fast step, each proven by a deliberately-violating fixture.
- [x] The four `FORMAT_*` codes exist in `ApiErrorCodes`, `PROBLEM_STATUS`, `RETRY_CLASS` and SDD §6.2.
- [x] `docs/standards/formatting-and-i18n.md` exists with the value union, option allowlist, placeholder syntax, SSR rules and the formatter-vs-message decision.
- [x] SDD: **ADR-25** added with rejected alternatives; §15.1 lists the three packages.
- [x] `ARCHITECTURE.md`: Invariant 8 added; §6 table gains the four rows.
- [x] Root `AGENTS.md` index and `packages/AGENTS.md` tier/layer tables updated; `AGENTS.md` + `CLAUDE.md` symlink written for each new package; `apps/web/AGENTS.md` gains the "components never format" section.
- [x] Tickets 58, 59, 60, 61, 63, 70, 71, 72, 73, 74 and 83 carry the note; `python3 docs/tickets/gen-index.py` re-run.

### Repo-wide
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm boundaries`, `pnpm test`, `pnpm test:bun`, `pnpm test:architecture`, `pnpm build` and `make smoke-offline` green, with output pasted in the PR.
- [x] **No new runtime dependency** — the packages are `Intl` and nothing else (local-first, PRD G11 / SDD P9). The ticket's net dependency change is **negative**: `javascript-time-ago` leaves.

---

## Out of scope

- **A second language, locale negotiation, the locale switcher and RTL** — ticket 86.
- **Translating the existing UI copy.** W3 ships the machinery and the catalogue structure; moving every literal out of every `.tsx` file follows the component rewrite in tickets 55–61, which would otherwise redo the work.
- **Time-zone selection UI.** The formatters take a time zone; choosing one is ticket 72 (settings).
- **Server-side copy.** The API keeps returning codes. `@vp/messages` is asserted unreachable from a server package.
- **Currency and monetisation.** `money` ships because it is the same `NumberFormat` call and costs nothing to include; nothing in the product charges money yet.

## Notes for the implementer

- **W1 before W2, and resist the temptation to skip straight to formatters.** The value union, the option allowlist and the memo cache are what make 25 formatters cheap; written after them, they become 25 refactors.
- **Named brand styles beat field options at call sites.** `date(style: 'short')` in a catalogue is one decision; `date(day: '2-digit', month: 'short', year: 'numeric')` repeated across 30 components is 30 decisions that will drift. Both are supported — the ticket's default is the named style.
- **Do not let a domain formatter grow a string.** `views` composes `compact` and `plural`; the moment it interpolates its own `' views'`, the copy has escaped the catalogue.
- **Test the shape, not the glyph.** `Intl` output changes between ICU versions; asserting `'1,500'` exactly makes the suite fail on a Node upgrade. Assert ordering, grouping presence and round-trips, as ticket 82's conformance suites do.
- **Read the whole file you touch** (W5 especially): `video-description.tsx` carries the truncation bug, the locale bug and a class-name expression worth simplifying. Fix them in the same change rather than leaving two for the next reader.

## Testing plan

- **Unit** — 1:1 per source file (Rule 12); every formatter across at least three locales, including a non-Latin script.
- **Type-level** — `tsc --noEmit` expect-error fixtures for the three compile-time guarantees: a misspelled message argument, a wrong argument type, and an `ErrorCode` with no copy.
- **Determinism** — the same fixed inputs formatted under `environment: 'node'` and `environment: 'jsdom'` produce byte-identical output. This is the SSR guarantee, and it is a test rather than a convention.
- **Performance** — 1,000 repeat formats construct zero new `Intl` objects; numbers in the PR.
- **Component** — Testing Library over `IntlProvider` for the W4 hooks and `<Format>`.
- **Architecture** — the four new assertions plus their violating fixtures.
- **Dual runtime** — green under `vitest` and `bun test`; `Intl` support differences between Node 24 and Bun 1.4 are probed, not assumed, and `duration` is the one to watch.

## Open questions

- **Is `@vp/intl` really universal, or is it `client` with an SSR asterisk?** *Decided:* universal. Ticket 63 executes it in Node, and `Intl` is an ECMAScript built-in with no browser coupling. Declaring it `client` would forbid the SSR render that the frontend roadmap requires.
- **One package or three?** *Decided:* three. A single package would put the product's copy inside the thing `apps/api` links for a byte count, and a single `client` package could not be server-rendered. Each boundary stops a specific thing; none is decorative.
- **`Intl` directly, or FormatJS / `react-intl`?** *Decided:* `Intl` directly. `react-intl` is ~50 KB gzipped to wrap built-ins the platform already ships, brings ICU message syntax this repo does not otherwise use, and is React-coupled — which the universal core must not be. The crash-course design shows the typed-message half is tractable; the part a library would genuinely save, plural rules, is `Intl.PluralRules`.
- **Does `t` returning a `Result` make render code noisy?** *Decided:* `tOr` is the render-path form and takes the fallback explicitly. `t` stays strict so that a missing key is visible in tests rather than rendering a raw key in production.
- **`FormatValue` shape.** *Decided:* one literal `type` per member (`{ type: 'count', value }`) rather than
  the key-as-tag shape above, so `formatValue` is an exhaustive `switch` and no `'x' in value` probe exists
  (`no-in-probes.test.ts`). Recorded in SDD ADR-26.
- **Ordinal suffixes.** *Decided:* copy, not formatter data. `videos.rank` is a `{position:plural}` message
  with `type: 'ordinal'` branches, so a new language is a catalogue entry; `@vp/intl` keeps `pluralCategory`.
- **The ticket 87 note.** *Decided:* the cache is a value its owner creates (`IntlProvider` per locale). No
  server code formats yet, so nothing is registered in the api container until a call site exists; never a
  module singleton. Recorded in SDD ADR-26.
- **Collator call sites.** *Decided:* `apps/web` sorts no category or channel list today (categories arrive
  ordered by `sortOrder`), so `collator` ships for the rewrite with no call site to replace.
- **Bun.** *Decided:* `pnpm test:bun` skips `packages/client/intl-react/**/*.test.tsx` only, the Testing
  Library specs that need a DOM; `resolve-locale.test.ts` runs under both.
- **Where does the time zone come from?** *Open.* The formatters take one; whether it is a user setting (ticket 72), the browser's, or the channel's is a product decision. Until then, the browser's, passed by the provider.

## Definition of Done

Every AC above ticked with pasted evidence; all six workstreams merged; `**Status:**` set to `done` and
`python3 docs/tickets/gen-index.py` re-run; branch-protected squash merges per
[docs/standards/git-workflow.md](../standards/git-workflow.md).
