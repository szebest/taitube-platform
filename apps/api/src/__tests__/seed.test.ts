import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PRODUCTION_ENV } from '@vp/testing/env';

const ROOT = resolve(import.meta.dirname, '../../../..');
const ENTRYPOINT = resolve(import.meta.dirname, '../seed.ts');

function seed(env: Record<string, string>) {
  return spawnSync('npx', ['tsx', ENTRYPOINT], {
    env: { PATH: process.env.PATH, ...env },
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('apps/api: pnpm db:seed', () => {
  it('exits 1 under production before it touches a database', () => {
    const run = seed(PRODUCTION_ENV);

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('refuses NODE_ENV=production');
  });

  it('exits 1 on an invalid environment with one line and no stack', () => {
    const run = seed({ DATABASE_URL: 'postgres://localhost:5432/vp', PORT: 'eighty' });

    expect(run.status).toBe(1);
    const logged = run.stderr.split('\n').filter((line) => line && !line.startsWith('npm warn'));
    expect(logged).toEqual([
      expect.stringMatching(/^fatal invalid environment configuration invalid=.*PORT/),
    ]);
  });
});
