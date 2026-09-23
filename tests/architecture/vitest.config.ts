import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { workspaceSources } from './workspace-sources';

const sourceAliases = workspaceSources()
  .map(({ name, src }) => ({ name, entry: join(src, 'index.ts') }))
  .filter(({ entry }) => existsSync(entry))
  .map(({ name, entry }) => ({ find: new RegExp(`^${name}$`), replacement: entry }));

export default defineConfig({
  resolve: { alias: sourceAliases },
  test: {
    name: 'architecture',
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
