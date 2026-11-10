import { resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../gen-platform-icons.ts');

describe('scripts: pnpm gen:platform-icons', () => {
  it('finds the committed marks in step with the devDependencies', () => {
    const run = runEntrypoint(ENTRYPOINT, ['--check'], { PATH: process.env.PATH });

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });
});
