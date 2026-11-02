import { timingsFrom } from '../timings-update';

describe('timingsFrom', () => {
  it('sums a file two projects ran, over every shard, sorted by path', () => {
    const timings = timingsFrom([
      [['packages/universal/intl/src/__tests__/b.test.ts', 120]],
      [
        ['apps/client/web/src/__tests__/a.test.tsx', 50],
        ['packages/universal/intl/src/__tests__/b.test.ts', 80],
      ],
    ]);

    expect(Object.entries(timings)).toEqual([
      ['apps/client/web/src/__tests__/a.test.tsx', 50],
      ['packages/universal/intl/src/__tests__/b.test.ts', 200],
    ]);
  });
});
