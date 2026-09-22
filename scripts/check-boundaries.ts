import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Tier = 'universal' | 'server' | 'client';

interface Pkg {
  name: string;
  dir: string;
  tier: Tier;
  declaredTier?: Tier;
  layer: number;
  deps: string[];
}

const ROOT = resolve(import.meta.dirname, '..');
const TIER_MAY_IMPORT: Record<Tier, Tier[]> = {
  universal: ['universal'],
  server: ['universal', 'server'],
  client: ['universal', 'client'],
};

function manifestDirs(): string[] {
  const dirs: string[] = [];
  for (const tier of readdirSync(join(ROOT, 'packages'))) {
    const tierDir = join(ROOT, 'packages', tier);
    if (!statSync(tierDir).isDirectory()) continue;
    for (const name of readdirSync(tierDir)) dirs.push(join(tierDir, name));
  }
  for (const name of readdirSync(join(ROOT, 'apps'))) dirs.push(join(ROOT, 'apps', name));
  return dirs.filter((d) => {
    try {
      return statSync(join(d, 'package.json')).isFile();
    } catch {
      return false;
    }
  });
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
      deps: [
        ...Object.keys(raw.dependencies ?? {}),
        ...Object.keys(raw.peerDependencies ?? {}),
      ].filter((d) => d.startsWith('@vp/')),
    };
  });
}

function directoryTier(dir: string): Tier | null {
  const m = /^packages\/(universal|server|client)\//.exec(dir);
  return m ? (m[1] as Tier) : null;
}

export function checkBoundaries(): string[] {
  const packages = load();
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

    for (const depName of pkg.deps) {
      const dep = byName.get(depName);
      if (!dep) continue;

      if (!TIER_MAY_IMPORT[pkg.tier].includes(dep.tier)) {
        errors.push(
          `${pkg.name} (${pkg.tier}) depends on ${dep.name} (${dep.tier}) — a ${pkg.tier} package may only depend on ${TIER_MAY_IMPORT[pkg.tier].join(' or ')}`
        );
      }

      if (dep.layer >= pkg.layer) {
        const how = dep.layer === pkg.layer ? 'the same layer' : 'a higher layer';
        errors.push(
          `${pkg.name} (T${pkg.layer}) depends on ${dep.name} (T${dep.layer}) — ${how}. Dependencies must point strictly down.`
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
  const errors = checkBoundaries();
  if (errors.length > 0) {
    console.error(`\nPackage boundary violations (${errors.length}):\n`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error('\nSee ARCHITECTURE.md — package runtime tiers and dependency layers.\n');
    process.exit(1);
  }
  console.log(`Package boundaries OK — ${packageCount()} packages, tiers and layers consistent.`);
}
