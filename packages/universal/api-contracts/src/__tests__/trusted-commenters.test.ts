import { listTrustedCommenters, trustCommenter, untrustCommenter } from '../trusted-commenters';

describe('packages/api-contracts: trusted commenters', () => {
  it.each([
    { endpoint: listTrustedCommenters, method: 'GET', path: '/v1/me/channel/trusted-commenters' },
    { endpoint: trustCommenter, method: 'PUT', path: '/v1/me/channel/trusted-commenters/:userId' },
    {
      endpoint: untrustCommenter,
      method: 'DELETE',
      path: '/v1/me/channel/trusted-commenters/:userId',
    },
  ])('serves $method $path for the acting channel', ({ endpoint, method, path }) => {
    expect(endpoint).toMatchObject({ method, path, channelScoped: true });
  });

  it('refuses a user id that is not a UUID', () => {
    expect(trustCommenter.params.safeParse({ userId: 'someone' }).success).toBe(false);
  });
});
