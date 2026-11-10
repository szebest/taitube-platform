import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, '../deploy.sh');

function deploy(...args: string[]) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
    timeout: 25_000,
  });
}

describe('scripts: deploy.sh', () => {
  it('prints its usage on --help and exits 0, naming every command and the exit codes', () => {
    const run = deploy('--help');

    expect(run.status).toBe(0);
    for (const command of [
      'plan',
      'deploy',
      'status',
      'rollback',
      'logs',
      'preflight',
      'secrets-check',
    ]) {
      expect(run.stdout).toContain(command);
    }
    expect(run.stdout).toContain('Exit codes: 0 ok, 1 failure, 2 usage, 3 prerequisite missing.');
  });

  it.each([
    { scenario: 'no command', args: [], message: 'scripts/deploy.sh <command>' },
    {
      scenario: 'an unknown command',
      args: ['launch', '--env', 'local'],
      message: 'unknown command launch',
    },
    {
      scenario: 'an unknown option',
      args: ['status', '--bogus'],
      message: 'unknown option --bogus',
    },
    {
      scenario: 'an option without its value',
      args: ['status', '--env'],
      message: '--env takes a value',
    },
    { scenario: 'no environment', args: ['status'], message: 'status needs --env <name>' },
    {
      scenario: 'an unknown environment',
      args: ['status', '--env', 'qa'],
      message: 'unknown environment qa; one of:',
    },
  ])('exits 2 for $scenario', ({ args, message }) => {
    const run = deploy(...args);

    expect(run.status).toBe(2);
    expect(run.stdout + run.stderr).toContain(message);
  });

  it('lists the environments', () => {
    const run = deploy('list');

    expect(run.status).toBe(0);
    expect(run.stdout.split('\n').map((line) => line.split('\t')[0])).toEqual(
      expect.arrayContaining(['local', 'preview', 'staging', 'production', 'compose-vm'])
    );
  });

  it('lists the secrets a production environment lacks, by name, and exits 1', () => {
    const run = deploy('secrets-check', '--env', 'production');

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('missing: ');
    expect(run.stdout).toContain('DATABASE_URL');
    expect(run.stdout).not.toContain('\u001b');
  });
});
