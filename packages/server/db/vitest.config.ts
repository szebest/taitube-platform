import { definePackageTestConfig } from '@vp/testing';

// PGlite is WebAssembly: see packages/server/adapters/vitest.config.ts for why it runs in forks.
export default definePackageTestConfig({ test: { pool: 'forks' } });
