import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { PlayerChannelProvider } from '#app/components/player/taitube-player';
import { ShortsPlayerFrameRoot } from '#app/components/shorts/shorts-player-frame/shorts-player-frame';
import { useOfferedPlayerChannel } from '#app/lib/player/player-channel';
import { ShortsFeedProgress } from '../shorts-feed-progress';

function Engine({
  seek,
  onChannel,
}: {
  seek: (seconds: number) => void;
  onChannel: (publish: (seconds: number) => void) => void;
}) {
  const channel = useOfferedPlayerChannel();

  useEffect(() => {
    if (!channel) return;
    onChannel(channel.publish);
    return channel.attach(seek);
  }, [channel, seek, onChannel]);

  return null;
}

function renderProgress(durationMs = 40_000) {
  const seek = vi.fn();
  let publish: (seconds: number) => void = () => undefined;
  const onChannel = (next: (seconds: number) => void) => {
    publish = next;
  };
  render(
    <AppProviders>
      <PlayerChannelProvider>
        <ShortsPlayerFrameRoot>
          <Engine seek={seek} onChannel={onChannel} />
          <ShortsFeedProgress durationMs={durationMs} />
        </ShortsPlayerFrameRoot>
      </PlayerChannelProvider>
    </AppProviders>
  );
  const publishTime = (seconds: number) => act(() => publish(seconds));
  return { seek, publishTime, user: userEvent.setup() };
}

describe('apps/client/web: ShortsFeedProgress', () => {
  it('is a slider named Seek that follows the playhead', () => {
    const { publishTime } = renderProgress();

    expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuenow', '0');

    publishTime(10);

    expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuenow', '25');
  });

  it('seeks to the second the viewer arrows to', async () => {
    const { user, seek, publishTime } = renderProgress();
    publishTime(20);

    screen.getByRole('slider', { name: 'Seek' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(seek).toHaveBeenCalledExactlyOnceWith(20.4);
  });

  it('stays at the start for a Short whose length is not known yet', () => {
    const { publishTime } = renderProgress(0);

    publishTime(5);

    expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuenow', '0');
  });
});
