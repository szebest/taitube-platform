import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './repo-files';
import type { Row } from './zero-matches-rows';

/** The memoization the React Compiler cannot stand in for, each file with its reason. */
export const MANUAL_MEMO_ALLOWLIST: Readonly<Record<string, string>> = JSON.parse(
  readFileSync(join(ROOT, 'tests/react-compiler/manual-memo-allowlist.json'), 'utf8')
);

const CLIENT_SOURCE = [
  ':(glob)apps/client/**/*.ts',
  ':(glob)apps/client/**/*.tsx',
  ':(glob)packages/client/**/*.ts',
  ':(glob)packages/client/**/*.tsx',
  ':(glob)packages/universal/**/*.ts',
  ':(glob)packages/universal/**/*.tsx',
  ':(exclude,glob)**/*.test.ts',
  ':(exclude,glob)**/*.test.tsx',
  ':(exclude,glob)**/__tests__/**',
];

/** What the React Compiler and React 19 replaced in the browser tiers. */
export const REACT_ROWS: readonly Row[] = [
  {
    name: 'manual memoization the React Compiler does (useMemo, useCallback, memo; the exceptions are tests/react-compiler/manual-memo-allowlist.json)',
    pattern: /\b(?:useMemo|useCallback|memo)\s*[<(]/g,
    scope: [
      ...CLIENT_SOURCE,
      ...Object.keys(MANUAL_MEMO_ALLOWLIST).map((file) => `:(exclude)${file}`),
    ],
    expected: 0,
    fires: 'const shared = useMemo(() => ({ size }), [size]);',
    passes: 'const shared = { size };',
  },
  {
    name: 'forwardRef, which React 19 replaced with ref as a prop',
    pattern: /\bforwardRef\b/g,
    scope: CLIENT_SOURCE,
    expected: 0,
    fires: 'export const Button = forwardRef(function Button(props, ref) {',
  },
  {
    name: 'a Context.Provider, which React 19 replaced with the context itself as the provider',
    pattern: /\b\w*Context\.Provider\b/g,
    scope: [
      ':(glob)apps/client/**/*.tsx',
      ':(glob)packages/client/**/*.tsx',
      ':(glob)packages/universal/**/*.tsx',
    ],
    expected: 0,
    fires: '<IntlContext.Provider value={bindings}>{children}</IntlContext.Provider>',
    passes: '<Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>',
  },
];
