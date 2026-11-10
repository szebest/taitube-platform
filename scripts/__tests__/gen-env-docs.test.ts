import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../gen-env-docs.ts');
const REPO = resolve(import.meta.dirname, '../..');
const INPUTS = ['.env.example', 'packages/server/env-schema/src/platform-env.json'];
const DOC = 'docs/ENVIRONMENT.md';

const genEnvDocs = (...argv: string[]) =>
  runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });

function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'gen-env-docs-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  for (const file of INPUTS) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    cpSync(join(REPO, file), join(root, file));
  }
  return root;
}

describe('scripts: pnpm gen:env-docs', () => {
  it('writes the file the check reads, and the check names the file edited by hand', () => {
    const root = tree();

    expect(genEnvDocs(root).status).toBe(0);
    expect(readFileSync(join(root, DOC), 'utf8')).toBe(readFileSync(join(REPO, DOC), 'utf8'));
    expect(genEnvDocs('--check', root)).toMatchObject({
      status: 0,
      stdout: `gen:env-docs: ${DOC} is up to date\n`,
    });

    writeFileSync(join(root, DOC), `${readFileSync(join(root, DOC), 'utf8')}by hand\n`);
    const run = genEnvDocs('--check', root);

    expect(run.status).toBe(1);
    expect(run.stderr).toBe(`gen:env-docs: ${DOC} is stale; run pnpm gen:env-docs and commit it\n`);
  });

  it('fails the check when the file is missing', () => {
    expect(genEnvDocs('--check', tree()).status).toBe(1);
  });

  it('prints its usage for --help and exits 2 for an option it does not know', () => {
    expect(genEnvDocs('--help')).toMatchObject({ status: 0 });
    expect(genEnvDocs('--help').stdout).toContain('Usage: pnpm gen:env-docs');
    expect(genEnvDocs('--wat')).toMatchObject({ status: 2 });
  });
});
