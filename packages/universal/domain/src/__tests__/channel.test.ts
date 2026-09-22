import type { Channel, CreateChannelInput } from '../channel';

describe('@vp/domain: the channel entity', () => {
  it('requires exactly the identity, the presentation and the audit columns', () => {
    const channel: Channel = {
      id: 'channel-1',
      userId: 'user-1',
      handle: 'ada',
      displayName: 'Ada',
      avatarUrl: null,
      bannerUrl: null,
      bio: null,
      subscriberCount: 0,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };

    expect(Object.keys(channel).sort()).toEqual([
      'avatarUrl',
      'bannerUrl',
      'bio',
      'createdAt',
      'displayName',
      'handle',
      'id',
      'subscriberCount',
      'updatedAt',
      'userId',
    ]);
  });

  it('lets a creator supply only the owner, the handle and the display name', () => {
    const input: CreateChannelInput = { userId: 'user-1', handle: 'ada', displayName: 'Ada' };

    expect(input.handle).toBe('ada');
  });
});
