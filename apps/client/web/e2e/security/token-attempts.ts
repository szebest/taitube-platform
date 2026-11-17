import type { ChannelAttempt } from './channel-attempts';

/** A token is managed with a session only, so nobody signed out reaches one. */
export const TOKEN_ATTEMPTS: ChannelAttempt[] = [
  {
    name: 'create a personal access token',
    method: 'POST',
    path: () => '/v1/me/api-tokens',
    data: { name: 'hijacked', scopes: ['videos:write'] },
    callers: ['an anonymous caller'],
  },
  {
    name: 'list the personal access tokens',
    method: 'GET',
    path: () => '/v1/me/api-tokens',
    callers: ['an anonymous caller'],
  },
  {
    name: 'revoke a personal access token',
    method: 'DELETE',
    path: () => '/v1/me/api-tokens/00000000-0000-7000-8000-000000000000',
    callers: ['an anonymous caller'],
  },
];
