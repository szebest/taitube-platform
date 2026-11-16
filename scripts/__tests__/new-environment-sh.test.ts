import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dirname, '../new-environment.sh');

function scaffold(...args: string[]) {
  return spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', timeout: 10_000 });
}

describe('scripts: new-environment.sh', () => {
  it('prints its usage on --help and exits 0', () => {
    const run = scaffold('--help');

    expect(run.status).toBe(0);
    expect(run.stdout).toContain('scripts/new-environment.sh <name>');
  });

  it.each([
    { scenario: 'no name', args: [], message: 'scripts/new-environment.sh <name>' },
    { scenario: 'an upper case name', args: ['Prod'], message: "invalid name 'Prod'" },
    { scenario: 'a name starting with a digit', args: ['1st'], message: "invalid name '1st'" },
    { scenario: 'two names', args: ['a-b', 'c-d'], message: 'one name at a time' },
    { scenario: 'an unknown option', args: ['--nope'], message: 'unknown option --nope' },
  ])('exits 2 for $scenario', ({ args, message }) => {
    const run = scaffold(...args);

    expect(run.status).toBe(2);
    expect(run.stdout + run.stderr).toContain(message);
  });

  it('exits 1 for a name that exists', () => {
    expect(scaffold('production').status).toBe(1);
  });

  it('says what it would write under --dry-run, and writes nothing', () => {
    const run = scaffold('--dry-run', 'qa-two');

    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      'would copy infra/environments/_template to infra/environments/qa-two'
    );
    expect(run.stdout).toContain('would set name: qa-two');
  });
});
