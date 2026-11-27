import { renderHook } from '@testing-library/react';
import { ModerationChannelProvider, useModerationChannel } from '../use-moderation-channel';

describe('apps/client/studio: useModerationChannel', () => {
  it('reads the channel the route handed down', () => {
    const channel = { channelId: 'channel-1', ownerId: 'owner-1' };

    const { result } = renderHook(useModerationChannel, {
      wrapper: ({ children }) => (
        <ModerationChannelProvider channel={channel}>{children}</ModerationChannelProvider>
      ),
    });

    expect(result.current).toEqual(channel);
  });

  it('names the provider when there is none', () => {
    expect(() => renderHook(useModerationChannel)).toThrow(/ModerationChannelProvider/);
  });
});
