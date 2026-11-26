import type { Pkg } from '../../workspace-packages';
import { platformClosure } from '../closure';

const pkg = (name: string, dir: string, deps: Pkg['deps'] = []): Pkg => ({
  name,
  dir,
  layer: 1,
  deps,
});

const PACKAGES: Pkg[] = [
  pkg('@kit/result', 'packages/platform/universal/result'),
  pkg('@kit/tsconfig', 'packages/platform/universal/tsconfig'),
  pkg('@kit/testing', 'packages/platform/server/testing', [
    { name: '@kit/result', dev: false },
    { name: '@kit/tsconfig', dev: true },
  ]),
  pkg('@kit/errors', 'packages/platform/universal/errors', [
    { name: '@kit/result', dev: false },
    { name: '@kit/testing', dev: true },
  ]),
  pkg('@kit/leaky', 'packages/platform/universal/leaky', [{ name: '@vp/domain', dev: true }]),
  pkg('@vp/domain', 'packages/universal/domain'),
];

const names = (roots: string[], edges: 'runtime' | 'all') => {
  const closure = platformClosure(roots, PACKAGES, edges);
  return closure.ok ? closure.packages.map((found) => found.name) : closure.problems;
};

describe('scripts: extractable platform closure', () => {
  it.each([
    { roots: ['@kit/errors'], edges: 'runtime' as const, expected: ['@kit/result', '@kit/errors'] },
    {
      roots: ['@kit/errors'],
      edges: 'all' as const,
      expected: ['@kit/result', '@kit/tsconfig', '@kit/testing', '@kit/errors'],
    },
    { roots: ['@kit/result', '@kit/result'], edges: 'all' as const, expected: ['@kit/result'] },
  ])(
    'follows $edges edges from $roots, once each, in workspace order',
    ({ roots, edges, expected }) => {
      expect(names(roots, edges)).toEqual(expected);
    }
  );

  it.each([
    {
      roots: ['@kit/leaky'],
      problem: '@kit/leaky depends on @vp/domain, which lives outside packages/platform',
    },
    {
      roots: ['@kit/ghost'],
      problem: 'the command line names @kit/ghost, which is no workspace package',
    },
  ])('refuses a closure that leaves the platform: $problem', ({ roots, problem }) => {
    expect(names(roots, 'all')).toEqual([problem]);
  });

  it('ignores a dev edge out of the platform when only the runtime closure is asked', () => {
    expect(names(['@kit/leaky'], 'runtime')).toEqual(['@kit/leaky']);
  });
});
