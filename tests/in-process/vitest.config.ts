import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../architecture/workspace-sources';

export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'in-process',
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
