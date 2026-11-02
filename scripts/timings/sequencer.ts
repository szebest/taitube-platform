import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { assignShards, costs, type Timings } from './shards';

export const UNIT_TIMINGS = join(import.meta.dirname, '../../tests/timings/unit.json');

/**
 * Splits `--shard=i/N` by the recorded cost in `tests/timings/unit.json` instead of vitest's hash of
 * the path, which balances the file count but not the time.
 */
export class CostSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root, shard } = this.ctx.config;
    if (!shard) return files;
    const timings = JSON.parse(readFileSync(UNIT_TIMINGS, 'utf8')) as Timings;
    const paths = files.map((spec) => relative(root, spec.moduleId));
    const weights = costs(paths, timings);
    const keyed = files.map((spec, index) => ({
      key: `${spec.project.name}:${paths[index]}`,
      cost: weights[index] ?? 0,
      spec,
    }));
    return (assignShards(keyed, shard.count)[shard.index - 1] ?? []).map(({ spec }) => spec);
  }
}
