# AGENTS.md — @vp/ui (the design system)

> Tier rules for this directory: [../AGENTS.md](../AGENTS.md) · full tier & layer reference: [packages/AGENTS.md](../../AGENTS.md)

Owner: ticket [55](../../../docs/tickets/55-design-system-tailwind-radix-dark-theme.md). `client` tier, layer T2
(it depends on `@vp/result`).

## What it holds

The primitives every client app renders (`Button`, `Field`, `Select`, `Dialog`, `Sheet`, `Toast`, ...), `tv` and
`cn`, the design tokens in `design-system.css`, the theme (provider, cookie, menu, the pre-paint script), the
brand logo, and `readCookie` / `writeCookie` for any other UI state the server must render (web's sidebar).
An app links the stylesheet once, in its `__root.tsx`:

```tsx
import designSystem from '@vp/ui/design-system.css?url';
```

Every primitive lives in `src/<name>.tsx` with its spec in `__tests__/`. `apps/client/web`'s `/design-system`
(dev server only) renders each one and every exported part in both themes: add a new primitive or part to that
showcase in the same change.

## Rules

- **Tokens** are CSS variables in `design-system.css`: `--vp-*` holds the value per theme on `[data-theme]`,
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
- **The theme** is a cookie (`vp.theme`: `dark`, `light` or `system`) the server reads into `data-theme` on
  `<html>`; for `system` the `SYSTEM_THEME_SCRIPT` head script resolves it before paint. `useTheme()` reads and
  sets it.
- **Root providers** (`ThemeProvider`, `TooltipProvider`, `ToastProvider`) are mounted once, in an app's
  `__root.tsx`; a component never mounts its own.
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
