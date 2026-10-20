# AGENTS.md - @vp/workbench (the design system workbench)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [95](../../../docs/tickets/95-design-system-2.md). `client` tier, layer T4 (it depends on
`@vp/ui`, `@vp/design-tokens` and `@vp/messages`). Nothing imports it: it is Storybook over every story in the
repo.

## What it holds

- `.storybook/main.ts`: Storybook 10 on Vite, the stories of `packages/client/*/src` and `apps/client/*/src`
  (`*.stories.tsx` beside the component), the a11y and vitest addons, `@vp/*` resolved to source through
  `@vp/vite-preset`'s `workspaceSourceAliases`, Tailwind, and telemetry off (local-first: Storybook phones
  nowhere). `@tanstack/react-start` is aliased to `.storybook/tanstack-start.ts`, the browser half `@vp/ui`'s
  cookies use, since a story never runs a server.
- `.storybook/preview.tsx` and `preview.css`: `@vp/ui/styles.css`, the apps' folders as Tailwind sources,
  and the toolbars.
- `src/toolbars.ts`: one toolbar per axis, built from the appearance registry (themes, the shown modes,
  contrast, and per token group the theme default plus every offered set), and `preferenceFromGlobals`, the
  preference they describe.
- `src/decorator.tsx`: `withAppearance` renders each story inside `AppearanceProvider` and puts the
  appearance on `<html>` through `applyAppearance`, the attributes `ThemedDocument` renders in the apps, with
  the `ui` words of the en catalogue as its `UiCopy`.

## Rules

- A story lives beside its component as `<name>.stories.tsx`, never here. Stories are exempt from the
  one-spec-per-file rule; the visual suite (slice p) is their test.
- A toolbar or option is never declared by hand: offering a set in the registry adds it here.

```bash
pnpm --filter @vp/workbench storybook        # http://localhost:6006
pnpm --filter @vp/workbench build:storybook  # storybook-static/
pnpm --filter @vp/workbench typecheck
pnpm --filter @vp/workbench test
```
