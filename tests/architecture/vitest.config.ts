import { defineConfig } from 'vitest/config';
import { ALIASES, TYPE_AWARE } from './vitest.typed.config';

/**
 * Two workers, the same cap as `architecture-typed`: Vitest 5 caps a `groupOrder` across all of its
 * projects, so at one worker the two projects run one after the other instead of side by side.
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
    sequence: { groupOrder: 1 },
    isolate: false,
  },
});
