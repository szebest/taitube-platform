import { renderHook } from '@testing-library/react';
import { ActiveChannelContext, type ActiveChannel, useActiveChannel } from '../use-active-channel';

const active: ActiveChannel = {
  channelId: 'channel-1',
  ownerId: 'owner-1',
  role: 'editor',
  own: false,
  memberships: [],
};

describe('apps/client/studio: useActiveChannel', () => {
  it('reads the channel the studio acts on', () => {
    const { result } = renderHook(useActiveChannel, {
      wrapper: ({ children }) => (
        <ActiveChannelContext value={active}>{children}</ActiveChannelContext>
      ),
    });

    expect(result.current).toBe(active);
  });

  it('refuses to run outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(useActiveChannel)).toThrow(
      'useActiveChannel must be used within ActiveChannelProvider'
    );
  });
});
