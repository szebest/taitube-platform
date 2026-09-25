import type { Row } from './zero-matches-rows';

export const WEB_ROWS: readonly Row[] = [
  {
    name: 'a web module reading the build environment outside src/config',
    pattern: /import\.meta\.env/g,
    scope: [
      ':(glob)apps/web/src/**/*.ts',
      ':(glob)apps/web/src/**/*.tsx',
      ':(exclude)apps/web/src/config/index.ts',
      ':(exclude,glob)apps/web/src/**/__tests__/**',
    ],
    expected: 0,
    fires: 'const base = import.meta.env.VITE_API_BASE_URL;',
  },
  {
    name: 'a web import through the retired src/ alias instead of #app/',
    pattern: /(?:\bfrom|\bimport\(?|[mM]ock\(|importActual\(|@import|@use|@forward)\s*['"]src\//g,
    scope: [':(glob)apps/web/**/*.ts', ':(glob)apps/web/**/*.tsx', ':(glob)apps/web/**/*.scss'],
    expected: 0,
    fires: "import { API_BASE_URL } from 'src/config';",
  },
  {
    name: 'a web import climbing two or more directories instead of #app/',
    pattern: /(?:\bfrom|\bimport\(?|[mM]ock\(|importActual\()\s*['"](?:\.\.\/){2,}/g,
    scope: [':(glob)apps/web/**/*.ts', ':(glob)apps/web/**/*.tsx'],
    expected: 0,
    fires: "vi.doMock('../../../modules/shared/api', () => ({}));",
  },
];
