import { resolve } from 'node:path';
import { PRODUCTION_ENV } from '@vp/testing/env';
import { runEntrypoint } from '@vp/testing/run-entrypoint';

const ENTRYPOINT = resolve(import.meta.dirname, '../seed.ts');

describe('apps/api: pnpm db:seed', () => {
  it('exits 1 under production before it touches a database', () => {
    const run = runEntrypoint(ENTRYPOINT, [], { PATH: process.env.PATH, ...PRODUCTION_ENV });

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('refuses NODE_ENV=production');
  });
});
