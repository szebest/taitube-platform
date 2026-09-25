# 55: Modern design system foundation — Tailwind CSS v4, Radix UI primitives & theme engine

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#55](https://github.com/szebest/taitube-platform/issues/55) |
| Size | L |
| Blocked by | 54 - Frontend testing infrastructure · 89 - TanStack Start foundation · 91 - Web import aliases |
| Blocks | 57, 58, 59, 60, 61, 69, 70, 72 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

## What to build

Tailwind v4 and Radix primitives in `src/components/ui/`, the folder 89 left empty, plus a theme that SSR
renders correctly. Bootstrap and the legacy SCSS stay alongside until [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md)
removes them with the last legacy page; nothing here restyles a legacy page.

### 1. Tailwind and tokens

- Tailwind v4 through `@tailwindcss/vite` in the app's Vite config, imported once from `__root.tsx` next to
  the global styles 89 put there. No PostCSS config of our own.
- Design tokens as CSS variables in `@theme`: surface (`#0f0f0f` dark default, elevated `#1f1f1f`, border
  `#272727`), text, accent red, spacing, radius, type scale. Components use tokens, never raw hex values.
- Bootstrap and Tailwind do not fight: Tailwind's preflight is scoped or disabled so legacy pages render as
  they do today (checked on `/` and `/watch/<id>`).

### 2. Theme

- `dark`, `light` and `system`. The choice lives in a cookie, so the server renders `data-theme` on `<html>`
  and the first paint is already right. For `system`, a small inline script in the `__root.tsx` head resolves
  `prefers-color-scheme` before paint. No flash and no hydration mismatch.
- A `ThemeProvider` in `src/components/ui/theme/` replaces the legacy
  `src/modules/shared/providers/theme-provider.tsx`; the legacy header toggle switches to it and the old one
  is deleted.

### 3. Primitives in `src/components/ui/`

- `Button` (primary, secondary, ghost, destructive, icon), `Input`, `Textarea`, `Badge`, `Avatar` (monogram
  fallback) as plain Tailwind components.
- `Dialog`, `DropdownMenu`, `Tooltip`, `Tabs` on Radix, styled with the tokens.
- `Skeleton` (from 71), with the shimmer turned off under `prefers-reduced-motion`.
- One visible `focus-visible` ring on every interactive primitive.

## Delivery slices

1. Tailwind, tokens and the theme with the cookie and head script.
2. Plain primitives: `Button`, `Input`, `Textarea`, `Badge`, `Avatar`, `Skeleton`.
3. Radix primitives: `Dialog`, `DropdownMenu`, `Tooltip`, `Tabs`.

## Acceptance criteria

- [ ] Tailwind v4 runs through `@tailwindcss/vite`; legacy pages look unchanged next to it.
- [ ] SSR HTML for any route carries the theme from the cookie on `<html>`; a `system` render sets it before
      first paint; no hydration warning in the browser console.
- [ ] The legacy theme provider is deleted and the header toggle drives the new one.
- [ ] Each primitive has its own spec on the `jsdom` project from 54 (role, accessible name, keyboard for the
      Radix ones) and passes an `axe-core` check in both themes.
- [ ] `Skeleton` renders without animation under `prefers-reduced-motion`.
- [ ] `pnpm --filter @vp/web test`, `pnpm typecheck`, `pnpm lint` green; `make smoke-offline` passes (no
      fonts or CSS from an off-machine host).

## Out of scope

- Removing Bootstrap, `react-bootstrap` and SCSS: [62](62-frontend-performance-virtualization-ssr-bundle-hardening.md).
- Page layouts and per-page skeletons: [58](58-modern-browse-layout-microinteractions-motion.md), [59](59-video-watch-page-responsive-layout-enhancements.md), [60](60-creator-studio-dashboard-video-management-ui.md).
- URL-driven modals on top of `Dialog`: [69](69-frontend-url-state-search-params-modal-routing.md).
- Theme choice in settings: [72](72-frontend-settings-customization-system.md).

## Definition of Done

- [ ] All acceptance criteria proved with command output in the PR.
- [ ] `apps/web/AGENTS.md` documents the tokens and where primitives live.
- [ ] Ticket status set to `done` and `python3 docs/tickets/gen-index.py` re-run.
