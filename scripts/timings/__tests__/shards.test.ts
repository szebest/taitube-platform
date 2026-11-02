import { readFileSync } from 'node:fs';
import { UNIT_TIMINGS } from '../sequencer';
import { assignShards, type Costed, costs, type Timings } from '../shards';

const committed = JSON.parse(readFileSync(UNIT_TIMINGS, 'utf8')) as Timings;

const files = (timings: Timings): Costed[] =>
  Object.entries(timings).map(([key, cost]) => ({ key, cost }));

const total = (shard: readonly Costed[]): number => shard.reduce((sum, file) => sum + file.cost, 0);

describe('costs', () => {
  it.each([
    { paths: ['a.test.ts'], expected: [300] },
    { paths: ['a.test.ts', 'a.test.ts'], expected: [150, 150] },
    { paths: ['new.test.ts'], expected: [200] },
  ])('weighs $paths as $expected', ({ paths, expected }) => {
    expect(costs(paths, { 'a.test.ts': 300, 'b.test.ts': 100, 'c.test.ts': 200 })).toEqual(
      expected
    );
  });
});

describe('assignShards over the committed unit timings', () => {
  it.each([4, 6, 8])(
    'puts every file in exactly one of %i shards, the largest within 1.2 times the smallest',
    (count) => {
      const shards = assignShards(files(committed), count);
      const keys = shards.flat().map(({ key }) => key);
      const totals = shards.map(total);

      expect(keys.toSorted()).toEqual(Object.keys(committed).toSorted());
      expect(Math.max(...totals)).toBeLessThanOrEqual(1.2 * Math.min(...totals));
    }
  );

  it('assigns the same way every time, whatever order the files come in', () => {
    const forward = assignShards(files(committed), 6);
    const backward = assignShards(files(committed).reverse(), 6);

    expect(backward).toEqual(forward);
  });
});
