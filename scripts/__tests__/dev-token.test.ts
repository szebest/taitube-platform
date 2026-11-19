import { resolve } from 'node:path';
import { runEntrypoint } from '../../packages/platform/server/testing/src/run-entrypoint';
import { DEV_TOKEN_CONFIG } from '../../packages/server/dev-identity/src/index';

const ENTRYPOINT = resolve(import.meta.dirname, '../dev-token.ts');

function devToken(...argv: string[]) {
  return runEntrypoint(ENTRYPOINT, argv, { PATH: process.env.PATH });
}

describe('scripts: pnpm dev-token', () => {
  it('runs the command it is given', () => {
    const jwks = devToken('jwks');

    expect(jwks.status).toBe(0);
    expect(JSON.parse(jwks.stdout).keys[0].kid).toBe(DEV_TOKEN_CONFIG.keyId);
  });

  it('logs why a command failed and exits 1', () => {
    const verify = devToken('verify');

    expect(verify.status).toBe(1);
    expect(verify.stderr).toContain('fatal dev-token failed');
    expect(verify.stderr).toContain('verify needs a token argument');
  });

  it('names the product in its usage', () => {
    expect(devToken('--help').stdout).toContain('for video-pipeline');
  });
});
