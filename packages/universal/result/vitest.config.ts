import { defineConfig } from 'vitest/config';

/**
 * Declared inline rather than through `@vp/testing`: the toolkit depends on this package, so
 * importing its config factory here would make the build graph a cycle.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['src/**/__tests__/**/*.test.ts'],
  },
});
