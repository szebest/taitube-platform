import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { renderFor, run } from '../run';

const REPO = resolve(import.meta.dirname, '../../..');
const INPUTS = ['.env.example', 'packages/server/env-schema/src/platform-env.json'];
const DOC = 'docs/ENVIRONMENT.md';

function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'env-docs-run-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const file of INPUTS) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(REPO, file), join(root, file));
  }
  return root;
}

describe('scripts: env-docs/run', () => {
  it('renders what is committed', async () => {
    expect(await renderFor(REPO)).toBe(readFileSync(join(REPO, DOC), 'utf8'));
  });

  it('writes the file under the root it is given', async () => {
    const root = tree();
    const outcome = await run([root], REPO);

    expect(outcome).toEqual({ code: 0, stdout: `wrote ${join(root, DOC)}\n`, stderr: '' });
    expect(readFileSync(join(root, DOC), 'utf8')).toBe(await renderFor(root));
  });

  it('reports a current file, a stale file and a missing file under --check', async () => {
    const root = tree();
    const missing = await run(['--check', root], REPO);
    await run([root], REPO);
    const current = await run(['--check', root], REPO);
    writeFileSync(join(root, DOC), 'edited by hand\n');
    const stale = await run(['--check', root], REPO);

    expect(current).toEqual({
      code: 0,
      stdout: `gen:env-docs: ${DOC} is up to date\n`,
      stderr: '',
    });
    expect([missing.code, stale.code]).toEqual([1, 1]);
    expect(stale.stderr).toBe(
      `gen:env-docs: ${DOC} is stale; run pnpm gen:env-docs and commit it\n`
    );
  });

  it('writes nothing under --check', async () => {
    const root = tree();
    await run(['--check', root], REPO);

    expect(() => readFileSync(join(root, DOC))).toThrow();
  });

  it.each([
    { argv: ['--help'], code: 0 },
    { argv: ['-h'], code: 0 },
    { argv: ['--wat'], code: 2 },
  ])('prints the usage for $argv and exits $code', async ({ argv, code }) => {
    const outcome = await run(argv, REPO);

    expect(outcome.code).toBe(code);
    expect(outcome.stdout + outcome.stderr).toContain('Usage: pnpm gen:env-docs');
  });
});
