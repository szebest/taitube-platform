import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { DEV_KEY_ID } from '../keys';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

function devToken(...argv: string[]) {
  return spawnSync('npx', ['tsx', ENTRYPOINT, ...argv], {
    env: { PATH: process.env.PATH },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('packages/dev-token: pnpm dev-token', () => {
  it('runs the command it is given', () => {
    const jwks = devToken('jwks');

    expect(jwks.status).toBe(0);
    expect(JSON.parse(jwks.stdout).keys[0].kid).toBe(DEV_KEY_ID);
  });

  it('prints why a command failed and exits 1', () => {
    const verify = devToken('verify');

    expect(verify.status).toBe(1);
    expect(verify.stderr).toContain('dev-token: verify needs a token argument');
  });
});
