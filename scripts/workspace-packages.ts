import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';

export type Tier = 'universal' | 'server' | 'client';

interface PkgDep {
  name: string;
  dev: boolean;
}

export interface PathDep {
  name: string;
  spec: string;
  target: string;
}

export interface Pkg {
  name: string;
  dir: string;
  declaredTier?: Tier;
  layer: number;
  deps: PkgDep[];
  pathDeps?: PathDep[];
}

const ROOT = resolve(import.meta.dirname, '..');
const TIER_DIRECTORIES: Record<string, Tier[]> = {
  packages: ['universal', 'server', 'client'],
  apps: ['server', 'client'],
};
const PLATFORM = 'packages/platform/';

const subdirectories = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => join(dir, name));

function manifestDirs(root: string): string[] {
  return ['packages', PLATFORM, 'apps']
    .map((parent) => join(root, parent))
    .filter((parent) => existsSync(parent))
    .flatMap((parent) => subdirectories(parent))
    .flatMap((tierDir) => [tierDir, ...subdirectories(tierDir)])
    .filter((dir) => existsSync(join(dir, 'package.json')));
}

const workspaceNames = (deps: Record<string, string> = {}) =>
  Object.entries(deps)
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name);

function workspaceDeps(raw: {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): PkgDep[] {
  const runtime = [...workspaceNames(raw.dependencies), ...workspaceNames(raw.peerDependencies)];
  const dev = workspaceNames(raw.devDependencies).filter((d) => !runtime.includes(d));

  return [
    ...runtime.map((name) => ({ name, dev: false })),
    ...dev.map((name) => ({ name, dev: true })),
  ];
}

const PATH_SPEC = /^(?:link:|file:|workspace:(?=[./~]))/;

function pathDeps(
  dir: string,
  raw: Record<
    'dependencies' | 'peerDependencies' | 'devDependencies',
    Record<string, string> | undefined
  >
): PathDep[] {
  return Object.values(raw).flatMap((deps = {}) =>
    Object.entries(deps)
      .filter(([, spec]) => PATH_SPEC.test(spec))
      .map(([name, spec]) => ({
        name,
        spec,
        target: posix.normalize(posix.join(dir, spec.replace(/^[a-z]+:/, ''))),
      }))
  );
}

export function load(root: string = ROOT): Pkg[] {
  return manifestDirs(root).map((dir) => {
    const raw = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const vp = raw.vp ?? {};
    return {
      name: raw.name,
      dir: dir.slice(root.length + 1),
      declaredTier: vp.tier,
      layer: vp.layer,
      deps: workspaceDeps(raw),
      pathDeps: pathDeps(dir.slice(root.length + 1), raw),
    };
  });
}

export const isPlatform = (dir: string): boolean => dir.startsWith(PLATFORM);

export function directoryTier(path: string): Tier | null {
  const unprefixed = isPlatform(path) ? `packages/${path.slice(PLATFORM.length)}` : path;
  const [parent, tier, name] = unprefixed.split('/');
  if (!(parent && name)) return null;
  return TIER_DIRECTORIES[parent]?.find((t) => t === tier) ?? null;
}

export const tierRoots = (tier: Tier): string[] => [`packages/${tier}`, `${PLATFORM}${tier}`];

export const tierGlob = (tier: Tier): string => `packages/{,platform/}${tier}`;

export const inPackageTier = (path: string, tier: Tier): boolean =>
  path.startsWith('packages/') && directoryTier(path) === tier;

export const runsInBrowser = (path: string): boolean => {
  const tier = directoryTier(path);
  return tier === 'client' || tier === 'universal';
};

export function packageDir(name: string, packages: Pkg[] = load()): string {
  const found = packages.find((p) => p.name === name);
  if (!found) throw new Error(`${name}: no workspace package by that name`);
  return found.dir;
}
