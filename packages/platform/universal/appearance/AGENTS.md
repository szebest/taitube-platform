# AGENTS.md - @kit/appearance (the appearance vocabulary)

> Tier rules for this directory: [packages/AGENTS.md](../../../AGENTS.md)

## 1. Scope

A platform package (`packages/platform/`): no app vocabulary, no dependency (`pnpm boundaries`). It holds the
words a viewer's appearance is spoken in, in `src/appearance.ts`: the mode and contrast options with their
defaults, the id, token group and accent patterns, and the override cap. `@kit/design-tokens` keys its theme
schema by the modes, `@kit/ui` parses the appearance cookie with them, and the app's settings catalogue builds
its appearance section on them; each imports them from here and never redeclares one.

`universal`, layer 0, so the app's lowest vocabulary package can import it. A value only one app uses (a cookie
name, which section a setting sits in) is the app's, not this package's.

## 2. Local Commands

```bash
pnpm --filter @kit/appearance typecheck
pnpm --filter @kit/appearance test
```
