import { resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

describe('packages/demo: pnpm demo', () => {
  it.each([
    { argv: ['--help'], status: 0, out: 'pnpm demo [command] [options]' },
    { argv: ['launch'], status: 2, out: 'unknown command "launch"' },
    { argv: ['--profile', 'huge'], status: 2, out: '--profile takes minimal or full' },
    { argv: ['up', '--dry-run'], status: 0, out: 'Plan for pnpm demo up' },
  ])('prints $out for $argv and exits $status', ({ argv, status, out }) => {
    const run = runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });

    expect(run.stdout).toContain(out);
    expect(run.status).toBe(status);
  });
});
