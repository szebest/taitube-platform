import { posix } from 'node:path';
import { type Pkg, checkBoundaries, load } from '../../scripts/check-boundaries';
import { trackedFiles } from './repo-files';

function pkg(overrides: Partial<Pkg> & { name: string }): Pkg {
  return {
    dir: `packages/server/${overrides.name.replace('@vp/', '')}`,
    layer: 2,
    deps: [],
    ...overrides,
  };
}

const TOOLING = pkg({ name: '@vp/testing', layer: 1 });

describe('architecture: package boundaries', () => {
  it('loads every tracked app and package manifest', () => {
    const manifests = trackedFiles(
      ':(glob)apps/*/*/package.json',
      ':(glob)packages/*/*/package.json'
    );

    expect(load().map((p) => p.dir).sort()).toEqual(manifests.map(posix.dirname).sort());
  });

  it('every package takes its tier from its directory and a layer its dependencies respect', () => {
    expect(checkBoundaries()).toEqual([]);
  });

  it.each([
    { dir: 'packages/client/browser', group: 'a dependency', dev: false, how: 'depends on' },
    { dir: 'packages/client/browser', group: 'a devDependency', dev: true, how: 'dev-depends on' },
    { dir: 'apps/client/browser', group: 'a dependency', dev: false, how: 'depends on' },
    { dir: 'apps/client/browser', group: 'a devDependency', dev: true, how: 'dev-depends on' },
  ])('reports a sibling-tier crossing from $dir declared as $group', ({ dir, dev, how }) => {
    const errors = checkBoundaries([
      pkg({ name: '@vp/browser', dir, layer: 3, deps: [{ name: '@vp/node', dev }] }),
      pkg({ name: '@vp/node', layer: 1 }),
    ]);

    expect(errors).toEqual([
      `@vp/browser (client) ${how} @vp/node (server) — a client package or app may only depend on universal or client`,
    ]);
  });

  it.each([
    'apps/web',
    'apps/universal/web',
    'packages/web',
  ])('reports a manifest at %s, outside a tier directory', (dir) => {
    expect(checkBoundaries([pkg({ name: '@vp/web', dir })])).toEqual([
      '@vp/web: lives outside packages/<tier>/ and apps/<server|client>/, so it has no tier',
    ]);
  });

  it.each([
    { dir: 'packages/server/node', parent: 'packages/server' },
    { dir: 'apps/server/api', parent: 'apps/server' },
  ])('reports a vp.tier declared in $dir', ({ dir, parent }) => {
    expect(checkBoundaries([pkg({ name: '@vp/node', dir, declaredTier: 'client' })])).toEqual([
      `@vp/node: declares vp.tier "client", but its directory ${parent}/ is the tier. Remove the field.`,
    ]);
  });

  it.each([
    { group: 'a dependency', dev: false, how: 'depends on' },
    { group: 'a devDependency', dev: true, how: 'dev-depends on' },
  ])('reports an upward layer edge declared as $group', ({ dev, how }) => {
    const errors = checkBoundaries([
      pkg({ name: '@vp/lower', layer: 2, deps: [{ name: '@vp/higher', dev }] }),
      pkg({ name: '@vp/higher', layer: 4 }),
    ]);

    expect(errors).toEqual([
      `@vp/lower (T2) ${how} @vp/higher (T4) — a higher layer. Dependencies must point strictly down.`,
    ]);
  });

  it('lets any package name the build tooling without tripping either rule', () => {
    const errors = checkBoundaries([
      pkg({
        name: '@vp/browser',
        dir: 'packages/client/browser',
        layer: 1,
        deps: [{ name: '@vp/testing', dev: true }],
      }),
      TOOLING,
    ]);

    expect(errors).toEqual([]);
  });
});
