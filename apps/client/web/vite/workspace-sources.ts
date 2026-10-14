import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Alias } from 'vite';

const BROWSER_TIERS = ['universal', 'client'];

/**
 * Points each browser-tier package's bare name at its TypeScript source, so the dev server, the
 * build and the specs read the code itself, with HMR, instead of a `dist` a build must refresh.
 */
export function workspaceSourceAliases(packagesDir: string): Alias[] {
  return BROWSER_TIERS.flatMap((tier) =>
    readdirSync(join(packagesDir, tier)).flatMap((dir) => {
      const entry = join(packagesDir, tier, dir, 'src', 'index.ts');
      if (!existsSync(entry)) return [];
      const { name } = JSON.parse(readFileSync(join(packagesDir, tier, dir, 'package.json'), 'utf8'));
      return [{ find: new RegExp(`^${name}$`), replacement: entry }];
    })
  );
}
