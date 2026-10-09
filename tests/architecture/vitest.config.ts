import { defineConfig } from 'vitest/config';
import { ALIASES, TYPE_AWARE } from './vitest.typed.config';

/**
 * The group after `architecture-typed`'s, on two threads: each thread parses the sources again, so
 * more of them cost more than they win on a 4-core runner.
 */
export default defineConfig({
  resolve: { alias: ALIASES },
  test: {
    name: 'architecture',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: TYPE_AWARE,
    testTimeout: 30_000,
    pool: 'threads',
    maxWorkers: 2,
    sequence: { groupOrder: 2 },
    isolate: false,
  },
});
