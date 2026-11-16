import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load } from '../../scripts/workspace-packages';

const REPO = resolve(import.meta.dirname, '../..');

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
  return load(REPO)
    .filter(({ dir }) => dir.startsWith('packages/'))
    .map(({ name, dir }) => {
      const root = join(REPO, dir);
      return { name, root, src: existsSync(join(root, 'src')) ? join(root, 'src') : root };
    });
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
