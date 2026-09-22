import { normalize } from 'node:path';
import { read } from './repo-files';

const IMPORTER = /^ {2}(\S+):$/;
const GROUP = / {4}(dependencies|optionalDependencies|devDependencies):$/;
const LINK = /^ {8}version: link:(\S+)$/;

/**
 * Mirrors `BUILD_TOOLING` in `scripts/check-boundaries.ts`, including the part that makes
 * the exemption safe: it holds only on a dev edge. A *runtime* dependency on either would
 * ship, so it stays in the closure and the tier assertions get to see it.
 */
export const BUILD_TOOLING = ['packages/server/testing', 'packages/universal/tsconfig'];

export type DependencyGroup = 'runtime' | 'dev';

export interface WorkspaceLink {
  path: string;
  dev: boolean;
}

export function workspaceLinks(
  group: DependencyGroup,
  lockfile: string = read('pnpm-lock.yaml')
): Map<string, WorkspaceLink[]> {
  const links = new Map<string, WorkspaceLink[]>();
  let importer: string | null = null;
  let inGroup = false;
  let isDev = false;

  for (const line of lockfile.split('\n')) {
    if (/^\S/.test(line)) {
      if (importer !== null) break;
      continue;
    }

    const found = IMPORTER.exec(line);
    if (found) {
      importer = found[1] as string;
      links.set(importer, []);
      continue;
    }
    if (importer === null) continue;

    const heading = GROUP.exec(line);
    if (heading) {
      isDev = heading[1] === 'devDependencies';
      inGroup = group === 'dev' ? true : !isDev;
    }

    const link = LINK.exec(line);
    if (link && inGroup) {
      links.get(importer)?.push({ path: normalize(`${importer}/${link[1]}`), dev: isDev });
    }
  }

  return links;
}

/** Every workspace package `entry` resolves, transitively, dev-edge build tooling aside. */
export function workspaceClosure(
  entry: string,
  group: DependencyGroup,
  lockfile?: string
): string[] {
  const links = workspaceLinks(group, lockfile);
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    for (const { path, dev } of links.get(queue.pop() as string) ?? []) {
      if (seen.has(path) || (dev && BUILD_TOOLING.includes(path))) continue;
      seen.add(path);
      queue.push(path);
    }
  }

  return [...seen].sort();
}
