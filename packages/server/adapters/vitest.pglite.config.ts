import { definePackageTestConfig } from '@vp/testing';
import { PGLITE_SPECS } from './vitest.config';

/**
 * The Postgres repository specs on one unisolated thread, so they share the single PGlite the
 * contract subjects start instead of paying its start-up once per file.
 */
export default definePackageTestConfig({
  test: {
    name: '@vp/adapters (pglite)',
    include: PGLITE_SPECS,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true, isolate: false } },
  },
});
