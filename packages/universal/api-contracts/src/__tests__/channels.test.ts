import { ChannelIdParamSchema, ChannelSchema, getChannel } from '../channels';

const channel = {
  id: '00000000-0000-7000-8000-0000000000a1',
  userId: '00000000-0000-7000-8000-0000000000a2',
  handle: 'creator',
  displayName: 'Creator',
  avatarUrl: null,
  bannerUrl: null,
  avatar: null,
  banner: null,
  bannerLink: null,
  country: null,
  hasContact: false,
  brandColor: '#3366cc',
  bio: null,
  links: [],
  subscriberCount: 0,
  videoCount: 0,
  totalViews: 0,
  live: null,
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

  it.each([
    { scenario: 'not live', live: null },
    {
      scenario: 'live now',
      live: {
        liveStreamId: '00000000-0000-7000-8000-0000000000a3',
        videoId: '00000000-0000-7000-8000-0000000000a4',
        startedAt: '2026-01-01T12:00:00.000Z',
      },
    },
  ])('parses a public channel profile $scenario', ({ live }) => {
    expect(ChannelSchema.parse({ ...channel, live }).live).toEqual(live);
  });

  it('requires a uuid where a channel id is the parameter', () => {
    expect(ChannelIdParamSchema.safeParse({ id: 'creator' }).success).toBe(false);
  });
});
