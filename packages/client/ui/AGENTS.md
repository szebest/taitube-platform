# AGENTS.md — @vp/ui (the design system)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [55](../../../docs/tickets/55-design-system-tailwind-radix-dark-theme.md). `client` tier, layer T3
(it depends on `@vp/design-tokens`, T2, and `@vp/result`).

## What it holds

The primitives every client app renders (`Button`, `Field`, `Select`, `Dialog`, `Sheet`, `Toast`, ...), `tv` and
`cn`, the design tokens in `design-system.css`, the theme (provider, cookie, menu, the pre-paint script), the
brand logo, and `readCookie` / `writeCookie` for any other UI state the server must render (web's sidebar).
An app links the stylesheet once, in its `__root.tsx`:

```tsx
import designSystem from '@vp/ui/design-system.css?url';
```

The token set modules live in `src/tokens/<kebab-group>/<id>/index.ts`, one per implementation, exported as
`@vp/ui/tokens/<kebab-group>/<id>` (`"./tokens/*"` in `exports`). Each is data only, a `defineTokenSet` call
whose values are the image of `docs/design/tokens.json`; typography sets name font families and import no font
package. One spec, `src/tokens/__tests__/token-sets.test.ts`, parses every module and checks its id against its
folder.

Beside them, `src/tokens/ref/` holds the tier 1 ramps through `defineRef` (`ramps`, and `ref('sand.950')`, typed to
the steps they hold) and `src/tokens/scale/` the raw space scale, z layers, breakpoints and layout measures. Each
theme is a folder, `src/themes/<name>/`, whose `index.ts` holds its colour roles per mode, its dataviz palettes
and its `defineTheme` with one default set per group (one file, like a token set, so the folder spec covers it), exported as `@vp/ui/themes/<name>` (`"./themes/*"`). Only a theme picks a ramp step,
through `ref(...)`; a translucent role or a chart colour with no step is a plain hex. `src/themes/__tests__/themes.test.ts`
parses and resolves every theme folder and walks every theme, mode and required contrast pair, and every chart
series at 3:1 on `surface`; a failing pair is fixed in the theme and in `tokens.json`.

`pnpm gen:tokens` (`scripts/gen-tokens.ts`) writes `src/styles/generated/{themes,sets,tailwind-theme}.css` and
`docs/design/tokens.json` from the registry, offered themes and sets only; never edit them by hand, CI's
`pnpm gen:tokens --check` fails on drift. `@vp/ui/styles.css` (`src/styles/index.css`) imports the three.

`src/appearance/registry.ts` (exported as `@vp/ui/appearance/registry`, like `preference` and `resolve` beside it) is the one file that names themes and
sets to ship: `themes`, `defaultTheme` (Sand) and `offer`, the sets a viewer may switch to per group; `preference.ts` (the `vp.appearance` cookie, schema 2,
which keeps any well-formed id so one app never drops another's choice, and the legacy `vp.theme` read once) and
`resolve.ts` (override, else the app's defaults, else the theme's, an id the registry does not offer counted as
absent, reduced motion forced) build on it. `register-theme.ts` adds a theme that arrives as data: checked by
the contrast gate, installed as a constructed stylesheet, and selectable through `resolveAppearance`'s
`registered`. Changing the default theme is one line there, a theme's
default for a group one line in its `index.ts`, and offering a set one import and one entry.

`UiCopyProvider` (`src/copy/`) holds every word a primitive prints itself (`UI_COPY_KEYS`); a primitive reads
it with `useUiCopy()` and takes no label prop for it, and each app fills it through `@vp/queries`'
`AppWords`. `Icon` (`src/icon.tsx`) renders an inventory id from `src/icons/inventory.tsx`, the one place a
glyph is chosen, mirroring the directional ones under RTL.

Every primitive lives in `src/<name>.tsx` with its spec in `__tests__/`. `apps/client/web`'s `/design-system`
(dev server only) renders each one and every exported part in both themes: add a new primitive or part to that
showcase in the same change.

## Rules

- **Tokens** are CSS variables in `design-system.css`: `--vp-*` holds the value per mode on `[data-mode]`,
  and `@theme` maps it to a Tailwind colour. Components use the token classes (`tw:bg-surface`,
  `tw:text-fg-muted`, `tw:bg-popover`), never a hex value or a Tailwind palette colour.

  | Token | Use |
  |---|---|
  | `surface`, `surface-elevated` | the page, and a card on it |
  | `popover` | menus, select lists, dialogs, sheets, toasts |
  | `tint`, `tint-strong` | translucent fills: a secondary button, any hover, a skeleton; they read on every surface |
  | `border`, `border-strong` | dividers and control outlines |
  | `fg`, `fg-muted` | text |
  | `accent`, `danger`, `success`, `warning` and their `-solid`/`-hover`/`on-` pairs | intent |
  | `ring` | the one focus ring, `tw:focus-ring`, on every interactive primitive |

- **The stylesheet names this package as a Tailwind source** (`@source "./"`): an app's build scans its own
  tree, and these primitives sit outside it, so without the line their classes are never generated.
- **`tv()` only for real variants.** `tv()` from `tailwind-variants` is for a component that picks its classes
  by a prop (`variant`, `size`, `side`), and its variant names drive the specs' `it.each` through
  `variantNames`. Static classes go inline on the element, with `cn(..., className)` where a caller's class
  merges in. Both come from `class-names.ts`, which teaches tailwind-merge the z-index tokens.
- **Radix through the one `radix-ui` package**: `import { Dialog as DialogPrimitive } from 'radix-ui'`.
- **The appearance** is the `vp.appearance` cookie (`src/appearance/preference.ts`) the root route reads in
  `beforeLoad` and hands `ThemedDocument`, which renders `data-theme`, `data-mode`, `data-contrast` and one
  `data-<kebab-group>` per token group on `<html>`, the accent override and registered themes as inline styles
  under the request nonce, and a pre-paint script for a `system` mode and reduced motion. `useAppearance()`
  reads the resolved state and changes any axis or override; a change writes the cookie and swaps the attributes
  through a view transition, with no reload. A legacy `vp.theme` is rewritten once and deleted.
- **Root providers** (`ThemedDocument`'s `AppearanceProvider`, `TooltipProvider`, `ToastProvider`, and
  `@vp/queries`' `AppWords` as the router's `Wrap`) are mounted once; a component never mounts its own.
- **Motion** uses the `animate-*` tokens and stops under `prefers-reduced-motion`
  (`tw:motion-reduce:animate-none`, `tw:motion-safe:`).

## What does not belong here

- Anything that fetches, reads app config or knows a route: a primitive takes its data and its links as props.
- The legacy Bootstrap pieces (`modules/shared`, the SCSS): they stay in the app until their page ticket.
- Copy: labels come from the caller, strings from `@vp/messages`.

## Testing

Node specs (`*.test.ts`) and jsdom specs (`*.dom.test.tsx`, through `@vp/web-testing`'s `jsdom.setup`), each
jsdom spec checking `axeViolations()`.

```bash
pnpm --filter @vp/ui typecheck
pnpm --filter @vp/ui test
```
