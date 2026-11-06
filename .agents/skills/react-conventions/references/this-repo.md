# This repo

React lives in `apps/client/web` and `packages/client/intl-react`. The web app's own rules
are `apps/client/web/AGENTS.md`, which wins over SKILL.md: its stack table, folders
(`routes/`, `features/<feature>/`, `integrations/`), loaders and query factories, `#app/`
imports, the design system and its numbered rules.

What it means for SKILL.md:

- **The Oxc React Compiler is on** for both apps, every client package, their specs and the
  stories (`reactPlugins()` in `@vp/vite-preset`), so hard rule 5 holds: the exceptions are
  `tests/react-compiler/manual-memo-allowlist.json`, each with its reason, and a zero-matches
  row fails any other `useMemo`, `useCallback` or `memo`. What the compiler skips is
  `tests/react-compiler/baseline.json`, which may only shrink: fix the code (no mutation of
  props, state or render values, no ref reads in render, derived values computed) before adding
  an entry. `"use no memo"` is the last resort, for a third-party API that breaks the rules,
  under a `// no-memo: <reason>` line the `house/use-no-memo-reason` lint rule requires.
  `pnpm react-compiler:report` lists what it skips.
- **Data loads in the route loader** and the component reads it with `useSuspenseQuery`;
  that is hard rule 1's router or query library.
- **Styling**: Tailwind 4 with plain class names, the token classes from
  `design-system.css`, `tv()` only for real variants and `cn()` for merging, Radix through
  the one `radix-ui` package.
- **New files are kebab-case** (`theme-provider.tsx`), with the spec in `__tests__/` beside the
  source.
