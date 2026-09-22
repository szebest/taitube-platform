import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      'apps/*/vitest.config.ts',
      'packages/*/*/vitest.config.ts',
      'tests/architecture/vitest.config.ts',
    ],
  },
});
