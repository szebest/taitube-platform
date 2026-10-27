import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';
import type { ComponentPropsWithRef } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { NowPlayingBar, NowPlayingBarSkeleton } from '..';
import type { NowPlayingBarRootProps } from '../now-playing-bar';

const RouterLink = (props: ComponentPropsWithRef<'a'>) => <a {...props} />;

function renderBar(props: Partial<NowPlayingBarRootProps> = {}) {
  const handlers = { onPlayPause: vi.fn(), onSeek: vi.fn() };
  const rendered = render(
    <AppProviders>
      <NowPlayingBar.Root playing progress={0.5} {...handlers} {...props}>
        <NowPlayingBar.Expand asChild>
          <RouterLink href="/watch/lisbon?t=252" />
        </NowPlayingBar.Expand>
        <NowPlayingBar.Media>
          <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" />
        </NowPlayingBar.Media>
        <NowPlayingBar.Info>
          <NowPlayingBar.Title>Lisbon at night</NowPlayingBar.Title>
          <NowPlayingBar.Subtitle>Marta Reis Films</NowPlayingBar.Subtitle>
        </NowPlayingBar.Info>
        <NowPlayingBar.Transport>
          <NowPlayingBar.Previous />
          <NowPlayingBar.PlayPause />
          <NowPlayingBar.Next disabled />
        </NowPlayingBar.Transport>
        <NowPlayingBar.Progress valueText="9 minutes of 18 minutes" step={0.1} />
        <NowPlayingBar.Time>09:00 / 18:00</NowPlayingBar.Time>
        <NowPlayingBar.Queue count="3 / 12" />
      </NowPlayingBar.Root>
    </AppProviders>
  );

  return { ...rendered, ...handlers, user: userEvent.setup() };
}

describe('apps/client/web: NowPlayingBar', () => {
  it('is a region named for what it is, with the expand link first in the tab order', async () => {
    const { user } = renderBar();

    await user.tab();

    expect(screen.getByRole('region', { name: 'Now playing' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the video' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Back to the video' })).toHaveAttribute(
      'href',
      '/watch/lisbon?t=252'
    );
  });

  it.each([
    { playing: true, name: 'Pause' },
    { playing: false, name: 'Play' },
  ])('names the one transport button $name and asks to toggle', async ({ playing, name }) => {
    const { user, onPlayPause } = renderBar({ playing });

    await user.click(screen.getByRole('button', { name }));

    expect(onPlayPause).toHaveBeenCalledOnce();
  });

  it.each([
    { key: '{ArrowRight}', fraction: 0.6 },
    { key: '{ArrowLeft}', fraction: 0.4 },
    { key: '{Home}', fraction: 0 },
    { key: '{End}', fraction: 1 },
  ])('seeks to $fraction on $key', async ({ key, fraction }) => {
    const { user, onSeek } = renderBar();
    const slider = screen.getByRole('slider', { name: 'Seek' });

    slider.focus();
    await user.keyboard(key);

    expect(onSeek).toHaveBeenCalledWith(expect.closeTo(fraction));
    expect(slider).toHaveAttribute('aria-valuetext', '9 minutes of 18 minutes');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows the live badge in place of the time and offers no seek while live', () => {
    renderBar({ status: 'live' });

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('09:00 / 18:00')).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('turns play into a retry while the video is unavailable', async () => {
    const { user, onPlayPause } = renderBar({ status: 'unavailable' });

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onPlayPause).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('says it is loading over the picture while buffering', () => {
    renderBar({ status: 'buffering' });

    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('keeps a missing next out of reach and the queue position in the queue button name', () => {
    renderBar();

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Queue 3 / 12' })).toBeInTheDocument();
  });

  it('names a part used outside its root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      render(
        <AppProviders>
          <NowPlayingBar.PlayPause />
        </AppProviders>
      )
    ).toThrow('NowPlayingBar.PlayPause must be inside NowPlayingBar.Root');
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderBar();
    render(<NowPlayingBarSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
