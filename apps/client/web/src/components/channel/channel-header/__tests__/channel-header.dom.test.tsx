import { render, screen } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { ChannelHeader, ChannelHeaderSkeleton } from '..';
import type { ChannelHeaderRootProps } from '../channel-header';

interface HeaderCase extends ChannelHeaderRootProps {
  bannerSrc?: string;
  subscribed?: boolean;
  pending?: boolean;
  live?: boolean;
}

const renderHeader = ({
  bannerSrc,
  subscribed = false,
  pending = false,
  live = false,
  ...props
}: HeaderCase = {}) =>
  render(
    <AppProviders>
      <main>
        <ChannelHeader.Root {...props}>
          <ChannelHeader.Banner src={bannerSrc} />
          <ChannelHeader.Identity
            name="Marta Reis Films"
            handle="@martareis"
            stats="284K subscribers · 86 videos"
            verified
            live={live}
          >
            <ChannelHeader.Bio more={<a href="/about">more</a>}>
              Short films shot on tape.
            </ChannelHeader.Bio>
            <ChannelHeader.Actions>
              <ChannelHeader.Subscribe subscribed={subscribed} pending={pending}>
                {subscribed ? 'Subscribed' : 'Subscribe'}
              </ChannelHeader.Subscribe>
            </ChannelHeader.Actions>
          </ChannelHeader.Identity>
          <ChannelHeader.Tabs>
            <ChannelHeader.Tab href="/home" active>
              Home
            </ChannelHeader.Tab>
            <ChannelHeader.Tab href="/videos">Videos</ChannelHeader.Tab>
          </ChannelHeader.Tabs>
        </ChannelHeader.Root>
      </main>
    </AppProviders>
  );

const tint = () =>
  document.querySelector('[data-slot="channel-header-banner"] [aria-hidden] > div');

describe('apps/client/web: ChannelHeader', () => {
  it('makes the name the page heading, with the handle and the finished stats beside it', () => {
    renderHeader();

    expect(screen.getByRole('heading', { level: 1, name: 'Marta Reis Films' })).toBeInTheDocument();
    expect(screen.getByText('@martareis · 284K subscribers · 86 videos')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Verified' })).toBeInTheDocument();
  });

  it('lists the sections as links in a labelled nav, the current one marked as the page', () => {
    renderHeader();

    const nav = screen.getByRole('navigation', { name: 'Channel sections' });

    expect(nav).toContainElement(screen.getByRole('link', { name: 'Home' }));
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Videos' })).not.toHaveAttribute('aria-current');
  });

  it('keeps only the identity row, under a second-level heading, in the identity layout', () => {
    renderHeader({ layout: 'identity', bannerSrc: '/banner.png', glowColor: 'sienna' });

    expect(screen.getByRole('heading', { level: 2, name: 'Marta Reis Films' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="channel-header-banner"]')).toBeNull();
  });

  it.each([
    {
      name: 'the banner image',
      bannerSrc: '/banner.png',
      glowColor: 'sienna',
      image: true,
      tinted: false,
    },
    {
      name: 'the sampled tint without a banner',
      bannerSrc: undefined,
      glowColor: 'sienna',
      image: false,
      tinted: true,
    },
    {
      name: 'the bare surface with neither',
      bannerSrc: undefined,
      glowColor: undefined,
      image: false,
      tinted: false,
    },
  ])('paints $name', ({ bannerSrc, glowColor, image, tinted }) => {
    renderHeader({ bannerSrc, glowColor });

    const banner = document.querySelector('[data-slot="channel-header-banner"]');

    expect(banner?.querySelector('img') !== null).toBe(image);
    expect(tint() !== null).toBe(tinted);
  });

  it.each([
    { subscribed: false, label: 'Subscribe', pressed: 'false' },
    { subscribed: true, label: 'Subscribed', pressed: 'true' },
  ])('shows Subscribe as a toggle pressed $pressed', ({ subscribed, label, pressed }) => {
    renderHeader({ subscribed });

    expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', pressed);
  });

  it('marks a pending subscription busy and a live channel with its badge', () => {
    renderHeader({ pending: true, live: true });

    expect(screen.getByRole('button', { name: 'Subscribe' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Live')).toHaveAttribute('data-slot', 'badge');
  });

  it('names a part used outside the root', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ChannelHeader.Actions />)).toThrow(
      'ChannelHeader.Actions must be inside ChannelHeader.Root'
    );
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderHeader({ bannerSrc: '/banner.png', glowColor: 'sienna', live: true });
    render(<ChannelHeaderSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});
