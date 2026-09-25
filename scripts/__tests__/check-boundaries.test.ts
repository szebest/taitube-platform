import { resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../check-boundaries.ts');

describe('scripts: pnpm boundaries', () => {
  it('passes the repo and says how many packages it read', () => {
    const run = runEntrypoint(ENTRYPOINT, [], { PATH: process.env.PATH });

    expect(run.status).toBe(0);
    expect(run.stderr).toMatch(/package boundaries ok.*packages=\d+/);
  });
});
