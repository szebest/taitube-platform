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

- `visual/`: the visual suite. `visual.test.ts` reads the built `storybook-static/index.json` and shoots
  each story: on main every story at every registered theme and every shown mode, on a pull request only the
  stories its diff can move (`stories.ts`: all of them when the diff touches the tokens, themes, styles,
  appearance or the workbench, else those whose folder holds a changed file) at Sand dark and Nocturne light.
  The baselines are `visual/__screenshots__/*.png` in Git LFS (`.gitattributes`), drawn in the Playwright
  image CI pins by digest, never on a Mac: install `git lfs` before cloning, and redraw them with the
  command below. `.storybook/vitest.config.ts` runs every story as a test in Chromium (the vitest addon), its
  a11y checks failing it; it sits in `.storybook/` so the root run never picks it up.
- The visual jobs' ceiling: about 70 s a shard outside the shots, about 0.3 s a shot, 6 shots a story on main,
  so the 2 shards fit about 100 stories under the 4 minute budget. Past 100 stories, raise the `shard` matrix
  in `ci.yml` (and `--shard=x/<n>`) to keep about 45 stories a shard; stack 2's 180 or so stories need 4.

## Rules

- A story lives beside its component as `<name>.stories.tsx`, never here. Stories are exempt from the
  one-spec-per-file rule; the visual suite (slice p) is their test.
- A toolbar or option is never declared by hand: offering a set in the registry adds it here.

```bash
pnpm --filter @vp/workbench storybook        # http://localhost:6006
pnpm --filter @vp/workbench build:storybook  # storybook-static/
pnpm --filter @vp/workbench typecheck
pnpm --filter @vp/workbench test
pnpm --filter @vp/workbench test:stories     # every story in Chromium, a11y included
# the visual suite, in the pinned image (Storybook served on the host, from the workbench folder):
#   python3 -m http.server 6008 --directory storybook-static &
#   docker run --rm --platform linux/amd64 --add-host=host.docker.internal:host-gateway \
#     -v "$PWD/../../..:$PWD/../../.." -w "$PWD" -e VISUAL_BASE_URL=http://host.docker.internal:6008 \
#     <the image in ci.yml's visual job> node node_modules/@playwright/test/cli.js test \
#     -c visual/playwright.config.ts --update-snapshots
```
