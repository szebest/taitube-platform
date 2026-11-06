import type { Row } from './zero-matches-rows';

/** All but docs, which keep the history, the lockfile and the skill symlinks `read` cannot open. */
const OUTSIDE_HISTORY = [
  ':(exclude)docs',
  ':(exclude)pnpm-lock.yaml',
  ':(exclude)tests/architecture/zero-matches-retired-tool-rows.ts',
  ':(exclude).claude/skills',
  ':(exclude,glob)apps/*/*/.claude/skills',
];

/** Tools the repo replaced: CRA by Vite, and what the Oxc and Vite+ toolchain replaced (ADR-29). */
export const RETIRED_TOOL_ROWS: readonly Row[] = [
  {
    name: 'Create React App, craco or a CRA build variable',
    pattern: /react-scripts|craco|REACT_APP_/g,
    scope: [
      ':(exclude)docs/tickets',
      ':(exclude)docs/reviews',
      ':(exclude).agents',
      ':(exclude)pnpm-lock.yaml',
      ':(exclude)tests/architecture/zero-matches-retired-tool-rows.ts',
      ':(exclude).claude/skills',
      ':(exclude,glob)apps/*/*/.claude/skills',
    ],
    expected: 0,
    fires: '"start": "craco start",',
  },
  {
    name: 'Biome, its config or a biome-ignore (oxlint and oxfmt replaced it)',
    pattern: /\bbiome\b|@biomejs|biome-ignore/gi,
    scope: OUTSIDE_HISTORY,
    expected: 0,
    fires: '"lint": "biome lint --error-on-warnings .",',
  },
  {
    name: 'lefthook (the pre-commit runs through vp staged)',
    pattern: /\blefthook\b/gi,
    scope: OUTSIDE_HISTORY,
    expected: 0,
    fires: '"prepare": "lefthook install || true",',
  },
  {
    name: 'the esbuild bundle script (vp pack bundles the server apps)',
    pattern: /bundle-entrypoints/g,
    scope: OUTSIDE_HISTORY,
    expected: 0,
    fires: '"build": "tsx ../../../scripts/bundle-entrypoints.ts dist/bundle src/main.ts",',
  },
];
