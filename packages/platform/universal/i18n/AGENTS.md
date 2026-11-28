# AGENTS.md - @kit/i18n (the typed message engine)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md) · tokens and registry:
> [@kit/di](../di/AGENTS.md) · formatting: [@kit/intl](../intl/AGENTS.md) · authority:
> [docs/standards/formatting-and-i18n.md](../../../../docs/standards/formatting-and-i18n.md)

## 1. Scope

A platform package (`packages/platform/`): no app vocabulary, platform dependencies only (`pnpm boundaries`). It is
the engine of the app's words and holds none of them: no catalogue, no locale data, no error code. An app (or a
server rendering its own text) builds one engine value and gets every type from it:

```ts
const engine = defineEngine({ kinds: builtInKinds, presets: definePresets({...}), params: defineParams([...] as const) });
const { dt, defineCatalogue, createI18n } = engine;
```

| Export | What it is |
|---|---|
| `defineEngine({ kinds, presets, params })` | the bound `{ dt, defineCatalogue, createI18n }`, typed by those three (`src/engine.ts`) |
| `defineKind({ name, config, arg, options, render })` | a placeholder kind; `number`, `date`, `list`, `plural`, `enum` are written with it (`src/kinds/`) |
| `definePresets({ <kind>: { <name>: { default, <locale>... } } })` | named option sets, resolved per locale; lives in `@kit/intl` (`src/presets.ts`), which the engine and a server render share |
| `defineParams([...] as const)` | the closed vocabulary of placeholder names (`src/params.ts`) |
| `createI18n<AppCatalogue>()` | `createTranslator`, `fromRegistry`, `providers`, typed by the catalogue the app registers |
| `DisjointNamespaces<[typeof web, typeof shared]>` | an app's catalogues merged, `NamespaceCollision` when two share a namespace |

Tokens it consumes (each required, no default; `createI18n<App>().providers(catalogues)` builds all three for the
composition root):

| Token | Value |
|---|---|
| `Catalogues` | `{ locale, source, translations }`: the source locale's catalogue and its translations |
| `FormatPresets` (from `@kit/intl`) | the app's `definePresets` table |
| `ParamVocabulary` | the app's `defineParams` list |

Install: `pnpm add @kit/i18n`. Usage: see [README.md](README.md). Registries: none; the catalogues arrive through the
`Catalogues` token.

## 2. Invariants

1. **The template is the type.** `dt('{count:plural} views', ...)` makes `count` a required `number`; a kind's `arg`
   guard types its argument (`{x:date}` an ISO string, `{x:list}` a string array, `{x:enum}` one of the keys its
   labels declare), `{x}` takes text or a number. A missing or misspelt argument is a compile error.
2. **The placeholder grammar is flat.** `{name}` or `{name:kind}` and nothing nested; `ParseTemplate` (types) and
   `placeholders` (run time) read it the same way. A plural's branches live in its config and select through
   `Intl.PluralRules`; `{?}` in a branch is the count and the only placeholder a branch may hold.
3. **Every placeholder renders through its kind, and the built-ins through `@kit/intl`**, so a message and a direct
   format agree byte for byte.
4. **`t` returns a `Result`.** A missing key is a failure carrying the key; `tOr(key, args, fallback)` is the
   render-path form. Nothing here throws.
5. **The chain is walked per key**: `sv-FI`, `sv`, then the source locale. A partial translation is useful, never
   broken. Presets resolve along the same chain, then `default`.
6. **Config is exactly the template's.** One entry per kind the template uses, keyed by exactly that kind's names;
   `plural` and `enum` must be configured (`MissingConfig`), `number`, `date` and `list` may be. An extra kind, name or
   option, an unknown preset and a stray `{x}` in a branch fail to compile, named: `UnknownKind`, `UnknownParam`,
   `UnknownOption`, `UnknownPreset`, `PlaceholderInBranch`.
7. **Names are a closed, lower camelCase vocabulary.** A name outside `defineParams` is `UnknownParam`, one that is
   not lower camelCase letters is `InvalidParamName`, one used twice is `DuplicateParam`, one with two kinds (or bare
   and typed) is `ClashingKinds`.
8. **Every locale takes the source's params.** A translation is declared with `defineCatalogue<typeof source>()`,
   which compares each message's params both ways: a renamed, dropped, added or retyped argument fails in the file
   of the locale that drifted.
9. **`t` is typed by the app's catalogue**, never one of this package: `createI18n<AppCatalogue>()`.
10. **Extend, never edit.** A new kind is `defineKind` in the app, a new option set a preset; the engine is not
    edited for either.
11. **Platform strictness.** No `any`, no type assertion except `as const`, no non-null `!`, no `@ts-ignore`. Every
    public generic has a type-level spec under `src/__tests__/type-fixtures/` (run by `typecheck`), including a second
    engine with its own kinds and presets.
12. **Universal, T4** (above `@kit/di` and `@kit/intl`), ESM only, `sideEffects: false`; runs under `vitest` and
    `bun test`.

## 3. Local Commands

```bash
pnpm --filter @kit/i18n typecheck
pnpm --filter @kit/i18n test
bun test packages/platform/universal/i18n
```
