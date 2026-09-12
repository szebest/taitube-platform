# 55: Modern design system foundation — Tailwind CSS v4, Radix UI primitives & theme engine

| Field | Value |
|---|---|
| Phase | 5 — Developer experience & growth |
| Issue | [#55](https://github.com/szebest/taitube-platform/issues/55) |
| Size | L |
| Blocked by | 53 — Frontend architecture · 54 — Frontend testing infrastructure |
| Blocks | 56, 57, 58, 60, 61, 69, 70, 71, 72, 75 |
| Spec | [PRD §1 Summary](../PRD.md#1-summary) |

**Status:** blocked

## What to build

### Architectural Decision: Keep SCSS + Bootstrap vs. Modernize to Tailwind CSS v4 + Radix Primitives

| Styling Architecture | Bundle Overhead | Maintainability & Ergonomics | Design Consistency | Verdict |
|---|---|---|---|---|
| **Bootstrap 5 + SCSS Modules** | Heavy (>180 KB), global CSS collisions, clunky specificity wars | Poor; duplicate rules across modules, rigid grid | Generic Bootstrap look, hard to skin smoothly | **Rejected (Deprecated)** |
| **Tailwind CSS v4 + Radix UI + CSS Variables** | Zero runtime CSS overhead, tree-shaken, utility-first consistency | Exceptional; co-located styles, standardized spacing & typography tokens | Seamless Dark/Light/OLED themes, polished YouTube aesthetic | **Accepted (Recommended)** |

This ticket refactors the frontend styling foundation, preserving the beloved features and layout of the original app while transforming it into a cohesive, modern streaming platform design language:

1. **Design Tokens & Color Palette**:
   - **Taitube Dark Theme (Default):** Deep obsidian/zinc background (`#0f0f0f`), elevated card surfaces (`#1f1f1f`), soft borders (`#272727`), and pure white primary text.
   - **Accents & Brand Identity:** Vibrant red/crimson playback accent (`#ff0000` / `#ef4444`) with subtle neon glow on interactive elements.
   - **Light Theme & OLED Pure Black Support:** CSS variable-based token system (`--bg-primary`, `--text-primary`, `--surface-elevated`) with automatic system preference detection and manual toggle.
2. **Accessible Headless UI Primitives (Radix UI / shadcn-style)**:
   - Replaces clunky Bootstrap modal/dropdown JS with accessible, unstyled Radix primitives:
     - `Dialog` (accessible modals with focus traps).
     - `DropdownMenu` (video context menus, user account menu).
     - `Tooltip` (icon action buttons, scrubbing previews).
     - `Tabs` (feed filters, studio navigation).
3. **Core Component Library (`apps/web/src/components/ui/`)**:
   - `Button`: Primary, Secondary, Ghost, Destructive, Icon-only with hover/active press animations.
   - `Input` & `Textarea`: Polished border focus rings, character count indicators.
   - `Badge`: Status badges (`READY`, `PROCESSING`, `4K`, `HD`, `NEW`).
   - `Avatar`: Fallback monogram letters with channel banner background.
   - `Skeleton`: Smooth shimmering loading placeholders matching exact card shapes to eliminate layout shift.

## Acceptance criteria

- [ ] Tailwind CSS v4 configured in `apps/web` with PostCSS and custom color tokens.
- [ ] Complete removal of `bootstrap`, `react-bootstrap`, and deprecated global SCSS files.
- [ ] Theme provider (`ThemeProvider`) supporting `dark`, `light`, and `system` with zero-flash on page load.
- [ ] Accessible Radix UI components integrated in `apps/web/src/components/ui/` (`Button`, `Dialog`, `Dropdown`, `Tooltip`, `Badge`, `Skeleton`).
- [ ] High contrast keyboard focus indicators (`focus-visible:ring-2 focus-visible:ring-red-500`) for all interactive elements.
- [ ] Component catalog test suite (Vitest + React Testing Library) verifying accessibility and theme token switching.

## Out of scope

- Page-level layout restructuring (handled in tickets 60 and 61).

## Notes for the implementer

- Keep all primitive UI components in `apps/web/src/components/ui/` <= 200 lines each.
- Ensure transitions use standard hardware-accelerated properties (`opacity`, `transform`).

## Testing plan

- Theme switch test: Toggle between Dark and Light mode and assert body classes and CSS variables update without page reload.
- Accessibility audit: Axe-core or testing-library assertion verifying 0 ARIA/contrast violations on all UI primitives.

## Definition of Done

- [ ] All UI primitives tested and green under `pnpm --filter @taitube/web test`.
- [ ] Bootstrap completely removed from `package.json`.
- [ ] Architecture and decision docs updated (`ARCHITECTURE.md`, `docs/SDD.md` and ADRs if boundaries, packages or contracts changed).
- [ ] Ticket status set to `done` and `python docs/tickets/gen-index.py` re-run.
