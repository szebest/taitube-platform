import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * `vitest*.config.ts` rather than `vitest.config.ts`: a package that must prove it runs in a
     * browser as well as on a server ships a second config, and the root run picks it up. A
     * project config inherits nothing from this file, so each one sets its own `pool` and `isolate`.
     */
    projects: [
      'apps/*/vitest*.config.ts',
      'packages/*/*/vitest*.config.ts',
      'tests/architecture/vitest*.config.ts',
      'tests/in-process/vitest.config.ts',
      'scripts/__tests__/vitest.config.ts',
    ],
  },
});
