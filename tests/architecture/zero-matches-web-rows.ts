import type { Row } from './zero-matches-rows';

export const WEB_ROWS: readonly Row[] = [
  {
    name: 'a web module reading the build environment outside src/config (the dev-only gates in __root.tsx and design-system.tsx read import.meta.env.DEV themselves, or Rolldown ships their dead chunks)',
    pattern: /import\.meta\.env/g,
    scope: [
      ':(glob)apps/client/web/src/**/*.ts',
      ':(glob)apps/client/web/src/**/*.tsx',
      ':(exclude)apps/client/web/src/config/index.ts',
      ':(exclude)apps/client/web/src/routes/__root.tsx',
      ':(exclude)apps/client/web/src/routes/design-system.tsx',
      ':(exclude,glob)apps/client/web/src/**/__tests__/**',
    ],
    expected: 0,
    fires: 'const base = import.meta.env.VITE_API_BASE_URL;',
  },
  {
    name: 'a web import through the retired src/ alias instead of #app/',
    pattern: /(?:\bfrom|\bimport\(?|[mM]ock\(|importActual\(|@import|@use|@forward)\s*['"]src\//g,
    scope: [':(glob)apps/client/web/**/*.ts', ':(glob)apps/client/web/**/*.tsx', ':(glob)apps/client/web/**/*.scss'],
    expected: 0,
    fires: "import { API_BASE_URL } from 'src/config';",
  },
  {
    name: 'a web import climbing two or more directories instead of #app/',
    pattern: /(?:\bfrom|\bimport\(?|[mM]ock\(|importActual\()\s*['"](?:\.\.\/){2,}/g,
    scope: [':(glob)apps/client/web/**/*.ts', ':(glob)apps/client/web/**/*.tsx'],
    expected: 0,
    fires: "vi.doMock('../../../modules/shared/api', () => ({}));",
  },
  {
    name: 'a route component wrapped in lazy or lazyRouteComponent, which the Start splitter already splits (only a dev-only route gated on import.meta.env.DEV, __root.tsx and design-system.tsx, takes React.lazy)',
    pattern: /\blazyRouteComponent\b|\blazy\(/g,
    scope: [
      ':(glob)apps/client/web/src/routes/**/*.tsx',
      ':(exclude,glob)apps/client/web/src/**/__tests__/**',
      ':(exclude)apps/client/web/src/routes/__root.tsx',
      ':(exclude)apps/client/web/src/routes/design-system.tsx',
    ],
    expected: 0,
    fires: "component: lazyRouteComponent(() => import('#app/features/x/page'), 'Page'),",
  },
  {
    name: 'a web dependency on Redux or react-hook-form, which TanStack Query and Form replaced',
    pattern: /['"](?:@reduxjs\/toolkit|react-redux|react-hook-form)(?:\/[^'"]*)?['"]/g,
    scope: [':(glob)apps/client/web/**/*.ts', ':(glob)apps/client/web/**/*.tsx', 'apps/client/web/package.json'],
    expected: 0,
    fires: "import { createApi } from '@reduxjs/toolkit/query/react';",
  },
];
