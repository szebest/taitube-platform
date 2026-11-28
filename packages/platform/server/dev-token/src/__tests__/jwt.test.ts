import { type MintTokenOptions, mintToken as mint, verifyToken as verify } from '../jwt';
import { TEST_CONFIG } from './test-config';

const mintToken = (options?: MintTokenOptions) => mint(TEST_CONFIG, options);
const verifyToken = (token: string) => verify(TEST_CONFIG, token);

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

function withHeader(header: object): string {
  const encode = (part: object) => Buffer.from(JSON.stringify(part)).toString('base64url');
  return `${encode(header)}.${encode({})}.sig`;
}

describe('dev-token: jwt', () => {
  it('mints an EdDSA token for the dev key with the dev issuer and audience', () => {
    const [header, payload] = mintToken({ sub: SUB, role: 'admin', ttl: '8h' }).split('.');

    expect(decodeSegment(header)).toEqual({ alg: 'EdDSA', typ: 'JWT', kid: 'acme-key-1' });
    expect(decodeSegment(payload)).toMatchObject({
      sub: SUB,
      role: 'admin',
      iss: 'acme-dev',
      aud: 'acme-api',
    });
  });

  it('verifies a token it minted', () => {
    const payload = verifyToken(mintToken({ sub: SUB, role: 'admin' }));

    expect(payload).toMatchObject({ sub: SUB, role: 'admin', iss: 'acme-dev', aud: 'acme-api' });
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
    {
      scenario: 'a token signed with RS256',
      token: withHeader({ alg: 'RS256' }),
      error: /got "RS256"/,
    },
    { scenario: 'a token with no algorithm', token: withHeader({}), error: /got undefined/ },
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

  it('checks expiry against the clock it is handed', () => {
    const token = mintToken({ sub: SUB, ttl: '1h' });
    const twoHoursLater = { ...TEST_CONFIG, now: () => TEST_CONFIG.now() + 2 * 3_600_000 };

    expect(verifyToken(token).iat).toBe(1_700_000_000);
    expect(() => verify(twoHoursLater, token)).toThrow(/expired/i);
  });

  it('refuses a malformed TTL', () => {
    expect(() => mintToken({ ttl: 'invalid' })).toThrow(/invalid ttl/i);
  });
});
