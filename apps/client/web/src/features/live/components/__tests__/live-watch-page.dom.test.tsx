import { act, screen, within } from '@testing-library/react';
import { LIVE_STREAM_ID, LIVE_VIDEO_ID } from '@vp/web-testing';
import { axeViolations } from '@vp/web-testing/dom';

import { renderLive } from '#app/features/live/__tests__/render-live';

vi.mock(import('#app/features/player/taitube-player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/live/__tests__/stub-live-player')).StubLivePlayer,
}));

const RECORDING = 'http://localhost:9000/public/live/archive/master.m3u8';

describe('apps/client/web: live watch page', () => {
  it('plays the broadcast live, under its title, with the live badge and its chat docked beside it', async () => {
    await renderLive();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Lisbon trams at dusk' })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('player')).toHaveAttribute('data-live', 'true');
    expect(screen.getByText('41 watching')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Live chat' })).not.toHaveAttribute(
      'data-layout',
      'overlay'
    );
    expect(await axeViolations()).toEqual([]);
  });

  it("counts the viewers the video's event stream reports, as they change", async () => {
    const { events } = await renderLive();

    act(() => events.emit('live.viewers', { liveStreamId: LIVE_STREAM_ID, viewers: 1200 }));

    expect(screen.getByText('1.2K watching')).toBeInTheDocument();
    expect(events.urls).toEqual([`/api/v1/videos/${LIVE_VIDEO_ID}/events`]);
  });

  it.each([
    { scenario: 'the player goes fullscreen', button: 'Full screen' },
    { scenario: 'the picture is vertical', button: 'Play a vertical picture' },
  ])('moves the chat over the picture when $scenario', async ({ button }) => {
    const { user } = await renderLive();

    await user.click(await screen.findByRole('button', { name: button }));

    const overlay = within(screen.getByTestId('player-overlay'));
    expect(overlay.getByRole('region', { name: 'Live chat' })).toHaveAttribute(
      'data-layout',
      'overlay'
    );
    expect(screen.getAllByRole('region', { name: 'Live chat' })).toHaveLength(1);
  });

  it('plays the recording once the broadcast ended, with its chat replay the viewer can hide', async () => {
    const { user, events } = await renderLive({
      stream: { status: 'ENDED', playbackUrl: RECORDING, viewers: 0 },
    });

    expect(await screen.findByTestId('player')).toHaveAttribute('data-live', 'false');
    expect(screen.getByText('This broadcast has ended')).toBeInTheDocument();
    expect(screen.queryByText(/watching/)).not.toBeInTheDocument();
    expect(events.urls).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Chat replay' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide chat replay' }));

    expect(screen.queryByRole('heading', { name: 'Chat replay' })).not.toBeInTheDocument();
  });

  it('says the recording is on its way while an ended broadcast has none yet', async () => {
    await renderLive({ stream: { status: 'ENDED', playbackUrl: null } });

    expect(screen.getByText('The recording will be here once it is ready.')).toBeInTheDocument();
    expect(screen.queryByTestId('player')).not.toBeInTheDocument();
  });
});
