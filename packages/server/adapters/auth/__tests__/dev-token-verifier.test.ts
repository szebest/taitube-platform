import { getDevJwks, mintToken } from '@vp/dev-token';
import { signJwt, signingKey } from '@vp/testing/jwt';
import { expectErr, expectOk } from '@vp/testing/result';
import { DevTokenVerifier } from '../dev-token-verifier';

function verifier(issuer = 'vp-dev') {
  return new DevTokenVerifier({ jwks: getDevJwks(), issuer, audience: 'vp-api', now: Date.now });
}

describe('packages/adapters/auth: DevTokenVerifier', () => {
  it('verifies a minted dev token into the caller it names', async () => {
    const token = mintToken({ sub: '00000000-0000-7000-8000-0000000000a1', role: 'admin' });

    expect(expectOk(await verifier().verify(token))).toEqual({
      sub: '00000000-0000-7000-8000-0000000000a1',
      role: 'admin',
      email: undefined,
    });
  });

  it('refuses a dev token minted for another issuer', async () => {
    expectErr(await verifier('https://idp.example/').verify(mintToken({ role: 'admin' })));
  });

  it('refuses an RS256 token even under the dev kid', async () => {
    const token = signJwt(signingKey('RS256', 'vp-dev-key-1'), {
      sub: 'user-1',
      iss: 'vp-dev',
      aud: 'vp-api',
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expectErr(await verifier().verify(token));
  });
});
