import { createMyChannel, listMyIdentities, promoteMyChannel } from '../my-channels';

describe('packages/api-contracts: my channels', () => {
  it.each([
    { endpoint: createMyChannel, method: 'POST', path: '/v1/me/channels' },
    { endpoint: promoteMyChannel, method: 'PATCH', path: '/v1/me/channels/:id' },
    { endpoint: listMyIdentities, method: 'GET', path: '/v1/me/identities' },
  ])(
    'serves $method $path for the account, never for a named channel',
    ({ endpoint, method, path }) => {
      expect(endpoint).toMatchObject({ method, path });
      expect(endpoint).not.toHaveProperty('channelScoped');
    }
  );

  it.each([
    {
      scenario: 'a handle and a name',
      body: { handle: 'second', displayName: 'Second' },
      ok: true,
    },
    { scenario: 'a blank name', body: { handle: 'second', displayName: '  ' }, ok: false },
    { scenario: 'no handle', body: { displayName: 'Second' }, ok: false },
  ])('checks a create with $scenario', ({ body, ok }) => {
    expect(createMyChannel.body.safeParse(body).success).toBe(ok);
  });

  it.each([
    { scenario: 'a promotion', body: { isPrimary: true }, ok: true },
    { scenario: 'a demotion', body: { isPrimary: false }, ok: false },
    { scenario: 'nothing', body: {}, ok: false },
  ])('checks a primary change of $scenario', ({ body, ok }) => {
    expect(promoteMyChannel.body.safeParse(body).success).toBe(ok);
  });
});
