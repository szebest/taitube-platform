import { fireEvent, render, screen, within } from '@testing-library/react';
import { IntlProvider } from '@vp/intl-react';
import { TaitubePlayer, type TaitubePlayerWithTelemetryProps } from '#app/features/player';

afterEach(() => {
  vi.useRealTimers();
});

function renderPlayer(props: Partial<TaitubePlayerWithTelemetryProps> = {}) {
  const rendered = render(
    <IntlProvider locale="en" timeZone="UTC">
      <TaitubePlayer
        videoId="0f8fad5b-d9cb-469f-a165-70867728950e"
        playbackUrl="http://localhost:9000/public/videos/v1/hls/master.m3u8"
        posterUrl="http://localhost:9000/posters/p.jpg"
        title="Launch day"
        {...props}
      />
    </IntlProvider>
  );
  const player = screen.getByRole('group', { name: 'Media player' });
  return { ...rendered, player };
}

describe('apps/client/web: the Taitube player', () => {
  it('draws its controls inside the element that goes fullscreen', () => {
    const { player } = renderPlayer();

    expect(within(player).getByRole('group', { name: 'Player controls' })).toBeInTheDocument();
  });

  it('leaves no timer behind its teardown once unmounted with the settings menu open', () => {
    vi.useFakeTimers();
    const { unmount } = renderPlayer();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Settings' }), { key: 'Enter' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    vi.advanceTimersByTime(0);

    expect(vi.getTimerCount()).toBe(0);
  });
});
