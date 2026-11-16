import { mintToken, verifyToken } from '../jwt';

const SUB = '11111111-2222-3333-4444-555555555555';

function decodeSegment(segment: string | undefined): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment ?? '', 'base64url').toString('utf-8'));
}

function withForgedRole(token: string): string {
  const [header, payload, signature] = token.split('.');
  const forged = { ...decodeSegment(payload), role: 'admin' };
  const forgedPayload = Buffer.from(JSON.stringify(forged)).toString('base64url');
  return `${header}.${forgedPayload}.${signature}`;
}

describe('dev-token: jwt', () => {
  it('mints an EdDSA token for the dev key with the dev issuer and audience', () => {
    const [header, payload] = mintToken({ sub: SUB, role: 'admin', ttl: '8h' }).split('.');

    expect(decodeSegment(header)).toEqual({ alg: 'EdDSA', typ: 'JWT', kid: 'vp-dev-key-1' });
    expect(decodeSegment(payload)).toMatchObject({
      sub: SUB,
      role: 'admin',
      iss: 'vp-dev',
      aud: 'vp-api',
    });
  });

  it('verifies a token it minted', () => {
    const payload = verifyToken(mintToken({ sub: SUB, role: 'admin' }));

    expect(payload).toMatchObject({ sub: SUB, role: 'admin', iss: 'vp-dev', aud: 'vp-api' });
  });

  it.each([
    { scenario: 'an expired token', token: mintToken({ sub: SUB, ttl: -10 }), error: /expired/i },
    {
      scenario: 'a token whose payload was changed after signing',
      token: withForgedRole(mintToken({ sub: SUB, role: 'user' })),
      error: /signature/i,
    },
    {
      scenario: 'a token signed for another seed',
      token: mintToken({ sub: SUB, seed: 'another-seed' }),
      error: /signature/i,
    },
    {
      scenario: 'a token for another audience',
      token: mintToken({ sub: SUB, aud: 'someone-else' }),
      error: /audience/i,
    },
    { scenario: 'a token that is not three segments', token: 'a.b', error: /3 dot-separated/ },
  ])('refuses $scenario', ({ token, error }) => {
    expect(() => verifyToken(token)).toThrow(error);
  });

  it.each([
    ['30s', 30],
    ['15m', 900],
    ['8h', 28800],
    ['1d', 86400],
    [3600, 3600],
    ['', 28800],
  ])('mints a token that lives %j as %i seconds', (ttl, seconds) => {
    const { iat, exp } = verifyToken(mintToken({ ttl }));

    expect(exp - iat).toBe(seconds);
  });

  it('refuses a malformed TTL', () => {
    expect(() => mintToken({ ttl: 'invalid' })).toThrow(/invalid ttl/i);
  });
});
