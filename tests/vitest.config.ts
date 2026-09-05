import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
