import { normalize } from 'node:path';
import { read } from './repo-files';

const IMPORTER = /^ {2}(\S+):$/;
const GROUP = / {4}(dependencies|optionalDependencies|devDependencies):$/;
const LINK = /^ {8}version: link:(\S+)$/;
const SERVER_TIER = 'packages/server/';

function runtimeLinks(): Map<string, string[]> {
  const links = new Map<string, string[]>();
  let importer: string | null = null;
  let runtime = false;

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

    const group = GROUP.exec(line);
    if (group) runtime = group[1] !== 'devDependencies';

    const link = LINK.exec(line);
    if (link && runtime) {
      links.get(importer)?.push(normalize(`${importer}/${link[1]}`));
    }
  }

  return links;
}

function runtimeClosure(entry: string): string[] {
  const links = runtimeLinks();
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    for (const dep of links.get(queue.pop() as string) ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      queue.push(dep);
    }
  }

  return [...seen].sort();
}

describe('architecture: resolved workspace closures', () => {
  it('still reads the workspace links the lockfile records', () => {
    expect(runtimeClosure('apps/web')).toContain('packages/universal/api-contracts');
    expect(runtimeClosure('apps/api')).toContain('packages/server/adapters');
  });

  it('keeps every server-tier package out of the frontend closure', () => {
    const server = runtimeClosure('apps/web').filter((dep) => dep.startsWith(SERVER_TIER));

    expect(server).toEqual([]);
  });
});
