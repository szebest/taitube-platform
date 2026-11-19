import { posix } from 'node:path';
import { dependsOnAppPackage } from '../../scripts/check-boundaries';
import type { Pkg } from '../../scripts/workspace-packages';

const SEMVER = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;
const REQUIRED_FILES = ['README.md', 'AGENTS.md'];

export interface Manifest {
  name?: unknown;
  version?: unknown;
  type?: unknown;
  types?: unknown;
  exports?: unknown;
  sideEffects?: unknown;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PackageFiles {
  pkg: Pkg;
  manifest: Manifest;
  /** Paths inside the package, relative to its root. */
  files: ReadonlySet<string>;
  changelog: string | undefined;
  tsconfigs: Readonly<Record<string, unknown>>;
}

export interface Context {
  byName: ReadonlyMap<string, Pkg>;
  /** The package whose presets a platform tsconfig may extend: `@kit/tsconfig` until it moves, then its `@kit` successor. */
  preset: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function extendsOf(tsconfig: unknown): string[] {
  const extended = isRecord(tsconfig) ? tsconfig.extends : undefined;
  if (typeof extended === 'string') return [extended];
  return Array.isArray(extended) ? extended.filter((entry) => typeof entry === 'string') : [];
}

export function tsconfigPreset(
  moves: Readonly<Record<string, unknown>>,
  workspaceNames: ReadonlySet<string>
): string {
  const moved = moves['@kit/tsconfig'];
  return typeof moved === 'string' && workspaceNames.has(moved) ? moved : '@kit/tsconfig';
}

export function manifestProblems(
  { pkg, manifest, files, changelog, tsconfigs }: PackageFiles,
  context: Context
): string[] {
  const problems: string[] = [];
  const name = posix.basename(pkg.dir);
  const edges = Object.entries({
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
    devDependencies: manifest.devDependencies,
  });

  if (typeof manifest.name !== 'string' || manifest.name === '') problems.push('has no name');
  if (typeof manifest.version !== 'string' || !SEMVER.test(manifest.version)) {
    problems.push('has no semver version');
  }
  const presetsOnly =
    isRecord(manifest.exports) &&
    Object.keys(manifest.exports).length > 0 &&
    Object.keys(manifest.exports).every((subpath) => subpath.endsWith('.json'));

  if (!presetsOnly && (!isRecord(manifest.exports) || !isRecord(manifest.exports['.']))) {
    problems.push('has no exports map with a "." entry');
  }
  if (!presetsOnly && typeof manifest.types !== 'string') problems.push('has no types entry');
  if (manifest.sideEffects !== false) problems.push('is not sideEffects: false');
  if (manifest.type !== 'module') problems.push('is not ESM ("type": "module")');

  for (const file of presetsOnly ? REQUIRED_FILES : [...REQUIRED_FILES, `api/${name}.api.txt`]) {
    if (!files.has(file)) problems.push(`has no ${file}`);
  }
  if (changelog === undefined) {
    problems.push('has no CHANGELOG.md');
  } else if (typeof manifest.version === 'string' && SEMVER.test(manifest.version)) {
    const released = [...changelog.matchAll(/^##\s*\[?([^\]\s]+)/gm)].map(([, version]) => version);
    if (!released.includes(manifest.version)) {
      problems.push(`has a CHANGELOG.md with no entry for ${manifest.version}`);
    }
  }

  if (!presetsOnly && !Object.hasOwn(tsconfigs, 'tsconfig.json')) {
    problems.push('has no tsconfig.json');
  }
  for (const [file, tsconfig] of Object.entries(tsconfigs)) {
    for (const target of extendsOf(tsconfig)) {
      const inside = /^\.\/tsconfig[\w.-]*\.json$/.test(target);
      if (!(inside || target.startsWith(`${context.preset}/`))) {
        problems.push(
          `${file} extends ${target}, not a sibling tsconfig or a ${context.preset} preset`
        );
      }
    }
  }

  for (const dep of Object.keys(manifest.dependencies ?? {})) {
    if (!context.byName.has(dep))
      problems.push(`depends at runtime on ${dep}, which must be a peerDependency`);
  }
  for (const [group, deps] of edges) {
    for (const dep of Object.keys(deps ?? {})) {
      const target = context.byName.get(dep);
      if (target && dependsOnAppPackage(pkg, target)) {
        problems.push(`lists the app package ${dep} in ${group}`);
      }
    }
  }
  return problems.map((problem) => `${pkg.name} ${problem}`);
}
