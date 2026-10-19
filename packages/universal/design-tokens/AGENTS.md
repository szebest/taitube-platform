# AGENTS.md - @vp/design-tokens (the design system engine)

Instructions for any coding agent working on `@vp/design-tokens`.

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

---

## 1. Scope & Purpose

`@vp/design-tokens` is the engine of the design system ([ticket 95](../../../docs/tickets/95-design-system-2.md),
[docs/design/architecture.md](../../../docs/design/architecture.md)): the schemas every token set and theme
parses against. `@vp/ui` holds the concrete values and imports this package to check them.

Today it holds the Zod schemas of the nine token groups in `src/schema/`, one file each: `typography`,
`fontSize`, `spacing`, `sizing`, `radius`, `border`, `shadow`, `ambient` and `motion`. Each file exports
`<group>Group`, `{ path, schema }`.

It is `universal` because `@vp/ui` (client) builds on it and the generators that write `tokens.json` and the
CSS run on a server. It is T2 because it will take the appearance vocabulary from `@vp/domain` (T1).

---

## 2. Invariants

1. **No concrete value.** A schema says what a set must hold, never what it holds. Values live in
   `@vp/ui/tokens/<path>/<id>`; `docs/design/tokens.json` is their image.
2. **Group keys are camelCase** (`fontSize`) in TypeScript and `tokens.json`; module paths and HTML
   attributes are kebab-case (`@vp/ui/tokens/font-size/<id>`, `data-font-size`). A group's `path` is the one
   place that mapping lives: never derive a kebab name anywhere else.
3. **A set names every key and nothing else.** Objects are strict and records are keyed by an enum, so a
   missing or misspelt key fails to parse.
4. **Every group spec parses every set of `tokens.json`** for that group through
   `describeTokenGroupContract`, and runs under node, jsdom and `bun test`.
5. **Relative imports are extensionless**, as in every tier.

---

## 3. Local Commands

```bash
pnpm --filter @vp/design-tokens typecheck
pnpm --filter @vp/design-tokens test
bun test packages/universal/design-tokens
```
