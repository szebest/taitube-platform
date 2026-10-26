import { screen, waitFor, within } from '@testing-library/react';

import { STUDIO_URL } from '#app/config';
import { CHANNEL, renderShell } from './render-shell';

function linksIn(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);
}

describe('apps/client/web: shell rail', () => {
  it.each([
    {
      viewer: 'a guest',
      url: '/feed/trending',
      signedIn: false,
      active: 'Trending',
      links: [
        ['Home', '/'],
        ['Trending', '/feed/trending'],
      ],
    },
    {
      viewer: 'a signed-in viewer',
      url: '/',
      signedIn: true,
      active: 'Home',
      links: [
        ['Home', '/'],
        ['Subscriptions', '/subscriptions/videos'],
        ['Trending', '/feed/trending'],
        ['Your channel', CHANNEL],
        ['Your videos', STUDIO_URL],
      ],
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
