import { defineConfig } from 'vitest/config';
import { sourceAliases } from './workspace-sources';

export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'architecture',
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
  },
});
