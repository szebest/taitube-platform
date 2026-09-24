import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PACKAGES = resolve(import.meta.dirname, '../../packages');
const TIERS = ['universal', 'server', 'client'];

export interface WorkspaceSource {
  name: string;
  root: string;
  src: string;
}

/**
 * Every workspace package by the name its manifest declares, with the directory its source lives in.
 * The architecture suite runs before anything is built, so it resolves `@vp/*` here, not to `dist`.
 */
export function workspaceSources(): WorkspaceSource[] {
  return TIERS.flatMap((tier) =>
    readdirSync(join(PACKAGES, tier), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => join(PACKAGES, tier, name))
      .filter((root) => existsSync(join(root, 'package.json')))
      .map((root) => {
        const { name } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
          name: string;
        };
        return { name, root, src: existsSync(join(root, 'src')) ? join(root, 'src') : root };
      })
  );
}

/** `@vp/*` mapped to source, for a Vite config that runs specs against the workspace unbuilt. */
export function sourceAliases(): { find: RegExp; replacement: string }[] {
  return workspaceSources().flatMap(({ name, src }) => [
    ...(existsSync(join(src, 'index.ts'))
      ? [{ find: new RegExp(`^${name}$`), replacement: join(src, 'index.ts') }]
      : []),
    { find: new RegExp(`^${name}/(.+)$`), replacement: join(src, '$1') },
  ]);
}
