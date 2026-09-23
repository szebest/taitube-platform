import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const PACKAGES = resolve(import.meta.dirname, '../../packages');

const TIERS = ['universal', 'server', 'client'];

/**
 * `lint-typecheck` runs this suite before anything is built, so a workspace package an assertion
 * imports resolves to its source rather than to a `dist` that does not exist yet.
 */
const sourceAliases = TIERS.flatMap((tier) =>
  readdirSync(join(PACKAGES, tier), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name)
    .map((name) => ({ name, entry: join(PACKAGES, tier, name, 'src/index.ts') }))
    .filter(({ entry }) => existsSync(entry))
    .map(({ name, entry }) => ({ find: new RegExp(`^@vp/${name}$`), replacement: entry }))
);

export default defineConfig({
  resolve: { alias: sourceAliases },
  test: {
    name: 'architecture',
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
