import { screen, waitFor, within } from '@testing-library/react';
import { CHANNEL, renderShell } from '#app/features/shell/__tests__/render-shell';
import { STUDIO_URL } from '#app/lib/config';

function linksIn(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);
}

const SIGNED_IN_LINKS = [
  ['Home', '/'],
  ['Shorts', '/shorts'],
  ['Subscriptions', '/subscriptions/videos'],
  ['Trending', '/feed/trending'],
  ['Live', '/live'],
  ['Settings', '/settings'],
  ['You', '/feed/you'],
  ['Watch history', '/feed/history'],
  ['Your channel', CHANNEL],
  ['Your videos', STUDIO_URL],
];

describe('apps/client/web: shell rail', () => {
  it.each([
    {
      viewer: 'a guest',
      url: '/feed/trending',
      signedIn: false,
      active: 'Trending',
      links: [
        ['Home', '/'],
        ['Shorts', '/shorts'],
        ['Trending', '/feed/trending'],
        ['Live', '/live'],
        ['Settings', '/settings'],
      ],
    },
    {
      viewer: 'a signed-in viewer',
      url: '/',
      signedIn: true,
      active: 'Home',
      links: SIGNED_IN_LINKS,
    },
    {
      viewer: 'a signed-in viewer on their channel',
      url: CHANNEL,
      signedIn: true,
      active: 'Your channel',
      links: SIGNED_IN_LINKS,
    },
  ])(
    'offers $viewer the rail links, $active marked current',
    async ({ url, signedIn, active, links }) => {
      await renderShell(url, signedIn);

      await waitFor(() => {
        const [rail] = screen.getAllByRole('navigation', { name: 'Main' });
        expect(rail && linksIn(rail)).toEqual(links);
        expect(rail && within(rail).getByRole('link', { name: active })).toHaveAttribute(
          'aria-current',
          'page'
        );
      });
    }
  );
});
