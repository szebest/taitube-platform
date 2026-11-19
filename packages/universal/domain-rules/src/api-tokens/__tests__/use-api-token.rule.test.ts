import { expectErr, expectOk } from '@kit/testing/result';
import type { ApiToken } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decideApiTokenUse } from '../use-api-token.rule';

const NOW = new Date('2026-03-01T12:00:00.000Z');

const token = (overrides: Partial<ApiToken> = {}): ApiToken => ({
  id: 'tok-1',
  userId: 'usr-1',
  channelId: 'chan-1',
  name: 'nightly',
  prefix: '0a1b2c3d',
  secretHash: 'hash',
  scopes: ['videos:read'],
  expiresAt: new Date('2026-04-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  ...overrides,
});

describe('@vp/domain-rules: decideApiTokenUse', () => {
  it('admits an active token', () => {
    const found = token();

    expect(expectOk(decideApiTokenUse({ found, now: NOW }))).toBe(found);
  });

  it.each([
    { scenario: 'no row matched', found: null, reason: 'unknown token' },
    { scenario: 'it expired', found: token({ expiresAt: NOW }), reason: 'token expired' },
    { scenario: 'it was revoked', found: token({ revokedAt: NOW }), reason: 'token revoked' },
  ])('refuses with a 401 when $scenario', ({ found, reason }) => {
    expect(expectErr(decideApiTokenUse({ found, now: NOW }))).toMatchObject({
      code: ErrorCodes.UNAUTHORIZED,
      reason,
    });
  });
});
