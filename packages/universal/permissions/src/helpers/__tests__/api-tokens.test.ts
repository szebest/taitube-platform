import type { ApiScope } from '@vp/domain';
import type { UserContext } from '../../types/index';
import {
  canCallWithToken,
  canCreateApiToken,
  canReadApiToken,
  canRevokeApiToken,
} from '../api-tokens';

const SESSION: UserContext = { id: 'usr-1', role: 'USER' };
const TOKEN: UserContext = {
  ...SESSION,
  token: { id: 'tok-1', channelId: 'chan-1', scopes: ['videos:write', 'webhooks:manage'] },
};

const ASKS = [canCreateApiToken, canReadApiToken, canRevokeApiToken];

describe('helpers/api-tokens', () => {
  it.each<{ scenario: string; user: UserContext | null; userId: string; expected: boolean }>([
    { scenario: 'a session, on its own', user: SESSION, userId: 'usr-1', expected: true },
    { scenario: "a session, on another user's", user: SESSION, userId: 'usr-2', expected: false },
    { scenario: 'a token, whatever its scopes', user: TOKEN, userId: 'usr-1', expected: false },
    { scenario: 'nobody', user: null, userId: 'usr-1', expected: false },
  ])('manages a token as $scenario: $expected', ({ user, userId, expected }) => {
    expect(ASKS.map((ask) => ask({ user, apiToken: { userId } }))).toEqual([
      expected,
      expected,
      expected,
    ]);
  });

  it.each<{
    scenario: string;
    user: UserContext | null;
    scope: ApiScope | undefined;
    expected: boolean;
  }>([
    {
      scenario: 'a session on a route without a scope',
      user: SESSION,
      scope: undefined,
      expected: true,
    },
    { scenario: 'nobody on a route without a scope', user: null, scope: undefined, expected: true },
    {
      scenario: 'a token on a route without a scope',
      user: TOKEN,
      scope: undefined,
      expected: false,
    },
    { scenario: 'a token on a scope it holds', user: TOKEN, scope: 'videos:write', expected: true },
    {
      scenario: 'a token on a scope it lacks',
      user: TOKEN,
      scope: 'analytics:read',
      expected: false,
    },
  ])('$scenario: $expected', ({ user, scope, expected }) => {
    expect(canCallWithToken({ user, scope })).toBe(expected);
  });
});
