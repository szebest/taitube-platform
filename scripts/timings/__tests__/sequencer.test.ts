import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TestSpecification, Vitest } from 'vite-plus/test/node';
import { CostSequencer, UNIT_TIMINGS } from '../sequencer';

const ROOT = join(import.meta.dirname, '../../..');
const committed = Object.keys(JSON.parse(readFileSync(UNIT_TIMINGS, 'utf8')) as object);

const spec = (path: string): TestSpecification =>
  ({ moduleId: join(ROOT, path), project: { name: 'unit' } }) as unknown as TestSpecification;

const sequencer = (shard?: { index: number; count: number }) =>
  new CostSequencer({ config: { root: ROOT, shard } } as unknown as Vitest);

describe('CostSequencer', () => {
  const specs = [
    ...committed.map(spec),
    spec('apps/server/api/src/__tests__/not-timed-yet.test.ts'),
  ];

  it('hands out every spec once across the shards, an untimed one included', async () => {
    const shards = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((index) => sequencer({ index, count: 6 }).shard(specs))
    );

    expect(shards.flat().toSorted((a, b) => (a.moduleId < b.moduleId ? -1 : 1))).toEqual(
      specs.toSorted((a, b) => (a.moduleId < b.moduleId ? -1 : 1))
    );
  });

  it('runs every spec when no shard is asked for', async () => {
    expect(await sequencer().shard(specs)).toEqual(specs);
  });
});
