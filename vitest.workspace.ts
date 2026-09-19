import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'adapters/vitest.config.ts',
  'apps/*/vitest.config.ts',
  'packages/*/vitest.config.ts',
  'tools/*/vitest.config.ts',
]);
