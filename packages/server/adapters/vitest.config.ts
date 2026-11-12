import { definePackageTestConfig } from '@vp/testing';
import { configDefaults } from 'vite-plus';

export default definePackageTestConfig({
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/__tests__/integration/**'],
    globalSetup: ['__tests__/contract/pglite-snapshot.ts'],
    // PGlite is WebAssembly: run in worker threads, it races V8's process-wide JIT page registry and
    // aborts the whole run with `Check failed: jit_page.has_value()`. A fork has its own V8.
    pool: 'forks',
  },
});
