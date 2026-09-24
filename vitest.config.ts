import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    /**
     * `vitest*.config.ts` rather than `vitest.config.ts`: a package that must prove it runs in a
     * browser as well as on a server ships a second config, and the root run picks it up. Nested
     * `projects` inside a package config are not honoured here, so without the wider glob the
     * second environment would run only under `pnpm --filter` and never in CI.
     */
    projects: [
      'apps/*/vitest*.config.ts',
      'packages/*/*/vitest*.config.ts',
      'tests/architecture/vitest*.config.ts',
      'tests/in-process/vitest.config.ts',
      'scripts/vitest.config.ts',
    ],
  },
});
