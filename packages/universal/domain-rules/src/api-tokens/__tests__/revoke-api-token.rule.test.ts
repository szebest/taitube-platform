import { expectErr, expectOk } from '@kit/testing/result';
import type { ApiToken } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { decideApiTokenRevoke } from '../revoke-api-token.rule';

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

describe('@vp/domain-rules: decideApiTokenRevoke', () => {
  it.each([
    { scenario: 'an active token', found: token() },
    {
      scenario: 'an expired token',
      found: token({ expiresAt: new Date('2026-02-02T00:00:00.000Z') }),
    },
  ])('revokes $scenario', ({ found }) => {
    expect(expectOk(decideApiTokenRevoke({ tokenId: 'tok-1', found, now: NOW }))).toBe(found);
  });

  it.each([
    { scenario: 'nothing of the caller', found: null },
    { scenario: 'an already revoked token', found: token({ revokedAt: NOW }) },
  ])('answers not found for $scenario', ({ found }) => {
    expect(expectErr(decideApiTokenRevoke({ tokenId: 'tok-1', found, now: NOW }))).toMatchObject({
      code: ErrorCodes.API_TOKEN_NOT_FOUND,
      tokenId: 'tok-1',
    });
  });
});
