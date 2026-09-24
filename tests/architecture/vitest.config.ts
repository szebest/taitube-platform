import { defineConfig } from 'vitest/config';
import { TYPE_AWARE } from './vitest.typed.config';
import { sourceAliases } from './workspace-sources';

export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'architecture',
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: TYPE_AWARE,
    testTimeout: 30_000,
  },
});
