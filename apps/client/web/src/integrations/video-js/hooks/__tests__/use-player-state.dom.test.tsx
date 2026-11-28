import { fireEvent, screen } from '@testing-library/react';
import { renderInPlayer } from '#app/integrations/video-js/__tests__/render-in-player';
import { AUTO_QUALITY, usePlayerState } from '../use-player-state';

vi.mock(import('hls.js'), async (importOriginal) => {
  const { offlineHls } = await import('#app/integrations/video-js/__tests__/offline-hls');
  return offlineHls(await importOriginal());
});

function PlayerFlags() {
  const buffering = usePlayerState((state) => state.buffering);
  const ended = usePlayerState((state) => state.ended);
  const quality = usePlayerState((state) => state.quality);

  return <output>{`buffering:${buffering} ended:${ended} quality:${quality}`}</output>;
}

function renderFlags() {
  return renderInPlayer(() => <PlayerFlags />);
}

describe('apps/client/web: usePlayerState', () => {
  it('starts on automatic quality with nothing playing', () => {
    renderFlags();

    expect(screen.getByRole('status')).toHaveTextContent(
      `buffering:false ended:false quality:${AUTO_QUALITY}`
    );
  });

  it.each([
    { event: 'waiting', media: { paused: false }, flags: 'buffering:true ended:false' },
    { event: 'ended', media: { ended: true }, flags: 'buffering:false ended:true' },
  ])('exposes the $event state', async ({ event, media, flags }) => {
    const { video } = renderFlags();
    for (const [name, value] of Object.entries(media)) {
      Object.defineProperty(video, name, { configurable: true, value });
    }

    fireEvent(video, new Event(event));

    expect(await screen.findByText(new RegExp(flags))).toBeInTheDocument();
  });
});
