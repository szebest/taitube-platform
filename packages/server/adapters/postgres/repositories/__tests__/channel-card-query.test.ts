import { toChannelCard } from '../channel-card-query';

describe('adapters/postgres: channel card', () => {
  it('reads a joined channel as its card', () => {
    expect(
      toChannelCard({ channelId: 'ch-1', handle: 'owner', displayName: 'Owner', avatarUrl: null })
    ).toEqual({ id: 'ch-1', handle: 'owner', displayName: 'Owner', avatarUrl: null });
  });

  it('reads a join that found no channel as no card', () => {
    expect(
      toChannelCard({ channelId: null, handle: null, displayName: null, avatarUrl: null })
    ).toBeNull();
  });
});
