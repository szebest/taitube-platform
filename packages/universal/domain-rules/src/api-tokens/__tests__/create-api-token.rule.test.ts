import { expectErr, expectOk } from '@kit/testing/result';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type CreateApiTokenInput, decideApiTokenCreate } from '../create-api-token.rule';

const NOW = new Date('2026-03-01T12:00:00.000Z');
const SESSION: UserContext = { id: 'usr-1', role: 'USER' };

function input(overrides: Partial<CreateApiTokenInput> = {}): CreateApiTokenInput {
  return {
    user: SESSION,
    active: 0,
    id: 'tok-1',
    channelId: 'chan-1',
    name: '  nightly views  ',
    scopes: ['analytics:read', 'analytics:read', 'videos:read'],
    expiry: '90d',
    prefix: '0a1b2c3d',
    secretHash: 'hash',
    now: NOW,
    ...overrides,
  };
}

describe('@vp/domain-rules: decideApiTokenCreate', () => {
  it('builds the token for the caller on the acting channel, scopes once each', () => {
    expect(expectOk(decideApiTokenCreate(input()))).toEqual({
      id: 'tok-1',
      userId: 'usr-1',
      channelId: 'chan-1',
      name: 'nightly views',
      prefix: '0a1b2c3d',
      secretHash: 'hash',
      scopes: ['analytics:read', 'videos:read'],
      expiresAt: new Date('2026-05-30T12:00:00.000Z'),
      lastUsedAt: null,
      revokedAt: null,
      createdAt: NOW,
    });
  });

  it.each([
    {
      scenario: 'ten are already active',
      overrides: { active: 10 },
      code: ErrorCodes.API_TOKEN_LIMIT_REACHED,
    },
    {
      scenario: 'the caller is a token',
      overrides: { user: { ...SESSION, token: { id: 't', channelId: 'chan-1', scopes: [] } } },
      code: ErrorCodes.FORBIDDEN,
    },
    { scenario: 'nobody is signed in', overrides: { user: null }, code: ErrorCodes.UNAUTHORIZED },
  ])('refuses when $scenario', ({ overrides, code }) => {
    expect(expectErr(decideApiTokenCreate(input(overrides)))).toMatchObject({ code });
  });

  it('allows the tenth', () => {
    expect(expectOk(decideApiTokenCreate(input({ active: 9 })))).toMatchObject({ id: 'tok-1' });
  });
});
