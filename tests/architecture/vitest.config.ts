import { defineConfig } from 'vitest/config';
import { TYPE_AWARE } from './vitest.typed.config';
import { sourceAliases } from './workspace-sources';

/**
 * One thread, beside the typed project's one fork, so each source is read and parsed once: split
 * across workers, every worker imports TypeScript and parses the repo again. A thread and not a
 * second fork because two projects on the same pool share its single fork and run one after the other.
 */
export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'architecture',
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: TYPE_AWARE,
    testTimeout: 30_000,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true, isolate: false } },
  },
});
