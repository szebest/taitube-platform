import { appendFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';
import { REPO, uiTree } from './ui-tree';

const ENTRYPOINT = resolve(import.meta.dirname, '../gen-tokens.ts');

const genTokens = (...argv: string[]) =>
  runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });

describe('scripts: pnpm gen:tokens', () => {
  it('writes the files the check reads, and the check names the one edited by hand', () => {
    const { root, remove } = uiTree();
    const sets = 'packages/client/ui/src/styles/generated/sets.css';

    expect(genTokens(root).status).toBe(0);
    expect(readFileSync(join(root, sets), 'utf8')).toBe(readFileSync(join(REPO, sets), 'utf8'));

    appendFileSync(join(root, sets), '.by-hand {}\n');
    const run = genTokens('--check', root);

    expect(run.status).toBe(1);
    expect(run.stderr).toBe(`gen:tokens: ${sets} drifted from the registry; run pnpm gen:tokens\n`);
    remove();
  });
});
