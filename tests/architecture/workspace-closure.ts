import { normalize } from 'node:path';
import { loadAll } from 'js-yaml';
import { BUILD_TOOLING, load } from '../../scripts/check-boundaries';
import { read } from './repo-files';

/**
 * The directories of `BUILD_TOOLING`, exempt only on a dev edge, as `check-boundaries.ts` exempts
 * them: a *runtime* dependency on any of them would ship, so it stays in the closure and the tier
 * assertions get to see it.
 */
function buildToolingDirs(): ReadonlySet<string> {
  return new Set(load().flatMap((pkg) => (BUILD_TOOLING.has(pkg.name) ? [pkg.dir] : [])));
}

const RUNTIME_GROUPS = ['dependencies', 'optionalDependencies'] as const;
const DEV_GROUPS = [...RUNTIME_GROUPS, 'devDependencies'] as const;

type Importer = Partial<Record<(typeof DEV_GROUPS)[number], Record<string, { version: string }>>>;

interface LockfileDocument {
  importers?: Record<string, Importer>;
}

export type DependencyGroup = 'runtime' | 'dev';

export interface WorkspaceLink {
  path: string;
  dev: boolean;
}

function importerLinks(path: string, importer: Importer, group: DependencyGroup): WorkspaceLink[] {
  const groups = group === 'dev' ? DEV_GROUPS : RUNTIME_GROUPS;

  return groups.flatMap((name) =>
    Object.values(importer[name] ?? {})
      .filter(({ version }) => version.startsWith('link:'))
      .map(({ version }) => ({
        path: normalize(`${path}/${version.slice('link:'.length)}`),
        dev: name === 'devDependencies',
      }))
  );
}

export function workspaceLinks(
  group: DependencyGroup,
  lockfile: string = read('pnpm-lock.yaml')
): Map<string, WorkspaceLink[]> {
  const links = new Map<string, WorkspaceLink[]>();

  for (const document of loadAll(lockfile) as LockfileDocument[]) {
    for (const [path, importer] of Object.entries(document.importers ?? {})) {
      links.set(path, [...(links.get(path) ?? []), ...importerLinks(path, importer, group)]);
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
  const tooling = buildToolingDirs();
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    for (const { path, dev } of links.get(queue.pop() as string) ?? []) {
      if (seen.has(path) || (dev && tooling.has(path))) continue;
      seen.add(path);
      queue.push(path);
    }
  }

  return [...seen].sort();
}
