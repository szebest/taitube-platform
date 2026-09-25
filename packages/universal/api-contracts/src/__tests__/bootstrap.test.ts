import { getBootstrap } from '../bootstrap';

const channel = {
  id: '00000000-0000-7000-8000-0000000000a1',
  userId: '00000000-0000-7000-8000-0000000000a2',
  handle: 'creator',
  displayName: 'Creator',
  avatarUrl: null,
  bannerUrl: null,
  bio: null,
  subscriberCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const category = {
  id: '00000000-0000-7000-8000-0000000000c1',
  slug: 'gaming',
  name: 'Gaming',
  description: null,
  iconUrl: null,
  sortOrder: 1,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('packages/api-contracts: bootstrap', () => {
  it('is an anonymous GET /v1/bootstrap', () => {
    expect(getBootstrap).toMatchObject({
      method: 'GET',
      path: '/v1/bootstrap',
      anonymous: true,
    });
  });

  it.each([
    { caller: 'a guest', user: null },
    { caller: 'a signed-in caller', user: channel },
  ])('carries the categories and flags for $caller', ({ user }) => {
    const context = { user, categories: [category], featureFlags: { studio: true } };

    expect(getBootstrap.result.parse(context)).toEqual(context);
  });

  it('refuses a flag that is not a boolean', () => {
    const context = { user: null, categories: [], featureFlags: { studio: 'yes' } };

    expect(getBootstrap.result.safeParse(context).success).toBe(false);
  });
});
