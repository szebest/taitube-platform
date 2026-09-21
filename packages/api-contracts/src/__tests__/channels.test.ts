import { ChannelIdParamSchema, ChannelSchema, getChannel } from '../channels';

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

describe('packages/api-contracts: channels', () => {
  it('resolves a channel by uuid or handle', () => {
    expect(getChannel).toMatchObject({ method: 'GET', path: '/v1/channels/:idOrHandle' });
    expect(getChannel.params?.parse({ idOrHandle: '@creator' })).toEqual({
      idOrHandle: '@creator',
    });
  });

  it('parses a public channel profile', () => {
    expect(ChannelSchema.parse(channel).handle).toBe('creator');
  });

  it('requires a uuid where a channel id is the parameter', () => {
    expect(ChannelIdParamSchema.safeParse({ id: 'creator' }).success).toBe(false);
  });
});
