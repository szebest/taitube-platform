# AGENTS.md - @vp/intl-formats (the product's tagged values)

> Tier rules for this directory: [packages/AGENTS.md](../../AGENTS.md) · the formatters they compose:
> [@kit/intl](../../platform/universal/intl/AGENTS.md)

## 1. Scope

`views`, `subscribers`, `commentCount`, `videoDuration`, `publishedAt`, `resolution`, `fileSize` and
`uploadProgress`: each returns a tagged value from `@kit/intl` and builds neither an `Intl` object nor a string.
The words around a value are copy and live in `@vp/messages`. `universal`, layer T3, above `@kit/intl`.

## 2. Local Commands

```bash
pnpm --filter @vp/intl-formats typecheck
pnpm --filter @vp/intl-formats test
```
