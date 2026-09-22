import { normalize } from 'node:path';
import { read } from './repo-files';

const IMPORTER = /^ {2}(\S+):$/;
const GROUP = / {4}(dependencies|optionalDependencies|devDependencies):$/;
const LINK = /^ {8}version: link:(\S+)$/;

/**
 * Mirrors `BUILD_TOOLING` in `scripts/check-boundaries.ts`: neither ships code, so a
 * devDependency on them is not a path into anyone's bundle.
 */
export const BUILD_TOOLING = ['packages/server/testing', 'packages/universal/tsconfig'];

export type DependencyGroup = 'runtime' | 'dev';

export function workspaceLinks(group: DependencyGroup): Map<string, string[]> {
  const links = new Map<string, string[]>();
  let importer: string | null = null;
  let inGroup = false;

  for (const line of read('pnpm-lock.yaml').split('\n')) {
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
      const isDev = heading[1] === 'devDependencies';
      inGroup = group === 'dev' ? true : !isDev;
    }

    const link = LINK.exec(line);
    if (link && inGroup) {
      links.get(importer)?.push(normalize(`${importer}/${link[1]}`));
    }
  }

  return links;
}

/** Every workspace package `entry` resolves, transitively, build tooling aside. */
export function workspaceClosure(entry: string, group: DependencyGroup): string[] {
  const links = workspaceLinks(group);
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    for (const dep of links.get(queue.pop() as string) ?? []) {
      if (seen.has(dep) || BUILD_TOOLING.includes(dep)) continue;
      seen.add(dep);
      queue.push(dep);
    }
  }

  return [...seen].sort();
}
