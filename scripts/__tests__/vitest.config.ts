import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'scripts',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    environment: 'node',
    pool: 'threads',
    isolate: false,
    root: resolve(import.meta.dirname, '..'),
    include: ['__tests__/*.test.ts', '*/__tests__/*.test.ts'],
    testTimeout: 30_000,
  },
});
