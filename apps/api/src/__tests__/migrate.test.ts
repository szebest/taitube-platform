import { resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../migrate.ts');

describe('apps/api: pnpm db:migrate', () => {
  it('exits 1 on an invalid environment before it touches a database', () => {
    const run = runEntrypoint(ENTRYPOINT, [], { PATH: process.env.PATH, NODE_ENV: 'production' });

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('invalid environment configuration');
  });
});
