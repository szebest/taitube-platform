import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../architecture/workspace-sources';

export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'in-process',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
  },
});
