import { posix } from 'node:path';
import {
  BUILD_TOOLING,
  checkBoundaries,
  pendingPlatformMoves,
} from '../../scripts/check-boundaries';
import { load, type Pkg } from '../../scripts/workspace-packages';
import { trackedFiles } from './repo-files';

function pkg(overrides: Partial<Pkg> & { name: string }): Pkg {
  return {
    dir: `packages/server/${overrides.name.replace('@vp/', '')}`,
    layer: 2,
    deps: [],
    ...overrides,
  };
}

describe('architecture: package boundaries', () => {
  it('loads every tracked app and package manifest', () => {
    const manifests = trackedFiles(
      ':(glob)apps/*/*/package.json',
      ':(glob)packages/*/*/package.json',
      ':(glob)packages/platform/*/*/package.json'
    );

    expect(
      load()
        .map((p) => p.dir)
        .sort()
    ).toEqual(manifests.map(posix.dirname).sort());
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

  it.each(['apps/web', 'apps/universal/web', 'packages/web', 'packages/platform/web'])(
    'reports a manifest at %s, outside a tier directory',
    (dir) => {
      expect(checkBoundaries([pkg({ name: '@vp/web', dir })])).toEqual([
        '@vp/web: lives outside packages/<tier>/, packages/platform/<tier>/ and apps/<server|client>/, so it has no tier',
      ]);
    }
  );

  const PENDING = new Set(['@vp/moving']);

  function platformEdge(dep: string, dev: boolean): string[] {
    return checkBoundaries(
      [
        pkg({ name: '@kit/di', dir: 'packages/platform/universal/di', deps: [{ name: dep, dev }] }),
        pkg({ name: dep, dir: `packages/universal/${dep.slice(4)}`, layer: 1 }),
      ],
      PENDING
    );
  }

  it.each([
    { group: 'a dependency', dev: false, how: 'depends on', dep: '@vp/domain' },
    { group: 'a devDependency', dev: true, how: 'dev-depends on', dep: '@vp/domain' },
    { group: 'build tooling', dev: true, how: 'dev-depends on', dep: '@vp/lint-config' },
  ])('reports a platform package that names an app package as $group', ({ dev, how, dep }) => {
    expect(platformEdge(dep, dev)).toEqual([
      `@kit/di (platform) ${how} ${dep} (app) — a platform package depends, peer-depends and dev-depends only on platform packages`,
    ]);
  });

  it('lets a platform package depend on an app package whose move to @kit/* is pending', () => {
    expect(platformEdge('@vp/moving', false)).toEqual([]);
  });

  it('counts a package as pending when package-moves.json sends it, or any export of it, to @kit/*', () => {
    expect(
      pendingPlatformMoves({
        '@vp/whole': '@kit/whole',
        '@vp/split': { '.': { kept: '@vp/split', moved: '@kit/split' } },
        '@vp/entry': { '.': '@vp/entry', './sub': '@kit/sub' },
        '@vp/stays': { '.': { a: '@vp/stays', b: '@vp/other' } },
      })
    ).toEqual(new Set(['@vp/whole', '@vp/split', '@vp/entry']));
  });

  it('reads the tier of a platform package from its path, and lets an app depend on one', () => {
    const errors = checkBoundaries([
      pkg({
        name: '@vp/web',
        dir: 'apps/client/web',
        layer: 6,
        deps: [{ name: '@kit/ui', dev: false }],
      }),
      pkg({
        name: '@kit/ui',
        dir: 'packages/platform/client/ui',
        layer: 3,
        deps: [{ name: '@kit/logger', dev: false }],
      }),
      pkg({ name: '@kit/logger', dir: 'packages/platform/server/logger', layer: 1 }),
    ]);

    expect(errors).toEqual([
      '@kit/ui (client) depends on @kit/logger (server) — a client package or app may only depend on universal or client',
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

  it.each([...BUILD_TOOLING])(
    'lets any package dev-depend on %s without tripping either rule',
    (name) => {
      const errors = checkBoundaries([
        pkg({
          name: '@vp/browser',
          dir: 'packages/client/browser',
          layer: 1,
          deps: [{ name, dev: true }],
        }),
        pkg({ name, layer: 1 }),
      ]);

      expect(errors).toEqual([]);
    }
  );

  it.each([...BUILD_TOOLING])('still checks a runtime dependency on %s', (name) => {
    const errors = checkBoundaries([
      pkg({
        name: '@vp/browser',
        dir: 'packages/client/browser',
        layer: 1,
        deps: [{ name, dev: false }],
      }),
      pkg({ name, layer: 1 }),
    ]);

    expect(errors).toEqual([
      `@vp/browser (client) depends on ${name} (server) — a client package or app may only depend on universal or client`,
      `@vp/browser (T1) depends on ${name} (T1) — the same layer. Dependencies must point strictly down.`,
    ]);
  });
});
