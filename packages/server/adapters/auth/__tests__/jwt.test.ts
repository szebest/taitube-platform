import { signJwt, signingKey } from '@vp/testing/jwt';
import { expectErr, expectOk } from '@vp/testing/result';
import { type ClaimPolicy, decodeJwt, selectKey, verifyJwt } from '../jwt';

const NOW = 1_700_000_000_000;
const POLICY: ClaimPolicy = {
  issuer: 'https://idp.example/',
  audience: 'taitube',
  algorithms: ['RS256', 'ES256', 'EdDSA'],
  now: () => NOW,
};
const CLAIMS = {
  sub: 'user-1',
  iss: POLICY.issuer,
  aud: POLICY.audience,
  exp: NOW / 1000 + 600,
  role: 'admin',
  email: 'user@example.com',
};

const rsa = signingKey('RS256', 'rsa');
const ec = signingKey('ES256', 'ec');
const ed = signingKey('EdDSA', 'ed');
const JWKS = { keys: [rsa.jwk, ec.jwk, ed.jwk] };

function verify(token: string, policy: ClaimPolicy = POLICY) {
  return verifyJwt(expectOk(decodeJwt(token)), JWKS, policy);
}

describe('packages/adapters/auth: verifyJwt', () => {
  it.each([rsa, ec, ed])('verifies a $alg token and returns its principal', (key) => {
    expect(expectOk(verify(signJwt(key, CLAIMS)))).toEqual({
      sub: 'user-1',
      role: 'admin',
      email: 'user@example.com',
    });
  });

  it('accepts an audience array that names ours', () => {
    expectOk(verify(signJwt(rsa, { ...CLAIMS, aud: ['other', 'taitube'] })));
  });

  it.each([
    { scenario: 'a foreign issuer', token: () => signJwt(rsa, { ...CLAIMS, iss: 'vp-dev' }) },
    { scenario: 'a foreign audience', token: () => signJwt(rsa, { ...CLAIMS, aud: 'other' }) },
    { scenario: 'an expired token', token: () => signJwt(rsa, { ...CLAIMS, exp: NOW / 1000 }) },
    {
      scenario: 'a token with no exp',
      token: () => signJwt(rsa, { ...CLAIMS, exp: undefined }),
    },
    {
      scenario: 'a token not active yet',
      token: () => signJwt(rsa, { ...CLAIMS, nbf: NOW / 1000 + 60 }),
    },
    { scenario: 'a token with no sub', token: () => signJwt(rsa, { ...CLAIMS, sub: '' }) },
    { scenario: 'alg none', token: () => signJwt(rsa, CLAIMS, { alg: 'none' }) },
    {
      scenario: 'an alg the key does not declare',
      token: () => signJwt(rsa, CLAIMS, { alg: 'ES256' }),
    },
    {
      scenario: 'a signature by another key under a known kid',
      token: () => signJwt(signingKey('RS256', 'rsa'), CLAIMS),
    },
    {
      scenario: 'no kid while the key set holds several keys',
      token: () => signJwt(rsa, CLAIMS, { kid: undefined }),
    },
    { scenario: 'an unknown kid', token: () => signJwt(signingKey('RS256', 'nobody'), CLAIMS) },
  ])('refuses $scenario', ({ token }) => {
    expect(expectErr(verify(token())).code).toBe('UNAUTHORIZED');
  });

  it('refuses an alg the policy does not accept even when the key declares it', () => {
    expectErr(verify(signJwt(ed, CLAIMS), { ...POLICY, algorithms: ['RS256'] }));
  });
});

describe('packages/adapters/auth: selectKey', () => {
  it('takes the only key for a kid-less token', () => {
    expect(expectOk(selectKey({ keys: [rsa.jwk] }, undefined))).toBe(rsa.jwk);
  });

  it('finds nothing in an empty key set', () => {
    expectErr(selectKey({ keys: [] }, undefined));
  });
});

describe('packages/adapters/auth: decodeJwt', () => {
  it.each(['not-a-jwt', 'a.b', 'a.b.c.d', '!!.e30.sig', 'e30.e30.sig', 'W10.e30.sig'])(
    'refuses %s',
    (token) => {
      expect(expectErr(decodeJwt(token)).code).toBe('UNAUTHORIZED');
    }
  );
});
