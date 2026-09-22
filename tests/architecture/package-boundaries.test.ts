import { type Pkg, checkBoundaries } from '../../scripts/check-boundaries';

function pkg(overrides: Partial<Pkg> & { name: string }): Pkg {
  return {
    dir: `packages/server/${overrides.name.replace('@vp/', '')}`,
    tier: 'server',
    layer: 2,
    deps: [],
    ...overrides,
  };
}

const TOOLING = pkg({
  name: '@vp/testing',
  dir: 'packages/server/testing',
  tier: 'server',
  layer: 1,
});

describe('architecture: package boundaries', () => {
  it('every package declares a tier and a layer that its dependencies respect', () => {
    expect(checkBoundaries()).toEqual([]);
  });

  it.each([
    { group: 'a dependency', dev: false, how: 'depends on' },
    { group: 'a devDependency', dev: true, how: 'dev-depends on' },
  ])('reports a sibling-tier crossing declared as $group', ({ dev, how }) => {
    const errors = checkBoundaries([
      pkg({
        name: '@vp/browser',
        dir: 'packages/client/browser',
        tier: 'client',
        layer: 3,
        deps: [{ name: '@vp/node', dev }],
      }),
      pkg({ name: '@vp/node', layer: 1 }),
    ]);

    expect(errors).toEqual([
      `@vp/browser (client) ${how} @vp/node (server) — a client package may only depend on universal or client`,
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
        tier: 'client',
        layer: 1,
        deps: [{ name: '@vp/testing', dev: true }],
      }),
      TOOLING,
    ]);

    expect(errors).toEqual([]);
  });
});
