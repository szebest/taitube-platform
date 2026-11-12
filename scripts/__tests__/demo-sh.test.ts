import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, '../demo.sh');

function demo(...args: string[]) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    timeout: 20_000,
  });
}

describe('scripts: demo.sh', () => {
  it('prints its usage on --help and exits 0', () => {
    const run = demo('--help');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('scripts/demo.sh');
    expect(run.stdout).toContain('Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.');
  });

  it('prints the plan on --dry-run, with the arguments it will pass on, and runs nothing', () => {
    const run = demo('--dry-run', '--profile', 'full', 'reset');
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('dry run, nothing is executed');
    expect(run.stdout).toContain('4 pnpm --silent demo --profile full reset');
    expect(run.stdout).toContain('Plan for pnpm demo reset');
    expect(run.stdout).toContain('pnpm install --frozen-lockfile');
    expect(run.stdout).not.toContain('\u001b');
  });
});
