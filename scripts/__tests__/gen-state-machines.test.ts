import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../gen-state-machines.ts');
const DOC = 'docs/state-machines.md';

const genStateMachines = (...argv: string[]) =>
  runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });

function emptyRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'gen-state-machines-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

describe('scripts: pnpm gen:state-machines', () => {
  it('writes the file the check reads, and the check names the file edited by hand', () => {
    const root = emptyRoot();

    expect(genStateMachines(root).status).toBe(0);
    expect(readFileSync(join(root, DOC), 'utf8')).toContain('# State machines');
    expect(genStateMachines('--check', root)).toMatchObject({
      status: 0,
      stdout: `gen:state-machines: ${DOC} is up to date\n`,
    });

    writeFileSync(join(root, DOC), `${readFileSync(join(root, DOC), 'utf8')}by hand\n`);
    const run = genStateMachines('--check', root);

    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      `gen:state-machines: ${DOC} is stale; run pnpm gen:state-machines and commit it\n`
    );
  });

  it('prints its usage for --help and exits 2 for an option it does not know', () => {
    expect(genStateMachines('--help')).toMatchObject({ status: 0 });
    expect(genStateMachines('--help').stdout).toContain('Usage: pnpm gen:state-machines');
    expect(genStateMachines('--wat')).toMatchObject({ status: 2 });
  });
});
