import type { Pkg } from '../../workspace-packages';
import { planDirMoves, planScopeRenames } from '../dir-moves';
import type { Moves } from '../moves';

const pkg = (name: string, dir: string): Pkg => ({ name, dir, layer: 1, deps: [] });

const PACKAGES = [
  pkg('@vp/result', 'packages/universal/result'),
  pkg('@vp/ui', 'packages/client/ui'),
  pkg('@vp/errors', 'packages/universal/errors'),
  pkg('@vp/web', 'apps/client/web'),
  pkg('@vp/done', 'packages/platform/server/done'),
];
const MOVES: Moves = {
  '@vp/result': '@kit/result',
  '@vp/ui': '@kit/ui',
  '@vp/errors': { '.': { Failure: '@kit/errors' } },
  '@vp/done': '@kit/done',
  '@vp/web': '@vp/web',
};

describe('scripts: planDirMoves', () => {
  it('plans only whole moves of packages not yet under platform', () => {
    expect(planDirMoves(PACKAGES, MOVES)).toEqual({
      'packages/universal/result': 'packages/platform/universal/result',
      'packages/client/ui': 'packages/platform/client/ui',
    });
  });

  it('skips an excluded package', () => {
    expect(Object.keys(planDirMoves(PACKAGES, MOVES, new Set(['@vp/ui'])))).toEqual([
      'packages/universal/result',
    ]);
  });

  it('plans scope renames for the selected whole moves only', () => {
    expect(planScopeRenames(MOVES, new Set(['@vp/result', '@vp/errors', '@vp/web']))).toEqual({
      '@vp/result': '@kit/result',
    });
  });
});
