import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'vitest/config';
import { workspaceSources } from './workspace-sources';

const sourceAliases = workspaceSources().flatMap(({ name, src }) => [
  ...(existsSync(join(src, 'index.ts'))
    ? [{ find: new RegExp(`^${name}$`), replacement: join(src, 'index.ts') }]
    : []),
  { find: new RegExp(`^${name}/(.+)$`), replacement: join(src, '$1') },
]);

export default defineConfig({
  resolve: { alias: sourceAliases },
  test: {
    name: 'architecture',
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
