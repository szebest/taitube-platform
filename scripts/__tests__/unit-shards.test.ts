import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../unit-shards.ts');

const unitShards = (argv: string[], env: Record<string, string> = {}) =>
  runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH, ...env });

describe('scripts: pnpm unit-shards', () => {
  it('prints the plan the recorded timings call for', () => {
    const run = unitShards([]);
    const plan = JSON.parse(run.stdout) as { count: number; shards: number[] };

    expect(run.status).toBe(0);
    expect(plan.count).toBeGreaterThanOrEqual(1);
    expect(plan.shards).toEqual(Array.from({ length: plan.count }, (_, index) => index + 1));
  });

  it('appends the matrix and the count to GITHUB_OUTPUT with --github-output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'unit-shards-'));
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
    const output = join(directory, 'output');

    const run = unitShards(['--github-output'], { GITHUB_OUTPUT: output });
    const { count, shards } = JSON.parse(run.stdout) as { count: number; shards: number[] };

    expect(run.status).toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(
      `unit-shards=${JSON.stringify(shards)}\nunit-shard-count=${count}\n`
    );
  });

  it.each([
    { name: '--github-output without GITHUB_OUTPUT', argv: ['--github-output'], status: 1 },
    { name: 'an unknown flag', argv: ['--bogus'], status: 2 },
  ])('exits $status on $name', ({ argv, status }) => {
    const run = unitShards(argv);

    expect(run.status).toBe(status);
    expect(run.stderr).not.toBe('');
  });

  it('prints its usage for --help', () => {
    const run = unitShards(['--help']);

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Usage: pnpm unit-shards');
  });
});
