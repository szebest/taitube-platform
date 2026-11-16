import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, matchesGlob } from 'node:path';
import {
  directoryTier,
  inPackageTier,
  load,
  packageDir,
  runsInBrowser,
  tierGlob,
  tierRoots,
} from '../workspace-packages';

function tree(manifests: Record<string, object>): string {
  const root = mkdtempSync(join(tmpdir(), 'workspace-packages-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const [dir, manifest] of Object.entries(manifests)) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest));
  }
  return root;
}

describe('scripts: workspace packages', () => {
  it('loads the manifests of both axes and apps, with their workspace edges', () => {
    const root = tree({
      'packages/server/db': { name: '@vp/db', vp: { layer: 2 } },
      'packages/platform/server/logger': { name: '@kit/logger', vp: { layer: 1 } },
      'apps/server/api': {
        name: '@vp/api',
        vp: { layer: 6 },
        dependencies: { '@vp/db': 'workspace:*', zod: '^4.0.0' },
        devDependencies: { '@kit/logger': 'workspace:*', '@vp/db': 'workspace:*' },
      },
    });

    expect(load(root).sort((a, b) => a.dir.localeCompare(b.dir))).toEqual([
      {
        name: '@vp/api',
        dir: 'apps/server/api',
        declaredTier: undefined,
        layer: 6,
        deps: [
          { name: '@vp/db', dev: false },
          { name: '@kit/logger', dev: true },
        ],
      },
      {
        name: '@kit/logger',
        dir: 'packages/platform/server/logger',
        declaredTier: undefined,
        layer: 1,
        deps: [],
      },
      { name: '@vp/db', dir: 'packages/server/db', declaredTier: undefined, layer: 2, deps: [] },
    ]);
  });

  it.each([
    { path: 'packages/client/ui', tier: 'client' },
    { path: 'packages/platform/client/ui/src/index.ts', tier: 'client' },
    { path: 'apps/server/api', tier: 'server' },
    { path: 'apps/universal/x', tier: null },
    { path: 'packages/server', tier: null },
    { path: 'tools/chaos/run.sh', tier: null },
  ])('reads the tier of $path as $tier', ({ path, tier }) => {
    expect(directoryTier(path)).toBe(tier);
  });

  it.each([
    { path: 'packages/server/db/src/client.ts', inTier: true },
    { path: 'packages/platform/server/logger/src/index.ts', inTier: true },
    { path: 'apps/server/api/src/main.ts', inTier: false },
    { path: 'packages/universal/result/src/index.ts', inTier: false },
  ])('counts $path as a server package: $inTier', ({ path, inTier }) => {
    expect(inPackageTier(path, 'server')).toBe(inTier);
  });

  it.each([
    { path: 'apps/client/web/src/main.tsx', browser: true },
    { path: 'packages/platform/client/ui/src/index.ts', browser: true },
    { path: 'packages/universal/domain/src/index.ts', browser: true },
    { path: 'packages/server/db/src/client.ts', browser: false },
    { path: 'apps/server/api/src/main.ts', browser: false },
    { path: 'scripts/gen-tokens.ts', browser: false },
  ])('counts $path as reachable from a browser: $browser', ({ path, browser }) => {
    expect(runsInBrowser(path)).toBe(browser);
  });

  it('names both directories a tier lives in, and one glob that matches either', () => {
    expect(tierRoots('client')).toEqual(['packages/client', 'packages/platform/client']);
    expect(
      tierRoots('client').map((root) => matchesGlob(`${root}/ui`, `${tierGlob('client')}/*`))
    ).toEqual([true, true]);
    expect(matchesGlob('packages/server/ui', `${tierGlob('client')}/*`)).toBe(false);
  });

  it('finds a package directory by name, on either axis', () => {
    const root = tree({
      'packages/platform/client/ui': { name: '@vp/ui' },
      'packages/client/queries': { name: '@vp/queries' },
    });

    expect(packageDir('@vp/ui', load(root))).toBe('packages/platform/client/ui');
    expect(packageDir('@vp/queries', load(root))).toBe('packages/client/queries');
    expect(() => packageDir('@vp/missing', load(root))).toThrow(
      '@vp/missing: no workspace package by that name'
    );
  });

  it('finds the real workspace by default', () => {
    expect(packageDir('@vp/db')).toBe('packages/server/db');
  });
});
