import { resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

describe('packages/stack: pnpm stack', () => {
  it.each([
    { argv: ['--help'], status: 0 },
    { argv: ['launch'], status: 2 },
  ])('prints the usage for $argv and exits $status', ({ argv, status }) => {
    const run = runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });

    expect(run.stdout).toContain('pnpm stack <command> [targets...] [options]');
    expect(run.status).toBe(status);
  });

  it('reports a compose file docker cannot read instead of throwing', () => {
    const run = runEntrypoint(ENTRYPOINT, ['status', '--file', '/nonexistent/compose.yml'], {
      PATH: process.env.PATH,
    });

    expect(run.stdout).toContain('docker compose could not read /nonexistent/compose.yml');
    expect(run.status).toBe(1);
  });
});
