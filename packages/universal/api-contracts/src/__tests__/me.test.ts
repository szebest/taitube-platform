import { getAccount, updateMyChannel } from '../me';

const channel = {
  id: '00000000-0000-7000-8000-0000000000a1',
  userId: '00000000-0000-7000-8000-0000000000a2',
  handle: 'creator',
  displayName: 'Creator',
  avatarUrl: null,
  bannerUrl: null,
  bio: null,
  links: [],
  subscriberCount: 0,
  videoCount: 0,
  totalViews: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const user = {
  id: '00000000-0000-7000-8000-0000000000a2',
  email: 'creator@example.com',
  tier: 'free',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('packages/api-contracts: me', () => {
  it('serves the account under /v1/me/account and the edit under /v1/me/channel', () => {
    expect(getAccount).toMatchObject({ method: 'GET', path: '/v1/me/account' });
    expect(updateMyChannel).toMatchObject({ method: 'PATCH', path: '/v1/me/channel' });
  });

  it('nests the user and the channel inside the account payload', () => {
    expect(
      getAccount.result.parse({ ...user, role: 'CREATOR', user, channel }).channel.handle
    ).toBe('creator');
  });

  it('refuses an account whose role is none of the roles', () => {
    expect(getAccount.result.safeParse({ ...user, role: 'SUPERUSER', user, channel }).success).toBe(
      false
    );
  });

  it('treats every channel edit field as optional but rejects a non-url avatar', () => {
    expect(updateMyChannel.body.parse({})).toEqual({});
    expect(updateMyChannel.body.safeParse({ avatarUrl: 'not-a-url' }).success).toBe(false);
    expect(updateMyChannel.body.safeParse({ avatarUrl: null }).success).toBe(true);
  });

  it.each([
    {
      name: 'a list of links',
      links: [{ label: 'Shop', url: 'https://shop.example.com' }],
      ok: true,
    },
    { name: 'an empty list that clears them', links: [], ok: true },
    { name: 'a link without a URL', links: [{ label: 'Shop' }], ok: false },
  ])('takes $name as the links of a channel edit', ({ links, ok }) => {
    expect(updateMyChannel.body.safeParse({ links }).success).toBe(ok);
  });
});
