import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PRODUCTION_ENV } from '@vp/testing/env';

const ROOT = resolve(import.meta.dirname, '../../../..');
const ENTRYPOINT = resolve(import.meta.dirname, '../seed.ts');

describe('apps/api: pnpm db:seed', () => {
  it('exits 1 under production before it touches a database', () => {
    const run = spawnSync('npx', ['tsx', ENTRYPOINT], {
      env: { PATH: process.env.PATH, ...PRODUCTION_ENV },
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toContain('refuses NODE_ENV=production');
  });
});
