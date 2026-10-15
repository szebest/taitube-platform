# This repo

React lives in `apps/client/web` and `packages/client/intl-react`. The web app's own rules
are `apps/client/web/AGENTS.md`, which wins over SKILL.md: its stack table, folders
(`routes/`, `features/<feature>/`, `integrations/`), loaders and query factories, `#app/`
imports, the design system and its numbered rules.

What it means for SKILL.md:

- **No React Compiler**: the app builds with plain `@vitejs/plugin-react`
  (`@vp/vite-preset`, which `apps/client/web/vite.config.ts` calls), so hard rule 5 is the "without it" branch: the
  existing `useMemo` and `useCallback` calls (providers, shared hooks, legacy modules) stay
  only where they guard a context value or an effect dependency.
- **Data loads in the route loader** and the component reads it with `useSuspenseQuery`;
  that is hard rule 1's router or query library.
- **Styling**: Tailwind 4 with every class prefixed `tw:`, the token classes from
  `design-system.css`, `tv()` only for real variants and `cn()` for merging, Radix through
  the one `radix-ui` package. The legacy pages under `src/modules/` keep Bootstrap and
  SCSS until their page ticket replaces them: never extend them.
- **New files are kebab-case** (`theme-provider.tsx`), with the spec in `__tests__/` beside the
  source.
