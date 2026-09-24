import { resolve } from 'node:path';
import { runEntrypoint } from '@vp/testing/run-entrypoint';
import { DEV_KEY_ID } from '../keys';

const ENTRYPOINT = resolve(import.meta.dirname, '../main.ts');

function devToken(...argv: string[]) {
  return runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });
}

describe('packages/dev-token: pnpm dev-token', () => {
  it('runs the command it is given', () => {
    const jwks = devToken('jwks');

    expect(jwks.status).toBe(0);
    expect(JSON.parse(jwks.stdout).keys[0].kid).toBe(DEV_KEY_ID);
  });

  it('logs why a command failed and exits 1', () => {
    const verify = devToken('verify');

    expect(verify.status).toBe(1);
    expect(verify.stderr).toContain('fatal dev-token failed');
    expect(verify.stderr).toContain('verify needs a token argument');
  });
});
