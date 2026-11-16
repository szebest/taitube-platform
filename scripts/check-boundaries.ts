import { dirname } from 'node:path';
import { createLogger } from '../packages/server/logger/src/index';
import { directoryTier, isPlatform, load, type Pkg, type Tier } from './workspace-packages';

const TIER_MAY_IMPORT: Record<Tier, Tier[]> = {
  universal: ['universal'],
  server: ['universal', 'server'],
  client: ['universal', 'client'],
};

/**
 * The only packages a manifest may name as a devDependency regardless of tier and layer: none
 * ships code, so none can reach a runtime bundle or a `pnpm deploy --prod` tree. `@vp/tsconfig`
 * is a set of JSON presets, `@vp/testing` a vitest config factory plus fixtures,
 * `@vp/vite-preset` the Vite config a client app builds with, and `@vp/web-testing` the spec
 * helpers of the browser packages and apps, which only specs import. Every other devDependency is a
 * real edge — it resolves in CI and it lands in the emitted `.d.ts` — so it is checked exactly
 * like a dependency, and a runtime dependency on one of these is checked too.
 */
export const BUILD_TOOLING: ReadonlySet<string> = new Set([
  '@vp/tsconfig',
  '@vp/testing',
  '@vp/vite-preset',
  '@vp/web-testing',
]);

export function checkBoundaries(packages: Pkg[] = load()): string[] {
  const byName = new Map(packages.map((p) => [p.name, p]));
  const errors: string[] = [];

  for (const pkg of packages) {
    const tier = directoryTier(pkg.dir);
    if (!tier) {
      errors.push(
        `${pkg.name}: lives outside packages/<tier>/, packages/platform/<tier>/ and apps/<server|client>/, so it has no tier`
      );
      continue;
    }
    if (pkg.declaredTier) {
      errors.push(
        `${pkg.name}: declares vp.tier "${pkg.declaredTier}", but its directory ${dirname(pkg.dir)}/ is the tier. Remove the field.`
      );
    }
    if (typeof pkg.layer !== 'number') {
      errors.push(`${pkg.name}: missing vp.layer`);
      continue;
    }

    for (const { name: depName, dev } of pkg.deps) {
      const dep = byName.get(depName);
      if (!dep) continue;
      const how = dev ? 'dev-depends on' : 'depends on';

      if (isPlatform(pkg.dir) && !isPlatform(dep.dir)) {
        errors.push(
          `${pkg.name} (platform) ${how} ${dep.name} (app) — a platform package depends, peer-depends and dev-depends only on platform packages`
        );
      }
      if (dev && BUILD_TOOLING.has(depName)) continue;

      const depTier = directoryTier(dep.dir);
      if (depTier && !TIER_MAY_IMPORT[tier].includes(depTier)) {
        errors.push(
          `${pkg.name} (${tier}) ${how} ${dep.name} (${depTier}) — a ${tier} package or app may only depend on ${TIER_MAY_IMPORT[tier].join(' or ')}`
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

if (process.argv[1]?.endsWith('check-boundaries.ts')) {
  const log = createLogger({ service: 'check-boundaries', level: 'info', format: 'pretty' });
  const packages = load();
  const errors = checkBoundaries(packages);
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
  log.info({ packages: packages.length }, 'package boundaries ok, tiers and layers consistent');
}
