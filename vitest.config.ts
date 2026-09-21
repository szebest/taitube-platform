import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    projects: [
      'adapters/vitest.config.ts',
      'apps/*/vitest.config.ts',
      'packages/*/vitest.config.ts',
      'tools/*/vitest.config.ts',
    ],
  },
});
