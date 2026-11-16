import { resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

function envctl(...argv: string[]) {
  return runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });
}

describe('packages/deploy: pnpm envctl', () => {
  it.each([
    { argv: ['--help'], status: 0 },
    { argv: ['launch'], status: 2 },
  ])('prints the usage for $argv and exits $status', ({ argv, status }) => {
    const run = envctl(...argv);

    expect(run.stdout).toContain('pnpm envctl <command> [environment] [options]');
    expect(run.status).toBe(status);
  });

  it('validates the environments this repository ships against the env schema', () => {
    const run = envctl('validate');

    expect(run.stdout).toContain('environments valid');
    expect(run.status).toBe(0);
  });

  it('reads one field of an environment', () => {
    const run = envctl('get', 'production', 'cluster.context');

    expect(run.stdout.trim()).toBe('k3s-production');
    expect(run.status).toBe(0);
  });

  it('refuses a context the environment does not declare', () => {
    const run = envctl('confirm', 'production', '--context', 'k3d-vp', '--yes');

    expect(run.stdout).toContain('refusing production: the current context is k3d-vp');
    expect(run.status).toBe(1);
  });
});
