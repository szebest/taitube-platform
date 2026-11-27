import { auditActor } from '../audit-actor';

describe('apps/server/api/services: auditActor', () => {
  it.each([
    { scenario: 'a session', token: undefined, expected: { actorUserId: 'usr-1' } },
    {
      scenario: 'a token',
      token: { id: 'tok-1', channelId: 'chan-1', scopes: ['videos:write' as const] },
      expected: { actorUserId: 'usr-1', actorTokenId: 'tok-1' },
    },
  ])('names the user, and the token of $scenario', ({ token, expected }) => {
    expect(auditActor({ id: 'usr-1', role: 'USER', ...(token && { token }) })).toEqual(expected);
  });
});
