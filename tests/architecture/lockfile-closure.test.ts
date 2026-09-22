import { normalize } from 'node:path';
import { read } from './repo-files';

const IMPORTER = /^ {2}(\S+):$/;
const GROUP = / {4}(dependencies|optionalDependencies|devDependencies):$/;
const LINK = /^ {8}version: link:(\S+)$/;
const SERVER_TIER = 'packages/server/';

/**
 * Mirrors `BUILD_TOOLING` in `scripts/check-boundaries.ts`: neither ships code, so a
 * devDependency on them is not a path into the frontend bundle.
 */
const BUILD_TOOLING = ['packages/server/testing', 'packages/universal/tsconfig'];

type Group = 'runtime' | 'dev';

function workspaceLinks(group: Group): Map<string, string[]> {
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

function closure(entry: string, group: Group): string[] {
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

describe('architecture: resolved workspace closures', () => {
  it('still reads the workspace links the lockfile records', () => {
    expect(closure('apps/web', 'runtime')).toContain('packages/universal/api-contracts');
    expect(closure('apps/api', 'runtime')).toContain('packages/server/adapters');
  });

  it('keeps every server-tier package out of the frontend closure', () => {
    const server = closure('apps/web', 'runtime').filter((dep) => dep.startsWith(SERVER_TIER));

    expect(server).toEqual([]);
  });

  it('keeps them out once devDependencies count too, build tooling aside', () => {
    const server = closure('apps/web', 'dev').filter((dep) => dep.startsWith(SERVER_TIER));

    expect(server).toEqual([]);
  });

  it('exempts nothing but the two packages that ship no code', () => {
    expect(closure('packages/universal/domain', 'dev')).toEqual([]);
  });
});
