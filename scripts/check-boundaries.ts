import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createLogger } from '../packages/server/logger/src/index';

type Tier = 'universal' | 'server' | 'client';

export interface PkgDep {
  name: string;
  dev: boolean;
}

export interface Pkg {
  name: string;
  dir: string;
  tier: Tier;
  declaredTier?: Tier;
  layer: number;
  deps: PkgDep[];
}

const ROOT = resolve(import.meta.dirname, '..');
const TIER_MAY_IMPORT: Record<Tier, Tier[]> = {
  universal: ['universal'],
  server: ['universal', 'server'],
  client: ['universal', 'client'],
};

/**
 * The only two packages a manifest may name as a devDependency regardless of tier and layer:
 * neither ships code, so neither can reach a runtime bundle or a `pnpm deploy --prod` tree.
 * `@vp/tsconfig` is a set of JSON presets and `@vp/testing` is a vitest config factory plus
 * fixtures. Every other devDependency is a real edge — it resolves in CI and it lands in the
 * emitted `.d.ts` — so it is checked exactly like a dependency.
 */
const BUILD_TOOLING = new Set(['@vp/tsconfig', '@vp/testing']);

function manifestDirs(): string[] {
  const dirs: string[] = [];
  for (const tier of readdirSync(join(ROOT, 'packages'))) {
    const tierDir = join(ROOT, 'packages', tier);
    if (!statSync(tierDir).isDirectory()) continue;
    for (const name of readdirSync(tierDir)) dirs.push(join(tierDir, name));
  }
  for (const name of readdirSync(join(ROOT, 'apps'))) dirs.push(join(ROOT, 'apps', name));
  return dirs.filter(
    (d) => statSync(join(d, 'package.json'), { throwIfNoEntry: false })?.isFile() ?? false
  );
}

function load(): Pkg[] {
  return manifestDirs().map((dir) => {
    const raw = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const vp = raw.vp ?? {};
    return {
      name: raw.name,
      dir: dir.slice(ROOT.length + 1),
      tier: directoryTier(dir.slice(ROOT.length + 1)) ?? vp.tier,
      declaredTier: vp.tier,
      layer: vp.layer,
      deps: declaredDeps(raw),
    };
  });
}

function declaredDeps(raw: {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): PkgDep[] {
  const runtime = [
    ...Object.keys(raw.dependencies ?? {}),
    ...Object.keys(raw.peerDependencies ?? {}),
  ].filter((d) => d.startsWith('@vp/'));
  const dev = Object.keys(raw.devDependencies ?? {}).filter(
    (d) => d.startsWith('@vp/') && !runtime.includes(d)
  );

  return [
    ...runtime.map((name) => ({ name, dev: false })),
    ...dev.map((name) => ({ name, dev: true })),
  ];
}

function directoryTier(dir: string): Tier | null {
  const m = /^packages\/(universal|server|client)\//.exec(dir);
  return m ? (m[1] as Tier) : null;
}

export function checkBoundaries(packages: Pkg[] = load()): string[] {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const errors: string[] = [];

  for (const pkg of packages) {
    if (!TIER_MAY_IMPORT[pkg.tier]) {
      errors.push(`${pkg.name}: missing or unknown vp.tier`);
      continue;
    }
    if (typeof pkg.layer !== 'number') {
      errors.push(`${pkg.name}: missing vp.layer`);
      continue;
    }

    const onDisk = directoryTier(pkg.dir);
    if (onDisk && pkg.declaredTier) {
      errors.push(
        `${pkg.name}: declares vp.tier "${pkg.declaredTier}", but its directory packages/${onDisk}/ is the tier. Remove the field.`
      );
    }
    if (!onDisk && !pkg.declaredTier) {
      errors.push(`${pkg.name}: lives outside packages/<tier>/ and must declare vp.tier`);
    }

    for (const { name: depName, dev } of pkg.deps) {
      if (dev && BUILD_TOOLING.has(depName)) continue;
      const dep = byName.get(depName);
      if (!dep) continue;
      const how = dev ? 'dev-depends on' : 'depends on';

      if (!TIER_MAY_IMPORT[pkg.tier].includes(dep.tier)) {
        errors.push(
          `${pkg.name} (${pkg.tier}) ${how} ${dep.name} (${dep.tier}) — a ${pkg.tier} package may only depend on ${TIER_MAY_IMPORT[pkg.tier].join(' or ')}`
        );
      }

      if (dep.layer >= pkg.layer) {
        const direction = dep.layer === pkg.layer ? 'the same layer' : 'a higher layer';
        errors.push(
          `${pkg.name} (T${pkg.layer}) ${how} ${dep.name} (T${dep.layer}) — ${direction}. Dependencies must point strictly down.`
        );
      }
    }
  }

  return errors;
}

export function packageCount(): number {
  return load().length;
}

if (process.argv[1]?.endsWith('check-boundaries.ts')) {
  const log = createLogger({ service: 'check-boundaries', level: 'info', format: 'pretty' });
  const errors = checkBoundaries();
  if (errors.length > 0) {
    for (const violation of errors) {
      log.error({ violation }, 'package boundary violation');
    }
    log.error(
      { violations: errors.length, see: 'ARCHITECTURE.md' },
      'package runtime tiers and dependency layers are inconsistent'
    );
    process.exit(1);
  }
  log.info({ packages: packageCount() }, 'package boundaries ok, tiers and layers consistent');
}
