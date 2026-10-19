import { type Channel, type CreateChannelInput, toChannelCard } from '../channel';

function channel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'channel-1',
    userId: 'user-1',
    handle: 'ada',
    displayName: 'Ada',
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    links: [],
    subscriberCount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

describe('@vp/domain: the channel entity', () => {
  it('requires exactly the identity, the presentation and the audit columns', () => {
    expect(Object.keys(channel()).sort()).toEqual([
      'avatarUrl',
      'bannerUrl',
      'bio',
      'createdAt',
      'displayName',
      'handle',
      'id',
      'links',
      'subscriberCount',
      'updatedAt',
      'userId',
    ]);
  });

  it('lets a creator supply only the owner, the handle and the display name', () => {
    const input: CreateChannelInput = { userId: 'user-1', handle: 'ada', displayName: 'Ada' };

    expect(input.handle).toBe('ada');
  });

  it('shows a channel on a card by its id, handle, name and avatar only', () => {
    expect(toChannelCard(channel({ avatarUrl: 'https://cdn/ada.png', bio: 'hi' }))).toEqual({
      id: 'channel-1',
      handle: 'ada',
      displayName: 'Ada',
      avatarUrl: 'https://cdn/ada.png',
    });
  });
});
