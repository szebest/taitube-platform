import { resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../sync-claude-symlinks.ts');

describe('scripts: pnpm sync:claude --check', () => {
  it('finds every AGENTS.md linked from a CLAUDE.md beside it', () => {
    const run = runEntrypoint(ENTRYPOINT, ['--check'], { PATH: process.env.PATH });

    expect(run.status).toBe(0);
    expect(run.stderr).toMatch(/claude\.md symlinks ok.*agentsFiles=\d+/);
  });
});
