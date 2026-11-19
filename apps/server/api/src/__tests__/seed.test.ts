import { resolve } from 'node:path';
import { runEntrypoint } from '@kit/testing/run-entrypoint';
import { PRODUCTION_ENV } from '@vp/testing-fixtures/env';

const ENTRYPOINT = resolve(import.meta.dirname, '../seed.ts');

describe('apps/server/api: pnpm db:seed', () => {
  it('exits 1 under production before it touches a database', () => {
    const run = runEntrypoint(ENTRYPOINT, [], { PATH: process.env.PATH, ...PRODUCTION_ENV });

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('refuses NODE_ENV=production');
  });
});
