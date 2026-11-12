import { appendFileSync, readFileSync } from 'node:fs';
import { PARALLELISM, planUnitShards, TARGET_SECONDS } from './timings/plan-shards';
import { UNIT_TIMINGS } from './timings/sequencer';
import type { Timings } from './timings/shards';

const USAGE = `Usage: pnpm unit-shards [--github-output]

Prints the unit shards CI runs as JSON: { "count": N, "shards": [1, ..., N] }. N is the fewest shards
whose expected wall time stays under ${TARGET_SECONDS} s each, from the cost recorded per spec file in
tests/timings/unit.json at ${PARALLELISM} cost-seconds per wall-second.

  --github-output   also append unit-shards=<json array> and unit-shard-count=<n> to $GITHUB_OUTPUT
  --help            print this text
`;

const args = process.argv.slice(2);
const flags = new Set(args);

if (flags.has('--help') || flags.has('-h')) {
  process.stdout.write(USAGE);
} else if (args.some((arg) => arg !== '--github-output')) {
  process.stderr.write(USAGE);
  process.exitCode = 2;
} else {
  const timings = JSON.parse(readFileSync(UNIT_TIMINGS, 'utf8')) as Timings;
  const plan = planUnitShards(timings, { targetSeconds: TARGET_SECONDS, parallelism: PARALLELISM });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
  const output = process.env.GITHUB_OUTPUT;
  if (flags.has('--github-output')) {
    if (!output) {
      process.stderr.write('unit-shards: GITHUB_OUTPUT is not set\n');
      process.exitCode = 1;
    } else {
      appendFileSync(
        output,
        `unit-shards=${JSON.stringify(plan.shards)}\nunit-shard-count=${plan.count}\n`
      );
    }
  }
}
