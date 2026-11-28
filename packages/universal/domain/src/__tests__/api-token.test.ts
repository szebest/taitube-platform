import {
  API_SCOPES,
  API_TOKEN_LIMITS,
  apiTokenExpiry,
  apiTokenStatus,
  formatApiToken,
  isApiTokenCredential,
  parseApiToken,
} from '../api-token';

const PREFIX = '0a1b2c3d';
const SECRET = 'f'.repeat(64);
const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('@vp/domain: api token', () => {
  it('names the scopes a token can carry', () => {
    expect(API_SCOPES).toEqual([
      'videos:read',
      'videos:write',
      'analytics:read',
      'comments:read',
      'comments:moderate',
      'exports:read',
      'exports:create',
      'webhooks:manage',
      'posts:write',
    ]);
  });

  it('caps a user at ten active tokens, a name at 60 and a token at 60 requests a minute', () => {
    expect(API_TOKEN_LIMITS).toEqual({
      activePerUser: 10,
      nameMaxLength: 60,
      requestsPerMinute: 60,
    });
  });

  it.each([
    { expiry: '30d', expiresAt: '2026-03-31T12:00:00.000Z' },
    { expiry: '90d', expiresAt: '2026-05-30T12:00:00.000Z' },
    { expiry: '1y', expiresAt: '2027-03-01T12:00:00.000Z' },
  ] as const)('expires a $expiry token at $expiresAt', ({ expiry, expiresAt }) => {
    expect(apiTokenExpiry(expiry, NOW)).toEqual(new Date(expiresAt));
  });

  it.each([
    { revokedAt: null, expiresAt: '2026-03-02T00:00:00.000Z', status: 'active' },
    { revokedAt: null, expiresAt: '2026-03-01T12:00:00.000Z', status: 'expired' },
    { revokedAt: NOW, expiresAt: '2026-03-02T00:00:00.000Z', status: 'revoked' },
    { revokedAt: NOW, expiresAt: '2026-02-01T00:00:00.000Z', status: 'revoked' },
  ] as const)(
    'is $status at $expiresAt, revoked $revokedAt',
    ({ revokedAt, expiresAt, status }) => {
      expect(apiTokenStatus({ revokedAt, expiresAt: new Date(expiresAt) }, NOW)).toBe(status);
    }
  );

  it('reads back the prefix and secret it formats', () => {
    const token = formatApiToken({ prefix: PREFIX, secret: SECRET });

    expect(token).toBe(`tt_pat_${PREFIX}_${SECRET}`);
    expect(parseApiToken(token)).toEqual({ prefix: PREFIX, secret: SECRET });
  });

  it.each([
    { credential: `tt_pat_${PREFIX}_${SECRET.slice(1)}`, scenario: 'a short secret' },
    { credential: `tt_pat_${PREFIX.slice(1)}_${SECRET}`, scenario: 'a short prefix' },
    { credential: `tt_pat_${PREFIX}_${SECRET.toUpperCase()}`, scenario: 'upper case' },
    { credential: `tt_pat_${PREFIX}_${SECRET} `, scenario: 'trailing text' },
    { credential: `tt_pat_${PREFIX}${SECRET}`, scenario: 'no separator' },
    { credential: 'eyJhbGciOiJSUzI1NiJ9.e30.sig', scenario: 'a JWT' },
  ])('refuses $scenario', ({ credential }) => {
    expect(parseApiToken(credential)).toBeNull();
  });

  it.each([
    { credential: 'tt_pat_garbage', claims: true },
    { credential: 'eyJhbGciOiJSUzI1NiJ9.e30.sig', claims: false },
  ])('tells a token credential from another: $credential', ({ credential, claims }) => {
    expect(isApiTokenCredential(credential)).toBe(claims);
  });
});
